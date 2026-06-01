import { useState } from "react";
import { MessageSquare, X, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { debugError } from "@/utils/debug";

const TYPES = [
  { id: "bug", label: "Bug" },
  { id: "idea", label: "Idea" },
  { id: "praise", label: "Praise" },
  { id: "other", label: "Other" },
] as const;

type FeedbackType = (typeof TYPES)[number]["id"];

/** Floating gold feedback button + slide-out panel. Mounted in _app. */
export function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("idea");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!user) return null;

  const reset = () => {
    setText("");
    setType("idea");
    setSubmitted(false);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 250);
  };

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        feedback_type: type,
        feedback_text: text.trim(),
        page_url: typeof window !== "undefined" ? window.location.href : null,
      });
      if (error) throw error;
      setSubmitted(true);
      setTimeout(close, 2000);
    } catch (err) {
      debugError("[feedback] submit failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:bg-primary/90"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[340px] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-semibold">Send feedback</div>
            <button
              type="button"
              onClick={close}
              aria-label="Close feedback"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div className="text-sm font-medium">Thanks for your feedback!</div>
            </div>
          ) : (
            <div className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      type === t.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="What's on your mind?"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <Button
                type="button"
                onClick={submit}
                disabled={!text.trim() || submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  "Send feedback"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
