/**
 * ReturnWise High-Quality SEO Content Guides Index (src/content/guides/index.ts)
 * Exports all 5 original, in-depth merchant guides with realistic scenarios, exact formulas,
 * legal compliance notices, and CTAs.
 */

import { smartstoreReturnGuide, type GuideContent } from './smartstoreReturnGuide';
import { coupangAbandonGuide } from './coupangAbandonGuide';
import { partialRefundLawGuide } from './partialRefundLawGuide';
import { exchangeShippingGuide } from './exchangeShippingGuide';
import { reverseMarginGuide } from './reverseMarginGuide';

export type { GuideContent };

export const allGuides: GuideContent[] = [
  smartstoreReturnGuide,
  coupangAbandonGuide,
  partialRefundLawGuide,
  exchangeShippingGuide,
  reverseMarginGuide,
];

export function getGuideBySlug(slug: string): GuideContent | undefined {
  return allGuides.find((g) => g.slug === slug);
}

export function getGuideById(id: string): GuideContent | undefined {
  return allGuides.find((g) => g.id === id);
}
