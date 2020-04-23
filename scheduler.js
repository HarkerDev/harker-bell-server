const express = require("express");
const cors = require("cors");
const router = express.Router();
const mongodb = require("./db");
const db = mongodb.get();
const socket = require("./socket");
const sentry = require("@sentry/node");
const scheduler = require("node-schedule");

var job, vals = [], start = new Date();
router.use(cors());

router.post("/stop", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /scheduler/stop "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "special");
    if (!auth) return res.status(401).send("Unauthorized access.");
    if (job) {
      job.cancel();
      job = null;
    }
    return res.send("Done");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
router.post("/start", async (req, res) => {
  console.log(new Date().toJSON()+":\t POST /scheduler/start "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    const auth = await ensureAuth(req.body.access_token, "special");
    if (!auth) return res.status(401).send("Unauthorized access.");
    if (!job) scheduleNextBell();
    return res.send("Done");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});

/* from ./admin.js */
async function ensureAuth(access_token, permission) {
  let auth = await db.collection("users").findOne({access_token: {
    $exists: true,
    $eq: access_token,
  }});
  if (auth && auth.permissions.includes(permission)) return auth;
  return false;
}

/** Schedule the next virtual bell. */
async function scheduleNextBell() {
  const now = new Date();
  let date = new Date(now-(now.getTimezoneOffset()*60*1000));
  let found = false;
  let nextBell, isStartBell = false;
  while (!found) {
    let schedule = await (await db.collection("schedules").find({
      date: {$gte: new Date(date.toISOString().substring(0, 10))}
    }).sort({date: 1}).limit(1)).toArray();
    for (const period of schedule[0].schedule) {
      if (period.end > date && /(^P[1-9]$)|Advisory|(Class|School) Meeting|Assembly/.test(period.name)) {
        if (period.start > date) {
          nextBell = period.start;
          isStartBell = true;
        } else nextBell = period.end;
        found = true;
        break;
      }
    }
    date = new Date(+new Date(schedule[0].date) + 24*60*60*1000); // increment by 1 day
  }
  nextBell = new Date(+nextBell + (nextBell.getTimezoneOffset()*60*1000));
  job = scheduler.scheduleJob(nextBell, () => {
    vals = [];
    start = new Date();
    socket.get().volatile.emit("virtual bell", isStartBell);
    setTimeout(() => scheduleNextBell());
    setTimeout(() => {
      sentry.withScope(scope => {
        scope.setTags({
          count: vals.length,
          min: vals[0],
          max: vals[vals.length-1],
          median: vals[Math.floor(vals.length/2)],
          firstQuartile: vals[Math.ceil(vals.length/4)-1],
          thirdQuartile: vals[Math.ceil(vals.length*3/4)-1],
          ninetyPctl: vals[Math.ceil(vals.length*0.9)-1],
          ninety5Pctl: vals[Math.ceil(vals.length*0.95)-1],
          ninety9Pctl: vals[Math.ceil(vals.length*0.99)-1],
        });
        sentry.captureMessage("Virtual bell broadcasted");
      });
    }, 30000);
  });
}
function receiveAck() {
  vals.push((new Date()-start)/2);
}

module.exports = {scheduleNextBell, receiveAck, router};