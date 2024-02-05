const { UserModel } = require('../models/userModel');
const tokenService = require('../service/tokenService');

module.exports = (io, socket) => {
  const login = async ({ username, password }) => {
    try {
      const user = await UserModel.findOne({ email: username });
      console.log(user)
      if (!user) throw new Error('Неверное имя пользователя или пароль');
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) throw new Error('Неверный пароль');
      const { accessToken, refreshToken } = await tokenService.generateToken(
        user
      );

      const userData = {
        id: user._id,
        username: user.username,
        email: user.email,
      };

      await tokenService.saveToken(user._id, refreshToken);

      return socket.emit('user', { user: userData, token: accessToken });
    } catch (e) {
      console.log(e);

      socket.emit('error', { message: e.message });
    }
  };

  const getUsers = async () => {
    try {
      const users = await UserModel.find().select('-password');

      return io.emit('users', { users });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  };
  socket.on('user:login', login);
  socket.on('user:get', getUsers);
};
