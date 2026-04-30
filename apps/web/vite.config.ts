import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Alias résolus côté Vite + côté TypeScript (paths dans tsconfig).
// Doivent rester synchrones entre les deux.
export default defineConfig(({ mode }) => {
  // Charge .env depuis la racine du monorepo - un seul fichier partagé entre API et front.
  const rootEnvDir = path.resolve(import.meta.dirname, '../..');
  const fileEnv = loadEnv(mode, rootEnvDir, '');

  // En local, loadEnv lit .env.local. Sur Vercel/Netlify, les envs ne sont
  // PAS dans des fichiers - elles sont dans process.env au moment du build.
  // On lit les deux sources, process.env prend la priorité si défini.
  const clerkPubKey =
    process.env.CLERK_PUBLISHABLE_KEY ??
    process.env.VITE_CLERK_PUBLISHABLE_KEY ??
    fileEnv.CLERK_PUBLISHABLE_KEY ??
    fileEnv.VITE_CLERK_PUBLISHABLE_KEY ??
    '';
  const apiUrl = process.env.VITE_API_URL ?? fileEnv.VITE_API_URL ?? 'http://localhost:3000';

  return {
    envDir: rootEnvDir,
    // Expose les envs front au runtime. CLERK_PUBLISHABLE_KEY peut être nommée
    // sans préfixe VITE_ dans .env.local (une seule source pour API + front),
    // mais on l'expose côté front sous VITE_CLERK_PUBLISHABLE_KEY.
    define: {
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(clerkPubKey),
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@youno/shared': path.resolve(import.meta.dirname, '../../packages/shared/src'),
      },
    },
    server: {
      port: 5173,
    },
  };
});
