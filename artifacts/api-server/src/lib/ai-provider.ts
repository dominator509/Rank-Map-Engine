import { logger } from "./logger.js";

export type AiProvider = "openai" | "mock";

function getProvider(): AiProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

export interface ClusterKeyword {
  phrase: string;
  id: number;
}

export interface ClusterResult {
  label: string;
  keywordIds: number[];
}

export async function clusterKeywordsWithAI(keywords: ClusterKeyword[]): Promise<ClusterResult[]> {
  const provider = getProvider();

  if (provider === "openai") {
    return clusterWithOpenAI(keywords);
  }

  return clusterWithMock(keywords);
}

async function clusterWithOpenAI(keywords: ClusterKeyword[]): Promise<ClusterResult[]> {
  const prompt = `You are an SEO expert. Group these keywords into topical clusters.
Return a JSON array of clusters, each with "label" (short topic name) and "keywordIds" (array of keyword IDs).
Be strategic: group by intent and topic, not just word match.

Keywords: ${JSON.stringify(keywords.map((k) => ({ id: k.id, phrase: k.phrase })))}

Return ONLY valid JSON, no explanation.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      throw new Error(`OpenAI API error: ${resp.status}`);
    }

    const data = (await resp.json()) as {
      choices: [{ message: { content: string } }];
    };
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content) as { clusters: ClusterResult[] } | ClusterResult[];
    const clusters = Array.isArray(parsed) ? parsed : parsed.clusters;

    return clusters.filter(
      (c): c is ClusterResult => typeof c.label === "string" && Array.isArray(c.keywordIds),
    );
  } catch (err) {
    logger.warn({ err }, "OpenAI clustering failed, falling back to mock");
    return clusterWithMock(keywords);
  }
}

function clusterWithMock(keywords: ClusterKeyword[]): ClusterResult[] {
  const groups = new Map<string, number[]>();

  for (const kw of keywords) {
    const words = kw.phrase.toLowerCase().split(/\s+/);
    const key = words[0] ?? "general";
    const existing = groups.get(key) ?? [];
    existing.push(kw.id);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([label, keywordIds]) => ({
    label,
    keywordIds,
  }));
}

export interface BriefSection {
  heading: string;
  notes: string;
}

export interface BriefOutline {
  sections: BriefSection[];
  targetWordCount: number;
  targetKeywords: string[];
}

export async function generateBriefWithAI(
  title: string,
  clusterLabel: string,
  keywords: string[],
): Promise<BriefOutline> {
  const provider = getProvider();

  if (provider === "openai") {
    return generateBriefWithOpenAI(title, clusterLabel, keywords);
  }

  return generateBriefMock(title, keywords);
}

async function generateBriefWithOpenAI(
  title: string,
  clusterLabel: string,
  keywords: string[],
): Promise<BriefOutline> {
  const prompt = `You are an SEO content strategist. Create a detailed content brief.

Title: "${title}"
Topic cluster: "${clusterLabel}"
Target keywords: ${keywords.slice(0, 20).join(", ")}

Return valid JSON matching this shape:
{
  "sections": [{ "heading": "string", "notes": "string" }],
  "targetWordCount": number,
  "targetKeywords": ["string"]
}

Include 4-6 sections. Be specific and actionable.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      throw new Error(`OpenAI API error: ${resp.status}`);
    }

    const data = (await resp.json()) as {
      choices: [{ message: { content: string } }];
    };
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content) as BriefOutline;

    if (!Array.isArray(parsed.sections)) throw new Error("Invalid outline shape");
    return parsed;
  } catch (err) {
    logger.warn({ err }, "OpenAI brief generation failed, falling back to mock");
    return generateBriefMock(title, keywords);
  }
}

function generateBriefMock(title: string, keywords: string[]): BriefOutline {
  return {
    sections: [
      {
        heading: "Introduction",
        notes: `Introduce the topic of "${title}" and why it matters for readers.`,
      },
      { heading: "Key Concepts", notes: "Define core terminology and foundational ideas." },
      {
        heading: "In-Depth Analysis",
        notes: "Deep-dive into subtopics with supporting data and examples.",
      },
      { heading: "Best Practices", notes: "Actionable tips and expert recommendations." },
      { heading: "Common Mistakes to Avoid", notes: "Address common pitfalls and misconceptions." },
      {
        heading: "Conclusion & Next Steps",
        notes: "Summarize key takeaways and include a clear call to action.",
      },
    ],
    targetWordCount: 1800,
    targetKeywords: keywords.slice(0, 5),
  };
}
