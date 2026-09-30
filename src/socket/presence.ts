export const onlineUsers = new Map<string, Set<string>>();

export const addOnlineSocket = (userId: string, socketId: string) => {
  const sockets = onlineUsers.get(userId) ?? new Set<string>();
  sockets.add(socketId);
  onlineUsers.set(userId, sockets);
  return sockets.size === 1;
};

export const removeOnlineSocket = (userId: string, socketId: string) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size > 0) return false;
  onlineUsers.delete(userId);
  return true;
};
