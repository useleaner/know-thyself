const auth = require('./google-auth.cjs');

function isAdmin(user, env = process.env) {
  const emails = (env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase());
  return Boolean(user && emails.length && emails.every(value => /^[^\s@,;]+@[^\s@,;]+$/.test(value)) && emails.includes(user.email.toLowerCase()));
}

function administrator(cookie, env = process.env) {
  const user = auth.authorizedSession(cookie, auth.configuration(env));
  return isAdmin(user, env) ? user : null;
}

module.exports = { isAdmin, administrator };
