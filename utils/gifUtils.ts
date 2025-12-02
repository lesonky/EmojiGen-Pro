import { GeneratedItem, DownloadFormat } from "../types";

// Helper to load image
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Fetch the GIF worker script as a blob to avoid CORS/Path issues
const getWorkerBlob = async () => {
  const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
  if (!response.ok) throw new Error("Failed to load GIF worker");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

// Common background removal logic
const removeBackgroundFromCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  
  // Sample background color from the top-left pixel
  const bgR = d[0];
  const bgG = d[1];
  const bgB = d[2];
  
  const tolerance = 15;

  const isBg = (idx: number) => {
     const r = d[idx * 4];
     const g = d[idx * 4 + 1];
     const b = d[idx * 4 + 2];
     const a = d[idx * 4 + 3];
     if (a === 0) return false;
     return (
        Math.abs(r - bgR) <= tolerance &&
        Math.abs(g - bgG) <= tolerance &&
        Math.abs(b - bgB) <= tolerance
     );
  };

  const stack = [0, width - 1, (height - 1) * width, (height - 1) * width + width - 1];
  const visited = new Set<number>();

  while (stack.length > 0) {
     const idx = stack.pop()!;
     if (visited.has(idx)) continue;
     visited.add(idx);
     
     if (isBg(idx)) {
         const byteIdx = idx * 4;
         d[byteIdx + 3] = 0; // Transparent

         const x = idx % width;
         const y = Math.floor(idx / width);

         if (x > 0) stack.push(idx - 1);
         if (x < width - 1) stack.push(idx + 1);
         if (y > 0) stack.push(idx - width);
         if (y < height - 1) stack.push(idx + width);
     }
  }
  
  ctx.putImageData(imageData, 0, 0);
};

export const processImageToGifs = async (
  imageSrc: string,
  emotions: string[],
  removeBg: boolean,
  onProgress: (percent: number) => void
): Promise<GeneratedItem[]> => {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) throw new Error("Canvas not supported");

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const rows = 4;
  const cols = 6;
  const cellWidth = Math.floor(canvas.width / cols);
  const cellHeight = Math.floor(canvas.height / rows);
  const outputSize = Math.min(cellWidth, cellHeight);

  const items: GeneratedItem[] = [];
  const workerScript = await getWorkerBlob();

  for (let r = 0; r < rows; r++) {
    const gif = new window.GIF({
      workers: 2,
      quality: 10,
      width: outputSize,
      height: outputSize,
      workerScript: workerScript,
      transparent: removeBg ? 0x000000 : null,
    });

    for (let c = 0; c < cols; c++) {
      const sx = c * cellWidth;
      const sy = r * cellHeight;

      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = outputSize;
      frameCanvas.height = outputSize;
      const frameCtx = frameCanvas.getContext("2d");
      
      if (!frameCtx) continue;

      const side = Math.min(cellWidth, cellHeight);
      const cx = sx + (cellWidth - side) / 2;
      const cy = sy + (cellHeight - side) / 2;

      frameCtx.drawImage(
        canvas,
        cx, cy, side, side,
        0, 0, outputSize, outputSize
      );

      if (removeBg) {
        removeBackgroundFromCanvas(frameCtx, outputSize, outputSize);
      }

      gif.addFrame(frameCtx, { delay: 300, copy: true });
    }

    await new Promise<void>((resolve) => {
      gif.on('finished', (blob: Blob) => {
        items.push({
          id: `gif-${r}-${Date.now()}`,
          blob,
          blobUrl: URL.createObjectURL(blob),
          emotion: emotions[r] || `Emotion ${r + 1}`,
          isAnimated: true
        });
        resolve();
      });
      gif.render();
    });

    onProgress(((r + 1) / rows) * 100);
  }

  return items;
};

