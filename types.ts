export type GenerationMode = 'animated' | 'static';

export type DownloadFormat = 'zip' | 'emoticon' | 'wemoji';

export interface GeneratedItem {
  id: string;
  blobUrl: string;
  blob: Blob;
  emotion: string;
  isAnimated: boolean;
}

export interface GenerationStatus {
  step: 'idle' | 'generating_image' | 'processing' | 'complete' | 'error';
  message?: string;
  progress?: number;
}

export interface AppState {
  mode: GenerationMode;
  sourceImage: string | null; // Base64
  emotions: string[];
  customText: string;
  customTextColor: string;
  removeBackground: boolean;
  style: string;
  generatedImage: string | null; // Base64 of the grid
  items: GeneratedItem[];
}

// Extend Window interface for external libraries
declare global {
  interface Window {
    GIF: any;
    JSZip: any;
  }
}