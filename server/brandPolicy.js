/**
 * server/brandPolicy.js
 * Aura Skincare AI Voice Agent ("Aria") - Brand Policy Guardrails Engine
 *
 * Implements authoritative business rules for:
 * - Shipping charges and delivery windows
 * - 7-day return expiration and unopened cosmetic hygiene rules
 * - Order cancellation eligibility based on order lifecycle status
 * - Out-of-scope query deflection
 */

export const BRAND_POLICIES = {
  brand_name: "Aura Skincare",
  currency: "INR",
  currency_symbol: "₹",
  shipping: {
    free_shipping_threshold: 499, // Orders strictly > 499 get free shipping
    standard_shipping_fee: 50,    // Orders <= 499 incur flat ₹50 fee
    delivery_window_business_days_min: 3,
    delivery_window_business_days_max: 5,
    delivery_timeline_text: "3 to 5 business days across India",
    courier_partners: ["BlueDart", "Delhivery", "DTDC", "Xpressbees"]
  },
  returns: {
    max_return_window_days: 7, // Strictly within 7 calendar days of delivery
    damaged_item_report_window_hours: 48, // Must report damage within 48h
    packaging_requirement: "Unopened, unused, in original packaging with safety seal intact",
    hygiene_restriction: "Due to cosmetic hygiene standards, opened or unsealed skincare products cannot be returned.",
    refund_processing_business_days: "5 to 7 business days following warehouse inspection"
  },
  cancellations: {
    allowed_statuses: ["Processing"],
    disallowed_statuses: ["Shipped", "Out for Delivery", "Delivered", "Cancelled"],
    refund_timeline_business_days: "5 to 7 business days to original payment method",
    dispatched_order_guidance: "Orders already in transit cannot be stopped. Customers may refuse delivery at the doorstep."
  },
  deflections: {
    out_of_scope_message: "I am specialized exclusively in Aura Skincare products, order tracking, and skincare routines! While I cannot assist with external topics like travel, medical prescriptions, or general trivia, I would love to help you track your order or recommend a gentle skincare regimen.",
    medical_disclaimer: "While I can recommend gentle, non-comedogenic daily skincare products from Aura Skincare, I cannot diagnose clinical skin conditions or prescribe medicine. For severe skin concerns, we strongly recommend consulting a certified dermatologist."
  }
};

/**
 * Returns delivery timeline string
 */
export function getDeliveryTimeline() {
  return BRAND_POLICIES.shipping.delivery_timeline_text;
}

/**
 * Computes shipping fees and eligibility based on total order amount.
 * Rule: Free on orders strictly above ₹499 (orderAmount > 499). Flat ₹50 fee otherwise.
 *
 * @param {number|string} orderAmount
 * @returns {object} Shipping calculation outcome
 */
export function calculateShippingFee(orderAmount) {
  const numericAmount = Number(orderAmount);
  const isValidNumber = !isNaN(numericAmount) && numericAmount >= 0;
  const safeAmount = isValidNumber ? numericAmount : 0;

  const isFree = safeAmount > BRAND_POLICIES.shipping.free_shipping_threshold;
  const fee = isFree ? 0 : BRAND_POLICIES.shipping.standard_shipping_fee;

  return {
    order_amount: safeAmount,
    threshold: BRAND_POLICIES.shipping.free_shipping_threshold,
    shipping_fee: fee,
    fee: fee,
    is_free: isFree,
    isFree: isFree,
    delivery_timeline: BRAND_POLICIES.shipping.delivery_timeline_text,
    summary: isFree
      ? `Qualifies for Free Standard Shipping (order exceeds ₹${BRAND_POLICIES.shipping.free_shipping_threshold}). Estimated delivery in 3 to 5 business days.`
      : `Standard shipping fee of ₹${fee} applies on orders of ₹${BRAND_POLICIES.shipping.free_shipping_threshold} or below. Estimated delivery in 3 to 5 business days.`
  };
}

/**
 * Evaluates whether an order is eligible for cancellation.
 * Rule: Only orders in "Processing" status can be cancelled.
 *
 * @param {object|string} orderOrStatus - Order object or raw status string
 * @returns {object} Cancellation evaluation outcome
 */
