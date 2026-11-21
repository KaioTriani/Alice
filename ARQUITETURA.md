# ALICE: arquitetura técnica

## Visão geral

`src/main.js` cria um objeto `Game` que contém todos os sistemas e roda um loop fixo:

```
entrada -> jogador -> interação -> esconderijo -> entidade -> diretor -> sanidade/estresse -> lanterna -> história
       -> luzes -> neblina -> efeitos -> áudio (ouvinte, oclusão) -> HUD -> render
```

A simulação para quando o jogo está pausado, quando um painel (documento, inventário, diário) está aberto ou quando Alice é pega. Todas as esperas da história usam o relógio do jogo (`g.wait`, `g.until`), então pausar congela também os eventos roteirizados.

## Sistemas

| Sistema | Arquivo | Papel |
|---|---|---|
| Renderizador retrô | `render/retro.js` | Cena em 270p num render target, depois pós-processamento: grão, vinheta, aberração cromática, dessaturação, distorção ondulada, linhas de tracking VHS, dithering Bayer e quantização em 15 bits. Vértices "tremem" como no PS1 (`psx()`), com opção de desligar. |
| Texturas | `render/textures.js` | Madeira, papéis de parede, azulejos, concreto, vinil, janelas, desenhos infantis, fotos envelhecidas, calendário e escritos na parede, todos gerados em canvas. |
| Construtor | `world/builder.js` | Caixas com UV em escala de mundo, paredes com vãos de porta, colisores AABB, oclusores, zonas e cômodos. |
| Áreas | `world/house.js` | Casa (8 cômodos e corredor), porão, corredor impossível, visão do armário, hospital e quarto 04. |
| Luzes | `world/lights.js` | Pool fixo de 6 luzes pontuais distribuídas pelos pontos de luz mais próximos (sem recompilar shaders; cabe numa GPU integrada). Humor quente ou frio por ato, cintilação e apagão. |
| Navegação | `world/nav.js` | Grade de 25 cm por zona, A* com 8 direções e suavização por linha de visão. Portas trancadas bloqueiam. |
| Jogador | `game/player.js` | Andar, correr com fôlego, agachar, inclinar (com checagem de parede), balanço de câmera, passos por superfície que geram ruído para a IA. |
| Interação | `game/interact.js` | `Interactable` genérico (instantâneo ou "segure E"), `Door` articulada com tranca e chave, `Drawer` deslizante. Raycast do centro da tela, bloqueado por paredes. |
| Esconderijos | `game/hiding.js` | Guarda-roupas, despensa, armário, embaixo da cama e atrás da cortina. Câmera restrita, sobreposição visual, prender a respiração gastando fôlego, ofego forçado que faz barulho, luta para escapar quando descoberta. |
| Inventário | `game/inventory.js` | Itens com ícone, descrição, uso e combinação (coelho + tesoura, lanterna + pilha). |
| Sanidade e estresse | `game/status.js` | Sanidade (0 a 100, longo prazo, 5 estágios) cai no escuro, ao ver a entidade e em eventos, e se recupera devagar na luz e com objetos de conforto. Estresse (perigo imediato) controla batimento, respiração, tremor da câmera e da lanterna. Fôlego é separado dos dois. |
| Lanterna | `game/flashlight.js` | Bateria, pilhas, cintilação com bateria fraca e em eventos. |
| Entidade | `game/entity.js` | Ver abaixo. |
| Diretor | `game/director.js` | Ver abaixo. |
| História | `game/story.js` | Gerenciador de tarefas e as 15 etapas da campanha. |
| Documentos | `game/docs.js` | Desenhos, livro, fotografias, prontuário. |
| Áudio | `audio/audio.js` | Todos os sons sintetizados com Web Audio: passos por superfície, portas, telefone, estática, geladeira, relógio, fluorescente, monitor cardíaco, batimento, respiração, sussurros, risadas, choro, caixinha de música original. Som 3D com HRTF, reverberação e filtro passa-baixa por oclusão. Vozes com legenda e síntese opcional. |
| Interface | `ui/ui.js` | Menu, dificuldade, pausa, configurações em 5 abas com remapeamento, HUD discreto (olho que se fecha e racha com a sanidade), inventário, diário, visualizador de documentos com páginas, VHS, legendas com nome de quem fala. |

## A entidade (IA)

Máquina de estados: `dormant`, `scripted` (aparição roteirizada), `patrol`, `investigate`, `search`, `check` (checar esconderijo), `chase`, `lose`, além do atordoamento após a luta.

- **Visão:** cone de cerca de 130 graus, alcance que depende de quanta luz está sobre Alice (lanterna ligada aumenta muito, agachar reduz), linha de visão por raycast contra paredes e portas. Gera uma "consciência" que sobe aos poucos; só ao chegar em 1 vira perseguição.
- **Audição:** passos (correr se ouve de longe, agachar quase nada), portas, gavetas, entrar e sair de esconderijos, ofego. Paredes abafam. A entidade vai até o ponto do som com erro de até 80 cm.
- **Memória:** guarda a última posição conhecida. Ao perder Alice de vista, procura ao redor e checa até 3 esconderijos próximos.
- **Esconderijos:** para em frente, escuta por 1,4 s. Decide abrir por evidência: se viu Alice entrar, se ouviu a respiração (raio depende do estresse; zero se ela estiver prendendo o fôlego) e o quanto o esconderijo é seguro. Pode abrir esconderijos vazios. Se abrir com Alice dentro, começa a luta.
- **Sem trapaça:** nunca sabe a posição exata de Alice. Nunca surge atrás dela em jogo normal. Fala só com as vozes da família.

## O diretor

- Agenda eventos ambientes por estágio de sanidade e ato: passos distantes, batidas, rangidos, risadas, sussurros atrás de Alice, sombras na visão periférica que somem quando olhadas, passos falsos, falsas aparições, telefone tocando.
- Durante caçadas, dá à entidade uma dica da *área* onde Alice está (o cômodo, não a posição) a cada 22 a 38 s, e para de dar dicas por 30 s depois que a entidade perde Alice, para dar respiro.
- Ao iniciar uma caçada, escolhe um ponto a mais de 9 m e fora da linha de visão.

## Campanha e checkpoints

`story.js` define as etapas em ordem. Cada etapa pode ter `before` (humor do ato), `run` (roteiro assíncrono) e `after` (estado permanente do mundo). Etapas com `cp: true` salvam no `localStorage`:

`prologue`, `routine`, `act2`, `mirror`, `act3`, `chase`, `act4`, `puzzle`, `act5`.

Ao carregar, o jogo recarrega a página, recria o mundo do zero e reaplica o `before`/`after` de todas as etapas anteriores. Isso evita estados quebrados no meio de cinemáticas. O save guarda etapa, dificuldade, inventário, flags, coletáveis pegos, documentos lidos, sanidade e bateria.

## Desempenho

- Resolução interna de 270p (ajustável de 160p a 540p).
- Material Lambert (barato) e 6 luzes fixas no pool.
- Cerca de 800 chamadas de desenho por quadro. Nos testes desta máquina, cada quadro completo (lógica e render) levou cerca de 13 ms. Se precisar de mais folga, o próximo passo é mesclar a geometria estática por material.
