/* =================================================================
   WORKIN'STORE — script.js
   HTML5 + CSS3 + JS puro (Vanilla). Persistência: Firebase Auth + RTDB.
   Imagens salvas em Base64 no Realtime Database (sem Storage).
   ================================================================= */
/* =================================================================
   CONFIGURAÇÃO DO FIREBASE
   -----------------------------------------------------------------
   Preencha abaixo os dados do seu projeto Firebase.
   Você encontra em: https://console.firebase.google.com/
     → Seu projeto → Configurações do projeto → Seus apps (Web)
   -----------------------------------------------------------------
   Habilite no console:
     1) Authentication → Sign-in method → Email/Senha
     2) Realtime Database → Criar banco
        Regras iniciais sugeridas (ajuste depois):
        {
          "rules": {
            ".read": true,
            ".write": "auth != null && auth.token.email == 'admin@admin.com'"
          }
        }
   ================================================================= */
const firebaseConfig = {
 apiKey: "AIzaSyDiAP2IvsfPac29qzFA71sbLYuizVxZ9HQ",
  authDomain: "portal-workin-store.firebaseapp.com",
  databaseURL: "https://portal-workin-store-default-rtdb.firebaseio.com",
  projectId: "portal-workin-store",
  storageBucket: "portal-workin-store.firebasestorage.app",
  messagingSenderId: "803334158041",
  appId: "1:803334158041:web:5ef4069e7ec3a5973970c8"
};
// Email autorizado a acessar o painel administrativo (facilmente editável)
const ADMIN_EMAIL = "admin@admin.com";
/* =================================================================
   ESTADO GLOBAL
   ================================================================= */
const state = {
  site: {
    title: "Workin'Store",
    description: "Tecnologia, acessórios e serviços com a confiança que você merece.",
    keywords: "workin store, loja, tecnologia, playstation 2, acessórios",
    colorPrimary: "#6c5ce7",
    colorSecondary: "#00d4ff",
    favicon: "",
    logoSquare: "",
    logoHorizontal: "",
    heroEyebrow: "Bem-vindo",
    heroTitle: "Workin'Store",
    heroSubtitle: "Tecnologia, acessórios e serviços com a confiança que você merece.",
    aboutText: "A Workin'Store é referência em tecnologia e atendimento personalizado.",
    supportText: "Precisa de ajuda? Fale conosco pelos canais oficiais.",
  },
  banners: {},
  categories: {},
  products: {},
  menu: {},
  footer: {
    company: "Workin'Store",
    about: "Tecnologia com propósito.",
    info: "",
    copy: "© " + new Date().getFullYear() + " Workin'Store",
    links: "",      // "Home|#home\nLoja|#loja"
    socials: "",    // "Instagram|https://..."
    contacts: "",   // "WhatsApp|(88) 99999-9999"
  },
  services: [
    { title: "Assistência Técnica", desc: "Reparos em OPL ou Funtuna com garantia e agilidade." },
    { title: "Instalação", desc: "Só plugar e jogar, tudo garantido." },
    { title: "Consultoria", desc: "Escolha o produto certo para você." },
  ],
  downloads: [
    { title: "Manuais", desc: "Passo a passo de como inicializar seus jogos no PS2." },
    { title: "Firmwares", desc: "Atualizações oficiais do OPL sempre que você nos pedir." },
    { title: "Jogos Bônus", desc: "Na compra de um Kit OPL, ganhe acesso exclusivo a jogos bônus em nossas plataformas." },
  ],
  currentCategory: null,
  currentSearch: "",
  editingProductId: null,
  slideIndex: 0,
  slideTimer: null,
  auth: null,
  db: null,
  fbReady: false,
};
/* =================================================================
   UTIL
   ================================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function toast(msg, type = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast" + (type ? " " + type : "");
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.hidden = true), 3000);
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    // Compressão leve para reduzir tamanho no RTDB.
    // Preserva PNG/WebP/SVG (transparência) — só converte para JPEG quando origem é JPEG.
    const reader = new FileReader();
    const type = (file.type || "").toLowerCase();
    // SVG: mantém como está (vetor, sem canvas)
    if (type === "image/svg+xml") {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const keepAlpha = type === "image/png" || type === "image/webp" || type === "image/gif";
    const outType = keepAlpha ? "image/png" : "image/jpeg";
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        let { width: w, height: h } = img;
        if (w > max || h > max) {
          if (w > h) { h = Math.round((h * max) / w); w = max; }
          else { w = Math.round((w * max) / h); h = max; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        // Sem fill de fundo — canvas começa transparente. Para JPEG (sem alfa) pintamos branco em vez de preto.
        if (!keepAlpha) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
/* =================================================================
   FIREBASE INIT
   ================================================================= */
