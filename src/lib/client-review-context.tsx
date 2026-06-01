import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ClientReviewRecord = {
  id: string;
  user_id: string;
  project_id: string;
  client_email: string | null;
  client_name: string | null;
  share_token: string;
  status: "pending" | "viewed" | "approved" | "changes_requested" | string;
  overall_comment: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientCommentRecord = {
  id: string;
  review_id: string;
  project_id: string;
  scene_id: string | null;
  comment_type: "scene" | "script" | "voiceover" | "visual" | "general" | string;
  comment_text: string;
  status: "open" | "resolved" | string;
  created_at: string;
};

type Ctx = {
  review: ClientReviewRecord | null;
  comments: ClientCommentRecord[];
  setReview: (r: ClientReviewRecord | null) => void;
  refresh: () => Promise<void>;
  resolveComment: (id: string) => Promise<void>;
  unresolveComment: (id: string) => Promise<void>;
};

const ClientReviewCtx = createContext<Ctx | null>(null);

export function useClientReview() {
  const v = useContext(ClientReviewCtx);
  if (!v) throw new Error("useClientReview must be inside ClientReviewProvider");
  return v;
}

export function ClientReviewProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [review, setReview] = useState<ClientReviewRecord | null>(null);
  const [comments, setComments] = useState<ClientCommentRecord[]>([]);

  const refresh = useCallback(async () => {
    const { data: revs } = await supabase
      .from("client_reviews")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);
    const r = (revs?.[0] as ClientReviewRecord | undefined) ?? null;
    setReview(r);
    if (r) {
      const { data: cs } = await supabase
        .from("client_comments")
        .select("*")
        .eq("review_id", r.id)
        .order("created_at", { ascending: true });
      setComments((cs as ClientCommentRecord[] | null) ?? []);
    } else {
      setComments([]);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime subscription for review updates + new comments
  useEffect(() => {
    const channel = supabase
      .channel(`client-review-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_reviews",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setReview(null);
            setComments([]);
            return;
          }
          const next = payload.new as ClientReviewRecord;
          const prev = (payload.old as Partial<ClientReviewRecord>) ?? {};
          setReview(next);
          if (payload.eventType === "UPDATE" && prev.status !== next.status && next.responded_at) {
            if (next.status === "approved") {
              toast.success("Client approved the project!", { duration: 5000 });
            } else if (next.status === "changes_requested") {
              toast("Client requested changes", {
                description: "View the Client Feedback panel for details.",
                duration: 8000,
              });
            }
            // Re-fetch comments after a submission
            void supabase
              .from("client_comments")
              .select("*")
              .eq("review_id", next.id)
              .order("created_at", { ascending: true })
              .then(({ data }) => setComments((data as ClientCommentRecord[] | null) ?? []));
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_comments",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as ClientCommentRecord;
          setComments((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  const resolveComment = useCallback(async (id: string) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, status: "resolved" } : c)));
    await supabase.from("client_comments").update({ status: "resolved" }).eq("id", id);
  }, []);

  const unresolveComment = useCallback(async (id: string) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, status: "open" } : c)));
    await supabase.from("client_comments").update({ status: "open" }).eq("id", id);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ review, comments, setReview, refresh, resolveComment, unresolveComment }),
    [review, comments, refresh, resolveComment, unresolveComment],
  );

  return <ClientReviewCtx.Provider value={value}>{children}</ClientReviewCtx.Provider>;
}
