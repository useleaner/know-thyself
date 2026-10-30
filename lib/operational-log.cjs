// Só códigos fixos: nunca registrar requisição, conta, nascimento, token ou exceção original.
function logFailure(event, logger = console) {
  if (!['profiles_unavailable', 'notifications_unavailable', 'accounts_unavailable', 'account_delete_unavailable', 'users_unavailable'].includes(event)) return;
  logger.error(JSON.stringify({ type: 'kt.failure', event }));
}
module.exports = { logFailure };
