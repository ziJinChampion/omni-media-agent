/**
 * Shared domain types — mirrors the FastAPI backend models (info.md).
 */

export type Platform = 'xhs' | 'douyin' | 'mock';

export type Vertical = 'animal' | 'geography' | 'custom';

/** 9-state job state machine */
export type JobStatus =
  | 'pending'
  | 'researching'
  | 'drafting'
  | 'reviewing'
  | 'awaiting_human'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'alert';

export type MaterialKind = 'text' | 'image';

export interface AccountConfig {
  name: string;
  platform: Platform;
  vertical: Vertical;
  keywords: string[];
  /** cron expression, e.g. "0 9 * * *" */
  cron: string;
  style_prompt: string;
  /** true → jobs stop at awaiting_human for manual review */
  human_review: boolean;
  max_posts_per_day: number;
}

export interface JobSummary {
  job_id: string;
  account_name: string;
  status: JobStatus;
  topic: string;
  error: string | null;
  retry_count: number;
  /** ISO-8601 timestamps */
  created_at: string;
  updated_at: string;
}

export interface DraftContent {
  /** ≤ 20 chars */
  title: string;
  body: string;
  tags: string[];
  image_urls: string[];
}

export interface JudgeScore {
  /** 0-10 */
  accuracy: number;
  style: number;
  compliance: number;
  feedback: string;
  passed: boolean;
}

export interface Material {
  kind: MaterialKind;
  url: string;
  source: string;
  license: string;
  caption: string;
}

export interface PublishResult {
  success: boolean;
  platform_post_id: string | null;
  error: string | null;
  published_at: string | null;
}

/** Full state payload attached to a job detail */
export interface JobState {
  topic: string | null;
  materials: Material[];
  draft: DraftContent | null;
  judge: JudgeScore | null;
  publish_result: PublishResult | null;
}

export interface JobStatusEvent {
  status: JobStatus;
  at: string;
  note?: string;
}

export interface JobDetail extends JobSummary {
  state: JobState;
  history: JobStatusEvent[];
}

export interface JobsFilter {
  account?: string;
  status?: JobStatus | JobStatus[];
  limit?: number;
}

export interface HealthResponse {
  status: string;
}

export interface TriggerResponse {
  job_id: string;
}

/** Ordered in-progress pipeline (production → distribution) */
export const IN_PROGRESS_STATUSES: JobStatus[] = [
  'researching',
  'drafting',
  'reviewing',
  'publishing',
];

export const ALL_STATUSES: JobStatus[] = [
  'pending',
  'researching',
  'drafting',
  'reviewing',
  'awaiting_human',
  'publishing',
  'published',
  'failed',
  'alert',
];

export const STATUS_LABELS: Record<JobStatus, string> = {
  pending: '待处理',
  researching: '检索中',
  drafting: '撰稿中',
  reviewing: 'AI评审中',
  awaiting_human: '待人工审核',
  publishing: '发布中',
  published: '已发布',
  failed: '失败',
  alert: '告警',
};

export const STATUS_COLORS: Record<JobStatus, string> = {
  pending: '#8B94A7',
  researching: '#38BDF8',
  drafting: '#7C5CFF',
  reviewing: '#C084FC',
  awaiting_human: '#F59E0B',
  publishing: '#22D3EE',
  published: '#34D399',
  failed: '#F87171',
  alert: '#FB7185',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  xhs: '小红书',
  douyin: '抖音',
  mock: 'Mock',
};

export const VERTICAL_LABELS: Record<Vertical, string> = {
  animal: '动物科普',
  geography: '地理科普',
  custom: '自定义',
};
