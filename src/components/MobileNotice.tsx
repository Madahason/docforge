import { useEffect, useState } from "react";
import { Monitor, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showSuccess } from "@/lib/notifications";

const DISMISS_KEY = "docforge.mobileNotice.dismissed";
const BREAKPOINT = 768;

/**
 * Full-screen notice shown only on small viewports for routes that need
 * a desktop layout (Production Studio). Dismissal persists per-browser.
 */
export function MobileNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) return;
    if (window.innerWidth < BREAKPOINT) setVisible(true);
  }, []);

  if (!visible) return null;

  const handleContinue = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showSuccess({
        title: "Link copied",
        description: "Open it on your computer for the best experience.",
      });
    } catch {
      showSuccess({
        title: "Copy this URL",
        description: window.location.href,
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: "#0a0a0a" }}
    >
      <div className="text-[18px] font-bold tracking-tight" style={{ color: "var(--accent-gold)" }}>
        DocForge
      </div>
      <Monitor className="h-16 w-16 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold text-foreground">Built for desktop</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        DocForge works best on a laptop or desktop computer. The production studio requires a larger
        screen for the best experience.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button
          onClick={handleCopy}
          className="h-10 bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
        >
          <Copy className="h-4 w-4" />
          Open on Desktop
        </Button>
        <Button variant="outline" onClick={handleContinue} className="h-10">
          Continue Anyway
        </Button>
      </div>
    </div>
  );
}
