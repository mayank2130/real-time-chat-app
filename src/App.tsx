import { useEffect, useRef, useState } from "react";
import { Copy, SendHorizonal, AlertCircle, Users, MessageCircle } from "lucide-react";

const App = () => {
  const [name, setName] = useState("");
  const [messages, setMessages] = useState<{
    sender: string;
    text: string;
    timestamp: number;
  }[]>([]);
  const [roomCode, setRoomCode] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [participants, setParticipants] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const generateRandomCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }
    setRoomCode(code);
  };

  const copyToClipboard = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode)
        .then(() => alert('Room code copied!'))
        .catch((err) => {
          console.error("Failed to copy: ", err);
        });
    }
  };

  const connectToWebSocket = () => {
    // Validation
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim() || roomCode.length !== 6) {
      setError('Please enter a valid 6-character room code');
      return;
    }

    setError(null);
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket("wss://real-time-chat-backend-rho.vercel.app");

      ws.onopen = () => {
        const joinMessage = JSON.stringify({
          type: 'join',
          payload: {
            roomId: roomCode,
            userName: name.trim()
          }
        });
        ws.send(joinMessage);
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const parsedMessage = JSON.parse(event.data);

          switch (parsedMessage.type) {
            case 'room_joined':
              console.log('Successfully joined room');
              break;
            case 'user_list':
              setParticipants(parsedMessage.payload);
              break;
            case 'chat_message':
              setMessages(prev => [...prev, {
                sender: parsedMessage.payload.sender,
                text: parsedMessage.payload.text,
                timestamp: Date.now()
              }]);
              break;
            case 'error':
              setError(parsedMessage.payload.message);
              break;
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setConnectionStatus('disconnected');
        setError('Failed to connect to the room');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket connection error:', err);
      setError('Could not establish WebSocket connection');
      setConnectionStatus('disconnected');
    }
  };

  const sendMessage = () => {
    if (currentMessage.trim() && wsRef.current && connectionStatus === 'connected') {
      const chatMessage = JSON.stringify({
        type: 'chat_message',
        payload: {
          roomId: roomCode,
          sender: name,
          text: currentMessage.trim()
        }
      });
      
      wsRef.current.send(chatMessage);
      setCurrentMessage('');
    }
  };

  const leaveRoom = () => {
    if (wsRef.current) {
      const leaveMessage = JSON.stringify({
        type: 'leave',
        payload: {
          roomId: roomCode,
          userName: name
        }
      });
      wsRef.current.send(leaveMessage);
      wsRef.current.close();
      wsRef.current = null;
      setConnectionStatus('disconnected');
      setMessages([]);
      setParticipants([]);
    }
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Render logic based on connection status
  if (connectionStatus !== 'connected') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-md w-full max-w-2xl">
          <h1 className="text-3xl font-mono mb-2 flex items-center gap-2">
            <span className="text-xl">💬</span> Real Time Chat
          </h1>
          <p className="text-lg font-mono text-gray-400 mb-4">
            Temporary room that expires after all users exit
          </p>

          {error && (
            <div className="flex items-center text-red-500 bg-red-900/20 p-3 rounded-lg mb-4">
              <AlertCircle className="mr-2" />
              <span>{error}</span>
            </div>
          )}

          <button
            className="w-full bg-white text-black text-2xl py-3 px-4 rounded-lg font-mono mb-4 hover:bg-gray-200"
            onClick={generateRandomCode}
          >
            Create New Room
          </button>
          
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 mb-2 bg-black border-gray-700 border font-mono text-white rounded-lg focus:outline-none focus:ring focus:ring-blue-500"
          />
          
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              placeholder="Enter Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="flex-grow p-3 bg-black border-gray-700 border font-mono text-white rounded-lg focus:outline-none focus:ring focus:ring-blue-500"
              maxLength={6}
            />
            <button
              className="bg-white text-black py-2 px-10 rounded-lg font-mono text-lg hover:bg-gray-200"
              onClick={connectToWebSocket}
            >
              Join Room
            </button>
          </div>

          {roomCode && (
            <div className="mt-5 flex items-center justify-center bg-gray-800 p-4 rounded-lg">
              <span className="text-2xl font-mono tracking-widest">
                {roomCode}
              </span>
              <button
                onClick={copyToClipboard}
                className="ml-4 text-gray-600 transition-colors"
                aria-label="Copy to clipboard"
              >
                <Copy size={24} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Connected Chat Room UI
  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-md w-full max-w-4xl flex">
        {/* Sidebar */}
        <div className="w-1/4 border-r border-gray-700 pr-4">
          <div className="flex items-center mb-4">
            <Users className="mr-2" />
            <h2 className="text-xl font-mono">Participants</h2>
          </div>
          {participants.map((participant, index) => (
            <div 
              key={index} 
              className="p-2 bg-gray-800 rounded-lg mb-2 flex items-center"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              {participant}
            </div>
          ))}
          <button
            onClick={leaveRoom}
            className="w-full bg-red-500 text-white py-2 rounded-lg mt-4 hover:bg-red-600 transition"
          >
            Leave Room
          </button>
        </div>

        {/* Chat Area */}
        <div className="w-3/4 pl-4 flex flex-col">
          <div className="flex items-center mb-4">
            <MessageCircle className="mr-2" />
            <h1 className="text-2xl font-mono">Room: {roomCode}</h1>
          </div>
          
          <div className="flex-grow overflow-y-auto mb-4 pr-2" style={{ maxHeight: '60vh' }}>
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`mb-3 p-3 rounded-lg max-w-2xl ${
                  msg.sender === name 
                    ? 'bg-blue-800 self-end ml-auto' 
                    : 'bg-gray-800'
                }`}
              >
                <div className="font-bold text-sm text-gray-300">{msg.sender}</div>
                <div>{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="flex items-center">
            <input
              type="text"
              placeholder="Type a message..."
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-grow p-3 bg-black border-gray-700 border font-mono text-white rounded-lg focus:outline-none focus:ring focus:ring-blue-500 mr-2"
            />
            <button
              onClick={sendMessage}
              className="bg-white text-black p-3 rounded-lg hover:bg-gray-200"
            >
              <SendHorizonal />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;