export type SourceCapabilities = { browse: boolean; search: boolean; resolve: boolean; import: boolean };

export type SongSourceProvider = {
  id: string;
  label: string;
  capabilities: SourceCapabilities;
  searchURL(query: string): string;
  browseURL(): string;
};

export const ultimateGuitarSource: SongSourceProvider = {
  id: "ultimate-guitar",
  label: "Ultimate Guitar",
  capabilities: { browse: true, search: true, resolve: true, import: false },
  searchURL: (query) => `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`,
  browseURL: () => "https://www.ultimate-guitar.com/",
};

export function isUltimateGuitarURL(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "ultimate-guitar.com" || host.endsWith(".ultimate-guitar.com");
  } catch {
    return false;
  }
}
