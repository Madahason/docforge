import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Plus, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ProjectCard, type ProjectRow } from "@/components/ProjectCard";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectGridSkeleton } from "@/components/ui/skeleton-presets";
import { useWalkthroughInternalSetWelcome } from "@/lib/walkthrough-context";
import { AsyncButton } from "@/components/ui/async-button";

export const Route = createFileRoute("/_app/projects/")({
  component: ProjectsPage,
});

const PAGE_SIZE = 12;

function ProjectsPage() {
  const { user, profile } = useAuth();
  const setShowWelcome = useWalkthroughInternalSetWelcome();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    staleTime: Infinity,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ProjectRow[]> => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,title,status,content_type,completion_percent,thumbnail_url,updated_at,style_profile:style_profiles(editing_style)",
        )
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length,
  });

  const projects = useMemo(() => data?.pages.flat() ?? [], [data]);

  // Trigger welcome modal on first dashboard load when conditions are met
  useEffect(() => {
    if (!profile) return;
    if (profile.walkthrough_complete) return;
    if (profile.walkthrough_step !== 0) return;
    if (!profile.onboarding_complete) return;
    if (isLoading) return;
    if (projects.length > 0) return;
    setShowWelcome(true);
  }, [profile, projects, isLoading, setShowWelcome]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pb-16 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your documentary production workspace
          </p>
        </div>
        <Button
          asChild
          data-walkthrough="new-project-btn"
          className="bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]"
        >
          <Link to="/projects/new">
            <Plus className="mr-2 h-4 w-4" /> New Project
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <ProjectGridSkeleton />
      ) : projects.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <AsyncButton
                variant="outline"
                loading={isFetchingNextPage}
                loadingLabel="Loading…"
                onClick={() => fetchNextPage()}
              >
                Load more
              </AsyncButton>
            </div>
          )}
        </>
      ) : (
        <DashboardEmpty />
      )}
    </div>
  );
}

function DashboardEmpty() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Film}
      title="No projects yet"
      description="Create your first documentary project to get started."
      action={{
        label: "New Project",
        primary: true,
        onClick: () => navigate({ to: "/projects/new" }),
      }}
    />
  );
}
