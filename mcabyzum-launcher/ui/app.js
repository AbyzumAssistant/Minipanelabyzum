const usernameInput = document.getElementById("username");
const usernameField = document.getElementById("username-field");
const rememberedLine = document.getElementById("remembered-line");
const rememberedName = document.getElementById("remembered-name");
const changeNameBtn = document.getElementById("change-name");
const enterBtn = document.getElementById("enter-btn");
const repairBtn = document.getElementById("repair-btn");
const statusBlock = document.getElementById("status-block");
const statusText = document.getElementById("status-text");
const barFill = document.getElementById("bar-fill");
const versionPill = document.getElementById("version-pill");
const serverPill = document.getElementById("server-pill");
const lede = document.getElementById("lede");
const inspectLog = document.getElementById("inspect-log");

let progressMax = 100;
let boot = null;
let autoStarted = false;
let apiReady = false;

function setControlsEnabled(enabled) {
  enterBtn.disabled = !enabled;
  repairBtn.disabled = !enabled;
}

function setBusy(busy, text) {
  if (!apiReady) return;
  enterBtn.disabled = busy;
  repairBtn.disabled = busy;
  statusBlock.hidden = !busy && !text;
  if (text) statusText.textContent = text;
}

function showRemembered(name) {
  usernameField.hidden = true;
  rememberedLine.hidden = false;
  rememberedName.textContent = name;
  enterBtn.textContent = "Entrar ahora";
}

function showNameEdit() {
  usernameField.hidden = false;
  rememberedLine.hidden = true;
  enterBtn.textContent = "Entrar";
  usernameInput.focus();
}

function renderInspect(detail) {
  if (!detail) return;
  inspectLog.hidden = false;
  inspectLog.innerHTML = "";
  const bits = [];
  (detail.removed || []).forEach((v) => bits.push(["removed", `Eliminado: ${v}`]));
  (detail.fixed || []).forEach((v) => bits.push(["fixed", `Reparado: ${v}`]));
  (detail.issues || []).forEach((i) => {
    bits.push([i.severity || "info", i.message]);
  });
  if (!bits.length) {
    bits.push(["ok", "Sin problemas"]);
  }
  bits.forEach(([cls, text]) => {
    const li = document.createElement("li");
    li.className = cls;
    li.textContent = text;
    inspectLog.appendChild(li);
  });
}

async function waitApi() {
  for (let i = 0; i < 120; i += 1) {
    const api = window.pywebview?.api;
    if (
      api &&
      typeof api.get_bootstrap === "function" &&
      typeof api.enter_server === "function"
    ) {
      return api;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Launcher API no disponible");
}

async function startEnter(name) {
  const nick = (name || "").trim();
  if (!nick) {
    showNameEdit();
    usernameInput.focus();
    return;
  }
  const version = boot?.version || "1.20.1";
  setBusy(
    true,
    boot?.fastReady ? `Entrando como ${nick}…` : `Inspeccionando / preparando ${version}…`,
  );
  barFill.style.width = "8%";
  inspectLog.hidden = true;
  try {
    const api = await waitApi();
    await api.enter_server(nick);
  } catch (err) {
    setBusy(false, String(err));
  }
}

window.addEventListener("mcabyzum:status", (e) => {
  statusBlock.hidden = false;
  statusText.textContent = e.detail.text || "…";
});

window.addEventListener("mcabyzum:progress", (e) => {
  statusBlock.hidden = false;
  if (typeof e.detail.max === "number" && e.detail.max > 0) progressMax = e.detail.max;
  if (typeof e.detail.value === "number") {
    const pct = Math.max(0, Math.min(100, (e.detail.value / progressMax) * 100));
    barFill.style.width = `${pct}%`;
  }
});

window.addEventListener("mcabyzum:inspect", (e) => {
  renderInspect(e.detail);
});

window.addEventListener("mcabyzum:error", (e) => {
  setBusy(false, e.detail.error || "Error");
  enterBtn.disabled = false;
  repairBtn.disabled = false;
  statusText.textContent = e.detail.error || "Error al lanzar";
});

window.addEventListener("mcabyzum:launched", (e) => {
  const name = e.detail?.username || usernameInput.value;
  setBusy(false, `Minecraft abierto — ${name} al servidor…`);
  barFill.style.width = "100%";
  enterBtn.disabled = false;
  repairBtn.disabled = false;
});

window.addEventListener("pywebviewready", async () => {
  setControlsEnabled(false);
  statusBlock.hidden = false;
  statusText.textContent = "Conectando con el launcher…";
  try {
    const api = await waitApi();
    apiReady = true;
    boot = await api.get_bootstrap();
    versionPill.textContent = boot.version;
    serverPill.textContent = boot.serverName || boot.serverHost;
    const mcTitle = document.getElementById("mc-title");
    if (mcTitle) {
      mcTitle.textContent = `Minecraft ${boot.version} · Horizons`;
    }
    usernameInput.value = boot.username || "Player";
    document.title = boot.appName || "MCABYZUM";

    if (boot.remembered) {
      showRemembered(boot.username);
      lede.textContent = boot.fastReady
        ? `Bienvenido de nuevo, ${boot.username}. Entrando directo al servidor.`
        : boot.ready
          ? `Hola ${boot.username}. Sincronizando mods del panel…`
          : `Hola ${boot.username}. Preparando Minecraft ${boot.version}…`;
    }

    if (boot.autoEnter && !autoStarted) {
      autoStarted = true;
      await startEnter(boot.username);
      return;
    }
    setControlsEnabled(true);
  } catch (err) {
    apiReady = false;
    setControlsEnabled(false);
    statusBlock.hidden = false;
    statusText.textContent = String(err);
  }
});

enterBtn.addEventListener("click", async () => {
  if (!apiReady) return;
  await startEnter(usernameInput.value);
});

changeNameBtn.addEventListener("click", () => {
  showNameEdit();
});

repairBtn.addEventListener("click", async () => {
  if (!apiReady) return;
  setBusy(true, "Inspeccionando errores…");
  barFill.style.width = "15%";
  try {
    const api = await waitApi();
    const report = await api.inspect_and_fix();
    renderInspect(report);
    barFill.style.width = "100%";
    setBusy(false, report.ok ? "Todo reparado." : "Revisa el informe abajo.");
    boot = await api.get_bootstrap();
  } catch (err) {
    setBusy(false, String(err));
  }
});

usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") enterBtn.click();
});

setControlsEnabled(false);
