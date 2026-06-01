import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";

/**
 * Subtle opacity 0 → 1 fade keyed on the route pathname. Prevents jarring
 * snaps between route changes. 150ms feels instant but smooths handoff.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(true);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
