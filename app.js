const scenes = [...window.GALLERY_SCENES];
const $ = selector => document.querySelector(selector);
const featuredId = document.body.dataset.featured;
const featured = scenes.find(scene => scene.id === featuredId) || scenes[0];
const grid = $("#gallery-grid");
const search = $("#search-input");
const region = $("#region-filter");
const dialog = $("#detail-dialog");
const detailImage = $("#detail-image");
const detailVideo = $("#detail-video");
const filmstrip = $("#detail-filmstrip");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let selectedId = null;
let motionPaused = false;
let closeTimer;
let toastTimer;

function asset(scene) { return scene.url || `assets/${scene.file}`; }
function isVideo(scene) { return scene.kind === "video"; }
function fileName(scene) { return scene.fileName || scene.file; }
function regionName(scene) { return scene.region.split(" · ")[0]; }
function normalize(value) { return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function isFiltering() { return Boolean(search.value.trim()) || region.value !== "all"; }
function matchingScenes() {
  const query = normalize(search.value.trim());
  return scenes.filter(scene => (region.value === "all" || regionName(scene) === region.value) && (!query || normalize(`${scene.name} ${scene.title} ${scene.region} ${scene.description}`).includes(query)));
}
function navigationScenes() { return matchingScenes(); }

function populateRegions() {
  const chosen = region.value;
  const names = [...new Set(scenes.map(regionName))].sort((a,b) => a.localeCompare(b,"es"));
  region.replaceChildren(new Option("Todas las regiones","all"));
  names.forEach(name => region.add(new Option(name,name)));
  region.value = names.includes(chosen) ? chosen : "all";
}

function renderGallery() {
  const filtered = isFiltering();
  const items = filtered ? matchingScenes() : scenes.filter(scene => scene.id !== featured.id);
  document.body.classList.toggle("is-filtering",filtered);
  grid.replaceChildren();
  items.forEach((scene,index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "wallpaper-card";
    card.style.setProperty("--delay",`${Math.min(index,8) * 35}ms`);
    card.setAttribute("aria-label",`Ver ${scene.title} de ${scene.name}`);
    const image = document.createElement(isVideo(scene) ? "video" : "img");
    image.src = asset(scene);
    if (isVideo(scene)) {
      image.muted = true;
      image.loop = true;
      image.playsInline = true;
      image.preload = "metadata";
      card.addEventListener("pointerenter",() => { if (!motionPaused && !reducedMotion.matches) image.play()?.catch?.(() => {}); });
      card.addEventListener("pointerleave",() => image.pause());
    } else {
      image.alt = "";
      image.loading = index < 4 ? "eager" : "lazy";
      image.decoding = "async";
    }
    const caption = document.createElement("span");
    caption.className = "card-caption";
    const area = document.createElement("small");
    area.textContent = scene.region;
    const title = document.createElement("strong");
    title.textContent = scene.title;
    const action = document.createElement("em");
    action.textContent = "Ver en grande ↗";
    caption.append(area,title,action);
    card.append(image,caption);
    card.addEventListener("click",() => openDetail(scene.id,card));
    card.addEventListener("pointermove",event => {
      if (motionPaused || reducedMotion.matches) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      card.style.setProperty("--pan-x",`${((event.clientX-rect.left)/rect.width-.5)*-5}px`);
      card.style.setProperty("--pan-y",`${((event.clientY-rect.top)/rect.height-.5)*-5}px`);
    });
    card.addEventListener("pointerleave",() => {
      card.style.setProperty("--pan-x","0px");
      card.style.setProperty("--pan-y","0px");
    });
    grid.append(card);
  });
  $("#result-count").textContent = filtered ? `${items.length} ${items.length === 1 ? "fondo" : "fondos"}` : `${scenes.length} fondos · 1 destacado`;
  $(".side-number").textContent = String(scenes.length);
  $(".hero-image-index").textContent = `${String(scenes.indexOf(featured)+1).padStart(2,"0")} / ${String(scenes.length).padStart(2,"0")}`;
  $("#empty-state").hidden = items.length > 0;
  $("#clear-button").hidden = !filtered;
}

function resetTone() {
  detailImage.style.setProperty("--tone-filter","none");
  detailVideo.style.setProperty("--tone-filter","none");
  document.querySelectorAll(".tone").forEach(button => {
    const active = button.dataset.tone === "original";
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  });
}

function showDetail(scene) {
  detailVideo.pause();
  if (dialog.open && selectedId !== scene.id && !motionPaused && !reducedMotion.matches) {
    const media = isVideo(scene) ? detailVideo : detailImage;
    media.classList.remove("swapping");
    void media.offsetWidth;
    media.classList.add("swapping");
  } else if (!dialog.open) { detailImage.classList.remove("swapping"); detailVideo.classList.remove("swapping"); }
  selectedId = scene.id;
  detailImage.hidden = isVideo(scene);
  detailVideo.hidden = !isVideo(scene);
  if (isVideo(scene)) {
    detailVideo.src = asset(scene);
    detailVideo.play()?.catch?.(() => {});
  } else {
    detailImage.src = asset(scene);
    detailImage.alt = scene.alt;
  }
  $("#detail-region").textContent = scene.region;
  $("#detail-title").textContent = scene.title;
  $("#detail-description").textContent = scene.description;
  $("#detail-download").href = asset(scene);
  $("#detail-download").download = fileName(scene);
  $("#remove-button").hidden = !scene.imported;
  const items = navigationScenes();
  const position = items.findIndex(item => item.id === scene.id);
  $("#detail-position").textContent = `${String(Math.max(position+1,1)).padStart(2,"0")} / ${String(items.length).padStart(2,"0")}`;
  $("#detail-prev").hidden = items.length < 2;
  $("#detail-next").hidden = items.length < 2;
  renderFilmstrip(items,scene.id);
  $("#apply-status").textContent = "";
  resetTone();
}

function renderFilmstrip(items,activeId) {
  filmstrip.replaceChildren();
  items.forEach(scene => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "film-thumb";
    thumb.setAttribute("aria-label",`Ver ${scene.title}`);
    thumb.setAttribute("aria-pressed",String(scene.id === activeId));
    if (scene.id === activeId) thumb.classList.add("active");
    if (isVideo(scene)) {
      thumb.dataset.video = "";
      thumb.title = scene.title;
    } else {
      const image = document.createElement("img");
      image.src = asset(scene);
      image.alt = "";
      image.loading = "lazy";
      thumb.append(image);
    }
    thumb.addEventListener("click",() => showDetail(scene));
    filmstrip.append(thumb);
  });
  filmstrip.querySelector(".active")?.scrollIntoView?.({block:"nearest",inline:"center"});
}

