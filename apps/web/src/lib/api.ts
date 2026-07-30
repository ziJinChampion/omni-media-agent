/**
 * API client for the omni-media-agent admin console.
 *
 * Every request first tries the real backend (`API_BASE`, 5s timeout).
 * Any failure automatically falls back to the built-in mock dataset and
 * flips the global `mockMode` flag (drives the Sidebar status card and the
 * ErrorBanner).
 */

import type {
  AccountConfig,
  HealthResponse,
  JobDetail,
  JobsFilter,
  JobSummary,
  TriggerResponse,
} from './types';
import {
  mockApproveJob,
  mockGetAccounts,
  mockGetHealth,
  mockGetJob,
  mockGetJobs,
  mockRejectJob,
  mockTriggerAccount,
} from './mock-data';

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '/api';

const TIMEOUT_MS = 5_000;

/* ------------------------------------------------------------------ */
/* global mock-mode flag (module store + subscribers)                  */
/* ------------------------------------------------------------------ */

let mockMode = false;
const listeners = new Set<(v: boolean) => void>();

export function isMockMode(): boolean {
  return mockMode;
}

export function setMockMode(v: boolean) {
  if (mockMode === v) return;
  mockMode = v;
  listeners.forEach((fn) => fn(v));
}

export function subscribeMockMode(fn: (v: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------------------------------------------ */
/* low-level fetch                                                     */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(res.status, text || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run the real request; on ANY failure mark mock mode and run the mock
 * implementation instead. ApiError with 4xx status (e.g. 409 conflicts from
 * approve/reject) is re-thrown — that's a business error, not a fallback case.
 */
async function withFallback<T>(real: () => Promise<T>, mock: () => Promise<T>): Promise<T> {
  if (!API_BASE || mockMode) {
    setMockMode(true);
    return mock();
  }
  try {
    const out = await real();
    return out;
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err;
    setMockMode(true);
    return mock();
  }
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export function getHealth(): Promise<HealthResponse> {
  return withFallback(() => request('/health'), mockGetHealth);
}

export function getAccounts(): Promise<AccountConfig[]> {
  return withFallback(() => request('/accounts'), mockGetAccounts);
}

export function triggerAccount(name: string): Promise<TriggerResponse> {
  return withFallback(
    () => request(`/accounts/${encodeURIComponent(name)}/trigger`, { method: 'POST' }),
    () => mockTriggerAccount(name),
  );
}

export function getJobs(filters: JobsFilter = {}): Promise<JobSummary[]> {
  const params = new URLSearchParams();
  if (filters.account) params.set('account', filters.account);
  if (filters.status) {
    const s = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
    params.set('status', s);
  }
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return withFallback(() => request(`/jobs${qs ? `?${qs}` : ''}`), () => mockGetJobs(filters));
}

export function getJob(jobId: string): Promise<JobDetail> {
  return withFallback(() => request(`/jobs/${encodeURIComponent(jobId)}`), () => mockGetJob(jobId));
}

export function approveJob(jobId: string): Promise<JobSummary> {
  return withFallback(
    () => request(`/jobs/${encodeURIComponent(jobId)}/approve`, { method: 'POST' }),
    () => mockApproveJob(jobId),
  );
}

export function rejectJob(jobId: string, reason?: string): Promise<JobSummary> {
  return withFallback(
    () =>
      request(`/jobs/${encodeURIComponent(jobId)}/reject`, {
        method: 'POST',
        body: JSON.stringify(reason ? { reason } : {}),
      }),
    () => mockRejectJob(jobId, reason),
  );
}
