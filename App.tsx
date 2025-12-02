import React, { useState } from 'react';
import ApiKeyGuard from './components/ApiKeyGuard';
import ImageUpload from './components/ImageUpload';
import EmotionForm, { Category } from './components/EmotionForm';
import ResultPreview from './components/ResultPreview';
import { generateEmojiSheet, generateEmotionSuggestions } from './services/geminiService';
import { processImageToGifs, processImageToStatic } from './utils/gifUtils';
import { AppState, GenerationStatus, GenerationMode } from './types';
import { Wand2, Eraser, AlertCircle, Check, Image as ImageIcon } from 'lucide-react';

const EMOTION_CATEGORIES: Category[] = [
  { id: 'daily', label: '日常生活', prompt: '日常生活, 轻松愉快, 常用社交回复' },
  { id: 'work', label: '职场打工', prompt: '职场打工人, 加班, 摸鱼, 收到, 崩溃, 阴阳怪气' },
  { id: 'meme', label: '网络热梗', prompt: '当前中国网络最火的流行语, 抽象, 搞笑, 阴阳怪气' },
  { id: 'nonsensical', label: '无厘头', prompt: '发疯文学, 无厘头, 奇怪的知识增加了, 脑洞大开' },
];

const AVATAR_STYLES = [
  'Q版 LINE',
  'JOJO',
  '吉卜力',
  '迪士尼',
  '皮克斯',
  'Chibi',
  '粘土玩偶'
];

const DEFAULT_ANIMATED_EMOTIONS = ['开心', '哭泣', '生气', '点赞'];

const DEFAULT_STATIC_EMOTIONS = [
  "收到", "谢谢大佬", "OK", "达咩", 
  "？", "哈哈哈", "无语", "点赞", 
  "加油", "贴贴", "辛苦了", "甚至想笑", 
  "这种事情见多了", "好的", "没问题", "冲鸭", 
  "摸鱼中", "汗流浃背", "累了", "疑惑", 
  "震惊", "委屈", "泰裤辣", "尊嘟假嘟"
];

const RANDOM_EMOTIONS = ['开心', '难过', '愤怒', '惊讶', '点赞', '拒绝', '好的', '晚安'];

