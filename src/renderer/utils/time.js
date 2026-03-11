export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
  const hours = Math.floor(safeSeconds / 3600);
  if (hours > 0) {
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
