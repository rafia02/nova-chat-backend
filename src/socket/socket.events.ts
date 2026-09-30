export const CLIENT_EVENTS = {
  JOIN: "conversation:join",
  LEAVE: "conversation:leave",

  MESSAGE_SEND: "message:send",

  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",

  MESSAGE_SEEN: "message:seen",

  CALL_START: "call:start",
  CALL_INITIATE: "call:initiate",
  CALL_ACCEPT: "call:accept",
  CALL_REJECT: "call:reject",
  CALL_END: "call:end",
  CALL_SIGNAL: "call:signal",
};

export const SERVER_EVENTS = {
  FRIEND_REQUEST_NEW: "friend-request:new",
  FRIEND_REQUEST_ACCEPTED: "friend-request:accepted",
  FRIEND_REQUEST_REJECTED: "friend-request:rejected",
  FRIEND_REMOVED: "friend:removed",
  MESSAGE_REQUEST_NEW: "message-request:new",
  MESSAGE_REQUEST_ACCEPTED: "message-request:accepted",
  MESSAGE_REQUEST_REJECTED: "message-request:rejected",
  GROUP_CREATED: "group:created",
  GROUP_UPDATED: "group:updated",
  GROUP_MEMBER_ADDED: "group:member-added",
  GROUP_MEMBER_REMOVED: "group:member-removed",

  MESSAGE_NEW: "message:new",
  MESSAGE_UPDATED: "message:updated",
  MESSAGE_DELETED: "message:deleted",
  MESSAGE_REACTION: "message:reaction",

  TYPING_UPDATE: "typing:update",

  USER_ONLINE: "user:online",
  USER_OFFLINE: "user:offline",

  MESSAGE_DELIVERED: "message:delivered",
  MESSAGE_SEEN: "message:seen",
  CALL_INCOMING: "call:incoming",
  CALL_ACCEPTED: "call:accepted",
  CALL_REJECTED: "call:rejected",
  CALL_ENDED: "call:ended",
  CALL_BUSY: "call:busy",
};
