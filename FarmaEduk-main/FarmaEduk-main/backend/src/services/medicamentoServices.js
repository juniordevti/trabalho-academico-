import pool from '../database.js';

const FARMACOINS_POR_CAIXA = 25;

function formatarDataBanco(data) {
    if (!data) return '';
    return data instanceof Date ? data.toISOString().slice(0, 10) : String(data).slice(0, 10);
}

function mapearMedicamento(row) {
    if (!row) return row;

    const farmcoins = Number(row.farmcoins_creditados || row.quantidade_farmacoins || 0);

    return {
        id: row.id_medicamento,
        id_medicamento: row.id_medicamento,
        nome: row.nome_principio_ativo,
        principio_ativo: row.nome_principio_ativo,
        nome_principio_ativo: row.nome_principio_ativo,
        data_entrega: row.data_entrega,
        validade: row.data_validade,
        data_validade: row.data_validade,
        quantidade: Number(row.quantidade || 1),
        status: row.status,
        ativo: row.status !== 'INATIVO',
        id_aluno: row.id_aluno,
        id_professor: row.id_professor,
        aluno_nome: row.aluno_nome,
        nome_doador: row.aluno_nome,
        professor_nome: row.professor_nome,
        saldo_aluno: row.saldo_aluno === null || row.saldo_aluno === undefined ? null : Number(row.saldo_aluno),
        farmcoins_creditados: farmcoins,
        descricao: `Aluno: ${row.aluno_nome || ''} | Caixas: ${Number(row.quantidade || 1)} | Entrega: ${formatarDataBanco(row.data_entrega)} | Vencimento: ${formatarDataBanco(row.data_validade)}`,
    };
}

function mapearRetirada(row) {
    if (!row) return row;

    return {
        id: row.id_movimentacao,
        id_movimentacao: row.id_movimentacao,
        id_aluno: row.id_usuario,
        aluno: row.aluno_nome,
        valor: Number(row.quantidade_farmacoins || 0),
        motivo: row.descricao || '',
        data: formatarDataBanco(row.data_movimentacao),
        saldo_aluno: row.saldo_aluno === null || row.saldo_aluno === undefined ? null : Number(row.saldo_aluno),
    };
}

async function buscarAlunoCadastrado(client, { idAluno, nomeAluno }) {
    const id = Number(idAluno);
    const nome = String(nomeAluno || '').trim();

    if (Number.isInteger(id) && id > 0) {
        const existentePorId = await client.query(
            `SELECT id_usuario, nome
             FROM usuario
             WHERE id_usuario = $1
               AND tipo_usuario = 'ALUNO'
               AND ativo = TRUE
             LIMIT 1;`,
            [id],
        );

        if (existentePorId.rows[0]) {
            return { ...existentePorId.rows[0], id: existentePorId.rows[0].id_usuario };
        }
    }

    if (nome) {
        const existentePorNome = await client.query(
            `SELECT id_usuario, nome
             FROM usuario
             WHERE LOWER(nome) = LOWER($1)
               AND tipo_usuario = 'ALUNO'
               AND ativo = TRUE
             LIMIT 1;`,
            [nome],
        );

        if (existentePorNome.rows[0]) {
            return { ...existentePorNome.rows[0], id: existentePorNome.rows[0].id_usuario };
        }
    }

    const erro = new Error('Aluno nao cadastrado. Cadastre o aluno antes de registrar a medicacao.');
    erro.code = 'ALUNO_NAO_CADASTRADO';
    throw erro;
}

async function creditarFarmCoins(client, usuarioId, medicamentoId, valor) {
    await client.query(
        `INSERT INTO conta (id_usuario, saldo_farmacoins)
         VALUES ($1, 0)
         ON CONFLICT (id_usuario) DO NOTHING;`,
        [usuarioId],
    );

    const conta = await client.query(
        `UPDATE conta
         SET saldo_farmacoins = saldo_farmacoins + $2
         WHERE id_usuario = $1
         RETURNING saldo_farmacoins;`,
        [usuarioId, valor],
    );

    await client.query(
        `INSERT INTO movimentacao_farmacoins (
            id_usuario,
            id_medicamento,
            tipo_movimentacao,
            quantidade_farmacoins,
            descricao
         )
         VALUES ($1, $2, 'ENTRADA', $3, 'Credito por cadastro de medicamento');`,
        [usuarioId, medicamentoId, valor],
    );

    return Number(conta.rows[0].saldo_farmacoins);
}

