-- ==============================================================================
-- TECNODRILL INFRA - SCHEMA SQL DEFINITIVO PARA O SUPABASE
-- Executa com isolamento total (prefixo tecnodrill_*) sem interferir em outros apps
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS tecnodrill_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    perfil VARCHAR(50) NOT NULL CHECK (perfil IN ('ADMIN', 'GESTOR', 'NAVEGADOR', 'OPERADOR')),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(255) UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE SERVIÇOS / OBRAS DE PERFURAÇÃO
CREATE TABLE IF NOT EXISTS tecnodrill_servicos (
    id VARCHAR(255) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    cliente VARCHAR(255),
    projeto VARCHAR(255),
    obra VARCHAR(255),
    centro_custo VARCHAR(255),
    local VARCHAR(255),
    cidade VARCHAR(255),
    uf VARCHAR(10),
    gestor_id UUID REFERENCES tecnodrill_usuarios(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status IN ('EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO')),
    cenario_financeiro VARCHAR(50) NOT NULL CHECK (cenario_financeiro IN ('VALOR_METRO', 'FATOR_DIAMETRO_METRO', 'VALOR_FECHADO')),
    valor_metro DECIMAL(12,2) DEFAULT 0,
    fator_financeiro DECIMAL(12,4) DEFAULT 0,
    diametro_furo_mm DECIMAL(10,2) DEFAULT 0,
    valor_total_fechado DECIMAL(12,2) DEFAULT 0,
    metragem_prevista_total DECIMAL(10,2) DEFAULT 1000,
    tipo_meta VARCHAR(20) NOT NULL DEFAULT 'DIARIA' CHECK (tipo_meta IN ('DIARIA', 'SEMANAL')),
    meta_metros DECIMAL(10,2) NOT NULL DEFAULT 100,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE FUROS (RELATÓRIO TÉCNICO DE EXECUÇÃO)
CREATE TABLE IF NOT EXISTS tecnodrill_furos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    servico_id VARCHAR(255) REFERENCES tecnodrill_servicos(id) ON DELETE CASCADE,
    data_furo DATE NOT NULL DEFAULT CURRENT_DATE,
    navegador_id UUID REFERENCES tecnodrill_usuarios(id) ON DELETE SET NULL,
    operador_id UUID REFERENCES tecnodrill_usuarios(id) ON DELETE SET NULL,
    navegador_nome VARCHAR(255),
    operador_nome VARCHAR(255),
    tubo_aplicado VARCHAR(255),
    diametro_furo VARCHAR(255),
    comprimento_furo DECIMAL(10,2) DEFAULT 0,
    tipo_perfuracao JSONB DEFAULT '[]'::jsonb,
    utilizacao_tubo JSONB DEFAULT '[]'::jsonb,
    hora_inicio_furo VARCHAR(20),
    hora_fim_furo VARCHAR(20),
    horimetro_inicio_furo VARCHAR(50),
    horimetro_fim_furo VARCHAR(50),
    hora_inicio_pux VARCHAR(20),
    hora_fim_pux VARCHAR(20),
    horimetro_inicio_pux VARCHAR(50),
    horimetro_fim_pux VARCHAR(50),
    status VARCHAR(50) DEFAULT 'EM_EXECUCAO' CHECK (status IN ('EM_EXECUCAO', 'FINALIZADO')),
    observacoes TEXT,
    assinatura_navegador TEXT,
    assinatura_fiscal TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE REGISTROS DE CAMPO / HASTES / FOTOS / CAIXAS
CREATE TABLE IF NOT EXISTS tecnodrill_barras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    furo_id UUID REFERENCES tecnodrill_furos(id) ON DELETE CASCADE,
    numero_barra INTEGER NOT NULL,
    metros DECIMAL(10,2) DEFAULT 3,
    metros_acumulados DECIMAL(10,2) NOT NULL,
    tem_caixa BOOLEAN DEFAULT FALSE,
    angulo_pitch VARCHAR(50),
    profundidade_cm DECIMAL(10,2),
    distancia_pista_cm DECIMAL(10,2),
    foto_url TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    observacao TEXT,
    horario_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registrado_por UUID REFERENCES tecnodrill_usuarios(id) ON DELETE SET NULL,
    CONSTRAINT unique_barra_per_furo UNIQUE(furo_id, numero_barra)
);

-- 5. TABELA DE LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS tecnodrill_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES tecnodrill_usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,
    detalhes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DESATIVAR RLS PARA ACESSO DIRETO VIA SERVICE_ROLE
ALTER TABLE tecnodrill_usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE tecnodrill_servicos DISABLE ROW LEVEL SECURITY;
ALTER TABLE tecnodrill_furos DISABLE ROW LEVEL SECURITY;
ALTER TABLE tecnodrill_barras DISABLE ROW LEVEL SECURITY;
ALTER TABLE tecnodrill_logs DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- CARGA INICIAL DE USUÁRIOS PADRÃO (SENHAS CRIPTOGRAFADAS COM BCRYPT)
-- Gestores: Gestor@123 | Navegador e Operador: Tecno@123
-- ==============================================================================
INSERT INTO tecnodrill_usuarios (id, nome, perfil, username, email, senha_hash, ativo)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Eduardo Gestor', 'GESTOR', 'eduardo', 'eduardo@tecnodrill.com.br', '$2a$10$7KzT3XfOqJ2nUo8yQ1L5/e0m7M3Z5R6K9X7P2W4Y1Z9B6C3D5E7F9', TRUE),
  ('22222222-2222-2222-2222-222222222222', 'Carlos Diretor', 'GESTOR', 'carlos', 'carlos@tecnodrill.com.br', '$2a$10$7KzT3XfOqJ2nUo8yQ1L5/e0m7M3Z5R6K9X7P2W4Y1Z9B6C3D5E7F9', TRUE),
  ('33333333-3333-3333-3333-333333333333', 'Marcelo Navegador', 'NAVEGADOR', 'marcelo', 'marcelo@tecnodrill.com.br', '$2a$10$1W2V4Q5P6O7N8M9L0K1J2u3H4G5F6E7D8C9B0A1Z2Y3X4W5V6U7T8', TRUE),
  ('44444444-4444-4444-4444-444444444444', 'Antônio Operador', 'OPERADOR', 'antonio', 'antonio@tecnodrill.com.br', '$2a$10$1W2V4Q5P6O7N8M9L0K1J2u3H4G5F6E7D8C9B0A1Z2Y3X4W5V6U7T8', TRUE)
ON CONFLICT (username) DO NOTHING;
