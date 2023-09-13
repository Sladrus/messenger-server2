var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var conversationSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  chat_id: {
    type: Number,
    required: true,
  },
  unreadCount: {
    type: Number,
    required: true,
    default: 0,
  },
  user: { type: Schema.Types.ObjectId, ref: 'user' },
  messages: [{ type: Schema.Types.ObjectId, ref: 'message' }],
  stage: { type: Schema.Types.ObjectId, ref: 'stage' },
  members: [],
  tasks: [{ type: Schema.Types.ObjectId, ref: 'task' }],
  tags: [{ type: Schema.Types.ObjectId, ref: 'tag' }],
  link: { type: String },
  workAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  updatedAt: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
  },
});

const ConversationModel = mongoose.model('conversation', conversationSchema);

module.exports = { ConversationModel };
