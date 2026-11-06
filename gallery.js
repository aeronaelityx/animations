import {
  BufferAttribute,
  DoubleSide,
  MeshBasicMaterial,
  PlaneGeometry,
  MathUtils
} from 'three';

const { clamp, lerp, smoothstep } = MathUtils;

export function ribbonPose(offset, spacing, aspect, imageAspect) {
  const span = aspect * 5.82;
  const step = offset * spacing / 1.35;
  const twist = offset * 2.2 - .76;
  const lane = Math.cos(twist);
  const z = lane * .85 - Math.abs(offset) * .32;
  const distanceScale = (8 - z) / 8;
  const stepX = Math.min(span * .25, 2.65);
  const stepY = lerp(1.03, .83, smoothstep(aspect, .65, 1.75));

  return {
    x: (step * stepX - lane * Math.min(span * .046, .42)) * distanceScale,
    y: (step * stepY + lane * .36) * distanceScale,
    z,
    rx: -.14 + lane * .14,
    ry: .18 + Math.sin(twist) * 1.20,
    rz: .32 + lane * .14,
    width: Math.min(span * .42, 2.34 * imageAspect, 3.34)
  };
}

// The sphere and its unfolding curl share the flat card's vertices and UVs.
export function createUnfoldGeometry() {
  const geometry = new PlaneGeometry(1, 1, 28, 28);
  const positions = geometry.attributes.position;
  const sphere = new Float32Array(positions.count * 3);
  const curl = new Float32Array(sphere.length);

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) * 2;
    const y = positions.getY(i) * 2;
    const u = x * Math.sqrt(1 - y * y / 2);
    const v = y * Math.sqrt(1 - x * x / 2);
    const base = i * 3;
    sphere[base] = (u - x) / 2;
    sphere[base + 1] = (v - y) / 2;
    sphere[base + 2] = Math.sqrt(Math.max(0, 1 - u * u - v * v)) * .46;
    curl[base + 2] = Math.sin(x * Math.PI * .7) * .13 + y * x * .08;
  }

  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [
    new BufferAttribute(sphere, 3),
    new BufferAttribute(curl, 3)
  ];
  geometry.computeBoundingSphere();
  return geometry;
}

export function createCardSurface(texture, aspect) {
  const material = new MeshBasicMaterial({
    map: texture,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    forceSinglePass: true
  });
  const uniforms = {
    cardRound: { value: 0 },
    cardOrb: { value: 0 },
    cardAspect: { value: aspect },
    cardImageAspect: { value: aspect },
    cardSheen: { value: .6 },
    cardMatte: { value: 0 },
    cardPaper: { value: 0 }
  };

  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec2 vCardUv;\n' + shader.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\n vCardUv = uv;'
    );
    shader.fragmentShader = `
      varying vec2 vCardUv;
      uniform float cardRound;
      uniform float cardOrb;
      uniform float cardAspect;
      uniform float cardImageAspect;
      uniform float cardSheen;
      uniform float cardMatte;
      uniform float cardPaper;
    ` + shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 flatUv = vCardUv - .5;
      vec2 q = flatUv * 2.0;
      vec2 dome = q * sqrt(vec2(1.0) - .5 * q.yx * q.yx);
      float ratio = cardImageAspect / cardAspect;
      vec2 containScale = vec2(max(1.0, 1.0 / ratio), max(1.0, ratio));
      vec2 coverScale = vec2(min(1.0, 1.0 / cardImageAspect), min(1.0, cardImageAspect));
      vec2 artUv = mix(flatUv * containScale, dome * .5 * coverScale, cardOrb) + .5;
      vec4 art = texture2D(map, clamp(artUv, 0.0, 1.0));

      float inside = step(0.0, min(artUv.x, artUv.y)) * step(max(artUv.x, artUv.y), 1.0);
      vec3 matte = vec3(.010, .008, .019) + art.rgb * .27;
      art.rgb = mix(art.rgb, mix(matte, art.rgb, art.a * inside), cardMatte);
      art.a = mix(art.a, 1.0, cardMatte);

      vec2 size = vec2(min(cardAspect, 1.0), min(1.0, 1.0 / cardAspect));
      float radius = min(size.x, size.y) * .072;
      vec2 corner = abs(flatUv) * size - (.5 * size - radius);
      float edge = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - radius;
      float aa = max(fwidth(edge), .0004);
      float mask = 1.0 - smoothstep(-aa, aa, edge);
      float rim = smoothstep(-.010 - aa, -.001, edge) * mask;
      float gloss = exp(-pow((vCardUv.x + vCardUv.y * .38 - cardSheen) * 3.7, 2.0));
      vec3 tint = mix(vec3(.30, .23, .60), vec3(.74, .37, .14), vCardUv.y);
      art.rgb += (tint * gloss * .052 + tint * rim * .36) * cardRound * (1.0 - cardOrb);
      art.a *= mix(1.0, mask, cardRound * (1.0 - cardOrb));

      float domeZ = sqrt(max(0.0, 1.0 - dot(dome, dome)));
      vec3 normal = vec3(dome, domeZ);
      float lit = max(0.0, dot(normal, normalize(vec3(-.48, .60, 1.0))));
      float sheen = pow(max(0.0, dot(normal, vec3(-.33, .47, .818))), 24.0);
      float halo = pow(1.0 - domeZ, 3.0);
      vec3 sphereColor = art.rgb * (.35 + .66 * lit)
        + vec3(.40, .56, .86) * (sheen * .35 + halo * .14);
      art.rgb = mix(art.rgb, sphereColor, cardOrb);
      if (cardPaper > .5) {
        vec2 printUv = flatUv / .887 + .5;
        vec4 ink = texture2D(map, clamp(printUv, 0.0, 1.0));
        float printEdge = .5 - max(abs(printUv.x - .5), abs(printUv.y - .5));
        float printed = smoothstep(-.003, .003, printEdge) * ink.a;
        vec2 grainUv = floor(vCardUv * 720.0);
        float grain = fract(sin(dot(grainUv, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 stock = mix(vec3(.54, .44, .37), vec3(.81, .72, .61), vCardUv.y) * (.95 + grain * .07);
        float frayX = .49 + .004 * sin(vCardUv.y * 129.0) + .002 * sin(vCardUv.y * 351.0);
        float frayY = .49 + .005 * sin(vCardUv.x * 145.0) + .002 * cos(vCardUv.x * 287.0);
        float paperEdge = min(frayX - abs(flatUv.x), frayY - abs(flatUv.y));
        float edgeAa = max(fwidth(paperEdge), .0004);
        art = vec4(mix(stock, ink.rgb * (.92 + gloss * .14), printed),
          smoothstep(-edgeAa, edgeAa, paperEdge));
      }
      diffuseColor *= art;
    `);
  };

  return { material, uniforms };
}

export function unfoldPose(focus) {
  const orb = 1 - smoothstep(clamp(focus, 0, 1), .02, .91);
  return { orb, curl: 4 * orb * (1 - orb) };
}
