# Internal Documentation

::: warning Note
This page is scary and is meant for internal use only.
:::

The base URL for all requests is `https://bell.dev.harker.org/`, which is different from that of the public API. Body payloads should be passed as JSON with a `Content-Type` header set to `application/json`.

All ISO date strings should be in GMT-based and GMT-centric time, like if we had school at the Prime Meridian in Greenwich. Honestly not too sure why I chose this approach, but for now we'll just have to roll with it. Some examples: for a date, simply give UTC midnight like `2021-01-01T00:00:00.000Z`, and for a period start or end time, give the date and UTC time like `2021-01-01T08:00:00.000Z`.

The response received after a successful request will most likely be along the lines of "Success."

## `POST` /admin/editSchedule

Overrides the schedule for a single date. Adds a new DB document if it doesn't exist. It takes in a hardcoded schedule, so this isn't ideal for bulk updates. Only the `schedule`, `preset`, `code`, `variant`, and `name` fields of the schedule schema will be considered, so this can't be used to modify the lunch menu or events.

#### Request
```json
{
  "access_token": string,
  "schedule": [
    // see database schema page for an explanation of fields
  ]
}
```

## `POST` /admin/addFromPreset

Fills in the schedule for a single date by copying a preset stored in the database. Just use the admin console though.

#### Request
```json
{
  "access_token": string,
  "date": string, // ISO string at UTC midnight
  "preset": string // name of the preset
}
```

## `POST` /admin/autofillSchedule

The most important API endpoint on this page! Autofills the schedule for a range of dates based on a sequence of presets, where the schedule will repeatedly iterate over the list of presets. It will also skip weekends and any inputted holidays and will continue with the next preset on the following school day, so if the rotation is A, B, C, D, then the schedules will be A, B, C, D, A, B, etc.

Autofilling a large number of schedules is a potentially catastrophic action, so you need to include the current timestamp in the request as a check, accurate to 10 seconds or better. May cause unnatural feelings of extreme power and energy, so please use responsibly. May also screw over the whole school if you're not careful.

#### Request
```json
{
  "access_token": string,
  "start": string, // first date, ISO string at UTC midnight
  "end": string, // last date
  "rotation": string[], // array of schedule preset names that it will cycle through
  "holidays": string[], // array of ISO date strings
  "current_date": string // current time like described above, ISO string
}
```

## `POST` /admin/addHolidays

Deletes the schedule for a range of dates and replaces it with custom text, like for a holiday or break. Adds a new DB document if it doesn't exist.

#### Request
```json
{
  "access_token": string,
  "start": string, // first date, ISO string at UTC midnight
  "end": string, // last date
  "name": string // name of the holiday or break or random day with no school
}
```

## `POST` /admin/getAllPresets

Gets a list of all presets stored in the DB. Mainly for use by the admin console.

#### Request
```json
{
  "access_token": string
}
```

## `POST` /admin/addPreset

Adds a preset, which is like a schedule template that can be used to autofill schedules easily. Collaboration periods (named "Collaboration") will be dynamically determined based on the day of the week when autofilling schedules or adding from a preset. Don't include the start and end fields for Collaboration periods. The schedule schema for presets is the same as that of the actual schedules except that the start and end times do not have a date component. (If you need to edit this logic, be sure to edit the code in both the `autofillSchedule` and `addFromPreset` handlers.)

#### Request
```json
{
  "access_token": string,
  "preset": [
    {
      "name": string,
      "start": string, // ISO time string with date part omitted (e.g. "08:00:00.000")
      "end": string, // same as above
    },
    ...
  ]
}
```

## `POST` /admin/addEvents

Adds a list of events to the schedule for a given day and optionally deletes all existing events before doing so. A schedule document must already exist in the DB.

#### Request
```json
{
  "access_token": string,
  "date": string, // ISO string at UTC midnight
  "clear_all": boolean, // whether to clear all existing events before adding events
  "events": [
    {
      "name": string, // name of the event
      "category": string, // category of the event (see public API docs for possible values)
      "start": string, // start time, ISO string
      "end": string // end time, ISO string
    },
    ...
  ]
}
```

## `POST` /admin/getMessage

Gets the message that's shamelessly plugged at the top of the bell schedule website. It's a POST request even though it seems like it should be a GET request.

#### Request
```json
{
  "access_token": string
}
```

## `POST` /admin/editMessage

Sets a new message that's shamelessly plugged at the top of the bell schedule website.

#### Request
```json
{
  "access_token": string,
  "message": string // see admin console for formatting tips
}
```

## `GET` /admin/generateLunch

Returns pretty lunch menu data by parsing a CSV file generated from the PDF of the lunch menu using a fancy over-engineered algorithm. The reponse can be directly fed into the `addLunch` API endpoint.

#### Request
The request consists of several parts:
- A binary file of type `text/csv`
- A `Content-Type` header with value `text/csv`
- Two query params, `start` and `end`, denoting the first and last dates to parse from the file. Each should be an ISO string at UTC midnight, like `2021-01-01T00:00:00.000Z`, and URL-encoded.

## `POST` /admin/addLunch

Adds a list or lists of lunch menu items to the schedule for a given set of dates and optionally deletes all existing lunch menu items before doing so. This can be used to populate the lunch menu for multiple dates at once.

#### Request
```json
{
  "access_token": string,
  "clear_all": boolean, // whether to clear all existing events before menu items
  "lunch": {
    "0000-00-00T00:00:00.000Z": [ // sample date corresponding to this lunch menu list, ISO string
      {
        "place": string,
        "food": string // supports newline characters
      },
      ...
    ],
    ...
  }
}
```

## `POST` /assistant

For the Google Assistant integration.

#### Request
```json
{
  // a bunch of stuff that the Google Assistant regurgitates when it receives a prompt
}
```

#### Response
```json
{
  "fulfillment_text": string // the beautified, embellished, condensed reponse that should be returned to the precious user
}
```

## `POST` /scheduler/start

Starts the virtual bell scheduler. The bell will automatically be broadcasted at the start of the next class period. Super cool 10/10 would recommend

#### Request
```json
{
  "access_token": string
}
```

## `POST` /scheduler/stop

Stops the virtual bell scheduler.

#### Request
```json
{
  "access_token": string
}
```