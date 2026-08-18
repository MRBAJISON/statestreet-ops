import { describe, expect, it } from 'vitest';
import { matchReference, normaliseReferenceName } from './import-catalog';

// The eleven Woodpeckers categories, with Tracksuits still carrying the old
// streetwear-sets code — renaming the display name deliberately left codes alone.
const categories = [
  { id: 1, code: 'accessories', name: 'Accessories' },
  { id: 2, code: 'bags-wallets', name: 'Bags & Wallets' },
  { id: 3, code: 'footwear', name: 'Footwear' },
  { id: 4, code: 'headwear', name: 'Headwear' },
  { id: 5, code: 'hoodies-sweatshirts', name: 'Hoodies & Sweatshirts' },
  { id: 6, code: 'jersey', name: 'Jersey' },
  { id: 7, code: 'pants-shorts', name: 'Pants & Shorts' },
  { id: 8, code: 'premium-t-shirts', name: 'Premium T-Shirts' },
  { id: 9, code: 'shirts', name: 'Shirts' },
  { id: 10, code: 'tops-tees', name: 'Tops & Tees' },
  { id: 11, code: 'streetwear-sets', name: 'Tracksuits' },
];

const idFor = (value: string) => matchReference(categories, value)?.id;

describe('catalogue category matching', () => {
  it('matches the exact name', () => {
    expect(idFor('Bags & Wallets')).toBe(2);
    expect(idFor('Premium T-Shirts')).toBe(8);
  });

  it('ignores case and surrounding space', () => {
    expect(idFor('  premium t-shirts  ')).toBe(8);
    expect(idFor('FOOTWEAR')).toBe(3);
  });

  it('treats an ampersand and the word "and" as the same thing', () => {
    expect(idFor('Bags and Wallets')).toBe(2);
    expect(idFor('Hoodies and Sweatshirts')).toBe(5);
    expect(idFor('Pants and Shorts')).toBe(7);
  });

  it('ignores hyphens and punctuation differences', () => {
    expect(idFor('Premium T Shirts')).toBe(8);
    expect(idFor('Tops and Tees')).toBe(10);
    expect(idFor('pants-shorts')).toBe(7);
  });

  it('matches the code as well as the name', () => {
    expect(idFor('bags-wallets')).toBe(2);
    expect(idFor('hoodies sweatshirts')).toBe(5);
  });

  it('matches Tracksuits by its display name even though the code still says streetwear', () => {
    expect(idFor('Tracksuits')).toBe(11);
    expect(idFor('streetwear-sets')).toBe(11);
    // The plural is what the business uses; the singular is a plausible typo and
    // genuinely does not match, which the row error now names explicitly.
    expect(idFor('Tracksuit')).toBeUndefined();
  });

  it('returns nothing for a blank or unknown category', () => {
    expect(idFor('')).toBeUndefined();
    expect(idFor('   ')).toBeUndefined();
    expect(idFor('Luxury Suits')).toBeUndefined();
  });

  it('reduces a name to its meaningful words', () => {
    expect(normaliseReferenceName('Bags & Wallets')).toBe('bags wallets');
    expect(normaliseReferenceName('bags-wallets')).toBe('bags wallets');
    expect(normaliseReferenceName('Premium T-Shirts')).toBe('premium t shirts');
  });
});
