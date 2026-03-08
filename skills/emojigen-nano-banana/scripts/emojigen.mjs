#!/usr/bin/env node

import { GoogleGenAI, Type } from '@google/genai';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const IMAGE_MODEL_ALIASES = {
  'gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',
  'nano-banana-pro': 'gemini-3-pro-image-preview',
  'nano banana pro': 'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image-preview',
  'nano-banana-2': 'gemini-3.1-flash-image-preview',
  'nano banana 2': 'gemini-3.1-flash-image-preview',
};

const DEFAULTS = {
  mode: 'animated',
  animatedCount: 4,
  emotions: ['开心', '哭泣', '生气', '点赞'],
  style: 'Q版 LINE',
  customText: '',
  customTextColor: '#000000',
  removeBackground: false,
  categoryPrompt: '日常生活, 轻松愉快, 常用社交回复',
  characterNotes: '',
  propNotes: '',
  negativeNotes: '',
  imageModel:
    process.env.NANO_BANANA_MODEL ||
    process.env.EMOJIGEN_IMAGE_MODEL ||
    'gemini-3-pro-image-preview',
  imageAspectRatio: '3:2',
  imageSize: '2K',
  textModel: process.env.EMOJIGEN_TEXT_MODEL || '',
};

const HELP = `Usage:
  node skills/emojigen-nano-banana/scripts/emojigen.mjs stage-image [--input avatar.png | --from-clipboard] [--out staged.png] [--tmp-dir /tmp]
  node skills/emojigen-nano-banana/scripts/emojigen.mjs preflight --config config.json [--reference avatar.png | --from-clipboard]
  node skills/emojigen-nano-banana/scripts/emojigen.mjs suggest-emotions --category "<text>" --count 4 [--out emotions.json]
  node skills/emojigen-nano-banana/scripts/emojigen.mjs build-prompt --config config.json [--out prompt.txt]
  node skills/emojigen-nano-banana/scripts/emojigen.mjs generate-grid --config config.json [--reference avatar.png | --from-clipboard] [--out grid.png] [--image-model model]
  node skills/emojigen-nano-banana/scripts/emojigen.mjs make-assets --config config.json --grid grid.png --out-dir output/ [--deliver-dir workspace-output] [--cleanup-temp]
  node skills/emojigen-nano-banana/scripts/emojigen.mjs run --config config.json [--reference avatar.png | --from-clipboard] --out-dir output/ [--deliver-dir workspace-output] [--cleanup-temp]
`;

