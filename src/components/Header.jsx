import React from 'react';
import { Sparkles, Shield, Clock, Compass, HelpCircle } from 'lucide-react';

export default function Header({  }) {
  return (
    <header className="w-full max-w-6xl mx-auto pt-7 pb-5 px-6 flex flex-col md:flex-row items-center justify-between gap-5 border-b border-[#EBE5DC]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#C86D76]/20 via-[#FAF8F5] to-[#C5A880]/30 border border-[#EBE5DC] p-1 flex items-center justify-center shadow-xs">
          <span className="text-[#C86D76] font-brand text-2xl font-serif italic">A</span>
        </div>
        <div className="text-left">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-wider text-[#1C1917] font-brand uppercase">
              Aura
            </h1>
            <span className="text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-[#EBE5DC] text-[#78716C] font-medium">
              Private Concierge
            </span>
          </div>
          <p className="text-xs text-[#78716C] mt-0.5 tracking-wide">
            Haute Botanicals & Personal Client Advisory
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2.5 text-xs">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-[#EBE5DC] text-[#44403C] shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse" />
          <span className="text-[11px] font-medium tracking-wide">Aria Available Live</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-[#EBE5DC] text-[#78716C] shadow-xs">
          <Shield className="w-3.5 h-3.5 text-[#C5A880]" />
          <span className="text-[11px] tracking-wide">Authentic Formulations</span>
        </div>
      </div>
    </header>
  );
}
