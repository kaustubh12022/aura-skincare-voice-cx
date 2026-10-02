/**
 * tests/unit/brandPolicy.test.js
 * Comprehensive unit tests for Aura Skincare Brand Policy Guardrails.
 * Covers:
 * - Shipping fee calculation & ₹499 threshold
 * - 7-day return expiration and unopened hygiene requirements
 * - Cancellation rules across order lifecycle states
 * - Out-of-scope query detection and deflection
 */

import { describe, it, expect } from 'vitest';
import { loadBrandPolicy } from '../helpers/moduleLoader.js';

describe('Brand Policy Engine Unit Tests (R3)', async () => {
  const {
    calculateShippingFee,
    canCancelOrder,
    canReturnOrder,
    isOutOfScope,
    BRAND_POLICIES
  } = await loadBrandPolicy();

  // --- Shipping Policy ---

  describe('Shipping Policy Rules (Threshold & Delivery Timelines)', () => {
    it('TC-1.6.1: provides free shipping for orders strictly above ₹499', () => {
      // Test above threshold
      const res500 = calculateShippingFee(500);
      expect(res500.is_free).toBe(true);
      expect(res500.shipping_fee).toBe(0);

      const res699 = calculateShippingFee(699); // ORD-101 price
      expect(res699.is_free).toBe(true);
      expect(res699.shipping_fee).toBe(0);

      const res850 = calculateShippingFee(850); // ORD-103 price
      expect(res850.is_free).toBe(true);
      expect(res850.shipping_fee).toBe(0);
    });

    it('TC-2.2.6: charges flat ₹50 shipping fee on orders of exactly ₹499 (Boundary)', () => {
      const res499 = calculateShippingFee(499); // ORD-102 price
      expect(res499.is_free).toBe(false);
      expect(res499.shipping_fee).toBe(50);
      expect(res499.summary).toContain('50');
    });

    it('charges flat ₹50 shipping fee on orders below ₹499', () => {
      const res299 = calculateShippingFee(299);
      expect(res299.is_free).toBe(false);
      expect(res299.shipping_fee).toBe(50);

      const resZero = calculateShippingFee(0);
      expect(resZero.is_free).toBe(false);
      expect(resZero.shipping_fee).toBe(50);
    });

    it('specifies standard delivery window of 3 to 5 business days', () => {
      const res = calculateShippingFee(699);
      expect(res.delivery_timeline.toLowerCase()).toContain('3 to 5');
      expect(res.delivery_timeline.toLowerCase()).toContain('business days');
    });

    it('handles string amounts and invalid numbers safely', () => {
      const resString = calculateShippingFee('699');
      expect(resString.is_free).toBe(true);
      expect(resString.shipping_fee).toBe(0);

      const resInvalid = calculateShippingFee('invalid');
      expect(resInvalid.is_free).toBe(false);
      expect(resInvalid.shipping_fee).toBe(50);
    });
  });

  // --- Return & Refund Policy ---

  describe('Return & Refund Policy Guardrails (7-Day Limit & Hygiene)', () => {
    it('TC-1.6.2: rejects return for ORD-102 because it was delivered 14 days ago', () => {
      const ord102 = {
        order_status: 'Delivered',
        delivered_days_ago: 14,
        is_opened: false
      };

      const result = canReturnOrder(ord102);
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
      expect(result.reason).toContain('14');
      expect(result.reason).toContain('7');
    });

    it('TC-2.2.1: approves return for unopened order delivered exactly 7 days ago (Boundary)', () => {
      const order = {
        order_status: 'Delivered',
        delivered_days_ago: 7,
        is_opened: false
      };

      const result = canReturnOrder(order);
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('approve');
      expect(result.reason.toLowerCase()).toContain('eligible');
    });

    it('TC-2.2.2: rejects return for order delivered 8 days ago (Boundary)', () => {
      const order = {
        order_status: 'Delivered',
        delivered_days_ago: 8,
        is_opened: false
      };

      const result = canReturnOrder(order);
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
      expect(result.reason.toLowerCase()).toContain('expired');
    });

    it('approves return for order delivered 2 days ago when unopened', () => {
      const order = {
        order_status: 'Delivered',
        delivered_days_ago: 2,
        is_opened: false
      };

      const result = canReturnOrder(order);
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('approve');
    });

    it('rejects return if cosmetic product is opened / unsealed even within 7 days', () => {
      const order = {
        order_status: 'Delivered',
        delivered_days_ago: 2,
        is_opened: true
      };

      const result = canReturnOrder(order);
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
      expect(result.reason.toLowerCase()).toContain('opened');
      expect(result.reason.toLowerCase()).toContain('hygiene');
    });

    it('rejects return if order is not delivered yet (e.g. Processing or In Transit)', () => {
      const inTransit = { order_status: 'Out for Delivery' };
      const resTransit = canReturnOrder(inTransit);
      expect(resTransit.allowed).toBe(false);

      const processing = { order_status: 'Processing' };
      const resProc = canReturnOrder(processing);
      expect(resProc.allowed).toBe(false);
    });
  });

  // --- Cancellation Policy ---

  describe('Cancellation Policy Guardrails (Status Lifecycle)', () => {
    it('TC-1.6.4: permits cancellation for orders in Processing status (ORD-103)', () => {
      const ord103 = { status: 'Processing' };
      const result = canCancelOrder(ord103);

      expect(result.allowed).toBe(true);
      expect(result.action).toBe('approve');
      expect(result.reason.toLowerCase()).toContain('processing');
    });

    it('TC-1.6.3: rejects cancellation for orders in Out for Delivery status (ORD-101)', () => {
      const ord101 = { status: 'Out for Delivery' };
      const result = canCancelOrder(ord101);

      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
      expect(result.reason.toLowerCase()).toContain('out for delivery');
      expect(result.reason.toLowerCase()).toContain('refuse delivery');
    });

    it('rejects cancellation for orders in Shipped status', () => {
      const shipped = { status: 'Shipped' };
      const result = canCancelOrder(shipped);

      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
      expect(result.reason.toLowerCase()).toContain('shipped');
    });

    it('rejects cancellation for orders in Delivered status', () => {
      const delivered = { status: 'Delivered' };
      const result = canCancelOrder(delivered);

      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
      expect(result.reason.toLowerCase()).toContain('delivered');
    });

    it('handles raw status strings as well as objects', () => {
      expect(canCancelOrder('Processing').allowed).toBe(true);
      expect(canCancelOrder('Out for Delivery').allowed).toBe(false);
      expect(canCancelOrder('Shipped').allowed).toBe(false);
      expect(canCancelOrder('Delivered').allowed).toBe(false);
      expect(canCancelOrder('Unknown Status').allowed).toBe(false);
    });
  });

  // --- Out-of-Scope Deflection ---

  describe('Out-of-Scope Deflection Guardrails', () => {
    it('TC-1.6.6: deflects travel / airline booking inquiries', () => {
      const check = isOutOfScope('Can you help me book a flight ticket to Mumbai?');
      expect(check.outOfScope).toBe(true);
      expect(check.category).toBe('travel');
      expect(check.deflection).toContain('Aura Skincare');
    });

    it('deflects medical prescription and disease treatment queries', () => {
      const check = isOutOfScope('I have severe cystic acne bleeding, please prescribe antibiotics');
      expect(check.outOfScope).toBe(true);
      expect(check.category).toBe('medical');
      expect(check.deflection.toLowerCase()).toContain('dermatologist');
    });

    it('deflects general trivia and cricket queries', () => {
      const check = isOutOfScope('Who won the cricket match yesterday in IPL?');
      expect(check.outOfScope).toBe(true);
      expect(check.category).toBe('general_trivia');
    });

    it('deflects tech support queries', () => {
      const check = isOutOfScope('Can you fix my iPhone wifi connection?');
      expect(check.outOfScope).toBe(true);
      expect(check.category).toBe('tech_support');
    });

    it('allows genuine Aura Skincare inquiries through (not out of scope)', () => {
      expect(isOutOfScope('Where is my order ORD-101?').outOfScope).toBe(false);
      expect(isOutOfScope('How do I use your Vitamin C serum?').outOfScope).toBe(false);
      expect(isOutOfScope('What is your shipping policy?').outOfScope).toBe(false);
      expect(isOutOfScope('Can I return an unopened sunscreen?').outOfScope).toBe(false);
    });

    it('handles empty, null, or undefined queries safely', () => {
      expect(isOutOfScope('').outOfScope).toBe(false);
      expect(isOutOfScope(null).outOfScope).toBe(false);
      expect(isOutOfScope(undefined).outOfScope).toBe(false);
    });
  });
});
