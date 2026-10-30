// RASCUNHOS para revisão do usuário: textos originais, simbólicos e não determinísticos.
// Não são conselho médico, financeiro ou psicológico. Montados a partir de fragmentos escritos à mão
// (função do planeta × estilo do signo × tema da casa), organizados por planeta.
import { t, lang } from './i18n.js';
export const DRAFT = true;

export const SIGNS = [t('Áries'), t('Touro'), t('Gêmeos'), t('Câncer'), t('Leão'), t('Virgem'), t('Libra'), t('Escorpião'), t('Sagitário'), t('Capricórnio'), t('Aquário'), t('Peixes')];

// domain: o que o planeta simboliza; ask: o que ele pede de nós; verb: como se move (3ª pessoa).
const P = {
  sun: { n: t('Sol'), domain: t('o centro da identidade e a vontade de brilhar'), ask: t('reconhecer o que dá sentido ao seu caminho'), verb: t('se afirma') },
  moon: { n: t('Lua'), domain: t('o mundo emocional e a necessidade de acolhimento'), ask: t('escutar o que faz você se sentir em casa'), verb: t('se sente segura') },
  mercury: { n: t('Mercúrio'), domain: t('a mente, a fala e a maneira de aprender'), ask: t('dar nome ao que você percebe'), verb: t('pensa e se comunica') },
  venus: { n: t('Vênus'), domain: t('o afeto, o gosto e o jeito de se relacionar'), ask: t('notar o que você valoriza de verdade'), verb: t('se aproxima e aprecia') },
  mars: { n: t('Marte'), domain: t('a ação, o desejo e a coragem de começar'), ask: t('direcionar sua energia com intenção'), verb: t('age e se defende') },
  jupiter: { n: t('Júpiter'), domain: t('a expansão, a confiança e a busca de sentido'), ask: t('cultivar generosidade sem perder a medida'), verb: t('cresce e acredita') },
  saturn: { n: t('Saturno'), domain: t('a estrutura, o tempo e a responsabilidade'), ask: t('construir com paciência o que merece durar'), verb: t('se organiza e se disciplina') },
  uranus: { n: t('Urano'), domain: t('a originalidade, a ruptura e a vontade de liberdade'), ask: t('abrir espaço para o novo sem romper por impulso'), verb: t('inova e se liberta') },
  neptune: { n: t('Netuno'), domain: t('a sensibilidade, a imaginação e o anseio de transcendência'), ask: t('distinguir sonho de fuga com gentileza'), verb: t('sonha e se dissolve') },
  pluto: { n: t('Plutão'), domain: t('a transformação profunda, o poder e os ciclos de renascimento'), ask: t('encarar o que precisa mudar com honestidade'), verb: t('transforma e se aprofunda') },
};

// style: tom do signo; gift: dom; care: ponto de atenção (sem julgamento).
const S = [
  { style: t('com ímpeto, franqueza e vontade de ir na frente'), gift: t('A coragem de iniciar é um recurso valioso aqui'), care: t('A pressa pode atropelar detalhes; respirar antes de agir ajuda a manter o fôlego.') },
  { style: t('com calma, constância e apego ao que é concreto'), gift: t('A firmeza e o prazer pelo que é sensorial dão base a essa energia'), care: t('O conforto pode virar resistência à mudança; vale perguntar o que ainda serve.') },
  { style: t('com curiosidade, leveza e muitas conexões ao mesmo tempo'), gift: t('A agilidade de ver vários lados abre portas e conversas'), care: t('A dispersão é possível; escolher um fio de cada vez pode trazer profundidade.') },
  { style: t('com sensibilidade, memória afetiva e instinto de cuidar'), gift: t('A empatia e o senso de pertencimento nutrem essa energia'), care: t('Tomar tudo de forma pessoal cansa; criar limites também é uma forma de cuidado.') },
  { style: t('com calor, criatividade e desejo de ser visto'), gift: t('A generosidade e o brilho próprio dão vida ao que você toca'), care: t('A busca por reconhecimento pode pesar; lembrar do prazer de criar ajuda a se sustentar por dentro.') },
  { style: t('com atenção aos detalhes, senso prático e vontade de aperfeiçoar'), gift: t('O discernimento e a utilidade concreta são pontos fortes'), care: t('A autocrítica pode ficar exigente demais; reconhecer o suficiente também é sabedoria.') },
  { style: t('com busca de equilíbrio, diplomacia e gosto pela harmonia'), gift: t('A sensibilidade para o outro favorece parcerias justas'), care: t('Evitar conflitos pode adiar decisões; dizer o que você pensa fortalece a relação.') },
  { style: t('com intensidade, profundidade e desejo de ir à raiz das coisas'), gift: t('A capacidade de atravessar o que é difícil traz força e verdade'), care: t('A desconfiança e o tudo-ou-nada podem isolar; confiar aos poucos amplia o alcance.') },
  { style: t('com otimismo, senso de aventura e fome de significado'), gift: t('A visão ampla e o entusiasmo inspiram horizontes maiores'), care: t('Promessas grandes pedem acompanhamento; ajustar a rota é parte do caminho.') },
  { style: t('com ambição, método e respeito pelo longo prazo'), gift: t('A persistência e a noção de responsabilidade sustentam projetos duradouros'), care: t('A seriedade excessiva pode endurecer; permitir pausas e leveza também constrói.') },
  { style: t('com independência, visão de futuro e olhar coletivo'), gift: t('A originalidade e o interesse pelo todo trazem ideias frescas'), care: t('O distanciamento pode parecer frieza; mostrar o que você sente aproxima as pessoas.') },
  { style: t('com intuição, compaixão e porosidade ao ambiente'), gift: t('A imaginação e a sensibilidade abrem acesso a camadas sutis'), care: t('Absorver o clima dos outros é fácil; momentos de recolhimento ajudam a se reencontrar.') },
];

