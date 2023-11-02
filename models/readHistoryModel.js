var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var readHistorySchema = new Schema({
  conversation: {
    type: Schema.Types.ObjectId,
    ref: 'conversation',
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
});

const ReadHistoryModel = mongoose.model('read_history', readHistorySchema);

module.exports = { ReadHistoryModel };
