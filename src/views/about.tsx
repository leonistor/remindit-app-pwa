import { Link } from "react-router"
import { BackButton } from "@/components/back-button"

const AboutView = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
    <div className="flex items-center gap-2">
      <BackButton />
      <h1 className="font-bold text-2xl">About</h1>
    </div>

    <p className="text-muted-foreground">
      See what&rsquo;s new in{" "}
      <Link
        className="text-primary underline underline-offset-4 hover:opacity-90"
        to="/changelog"
      >
        the changelog
      </Link>
      .
    </p>

    <p className="text-muted-foreground">
      RemindIt is a Progressive Web App for managing your personal shopping
      list. Add it to your home screen and it works offline — your data stays on
      your device.
    </p>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">What&rsquo;s included today</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          <strong>First-run onboarding</strong>: a quick 2-step setup rolls a
          random profile (avatar + handle) and lets you pick a starter catalog
          before landing on your list.
        </li>
        <li>
          <strong>Profile</strong>: manage your name and username, switch your
          starter catalog, pick a color palette, and reset or reseed your data —
          all from one place (tap your avatar in the menu).
        </li>
        <li>
          Build your list by tapping items; tap again to remove them. Your list
          is grouped by category and you can check items off as you shop.
        </li>
        <li>
          <strong>Quick add</strong>: tap the <strong>+</strong> button in the
          menu to add a new item on the fly. A grouped autocomplete suggests
          items by category and surfaces your recommendations as you type.
        </li>
        <li>
          <strong>Catalog</strong>: browse and search your items, rename them in
          place, and add or delete items and categories in collapsible sections
          sorted by how often you reach for them.
        </li>
        <li>
          <strong>Smart recommendations</strong>: colored pips mark items that
          are overdue or due soon based on how often you buy them, and learn
          from your history the more you shop.
        </li>
        <li>
          <strong>History</strong>: review your recent shopping in the History
          tab — your last 7 days of adds and removes, grouped by day, so you can
          see what you&rsquo;ve picked up and what&rsquo;s still pending.
        </li>
        <li>
          <strong>Color palettes</strong>: choose a categorical palette (Van
          Gogh is the default) with a live preview; it colors categories and
          items consistently across the app.
        </li>
        <li>
          <strong>Ordering controls</strong>: a floating sort button cycles your
          list between category/name, most-recently-added, and alphabetical
          (A–Z) — your choice is remembered.
        </li>
        <li>
          <strong>Theme</strong>: pick dark, light, or system and your
          preference is saved.
        </li>
        <li>
          <strong>Install as an app</strong>: add Remindit to your home screen
          and use it offline like a native app, with an in-app changelog to
          track what&rsquo;s new.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">What&rsquo;s coming</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Item attributes (photo, quantity, price) — the remaining piece of
          Phase 3.
        </li>
        <li>Phase 4 — multi-user lists with real-time sync across devices.</li>
      </ul>
    </section>

    <p className="text-muted-foreground">
      RemindIt is open source. View the code and follow development on{" "}
      <a
        className="text-primary underline underline-offset-4 hover:opacity-90"
        href="https://github.com/leonistor/remindit-app-pwa/"
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
      .
    </p>
  </div>
)

export default AboutView
