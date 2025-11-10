#!/usr/bin/env node

// Script para executar schema.sql no PostgreSQL usando a conexão do .env
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function runSchema() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  
  console.log('Conectando ao PostgreSQL...');
  console.log(`  Host: ${process.env.DB_HOST}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log();

  try {
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    
    console.log('Executando schema.sql...');
    const result = await pool.query(sql);
    
    console.log('✅ Schema executado com sucesso!');
    console.log();
    
    // Verificar se a tabela foi criada
    const check = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tombamentos' 
      ORDER BY ordinal_position
    `);
    
    if (check.rows.length > 0) {
      console.log('📋 Estrutura da tabela tombamentos:');
      check.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      console.log();
    }

    // Contar registros
    const count = await pool.query('SELECT COUNT(*) as total FROM tombamentos');
    console.log(`📊 Total de tombamentos: ${count.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Erro ao executar schema:', error.message);
    if (error.detail) console.error('   Detalhe:', error.detail);
    if (error.hint) console.error('   Dica:', error.hint);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSchema();
