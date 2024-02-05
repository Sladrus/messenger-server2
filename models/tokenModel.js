var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var tokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  refreshToken: { type: String, required: true },
});

const TokenModel = mongoose.model('Token', tokenSchema);

// TokenModel.create({user: '65b9875bb6ab743105a7e6e0', })

module.exports = { TokenModel };
