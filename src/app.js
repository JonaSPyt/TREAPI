
// ...existing code...


// ...existing code...

// IMPORTANTE: carregar dotenv ANTES de tudo
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Criar diretório de uploads se não existir
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar multer para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'tombamento-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(uploadsDir));

// PostgreSQL connection pool (agora as variáveis já estão carregadas)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Log das configurações (sem mostrar senha completa)
console.log('Configuração do banco:');
console.log('  Host:', process.env.DB_HOST);
console.log('  Port:', process.env.DB_PORT);
console.log('  User:', process.env.DB_USER);
console.log('  Database:', process.env.DB_NAME);

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Erro ao conectar no PostgreSQL:', err.stack);
  } else {
    console.log('PostgreSQL conectado com sucesso!');
    release();
  }
});

// Health endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected', timestamp: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// ==================== DEPARTAMENTOS ROUTES ====================

// GET all departamentos
app.get('/departamentos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, 
             (SELECT COUNT(*) FROM tombamentos t WHERE t.departamento_id = d.id) as total_tombamentos
      FROM departamentos d
      ORDER BY d.nome
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar departamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar departamentos', detail: error.message });
  }
});

// GET departamento by id
app.get('/departamentos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT d.*, 
             (SELECT COUNT(*) FROM tombamentos t WHERE t.departamento_id = d.id) as total_tombamentos
      FROM departamentos d
      WHERE d.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar departamento:', error);
    res.status(500).json({ error: 'Erro ao buscar departamento', detail: error.message });
  }
});

