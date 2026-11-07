import {cameraDefaults,moveCamera,floatMotion,depthGeometry} from './cinematic';
import * as T from 'three';
import { gsap } from 'gsap';
import { effects } from './effects';
import { createCardSurface, createUnfoldGeometry, ribbonPose, unfoldPose } from './gallery';
import { materiaDemo } from './materia';
import { paintCaption } from './caption';
import { collagePose, createPoolScene } from './collages';
import './style.css';

const byId = id => document.getElementById(id);
const stage = byId('stage');
const status = message => { byId('status').textContent = message; };
const scene = new T.Scene();
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
const defaultCamera = {...cameraDefaults};
const cameraFields = ['fov','distance','radius','targetX','targetY','depth','frequency'];
const unfoldGeometry = createUnfoldGeometry();
const particles = new Float32Array(480 * 3);
for (let i = 0; i < particles.length; i++) particles[i] = (Math.random() - .5) * 26;
const dust = new T.BufferGeometry();
dust.setAttribute('position', new T.BufferAttribute(particles, 3));
const stars = new T.Points(dust, new T.PointsMaterial({color:'#ad8cc3',size:.045,transparent:true,opacity:.5}));
scene.add(stars);
const pool = createPoolScene(scene);
const backdrop = document.createElement('canvas');
backdrop.width = backdrop.height = 256;
const backdropMap = new T.CanvasTexture(backdrop);
backdropMap.colorSpace = T.SRGBColorSpace;
function updateBackground() {
  const color = byId('background').value;
  const finish = byId('finish').value;
  stars.visible = finish === 'space';
  if (finish === 'flat') {
    scene.background = new T.Color(color);
    return;
  }
  const ctx = backdrop.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0,0,256,256);
  const light = ctx.createRadialGradient(169, 86, 0, 169, 86, 172);
  const tint = finish === 'studio' ? '157,131,220' : '116,105,219';
  light.addColorStop(0, 'rgba(' + tint + ',.25)');
  light.addColorStop(1, 'rgba(' + tint + ',0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 256, 256);
  const falloff = ctx.createRadialGradient(130, 116, 68, 130, 116, 191);
  falloff.addColorStop(0, 'rgba(0,0,0,0)');
  falloff.addColorStop(1, 'rgba(0,0,0,.6)');
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, 256, 256);
  backdropMap.needsUpdate = true;
  scene.background = backdropMap;
}
byId('background').oninput = updateBackground;
byId('finish').onchange = updateBackground;
updateBackground();

