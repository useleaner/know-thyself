const { createHmac, randomInt, timingSafeEqual } = require('node:crypto');
const auth = require('./google-auth.cjs');

const CODE_COOKIE = 'kt_email';
const CODE_SECONDS = 10 * 60;
// ponytail: sem armazenamento não há contador de tentativas (o cookie pode ser reenviado); 8 dígitos tornam a força bruta
// inviável em 10 minutos. Com um KV, voltar a 6 dígitos com limite de 5 tentativas e limitar envios por e-mail.
const DIGITS = 8;

function emailConfiguration(env = process.env) {
  const { RESEND_API_KEY: apiKey, RESEND_FROM_EMAIL: from } = env;
  return typeof apiKey === 'string' && apiKey.trim() && typeof from === 'string' && from.includes('@') ? { apiKey: apiKey.trim(), from: from.trim() } : null;
}

function normalEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(email) ? email : null;
}

function digest(email, code, config) {
  return createHmac('sha256', config.secret).update(`email-code:${email}:${code}`).digest('base64url');
}

function newCode() {
  return String(randomInt(0, 10 ** DIGITS)).padStart(DIGITS, '0');
}

function pretty(code) {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

function startCookie(email, code, config) {
  return auth.cookie(CODE_COOKIE, auth.seal({ email, digest: digest(email, code, config) }, config, 'email', CODE_SECONDS), config, CODE_SECONDS);
}

// Devolve o e-mail confirmado, ou o motivo da recusa.
function verify(cookieHeader, input, config) {
  const pending = auth.open(auth.cookies(cookieHeader)[CODE_COOKIE], config, 'email');
  if (!pending || !normalEmail(pending.email) || typeof pending.digest !== 'string') return { error: 'expired' };
  const code = typeof input === 'string' ? input.replace(/\D/g, '') : '';
  if (code.length !== DIGITS) return { error: 'invalid_code' };
  const expected = Buffer.from(digest(pending.email, code, config));
  const received = Buffer.from(pending.digest);
  return expected.length === received.length && timingSafeEqual(expected, received) ? { email: pending.email } : { error: 'invalid_code' };
}

const EMAIL_COPY = {
  'pt-BR': { intro: 'Seu código para entrar no Know Thyself:', note: 'Ele vale por 10 minutos. Se não foi você, ignore este e-mail.', subject: 'Seu código' },
  en: { intro: 'Your code to sign in to Know Thyself:', note: 'It is valid for 10 minutes. If this wasn’t you, ignore this email.', subject: 'Your code' }
};

async function sendCode(email, code, emailConfig, lang = 'pt-BR') {
  const copy = Object.hasOwn(EMAIL_COPY, lang) ? EMAIL_COPY[lang] : EMAIL_COPY['pt-BR'];
  const text = `${copy.intro} ${pretty(code)}\n\n${copy.note}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.6"><p>${copy.intro}</p><p style="font-size:28px;letter-spacing:4px;font-weight:bold;margin:16px 0">${pretty(code)}</p><p style="color:#555">${copy.note}</p></div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${emailConfig.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: emailConfig.from, to: [email], subject: `${copy.subject}: ${pretty(code)}`, text, html }),
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('email_unavailable');
}

module.exports = { emailConfiguration, normalEmail, newCode, startCookie, verify, sendCode, CODE_COOKIE, DIGITS };
