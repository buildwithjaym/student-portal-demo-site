import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://student-portal-demo-site.vercel.app/',
      lastModified: new Date(),
    },
  ]
}