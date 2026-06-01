import { useEffect } from "react";

type Handler = (e: KeyboardEvent) => void;

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export interface ShortcutBinding {
  /** Lowercased key (e.g. "n", "/", "escape", "?", "k") */
  key: string;
  /** Require Cmd (mac) / Ctrl (others). */
  meta?: boolean;
  /** Allow firing while typing in an input/textarea (default false). */
  allowInInput?: boolean;
  handler: Handler;
}

/**
 * Subscribe to global keyboard shortcuts. Pass `enabled=false` to detach.
 */
export function useShortcuts(bindings: ShortcutBinding[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);
      const key = e.key.toLowerCase();
      for (const b of bindings) {
        if (b.key !== key) continue;
        const needMeta = !!b.meta;
        const hasMeta = e.metaKey || e.ctrlKey;
        if (needMeta !== hasMeta) continue;
        if (typing && !b.allowInInput) continue;
        b.handler(e);
        break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindings, enabled]);
}
