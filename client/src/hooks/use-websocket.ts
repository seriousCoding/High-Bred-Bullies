import * as React from "react";
import { useApiKeys } from "./use-api-keys";

type WebSocketStatus = "connecting" | "open" | "closed" | "error";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const { accessToken, isAuthenticated } = useApiKeys();
  const [status, setStatus] = React.useState<WebSocketStatus>("closed");
  const [messages, setMessages] = React.useState<any[]>([]);
  const socketRef = React.useRef<WebSocket | null>(null);
  const messageQueue = React.useRef<WebSocketMessage[]>([]);

  // Initialize WebSocket connection
  React.useEffect(() => {
    if (!isAuthenticated) return;

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
          if (isAuthenticated && !socketRef.current) {
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
  }, [isAuthenticated, accessToken]);

  // Function to send subscription messages
  const subscribe = React.useCallback((message: WebSocketMessage) => {
    if (!isAuthenticated) {
      console.warn("Cannot subscribe: Not authenticated with Coinbase");
      return;
    }

    // Add authentication to subscription message if needed
    if (message.type === "subscribe") {
      // Add OAuth token to subscription message
      message.access_token = accessToken || '';
    }

    // Send the message if socket is ready, otherwise queue it
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      messageQueue.current.push(message);
    }
  }, [isAuthenticated, accessToken]);

  // Clear messages, useful when changing subscriptions
  const clearMessages = React.useCallback(() => {
    setMessages([]);
  }, []);

  return {
    status,
    messages,
    subscribe,
    clearMessages,
  };
}