async function main() {
  const { command, options } = parseCli(process.argv.slice(2));

  if (!command || options.help) {
    console.log(HELP.trim());
    process.exit(command ? 0 : 1);
  }

  if (!['stage-image', 'preflight', 'suggest-emotions', 'build-prompt', 'generate-grid', 'make-assets', 'run'].includes(command)) {
    throw new Error(`Unsupported command: ${command}`);
  }

  if (command === 'stage-image') {
    const stagedPath = await stageImage({
      inputPath: options.input,
      fromClipboard: Boolean(options['from-clipboard']),
      outPath: options.out,
      tmpDir: options['tmp-dir'],
    });
    console.log(stagedPath);
    return;
  }

  if (command === 'suggest-emotions') {
    const category = options.category || DEFAULTS.categoryPrompt;
    const count = Number(options.count || 4);
    const textModel = options['text-model'] || DEFAULTS.textModel || null;
    const emotions = await suggestEmotions({ category, count, textModel });
    await writeOutput(options.out, emotions);
    return;
  }

  const config = await loadConfig(options.config);

  if (command === 'preflight') {
    const stagedReferencePath = await resolveReferencePath(options);
    const resolvedConfig = await ensureEmotions(config);
    const backend = await inspectBackend();
    const result = {
      stagedReferencePath,
      backend,
      resolvedConfig,
      ready: Boolean(stagedReferencePath) && backend.ready,
      nextStep: Boolean(stagedReferencePath) && backend.ready ? 'run' : 'fix-missing-inputs',
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'build-prompt') {
    const prompt = buildPrompt(await ensureEmotions(config));
    await writeText(options.out || 'prompt.txt', prompt);
    return;
  }

  if (command === 'generate-grid') {
    const referencePath = await resolveReferencePath(options);
    const outPath = options.out || 'grid.png';
    const resolvedConfig = await ensureEmotions(config);
    const prompt = buildPrompt(resolvedConfig);

    await ensureDir(path.dirname(outPath));
    const gridPath = await generateGrid({
      referencePath,
      prompt,
      outPath,
      imageModel: resolveImageModel(options['image-model'] || resolvedConfig.imageModel || DEFAULTS.imageModel),
    });

    await writeText(replaceExt(gridPath, '.prompt.txt'), prompt);
    await writeJson(replaceExt(gridPath, '.config.json'), resolvedConfig);
    console.log(gridPath);
    return;
  }

  if (command === 'make-assets') {
    const gridPath = requireOption(options.grid, '--grid');
    const outDir = options['out-dir'] || path.join(process.cwd(), 'emojigen-output');
    const manifest = await makeAssets({ config, gridPath, outDir });
    const finalManifest = await finalizeDelivery({
      manifest,
      sourceDir: outDir,
      deliverDir: options['deliver-dir'],
      cleanupTemp: Boolean(options['cleanup-temp']),
    });
    console.log(JSON.stringify(finalManifest, null, 2));
    return;
  }

  if (command === 'run') {
    const referencePath = await resolveReferencePath(options);
    const outDir = options['out-dir'] || path.join(process.cwd(), 'emojigen-output');
    await ensureDir(outDir);

    const resolvedConfig = await ensureEmotions(config);
    const prompt = buildPrompt(resolvedConfig);
    const promptPath = path.join(outDir, 'prompt.txt');
    const configPath = path.join(outDir, 'resolved-config.json');
    const requestedGridPath = path.join(outDir, 'grid.png');

    await writeText(promptPath, prompt);
    await writeJson(configPath, resolvedConfig);
    const gridPath = await generateGrid({
      referencePath,
      prompt,
      outPath: requestedGridPath,
      imageModel: resolveImageModel(options['image-model'] || resolvedConfig.imageModel || DEFAULTS.imageModel),
    });

    const manifest = await makeAssets({ config: resolvedConfig, gridPath, outDir });
    manifest.prompt = promptPath;
    manifest.config = configPath;
    await writeJson(path.join(outDir, 'manifest.json'), manifest);
    const finalManifest = await finalizeDelivery({
      manifest,
      sourceDir: outDir,
      deliverDir: options['deliver-dir'],
      cleanupTemp: Boolean(options['cleanup-temp']),
      stagedReferencePath: referencePath,
    });
    console.log(JSON.stringify(finalManifest, null, 2));
  }
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    i += 1;
  }

  return { command, options };
}

async function loadConfig(configPath) {
  const filePath = requireOption(configPath, '--config');
  const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
  return normalizeConfig(raw);
}

function normalizeConfig(input) {
  const mode = input.mode === 'static' ? 'static' : 'animated';
  const rawAnimatedCount = Number(input.animatedCount);
  const animatedCount = [1, 2, 4].includes(rawAnimatedCount) ? rawAnimatedCount : DEFAULTS.animatedCount;
  const hasExplicitEmotions = Object.prototype.hasOwnProperty.call(input, 'emotions');
  const emotions = Array.isArray(input.emotions)
    ? input.emotions.map((item) => String(item).trim()).filter(Boolean)
    : hasExplicitEmotions
      ? []
      : [...DEFAULTS.emotions];
  const config = {
    ...DEFAULTS,
    ...input,
    mode,
    animatedCount,
    emotions,
    removeBackground: Boolean(input.removeBackground),
  };

  config.imageModel = resolveImageModel(config.imageModel || DEFAULTS.imageModel);
  config.imageAspectRatio = '3:2';
  config.imageSize = '2K';

  if (config.mode === 'animated') {
    if (![1, 2, 4].includes(config.animatedCount)) {
      throw new Error('Animated mode only supports 1, 2, or 4 GIFs.');
    }
    if (config.emotions.length > config.animatedCount) {
      config.emotions = config.emotions.slice(0, config.animatedCount);
    }
    if (config.emotions.length > 0 && config.emotions.length < config.animatedCount) {
      const fallback = DEFAULTS.emotions.slice(0, config.animatedCount - config.emotions.length);
      config.emotions = [...config.emotions, ...fallback];
    }
  }

  if (config.mode === 'static' && config.emotions.length > 24) {
    config.emotions = config.emotions.slice(0, 24);
  }

  return config;
}

