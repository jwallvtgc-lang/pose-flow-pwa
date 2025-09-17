// Public environment variables for client-side use
export const env = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY || '',
} as const;

// Type-safe environment variable access
export const getEnvVar = (key: keyof typeof env): string => {
  const value = env[key];
  if (!value) {
    console.warn(`Environment variable ${key} is not set`);
  }
  return value;
};