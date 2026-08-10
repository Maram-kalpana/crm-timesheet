const API_URL = import.meta.env.VITE_API_URL || '/api';

// Strip a trailing /api (with or without slash) to get the bare server origin,
// since uploaded files are served from the server root, not under /api.
const SERVER_ORIGIN = API_URL.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

export const getFileUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_ORIGIN}${path}`;
};

export const getMapsUrl = (location) => {
  if (!location) return null;
  // location is stored as "lat,lng"
  if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(location.trim())) {
    return `https://www.google.com/maps?q=${location.trim()}`;
  }
  return null;
};