function buildPrompt(config) {
  const customTextInstruction = config.customText
    ? `专属定制文字：在每个表情画面的底部正中间或不遮挡主体的位置，加入固定文字“${config.customText}”。文字颜色必须严格使用“${config.customTextColor}”，在所有格子中的位置、大小和内容保持一致。`
    : '';

  let layoutInstruction = '';
  if (config.mode === 'animated') {
    if (config.animatedCount === 1) {
      layoutInstruction = `布局结构：严格使用 4x6 网格布局，共 24 个格子。内容逻辑：这 24 个格子构成唯一的一个长连贯动画序列，主题是“${config.emotions[0]}”。请从左上到右下连续推进动作，每一帧都必须是结构完整的半身像。`;
    } else if (config.animatedCount === 2) {
      layoutInstruction = `布局结构：严格使用 4x6 网格布局，共 24 个格子。前 12 格对应“${config.emotions[0]}”，后 12 格对应“${config.emotions[1]}”。每组都要形成流畅的连续动作序列。`;
    } else {
      layoutInstruction = `布局结构：严格使用 4x6 网格布局。内容包含 ${config.emotions.length} 个表情：${config.emotions.join('、')}。每个表情占据一整排 6 格，构成一个完整连续动作序列，每一帧旁边都要有对应的手写简体中文配文。`;
    }
  } else {
    layoutInstruction = `布局结构：严格使用 4x6 网格布局，共 24 个格子。内容逻辑：请生成 24 个完全不同的表情，对应以下列表：${config.emotions.join('、')}。每个格子放置一个独立表情，无需连续动作。`;
  }

  const extraNotes = [
    config.characterNotes ? `角色还原要求：${config.characterNotes}` : '',
    config.propNotes ? `道具与表现：${config.propNotes}` : '',
    config.negativeNotes ? `避坑要求：${config.negativeNotes}` : '',
  ].filter(Boolean).join('\n');
  const squareSafetyInstruction = '裁切安全区要求：每个格子最终都会被裁成正方形贴纸。请把人物主体稳定放在单格正中心附近，头部、脸部、双手和关键道具都必须落在单格中心安全区内，不要贴边，不要越过格线。动态序列中每一帧的人物尺度、机位、朝向锚点和身体中心要尽量一致，只让表情和动作变化，避免大幅位移，否则后续合成 GIF 会抖动。';

  return `请深度分析参考图中角色的关键外貌特征，如发型、发色、眼睛形状、衣着纹理和头饰配件。在精准还原辨识度的基础上，为该角色生成 ${config.style} 风格的半身像贴纸表情包。

画面风格：${config.style} 风格，画风可爱生动，强调二创感，不要直接复制原图。
${layoutInstruction}
${customTextInstruction}
增强表现：根据表情含义灵活使用漫符、特效、心情符号和小道具来增强情绪表达。
背景要求：所有格子都使用与主体区分度高的纯色背景，方便后处理去背景。
构图要求：严格对齐 4x6 网格，确保每个表情都独立居中于网格内，互不粘连，便于程序裁切。
${squareSafetyInstruction}
${extraNotes}`.trim();
}

