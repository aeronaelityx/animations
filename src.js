import * as T from 'three';
import { gsap } from 'gsap';
import { effects } from './effects';
import './style.css';

const byId = id => document.getElementById(id);
const stage = byId('stage');
const status = message => { byId('status').textContent = message; };
const scene = new T.Scene();
scene.background = new T.Color('#171423');
const camera = new T.PerspectiveCamera(40, 1, .1, 100);
camera.position.z = 8;
let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: true });
} catch {
  status('Activa WebGL 2 para abrir el escenario.');
  throw new Error('WebGL 2 no disponible');
}
stage.prepend(renderer.domElement);
const geometry = new T.PlaneGeometry(1, 1);
const bubbleGeometry = new T.CircleGeometry(.5, 64);
const particles = new Float32Array(480 * 3);
for (let i = 0; i < particles.length; i++) particles[i] = (Math.random() - .5) * 26;
const dust = new T.BufferGeometry();
dust.setAttribute('position', new T.BufferAttribute(particles, 3));
scene.add(new T.Points(dust, new T.PointsMaterial({ color: '#ad8cc3', size: .045, transparent: true, opacity: .5 })));
const cards = [];
const view = { cursor: 0, focus: 0, progress: 0 };
let selected = 0;
let busy = false;
let animation;
let spinning = false;
let lastFrame;
let layout = 'helix';
let spacing = 1;
let layerEffects = false;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ray = new T.Raycaster();

function dimensions() {
  return byId('ratio').value.split(',').map(Number);
}
function resize(full = false) {
  const [width, height] = dimensions();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const scale = Math.min((stage.clientWidth - 2) / width, (stage.clientHeight - 2) / height);
  renderer.setSize(full ? width : Math.max(2, Math.round(width * scale)), full ? height : Math.max(2, Math.round(height * scale)), false);
  renderer.domElement.style.width = Math.round(width * scale) + 'px';
  renderer.domElement.style.height = Math.round(height * scale) + 'px';
}
new ResizeObserver(() => { if (!busy) resize(); }).observe(stage);
byId('ratio').onchange = () => resize();

const mix = T.MathUtils.lerp;
function wrap(value, length) {
  return T.MathUtils.euclideanModulo(value, length);
}
function setSpinning(value) {
  spinning = value;
  byId('orbit').textContent = value ? 'Pausar recorrido' : 'Reproducir recorrido';
  byId('orbit').setAttribute('aria-pressed', String(value));
}
renderer.setAnimationLoop(time => {
  const delta = Math.min(.05, (time - (lastFrame ?? time)) / 1000);
  lastFrame = time;
  if (spinning && !busy && cards.length > 1) {
    view.cursor = wrap(view.cursor + delta / duration(), cards.length);
  }
  cards.forEach(({ mesh, aspect, effect, strength }, i) => {
    const half = cards.length / 2;
    const offset = wrap(i - view.cursor + half, cards.length) - half;
    const angle = offset * Math.min(1.6, 6.28 / Math.min(cards.length, 7));
    const edge = cards.length === 1 ? 1 : T.MathUtils.smoothstep(half - Math.abs(offset), 0, .48);
    const focus = i === selected ? view.focus : 0;
    const motion = effects[effect][1](view.progress, strength);
    const span = camera.aspect * 5.82;
    const step = offset * spacing;
    const bubble = layout === 'bubbles' && focus < .5;
    mesh.geometry = bubble ? bubbleGeometry : geometry;
    let x = step * Math.min(1.65, span * .4) + Math.sin(angle) * .38;
    let y = step * 1.02 - Math.sin(angle) * .18;
    let z = (Math.cos(angle) - 1) * 1.35;
    let rx = -.19;
    let ry = Math.sin(angle) * .88 - .24;
    let rz = .25;
    let galleryWidth = Math.min(2.5, span * .51, 2.25 * aspect);
    if (layout === 'slides') {
      x = offset * span * spacing;
      y = z = rx = ry = rz = 0;
      galleryWidth = Math.min(span * .94, 5.35 * aspect);
    } else if (layout === 'bubbles') {
      x = step * span * .3;
      y = Math.sin(offset * 1.55 + i * .8) * .94;
      z = Math.cos(offset * 1.35) * .64;
      rx = ry = rz = 0;
      galleryWidth = Math.min(2.15, span * .39) * (1 + Math.cos(i * 2.1) * .18);
    } else if (layout === 'wave') {
      x = step * span * .34;
      y = Math.sin(step * 1.13) * 1.03;
      z = Math.cos(step) * .55;
      rx = 0;
      ry = Math.sin(step) * .42;
      rz = Math.cos(step) * .13;
    }
    const phase = 1 - Math.min(1, Math.abs(offset));
    const orbitMotion = layerEffects ? effects[effect][1](phase, strength * .55) : {};
    const focusWidth = Math.min(4.65 * camera.aspect, 4.5 * aspect) * (motion.scale ?? 1);
    const width = mix(galleryWidth * (orbitMotion.scale ?? 1), focusWidth, focus);
    mesh.scale.set(width, bubble ? width : width / aspect, 1);
    mesh.position.set(
      mix(x + (orbitMotion.x ?? 0), motion.x ?? 0, focus),
      mix(y + (orbitMotion.y ?? 0), motion.y ?? 0, focus),
      mix(z + (orbitMotion.z ?? 0), (motion.z ?? 0) + .6, focus)
    );
    mesh.rotation.set(
      mix(rx + (orbitMotion.rx ?? 0), motion.rx ?? 0, focus),
      mix(ry + (orbitMotion.ry ?? 0), motion.ry ?? 0, focus),
      mix(rz + (orbitMotion.rz ?? 0), motion.rz ?? 0, focus)
    );
    const opacity = (layout === 'slides' && Math.abs(offset) < .95 ? 1 : edge) * (orbitMotion.opacity ?? 1);
    mesh.material.opacity = i === selected ? mix(opacity, motion.opacity ?? 1, focus) : opacity * (1 - view.focus * .8);
    mesh.visible = mesh.material.opacity > .005;
  });
  renderer.render(scene, camera);
});

