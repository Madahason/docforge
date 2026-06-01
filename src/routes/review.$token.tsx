import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Edit3, Loader2, Youtube, ImageIcon, Video } from "lucide-react";
import { toast } from "sonner";
import { getReviewByToken, submitClientReview } from "@/lib/client-review.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const GOLD = "#e8c547";
const BORDER = "#2a2a2a";
const MUTED = "#888888";

export const Route = createFileRoute("/review/$token")({
  head: () => ({
    meta: [
      { title: "Project Review — DocForge" },
      { name: "description", content: "Review and provide feedback on this video project." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewPage,
});

type Loaded = Awaited<ReturnType<typeof getReviewByToken>>;
type LoadedOk = Extract<Loaded, { ok: true }>;

type LocalComment = {
  scene_id: string | null;
  comment_type: "scene" | "script" | "voiceover" | "visual" | "general";
  comment_text: string;
};

function ReviewPage() {
  const { token } = Route.useParams();
  const fetchReview = useServerFn(getReviewByToken);
  const submit = useServerFn(submitClientReview);

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "loaded"; data: LoadedOk }
    | { kind: "submitted"; clientName: string | null; decision: "approved" | "changes_requested" }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchReview({ data: { token } });
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error", message: "Link expired or invalid." });
          return;
        }
        setState({ kind: "loaded", data: res });
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : "Failed to load review.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, fetchReview]);

  if (state.kind === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0" }}
      >
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0" }}
      >
        <h1 className="mb-2 text-2xl font-bold">Link expired or invalid</h1>
        <p className="text-sm" style={{ color: MUTED }}>
          {state.message}
        </p>
      </div>
    );
  }

  if (state.kind === "submitted") {
    const isApproved = state.decision === "approved";
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0" }}
      >
        <div
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            backgroundColor: isApproved ? "rgba(76,175,80,0.15)" : "rgba(232,197,71,0.15)",
          }}
        >
          <Check className="h-10 w-10" style={{ color: isApproved ? "#4caf50" : GOLD }} />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Review submitted successfully</h1>
        <p className="text-sm" style={{ color: MUTED }}>
          Thank you{state.clientName ? `, ${state.clientName}` : ""}.
        </p>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>
          The team has been notified of your feedback.
        </p>
      </div>
    );
  }

  return (
    <ReviewContent
      loaded={state.data}
      token={token}
      onSubmitted={(d, n) => setState({ kind: "submitted", decision: d, clientName: n })}
      submit={submit}
    />
  );
}

