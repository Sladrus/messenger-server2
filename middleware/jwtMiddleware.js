const jwt = require('jsonwebtoken');
const { UserModel } = require('../models/userModel');

const jwtMiddleware = async (socket, next) => {
  const { token } = socket.handshake.auth;
  if (token) {
    try {
      const decoded = jwt.verify(token, 'secret');
      const user = await UserModel.findOne({ email: decoded.email });
      socket.emit('user', { user, token });
    } catch (error) {
      console.log(error);
      socket.emit('jwt_error', { message: 'Недействительный токен' });
    }
  } else {
    socket.emit('jwt_error', { message: 'Токен отсутствует' });
  }
  next();
};

module.exports = { jwtMiddleware };