async function suggestEmotions({ category, count, textModel }) {
  if (!textModel) {
    return generateLocalEmotionSuggestions({ category, count });
  }

  const ai = createClient();
  const response = await ai.models.generateContent({
    model: textModel,
    contents: [{
      role: 'user',
      parts: [{
        text: `请为一个中文表情包生成 ${count} 个短情绪词或短句，适合直接作为表情标签。

目标语境：${category}

要求：
- 只返回 JSON 字符串数组。
- 每项尽量控制在 1 到 8 个汉字。
- 含义尽量不要重复。
- 总数必须是 ${count}。`,
      }],
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  const parsed = JSON.parse(response.text || '[]');
  const cleaned = Array.isArray(parsed)
    ? parsed.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (cleaned.length >= count) {
    return cleaned.slice(0, count);
  }

  const fallback = [];
  for (let index = cleaned.length; index < count; index += 1) {
    fallback.push(`表情${index + 1}`);
  }
  return [...cleaned, ...fallback];
}

function generateLocalEmotionSuggestions({ category, count }) {
  const normalized = String(category || '').toLowerCase();
  const pools = [
    {
      match: /(work|职场|打工|上班|加班|摸鱼|办公)/,
      values: ['收到', '摸鱼', '裂开', '先忙', '催命', '下班', '辛苦了', '开摆', '加油', '稍等', '马上', '已读', '忙飞了', '崩溃', '会的', '安排'],
    },
    {
      match: /(meme|热梗|搞笑|抽象|发疯|无厘头)/,
      values: ['蚌埠住了', '急了', '笑死', '离谱', '破防了', '尊嘟假嘟', '汗流浃背', '有点东西', '啊这', '离大谱', '逆天', '绷不住', '真有你的', '就这', '太抽象了', '我服了'],
    },
    {
      match: /(daily|日常|轻松|社交|可爱|聊天)/,
      values: ['嘿嘿', '贴贴', '收到啦', '好耶', '晚安', '抱抱', '疑惑', '震惊', '开心', '委屈', '无语', '点赞', '辛苦了', 'OK', '谢谢', '早安'],
    },
  ];

  const matched = pools.find((pool) => pool.match.test(normalized));
  const seed = matched
    ? [...matched.values]
    : ['嘿嘿', '贴贴', '震惊', '摸鱼', '好耶', '收到啦', '疑惑', '抱抱', '开心', '无语', '点赞', '委屈', '收到', '辛苦了', '谢谢', 'OK'];
  return seed.slice(0, count);
}

async function ensureEmotions(config) {
  if (Array.isArray(config.emotions) && config.emotions.length > 0) {
    if (config.mode === 'animated') {
      return {
        ...config,
        emotions: config.emotions.slice(0, config.animatedCount),
      };
    }
    if (config.mode === 'static' && config.emotions.length < 24) {
      const generated = generateLocalEmotionSuggestions({
        category: config.categoryPrompt || '日常社交回复, 可爱, 聊天表情',
        count: 24,
      });
      const merged = [];
      const seen = new Set();
      for (const emotion of [...config.emotions, ...generated]) {
        if (!seen.has(emotion)) {
          seen.add(emotion);
          merged.push(emotion);
        }
        if (merged.length === 24) break;
      }
      while (merged.length < 24) {
        merged.push(`表情${merged.length + 1}`);
      }
      return {
        ...config,
        emotions: merged,
      };
    }
    if (config.mode === 'static') {
      return {
        ...config,
        emotions: config.emotions.slice(0, 24),
      };
    }
    return config;
  }

  if (!config.categoryPrompt) {
    throw new Error('Missing emotions and categoryPrompt. Provide an emotion list or a category prompt before generation.');
  }

  return {
    ...config,
    emotions: await suggestEmotions({
      category: config.categoryPrompt,
      count: config.mode === 'animated' ? config.animatedCount : 24,
      textModel: config.textModel || DEFAULTS.textModel || null,
    }),
  };
}

async function generateGrid({ referencePath, prompt, outPath, imageModel }) {
  const ai = createClient();
  const inlineData = await fileToInlineData(referencePath);
  const response = await ai.models.generateContent({
    model: imageModel,
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData },
      ],
    }],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '3:2',
        imageSize: '2K',
      },
    },
  });

  const part = findInlineImagePart(response);
  if (!part) {
    throw new Error(`No image data returned from model ${imageModel}.`);
  }

  const mimeType = part.inlineData.mimeType || 'image/png';
  const extension = mimeTypeToExt(mimeType);
  const finalPath = path.extname(outPath) ? outPath : `${outPath}${extension}`;
  await ensureDir(path.dirname(finalPath));
  await fs.writeFile(finalPath, Buffer.from(part.inlineData.data, 'base64'));
  return finalPath;
}

