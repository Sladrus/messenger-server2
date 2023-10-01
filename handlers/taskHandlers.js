const { TaskModel } = require('../models/taskModel');

module.exports = (io, socket) => {
  const getTasks = async () => {
    try {
      const tasks = await TaskModel.find()
        .populate('conversation')
        .populate('type');
      return io.emit('tasks:set', { tasks });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };
  socket.on('tasks:get', getTasks);
};