function initFirebase() {
  const filled = firebaseConfig.apiKey && firebaseConfig.databaseURL;
  if (!filled) {
    $("#fbStatus").textContent =
      "Firebase NÃO configurado.\nPreencha `firebaseConfig` no início de script.js.\nO site funciona em modo local (somente esta sessão) até ser configurado.";
    return false;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    state.auth = firebase.auth();
    state.db = firebase.database();
    state.fbReady = true;
    $("#fbStatus").textContent = "Firebase conectado com sucesso.";
    subscribeAll();
    state.auth.onAuthStateChanged(u => {
      if (u && u.email === ADMIN_EMAIL) {
        $("#adminEmail").textContent = u.email;
      } else {
        // logout / não-admin: esconde painel e limpa email
        $("#adminEmail").textContent = "";
        $("#adminPanel").hidden = true;
      }
    });
    return true;
  } catch (e) {
    $("#fbStatus").textContent = "Erro Firebase: " + e.message;
    return false;
  }
}
function dbRef(path) { return state.db.ref(path); }
function subscribeAll() {
  dbRef("site").on("value", s => { const v = s.val(); if (v) { state.site = { ...state.site, ...v }; renderAll(); } });
  dbRef("banners").on("value", s => { state.banners = s.val() || {}; renderSlider(); renderAdminBanners(); });
  dbRef("categories").on("value", s => { state.categories = s.val() || {}; renderCategoryChips(); renderAdminCategories(); refreshProductCategorySelects(); renderMenu(); });
  dbRef("products").on("value", s => { state.products = s.val() || {}; renderProducts(); renderAdminProducts(); });
  dbRef("menu").on("value", s => { state.menu = s.val() || {}; renderMenu(); renderAdminMenu(); });
  dbRef("footer").on("value", s => { const v = s.val(); if (v) { state.footer = { ...state.footer, ...v }; renderFooter(); } });
}
/* =================================================================
   RENDER
   ================================================================= */
