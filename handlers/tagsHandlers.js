const { TagModel } = require('../models/tagModel');

module.exports = (io, socket) => {
  const getTags = async () => {
    const session = await TagModel.startSession();
    session.startTransaction();
    try {
      const tags = await TagModel.find().session(session);
      await session.commitTransaction();
      session.endSession();
      return io.emit('tags:set', { tags });
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      socket.emit('error', { message: e.message });
    }
  };

  socket.on('tags:get', getTags);
};
