import { StrictMode } from "react";
import { applyTheme, readTheme } from "@/lib/theme";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/auth/AuthProvider";
import { App } from "@/App";
import "@/styles/tokens.css";

// Appearance before React paints, so a saved dark choice never flashes light.
applyTheme(readTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
