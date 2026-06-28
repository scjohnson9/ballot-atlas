// Content collections — the source of truth for every state and
// every ballot measure the Atlas covers. Astro validates frontmatter
// against these Zod schemas at build time, so a measure missing a
// recommendation or with the wrong stance enum will fail the build
// rather than ship as silently malformed.
//
// File conventions:
//   src/content/states/<state-slug>.md
//   src/content/measures/<state-slug>/<measure-slug>.md
//
// The folder structure is meaningful: the state slug in the measure's
// path drives the URL routing in src/pages/ballot-atlas/[state]/[measure].astro,
// so a typo in a folder name produces a routing mismatch the build will surface.

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The recommendation block is the editorial spine of every measure
// page. Type is a closed enum so the design system can theme each
// kind consistently. Verb is the imperative phrase rendered in
// display type at the top of the article; rationale is the supporting
// argument in 1–3 paragraphs.
//
// Note: rationale's minimum-length requirement is enforced conditionally
// at the measures collection level — only when article_ready is true.
// This lets editors save stubs (article_ready: false) with the
// rationale field still empty or in-progress.
const recommendation = z.object({
  type: z.enum(['Oppose', 'Support', 'Caution', 'Discernment']),
  verb: z.string().min(3).max(80),
  rationale: z.string().default(''),
});

// FAQ entries feed both an on-page FAQ section and the JSON-LD FAQPage
// schema embedded in the page head — the latter is what makes the
// questions eligible to appear in Google's "People Also Ask" boxes
// and to be cited by LLM assistants when answering related questions.
const faqEntry = z.object({
  question: z.string().min(8),
  answer: z.string().min(20),
});

const states = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/states' }),
  schema: z.object({
    name: z.string(),               // "Florida"
    usps: z.string().length(2),     // "FL" — used to mark map states gold
    summary: z.string().min(40),    // Intro paragraph shown on state page
    last_updated: z.coerce.date(),
  }),
});

const measures = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/measures' }),
  schema: z.object({
    // The state field is duplicated from the file's folder path so the
    // CMS can drive folder placement from a dropdown rather than asking
    // editors to navigate the folder tree. The folder path remains the
    // routing source of truth (see src/pages/[state]/[measure].astro),
    // but Zod validates that the frontmatter field is present.
    state: z.string(),
    title: z.string(),                       // "The Abortion Rights Amendment"
    ref: z.string(),                         // "Amendment 4"
    date_on_ballot: z.coerce.date(),
    excerpt: z.string().min(40).max(280),    // Shown in issue lists
    stance: z.string(),                      // "Life · The Unborn"
    // bottom_line is the quotable, AI-citation-friendly synopsis.
    // Required to appear within the first 100–200 words of the page.
    bottom_line: z.string().min(50).max(400),
    recommendation,
    faq: z.array(faqEntry).default([]),
    // article_ready gates whether this measure has a standalone detail
    // page. When false (the default for new entries), the measure
    // appears in the map's issue list and the state-page issue list
    // — as a non-clickable "Analysis in progress" stub — but no HTML
    // file is generated at /ballot-atlas/<state>/<slug>. Toggle to
    // true via the CMS when the rationale and FAQ are ready.
    article_ready: z.boolean().default(false),
    author: z.string().default('CCTE Editorial Team'),
    last_reviewed: z.coerce.date(),
  }).refine(
    // Conditional editorial quality gate. A measure being shown in
    // discovery lists is fine with the loose rationale/FAQ defaults,
    // but the moment you flip article_ready to true the build enforces
    // the full editorial bar on the two slow fields. Catches accidental
    // "publish before writing" before it ships.
    (m) => {
      if (!m.article_ready) return true;
      return m.recommendation.rationale.length >= 50 && m.faq.length >= 1;
    },
    {
      message:
        "When article_ready is true, recommendation.rationale must be at least 50 characters and faq must have at least one entry. Either complete those fields or set article_ready to false.",
      path: ['article_ready'],
    }
  ),
});

export const collections = { states, measures };
