# FarmaEduk

Sistema academico para registrar entregas de medicamentos vencidos realizadas por alunos e controlar a geracao de FarmaCoins.

O professor cadastra alunos, registra as entregas de medicamentos e acompanha os creditos gerados. O aluno acessa o sistema apenas para consultar os registros vinculados ao seu usuario.

Importante: o sistema nao utiliza email nem RA. O aluno e identificado pelo cadastro na tabela `usuario`, usando `id_usuario`, `nome`, `nome_usuario`, `senha`, `tipo_usuario` e `ativo`. O campo `nome_usuario` e usado no login; o campo `nome` e o nome do aluno exibido nas entregas.

## Funcionalidades

- Login separado para professor e aluno.
- Cadastro de alunos pelo professor com nome do aluno e nome de usuario para login.
- Registro de entrega de medicamento para aluno ja cadastrado.
- Vinculo da entrega ao aluno por `id_usuario`, selecionando pelo nome do aluno.
- Registro de principio ativo, data de entrega, validade e quantidade.
- Calculo de FarmaCoins: cada caixa gera 25 FarmaCoins.
- Listagem, edicao e inativacao de entregas.
- Filtros por aluno, principio ativo e periodo.
- Consulta do aluno restrita aos proprios registros.

## Regra de FarmaCoins

```txt
1 caixa = 25 FarmaCoins
4 caixas = 100 FarmaCoins
```

Ao registrar uma entrega, o backend cria uma movimentacao de entrada em `movimentacao_farmacoins`. O saldo exibido no sistema e calculado a partir dos registros e movimentacoes, sem uso de email ou RA.

## Tecnologias

- Node.js
- Express
- PostgreSQL
- JavaScript
- HTML
- CSS

## Como Executar

1. Instale as dependencias:

```bash
npm install
```

2. Configure o banco no arquivo `backend/src/.env`:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/banco?sslmode=require
PORT=3000
JWT_SECRET=farmaeduk-dev-secret
```

3. Inicialize ou atualize o banco:

```bash
npm run init-db
```

4. Inicie o servidor:

```bash
npm start
```

O sistema ficara disponivel em:

```txt
http://localhost:3000
```

## Deploy na Vercel

O projeto esta configurado para Vercel com `vercel.json`, arquivos estaticos em `public/` e a Function `api/[...path].js`.

1. Suba este repositorio para o GitHub.
2. Na Vercel, importe o repositorio.
3. Deixe o framework como `Other`.
4. Nao configure build command.
5. Configure as variaveis de ambiente:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/banco?sslmode=require
JWT_SECRET=troque-por-um-segredo-forte
```

6. Faca o deploy.
7. Teste a API:

```txt
https://seu-projeto.vercel.app/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "runtime": "vercel",
  "hasDatabaseUrl": true,
  "hasJwtSecret": true
}
```

Antes do primeiro uso em producao, inicialize o banco com `npm run init-db` apontando para o `DATABASE_URL` remoto.

## Acessos Iniciais

O script de banco cria usuarios administrativos quando eles ainda nao existem:

```txt
Usuario: admin
Senha: admin123

Usuario: professor
Senha: professor123
```

Essas senhas devem ser alteradas em um ambiente real.

## Fluxo Principal

1. Professor acessa `/login-admin`.
2. Professor cadastra um aluno em `/cadastro`, informando o nome do aluno, nome de usuario e senha.
3. Professor registra uma entrega em `/medicamentos`, selecionando o aluno cadastrado.
4. O sistema grava o medicamento e uma movimentacao de FarmaCoins.
5. Aluno acessa `/login-aluno`.
6. Aluno consulta apenas os registros vinculados ao seu `id_usuario` em `/filtros`.

## Modelo do Banco

O banco oficial possui somente estas tabelas:

```txt
usuario
- id_usuario
- nome
- nome_usuario
- senha
- tipo_usuario
- ativo

conta
- id_conta
- id_usuario
- saldo_farmacoins

medicamento
- id_medicamento
- nome_principio_ativo
- data_entrega
- data_validade
- quantidade
- status
- id_aluno
- id_professor

movimentacao_farmacoins
- id_movimentacao
- id_usuario
- id_medicamento
- tipo_movimentacao
- quantidade_farmacoins
- descricao
- data_movimentacao
```

Tabelas antigas como `usuario_aluino`, `usuario_aluno`, `farmcoins`, `usuarios` e `medicamentos` sao removidas pelo script `npm run init-db`.

## Rotas Principais

### Autenticacao

```txt
POST /auth/login
POST /api/register
GET  /api/alunos
```

### Medicamentos

```txt
GET   /api/medicacoes
POST  /api/medicacoes
PUT   /api/medicamentos/:id
PATCH /api/medicamentos/:id/inativar
```

### Saude do servidor

```txt
GET /health
```

Resposta:

```json
{
  "status": "ok"
}
```

## Estrutura do Projeto

```txt
FarmaEduk/
+-- backend/
|   +-- src/
|       +-- app.js
|       +-- database.js
|       +-- init.sql
|       +-- initDb.js
|       +-- server.js
|       +-- controllers/
|       +-- routes/
|       +-- services/
+-- frontend/
|   +-- css/
|   +-- html/
|   +-- js/
+-- package.json
+-- server.js
```

## Observacoes

- Email e RA nao sao utilizados no cadastro, login, filtros, API ou banco.
- O aluno so pode receber entrega se existir previamente na tabela `usuario`.
- A entrega de medicamento sempre deve estar vinculada a um aluno cadastrado.
- O professor registra medicamentos; o aluno apenas consulta seus registros.

## Autores

Projeto desenvolvido para fins academicos por alunos do 4o periodo do curso de Analise e Desenvolvimento de Sistemas da UNICEUG - Goiania.

Orientador: Saul Matuzinhos de Moura.

## Licenca

Este projeto foi desenvolvido exclusivamente para fins academicos. O uso, copia, modificacao ou distribuicao deve respeitar sua finalidade educacional.
