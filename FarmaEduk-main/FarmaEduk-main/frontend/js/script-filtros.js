if (sessionStorage.getItem("farmaeduk_autenticado") !== "true") {
  window.location.href = "/login-aluno";
}

const usuarioLogado = JSON.parse(sessionStorage.getItem("farmaeduk_usuario") || "{}");
const token = sessionStorage.getItem("farmaeduk_token") || "";
const perfilUsuario = String(usuarioLogado.perfil || usuarioLogado.tipo_usuario || "").toLowerCase();
const isAdmin = ["admin", "master", "professor"].includes(perfilUsuario);

const FARMACOINS_POR_CAIXA = 25;
const form = document.getElementById("filter-form");
const limparFiltros = document.getElementById("limpar-filtros");
const lista = document.getElementById("lista-filtros");
const total = document.getElementById("resultado-total");
const registrosTotal = document.getElementById("registros-total");
const caixasTotal = document.getElementById("caixas-total");
const coinsTotal = document.getElementById("coins-total");
const filtroFeedback = document.getElementById("filtro-feedback");
const filtroInicio = document.getElementById("filtro-inicio");
const filtroFim = document.getElementById("filtro-fim");
const filtroAlunoSelect = document.getElementById("filtro-aluno-select");
const filtroAluno = document.getElementById("filtro-aluno");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroPrincipio = document.getElementById("filtro-principio");
const voltarAdmin = document.getElementById("voltar-admin");
const sairSessao = document.getElementById("sair-sessao");

let registros = [];
let alunosCadastrados = [];

function dadosDaDescricao(descricao) {
  const dados = {};

  String(descricao || "").split(" | ").forEach((parte) => {
    const [chave, valor] = parte.split(": ");
    if (chave && valor) dados[chave.trim().toLowerCase()] = valor.trim();
  });

  return dados;
}

function formatarData(data) {
  if (!data) return "Sem data";
  const dataNormalizada = String(data).slice(0, 10);
  const dataFormatada = new Date(`${dataNormalizada}T00:00:00`);
  return Number.isNaN(dataFormatada.getTime()) ? "Sem data" : dataFormatada.toLocaleDateString("pt-BR");
}

function getAluno(registro) {
  if (registro.tipo_registro === "RETIRADA") return registro.aluno || "Aluno nao informado";
  const dados = dadosDaDescricao(registro.descricao);
  return registro.nome_doador || dados.doador || dados.aluno || "Doador nao informado";
}

function getEntrega(registro) {
  if (registro.tipo_registro === "RETIRADA") return registro.data || "";
  return String(registro.data_entrega || "").slice(0, 10) || dadosDaDescricao(registro.descricao).entrega || "";
}

function getCaixas(registro) {
  if (registro.tipo_registro === "RETIRADA") return 0;
  return Number(registro.quantidade || dadosDaDescricao(registro.descricao).caixas || 1);
}

function getValidade(registro) {
  if (registro.tipo_registro === "RETIRADA") return "";
  return registro.validade ? String(registro.validade).slice(0, 10) : dadosDaDescricao(registro.descricao).vencimento || "";
}

function getFarmCoins(registro) {
  if (registro.tipo_registro === "RETIRADA") return -Number(registro.valor || 0);
  const caixas = getCaixas(registro);
  return Number(registro.farmcoins_creditados || caixas * FARMACOINS_POR_CAIXA);
}

function getTitulo(registro) {
  return registro.tipo_registro === "RETIRADA" ? "Retirada de FARMACOINS" : registro.nome;
}

function getDetalhe(registro) {
  if (registro.tipo_registro === "RETIRADA") {
    return registro.motivo || "Retirada sem motivo informado";
  }

  return `${getCaixas(registro)} caixa(s)`;
}

function renderizar(listaFiltrada) {
  const caixas = listaFiltrada.reduce((soma, registro) => soma + getCaixas(registro), 0);
  const farmacoins = listaFiltrada.reduce((soma, registro) => soma + getFarmCoins(registro), 0);

  total.textContent = `${listaFiltrada.length} registro(s)`;
  registrosTotal.textContent = listaFiltrada.length;
  caixasTotal.textContent = caixas;
  coinsTotal.textContent = `${farmacoins} FC`;

  if (!listaFiltrada.length) {
    lista.innerHTML = '<p class="empty">Nenhum registro encontrado.</p>';
    return;
  }

  lista.innerHTML = listaFiltrada.map((registro) => {
    const farmcoinsRegistro = getFarmCoins(registro);
    const validade = getValidade(registro);

    return `
      <article class="medicine-item ${registro.tipo_registro === "RETIRADA" ? "danger-item" : ""}">
        <div>
          <strong>${getAluno(registro)}</strong>
          <span>${getTitulo(registro)} - ${getDetalhe(registro)}</span>
          <small>${registro.tipo_registro === "RETIRADA" ? "Retirada" : "Entrega"}: ${formatarData(getEntrega(registro))}${validade ? ` | Validade: ${formatarData(validade)}` : ""}</small>
        </div>
        <b>${farmcoinsRegistro > 0 ? "+" : ""}${farmcoinsRegistro} FC</b>
      </article>
    `;
  }).join("");
}

