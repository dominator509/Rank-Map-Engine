export const API_KEY_SCOPES = ["read", "write"] as const;
export const DEFAULT_API_KEY_SCOPES = [...API_KEY_SCOPES];

type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const VALID_API_KEY_SCOPES = new Set<string>(API_KEY_SCOPES);
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function normalizeApiKeyScopes(
  value: unknown,
  options: { defaultWhenUndefined?: boolean; allowEmpty?: boolean } = {},
): string[] | null {
  if (value === undefined) {
    return options.defaultWhenUndefined ? DEFAULT_API_KEY_SCOPES : [];
  }

  if (!Array.isArray(value)) return null;

  const scopes = Array.from(new Set(value));
  if (!options.allowEmpty && scopes.length === 0) return null;

  if (
    !scopes.every(
      (scope): scope is ApiKeyScope => typeof scope === "string" && VALID_API_KEY_SCOPES.has(scope),
    )
  ) {
    return null;
  }

  return scopes;
}

export function apiKeyScopesAllowMethod(scopes: string[] | undefined, method: string): boolean {
  if (!scopes) return true;

  const normalizedScopes = normalizeApiKeyScopes(scopes, { allowEmpty: true });
  if (normalizedScopes === null) return false;
  if (normalizedScopes.length === 0) return true;

  const requiredScope = READ_METHODS.has(method.toUpperCase()) ? "read" : "write";
  return normalizedScopes.includes(requiredScope);
}
