# Know Thyself

[![Licença: AGPL v3](https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0--or--later-6b4fbb)](LICENSE)
[![Swiss Ephemeris](https://img.shields.io/badge/efem%C3%A9ride-Swiss%20Ephemeris%202.10-c9a227)](https://www.astro.com/swisseph/)
[![Ao vivo](https://img.shields.io/badge/ao%20vivo-know--thyself--app.vercel.app-080d23)](https://know-thyself-app.vercel.app)

App web (PWA) de autoconhecimento da [Leaner](https://useleaner.com). Ensina a pessoa a ler o próprio mapa astral e a própria Árvore da Vida e a tirar as suas conclusões, sem horóscopo nem veredito pronto. Interface em português e inglês.

**Ao vivo:** [know-thyself-app.vercel.app](https://know-thyself-app.vercel.app)

## O que tem

- **Mapa natal** em 3D, com planetas, ângulos, casas e aspectos calculados para o nascimento.
- **Trânsitos e sinastria:** o céu de qualquer dia ou o mapa de outra pessoa sobre o seu.
- **Correspondências planetárias:** dia, elemento, cores, metais, ervas e outras associações tradicionais.
- **Árvore da Vida pessoal:** esferas e caminhos da Cabala calculados pelo nome e pela data.
- **Leituras autorais** para cada posição, escritas para estudo e não para previsão.

## Como o mapa é calculado

- **Efeméride:** [Swiss Ephemeris](https://www.astro.com/swisseph/) 2.10 (Astrodienst) compilado em WebAssembly (`vendor/swisseph`), rodando no próprio navegador. Planetas, Lua, Nó e Lilith médios usam a efeméride Moshier embutida; Quíron, Ceres, Palas, Juno e Vesta usam `seas_18.se1` (1800 a 2400).
- **Casas:** Placidus, casas iguais ou signos inteiros (`swe_houses`). Acima do círculo polar, Placidus passa para casas iguais, com aviso.
- **Zodíaco:** tropical ou sideral (ayanamsa Lahiri).
- **Cidade e fuso:** busca pelo [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api), que devolve latitude, longitude e fuso IANA. A hora local vira UTC pelo histórico de fusos do navegador (`Intl`), com horário de verão e aviso para horários ambíguos ou inexistentes (`geocode.js`).
- **Conferência:** `fixtures/astro-seek-cases.json` traz quatro pessoas fictícias calculadas no [Astro-Seek](https://horoscopes.astro-seek.com). O motor fica a até 3″ nas posições e 5″ nos ângulos, com as mesmas casas, cúspides e retrogradações (`astro-engine.test.mjs`).

## Rodar localmente

Requer Node 22 ou mais novo e Python 3.

```sh
python3 -m http.server 4173 --bind 127.0.0.1   # abra http://127.0.0.1:4173/universo.html
node --test                                    # testes
```

Localmente o app abre sem login, com os dados guardados só no navegador. Em produção, o login Google, a sincronização de perfis e as notificações usam `api/`, `lib/` e as variáveis listadas em `.env.example`.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `*.html`, `*.css` | Telas e estilos |
| `astro-engine.js`, `map-data.js` | Cálculo do mapa e aspectos |
| `solar-study.js`, `orbit.js` | Cena 3D (Three.js) e gestos |
| `cabala-engine.js`, `tree.js` | Árvore da Vida pessoal |
| `*-texts.js`, `i18n-en.js` | Leituras e tradução para inglês |
| `api/`, `lib/` | Funções serverless: login, perfis cifrados, notificações |
| `vendor/` | Swiss Ephemeris (WebAssembly) e Three.js |

## Licença

Código e conteúdo sob a **GNU Affero General Public License v3.0 ou posterior** ([`LICENSE`](LICENSE)), como exige o uso do Swiss Ephemeris sob a AGPL. Se você rodar uma versão modificada como serviço, precisa oferecer o código dela a quem usa.

Dependências: Swiss Ephemeris, da Astrodienst AG (AGPL-3.0, `vendor/swisseph/LICENSE`), e Three.js (MIT, `vendor/THREE-LICENSE.txt`).

---

## English

Know Thyself is a self-knowledge web app (PWA) by [Leaner](https://useleaner.com): an interactive 3D natal chart with transits and synastry, planetary correspondences and a personal Kabbalistic Tree of Life, in Portuguese and English. Chart math runs in the browser on the Swiss Ephemeris compiled to WebAssembly. Run it locally with `python3 -m http.server 4173` and test it with `node --test`. Licensed under AGPL-3.0-or-later.
