import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  /** When true, renders as gold primary button. */
  primary?: boolean;
};

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-[var(--surface)] px-6 py-20 text-center",
        className,
      )}
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--surface-elevated)" }}
      >
        <Icon className="h-6 w-6" style={{ color: "var(--accent-gold)" }} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action &&
        (action.href ? (
          <Button
            asChild
            className={cn(
              "mt-6",
              action.primary &&
                "bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]",
            )}
            variant={action.primary ? "default" : "outline"}
          >
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button
            className={cn(
              "mt-6",
              action.primary &&
                "bg-primary text-primary-foreground hover:bg-[var(--accent-gold-hover)]",
            )}
            variant={action.primary ? "default" : "outline"}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
    </div>
  );
}