async function makeAssets({ config, gridPath, outDir }) {
  await ensureDir(outDir);
  const stickersDir = path.join(outDir, 'stickers');
  await ensureDir(stickersDir);

  const { width, height } = await identifyImage(gridPath);
  const rows = 4;
  const cols = 6;
  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);
  const side = Math.min(cellWidth, cellHeight);

  const manifest = {
    mode: config.mode,
    grid: gridPath,
    stickersDir,
    items: [],
  };

  if (config.mode === 'animated') {
    const framesPerGif = (rows * cols) / config.animatedCount;
    const delay = config.animatedCount === 1 ? 5 : config.animatedCount === 2 ? 10 : 30;

    for (let gifIndex = 0; gifIndex < config.animatedCount; gifIndex += 1) {
      const emotion = sanitizeName(config.emotions[gifIndex] || `emotion-${gifIndex + 1}`);
      const emotionDir = path.join(stickersDir, emotion);
      const framesDir = path.join(emotionDir, 'frames');
      await ensureDir(framesDir);

      const framePaths = [];
      for (let frameIndex = 0; frameIndex < framesPerGif; frameIndex += 1) {
        const globalIndex = gifIndex * framesPerGif + frameIndex;
        const row = Math.floor(globalIndex / cols);
        const col = globalIndex % cols;
        const x = col * cellWidth + Math.floor((cellWidth - side) / 2);
        const y = row * cellHeight + Math.floor((cellHeight - side) / 2);
        const framePath = path.join(framesDir, `${String(frameIndex + 1).padStart(2, '0')}.png`);

        await cropFrame({ input: gridPath, output: framePath, side, x, y });
        if (config.removeBackground) {
          await removeCornerBackground(framePath);
        }
        framePaths.push(framePath);
      }

      const gifPath = path.join(emotionDir, `${emotion}.gif`);
      await createGif({ framePaths, gifPath, delay });
      manifest.items.push({
        emotion: config.emotions[gifIndex] || `Emotion ${gifIndex + 1}`,
        type: 'gif',
        frames: framePaths,
        output: gifPath,
      });
    }
  } else {
    const total = rows * cols;
    for (let index = 0; index < total; index += 1) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = col * cellWidth + Math.floor((cellWidth - side) / 2);
      const y = row * cellHeight + Math.floor((cellHeight - side) / 2);
      const emotion = sanitizeName(config.emotions[index] || `sticker-${index + 1}`);
      const output = path.join(stickersDir, `${String(index + 1).padStart(2, '0')}-${emotion}.png`);

      await cropFrame({ input: gridPath, output, side, x, y });
      if (config.removeBackground) {
        await removeCornerBackground(output);
      }

      manifest.items.push({
        emotion: config.emotions[index] || `Emotion ${index + 1}`,
        type: 'png',
        output,
      });
    }
  }

  await writeJson(path.join(outDir, 'manifest.json'), manifest);
  manifest.quality = await assessAssetQuality({
    manifest,
    removeBackground: config.removeBackground,
  });
  await writeJson(path.join(outDir, 'manifest.json'), manifest);
  return manifest;
}

async function finalizeDelivery({ manifest, sourceDir, deliverDir, cleanupTemp, stagedReferencePath }) {
  let nextManifest = { ...manifest };

  if (deliverDir) {
    await deliverOutputs(sourceDir, deliverDir);
    nextManifest = {
      ...nextManifest,
      deliveredTo: deliverDir,
    };
  }

  if (cleanupTemp) {
    if (deliverDir && isManagedTempPath(sourceDir)) {
      await fs.rm(sourceDir, { recursive: true, force: true });
      nextManifest = {
        ...nextManifest,
        tempCleaned: true,
      };
    }

    if (stagedReferencePath && isManagedTempPath(stagedReferencePath)) {
      await fs.rm(stagedReferencePath, { recursive: true, force: true });
      nextManifest = {
        ...nextManifest,
        stagedReferenceCleaned: true,
      };
    }
  }

  return nextManifest;
}

async function deliverOutputs(sourceDir, deliverDir) {
  await ensureDir(path.dirname(deliverDir));
  await fs.rm(deliverDir, { recursive: true, force: true });
  await fs.cp(sourceDir, deliverDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    filter: (item) => path.basename(item) !== '.DS_Store',
  });
}

async function cropFrame({ input, output, side, x, y }) {
  await ensureCommand('magick');
  await runCommand('magick', [
    input,
    '-crop',
    `${side}x${side}+${x}+${y}`,
    '+repage',
    output,
  ]);
}

