require("dotenv").config();
const express = require("express");
const app = express();
const MongoDB = require("mongodb");
const mongodb = require("./db");
const socketio = require("./socket");
const sentry = require("@sentry/node");
const moment = require("moment");

sentry.init({
  dsn: process.env.SENTRY,
  release: "harker-bell-server@"+require("./package.json").version,
});
console.log("Starting...");
app.use(sentry.Handlers.requestHandler());
app.use(express.json()); // use new built-in Express middleware
app.use(express.urlencoded());
mongodb.connect().then(db => {
  console.log("Connected to DB.");
  app.use("/api", require("./api"));
  app.use("/admin", require("./admin"));

  app.get("/", (req, res) => {
    res.send("You found a secret page! Come work with us at <a href=\"https://dev.harker.org/join/\">dev.harker.org/join</a>.");
  });
  /** Responds with the bell schedule when a request from Actions on Google/Google Assistant is received. */
  app.post("/assistant", async (req, res) => {
    try {
      const query = req.body.queryResult;
      if (!query.intent) return res.status(400);
      switch (query.intent.name) {
        // Get bell schedule
        case "projects/harker-bell/agent/intents/37afe580-ee5c-4876-84b2-5744bbfa71bb":
        case "projects/harker-dev/agent/intents/ad05a529-e493-41af-8512-dba54e2c5230":
          return res.send(await handleScheduleRequest(query, db));
        // Get next period
        case "projects/harker-bell/agent/intents/0c87869e-6cc5-4802-8189-097c46c80525":
        case "projects/harker-dev/agent/intents/8934297d-8426-4b0c-9114-6c38e727d6ab":
          return res.send(await handleNextPeriodRequest(query, db));
        // Get period end
        case "projects/harker-bell/agent/intents/8b404980-e565-4441-8d76-33b28d54eaaa":
        case "projects/harker-dev/agent/intents/442fa531-5773-4621-a4c1-25b61cdfee18":
          return res.send(await handlePeriodEndRequest(query, db));
        // Get lunch menu
        case "projects/harker-dev/agent/intents/b60bd193-494d-4567-905d-86354cc60733":
          return res.send(await handleLunchRequest(query, db));
      }
    } catch (err) {
      sentry.captureException(err);
      return res.status(500).send("Internal error.");
    }
    return res.status(404).send("Action not found.");
  });
  
  app.use(sentry.Handlers.errorHandler());
  const server = app.listen(process.env.PORT, () => {
    console.log("Server running on port "+process.env.PORT);
  });
  
  socketio.connect(server).then(io => {
    io.on("connection", async socket => {
      /*console.log(new Date().toLocaleString()+":\t"+socket.id+" connected");
      socket.on("disconnect", () => {
        console.log(new Date().toLocaleString()+":\t"+socket.id+" disconnected");
      });*/
      socket.on("error", err => {
        console.error(err);
        sentry.captureException(err);
      });
      socket.on("request schedule", async (data, callback) => {
        console.log(new Date().toJSON()+":\t"+socket.id+" requested schedule "+JSON.stringify(data));
        console.log(socket.request.headers["user-agent"]);
        let schedules = await db.collection("schedules").find({
          date: {
            $gte: new Date(data.start),
            $lte: new Date(data.end)
          }
        });
        callback(await schedules.toArray());
      });
      socket.on("request update", async revision => {
        if (revision) {
          let revisions = await db.collection("revisions").find({_id: {
            $gt: new MongoDB.ObjectId(revision)
          }});
          revisions = await revisions.toArray();
          let changes = new Set();
          for (const revision of revisions)
            for (const date of revision.changes)
              changes.add(date.getTime());
          let schedules = [];
          for (const date of changes) {
            let schedule = await db.collection("schedules").findOne({date: new Date(date)});
            if (schedule) schedules.push(schedule);
          }
          socket.emit("update schedule", schedules, revisions[revisions.length-1] ? revisions[revisions.length-1]._id : null);
        } else {
          let schedules = await db.collection("schedules").find();
          schedules = await schedules.toArray();
          let lastRevision = await db.collection("revisions").find().limit(1).sort({_id: -1});
          lastRevision = await lastRevision.toArray();
          socket.emit("update schedule", schedules, lastRevision[0]._id);
        }
      });
      socket.emit("update message", (await db.collection("misc").findOne({type: "message"})).message);
    });
  });
}).catch(err => {
  sentry.captureException(err);
});

