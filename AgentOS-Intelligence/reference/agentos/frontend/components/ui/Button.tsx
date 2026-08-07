import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "ui-btn ui-btn-primary text-white bg-gradient-to-r from-violet-600 to-indigo-600 shadow-[0_8px_30px_rgba(124,58,237,0.25)] hover:shadow-[0_10px_38px_rgba(124,58,237,0.4)]",
  secondary: "ui-btn ui-btn-secondary bg-[#0e1016] text-[#d6d8df] border border-[#292d38]",
  outline: "ui-btn ui-btn-outline border border-[#292d38] text-[#d6d8df] bg-transparent",
  ghost: "ui-btn ui-btn-ghost text-[#9aa3b2] hover:bg-white/5 hover:text-white",
  danger: "ui-btn ui-btn-danger bg-[#2a1111] text-[#f87171] border border-[#7f1d1d]",
  success: "ui-btn ui-btn-success bg-[#0b1912] text-[#4ade80] border border-[#1c4b33]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px] gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[13px] gap-2 rounded-lg",
  lg: "h-12 px-7 text-[14px] gap-2.5 rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
