import { Link } from "react-router"
import { RECOMMENDATION_TIERS } from "@/lib/recommendation-tiers"

const HelpView = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
    <h1 className="font-bold text-2xl">Help</h1>
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
          the cart.
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
      <h2 className="font-semibold text-lg">Understand recommendations</h2>
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
