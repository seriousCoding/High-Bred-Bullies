// API client for making authenticated requests to the backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  requireAuth?: boolean;
}

class ApiClient {
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      requireAuth = false
    } = options;

    const url = `${API_BASE_URL}${endpoint}`;
    const requestHeaders = {
      ...this.getAuthHeaders(),
      ...headers,
    };

    // Check if auth is required but no token is available
    if (requireAuth && !this.getAuthToken()) {
      throw new Error('Authentication required');
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return response.text() as any;
  }

  // Convenience methods
  async get<T = any>(endpoint: string, requireAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', requireAuth });
  }

  async post<T = any>(endpoint: string, data?: any, requireAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: data, requireAuth });
  }

  async put<T = any>(endpoint: string, data?: any, requireAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: data, requireAuth });
  }

  async delete<T = any>(endpoint: string, requireAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', requireAuth });
  }

  async patch<T = any>(endpoint: string, data?: any, requireAuth = false): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: data, requireAuth });
  }
}

export const apiClient = new ApiClient();