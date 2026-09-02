# Accent Studio

Gamified voice-data foundry. Two anonymously-paired players improvise scenes in their native languages; the resulting clean, multi-turn, dual-channel audio is licensed to voice-AI labs.

**Live:** [accentstudio.io](https://accentstudio.io)

## What's in this repo

Static landing surfaces served by Vercel.

| Route | File | Audience |
|---|---|---|
| `/` | `index.html` | Players (waitlist, "how it works", earnings) |
| `/labs` | `labs.html` | AI labs and data buyers (schema, samples, delivery) |
| `/privacy` | `privacy.html` | Privacy policy |
| `/terms` | `terms.html` | Terms of service |
| `/cookies` | `cookies.html` | Cookie policy |

## Deploy

Pushes to `main` auto-deploy to production via Vercel. Preview URLs are generated for every branch and pull request.

## Local preview

Open any `.html` file directly in a browser, or run a static server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Stack (planned)

- **Hosting**: Vercel (static + edge functions)
- **Backend**: Supabase (Postgres, auth, storage, realtime)
- **Audio**: WebRTC for live capture; Supabase Storage → S3 for archival
- **Payouts**: Paystack, Flutterwave, M-Pesa, Stripe Connect, USDC