async function retirarFarmCoins(dados) {
    const client = await pool.connect();
    const valor = Number(dados.valor);
    const motivo = String(dados.motivo || '').trim();

    if (!Number.isInteger(valor) || valor <= 0 || !motivo) {
        const erro = new Error('Aluno, valor e motivo da retirada sao obrigatorios');
        erro.code = 'DADOS_RETIRADA_INVALIDOS';
        throw erro;
    }

    try {
        await client.query('BEGIN');

        const aluno = await buscarAlunoCadastrado(client, dados);

        await client.query(
            `INSERT INTO conta (id_usuario, saldo_farmacoins)
             VALUES ($1, 0)
             ON CONFLICT (id_usuario) DO NOTHING;`,
            [aluno.id],
        );

        const contaAtual = await client.query(
            `SELECT saldo_farmacoins
             FROM conta
             WHERE id_usuario = $1
             FOR UPDATE;`,
            [aluno.id],
        );

        const saldoAtual = Number(contaAtual.rows[0]?.saldo_farmacoins || 0);

        if (saldoAtual < valor) {
            const erro = new Error(`Saldo insuficiente. Saldo atual: ${saldoAtual} FC.`);
            erro.code = 'SALDO_INSUFICIENTE';
            throw erro;
        }

        const conta = await client.query(
            `UPDATE conta
             SET saldo_farmacoins = saldo_farmacoins - $2
             WHERE id_usuario = $1
             RETURNING saldo_farmacoins;`,
            [aluno.id, valor],
        );

        const movimentacao = await client.query(
            `INSERT INTO movimentacao_farmacoins (
                id_usuario,
                id_medicamento,
                tipo_movimentacao,
                quantidade_farmacoins,
                descricao
             )
             VALUES ($1, NULL, 'SAIDA', $2, $3)
             RETURNING id_movimentacao, id_usuario, quantidade_farmacoins, descricao, data_movimentacao;`,
            [aluno.id, valor, motivo],
        );

        await client.query('COMMIT');

        return mapearRetirada({
            ...movimentacao.rows[0],
            aluno_nome: aluno.nome,
            saldo_aluno: conta.rows[0].saldo_farmacoins,
        });
    } catch (erro) {
        await client.query('ROLLBACK');
        console.error('Erro ao retirar FarmCoins:', erro);
        throw erro;
    } finally {
        client.release();
    }
}

async function listarRetiradas(filtroAluno = null) {
    const idFiltro = Number(filtroAluno);
    const filtro = filtroAluno
        ? (Number.isInteger(idFiltro) && idFiltro > 0 ? 'AND u.id_usuario = $1' : 'AND LOWER(u.nome) = LOWER($1)')
        : '';
    const params = filtroAluno ? [Number.isInteger(idFiltro) && idFiltro > 0 ? idFiltro : filtroAluno] : [];
    const result = await pool.query(
        `SELECT
            mf.id_movimentacao,
            mf.id_usuario,
            u.nome AS aluno_nome,
            mf.quantidade_farmacoins,
            mf.descricao,
            mf.data_movimentacao,
            c.saldo_farmacoins AS saldo_aluno
         FROM movimentacao_farmacoins mf
         INNER JOIN usuario u ON u.id_usuario = mf.id_usuario
         LEFT JOIN conta c ON c.id_usuario = mf.id_usuario
         WHERE mf.tipo_movimentacao = 'SAIDA'
         ${filtro}
         ORDER BY mf.data_movimentacao DESC, mf.id_movimentacao DESC;`,
        params,
    );

    const saldo = await pool.query(
        `SELECT COALESCE(SUM(c.saldo_farmacoins), 0) AS saldo_total
         FROM conta c
         INNER JOIN usuario u ON u.id_usuario = c.id_usuario
         WHERE u.tipo_usuario = 'ALUNO';`,
    );

    return {
        retiradas: result.rows.map(mapearRetirada),
        saldo_total: Number(saldo.rows[0]?.saldo_total || 0),
    };
}

