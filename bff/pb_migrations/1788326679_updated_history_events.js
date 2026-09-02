/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2816699950")

  // update collection data
  unmarshal({
    "createRule": "group.owner = @request.auth.id || @collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= @request.body.group",
    "listRule": "group.owner = @request.auth.id || @collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= group",
    "viewRule": "group.owner = @request.auth.id || @collection.group_members.user ?= @request.auth.id && @collection.group_members.group ?= group"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2816699950")

  // update collection data
  unmarshal({
    "createRule": null,
    "listRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
