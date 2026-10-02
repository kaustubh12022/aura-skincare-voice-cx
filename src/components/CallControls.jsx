import React, { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, RotateCcw, Send } from 'lucide-react';
import { CALL_STATES } from '../hooks/useVoiceAgent.js';

export default function CallControls({
  callState,
  isCallActive,
  startCall,
  endCall,
  resetCall,
  isMuted,
  toggleMute,
  sendTextMessage
}) {
  const [textInput, setTextInput] = useState('');

  const handleStart = async () => {
    try {
      await startCall();
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim() || !isCallActive) return;
    sendTextMessage(textInput.trim());
    setTextInput('');
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4">
      {/* Primary Voice Action Buttons */}
      <div className="flex items-center justify-center gap-4">
        {!isCallActive ? (
          <button
            onClick={handleStart}
            disabled={callState === CALL_STATES.CONNECTING}
            className="btn-primary flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold shadow-xl hover:shadow-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="w-5 h-5" />
            <span>{callState === CALL_STATES.CONNECTING ? 'Connecting...' : 'Start Voice Call'}</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => toggleMute(!isMuted)}
              className={`p-4 rounded-full border transition-all ${
                isMuted
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/10 border-white/15 text-white hover:bg-white/15'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={endCall}
              className="btn-danger flex items-center gap-2.5 px-7 py-3.5 rounded-full text-base font-semibold shadow-xl"
            >
              <PhoneOff className="w-5 h-5" />
              <span>End Call</span>
            </button>
          </>
        )}

        {callState === CALL_STATES.ENDED && (
          <button
            onClick={resetCall}
            className="btn-secondary p-3.5 rounded-full"
            title="Reset conversation and start fresh"
          >
            <RotateCcw className="w-5 h-5 text-slate-300" />
          </button>
        )}
      </div>

      {/* Auxiliary text fallback for evaluators without mic or testing quiet scenarios */}
      {isCallActive && (
        <form onSubmit={handleTextSubmit} className="w-full flex items-center gap-2 mt-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type a question (e.g. 'Where is my order ORD-101?')..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs md:text-sm placeholder-slate-500 focus:outline-none focus:border-rose-400/50"
          />
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
