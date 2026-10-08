/**
 * 无 LLM 的 URL 正文抽取：检测提示词中的链接 → fetch HTML → 去噪抽正文 → 注入 brief。
 * 链路：Tavily extract → 直连抓页 → Jina Reader 兜底。
 * 反爬空壳页会明确报错，避免当成「可读正文」。
 */

export type ExtractedPage = {
  url: string;
  title: string;
  text: string;
  provider: 'fetch' | 'tavily' | 'jina' | 'failed';
  error?: string;
};

export type UrlExtractResult = {
  urls: string[];
  pages: ExtractedPage[];
  briefBlock: string;
  /** 当作文稿进旁白驱动 */
  docTexts: { name: string; text: string }[];
};

const URL_RE = /https?:\/\/[^\s<>"'）】\]]+/gi;
const MAX_URLS = 3;
const MAX_CHARS = 10_000;
const MIN_TEXT = 80;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export function extractUrlsFromText(raw: string): string[] {
  const found = raw.match(URL_RE) || [];
  const cleaned = found.map((u) => u.replace(/[.,;:!?。，；：！？]+$/u, ''));
  const uniq: string[] = [];
  for (const u of cleaned) {
    try {
      const parsed = new URL(u);
      if (!/^https?:$/i.test(parsed.protocol)) continue;
      if (uniq.includes(parsed.href)) continue;
      uniq.push(parsed.href);
    } catch {
      /* skip */
    }
    if (uniq.length >= MAX_URLS) break;
  }
  return uniq;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** 常见 WAF / JS 挑战页：几乎只有混淆脚本，没有正文 */
function looksLikeChallenge(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed.length < 200) return false;
  const hasArg1 = /var\s+arg1\s*=/.test(html);
  const scriptHeavy =
    (html.match(/<script[\s\S]*?<\/script>/gi) || []).join('').length > trimmed.length * 0.7;
  const noBodyText = !/<p[\s>]|<article[\s>]|<main[\s>]/i.test(html);
  return hasArg1 || (scriptHeavy && noBodyText);
}

function metaFallback(html: string): string {
  const parts: string[] = [];
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  ) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const ogDesc = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  ) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle?.[1]) parts.push(decodeEntities(ogTitle[1]));
  if (ogDesc?.[1]) parts.push(decodeEntities(ogDesc[1]));
  else if (desc?.[1]) parts.push(decodeEntities(desc[1]));

  const ldBlocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  ) || [];
  for (const block of ldBlocks) {
    const raw = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      for (const n of nodes) {
        const body = String(n?.articleBody || n?.text || n?.description || '').trim();
        if (body.length >= 40) parts.push(body);
        const name = String(n?.headline || n?.name || '').trim();
        if (name) parts.push(name);
      }
    } catch {
      /* skip */
    }
  }
  return parts.join('\n\n').trim();
}

function stripHtmlToText(html: string): { title: string; text: string } {
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? decodeEntities(titleM[1].replace(/\s+/g, ' ').trim()) : '';

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const articleM =
    body.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || body.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    || body.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (articleM) body = articleM[1];

  body = body
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  let text = decodeEntities(body)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (text.length < MIN_TEXT) {
    const meta = metaFallback(html);
    if (meta.length > text.length) text = meta;
  }

  return { title, text: text.slice(0, MAX_CHARS) };
}

async function tavilyExtract(url: string, apiKey?: string): Promise<ExtractedPage | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  else headers['X-Tavily-Access-Mode'] = 'keyless';

  const res = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers,
    body: JSON.stringify({ urls: [url] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ url?: string; title?: string; raw_content?: string; content?: string }>;
    failed_results?: Array<{ url?: string; error?: string }>;
  };
  const hit = (data.results || [])[0];
  const text = String(hit?.raw_content || hit?.content || '').trim().slice(0, MAX_CHARS);
  if (!text || text.length < MIN_TEXT) return null;
  return {
    url,
    title: String(hit?.title || '').trim() || url,
    text,
    provider: 'tavily',
  };
}

