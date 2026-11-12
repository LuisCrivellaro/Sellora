import type { Segment } from "../types";

/**
 * Demos v3: direção visual por tipo de negócio + variação determinística por estabelecimento.
 * Sem IA e sem custo: o tipo sai do nome ou da categoria da fonte (OpenStreetMap) e a variação
 * (paleta, título, layout) sai de um hash do nome e da cidade. Os textos falam da categoria,
 * nunca afirmam serviços, preços, avaliações ou fatos do estabelecimento.
 */

export type DemoLayout = "split" | "stage" | "type";
export type DemoType = "serif" | "sans" | "bold";
export interface DemoPalette { paper: string; ink: string; accent: string }
type PhotoId = "dining" | "salon" | "care" | "workshop" | "store" | "workspace";

export interface DemoKindSpec {
  label: string;
  /** Complemento da mensagem: "o site da barbearia". */
  noun: string;
  headlines: [string, string, string];
  intro: string;
  storyTitles: [string, string];
  story: string;
  topics: [string, string, string];
  detailsTitle: string;
  photo: PhotoId | null;
  alt: string;
  type: DemoType;
  palettes: [DemoPalette, DemoPalette, DemoPalette];
}

const kinds = {
  barbearia: {
    label: "Barbearia", noun: "da barbearia", type: "bold", photo: null, alt: "",
    headlines: ["Cadeira pronta. Horário marcado.", "Corte em dia, sem complicação.", "Tradição de barbearia, perto de você."],
    intro: "Conheça o espaço e combine seu horário com", storyTitles: ["Um horário que é só seu.", "O ritual de sempre, do jeito certo."],
    story: "Corte, acabamento e aquele momento de pausa no meio da semana. Confira os horários e combine seu atendimento direto com a equipe.",
    topics: ["Cortes e serviços", "O espaço", "Horários e agendamento"], detailsTitle: "Antes de sentar na cadeira.",
    palettes: [{ paper: "#151515", ink: "#f2ede4", accent: "#c8a165" }, { paper: "#1d2a24", ink: "#f1efe6", accent: "#d9b36c" }, { paper: "#ece6da", ink: "#1b1b1b", accent: "#9c3b26" }],
  },
  cabelo: {
    label: "Salão de cabelo", noun: "do salão", type: "serif", photo: "salon", alt: "Detalhe de um salão de beleza, fotografia de referência",
    headlines: ["Seu cabelo, do seu jeito.", "Um novo visual começa aqui.", "Cuidado que aparece no espelho."],
    intro: "Um espaço digital para conhecer o trabalho de", storyTitles: ["Cada cabelo pede um cuidado.", "Mudar ou manter: a escolha é sua."],
    story: "Corte, cor ou tratamento: converse com a equipe, conte o que você procura e consulte os atendimentos disponíveis.",
    topics: ["Atendimentos", "O salão", "Agendamento"], detailsTitle: "O próximo passo é seu.",
    palettes: [{ paper: "#f0ebee", ink: "#382c36", accent: "#654654" }, { paper: "#f7f1ea", ink: "#2d241f", accent: "#a0583c" }, { paper: "#232026", ink: "#f4eef0", accent: "#d8a3b4" }],
  },
  estetica: {
    label: "Estética e spa", noun: "do espaço", type: "serif", photo: "care", alt: "Luz natural entre árvores, fotografia de referência",
    headlines: ["Um tempo para você.", "Pausa, cuidado e bem-estar.", "Respire. Seu momento chegou."],
    intro: "Conheça a proposta e os cuidados oferecidos por", storyTitles: ["Cuidar de si não é luxo.", "Bem-estar começa com uma pausa."],
    story: "Um ambiente pensado para desacelerar. Consulte os procedimentos disponíveis e tire suas dúvidas antes de agendar.",
    topics: ["Procedimentos", "O ambiente", "Como agendar"], detailsTitle: "Tudo pronto para o seu momento.",
    palettes: [{ paper: "#f3f1ea", ink: "#2f3a33", accent: "#6f8a73" }, { paper: "#f6efe8", ink: "#3d2f2a", accent: "#b07a5c" }, { paper: "#e9eef0", ink: "#24343c", accent: "#4f7a86" }],
  },
  massagem: {
    label: "Massagem", noun: "do espaço", type: "serif", photo: "care", alt: "Luz natural entre árvores, fotografia de referência",
    headlines: ["Alívio para o corpo, calma para a mente.", "Desacelere por uma hora.", "O descanso que a semana pediu."],
    intro: "Conheça as técnicas e o espaço de", storyTitles: ["O corpo sente. A mente agradece.", "Uma pausa feita com as mãos."],
    story: "Tensão, cansaço ou só vontade de relaxar. Consulte as técnicas disponíveis e escolha o melhor horário para você.",
    topics: ["Técnicas", "O espaço", "Horários"], detailsTitle: "Antes da sua sessão.",
    palettes: [{ paper: "#f1eee6", ink: "#33302a", accent: "#8a6e4b" }, { paper: "#e8efea", ink: "#22332b", accent: "#4e7a62" }, { paper: "#2a2724", ink: "#f2ece3", accent: "#d1ad7c" }],
  },
  unhas: {
    label: "Manicure e nail design", noun: "do estúdio", type: "sans", photo: "salon", alt: "Detalhe de um salão de beleza, fotografia de referência",
    headlines: ["Detalhes que fazem diferença.", "Mãos cuidadas, do seu jeito.", "Cor, forma e capricho."],
    intro: "Conheça o trabalho e os horários de", storyTitles: ["Pequenos detalhes, grande cuidado.", "Seu estilo na ponta dos dedos."],
    story: "Do clássico ao criativo: consulte os serviços e escolha o horário que combina com a sua rotina.",
    topics: ["Serviços", "Inspirações", "Agendamento"], detailsTitle: "Escolha seu horário.",
    palettes: [{ paper: "#fbf0f0", ink: "#3b2228", accent: "#c0475f" }, { paper: "#f2eefa", ink: "#2c2540", accent: "#7a5bc0" }, { paper: "#f7f3ec", ink: "#2b2723", accent: "#c27b4f" }],
  },
  tatuagem: {
    label: "Estúdio de tatuagem", noun: "do estúdio", type: "bold", photo: null, alt: "",
    headlines: ["Sua ideia merece traço próprio.", "Arte para levar na pele.", "Do esboço à pele."],
    intro: "Conheça o estúdio e converse sobre seu projeto com", storyTitles: ["Cada traço começa numa conversa.", "Uma ideia, um projeto, uma arte."],
    story: "Leve sua referência e converse com o estúdio sobre estilo, tamanho e cuidados antes de marcar a sessão.",
    topics: ["Estilos", "O estúdio", "Orçamento e sessão"], detailsTitle: "Antes da primeira sessão.",
    palettes: [{ paper: "#111111", ink: "#efeae2", accent: "#d64f3a" }, { paper: "#1a1d24", ink: "#eef0f4", accent: "#8fb3d9" }, { paper: "#ebe5d8", ink: "#161616", accent: "#2f5d50" }],
  },
  restaurante: {
    label: "Restaurante", noun: "do restaurante", type: "serif", photo: "dining", alt: "Mesa posta com um prato servido, fotografia de referência",
    headlines: ["Seu próximo encontro tem lugar.", "Boa comida pede boa companhia.", "A mesa está posta."],
    intro: "Uma pausa no dia, uma boa conversa à mesa. Conheça", storyTitles: ["Mais do que escolher onde comer.", "Toda refeição conta uma história."],
    story: "Um almoço sem pressa, um encontro marcado ou a vontade de sair da rotina. Conheça a casa e planeje sua visita.",
    topics: ["Cardápio e opções", "A casa", "Visita e reservas"], detailsTitle: "Antes de escolher sua mesa.",
    palettes: [{ paper: "#192c28", ink: "#f4f2e9", accent: "#e0c6a1" }, { paper: "#f5efe4", ink: "#2c1f17", accent: "#a2402b" }, { paper: "#26201c", ink: "#f3eadc", accent: "#e39b4f" }],
  },
  cafe: {
    label: "Café, padaria e doceria", noun: "da casa", type: "serif", photo: "dining", alt: "Mesa posta com um prato servido, fotografia de referência",
    headlines: ["Um café e uma pausa.", "Feito para começar bem o dia.", "Do forno para a sua mesa."],
    intro: "Conheça o cardápio e o jeito de", storyTitles: ["Pequenos prazeres do dia a dia.", "Toda pausa merece um sabor."],
    story: "Para o café da manhã, o lanche da tarde ou uma encomenda especial. Consulte o cardápio e os horários.",
    topics: ["Cardápio", "A casa", "Encomendas e horários"], detailsTitle: "Passe para um café.",
    palettes: [{ paper: "#f4ece0", ink: "#3a2a1f", accent: "#9b5e34" }, { paper: "#efe9e1", ink: "#2b2a26", accent: "#6d7b4a" }, { paper: "#2c211b", ink: "#f4e9db", accent: "#e0a96d" }],
  },
  lanchonete: {
    label: "Lanchonete", noun: "da lanchonete", type: "bold", photo: null, alt: "",
    headlines: ["Fome? A gente resolve.", "Sabor rápido, perto de você.", "Pediu, chegou, aproveitou."],
    intro: "Confira o cardápio e os canais de pedido de", storyTitles: ["Sabor sem enrolação.", "O lanche certo para a hora certa."],
    story: "Para matar a fome no almoço, no fim de tarde ou à noite. Consulte o cardápio, os horários e as formas de pedido.",
    topics: ["Cardápio", "Pedidos e entrega", "Horários"], detailsTitle: "Escolha o seu.",
    palettes: [{ paper: "#fff4e0", ink: "#2a1a10", accent: "#d9461f" }, { paper: "#1b1b1b", ink: "#fff3df", accent: "#f2b23a" }, { paper: "#f3f0e8", ink: "#1f2a1f", accent: "#2f8a4c" }],
  },
  bar: {
    label: "Bar", noun: "do bar", type: "bold", photo: "dining", alt: "Mesa posta com um prato servido, fotografia de referência",
    headlines: ["O encontro começa aqui.", "Mesa cheia, conversa boa.", "Depois do expediente, aqui."],
    intro: "Conheça o clima e a programação de", storyTitles: ["Lugar de encontro.", "Toda noite tem uma história."],
    story: "Para reunir os amigos, comemorar ou só relaxar. Consulte o cardápio, os horários e a programação da casa.",
    topics: ["Cardápio e bebidas", "Programação", "Reservas"], detailsTitle: "Planeje sua noite.",
    palettes: [{ paper: "#14161c", ink: "#f1ece2", accent: "#e8a93b" }, { paper: "#2a1717", ink: "#f6e9df", accent: "#e57a4e" }, { paper: "#e9e3d6", ink: "#1a1a1a", accent: "#7c2f3f" }],
  },
  clinica: {
    label: "Clínica e consultório", noun: "da clínica", type: "sans", photo: "care", alt: "Luz natural entre árvores, fotografia de referência",
    headlines: ["Acolhimento desde o primeiro contato.", "Cuidado com informação clara.", "Sua saúde, com atenção."],
    intro: "Informações para conhecer e entrar em contato com", storyTitles: ["Informação clara. Um caminho mais simples.", "Antes da consulta, tire suas dúvidas."],
    story: "Entre em contato para confirmar os atendimentos disponíveis, os horários e as informações de que você precisa.",
    topics: ["Atendimentos", "Equipe e especialidades", "Como agendar"], detailsTitle: "O que você precisa saber.",
    palettes: [{ paper: "#f5f9fa", ink: "#193f52", accent: "#235f7b" }, { paper: "#f4f7f2", ink: "#1f3a2c", accent: "#2f7a55" }, { paper: "#f7f5f9", ink: "#2b2a45", accent: "#5b57a6" }],
  },
  odonto: {
    label: "Odontologia", noun: "do consultório", type: "sans", photo: "care", alt: "Luz natural entre árvores, fotografia de referência",
    headlines: ["Um sorriso bem cuidado.", "Cuidado para sorrir sem receio.", "Seu sorriso em boas mãos."],
    intro: "Conheça o consultório e as formas de contato de", storyTitles: ["Prevenir também é cuidar.", "Consulta tranquila começa com informação."],
    story: "Avaliação, prevenção ou tratamento: consulte os atendimentos disponíveis e agende um horário com a equipe.",
    topics: ["Tratamentos", "Equipe", "Agendar avaliação"], detailsTitle: "Antes da sua consulta.",
    palettes: [{ paper: "#f3f8fb", ink: "#16384d", accent: "#1f7aa8" }, { paper: "#f2f8f6", ink: "#183b33", accent: "#1f8a6e" }, { paper: "#f7f7fb", ink: "#22284a", accent: "#4a5bd4" }],
  },
  veterinaria: {
    label: "Veterinária", noun: "da clínica", type: "sans", photo: null, alt: "",
    headlines: ["Quem cuida do seu pet também cuida de você.", "Cuidado para quem é da família.", "Seu pet bem cuidado."],
    intro: "Conheça os atendimentos e o contato de", storyTitles: ["Família tem quatro patas também.", "Atenção em cada consulta."],
    story: "Consultas, vacinas ou orientação: entre em contato para confirmar os atendimentos e os horários disponíveis.",
    topics: ["Atendimentos", "Equipe", "Agendamento"], detailsTitle: "Antes da consulta do seu pet.",
    palettes: [{ paper: "#f3f7ee", ink: "#22351f", accent: "#4c8a3a" }, { paper: "#eef5f7", ink: "#1b3540", accent: "#2a7f9e" }, { paper: "#fbf4ea", ink: "#3a2a17", accent: "#c4762f" }],
  },
  terapia: {
    label: "Terapias e reabilitação", noun: "do consultório", type: "serif", photo: "care", alt: "Luz natural entre árvores, fotografia de referência",
    headlines: ["Um passo de cada vez.", "Cuidado no seu ritmo.", "Escuta, cuidado e acompanhamento."],
    intro: "Conheça a abordagem e as formas de contato de", storyTitles: ["Cada pessoa tem o seu tempo.", "Acompanhamento próximo, do início ao fim."],
    story: "Tire suas dúvidas sobre a abordagem, os atendimentos e os horários antes de marcar a primeira sessão.",
    topics: ["Abordagem", "Atendimentos", "Primeira sessão"], detailsTitle: "Para começar com tranquilidade.",
    palettes: [{ paper: "#f2f1ec", ink: "#2d3a3a", accent: "#4f7f7a" }, { paper: "#f5f0ea", ink: "#3a2f28", accent: "#9a6a4b" }, { paper: "#eff1f6", ink: "#232c45", accent: "#55689e" }],
  },
  academia: {
    label: "Academia e estúdio", noun: "da academia", type: "bold", photo: null, alt: "",
    headlines: ["Seu treino começa aqui.", "Movimento todos os dias.", "Mais disposição, no seu ritmo."],
    intro: "Conheça as modalidades e os horários de", storyTitles: ["Treinar é um compromisso com você.", "Do primeiro treino em diante."],
    story: "Consulte modalidades, horários e planos disponíveis e venha conhecer o espaço antes de começar.",
    topics: ["Modalidades", "Horários", "Aula experimental"], detailsTitle: "Pronto para começar?",
    palettes: [{ paper: "#121417", ink: "#f2f4f5", accent: "#c6f24e" }, { paper: "#f1f1ee", ink: "#141414", accent: "#e2471f" }, { paper: "#101a2b", ink: "#eef3fb", accent: "#45b3ff" }],
  },
  oficina: {
    label: "Oficina e serviços automotivos", noun: "da oficina", type: "bold", photo: "workshop", alt: "Detalhe de trabalho manual em metal, fotografia de referência",
    headlines: ["Seu carro em boas mãos.", "Diagnóstico claro, serviço bem feito.", "Pé na estrada com confiança."],
    intro: "Conheça os serviços e o contato de", storyTitles: ["Confiança se constrói no detalhe.", "Antes de qualquer serviço, uma boa conversa."],
    story: "Revisão, manutenção ou aquele barulho estranho: descreva o problema e consulte as possibilidades de atendimento.",
    topics: ["Serviços", "Como funciona", "Solicitar orçamento"], detailsTitle: "Vamos entender o que o carro precisa.",
    palettes: [{ paper: "#132c41", ink: "#f4f6fa", accent: "#f0c575" }, { paper: "#1a1a1a", ink: "#f2f2ee", accent: "#e8552c" }, { paper: "#eceae4", ink: "#1c2430", accent: "#c2410c" }],
  },
  pet: {
    label: "Pet shop e banho e tosa", noun: "do pet shop", type: "sans", photo: null, alt: "",
    headlines: ["Banho, tosa e muito carinho.", "Seu pet merece esse cuidado.", "Cheiroso, feliz e bem tratado."],
    intro: "Conheça os serviços e os horários de", storyTitles: ["Cuidado do focinho ao rabo.", "Pet feliz, tutor tranquilo."],
    story: "Consulte os serviços disponíveis, os horários e como agendar o próximo cuidado do seu pet.",
    topics: ["Serviços", "Produtos", "Agendamento"], detailsTitle: "Agende o próximo cuidado.",
    palettes: [{ paper: "#fff6ea", ink: "#33261a", accent: "#e07b2e" }, { paper: "#eef6f4", ink: "#173a35", accent: "#26907d" }, { paper: "#f5f1fb", ink: "#2c2140", accent: "#8a5bd6" }],
  },
  escritorio: {
    label: "Escritório e serviços profissionais", noun: "do escritório", type: "sans", photo: "workspace", alt: "Ambiente de trabalho iluminado, fotografia de referência",
    headlines: ["Orientação clara para decidir melhor.", "Seu próximo passo, bem orientado.", "Atendimento próximo e objetivo."],
    intro: "Conheça a atuação e as formas de contato de", storyTitles: ["Toda decisão começa com uma boa conversa.", "Experiência a serviço do seu caso."],
    story: "Explique sua necessidade e consulte como o escritório pode ajudar, com atendimento claro desde o primeiro contato.",
    topics: ["Áreas de atuação", "Como trabalhamos", "Agendar conversa"], detailsTitle: "Vamos conversar sobre o seu caso.",
    palettes: [{ paper: "#f4f3ef", ink: "#1c2433", accent: "#2f4a7a" }, { paper: "#16202e", ink: "#eef1f6", accent: "#c9a96a" }, { paper: "#f3f5f4", ink: "#1d2d28", accent: "#2f6b57" }],
  },
  escola: {
    label: "Escola e cursos", noun: "da escola", type: "sans", photo: "workspace", alt: "Ambiente de trabalho iluminado, fotografia de referência",
    headlines: ["Aprender abre caminhos.", "Seu próximo passo começa numa aula.", "Aprenda no seu ritmo."],
    intro: "Conheça os cursos e as turmas de", storyTitles: ["Toda conquista começa com uma aula.", "Ensino próximo, resultado no dia a dia."],
    story: "Consulte cursos, turmas e horários disponíveis e tire suas dúvidas antes de se matricular.",
    topics: ["Cursos", "Turmas e horários", "Matrícula"], detailsTitle: "Escolha seu curso.",
    palettes: [{ paper: "#f2f5fb", ink: "#1a2747", accent: "#3157d4" }, { paper: "#fbf6ec", ink: "#2a2216", accent: "#d38a1c" }, { paper: "#eef6f1", ink: "#16352a", accent: "#228a5a" }],
  },
  reparos: {
    label: "Reparos e serviços técnicos", noun: "do serviço", type: "bold", photo: "workshop", alt: "Detalhe de trabalho manual em metal, fotografia de referência",
    headlines: ["Resolvido do jeito certo.", "Serviço bem feito, sem dor de cabeça.", "Chame quem entende."],
    intro: "Conheça o trabalho e as formas de contato de", storyTitles: ["O trabalho merece ser visto de perto.", "Cada serviço começa entendendo o problema."],
    story: "Conte o que precisa ser feito e consulte disponibilidade, prazos e formas de atendimento.",
    topics: ["Serviços", "Trabalhos realizados", "Solicitar orçamento"], detailsTitle: "Vamos entender sua necessidade.",
    palettes: [{ paper: "#132c41", ink: "#f4f6fa", accent: "#f0c575" }, { paper: "#f1efe9", ink: "#1e1e1e", accent: "#d1491f" }, { paper: "#1c241d", ink: "#eef2ea", accent: "#9fd06a" }],
  },
  servico: {
    label: "Serviços", noun: "do serviço", type: "sans", photo: "workspace", alt: "Ambiente de trabalho iluminado, fotografia de referência",
    headlines: ["Seu próximo projeto começa com uma conversa.", "Atendimento feito para resolver.", "Perto de você, quando precisar."],
    intro: "Conheça o trabalho e as formas de contato de", storyTitles: ["Todo trabalho começa entendendo você.", "Atendimento próximo, do início ao fim."],
    story: "Conte o que você procura e consulte as possibilidades de atendimento, prazos e valores.",
    topics: ["Serviços", "Como funciona", "Solicitar informações"], detailsTitle: "Vamos entender sua necessidade.",
    palettes: [{ paper: "#eef1f8", ink: "#1c2d49", accent: "#37558a" }, { paper: "#f4f1ea", ink: "#2a251e", accent: "#a2602f" }, { paper: "#eff5f2", ink: "#1b3329", accent: "#2f7a5a" }],
  },
  moda: {
    label: "Moda e acessórios", noun: "da loja", type: "serif", photo: "store", alt: "Peças de roupa organizadas, fotografia de referência",
    headlines: ["Estilo que combina com você.", "Novidades para o seu guarda-roupa.", "Vista o que te representa."],
    intro: "Conheça a seleção e os canais de contato de", storyTitles: ["Uma vitrine com a sua identidade.", "Peças para o dia a dia e para ocasiões especiais."],
    story: "Antes de visitar, vale uma conversa. Consulte a seleção disponível, tamanhos e novidades da loja.",
    topics: ["Coleção", "Conheça a loja", "Planeje sua visita"], detailsTitle: "Encontre o que faz sentido para você.",
    palettes: [{ paper: "#faf8f3", ink: "#20382f", accent: "#326653" }, { paper: "#f6efea", ink: "#2f1f1c", accent: "#b04a3a" }, { paper: "#191919", ink: "#f2eee8", accent: "#d9c3a0" }],
  },
  casa: {
    label: "Casa e decoração", noun: "da loja", type: "serif", photo: null, alt: "",
    headlines: ["Para deixar a casa com a sua cara.", "Cada canto pede um cuidado.", "Sua casa, do seu jeito."],
    intro: "Conheça os produtos e o atendimento de", storyTitles: ["Escolhas que transformam o espaço.", "Do projeto ao detalhe."],
    story: "Consulte os produtos disponíveis, tire dúvidas e combine a melhor forma de atendimento ou entrega.",
    topics: ["Produtos", "Ambientes", "Atendimento e entrega"], detailsTitle: "Encontre o que sua casa precisa.",
    palettes: [{ paper: "#f3efe7", ink: "#2c2a24", accent: "#7a6a3e" }, { paper: "#eef1ec", ink: "#1f2b22", accent: "#4c7356" }, { paper: "#f6efe9", ink: "#33231d", accent: "#b5653d" }],
  },
  tecnologia: {
    label: "Celulares e eletrônicos", noun: "da loja", type: "sans", photo: null, alt: "",
    headlines: ["Tecnologia sem complicação.", "Conectado com o que você precisa.", "Do acessório ao conserto."],
    intro: "Conheça os produtos e serviços de", storyTitles: ["Atendimento que entende de tecnologia.", "A solução certa para o seu aparelho."],
    story: "Consulte produtos, acessórios e serviços disponíveis e tire suas dúvidas antes de passar na loja.",
    topics: ["Produtos", "Assistência", "Fale com a loja"], detailsTitle: "Tire suas dúvidas.",
    palettes: [{ paper: "#0f1420", ink: "#eef2fa", accent: "#4f8cff" }, { paper: "#f2f4f7", ink: "#141a24", accent: "#0f7a6b" }, { paper: "#16161b", ink: "#f1f1f4", accent: "#b48cff" }],
  },
  loja: {
    label: "Comércio local", noun: "da loja", type: "sans", photo: "store", alt: "Peças de roupa organizadas, fotografia de referência",
    headlines: ["Boas descobertas, bem perto.", "Tudo o que você procura, por perto.", "Passe para conhecer."],
    intro: "Conheça a proposta e os canais de contato de", storyTitles: ["Comércio de bairro, atendimento de verdade.", "Uma vitrine com a sua identidade."],
    story: "Antes de visitar, vale uma conversa. Consulte os produtos disponíveis e tire suas dúvidas com a loja.",
    topics: ["Produtos e novidades", "Conheça a loja", "Planeje sua visita"], detailsTitle: "Encontre o que faz sentido para você.",
    palettes: [{ paper: "#faf8f3", ink: "#20382f", accent: "#326653" }, { paper: "#f5f1ea", ink: "#2c241c", accent: "#b2632e" }, { paper: "#eef2f8", ink: "#1b2a44", accent: "#3a5f9e" }],
  },
  presenca: {
    label: "Negócio local", noun: "do negócio", type: "sans", photo: "workspace", alt: "Ambiente de trabalho iluminado, fotografia de referência",
    headlines: ["Conheça de perto. Comece por aqui.", "Perto de você, do jeito certo.", "Uma conversa começa aqui."],
    intro: "Uma nova forma de descobrir e conversar com", storyTitles: ["Uma presença à altura da sua história.", "Conheça quem está por trás."],
    story: "Conheça o negócio, tire suas dúvidas e encontre o melhor caminho para conversar com a equipe.",
    topics: ["O negócio", "O que fazemos", "Fale com a gente"], detailsTitle: "Informação por perto.",
    palettes: [{ paper: "#eef1f8", ink: "#1c2d49", accent: "#37558a" }, { paper: "#f4f1ea", ink: "#2a251e", accent: "#9a5b2c" }, { paper: "#1a1f24", ink: "#eef1f3", accent: "#7fc2b0" }],
  },
} satisfies Record<string, DemoKindSpec>;

