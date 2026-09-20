/**
 * SpeakEasy - Conversation Tracker Module
 * Tracks session duration, user turn metrics, vocabulary usage, and archived reports.
 */

import { Storage } from './storage.js';

const COMMON_FILLERS = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'sort of', 'kind of', 'i mean'];

export class ConversationTracker {
  constructor(onTickCallback = null) {
    this.onTick = onTickCallback;
    this.timerInterval = null;
    this.reset();
  }

  reset() {
    this.startTime = null;
    this.elapsedSeconds = 0;
    this.userTurns = 0;
    this.aiTurns = 0;
    this.userWordCount = 0;
    this.userWordsSet = new Set();
    this.userUtterances = [];
    this.detectedFillers = {};
    this.isActive = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.startTime = Date.now();

    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      if (this.onTick) {
        this.onTick(this.getLiveStats());
      }
    }, 1000);
  }

  stop() {
    this.isActive = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  recordUserTurn(text) {
    if (!text || !text.trim()) return;
    if (!this.isActive) {
      this.start();
    }

    const trimmed = text.trim();
    this.userTurns++;
    this.userUtterances.push({
      turnIndex: this.userTurns,
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // Extract and count words
    const words = trimmed.toLowerCase().match(/\b[a-z']+\b/g) || [];
    this.userWordCount += words.length;

    words.forEach(w => {
      this.userWordsSet.add(w);
    });

    // Detect filler words and phrases
    const lowerText = trimmed.toLowerCase();
    COMMON_FILLERS.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        this.detectedFillers[filler] = (this.detectedFillers[filler] || 0) + matches.length;
      }
    });

    if (this.onTick) {
      this.onTick(this.getLiveStats());
    }
  }

  recordAiTurn(text) {
    if (!text || !text.trim()) return;
    this.aiTurns++;
    if (!this.isActive) {
      this.start();
    }
  }

  getLiveStats() {
    const minutes = Math.floor(this.elapsedSeconds / 60);
    const seconds = this.elapsedSeconds % 60;
    const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    return {
      formattedTime,
      elapsedSeconds: this.elapsedSeconds,
      userTurns: this.userTurns,
      aiTurns: this.aiTurns,
      userWordCount: this.userWordCount,
      uniqueWordsCount: this.userWordsSet.size,
      avgWordsPerTurn: this.userTurns > 0 ? (this.userWordCount / this.userTurns).toFixed(1) : '0.0'
    };
  }

  getMetricsSummary() {
    const live = this.getLiveStats();
    return {
      ...live,
      userUtterances: [...this.userUtterances],
      detectedFillers: { ...this.detectedFillers },
      vocabularyRichnessRatio: this.userWordCount > 0 
        ? ((this.userWordsSet.size / this.userWordCount) * 100).toFixed(0) + '%' 
        : '0%'
    };
  }

  // Session Report Archive Management
  static saveReport(report) {
    const reports = ConversationTracker.getSavedReports();
    reports.unshift(report); // Newest first
    // Retain up to 25 historical reports
    const trimmed = reports.slice(0, 25);
    Storage.saveSessionReports(trimmed);
  }

  static getSavedReports() {
    return Storage.getSessionReports();
  }

  static getReportById(id) {
    const reports = ConversationTracker.getSavedReports();
    return reports.find(r => r.id === id) || null;
  }

  static deleteReport(id) {
    const reports = ConversationTracker.getSavedReports().filter(r => r.id !== id);
    Storage.saveSessionReports(reports);
    return reports;
  }
}
