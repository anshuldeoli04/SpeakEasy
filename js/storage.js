/**
 * SpeakEasy - Local Storage Manager
 * Handles persistent configuration and conversation state.
 */

const STORAGE_KEYS = {
  API_KEY: 'speakeasy_gemini_api_key',
  VOICE_URI: 'speakeasy_voice_uri',
  SPEECH_RATE: 'speakeasy_speech_rate',
  AUTO_LISTEN: 'speakeasy_auto_listen',
  THEME: 'speakeasy_theme',
  CONVERSATION: 'speakeasy_conversation_history',
  REPORTS: 'speakeasy_session_reports'
};

export const Storage = {
  getApiKey() {
    const raw = localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
    return raw
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
      .replace(/^["'`]|["'`]$/g, '')
      .replace(/[\r\n\t]/g, '')
      .trim();
  },

  setApiKey(key) {
    if (key) {
      const sanitized = key
        .toString()
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
        .replace(/^["'`]|["'`]$/g, '')
        .replace(/[\r\n\t]/g, '')
        .trim();
      localStorage.setItem(STORAGE_KEYS.API_KEY, sanitized);
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    }
  },

  getVoiceUri() {
    return localStorage.getItem(STORAGE_KEYS.VOICE_URI) || '';
  },

  setVoiceUri(uri) {
    localStorage.setItem(STORAGE_KEYS.VOICE_URI, uri || '');
  },

  getSpeechRate() {
    const val = parseFloat(localStorage.getItem(STORAGE_KEYS.SPEECH_RATE));
    return isNaN(val) ? 1.0 : Math.min(Math.max(val, 0.5), 1.5);
  },

  setSpeechRate(rate) {
    localStorage.setItem(STORAGE_KEYS.SPEECH_RATE, rate.toString());
  },

  getAutoListen() {
    const val = localStorage.getItem(STORAGE_KEYS.AUTO_LISTEN);
    // Default is ON (true)
    return val === null ? true : val === 'true';
  },

  setAutoListen(enabled) {
    localStorage.setItem(STORAGE_KEYS.AUTO_LISTEN, enabled ? 'true' : 'false');
  },

  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  },

  getConversation() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONVERSATION);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse conversation history from storage:', e);
      return [];
    }
  },

  saveConversation(messages) {
    try {
      // Keep up to last 50 messages in local storage for transcript display
      const trimmed = messages.slice(-50);
      localStorage.setItem(STORAGE_KEYS.CONVERSATION, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save conversation history to storage:', e);
    }
  },

  clearConversation() {
    localStorage.removeItem(STORAGE_KEYS.CONVERSATION);
  },

  getSessionReports() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REPORTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse session reports from storage:', e);
      return [];
    }
  },

  saveSessionReports(reports) {
    try {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
    } catch (e) {
      console.error('Failed to save session reports to storage:', e);
    }
  }
};
