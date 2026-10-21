import { cabalaSphereTexts } from './cabala-sphere-texts.js';
import { cabalaStudyPathTexts, cabalaPersonalPathTexts, cabalaLineTexts } from './cabala-path-texts.js';
import { translationPairs } from './natal-catalog.js';
export { cabalaSphereTexts, cabalaStudyPathTexts, cabalaPersonalPathTexts, cabalaLineTexts };
export const cabalaTranslations = Object.fromEntries(translationPairs({ cabalaSphereTexts, cabalaStudyPathTexts, cabalaPersonalPathTexts, cabalaLineTexts }));