effects.forEach(([label], i) => byId('effect').add(new Option(label, i)));
function refresh() {
  const card = cards[selected];
  byId('empty').hidden = Boolean(card);
  byId('selected').textContent = card ? (selected + 1) + ' / ' + cards.length + ' · ' + card.name : 'Ninguna imagen seleccionada';
  if (card) {
    byId('effect').value = card.effect;
    byId('strength').value = card.strength;
  }
  byId('film').replaceChildren(...cards.map((item, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = item.name;
    button.setAttribute('aria-current', String(i === selected));
    const image = new Image();
    image.src = item.url;
    image.alt = item.name;
    button.append(image);
    button.onclick = () => { if (!busy) select(i); };
    return button;
  }));
  for (const id of ['effect','strength','prev','next','play','orbit','remove','random','applyAll','export','webp']) {
    byId(id).disabled = !card || busy;
  }
}
function select(index, focus = true) {
  if (!cards.length) return;
  animation?.kill();
  setSpinning(false);
  selected = wrap(index, cards.length);
  const half = cards.length / 2;
  const cursor = view.cursor + wrap(selected - view.cursor + half, cards.length) - half;
  animation = gsap.to(view, { cursor, focus: Number(focus), progress:0, duration:reduceMotion.matches ? 0 : .65, ease:'power3.out' });
  refresh();
}
function randomize() {
  const order = effects.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  cards.forEach((card, i) => { card.effect = order[i]; });
  refresh();
}
function toWebP(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob?.type === 'image/webp' ? resolve(blob) : reject(new Error('Este navegador no codifica WebP.')), 'image/webp', .92);
  });
}
async function addImage(source, name) {
  let url = URL.createObjectURL(source);
  let image = new Image();
  let blob;
  try {
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    blob = await toWebP(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
  url = URL.createObjectURL(blob);
  image = new Image();
  image.src = url;
  try { await image.decode(); }
  catch (error) { URL.revokeObjectURL(url); throw error; }
  const texture = new T.Texture(image);
  texture.colorSpace = T.SRGBColorSpace;
  texture.needsUpdate = true;
  const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({map:texture, side:T.DoubleSide, transparent:true}));
  scene.add(mesh);
  const available = effects.map((_, i) => i).filter(i => !cards.some(card => card.effect === i));
  cards.push({name, url, mesh, aspect:image.width/image.height, effect:available[Math.floor(Math.random()*available.length)] ?? 0, strength:.75});
}
function lock(value) {
  busy = value;
  for (const id of ['files','demo','demoSet','ratio','duration','scope','layout','spacing','layerEffects']) byId(id).disabled = value;
  refresh();
}
async function importImages(files) {
  if (busy || !files.length) return;
  lock(true);
  const batch = Array.from(files).slice(0, 20 - cards.length);
  const failures = [];
  try {
    for (const file of batch) {
      status('Convirtiendo ' + file.name + '…');
      try {
        let source = file;
        if (/\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
          const { heicTo } = await import('heic-to');
          source = await heicTo({blob:file,type:'image/png'});
        }
        await addImage(source, file.name);
      } catch (error) { failures.push(file.name + ' (' + error.message + ')'); }
    }
  } finally {
    lock(false);
    if (cards.length && !reduceMotion.matches) startOrbit();
    else select(selected, false);
    status([batch.length - failures.length + ' importadas', files.length > batch.length ? 'Máximo 20 tarjetas' : '', failures.length ? 'Fallaron ' + failures.join(', ') : ''].filter(Boolean).join(' · '));
  }
}
byId('files').onchange = e => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  void importImages(files);
};
stage.ondragover = e => { e.preventDefault(); stage.classList.add('drag'); };
stage.ondragleave = () => stage.classList.remove('drag');
stage.ondrop = e => { e.preventDefault(); stage.classList.remove('drag'); void importImages(e.dataTransfer.files); };
byId('demo').onclick = () => {
  const set = byId('demoSet').value;
  const names = {
    orbital:['Ópalo','Umbral','Marea','Ascua','Niebla','Prisma'],
    terrain:['Duna','Aurora','Sierra','Cañón','Isla','Cordillera','Estuario','Cumbre'],
    signal:['Eco','Pulso','Ruido','Trama','Vector','Frecuencia','Rebote','Espectro']
  }[set];
  const files = names.map((name, i) => {
    const hue = (set === 'terrain' ? 190 : set === 'signal' ? 285 : 32) + i * 48;
    const art = Array.from({length:14}, (_, j) => {
      if (set === 'terrain') {
        const y = 230 + j * 29;
        return '<path d="M-20 '+ y +' Q180 '+ (y-180) +' 390 '+ (y-30) +' T920 '+ (y-115) +'" />';
      }
      if (set === 'signal') {
        const size = 60 + j * 28;
        return '<rect x="'+ (450-size/2) +'" y="'+ (330-size/2) +'" width="'+ size +'" height="'+ size +'" transform="rotate('+ (i*18+j*7) +' 450 330)"/>';
      }
      return '<ellipse cx="450" cy="330" rx="'+ (80+j*16) +'" ry="'+ (70+j*8) +'" transform="rotate('+ (i*22+j*8) +' 450 330)"/>';
    }).join('');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700"><defs><radialGradient id="g"><stop stop-color="hsl(' + hue + ',65%,54%)"/><stop offset="1" stop-color="#161220"/></radialGradient></defs><rect width="900" height="700" fill="url(#g)"/><g stroke="#fff" opacity=".5" fill="none">' + art + '</g><text x="48" y="643" fill="white" font-size="52" font-family="serif">' + name + '</text></svg>';
    return new File([svg], name + '.svg', {type:'image/svg+xml'});
  });
  void importImages(files);
};
byId('prev').onclick = () => select(selected - 1, false);
byId('next').onclick = () => select(selected + 1, false);
function startOrbit() {
  animation?.kill();
  Object.assign(view, {focus:0, progress:0});
  setSpinning(true);
}
byId('orbit').onclick = () => {
  if (spinning) setSpinning(false);
  else startOrbit();
};
byId('effect').onchange = e => { cards[selected].effect = Number(e.target.value); select(selected); };
byId('strength').oninput = e => { cards[selected].strength = Number(e.target.value); };
byId('random').onclick = () => {
  randomize();
  status('Efectos asignados al azar sin repetir.');
};
byId('applyAll').onclick = () => {
  const effect = Number(byId('effect').value);
  cards.forEach(card => { card.effect = effect; });
  status('Efecto aplicado a todas las imágenes.');
};
byId('layout').onchange = e => {
  layout = e.target.value;
  if (reduceMotion.matches) select(selected, false);
  else if (cards.length) startOrbit();
};
byId('spacing').oninput = e => { spacing = Number(e.target.value); };
byId('layerEffects').onchange = e => { layerEffects = e.target.checked; };
byId('remove').onclick = () => {
  const [card] = cards.splice(selected, 1);
  scene.remove(card.mesh);
  card.mesh.material.map.dispose();
  card.mesh.material.dispose();
  URL.revokeObjectURL(card.url);
  selected = Math.max(0, Math.min(selected, cards.length - 1));
  select(selected, false);
  refresh();
};
stage.addEventListener('wheel', e => {
  if (busy || !cards.length || Math.abs(e.deltaY) < 6) return;
  e.preventDefault();
  if (performance.now() - lastWheel < 230) return;
  lastWheel = performance.now();
  select(Math.round(view.cursor) + Math.sign(e.deltaY), false);
}, {passive:false});
let lastWheel = -Infinity;
let startX = null;
const canvas = renderer.domElement;
canvas.onpointerdown = e => { if (!busy) { startX = e.clientX; canvas.setPointerCapture(e.pointerId); } };
canvas.onpointercancel = () => { startX = null; };
canvas.onpointerup = e => {
  if (busy || startX === null) return;
  const delta = e.clientX - startX;
  startX = null;
  if (Math.abs(delta) > 20) { select(Math.round(view.cursor) - Math.sign(delta), false); return; }
  const bounds = canvas.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2((e.clientX-bounds.left)/bounds.width*2-1, 1-(e.clientY-bounds.top)/bounds.height*2), camera);
  const hit = ray.intersectObjects(cards.map(card => card.mesh).filter(mesh => mesh.visible))[0];
  if (hit) select(cards.findIndex(card => card.mesh === hit.object));
};
function duration() { return Math.max(1, Math.min(12, Number(byId('duration').value) || 3)); }
function clip(timeline, index, seconds) {
  const transition = Math.min(.42, seconds * .28);
  timeline.set(view, {focus:0, progress:0, onComplete:() => { selected = index; }});
  timeline.to(view, {cursor:index, focus:1, duration:transition, ease:'power2.inOut'});
  timeline.to(view, {progress:1, duration:seconds-transition, ease:'none'});
}
byId('play').onclick = () => {
  setSpinning(false);
  animation?.kill();
  animation = gsap.timeline();
  clip(animation, selected, duration());
};
function download(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}
byId('webp').onclick = () => download(cards[selected].url, cards[selected].name.replace(/\.[^.]+$/, '') + '.webp');
byId('export').onclick = async () => {
  const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type => window.MediaRecorder?.isTypeSupported(type));
  if (!mime || !canvas.captureStream) { status('Este navegador no graba WebM. Prueba Chrome o Edge.'); return; }
  const previous = selected;
  const wasSpinning = spinning;
  const helix = byId('scope').value === 'helix';
  if (helix && cards.length < 2) { status('Importa al menos dos imágenes para exportar el recorrido.'); return; }
  const indices = byId('scope').value === 'one' ? [selected] : cards.map((_, i) => i);
  const seconds = duration();
  lock(true);
  animation?.kill();
  let stream;
  let recorder;
  try {
    resize(true);
    Object.assign(view, {cursor:indices[0],focus:0,progress:0});
    renderer.render(scene,camera);
    stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000});
    const chunks = [];
    const result = new Promise((resolve,reject) => {
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks,{type:'video/webm'}));
      recorder.onerror = e => reject(e.error ?? new Error('Falló la grabación.'));
    });
    recorder.start();
    animation = gsap.timeline({
      onUpdate:() => status('Grabando WebM · ' + Math.round(animation.progress()*100) + '%'),
      onComplete:() => { if (recorder.state !== 'inactive') recorder.stop(); }
    });
    if (helix) animation.to(view, {cursor:indices.length, duration:seconds * indices.length, ease:'none'});
    else indices.forEach(index => clip(animation,index,seconds));
    const blob = await result;
    if (!blob.size) throw new Error('El video salió vacío.');
    const url = URL.createObjectURL(blob);
    download(url,'aelityx-motion.webm');
    setTimeout(() => URL.revokeObjectURL(url),60_000);
    status('WebM listo.');
  } catch (error) {
    status(error.message);
  } finally {
    animation?.kill();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    resize();
    lock(false);
    if (wasSpinning) { selected = previous; refresh(); startOrbit(); }
    else select(previous,false);
  }
};
refresh();
