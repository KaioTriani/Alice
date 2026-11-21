// Documentos, desenhos e fotografias que o jogador pode examinar.
export function buildDocs(images) {
  const D = {};
  D.drawing1 = { id: 'drawing1', title: 'Desenho de Emily', img: images.drawingFamily(), style: 'hand',
    text: 'Papai, mamãe, Emily e Tom na frente de casa.\nAtrás deles, uma quinta pessoa. Alta. Pintada de preto até rasgar o papel.\n\nNo verso, com letra de criança:\nELE NÃO GOSTA QUANDO A MAMÃE FICA SOZINHA.' };
  D.drawing2 = { id: 'drawing2', title: 'Desenho de Thomas', img: images.drawingHouse(), style: 'hand',
    text: 'A casa vista de cima, com a letra torta de quem tem cinco anos. No último quarto, um risco preto e comprido, apertado com tanta força que a cera brilha.\nDo lado de fora, uma porta pintada de giz branco. A casa não tem essa porta.\n\n"ELE FIKA AQI"\n"A PORTA BRANKA NAO E NOSA"' };
  D.drawing3 = { id: 'drawing3', title: 'Desenho deixado na cama', img: images.drawingRabbit(), style: 'hand',
    text: 'Um coelho branco com olhos vermelhos.\n\n"o coelho guarda o segredo dentro da barriga"' };
  D.book = { id: 'book', title: 'Alice no País das Maravilhas', pages: [
    { title: 'Capítulo I. Descendo a toca do coelho', text: 'Uma frase sublinhada a lápis, com força:\n\n"E, sem pensar em como faria para sair de lá depois, Alice foi atrás do coelho."\n\nNa margem, a letra de Daniel:\n"Você sempre lê esta parte duas vezes."' },
    { title: 'Bilhete dobrado dentro do livro', style: 'hand', text: 'Alice,\n\nA Dra. Lúcia disse que o remédio novo leva duas semanas para fazer efeito. Por favor, não pare de tomar. Nem quando as vozes disserem que não precisa.\n\nPor eles.\nEu ligo da conferência.\n\nD.' },
  ] };
  D.watch = { id: 'watch', title: 'Relógio de bolso', text: 'Parado às 4:15.\n\nGravado na tampa: "Para D., que nunca chega atrasado."\n\nO voo de Daniel caiu às 4:15 da tarde.' };
  D.photosBox = { id: 'photosBox', title: 'Caixa de fotografias', pages: [
    { title: 'Fotografia 1', img: images.photo('park'), text: 'Alice, Daniel e as crianças no parque.\nVerso: "Domingo de sol. Thomas não largou o coelho o dia inteiro."' },
    { title: 'Fotografia 2', img: images.photo('hold'), text: 'Alice segurando os dois filhos.\nVerso: "Minhas duas razões."' },
    { title: 'Fotografia 3', img: images.photo('dinner', true), text: 'A família na mesa de jantar.\nAtrás da cadeira de Daniel há uma mancha alta e escura, como alguém que ninguém viu quando a foto foi tirada.\nVerso: "Último jantar antes da viagem."' },
    { title: 'Fotografia 4', img: images.photo('alone'), text: 'Alice sozinha em frente à casa. As janelas estão escuras.\nVerso: em branco.' },
    { title: 'Fotografia 5', img: images.photo('hospital'), style: 'type', text: 'Alice em um quarto branco, sentada numa cama hospitalar. Ela olha para a câmera como se não a visse.\n\nVerso, datilografado:\nPACIENTE AINDA ACREDITA QUE ESTÁ EM CASA.' },
  ] };
  D.framePhotos = { id: 'framePhotos', title: 'Quatro fotografias soltas', pages: [
    { title: 'Casamento', img: images.photo('wedding'), text: 'Verso: "Nosso casamento. Choveu o dia todo e ninguém se importou."' },
    { title: 'A casa', img: images.photo('house'), text: 'Verso: "A casa nova. Daniel me carregou pela porta e quase caiu."' },
    { title: 'Emily', img: images.photo('emily'), text: 'Verso: "Emily chegou numa manhã de março."' },
    { title: 'Thomas', img: images.photo('thomas'), text: 'Verso: "Thomas, três anos depois. Emily escolheu o nome."' },
  ] };
  D.frameNote = { id: 'frameNote', title: 'Bilhete preso na moldura', style: 'hand', text: 'Quatro fotos, fora de ordem. Alguém mexeu nelas.\n\nUm bilhete preso no vidro da primeira:\n"Coloque na ordem em que tudo começou. D."\n\nAs anotações no verso de cada foto estão na caixa de fotografias.' };
  D.file = { id: 'file', title: 'Prontuário', style: 'type', text:
    'HOSPITAL PSIQUIÁTRICO SANTA CLARA\nALA C  ·  QUARTO 04\n\nPaciente: ALICE M.\nIdade: 42 anos\nInternação: 21/11/1998\n\n' +
    'Quadro: episódio psicótico grave iniciado após luto complicado (óbito do cônjuge em acidente aéreo, 03/1998). Alucinações auditivas. Reconstrução delirante do ambiente doméstico.\n\n' +
    'Ocorrência: na noite de 20/11/1998, durante surto psicótico agudo com delírio persecutório (acreditava que uma figura "de capa preta" viria levar os filhos), a paciente causou a morte dos dois filhos menores (E., 8 anos; T., 5 anos) na residência da família. Encontrada pela polícia sentada no corredor, dizendo que as crianças "estavam escondidas, a salvo". Considerada inimputável em laudo psiquiátrico.\n\n' +
    'Evolução: não reconhece o quarto. Refere estar em casa. Prepara refeições imaginárias três vezes ao dia. Pergunta pelos filhos à noite. Descreve uma figura alta, de capa preta, que "fala com a voz deles".\n\n' +
    'Conduta: manter medicação. Não confrontar de forma abrupta. Sessões diárias com o Dr. Ramos.' };
  D.vhsLabel = { id: 'vhsLabel', title: 'Fita VHS', text: 'Etiqueta escrita à mão por Daniel:\n"Para Alice. Assista quando estiver pronta."\n\nData na lombada: 28/03/1998.\nNove dias depois do acidente.' };
  return D;
}
