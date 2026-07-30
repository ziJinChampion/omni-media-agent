import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** Radar illustration + guidance copy, optionally with a CTA. */
export default function EmptyState({
  title = '暂无数据',
  description,
  action,
  className,
  compact = false,
}: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-14', className)}>
      <img
        src="/assets/empty-state.svg"
        alt=""
        width={compact ? 200 : 320}
        height={compact ? 150 : 240}
        className="opacity-80"
        draggable={false}
      />
      <p className="mt-4 text-sm font-medium text-text-secondary">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
