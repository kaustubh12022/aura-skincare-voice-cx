import React, { useState } from 'react';
import { Package, Copy, Check, Info, ArrowUpRight } from 'lucide-react';

export const SAMPLE_ORDERS = [
  {
    id: 'ORD-101',
    customer: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    amount: '₹699',
    status: 'Out for Delivery',
    statusColor: 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]',
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
    statusColor: 'text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0]',
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
    statusColor: 'text-[#0369A1] bg-[#F0F9FF] border-[#BAE6FD]',
    notes: 'Ordered 3 hours ago. Eligible for immediate cancellation.',
    policyNote: 'Eligible for cancellation & full refund.',
    promptSuggestion: 'Can I please cancel my order ORD-103?'
  }
];

export default function SampleOrders({ onSelectPrompt, isCallActive, onClose }) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-3.5 border-b border-[#EBE5DC] mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#FAF8F5] border border-[#EBE5DC] flex items-center justify-center text-[#C86D76]">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[#1C1917] font-brand">
              Active Client Orders Ledger
            </h2>
            <p className="text-[11px] text-[#78716C]">
              Reference order profiles for real-time status & policy lookups
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#78716C] hidden sm:flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[#A8A29E]" /> Click ID to copy
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-[#78716C] hover:text-[#1C1917] hover:bg-[#FAF8F5] border border-[#EBE5DC] transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SAMPLE_ORDERS.map((order) => (
          <div
            key={order.id}
            className="p-4 rounded-2xl bg-[#FAF8F5]/80 border border-[#EBE5DC] hover:border-[#DFD7CC] hover:shadow-xs transition-all flex flex-col justify-between gap-3 text-left"
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <button
                  onClick={() => handleCopy(order.id)}
                  className="font-mono text-xs font-bold text-[#A9525B] hover:text-[#8C434A] flex items-center gap-1.5 bg-[#FDF2F4] px-2.5 py-1 rounded-md border border-[#F1C2CA] shadow-2xs transition-colors cursor-pointer"
                  title="Click to copy Order ID"
                >
                  {order.id}
                  {copiedId === order.id ? (
                    <Check className="w-3 h-3 text-[#15803D]" />
                  ) : (
                    <Copy className="w-3 h-3 text-[#C86D76]" />
                  )}
                </button>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border font-semibold ${order.statusColor}`}
                >
                  {order.status}
                </span>
              </div>

              <h4 className="text-xs font-semibold text-[#1C1917] line-clamp-1">{order.product}</h4>
              <p className="text-[11px] text-[#78716C] mt-0.5">
                Client: <span className="text-[#44403C] font-medium">{order.customer}</span> • {order.amount}
              </p>
              <p className="text-[11px] text-[#78716C] mt-1.5 leading-snug">
                {order.notes}
              </p>
            </div>

            <div className="pt-2.5 border-t border-[#EBE5DC]/80 space-y-2">
              <div className="p-2 rounded-xl bg-white border border-[#EBE5DC] text-[10px] text-[#57534E] leading-relaxed">
                <strong className="text-[#1C1917] block mb-0.5">Policy Outcome:</strong> {order.policyNote}
              </div>
              {isCallActive && onSelectPrompt && (
                <button
                  onClick={() => {
                    onSelectPrompt(order.promptSuggestion);
                    if (onClose) onClose();
                  }}
                  className="w-full text-[11px] py-1.5 px-2.5 rounded-xl bg-[#FDF2F4] hover:bg-[#FBEAEB] border border-[#F1C2CA] text-[#A9525B] font-medium flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <span>Inquire about this order</span>
                  <ArrowUpRight className="w-3 h-3 text-[#C86D76]" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
