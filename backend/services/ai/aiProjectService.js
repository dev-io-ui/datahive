const geminiClient = require('./geminiClient');
const { buildProjectPrompt } = require('../../prompts/ai/project.prompt');
const { projectGenerationSchema } = require('../../schemas/ai/project.schema');
const logger = require('../../utils/logger');

class AIProjectService {
  async generateProject({ idea, adminId, includeTasks = false }) {
    const prompt = buildProjectPrompt({ idea, includeTasks });

    const result = await geminiClient.generateJson({
      prompt,
      responseSchema: projectGenerationSchema,
      requestMeta: {
        feature: 'ai-project-generator',
        adminId,
      },
    });

    this.assertGeneratedPayload(result, { includeTasks });

    logger.info({
      message: 'AI project generated',
      feature: 'ai-project-generator',
      adminId,
      taskCount: result.tasks?.length || 0,
    });

    return {
      providerUsed: 'gemini',
      project: result.project,
      tasks: result.tasks || [],
    };
  }

  assertGeneratedPayload(result, { includeTasks }) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      this.throwSchemaError('AI response must be an object');
    }

    if (!result.project || typeof result.project !== 'object' || Array.isArray(result.project)) {
      this.throwSchemaError('AI response project is missing or invalid');
    }

    if (includeTasks && (!Array.isArray(result.tasks) || result.tasks.length < 1)) {
      this.throwSchemaError('AI response tasks are missing or invalid');
    }
  }

  throwSchemaError(message) {
    const err = new Error(message);
    err.statusCode = 422;
    throw err;
  }
}

module.exports = new AIProjectService();
