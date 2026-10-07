'use strict';

const env = require('../config/env');
const WhatsAppLog = require('../models/WhatsAppLog');

/* ------------------------------------------------------------------ *
 * phone helpers
 * ------------------------------------------------------------------ */

/** Normalise an Indian/most-national numbers into E.164 (defaults to +91 for 10-digit input). */
function toE164(raw, defaultCountryCode = '+91') {
  if (!raw) return '';
  let value = String(raw).replace(/[\s()\-.]/g, '').replace(/^whatsapp:/i, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (value.startsWith('+')) return value;
  if (value.startsWith('0') && value.length > 10) return `${defaultCountryCode}${value.slice(1)}`;
  if (value.length === 10) return `${defaultCountryCode}${value}`;
  return `${defaultCountryCode}${value}`;
}

const maskPhone = (phone) => (phone ? `${phone.slice(0, 3)}••••${phone.slice(-4)}` : '');

/* ------------------------------------------------------------------ *
 * message templates
 * ------------------------------------------------------------------ */

const templates = {
  attendanceAlert({ studentName, className, percentage, threshold, subject, attended, total, teacherName, college }) {
    return (
      `⚠️ *${college || 'Smart Student Management System'} — Attendance Alert*\n\n` +
      `Dear Parent/Guardian,\n\n` +
      `This is to inform you that *${studentName}* (Class ${className}) has attendance of only *${percentage}%*` +
      (subject ? ` in *${subject}*` : '') +
      `, which is below the required *${threshold}%*.\n\n` +
      (attended !== undefined && total !== undefined ? `📊 Present: ${attended}/${total} sessions\n` : '') +
      `Please ensure regular attendance so that your ward does not face detention or lose exam eligibility.\n\n` +
      `— ${teacherName || 'Class Teacher'}`
    );
  },
  assignmentReminder({ studentName, title, subject, dueDate, college }) {
    return (
      `📝 *${college || 'SSMS'} — Assignment Reminder*\n\n` +
      `Hi ${studentName},\n\n` +
      `Your *${subject}* assignment *"${title}"* is due on *${new Date(dueDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}*.\n\nPlease submit it on time.`
    );
  },
  examReminder({ studentName, title, subject, date, startTime, room, college }) {
    return (
      `📅 *${college || 'SSMS'} — Exam Reminder*\n\n` +
      `Hi ${studentName},\n\n` +
      `*${title}* (${subject}) is scheduled on *${new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}* at *${startTime}*${room ? ` in ${room}` : ''}.\n\nAll the best!`
    );
  },
  announcement({ title, content, authorName, college }) {
    return `📢 *${college || 'SSMS'} — ${title}*\n\n${content}\n\n— ${authorName || 'Administration'}`;
  },
  result({ studentName, subject, percentage, grade, college }) {
    return `🎯 *${college || 'SSMS'} — Result Published*\n\n${studentName} scored *${percentage}%* (Grade ${grade}) in *${subject}*.`;
  },
  test({ college }) {
    return `✅ *${college || 'Smart Student Management System'}*\n\nThis is a test message. WhatsApp alerts are configured correctly.`;
  },
};

/* ------------------------------------------------------------------ *
 * providers
 * ------------------------------------------------------------------ */

const providers = {
  /** Simulated provider (default). Logs the message and stores it in the WhatsApp log. */
  async console({ to, body, toName, category, templateName, meta }) {
    console.log(
      `\n\x1b[36m📱 WhatsApp (simulated) → ${to}${toName ? ` (${toName})` : ''}\x1b[0m\n${body
        .split('\n')
        .map((line) => `   ${line}`)
        .join('\n')}\n`
    );
    return { status: 'simulated', providerMessageId: `sim-${Date.now()}`, meta: { ...meta, category, templateName } };
  },

  /** Twilio WhatsApp Business sender. */
  async twilio({ to, body }) {
    const { accountSid, authToken, from } = env.twilio;
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const form = new URLSearchParams({
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      Body: body,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Twilio error (${response.status})`);
    return { status: 'sent', providerMessageId: payload.sid, meta: payload };
  },

  /** Meta WhatsApp Cloud API. */
  async meta({ to, body, templateName, meta }) {
    const { phoneNumberId, accessToken, apiVersion } = env.meta;
    if (!phoneNumberId || !accessToken) {
      throw new Error('Meta WhatsApp credentials missing (META_PHONE_NUMBER_ID / META_ACCESS_TOKEN).');
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: String(to).replace('+', ''),
        type: 'text',
        text: { preview_url: false, body },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Meta WhatsApp error (${response.status})`);
    return {
      status: 'sent',
      providerMessageId: payload.messages?.[0]?.id || '',
      meta: { ...meta, templateName },
    };
  },
};

/* ------------------------------------------------------------------ *
 * public API
 * ------------------------------------------------------------------ */

/**
 * Sends a WhatsApp message and persists a log entry for the audit trail.
 * Never throws — returns a result object so batch jobs keep going.
 */
async function sendWhatsApp({
  to,
  body,
  toName = '',
  student = null,
  studentName = '',
  className = '',
  category = 'announcement',
  templateName = 'custom',
  attendancePercentAtAlert = null,
  meta = {},
} = {}) {
  const phone = toE164(to);
  const provider = env.whatsappProvider in providers ? env.whatsappProvider : 'console';

  const baseDoc = {
    student: student || null,
    studentName,
    className,
    to: phone || String(to || ''),
    toName,
    body,
    templateName,
    category,
    provider,
    attendancePercentAtAlert,
    meta,
  };

  if (!phone) {
    const failed = await WhatsAppLog.create({ ...baseDoc, status: 'failed', error: 'Missing/invalid phone number' });
    return { success: false, error: 'Missing/invalid phone number', log: failed };
  }

  try {
    const result = await providers[provider]({ to: phone, body, toName, category, templateName, meta });
    const log = await WhatsAppLog.create({
      ...baseDoc,
      status: result.status,
      providerMessageId: result.providerMessageId,
      sentAt: new Date(),
      meta: { ...meta, providerMeta: result.meta },
    });
    return { success: true, provider, status: result.status, messageId: result.providerMessageId, log };
  } catch (error) {
    const log = await WhatsAppLog.create({ ...baseDoc, status: 'failed', error: error.message, sentAt: new Date() });
    console.error(`\x1b[31m✖ WhatsApp send failed (${provider}) → ${phone}:\x1b[0m ${error.message}`);
    return { success: false, error: error.message, log };
  }
}

const sendTemplate = (templateName, payload) => {
  const template = templates[templateName];
  if (!template) throw new Error(`Unknown WhatsApp template: ${templateName}`);
  return sendWhatsApp({ ...payload, body: template(payload), templateName, category: payload.category || templateName });
};

module.exports = { sendWhatsApp, sendTemplate, templates, toE164, maskPhone, providers };
