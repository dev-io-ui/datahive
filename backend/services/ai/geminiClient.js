const { GoogleGenAI } = require('@google/genai');
const logger = require('../../utils/logger');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 45000;

class GeminiClient {
  constructor() {
    this.client = null;
  }

  getClient() {
    if (!process.env.GEMINI_API_KEY) {
      const err = new Error('Gemini API key is not configured');
      err.statusCode = 503;
      throw err;
    }

    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    return this.client;
  }

  async generateJson({ prompt, responseSchema, model, timeoutMs = DEFAULT_TIMEOUT_MS, requestMeta = {} }) {
    const ai = this.getClient();
    const modelName = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    logger.info({
      message: 'Gemini JSON generation requested',
      model: modelName,
      feature: requestMeta.feature,
    });

    const request = ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    let response;
    try {
      response = await this.withTimeout(request, timeoutMs);
    } catch (err) {
      if (err.code === 'GEMINI_TIMEOUT') {
        logger.error({
          message: 'Gemini request timed out',
          model: modelName,
          feature: requestMeta.feature,
          timeoutMs,
        });
        const timeoutError = new Error('Gemini request timed out');
        timeoutError.statusCode = 504;
        throw timeoutError;
      }

      logger.error({
        message: 'Gemini request failed',
        model: modelName,
        feature: requestMeta.feature,
        error: err.message,
      });
      const apiError = new Error('Gemini request failed');
      apiError.statusCode = err.statusCode || err.status || 502;
      throw apiError;
    }

    return this.parseJsonResponse(response);
  }

  async withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error('Gemini request timed out');
        err.code = 'GEMINI_TIMEOUT';
        reject(err);
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  parseJsonResponse(response) {
    const text = response?.text;
    if (!text || typeof text !== 'string') {
      const err = new Error('Gemini returned an empty response');
      err.statusCode = 502;
      throw err;
    }

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      logger.error({
        message: 'Gemini returned invalid JSON',
        error: parseErr.message,
      });
      const err = new Error('Gemini returned invalid JSON');
      err.statusCode = 502;
      throw err;
    }
  }
}

module.exports = new GeminiClient();