// Options for relative dates using Moment
const relDateOptions = {
  sameDay: "[Today]",
  nextDay: "[Tomorrow]",
  nextWeek: "dddd",
  lastDay: "[Yesterday]",
  lastWeek: "[Last] dddd",
  sameElse: "MMM D, YYYY"
};
/**
 * Determines if the given string starts with a vowel.
 * @param {string} str  the string to test
 */
function startsWithVowel(str) {
  return ["a", "e", "i", "o", "u"].includes(str.toLowerCase().substring(0, 1));
}
/**
 * 
 * @param {Object} query  the query object
 * @param {MongoDB.Db} db reference to the database
 */
async function handleScheduleRequest(query, db) {
  const date = new Date(query.parameters.date.substring(0, 10) || new Date());
  const momentDate = moment(query.parameters.date);
  const relDate = momentDate.calendar(undefined, relDateOptions);
  const schedule = await db.collection("schedules").findOne({date});
  let result = "<speak>"+relDate, title = "";
  if (schedule && schedule.code) {
    result += (momentDate.isBefore(undefined, "day") ? " was " : " is ");
    if (schedule.variant) {
      result += startsWithVowel(schedule.variant) ? "an " : "a ";
      result += schedule.variant+' ';
      title += schedule.variant.substring(0, 1).toUpperCase()+schedule.variant.substring(1)+" ";
    } else
      result += startsWithVowel(schedule.code) ? "an " : "a ";
    result += `<say-as interpret-as="spell-out">${schedule.code}</say-as> day.</speak>`;
  } else
    return {
      fulfillment_text: `Sorry, I couldn't find a schedule for ${relDate}.`,
    };
  title += `${schedule.code} schedule`;
  return {
    fulfillment_text: result,
    payload: {
      google: {
        expectUserResponse: false,
        richResponse: {
          items: [{
            simpleResponse: {ssml: result},
          }, {
            basicCard: {
              title,
              formattedText: momentDate.format("MMM D, YYYY"),
              buttons: [{
                title: "Open bell schedule",
                openUrlAction: {url: "https://bell.harker.org/?utm_source=gsched&utm_medium=assistant"},
              }],
            }
          }]
        },
      }
    }
  };
}
/**
 * 
 * @param {Object} query  the query object
 * @param {MongoDB.Db} db reference to the database
 */
async function handleNextPeriodRequest(query, db) {
  const now = new Date();
  let date = new Date(now-(now.getTimezoneOffset()*60*1000));
  let result = "";
  while (!result.length) {
    let schedule = await (await db.collection("schedules").find({
      date: {$gte: new Date(date.toJSON().substring(0, 10))}
    }).sort({date: 1}).limit(1)).toArray();
    for (const period of schedule[0].schedule) {
      if (period.start > date && /(^P[1-9]$)|Assembly|Advisory|Advisee|Meeting/.test(period.name)) {
        const momentDate = moment(period.start), momentNow = moment(now);
        if (momentDate.isAfter(momentNow, "day")) {
          const relDate = momentDate.calendar(momentNow, relDateOptions);
          result += `<speak>${period.name} starts ${relDate} at <say-as interpret-as="time">${period.start.toJSON().substring(11, 16)}</say-as>.</speak>`;
        } else
          result += `<speak>${period.name} starts at <say-as interpret-as="time">${period.start.toJSON().substring(11, 16)}</say-as>.</speak>`;
        break;
      }
    }
    date = new Date(+new Date(schedule[0].date) + 24*60*60*1000); // increment by 1 day
  }
  return {
    fulfillment_text: result,
    payload: {
      google: {
        expectUserResponse: false,
        richResponse: {
          items: [{
            simpleResponse: {ssml: result},
          }],
          linkOutSuggestion: {
            destinationName: "bell schedule",
            openUrlAction: {url: "https://bell.harker.org/?utm_source=gpstart&utm_medium=assistant"},
          },
        },
      }
    }
  }
}
/**
 * 
 * @param {Object} query  the query object
 * @param {MongoDB.Db} db reference to the database
 */
