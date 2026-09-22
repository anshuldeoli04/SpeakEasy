/**
 * SpeakEasy - Gemini 2.5 Flash API Client
 * Manages calls to Google Gemini with latency-optimized thinkingBudget: 0.
 */

export const ALEX_SYSTEM_PROMPT = `You are "Alex," a warm, patient, and encouraging English conversation partner. Your purpose is to help the user practice spoken English in a low-pressure, stress-free environment. You are NOT a lecturer. You are a friendly native speaker who genuinely enjoys chatting.

VOICE OUTPUT RULES (CRITICAL — FOLLOW STRICTLY):
1. NO LISTS. Never use numbered lists, bullet points, or "first, second, third" structures. Speak in natural flowing sentences.
2. NO MARKDOWN. Do not use asterisks, bold, headers, or any formatting. Your output goes directly to a text-to-speech engine.
3. SPEED & BREVITY (CRITICAL): Keep every response to 1–2 short, punchy sentences (maximum 20-25 words total). Answer immediately with casual conversational phrasing. Do not over-elaborate.
4. USE NATURAL FILLERS sparingly: "Hmm," "Well," "You know," "Actually," "I see." These make you sound human, not robotic.
5. ALWAYS END WITH A QUESTION to pass the turn back to the user. Never monologue. The goal is to keep them talking.
6. SPEAK LIKE YOU'RE THINKING, not reading. Use contractions (I'm, don't, that's). Break sentences. Use short clauses.

CONVERSATION STYLE:
- Match the user's energy. If they're hesitant, be gentle. If they're excited, match it.
- Use simple, everyday vocabulary. Avoid rare words or complex idioms unless you immediately explain them in plain English.
- If the user makes a grammar or word-choice error, DO NOT correct them mid-sentence. Let them finish. Then, in your reply, subtly model the correct form naturally (e.g., if they said "I goed there," you reply: "Oh, you went there? Nice! What did you do?").
- Only give an explicit correction if the user asks for it or if the error repeatedly blocks understanding. When you do correct, be kind and brief: "Quick tip — we usually say 'I went,' not 'I goed.' Anyway, tell me more about..."

STRESS-REDUCTION & ENCOURAGEMENT:
- Your primary goal is to reduce the user's speaking anxiety.
- Start the session by asking a simple, open-ended question about their day or interests.
- Never say "That's wrong." Say "Almost!" or "Good try — here's a natural way to say that."
- Celebrate effort, not perfection. Phrases like "You're doing great," "That was really clear," or "I understood you perfectly" build confidence.
- If the user seems stuck or nervous, gently switch to an easier topic or offer a sentence starter: "Try saying: 'I think...' and then finish the thought."
- If the user says they are stressed or tired, acknowledge it warmly and suggest a light topic or a short breathing moment before continuing.

TOPIC MANAGEMENT:
- Follow the user's lead. Let them choose what to talk about.
- If the conversation stalls, offer TWO simple options: "Want to talk about movies, or maybe travel?"
- Avoid controversial, political, or sensitive topics unless the user explicitly initiates them and seems comfortable.

SESSION FLOW:
- GREETING: Start with a warm, casual hello and a simple question.
- DURING: Maintain the 1–3 sentence + question rhythm.
- WRAP-UP: If the user says they need to go, end warmly: "Great chat today. You spoke really clearly. Same time tomorrow?"

EXAMPLE RESPONSE (for calibration):
BAD: "There are three key benefits to practicing English daily. First, it improves fluency. Second, it expands vocabulary. Third, it builds confidence."
GOOD: "Honestly, just talking every day makes a huge difference. Even five minutes helps. So, what made you want to practice today?"`;

const CANDIDATE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-1.5-flash'
];

export class GeminiClient {
  constructor(apiKey) {
    this.apiKey = GeminiClient.sanitizeApiKey(apiKey);
    this.activeModel = 'gemini-2.5-flash-lite';
    this.discoveredModels = null;
    this.discoveryPromise = null;
  }

  setApiKey(apiKey) {
    const sanitized = GeminiClient.sanitizeApiKey(apiKey);
    if (sanitized !== this.apiKey) {
      this.apiKey = sanitized;
      this.discoveredModels = null;
      this.discoveryPromise = null;
      this.activeModel = 'gemini-2.5-flash-lite';
    }
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  static sanitizeApiKey(key) {
    if (!key) return '';
    return key
      .toString()
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // remove zero-width & non-breaking spaces
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '') // remove surrounding quotes
      .trim();
  }

