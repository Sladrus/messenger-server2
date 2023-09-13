var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var messageSchema = new Schema({
  message_id: {
    type: Number,
  },
  unread: { type: Boolean, required: true, default: true },
  from: {},
  chat: {},
  members: [],
  document: {},
  date: {
    type: Number,
    required: true,
  },
  photo: [],
  text: {
    type: String,
    required: false,
  },
  type: {
    type: String,
    required: true,
  },
});

const MessageModel = mongoose.model('message', messageSchema);

module.exports = { MessageModel };
