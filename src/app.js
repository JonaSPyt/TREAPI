// IMPORTANTE: carregar dotenv ANTES de tudo
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Helper: parse numbers coming from Brazilian/locale formatted strings
// Accepts formats like "1.296,06", "696,02", "6649.00" and returns a Number or null
function parseBrazilianNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;

  let s = String(value).trim();
  // remove currency symbol and spaces
  s = s.replace(/R\$\s?/g, '').replace(/\s+/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    // both present -> last one is decimal separator
    if (lastComma > lastDot) {
      // comma is decimal, dots are thousand separators
      s = s.replace(/\./g, '');
      s = s.replace(/,/g, '.');
    } else {
      // dot is decimal, commas are thousand separators
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // only comma -> decimal separator
    s = s.replace(/,/g, '.');
  } else {
    // only dots or none. If multiple dots, assume all but last are thousand separators
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1) {
      const parts = s.split('.');
      const last = parts.pop();
      s = parts.join('') + '.' + last;
    }
  }

  // remove anything except digits, dot and minus
  s = s.replace(/[^0-9.\-]/g, '');

  if (s === '' || s === '.' || s === '-' || s === '-.') return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return n;
}

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
  ssl: process.env.DB_HOST.includes('render.com') 
    ? { rejectUnauthorized: false } 
    : false
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

// ==================== TOMBAMENTOS ROUTES ====================

// GET all tombamentos
app.get('/tombamentos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tombamentos ORDER BY codigo');
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

// GET tombamento by codigo
app.get('/tombamentos/codigo/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await pool.query('SELECT * FROM tombamentos WHERE codigo = $1', [codigo]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar tombamento por código:', error);
    res.status(500).json({ error: 'Erro ao buscar tombamento', detail: error.message });
  }
});

// POST create tombamento
app.post('/tombamentos', async (req, res) => {
  const { codigo, descricao, localizacao, oldcode, valor, status, foto } = req.body;
  
  if (!codigo || !descricao) {
    return res.status(400).json({ error: 'Campos "codigo" e "descricao" são obrigatórios' });
  }

  // Normalizar campo valor (aceitar formatos brasileiros como "1.296,06")
  let parsedValor = null;
  if (Object.prototype.hasOwnProperty.call(req.body, 'valor')) {
    parsedValor = parseBrazilianNumber(valor);
    if (parsedValor === null && valor !== null && valor !== '') {
      return res.status(400).json({ error: 'Formato inválido para campo "valor"', received: valor });
    }
  }

  try {
    const result = await pool.query(
      'INSERT INTO tombamentos (codigo, descricao, localizacao, oldcode, valor, status, foto) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [codigo, descricao, localizacao || null, oldcode || null, parsedValor === null ? null : parsedValor, status || 1, foto || null]
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
app.post('/tombamentos/batch', async (req, res) => {
  const { tombamentos } = req.body;
  
  if (!Array.isArray(tombamentos)) {
    return res.status(400).json({ 
      error: 'Formato inválido',
      hint: 'Envie um array de tombamentos: { "tombamentos": [...] }'
    });
  }

  if (tombamentos.length === 0) {
    return res.status(400).json({ error: 'Array de tombamentos está vazio' });
  }

  const successfulInserts = [];
  const errors = [];

  console.log(`📦 Inserindo ${tombamentos.length} tombamentos em lote...`);

  for (let i = 0; i < tombamentos.length; i++) {
    const tomb = tombamentos[i];
    
    // Validar campos obrigatórios
    if (!tomb.codigo || !tomb.descricao) {
      errors.push({
        index: i,
        codigo: tomb.codigo || 'N/A',
        error: 'Campos "codigo" e "descricao" são obrigatórios'
      });
      continue;
    }

    // Normalizar valor se fornecido
    let parsedValor = null;
    if (Object.prototype.hasOwnProperty.call(tomb, 'valor')) {
      parsedValor = parseBrazilianNumber(tomb.valor);
      if (parsedValor === null && tomb.valor !== null && tomb.valor !== '') {
        errors.push({
          index: i,
          codigo: tomb.codigo,
          error: `Formato inválido para campo valor: ${tomb.valor}`
        });
        continue;
      }
    }

    try {
      const result = await pool.query(
        'INSERT INTO tombamentos (codigo, descricao, localizacao, oldcode, valor, status, foto) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [
          tomb.codigo,
          tomb.descricao,
          tomb.localizacao || null,
          tomb.oldcode || null,
          parsedValor === null ? null : parsedValor,
          tomb.status || 1,
          tomb.foto || null
        ]
      );
      successfulInserts.push(result.rows[0]);
      console.log(`   ✅ ${i + 1}/${tombamentos.length} - Código ${tomb.codigo}`);
    } catch (error) {
      console.error(`   ❌ ${i + 1}/${tombamentos.length} - Código ${tomb.codigo}:`, error.message);
      errors.push({
        index: i,
        codigo: tomb.codigo,
        error: error.code === '23505' ? 'Código já existe' : error.message
      });
    }
  }

  console.log(`✅ Inserção em lote concluída: ${successfulInserts.length} sucessos, ${errors.length} erros`);

  res.status(errors.length === tombamentos.length ? 400 : 201).json({
    message: `${successfulInserts.length} tombamentos criados, ${errors.length} erros`,
    total: tombamentos.length,
    sucessos: successfulInserts.length,
    erros: errors.length,
    tombamentosCriados: successfulInserts,
    errosDetalhes: errors
  });
});

// PUT update tombamento
app.put('/tombamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo, descricao, localizacao, oldcode, valor, status, foto } = req.body;

  try {
    // Normalizar valor se presente
    let parsedValor = null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'valor')) {
      parsedValor = parseBrazilianNumber(valor);
      if (parsedValor === null && valor !== null && valor !== '') {
        return res.status(400).json({ error: 'Formato inválido para campo "valor"', received: valor });
      }
    }

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
      [codigo, descricao, localizacao, oldcode, parsedValor === null ? null : parsedValor, status, foto, id]
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
app.delete('/tombamentos/all', async (req, res) => {
  try {
    // Buscar todas as fotos antes de deletar
    const fotos = await pool.query('SELECT foto FROM tombamentos WHERE foto IS NOT NULL');
    
    // Deletar todos os tombamentos
    const result = await pool.query('DELETE FROM tombamentos RETURNING *');
    
    console.log(`🗑️  Deletando ${result.rows.length} tombamentos...`);
    
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
            console.log(`   🗑️  Foto deletada: ${filename}`);
          } catch (error) {
            console.error(`   ❌ Erro ao deletar foto ${filename}:`, error.message);
          }
        }
      }
    }
    
    console.log(`✅ ${result.rows.length} tombamentos deletados`);
    console.log(`✅ ${fotosDeleted} fotos deletadas`);
    
    res.json({ 
      message: 'Todos os tombamentos foram deletados com sucesso',
      totalDeletado: result.rows.length,
      fotosDeletadas: fotosDeleted,
      tombamentos: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao deletar todos os tombamentos:', error);
    res.status(500).json({ 
      error: 'Erro ao deletar tombamentos', 
      detail: error.message 
    });
  }
});

// DELETE tombamento
app.delete('/tombamentos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM tombamentos WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tombamento não encontrado' });
    }
    
    res.json({ message: 'Tombamento deletado com sucesso', tombamento: result.rows[0] });
  } catch (error) {
    console.error('Erro ao deletar tombamento:', error);
    res.status(500).json({ error: 'Erro ao deletar tombamento', detail: error.message });
  }
});

