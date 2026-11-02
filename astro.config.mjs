// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static', // pages prerender by default; routes opt out with `export const prerender = false`
  adapter: cloudflare({
    imageService: 'passthrough', // no image transforms needed; avoids provisioning an IMAGES binding
    // Reuse our cache namespace instead of letting the adapter provision a separate SESSION one.
    sessionKVBindingName: 'CACHE',
  }),
  integrations: [react()],
  devToolbar: { enabled: false }, // it overlaps the page in screenshots and reviews
  vite: {
    plugins: [tailwindcss()],
  },
});