function App() {
  const [state, setState] = useState<AppState>({
    mode: 'animated',
    sourceImage: null,
    emotions: DEFAULT_ANIMATED_EMOTIONS,
    customText: '',
    customTextColor: '#000000',
    removeBackground: false,
    style: 'Q版 LINE',
    generatedImage: null,
    items: [],
  });

  const [status, setStatus] = useState<GenerationStatus>({ step: 'idle' });
  const [emotionCategory, setEmotionCategory] = useState<string>('daily');
  const [isRandomizing, setIsRandomizing] = useState(false);

  const handleModeChange = (mode: GenerationMode) => {
    setState(prev => ({
      ...prev,
      mode,
      emotions: mode === 'animated' ? DEFAULT_ANIMATED_EMOTIONS : DEFAULT_STATIC_EMOTIONS,
      items: [], // Clear previous items on mode switch
      generatedImage: null // Clear previous grid
    }));
  };

  const handleImageSelect = (base64: string) => {
    setState(prev => ({ ...prev, sourceImage: base64 }));
  };

  const handleEmotionChange = (index: number, value: string) => {
    const newEmotions = [...state.emotions];
    newEmotions[index] = value;
    setState(prev => ({ ...prev, emotions: newEmotions }));
  };

  const handleBulkEmotionChange = (value: string) => {
    // Split by newlines or commas
    const list = value.split(/[\n,]+/).map(s => s.trim()).filter(s => s !== '');
    // Limit to 24 for static mode
    const limitedList = list.slice(0, 24);
    setState(prev => ({ ...prev, emotions: limitedList }));
  };

  const handleRandomizeEmotions = async () => {
    setIsRandomizing(true);
    try {
      // Pick a random style
      const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
      
      const category = EMOTION_CATEGORIES.find(c => c.id === emotionCategory) || EMOTION_CATEGORIES[0];
      const count = state.mode === 'animated' ? 4 : 24;
      
      const suggestions = await generateEmotionSuggestions(category.prompt, count);
      
      setState(prev => ({ 
        ...prev, 
        emotions: suggestions,
        style: randomStyle
      }));
    } catch (error) {
      console.error("Randomization failed", error);
      // Fallback
      const count = state.mode === 'animated' ? 4 : 24;
      const fallback = Array(count).fill("").map((_, i) => RANDOM_EMOTIONS[i % RANDOM_EMOTIONS.length]);
      setState(prev => ({ ...prev, emotions: fallback }));
    } finally {
      setIsRandomizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!state.sourceImage) return;

    setStatus({ step: 'generating_image', message: 'Generating sticker sheet with Gemini 3 Pro...' });
    
    // Clear previous results immediately
    setState(prev => ({ ...prev, generatedImage: null, items: [] }));

    try {
      // 1. Generate the grid image
      const generatedGrid = await generateEmojiSheet(
        state.sourceImage,
        state.emotions,
        state.customText,
        state.customTextColor,
        state.style,
        state.mode
      );

      setState(prev => ({ ...prev, generatedImage: generatedGrid }));
      setStatus({ step: 'processing', message: 'Processing stickers...', progress: 0 });

      // 2. Process image (slice and animate/static)
      let items;
      if (state.mode === 'animated') {
        items = await processImageToGifs(
          generatedGrid,
          state.emotions,
          state.removeBackground,
          (progress) => setStatus(prev => ({ ...prev, progress }))
        );
      } else {
        items = await processImageToStatic(
          generatedGrid,
          state.emotions,
          state.removeBackground,
          (progress) => setStatus(prev => ({ ...prev, progress }))
        );
      }

      setState(prev => ({ ...prev, items }));
      setStatus({ step: 'complete' });

    } catch (error) {
      console.error(error);
      setStatus({ step: 'error', message: 'Failed to generate stickers. Please try again.' });
    }
  };

  return (
    <ApiKeyGuard>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-900">
        <header className="max-w-7xl mx-auto mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              EmojiGen Pro
            </h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-6">
            <ImageUpload 
              selectedImage={state.sourceImage}
              onImageSelect={handleImageSelect}
              onClear={() => setState(prev => ({ ...prev, sourceImage: null }))}
            />

            <EmotionForm 
              mode={state.mode}
              onModeChange={handleModeChange}
              emotions={state.emotions}
              categories={EMOTION_CATEGORIES}
              selectedCategory={emotionCategory}
              onCategoryChange={setEmotionCategory}
              onChange={handleEmotionChange}
              onBulkChange={handleBulkEmotionChange}
              onRandomize={handleRandomizeEmotions}
              isRandomizing={isRandomizing}
              customText={state.customText}
              onCustomTextChange={(text) => setState(prev => ({ ...prev, customText: text }))}
              customTextColor={state.customTextColor}
              onCustomTextColorChange={(color) => setState(prev => ({ ...prev, customTextColor: color }))}
              styles={AVATAR_STYLES}
              selectedStyle={state.style}
              onStyleChange={(style) => setState(prev => ({ ...prev, style }))}
            />

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setState(prev => ({ ...prev, removeBackground: !prev.removeBackground }))}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${state.removeBackground ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <span 
                    className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out ${state.removeBackground ? 'translate-x-6' : 'translate-x-0'}`} 
                  />
                </button>
                <div>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Eraser className="w-4 h-4 text-indigo-500" />
                    Remove Background
                  </h3>
                  <p className="text-xs text-gray-500">Auto-detects solid background color and removes it.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!state.sourceImage || status.step === 'generating_image' || status.step === 'processing'}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-all transform active:scale-[0.98]
                ${!state.sourceImage || status.step === 'generating_image' || status.step === 'processing'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-200'
                }`}
            >
              {status.step === 'generating_image' || status.step === 'processing' ? (
                 <span className="flex items-center justify-center gap-2">
                   <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                   {status.step === 'generating_image' ? 'Generating Art...' : `Processing ${Math.round(status.progress || 0)}%...`}
                 </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Wand2 className="w-5 h-5" /> Generate Pack
                </span>
              )}
            </button>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
             {status.step === 'idle' && !state.generatedImage && (
               <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                 <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                   <ImageIcon className="w-12 h-12 text-gray-300" />
                 </div>
                 <h2 className="text-xl font-bold text-gray-400 mb-2">Ready to Create</h2>
                 <p className="text-gray-400 max-w-sm">
                   Upload an image and choose your emotions to generate a custom 4K sticker pack.
                 </p>
               </div>
             )}

             {(status.step === 'generating_image' || status.step === 'processing') && (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
                  <div className="w-full max-w-md">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                       <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                       <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                       <div className="absolute inset-0 flex items-center justify-center">
                         <Wand2 className="w-8 h-8 text-indigo-600" />
                       </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-3">
                      {status.step === 'generating_image' ? 'Creating with Gemini...' : 'Finalizing Stickers...'}
                    </h2>
                    <p className="text-gray-500 animate-pulse">
                      {status.step === 'generating_image' 
                        ? 'Designing characters and layout (this may take ~10-20s)' 
                        : 'Slicing, removing backgrounds, and packaging...'
                      }
                    </p>
                    {status.step === 'processing' && (
                      <div className="mt-6 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                          style={{ width: `${status.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
             )}

             {status.step === 'error' && (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl shadow-sm border border-red-100">
                  <div className="bg-red-50 p-6 rounded-full mb-6">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">Generation Failed</h2>
                  <p className="text-gray-600 max-w-xs mb-6">
                    {status.message || "Something went wrong. Please try again."}
                  </p>
                  <button 
                    onClick={handleGenerate}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
             )}

             {status.step === 'complete' && (
                <ResultPreview 
                  items={state.items} 
                  gridImage={state.generatedImage}
                />
             )}
          </div>
        </main>
      </div>
    </ApiKeyGuard>
  );
}

export default App;