// PUT atualizar/substituir foto do tombamento
app.put('/tombamentos/:id/foto', (req, res) => {
  upload.single('foto')(req, res, async (err) => {
    const { id } = req.params;
    
    console.log('=== ATUALIZAR FOTO ===');
    console.log('ID do tombamento:', id);
    console.log('Novo arquivo:', req.file ? req.file.filename : 'nenhum');
    
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
    
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Nenhuma imagem foi enviada',
        hint: 'Envie o arquivo no campo "foto" como multipart/form-data'
      });
    }

    try {
      // Buscar foto antiga
      const oldResult = await pool.query('SELECT foto FROM tombamentos WHERE id = $1', [id]);
      
      if (oldResult.rows.length === 0) {
        // Deletar arquivo novo se tombamento não existir
        try {
          fs.unlinkSync(req.file.path);
          console.log('🗑️  Arquivo deletado (tombamento não existe)');
        } catch (e) {
          console.error('Erro ao deletar arquivo:', e.message);
        }
        return res.status(404).json({ error: 'Tombamento não encontrado' });
      }

      const oldFoto = oldResult.rows[0].foto;

      // Atualizar com nova foto
      const novaFotoUrl = `/uploads/${req.file.filename}`;
      const result = await pool.query(
        'UPDATE tombamentos SET foto = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [novaFotoUrl, id]
      );

      // Deletar foto antiga (se existir)
      if (oldFoto) {
        const oldFilename = oldFoto.replace('/uploads/', '');
        const oldFilePath = path.join(uploadsDir, oldFilename);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
            console.log('🗑️  Foto antiga deletada:', oldFilename);
          } catch (error) {
            console.error('Erro ao deletar foto antiga:', error);
            // Não retorna erro, continua normalmente
          }
        }
      }
      
      console.log('✅ Foto atualizada com sucesso!');
      res.json({ 
        message: 'Foto atualizada com sucesso', 
        foto: novaFotoUrl,
        fotoAnterior: oldFoto,
        tombamento: result.rows[0]
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar foto:', error);
      
      // Limpar arquivo novo em caso de erro
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('🗑️  Arquivo deletado (erro no banco)');
        } catch (e) {
          console.error('Erro ao deletar arquivo:', e.message);
        }
      }
      res.status(500).json({ 
        error: 'Erro ao atualizar foto', 
        detail: error.message 
      });
    }
  });
});

// DELETE foto do tombamento
app.delete('/tombamentos/:id/foto', async (req, res) => {
  const { id } = req.params;

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

    res.json({ 
      message: 'Foto deletada com sucesso', 
      tombamento: updateResult.rows[0] 
    });
  } catch (error) {
    console.error('Erro ao deletar foto:', error);
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
