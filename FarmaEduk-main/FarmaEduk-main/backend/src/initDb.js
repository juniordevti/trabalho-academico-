import fs from 'fs';
import path from 'path';
import pool from './database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  try {
    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Inicializando banco de dados...');
    await pool.query(sql);
    console.log('Banco de dados inicializado com sucesso!');
  } catch (erro) {
    console.error('Erro ao inicializar banco de dados:', erro);
    throw erro;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initDatabase()
    .then(() => pool.end())
    .catch(async () => {
      await pool.end();
      process.exit(1);
    });
}

export default initDatabase;
