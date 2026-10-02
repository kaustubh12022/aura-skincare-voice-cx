/**
 * tests/e2e/dialogueScenarios.test.js
 * End-to-End Real-World Dialogue Scenarios (Tier 4: S1 - S5)
 * and Cross-Feature Multi-Turn Combinations (Tier 3)
 * per TEST_INFRA.md and testing_survey.md.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockGeminiLiveServer } from '../mocks/mockGeminiLiveServer.js';
import { loadOrderDatabase, loadBrandPolicy, loadSummarizer } from '../helpers/moduleLoader.js';
import { floatTo16BitPCM, pcmToBase64, generateSineWave } from '../mocks/audioUtils.js';

describe('Tier 4: Real-World Customer Dialogue Scenarios (S1 - S5)', () => {
  let mockServer;
  let serverPort;
  let clientWs;

  let getOrderDetails;
  let cancelOrder;
  let resetOrderDatabase;
  let canCancelOrder;
  let canReturnOrder;
  let isOutOfScope;
  let generateCallSummary;

  beforeEach(async () => {
    mockServer = new MockGeminiLiveServer({ autoAcknowledgeSetup: true });
    serverPort = await mockServer.start();

    const orderDbModule = await loadOrderDatabase();
    getOrderDetails = orderDbModule.getOrderDetails;
    cancelOrder = orderDbModule.cancelOrder;
    resetOrderDatabase = orderDbModule.resetOrderDatabase;
    resetOrderDatabase();

    const brandPolicyModule = await loadBrandPolicy();
    canCancelOrder = brandPolicyModule.canCancelOrder;
    canReturnOrder = brandPolicyModule.canReturnOrder;
    isOutOfScope = brandPolicyModule.isOutOfScope;

    const summarizerModule = await loadSummarizer();
    generateCallSummary = summarizerModule.generateCallSummary;
  });

  afterEach(async () => {
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
    await mockServer.stop();
  });

  // --- Scenario S1: Priya Sharma Tracking ORD-101 ---

  it('Scenario S1: Priya Sharma inquiries about ORD-101 (Out for Delivery)', async () => {
    const wsUrl = `ws://127.0.0.1:${serverPort}`;
    clientWs = new WebSocket(wsUrl);
    await new Promise((resolve) => { clientWs.onopen = resolve; });

    const dialogueTranscript = [];
    const recordedToolCalls = [];

    clientWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.toolCall && msg.toolCall.functionCalls) {
        for (const call of msg.toolCall.functionCalls) {
          if (call.name === 'get_order_details') {
            const result = getOrderDetails(call.args.order_id);
            recordedToolCalls.push({
              tool: 'get_order_details',
              args: call.args,
              result
            });
            clientWs.send(JSON.stringify({
              toolResponse: {
                functionResponses: [{ id: call.id, name: call.name, response: { output: result } }]
              }
            }));
          }
        }
      }
    };

    // User speaks query: "Hi Aria, where is my order ORD-101?"
    const userUtterance = "Hi Aria, where is my order ORD-101?";
    dialogueTranscript.push({ role: 'user', text: userUtterance });

    // Server emits toolCall for ORD-101
    const callId = mockServer.emitToolCall('ORD-101');

    // Wait for tool response to be recorded
    await new Promise((resolve) => {
      mockServer.once('toolResponse', resolve);
    });

    expect(recordedToolCalls).toHaveLength(1);
    const orderRecord = recordedToolCalls[0].result;
    expect(orderRecord.found).toBe(true);
    expect(orderRecord.customer_name).toBe('Priya Sharma');
    expect(orderRecord.order_status).toBe('Out for Delivery');
    expect(orderRecord.courier).toBe('BlueDart');
    expect(orderRecord.tracking_number).toBe('BD-982103');
    expect(orderRecord.cancellation_eligible).toBe(false);

    // Agent speaks response
    const agentUtterance = "Hello Priya! Your order ORD-101 for the Vitamin C Serum is currently Out for Delivery with BlueDart (tracking number BD-982103) and should arrive at your doorstep today!";
    dialogueTranscript.push({ role: 'aria', text: agentUtterance });

    // End call & generate summary
    const outcome = await generateCallSummary({
      transcript: dialogueTranscript,
      toolCalls: recordedToolCalls
    });

    expect(outcome.customer_intent).toBe('order_tracking');
    expect(outcome.order_id).toBe('ORD-101');
    expect(outcome.resolution_status).toBe('resolved');
    expect(outcome.call_summary).toContain('ORD-101');
    expect(outcome.call_summary.toLowerCase()).toContain('out for delivery');
  });

  // --- Scenario S2: Rahul Verma Refund Attempt on ORD-102 ---

  it('Scenario S2: Rahul Verma attempts return on ORD-102 (Delivered 14 days ago)', async () => {
    const dialogueTranscript = [];
    const recordedToolCalls = [];

    // User: "Hi, I want to return my order ORD-102 and get a refund."
    dialogueTranscript.push({ role: 'user', text: "Hi, I want to return my order ORD-102 and get a refund." });

    // Tool executes
    const orderDetails = getOrderDetails('ORD-102');
    recordedToolCalls.push({
      tool: 'get_order_details',
      args: { order_id: 'ORD-102' },
      result: orderDetails
    });

    expect(orderDetails.found).toBe(true);
    expect(orderDetails.customer_name).toBe('Rahul Verma');
    expect(orderDetails.order_status).toBe('Delivered');
    expect(orderDetails.delivered_days_ago).toBe(14);

    // Policy check for return
    const policyResult = canReturnOrder(orderDetails);
    expect(policyResult.allowed).toBe(false);
    expect(policyResult.action).toBe('reject');
    expect(policyResult.reason).toContain('14');
    expect(policyResult.reason).toContain('7');

    // Agent speaks polite rejection citing 7-day rule
    const agentUtterance = "Hello Rahul! Order ORD-102 was delivered 14 days ago. Under Aura Skincare's policy, returns are accepted strictly within 7 days of delivery for unopened products. Because 14 days have passed, I am unable to process a return.";
    dialogueTranscript.push({ role: 'aria', text: agentUtterance });

    // Post-call outcome
    const outcome = await generateCallSummary({
      transcript: dialogueTranscript,
      toolCalls: recordedToolCalls
    });

    expect(outcome.customer_intent).toBe('return_refund');
    expect(outcome.order_id).toBe('ORD-102');
    expect(outcome.resolution_status).toBe('rejected');
    expect(outcome.call_summary).toContain('ORD-102');
    expect(outcome.call_summary.toLowerCase()).toContain('7-day');
  });

  // --- Scenario S3: Ananya Patel Cancellation of ORD-103 ---

  it('Scenario S3: Ananya Patel cancels order ORD-103 (Processing / Ordered 3h ago)', async () => {
    const dialogueTranscript = [];
    const recordedToolCalls = [];

    // User: "Hello, I placed an order earlier today, ORD-103. I need to cancel it."
    dialogueTranscript.push({ role: 'user', text: "Hello, I placed an order earlier today, ORD-103. I need to cancel it." });

    // Tool executes
    const orderDetails = getOrderDetails('ORD-103');
    recordedToolCalls.push({
      tool: 'get_order_details',
      args: { order_id: 'ORD-103' },
      result: orderDetails
    });

    expect(orderDetails.found).toBe(true);
    expect(orderDetails.customer_name).toBe('Ananya Patel');
    expect(orderDetails.order_status).toBe('Processing');
    expect(orderDetails.cancellation_eligible).toBe(true);

    // Cancellation mutation
    const cancelMutation = cancelOrder('ORD-103');
    expect(cancelMutation.success).toBe(true);
    expect(cancelMutation.order.order_status).toBe('Cancelled');
    expect(cancelMutation.order.refund_amount).toBe(850);

    // Agent confirms cancellation
    const agentUtterance = "Certainly Ananya! Since order ORD-103 is in Processing status, I have successfully cancelled it for you. A full refund of ₹850 will be credited to your original payment method within 5 to 7 business days.";
    dialogueTranscript.push({ role: 'aria', text: agentUtterance });

    // Post-call outcome
    const outcome = await generateCallSummary({
      transcript: dialogueTranscript,
      toolCalls: recordedToolCalls
    });

    expect(outcome.customer_intent).toBe('cancellation');
    expect(outcome.order_id).toBe('ORD-103');
    expect(outcome.resolution_status).toBe('resolved');
    expect(outcome.call_summary).toContain('ORD-103');
    expect(outcome.call_summary.toLowerCase()).toContain('cancel');
  });

  // --- Scenario S4: General Shipping Policy Inquiry ---

  it('Scenario S4: General customer shipping policy inquiry', async () => {
    const dialogueTranscript = [];

    // User: "Hi, what are your shipping charges and delivery time?"
    const userUtterance = "Hi, what are your shipping charges and delivery time?";
    dialogueTranscript.push({ role: 'user', text: userUtterance });

    // Agent explains ₹499 cutoff and 3-5 days
    const agentUtterance = "We offer free shipping on all orders above ₹499! For orders of ₹499 or below, a flat shipping fee of ₹50 applies. Standard delivery takes 3 to 5 business days across India.";
    dialogueTranscript.push({ role: 'aria', text: agentUtterance });

    const outcome = await generateCallSummary({
      transcript: dialogueTranscript,
      toolCalls: []
    });

    expect(outcome.customer_intent).toBe('shipping_inquiry');
    expect(outcome.order_id).toBeNull();
    expect(outcome.resolution_status).toBe('resolved');
    expect(outcome.call_summary).toContain('499');
    expect(outcome.call_summary.toLowerCase()).toContain('shipping');
  });

  // --- Scenario S5: Off-Topic / Medical Deflection ---

  it('Scenario S5: Off-topic query (flight booking) politely deflected', async () => {
    const dialogueTranscript = [];

    const userUtterance = "Can you help me book a flight ticket from Delhi to Mumbai tomorrow?";
    dialogueTranscript.push({ role: 'user', text: userUtterance });

    // Guardrail check
    const deflectionCheck = isOutOfScope(userUtterance);
    expect(deflectionCheck.outOfScope).toBe(true);
    expect(deflectionCheck.category).toBe('travel');

    // Agent response
    const agentUtterance = deflectionCheck.deflection;
    dialogueTranscript.push({ role: 'aria', text: agentUtterance });

    const outcome = await generateCallSummary({
      transcript: dialogueTranscript,
      toolCalls: []
    });

    expect(outcome.customer_intent).toBe('out_of_scope');
    expect(outcome.order_id).toBeNull();
    expect(outcome.resolution_status).toBe('resolved');
    expect(outcome.call_summary.toLowerCase()).toContain('off-topic');
  });

  // --- Tier 3 Combinations: Multi-Turn & Barge-In Interactions ---

  describe('Tier 3: Pairwise & Multi-Turn Combinations', () => {
    it('Combination 3.1: Mid-call barge-in interruption halts audio and flushes turn', async () => {
      const wsUrl = `ws://127.0.0.1:${serverPort}`;
      clientWs = new WebSocket(wsUrl);
      await new Promise((resolve) => { clientWs.onopen = resolve; });

      let interruptedReceived = false;
      clientWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.serverContent?.interrupted) {
          interruptedReceived = true;
        }
      };

      // Agent is speaking 24kHz audio
      mockServer.emitModelTurn({
        text: "Let me check order ORD-101 for you...",
        audioPcmBase64: pcmToBase64(floatTo16BitPCM(generateSineWave(440, 0.5, 24000))),
        isTurnComplete: false
      });

      // User interrupts
      mockServer.emitInterrupted();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(interruptedReceived).toBe(true);
    });

    it('Combination 3.2: Sequential queries: tracking ORD-101 followed by return attempt on ORD-102', async () => {
      // Turn 1: Lookup ORD-101
      const res1 = getOrderDetails('ORD-101');
      expect(res1.order_status).toBe('Out for Delivery');

      // Turn 2: Lookup ORD-102 and evaluate return
      const res2 = getOrderDetails('ORD-102');
      const retCheck = canReturnOrder(res2);
      expect(retCheck.allowed).toBe(false);

      // Verify state was independent and preserved
      expect(getOrderDetails('ORD-101').order_status).toBe('Out for Delivery');
      expect(getOrderDetails('ORD-102').order_status).toBe('Delivered');
    });

    it('Combination 3.3: Rejected cancellation on ORD-101 followed by successful policy explanation', async () => {
      // Turn 1: Attempt to cancel ORD-101
      const cancelRes = cancelOrder('ORD-101');
      expect(cancelRes.success).toBe(false);
      expect(cancelRes.status).toBe('rejected');

      // Turn 2: Inquire about shipping policy
      const userUtterance = "Why was it dispatched so fast? What are your standard delivery times?";
      expect(isOutOfScope(userUtterance).outOfScope).toBe(false);

      // Verify brand policy delivers free shipping over ₹499
      expect(getOrderDetails('ORD-101').total_amount).toBe(699);
    });

    it('Combination 3.4: Out-of-scope query followed by ORD-103 cancellation recovery', async () => {
      // Turn 1: Off-topic query
      const offTopic = isOutOfScope('Can you tell me who won the IPL cricket match?');
      expect(offTopic.outOfScope).toBe(true);

      // Turn 2: Recovery into valid cancellation of ORD-103
      const cancelResult = cancelOrder('ORD-103');
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.order.order_status).toBe('Cancelled');
    });
  });
});
