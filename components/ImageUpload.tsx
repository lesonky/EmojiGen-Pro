import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface Props {
  onImageSelect: (base64: string) => void;
  selectedImage: string | null;
  onClear: () => void;
}

const ImageUpload: React.FC<Props> = ({ onImageSelect, selectedImage, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onImageSelect(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  if (selectedImage) {
    return (
      <div className="relative group rounded-2xl overflow-hidden shadow-lg border-2 border-indigo-100 w-full bg-gray-100">
        <div className="flex items-center justify-center min-h-[200px] w-full">
          <img 
            src={selectedImage} 
            alt="Uploaded" 
            className="w-full h-auto max-h-[400px] object-contain" 
          />
        </div>
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="bg-white/90 text-red-500 hover:text-red-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transform hover:scale-105 transition-all shadow-md"
          >
            <X className="w-4 h-4" /> Remove Image
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ease-in-out cursor-pointer
        ${dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleChange} 
      />
      <div className="flex flex-col items-center justify-center text-center">
        <div className={`p-4 rounded-full mb-4 ${dragActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
          <Upload className={`w-8 h-8 ${dragActive ? 'text-indigo-600' : 'text-gray-400'}`} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload Reference Image</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Drag & drop or click to upload. This will be the character base for your stickers.
        </p>
      </div>
    </div>
  );
};

export default ImageUpload;