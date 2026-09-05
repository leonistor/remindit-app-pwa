// Builds and validates common/seeds/platform.json (dev tool, not part of the
// typed package surface). Kept as a tiny script so the dataset stays reviewable
// JSON while correctness (valid JSON, valid frequencies) is machine-checked.
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

const acts = ["daily", "every-2-3-days", "weekly", "every-2-weeks", "monthly", "every-3-months", "seldom"]

const users = [
  { username: "admin", email: "admin@example.com", firstName: "Alex", lastName: "Maran", role: "admin" },
  { username: "mira", email: "mira@example.com", firstName: "Mira", lastName: "Velche", role: "admin" },
  { username: "anamaria", email: "anamaria@example.com", firstName: "Ana-Maria", lastName: "Popescu" },
  { username: "florin", email: "florin@example.com", firstName: "Florin", lastName: "Popescu" },
  { username: "teo", email: "teo@example.com", firstName: "Teodora", lastName: "Popescu" },
  { username: "sami", email: "sami@example.com", firstName: "Samuel", lastName: "Popescu" },
  { username: "ioana", email: "ioana@example.com", firstName: "Ioana", lastName: "Ionescu" },
  { username: "costel", email: "costel@example.com", firstName: "Costel", lastName: "Ionescu" },
  { username: "ana", email: "ana@example.com", firstName: "Ana", lastName: "Ionescu" },
  { username: "catalin", email: "catalin@example.com", firstName: "Catalin", lastName: "Nistor" },
  { username: "bogdan", email: "bogdan@example.com", firstName: "Bogdan", lastName: "Stan" },
  { username: "diana", email: "diana@example.com", firstName: "Diana", lastName: "Pop" },
  { username: "irina", email: "irina@example.com", firstName: "Irina", lastName: "Marin" },
  { username: "andrei", email: "andrei@example.com", firstName: "Andrei", lastName: "Vasile" },
  { username: "george", email: "george@example.com", firstName: "George", lastName: "Preda" },
]

const team = (name, owner, members, categories, items, list, history) => ({
  name,
  owner,
  members,
  categories: categories.map(([name7, frequency]) => ({ name: name7, frequency })),
  items: items.map(([name2, category]) => ({ name: name2, category })),
  list,
  history,
})

