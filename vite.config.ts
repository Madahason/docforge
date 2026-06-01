import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// cloudflare() is only active during `vite build` — it triggers dep pre-bundling
// that breaks TanStack Start's virtual module resolution at dev time.
export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    command === "build" ? cloudflare() : null,
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ].filter(Boolean),
}));
