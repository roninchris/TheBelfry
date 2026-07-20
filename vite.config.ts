import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Where the app will be served from.
    //
    // Netlify and `npm run dev` serve from the domain root, so the default is
    // "/". GitHub Pages serves a project site from a sub-path
    // (/thebelfry/), and the deploy workflow sets BASE_PATH accordingly.
    //
    // Anything in public/ that is referenced as a bare string rather than an
    // import has to go through assetUrl() to pick this up — Vite cannot rewrite
    // a path it never sees. See src/lib/assetUrl.ts.
    base: process.env.BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
