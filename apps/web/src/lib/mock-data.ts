/**
 * Realistic in-browser mock dataset — mirrors the FastAPI backend models.
 * Used as an automatic fallback when the real API is unreachable, and as the
 * sole data source in preview environments. In-progress jobs advance through
 * the state machine on a local tick so the UI feels alive under polling.
 */

import type {
  AccountConfig,
  DraftContent,
  HealthResponse,
  JobDetail,
  JobState,
  JobStatus,
  JobStatusEvent,
  JobsFilter,
  JobSummary,
  JudgeScore,
  Material,
  TriggerResponse,
} from './types';

export class MockApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'MockApiError';
    this.status = status;
  }
}

const HOUR = 3_600_000;

/** images come from the same remote mock CDN as the backend mock (picsum) */
const img = (slug: string) => `https://picsum.photos/seed/${slug}/800/600`;

/* ------------------------------------------------------------------ */
/* Accounts (fields per info.md)                                       */
/* ------------------------------------------------------------------ */

const ACCOUNTS: AccountConfig[] = [
  {
    name: 'animal-facts',
    platform: 'mock',
    vertical: 'animal',
    keywords: ['红熊猫', '水獭', '北极狐', '蜂鸟', '冷知识'],
    cron: '0 9 * * *',
    style_prompt: '小红书种草体：emoji 点缀、口语化、短段落、结尾互动提问',
    human_review: false,
    max_posts_per_day: 8,
  },
  {
    name: 'geo-facts',
    platform: 'mock',
    vertical: 'geography',
    keywords: ['丹霞地貌', '极光', '沙漠', '梯田', '地理冷知识'],
    cron: '30 9 * * *',
    style_prompt: '抖音文案体：悬念开头、节奏感强、金句收尾、配热门话题标签',
    human_review: true,
    max_posts_per_day: 4,
  },
];

/* ------------------------------------------------------------------ */
/* Content building blocks                                             */
/* ------------------------------------------------------------------ */

interface JobSeed {
  id: string;
  account: string;
  status: JobStatus;
  topic: string;
  createdH: number; // hours ago
  retry?: number;
  error?: string | null;
  materials?: Material[];
  draft?: DraftContent;
  judge?: JudgeScore;
  publish?: JobState['publish_result'];
}

const animalMaterials = (topic: string): Material[] => [
  { kind: 'image', url: img('mock-animal-1'), source: 'unsplash', license: 'CC0', caption: `${topic} · 主图` },
  { kind: 'image', url: img('mock-animal-2'), source: 'unsplash', license: 'CC0', caption: '水獭仰面漂浮特写' },
  { kind: 'image', url: img('mock-animal-3'), source: 'pexels', license: 'CC0', caption: '北极狐雪地半身像' },
  { kind: 'image', url: img('mock-animal-4'), source: 'wikimedia', license: 'CC-BY-SA', caption: '蜂鸟悬停采蜜瞬间' },
  { kind: 'text', url: 'https://zh.wikipedia.org/wiki/Animal', source: 'wikipedia', license: 'CC-BY-SA', caption: '参考资料：动物行为学词条' },
];

const geoMaterials = (topic: string): Material[] => [
  { kind: 'image', url: img('mock-geo-1'), source: 'unsplash', license: 'CC0', caption: `${topic} · 主图` },
  { kind: 'image', url: img('mock-geo-2'), source: 'pexels', license: 'CC0', caption: '极光下的黑沙滩与玄武岩柱' },
  { kind: 'image', url: img('mock-geo-3'), source: 'unsplash', license: 'CC0', caption: '沙丘明暗交界线' },
  { kind: 'image', url: img('mock-geo-4'), source: 'wikimedia', license: 'CC-BY-SA', caption: '钙化池梯田俯拍' },
  { kind: 'text', url: 'https://zh.wikipedia.org/wiki/Geography', source: 'wikipedia', license: 'CC-BY-SA', caption: '参考资料：地貌成因词条' },
];

