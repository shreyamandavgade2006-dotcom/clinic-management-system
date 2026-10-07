'use strict';

/**
 * AI Question & Assessment Generator
 * ----------------------------------
 * The ONLY place in the product where a generative model is used. It turns a teacher's
 * selection (subject → unit → topic → difficulty → question type → count → marks) into a
 * structured question paper / quiz / assessment.
 *
 * Providers:
 *   • gemini  — Google Gemini API          (GEMINI_API_KEY)
 *   • openai  — OpenAI Chat Completions    (OPENAI_API_KEY)
 *   • local   — deterministic built-in generator, always available (offline/demo fallback)
 *
 * If a remote provider is configured but fails, we fall back to `local` and flag it in the
 * response so the UI can tell the teacher what happened.
 */

const env = require('../config/env');

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const DIFFICULTY_GUIDE = {
  easy: 'recall and definition level (Bloom\'s Remember/Understand)',
  medium: 'application and understanding level (Bloom\'s Apply/Analyse)',
  hard: 'analysis, design and evaluation level (Bloom\'s Analyse/Evaluate/Create)',
  mixed: 'a balanced mix of easy (40%), medium (40%) and hard (20%) questions',
};

const TYPE_GUIDE = {
  mcq: 'multiple choice questions with exactly 4 options each',
  'true-false': 'true/false questions (options must be exactly "True" and "False")',
  'short-answer': 'short answer questions (2-3 lines expected answer)',
  'long-answer': 'long answer / descriptive questions (8-10 lines expected answer)',
  'fill-blank': 'fill in the blank questions (use ____ in the question text)',
  numerical: 'numerical problems requiring calculation',
  mixed: 'a mix of MCQ (50%), short answer (30%) and long answer (20%)',
};

const titleCase = (value) =>
  String(value || '')
    .split(/\s+/)
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');

const cleanText = (value) =>
  String(value || '')
    .replace(/^\s*[-*•\d.)]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseJsonLoosely = (raw) => {
  if (!raw) return null;
  let text = String(raw).trim();

  // strip markdown fences
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  const attempt = (candidate) => {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      return null;
    }
  };

  let parsed = attempt(text);
  if (parsed) return parsed;

  // extract the first {...} or [...] block
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    parsed = attempt(text.slice(objectStart, objectEnd + 1));
    if (parsed) return parsed;
  }
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    parsed = attempt(text.slice(arrayStart, arrayEnd + 1));
    if (parsed) return parsed;
  }

  // last resort: repair trailing commas
  const repaired = text.replace(/,\s*([}\]])/g, '$1');
  return attempt(repaired);
};

/* ------------------------------------------------------------------ *
 * prompt building
 * ------------------------------------------------------------------ */

function buildPrompt(request) {
  const {
    subject,
    subjectCode,
    unit,
    topics = [],
    difficulty = 'medium',
    questionType = 'mcq',
    count = 10,
    totalMarks = 20,
    paperType = 'quiz',
    className = '',
    language = 'English',
    extraInstructions = '',
    marksDistribution,
  } = request;

  return [
    `You are an experienced university professor of "${subject}"${subjectCode ? ` (${subjectCode})` : ''} writing an exam paper for class ${className || 'undergraduate students'}.`,
    '',
    '## Requirements',
    `- Subject: ${subject}${subjectCode ? ` (${subjectCode})` : ''}`,
    unit ? `- Unit / Chapter: ${unit}` : '',
    topics.length ? `- Topics: ${topics.join(', ')}` : '',
    `- Difficulty: ${difficulty} — ${DIFFICULTY_GUIDE[difficulty] || DIFFICULTY_GUIDE.medium}`,
    `- Question type: ${TYPE_GUIDE[questionType] || TYPE_GUIDE.mcq}`,
    `- Number of questions: exactly ${count}`,
    `- Total marks: ${totalMarks}. ${marksDistribution || 'Distribute the marks sensibly across the questions and make sure the individual marks add up to exactly the total.'}`,
    `- Paper type: ${paperType === 'question-paper' ? 'formal written exam paper' : paperType}`,
    `- Language: ${language}`,
    '',
    '## Rules',
    '1. Every question MUST be strictly based on the given unit/topics and nothing else.',
    '2. Each MCQ must have exactly 4 distinct, plausible options and exactly one unambiguous correct answer.',
    '3. "correctAnswer" must be the exact text of the correct option (for MCQ/true-false) or the model answer (for other types).',
    '4. Provide a one-line "explanation" telling why the answer is correct.',
    '5. Do not repeat or paraphrase the same question twice.',
    '6. Return ONLY valid JSON — no markdown, no commentary.',
    extraInstructions ? `7. Additional instruction from the teacher: ${extraInstructions}` : '',
    '',
    '## Output JSON schema',
    '```json',
    JSON.stringify(
      {
        title: 'string — a formal paper title',
        instructions: 'string — 3-4 instructions for students (duration, attempts, marking)',
        questions: [
          {
            questionText: 'string',
            type: questionType === 'mixed' ? 'mcq | short-answer | long-answer | true-false' : questionType,
            options: questionType === 'mcq' || questionType === 'true-false' ? ['option A', 'option B', 'option C', 'option D'] : [],
            correctAnswer: 'string',
            explanation: 'string',
            marks: 'number',
            difficulty: difficulty === 'mixed' ? 'easy | medium | hard' : difficulty,
            topic: 'string — the topic this question belongs to',
          },
        ],
      },
      null,
      2
    ),
    '```',
  ]
    .filter(Boolean)
    .join('\n');
}

