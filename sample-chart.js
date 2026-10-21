// Mapa de exemplo do disco (testes e prévia sem dados): pessoa fictícia (Bento, 23/11/1984 21:40, Lisboa), posições do
// Astro-Seek truncadas ao minuto (fixtures/astro-seek-cases.json). Não é o mapa de nenhuma pessoa real.
export const ascendant = 123 + 4/60;
export const natalPlacements = {
  sun: { longitude: 241 + 47/60, degree: '1°47′', house: 5 },
  moon: { longitude: 254 + 26/60, degree: '14°26′', house: 5 },
  mercury: { longitude: 263 + 23/60, degree: '23°23′', house: 5 },
  venus: { longitude: 281 + 53/60, degree: '11°53′', house: 6 },
  mars: { longitude: 306 + 7/60, degree: '6°07′', house: 7 },
  jupiter: { longitude: 283 + 4/60, degree: '13°04′', house: 6 },
  saturn: { longitude: 230 + 34/60, degree: '20°34′', house: 4 },
  uranus: { longitude: 253 + 4/60, degree: '13°04′', house: 5 },
  neptune: { longitude: 270 + 4/60, degree: '0°04′', house: 5 },
  pluto: { longitude: 213 + 13/60, degree: '3°13′', house: 4 }
};
