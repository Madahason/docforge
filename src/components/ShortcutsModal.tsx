import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShortcuts } from "@/hooks/use-shortcuts";

interface Row {
  keys: string;
  label: string;
}

const GLOBAL: Row[] = [
  { keys: "?", label: "Show keyboard shortcuts" },
  { keys: "N", label: "New project" },
  { keys: "/", label: "Focus search" },
  { keys: "Esc", label: "Close modal / cancel" },
];

const STUDIO: Row[] = [
  { keys: "⌘S", label: "Save scene" },
  { keys: "⌘E", label: "Export package" },
  { keys: "⌘M", label: "Open metadata" },
  { keys: "1 – 9", label: "Jump to scene" },
  { keys: "J / K", label: "Previous / next scene" },
  { keys: "Space", label: "Play / pause preview" },
];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="rounded-md border border-border">
        {rows.map((r, i) => (
          <div
            key={r.keys}
            className={`flex items-center justify-between px-3 py-2 text-sm ${
              i < rows.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="text-foreground">{r.label}</span>
            <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
              {r.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Global ? shortcut → opens this modal. Mounted once in _app. */
export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useShortcuts(
    [
      { key: "?", handler: () => setOpen((v) => !v) },
      { key: "escape", handler: () => setOpen(false), allowInInput: true },
    ],
    true,
  );

  // Also handle Shift+/ explicitly (some layouts don't fire "?" directly)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Section title="Global" rows={GLOBAL} />
          <Section title="Studio" rows={STUDIO} />
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">?</kbd>{" "}
            anytime to toggle this panel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
