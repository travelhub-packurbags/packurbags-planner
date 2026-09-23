import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  base: '/',
  build: {
    assetsDir: 'trip-planner-assets',  // unique prefix - won't clash with main site's /assets/
  },
})
