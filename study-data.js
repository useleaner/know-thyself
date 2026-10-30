// Study data, not the reference app's personal numerology.
// 11–32 is the hermetic key scale. Personal 1–22 markers remain a separate dataset.
import { t } from './i18n.js';
import { cabalaSphereTexts } from './cabala-sphere-texts.js';
import { cabalaStudyPathTexts } from './cabala-path-texts.js';
export const sources = [
  { label: t('Liber 777 · escalas e correspondências'), url: 'https://otohungary.org/documents/publication/english/Liber_DCCLXXVII.html' },
  { label: t('Book of Thoth · atribuições de Crowley'), url: 'https://www.tarrdaniel.com/documents/Thelemagick/publication/english/Book_of_Thoth.html' },
];

export const sphereStudy = {
  kether: { meaning: t('Coroa'), hebrew: 'כתר', correspondence: t('Primeiro Móvel · a esfera que move os demais céus'), symbol: '1', description: t(cabalaSphereTexts.kether.study[0]) },
  chokmah: { meaning: t('Sabedoria'), hebrew: 'חכמה', correspondence: t('Mazloth · Zodíaco e céu estrelado'), symbol: '2', description: t(cabalaSphereTexts.chokmah.study[0]) },
  binah: { meaning: t('Entendimento'), hebrew: 'בינה', correspondence: t('Saturno'), symbol: '♄', description: t(cabalaSphereTexts.binah.study[0]) },
  chesed: { meaning: t('Misericórdia'), hebrew: 'חסד', correspondence: t('Júpiter'), symbol: '♃', description: t(cabalaSphereTexts.chesed.study[0]) },
  geburah: { meaning: t('Rigor e força'), hebrew: 'גבורה', correspondence: t('Marte'), symbol: '♂', description: t(cabalaSphereTexts.geburah.study[0]) },
  tiphareth: { meaning: t('Beleza'), hebrew: 'תפארת', correspondence: t('Sol'), symbol: '☉', description: t(cabalaSphereTexts.tiphareth.study[0]) },
  netzach: { meaning: t('Vitória'), hebrew: 'נצח', correspondence: t('Vênus'), symbol: '♀', description: t(cabalaSphereTexts.netzach.study[0]) },
  hod: { meaning: t('Esplendor'), hebrew: 'הוד', correspondence: t('Mercúrio'), symbol: '☿', description: t(cabalaSphereTexts.hod.study[0]) },
  yesod: { meaning: t('Fundação'), hebrew: 'יסוד', correspondence: t('Lua'), symbol: '☽', description: t(cabalaSphereTexts.yesod.study[0]) },
  malkuth: { meaning: t('Reino'), hebrew: 'מלכות', correspondence: t('Esfera dos elementos · Terra'), symbol: '⊕', description: t(cabalaSphereTexts.malkuth.study[0]) },
};

