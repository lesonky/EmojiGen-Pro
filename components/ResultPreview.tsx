import React, { useState } from 'react';
import { GeneratedItem, DownloadFormat } from '../types';
import { Download, Grid, Image as ImageIcon, FileArchive, MessageCircle, Smartphone } from 'lucide-react';
import { downloadAllAsZip } from '../utils/gifUtils';

interface Props {
  items: GeneratedItem[];
  gridImage: string | null;
}

const ResultPreview: React.FC<Props> = ({ items, gridImage }) => {
  const [view, setView] = useState<'items' | 'grid'>('items');
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('zip');

  if (items.length === 0 && !gridImage) return null;

  const handleDownload = () => {
    downloadAllAsZip(items, gridImage, downloadFormat);
  };

  const getItemExtension = (item: GeneratedItem) => {
    if (item.blob.type === 'image/gif') return 'gif';
    if (item.isAnimated) return 'gif';
    return 'png';
  };

  const getItemLabel = (item: GeneratedItem) => {
    const ext = getItemExtension(item).toUpperCase();
    if (item.isAnimated) return ext;
    return `${ext}`;
  };

  return (
    <div className="animate-[fadeIn_0.5s_ease-out]">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-6 gap-4">
        <div className="bg-gray-100 p-1 rounded-lg flex items-center">
          <button
            onClick={() => setView('items')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              view === 'items' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ImageIcon className="w-4 h-4" /> Stickers
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

        {items.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={downloadFormat}
                onChange={(e) => setDownloadFormat(e.target.value as DownloadFormat)}
                className="w-full sm:w-auto appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-sm font-medium cursor-pointer shadow-sm"
              >
                <option value="zip">Standard ZIP (All Files)</option>
                <option value="emoticon">WeChat PC (.emoticon)</option>
                <option value="wemoji">WeChat Android (.wemoji)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Download className="w-4 h-4" /> 
              {downloadFormat === 'zip' && 'Download ZIP'}
              {downloadFormat === 'emoticon' && 'Export .emoticon'}
              {downloadFormat === 'wemoji' && 'Export .wemoji'}
            </button>
          </div>
        )}
      </div>

      {view === 'items' ? (
        <div className={`grid gap-4 sm:gap-6 ${items[0]?.isAnimated ? 'grid-cols-2 md:grid-cols-2 xl:grid-cols-4' : 'grid-cols-3 md:grid-cols-4'}`}>
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              <div className="bg-gray-100 aspect-square flex items-center justify-center relative p-2">
                <img src={item.blobUrl} alt={item.emotion} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="p-3 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-semibold text-gray-800 truncate text-xs sm:text-sm" title={item.emotion}>{item.emotion}</h4>
                  <span className={`inline-block text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500`}>
                    {getItemLabel(item)}
                  </span>
                </div>
                <a 
                  href={item.blobUrl} 
                  download={`${item.emotion.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.${getItemExtension(item)}`}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mt-1"
                >
                  Download
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