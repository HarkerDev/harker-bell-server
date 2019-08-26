const express = require("express")
const router = express.Router();
const mongodb = require("./db");
const client = mongodb.getClient();
const db = mongodb.get();
const socket = require("./socket");

/**
 * Gets the user's authentication document with available permissions based on the access token.
 * @param {string} access_token access token required for authentication
 * @param {string} permission   the name of the permission required for the desired action
 * @return {Object|boolean}     auth object if the access token is valid and the user has the
 *                              necessary permission; otherwise, false
 */
async function ensureAuth(access_token, permission) {
  let auth = await db.collection("users").findOne({access_token: {
    $exists: true,
    $eq: access_token,
  }});
  if (auth && auth.permissions.includes(permission)) return auth;
  return false;
}
/**
 * Saves a new revision and pushes  schedule changes to all connected clients.
 * @param {string} name     name of the author of the revision
 * @param {Date[]} changes  array of dates for each schedule that was modified
 */
async function createNewRevision(name, changes, schedules) {
  let result = await db.collection("revisions").insertOne({
    timestamp: new Date(),
    changes,
    name,
  });
  const io = socket.get();
  io.emit("update schedule", schedules, result.insertedId);
}
/**
 * Updates the live message displayed on all connected bell schedule clients.
 * @param {string} access_token access token required for authentication
 * @param {string} message      the new message that should be set
 */
