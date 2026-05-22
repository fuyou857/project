/** 画布：旋转、对比度/亮度简易增强（纠偏占位为轻度锐化） */
export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
  return img;
}

export function renderImageToCanvas(
  img: HTMLImageElement,
  opts?: { rotation?: number; brightness?: number; contrast?: number; sharpen?: boolean },
): HTMLCanvasElement {
  const rot = ((opts?.rotation ?? 0) % 360 + 360) % 360;
  const rad = (rot * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const cw = Math.floor(w * cos + h * sin);
  const ch = Math.floor(w * sin + h * cos);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 不可用');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(rad);
  const b = opts?.brightness ?? 1;
  const c = opts?.contrast ?? 1;
  ctx.filter = `brightness(${b}) contrast(${c})`;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  if (opts?.sharpen) {
    const id = ctx.getImageData(0, 0, cw, ch);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const k = g > 128 ? 1.08 : 0.92;
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
    ctx.putImageData(id, 0, 0);
  }
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出图片失败'))), type, quality);
  });
}

export { validateInvoiceAttachmentFile as validateInvoiceImageFile } from './invoiceFileUtils';
