import { register } from '../backend/src/controllers/authController.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Metodo nao permitido' });
  }

  return register(req, res);
}