function openDetail(id,source = null) {
  const scene = scenes.find(item => item.id === id);
  if (!scene) return;
  clearTimeout(closeTimer);
  dialog.classList.remove("closing");
  showDetail(scene);
  if (!dialog.open) {
    const rect = source?.getBoundingClientRect();
    const x = rect ? Math.max(-330,Math.min(330,rect.left+rect.width/2-innerWidth/2)) : 0;
    const y = rect ? Math.max(-230,Math.min(230,rect.top+rect.height/2-innerHeight/2)) : 35;
    dialog.style.setProperty("--from-x",`${x}px`);
    dialog.style.setProperty("--from-y",`${y}px`);
    dialog.showModal();
    document.body.classList.add("modal-open");
    $("#detail-close").focus({preventScroll:true});
  }
}

function closeDetail(immediate = false) {
  if (!dialog.open) return;
  detailVideo.pause();
  clearTimeout(closeTimer);
  if (immediate || motionPaused || reducedMotion.matches) {
    dialog.classList.remove("closing");
    dialog.close();
    document.body.classList.remove("modal-open");
    return;
  }
  dialog.classList.add("closing");
  closeTimer = setTimeout(() => {
    dialog.close();
    dialog.classList.remove("closing");
    document.body.classList.remove("modal-open");
  },220);
}

function stepDetail(direction) {
  const items = navigationScenes();
  if (items.length < 2) return;
  const index = Math.max(0,items.findIndex(item => item.id === selectedId));
  showDetail(items[(index+direction+items.length)%items.length]);
}

