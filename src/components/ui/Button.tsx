import { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, IconName } from "./Icon";
import "./Button.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  block,
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = [
    "button",
    variant,
    size === "sm" ? "sm" : "",
    !children && icon ? "icon-only" : "",
    block ? "block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 16} />}
    </button>
  );
}
