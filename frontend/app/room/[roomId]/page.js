'use client';

import React, { useEffect, useCallback, useState } from "react";
import dynamic from 'next/dynamic';
import { useSocket } from "../../context/SocketProvider";
import peerService from "../../lib/peer";

// Import ReactPlayer dynamically to avoid SSR issues
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

// Component for controlling the stream (mute/unmute mic and turn on/off video)
function StreamControls({ stream }) {
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMicEnabled((prev) => !prev);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled((prev) => !prev);
    }
  };

  return (
    <div className="stream-controls text-center my-4">
      <button 
        onClick={toggleMic} 
        className="bg-gray-700 text-white px-4 py-2 rounded mr-2 hover:bg-gray-800"
      >
        {micEnabled ? "Mute Mic" : "Unmute Mic"}
      </button>
      <button 
        onClick={toggleVideo} 
        className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
      >
        {videoEnabled ? "Turn Off Video" : "Turn On Video"}
      </button>
    </div>
  );
}

export default function RoomPage() {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [connectionStatus, setConnectionStatus] = useState("Connecting to room...");

  // Check socket connection
  useEffect(() => {
    if (!socket) {
      setConnectionStatus("Socket not connected. Refresh the page.");
      return;
    }

    if (socket.connected) {
      setConnectionStatus("Connected to server. Waiting for other users...");
    } else {
      setConnectionStatus("Reconnecting to server...");
      const onConnect = () => {
        setConnectionStatus("Connected to server. Waiting for other users...");
      };
      socket.on('connect', onConnect);
      return () => {
        socket.off('connect', onConnect);
      };
    }
  }, [socket]);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room with ID: ${id}`);
    setRemoteSocketId(id);
    setConnectionStatus(`${email} joined the room`);
  }, []);

  const handleCallUser = useCallback(async () => {
    try {
      setConnectionStatus("Initiating call...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      const offer = await peerService.getOffer();
      console.log("Sending call to:", remoteSocketId, "with offer:", offer);
      socket.emit("user_call", { to: remoteSocketId, offer });
      setMyStream(stream);
      setConnectionStatus("Call initiated. Waiting for answer...");
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setConnectionStatus(`Error: ${error.message}`);
    }
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      try {
        console.log(`Incoming Call from: ${from}`, offer);
        setConnectionStatus("Incoming call. Getting media...");
        setRemoteSocketId(from);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);
        const ans = await peerService.getAnswer(offer);
        console.log("Sending answer:", ans);
        socket.emit("call_accepted", { to: from, ans });
        setConnectionStatus("Call answered. Establishing connection...");
      } catch (error) {
        console.error("Error handling incoming call:", error);
        setConnectionStatus(`Error: ${error.message}`);
      }
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (!myStream) {
      setConnectionStatus("No local stream to send");
      return;
    }
    
    try {
      setConnectionStatus("Sending stream...");
      for (const track of myStream.getTracks()) {
        peerService.peer.addTrack(track, myStream);
      }
      setConnectionStatus("Stream sent");
    } catch (error) {
      console.error("Error sending stream:", error);
      setConnectionStatus(`Error sending stream: ${error.message}`);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      try {
        console.log("Call Accepted! Setting remote description:", ans);
        peerService.setLocalDescription(ans);
        setConnectionStatus("Call connected! Sending stream...");
        sendStreams();
      } catch (error) {
        console.error("Error in call acceptance:", error);
        setConnectionStatus(`Error: ${error.message}`);
      }
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    try {
      console.log("Negotiation needed");
      const offer = await peerService.getOffer();
      socket.emit("peer_nego_needed", { offer, to: remoteSocketId });
    } catch (error) {
      console.error("Negotiation error:", error);
    }
  }, [remoteSocketId, socket]);

  useEffect(() => {
    if (peerService.peer) {
      peerService.peer.addEventListener("negotiationneeded", handleNegoNeeded);
      return () => {
        peerService.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
      };
    }
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      try {
        console.log("Incoming negotiation from:", from);
        const ans = await peerService.getAnswer(offer);
        socket.emit("peer_nego_done", { to: from, ans });
      } catch (error) {
        console.error("Error handling negotiation:", error);
      }
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    try {
      console.log("Final negotiation step:", ans);
      await peerService.setLocalDescription(ans);
    } catch (error) {
      console.error("Error in final negotiation:", error);
    }
  }, []);

  useEffect(() => {
    if (peerService.peer) {
      const handleTrack = (ev) => {
        console.log("GOT REMOTE TRACKS!!", ev);
        const remoteStream = ev.streams;
        if (remoteStream && remoteStream[0]) {
          setRemoteStream(remoteStream[0]);
          setConnectionStatus("Remote stream connected");
        }
      };
      
      peerService.peer.addEventListener("track", handleTrack);
      
      return () => {
        peerService.peer.removeEventListener("track", handleTrack);
      };
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    console.log("Setting up socket event listeners");
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    
    // Add error handler
    const handleError = (error) => {
      console.error("Socket error:", error);
      setConnectionStatus(`Error: ${error.message}`);
    };
    socket.on("error", handleError);

    return () => {
      console.log("Cleaning up socket event listeners");
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("error", handleError);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Video Chat Room</h1>
      
      <div className="bg-gray-100 p-3 rounded mb-4">
        <p className="font-medium">{connectionStatus}</p>
        {remoteSocketId && <p className="text-green-600">Connected with user: {remoteSocketId}</p>}
      </div>
      
      <div className="space-x-2 mb-4">
        {myStream && remoteSocketId && (
          <button 
            onClick={sendStreams} 
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Send Stream
          </button>
        )}
        
        {remoteSocketId && !myStream && (
          <button 
            onClick={handleCallUser} 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Start Call
          </button>
        )}
      </div>

      {/* Render stream controls if a local stream is available */}
      {myStream && <StreamControls stream={myStream} />}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myStream && (
          <div>
            <h2 className="text-xl font-semibold mb-2">My Stream</h2>
            <div className="bg-gray-100 p-2 rounded">
              <ReactPlayer
                playing
                muted
                height="200px"
                width="100%"
                url={myStream}
              />
            </div>
          </div>
        )}
        
        {remoteStream && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Remote Stream</h2>
            <div className="bg-gray-100 p-2 rounded">
              <ReactPlayer
                playing
                height="200px"
                width="100%"
                url={remoteStream}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
