const buildProjectPrompt = ({ idea, includeTasks = false }) => `
You are an expert dataset operations planner for DataHive.

Create one production-ready AI dataset collection project from the admin idea.

Admin idea:
${idea}

Return a JSON object with:
- project: fields that match the existing Project model only.
${includeTasks ? '- tasks: 3 to 6 realistic Task model drafts linked conceptually to the project.' : '- Do not include tasks.'}

Project rules:
- Use status "active" so tasks can be created immediately.
- Use dataset.language as an ISO 639-1 code.
- Use dataset.country as an ISO 3166-1 alpha-2 code.
- Use dataset.domain from: general, medical, legal, finance, agriculture, education, ecommerce, other.
- Use dataset.dataType from: speech, text, image, multimodal.
- Include realistic budget.total and budget.allocated.
- Do not include createdBy, taskCount, submissionCount, acceptedCount, _id, or timestamps.

Task rules:
${includeTasks ? `
- Use type from: audio, text, image.
- Include title, description, instructions, pricePerTask, totalSlots.
- Use status "active".
- Make tasks directly useful for collecting or labeling the requested dataset.
- Do not include project, createdBy, assignedCount, completedCount, _id, or timestamps.
` : '- Skip task generation for this request.'}

Return JSON only.`;

module.exports = { buildProjectPrompt };
