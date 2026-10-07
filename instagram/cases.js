/*
  Dados dos carrosséis de case.
  Tudo entre [colchetes] aparece em AMARELO na arte: é o que falta confirmar ou trocar.
  Quando não sobrar nenhum colchete, a arte está pronta para postar.
  *asteriscos* deixam a palavra em destaque (verde neon).

  Fotos: coloque o arquivo em instagram/fotos/ e escreva o caminho, ex.: "fotos/dr-capa.jpg".

  Abrir no navegador:  instagram/case.html?c=dr
  Exportar PNGs:       node instagram/render.mjs dr
*/
window.CASES = {
  dr: {
    cliente: "DR Veículos",
    segmento: "Loja de seminovos",
    cidade: "[Cidade]",
    foto: "",
    fotoDica: "Foto do Tiago na loja (pode ser um frame do Reel)",
    capa: "De [X] para *[Y] contatos* por mês.",
    capaSub: "[Em uma frase, o que mudou. Ex.: como a loja parou de depender só de indicação.]",
    antes: [
      "[Ex.: clientes vinham só por indicação e portal de carros]",
      "[Ex.: Instagram sem anúncio e sem frequência]",
      "[Ex.: ninguém sabia quanto custava cada cliente]",
    ],
    fizemos: [
      { t: "[Ex.: Vídeos com o Tiago]", d: "[Ex.: o dono apresentando os carros direto do pátio, sem cara de propaganda.]" },
      { t: "[Ex.: Anúncio para a região]", d: "[Ex.: Meta Ads mostrando o estoque para quem está procurando carro perto da loja.]" },
      { t: "[Ex.: Contato direto no WhatsApp]", d: "[Ex.: um clique do anúncio para a conversa com o vendedor.]" },
    ],
    criativo: {
      img: "",
      imgDica: "Print do anúncio ou frame do Reel que mais trouxe contato",
      porque: "[Por que funcionou. Ex.: o dono falando direto com quem procura carro na região. Gente confia em gente.]",
    },
    resultado: {
      periodo: "[em 60 dias]",
      stats: [
        { v: "[+000%]", l: "contatos no WhatsApp" },
        { v: "R$ [0,00]", l: "por contato" },
        { v: "[00]", l: "carros vendidos pelo anúncio" },
      ],
    },
    depoimento: {
      texto: "[Frase real do Tiago sobre o resultado. Peça por WhatsApp.]",
      autor: "Tiago",
      cargo: "DR Veículos",
    },
  },

  julia: {
    cliente: "Julia Ávila Beauty",
    segmento: "Estúdio de beleza",
    cidade: "[Cidade]",
    foto: "",
    fotoDica: "Foto da Julia no estúdio ou da marca aplicada",
    capa: "Uma marca que *[resultado principal]*.",
    capaSub: "[Em uma frase, o que mudou. Ex.: de perfil genérico para marca que cobra o que vale.]",
    antes: [
      "[Ex.: identidade feita no improviso]",
      "[Ex.: perfil igual ao de qualquer outro estúdio]",
      "[Ex.: cliente pedindo desconto toda hora]",
    ],
    fizemos: [
      { t: "[Ex.: Identidade visual]", d: "[Ex.: logo, cores e tipografia com cara de estúdio premium.]" },
      { t: "[Ex.: Novo perfil]", d: "[Ex.: bio, destaques e grid pensados para agendar, não só para enfeitar.]" },
      { t: "[Ex.: Conteúdo e anúncio]", d: "[Ex.: posts e campanha para atrair cliente da região.]" },
    ],
    criativo: {
      img: "",
      imgDica: "Antes e depois do perfil ou a marca aplicada",
      porque: "[Por que funcionou. Ex.: a marca passou a parecer o preço que ela cobra.]",
    },
    resultado: {
      periodo: "[em 90 dias]",
      stats: [
        { v: "[+00]", l: "novas clientes" },
        { v: "[+00%]", l: "no ticket médio" },
        { v: "[00%]", l: "da agenda preenchida" },
      ],
    },
    depoimento: {
      texto: "[Frase real da Julia sobre o resultado. Peça por WhatsApp.]",
      autor: "Julia Ávila",
      cargo: "Julia Ávila Beauty",
    },
  },
};
