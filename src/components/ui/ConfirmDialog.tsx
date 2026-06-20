import { ReactNode, useEffect, useState } from "react";
import { Button } from "./Button";
import { Icon, IconName } from "./Icon";
import "./ConfirmDialog.css";

export type ConfirmTone = "default" | "danger" | "success" | "warning";

const TONE_ICONS: Record<ConfirmTone, IconName> = {
  default: "sparkles",
  danger: "trash",
  success: "check",
  warning: "alert-triangle",
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Visual tone: controls accent colour, icon box background, and default icon. */
  tone?: ConfirmTone;
  /** Override the auto-selected icon for the tone. */
  icon?: IconName;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset internal state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false); // keep dialog open so the user sees the error
    }
  };

  const resolvedIcon = icon ?? TONE_ICONS[tone];

  return (
    <div className="confirmOverlay" onClick={() => !busy && onCancel()}>
      <div
        className="confirmDialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`confirmAccent tone-${tone}`} />

        <div className="confirmIconRow">
          <div className={`confirmIconBox tone-${tone}`}>
            <Icon name={resolvedIcon} size={22} />
          </div>
          <h2 id="confirmTitle" className="confirmTitle">{title}</h2>
        </div>

        <div className="confirmBody">
          <p className="confirmMessage">{message}</p>
          {error && <div className="confirmError">{error}</div>}
        </div>

        <div className="confirmActions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}