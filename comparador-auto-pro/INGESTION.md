# Contrato de ingestão por URL

O utilizador só cola o link. A camada de ingestão decide automaticamente a estratégia.

## Estratégias, por ordem
1. API oficial autorizada, quando disponível.
2. Página pública: leitura HTTP e dados estruturados JSON-LD/OpenGraph.
3. Página pública sem dados estruturados: parser específico do domínio.
4. Conteúdo inacessível/atrás de login: devolver estado "requires_authorized_source" em vez de inventar dados.

O motor de valorização nunca depende da forma como a viatura foi obtida.

## Saída obrigatória do leitor

```json
{
  "source_url": "...",
  "source_domain": "...",
  "external_id": "...",
  "vehicle": {
    "make": "...",
    "model": "...",
    "generation": "...",
    "trim": "...",
    "fuel": "...",
    "battery_kwh": 77,
    "power_cv": 204,
    "year": 2021,
    "first_registration": "2021-08-01",
    "mileage_km": 59517,
    "price": 22900,
    "vat_deductible": true,
    "equipment": []
  },
  "data_quality": {
    "completeness_pct": 92,
    "uncertain_fields": [],
    "evidence": {}
  }
}
```

## Regra crítica
Um campo incerto nunca deve ser apresentado como facto confirmado. A extração deve guardar evidência por campo sempre que possível.

## Pesquisa de comparáveis
A pesquisa é gerada a partir de uma assinatura:
`marca + modelo + geração + versão/motorização + bateria + ano ±N + km ±N`.

O sistema alarga progressivamente a pesquisa apenas quando não existem comparáveis suficientes:
- nível A: quase idênticos;
- nível B: mesma versão com janela maior de ano/km;
- nível C: mesma motorização/geração;
- nível D: apenas para contexto, nunca com peso elevado.

Cada resultado é deduplicado por URL, ID externo e assinatura aproximada.
