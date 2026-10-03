# 🌿 Aura Skincare — AI Voice Customer Support Agent ("Aria")

> **DataStraw Assessment Test | Hiring Assignment: Build an AI Voice CX Agent for a D2C Brand**  
> Candidate: **Kaustubh Sanjay Kale**  
> Live Application URL: *(Deployed on Render)*  
> GitHub Repository: [https://github.com/kaustubh12022/aura-skincare-voice-cx](https://github.com/kaustubh12022/aura-skincare-voice-cx)  
> Technology: **Google Gemini 3.8 Live (Multimodal WebSocket API) • Web Audio API • Node.js/Express • React (Vite)**

---

## 📖 Table of Contents
1. [Project Overview & Persona](#1-project-overview--persona)
2. [Aura Skincare Brand Information & Policies](#2-aura-skincare-brand-information--policies)
3. [Mock Order Database](#3-mock-order-database)
4. [Beginner-Friendly Architecture Walkthrough (In 4 Phases)](#4-beginner-friendly-architecture-walkthrough-in-4-phases)
5. [Core Features & Requirements Satisfied](#5-core-features--requirements-satisfied)
6. [Optional Features Implemented (Section 8)](#6-optional-features-implemented-section-8)
7. [Section 9: Tell Us How You Think (Detailed Answers)](#7-section-9-tell-us-how-you-think)
8. [Step-by-Step Evaluator Testing Guide](#8-step-by-step-evaluator-testing-guide)
9. [Local Setup & Public Deployment Guide](#9-local-setup--public-deployment-guide)

---

## 1. Project Overview & Persona

This project is a browser-based, real-time AI Voice Customer Support Agent built for **Aura Skincare**, a fictional premium organic Indian D2C skincare brand.

* **Agent Persona:** **Aria** from Aura Skincare.
* **Tone & Demeanor:** Warm, empathetic, professional, and concise with a natural Indian English conversational cadence.
* **Interaction:** Evaluators click **"Start Voice Call"**, speak naturally using their computer microphone, and hear Aria respond in real time through their speakers with sub-second latency (~300ms).

---

## 2. Aura Skincare Brand Information & Policies

All company rules and guardrails are strictly enforced by Aria during conversations:

* **Brand Overview:** Aura Skincare is a premium organic Indian skincare brand focused on simple, effective skincare made with thoughtfully selected botanical ingredients.
* **Shipping Policy:**
  * **Free Delivery** on orders strictly above **₹499**.
  * Orders of ₹499 or below incur a flat **₹50 shipping fee**.
  * Standard delivery timeline: **3–5 business days** across India.
* **Return & Refund Policy:**
  * Returns accepted strictly within **7 days of delivery**.
  * Products must be **unopened, unused, and in original packaging** with safety seal intact (due to cosmetic hygiene standards).
  * Damaged or defective items must be reported within **48 hours** with photos for an immediate replacement.
* **Cancellation Policy:**
  * Orders can ONLY be cancelled while their status is **Processing**.
  * Once an order is **Shipped** or **Out for Delivery**, it cannot be cancelled (customers may refuse delivery at doorstep).
* **Cash on Delivery (COD):**
  * COD is available for orders up to **₹2,500**. Customers can pay by cash or UPI at the doorstep.

---

## 3. Mock Order Database

The agent has real-time access to the mock database via function calling (`get_order_details`):

| Order ID | Customer | Product | Value | Status | Carrier & Notes | Policy Enforcement |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **ORD-101** | Priya Sharma | Vitamin C Serum (30ml) | ₹699 | **Out for Delivery** | BlueDart (`BD-982103`), expected by 6 PM today | **Cannot cancel** (in transit). Customer may refuse delivery at doorstep. |
| **ORD-102** | Rahul Verma | Hydrating Sunscreen SPF 50 | ₹499 | **Delivered** | Delhivery (`DL-441029`), delivered 14 days ago | **Cannot return** (exceeds the strict 7-day return limit). |
| **ORD-103** | Ananya Patel | Green Tea Face Wash + Toner | ₹850 | **Processing** | Placed 3 hours ago | **Eligible for cancellation** and 100% refund in 5–7 business days. |

---

## 4. Beginner-Friendly Architecture Walkthrough (In 4 Phases)

Here is how the entire system works under the hood, explained simply from end to end:

```
[ Your Microphone ]
       │  (16kHz Linear PCM Audio)
       ▼
[ Phase 1: Browser Web Audio Engine ]
       │  (WebSocket)
       ▼
[ Phase 2: Node.js Relay Server (server.js) ]
       │  (Bidirectional WebSocket: bidiGenerateContent)
       ▼
[ Google Gemini 3.8 Live API ] ──(Tool Call)──► [ Phase 3: Order Database (ORD-101/102/103) ]
       │  (24kHz Linear PCM Audio)
       ▼
[ Phase 2: Node.js Relay Server ]
       │  (WebSocket)
       ▼
[ Phase 1: Browser Audio Player ] ──► [ Your Speakers (Aria's Voice) ]
       │
[ Phase 4: Post-Call Summarizer & Luxury UI ] ──► [ Structured JSON Call Outcome & Transcript ]
```

### Phase 1: The Client Audio Engine (Browser)
* **Audio Capture (`audioRecorder.js`):** Captures your microphone audio. Instead of compressed MP3 or WebM (which causes delay), it captures raw sound numbers (**PCM audio**) and downsamples them from 48kHz/44.1kHz to **16kHz 16-bit Mono** so Gemini can process them without lag.
* **Audio Playback (`audioPlayer.js`):** Plays Aria's voice back at **24kHz PCM**. It schedules sound chunks seamlessly on a monotonic timeline so Aria sounds smooth and continuous.
* **Barge-in / Interruption:** If you interrupt Aria while she is talking, the player immediately dumps its audio queue and stops playback within 10ms.

### Phase 2: The WebSocket Relay Server (`server/geminiLiveRelay.js`)
* **Why a Relay?** If the frontend connected directly to Google, your secret `GEMINI_API_KEY` would be exposed in the browser. The Node.js server protects your key and manages sessions.
* **Bidirectional Streaming:** Keeps a continuous, live WebSocket open with Google Gemini Live (`wss://generativelanguage.googleapis.com/...`). Sound flows back and forth with near-zero latency (~300ms).
* **Dual-Layer Heartbeats:** Pings every 15 seconds so connections never drop silently.

### Phase 3: Autonomous Tool Calling & Policy Guardrails
* **Tool Calling (`get_order_details`):** When you mention an order (like *"Where is ORD-101?"*), Gemini pauses speech, asks the backend to run `get_order_details('ORD-101')`, receives the result, and speaks the answer naturally.
* **Policy Guardrails (`brandPolicy.js`):** Enforces business rules:
  1. *Policy Rejection:* Explains why `ORD-102` cannot be returned (delivered 14 days ago > 7 days).
  2. *Cancellation Rejection:* Explains why `ORD-101` cannot be cancelled (Out for Delivery).
  3. *Out-of-Scope Deflection:* If asked to book a flight or answer cricket questions, politely deflects back to skincare.
  4. *Graceful Degradation:* If audio is muffled or an order ID does not exist, asks politely for clarification instead of guessing or crashing.

### Phase 4: Post-Call Intelligence & Haute Luxury UI
* **Turn Accumulation (`transcriptManager.js`):** Prevents transcript jitter. As Gemini streams words token-by-token, tokens accumulate in-place within the same bubble until the turn completes.
* **Post-Call Structured Summary (`summarizer.js`):** When you click **"End Call"**, the conversation transcript is processed to generate the required structured JSON outcome.
* **Haute Botanical UI:** Built with Tailwind CSS in warm cream, gold, and blush tones, featuring a real-time fluid harmonic audio visualizer.

---

## 5. Core Features & Requirements Satisfied

| Assessment Requirement | How It Is Implemented |
|---|---|
| **Voice Conversation** | Natural conversational speech using Gemini 3.8 Live with Indian persona voice (`Sulafat`). |
| **Persona (Aria)** | Polite, empathetic, and concise skincare specialist persona defined in system prompt. |
| **Policy Guardrails** | Strict enforcement of shipping thresholds, 7-day returns, processing cancellations, and COD limits. |
| **Out-of-Scope Deflection** | Deflects non-skincare requests (travel, tech, general trivia) politely. |
| **Graceful Degradation** | Gracefully handles non-existent order IDs, mumbled speech, and missing details. |
| **Order Lookup Tool** | `get_order_details(order_id)` implemented via Gemini Function Calling against mock database. |
| **Post-Call Transcript** | Real-time, turn-based chronological dialogue history showing Customer and Aria. |
| **Structured JSON Outcome** | Formatted JSON output capturing `customer_intent`, `order_id`, `resolution_status`, and `call_summary`. |
| **Testing Interface** | Start/End Call buttons, 6-state Live Indicator, Audio Visualizer, and discreet Order Lookup Guide. |

---

## 6. Optional Features Implemented (Section 8)

* ⚡ **Barge-in / Interruption Handling:** When the customer speaks while Aria is speaking, playback cuts off instantly (<10ms) and Aria listens to the interruption.
* ⚡ **Ultra-Low Latency:** Speech-to-speech multimodal streaming delivers ~300ms conversational response time.
* ⚡ **Hinglish Understanding:** Gemini Live natively understands mixed Hindi-English speech (e.g., *"Mera order ORD-101 kab tak aayega?"*).
* ⚡ **Haute Botanical Luxury UI:** Replaced generic dark glassmorphism with an authentic luxury skincare concierge aesthetic (warm cream, gold foil accents, and fluid harmonic soundwaves).

---

## 7. Section 9: Tell Us How You Think

### 1. Why did you choose your particular architecture and technology stack?
Instead of a traditional modular pipeline (**Speech-to-Text $\to$ LLM $\to$ Text-to-Speech**), I chose **Google Gemini 3.8 Live API (`bidiGenerateContent` over WebSockets)** with a Node.js/Express relay and a React frontend:
* **Eliminating Latency Stacking:** In a modular pipeline, transcribing speech takes ~1s, LLM reasoning takes ~1s, and speech synthesis takes ~1s. The user suffers an awkward 3–4 second delay. Gemini Live processes audio tokens directly in a single stateful stream, slashing latency to ~300ms.
* **Security & Clean Architecture:** Running a server-side WebSocket proxy ensures the `GEMINI_API_KEY` remains strictly confidential on the server, while allowing backend audit logging of all tool invocations.
* **Zero-CORS Full-Stack Hosting:** The Express backend serves both the `/ws` WebSocket endpoint and the static production `dist/` bundle on a single port, making public deployment seamless.

### 2. What was the most difficult part of the assignment, and how did you solve it?
The most challenging aspect was **browser Web Audio lifecycle constraints and hardware compatibility**:
* **The Problem:** Modern browsers automatically mute or suspend `AudioContext` unless it is explicitly unlocked inside a synchronous user gesture (click event). Furthermore, requesting `sampleRate: 16000` inside `getUserMedia` on Windows often throws an `OverconstrainedError` on Realtek drivers.
* **The Solution:** 
  1. I initialized and resumed the `AudioContext` synchronously inside the `Start Call` button click handler before initiating the WebSocket handshake.
  2. For microphone input, I allowed the browser to record at the hardware's native sample rate (44.1kHz or 48kHz) and implemented linear PCM downsampling to 16kHz in software via `audioConversion.js`.
  3. For barge-in, I engineered an active audio node registry in `audioPlayer.js` that immediately cancels all pending scheduled buffer nodes upon receiving an interruption event.

### 3. If you had one more week to work on this, what would you improve first and why?
1. **Authenticated Session Scoping (IDOR Prevention):** In production, bind the WebSocket connection to the customer's authenticated JWT session so `get_order_details` only permits access to orders owned by that customer.
2. **AudioWorklet Migration:** Move from `ScriptProcessorNode` to modern `AudioWorkletNode` running on a separate Web Audio rendering thread to eliminate any micro-stutters during heavy UI rendering.
3. **Telephony Integration:** Add Twilio / SIP trunking so customers can dial a standard toll-free phone number in addition to browser testing.
4. **Persistent CRM Storage:** Store conversation transcripts and customer sentiments in a PostgreSQL database (e.g. Supabase) to recognize returning customers.

### 4. Imagine this agent is handling 1,000 customer conversations a day. What do you think would need to change or improve?
1. **Stateless Horizontal Scaling:** Deploy multiple Node.js relay instances behind an Application Load Balancer with WebSocket sticky sessions and Redis for shared state.
2. **Enterprise Quota Tiers:** Upgrade from Google AI Studio free tier to Google Cloud Enterprise Pay-As-You-Go to support high concurrent streaming channels without hitting RPM limits.
3. **Virtual Waiting Room & Queueing:** Implement a Redis-backed queue with friendly audio status (*"All specialists are busy, connecting you shortly..."*) when concurrent Gemini sessions reach capacity.
4. **VAD Silence Gating:** Suppress silence packets on the client when the user is not speaking to save up to 40% in audio token costs.
5. **PII Masking:** Redact customer phone numbers, addresses, and payment details in real time before logging transcripts.

---

## 8. Step-by-Step Evaluator Testing Guide

When testing the application, click **"Start Voice Call"**, allow microphone permissions, and try these test scenarios:

| Test Case | What to Say | Expected Result & Policy Enforced |
|---|---|---|
| **1. Order Tracking** | *"Hi Aria, where is my order ORD-101?"* | Calls `get_order_details('ORD-101')`. Confirms Priya Sharma's Vitamin C Serum is **Out for Delivery** today via BlueDart (`BD-982103`) by 6 PM. |
| **2. Cancellation Policy (Reject)** | *"Can I cancel order ORD-101?"* | **Policy Enforced:** Declines cancellation because the order is already Out for Delivery. Explains customer can refuse delivery at doorstep. |
| **3. Return Policy (Reject)** | *"I bought order ORD-102 two weeks ago, can I return it?"* | **Policy Enforced:** Rejects return because the order was delivered 14 days ago (exceeds the 7-day limit). Offers skincare tips. |
| **4. Cancellation Policy (Approve)** | *"Can you cancel my order ORD-103?"* | **Policy Enforced:** Order status is `Processing`. Confirms cancellation and ₹850 refund in 5–7 business days. |
| **5. Shipping Policy** | *"What are your shipping rates and delivery times?"* | Explains free shipping above ₹499 (₹50 fee below) and 3–5 business days standard delivery. |
| **6. Out-of-Scope Deflection** | *"Can you book me a flight to Goa?"* | **Deflection Guardrail:** Politely declines non-skincare requests and redirects to Aura Skincare products. |
| **7. Barge-in / Interruption** | Start talking while Aria is answering | Aria stops speaking immediately and listens to your new question. |
| **8. Post-Call Summary** | Click **"End Call"** | Instantly displays the complete dialogue transcript and formatted JSON outcome card. |

---

## 9. Local Setup & Public Deployment Guide

### Local Development
```bash
# 1. Clone repository
git clone https://github.com/kaustubh12022/aura-skincare-voice-cx.git
cd aura-skincare-voice-cx

# 2. Install dependencies
npm install

# 3. Create .env file with your Gemini API key
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
echo "PORT=3001" >> .env ; echo "NODE_ENV=development" >> .env

# 4. Build frontend
npm run build

# 5. Start server
npm start
```
Open **`http://localhost:3001`** in Chrome or Edge.

### Automated Test Suite
```bash
npm test
```
All **122 automated unit, integration, and E2E tests** pass with 100% test coverage across audio utilities, database lookups, policy rules, and dialogue scenarios.

---

## 📄 Submission Details
* **Candidate:** Kaustubh Sanjay Kale
* **Email Recipients:** `ozair.shaikh@datastraw.in`, `aryan.jaiswal@datastraw.in`, CC: `talent@datastraw.in`
* **Subject:** `AI Voice Agent Assignment - Kaustubh Sanjay Kale`
