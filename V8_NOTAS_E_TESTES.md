# Serra do Éter — World Evolution V8

**Status:** versão experimental HTML independente; NÃO substitui o jogo original sem IMG, nem a V7 aprovada.

## Abrir e jogar
Abra \`Serra_do_Eter_World_Evolution_V8.html\` diretamente no Microsoft Edge/Chrome com WebGL habilitado. Nenhum CDN, backend, conta ou instalação é exigido.

- **WASD / setas:** acelerar, frear/ré e esterçar
- **Câmera:** cinco perspectivas; visão aérea inclinada por padrão
- **Roda do mouse:** zoom nas câmeras aéreas; arrastar para girar
- **Explorar:** teleporte para regiões e piloto automático demonstrativo na subida principal
- **Mapa:** minimapa topográfico
- **Qualidade:** alternar entre equilibrada e econômica
- **Verificar inclinações:** auditoria matemática integrada às rotas

## O que mudou da V7
- Relevo com serrilhamento adicional, variação rochosa e margens do lago suavizadas.
- Terreno de horizonte persistente para não perder cordilheiras distantes na câmera aérea.
- Tesselação local 2× mais densa junto às estradas.
- Costura de bordas de blocos com saias também no LOD próximo; atualização bidirecional dos níveis de detalhe.
- Colisão fora das vias interpolada conforme os mesmos triângulos renderizados; amostragem da pista preservada nas vias.
- Carroceria inclina longitudinal/lateralmente conforme a superfície.
- Defensas lineares ao longo de trechos de desnível.
- Estrada de acesso conectando o anel do lago à ligação do litoral.
- V7 permanece salva em ramo anterior.

## Validação executada
Testes em JavaScript, com objetos de canvas/WebGL simulados (NÃO são benchmarks visuais reais):
- Compilação/sintaxe: **aprovada**
- Inicialização e **150 quadros simulados**: **aprovados**
- **2.704 pontos** do campo de terreno: valores finitos
- **8 rotas**: alinhamento entre elevação central planejada e campo do terreno: **0 desvios acima de 2 unidades**
- Máxima inclinação longitudinal observada: **9,37%** (Serra Oriental)
- Outras inclinações: Serra Ocidental 8,19%, Lúmens 5,51%, Litoral 2,74%, outras < 1%
- UI exercitada: troca de câmera, mapa, menu, teleporte para nove destinos, modo econômico, auditoria e piloto automático

Testes adicionais de Chromium desktop e mobile foram **configurados**, não assumidos como aprovados:
- \`tests/serra-v8-smoke.mjs\`
- \`.github/workflows/serra-v8-qa.yml\`
O workflow faz screenshots e verifica WebGL real quando GitHub Actions executa.

## Pendências conhecidas
- Não houve acesso direto ao Microsoft Edge do usuário nem inspeção de capturas geradas no Chromium nesta sessão.
- A malha distante do horizonte é simplificada e mais baixa que a malha próxima; em certos ângulos, a transição pode aparecer. A borda entre LODs tem saias, mas não há uma solução topológica de costura de alta fidelidade.
- A física ainda é arcade demonstrativa, sem suspensão individual, pneus com força real, colisões físicas com árvores/rochas ou as coleções finais de carros.
- As guardas laterais são primitivas procedurais e precisam de inspeção geométrica em curvas muito fechadas.
- O mar e o lago têm água visual estática nesta reconstrução; não têm a física de água do jogo original.
- A auditoria geométrica se concentra no eixo da via; cruzamentos, acostamentos e cortes precisam de uma inspeção visual no browser.
- Não é possível provar ausência absoluta de bugs.

## Arquivos
- Jogo: \`Serra_do_Eter_World_Evolution_V8.html\`
- Teste browser: \`tests/serra-v8-smoke.mjs\`
- CI: \`.github/workflows/serra-v8-qa.yml\`

Este ramo serve como entrega independente de revisão estruturada, não como alteração em \`main\`.
