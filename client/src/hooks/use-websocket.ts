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
  const isProcessingQueue = React.useRef<boolean>(false);
  
  // Process queue function reference to avoid dependency cycles
  const processQueueRef = React.useRef<() => void>();
  
  // Define the queue processing function
  processQueueRef.current = () => {
    if (isProcessingQueue.current || messageQueue.current.length === 0 || 
        !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    isProcessingQueue.current = true;
    const message = messageQueue.current.shift();
    
    try {
      if (message) {
        console.log(`Sending subscription for channel: ${message.channel || 'unknown'}`);
        socketRef.current.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
    
    // Rate limit to one message per second to avoid "rate limit exceeded" errors
    setTimeout(() => {
      isProcessingQueue.current = false;
      if (messageQueue.current.length > 0 && processQueueRef.current) {
        processQueueRef.current();
      }
    }, 1000);
  };

  // Initialize WebSocket connection
  React.useEffect(() => {
    // Allow WebSocket connection without authentication for public data channels
    // This enables getting market data without requiring an API key
    const connectWebSocket = () => {
      setStatus("connecting");
      
      // Connect to our server's WebSocket instead of directly to Coinbase
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established");
        setStatus("open");
        
        // Start processing queued messages with rate limiting
        if (messageQueue.current.length > 0 && !isProcessingQueue.current && processQueueRef.current) {
          // Add a small delay before starting to process the queue
          setTimeout(() => {
            if (processQueueRef.current) {
              processQueueRef.current();
            }
          }, 500);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle special error messages from Coinbase
          if (data.type === 'error') {
            console.warn('WebSocket error from Coinbase:', data.message);
            
            if (data.message === 'rate limit exceeded') {
              // Pause the queue processing and restart with longer delay on rate limit error
              isProcessingQueue.current = false;
              console.log('Rate limit exceeded. Adding longer delay to message queue.');
              
              setTimeout(() => {
                if (messageQueue.current.length > 0 && processQueueRef.current) {
                  processQueueRef.current();
                }
              }, 2000); // Longer delay on rate limit
              
              // Don't add rate limit errors to the message feed
              return;
            }
          }
          
          // Add to message feed for components to consume
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
        
        // Always attempt to reconnect after a delay
        // Public data channels should work even without authentication
        setTimeout(() => {
          if (!socketRef.current) {
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
  }, [isAuthenticated, apiKey, currentKeyId]); // No more circular dependencies
  
  // Function to send subscription messages with rate limiting
  const subscribe = React.useCallback((message: WebSocketMessage) => {
    // Allow public data channels (ticker, level2) to work without authentication
    const isPublicChannel = message.channel === 'ticker' || message.channel === 'level2' || message.channel === 'matches';
    
    // Only require authentication for user-specific data
    if (!isPublicChannel && !isAuthenticated) {
      console.warn(`Cannot subscribe to ${message.channel}: Not authenticated with Coinbase`);
      return;
    }

    // Skip user channel subscriptions until we resolve authentication issues
    if (message.channel === 'user') {
      console.log(`Skipping ${message.type} for user channel temporarily`);
      return;
    }

    // The authentication is handled by the server-side proxy
    // We don't need to add authentication details to the client-side messages
    // This prevents sensitive API keys from being exposed in the browser
    
    // Always queue messages for rate-limited processing
    messageQueue.current.push(message);
    
    // Start processing if not already doing so and socket is ready
    if (!isProcessingQueue.current && socketRef.current?.readyState === WebSocket.OPEN && processQueueRef.current) {
      // Use setTimeout to add a small delay before processing
      // This helps prevent rate limiting issues when multiple subscriptions are queued at once
      setTimeout(() => {
        if (processQueueRef.current) {
          processQueueRef.current();
        }
      }, 300);
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
