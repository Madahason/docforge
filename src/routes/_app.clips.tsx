import { createFileRoute } from "@tanstack/react-router";
import { Film } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeraLibraryTab } from "@/components/clips/HeraLibraryTab";

export const Route = createFileRoute("/_app/clips")({
  component: ClipsPage,
});

function ClipsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pb-16 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clip Index</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search and reuse footage across all your projects
        </p>
      </div>

      <Tabs defaultValue="hera">
        <TabsList>
          <TabsTrigger value="youtube">YouTube Index</TabsTrigger>
          <TabsTrigger value="stock">Stock Footage</TabsTrigger>
          <TabsTrigger value="images">Image Assets</TabsTrigger>
          <TabsTrigger value="hera">Hera Library</TabsTrigger>
        </TabsList>

        <TabsContent value="youtube">
          <Placeholder label="YouTube clips" />
        </TabsContent>
        <TabsContent value="stock">
          <Placeholder label="Stock footage" />
        </TabsContent>
        <TabsContent value="images">
          <Placeholder label="Image assets" />
        </TabsContent>
        <TabsContent value="hera">
          <HeraLibraryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-[var(--surface)] px-6 py-20 text-center">
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--surface-elevated)" }}
      >
        <Film className="h-6 w-6" style={{ color: "var(--accent-gold)" }} />
      </div>
      <h3 className="text-base font-semibold">No {label.toLowerCase()} indexed yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Clips from your projects will appear here.
      </p>
    </div>
  );
}