export type DemoKind = keyof typeof kinds;
export const demoKinds: Record<DemoKind, DemoKindSpec> = kinds;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ordem importa: o primeiro padrão que casar define o tipo (nome antes da categoria). */
const RULES: [DemoKind, RegExp][] = [
  ["barbearia", /\bbarb(ea|e)ri|\bbarber|\bbarba\b|\bbarbeiro/],
  ["tatuagem", /\btatu|\btattoo|\bpiercing/],
  ["unhas", /\bunha|\bnail|\bmanicure|\bpedicure|\besmalter/],
  ["massagem", /\bmassag|\bmassoterap|\bquiropraxi|\bshiatsu|\breflexolog/],
  ["estetica", /\bspa\b|\bestetic|\bbeauty\b|\bdepila|\bsobrancelha|\bcilio|\blash|\bbrow|\bharmoniza|\bcosmet|\bbem.estar/],
  ["cabelo", /\bsal(ao|oes)\b|\bcabel|\bhair|\bcoiffeur|\bescova|\btrancas?\b|\bhairdresser/],
  ["veterinaria", /\bveterin|\bvet\b/],
  ["pet", /\bpet\b|\bpets\b|\bbanho e tosa|\btosa\b|\bpet.?shop|\bpet grooming/],
  ["odonto", /\bodonto|\bdent(al|ista)|\bsorriso|\bortodont|\bdentist/],
  ["terapia", /\bfisio|\bpsicolog|\bterap|\bfono|\bnutri|\bpilates|\bphysio|\bpsycho|\bspeech|\bnutrition/],
  ["academia", /\bacademia|\bfitness|\bcrossfit|\bgym\b|\btreino|\bmuay|\bjiu|\bkarate|\bjudo|\bdojo|\bluta|\bdanca|\bdance|\bcentro esportivo|\bartes marciais/],
  ["clinica", /\bclinic|\bmedic|\bconsultorio|\blaborator|\bsaude|\bdoctor|\boptometr/],
  ["cafe", /\bcafe|\bcafeteria|\bpadaria|\bpanifica|\bconfeitar|\bdocer|\bdoces\b|\bbolos?\b|\bsorvet|\bgelat|\bbakery|\bpastry|\bconfectionery|\bice cream|\bacai/],
  ["bar", /\bbar\b|\bboteco|\bchoperia|\bcervej|\bpub\b|\bbistro bar/],
  ["lanchonete", /\blanch|\bburger|\bhamburg|\bpizza|\bpastel|\bespetinho|\bfast food|\bdog\b|\bcachorro.quente|\bsalgad/],
  ["restaurante", /\brestaurant|\bcozinha|\bchurrasc|\bsushi|\bcantina|\btrattoria|\bbistro|\bgrill|\bmarmit|\bpraca de alimentacao|\bemporio|\bacougue|\bdeli\b|\bbutcher/],
  ["oficina", /\bmecanic|\boficina|\bauto ?center|\bpneu|\bfunilar|\blava.?(jato|rapido|car)|\bcar wash|\bcar repair|\btyres|\bautomot|\bmotos?\b/],
  ["escola", /\bescola|\bcurso|\bidioma|\bingles|\bautoescola|\bmusica|\bdriving|\blanguage|\bmusic school|\bcolegio|\breforco/],
  ["escritorio", /\badvoca|\bcontab|\bimobili|\barquitet|\bseguros?\b|\bcorretor|\blawyer|\baccountant|\bestate|\barchitect|\binsurance|\bconsultoria/],
  ["reparos", /\beletric|\bencanad|\bmarcen|\bserralh|\bchaveir|\btapec|\bvidrac|\breforma|\belectrician|\bplumber|\bcarpenter|\blocksmith|\bupholster/],
  ["tecnologia", /\bcelular|\binformatica|\beletronic|\bassistencia tecnica|\bphone|\btech|\bmobile|\belectronics|\bgames?\b/],
  ["moda", /\bmoda|\bboutique|\bmodas\b|\broupa|\bcalcad|\bsapat|\bjoia|\bjoalher|\bbijou|\bacessorio|\bbolsa|\blingerie|\bclothes|\bshoes|\bjewelry|\bbag\b|\botica|\boptician|\bfashion/],
  ["casa", /\bmove(is|l)|\bdecora|\bmateriais de construcao|\bconstrucao|\bferrag|\bflor(es|icultura)|\bjardin|\butilidades|\bcolch|\bfurniture|\bhardware|\bflorist|\bgarden|\bhouseware|\binterior|\bfabric|\btecido/],
  ["servico", /\blavanderia|\bcostur|\bfoto|\bgrafic|\bcopia|\bfuneral|\blaundry|\bdry cleaning|\btailor|\bphoto|\bcopyshop|\bfunerar/],
];

