// ─── SPINNING RETRO EARTH FAVICON ───
// Browsers only show the first frame of an animated GIF as a favicon, so
// true spinning needs to be done by redrawing a canvas each frame and
// swapping the <link rel="icon"> href. This draws a small glossy globe,
// in the same sky/aqua palette as the rest of the site, and rotates a
// few "continent" blobs around it to fake a spin.

(function () {
  const SIZE = 32; // favicon px size
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const faviconLink = document.getElementById('favicon');

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE / 2 - 1.5;

  // Continent blobs positioned in "globe space": angle (radians) and
  // latitude offset (-1 to 1). They orbit around the sphere on rotation.
  const blobs = [
    { angle: 0,    lat: 0.25,  w: 7, h: 4 },
    { angle: 1.3,  lat: -0.3,  w: 5, h: 6 },
    { angle: 2.6,  lat: 0.1,   w: 8, h: 3 },
    { angle: 3.6,  lat: -0.55, w: 4, h: 4 },
    { angle: 4.7,  lat: 0.5,   w: 6, h: 3 },
    { angle: 5.6,  lat: -0.05, w: 5, h: 5 },
  ];

  let rotation = 0;

  function drawFrame() {
    ctx.clearRect(0, 0, SIZE, SIZE);

    // ── Ocean base: glossy sky/aqua radial gradient ──
    const oceanGrad = ctx.createRadialGradient(
      cx - r * 0.35, cy - r * 0.35, r * 0.1,
      cx, cy, r
    );
    oceanGrad.addColorStop(0,   '#eafcff');
    oceanGrad.addColorStop(0.25,'#a8e8ff');
    oceanGrad.addColorStop(0.55,'#2ec4e0');
    oceanGrad.addColorStop(0.8, '#1a80bb');
    oceanGrad.addColorStop(1,   '#0d4a78');

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── Continents: rotate around the sphere, squashed near edges to
    //    fake 3D perspective on a flat canvas ──
    blobs.forEach(b => {
      const a = b.angle + rotation;
      const xFactor = Math.cos(a); // -1 (back) .. 1 (front)
      if (xFactor < -0.15) return; // hidden on the far side of the globe

      const x = cx + xFactor * r * 0.78;
      const y = cy + b.lat * r * 0.78;
      const squash = Math.max(0.15, Math.abs(xFactor)); // narrower near edges

      ctx.fillStyle = 'rgba(91, 191, 106, 0.92)'; // green continents
      ctx.beginPath();
      ctx.ellipse(x, y, b.w * squash * 0.6 + 1, b.h * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Gloss highlight (the signature Aero shine) ──
    const glossGrad = ctx.createRadialGradient(
      cx - r * 0.4, cy - r * 0.45, 0,
      cx - r * 0.3, cy - r * 0.3, r * 0.9
    );
    glossGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
    glossGrad.addColorStop(0.35, 'rgba(255,255,255,0.25)');
    glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glossGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle bottom shadow for depth
    const shadowGrad = ctx.createRadialGradient(
      cx, cy + r * 0.6, 0,
      cx, cy + r * 0.6, r * 0.9
    );
    shadowGrad.addColorStop(0, 'rgba(5,30,55,0.35)');
    shadowGrad.addColorStop(1, 'rgba(5,30,55,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // ── Thin outer ring ──
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (faviconLink) {
      faviconLink.href = canvas.toDataURL('image/png');
    }

    rotation += 0.12; // spin speed
  }

  // ~12fps is plenty for a 32px icon and keeps it light on resources
  setInterval(drawFrame, 80);
  drawFrame();
})();
