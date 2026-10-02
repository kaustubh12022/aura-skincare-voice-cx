import React, { useState } from 'react';
import { Package, Copy, Check, Info, ArrowUpRight } from 'lucide-react';

const SAMPLE_ORDERS = [
  {
    id: 'ORD-101',
    customer: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    amount: '₹699',
    status: 'Out for Delivery',
    statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    notes: 'BlueDart — BD-982103. Expected by 6 PM today.',
    policyNote: 'Cannot cancel (already Out for Delivery). Can refuse at doorstep.',
    promptSuggestion: 'Can you tell me where my order ORD-101 is?'
  },
  {
    id: 'ORD-102',
    customer: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    amount: '₹499',
    status: 'Delivered',
    statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    notes: 'Delhivery — DL-441029. Delivered 14 days ago.',
    policyNote: 'Return ineligible (7-day unopened policy expired 7 days ago).',
    promptSuggestion: 'I bought order ORD-102 and want to return it.'
  },
  {
    id: 'ORD-103',
    customer: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    amount: '₹850',
    status: 'Processing',
    statusColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    notes: 'Ordered 3 hours ago. Eligible for immediate cancellation.',
    policyNote: 'Eligible for cancellation & full refund.',
    promptSuggestion: 'Can I please cancel my order ORD-103?'
  }
];

export default function SampleOrders({ onSelectPrompt, isCallActive }) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="glass-panel p-5 w-full">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-rose-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Evaluator Testing Helper — Mock Order Database
          </h2>
        </div>
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-slate-400" /> Click ID to copy
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SAMPLE_ORDERS.map((order) => (
          <div
            key={order.id}
            className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/20 transition-all flex flex-col justify-between gap-3 text-left"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <button
                  onClick={() => handleCopy(order.id)}
                  className="font-mono text-xs font-bold text-rose-300 hover:text-rose-200 flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20"
                  title="Click to copy ID"
                >
                  {order.id}
                  {copiedId === order.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-rose-400" />
                  )}
                </button>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${order.statusColor}`}
                >
                  {order.status}
                </span>
              </div>

              <h4 className="text-xs font-medium text-white line-clamp-1">{order.product}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Customer: <span className="text-slate-300">{order.customer}</span> ({order.amount})
              </p>
              <p className="text-[11px] text-slate-400 mt-1 italic leading-tight">
                {order.notes}
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-[10px] text-amber-300/90 leading-tight mb-2">
                <strong>Policy:</strong> {order.policyNote}
              </p>
              {isCallActive && onSelectPrompt && (
                <button
                  onClick={() => onSelectPrompt(order.promptSuggestion)}
                  className="w-full text-[11px] py-1 px-2 rounded bg-white/[0.06] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-rose-200 flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Ask Aria this</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
