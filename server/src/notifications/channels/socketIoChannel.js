const { buildTeacherClassRoom } = require('../../realtime/socketServer');

function getRoomReceiverCount(io, roomName) {
  const adapter = io?.sockets?.adapter || io?.of?.('/')?.adapter || null;
  const room = adapter?.rooms?.get(roomName);
  return room ? room.size : 0;
}

function createSocketIoChannel(io) {
  return {
    async sendToTeacherClass(classId, event) {
      if (!io || !classId || !event?.eventType) {
        return {
          provider: 'socket.io',
          status: 'skipped',
          reason: 'not_ready',
          receiverCount: 0
        };
      }

      const roomName = buildTeacherClassRoom(classId);
      const receiverCount = getRoomReceiverCount(io, roomName);

      if (receiverCount <= 0) {
        return {
          provider: 'socket.io',
          status: 'skipped',
          reason: 'no_receivers',
          classId,
          roomName,
          receiverCount: 0
        };
      }

      io.to(roomName).emit(event.eventType, event);
      return {
        provider: 'socket.io',
        status: 'sent',
        classId,
        roomName,
        receiverCount
      };
    }
  };
}

module.exports = {
  createSocketIoChannel
};
