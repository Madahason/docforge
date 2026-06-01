import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorCardAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
};

export type ErrorCardProps = {
  title: string;
  description?: string;
  /** Optional bullet list of suggestions. */
  suggestions?: string[];
  /** Up to 2 action buttons. */
  actions?: ErrorCardAction[];
  /** "error" (red, default) or "warning" (gold). */
  tone?: "error" | "warning";
  /** Extra content rendered below description (e.g. progress bar). */
  children?: React.ReactNode;
  className?: string;
};

export function ErrorCard({
  title,
  description,
  suggestions,
  actions,
  tone = "error",
  children,
  className,
}: ErrorCardProps) {
  const isWarning = tone === "warning";
  return (
    <div
      role="alert"
      className={cn("space-y-3", className)}
      style={{
        background: isWarning ? "#1a1100" : "#1a0000",
        border: `1px solid ${isWarning ? "#e8c547" : "#f44336"}`,
        borderRadius: "8px",
        padding: "24px",
      }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="h-6 w-6 shrink-0"
          style={{ color: isWarning ? "#e8c547" : "#f44336" }}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          {suggestions && suggestions.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {children}
          {actions && actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button
                  key={a.label}
                  size="sm"
                  variant={a.variant ?? "outline"}
                  onClick={a.onClick}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
