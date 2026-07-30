import { cn } from '@/lib/utils';
import type { Platform } from '@/lib/types';

interface Props {
  /** account name, e.g. "animal-facts" — first letter is rendered */
  name: string;
  /** platform tint; falls back to a violet/cyan gradient */
  platform?: Platform;
  size?: number;
  className?: string;
}

const GRADIENTS: Record<Platform, string> = {
  xhs: 'linear-gradient(135deg,#FF2442,#FF7A5C)',
  douyin: 'linear-gradient(135deg,#00F2EA,#FE2C55)',
  mock: 'linear-gradient(135deg,#7C5CFF,#22D3EE)',
};

/** Rounded square with the account initial over a platform-color gradient. */
export default function AccountAvatar({ name, platform = 'mock', size = 32, className }: Props) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-[9px] font-grotesk font-bold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        background: GRADIENTS[platform],
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
