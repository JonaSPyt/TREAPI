// Script para copiar dados do banco corporativo para o banco Render
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

// Banco ORIGEM (localhost com dados de teste)
const poolOrigem = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'inventario_patrimonial',
  password: '704737e2a0',
  database: 'desenpg',
});

// Banco DESTINO (Corporativo - usando variáveis do .env)
const poolDestino = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_HOST.includes('render.com') 
    ? { rejectUnauthorized: false } 
    : false
});

async function copiarDados() {
  console.log('🔄 Iniciando cópia de dados...\n');

  try {
    // 1. Exportar dados do banco corporativo
    console.log('📤 Exportando dados do banco corporativo...');
    console.log('🔍 Testando conexão...');
    const testCount = await poolOrigem.query('SELECT COUNT(*) FROM tombamentos');
    console.log(`   Total na contagem: ${testCount.rows[0].count}`);
    
    const resultado = await poolOrigem.query('SELECT * FROM tombamentos ORDER BY id');
    const tombamentos = resultado.rows;
    console.log(`✅ ${tombamentos.length} tombamentos encontrados`);
    if (tombamentos.length > 0) {
      console.log(`   Primeiro: ${JSON.stringify(tombamentos[0])}`);
    }
    console.log();

    // 2. Criar tabela no banco Render (se não existir)
    console.log('📝 Criando estrutura da tabela no Render...');
    await poolDestino.query(`
      CREATE TABLE IF NOT EXISTS tombamentos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        descricao VARCHAR(500) NOT NULL,
        localizacao VARCHAR(255),
        oldcode VARCHAR(50),
        valor DECIMAL(15, 2),
        status INTEGER DEFAULT 1,
        foto VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela criada/verificada\n');

    // 3. Limpar dados antigos (opcional)
    console.log('🗑️  Limpando dados antigos...');
    await poolDestino.query('DELETE FROM tombamentos');
    console.log('✅ Dados antigos removidos\n');

    // 4. Inserir dados no banco Render
    console.log('📥 Inserindo dados no Render...');
    let inseridos = 0;
    
    for (const tomb of tombamentos) {
      try {
        await poolDestino.query(
          `INSERT INTO tombamentos (codigo, descricao, localizacao, oldcode, valor, status, foto, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tomb.codigo,
            tomb.descricao,
            tomb.localizacao,
            tomb.oldcode,
            tomb.valor,
            tomb.status,
            tomb.foto,
            tomb.created_at,
            tomb.updated_at
          ]
        );
        inseridos++;
        process.stdout.write(`\r   Inserindo: ${inseridos}/${tombamentos.length}`);
      } catch (error) {
        console.error(`\n❌ Erro ao inserir tombamento ${tomb.codigo}:`, error.message);
      }
    }

    console.log('\n\n✅ Cópia concluída com sucesso!');
    console.log(`   Total copiado: ${inseridos} tombamentos`);

    // 5. Verificar resultado
    const verificacao = await poolDestino.query('SELECT COUNT(*) as total FROM tombamentos');
    console.log(`\n📊 Tombamentos no banco Render: ${verificacao.rows[0].total}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await poolOrigem.end();
    await poolDestino.end();
  }
}

copiarDados();
