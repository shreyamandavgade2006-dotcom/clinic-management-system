'use strict';

require('dotenv').config();

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 5000),

  /* ----------------------------- database ----------------------------- */
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_student_ms',
  // When Mongo is unreachable the API boots into an in-memory demo store so the
  // whole product can still be explored. Set to false to hard-fail instead.
  allowInMemoryFallback: bool(process.env.ALLOW_IN_MEMORY_FALLBACK, true),
  autoSeed: bool(process.env.AUTO_SEED, true),

  /* -------------------------------- auth ------------------------------ */
  jwtSecret: process.env.JWT_SECRET || 'ssms-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  teacherInviteCode: process.env.TEACHER_INVITE_CODE || 'TEACH2024',
  studentClassCode: process.env.STUDENT_CLASS_CODE || 'CLASS2024',

  /* ------------------------- AI (quiz generator) ---------------------- */
  // gemini | openai | auto (uses whichever key is present) | local
  aiProvider: (process.env.AI_PROVIDER || 'auto').toLowerCase(),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  aiTimeoutMs: int(process.env.AI_TIMEOUT_MS, 45000),

  /* ----------------------------- WhatsApp ----------------------------- */
  // console | twilio | meta
  whatsappProvider: (process.env.WHATSAPP_PROVIDER || 'console').toLowerCase(),
  attendanceThreshold: int(process.env.ATTENDANCE_THRESHOLD, 75),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
  },
  meta: {
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
    accessToken: process.env.META_ACCESS_TOKEN || '',
    apiVersion: process.env.META_API_VERSION || 'v21.0',
  },

  /* ------------------------------- misc ------------------------------- */
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  seedPasswordStudent: process.env.SEED_PASSWORD_STUDENT || 'Student@123',
  seedPasswordTeacher: process.env.SEED_PASSWORD_TEACHER || 'Teacher@123',
};

module.exports = env;
