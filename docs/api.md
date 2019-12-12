---

---
# API Documentation

We provide a free public REST Application Programming Interface (API) that you can use to incorporate real bell schedule, lunch menu, and event data into your project.

## Introduction

The base URL for all requests is `https://bell.dev.harker.org/api` (HTTPS is required). For example, the full URL for a request to the `/schedule` endpoint would be `https://bell.dev.harker.org/api/schedule`.

Every endpoint supports both JSON and URL-encoded request bodies. The code examples use request bodies that are URL-encoded.

Also note that all dates returned in the JSON response are represented as an [ISO 8601](https://xkcd.com/1179) date-time string in UTC time.

::: tip Important:
Be sure to specify either a `Content-Type: application/json` or `Content-Type: application/x-www-form-urlencoded` HTTP header with each request, depending on which type you use, or else our server may get angry and throw a fit (a.k.a. a 400 error).
:::

Because no authentication is required, we may enforce IP-based rate limiting for all requests. If you encounter problems with accessing our API, please contact <a href="mailto:dev@harker.org" target="_blank">dev@harker.org</a>.

## `GET` /schedule

Returns the bell schedule for a given date.

#### Request Schema
```json
{
  "month": number, // between 1 and 12
  "day": number, // between 1 and 31
  "year": number // four-digit year
}
```

#### Response Schema
```json
{
  "date": string, // ISO string for the date at UTC midnight
  "code": string, // usually A, B, C, or D
  "variant"?: string, // usually 'special' or 'adjusted', if applicable
  "name"?: string, // name of the modified schedule or holiday
  "schedule": [
    {
      "start": string, // ISO string in UTC time
      "end": string, // ISO string in UTC time
      "name": string // name of this period
    },
    ...
  ]
}
```

#### Example Request
The following example gets the schedule for August 26, 2019. Copy and paste the code into a terminal window to try it out.
```bash
curl --request GET \
  --url https://bell.dev.harker.org/api/schedule \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data month=8 \
  --data day=26 \
  --data year=2019
```

## `GET` /lunchmenu

Returns the lunch menu for a given date.

#### Request Schema
```json
{
  "month": number, // between 1 and 12
  "day": number, // between 1 and 31
  "year": number // four-digit year
}
```

#### Response Schema
```json
{
  "date": string, // ISO string for the date at UTC midnight
  "lunch": [
    {
      "place": string, // where this menu item is being served
      "food": string // name of the menu item (may contain newline characters)
    },
    ...
  ]
}
```

#### Example Request
```bash
curl --request GET \
  --url https://bell.dev.harker.org/api/lunchmenu \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data month=8 \
  --data day=26 \
  --data year=2019
```

## `GET` /events

Returns a list of events for a given date.

#### Request Schema
```json
{
  "month": number, // between 1 and 12
  "day": number, // between 1 and 31
  "year": number // four-digit year
}
```

#### Response Schema
```json
{
  "date": string, // ISO string for the date at UTC midnight
  "events": [
    {
      "name": string, // name of this event
      "start": string, // ISO string in UTC time
      "end": string, // ISO string in UTC time
      "category": string // see below for possible category names
    },
    ...
  ]
}
```

### Event Categories
Possible categories (and their corresponding color on the bell schedule app):
Category | Identifier | Color
-------- | ---------- | -----
Schoolwide | `schoolwide` | ![#EA4335](https://placehold.it/10/EA4335?text=+)&nbsp; Red
Academics | `academics` | ![#FA7B17](https://placehold.it/10/FA7B17?text=+)&nbsp; Orange
Important Events | `important` | ![#FBBC04](https://placehold.it/10/FBBC04?text=+)&nbsp; Yellow
Athletics & Spirit | `athspirit` | ![#0F9D58](https://placehold.it/10/0F9D58?text=+)&nbsp; Green
Other Departments/Extracurriculars | `extra` | ![#00C3A6](https://placehold.it/10/00C3A6?text=+)&nbsp; Teal
Performing Arts | `perfarts` | ![#1A73E8](https://placehold.it/10/1A73E8?text=+)&nbsp; Blue
Clubs | `clubs` | ![#A142F4](https://placehold.it/10/A142F4?text=+)&nbsp; Purple
Special Events | `special` | ![#F538A0](https://placehold.it/10/CF2035?text=+)&nbsp; Pink
Schedule Info | `info` | ![#9AA0A6](https://placehold.it/10/9AA0A6?text=+)&nbsp; Gray
Other | `other` | ![#795548](https://placehold.it/10/795548?text=+)&nbsp; Brown

#### Example Request
```bash
curl --request GET \
  --url https://bell.dev.harker.org/api/events \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data month=8 \
  --data day=26 \
  --data year=2019
```

## `GET` /clients

Returns the number of clients currently connected to the Harker Bell websocket server.

#### Request Structure
No parameters necessary.

#### Response Structure
A number representing the number of connected clients.

#### Example Request
```bash
curl --request GET \
  --url https://bell.dev.harker.org/api/clients
```

## `GET` /clientsInternal

Returns the number of clients currently connected to the Harker Bell websocket server, represented as a number of bytes. **For internal use only.**

#### Request Structure
No parameters necessary.

#### Response Structure
A string with a length in bytes representing the number of connected clients.