/* ------------------------------------------------------------------ *
 * providers
 * ------------------------------------------------------------------ */

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Gemini API error (${response.status})`);

    const text = (payload.candidates?.[0]?.content?.parts || []).map((part) => part.text).join('\n');
    if (!text) throw new Error('Gemini returned an empty response.');
    return { text, model: env.geminiModel };
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiTimeoutMs);

  try {
    const response = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are an expert exam paper setter. You always answer with a single valid JSON object and nothing else.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `OpenAI API error (${response.status})`);

    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI returned an empty response.');
    return { text, model: env.openaiModel };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * local (offline) generator
 * ------------------------------------------------------------------ */

const LOCAL_STEMS = {
  easy: [
    'Define {topic} and state its primary purpose.',
    'List any two key characteristics of {topic}.',
    'Which of the following best describes {topic}?',
    'State whether the following statement about {topic} is true or false: {topic} is only used in legacy systems.',
    'Name the standard notation used to represent {topic}.',
  ],
  medium: [
    'Explain how {topic} works with a suitable example.',
    'Compare {topic} with the alternative approach studied in this unit.',
    'Which of the following statements about {topic} is correct?',
    'Describe the role of {topic} in the overall {subject} workflow.',
    'Illustrate, with a diagram or steps, the process of {topic}.',
  ],
  hard: [
    'Analyse the limitations of {topic} and suggest an improved approach.',
    'Design a scenario where {topic} would fail, and justify your answer.',
    'Evaluate the trade-offs involved in applying {topic} at scale.',
    'Which design decision related to {topic} most affects performance? Justify.',
    'Critically examine {topic} and propose two optimisation techniques.',
  ],
};

const localOptionPool = (topic) => [
  `${topic} is a standard technique used to achieve the stated objective`,
  `${topic} is deprecated and has no practical use`,
  `${topic} only works for small-scale systems`,
  `${topic} cannot be combined with other techniques`,
];

/**
 * Deterministic offline generator. Produces topic-aware questions that are always valid,
 * so the whole flow (generate → publish → attempt → auto-score) works without any API key.
 */
function generateLocally(request) {
  const {
    subject,
    unit,
    topics = [],
    difficulty = 'medium',
    questionType = 'mcq',
    count = 10,
    totalMarks = 20,
    paperType = 'quiz',
  } = request;

  const topicList = topics.length ? topics : [unit || subject];
  const effectiveDifficulty = difficulty === 'mixed' ? 'medium' : difficulty;
  const stems = LOCAL_STEMS[effectiveDifficulty] || LOCAL_STEMS.medium;

  // marks per question based on the question type, scaled so the total is close to requested
  const baseMarks = { mcq: 1, 'true-false': 1, 'fill-blank': 1, 'short-answer': 3, 'long-answer': 6, numerical: 4 };
  const perQuestion = (() => {
    const raw = totalMarks / Math.max(count, 1);
    if (questionType === 'mixed') return Math.max(1, Math.round(raw));
    return baseMarks[questionType] || Math.max(1, Math.round(raw));
  })();

  const questions = Array.from({ length: count }).map((_, index) => {
    const topic = topicList[index % topicList.length];
    const stem = stems[index % stems.length];
    const questionText = titleCase(stem.replace(/\{topic\}/g, topic).replace(/\{subject\}/g, subject));

    let type = questionType;
    if (questionType === 'mixed') {
      type = index % 5 === 4 ? 'long-answer' : index % 2 === 0 ? 'mcq' : 'short-answer';
    }

    const marks = type === 'long-answer' ? Math.max(perQuestion, 5) : type === 'short-answer' ? Math.max(perQuestion, 2) : perQuestion;

    if (type === 'mcq') {
      const correct = index % 4; // rotate the correct option so answers aren't predictable
      const raw = localOptionPool(topic);
      const options = [...raw.slice(0, 3)];
      options.splice(correct, 0, raw[3]);
      const finalOptions = [raw[correct] === raw[3] ? raw[3] : raw[correct], ...options.filter((_, i) => i !== 0)].slice(0, 4);
      // simpler & safer: build a 4-option list then rotate
      const pool = [
        `${topic} is a standard technique used to achieve the stated objective`,
        `${topic} is outdated and no longer required`,
        `${topic} applies only to trivial cases`,
        `${topic} is unrelated to this unit`,
      ];
      const correctOption = pool[0];
      const rotated = [pool[0], pool[1], pool[2], pool[3]];
      for (let i = rotated.length - 1; i > 0; i -= 1) {
        const j = (index + i) % rotated.length;
        [rotated[i], rotated[j]] = [rotated[j], rotated[i]];
      }
      void options;
      void finalOptions;
      return {
        questionText,
        type: 'mcq',
        options: rotated,
        correctAnswer: correctOption,
        explanation: `${topic} is defined and applied exactly as described in the first option; the other options contradict the unit syllabus.`,
        marks,
        difficulty: effectiveDifficulty,
        topic,
        unit: unit || '',
      };
    }

    if (type === 'true-false') {
      const isTrue = index % 2 === 0;
      return {
        questionText,
        type: 'true-false',
        options: ['True', 'False'],
        correctAnswer: isTrue ? 'True' : 'False',
        explanation: `Refer to the ${topic} section of ${unit || subject}.`,
        marks,
        difficulty: effectiveDifficulty,
        topic,
        unit: unit || '',
      };
    }

    if (type === 'fill-blank') {
      return {
        questionText: questionText.replace(/\b(is|are|defines|represents)\b/i, '____'),
        type: 'fill-blank',
        options: [],
        correctAnswer: topic,
        explanation: `The blank refers to ${topic}.`,
        marks,
        difficulty: effectiveDifficulty,
        topic,
        unit: unit || '',
      };
    }

    return {
      questionText,
      type,
      options: [],
      correctAnswer: `Model answer: explain ${topic} with definition, working, one example and its significance in ${subject}.`,
      explanation: `A complete answer covers the definition, working principle, example and significance of ${topic}.`,
      marks,
      difficulty: effectiveDifficulty,
      topic,
      unit: unit || '',
    };
  });

  const computedTotal = questions.reduce((sum, q) => sum + q.marks, 0);

  return {
    title: `${subject} — ${unit || topicList[0]} ${paperType === 'question-paper' ? 'Question Paper' : paperType === 'assessment' ? 'Assessment' : 'Quiz'}`,
    instructions:
      `Attempt all ${count} questions. Total marks: ${computedTotal}. ` +
      `Time: ${request.durationMinutes || Math.max(10, count * 2)} minutes. ` +
      `Questions are ${difficulty} level and cover ${topicList.slice(0, 4).join(', ')}.`,
    questions,
    totalMarks: computedTotal,
  };
}

/* ------------------------------------------------------------------ *
 * normalisation
 * ------------------------------------------------------------------ */

const normaliseQuestion = (raw, index, request) => {
  const type = ['mcq', 'true-false', 'short-answer', 'long-answer', 'fill-blank', 'numerical'].includes(raw.type)
    ? raw.type
    : request.questionType === 'mixed'
      ? 'mcq'
      : request.questionType;

  let options = Array.isArray(raw.options) ? raw.options.map((o) => cleanText(o)).filter(Boolean) : [];
  if (type === 'mcq' && options.length < 2) {
    // try "A) ..." style splits that some models return
    options = [];
  }
  if (type === 'true-false' && options.length !== 2) options = ['True', 'False'];

  const correctAnswer =
    raw.correctAnswer ??
    raw.answer ??
    raw.correct_option ??
    raw.correct ??
    '';

  return {
    questionText: cleanText(raw.questionText || raw.question || raw.text || `Question ${index + 1}`),
    type,
    options,
    correctAnswer: cleanText(Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer),
    expectedAnswer: cleanText(raw.expectedAnswer || raw.modelAnswer || ''),
    explanation: cleanText(raw.explanation || raw.reasoning || ''),
    marks: Math.max(1, Number(raw.marks) || 1),
    difficulty: ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : request.difficulty === 'mixed' ? 'medium' : request.difficulty,
    topic: cleanText(raw.topic || request.topics?.[index % Math.max(request.topics?.length || 1, 1)] || '') || request.topics?.[0] || '',
    unit: cleanText(raw.unit || request.unit || ''),
  };
};

const resolveProvider = () => {
  if (env.aiProvider === 'local') return 'local';
  if (env.aiProvider === 'gemini') return env.geminiApiKey ? 'gemini' : 'local';
  if (env.aiProvider === 'openai') return env.openaiApiKey ? 'openai' : 'local';
  if (env.geminiApiKey) return 'gemini';
  if (env.openaiApiKey) return 'openai';
  return 'local';
};

const providerStatus = () => {
  const active = resolveProvider();
  return {
    active,
    configured: {
      gemini: Boolean(env.geminiApiKey),
      openai: Boolean(env.openaiApiKey),
      local: true,
    },
    model: active === 'gemini' ? env.geminiModel : active === 'openai' ? env.openaiModel : 'built-in template generator',
    note:
      active === 'local'
        ? 'No AI API key configured — the offline generator is being used. Add GEMINI_API_KEY or OPENAI_API_KEY in server/.env for live AI generation.'
        : `Live generation through ${active}.`,
  };
};

/* ------------------------------------------------------------------ *
 * public API
 * ------------------------------------------------------------------ */

/**
 * Generates a quiz / assessment / question paper.
 * @returns {Promise<{title, instructions, questions, totalMarks, provider, model, prompt, fallback?}>}
 */
async function generateAssessment(request) {
  const requested = {
    subject: 'General',
    unit: '',
    topics: [],
    difficulty: 'medium',
    questionType: 'mcq',
    count: 10,
    totalMarks: 10,
    paperType: 'quiz',
    className: '',
    durationMinutes: 15,
    ...request,
  };

  const prompt = buildPrompt(requested);
  const provider = resolveProvider();

  if (provider === 'local') {
    const generated = generateLocally(requested);
    return {
      ...generated,
      questions: generated.questions.map((q, i) => normaliseQuestion(q, i, requested)),
      provider: 'local',
      model: 'built-in-template-generator',
      prompt,
    };
  }

  try {
    const { text, model } = provider === 'gemini' ? await callGemini(prompt) : await callOpenAI(prompt);
    const parsed = parseJsonLoosely(text);
    const rawQuestions = parsed?.questions || parsed?.data?.questions || (Array.isArray(parsed) ? parsed : null);

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      throw new Error('The AI response did not contain any questions.');
    }

    const questions = rawQuestions
      .slice(0, requested.count)
      .map((raw, index) => normaliseQuestion(raw, index, requested));

    const declaredTotal = Number(parsed.totalMarks) || 0;
    const computedTotal = questions.reduce((sum, q) => sum + q.marks, 0);

    return {
      title: cleanText(parsed.title) || `${requested.subject} — ${requested.unit || requested.topics[0] || 'Assessment'}`,
      instructions: cleanText(parsed.instructions) || `Attempt all ${questions.length} questions. Total marks: ${computedTotal}.`,
      questions,
      totalMarks: computedTotal,
      declaredTotal: declaredTotal || undefined,
      provider,
      model,
      prompt,
    };
  } catch (error) {
    console.warn(`\x1b[33m⚠ AI generation via ${provider} failed, using the offline generator:\x1b[0m ${error.message}`);
    const generated = generateLocally(requested);
    return {
      ...generated,
      questions: generated.questions.map((q, i) => normaliseQuestion(q, i, requested)),
      provider: 'local',
      model: 'built-in-template-generator',
      prompt,
      fallback: { from: provider, reason: error.message },
    };
  }
}

module.exports = { generateAssessment, buildPrompt, providerStatus, parseJsonLoosely, generateLocally };