async function removeCornerBackground(imagePath) {
  await ensureCommand('magick');
  const { width, height } = await identifyImage(imagePath);
  const corners = [
    `1,1`,
    `${Math.max(width - 2, 1)},1`,
    `1,${Math.max(height - 2, 1)}`,
    `${Math.max(width - 2, 1)},${Math.max(height - 2, 1)}`,
  ];
  await runCommand('magick', [
    imagePath,
    '-alpha',
    'set',
    '-fuzz',
    '10%',
    '-fill',
    'none',
    ...corners.flatMap((point) => ['-draw', `color ${point} floodfill`]),
    imagePath,
  ]);
}

async function assessAssetQuality({ manifest, removeBackground }) {
  const report = {
    status: 'ok',
    warnings: [],
  };

  if (!removeBackground || manifest.mode !== 'animated') {
    return report;
  }

  for (const item of manifest.items) {
    const frameMetrics = [];
    for (const framePath of item.frames || []) {
      const metrics = await getFrameSubjectMetrics(framePath);
      if (metrics) {
        frameMetrics.push(metrics);
      }
    }

    if (frameMetrics.length === 0) {
      report.warnings.push(`${item.emotion}: unable to compute subject bounds from transparent frames.`);
      continue;
    }

    const side = frameMetrics[0].side;
    const edgeMargin = side * 0.08;
    const anchorTolerance = side * 0.1;
    const nearEdge = frameMetrics.some((metric) =>
      metric.x < edgeMargin ||
      metric.y < edgeMargin ||
      metric.x + metric.width > side - edgeMargin ||
      metric.y + metric.height > side - edgeMargin,
    );

    if (nearEdge) {
      report.warnings.push(`${item.emotion}: subject is too close to the crop edge in at least one frame.`);
    }

    const anchorX = frameMetrics[0].centerX;
    const anchorY = frameMetrics[0].centerY;
    const drifting = frameMetrics.some((metric) =>
      Math.abs(metric.centerX - anchorX) > anchorTolerance ||
      Math.abs(metric.centerY - anchorY) > anchorTolerance,
    );

    if (drifting) {
      report.warnings.push(`${item.emotion}: subject anchor drifts too much across frames for a stable GIF.`);
    }
  }

  if (report.warnings.length > 0) {
    report.status = 'warn';
  }

  return report;
}

async function getFrameSubjectMetrics(framePath) {
  await ensureCommand('magick');
  const result = await runCommand('magick', [
    framePath,
    '-alpha',
    'extract',
    '-threshold',
    '0',
    '-trim',
    '-format',
    '%@',
    'info:',
  ]);
  const bounds = parseBoundingBox(result.stdout.trim());
  if (!bounds) {
    return null;
  }
  const { width: side } = await identifyImage(framePath);
  return {
    ...bounds,
    side,
    centerX: bounds.x + bounds.width / 2,
    centerY: bounds.y + bounds.height / 2,
  };
}

function parseBoundingBox(value) {
  const match = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(value);
  if (!match) {
    return null;
  }
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4]),
  };
}

async function createGif({ framePaths, gifPath, delay }) {
  await ensureCommand('magick');
  const args = ['-dispose', 'previous', '-delay', String(delay), '-loop', '0', ...framePaths, gifPath];
  await runCommand('magick', args);
}

async function identifyImage(imagePath) {
  await ensureCommand('magick');
  const result = await runCommand('magick', ['identify', '-format', '%w %h', imagePath]);
  const [width, height] = result.stdout.trim().split(/\s+/).map(Number);
  if (!width || !height) {
    throw new Error(`Failed to identify image size for ${imagePath}`);
  }
  return { width, height };
}

function createClient() {
  const useVertex = parseBoolean(process.env.GOOGLE_GENAI_USE_VERTEXAI);
  if (useVertex) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    if (!project) {
      throw new Error('Vertex AI mode requires GOOGLE_CLOUD_PROJECT.');
    }
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('Missing Gemini credentials. Set GEMINI_API_KEY, GOOGLE_API_KEY, or enable Vertex AI with GOOGLE_GENAI_USE_VERTEXAI=true.');
  }

  return new GoogleGenAI({ apiKey });
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

