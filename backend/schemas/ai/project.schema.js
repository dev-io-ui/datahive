const { Type } = require('@google/genai');

const stringEnum = (values, description) => ({
  type: Type.STRING,
  format: 'enum',
  enum: values,
  description,
});

const projectGenerationSchema = {
  type: Type.OBJECT,
  required: ['project'],
  propertyOrdering: ['project', 'tasks'],
  properties: {
    project: {
      type: Type.OBJECT,
      required: ['name', 'description', 'client', 'dataset', 'status', 'budget', 'tags'],
      propertyOrdering: [
        'name',
        'description',
        'client',
        'dataset',
        'status',
        'budget',
        'color',
        'icon',
        'tags',
      ],
      properties: {
        name: { type: Type.STRING, description: 'Project name, max 200 characters.' },
        description: { type: Type.STRING, description: 'Detailed project description.' },
        client: {
          type: Type.OBJECT,
          required: ['name'],
          properties: {
            name: { type: Type.STRING },
            company: { type: Type.STRING },
            email: { type: Type.STRING },
            contractRef: { type: Type.STRING },
          },
        },
        dataset: {
          type: Type.OBJECT,
          required: ['language', 'languageLabel', 'country', 'countryLabel', 'domain', 'dataType', 'targetSize'],
          properties: {
            language: { type: Type.STRING, description: 'ISO 639-1 language code.' },
            languageLabel: { type: Type.STRING },
            country: { type: Type.STRING, description: 'ISO 3166-1 alpha-2 country code.' },
            countryLabel: { type: Type.STRING },
            dialect: { type: Type.STRING },
            domain: stringEnum(
              ['general', 'medical', 'legal', 'finance', 'agriculture', 'education', 'ecommerce', 'other'],
              'Dataset domain.'
            ),
            dataType: stringEnum(['speech', 'text', 'image', 'multimodal'], 'Dataset data type.'),
            targetSize: { type: Type.STRING },
          },
        },
        status: stringEnum(['active'], 'Generated projects should be active for immediate task creation.'),
        budget: {
          type: Type.OBJECT,
          required: ['total', 'allocated', 'spent'],
          properties: {
            total: { type: Type.NUMBER, minimum: 0 },
            allocated: { type: Type.NUMBER, minimum: 0 },
            spent: { type: Type.NUMBER, minimum: 0 },
          },
        },
        color: { type: Type.STRING, pattern: '^#[0-9A-Fa-f]{6}$' },
        icon: { type: Type.STRING },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          minItems: '1',
          maxItems: '8',
        },
      },
    },
    tasks: {
      type: Type.ARRAY,
      minItems: '3',
      maxItems: '6',
      items: {
        type: Type.OBJECT,
        required: ['title', 'description', 'type', 'instructions', 'pricePerTask', 'totalSlots', 'status'],
        propertyOrdering: [
          'title',
          'description',
          'type',
          'instructions',
          'sampleData',
          'pricePerTask',
          'totalSlots',
          'validationsRequired',
          'validatorRewardPercent',
          'status',
          'tags',
          'category',
          'difficulty',
          'estimatedMinutes',
        ],
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          type: stringEnum(['audio', 'text', 'image'], 'Task type.'),
          instructions: { type: Type.STRING },
          sampleData: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              fileUrl: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
          pricePerTask: { type: Type.NUMBER, minimum: 0.01 },
          totalSlots: { type: Type.INTEGER, minimum: 1 },
          validationsRequired: { type: Type.INTEGER, minimum: 1, maximum: 5 },
          validatorRewardPercent: { type: Type.NUMBER, minimum: 0, maximum: 100 },
          status: stringEnum(['active'], 'Generated tasks should be active.'),
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          category: { type: Type.STRING },
          difficulty: stringEnum(['easy', 'medium', 'hard'], 'Task difficulty.'),
          estimatedMinutes: { type: Type.INTEGER, minimum: 1 },
        },
      },
    },
  },
};

module.exports = { projectGenerationSchema };
