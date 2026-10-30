// Interpretação autoral dos dez planetas cruzados pelo motor. Funções: catálogo natal; Linda Reid, skyscript.co.uk/begin2.html.
// A chave do par é alfabética; os papéis e donos são definidos pelo renderer.
export const bodyMeanings = {
  "sun": [
    "O Sol representa identidade e direção consciente: aquilo a que se procura dar forma e reconhecimento.",
    "The Sun represents identity and conscious direction: what seeks expression, form and recognition."
  ],
  "moon": [
    "A Lua representa necessidades de acolhimento, hábitos emocionais e o que ajuda a sentir familiaridade e segurança.",
    "The Moon represents needs for emotional support, habitual responses and what helps bring familiarity and security."
  ],
  "mercury": [
    "Mercúrio representa a maneira de perceber, aprender, formular ideias e se comunicar por palavras e perguntas.",
    "Mercury represents ways of perceiving, learning, forming ideas and communicating through words and questions."
  ],
  "venus": [
    "Vênus representa preferências, valores e a maneira de criar proximidade: o que se aprecia e como se demonstra afeto.",
    "Venus represents preferences, values and ways of creating closeness: what is appreciated and how affection is expressed."
  ],
  "mars": [
    "Marte representa iniciativa, desejo e defesa de limites: a passagem da intenção para o gesto e a afirmação de espaço.",
    "Mars represents initiative, desire and the defence of boundaries: moving from intention to action and asserting space."
  ],
  "jupiter": [
    "Júpiter representa ampliação de perspectivas, confiança e busca de sentido: como se imaginam possibilidades além do conhecido.",
    "Jupiter represents broader perspectives, trust and the search for meaning: how possibilities beyond the familiar are imagined."
  ],
  "saturn": [
    "Saturno representa limites, critérios e compromissos: as condições e a constância necessárias para sustentar uma escolha.",
    "Saturn represents boundaries, criteria and commitments: the conditions and consistency needed to sustain a choice."
  ],
  "uranus": [
    "Urano representa espaço para diferença, liberdade e mudança: a possibilidade de questionar um costume e experimentar outra forma.",
    "Uranus represents room for difference, freedom and change: the possibility of questioning a convention and trying another way."
  ],
  "neptune": [
    "Netuno representa imaginação, sensibilidade e abertura ao que ainda não tem definição: imagens e impressões que podem inspirar uma possibilidade.",
    "Neptune represents imagination, sensitivity and openness to what has yet to take shape: images and impressions that can inspire a possibility."
  ],
  "pluto": [
    "Plutão representa poder e transformação profunda: o que se negocia, preserva ou modifica ao atravessar uma mudança.",
    "Pluto represents power and profound transformation: what is negotiated, maintained or altered when going through change."
  ]
};