router.post("/editMessage", async (req, res) => {
  try {
    const auth = await ensureAuth(req.body.access_token, "editMessage");
    if (!auth) return res.status(400).send("Unauthorized access.");
    await db.collection("misc").updateOne({type: "message"}, {
      $set: {message: req.body.message}
    });
    const io = socket.get();
    io.emit("update message", req.body.message);
    return res.send("Success.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Autofills the bell schedule and saves it to the database.
 * This code will need to be rewritten if the schedule rotation is changed in the future.
 * @param {string} access_token access token required for authentication
 * @param {string} start        ISO string representing the first date to autofill, at UTC midnight
 * @param {string} end          ISO string representing the last date to autofill, at UTC midnight
 * @param {string[]} rotation   array of schedule presets to use for the schedule rotation
 * @param {string[]} holidays   array of ISO date strings for each day that should be skipped
 * @param {string} current_date autofilling a large number of schedules in the production database could be a
 *                              potentially destructive action. add the current date in ISO format as a check.
 */
router.post("/autofillSchedule", async (req, res) => {
  try {
    const auth = await ensureAuth(req.body.access_token, "bulkWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    if (new Date().toISOString().substr(0, 18) !== req.body.current_date.substr(0, 18)) // max 10-second window
      return res.status(400).send("Timestamp validation failed.");
    let index = 0;
    let schedules = [], presets = [], dates = [];
    for (const preset of req.body.rotation) {
      let data = await db.collection("presets").findOne({preset});
      delete data._id;
      presets.push(data);
    }
    let end = new Date(req.body.end);
    for (let date = new Date(req.body.start); date <= end; date.setUTCDate(date.getUTCDate()+1)) {
      if (date.getUTCDay() == 0 || date.getUTCDay() == 6 || req.body.holidays.includes(date.toISOString()))
        continue;
      let schedule = JSON.parse(JSON.stringify(presets[index]));
      dates.push(schedule.date = new Date(date));
      for (let i = schedule.schedule.length-1; i >= 0; i--) {
        let period = schedule.schedule[i];
        if (period.name == "Collaboration") {
          switch (date.getUTCDay()) {
            case 1: case 2: case 4:
              period.name = "Office Hours";
              period.start = "15:10:00.000";
              period.end = "15:30:00.000";
              break;
            case 3:
              period.name = "Faculty Meeting";
              period.start = "15:10:00.000";
              period.end = "16:30:00.000";
              break;
            case 5:
              schedule.schedule.splice(i, 1);
              continue;
          }
        }
        period.start = new Date(date.toISOString().substr(0, 11)+period.start+"Z");
        period.end = new Date(date.toISOString().substr(0, 11)+period.end+"Z");
      }
      schedules.push(schedule);
      index++;
      if (index >= presets.length) index = 0;
    }
    const session = client.startSession();
    await session.withTransaction(async () => {
      let insertedSchedules = [];
      for (const schedule of schedules) {
        await db.collection("schedules").updateOne({date: schedule.date}, {
          $set: schedule,
          $setOnInsert: {
            lunch: [],
            events: [],
          }
        }, {upsert: true});
        insertedSchedules.push(await db.collection("schedules").findOne({date: schedule.date}));
      }
      await createNewRevision(auth.name, dates, insertedSchedules);
    });
    return res.send("Successfully updated "+dates.length+" schedule(s).");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Adds holidays (i.e. days with no school) to the schedule collection.
 * @param {string} access_token access token required for authentication
 * @param {string} start        start date of the holiday or break in ISO format, at UTC midnight
 * @param {string} end          end date of the holiday or break in ISO format, at UTC midnight
 * @param {string} name         name of the holiday or break
 */
router.post("/addHolidays", async (req, res) => {
  try {
    const auth = await ensureAuth(req.body.access_token, "bulkWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    let schedules = [], dates = [];
    let end = new Date(req.body.end);
    for (let date = new Date(req.body.start); date <= end; date.setUTCDate(date.getUTCDate()+1)) {
      if (date.getUTCDay() == 0 || date.getUTCDay() == 6)
        continue;
      let schedule = {
        date: new Date(date),
        schedule: [],
        name: req.body.name,
      };
      dates.push(schedule.date);
      schedules.push(schedule);
    }
    const session = client.startSession();
    await session.withTransaction(async () => {
      let insertedSchedules = [];
      for (const schedule of schedules) {
        await db.collection("schedules").updateOne({date: schedule.date}, {
          $set: schedule,
          $setOnInsert: {
            lunch: [],
            events: [],
          }
        }, {upsert: true});
        insertedSchedules.push(await db.collection("schedules").findOne({date: schedule.date}));
      }
      await createNewRevision(auth.name, dates, insertedSchedules);
    });
    return res.send("Successfully updated "+dates.length+" schedule(s).");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Modifies the schedule for a single day. This should NOT be used to change the
 * lunch menu or events (only schedule, code, variant, preset, and name).
 * @param {string} access_token access token required for authentication
 * @param {Object} schedule     the new schedule (lunch and events will NOT be modified)
 */
router.post("/editSchedule", async (req, res) => {
  try {
    const auth = await ensureAuth(req.body.access_token, "singleWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const schedule = req.body.schedule;
    const date = new Date(schedule.date);
    if (schedule.schedule)
      for (const period of schedule.schedule) {
        if (period.start) period.start = new Date(period.start);
        if (period.end) period.end = new Date(period.end);
      }
    const session = client.startSession();
    await session.withTransaction(async () => {
      await db.collection("schedules").updateOne({date}, {
        $set: {
          ...(schedule.schedule && {schedule: schedule.schedule}),
          ...(schedule.preset && {preset: schedule.preset}),
          ...(schedule.code && {code: schedule.code}),
          ...(schedule.variant && {variant: schedule.variant}),
          ...(schedule.name && {name: schedule.name}),
        },
        $setOnInsert: {
          lunch: [],
          events: [],
        }
      }, {upsert: true});
      let insertedSchedule = await db.collection("schedules").findOne({date});
      await createNewRevision(auth.name, [date], insertedSchedule);
    });
    return res.send("Success.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Adds additional events to the list of events for a certain day. Removes existing events if so desired.
 * @param {string} access_token access token required for authentication
 * @param {string} date         date to which the events should be added, in ISO format
 * @param {Object[]} events     list of events to be added
 * @param {boolean} clear_all   whether or not all existing events should be removed before adding new ones
 */
router.post("/addEvents", async (req, res) => {
  try {
    const auth = await ensureAuth(req.body.access_token, "singleWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const date = new Date(req.body.date);
    const events = req.body.events;
    for (const event of events) {
      event.start = new Date(event.start);
      event.end = new Date(event.end);
    }
    const session = client.startSession();
    await session.withTransaction(async () => {
      await db.collection("schedules").updateOne({date}, req.body.clear_all == true ? {
        $set: {events}
      } : {
        $push: {
          events: {$each: events}
        }
      });
      let insertedSchedule = await db.collection("schedules").findOne({date});
      await createNewRevision(auth.name, [date], insertedSchedule);
    });
    return res.send("Success.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Changes the lunch menu for a certain day. Removes the existing lunch items if so desired.
 * @param {string} access_token access token required for authentication
 * @param {string} date         date to which the lunch should be added, in ISO format
 * @param {Object[]} lunch      list of menu items to be added
 * @param {boolean} clear_all   whether or not all existing menu items should be removed before adding new ones
 */
router.post("/addLunch", async (req, res) => {
  try {
    const auth = await ensureAuth(req.body.access_token, "singleWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const date = new Date(req.body.date);
    const lunch = req.body.lunch;
    const session = client.startSession();
    await session.withTransaction(async () => {
      await db.collection("schedules").updateOne({date}, req.body.clear_all == true ? {
        $set: {lunch: lunch}
      } : {
        $push: {
          lunch: {$each: lunch}
        }
      });
      let insertedSchedule = await db.collection("schedules").findOne({date});
      await createNewRevision(auth.name, [date], insertedSchedule);
    });
    return res.send("Success.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});

module.exports = router;