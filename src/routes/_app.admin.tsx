import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();

  const roleQuery = useQuery({
    queryKey: ["admin", "is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const stats = useQuery({
    queryKey: ["admin", "stats"],
    enabled: roleQuery.data === true,
    queryFn: async () => {
      const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [
        users,
        projects,
        renders,
        feedback,
        errorsWeek,
        activeToday,
        voSeconds,
        recentSignups,
        recentFeedback,
        recentErrors,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("render_jobs").select("id", { count: "exact", head: true }),
        supabase.from("feedback").select("id", { count: "exact", head: true }),
        supabase
          .from("error_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sinceWeek),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("updated_at", sinceDay),
        supabase.from("voiceovers").select("duration_seconds"),
        supabase
          .from("profiles")
          .select("id, email, full_name, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("feedback")
          .select("id, feedback_type, feedback_text, page_url, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("error_logs")
          .select("id, error_message, page_url, component, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const totalVoSeconds = (voSeconds.data ?? []).reduce(
        (acc, v) => acc + Number(v.duration_seconds ?? 0),
        0,
      );

      return {
        totalUsers: users.count ?? 0,
        totalProjects: projects.count ?? 0,
        totalRenders: renders.count ?? 0,
        totalFeedback: feedback.count ?? 0,
        errorsLast7Days: errorsWeek.count ?? 0,
        activeToday: activeToday.count ?? 0,
        totalVoiceoverSeconds: Math.round(totalVoSeconds),
        recentSignups: recentSignups.data ?? [],
        recentFeedback: recentFeedback.data ?? [],
        recentErrors: recentErrors.data ?? [],
      };
    },
  });

  if (roleQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!roleQuery.data) {
    return <Navigate to="/projects" />;
  }

  if (stats.isLoading || !stats.data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const s = stats.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Beta visibility — DocForge</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Users" value={s.totalUsers} />
        <StatCard label="Active today" value={s.activeToday} />
        <StatCard label="Projects" value={s.totalProjects} />
        <StatCard label="Renders" value={s.totalRenders} />
        <StatCard label="Voiceover seconds" value={s.totalVoiceoverSeconds} />
        <StatCard label="Feedback" value={s.totalFeedback} />
        <StatCard label="Errors (7d)" value={s.errorsLast7Days} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel title="Recent signups">
          {s.recentSignups.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2 text-sm">
              {s.recentSignups.map((u) => (
                <li key={u.id} className="flex justify-between gap-3">
                  <span className="truncate">{u.full_name || u.email}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent feedback">
          {s.recentFeedback.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3 text-sm">
              {s.recentFeedback.map((f) => (
                <li key={f.id} className="border-b border-border pb-2 last:border-0">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="uppercase">{f.feedback_type}</span>
                    <span>{new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-3">{f.feedback_text}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent errors (last 10)">
          {s.recentErrors.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3 text-sm">
              {s.recentErrors.map((e) => (
                <li key={e.id} className="border-b border-border pb-2 last:border-0">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{e.component || "—"}</span>
                    <span>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-xs">{e.error_message}</p>
                  {e.page_url ? (
                    <p className="truncate text-xs text-muted-foreground">{e.page_url}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
    </Card>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No data yet.</p>;
}
