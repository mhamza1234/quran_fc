/* Quran Flashcards – no-build, ES modules */
const $ = (id) => document.getElementById(id);

const els = {
  surahSelect: $("surahSelect"),
  shuffleBtn: $("shuffleBtn"),
  card: $("card"),
  frontText: $("frontText"),
  backText: $("backText"),
  backLang: $("backLang"),
  frontLang: $("frontLang"),
  hint: $("hint"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  flipBtn: $("flipBtn"),
  counter: $("counter"),
  progressBar: $("progressBar"),
  surahMeta: $("surahMeta"),
};

const state = {
  manifest: null,
  cards: [],
  idx: 0,
  flipped: false,
  selectedKey: null, // file key
};

init().catch(err => {
  console.error(err);
  alert("Failed to initialize. Check console for details.");
});

async function init(){
  await loadManifest();
  buildDropdown();
  bindEvents();

  const last = localStorage.getItem("qf:last");
  if (last && els.surahSelect.querySelector(`option[value="${last}"]`)) {
    els.surahSelect.value = last;
  }
  await loadSelected(els.surahSelect.value);
}

async function loadManifest(){
  const res = await fetch("./data/manifest.json", {cache:"no-store"});
  if (!res.ok) throw new Error("manifest.json not found");
  state.manifest = await res.json();
}

function buildDropdown(){
  els.surahSelect.innerHTML = "";
  for (const item of state.manifest.surahs){
    const opt = document.createElement("option");
    // Label: "112 — Al-Ikhlāṣ (الإخلاص)"
    opt.value = item.file;
    opt.textContent = `${pad3(item.id)} — ${item.name_en}${item.name_ar ? " ("+item.name_ar+")" : ""}`;
    els.surahSelect.appendChild(opt);
  }
}

async function loadSelected(file){
  if (!file) return;
  const res = await fetch(`./data/${file}`, {cache:"no-store"});
  if (!res.ok) {
    alert(`Failed to load ${file}`);
    return;
  }
  const data = await res.json();

  // Normalize schema (defensive)
  const fc = Array.isArray(data.flashcards) ? data.flashcards : [];
  state.cards = fc.map(normalizeCard);
  state.idx = 0;
  state.flipped = false;
  state.selectedKey = file;
  localStorage.setItem("qf:last", file);

  els.surahMeta.textContent = buildSurahMeta(file, data.surah);
  render();
}

function normalizeCard(card){
  // Ensure required fields exist
  const front = card.front ?? {text:"", language:"ar"};
  const back = card.back ?? {text:"", language:"en-US"};
  const hint = card.hint ?? {text:"", language:"en-US"};
  return { front, back, hint };
}

function buildSurahMeta(fileName, surahTitle){
  const fromManifest = state.manifest.surahs.find(s => s.file === fileName);
  const id = fromManifest?.id ?? "—";
  const en = fromManifest?.name_en ?? surahTitle ?? "";
  const ar = fromManifest?.name_ar ?? "";
  return `${pad3(id)} — ${en}${ar? " · " + ar : ""}`;
}

function render(){
  if (!state.cards.length){
    els.frontText.textContent = "No cards";
    els.backText.textContent = "";
    els.hint.textContent = "";
    els.counter.textContent = "";
    els.progressBar.style.width = "0%";
    return;
  }
  const c = state.cards[state.idx];

  // Front
  els.frontText.textContent = c.front.text ?? "";
  els.frontLang.textContent = (c.front.language ?? "AR").toUpperCase().slice(0,2);

  // Back (preserve newlines)
  els.backText.textContent = c.back.text ?? "";
  els.backLang.textContent = (c.back.language ?? "EN").toUpperCase().slice(0,2);

  // Hint
  els.hint.textContent = c.hint?.text ?? "";

  // Progress + counter
  const total = state.cards.length;
  const pos = state.idx + 1;
  els.counter.textContent = `${pos} / ${total}`;
  els.progressBar.style.width = `${(pos/total)*100}%`;

  // Flip state
  setFlipped(state.flipped);
}

function setFlipped(on){
  state.flipped = !!on;
  els.card.classList.toggle("flipped", state.flipped);
  els.card.setAttribute("aria-pressed", state.flipped ? "true" : "false");
}

function next(){
  if (!state.cards.length) return;
  state.idx = (state.idx + 1) % state.cards.length;
  setFlipped(false);
  render();
}
function prev(){
  if (!state.cards.length) return;
  state.idx = (state.idx - 1 + state.cards.length) % state.cards.length;
  setFlipped(false);
  render();
}
function flip(){
  setFlipped(!state.flipped);
}

function shuffle(){
  // Fisher–Yates, stable relative to current index
  const arr = [...state.cards];
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Try to keep the same front text visible if possible
  const curr = state.cards[state.idx]?.front?.text;
  state.cards = arr;
  state.idx = Math.max(0, state.cards.findIndex(c => c.front?.text === curr));
  setFlipped(false);
  render();
}

function pad3(n){ return String(n).padStart(3,"0"); }

function bindEvents(){
  els.surahSelect.addEventListener("change", e => loadSelected(e.target.value));
  els.shuffleBtn.addEventListener("click", shuffle);
  els.nextBtn.addEventListener("click", next);
  els.prevBtn.addEventListener("click", prev);
  els.flipBtn.addEventListener("click", flip);
  els.card.addEventListener("click", flip);

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key.toLowerCase() === "f" || e.key === " ") { e.preventDefault(); flip(); }
  });

  // Touch swipe
  let startX = null;
  els.card.addEventListener("touchstart", (e) => { startX = e.changedTouches[0].clientX; }, {passive:true});
  els.card.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - (startX ?? 0);
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    else flip();
    startX = null;
  }, {passive:true});
}
