import React from 'react';
import { Sparkles, Activity, ShieldCheck, Headphones } from 'lucide-react';

export default function Header({ isCallActive, callState }) {
  return (
    <header className="w-full max-w-6xl mx-auto pt-6 pb-4 px-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 p-[2px] shadow-lg shadow-rose-500/20">
          <div className="w-full h-full bg-[#090D16] rounded-2xl flex items-center justify-center">
            <span className="text-rose-400 font-brand text-2xl font-bold italic">A</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Aura Skincare
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 font-normal">
              AI Voice CX
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400">
            Meet <strong className="text-rose-300 font-medium">Aria</strong> — Your 24/7 D2C Skincare Concierge
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-slate-300">
          <Headphones className="w-3.5 h-3.5 text-rose-400" />
          <span>Gemini 3.1 Live API</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Brand Policy Guardrails</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-slate-300">
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span>~300ms Latency</span>
        </div>
      </div>
    </header>
  );
}