async function fileToInlineData(filePath) {
  const data = await fs.readFile(filePath);
  return {
    mimeType: guessMimeType(filePath),
    data: data.toString('base64'),
  };
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

function findInlineImagePart(response) {
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return part;
      }
    }
  }
  return null;
}

function mimeTypeToExt(mimeType) {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.png';
}

function sanitizeName(value) {
  return value.replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
}

function isManagedTempPath(targetPath) {
  const normalized = path.resolve(targetPath);
  return normalized.startsWith('/tmp/emojigen-') || normalized.startsWith('/private/tmp/emojigen-');
}

function resolveImageModel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const resolved = IMAGE_MODEL_ALIASES[normalized];
  if (!resolved) {
    throw new Error('Only Nano Banana Pro (gemini-3-pro-image-preview) and Nano Banana 2 (gemini-3.1-flash-image-preview) are allowed for image generation.');
  }
  return resolved;
}

async function resolveReferencePath(options) {
  if (options.reference) {
    return options.reference;
  }

  if (options['from-clipboard']) {
    return stageImage({
      fromClipboard: true,
      tmpDir: options['tmp-dir'],
      outPath: options['staged-reference'],
    });
  }

  throw new Error('Missing reference image. Provide --reference /abs/path/to/image or --from-clipboard.');
}

async function stageImage({ inputPath, fromClipboard, outPath, tmpDir }) {
  const tempDir = tmpDir || '/tmp';
  await ensureDir(tempDir);

  if (inputPath) {
    const ext = path.extname(inputPath) || '.png';
    const targetPath = outPath || path.join(tempDir, `emojigen-input-${Date.now()}${ext}`);
    await ensureDir(path.dirname(targetPath));
    await fs.copyFile(inputPath, targetPath);
    return targetPath;
  }

  if (fromClipboard) {
    const targetPath = outPath || path.join(tempDir, `emojigen-clipboard-${Date.now()}.png`);
    await ensureDir(path.dirname(targetPath));
    await saveClipboardImage(targetPath);
    return targetPath;
  }

  throw new Error('stage-image requires --input or --from-clipboard.');
}

async function saveClipboardImage(targetPath) {
  const pngpasteExists = await commandExists('pngpaste');
  if (pngpasteExists) {
    await runCommand('pngpaste', [targetPath]);
    return;
  }

  await runCommand('osascript', [
    '-e',
    'set pngData to the clipboard as «class PNGf»',
    '-e',
    `set outFile to POSIX file "${targetPath}"`,
    '-e',
    'set fileRef to open for access outFile with write permission',
    '-e',
    'set eof of fileRef to 0',
    '-e',
    'write pngData to fileRef',
    '-e',
    'close access fileRef',
  ]);
}

async function inspectBackend() {
  const useVertex = parseBoolean(process.env.GOOGLE_GENAI_USE_VERTEXAI);
  if (useVertex) {
    const ready = Boolean(process.env.GOOGLE_CLOUD_PROJECT);
    let adcReady = false;
    if (ready) {
      adcReady = await commandSucceeds('gcloud', ['auth', 'application-default', 'print-access-token']);
    }
    return {
      mode: 'vertex',
      project: process.env.GOOGLE_CLOUD_PROJECT || null,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
      ready: ready && adcReady,
      adcReady,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
  return {
    mode: 'gemini-api-key',
    ready: Boolean(apiKey),
  };
}

function requireOption(value, name) {
  if (!value) {
    throw new Error(`Missing required option ${name}`);
  }
  return value;
}

function replaceExt(filePath, nextExt) {
  return path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}${nextExt}`);
}

async function writeOutput(outPath, data) {
  if (!outPath) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  await ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function writeText(filePath, text) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${text.trim()}\n`, 'utf8');
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureCommand(command) {
  if (!(await commandExists(command))) {
    throw new Error(`Required command not found: ${command}`);
  }
}

async function commandExists(command) {
  return commandSucceeds('sh', ['-lc', `command -v ${command}`]);
}

async function commandSucceeds(command, args) {
  try {
    await runCommand(command, args);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}\n${stderr || stdout}`));
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
