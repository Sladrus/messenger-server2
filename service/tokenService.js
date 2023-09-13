const { TokenModel } = require('../models/tokenModel');
const jwt = require('jsonwebtoken');

class TokenService {
  async generateToken(user) {
    const payload = { ...user.toObject() };

    const accessToken = jwt.sign(payload, 'secret', {
      expiresIn: '10d',
    });
    const refreshToken = jwt.sign(payload, 'secret', {
      expiresIn: '30d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async saveToken(userId, refreshToken) {
    const tokenData = await TokenModel.findOne({ user: userId });
    if (tokenData) {
      tokenData.refreshToken = refreshToken;
      return tokenData.save();
    }
    const token = await TokenModel.create({ user: userId, refreshToken });
    return token;
  }
}

module.exports = new TokenService();
