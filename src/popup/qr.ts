import { qrcodegen } from '../vendor/qrcodegen';

/** Render `text` as a self-contained, scalable QR SVG string (dark modules on a
    white quiet-zone). Generated entirely offline — the topic never leaves the
    machine. Pure black/white for the most reliable phone-camera recognition. */
export function qrSvg(text: string, border = 2): string {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
  const dim = qr.size + border * 2;
  let path = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) path += `M${x + border},${y + border}h1v1h-1z`;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" width="100%" height="100%">`,
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>`,
    `<path d="${path}" fill="#000000"/>`,
    '</svg>',
  ].join('');
}
