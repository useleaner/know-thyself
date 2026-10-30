import { t } from './i18n.js';

// Conversão observada no app de referência. Não é a tabela PT25 do manual.
export const CABALA_ALPHABETS = {
  pt: ['ABCDEFGHI', 'JLMNOPQRS', 'TUVXZ'],
  en: ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ']
};
// Recorte sustentado pelos casos de 2008 e 2009; ampliar somente com observações externas.
export const cabalaAlphabetFor = (language, birthDate) => language === 'pt' && String(birthDate) < '2009-01-01' ? CABALA_ALPHABETS.pt : CABALA_ALPHABETS.en;

export function normalizeCabala(input, birthDate) {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(t('Confira os dados da Cabala.'));
  if (typeof input.language !== 'string' || !Object.hasOwn(CABALA_ALPHABETS, input.language)) throw new Error(t('Escolha o idioma de origem para a Cabala.'));
  // Ler o cadastro preserva nomes já salvos; calcular exige letras da tabela aplicável.
  const table = birthDate ? cabalaAlphabetFor(input.language, birthDate) : CABALA_ALPHABETS.en;
  if (!['paternal-first', 'maternal-first'].includes(input.order)) throw new Error(t('Indique qual sobrenome vem primeiro no nome de nascimento.'));
  const parts = {};
  for (const key of ['firstNames', 'paternalSurname', 'maternalSurname']) {
    const text = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!text || text.length > 120) throw new Error(t('Preencha os três nomes da Cabala, com até 120 caracteres cada.'));
    const word = text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[\s'’.-]/g, '');
    if (!word || [...word].some(char => !table.some(row => row.includes(char)))) {
      throw new Error(t('Um dos nomes contém caracteres fora do alfabeto escolhido. Confira a grafia e o idioma de origem.'));
    }
    parts[key] = text;
  }
  return { ...parts, language: input.language, order: input.order };
}
