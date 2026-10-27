# Caixa da noite — Design

Data: 2026-10-27
Depende de: `2026-10-27-pontinho-pwa-design.md` (app já publicado)

## Intenção

A família joga várias partidas na mesma noite e **não acerta o dinheiro a cada partida**: deixa acumular e acerta no fim da noite. Quem decide parar no meio da noite sai da mesa e acerta na hora ou depois. O dinheiro pago durante a noite geralmente vai para um **caixa comum** guardado por alguém, mas às vezes vai direto de um jogador para outro.

Hoje o app trata o dinheiro **por partida**: a aba Dinheiro só existe durante a partida, e o que alguém não paga vira dívida com o vencedor daquela partida. Isso não bate com o jeito de jogar. O objetivo é trocar isso por um **caixa da noite**, sempre acessível, com o saldo acumulado de cada jogador ao longo de todas as partidas da noite.

## Objetivos

1. Ver a qualquer momento — durante a partida, no fim de jogo, entre partidas — quanto cada jogador **deve** ou **tem a receber** no acumulado da noite, e quanto dinheiro está **no caixa**.
2. Registrar movimentos de dinheiro na hora: jogador → caixa, caixa → jogador, jogador → jogador.
3. Permitir que um jogador **saia da mesa** no meio da noite vendo o saldo dele e acertando na hora (ou não).
4. **Acerto final** da noite: mostrar quem paga e quem recebe, registrar os pagamentos, fechar a noite. O que ficar sem pagar vira **pendência** fora do caixa ("Beto deve R$ 20 à Ana"), que pode ser marcada como paga depois.

## Não-objetivos

- Histórico detalhado de noites antigas (só as pendências sobrevivem ao fechamento).
- Vários caixas ou vários "guardiões" de caixa.
- Juntar noites: cada noite começa do zero.

## Anti-objetivos

- Ter que acertar o dinheiro a cada partida para conseguir começar a próxima.
- Mostrar "dívida com o vencedor" por partida — é o modelo que estamos abandonando.
- Perder o saldo da noite por fechar o app ou recarregar.

## Regras

### Noite
- Uma **noite** começa quando a primeira partida é iniciada sem noite aberta, e termina no **Acerto final**.
- Todas as partidas iniciadas enquanto a noite está aberta pertencem a ela.
- *Decisão do Claude:* não é possível fazer o Acerto final com partida em andamento — o app pede para terminar ou abandonar a partida antes.
- *Decisão do Claude:* uma partida **conta para a noite assim que termina** (tem vencedor), mesmo antes de "Nova partida". "Desfazer última rodada" no fim de jogo continua possível até a próxima partida começar; os saldos são sempre recalculados a partir das partidas e movimentos, então desfazer só muda os números.
- *Decisão do Claude:* uma partida **abandonada não conta** para a noite (nem o que cada um pôs nela). Os movimentos registrados durante ela continuam valendo, porque o dinheiro realmente mudou de mão — quem pagou entrada aparece com crédito e recebe de volta no acerto. A confirmação de abandonar avisa: "Os pontos desta partida serão descartados. Pagamentos feitos continuam no caixa." Uma noite sem partidas terminadas continua aberta normalmente.

### Resultado de cada partida
Igual ao que já existe (`Settlement`): cada jogador **pôs** `(1 + reentradas) × entrada` e **recebe** o prêmio (vencedor: pote − o que o parceiro do acordo salvou; parceiro do acordo: o que salvou; demais: 0). `resultado = recebe − pôs`.
- *Decisão do Claude:* durante uma partida em andamento, o que o jogador **pôs até agora** (entradas e reentradas) já conta como negativo no saldo da noite; o prêmio só entra quando a partida termina.

### Saldo do jogador na noite
`saldo = Σ resultados das partidas da noite + Σ pago por ele (ao caixa ou a outro jogador) − Σ recebido por ele (do caixa ou de outro jogador)`

- `saldo < 0` → "deve R$ |saldo|"; `saldo > 0` → "tem a receber R$ saldo"; `0` → "acertado".

### Movimentos (lançamentos de dinheiro)
Três tipos, todos com data/hora e valor > 0, removíveis (com confirmação) enquanto a noite está aberta:
- **Jogador paga ao caixa** (entrada, reentrada, acerto de dívida).
- **Caixa paga ao jogador**.
- **Jogador paga a outro jogador** (quem paga: saldo sobe; quem recebe: saldo desce; caixa não muda).

**Dinheiro no caixa** = Σ pago ao caixa − Σ pago pelo caixa. *Decisão do Claude:* o caixa **não pode ficar negativo** — "caixa paga ao jogador" é limitado ao dinheiro que há no caixa (com mensagem). Consequência útil: a soma dos saldos de todos os jogadores é sempre igual ao dinheiro no caixa.

