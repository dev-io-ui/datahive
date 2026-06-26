const { GoogleGenAI } = require("@google/genai");
const logger = require("../utils/logger");

class AITaskService {

    constructor() {
        this.ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });
    }

    async generateTasks({
        taskType,
        description,
        language,
        country,
        count
    }) {

        count = Math.min(Math.max(Number(count) || 10, 1), 100);

        const prompt = `
You are an expert AI dataset creator.

Generate ${count} unique dataset annotation tasks.

Task Type:
${taskType}

Language:
${language}

Country:
${country}

Project Description:
${description}

Each task MUST contain:

- title
- description
- instructions
- sampleInput
- expectedOutput

Return ONLY valid JSON.

Example:

[
  {
    "title":"Translate English to Hindi",
    "description":"Translate the sentence accurately.",
    "instructions":"Keep meaning unchanged.",
    "sampleInput":"Good Morning",
    "expectedOutput":"सुप्रभात"
  }
]

Rules:

1. Return ONLY JSON.
2. No markdown.
3. No explanation.
4. No code block.
5. Every task should be different.
6. Make tasks realistic for AI dataset collection.
`;

        try {

            const response = await this.ai.models.generateContent({

                model: "gemini-2.5-flash",

                contents: prompt,

                config: {
                    responseMimeType: "application/json"
                }

            });

            const text = response.text;

            const parsed = this.extractJson(text);

            if (!parsed.length) {

                logger.warn("Gemini returned invalid JSON");

                return {

                    providerUsed: "mock",

                    tasks: this.generateMockTasks({
                        taskType,
                        description,
                        language,
                        country,
                        count
                    })

                };

            }

            return {

                providerUsed: "gemini",

                tasks: parsed
                    .map(task => this.normalizeTask(task, taskType))
                    .filter(Boolean)

            };

        }
        catch (err) {

            logger.error("Gemini Error: " + err.message);

            return {

                providerUsed: "mock",

                tasks: this.generateMockTasks({
                    taskType,
                    description,
                    language,
                    country,
                    count
                })

            };

        }

    }

    extractJson(text) {

        if (!text)
            return [];

        try {

            const parsed = JSON.parse(text);

            return Array.isArray(parsed)
                ? parsed
                : [];

        }
        catch {

            const start = text.indexOf("[");

            const end = text.lastIndexOf("]");

            if (start === -1 || end === -1)
                return [];

            try {

                return JSON.parse(text.substring(start, end + 1));

            }
            catch {

                return [];

            }

        }

    }

    normalizeTask(task, taskType) {

        if (!task)
            return null;

        if (!task.title)
            return null;

        return {

            title: String(task.title).trim(),

            description: String(task.description || "").trim(),

            instructions: String(task.instructions || "").trim(),

            sampleInput: String(task.sampleInput || "").trim(),

            expectedOutput: String(task.expectedOutput || "").trim(),

            type: taskType

        };

    }

    generateMockTasks({
        taskType,
        description,
        language,
        country,
        count
    }) {

        const tasks = [];

        for (let i = 1; i <= count; i++) {

            tasks.push({

                title: `${taskType} Dataset Task ${i}`,

                description: `${description}`,

                instructions: `Complete this ${taskType} dataset task in ${language} for ${country}.`,

                sampleInput: `Sample input ${i}`,

                expectedOutput: `Expected output ${i}`

            });

        }

        return tasks;

    }

}

module.exports = new AITaskService();



// const axios = require('axios');
// const logger = require('../utils/logger');

// class AITaskService {
//   async generateTasks({
//     taskType,
//     description,
//     language,
//     country,
//     count,
//   }) {
//     const normalizedCount = Math.min(Math.max(parseInt(count, 10) || 10, 1), 100);
//     const promptPayload = { taskType, description, language, country, count: normalizedCount };

//     if (process.env.OPENAI_API_KEY) {
//       try {
//         const aiTasks = await this.generateWithOpenAI(promptPayload);
//         if (aiTasks.length > 0) {
//           return {
//             providerUsed: 'openai',
//             tasks: aiTasks.slice(0, normalizedCount),
//           };
//         }
//       } catch (err) {
//         logger.warn(`OpenAI generation failed: ${err.message}`);
//       }
//     }

//     if (process.env.HUGGINGFACE_API_KEY) {
//       try {
//         console.log("HF MODEL:", process.env.HUGGINGFACE_MODEL);
//         const hfTasks = await this.generateWithHuggingFace(promptPayload);
//         if (hfTasks.length > 0) {
//           return {
//             providerUsed: 'huggingface',
//             tasks: hfTasks.slice(0, normalizedCount),
//           };
//         }
//       } catch (err) {
//         // logger.warn(`Hugging Face generation failed: ${err.response?.status || ''} ${err.message}`);
//         logger.error("HF FULL ERROR:", {
//           status: err.response?.status,
//           data: err.response?.data,
//           message: err.message,
//         });
//       }
//     }

//     return {
//       providerUsed: 'mock',
//       tasks: this.generateMockTasks(promptPayload),
//     };
//   }

//   async generateWithOpenAI({ taskType, description, language, country, count }) {
//     let OpenAI;
//     try {
//       OpenAI = require('openai');
//     } catch (err) {
//       return [];
//     }

//     const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
//     const prompt = [
//       'Generate dataset labeling tasks as strict JSON array only.',
//       `Type: ${taskType}`,
//       `Language: ${language}`,
//       `Country: ${country}`,
//       `Context: ${description}`,
//       `Count: ${count}`,
//       'Each object keys: title, description, instructions, sampleInput, expectedOutput',
//       'Do not include markdown, explanation, or trailing text.',
//     ].join('\n');

