require("dotenv").config();
const express = require("express");
const app = express();
const socket = require("socket.io");
const MongoClient = require("mongodb").MongoClient;

console.log("STARTING");
MongoClient.connect(process.env.DB_HOST).then(client => {
  console.log("CONNECTED");
  const db = client.db(process.env.DB_NAME);
  
  app.use(express.json()); // use new built-in Express middleware to parse JSON bodies

  app.get("/", (req, res) => {
    res.send(process.env);
  });
  /** Responds with the bell schedule when a request from Actions on Google/Google Assistant is received. */
  app.post("/assistant", async (req, res) => {
    /** @type {Date} */
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
      str += formattedDate+(now-date>now.getTimezoneOffset()*60*1000 ? " is " : " was ");
      if (schedule.variant) {
        str += startsWithVowel(schedule.variant) ? "an " : "a ";
        str += schedule.variant+' "'+schedule.code+'"';
      } else {
        str += startsWithVowel(schedule.code) ? "an " : "a ";
        str += '"'+schedule.code+'"';
      }
      str += " day."
    } else {
      str += "Sorry, I couldn't find a schedule for "+formattedDate+".";
    }
    res.send({
      fulfillment_text: str,
    });
  });
  const server = app.listen(5000, () => {
    console.log("server is running on port");
  });
  
  const io = socket(server, {pingTimeout: 30000}); // consider increasing pingTimeout
  io.on("connection", socket => {
    console.log("connected "+socket.id);
    io.emit("test", "heyy");
    setTimeout(() => {
      io.emit("test", "10 seconds later");
    }, 10000);
    socket.on("initial date", data => {
      
    });
    socket.on("disconnect", err => {
      console.log("disconnected "+socket.id);
    });
    socket.on("error", err => {
      console.error(err);
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
