const width = 1024;
const paddingX = 42;
const paddingY = 26;
const lineWidth = width - 2 * paddingX;
const graphemes = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

function breakWord(context, word) {
  const characters = graphemes
    ? Array.from(graphemes.segment(word), item => item.segment)
    : Array.from(word);
  const fragments = [];
  let fragment = '';
  for (const character of characters) {
    if (fragment && context.measureText(fragment + character).width > lineWidth) {
      fragments.push(fragment);
      fragment = '';
    }
    fragment += character;
  }
  if (fragment) fragments.push(fragment);
  return fragments;
}

function wrapText(context, text) {
  return text.trim().split(/\r?\n+/).filter(paragraph => paragraph.trim()).flatMap(paragraph => {
    const lines = [];
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (context.measureText(next).width <= lineWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      if (context.measureText(word).width > lineWidth) {
        const fragments = breakWord(context, word);
        line = fragments.pop();
        lines.push(...fragments);
      } else {
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.map((text, index) => ({ text, last: index === lines.length - 1 }));
  });
}

function makeLayout(context, title, detail, style, scale) {
  const titleSize = Math.max(16, Math.floor(style.titleSize * scale));
  const detailSize = Math.max(14, Math.floor(style.detailSize * scale));
  const titleFont = '600 ' + titleSize + 'px ' + style.font;
  const detailFont = detailSize + 'px ' + style.font;
  context.font = titleFont;
  const titleLines = wrapText(context, title);
  context.font = detailFont;
  const detailLines = wrapText(context, detail);
  const titleLeading = Math.ceil(titleSize * 1.2);
  const detailLeading = Math.ceil(detailSize * 1.34);
  const gap = detailLines.length ? Math.max(12, Math.round(titleSize * .29)) : 0;
  const height = 2 * paddingY + titleLines.length * titleLeading + gap + detailLines.length * detailLeading;
  return { height, titleFont, detailFont, titleLines, detailLines, titleLeading, detailLeading, gap };
}

function fitLayout(context, title, detail, style, maxHeight) {
  const normal = makeLayout(context, title, detail, style, 1);
  if (normal.height <= maxHeight) return normal;

  let low = .25;
  let high = 1;
  let best = makeLayout(context, title, detail, style, low);
  if (best.height > maxHeight) {
    detail = detail.replace(/\s+/g, ' ');
    best = makeLayout(context, title, detail, style, low);
  }
  for (let i = 0; i < 9; i++) {
    const scale = (low + high) / 2;
    const candidate = makeLayout(context, title, detail, style, scale);
    if (candidate.height <= maxHeight) {
      best = candidate;
      low = scale;
    } else {
      high = scale;
    }
  }
  return best;
}

function drawLines(context, lines, top, leading, alignment) {
  lines.forEach(({ text, last }, index) => {
    const y = top + (index + .5) * leading;
    const words = alignment === 'justify' && !last ? text.split(' ') : [];
    if (words.length > 1) {
      const sizes = words.map(word => context.measureText(word).width);
      const gap = (lineWidth - sizes.reduce((sum, size) => sum + size, 0)) / (words.length - 1);
      let x = paddingX;
      context.textAlign = 'left';
      words.forEach((word, i) => {
        context.fillText(word, x, y);
        x += sizes[i] + gap;
      });
      return;
    }
    context.textAlign = alignment === 'justify' ? 'left' : alignment;
    const x = alignment === 'center' ? width / 2 : alignment === 'right' ? width - paddingX : paddingX;
    context.fillText(text, x, y);
  });
}

export function paintCaption(canvas, title, detail, style, maxHeight) {
  const context = canvas.getContext('2d');
  const layout = fitLayout(context, title, detail, style, maxHeight);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = style.background + 'ed';
  context.beginPath();
  context.roundRect(2, 2, width - 4, layout.height - 4, 22);
  context.fill();
  context.strokeStyle = '#ffffff3d';
  context.lineWidth = 2;
  context.stroke();
  context.textBaseline = 'middle';
  context.fillStyle = style.titleColor;
  context.font = layout.titleFont;
  drawLines(context, layout.titleLines, paddingY, layout.titleLeading, style.align === 'justify' ? 'left' : style.align);
  context.fillStyle = style.detailColor;
  context.font = layout.detailFont;
  const detailTop = paddingY + layout.titleLines.length * layout.titleLeading + layout.gap;
  drawLines(context, layout.detailLines, detailTop, layout.detailLeading, style.align);
  return layout.height;
}
