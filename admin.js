const express = require("express")
const router = express.Router();
const mongodb = require("./db");
const client = mongodb.getClient();
const db = mongodb.get();

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
  let auth = await db.collection("misc").findOne({access_token: {
    $exists: true,
    $eq: req.body.access_token
  }});
  if (!auth || !auth.permissions.includes("bulkWrite"))
    return res.status(401).send("Unauthorized access.");
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
  try {
    await session.withTransaction(async () => {
      for (const schedule of schedules) {
        await db.collection("schedules").updateOne({date: schedule.date}, {
          $set: schedule,
          $setOnInsert: {
            lunch: [],
            locations: [],
            events: [],
          }
        }, {upsert: true})
      }
      await db.collection("revisions").insertOne({
        timestamp: new Date(),
        changes: dates,
        name: auth.name,
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
  res.send("Successfully updated "+dates.length+" schedule(s).");
});
/**
 * Adds holidays (i.e. days with no school) to the schedule collection.
 * @param {string} access_token access token required for authentication
 * @param {string} start        start date of the holiday or break in ISO format, at UTC midnight
 * @param {string} end          end date of the holiday or break in ISO format, at UTC midnight
 * @param {string} name         name of the holiday or break
 */
router.get("/addHolidays", async (req, res) => {
  let auth = await db.collection("misc").findOne({access_token: {
    $exists: true,
    $eq: req.body.access_token
  }});
  if (!auth || !auth.permissions.includes("bulkWrite"))
    return res.status(401).send("Unauthorized access.");
  let schedules = [], dates = [];
  let end = new Date(req.body.end);
  for (let date = new Date(req.body.start); date <= end; date.setUTCDate(date.getUTCDate()+1)) {
    if (date.getUTCDay() == 0 || date.getUTCDay() == 6)
      continue;
    let schedule = {
      date: new Date(date),
      schedule: [],
      holiday: req.body.name,
    };
    dates.push(schedule.date);
    schedules.push(schedule);
  }
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const schedule of schedules) {
        await db.collection("schedules").updateOne({date: schedule.date}, {
          $set: schedule,
          $setOnInsert: {
            lunch: [],
            locations: [],
            events: [],
          }
        }, {upsert: true})
      }
      await db.collection("revisions").insertOne({
        timestamp: new Date(),
        changes: dates,
        name: auth.name,
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
  res.send("Successfully updated "+dates.length+" schedule(s).");
});

module.exports = router;