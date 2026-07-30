/** Small formatting helpers shared by the Review page private components. */

/** "已等待 42 分钟" / "已等待 2 小时 15 分"; overdue when > 2h (turns red). */
export function fmtWait(createdAt: string, now: number): { text: string; overdue: boolean } {
  const mins = Math.max(0, Math.floor((now - +new Date(createdAt)) / 60_000));
  const overdue = mins >= 120;
  if (mins < 1) return { text: '刚进入队列', overdue };
  if (mins < 60) return { text: `已等待 ${mins} 分钟`, overdue };
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { text: m > 0 ? `已等待 ${h} 小时 ${m} 分` : `已等待 ${h} 小时`, overdue };
}

/** "MM-dd HH:mm" mono timestamp for the timeline. */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "HH:mm" clock time. */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
