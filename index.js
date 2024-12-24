import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from 'ssh2';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: String(process.env.FRONTEND_URL),
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Client connected');
  let sshClient = null;

  socket.on('start-session', () => {
    sshClient = new Client();

    sshClient.on('ready', () => {
      sshClient.shell((err, stream) => {
        if (err) {
          socket.emit('error', err.message);
          return;
        }

        socket.emit('session-started');

        stream.on('data', (data) => {
          socket.emit('terminal-output', data.toString());
        });

        stream.on('close', () => {
          socket.emit('session-ended');
          sshClient.end();
        });

        socket.on('terminal-input', (data) => {
          stream.write(data);
        });
      });
    });

    sshClient.on('error', (err) => {
      socket.emit('error', err.message);
    });

    // Connect to EC2 instance
    sshClient.connect({
      host: process.env.EC2_HOST,
      port: 22,
      username: process.env.EC2_USERNAME,
      privateKey: process.env.EC2_PRIVATE_KEY
    });
  });

  socket.on('disconnect', () => {
    if (sshClient) {
      sshClient.end();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});