function renderAll() {
  // SEO
  document.title = state.site.title || "Workin'Store";
  $("#siteTitle").textContent = state.site.title;
  $("#metaDescription").setAttribute("content", state.site.description || "");
  $("#metaKeywords").setAttribute("content", state.site.keywords || "");
  $("#ogTitle").setAttribute("content", state.site.title || "");
  $("#ogDescription").setAttribute("content", state.site.description || "");
  if (state.site.favicon) $("#favicon").setAttribute("href", state.site.favicon);
  // Cores
  document.documentElement.style.setProperty("--primary", state.site.colorPrimary || "#6c5ce7");
  document.documentElement.style.setProperty("--secondary", state.site.colorSecondary || "#00d4ff");
  // Logos
  const lsq = $("#logoSquare"), lho = $("#logoHorizontal");
  if (state.site.logoSquare) { lsq.src = state.site.logoSquare; } else { lsq.removeAttribute("src"); }
  if (state.site.logoHorizontal) { lho.src = state.site.logoHorizontal; } else { lho.removeAttribute("src"); }
  // Hero
  $("#heroEyebrow").textContent = state.site.heroEyebrow || "Bem-vindo";
  $("#heroTitle").textContent = state.site.heroTitle || "Workin'Store";
  $("#heroSubtitle").textContent = state.site.heroSubtitle || "";
  $("#aboutText").textContent = state.site.aboutText || "";
  $("#supportText").textContent = state.site.supportText || "";
  renderServices();
  renderDownloads();
  applyEmptySectionVisibility();
}
function renderServices() {
  $("#servicesGrid").innerHTML = state.services.map(s =>
    `<div class="mini-card"><h4>${escapeHtml(s.title)}</h4><p>${escapeHtml(s.desc)}</p></div>`).join("");
}
function renderDownloads() {
  $("#downloadsGrid").innerHTML = state.downloads.map(s =>
    `<div class="mini-card"><h4>${escapeHtml(s.title)}</h4><p>${escapeHtml(s.desc)}</p></div>`).join("");
}
function renderSlider() {
  const container = $("#slides"), dots = $("#dots");
  const items = Object.entries(state.banners);
  const sliderEl = document.querySelector(".hero-slider");
  if (items.length === 0) {
    container.innerHTML = "";
    dots.innerHTML = "";
    if (sliderEl) sliderEl.hidden = true;
    const grid = document.querySelector(".hero-grid");
    if (grid) grid.style.gridTemplateColumns = "1fr";
    return;
  }
  if (sliderEl) sliderEl.hidden = false;
  const grid = document.querySelector(".hero-grid");
  if (grid) grid.style.gridTemplateColumns = "";
  container.innerHTML = items.map(([id, b]) =>
    `<div class="slide"><img loading="lazy" src="${b.image}" alt="${escapeHtml(b.caption || "")}" />${b.caption ? `<div class="cap">${escapeHtml(b.caption)}</div>` : ""}</div>`).join("");
  dots.innerHTML = items.map((_, i) =>
    `<button data-i="${i}" aria-label="Slide ${i + 1}" class="${i === 0 ? "active" : ""}"></button>`).join("");
  state.slideIndex = 0;
  updateSlider();
  restartSlideTimer();
}
function updateSlider() {
  const total = Object.keys(state.banners).length;
  if (total === 0) return;
  state.slideIndex = ((state.slideIndex % total) + total) % total;
  $("#slides").style.transform = `translateX(-${state.slideIndex * 100}%)`;
  $$("#dots button").forEach((b, i) => b.classList.toggle("active", i === state.slideIndex));
}
function restartSlideTimer() {
  clearInterval(state.slideTimer);
  if (Object.keys(state.banners).length > 1)
    state.slideTimer = setInterval(() => { state.slideIndex++; updateSlider(); }, 5000);
}
function renderCategoryChips() {
  const cats = Object.entries(state.categories);
  $("#categoryChips").innerHTML =
    `<button class="chip ${state.currentCategory === null ? "active" : ""}" data-cat="">Todas</button>` +
    cats.map(([id, c]) => `<button class="chip ${state.currentCategory === id ? "active" : ""}" data-cat="${id}">${escapeHtml(c.name)}</button>`).join("");
  applyEmptySectionVisibility();
}
function renderProducts() {
  const grid = $("#productsGrid");
  const search = state.currentSearch.trim().toLowerCase();
  let list = Object.entries(state.products);
  if (state.currentCategory) list = list.filter(([id, p]) => p.category === state.currentCategory);
  if (search) {
    list = list.filter(([id, p]) => {
      const cat = state.categories[p.category]?.name || "";
      const sub = (state.categories[p.category]?.subs || {})[p.subcategory]?.name || "";
      return [p.name, p.description, cat, sub].some(v => (v || "").toLowerCase().includes(search));
    });
  }
  $("#emptyState").hidden = list.length > 0;
  $("#productCount").textContent = `${list.length} produto(s)`;
  grid.innerHTML = list.map(([id, p]) => {
    const availTag = p.availability === "local"
      ? `<span class="tag warn">Local${p.cities ? ": " + escapeHtml(p.cities) : ""}</span>`
      : `<span class="tag ok">Nacional</span>`;
    const warrTag = p.warranty === "workin"
      ? `<span class="tag">Workin'Store (7 dias)</span>`
      : `<span class="tag">Garantia do Fabricante</span>`;
    const cat = state.categories[p.category]?.name;
    const sub = (state.categories[p.category]?.subs || {})[p.subcategory]?.name;
    return `
      <article class="product" data-product-id="${id}" role="button" tabindex="0" aria-label="Ver detalhes de ${escapeHtml(p.name)}">
        <div class="thumb${p.image ? "" : " empty"}">${p.image ? `<img loading="lazy" src="${p.image}" alt="${escapeHtml(p.name)}" />` : "🛒"}</div>
        <div class="info">
          <h3 class="name">${escapeHtml(p.name)}</h3>
          <p class="desc">${escapeHtml(p.description || "")}</p>
          <div class="meta">
            ${cat ? `<span class="tag">${escapeHtml(cat)}</span>` : ""}
            ${sub ? `<span class="tag">${escapeHtml(sub)}</span>` : ""}
            ${availTag}${warrTag}
          </div>
          <a class="buy" href="${p.buyUrl || "#"}" target="_blank" rel="noopener">Comprar</a>
        </div>
      </article>`;
  }).join("");
  applyEmptySectionVisibility();
}
/* =================================================================
   MODAL DE PRODUTO
   ================================================================= */
