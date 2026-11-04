import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const BUILD_ID = String(Date.now());

/** Writes version.json next to the app so open copies can tell a newer build exists. */
const versionFile = (): Plugin => ({
  name: 'version-file',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) }); }
});

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), versionFile()],
  build: { chunkSizeWarningLimit: 1000 }
});
