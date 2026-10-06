# Project: Aura Skincare AI Voice Agent ("Aria")

## Architecture
Full-stack Node.js / Express backend with WebSocket relay proxy to Google Gemini Multimodal Live API (`gemini-3.1-flash-live-preview`), paired with a high-performance Vite + React frontend featuring Web Audio PCM downsampling/playback, real-time Canvas harmonic waveform visualizer, and luxury dark glassmorphism design system.

- **Backend Relay (`server/`)**: Express server hosting WebSocket (`ws`) on `/ws`. Securely manages Gemini API Key, initiates upstream bidirectional WebSocket connection to `generativelanguage.googleapis.com`, handles synchronous tool calling (`get_order_details`), queries in-memory order database, and performs post-call structured summary generation.
- **Frontend SPA (`src/`)**: React 18 application with Web Audio pipeline (`audioRecorder.js` capturing 16kHz 16-bit linear PCM, `audioPlayer.js` scheduling 24kHz 16-bit linear PCM with instant interruption clearing). State machine managing 6 visual states (`Idle`, `Connecting`, `Listening`, `Thinking`, `Speaking`, `Ended`). Canvas audio visualizer, interactive Test Orders helper card with click-to-copy, and post-call transcript & JSON drawer.
- **Unified Deployment**: Express serves static production build from `dist/` on a single port for zero-CORS deployment on Render, while supporting standalone frontend deployment on Vercel via configurable `VITE_WS_URL`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Call Controls | Clear "Start Call" and "End Call" controls with keyboard and click accessibility | M3 | ORIGINAL_REQUEST §R5 |
| 2 | Live Audio Streaming | Real-time browser mic capture (16kHz PCM) and speaker playback (24kHz PCM) | M2 | ORIGINAL_REQUEST §R1 |
| 3 | Sub-Second Latency | Minimal latency audio pipeline with `thinkingLevel: "minimal"` and low-buffer queue | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Aria Persona & Voice | Friendly, professional Indian accent persona with `Sulafat` voice | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Live State Indicator | Visual state badge showing Idle, Connecting, Listening, Thinking, Speaking, Ended | M2, M3 | ORIGINAL_REQUEST §R1 |
| 6 | Reactive Waveform | Canvas-based real-time frequency/time-domain audio visualizer using AnalyserNode | M3 | ORIGINAL_REQUEST §R1 |
| 7 | Tool Calling | Synchronous tool execution for `get_order_details(order_id)` | M1 | ORIGINAL_REQUEST §R2 |
| 8 | Mock Order DB | Database with ORD-101 (Out for delivery), ORD-102 (Delivered 14d), ORD-103 (Processing) | M1 | ORIGINAL_REQUEST §R2 |
| 9 | Invalid Order Handling | Graceful error responses for non-existent, empty, or malformed order IDs | M1 | ORIGINAL_REQUEST §R2 |
| 10 | Shipping Policy | Free >₹499 (₹50 otherwise), 3-5 business days standard delivery | M1 | ORIGINAL_REQUEST §R3 |
| 11 | Return Policy | Within 7 days of delivery for unopened items; reject returns >7 days (ORD-102) | M1 | ORIGINAL_REQUEST §R3 |
| 12 | Cancellation Policy | Only allowed for "Processing" (ORD-103); reject "Shipped"/"Out for Delivery" (ORD-101) | M1 | ORIGINAL_REQUEST §R3 |
| 13 | Out-of-Scope Deflection | Polite declination and redirection for off-topic non-skincare queries | M1 | ORIGINAL_REQUEST §R3 |
| 14 | Chronological Transcript | Complete chronological transcript displaying user and agent utterances | M3 | ORIGINAL_REQUEST §R4 |
| 15 | Structured JSON Summary | Post-call outcome JSON (`customer_intent`, `order_id`, `resolution_status`, `call_summary`) | M1, M3 | ORIGINAL_REQUEST §R4 |
| 16 | Test Orders Helper Card | Quick-reference card for ORD-101, ORD-102, ORD-103 with click-to-copy/fill | M3 | ORIGINAL_REQUEST §R5 |
| 17 | Dark Glassmorphism UI | Luxury aesthetic with backdrop blur, rose quartz/emerald/gold accents | M3 | ORIGINAL_REQUEST §R5 |
| 18 | Production Deployment | Single-port Render configuration, Vercel SPA configuration | M4 | ORIGINAL_REQUEST §R6 |
| 19 | Section 9 Documentation | README with Section 9 architectural questions, setup guide, and `.env.example` | M4 | ORIGINAL_REQUEST §R6 |
| 20 | E2E Testing & Hardening | 5-Tier test suite (85+ tests) passing 100%, and adversarial integrity verification | M5 | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Relay & Tool Engine | Express server, WebSocket relay, Gemini Live integration, mock DB, brand policy, tool calling, summarizer | none | PLANNED |
| M2 | Web Audio Engine & State Hook | PCM 16kHz capture, PCM 24kHz player, instant barge-in interruption, useVoiceAgent hook, 6-state machine | M1 | PLANNED |
| M3 | Luxury UI, Visualizer & Drawer | Canvas visualizer, call controls, state indicators, test orders card, transcript & JSON drawer, glassmorphism CSS | M2 | PLANNED |
| M4 | Production Packaging & README | Single-port static serving, Vercel/Render configs, .env.example, README with Section 9 Q&A | M1, M3 | PLANNED |
| M5 | E2E Testing Track & Audit | Tiers 1-4 test runner pass (100%), Tier 5 adversarial hardening, Forensic Audit verification | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### Client ↔ Backend WebSocket (`/ws`)
- **Client to Server**:
  * `{ type: "audio", pcm: "<base64_pcm16_16khz>" }`
  * `{ type: "end_call" }`
