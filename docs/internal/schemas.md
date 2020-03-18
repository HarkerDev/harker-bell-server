# Database Schemas

This page contains database schemas used for data stored in MongoDB.

::: warning Note
This page is meant for internal use only.
:::

### Collection `harker-bell/schedules`
```js
{
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'date',
      'schedule',
      'lunch',
      'events'
    ],
    properties: {
      _id: {
        bsonType: 'objectId'
      },
      date: {
        bsonType: 'date',
        description: 'unique UTC date for the schedule'
      },
      schedule: {
        bsonType: 'array',
        description: 'array of period objects in ascending time order, or empty array if holiday',
        items: {
          bsonType: 'object',
          required: [
            'name',
            'start',
            'end'
          ],
          properties: {
            name: {
              bsonType: 'string',
              description: 'name of the period (like P1 or P2)'
            },
            start: {
              bsonType: 'date',
              description: 'starting time of the period'
            },
            end: {
              bsonType: 'date',
              description: 'ending time of the period'
            }
          },
          additionalProperties: false
        },
        additionalItems: false
      },
      lunch: {
        bsonType: 'array',
        description: 'list of lunch locations and menu items',
        items: {
          bsonType: 'object',
          required: [
            'place',
            'food'
          ],
          properties: {
            place: {
              bsonType: 'string',
              description: 'where the food is being served'
            },
            food: {
              bsonType: 'string',
              description: 'name of the food hopefully being served'
            }
          },
          additionalProperties: false
        },
        additionalItems: false
      },
      events: {
        bsonType: 'array',
        description: 'list of event times and their descriptions',
        items: {
          bsonType: 'object',
          required: [
            'name',
            'start',
            'end',
            'category'
          ],
          properties: {
            name: {
              bsonType: 'string',
              description: 'name and description of the event'
            },
            start: {
              bsonType: 'date',
              description: 'starting time of the event'
            },
            end: {
              bsonType: 'date',
              description: 'ending time of the event'
            },
            category: {
              bsonType: 'string',
              description: 'category of the event, used for color-coding'
            }
          },
          additionalProperties: false
        },
        additionalItems: false
      },
      preset: {
        bsonType: 'string',
        description: 'name of the schedule preset if applicable'
      },
      code: {
        bsonType: 'string',
        description: 'schedule type code used for display (like A, B, C, or D)'
      },
      variant: {
        bsonType: 'string',
        description: 'type of schedule variation, if it exists (like adjusted or special)'
      },
      name: {
        bsonType: 'string',
        description: 'name of the holiday, break, or special event if there is no schedule'
      }
    },
    additionalProperties: false
  }
}
```

### Collection `harker-bell/presets`
```js
{
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'preset',
      'code',
      'schedule'
    ],
    properties: {
      _id: {
        bsonType: 'objectId'
      },
      schedule: {
        bsonType: 'array',
        description: 'array of period objects in ascending time order',
        items: {
          bsonType: 'object',
          required: [
            'name'
          ],
          properties: {
            name: {
              bsonType: 'string',
              description: 'name of the period (like P1 or P2)'
            },
            start: {
              bsonType: 'string',
              description: 'starting time of the period if applicable, formatted as the time part of an ISO string'
            },
            end: {
              bsonType: 'string',
              description: 'ending time of the period if applicable, formatted as the time part of an ISO string'
            }
          },
          additionalProperties: false
        }
      },
      preset: {
        bsonType: 'string',
        description: 'identifier for this schedule preset'
      },
      code: {
        bsonType: 'string',
        description: 'schedule type code used for display (like A, B, C, or D)'
      },
      variant: {
        bsonType: 'string',
        description: 'schedule type code used for display (like A, B, C, or D)'
      }
    },
    additionalProperties: false
  }
}
```

### Collection `harker-bell/revisions`
```js
{
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'timestamp',
      'changes',
      'name'
    ],
    properties: {
      _id: {
        bsonType: 'objectId'
      },
      timestamp: {
        bsonType: 'date',
        description: 'the time when this revision was created'
      },
      changes: {
        bsonType: 'array',
        description: 'array of dates corresponding to each schedule that was modified in this revision',
        uniqueItems: true,
        items: {
          bsonType: 'date'
        },
        additionalItems: false
      },
      documents: {
        bsonType: 'array',
        description: 'array of documents that were changed, containing the updated schedules',
        items: {
          bsonType: 'object'
        },
        additionalItems: false
      },
      name: {
        bsonType: 'string',
        description: 'name of the user who authored this revision'
      }
    },
    additionalProperties: false
  }
}
```

### Collection `harker-bell/users`
```js
{
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'access_token',
      'name',
      'permissions'
    ],
    properties: {
      _id: {
        bsonType: 'objectId'
      },
      access_token: {
        bsonType: 'string',
        description: 'secure access token unique to this user',
        minLength: 12
      },
      name: {
        bsonType: 'string',
        description: 'name or identifier for this user'
      },
      permissions: {
        bsonType: 'array',
        description: 'array of permission strings',
        uniqueItems: true,
        items: {
          'enum': [
            'read',
            'singleWrite',
            'bulkWrite',
            'editMessage',
            'special'
          ]
        }
      }
    },
    additionalProperties: false
  }
}
```

### Collection `harker-bell/misc`
No schema.