// Domain shapes returned by /api (see build contract). Client-side data model.

export interface SeriesSummary {
  id: string;
  title: string;
  slug: string;
  cover?: string | null;
  description?: string | null;
  author?: string | null;
  artist?: string | null;
  status?: string;
  type?: string;
  genres?: string[];
  views?: number;
  rating?: number;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { chapters?: number; comments?: number };
}

export interface SeriesDetail extends SeriesSummary {
  chapters?: ChapterSummary[];
}

export interface ChapterSummary {
  id: string;
  seriesId?: string;
  title?: string | null;
  chapterNum: number;
  views?: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: { pages?: number };
}

export interface ReaderPage {
  id: string;
  number: number;
  imageUrl: string;
  translatedUrl?: string | null;
  thumbUrl?: string | null;
  thumbW?: number | null;
  thumbH?: number | null;
}

export interface ChapterFull {
  id: string;
  seriesId: string;
  title?: string | null;
  chapterNum: number;
  views?: number;
  pages: ReaderPage[];
  series?: { id: string; title: string; slug: string } | null;
  prevChapter?: { id: string; chapterNum: number } | null;
  nextChapter?: { id: string; chapterNum: number } | null;
  translateJob?: TranslateJob | null;
}

export interface TranslateJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  progress: number;
  total: number;
  done: number;
  message?: string | null;
  error?: string | null;
  targetLang?: string;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user?: { username?: string } | null;
}

export interface Bookmark {
  id: string;
  seriesId: string;
  series: SeriesSummary;
}

/** Response of GET /api/series (paginated list). */
export interface SeriesListResult {
  data?: SeriesSummary[];
  series?: SeriesSummary[];
  total?: number;
  page?: number;
  pages?: number;
}

export const STATUS_COLOR: Record<string, string> = {
  ONGOING: 'text-green-400 bg-green-400/10',
  COMPLETED: 'text-blue-400 bg-blue-400/10',
  HIATUS: 'text-yellow-400 bg-yellow-400/10',
  DROPPED: 'text-red-400 bg-red-400/10',
};

export const STATUS_LABEL: Record<string, string> = {
  ONGOING: 'Ongoing',
  COMPLETED: 'Tamat',
  HIATUS: 'Hiatus',
  DROPPED: 'Drop',
};

export function statusBadgeClass(status?: string): string {
  return STATUS_COLOR[status || ''] || 'text-white/60 bg-white/10';
}

export function statusBadgeLabel(status?: string): string {
  return STATUS_LABEL[status || ''] || status || 'Unknown';
}

export function timeAgo(date: string | number | Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}d yang lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m yang lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j yang lalu`;
  return `${Math.floor(diff / 86400)} hari yang lalu`;
}
