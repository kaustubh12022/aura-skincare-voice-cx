/**
 * tests/mocks/referenceBrandPolicy.js
 * Authoritative reference implementation of Aura Skincare brand policy guardrails
 * matching specifications in PROJECT.md and ORIGINAL_REQUEST.md §R3.
 */

export const BRAND_POLICIES = {
  brand_name: "Aura Skincare",
  currency: "INR",
  currency_symbol: "₹",
  shipping: {
    free_shipping_threshold: 499, // Orders > 499 get free shipping
    standard_shipping_fee: 50,    // Orders <= 499 incur ₹50 fee
    delivery_window_business_days_min: 3,
    delivery_window_business_days_max: 5,
    delivery_timeline_text: "3 to 5 business days across India",
    courier_partners: ["BlueDart", "Delhivery", "DTDC", "Xpressbees"],
  },
  returns: {
    max_return_window_days: 7, // Strictly within 7 days of delivery
    damaged_item_report_window_hours: 48, // Must report damage within 48h
    packaging_requirement: "Unopened, unused, in original packaging with safety seal intact",
    hygiene_restriction: "Due to cosmetic hygiene standards, opened or used skincare products cannot be returned.",
    refund_processing_business_days: "5 to 7 business days following warehouse quality inspection"
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
 * Computes shipping fees and eligibility based on total order amount.
 * Rule: Free on orders above ₹499 (orderAmount > 499). Flat ₹50 fee otherwise.
 *
 * @param {number} orderAmount
 * @returns {object} Shipping calculation outcome
 */
export function calculateShippingFee(orderAmount) {
  const numericAmount = Number(orderAmount) || 0;
  const isFree = numericAmount > BRAND_POLICIES.shipping.free_shipping_threshold;
  const fee = isFree ? 0 : BRAND_POLICIES.shipping.standard_shipping_fee;

  return {
    order_amount: numericAmount,
    threshold: BRAND_POLICIES.shipping.free_shipping_threshold,
    shipping_fee: fee,
    is_free: isFree,
    delivery_timeline: BRAND_POLICIES.shipping.delivery_timeline_text,
    summary: isFree
      ? `Qualifies for Free Standard Shipping (order exceeds ₹${BRAND_POLICIES.shipping.free_shipping_threshold}). Estimated delivery in 3-5 business days.`
      : `Standard shipping fee of ₹${fee} applies on orders of ₹${BRAND_POLICIES.shipping.free_shipping_threshold} or below. Estimated delivery in 3-5 business days.`
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
      reason: "Order is in Processing status and eligible for immediate cancellation and 100% refund."
    };
  }

  if (normalizedStatus === "out for delivery") {
    return {
      allowed: false,
      action: "reject",
      status: "Out for Delivery",
      reason: "Order is already Out for Delivery and cannot be cancelled en route. You may refuse delivery at your doorstep."
    };
  }

  if (normalizedStatus === "shipped") {
    return {
      allowed: false,
      action: "reject",
      status: "Shipped",
      reason: "Order has already been shipped from our warehouse and cannot be cancelled in transit."
    };
  }

  if (normalizedStatus === "delivered") {
    return {
      allowed: false,
      action: "reject",
      status: "Delivered",
      reason: "Order has already been delivered. Cancellation is not possible; you may check return eligibility within 7 days."
    };
  }

  if (normalizedStatus === "cancelled") {
    return {
      allowed: false,
      action: "reject",
      status: "Cancelled",
      reason: "Order is already cancelled."
    };
  }

  return {
    allowed: false,
    action: "reject",
    status: status || "Unknown",
    reason: `Orders in '${status || "Unknown"}' status are not eligible for cancellation. Only 'Processing' orders may be cancelled.`
  };
}

/**
 * Evaluates whether an order or item is eligible for return.
 * Rules:
 * - Must be delivered
 * - Delivered within 7 calendar days
 * - Product must be unopened and unused
 *
 * @param {object|number} orderOrDays - Order object or numeric days since delivery
 * @param {number} [daysSinceDeliveryParam] - Optional explicit days since delivery
 * @param {boolean} [isOpenedParam=false] - Whether product seal was opened
 * @returns {object} Return evaluation outcome
 */
export function canReturnOrder(orderOrDays, daysSinceDeliveryParam, isOpenedParam = false) {
  let daysSinceDelivery = null;
  let isOpened = false;
  let orderStatus = "";

  if (typeof orderOrDays === "number") {
    daysSinceDelivery = orderOrDays;
    isOpened = Boolean(daysSinceDeliveryParam);
  } else if (orderOrDays && typeof orderOrDays === "object") {
    orderStatus = (orderOrDays.order_status || orderOrDays.status || "").trim();
    daysSinceDelivery = daysSinceDeliveryParam !== undefined 
      ? daysSinceDeliveryParam 
      : (orderOrDays.delivered_days_ago !== undefined ? orderOrDays.delivered_days_ago : null);
    isOpened = isOpenedParam || Boolean(orderOrDays.is_opened);
  }

  // If status is specified and not Delivered
  if (orderStatus && orderStatus.toLowerCase() !== "delivered") {
    return {
      allowed: false,
      action: "reject",
      reason: `Products cannot be returned before physical delivery is completed. Current status: ${orderStatus}.`,
      days_since_delivery: daysSinceDelivery,
      is_opened: isOpened
    };
  }

  // If delivery date is known and exceeds 7 days (e.g. ORD-102 delivered 14 days ago)
  if (daysSinceDelivery !== null && daysSinceDelivery > BRAND_POLICIES.returns.max_return_window_days) {
    return {
      allowed: false,
      action: "reject",
      reason: `Return window expired. The order was delivered ${daysSinceDelivery} days ago, which exceeds Aura Skincare's strict ${BRAND_POLICIES.returns.max_return_window_days}-day return policy limit.`,
      days_since_delivery: daysSinceDelivery,
      is_opened: isOpened
    };
  }

  // If product is opened
  if (isOpened) {
    return {
      allowed: false,
      action: "reject",
      reason: `Due to cosmetic hygiene standards, opened or unsealed products cannot be returned.`,
      days_since_delivery: daysSinceDelivery,
      is_opened: true
    };
  }

  // If delivered within 7 days and unopened
  if (daysSinceDelivery !== null && daysSinceDelivery <= BRAND_POLICIES.returns.max_return_window_days) {
    return {
      allowed: true,
      action: "approve",
      reason: `Eligible for return. The order was delivered ${daysSinceDelivery} days ago (within the ${BRAND_POLICIES.returns.max_return_window_days}-day window) and the packaging is unopened.`,
      days_since_delivery: daysSinceDelivery,
      is_opened: false
    };
  }

  // Fallback if delivery days unknown
  return {
    allowed: false,
    action: "review_required",
    reason: `Return eligibility depends on verification of delivery date (must be within 7 days) and product packaging status.`,
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
    return { outOfScope: false, category: null, deflection: null };
  }

  const q = query.toLowerCase();

  const outOfScopePatterns = [
    { category: "travel", regex: /\b(flight|airline|airplane|hotel|ticket|train|irctc|boarding pass|airport|vacation booking)\b/i },
    { category: "medical", regex: /\b(prescribe|prescription|disease|cystic acne treatment|bleeding skin|antibiotic|cure infection|steroid|eczema treatment)\b/i },
    { category: "general_trivia", regex: /\b(who won|cricket match|ipl|election|politics|prime minister|capital of|weather today|stock market|cryptocurrency)\b/i },
    { category: "tech_support", regex: /\b(fix my iphone|windows update|wifi router|reboot laptop|coding in python|javascript error)\b/i }
  ];

  for (const { category, regex } of outOfScopePatterns) {
    if (regex.test(q)) {
      return {
        outOfScope: true,
        category,
        deflection: category === "medical" 
          ? BRAND_POLICIES.deflections.medical_disclaimer
          : BRAND_POLICIES.deflections.out_of_scope_message
      };
    }
  }

  return {
    outOfScope: false,
    category: null,
    deflection: null
  };
}

export default {
  BRAND_POLICIES,
  calculateShippingFee,
  canCancelOrder,
  canReturnOrder,
  isOutOfScope
};