const source = sources[0].url;
// Hex values interpret the named King-scale colours for this prototype; no
// source claims these exact screen values. He/Tzaddi follow Crowley/Thoth (He = Aquarius, Tzaddi = Aries).
export const paths = [
  { number: 11, from: 'kether', to: 'chokmah', letter: 'א', letterName: 'Aleph', thoth: t('O Louco'), attribution: t('Ar'), symbol: '🜁', color: '#e9e5a5', colorName: t('Amarelo pálido luminoso'), description: t(cabalaStudyPathTexts[11][0]), source },
  { number: 12, from: 'kether', to: 'binah', letter: 'ב', letterName: 'Beth', thoth: t('O Mago'), attribution: t('Mercúrio'), symbol: '☿', color: '#f0dc76', colorName: t('Amarelo'), description: t(cabalaStudyPathTexts[12][0]), source },
  { number: 13, from: 'kether', to: 'tiphareth', letter: 'ג', letterName: 'Gimel', thoth: t('A Sacerdotisa'), attribution: t('Lua'), symbol: '☽', color: '#759fe4', colorName: t('Azul'), description: t(cabalaStudyPathTexts[13][0]), source },
  { number: 14, from: 'chokmah', to: 'binah', letter: 'ד', letterName: 'Daleth', thoth: t('A Imperatriz'), attribution: t('Vênus'), symbol: '♀', color: '#66c998', colorName: t('Verde esmeralda'), description: t(cabalaStudyPathTexts[14][0]), source },
  { number: 15, from: 'chokmah', to: 'tiphareth', letter: 'ה', letterName: 'He', thoth: t('A Estrela'), attribution: t('Aquário'), symbol: '♒', color: '#7fb8e6', colorName: t('Azul-celeste'), description: t(cabalaStudyPathTexts[15][0]), source: sources[1].url },
  { number: 16, from: 'chokmah', to: 'chesed', letter: 'ו', letterName: 'Vau', thoth: t('O Hierofante'), attribution: t('Touro'), symbol: '♉', color: '#e99067', colorName: t('Vermelho alaranjado'), description: t(cabalaStudyPathTexts[16][0]), source },
  { number: 17, from: 'binah', to: 'tiphareth', letter: 'ז', letterName: 'Zayin', thoth: t('Os Amantes'), attribution: t('Gêmeos'), symbol: '♊', color: '#e7aa68', colorName: t('Laranja'), description: t(cabalaStudyPathTexts[17][0]), source },
  { number: 18, from: 'binah', to: 'geburah', letter: 'ח', letterName: 'Cheth', thoth: t('A Carruagem'), attribution: t('Câncer'), symbol: '♋', color: '#e5ba72', colorName: t('Âmbar'), description: t(cabalaStudyPathTexts[18][0]), source },
  { number: 19, from: 'chesed', to: 'geburah', letter: 'ט', letterName: 'Teth', thoth: t('Luxúria'), attribution: t('Leão'), symbol: '♌', color: '#d1d989', colorName: t('Amarelo esverdeado'), description: t(cabalaStudyPathTexts[19][0]), source },
  { number: 20, from: 'chesed', to: 'tiphareth', letter: 'י', letterName: 'Yod', thoth: t('O Eremita'), attribution: t('Virgem'), symbol: '♍', color: '#b6cc85', colorName: t('Verde amarelado'), description: t(cabalaStudyPathTexts[20][0]), source },
  { number: 21, from: 'chesed', to: 'netzach', letter: 'כ', letterName: 'Kaph', thoth: t('A Fortuna'), attribution: t('Júpiter'), symbol: '♃', color: '#b191df', colorName: t('Violeta'), description: t(cabalaStudyPathTexts[21][0]), source },
  { number: 22, from: 'geburah', to: 'tiphareth', letter: 'ל', letterName: 'Lamed', thoth: t('Ajuste'), attribution: t('Libra'), symbol: '♎', color: '#66c998', colorName: t('Verde esmeralda'), description: t(cabalaStudyPathTexts[22][0]), source },
  { number: 23, from: 'geburah', to: 'hod', letter: 'מ', letterName: 'Mem', thoth: t('O Enforcado'), attribution: t('Água'), symbol: '🜄', color: '#6489c9', colorName: t('Azul profundo'), description: t(cabalaStudyPathTexts[23][0]), source },
  { number: 24, from: 'tiphareth', to: 'netzach', letter: 'נ', letterName: 'Nun', thoth: t('A Morte'), attribution: t('Escorpião'), symbol: '♏', color: '#65b9b4', colorName: t('Azul esverdeado'), description: t(cabalaStudyPathTexts[24][0]), source },
  { number: 25, from: 'tiphareth', to: 'yesod', letter: 'ס', letterName: 'Samekh', thoth: t('Arte'), attribution: t('Sagitário'), symbol: '♐', color: '#759fe4', colorName: t('Azul'), description: t(cabalaStudyPathTexts[25][0]), source },
  { number: 26, from: 'tiphareth', to: 'hod', letter: 'ע', letterName: 'Ayin', thoth: t('O Diabo'), attribution: t('Capricórnio'), symbol: '♑', color: '#8e91d2', colorName: t('Índigo'), description: t(cabalaStudyPathTexts[26][0]), source },
  { number: 27, from: 'netzach', to: 'hod', letter: 'פ', letterName: 'Pe', thoth: t('A Torre'), attribution: t('Marte'), symbol: '♂', color: '#e77a87', colorName: t('Escarlate'), description: t(cabalaStudyPathTexts[27][0]), source },
  { number: 28, from: 'netzach', to: 'yesod', letter: 'צ', letterName: 'Tzaddi', thoth: t('O Imperador'), attribution: t('Áries'), symbol: '♈', color: '#e8704f', colorName: t('Vermelho escarlate'), description: t(cabalaStudyPathTexts[28][0]), source: sources[1].url },
  { number: 29, from: 'netzach', to: 'malkuth', letter: 'ק', letterName: 'Qoph', thoth: t('A Lua'), attribution: t('Peixes'), symbol: '♓', color: '#cb80b5', colorName: t('Carmesim ultravioleta'), description: t(cabalaStudyPathTexts[29][0]), source },
  { number: 30, from: 'hod', to: 'yesod', letter: 'ר', letterName: 'Resh', thoth: t('O Sol'), attribution: t('Sol'), symbol: '☉', color: '#e7aa68', colorName: t('Laranja'), description: t(cabalaStudyPathTexts[30][0]), source },
  { number: 31, from: 'hod', to: 'malkuth', letter: 'ש', letterName: 'Shin', thoth: t('O Éon'), attribution: t('Fogo'), symbol: '🜂', color: '#ee9477', colorName: t('Escarlate alaranjado luminoso'), description: t(cabalaStudyPathTexts[31][0]), source },
  { number: 32, from: 'yesod', to: 'malkuth', letter: 'ת', letterName: 'Tav', thoth: t('O Universo'), attribution: t('Saturno'), symbol: '♄', color: '#8e91d2', colorName: t('Índigo'), description: t(cabalaStudyPathTexts[32][0]), source },
];
