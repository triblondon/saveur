export function parseDurationSeconds(input: string): number | null {
  const text = input.toLowerCase();

  let totalSeconds = 0;
  let found = false;

  const hourMatch = text.match(/(\d+)\s*(hours?|hrs?|h)\b/);
  if (hourMatch) {
    totalSeconds += Number(hourMatch[1]) * 60 * 60;
    found = true;
  }

  const minuteMatch = text.match(/(\d+)\s*(minutes?|mins?|m)\b/);
  if (minuteMatch) {
    totalSeconds += Number(minuteMatch[1]) * 60;
    found = true;
  }

  const secondMatch = text.match(/(\d+)\s*(seconds?|secs?|s)\b/);
  if (secondMatch) {
    totalSeconds += Number(secondMatch[1]);
    found = true;
  }

  if (found && totalSeconds > 0) {
    return totalSeconds;
  }

  const compactMinMatch = text.match(/\b(\d{1,3})\s*min\b/);
  if (compactMinMatch) {
    return Number(compactMinMatch[1]) * 60;
  }

  return null;
}
