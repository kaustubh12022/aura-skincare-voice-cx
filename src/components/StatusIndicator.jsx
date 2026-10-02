import React from 'react';
import { Mic, MicOff, Volume2, Cpu, PhoneOff, Radio } from 'lucide-react';
import { CALL_STATES } from '../hooks/useVoiceAgent.js';

export default function StatusIndicator({ callState, isMuted }) {
  const getBadgeConfig = () => {
    switch (callState) {
      case CALL_STATES.CONNECTING:
        return {
          icon: Radio,
          label: 'Connecting to Gemini Live Relay...',
          color: 'text-rose-400',
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/30',
          glow: 'pulse-connecting',
          dot: 'bg-rose-500'
        };
      case CALL_STATES.LISTENING:
        return {
          icon: isMuted ? MicOff : Mic,
          label: isMuted ? 'Microphone Muted' : 'Listening — Speak naturally...',
          color: isMuted ? 'text-amber-400' : 'text-emerald-400',
          bg: isMuted ? 'bg-amber-500/10' : 'bg-emerald-500/10',
          border: isMuted ? 'border-amber-500/30' : 'border-emerald-500/30',
          glow: isMuted ? '' : 'pulse-listening',
          dot: isMuted ? 'bg-amber-500' : 'bg-emerald-500'
        };
      case CALL_STATES.THINKING:
        return {
          icon: Cpu,
          label: 'Aria is thinking & checking order database...',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          glow: 'pulse-thinking',
          dot: 'bg-amber-500'
        };
      case CALL_STATES.SPEAKING:
        return {
          icon: Volume2,
          label: 'Aria is speaking (interrupt anytime)...',
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/10',
          border: 'border-indigo-500/30',
          glow: 'pulse-speaking',
          dot: 'bg-indigo-500'
        };
      case CALL_STATES.ENDED:
        return {
          icon: PhoneOff,
          label: 'Call Ended — Reviewing Transcript & Outcome',
          color: 'text-slate-400',
          bg: 'bg-slate-500/10',
          border: 'border-slate-500/30',
          glow: '',
          dot: 'bg-slate-500'
        };
      case CALL_STATES.IDLE:
      default:
        return {
          icon: Mic,
          label: 'Ready — Click "Start Call" to talk with Aria',
          color: 'text-slate-300',
          bg: 'bg-white/5',
          border: 'border-white/10',
          glow: '',
          dot: 'bg-slate-400'
        };
    }
  };

  const config = getBadgeConfig();
  const IconComponent = config.icon;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border ${config.bg} ${config.border} ${config.glow} transition-all duration-300`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${config.dot} animate-pulse`} />
        <IconComponent className={`w-4 h-4 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </div>
    </div>
  );
}
