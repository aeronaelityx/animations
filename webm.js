const bitrate = 8_000_000;

async function renderWebM(canvas, { fps, seconds, render, report }) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;

  const { BufferTarget, CanvasSource, Output, WebMOutputFormat, canEncodeVideo } = await import('mediabunny');
  const size = { width: canvas.width, height: canvas.height, bitrate };
  const codec = await canEncodeVideo('vp9', size) ? 'vp9'
    : await canEncodeVideo('vp8', size) ? 'vp8' : null;
  if (!codec) return null;

  const target = new BufferTarget();
  const output = new Output({ format: new WebMOutputFormat(), target });
  const source = new CanvasSource(canvas, { codec, bitrate });
  output.addVideoTrack(source, { frameRate: fps });

  try {
    await output.start();
    const frames = Math.max(1, Math.round(seconds * fps));
    for (let i = 0; i < frames; i++) {
      const time = i / fps;
      render(time);
      await source.add(time, 1 / fps);
      report((i + 1) / frames, 'Renderizando');
    }
    await output.finalize();
    return new Blob([target.buffer], { type: 'video/webm' });
  } catch (error) {
    await output.cancel();
    throw error;
  }
}

async function recordWebM(canvas, { fps, seconds, render, report }) {
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(type => globalThis.MediaRecorder?.isTypeSupported(type));
  if (!mimeType || !canvas.captureStream) {
    throw new Error('Este navegador no puede exportar WebM. Prueba Chrome o Edge.');
  }

  const stream = canvas.captureStream(fps);
  const track = stream.getVideoTracks()[0];
  let recorder;
  let frame;
  let end;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
    const chunks = [];
    return await new Promise((resolve, reject) => {
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      recorder.onerror = event => reject(event.error ?? new Error('Falló la grabación.'));

      render(0);
      recorder.start();
      const start = performance.now();
      function tick(now) {
        try {
          const time = Math.min(seconds, Math.max(0, (now - start) / 1000));
          if (time === seconds) track.requestFrame?.();
          render(time);
          report(time / seconds, 'Grabando en tiempo real');
          if (time < seconds) frame = requestAnimationFrame(tick);
          else end = setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
          }, 2000 / fps);
        } catch (error) {
          reject(error);
        }
      }
      frame = requestAnimationFrame(tick);
    });
  } finally {
    cancelAnimationFrame(frame);
    clearTimeout(end);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    for (const item of stream.getTracks()) item.stop();
  }
}

export async function exportWebM(canvas, options) {
  const video = await renderWebM(canvas, options);
  return video ?? recordWebM(canvas, options);
}
