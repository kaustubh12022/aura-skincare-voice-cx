/**
 * tests/mocks/referenceOrderDatabase.js
 * Authoritative reference implementation of Aura Skincare Mock Order Database
 * matching specifications in PROJECT.md and ORIGINAL_REQUEST.md §R2.
 */

import { canCancelOrder, canReturnOrder } from './referenceBrandPolicy.js';

const SEED_ORDERS = {
  "ORD-101": {
    id: "ORD-101",
    order_id: "ORD-101",
    customer_name: "Priya Sharma",
    item: "Vitamin C Serum (30ml)",
    items: [
      {
        name: "Vitamin C Serum (30ml)",
        quantity: 1,
        price: 699
      }
    ],
    total_amount: 699,
    amount: 699,
    currency: "INR",
    order_status: "Out for Delivery",
    status: "Out for Delivery",
    courier: "BlueDart",
    tracking_number: "BD-982103",
    order_date: "2026-09-29T10:30:00Z",
    delivery_date: null,
    delivered_days_ago: null,
    delivery_estimate: "Today by 8:00 PM",
    timeline_notes: "Dispatched 2 days ago, currently out for delivery today with BlueDart."
  },
  "ORD-102": {
    id: "ORD-102",
    order_id: "ORD-102",
    customer_name: "Rahul Verma",
    item: "Hydrating Sunscreen SPF 50",
    items: [
      {
        name: "Hydrating Sunscreen SPF 50",
        quantity: 1,
        price: 499
      }
    ],
    total_amount: 499,
    amount: 499,
    currency: "INR",
    order_status: "Delivered",
    status: "Delivered",
    courier: "Delhivery",
    tracking_number: "DL-441029",
    order_date: "2026-09-14T11:15:00Z",
    delivery_date: "2026-09-17T15:45:00Z",
    delivered_days_ago: 14,
    delivery_estimate: "Delivered on September 17, 2026",
    timeline_notes: "Delivered 14 days ago by Delhivery."
  },
  "ORD-103": {
    id: "ORD-103",
    order_id: "ORD-103",
    customer_name: "Ananya Patel",
    item: "Green Tea Face Wash + Toner",
    items: [
      {
        name: "Green Tea Face Wash + Toner",
        quantity: 1,
        price: 850
      }
    ],
    total_amount: 850,
    amount: 850,
    currency: "INR",
    order_status: "Processing",
    status: "Processing",
    courier: null,
    tracking_number: null,
    order_date: "2026-10-01T11:30:00Z",
    delivery_date: null,
    delivered_days_ago: null,
    delivery_estimate: "Pending warehouse dispatch (Estimated 3-5 business days)",
    timeline_notes: "Placed 3 hours ago. Currently being prepared at the central warehouse."
  }
};

let db = JSON.parse(JSON.stringify(SEED_ORDERS));

/**
 * Normalizes user/STT order ID inputs into the canonical "ORD-XXX" format.
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

  // Strip trailing punctuation
  cleaned = cleaned.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, (match, offset) => {
    if (match === '-' && offset > 0 && offset < cleaned.length - 1) {
      return '-';
    }
    return '';
  }).trim();

  cleaned = cleaned.toUpperCase();

  const orderPrefixMatch = cleaned.match(/^(?:ORDER|ORD)[-\s]?(\d+)$/i);
  if (orderPrefixMatch) {
    return `ORD-${orderPrefixMatch[1]}`;
  }

  const digitsMatch = cleaned.match(/^(\d{3})$/);
  if (digitsMatch) {
    return `ORD-${digitsMatch[1]}`;
  }

  if (/^ORD-\d+$/.test(cleaned)) {
    return cleaned;
  }

  return cleaned;
}

/**
 * Enriches order record with calculated policy eligibility fields.
 *
 * @param {object} rawRecord
 * @returns {object} Deep clone enriched with policy flags
 */
function enrichOrderWithPolicy(rawRecord) {
  const clone = JSON.parse(JSON.stringify(rawRecord));

  const cancelCheck = canCancelOrder(clone);
  clone.cancellation_eligible = cancelCheck.allowed;
  clone.is_cancellable = cancelCheck.allowed;
  clone.eligible_for_cancellation = cancelCheck.allowed;

  const returnCheck = canReturnOrder(clone);
  clone.return_eligible = returnCheck.allowed;
  clone.is_returnable = returnCheck.allowed;
  clone.eligible_for_return = returnCheck.allowed;

  const notes = [];
  if (clone.cancellation_eligible) {
    notes.push(cancelCheck.reason);
  } else {
    notes.push(`Cancellation: ${cancelCheck.reason}`);
  }

  if (clone.status === "Delivered") {
    notes.push(`Return: ${returnCheck.reason}`);
  } else if (clone.status === "Out for Delivery") {
    notes.push("Order is out for delivery today. Cancellation cannot be processed in transit; customer may refuse at doorstep.");
  }

  clone.policy_notes = notes.join(" ");
  clone.status_notes = clone.policy_notes;

  return clone;
}

/**
 * Look up order details by Order ID.
 *
 * @param {string|number} orderId - Raw or formatted order ID
 * @returns {object} Standardized lookup result
 */
export function getOrderDetails(orderId) {
  try {
    const normalizedId = normalizeOrderId(orderId);

    if (!normalizedId || !db[normalizedId]) {
      return {
        status: "not_found",
        found: false,
        order_id: normalizedId || orderId || null,
        message: "Order ID not found in database. Please verify the order number."
      };
    }

    const orderData = enrichOrderWithPolicy(db[normalizedId]);

    return {
      status: "success",
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
  } catch (error) {
    return {
      status: "error",
      found: false,
      order_id: orderId || null,
      message: "An internal error occurred while retrieving order details."
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
        status: "not_found",
        found: false,
        message: "Order ID not found in database. Cannot cancel."
      };
    }

    const currentOrder = db[normalizedId];
    const cancelCheck = canCancelOrder(currentOrder);

    if (!cancelCheck.allowed) {
      return {
        success: false,
        status: "rejected",
        allowed: false,
        message: cancelCheck.reason,
        order: enrichOrderWithPolicy(currentOrder)
      };
    }

    currentOrder.order_status = "Cancelled";
    currentOrder.status = "Cancelled";
    currentOrder.cancelled_at = new Date().toISOString();
    currentOrder.refund_amount = currentOrder.total_amount;
    currentOrder.refund_status = "Initiated";
    currentOrder.refund_timeline = "5-7 business days to original payment method";
    currentOrder.timeline_notes = `Cancelled on ${currentOrder.cancelled_at}. Refund of ₹${currentOrder.refund_amount} initiated.`;

    const updatedOrder = enrichOrderWithPolicy(currentOrder);

    return {
      success: true,
      status: "success",
      message: `Order ${normalizedId} has been successfully cancelled. A full refund of ₹${updatedOrder.total_amount} has been initiated to the original payment method (5-7 business days).`,
      order: updatedOrder
    };
  } catch (error) {
    return {
      success: false,
      status: "error",
      message: "An unexpected error occurred while processing order cancellation."
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
 * Export raw active database instance for inspectability
 */
export function getAllOrders() {
  return Object.values(db).map(enrichOrderWithPolicy);
}

export default {
  normalizeOrderId,
  getOrderDetails,
  cancelOrder,
  resetOrderDatabase,
  getAllOrders
};
