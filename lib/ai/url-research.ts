/**
 * URL research: actually fetch the site the user pointed at, extract hard
 * evidence (tech fingerprints, headers, page text), and optionally layer
 * Google-Search research on top.
 *
 * Before this existed, "URL analysis" only searched the web *about* the URL —
 * for any site that isn't famous that returned nothing and the model invented
 * a generic architecture. Fetching the live page grounds generation in facts.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// --- URL detection -----------------------------------------------------------

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;

/** Extract up to `max` unique http(s) URLs from free text (trailing punctuation stripped). */
export function extractUrls(text: string, max = 2): string[] {
  const seen = new Set<string>();
  for (const raw of text.match(URL_REGEX) ?? []) {
    const cleaned = raw.replace(/[.,;:!?]+$/, "");
    if (!seen.has(cleaned)) seen.add(cleaned);
    if (seen.size >= max) break;
  }
  return [...seen];
}

// --- SSRF guard ----------------------------------------------------------------

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe80") ||
    v6.startsWith("::ffff:127.") ||
    v6.startsWith("::ffff:10.") ||
    v6.startsWith("::ffff:169.254.") ||
    v6.startsWith("::ffff:192.168.")
  );
}

/** Throws unless the URL is public http(s) — blocks localhost, private ranges, metadata IPs. */
async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs can be analyzed");
  }

  const host = parsed.hostname;
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("URL resolves to a private address");
    return parsed;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("URL resolves to a private address");
  }

  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve ${host}`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error("URL resolves to a private address");
  }
  return parsed;
}

// --- Fetch + evidence extraction ------------------------------------------------

const MAX_HTML_CHARS = 600_000;
const MAX_TEXT_EXCERPT = 3_000;
const FETCH_TIMEOUT_MS = 10_000;

/** [pattern in HTML, technology it indicates] */
const HTML_FINGERPRINTS: Array<[RegExp, string]> = [
  [/__NEXT_DATA__|\/_next\//, "Next.js"],
  [/__NUXT__|\/_nuxt\//, "Nuxt (Vue)"],
  [/data-reactroot|react-dom(\.production)?(\.min)?\.js/, "React"],
  [/\bng-version=/, "Angular"],
  [/__sveltekit|data-sveltekit/i, "SvelteKit"],
  [/___gatsby/, "Gatsby"],
  [/data-turbo|turbo-frame|hotwired/, "Rails / Hotwire (likely)"],
  [/wp-content\/|wp-includes\//, "WordPress"],
  [/cdn\.shopify\.com|Shopify\.theme/, "Shopify"],
  [/website-files\.com|data-wf-site/, "Webflow"],
  [/static\.wixstatic\.com/, "Wix"],
  [/squarespace(-cdn)?\.com/, "Squarespace"],
  [/framerusercontent\.com/, "Framer"],
  [/js\.stripe\.com/, "Stripe payments"],
  [/cdn\.sanity\.io/, "Sanity CMS"],
  [/ctfassets\.net/, "Contentful CMS"],
  [/supabase\.co/, "Supabase"],
  [/firebaseapp\.com|firebaseio\.com/, "Firebase"],
  [/algolia(net)?\.com/, "Algolia search"],
  [/intercom(cdn)?\.io/, "Intercom"],
  [/segment\.com\/analytics\.js|cdn\.segment\.com/, "Segment analytics"],
];

/** [response header, value pattern, technology] */
const HEADER_FINGERPRINTS: Array<[string, RegExp, string]> = [
  ["x-vercel-id", /.+/, "Vercel hosting"],
  ["x-nextjs-cache", /.+/, "Next.js"],
  ["cf-ray", /.+/, "Cloudflare CDN"],
  ["x-amz-cf-id", /.+/, "AWS CloudFront"],
  ["x-served-by", /cache/i, "Fastly CDN"],
  ["x-shopify-stage", /.+/, "Shopify"],
  ["x-github-request-id", /.+/, "GitHub Pages"],
  ["server", /netlify/i, "Netlify hosting"],
  ["server", /cloudflare/i, "Cloudflare"],
  ["server", /awselb/i, "AWS ELB"],
  ["server", /nginx/i, "nginx"],
  ["x-powered-by", /express/i, "Express (Node.js)"],
  ["x-powered-by", /php/i, "PHP"],
  ["x-powered-by", /asp\.net/i, "ASP.NET"],
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|quot|#39|lt|gt);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchMeta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
    "i"
  );
  const m = html.match(re);
  return m ? (m[1] ?? m[2])?.trim() : undefined;
}

/** Fetch a public URL (SSRF-guarded, redirect-revalidated) and return an evidence brief. */
export async function fetchSiteEvidence(rawUrl: string): Promise<string> {
  try {
    // Follow up to 3 redirects, re-validating each hop against the SSRF guard.
    let current = rawUrl;
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      const parsed = await assertPublicUrl(current);
      res = await fetch(parsed.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SYPI-Analyzer/1.0)",
          Accept: "text/html,application/xhtml+xml,*/*",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) break;
        current = new URL(location, current).toString();
        continue;
      }
      break;
    }
    if (!res) throw new Error("No response");

    const detected = new Set<string>();
    const headerLines: string[] = [];
    for (const [header, pattern, tech] of HEADER_FINGERPRINTS) {
      const value = res.headers.get(header);
      if (value && pattern.test(value)) {
        detected.add(tech);
        headerLines.push(`${header}: ${value.slice(0, 80)}`);
      }
    }

    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    for (const [pattern, tech] of HTML_FINGERPRINTS) {
      if (pattern.test(html)) detected.add(tech);
    }

    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0, 200);
    const description = matchMeta(html, "description") ?? matchMeta(html, "og:description");
    const generator = matchMeta(html, "generator");
    if (generator) detected.add(`generator: ${generator}`);

    // Third-party script hosts hint at the service stack (analytics, payments, auth…).
    const scriptHosts = new Set<string>();
    for (const m of html.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi)) {
      try {
        scriptHosts.add(new URL(m[1]).hostname);
      } catch {
        /* skip malformed src */
      }
      if (scriptHosts.size >= 15) break;
    }

    const text = stripHtml(html).slice(0, MAX_TEXT_EXCERPT);

    return [
      `LIVE SITE EVIDENCE for ${rawUrl} (HTTP ${res.status}, fetched just now):`,
      title ? `- Page title: ${title}` : null,
      description ? `- Meta description: ${description.slice(0, 300)}` : null,
      detected.size > 0
        ? `- Detected technologies (from HTML/headers): ${[...detected].join(", ")}`
        : "- No framework fingerprints detected in the HTML (may be server-rendered with no client hints).",
      headerLines.length > 0 ? `- Notable response headers: ${headerLines.join(" | ")}` : null,
      scriptHosts.size > 0 ? `- Third-party script hosts: ${[...scriptHosts].join(", ")}` : null,
      text ? `- Visible page text (excerpt): ${text}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "fetch failed";
    return `Could not fetch ${rawUrl} directly (${reason}). Rely on web research only, and clearly mark every stack claim as INFERRED.`;
  }
}