function ReviewContent({
  loaded,
  token,
  onSubmitted,
  submit,
}: {
  loaded: LoadedOk;
  token: string;
  onSubmitted: (decision: "approved" | "changes_requested", clientName: string | null) => void;
  submit: ReturnType<typeof useServerFn<typeof submitClientReview>>;
}) {
  const { review, project, scenes, voiceovers, clips, motionGraphics, imageAssets } = loaded;
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [overall, setOverall] = useState("");
  const [decision, setDecision] = useState<"approved" | "changes_requested" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalDuration = useMemo(
    () =>
      scenes.reduce(
        (acc: number, s: { estimated_seconds?: number | null }) => acc + (s.estimated_seconds ?? 0),
        0,
      ),
    [scenes],
  );

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  const canSubmit = (comments.length > 0 || overall.trim().length > 0) && decision !== null;

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          token,
          decision,
          overall_comment: overall.trim() || null,
          comments,
        },
      });
      onSubmitted(decision, res.client_name ?? review.client_name ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0", minHeight: "100vh" }}>
      <div
        className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4"
        style={{ borderColor: BORDER, backgroundColor: "#0d0d0d" }}
      >
        <div className="text-sm font-bold" style={{ color: GOLD }}>
          DocForge
        </div>
        <div className="flex-1 truncate text-center text-sm font-medium">
          {project?.title ?? "Project"}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
          size="sm"
        >
          {submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Submit Review
        </Button>
      </div>

      <div className="mx-auto max-w-[900px] px-6 py-6">
        <div
          className="mb-6 rounded-lg border p-6"
          style={{ backgroundColor: "#141414", borderColor: BORDER }}
        >
          <h1 className="text-2xl font-bold">{project?.title ?? "Untitled project"}</h1>
          <p className="mt-2 text-sm" style={{ color: MUTED }}>
            Please review the content below and submit your feedback.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs" style={{ color: MUTED }}>
            <span>Total scenes: {scenes.length}</span>
            <span>Total duration: {fmtDuration(totalDuration)}</span>
            {project?.created_at && (
              <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {scenes.map((scene, idx: number) => {
          const accSeconds = scenes
            .slice(0, idx)
            .reduce(
              (a: number, s: { estimated_seconds?: number | null }) =>
                a + (s.estimated_seconds ?? 0),
              0,
            );
          const start = fmtDuration(accSeconds);
          const end = fmtDuration(accSeconds + (scene.estimated_seconds ?? 0));
          const vo = voiceovers.find((v) => v.scene_id === scene.id);
          const clip = clips.find((c) => c.scene_id === scene.id);
          const mg = motionGraphics.find((m) => m.scene_id === scene.id);
          const img = imageAssets.find((a) => a.scene_id === scene.id);
          return (
            <SceneReviewCard
              key={scene.id}
              data-scene-id={scene.id}
              scene={scene}
              sceneNumber={idx + 1}
              start={start}
              end={end}
              voiceover={vo}
              clip={clip}
              motionGraphic={mg}
              imageAsset={img}
              onAddComment={(c) => setComments((prev) => [...prev, c])}
              sceneComments={comments.filter((c) => c.scene_id === scene.id)}
              onRemoveComment={(idx2) =>
                setComments((prev) => {
                  const sceneIdxs: number[] = [];
                  prev.forEach((c, i) => {
                    if (c.scene_id === scene.id) sceneIdxs.push(i);
                  });
                  const removeAt = sceneIdxs[idx2];
                  return prev.filter((_, i) => i !== removeAt);
                })
              }
            />
          );
        })}

        <div
          className="mt-6 rounded-lg border p-6"
          style={{ backgroundColor: "#141414", borderColor: BORDER }}
        >
          <h2 className="mb-3 text-base font-bold">Overall Feedback</h2>
          <Textarea
            rows={5}
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            placeholder="Any overall comments about the project..."
          />
        </div>

        <div className="mt-6">
          <div
            className="mb-3 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: GOLD }}
          >
            Your Decision
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DecisionCard
              kind="approved"
              selected={decision === "approved"}
              onClick={() => setDecision("approved")}
            />
            <DecisionCard
              kind="changes_requested"
              selected={decision === "changes_requested"}
              onClick={() => setDecision("changes_requested")}
            />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="mt-6 w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
          size="lg"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Review
        </Button>
      </div>
    </div>
  );
}

function DecisionCard({
  kind,
  selected,
  onClick,
}: {
  kind: "approved" | "changes_requested";
  selected: boolean;
  onClick: () => void;
}) {
  const isApprove = kind === "approved";
  const color = isApprove ? "#4caf50" : GOLD;
  const bg = isApprove ? "#0a1a0a" : "#1a1100";
  const Icon = isApprove ? Check : Edit3;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-lg border p-5 text-left transition-all",
        selected ? "ring-2" : "",
      )}
      style={{
        backgroundColor: bg,
        borderColor: color,
        ...(selected ? ({ "--tw-ring-color": color } as React.CSSProperties) : {}),
      }}
    >
      {selected && (
        <div
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: color }}
        >
          <Check className="h-4 w-4" style={{ color: "#000" }} />
        </div>
      )}
      <Icon className="mb-3 h-7 w-7" style={{ color }} />
      <div className="text-base font-bold" style={{ color }}>
        {isApprove ? "Approve Project" : "Request Changes"}
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: MUTED }}>
        {isApprove
          ? "I'm happy with this content and approve it for production."
          : "I have feedback that needs to be addressed before approval."}
      </p>
    </button>
  );
}

const COMMENT_TYPES: LocalComment["comment_type"][] = ["script", "voiceover", "visual", "general"];

