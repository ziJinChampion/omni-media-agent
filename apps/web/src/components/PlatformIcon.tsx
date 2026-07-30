import type { Platform } from '@/lib/types';

interface Props {
  platform: Platform;
  size?: number;
  className?: string;
}

/** Brand SVG icons for 小红书 / 抖音 / mock, tinted with platform colors. */
export default function PlatformIcon({ platform, size = 16, className }: Props) {
  if (platform === 'xhs') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-label="小红书">
        <rect width="24" height="24" rx="6" fill="#FF2442" fillOpacity="0.14" />
        <path d="M7 8.2h10M7 12h10M7 15.8h6.5" stroke="#FF2442" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (platform === 'douyin') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-label="抖音">
        <rect width="24" height="24" rx="6" fill="#00F2EA" fillOpacity="0.08" />
        {/* musical note with the signature cyan/red offset */}
        <path
          d="M14.6 6.2c.5 1.6 1.7 2.7 3.4 2.9v2.3c-1.3 0-2.5-.4-3.4-1.1v4.3a4.4 4.4 0 1 1-4.4-4.4c.3 0 .6 0 .9.1v2.4a2.1 2.1 0 1 0 1.2 1.9V6.2h2.3Z"
          fill="#FE2C55"
          transform="translate(0.5,0.5)"
          opacity="0.9"
        />
        <path
          d="M14.6 6.2c.5 1.6 1.7 2.7 3.4 2.9v2.3c-1.3 0-2.5-.4-3.4-1.1v4.3a4.4 4.4 0 1 1-4.4-4.4c.3 0 .6 0 .9.1v2.4a2.1 2.1 0 1 0 1.2 1.9V6.2h2.3Z"
          fill="#00F2EA"
          opacity="0.85"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-label="mock 平台">
      <rect width="24" height="24" rx="6" fill="#8B94A7" fillOpacity="0.12" />
      <circle cx="12" cy="12" r="4.2" stroke="#8B94A7" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.2" fill="#8B94A7" />
    </svg>
  );
}
