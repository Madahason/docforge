import { Button } from "@/components/ui/button";
import { useWalkthrough } from "@/lib/walkthrough-context";

export function WelcomeModal() {
  const { showWelcome, startTour, dismissWelcome } = useWalkthrough();
  if (!showWelcome) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
    >
      <div
        className="w-full max-w-[560px] rounded-xl p-12 text-center"
        style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a" }}
      >
        <div
          className="mx-auto mb-6 text-2xl font-bold tracking-wider"
          style={{ color: "#e8c547" }}
        >
          DOCFORGE
        </div>
        <h1 className="text-[32px] font-bold leading-tight text-white">Welcome to DocForge</h1>
        <p className="mx-auto mt-4 max-w-md text-[18px] text-muted-foreground">
          Your AI-powered documentary production studio. Let's build your first video in under 5
          minutes.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {[
            { icon: "🎙", label: "AI Voiceover" },
            { icon: "🎬", label: "Auto Visuals" },
            { icon: "📦", label: "Export Ready" },
          ].map((p) => (
            <div
              key={p.label}
              className="rounded-full border px-4 py-1.5 text-sm"
              style={{ borderColor: "#2a2a2a", backgroundColor: "#1a1a1a", color: "#e0e0e0" }}
            >
              <span className="mr-1.5">{p.icon}</span>
              {p.label}
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3">
          <Button
            size="lg"
            onClick={startTour}
            className="w-full bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90"
          >
            Show me around
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={dismissWelcome}
            className="w-full border-border bg-transparent"
          >
            I'll explore myself
          </Button>
        </div>
      </div>
    </div>
  );
}
