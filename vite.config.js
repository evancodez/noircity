import { defineConfig } from 'vite';
// The dev server's port: NOIR_PORT (each parallel worktree runs its own
// server; tools/* read the same variable), else PORT (the desktop app's
// preview assigns one when 5173 is taken by another project), else 5173.
const port = parseInt(process.env.NOIR_PORT || process.env.PORT || '5173', 10);
export default defineConfig({
  server: { port, strictPort: true, host: '127.0.0.1' },
  preview: { port, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022' },
});
