import * as React from "react";
import { useApiKeys } from "./use-api-keys";

type WebSocketStatus = "connecting" | "open" | "closed" | "error";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const apiKeysContext = useApiKeys();
  const isAuthenticated = apiKeysContext.isAuthenticated;
  const apiKey = apiKeysContext.apiKey;
  const currentKeyId = apiKeysContext.currentKey?.id;
  
  const [status, setStatus] = React.useState<WebSocketStatus>("closed");
  const [messages, setMessages] = React.useState<any[]>([]);
  const socketRef = React.useRef<WebSocket | null>(null);
  const messageQueue = React.useRef<WebSocketMessage[]>([]);

  // Initialize WebSocket connection
  React.useEffect(() => {
    if (!isAuthenticated || !apiKey) return;

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
          if (isAuthenticated && apiKey && !socketRef.current) {
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
  }, [isAuthenticated, apiKey, currentKeyId]);

  // Function to send subscription messages
  const subscribe = React.useCallback((message: WebSocketMessage) => {
    if (!isAuthenticated) {
      console.warn("Cannot subscribe: Not authenticated with Coinbase");
      return;
    }

    // The authentication is handled by the server-side proxy
    // We don't need to add authentication details to the client-side messages
    // This prevents sensitive API keys from being exposed in the browser
    
    // Send the message if socket is ready, otherwise queue it
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      messageQueue.current.push(message);
    }
  }, [isAuthenticated]);

  // Clear messages, useful when changing subscriptions
  const clearMessages = React.useCallback(() => {
    setMessages([]);
  }, []);

  return {
    status,
    messages,
    subscribe,
    clearMessages,
    isConnected: status === "open",
    isConnecting: status === "connecting",
    hasError: status === "error"
  };
}
