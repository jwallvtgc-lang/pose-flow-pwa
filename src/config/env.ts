// Public environment variables for client-side use
export const env = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://xdurzrndnpxhdrbtqqnz.supabase.co',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdXJ6cm5kbnB4aGRyYnRxcW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNzQ0MjMsImV4cCI6MjA3MzY1MDQyM30.ammqHLKHJjY3ynwgbuV0M9Q8jEKwcXELoWi8rMnkPxI',
  VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY || 'phc_BixHVyV1mfTIN1iXZyZOPALco4AYFIEtd64dRRcGU5d',
  VITE_STORAGE_CDN_URL: import.meta.env.VITE_STORAGE_CDN_URL || 'https://pub-9ef9df99591949568cbe742c3e82d503.r2.dev',
} as const;

// Type-safe environment variable access
export const getEnvVar = (key: keyof typeof env): string => {
  const value = env[key];
  if (!value) {
    console.warn(`Environment variable ${key} is not set`);
  }
  return value;
};