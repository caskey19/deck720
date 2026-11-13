import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        game: new URL('./index.html', import.meta.url).pathname,
        review: new URL('./qa.html', import.meta.url).pathname,
      },
    },
  },
})
