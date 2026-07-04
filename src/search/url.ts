import type { SearchResultItem } from "../types/plugin";

const LAYER_URL = 1; // L1 layer per spec

const URL_PATTERNS: { pattern: RegExp; normalize: (match: string) => string }[] = [
  {
    // http:// or https://
    pattern: /^(https?:\/\/)[^\s]+$/i,
    normalize: (m) => m,
  },
  {
    // www. prefix
    pattern: /^(www\.)[a-zA-Z0-9][-a-zA-Z0-9]*\.[^\s]+$/i,
    normalize: (m) => `https://${m}`,
  },
  {
    // domain.tld format (e.g., github.com, baidu.com)
    pattern: /^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(\/[^\s]*)?$/i,
    normalize: (m) => `https://${m}`,
  },
];

/**
 * Check if the input looks like a URL and return the normalized version.
 * Returns null if no match.
 */
export function matchUrl(query: string): SearchResultItem | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const { pattern, normalize } of URL_PATTERNS) {
    if (pattern.test(trimmed)) {
      const fullUrl = normalize(trimmed);

      // Validate that it looks like a proper URL
      try {
        new URL(fullUrl);
      } catch {
        return null;
      }

      // Determine display URL (shortened for long URLs)
      let displayUrl = trimmed;
      if (trimmed.length > 50) {
        displayUrl = trimmed.substring(0, 47) + "...";
      }

      return {
        id: `url-${trimmed}`,
        name: displayUrl,
        description: fullUrl,
        icon: "",
        type: "url",
        layer: LAYER_URL,
        score: 1,
      };
    }
  }

  return null;
}
