/**
 * server/transcriptManager.js
 * Chronological Transcript Accumulator for Aura Skincare Voice Agent ("Aria").
 * Aggregates streaming tokens, manages conversational turns, logs tool calls,
 * and outputs cleanly formatted chronological transcripts.
 */

export class TranscriptManager {
  constructor() {
    this.turns = [];
    this.currentTurn = null;
    this.toolEvents = [];
    this.startTime = new Date().toISOString();
  }

  /**
   * Start or append to a turn for a given role.
   * If the previous turn had a different role, seals it and opens a new turn.
   * @param {"user" | "aria"} role 
   * @param {string} textChunk 
   * @param {string} [timestamp]
   * @returns {object} The active turn
   */
  appendToken(role, textChunk, timestamp = new Date().toISOString()) {
    if (!textChunk || typeof textChunk !== 'string') return this.currentTurn;

    // If no active turn, or the speaker changed, finalize previous and create new turn
    if (!this.currentTurn || this.currentTurn.role !== role) {
      this.finalizeCurrentTurn();
      this.currentTurn = {
        id: `turn_${this.turns.length + 1}`,
        role,
        text: textChunk,
        timestamp,
        isComplete: false,
        interrupted: false,
        toolCalls: []
      };
    } else {
      // Append streaming chunk to existing turn
      this.currentTurn.text += textChunk;
    }

    return this.currentTurn;
  }

  /**
   * Add a complete utterance directly (e.g. from user speech-to-text or client text input).
   * @param {"user" | "aria"} role 
   * @param {string} fullText 
   * @param {string} [timestamp]
   * @returns {object|null}
   */
  addTurn(role, fullText, timestamp = new Date().toISOString()) {
    if (!fullText || !fullText.trim()) return null;
    this.finalizeCurrentTurn();

    const turn = {
      id: `turn_${this.turns.length + 1}`,
      role,
      text: fullText.trim(),
      timestamp,
      isComplete: true,
      interrupted: false,
      toolCalls: []
    };
    this.turns.push(turn);
    return turn;
  }

  /**
   * Mark the active turn as completed (e.g. on serverContent.turnComplete: true).
   */
  completeTurn() {
    if (this.currentTurn) {
      this.currentTurn.isComplete = true;
      this.finalizeCurrentTurn();
    }
  }

  /**
   * Mark the active turn as interrupted (e.g. on serverContent.interrupted: true).
   * Appends indicator if text exists and seals the turn.
   */
  handleInterruption() {
    if (this.currentTurn && this.currentTurn.role === 'aria') {
      this.currentTurn.interrupted = true;
      this.currentTurn.isComplete = false;
      this.finalizeCurrentTurn();
    }
  }

  /**
   * Record a tool execution event (e.g. get_order_details).
   * @param {string} id - Call ID
   * @param {string} name - Function name
   * @param {object} args - Call arguments
   * @param {object} [result] - Tool output
   * @returns {object}
   */
  recordToolCall(id, name, args, result = null) {
    const event = {
      id: id || `tool_${this.toolEvents.length + 1}`,
      name,
      tool: name,
      args: args || {},
      result,
      timestamp: new Date().toISOString()
    };
    this.toolEvents.push(event);

    // If an active turn exists, attach the tool event to it
    if (this.currentTurn) {
      if (!this.currentTurn.toolCalls) this.currentTurn.toolCalls = [];
      this.currentTurn.toolCalls.push(event);
    }
    return event;
  }

  /**
   * Update the result of a previously recorded tool call.
   * @param {string} id 
   * @param {object} result 
   */
  updateToolResult(id, result) {
    const event = this.toolEvents.find(e => e.id === id);
    if (event) {
      event.result = result;
    }
    // Also update within turns
    for (const turn of this.turns) {
      if (turn.toolCalls) {
        const tCall = turn.toolCalls.find(c => c.id === id);
        if (tCall) tCall.result = result;
      }
    }
    if (this.currentTurn && this.currentTurn.toolCalls) {
      const tCall = this.currentTurn.toolCalls.find(c => c.id === id);
      if (tCall) tCall.result = result;
    }
  }

  /**
   * Internal helper to push current turn into turns array and reset.
   */
  finalizeCurrentTurn() {
    if (this.currentTurn) {
      this.currentTurn.text = this.currentTurn.text.trim();
      if (this.currentTurn.text.length > 0) {
        this.turns.push(this.currentTurn);
      }
      this.currentTurn = null;
    }
  }

  /**
   * Get the full list of chronological turns.
   * Automatically flushes any currently active turn.
   * @returns {Array}
   */
  getTurns() {
    this.finalizeCurrentTurn();
    return [...this.turns];
  }

  /**
   * Get all recorded tool events.
   * @returns {Array}
   */
  getToolEvents() {
    return [...this.toolEvents];
  }

  /**
   * Get plain text dialog representation for summarization or download.
   * @returns {string}
   */
  toPlainText() {
    const allTurns = this.getTurns();
    return allTurns
      .map(t => `[${t.timestamp}] ${t.role === 'aria' ? 'Aria' : 'Customer'}: ${t.text}`)
      .join('\n');
  }

  /**
   * Reset all state for a new call session.
   */
  reset() {
    this.turns = [];
    this.currentTurn = null;
    this.toolEvents = [];
    this.startTime = new Date().toISOString();
  }
}

export default TranscriptManager;
