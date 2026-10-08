import { Easing } from 'remotion';

/** Shared craft tokens — motion-design + explainer style-system */
export const ENTER = Easing.bezier(0.22, 1, 0.36, 1);
export const EXIT = Easing.bezier(0.4, 0, 1, 1);

export const FOREST = '#3F6B4B';
export const CREAM = '#F7F1E8';
export const INK = '#1A1540';
export const ACCENT = '#5B4CDB';
export const MINT = '#77DDB7';
export const GOLD = '#F2C94C';

/** Bloom story line — keep Brand / How / Proof consistent */
export const BLOOM = {
  brand: 'Bloom',
  prompt: 'Pitch deck for Bloom, a plant-based coffee brand',
  slideTitle: 'A market moving',
  slideAccent: 'plant-based',
  bullets: ['Oat is a café default', 'Gen Z orders dairy-free', 'Premium RTD is growing'],
  thumbs: [
    { title: 'Meet Bloom', sub: 'Café texture, zero dairy', tone: FOREST },
    { title: 'A market moving', sub: 'plant-based', tone: ACCENT },
    { title: 'Barista-grade', sub: 'plant coffee', tone: FOREST },
    { title: 'Who buys Bloom', sub: '05 · CUSTOMERS', tone: '#E8A45A' },
  ],
} as const;
