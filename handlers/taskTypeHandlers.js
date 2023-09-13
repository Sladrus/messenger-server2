const { TaskTypeModel } = require('../models/taskTypeModel');

module.exports = (io, socket) => {
  const getTaskTypes = async () => {
    const session = await TaskTypeModel.startSession();
    session.startTransaction();
    try {
      const types = await TaskTypeModel.find();
      await session.commitTransaction();
      session.endSession();
      return io.emit('taskTypes:set', { types });
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      socket.emit('error', { message: e.message });
    }
  };

  const createTaskType = async ({ id, value }) => {
    const session = await TaskTypeModel.startSession();
    session.startTransaction();
    console.log(value);
    try {
      const type = await TaskTypeModel.create({ title: value });
      await session.commitTransaction();
      session.endSession();
      return await getTaskTypes();
    } catch (e) {
      console.log(e);
      await session.abortTransaction();
      session.endSession();
      socket.emit('error', { message: e.message });
    }
  };

  socket.on('taskTypes:get', getTaskTypes);
  socket.on('taskTypes:create', createTaskType);
};
