import { autenticar, exigirProfessor } from '../../backend/src/controllers/authController.js';
import { listarRetiradas, retirarFarmCoins } from '../../backend/src/controllers/medicamentoController.js';

function runMiddleware(req, res, middleware) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (erro) => {
      if (settled) return;
      settled = true;
      erro ? reject(erro) : resolve();
    };

    try {
      const result = middleware(req, res, done);
      if (result?.then) result.then(() => done()).catch(reject);
      setImmediate(() => {
        if (!settled && res.writableEnded) done();
      });
    } catch (erro) {
      reject(erro);
    }
  });
}

export default async function handler(req, res) {
  await runMiddleware(req, res, autenticar);
  if (res.writableEnded) return;

  if (req.method === 'GET') {
    return listarRetiradas(req, res);
  }

  if (req.method === 'POST') {
    await runMiddleware(req, res, exigirProfessor);
    if (res.writableEnded) return;
    return retirarFarmCoins(req, res);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ erro: 'Metodo nao permitido' });
}

