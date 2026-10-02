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
          color: 'text-[#A9525B]',
          bg: 'bg-[#FDF2F4]',
          border: 'border-[#F1C2CA]',
          glow: 'pulse-connecting',
          dot: 'bg-[#C86D76]'
        };
      case CALL_STATES.LISTENING:
        return {
          icon: isMuted ? MicOff : Mic,
          label: isMuted ? 'Microphone Muted' : 'Listening — Speak naturally...',
          color: isMuted ? 'text-[#B45309]' : 'text-[#15803D]',
          bg: isMuted ? 'bg-[#FFFBEB]' : 'bg-[#F0FDF4]',
          border: isMuted ? 'border-[#FDE68A]' : 'border-[#BBF7D0]',
          glow: isMuted ? '' : 'pulse-listening',
          dot: isMuted ? 'bg-[#D97706]' : 'bg-[#16A34A]'
        };
      case CALL_STATES.THINKING:
        return {
          icon: Cpu,
          label: 'Aria is checking order records...',
          color: 'text-[#92400E]',
          bg: 'bg-[#FFFBEB]',
          border: 'border-[#FDE68A]',
          glow: 'pulse-thinking',
          dot: 'bg-[#D97706]'
        };
      case CALL_STATES.SPEAKING:
        return {
          icon: Volume2,
          label: 'Aria is speaking (interrupt anytime)...',
          color: 'text-[#9E2A44]',
          bg: 'bg-[#FDF2F4]',
          border: 'border-[#F7CAD4]',
          glow: 'pulse-speaking',
          dot: 'bg-[#C86D76]'
        };
      case CALL_STATES.ENDED:
        return {
          icon: PhoneOff,
          label: 'Call Ended — Reviewing Transcript & Outcome',
          color: 'text-[#57534E]',
          bg: 'bg-[#F5F5F4]',
          border: 'border-[#E7E5E4]',
          glow: '',
          dot: 'bg-[#78716C]'
        };
      case CALL_STATES.IDLE:
      default:
        return {
          icon: Mic,
          label: 'Ready — Click "Start Voice Call" to talk with Aria',
          color: 'text-[#57534E]',
          bg: 'bg-white',
          border: 'border-[#EBE5DC]',
          glow: '',
          dot: 'bg-[#A8A29E]'
        };
    }
  };

  const config = getBadgeConfig();
  const IconComponent = config.icon;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border shadow-sm ${config.bg} ${config.border} ${config.glow} transition-all duration-300`}
      >
        <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
        <IconComponent className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={`text-xs font-medium tracking-wide ${config.color}`}>{config.label}</span>
      </div>
    </div>
  );
}
