require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { jwtMiddleware } = require('./middleware/jwtMiddleware');
const { registerHandlers } = require('./handlers');

const { default: mongoose } = require('mongoose');
const { registerBotHandlers } = require('./telegram');

const app = express();
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
    allowedHeaders: ['Access-Control-Allow-Origin'],
    credentials: true,
  })
);
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
  path: '/socket',
  compress: true,
  pingInterval: 10000, // how often to ping/pong.
  pingTimeout: 30000, // time after which the connection is considered timed-out.
});

io.use(jwtMiddleware);

registerBotHandlers(io);

const onConnection = (socket) => {
  console.log('HRE');
  registerHandlers(io, socket);

  console.log(`User: ${socket.id} joined `);
  socket.on('disconnect', () => {
    console.log(`User: ${socket.id} disconnected`);
  });
};

io.on('connection', onConnection);

mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Mongoose connected successfully'))
  .catch((error) => console.log(error));

httpServer.listen(5005, () => {
  console.log(`Server ready. Port: 5005`);
});
