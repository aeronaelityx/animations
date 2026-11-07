import {
  Color, DoubleSide, Group, LineBasicMaterial, LineLoop, Mesh, MeshBasicMaterial,
  MathUtils, PlaneGeometry, ShaderMaterial, Shape, ShapeGeometry, BufferGeometry
} from 'three';

const tau = Math.PI * 2;

export function collagePose(index, cursor, count, spacing, aspect, imageAspect) {
  const angle = (index - cursor) / count * tau + .38;
  const near = (1 + Math.cos(angle)) / 2;
  const curl = Math.sin(2 * angle - .6);
  const radius = .71 + .16 * Math.sin(angle + .55) + .14 * curl;
  const spread = MathUtils.clamp(spacing / 1.35, .7, 1.4);
  const span = aspect * 5.82;
  const density = MathUtils.clamp(1.09 - (count - 6) * .024, .74, 1.12);
  const width = Math.min(span * .53, 2.92 * imageAspect, 4.0) * density;

  return {
    x: Math.sin(angle) * Math.min(span * .42, 4.5) * radius * spread,
    y: (Math.sin(angle + .73) * .86 + Math.cos(angle * 2 - .9) * .73) * radius * spread - .12,
    z: MathUtils.lerp(-3.7, .75, near),
    rx: -.16 + curl * .28,
    ry: Math.sin(angle - .31) * .8,
    rz: Math.sin(angle + .72) * .48 - Math.sin(2 * angle) * .28,
    width: width * MathUtils.lerp(.62, 1, near),
    opacity: MathUtils.lerp(.52, 1, near)
  };
}

// Adjacent pieces trace the same curve in opposite directions.
function puzzleEdge(shape, x, y, dx, dy, tab) {
  const point = (along, out) => [x + dx * along + dy * out * tab, y + dy * along - dx * out * tab];
  if (tab) {
    shape.lineTo(...point(.34, 0));
    shape.bezierCurveTo(...point(.405, 0), ...point(.435, .04), ...point(.425, .105));
    shape.bezierCurveTo(...point(.295, .29), ...point(.705, .29), ...point(.575, .105));
    shape.bezierCurveTo(...point(.565, .04), ...point(.595, 0), ...point(.66, 0));
  }
  shape.lineTo(...point(1, 0));
}

function puzzleTile(col, row, art, edge, backing) {
  const unit = 1 / 3;
  const x = col * unit - .5;
  const y = row * unit - .5;
  const cx = x + unit / 2;
  const cy = y + unit / 2;
  const tab = (a, b) => (a + b) % 2 ? -1 : 1;
  const shape = new Shape();
  shape.moveTo(x, y);
  puzzleEdge(shape, x, y, unit, 0, row === 0 ? 0 : -tab(col, row - 1));
  puzzleEdge(shape, x + unit, y, 0, unit, col === 2 ? 0 : tab(col, row));
  puzzleEdge(shape, x + unit, y + unit, -unit, 0, row === 2 ? 0 : tab(col, row));
  puzzleEdge(shape, x, y + unit, 0, -unit, col === 0 ? 0 : -tab(col - 1, row));

  const geometry = new ShapeGeometry(shape, 9);
  const points = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < points.count; i++) uv.setXY(i, points.getX(i) + .5, points.getY(i) + .5);
  geometry.translate(-cx, -cy, 0);

  const tile = new Group();
  const face = new Mesh(geometry, art);
  face.renderOrder = 6;
  const shadow = new Mesh(geometry, backing);
  shadow.position.set(.018, -.026, -.1);
  shadow.scale.setScalar(1.025);
  shadow.renderOrder = 5;
  const outlinePoints = shape.getPoints(9).map(point => ({ x: point.x - cx, y: point.y - cy, z: .016 }));
  const outlineGeometry = new BufferGeometry().setFromPoints(outlinePoints);
  const outline = new LineLoop(outlineGeometry, edge);
  outline.renderOrder = 7;
  tile.add(shadow, face, outline);
  return { tile, face, x: cx, y: cy };
}

