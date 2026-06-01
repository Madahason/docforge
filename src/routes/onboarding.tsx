import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChartBar,
  Cpu,
  Search,
  BookOpen,
  Building2,
  Film,
  ArrowLeft,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

type ContentType = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

const CONTENT_TYPES: ContentType[] = [
  {
    id: "business_finance",
    icon: ChartBar,
    title: "Business & Finance",
    description: "Company stories, market analysis, financial exposés",
  },
  {
    id: "tech_innovation",
    icon: Cpu,
    title: "Tech & Innovation",
    description: "Startups, products, the future of technology",
  },
  {
    id: "true_crime",
    icon: Search,
    title: "True Crime & Investigation",
    description: "Scandals, cover-ups, systemic failures",
  },
  {
    id: "history_culture",
    icon: BookOpen,
    title: "History & Culture",
    description: "Events, movements, the stories behind the world",
  },
  {
    id: "brand_company",
    icon: Building2,
    title: "Brand & Company Stories",
    description: "Origin stories, turnarounds, case studies",
  },
  {
    id: "general_doc",
    icon: Film,
    title: "General Documentary",
    description: "Broad topics, mixed subject matter",
  },
];

type EditingStyle = {
  id: string;
  title: string;
  description: string;
  tags: [string, string, string];
};

const EDITING_STYLES: EditingStyle[] = [
  {
    id: "cinematic",
    title: "Cinematic & Deliberate",
    description:
      "Slow builds and atmospheric shots. Music carries emotional weight. Revelations land hard.",
    tags: ["Slow", "Atmospheric", "Premium"],
  },
  {
    id: "fast_informative",
    title: "Fast & Informative",
    description: "High cut density with text reinforcement on screen. Energetic and accessible.",
    tags: ["Fast", "Text-Heavy", "Accessible"],
  },
  {
    id: "systems_scale",
    title: "Systems & Scale",
    description: "Motion graphics driven. Shows complexity clearly at a moderate pace.",
    tags: ["Graphics", "Moderate", "Precise"],
  },
  {
    id: "investigative",
    title: "Investigative & Cold",
    description: "Clinical aesthetic. Dark tone. Evidence-forward with hard cuts and sparse music.",
    tags: ["Clinical", "Dark", "Evidence"],
  },
  {
    id: "archival",
    title: "Archival & Textural",
    description: "Real footage heavy. Contemplative pace. Historical gravity.",
    tags: ["Archival", "Slow", "Gravity"],
  },
  {
    id: "raw_urgent",
    title: "Raw & Urgent",
    description: "Fast irregular cuts. Immersive energy. Feels unfiltered and immediate.",
    tags: ["Fast", "Raw", "Urgent"],
  },
  {
    id: "escalating",
    title: "Escalating Arc",
    description: "Pacing mirrors the narrative. Slow open builds to crisis then resolves quietly.",
    tags: ["Dynamic", "Narrative", "Immersive"],
  },
];

