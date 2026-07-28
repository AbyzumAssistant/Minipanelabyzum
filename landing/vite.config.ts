import { defineConfig } from 'vite';
import obfuscator from 'rollup-plugin-obfuscator';

export default defineConfig({
  base: '/landing/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
  },
  plugins: [
    obfuscator({
      global: true,
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.4,
        stringArray: true,
        stringArrayThreshold: 0.5,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
      },
    }),
  ],
});
