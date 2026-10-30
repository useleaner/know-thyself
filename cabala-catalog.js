import { cabalaSphereTexts } from './cabala-sphere-texts.js';
import { cabalaStudyPathTexts, cabalaPersonalPathTexts, cabalaLineTexts } from './cabala-path-texts.js';
import { cabalaLearningTexts } from './cabala-learning-texts.js';
import { translationPairs } from './natal-catalog.js';
export { cabalaLearningTexts, cabalaSphereTexts, cabalaStudyPathTexts, cabalaPersonalPathTexts, cabalaLineTexts };
export const cabalaTranslations = Object.fromEntries(translationPairs({ cabalaLearningTexts, cabalaSphereTexts, cabalaStudyPathTexts, cabalaPersonalPathTexts, cabalaLineTexts }));
