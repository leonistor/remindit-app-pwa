import { HammerIcon } from "@phosphor-icons/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardMedia,
  CardTitle,
} from "@/components/ui/card"

export const ComingSoon = () => (
  <Card className="mx-auto w-full max-w-sm">
    <CardMedia variant="icon">
      <HammerIcon className="size-8" aria-hidden />
    </CardMedia>
    <CardHeader>
      <CardTitle>We&rsquo;re working on this!</CardTitle>
      <CardDescription>This part of RemindIt is on its way.</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-sm">
        Check back soon &mdash; it&rsquo;ll be ready in a future update.
      </p>
    </CardContent>
  </Card>
)
