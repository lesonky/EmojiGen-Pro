import React from 'react';
import { Sparkles, Dices, Loader2, ChevronDown, Type, Palette, Paintbrush, Video, Grid3X3, Edit3 } from 'lucide-react';
import { GenerationMode } from '../types';

export interface Category {
  id: string;
  label: string;
  prompt: string;
}

interface Props {
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  emotions: string[];
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
  onChange: (index: number, value: string) => void;
  onBulkChange: (value: string) => void;
  onRandomize: () => void;
  isRandomizing: boolean;
  customText: string;
  onCustomTextChange: (text: string) => void;
  customTextColor: string;
  onCustomTextColorChange: (color: string) => void;
  styles: string[];
  selectedStyle: string;
  onStyleChange: (style: string) => void;
}

const EmotionForm: React.FC<Props> = ({ 
  mode,
  onModeChange,
  emotions, 
  categories,
  selectedCategory,
  onCategoryChange,
  onChange,
  onBulkChange,
  onRandomize,
  isRandomizing,
  customText,
  onCustomTextChange,
  customTextColor,
  onCustomTextColorChange,
  styles,
  selectedStyle,
  onStyleChange
}) => {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      
      {/* Mode Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
        <button
          onClick={() => onModeChange('animated')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'animated' 
            ? 'bg-white text-indigo-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Video className="w-4 h-4" /> Animated (4 GIFs)
        </button>
        <button
          onClick={() => onModeChange('static')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'static' 
            ? 'bg-white text-indigo-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Grid3X3 className="w-4 h-4" /> Static (24 PNGs)
        </button>
      </div>

      <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-start xl:items-center justify-between mb-6 gap-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          {mode === 'animated' ? 'Emotions (4 Sets)' : 'Emotions (24 Items)'}
        </h3>
      </div>
      
      {mode === 'animated' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {emotions.slice(0, 4).map((emotion, index) => (
            <div key={index} className="relative">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 ml-1">
                Emotion {index + 1}
              </label>
              <input
                type="text"
                value={emotion}
                onChange={(e) => onChange(index, e.target.value)}
                placeholder={`Example: ${['开心', '愤怒', '悲伤', '兴奋'][index]}`}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 ml-1 flex justify-between">
            <span>Emotion List (Comma separated or one per line)</span>
            <span className="text-indigo-500">{emotions.length} / 24</span>
          </label>
          <div className="relative">
            <Edit3 className="w-4 h-4 text-gray-400 absolute top-3 left-3" />
            <textarea
              value={emotions.join(', ')}
              onChange={(e) => onBulkChange(e.target.value)}
              placeholder="Enter 24 emotions here..."
              className="w-full px-4 pl-10 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white min-h-[160px] text-sm leading-relaxed"
            />
          </div>
        </div>
      )}

      <div className="mb-6 pt-4 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
          <Paintbrush className="w-4 h-4 text-pink-500" />
          Avatar Style
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {styles.map(style => (
            <button
              key={style}
              onClick={() => onStyleChange(style)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                 selectedStyle === style
                 ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                 : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={selectedStyle}
          onChange={(e) => onStyleChange(e.target.value)}
          placeholder="Or type a custom style (e.g. Cyberpunk, Pixel Art)..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white text-sm"
        />
      </div>

      <div className="mb-6 pt-4 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
          <Type className="w-4 h-4 text-purple-500" />
          Exclusive Custom Text (Optional)
        </h3>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder="e.g. By EmojiGen (Add text to all stickers)"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white"
          />
          <div className="relative group">
            <input
              type="color"
              value={customTextColor}
              onChange={(e) => onCustomTextColorChange(e.target.value)}
              className="absolute opacity-0 w-full h-full cursor-pointer z-10"
              title="Choose text color"
            />
            <div 
              className="w-12 h-full rounded-xl border border-gray-200 flex items-center justify-center transition-all shadow-sm group-hover:border-purple-300"
              style={{ backgroundColor: customTextColor }}
            >
              <Palette className={`w-5 h-5 drop-shadow-md ${['#ffffff', '#fff', 'white'].includes(customTextColor.toLowerCase()) ? 'text-gray-400' : 'text-white'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100 shadow-sm">
          <div className="relative flex items-center">
            <select 
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="bg-transparent text-sm font-medium text-gray-700 pl-3 pr-8 py-2 outline-none border-r border-gray-200 cursor-pointer appearance-none min-w-[100px]"
              disabled={isRandomizing}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 pointer-events-none" />
          </div>
          
          <button
            onClick={onRandomize}
            disabled={isRandomizing}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5 px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-wait whitespace-nowrap hover:bg-white rounded-md"
          >
            {isRandomizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Dices className="w-4 h-4" />
            )}
            {isRandomizing ? 'Thinking...' : "I'm feeling lucky"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmotionForm;