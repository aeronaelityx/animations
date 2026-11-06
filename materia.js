const collection = [
  ['Lumen', 272, 184, .6, 1.15],
  ['Vidrio ámbar', 25, 331, 1.4, .84],
  ['Marea fría', 166, 214, 2.4, 1.10],
  ['Piedra solar', 347, 39, 3.9, 1.36],
  ['Nácar', 220, 298, 4.7, .92],
  ['Jardín mineral', 102, 176, 5.6, 1.28]
];

function ribbon(hue, accent, spin, fold) {
  const slices = 126;
  const patches = [];
  const point = (t, side) => {
    const bend = t * fold + spin;
    const radius = 244 + 38 * Math.cos(t * 3 + spin) + side * 87 * Math.cos(bend);
    const x = Math.cos(t) * radius;
    const y = Math.sin(t) * radius;
    const z = Math.sin(bend) * side * 105 + Math.sin(2 * t + spin) * 66;
    const pitch = .53 + Math.sin(spin) * .16;
    const sx = x * Math.cos(spin) - y * Math.sin(spin);
    const sy = x * Math.sin(spin) + y * Math.cos(spin);
    const py = sy * Math.cos(pitch) - z * Math.sin(pitch);
    const pz = sy * Math.sin(pitch) + z * Math.cos(pitch);
    const zoom = 890 / (890 - pz);
    return [500 + sx * zoom, 385 + py * zoom, pz];
  };

  for (let i = 0; i < slices; i++) {
    const t = Math.PI * 2 * i / slices;
    const next = Math.PI * 2 * (i + 1) / slices;
    const points = [point(t, -1), point(next, -1), point(next, 1), point(t, 1)];
    const depth = points.reduce((sum, vertex) => sum + vertex[2], 0) / points.length;
    const light = 34 + Math.cos(t * 2.4 + spin) * 13 + Math.sin(t * 5) * 6 + depth * .043;
    const color = (hue + (accent - hue) * (.5 + .5 * Math.sin(t + spin)) + 360) % 360;
    const polygon = points.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
    patches.push({ depth, svg: `<polygon points="${polygon}" fill="hsl(${color},72%,${light}%)" stroke="hsl(${color},76%,${light + 8}%)" stroke-width="1.4"/>` });
  }
  return patches.sort((a, b) => a.depth - b.depth).map(patch => patch.svg).join('');
}

export function materiaDemo() {
  return collection.map(([name, hue, accent, spin, fold], index) => {
    const motes = Array.from({ length: 180 }, (_, i) => {
      const x = (i * 179.17 + index * 41) % 1000;
      const y = (i * 233.07 + index * 13) % 800;
      const r = .5 + (i * .71) % 2.8;
      return `<circle cx="${x}" cy="${y}" r="${r}" opacity="${.12 + (i * .21) % .35}"/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800">
      <defs>
        <linearGradient id="base" x2=".8" y2="1">
          <stop stop-color="hsl(${hue},52%,14%)"/><stop offset=".72" stop-color="#100c1c"/><stop offset="1" stop-color="hsl(${accent},45%,20%)"/>
        </linearGradient>
        <radialGradient id="glow">
          <stop stop-color="hsl(${accent},76%,56%)" stop-opacity=".66"/><stop offset="1" stop-color="hsl(${hue},55%,38%)" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="light" cx=".7" cy=".2" r=".55">
          <stop stop-color="hsl(${hue},78%,71%)" stop-opacity=".36"/><stop offset="1" stop-color="hsl(${hue},78%,71%)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1000" height="800" fill="url(#base)"/>
      <ellipse cx="${430 + index * 23}" cy="386" rx="590" ry="374" fill="url(#glow)"/>
      <g fill="hsl(${accent},70%,82%)">${motes}</g>
      <g stroke="hsl(${hue},63%,75%)" opacity=".3" fill="none" transform="rotate(${-14 + index * 7} 500 400)">
        <ellipse cx="500" cy="400" rx="400" ry="294"/>
        <ellipse cx="500" cy="400" rx="414" ry="310" stroke-dasharray="2 11"/>
        <path d="M80 400H920 M500 73V727" stroke-dasharray="1 15"/>
      </g>
      ${ribbon(hue, accent, spin, fold)}
      <rect width="1000" height="800" fill="url(#light)"/>
    </svg>`;
    return new File([svg], name + '.svg', { type: 'image/svg+xml' });
  });
}
