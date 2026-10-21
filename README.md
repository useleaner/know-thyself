# Know Thyself

App web (PWA) de autoconhecimento da Leaner: mapa astral natal com trânsitos e sinastria, correspondências e Árvore da Vida pessoal. Interface em português e inglês.

Em produção: https://know-thyself-app.vercel.app

## Cálculo do mapa

- **Efeméride:** [Swiss Ephemeris](https://www.astro.com/swisseph/) 2.10 (Astrodienst) compilado em WebAssembly (`vendor/swisseph`), rodando no próprio navegador, sem servidor. Planetas, Lua, Nó e Lilith médios usam a efeméride Moshier embutida; Quíron, Ceres, Palas, Juno e Vesta usam `seas_18.se1` (1800–2400).
- **Casas:** Placidus, casas iguais ou signos inteiros (`swe_houses`). Acima do círculo polar, Placidus cai para casas iguais com aviso.
- **Zodíaco:** tropical ou sideral (ayanamsa Lahiri).
- **Cidade e fuso:** busca de cidades pelo [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api), que devolve latitude, longitude e fuso IANA. A hora local vira UTC pelo histórico de fusos do próprio navegador (`Intl`), incluindo horário de verão, com aviso para horários ambíguos ou inexistentes (`geocode.js`).
- **Signos:** longitude eclíptica de 0° a 360° → signo (30° cada), grau e minuto, casa e retrogradação (`astro-engine.js`).
- **Conferência:** `fixtures/astro-seek-cases.json` traz quatro pessoas fictícias calculadas no [Astro-Seek](https://horoscopes.astro-seek.com). O motor fica a até 3″ nas posições e 5″ nos ângulos, com as mesmas casas, cúspides e retrogradações (`astro-engine.test.mjs`).

## Rodar localmente

```sh
python3 -m http.server 4173 --bind 127.0.0.1   # abrir http://127.0.0.1:4173/universo.html
node --test                                    # testes (Node 22+)
```

Em `127.0.0.1:4173` o app abre sem login, com dados guardados só no navegador. Em produção, o login Google e a sincronização de perfis usam `api/`, `lib/` e as variáveis de `.env.example`.

## Licença

Código e conteúdo sob a **GNU Affero General Public License v3.0 ou posterior** (`LICENSE`), exigida pelo uso do Swiss Ephemeris sob a AGPL. Dependências: Swiss Ephemeris (AGPL-3.0, `vendor/swisseph/LICENSE`) e Three.js (MIT, `vendor/THREE-LICENSE.txt`).

---

*Know Thyself is a self-knowledge web app (natal chart, transits, synastry, Tree of Life). Chart math runs in the browser on the Swiss Ephemeris (WebAssembly). Licensed AGPL-3.0-or-later.*
