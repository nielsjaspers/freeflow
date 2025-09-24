export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function buildPreview(content) {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

export function formatRelativeTimestamp(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatFullTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `Updated ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} · ${date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}
