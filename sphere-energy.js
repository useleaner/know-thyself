// Authorial reflections; only three exact cases were observed in the supplied personal tree.
import { t } from './i18n.js';
import { cabalaSphereTexts } from './cabala-sphere-texts.js';
const reflections = Object.fromEntries(Object.entries(cabalaSphereTexts).map(([id, item]) => [id, {
  title: t(item.title[0]), paragraphs: item.personal.map(pair => t(pair[0]))
}]));

// These readings describe the observed case, not numerical thresholds or a birth-data calculation.
export const observedSphereReadings = {
  'chokmah:8/4': {
    title: t('Sabedoria em destaque'),
    paragraphs: [
      t('A leitura de Chokmah na sua árvore destaca independência, confiança na própria percepção e disposição para seguir uma direção. Você pode reconhecer esse impulso quando uma ideia chega com clareza e logo desperta vontade de colocá-la em movimento.'),
      t('O ponto de atenção é dar tempo para que as outras pessoas acompanhem seu raciocínio. Uma ideia pode parecer evidente para você e ainda precisar de explicação, escuta e um teste concreto para ganhar espaço no mundo.'),
      t('Use essa iniciativa para abrir possibilidades, sem exigir que a primeira visão já seja a resposta final.')
    ]
  },
  'binah:8/4': {
    title: t('Compreensão e estrutura em destaque'),
    paragraphs: [
      t('A leitura de Binah na sua árvore enfatiza análise, responsabilidade e persistência. Você pode reconhecer essa força na vontade de entender o que acontece ao redor e de dar consistência àquilo com que se compromete.'),
      t('Dar forma a uma ideia ajuda a realizá-la; tentar prever tudo pode adiar a experiência. Permita que um plano seja ajustado conforme você aprende e observe quando o senso de dever começa a ocupar o espaço da curiosidade.'),
      t('Escolha uma estrutura que apoie seu próximo passo e deixe uma parte aberta para descobrir fazendo.')
    ]
  },
  'tiphareth:5/8': {
    title: t('Fortalecer a expressão de quem você é'),
    paragraphs: [
      t('A leitura de Tiphareth na sua árvore chama atenção para a expressão do seu próprio eu. Em algumas situações, você pode se colocar em segundo plano ou deixar que outras pessoas definam o que merece aparecer.'),
      t('O desenvolvimento aqui passa por reconhecer seu valor e dar presença às suas escolhas, sem esperar uma aprovação completa. Expresse uma preferência, sustente uma opinião com cuidado e reconheça uma contribuição sua que costuma minimizar.'),
      t('Isso não reduz quem você é a uma falta. É um convite para ocupar seu lugar e deixar mais visível aquilo que só você pode oferecer.')
    ]
  }
};

// As três leituras observadas são fonte preservada, nunca selecionadas por valor ou ID declarado pelo chamador.
export function sphereEnergyReading(id) {
  return reflections[id] || null;
}