Os pagamentos "+ pagou" que hoje existem na partida (ao reentrar, na aba Dinheiro, no fim de jogo) passam a ser **jogador → caixa** da noite.

### Saída de um jogador no meio da noite
Não há estado especial: o jogador simplesmente não é incluído nas próximas partidas. O caixa mostra o saldo dele e permite acertar (pagar ao caixa, receber do caixa, ou pagar/receber de outro jogador).

### Acerto final
1. Mostra a lista de quem **paga** (saldo < 0) e quem **recebe** (saldo > 0), e o dinheiro no caixa.
2. Para cada devedor: botão "pagou ao caixa" (valor = o que deve, editável). Para cada credor: "recebeu do caixa" (valor = a receber, limitado ao que há no caixa). Também é possível lançar pagamento direto entre jogadores.
3. "Fechar a noite" só fica disponível com o **caixa zerado** (*decisão do Claude*): enquanto houver dinheiro no caixa, há credor a pagar com ele, e o app mostra "Ainda há R$ X no caixa — pague os credores antes de fechar". Com o caixa zerado, o que os devedores não pagaram é exatamente o que os credores não receberam; cada valor vira **pendência** "Devedor deve R$ X a Credor" (*decisão do Claude:* distribuição gulosa — maior dívida para o maior crédito em aberto).
4. A noite fecha: saldos, movimentos e caixa zeram; a próxima partida abre uma noite nova.

### Pendências
- Lista separada, fora do caixa, que sobrevive ao fechamento da noite.
- Cada pendência: devedor, credor, valor, data da noite. Botão "pago" (com confirmação) remove a pendência.
- Visível na tela do caixa e na tela de Novo jogo (junto ao nome do jogador, como hoje aparece "deve R$ X"; o credor vê "a receber de Beto R$ X").
- *Decisão do Claude:* pendências **não entram no saldo da noite nova** nem passam pelo caixa — são só um registro; "pago" apenas remove.
- Substitui as "dívidas antigas" (`Debt` por vencedor) do modelo atual.

## Telas

### Caixa (nova, substitui a aba Dinheiro)
- Acessível pela aba **Caixa** durante a partida (no lugar de "Dinheiro"), por um botão "Caixa" no **Fim de jogo** e na tela **Novo jogo**, e quando não há partida.
- Topo: **Dinheiro no caixa R$ X**; nº de partidas da noite.
- Se houver partida em andamento: bloco "Partida atual" com pote da partida e o botão **Fazer acordo** (regras do acordo inalteradas; continua só com 2 jogadores).
- Lista de jogadores da noite (todos que jogaram alguma partida): nome, **deve R$ X / tem a receber R$ Y / acertado**, e ações: "pagou ao caixa", "recebeu do caixa", "pagou a…" (escolhe outro jogador).
- Movimentos da noite (mais recentes primeiro), com remover.
- Botão **Acerto final** (abre o fluxo acima).
- Seção **Pendências** (se houver).

### Ajustes nas telas existentes
- **Rodada**: "Pagou agora?" ao reentrar continua, lançando jogador → caixa.
- **Fim de jogo**: mantém vencedor, divisão do pote e a tabela Pôs/Recebe/Saldo **da partida**; acrescenta o **saldo acumulado na noite** de cada jogador e o botão "Caixa". Remove "Ainda falta pagar" e o aviso "fica como dívida com {vencedor}".
- **Novo jogo**: mostra "deve R$ X" a partir das **pendências** e, se a noite estiver aberta, o saldo da noite de cada nome; botão "Caixa".

## Dados e persistência
- Continua tudo local (`localStorage`), salvo a cada ação.
- Novo formato (versão 2) com, além da partida atual: a **noite aberta** (partidas terminadas dela, movimentos) e a lista de **pendências**.
- **Migração da versão 1:** partidas já terminadas e a partida em andamento passam a fazer parte de **uma** noite aberta; cada pagamento existente vira um movimento jogador → caixa; as dívidas antigas por vencedor são descartadas (o saldo da noite já as cobre, porque inclui todas as partidas migradas). *Decisão do Claude* — o app está em uso há poucas horas; a partida em andamento não pode ser perdida.

## Deixado para quem implementar
- Formato exato dos tipos e onde ficam as funções (seguir o padrão atual: regras puras em `src/app/domain/`, store orquestra, páginas finas).
- Layout detalhado da tela Caixa (seguir o estilo das telas atuais; legível em 360px).
- Algoritmo de sugestão de pagamentos entre jogadores no acerto (opcional; o padrão é tudo via caixa).
