import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface AsyncButtonProps extends Omit<ButtonProps, "children"> {
  /** Spinner + disabled when true. */
  loading?: boolean;
  /** Label shown while idle. */
  children: React.ReactNode;
  /** Label shown while loading. Defaults to children + "…". */
  loadingLabel?: React.ReactNode;
  /** Icon shown when idle. Replaced by spinner when loading. */
  icon?: React.ReactNode;
  /** Reason shown in tooltip when button is disabled but not loading. */
  disabledReason?: string;
}

/**
 * Button wrapper that standardizes async loading states across the app.
 * - Spinner replaces the icon while loading
 * - Label switches to loadingLabel (or "<children>…")
 * - Disabled while loading
 * - When disabled with a `disabledReason`, surface it in a tooltip so we
 *   never disable silently.
 */
export const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  function AsyncButton(
    { loading, children, loadingLabel, icon, disabled, disabledReason, className, ...rest },
    ref,
  ) {
    const isDisabled = !!loading || !!disabled;
    const showSpinner = !!loading;
    const label = showSpinner ? (loadingLabel ?? <>{children}…</>) : children;

    const btn = (
      <Button
        ref={ref}
        disabled={isDisabled}
        aria-busy={showSpinner || undefined}
        className={cn(className)}
        {...rest}
      >
        {showSpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        <span>{label}</span>
      </Button>
    );

    if (disabled && !loading && disabledReason) {
      return (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span wrapper so the tooltip works on a disabled button */}
              <span className="inline-flex">{btn}</span>
            </TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return btn;
  },
);
