var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var taskSchema = new Schema({
  text: { type: String, required: true },
  result: { type: String },
  conversation: {
    type: Schema.Types.ObjectId,
    ref: 'conversation',
  },
  type: { type: Schema.Types.ObjectId, ref: 'task_type' },
  done: { type: Boolean, default: false },
  createdAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
});

const TaskModel = mongoose.model('task', taskSchema);

module.exports = { TaskModel };