  /**
   * Cleans text to make sure no markdown tags slip into the TTS engine.
   */
  static cleanSpeechText(text) {
    if (!text) return '';
    return text
      .replace(/[*_~`#>-]/g, '') // remove markdown symbols
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Dynamically queries ModelService.ListModels to discover which models this API key
   * is authorized to use, prioritizing low-latency Flash models.
   * @returns {Promise<string[]>} List of available model identifiers
   */
  async getAvailableModels() {
    if (this.discoveredModels && this.discoveredModels.length > 0) {
      return this.discoveredModels;
    }

    if (this.discoveryPromise) {
      return this.discoveryPromise;
    }

    this.discoveryPromise = (async () => {
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.apiKey)}`;
        const response = await fetch(listUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data?.models)) {
            // Keep models that explicitly support generateContent
            const supported = data.models
              .filter(m => Array.isArray(m.supportedMethods) && m.supportedMethods.includes('generateContent'))
              .map(m => (m.name || '').replace(/^models\//, ''))
              .filter(name => Boolean(name));

            if (supported.length > 0) {
              // Prioritize low-latency Flash-Lite models and zero-thinking models
              const scoreModel = (name) => {
                let score = 0;
                if (name.includes('flash')) score += 100;
                // Prioritize ultra-low latency Flash-Lite models (<0.3s)
                if (name.includes('lite')) score += 60;
                if (name.includes('2.5')) score += 40; // 2.5 supports thinkingBudget: 0 (zero reasoning lag)
                else if (name.includes('3.5')) score += 30;
                else if (name.includes('3.8')) score += 10;
                else if (name.includes('2.0')) score += 5;
                else if (name.includes('1.5')) score += 1;
                return score;
              };

              supported.sort((a, b) => scoreModel(b) - scoreModel(a));
              this.discoveredModels = supported;
              if (!supported.includes(this.activeModel)) {
                this.activeModel = supported[0];
              }
              console.log(`[SpeakEasy] Discovered ${supported.length} available models. Primary: ${this.activeModel}`);
              return this.discoveredModels;
            }
          }
        }
      } catch (err) {
        console.warn('[SpeakEasy] Model discovery via ListModels failed, using fallback candidate list:', err);
      } finally {
        this.discoveryPromise = null;
      }

      return CANDIDATE_MODELS;
    })();

