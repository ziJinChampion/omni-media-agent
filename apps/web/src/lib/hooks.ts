/**
 * React Query hooks — the single data entry point for all pages.
 * 10s polling everywhere so the console feels live.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import {
  approveJob,
  getAccounts,
  getHealth,
  getJob,
  getJobs,
  isMockMode,
  rejectJob,
  subscribeMockMode,
  triggerAccount,
} from './api';
import type { JobsFilter, JobStatus } from './types';

export const REFETCH_INTERVAL = 10_000;

export const queryKeys = {
  health: ['health'] as const,
  accounts: ['accounts'] as const,
  jobs: (filters?: JobsFilter) => ['jobs', filters ?? {}] as const,
  job: (id: string) => ['job', id] as const,
};

/** global mock-mode flag, reactive */
export function useMockMode(): boolean {
  return useSyncExternalStore(subscribeMockMode, isMockMode, () => true);
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    refetchInterval: REFETCH_INTERVAL,
    retry: 1,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: getAccounts,
    refetchInterval: REFETCH_INTERVAL,
    retry: 1,
  });
}

export function useJobs(filters?: JobsFilter) {
  return useQuery({
    queryKey: queryKeys.jobs(filters),
    queryFn: () => getJobs(filters),
    refetchInterval: REFETCH_INTERVAL,
    retry: 1,
  });
}

export function useJobDetail(jobId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.job(jobId ?? ''),
    queryFn: () => getJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: REFETCH_INTERVAL,
    retry: 1,
  });
}

function useInvalidateJobs() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['jobs'] });
    void qc.invalidateQueries({ queryKey: ['job'] });
  };
}

export function useTriggerAccount() {
  const invalidate = useInvalidateJobs();
  return useMutation({
    mutationFn: (name: string) => triggerAccount(name),
    onSuccess: invalidate,
  });
}

export function useApproveJob() {
  const invalidate = useInvalidateJobs();
  return useMutation({
    mutationFn: (jobId: string) => approveJob(jobId),
    onSuccess: invalidate,
  });
}

export function useRejectJob() {
  const invalidate = useInvalidateJobs();
  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason?: string }) => rejectJob(jobId, reason),
    onSuccess: invalidate,
  });
}

/** convenience: count jobs in a given status from a summary list */
export function countByStatus(jobs: { status: JobStatus }[] | undefined, statuses: JobStatus[]): number {
  if (!jobs) return 0;
  return jobs.filter((j) => statuses.includes(j.status)).length;
}
