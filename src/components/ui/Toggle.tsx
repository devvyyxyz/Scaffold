// iOS-style toggle switch.
//
// A binary on/off control rendered as a sliding pill. Used across the
// Settings screen wherever a preference is a simple boolean.

import "./Toggle.css";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible label for screen readers. */
  label?: string;
}

export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "on" : ""} ${disabled ? "disabled" : ""}`}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="toggleKnob" />
    </button>
  );
}
