import { Link } from "react-router"
import { BackButton } from "@/components/back-button"
import { DemoVideo } from "@/components/demo-video"
import { RECOMMENDATION_TIERS } from "@/lib/recommendation-tiers"
import { m } from "@/paraglide/messages"

const HelpView = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
    <div className="flex items-center gap-2">
      <BackButton />
      <h1 className="font-bold text-2xl">{m.helpTitle()}</h1>
    </div>
    <p className="text-muted-foreground">{m.helpIntro()}</p>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.helpGetStartedSection()}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>{m.helpGetStartedSetup()}</li>
        <li>
          {m.helpGetStartedAvatarPrefix()}{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            {m.navProfile()}
          </Link>{" "}
          {m.helpGetStartedAvatarSuffix()}
        </li>
      </ul>
      <DemoVideo
        aria-label={m.helpVideoOnboarding()}
        scenario="01-onboarding"
      />
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.helpBuildListSection()}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>{m.helpBuildListTapItem()}</li>
        <li>
          {m.helpBuildListSortPrefix()} <strong>+</strong>
          {m.helpBuildListSortSuffix()}
        </li>
        <li>
          {m.helpQuickAddTapPrefix()} <strong>+</strong>{" "}
          {m.helpQuickAddTapMiddle()} <strong>Enter</strong>{" "}
          {m.helpQuickAddTapSuffix()}
        </li>
      </ul>
      <DemoVideo aria-label={m.helpVideoAddItems()} scenario="03-add-items" />
      <DemoVideo aria-label={m.helpVideoQuickAdd()} scenario="04-quick-add" />
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.helpCatalogSection()}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          {m.helpCatalogOpenPrefix()} <strong>{m.navCatalog()}</strong>{" "}
          {m.helpCatalogOpenSuffix()}
        </li>
        <li>
          {m.helpCatalogRenamePrefix()} <strong>⋯</strong>{" "}
          {m.helpCatalogRenameMiddle()} <strong>{m.delete()}</strong>{" "}
          {m.helpCatalogRenameSuffix()}
        </li>
        <li>
          {m.helpCatalogDeleteCategoryPrefix()}{" "}
          <strong>{m.catalogUncategorized()}</strong>.{" "}
          {m.helpCatalogDeleteItem()}
        </li>
      </ul>
      <DemoVideo
        aria-label={m.helpVideoEditCatalog()}
        scenario="06-edit-catalog"
      />
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.helpPersonalizeSection()}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          {m.helpPersonalizeAppearancePrefix()}{" "}
          <strong>{m.helpColorPalette()}</strong>{" "}
          {m.helpPersonalizeAppearanceMiddle()}{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            {m.navProfile()}
          </Link>
          .
        </li>
        <li>
          {m.helpPersonalizeReseedPrefix()}{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            {m.navProfile()}
          </Link>{" "}
          {m.helpPersonalizeReseedSuffix()}
        </li>
        <li>
          {m.helpPersonalizeLanguagePrefix()}{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            {m.navProfile()}
          </Link>{" "}
          {m.helpPersonalizeLanguageSuffix()}
        </li>
      </ul>
      <DemoVideo aria-label={m.helpVideoTheme()} scenario="05-theme" />
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">
        {m.helpRecommendationsSection()}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          <span
            aria-hidden
            className={`mr-1 inline-block size-2 -translate-y-px rounded-full ${RECOMMENDATION_TIERS.overdue.dotColor} align-middle`}
          />
          {m.helpRecOverduePrefix()} <strong>{m.helpRed()}</strong>{" "}
          {m.helpRecOverdueMiddle()} <strong>{m.helpOverdue()}</strong>{" "}
          {m.helpRecOverdueSuffix()}
        </li>
        <li>
          <span
            aria-hidden
            className={`mr-1 inline-block size-2 -translate-y-px rounded-full ${RECOMMENDATION_TIERS.soon.dotColor} align-middle`}
          />
          {m.helpRecSoonPrefix()} <strong>{m.helpAmber()}</strong>{" "}
          {m.helpRecSoonMiddle()} <strong>{m.helpDueSoon()}</strong>.
        </li>
        <li>{m.helpRecCount()}</li>
        <li>{m.helpRecLearning()}</li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.helpHistorySection()}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          {m.helpHistoryTabPrefix()} <strong>{m.navHistory()}</strong>{" "}
          {m.helpHistoryTabSuffix()}
        </li>
        <li>{m.helpHistorySnapshot()}</li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.helpShareSection()}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          {m.helpShareOpenPrefix()} <strong>{m.navShare()}</strong>{" "}
          {m.helpShareOpenSuffix()}
        </li>
        <li>
          <strong>{m.helpCopyImage()}</strong> {m.helpShareCopyMiddle()}{" "}
          <strong>{m.helpDownloadPng()}</strong> {m.helpShareCopySuffix()}
        </li>
        <li>{m.helpShareCheckedOff()}</li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.helpSyncSection()}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          {m.helpSyncWherePrefix()}{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            {m.navProfile()}
          </Link>
          {m.helpSyncWhereMiddle()} <strong>{m.syncTitle()}</strong>{" "}
          {m.helpSyncWhereSuffix()}
        </li>
        <li>{m.helpSyncWhat()}</li>
        <li>{m.helpSyncOffline()}</li>
        <li>{m.helpSyncShared()}</li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.helpYourDataSection()}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>{m.helpDataLocal()}</li>
        <li>{m.helpDataSeed()}</li>
        <li>{m.helpDataBackup()}</li>
        <li>
          {m.helpDataResetPrefix()}{" "}
          <Link
            className="text-primary underline underline-offset-4 hover:opacity-90"
            to="/profile"
          >
            {m.navProfile()}
          </Link>{" "}
          {m.helpDataResetSuffix()}
        </li>
      </ul>
    </section>
  </div>
)

export default HelpView
