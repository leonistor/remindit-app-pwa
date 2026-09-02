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
        "help": "",
        "hidden": false,
        "id": "bool2902702723",
        "name": "checked",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2992024386",
        "max": 0,
        "min": 0,
        "name": "addedAt",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_710432678",
        "help": "",
        "hidden": false,
        "id": "relation521872670",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "item",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
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
    "id": "pbc_2788109006",
    "indexes": [],
    "listRule": null,
    "name": "list_entries",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2788109006");

  return app.delete(collection);
})
