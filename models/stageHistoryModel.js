var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var stageHistorySchema = new Schema({
  stage: { type: Schema.Types.ObjectId, ref: 'stage' },
  conversation: {
    type: Schema.Types.ObjectId,
    ref: 'conversation',
  },
  createdAt: {
    type: Date,
    required: true,
  },
});

const StageHistoryModel = mongoose.model('stage_history', stageHistorySchema);

module.exports = { StageHistoryModel };