    return this.discoveryPromise;
  }

  /**
   * Builds an appropriate generationConfig object based on model version capabilities.
   * @param {string} model - Model identifier
   * @param {boolean} isAnalysis - True for session feedback analysis
   * @param {boolean} omitThinking - True to skip thinkingConfig (e.g. for fallback retry)
   * @returns {Object}
   */
  static buildGenerationConfig(model, isAnalysis = false, omitThinking = false) {
    const config = {
      temperature: isAnalysis ? 0.3 : 0.7,
      maxOutputTokens: isAnalysis ? 2048 : 120
    };

    if (!omitThinking) {
      if (model.includes('2.5')) {
        // Zero thinking budget completely turns off reasoning tokens for immediate voice output
        config.thinkingConfig = { thinkingBudget: 0 };
      } else if (model.includes('3.8') || model.includes('3.5')) {
        config.thinkingConfig = { thinkingLevel: 'LOW' };
      }
    }

    return config;
  }

  /**
   * Helper to make generateContent request with automatic thinkingConfig retry if needed.
   * @param {string} model - Model name
   * @param {Object} payloadBase - Payload without generationConfig
   * @param {boolean} isAnalysis - True if analysis request
   * @returns {Promise<Object>} API response JSON
   */
  async _callGenerateContent(model, payloadBase, isAnalysis = false) {
    const configsToTry = [
      GeminiClient.buildGenerationConfig(model, isAnalysis, false)
    ];
    // If thinkingConfig is present, add fallback without thinkingConfig
    if (configsToTry[0].thinkingConfig) {
      configsToTry.push(GeminiClient.buildGenerationConfig(model, isAnalysis, true));
    }

    let lastRes = null;
    let lastErrBody = null;

    for (const genConfig of configsToTry) {
      const payload = {
        ...payloadBase,
        generationConfig: genConfig
      };

      const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return await response.json();
      }

      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch (e) {}

      lastRes = response;
      lastErrBody = errorBody;

      const status = response.status;
      const apiMsg = errorBody?.error?.message || '';

      if (status === 400 && (apiMsg.includes('API_KEY_INVALID') || apiMsg.includes('API key not valid'))) {
        throw new Error('INVALID_API_KEY');
      }
      if (status === 403) {
        throw new Error('INVALID_API_KEY');
      }
      if (status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }

      // If error is about thinkingConfig or unknown field, retry without thinkingConfig
      if (status === 400 && (apiMsg.includes('thinking') || apiMsg.includes('unknown field') || apiMsg.includes('Invalid JSON payload'))) {
        console.warn(`Model ${model} rejected thinkingConfig (${apiMsg}). Retrying without thinkingConfig...`);
        continue;
      }

      break;
    }

    const status = lastRes ? lastRes.status : 500;
    const apiMsg = lastErrBody?.error?.message || `Server returned error (${status})`;

    if (status === 404 || (status === 400 && (apiMsg.includes('not found') || apiMsg.includes('not supported')))) {
      const err = new Error(apiMsg);
      err.status = status;
      err.isModelUnavailable = true;
      throw err;
    }

    throw new Error(apiMsg);
  }

  /**
   * Helper to make streaming generateContent request using SSE.
   * @param {string} model - Model name
   * @param {Object} payloadBase - Payload without generationConfig
   * @param {Function} onChunk - Real-time accumulated text callback
   * @returns {Promise<string>} Cleaned text reply
   */
  async _callStreamGenerateContent(model, payloadBase, onChunk) {
    const genConfig = GeminiClient.buildGenerationConfig(model, false, false);
    const payload = {
      ...payloadBase,
      generationConfig: genConfig
    };

    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorBody = {};
      try { errorBody = await response.json(); } catch (e) {}
      const status = response.status;
      const apiMsg = errorBody?.error?.message || '';

      if (status === 400 && (apiMsg.includes('API_KEY_INVALID') || apiMsg.includes('API key not valid'))) {
        throw new Error('INVALID_API_KEY');
      }
      if (status === 403) throw new Error('INVALID_API_KEY');
      if (status === 429) throw new Error('QUOTA_EXCEEDED');

      const err = new Error(apiMsg || `Stream request failed (${status})`);
      err.status = status;
      if (status === 404 || (status === 400 && (apiMsg.includes('not found') || apiMsg.includes('not supported')))) {
        err.isModelUnavailable = true;
      }
      throw err;
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new Error('STREAMING_NOT_SUPPORTED');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const candidate = data.candidates?.[0];
            if (candidate?.content?.parts) {
              const textParts = candidate.content.parts
                .filter(p => !p.thought && typeof p.text === 'string')
                .map(p => p.text)
                .join('');
              if (textParts) {
                accumulatedText += textParts;
                if (onChunk && typeof onChunk === 'function') {
                  onChunk(GeminiClient.cleanSpeechText(accumulatedText));
                }
              }
            }
          } catch (e) {
            // Partial JSON chunk ignored
          }
        }
      }
    }

    if (!accumulatedText.trim()) {
      throw new Error('NO_RESPONSE_GENERATED');
    }

    return GeminiClient.cleanSpeechText(accumulatedText);
  }

  /**
   * Generates a reply from Gemini Flash with automatic multi-model fallback and streaming
   * @param {Array<{role: 'user'|'model', text: string}>} history - Full or recent conversation
   * @param {Function} onChunk - Optional streaming chunk callback
   * @returns {Promise<string>} AI text reply
   */
  async generateReply(history = [], onChunk = null) {
    if (!this.hasApiKey()) {
      throw new Error('API_KEY_MISSING');
    }

    // Map only the last 10 messages as required
    const recentHistory = history.slice(-10);

    // Format for Gemini API: user -> "user", AI -> "model"
    const contents = recentHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // If history is empty (e.g. initial greeting request), seed with a greeting trigger
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello Alex! I am ready to practice speaking English.' }]
      });
    }

    const availableModels = await this.getAvailableModels();
    const modelsToTry = [
      this.activeModel,
      ...availableModels.filter(m => m !== this.activeModel)
    ];

    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const payloadBase = {
          contents,
          systemInstruction: {
            parts: [{ text: ALEX_SYSTEM_PROMPT }]
          }
        };

        // If streaming callback provided, attempt fast SSE stream first
        if (onChunk && typeof onChunk === 'function') {
          try {
            const streamedText = await this._callStreamGenerateContent(model, payloadBase, onChunk);
            this.activeModel = model;
            return streamedText;
          } catch (streamErr) {
            if (streamErr.message === 'INVALID_API_KEY' || streamErr.message === 'QUOTA_EXCEEDED') {
              throw streamErr;
            }
            if (streamErr.isModelUnavailable) {
              throw streamErr;
            }
            console.warn(`[SpeakEasy] Streaming with ${model} failed, falling back to standard generation:`, streamErr);
          }
        }

        const data = await this._callGenerateContent(model, payloadBase, false);

        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content?.parts?.length) {
          throw new Error('NO_RESPONSE_GENERATED');
        }

        // Extract text while ignoring internal thought reasoning parts
        const textParts = candidate.content.parts
          .filter(p => !p.thought && typeof p.text === 'string')
          .map(p => p.text);

        const rawText = textParts.length > 0
          ? textParts.join(' ')
          : candidate.content.parts.map(p => p.text || '').join(' ');

        if (!rawText.trim()) {
          throw new Error('NO_RESPONSE_GENERATED');
        }

        this.activeModel = model;
        const cleaned = GeminiClient.cleanSpeechText(rawText);
        if (onChunk && typeof onChunk === 'function') {
          onChunk(cleaned);
        }
        return cleaned;
      } catch (err) {
        if (err.message === 'INVALID_API_KEY' || err.message === 'QUOTA_EXCEEDED') {
          throw err;
        }
        if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Network'))) {
          throw new Error('NETWORK_ERROR');
        }
        if (err.isModelUnavailable || (err.message && (err.message.includes('not found') || err.message.includes('not supported')))) {
          console.warn(`Model ${model} unavailable (${err.message}). Trying fallback model...`);
          lastError = err;
          continue;
        }
        lastError = err;
      }
    }

    throw lastError || new Error('NO_RESPONSE_GENERATED');
  }

  /**
   * Analyzes the whole conversation and generates a structured performance report
   * @param {Array<{role: 'user'|'model', text: string}>} messages - Full conversation history
   * @param {Object} sessionMetrics - Metrics from ConversationTracker
   * @returns {Promise<Object>} Parsed analysis report
   */
  async analyzeConversation(messages = [], sessionMetrics = {}) {
    if (!this.hasApiKey()) {
      throw new Error('API_KEY_MISSING');
    }

    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      throw new Error('NO_USER_MESSAGES');
    }

    const conversationTranscript = messages
      .map(m => `${m.role === 'user' ? 'USER' : 'ALEX'}: "${m.text}"`)
      .join('\n');

    const metricsDescription = `
SESSION METRICS:
- Duration: ${sessionMetrics.formattedTime || 'N/A'}
- User Turns: ${sessionMetrics.userTurns || userMessages.length}
- Total Words Spoken: ${sessionMetrics.userWordCount || 'N/A'}
- Unique Words: ${sessionMetrics.uniqueWordsCount || 'N/A'}
- Average Words per Turn: ${sessionMetrics.avgWordsPerTurn || 'N/A'}
- Fillers Detected: ${JSON.stringify(sessionMetrics.detectedFillers || {})}
`;

    const analysisPrompt = `
You are an expert English Language Assessor, certified CEFR speaking examiner, and supportive conversation coach.
Analyze the user's spoken performance from this real-time English conversation practice session with AI partner Alex.

${metricsDescription}

CONVERSATION TRANSCRIPT:
${conversationTranscript}

YOUR TASK:
Carefully evaluate the USER's performance across:
1. Grammatical accuracy (tense consistency, subject-verb agreement, prepositions, articles).
2. Sentence structure & syntax (word order, run-ons, fragments, variety of clauses).
3. Pronunciation & phonetic speech clarity (identify words that were phonetically mispronounced, substituted by speech recognition, dropped endings like -ed or -s, and phonetic tips).
4. Fluency & vocabulary (pacing, repetition, filler words, vocabulary level).
5. Strengths (celebrate what they did right to encourage them!).
6. Actionable advice & targeted improvement strategies (practical drills and exercises for their specific weak spots).

OUTPUT FORMAT:
You MUST respond ONLY with a single valid JSON object (no extra commentary before or after). Follow this exact JSON schema:

{
  "overall": {
    "cefrLevel": "B1 - Intermediate",
    "overallScore": 75,
    "fluencyScore": 74,
    "grammarScore": 72,
    "vocabularyScore": 78,
    "summary": "Warm, encouraging 2-3 sentence summary of their conversation performance and effort."
  },
  "grammarMistakes": [
    {
      "original": "exact quote of user error",
      "corrected": "corrected natural sentence",
      "rule": "concise explanation of the grammar rule"
    }
  ],
  "sentenceStructure": [
    {
      "original": "awkward or flawed sentence structure",
      "improved": "natural, fluent sentence phrasing",
      "feedback": "why this structural change makes their English sound more natural"
    }
  ],
  "pronunciationAndClarity": [
    {
      "word": "word or phrase with pronunciation challenge",
      "issue": "phonetic trap or speech-recognition misinterpretation (e.g. dropped -ed, th-sound, vowel confusion)",
      "tip": "concrete tip on mouth/tongue shape, syllable stress, or rhyming clue"
    }
  ],
  "fluencyAndVocabulary": {
    "fillerAnalysis": "Observation on filler words and pauses",
    "vocabularyFeedback": "Observation on word choice variety, plus 2-3 recommended upgraded phrases/synonyms",
    "flowFeedback": "Observation on turn length and speaking momentum"
  },
  "strengths": [
    "Specific positive observation 1",
    "Specific positive observation 2"
  ],
  "actionPlan": [
    {
      "title": "Name of Drill or Strategy",
      "description": "Specific daily exercise tailored to their biggest error in this session."
    },
    {
      "title": "Next Session Goal",
      "description": "Clear target to aim for in their next conversation with Alex."
    }
  ]
}
`;

    const availableModels = await this.getAvailableModels();
    const modelsToTry = [
      this.activeModel,
      ...availableModels.filter(m => m !== this.activeModel)
    ];

    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const payloadBase = {
          contents: [
            {
              role: 'user',
              parts: [{ text: analysisPrompt }]
            }
          ]
        };

        const data = await this._callGenerateContent(model, payloadBase, true);

        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content?.parts?.length) {
          throw new Error('NO_RESPONSE_GENERATED');
        }

        const textParts = candidate.content.parts
          .filter(p => !p.thought && typeof p.text === 'string')
          .map(p => p.text);

        const rawText = (textParts.length > 0
          ? textParts.join(' ')
          : candidate.content.parts.map(p => p.text || '').join(' ')
        ).trim();

        this.activeModel = model;

        // Parse JSON safely (removing markdown code blocks if present)
        try {
          const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
          const jsonString = (jsonMatch[1] || rawText).trim();
          return JSON.parse(jsonString);
        } catch (jsonErr) {
          console.error('Failed to parse analysis JSON:', jsonErr, rawText);
          return {
            overall: {
              cefrLevel: "Evaluation Ready",
              overallScore: 75,
              fluencyScore: 75,
              grammarScore: 75,
              vocabularyScore: 75,
              summary: rawText.slice(0, 300)
            },
            grammarMistakes: [],
            sentenceStructure: [],
            pronunciationAndClarity: [],
            fluencyAndVocabulary: {
              fillerAnalysis: "Analysis processed.",
              vocabularyFeedback: "Keep expanding your vocabulary!",
              flowFeedback: "Consistent effort shown."
            },
            strengths: ["Actively engaged in English conversation."],
            actionPlan: [{ title: "Daily Practice", description: "Continue talking with Alex every day." }]
          };
        }
      } catch (err) {
        if (err.message === 'INVALID_API_KEY' || err.message === 'QUOTA_EXCEEDED') {
          throw err;
        }
        if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Network'))) {
          throw new Error('NETWORK_ERROR');
        }
        if (err.isModelUnavailable || (err.message && (err.message.includes('not found') || err.message.includes('not supported')))) {
          console.warn(`Analysis with ${model} unavailable (${err.message}). Trying fallback model...`);
          lastError = err;
          continue;
        }
        lastError = err;
      }
    }

    throw lastError || new Error('Analysis request failed across all candidate models.');
  }
}

