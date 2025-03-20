import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Updated API request function with flexible options
export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: string | object;
    headers?: Record<string, string>;
    token?: string | null;
  }
): Promise<any> {
  const headers: Record<string, string> = {
    ...(options?.headers || {})
  };
  
  // Add content type for JSON if we have a body
  if (options?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add token if provided
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  
  // Prepare the fetch options
  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers,
    credentials: 'include'
  };
  
  // Add body if provided
  if (options?.body) {
    fetchOptions.body = typeof options.body === 'string' 
      ? options.body 
      : JSON.stringify(options.body);
  }
  
  // Make the request
  const res = await fetch(url, fetchOptions);
  
  // Check if the response is OK
  await throwIfResNotOk(res);
  
  // Try to parse as JSON if possible
  try {
    return await res.json();
  } catch (e) {
    // Return the response object if not JSON
    return res;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
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
