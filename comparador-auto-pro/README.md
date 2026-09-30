# Comparador Auto Pro — núcleo V1

Esta pasta é um protótipo isolado do motor de decisão de compra. Não altera o site AutoValorPT existente.

## Objetivo
Receber uma viatura-alvo e uma lista de comparáveis normalizados e devolver:
- preço provável de venda;
- preço de venda rápida;
- máximo de compra;
- máximo absoluto;
- margem prevista;
- confiança da avaliação;
- comparáveis usados/excluídos e explicação.

## Princípio
A IA interpreta o anúncio. O algoritmo calcula. Os dados de mercado validam. O histórico interno aprende.

## V1
A primeira versão ainda não faz recolha automática dos sites. Primeiro estamos a validar o cérebro do sistema, sem depender do layout nem de scraping.

## Executar testes
```bash
cd comparador-auto-pro
npm test
```
