// Vercel build orchestration.
// Assembles a single static output dir: the landing files copied verbatim,
// plus the compiled studio SPA under /studio. If the studio build fails,
// Vercel keeps the last successful deployment live, so the landing can
// never go down from an app-side error.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

console.log("[build] cleaning dist/");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. Landing + legal + assets, copied through untouched.
const staticFiles = [
  "index.html",
  "labs.html",
  "privacy.html",
  "terms.html",
  "cookies.html",
];
for (const f of staticFiles) {
  const src = join(root, f);
  if (existsSync(src)) {
    cpSync(src, join(dist, f));
    console.log(`[build] + ${f}`);
  }
}
for (const d of ["samples", "audio"]) {
  const src = join(root, d);
  if (existsSync(src)) {
    cpSync(src, join(dist, d), { recursive: true });
    console.log(`[build] + ${d}/`);
  }
}

// 2. Build the studio SPA into dist/studio (vite outDir = ../dist/studio).
console.log("[build] building studio app…");
execSync("npm install --no-audit --no-fund && npm run build", {
  cwd: join(root, "studio-app"),
  stdio: "inherit",
});

console.log("[build] done.");
