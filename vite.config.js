import { defineConfig } from 'vite';
// The dev server's port: NOIR_PORT (each parallel worktree runs its own
// server; tools/* read the same variable), else PORT (the desktop app's
// preview assigns one when 5173 is taken by another project), else 5173.
const port = parseInt(process.env.NOIR_PORT || process.env.PORT || '5173', 10);
export default defineConfig({
  // (each server its own dependency cache: worktrees share node_modules by a
  // symlink, and one server re-optimising a shared cache reloaded every
  // other server's pages; and a server never watches the worktrees under it
  // or the captures)
  cacheDir: `node_modules/.vite-${port}`,
  server: { port, strictPort: true, host: '127.0.0.1', watch: { ignored: ['**/.claude/**', '**/shots/**', '**/docs/**'] } },
  preview: { port, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022' },
});