function SceneReviewCard(props: {
  scene: any;
  sceneNumber: number;
  start: string;
  end: string;
  voiceover?: any;
  clip?: any;
  motionGraphic?: any;
  imageAsset?: any;
  sceneComments: LocalComment[];
  onAddComment: (c: LocalComment) => void;
  onRemoveComment: (i: number) => void;
  "data-scene-id"?: string;
}) {
  const {
    scene,
    sceneNumber,
    start,
    end,
    voiceover,
    clip,
    motionGraphic,
    imageAsset,
    sceneComments,
    onAddComment,
    onRemoveComment,
  } = props;
  const [text, setText] = useState("");
  const [type, setType] = useState<LocalComment["comment_type"]>("general");

  return (
    <div
      data-scene-id={props["data-scene-id"]}
      className="mb-4 rounded-lg border p-5"
      style={{ backgroundColor: "#141414", borderColor: BORDER }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
        >
          Scene {sceneNumber}
        </span>
        {scene.emotional_temperature && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: MUTED }}
          >
            {scene.emotional_temperature}
          </span>
        )}
        <span className="ml-auto text-[11px]" style={{ color: MUTED }}>
          {start} — {end}
        </span>
      </div>

      <p className="text-sm leading-[1.8]" style={{ color: "#cccccc" }}>
        {scene.script_text}
      </p>

      {voiceover?.audio_url && (
        <div className="mt-3">
          <audio controls src={voiceover.audio_url} className="w-full" />
        </div>
      )}

      {clip || motionGraphic || imageAsset ? (
        <div
          className="mt-3 overflow-hidden rounded-md border"
          style={{ borderColor: BORDER, backgroundColor: "#000" }}
        >
          <VisualPreview clip={clip} motionGraphic={motionGraphic} imageAsset={imageAsset} />
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium">Leave a comment on this scene</div>
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Your feedback..."
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {COMMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="rounded-full px-2.5 py-1 text-[10px] font-medium capitalize transition-colors"
              style={{
                backgroundColor: type === t ? `${GOLD}22` : "rgba(255,255,255,0.05)",
                color: type === t ? GOLD : MUTED,
                border: `1px solid ${type === t ? GOLD : BORDER}`,
              }}
            >
              {t}
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto border-border bg-transparent text-[11px]"
            disabled={!text.trim()}
            onClick={() => {
              onAddComment({
                scene_id: scene.id,
                comment_type: type,
                comment_text: text.trim(),
              });
              setText("");
              setType("general");
            }}
          >
            Add Comment
          </Button>
        </div>

        {sceneComments.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {sceneComments.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md p-2 text-xs"
                style={{ backgroundColor: "#1a1a1a" }}
              >
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-medium capitalize"
                  style={{ backgroundColor: `${GOLD}22`, color: GOLD }}
                >
                  {c.comment_type}
                </span>
                <span className="flex-1 leading-relaxed">{c.comment_text}</span>
                <button
                  onClick={() => onRemoveComment(i)}
                  className="text-[10px] hover:underline"
                  style={{ color: MUTED }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VisualPreview({
  clip,
  motionGraphic,
  imageAsset,
}: {
  clip?: any;
  motionGraphic?: any;
  imageAsset?: any;
}) {
  if (clip?.asset_type === "youtube" && clip.source_video_id) {
    return (
      <div>
        <div className="aspect-video">
          <iframe
            title="Clip preview"
            src={`https://www.youtube.com/embed/${clip.source_video_id}?mute=1`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {(clip.source_channel || clip.timestamp_start) && (
          <div className="flex items-center gap-2 px-3 py-2 text-[10px]" style={{ color: MUTED }}>
            <Youtube className="h-3 w-3" />
            {clip.source_channel && <span>{clip.source_channel}</span>}
            {clip.timestamp_start && <span>· {clip.timestamp_start}</span>}
          </div>
        )}
      </div>
    );
  }
  if (motionGraphic) {
    return (
      <div className="flex aspect-video items-center justify-center gap-2">
        <Video className="h-5 w-5" style={{ color: GOLD }} />
        <span className="text-xs">
          <span className="font-semibold capitalize">{motionGraphic.graphic_type}</span> · Remotion
          graphic
        </span>
      </div>
    );
  }
  if (imageAsset?.selected_url || clip?.image_url) {
    const url = imageAsset?.selected_url ?? clip?.image_url;
    return (
      <div className="aspect-video">
        <img src={url} alt="Scene visual" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex aspect-video items-center justify-center gap-2 text-xs"
      style={{ color: MUTED }}
    >
      <ImageIcon className="h-4 w-4" />
      Visual pending
    </div>
  );
}
