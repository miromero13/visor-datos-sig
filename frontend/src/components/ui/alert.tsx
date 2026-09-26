import * as React from "react"
import { cn } from "cn"

type AlertVariant = "default" | "destructive"
type AlertProps = React.ComponentProps<"div"> & { variant?: AlertVariant }

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return <div data-slot="alert" role="alert" data-variant={variant} className={cn("relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm", variant === "destructive" ? "bg-card text-destructive" : "bg-card text-card-foreground", className)} {...props} />
}
