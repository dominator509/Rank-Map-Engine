export function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export function withinWhiteLabelLimits(value: unknown, maxDepth = 20, depth = 0): boolean {
  if (value === null) return true;
  if (typeof value !== "object") return true;
  if (depth >= maxDepth) return false;
  if (Array.isArray(value)) {
    return value.every((item) => withinWhiteLabelLimits(item, maxDepth, depth + 1));
  }
  return Object.values(value as Record<string, unknown>).every((child) =>
    withinWhiteLabelLimits(child, maxDepth, depth + 1),
  );
}
