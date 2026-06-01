import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, RefreshCw, Check, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  generateThumbnailConcepts,
  generateThumbnailVariant,
  generateThumbnailImage,
  type ThumbnailConcept,
} from "@/lib/thumbnails.functions";
import { useStudio, type ThumbnailRecord } from "@/lib/studio-context";

export function ThumbnailViewer({ onClose }: { onClose: () => void }) {
  const { project, thumbnail, setThumbnail } = useStudio();
  const genFn = useServerFn(generateThumbnailConcepts);
  const variantFn = useServerFn(generateThumbnailVariant);
  const imageFn = useServerFn(generateThumbnailImage);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState<number | null>(null);
  const [variantBusy, setVariantBusy] = useState<number | null>(null);
  const [conceptImages, setConceptImages] = useState<Record<number, string>>({});

  const concepts = (thumbnail?.concepts ?? []) as ThumbnailConcept[];
  const selectedIdx = thumbnail?.selected_concept_index ?? null;

  const generate = async (force = false) => {
    setBusy(true);
    try {
      const res = await genFn({ data: { projectId: project.id, force } });
      setThumbnail(res.record as ThumbnailRecord);
      if (!res.cached) toast.success("Thumbnail concepts generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateThumb = async (patch: Partial<ThumbnailRecord>) => {
    if (!thumbnail) return;
    const next = { ...thumbnail, ...patch };
    setThumbnail(next);
    const sb = supabase as unknown as { from: (t: string) => any };
    await sb.from("thumbnails").update(patch).eq("id", thumbnail.id);
  };

  const selectConcept = (i: number) => updateThumb({ selected_concept_index: i });

  const updateConcept = (i: number, copy: string) => {
    if (!thumbnail) return;
    const next = concepts.map((c, idx) => (idx === i ? { ...c, title_copy: copy } : c));
    updateThumb({
      concepts: next,
      custom_title_copy: i === selectedIdx ? copy : thumbnail.custom_title_copy,
    });
  };

  const addVariant = async (idx: number) => {
    setVariantBusy(idx);
    try {
      const { variant } = await variantFn({ data: { sourceConcept: concepts[idx] } });
      const next = [...concepts, { ...variant, concept_number: concepts.length + 1 }];
      await updateThumb({ concepts: next });
      toast.success("Variant added");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVariantBusy(null);
    }
  };

  const generateImage = async (idx: number) => {
    setImageBusy(idx);
    try {
      const { url } = await imageFn({ data: { prompt: concepts[idx].ai_image_prompt } });
      setConceptImages((prev) => ({ ...prev, [idx]: url }));
      toast.success("Image generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImageBusy(null);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]">
      <header className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-3">
        <div>
          <h2 className="text-lg font-semibold">Thumbnail Concepts</h2>
          <p className="text-xs text-muted-foreground">
            {concepts.length > 0
              ? `${concepts.length} concepts generated from your script`
              : "Generate concepts to begin"}
          </p>
        </div>
        <div className="flex gap-2">
          {concepts.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => generate(true)} disabled={busy}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {concepts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No thumbnail concepts yet</p>
            <Button onClick={() => generate(false)} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Generate Thumbnail Concepts
            </Button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            {concepts.map((c, i) => {
              const isSelected = i === selectedIdx;
              return (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-4 rounded-lg border bg-[#141414] p-5 md:grid-cols-5"
                  style={{
                    borderColor: isSelected ? "var(--accent-gold)" : "#2a2a2a",
                    opacity: selectedIdx != null && !isSelected ? 0.7 : 1,
                  }}
                >
                  <div className="md:col-span-2">
                    <div
                      className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-[#0a0a0a]"
                      style={{
                        backgroundImage: conceptImages[i] ? `url(${conceptImages[i]})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      {!conceptImages[i] && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          AI Image Here
                        </span>
                      )}
                      <div
                        className="absolute font-extrabold uppercase text-white drop-shadow-lg"
                        style={{
                          fontSize: c.title_copy.length > 20 ? 18 : 24,
                          top:
                            c.title_position === "top"
                              ? 12
                              : c.title_position === "center"
                                ? "50%"
                                : undefined,
                          bottom: c.title_position === "bottom" ? 12 : undefined,
                          left:
                            c.title_position === "left"
                              ? 12
                              : c.title_position === "center"
                                ? "50%"
                                : undefined,
                          right: c.title_position === "right" ? 12 : undefined,
                          transform:
                            c.title_position === "center" ? "translate(-50%, -50%)" : undefined,
                        }}
                      >
                        {c.title_copy}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 md:col-span-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-[#1f1f1f] px-2 py-0.5 text-[10px] font-semibold uppercase">
                        Concept {c.concept_number}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 rounded bg-[var(--accent-gold)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-gold)]">
                          <Check className="h-3 w-3" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs italic text-muted-foreground">{c.strategy}</p>

                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Title Copy
                      </div>
                      <Input
                        value={c.title_copy}
                        onChange={(e) => updateConcept(i, e.target.value)}
                        className="text-base font-bold"
                      />
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {c.title_copy.length} chars
                      </div>
                    </div>

                    <div className="rounded border-l-2 border-[var(--accent-gold)] bg-[#1a1a1a] px-3 py-2 text-xs">
                      <span className="text-[var(--accent-gold)]">★</span> {c.why_it_works}
                    </div>

                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Image Prompt
                      </div>
                      <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-[#0a0a0a] p-2 text-[11px] text-foreground/80">
                        {c.ai_image_prompt}
                      </pre>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copy(c.ai_image_prompt, "Midjourney prompt")}
                        >
                          <Copy className="mr-1 h-3 w-3" /> Midjourney
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copy(c.ai_image_prompt, "Flux prompt")}
                        >
                          <Copy className="mr-1 h-3 w-3" /> Flux
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateImage(i)}
                          disabled={imageBusy === i}
                        >
                          {imageBusy === i ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1 h-3 w-3" />
                          )}
                          Generate Image
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => selectConcept(i)}
                        className={
                          isSelected
                            ? ""
                            : "border-[var(--accent-gold)]/40 text-[var(--accent-gold)]"
                        }
                      >
                        {isSelected ? <Check className="mr-1 h-3 w-3" /> : null}
                        {isSelected ? "Selected" : "Select This Concept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addVariant(i)}
                        disabled={variantBusy === i}
                      >
                        {variantBusy === i ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        A/B Variant
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
