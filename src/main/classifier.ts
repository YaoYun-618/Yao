import { CATEGORY_KEYWORDS } from '../shared/keywords';
import { UNCATEGORIZED_ID } from '../shared/types';

export function classifyApp(name: string): string {
  const lower = name.toLowerCase();
  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return categoryId;
    }
  }
  return UNCATEGORIZED_ID;
}