async function handlePeriodEndRequest(query, db) {
  const now = new Date();
  let date = new Date(now-(now.getTimezoneOffset()*60*1000));
  let result = "";
  while (!result.length) {
    let schedule = await (await db.collection("schedules").find({
      date: {$gte: new Date(date.toJSON().substring(0, 10))}
    }).sort({date: 1}).limit(1)).toArray();
    for (const period of schedule[0].schedule) {
      if (period.end > date) {
        const momentDate = moment(period.end), momentNow = moment(now);
        if (momentDate.isAfter(momentNow, "day")) {
          const relDate = momentDate.calendar(momentNow, relDateOptions);
          result += `<speak>${period.name} ends ${relDate} at <say-as interpret-as="time">${period.end.toJSON().substring(11, 16)}</say-as>.</speak>`;
        } else
          result += `<speak>${period.name} ends at <say-as interpret-as="time">${period.end.toJSON().substring(11, 16)}</say-as>.</speak>`;
        break;
      }
    }
    date = new Date(+new Date(schedule[0].date) + 24*60*60*1000); // increment by 1 day
  }
  return {
    fulfillment_text: result,
    payload: {
      google: {
        expectUserResponse: false,
        richResponse: {
          items: [{
            simpleResponse: {ssml: result},
          }],
          linkOutSuggestion: {
            destinationName: "bell schedule",
            openUrlAction: {url: "https://bell.harker.org/?utm_source=gpend&utm_medium=assistant"},
          },
        },
      }
    }
  }
}
/**
 * 
 * @param {Object} query  the query object
 * @param {MongoDB.Db} db reference to the database
 */
async function handleLunchRequest(query, db) {
  const date = new Date(query.parameters.date.substring(0, 10) || new Date());
  const momentDate = moment(query.parameters.date);
  const relDate = momentDate.calendar(undefined, relDateOptions);
  const schedule = await db.collection("schedules").findOne({date});
  let result = "";
  if (schedule && schedule.lunch.length) {
    if (!query.parameters.lunch_location)
      result += `Here's the lunch menu for ${relDate}.`;
    else {
      for (const item of schedule.lunch) {
        if (item.place == query.parameters.lunch_location) {
          result += `${query.parameters.lunch_location} ${momentDate.isBefore(undefined, "day") ? "served" : "is serving"} ${item.food} for ${relDate}.`;
          break;
        }
      }
      if (!result.length)
        result += `${query.parameters.lunch_location} is not serving anything for ${relDate}.`;
    }
  } else {
    result = `Sorry, there's no lunch menu for ${relDate}.`;
    return {
      fulfillment_text: result,
    };
  }
  let rows = [];
  for (const item of schedule.lunch)
    rows.push({cells: [{text: item.place}, {text: item.food}]});
  return {
    fulfillment_text: result,
    payload: {
      google: {
        expectUserResponse: false,
        richResponse: {
          items: [{
            simpleResponse: {textToSpeech: result},
          }, {
            tableCard: {
              title: "Lunch Menu",
              columnProperties: [{header: "Location"}, {header: "Menu Item"}],
              rows,
              buttons: [{
                title: "Open lunch menu",
                openUrlAction: {url: "https://bell.harker.org/?utm_source=glunch&utm_medium=assistant"},
              }],
            }
          }]
        },
      }
    }
  };
}