# Metodologia Matemática e Teoria das Filas — RU Metrics

Este documento estabelece o embasamento matemático, as premissas estocásticas e as fórmulas utilizadas no **RU Metrics** para a disciplina acadêmica de **Avaliação de Desempenho**.

---

## 1. Tempo Operacional Válido ($T$)

O tempo total decorrido entre o início ($T_{\text{início}}$) e o encerramento ($T_{\text{fim}}$) é descontado de todos os intervalos de pausa registrados:

$$T_{\text{total}} = T_{\text{fim}} - T_{\text{início}}$$

$$T_{\text{pausas}} = \sum_{i=1}^{k} (T_{\text{fim\_pausa}, i} - T_{\text{início\_pausa}, i})$$

$$T = \max(0, T_{\text{total}} - T_{\text{pausas}})$$

*Nota:* Se $T \le 0$, nenhuma taxa temporal é calculada para evitar divisão por zero ou resultados matematicamente indefinidos.

---

## 2. Throughput / Vazão de Atendimento ($X$)

A vazão representa o número de estudantes atendidos por unidade de tempo de serviço válido:

$$X = \frac{N}{T}$$

Onde:
- $N$ é o número de entregas de proteína com status válido (eventos com `is_voided = false`).
- $T$ é o tempo operacional válido expresso em minutos ou horas.

O sistema calcula tanto o throughput individual de cada atendente ($X_A, X_B$) quanto a capacidade agregada observada da bancada:

$$X_{\text{total}} = \sum_{j=1}^{c} X_j = \frac{N_{\text{total}}}{T}$$

---

## 3. Taxa Média de Chegada ($\lambda$)

A intensidade com que novos estudantes ingressam na fila do RU:

$$\lambda = \frac{A}{T}$$

Onde $A$ é a contagem de eventos de chegada (`ARRIVAL`) registrados independentemente das entregas. Chegadas não são estimadas a partir de entregas; se $A = 0$, $\lambda$ é reportado como desconhecido.

---

## 4. Tempo de Serviço ($E[S]$) e Estatísticas Descritivas

No modo cronometrado, cada atendimento individual gera uma duração válida $s_i$ em segundos. A partir do vetor ordenado $(s_{(1)}, s_{(2)}, \dots, s_{(n)})$, calculam-se:

- **Média Amostral:**
  $$\bar{s} = \frac{1}{n} \sum_{i=1}^{n} s_i$$
- **Mediana Amostral ($P_{50}$):** Ponto médio ordenado que divide a distribuição em 50% inferiores e superiores.
- **Desvio Padrão Amostral ($s$):**
  $$s = \sqrt{\frac{1}{n-1} \sum_{i=1}^{n} (s_i - \bar{s})^2} \quad (n > 1)$$
- **Percentis de Cauda ($P_{25}, P_{75}, P_{90}, P_{95}$):**
  Identificam o comportamento de cauda longa do atendimento (ex.: alunos com solicitações especiais ou atrasos no corte da carne).

---

## 5. Teoria das Filas e Lei de Little

A **Lei de Little** é uma relação fundamental da engenharia de tráfego de redes e sistemas de computação:

$$L = \lambda W$$

Onde:
- $L$ é o número médio de estudantes presentes no sistema (esperando na fila + sendo atendidos no balcão).
- $\lambda$ é a taxa média de chegada de estudantes ao sistema.
- $W$ é o tempo médio total que o estudante permanece no sistema.

### 5.1 Decomposição dos Tempos
$$W = W_q + E[S]$$
- $W_q$: Tempo médio de espera na fila até alcançar a bancada de atendimento.
- $E[S]$: Tempo médio de serviço no balcão de proteína.

### 5.2 Condição de Estabilidade Estocástica
Para um sistema com $c$ canais de atendimento em paralelo (no RU, $c = 2$ atendentes), a capacidade máxima nominal de escoamento é $c \cdot \mu$, onde $\mu$ é a taxa de serviço individual por canal. A intensidade de tráfego é dada por:

$$\rho = \frac{\lambda}{c \cdot \mu}$$

- Se $\rho < 1$: O sistema é **estável** em regime permanente. As filas formadas são transitórias e o comprimento médio $L$ atinge equilíbrio finito.
- Se $\rho \ge 1$: O sistema é **saturado / instável**. A taxa de estudantes que chegam é superior à velocidade combinada dos atendentes. A fila física no RU cresce sem limite finito até a exaustão do turno. O sistema emite um alerta explícito destacando a instabilidade.

---

## 6. Ressalva Acadêmica na Comparação de Atendentes

O sistema RU Metrics foi projetado em estrita consonância com a ética científica:

> **Diretriz de Imparcialidade:** Uma taxa de throughput $X_A > X_B$ não autoriza a conclusão de que o Atendente A é "melhor" ou "mais produtivo". O tempo de atendimento é influenciado por fatores não controlados como:
> 1. Variação no tipo e consistência da proteína servida (ex.: frango grelhado vs carne desfiada com osso).
> 2. Diálogos, dúvidas de estudantes e solicitações de repetição ou porções adicionais.
> 3. Flutuações na reposição dos recipientes térmicos.
> 
> Diferenças descritivas observadas na amostra exigem testes de hipóteses formais (ex.: teste $t$ de Student para médias ou teste de Mann-Whitney para medianas) e controle estrito das variáveis intervenientes antes de qualquer inferência de causalidade.
