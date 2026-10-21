import { natalSignTexts } from './natal-sign-texts.js';
import { natalHouseTexts } from './natal-house-texts.js';
import { natalAspectTexts } from './natal-aspect-texts.js';
import { natalAngleTexts } from './natal-angle-texts.js';
import { natalRetrogradeTexts, natalDignityTexts } from './natal-condition-texts.js';
import { natalSynthesisTexts, natalSynthesisContext, natalDistributionTexts, natalNarrativeTexts } from './natal-synthesis-texts.js';
import { natalBalanceTexts, natalBalanceEvenTexts } from './natal-balance-texts.js';

export { natalSignTexts, natalHouseTexts, natalAspectTexts, natalAngleTexts, natalRetrogradeTexts, natalDignityTexts, natalSynthesisTexts, natalSynthesisContext, natalDistributionTexts, natalNarrativeTexts, natalBalanceTexts, natalBalanceEvenTexts };

// Pares fonte/tradução vivem juntos para impedir divergência entre os lotes editoriais.
export function translationPairs(value) {
  if (Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'string')) return [value];
  return value && typeof value === 'object' ? Object.values(value).flatMap(translationPairs) : [];
}
export const natalTranslations = Object.fromEntries(translationPairs({ natalSignTexts, natalHouseTexts, natalAspectTexts, natalAngleTexts, natalRetrogradeTexts, natalDignityTexts, natalSynthesisTexts, natalSynthesisContext, natalDistributionTexts, natalNarrativeTexts, natalBalanceTexts, natalBalanceEvenTexts }));
