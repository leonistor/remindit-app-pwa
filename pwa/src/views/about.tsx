import { Link } from "react-router"
import { BackButton } from "@/components/back-button"
import { BRAND_WEBSITE_URL } from "@remindit/common"
import { m } from "@/paraglide/messages"

const AboutView = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
    <div className="flex items-center gap-2">
      <BackButton />
      <h1 className="font-bold text-2xl">{m.aboutTitle()}</h1>
    </div>

    <p className="text-muted-foreground">
      {m.aboutChangelogPrefix()}{" "}
      <Link
        className="text-primary underline underline-offset-4 hover:opacity-90"
        to="/changelog"
      >
        {m.aboutChangelogLink()}
      </Link>
      .
    </p>

    <p className="text-muted-foreground">{m.aboutTagline()}</p>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.aboutIncludedSection()}</h2>
      <p className="text-muted-foreground text-sm">
        {m.aboutIncludedSubtitle()}
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>
          <strong>{m.aboutFeatureOnboarding()}</strong>
          {m.aboutFeatureOnboardingDesc()}
        </li>
        <li>
          <strong>{m.navProfile()}</strong>
          {m.aboutFeatureProfileDesc()}
        </li>
        <li>
          <strong>{m.aboutFeatureSync()}</strong>
          {m.aboutFeatureSyncDesc()}
        </li>
        <li>{m.aboutFeatureList()}</li>
        <li>
          <strong>{m.aboutFeatureQuickAdd()}</strong>
          {m.aboutFeatureQuickAddDesc1()} <strong>+</strong>{" "}
          {m.aboutFeatureQuickAddDesc2()} <strong>Enter</strong>{" "}
          {m.aboutFeatureQuickAddDesc3()}
        </li>
        <li>
          <strong>{m.navCatalog()}</strong>
          {m.aboutFeatureCatalogDesc1()} <strong>⋯</strong>{" "}
          {m.aboutFeatureCatalogDesc2()} <strong>{m.delete()}</strong>{" "}
          {m.aboutFeatureCatalogDesc3()} <strong>{m.catalogAddItem()}</strong>{" "}
          {m.aboutFeatureCatalogDesc4()}{" "}
          <strong>{m.catalogAddCategory()}</strong>{" "}
          {m.aboutFeatureCatalogDesc5()}{" "}
          <strong>{m.catalogUncategorized()}</strong>
          {m.aboutFeatureCatalogDesc6()}
        </li>
        <li>
          <strong>{m.aboutFeatureRecommendations()}</strong>
          {m.aboutFeatureRecommendationsDesc()}
        </li>
        <li>
          <strong>{m.navHistory()}</strong>
          {m.aboutFeatureHistoryDesc()}
        </li>
        <li>
          <strong>{m.navShare()}</strong>
          {m.aboutFeatureShareDesc1()} <strong>{m.helpCopyImage()}</strong>{" "}
          {m.aboutFeatureShareDesc2()} <strong>{m.helpDownloadPng()}</strong>{" "}
          {m.aboutFeatureShareDesc3()}
        </li>
        <li>
          <strong>{m.aboutFeaturePalettes()}</strong>
          {m.aboutFeaturePalettesDesc()}
        </li>
        <li>
          <strong>{m.aboutFeatureOrdering()}</strong>
          {m.aboutFeatureOrderingDesc1()} <strong>+</strong>
          {m.aboutFeatureOrderingDesc2()}
        </li>
        <li>
          <strong>{m.aboutFeatureTheme()}</strong>
          {m.aboutFeatureThemeDesc()}
        </li>
        <li>
          <strong>{m.aboutFeatureLanguage()}</strong>
          {m.aboutFeatureLanguageDesc()}
        </li>
        <li>
          <strong>{m.aboutFeatureInstall()}</strong>
          {m.aboutFeatureInstallDesc()}
        </li>
      </ul>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{m.aboutComingSection()}</h2>
      <p className="text-muted-foreground text-sm">{m.aboutComingSubtitle()}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">
        <li>{m.aboutComingAttributes()}</li>
        <li>{m.aboutComingNotifications()}</li>
      </ul>
    </section>

    <p className="text-muted-foreground">
      {m.aboutOpenSourcePrefix()}{" "}
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

    <p className="text-muted-foreground">
      {m.aboutWebsitePrefix()}{" "}
      <a
        className="text-primary underline underline-offset-4 hover:opacity-90"
        href={BRAND_WEBSITE_URL}
        target="_blank"
        rel="noreferrer"
      >
        www.remindit.me
      </a>
      .
    </p>
  </div>
)

export default AboutView
