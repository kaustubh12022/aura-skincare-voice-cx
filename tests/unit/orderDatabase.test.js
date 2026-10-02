/**
 * tests/unit/orderDatabase.test.js
 * Comprehensive unit test suite for Aura Skincare Mock Order Database.
 * Verifies R2 requirements, BVA boundaries, mutation state, and speech-to-text normalizations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadOrderDatabase } from '../helpers/moduleLoader.js';

describe('Order Database Unit Tests (R2 & BVA)', async () => {
  const {
    getOrderDetails,
    cancelOrder,
    normalizeOrderId,
    resetOrderDatabase,
    getAllOrders
  } = await loadOrderDatabase();

  beforeEach(() => {
    // Restore pristine seed state before every test
    resetOrderDatabase();
  });

  // --- Tier 1: Core Order Lookups & Records ---

  describe('Tier 1: Canonical Order Lookups', () => {
    it('TC-1.5.1: accurately retrieves ORD-101 (Priya Sharma, Out for Delivery)', () => {
      const res = getOrderDetails('ORD-101');

      expect(res.status).toBe('success');
      expect(res.found).toBe(true);
      expect(res.order_id).toBe('ORD-101');
      expect(res.customer_name).toBe('Priya Sharma');
      expect(res.total_amount).toBe(699);
      expect(res.order_status).toBe('Out for Delivery');
      expect(res.order.status).toBe('Out for Delivery');
      expect(res.courier).toBe('BlueDart');
      expect(res.tracking_number).toBe('BD-982103');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].name).toContain('Vitamin C Serum');
    });

    it('TC-1.5.2: accurately retrieves ORD-102 (Rahul Verma, Delivered 14 days ago)', () => {
      const res = getOrderDetails('ORD-102');

      expect(res.status).toBe('success');
      expect(res.found).toBe(true);
      expect(res.order_id).toBe('ORD-102');
      expect(res.customer_name).toBe('Rahul Verma');
      expect(res.total_amount).toBe(499);
      expect(res.order_status).toBe('Delivered');
      expect(res.order.status).toBe('Delivered');
      expect(res.delivered_days_ago).toBe(14);
      expect(res.courier).toBe('Delhivery');
      expect(res.tracking_number).toBe('DL-441029');
    });

    it('TC-1.5.3: accurately retrieves ORD-103 (Ananya Patel, Processing)', () => {
      const res = getOrderDetails('ORD-103');

      expect(res.status).toBe('success');
      expect(res.found).toBe(true);
      expect(res.order_id).toBe('ORD-103');
      expect(res.customer_name).toBe('Ananya Patel');
      expect(res.total_amount).toBe(850);
      expect(res.order_status).toBe('Processing');
      expect(res.order.status).toBe('Processing');
      expect(res.courier).toBeNull();
      expect(res.tracking_number).toBeNull();
    });

    it('accurately lists all canonical orders via getAllOrders', () => {
      const orders = getAllOrders();
      expect(orders).toHaveLength(3);
      const ids = orders.map(o => o.order_id);
      expect(ids).toContain('ORD-101');
      expect(ids).toContain('ORD-102');
      expect(ids).toContain('ORD-103');
    });
  });

  // --- Tier 1: Policy Enrichment Fields ---

  describe('Tier 1: Policy Flag Enrichment', () => {
    it('enriches ORD-101 with cancellation_eligible = false (Out for Delivery)', () => {
      const res = getOrderDetails('ORD-101');
      expect(res.cancellation_eligible).toBe(false);
      expect(res.return_eligible).toBe(false);
      expect(res.policy_notes.toLowerCase()).toContain('out for delivery');
    });

    it('enriches ORD-102 with return_eligible = false (Delivered 14 days ago > 7 days)', () => {
      const res = getOrderDetails('ORD-102');
      expect(res.cancellation_eligible).toBe(false);
      expect(res.return_eligible).toBe(false);
      expect(res.policy_notes.toLowerCase()).toContain('7');
    });

    it('enriches ORD-103 with cancellation_eligible = true (Processing)', () => {
      const res = getOrderDetails('ORD-103');
      expect(res.cancellation_eligible).toBe(true);
      expect(res.return_eligible).toBe(false);
      expect(res.policy_notes.toLowerCase()).toContain('processing');
    });
  });

  // --- Tier 2: Cancellation Mutations ---

  describe('Tier 2: Order Cancellation Mutation (cancelOrder)', () => {
    it('accepts and cancels ORD-103 when in Processing status', () => {
      const result = cancelOrder('ORD-103');

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.message).toContain('cancelled');
      expect(result.order.status).toBe('Cancelled');
      expect(result.order.refund_amount).toBe(850);
      expect(result.order.refund_status).toBe('Initiated');

      // Subsequent query confirms updated status in database
      const refreshed = getOrderDetails('ORD-103');
      expect(refreshed.order_status).toBe('Cancelled');
      expect(refreshed.order.status).toBe('Cancelled');
      expect(refreshed.cancellation_eligible).toBe(false);
    });

    it('rejects cancellation for ORD-101 because status is Out for Delivery', () => {
      const result = cancelOrder('ORD-101');

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.message.toLowerCase()).toContain('out for delivery');

      // Database status remains unchanged
      const refreshed = getOrderDetails('ORD-101');
      expect(refreshed.order_status).toBe('Out for Delivery');
      expect(refreshed.order.status).toBe('Out for Delivery');
    });

    it('rejects cancellation for ORD-102 because status is Delivered', () => {
      const result = cancelOrder('ORD-102');

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.message.toLowerCase()).toContain('delivered');

      const refreshed = getOrderDetails('ORD-102');
      expect(refreshed.order_status).toBe('Delivered');
      expect(refreshed.order.status).toBe('Delivered');
    });

    it('rejects cancellation on already cancelled order', () => {
      // Cancel ORD-103 first
      cancelOrder('ORD-103');
      // Attempt to cancel again
      const secondAttempt = cancelOrder('ORD-103');
      expect(secondAttempt.success).toBe(false);
      expect(secondAttempt.status).toBe('rejected');
    });

    it('resetOrderDatabase restores original status after cancellation', () => {
      cancelOrder('ORD-103');
      expect(getOrderDetails('ORD-103').order_status).toBe('Cancelled');

      resetOrderDatabase();
      expect(getOrderDetails('ORD-103').order_status).toBe('Processing');
    });
  });

  // --- Tier 2: Normalization & Speech-to-Text Variances ---

  describe('Tier 2: Speech-to-Text Normalization (normalizeOrderId)', () => {
    it('normalizes lowercase strings (ord-101 -> ORD-101)', () => {
      expect(normalizeOrderId('ord-101')).toBe('ORD-101');
      const res = getOrderDetails('ord-101');
      expect(res.found).toBe(true);
      expect(res.order_id).toBe('ORD-101');
    });

    it('normalizes whitespace around order ID ("  ORD-102  ")', () => {
      expect(normalizeOrderId('  ORD-102  ')).toBe('ORD-102');
      const res = getOrderDetails('  ORD-102  ');
      expect(res.found).toBe(true);
      expect(res.order_id).toBe('ORD-102');
    });

    it('strips speech transcript trailing punctuation ("ORD-101." / "ORD-103!")', () => {
      expect(normalizeOrderId('ORD-101.')).toBe('ORD-101');
      expect(normalizeOrderId('ORD-103!')).toBe('ORD-103');
      expect(normalizeOrderId('ORD-102?')).toBe('ORD-102');

      const res = getOrderDetails('ORD-101.');
      expect(res.found).toBe(true);
    });

    it('handles spoken prefix variants: "order 101", "ORD 101", "ORD101"', () => {
      expect(normalizeOrderId('order 101')).toBe('ORD-101');
      expect(normalizeOrderId('ORD 101')).toBe('ORD-101');
      expect(normalizeOrderId('ORD101')).toBe('ORD-101');
      expect(normalizeOrderId('order-102')).toBe('ORD-102');

      const res = getOrderDetails('order 103');
      expect(res.found).toBe(true);
      expect(res.order_id).toBe('ORD-103');
    });

    it('handles pure numeric inputs ("101" -> "ORD-101")', () => {
      expect(normalizeOrderId('101')).toBe('ORD-101');
      expect(normalizeOrderId(102)).toBe('ORD-102');

      const res = getOrderDetails(103);
      expect(res.found).toBe(true);
      expect(res.order_id).toBe('ORD-103');
    });
  });

  // --- Tier 2: Boundary & Corner Cases / Error Handling ---

  describe('Tier 2: Invalid / Unknown Order ID Handling', () => {
    it('TC-1.5.4: returns not_found for non-existent order ORD-999 without crashing', () => {
      const res = getOrderDetails('ORD-999');

      expect(res.status).toBe('not_found');
      expect(res.found).toBe(false);
      expect(res.order_id).toBe('ORD-999');
      expect(res.message).toContain('not found in database');
    });

    it('returns not_found for empty string input ("")', () => {
      const res = getOrderDetails('');
      expect(res.status).toBe('not_found');
      expect(res.found).toBe(false);
    });

    it('handles null and undefined safely without throwing exception', () => {
      expect(() => getOrderDetails(null)).not.toThrow();
      expect(() => getOrderDetails(undefined)).not.toThrow();

      const resNull = getOrderDetails(null);
      expect(resNull.found).toBe(false);

      const resUndef = getOrderDetails(undefined);
      expect(resUndef.found).toBe(false);
    });

    it('handles arbitrary malformed strings safely ("UNKNOWN_XYZ_9999")', () => {
      const res = getOrderDetails('UNKNOWN_XYZ_9999');
      expect(res.status).toBe('not_found');
      expect(res.found).toBe(false);
    });

    it('handles SQL / special characters without crashing or breaking records', () => {
      const malicious = "ORD-101'; DROP TABLE orders;--";
      expect(() => getOrderDetails(malicious)).not.toThrow();
      // Should safely not crash and maintain database integrity
      const regular = getOrderDetails('ORD-101');
      expect(regular.found).toBe(true);
    });

    it('cancelOrder returns not_found for unknown order ID', () => {
      const res = cancelOrder('ORD-999');
      expect(res.success).toBe(false);
      expect(res.status).toBe('not_found');
    });
  });
});
