import React, { useState } from 'react';
import Header from './components/Header.jsx';
import StatusIndicator from './components/StatusIndicator.jsx';
import AudioVisualizer from './components/AudioVisualizer.jsx';
import CallControls from './components/CallControls.jsx';
import SampleOrders from './components/SampleOrders.jsx';
import TranscriptView from './components/TranscriptView.jsx';
import CallSummary from './components/CallSummary.jsx';
import useVoiceAgent, { CALL_STATES } from './hooks/useVoiceAgent.js';
import { AlertCircle, Sparkles, BookOpen } from 'lucide-react';

export default function App() {
  const {
    callState,
    isCallActive,
    startCall,
    endCall,
    resetCall,
    sendTextMessage,
    toggleMute,
    isMuted,
    transcripts,
    toolEvents,
    callOutcome,
    error,
    getAnalyserNode
  } = useVoiceAgent();

  const [activeTab, setActiveTab] = useState('call'); // 'call' or 'policies'

  const handleSelectPrompt = (promptText) => {
    if (isCallActive) {
      sendTextMessage(promptText);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center justify-between pb-12 selection:bg-rose-500/30 selection:text-white">
      {/* Brand Header */}
      <Header isCallActive={isCallActive} callState={callState} />

      {/* Main Container */}
      <main className="w-full max-w-6xl mx-auto px-4 mt-6 flex flex-col gap-6">
        {/* Error Alert Banner */}
        {error && (
          <div className="w-full p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* Central Voice Stage */}
        <section className="glass-panel p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden">
          {/* Subtle background ambient pulse */}
          <div className="absolute inset-0 bg-gradient-to-b from-rose-500/[0.03] via-transparent to-indigo-500/[0.03] pointer-events-none" />

          {/* Live State Badge */}
          <div className="mb-2">
            <StatusIndicator callState={callState} isMuted={isMuted} />
          </div>

          {/* Real-time Audio Visualizer Orb */}
          <AudioVisualizer
            callState={callState}
            getAnalyserNode={getAnalyserNode}
            isCallActive={isCallActive}
          />

          {/* Call Action Controls */}
          <CallControls
            callState={callState}
            isCallActive={isCallActive}
            startCall={startCall}
            endCall={endCall}
            resetCall={resetCall}
            isMuted={isMuted}
            toggleMute={toggleMute}
            sendTextMessage={sendTextMessage}
          />
        </section>

        {/* Evaluator Helper Card: Mock Orders Database */}
        <SampleOrders onSelectPrompt={handleSelectPrompt} isCallActive={isCallActive} />

        {/* Bottom Split: Live Transcript & Post-Call Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <TranscriptView
            transcripts={transcripts}
            toolEvents={toolEvents}
            callState={callState}
          />

          <CallSummary callOutcome={callOutcome} />
        </div>

        {/* Brand Information & Policy Reference Drawer */}
        <section className="glass-panel p-5 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-semibold text-slate-300 mb-2">
            <BookOpen className="w-4 h-4 text-rose-400" />
            <span>Aura Skincare Policy Reference (Strictly Enforced by Aria)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-white/[0.06]">
            <div>
              <strong className="text-slate-200 block">Shipping:</strong>
              Free above ₹499 (₹50 fee below). Standard 3–5 business days delivery.
            </div>
            <div>
              <strong className="text-slate-200 block">Returns & Refunds:</strong>
              Within 7 days of delivery for unopened products. Damaged goods reported within 48h.
            </div>
            <div>
              <strong className="text-slate-200 block">Cancellations:</strong>
              Permitted ONLY while status is "Processing". Once Shipped/Out for Delivery, cancel is blocked.
            </div>
            <div>
              <strong className="text-slate-200 block">Cash on Delivery (COD):</strong>
              Available for orders up to ₹2,500. Doorstep cash or UPI.
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-slate-500">
        <p>Aura Skincare AI Voice Agent Assessment • DataStraw • Powered by Gemini 3.1 Flash Live</p>
      </footer>
    </div>
  );
}
