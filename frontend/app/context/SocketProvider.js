'use client';

import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Create Socket Context
const SocketContext = createContext(null);

// Custom hook to use the socket
export const useSocket = () => {
  const socket = useContext(SocketContext);
  // if (!socket) {
  //   throw new Error('useSocket must be used within a SocketProvider');
  // }
  return socket;
};

// Socket Provider Component
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create socket connection
    const socketInstance = io('http://localhost:8033', {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
    });

    // Set socket in state
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Context value
  const value = useMemo(() => socket, [socket]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};