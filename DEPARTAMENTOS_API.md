# 🏢 API de Departamentos - Documentação para Frontend Flutter

## 📋 Conceito - Fluxo de Trabalho

A estrutura funciona assim:

1. **Criar um Departamento** (como criar uma "sala" no Classroom)
   - Você define um código único (ex: "SECAT", "TI", "SALA101")
   - O departamento representa um setor/sala física

2. **Importar tombamentos para o departamento**
   - Você importa um PDF/planilha com a lista de tombamentos que **DEVERIAM** estar naquele departamento
   - Os tombamentos são criados **JÁ vinculados** ao departamento
   - Status inicial: `0` (Sem status - ainda não verificado)

3. **Verificar presencialmente**
   - Vai até o local físico
   - Escaneia/confere cada tombamento
   - Atualiza o status: encontrado, não encontrado, danificado, etc.

---

## 🔄 O que mudou (para o frontend)

### Antes:
- Tombamentos existiam independentes
- Depois você vinculava a um departamento

### Agora:
- **Tombamentos são criados DENTRO do departamento**
- O endpoint `POST /departamentos/:id/tombamentos` agora **CRIA** os tombamentos já vinculados
- Não precisa mais criar tombamento separado e depois vincular

---

## 📊 Estrutura de Dados

### Departamento
```json
{
  "id": 1,
  "codigo": "SECAT",
  "nome": "Seção de Atendimento",
  "descricao": "Seção de Atendimento - Térreo",
  "total_tombamentos": 150
}
```

### Tombamento
```json
{
  "id": 1,
  "codigo": "12345",
  "descricao": "Monitor Dell 24''",
  "localizacao": "Mesa 5",
  "departamento_id": 1,      // 🆕 Sempre pertence a um departamento
  "status": 0,               // Status da verificação
  "foto": "/uploads/xxx.jpg",
  "oldcode": "ABC123",
  "valor": 1500.00
}
```

### Status dos Tombamentos
| Código | Descrição | Cor sugerida |
|--------|-----------|--------------|
| 0 | ⚪ Sem status (não verificado) | Cinza |
| 1 | ✅ Encontrado | Verde |
| 2 | 🟡 Encontrado e não relacionado | Amarelo |
| 3 | 🟠 Sem identificação | Laranja |
| 4 | 🔴 Danificado | Vermelho |
| 5 | ❌ Não encontrado | Vermelho escuro |

---

## 🔗 Endpoints Principais

### Base URL
```
http://10.7.100.114:3000
```

---

## 📁 DEPARTAMENTOS

### Listar todos
```http
GET /departamentos
```
Retorna lista com `total_tombamentos` de cada um.

### Criar departamento
```http
POST /departamentos
Content-Type: application/json

{
  "codigo": "SALA101",
  "nome": "Sala 101 - Atendimento",
  "descricao": "Sala de atendimento ao público"
}
```

### Buscar por código
```http
GET /departamentos/codigo/SALA101
```

### Deletar (só se não tiver tombamentos)
```http
DELETE /departamentos/:id
```

---

## 📦 IMPORTAR TOMBAMENTOS PARA DEPARTAMENTO

### 🆕 Criar/Importar tombamentos no departamento
```http
POST /departamentos/:id/tombamentos
Content-Type: application/json

{
  "tombamentos": [
    {
      "codigo": "12345",
      "descricao": "Monitor Dell 24 polegadas",
      "localizacao": "Mesa 1"
    },
    {
      "codigo": "12346",
      "descricao": "Teclado HP USB",
      "localizacao": "Mesa 1"
    },
    {
      "codigo": "12347",
      "descricao": "Mouse Logitech"
    }
  ]
}
```

**Resposta:**
```json
{
  "message": "3 criados, 0 atualizados no departamento \"Sala 101\"",
  "departamento": { "id": 1, "nome": "Sala 101" },
  "total": 3,
  "criados": 3,
  "atualizados": 0,
  "erros": 0
}
```

⚠️ **Importante:** 
- Se o código já existir (em qualquer departamento), ele é **movido** para este departamento
- Campos obrigatórios: apenas `codigo`
- Status inicial: `0` (não verificado)

---

### Listar tombamentos do departamento
```http
GET /departamentos/:id/tombamentos
```

---

## ✅ VERIFICAÇÃO (atualizar status)

### Atualizar status de um tombamento
```http
PUT /tombamentos/:id
Content-Type: application/json

{
  "status": 1
}
```

### Upload de foto (prova que encontrou)
```http
POST /tombamentos/:id/foto
Content-Type: multipart/form-data

foto: [arquivo de imagem]
```

---

## 📱 Código Flutter

### Model Departamento
```dart
class Departamento {
  final int? id;
  final String codigo;
  final String nome;
  final String? descricao;
  final int totalTombamentos;

  Departamento({
    this.id,
    required this.codigo,
    required this.nome,
    this.descricao,
    this.totalTombamentos = 0,
  });

  factory Departamento.fromJson(Map<String, dynamic> json) {
    return Departamento(
      id: json['id'],
      codigo: json['codigo'],
      nome: json['nome'],
      descricao: json['descricao'],
      totalTombamentos: int.tryParse(json['total_tombamentos']?.toString() ?? '0') ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'codigo': codigo,
    'nome': nome,
    if (descricao != null) 'descricao': descricao,
  };
}
```

