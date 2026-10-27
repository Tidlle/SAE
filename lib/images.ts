export const MAX_IMAGES = 4;

const MAX_SIDE = 1280;
const MAX_BYTES = 900 * 1024;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Não foi possível ler "${file.name}". Use uma imagem JPG, PNG ou WebP.`));
    };
    img.src = url;
  });

const dataUrlBytes = (dataUrl: string): number => Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

// Reduz a imagem (lado maior 1280px, JPEG) para o envio ficar leve; devolve um data URL.
export const compressImage = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`);
  const img = await loadImage(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  let quality = 0.82;

  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu processar a imagem.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrlBytes(dataUrl) <= MAX_BYTES) return dataUrl;
    scale *= 0.8;
    quality = Math.max(0.6, quality - 0.06);
  }
  throw new Error(`A imagem "${file.name}" é grande demais. Escolha uma menor.`);
};
