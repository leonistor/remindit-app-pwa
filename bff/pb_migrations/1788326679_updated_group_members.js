/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_714390402")

  // update collection data
  unmarshal({
    "createRule": "group.owner = @request.auth.id",
    "deleteRule": "group.owner = @request.auth.id || user = @request.auth.id",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_group_members_unique` ON `group_members` (`group`, `user`)"
    ],
    "listRule": "user = @request.auth.id || group.owner = @request.auth.id",
    "viewRule": "user = @request.auth.id || group.owner = @request.auth.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_714390402")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "indexes": [],
    "listRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
