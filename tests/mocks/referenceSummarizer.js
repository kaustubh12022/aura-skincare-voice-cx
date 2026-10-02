/**
 * tests/mocks/referenceSummarizer.js
 * Authoritative reference implementation of Aura Skincare Post-Call Summarizer
 * matching specifications in PROJECT.md and ORIGINAL_REQUEST.md §R4.
 */

const ALLOWED_INTENTS = [
  'order_tracking',
  'cancellation',
  'return_refund',
  'shipping_inquiry',
  'out_of_scope',
  'general_inquiry'
];

const ALLOWED_RESOLUTIONS = [
  'resolved',
  'rejected',
  'escalated',
  'in_progress'
];

const VALID_ORDER_IDS = ['ORD-101', 'ORD-102', 'ORD-103'];

/**
 * Deterministic rule-based summary extractor.
 * Guarantees 100% valid JSON outcome matching schema even without active LLM.
 *
 * @param {Array} transcript - List of { role, text, timestamp }
 * @param {Array} toolCalls - List of { tool, args, result }
 * @returns {object} Structured call outcome
 */
export function extractRuleBasedSummary(transcript = [], toolCalls = []) {
  const fullText = (transcript || [])
    .map(t => (t.text || '').toLowerCase())
    .join(' ');

  const userText = (transcript || [])
    .filter(t => t.role === 'user' || t.speaker === 'user')
    .map(t => (t.text || '').toLowerCase())
    .join(' ') || fullText;

  // Extract Order ID from tool calls or transcript
  let detectedOrderId = null;
  for (const tc of toolCalls || []) {
    const rawId = tc?.args?.order_id || tc?.order_id;
    if (rawId) {
      const upper = String(rawId).toUpperCase();
      if (VALID_ORDER_IDS.includes(upper)) {
        detectedOrderId = upper;
        break;
      }
    }
  }

  if (!detectedOrderId) {
    for (const id of VALID_ORDER_IDS) {
      if (fullText.includes(id.toLowerCase())) {
        detectedOrderId = id;
        break;
      }
    }
  }

  // Check intent and resolution
  let customer_intent = 'general_inquiry';
  let resolution_status = 'resolved';
  let call_summary = '';

  // 1. Cancellation Intent
  if (userText.includes('cancel') || userText.includes('cancellation')) {
    customer_intent = 'cancellation';
    if (detectedOrderId === 'ORD-103') {
      resolution_status = 'resolved';
      call_summary = 'Customer Ananya Patel requested cancellation of order ORD-103 (Green Tea Face Wash + Toner, ₹850). The order was verified in Processing status and cancelled immediately with full refund initiated in 5-7 business days.';
    } else if (detectedOrderId === 'ORD-101') {
      resolution_status = 'rejected';
      call_summary = 'Customer Priya Sharma requested cancellation of order ORD-101 (Vitamin C Serum, ₹699). Cancellation was politely rejected per brand policy because the order is Out for Delivery with BlueDart. Customer was advised they may refuse delivery at doorstep.';
    } else {
      resolution_status = 'rejected';
      call_summary = `Customer requested cancellation for order ${detectedOrderId || 'unspecified'}. Cancellation was rejected per brand policy.`;
    }
  }
  // 2. Return / Refund Intent
  else if (userText.includes('return') || userText.includes('refund') || userText.includes('exchange')) {
    customer_intent = 'return_refund';
    if (detectedOrderId === 'ORD-102') {
      resolution_status = 'rejected';
      call_summary = 'Customer Rahul Verma requested a return for order ORD-102 (Hydrating Sunscreen SPF 50, ₹499). The request was politely rejected because the order was delivered 14 days ago, exceeding Aura Skincare\'s strict 7-day return policy limit.';
    } else {
      resolution_status = 'rejected';
      call_summary = `Customer requested return/refund for order ${detectedOrderId || 'unspecified'}. Request evaluated according to 7-day return policy.`;
    }
  }
  // 3. Out of Scope Query (checked before order tracking if no order ID / tool calls)
  else if (userText.includes('flight') || userText.includes('hotel') || userText.includes('cricket') || userText.includes('doctor') || userText.includes('ticket')) {
    customer_intent = 'out_of_scope';
    detectedOrderId = null;
    resolution_status = 'resolved';
    call_summary = 'Customer made an off-topic inquiry outside the domain of Aura Skincare support. Aria politely deflected the question and redirected to skincare assistance.';
  }
  // 4. Shipping Inquiry
  else if (userText.includes('shipping') || userText.includes('delivery fee') || userText.includes('delivery time') || userText.includes('charges')) {
    customer_intent = 'shipping_inquiry';
    detectedOrderId = null;
    resolution_status = 'resolved';
    call_summary = 'Customer inquired about Aura Skincare shipping fees and delivery timelines. Aria explained free shipping applies on orders above ₹499 (flat ₹50 fee otherwise) with 3-5 business days delivery across India.';
  }
  // 5. Order Tracking Intent
  else if (userText.includes('track') || userText.includes('status') || userText.includes('where is') || detectedOrderId) {
    customer_intent = 'order_tracking';
    if (detectedOrderId === 'ORD-101') {
      resolution_status = 'resolved';
      call_summary = 'Customer Priya Sharma inquired about order ORD-101 (Vitamin C Serum, ₹699). Aria confirmed status is Out for Delivery via BlueDart with tracking number BD-982103 arriving today.';
    } else if (detectedOrderId === 'ORD-102') {
      resolution_status = 'resolved';
      call_summary = 'Customer Rahul Verma inquired about order ORD-102. Aria confirmed order was delivered 14 days ago via Delhivery (DL-441029).';
    } else if (detectedOrderId === 'ORD-103') {
      resolution_status = 'resolved';
      call_summary = 'Customer Ananya Patel inquired about order ORD-103. Aria confirmed order is currently Processing in warehouse.';
    } else {
      resolution_status = 'resolved';
      call_summary = 'Customer inquired about order status. Aria looked up the order in the database and provided status details.';
    }
  }
  // 6. General Inquiry
  else {
    customer_intent = 'general_inquiry';
    resolution_status = (transcript || []).length > 2 ? 'resolved' : 'in_progress';
    call_summary = 'Customer contacted Aura Skincare customer care. General inquiries and support assistance were provided.';
  }

  return {
    customer_intent,
    order_id: detectedOrderId,
    resolution_status,
    call_summary
  };
}

/**
 * Generates structured call outcome.
 *
 * @param {object} sessionData - { transcript, toolCalls }
 * @returns {Promise<object>} Conforms strictly to CallOutcome JSON schema
 */
export async function generateCallSummary(sessionData = {}) {
  const { transcript = [], toolCalls = [] } = sessionData;
  return extractRuleBasedSummary(transcript, toolCalls);
}

export default {
  ALLOWED_INTENTS,
  ALLOWED_RESOLUTIONS,
  VALID_ORDER_IDS,
  extractRuleBasedSummary,
  generateCallSummary
};
