import React, { useState } from 'react';
import { FileJson, Copy, Check, CheckCircle2, AlertCircle, Clock, Sparkles } from 'lucide-react';

export default function CallSummary({ callOutcome }) {
  const [copied, setCopied] = useState(false);

  if (!callOutcome) {
    return (
      <div className="glass-panel p-5 w-full h-[380px] flex flex-col items-center justify-center text-center text-slate-500 text-xs italic gap-2">
        <FileJson className="w-8 h-8 opacity-30 text-slate-400" />
        <p>Post-call structured summary will be generated automatically when you click "End Call".</p>
      </div>
    );
  }

  const jsonString = JSON.stringify(callOutcome, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status) => {
    const s = String(status).toUpperCase();
    if (s.includes('RESOLVED')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-3 h-3" /> RESOLVED
        </span>
      );
    }
    if (s.includes('REJECTED') || s.includes('INELIGIBLE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
          <AlertCircle className="w-3 h-3" /> REJECTED / POLICY
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
        <Clock className="w-3 h-3" /> {status}
      </span>
    );
  };

  return (
    <div className="glass-panel p-5 w-full flex flex-col h-[380px]">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Post-Call Outcome Summary
          </h2>
        </div>
        <button
          onClick={handleCopy}
          className="btn-secondary px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5"
          title="Copy JSON to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
          <span>{copied ? 'Copied' : 'Copy JSON'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scroll text-xs">
        {/* Metric Badges */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Customer Intent</span>
            <span className="font-mono text-xs text-rose-300 font-bold">
              {callOutcome.customer_intent || 'GENERAL_INQUIRY'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Resolution Status</span>
            <div className="mt-0.5">{getStatusBadge(callOutcome.resolution_status)}</div>
          </div>
        </div>

        {/* Order ID & Summary Text */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Referenced Order</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-semibold">
              {callOutcome.order_id || 'None'}
            </span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed pt-1 border-t border-white/[0.06]">
            {callOutcome.call_summary}
          </p>
        </div>

        {/* Raw JSON Code Block */}
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-medium block mb-1">
            Structured JSON Output (Contract)
          </span>
          <pre className="p-3 rounded-xl bg-[#05070B] border border-white/10 font-mono text-[11px] text-emerald-300/90 overflow-x-auto">
            {jsonString}
          </pre>
        </div>
      </div>
    </div>
  );
}