// GET departamento by codigo
app.get('/departamentos/codigo/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await pool.query(`
      SELECT d.*, 
             (SELECT COUNT(*) FROM tombamentos t WHERE t.departamento_id = d.id) as total_tombamentos
      FROM departamentos d
      WHERE d.codigo = $1
    `, [codigo]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar departamento por código:', error);
    res.status(500).json({ error: 'Erro ao buscar departamento', detail: error.message });
  }
});

// GET tombamentos de um departamento
app.get('/departamentos/:id/tombamentos', async (req, res) => {
  const { id } = req.params;
  try {
    // Verificar se departamento existe
    const deptCheck = await pool.query('SELECT id FROM departamentos WHERE id = $1', [id]);
    if (deptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    
    const result = await pool.query(
      'SELECT * FROM tombamentos WHERE departamento_id = $1 ORDER BY codigo',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar tombamentos do departamento:', error);
    res.status(500).json({ error: 'Erro ao buscar tombamentos', detail: error.message });
  }
});

// DELETE todos os tombamentos de um departamento (incluindo fotos)
app.delete('/departamentos/:id/tombamentos', async (req, res) => {
  const { id } = req.params;
  try {
    // Verificar se departamento existe
    const deptCheck = await pool.query('SELECT id, nome FROM departamentos WHERE id = $1', [id]);
    if (deptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    
    const departamento = deptCheck.rows[0];
    
    // Buscar tombamentos com fotos para excluir os arquivos
    const tombamentosComFoto = await pool.query(
      'SELECT id, foto FROM tombamentos WHERE departamento_id = $1 AND foto IS NOT NULL',
      [id]
    );
    
    // Excluir arquivos de foto do sistema de arquivos
    let fotosExcluidas = 0;
    for (const tomb of tombamentosComFoto.rows) {
      if (tomb.foto) {
        // Extrair nome do arquivo da URL (/uploads/foto.jpg -> foto.jpg)
        const filename = tomb.foto.replace('/uploads/', '');
        const filePath = path.join(uploadsDir, filename);
        
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            fotosExcluidas++;
            console.log(`🗑️ Foto excluída: ${filename}`);
          } catch (err) {
            console.error(`Erro ao excluir foto ${filename}:`, err.message);
          }
        }
      }
    }
    
    // Conta quantos tombamentos serão excluídos
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM tombamentos WHERE departamento_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].count);
    
    if (total === 0) {
      return res.json({ 
        message: 'Nenhum tombamento para excluir',
        excluidos: 0,
        fotos_excluidas: 0,
        departamento_id: parseInt(id),
        departamento_nome: departamento.nome
      });
    }
    
    // Exclui todos os tombamentos do departamento
    await pool.query(
      'DELETE FROM tombamentos WHERE departamento_id = $1',
      [id]
    );
    
    console.log(`🗑️ ${total} tombamentos e ${fotosExcluidas} fotos excluídos do departamento "${departamento.nome}"`);
    
    res.json({ 
      message: `${total} tombamentos excluídos com sucesso`,
      excluidos: total,
      fotos_excluidas: fotosExcluidas,
      departamento_id: parseInt(id),
      departamento_nome: departamento.nome
    });
  } catch (error) {
    console.error('Erro ao excluir tombamentos do departamento:', error);
    res.status(500).json({ error: 'Erro ao excluir tombamentos', detail: error.message });
  }
});

// POST create departamento
app.post('/departamentos', async (req, res) => {
  const { codigo, nome, descricao } = req.body;
  
  if (!codigo || !nome) {
    return res.status(400).json({ error: 'Campos "codigo" e "nome" são obrigatórios' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO departamentos (codigo, nome, descricao) VALUES ($1, $2, $3) RETURNING *',
      [codigo, nome, descricao || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar departamento:', error);
    if (error.code === '23505') { // unique violation
      return res.status(409).json({ error: 'Código de departamento já existe', detail: error.message });
    }
    res.status(500).json({ error: 'Erro ao criar departamento', detail: error.message });
  }
});

// PUT update departamento
app.put('/departamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo, nome, descricao } = req.body;

  try {
    const result = await pool.query(
      `UPDATE departamentos SET 
        codigo = COALESCE($1, codigo),
        nome = COALESCE($2, nome),
        descricao = COALESCE($3, descricao),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 RETURNING *`,
      [codigo, nome, descricao, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar departamento:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Código de departamento já existe', detail: error.message });
    }
    res.status(500).json({ error: 'Erro ao atualizar departamento', detail: error.message });
  }
});

// DELETE departamento
app.delete('/departamentos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar se há tombamentos vinculados
    const tombamentosCheck = await pool.query(
      'SELECT COUNT(*) FROM tombamentos WHERE departamento_id = $1',
      [id]
    );
    
    if (parseInt(tombamentosCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Não é possível deletar departamento com tombamentos vinculados',
        tombamentos_vinculados: parseInt(tombamentosCheck.rows[0].count)
      });
    }
    
    const result = await pool.query('DELETE FROM departamentos WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    
    res.json({ message: 'Departamento deletado com sucesso', departamento: result.rows[0] });
  } catch (error) {
    console.error('Erro ao deletar departamento:', error);
    res.status(500).json({ error: 'Erro ao deletar departamento', detail: error.message });
  }
});

// POST /departamentos/:id/tombamentos/batch - Importação em lote (DEVE vir ANTES de :tombamentoId)
app.post('/departamentos/:id/tombamentos/batch', async (req, res) => {
  const { id } = req.params;
  const { tombamentos } = req.body;

  if (!tombamentos || !Array.isArray(tombamentos)) {
    return res.status(400).json({
      error: 'Array de tombamentos é obrigatório',
      exemplo: {
        tombamentos: [
          { codigo: "123", descricao: "Monitor", localizacao: "Sala 1", valor: "1000" },
          { codigo: "456", descricao: "CPU", localizacao: "Sala 2", valor: "2000" }
        ]
      }
    });
  }

  let criados = 0, atualizados = 0, ignorados = 0;
  const detalhes = [];
  for (const t of tombamentos) {
    try {
      const codigo = t.codigo ? String(t.codigo).trim() : null;
      if (!codigo) {
        ignorados++;
        detalhes.push({ codigo: null, status: 'ignorado', motivo: 'Código ausente' });
        continue;
      }
      const descricao = t.descricao && t.descricao.trim() !== '' ? t.descricao.trim() : 'Sem descrição';
      const localizacao = t.localizacao && t.localizacao.trim() !== '' ? t.localizacao.trim() : null;
      const valor = t.valor !== undefined ? t.valor : null;
      const status = t.status !== undefined ? t.status : 0; // ✅ Usa o status enviado, default 0

      const existing = await pool.query(
        'SELECT id, departamento_id FROM tombamentos WHERE codigo = $1',
        [codigo]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE tombamentos SET descricao = $1, localizacao = $2, valor = $3, status = $4, departamento_id = $5, updated_at = NOW() WHERE id = $6`,
          [descricao, localizacao, valor, status, id, existing.rows[0].id]
        );
        atualizados++;
        detalhes.push({ codigo, status: 'atualizado', id: existing.rows[0].id });
      } else {
        const result = await pool.query(
          `INSERT INTO tombamentos (codigo, descricao, localizacao, valor, status, departamento_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [codigo, descricao, localizacao, valor, status, id]
        );
        criados++;
        detalhes.push({ codigo, status: 'criado', id: result.rows[0].id });
      }
    } catch (error) {
      ignorados++;
      detalhes.push({ codigo: t.codigo, status: 'ignorado', motivo: error.message });
    }
  }
  res.json({ criados, atualizados, ignorados, detalhes });
});

// POST vincular tombamento a departamento
app.post('/departamentos/:id/tombamentos/:tombamentoId', async (req, res) => {
  const { id, tombamentoId } = req.params;

  try {
    // Verificar se departamento existe
    const deptCheck = await pool.query('SELECT id FROM departamentos WHERE id = $1', [id]);
    if (deptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    
    // Atualizar tombamento com o departamento_id
    const result = await pool.query(
      'UPDATE tombamentos SET departamento_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [id, tombamentoId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado' });
    }
    
    res.json({ 
      message: 'Tombamento vinculado ao departamento com sucesso', 
      tombamento: result.rows[0] 
    });
  } catch (error) {
    console.error('Erro ao vincular tombamento:', error);
    res.status(500).json({ error: 'Erro ao vincular tombamento', detail: error.message });
  }
});

// DELETE desvincular tombamento do departamento
app.delete('/departamentos/:id/tombamentos/:tombamentoId', async (req, res) => {
  const { id, tombamentoId } = req.params;

  try {
    // Verificar se tombamento pertence ao departamento
    const tombCheck = await pool.query(
      'SELECT id FROM tombamentos WHERE id = $1 AND departamento_id = $2',
      [tombamentoId, id]
    );
    
    if (tombCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado neste departamento' });
    }
    
    // Remover vínculo
    const result = await pool.query(
      'UPDATE tombamentos SET departamento_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [tombamentoId]
    );
    
    res.json({ 
      message: 'Tombamento desvinculado do departamento com sucesso', 
      tombamento: result.rows[0] 
    });
  } catch (error) {
    console.error('Erro ao desvincular tombamento:', error);
    res.status(500).json({ error: 'Erro ao desvincular tombamento', detail: error.message });
  }
});

// POST criar/importar tombamentos diretamente no departamento (batch)
// Cria tombamentos novos JÁ vinculados ao departamento
app.post('/departamentos/:id/tombamentos', async (req, res) => {
  const { id } = req.params;
  const { tombamentos } = req.body;

  console.log(`📦 Importando tombamentos para departamento ${id}...`);

  if (!tombamentos || !Array.isArray(tombamentos)) {
    return res.status(400).json({ 
      error: 'Array de tombamentos é obrigatório',
      exemplo: {
        tombamentos: [
          { codigo: "12345", descricao: "Monitor Dell", localizacao: "Sala 101" },
          { codigo: "12346", descricao: "Teclado HP" }
        ]
      }
    });
  }

  try {
    // Verificar se departamento existe
    const deptCheck = await pool.query('SELECT id, nome FROM departamentos WHERE id = $1', [id]);
    if (deptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    
    const departamento = deptCheck.rows[0];
    console.log(`📦 Departamento: ${departamento.nome}`);
    console.log(`📦 Processando ${tombamentos.length} tombamentos...`);
    
    const resultados = {
      criados: 0,
      atualizados: 0,
      erros: [],
      tombamentosCriados: [],
      tombamentosAtualizados: []
    };
    
    for (const tomb of tombamentos) {
      try {
        const { codigo, descricao, localizacao, oldcode, valor, status } = tomb;
        
        if (!codigo) {
          resultados.erros.push({ codigo: null, erro: 'Código é obrigatório' });
          continue;
        }
        
        // Normalizar codigo (remover espaços, converter para string)
        const codigoNormalizado = String(codigo).trim();
        
        // Tratar strings vazias - usar valor padrão para descrição se vazia
        const descricaoNorm = descricao && descricao.trim() !== '' ? descricao.trim() : 'Sem descrição';
        const localizacaoNorm = localizacao && localizacao.trim() !== '' ? localizacao.trim() : null;
        
        console.log(`   📝 Processando: ${codigoNormalizado} - ${descricaoNorm}`);
        
        // Verifica se já existe (em qualquer departamento)
        const existing = await pool.query(
          'SELECT id, departamento_id FROM tombamentos WHERE codigo = $1',
          [codigoNormalizado]
        );
        
        console.log(`      Existe no banco? ${existing.rows.length > 0 ? 'SIM (id: ' + existing.rows[0].id + ')' : 'NÃO'}`);
        
        if (existing.rows.length > 0) {
          // Atualiza existente e move para este departamento
          const result = await pool.query(
            `UPDATE tombamentos 
             SET descricao = COALESCE(NULLIF($2, ''), descricao),
                 localizacao = COALESCE(NULLIF($3, ''), localizacao),
                 oldcode = COALESCE($4, oldcode),
                 valor = COALESCE($5, valor),
                 status = COALESCE($6, status),
                 departamento_id = $7,
                 updated_at = NOW()
             WHERE codigo = $1
             RETURNING *`,
            [codigoNormalizado, descricaoNorm, localizacaoNorm, oldcode, valor, status !== undefined ? status : null, id]
          );
          resultados.atualizados++;
          resultados.tombamentosAtualizados.push(result.rows[0]);
          console.log(`      ✅ Atualizado!`);
        } else {
          // Cria novo já vinculado ao departamento
          const result = await pool.query(
            `INSERT INTO tombamentos (codigo, descricao, localizacao, oldcode, valor, status, departamento_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [codigoNormalizado, descricaoNorm, localizacaoNorm, oldcode || null, valor || null, status !== undefined ? status : 0, id]
          );
          resultados.criados++;
          resultados.tombamentosCriados.push(result.rows[0]);
          console.log(`      ✅ Criado! (id: ${result.rows[0].id})`);
        }
      } catch (error) {
        console.error(`❌ Erro ao processar ${tomb.codigo}:`, error.message);
        resultados.erros.push({ codigo: tomb.codigo, erro: error.message });
      }
    }
    
    console.log(`✅ Importação concluída: ${resultados.criados} criados, ${resultados.atualizados} atualizados, ${resultados.erros.length} erros`);
    
    res.json({ 
      message: `${resultados.criados} criados, ${resultados.atualizados} atualizados no departamento "${departamento.nome}"`,
      departamento: departamento,
      total: tombamentos.length,
      criados: resultados.criados,
      atualizados: resultados.atualizados,
      erros: resultados.erros.length,
      detalhesErros: resultados.erros
    });
  } catch (error) {
    console.error('Erro ao importar tombamentos:', error);
    res.status(500).json({ error: 'Erro ao importar tombamentos', detail: error.message });
  }
});

