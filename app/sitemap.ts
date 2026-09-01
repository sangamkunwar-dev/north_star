import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sajilo.app'
  return [{ url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }]
}