const SEGMENT_DEFAULT: Record<Segment, DemoKind> = { beleza: "cabelo", restaurantes: "restaurante", saude: "clinica", servicos: "servico", comercio: "loja", outros: "presenca" };

/** Tipo visual do negócio: nome primeiro (mais específico), depois a categoria da fonte, por fim o segmento. */
export function detectDemoKind(b: { name: string; segment: Segment; category?: string }): DemoKind {
  const allowed = (k: DemoKind) => b.segment === "outros" || kindSegment(k) === b.segment || (b.segment === "saude" && k === "academia");
  // A categoria do OSM "Cabeleireiro / barbearia" não distingue os dois: sem pista no nome, vale salão.
  for (const text of [b.name, (b.category ?? "").replace(/cabeleireiro \/ barbearia/i, "cabeleireiro")]) {
    const t = norm(text);
    if (!t) continue;
    const hit = RULES.find(([k, re]) => re.test(t) && allowed(k));
    if (hit) return hit[0];
  }
  return SEGMENT_DEFAULT[b.segment];
}

function kindSegment(k: DemoKind): Segment {
  if (["barbearia", "cabelo", "estetica", "massagem", "unhas", "tatuagem"].includes(k)) return "beleza";
  if (["restaurante", "cafe", "lanchonete", "bar"].includes(k)) return "restaurantes";
  if (["clinica", "odonto", "veterinaria", "terapia", "academia"].includes(k)) return "saude";
  if (["oficina", "pet", "escritorio", "escola", "reparos", "servico"].includes(k)) return "servicos";
  if (["moda", "casa", "tecnologia", "loja"].includes(k)) return "comercio";
  return "outros";
}

