import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // This plugin MUST come last to bundle everything into a single HTML file.
    viteSingleFile({ useIIFE: true }) 
  ],
  build: {
    // Target a compatible environment for the Apps Script sandbox.
    target: 'es2015',
    // We disable minification because the Apps Script sandbox can have issues
    // parsing extremely long single lines of code produced by minifiers.
    minify: false,
    // The viteSingleFile plugin will handle all inlining, so complex rollupOptions are not needed.
  },
});
