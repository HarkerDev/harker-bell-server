require("dotenv").config();
const express = require("express");
const app = express();
const socket = require("socket.io");
const mongodb = require("./db");
const socketio = require("./socket");

console.log("STARTING");
app.use(express.json()); // use new built-in Express middleware
app.use(express.urlencoded());
mongodb.connect().then(db => {
  console.log("CONNECTED");
  app.use("/api", require("./api"));
  app.use("/admin", require("./admin"));

  app.get("/", (req, res) => {
    res.send(process.env);
  });
  /** Responds with the bell schedule when a request from Actions on Google/Google Assistant is received. */
  app.post("/assistant", async (req, res) => {
    let date = new Date(req.body.queryResult.parameters.date.substring(0, 10));
    const now = new Date();
    let formattedDate = date.toLocaleDateString(undefined, {
      timeZone: "UTC",
      weekday: "short",
      month: "long",
      day: "numeric",
      year: date.getUTCFullYear() == now.getFullYear() ? undefined : "numeric",
    });
    let schedule = await db.collection("schedules").findOne({date});
    let str = "";
    if (schedule) {
      str += formattedDate+(now-date < (now.getTimezoneOffset()+24*60)*60*1000 ? " is " : " was ");
      if (schedule.variant) {
        str += startsWithVowel(schedule.variant) ? "an " : "a ";
        str += schedule.variant+' "'+schedule.code+'"';
      } else {
        str += startsWithVowel(schedule.code) ? "an " : "a ";
        str += '"'+schedule.code+'"';
      }
      str += " schedule."
    } else {
      str += `Sorry, I couldn't find a schedule for ${formattedDate}.`;
    }
    res.send({
      fulfillment_text: str,
    });
  });
  const server = app.listen(process.env.PORT, () => {
    console.log("server is running on port "+process.env.PORT);
  });
  
  socketio.connect(server).then(io => {
    io.on("connection", async socket => {
      console.log("connected "+socket.id);
      socket.on("disconnect", err => {
        console.log("disconnected "+socket.id);
      });
      socket.on("error", err => {
        console.error(err);
      });
      socket.on("request schedule", async (data, callback) => {
        console.log(data);
        let schedules = await db.collection("schedules").find({
          date: {
            $gte: new Date(data.start),
            $lte: new Date(data.end)
          }
        });
        callback(await schedules.toArray());
      });
      socket.on("request update", async (revision, callback) => {
        
      });
      socket.emit("update message", (await db.collection("misc").findOne({type: "message"})).message);
    });
  });
}).catch(err => {
  throw err;
});

/**
 * 
 * @param {string} str  the string to test
 */
function startsWithVowel(str) {
  return ["a", "e", "i", "o", "u"].includes(str.toLowerCase().substring(0, 1));
}