function clearFilters() { search.value = ""; region.value = "all"; renderGallery(); }
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"),3600);
}
function titleFromFile(filename) { return filename.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').trim().replace(/\s+/g,' ').slice(0,46) || "Nuevo fondo"; }

function openGalleryDB() {
  return new Promise((resolve,reject) => {
    if (!("indexedDB" in window)) { reject(new Error("Sin almacenamiento local")); return; }
    const request = indexedDB.open("leyendas-gallery",1);
    request.onupgradeneeded = () => request.result.createObjectStore("wallpapers",{keyPath:"id"});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const dbPromise = openGalleryDB().catch(() => null);
async function saveImported(record) {
  const db = await dbPromise;
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction("wallpapers","readwrite");
    tx.objectStore("wallpapers").put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}
async function deleteImported(id) {
  const db = await dbPromise;
  if (!db) return;
  return new Promise(resolve => {
    const tx = db.transaction("wallpapers","readwrite");
    tx.objectStore("wallpapers").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
    tx.onabort = resolve;
  });
}
async function loadImported() {
  const db = await dbPromise;
  if (!db) return;
  const records = await new Promise(resolve => {
    const request = db.transaction("wallpapers","readonly").objectStore("wallpapers").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve([]);
  });
  records.forEach(record => {
    if (scenes.some(scene => scene.id === record.id)) return;
    scenes.push({id:record.id,name:record.name,title:record.title,region:"TU COLECCIÓN",description:record.kind === "video" ? "Tu fondo en movimiento." : "Un fondo que añadiste a la galería.",alt:record.title,fileName:record.fileName,url:URL.createObjectURL(record.blob),blob:record.blob,kind:record.kind,imported:true});
  });
  if (records.length) { populateRegions(); renderGallery(); }
}

$("#featured-image").src = asset(featured);
$("#featured-image").alt = featured.alt;
$("#hero-region").textContent = featured.region;
populateRegions();
renderGallery();
loadImported();
requestAnimationFrame(() => document.body.classList.add("is-ready"));

let progressFrame = 0;
function updateScrollProgress() {
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(() => {
    const distance = Math.max(1,document.documentElement.scrollHeight-innerHeight);
    const progress = Math.max(0,Math.min(1,scrollY/distance));
    $("#scroll-progress").style.setProperty("--progress",progress.toFixed(4));
    progressFrame = 0;
  });
}
window.addEventListener("scroll",updateScrollProgress,{passive:true});
window.addEventListener("resize",updateScrollProgress);
updateScrollProgress();
if ("IntersectionObserver" in window) {
  const reveal = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in-view");
      reveal.unobserve(entry.target);
    });
  },{threshold:.12});
  document.querySelectorAll(".catalog-heading,.catalog-tools").forEach(element => {
    element.classList.add("will-reveal");
    reveal.observe(element);
  });
}
document.addEventListener("visibilitychange",() => document.body.classList.toggle("page-hidden",document.hidden));
search.addEventListener("input",renderGallery);
region.addEventListener("change",renderGallery);
$("#clear-button").addEventListener("click",clearFilters);
$("#empty-reset").addEventListener("click",clearFilters);
$("#featured-open").addEventListener("click",() => openDetail(featured.id,$(".hero-art")));
$("#surprise-button").addEventListener("click",() => {
  let items = navigationScenes();
  if (!items.length) { clearFilters(); items = navigationScenes(); }
  const scene = items[Math.floor(Math.random()*items.length)];
  if (scene) openDetail(scene.id);
});
$("#motion-button").addEventListener("click",event => {
  motionPaused = !motionPaused;
  document.body.classList.toggle("motion-off",motionPaused);
  event.currentTarget.setAttribute("aria-pressed",String(motionPaused));
  event.currentTarget.setAttribute("aria-label",motionPaused ? "Activar movimiento" : "Pausar movimiento");
  event.currentTarget.textContent = motionPaused ? "◎" : "◉";
});
$("#detail-close").addEventListener("click",() => closeDetail());
$("#detail-prev").addEventListener("click",() => stepDetail(-1));
$("#detail-next").addEventListener("click",() => stepDetail(1));
dialog.addEventListener("click",event => { if (event.target === dialog) closeDetail(); });
dialog.addEventListener("cancel",event => { event.preventDefault(); closeDetail(); });
dialog.addEventListener("close",() => document.body.classList.remove("modal-open"));
dialog.addEventListener("keydown",event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); stepDetail(event.key === "ArrowRight" ? 1 : -1); }
});
let touchStart = null;
$(".detail-visual").addEventListener("touchstart",event => {
  const touch = event.changedTouches[0];
  touchStart = touch ? {x:touch.clientX,y:touch.clientY} : null;
},{passive:true});
$(".detail-visual").addEventListener("touchend",event => {
  const touch = event.changedTouches[0];
  if (!touchStart || !touch) return;
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.3) stepDetail(dx<0 ? 1 : -1);
},{passive:true});
const tones = {original:"none",warm:"sepia(.18) saturate(1.14) hue-rotate(-8deg)",cool:"hue-rotate(11deg) saturate(.86)",mono:"grayscale(.92) contrast(1.06)"};
document.querySelectorAll(".tone").forEach(button => button.addEventListener("click",() => {
  detailImage.style.setProperty("--tone-filter",tones[button.dataset.tone]);
  detailVideo.style.setProperty("--tone-filter",tones[button.dataset.tone]);
  document.querySelectorAll(".tone").forEach(other => {
    const active = other === button;
    other.classList.toggle("active",active);
    other.setAttribute("aria-pressed",String(active));
  });
}));
$("#remove-button").addEventListener("click",async () => {
  const index = scenes.findIndex(scene => scene.id === selectedId);
  const scene = scenes[index];
  if (!scene?.imported) return;
  closeDetail(true);
  await deleteImported(scene.id);
  URL.revokeObjectURL(scene.url);
  scenes.splice(index,1);
  selectedId = null;
  populateRegions();
  renderGallery();
  showToast("El fondo se quitó de tu colección.");
});
$("#import-button").addEventListener("click",() => $("#import-input").click());
$("#import-input").addEventListener("change",async event => {
  const files = [...event.currentTarget.files].filter(file => ["image/png","image/jpeg","image/webp","video/mp4","video/webm"].includes(file.type) && file.size <= 100 * 1024 * 1024);
  event.currentTarget.value = "";
  if (!files.length) return;
  const records = [];
  for (const file of files) {
    const id = `added-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const name = titleFromFile(file.name);
    const kind = file.type.startsWith("video/") ? "video" : "image";
    records.push({id,name,title:name,fileName:file.name,kind,blob:file});
    scenes.push({id,name,title:name,region:"TU COLECCIÓN",description:kind === "video" ? "Tu fondo en movimiento." : "Un fondo que añadiste a la galería.",alt:name,fileName:file.name,url:URL.createObjectURL(file),blob:file,kind,imported:true});
  }
  clearFilters();
  populateRegions();
  renderGallery();
  openDetail(scenes[scenes.length-1].id);
  const saved = await Promise.all(records.map(saveImported));
  showToast(saved.every(Boolean) ? `${files.length} ${files.length === 1 ? "fondo añadido" : "fondos añadidos"} a tu colección.` : "Fondo añadido para esta sesión. Consulta LEEME.md para guardarlo en el paquete.");
});

async function importPayload(scene) {
  let blob = scene.blob;
  let fileName = scene.fileName;
  if (/\.webp$/i.test(fileName)) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap,0,0);
    bitmap.close();
    blob = await new Promise(resolve => canvas.toBlob(resolve,"image/png"));
    if (!blob) throw new Error("No se pudo preparar esta imagen.");
    fileName = fileName.replace(/\.webp$/i,".png");
  }
  return {fileName,kind:scene.kind || "image",bytes:new Uint8Array(await blob.arrayBuffer())};
}

$("#detail-apply").addEventListener("click",async event => {
  const scene = scenes.find(item => item.id === selectedId);
  if (!scene) return;
  const status = $("#apply-status");
  status.replaceChildren();
  if (!window.desktopWallpaper) {
    status.append("Para aplicarlo directamente, abre Leyendas como aplicación. ");
    const link = document.createElement("a");
    link.href = "https://github.com/Cde571/leyendas-wallpapers/releases/download/v0.1.0/Leyendas-Portable.exe";
    link.textContent = "Descargar aplicación para Windows ↗";
    link.rel = "noopener noreferrer";
    status.append(link);
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  status.textContent = "Aplicando fondo…";
  try {
    const result = scene.imported
      ? await window.desktopWallpaper.applyImported(await importPayload(scene))
      : await window.desktopWallpaper.applyBundled(scene.file);
    status.textContent = result.message;
  } catch(error) {
    status.textContent = error?.message || "No se pudo aplicar el fondo.";
  } finally { button.disabled = false; }
});
