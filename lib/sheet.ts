const CACHE_TTL_MS = 60_000;

let cachedFaq: string | null = null;
let cacheExpiresAt = 0;

export async function getFaq(): Promise<string> {
  if (cachedFaq && Date.now() < cacheExpiresAt) {
    return cachedFaq;
  }

  const url = process.env.SHEET_CSV_URL;
  if (!url) {
    return cachedFaq ?? "";
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const csv = await res.text();
    cachedFaq = csv;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return csv;
  } catch (err) {
    console.error("[sheet] fetch error:", err);
    return cachedFaq ?? "";
  }
}
