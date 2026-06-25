import crypto from 'crypto';
import pool from '../database.js';

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const PERFIS_ADMIN = ['ADMIN', 'PROFESSOR'];
const JWT_SECRET = process.env.JWT_SECRET || 'farmaeduk-dev-secret';
const JWT_TTL_SEGUNDOS = 60 * 60 * 8;

function obterCampo(body, nomes) {
    for (const nome of nomes) {
        if (body[nome] !== undefined && body[nome] !== null && String(body[nome]).trim() !== '') {
            return String(body[nome]).trim();
        }
    }

    return undefined;
}

function hashSenha(senha) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');

        crypto.scrypt(senha, salt, KEY_LENGTH, (erro, derivedKey) => {
            if (erro) {
                reject(erro);
                return;
            }

            resolve(`${HASH_PREFIX}:${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

function compararSenha(senha, senhaSalva) {
    if (!senhaSalva) {
        return Promise.resolve(false);
    }

    const partes = senhaSalva.split(':');

    if (partes.length !== 3 || partes[0] !== HASH_PREFIX) {
        return Promise.resolve(senha === senhaSalva);
    }

    const [, salt, hashSalvo] = partes;

    return new Promise((resolve, reject) => {
        crypto.scrypt(senha, salt, KEY_LENGTH, (erro, derivedKey) => {
            if (erro) {
                reject(erro);
                return;
            }

            const hashRecebido = Buffer.from(derivedKey.toString('hex'), 'hex');
            const hashOriginal = Buffer.from(hashSalvo, 'hex');

            if (hashRecebido.length !== hashOriginal.length) {
                resolve(false);
                return;
            }

            resolve(crypto.timingSafeEqual(hashRecebido, hashOriginal));
        });
    });
}

function base64Url(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function decodificarBase64Url(input) {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return Buffer.from(padded, 'base64').toString('utf8');
}

function assinarToken(usuario) {
    const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const agora = Math.floor(Date.now() / 1000);
    const payload = base64Url(JSON.stringify({
        sub: usuario.id,
        nome: usuario.nome,
        nome_usuario: usuario.nome_usuario,
        perfil: usuario.perfil,
        tipo_usuario: usuario.tipo_usuario,
        iat: agora,
        exp: agora + JWT_TTL_SEGUNDOS,
    }));
    const assinatura = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${header}.${payload}.${assinatura}`;
}

function verificarToken(token) {
    const partes = String(token || '').split('.');

    if (partes.length !== 3) {
        return null;
    }

    const [header, payload, assinatura] = partes;
    const assinaturaEsperada = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const recebida = Buffer.from(assinatura);
    const esperada = Buffer.from(assinaturaEsperada);

    if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) {
        return null;
    }

    const dados = JSON.parse(decodificarBase64Url(payload));

    if (dados.exp && dados.exp < Math.floor(Date.now() / 1000)) {
        return null;
    }

    return dados;
}

function autenticar(req, res, next) {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const usuario = verificarToken(token);

    if (!usuario) {
        return res.status(401).json({ erro: 'Token JWT ausente ou invalido' });
    }

    req.usuario = usuario;
    next();
}

function exigirProfessor(req, res, next) {
    if (!PERFIS_ADMIN.includes(String(req.usuario?.tipo_usuario || '').toUpperCase())) {
        return res.status(403).json({ erro: 'Apenas professor pode executar esta acao' });
    }

    next();
}

async function register(req, res) {
    try {
        const perfilSolicitante = req.headers['x-user-perfil'];

        if (!['admin', 'master', 'professor'].includes(String(perfilSolicitante || '').toLowerCase())) {
            return res.status(403).json({ erro: 'Apenas professor pode cadastrar alunos' });
        }

        const body = req.body ?? {};
        const nome = obterCampo(body, ['nome', 'Nome', 'nome_aluno', 'nomeAluno']);
        const nomeUsuario = obterCampo(body, ['nome_usuario', 'nomeUsuario', 'usuario', 'Usuario', 'username']);
        const senha = obterCampo(body, ['senha', 'Senha', 'password']);

        if (!nome || !nomeUsuario || !senha) {
            return res.status(400).json({ erro: 'Nome do aluno, nome de usuario e senha sao obrigatorios' });
        }

        const usuarioExiste = await pool.query(
            'SELECT id_usuario AS id FROM usuario WHERE LOWER(nome_usuario) = LOWER($1) LIMIT 1;',
            [nomeUsuario],
        );

        if (usuarioExiste.rows.length > 0) {
            return res.status(409).json({ erro: 'Nome de usuario ja cadastrado' });
        }

        const senhaCriptografada = await hashSenha(senha);
        const resultado = await pool.query(
            `INSERT INTO usuario (nome, nome_usuario, senha, tipo_usuario, ativo)
             VALUES ($1, $2, $3, 'ALUNO', TRUE)
             RETURNING id_usuario AS id, nome, nome_usuario, tipo_usuario, ativo;`,
            [nome, nomeUsuario, senhaCriptografada],
        );

        await pool.query(
            `INSERT INTO conta (id_usuario, saldo_farmacoins)
             VALUES ($1, 0)
             ON CONFLICT (id_usuario) DO NOTHING;`,
            [resultado.rows[0].id],
        );

        resultado.rows[0].perfil = 'aluno';

        return res.status(201).json({
            mensagem: 'Usuario cadastrado com sucesso',
            usuario: resultado.rows[0],
        });
    } catch (erro) {
        console.error('Erro ao cadastrar usuario:', erro);
        return res.status(500).json({ erro: 'Erro no servidor' });
    }
}

async function login(req, res) {
    try {
        const body = req.body ?? {};
        const identificador = obterCampo(body, ['usuario', 'Usuario', 'nome', 'Nome', 'username']);
        const senha = obterCampo(body, ['senha', 'Senha', 'password']);
        const perfilEsperado = obterCampo(body, ['perfil', 'Perfil', 'tipo', 'Tipo']);

        if (!identificador || !senha) {
            return res.status(400).json({ erro: 'Usuario e senha sao obrigatorios' });
        }

        if (perfilEsperado && !['admin', 'aluno'].includes(perfilEsperado)) {
            return res.status(400).json({ erro: 'Tipo de acesso invalido' });
        }

        const resultado = await pool.query(
            `SELECT id_usuario AS id, nome, nome_usuario, senha, tipo_usuario
             FROM usuario
             WHERE LOWER(nome_usuario) = LOWER($1)
                OR LOWER(nome) = LOWER($1)
             LIMIT 1;`,
            [identificador],
        );

        const usuario = resultado.rows[0];

        if (!usuario || !(await compararSenha(senha, usuario.senha))) {
            return res.status(401).json({ erro: 'Usuario ou senha invalidos' });
        }

        usuario.tipo_usuario = String(usuario.tipo_usuario || '').toUpperCase();
        usuario.perfil = usuario.tipo_usuario === 'ALUNO' ? 'aluno' : 'admin';
        const usuarioEhAdmin = PERFIS_ADMIN.includes(usuario.tipo_usuario);

        if (perfilEsperado === 'admin' && !usuarioEhAdmin) {
            return res.status(403).json({ erro: 'Use uma conta de professor para acessar esta area' });
        }

        if (perfilEsperado === 'aluno' && usuarioEhAdmin) {
            return res.status(403).json({ erro: 'Use a pagina de professor para acessar esta conta' });
        }

        return res.json({
            autenticado: true,
            token: assinarToken(usuario),
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                nome_usuario: usuario.nome_usuario,
                perfil: usuario.perfil,
                tipo_usuario: usuario.tipo_usuario,
            },
        });
    } catch (erro) {
        console.error('Erro ao fazer login:', erro);
        return res.status(500).json({ erro: 'Erro no servidor' });
    }
}

async function listarAlunos(req, res) {
    try {
        const resultado = await pool.query(
            `SELECT id_usuario AS id, nome, nome_usuario
             FROM usuario
             WHERE tipo_usuario = 'ALUNO'
               AND ativo = TRUE
             ORDER BY nome ASC;`,
        );

        return res.json(resultado.rows);
    } catch (erro) {
        console.error('Erro ao listar alunos:', erro);
        return res.status(500).json({ erro: 'Erro ao listar alunos' });
    }
}

export { register, login, listarAlunos, autenticar, exigirProfessor };
