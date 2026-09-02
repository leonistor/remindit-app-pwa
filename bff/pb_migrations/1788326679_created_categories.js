/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1579384326",
        "max": 120,
        "min": 1,
        "name": "name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select645904403",
        "maxSelect": 1,
        "name": "frequency",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "daily",
          "every-2-3-days",
          "weekly",
          "every-2-weeks",
          "monthly",
          "every-3-months",
          "seldom",
          "unknown"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "number1716930793",
        "max": 64,
        "min": 0,
        "name": "color",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_3346940990",
        "help": "",
        "hidden": false,
        "id": "relation1841317061",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "group",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_3292755704",
    "indexes": [],
    "listRule": null,
    "name": "categories",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3292755704");

  return app.delete(collection);
})
