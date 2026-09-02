# Accent Studio · Integration Roadmap

The prototype at `/studio?proto` is all screens, no backend. This doc maps every
flow to the real service it needs, a recommended provider, and the order to wire
them. It's the checklist for the "set up accounts + connect APIs" phase.

Backend is Supabase (already provisioned, ref `uazcoxinsnkjjogfovlg`). The real
auth app lives at `/studio` (magic link + allowlist + onboarding + Home shell).
Prototype screens get promoted into the real app one flow at a time.

---

## 0 · Accounts to create (the shopping list)

| Service | Purpose | Notes |
|---|---|---|
| **Supabase** | DB, auth, storage, realtime | Done. Add tables per §Data model below. |
| **Resend** (or Postmark) | Transactional email | Magic links today go through Supabase's built-in mail; move to Resend for deliverability + branded templates. |
| **Smile Identity** or **Dojah** | KYC: ID verification + liveness | Both are Africa-first (NIN, BVN, passport, driver's license across NG/KE/ZA/GH). Dojah has the widest NG coverage; Smile ID strongest for liveness + pan-African. |
| **Documenso** (self-host/OSS) or **Dropbox Sign** API | E-signature of the agreements | For our consent model we mostly need a hashed acceptance event, not a full DocuSign flow — see §Onboarding. A lightweight signature + our own SHA-256 consent log may suffice at first. |
| **Deepgram** or **AssemblyAI** (or self-host Whisper) | First-pass STT + diarization | Deepgram has strong multilingual + fast streaming; both do diarization. For low-resource dialects, fine-tuned Whisper (self-host) will beat them — start with a hosted API, swap later. |
| **LiveKit** (cloud or self-host) | Live Arena: SFU + dual-track recording | The PRD's real-time media layer. LiveKit Cloud to start. |
| **Paystack** + **Flutterwave** | West Africa payouts | Paystack Transfers / Flutterwave Transfers. |
| **M-Pesa Daraja** (Safaricom) | East Africa payouts | B2C API. Needs a registered paybill/shortcode. |
| **Stripe Connect** + **PayPal Payouts** | UK/EU/US payouts | Stripe Connect Express for contractors. |
| **Circle** or on-chain (USDC on Polygon/Solana) | Crypto payouts | Optional, lowest minimum. |
| **AWS** (S3 + KMS + optionally Clean Rooms) | Delivery + WORM vault + presigned URLs | Or Cloudflare R2 for cheaper egress; S3 needed for Clean Rooms. |
| **Sentry** | Error tracking | Strip sourcemaps from public bundle. |

---

## 1 · Apply flow → screens `apply-*`

| Screen | Needs | How |
|---|---|---|
| apply-intro | — | static |
| apply-form | write applicant row | Supabase table `applications` (locale, region, age_band, gender, motivation, referral, status). |
| apply-voice | upload voice sample | Supabase Storage bucket `applications/{id}/sample.webm` via MediaRecorder → signed upload. |
| apply-motivation / submitted | submit + email | Set `applications.status = 'submitted'`; Resend confirmation email. |

**Autonomy note:** MediaRecorder capture is browser-native — the recording UI can be
wired before any paid API. Storage is Supabase (already have it).

---

## 2 · Interview flow → screens `interview-*`, `decision-*`

| Screen | Needs | How |
|---|---|---|
| interview-invite/brief | gate on `applications.status='invited'` | Manual or rule-based promotion from submitted → invited. |
| interview-tasks | record 3 takes, upload | MediaRecorder → Storage `interviews/{id}/task{n}.webm`. |
| interview-submitted | status → `in_review` | Supabase. |
| decision-* | reviewer sets outcome | Internal review tool (can be a Supabase table + a simple admin view) sets `accepted / waitlisted / rejected`; email via Resend; on accept, create the creator profile + flip allowlist. |

**Reviewer tooling** is internal — a minimal admin page listing pending interviews
with the audio players. Build after the creator side.

---

## 3 · Onboarding / compliance → screens `onb-*`, `kyc-*`, `docs-*`, `payout-setup`

| Screen | Needs | Provider |
|---|---|---|
| onb-profile | write profile | Supabase `profiles` (exists). |
| kyc-id-intro/capture/selfie | ID + liveness verification | **Smile Identity** or **Dojah** SDK. Their widget handles capture + liveness; we store only the pass/fail + a reference token, never the raw ID (keeps us out of PII-storage scope for the images). |
| kyc-review | poll verification result | Provider webhook → Supabase `kyc_checks` (status, provider_ref). |
| docs-sign | record consent acceptance | **Our own consent log is the core.** On accept: compute SHA-256 of each agreement's exact text, insert a `consent_events` row (user_id, agreement versions, terms_hash, ip_hash, ts, action). Optionally also push to Documenso/Dropbox Sign for a countersigned PDF. The hashing + log we can build with zero third-party. |
| payout-setup | store payout method | Supabase `payout_methods` (rail, detail encrypted). Validate rail-specific formats. Tokenize/verify with the payout provider before first cashout. |

**Consent is the compliance backbone** (PRD §8, VDR). The `consent_events` table +
SHA-256 hashing is buildable immediately and needs no vendor. It's the single most
important thing to get right and it's fully in our control.

---

## 4 · Game → screens `home`, `volley-*`, `arena-*`, `cutting-room-*`

| Screen | Needs | Provider |
|---|---|---|
| home | read profile, AP, goals | Supabase. |
| volley-record | record take + upload | MediaRecorder → Storage `takes/{user}/{take}.webm`; row in `takes`. |
| volley-rate | fetch a peer take, write rating | Supabase `ratings` (exists). Below-4 → set take `status='redo'`. |
| arena-lobby | matchmaking (blind duet) | Supabase Realtime presence + a matchmaking function (Edge Function) that pairs strangers by locale, excluding acquaintances. |
| arena-scene | live dual-track audio + transcript | **LiveKit** room per scene, server-side egress recording to per-speaker tracks; twist injection via Realtime broadcast; live transcript from streaming STT. |
| arena-result | chemistry score, AP | Compute from the session; write `ap_ledger`. |
| cutting-room-queue/verify | fetch takes needing verify, save correction | Supabase; correction updates `takes.verified_text`. |
| cutting-room-align | **word-alignment matching** → save alignment | New `alignments` table (session/turn, src_span, tgt_span, type, confidence, reviewer). This is the Tier-4 Aligned Corpus data — high value. The matching UI is done; it just needs to persist the pairs. |

**AP ledger** (`ap_ledger`, exists) is the economic spine — every earn/spend writes
a row; balance is the sum. Wire this early so the numbers are real.

---

## 5 · Economy → screens `wallet`, `cashout`, `ledger`

| Screen | Needs | Provider |
|---|---|---|
| wallet/ledger | sum `ap_ledger`, list rows | Supabase. |
| cashout | initiate payout | Route by rail: Paystack/Flutterwave Transfer (WA), M-Pesa Daraja B2C (EA), Stripe Connect/PayPal Payouts (UK/EU/US), Circle/on-chain (crypto). Debit AP in the same transaction; reconcile on webhook. |

Payout minimums + the QA multiplier are already modelled in the UI. Wire one rail
end-to-end first (Paystack or M-Pesa depending on launch market).

---

## 6 · Account → screens `profile`, `progression`, `my-documents`, `consent-center`, `data-privacy`

| Screen | Needs |
|---|---|
| profile/progression | read stats, trust score, rank thresholds | Supabase; rank from AP totals. |
| my-documents | list signed agreements + hashes | From `consent_events`; render/download the versioned PDF. |
| consent-center | toggle + revoke (prospective) | Update consent flags; withdrawal sets a flag that stops new collection. |
| data-privacy | export / erasure requests | Export = zip of the user's rows + audio; erasure = delete identity-vault row, keep anonymized data (per agreement §12). |

---

## 7 · Delivery / Foundry → screens `foundry-*`, `session-detail`, `pipeline-stages`, `manifest-view`, `package-build`, `consent-audit`, `delivery-receipt`

Internal/ops. Mostly a pipeline of jobs over the data we already collect.

| Stage | Needs | Provider |
|---|---|---|
| Capture | dual-channel WAV | From Arena (LiveKit egress) + Volley uploads. |
| Transcribe / diarize | STT | Deepgram/AssemblyAI or self-host Whisper. |
| PII scan | NER redaction | Presidio (OSS) or a hosted NER; replace spans with synthetic tokens. |
| Verify | human editor | Cutting Room (already built). |
| Align | word-level | Cutting Room matching (already built) + optional auto-aligner (awesome-align) pre-fill. |
| Package | WAV+JSONL+Parquet+consent+license+SHA256 | A build job (Edge Function or worker) that assembles the bundle and writes checksums. |
| Deliver | presigned S3 / clean room | AWS S3 presigned URLs (TLS 1.3, IP allow-list, TTL) or AWS Clean Rooms / Snowflake for enterprise. |

The manifest schema is already defined (see the sample delivery PDF and
`manifest-view`). The packaging job is deterministic once the data is in Postgres +
Storage.

---

## Data model additions (Supabase)

Already present: `profiles`, `prompts`, `takes`, `ratings`, `ap_ledger`,
`email_allowlist`, `consent` bits, `takes` storage bucket.

Add:
- `applications`, `interviews` (+ storage buckets for their audio)
- `kyc_checks` (provider_ref, status)
- `consent_events` (user_id, agreements[], terms_hash, ip_hash, ts, action)
- `payout_methods`, `payouts` (rail, amount, provider_ref, status)
- `alignments` (session, turn, src_span, tgt_span, type, confidence)
- `corpora`, `corpus_sessions`, `deliveries` (buyer, license, bundle_sha256, status)

RLS everywhere; the allowlist gate already exists. Payout/KYC/identity columns must
be non-client-writable (server/service-role only), like we did for
`is_allowlisted`/`ap_balance`.

---

## Recommended wiring order

1. **Consent log + hashing** (no vendor, highest compliance value)
2. **MediaRecorder capture + Storage upload** (no vendor) — turns Volley + Apply real
3. **AP ledger reads/writes** — makes the economy real
4. **KYC provider** (Smile ID / Dojah) — unblocks real onboarding
5. **One payout rail** end-to-end (launch market: Paystack or M-Pesa)
6. **STT + PII redaction** on captured audio — starts the foundry
7. **LiveKit Arena** — the hardest, most impressive; do last
8. **Packaging + S3 delivery** — closes the loop to revenue

Everything above the KYC line can be built without spending a naira. The prototype
screens are the exact UI; wiring is swapping local state for Supabase calls.
