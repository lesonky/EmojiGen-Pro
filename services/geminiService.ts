import { GoogleGenAI, Type } from "@google/genai";

export const checkApiKey = async (): Promise<boolean> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    return await window.aistudio.hasSelectedApiKey();
  }
  return false;
};

export const requestApiKey = async (): Promise<void> => {
  if (window.aistudio && window.aistudio.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    console.warn("AI Studio Auth not available in this environment");
  }
};

export const generateEmotionSuggestions = async (categoryPrompt: string, count: number = 4): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Generate ${count} distinct, creative, and short (1-8 characters) Chinese emotion names or phrases for a sticker pack.
      Target Audience/Style: ${categoryPrompt}.
      
      Examples of style:
      - Daily: 开心, 难过, 晚安, 谢谢, 好的, 没问题
      - Work: 收到, 加班中, 摸鱼, 只要干不死, 就往死里干
      - Meme: 泰裤辣, 尊嘟假嘟, 汗流浃背, 破防了, 急了
      
      Requirements:
      - Strictly return a JSON array of strings.
      - No duplicate meanings if possible.
      - Total count must be exactly ${count}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) {
      // Fallback
      return Array(count).fill("").map((_, i) => `表情${i+1}`);
    }
    const parsed = JSON.parse(text);
    // Ensure we have exactly the requested amount
    if (parsed.length < count) {
      return [...parsed, ...Array(count - parsed.length).fill("新表情")];
    }
    return parsed.slice(0, count);
  } catch (error) {
    console.error("Failed to generate emotions:", error);
    // Fallback if API fails
    return Array(count).fill("").map((_, i) => `表情${i+1}`);
  }
};

export const generateEmojiSheet = async (
  base64Image: string,
  emotions: string[],
  customText: string,
  customTextColor: string,
  style: string = "Q版 LINE",
  mode: 'animated' | 'static' = 'animated'
): Promise<string> => {
  // Always create a new instance to ensure the latest key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const customTextInstruction = customText 
    ? `专属定制文字：在每个表情画面的**底部正中间**（或不遮挡主体的合适位置），必须加上固定的定制文字“${customText}”。该文字必须清晰可见，颜色必须严格使用“${customTextColor}”，字体风格与整体画风保持一致，且在所有 24 个格子中的位置和大小必须严格保持一致（类似水印效果）。` 
    : "";

  const targetStyle = style && style.trim() !== "" ? style : "Q版 LINE";

  let layoutInstruction = "";
  if (mode === 'animated') {
    layoutInstruction = `
布局结构：严格使用 4x6 网格布局。内容包含 ${emotions.length} 个表情（${emotions.join(', ')}）。
动画逻辑：每个表情占据一整排（6 格），这 6 格构成一个流畅的连续动作序列（关键帧）。每一帧都必须是画质精细、结构完整的半身像，且每一帧旁边都要包含对应表情的**手写简体中文**配文。`;
  } else {
    // Static mode
    layoutInstruction = `
布局结构：严格使用 4x6 网格布局，共 24 个格子。
内容逻辑：请生成 **24 个完全不同的表情**，对应以下列表：
${emotions.join(', ')}。
每个格子放置一个独立的表情，无需连续动作。每个表情都必须是画质精细、结构完整的半身像，且旁边都要包含对应表情的**手写简体中文**配文。`;
  }

  const prompt = `请深度分析原图中角色的**关键外貌特征**（如发型、发色、眼睛形状、衣着纹理及头饰配件），在精准还原这些特征并保持极高辨识度的基础上，为我生成该角色的绘制 ${targetStyle} 风格半身像贴纸表情包。
  
画面风格：${targetStyle} 风格，画风可爱生动。
${layoutInstruction}
${customTextInstruction}
增强表现：请根据表情含义，灵活使用丰富的小道具（如漫符、特效、心情符号）来增强情绪表达。
其他硬性需求：不要原图复制，必须进行二创。严格对齐 4x6 网格，确保每个表情都独立居中于网格内，互不粘连，便于程序裁切。背景色需为与角色主体区分度高的纯色（如浅灰），方便自动去背景。
`;

  const mimeType = base64Image.substring(
    base64Image.indexOf(":") + 1,
    base64Image.indexOf(";")
  );
  const data = base64Image.split(",")[1];

  try {
    // Using gemini-3-pro-image-preview for high quality output
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType,
              data,
            },
          },
        ],
      },
      config: {
        imageConfig: {
          imageSize: "2K",
          aspectRatio: "3:2", // 4x6 grid fits well in 3:2 landscape
        },
      },
    });

    // Extract image from response
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image generated.");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};