# Workflow — instruções, prompts, qualidade e relatórios

Como o agente da Sellora recebe pedidos, integra conhecimento novo, escreve prompts para outros agentes, valida trabalho e relata resultados. Referenciado pelo `CLAUDE.md`; as skills `prompt-architect` e `quality-assurance` executam partes deste documento.

---

## 1. Ciclo de uma nova instrução

1. **Analisar o pedido** — o que é: configuração, documentação, investigação, design, implementação, teste, deploy?
2. **Consultar contexto** — `CLAUDE.md`, docs pertinentes, `docs/DECISIONS.md`, estado do repositório.
3. **Verificar conflitos** com decisões aprovadas e com as regras de dados/segurança.
4. **Preservar** decisões anteriores compatíveis.
5. **Identificar alterações** necessárias e o escopo autorizado.
6. **Registrar** decisões relevantes em `docs/DECISIONS.md` (data, contexto, alternativas, motivo).

Precedência quando instruções conflitam: (1) regras de segurança, dados e autorização do `CLAUDE.md`; (2) instrução **mais recente e explícita** do usuário dentro do escopo autorizado; (3) decisões registradas em `docs/DECISIONS.md`; (4) documentos de especificação; (5) playbooks e skills (conhecimento de referência). Conflito não resolvível → perguntar.

Selecionar conhecimento: aplicar só as técnicas pertinentes ao objetivo atual (ver matriz em `docs/FRONTEND_PLAYBOOK.md` §0). Não aplicar tudo que está disponível.

## 2. Classificação da informação

| Rótulo | Significado |
|---|---|
| **Confirmado** | Dito pelo usuário, presente no repositório ou verificado por ferramenta |
| **Inferido** | Dedução razoável, ainda não confirmada |
| **Pendente** | Precisa de validação antes de usar como fato |
| **Opcional** | Melhoria não exigida |

Nunca inventar stack, arquivos, preços, credenciais, métricas, avaliações, disponibilidade, APIs ou integrações.

## 3. Integração de novos materiais (prompts, documentos, correções)

1. Ler o material integralmente; declarar o que não estava acessível.
2. Extrair princípios e regras; para cada um: problema, quando aplicar, como, resultado, limites, quando não usar, como validar.
3. Comparar com a base existente: **complementar**, **redundante** ou **contraditório**.
4. Resolver contradições pela precedência do §1; registrar as relevantes em `docs/DECISIONS.md`.
5. Encaixar no documento certo (não criar arquivo novo sem justificativa):
   - comportamento permanente do agente → `CLAUDE.md` (curto);
   - técnica de interface → `docs/FRONTEND_PLAYBOOK.md`;
   - sites de clientes → `docs/CLIENT_WEBSITES.md`;
   - visual do dashboard → `docs/DESIGN_SYSTEM.md`;
   - produto/negócio → `docs/PRODUCT_CONTEXT.md`, `docs/ROADMAP.md`;
   - processo repetível → skill em `.claude/skills/`.
6. Validar referências cruzadas e relatar o que mudou.

Correções enviadas em sequência: **acumular** todas; gerar prompt consolidado só quando solicitado; ao adicionar requisito, não perder os anteriores; deduplicar.

## 4. Padrão de prompt para agentes de desenvolvimento

Usado quando o usuário pedir um prompt (Claude Code, Lovable, outro agente). Skill: `prompt-architect`. Seções aplicáveis, nesta ordem:

1. **Missão** — tipo (criação, edição, investigação, teste, deploy) e resultado esperado objetivo.
2. **Contexto confirmado** — projeto, stack realmente conhecida, estado atual, marca, arquivos acessíveis, decisões aprovadas. Inferências rotuladas.
3. **Escopo autorizado** — criar / modificar / investigar; páginas e componentes afetados.
4. **Fora de escopo e elementos intocáveis** — textos, logos, dados, integrações, backend, rotas, segurança, decisões visuais, funções existentes.
5. **Requisitos funcionais** — comportamentos observáveis.
6. **Requisitos não funcionais** — acessibilidade, performance, segurança, responsividade, manutenção.
7. **Restrições técnicas e dependências** — versões, bibliotecas permitidas/proibidas, credenciais disponíveis ou ausentes.
8. **Critérios visuais** — direção, paleta, tipografia, composição, imagens; referências com **comportamento descrito**, não só nomes.
9. **Motion e storyboard** (se houver) — por seção: gatilho, estado inicial/final, progresso, easing, tempos, mobile, fallback, reduced-motion.
10. **Plano de implementação** — diagnosticar → mapear arquivos → planejar → executar → adaptar desktop/mobile → estados → verificar.
11. **Testes necessários** — comandos e verificações concretas; só ferramentas disponíveis; reportar PASS/FAIL/SKIP reais.
12. **Critérios de aceite** — verificáveis, nunca adjetivos ("bonito", "moderno").
13. **Evidências de conclusão** — saídas de comando, screenshots, URLs de preview, arquivos alterados.
14. **Limitações, riscos e pendências** — o que não será feito ou não pôde ser verificado.
15. **Relatório final exigido** — formato do §7.

Sempre incluir: não fazer commit, push, deploy, migração destrutiva, compra ou operação irreversível sem autorização; não refazer tudo para corrigir algo pontual (especialmente em Lovable).

## 5. Níveis de evidência

Nunca apresentar um nível como se fosse outro.

| Nível | O que comprova |
|---|---|
| Revisão conceitual | A ideia é coerente — nada sobre o código |
| Inspeção estática de código | O código parece correto — não que roda |
| Teste manual | Alguém executou o fluxo (dizer quem, onde, como) |
| Teste automatizado | Suíte executada com saída registrada |
| Screenshot renderizado | Aparência real em largura e estado específicos |
| Deploy validado | Funciona no ambiente publicado (URL, data) |

Relato de outro agente não é auditoria independente.

## 6. Quality gate

**P0 — bloqueadores:** app/site abre; navegação e ações principais funcionam; autenticação e dados protegidos (RLS); sem perda de dados; sem credenciais expostas; nenhuma integração simulada como real; nenhuma publicação alegada sem evidência; build passa.

**P1 — experiência:** proposta e CTA claros; identidade preservada; acessibilidade (teclado, foco, contraste, leitor de tela); formulários e validação; loading/empty/error/success; responsividade 360/768/1440; safe-area; temas; reduced-motion.

**P2 — acabamento:** tipografia, grid, alinhamento, espaçamento; fotografia e crop; peso de imagens/fontes/scripts; SEO; 404; links; políticas; detalhes de animação; coerência editorial.

Verificações técnicas, conforme existirem no projeto: análise de requisitos · revisão de arquitetura · `typecheck` · `lint` · testes unitários · integração · e2e (Playwright) · responsividade · acessibilidade (axe/Lighthouse) · performance · verificação visual · validação funcional · critérios de aceite.

Achados de revisão: criticidade (P0/P1/P2) · evidência · página/componente · causa provável (só se sustentada) · correção · como verificar. Separar obrigatório de sugestão. Não impor gosto pessoal contra direção aprovada.

## 7. Formato do relatório final

```
Solicitado:   o que o usuário pediu
Planejado:    o que se decidiu fazer (e o que se decidiu não fazer)
Implementado: mudanças por arquivo/componente
Testado:      comando/ferramenta → PASS | FAIL | SKIP (motivo), nível de evidência
Pendente:     não feito, não verificado, bloqueios (ex.: credencial ausente)
Riscos:       o que pode falhar e como notar
Como testar:  passos para o usuário reproduzir
```

Implementação nunca é declarada como validação. "Concluído" só para o que foi testado.

## 8. Ações que exigem autorização explícita

Commit e push (push sempre), deploy, alteração de remoto, migração destrutiva, instalação de dependência ou skill externa com scripts, envio de mensagens a terceiros, preços finais, contratos, cobranças, publicação de sites, alteração de configurações sensíveis. Force push: nunca.
