# Keise Studio

Shell inicial do ecossistema pessoal de autoria, mediação e criação multimídia.

## Áreas
- Mediação
- Learning
- Creative
- Immersive
- Characters
- Analytics

## Princípios da arquitetura
- Local-first
- Sem polling
- Sem backend obrigatório
- Projetos portáveis
- Crescimento modular
- Analytics separado dos dados pessoais do Chat ISA

## Estado atual
A V1 cria e organiza rascunhos localmente no navegador, oferece backup JSON e conecta o módulo Analytics ao Keise Learning Analytics já publicado.

As áreas específicas serão construídas por etapas, começando pelas funções de maior uso real.


## Mediação v1 funcional
O módulo Mediação já inclui:
- cadastro local de estudantes acompanhados;
- situações de acompanhamento sem rotulagem automática;
- sinais de atenção definidos pela mediadora;
- registro de intervenções, canal, tipo de ação e retorno;
- próximo acompanhamento;
- histórico individual;
- painel "Para olhar hoje";
- geração de relatório textual;
- exportação e importação de backup próprio da Mediação.

Os dados permanecem no navegador e não há polling automático.