type TextOverlay = "minimal" | "selective" | "heavy";
type ClipSource = "youtube_first" | "stock_youtube" | "youtube_only";
type MusicIntensity = "atmospheric" | "moderate" | "driving";

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading, profile, profileLoading, setProfile } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [contentType, setContentType] = useState<string | null>(null);
  const [editingStyle, setEditingStyle] = useState<string | null>(null);
  const [pacing, setPacing] = useState(5);
  const [textOverlay, setTextOverlay] = useState<TextOverlay>("selective");
  const [clipSource, setClipSource] = useState<ClipSource>("youtube_first");
  const [musicIntensity, setMusicIntensity] = useState<MusicIntensity>("moderate");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate({ to: "/projects" }), 1500);
      return () => clearTimeout(t);
    }
  }, [done, navigate]);

  if (loading || (user && profileLoading && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (profile?.onboarding_complete && !done) return <Navigate to="/projects" />;

  const handleFinish = async () => {
    if (!user || !contentType || !editingStyle) return;
    setSubmitting(true);
    const { error: spError } = await supabase.from("style_profiles").insert({
      user_id: user.id,
      name: "Default",
      is_default: true,
      content_type: contentType,
      editing_style: editingStyle,
      pacing_intensity: pacing,
      text_overlay_frequency: textOverlay,
      clip_source_ratio: clipSource,
      music_intensity: musicIntensity,
    });
    if (spError) {
      setSubmitting(false);
      toast.error(spError.message);
      return;
    }
    const { error: pError } = await supabase
      .from("profiles")
      .update({ onboarding_complete: true })
      .eq("id", user.id);
    if (pError) {
      setSubmitting(false);
      toast.error(pError.message);
      return;
    }
    if (profile) setProfile({ ...profile, onboarding_complete: true });
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "color-mix(in oklab, var(--accent-gold) 18%, transparent)" }}
          >
            <Check className="h-8 w-8" style={{ color: "var(--accent-gold)" }} />
          </div>
          <h2 className="text-2xl font-semibold">You're all set</h2>
          <p className="mt-2 text-sm text-muted-foreground">Taking you to your workspace…</p>
        </div>
      </div>
    );
  }

  const canContinue = (step === 1 && !!contentType) || (step === 2 && !!editingStyle) || step === 3;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-[640px]">
        {/* Header */}
        <div className="relative mb-8 flex items-center justify-center">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="absolute left-0 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <h1 className="text-xl font-bold" style={{ color: "var(--accent-gold)" }}>
            DocForge
          </h1>
        </div>

        {/* Progress dots */}
        <div className="mb-2 flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-2 w-2 rounded-full transition-colors"
              style={{
                backgroundColor: n <= step ? "var(--accent-gold)" : "var(--border)",
              }}
            />
          ))}
        </div>
        <p className="mb-8 text-center text-xs text-muted-foreground">Step {step} of 3</p>

        {step === 1 && <StepOne contentType={contentType} setContentType={setContentType} />}
        {step === 2 && <StepTwo editingStyle={editingStyle} setEditingStyle={setEditingStyle} />}
        {step === 3 && (
          <StepThree
            pacing={pacing}
            setPacing={setPacing}
            textOverlay={textOverlay}
            setTextOverlay={setTextOverlay}
            clipSource={clipSource}
            setClipSource={setClipSource}
            musicIntensity={musicIntensity}
            setMusicIntensity={setMusicIntensity}
          />
        )}

        <div className="mt-8">
          {step < 3 ? (
            <Button
              disabled={!canContinue}
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
            >
              Continue
            </Button>
          ) : (
            <Button
              disabled={submitting || !contentType || !editingStyle}
              onClick={handleFinish}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
            >
              {submitting ? "Saving…" : "Finish Setup"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 text-center">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function StepOne({
  contentType,
  setContentType,
}: {
  contentType: string | null;
  setContentType: (v: string) => void;
}) {
  return (
    <div>
      <StepHeader
        title="What kind of content do you make?"
        subtitle="This shapes your default production settings"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CONTENT_TYPES.map((c) => {
          const Icon = c.icon;
          const selected = contentType === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setContentType(c.id)}
              className={cn(
                "flex flex-col items-start rounded-md border p-4 text-left transition-colors",
                selected
                  ? "border-[var(--accent-gold)] bg-[var(--surface-elevated)]"
                  : "border-border bg-[var(--surface)] hover:bg-[var(--surface-elevated)]",
              )}
            >
              <Icon
                className="mb-3 h-5 w-5"
                style={{ color: selected ? "var(--accent-gold)" : "var(--text-muted)" }}
              />
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepTwo({
  editingStyle,
  setEditingStyle,
}: {
  editingStyle: string | null;
  setEditingStyle: (v: string) => void;
}) {
  return (
    <div>
      <StepHeader
        title="Choose your editing style"
        subtitle="This controls pacing, cut density, and visual rhythm across your videos"
      />
      <div className="flex flex-col gap-2.5">
        {EDITING_STYLES.map((s) => {
          const selected = editingStyle === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setEditingStyle(s.id)}
              className={cn(
                "rounded-md border-l-2 border-y border-r p-4 text-left transition-colors",
                selected
                  ? "border-l-[var(--accent-gold)] border-y-border border-r-border bg-[var(--surface-elevated)]"
                  : "border-l-transparent border-border bg-[var(--surface)] hover:bg-[var(--surface-elevated)]",
              )}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: selected ? "var(--accent-gold)" : undefined }}
              >
                {s.title}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm border border-border bg-[var(--background)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-[var(--surface)] p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-[var(--accent-gold)] text-[var(--background)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingRow({
  label,
  subtext,
  children,
}: {
  label: string;
  subtext: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-[var(--surface)] p-4">
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{subtext}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StepThree(props: {
  pacing: number;
  setPacing: (n: number) => void;
  textOverlay: TextOverlay;
  setTextOverlay: (v: TextOverlay) => void;
  clipSource: ClipSource;
  setClipSource: (v: ClipSource) => void;
  musicIntensity: MusicIntensity;
  setMusicIntensity: (v: MusicIntensity) => void;
}) {
  return (
    <div>
      <StepHeader
        title="Set your defaults"
        subtitle="These become your starting point for every project. You can change them per project anytime."
      />
      <div className="flex flex-col gap-3">
        <SettingRow label="Pacing Intensity" subtext="How fast your videos move overall">
          <Slider
            value={[props.pacing]}
            onValueChange={(v) => props.setPacing(v[0])}
            min={1}
            max={10}
            step={1}
          />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Deliberate</span>
            <span style={{ color: "var(--accent-gold)" }}>{props.pacing}</span>
            <span>Aggressive</span>
          </div>
        </SettingRow>

        <SettingRow label="Text Overlays" subtext="How often key words appear on screen">
          <PillToggle<TextOverlay>
            value={props.textOverlay}
            onChange={props.setTextOverlay}
            options={[
              { value: "minimal", label: "Minimal" },
              { value: "selective", label: "Selective" },
              { value: "heavy", label: "Heavy" },
            ]}
          />
        </SettingRow>

        <SettingRow
          label="Default Clip Source"
          subtext="YouTube is always searched first. Stock footage as fallback."
        >
          <PillToggle<ClipSource>
            value={props.clipSource}
            onChange={props.setClipSource}
            options={[
              { value: "youtube_first", label: "YouTube First" },
              { value: "stock_youtube", label: "Stock + YouTube" },
              { value: "youtube_only", label: "YouTube Only" },
            ]}
          />
          <p className="mt-3 text-[11px] text-muted-foreground">
            AI video generation is available manually per scene when needed
          </p>
        </SettingRow>

        <SettingRow label="Music Intensity" subtext="How prominent music is in your videos">
          <PillToggle<MusicIntensity>
            value={props.musicIntensity}
            onChange={props.setMusicIntensity}
            options={[
              { value: "atmospheric", label: "Atmospheric" },
              { value: "moderate", label: "Moderate" },
              { value: "driving", label: "Driving" },
            ]}
          />
        </SettingRow>
      </div>
    </div>
  );
}
