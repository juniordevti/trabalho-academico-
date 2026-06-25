import { createServer } from 'http';
const { default: app } = await import('./backend/src/app.js');
import initDatabase from './backend/src/initDb.js';

const server = createServer(app);

const PORT = Number(process.env.PORT) || 3000;
const PORTA_FIXA_CONFIGURADA = Boolean(process.env.PORT);

function iniciarServidor(porta, tentativasRestantes = 10) {
  return new Promise((resolve, reject) => {
    const aoIniciar = () => {
      server.off('error', aoFalhar);
      resolve(porta);
    };

    const aoFalhar = (erro) => {
      server.off('listening', aoIniciar);

      if (erro.code === 'EADDRINUSE' && !PORTA_FIXA_CONFIGURADA && tentativasRestantes > 0) {
        const proximaPorta = porta + 1;
        console.warn(`Porta ${porta} em uso. Tentando http://localhost:${proximaPorta}...`);
        iniciarServidor(proximaPorta, tentativasRestantes - 1).then(resolve).catch(reject);
        return;
      }

      reject(erro);
    };

    server.once('listening', aoIniciar);
    server.once('error', aoFalhar);
    server.listen(porta);
  });
}

try {
  await initDatabase();

  const portaEmUso = await iniciarServidor(PORT);
  console.log(`Servidor rodando em http://localhost:${portaEmUso}`);
} catch (erro) {
  if (erro.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} ja esta em uso. Feche o outro servidor ou defina outra porta com PORT=3001.`);
    process.exit(1);
  }

  console.error('Nao foi possivel iniciar o servidor:', erro);
  process.exit(1);
}
