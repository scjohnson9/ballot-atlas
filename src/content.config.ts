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
// path drives the URL routing in src/pages/[state]/[measure].astro,
// so a typo in a folder name produces a routing mismatch the build
// will surface.

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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

// Measures schema — flattened so each field's section in the CMS form
// corresponds 1:1 with where the field actually appears on the site.
//
// Issue-list fields (top section of the CMS form): state, title, ref,
// date_on_ballot, excerpt, stance, recommendation_type. These show
// on the map panel and on the state-page issue list.
//
// Standalone article fields (below the article_ready toggle): bottom_line,
// recommendation_verb, recommendation_rationale, faq, author,
// last_reviewed, body. These only appear on the detail page at
// /ballot-atlas/<state>/<slug>.
//
// The recommendation was originally nested as one object. Splitting it
// flat lets recommendation_type sit cleanly in the issue-list section
// while recommendation_verb and recommendation_rationale sit in the
// standalone section — matching where each one actually surfaces.
const measures = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/measures' }),
  schema: z.object({
    // The state field is duplicated from the file's folder path so the
    // CMS can drive folder placement from a dropdown rather than asking
    // editors to navigate the folder tree. The folder path remains the
    // routing source of truth (see src/pages/[state]/[measure].astro).
    state: z.string(),
    title: z.string(),
    ref: z.string(),
    date_on_ballot: z.coerce.date(),
    excerpt: z.string().min(40).max(280),
    stance: z.string(),
    // recommendation_type drives both the at-a-glance ◆ chip in the
    // issue list AND the eyebrow on the standalone recommendation block.
    // Required for every measure (even stubs) because the chip needs it.
    recommendation_type: z.enum(['Oppose', 'Support', 'Caution', 'Discernment']),

    // article_ready gates whether this measure has a standalone detail
    // page. False (default) → measure appears in lists as a non-clickable
    // "Analysis in progress" stub. True → standalone page is built.
    article_ready: z.boolean().default(false),

    bottom_line: z.string().min(50).max(400),
    recommendation_verb: z.string().min(3).max(80),
    // Loose by default so stubs can be saved with rationale empty or
    // in-progress. The 50-char minimum is enforced conditionally below
    // when article_ready is true.
    recommendation_rationale: z.string().default(''),
    faq: z.array(faqEntry).default([]),
    author: z.string().default('CCTE Editorial Team'),
    last_reviewed: z.coerce.date(),
  }).refine(
    // Conditional editorial quality gate. Stubs are fine with the loose
    // rationale/FAQ defaults; once article_ready flips on, the build
    // enforces the full editorial bar on the two slow fields. Catches
    // accidental "publish before writing" before it ships.
    (m) => {
      if (!m.article_ready) return true;
      return m.recommendation_rationale.length >= 50 && m.faq.length >= 1;
    },
    {
      message:
        "When article_ready is true, recommendation_rationale must be at least 50 characters and faq must have at least one entry. Either complete those fields or set article_ready to false.",
      path: ['article_ready'],
    }
  ),
});

export const collections = { states, measures };
