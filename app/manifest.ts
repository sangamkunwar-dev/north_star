import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sajilo',
    short_name: 'Sajilo',
    description: 'Create meaningful social posts with a calm AI workspace.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f7fb',
    theme_color: '#5b4bdb',
    orientation: 'portrait-primary',

    icons: [
      {
        src: '/sajilo-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/sajilo-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
