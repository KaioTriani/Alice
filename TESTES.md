# ALICE: relatório de testes

Ambiente: Windows 10, i7-5500U, Intel HD 5500, navegador embutido do Claude (Chromium). A aba de teste ficava marcada como oculta, então a simulação foi avançada quadro a quadro por script (`__alice.step(segundos)`), chamando as mesmas funções do loop real. Os comandos de mouse e teclado foram simulados chamando as interações diretamente.

## Campanha completa

| Etapa | Verificado |
|---|---|
| Prólogo | Falas, queda do avião, telefonema, cartões de título, despertar. Termina em "Prepare o café da manhã". |
| Café da manhã | Pão, café (segurar), pratos, pôr a mesa, chamar as crianças, passos correndo e sombra no corredor. |
| Quarto das crianças | Camas vazias, desenho com a quinta figura, avança ao ler. |
| Busca | Visita à sala, banheiro e lavanderia marcada automaticamente. TV liga sozinha, cadeira se move, porta da frente trancada, telefone, silhueta no fim do corredor que some ao ser encarada. |
| Rotina | Contador de brinquedos 0/4 a 4/4, baú, louça, encontro na cozinha com a entidade e apagão. |
| Ato II | Coelho no corredor, roupa da máquina, porta batendo, troca para a lavanderia duplicada, corredor impossível, relógio de bolso, porta do quarto no fim. |
| Roupas molhadas | Pegadas, visão dentro do guarda-roupa, desenho do coelho, tesoura, combinação coelho + tesoura gera a chave, gaveta da penteadeira, livro e bilhete. |
| Espelho | Entidade visível só no reflexo enquanto se limpa, some quando Alice se vira. |
| Jantar | Fogão, pratos, mesa, família só em som, sentar, mesa vazia com pratos sujos e casaco preto na cadeira virada, telefonema de Emily. |
| Ato III | Escritos nas paredes, luzes frias, lanterna na gaveta, descida ao porão, caixa de fotos, apagão, entidade surge no fundo e depois muito mais perto, "Por que você fez isso?". |
| Fuga | Perseguição com IA real, banheiro trancado, batidas, vozes, fade. |
| Ato IV | Porta branca, suporte de soro, fluorescente, 5 fotografias, fita de Daniel em VHS, entidade caçando pela casa, molduras em ordem cronológica, relógio bate e libera a chave branca, choro das crianças, escolha (quarto das crianças com a fita de Alice, ou porta branca). |
| Ato V | Corredor do hospital, diálogo com a entidade, apagão, porta 04 surge. |
| Final | Prontuário, gravação da entrevista, cartões com a verdade, mãos com pulseira, enfermeira, entidade no fim do corredor, três batidas, "Mamãe?", tela final com a nota de saúde mental. Save apagado ao terminar. |

## IA da entidade

| Cenário | Resultado |
|---|---|
| Caminhos entre todos os cômodos e no porão | Todos encontrados pelo A* (depois da correção abaixo). |
| Alice escondida no armário da lavanderia, prendendo a respiração quando ele chega perto | Entidade investigou o barulho, entrou na lavanderia, checou o armário, não abriu, foi checar a cama das crianças e a despensa, voltou depois. Alice não foi encontrada em 40 s de simulação. |
| Alice escondida sem prender a respiração, com estresse alto | Entidade ouviu a respiração ("Ele ouviu sua respiração."), abriu o armário e começou a luta. |
| Luta: apertar E 8 vezes | Alice escapou, entidade atordoada por 3 s e passou a procurar ao redor. |
| Ficar parado na frente dela na perseguição | Alice foi pega e a tela de "Alice perdeu os sentidos." apareceu. |

## Bugs encontrados e corrigidos

