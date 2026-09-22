/**
 * SpeakEasy - Main Application Coordinator
 */

import { Storage } from './storage.js';
import { GeminiClient } from './gemini.js';
import { SpeechService } from './speech.js';
import { ConversationTracker } from './tracker.js';

class SpeakEasyApp {
  constructor() {
    this.messages = [];
    this.status = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'
    this.isAutoListenEnabled = Storage.getAutoListen();
    this.pendingUserText = '';
    this.currentReport = null;

    // Initialize Conversation Tracker
    this.tracker = new ConversationTracker((stats) => this.updateLiveTrackerUI(stats));

    // Initialize Gemini Client
    this.gemini = new GeminiClient(Storage.getApiKey());

    // Initialize Speech Service
    this.speech = new SpeechService({
      rate: Storage.getSpeechRate(),
      voiceUri: Storage.getVoiceUri(),
      onStatusChange: (status) => this.handleStatusChange(status),
      onSpeechResult: (transcript) => this.handleSpeechResult(transcript),
      onInterimResult: (interim) => this.handleInterimResult(interim),
      onError: (type, message) => this.handleSpeechError(type, message),
      onVoicesChanged: (voices) => this.populateVoiceSelect(voices)
    });

    this.initDOMElements();
    this.initEventListeners();
    this.initAppState();
  }

  initDOMElements() {
    // Header & Actions
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.themeIconDark = document.getElementById('theme-icon-dark');
    this.themeIconLight = document.getElementById('theme-icon-light');
    this.settingsOpenBtn = document.getElementById('settings-open-btn');

    // Banners
    this.browserWarning = document.getElementById('browser-warning');
    this.dismissBrowserWarning = document.getElementById('dismiss-browser-warning');
    this.apiKeyBanner = document.getElementById('apikey-banner');
    this.bannerSettingsBtn = document.getElementById('banner-settings-btn');

    // Transcript & Viewport
    this.transcriptViewport = document.getElementById('transcript-viewport');
    this.transcriptContainer = document.getElementById('transcript-container');
    this.welcomeCard = document.getElementById('welcome-card');
    this.scrollBottomBtn = document.getElementById('scroll-bottom-btn');

    // Voice Center
    this.voiceCenter = document.querySelector('.voice-center');
    this.statusBadge = document.getElementById('status-badge');
    this.statusText = document.getElementById('status-text');
    this.interimPreview = document.getElementById('interim-preview');
    this.micBtn = document.getElementById('mic-btn');
    this.stopActionBtn = document.getElementById('stop-action-btn');

    // Mic Icons
    this.micIconIdle = document.getElementById('mic-icon-idle');
    this.micIconListening = document.getElementById('mic-icon-listening');
    this.micIconThinking = document.getElementById('mic-icon-thinking');
    this.micIconSpeaking = document.getElementById('mic-icon-speaking');

    // Text Input Form
    this.textInputForm = document.getElementById('text-input-form');
    this.textInput = document.getElementById('text-input');
    this.sendBtn = document.getElementById('send-btn');

    // Live Tracker & Header Buttons
    this.liveTrackerBar = document.getElementById('live-tracker-bar');
    this.trackerTime = document.getElementById('tracker-time');
    this.trackerTurns = document.getElementById('tracker-turns');
    this.trackerWords = document.getElementById('tracker-words');
    this.reportOpenBtn = document.getElementById('report-open-btn');
    this.historyOpenBtn = document.getElementById('history-open-btn');

    // Settings Modal
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsCloseBtn = document.getElementById('settings-close-btn');
    this.settingsSaveBtn = document.getElementById('settings-save-btn');
    this.apiKeyInput = document.getElementById('api-key-input');
    this.toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility-btn');
    this.apiKeySavedIndicator = document.getElementById('api-key-saved-indicator');
    this.voiceSelect = document.getElementById('voice-select');
    this.testVoiceBtn = document.getElementById('test-voice-btn');
    this.rateSlider = document.getElementById('rate-slider');
    this.rateValue = document.getElementById('rate-value');
    this.autoListenToggle = document.getElementById('autolisten-toggle');
    this.clearChatBtn = document.getElementById('clear-chat-btn');

    // Performance Report Modal
    this.reportModal = document.getElementById('report-modal');
    this.reportCloseBtn = document.getElementById('report-close-btn');
    this.reportDoneBtn = document.getElementById('report-done-btn');
    this.reportDate = document.getElementById('report-date');
    this.reportLoading = document.getElementById('report-loading');
    this.reportContent = document.getElementById('report-content');

    // Report Hero & Stats
    this.reportCefrBadge = document.getElementById('report-cefr-badge');
    this.reportOverallScore = document.getElementById('report-overall-score');
    this.reportFluencyScore = document.getElementById('report-fluency-score');
    this.reportGrammarScore = document.getElementById('report-grammar-score');
    this.reportVocabScore = document.getElementById('report-vocab-score');
    this.repStatTime = document.getElementById('rep-stat-time');
    this.repStatTurns = document.getElementById('rep-stat-turns');
    this.repStatWords = document.getElementById('rep-stat-words');
    this.repStatAvg = document.getElementById('rep-stat-avg');
    this.reportSummaryText = document.getElementById('report-summary-text');

    // Report Tabs & Panels
    this.reportTabBtns = document.querySelectorAll('.report-tab-btn');
    this.tabPanels = {
      grammar: document.getElementById('tab-grammar'),
      pronunciation: document.getElementById('tab-pronunciation'),
      fluency: document.getElementById('tab-fluency'),
      action: document.getElementById('tab-action')
    };

    // Report Lists
    this.grammarList = document.getElementById('grammar-list');
    this.grammarBadgeCount = document.getElementById('grammar-badge-count');
    this.structureList = document.getElementById('structure-list');
    this.structureBadgeCount = document.getElementById('structure-badge-count');
    this.pronunciationList = document.getElementById('pronunciation-list');
    this.fillerAnalysisBox = document.getElementById('filler-analysis-box');
    this.vocabFeedbackBox = document.getElementById('vocab-feedback-box');
    this.flowFeedbackBox = document.getElementById('flow-feedback-box');
    this.strengthsList = document.getElementById('strengths-list');
    this.actionPlanList = document.getElementById('action-plan-list');

    // Report Action Buttons
    this.copyReportBtn = document.getElementById('copy-report-btn');
    this.downloadReportBtn = document.getElementById('download-report-btn');
    this.reportNewSessionBtn = document.getElementById('report-new-session-btn');

    // History Modal
    this.historyModal = document.getElementById('history-modal');
    this.historyCloseBtn = document.getElementById('history-close-btn');
    this.historyDoneBtn = document.getElementById('history-done-btn');
    this.historyList = document.getElementById('history-list');
    this.clearHistoryBtn = document.getElementById('clear-history-btn');
  }

