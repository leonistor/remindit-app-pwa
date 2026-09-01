import { HammerIcon } from "@phosphor-icons/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardMedia,
  CardTitle,
} from "@/components/ui/card"
import { m } from "@/paraglide/messages"

export const ComingSoon = () => (
  <Card className="mx-auto w-full max-w-sm">
    <CardMedia variant="icon">
      <HammerIcon className="size-8" aria-hidden />
    </CardMedia>
    <CardHeader>
      <CardTitle>{m.comingSoonTitle()}</CardTitle>
      <CardDescription>{m.comingSoonDescription()}</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-sm">{m.comingSoonHint()}</p>
    </CardContent>
  </Card>
)
