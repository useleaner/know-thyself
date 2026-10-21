# Swiss Ephemeris (WebAssembly)

- `swisseph.js` e `swisseph.wasm`: pacote npm `@swisseph/browser` 1.4.0 (`package/dist/`), compilação WebAssembly do Swiss Ephemeris 2.10.03 da Astrodienst. Licença AGPL-3.0 (`LICENSE`).
- `seas_18.se1`: arquivo de asteroides (Quíron, Ceres, Palas, Juno, Vesta; 1800–2400), de github.com/aloistr/swisseph/ephe.
- Planetas, Lua, Nó e Lilith usam a efeméride Moshier embutida; no mapa de referência ela difere dos arquivos JPL do Swiss Ephemeris em menos de 0,3″.

O Know Thyself usa o Swiss Ephemeris sob a AGPL; o código-fonte do app inteiro é público (ver README da raiz).
