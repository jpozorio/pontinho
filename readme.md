# Pontinho dos pituchas

PWA (Angular 21 + Ionic 9) para anotar os pontos do Pontinho em família. Funciona offline e guarda tudo no próprio aparelho (`localStorage`), sem servidor nem login.

## Rodar

Requer Node 20.19+ (CI usa Node 22).

```bash
npm install
npx ng serve
```

Abra http://localhost:4200.

## Testar

```bash
npx ng test --watch=false
```

## Publicar

O app é publicado em https://jpozorio.github.io/pontinho/ (rotas por hash, sem depender de `404.html`):

```bash
npx ng build --base-href /pontinho/
```

Publique o conteúdo de `dist/pontinho/browser` no GitHub Pages.
