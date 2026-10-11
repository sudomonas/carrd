import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createMetaHandler } from './server/meta.js';

// Mounts the metadata endpoint inside the dev and preview servers so URL
// extraction works with `npm run dev` exactly as with `npm start`.
const metaApi = () => {
  const mount = (server) => {
    server.middlewares.use('/api/meta', createMetaHandler());
  };
  return { name: 'carrd-meta-api', configureServer: mount, configurePreviewServer: mount };
};

export default defineConfig({
  plugins: [react(), metaApi()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
