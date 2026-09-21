"use client";

import * as React from "react";
import { cn } from "../../app/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: "primary" | "secondary" | "none";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glowColor = "none", children, ...props }, ref) => {
    const glowClasses = {
      primary: "hover:border-primary/30 hover:shadow-glow",
      secondary: "hover:border-secondary/30 hover:shadow-glow-purple",
      none: "",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "bg-background-card border border-border rounded-lg p-6 shadow-sm transition-all duration-200",
          glowClasses[glowColor],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
