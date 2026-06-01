import { useState } from "react";
import { X, Copy, Check, ExternalLink, RotateCw, Trash2, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/lib/notifications";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/lib/studio-context";
import { useClientReview, type ClientReviewRecord } from "@/lib/client-review-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GOLD = "#e8c547";
const BORDER = "#2a2a2a";
const MUTED = "#888888";

function makeToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return { label: "Approved ✓", color: "#4caf50", bg: "rgba(76,175,80,0.12)" };
    case "changes_requested":
      return { label: "Changes requested", color: GOLD, bg: "rgba(232,197,71,0.12)" };
    case "viewed":
      return { label: "Client is reviewing", color: "#5aa6ff", bg: "rgba(90,166,255,0.12)" };
    default:
      return { label: "Awaiting review", color: MUTED, bg: "rgba(255,255,255,0.06)" };
  }
}

const INCLUDE_OPTIONS = [
  { id: "script", label: "Script and scene breakdown" },
  { id: "voiceover", label: "Voiceover audio players" },
  { id: "visuals", label: "Visual assets and clips" },
  { id: "thumbnails", label: "Thumbnail concepts" },
  { id: "metadata", label: "Video metadata" },
] as const;

export function ShareModal({ onClose }: { onClose: () => void }) {
  const { project } = useStudio();
  const { review, setReview, comments, refresh } = useClientReview();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [includes] = useState<Record<string, boolean>>(
    Object.fromEntries(INCLUDE_OPTIONS.map((i) => [i.id, true])),
  );

  const reviewUrl = review ? `${window.location.origin}/review/${review.share_token}` : "";

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Not authenticated");
      const token = makeToken();
      const { data, error } = await supabase
        .from("client_reviews")
        .insert({
          user_id: userRes.user.id,
          project_id: project.id,
          client_name: clientName.trim() || null,
          client_email: clientEmail.trim() || null,
          share_token: token,
          status: "pending",
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create share link");
      setReview(data as ClientReviewRecord);
      showSuccess({ title: "Share link generated" });
    } catch (e) {
      showError({
        title: "Could not generate share link",
        description: e instanceof Error ? e.message : "Please try again.",
        retryable: true,
        retryFn: () => void handleGenerate(),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!reviewUrl) return;
    await navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!review) return;
    setBusy(true);
    try {
      const token = makeToken();
      const { data, error } = await supabase
        .from("client_reviews")
        .update({ share_token: token, status: "pending", responded_at: null, viewed_at: null })
        .eq("id", review.id)
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed");
      setReview(data as ClientReviewRecord);
      showSuccess({
        title: "New share link generated",
        description: "The previous link no longer works.",
      });
    } catch (e) {
      showError({
        title: "Could not regenerate link",
        description: e instanceof Error ? e.message : "Please try again.",
        retryable: true,
        retryFn: () => void handleRegenerate(),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!review) return;
    setBusy(true);
    try {
      await supabase.from("client_comments").delete().eq("review_id", review.id);
      const { error } = await supabase.from("client_reviews").delete().eq("id", review.id);
      if (error) throw new Error(error.message);
      setReview(null);
      await refresh();
      showSuccess({ title: "Client access revoked" });
    } catch (e) {
      showError({
        title: "Could not revoke access",
        description: e instanceof Error ? e.message : "Please try again.",
        retryable: true,
        retryFn: () => void handleRevoke(),
      });
    } finally {
      setBusy(false);
    }
  };

  const badge = review ? statusBadge(review.status) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-[10px] border p-8"
        style={{ backgroundColor: "#141414", borderColor: BORDER }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <h2 className="text-[20px] font-bold">Share with Client</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!review ? (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Client Name (optional)</label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Client Email (optional)</label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@company.com"
              />
              <p className="text-[10px]" style={{ color: MUTED }}>
                Used to notify you when they respond.
              </p>
            </div>

            <div className="space-y-2">
              <div
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: MUTED }}
              >
                Share Includes
              </div>
              <ul className="space-y-1.5 text-xs">
                {INCLUDE_OPTIONS.map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded border"
                      style={{
                        borderColor: includes[i.id] ? GOLD : BORDER,
                        backgroundColor: includes[i.id] ? GOLD : "transparent",
                      }}
                    >
                      {includes[i.id] && <Check className="h-3 w-3" style={{ color: "#000" }} />}
                    </span>
                    {i.label}
                  </li>
                ))}
              </ul>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={busy}
              className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Share Link
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {badge && (
              <div
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ color: badge.color, backgroundColor: badge.bg }}
              >
                {badge.label}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Share Link</label>
              <div className="flex gap-2">
                <Input value={reviewUrl} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 border-border bg-transparent"
                >
                  {copied ? (
                    <>
                      <Check className="mr-1 h-3 w-3" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" /> Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Button variant="outline" size="sm" asChild className="border-border bg-transparent">
              <a href={reviewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" /> Open Preview
              </a>
            </Button>

            {review.client_email && (
              <p className="text-xs" style={{ color: MUTED }}>
                Shared with {review.client_email}
              </p>
            )}

            <div
              className="rounded-md border p-3 text-xs"
              style={{ borderColor: BORDER, backgroundColor: "#0f0f0f" }}
            >
              <div className="font-semibold">{comments.length} comments from client</div>
              {comments.length > 0 && (
                <button
                  className="mt-1 text-[11px] hover:underline"
                  style={{ color: GOLD }}
                  onClick={onClose}
                >
                  View all comments →
                </button>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRegen(true)}
                disabled={busy}
                className="border-border bg-transparent"
              >
                <RotateCw className="mr-1 h-3 w-3" /> Regenerate Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRevoke(true)}
                disabled={busy}
                className="border-red-500/60 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="mr-1 h-3 w-3" /> Revoke Access
              </Button>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="Regenerate share link?"
        description="The current link will stop working immediately. Anyone with the old link will lose access."
        confirmLabel="Regenerate"
        destructive
        onConfirm={handleRegenerate}
      />
      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Revoke client access?"
        description="The current share link will stop working immediately. All client comments will be deleted."
        confirmLabel="Revoke Access"
        destructive
        onConfirm={handleRevoke}
      />
    </div>
  );
}
