const AboutView = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
    <h1 className="font-bold text-2xl">About</h1>

    <p className="text-muted-foreground">
      RemindIt is a Progressive Web App for managing your personal shopping
      list. Add it to your home screen and it works offline — your data stays
      on your device.
    </p>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">What&rsquo;s included today</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>Organize items into categories and browse them in the catalog.</li>
        <li>
          Build your list by tapping items; tap again to remove them. Adds and
          removes are kept in your history.
        </li>
        <li>
          Smart recommendations: colored pips mark items that are overdue or due
          soon based on how often you buy them.
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">What&rsquo;s coming</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          Phase 3 — category color palettes and item attributes (photo,
          quantity, price).
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