1. **Tela preta:** a câmera era criada com a janela em tamanho zero (proporção NaN). Agora a proporção é recalculada a cada quadro.
2. **Luz fraca demais:** as unidades físicas do Three.js dividem a luz difusa por PI. Ganho global aplicado.
3. **Legendas invisíveis no prólogo:** ficavam atrás da camada de fade. Ordem das camadas corrigida.
4. **Interações mortas após carregar o save:** o objeto de flags era substituído e as interações apontavam para o antigo. Agora ele é atualizado no lugar.
5. **Entidade "checando" esconderijos do corredor:** com raio de 30 cm a grade de navegação fechava as portas de 90 cm. Raio ajustado para 20 cm e a entidade agora precisa chegar perto para decidir.
6. **Entidade ouvindo as próprias portas:** portas abertas por ela não geram mais ruído para ela mesma.
7. **Eventos presos à pausa errada:** temporizadores de jogo usavam `setTimeout`. Trocados pelo relógio do jogo.
8. **Tela de morte não aparecia:** o fade dependia do relógio parado. O relógio agora avança durante a sequência de captura.
9. **Perseguição injusta no porão:** a entidade começava a correr colada em Alice. Agora ela leva 1,6 s para reagir.

## Segunda rodada (ajustes pedidos)

| Mudança | Verificado |
|---|---|
| Texturas sem "fundir": mipmaps, sem tremor de vértices por padrão (opcional em Vídeo), aberração cromática só com sanidade baixa, resolução interna 380p, tapetes sem z-fighting | Capturas do quarto e corredor |
| Iluminação: HDR com tonemapping, queda de luz suave, brilho ao redor das lâmpadas, luz do dia pelas janelas (apaga à noite), cantos escurecidos, menos luz vazando entre cômodos | Capturas do quarto, porão e hospital |
| Quintal: porta da sala de jantar, telhado, cerca, balanço que se move sozinho, árvores, varal, galpão, rua, poste, casas vizinhas, neblina da manhã | Tarefa "Regue as plantas (0/3)" completa; o homem aparece na calçada |
| Porta do quintal tranca ao anoitecer (jantar em diante) | `backLocked=true` no Ato III |
| Desenhos em giz de cera | Capturas dos três desenhos |
| Câmera no modo livre gira ao encostar o cursor na borda; setas também giram | Teste por script |
| Voltar ao menu, ao checkpoint e "Tentar novamente" sem recarregar a página | Menu, retry após morte e troca de checkpoint sem erros |
| Campanha completa de novo, da rotina ao final | Chegou à tela final |
| Bug: passo de tempo negativo fazia a altura da câmera divergir | Tempo limitado a zero ou mais |

## Terceira rodada (ambientação e modelos)

| Mudança | Verificado |
|---|---|
| Luzes não piscam mais à toa: o pool de luzes troca com fade suave e histerese (antes elas acendiam e apagavam de repente ao andar) | Nenhuma luz piscando na casa no Ato I |
| Piscar só em tensão: eventos roteirizados, diretor, entidade por perto ou caçando, corredor impossível e hospital. Falha de lâmpada realista (sem estroboscópio) | Lista de luzes com `flicker` |
| Documentos fecham só com E | Esc não fecha, E fecha |
| Móveis: poltrona virada para a TV, vaso sanitário com a caixa encostada na parede, estante aberta (livros, caixinha de música e foto visíveis), secadora com porta, estantes do porão abertas (caixa de fotos visível) | Capturas da sala, banheiro e cozinha |
| Modelos novos: cama, guarda-roupa, TV de tubo com antena, sofá, poltrona, cadeiras, pia de coluna, mesa de centro, frentes de portas e gavetas com puxadores, geladeira com ímãs, cafeteira, plantas, relógio, interruptores, cortinas, rodapés | Capturas |
| Itens novos: pilha, lanterna, tesoura, livro, chave, caixa de fotos, caixinha de música, pão, brinquedos (carrinho, bola, cubo, ursinho) | Coleta testada por script |
| Texturas: madeira, papel de parede, azulejo, tapete e pintura refeitos em resolução maior; tapetes sem repetição em grade; espelho sem conflito com a moldura | Capturas |

## Quarta rodada: partida completa com controles reais

Um jogador automático (`tools/bot.js`) jogou do aviso de conteúdo até a tela final usando as mesmas entradas de um jogador: anda com W (e Shift para correr), mira com a câmera, abre portas pelo caminho, aperta e segura E, usa o inventário pelos botões e fecha documentos com E. Resultado final: campanha inteira concluída, nenhum erro no console.

Bugs encontrados e corrigidos nessa partida:

