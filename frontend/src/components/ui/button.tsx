import * as React from "react"
import { cn } from "cn"
import { Slot } from "radix-ui"

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const variants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
  outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
}

const sizes: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2",
  xs: "h-6 gap-1 rounded-md px-2 text-xs",
  sm: "h-8 gap-1.5 rounded-md px-3",
  lg: "h-10 rounded-md px-6",
  icon: "size-9",
  "icon-xs": "size-6 rounded-md",
  "icon-sm": "size-8",
  "icon-lg": "size-10",
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

export { Button }
