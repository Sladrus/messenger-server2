var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var tagSchema = new Schema({
  value: { type: String, required: true },
  conversations: [
    {
      type: Schema.Types.ObjectId,
      ref: 'conversation',
    },
  ],
});

const TagModel = mongoose.model('tag', tagSchema);

module.exports = { TagModel };
