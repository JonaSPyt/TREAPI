-- Script SQL para criar a tabela tombamentos
-- Execute este script no seu PostgreSQL antes de usar a API

CREATE TABLE IF NOT EXISTS tombamentos (
  id SERIAL PRIMARY KEY,
  codigo INTEGER NOT NULL UNIQUE,
  descricao VARCHAR(500) NOT NULL,
  localizacao VARCHAR(255),
  oldcode INTEGER,
  valor DECIMAL(15, 2),
  status INTEGER DEFAULT 1,
  foto VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir dados de exemplo (opcional)
INSERT INTO tombamentos (codigo, descricao, localizacao, oldcode, valor, status) VALUES
  (1001, 'Computador Dell Optiplex 7090', 'Sala 201 - TI', 500, 3500.00, 1),
  (1002, 'Impressora HP LaserJet Pro', 'Sala 105 - Administrativo', 450, 1200.50, 1),
  (1003, 'Mesa de Escritório', 'Sala 301', 320, 800.00, 1)
ON CONFLICT (codigo) DO NOTHING;

-- Índices para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_tombamentos_codigo ON tombamentos(codigo);
CREATE INDEX IF NOT EXISTS idx_tombamentos_status ON tombamentos(status);
CREATE INDEX IF NOT EXISTS idx_tombamentos_localizacao ON tombamentos(localizacao);

-- Comentários nas colunas
COMMENT ON COLUMN tombamentos.codigo IS 'Código do tombamento (único)';
COMMENT ON COLUMN tombamentos.descricao IS 'Descrição do bem tombado';
COMMENT ON COLUMN tombamentos.localizacao IS 'Localização física do bem';
COMMENT ON COLUMN tombamentos.oldcode IS 'Código antigo (se houver)';
COMMENT ON COLUMN tombamentos.valor IS 'Valor do bem em reais';
COMMENT ON COLUMN tombamentos.status IS 'Status: 1=Ativo, 2=Inativo, 3=Manutenção, etc';
COMMENT ON COLUMN tombamentos.foto IS 'Caminho/URL da foto do bem';
