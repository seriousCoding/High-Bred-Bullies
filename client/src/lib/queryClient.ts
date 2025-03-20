import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Updated API request function with flexible options
export async function apiRequest(
  method: string,
  url: string,
  body?: any,
  options?: {
    headers?: Record<string, string>;
    token?: string | null;
    userId?: number | null;
  }
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options?.headers || {})
  };
  
  // Add content type for JSON if we have a body
  if (body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add token if provided
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  
  // Add userId header for API authentication
  if (options?.userId) {
    headers['x-user-id'] = options.userId.toString();
  } else {
    // Get a stored userId or default to 0 if not available
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      headers['x-user-id'] = storedUserId;
    }
  }
  
  // Prepare the fetch options
  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: 'include'
  };
  
  // Add body if provided
  if (body) {
    fetchOptions.body = typeof body === 'string' 
      ? body 
      : JSON.stringify(body);
  }
  
  // Make the request
  const res = await fetch(url, fetchOptions);
  
  // Check if the response is OK
  await throwIfResNotOk(res);
  
  // Return the response
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Include userId header for proper authentication
    const headers: Record<string, string> = {};
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      headers['x-user-id'] = storedUserId;
    }
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include", 
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
