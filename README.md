# ALICE

*Toda casa tem seus segredos.*

Jogo de terror psicológico em primeira pessoa, 3D low poly com estética de fita VHS do fim dos anos 1990. Baseado no documento de design "ALICE: The House That Remembers".

## Como jogar

1. Instale o [Node.js](https://nodejs.org) (qualquer versão 18 ou mais nova).
2. Dê dois cliques em `INICIAR.bat`. O navegador abre em `http://localhost:5180`.
   - Ou, no terminal, dentro desta pasta: `node server.js`
3. Use fones de ouvido. Clique na tela para capturar o mouse.

Não precisa de instalação de pacotes: o motor gráfico (Three.js) já está em `lib/`.

## Versão para computador (executável Windows)

O executável fica em `dist/ALICE-win32-x64/ALICE.exe`. Para distribuir, compacte a pasta `ALICE-win32-x64` inteira (o `.exe` precisa dos arquivos ao lado dele). Não precisa instalar nada nem ter internet.

- Abre em tela cheia. **F11** alterna janela e tela cheia. **Alt+F4** fecha.
- O progresso fica salvo no Windows do jogador (pasta de dados do app), separado do navegador.
- Para levar um save do navegador para o executável: no jogo do navegador, **Configurações > Jogo > Exportar save**; no executável, **Importar save** e depois **Continuar**.

Para gerar de novo depois de mudar o código (precisa do Node.js):

```
npm install
npm run build
```

O script `tools/build-exe.ps1` monta o executável usando o descompactador do Windows (o do `electron-packager` trava no Node.js 26) e aplica o ícone com `tools/set-exe-info.mjs`. Também gera `dist/ALICE-1.0.0-windows.zip`, pronto para enviar.

## Publicar num site (Hostinger)

O jogo é 100% estático (HTML, CSS e JavaScript). Não precisa de Node.js no servidor.

1. No hPanel da Hostinger, abra o **Gerenciador de Arquivos** do domínio (ou subdomínio de testes).
2. Entre em `public_html` (ou numa subpasta, por exemplo `public_html/alice`).
3. Envie **todo o conteúdo** desta pasta mantendo a estrutura: `index.html`, `style.css`, `.htaccess`, `lib/`, `src/`.
   - Os arquivos `server.js`, `INICIAR.bat`, `electron-main.js`, `package.json`, `tools/` e os `.md` não são necessários no site (não atrapalham se forem junto). A pasta `build/` só precisa do `icon.png` (ícone da aba).
   - Alternativa: em **Avançado > Git**, conecte este repositório e faça o deploy direto para `public_html`.
4. Acesse o endereço no Chrome, Edge ou Firefox. Precisa de HTTPS ou localhost para o mouse ser capturado (a Hostinger já dá HTTPS grátis).

O `.htaccess` incluído desliga o cache (bom para testes: cada envio aparece na hora), ativa compressão e garante o tipo certo dos arquivos `.js`. O save fica no navegador de cada jogador (localStorage).

## Controles (remapeáveis em Configurações)

| Ação | Tecla |
|---|---|
| Andar | W A S D |
| Olhar | Mouse (ou setas do teclado) |
| Interagir / sair do esconderijo | E |
| Correr (gasta fôlego) | Shift |
| Agachar (alterna) | C |
| Inclinar à esquerda / direita | Q / R |
| Lanterna | F |
| Inventário | I |
| Objetivos e documentos | Tab |
| Prender a respiração (escondida) | Espaço (segurar) |
| Pausar | Esc |

O agachar fica no C e não no Ctrl porque Ctrl+W fecha a aba do navegador.

## Estrutura

```
alice/
  index.html, style.css     interface (menus, HUD, painéis)
  server.js, INICIAR.bat    servidor local sem dependências
  lib/                      Three.js r170 (MIT) e Reflector (espelho)
  src/
    main.js                 loop principal, pausa, save, captura, efeitos
    core/                   eventos, entrada, configurações
    render/                 renderizador retrô (pós-processamento) e texturas procedurais
    world/                  construtor, casa e todas as áreas, luzes, navegação (A*)
    audio/                  áudio 100% sintetizado, 3D e com oclusão
    game/                   jogador, interação, esconderijos, inventário, sanidade,
                            lanterna, entidade (IA), diretor, documentos, campanha
    ui/                     interface
```

Detalhes técnicos em [ARQUITETURA.md](ARQUITETURA.md). Relatório de testes em [TESTES.md](TESTES.md).

## Ferramenta de desenvolvimento

No console do navegador (F12):

```js
aliceDebug.stages()        // lista os checkpoints
aliceDebug.goto('act3')    // salta para um checkpoint e recarrega
```

## Limitações conhecidas

- **Não é Unreal Engine 5.** O PC de desenvolvimento (Intel HD 5500, 8 GB de RAM) não roda o editor do UE5. O jogo foi feito em Three.js/WebGL, que roda nesta máquina e casa com a estética low poly pedida. A arquitetura (componentes, diretor, IA por percepção, dados separados da lógica) foi pensada para ser portada.
- **Vozes:** não há dublagem gravada. As falas aparecem em legenda, com sussurros e respirações posicionados em 3D. A voz sintetizada do Windows existe como opção experimental (Configurações > Jogo), desligada por padrão.
- **Modelos:** tudo é construído por código com primitivas low poly. Não há modelos importados.
- **Duração:** a campanha completa (prólogo, cinco atos e final) leva cerca de 35 a 50 minutos, não as 2 a 4 horas do GDD. A estrutura de etapas permite expandir cada ato.
- **Executável:** não há `.exe` empacotado. Dá para empacotar depois com Electron ou NW.js sem mudar o código.
