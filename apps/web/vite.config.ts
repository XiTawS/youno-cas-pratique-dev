import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Alias résolus côté Vite + côté TypeScript (paths dans tsconfig).
// Doivent rester synchrones entre les deux.
export default defineConfig(({ mode }) => {
  // Charge .env depuis la racine du monorepo - un seul fichier partagé entre API et front.
  const rootEnvDir = path.resolve(import.meta.dirname, '../..');
  const env = loadEnv(mode, rootEnvDir, '');

  return {
    envDir: rootEnvDir,
    // Expose CLERK_PUBLISHABLE_KEY au front sous le nom VITE_CLERK_PUBLISHABLE_KEY,
    // ce qui évite de dupliquer la valeur dans le .env (une seule source : la racine).
    define: {
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(env.CLERK_PUBLISHABLE_KEY),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@shared': path.resolve(import.meta.dirname, '../../packages/shared/src'),
      },
    },
    server: {
      port: 5173,
    },
  };
});
