import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Stethoscope, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { diagnoseProjectAssets, fixAssetTypes } from "@/lib/auto-generate.functions";
import { debugLog } from "@/utils/debug";
import { toast } from "sonner";

type DiagnosticsResult = Awaited<ReturnType<typeof diagnoseProjectAssets>>;

export function DiagnosticsPanel({
  projectId,
  onAfterFix,
}: {
  projectId: string;
  onAfterFix: () => Promise<void> | void;
}) {
  const diagnose = useServerFn(diagnoseProjectAssets);
  const fix = useServerFn(fixAssetTypes);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [data, setData] = useState<DiagnosticsResult | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const result = await diagnose({ data: { projectId } });
      setData(result);
      // eslint-disable-next-line no-console
      debugLog("[diagnostics] result", result);
    } catch (err) {
      toast.error((err as Error).message ?? "Diagnostics failed");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const runFix = async () => {
    setFixing(true);
    try {
      const result = await fix({ data: { projectId } });
      toast.success(`${result.reset} scenes reset to pending`);
      await onAfterFix();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Fix failed");
    } finally {
      setFixing(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start border-border bg-transparent text-xs"
        onClick={runDiagnostics}
      >
        <Stethoscope className="mr-2 h-3.5 w-3.5" />
        Run Diagnostics
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Asset Type Diagnostics</DialogTitle>
          </DialogHeader>

          {loading || !data ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running diagnostics…
            </div>
          ) : (
            <div className="space-y-4">
              <Tabs defaultValue="types">
                <TabsList>
                  <TabsTrigger value="types">Recommended types</TabsTrigger>
                  <TabsTrigger value="motion">Motion graphics</TabsTrigger>
                  <TabsTrigger value="clips">Scene ↔ clips</TabsTrigger>
                </TabsList>

                <TabsContent value="types" className="mt-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1">recommended_asset_type</th>
                        <th className="py-1">count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.typeCounts).map(([t, n]) => (
                        <tr key={t} className="border-t border-border/50">
                          <td className="py-1.5 font-mono">{t}</td>
                          <td className="py-1.5">{n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>

                <TabsContent value="motion" className="mt-4 max-h-[300px] overflow-auto">
                  {data.motionScenes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No scenes recommended as motion graphics.
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1">#</th>
                          <th className="py-1">type</th>
                          <th className="py-1">data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.motionScenes.map((m) => (
                          <tr key={m.scene_index} className="border-t border-border/50">
                            <td className="py-1.5">{m.scene_index}</td>
                            <td className="py-1.5 font-mono">{m.motion_graphic_type ?? "—"}</td>
                            <td className="py-1.5">
                              {m.has_data ? (
                                <span className="text-[color:var(--success)]">HAS DATA</span>
                              ) : (
                                <span className="text-[color:var(--error)]">NULL</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </TabsContent>

                <TabsContent value="clips" className="mt-4 max-h-[300px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1">#</th>
                        <th className="py-1">recommended</th>
                        <th className="py-1">clip</th>
                        <th className="py-1">mg type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, i) => {
                        const mismatch =
                          r.recommended_asset_type === "motion_graphic" &&
                          r.clip_asset_type &&
                          r.clip_asset_type !== "motion_graphic";
                        return (
                          <tr
                            key={i}
                            className="border-t border-border/50"
                            style={
                              mismatch ? { backgroundColor: "rgba(239,68,68,0.08)" } : undefined
                            }
                          >
                            <td className="py-1.5">{r.scene_index}</td>
                            <td className="py-1.5 font-mono">{r.recommended_asset_type ?? "—"}</td>
                            <td className="py-1.5 font-mono">{r.clip_asset_type ?? "—"}</td>
                            <td className="py-1.5 font-mono">{r.motion_graphic_type ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TabsContent>
              </Tabs>

              <div
                className="rounded-md border p-3 text-xs"
                style={{ borderColor: "#2a2a2a", backgroundColor: "#141414" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {data.mismatched} scene{data.mismatched === 1 ? "" : "s"} with the wrong asset
                      type
                    </div>
                    <div className="text-muted-foreground">
                      Recommended motion_graphic but currently has a different clip.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={runFix}
                    disabled={fixing || data.mismatched === 0}
                    className="bg-[var(--accent-gold)] text-black hover:bg-[var(--accent-gold-hover)]"
                  >
                    {fixing ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wrench className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Fix Asset Types
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
