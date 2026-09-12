// Projects and deliveries: what a lab ordered, what is ready for it, and the bundle we hand over.
// Admins only. RPC wrappers; demo mode runs in memory.
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/demo";
import { demoVerify } from "@/lib/demoVerify";

export type Tier = "standard" | "aligned" | "exclusive";
export type ProjectStatus = "open" | "delivering" | "closed";
export interface Project {
  id: string;
  name: string;
  buyer: string;
  language: string;
  locale: string;
  target_hours: number;
  tier: Tier;
  deadline: string | null;
  status: ProjectStatus;
  notes: string | null;
  created_at: string;
  contributors: number;
  available_seconds: number;
  available_sessions: number;
  held_sessions: number;
  delivered_seconds: number;
  deliveries: number;
}
export interface ProjectInput {
  id: string | null;
  name: string;
  buyer: string;
  language: string;
  target_hours: number;
  tier: Tier;
  deadline: string | null;
  status: ProjectStatus;
  notes: string;
}
export interface Plan {
  sessions: number;
  seconds: number;
  speakers: number;
  excluded: { held: number; withdrawn: number; forfeited: number; delivered: number; exclusive_elsewhere: number; reserved?: number; other_project: number; sold_elsewhere?: number };
}
export interface BundleFile {
  path: string;
  bytes: number;
  sha256: string;
}
export interface Delivery {
  id: string;
  bundle_id: string;
  created_at: string;
  status: "building" | "ready" | "failed";
  session_count: number;
  speaker_count: number;
  seconds: number;
  files_total: number;
  files_done: number;
  manifest_sha256: string | null;
  bundle_files: BundleFile[] | null;
  note: string | null;
  error: string | null;
  finished_at: string | null;
  created_by: string | null;
}
export interface ExportStep {
  ok?: boolean;
  copied?: number;
  remaining?: number;
  total?: number;
  errors?: string[];
  manifest_sha256?: string;
  files?: number;
  sessions?: number;
  preview?: unknown;
  error?: string;
}

export const TIER_LABEL: Record<Tier, string> = { standard: "Standard · non-exclusive", aligned: "Aligned · non-exclusive", exclusive: "Exclusive" };
export const hoursOf = (s: number | string) => `${(Number(s) / 3600).toFixed(1)} h`;
export const sizeOf = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const projects = (): Promise<Project[]> => (isDemo() ? demoVerify.projects() : rpc<Project[]>("projects_overview"));
export const saveProject = (i: ProjectInput): Promise<{ id: string }> =>
  isDemo() ? demoVerify.saveProject(i) : rpc<{ id: string }>("project_save", { pid: i.id, name: i.name, buyer: i.buyer, language: i.language, target_hours: i.target_hours, tier: i.tier, deadline: i.deadline, status: i.status, notes: i.notes });
export const deliveryPlan = (pid: string): Promise<Plan> => (isDemo() ? demoVerify.deliveryPlan(pid) : rpc<Plan>("delivery_plan", { pid }));
export const createDelivery = (pid: string, note: string): Promise<{ delivery_id: string; bundle_id: string; sessions: number; files: number }> =>
  isDemo() ? demoVerify.createDelivery(pid, note) : rpc<{ delivery_id: string; bundle_id: string; sessions: number; files: number }>("delivery_create", { pid, note });
export const deliveries = (pid: string): Promise<Delivery[]> => (isDemo() ? demoVerify.deliveries(pid) : rpc<Delivery[]>("deliveries_list", { pid }));

/** One stage of the export function. The studio drives audio batches until none remain, then meta. */
export async function exportStage(did: string, stage: "audio" | "meta"): Promise<ExportStep> {
  if (isDemo()) return demoVerify.exportStage(did, stage);
  const { data, error } = await supabase.functions.invoke("export-delivery", { body: { delivery_id: did, stage } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return data as ExportStep;
}

/** Builds the whole bundle: audio in batches, then the metadata files. Reports progress as it goes. */
export async function buildBundle(did: string, onProgress: (text: string) => void): Promise<ExportStep> {
  let guard = 0;
  for (;;) {
    const step = await exportStage(did, "audio");
    const done = (step.total ?? 0) - (step.remaining ?? 0);
    onProgress(`Copying audio · ${done} of ${step.total ?? "?"} files${step.errors?.length ? ` · ${step.errors.length} failed` : ""}`);
    if (!step.remaining || step.copied === 0 || ++guard > 400) break;
  }
  onProgress("Writing manifest, speakers, consent log, index, README and checksums…");
  return exportStage(did, "meta");
}

export async function bundleFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("deliveries").createSignedUrl(path, 600);
  if (error || !data) throw new Error(error?.message ?? "no link");
  return data.signedUrl;
}

/** Zips every file of a ready delivery in the browser and hands it to the download. */
export async function downloadBundle(d: Delivery, onProgress: (text: string) => void): Promise<void> {
  const files = d.bundle_files ?? [];
  if (!files.length) throw new Error("the bundle has no files listed");
  const zip = new JSZip();
  let n = 0;
  for (const f of files) {
    const url = await bundleFileUrl(f.path);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not fetch ${f.path}`);
    zip.file(f.path, await res.arrayBuffer());
    n += 1;
    onProgress(`Fetching ${n} of ${files.length} files…`);
  }
  onProgress("Zipping…");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${d.bundle_id}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  onProgress(`Saved ${d.bundle_id}.zip (${sizeOf(blob.size)}).`);
}

/** The first manifest row, pretty-printed, so a founder can eyeball what a lab receives. */
export async function manifestPreview(d: Delivery): Promise<string> {
  if (isDemo()) return demoVerify.bundlePreview(d.id);
  const url = await bundleFileUrl(`${d.bundle_id}/manifest.jsonl`);
  const text = await (await fetch(url)).text();
  const first = text.split("\n").find((l) => l.trim());
  return first ? JSON.stringify(JSON.parse(first), null, 2) : "(empty manifest)";
}
