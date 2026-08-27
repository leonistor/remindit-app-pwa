import { RECOMMENDATION_TIERS } from "@/lib/recommendation-tiers"

const HelpView = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
    <h1 className="font-bold text-2xl">Help</h1>
    <p className="text-muted-foreground">
      Quick tips to get the most out of RemindIt.
    </p>

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
          Set or change your name and photo anytime in <strong>Settings</strong>{" "}
          (coming soon).
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
