/**
 * Normalize time control to standard format
 * Accepts strings like "60+0", "1+1", "3 mins", "30s", "30 sec"
 * Returns normalized formats like "1 min", "1|1", "3 min", "10 min"
 */
const DEFAULT_CONTROL = '10 min';
const MIN_SECONDS = 60;

const toMinutesString = (seconds: number): string => {
  const minutes = Math.max(1, Math.round(seconds / MIN_SECONDS));
  return `${minutes} min`;
};

export function normalizeTimeControl(timeControl: string): string {
  if (!timeControl) return DEFAULT_CONTROL;

  let raw = `${timeControl}`.toLowerCase().trim();

  raw = raw
    .replace(/minutes?/g, 'min')
    .replace(/mins?/g, 'min')
    .replace(/secs?/g, 's')
    .replace(/seconds?/g, 's')
    .replace(/\s+/g, ' ');

  const clockMatch = raw.match(/^(\d+):(\d{1,2})$/);
  if (clockMatch) {
    const seconds = parseInt(clockMatch[1], 10) * 60 + parseInt(clockMatch[2], 10);
    return seconds < MIN_SECONDS ? '1 min' : toMinutesString(seconds);
  }

  if (raw.includes('+')) {
    const [baseStr, incStr] = raw.split('+');
    const baseSeconds = parseInt(baseStr, 10);
    const increment = parseInt(incStr, 10);

    if (Number.isNaN(baseSeconds) || Number.isNaN(increment)) {
      return DEFAULT_CONTROL;
    }

    if (baseSeconds < MIN_SECONDS) {
      return increment === 0 ? '1 min' : `1|${increment}`;
    }

    const minutes = Math.max(1, Math.round(baseSeconds / MIN_SECONDS));
    return increment === 0 ? `${minutes} min` : `${minutes}|${increment}`;
  }

  if (raw.includes('|')) {
    const pipeMatch = raw.match(/^(\d+)\s*\|\s*(\d+)$/);
    if (pipeMatch) {
      const baseMinutes = Math.max(1, parseInt(pipeMatch[1], 10));
      const increment = parseInt(pipeMatch[2], 10);
      return `${baseMinutes}|${increment}`;
    }
  }

  const secondsOnly = raw.match(/^(\d+)\s*s?$/);
  if (secondsOnly) {
    const seconds = parseInt(secondsOnly[1], 10);
    return seconds < MIN_SECONDS ? '1 min' : toMinutesString(seconds);
  }

  const minutesOnly = raw.match(/^(\d+)\s*min$/);
  if (minutesOnly) {
    const minutes = Math.max(1, parseInt(minutesOnly[1], 10));
    return `${minutes} min`;
  }

  const shortMinutes = raw.match(/^(\d+)\s*m$/);
  if (shortMinutes) {
    const minutes = Math.max(1, parseInt(shortMinutes[1], 10));
    return `${minutes} min`;
  }

  return DEFAULT_CONTROL;
}

/**
 * Get game format (Bullet/Blitz/Rapid) based on time control
 */
export const getGameFormat = (timeControl: string): 'Bullet' | 'Blitz' | 'Rapid' => {
  const normalized = normalizeTimeControl(timeControl);

  const pipeMatch = normalized.match(/^(\d+)\|(\d+)$/);
  if (pipeMatch) {
    const baseMinutes = parseInt(pipeMatch[1], 10);
    if (baseMinutes <= 2) return 'Bullet';
    if (baseMinutes <= 9) return 'Blitz';
    return 'Rapid';
  }

  const minuteMatch = normalized.match(/^(\d+)\s*min$/);
  const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 10;

  if (minutes <= 2) return 'Bullet';
  if (minutes <= 9) return 'Blitz';
  return 'Rapid';
};

export const parseTimeControl = (timeControl: string): { baseSeconds: number; incrementSeconds: number } => {
  const normalized = normalizeTimeControl(timeControl);
  const pipeMatch = normalized.match(/^(\d+)\|(\d+)$/);

  if (pipeMatch) {
    const minutes = Math.max(1, parseInt(pipeMatch[1], 10));
    const incrementSeconds = Math.max(0, parseInt(pipeMatch[2], 10));
    return { baseSeconds: minutes * 60, incrementSeconds };
  }

  const minuteMatch = normalized.match(/^(\d+)\s*min$/);
  const minutes = minuteMatch ? Math.max(1, parseInt(minuteMatch[1], 10)) : 10;

  return { baseSeconds: minutes * 60, incrementSeconds: 0 };
};
