const { UserModel } = require('../models/userModel');
const tokenService = require('../service/tokenService');

module.exports = (io, socket) => {
  const login = async ({ username, password }) => {
    const session = await UserModel.startSession();
    session.startTransaction();
    try {
      const user = await UserModel.findOne({ email: username }).session(
        session
      );
      if (!user) throw new Error('Неверное имя пользователя или пароль');
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) throw new Error('Неверный пароль');
      const { accessToken, refreshToken } = await tokenService.generateToken(
        user
      );

      // Extract necessary information from the user object to avoid circular references
      const userData = {
        id: user._id,
        name: user.name,
        email: user.email,
        // Add any other required properties
      };

      await tokenService.saveToken(user._id, refreshToken);
      await session.commitTransaction();
      session.endSession();

      // Emit the event with the extracted user data
      return io.emit('user', { user: userData, token: accessToken });
    } catch (e) {
      console.log(e);
      await session.abortTransaction();
      session.endSession();
      socket.emit('error', { message: e.message });
    }
  };

  const getUsers = async () => {
    const session = await UserModel.startSession();
    session.startTransaction();
    try {
      const users = await UserModel.find().select('-password').session(session);
      await session.commitTransaction();
      session.endSession();
      return io.emit('users', { users });
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      socket.emit('error', { message: e.message });
    }
  };
  socket.on('user:login', login);
  socket.on('user:get', getUsers);
};