const captionCanvas = document.createElement('canvas');
captionCanvas.width = 1024;
captionCanvas.height = 512;
const captionMap = new T.CanvasTexture(captionCanvas);
captionMap.colorSpace = T.SRGBColorSpace;
const caption = new T.Sprite(new T.SpriteMaterial({map:captionMap,transparent:true,depthTest:false,depthWrite:false}));
caption.renderOrder = 20;
scene.add(caption);
let captionKey;
let captionPixels = 128;
const textControls = ['font','align','titleSize','detailSize','titleColor','detailColor','captionColor','captionPosition'];
function updateCaption(card, alpha, placement) {
  caption.visible = Boolean(byId('showCaption').checked && card && alpha > .01);
  if (!caption.visible) return 0;

  const settings = textControls.map(id => byId(id).value);
  const [font, align, titleSize, detailSize, titleColor, detailColor, background, position] = settings;
  const title = card.title.trim() || card.name;
  const width = Math.min(4.6, camera.aspect * 4.9);
  const maxHeight = Math.min(captionCanvas.height, Math.floor(5.82 * .29 * captionCanvas.width / width));
  const key = JSON.stringify([title, card.detail, maxHeight, ...settings]);
  if (key !== captionKey) {
    captionPixels = paintCaption(captionCanvas, title, card.detail, {
      font, align, titleColor, detailColor, background,
      titleSize: T.MathUtils.clamp(Number(titleSize) || 58, 28, 80),
      detailSize: T.MathUtils.clamp(Number(detailSize) || 34, 18, 46)
    }, maxHeight);
    // Keep the GPU texture size fixed and sample only the painted portion.
    captionMap.repeat.y = captionPixels / captionCanvas.height;
    captionMap.offset.y = 1 - captionMap.repeat.y;
    captionMap.needsUpdate = true;
    captionKey = key;
  }

  const height = width * captionPixels / captionCanvas.width;
  const fit = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) / Math.tan(T.MathUtils.degToRad(20));
  caption.scale.set(width * fit, height * fit, 1);
  caption.position.set(0, (2.69 - height / 2) * ((placement ?? position) === 'top' ? 1 : -1) * fit, -8);
  caption.position.applyQuaternion(camera.quaternion).add(camera.position);
  caption.material.opacity = alpha;
  return height;
}
const cards = [];
const view = { cursor: 0, focus: 0, progress: 0 };
let selected = 0;
let busy = false;
let animation;
let spinning = false;
let tourPaused = false;
let lastFrame;
let layout = byId('layout').value;
const flowLayouts = new Set(['radiant', 'bubbles', 'collage']);
let spacing = 1.35;
const spotlightPreference = new Map();
let layerEffects = byId("layerEffects").checked;
let recordingTour = false;
const tour = {position:0};
const smooth = (value,min,max) => T.MathUtils.smoothstep(value,min,max);
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
const bubbleTarget = new T.Vector3();
function usesVerticalThirds() {
  return byId('ratio').value === '1080,1920';
}
byId('bubbleSize').oninput = event => {
  byId('bubbleSizeValue').textContent = event.target.value + ' %';
};
function fitFocus(imageAspect, motion, z, fraction, third, captionHeight, captionPlacement) {
  const depth = Math.max(1, camera.position.length() - T.MathUtils.clamp(z, -.8, 1.3));
  const fit = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
  const halfHeight = depth * fit;
  const halfWidth = halfHeight * camera.aspect;
  const reserve = captionHeight * depth / 8 * fit / Math.tan(T.MathUtils.degToRad(20));
  const top = halfHeight * .97 - (captionPlacement === 'top' ? reserve : 0);
  const bottom = -halfHeight * .97 + (captionPlacement === 'bottom' ? reserve : 0);
  const availableWidth = Math.min(2 * halfWidth, (top - bottom) * imageAspect);
  const width = availableWidth * Math.min(.98, fraction * (motion.scale ?? 1));
  const radiusY = width / imageAspect / 2;
  const roomX = Math.max(0, halfWidth * .99 - width / 2);
  const center = third === 'top' ? 2 / 3 : third === 'bottom' ? -2 / 3 : 0;
  bubbleTarget.set(
    T.MathUtils.clamp(motion.x ?? 0, -roomX, roomX),
    T.MathUtils.clamp(halfHeight * center + (motion.y ?? 0), bottom + radiusY, top - radiusY),
    -depth
  ).applyQuaternion(camera.quaternion).add(camera.position);
  return { width, x: bubbleTarget.x, y: bubbleTarget.y, z: bubbleTarget.z };
}
function updateThirdControl() {
  byId('bubbleThirdControl').hidden = !usesVerticalThirds();
}
byId('ratio').onchange = () => {
  resize();
  updateThirdControl();
};