export const pairedTexts = {
  "moon-sun": [
    "O Sol dá direção à escolha; a Lua procura condições para se sentir à vontade com ela. Numa decisão de rotina, o que expressa uma vontade pode precisar ser ajustado ao descanso, à familiaridade ou ao apoio emocional.",
    "The Sun gives a choice direction; the Moon seeks conditions that make it feel comfortable. In an everyday decision, what expresses an intention may need to be adjusted to rest, familiarity or emotional support."
  ],
  "mercury-sun": [
    "Mercúrio transforma uma intenção do Sol em palavras, perguntas e argumentos. Numa conversa sobre uma escolha, explicar o que se quer pode esclarecer a direção ou tornar difícil escutar uma ideia que a contrarie.",
    "Mercury turns the Sun’s intention into words, questions and arguments. In a conversation about a choice, explaining what is wanted can clarify its direction or make it difficult to hear an idea that challenges it."
  ],
  "sun-venus": [
    "O Sol pergunta qual direção merece ser assumida; Vênus, o que torna essa escolha desejável e aproxima as pessoas. Num acordo, agradar e afirmar uma vontade podem se apoiar ou disputar o critério da decisão.",
    "The Sun asks which direction is worth taking; Venus asks what makes that choice desirable and brings people closer. In an agreement, pleasing others and asserting an intention can support each other or compete to guide the decision."
  ],
  "mars-sun": [
    "O Sol orienta a vontade; Marte dá o passo, assume o risco e defende espaço para realizá-la. Ao começar um projeto, a iniciativa pode expressar essa direção ou avançar antes de ficar claro o que se quer sustentar.",
    "The Sun directs intention; Mars takes the step, accepts risk and defends the space needed to act. When starting a project, initiative can express that direction or move ahead before what is worth sustaining becomes clear."
  ],
  "jupiter-sun": [
    "O Sol escolhe uma direção e Júpiter amplia a ideia do que ela pode alcançar. Num projeto, confiança e propósito podem abrir possibilidades; uma promessa grande demais também pode afastar a escolha das condições presentes.",
    "The Sun chooses a direction and Jupiter expands the idea of what it could achieve. In a project, confidence and purpose can open possibilities; an oversized promise can also pull a choice away from present conditions."
  ],
  "saturn-sun": [
    "O Sol dá sentido pessoal a uma direção; Saturno pergunta quais critérios e compromissos permitem sustentá-la. Numa decisão de longo alcance, uma estrutura pode dar forma à vontade ou tornar a aprovação mais importante que a escolha.",
    "The Sun gives a direction personal meaning; Saturn asks which criteria and commitments can sustain it. In a decision with lasting implications, structure can give intention form or make approval more important than the choice itself."
  ],
  "sun-uranus": [
    "O Sol busca uma direção reconhecível e Urano abre espaço para fazer diferente. Ao mudar um plano, a novidade pode renovar o que se deseja expressar ou romper a continuidade antes que outra direção encontre forma.",
    "The Sun seeks a recognisable direction and Uranus makes room for doing things differently. When a plan changes, novelty can renew what seeks expression or interrupt continuity before another direction takes shape."
  ],
  "neptune-sun": [
    "O Sol procura uma direção definida; Netuno imagina possibilidades que ainda não cabem numa definição. Num projeto criativo, uma imagem pode inspirar a escolha, mas também encobrir a diferença entre o que se deseja e o que foi combinado.",
    "The Sun seeks a defined direction; Neptune imagines possibilities that do not yet fit a definition. In a creative project, an image can inspire a choice but also blur the difference between what is wished for and what was agreed."
  ],
  "pluto-sun": [
    "O Sol trata da direção assumida; Plutão, do poder envolvido em mantê-la ou transformá-la. Numa decisão compartilhada, afirmar uma vontade pode exigir renegociar influência, sem fazer da mudança uma disputa para decidir quem manda.",
    "The Sun concerns the direction being taken; Pluto concerns the power involved in maintaining or transforming it. In a shared decision, asserting an intention may require renegotiating influence without turning change into a contest over who is in charge."
  ],
  "mercury-moon": [
    "A Lua registra necessidades e respostas afetivas; Mercúrio procura palavras para compreendê-las e comunicá-las. Numa conversa de cuidado, nomear um sentimento pode facilitar o acolhimento, mas uma explicação também pode chegar antes da escuta.",
    "The Moon registers needs and emotional responses; Mercury seeks words to understand and communicate them. In a conversation about care, naming a feeling can make support easier, but an explanation can also arrive before listening does."
  ],
  "moon-venus": [
    "A Lua procura acolhimento e familiaridade; Vênus escolhe como demonstrar afeto e criar proximidade. Num encontro, aquilo que parece agradável pode alimentar a segurança emocional ou deixar uma necessidade sem resposta apesar da cordialidade.",
    "The Moon seeks support and familiarity; Venus chooses how to show affection and create closeness. In an encounter, what feels pleasant can nourish emotional security or leave a need unanswered despite a friendly atmosphere."
  ],
  "mars-moon": [
    "A Lua responde ao que traz segurança ou desconforto; Marte age e defende limites. Numa divergência cotidiana, agir pode proteger uma necessidade, mas a rapidez da reação também pode dificultar reconhecer qual cuidado estava sendo pedido.",
    "The Moon responds to comfort and discomfort; Mars acts and defends boundaries. In an everyday disagreement, action can protect a need, but a quick reaction can also make it harder to recognise what kind of care was being sought."
  ],
  "jupiter-moon": [
    "A Lua procura um apoio familiar; Júpiter amplia a confiança em experiências menos conhecidas. Numa mudança de rotina, o entusiasmo pode oferecer acolhimento e perspectiva ou minimizar o tempo necessário para se sentir à vontade.",
    "The Moon seeks familiar support; Jupiter expands trust in less familiar experiences. When a routine changes, enthusiasm can offer reassurance and perspective or overlook the time needed to feel comfortable."
  ],
  "moon-saturn": [
    "A Lua fala de acolhimento e hábitos emocionais; Saturno dá forma aos limites e compromissos. Numa rotina de cuidado, constância pode oferecer segurança, enquanto uma regra rígida pode deixar pouco espaço para reconhecer o que se sente.",
    "The Moon concerns emotional support and habitual responses; Saturn gives boundaries and commitments form. In a caring routine, consistency can offer security, while a rigid rule can leave little room to acknowledge what is felt."
  ],
  "moon-uranus": [
    "A Lua busca familiaridade; Urano introduz outra maneira de organizar a experiência. Numa mudança de hábito, ganhar liberdade pode renovar o conforto ou interromper referências afetivas antes que novas formas de apoio estejam disponíveis.",
    "The Moon seeks familiarity; Uranus introduces another way to arrange experience. When a habit changes, gaining freedom can renew comfort or interrupt emotional reference points before new forms of support are available."
  ],
  "moon-neptune": [
    "A Lua reconhece necessidades afetivas; Netuno amplia a receptividade ao que ainda não foi dito. Num gesto de cuidado, a imaginação pode ajudar a acolher, mas supor o sentimento alheio pode substituir uma pergunta necessária.",
    "The Moon recognises emotional needs; Neptune increases receptiveness to what has not yet been said. In an act of care, imagination can help offer support, but assuming another person’s feelings can replace a necessary question."
  ],
  "moon-pluto": [
    "A Lua procura segurança no vínculo; Plutão destaca como confiança e poder participam dele. Ao compartilhar uma necessidade, aprofundar a conversa pode permitir mudança, enquanto tentar controlar a resposta pode dificultar o acolhimento.",
    "The Moon seeks security in a bond; Pluto highlights how trust and power take part in it. When sharing a need, a deeper conversation can make change possible, while trying to control the response can make support harder to receive."
  ],
  "mercury-venus": [
    "Mercúrio formula ideias; Vênus considera o valor e o efeito da aproximação. Ao negociar um acordo, escolher palavras pode tornar uma diferença conversável, mas o desejo de agradar também pode deixar uma posição pouco clara.",
    "Mercury formulates ideas; Venus considers value and the effect of an approach. When negotiating an agreement, choosing words can make a difference discussable, but a wish to please can also leave a position unclear."
  ],
  "mars-mercury": [
    "Mercúrio pergunta, compara e formula; Marte decide como agir e defender espaço. Num debate, uma ideia pode ganhar iniciativa, enquanto a pressa de responder pode transformar uma pergunta em disputa antes que seu sentido seja esclarecido.",
    "Mercury questions, compares and formulates; Mars decides how to act and defend space. In a debate, an idea can gain initiative, while a rush to respond can turn a question into a contest before its meaning is clear."
  ],
  "jupiter-mercury": [
    "Mercúrio acompanha dados e argumentos; Júpiter procura a perspectiva que lhes dá sentido. Ao estudar ou explicar um plano, a visão ampla pode organizar detalhes ou avançar para uma conclusão que ainda precisa ser conferida.",
    "Mercury follows information and arguments; Jupiter seeks the perspective that gives them meaning. When studying or explaining a plan, a broad view can organise details or leap to a conclusion that still needs checking."
  ],
  "mercury-saturn": [
    "Mercúrio explora maneiras de compreender; Saturno estabelece critérios para considerar uma ideia consistente. Ao revisar um trabalho, o rigor pode tornar a explicação mais precisa ou interromper uma pergunta antes que ela tenha sido desenvolvida.",
    "Mercury explores ways of understanding; Saturn sets criteria for judging an idea sound. When reviewing work, rigour can make an explanation more precise or interrupt a question before it has been developed."
  ],
  "mercury-uranus": [
    "Mercúrio organiza a conversa; Urano propõe uma ligação que muda o raciocínio habitual. Ao resolver um problema, a surpresa pode abrir uma alternativa útil ou tornar difícil acompanhar como se chegou à nova ideia.",
    "Mercury organises a conversation; Uranus proposes a connection that changes familiar reasoning. When solving a problem, surprise can open a useful alternative or make it difficult to follow how the new idea was reached."
  ],
  "mercury-neptune": [
    "Mercúrio procura definir e comunicar; Netuno reúne imagens e impressões ainda abertas. Numa conversa criativa, uma metáfora pode dizer algo que a descrição literal não alcança, mas também deixar um acordo sujeito a interpretações diferentes.",
    "Mercury seeks to define and communicate; Neptune gathers images and impressions that remain open. In a creative conversation, a metaphor can express what a literal description cannot, but it can also leave an agreement open to different interpretations."
  ],
  "mercury-pluto": [
    "Mercúrio faz perguntas e constrói argumentos; Plutão chama atenção para o poder que passa pela informação. Numa conversa difícil, investigar pode esclarecer o que sustenta uma decisão ou virar pressão para obter a resposta desejada.",
    "Mercury asks questions and builds arguments; Pluto draws attention to the power carried by information. In a difficult conversation, investigation can clarify what supports a decision or become pressure to obtain a preferred answer."
  ],
  "mars-venus": [
    "Vênus reconhece o que aproxima e agrada; Marte move o desejo e marca limites. Num encontro ou numa decisão conjunta, iniciativa e receptividade podem se encontrar, mas desejar algo não estabelece que a outra pessoa o queira.",
    "Venus recognises what attracts and pleases; Mars moves desire into action and marks boundaries. In an encounter or shared decision, initiative and receptiveness can meet, but wanting something does not establish that the other person wants it too."
  ],
  "jupiter-venus": [
    "Vênus escolhe o que tem valor; Júpiter amplia a disposição para investir confiança e generosidade. Ao combinar um prazer ou projeto, essa abertura pode enriquecer a experiência ou levar a prometer mais do que se deseja oferecer.",
    "Venus chooses what has value; Jupiter expands the willingness to invest trust and generosity. When arranging a pleasure or project, openness can enrich the experience or lead to promising more than one wishes to offer."
  ],
  "saturn-venus": [
    "Vênus procura proximidade e afinidade; Saturno pergunta o que pode ser assumido com constância. Num acordo afetivo, compromisso pode dar segurança ao vínculo, enquanto exigências não conversadas podem tornar o afeto dependente de aprovação.",
    "Venus seeks closeness and affinity; Saturn asks what can be undertaken consistently. In an affectionate agreement, commitment can give a bond security, while unspoken demands can make affection seem dependent on approval."
  ],
  "uranus-venus": [
    "Vênus cultiva aproximação; Urano procura liberdade para mudar a forma do vínculo. Ao combinar convivência e espaço próprio, novidade pode renovar o interesse, enquanto mudanças sem conversa podem dificultar saber com o que contar.",
    "Venus cultivates closeness; Uranus seeks freedom to change the form of a bond. When balancing time together and personal space, novelty can renew interest, while changes without discussion can make it difficult to know what to count on."
  ],
  "neptune-venus": [
    "Vênus reconhece afinidades e valores; Netuno imagina o que um encontro pode significar. Num vínculo ou numa criação, sensibilidade pode ampliar a beleza percebida, mas uma imagem ideal também pode ocupar o lugar de conhecer as preferências concretas.",
    "Venus recognises affinity and value; Neptune imagines what an encounter could mean. In a bond or creative work, sensitivity can deepen perceived beauty, but an ideal image can also take the place of learning about actual preferences."
  ],
  "pluto-venus": [
    "Vênus trata do que aproxima e vale a pena; Plutão examina o poder envolvido nessa troca. Ao negociar afeto ou recursos, aprofundar o compromisso pode transformar valores, enquanto tentar garantir proximidade pelo controle pode estreitar a escolha.",
    "Venus concerns what draws people together and feels worthwhile; Pluto examines the power involved in that exchange. When negotiating affection or resources, deeper commitment can transform values, while trying to secure closeness through control can narrow choice."
  ],
  "jupiter-mars": [
    "Marte dá início à ação; Júpiter amplia a confiança no alcance dela. Ao aceitar um desafio, entusiasmo pode sustentar coragem, mas crescer a aposta antes de avaliar meios e limites pode levar a uma iniciativa difícil de manter.",
    "Mars starts action; Jupiter expands confidence in its reach. When accepting a challenge, enthusiasm can sustain courage, but raising the stakes before assessing means and limits can make an initiative difficult to maintain."
  ],
  "mars-saturn": [
    "Marte quer dar o passo; Saturno verifica condições e consequências. Num trabalho com prazo, ritmo e disciplina podem tornar a ação sustentável, enquanto avançar e conter ao mesmo tempo podem converter uma tarefa em esforço sem saída clara.",
    "Mars wants to take the step; Saturn checks conditions and consequences. In work with a deadline, pace and discipline can make action sustainable, while trying to advance and hold back at once can turn a task into effort with no clear way forward."
  ],
  "mars-uranus": [
    "Marte põe a decisão em movimento; Urano abre uma alternativa ao modo habitual de agir. Ao mudar um procedimento, iniciativa pode tornar a inovação concreta, mas acelerar a ruptura pode dispensar uma coordenação ainda necessária.",
    "Mars puts a decision into motion; Uranus opens an alternative to the familiar way of acting. When changing a procedure, initiative can make innovation concrete, but accelerating a break can bypass coordination that is still needed."
  ],
  "mars-neptune": [
    "Marte procura um gesto definido; Netuno percebe possibilidades e impressões ainda sem contorno. Num projeto criativo ou coletivo, uma imagem pode orientar a iniciativa, enquanto objetivos pouco combinados podem espalhar esforço em direções diferentes.",
    "Mars seeks a definite action; Neptune perceives possibilities and impressions that have no clear outline yet. In a creative or collective project, an image can guide initiative, while loosely agreed aims can scatter effort in different directions."
  ],
  "mars-pluto": [
    "Marte afirma um desejo por meio da ação; Plutão põe em evidência o poder de sustentar ou transformar a situação. Numa disputa por espaço, determinação pode permitir mudança, mas insistir em vencer pode dificultar negociar um limite.",
    "Mars asserts desire through action; Pluto highlights the power to sustain or transform a situation. In a disagreement over space, determination can enable change, but insistence on winning can make a boundary harder to negotiate."
  ],
  "jupiter-saturn": [
    "Júpiter amplia o horizonte; Saturno organiza condições para sustentá-lo. Num plano de crescimento, confiança pode encontrar uma estrutura viável, enquanto a distância entre promessa e compromisso pode exigir rever tanto a meta quanto o ritmo.",
    "Jupiter broadens the horizon; Saturn organises the conditions needed to sustain it. In a plan for growth, confidence can find a workable structure, while a gap between promise and commitment may require revisiting both the aim and the pace."
  ],
  "jupiter-uranus": [
    "Júpiter amplia possibilidades e Urano questiona o caminho conhecido para alcançá-las. Ao explorar uma proposta nova, abertura pode favorecer descobertas, enquanto tomar novidade como garantia de avanço pode deixar condições importantes fora da avaliação.",
    "Jupiter expands possibilities and Uranus questions the familiar route towards them. When exploring a new proposal, openness can favour discovery, while treating novelty as a guarantee of progress can leave important conditions out of the assessment."
  ],
  "jupiter-neptune": [
    "Júpiter procura sentido e investe confiança; Netuno imagina possibilidades que ultrapassam a definição atual. Numa causa ou criação, inspiração pode ampliar o envolvimento, enquanto acreditar numa imagem sem conferir acordos pode inflar expectativas.",
    "Jupiter seeks meaning and invests trust; Neptune imagines possibilities beyond the current definition. In a cause or creative work, inspiration can deepen involvement, while believing in an image without checking agreements can inflate expectations."
  ],
  "jupiter-pluto": [
    "Júpiter amplia objetivos e convicções; Plutão examina quem dispõe do poder de realizá-los. Num projeto coletivo, uma visão pode mobilizar mudanças, enquanto a certeza de um propósito pode dificultar discutir como decisões e influência são repartidas.",
    "Jupiter expands aims and convictions; Pluto examines who has the power to realise them. In a collective project, a vision can mobilise change, while certainty about a purpose can make the sharing of decisions and influence harder to discuss."
  ],
  "saturn-uranus": [
    "Saturno organiza continuidade; Urano propõe mudar a forma de participar. Ao rever uma rotina ou regra, inovação pode ganhar sustentação, enquanto preservar tudo ou romper tudo pode impedir distinguir o que funciona do que pede mudança.",
    "Saturn organises continuity; Uranus proposes changing the way participation works. When revisiting a routine or rule, innovation can gain support, while preserving everything or breaking everything can prevent distinguishing what works from what needs changing."
  ],
  "neptune-saturn": [
    "Saturno pede critérios e compromisso; Netuno acolhe possibilidades que ainda não têm forma definida. Ao dar corpo a uma criação, uma estrutura pode ajudar a imaginação, enquanto exigir certeza cedo demais ou adiar todo limite pode paralisar o trabalho.",
    "Saturn asks for criteria and commitment; Neptune welcomes possibilities that have no definite form yet. When developing a creative work, structure can help imagination, while demanding certainty too soon or postponing every boundary can stall the work."
  ],
  "pluto-saturn": [
    "Saturno sustenta regras e compromissos; Plutão examina o poder envolvido em mantê-los ou transformá-los. Ao rever uma responsabilidade, firmeza pode dar apoio à mudança, enquanto tornar uma regra intocável pode dificultar renegociar sua finalidade.",
    "Saturn sustains rules and commitments; Pluto examines the power involved in keeping or transforming them. When revisiting a responsibility, firmness can support change, while making a rule untouchable can make its purpose harder to renegotiate."
  ],
  "neptune-uranus": [
    "Urano abre uma alternativa ao costume; Netuno imagina possibilidades ainda sem contorno. Numa proposta criativa ou coletiva, essa combinação pode renovar a visão, mas uma mudança precisa de algum acordo para não permanecer apenas uma imagem atraente.",
    "Uranus opens an alternative to convention; Neptune imagines possibilities with no clear outline yet. In a creative or collective proposal, this combination can renew a vision, but change needs some agreement to become more than an appealing image."
  ],
  "pluto-uranus": [
    "Urano procura outra forma de participar; Plutão examina como o poder sustenta a forma existente. Numa mudança compartilhada, abrir alternativas pode redistribuir influência, enquanto a ruptura também pode repetir o controle que pretendia modificar.",
    "Uranus seeks another way to participate; Pluto examines how power sustains the existing form. In a shared change, opening alternatives can redistribute influence, while a break can also repeat the control it aimed to change."
  ],
  "neptune-pluto": [
    "Netuno imagina ligações que ainda não estão definidas; Plutão examina o poder e as mudanças envolvidos nelas. Numa visão coletiva, sensibilidade pode aprofundar o propósito, enquanto uma promessa de transformação pode esconder quem decide e quais limites continuam necessários.",
    "Neptune imagines connections that are not yet defined; Pluto examines the power and changes involved in them. In a collective vision, sensitivity can deepen purpose, while a promise of transformation can obscure who decides and which boundaries are still needed."
  ],
  "sun-sun": [
    "Duas expressões do Sol colocam em relação direções e maneiras de assumir uma escolha. Num projeto compartilhado ou numa revisão de rumo, reconhecer cada vontade pode favorecer coordenação, enquanto procurar uma única direção legítima pode reduzir espaço para negociar.",
    "Two expressions of the Sun bring directions and ways of owning a choice into relationship. In a shared project or a review of direction, recognising each intention can help coordination, while seeking a single legitimate direction can reduce room for negotiation."
  ],
  "moon-moon": [
    "Duas expressões da Lua põem em relação hábitos e formas de buscar acolhimento. Ao combinar uma rotina, familiaridade pode facilitar apoio mútuo ou tornar menos visíveis diferenças sobre descanso, proximidade e o que ajuda a recuperar conforto.",
    "Two expressions of the Moon bring habits and ways of seeking support into relationship. When arranging a routine, familiarity can make mutual support easier or make differences about rest, closeness and recovering comfort less visible."
  ],
  "mercury-mercury": [
    "Duas expressões de Mercúrio aproximam maneiras de perguntar, compreender e formular ideias. Numa conversa ou revisão de plano, reconhecer como cada raciocínio se organiza pode enriquecer a troca, enquanto usar a mesma palavra não garante o mesmo entendimento.",
    "Two expressions of Mercury bring ways of questioning, understanding and forming ideas together. In a conversation or plan review, recognising how each line of reasoning works can enrich the exchange, while using the same word does not guarantee the same understanding."
  ],
  "venus-venus": [
    "Duas expressões de Vênus aproximam preferências e maneiras de criar vínculo. Ao escolher uma experiência em comum, afinidades podem facilitar prazer e cooperação, mas gostar de coisas semelhantes não resolve sozinho como repartir atenção, tempo ou recursos.",
    "Two expressions of Venus bring preferences and ways of creating bonds together. When choosing a shared experience, affinities can make pleasure and cooperation easier, but liking similar things does not by itself settle how attention, time or resources are shared."
  ],
  "mars-mars": [
    "Duas expressões de Marte colocam em relação iniciativa, desejo e defesa de limites. Numa tarefa conjunta, ritmos próximos podem ajudar a agir, enquanto agir ao mesmo tempo ou disputar a condução pode exigir combinar espaço e sequência.",
    "Two expressions of Mars bring initiative, desire and the defence of boundaries into relationship. In a shared task, similar rhythms can help action, while acting at once or competing to lead may require agreeing on space and sequence."
  ],
  "jupiter-jupiter": [
    "Duas expressões de Júpiter aproximam perspectivas e maneiras de investir confiança. Ao imaginar um projeto, entusiasmo pode ampliar possibilidades, enquanto concordar sobre um horizonte não garante que a promessa caiba nos recursos disponíveis.",
    "Two expressions of Jupiter bring perspectives and ways of investing trust together. When imagining a project, enthusiasm can expand possibilities, while agreement about a horizon does not guarantee that its promise fits the available resources."
  ],
  "saturn-saturn": [
    "Duas expressões de Saturno aproximam critérios, limites e maneiras de assumir compromissos. Numa divisão de responsabilidades, constância pode dar sustentação, mas repetir a mesma regra não dispensa conferir se ela continua adequada às condições presentes.",
    "Two expressions of Saturn bring criteria, boundaries and ways of undertaking commitments together. When sharing responsibilities, consistency can offer support, but repeating the same rule does not remove the need to check whether it still fits present conditions."
  ],
  "uranus-uranus": [
    "Duas expressões de Urano relacionam maneiras de abrir espaço para diferença e mudança. Ao rever um costume, interesse por alternativas pode permitir experimentação, enquanto mudar pela mudança pode dificultar escolher o que merece continuidade.",
    "Two expressions of Uranus connect ways of making room for difference and change. When revisiting a convention, interest in alternatives can enable experimentation, while change for its own sake can make it difficult to choose what deserves continuity."
  ],
  "neptune-neptune": [
    "Duas expressões de Netuno aproximam imagens, sensibilidades e possibilidades ainda indefinidas. Numa criação ou visão compartilhada, inspiração pode criar afinidade, enquanto sentir que existe entendimento pode deixar sem palavras acordos que precisam ser claros.",
    "Two expressions of Neptune bring images, sensitivities and unformed possibilities together. In creative work or a shared vision, inspiration can create affinity, while feeling understood can leave necessary agreements unspoken."
  ],
  "pluto-pluto": [
    "Duas expressões de Plutão põem em relação maneiras de lidar com poder e transformação. Ao rever uma decisão compartilhada, aprofundar a negociação pode mudar condições antigas, enquanto exigir mudança sem repartir influência pode conservar o mesmo impasse.",
    "Two expressions of Pluto bring ways of dealing with power and transformation into relationship. When revisiting a shared decision, deeper negotiation can change old conditions, while demanding change without sharing influence can preserve the same impasse."
  ]
};

