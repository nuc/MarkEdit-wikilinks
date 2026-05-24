import { defineConfig } from 'vite';
import { defaultViteConfig } from 'markedit-vite';

// In CI we just want to verify the bundle compiles; skip the local-only deploy
// step that copies into MarkEdit's sandboxed scripts/ folder.
export default defineConfig(defaultViteConfig({
  copyDistFile: !process.env.CI,
}));