function openProductModal(id) {
  const p = state.products[id]; if (!p) return;
  const cat = state.categories[p.category]?.name;
  const sub = (state.categories[p.category]?.subs || {})[p.subcategory]?.name;
  const availTag = p.availability === "local"
    ? `<span class="tag warn">Local${p.cities ? ": " + escapeHtml(p.cities) : ""}</span>`
    : `<span class="tag ok">Nacional</span>`;
  const warrTag = p.warranty === "workin"
    ? `<span class="tag">Workin'Store (7 dias)</span>`
    : `<span class="tag">Garantia do Fabricante</span>`;
  $("#pm_thumb").innerHTML = p.image
    ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" />`
    : "🛒";
  $("#pm_name").textContent = p.name || "";
  $("#pm_desc").textContent = p.description || "";
  $("#pm_meta").innerHTML =
    (cat ? `<span class="tag">${escapeHtml(cat)}</span>` : "") +
    (sub ? `<span class="tag">${escapeHtml(sub)}</span>` : "") +
    availTag + warrTag;
  const buy = $("#pm_buy");
  if (p.buyUrl) { buy.href = p.buyUrl; buy.style.display = ""; }
  else { buy.removeAttribute("href"); buy.style.display = "none"; }
  const modal = $("#productModal");
  modal.hidden = false; modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeProductModal() {
  const modal = $("#productModal");
  modal.hidden = true; modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
function renderMenu() {
  const list = $("#menuList");
  const defaults = [
    { label: "Home", href: "#home" },
    { label: "Loja", href: "#loja" },
    { label: "Serviços", href: "#servicos" },
    { label: "Downloads", href: "#downloads" },
    { label: "Contato", href: "#contato" },
    { label: "Sobre", href: "#sobre" },
    { label: "Suporte", href: "#suporte" },
  ];
  const items = Object.keys(state.menu).length ? Object.entries(state.menu).map(([id, m]) => ({ id, ...m })) : defaults;
  // Mega menu de Loja: subcategorias/categorias
  const cats = Object.entries(state.categories);
  list.innerHTML = items.map(m => {
    const isStore = /loja/i.test(m.label);
    let mega = "";
    if (isStore && cats.length) {
      mega = `<div class="mega">${cats.map(([id, c]) => `<a href="#loja" data-cat="${id}">${escapeHtml(c.name)}</a>`).join("")}</div>`;
    }
    return `<li><a class="m-link" href="${m.href || "#"}">${escapeHtml(m.label)}</a>${mega}</li>`;
  }).join("");
}
function renderFooter() {
  $("#footerCompany").textContent = state.footer.company || "Workin'Store";
  $("#footerAbout").textContent = state.footer.about || "";
  $("#footerInfo").textContent = state.footer.info || "";
  $("#footerCopy").textContent = state.footer.copy || "";
  const parseLines = s => (s || "").split("\n").map(l => l.split("|").map(x => x.trim())).filter(a => a[0]);
  $("#footerLinks").innerHTML = parseLines(state.footer.links).map(([l, h]) => `<li><a href="${h || "#"}">${escapeHtml(l)}</a></li>`).join("");
  $("#footerSocials").innerHTML = parseLines(state.footer.socials).map(([l, h]) => `<li><a href="${h || "#"}" target="_blank" rel="noopener">${escapeHtml(l)}</a></li>`).join("");
  $("#contactList").innerHTML = parseLines(state.footer.contacts).map(([l, v]) => `<li><b>${escapeHtml(l)}:</b>${escapeHtml(v || "")}</li>`).join("");
  applyEmptySectionVisibility();
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
/* Esconde seções sem conteúdo cadastrado */
function applyEmptySectionVisibility() {
  const hide = (id, empty) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !!empty;
  };
  hide("categorias", Object.keys(state.categories || {}).length === 0);
  hide("loja",       Object.keys(state.products   || {}).length === 0);
  hide("servicos",   !state.services || state.services.length === 0);
  hide("downloads",  !state.downloads || state.downloads.length === 0);
  hide("sobre",      !(state.site.aboutText && state.site.aboutText.trim()));
  hide("suporte",    !(state.site.supportText && state.site.supportText.trim()));
  const contatos = (state.footer.contacts || "").trim();
  hide("contato", !contatos);
}
/* =================================================================
   INTERAÇÕES / EVENTOS PÚBLICOS
   ================================================================= */
function bindPublicEvents() {
  // Header scroll
  window.addEventListener("scroll", () => {
    $("#header").classList.toggle("scrolled", window.scrollY > 20);
  }, { passive: true });
  // Mobile menu toggle
  $("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
  // Search
  $("#searchToggle").addEventListener("click", () => {
    const sb = $("#searchBar"); sb.hidden = !sb.hidden;
    if (!sb.hidden) $("#searchInput").focus();
  });
  $("#searchInput").addEventListener("input", e => {
    state.currentSearch = e.target.value; renderProducts();
    document.getElementById("loja").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  // Slider
  $("#prevSlide").addEventListener("click", () => { state.slideIndex--; updateSlider(); restartSlideTimer(); });
  $("#nextSlide").addEventListener("click", () => { state.slideIndex++; updateSlider(); restartSlideTimer(); });
  $("#dots").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    state.slideIndex = +b.dataset.i; updateSlider(); restartSlideTimer();
  });
  // Category chips
  $("#categoryChips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    state.currentCategory = b.dataset.cat || null;
    renderCategoryChips(); renderProducts();
  });
  // Mega menu category clicks
  $("#menuList").addEventListener("click", e => {
    const a = e.target.closest("a[data-cat]"); if (!a) return;
    state.currentCategory = a.dataset.cat; renderCategoryChips(); renderProducts();
  });
  // Login modal
  $("#openLogin").addEventListener("click", openLogin);
  $$("[data-close]").forEach(el => el.addEventListener("click", closeLogin));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeLogin(); closeProductModal(); }
  });
  $("#loginForm").addEventListener("submit", handleLogin);
  $("#forgotBtn").addEventListener("click", handleForgot);
  // Product modal: clique no card abre; clique no link "Comprar" segue direto
  $("#productsGrid").addEventListener("click", e => {
    if (e.target.closest("a.buy")) return; // deixa o link comprar funcionar
    const card = e.target.closest(".product[data-product-id]");
    if (!card) return;
    openProductModal(card.dataset.productId);
  });
  $("#productsGrid").addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".product[data-product-id]");
    if (!card) return;
    e.preventDefault();
    openProductModal(card.dataset.productId);
  });
  $$("#productModal [data-close-product]").forEach(el =>
    el.addEventListener("click", closeProductModal));
  // Logout: liga aqui (existe no DOM desde o boot, mesmo com painel oculto)
  $("#logoutBtn").addEventListener("click", async () => {
    try {
      if (state.auth) await state.auth.signOut();
    } catch (e) { /* ignore */ }
    $("#adminPanel").hidden = true;
    $("#adminEmail").textContent = "";
    toast("Sessão encerrada.");
  });
}
function openLogin() {
  $("#loginModal").hidden = false;
  $("#loginEmail").value = ""; $("#loginPassword").value = "";
  $("#loginError").hidden = true;
  setTimeout(() => $("#loginEmail").focus(), 100);
}
function closeLogin() { $("#loginModal").hidden = true; }
async function handleLogin(e) {
  e.preventDefault();
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;
  const btn = $("#loginSubmit"); btn.disabled = true; btn.textContent = "Entrando...";
  try {
    if (!state.fbReady) throw new Error("Firebase não configurado.");
    const cred = await state.auth.signInWithEmailAndPassword(email, password);
    if (cred.user.email !== ADMIN_EMAIL) {
      await state.auth.signOut();
      throw new Error("Acesso negado.");
    }
    closeLogin(); openAdmin(); toast("Bem-vindo!", "success");
  } catch (err) {
    $("#loginError").textContent = err.message || "Falha no login."; $("#loginError").hidden = false;
  } finally { btn.disabled = false; btn.textContent = "Entrar"; }
}
async function handleForgot() {
  const email = $("#loginEmail").value.trim();
  if (!email) { toast("Digite seu email primeiro.", "error"); return; }
  try {
    if (!state.fbReady) throw new Error("Firebase não configurado.");
    await state.auth.sendPasswordResetEmail(email);
    toast("Email de recuperação enviado.", "success");
  } catch (err) { toast(err.message, "error"); }
}
/* =================================================================
   ADMIN
   ================================================================= */
