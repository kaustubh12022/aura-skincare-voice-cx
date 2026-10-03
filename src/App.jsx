import React, { useState } from 'react';
import Header from './components/Header.jsx';
import StatusIndicator from './components/StatusIndicator.jsx';
import AudioVisualizer from './components/AudioVisualizer.jsx';
import CallControls from './components/CallControls.jsx';
import SampleOrders from './components/SampleOrders.jsx';
import TranscriptView from './components/TranscriptView.jsx';
import CallSummary from './components/CallSummary.jsx';
import useVoiceAgent, { CALL_STATES } from './hooks/useVoiceAgent.js';
import { AlertCircle, Sparkles, Shield, Truck, RotateCcw, CreditCard, Sparkle } from 'lucide-react';

export default function App() {
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(false);

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
      {/* Luxury Brand Header */}
      <Header
        isCallActive={isCallActive}
        callState={callState}
        onOpenDemoGuide={() => setIsDemoGuideOpen(true)}
      />

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
                      {latestTurn.role === 'aria' ? '🌸 Aria (Advisory)' : '👤 You'}
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
                  Listening... Speak naturally with Aria or choose a client inquiry below.
                </p>
              ) : (
                <p className="text-xs text-[#78716C] my-2">
                  Click "Start Voice Call" to converse with Aria regarding orders, formulations, and store policies.
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

              {/* Refined Client Inquiries / Prompts */}
              <div className="w-full mt-3 pt-3 border-t border-[#EBE5DC]/80 flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[11px] text-[#78716C] mr-1">Inquiries:</span>
                <button
                  type="button"
                  onClick={() => handleSelectPrompt('Where is my order ORD-101?')}
                  disabled={!isCallActive}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white hover:bg-[#FDF2F4] border border-[#EBE5DC] hover:border-[#F1C2CA] text-[#44403C] hover:text-[#A9525B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                >
                  Track my order
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPrompt('I want to return my delivered order ORD-102.')}
                  disabled={!isCallActive}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white hover:bg-[#FDF2F4] border border-[#EBE5DC] hover:border-[#F1C2CA] text-[#44403C] hover:text-[#A9525B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                >
                  Return assistance
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPrompt('Can I cancel my recent order ORD-103?')}
                  disabled={!isCallActive}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white hover:bg-[#FDF2F4] border border-[#EBE5DC] hover:border-[#F1C2CA] text-[#44403C] hover:text-[#A9525B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                >
                  Order cancellation
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPrompt('What are your shipping rates and delivery times?')}
                  disabled={!isCallActive}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-white hover:bg-[#FDF2F4] border border-[#EBE5DC] hover:border-[#F1C2CA] text-[#44403C] hover:text-[#A9525B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                >
                  Shipping & delivery
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: Live Transcript & Post-Call Summary */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            <TranscriptView
              transcripts={transcripts}
              toolEvents={toolEvents}
              callState={callState}
            />
            <CallSummary callOutcome={callOutcome} />
          </div>
        </div>

        {/* Client Care & Botanical Commitments Editorial Section */}
        <section className="glass-panel p-6 text-xs text-[#78716C] shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#EBE5DC] mb-3.5">
            <div className="flex items-center gap-2 font-semibold text-[#1C1917] font-brand text-sm tracking-wide">
              <Sparkles className="w-4 h-4 text-[#C86D76]" />
              <span>The Aura Botanical Standard</span>
            </div>
            <span className="text-[11px] text-[#A8A29E] tracking-wider uppercase">Client Care Concierge</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE5DC] flex flex-col gap-1 text-left">
              <div className="flex items-center gap-2 text-[#1C1917] font-medium mb-1">
                <Truck className="w-4 h-4 text-[#C86D76]" />
                <span className="text-xs font-semibold">Complimentary Shipping</span>
              </div>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                Enjoy complimentary shipping on all orders exceeding ₹499. A flat ₹50 fee applies on smaller orders. Delivery within 3–5 business days.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE5DC] flex flex-col gap-1 text-left">
              <div className="flex items-center gap-2 text-[#1C1917] font-medium mb-1">
                <RotateCcw className="w-4 h-4 text-[#C5A880]" />
                <span className="text-xs font-semibold">7-Day Purity Guarantee</span>
              </div>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                Unopened, unused formulations in original packaging may be returned within 7 days of delivery. Damaged items replaced within 48 hours.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE5DC] flex flex-col gap-1 text-left">
              <div className="flex items-center gap-2 text-[#1C1917] font-medium mb-1">
                <Shield className="w-4 h-4 text-[#15803D]" />
                <span className="text-xs font-semibold">Flexible Fulfillment</span>
              </div>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                Orders may be cancelled freely while in 'Processing' status prior to dispatch. Transit parcels can be refused at doorstep.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EBE5DC] flex flex-col gap-1 text-left">
              <div className="flex items-center gap-2 text-[#1C1917] font-medium mb-1">
                <CreditCard className="w-4 h-4 text-[#B45309]" />
                <span className="text-xs font-semibold">Doorstep Payment</span>
              </div>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                Cash on Delivery and contactless UPI are conveniently available for orders up to ₹2,500 across all serviceable pin codes.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Discrete Client Order Ledger Modal (For Evaluation & Demo Verification) */}
      {isDemoGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-4xl w-full border border-[#EBE5DC] shadow-2xl relative">
            <SampleOrders
              onSelectPrompt={handleSelectPrompt}
              isCallActive={isCallActive}
              onClose={() => setIsDemoGuideOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-[#78716C]/80 tracking-wide">
        <p>© 2026 Aura Skincare Botanicals Pvt. Ltd. • Private Client Care • Pure Botanical Formulations</p>
      </footer>
    </div>
  );
}
