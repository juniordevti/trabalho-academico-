-- FarmaEduk schema ajustado para o backend atual
-- usuario com nome_usuario, conta e movimentacoes ligadas a usuario



CREATE TABLE IF NOT EXISTS usuario (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    nome_usuario VARCHAR(255) NOT NULL UNIQUE,
    senha TEXT NOT NULL DEFAULT '',
    perfil VARCHAR(30) NOT NULL DEFAULT 'aluno',
    tipo_usuario VARCHAR(50) NOT NULL DEFAULT 'ALUNO',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_nome_usuario_lower ON usuario (LOWER(nome_usuario));
CREATE INDEX IF NOT EXISTS idx_usuario_perfil ON usuario (perfil);

CREATE TABLE IF NOT EXISTS conta (
    id_conta SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    saldo NUMERIC(12, 2) NOT NULL DEFAULT 0,
    saldo_farmacoins INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conta_id_usuario ON conta (id_usuario);

CREATE TABLE IF NOT EXISTS medicamento (
    id_medicamento SERIAL PRIMARY KEY,
    nome_principio_ativo VARCHAR(255) NOT NULL,
    data_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
    data_validade DATE NOT NULL DEFAULT CURRENT_DATE,
    quantidade INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'VALIDADO',
    descricao TEXT,
    id_aluno INTEGER REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    id_professor INTEGER REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    farmcoins_creditados INTEGER NOT NULL DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medicamento_aluno ON medicamento (id_aluno);
CREATE INDEX IF NOT EXISTS idx_medicamento_professor ON medicamento (id_professor);
CREATE INDEX IF NOT EXISTS idx_medicamento_status ON medicamento (status);

CREATE TABLE IF NOT EXISTS movimentacao_farmacoins (
    id_movimentacao SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_medicamento INTEGER REFERENCES medicamento(id_medicamento) ON DELETE SET NULL,
    tipo_movimentacao VARCHAR(50) NOT NULL,
    quantidade_farmacoins INTEGER NOT NULL,
    descricao TEXT,
    data_movimentacao DATE DEFAULT CURRENT_DATE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movimentacao_usuario ON movimentacao_farmacoins (id_usuario);
CREATE INDEX IF NOT EXISTS idx_movimentacao_medicamento ON movimentacao_farmacoins (id_medicamento);

INSERT INTO usuario (nome, nome_usuario, senha, tipo_usuario, perfil, ativo)
VALUES
    ('admin', 'admin', 'admin123', 'ADMIN', 'admin', TRUE),
    ('professor', 'professor', 'professor123', 'PROFESSOR', 'admin', TRUE)
ON CONFLICT (nome_usuario) DO NOTHING;

INSERT INTO conta (id_usuario, saldo, saldo_farmacoins)
SELECT id_usuario, 0, 0
FROM usuario
WHERE tipo_usuario = 'ALUNO'
ON CONFLICT (id_usuario) DO NOTHING;
