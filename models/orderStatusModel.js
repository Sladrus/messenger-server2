var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var orderStatusSchema = new Schema({
  label: {
    type: String,
    required: true,
  },
  default: { type: Boolean, required: true },
  color: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
    unique: true,
  },
  position: { type: Number, required: true, default: 0 },
});

const OrderStatusModel = mongoose.model("order_statuses", orderStatusSchema);

const defaultOrderStatuses = [
  {
    label: "Новые заявки",
    default: true,
    color: "dodgerblue",
    value: "new",
    position: 1,
  },
  {
    label: "В работе",
    default: true,
    color: "gold",
    value: "work",
    position: 2,
  },
  {
    label: "Ждет оплаты",
    default: true,
    color: "limegreen",
    value: "wait",
    position: 3,
  },
  {
    label: "Заявки в бухгалтерию",
    default: true,
    color: "limegreen",
    value: "ready",
    position: 4,
  },
  {
    label: "Заявка завершена",
    default: true,
    color: "green",
    value: "completed",
    position: 5,
  },
];

OrderStatusModel.create(defaultOrderStatuses).catch((e) => console.log(e));

module.exports = { OrderStatusModel };
