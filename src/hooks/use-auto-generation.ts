import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useStudio, type Scene, type Clip } from "@/lib/studio-context";
import { autoGenerateScene, finalizeAutoGeneration } from "@/lib/auto-generate.functions";
import { debugError } from "@/utils/debug";

export type AutoStatus =
  | "waiting"
  | "generating"
  | "complete"
  | "skipped"
  | "needs_manual"
  | "failed";

export type AutoItem = {
  sceneId: string;
  sceneIndex: number;
  preview: string;
  recommendedType: string;
  status: AutoStatus;
  label: string;
  error?: string;
};

export type AutoSummary = {
  total: number;
  complete: number;
  skipped: number;
  needsManual: number;
  failed: number;
};

export type AutoGenerationState = {
  isRunning: boolean;
  isStopped: boolean;
  finished: boolean;
  currentIndex: number;
  items: AutoItem[];
  summary: AutoSummary | null;
};

function buildSummary(items: AutoItem[]): AutoSummary {
  return {
    total: items.length,
    complete: items.filter((i) => i.status === "complete").length,
    skipped: items.filter((i) => i.status === "skipped").length,
    needsManual: items.filter((i) => i.status === "needs_manual").length,
    failed: items.filter((i) => i.status === "failed").length,
  };
}

function delayFor(type: string): number {
  if (type === "motion_graphic") return 0;
  if (type === "ai_image_ken_burns" || type === "animated_image") return 1000;
  return 300;
}

