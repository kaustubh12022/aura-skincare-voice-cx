/**
 * tests/unit/transcriptManager.test.js
 * Unit tests for Chronological Transcript Accumulator (TranscriptManager):
 * - Streaming delta token accumulation into cohesive turns
 * - Prevention of token fragmentation (e.g. "Sure Rahul", "that", "order")
 * - Smart word spacing and punctuation handling
 * - Speaker transition turn sealing
 * - Turn completion and barge-in interruption handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptManager } from '../../server/transcriptManager.js';

describe('TranscriptManager Token Accumulation & Turn Cohesion Tests', () => {
  let manager;

  beforeEach(() => {
    manager = new TranscriptManager();
  });

  it('accumulates streaming delta tokens into a single cohesive turn for Aria', () => {
    manager.appendToken('aria', 'Sure Rahul,');
    manager.appendToken('aria', 'that');
    manager.appendToken('aria', 'order');
    manager.appendToken('aria', 'is on the way.');

    const activeTurn = manager.getCurrentTurn();
    expect(activeTurn).toBeDefined();
    expect(activeTurn.role).toBe('aria');
    expect(activeTurn.text).toBe('Sure Rahul, that order is on the way.');
    expect(activeTurn.isComplete).toBe(false);

    // Complete turn
    const finalized = manager.completeTurn();
    expect(finalized).toBeDefined();
    expect(finalized.isComplete).toBe(true);

    const turns = manager.getTurns();
    expect(turns.length).toBe(1);
    expect(turns[0].text).toBe('Sure Rahul, that order is on the way.');
  });

  it('handles tokens that already have natural whitespace without adding extra spaces', () => {
    manager.appendToken('aria', 'Hello ');
    manager.appendToken('aria', 'there! ');
    manager.appendToken('aria', 'How can I assist?');

    manager.completeTurn();
    const turns = manager.getTurns();
    expect(turns.length).toBe(1);
    expect(turns[0].text).toBe('Hello there! How can I assist?');
  });

  it('seals previous turn when speaker changes from user to aria', () => {
    manager.appendToken('user', 'Where is my order');
    manager.appendToken('user', 'ORD-101?');

    manager.appendToken('aria', 'Let me check that');
    manager.appendToken('aria', 'for you.');

    const turns = manager.getTurns();
    expect(turns.length).toBe(2);
    expect(turns[0].role).toBe('user');
    expect(turns[0].text).toBe('Where is my order ORD-101?');
    expect(turns[1].role).toBe('aria');
    expect(turns[1].text).toBe('Let me check that for you.');
  });

  it('marks active turn as interrupted on barge-in without losing accumulated text', () => {
    manager.appendToken('aria', 'Your order was shipped on Monday and should');
    manager.handleInterruption();

    const turns = manager.getTurns();
    expect(turns.length).toBe(1);
    expect(turns[0].interrupted).toBe(true);
    expect(turns[0].isComplete).toBe(false);
    expect(turns[0].text).toBe('Your order was shipped on Monday and should');
  });

  it('associates tool calls with active turn and toolEvents list', () => {
    manager.appendToken('user', 'Check ORD-101');
    manager.completeTurn();

    manager.appendToken('aria', 'Checking');
    manager.recordToolCall('call_1', 'get_order_details', { order_id: 'ORD-101' }, { status: 'Delivered' });
    manager.appendToken('aria', 'Done');
    manager.completeTurn();

    const events = manager.getToolEvents();
    expect(events.length).toBe(1);
    expect(events[0].tool).toBe('get_order_details');

    const turns = manager.getTurns();
    expect(turns.length).toBe(2);
    expect(turns[1].toolCalls.length).toBe(1);
  });
});
