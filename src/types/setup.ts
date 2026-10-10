/** The eight setup chapters, in order (journey §6.2). Plan 5 adds the pages and the setup state here. */
export const CHAPTER_IDS = ['welcome', 'about', 'health', 'medicines', 'backFeet', 'movement', 'food', 'day'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];
