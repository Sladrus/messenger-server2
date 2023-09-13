const { TagModel } = require('../models/tagModel');

module.exports = (io, socket) => {
  const getTags = async () => {
    try {
      const tags = await TagModel.find();
      return io.emit('tags:set', { tags });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  socket.on('tags:get', getTags);
};