// ==================== TOMBAMENTOS ROUTES ====================

// GET all tombamentos (com filtro opcional sem_departamento=true)
app.get('/tombamentos', async (req, res) => {
  try {
    const { sem_departamento } = req.query;
    
    let query = 'SELECT * FROM tombamentos';
    let params = [];
    
    // Filtro para tombamentos sem departamento (avulsos)
    if (sem_departamento === 'true') {
      query += ' WHERE departamento_id IS NULL';
    }
    
    query += ' ORDER BY codigo';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar tombamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar tombamentos', detail: error.message });
  }
});

// GET tombamento by id
app.get('/tombamentos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM tombamentos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar tombamento:', error);
    res.status(500).json({ error: 'Erro ao buscar tombamento', detail: error.message });
  }
});

// GET tombamento by codigo (com dados do departamento)
app.get('/tombamentos/codigo/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await pool.query(`
      SELECT t.*, 
             d.id as departamento_id,
             d.codigo as departamento_codigo,
             d.nome as departamento_nome,
             d.descricao as departamento_descricao
      FROM tombamentos t
      LEFT JOIN departamentos d ON t.departamento_id = d.id
      WHERE t.codigo = $1
    `, [codigo]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado' });
    }
    
    // Formatar resposta com objeto departamento aninhado
    const row = result.rows[0];
    const tombamento = {
      id: row.id,
      codigo: row.codigo,
      descricao: row.descricao,
      localizacao: row.localizacao,
      oldcode: row.oldcode,
      valor: row.valor,
      status: row.status,
      foto: row.foto,
      departamento_id: row.departamento_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      departamento: row.departamento_id ? {
        id: row.departamento_id,
        codigo: row.departamento_codigo,
        nome: row.departamento_nome,
        descricao: row.departamento_descricao
      } : null
    };
    
    res.json(tombamento);
  } catch (error) {
    console.error('Erro ao buscar tombamento por código:', error);
    res.status(500).json({ error: 'Erro ao buscar tombamento', detail: error.message });
  }
});

// POST buscar departamentos de múltiplos tombamentos
app.post('/tombamentos/buscar-departamentos', async (req, res) => {
  const { codigos } = req.body;
  
  if (!codigos || !Array.isArray(codigos)) {
    return res.status(400).json({ 
      error: 'Array de codigos é obrigatório',
      exemplo: { codigos: ["12345", "12346", "12347"] }
    });
  }
  
  if (codigos.length === 0) {
    return res.json({ tombamentos: [] });
  }

  try {
    const result = await pool.query(`
      SELECT t.codigo as tombamento_codigo,
             t.id as tombamento_id,
             t.descricao as tombamento_descricao,
             d.id as departamento_id,
             d.codigo as departamento_codigo,
             d.nome as departamento_nome,
             d.descricao as departamento_descricao
      FROM tombamentos t
      LEFT JOIN departamentos d ON t.departamento_id = d.id
      WHERE t.codigo = ANY($1::text[])
    `, [codigos]);
    
    // Formatar resposta como um mapa codigo -> departamento
    const tombamentos = result.rows.map(row => ({
      codigo: row.tombamento_codigo,
      tombamento_id: row.tombamento_id,
      tombamento_descricao: row.tombamento_descricao,
      departamento: row.departamento_id ? {
        id: row.departamento_id,
        codigo: row.departamento_codigo,
        nome: row.departamento_nome,
        descricao: row.departamento_descricao
      } : null
    }));
    
    res.json({ 
      total: tombamentos.length,
      tombamentos 
    });
  } catch (error) {
    console.error('Erro ao buscar departamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar departamentos', detail: error.message });
  }
});

// POST create tombamento
app.post('/tombamentos', async (req, res) => {
  const { codigo, descricao, localizacao, oldcode, valor, status, foto } = req.body;
  
  if (!codigo || !descricao) {
    return res.status(400).json({ error: 'Campos "codigo" e "descricao" são obrigatórios' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO tombamentos (codigo, descricao, localizacao, oldcode, valor, status, foto) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [codigo, descricao, localizacao || null, oldcode || null, valor || null, status !== undefined ? status : 0, foto || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar tombamento:', error);
    if (error.code === '23505') { // unique violation
      return res.status(409).json({ error: 'Código de tombamento já existe', detail: error.message });
    }
    res.status(500).json({ error: 'Erro ao criar tombamento', detail: error.message });
  }
});

// POST create múltiplos tombamentos (batch)
// POST /tombamentos/batch - Criar/Atualizar múltiplos tombamentos de uma vez (UPSERT)
app.post('/tombamentos/batch', async (req, res) => {
  console.log('📦 Recebendo batch de tombamentos...');
  
  const { tombamentos } = req.body;
  
  if (!tombamentos || !Array.isArray(tombamentos)) {
    return res.status(400).json({ error: 'Array de tombamentos é obrigatório' });
  }
  
  console.log(`📦 Processando ${tombamentos.length} tombamentos...`);
  
  const resultados = {
    criados: 0,
    atualizados: 0,
    erros: [],
    tombamentosCriados: [],
    tombamentosAtualizados: []
  };
  
  for (const tombamento of tombamentos) {
    try {
      const { codigo, descricao, localizacao, oldcode, valor, status } = tombamento;
      
      if (!codigo) {
        resultados.erros.push({ codigo: null, erro: 'Código é obrigatório' });
        continue;
      }
      
      // Verifica se já existe
      const existing = await pool.query(
        'SELECT id FROM tombamentos WHERE codigo = $1',
        [codigo]
      );
      
      if (existing.rows.length > 0) {
        // Atualiza existente
        const result = await pool.query(
          `UPDATE tombamentos 
           SET descricao = COALESCE($2, descricao),
               localizacao = COALESCE($3, localizacao),
               oldcode = COALESCE($4, oldcode),
               valor = COALESCE($5, valor),
               status = COALESCE($6, status),
               updated_at = NOW()
           WHERE codigo = $1
           RETURNING *`,
          [codigo, descricao, localizacao, oldcode, valor, status !== undefined ? status : null]
        );
        resultados.atualizados++;
        resultados.tombamentosAtualizados.push(result.rows[0]);
      } else {
        // Cria novo
        const result = await pool.query(
          `INSERT INTO tombamentos (codigo, descricao, localizacao, oldcode, valor, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [codigo, descricao || null, localizacao || null, oldcode || null, valor || null, status !== undefined ? status : 0]
        );
        resultados.criados++;
        resultados.tombamentosCriados.push(result.rows[0]);
      }
      
      // Log de progresso a cada 50 itens
      const total = resultados.criados + resultados.atualizados + resultados.erros.length;
      if (total % 50 === 0) {
        console.log(`   ✅ ${total}/${tombamentos.length} processados...`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${tombamento.codigo}:`, error.message);
      resultados.erros.push({ codigo: tombamento.codigo, erro: error.message });
    }
  }
  
  console.log(`✅ Batch concluído: ${resultados.criados} criados, ${resultados.atualizados} atualizados, ${resultados.erros.length} erros`);
  
  res.json({
    message: `${resultados.criados} criados, ${resultados.atualizados} atualizados, ${resultados.erros.length} erros`,
    total: tombamentos.length,
    criados: resultados.criados,
    atualizados: resultados.atualizados,
    erros: resultados.erros.length,
    detalhesErros: resultados.erros
  });
});

// PUT update tombamento
app.put('/tombamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo, descricao, localizacao, oldcode, valor, status, foto } = req.body;

  try {
    const result = await pool.query(
      `UPDATE tombamentos SET 
        codigo = COALESCE($1, codigo),
        descricao = COALESCE($2, descricao),
        localizacao = COALESCE($3, localizacao),
        oldcode = COALESCE($4, oldcode),
        valor = COALESCE($5, valor),
        status = COALESCE($6, status),
        foto = COALESCE($7, foto),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *`,
      [codigo, descricao, localizacao, oldcode, valor, status, foto, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar tombamento:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Código de tombamento já existe', detail: error.message });
    }
    res.status(500).json({ error: 'Erro ao atualizar tombamento', detail: error.message });
  }
});

// DELETE ALL tombamentos (CUIDADO: Deleta todos!)
// ⚠️ IMPORTANTE: Esta rota DEVE vir ANTES de /tombamentos/:id
app.delete('/tombamentos/all', async (req, res) => {
  console.log('🗑️  Deletando TODOS os tombamentos...');

  try {
    // Buscar todas as fotos antes de deletar
    const fotos = await pool.query('SELECT foto FROM tombamentos WHERE foto IS NOT NULL');
    
    // Deletar todos os tombamentos
    const result = await pool.query('DELETE FROM tombamentos RETURNING *');
    
    console.log(`🗑️  ${result.rows.length} tombamentos deletados`);
    
    // Deletar arquivos de fotos
    let fotosDeleted = 0;
    for (const row of fotos.rows) {
      if (row.foto) {
        const filename = row.foto.replace('/uploads/', '');
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            fotosDeleted++;
          } catch (error) {
            console.error(`Erro ao deletar foto ${filename}:`, error.message);
          }
        }
      }
    }
    
    console.log(`🗑️  ${fotosDeleted} fotos deletadas`);
    
    res.json({ 
      message: 'Todos os tombamentos foram deletados com sucesso',
      totalDeletado: result.rows.length,
      fotosDeletadas: fotosDeleted
    });
  } catch (error) {
    console.error('❌ Erro ao deletar todos os tombamentos:', error);
    res.status(500).json({ 
      error: 'Erro ao deletar tombamentos', 
      detail: error.message 
    });
  }
});

// DELETE tombamento por ID (incluindo foto)
app.delete('/tombamentos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Primeiro buscar o tombamento para pegar a foto
    const tombamento = await pool.query('SELECT foto FROM tombamentos WHERE id = $1', [id]);
    
    if (tombamento.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado' });
    }
    
    // Excluir arquivo de foto se existir
    let fotoExcluida = false;
    if (tombamento.rows[0].foto) {
      const filename = tombamento.rows[0].foto.replace('/uploads/', '');
      const filePath = path.join(uploadsDir, filename);
      
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          fotoExcluida = true;
          console.log(`🗑️ Foto excluída: ${filename}`);
        } catch (err) {
          console.error(`Erro ao excluir foto ${filename}:`, err.message);
        }
      }
    }
    
    // Agora deletar o registro
    const result = await pool.query('DELETE FROM tombamentos WHERE id = $1 RETURNING *', [id]);
    
    res.json({ 
      message: 'Tombamento deletado com sucesso', 
      tombamento: result.rows[0],
      foto_excluida: fotoExcluida
    });
  } catch (error) {
    console.error('Erro ao deletar tombamento:', error);
    res.status(500).json({ error: 'Erro ao deletar tombamento', detail: error.message });
  }
});

// DELETE foto do tombamento (remove apenas a foto, não o tombamento)
app.delete('/tombamentos/:id/foto', async (req, res) => {
  const { id } = req.params;

  console.log('=== DELETAR FOTO ===');
  console.log('ID do tombamento:', id);

  try {
    // Buscar tombamento para pegar o nome da foto
    const result = await pool.query('SELECT foto FROM tombamentos WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado' });
    }

    const tombamento = result.rows[0];
    
    if (!tombamento.foto) {
      return res.status(400).json({ error: 'Este tombamento não possui foto' });
    }

    // Extrair nome do arquivo da URL (/uploads/foto.jpg -> foto.jpg)
    const filename = tombamento.foto.replace('/uploads/', '');
    const filePath = path.join(uploadsDir, filename);

    // Deletar arquivo físico
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('🗑️  Arquivo deletado:', filename);
      } catch (error) {
        console.error('Erro ao deletar arquivo:', error);
        // Continua mesmo se falhar ao deletar o arquivo físico
      }
    }

    // Atualizar banco (remove foto)
    const updateResult = await pool.query(
      'UPDATE tombamentos SET foto = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    console.log('✅ Foto removida com sucesso!');
    res.json({ 
      message: 'Foto deletada com sucesso', 
      tombamento: updateResult.rows[0] 
    });
  } catch (error) {
    console.error('❌ Erro ao deletar foto:', error);
    res.status(500).json({ error: 'Erro ao deletar foto', detail: error.message });
  }
});

// POST upload foto do tombamento
app.post('/tombamentos/:id/foto', (req, res) => {
  // Handler customizado do multer para capturar erros
  upload.single('foto')(req, res, async (err) => {
    const { id } = req.params;
    
    // Log detalhado para debug
    console.log('=== UPLOAD FOTO DEBUG ===');
    console.log('ID do tombamento:', id);
    console.log('Arquivo recebido:', req.file ? req.file.filename : 'nenhum');
    console.log('Body:', req.body);
    console.log('Erro do multer:', err ? err.message : 'nenhum');
    
    // Erros do multer
    if (err) {
      console.error('❌ Erro no multer:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo muito grande. Máximo: 5MB' });
        }
        return res.status(400).json({ error: 'Erro no upload', detail: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    
    // Validar se arquivo foi enviado
    if (!req.file) {
      console.error('❌ Nenhum arquivo enviado');
      return res.status(400).json({ 
        error: 'Nenhuma imagem foi enviada',
        hint: 'Envie o arquivo no campo "foto" como multipart/form-data'
      });
    }

    try {
      const fotoUrl = `/uploads/${req.file.filename}`;
      console.log('📝 Atualizando banco de dados...');
      console.log('   Foto URL:', fotoUrl);
      console.log('   Tombamento ID:', id);
      
      const result = await pool.query(
        'UPDATE tombamentos SET foto = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [fotoUrl, id]
      );
      
      if (result.rows.length === 0) {
        console.error('❌ Tombamento não encontrado:', id);
        // Deletar arquivo se tombamento não existir
        try {
          fs.unlinkSync(req.file.path);
          console.log('🗑️  Arquivo deletado (tombamento não existe)');
        } catch (e) {
          console.error('Erro ao deletar arquivo:', e.message);
        }
        return res.status(404).json({ error: 'Tombamento não encontrado' });
      }
      
      console.log('✅ Foto salva com sucesso!');
      res.json({ 
        message: 'Foto enviada com sucesso', 
        foto: fotoUrl,
        tombamento: result.rows[0]
      });
    } catch (error) {
      console.error('❌ Erro ao fazer upload da foto:', error);
      console.error('Stack:', error.stack);
      
      // Limpar arquivo em caso de erro
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('🗑️  Arquivo deletado (erro no banco)');
        } catch (e) {
          console.error('Erro ao deletar arquivo:', e.message);
        }
      }
      res.status(500).json({ 
        error: 'Erro ao fazer upload da foto', 
        detail: error.message,
        code: error.code 
      });
    }
  });
});

// Export pool for use in other modules if needed
module.exports = { app, pool };
