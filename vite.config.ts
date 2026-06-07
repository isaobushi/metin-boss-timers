import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri expects the dev server on a fixed port matching `devUrl` in tauri.conf.json.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
})
