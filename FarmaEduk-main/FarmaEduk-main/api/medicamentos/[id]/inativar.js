import { autenticar, exigirProfessor } from '../../../backend/src/controllers/authController.js';
import { inativarMedicamento } from '../../../backend/src/controllers/medicamentoController.js';

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
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ erro: 'Metodo nao permitido' });
  }

  await runMiddleware(req, res, autenticar);
  if (res.writableEnded) return;
  await runMiddleware(req, res, exigirProfessor);
  if (res.writableEnded) return;

  req.params = { id: req.query.id };
  return inativarMedicamento(req, res);
}