| # | Bug | Efeito para o jogador | Correção |
|---|---|---|---|
| 1 | A figura do menu continuava "sendo vista" depois que o jogo começava | A sanidade zerava durante o prólogo; o jogo começava com distorção máxima | Visão da entidade é zerada quando ela some |
| 2 | Mira da interação usava a câmera do quadro anterior | Às vezes o E não fazia nada logo depois de virar | Câmera atualizada antes do raycast |
| 3 | Fechar documento com E reabria o mesmo documento | O desenho parecia não fechar nunca | A tecla que fecha o painel não vale para o mundo no mesmo quadro |
| 4 | Aparador da sala de jantar espremido entre mesa, cadeira e parede | Difícil pegar os pratos | Aparador movido para o canto livre, de frente para a passagem |
| 5 | Mesa de jantar atravessada deixava 60 cm nas laterais e a cadeira "assombrada" parava na frente da porta do quintal | Quase impossível chegar ao quintal | Mesa no sentido do comprimento (passagens de 80 cm); a cadeira agora aparece na sala, virada para a TV |
| 6 | Grade de navegação marcava células inteiras como bloqueadas | A entidade não passava onde uma pessoa passa | Bloqueio calculado pelo centro da célula |
| 7 | Quintal sobreposto ao corredor impossível e à visão do armário | No corredor impossível: neblina e luzes do quintal, chão piscando, sanidade errada | Áreas movidas para coordenadas livres |
| 8 | Início da perseguição no porão: 1,6 s para reagir de costas para a escada | Morte quase certa | 3,2 s de reação e aviso "Suba a escada!" |
| 9 | Ao subir do porão (ou ao tentar de novo), a entidade surgia em cima do jogador | Morte instantânea sem chance | Surge só com o jogador a 3 m da porta (ou após 3 s) e leva 0,8 s para reagir; checkpoint da fuga começa mais longe |
| 10 | Caçada do quebra-cabeça começava 4 s após o checkpoint | Morte antes de entender as molduras | Começa depois de ler o bilhete das molduras (ou 25 s), agressividade 0,7 |
| 11 | Chave branca pequena dentro de uma gaveta na altura do joelho | Difícil de ver e de mirar | Cai do relógio no tapete do corredor, com som e mensagem |
| 12 | Itens pequenos com área de mira minúscula | Pilhas, chave e relógio exigiam mira perfeita | Área de interação mínima de 28 cm em todos os coletáveis |
| 13 | Objetivo antigo ("FUJA") aparecia durante o título do Ato IV | Confuso | Objetivo limpo no início de cada ato |
| 14 | Figura final a 25 m dentro da neblina branca | A imagem final quase não aparecia | Figura a 16 m, bem visível pela porta |
| 15 | Texto "Pegar alice no país das maravilhas" | Estranho | "Pegar o livro" |
| 16 | Reflexo do espelho estourado e espelho da penteadeira branco chapado | Visual estranho | Tons ajustados |

## Rodada final (versão 1.0)

| Mudança | Verificado |
|---|---|
| Aviso de conteúdo sem spoilers (só "luto, saúde mental e perda") | Texto conferido na tela |
| Revelação explícita: na fita, Alice conta que achou que o homem de preto ia levar os filhos; o médico responde "Foi você."; cartões finais explicam a psicose sem tratamento, a crise de 20/11 e que ela tirou a vida de Emily e Thomas tentando protegê-los. Prontuário atualizado. Sem descrição de violência | Falas e cartões rodados por script, sem erros |
| Segurar E pula a abertura desenhada | Pulou e caiu direto no café da manhã |
| Exportar/Importar save em Configurações > Jogo | Botões presentes; formato do save igual ao do jogo |
| Câmera não gira sozinha; passos mais presentes | Rodada anterior |
| Executável Windows (Electron) com ícone próprio, tela cheia e save local | Ver abaixo |

## Não verificado nesta sessão

- Sensação real de controle com mouse travado (pointer lock) e o ritmo jogando de verdade: o navegador de teste não permite capturar o mouse por script.
- Qualidade das vozes sintetizadas: depende das vozes instaladas no Windows do jogador.
- Taxa de quadros em tela cheia na própria máquina. Na aba de teste, cada quadro levou cerca de 13 ms.
