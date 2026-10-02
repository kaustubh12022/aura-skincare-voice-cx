import React, { useRef, useEffect } from 'react';
import { MessageSquare, User, Bot, Wrench } from 'lucide-react';
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
    <div className="glass-panel p-5 w-full flex flex-col h-[380px]">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-rose-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Live Call Transcript
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {transcripts.length} {transcripts.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-2 space-y-3.5 custom-scroll text-sm"
      >
        {!hasMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs italic gap-2">
            <MessageSquare className="w-8 h-8 opacity-30 text-slate-400" />
            <p>Transcript will appear in real time once you start speaking with Aria.</p>
          </div>
        ) : (
          transcripts.map((entry, idx) => {
            const isUser = entry.role === 'user';
            return (
              <div
                key={idx}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0 text-rose-300">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs md:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-100 rounded-br-none'
                      : 'bg-white/[0.05] border border-white/10 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-1">
                    <span className="font-semibold uppercase tracking-wider">
                      {isUser ? 'You (Customer)' : 'Aria (Support)'}
                    </span>
                    {entry.timestamp && (
                      <span className="font-mono text-[9px] text-slate-500">
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-300">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Live tool calling notification badge */}
        {toolEvents && toolEvents.length > 0 && (
          <div className="py-1">
            {toolEvents.slice(-2).map((tool, tIdx) => (
              <div
                key={tIdx}
                className="my-1.5 mx-auto max-w-sm px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-center gap-1.5 animate-pulse"
              >
                <Wrench className="w-3 h-3 text-amber-400" />
                <span>Tool Invoked: <code>{tool.name}({JSON.stringify(tool.args || {})})</code></span>
              </div>
            ))}
          </div>
        )}

        {/* Thinking or speaking indicator */}
        {callState === CALL_STATES.THINKING && (
          <div className="flex items-center gap-2 text-xs text-amber-300 italic pl-9">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Aria is checking order records...</span>
          </div>
        )}
      </div>
    </div>
  );
}
