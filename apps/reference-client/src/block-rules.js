export function normalizeNamePattern(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function findBlockedNamePattern(names = [], patterns = []) {
  const normalizedNames = names.map(normalizeNamePattern).filter(Boolean);
  return patterns.map(normalizeNamePattern).filter(Boolean).find((pattern) => normalizedNames.some((name) => name.includes(pattern))) ?? "";
}
