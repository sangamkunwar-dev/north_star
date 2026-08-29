import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Northstar Social',
    short_name: 'Northstar',
    description: 'Create meaningful social posts with a calm AI workspace.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f7fb',
    theme_color: '#5b4bdb',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
