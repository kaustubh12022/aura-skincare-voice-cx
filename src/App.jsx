import React, { useState } from 'react';
import Header from './components/Header.jsx';
import StatusIndicator from './components/StatusIndicator.jsx';
import AudioVisualizer from './components/AudioVisualizer.jsx';
import CallControls from './components/CallControls.jsx';
import SampleOrders from './components/SampleOrders.jsx';
import TranscriptView from './components/TranscriptView.jsx';
import CallSummary from './components/CallSummary.jsx';
import useVoiceAgent, { CALL_STATES } from './hooks/useVoiceAgent.js';
import { AlertCircle, Sparkles, BookOpen, ShieldCheck, Sparkle } from 'lucide-react';

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

  const handleSelectPrompt = (promptText) => {
    if (isCallActive) {
      sendTextMessage(promptText);
    }
  };

  const latestTurn = transcripts && transcripts.length > 0 ? transcripts[transcripts.length - 1] : null;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#334155] flex flex-col items-center justify-between pb-12 selection:bg-[#FDF2F4] selection:text-[#A9525B]">
      {/* Brand Header */}
      <Header isCallActive={isCallActive} callState={callState} />

      {/* Main Container */}
      <main className="w-full max-w-6xl mx-auto px-4 mt-6 flex flex-col gap-6">
        {/* Error Alert Banner */}
        {error && (
          <div className="w-full p-4 rounded-2xl bg-[#FFF1F2] border border-[#FFE4E6] text-[#BE123C] text-sm flex items-center gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-[#E11D48]" />
            <p className="flex-1 font-medium">{error}</p>
          </div>
        )}

        {/* Main Grid: Voice Stage (Left) & Live Transcripts/Summary (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Central Voice Stage & Direct Subtitle View */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            <section className="glass-panel p-6 flex flex-col items-center text-center relative overflow-hidden shadow-xs">
              {/* Live State Badge */}
              <div className="mb-2">
                <StatusIndicator callState={callState} isMuted={isMuted} />
              </div>

              {/* Real-time Fluid Harmonic Soundwave Visualizer */}
              <AudioVisualizer
                callState={callState}
                getAnalyserNode={getAnalyserNode}
                isCallActive={isCallActive}
              />

              {/* Central Live Caption / Subtitle Banner - Directly visible where user talks */}
              {latestTurn ? (
                <div className="w-full my-2 p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE5DC] text-left transition-all shadow-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${latestTurn.role === 'aria' ? 'text-[#C86D76]' : 'text-[#15803D]'}`}>
                      {latestTurn.role === 'aria' ? '🌸 Aria (Speaking)' : '👤 You (Spoken)'}
                    </span>
                    {!latestTurn.isFinal && (
                      <span className="text-[10px] text-[#A8A29E] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C86D76] animate-ping" /> Live
                      </span>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-[#1C1917] leading-relaxed">
                    {latestTurn.text}
                    {callState === CALL_STATES.SPEAKING && latestTurn.role === 'aria' && !latestTurn.isFinal && (
                      <span className="inline-block w-1.5 h-3 bg-[#C86D76] ml-1 animate-pulse align-middle" />
                    )}
                  </p>
                </div>
              ) : isCallActive ? (
                <p className="text-xs text-[#78716C] italic my-2">
                  Listening... Speak naturally or select a quick query below.
                </p>
              ) : (
                <p className="text-xs text-[#78716C] my-2">
                  Click "Start Voice Call" to talk with Aria about orders, returns, and skincare routines.
                </p>
              )}

              {/* Call Action Controls */}
              <div className="w-full mt-1">
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
              </div>

              {/* Quick Prompt Testing Chips */}
              <div className="w-full mt-3 pt-3 border-t border-[#EBE5DC]/80 flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[11px] text-[#78716C] mr-1">Quick prompts:</span>
                <button
                  type="button"
                  onClick={() => handleSelectPrompt('Where is my order ORD-101?')}
                  disabled={!isCallActive}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white hover:bg-[#FDF2F4] border border-[#EBE5DC] hover:border-[#F1C2CA] text-[#44403C] hover:text-[#A9525B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                >
                  📦 Track ORD-101
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPrompt('I want to return order ORD-102.')}
                  disabled={!isCallActive}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white hover:bg-[#FDF2F4] border border-[#EBE5DC] hover:border-[#F1C2CA] text-[#44403C] hover:text-[#A9525B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                >
                  🔄 Return ORD-102
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPrompt('Can I cancel my order ORD-103?')}
                  disabled={!isCallActive}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white hover:bg-[#FDF2F4] border border-[#EBE5DC] hover:border-[#F1C2CA] text-[#44403C] hover:text-[#A9525B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                >
                  ❌ Cancel ORD-103
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPrompt('What are your shipping rates and delivery times?')}
                  disabled={!isCallActive}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white hover:bg-[#FDF2F4] border border-[#EBE5DC] hover:border-[#F1C2CA] text-[#44403C] hover:text-[#A9525B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                >
                  🚚 Shipping Policy
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: Live Transcript & Post-Call Summary (Visible without scrolling) */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            {callOutcome ? (
              <div className="flex flex-col gap-4">
                <CallSummary callOutcome={callOutcome} />
                <TranscriptView
                  transcripts={transcripts}
                  toolEvents={toolEvents}
                  callState={callState}
                />
              </div>
            ) : (
              <TranscriptView
                transcripts={transcripts}
                toolEvents={toolEvents}
                callState={callState}
              />
            )}
          </div>
        </div>

        {/* Evaluator Helper Card: Mock Orders Database */}
        <SampleOrders onSelectPrompt={handleSelectPrompt} isCallActive={isCallActive} />

        {/* Brand Information & Policy Reference Drawer */}
        <section className="glass-panel p-5 text-xs text-[#78716C] shadow-xs">
          <div className="flex items-center gap-2 font-semibold text-[#1C1917] mb-2 font-brand text-sm">
            <BookOpen className="w-4 h-4 text-[#C86D76]" />
            <span>Aura Skincare Policy Reference (Strictly Enforced by Aria)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 pt-2.5 border-t border-[#EBE5DC]">
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EBE5DC]">
              <strong className="text-[#1C1917] block mb-0.5">Shipping:</strong>
              Free above ₹499 (₹50 fee below). Standard 3–5 business days delivery.
            </div>
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EBE5DC]">
              <strong className="text-[#1C1917] block mb-0.5">Returns & Refunds:</strong>
              Within 7 days of delivery for unopened products. Damaged goods reported within 48h.
            </div>
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EBE5DC]">
              <strong className="text-[#1C1917] block mb-0.5">Cancellations:</strong>
              Permitted ONLY while status is "Processing". Once Shipped/Out for Delivery, cancel is blocked.
            </div>
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EBE5DC]">
              <strong className="text-[#1C1917] block mb-0.5">Cash on Delivery (COD):</strong>
              Available for orders up to ₹2,500. Doorstep cash or UPI.
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-[#78716C]">
        <p>Aura Skincare AI Voice Agent Assessment • DataStraw • Powered by Gemini 3.1 Flash Live</p>
      </footer>
    </div>
  );
}
