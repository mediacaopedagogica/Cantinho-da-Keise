# Keise Learning Analytics

Painel estático e local para consolidar métricas de recursos educacionais sem polling e sem backend próprio.

## Projetos iniciais
- Missão Circular
- Tours Virtuais
- Escritório em Ação 360º

## Regra de funcionamento
1. Cada projeto registra seus próprios eventos.
2. A mediadora exporta os dados quando desejar.
3. No Keise Learning Analytics, o botão **Atualizar dados** importa um ou mais arquivos.
4. Os dados ficam apenas no navegador via localStorage.
5. Não existe atualização automática, cron, polling ou consulta periódica.

## Formato padrão de importação
```json
{
  "schema": "keise-learning-analytics/v1",
  "project": {
    "id": "missao-circular",
    "name": "Missão Circular"
  },
  "generatedAt": "2026-09-26T12:00:00-04:00",
  "events": [
    {
      "id": "evento-unico",
      "projectId": "missao-circular",
      "type": "completion",
      "at": "2026-09-26T11:58:00-04:00",
      "participantId": "aluno-001",
      "participantName": "Nome do participante",
      "sessionId": "sessao-001"
    }
  ]
}
```

Tipos aceitos: access, session, start, interaction, stage, comment, reply, completion, score, feedback, hint, attempt.

Nenhum dado fictício é criado pelo painel.
