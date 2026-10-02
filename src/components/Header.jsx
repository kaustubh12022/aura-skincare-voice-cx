import React from 'react';
import { Sparkles, Activity, ShieldCheck, Headphones } from 'lucide-react';

export default function Header({ isCallActive, callState }) {
  return (
    <header className="w-full max-w-6xl mx-auto pt-6 pb-4 px-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-[#EBE5DC]">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#C86D76] via-[#E8A2A8] to-[#C5A880] p-[2px] shadow-sm">
          <div className="w-full h-full bg-[#FAF8F5] rounded-2xl flex items-center justify-center">
            <span className="text-[#C86D76] font-brand text-2xl font-bold italic">A</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#1C1917] font-brand">
              Aura Skincare
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FDF2F4] border border-[#F1C2CA] text-[#A9525B] font-medium tracking-wide">
              AI Voice Concierge
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#78716C] mt-0.5">
            Meet <strong className="text-[#C86D76] font-semibold">Aria</strong> — Your Personal Botanical Beauty Advisor
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#EBE5DC] text-[#44403C] shadow-sm">
          <Headphones className="w-3.5 h-3.5 text-[#C86D76]" />
          <span>Gemini 3.1 Live API</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#EBE5DC] text-[#44403C] shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
          <span>Strict Brand Guardrails</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#EBE5DC] text-[#44403C] shadow-sm">
          <Activity className="w-3.5 h-3.5 text-[#B45309]" />
          <span>~300ms Conversational Latency</span>
        </div>
      </div>
    </header>
  );
}
