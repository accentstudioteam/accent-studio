import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The app is served under /studio on the same domain as the static landing.
// base must match so asset URLs resolve correctly once deployed.
export default defineConfig({
  base: "/studio/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Emit into ../dist/studio so the Vercel build can serve landing + app
    // from one output directory (see vercel.json / build script).
    outDir: "../dist/studio",
    emptyOutDir: true,
  },
  server: {
    port: 5175,
  },
});
