/**
 * server/orderDatabase.js
 * Aura Skincare AI Voice Agent ("Aria") - Mock Order Database & Lookups
 *
 * Implements deterministic order retrieval, speech-to-text normalization,
 * policy enrichment, and cancellation mutations for ORD-101, ORD-102, and ORD-103.
 */

import { canCancelOrder, canReturnOrder } from './brandPolicy.js';

/**
 * Initial canonical seed data
 */
export const SEED_ORDERS = {
  'ORD-101': {
    id: 'ORD-101',
    order_id: 'ORD-101',
    customer_name: 'Priya Sharma',
    item: 'Vitamin C Serum (30ml)',
    items: [
      {
        name: 'Vitamin C Serum (30ml)',
        quantity: 1,
        price: 699
      }
    ],
    total_amount: 699,
    amount: 699,
    currency: 'INR',
    order_status: 'Out for Delivery',
    status: 'Out for Delivery',
    courier: 'BlueDart',
    tracking_number: 'BD-982103',
    order_date: '2026-09-29T10:30:00Z',
    delivery_date: null,
    delivered_days_ago: null,
    delivery_estimate: 'Today by 8:00 PM',
    timeline_notes: 'Dispatched 2 days ago, currently out for delivery today with BlueDart.'
  },
  'ORD-102': {
    id: 'ORD-102',
    order_id: 'ORD-102',
    customer_name: 'Rahul Verma',
    item: 'Hydrating Sunscreen SPF 50',
    items: [
      {
        name: 'Hydrating Sunscreen SPF 50',
        quantity: 1,
        price: 499
      }
    ],
    total_amount: 499,
    amount: 499,
    currency: 'INR',
    order_status: 'Delivered',
    status: 'Delivered',
    courier: 'Delhivery',
    tracking_number: 'DL-441029',
    order_date: '2026-09-14T11:15:00Z',
    delivered_date: '2026-09-17T15:45:00Z',
    delivered_days_ago: 14,
    delivery_estimate: 'Delivered on September 17, 2026',
    timeline_notes: 'Delivered 14 days ago by Delhivery.'
  },
  'ORD-103': {
    id: 'ORD-103',
    order_id: 'ORD-103',
    customer_name: 'Ananya Patel',
    item: 'Green Tea Face Wash + Toner',
    items: [
      {
        name: 'Green Tea Face Wash + Toner',
        quantity: 1,
        price: 850
      }
    ],
    total_amount: 850,
    amount: 850,
    currency: 'INR',
    order_status: 'Processing',
    status: 'Processing',
    courier: null,
    tracking_number: null,
    order_date: '2026-10-01T11:30:00Z',
    delivery_date: null,
    delivered_days_ago: null,
    delivery_estimate: 'Pending warehouse dispatch (Estimated 3-5 business days)',
    timeline_notes: 'Placed 3 hours ago. Currently being prepared at the central warehouse.'
  }
};

/**
 * In-memory active database storage
 */
let db = JSON.parse(JSON.stringify(SEED_ORDERS));

/**
 * Normalizes user/STT order ID inputs into the canonical "ORD-XXX" format.
 * Handles:
 * - Null / undefined inputs safely
 * - Numeric inputs (e.g. 101, "101" -> "ORD-101")
 * - Trimming whitespace ("  ORD-102  ")
 * - Case normalization ("ord-101" -> "ORD-101")
 * - Trailing punctuation ("ORD-101.", "ORD-103!", "ORD-102?")
 * - Word separation / speech phrasing ("order 101", "ORD 101", "ORD101", "order-102")
 *
 * @param {string|number} rawId
 * @returns {string|null} Normalized ID or null
 */
export function normalizeOrderId(rawId) {
  if (rawId === null || rawId === undefined) {
    return null;
  }

  let cleaned = String(rawId).trim();
  if (!cleaned) return null;

  // Strip trailing punctuation common in speech-to-text transcripts
  cleaned = cleaned.replace(/[.!?]+$/, '').trim();

  // Pure 3-digit number e.g. 101, "101" -> "ORD-101"
  if (/^\d{3}$/.test(cleaned)) {
    return `ORD-${cleaned}`;
  }

  // Spoken variants: "order 101", "order-101", "ord 101", "ord101", "order101"
  const speechPattern = /^(?:order|ord)[-\s]?(\d{3})$/i;
  const match = cleaned.match(speechPattern);
  if (match) {
    return `ORD-${match[1]}`;
  }

  // General ORD-XXX match
  const standardPattern = /^(ORD)[-\s]?(\d+)$/i;
  const standardMatch = cleaned.match(standardPattern);
  if (standardMatch) {
    return `ORD-${standardMatch[2]}`;
  }

  return cleaned.toUpperCase();
}

/**
 * Enriches order with calculated policy flags
 *
 * @param {object} rawRecord
 * @returns {object} Deep clone enriched with policy flags
 */
