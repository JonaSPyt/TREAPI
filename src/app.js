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

  try {
    const result = await pool.query(
      'INSERT INTO tombamentos (codigo, descricao, localizacao, oldcode, valor, status, foto) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [codigo, descricao, localizacao || null, oldcode || null, valor || null, status || 1, foto || null]
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