async function obterResumoFarmCoins() {
    const result = await pool.query(
        `WITH entradas AS (
            SELECT
                COALESCE(SUM(CASE
                    WHEN COALESCE(m.status, 'VALIDADO') <> 'INATIVO'
                        THEN m.quantidade * $1
                    ELSE 0
                END), 0) AS creditos,
                COALESCE(SUM(CASE
                    WHEN COALESCE(m.status, 'VALIDADO') <> 'INATIVO'
                        THEN m.quantidade
                    ELSE 0
                END), 0) AS caixas,
                COUNT(DISTINCT CASE
                    WHEN COALESCE(m.status, 'VALIDADO') <> 'INATIVO'
                        THEN m.id_aluno
                    ELSE NULL
                END) AS alunos
             FROM medicamento m
        ),
        saidas AS (
            SELECT COALESCE(SUM(mf.quantidade_farmacoins), 0) AS debitos
            FROM movimentacao_farmacoins mf
            WHERE mf.tipo_movimentacao = 'SAIDA'
        )
        SELECT
            entradas.creditos,
            saidas.debitos,
            GREATEST(entradas.creditos - saidas.debitos, 0) AS saldo_total,
            entradas.caixas AS caixas_total,
            entradas.alunos AS alunos_total
        FROM entradas
        CROSS JOIN saidas;`,
        [FARMACOINS_POR_CAIXA],
    );

    const row = result.rows[0] || {};

    return {
        creditos: Number(row.creditos || 0),
        debitos: Number(row.debitos || 0),
        saldo_total: Number(row.saldo_total || 0),
        caixas_total: Number(row.caixas_total || 0),
        alunos_total: Number(row.alunos_total || 0),
    };
}

async function listarSaldosAlunos() {
    const result = await pool.query(
        `SELECT
            u.id_usuario AS id,
            u.nome,
            u.nome_usuario,
            COALESCE(c.saldo_farmacoins, 0) AS saldo_farmacoins
         FROM usuario u
         LEFT JOIN conta c ON c.id_usuario = u.id_usuario
         WHERE u.tipo_usuario = 'ALUNO'
           AND u.ativo = TRUE
         ORDER BY u.nome ASC;`,
    );

    const alunos = result.rows.map((row) => ({
        id: row.id,
        nome: row.nome,
        nome_usuario: row.nome_usuario,
        saldo_farmacoins: Number(row.saldo_farmacoins || 0),
    }));

    return {
        alunos,
        total_alunos: alunos.length,
        saldo_total: alunos.reduce((total, aluno) => total + aluno.saldo_farmacoins, 0),
    };
}

async function cadastrarMedicamento(dados) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const aluno = await buscarAlunoCadastrado(client, dados);
        const quantidade = Number(dados.quantidade || 1);
        const farmcoins = quantidade * FARMACOINS_POR_CAIXA;

        const medicamento = await client.query(
            `INSERT INTO medicamento (
                nome_principio_ativo,
                data_entrega,
                data_validade,
                quantidade,
                status,
                id_aluno,
                id_professor
             )
             VALUES ($1, $2, $3, $4, 'VALIDADO', $5, $6)
             RETURNING id_medicamento, nome_principio_ativo, data_entrega, data_validade, quantidade, status, id_aluno, id_professor;`,
            [dados.principioAtivo, dados.dataEntrega, dados.validade, quantidade, aluno.id, dados.idProfessor || null],
        );

        const saldo = await creditarFarmCoins(client, aluno.id, medicamento.rows[0].id_medicamento, farmcoins);

        await client.query('COMMIT');

        return {
            ...mapearMedicamento({
                ...medicamento.rows[0],
                aluno_nome: aluno.nome,
                professor_nome: null,
                saldo_aluno: saldo,
                farmcoins_creditados: farmcoins,
            }),
            aluno,
            farmcoins: {
                creditados: farmcoins,
                saldo,
            },
        };
    } catch (erro) {
        await client.query('ROLLBACK');
        console.error('Erro ao cadastrar medicamento:', erro);
        throw erro;
    } finally {
        client.release();
    }
}

async function listarMedicamentos(filtroAluno = null) {
    const idFiltro = Number(filtroAluno);
    const filtro = filtroAluno
        ? (Number.isInteger(idFiltro) && idFiltro > 0 ? 'WHERE a.id_usuario = $1' : 'WHERE LOWER(a.nome) = LOWER($1)')
        : '';
    const params = filtroAluno ? [Number.isInteger(idFiltro) && idFiltro > 0 ? idFiltro : filtroAluno] : [];
    const result = await pool.query(
        `SELECT
            m.id_medicamento,
            m.nome_principio_ativo,
            m.data_entrega,
            m.data_validade,
            m.quantidade,
            m.status,
            m.id_aluno,
            m.id_professor,
            a.nome AS aluno_nome,
            p.nome AS professor_nome,
            c.saldo_farmacoins AS saldo_aluno,
            COALESCE(SUM(CASE WHEN mf.tipo_movimentacao = 'ENTRADA' THEN mf.quantidade_farmacoins ELSE 0 END), 0) AS farmcoins_creditados
         FROM medicamento m
         LEFT JOIN usuario a ON a.id_usuario = m.id_aluno
         LEFT JOIN usuario p ON p.id_usuario = m.id_professor
         LEFT JOIN conta c ON c.id_usuario = a.id_usuario
         LEFT JOIN movimentacao_farmacoins mf ON mf.id_medicamento = m.id_medicamento
         ${filtro}
         GROUP BY
            m.id_medicamento,
            a.nome,
            p.nome,
            c.saldo_farmacoins
         ORDER BY m.data_entrega DESC, m.id_medicamento DESC;`,
        params,
    );

    return result.rows.map(mapearMedicamento);
}

