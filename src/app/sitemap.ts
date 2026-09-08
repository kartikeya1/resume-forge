import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// One public route. Kept as a generated sitemap rather than a static file so it
// follows SITE_URL across preview and production deployments.
//
// /jobs is intentionally NOT listed: it is a private dashboard and robots.ts
// disallows it. Do not add it here.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
