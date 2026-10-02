import React, { useState } from 'react';
import { FileJson, Copy, Check, CheckCircle2, AlertCircle, Clock, Sparkles } from 'lucide-react';

export default function CallSummary({ callOutcome }) {
  const [copied, setCopied] = useState(false);

  if (!callOutcome) {
    return (
      <div className="glass-panel p-5 w-full h-[400px] flex flex-col items-center justify-center text-center text-[#78716C] text-xs italic gap-2.5">
        <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#EBE5DC] flex items-center justify-center text-[#C5A880]">
          <FileJson className="w-5 h-5 opacity-60" />
        </div>
        <p className="text-[#A8A29E]">Structured post-call summary and resolution metrics will appear here after clicking "End Call".</p>
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] text-xs font-semibold">
          <CheckCircle2 className="w-3 h-3" /> RESOLVED
        </span>
      );
    }
    if (s.includes('REJECTED') || s.includes('INELIGIBLE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FDF2F4] border border-[#F1C2CA] text-[#A9525B] text-xs font-semibold">
          <AlertCircle className="w-3 h-3" /> REJECTED / POLICY
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] text-xs font-semibold">
        <Clock className="w-3 h-3" /> {status}
      </span>
    );
  };

  return (
    <div className="glass-panel p-5 w-full flex flex-col h-[400px]">
      <div className="flex items-center justify-between pb-3 border-b border-[#EBE5DC] mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C5A880]" />
          <h2 className="text-sm font-semibold tracking-wide text-[#1C1917] font-brand">
            Post-Call Outcome Summary
          </h2>
        </div>
        <button
          onClick={handleCopy}
          className="btn-secondary px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          title="Copy JSON to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#15803D]" /> : <Copy className="w-3.5 h-3.5 text-[#78716C]" />}
          <span>{copied ? 'Copied' : 'Copy JSON'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scroll text-xs">
        {/* Metric Badges */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EBE5DC]">
            <span className="text-[10px] text-[#78716C] block uppercase font-medium">Customer Intent</span>
            <span className="font-mono text-xs text-[#A9525B] font-bold">
              {callOutcome.customer_intent || 'GENERAL_INQUIRY'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EBE5DC]">
            <span className="text-[10px] text-[#78716C] block uppercase font-medium">Resolution Status</span>
            <div className="mt-0.5">{getStatusBadge(callOutcome.resolution_status)}</div>
          </div>
        </div>

        {/* Order ID & Summary Text */}
        <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EBE5DC] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#78716C] uppercase font-medium">Referenced Order</span>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-[#FDF2F4] border border-[#F1C2CA] text-[#A9525B] font-bold">
              {callOutcome.order_id || 'None'}
            </span>
          </div>
          <p className="text-[#334155] text-xs leading-relaxed pt-1.5 border-t border-[#EBE5DC]">
            {callOutcome.call_summary}
          </p>
        </div>

        {/* Raw JSON Code Block */}
        <div>
          <span className="text-[10px] text-[#78716C] uppercase font-medium block mb-1">
            Structured JSON Contract
          </span>
          <pre className="p-3 rounded-xl bg-[#1C1917] border border-[#292524] font-mono text-[11px] text-[#A7F3D0] overflow-x-auto shadow-sm">
            {jsonString}
          </pre>
        </div>
      </div>
    </div>
  );
}
