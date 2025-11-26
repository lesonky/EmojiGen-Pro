import React, { useState } from 'react';
import ApiKeyGuard from './components/ApiKeyGuard';
import ImageUpload from './components/ImageUpload';
import EmotionForm, { Category } from './components/EmotionForm';
import ResultPreview from './components/ResultPreview';
import { generateEmojiSheet, generateEmotionSuggestions } from './services/geminiService';
import { processImageToGifs } from './utils/gifUtils';
import { AppState, GenerationStatus } from './types';
import { Wand2, Eraser, AlertCircle, Check, Image as ImageIcon } from 'lucide-react';

const EMOTION_CATEGORIES: Category[] = [
  { id: 'daily', label: '日常生活', prompt: '日常生活, 轻松愉快, 常用社交回复' },
  { id: 'work', label: '职场打工', prompt: '职场打工人, 加班, 摸鱼, 收到, 崩溃, 阴阳怪气' },
  { id: 'meme', label: '网络热梗', prompt: '当前中国网络最火的流行语, 抽象, 搞笑' },
  { id: 'funny', label: '搞怪无厘头', prompt: '发疯文学, 阴阳怪气, 无语, 脑洞大开' },
];

const AVATAR_STYLES = [
  "Q版 LINE",
  "JOJO",
  "吉卜力",
  "迪士尼",
  "皮克斯",
  "Chibi",
  "粘土玩偶",
  "毛绒玩偶"
];

function App() {
  const [state, setState] = useState<AppState>({
    sourceImage: null,
    emotions: ['开心', '哭泣', '生气', '点赞'],
    customText: '',
    customTextColor: '#000000',
    removeBackground: false,
    style: 'Q版 LINE',
    generatedImage: null,
    gifs: []
  });

  const [status, setStatus] = useState<GenerationStatus>({ step: 'idle' });
  const [selectedCategory, setSelectedCategory] = useState<string>(EMOTION_CATEGORIES[0].id);
  const [isRandomizing, setIsRandomizing] = useState(false);

  const handleImageSelect = (base64: string) => {
    setState(prev => ({ ...prev, sourceImage: base64 }));
  };

  const handleEmotionChange = (index: number, value: string) => {
    const newEmotions = [...state.emotions];
    newEmotions[index] = value;
    setState(prev => ({ ...prev, emotions: newEmotions }));
  };

  const handleRandomizeEmotions = async () => {
    setIsRandomizing(true);
    try {
      const category = EMOTION_CATEGORIES.find(c => c.id === selectedCategory) || EMOTION_CATEGORIES[0];
      const suggestions = await generateEmotionSuggestions(category.prompt);
      
      // Randomize style
      const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];

      setState(prev => ({ 
        ...prev, 
        emotions: suggestions,
        style: randomStyle
      }));
    } catch (error) {
      console.error("Randomization failed", error);
    } finally {
      setIsRandomizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!state.sourceImage) return;

    // Clear previous results to ensure visual refresh
    setState(prev => ({ ...prev, generatedImage: null, gifs: [] }));

    try {
      // Step 1: Generate Image
      setStatus({ step: 'generating_image', message: 'Dreaming up your stickers with Gemini 3 Pro... (this might take ~30s)' });
      
      const generatedGridBase64 = await generateEmojiSheet(
        state.sourceImage, 
        state.emotions, 
        state.customText,
        state.customTextColor,
        state.style
      );
      
      setState(prev => ({ ...prev, generatedImage: generatedGridBase64 }));

      // Step 2: Process GIFs
      setStatus({ step: 'processing_gifs', message: 'Slicing and animating...', progress: 0 });

      const gifs = await processImageToGifs(
        generatedGridBase64, 
        state.emotions, 
        state.removeBackground,
        (progress) => setStatus(prev => ({ ...prev, progress }))
      );

      setState(prev => ({ ...prev, gifs }));
      setStatus({ step: 'complete' });

    } catch (error) {
      console.error(error);
      setStatus({ 
        step: 'error', 
        message: error instanceof Error ? error.message : "Something went wrong. Please try again." 
      });
    }
  };

  return (
    <ApiKeyGuard>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                EmojiGen Pro
              </h1>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Sidebar: Controls */}
            <div className="lg:col-span-5 space-y-6">
              <ImageUpload 
                onImageSelect={handleImageSelect} 
                selectedImage={state.sourceImage}
                onClear={() => setState(prev => ({ ...prev, sourceImage: null }))}
              />
              
              <EmotionForm 
                emotions={state.emotions} 
                categories={EMOTION_CATEGORIES}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onChange={handleEmotionChange} 
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
                 <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${state.removeBackground ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                    {state.removeBackground && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={state.removeBackground}
                    onChange={(e) => setState(prev => ({...prev, removeBackground: e.target.checked}))}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Eraser className="w-4 h-4 text-indigo-500" />
                      Remove Background
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">Auto-detects solid background color and removes it.</p>
                  </div>
                 </label>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!state.sourceImage || status.step === 'generating_image' || status.step === 'processing_gifs' || isRandomizing}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2
                  ${!state.sourceImage || (status.step !== 'idle' && status.step !== 'complete' && status.step !== 'error') || isRandomizing
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-indigo-200'}`}
              >
                {status.step === 'generating_image' ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : status.step === 'processing_gifs' ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing GIFs {Math.round(status.progress || 0)}%
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" /> Generate Pack
                  </>
                )}
              </button>

              {status.step === 'error' && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 lg:hidden">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{status.message}</p>
                </div>
              )}
            </div>

            {/* Right Side: Results */}
            <div className="lg:col-span-7">
              {(status.step === 'generating_image' || status.step === 'processing_gifs') ? (
                <div className="h-full min-h-[400px] border border-gray-100 rounded-3xl flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-white shadow-sm">
                  <div className="relative mb-6">
                    <div className="h-16 w-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Wand2 className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {status.step === 'generating_image' ? 'Generating Artwork...' : 'Animating Stickers...'}
                  </h2>
                  <p className="max-w-xs text-gray-500 animate-pulse">{status.message}</p>
                </div>
              ) : status.step === 'error' ? (
                 <div className="h-full min-h-[400px] border border-red-100 rounded-3xl flex flex-col items-center justify-center text-red-500 p-8 text-center bg-red-50/50">
                    <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                    <h2 className="text-xl font-semibold mb-2">Generation Failed</h2>
                    <p className="max-w-xs text-red-400">{status.message}</p>
                </div>
              ) : !state.generatedImage ? (
                <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/50">
                  <div className="bg-gray-100 p-6 rounded-full mb-4">
                    <ImageIcon className="w-10 h-10 text-gray-300" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Ready to Create</h2>
                  <p className="max-w-xs">Upload an image and choose your emotions to generate a custom 4K sticker pack.</p>
                </div>
              ) : (
                <ResultPreview gifs={state.gifs} gridImage={state.generatedImage} />
              )}
            </div>
          </div>
        </main>
      </div>
    </ApiKeyGuard>
  );
}

export default App;