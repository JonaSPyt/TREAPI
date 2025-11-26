#!/bin/bash
# Script para reinstalar o serviço corrigido

echo "🔄 Parando o serviço..."
sudo systemctl stop api-tombamentos

echo "📋 Copiando arquivo corrigido..."
sudo cp "/home/tre/Área de trabalho/Backend/api-tombamentos.service" /etc/systemd/system/

echo "🔄 Recarregando systemd..."
sudo systemctl daemon-reload

echo "🚀 Iniciando o serviço..."
sudo systemctl start api-tombamentos

echo ""
echo "✅ Verificando status..."
sudo systemctl status api-tombamentos --no-pager

echo ""
echo "📊 Últimas 20 linhas de log:"
sudo journalctl -u api-tombamentos -n 20 --no-pager
