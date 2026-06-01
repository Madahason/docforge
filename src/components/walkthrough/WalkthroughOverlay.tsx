import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWalkthrough } from "@/lib/walkthrough-context";
import { WALKTHROUGH_STEPS, TOTAL_STEPS, type Placement } from "@/lib/walkthrough-steps";
import { toast } from "sonner";
import { Confetti } from "@/components/walkthrough/Confetti";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useTargetRect(stepId: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!stepId) {
      setRect(null);
      return;
    }
    let raf = 0;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-walkthrough="${stepId}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    const loop = () => {
      update();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, [stepId]);

  return rect;
}

function tooltipPosition(rect: Rect, placement: Placement): React.CSSProperties {
  const gap = 16;
  const tipMaxWidth = 320;
  switch (placement) {
    case "top":
      return {
        top: rect.top - gap,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      };
    case "bottom":
      return {
        top: rect.top + rect.height + gap,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, 0)",
      };
    case "left":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - gap - tipMaxWidth,
        transform: "translate(0, -50%)",
      };
    case "right":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width + gap,
        transform: "translate(0, -50%)",
      };
  }
}

export function WalkthroughOverlay() {
  const { isActive, currentStep, currentStepId, gateMet, next, back, skip, complete } =
    useWalkthrough();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const rect = useTargetRect(isActive ? currentStepId : null);

  if (!isActive || currentStep === 0) return null;
  const stepDef = WALKTHROUGH_STEPS[currentStep - 1];
  if (!stepDef) return null;

  const isLast = currentStep === TOTAL_STEPS;

  const handleFinish = () => {
    setShowConfetti(true);
    complete();
    toast.success("You're ready to produce! 🎬", {
      duration: 3000,
      style: { background: "#1f7a3a", color: "#fff", border: "1px solid #2c9d50" },
    });
  };

  // If we can't find the target, show a centered fallback tooltip
  const tipStyle: React.CSSProperties = rect
    ? tooltipPosition(rect, stepDef.placement)
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      {/* Dark overlay using SVG mask for cutout */}
      <div className="fixed inset-0 z-[80]" style={{ pointerEvents: "none" }} aria-hidden>
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <mask id="wt-cutout">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - 6}
                  y={rect.top - 6}
                  width={rect.width + 12}
                  height={rect.height + 12}
                  rx={8}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#wt-cutout)" />
        </svg>
        {rect && (
          <div
            className="absolute rounded-md"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
              boxShadow: "0 0 0 4px #e8c547",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Tooltip card */}
      <div
        className="fixed z-[85] w-[320px] rounded-lg p-5 text-left shadow-2xl"
        style={{
          ...tipStyle,
          backgroundColor: "#141414",
          border: "1px solid #e8c547",
          borderTop: "3px solid #e8c547",
        }}
      >
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Step {currentStep} of {TOTAL_STEPS}
        </div>
        <div className="mt-1 text-base font-bold text-white">{stepDef.title}</div>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "#cccccc" }}>
          {stepDef.description}
        </p>
        {stepDef.actionHint && !gateMet && (
          <p className="mt-3 text-xs font-medium" style={{ color: "#e8c547" }}>
            {stepDef.actionHint}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setConfirmSkip(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" size="sm" onClick={back}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button
                size="sm"
                onClick={handleFinish}
                className="bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90"
              >
                Get started →
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={next}
                disabled={!gateMet}
                className="bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90"
              >
                Next →
              </Button>
            )}
          </div>
        </div>
      </div>

      {confirmSkip && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-sm rounded-lg p-6"
            style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a" }}
          >
            <h3 className="text-base font-semibold text-white">Skip the tour?</h3>
            <p className="mt-2 text-sm text-muted-foreground">You can restart it from Settings.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmSkip(false)}>
                Continue tour
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setConfirmSkip(false);
                  skip();
                }}
                className="bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90"
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
    </>
  );
}

export function ResumePrompt() {
  const { showResume, acceptResume, declineResume, currentStep } = useWalkthrough();
  if (!showResume) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
    >
      <div
        className="w-full max-w-sm rounded-lg p-6 text-center"
        style={{ backgroundColor: "#141414", border: "1px solid #2a2a2a" }}
      >
        <h3 className="text-lg font-semibold text-white">
          Resume your tour from Step {currentStep}?
        </h3>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={declineResume}>
            No thanks
          </Button>
          <Button
            size="sm"
            onClick={acceptResume}
            className="bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold)]/90"
          >
            Resume
          </Button>
        </div>
      </div>
    </div>
  );
}
