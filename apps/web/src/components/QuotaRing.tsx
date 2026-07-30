import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  used: number;
  total: number;
  size?: number;
  stroke?: number;
  className?: string;
}

/** Ring progress for today's published / daily quota; cyan→violet, red when over. */
export default function QuotaRing({ used, total, size = 56, stroke = 5, className }: Props) {
  const ratio = total > 0 ? Math.min(used / total, 1) : 0;
  const over = total > 0 && used > total;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [off, setOff] = useState(c);

  useEffect(() => {
    const t = requestAnimationFrame(() => setOff(c * (1 - ratio)));
    return () => cancelAnimationFrame(t);
  }, [c, ratio]);

  return (
    <div className={className} style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="quota-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#7C5CFF" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? '#F87171' : 'url(#quota-grad)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-mono text-[12px] font-medium tabular-nums"
          style={{ color: over ? '#F87171' : '#E8ECF4' }}
        >
          {used}/{total}
        </span>
      </div>
    </div>
  );
}
