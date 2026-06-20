import { useEffect, useMemo } from "react";
import { DEFAULT_KEYBOARD_SHORTCUTS, KeyboardShortcut } from "../lib/types";
import { Icon } from "./ui/Icon";
import "../screens/SettingsKeyboard.css";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_ORDER: KeyboardShortcut["category"][] = [
  "General",
  "Navigation",
  "Editor",
  "Canvas",
];

function formatKeys(keys: string[][]): string[][] {
  return keys.map((chord) =>
    chord.map((k) => {
      if (k === "Cmd") return "⌘";
      if (k === "Shift") return "⇧";
      if (k === "Backspace") return "⌫";
      if (k === "Delete") return "⌦";
      if (k === "Enter") return "↵";
      if (k === "Escape") return "⎋";
      return k;
    }),
  );
}

export function KeyboardShortcutsOverlay({ open, onClose }: KeyboardShortcutsOverlayProps) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const groups = useMemo(() => {
    const shortcuts = Object.values(DEFAULT_KEYBOARD_SHORTCUTS);
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: shortcuts.filter((s) => s.category === cat),
    })).filter((g) => g.items.length > 0);
  }, []);

  if (!open) return null;

  return (
    <div className="ksOverlay" onClick={onClose}>
      <div
        className="ksPanel"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ksHeader">
          <div className="ksHeaderLeft">
            <div className="ksTitle">Keyboard shortcuts</div>
            <div className="ksSubtitle">
              Customise these in Settings → Keyboard
            </div>
          </div>
          <button className="ksCloseBtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="ksBody scroll-y">
          {groups.map((group) => (
            <div className="ksCategory" key={group.category}>
              <div className="ksCategoryTitle">{group.category}</div>
              {group.items.map((shortcut) => (
                <div className="ksShortcutRow" key={shortcut.id}>
                  <div className="ksShortcutLabel">
                    {shortcut.label}
                    {shortcut.description && (
                      <span style={{ marginLeft: "var(--sp-2)", color: "var(--fg-muted)", fontWeight: 400 }}>
                        — {shortcut.description}
                      </span>
                    )}
                  </div>
                  <div className="ksShortcutKeys">
                    {formatKeys(shortcut.keys).map((chord, ci) => (
                      <span key={ci} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        {ci > 0 && <span className="kbdSeparator">or</span>}
                        {chord.map((k, ki) => (
                          <span key={ki}>
                            {ki > 0 && <span className="kbdSeparator">+</span>}
                            <kbd className={`kbd ${k.length <= 2 ? "kbdMod" : ""}`}>{k}</kbd>
                          </span>
                        ))}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="ksFooter">
          <span className="ksFooterHint">
            <kbd className="kbd">esc</kbd> close
          </span>
          <span className="ksFooterHint">
            Customise in <kbd className="kbd">Settings</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}