//     const response = await client.responses.create({
//       model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
//       input: prompt,
//       temperature: 0.6,
//     });

//     const text = response.output_text || '[]';
//     let parsed;
//     try {
//       parsed = JSON.parse(text);
//     } catch (err) {
//       return [];
//     }
//     if (!Array.isArray(parsed)) return [];
//     return parsed
//       .map((item) => this.normalizeTask(item, taskType))
//       .filter(Boolean);
//   }

//   async generateWithHuggingFace({ taskType, description, language, country, count }) {
//     const model = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';
//     const endpoints = [
//       `https://router.huggingface.co/hf-inference/models/${model}`,
//       `https://api-inference.huggingface.co/models/${model}`,
//     ];
//     const prompt = [
//       'Generate dataset labeling tasks as strict JSON array only.',
//       `Type: ${taskType}`,
//       `Language: ${language}`,
//       `Country: ${country}`,
//       `Context: ${description}`,
//       `Count: ${count}`,
//       'Each object keys: title, description, instructions, sampleInput, expectedOutput',
//       'Output only JSON array. No markdown and no explanations.',
//     ].join('\n');

//     const response = await this.callHuggingFaceWithFallback(endpoints, {
//       inputs: prompt,
//       parameters: {
//         max_new_tokens: 1800,
//         temperature: 0.6,
//         return_full_text: false,
//       },
//     });

//     const body = response.data;
//     let text = '';
//     if (Array.isArray(body) && body[0]?.generated_text) {
//       text = body[0].generated_text;
//     } else if (typeof body?.generated_text === 'string') {
//       text = body.generated_text;
//     } else if (typeof body === 'string') {
//       text = body;
//     } else {
//       text = JSON.stringify(body || '');
//     }

//     const parsed = this.extractJsonArray(text);
//     if (!Array.isArray(parsed)) return [];
//     return parsed
//       .map((item) => this.normalizeTask(item, taskType))
//       .filter(Boolean);
//   }

//   async callHuggingFaceWithFallback(endpoints, body) {
//     let lastErr = null;
//     for (const endpoint of endpoints) {
//       try {
//         return await this.callHuggingFace(endpoint, body);
//       } catch (err) {
//         lastErr = err;
//       }
//     }
//     throw lastErr || new Error('Hugging Face request failed');
//   }

//   async callHuggingFace(endpoint, body) {
//     const headers = {
//       Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
//       'Content-Type': 'application/json',
//     };

//     const request = async () => axios.post(endpoint, body, { headers, timeout: 90000 });
//     let response = await request();

//     // Some HF models return "loading" with an estimated wait time.
//     if (response?.data?.error && response?.data?.estimated_time) {
//       const waitMs = Math.min(Math.ceil(Number(response.data.estimated_time) * 1000), 15000);
//       await new Promise((resolve) => setTimeout(resolve, waitMs));
//       response = await request();
//     }

//     return response;
//   }

//   extractJsonArray(text) {
//     if (!text || typeof text !== 'string') return [];
//     try {
//       return JSON.parse(text);
//     } catch (err) {
//       const start = text.indexOf('[');
//       const end = text.lastIndexOf(']');
//       if (start === -1 || end === -1 || end <= start) return [];
//       const candidate = text.slice(start, end + 1);
//       try {
//         return JSON.parse(candidate);
//       } catch (parseErr) {
//         return [];
//       }
//     }
//   }

//   generateMockTasks({ taskType, description, language, country, count }) {
//     const tasks = [];
//     for (let i = 0; i < count; i += 1) {
//       const seq = i + 1;
//       tasks.push({
//         title: `${this.titlePrefix(taskType)} ${seq} (${language}, ${country})`,
//         description: `${description} - dataset sample ${seq}.`,
//         instructions: this.instructions(taskType, language, country),
//         sampleInput: this.sampleInput(taskType, language, seq),
//         expectedOutput: this.expectedOutput(taskType, language, seq),
//       });
//     }
//     return tasks;
//   }

//   normalizeTask(item, taskType) {
//     if (!item || typeof item !== 'object') return null;
//     if (!item.title || !item.description || !item.instructions) return null;
//     return {
//       title: String(item.title).trim().slice(0, 200),
//       description: String(item.description).trim(),
//       instructions: String(item.instructions).trim(),
//       sampleInput: String(item.sampleInput || ''),
//       expectedOutput: String(item.expectedOutput || ''),
//       type: taskType,
//     };
//   }

//   titlePrefix(taskType) {
//     if (taskType === 'audio') return 'Audio Collection Task';
//     if (taskType === 'image') return 'Image Annotation Task';
//     return 'Text Annotation Task';
//   }

//   instructions(taskType, language, country) {
//     if (taskType === 'audio') {
//       return `Record clear speech in ${language} with natural ${country} accent. Avoid background noise and clipping.`;
//     }
//     if (taskType === 'image') {
//       return `Review the image and label the requested entities in ${language} for ${country} locale conventions.`;
//     }
//     return `Read the input text and provide a clean, context-aware label/transform in ${language} for ${country}.`;
//   }

//   sampleInput(taskType, language, seq) {
//     if (taskType === 'audio') return `Prompt #${seq}: Please say this sentence in ${language}.`;
//     if (taskType === 'image') return `Image #${seq}: street scene with signboards and pedestrians.`;
//     return `Sentence #${seq}: "The weather is pleasant today."`;
//   }

//   expectedOutput(taskType, language, seq) {
//     if (taskType === 'audio') return `Audio file (${language}) with minimum 8s duration and low noise.`;
//     if (taskType === 'image') return `JSON labels for image #${seq} with class names and confidence values.`;
//     return `Structured ${language} output text for sentence #${seq} with correct formatting.`;
//   }
// }

// module.exports = new AITaskService();
