// MEASURES FEED — served at /ballot-atlas/measures.json
//
// A machine-readable projection of the measures collection: the same
// frontmatter Astro already validates at build time, emitted as JSON so
// that anything wanting to reason about CCTE's positions reads them
// exactly as they were authored.
//
// This is the same instinct as the JSON-LD in [measure].astro, one step
// further on. JSON-LD tells a search engine what a *page* is. This tells
// a consumer what the *collection* is: every measure the Atlas tracks,
// its stance, its recommendation, its FAQ and the sources it cites, in
// one request and without parsing a single tag of markup.
//
// The immediate consumer is the ThinkChristian social studio, which
// builds Instagram graphics for @ballotatlas from these records. Scraping
// the rendered pages would have worked until the first restyle; reading
// the collection cannot break that way, because if a field goes missing
// the build fails here rather than the graphic shipping wrong.
//
// Prerendered — no runtime cost, and it is a static asset like every
// other route.
//
// Stubs (article_ready: false) ARE included, deliberately. A consumer
// needs to know a measure exists and what the stance is even before the
// analysis is written; the flag says which is which, and the editorial
// fields are simply empty until they are not.

import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';

export const prerender = true;

const SITE = 'https://thinkchristian.com';
const BASE = '/ballot-atlas';

// Sources live as inline markdown links inside the rationale and the FAQ
// answers rather than in a separate field, because that is where a reader
// meets them. Pulling them out here means a consumer does not have to
// parse markdown to answer "what is this claim based on".
const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

function sourcesFrom(...blocks: string[]) {
  const seen = new Map<string, string>();
  for (const block of blocks) {
    for (const m of String(block || '').matchAll(LINK)) {
      const [, label, url] = m;
      // First label wins: the same document is often linked several times
      // with different anchor text, and the first is usually the fullest.
      if (!seen.has(url)) seen.set(url, label.trim());
    }
  }
  return [...seen].map(([url, label]) => ({ label, url }));
}

// "Sex & Gender • LGBTQ" is authored as one string because that is how it
// is set on the page. Consumers almost always want the parts.
const topicsFrom = (stance: string) =>
  String(stance || '')
    .split(/[•·|]/)
    .map((t) => t.trim())
    .filter(Boolean);

const isoDate = (d: Date) => new Date(d).toISOString().slice(0, 10);

export const GET: APIRoute = async () => {
  const measures = await getCollection('measures');

  const records = await Promise.all(
    measures.map(async (m) => {
      const [stateSlug, measureSlug] = m.id.split('/');
      const state = await getEntry('states', stateSlug);
      const d = m.data;

      return {
        id: m.id,
        // Absolute, because a consumer that has this JSON does not
        // necessarily know the base path or the trailing-slash rule.
        url: d.article_ready ? `${SITE}${BASE}/${stateSlug}/${measureSlug}` : null,
        state: { slug: stateSlug, name: state?.data.name ?? d.state, usps: state?.data.usps ?? null },
        ref: d.ref,
        title: d.title,
        date_on_ballot: isoDate(d.date_on_ballot),
        topics: topicsFrom(d.stance),
        recommendation: {
          type: d.recommendation_type,          // Support | Oppose | Caution | Discernment
          verb: d.recommendation_verb || null,  // "Vote Yes on Initiative 109" — absent for Caution/Discernment
        },
        excerpt: d.excerpt,
        bottom_line: d.bottom_line || null,
        rationale: d.recommendation_rationale || null,
        faq: d.faq.filter((f) => f.question && f.answer),
        sources: sourcesFrom(d.recommendation_rationale, ...d.faq.map((f) => f.answer)),
        author: d.author,
        last_reviewed: isoDate(d.last_reviewed),
        article_ready: d.article_ready,
      };
    })
  );

  // Sorted so the output is stable across builds: a feed whose order
  // churns produces a meaningless diff on every deploy.
  records.sort((a, b) =>
    a.state.slug.localeCompare(b.state.slug) || a.ref.localeCompare(b.ref)
  );

  return new Response(
    JSON.stringify(
      {
        version: 1,
        publisher: 'The Center for Christian Thought and Ethics',
        atlas: `${SITE}${BASE}`,
        count: records.length,
        ready: records.filter((r) => r.article_ready).length,
        measures: records,
      },
      null,
      2
    ),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Public and cacheable: it is a build artefact, and it changes
        // only when the site is rebuilt.
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};