export function canCancelOrder(orderOrStatus) {
  let status = "";
  if (typeof orderOrStatus === "string") {
    status = orderOrStatus.trim();
  } else if (orderOrStatus && typeof orderOrStatus === "object") {
    status = (orderOrStatus.order_status || orderOrStatus.status || "").trim();
  }

  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "processing") {
    return {
      allowed: true,
      action: "approve",
      status: "Processing",
      reason: "Order is in Processing status and eligible for immediate cancellation and 100% refund.",
      refundTimeline: "5 to 7 business days to original payment method"
    };
  }

  if (normalizedStatus === "out for delivery") {
    return {
      allowed: false,
      action: "reject",
      status: "Out for Delivery",
      reason: "Order is already Out for Delivery and cannot be cancelled en route. You may refuse delivery at your doorstep.",
      refundTimeline: null
    };
  }

  if (normalizedStatus === "shipped") {
    return {
      allowed: false,
      action: "reject",
      status: "Shipped",
      reason: "Order has already been shipped from our warehouse and cannot be cancelled in transit.",
      refundTimeline: null
    };
  }

  if (normalizedStatus === "delivered") {
    return {
      allowed: false,
      action: "reject",
      status: "Delivered",
      reason: "Order has already been delivered. Cancellation is not possible; you may check return eligibility within 7 days.",
      refundTimeline: null
    };
  }

  if (normalizedStatus === "cancelled") {
    return {
      allowed: false,
      action: "reject",
      status: "Cancelled",
      reason: "Order is already cancelled.",
      refundTimeline: null
    };
  }

  return {
    allowed: false,
    action: "reject",
    status: status || "Unknown",
    reason: `Orders in '${status || "Unknown"}' status are not eligible for cancellation. Only 'Processing' orders may be cancelled.`,
    refundTimeline: null
  };
}

/**
 * Evaluates whether an order or item is eligible for return.
 * Rules:
 * - Must be delivered
 * - Delivered within 7 calendar days
 * - Product must be unopened and unused with safety seal intact
 * - Damaged items must be reported within 48 hours
 *
 * @param {object|number} orderOrDays - Order object or numeric days since delivery
 * @param {number|boolean} [daysSinceDeliveryParam] - Optional explicit days since delivery or isOpened boolean
 * @param {boolean} [isOpenedParam=false] - Whether product seal was opened
 * @returns {object} Return evaluation outcome
 */
