import React, { useRef, useEffect } from 'react';
import { MessageSquare, User, Sparkles, Wrench } from 'lucide-react';
import { CALL_STATES } from '../hooks/useVoiceAgent.js';

export default function TranscriptView({ transcripts, toolEvents, callState }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, toolEvents]);

  const hasMessages = transcripts && transcripts.length > 0;

  return (
    <div className="glass-panel p-5 w-full flex flex-col h-[400px]">
      <div className="flex items-center justify-between pb-3 border-b border-[#EBE5DC] mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#C86D76]" />
          <h2 className="text-sm font-semibold tracking-wide text-[#1C1917] font-brand">
            Live Call Transcript
          </h2>
        </div>
        <span className="text-xs text-[#78716C] font-mono bg-[#FAF8F5] px-2.5 py-0.5 rounded-full border border-[#EBE5DC]">
          {transcripts.length} {transcripts.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-2 space-y-3.5 custom-scroll text-sm"
      >
        {!hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-[#78716C] text-xs italic gap-2 py-8">
            <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#EBE5DC] flex items-center justify-center text-[#C86D76]">
              <Sparkles className="w-5 h-5 opacity-60" />
            </div>
            <p className="text-[#A8A29E]">Your live conversation with Aria will appear here in real time.</p>
          </div>
        ) : (
          transcripts.map((entry, idx) => {
            const isUser = entry.role === 'user';
            const isLatestAria = !isUser && idx === transcripts.length - 1;
            const isStreaming = isLatestAria && callState === CALL_STATES.SPEAKING && !entry.isFinal;

            return (
              <div
                key={entry.id || idx}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-[#FDF2F4] border border-[#F1C2CA] flex items-center justify-center flex-shrink-0 text-[#C86D76] shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs md:text-sm leading-relaxed transition-all shadow-sm ${
                    isUser
                      ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#14532D] rounded-tr-sm'
                      : 'bg-[#FAF8F5] border border-[#EBE5DC] text-[#1C1917] rounded-tl-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] text-[#78716C] mb-1">
                    <span className={`font-semibold tracking-wider ${isUser ? 'text-[#15803D]' : 'text-[#C86D76]'}`}>
                      {isUser ? 'You (Customer)' : 'Aria (Aura Skincare)'}
                    </span>
                    {entry.timestamp && (
                      <span className="font-mono text-[9px] text-[#A8A29E]">
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">
                    {entry.text}
                    {isStreaming && (
                      <span className="inline-block w-1.5 h-3 bg-[#C86D76] ml-1 animate-pulse align-middle" />
                    )}
                  </p>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center flex-shrink-0 text-[#16A34A] shadow-sm">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Thinking indicator */}
        {callState === CALL_STATES.THINKING && (
          <div className="flex items-center gap-2.5 text-xs text-[#78716C] italic pl-9 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C86D76]" />
            <span>Aria is reviewing your account details...</span>
          </div>
        )}
      </div>
    </div>
  );
}
