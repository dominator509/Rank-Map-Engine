import { logger } from "./logger.js";

export interface KeywordData {
  phrase: string;
  searchVolume?: number;
  cpc?: number;
  kd?: number;
  intent?: string;
}

export type AdapterProvider = "ahrefs" | "semrush" | "dataforseo" | "manual" | "csv";

const truthyPattern = /^(1|true|yes)$/i;

function isFeatureEnabled(name: string): boolean {
  return truthyPattern.test(process.env[name] ?? "");
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseOptionalPositiveDecimal(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+(?:\.\d+)?$/.test(value.trim())) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function fetchKeywordsFromProvider(
  provider: AdapterProvider,
  query: string,
  credentials: Record<string, string>,
): Promise<KeywordData[]> {
  switch (provider) {
    case "ahrefs":
      return fetchFromAhrefs(query, credentials);
    case "semrush":
      return fetchFromSEMrush(query, credentials);
    case "dataforseo":
      return fetchFromDataForSEO(query, credentials);
    default:
      return [];
  }
}

async function fetchFromAhrefs(
  query: string,
  credentials: Record<string, string>,
): Promise<KeywordData[]> {
  const apiKey = credentials.apiKey ?? process.env.AHREFS_API_KEY;
  if (!isFeatureEnabled("FEATURE_AHREFS_IMPORT") || !apiKey) {
    logger.warn("Ahrefs import disabled or AHREFS_API_KEY not set, returning mock data");
    return mockKeywordData(query, "ahrefs");
  }

  try {
    const url = new URL("https://api.ahrefs.com/v3/keywords-explorer/overview");
    url.searchParams.set("select", "keyword,volume,cpc,difficulty");
    url.searchParams.set("keywords", query);
    url.searchParams.set("country", "us");

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) throw new Error(`Ahrefs API error: ${resp.status}`);

    const data = (await resp.json()) as {
      keywords?: Array<{ keyword: string; volume: number; cpc: number; difficulty: number }>;
    };

    return (data.keywords ?? []).map((k) => ({
      phrase: k.keyword,
      searchVolume: k.volume,
      cpc: k.cpc,
      kd: k.difficulty,
    }));
  } catch (err) {
    logger.warn({ err }, "Ahrefs fetch failed, returning mock");
    return mockKeywordData(query, "ahrefs");
  }
}

async function fetchFromSEMrush(
  query: string,
  credentials: Record<string, string>,
): Promise<KeywordData[]> {
  const apiKey = credentials.apiKey ?? process.env.SEMRUSH_API_KEY;
  if (!isFeatureEnabled("FEATURE_SEMRUSH_IMPORT") || !apiKey) {
    logger.warn("Semrush import disabled or SEMRUSH_API_KEY not set, returning mock data");
    return mockKeywordData(query, "semrush");
  }

  if (!truthyPattern.test(process.env.ALLOW_SEMRUSH_QUERY_AUTH ?? "")) {
    logger.warn("SEMrush query-string API key auth is disabled, returning mock data");
    return mockKeywordData(query, "semrush");
  }

  try {
    const url = new URL("https://api.semrush.com/");
    url.searchParams.set("type", "phrase_related");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("phrase", query);
    url.searchParams.set("database", "us");
    url.searchParams.set("export_columns", "Ph,Nq,Cp,Kd");
    url.searchParams.set("display_limit", "50");

    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`SEMrush API error: ${resp.status}`);

    const text = await resp.text();
    const lines = text.trim().split("\n").slice(1);

    return lines
      .map((line) => {
        const [phrase, volume, cpc, kd] = line.split(";");
        return {
          phrase: phrase?.trim() ?? "",
          searchVolume: parseOptionalPositiveInteger(volume),
          cpc: parseOptionalPositiveDecimal(cpc),
          kd: parseOptionalPositiveInteger(kd),
        };
      })
      .filter((k) => k.phrase);
  } catch (err) {
    logger.warn({ err }, "SEMrush fetch failed, returning mock");
    return mockKeywordData(query, "semrush");
  }
}

async function fetchFromDataForSEO(
  query: string,
  credentials: Record<string, string>,
): Promise<KeywordData[]> {
  const login = credentials.login ?? process.env.DATAFORSEO_LOGIN;
  const password = credentials.password ?? process.env.DATAFORSEO_PASSWORD;

  if (!isFeatureEnabled("FEATURE_DATAFORSEO_IMPORT") || !login || !password) {
    logger.warn("DataForSEO import disabled or credentials not set, returning mock data");
    return mockKeywordData(query, "dataforseo");
  }

  try {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    const resp = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify([{ keywords: [query], location_code: 2840, language_code: "en" }]),
        signal: AbortSignal.timeout(20000),
      },
    );

    if (!resp.ok) throw new Error(`DataForSEO API error: ${resp.status}`);

    const data = (await resp.json()) as {
      tasks?: Array<{
        result?: Array<{
          keyword: string;
          search_volume: number;
          cpc: number;
          competition_index: number;
        }>;
      }>;
    };

    const results = data.tasks?.[0]?.result ?? [];
    return results.map((r) => ({
      phrase: r.keyword,
      searchVolume: r.search_volume,
      cpc: r.cpc,
      kd: Math.round(r.competition_index),
    }));
  } catch (err) {
    logger.warn({ err }, "DataForSEO fetch failed, returning mock");
    return mockKeywordData(query, "dataforseo");
  }
}

function mockKeywordData(query: string, source: string): KeywordData[] {
  const base = query.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return [
    { phrase: base, searchVolume: 2400, cpc: 1.2, kd: 45, intent: "informational" },
    { phrase: `best ${base}`, searchVolume: 1200, cpc: 2.1, kd: 52, intent: "commercial" },
    { phrase: `${base} guide`, searchVolume: 880, cpc: 0.8, kd: 38, intent: "informational" },
    { phrase: `${base} tool`, searchVolume: 720, cpc: 3.5, kd: 61, intent: "transactional" },
    { phrase: `how to ${base}`, searchVolume: 590, cpc: 0.6, kd: 35, intent: "informational" },
  ].map((k) => ({ ...k, source }));
}