function waterSurface() {
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      waterPhase: { value: 0 },
      aspect: { value: 1 },
      tint: { value: new Color('#0e0b18') }
    },
    vertexShader: `
      varying vec2 surfaceUv;
      void main() {
        surfaceUv = uv;
        gl_Position = vec4(position.xy, .999, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 surfaceUv;
      uniform float waterPhase;
      uniform float aspect;
      uniform vec3 tint;

      float caustic(vec2 point, vec2 drift) {
        float bend = sin(point.y * 3.6 + drift.y) * .56 + sin(point.y * 6.8 - drift.x) * .21;
        float a = sin(point.x * 5.7 + bend + drift.x);
        float b = cos(point.y * 4.2 + sin(point.x * 4.5 + drift.x) * .48 + drift.y);
        return pow(clamp(1.0 - abs(a + b) * .62, 0.0, 1.0), 11.0);
      }

      void main() {
        vec2 p = (surfaceUv - .5) * vec2(aspect, 1.0);
        vec2 drift = vec2(cos(waterPhase), sin(waterPhase));
        vec2 q = p * 6.0 + vec2(.19, .08);
        float lattice = caustic(q, drift) * .62 + caustic(q.yx * .81 + .83, -drift.yx) * .38;
        float light = exp(-dot(p - vec2(-.14, .16), p - vec2(-.14, .16)) * 4.4);
        float ripples = .5 + .5 * sin(31.0 * length(p + vec2(.12, .06)) + drift.x * .85);
        vec2 seams = abs(fract(p * 8.0 + .5) - .5);
        float tile = 1.0 - smoothstep(.008, .022, min(seams.x, seams.y));
        vec3 color = vec3(.007, .025, .035) + tint * .26;
        color += vec3(.007, .074, .091) * light;
        color += vec3(.043, .173, .186) * lattice * (.32 + light * .62);
        color += vec3(.005, .020, .022) * ripples * light;
        color *= (1.0 - tile * .13) * (1.0 - .5 * smoothstep(.20, .73, length(surfaceUv - .5)));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
  const surface = new Mesh(new PlaneGeometry(2, 2), material);
  surface.frustumCulled = false;
  surface.renderOrder = -10;
  return surface;
}

export function createPoolScene(scene) {
  const water = waterSurface();
  const group = new Group();
  const art = new MeshBasicMaterial({ transparent: true, side: DoubleSide, depthWrite: false, forceSinglePass: true });
  const edge = new LineBasicMaterial({ color: '#bcfcf0', transparent: true, depthWrite: false });
  const backing = new MeshBasicMaterial({ color: '#041820', transparent: true, depthWrite: false });
  const pieces = Array.from({ length: 9 }, (_, index) => {
    const piece = puzzleTile(index % 3, Math.floor(index / 3), art, edge, backing);
    group.add(piece.tile);
    return piece;
  });
  const faces = pieces.map(piece => piece.face);
  scene.add(water, group);
  water.visible = group.visible = false;

  return {
    hide() {
      water.visible = group.visible = false;
      if (art.map) art.map = null;
    },
    contains(ray) {
      return group.visible && ray.intersectObjects(faces).length > 0;
    },
    draw({ card, aspect, phase, flow, assembly, alpha, spacing, fit, motion, background }) {
      water.visible = true;
      group.visible = Boolean(card && alpha > .005);
      water.material.uniforms.aspect.value = aspect;
      water.material.uniforms.waterPhase.value = flow;
      water.material.uniforms.tint.value.set(background);
      if (!group.visible) return;

      if (!art.map) art.needsUpdate = true;
      art.map = card.mesh.material.map;
      art.opacity = alpha * MathUtils.lerp(1, motion.opacity ?? 1, assembly);
      edge.opacity = alpha * MathUtils.lerp(.66, .29, assembly);
      backing.opacity = alpha * MathUtils.lerp(.58, .14, assembly);

      const drift = 1 - assembly;
      const spread = MathUtils.clamp(spacing / 1.35, .7, 1.5);
      const width = Math.min(aspect * 4.19, 3.18 * card.aspect, 5.15);
      const focusWidth = MathUtils.lerp(width * .85, fit.width, assembly);
      group.scale.set(focusWidth, focusWidth / card.aspect, 1);
      group.position.set(fit.x * assembly, fit.y * assembly, MathUtils.lerp(.15, fit.z, assembly));
      group.rotation.set((motion.rx ?? 0) * .22 * assembly, (motion.ry ?? 0) * .22 * assembly, (motion.rz ?? 0) * .36 * assembly);

      pieces.forEach(({ tile, x, y }, index) => {
        const direction = Math.atan2(y, x) + .14 * Math.sin(index * 2.63 + phase * tau);
        const ripple = phase * tau + index * 1.57;
        const push = (index === 4 ? .10 : .22) * spread * drift;
        tile.position.set(
          x + Math.cos(direction) * push + .034 * Math.cos(ripple) * drift,
          y + Math.sin(direction) * push + .034 * Math.sin(ripple) * drift,
          (.15 + .16 * Math.sin(ripple)) * drift
        );
        tile.rotation.set(
          .26 * Math.sin(ripple) * drift,
          .31 * Math.cos(ripple) * drift,
          (.5 * Math.sin(index * 1.94) + .12 * Math.sin(ripple)) * drift
        );
        tile.scale.setScalar(1 - .075 * drift);
      });
    }
  };
}
