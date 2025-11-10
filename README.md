# Backend Express + PostgreSQL

Projeto base Node.js + Express + PostgreSQL para começar rapidamente.

## Pré-requisitos

- Node.js (v16+)
- PostgreSQL (v12+)
- npm ou yarn

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar PostgreSQL

Edite o arquivo `.env` com suas credenciais:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
DB_NAME=mydb
PORT=3000
```

### 3. Criar o banco de dados e tabela

Execute no PostgreSQL (via psql ou outro cliente):

```bash
# Criar banco (se não existir)
createdb mydb

# Executar schema
psql -U postgres -d mydb -f schema.sql
```

Ou via psql interativo:

```sql
CREATE DATABASE mydb;
\c mydb
-- Cole o conteúdo de schema.sql
```

### 4. Iniciar servidor

Produção:
```bash
npm start
```

Desenvolvimento (auto-reload):
```bash
npm run dev
```

## Endpoints

### Health Check
- **GET** `/health` → verifica conexão com banco

### Devices CRUD
- **GET** `/devices` → lista todos os devices
- **GET** `/devices/:id` → busca device por id
- **POST** `/devices` → cria novo device
  - Body: `{ "name": "Device X", "type": "sensor", "description": "..." }`
- **PUT** `/devices/:id` → atualiza device
  - Body: `{ "name": "Novo nome", ... }` (campos opcionais)
- **DELETE** `/devices/:id` → deleta device

## Exemplos de uso

```bash
# Health check
curl http://localhost:3000/health

# Listar devices
curl http://localhost:3000/devices

# Criar device
curl -X POST http://localhost:3000/devices \
  -H "Content-Type: application/json" \
  -d '{"name":"Device Test","type":"sensor"}'

# Atualizar device
curl -X PUT http://localhost:3000/devices/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Device Updated"}'

# Deletar device
curl -X DELETE http://localhost:3000/devices/1
```

## Estrutura do Projeto

```
src/
  ├── app.js      # Configuração Express + rotas + pool PostgreSQL
  └── index.js    # Entrada do servidor
.env              # Variáveis de ambiente (não commitar!)
schema.sql        # Schema do banco de dados
package.json      # Dependências
```

## Variáveis de Ambiente (.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| DB_HOST | Host do PostgreSQL | localhost |
| DB_PORT | Porta do PostgreSQL | 5432 |
| DB_USER | Usuário do banco | postgres |
| DB_PASSWORD | Senha do banco | - |
| DB_NAME | Nome do banco | mydb |
| PORT | Porta do servidor | 3000 |