export function canReturnOrder(orderOrDays, daysSinceDeliveryParam, isOpenedParam = false) {
  let daysSinceDelivery = null;
  let isOpened = false;
  let isDamaged = false;
  let hoursSinceDelivery = null;
  let orderStatus = "";

  if (typeof orderOrDays === "number") {
    daysSinceDelivery = orderOrDays;
    isOpened = typeof daysSinceDeliveryParam === "boolean" ? daysSinceDeliveryParam : Boolean(isOpenedParam);
  } else if (orderOrDays && typeof orderOrDays === "object") {
    orderStatus = (orderOrDays.order_status || orderOrDays.status || "").trim();
    isDamaged = Boolean(orderOrDays.isDamaged || orderOrDays.is_damaged);
    hoursSinceDelivery = orderOrDays.hoursSinceDelivery !== undefined ? orderOrDays.hoursSinceDelivery : orderOrDays.hours_since_delivery;

    if (orderOrDays.daysSinceDelivery !== undefined) {
      daysSinceDelivery = orderOrDays.daysSinceDelivery;
    } else if (orderOrDays.delivered_days_ago !== undefined) {
      daysSinceDelivery = orderOrDays.delivered_days_ago;
    } else if (daysSinceDeliveryParam !== undefined && typeof daysSinceDeliveryParam === "number") {
      daysSinceDelivery = daysSinceDeliveryParam;
    }

    if (orderOrDays.isOpened !== undefined) {
      isOpened = Boolean(orderOrDays.isOpened);
    } else if (orderOrDays.is_opened !== undefined) {
      isOpened = Boolean(orderOrDays.is_opened);
    } else if (typeof daysSinceDeliveryParam === "boolean") {
      isOpened = daysSinceDeliveryParam;
    } else {
      isOpened = Boolean(isOpenedParam);
    }
  }

  // Handle damage claim check first
  if (isDamaged) {
    if (hoursSinceDelivery !== null && hoursSinceDelivery !== undefined && hoursSinceDelivery > BRAND_POLICIES.returns.damaged_item_report_window_hours) {
      return {
        allowed: false,
        eligible: false,
        action: "reject",
        isReplacement: false,
        reason: `Damaged items must be reported within 48 hours of delivery. This claim was reported after ${hoursSinceDelivery} hours.`
      };
    }
    return {
      allowed: true,
      eligible: true,
      action: "approve",
      isReplacement: true,
      reason: `Damaged item verified within 48 hours. Eligible for immediate free replacement or refund.`
    };
  }

  // If status is specified and not Delivered (e.g. Out for Delivery, Processing)
  if (orderStatus && orderStatus.toLowerCase() !== "delivered") {
    return {
      allowed: false,
      eligible: false,
      action: "reject",
      reason: `Products cannot be returned before physical delivery is completed. Current status: ${orderStatus}.`,
      days_since_delivery: daysSinceDelivery,
      is_opened: isOpened
    };
  }

  // If product is opened
  if (isOpened) {
    return {
      allowed: false,
      eligible: false,
      action: "reject",
      reason: `Due to cosmetic hygiene standards, opened or unsealed products cannot be returned. Original packaging with safety seal intact is required.`,
      days_since_delivery: daysSinceDelivery,
      is_opened: true
    };
  }

  // If delivery date is known and exceeds 7 days (e.g. ORD-102 delivered 14 days ago)
  if (daysSinceDelivery !== null && daysSinceDelivery !== undefined && daysSinceDelivery > BRAND_POLICIES.returns.max_return_window_days) {
    return {
      allowed: false,
      eligible: false,
      action: "reject",
      reason: `Return window expired. The order was delivered ${daysSinceDelivery} days ago, which exceeds Aura Skincare's strict 7-day return policy limit.`,
      days_since_delivery: daysSinceDelivery,
      is_opened: isOpened
    };
  }

  // If delivered within 7 days and unopened
  if (daysSinceDelivery !== null && daysSinceDelivery !== undefined && daysSinceDelivery <= BRAND_POLICIES.returns.max_return_window_days) {
    return {
      allowed: true,
      eligible: true,
      action: "approve",
      reason: `Eligible for return. The order was delivered ${daysSinceDelivery} days ago (within the 7-day return policy window) and the packaging is unopened.`,
      days_since_delivery: daysSinceDelivery,
      is_opened: false
    };
  }

  // If orderStatus is Delivered and no days given, default to approved or review required
  if (orderStatus.toLowerCase() === "delivered" && !isOpened) {
    return {
      allowed: true,
      eligible: true,
      action: "approve",
      reason: "Eligible for return within the 7-day delivery window with unopened packaging.",
      days_since_delivery: daysSinceDelivery,
      is_opened: false
    };
  }

  return {
    allowed: false,
    eligible: false,
    action: "reject",
    reason: "Return eligibility requires confirmation of delivery within 7 days and unopened condition.",
    days_since_delivery: daysSinceDelivery,
    is_opened: isOpened
  };
}

/**
 * Checks whether an incoming user query is out of scope for Aura Skincare.
 *
 * @param {string} query
 * @returns {object} Deflection recommendation
 */
export function isOutOfScope(query) {
  if (!query || typeof query !== "string") {
    return { outOfScope: false, isOutOfScope: false, category: null, deflection: null };
  }

  const q = query.trim().toLowerCase();
  if (!q) {
    return { outOfScope: false, isOutOfScope: false, category: null, deflection: null };
  }

  // Allow genuine skincare, order, shipping, return queries
  const isAuraQuery = /^(where is my order|how do i use|what is your shipping|can i return|track|order|serum|sunscreen|toner|face wash)/i.test(q);
  if (isAuraQuery && !/(flight|cricket|ticket|steroid|antibiotic)/i.test(q)) {
    return { outOfScope: false, isOutOfScope: false, category: null, deflection: null };
  }

  const outOfScopePatterns = [
    { category: "travel", regex: /\b(flight|airline|indigo|air india|hotel|ticket|train|irctc|boarding pass|airport|vacation booking)\b/i },
    { category: "medical", regex: /\b(prescribe|prescription|disease|cystic acne bleeding|bleeding skin|antibiotic|antibiotics|cure infection|steroid|steroids|eczema treatment)\b/i },
    { category: "general_trivia", regex: /\b(who won|cricket match|ipl|election|politics|prime minister|president|capital of|weather today|stock market|cryptocurrency)\b/i },
    { category: "tech_support", regex: /\b(fix my iphone|iphone wifi|windows update|wifi router|reboot laptop|coding in python|javascript error)\b/i }
  ];

  for (const { category, regex } of outOfScopePatterns) {
    if (regex.test(q)) {
      return {
        outOfScope: true,
        isOutOfScope: true,
        category,
        deflection: category === "medical"
          ? BRAND_POLICIES.deflections.medical_disclaimer
          : BRAND_POLICIES.deflections.out_of_scope_message
      };
    }
  }

  return {
    outOfScope: false,
    isOutOfScope: false,
    category: null,
    deflection: null
  };
}