- **Server to Client**:
  * `{ type: "status", state: "connecting" | "listening" | "thinking" | "speaking" | "ended" }`
  * `{ type: "audio", pcm: "<base64_pcm16_24khz>" }`
  * `{ type: "interrupted" }`
  * `{ type: "transcript", role: "user" | "aria", text: string, timestamp: string }`
  * `{ type: "call_outcome", data: { customer_intent: string, order_id: string | null, resolution_status: string, call_summary: string } }`
  * `{ type: "error", message: string }`

### Tool Calling Contract (`get_order_details`)
- **Parameter**: `{ order_id: string }`
- **Success Response**:
  `{ status: "success", order: { id: string, customer_name: string, items: Array<{ name: string, quantity: number, price: number }>, total_amount: number, order_status: "Processing" | "Shipped" | "Out for Delivery" | "Delivered", order_date: string, delivery_date?: string, courier?: string, tracking_number?: string, cancellation_eligible: boolean, return_eligible: boolean, policy_notes: string } }`
- **Error Response**:
  `{ status: "not_found", message: "Order ID not found in database. Please verify the order number." }`

### Structured Call Outcome JSON Schema
```json
{
  "customer_intent": "order_tracking" | "cancellation" | "return_refund" | "shipping_inquiry" | "out_of_scope" | "general_inquiry",
  "order_id": "ORD-101" | "ORD-102" | "ORD-103" | null,
  "resolution_status": "resolved" | "rejected" | "escalated" | "in_progress",
  "call_summary": "string (concise 2-3 sentences)"
}
```

## Code Layout
```
aura-skincare-voice-cx/
├── .env.example
├── README.md
├── package.json
├── vite.config.js
├── tailwind.config.js (or custom CSS)
├── render.yaml
├── vercel.json
├── server/
│   ├── server.js              # Express entry & static serving
│   ├── geminiLiveRelay.js     # WebSocket proxy to Gemini Live API
│   ├── orderDatabase.js       # Mock order records & queries
│   ├── brandPolicy.js         # Aura brand policy rules & guardrails
│   └── summarizer.js          # Post-call outcome JSON generator
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css              # Dark glassmorphism styling & tokens
│   ├── audio/
│   │   ├── audioRecorder.js   # 16kHz 16-bit linear PCM microphone capture
│   │   └── audioPlayer.js     # 24kHz 16-bit linear PCM playback with interruption
│   ├── hooks/
│   │   └── useVoiceAgent.js   # WebSocket, audio pipeline & state coordinator
│   └── components/
│       ├── Header.jsx         # Branding & tagline
│       ├── StateBadge.jsx     # Visual state indicator (6 states)
│       ├── VoiceVisualizer.jsx# Canvas audio waveform / frequency visualizer
│       ├── CallControls.jsx   # Start / End Call action buttons
│       ├── TestOrdersCard.jsx # Helper card with click-to-copy
│       └── TranscriptDrawer.jsx # Post-call transcript & formatted JSON modal
└── tests/
    ├── unit/
    │   ├── orderDatabase.test.js
    │   ├── brandPolicy.test.js
    │   └── audioUtils.test.js
    ├── integration/
    │   └── geminiRelay.test.js
    ├── e2e/
    │   ├── mockGeminiLiveServer.js
    │   └── voiceAgentFlows.test.js
    └── vitest.config.js
```