function renderizarAlunos(alunos) {
  alunosCadastrados = alunos;
  filtroAlunoSelect.innerHTML = '<option value="">Todos os alunos cadastrados</option>'
    + alunos.map((aluno) => `<option value="${aluno.id}">${aluno.nome}</option>`).join("");
}

function preencherAlunoSelecionado() {
  const aluno = alunosCadastrados.find((item) => Number(item.id) === Number(filtroAlunoSelect.value));

  filtroAluno.value = aluno?.nome || "";
}

async function carregarAlunos() {
  if (!isAdmin) return;

  try {
    const resposta = await fetch("/api/alunos", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-User-Perfil": perfilUsuario,
      },
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      throw new Error(erro.erro || "Nao foi possivel carregar alunos cadastrados.");
    }

    renderizarAlunos(await resposta.json());
  } catch (error) {
    filtroFeedback.textContent = error.message;
    renderizarAlunos([]);
  }
}

function aplicarFiltros() {
  const dataInicio = filtroInicio.value;
  const dataFim = filtroFim.value;
  const tipo = filtroTipo.value;
  const aluno = isAdmin ? filtroAluno.value.trim().toLowerCase() : "";
  const principio = filtroPrincipio.value.trim().toLowerCase();

  filtroFeedback.textContent = "";

  if (dataInicio && dataFim && dataInicio > dataFim) {
    filtroFeedback.textContent = "A data inicial nao pode ser maior que a data final.";
    return;
  }

  const filtrados = registros.filter((registro) => {
    const alunoRegistro = getAluno(registro).toLowerCase();
    const entrega = getEntrega(registro);
    const principioRegistro = `${getTitulo(registro)} ${registro.motivo || ""}`.toLowerCase();
    const registroTipo = registro.tipo_registro === "RETIRADA" ? "SAIDA" : "ENTRADA";

    return (!dataInicio || entrega >= dataInicio)
      && (!dataFim || entrega <= dataFim)
      && (!aluno || alunoRegistro.includes(aluno))
      && (!principio || principioRegistro.includes(principio))
      && (!tipo || registroTipo === tipo);
  });

  renderizar(filtrados);
}

async function carregarRegistros() {
  try {
    const headers = {
      "Authorization": `Bearer ${token}`,
      "X-User-Perfil": perfilUsuario,
    };
    const alunoSelecionado = isAdmin && filtroAlunoSelect.value ? `?id_aluno=${encodeURIComponent(filtroAlunoSelect.value)}` : "";
    const [resposta, respostaRetiradas] = await Promise.all([
      fetch(`/api/medicacoes${alunoSelecionado}`, { headers }),
      fetch(`/api/farmcoins/retiradas${alunoSelecionado}`, { headers }),
    ]);

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      throw new Error(erro.erro || "Nao foi possivel carregar os registros.");
    }

    if (!respostaRetiradas.ok) {
      const erro = await respostaRetiradas.json().catch(() => ({}));
      throw new Error(erro.erro || "Nao foi possivel carregar as retiradas.");
    }

    const entregas = (await resposta.json()).map((registro) => ({ ...registro, tipo_registro: "ENTREGA" }));
    const dadosRetiradas = await respostaRetiradas.json();
    const retiradas = (dadosRetiradas.retiradas || []).map((registro) => ({ ...registro, tipo_registro: "RETIRADA" }));

    registros = [...entregas, ...retiradas].sort((a, b) => String(getEntrega(b)).localeCompare(String(getEntrega(a))));
    renderizar(registros);
  } catch (error) {
    filtroFeedback.textContent = error.message;
    renderizar([]);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  aplicarFiltros();
});

limparFiltros.addEventListener("click", () => {
  form.reset();
  configurarFiltrosDoPerfil();
  if (isAdmin) preencherAlunoSelecionado();
  filtroFeedback.textContent = "";
  renderizar(registros);
});

function configurarFiltrosDoPerfil() {
  if (isAdmin) {
    filtroAlunoSelect.hidden = false;
    filtroAluno.readOnly = true;
    return;
  }

  voltarAdmin.hidden = true;
  filtroAlunoSelect.hidden = true;
  filtroAluno.value = usuarioLogado.nome || "";
  filtroAluno.readOnly = true;
  filtroAluno.title = "Aluno logado";
}

sairSessao.addEventListener("click", () => {
  sessionStorage.removeItem("farmaeduk_autenticado");
  sessionStorage.removeItem("farmaeduk_usuario");
  sessionStorage.removeItem("farmaeduk_token");
  window.location.href = "/";
});

filtroAlunoSelect.addEventListener("change", preencherAlunoSelecionado);

configurarFiltrosDoPerfil();
carregarAlunos();
carregarRegistros();
