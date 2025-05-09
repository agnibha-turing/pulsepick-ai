/**
 * API Configuration and utilities
 */
import { API_BASE_URL as ENV_API_BASE_URL } from '@/lib/env';

// Re-export the base URL
export const API_BASE_URL = ENV_API_BASE_URL;

// Standardized fetch with error handling
export async function apiFetch<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Handle HTTP errors
  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage;
    try {
      // Try to parse error as JSON
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.detail || errorJson.message || `API error: ${response.status}`;
    } catch {
      // Fallback to raw text if not JSON
      errorMessage = errorBody || `API error: ${response.status}`;
    }
    
    throw new Error(errorMessage);
  }
  
  // For 204 No Content
  if (response.status === 204) {
    return {} as T;
  }
  
  return response.json();
} 