const teams = [
  team(
    "The Popescu household",
    "anamaria",
    ["florin", "teo", "sami"],
    [
      ["frigider", "weekly"],
      ["gătit", "weekly"],
      ["cămară", "monthly"],
      ["curățenie", "every-3-months"],
      ["bufet", "every-2-weeks"],
      ["casnice", "monthly"],
    ],
    [
      ["Ouă", "frigider"], ["Lapte", "frigider"], ["Iaurt", "frigider"], ["Telemea", "frigider"],
      ["Roșii", "frigider"], ["Cartofi", "gătit"], ["Pui", "gătit"], ["Ceapă", "gătit"],
      ["Pâine", "cămară"], ["Orez", "cămară"], ["Ulei", "cămară"], ["Detergent", "curățenie"],
      ["Cafea", "bufet"], ["Ciocolată", "bufet"], ["Hârtie igienică", "casnice"], ["Săpun de mâini", "casnice"],
    ],
    ["Ouă", "Lapte", "Pâine", "Detergent"],
    { days: 180, seed: 11 },
  ),
  team(
    "The Ionescu family",
    "ioana",
    ["costel", "ana"],
    [
      ["fridge", "weekly"],
      ["pantry", "monthly"],
      ["cooking", "weekly"],
      ["snacks", "every-2-weeks"],
      ["household", "monthly"],
      ["cleaning", "every-3-months"],
    ],
    [
      ["Milk", "fridge"], ["Yogurt", "fridge"], ["Eggs", "fridge"], ["Butter", "fridge"], ["Cheese", "fridge"],
      ["Rice", "pantry"], ["Pasta", "pantry"], ["Canned tomatoes", "pantry"], ["Bread", "pantry"],
      ["Olive oil", "cooking"], ["Onions", "cooking"], ["Chicken", "cooking"],
      ["Chocolate", "snacks"], ["Cereal", "snacks"],
      ["Toilet paper", "household"], ["Dish soap", "household"], ["Detergent", "cleaning"],
    ],
    ["Milk", "Bread", "Cereal"],
    { days: 180, seed: 23 },
  ),
  team(
    "Trip to Italy",
    "catalin",
    ["bogdan", "diana", "irina", "andrei"],
    [
      ["trip-snacks", "weekly"],
      ["trip-drinks", "weekly"],
      ["essentials", "every-2-3-days"],
      ["souvenirs", "seldom"],
    ],
    [
      ["Chips", "trip-snacks"], ["Pretzels", "trip-snacks"], ["Chocolate", "trip-snacks"], ["Biscuits", "trip-snacks"],
      ["Still water", "trip-drinks"], ["Sparkling water", "trip-drinks"], ["Juice", "trip-drinks"], ["Beer", "trip-drinks"],
      ["Sunscreen", "essentials"], ["Power bank", "essentials"], ["Plug adapter", "essentials"],
      ["Postcards", "souvenirs"],
    ],
    ["Chips", "Still water", "Sunscreen"],
    { days: 14, seed: 31 },
  ),
  team(
    "Weekend at the cabin",
    "catalin",
    ["irina", "andrei"],
    [
      ["grill", "weekly"],
      ["firewood", "every-3-months"],
      ["cabin-snacks", "weekly"],
      ["cabin-drinks", "every-2-weeks"],
      ["camping", "monthly"],
    ],
    [
      ["Charcoal", "grill"], ["Sausages", "grill"], ["Buns", "grill"],
      ["Logs", "firewood"], ["Firelighters", "firewood"],
      ["Marshmallows", "cabin-snacks"], ["Chips", "cabin-snacks"],
      ["Beer", "cabin-drinks"], ["Wine", "cabin-drinks"],
      ["First-aid kit", "camping"], ["Flashlight", "camping"],
    ],
    ["Charcoal", "Sausages", "Beer"],
    { days: 45, seed: 37 },
  ),
  team(
    "Diana's list",
    "diana",
    [],
    [
      ["instant-food", "weekly"],
      ["fridge", "weekly"],
      ["study", "every-2-weeks"],
      ["pantry", "monthly"],
    ],
    [
      ["Instant ramen", "instant-food"], ["Instant noodles", "instant-food"], ["Frozen pizza", "instant-food"],
      ["Milk", "fridge"], ["Yogurt", "fridge"], ["Cheddar", "fridge"],
      ["Coffee", "study"], ["Energy drink", "study"], ["Notebooks", "study"],
      ["Bread", "pantry"], ["Pasta", "pantry"],
    ],
    ["Instant ramen", "Coffee"],
    { days: 120, seed: 41 },
  ),
  team(
    "Bogdan's list",
    "bogdan",
    [],
    [
      ["gym", "every-2-3-days"],
      ["fridge", "weekly"],
      ["pantry", "monthly"],
      ["snacks", "every-2-weeks"],
    ],
    [
      ["Protein bars", "gym"], ["Oatmeal", "gym"], ["Bananas", "gym"], ["Peanut butter", "gym"],
      ["Milk", "fridge"], ["Eggs", "fridge"], ["Greek yogurt", "fridge"],
      ["Rice", "pantry"], ["Pasta", "pantry"], ["Bread", "pantry"],
      ["Mixed nuts", "snacks"], ["Dark chocolate", "snacks"],
    ],
    ["Protein bars", "Bananas"],
    { days: 180, seed: 43 },
  ),
  team(
    "George's list",
    "george",
    [],
    [
      ["daily", "every-2-3-days"],
      ["tea", "monthly"],
      ["household", "monthly"],
      ["seldom", "every-3-months"],
    ],
    [
      ["Bread", "daily"], ["Milk", "daily"], ["Eggs", "daily"], ["Butter", "daily"],
      ["Black tea", "tea"], ["Honey", "tea"], ["Sugar", "tea"],
      ["Laundry soap", "household"], ["Dish soap", "household"],
      ["Light bulbs", "seldom"], ["Broom", "seldom"],
    ],
    ["Bread", "Honey"],
    { days: 180, seed: 47 },
  ),
]

// --- validation: every referenced username/category/frequency/list item exists
const usernames = new Set(users.map((u) => u.username))
for (const t of teams) {
  if (!usernames.has(t.owner)) throw new Error(`team "${t.name}": unknown owner "${t.owner}"`)
  for (const m of t.members) {
    if (!usernames.has(m)) throw new Error(`team "${t.name}": unknown member "${m}"`)
    if (m === t.owner) throw new Error(`team "${t.name}": member "${m}" is also the owner`)
  }
  const cats = new Set(t.categories.map((c) => c.name))
  if (!cats.has("uncategorized")) cats.add("uncategorized")
  const items = new Map(t.items.map((i) => [i.name, i.category]))
  for (const [itemName, cat] of items) {
    if (!cats.has(cat)) throw new Error(`team "${t.name}": item "${itemName}" → unknown category "${cat}"`)
  }
  for (const c of t.categories) {
    if (!acts.includes(c.frequency)) throw new Error(`team "${t.name}": bad frequency "${c.frequency}"`)
  }
  for (const l of t.list) {
    if (!items.has(l)) throw new Error(`team "${t.name}": list item "${l}" not in items`)
  }
}

// The password is intentionally absent from the dataset — it is supplied at
// seed time from `SEED_PASSWORD` (`bff/src/env.ts`), keeping this reviewable
// file free of credential-shaped strings.
const out = { users, teams }
const file = resolve(import.meta.dir, "..", "seeds", "platform.json")
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`)
console.log(`wrote ${file} (${users.length} users, ${teams.length} teams)`)