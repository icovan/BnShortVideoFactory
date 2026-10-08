/**
 * 真实网页检索：优先 Tavily（settings/env key 或 keyless），失败回退 DuckDuckGo Instant Answer。
 * 结果写成可注入 brief 的事实块，供后续 optimize / skillPlan / codegen 使用。
 */

export type WebHit = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResult = {
  query: string;
  provider: 'tavily' | 'duckduckgo' | 'none';
  hits: WebHit[];
  /** 注入 machine/audience 前的原文块 */
  briefBlock: string;
};

function stripUserPackNoise(raw: string): string {
  return raw
    .split(/\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      return !/^(画面增效|Craft floor|形态|Form:|Design reference|Screen assets|User music|Source docs|Web search|Auto SFX|No voice-over|Voice-over|Script-drive)/i.test(
        t,
      );
    })
    .join('\n')
    .trim()
    .slice(0, 280);
}

async function tavilySearch(query: string, apiKey?: string): Promise<WebHit[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  else headers['X-Tavily-Access-Mode'] = 'keyless';

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      max_results: 5,
      search_depth: 'basic',
      include_answer: false,
    }),
    signal: AbortSignal.timeout(18_000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; snippet?: string }>;
  };
  return (data.results || [])
    .map((r) => ({
      title: String(r.title || '').trim(),
      url: String(r.url || '').trim(),
      snippet: String(r.content || r.snippet || '').trim().slice(0, 420),
    }))
    .filter((h) => h.title || h.snippet)
    .slice(0, 5);
}

async function duckDuckGoSearch(query: string): Promise<WebHit[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`ddg ${res.status}`);
  const data = (await res.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: unknown[] }>;
    Results?: Array<{ Text?: string; FirstURL?: string }>;
  };
  const hits: WebHit[] = [];
  if (data.AbstractText) {
    hits.push({
      title: data.Heading || query,
      url: data.AbstractURL || '',
      snippet: data.AbstractText.slice(0, 420),
    });
  }
  for (const r of data.Results || []) {
    if (r.Text) hits.push({ title: r.Text.slice(0, 80), url: r.FirstURL || '', snippet: r.Text.slice(0, 420) });
  }
  for (const r of data.RelatedTopics || []) {
    if (r.Text) hits.push({ title: r.Text.slice(0, 80), url: r.FirstURL || '', snippet: r.Text.slice(0, 420) });
    if (hits.length >= 5) break;
  }
  return hits.slice(0, 5);
}

function formatBriefBlock(query: string, provider: string, hits: WebHit[]): string {
  if (!hits.length) {
    return [
      'WEB SEARCH (enabled but no usable hits — do NOT invent citations or pretend you browsed):',
      `Query: ${query}`,
    ].join('\n');
  }
  const lines = hits.map((h, i) => {
    const src = h.url ? ` · ${h.url}` : '';
    return `[${i + 1}] ${h.title}${src}\n${h.snippet}`;
  });
  return [
    'WEB SEARCH RESULTS (verified snippets — ground facts / numbers / product claims on these; cite lightly on-screen if needed; do NOT fabricate sources beyond this list):',
    `Provider: ${provider}`,
    `Query: ${query}`,
    ...lines,
  ].join('\n');
}

export async function runWebSearch(opts: {
  prompt: string;
  apiKey?: string;
}): Promise<WebSearchResult> {
  const query = stripUserPackNoise(opts.prompt) || opts.prompt.trim().slice(0, 280);
  if (!query) {
    return { query: '', provider: 'none', hits: [], briefBlock: '' };
  }

  const key = (opts.apiKey || process.env.TAVILY_API_KEY || process.env.WEB_SEARCH_API_KEY || '').trim();

  try {
    const hits = await tavilySearch(query, key || undefined);
    if (hits.length) {
      return {
        query,
        provider: 'tavily',
        hits,
        briefBlock: formatBriefBlock(query, 'tavily', hits),
      };
    }
  } catch {
    /* fall through */
  }

  try {
    const hits = await duckDuckGoSearch(query);
    return {
      query,
      provider: hits.length ? 'duckduckgo' : 'none',
      hits,
      briefBlock: formatBriefBlock(query, 'duckduckgo', hits),
    };
  } catch {
    return {
      query,
      provider: 'none',
      hits: [],
      briefBlock: formatBriefBlock(query, 'none', []),
    };
  }
}
