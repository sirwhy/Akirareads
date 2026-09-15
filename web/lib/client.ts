'use client';

const API_URL = '/api';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

export async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(ADMIN_KEY ? { 'X-Admin-Key': ADMIN_KEY } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data as T;
}

export async function uploadForm<T = any>(endpoint: string, form: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(ADMIN_KEY ? { 'X-Admin-Key': ADMIN_KEY } : {}),
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload gagal');
  return data as T;
}

export const api = {
  // Auth
  register: (d: { email: string; username: string; password: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  login: (d: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(d) }),
  adminLogin: (d: { email: string; password: string }) =>
    request('/auth/admin/login', { method: 'POST', body: JSON.stringify(d) }),

  // User
  getMe: () => request('/users/me'),
  updateMe: (d: any) => request('/users/me', { method: 'PUT', body: JSON.stringify(d) }),
  changePassword: (d: any) => request('/users/me/password', { method: 'PUT', body: JSON.stringify(d) }),
  getMyBookmarks: () => request('/users/me/bookmarks'),
  toggleBookmark: (id: string) => request(`/users/me/bookmarks/${id}`, { method: 'POST' }),
  getAllUsers: (p: Record<string, string | number> = {}) =>
    request(`/users?${new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)]))}`),

  // Series
  getSeries: (p: Record<string, string | number> = {}) =>
    request(`/series?${new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)]))}`),
  getSeriesById: (id: string) => request(`/series/${id}`),
  getSeriesBySlug: (slug: string) => request(`/series/slug/${slug}`),
  getSeriesComments: (id: string) => request(`/series/${id}/comments`),
  postComment: (id: string, content: string) =>
    request(`/series/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  createSeries: (d: any) => request('/series', { method: 'POST', body: JSON.stringify(d) }),
  updateSeries: (id: string, d: any) => request(`/series/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteSeries: (id: string) => request(`/series/${id}`, { method: 'DELETE' }),

  // Chapters
  getChaptersBySeries: (seriesId: string) => request(`/chapters/series/${seriesId}`),
  getChapter: (id: string) => request(`/chapters/${id}`),
  createChapter: (d: any) => request('/chapters', { method: 'POST', body: JSON.stringify(d) }),
  updateChapter: (id: string, d: any) => request(`/chapters/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteChapter: (id: string) => request(`/chapters/${id}`, { method: 'DELETE' }),
  addChapterPages: (id: string, pages: string[]) =>
    request(`/chapters/${id}/pages`, { method: 'POST', body: JSON.stringify({ pages }) }),
  saveReadHistory: (id: string) => request(`/chapters/${id}/read`, { method: 'POST' }),

  // Settings / Ads
  getSettings: () => request('/settings'),
  updateSetting: (key: string, value: string) =>
    request('/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  getAds: (position?: string) => request(`/ads${position ? `?position=${position}` : ''}`),

  // Translate
  translateChapter: (chapterId: string, targetLang = 'id') =>
    request(`/translate/chapter/${chapterId}`, { method: 'POST', body: JSON.stringify({ targetLang }) }),
  translateJob: (id: string) => request(`/translate/job/${id}`),
  translateStatus: (chapterId: string) => request(`/translate/status/${chapterId}`),

  // Mirror
  mirrorCreate: (url: string, targetLang?: string) =>
    request('/mirror', { method: 'POST', body: JSON.stringify({ url, targetLang }) }),
  mirrorJobs: () => request('/mirror/jobs'),
  mirrorJob: (id: string) => request(`/mirror/job/${id}`),
  mirrorDelete: (id: string) => request(`/mirror/job/${id}`, { method: 'DELETE' }),

  // Browser import
  importBatch: (payload: any) => request('/import/batch', { method: 'POST', body: JSON.stringify(payload) }),
};
