import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// /jobs is a private dashboard that happens to be served from a public host.
// It holds nothing until the user connects a local file, but it should never be
// indexed - and it is deliberately absent from sitemap.ts for the same reason.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/jobs' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
