#!/bin/bash

# Script para copiar dados do banco corporativo para o Render PostgreSQL

# Credenciais do banco ORIGEM (corporativo)
ORIGIN_HOST="cevmbd03.tre-ce.gov.br"
ORIGIN_PORT="5432"
ORIGIN_USER="inventario_patrimonial"
ORIGIN_PASSWORD="704737e2a0"
ORIGIN_DB="desenpg"

# Credenciais do banco DESTINO (Render) - PREENCHA COM AS SUAS
DEST_HOST="seu-banco-render.oregon-postgres.render.com"
DEST_PORT="5432"
DEST_USER="seu_usuario_render"
DEST_PASSWORD="sua_senha_render"
DEST_DB="seu_db_render"

echo "📦 Exportando dados do banco corporativo..."

# Exportar schema e dados
PGPASSWORD=$ORIGIN_PASSWORD pg_dump \
  -h $ORIGIN_HOST \
  -p $ORIGIN_PORT \
  -U $ORIGIN_USER \
  -d $ORIGIN_DB \
  --no-owner \
  --no-privileges \
  -t tombamentos \
  -f backup_tombamentos.sql

echo "✅ Backup criado: backup_tombamentos.sql"
echo ""
echo "📥 Importando para o banco do Render..."

# Importar no Render
PGPASSWORD=$DEST_PASSWORD psql \
  -h $DEST_HOST \
  -p $DEST_PORT \
  -U $DEST_USER \
  -d $DEST_DB \
  -f backup_tombamentos.sql

echo "✅ Importação concluída!"
echo ""
echo "🔄 Para sincronizar novamente, execute este script de dentro da rede corporativa"