const mix = T.MathUtils.lerp;
function wrap(value, length) {
  return T.MathUtils.euclideanModulo(value, length);
}
function setSpinning(value) {
  spinning = value;
  byId('orbit').textContent = value ? 'Pausar recorrido' : 'Reproducir recorrido';
  byId('orbit').setAttribute('aria-pressed', String(value));
}
function tourCursor(position, featuredTour = layerEffects) {
  if (!featuredTour) return position;
  if (flowLayouts.has(layout)) return position - .5;
  const turn = Math.floor(position);
  return turn + smooth(position - turn, .72, 1);
}
function tourAvailable() {
  return cards.length > 1 || (cards.length === 1 &&
    (layout === 'collage' || layout === 'pool' || (layout === 'bubbles' && layerEffects)));
}
function currentCardIndex() {
  if (!spinning) return selected;
  return layout === 'pool' ? Math.floor(tour.position) : Math.round(tourCursor(tour.position));
}
function orientPath(x, y, aspect, direction) {
  if (direction === 'right') return [-x, y];
  if (direction === 'down') return [-y * aspect, x / aspect];
  if (direction === 'up') return [y * aspect, -x / aspect];
  return [x, y];
}
function drawFrame(time) {
  const delta = T.MathUtils.clamp((time - (lastFrame ?? time)) / 1000, 0, .05);
  lastFrame = time;
  if (spinning && !busy && tourAvailable()) {
    tour.position = wrap(tour.position + delta / duration(), cards.length);
  }
  const touring = (spinning && !busy || recordingTour) && tourAvailable();
  const turn = Math.floor(tour.position);
  const beat = tour.position - turn;
  const spotlight = touring && layerEffects;
  const isPool = layout === 'pool';
  const featured = spotlight || (touring && isPool) ? wrap(turn,cards.length) : selected;
  const emphasis = spotlight ? smooth(beat,.12,.32) * (1 - smooth(beat,.73,.94)) : touring ? 0 : view.focus;
  const cursor = touring ? tourCursor(tour.position) : view.cursor;
  const progress = spotlight ? smooth(beat,.2,.93) : view.progress;
  const active = cards[featured];
  moveCamera(camera,active?.cinema ?? defaultCamera,progress,!isPool && active?.engine !== 'preset' ? emphasis : 0,featured);
  const thirds = usesVerticalThirds();
  const third = thirds ? byId('bubbleThird').value : 'center';
  const fraction = Number(byId('bubbleSize').value) / 100;
  const direction = byId('direction').value;
  const captionPosition = byId('captionPosition').value;
  const captionPlacement = thirds && third === captionPosition
    ? (third === 'top' ? 'bottom' : 'top') : captionPosition;
  if (isPool) {
    const phase = touring ? beat : view.progress;
    const followsTour = touring || tourPaused;
    const animated = followsTour || view.progress > 0;
    const assembly = animated ? smooth(phase, .08, .41) * (1 - smooth(phase, .76, 1)) : view.focus;
    const alpha = (followsTour || (busy && animated)) && cards.length > 1
      ? smooth(phase, 0, .13) * (1 - smooth(phase, .86, 1)) : 1;
    const flow = (followsTour ? tour.position / Math.max(1, cards.length) : phase) * Math.PI * 2;
    const captionHeight = updateCaption(active, smooth(assembly, .58, .94) * alpha, captionPlacement);
    const motion = active && layerEffects ? sampleMotion(active, smooth(phase, .28, .85)) : {};
    cards.forEach(card => {
      card.mesh.visible = false;
      for (const layer of Object.values(card.layers)) layer.visible = false;
    });
    pool.draw({
      card: active, aspect: camera.aspect, phase, flow, assembly, alpha, spacing, captionHeight,
      fit: active && fitFocus(active.aspect, motion, .15, fraction, third, captionHeight, captionPlacement),
      orient: (x, y) => orientPath(x, y, active.aspect, direction),
      motion, background: byId('background').value
    });
    renderer.render(scene, camera);
    return;
  }

  pool.hide();
  const captionHeight = updateCaption(active, layout === 'bubbles' ? smooth(emphasis, .57, .93) : emphasis, captionPlacement);
  cards.forEach((card, i) => {
    const { mesh, surface, aspect, strength, engine, cinema } = card;
    const half = cards.length / 2;
    const offset = cards.length === 1 ? 0 : wrap(i - cursor + half, cards.length) - half;
    const angle = offset * Math.min(1.6, 6.28 / Math.min(cards.length, 7));
    const edge = cards.length === 1 ? 1 : T.MathUtils.smoothstep(half - Math.abs(offset), 0, .48);
    const focus = i === featured ? emphasis : 0;
    const motion = engine === 'float' ? floatMotion(progress,strength,cinema.frequency,i) : engine === 'preset' ? sampleMotion(card,progress) : {};
    const immersive = focus > 0 && engine !== 'preset';
    const layered = immersive && engine === 'layers';
    const bubble = layout === 'bubbles';
    const radiant = layout === 'radiant';
    const { orb, curl } = bubble ? unfoldPose(focus) : { orb: 0, curl: 0 };
    const parallax = engine === 'depth' || engine === 'layers';
    const mapped = immersive && engine === 'depth' && card.depthMesh && (!bubble || orb === 0);
    const renderAspect = bubble ? (parallax ? mix(1, aspect, 1 - orb) : 1) : aspect;
    mesh.geometry = mapped ? card.depthMesh : unfoldGeometry;
    mesh.morphTargetInfluences[0] = orb;
    mesh.morphTargetInfluences[1] = curl;
    surface.cardOrb.value = orb;
    surface.cardRound.value = Number(radiant || bubble);
    surface.cardAspect.value = renderAspect;
    surface.cardMatte.value = Number(bubble && !parallax);
    surface.cardPaper.value = Number(layout === 'collage');

    const span = camera.aspect * 5.82;
    const step = offset * spacing;
    let x = step * Math.min(1.65, span * .4) + Math.sin(angle) * .38;
    let y = step * 1.02 - Math.sin(angle) * .18;
    let z = (Math.cos(angle) - 1) * 1.35;
    let rx = -.19;
    let ry = Math.sin(angle) * .88 - .24;
    let rz = .25;
    let galleryWidth = Math.min(2.5, span * .51, 2.25 * aspect);
    let galleryOpacity = edge;
    if (layout === 'collage') {
      const pose = collagePose(i, cursor, cards.length, spacing, camera.aspect, aspect);
      ({ x, y, z, rx, ry, rz } = pose);
      galleryWidth = pose.width;
      galleryOpacity = pose.opacity;
    } else if (radiant) {
      const pose = ribbonPose(offset, spacing, camera.aspect, aspect);
      ({ x, y, z, rx, ry, rz } = pose);
      galleryWidth = pose.width;
    } else if (layout === 'helix') {
      const depth = offset + half;
      const radius = Math.exp(-depth * .32 / spacing);
      const theta = offset * 2.4 + cursor * (Math.PI * 2 / cards.length);
      x = Math.cos(theta) * Math.min(span * .40,3.2) * radius;
      y = Math.sin(theta) * 2.24 * radius;
      z = -depth * 1.1;
      rx = -.12;
      ry = Math.sin(theta) * .30;
      rz = Math.cos(theta) * .21;
      galleryWidth = Math.min(span * .28,1.67 * aspect,1.72) * Math.pow(radius,.55);
    } else if (layout === 'slides') {
      x = offset * span * spacing;
      y = z = rx = ry = rz = 0;
      galleryWidth = Math.min(span * .94, 5.35 * aspect);
    } else if (layout === 'bubbles') {
      x = step * span * .275;
      y = Math.sin(offset * 1.48 + i * .82) * 1.12 - .08;
      z = Math.cos(offset * 1.31) * .53 - Math.abs(offset) * .24;
      rx = -.09;
      ry = Math.sin(offset * .9) * .18;
      rz = Math.sin(offset * 1.12 + i * .5) * .11;
      galleryWidth = Math.min(2.05, span * .37) * (1 + Math.cos(i * 2.1) * .12);
    } else if (layout === 'wave') {
      x = step * span * .34;
      y = Math.sin(step * 1.13) * 1.03;
      z = Math.cos(step) * .55;
      rx = 0;
      ry = Math.sin(step) * .42;
      rz = Math.cos(step) * .13;
    }
    [x, y] = orientPath(x, y, camera.aspect, direction);
    const target = focus > 0
      ? fitFocus(renderAspect, motion, (motion.z ?? 0) + .42, fraction, third, captionHeight, captionPlacement)
      : null;
    const width = target ? mix(galleryWidth, target.width, focus) : galleryWidth;
    mesh.scale.set(width, width / renderAspect, 1);
    mesh.position.set(
      target ? mix(x, target.x, focus) : x,
      target ? mix(y, target.y, focus) : y,
      target ? mix(z, target.z, focus) : z
    );
    mesh.rotation.set(
      mix(rx, motion.rx ?? 0, focus),
      mix(ry, motion.ry ?? 0, focus),
      mix(rz, motion.rz ?? 0, focus)
    );
    surface.cardSheen.value = .66 + mesh.rotation.y * .18;
    const ribbonFade = radiant ? 1 - .38 * smooth(Math.abs(offset), 1.2, 3.25) : 1;
    const opacity = (layout === 'slides' && Math.abs(offset) < .95 ? 1 : galleryOpacity) * ribbonFade;
    mesh.renderOrder = focus > .01 ? 1 : 0;
    mesh.material.opacity = i === featured ? mix(opacity, motion.opacity ?? 1, focus) : opacity * (1 - emphasis * (layout === "helix" ? .94 : .72));
    mesh.visible = mesh.material.opacity > .005;
    if (mapped) mesh.scale.z = cinema.depth * focus * (bubble ? smooth(focus, .91, 1) : 1);
    for (const [name, layer] of Object.entries(card.layers)) {
      layer.visible = Boolean(layered);
      if (!layer.visible) continue;
      const depth = (name === 'foreground' ? 1 : .52) * cinema.depth * focus;
      const size = 1 - depth / Math.max(4,camera.position.z - mesh.position.z);
      layer.position.copy(mesh.position);
      layer.position.z += depth + .005;
      layer.scale.copy(mesh.scale).multiplyScalar(size);
      layer.material.opacity = mesh.material.opacity * (bubble ? smooth(focus, .91, 1) : focus);
    }
  });
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(drawFrame);

const motionDefaults = {x:0,y:0,z:0,rx:0,ry:0,rz:0,scale:1,opacity:1};
function sampleMotion(card,t) {
  if (!card.frames) return effects[card.effect][1](t,card.strength);
  const end = card.frames.findIndex(frame => frame.t >= t);
  if (end <= 0) return card.frames[end === 0 ? 0 : card.frames.length - 1];
  const left = card.frames[end - 1];
  const right = card.frames[end];
  const weight = (t - left.t) / (right.t - left.t);
  return Object.fromEntries(Object.entries(motionDefaults).map(([key,value]) => [key,mix(left[key] ?? value,right[key] ?? value,weight)]));
}
function syncCode(card) {
  byId('presetSource').value = card ? effects[card.effect][1].toString() : '';
  const frames = card?.frames ?? (card ? Array.from({length:9},(_,i) => {
    const t = i / 8;
    const values = effects[card.effect][1](t,card.strength);
    return {t,...Object.fromEntries(Object.entries(values).map(([key,value]) => [key,Number(value.toFixed(3))]))};
  }) : []);
  byId('motionCode').value = '[\n' + frames.map(frame => '  ' + JSON.stringify(frame)).join(',\n') + '\n]';
}
byId('applyCode').onclick = () => {
  try {
    const frames = JSON.parse(byId('motionCode').value);
    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 120 || frames[0]?.t !== 0 || frames.at(-1)?.t !== 1 || frames.some((frame,i) =>
      !frame || Array.isArray(frame) || typeof frame !== 'object' || !Number.isFinite(frame.t) || (i > 0 && frame.t <= frames[i-1].t) ||
      Object.entries(frame).some(([key,value]) => !Number.isFinite(value) || (key !== 't' && (!Object.hasOwn(motionDefaults,key) || Math.abs(value) > 8)) || (key === 'scale' && value <= 0) || (key === 'opacity' && (value < 0 || value > 1))
    ))) throw new Error('Usa de 2 a 120 fotogramas ordenados, desde t=0 hasta t=1, con valores válidos.');
    cards[selected].frames = frames;
    byId('codeStatus').textContent = 'Código aplicado a esta imagen.';
    byId('play').click();
  } catch (error) {
    byId('codeStatus').textContent = error instanceof SyntaxError ? 'Revisa la sintaxis JSON.' : error.message;
  }
};
byId('resetCode').onclick = () => {
  delete cards[selected].frames;
  syncCode(cards[selected]);
  byId('codeStatus').textContent = 'Preset restaurado.';
};
effects.forEach(([label], i) => byId('effect').add(new Option(label, i)));
let draggedCard;
function refresh() {
  draggedCard = null;
  const card = cards[selected];
  syncCode(card);
  byId('empty').hidden = Boolean(card);
  byId('selected').textContent = card ? (selected + 1) + ' / ' + cards.length + ' · ' + card.name : 'Ninguna imagen seleccionada';
  if (card) {
    byId('engine').value = card.engine;
    byId('cameraMode').value = card.cinema.mode;
    cameraFields.forEach(id => { byId(id).value = card.cinema[id]; });
    byId('layerInputs').hidden = card.engine !== 'layers';
    byId('depthInput').hidden = card.engine !== 'depth';
    byId('cardTitle').value = card.title;
    byId('cardDetail').value = card.detail;
    byId('effect').value = card.effect;
    byId('strength').value = card.strength;
  }
  byId('filmTools').hidden = cards.length < 2;
  byId('moveEarlier').disabled = busy || selected === 0;
  byId('moveLater').disabled = busy || selected >= cards.length - 1;
  byId('film').replaceChildren(...cards.map((item, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = item.name;
    button.setAttribute('aria-current', String(i === selected));
    const image = new Image();
    image.src = item.url;
    image.alt = '';
    image.draggable = false;
    button.disabled = busy;
    button.draggable = !busy && cards.length > 1;
    button.setAttribute('aria-label', (i + 1) + '. ' + item.name);
    const number = document.createElement('span');
    number.className = 'film-number';
    number.textContent = i + 1;
    number.setAttribute('aria-hidden', 'true');
    button.append(image, number);
    button.onclick = () => { if (!busy) select(i); };
    button.ondragstart = event => {
      if (busy || !button.draggable) { event.preventDefault(); return; }
      draggedCard = item;
      event.dataTransfer.setData('text/plain', item.name);
      event.dataTransfer.effectAllowed = 'move';
      button.classList.add('film-dragging');
    };
    button.ondragend = () => {
      draggedCard = null;
      button.classList.remove('film-dragging');
      byId('film').querySelector('[data-drop]')?.removeAttribute('data-drop');
    };
    button.ondragover = event => {
      if (!draggedCard || draggedCard === item || busy) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const box = button.getBoundingClientRect();
      button.dataset.drop = event.clientX < box.left + box.width / 2 ? 'before' : 'after';
    };
    button.ondragleave = event => {
      if (!button.contains(event.relatedTarget)) delete button.dataset.drop;
    };
    button.ondrop = event => {
      if (!draggedCard || busy) return;
      event.preventDefault();
      const from = cards.indexOf(draggedCard);
      const box = button.getBoundingClientRect();
      const boundary = i + Number(event.clientX >= box.left + box.width / 2);
      draggedCard = null;
      delete button.dataset.drop;
      moveImage(from, boundary - Number(from < boundary));
    };
    return button;
  }));
  for (const id of ['engine','cameraMode','restoreCamera','middle','foreground','depthMap',...cameraFields,'applyCode','resetCode','motionCode','cardTitle','cardDetail','effect','strength','strengthAll','prev','next','play','orbit','remove','random','applyAll','export','webp']) {
    byId(id).disabled = !card || busy;
  }
}
function select(index, focus = true) {
  if (!cards.length) return;
  animation?.kill();
  if (spinning) view.cursor = tourCursor(tour.position);
  setSpinning(false);
  tourPaused = false;
  selected = wrap(index, cards.length);
  if (layout === 'pool') view.progress = 0;
  const half = cards.length / 2;
  const cursor = view.cursor + wrap(selected - view.cursor + half, cards.length) - half;
  animation = gsap.to(view, { cursor, focus: Number(focus), progress:0, duration:reduceMotion.matches ? 0 : .65, ease:'power3.out' });
  refresh();
}
function moveImage(from, to, focusControl) {
  if (busy || from < 0 || from >= cards.length || to < 0 || to >= cards.length || from === to) return;
  const [card] = cards.splice(from, 1);
  cards.splice(to, 0, card);
  select(to, false);
  const thumbnail = byId('film').children[to];
  thumbnail.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (focusControl) {
    const control = byId(focusControl);
    (control.disabled ? thumbnail : control).focus({ preventScroll: true });
  }
  status(card.name + ' se movió a la posición ' + (to + 1) + ' de ' + cards.length + '.');
}
byId('moveEarlier').onclick = () => moveImage(selected, selected - 1, 'moveEarlier');
byId('moveLater').onclick = () => moveImage(selected, selected + 1, 'moveLater');

