import { GeneratedGif } from "../types";

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

export const processImageToGifs = async (
  imageSrc: string,
  emotions: string[],
  removeBg: boolean,
  onProgress: (percent: number) => void
): Promise<GeneratedGif[]> => {
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
  
  // Square size for final output
  const outputSize = Math.min(cellWidth, cellHeight);

  const gifs: GeneratedGif[] = [];
  const workerScript = await getWorkerBlob();

  // Process each row as a separate GIF
  for (let r = 0; r < rows; r++) {
    const gif = new window.GIF({
      workers: 2,
      quality: 10,
      width: outputSize,
      height: outputSize,
      workerScript: workerScript,
      transparent: removeBg ? 0x000000 : null, // Tell encoder to treat black as transparent if we used it, but we use alpha channel
    });

    for (let c = 0; c < cols; c++) {
      const sx = c * cellWidth;
      const sy = r * cellHeight;

      // Create a temporary canvas for the frame
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = outputSize;
      frameCanvas.height = outputSize;
      const frameCtx = frameCanvas.getContext("2d");
      
      if (!frameCtx) continue;

      // Center crop logic to make it square
      // Calculate source crop to keep aspect ratio
      const side = Math.min(cellWidth, cellHeight);
      const cx = sx + (cellWidth - side) / 2;
      const cy = sy + (cellHeight - side) / 2;

      frameCtx.drawImage(
        canvas,
        cx, cy, side, side,
        0, 0, outputSize, outputSize
      );

      const frameData = frameCtx.getImageData(0, 0, outputSize, outputSize);

      if (removeBg) {
        const d = frameData.data;
        const w = outputSize;
        const h = outputSize;
        
        // Sample background color from the top-left pixel (0,0) of this specific frame
        // This accounts for slight gradients or lighting differences across the main sheet
        const bgR = d[0];
        const bgG = d[1];
        const bgB = d[2];
        
        const tolerance = 15; // Strict tolerance for solid color as requested

        // Helper to check if a pixel matches background color
        // Also checks if already transparent (processed)
        const isBg = (idx: number) => {
           const r = d[idx * 4];
           const g = d[idx * 4 + 1];
           const b = d[idx * 4 + 2];
           const a = d[idx * 4 + 3];
           
           if (a === 0) return false; // Already removed
           
           return (
              Math.abs(r - bgR) <= tolerance &&
              Math.abs(g - bgG) <= tolerance &&
              Math.abs(b - bgB) <= tolerance
           );
        };

        // Flood Fill Algorithm (Iterative BFS/DFS)
        // Start from corners to remove surrounding background
        const stack = [0, w - 1, (h - 1) * w, (h - 1) * w + w - 1];
        
        // Optimize: verify corners are actually background before adding?
        // If the sticker touches the corner, we might eat into it. 
        // But the prompt enforces a grid with padding ("strictly aligned... solid background"), so corners should be safe.
        
        while (stack.length > 0) {
           const idx = stack.pop()!;
           
           if (isBg(idx)) {
               const byteIdx = idx * 4;
               d[byteIdx + 3] = 0; // Make transparent

               const x = idx % w;
               const y = Math.floor(idx / w);

               // Add neighbors
               if (x > 0) stack.push(idx - 1);
               if (x < w - 1) stack.push(idx + 1);
               if (y > 0) stack.push(idx - w);
               if (y < h - 1) stack.push(idx + w);
           }
        }
        
        frameCtx.putImageData(frameData, 0, 0);
      }

      // Add frame to GIF
      // 0.3s per frame = 300ms
      gif.addFrame(frameCtx, { delay: 300, copy: true });
    }

    // Render the GIF
    await new Promise<void>((resolve, reject) => {
      gif.on('finished', (blob: Blob) => {
        gifs.push({
          id: `gif-${r}-${Date.now()}`,
          blob,
          blobUrl: URL.createObjectURL(blob),
          emotion: emotions[r] || `Emotion ${r + 1}`
        });
        resolve();
      });
      gif.render();
    });

    onProgress(((r + 1) / rows) * 100);
  }

  return gifs;
};

export const downloadAllAsZip = async (gifs: GeneratedGif[]) => {
  const zip = new window.JSZip();
  gifs.forEach((gif) => {
    zip.file(`${gif.emotion.replace(/\s+/g, '_')}.gif`, gif.blob);
  });
  
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = "emojigen_pack.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};