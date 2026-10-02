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
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-3.5">
      {/* Primary Voice Action Buttons */}
      <div className="flex items-center justify-center gap-4">
        {!isCallActive ? (
          <button
            onClick={handleStart}
            disabled={callState === CALL_STATES.CONNECTING}
            className="btn-primary flex items-center gap-3 px-8 py-3.5 rounded-full text-base font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="w-5 h-5" />
            <span>{callState === CALL_STATES.CONNECTING ? 'Connecting to Aria...' : 'Start Voice Call'}</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => toggleMute(!isMuted)}
              className={`p-3.5 rounded-full border transition-all shadow-sm ${
                isMuted
                  ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                  : 'bg-white border-[#EBE5DC] text-[#44403C] hover:bg-[#FAF8F5]'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={endCall}
              className="btn-danger flex items-center gap-2.5 px-7 py-3 rounded-full text-base font-semibold shadow-md hover:shadow-lg"
            >
              <PhoneOff className="w-5 h-5" />
              <span>End Call</span>
            </button>
          </>
        )}

        {callState === CALL_STATES.ENDED && (
          <button
            onClick={resetCall}
            className="btn-secondary p-3.5 rounded-full shadow-sm hover:bg-[#FAF8F5]"
            title="Reset conversation and start fresh"
          >
            <RotateCcw className="w-5 h-5 text-[#57534E]" />
          </button>
        )}
      </div>

      {/* Auxiliary text fallback for evaluators without mic or testing quiet scenarios */}
      {isCallActive && (
        <form onSubmit={handleTextSubmit} className="w-full flex items-center gap-2 mt-1">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a message (e.g., 'Where is my order ORD-101?')..."
            className="flex-1 px-4 py-2 rounded-xl bg-white border border-[#EBE5DC] text-[#1C1917] text-xs md:text-sm placeholder-[#A8A29E] focus:outline-none focus:border-[#C86D76] focus:ring-1 focus:ring-[#C86D76]/20 shadow-sm"
          />
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="p-2.5 rounded-xl bg-[#FDF2F4] border border-[#F1C2CA] text-[#C86D76] hover:bg-[#FBEAEB] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
