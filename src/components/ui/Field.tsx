import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import "./Field.css";

interface FieldProps {
  label?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={`control ${className ?? ""}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select className={`control select ${className ?? ""}`} {...rest}>
      {children}
    </select>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  /** Disable all segments (e.g. for not-yet-wired settings). */
  disabled?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div className={`segmented ${disabled ? "disabled" : ""}`} role="tablist" aria-disabled={disabled}>
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={opt.value === value}
          className={`segment ${opt.value === value ? "active" : ""}`}
          disabled={disabled}
          onClick={() => !disabled && onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface OptionCardProps {
  title: string;
  desc: string;
  selected?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
}

export function OptionCard({
  title,
  desc,
  selected,
  icon,
  onClick,
}: OptionCardProps) {
  return (
    <button
      className={`optionCard ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {icon}
      <span className="optionCardTitle">{title}</span>
      <span className="optionCardDesc">{desc}</span>
    </button>
  );
}