async function fetchExtract(url: string): Promise<ExtractedPage> {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': BROWSER_UA,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(18_000),
  });
  if (!res.ok) {
    return { url, title: '', text: '', provider: 'failed', error: `HTTP ${res.status}` };
  }
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('application/pdf')) {
    return { url, title: '', text: '', provider: 'failed', error: 'pdf not supported in URL extract' };
  }
  const html = await res.text();
  if (looksLikeChallenge(html)) {
    return {
      url,
      title: '',
      text: '',
      provider: 'failed',
      error: 'anti-bot challenge page (site blocks plain fetch)',
    };
  }
  const { title, text } = stripHtmlToText(html);
  if (!text || text.length < MIN_TEXT) {
    return { url, title, text: '', provider: 'failed', error: 'too little text' };
  }
  return { url, title: title || url, text, provider: 'fetch' };
}

/** Jina Reader：把页面转成可读 Markdown（外网可达时有效） */
async function jinaExtract(url: string): Promise<ExtractedPage | null> {
  const endpoints = [
    `https://r.jina.ai/${url}`,
    `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, '')}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          Accept: 'text/plain,text/markdown,*/*',
          'User-Agent': BROWSER_UA,
          'X-Return-Format': 'markdown',
        },
        signal: AbortSignal.timeout(22_000),
      });
      if (!res.ok) continue;
      const raw = (await res.text()).trim();
      if (raw.length < MIN_TEXT) continue;
      const titleM = raw.match(/^Title:\s*(.+)$/m);
      const title = titleM?.[1]?.trim() || url;
      // 去掉 Jina 元数据头，保留正文
      const body = raw
        .replace(/^Title:.*$/m, '')
        .replace(/^URL Source:.*$/m, '')
        .replace(/^Published Time:.*$/m, '')
        .replace(/^Markdown Content:\s*/m, '')
        .trim()
        .slice(0, MAX_CHARS);
      if (body.length < MIN_TEXT) continue;
      return { url, title, text: body, provider: 'jina' };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function extractOne(url: string, apiKey?: string): Promise<ExtractedPage> {
  try {
    const viaTavily = await tavilyExtract(url, apiKey);
    if (viaTavily) return viaTavily;
  } catch {
    /* fall through */
  }

  let fetchResult: ExtractedPage | null = null;
  try {
    fetchResult = await fetchExtract(url);
    if (fetchResult.text) return fetchResult;
  } catch (e) {
    fetchResult = {
      url,
      title: '',
      text: '',
      provider: 'failed',
      error: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    const viaJina = await jinaExtract(url);
    if (viaJina) return viaJina;
  } catch {
    /* fall through */
  }

  return (
    fetchResult || {
      url,
      title: '',
      text: '',
      provider: 'failed',
      error: 'extract failed',
    }
  );
}

function formatBriefBlock(pages: ExtractedPage[]): string {
  const ok = pages.filter((p) => p.text);
  if (!ok.length) {
    const errs = pages.map((p) => `- ${p.url}: ${p.error || 'empty'}`).join('\n');
    return [
      'URL EXTRACT (enabled but no usable page text — do NOT invent page contents):',
      errs,
      'ACTION: ask user to paste the article body into the prompt, or upload a .txt/.md/.pdf attachment.',
    ].join('\n');
  }
  const parts = ok.map((p, i) => {
    return [
      `--- USER PAGE ${i + 1}: ${p.title} ---`,
      `URL: ${p.url}`,
      `Provider: ${p.provider}`,
      p.text.slice(0, 3500),
    ].join('\n');
  });
  return [
    'URL EXTRACT RESULTS (page body from linked URLs — ground VO / facts / structure on this; do not invent conflicting claims):',
    ...parts,
  ].join('\n\n').slice(0, 12_000);
}

/** 提示词含链接时调用；无需大模型 */
export async function runUrlExtract(opts: {
  prompt: string;
  apiKey?: string;
}): Promise<UrlExtractResult> {
  const urls = extractUrlsFromText(opts.prompt);
  if (!urls.length) {
    return { urls: [], pages: [], briefBlock: '', docTexts: [] };
  }

  const pages: ExtractedPage[] = [];
  for (const url of urls) {
    pages.push(await extractOne(url, opts.apiKey));
  }

  const docTexts = pages
    .filter((p) => p.text)
    .map((p, i) => ({
      name: `url-${i + 1}-${(p.title || 'page').slice(0, 40)}.txt`,
      text: `${p.title}\n${p.url}\n\n${p.text}`,
    }));

  return {
    urls,
    pages,
    briefBlock: formatBriefBlock(pages),
    docTexts,
  };
}