/** Iniciais para o monograma do layout tipográfico (no lugar de um logotipo, que não inventamos). */
export function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 1 || /\p{N}/u.test(w));
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2)).toUpperCase();
}

/** FNV-1a 32 bits: estável entre navegador, servidor e execuções. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export interface DemoVariant {
  kind: DemoKind;
  spec: DemoKindSpec;
  palette: DemoPalette;
  headline: string;
  storyTitle: string;
  layout: DemoLayout;
  /** Nome curto da combinação, para o cartão da fila. */
  styleName: string;
}

const LAYOUT_NAMES: Record<DemoLayout, string> = { split: "foto ao lado", stage: "foto em destaque", type: "tipográfico" };

/** Mesma entrada → mesma demo. Cada dimensão usa um "sal" diferente para não andarem juntas. */
export function demoVariant(b: { name: string; city: string; segment: Segment; category?: string }): DemoVariant {
  const kind = detectDemoKind(b);
  const spec = demoKinds[kind];
  const key = `${norm(b.name).trim()}|${norm(b.city).trim()}`;
  const pick = (salt: string, n: number) => hash(`${salt}:${key}`) % n;
  // Sem fotografia adequada ao tipo, a demo é tipográfica: melhor que uma foto de outro ramo.
  const layouts: DemoLayout[] = spec.photo ? ["split", "stage", "type"] : ["type"];
  const layout = layouts[pick("layout", layouts.length)];
  return {
    kind, spec, layout,
    palette: spec.palettes[pick("palette", 3)],
    headline: spec.headlines[pick("headline", 3)],
    storyTitle: spec.storyTitles[pick("story", 2)],
    styleName: `${spec.label} · ${LAYOUT_NAMES[layout]}`,
  };
}
