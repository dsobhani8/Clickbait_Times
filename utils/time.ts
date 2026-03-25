export function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h ago` : `${hours}h ${remainder}m ago`;
}

