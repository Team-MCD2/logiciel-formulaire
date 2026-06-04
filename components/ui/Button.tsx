import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/10 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          variant === "primary" &&
            "bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 shadow-sm",
          variant === "secondary" &&
            "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-950",
          variant === "danger" &&
            "bg-red-600 text-white hover:bg-red-500 border border-red-600 shadow-sm",
          variant === "ghost" &&
            "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