// --- Search-grounded research (generation path) -----------------------------------

/**
 * Full research brief: live-fetch evidence + Google-Search research.
 * Always uses the platform Gemini key — Google Search grounding is Gemini-only.
 */
export async function researchSite(url: string): Promise<string> {
  const evidence = await fetchSiteEvidence(url);

  const googleProvider = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_API_KEY,
  });

  try {
    const research = await generateText({
      model: googleProvider(process.env.GEMINI_PRO_MODEL ?? "gemini-2.5-flash"),
      tools: { google_search: googleProvider.tools.googleSearch({}) },
      system: `You are a precise tech-stack researcher. You are given LIVE EVIDENCE fetched from the site moments ago — treat it as ground truth about what the product is and what technologies are observable. Use web search to add depth: engineering blogs, job listings, StackShare, conference talks.

Produce a factual research brief with three labeled sections:
1. WHAT THE PRODUCT DOES — from the live page text. Be concrete about its actual features.
2. OBSERVED STACK — only technologies present in the live evidence.
3. RESEARCHED/INFERRED STACK — from web sources (cite them) or reasonable inference for this product type. Label each item REPORTED (found in a source) or INFERRED (your judgment).

Never contradict the live evidence. Never present an inference as a fact.`,
      prompt: `${evidence}\n\nResearch the tech stack and system architecture behind: ${url}`,
    });
    return `${evidence}\n\nWEB RESEARCH:\n${research.text}`;
  } catch {
    // Search grounding unavailable (quota, key) — live evidence alone is still far
    // better than nothing.
    return evidence;
  }
}
