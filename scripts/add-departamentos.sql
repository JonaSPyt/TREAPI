-- Script SQL para adicionar suporte a Departamentos
-- Execute este script no PostgreSQL para adicionar a funcionalidade de departamentos

-- 1. Criar tabela de departamentos
CREATE TABLE IF NOT EXISTS departamentos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,        -- Código único do departamento (ex: "SECAT", "TI-01", "ADM")
  nome VARCHAR(255) NOT NULL,                 -- Nome do departamento
  descricao TEXT,                             -- Descrição opcional
  responsavel VARCHAR(255),                   -- Nome do responsável
  localizacao VARCHAR(255),                   -- Localização física
  ativo BOOLEAN DEFAULT true,                 -- Se o departamento está ativo
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Adicionar coluna departamento_id na tabela tombamentos
ALTER TABLE tombamentos 
ADD COLUMN IF NOT EXISTS departamento_id INTEGER REFERENCES departamentos(id) ON DELETE SET NULL;

-- 3. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_departamentos_codigo ON departamentos(codigo);
CREATE INDEX IF NOT EXISTS idx_departamentos_ativo ON departamentos(ativo);
CREATE INDEX IF NOT EXISTS idx_tombamentos_departamento ON tombamentos(departamento_id);

-- 4. Comentários nas colunas
COMMENT ON TABLE departamentos IS 'Departamentos/Setores da organização (como salas do Google Classroom)';
COMMENT ON COLUMN departamentos.codigo IS 'Código único do departamento (escolhido pelo usuário)';
COMMENT ON COLUMN departamentos.nome IS 'Nome completo do departamento';
COMMENT ON COLUMN departamentos.descricao IS 'Descrição detalhada do departamento';
COMMENT ON COLUMN departamentos.responsavel IS 'Nome do responsável pelo departamento';
COMMENT ON COLUMN departamentos.localizacao IS 'Localização física do departamento';
COMMENT ON COLUMN departamentos.ativo IS 'Se o departamento está ativo (true) ou arquivado (false)';
COMMENT ON COLUMN tombamentos.departamento_id IS 'ID do departamento ao qual o tombamento pertence';

-- 5. Inserir alguns departamentos de exemplo (opcional)
INSERT INTO departamentos (codigo, nome, descricao, responsavel, localizacao) VALUES
  ('SECAT', 'Seção de Atendimento', 'Seção de Atendimento e Apoio ao Usuário', 'João Silva', 'Térreo - Sala 101'),
  ('SESAT', 'Seção de Suporte', 'Seção de Suporte e Atendimento ao Usuário', 'Maria Santos', '1º Andar - Sala 201'),
  ('TI', 'Tecnologia da Informação', 'Departamento de TI', 'Pedro Costa', '2º Andar - Sala 301')
ON CONFLICT (codigo) DO NOTHING;

-- Verificar criação
SELECT 'Tabela departamentos criada com sucesso!' AS status;
SELECT 'Coluna departamento_id adicionada em tombamentos!' AS status;
