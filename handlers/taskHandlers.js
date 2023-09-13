const { TaskModel } = require('../models/taskModel');
const { TaskTypeModel } = require('../models/taskTypeModel');

module.exports = (io, socket) => {
  //   const getTasks = async (filter) => {
  //     console.log(filter);
  //     const session = await TaskModel.startSession();
  //     session.startTransaction();
  //     try {
  //       const tags = await TagModel.find();
  //       await session.commitTransaction();
  //       session.endSession();
  //       return io.emit('tasks:set', { tags });
  //     } catch (e) {
  //       await session.abortTransaction();
  //       session.endSession();
  //       socket.emit('error', { message: e.message });
  //     }
  //   };
  //   socket.on('tasks:get', getTasks);
};