### Model Tombamento
```dart
class Tombamento {
  final int? id;
  final String codigo;
  final String? descricao;
  final String? localizacao;
  final int? departamentoId;
  final int status;
  final String? foto;
  final String? oldcode;
  final double? valor;

  Tombamento({
    this.id,
    required this.codigo,
    this.descricao,
    this.localizacao,
    this.departamentoId,
    this.status = 0,
    this.foto,
    this.oldcode,
    this.valor,
  });

  factory Tombamento.fromJson(Map<String, dynamic> json) {
    return Tombamento(
      id: json['id'],
      codigo: json['codigo'],
      descricao: json['descricao'],
      localizacao: json['localizacao'],
      departamentoId: json['departamento_id'],
      status: json['status'] ?? 0,
      foto: json['foto'],
      oldcode: json['oldcode'],
      valor: json['valor'] != null ? double.tryParse(json['valor'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'codigo': codigo,
    if (descricao != null) 'descricao': descricao,
    if (localizacao != null) 'localizacao': localizacao,
    if (oldcode != null) 'oldcode': oldcode,
    if (valor != null) 'valor': valor,
    'status': status,
  };

  // Helper para cor do status
  Color get statusColor {
    switch (status) {
      case 1: return Colors.green;
      case 2: return Colors.yellow.shade700;
      case 3: return Colors.orange;
      case 4: return Colors.red;
      case 5: return Colors.red.shade900;
      default: return Colors.grey;
    }
  }

  String get statusText {
    switch (status) {
      case 1: return 'Encontrado';
      case 2: return 'Encontrado e não relacionado';
      case 3: return 'Sem identificação';
      case 4: return 'Danificado';
      case 5: return 'Não encontrado';
      default: return 'Não verificado';
    }
  }
}
```

### Service
```dart
class ApiService {
  static const String baseUrl = 'http://10.7.100.114:3000';

  // ==================== DEPARTAMENTOS ====================
  
  Future<List<Departamento>> listarDepartamentos() async {
    final response = await http.get(Uri.parse('$baseUrl/departamentos'));
    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Departamento.fromJson(e)).toList();
    }
    throw Exception('Erro ao carregar departamentos');
  }

  Future<Departamento> criarDepartamento(Departamento dept) async {
    final response = await http.post(
      Uri.parse('$baseUrl/departamentos'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(dept.toJson()),
    );
    if (response.statusCode == 201) {
      return Departamento.fromJson(json.decode(response.body));
    }
    throw Exception('Erro ao criar departamento');
  }

  // ==================== IMPORTAR TOMBAMENTOS ====================

  /// Importa lista de tombamentos para um departamento
  /// Os tombamentos são CRIADOS já vinculados ao departamento
  Future<Map<String, dynamic>> importarTombamentos(
    int departamentoId, 
    List<Tombamento> tombamentos,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/departamentos/$departamentoId/tombamentos'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'tombamentos': tombamentos.map((t) => t.toJson()).toList(),
      }),
    );
    
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Erro ao importar tombamentos');
  }

  Future<List<Tombamento>> listarTombamentosDepartamento(int departamentoId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/departamentos/$departamentoId/tombamentos'),
    );
    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Tombamento.fromJson(e)).toList();
    }
    throw Exception('Erro ao carregar tombamentos');
  }

  // ==================== VERIFICAÇÃO ====================

  Future<Tombamento> atualizarStatus(int tombamentoId, int status) async {
    final response = await http.put(
      Uri.parse('$baseUrl/tombamentos/$tombamentoId'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'status': status}),
    );
    if (response.statusCode == 200) {
      return Tombamento.fromJson(json.decode(response.body));
    }
    throw Exception('Erro ao atualizar status');
  }

  Future<Tombamento> uploadFoto(int tombamentoId, File foto) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/tombamentos/$tombamentoId/foto'),
    );
    request.files.add(await http.MultipartFile.fromPath('foto', foto.path));
    
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return Tombamento.fromJson(data['tombamento']);
    }
    throw Exception('Erro ao enviar foto');
  }
}
```

---

## 🔄 Fluxo Completo no App

```
┌─────────────────────────────────────────────────────────────┐
│  1. TELA INICIAL - Lista de Departamentos                   │
│     [SECAT - 150 itens] [TI - 80 itens] [+]                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. CRIAR DEPARTAMENTO                                      │
│     Código: [SALA101]                                       │
│     Nome: [Sala 101 - Atendimento]                         │
│     [Criar]                                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. IMPORTAR TOMBAMENTOS (do PDF/planilha)                  │
│     📄 Selecionar arquivo...                                │
│     ou                                                      │
│     [Código] [Descrição] [+]                               │
│     12345   Monitor Dell                                    │
│     12346   Teclado HP                                      │
│     [Importar para SALA101]                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. VERIFICAÇÃO - Lista de tombamentos                      │
│     ⚪ 12345 - Monitor Dell          [📷] [✓] [✗]          │
│     ⚪ 12346 - Teclado HP            [📷] [✓] [✗]          │
│     ✅ 12347 - Mouse (encontrado)    [📷]                   │
│                                                             │
│     Progresso: 1/3 verificados (33%)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Teste Rápido

```bash
# 1. Criar departamento
curl -X POST http://10.7.100.114:3000/departamentos \
  -H "Content-Type: application/json" \
  -d '{"codigo": "TESTE", "nome": "Departamento Teste"}'

# 2. Importar tombamentos para ele (use o ID retornado)
curl -X POST http://10.7.100.114:3000/departamentos/1/tombamentos \
  -H "Content-Type: application/json" \
  -d '{
    "tombamentos": [
      {"codigo": "T001", "descricao": "Item 1"},
      {"codigo": "T002", "descricao": "Item 2"},
      {"codigo": "T003", "descricao": "Item 3"}
    ]
  }'

# 3. Ver tombamentos do departamento
curl http://10.7.100.114:3000/departamentos/1/tombamentos

# 4. Atualizar status (encontrou o item)
curl -X PUT http://10.7.100.114:3000/tombamentos/1 \
  -H "Content-Type: application/json" \
  -d '{"status": 1}'
```