// tema de cada casa (1..12) e uma sugestão de olhar.
const H = [
  null,
  { area: t('a identidade, o corpo e a forma de se apresentar'), look: t('Observe como as pessoas percebem sua primeira impressão e como você escolhe se mostrar.') },
  { area: t('os recursos, os valores e o senso de segurança'), look: t('Vale refletir sobre o que você considera valioso e como cuida do que tem.') },
  { area: t('a comunicação, os estudos e o convívio próximo'), look: t('Conversas do dia a dia e trocas com irmãos, vizinhos ou colegas podem ser espelhos úteis.') },
  { area: t('o lar, a família e as raízes'), look: t('A relação com o espaço onde você descansa e com a própria história pode ser fonte de força.') },
  { area: t('a criatividade, o prazer e o jogo'), look: t('Hobbies, romance e projetos autorais são lugares naturais para essa energia respirar.') },
  { area: t('a rotina, o trabalho cotidiano e o cuidado de si'), look: t('Pequenos hábitos repetidos costumam revelar muito sobre como essa energia se organiza.') },
  { area: t('as parcerias, o casamento e os acordos'), look: t('O outro funciona como espelho; perceba o que você busca e o que projeta nas relações.') },
  { area: t('as intimidades, os vínculos profundos e as transformações'), look: t('Temas de confiança, partilha e recomeço podem pedir atenção cuidadosa e, se necessário, apoio profissional.') },
  { area: t('as viagens, as crenças e a busca de sentido'), look: t('Estudos, deslocamentos e filosofias de vida ampliam o repertório desta energia.') },
  { area: t('a carreira, a vocação e a imagem pública'), look: t('Pense no legado que você deseja construir e no ritmo que sustenta esse caminho.') },
  { area: t('as amizades, os grupos e os projetos de futuro'), look: t('Comunidades e causas compartilhadas podem ser um campo fértil para o que você deseja.') },
  { area: t('o recolhimento, a vida interior e o que está nos bastidores'), look: t('Silêncio, descanso e práticas contemplativas ajudam a escutar o que não aparece de imediato.') },
];

export const planetInSign = {};
export const planetInHouse = {};
for (const [key, p] of Object.entries(P)) {
  planetInSign[key] = SIGNS.map((sign, i) =>
    t('{planet} em {sign} sugere que {domain} se expressam {style}. {gift}. {care}', { planet: p.n, sign, domain: p.domain, style: S[i].style, gift: S[i].gift, care: S[i].care }));
  planetInHouse[key] = {};
  for (let h = 1; h <= 12; h++) {
    planetInHouse[key][h] =
      t('Na Casa {house}, {planet} leva {domain} para {area}. {look} Aqui, a proposta simbólica é {ask}.', { house: h, planet: p.n, domain: p.domain, area: H[h].area, look: H[h].look, ask: p.ask });
  }
}

