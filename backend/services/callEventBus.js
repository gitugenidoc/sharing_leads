const { EventEmitter } = require("events");

const bus = new EventEmitter();
bus.setMaxListeners(200);

const channelForUser = (userId) => `user:${userId}`;

const publishCallEvent = (userId, payload) => {
  if (!userId) return;
  bus.emit(channelForUser(userId), payload);
};

const subscribeCallEvents = (userId, listener) => {
  const channel = channelForUser(userId);
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
};

module.exports = {
  publishCallEvent,
  subscribeCallEvents,
};
