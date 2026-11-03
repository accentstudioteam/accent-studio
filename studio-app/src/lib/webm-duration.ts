/* ============================================================================
   Write a real duration into a MediaRecorder WebM.

   MediaRecorder streams, so it cannot know how long a take will be and never
   writes the Duration element into the Segment Info header. Every file it
   produces reports duration Infinity. Verified in-browser with this app's own
   options: a four second recording came back as Infinity, seekable to Infinity.

   That costs us twice. The browser does not know where the file ends, so on a
   remote URL it can run to the edge of its buffer and simply stop producing
   audio while still claiming to play. And the files we sell carry no length,
   which is a defect in the deliverable, not just an annoyance in the player.

   We know the true length: the recorder times it. So splice a Duration in.

   EBML, only as much as we need:
     Segment (0x18538067)
       Info (0x1549A966)
         TimecodeScale (0x2AD7B1)   nanoseconds per tick, default 1_000_000
         Duration     (0x4489)      float, in those ticks, normally absent

   Patching is best-effort by design. Anything unexpected and we hand back the
   original bytes rather than risk a corrupt take, because a contributor cannot
   record it again.
   ========================================================================= */

const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const DURATION = 0x4489;
const TIMECODE_SCALE = 0x2ad7b1;
const DEFAULT_SCALE_NS = 1_000_000;

interface Vint {
  value: number;
  length: number;
  unknown: boolean;
}

/** EBML variable-length integer. Element ids keep their marker bits; sizes drop them. */
function readVint(buf: Uint8Array, pos: number, keepMarker: boolean): Vint | null {
  const first = buf[pos];
  if (first === undefined || first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || pos + length > buf.length) return null;

  let value = keepMarker ? first : first & (mask - 1);
  let allOnes = !keepMarker && (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < length; i += 1) {
    const byte = buf[pos + i];
    if (byte !== 0xff) allOnes = false;
    value = value * 256 + byte;
  }
  return { value, length, unknown: allOnes };
}

/** Encode a length as an EBML size, in the fewest bytes that hold it. */
function writeVint(value: number): Uint8Array {
  for (let length = 1; length <= 8; length += 1) {
    const max = Math.pow(2, 7 * length) - 1;
    if (value >= max) continue;
    const out = new Uint8Array(length);
    let rest = value;
    for (let i = length - 1; i >= 0; i -= 1) {
      out[i] = rest & 0xff;
      rest = Math.floor(rest / 256);
    }
    out[0] |= 0x80 >> (length - 1);
    return out;
  }
  throw new Error("size too large for EBML");
}

interface Element {
  id: number;
  size: number;
  unknownSize: boolean;
  headerStart: number;
  dataStart: number;
  dataEnd: number;
}

/** Read one element header at pos. dataEnd is the buffer end when the size is unknown. */
function readElement(buf: Uint8Array, pos: number): Element | null {
  const id = readVint(buf, pos, true);
  if (!id) return null;
  const size = readVint(buf, pos + id.length, false);
  if (!size) return null;
  const dataStart = pos + id.length + size.length;
  return {
    id: id.value,
    size: size.value,
    unknownSize: size.unknown,
    headerStart: pos,
    dataStart,
    dataEnd: size.unknown ? buf.length : Math.min(buf.length, dataStart + size.value),
  };
}

/** First direct child with this id. */
function findChild(buf: Uint8Array, from: number, to: number, id: number): Element | null {
  let pos = from;
  while (pos < to) {
    const el = readElement(buf, pos);
    if (!el) return null;
    if (el.id === id) return el;
    pos = el.unknownSize ? el.dataStart : el.dataEnd;
    if (pos <= el.headerStart) return null; // no forward progress; bail rather than spin
  }
  return null;
}

function float64(value: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value, false);
  return out;
}

/** Does this blob decode, and does it now report the length we wrote? */
function verify(blob: Blob, seconds: number): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url);
      audio.src = "";
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(false), 1500);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const d = audio.duration;
      done(Number.isFinite(d) && d > 0 && Math.abs(d - seconds) < Math.max(1.5, seconds * 0.25));
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      done(false);
    };
    audio.src = url;
  });
}

/**
 * Return `blob` with its duration written in, or `blob` untouched if that cannot
 * be done safely. Never throws: a take that plays imperfectly beats one we broke.
 */
export async function withDuration(blob: Blob, seconds: number): Promise<Blob> {
  if (!(seconds > 0) || !/webm/i.test(blob.type)) return blob;

  try {
    const buf = new Uint8Array(await blob.arrayBuffer());

    const segment = findChild(buf, 0, buf.length, SEGMENT);
    if (!segment) return blob;
    const info = findChild(buf, segment.dataStart, segment.dataEnd, INFO);
    if (!info || info.unknownSize) return blob;

    const scaleEl = findChild(buf, info.dataStart, info.dataEnd, TIMECODE_SCALE);
    let scaleNs = DEFAULT_SCALE_NS;
    if (scaleEl && scaleEl.size > 0 && scaleEl.size <= 8) {
      scaleNs = 0;
      for (let i = scaleEl.dataStart; i < scaleEl.dataEnd; i += 1) scaleNs = scaleNs * 256 + buf[i];
      if (!(scaleNs > 0)) scaleNs = DEFAULT_SCALE_NS;
    }
    const ticks = (seconds * 1e9) / scaleNs;

    // MediaRecorder does not emit a Duration, but handle the case where it does.
    const existing = findChild(buf, info.dataStart, info.dataEnd, DURATION);
    if (existing && existing.size === 8) {
      const patched = buf.slice();
      patched.set(float64(ticks), existing.dataStart);
      const out = new Blob([patched], { type: blob.type });
      return (await verify(out, seconds)) ? out : blob;
    }
    if (existing) return blob; // an odd width we will not rewrite

    // Splice a Duration in as Info's first child, and grow Info's size to match.
    const duration = new Uint8Array([0x44, 0x89, 0x88, ...float64(ticks)]);
    const infoSize = writeVint(info.size + duration.length);
    const infoIdLength = info.dataStart - info.headerStart - (readVint(buf, info.headerStart + 2, false)?.length ?? 1);
    if (infoIdLength <= 0) return blob;

    const out = new Uint8Array(buf.length + duration.length + (infoSize.length - (info.dataStart - info.headerStart - infoIdLength)));
    let at = 0;
    out.set(buf.subarray(0, info.headerStart + infoIdLength), at);
    at += info.headerStart + infoIdLength;
    out.set(infoSize, at);
    at += infoSize.length;
    out.set(duration, at);
    at += duration.length;
    out.set(buf.subarray(info.dataStart), at);

    const patched = new Blob([out], { type: blob.type });
    return (await verify(patched, seconds)) ? patched : blob;
  } catch {
    return blob;
  }
}
