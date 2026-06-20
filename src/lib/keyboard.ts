// Keyboard chord matching.
//
// Shortcut chords are stored the same way the Settings "record" flow writes
// them: modifier tokens ("Cmd", "Ctrl", "Shift", "Alt") followed by the raw
// `e.key` (with " " mapped to "Space"). This module compares a live
// KeyboardEvent against those chords so App.tsx can dispatch by shortcut id.

import { KeyboardShortcuts } from "./types";

/** Tokens that represent modifier keys in a stored chord. */
const MODIFIER_TOKENS = new Set(["Cmd", "Ctrl", "Shift", "Alt"]);

/**
 * Normalise the main (non-modifier) key from a chord token and from a
 * KeyboardEvent so a case difference (e.g. stored "K" vs. pressed "k" without
 * Shift) still matches.
 */
function normKey(k: string): string {
  return k.length === 1 ? k.toLowerCase() : k;
}

/** Does this KeyboardEvent satisfy the modifier + key requirements of `chord`? */
export function chordMatches(e: KeyboardEvent, chord: string[]): boolean {
  const wantCmd = chord.includes("Cmd");
  const wantCtrl = chord.includes("Ctrl");
  const wantShift = chord.includes("Shift");
  const wantAlt = chord.includes("Alt");

  // "Cmd" is cross-platform: accept either the platform modifier (Meta on mac)
  // or Ctrl elsewhere. A chord that stores only "Cmd" should still fire when the
  // user presses Ctrl+K on a non-mac machine.
  const hasCmdLike = e.metaKey || e.ctrlKey;
  if (wantCmd && !hasCmdLike) return false;
  if (wantCtrl && !e.ctrlKey) return false;
  // If the chord doesn't ask for Cmd/Ctrl, neither may be held (otherwise
  // bare chords like ["?"] would fire on Cmd+?).
  if (!wantCmd && !wantCtrl && (e.metaKey || e.ctrlKey)) return false;

  if (wantShift && !e.shiftKey) return false;
  if (wantAlt && !e.altKey) return false;

  const mainTokens = chord.filter((k) => !MODIFIER_TOKENS.has(k));
  if (mainTokens.length === 0) return false;

  // Map the event's key to the same "Space" form the recorder uses.
  const pressed = e.key === " " ? "Space" : e.key;

  // Any main token matching satisfies chords that bind alternates
  // (e.g. ["Backspace"], ["Delete"]).
  return mainTokens.some((tok) => normKey(tok) === normKey(pressed));
}

/** True if the event matches any chord bound to the given shortcut id. */
export function matchesShortcut(
  e: KeyboardEvent,
  shortcuts: KeyboardShortcuts,
  id: string,
): boolean {
  const binding = shortcuts[id];
  if (!binding) return false;
  return binding.keys.some((chord) => chordMatches(e, chord));
}

/** Is the user currently typing into an editable field? */
export function isEditableTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}
