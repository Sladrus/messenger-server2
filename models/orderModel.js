var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var orderSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  requisites: {
    type: String,
  },
  amount: {
    type: String,
  },
  from: { type: String },
  to: { type: String },
  regularity: { type: String },
  date: { type: String },
  comment: { type: String },
  conditions: { type: String },
  stage: { type: Schema.Types.ObjectId, ref: "order_statuses" },
  user: { type: Schema.Types.ObjectId, ref: "user" },
  responsible: { type: Schema.Types.ObjectId, ref: "user" },
  conversation: {
    type: Schema.Types.ObjectId,
    ref: "conversation",
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
    default:  Date.now(),
  },
  updatedAt: {
    type: Date,
    required: true,
    default:  Date.now(),
  },
});

const OrderModel = mongoose.model("order", orderSchema);

module.exports = { OrderModel };