const animalDraft = (topic: string, m: Material[]): DraftContent => ({
  title: topic.length > 20 ? topic.slice(0, 20) : topic,
  body:
    `姐妹们快看这个冷知识！🐾\n\n${topic}——我第一次查到的时候真的惊了。\n\n` +
    `科学家发现它们的行为模式和人类婴儿惊人地相似，连情绪表达方式都有共通点。` +
    `难怪每次刷到都忍不住停下来看半天…\n\n你还知道哪些动物冷知识？评论区告诉我👇`,
  tags: ['动物科普', '冷知识', '治愈系', '涨知识'],
  image_urls: m.filter((x) => x.kind === 'image').slice(0, 4).map((x) => x.url),
});

const geoDraft = (topic: string, m: Material[]): DraftContent => ({
  title: topic.length > 20 ? topic.slice(0, 20) : topic,
  body:
    `你敢信？地球上还有这种地方。\n\n${topic}，形成于数百万年前的地质运动，至今仍在缓慢变化。\n\n` +
    `航拍视角下像打翻的调色盘，每一道纹路都是时间刻出来的。\n\n世界那么大，先从这条视频看起。`,
  tags: ['地理', '航拍', '旅行', '视觉震撼', '地球之美'],
  image_urls: m.filter((x) => x.kind === 'image').slice(0, 4).map((x) => x.url),
});

const judge = (passed: boolean, a = 9, s = 8.5, c = 9.5, fb?: string): JudgeScore => ({
  accuracy: a,
  style: s,
  compliance: c,
  passed,
  feedback:
    fb ??
    (passed
      ? '事实核查通过；文案风格符合账号人设；无合规风险。图片授权状态正常。'
      : '第 2 段数据表述缺少来源；标题疑似夸大，建议收敛措辞后再提交。'),
});

const pub = (ok: boolean, hoursAgo: number, postId?: string, err?: string): JobState['publish_result'] => ({
  success: ok,
  platform_post_id: ok ? (postId ?? `mock-post-${Math.floor(Math.random() * 1e6).toString(36)}`) : null,
  error: ok ? null : (err ?? '发布接口返回 500'),
  published_at: ok ? iso(hoursAgo) : null,
});

/* ------------------------------------------------------------------ */
/* Job store (mutable — tick advances in-progress jobs)                */
/* ------------------------------------------------------------------ */

function iso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * HOUR).toISOString();
}

function buildSeed(s: JobSeed): JobDetail {
  const created = Date.now() - s.createdH * HOUR;
  const statusAt = (st: JobStatus, hoursAfter: number, note?: string): JobStatusEvent => ({
    status: st,
    at: new Date(created + hoursAfter * HOUR).toISOString(),
    note,
  });
  const history: JobStatusEvent[] = [{ status: 'pending', at: new Date(created).toISOString() }];
  const order: JobStatus[] = ['researching', 'drafting', 'reviewing', 'awaiting_human', 'publishing', 'published'];
  const idx = order.indexOf(s.status);
  order.slice(0, Math.max(idx, 0)).forEach((st, i) => history.push(statusAt(st, 0.2 + i * 0.4)));
  if (s.status === 'failed') history.push(statusAt('failed', 0.2 + Math.max(idx, 0) * 0.4, s.error ?? undefined));
  if (s.status === 'alert') history.push(statusAt('alert', 1.2, s.error ?? undefined));

  const updatedH = Math.max(0.02, Math.min(s.createdH, 0.2 + Math.max(idx, 0) * 0.4));
  const state: JobState = {
    topic: s.topic,
    materials: s.materials ?? [],
    draft: s.draft ?? null,
    judge: s.judge ?? null,
    publish_result: s.publish ?? null,
  };
  return {
    job_id: s.id,
    account_name: s.account,
    status: s.status,
    topic: s.topic,
    error: s.error ?? null,
    retry_count: s.retry ?? 0,
    created_at: new Date(created).toISOString(),
    updated_at: new Date(Date.now() - updatedH * HOUR).toISOString(),
    state,
    history,
  };
}