export const explicitExamples = {
  "transit:saturn>moon:square": {
    "paragraphs": [
      [
        "A Lua natal de {toOwner} representa necessidades de acolhimento, hábitos emocionais e aquilo que costuma trazer segurança. Saturno em trânsito põe em primeiro plano tempo, limites e responsabilidades. A quadratura reúne essas funções em tensão: algo que precisa ser sustentado pode disputar espaço com o descanso ou o apoio de que {toOwner} pode precisar.",
        "The natal Moon of {toOwner} represents the need for emotional support, habitual responses and what usually helps bring security. Transiting Saturn brings time, boundaries and responsibilities into focus. The square places these functions in tension: something that needs to be maintained may compete with the rest or support that {toOwner} may need."
      ],
      [
        "Uma obrigação pode exigir constância quando existe vontade de se recolher. A diferença entre um limite que protege e uma restrição que apenas torna tudo mais pesado também pode ficar mais visível. Essa combinação convida a dar lugar às necessidades emocionais junto das responsabilidades, na leitura da data selecionada.",
        "An obligation may call for consistency when there is a wish to withdraw. The difference between a protective boundary and a restriction that only adds weight may also become clearer. This combination invites room for emotional needs alongside responsibilities in the reading for the selected date."
      ]
    ]
  },
  "synastry:mercury>mars:square": {
    "paragraphs": [
      [
        "Mercúrio de {fromOwner} representa a maneira de organizar ideias, fazer perguntas e se comunicar. Marte de {toOwner} representa iniciativa, desejos e a forma de defender espaço. A quadratura coloca a troca de ideias e o impulso de agir em ritmos que podem se desafiar.",
        "Mercury of {fromOwner} represents a way of organising ideas, asking questions and communicating. Mars of {toOwner} represents initiative, desires and the defence of personal space. The square brings the exchange of ideas and the impulse to act into rhythms that can challenge each other."
      ],
      [
        "Uma pergunta de {fromOwner} pode ser recebida por {toOwner} como contestação; uma resposta direta de {toOwner} pode parecer a {fromOwner} que encerra a conversa cedo demais. A combinação também pode favorecer debate vivo e iniciativa. O cuidado está em distinguir discordância de ataque e franqueza de imposição.",
        "A question from {fromOwner} may feel like a challenge to {toOwner}; a direct response from {toOwner} may seem to {fromOwner} to close the conversation too soon. The combination can also support lively debate and initiative. The distinction to notice is between disagreement and attack, and between directness and pressure."
      ]
    ]
  }
};
