/**
 * Every info page's copy, by slug. Edit the copy in the files here; the
 * pages (app/info/[page].tsx) and their links follow.
 */
import { about } from './about';
import { ai } from './ai';
import { faq } from './faq';
import { privacy } from './privacy';
import { taxDisclaimer } from './tax-disclaimer';
import { terms } from './terms';
import type { InfoPage, InfoPageSlug } from './types';

export type { Block, InfoPage, InfoPageSlug, Section } from './types';

export const INFO_PAGES: Record<InfoPageSlug, InfoPage> = {
  privacy,
  terms,
  ai,
  'tax-disclaimer': taxDisclaimer,
  faq,
  about,
};

/** The route for an info page. Works signed in or out. */
export const infoPageHref = (slug: InfoPageSlug) => `/info/${slug}` as const;
