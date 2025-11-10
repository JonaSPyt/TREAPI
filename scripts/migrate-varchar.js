#!/usr/bin/env node

// Script para converter codigo e oldcode de INTEGER para VARCHAR
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function migrate() {
  console.log('🔄 Iniciando migração: INTEGER → VARCHAR...');
  console.log();

  try {
    // 1. Alterar tipo do campo codigo
    console.log('📝 Alterando campo "codigo" de INTEGER para VARCHAR(50)...');
    await pool.query(`
      ALTER TABLE tombamentos 
        ALTER COLUMN codigo TYPE VARCHAR(50) USING codigo::TEXT
    `);
    console.log('✅ Campo "codigo" alterado com sucesso!');

    // 2. Alterar tipo do campo oldcode
    console.log('📝 Alterando campo "oldcode" de INTEGER para VARCHAR(50)...');
    await pool.query(`
      ALTER TABLE tombamentos 
        ALTER COLUMN oldcode TYPE VARCHAR(50) USING oldcode::TEXT
    `);
    console.log('✅ Campo "oldcode" alterado com sucesso!');

    // 3. Verificar resultado
    console.log();
    console.log('📋 Verificando estrutura atualizada:');
    const result = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'tombamentos' 
        AND column_name IN ('codigo', 'oldcode')
      ORDER BY ordinal_position
    `);
    
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}(${row.character_maximum_length})`);
    });

    console.log();
    console.log('🎉 Migração concluída com sucesso!');
    console.log('   Agora você pode usar códigos alfanuméricos como "7HQCQC00646D"');

  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    if (error.code === '42P01') {
      console.error('   A tabela "tombamentos" não existe. Execute schema.sql primeiro.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