function seeds(): JobDetail[] {
  const list: JobSeed[] = [];
  const A = 'animal-facts';
  const G = 'geo-facts';

  /* --- published (spread across 7 days, today included) --- */
  const publishedTopics: Array<[string, string, number]> = [
    ['j-p01', A, 3], // today
    ['j-p02', A, 8], // today
    ['j-p03', G, 20], // today-ish
    ['j-p04', A, 26],
    ['j-p05', A, 34],
    ['j-p06', G, 50],
    ['j-p07', A, 74],
    ['j-p08', G, 98],
    ['j-p09', A, 122],
    ['j-p10', A, 146],
    ['j-p11', G, 160],
  ];
  const topicPool: Record<string, string[]> = {
    [A]: [
      '红熊猫用尾巴当围巾过冬',
      '水獭睡觉会手牵手防止漂散',
      '北极狐的听觉能定位雪下猎物',
      '蜂鸟是唯一能倒飞的鸟',
      '章鱼有三个心脏和蓝色血液',
      '树懒每周只下树排便一次',
      '海獭掌心有口袋存食物',
      '乌鸦能记住人类的脸好几年',
    ],
    [G]: [
      '张掖丹霞：大地调色盘的成因',
      '冰岛黑沙滩为何是黑色的',
      '撒哈拉沙漠每隔万年变绿洲',
      '棉花堡钙化池的白色阶梯',
      '极光为什么是绿色的',
      '死亡谷会自己移动的石头',
      '贝加尔湖冰面的气泡奇观',
    ],
  };
  const counters: Record<string, number> = { [A]: 0, [G]: 0 };
  for (const [id, acc, h] of publishedTopics) {
    const topics = topicPool[acc];
    const topic = topics[counters[acc]++ % topics.length];
    const m = acc === A ? animalMaterials(topic) : geoMaterials(topic);
    const d = acc === A ? animalDraft(topic, m) : geoDraft(topic, m);
    list.push({
      id, account: acc, status: 'published', topic, createdH: h,
      materials: m, draft: d, judge: judge(true),
      publish: pub(true, Math.max(0.5, h - 1), `mock-post-${id.slice(2)}`),
    });
  }

  /* --- in-progress pipeline (advance on tick) --- */
  list.push(
    { id: 'j-w01', account: A, status: 'pending', topic: '考拉指纹与人类几乎无法区分', createdH: 0.5 },
    { id: 'j-w02', account: G, status: 'pending', topic: '彩虹瀑布的地质层叠结构', createdH: 1.2 },
    { id: 'j-w03', account: A, status: 'researching', topic: '海豚睡觉只睡一半大脑', createdH: 0.3 },
    { id: 'j-w04', account: G, status: 'researching', topic: '火焰山真实温度有多夸张', createdH: 0.8 },
    { id: 'j-w05', account: A, status: 'drafting', topic: '企鹅求偶会送鹅卵石', createdH: 0.6, materials: animalMaterials('企鹅求偶会送鹅卵石') },
    { id: 'j-w06', account: A, status: 'reviewing', topic: '猫的呼噜声能促进骨骼愈合', createdH: 1.5, materials: animalMaterials('猫的呼噜声能促进骨骼愈合'), draft: animalDraft('猫的呼噜声能促进骨骼愈合', animalMaterials('猫的呼噜声能促进骨骼愈合')) },
    { id: 'j-w07', account: A, status: 'publishing', topic: '松鼠埋坚果靠空间记忆找回', createdH: 0.4, materials: animalMaterials('松鼠埋坚果靠空间记忆找回'), draft: animalDraft('松鼠埋坚果靠空间记忆找回', animalMaterials('松鼠埋坚果靠空间记忆找回')), judge: judge(true) },
  );

  /* --- awaiting_human: geo-facts queue with full state --- */
  const awaitingTopics = [
    '张掖丹霞日落时分的色彩爆炸',
    '冰岛极光与玄武岩柱同框奇观',
    '撒哈拉沙丘的光影分界线美学',
  ];
  awaitingTopics.forEach((t, i) => {
    const m = geoMaterials(t);
    list.push({
      id: `j-r0${i + 1}`, account: G, status: 'awaiting_human', topic: t,
      createdH: 2 + i * 3, materials: m, draft: geoDraft(t, m), judge: judge(true),
    });
  });

  /* --- failed / alert --- */
  list.push(
    {
      id: 'j-f01', account: A, status: 'failed', topic: '蜜蜂能识别人脸', createdH: 6,
      retry: 2, error: '图片下载超时：unsplash 源连接重置（已自动重试 2 次）',
      materials: animalMaterials('蜜蜂能识别人脸'),
      publish: pub(false, 5, undefined, '图片下载超时'),
    },
    {
      id: 'j-f02', account: G, status: 'failed', topic: '盐湖镜面效应的形成条件', createdH: 30,
      retry: 1, error: 'AI 评审连续 2 次未通过：事实性得分 5.8/10，已放弃',
      materials: geoMaterials('盐湖镜面效应的形成条件'),
      draft: geoDraft('盐湖镜面效应的形成条件', geoMaterials('盐湖镜面效应的形成条件')),
      judge: judge(false, 5.8, 7.2, 8.9),
    },
    {
      id: 'j-f03', account: A, status: 'failed', topic: '蚂蚁不睡觉但会打盹', createdH: 55,
      retry: 3, error: '发布接口返回 429：超出平台日限额',
      materials: animalMaterials('蚂蚁不睡觉但会打盹'),
      draft: animalDraft('蚂蚁不睡觉但会打盹', animalMaterials('蚂蚁不睡觉但会打盹')),
      judge: judge(true),
      publish: pub(false, 54, undefined, 'HTTP 429 rate limited'),
    },
    {
      id: 'j-a01', account: G, status: 'alert', topic: '火山地貌的极端形成过程', createdH: 14,
      retry: 2, error: '连续 3 次评审未通过且重试耗尽，已升级为人工告警',
      materials: geoMaterials('火山地貌的极端形成过程'),
      draft: geoDraft('火山地貌的极端形成过程', geoMaterials('火山地貌的极端形成过程')),
      judge: judge(false, 5.2, 6.1, 8.4, '事实性得分过低：熔岩年代数据与权威来源冲突；建议人工介入修订。'),
    },
  );

  return list.map(buildSeed);
}

