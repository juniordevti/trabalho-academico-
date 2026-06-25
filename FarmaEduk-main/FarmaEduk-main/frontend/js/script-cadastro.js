const registerForm = document.getElementById("registerForm");
const registerFeedback = document.getElementById("registerFeedback");
const usuarioLogado = JSON.parse(sessionStorage.getItem("farmaeduk_usuario") || "{}");
const token = sessionStorage.getItem("farmaeduk_token") || "";
const perfilUsuario = String(usuarioLogado.perfil || usuarioLogado.tipo_usuario || "").toLowerCase();

if (!["admin", "master", "professor"].includes(perfilUsuario)) {
  window.location.href = sessionStorage.getItem("farmaeduk_autenticado") === "true" ? "/filtros" : "/login-admin";
}

async function sendJson(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-User-Perfil": perfilUsuario,
    },
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.erro || body.mensagem || "Nao foi possivel concluir");
  }

  return body;
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerFeedback.textContent = "";
  registerFeedback.classList.remove("success");

  const nome = document.getElementById("registerNomeAluno").value.trim();
  const nomeUsuario = document.getElementById("registerNome").value.trim();
  const senha = document.getElementById("registerSenha").value;

  try {
    const result = await sendJson("/api/register", { nome, nome_usuario: nomeUsuario, senha });
    registerFeedback.classList.add("success");
    registerFeedback.textContent = result.mensagem || "Usuario cadastrado";
    registerForm.reset();

    setTimeout(() => {
      window.location.href = "/medicamentos";
    }, 900);
  } catch (error) {
    registerFeedback.textContent = error.message;
  }
});
