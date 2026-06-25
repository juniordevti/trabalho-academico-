import pool from '../backend/src/database.js';

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      status: 'error',
      erro: 'DATABASE_URL nao configurada na Vercel',
    });
  }

  try {
    const resultado = await pool.query('SELECT NOW() AS agora;');

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      agora: resultado.rows[0]?.agora,
    });
  } catch (erro) {
    return res.status(500).json({
      status: 'error',
      erro: 'Nao foi possivel conectar ao banco',
      code: erro.code,
      message: erro.message,
    });
  }
}