/**
 * Returns complete brand system instruction text for Gemini Live setup
 */
export function getSystemPolicyInstruction() {
  return `
You are Aria, the Senior Customer Support Specialist at Aura Skincare, a premium clean skincare brand in India.

ROLE & PERSONA:
- Tone: Warm, friendly, deeply empathetic, polite, and reassuring with a professional Indian English conversational cadence.
- Delivery: Speak naturally with conversational Indian English phrasing (e.g., "Certainly!", "I'd be glad to help you with that", "Kindly share...", "No worries at all").
- Voice Optimizations: Keep all responses concise (1 to 2 sentences per turn), spoken in natural conversational sentences. Do NOT speak in lists, bullet points, asterisks, markdown, or computer code.
- Currency & Numbers: Always say currency as "rupees" (e.g., "six hundred and ninety-nine rupees"). Spell out tracking numbers clearly.

TOOLS:
- You have access to the tool \`get_order_details(order_id)\`.
- Whenever a customer asks about their order, package, shipment, delivery status, return, or cancellation, you MUST invoke \`get_order_details\` using the provided Order ID (e.g., ORD-101, ORD-102, ORD-103).
- If the customer does not provide their Order ID, politely ask for it before proceeding.
- If the order ID is not found, politely let them know and ask them to re-verify the ID from their confirmation email or SMS.

BRAND POLICIES & BUSINESS RULES:
1. Shipping Policy:
   - Free shipping on orders strictly above ₹499 (a flat ₹50 shipping fee applies on orders of ₹499 or below).
   - Standard delivery takes 3 to 5 business days across India via BlueDart, Delhivery, DTDC, and Xpressbees.

2. Return & Refund Policy:
   - Returns are accepted strictly within 7 calendar days of delivery for unopened, unused products in original packaging with the safety seal intact.
   - Damaged, defective, or incorrect items must be reported within 48 hours of delivery for an immediate free replacement.
   - POLICY ENFORCEMENT: If an order was delivered more than 7 days ago (such as ORD-102 delivered 14 days ago), you MUST politely REJECT the return request. Explain the 7-day policy warmly and offer skincare tips or product recommendations.

3. Cancellation Policy:
   - Orders can ONLY be cancelled while in "Processing" status (before dispatch).
   - For orders in "Processing" (such as ORD-103), confirm the cancellation immediately and inform the customer that their refund of ₹850 will be credited to their original payment method within 5 to 7 business days.
   - POLICY ENFORCEMENT: If an order is already "Shipped" or "Out for Delivery" (such as ORD-101), you MUST REJECT cancellation. Explain that it is already with the courier (BlueDart) and cannot be stopped in transit. Advise them they may refuse delivery at their doorstep if they no longer want it.

4. Out-of-Scope Queries:
   - If a customer asks questions unrelated to Aura Skincare (e.g., flight bookings, cricket scores, politics, or medical prescriptions), politely decline and state that you are dedicated to helping with Aura Skincare products, orders, and skincare routines.

GREETING:
- Start each new call warmly: "Hello! Welcome to Aura Skincare. I'm Aria, your skincare specialist. How can I help you today?"
`.trim();
}

export default {
  BRAND_POLICIES,
  calculateShippingFee,
  getDeliveryTimeline,
  canCancelOrder,
  canReturnOrder,
  isOutOfScope,
  getSystemPolicyInstruction
};
