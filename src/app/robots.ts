import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/(auth)/', '/(dashboard)/admin/'],
    },
    sitemap: 'https://tif.borja-swiss-solutions.ch/sitemap.xml',
  }
}
