import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {splitVendorChunkPlugin} from 'vite';
import {createHtmlPlugin} from 'vite-plugin-html';
import fs from 'fs';
import {createRequire} from 'node:module';

const {getDefinitionRevisions} = createRequire(path.resolve(__dirname, 'package.json'))('./scripts/build-definitions.js');

const {createResourceModePlugin} = createRequire(path.resolve(__dirname, 'package.json'))('./scripts/resource-mode.cjs');

const definitionsDir = path.resolve(__dirname, 'public/definitions');
const hashPath = path.join(definitionsDir, 'hash.json');
// Preview serves existing dist and does not require regenerated definitions.
const hash = fs.existsSync(hashPath) ? fs.readFileSync(hashPath, 'utf8') : '{}';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __BUILTIN_DEFINITION_REVISIONS__: JSON.stringify(fs.existsSync(hashPath) ? getDefinitionRevisions(definitionsDir) : {}),
  },
  plugins: [
    createResourceModePlugin({projectRoot: __dirname}),
    react(),
    createHtmlPlugin({
      inject: {
        data: {
          hash,
        },
      },
    }),
    splitVendorChunkPlugin(),
  ],
  assetsInclude: ['**/*.glb'],
  envDir: '.',
  server: {
    open: true,
    watch: {ignored: ['**/.local/**', '**/.tools/**']},
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
      assets: path.resolve(__dirname, './src/assets'),
    },
  },
  optimizeDeps: {
    include: ['@the-via/reader'],
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
      // Enable esbuild polyfill plugins
      plugins: [],
    },
  },
});
