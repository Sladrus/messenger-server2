require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { jwtMiddleware } = require('./middleware/jwtMiddleware');
const { registerHandlers } = require('./handlers');

const { default: mongoose } = require('mongoose');
const { registerBotHandlers } = require('./bot');
const registerTelegramHandlers = require('./telegram');
const fs = require('fs');
const path = require('path');
const router = require('./router');
const bodyParser = require('body-parser');

const app = express();
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
    allowedHeaders: ['Access-Control-Allow-Origin', 'Content-Type'],
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(express.static('photos'));
app.use('/api', router);

app.get('/photo/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'telegram', 'photos', filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Файл не найден');
  }
});

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
registerTelegramHandlers.initClient(io);

const onConnection = (socket) => {
  registerHandlers(io, socket);

  console.log(`User: ${socket.id} joined `);
  socket.on('disconnect', () => {
    console.log(`User: ${socket.id} disconnected`);
  });

  socket.on('connect_error', (error) => {
    console.log(error);
  });

  socket.on('error', (error) => {
    console.log(error);
  });
};

// io.listen(httpServer);
io.on('connection', onConnection);

mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Mongoose connected successfully'))
  .catch((error) => console.log(error));

httpServer.listen(process.env.PORT, () => {
  console.log(`Server ready. Port: 5005`);
});
