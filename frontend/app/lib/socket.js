import { io } from "socket.io-client";

// Create a singleton socket connection
let socket;

export const initSocket = () => {
  if (!socket) {
    socket = io("http://localhost:8033", {
      cors: true,
      transports: ['websocket']
    });
  }
  return socket;
};