  initAppState() {
    // 1. Setup Theme
    const savedTheme = Storage.getTheme();
    this.applyTheme(savedTheme);

    // 2. Check Browser Speech Support
    if (!SpeechService.isRecognitionSupported()) {
      this.browserWarning.classList.remove('hidden');
    }

    // 3. API Key Setup
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      this.apiKeyBanner.classList.remove('hidden');
    } else {
      this.apiKeyInput.value = apiKey;
    }

    // 4. Rate and Autolisten UI
    const rate = Storage.getSpeechRate();
    this.rateSlider.value = rate;
    this.rateValue.textContent = `${rate.toFixed(1)}x`;
    this.speech.setRate(rate);

    this.isAutoListenEnabled = Storage.getAutoListen();
    this.autoListenToggle.checked = this.isAutoListenEnabled;

    // 5. Restore Saved Messages
    const savedMessages = Storage.getConversation();
    if (savedMessages && savedMessages.length > 0) {
      this.messages = savedMessages;
      this.hideWelcomeCard();
      this.messages.forEach(msg => this.renderMessageBubble(msg));
      this.scrollToBottom(false);
    }
  }

  initEventListeners() {
    // Mic Button
    this.micBtn.addEventListener('click', () => this.handleMicButtonClick());

    // Quick Stop Action Button
    this.stopActionBtn.addEventListener('click', () => this.stopAllActivity());

    // Text Input Form
    this.textInputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTextSubmit();
    });

    // Starter Chips
    document.querySelectorAll('.starter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const promptText = chip.getAttribute('data-text');
        if (promptText) {
          this.processUserUtterance(promptText);
        }
      });
    });

    // Theme Toggle
    this.themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      this.applyTheme(next);
      Storage.setTheme(next);
    });

    // Settings Modal
    this.settingsOpenBtn.addEventListener('click', () => this.openSettings());
    this.bannerSettingsBtn.addEventListener('click', () => this.openSettings());
    this.settingsCloseBtn.addEventListener('click', () => this.closeSettings());
    this.settingsSaveBtn.addEventListener('click', () => this.closeSettings());
    this.dismissBrowserWarning.addEventListener('click', () => {
      this.browserWarning.classList.add('hidden');
    });

    // Close modal on background click
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.closeSettings();
      }
    });

    // Show/Hide API Key
    this.toggleKeyVisibilityBtn.addEventListener('click', () => {
      const isPassword = this.apiKeyInput.type === 'password';
      this.apiKeyInput.type = isPassword ? 'text' : 'password';
      this.toggleKeyVisibilityBtn.textContent = isPassword ? '🔒' : '👁️';
    });

    // Save API key on change & paste (with robust sanitization for mobile copy-paste)
    const handleKeyUpdate = () => {
      const sanitized = GeminiClient.sanitizeApiKey(this.apiKeyInput.value);
      this.apiKeyInput.value = sanitized;
      Storage.setApiKey(sanitized);
      this.gemini.setApiKey(sanitized);
      if (sanitized) {
        this.apiKeyBanner.classList.add('hidden');
        this.apiKeySavedIndicator.classList.remove('hidden');
        setTimeout(() => this.apiKeySavedIndicator.classList.add('hidden'), 2000);
      } else {
        this.apiKeyBanner.classList.remove('hidden');
      }
    };

    this.apiKeyInput.addEventListener('input', handleKeyUpdate);
    this.apiKeyInput.addEventListener('paste', () => setTimeout(handleKeyUpdate, 0));

    // Voice Selection
    this.voiceSelect.addEventListener('change', () => {
      const uri = this.voiceSelect.value;
      Storage.setVoiceUri(uri);
      this.speech.setVoiceUri(uri);
    });

    // Voice Test
    this.testVoiceBtn.addEventListener('click', () => {
      this.speech.speak('Hello! I am Alex. It is really great to practice English with you today.');
    });

    // Rate Slider
    this.rateSlider.addEventListener('input', () => {
      const rate = parseFloat(this.rateSlider.value);
      this.rateValue.textContent = `${rate.toFixed(1)}x`;
      Storage.setSpeechRate(rate);
      this.speech.setRate(rate);
    });

    // Auto-listen Toggle
    this.autoListenToggle.addEventListener('change', () => {
      this.isAutoListenEnabled = this.autoListenToggle.checked;
      Storage.setAutoListen(this.isAutoListenEnabled);
    });

    // Clear Chat
    this.clearChatBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your conversation history?')) {
        this.clearConversation();
        this.closeSettings();
      }
    });

    // Viewport Scroll (Show/Hide scroll to bottom button)
    this.transcriptViewport.addEventListener('scroll', () => {
      const distFromBottom = 
        this.transcriptViewport.scrollHeight - 
        this.transcriptViewport.scrollTop - 
        this.transcriptViewport.clientHeight;
      if (distFromBottom > 120) {
        this.scrollBottomBtn.classList.remove('hidden');
      } else {
        this.scrollBottomBtn.classList.add('hidden');
      }
    });

    this.scrollBottomBtn.addEventListener('click', () => {
      this.scrollToBottom(true);
    });

    // Report Header Button
    this.reportOpenBtn.addEventListener('click', () => {
      this.handleGenerateReport();
    });

    // History Header Button
    this.historyOpenBtn.addEventListener('click', () => {
      this.openHistoryModal();
    });

    // Report Modal Controls
    this.reportCloseBtn.addEventListener('click', () => this.closeReportModal());
    this.reportDoneBtn.addEventListener('click', () => this.closeReportModal());
    this.reportModal.addEventListener('click', (e) => {
      if (e.target === this.reportModal) {
        this.closeReportModal();
      }
    });

    // Report Tab Switching
    this.reportTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabKey = btn.getAttribute('data-tab');
        this.switchReportTab(tabKey);
      });
    });

    // Copy Summary Button
    this.copyReportBtn.addEventListener('click', () => {
      this.copyReportSummary();
    });

    // Download Report Button
    this.downloadReportBtn.addEventListener('click', () => {
      this.downloadReport();
    });

    // New Session from Report Modal
    this.reportNewSessionBtn.addEventListener('click', () => {
      if (confirm('Start a fresh conversation practice session? Your current report is saved in History.')) {
        this.closeReportModal();
        this.clearConversation();
      }
    });

    // History Modal Controls
    this.historyCloseBtn.addEventListener('click', () => this.closeHistoryModal());
    this.historyDoneBtn.addEventListener('click', () => this.closeHistoryModal());
    this.historyModal.addEventListener('click', (e) => {
      if (e.target === this.historyModal) {
        this.closeHistoryModal();
      }
    });

    this.clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all past saved reports?')) {
        Storage.saveSessionReports([]);
        this.renderHistoryList();
      }
    });
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      this.themeIconDark.classList.add('hidden');
      this.themeIconLight.classList.remove('hidden');
    } else {
      document.documentElement.removeAttribute('data-theme');
      this.themeIconDark.classList.remove('hidden');
      this.themeIconLight.classList.add('hidden');
    }
  }

  openSettings() {
    this.apiKeyInput.value = Storage.getApiKey();
    this.settingsModal.classList.remove('hidden');
  }

  closeSettings() {
    this.settingsModal.classList.add('hidden');
    // Save API key with sanitization
    const key = GeminiClient.sanitizeApiKey(this.apiKeyInput.value);
    this.apiKeyInput.value = key;
    Storage.setApiKey(key);
    this.gemini.setApiKey(key);
    if (key) {
      this.apiKeyBanner.classList.add('hidden');
    }
  }

  populateVoiceSelect(voices) {
    this.voiceSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Default English Voice';
    this.voiceSelect.appendChild(defaultOption);

    const savedVoiceUri = Storage.getVoiceUri();

    voices.forEach(voice => {
      const opt = document.createElement('option');
      opt.value = voice.voiceURI;
      opt.textContent = `${voice.name} (${voice.lang})`;
      if (voice.voiceURI === savedVoiceUri) {
        opt.selected = true;
      }
      this.voiceSelect.appendChild(opt);
    });
  }

  // =========================================================================
  // Core Conversation & Speech Lifecycle
  // =========================================================================

  handleMicButtonClick() {
    // If no API key, prompt user
    if (!this.gemini.hasApiKey()) {
      this.openSettings();
      alert('Please enter your Gemini API key in Settings first to start conversation practice.');
      return;
    }

    if (this.status === 'listening') {
      // Tap again to finish speaking immediately
      this.speech.stopListening();
    } else if (this.status === 'speaking') {
      // Tap to interrupt AI
      this.speech.stopSpeaking();
    } else if (this.status === 'thinking') {
      // Tap to cancel
      this.stopAllActivity();
    } else {
      // Start listening
      const started = this.speech.startListening();
      if (!started) {
        // Recognition might not be supported or busy
      }
    }
  }

  stopAllActivity() {
    this.speech.stopSpeaking();
    this.speech.abortListening();
    this.handleStatusChange('idle');
  }

  handleStatusChange(newStatus) {
    this.status = newStatus;

    // Reset icons
    this.micIconIdle.classList.add('hidden');
    this.micIconListening.classList.add('hidden');
    this.micIconThinking.classList.add('hidden');
    this.micIconSpeaking.classList.add('hidden');

    // Reset voice center modifier classes
    this.voiceCenter.classList.remove('listening', 'thinking', 'speaking');
    this.statusBadge.className = 'status-badge';

    switch (newStatus) {
      case 'listening':
        this.voiceCenter.classList.add('listening');
        this.statusBadge.classList.add('status-listening');
        this.statusText.textContent = 'Listening...';
        this.micIconListening.classList.remove('hidden');
        this.stopActionBtn.classList.remove('hidden');
        break;

      case 'thinking':
        this.voiceCenter.classList.add('thinking');
        this.statusBadge.classList.add('status-thinking');
        this.statusText.textContent = 'Thinking...';
        this.micIconThinking.classList.remove('hidden');
        this.interimPreview.classList.add('hidden');
        this.interimPreview.textContent = '';
        this.stopActionBtn.classList.remove('hidden');
        break;

      case 'speaking':
        this.voiceCenter.classList.add('speaking');
        this.statusBadge.classList.add('status-speaking');
        this.statusText.textContent = 'Speaking...';
        this.micIconSpeaking.classList.remove('hidden');
        this.interimPreview.classList.add('hidden');
        this.interimPreview.textContent = '';
        this.stopActionBtn.classList.remove('hidden');
        break;

      case 'idle':
      default:
        this.statusBadge.classList.add('status-idle');
        this.statusText.textContent = 'Tap to speak';
        this.micIconIdle.classList.remove('hidden');
        this.interimPreview.classList.add('hidden');
        this.interimPreview.textContent = '';
        this.stopActionBtn.classList.add('hidden');
        break;
    }
  }

  handleInterimResult(interim) {
    if (interim) {
      this.interimPreview.textContent = `"${interim}"`;
      this.interimPreview.classList.remove('hidden');
    }
  }

  handleSpeechResult(transcript) {
    this.interimPreview.classList.add('hidden');
    this.interimPreview.textContent = '';
    if (transcript && transcript.trim()) {
      this.processUserUtterance(transcript.trim());
    } else {
      this.handleStatusChange('idle');
    }
  }

  handleSpeechError(type, message) {
    if (type === 'MIC_PERMISSION_DENIED') {
      alert(message);
    } else {
      console.warn('Speech Error:', type, message);
    }
  }

  handleTextSubmit() {
    const text = this.textInput.value.trim();
    if (!text) return;
    this.textInput.value = '';
    this.processUserUtterance(text);
  }

  /**
   * Main turn-taking method
   */
  async processUserUtterance(userText) {
    if (!this.gemini.hasApiKey()) {
      this.openSettings();
      alert('Please enter your Gemini API key in Settings to continue.');
      return;
    }

    // Input Sanitization & DoS Prevention: limit utterance to 1000 chars
    const sanitizedText = (userText || '').trim().slice(0, 1000);
    if (!sanitizedText) return;

    this.hideWelcomeCard();

    // Record user turn in tracker
    this.tracker.recordUserTurn(sanitizedText);

    // 1. Add and render user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: sanitizedText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.messages.push(userMessage);
    this.renderMessageBubble(userMessage);
    this.scrollToBottom(true);
    Storage.saveConversation(this.messages);

    // 2. Set status to "Thinking..."
    this.handleStatusChange('thinking');

    // 3. Call Gemini 2.5 Flash API
    try {
      const aiReplyText = await this.gemini.generateReply(this.messages);

      // Record AI turn in tracker
      this.tracker.recordAiTurn(aiReplyText);

      // 4. Add and render AI reply
      const aiMessage = {
        id: Date.now() + 1,
        role: 'model',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      this.messages.push(aiMessage);
      this.renderMessageBubble(aiMessage);
      this.scrollToBottom(true);
      Storage.saveConversation(this.messages);

      // 5. Speak AI reply aloud
      this.speech.speak(aiReplyText, () => {
        // 6. When speech ends, auto-listen if configured
        if (this.isAutoListenEnabled && this.gemini.hasApiKey()) {
          // Give brief 350ms breather before opening mic
          setTimeout(() => {
            // Only start if not already listening or speaking
            if (this.status === 'idle') {
              this.speech.startListening(false);
            }
          }, 350);
        }
      });
    } catch (err) {
      console.error('Error in conversation turn:', err);
      this.handleStatusChange('idle');
      this.renderErrorBubble(err, () => this.processUserUtterance(userText));
    }
  }

  hideWelcomeCard() {
    if (this.welcomeCard) {
      this.welcomeCard.classList.add('hidden');
    }
  }

  renderMessageBubble(msg) {
    const isUser = msg.role === 'user';
    const row = document.createElement('div');
    row.className = `message-row ${isUser ? 'user' : 'model'}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const header = document.createElement('div');
    header.className = 'message-header';

    const authorSpan = document.createElement('span');
    authorSpan.textContent = isUser ? 'You' : 'Alex';
    header.appendChild(authorSpan);

    const metaWrap = document.createElement('div');
    metaWrap.className = 'message-actions';

    if (!isUser) {
      const replayBtn = document.createElement('button');
      replayBtn.className = 'replay-audio-btn';
      replayBtn.title = 'Listen again';
      replayBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        Replay
      `;
      replayBtn.addEventListener('click', () => {
        this.speech.speak(msg.text);
      });
      metaWrap.appendChild(replayBtn);
    }

    const timeSpan = document.createElement('span');
    timeSpan.textContent = msg.timestamp || '';
    metaWrap.appendChild(timeSpan);
    header.appendChild(metaWrap);

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = msg.text;

    bubble.appendChild(header);
    bubble.appendChild(content);
    row.appendChild(bubble);

    this.transcriptContainer.appendChild(row);
  }

  renderErrorBubble(error, retryCallback) {
    const row = document.createElement('div');
    row.className = 'message-row error-row';

    let errorText = 'Oops! Something went wrong connecting to Alex.';
    const rawMsg = (error && error.message) ? String(error.message) : '';

    if (rawMsg === 'INVALID_API_KEY' || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
      errorText = 'Invalid Gemini API key. Please check or re-paste your key in Settings.';
    } else if (rawMsg === 'QUOTA_EXCEEDED' || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      errorText = 'Gemini API quota exceeded for this key. Please check your Google AI Studio quota.';
    } else if (rawMsg === 'NETWORK_ERROR' || rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
      errorText = 'Network connection problem. Please check your internet connection.';
    } else if (rawMsg === 'API_KEY_MISSING') {
      errorText = 'Gemini API key is missing. Please tap Settings to add your key.';
    } else if (rawMsg === 'NO_RESPONSE_GENERATED') {
      errorText = 'Alex could not generate a response. Please tap the mic and try again.';
    } else if (rawMsg.includes('User location is not supported')) {
      errorText = 'Google Gemini API is not supported in your current mobile network location or VPN.';
    } else if (rawMsg.includes('not found') || rawMsg.includes('ListModels') || rawMsg.includes('not supported for generateContent')) {
      errorText = 'The AI model is currently unavailable for this API key. Please check your key in Settings or try again.';
    } else if (rawMsg.length > 0 && !rawMsg.startsWith('[object')) {
      errorText = `Could not connect to Alex: ${rawMsg}`;
    }

    const bubble = document.createElement('div');
    bubble.className = 'error-bubble';
    bubble.innerHTML = `<span>⚠️ ${errorText}</span>`;

    if (retryCallback && rawMsg !== 'API_KEY_MISSING') {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-action-btn';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => {
        row.remove();
        retryCallback();
      });
      bubble.appendChild(retryBtn);
    }

    row.appendChild(bubble);
    this.transcriptContainer.appendChild(row);
    this.scrollToBottom(true);
  }

  clearConversation() {
    this.messages = [];
    Storage.clearConversation();
    this.stopAllActivity();
    this.tracker.reset();
    this.updateLiveTrackerUI(this.tracker.getLiveStats());

    // Remove all message rows except welcome card
    const rows = this.transcriptContainer.querySelectorAll('.message-row');
    rows.forEach(r => r.remove());

    if (this.welcomeCard) {
      this.welcomeCard.classList.remove('hidden');
    }
  }

  scrollToBottom(smooth = true) {
    requestAnimationFrame(() => {
      this.transcriptViewport.scrollTo({
        top: this.transcriptViewport.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    });
  }

  // =========================================================================
  // Live Tracking & Feedback Report Methods
  // =========================================================================

  updateLiveTrackerUI(stats) {
    if (this.trackerTime) this.trackerTime.textContent = stats.formattedTime;
    if (this.trackerTurns) this.trackerTurns.textContent = stats.userTurns;
    if (this.trackerWords) this.trackerWords.textContent = stats.userWordCount;
  }

  async handleGenerateReport() {
    const userMessages = this.messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      alert('Please have a conversation with Alex first! Once you speak a few sentences, click "Feedback" to get your performance evaluation.');
      return;
    }

    if (!this.gemini.hasApiKey()) {
      this.openSettings();
      alert('Please enter your Gemini API key in Settings first to generate a performance report.');
      return;
    }

    // Stop speaking and listening during report generation
    this.stopAllActivity();

    this.openReportModal();
    this.reportLoading.classList.remove('hidden');
    this.reportContent.classList.add('hidden');

    try {
      const metricsSummary = this.tracker.getMetricsSummary();
      const analysis = await this.gemini.analyzeConversation(this.messages, metricsSummary);

      const report = {
        id: 'rep_' + Date.now(),
        date: new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        metrics: metricsSummary,
        analysis
      };

      this.currentReport = report;
      ConversationTracker.saveReport(report);
      this.renderReport(report);
    } catch (err) {
      console.error('Failed to generate report:', err);
      this.reportLoading.innerHTML = '';
      
      const icon = document.createElement('div');
      icon.style.fontSize = '2rem';
      icon.style.marginBottom = '8px';
      icon.textContent = '⚠️';

      const title = document.createElement('h3');
      title.textContent = 'Analysis Unavailable';

      const desc = document.createElement('p');
      desc.style.color = 'var(--danger)';
      desc.style.marginBottom = '16px';
      desc.textContent = err.message || 'An error occurred generating your report.';

      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-primary btn-sm';
      retryBtn.textContent = 'Try Again';
      retryBtn.addEventListener('click', () => this.handleGenerateReport());

      this.reportLoading.append(icon, title, desc, retryBtn);
    }
  }

  openReportModal() {
    this.reportModal.classList.remove('hidden');
  }

  closeReportModal() {
    this.reportModal.classList.add('hidden');
  }

  switchReportTab(tabKey) {
    this.reportTabBtns.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    Object.keys(this.tabPanels).forEach(key => {
      if (this.tabPanels[key]) {
        if (key === tabKey) {
          this.tabPanels[key].classList.remove('hidden');
        } else {
          this.tabPanels[key].classList.add('hidden');
        }
      }
    });
  }

  renderReport(report) {
    this.currentReport = report;
    const { date, metrics, analysis } = report;
    const overall = analysis.overall || {};

    // 1. Hero & Header
    if (this.reportDate) this.reportDate.textContent = date;
    if (this.reportCefrBadge) this.reportCefrBadge.textContent = overall.cefrLevel || 'B1 - Intermediate';
    if (this.reportOverallScore) this.reportOverallScore.textContent = overall.overallScore || 75;
    if (this.reportFluencyScore) this.reportFluencyScore.textContent = overall.fluencyScore || 75;
    if (this.reportGrammarScore) this.reportGrammarScore.textContent = overall.grammarScore || 75;
    if (this.reportVocabScore) this.reportVocabScore.textContent = overall.vocabularyScore || 75;
    if (this.reportSummaryText) this.reportSummaryText.textContent = overall.summary || 'Great work chatting with Alex!';

    // 2. Metrics Strip
    if (this.repStatTime) this.repStatTime.textContent = metrics.formattedTime || 'N/A';
    if (this.repStatTurns) this.repStatTurns.textContent = metrics.userTurns || 0;
    if (this.repStatWords) this.repStatWords.textContent = metrics.userWordCount || 0;
    if (this.repStatAvg) this.repStatAvg.textContent = `${metrics.avgWordsPerTurn || '0.0'} words`;

    // 3. Tab 1: Grammar & Sentences
    const grammarMistakes = analysis.grammarMistakes || [];
    const sentenceStructure = analysis.sentenceStructure || [];

    if (this.grammarBadgeCount) this.grammarBadgeCount.textContent = grammarMistakes.length;
    if (this.structureBadgeCount) this.structureBadgeCount.textContent = sentenceStructure.length;

    this.grammarList.innerHTML = '';
    if (grammarMistakes.length === 0) {
      this.grammarList.innerHTML = `
        <div class="insight-card">
          <p>🎉 <strong>No glaring grammar errors detected!</strong> Your basic grammar was accurate and natural.</p>
        </div>`;
    } else {
      grammarMistakes.forEach(item => {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.innerHTML = `
          <div class="diff-row diff-original">
            <span class="diff-label">You said</span>
            <div class="diff-box">${this.escapeHtml(item.original)}</div>
          </div>
          <div class="diff-row diff-corrected">
            <span class="diff-label">Native Phrasing</span>
            <div class="diff-box">${this.escapeHtml(item.corrected)}</div>
          </div>
          <div class="diff-rule">💡 <strong>Rule:</strong> ${this.escapeHtml(item.rule)}</div>
        `;
        this.grammarList.appendChild(card);
      });
    }

    this.structureList.innerHTML = '';
    if (sentenceStructure.length === 0) {
      this.structureList.innerHTML = `
        <div class="insight-card">
          <p>✨ <strong>Smooth sentence structure!</strong> Your ideas connected together well.</p>
        </div>`;
    } else {
      sentenceStructure.forEach(item => {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.innerHTML = `
          <div class="diff-row diff-original">
            <span class="diff-label">Original Phrasing</span>
            <div class="diff-box">${this.escapeHtml(item.original)}</div>
          </div>
          <div class="diff-row diff-corrected">
            <span class="diff-label">Better Flow</span>
            <div class="diff-box">${this.escapeHtml(item.improved)}</div>
          </div>
          <div class="diff-rule">🗣️ <strong>Why this helps:</strong> ${this.escapeHtml(item.feedback)}</div>
        `;
        this.structureList.appendChild(card);
      });
    }

    // 4. Tab 2: Pronunciation & Articulation Guidance
    const pronunciationList = analysis.pronunciationAndClarity || [];
    this.pronunciationList.innerHTML = '';

    if (pronunciationList.length === 0) {
      this.pronunciationList.innerHTML = `
        <div class="insight-card">
          <p>🎯 <strong>Clear speech clarity!</strong> The speech recognition system transcribed your words with high precision.</p>
        </div>`;
    } else {
      pronunciationList.forEach(item => {
        const card = document.createElement('div');
        card.className = 'pronunciation-card';
        card.innerHTML = `
          <div class="pron-word-badge">${this.escapeHtml(item.word)}</div>
          <div class="pron-issue">⚠️ <strong>Sound Trap:</strong> ${this.escapeHtml(item.issue)}</div>
          <div class="pron-tip">👅 <strong>Pronunciation Tip:</strong> ${this.escapeHtml(item.tip)}</div>
        `;
        this.pronunciationList.appendChild(card);
      });
    }

    // 5. Tab 3: Fluency & Vocabulary
    const fluencyVocab = analysis.fluencyAndVocabulary || {};

    // Fillers detected
    const fillersDetected = metrics.detectedFillers || {};
    const fillerKeys = Object.keys(fillersDetected);
    let fillerText = this.escapeHtml(fluencyVocab.fillerAnalysis || 'Good natural pace.');
    if (fillerKeys.length > 0) {
      const fillerBreakdown = fillerKeys.map(k => `"${this.escapeHtml(k)}" (${this.escapeHtml(String(fillersDetected[k]))}x)`).join(', ');
      fillerText += `<br><small style="color: var(--text-muted); margin-top: 4px; display: block;">Detected in this session: ${fillerBreakdown}</small>`;
    }

    if (this.fillerAnalysisBox) {
      this.fillerAnalysisBox.innerHTML = `<p>${fillerText}</p>`;
    }

    if (this.vocabFeedbackBox) {
      const vocabRichness = metrics.vocabularyRichnessRatio ? ` (Vocabulary Richness: ${metrics.vocabularyRichnessRatio})` : '';
      this.vocabFeedbackBox.innerHTML = `
        <p>${this.escapeHtml(fluencyVocab.vocabularyFeedback || 'Keep expanding your expressive range.')}</p>
        <span style="font-size: 0.78rem; color: var(--primary); font-weight: 600; display: block; margin-top: 6px;">
          ${metrics.uniqueWordsCount || 0} unique words spoken${vocabRichness}
        </span>
      `;
    }

    if (this.flowFeedbackBox) {
      this.flowFeedbackBox.innerHTML = `<p>${this.escapeHtml(fluencyVocab.flowFeedback || 'Consistent responsiveness and turn-taking.')}</p>`;
    }

    // 6. Tab 4: Strengths & Targeted Action Plan
    const strengths = analysis.strengths || [];
    this.strengthsList.innerHTML = '';
    strengths.forEach(s => {
      const item = document.createElement('div');
      item.className = 'strength-item';
      item.innerHTML = `
        <span class="strength-icon">🌟</span>
        <span>${this.escapeHtml(s)}</span>
      `;
      this.strengthsList.appendChild(item);
    });

    const actionPlan = analysis.actionPlan || [];
    this.actionPlanList.innerHTML = '';
    actionPlan.forEach((plan, idx) => {
      const card = document.createElement('div');
      card.className = 'action-plan-card';
      card.innerHTML = `
        <div class="action-step-num">${idx + 1}</div>
        <div class="action-content">
          <div class="action-title">${this.escapeHtml(plan.title)}</div>
          <div class="action-desc">${this.escapeHtml(plan.description)}</div>
        </div>
      `;
      this.actionPlanList.appendChild(card);
    });

    // Reset to grammar tab
    this.switchReportTab('grammar');

    // Show content, hide loading
    this.reportLoading.classList.add('hidden');
    this.reportContent.classList.remove('hidden');
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  generateReportPlainText(report) {
    const { date, metrics, analysis } = report;
    const overall = analysis.overall || {};

    let text = `====================================================\n`;
    text += `       SPEAK EASY - ENGLISH PERFORMANCE REPORT\n`;
    text += `====================================================\n`;
    text += `Date: ${date}\n`;
    text += `Estimated CEFR Level: ${overall.cefrLevel || 'B1'}\n`;
    text += `Overall Score: ${overall.overallScore || 75}/100\n`;
    text += `  - Fluency: ${overall.fluencyScore || 75}/100\n`;
    text += `  - Grammar: ${overall.grammarScore || 75}/100\n`;
    text += `  - Vocabulary: ${overall.vocabularyScore || 75}/100\n\n`;

    text += `SESSION METRICS:\n`;
    text += `- Duration: ${metrics.formattedTime || 'N/A'}\n`;
    text += `- User Turns: ${metrics.userTurns || 0}\n`;
    text += `- Words Spoken: ${metrics.userWordCount || 0} (${metrics.avgWordsPerTurn || 0} words/turn)\n\n`;

    text += `SUMMARY:\n${overall.summary || ''}\n\n`;

    text += `----------------------------------------------------\n`;
    text += `1. GRAMMAR CORRECTIONS:\n`;
    text += `----------------------------------------------------\n`;
    (analysis.grammarMistakes || []).forEach((g, i) => {
      text += `[#${i+1}]\n`;
      text += `You said:    "${g.original}"\n`;
      text += `Native form: "${g.corrected}"\n`;
      text += `Rule:        ${g.rule}\n\n`;
    });

    text += `----------------------------------------------------\n`;
    text += `2. SENTENCE STRUCTURE IMPROVEMENTS:\n`;
    text += `----------------------------------------------------\n`;
    (analysis.sentenceStructure || []).forEach((s, i) => {
      text += `[#${i+1}]\n`;
      text += `Original:    "${s.original}"\n`;
      text += `Better flow: "${s.improved}"\n`;
      text += `Why:         ${s.feedback}\n\n`;
    });

    text += `----------------------------------------------------\n`;
    text += `3. PRONUNCIATION & ARTICULATION GUIDANCE:\n`;
    text += `----------------------------------------------------\n`;
    (analysis.pronunciationAndClarity || []).forEach((p, i) => {
      text += `[#${i+1}] Word: ${p.word}\n`;
      text += `Sound trap: ${p.issue}\n`;
      text += `Tip:        ${p.tip}\n\n`;
    });

    text += `----------------------------------------------------\n`;
    text += `4. STRENGTHS & CELEBRATIONS:\n`;
    text += `----------------------------------------------------\n`;
    (analysis.strengths || []).forEach(st => {
      text += `✓ ${st}\n`;
    });
    text += `\n`;

    text += `----------------------------------------------------\n`;
    text += `5. TARGETED ACTION PLAN & STRATEGIES:\n`;
    text += `----------------------------------------------------\n`;
    (analysis.actionPlan || []).forEach((ap, i) => {
      text += `[Step ${i+1}] ${ap.title}\n`;
      text += `${ap.description}\n\n`;
    });

    return text;
  }

  copyReportSummary() {
    if (!this.currentReport) return;
    const text = this.generateReportPlainText(this.currentReport);
    navigator.clipboard.writeText(text).then(() => {
      alert('Report copied to clipboard! You can paste it into notes or share it with a tutor.');
    }).catch(err => {
      console.warn('Clipboard write failed:', err);
    });
  }

  downloadReport() {
    if (!this.currentReport) return;
    const text = this.generateReportPlainText(this.currentReport);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SpeakEasy_Report_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // History Modal Methods
  // =========================================================================

  openHistoryModal() {
    this.renderHistoryList();
    this.historyModal.classList.remove('hidden');
  }

  closeHistoryModal() {
    this.historyModal.classList.add('hidden');
  }

  renderHistoryList() {
    const reports = ConversationTracker.getSavedReports();
    this.historyList.innerHTML = '';

    if (reports.length === 0) {
      this.historyList.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 8px;">📭</div>
          <p>No saved reports yet.</p>
          <small>Complete a conversation session with Alex and tap "Feedback" to save a report here!</small>
        </div>
      `;
      return;
    }

    reports.forEach(report => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const overall = report.analysis?.overall || {};
      const metrics = report.metrics || {};

      item.innerHTML = `
        <div class="history-info">
          <div class="history-date">${this.escapeHtml(report.date || 'Past Session')}</div>
          <div class="history-meta">
            <span>Level: <strong>${this.escapeHtml(overall.cefrLevel || 'B1')}</strong></span>
            <span>Score: <strong>${overall.overallScore || 'N/A'}/100</strong></span>
            <span>Words: <strong>${metrics.userWordCount || 0}</strong></span>
          </div>
        </div>
        <div class="history-actions">
          <button class="btn btn-sm btn-primary view-rep-btn">View</button>
          <button class="btn btn-sm btn-danger del-rep-btn" title="Delete report">✕</button>
        </div>
      `;

      item.querySelector('.view-rep-btn').addEventListener('click', () => {
        this.closeHistoryModal();
        this.openReportModal();
        this.renderReport(report);
      });

      item.querySelector('.del-rep-btn').addEventListener('click', () => {
        if (confirm('Delete this report?')) {
          ConversationTracker.deleteReport(report.id);
          this.renderHistoryList();
        }
      });

      this.historyList.appendChild(item);
    });
  }
}

// Instantiate SpeakEasy once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.speakEasyApp = new SpeakEasyApp();
});

