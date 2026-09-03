// Backfill (run via `bun run backfill:feedback`): provision Answer users for
// every existing PB user that has no `feedback_username` yet. Requires BOTH
// sidecars up (`bun run dev:bff` + `bun run dev:feedback`). Idempotent —
// rerun only processes the still-unlinked; per-user failures are logged and
// skipped so one bad record can't stall the batch.
import { answerClient } from "../src/repositories/answer"
import { forSuperuser } from "../src/repositories/pocketbase"
import { feedbackService } from "../src/services/feedback"

const pbAdmin = await forSuperuser()
// No server-side filter: hidden fields aren't filterable via the API even
// for superusers — fetch all and filter here (fine at backfill volumes).
// No sort: `users` defines no autodate stamps (sort=created 400s).
const allUsers = await pbAdmin.collection("users").getFullList()
const users = allUsers.filter((record) => !record.feedback_username)

console.log(`[feedback] backfill: ${users.length} user(s) to provision`)
let linked = 0
let failed = 0

for (const record of users) {
  try {
    const { username, outcome } = await feedbackService.ensureFeedbackUser(
      record,
      {
        client: answerClient,
      }
    )
    console.log(`[feedback] ${record.username} → ${username} (${outcome})`)
    linked += 1
  } catch (error) {
    console.error(`[feedback] ${record.username} failed:`, error)
    failed += 1
  }
}

console.log(`[feedback] backfill done: ${linked} linked, ${failed} failed`)
if (failed > 0) process.exit(1)
