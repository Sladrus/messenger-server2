var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var stageSchema = new Schema({
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
  conversations: [
    {
      type: Schema.Types.ObjectId,
      ref: 'conversation',
    },
  ],
});

const StageModel = mongoose.model('stage', stageSchema);

const defaultStages = [
  {
    label: 'Свободные чаты',
    default: true,
    color: 'white',
    value: 'ready',
    position: 0,
  },
  {
    label: 'Необработанные чаты',
    default: true,
    color: 'dodgerblue',
    value: 'raw',
    position: 0,
  },
  {
    label: 'В работе',
    default: true,
    color: 'gold',
    value: 'work',
    position: 0,
  },
  {
    label: 'Активированные',
    default: true,
    color: 'limegreen',
    value: 'active',
    position: 0,
  },
  {
    label: 'Есть задача',
    default: true,
    color: 'brown',
    value: 'task',
    position: 0,
  },
];

StageModel.create(defaultStages).catch((e) => console.log(e));

module.exports = { StageModel };
