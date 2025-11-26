import React, { useState } from 'react';
import { GeneratedGif } from '../types';
import { Download, Grid, Image as ImageIcon } from 'lucide-react';
import { downloadAllAsZip } from '../utils/gifUtils';

interface Props {
  gifs: GeneratedGif[];
  gridImage: string | null;
}

const ResultPreview: React.FC<Props> = ({ gifs, gridImage }) => {
  const [view, setView] = useState<'gifs' | 'grid'>('gifs');

  if (gifs.length === 0 && !gridImage) return null;

  return (
    <div className="animate-[fadeIn_0.5s_ease-out]">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="bg-gray-100 p-1 rounded-lg flex items-center">
          <button
            onClick={() => setView('gifs')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              view === 'gifs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ImageIcon className="w-4 h-4" /> GIFs
          </button>
          <button
            onClick={() => setView('grid')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              view === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Grid className="w-4 h-4" /> Source Grid
          </button>
        </div>

        {gifs.length > 0 && (
          <button
            onClick={() => downloadAllAsZip(gifs)}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Download className="w-4 h-4" /> Download All (ZIP)
          </button>
        )}
      </div>

      {view === 'gifs' ? (
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {gifs.map((gif) => (
            <div key={gif.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="bg-gray-100 aspect-square flex items-center justify-center relative p-4">
                <img src={gif.blobUrl} alt={gif.emotion} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="p-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-semibold text-gray-800 truncate text-sm sm:text-base">{gif.emotion}</h4>
                  <span className="hidden sm:inline-block text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">GIF</span>
                </div>
                <a 
                  href={gif.blobUrl} 
                  download={`${gif.emotion.replace(/\s+/g, '_')}.gif`}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mt-2"
                >
                  Download <Download className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-hidden">
          {gridImage && (
            <img src={gridImage} alt="Source Grid" className="w-full h-auto rounded-lg" />
          )}
        </div>
      )}
    </div>
  );
};

export default ResultPreview;