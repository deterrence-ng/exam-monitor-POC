# LiveKit Exam Monitor — Implementation Guide

A step-by-step guide to integrating the LiveKit exam proctoring system into your existing Next.js application.

> **POC mode:** This guide is written for a local proof-of-concept — no VPS, no Docker, no auth. LiveKit is already installed on your machine and runs in `--dev` mode.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Start LiveKit Locally](#2-start-livekit-locally)
3. [Next.js — Install Packages](#3-nextjs--install-packages)
4. [Environment Variables](#4-environment-variables)
5. [File Integration](#5-file-integration)
6. [Strip Auth (POC)](#6-strip-auth-poc)
7. [Simulate Multiple Candidates](#7-simulate-multiple-candidates)
8. [Room Management Strategy](#8-room-management-strategy)
9. [Testing](#9-testing)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

**Your Next.js app:**
- Next.js 13+ with the App Router (`app/` directory)
- Node.js 18+

**LiveKit:**
- `livekit-server` binary installed on your machine
- Verify with: `livekit-server --version`

---

## 2. Start LiveKit Locally

Run LiveKit in dev mode — this is your entire backend:

```bash
livekit-server --dev
```

`--dev` mode automatically:
- Uses `devkey` / `devsecret` as the built-in API key/secret pair
- Runs on port `7880`
- Skips the need for a config file or Redis

Leave this terminal running while you develop. You should see:

```
INFO LiveKit server starting
INFO server listening {"addr": ":7880"}
```

---

## 3. Next.js — Install Packages

In your existing Next.js project root:

```bash
npm install livekit-client livekit-server-sdk
```

| Package | Used For |
|---|---|
| `livekit-client` | Browser SDK — publishing tracks, subscribing, data messages |
| `livekit-server-sdk` | Server SDK — token generation, `RoomServiceClient` for updating permissions |

---

## 4. Environment Variables

Create `.env.local` in your Next.js project root:

```env
# LiveKit running locally in --dev mode
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

Restart your Next.js dev server after creating this file — env vars are only picked up on startup.

---

## 5. File Integration

Copy the scaffold files into your Next.js project, preserving the directory structure exactly:

```
your-nextjs-app/
├── app/
│   ├── api/
│   │   └── livekit/
│   │       ├── token/
│   │       │   └── route.ts       ← copy here
│   │       └── permissions/
│   │           └── route.ts       ← copy here
│   └── exam/
│       ├── monitor/
│       │   └── [roomId]/
│       │       └── page.tsx       ← copy here
│       └── candidate/
│           └── [roomId]/
│               └── page.tsx       ← copy here
└── lib/
    └── livekit.ts                 ← copy here
```

After copying, your routes will be live at:

- `/exam/monitor/[roomId]` — monitor dashboard
- `/exam/candidate/[roomId]` — candidate exam view

---

## 6. Strip Auth (POC)

Since this is a POC, remove all session/guard logic from both API routes so they respond immediately without authentication.

### 6a. Token route

In `app/api/livekit/token/route.ts`, the handler should just validate the fields and issue the token — delete any session checks:

```ts
export async function POST(req: NextRequest) {
  const { room, identity, role, displayName } = await req.json();

  if (!room || !identity || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Issue token directly — no auth check for POC
  const at = new AccessToken(API_KEY, API_SECRET, { identity, name: displayName || identity, ttl: "4h" });
  // ... rest of grant logic unchanged
}
```

### 6b. Permissions route

In `app/api/livekit/permissions/route.ts`, remove the session check and go straight to `updateParticipant`:

```ts
export async function POST(req: NextRequest) {
  const { room, candidateIdentity, grantMic } = await req.json();

  if (!room || !candidateIdentity || typeof grantMic !== "boolean") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Call LiveKit directly — no auth check for POC
  await svc.updateParticipant(room, candidateIdentity, undefined, { ... });
}
```

---

## 7. Simulate Multiple Candidates

Since there's no auth, use a URL query param to give each browser tab a unique candidate identity.

In `app/exam/candidate/[roomId]/page.tsx`, read the name from the URL:

```ts
"use client";
import { useSearchParams } from "next/navigation";

// Inside your component:
const searchParams = useSearchParams();
const candidateIdentity = searchParams.get("name") ?? "candidate-1";
const displayName = candidateIdentity;
```

The monitor identity can stay hardcoded:

```ts
const monitorIdentity = "monitor-1";
```

---

## 8. Room Management Strategy

For the POC, any string works as a room ID — just type one into the URL. LiveKit creates rooms automatically on first join and cleans them up when empty.

Use the same room ID in all tabs to connect them together:

- `http://localhost:3000/exam/monitor/my-test-room`
- `http://localhost:3000/exam/candidate/my-test-room?name=alice`
- `http://localhost:3000/exam/candidate/my-test-room?name=bob`
- `http://localhost:3000/exam/candidate/my-test-room?name=charlie`

When you move to production, use a compound room ID that ties to your exam session in the database, e.g. `exam_maths2026_sessionA`, and verify room membership before issuing tokens.

---

## 9. Testing

Open the following tabs in your browser — Chrome is recommended as it handles multiple `getUserMedia` streams most reliably.

**Terminal 1** — LiveKit server:
```bash
livekit-server --dev
```

**Terminal 2** — Next.js app:
```bash
npm run dev
```

**Browser tabs:**
- Monitor: `http://localhost:3000/exam/monitor/test-room`
- Candidate 1: `http://localhost:3000/exam/candidate/test-room?name=alice`
- Candidate 2: `http://localhost:3000/exam/candidate/test-room?name=bob`

**Things to verify:**
- Candidate camera and screen share appear in monitor grid
- Monitor can send a chat message to a specific candidate and receive a reply
- Candidate mic is locked by default (mic button disabled)
- Monitor clicks "Grant Mic" → candidate mic button becomes active → candidate can unmute
- Monitor clicks "Revoke Mic" → candidate mic is force-muted and locked again

> Camera access works over `http://localhost` in Chrome and Firefox without HTTPS. It will not work on any other plain HTTP hostname.

---

## 10. Troubleshooting

**Camera/mic not starting**
Confirm you are on `http://localhost` and not `http://127.0.0.1` or any other hostname — browsers only allow `getUserMedia` on `localhost` without HTTPS.

**"Failed to fetch token" error**
Your `.env.local` variables may not be loaded. Restart the Next.js dev server (`Ctrl+C` then `npm run dev`) after creating or editing `.env.local`.

**Candidate video not appearing on monitor**
Check the browser console on both tabs for LiveKit errors. Confirm the candidate and monitor joined the same room ID (case-sensitive). Also verify the candidate token includes `"camera"` in `canPublishSources`.

**Mic grant has no effect**
The `updateParticipant` call references room name and candidate identity — both are case-sensitive and must exactly match what was used in the token. Add a `console.log` in the permissions route to confirm the values match.

**LiveKit server not responding**
Make sure `livekit-server --dev` is still running in its terminal. It does not run as a background service in `--dev` mode — closing the terminal stops it.
