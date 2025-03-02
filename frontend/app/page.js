'use client';

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "./context/SocketProvider";

export default function LobbyScreen() {
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const [socketReady, setSocketReady] = useState(false);

  const socket = useSocket();
  const router = useRouter();

  // Check if socket is ready
  useEffect(() => {
    if (socket && socket.connected) {
      setSocketReady(true);
      console.log("Socket ready to use:", socket.id);
    } else if (socket) {
      const onConnect = () => {
        console.log("Socket connected:", socket.id);
        setSocketReady(true);
      };
      
      socket.on('connect', onConnect);
      
      return () => {
        socket.off('connect', onConnect);
      };
    }
  }, [socket]);

  const handleSubmitForm = useCallback(
    (e) => {
      e.preventDefault();
      if (!socketReady) {
        console.error("Socket not ready yet");
        return;
      }
      
      console.log("Emitting room_join event:", { email, room });
      socket.emit("room_join", { email, room });
    },
    [email, room, socket, socketReady]
  );

  const handleJoinRoom = useCallback(
    (data) => {
      console.log("room:join event received:", data);
      const { room } = data;
      router.push(`/room/${room}`);
    },
    [router]
  );

  useEffect(() => {
    if (!socket) return;
    
    socket.on("room:join", handleJoinRoom);
    
    // Add error handler
    const handleError = (error) => {
      console.error("Socket error:", error);
    };
    socket.on("error", handleError);
    
    return () => {
      socket.off("room:join", handleJoinRoom);
      socket.off("error", handleError);
    };
  }, [socket, handleJoinRoom]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Lobby</h1>
      {!socketReady && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          Connecting to server...
        </div>
      )}
      <form onSubmit={handleSubmitForm} className="space-y-4">
        <div>
          <label htmlFor="email" className="block mb-1">Email ID</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="room" className="block mb-1">Room Number</label>
          <input
            type="text"
            id="room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button 
          type="submit" 
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          disabled={!socketReady}
        >
          Join
        </button>
      </form>
    </div>
  );
}