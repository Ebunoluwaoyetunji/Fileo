/**
 * The shape of every info page's copy (content/legal/*.ts). Screens never
 * hold copy: edit the text in those files and the pages follow.
 */

/** Another info page, by its slug (see index.ts). */
export type InfoPageSlug = 'privacy' | 'terms' | 'ai' | 'tax-disclaimer' | 'faq' | 'about';

/** A paragraph, a bulleted list, or a row of links. */
export type Block =
  | string
  | { bullets: string[] }
  | { links: { label: string; page?: InfoPageSlug; url?: string }[] };

export type Section = { heading: string; body: Block[] };

export type InfoPage = {
  title: string;
  /** e.g. "2 October 2026". Update it when the copy changes. */
  lastUpdated?: string;
  intro: string;
  /** Shows the early-testing note at the top (when SHOW_TESTING_NOTICE). */
  testingNotice?: boolean;
  sections: Section[];
  /** Expandable question rows (Help / FAQ). */
  questions?: { question: string; answer: Block[] }[];
};
