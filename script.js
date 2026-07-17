/* =================================================================
   WORKIN'STORE — script.js
   HTML5 + CSS3 + JS puro (Vanilla). Persistência: Firebase Auth + RTDB.
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

const ADMIN_EMAIL = "admin@admin.com";

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
    links: "",
    socials: "",
    contacts: "",
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
    const reader = new FileReader();
    const type = (file.type || "").toLowerCase();
    if (type === "image/svg+xml") {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const keepAlpha = type === "image/png" || type === "image/webp" || type === "image/gif";
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

function initFirebase() {
  const filled = firebaseConfig.apiKey && firebaseConfig.databaseURL;
  if (!filled) {
    $("#fbStatus").textContent = "Firebase NÃO configurado.";
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

function renderAll() {
  document.title = state.site.title || "Workin'Store";
  $("#siteTitle").textContent = state.site.title;
  $("#metaDescription").setAttribute("content", state.site.description || "");
  $("#metaKeywords").setAttribute("content", state.site.keywords || "");
  $("#ogTitle").setAttribute("content", state.site.title || "");
  $("#ogDescription").setAttribute("content", state.site.description || "");
  if (state.site.favicon) $("#favicon").setAttribute("href", state.site.favicon);
  document.documentElement.style.setProperty("--primary", state.site.colorPrimary || "#6c5ce7");
  document.documentElement.style.setProperty("--secondary", state.site.colorSecondary || "#00d4ff");
  const lsq = $("#logoSquare"), lho = $("#logoHorizontal");
  if (state.site.logoSquare) { lsq.src = state.site.logoSquare; } else { lsq.removeAttribute("src"); }
  if (state.site.logoHorizontal) { lho.src = state.site.logoHorizontal; } else { lho.removeAttribute("src"); }
  $("#heroEyebrow").textContent = state.site.heroEyebrow || "Bem-vindo";
  $("#heroTitle").textContent = state.site.heroTitle || "Workin'Store";
  $("#heroSubtitle").textContent = state.site.heroSubtitle || "";
  $("#aboutText").textContent = state.site.aboutText || "";
  $("#supportText").textContent = state.site.supportText || "";
  renderServices();
  renderDownloads();
  applyEmptySectionVisibility();
}

function renderServices() { $("#servicesGrid").innerHTML = state.services.map(s => `<div class="mini-card"><h4>${escapeHtml(s.title)}</h4><p>${escapeHtml(s.desc)}</p></div>`).join(""); }
function renderDownloads() { $("#downloadsGrid").innerHTML = state.downloads.map(s => `<div class="mini-card"><h4>${escapeHtml(s.title)}</h4><p>${escapeHtml(s.desc)}</p></div>`).join(""); }

function renderSlider() {
  const container = $("#slides"), dots = $("#dots");
  const items = Object.entries(state.banners);
  const sliderEl = document.querySelector(".hero-slider");
  if (items.length === 0) {
    container.innerHTML = ""; dots.innerHTML = "";
    if (sliderEl) sliderEl.hidden = true;
    return;
  }
  if (sliderEl) sliderEl.hidden = false;
  container.innerHTML = items.map(([id, b]) => `<div class="slide"><img loading="lazy" src="${b.image}" alt="${escapeHtml(b.caption || "")}" />${b.caption ? `<div class="cap">${escapeHtml(b.caption)}</div>` : ""}</div>`).join("");
  dots.innerHTML = items.map((_, i) => `<button data-i="${i}" aria-label="Slide ${i + 1}" class="${i === 0 ? "active" : ""}"></button>`).join("");
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
  state.slideTimer = setInterval(() => { state.slideIndex++; updateSlider(); }, 5000);
}

function renderCategoryChips() {
  const cats = Object.entries(state.categories);
  $("#categoryChips").innerHTML = `<button class="chip ${state.currentCategory === null ? "active" : ""}" data-cat="">Todas</button>` + cats.map(([id, c]) => `<button class="chip ${state.currentCategory === id ? "active" : ""}" data-cat="${id}">${escapeHtml(c.name)}</button>`).join("");
  applyEmptySectionVisibility();
}

function renderProducts() {
  const grid = $("#productsGrid");
  const search = state.currentSearch.trim().toLowerCase();
  let list = Object.entries(state.products);
  if (state.currentCategory) list = list.filter(([id, p]) => p.category === state.currentCategory);
  if (search) list = list.filter(([id, p]) => { const cat = state.categories[p.category]?.name || ""; const sub = (state.categories[p.category]?.subs || {})[p.subcategory]?.name || ""; return [p.name, p.description, cat, sub].some(v => (v || "").toLowerCase().includes(search)); });
  $("#emptyState").hidden = list.length > 0;
  $("#productCount").textContent = `${list.length} produto(s)`;
  grid.innerHTML = list.map(([id, p]) => {
    const availTag = p.availability === "local" ? `<span class="tag warn">Local</span>` : `<span class="tag ok">Nacional</span>`;
    return `
      <article class="product" data-product-id="${id}" role="button" tabindex="0">
        <div class="thumb${p.image ? "" : " empty"}">${p.image ? `<img loading="lazy" src="${p.image}" alt="${escapeHtml(p.name)}" />` : "🛒"}</div>
        <div class="info">
          <h3 class="name">${escapeHtml(p.name)}</h3>
          <p class="desc">${escapeHtml(p.description || "")}</p>
          <a class="buy" href="${p.buyUrl || "#"}" target="_blank">Comprar</a>
        </div>
      </article>`;
  }).join("");
}

function openProductModal(id) {
  const p = state.products[id]; if (!p) return;
  $("#pm_name").textContent = p.name;
  $("#pm_desc").textContent = p.description;
  $("#pm_thumb").innerHTML = p.image ? `<img src="${p.image}" />` : "🛒";
  const m = $("#productModal");
  m.hidden = false;
  m.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  const m = $("#productModal");
  m.hidden = true;
  m.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function renderMenu() {
  const list = $("#menuList");
  const cats = Object.entries(state.categories);
  list.innerHTML = Object.entries(state.menu).map(([id, m]) => `<li><a class="m-link" href="${m.href}">${escapeHtml(m.label)}</a></li>`).join("");
}

function renderFooter() {
  $("#footerCompany").textContent = state.footer.company;
  $("#footerCopy").textContent = state.footer.copy;
}

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function applyEmptySectionVisibility() {
  const hide = (id, empty) => { const el = document.getElementById(id); if (el) el.hidden = !!empty; };
  hide("categorias", Object.keys(state.categories || {}).length === 0);
  hide("loja", Object.keys(state.products || {}).length === 0);
}

function bindPublicEvents() {
  window.addEventListener("scroll", () => { $("#header").classList.toggle("scrolled", window.scrollY > 20); });
  $("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
  
  $("#productsGrid").addEventListener("click", e => {
    const card = e.target.closest(".product[data-product-id]");
    if (card && !e.target.closest("a.buy")) openProductModal(card.dataset.productId);
  });

  $$("[data-close-product]").forEach(el => el.addEventListener("click", closeProductModal));
  
  $("#loginForm").addEventListener("submit", handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  try {
    await state.auth.signInWithEmailAndPassword($("#loginEmail").value, $("#loginPassword").value);
    $("#loginModal").hidden = true;
    openAdmin();
  } catch (err) { toast(err.message, "error"); }
}

function openAdmin() { $("#adminPanel").hidden = false; }
async function persist(path, value) {
  if (value === null) await dbRef(path).remove();
  else await dbRef(path).set(value);
}

document.addEventListener("DOMContentLoaded", () => {
  // CORREÇÃO: Garante o estado inicial oculto do modal
  const m = $("#productModal");
  if (m) {
    m.hidden = true;
    m.setAttribute("aria-hidden", "true");
  }
  
  bindPublicEvents();
  renderAll();
  renderSlider();
  renderCategoryChips();
  renderProducts();
  initFirebase();
});
