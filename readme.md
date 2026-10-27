# Pontinho dos pituchas

PWA (Angular 21 + Ionic 9) para anotar os pontos do Pontinho em família. Funciona offline e guarda tudo no próprio aparelho (`localStorage`), sem servidor nem login.

## Requisitos

Node 20.19+ (o CI usa Node 22) e npm 11. O npm 10.8.2 trava na instalação, então use `npx npm@11` para instalar dependências:

```bash
npx npm@11 ci
```

## Rodar

```bash
npm start
```

Abra http://localhost:4200. O service worker só é ativado no build de produção.

## Testar

```bash
npx ng test --watch=false
```

## Build

```bash
npx ng build --base-href /pontinho/
```

O resultado fica em `dist/pontinho/browser`.

## Publicar

O app é publicado em https://jpozorio.github.io/pontinho/ pelo workflow `.github/workflows/deploy.yml`, a cada push na `master` (ou manualmente em Actions → Deploy → Run workflow). Ele instala, roda os testes, gera o build e publica no GitHub Pages. As rotas usam hash, então não há dependência de `404.html`.

Passo manual (uma única vez): no GitHub, Settings → Pages → Source = "GitHub Actions".

## Instalar no celular

Abra https://jpozorio.github.io/pontinho/ no navegador do celular e use "Adicionar à tela inicial" (Chrome: menu ⋮; Safari: botão Compartilhar). Depois da primeira visita o app abre também sem internet.
