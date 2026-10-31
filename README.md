# RU Metrics — Sistema de Coleta e Avaliação de Desempenho de Filas

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.15-purple.svg)](https://www.prisma.io/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)

Aplicação web full-stack desenvolvida para coleta, armazenamento e avaliação de desempenho de filas no atendimento de proteína do **Restaurante Universitário (RU)**. Projetada para a disciplina acadêmica de **Avaliação de Desempenho**, contemplando operação com múltiplos canais (inicialmente 2 atendentes), filas compartilhadas ou separadas, tolerância a falhas de rede, registro de pausas/ocorrências e análise estocástica baseada na Teoria das Filas e na Lei de Little.

---

## 1. Stack Tecnológica

### Frontend
- **Framework:** React 18 com TypeScript e Vite.
- **Estilização:** Tailwind CSS (Mobile-First, alvos de toque $\ge 48\text{px}$, suporte a safe-area de iOS).
- **Roteamento:** React Router DOM v6 (10 telas completas).
- **Gerenciamento de Estado do Servidor:** TanStack Query (React Query).
- **Visualização de Dados:** Recharts (séries temporais, throughput e evolução de fila).
- **Ícones:** Lucide React.
- **Feedback:** Sons sintetizados via Web Audio API e vibração tátil nativa via Web Vibration API.

### Backend
- **Ambiente:** Node.js 20+ com TypeScript.
- **Servidor HTTP:** Express com arquitetura modular por domínio.
- **Validação de Entrada:** Zod nos middlewares e nas rotas.
- **Autenticação:** Sessões seguras com tokens JWT e cookies HttpOnly.
- **Concorrência & Idempotência:** Chave de idempotência (`Idempotency-Key` UUID) para prevenir duplicidade de contagens.
- **Documentação de API:** Especificação OpenAPI 3.0 interativa via Swagger UI (`/api-docs`).

### Banco de Dados
- **SGBD:** PostgreSQL 16 (normalizado, UUIDs, chaves estrangeiras com integridade referencial e índices compostos).
- **ORM:** Prisma ORM com migrations versionadas.
- **Containerização:** Docker Compose para banco de dados e para a aplicação completa.

### Testes
- **Testes Unitários:** Vitest (regras matemáticas, máquina de estados, percentis e variância).
- **Testes de Integração:** Supertest (endpoints da API REST, segurança e validações).

---

## 2. Estrutura do Repositório (Monorepo)

```text
Trabalho-AD/
├── backend/                      # Aplicação Backend Node.js / Express
│   ├── prisma/                   # Schema relacional, migrations e seed
│   │   ├── migrations/           # Histórico versionado de migrations SQL
│   │   ├── schema.prisma         # Modelo relacional do PostgreSQL
│   │   └── seed.ts               # Seed didático com dados fictícios
│   ├── src/
│   │   ├── config/               # Configuração de variáveis de ambiente e Prisma
│   │   ├── docs/                 # Especificação OpenAPI / Swagger
│   │   ├── middleware/           # Autenticação, validação Zod, idempotência e erros
│   │   ├── modules/              # Domínios (auth, collections, events, services, metrics, etc.)
│   │   ├── utils/                # Cálculo de Teoria das Filas, estatística e exportador CSV
│   │   ├── app.ts                # Inicialização do Express e middlewares globais
│   │   └── server.ts             # Ponto de entrada do servidor HTTP
│   ├── tests/                    # Testes automatizados (Unitários e Integração)
│   ├── Dockerfile
│   └── package.json
├── frontend/                     # Aplicação Frontend React / Vite
│   ├── src/
│   │   ├── api/                  # Clientes de API REST e fila de sincronização offline
│   │   ├── components/           # Componentes atômicos, layout, gráficos e operacionais
│   │   ├── context/              # Contexto de autenticação e monitoramento de conectividade
│   │   ├── pages/                # 10 Páginas do sistema (Operação, Métricas, Relatórios, etc.)
│   │   ├── utils/                # Formatadores PT-BR, cronômetro e feedback sonoro/háptico
│   │   ├── App.tsx               # Roteador com proteção de sessão
│   │   └── main.tsx              # Ponto de montagem da aplicação
│   ├── tests/                    # Testes de utilitários e componentes
│   ├── Dockerfile
│   └── package.json
├── docs/                         # Documentação técnica e científica
│   ├── ARCHITECTURE.md           # Decisões de arquitetura e padrões
│   ├── DATABASE_SCHEMA.md        # Diagrama ERD e dicionário de dados
│   └── METRICS_METHODOLOGY.md    # Fundamentação matemática e Lei de Little
├── docker-compose.yml            # Orquestração do PostgreSQL e serviços
├── .env.example                  # Modelo de variáveis de ambiente
├── .gitignore
├── package.json                  # Scripts globais dos workspaces
└── README.md                     # Guia completo de instalação e execução
```

---

## 3. Pré-requisitos

- **Node.js:** Versão 18.0.0 ou superior (recomendado Node 20 LTS).
- **npm:** Versão 9+ ou yarn/pnpm.
- **Docker & Docker Compose:** Para execução do PostgreSQL local (ou uma instância PostgreSQL 14+ já instalada).

---

## 4. Instalação e Configuração Passo a Passo

### 4.1 Clonar o Repositório e Instalar Dependências

No terminal da raiz do projeto:

```bash
# Instalar dependências da raiz e dos workspaces (backend e frontend)
npm install
```

### 4.2 Configurar Variáveis de Ambiente

Copie o arquivo de exemplo para gerar o `.env`:

```bash
cp .env.example .env
```

Conteúdo padrão do `.env`:
```ini
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ru_metrics?schema=public"
JWT_SECRET="dev-secret-key-ru-metrics-academico-2026-substituir-em-producao"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
VITE_API_URL="http://localhost:3001/api"
```

---

## 5. Inicialização do Banco de Dados

### 5.1 Subir o PostgreSQL via Docker Compose

Inicie o container oficial do PostgreSQL 16:

```bash
npm run docker:up
# ou: docker-compose up -d postgres
```

O container rodará na porta `5432` com usuário `postgres` e senha `postgres`, criando a base `ru_metrics`.

### 5.2 Executar as Migrations do Prisma

Aplique o esquema relacional versionado no banco de dados:

```bash
npm run db:migrate
# ou: npm run prisma:migrate --workspace=backend
```

### 5.3 Executar o Seed com Dados de Demonstração (Opcional)

Para carregar um usuário de teste e uma coleta de exemplo com dados didáticos para estudo:

```bash
npm run db:seed
```

> **Aviso Importante sobre o Seed:**
> O seed cria o usuário `pesquisador@rumetrics.edu.br` com senha `admin123` e uma coleta finalizada com o título `[DEMO/FICTÍCIO] Aferição Almoço - Proteína RU`. Todos os eventos dessa sessão são identificados explicitamente como demonstração acadêmica fictícia.

---

## 6. Execução em Modo de Desenvolvimento

Para rodar simultaneamente o backend (porta `3001`) e o frontend (porta `5173`):

```bash
npm run dev
```

Ou execute-os separadamente em dois terminais:

```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

Abra o navegador em: **`http://localhost:5173`**

### Credenciais Padrão do Seed:
- **Email:** `pesquisador@rumetrics.edu.br`
- **Senha:** `admin123`
- *(Ou crie um novo usuário diretamente pela tela de Cadastro).*

---

## 7. Documentação da API REST (Swagger)

Com o backend em execução, acesse a documentação interativa OpenAPI 3.0:

👉 **`http://localhost:3001/api-docs`**

A especificação em formato JSON puro está disponível em:
👉 **`http://localhost:3001/api-docs/json`**

---

## 8. Execução dos Testes Automatizados

O projeto conta com baterias completas de testes unitários e de integração:

```bash
# Executar todos os testes da aplicação (backend e frontend)
npm run test

# Executar apenas os testes de regras matemáticas e estatística
npm run test:unit

# Executar os testes de integração das rotas da API
npm run test:integration
```

---

## 9. Fluxo de Uso Recomendado no RU

1. **Acesso:** Faça login no smartphone ou computador.
2. **Nova Coleta:** Clique em **"Nova Coleta"**, defina o título, o local e a configuração de filas:
   - *Filas Separadas:* Cada atendente (A e B) atende uma fila exclusiva.
   - *Fila Única:* Estudantes formam uma única fila e são atendidos pelo profissional disponível.
3. **Tela Operacional:**
   - O cronômetro fica em espera até que você clique em **"Iniciar Aferição da Coleta"**.
   - Ao ver um estudante chegar ao final da fila: pressione o botão azul **"Registrar Chegada (+1)"**.
   - Ao ver o Atendente A concluir a entrega da porção: toque no botão verde **"Registrar Entrega A"**.
   - Ao ver o Atendente B concluir a entrega da porção: toque no botão verde **"Registrar Entrega B"**.
   - *Modo Cronometrado (Opcional):* Ative a chave no topo para cronometrar a duração individual do serviço e anotar a massa em gramas caso haja balança digital.
   - *Pausas Operacionais:* Caso a bancada pare para troca de travessas térmicas, toque em **"Pausar"** e indique o motivo. O tempo de pausa será automaticamente subtraído do tempo operacional líquido.
   - *Desfazer Registro:* Caso registre um clique acidental, o feed inferior permite anular o evento com justificativa para auditoria.
4. **Encerramento e Análise:**
   - Toque em **"Encerrar"** ao final do turno.
   - O sistema calculará automaticamente o Throughput individual e agregado ($X$), a taxa de chegada ($\lambda$), os tempos médios e medianos de serviço e avaliará a estabilidade da fila via **Lei de Little** ($L = \lambda W$).
5. **Exportação:**
   - Exporte a planilha em CSV com dados brutos ou métricas agregadas.
   - Acesse o relatório formatado para impressão ou salvamento em PDF.

---

## 10. Procedimentos de Backup e Restauração

### 10.1 Backup Completo do Banco de Dados
Para exportar um dump SQL seguro da base PostgreSQL:

```bash
docker exec -t ru_metrics_postgres pg_dump -U postgres -d ru_metrics > backup_ru_metrics_$(date +%Y%m%d_%H%M%S).sql
```

### 10.2 Restauração a partir do Backup
Para restaurar um dump salvo em um novo ambiente:

```bash
docker exec -i ru_metrics_postgres psql -U postgres -d ru_metrics < backup_ru_metrics_xxxx.sql
```

---

## 11. Geração de Build de Produção

Para gerar os pacotes otimizados para produção:

```bash
# Compilar backend e frontend
npm run build
```

- Backend compilado em: `backend/dist/`
- Frontend estático compilado em: `frontend/dist/`

Para rodar todo o ambiente em produção via Docker:
```bash
docker-compose up --build -d
```

---

## 12. Metodologia Científica e Ética na Comparação

O RU Metrics segue padrões rigorosos para estudos de Avaliação de Desempenho:

- **Sem conclusões indevidas:** O sistema nunca declara um atendente como "melhor" ou "mais produtivo" baseado unicamente no Throughput. Diferenças descritivas na amostra não implicam significância estatística sem controle de variáveis como consistência da carne servida e testes formais de hipótese ($t$-Student / Mann-Whitney).
- **Tratamento de ausência de dados:** O sistema nunca exibe médias como zero quando dados não foram coletados; campos sem medição são representados formalmente como desconhecidos/nulos.
- **Lei de Little com condições de estabilidade:** Quando $\lambda \ge c \cdot \mu$, o sistema reporta que a fila opera em regime instável (sobrecarga), alertando que as previsões estocásticas de equilíbrio estacionário não são válidas nesse regime.
