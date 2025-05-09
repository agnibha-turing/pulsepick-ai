/**
 * Environment configuration
 * This provides defaults for configuration values that would normally come from .env files
 */

// API base URL
export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  // Default to backend running on same host but port 8000 in development
  (window.location.protocol + '//' + window.location.hostname + ':8000');

// Update check interval in milliseconds (5 minutes)
export const UPDATE_CHECK_INTERVAL = 
  Number(import.meta.env.VITE_UPDATE_CHECK_INTERVAL) || 
  5 * 60 * 1000; 