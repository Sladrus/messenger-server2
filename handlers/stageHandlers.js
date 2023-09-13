const { StageModel } = require('../models/stageModel');
const { MessageModel } = require('../models/messageModel');
const { TagModel } = require('../models/tagModel');

module.exports = (io, socket) => {
  const getStages = async () => {
    try {
      const stages = await StageModel.find().sort({ position: 1 });

      return io.emit('stages:set', { stages });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  const createStage = async (stage) => {
    try {
      const maxPosition = await StageModel.find()
        .sort({ position: -1 })
        .limit(1);

      let newPosition = 0;
      if (maxPosition.length > 0) {
        newPosition = maxPosition[0].position + 1;
      }
      const newStage = { ...stage, position: newPosition, default: false };

      await StageModel.create(newStage);

      return await getStages();
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };

  socket.on('stages:get', getStages);
  socket.on('stage:create', createStage);
};