export const processImageToStatic = async (
  imageSrc: string,
  emotions: string[],
  removeBg: boolean,
  onProgress: (percent: number) => void
): Promise<GeneratedItem[]> => {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not supported");

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const rows = 4;
  const cols = 6;
  const cellWidth = Math.floor(canvas.width / cols);
  const cellHeight = Math.floor(canvas.height / rows);
  const outputSize = Math.min(cellWidth, cellHeight); // Square output

  const items: GeneratedItem[] = [];
  const totalItems = rows * cols;

  for (let i = 0; i < totalItems; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = outputSize;
    frameCanvas.height = outputSize;
    const frameCtx = frameCanvas.getContext("2d");
    
    if (!frameCtx) continue;

    const sx = c * cellWidth;
    const sy = r * cellHeight;
    const side = Math.min(cellWidth, cellHeight);
    const cx = sx + (cellWidth - side) / 2;
    const cy = sy + (cellHeight - side) / 2;

    frameCtx.drawImage(
      canvas,
      cx, cy, side, side,
      0, 0, outputSize, outputSize
    );

    if (removeBg) {
      removeBackgroundFromCanvas(frameCtx, outputSize, outputSize);
    }

    const blob = await new Promise<Blob>((resolve) => 
      frameCanvas.toBlob(b => resolve(b!), 'image/png')
    );

    items.push({
      id: `static-${i}-${Date.now()}`,
      blob,
      blobUrl: URL.createObjectURL(blob),
      emotion: emotions[i] || `Emotion ${i + 1}`,
      isAnimated: false
    });

    onProgress(((i + 1) / totalItems) * 100);
  }

  return items;
};

export const downloadAllAsZip = async (items: GeneratedItem[], gridImage: string | null, format: DownloadFormat = 'zip') => {
  const zip = new window.JSZip();
  
  if (format === 'zip') {
    // === Standard ZIP Format ===
    // Flat structure, semantic names, includes source grid
    
    items.forEach((item, index) => {
      const ext = item.isAnimated ? 'gif' : 'png';
      const safeName = item.emotion.replace(/[^\w\u4e00-\u9fa5]/g, '_') || `item_${index}`;
      zip.file(`${safeName}.${ext}`, item.blob);
    });
    
    if (gridImage) {
      try {
        const base64Data = gridImage.split(',')[1];
        if (base64Data) {
          zip.file("source_grid.png", base64Data, { base64: true });
        }
      } catch (e) {
        console.warn("Failed to add grid image to zip", e);
      }
    }
  } else {
    // === WeChat Format (.emoticon / .wemoji) ===
    // Structured folder, numbered files, config.json/emoticon.json, NO source grid
    
    const packName = "EmojiGenPack";
    const rootFolder = zip.folder(packName);
    const imagesFolder = rootFolder.folder("images");
    
    const emoticonsConfig: any[] = [];
    
    // Add images
    items.forEach((item, index) => {
      const ext = item.isAnimated ? 'gif' : 'png';
      // WeChat requires sequential naming usually (00, 01, 02...)
      const fileName = `${index.toString().padStart(2, '0')}.${ext}`;
      
      imagesFolder.file(fileName, item.blob);
      
      emoticonsConfig.push({
        file: fileName
      });
    });
    
    // Add Logo (Using the first item as the logo)
    // Note: Ideally this should be a PNG, but using the first item blob is the best approximation without re-rendering.
    if (items.length > 0) {
      rootFolder.file("logo.png", items[0].blob);
    }
    
    // Create Config JSON
    const configData = {
      name: "EmojiGen Sticker Pack",
      emoticons: emoticonsConfig
    };
    
    const configFileName = format === 'emoticon' ? 'emoticon.json' : 'config.json';
    rootFolder.file(configFileName, JSON.stringify(configData, null, 2));
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  
  const a = document.createElement("a");
  a.href = url;
  
  // Set correct extension
  if (format === 'emoticon') {
    a.download = "emojigen_pack.emoticon";
  } else if (format === 'wemoji') {
    a.download = "emojigen_pack.wemoji";
  } else {
    a.download = "emojigen_pack.zip";
  }
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};