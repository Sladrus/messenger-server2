const { TaskTypeModel } = require('../models/taskTypeModel');

module.exports = (io, socket) => {
  const getTaskTypes = async () => {
    try {
      const types = await TaskTypeModel.find();

      return io.emit('taskTypes:set', { types });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const createTaskType = async ({ value }) => {
    console.log(value);
    try {
      const type = await TaskTypeModel.create({ title: value });
      return await getTaskTypes();
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  socket.on('taskTypes:get', getTaskTypes);
  socket.on('taskTypes:create', createTaskType);
};
