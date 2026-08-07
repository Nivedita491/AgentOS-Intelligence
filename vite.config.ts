import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    // Only run the frontend validation test suite. The Supabase Edge Function
    // tests under supabase/ are Deno tests run via `npm run test:rag`.
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['supabase/**', 'node_modules/**', 'dist/**'],
  },
});
