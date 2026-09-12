import { SUPABASE_KEY, SUPABASE_URL, supabase } from "@/lib/supabase";

export interface UploadResult {
  bytes: number;
}

export class UploadError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryable: boolean) {
    super(message);
  }
}

const RETRY_DELAYS_MS = [1200, 3000, 6000];

function describe(status: number, body: string): UploadError {
  if (status === 0) return new UploadError("The upload didn't reach our server. Check your connection and tap Upload again.", 0, true);
  if (status === 409) return new UploadError("A take with this name already exists. Tap Upload again.", 409, false);
  if (status === 413) return new UploadError("That recording is too large. Record a shorter take.", 413, false);
  if (status === 415 || /mime/i.test(body)) return new UploadError("This phone's recording format isn't accepted yet. Try another browser.", status, false);
  if (status === 400 || status === 403) return new UploadError("Our server refused the file. Tap Upload again, or re-record.", status, false);
  if (status >= 500 || status === 429) return new UploadError("Our server is busy. Wait a moment and tap Upload again.", status, true);
  return new UploadError("Upload failed. Tap Upload again.", status, true);
}

function attempt(path: string, blob: Blob, contentType: string, onProgress: (pct: number) => void, bucket: string, token: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.timeout = 120_000;
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ bytes: blob.size });
      else reject(describe(xhr.status, xhr.responseText || ""));
    };
    xhr.onerror = () => reject(describe(0, ""));
    xhr.ontimeout = () => reject(new UploadError("The upload timed out. Check your connection and tap Upload again.", 0, true));
    xhr.onabort = () => reject(new UploadError("Upload cancelled.", 0, false));
    xhr.send(blob);
  });
}

/** Upload a recording with progress, retrying automatically on network trouble. */
export async function uploadRecording(
  path: string,
  blob: Blob,
  contentType: string,
  onProgress: (pct: number, attemptNo: number) => void,
  bucket = "applications",
): Promise<UploadResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? SUPABASE_KEY;
  let last: UploadError | null = null;
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      return await attempt(path, blob, contentType, (pct) => onProgress(pct, i + 1), bucket, token);
    } catch (e) {
      last = e instanceof UploadError ? e : new UploadError("Upload failed. Tap Upload again.", 0, true);
      if (!last.retryable || i === RETRY_DELAYS_MS.length) break;
      onProgress(0, i + 2);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
    }
  }
  throw last ?? new UploadError("Upload failed. Tap Upload again.", 0, true);
}

/** Best-effort delete of a take the applicant no longer wants. Failure is harmless: the row never references it. */
export async function deleteRecording(path: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/applications/${path}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
  } catch {
    // ignore
  }
}
