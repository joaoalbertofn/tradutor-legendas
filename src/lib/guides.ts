export interface GuideComparisonTable {
  headers: string[];
  rows: string[][];
}

export interface GuideCallout {
  title: string;
  body: string;
  tone?: "tip" | "warning";
}

export interface GuideSection {
  id: string;
  heading: string;
  paragraphs: string[];
  steps?: { title: string; detail: string }[];
  bullets?: string[];
  table?: GuideComparisonTable;
  callout?: GuideCallout;
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  category: string;
  primaryKeyword: string;
  keywords: string[];
  readingTimeMinutes: number;
  publishedAt: string;
  updatedAt: string;
  directAnswer: string;
  inlineCta: {
    title: string;
    description: string;
    buttonLabel: string;
  };
  bottomCta: {
    title: string;
    description: string;
    buttonLabel: string;
  };
  sections: GuideSection[];
  faqs: GuideFaq[];
}

export const GUIDES: GuideArticle[] = [
  {
    slug: "como-traduzir-legendas-de-filmes-para-pt-br-gratis",
    title: "Como traduzir legendas de filmes para PT-BR grátis (sem perder a sincronia)",
    metaTitle: "Como traduzir legendas de filmes para PT-BR grátis",
    metaDescription:
      "Aprenda como traduzir legendas .srt e .vtt de filmes e séries para Português do Brasil grátis, online e preservando 100% dos timestamps e da sincronia.",
    excerpt:
      "Passo a passo completo para traduzir arquivos .srt e .vtt para Português do Brasil gratuitamente, mantendo os tempos intactos e diálogos naturais.",
    category: "Guia Completo",
    primaryKeyword: "como traduzir legendas de filmes para pt-br gratis",
    keywords: [
      "como traduzir legendas de filmes para pt-br gratis",
      "traduzir legenda srt para portugues online gratis",
      "tradutor de legendas gratis",
      "traduzir legenda de filme sem perder sincronia",
      "traduzir arquivo srt para pt-br",
    ],
    readingTimeMinutes: 5,
    publishedAt: "2026-11-22",
    updatedAt: "2026-11-22",
    directAnswer:
      "Para traduzir legendas de filmes para PT-BR grátis sem quebrar a sincronia, o caminho mais rápido é usar um tradutor dedicado a arquivos .srt e .vtt com IA, como o LegendaBR. Ele separa automaticamente os diálogos dos códigos de tempo (timestamps), traduz o roteiro com contexto completo para Português do Brasil e devolve o arquivo pronto para assistir — com 3 traduções gratuitas por dia.",
    inlineCta: {
      title: "Quer traduzir sua legenda agora mesmo?",
      description:
        "Envie seu arquivo .srt ou .vtt na página inicial do LegendaBR e receba a versão em PT-BR em segundos, com 3 traduções grátis por dia.",
      buttonLabel: "Traduzir legenda grátis agora",
    },
    bottomCta: {
      title: "Pronto para assistir seu filme em Português do Brasil?",
      description:
        "Arraste seu arquivo .srt, .vtt ou até o próprio vídeo .mkv/.mp4 no LegendaBR. Preservamos 100% dos timestamps, índices e acentos.",
      buttonLabel: "Ir para o tradutor gratuito",
    },
    sections: [
      {
        id: "por-que-tradutores-comuns-falham",
        heading: "Por que traduzir legendas no Google Tradutor ou copiando texto dá problema?",
        paragraphs: [
          "Muita gente tenta abrir um arquivo .srt no Bloco de Notas e colar o conteúdo no Google Tradutor ou em um chat de IA genérico. O resultado quase sempre gera dores de cabeça: os códigos de tempo (como 00:01:24,500 --> 00:01:27,100) são alterados, a seta de tempo ganha espaços extras ou as linhas ficam fora de ordem.",
          "Além disso, tradutores literais não enxergam o contexto do filme. Uma expressão simples em inglês, espanhol ou japonês acaba virando uma frase robótica em português de Portugal ou totalmente sem sentido para a cena.",
        ],
        bullets: [
          "Timestamps corrompidos fazem a legenda parar de aparecer no VLC, TV ou Media Player.",
          "Tradução frase por frase sem contexto troca o gênero de personagens e erra gírias.",
          "Arquivos grandes (filmes de 2 horas têm mais de 1.500 blocos) estouram o limite de caracteres de chats comuns.",
          "Salvar na codificação errada faz acentos como ç, ã e é aparecerem como símbolos estranhos.",
        ],
      },
      {
        id: "passo-a-passo-gratis",
        heading: "Passo a passo: como traduzir legendas para PT-BR grátis no LegendaBR",
        paragraphs: [
          "O LegendaBR foi criado especificamente para resolver esses problemas. Ele nunca envia os timestamps para a inteligência artificial — apenas o texto dos diálogos — e reconstrói o arquivo original bloco por bloco de forma 100% fiel.",
        ],
        steps: [
          {
            title: "Acesse a página inicial e envie seu arquivo",
            detail:
              "Entre no tradutor do LegendaBR e arraste seu arquivo .srt ou .vtt (em qualquer idioma: inglês, espanhol, francês, japonês, coreano, etc.). Se o filme estiver em .mkv ou .mp4 sem arquivo separado, você também pode extrair a legenda direto do vídeo.",
          },
          {
            title: "Escolha o estilo de tradução (opcional)",
            detail:
              "Em Configurações de tradução, selecione entre Natural / Coloquial (padrão ideal para filmes e séries), Fiel ao original (ótimo para documentários e aulas) ou Adaptação leve de gírias (ideal para comédias).",
          },
          {
            title: "Adicione um glossário se quiser",
            detail:
              "Para séries, animes ou filmes de ficção científica, você pode indicar nomes próprios que não devem ser traduzidos ou informar o gênero de um personagem.",
          },
          {
            title: "Clique em Traduzir para PT-BR e acompanhe ao vivo",
            detail:
              "Faça login rápido para liberar suas 3 traduções gratuitas diárias. O sistema divide a legenda em lotes paralelos com contexto do roteiro e mostra a tradução lado a lado em tempo real.",
          },
          {
            title: "Baixe o arquivo pronto com acentos perfeitos",
            detail:
              "Ao terminar, clique em baixar. O arquivo sai nomeado com .pt-BR (por exemplo, filme.pt-BR.srt) e com suporte a UTF-8 BOM para funcionar sem erros de acentuação em Smart TVs e no VLC.",
          },
        ],
        callout: {
          title: "Dica para assistir na TV ou no computador",
          body: "Deixe o arquivo da legenda traduzida na mesma pasta e exatamente com o mesmo nome do arquivo de vídeo (ex.: MeuFilme.mkv e MeuFilme.srt). Assim, players como VLC, Kodi, Plex e Smart TVs carregam a legenda automaticamente.",
          tone: "tip",
        },
      },
      {
        id: "comparativo-metodos",
        heading: "Comparativo: qual o melhor jeito de traduzir legendas grátis?",
        paragraphs: [
          "Veja abaixo as principais diferenças entre usar um tradutor dedicado como o LegendaBR, o Google Tradutor de documentos ou colar manualmente em uma IA:",
        ],
        table: {
          headers: ["Critério", "LegendaBR", "Google Tradutor", "ChatGPT / IA manual"],
          rows: [
            ["Preserva 100% dos timestamps", "Sim (automático)", "Às vezes quebra", "Frequentemente quebra"],
            ["Português do Brasil natural", "Sim (3 estilos)", "Robótico / literal", "Bom, mas pede prompt longo"],
            ["Filmes longos (1.500+ linhas)", "Sim (lotes paralelos)", "Sim, sem contexto", "Precisa dividir manualmente"],
            ["Extrai legenda de MKV/MP4", "Sim, no navegador", "Não", "Não"],
            ["UTF-8 BOM para Smart TV", "Sim, 1 clique", "Não", "Precisa converter no PC"],
          ],
        },
      },
      {
        id: "formatos-e-idiomas-suportados",
        heading: "Quais idiomas e formatos funcionam?",
        paragraphs: [
          "Você pode enviar legendas em qualquer idioma de origem — inglês, espanhol, japonês, coreano, italiano, alemão, francês, russo ou mandarim — e traduzir diretamente para Português do Brasil.",
          "Em relação aos formatos, o LegendaBR suporta nativamente arquivos .srt (SubRip) e .vtt (WebVTT) de até 5 MB, além de extrair faixas de legenda embutidas em arquivos de vídeo .mkv, .mp4 e .m4v diretamente no seu navegador.",
        ],
      },
    ],
    faqs: [
      {
        question: "Traduzir legendas no LegendaBR é realmente grátis?",
        answer:
          "Sim. Toda conta tem direito a 3 traduções completas gratuitas por dia, renovadas a cada 24 horas. Se você precisar maratonar uma temporada inteira no mesmo dia, também existem pacotes avulsos acessíveis via Pix ou Cartão.",
      },
      {
        question: "A legenda pode ficar fora de sincronia depois da tradução?",
        answer:
          "Não. O LegendaBR separa os tempos e os índices no seu navegador antes de enviar apenas os diálogos para a IA. Na reconstrução final, os timestamps originais são mantidos exatamente iguais ao arquivo enviado.",
      },
      {
        question: "Preciso instalar algum programa no computador ou celular?",
        answer:
          "Não. Todo o processo funciona 100% online direto pelo navegador no Windows, Mac, Linux ou celular, sem downloads obrigatórios.",
      },
    ],
  },
  {
    slug: "como-extrair-e-traduzir-legenda-de-mkv-e-mp4-para-portugues",
    title: "Como extrair e traduzir legenda de vídeo MKV e MP4 para português (sem instalar nada)",
    metaTitle: "Extrair e traduzir legenda de MKV e MP4 para português",
    metaDescription:
      "Seu filme MKV ou MP4 só tem legenda embutida em inglês? Veja como extrair a legenda direto no navegador sem subir o vídeo e traduzir para PT-BR grátis.",
    excerpt:
      "Aprenda a tirar a legenda embutida de arquivos .mkv e .mp4 sem instalar MKVToolNix e sem esperar horas de upload — e já traduza para PT-BR.",
    category: "Extração de Vídeo",
    primaryKeyword: "como extrair legenda de filme mkv e traduzir para portugues",
    keywords: [
      "como extrair legenda de filme mkv e traduzir para portugues",
      "extrair legenda mkv online",
      "traduzir legenda embutida mp4",
      "como tirar legenda de video mkv sem instalar programa",
      "extrair srt de mkv no navegador",
    ],
    readingTimeMinutes: 5,
    publishedAt: "2026-11-22",
    updatedAt: "2026-11-22",
    directAnswer:
      "Você não precisa mais instalar programas como MKVToolNix ou Subtitle Edit para tirar a legenda de um filme. No LegendaBR, basta arrastar seu arquivo .mkv ou .mp4 diretamente na página inicial: a ferramenta lê as faixas de legenda localmente no seu navegador (sem fazer upload do vídeo), extrai o arquivo .srt em segundos e já deixa tudo pronto para traduzir para Português do Brasil.",
    inlineCta: {
      title: "Extraia a legenda do seu MKV ou MP4 agora",
      description:
        "Arraste o vídeo direto na página inicial do LegendaBR. O processamento de extração acontece 100% no seu navegador, sem enviar o filme para a internet.",
      buttonLabel: "Abrir extrator e tradutor",
    },
    bottomCta: {
      title: "Sem programas pesados, sem upload demorado",
      description:
        "Extraia faixas de legenda de arquivos .mkv, .mp4 e .m4v em segundos e traduza para PT-BR grátis com o LegendaBR.",
      buttonLabel: "Extrair e traduzir agora",
    },
    sections: [
      {
        id: "o-que-e-legenda-embutida",
        heading: "Por que muitos filmes MKV e MP4 não vêm com arquivo .srt separado?",
        paragraphs: [
          "Arquivos .mkv (Matroska) e .mp4 funcionam como contêineres: dentro de um único arquivo ficam guardados o vídeo, várias faixas de áudio e várias faixas de legenda embutidas (softsubs).",
          "Quando o filme só traz legendas embutidas em inglês, japonês ou espanhol, você precisa primeiro extrair essa faixa para texto (.srt) e depois traduzir. O problema dos tutoriais tradicionais é exigir a instalação de softwares técnicos como MKVToolNix, gMKVExtractGUI ou FFmpeg por linha de comando.",
        ],
      },
      {
        id: "extrair-direto-no-navegador",
        heading: "Como extrair e traduzir legenda de MKV/MP4 direto no navegador",
        paragraphs: [
          "Com o extrator integrado do LegendaBR, você faz tudo em uma única tela — e o melhor: o arquivo de vídeo nunca sai do seu computador, porque a leitura das faixas de legenda acontece localmente no navegador.",
        ],
        steps: [
          {
            title: "Abra a página inicial do LegendaBR",
            detail:
              "Clique no botão 'Clique aqui para extrair do vídeo (.mkv / .mp4)' logo abaixo da área de upload — ou simplesmente arraste o arquivo .mkv, .mp4 ou .m4v direto para a caixa.",
          },
          {
            title: "Escolha a faixa de legenda desejada",
            detail:
              "O extrator identifica rapidamente as faixas de legenda em texto disponíveis no vídeo (por exemplo, English, Spanish, Japanese) e permite selecionar qual você quer extrair.",
          },
          {
            title: "Extraia e confira os blocos detectados",
            detail:
              "Em poucos segundos, a legenda é extraída como .srt e carregada automaticamente no tradutor. Se quiser, você também pode baixar a legenda original extraída clicando em 'Baixar legenda original extraída (.srt)'.",
          },
          {
            title: "Traduza para Português do Brasil e baixe",
            detail:
              "Clique em 'Traduzir para PT-BR', aguarde o progresso em tempo real e baixe o arquivo .pt-BR.srt perfeitamente sincronizado com o seu vídeo.",
          },
        ],
        callout: {
          title: "Privacidade e velocidade: seu vídeo não é enviado para a internet",
          body: "Mesmo que seu filme tenha 4 GB ou 15 GB, o LegendaBR lê apenas os dados necessários do contêiner localmente no seu dispositivo. Não há espera de upload de vídeo.",
          tone: "tip",
        },
      },
      {
        id: "quando-a-legenda-e-imagem",
        heading: "Atenção: legenda em texto vs legenda em imagem (PGS/VobSub) ou queimada",
        paragraphs: [
          "Nem toda legenda dentro de um vídeo é igual. Entender a diferença evita perda de tempo:",
        ],
        bullets: [
          "Softsubs em texto (SRT/UTF-8, ASS/SSA, WebVTT, mov_text em MP4): são faixas de texto puro. Podem ser extraídas em segundos pelo LegendaBR e traduzidas imediatamente.",
          "Legendas em imagem (PGS de Blu-ray / VobSub de DVD): são imagens sobrepostas ao vídeo, não texto. Nesse caso, é necessário primeiro um software de OCR (como Subtitle Edit) para converter a imagem em .srt.",
          "Hardsubs (legendas queimadas no vídeo): fazem parte dos pixels da imagem do vídeo e não podem ser extraídas como faixa de texto.",
        ],
      },
      {
        id: "como-usar-legenda-traduzida-com-mkv",
        heading: "Como assistir o filme MKV/MP4 com a nova legenda traduzida",
        paragraphs: [
          "Depois de baixar sua legenda .pt-BR.srt, você não precisa sequer reempacotar o arquivo MKV. Basta colocar a legenda na mesma pasta do filme com o mesmo nome do vídeo:",
        ],
        bullets: [
          "Exemplo: se o vídeo se chama Serie.S01E01.1080p.mkv, renomeie a legenda baixada para Serie.S01E01.1080p.srt.",
          "No VLC, você também pode simplesmente arrastar o arquivo .pt-BR.srt para dentro da janela do vídeo em reprodução.",
          "Na Smart TV via pendrive ou Plex/Jellyfin, o pareamento pelo mesmo nome funciona automaticamente.",
        ],
      },
    ],
    faqs: [
      {
        question: "Preciso fazer upload de um filme de 10 GB para extrair a legenda?",
        answer:
          "Não. A extração de legendas de .mkv e .mp4 no LegendaBR roda localmente no seu navegador, sem subir o arquivo de vídeo para o servidor. Apenas o texto leve da legenda extraída é enviado para tradução.",
      },
      {
        question: "Funciona com arquivos MP4 e M4V também, ou só MKV?",
        answer:
          "Funciona com .mkv, .mp4 e .m4v, desde que o arquivo possua faixas de legenda em texto embutidas.",
      },
      {
        question: "Consigo baixar a legenda original antes ou depois de traduzir?",
        answer:
          "Sim. Assim que a legenda é extraída do vídeo, aparece um botão dedicado para baixar o arquivo .srt original extraído, além do botão para baixar a versão traduzida em PT-BR.",
      },
    ],
  },
  {
    slug: "traduzir-legenda-srt-com-ia-sem-perder-sincronia",
    title: "Como traduzir legenda .SRT com IA sem perder sincronia (e com PT-BR natural)",
    metaTitle: "Traduzir legenda .SRT com IA sem perder sincronia",
    metaDescription:
      "Descubra por que colar .srt no ChatGPT quebra timestamps e como traduzir legendas com Inteligência Artificial mantendo 100% da sincronia e diálogos naturais.",
    excerpt:
      "Entenda as diferenças entre traduzir legendas com Google Tradutor, ChatGPT manual e uma ferramenta com IA especializada em .srt e .vtt.",
    category: "IA & Qualidade",
    primaryKeyword: "traduzir legenda srt com ia sem perder sincronia",
    keywords: [
      "traduzir legenda srt com ia sem perder sincronia",
      "melhor ia para traduzir legendas",
      "traduzir legenda srt com chatgpt",
      "traduzir legenda ingles para portugues brasileiro natural",
      "tradutor de legendas com inteligencia artificial",
    ],
    readingTimeMinutes: 5,
    publishedAt: "2026-11-22",
    updatedAt: "2026-11-22",
    directAnswer:
      "Para traduzir legendas .srt com IA sem perder a sincronia, a inteligência artificial nunca deve editar os códigos de tempo manualmente. Ferramentas dedicadas como o LegendaBR isolam os timestamps no código, enviam apenas os diálogos junto com o contexto completo do filme para a IA e remontam o arquivo .srt com correspondência exata 1 para 1 — entregando Português do Brasil natural sem quebrar nenhuma linha.",
    inlineCta: {
      title: "Experimente tradução com IA feita para legendas",
      description:
        "Escolha o tom da tradução (Natural, Fiel ou Adaptação de gírias), adicione seu glossário e traduza até 3 legendas por dia gratuitamente.",
      buttonLabel: "Testar o LegendaBR grátis",
    },
    bottomCta: {
      title: "Tradução com IA sem dor de cabeça com prompts",
      description:
        "Pare de copiar e colar blocos no chat. Envie seu arquivo .srt ou .vtt no LegendaBR e receba a legenda pronta, natural e 100% sincronizada.",
      buttonLabel: "Traduzir minha legenda agora",
    },
    sections: [
      {
        id: "problemas-de-usar-chat-generico",
        heading: "Os 4 erros mais comuns ao traduzir .SRT colando no ChatGPT ou Gemini",
        paragraphs: [
          "A Inteligência Artificial revolucionou a tradução de filmes e séries porque consegue entender sarcasmo, contexto de cena e expressões idiomáticas. Porém, tentar traduzir um arquivo .srt inteiro colando o texto em um chat comum quase sempre esbarra em limites práticos:",
        ],
        bullets: [
          "Corte de resposta no meio do filme: um episódio de 50 minutos tem entre 600 e 1.000 blocos; um filme passa de 1.500 blocos, ultrapassando o limite de saída de uma única resposta.",
          "Alteração acidental de timestamps: a IA pode trocar vírgula por ponto (00:01:10.500 em vez de 00:01:10,500) ou pular um número de bloco, fazendo a legenda dessincronizar ou sumir.",
          "Perda de consistência entre partes: ao dividir o arquivo manualmente em 10 pedaços, um personagem tratado por 'você' na parte 1 vira 'senhor' na parte 4, ou nomes próprios mudam de grafia.",
          "Remoção de tags de formatação: tags como <i>itálico</i> (usadas em pensamentos, narração ou músicas) costumam ser apagadas ou fechadas errado.",
        ],
      },
      {
        id: "como-funciona-traducao-lossless",
        heading: "Como funciona a tradução lossless com contexto completo",
        paragraphs: [
          "Um tradutor de legendas profissional com IA resolve isso separando a engenharia do arquivo da tradução linguística. No LegendaBR, o processo funciona em três camadas:",
        ],
        steps: [
          {
            title: "1. Parser lossless (timestamps protegidos)",
            detail:
              "O arquivo é lido no navegador separando índice, timestamp e texto. Os códigos de tempo nunca passam pela IA, tornando matematicamente impossível corromper a sincronia.",
          },
          {
            title: "2. Lotes paralelos com contexto do roteiro",
            detail:
              "Os diálogos são traduzidos em lotes rápidos com validação estrita de IDs (se qualquer bloco vier faltando, o sistema tenta novamente automaticamente) enquanto a IA consulta o contexto do roteiro e as falas anteriores para manter coerência de gênero, tom e personagens.",
          },
          {
            title: "3. Reconstrução fiel do arquivo original",
            detail:
              "Cada fala traduzida volta exatamente para o seu índice e timestamp originais, preservando quebras de linha, itálicos e estrutura do arquivo.",
          },
        ],
      },
      {
        id: "estilos-e-glossario",
        heading: "Como deixar a legenda com cara de tradução profissional em PT-BR",
        paragraphs: [
          "Nem todo vídeo pede o mesmo estilo de tradução. Uma comédia cheia de trocadilhos exige uma abordagem diferente de uma palestra técnica ou documentário histórico. No LegendaBR você pode ajustar dois recursos poderosos antes de traduzir:",
        ],
        bullets: [
          "Natural / Coloquial: ideal para filmes, séries e novelas — diálogos fluidos que soam como português falado no Brasil.",
          "Fiel ao original: prioriza precisão técnica e fidelidade ao texto base — excelente para aulas, cursos, palestras e documentários.",
          "Adaptação leve de gírias: traduz expressões idiomáticas e humor para equivalentes naturais no Brasil.",
          "Campo de Contexto / Glossário: escreva instruções como 'Série de ficção científica; não traduzir Starfleet e Warp Drive; o personagem Alex é mulher' para garantir consistência do início ao fim.",
        ],
        callout: {
          title: "Dica de ouro para séries e animes",
          body: "Se você estiver traduzindo uma série com nomes de lugares, golpes ou apelidos específicos, liste-os no campo de Glossário. Em menos de 10 segundos você evita 99% dos erros clássicos de tradução automática.",
          tone: "tip",
        },
      },
    ],
    faqs: [
      {
        question: "A IA traduz para Português do Brasil (PT-BR) ou Português de Portugal?",
        answer:
          "O LegendaBR é otimizado exclusivamente para Português do Brasil (PT-BR), evitando construções artificiais ou vocabulário de Portugal que costumam aparecer em tradutores genéricos.",
      },
      {
        question: "Tags de itálico (<i>) e quebras de linha são mantidas?",
        answer:
          "Sim. O tradutor preserva tags de formatação inline e a estrutura original dos blocos para manter a leitura confortável na tela.",
      },
      {
        question: "Quanto tempo leva para traduzir um filme inteiro?",
        answer:
          "Como a tradução roda em lotes paralelos otimizados, um episódio de série costuma ficar pronto em poucos segundos e um filme completo em cerca de 30 a 90 segundos, com acompanhamento ao vivo linha a linha.",
      },
    ],
  },
  {
    slug: "como-traduzir-legenda-vtt-para-portugues-online",
    title: "Como traduzir legenda .VTT (WebVTT) para português online sem quebrar o arquivo",
    metaTitle: "Como traduzir legenda .VTT para português online",
    metaDescription:
      "Baixou uma legenda .vtt de curso online, YouTube ou player web? Veja a diferença entre VTT e SRT e como traduzir arquivos WebVTT para PT-BR grátis.",
    excerpt:
      "Guia prático para traduzir legendas .vtt (WebVTT) de cursos, YouTube e plataformas web para Português do Brasil preservando cabeçalhos e estilos.",
    category: "Formatos & Cursos",
    primaryKeyword: "como traduzir legenda vtt para portugues online",
    keywords: [
      "como traduzir legenda vtt para portugues online",
      "traduzir arquivo webvtt para pt-br",
      "diferenca entre srt e vtt",
      "traduzir legenda de curso online",
      "tradutor de legenda vtt gratis",
    ],
    readingTimeMinutes: 4,
    publishedAt: "2026-11-22",
    updatedAt: "2026-11-22",
    directAnswer:
      "Para traduzir um arquivo .vtt (WebVTT) para português online sem corromper o cabeçalho WEBVTT ou os posicionamentos de tela, envie o arquivo diretamente no LegendaBR. A ferramenta reconhece nativamente a especificação WebVTT — mantendo cabeçalhos, blocos STYLE/REGION/NOTE e cue settings intactos — e exporta o arquivo .pt-BR.vtt pronto para uso.",
    inlineCta: {
      title: "Tem um arquivo .vtt para traduzir agora?",
      description:
        "Envie seu .vtt no LegendaBR e receba a tradução em Português do Brasil preservando 100% da estrutura WebVTT.",
      buttonLabel: "Traduzir arquivo .VTT grátis",
    },
    bottomCta: {
      title: "Traduza legendas .VTT de cursos e vídeos em segundos",
      description:
        "Use o estilo Fiel ao original para aulas técnicas ou Natural para vídeos e documentários — com 3 traduções grátis por dia.",
      buttonLabel: "Começar tradução .VTT",
    },
    sections: [
      {
        id: "o-que-e-vtt-e-diferenca-para-srt",
        heading: "O que é um arquivo .VTT e qual a diferença para o .SRT?",
        paragraphs: [
          "O formato .vtt (WebVTT — Web Video Text Tracks) é o padrão oficial de legendas para a web moderna (HTML5). É por isso que plataformas de cursos online, YouTube, Vimeo e serviços de streaming quase sempre fornecem legendas em .vtt em vez de .srt.",
          "Embora pareçam parecidos quando abertos no Bloco de Notas, o .vtt tem regras específicas que muitos tradutores genéricos acabam quebrando:",
        ],
        table: {
          headers: ["Característica", "Formato .SRT", "Formato .VTT (WebVTT)"],
          rows: [
            ["Cabeçalho obrigatório", "Não tem", "Sim (WEBVTT no topo)"],
            ["Separador de milissegundos", "Vírgula (00:01:02,500)", "Ponto (00:01:02.500)"],
            ["Estilos e posicionamento", "Limitado", "Suporta STYLE, REGION e cue settings"],
            ["Comentários internos", "Não suportado", "Suporta blocos NOTE"],
            ["Uso mais comum", "Filmes baixados, VLC, Smart TVs", "Cursos online, YouTube, players HTML5"],
          ],
        },
      },
      {
        id: "passo-a-passo-traduzir-vtt",
        heading: "Como traduzir arquivo .VTT para PT-BR no LegendaBR",
        paragraphs: [
          "Você não precisa converter seu .vtt para .srt antes de traduzir. O LegendaBR lê e reconstrói arquivos .vtt nativamente:",
        ],
        steps: [
          {
            title: "Envie o arquivo .vtt na página inicial",
            detail:
              "Arraste ou selecione o arquivo .vtt no LegendaBR. O sistema detecta automaticamente o formato VTT e mostra quantos blocos de fala existem.",
          },
          {
            title: "Ajuste o estilo para o tipo de conteúdo",
            detail:
              "Se for um curso de programação, medicina, finanças ou aula universitária, abra Configurações de tradução, escolha 'Fiel ao original' e informe termos técnicos no campo de Glossário para não traduzir termos que devem ficar em inglês.",
          },
          {
            title: "Traduza e baixe o novo .pt-BR.vtt",
            detail:
              "Clique em 'Traduzir para PT-BR'. O cabeçalho WEBVTT, os blocos STYLE/NOTE e todos os timestamps com ponto decimal permanecem intactos no download final.",
          },
        ],
        callout: {
          title: "Dica para cursos técnicos e aulas em inglês",
          body: "No campo de Glossário, você pode escrever por exemplo: 'Curso de desenvolvimento web. Manter termos técnicos em inglês como API, framework, deploy, commit e hook.' A tradução fica muito mais clara e fiel ao mercado brasileiro.",
          tone: "tip",
        },
      },
      {
        id: "cuidados-com-vtt",
        heading: "Por que nunca traduzir .VTT com ferramentas que só entendem .SRT?",
        paragraphs: [
          "Se uma ferramenta tenta tratar um .vtt como texto comum ou como .srt, ela costuma traduzir a palavra 'WEBVTT' do cabeçalho, traduzir comentários NOTE ou trocar o ponto dos milissegundos por vírgula. Qualquer uma dessas alterações faz players HTML5 e plataformas de vídeo rejeitarem o arquivo completamente.",
          "Ao usar um parser dedicado a WebVTT, você garante compatibilidade imediata tanto em navegadores quanto em players como VLC, PotPlayer e IINA.",
        ],
      },
    ],
    faqs: [
      {
        question: "O arquivo traduzido continua no formato .vtt?",
        answer:
          "Sim. Se você enviar aula-01.vtt, o LegendaBR exporta aula-01.pt-BR.vtt mantendo integralmente o cabeçalho WEBVTT, os tempos com ponto decimal e os blocos de estilo originais.",
      },
      {
        question: "Posso traduzir legendas baixadas do YouTube ou de plataformas de curso?",
        answer:
          "Sim. Basta ter o arquivo .vtt ou .srt em mãos e enviar no LegendaBR. O limite por arquivo é de até 5 MB, suficiente até para aulas longas de várias horas.",
      },
      {
        question: "O player VLC aceita legendas .vtt?",
        answer:
          "Sim, versões atuais do VLC, MPC-HC, IINA e praticamente todos os navegadores web modernos reproduzem legendas .vtt perfeitamente.",
      },
    ],
  },
  {
    slug: "legenda-srt-com-acento-errado-na-smart-tv-e-vlc-como-corrigir",
    title: "Legenda .SRT com acento errado na Smart TV e no VLC? Veja como corrigir (UTF-8 BOM)",
    metaTitle: "Legenda .SRT com acento errado na TV e VLC: como corrigir",
    metaDescription:
      "Acentos como ç, ã e é aparecendo como símbolos estranhos na sua Smart TV ou VLC? Entenda o que é UTF-8 com BOM e como corrigir sua legenda .srt em segundos.",
    excerpt:
      "Resolva de vez o erro de acentuação (Ã§, Ã£, ?) em legendas em português na Smart TV Samsung, LG, Philips e no VLC Media Player.",
    category: "Solução de Problemas",
    primaryKeyword: "legenda srt com acento errado na smart tv como corrigir",
    keywords: [
      "legenda srt com acento errado na smart tv como corrigir",
      "utf-8 bom legenda srt",
      "legenda com simbolos estranhos vlc",
      "corrigir acentos legenda srt",
      "legenda portugues bugada smart tv",
    ],
    readingTimeMinutes: 5,
    publishedAt: "2026-11-22",
    updatedAt: "2026-11-22",
    directAnswer:
      "Acentos quebrados em legendas .srt (como 'não' virando 'nÃ£o' ou '?') acontecem por conflito de codificação de caracteres entre ANSI/Windows-1252 e UTF-8. A solução definitiva para Smart TVs (Samsung, LG, Philips) e players como o VLC é salvar a legenda em UTF-8 com BOM — opção que já vem ativada por padrão em todas as legendas traduzidas no LegendaBR.",
    inlineCta: {
      title: "Precisa traduzir uma legenda já pronta para Smart TV?",
      description:
        "No LegendaBR, a opção 'Incluir UTF-8 BOM no arquivo final' já vem ativada por padrão para que acentos em português funcionem de primeira na TV e no VLC.",
      buttonLabel: "Traduzir legenda com UTF-8 BOM",
    },
    bottomCta: {
      title: "Chega de legenda bugada na hora do filme",
      description:
        "Traduza suas legendas .srt e .vtt para PT-BR no LegendaBR com codificação UTF-8 BOM automática e 3 traduções grátis todos os dias.",
      buttonLabel: "Acessar o LegendaBR",
    },
    sections: [
      {
        id: "por-que-acentos-quebram",
        heading: "Por que a legenda mostra símbolos estranhos no lugar dos acentos?",
        paragraphs: [
          "Arquivos .srt são arquivos de texto simples. Quando a legenda é salva em uma codificação (por exemplo, UTF-8 sem marcação) mas a sua Smart TV ou player tenta ler usando outra tabela antiga (como ANSI / Windows-1252 ou ISO-8859-1), cada letra acentuada do português (á, é, ç, ã, õ) vira um par de símbolos estranhos como Ã¡, Ã©, Ã§ ou quadradinhos.",
          "O detalhe que pouca gente sabe é que muitas Smart TVs só reconhecem UTF-8 automaticamente quando o arquivo possui uma pequena assinatura invisível no início chamada BOM (Byte Order Mark) — o formato conhecido como UTF-8 com BOM.",
        ],
      },
      {
        id: "corrigir-no-computador",
        heading: "Como corrigir manualmente um arquivo .SRT no Windows ou Mac",
        paragraphs: [
          "Se você já tem uma legenda em português que está com acentos quebrados, pode corrigir em menos de 1 minuto no computador:",
        ],
        steps: [
          {
            title: "No Windows (Bloco de Notas)",
            detail:
              "Clique com o botão direito no arquivo .srt > Abrir com > Bloco de Notas. Confira se os acentos aparecem corretos na tela. Depois vá em Arquivo > Salvar como, mude o campo Codificação na parte inferior para 'UTF-8 com BOM' e clique em Salvar.",
          },
          {
            title: "No Windows (Notepad++ — mais preciso)",
            detail:
              "Abra o arquivo .srt no Notepad++, clique no menu Formatação (Encoding) > Converter para UTF-8-BOM e salve o arquivo (Ctrl + S).",
          },
          {
            title: "Se o arquivo já estiver salvo errado",
            detail:
              "Se ao abrir no Bloco de Notas os símbolos 'Ã§' já aparecerem na tela, não salve por cima sem converter. No Notepad++, primeiro mude a visualização em Formatação > UTF-8 para os acentos voltarem ao normal, e então salve em UTF-8-BOM.",
          },
        ],
      },
      {
        id: "corrigir-no-vlc-e-smart-tv",
        heading: "Como ajustar a codificação direto no VLC e na Smart TV",
        paragraphs: [
          "Se você não quiser editar o arquivo, também é possível configurar o próprio player:",
        ],
        bullets: [
          "No VLC (PC/Mac): acesse Ferramentas > Preferências (Ctrl + P), abra Legendas / OSD, mude 'Codificação padrão' para Universal (UTF-8) e clique em Salvar. Reinicie o VLC.",
          "Na Smart TV Samsung: durante o filme no player USB, abra Configurações (ícone de engrenagem) > Legendas > Codificação e selecione UTF-8 ou Europa Ocidental.",
          "Na Smart TV LG (webOS): clique no ícone de Legendas (SUB) na barra inferior do player, vá em Página de Código e altere para UTF-8 ou Latino.",
          "Nome dos arquivos no pendrive: sempre mantenha o vídeo e o .srt com exatamente o mesmo nome e na mesma pasta.",
        ],
      },
      {
        id: "como-evitar-o-problema-ao-traduzir",
        heading: "Como evitar esse erro ao traduzir novas legendas",
        paragraphs: [
          "Quando você traduz uma legenda de outro idioma para Português do Brasil usando o LegendaBR, o leitor interno detecta automaticamente a codificação original do arquivo enviado (mesmo arquivos antigos em Windows-1252/Latin-1) e já marca por padrão a opção 'Incluir UTF-8 BOM no arquivo final'.",
          "Assim, o arquivo .pt-BR.srt baixado já sai pronto para rodar com ç, ã, é e travessões perfeitos tanto em computadores quanto em Smart TVs via pendrive, DLNA ou Plex.",
        ],
        callout: {
          title: "Onde fica a opção UTF-8 BOM no LegendaBR?",
          body: "Ela já vem ativada automaticamente! Se quiser conferir ou desativar para algum fluxo específico, basta clicar em 'Configurações de tradução' na página inicial.",
          tone: "tip",
        },
      },
    ],
    faqs: [
      {
        question: "UTF-8 com BOM estraga a legenda no VLC ou no computador?",
        answer:
          "Não. O VLC, PotPlayer, IINA, Kodi, Plex e as Smart TVs modernas leem UTF-8 com BOM perfeitamente — na verdade, o BOM ajuda players mais antigos a reconhecerem UTF-8 sem errar os acentos.",
      },
      {
        question: "Por que minha Smart TV nem reconhece o arquivo .srt no pendrive?",
        answer:
          "Os dois motivos mais comuns são: o nome do arquivo .srt não está idêntico ao nome do arquivo de vídeo na mesma pasta, ou o arquivo está muito longo/com caracteres especiais no nome. Deixe ambos com nomes simples e iguais, como Filme.mkv e Filme.srt.",
      },
      {
        question: "Posso usar o LegendaBR para traduzir uma legenda em inglês que está em codificação antiga?",
        answer:
          "Sim. O LegendaBR decodifica automaticamente arquivos antigos (ANSI/Latin-1) na leitura e exporta o resultado traduzido limpo em UTF-8 com BOM.",
      },
    ],
  },
];

export function getGuideBySlug(slug: string): GuideArticle | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

export function getRelatedGuides(currentSlug: string, limit = 3): GuideArticle[] {
  return GUIDES.filter((guide) => guide.slug !== currentSlug).slice(0, limit);
}
