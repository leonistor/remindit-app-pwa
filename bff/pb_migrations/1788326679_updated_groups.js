/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3346940990")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\" && @request.body.owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id",
    "listRule": "owner = @request.auth.id || @collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= id",
    "updateRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id || @collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3346940990")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
