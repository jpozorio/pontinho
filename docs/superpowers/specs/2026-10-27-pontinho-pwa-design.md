# Pontinho PWA — Design

Data: 2026-10-27

## Intenção

O app "Pontinho dos pituchas" é usado pela família para anotar os pontos de um jogo de baralho (pontinho) e acertar o dinheiro no fim. A versão atual (Ionic 4 RC + Angular 7 + Cordova, de 2018) tem problemas sérios de usabilidade e navegação:

- os jogadores querem saber **a qualquer momento** quantos pontos têm e quanto falta para estourar — inclusive enquanto os pontos da rodada atual estão sendo digitados — e hoje isso só aparece numa tela intermediária;
- o histórico de rodadas é confuso;
- o relatório final de pagamentos confunde;
- nada é salvo: fechar o app perde a partida.

O objetivo é reescrever o app como **PWA**, com navegação simples, estado sempre salvo e o placar sempre visível. O sucesso é a família aceitar usar o app na mesa no lugar do caderno.

## Objetivos

1. Total e "faltam X para estourar" de cada jogador visíveis em todo momento, atualizando ao vivo durante o lançamento dos pontos.
2. Histórico de rodadas legível, no mesmo formato do caderno da família (jogadores nas colunas).
3. Controle de dinheiro claro: quanto cada um deve, quanto pagou, registro de pagamento na hora, acordo entre os dois últimos, relatório final com saldo.
4. Estado persistido localmente a cada ação; reabrir o app retoma a partida exatamente onde estava.
5. Instalável como PWA, funciona offline, publicado no GitHub Pages.

## Não-objetivos

- Contas, login, sincronização entre celulares ou servidor. Tudo roda em um único aparelho.
- Build nativo (Cordova/Capacitor, APK). O `pontinho.apk` e a configuração Cordova deixam de ser mantidos.
- Estatísticas de longo prazo / ranking entre partidas.
- Migrar o código antigo — as telas são reescritas.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Ter que trocar de tela para descobrir quanto falta para alguém estourar.
- Histórico em formato diferente do caderno (jogadores nas linhas) — a família rejeitaria.
- Perder uma partida em andamento por fechar o navegador, recarregar a página ou o celular matar o app.
- Fluxo que obriga a seguir uma ordem rígida de telas sem conseguir corrigir um erro de digitação.

## Regras do jogo (como a família joga)

### Pontuação
- Pontuação acumulada por jogador. **Estoura ao chegar a 100** (≥ 100).
- "Faltam X" = `99 − total` (quantos pontos ainda pode levar sem estourar).
- Em cada rodada, cada jogador ativo recebe **pontos** (inteiro ≥ 0) **ou** é marcado como **"estourou"** sem informar pontos (quando ele já sabe que passou e não diz quantos fez). "Estourou" equivale a total ≥ 100.

### Fim de rodada
Ao fechar a rodada (só possível com todos os jogadores ativos com pontos ou "estourou"):
1. Atualiza os totais.
2. Se **apenas um** jogador ficou abaixo de 100 → ele **vence** e a partida acaba (não há reentrada nesse caso).
   - Pela regra do jogo, **sempre alguém fica abaixo de 100**. O app impede fechar uma rodada em que todos estourariam ("pelo menos um jogador fica abaixo de 100 — confira os pontos").
3. Caso contrário, cada jogador que estourou decide **reentrar** ou **sair**.
   - Quem reentra volta com o **maior total entre os jogadores que não estouraram** (calculado após a rodada em que estourou) e soma uma entrada à sua dívida.
   - Quem sai deixa de jogar as próximas rodadas.
   - **A decisão pode ser mudada até a rodada seguinte ser fechada.** Ex.: disse "saio" e depois "vou entrar" — o app aceita enquanto a próxima rodada não for fechada. Após isso, a decisão fica fixa.
   - *Decisão do Claude:* durante a rodada seguinte, o jogador com decisão aberta aparece na aba Rodada. Se está como "entra", é um jogador ativo normal (campo de pontos, exigido para fechar). Se está como "sai", aparece em cinza com um botão "voltar a entrar" e sem campo de pontos; ao trocar para "entra", ganha o campo de pontos daquela rodada. O total de reentrada é sempre o maior total entre os não estourados **na rodada em que ele estourou**. Contagens de "ativos" (vencedor, acordo, quem dá as cartas) usam a decisão atual.
4. O baralho passa para o próximo jogador ativo na ordem da mesa.

### Reentrada — limite por partida
Configurado no início de cada partida: **uma reentrada por jogador** ou **ilimitada** (até alguém vencer). Com limite atingido, o jogador que estoura sai.

### Dinheiro
- Valor da entrada definido por partida (fixo durante a partida).
- Cada jogador **deve** ao pote: `(1 + reentradas) × entrada`.
- Pagamentos podem acontecer a qualquer momento — no início, na reentrada ou no final — e **cada pagamento é registrado na hora** em que acontece (jogador, valor).
- Pote = soma do que todos devem (o que é devido, não só o que foi pago).
- **Vencedor leva o pote.**
- **Acordo:** quando restam exatamente dois jogadores ativos, eles podem fazer um acordo: cada um "salva" um valor livre negociado na hora (pode ser diferente para cada um), que sai do pote. Eles **continuam jogando** e o vencedor leva o restante. Exemplo real: cada um salvou 2× a entrada.
- **Dívida em aberto fica guardada** por jogador (identificado pelo nome) e aparece nas partidas seguintes até ser paga — mesmo que o jogador não participe da partida seguinte, a dívida reaparece quando ele voltar.
  - *Decisão do Claude:* a dívida antiga é um valor que o jogador deve **ao vencedor da partida em que ela surgiu** (não entra no pote novo). A aba Dinheiro e o fim de jogo mostram "deve R$ X ao Fulano (partida de dd/mm)". Pagamentos registrados quitam primeiro a dívida antiga, depois a da partida atual.
