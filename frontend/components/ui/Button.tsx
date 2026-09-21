"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "../../app/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "purple";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
      primary: "bg-primary hover:bg-primary-hover text-white shadow-glow border border-transparent active:scale-[0.98]",
      secondary:
        "bg-background-card hover:bg-background-hover text-text-primary border border-border hover:border-border-hover active:scale-[0.98]",
      danger: "bg-severity-critical hover:bg-red-600 text-white active:scale-[0.98]",
      ghost: "bg-transparent hover:bg-background-hover text-text-secondary hover:text-text-primary",
      purple:
        "bg-secondary hover:bg-secondary-hover text-white shadow-glow-purple border border-transparent active:scale-[0.98]",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-5 py-2.5 text-base",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={isLoading || props.disabled}
        {...(props as any)}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
