'use client';

/**
 * Tipe baris API admin (respons JSON dari route handler /api/*).
 * Data dari jaringan = tak-tepercaya → helper parser di bawah menormalkan
 * bentuk yang mungkin array atau { jobs: [] } / { data: [] } sebelum dipakai.
 */

export interface MirrorJob {
  id: string;
  sourceUrl: string;
  sourceSite?: string | null;
  status: string;
  progress?: number;
  total?: number;
  message?: string | null;
  seriesId?: string | null;
  result?: string | null;
  createdAt: string | number | Date;
  updatedAt?: string | number | Date;
}

export interface TranslateJobLite {
  id: string;
  status: string;
  progress?: number;
  total?: number;
  done?: number;
  message?: string | null;
  error?: string | null;
  targetLang?: string;
}

export interface SeriesRow {
  id: string;
  title: string;
  slug: string;
  cover?: string | null;
  type?: string;
  status?: string;
  views?: number;
  featured?: boolean;
  _count?: { chapters?: number };
}

export interface ChapterRow {
  id: string;
  seriesId?: string;
  title?: string | null;
  chapterNum: number;
  views?: number;
  createdAt?: string | number | Date;
  _count?: { pages?: number };
  series?: { id: string; title: string; slug: string };
}

export interface UserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string | null;
  createdAt?: string | number | Date;
}

export interface AdRow {
  id: string;
  name: string;
  position: string;
  code?: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  active?: boolean;
  createdAt?: string | number | Date;
}

/** String wajib dari nilai yang mungkin hilang (untuk key/lookup JSX). */
export function firstStr(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value ? value : fallback;
}

/** Respons list API bisa array murni atau { <key>: [] } — normalalkan. */
export function asArray<T>(value: unknown, ...keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of [...keys, 'data', 'jobs', 'chapters', 'series', 'users', 'ads', 'items']) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

/** "Xm lalu" gaya lama. */
export function timeAgo(d: string | number | Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${Math.max(0, s)}d lalu`;
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`;
  return `${Math.floor(s / 3600)}j lalu`;
}

/** Angka aman dari nilai JSON yang mungkin undefined/null/string. */
export function numOr(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Format tanggal lokal id-ID aman. */
export function fmtDate(d: string | number | Date | undefined | null): string {
  if (d === undefined || d === null) return '—';
  return new Date(d).toLocaleDateString('id-ID');
}
