import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Single-page app: one route. Kept as a generated sitemap rather than a static
// file so it follows SITE_URL across preview and production deployments.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
