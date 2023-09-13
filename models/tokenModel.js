var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var tokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  refreshToken: { type: String, required: true },
});

const TokenModel = mongoose.model('Token', tokenSchema);

module.exports = { TokenModel };
