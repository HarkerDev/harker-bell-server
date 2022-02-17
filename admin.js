const express = require("express")
const cors = require("cors");
const router = express.Router();
const mongodb = require("./db");
const client = mongodb.getClient();
const db = mongodb.get();
const socket = require("./socket");
const parse = require("csv-parse/lib/sync");

router.use(cors());
/** For text/csv content type. Used in generateLunch. */
router.use((req, res, next) => {
  if (req.is("text/*")) {
    req.text = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {req.text += chunk});
    req.on("end", next);
  } else next();
});
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
 * Saves a new revision and pushes schedule changes to all connected clients.
 * @param {string} name         name of the author of the revision
 * @param {Date[]} changes      array of dates for each schedule that was modified
 * @param {Object[]} schedules  array of schedules
 */
async function createNewRevision(name, changes, schedules) {
  let documents = await db.collection("schedules").find({
    date: {$in: changes}
  });
  documents = await documents.toArray();
  let result = await db.collection("revisions").insertOne({
    timestamp: new Date(),
    changes,
    documents,
    name,
  });
  const io = socket.get();
  io.emit("update schedule", schedules, result.insertedId);
}
/**
 * Retrives the live message displayed on all connected bell schedule clients.
 * @param {string} access_token access token required for authentication
 */
router.post("/getMessage", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/getMessage "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "read");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const data = await db.collection("misc").findOne({type: "message"});
    return res.send(data.message);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Updates the live message displayed on all connected bell schedule clients.
 * @param {string} access_token access token required for authentication
 * @param {string} message      the new message that should be set
 */
router.post("/editMessage", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/editMessage "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "editMessage");
    if (!auth) return res.status(401).send("Unauthorized access.");
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
 * Retrives the ASB announcements displayed on all connected bell schedule clients.
 * @param {string} access_token access token required for authentication
 */
router.post("/getAnnouncement", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/getMessage "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "read");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const data = await db.collection("misc").findOne({type: "announcement"});
    return res.send(data);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Updates the ASB annoncements popup
 * @param {string} access_token access token required for authentication
 * @param {string} message      the new message that should be set
 */
router.post("/editAnnouncement", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/editAnnouncement "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "editMessage");
    if (!auth) return res.status(401).send("Unauthorized access.");
    await db.collection("misc").updateOne({type: "announcement"}, {
      $set: {message: req.body.message, date: new Date().toLocaleString()}
    });
    const io = socket.get();
    io.emit("update announcement", req.body.message);
    return res.send("Success.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Inserts a schedule preset into the database. If a preset with the name already exists, it will be overriden.
 * @param {string} access_token access token required for authentication
 * @param {preset} preset       the preset to be edited (must satisfy the database schema)
 */
router.post("/addPreset", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/addPreset "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "singleWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    await db.collection("presets").replaceOne({preset: req.body.preset.preset}, req.body.preset, {upsert: true});
    return res.send("Success.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Gets all schedule presets from the database.
 * @param {string} access_token access token required for authentication
 */
router.post("/getAllPresets", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/getAllPresets "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "read");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const data = await db.collection("presets").find().sort({preset: 1}).toArray();
    return res.send(data);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Autofills the bell schedule and saves it to the database.
 * This code will need to be rewritten if the schedule rotation is changed in the future.
 * Note that once new schedules are added, those documents cannot be deleted. Only the schedule part can.
 * @param {string} access_token access token required for authentication
 * @param {string} start        ISO string representing the first date to autofill, at UTC midnight
 * @param {string} end          ISO string representing the last date to autofill, at UTC midnight
 * @param {string[]} rotation   array of schedule presets to use for the schedule rotation
 * @param {string[]} holidays   array of ISO date strings for each day that should be skipped
 * @param {string} current_date autofilling a large number of schedules in the production database could be a
 *                              potentially destructive action. add the current date in ISO format as a check.
 */
router.post("/autofillSchedule", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/autofillSchedule "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "bulkWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    if (new Date().toISOString().substr(0, 18) !== req.body.current_date.substr(0, 18)) // max 10-second window
      return res.status(400).send("Timestamp validation failed.");
    let index = 0;
    let schedules = [], presets = [], dates = [];
    for (const preset of req.body.rotation) {
      let data = await db.collection("presets").findOne({preset});
      if (!data) return res.status(404).send("Preset "+preset+" not found.");
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
              period.end = "15:30:00.000";
              break;
            case 5:
              schedule.schedule.splice(i, 1);
              continue;
          }
        } else if (period.name == "Activity Block") {
          switch (date.getUTCDay()) {
            case 1:
              period.name = "Clubs / Office Hours";
              break;
            case 2:
              period.name = "Advisory / Class Meeting";
              break;
            case 3:
              period.name = "Office Hours";
              break;
            case 4:
              period.name = "Spirit / Assembly";
              break;
            case 5:
              period.name = "Clubs";
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
  console.log(new Date().toJSON()+":\t POST /admin/addHolidays "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
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
  console.log(new Date().toJSON()+":\t POST /admin/editSchedule "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "singleWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const schedule = req.body.schedule;
    const date = new Date(schedule.date);
    if (schedule.schedule)
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
              period.end = "15:30:00.000";
              break;
            case 5:
              schedule.schedule.splice(i, 1);
              continue;
          }
        } else if (period.name == "Activity Block") {
          switch (date.getUTCDay()) {
            case 1:
              period.name = "Clubs / Office Hours";
              break;
            case 2:
              period.name = "Advisory / Class Meeting";
              break;
            case 3:
              period.name = "Office Hours";
              break;
            case 4:
              period.name = "Spirit / Assembly";
              break;
            case 5:
              period.name = "Clubs";
          }
        }
        if (period.start) {
          if (period.start.length <= 12) // if no date part is included
            period.start = new Date(date.toISOString().substr(0, 11)+period.start+"Z");
          else period.start = new Date(period.start);
        }
        if (period.end) {
          if (period.end.length <= 12)
            period.end = new Date(date.toISOString().substr(0, 11)+period.end+"Z");
          else period.end = new Date(period.end);
        }
      }
    const session = client.startSession();
    await session.withTransaction(async () => {
      await db.collection("schedules").updateOne({date}, {
        $set: {
          ...(schedule.schedule && {schedule: schedule.schedule}), // conditionally add key to object
          ...(schedule.preset && {preset: schedule.preset}),
          ...(schedule.code && {code: schedule.code}),
          ...(schedule.variant && {variant: schedule.variant}),
          ...(schedule.name && {name: schedule.name}),
        },
        $unset: {
          ...(!schedule.variant && {variant: schedule.variant}),
          ...(!schedule.name && {name: schedule.name}),
        },
        $setOnInsert: {
          lunch: [],
          events: [],
        }
      }, {upsert: true});
      let insertedSchedule = await db.collection("schedules").findOne({date});
      await createNewRevision(auth.name, [date], [insertedSchedule]);
    });
    return res.send("Success.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Edits the schedule for a certain day using a preset.
 * @param {string} access_token access token required for authentication
 * @param {string} date         ISO string representing the date of the schedule to edit, at UTC midnight
 * @param {string} preset       name of the schedule preset that should be used
 */
router.post("/addFromPreset", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/addFromPreset "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "singleWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    let preset = await db.collection("presets").findOne({preset: req.body.preset});
    if (!preset) return res.status(404).send("Preset "+req.body.preset+" not found.");
    delete preset._id;
    let date = new Date(req.body.date);
    preset.date = date;
    for (let i = preset.schedule.length-1; i >= 0; i--) {
      let period = preset.schedule[i];
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
            period.end = "15:30:00.000";
            break;
          case 5:
            preset.schedule.splice(i, 1);
            continue;
        }
      } else if (period.name == "Activity Block") {
        switch (date.getUTCDay()) {
          case 1:
            period.name = "Clubs / Office Hours";
            break;
          case 2:
            period.name = "Advisory / Class Meeting";
            break;
          case 3:
            period.name = "Office Hours";
            break;
          case 4:
            period.name = "Spirit / Assembly";
            break;
          case 5:
            period.name = "Clubs";
        }
      }
      period.start = new Date(date.toISOString().substr(0, 11)+period.start+"Z");
      period.end = new Date(date.toISOString().substr(0, 11)+period.end+"Z");
    }
    const session = client.startSession();
    await session.withTransaction(async () => {
      await db.collection("schedules").updateOne({date}, {
        $set: preset,
        $setOnInsert: {
          lunch: [],
          events: [],
        }
      }, {upsert: true});
      await createNewRevision(auth.name, [date], [await db.collection("schedules").findOne({date})]);
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
  console.log(new Date().toJSON()+":\t POST /admin/addEvents "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "singleWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const date = new Date(req.body.date);
    let events = req.body.events;
    for (const event of events) {
      event.start = new Date(event.start);
      event.end = new Date(event.end);
    }
    const session = client.startSession();
    await session.withTransaction(async () => {
      if (!req.body.clear_all) {
        const schedule = await db.collection("schedules").findOne({date});
        events = schedule.events.concat(events);
        events.sort((a, b) => {
          return +a.start == +b.start ? a.end-b.end : a.start-b.start;
        });
      }
      await db.collection("schedules").updateOne({date}, {
        $set: {events}
      });
      let insertedSchedule = await db.collection("schedules").findOne({date});
      await createNewRevision(auth.name, [date], [insertedSchedule]);
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
 * @param {Object} lunch      list of menu items to be added
 * @param {boolean} clear_all   whether or not all existing menu items should be removed before adding new ones
 */
router.post("/addLunch", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /admin/addLunch");
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "singleWrite");
    if (!auth) return res.status(401).send("Unauthorized access.");
    const session = client.startSession();
    await session.withTransaction(async () => {
      let dates = [];
      let insertedSchedules = [];
      for (const [key, lunch] of Object.entries(req.body.lunch)) {
        const date = new Date(key);
        dates.push(date);
        await db.collection("schedules").updateOne({date}, req.body.clear_all == true ? {
          $set: {lunch}
        } : {
          $push: {
            lunch: {$each: lunch}
          }
        });
        insertedSchedules.push(await db.collection("schedules").findOne({date}));
      }
      await createNewRevision(auth.name, dates, insertedSchedules);
    });
    return res.send("Success.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Parses a generated lunch menu CSV (from a PDF) and returns JSON containing the menu items for each day.
 * NOTE: Provide parameters as a URL query string.
 * See docs for information about getting a CSV from the lunch menu PDF.
 * @param {string} start  start date of the lunch menu CSV
 * @param {string} end    end date of the lunch menu CSV
 */
router.get("/generateLunch", (req, res) => {
  console.log(new Date().toJSON()+":\t GET /admin/generateLunch");
  console.log(req.headers["user-agent"]);
  const data = parse(req.text, {
    columns: true,
  });
  let menus = {};
  for (const [header, value] of Object.entries(data[0]))
    if (value) menus[header] = [];
  for (const row of data)
    for (const [header, value] of Object.entries(row))
      if (menus[header] && value) {
        if (value == value.toUpperCase() && value != "BBQ" && !value.includes("CLOSED"))
          menus[header].push({place: properCase(value), food: ""});
        else {
          const lastItem = menus[header][menus[header].length-1];
          if (lastItem.food) lastItem.food += "\n";
          lastItem.food += value;
        }
      }
  let dates = [];
  let endDate = new Date(req.query.end);
  for (let date = new Date(req.query.start); date <= endDate; date.setUTCDate(date.getUTCDate()+1))
    dates.push(new Date(date));
  Object.entries(menus).forEach(([header, value], index) => {
    menus[dates[index].toISOString()] = value;
    delete menus[header];
  });
  return res.send(menus);
});
/**
 * Capitalizes only the first letter of each word.
 * @param {string} str  the string to convert to proper case
 */
function properCase(str) {
  str = str.toLowerCase().split(" ").map(s => s.charAt(0).toUpperCase()+s.substring(1)).join(" ");
  return str.replace("Bbq", "BBQ").replace("Of", "of");
}

module.exports = router;
