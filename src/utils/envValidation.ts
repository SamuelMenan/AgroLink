/**
 * Environment validation utility for AgroLink
 * Validates that all required environment variables are properly configured
 */

export interface EnvConfig {
  VITE_BACKEND_URL: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

export function validateEnvironment(): EnvConfig {
  const config: EnvConfig = {
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL || '',
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    isProduction: import.meta.env.PROD,
    isDevelopment: import.meta.env.DEV
  };

  // Validate required environment variables
  const errors: string[] = [];

  if (!config.VITE_BACKEND_URL) {
    errors.push('VITE_BACKEND_URL is required but not set');
  } else if (!isValidUrl(config.VITE_BACKEND_URL)) {
    errors.push(`VITE_BACKEND_URL is not a valid URL: ${config.VITE_BACKEND_URL}`);
  }

  if (config.VITE_SUPABASE_URL && !isValidUrl(config.VITE_SUPABASE_URL)) {
    errors.push(`VITE_SUPABASE_URL is not a valid URL: ${config.VITE_SUPABASE_URL}`);
  }

  if (config.VITE_SUPABASE_ANON_KEY && !isValidJwt(config.VITE_SUPABASE_ANON_KEY)) {
    errors.push('VITE_SUPABASE_ANON_KEY does not appear to be a valid JWT token');
  }

  // Log environment status
  console.log('[Environment] Configuration status:', {
    environment: config.isProduction ? 'production' : 'development',
    backendUrl: config.VITE_BACKEND_URL,
    hasSupabase: !!(config.VITE_SUPABASE_URL && config.VITE_SUPABASE_ANON_KEY),
    origin: typeof window !== 'undefined' ? window.location.origin : 'server',
    timestamp: new Date().toISOString()
  });

  if (errors.length > 0) {
    console.error('[Environment] Validation errors:', errors);
    if (config.isProduction) {
      throw new Error(`Environment configuration errors: ${errors.join(', ')}`);
    }
  }

  return config;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidJwt(token: string): boolean {
  // Basic JWT validation - check format and decode header
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Try to decode header
    const header = JSON.parse(atob(parts[0]));
    return header && typeof header === 'object' && header.typ === 'JWT';
  } catch {
    return false;
  }
}

export function getMessagingConfig(config: EnvConfig) {
  return {
    baseUrl: config.VITE_BACKEND_URL,
    websocketUrl: config.VITE_BACKEND_URL.replace(/^http/, 'ws'),
    apiEndpoint: `${config.VITE_BACKEND_URL}/api`,
    timeout: config.isProduction ? 30000 : 10000,
    retryAttempts: config.isProduction ? 3 : 1
  };
}