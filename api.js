const express = require("express")
const router = express.Router();
const db = require("./db").get();
const socket = require("./socket");

// NOTE: All public APIs can be accessed using URL encoded or JSON request bodies.

/**
 * Retrieves the bell schedule for a single day.
 * @param {number} month  month from 0-11
 * @param {number} day    day from 1-31
 * @param {number} year   4-digit year
 */
router.get("/schedule", async (req, res) => {
  try {
    let data = await db.collection("schedules").findOne({
      date: new Date(Date.UTC(+req.body.year, +req.body.month-1, +req.body.day))
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
  try {
    let data = await db.collection("schedules").findOne({
      date: new Date(Date.UTC(+req.body.year, +req.body.month-1, +req.body.day))
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
  try {
    let data = await db.collection("schedules").findOne({
      date: new Date(Date.UTC(+req.body.year, +req.body.month-1, +req.body.day))
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

module.exports = router;