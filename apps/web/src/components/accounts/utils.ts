/**
 * Page-private helpers for the Accounts matrix page.
 */

import type { AccountConfig, JobSummary, Platform } from '@/lib/types';

export const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');
export const pad2 = pad;

/** Parse daily cron forms "M H * * *"; anything else returns null. */
export function parseDailyCron(cron: string): { h: number; m: number } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, d, mo, w] = parts;
  if (d === '*' && mo === '*' && w === '*' && /^\d+$/.test(m) && /^\d+$/.test(h)) {
    return { h: parseInt(h, 10), m: parseInt(m, 10) };
  }
  return null;
}

/** Humanised cron label, e.g. "每日 09:00"; falls back to the raw expression. */
export function humanCron(cron: string): string {
  const daily = parseDailyCron(cron);
  return daily ? `每日 ${pad(daily.h)}:${pad(daily.m)}` : cron;
}

/** Milliseconds from now until the next scheduled run of a daily cron. */
export function msUntilNextRun(cron: string, now = Date.now()): number | null {
  const daily = parseDailyCron(cron);
  if (!daily) return null;
  const next = new Date(now);
  next.setHours(daily.h, daily.m, 0, 0);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now;
}

export function fmtCountdown(ms: number): string {
  const hh = Math.floor(ms / 3_600_000);
  const mm = Math.floor((ms % 3_600_000) / 60_000);
  const ss = Math.floor((ms % 60_000) / 1000);
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/**
 * Visual persona platform: real platform wins; for platform='mock' accounts
 * derive the badge from the style_prompt persona (小红书种草体 / 抖音文案体),
 * mirroring Dashboard's stylePlatform() fallback.
 */
export function personaPlatform(a: AccountConfig): Platform {
  if (a.platform !== 'mock') return a.platform;
  if (/小红书|种草/.test(a.style_prompt)) return 'xhs';
  if (/抖音/.test(a.style_prompt)) return 'douyin';
  return a.name === 'geo-facts' ? 'douyin' : 'xhs';
}

export const PERSONA_COLORS: Record<Platform, string> = {
  xhs: '#FF2442',
  douyin: '#00F2EA',
  mock: '#8B94A7',
};

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** last-7-days buckets, oldest → newest */
export function last7Days() {
  const days: { key: string; start: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({ key: d.toISOString().slice(0, 10), start: d.getTime() });
  }
  return days;
}

export function bucketByDay(jobs: JobSummary[], pick: (j: JobSummary) => string | null): number[] {
  const days = last7Days();
  const counts = new Array(7).fill(0);
  for (const j of jobs) {
    const iso = pick(j);
    if (!iso) continue;
    const t = new Date(iso).getTime();
    for (let i = 0; i < 7; i++) {
      if (t >= days[i].start && t < days[i].start + DAY) {
        counts[i]++;
        break;
      }
    }
  }
  return counts;
}
