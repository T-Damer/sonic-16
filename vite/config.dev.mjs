import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        solid(),
    ],
    resolve: {
        alias: {
            // "@" → src/, mirrored in tsconfig.json "paths"
            '@': fileURLToPath(new URL('../src', import.meta.url)),
        },
    },
    server: {
        port: 8080
    }
})