async function atualizarMedicamento(id, dados) {
    const quantidade = Number(dados.quantidade || 1);
    const result = await pool.query(
        `UPDATE medicamento
         SET nome_principio_ativo = $1,
             data_entrega = $2,
             data_validade = $3,
             quantidade = $4,
             status = $5
         WHERE id_medicamento = $6
         RETURNING id_medicamento, nome_principio_ativo, data_entrega, data_validade, quantidade, status, id_aluno, id_professor;`,
        [dados.principioAtivo, dados.dataEntrega, dados.validade, quantidade, dados.status || 'VALIDADO', id],
    );

    return mapearMedicamento(result.rows[0]);
}

async function inativarMedicamento(id) {
    const result = await pool.query(
        `UPDATE medicamento
         SET status = 'INATIVO'
         WHERE id_medicamento = $1
         RETURNING id_medicamento, nome_principio_ativo, data_entrega, data_validade, quantidade, status, id_aluno, id_professor;`,
        [id],
    );

    return mapearMedicamento(result.rows[0]);
}

async function excluirMedicamento(id) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const medicamento = await client.query(
            `SELECT
                m.id_medicamento,
                m.nome_principio_ativo,
                m.data_entrega,
                m.data_validade,
                m.quantidade,
                m.status,
                m.id_aluno,
                m.id_professor,
                a.nome AS aluno_nome,
                p.nome AS professor_nome,
                c.saldo_farmacoins AS saldo_aluno,
                COALESCE(SUM(CASE WHEN mf.tipo_movimentacao = 'ENTRADA' THEN mf.quantidade_farmacoins ELSE 0 END), 0) AS farmcoins_creditados
             FROM medicamento m
             LEFT JOIN usuario a ON a.id_usuario = m.id_aluno
             LEFT JOIN usuario p ON p.id_usuario = m.id_professor
             LEFT JOIN conta c ON c.id_usuario = a.id_usuario
             LEFT JOIN movimentacao_farmacoins mf ON mf.id_medicamento = m.id_medicamento
             WHERE m.id_medicamento = $1
             GROUP BY
                m.id_medicamento,
                a.nome,
                p.nome,
                c.saldo_farmacoins
             LIMIT 1;`,
            [id],
        );

        if (!medicamento.rows[0]) {
            await client.query('ROLLBACK');
            return null;
        }

        const registro = medicamento.rows[0];
        const farmcoinsCreditados = Number(registro.farmcoins_creditados || 0);

        await client.query(
            'DELETE FROM movimentacao_farmacoins WHERE id_medicamento = $1;',
            [id],
        );

        await client.query(
            'DELETE FROM medicamento WHERE id_medicamento = $1;',
            [id],
        );

        if (farmcoinsCreditados > 0 && registro.id_aluno) {
            await client.query(
                `UPDATE conta
                 SET saldo_farmacoins = GREATEST(saldo_farmacoins - $2, 0)
                 WHERE id_usuario = $1;`,
                [registro.id_aluno, farmcoinsCreditados],
            );
        }

        await client.query('COMMIT');

        return {
            ...mapearMedicamento(registro),
            farmcoins_removidos: farmcoinsCreditados,
        };
    } catch (erro) {
        await client.query('ROLLBACK');
        console.error('Erro ao excluir medicamento:', erro);
        throw erro;
    } finally {
        client.release();
    }
}

export {
    cadastrarMedicamento,
    listarMedicamentos,
    listarRetiradas,
    listarSaldosAlunos,
    obterResumoFarmCoins,
    retirarFarmCoins,
    atualizarMedicamento,
    inativarMedicamento,
    excluirMedicamento,
};
