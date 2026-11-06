import * as T from 'three';
import {gsap} from 'gsap';

const ease = gsap.parseEase('sine.inOut');
export const cameraDefaults = {mode:'fixed', fov:40, distance:8, radius:.8, targetX:0, targetY:0, depth:.6, frequency:1};
export function moveCamera(camera, options, time, weight, seed) {
  const t = ease(time);
  const wave = Math.sin(t * Math.PI * 2);
  const radius = options.radius;
  const mode = options.mode === 'random'
    ? ['orbit','truck','pedestal','dynamic','dolly'][seed % 5] : options.mode;
  let x = 0, y = 0, z = 0, pan = 0, tilt = 0;
  if (mode === 'orbit' || mode === 'dynamic') {
    x = wave * radius;
    y = Math.sin(t * Math.PI * 4) * radius * .32;
    z = (Math.cos(t * Math.PI * 2) - 1) * radius * .32;
  }
  if (mode === 'dolly' || mode === 'dynamic') z -= Math.sin(t * Math.PI) * radius;
  if (mode === 'out') z += t * radius;
  if (mode === 'truck') x = (t * 2 - 1) * radius;
  if (mode === 'pedestal') y = (t * 2 - 1) * radius;
  if (mode === 'pan') pan = wave * radius;
  if (mode === 'tilt') tilt = wave * radius;
  camera.position.set(x * weight,y * weight,8 + (options.distance - 8 + z) * weight);
  camera.lookAt((options.targetX + pan) * weight,(options.targetY + tilt) * weight,0);
  const fov = 40 + (options.fov - 40) * weight;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

export function floatMotion(time,strength,frequency,seed) {
  const phase = time * Math.PI * 2 * frequency + seed * 1.618;
  return {
    x:Math.sin(phase * .76) * .21 * strength,
    y:Math.sin(phase) * .33 * strength,
    z:Math.cos(phase * .82) * .34 * strength,
    rx:Math.sin(phase * .83) * .24 * strength,
    ry:Math.cos(phase * .69) * .38 * strength,
    rz:Math.sin(phase * .57) * .12 * strength
  };
}

export function depthGeometry(image,strength) {
  const grid = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = grid + 1;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const mesh = new T.PlaneGeometry(1,1,grid,grid);
  const vertices = mesh.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const offset = i * 4;
    const luminance = (pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722) / 255;
    vertices.setZ(i,(luminance - .5) * strength);
  }
  vertices.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
