import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  triggerFinalVideoRender,
  pollFinalVideoRender,
  type FinalVideoRenderJob,
} from "@/lib/final-video-render";

const POLL_INTERVAL_MS = 4000;

export function useFinalVideoRender({ projectId }: { projectId: string }) {
  const [renderJob, setRenderJob] = useState<FinalVideoRenderJob | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      intervalRef.current = setInterval(async () => {
        try {
          const job = await pollFinalVideoRender(jobId);
          setRenderJob(job);
          if (job.status === "complete" || job.status === "failed") {
            stopPolling();
          }
        } catch {
          // Keep polling on transient errors
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  // On mount: check for an existing full_video render job for this project
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as unknown as { from: (t: string) => any })
          .from("render_jobs")
          .select("id, status, progress_percent, output_url, error_message")
          .eq("project_id", projectId)
          .eq("render_type", "full_video")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled || !data) return;

        const job: FinalVideoRenderJob = {
          id: data.id,
          status: data.status,
          progress_percent: data.progress_percent ?? 0,
          output_url: data.output_url ?? null,
          error_message: data.error_message ?? null,
        };
        setRenderJob(job);

        if (job.status === "queued" || job.status === "rendering") {
          startPolling(job.id);
        }
      } catch {
        // No existing job or query failed — start fresh
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, startPolling]);

  // Start/stop polling whenever renderJob status changes
  useEffect(() => {
    if (!renderJob) return;
    if (renderJob.status === "queued" || renderJob.status === "rendering") {
      if (intervalRef.current === null) startPolling(renderJob.id);
    } else {
      stopPolling();
    }
  }, [renderJob?.status, renderJob?.id, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const triggerRender = useCallback(async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    try {
      const jobId = await triggerFinalVideoRender(projectId);
      const initialJob: FinalVideoRenderJob = {
        id: jobId,
        status: "queued",
        progress_percent: 0,
        output_url: null,
        error_message: null,
      };
      setRenderJob(initialJob);
      startPolling(jobId);
    } finally {
      setIsTriggering(false);
    }
  }, [projectId, isTriggering, startPolling]);

  return {
    renderJob,
    isTriggering,
    triggerRender,
    cancelPolling: stopPolling,
  };
}