let store: JobDetail[] = seeds();
let triggerSeq = 0;

/* ------------------------------------------------------------------ */
/* Local state-machine tick                                            */
/* ------------------------------------------------------------------ */

const STAGE_MS: Partial<Record<JobStatus, number>> = {
  pending: 18_000,
  researching: 25_000,
  drafting: 25_000,
  reviewing: 20_000,
  publishing: 9_000,
};

function nextStatus(job: JobDetail): JobStatus | null {
  const account = ACCOUNTS.find((a) => a.name === job.account_name);
  switch (job.status) {
    case 'pending': return 'researching';
    case 'researching': return 'drafting';
    case 'drafting': return 'reviewing';
    case 'reviewing': return account?.human_review ? 'awaiting_human' : 'publishing';
    case 'publishing': return 'published';
    default: return null;
  }
}

function ensureMaterials(job: JobDetail) {
  if (job.state.materials.length === 0) {
    job.state.materials = job.account_name === 'animal-facts'
      ? animalMaterials(job.topic)
      : geoMaterials(job.topic);
  }
}

function advance(job: JobDetail, to: JobStatus) {
  const now = new Date().toISOString();
  job.history.push({ status: to, at: now });
  job.status = to;
  job.updated_at = now;
  if (to === 'drafting') ensureMaterials(job);
  if (to === 'reviewing') {
    ensureMaterials(job);
    job.state.draft ??= job.account_name === 'animal-facts'
      ? animalDraft(job.topic, job.state.materials)
      : geoDraft(job.topic, job.state.materials);
  }
  if (to === 'awaiting_human') {
    job.state.judge ??= judge(true);
  }
  if (to === 'publishing') {
    job.state.judge ??= judge(true);
  }
  if (to === 'published') {
    job.state.publish_result = pub(true, 0, `mock-post-${job.job_id}`);
  }
}

