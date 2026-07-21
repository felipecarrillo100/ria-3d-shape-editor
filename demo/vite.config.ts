import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Force all code (including the aliased ../src below) to share one @luciad/ria instance -
      // needed because that source is loaded from a sibling dir, outside this project's own
      // node_modules resolution root. Published npm consumers share one node_modules naturally.
      '@luciad/ria': path.resolve(__dirname, 'node_modules/@luciad/ria'),
      // The actual point of this demo: alias straight to raw source, not a built lib/ output -
      // editing ria-3d-shape-editor/src/**.ts and saving reflects here immediately, no
      // build/pack/install step at all.
      'ria-3d-shape-editor': path.resolve(__dirname, '../src/index.ts'),
    },
  },
})
