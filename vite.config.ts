import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import { readConfig } from './server/config';

export function createViteConfig(env: NodeJS.ProcessEnv): UserConfig {
  const { port } = readConfig(env);
  const proxyTarget = `http://127.0.0.1:${port}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '^/api(?:/|$)': proxyTarget,
        '^/uploads(?:/|$)': proxyTarget,
      },
    },
  };
}

export default defineConfig(({ mode }) =>
  createViteConfig({
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  }),
);
