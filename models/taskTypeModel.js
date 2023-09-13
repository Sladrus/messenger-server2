var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var taskTypeSchema = new Schema({
  title: { type: String, required: true, unique: true },
  task: { type: Schema.Types.ObjectId, ref: 'task' },
});

const TaskTypeModel = mongoose.model('task_type', taskTypeSchema);

module.exports = { TaskTypeModel };
