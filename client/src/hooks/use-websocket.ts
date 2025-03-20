import { useState, useEffect, useCallback, useRef } from "react";
import { useApiKeys } from "./use-api-keys";

type WebSocketStatus = "connecting" | "open" | "closed" | "error";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const [status, setStatus] = useState<WebSocketStatus>("closed");
  const [messages, setMessages] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const messageQueue = useRef<WebSocketMessage[]>([]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!hasKeys) return;

    const connectWebSocket = () => {
      setStatus("connecting");
      
      // Connect to our server's WebSocket instead of directly to Coinbase
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established");
        setStatus("open");
        
        // Process any queued messages
        if (messageQueue.current.length > 0) {
          messageQueue.current.forEach(msg => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify(msg));
            }
          });
          messageQueue.current = [];
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prevMessages => {
            // Limit stored messages to prevent memory issues
            if (prevMessages.length > 100) {
              return [...prevMessages.slice(-99), data];
            }
            return [...prevMessages, data];
          });
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("error");
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setStatus("closed");
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (hasKeys && !socketRef.current) {
            connectWebSocket();
          }
        }, 5000);
      };
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [hasKeys, apiKey, apiSecret]);

  // Function to send subscription messages
  const subscribe = useCallback((message: WebSocketMessage) => {
    if (!hasKeys) {
      console.warn("Cannot subscribe: No API keys provided");
      return;
    }

    // Add authentication to subscription message if needed
    if (message.type === "subscribe") {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signMessage = timestamp + "GET" + "/ws";
      
      // Add authentication headers to be processed on the server side
      // The server will handle the actual signature calculation using the stored API keys
      message.api_key = apiKey || '';
      message.timestamp = timestamp;
      message.signature = "[signature_computed_on_server]";
    }

    // Send the message if socket is ready, otherwise queue it
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      messageQueue.current.push(message);
    }
  }, [hasKeys, apiKey, apiSecret]);

  // Clear messages, useful when changing subscriptions
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    status,
    messages,
    subscribe,
    clearMessages,
  };
}
