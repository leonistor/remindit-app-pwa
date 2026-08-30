import { Link } from "react-router"
import { BackButton } from "@/components/back-button"
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
          The first time you open RemindIt you&rsquo;re walked through a quick
          setup: a random profile is rolled for you (roll again for a different
          one) and you pick a starter catalog before landing on your list.
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
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Build your list</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          The screen is split vertically: your <strong>current list</strong> is
          on top, and the <strong>All items</strong> catalog sits below it.
        </li>
        <li>
          Tap any item in the catalog to add it to your list; tap it again to
          remove it.
        </li>
        <li>
          Your list is grouped by category. Check items off as you put them in
          the cart. Use the floating sort button in the top-right of your list
          (next to <strong>+</strong>) to cycle between category, most-recent,
          and alphabetical (A–Z) order — your choice is remembered and items
          within each Catalog category are themselves alphabetically sorted.
        </li>
        <li>
          Need something that isn&rsquo;t in the catalog yet? Tap{" "}
          <strong>+</strong> in the floating row at the top of your list to open
          quick add — a grouped autocomplete suggests items by category and
          surfaces your recommendations as you type. When creating a new item,
          category pills appear below the results: tap a pill to create the item
          in that category immediately, or press <strong>Enter</strong> to
          create with the selected pill (at least 3 letters).
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Catalog</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Open <strong>Catalog</strong> from the menu to manage every item and
          category — categories are collapsible sections sorted by how often you
          reach for them, with items alphabetically sorted (A–Z) inside each.
        </li>
        <li>
          A contextual legend at the top explains the affordances: double-click
          (desktop) or tap (mobile) a category or item name to rename via
          dialog, use the <strong>⋯</strong> menu to edit or delete a category,
          and swipe an item left on mobile to reveal <strong>Delete</strong>{" "}
          (confirmed in a dialog). You can also press <strong>Enter</strong>{" "}
          while focused to edit via keyboard.
        </li>
        <li>
          Both <strong>Add item</strong> and <strong>Add category</strong> are
          outline buttons in the Catalog header. Deleting a category moves its
          items to <strong>Uncategorized</strong>; deleting an item also removes
          it from your shopping list. Both actions ask for confirmation.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Personalize</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Change your name and username anytime from{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            Profile
          </Link>
          .
        </li>
        <li>
          Choose your categorical <strong>color palette</strong> in Profile — a
          live preview shows each palette&rsquo;s colors and your pick applies
          everywhere.
        </li>
        <li>
          Switch or reseed your catalog from Profile. Avatar editing is coming
          later.
        </li>
      </ul>
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
          Recommendations learn from your history, so they improve the more you
          shop.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">How recommendations work</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          RemindIt learns your shopping rhythm by remembering when you add each
          item, then estimates how often you usually buy it.
        </li>
        <li>
          It nudges you when something is due based on that rhythm — the
          suggestions grow more confident the more you shop, and it stays quiet
          about things you rarely buy or already have on your list.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">History</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          The <strong>History</strong> tab shows your recent shopping activity —
          every add and remove — grouped by day and limited to the last 7 days,
          so you can quickly see what you&rsquo;ve already picked up.
        </li>
        <li>
          The category label on each row is a snapshot taken when the event
          happened, so it stays accurate even if you rename a category later.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">About your sample data</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          On first setup RemindIt seeds your list with a starter catalog and a
          simulated shopping history spanning a few months, so recommendations
          start working right away instead of waiting for you to build up real
          history.
        </li>
        <li>
          That sample history is generated realistically: each item reappears at
          roughly its category&rsquo;s frequency with natural variation, giving
          a believable mix of overdue, due-soon, and frequent items.
        </li>
        <li>
          It&rsquo;s just local sample data. Reset or reseed anytime from{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            Profile
          </Link>{" "}
          to swap the catalog or generate a fresh simulated history — your
          profile and theme preference are kept.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">Your data</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Everything is saved locally in your browser. No account and nothing is
          uploaded yet.
        </li>
        <li>
          Reset or reseed all your local data from{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            Profile
          </Link>
          — your profile and theme preference are kept.
        </li>
      </ul>
    </section>

    <p className="text-muted-foreground">
      Questions or ideas? Open an issue on{" "}
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

export default HelpView
