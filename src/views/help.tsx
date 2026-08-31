import { Link } from "react-router"
import { BackButton } from "@/components/back-button"
import { DemoVideo } from "@/components/demo-video"
import { RECOMMENDATION_TIERS } from "@/lib/recommendation-tiers"

const HelpView = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
    <div className="flex items-center gap-2">
      <BackButton />
      <h1 className="font-bold text-2xl">Help</h1>
    </div>
    <p className="text-muted-foreground">
      Quick tips to get the most out of RemindIt.
    </p>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Get started</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          First-run setup walks you through rolling a profile and picking a
          starter catalog — the video shows the whole flow.
        </li>
        <li>
          Your user avatar sits in the menu and links straight to your{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            Profile
          </Link>{" "}
          (the round logo still takes you home).
        </li>
      </ul>
      <DemoVideo
        aria-label="Demo: first-run setup with profile and starter catalog"
        scenario="01-onboarding"
      />
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Build your list</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Tap a catalog item to add it to your list; tap it again to remove it.
        </li>
        <li>
          Use the floating sort button in the top-right of your list (next to{" "}
          <strong>+</strong>) to cycle between category, most-recent, and
          alphabetical (A–Z) order — your choice is remembered.
        </li>
        <li>
          Tap <strong>+</strong> for quick add: suggestions grouped by category
          with your recommendations surfaced as pips. Category pills create the
          item and close immediately; press <strong>Enter</strong> to create
          under the selected pill (at least 3 letters).
        </li>
      </ul>
      <DemoVideo
        aria-label="Demo: adding items to the list from the catalog"
        scenario="03-add-items"
      />
      <DemoVideo
        aria-label="Demo: quick add with suggestions and category pills"
        scenario="04-quick-add"
      />
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Catalog</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Open <strong>Catalog</strong> from the menu to manage items and
          categories — collapsible categories sorted by how often you reach for
          them, with items alphabetically sorted (A–Z) inside.
        </li>
        <li>
          Rename by double-click (desktop) or tap (mobile); the{" "}
          <strong>⋯</strong> menu edits or deletes, and swiping an item left
          reveals <strong>Delete</strong> — all confirmed in dialogs.
        </li>
        <li>
          Deleting a category moves its items to <strong>Uncategorized</strong>.
          Deleting an item also removes it from your list.
        </li>
      </ul>
      <DemoVideo
        aria-label="Demo: renaming and deleting in the catalog"
        scenario="06-edit-catalog"
      />
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Personalize</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Change your name, username, and categorical{" "}
          <strong>color palette</strong> (with a live preview) from{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            Profile
          </Link>
          .
        </li>
        <li>
          Switch or reseed your catalog from{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            Profile
          </Link>{" "}
          too.
        </li>
      </ul>
      <DemoVideo
        aria-label="Demo: switching the theme from the menu"
        scenario="05-theme"
      />
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Recommendations</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          <span
            aria-hidden
            className={`mr-1 inline-block size-2 -translate-y-px rounded-full ${RECOMMENDATION_TIERS.overdue.dotColor} align-middle`}
          />
          A <strong>red</strong> pip means an item is <strong>overdue</strong> —
          past when you&rsquo;d normally buy it.
        </li>
        <li>
          <span
            aria-hidden
            className={`mr-1 inline-block size-2 -translate-y-px rounded-full ${RECOMMENDATION_TIERS.soon.dotColor} align-middle`}
          />
          An <strong>amber</strong> pip means it&rsquo;s{" "}
          <strong>due soon</strong>. Tap the info icon in the catalog title for
          the full legend.
        </li>
        <li>
          RemindIt learns your shopping rhythm by remembering when you add each
          item — suggestions grow more confident the more you shop, and it stays
          quiet about things you rarely buy or already have on your list.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">History</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          The <strong>History</strong> tab shows your recent activity — every
          add and remove — grouped by day and limited to the last 7 days.
        </li>
        <li>
          The category label on each row is a snapshot taken when the event
          happened, so renaming a category later doesn&rsquo;t rewrite it.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Share</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Open <strong>Share</strong> from the menu to preview your list as a
          card image — today&rsquo;s date and the items still on it, grouped by
          category with their colors.
        </li>
        <li>
          <strong>Copy image</strong> puts the card on your clipboard (where
          your browser supports it) and <strong>Download PNG</strong> saves a
          file — send it to whoever&rsquo;s shopping with you.
        </li>
        <li>
          Checked-off items never make it onto the card, and the image always
          uses light colors so it reads well in any chat — even in dark mode.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Your data</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Everything is saved locally in your browser. No account, and nothing
          is uploaded yet.
        </li>
        <li>
          First setup seeds a starter catalog plus a simulated shopping history,
          so recommendations work right away.
        </li>
        <li>
          Reset or reseed anytime from{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            Profile
          </Link>{" "}
          — your profile and theme preference are kept.
        </li>
      </ul>
    </section>

    <p className="text-muted-foreground">
      Questions or ideas? Open an issue on{" "}
      <a
        className="text-primary underline underline-offset-4 hover:opacity-90"
        href="https://github.com/leonistor/remindit-app-pwa/"
        rel="noreferrer"
        target="_blank"
      >
        GitHub
      </a>
      .
    </p>
  </div>
)

export default HelpView
