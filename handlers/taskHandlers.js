const { TaskModel } = require("../models/taskModel");

module.exports = (io, socket) => {
  const getTasks = async () => {
    try {
      const tasks = await TaskModel.find()
        .populate("conversation")
        .populate("type")
        .sort({ _id: -1 }) // Сортировка по ID в порядке убывания, чтобы получить последние задачи
        .limit(100); // Ограничение количества задач до 100
      return io.emit("tasks:set", { tasks });
    } catch (e) {
      socket.emit("error", { message: e.message });
    }
  };
  socket.on("tasks:get", getTasks);
};
