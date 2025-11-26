export interface GeneratedGif {
  id: string;
  blobUrl: string;
  blob: Blob;
  emotion: string;
}

export interface GenerationStatus {
  step: 'idle' | 'generating_image' | 'processing_gifs' | 'complete' | 'error';
  message?: string;
  progress?: number;
}

export interface AppState {
  sourceImage: string | null; // Base64
  emotions: string[];
  customText: string;
  customTextColor: string;
  removeBackground: boolean;
  style: string;
  generatedImage: string | null; // Base64 of the grid
  gifs: GeneratedGif[];
}

// Extend Window interface for external libraries
declare global {
  interface Window {
    GIF: any;
    JSZip: any;
  }
}