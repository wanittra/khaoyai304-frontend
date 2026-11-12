import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '')

  return {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: ({ names }) => names.includes('eng.traineddata.gz')
            ? 'assets/ocr/[hash]/eng.traineddata.gz'
            : 'assets/[name]-[hash][extname]',
        },
      },
    },
    server: {
      proxy: API_PROXY_TARGET
        ? {
            '/api': {
              target: API_PROXY_TARGET,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  }
})
