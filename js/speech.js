/**
 * SpeakEasy - Web Speech API Service
 * Handles SpeechRecognition (STT) and SpeechSynthesis (TTS).
 */

export class SpeechService {
  constructor(options = {}) {
    this.rate = options.rate || 1.0;
    this.selectedVoiceUri = options.voiceUri || '';
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onSpeechResult = options.onSpeechResult || (() => {});
    this.onInterimResult = options.onInterimResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onVoicesChanged = options.onVoicesChanged || (() => {});

    this.isListening = false;
    this.isSpeaking = false;
    this.recognition = null;
    this.availableVoices = [];
    this.currentUtterance = null;
    this.shouldAutoRestart = false;
    this.finalTranscript = '';

    this._initSpeechRecognition();
    this._initSpeechSynthesis();
  }

  /**
   * Check if browser supports speech recognition
   */
  static isRecognitionSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Check if browser supports speech synthesis
   */
  static isSynthesisSupported() {
    return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  _initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('SpeechRecognition is not supported in this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false; // Turn-based conversation
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.finalTranscript = '';
        this.onStatusChange('listening');
      };

      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            this.finalTranscript += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }

        if (interim) {
          this.onInterimResult(interim);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        this.isListening = false;

        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            if (this.isUserInitiated) {
              this.onError(
                'MIC_PERMISSION_DENIED',
                'Microphone access was denied. Please allow microphone access in your browser settings.'
              );
            }
            this.onStatusChange('idle');
            break;
          case 'no-speech':
            // Simply timed out without speech; reset to idle
            this.onStatusChange('idle');
            break;
          case 'audio-capture':
            this.onError('NO_MIC_HARDWARE', 'No microphone was detected on your device.');
            this.onStatusChange('idle');
            break;
          case 'network':
            this.onError('SPEECH_NETWORK_ERROR', 'Network error during speech recognition. Please check your internet connection.');
            this.onStatusChange('idle');
            break;
          case 'aborted':
            // Normal when manually stopped
            break;
          default:
            this.onStatusChange('idle');
        }
      };

      this.recognition.onend = () => {
        const wasListening = this.isListening;
        this.isListening = false;

        const recognizedText = this.finalTranscript.trim();
        this.finalTranscript = '';

        if (recognizedText) {
          this.onSpeechResult(recognizedText);
        } else if (wasListening) {
          this.onStatusChange('idle');
        }
      };
    } catch (err) {
      console.error('Failed to create SpeechRecognition instance:', err);
    }
  }

  _initSpeechSynthesis() {
    if (!SpeechService.isSynthesisSupported()) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      if (voices.length > 0) {
        // Filter and sort: English voices first, natural/neural voices highlighted
        this.availableVoices = voices.slice().sort((a, b) => {
          const aIsEn = a.lang.toLowerCase().startsWith('en');
          const bIsEn = b.lang.toLowerCase().startsWith('en');
          if (aIsEn && !bIsEn) return -1;
          if (!aIsEn && bIsEn) return 1;
          return a.name.localeCompare(b.name);
        });
        this.onVoicesChanged(this.availableVoices);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Start listening for user speech
   * @param {boolean} isUserInitiated - True if triggered by direct user click
   */
  startListening(isUserInitiated = true) {
    this.isUserInitiated = isUserInitiated;
    if (!this.recognition) {
      this.onError('NOT_SUPPORTED', 'Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }

    // Stop speaking if currently speaking
    if (this.isSpeaking) {
      this.stopSpeaking();
    }

    if (this.isListening) {
      return true;
    }

    try {
      this.recognition.start();
      return true;
    } catch (e) {
      // If already started, ignore error
      if (e.name !== 'InvalidStateError') {
        console.error('Error starting recognition:', e);
      }
      return false;
    }
  }

  /**
   * Stop listening
   */
  stopListening() {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch (e) {
      console.warn('Error stopping recognition:', e);
    }
    this.isListening = false;
  }

  /**
   * Abort listening immediately without processing final results
   */
  abortListening() {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch (e) {
      console.warn('Error aborting recognition:', e);
    }
    this.isListening = false;
    this.finalTranscript = '';
    this.onStatusChange('idle');
  }

  /**
   * Speak a text string using selected voice and rate
   * @param {string} text 
   * @param {Function} onFinishedCallback 
   */
  speak(text, onFinishedCallback = null) {
    if (!SpeechService.isSynthesisSupported()) {
      if (onFinishedCallback) onFinishedCallback();
      return;
    }

    // Cancel any active speech first
    window.speechSynthesis.cancel();
    this.stopListening();

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance; // Prevent garbage collection bug in Chrome

    utterance.rate = this.rate;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    // Find requested voice or pick best English voice
    if (this.availableVoices.length > 0) {
      let voice = null;
      if (this.selectedVoiceUri) {
        voice = this.availableVoices.find(v => v.voiceURI === this.selectedVoiceUri);
      }
      if (!voice) {
        // Prefer natural / google / en-US voice
        voice = this.availableVoices.find(v => 
          v.lang.toLowerCase().startsWith('en') && 
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Jenny'))
        ) || this.availableVoices.find(v => v.lang.toLowerCase().startsWith('en')) || this.availableVoices[0];
      }
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.onStatusChange('speaking');
    };

    const cleanupAndFinish = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.onStatusChange('idle');
      if (onFinishedCallback) {
        onFinishedCallback();
      }
    };

    utterance.onend = () => {
      cleanupAndFinish();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('SpeechSynthesis error:', e);
      }
      cleanupAndFinish();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Failed to invoke window.speechSynthesis.speak:', e);
      cleanupAndFinish();
    }
  }

  /**
   * Cancel any active speaking immediately
   */
  stopSpeaking() {
    if (SpeechService.isSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
    this.onStatusChange('idle');
  }

  setRate(rate) {
    this.rate = Math.min(Math.max(parseFloat(rate) || 1.0, 0.5), 1.5);
  }

  setVoiceUri(uri) {
    this.selectedVoiceUri = uri;
  }
}
