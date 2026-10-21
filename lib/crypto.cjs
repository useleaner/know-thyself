// AES-256-GCM (base64 de iv‖tag‖cifra); ENCRYPTION_KEY = 32 bytes em base64, só no servidor.
const { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } = require('node:crypto');

function key(env = process.env) {
  const value = Buffer.from(env.ENCRYPTION_KEY || '', 'base64');
  if (value.length !== 32) throw new Error('encryption_not_configured');
  return value;
}

function encrypt(text, env) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(env), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function decrypt(payload, env) {
  const raw = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(env), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

// Identificadores (e-mail, conta Google) viram HMAC: dá para achar a conta sem guardar o valor.
function fingerprint(value, env) {
  const identityKey = Buffer.from(hkdfSync('sha256', key(env), Buffer.alloc(0), 'kt-identity', 32));
  return createHmac('sha256', identityKey).update(value).digest('base64url');
}

module.exports = { encrypt, decrypt, fingerprint };
