import { defineConfig } from 'vite';
// NOIR_PORT: each parallel worktree runs its own dev server (tools/* read the same variable)
const port = parseInt(process.env.NOIR_PORT || '5173', 10);
export default defineConfig({
  server: { port, strictPort: true, host: '127.0.0.1' },
  preview: { port, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022' },
});
