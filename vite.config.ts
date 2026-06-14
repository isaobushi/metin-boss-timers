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
    // Don't watch the Rust build tree: on Windows cargo locks artifacts under
    // src-tauri/target while compiling, and Vite's watcher throws EBUSY and dies,
    // taking `tauri dev` down with it (it's the beforeDevCommand). Per the Tauri template.
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
})