const aspectSources = language => ({
  conjunction: t('A conjunção funde duas energias no mesmo ponto do céu, reforçando-as e tornando difícil separá-las. Pode ser vivida como um tema intenso e concentrado.', undefined, language),
  opposition: t('A oposição coloca duas energias frente a frente, como os extremos de uma gangorra. Convida a perceber os dois lados e buscar um ponto de equilíbrio entre eles.', undefined, language),
  trine: t('O trígono liga duas energias em harmonia, com fluxo natural entre elas. Costuma indicar facilidade que vale cultivar com intenção para não ficar apenas no automático.', undefined, language),
  square: t('O quadrado cria tensão entre duas energias que puxam direções diferentes. Simbolicamente, essa fricção pode motivar movimento e crescimento quando é reconhecida.', undefined, language),
  sextile: t('O sextil conecta duas energias de forma cooperativa, como uma oportunidade que se abre quando há iniciativa. Pede um pequeno passo para que o potencial se realize.', undefined, language),
});

export const aspect = aspectSources(lang);

const aspectPhrases = language => ({
  conjunction: [t('se fundem', undefined, language), t('estão unidos', undefined, language)],
  opposition: [t('se opõem', undefined, language), t('ficam frente a frente', undefined, language)],
  trine: [t('dialogam em harmonia', undefined, language), t('fluem juntos', undefined, language)],
  square: [t('entram em tensão', undefined, language), t('puxam direções diferentes', undefined, language)],
  sextile: [t('cooperam', undefined, language), t('se conectam com facilidade', undefined, language)],
});

export function aspectText(kind, fromName, toName, context = 'natal', language = lang) {
  const base = aspectSources(language)[kind];
  if (!base) return '';
  const ph = aspectPhrases(language)[kind];
  const lead = {
    natal: t('No mapa natal, {from} e {to} {phrase}.', { from: fromName, to: toName, phrase: ph[0] }, language),
    transit: t('Neste trânsito, {from} no céu atual e {to} do mapa natal {phrase}, tema que pode ficar em evidência por um período.', { from: fromName, to: toName, phrase: ph[0] }, language),
    synastry: t('Na comparação entre dois mapas, {from} de uma pessoa e {to} da outra {phrase}.', { from: fromName, to: toName, phrase: ph[1] }, language),
  }[context] ?? t('{from} e {to} {phrase}.', { from: fromName, to: toName, phrase: ph[0] }, language);
  return `${lead} ${base}`;
}

// Dignidades. Tradicionais (Ptolomeu/Lilly, Christian Astrology, 1647): domicílio, exaltação, exílio, queda.
// Modernos: Urano, Netuno e Plutão usam apenas regência moderna (domicílio e exílio oposto);
// sem exaltação/queda, que variam demais entre autores. Os sete clássicos usam só regências tradicionais.
// Índices de signo: 0=Áries … 11=Peixes.
const DIGNITY = {
  sun: { dom: [4], exa: [0], det: [10], fall: [6] },
  moon: { dom: [3], exa: [1], det: [9], fall: [7] },
  mercury: { dom: [2, 5], exa: [5], det: [8, 11], fall: [11] },
  venus: { dom: [1, 6], exa: [11], det: [7, 0], fall: [5] },
  mars: { dom: [0, 7], exa: [9], det: [6, 1], fall: [3] },
  jupiter: { dom: [8, 11], exa: [3], det: [2, 5], fall: [9] },
  saturn: { dom: [9, 10], exa: [6], det: [3, 4], fall: [0] },
  uranus: { dom: [10], exa: [], det: [4], fall: [] },
  neptune: { dom: [11], exa: [], det: [5], fall: [] },
  pluto: { dom: [7], exa: [], det: [1], fall: [] },
};

export function influence(planet, sign) {
  const d = DIGNITY[planet];
  if (!d) return t('neutra');
  if (d.dom.includes(sign) || d.exa.includes(sign)) return t('forte');
  if (d.det.includes(sign) || d.fall.includes(sign)) return t('fraca');
  return t('neutra');
}

export function dignities(planet, sign) {
  const entry = DIGNITY[planet];
  return entry ? ['dom', 'exa', 'det', 'fall'].filter(kind => entry[kind].includes(sign)) : [];
}