/** advance in-progress jobs whose current stage has exceeded its duration */
function tick() {
  const now = Date.now();
  for (const job of store) {
    const dur = STAGE_MS[job.status];
    if (!dur) continue;
    if (now - new Date(job.updated_at).getTime() > dur) {
      const nxt = nextStatus(job);
      if (nxt) advance(job, nxt);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mock API — same signatures as src/lib/api.ts                        */
/* ------------------------------------------------------------------ */

const latency = () => new Promise((r) => setTimeout(r, 60 + Math.random() * 120));

function toSummary(j: JobDetail): JobSummary {
  return {
    job_id: j.job_id,
    account_name: j.account_name,
    status: j.status,
    topic: j.topic,
    error: j.error,
    retry_count: j.retry_count,
    created_at: j.created_at,
    updated_at: j.updated_at,
  };
}

export async function mockGetHealth(): Promise<HealthResponse> {
  await latency();
  return { status: 'ok' };
}

export async function mockGetAccounts(): Promise<AccountConfig[]> {
  await latency();
  return structuredClone(ACCOUNTS);
}

export async function mockTriggerAccount(name: string): Promise<TriggerResponse> {
  await latency();
  const account = ACCOUNTS.find((a) => a.name === name);
  if (!account) throw new MockApiError(404, `account not found: ${name}`);
  triggerSeq += 1;
  const id = `j-t${Date.now().toString(36)}${triggerSeq}`;
  const topic =
    account.vertical === 'animal'
      ? '浣熊吃东西前为什么要洗一洗'
      : '天空之镜乌尤尼盐沼的形成';
  const now = new Date().toISOString();
  const job: JobDetail = {
    job_id: id,
    account_name: name,
    status: 'pending',
    topic,
    error: null,
    retry_count: 0,
    created_at: now,
    updated_at: now,
    state: { topic, materials: [], draft: null, judge: null, publish_result: null },
    history: [{ status: 'pending', at: now, note: '手动触发' }],
  };
  store.unshift(job);
  return { job_id: id };
}

export async function mockGetJobs(filters: JobsFilter = {}): Promise<JobSummary[]> {
  await latency();
  tick();
  let list = [...store];
  if (filters.account) list = list.filter((j) => j.account_name === filters.account);
  if (filters.status) {
    const set = Array.isArray(filters.status) ? filters.status : [filters.status];
    list = list.filter((j) => set.includes(j.status));
  }
  list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  if (filters.limit) list = list.slice(0, filters.limit);
  return list.map(toSummary);
}

export async function mockGetJob(jobId: string): Promise<JobDetail> {
  await latency();
  tick();
  const job = store.find((j) => j.job_id === jobId);
  if (!job) throw new MockApiError(404, `job not found: ${jobId}`);
  return structuredClone(job);
}

export async function mockApproveJob(jobId: string): Promise<JobSummary> {
  await latency();
  const job = store.find((j) => j.job_id === jobId);
  if (!job) throw new MockApiError(404, `job not found: ${jobId}`);
  if (job.status !== 'awaiting_human') {
    throw new MockApiError(409, `job ${jobId} is not awaiting human review (status=${job.status})`);
  }
  advance(job, 'publishing');
  return toSummary(job);
}

export async function mockRejectJob(jobId: string, reason?: string): Promise<JobSummary> {
  await latency();
  const job = store.find((j) => j.job_id === jobId);
  if (!job) throw new MockApiError(404, `job not found: ${jobId}`);
  if (job.status !== 'awaiting_human') {
    throw new MockApiError(409, `job ${jobId} is not awaiting human review (status=${job.status})`);
  }
  const now = new Date().toISOString();
  const msg = reason?.trim() ? `人工审核拒绝：${reason.trim()}` : '人工审核拒绝';
  job.status = 'failed';
  job.error = msg;
  job.updated_at = now;
  job.history.push({ status: 'failed', at: now, note: msg });
  job.state.publish_result = { success: false, platform_post_id: null, error: msg, published_at: null };
  return toSummary(job);
}

/** reset the store (tests / hot reload) */
export function __resetMockStore() {
  store = seeds();
}
