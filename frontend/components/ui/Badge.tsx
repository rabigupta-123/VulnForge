import * as React from "react";
import { cn } from "../../app/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "critical" | "high" | "medium" | "low" | "info" | "success" | "warning" | "default";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  children,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border select-none";

  const variants = {
    critical: "bg-red-500/10 text-severity-critical border-red-500/20",
    high: "bg-orange-500/10 text-severity-high border-orange-500/20",
    medium: "bg-yellow-500/10 text-severity-medium border-yellow-500/20",
    low: "bg-blue-500/10 text-severity-low border-blue-500/20",
    info: "bg-zinc-500/10 text-severity-info border-zinc-500/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    default: "bg-background-hover text-text-secondary border-border",
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </span>
  );
};