function openAdmin() {
  $("#adminPanel").hidden = false;
  fillAdminForms();
  bindAdminEvents();
  renderAdminBanners(); renderAdminCategories(); renderAdminProducts(); renderAdminMenu();
}
function fillAdminForms() {
  const s = state.site;
  $("#adm_title").value = s.title || "";
  $("#adm_description").value = s.description || "";
  $("#adm_keywords").value = s.keywords || "";
  $("#adm_colorPrimary").value = s.colorPrimary || "#6c5ce7";
  $("#adm_colorSecondary").value = s.colorSecondary || "#00d4ff";
  $("#adm_heroEyebrow").value = s.heroEyebrow || "";
  $("#adm_heroTitle").value = s.heroTitle || "";
  $("#adm_heroSubtitle").value = s.heroSubtitle || "";
  $("#adm_aboutText").value = s.aboutText || "";
  $("#adm_supportText").value = s.supportText || "";
  $("#adm_favicon_state").textContent = s.favicon ? "imagem carregada" : "sem imagem";
  $("#adm_logoSquare_state").textContent = s.logoSquare ? "imagem carregada" : "sem imagem";
  $("#adm_logoHorizontal_state").textContent = s.logoHorizontal ? "imagem carregada" : "sem imagem";
  // URLs (usadas quando não há upload; ideal para hospedar imagens no GitHub)
  const fUrl = document.getElementById("adm_faviconUrl");
  const lsUrl = document.getElementById("adm_logoSquareUrl");
  const lhUrl = document.getElementById("adm_logoHorizontalUrl");
  if (fUrl)  fUrl.value  = s.faviconUrl        || "";
  if (lsUrl) lsUrl.value = s.logoSquareUrl     || "";
  if (lhUrl) lhUrl.value = s.logoHorizontalUrl || "";
  const f = state.footer;
  $("#adm_footerCompany").value = f.company || "";
  $("#adm_footerAbout").value = f.about || "";
  $("#adm_footerInfo").value = f.info || "";
  $("#adm_footerCopy").value = f.copy || "";
  $("#adm_footerLinks").value = f.links || "";
  $("#adm_footerSocials").value = f.socials || "";
  $("#adm_contactList").value = f.contacts || "";
}
let adminBound = false;
function bindAdminEvents() {
  if (adminBound) return; adminBound = true;
  // Tabs
  $("#adminTabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    $$("#adminTabs button").forEach(x => x.classList.toggle("active", x === b));
    $$(".admin-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === b.dataset.tab));
  });
  // File uploads (site)
  $$(".admin-tab[data-tab=site] input[type=file]").forEach(inp => {
    inp.addEventListener("change", async e => {
      const target = inp.dataset.target; // adm_favicon / adm_logoSquare / adm_logoHorizontal
      const key = target.replace("adm_", "");
      const file = e.target.files[0]; if (!file) return;
      const b64 = await fileToBase64(file);
      state.site[key] = b64;
      $(`#${target}_state`).textContent = "imagem carregada";
      toast("Imagem preparada — clique em Salvar.", "success");
    });
  });
  $("#saveSite").addEventListener("click", saveSite);
  $("#saveFooter").addEventListener("click", saveFooter);
  // Banners
  $("#addBanner").addEventListener("click", addBanner);
  $("#bannerList").addEventListener("click", handleBannerListClick);
  // Categories
  $("#addCategory").addEventListener("click", addCategory);
  $("#categoryList").addEventListener("click", handleCategoryListClick);
  // Products
  $("#p_category").addEventListener("change", refreshSubcategorySelect);
  $("#p_availability").addEventListener("change", () => {
    $("#p_cities").parentElement.style.display = $("#p_availability").value === "local" ? "flex" : "none";
  });
  $("#saveProduct").addEventListener("click", saveProduct);
  $("#clearProduct").addEventListener("click", clearProductForm);
  $("#productList").addEventListener("click", handleProductListClick);
  // Menu
  $("#addMenu").addEventListener("click", addMenuItem);
  $("#menuAdminList").addEventListener("click", handleMenuListClick);
}
async function saveSite() {
  state.site.title = $("#adm_title").value;
  state.site.description = $("#adm_description").value;
  state.site.keywords = $("#adm_keywords").value;
  state.site.colorPrimary = $("#adm_colorPrimary").value;
  state.site.colorSecondary = $("#adm_colorSecondary").value;
  state.site.heroEyebrow = $("#adm_heroEyebrow").value;
  state.site.heroTitle = $("#adm_heroTitle").value;
  state.site.heroSubtitle = $("#adm_heroSubtitle").value;
  state.site.aboutText = $("#adm_aboutText").value;
  state.site.supportText = $("#adm_supportText").value;
  // URLs de logos/favicon (prioridade: URL > base64 se ambos existirem)
  const fUrl  = document.getElementById("adm_faviconUrl");
  const lsUrl = document.getElementById("adm_logoSquareUrl");
  const lhUrl = document.getElementById("adm_logoHorizontalUrl");
  if (fUrl)  state.site.faviconUrl        = fUrl.value.trim();
  if (lsUrl) state.site.logoSquareUrl     = lsUrl.value.trim();
  if (lhUrl) state.site.logoHorizontalUrl = lhUrl.value.trim();
  if (state.site.faviconUrl)        state.site.favicon        = state.site.faviconUrl;
  if (state.site.logoSquareUrl)     state.site.logoSquare     = state.site.logoSquareUrl;
  if (state.site.logoHorizontalUrl) state.site.logoHorizontal = state.site.logoHorizontalUrl;
  await persist("site", state.site);
  renderAll();
  toast("Site atualizado.", "success");
}
async function saveFooter() {
  state.footer = {
    company: $("#adm_footerCompany").value,
    about: $("#adm_footerAbout").value,
    info: $("#adm_footerInfo").value,
    copy: $("#adm_footerCopy").value,
    links: $("#adm_footerLinks").value,
    socials: $("#adm_footerSocials").value,
    contacts: $("#adm_contactList").value,
  };
  await persist("footer", state.footer);
  renderFooter();
  toast("Rodapé atualizado.", "success");
}
async function addBanner() {
  const file = $("#bannerFile").files[0];
  const caption = $("#bannerCaption").value.trim();
  if (!file) { toast("Selecione uma imagem.", "error"); return; }
  const b64 = await fileToBase64(file);
  const id = uid();
  state.banners[id] = { image: b64, caption, created: Date.now() };
  await persist("banners/" + id, state.banners[id]);
  $("#bannerFile").value = ""; $("#bannerCaption").value = "";
  toast("Banner adicionado.", "success");
}
function renderAdminBanners() {
  $("#bannerList").innerHTML = Object.entries(state.banners).map(([id, b]) => `
    <div class="admin-item">
      <img class="thumb" src="${b.image}" alt="" />
      <div class="info"><b>${escapeHtml(b.caption || "(sem legenda)")}</b><small>${new Date(b.created || 0).toLocaleString()}</small></div>
      <div class="actions"><button class="danger" data-del="${id}">Excluir</button></div>
    </div>`).join("");
}
function handleBannerListClick(e) {
  const del = e.target.closest("[data-del]"); if (del) removeBanner(del.dataset.del);
}
async function removeBanner(id) {
  delete state.banners[id];
  await persist("banners/" + id, null);
  toast("Banner removido.");
}
async function addCategory() {
  const name = $("#newCategory").value.trim(); if (!name) return;
  const id = uid();
  state.categories[id] = { name, subs: {} };
  await persist("categories/" + id, state.categories[id]);
  $("#newCategory").value = "";
}
function renderAdminCategories() {
  $("#categoryList").innerHTML = Object.entries(state.categories).map(([id, c]) => `
    <div class="admin-item" data-cat="${id}">
      <div class="info">
        <b>${escapeHtml(c.name)}</b>
        <small>${Object.keys(c.subs || {}).length} subcategoria(s)</small>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          ${Object.entries(c.subs || {}).map(([sid, s]) => `<span class="tag">${escapeHtml(s.name)} <button data-delsub="${id}|${sid}" style="margin-left:6px;color:#ff8ea0">×</button></span>`).join("")}
        </div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <input placeholder="Nova subcategoria" data-subinput="${id}" style="flex:1;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid var(--glass-border);color:#fff" />
          <button data-addsub="${id}">Adicionar</button>
        </div>
      </div>
      <div class="actions">
        <button data-rename="${id}">Renomear</button>
        <button class="danger" data-delcat="${id}">Excluir</button>
      </div>
    </div>`).join("");
}
async function handleCategoryListClick(e) {
  const t = e.target;
  if (t.dataset.delcat) {
    delete state.categories[t.dataset.delcat];
    await persist("categories/" + t.dataset.delcat, null); toast("Categoria removida.");
  } else if (t.dataset.rename) {
    const id = t.dataset.rename; const name = prompt("Novo nome:", state.categories[id].name);
    if (name) { state.categories[id].name = name; await persist("categories/" + id + "/name", name); }
  } else if (t.dataset.addsub) {
    const id = t.dataset.addsub;
    const inp = $(`[data-subinput="${id}"]`); const name = inp.value.trim(); if (!name) return;
    const sid = uid(); state.categories[id].subs = state.categories[id].subs || {};
    state.categories[id].subs[sid] = { name };
    await persist(`categories/${id}/subs/${sid}`, { name }); inp.value = "";
  } else if (t.dataset.delsub) {
    const [id, sid] = t.dataset.delsub.split("|");
    delete state.categories[id].subs[sid];
    await persist(`categories/${id}/subs/${sid}`, null);
  }
}
function refreshProductCategorySelects() {
  const cat = $("#p_category"); if (!cat) return;
  const cur = cat.value;
  cat.innerHTML = `<option value="">— selecione —</option>` +
    Object.entries(state.categories).map(([id, c]) => `<option value="${id}">${escapeHtml(c.name)}</option>`).join("");
  if (cur) cat.value = cur;
  refreshSubcategorySelect();
}
function refreshSubcategorySelect() {
  const catId = $("#p_category").value;
  const sub = $("#p_subcategory");
  const subs = state.categories[catId]?.subs || {};
  sub.innerHTML = `<option value="">— selecione —</option>` +
    Object.entries(subs).map(([id, s]) => `<option value="${id}">${escapeHtml(s.name)}</option>`).join("");
}
async function saveProduct() {
  const p = {
    name: $("#p_name").value.trim(),
    description: $("#p_description").value.trim(),
    category: $("#p_category").value,
    subcategory: $("#p_subcategory").value,
    availability: $("#p_availability").value,
    cities: $("#p_cities").value.trim(),
    warranty: $("#p_warranty").value,
    buyUrl: $("#p_buyUrl").value.trim(),
    image: state.editingProductId ? (state.products[state.editingProductId]?.image || "") : "",
  };
  if (!p.name) { toast("Nome obrigatório.", "error"); return; }
  const file = $("#p_image").files[0];
  if (file) p.image = await fileToBase64(file);
  const id = state.editingProductId || uid();
  state.products[id] = p;
  await persist("products/" + id, p);
  clearProductForm();
  toast("Produto salvo.", "success");
}
function clearProductForm() {
  ["p_name","p_description","p_cities","p_buyUrl"].forEach(i => $("#" + i).value = "");
  $("#p_image").value = ""; $("#p_category").value = ""; $("#p_subcategory").innerHTML = "";
  $("#p_availability").value = "nacional"; $("#p_warranty").value = "workin";
  state.editingProductId = null;
}
function renderAdminProducts() {
  $("#productList").innerHTML = Object.entries(state.products).map(([id, p]) => `
    <div class="admin-item">
      ${p.image ? `<img class="thumb" src="${p.image}" alt="" />` : `<div class="thumb"></div>`}
      <div class="info"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(state.categories[p.category]?.name || "—")} · ${p.availability}</small></div>
      <div class="actions">
        <button data-edit="${id}">Editar</button>
        <button class="danger" data-delp="${id}">Excluir</button>
      </div>
    </div>`).join("");
}
async function handleProductListClick(e) {
  const t = e.target;
  if (t.dataset.delp) {
    delete state.products[t.dataset.delp]; await persist("products/" + t.dataset.delp, null); toast("Produto removido.");
  } else if (t.dataset.edit) {
    const id = t.dataset.edit; const p = state.products[id]; state.editingProductId = id;
    $("#p_name").value = p.name || ""; $("#p_description").value = p.description || "";
    $("#p_category").value = p.category || ""; refreshSubcategorySelect(); $("#p_subcategory").value = p.subcategory || "";
    $("#p_availability").value = p.availability || "nacional"; $("#p_cities").value = p.cities || "";
    $("#p_warranty").value = p.warranty || "workin"; $("#p_buyUrl").value = p.buyUrl || "";
    document.querySelector('[data-tab="products"] h3').scrollIntoView({behavior:"smooth"});
  }
}
async function addMenuItem() {
  const label = $("#menuLabel").value.trim(), href = $("#menuHref").value.trim();
  if (!label) return;
  const id = uid();
  state.menu[id] = { label, href };
  await persist("menu/" + id, { label, href });
  $("#menuLabel").value = ""; $("#menuHref").value = "";
}
function renderAdminMenu() {
  $("#menuAdminList").innerHTML = Object.entries(state.menu).map(([id, m]) => `
    <div class="admin-item">
      <div class="info"><b>${escapeHtml(m.label)}</b><small>${escapeHtml(m.href || "")}</small></div>
      <div class="actions"><button class="danger" data-delm="${id}">Excluir</button></div>
    </div>`).join("");
}
async function handleMenuListClick(e) {
  const t = e.target.closest("[data-delm]"); if (!t) return;
  delete state.menu[t.dataset.delm];
  await persist("menu/" + t.dataset.delm, null);
}
/* =================================================================
   PERSIST (Firebase ou local fallback)
   ================================================================= */
async function persist(path, value) {
  if (state.fbReady) {
    try {
      if (value === null) await dbRef(path).remove();
      else await dbRef(path).set(value);
    } catch (e) { toast("Erro ao salvar: " + e.message, "error"); }
  } else {
    // Fallback local: apenas re-renderiza o que já está no state
    renderAll(); renderSlider(); renderCategoryChips(); renderProducts(); renderMenu(); renderFooter();
    renderAdminBanners(); renderAdminCategories(); renderAdminProducts(); renderAdminMenu();
  }
}
/* =================================================================
   BOOT
   ================================================================= */
document.addEventListener("DOMContentLoaded", () => {
  bindPublicEvents();
  renderAll();
  renderSlider();
  renderCategoryChips();
  renderProducts();
  renderMenu();
  renderFooter();
  initFirebase();
});
