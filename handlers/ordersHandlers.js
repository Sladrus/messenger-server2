const { StageModel } = require("../models/stageModel");
const { MessageModel } = require("../models/messageModel");
const { TagModel } = require("../models/tagModel");
const { OrderStatusModel } = require("../models/orderStatusModel");
const { OrderModel } = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

module.exports = (io, socket) => {
  const findOneOrder = async (id) => {
    const order = await OrderModel.findOne({ _id: new ObjectId(id) }).populate([
      "conversation",
      "user",
      "stage",
      "responsible",
    ]);
    return io.emit("order:update", { order });
  };

  const getOrderStages = async () => {
    try {
      const stages = await OrderStatusModel.find().sort({ position: 1 });
      const orders = await OrderModel.find().populate([
        "stage",
        "conversation",
        "user",
        "responsible",
      ]);
      console.log(orders);
      return io.emit("orders:set", { stages, orders });
    } catch (e) {
      socket.emit("error", { message: e.message });
    }
  };

  const createOrderStage = async (stage) => {
    try {
      const maxPosition = await OrderStatusModel.find()
        .sort({ position: -1 })
        .limit(1);

      let newPosition = 0;
      if (maxPosition.length > 0) {
        newPosition = maxPosition[0].position + 1;
      }
      const newStage = { ...stage, position: newPosition, default: false };

      await OrderStatusModel.create(newStage);

      return await getOrderStages();
    } catch (e) {
      socket.emit("error", { message: e.message });
    }
  };

  const moveStage = async ({ id, position }) => {
    try {
      const totalRecords = await OrderStatusModel.count();

      if (position < 0 || position >= totalRecords) {
        throw new Error("Неверная позиция");
      }
      const recordToMove = await OrderStatusModel.findOne({
        _id: new ObjectId(id),
      });
      if (!recordToMove) {
        throw new Error("Такой записи не существует");
      }
      const currentPosition = recordToMove.position;
      await OrderStatusModel.updateOne(
        { position },
        { $set: { position: currentPosition } }
      );
      recordToMove.position = position;
      await recordToMove.save();

      const stages = await OrderStatusModel.find().sort({ position: 1 });
      const orders = await OrderModel.find().populate([
        "stage",
        "conversation",
        "user",
      ]);

      return io.emit("orders:set", { stages, orders });
    } catch (e) {
      console.log(e);
      socket.emit("error", { message: e.message });
    }
  };

  const updateStage = async ({ id, stageId }) => {
    try {
      await OrderModel.updateOne(
        {
          _id: new ObjectId(id),
        },
        { $set: { stage: new ObjectId(stageId), updatedAt: new Date() } }
      );
      return await findOneOrder(id);
    } catch (e) {
      console.log(e);
      socket.emit("error", { message: e.message });
    }
  };

  const updateUser = async ({ id, userId }) => {
    console.log(id, userId);

    try {
      await OrderModel.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            responsible: userId ? new ObjectId(userId) : null,
            updatedAt: new Date(),
          },
        }
      );

      return await findOneOrder(id);
    } catch (e) {
      console.log(e);
      socket.emit("error", { message: e.message });
    }
  };

  socket.on("orders:get", getOrderStages);
  socket.on("orders:createStatus", createOrderStage);
  socket.on("orders:moveStage", moveStage);
  socket.on("order:updateStage", updateStage);
  socket.on("order:updateUser", updateUser);
};