- Jogadores **não entram nem saem no meio de uma partida** (exceto saindo por estouro). A lista de jogadores só é editada antes de começar.

## Experiência — telas

Navegação por **abas fixas na parte de baixo** durante a partida: **Rodada · Histórico · Dinheiro**. Sem menu lateral.

### Novo jogo / jogadores
- Lista de jogadores: adicionar, remover, reordenar (a ordem define quem dá as cartas). Suporta até pelo menos 8 jogadores.
- Valor da entrada e regra de reentrada (uma / ilimitada).
- Ao iniciar uma nova partida após o fim de outra, a lista vem pré-preenchida com os mesmos jogadores, o **vencedor primeiro a dar as cartas**, dívidas anteriores carregadas — e tudo pode ser editado.
- Não é possível iniciar uma nova partida com outra em andamento sem confirmação explícita (abandonar a atual).

### Aba Rodada (tela principal) — layout "um cartão por jogador"
- Cabeçalho: número da rodada e quem dá as cartas; pote atual.
- Uma linha por jogador ativo: nome, `total atual → total com os pontos digitados`, campo de pontos (teclado numérico), botão "estourou", e **"faltam X"** grande com cor (verde/folgado, laranja/perto, vermelho/estourou). Atualiza a cada tecla.
- Indicação de reentradas do jogador.
- Jogadores com decisão de reentrada pendente/alterável (estouraram na rodada anterior) aparecem com a opção "reentra / sai" ainda editável.
- Botão "Fechar rodada", desabilitado (com motivo) até todos terem pontos ou "estourou".
- Após fechar, se houver estourados: diálogo por jogador — reentra ou sai; se reentra, "pagou agora?" (registra pagamento).

### Aba Histórico — formato caderno
- **Jogadores nas colunas, rodadas nas linhas**, nomes completos, **rolagem horizontal** quando não cabe. Número da rodada fixo à esquerda; cabeçalho com nomes fixo no topo; linhas de **total** e **faltam** fixas embaixo.
- Estouro (💥) e reentrada (↻ com o total de volta) marcados na rodada em que aconteceram; quem saiu fica cinza.
- Tocar numa rodada permite **corrigir** os pontos lançados; os totais e consequências são recalculados.
  - *Decisão do Claude:* qualquer rodada pode ser corrigida desde que a correção **não mude quem estourou** em nenhuma rodada nem quem venceu. Se mudar, o app avisa e oferece **desfazer as rodadas a partir daquela** (com confirmação), para relançar. "Desfazer última rodada" é sempre possível, inclusive após o fim de jogo (reabre a partida).

### Aba Dinheiro
- Por jogador: entradas (1 + reentradas), quanto deve, quanto pagou, dívida trazida de partida anterior; botão **"+ pagou"** para registrar pagamento.
- Pote e quanto ainda falta entrar no pote.
- Botão **"Fazer acordo"** visível apenas quando restam 2 jogadores ativos; registra quanto cada um salva.
  - *Decisão do Claude:* o acordo pode ser editado ou removido enquanto a partida não termina. Se uma correção/desfazer trouxer de volta um terceiro jogador, o acordo é removido (com aviso).

### Fim de jogo
- Vencedor, número de rodadas.
- Como o pote foi dividido (acordo, se houve, e o resto ao vencedor).
- Tabela por jogador: **pôs / recebe / saldo**.
- Quem ainda deve, com **"+ pagou"** para acertar ali mesmo.
- Botão "Nova partida com os mesmos jogadores".

### Mockups de referência
`.superpowers/brainstorm/3150822-1793105924/content/` — `tela-rodada.html` (opção A escolhida), `historico-dinheiro.html`, `historico-v3.html` (formato caderno; usar a variante com rolagem horizontal e nomes completos).

## Restrições técnicas (decididas)

- **Ionic (atual, v8) + Angular (atual)**, reescrito do zero no mesmo repositório (substitui o código Ionic 4/Cordova). — *escolha do Claude, aceita implicitamente; o usuário pode trocar.*
- **PWA**: manifest + service worker, instalável, funciona offline.
- **Hospedagem: GitHub Pages** do repositório `jpozorio/pontinho` (`https://jpozorio.github.io/pontinho/`), deploy automático via GitHub Actions a cada push na `master`. Atenção ao `base href` `/pontinho/`.
- **Persistência local** no aparelho, salva a cada ação, sobrevive a recarregar/fechar.
- Interface em **português**.

## Deixado para quem implementar

- Modelo de dados e mecanismo de persistência (localStorage vs IndexedDB), desde que salve a cada ação e permita recalcular tudo a partir do registro de rodadas/decisões/pagamentos (recomendado: guardar eventos/entradas brutas e derivar totais).
- Paleta, ícone, tipografia (manter o nome "Pontinho dos pituchas").
- Limiares exatos das cores do "faltam".
- Estratégia de testes (a lógica de regras deve ter testes unitários).
- Destino dos arquivos antigos (Cordova, `resources/`, `pontinho.apk`).