export const balance = {
  fogo: {
    excess: t('Fogo em abundância destaca entusiasmo, iniciativa e vontade de viver intensamente. Pode ser útil dosar o ritmo e deixar espaço para a escuta, para que o impulso não consuma a si mesmo.'),
    lack: t('Pouco Fogo sugere que iniciar e se expor podem pedir mais intenção. Atividades que despertem entusiasmo e pequenos atos de coragem ajudam a acender essa chama no seu tempo.'),
  },
  terra: {
    excess: t('Terra em abundância destaca praticidade, constância e apreço pelo concreto. Reservar espaço para o imprevisto e a imaginação pode trazer leveza a uma base já sólida.'),
    lack: t('Pouca Terra sugere que rotina, materialização e cuidado com o corpo podem pedir atenção extra. Passos pequenos e regulares costumam ajudar a dar chão às ideias.'),
  },
  ar: {
    excess: t('Ar em abundância coloca a troca de ideias no centro da experiência. Comparar pontos de vista, estudar e explicar o que você percebe podem ser formas de se aproximar das pessoas. A análise ajuda a organizar possibilidades, mas também pode prolongar a preparação antes de agir. Experimente dar uma aplicação concreta a uma ideia por vez. Nas relações, abrir espaço para o que é sentido, mesmo quando ainda não há uma explicação clara, amplia essa capacidade de compreender.'),
    lack: t('Pouco Ar sugere que distanciar-se das emoções e conversar sobre elas pode pedir prática. Escrever, estudar e trocar com outras pessoas ajuda a abrir perspectivas.'),
  },
  agua: {
    excess: t('Água em abundância destaca sensibilidade, empatia e profundidade emocional. Delimitar o que é seu e o que é do ambiente pode ajudar a navegar essa riqueza com mais serenidade.'),
    lack: t('Pouca Água sugere que reconhecer e nomear sentimentos pode pedir mais atenção. Momentos de pausa, arte e conversas sinceras ajudam a dar voz ao mundo interior.'),
  },
  cardinal: {
    excess: t('Qualidade Cardinal em abundância destaca iniciativa e a vontade de começar coisas novas. Acompanhar o que foi iniciado até o fim pode transformar muitos começos em conquistas.'),
    lack: t('Pouca Cardinalidade sugere que dar o primeiro passo pode exigir mais impulso consciente. Definir um começo pequeno e claro costuma facilitar o movimento.'),
  },
  fixa: {
    excess: t('Qualidade Fixa em abundância favorece sustentar uma escolha ao longo do tempo. Você pode investir bastante em vínculos, valores e projetos que considera importantes, oferecendo continuidade quando o entusiasmo inicial passa. Essa firmeza também pode tornar uma mudança de direção mais custosa. Rever um acordo ou experimentar outro caminho não apaga o que foi construído: pode ser uma maneira de preservar o propósito enquanto a forma se transforma.'),
    lack: t('Pouca Fixidez sugere que manter o foco e sustentar compromissos pode pedir estrutura externa. Rituais e metas simples ajudam a dar continuidade ao que importa.'),
  },
  mutavel: {
    excess: t('Qualidade Mutável em abundância destaca flexibilidade, adaptação e abertura a mudanças. Escolher prioridades pode evitar que tanta versatilidade se espalhe demais.'),
    lack: t('Pouca Mutabilidade pode tornar as transições mais exigentes. Quando uma situação muda, abandonar um plano conhecido e improvisar outro pode pedir tempo. Isso não significa ausência de criatividade: a adaptação pode aparecer com mais facilidade quando há espaço para testar, errar e revisar sem pressa. Em vez de mudar tudo de uma vez, tente uma pequena alternativa e observe o resultado antes de decidir o próximo passo.'),
  },
  masculina: {
    excess: t('A polaridade masculina, associada aos signos de Fogo e Ar, enfatiza a iniciativa e o contato com o mundo exterior. Fazer, propor e conversar podem surgir antes de uma pausa para perceber o que a experiência despertou. Nas relações, encontrar uma solução rapidamente nem sempre substitui escutar o que a outra pessoa precisa. Alternar ação com receptividade dá espaço às duas formas de participar. Aqui, masculina descreve uma polaridade simbólica, não gênero ou maturidade emocional.'),
    lack: t('Pouca polaridade masculina (Fogo e Ar) sugere que se projetar, decidir e se expor podem pedir mais intenção. Pequenos gestos de iniciativa fortalecem esse lado.'),
  },
  feminina: {
    excess: t('Polaridade feminina (signos de Terra e Água) em abundância destaca receptividade, cuidado e interiorização. Abrir espaço para a ação e a exposição pode equilibrar essa escuta profunda.'),
    lack: t('Pouca polaridade feminina (Terra e Água) sugere que acolher, esperar e sentir podem pedir mais prática. Pausas e atenção ao corpo ajudam a cultivar esse lado.'),
  },
};
