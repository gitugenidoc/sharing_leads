function getScopedAgentId(user, requestedAgentId) {
  if (user.role === "AGENT") {
    return user.id;
  }

  return requestedAgentId || undefined;
}

module.exports = {
  getScopedAgentId,
};
