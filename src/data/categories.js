/**
 * Trade categories. Slugs are the canonical keys used by Firestore documents,
 * URL query params, and TRADE_ICONS in src/lib/icons.js.
 */

export const CATEGORIES = [
  { slug: 'electrician', name: 'Electrician', hindi: 'बिजली मिस्त्री', typicalRate: 600 },
  { slug: 'plumber', name: 'Plumber', hindi: 'नल मिस्त्री', typicalRate: 550 },
  { slug: 'carpenter', name: 'Carpenter', hindi: 'बढ़ई', typicalRate: 700 },
  { slug: 'painter', name: 'Painter', hindi: 'पेंटर', typicalRate: 650 },
  { slug: 'mason', name: 'Mason', hindi: 'राजमिस्त्री', typicalRate: 800 },
  { slug: 'tailor', name: 'Tailor', hindi: 'दर्जी', typicalRate: 400 },
  { slug: 'photographer', name: 'Photographer', hindi: 'फोटोग्राफर', typicalRate: 3500 },
  { slug: 'video-editor', name: 'Video Editor', hindi: 'वीडियो एडिटर', typicalRate: 1500 },
  { slug: 'designer', name: 'Designer', hindi: 'डिज़ाइनर', typicalRate: 1200 },
  { slug: 'driver', name: 'Driver', hindi: 'ड्राइवर', typicalRate: 900 },
  { slug: 'cleaner', name: 'Cleaner', hindi: 'सफाई कर्मी', typicalRate: 500 },
  { slug: 'gardener', name: 'Gardener', hindi: 'माली', typicalRate: 450 },
];

export const CATEGORY_BY_SLUG = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
);

export function categoryName(slug) {
  return CATEGORY_BY_SLUG[slug]?.name ?? 'Other';
}

export const CITIES = [
  'Ayodhya',
  'Lucknow',
  'Kanpur',
  'Varanasi',
  'Prayagraj',
  'Gorakhpur',
  'Sirsa',
  'Delhi',
  'Noida',
  'Gurugram',
];
