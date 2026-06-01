import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md", className)} style={{ background: "#1a1a1a" }} />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div
      className="space-y-3 rounded-md border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <Block className="aspect-video w-full" />
      <Block className="h-4 w-3/4" />
      <Block className="h-3 w-1/2" />
      <div className="flex gap-2 pt-2">
        <Block className="h-5 w-16" />
        <Block className="h-5 w-12" />
      </div>
    </div>
  );
}

export function ProjectGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SceneListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Block className="h-3 w-3 rounded-full" />
      <Block className="h-4 flex-1" />
    </div>
  );
}

export function SceneListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <SceneListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function SceneCardSkeleton() {
  return (
    <div
      className="space-y-3 rounded-md border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between">
        <Block className="h-4 w-24" />
        <Block className="h-5 w-16" />
      </div>
      <Block className="h-16 w-full" />
      <div className="flex gap-2">
        <Block className="h-8 w-20" />
        <Block className="h-8 w-20" />
      </div>
    </div>
  );
}

export function StudioSkeleton() {
  return (
    <div className="grid grid-cols-[240px_1fr_280px] gap-4 p-4">
      <div>
        <Block className="mb-3 h-4 w-32" />
        <SceneListSkeleton count={8} />
      </div>
      <div className="space-y-4">
        <SceneCardSkeleton />
        <SceneCardSkeleton />
        <SceneCardSkeleton />
      </div>
      <div className="space-y-3">
        <Block className="h-20 w-full" />
        <Block className="h-20 w-full" />
        <Block className="h-20 w-full" />
      </div>
    </div>
  );
}

export function ClipCardSkeleton() {
  return (
    <div
      className="space-y-2 rounded-md border p-2"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <Block className="aspect-video w-full" />
      <Block className="h-3 w-3/4" />
      <div className="flex gap-1">
        <Block className="h-4 w-12" />
        <Block className="h-4 w-12" />
      </div>
    </div>
  );
}

export function ClipGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ClipCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ManifestSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Block className="h-6 w-1/3" />
        <Block className="h-3 w-1/2" />
      </div>
      <SceneCardSkeleton />
      <SceneCardSkeleton />
      <SceneCardSkeleton />
    </div>
  );
}
