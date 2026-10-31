# Arquitetura do Sistema — RU Metrics

Este documento detalha as decisões técnicas, a arquitetura de software e os padrões adotados no desenvolvimento do **RU Metrics — Sistema de Coleta e Avaliação de Desempenho de Filas**.

---

## 1. Visão Geral da Arquitetura

O sistema adota uma arquitetura em camadas orientada a serviços REST, com desacoplamento rigoroso entre a interface operacional (Frontend SPA), a camada de negócio e regras matemáticas (Backend API) e a persistência relacional (PostgreSQL).

```
[ Usuário no RU (Celular/Desktop) ]
              │
              ▼
   [ Frontend React + Vite ] ──(Modo Offline: LocalStorage)
              │
        HTTP / JSON
              │
              ▼
   [ Backend Node.js / Express ]
   ├── Middleware de Autenticação (JWT HttpOnly)
   ├── Middleware de Validação (Zod)
   ├── Middleware de Idempotência (Idempotency-Key)
   ├── Máquina de Estados de Coletas
   ├── Motor de Cálculo de Teoria das Filas & Métricas
   └── Log de Auditoria Contínua
              │
        Prisma ORM
              │
              ▼
    [ PostgreSQL 16 ]
```

---

## 2. Decisões Técnicas Fundamentais

### 2.1 Stack Tecnológica
- **Backend:** Node.js com TypeScript e Express. A escolha pelo Express aliado a Zod e arquitetura modular de domínio garante menor sobrecarga em requisições de coleta sob alta frequência e total transparência no tratamento de exceções.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS e TanStack Query. Garante tempos de resposta abaixo de 50ms na interação tátil, crucial para o operador registrando entregas rápidas na bancada do RU.
- **Banco de Dados:** PostgreSQL 16 estruturado via Prisma ORM. O modelo relacional é totalmente normalizado com chaves estrangeiras, restrições e índices compostos.
- **Concorrência e Idempotência:** Toda operação de criação de eventos exige uma chave de idempotência (`idempotency_key` UUID gerada no cliente). Requisições repetidas retornam status `200 OK` com cabeçalho `X-Idempotent-Replay: true`, sem duplicar contagens ou corromper métricas.

### 2.2 Máquina de Estados da Coleta
Para garantir integridade metodológica acadêmica, cada sessão obedece à seguinte máquina de estados:

1. **DRAFT (Rascunho):** Coleta configurada, atendentes definidos. O cronômetro não corre e eventos não podem ser disparados.
2. **IN_PROGRESS (Em andamento):** Cronômetro ativo, controles de registro liberados, carimbo de data/hora oficial no servidor.
3. **PAUSED (Pausada):** Interrupção temporária (ex.: troca de cubas térmicas). O tempo de pausa é acumulado na tabela `collection_pauses` e **descontado** do tempo operacional líquido ($T$).
4. **FINISHED (Encerrada):** Coleta concluída. O encerramento cancela atendimentos em aberto e consolida as métricas. Nenhuma entrega pode ser adicionada sem reabertura formal gravada no log de auditoria.

---

## 3. Estratégia de Coleta em Dois Modos

1. **Modo Rápido (Event-Driven):**
   - Registra apenas o evento de conclusão da entrega (`DELIVERY`).
   - Ideal quando há apenas um operador com smartphone em pé observando o fluxo contínuo.
   - Permite calcular com exatidão o throughput individual e agregado ($X = N/T$).

2. **Modo Cronometrado (Interval-Driven):**
   - Registra o início do atendimento e sua conclusão.
   - O sistema calcula a duração exata ($D = T_{\text{fim}} - T_{\text{início}}$) e impede que o mesmo atendente tenha dois atendimentos simultâneos.
   - Permite calcular média, mediana, desvio padrão e percentis (P25, P75, P90, P95) reais do tempo de serviço.
   - Permite anexar a pesagem em gramas (opcional) associada à porção servida.

---

## 4. Auditoria e Rastreabilidade

Nenhum evento registrado em uma coleta é excluído fisicamente do banco de dados quando cancelado por engano. O evento é marcado com `is_voided = true`, carimbo de data/hora, identificador do usuário e justificativa textual obrigatória, e uma linha correspondente é inserida na tabela `audit_logs`. O motor de cálculo de métricas ignora eventos anulados.

---

## 5. Resiliência de Conectividade (Offline-First)

Caso a conexão Wi-Fi ou 4G do RU oscile:
1. O evento é capturado pelo `offlineQueue` e salvo no armazenamento persistente local (`localStorage`/`IndexedDB`) com status `PENDING`.
2. Um alerta visual amarelo no topo da tela informa a quantidade de registros pendentes de envio.
3. Ao restabelecer a rede (`online` event), o sistema dispara `flushOfflineQueue()` de forma sequencial com cabeçalhos de idempotência.
4. O servidor reconhece as requisições pendentes e grava os dados com seus timestamps originais de ocorrência.