export function useAutoGeneration() {
  const { project, scenes, setScenes, setClips, clips } = useStudio();
  const runScene = useServerFn(autoGenerateScene);
  const finalize = useServerFn(finalizeAutoGeneration);
  const stopRef = useRef(false);
  const [retryingScenes, setRetryingScenes] = useState<Record<string, boolean>>({});

  const [state, setState] = useState<AutoGenerationState>({
    isRunning: false,
    isStopped: false,
    finished: false,
    currentIndex: 0,
    items: [],
    summary: null,
  });

  const reloadFromDb = useCallback(async () => {
    const [sceneRes, clipRes] = await Promise.all([
      supabase
        .from("scenes")
        .select("*")
        .eq("project_id", project.id)
        .order("scene_index", { ascending: true }),
      supabase.from("clips").select("*").eq("project_id", project.id),
    ]);
    if (!sceneRes.error && sceneRes.data) setScenes(sceneRes.data as unknown as Scene[]);
    if (!clipRes.error && clipRes.data) setClips(clipRes.data as unknown as Clip[]);
  }, [project.id, setScenes, setClips]);

  const processItems = useCallback(
    async (items: AutoItem[]) => {
      stopRef.current = false;
      setState({
        isRunning: true,
        isStopped: false,
        finished: false,
        currentIndex: 0,
        items,
        summary: null,
      });

      for (let i = 0; i < items.length; i++) {
        if (stopRef.current) break;
        const item = items[i];
        setState((s) => ({
          ...s,
          currentIndex: i,
          items: s.items.map((it, idx) =>
            idx === i ? { ...it, status: "generating", label: "Generating..." } : it,
          ),
        }));

        let result: Awaited<ReturnType<typeof runScene>> | null = null;
        try {
          result = await runScene({
            data: { projectId: project.id, sceneId: item.sceneId },
          });
        } catch (err) {
          result = {
            status: "failed",
            label: "Failed — click to retry",
            error: (err as Error).message ?? "Unknown error",
          } as any;
        }

        setState((s) => ({
          ...s,
          items: s.items.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: result!.status as AutoStatus,
                  label: result!.label,
                  error: (result as any).error,
                }
              : it,
          ),
        }));

        const wait = delayFor(item.recommendedType);
        if (wait > 0 && i < items.length - 1) {
          await new Promise((r) => setTimeout(r, wait));
        }
      }

      await reloadFromDb();
      try {
        await finalize({ data: { projectId: project.id, complete: true } });
      } catch {
        /* non-fatal */
      }

      setState((s) => ({
        ...s,
        isRunning: false,
        finished: true,
        summary: buildSummary(s.items),
      }));
    },
    [project.id, runScene, finalize, reloadFromDb],
  );

  const start = useCallback(async () => {
    // Build queue from current pending scenes
    const items: AutoItem[] = scenes
      .filter((s) => (s.clip_status ?? "pending") !== "sourced")
      .filter((s) => !clips.find((c) => c.scene_id === s.id && c.clip_status === "sourced"))
      .map((s) => ({
        sceneId: s.id,
        sceneIndex: s.scene_index,
        preview: s.script_text.split(/\s+/).slice(0, 6).join(" "),
        recommendedType: s.recommended_asset_type,
        status: "waiting" as AutoStatus,
        label: "Waiting",
      }));
    if (items.length === 0) {
      // Nothing to do — still mark complete
      try {
        await finalize({ data: { projectId: project.id, complete: true } });
      } catch {
        /* ignore */
      }
      return;
    }
    await processItems(items);
  }, [scenes, clips, processItems, finalize, project.id]);

  const skipAll = useCallback(async () => {
    stopRef.current = true;
    setState((s) => ({
      ...s,
      items: s.items.map((it) =>
        it.status === "waiting" || it.status === "generating"
          ? { ...it, status: "skipped" as AutoStatus, label: "Skipped" }
          : it,
      ),
    }));
  }, []);

  const retryFailed = useCallback(async () => {
    const failedItems = state.items.filter((i) => i.status === "failed");
    if (failedItems.length === 0) return;
    const reset = failedItems.map((it) => ({
      ...it,
      status: "waiting" as AutoStatus,
      label: "Waiting",
    }));
    await processItems(reset);
  }, [state.items, processItems]);

  const retryScene = useCallback(
    async (sceneId: string) => {
      setRetryingScenes((m) => ({ ...m, [sceneId]: true }));
      try {
        await runScene({ data: { projectId: project.id, sceneId } });
        await reloadFromDb();
      } catch (err) {
        debugError("[retryScene] failed", err);
      } finally {
        setRetryingScenes((m) => {
          const { [sceneId]: _, ...rest } = m;
          return rest;
        });
      }
    },
    [project.id, runScene, reloadFromDb],
  );

  const regenerateAll = useCallback(async () => {
    // Reset all non-manually-confirmed clips back to pending so start() will re-run.
    // clips.status === 'complete' is treated as user-confirmed (set by confirmClip).
    await supabase
      .from("clips")
      .update({ clip_status: "pending" })
      .eq("project_id", project.id)
      .neq("status", "complete");
    const confirmedSceneIds = clips.filter((c) => c.status === "complete").map((c) => c.scene_id);
    const updateQ = supabase
      .from("scenes")
      .update({ clip_status: "pending" })
      .eq("project_id", project.id);
    if (confirmedSceneIds.length > 0) {
      await updateQ.not("id", "in", `(${confirmedSceneIds.join(",")})`);
    } else {
      await updateQ;
    }
    await reloadFromDb();
    const { data: freshScenes } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", project.id)
      .order("scene_index", { ascending: true });
    const items: AutoItem[] = ((freshScenes ?? []) as Array<Record<string, any>>)
      .filter((s) => (s.clip_status ?? "pending") !== "sourced")
      .map((s) => ({
        sceneId: s.id as string,
        sceneIndex: s.scene_index as number,
        preview: String(s.script_text ?? "")
          .split(/\s+/)
          .slice(0, 6)
          .join(" "),
        recommendedType: s.recommended_asset_type as string,
        status: "waiting" as AutoStatus,
        label: "Waiting",
      }));
    if (items.length === 0) {
      try {
        await finalize({ data: { projectId: project.id, complete: true } });
      } catch {
        /* ignore */
      }
      return;
    }
    await processItems(items);
  }, [project.id, clips, reloadFromDb, finalize, processItems]);

  return {
    state,
    start,
    skipAll,
    retryFailed,
    retryScene,
    regenerateAll,
    retryingScenes,
    reloadFromDb,
  };
}
