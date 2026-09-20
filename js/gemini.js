/**
 * SpeakEasy - Gemini 2.5 Flash API Client
 * Manages calls to Google Gemini with latency-optimized thinkingBudget: 0.
 */

export const ALEX_SYSTEM_PROMPT = `You are "Alex," a warm, patient, and encouraging English conversation partner. Your purpose is to help the user practice spoken English in a low-pressure, stress-free environment. You are NOT a lecturer. You are a friendly native speaker who genuinely enjoys chatting.

VOICE OUTPUT RULES (CRITICAL — FOLLOW STRICTLY):
1. NO LISTS. Never use numbered lists, bullet points, or "first, second, third" structures. Speak in natural flowing sentences.
2. NO MARKDOWN. Do not use asterisks, bold, headers, or any formatting. Your output goes directly to a text-to-speech engine.
3. LENGTH LIMIT: Keep every response to 1–3 short sentences maximum, unless the user explicitly asks you to explain something in detail.
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

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export class GeminiClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  setApiKey(apiKey) {
    this.apiKey = (apiKey || '').trim();
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.length > 5);
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
   * Generates a reply from Gemini 2.5 Flash
   * @param {Array<{role: 'user'|'model', text: string}>} history - Full or recent conversation
   * @returns {Promise<string>} AI text reply
   */
  async generateReply(history = []) {
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

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: ALEX_SYSTEM_PROMPT }]
      },
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 200,
        thinkingConfig: { thinkingBudget: 0 } // Zero-latency thinking mode
      }
    };

    const endpointUrl = GEMINI_API_BASE;

    let response;
    try {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify(payload)
      });
    } catch (networkError) {
      console.error('Network error reaching Gemini API:', networkError);
      throw new Error('NETWORK_ERROR');
    }

    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch (e) {
        // non-json response
      }

      console.error('Gemini API Error details:', response.status, errorBody);

      if (response.status === 400 || response.status === 403) {
        throw new Error('INVALID_API_KEY');
      } else if (response.status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      } else {
        const errorMsg = errorBody?.error?.message || `Server returned error (${response.status})`;
        const err = new Error(errorMsg);
        err.status = response.status;
        throw err;
      }
    }

    const data = await response.json();

    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.length) {
      throw new Error('NO_RESPONSE_GENERATED');
    }

    const rawText = candidate.content.parts.map(p => p.text).join(' ');
    return GeminiClient.cleanSpeechText(rawText);
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

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: analysisPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    const endpointUrl = GEMINI_API_BASE;

    let response;
    try {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify(payload)
      });
    } catch (networkError) {
      console.error('Network error during analysis:', networkError);
      throw new Error('NETWORK_ERROR');
    }

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        throw new Error('INVALID_API_KEY');
      } else if (response.status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }
      throw new Error(`Analysis request failed (${response.status})`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.length) {
      throw new Error('NO_RESPONSE_GENERATED');
    }

    const rawText = candidate.content.parts.map(p => p.text).join(' ').trim();
    
    // Parse JSON safely (removing markdown code blocks if present)
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      const jsonString = (jsonMatch[1] || rawText).trim();
      return JSON.parse(jsonString);
    } catch (jsonErr) {
      console.error('Failed to parse analysis JSON:', jsonErr, rawText);
      // Fallback structured object
      return {
        overall: {
          cefrLevel: "Evaluation Ready",
          overallScore: 70,
          fluencyScore: 70,
          grammarScore: 70,
          vocabularyScore: 70,
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
  }
}

