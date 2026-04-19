const API_URL   = process.env.REACT_APP_API_URL  || 'http://localhost:5000/api';
const ADMIN_KEY = process.env.REACT_APP_ADMIN_KEY || '';
const getToken  = () => localStorage.getItem('token');

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token     ? { Authorization: `Bearer ${token}` } : {}),
    ...(ADMIN_KEY ? { 'X-Admin-Key': ADMIN_KEY } : {}),
    ...options.headers,
  };
  const res  = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

async function uploadFile(endpoint, formData) {
  const token = getToken();
  const res   = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...(token     ? { Authorization: `Bearer ${token}` } : {}),
      ...(ADMIN_KEY ? { 'X-Admin-Key': ADMIN_KEY } : {}),
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload gagal');
  return data;
}

const api = {
  // Auth
  register:            (d) => request('/auth/register',              { method: 'POST', body: JSON.stringify(d) }),
  login:               (d) => request('/auth/login',                 { method: 'POST', body: JSON.stringify(d) }),
  adminLogin:          (d) => request('/auth/admin/login',           { method: 'POST', body: JSON.stringify(d) }),
  adminRegister:       (d) => request('/auth/admin/register',        { method: 'POST', body: JSON.stringify(d) }),
  adminChangePassword: (d) => request('/auth/admin/change-password', { method: 'PUT',  body: JSON.stringify(d) }),

  // User
  getMe:          ()    => request('/users/me'),
  updateMe:       (d)   => request('/users/me',           { method: 'PUT',    body: JSON.stringify(d) }),
  changePassword: (d)   => request('/users/me/password',  { method: 'PUT',    body: JSON.stringify(d) }),
  getMyBookmarks: ()    => request('/users/me/bookmarks'),
  toggleBookmark: (id)  => request(`/users/me/bookmarks/${id}`, { method: 'POST' }),
  getAllUsers:     (p={})=> request(`/users?${new URLSearchParams(p)}`),

  // Series
  getSeries:        (p={})  => request(`/series?${new URLSearchParams(p)}`),
  getSeriesById:    (id)    => request(`/series/${id}`),
  getSeriesBySlug:  (slug)  => request(`/series/slug/${slug}`),
  getSeriesComments:(id)    => request(`/series/${id}/comments`),
  postComment:      (id, c) => request(`/series/${id}/comments`, { method: 'POST', body: JSON.stringify({ content: c }) }),
  createSeries:     (d)     => request('/series',       { method: 'POST',   body: JSON.stringify(d) }),
  updateSeries:     (id, d) => request(`/series/${id}`, { method: 'PUT',    body: JSON.stringify(d) }),
  deleteSeries:     (id)    => request(`/series/${id}`, { method: 'DELETE' }),

  // Chapters
  getChaptersBySeries: (sid)    => request(`/chapters/series/${sid}`),
  getChapter:          (id)     => request(`/chapters/${id}`),
  saveReadHistory:     (id)     => request(`/chapters/${id}/read`, { method: 'POST' }),
  createChapter:       (d)      => request('/chapters',       { method: 'POST',   body: JSON.stringify(d) }),
  updateChapter:       (id, d)  => request(`/chapters/${id}`, { method: 'PUT',    body: JSON.stringify(d) }),
  deleteChapter:       (id)     => request(`/chapters/${id}`, { method: 'DELETE' }),
  addPages:            (id, pg) => request(`/chapters/${id}/pages`, { method: 'POST', body: JSON.stringify({ pages: pg }) }),

  // Admin
  getAdminStats:    ()     => request('/admin/stats'),
  getAdminSeries:   (p={}) => request(`/admin/series?${new URLSearchParams(p)}`),
  getAdminChapters: (p={}) => request(`/admin/chapters?${new URLSearchParams(p)}`),
  deleteComment:    (id)   => request(`/admin/comments/${id}`, { method: 'DELETE' }),

  // Ads
  getAds:    (pos) => request(`/ads${pos ? `?position=${pos}` : ''}`),
  getAllAds:  ()   => request('/ads/all'),
  createAd:  (d)   => request('/ads',       { method: 'POST',   body: JSON.stringify(d) }),
  updateAd:  (id, d)=> request(`/ads/${id}`,{ method: 'PUT',    body: JSON.stringify(d) }),
  deleteAd:  (id)  => request(`/ads/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings:    () => request('/settings'),
  updateSettings: (d)=> request('/settings', { method: 'PUT', body: JSON.stringify(d) }),

  // Mirror
  startMirror:     (url)  => request('/mirror',       { method: 'POST', body: JSON.stringify({ url }) }),
  startBulkMirror: (urls) => request('/mirror/bulk',  { method: 'POST', body: JSON.stringify({ urls }) }),
  getMirrorJobs:   ()     => request('/mirror'),
  getMirrorJob:    (id)   => request(`/mirror/${id}`),
  deleteMirrorJob: (id)   => request(`/mirror/${id}`, { method:'DELETE' }),
  getMirrorBookmarklet: (site) => request(`/mirror/bookmarklet?site=${site}`),

  // Upload
  uploadImage:  (file)  => { const fd = new FormData(); fd.append('image', file);                              return uploadFile('/upload/image',  fd); },
  uploadImages: (files) => { const fd = new FormData(); Array.from(files).forEach(f => fd.append('images', f)); return uploadFile('/upload/images', fd); },
};

export default api;
