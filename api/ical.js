const express = require('express');
const router = express.Router();

const db = require("../db").get();
const ics = require("ics");

const MS_PER_MIN = 60 * 1000;

router.get("/", async (req, res) => {
  res.redirect(`webcal://bell.harker.org/api/ical/feed?v=1&t=${(new Date).getTime()}&source=root&excludedLunchDurations=45&includeSchedule&includeEvents=all`)
});

router.get("/feed", async (req, res) => {
  console.log(new Date().toJSON()+":\t GET /api/ical/feed "+JSON.stringify(req.body)+" "+JSON.stringify(req.query));
  console.log(req.headers["user-agent"]);

  const now = new Date();

  // Date defaults to today
  const year = req.body.year || req.query.year || now.getFullYear();
  const month = req.body.month || req.query.month || now.getUTCMonth() + 1;
  const day = req.body.day || req.query.day || now.getDate();

  const excludedBlocks = req.body.exclude || req.query.exclude; // Period names to exclude (e.g. Frosh+Mtg.)
  const excludedLunches = req.body.excludedLunchDurations || req.query.excludedLunchDurations; // Exclude lunch blocks by minute duration

  const baseDate = new Date(Date.UTC(+(year), +(month)-1, +(day)));
  const range = clamp(req.body.range || req.query.range || 90, 1, 125); // Number of days to include before and after baseDate

  const startDate = new Date(baseDate);
  startDate.setUTCDate(startDate.getUTCDate() - range);
  
  const endDate = new Date(baseDate);
  endDate.setUTCDate(endDate.getUTCDate() + range);

  let events = []; // Events to convert to iCal
  
  const excludedBlockTitles = excludedBlocks ? excludedBlocks.split(',') : false;
  const excludedLunchDurations = excludedLunches ? excludedLunches.split(',') : false;
  const includedEventCategories = (req.body.includeEvents || req.query.includeEvents) ? (req.body.includeEvents || req.query.includeEvents).toLowerCase().split(',') : false; // Event categories to include, 'all' for all events

  try {
    await db.collection("schedules").find({
      date: {
          $gte: startDate,
          $lte: endDate
      }
    }).forEach(document => {

      // Add bell schedule
      if (Object.hasOwn(req.query, 'includeSchedule')) {
        for (const block of document.schedule) {
          
          if (!block.name) continue;
          if (block.noICal) continue;
          if (excludedBlockTitles && excludedBlockTitles.includes(block.name)) continue; // ?exclude=ExcludedClass1,ExcludedClass2
          if (excludedLunchDurations && block.name == "Lunch" && excludedLunchDurations.includes(String((block.end - block.start)/MS_PER_MIN))) continue; // ?excludedLunchDurations=30,45
          // if (Object.hasOwn(req.query, 'removeShortLunch') && block.name == "Lunch" && (block.end - block.start)/60000 == 45) continue;
          // if (Object.hasOwn(req.query, 'removeShorterLunch') && block.name == "Lunch" && (block.end - block.start)/60000 == 30) continue;

          const startArray = getDateArrayFromISO(block.start.toISOString())
          const endArray = getDateArrayFromISO(block.end.toISOString())

          events.push(setDefaultData({
            title: block.name,
            url: block.link ? block.link : `https://bell.harker.org/${startArray[0]}/${startArray[1]}/${startArray[2]}`,
            location: block.location,
            ...((block.name == "Lunch" || block.forceLunch) ? {
              // Copy lunch menu to description
              description: document.lunch.map(item => `${item.place}: ${item.food.replace(/(?:\(GF\)|\(VEG\)|\(VEG, GF\)) /g, '').replace(/\n/g, ', ')}`).join('\n\n') 
            } : {}),
            start: startArray,
            end: endArray
          }))

        }
      }

      // Add extra events
      if (includedEventCategories) {
        for (const event of document.events) {
          
          if (event.noICal) continue;
          if (!includedEventCategories.includes(event.category.toLowerCase()) && !includedEventCategories.includes('all')) continue;

          const startArray = getDateArrayFromISO(event.start.toISOString())
          const endArray = getDateArrayFromISO(event.end.toISOString())

          events.push(setDefaultData({
            title: event.name,
            url: event.link ? event.link : `https://bell.harker.org/${startArray[0]}/${startArray[1]}/${startArray[2]}`,
            location: event.location,
            description: String(event.category)[0].toUpperCase() + event.category.slice(1),
            categories: [event.category],
            start: startArray,
            end: endArray
          }))
        }
      }
    });

    if (events.length == 0) return res.sendStatus(404);

    ics.createEvents(events, (error, value) => {
      if (error) {
        console.error(`Error when generating ics: ${error}`)
        return res.sendStatus(500);
      }
      res.setHeader("Content-Type", "text/calendar")
      res.setHeader("Content-Disposition", `attachment; filename=us_bell_schedule_${year}_${month}_${day}.ics`)
      return res.send(value)
    })
  
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

function setDefaultData(event) {
  event.organizer = { name: 'HarkerDev', email: 'dev@harker.org' };
  event.productId = "pestowp/ics";

  return event;
}

// ISO 8601 to [year, month, day, hour, minute]
function getDateArrayFromISO(x) {
  return x.replace(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}\.\d{3}(\w)/,
    function($0,$1,$2,$3,$4,$5,$6) {
      return [$1, $2, $3, $4, $5]
    }
  ).split(',').map(Number)
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max)
}

module.exports = router;