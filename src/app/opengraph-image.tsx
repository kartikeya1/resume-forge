import { ImageResponse } from 'next/og';
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site';

// Generated at build time and reused for the Twitter card too, so a shared
// ResumeForge link unfurls as a real card instead of bare text.
export const alt = SITE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#fafafa',
          padding: '80px',
          // System stack only - no font file is bundled, so nothing to load.
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0a0a0a',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            R
          </div>
          {/* Satori requires an explicit display on any node with >1 child. */}
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            <span>Resume</span>
            <span style={{ color: '#a3a3a3' }}>Forge</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -2,
            maxWidth: 940,
          }}
        >
          Resume builder with a live ATS score and JD keyword match.
        </div>

        <div style={{ marginTop: 32, fontSize: 28, color: '#a3a3a3', maxWidth: 900 }}>
          {SITE_DESCRIPTION.split('. ').slice(-1)[0]}
        </div>
      </div>
    ),
    size
  );
}
