import { defineConfig } from 'vite';

export default defineConfig({
  // Bind to 0.0.0.0 and allow proxied preview hosts (e2b, Netlify deploy
  // previews). Without allowedHosts the dev server rejects the proxy Host
  // header with "Blocked request".
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },

  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    cssCodeSplit: true,
    reportCompressedSize: true,
    // Firebase is large; warn only above a realistic threshold.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split Firebase into its own chunk so the landing page never
          // downloads it — it is dynamically imported on first auth/data use.
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          return undefined;
        },
      },
    },
  },

  oxc: {
    legalComments: 'none',
  },
});