function randomize() {
  const order = effects.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  cards.forEach((card, i) => { card.effect = order[i]; delete card.frames; });
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
  const aspect = image.width / image.height;
  const { material, uniforms: surface } = createCardSurface(texture, aspect);
  const mesh = new T.Mesh(unfoldGeometry, material);
  scene.add(mesh);
  const available = effects.map((_, i) => i).filter(i => !cards.some(card => card.effect === i));
  cards.push({engine:"preset",cinema:{...defaultCamera},layers:{},name, title:name.replace(/\.[^.]+$/, "").slice(0,52), detail:"", url, mesh, surface, aspect, effect:available[Math.floor(Math.random()*available.length)] ?? 0, strength:.75});
}
function lock(value) {
  busy = value;
  for (const id of ['files','demo','demoSet','ratio','duration','scope','layout','direction','spacing','layerEffects','background','finish','fps','showCaption','bubbleThird','bubbleSize',...textControls]) byId(id).disabled = value;
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
  if (set === 'materia') {
    void importImages(materiaDemo());
    return;
  }
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
byId('prev').onclick = () => select(currentCardIndex() - 1, false);
byId('next').onclick = () => select(currentCardIndex() + 1, false);
function startOrbit(resume = false) {
  animation?.kill();
  Object.assign(view, {focus:0, progress:0});
  if (!resume) tour.position = wrap(Math.round(view.cursor), cards.length || 1);
  tourPaused = false;
  setSpinning(true);
}
byId('orbit').onclick = () => {
  if (spinning) {
    view.cursor = tourCursor(tour.position);
    if (layout === 'pool' && tourAvailable()) {
      selected = wrap(Math.floor(tour.position), cards.length);
      view.focus = 0;
      view.progress = tour.position % 1;
      refresh();
    } else if (layerEffects && tourAvailable()) {
      selected = wrap(Math.floor(tour.position), cards.length);
      const beat = tour.position % 1;
      view.focus = smooth(beat,.12,.32) * (1 - smooth(beat,.73,.94));
      view.progress = smooth(beat,.2,.93);
      refresh();
    }
    tourPaused = true;
    setSpinning(false);
  } else startOrbit(tourPaused);
};
byId('effect').onchange = e => { cards[selected].effect = Number(e.target.value); delete cards[selected].frames; select(selected); };
function disposeLayer(layer) {
  scene.remove(layer);
  layer.material.map.dispose();
  layer.material.dispose();
}
byId('engine').onchange = e => {
  const card = cards[selected];
  card.engine = e.target.value;
  if (card.engine !== 'preset' && card.cinema.mode === 'fixed') card.cinema.mode = 'orbit';
  refresh();
};
byId('cameraMode').onchange = e => { cards[selected].cinema.mode = e.target.value; };
cameraFields.forEach(id => {
  byId(id).onchange = e => {
    const input = e.target;
    const value = T.MathUtils.clamp(input.valueAsNumber || (input.value === '0' ? 0 : defaultCamera[id]),Number(input.min),Number(input.max));
    cards[selected].cinema[id] = value;
    input.value = value;
  };
});
byId('restoreCamera').onclick = () => { cards[selected].cinema = {...defaultCamera}; refresh(); };
for (const id of ['middle','foreground','depthMap']) {
  byId(id).onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const card = cards[selected];
    const url = URL.createObjectURL(file);
    lock(true);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (id === 'depthMap') {
        const next = depthGeometry(image,1);
        card.depthMesh?.dispose();
        card.depthMesh = next;
      } else {
        const scale = Math.min(1,2048 / Math.max(image.width,image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1,Math.round(image.width * scale));
        canvas.height = Math.max(1,Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const map = new T.CanvasTexture(canvas);
        map.colorSpace = T.SRGBColorSpace;
        const layer = new T.Mesh(geometry,new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));
        layer.visible = false;
        layer.renderOrder = id === 'foreground' ? 3 : 2;
        if (card.layers[id]) disposeLayer(card.layers[id]);
        card.layers[id] = layer;
        scene.add(layer);
      }
      status('Recurso de profundidad listo.');
    } catch (error) { status('No se pudo cargar el recurso. ' + error.message); }
    finally { URL.revokeObjectURL(url); lock(false); }
  };
}
byId('cardTitle').oninput = e => { cards[selected].title = e.target.value; };
byId('cardDetail').oninput = e => { cards[selected].detail = e.target.value; };
byId('strength').oninput = event => {
  const strength = Number(event.target.value);
  if (byId('strengthAll').checked) cards.forEach(card => { card.strength = strength; });
  else cards[selected].strength = strength;
};
byId('random').onclick = () => {
  randomize();
  status('Efectos asignados al azar sin repetir.');
};
byId('applyAll').onclick = () => {
  const effect = Number(byId('effect').value);
  const strength = Number(byId('strength').value);
  cards.forEach(card => { card.effect = effect; card.strength = strength; delete card.frames; });
  syncCode(cards[selected]);
  status('Efecto e intensidad aplicados a todas las imágenes.');
};
byId('layout').onchange = e => {
  if (spinning) view.cursor = tourCursor(tour.position);
  layout = e.target.value;
  updateThirdControl();
  layerEffects = spotlightPreference.get(layout) ?? !['radiant', 'collage', 'pool'].includes(layout);
  byId('layerEffects').checked = layerEffects;
  byId('motionNote').textContent = {
    radiant: 'Las tarjetas alternan cara y canto a lo largo de una diagonal.',
    bubbles: 'Cada esfera se despliega, muestra su ficha y vuelve a cerrarse.',
    helix: 'Las tarjetas giran hacia un punto de fuga.',
    slides: 'Las imágenes avanzan de derecha a izquierda.',
    wave: 'Las imágenes suben y bajan a medida que avanzan.',
    collage: 'Los recortes giran en capas, con un recorrido continuo.',
    pool: 'Nueve piezas flotan, se juntan sobre el agua y vuelven a separarse.'
  }[layout];
  if (reduceMotion.matches) select(selected, false);
  else if (cards.length) startOrbit();
};
byId('spacing').oninput = e => { spacing = Number(e.target.value); };
byId('layerEffects').onchange = e => {
  layerEffects = e.target.checked;
  spotlightPreference.set(layout, layerEffects);
};
byId('remove').onclick = () => {
  const [card] = cards.splice(selected, 1);
  scene.remove(card.mesh);
  card.depthMesh?.dispose();
  for (const layer of Object.values(card.layers)) disposeLayer(layer);
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
  select(Math.round(spinning ? tourCursor(tour.position) : view.cursor) + Math.sign(e.deltaY), false);
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
  if (Math.abs(delta) > 20) { select(Math.round(spinning ? tourCursor(tour.position) : view.cursor) - Math.sign(delta), false); return; }
  const bounds = canvas.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2((e.clientX-bounds.left)/bounds.width*2-1, 1-(e.clientY-bounds.top)/bounds.height*2), camera);
  if (layout === 'pool') {
    if (pool.contains(ray)) select(currentCardIndex());
    return;
  }
  const hit = ray.intersectObjects(cards.map(card => card.mesh).filter(mesh => mesh.visible))[0];
  if (hit) select(cards.findIndex(card => card.mesh === hit.object));
};
function duration() { return Math.max(1, Math.min(12, Number(byId('duration').value) || 3)); }
function clip(timeline, index, seconds) {
  if (layout === 'pool') {
    timeline.set(view, {cursor:index, focus:0, progress:0, onComplete:() => { selected = index; }});
    timeline.to(view, {progress:1, duration:seconds, ease:'none'});
    return;
  }
  const transition = Math.min(.42, seconds * .28);
  timeline.set(view, {focus:0, progress:0, onComplete:() => { selected = index; }});
  timeline.to(view, {cursor:index, focus:1, duration:transition, ease:'power2.inOut'});
  const exit = layout === 'bubbles' ? Math.min(.58, seconds * .25) : 0;
  const settle = exit ? Math.min(.14, seconds * .10) : 0;
  timeline.to(view, {progress:1, duration:seconds-transition-exit-settle, ease:'none'});
  if (exit) {
    timeline.to(view, {focus:0, duration:exit, ease:'power2.inOut'});
    timeline.to(view, {focus:0, duration:settle});
  }
}
byId('play').onclick = () => {
  if (spinning) view.cursor = tourCursor(tour.position);
  setSpinning(false);
  tourPaused = false;
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
  const previous = selected;
  const wasSpinning = spinning;
  const previousView = {...view};
  const previousTourPosition = tour.position;
  const scope = byId('scope').value;
  const continuous = scope === 'helix';
  if (continuous && !tourAvailable()) {
    status('Importa al menos dos imágenes para exportar el recorrido.');
    return;
  }

  const indices = scope === 'one' ? [selected] : cards.map((_, i) => i);
  const seconds = duration();
  const fps = Number(byId('fps').value);
  lock(true);
  animation?.kill();
  renderer.setAnimationLoop(null);
  status('Preparando WebM…');

  try {
    const { exportWebM } = await import('./webm');
    resize(true);
    selected = indices[0];
    Object.assign(view, {cursor:selected, focus:0, progress:0});
    recordingTour = continuous;
    animation = gsap.timeline({paused:true});
    if (continuous) {
      tour.position = 0;
      animation.to(tour, {position:indices.length, duration:seconds * indices.length, ease:'none'});
    } else {
      indices.forEach(index => clip(animation, index, seconds));
    }

    let lastPercent = -1;
    const blob = await exportWebM(canvas, {
      fps,
      seconds: animation.duration(),
      render(time) {
        animation.time(time, false);
        drawFrame(performance.now());
      },
      report(progress, action) {
        const percent = Math.round(progress * 100);
        if (percent === lastPercent) return;
        lastPercent = percent;
        status(action + ' WebM · ' + percent + '%');
      }
    });
    if (!blob.size) throw new Error('El video salió vacío.');
    const url = URL.createObjectURL(blob);
    download(url, 'aelityx-motion.webm');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    status('WebM listo.');
  } catch (error) {
    status(error.message);
  } finally {
    recordingTour = false;
    animation?.kill();
    selected = previous;
    Object.assign(view, previousView);
    tour.position = previousTourPosition;
    resize();
    lock(false);
    if (wasSpinning) startOrbit(true);
    renderer.setAnimationLoop(drawFrame);
  }
};
refresh();
