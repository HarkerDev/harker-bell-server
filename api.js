const express = require("express");
const cors = require("cors");
const router = express.Router();
const db = require("./db").get();
const socket = require("./socket");

router.use(cors());

// NOTE: All public APIs can be used by providing URL encoded or JSON request bodies.

/**
 * Retrieves the bell schedule for a single day.
 * @param {number} month  month from 0-11
 * @param {number} day    day from 1-31
 * @param {number} year   4-digit year
 */
router.get("/schedule", async (req, res) => {
  console.log(new Date().toJSON()+":\t GET /api/schedule "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    let data = await db.collection("schedules").findOne({
      date: new Date(Date.UTC(+(req.body.year || req.query.year), +(req.body.month || req.query.month)-1, +(req.body.day || req.query.day)))
    });
    if (data) {
      let {_id, lunch, locations, events, preset, ...schedule} = data;
      return res.send(schedule);
    } else
      return res.status(404).send("No schedule found.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Retrieves the lunch menu for a single day.
 * @param {number} month  month from 0-11
 * @param {number} day    day from 1-31
 * @param {number} year   4-digit year
 */
router.get("/lunchmenu", async (req, res) => {
  console.log(new Date().toJSON()+":\t GET /api/lunchmenu "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    let data = await db.collection("schedules").findOne({
      date: new Date(Date.UTC(+(req.body.year || req.query.year), +(req.body.month || req.query.month)-1, +(req.body.day || req.query.day)))
    });
    if (data && data.lunch.length != 0)
      return res.send({date: data.date, lunch: data.lunch});
    else
      return res.status(404).send("No lunch found.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Retrieves the list of events for a single day.
 * @param {number} month  month from 0-11
 * @param {number} day    day from 1-31
 * @param {number} year   4-digit year
 */
router.get("/events", async (req, res) => {
  console.log(new Date().toJSON()+":\t GET /api/events "+JSON.stringify(req.body));
  console.log(req.headers["user-agent"]);
  try {
    let data = await db.collection("schedules").findOne({
      date: new Date(Date.UTC(+(req.body.year || req.query.year), +(req.body.month || req.query.month)-1, +(req.body.day || req.query.day)))
    });
    if (data && data.events.length != 0)
      return res.send({date: data.date, events: data.events});
    else
      return res.status(404).send("No events found.");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
/**
 * Gets the number of currently connected clients.
 */
router.get("/clients", (req, res) => {
  return res.send(socket.get().engine.clientsCount.toString());
});
/**
 * For internal use only. Sends the number of connected clients in the form of a number of bytes.
 */
router.get("/clientsInternal", (req, res) => {
  const count = socket.get().engine.clientsCount;
  let str = "";
  for (let i = 0; i < count; i++) str += "A";
  return res.send(str);
});

module.exports = router;