function enrichOrderWithPolicy(rawRecord) {
  const clone = JSON.parse(JSON.stringify(rawRecord));

  // Determine cancellation eligibility
  const cancelCheck = canCancelOrder(clone);
  clone.cancellation_eligible = cancelCheck.allowed;
  clone.is_cancellable = cancelCheck.allowed;

  // Determine return eligibility
  const returnCheck = canReturnOrder(clone);
  clone.return_eligible = returnCheck.allowed;
  clone.is_returnable = returnCheck.allowed;

  // Build policy notes
  const notes = [];
  if (clone.status === 'Out for Delivery') {
    notes.push('Out for Delivery with BlueDart (BD-982103). Cannot be cancelled in transit; customer may refuse delivery at doorstep.');
  } else if (clone.status === 'Delivered') {
    if (clone.delivered_days_ago && clone.delivered_days_ago > 7) {
      notes.push(`Delivered ${clone.delivered_days_ago} days ago. Exceeds the strict 7-day return policy limit; return not eligible.`);
    } else {
      notes.push('Delivered within 7 days. Return eligible for unopened items.');
    }
  } else if (clone.status === 'Processing') {
    notes.push('Order is currently in Processing status and eligible for immediate cancellation.');
  } else if (clone.status === 'Cancelled') {
    notes.push('Order has already been cancelled.');
  } else {
    notes.push(`Current status: ${clone.status}.`);
  }

  clone.policy_notes = notes.join(' ');
  clone.status_notes = clone.policy_notes;

  return clone;
}

/**
 * Look up order details by Order ID.
 * Returns standardized payload compatible with Gemini tool responses and REST API.
 *
 * @param {string|number} orderId - Raw or formatted order ID
 * @returns {object} Standardized lookup result
 */
export function getOrderDetails(orderId) {
  try {
    const normalizedId = normalizeOrderId(orderId);

    if (!normalizedId || !db[normalizedId]) {
      return {
        status: 'not_found',
        found: false,
        order_id: normalizedId || (typeof orderId === 'string' ? orderId : null),
        message: 'Order ID not found in database. Please verify the order number.'
      };
    }

    const orderData = enrichOrderWithPolicy(db[normalizedId]);

    return {
      status: 'success',
      found: true,
      order_id: normalizedId,
      order: orderData,
      customer_name: orderData.customer_name,
      item: orderData.item,
      items: orderData.items,
      total_amount: orderData.total_amount,
      amount: orderData.amount,
      order_status: orderData.order_status,
      courier: orderData.courier,
      tracking_number: orderData.tracking_number,
      delivered_days_ago: orderData.delivered_days_ago,
      cancellation_eligible: orderData.cancellation_eligible,
      return_eligible: orderData.return_eligible,
      policy_notes: orderData.policy_notes
    };
  } catch (err) {
    return {
      status: 'not_found',
      found: false,
      order_id: orderId ? String(orderId) : null,
      message: 'Order ID not found in database. Please verify the order number.'
    };
  }
}

/**
 * Cancels an order in the database if and only if its status is "Processing".
 *
 * @param {string|number} orderId - Order ID to cancel
 * @returns {object} Mutation result with updated order record
 */
export function cancelOrder(orderId) {
  try {
    const normalizedId = normalizeOrderId(orderId);

    if (!normalizedId || !db[normalizedId]) {
      return {
        success: false,
        status: 'not_found',
        found: false,
        message: 'Order ID not found in database. Cannot cancel.'
      };
    }

    const currentOrder = db[normalizedId];

    if (currentOrder.status === 'Cancelled') {
      return {
        success: false,
        status: 'rejected',
        allowed: false,
        message: 'Order is already cancelled.',
        order: enrichOrderWithPolicy(currentOrder)
      };
    }

    const cancelCheck = canCancelOrder(currentOrder);

    if (!cancelCheck.allowed) {
      return {
        success: false,
        status: 'rejected',
        allowed: false,
        message: cancelCheck.reason,
        order: enrichOrderWithPolicy(currentOrder)
      };
    }

    // Apply mutation
    currentOrder.order_status = 'Cancelled';
    currentOrder.status = 'Cancelled';
    currentOrder.cancelled_at = new Date().toISOString();
    currentOrder.refund_amount = currentOrder.total_amount;
    currentOrder.refund_status = 'Initiated';
    currentOrder.refund_timeline = '5-7 business days to original payment method';
    currentOrder.timeline_notes = `Cancelled on ${currentOrder.cancelled_at}. Refund of ₹${currentOrder.refund_amount} initiated.`;

    const updatedOrder = enrichOrderWithPolicy(currentOrder);

    return {
      success: true,
      status: 'success',
      message: `Order ${normalizedId} has been successfully cancelled. A full refund of ₹${updatedOrder.total_amount} has been initiated to the original payment method (5-7 business days).`,
      order: updatedOrder
    };
  } catch (err) {
    return {
      success: false,
      status: 'error',
      message: 'An unexpected error occurred while processing order cancellation.'
    };
  }
}

/**
 * Resets the in-memory database to original seed data.
 */
export function resetOrderDatabase() {
  db = JSON.parse(JSON.stringify(SEED_ORDERS));
  return true;
}

/**
 * Alias for resetOrderDatabase
 */
export function resetDatabase() {
  return resetOrderDatabase();
}

/**
 * Returns all orders enriched with policies
 */
export function getAllOrders() {
  return Object.values(db).map(enrichOrderWithPolicy);
}

export const MOCK_ORDERS = SEED_ORDERS;

export default {
  SEED_ORDERS,
  MOCK_ORDERS,
  normalizeOrderId,
  getOrderDetails,
  cancelOrder,
  resetOrderDatabase,
  resetDatabase,
  getAllOrders
};
