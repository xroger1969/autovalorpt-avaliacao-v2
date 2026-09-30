# Especificação funcional — Comparador Auto Pro V1

## 1. Interface
A interface final deverá ter apenas:
1. campo para colar URL;
2. botão "Analisar compra";
3. resultado principal: MÁXIMO DE COMPRA;
4. três áreas secundárias: Mercado, Cálculo, Riscos;
5. caixa "Comprador IA" para perguntas e aprendizagem.

## 2. Pipeline
1. Ingestão do URL.
2. Extração do anúncio.
3. Normalização da viatura.
4. Geração da assinatura comercial.
5. Pesquisa de comparáveis.
6. Deduplicação.
7. Exclusão de incompatibilidades.
8. Pontuação de semelhança.
9. Deteção de outliers.
10. Ajuste dos comparáveis à viatura-alvo.
11. Estimativa de valor de mercado.
12. Estimativa de venda rápida.
13. Aplicação de custos, margem e risco.
14. Produção do máximo de compra.
15. Explicação auditável.
16. Consulta da memória comercial interna.

## 3. Campos mínimos da viatura
- marca;
- modelo;
- geração;
- versão;
- combustível;
- bateria_kwh quando EV/PHEV;
- potência_cv;
- tração;
- caixa;
- ano e mês;
- quilómetros;
- origem;
- IVA discriminado;
- garantia;
- estado/danos;
- equipamento relevante;
- preço;
- vendedor;
- URL/fonte.

## 4. Regras de comparabilidade

### Exclusões duras
Um anúncio não entra no cálculo principal quando existe incompatibilidade estrutural, por exemplo:
- marca/modelo diferente;
- geração incompatível;
- combustível diferente;
- bateria claramente diferente num EV quando a diferença altera a versão;
- carroceria incompatível;
- versão de performance incompatível quando a potência/tração o demonstram.

### Semelhança ponderada
Cada comparável recebe score 0–100. A V1 usa os pesos:
- versão/geração: 25;
- motorização/bateria: 20;
- ano: 15;
- km: 15;
- potência/tração: 10;
- equipamento: 7;
- IVA/origem/garantia: 5;
- recência do anúncio: 3.

O score não é um preço; serve para determinar quanto cada anúncio deve influenciar o cálculo.

## 5. Preço
Não usar média simples.

Passos:
1. eliminar outliers extremos por IQR;
2. ajustar cada comparável para a viatura-alvo;
3. calcular mediana ponderada dos preços ajustados;
4. calcular dispersão;
5. produzir intervalo de mercado;
6. aplicar desconto de negociação previsto para obter preço provável de venda;
7. aplicar desconto adicional de liquidez para venda rápida.

As taxas de correção por km, idade e equipamento são configuração e, no futuro, serão aprendidas por segmento/modelo a partir do histórico.

## 6. Máximo de compra
```
max_compra =
  venda_provavel
  - custos_compra
  - transporte
  - recondicionamento
  - garantia_reserva
  - custo_stock
  - margem_objetivo
  - reserva_risco
```

O sistema também mostra "máximo absoluto", onde a margem mínima permitida substitui a margem objetivo.

## 7. Confiança
A confiança combina:
- número de comparáveis válidos;
- semelhança média;
- dispersão de preços;
- recência;
- percentagem de dados essenciais conhecidos.

Confiança baixa nunca deve ser escondida.

## 8. Memória comercial
As mensagens do utilizador são convertidas em regras estruturadas, nunca aplicadas cegamente.

Exemplo:
"Model 3 Performance 2022 abaixo de 100 mil km está a rodar muito bem."

Estrutura:
- entidade: Tesla Model 3 Performance;
- âmbito: ano 2022, km < 100000;
- tipo: liquidez_alta;
- origem: utilizador;
- validade: temporária;
- impacto permitido: score de liquidez/risco, não alteração arbitrária do preço de mercado.

A memória tem quatro tipos:
- procura/liquidez;
- risco técnico;
- preferência comercial;
- regra de margem/custo.

As regras podem ser contraditas por dados atuais; nesse caso o sistema deve explicar a divergência.

## 9. Aprendizagem com vendas reais
Guardar:
- preço de compra;
- custos reais;
- preço anunciado;
- preço final;
- dias em stock;
- financiamento/retoma quando relevante;
- margem real.

O histórico passa a ajustar:
- desconto médio anúncio→venda;
- dias de stock;
- margem necessária por segmento;
- correções por km/ano;
- procura real por modelo/versão.

## 10. Regra de produto
O projeto só deve avançar se o resultado for melhor que uma pesquisa manual rápida. O teste principal será:
"Antes de licitar, o comerciante quer ver obrigatoriamente o valor do Comparador Auto Pro?"
