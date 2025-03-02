from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
import uvicorn
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Video Chat API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*"  # Adjust in production
)

# Wrap with ASGI application
socket_app = socketio.ASGIApp(sio, app)

# Store user data in memory
email_to_socket_id = {}
socket_id_to_email = {}
rooms = {}

# Socket.IO event handlers
@sio.event
async def connect(sid, environ, auth):
    """Handle client connection"""
    logger.info(f"Socket Connected: {sid}")
    
@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    if sid in socket_id_to_email:
        email = socket_id_to_email[sid]
        del socket_id_to_email[sid]
        if email in email_to_socket_id:
            del email_to_socket_id[email]
        logger.info(f"Socket Disconnected: {sid}, Email: {email}")
    else:
        logger.info(f"Socket Disconnected: {sid}")

@sio.event
async def room_join(sid, data):
    """Handle room join request"""
    email = data.get('email')
    room = data.get('room')
    
    if not email or not room:
        await sio.emit('error', {'message': 'Email and room are required'}, room=sid)
        logger.error(f"Join attempt with missing email or room: {data}")
        return
    
    # Store mappings
    email_to_socket_id[email] = sid
    socket_id_to_email[sid] = email
    
    # Initialize room if it doesn't exist
    if room not in rooms:
        rooms[room] = set()
    
    # Add user to room
    rooms[room].add(sid)
    
    # Join socket.io room
    sio.enter_room(sid, room)
    
    # Notify others in the room
    await sio.emit('user:joined', {'email': email, 'id': sid}, room=room, skip_sid=sid)
    
    # Confirm to the user
    await sio.emit('room:join', data, room=sid)
    
    logger.info(f"User {email} (SID: {sid}) joined room {room}")

@sio.event
async def user_call(sid, data):
    """Handle call initiation"""
    to_sid = data.get('to')
    offer = data.get('offer')
    
    if not to_sid or not offer:
        await sio.emit('error', {'message': 'Target SID and offer are required'}, room=sid)
        return
    
    # Emit incoming call event to the target user
    await sio.emit('incomming:call', {'from': sid, 'offer': offer}, room=to_sid)
    logger.info(f"Call initiated from {sid} to {to_sid}")

@sio.event
async def call_accepted(sid, data):
    """Handle call acceptance"""
    to_sid = data.get('to')
    ans = data.get('ans')
    
    if not to_sid or not ans:
        await sio.emit('error', {'message': 'Target SID and answer are required'}, room=sid)
        return
    
    # Emit call accepted event to the caller
    await sio.emit('call:accepted', {'from': sid, 'ans': ans}, room=to_sid)
    logger.info(f"Call accepted by {sid}, notifying {to_sid}")

@sio.event
async def peer_nego_needed(sid, data):
    """Handle negotiation needed"""
    to_sid = data.get('to')
    offer = data.get('offer')
    
    if not to_sid or not offer:
        await sio.emit('error', {'message': 'Target SID and offer are required'}, room=sid)
        return
    
    # Emit negotiation needed event to the peer
    await sio.emit('peer:nego:needed', {'from': sid, 'offer': offer}, room=to_sid)
    logger.info(f"Negotiation needed from {sid} to {to_sid}")

@sio.event
async def peer_nego_done(sid, data):
    """Handle negotiation completion"""
    to_sid = data.get('to')
    ans = data.get('ans')
    
    if not to_sid or not ans:
        await sio.emit('error', {'message': 'Target SID and answer are required'}, room=sid)
        return
    
    # Emit negotiation final event to the peer
    await sio.emit('peer:nego:final', {'from': sid, 'ans': ans}, room=to_sid)
    logger.info(f"Negotiation completed by {sid}, notifying {to_sid}")

# FastAPI routes for health check
@app.get("/")
async def root():
    return {"status": "running", "service": "Video Chat API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Run the server
if __name__ == "__main__":
    uvicorn.run(
        "main:socket_app", 
        host="0.0.0.0", 
        port=8033, 
        reload=True,
        log_level="info"
    )