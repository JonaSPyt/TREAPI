# API de Tombamentos - Guia de Uso

## Endpoints Implementados

### Health Check
```bash
GET /health
```

### Tombamentos CRUD

#### 1. Listar todos os tombamentos
```bash
curl http://localhost:3000/tombamentos
```

#### 2. Buscar tombamento por ID
```bash
curl http://localhost:3000/tombamentos/1
```

#### 3. Buscar tombamento por código
```bash
curl http://localhost:3000/tombamentos/codigo/1001
```

#### 4. Criar novo tombamento
```bash
curl -X POST http://localhost:3000/tombamentos \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": 2001,
    "descricao": "Notebook Dell Inspiron 15",
    "localizacao": "Sala 305",
    "oldcode": 1500,
    "valor": 4500.00,
    "status": 1
  }'
```

#### 5. Atualizar tombamento
```bash
curl -X PUT http://localhost:3000/tombamentos/1 \
  -H "Content-Type: application/json" \
  -d '{
    "descricao": "Notebook Dell Inspiron 15 - ATUALIZADO",
    "localizacao": "Sala 306"
  }'
```

#### 6. Upload de foto do tombamento
```bash
curl -X POST http://localhost:3000/tombamentos/1/foto \
  -F "foto=@/caminho/para/sua/imagem.jpg"
```

#### 7. Deletar tombamento
```bash
curl -X DELETE http://localhost:3000/tombamentos/1
```

## Campos da Tabela Tombamentos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | SERIAL | Auto | ID sequencial (gerado automaticamente) |
| codigo | INTEGER | Sim | Código único do tombamento |
| descricao | VARCHAR(500) | Sim | Descrição do bem |
| localizacao | VARCHAR(255) | Não | Localização física |
| oldcode | INTEGER | Não | Código antigo (se houver) |
| valor | DECIMAL(15,2) | Não | Valor do bem em reais |
| status | INTEGER | Não | Status (padrão: 1 = Ativo) |
| foto | VARCHAR(500) | Não | URL/caminho da foto |
| created_at | TIMESTAMP | Auto | Data de criação |
| updated_at | TIMESTAMP | Auto | Data de atualização |

## Status Sugeridos

- 1 = Ativo
- 2 = Inativo
- 3 = Em Manutenção
- 4 = Descartado

## Upload de Imagens

- **Tamanho máximo:** 5MB
- **Formatos aceitos:** jpeg, jpg, png, gif, webp
- **Pasta de armazenamento:** `uploads/`
- **Acesso às imagens:** `http://localhost:3000/uploads/nome-do-arquivo.jpg`

## Exemplos Completos

### Criar tombamento com todos os campos
```bash
curl -X POST http://localhost:3000/tombamentos \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": 3001,
    "descricao": "Ar Condicionado Split 12000 BTUs",
    "localizacao": "Sala de Reuniões - 2º Andar",
    "oldcode": 2500,
    "valor": 2800.50,
    "status": 1
  }'
```

### Upload de foto (após criar o tombamento)
```bash
# Supondo que o ID retornado foi 5
curl -X POST http://localhost:3000/tombamentos/5/foto \
  -F "foto=@./fotos/ar-condicionado.jpg"
```

### Buscar tombamento com foto
```bash
curl http://localhost:3000/tombamentos/5
```

Resposta esperada:
```json
{
  "id": 5,
  "codigo": 3001,
  "descricao": "Ar Condicionado Split 12000 BTUs",
  "localizacao": "Sala de Reuniões - 2º Andar",
  "oldcode": 2500,
  "valor": "2800.50",
  "status": 1,
  "foto": "/uploads/tombamento-1699372800000-123456789.jpg",
  "created_at": "2025-11-07T14:30:00.000Z",
  "updated_at": "2025-11-07T14:35:00.000Z"
}
```

## Códigos de Erro

- **400** - Requisição inválida (campos obrigatórios ausentes)
- **404** - Tombamento não encontrado
- **409** - Código de tombamento já existe
- **500** - Erro interno do servidor
