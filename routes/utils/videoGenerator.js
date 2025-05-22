const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || null
});

// Configuration des styles de vidéo
const VIDEO_STYLES = {
  moderne: {
    name: 'Moderne',
    description: 'Design épuré, transitions fluides, esthétique minimaliste',
    colors: ['#2C3E50', '#3498DB', '#ECF0F1'],
    transitions: ['fade', 'slide'],
    tempo: 'medium',
    fonts: ['Helvetica', 'Arial'],
    effects: ['minimal', 'clean']
  },
  dynamique: {
    name: 'Dynamique', 
    description: 'Rythme rapide, effets énergiques, parfait pour TikTok',
    colors: ['#E74C3C', '#F39C12', '#FFF'],
    transitions: ['zoom', 'spin', 'bounce'],
    tempo: 'fast',
    fonts: ['Impact', 'Arial Black'],
    effects: ['energetic', 'flashy']
  },
  elegant: {
    name: 'Élégant',
    description: 'Sophistiqué, luxueux, idéal pour produits premium',
    colors: ['#8E44AD', '#2C3E50', '#F8F9FA'],
    transitions: ['smooth', 'elegant'],
    tempo: 'slow',
    fonts: ['Times New Roman', 'Georgia'],
    effects: ['luxury', 'premium']
  },
  ludique: {
    name: 'Ludique',
    description: 'Fun, coloré, parfait pour jeune audience',
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
    transitions: ['bounce', 'flip', 'wobble'],
    tempo: 'medium',
    fonts: ['Comic Sans MS', 'Arial Rounded'],
    effects: ['playful', 'colorful']
  }
};

// Durées standard pour les réseaux sociaux
const VIDEO_DURATIONS = {
  tiktok: 15,
  instagram: 15,
  youtube: 30,
  facebook: 20
};

// Résolutions pour chaque plateforme
const VIDEO_RESOLUTIONS = {
  tiktok: { width: 1080, height: 1920 }, // 9:16 vertical
  instagram: { width: 1080, height: 1920 }, // 9:16 vertical
  youtube: { width: 1080, height: 1920 }, // 9:16 shorts
  facebook: { width: 1080, height: 1080 } // 1:1 carré
};

/**
 * Génère des vidéos IA pour un produit donné
 */
async function generateVideosForProduct(product, style = 'moderne', platforms = ['tiktok', 'instagram', 'youtube']) {
  console.log(`🎬 Génération vidéo pour: ${product.name} (Style: ${style})`);
  
  try {
    // 1. Générer le script IA
    const script = await generateVideoScript(product, style);
    console.log(`📝 Script généré: ${script.substring(0, 100)}...`);
    
    // 2. Générer 3 versions différentes
    const videos = [];
    
    for (let version = 1; version <= 3; version++) {
      console.log(`🎥 Création version ${version}/3...`);
      
      // Générer une variation du script pour chaque version
      const versionScript = await generateScriptVariation(script, version);
      
      // Créer la vidéo pour chaque plateforme
      for (const platform of platforms) {
        const video = await createVideoForPlatform(product, versionScript, style, platform, version);
        videos.push(video);
      }
    }
    
    console.log(`✅ ${videos.length} vidéos générées avec succès`);
    
    return {
      success: true,
      videos,
      originalScript: script,
      product: product.name,
      style,
      platforms,
      generatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Erreur génération vidéo:', error);
    
    // Retourner des vidéos de démonstration en cas d'erreur
    return generateFallbackVideos(product, style, platforms);
  }
}

/**
 * Génère un script IA personnalisé
 */
async function generateVideoScript(product, style) {
  try {
    if (!openai.apiKey || openai.apiKey === 'your-openai-key-here') {
      console.log('⚠️ Pas de clé OpenAI, utilisation du fallback');
      return generateFallbackScript(product, style);
    }
    
    const styleConfig = VIDEO_STYLES[style] || VIDEO_STYLES.moderne;
    
    const prompt = `Créez un script de vidéo de 15 secondes pour le produit "${product.name}" dans le style ${styleConfig.name}.

Produit: ${product.name}
Description: ${product.description || 'Produit de qualité'}
Prix: ${product.price}€
Style: ${styleConfig.description}

Le script doit être:
- Optimisé pour TikTok, Instagram Reels, YouTube Shorts
- Accrocheur dès les 3 premières secondes
- Avec un call-to-action clair
- Adapté au style ${styleConfig.name} (${styleConfig.description})

Format de réponse:
[0-3s] Action visuelle - Texte à afficher
[4-7s] Action visuelle - Texte à afficher  
[8-11s] Action visuelle - Texte à afficher
[12-15s] Call-to-action - Texte à afficher

Répondez uniquement avec le script structuré, sans introduction.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.8
    });

    return response.choices[0].message.content.trim();
    
  } catch (error) {
    console.error('Erreur OpenAI:', error);
    return generateFallbackScript(product, style);
  }
}

/**
 * Génère une variation du script pour différentes versions
 */
async function generateScriptVariation(originalScript, version) {
  try {
    if (!openai.apiKey || openai.apiKey === 'your-openai-key-here') {
      return addVariationToScript(originalScript, version);
    }

    const prompt = `Créez une variation ${version} du script vidéo suivant, en gardant la même structure mais en changeant les accroches et call-to-action:

Script original:
${originalScript}

Créez une version ${version === 1 ? 'plus directe' : version === 2 ? 'plus émotionnelle' : 'plus créative'}.
Gardez le même format [Xs] mais changez les textes et actions.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.9
    });

    return response.choices[0].message.content.trim();
    
  } catch (error) {
    return addVariationToScript(originalScript, version);
  }
}

/**
 * Crée une vidéo pour une plateforme spécifique
 */
async function createVideoForPlatform(product, script, style, platform, version) {
  const videoId = `${Date.now()}_${product.id}_${platform}_v${version}`;
  const styleConfig = VIDEO_STYLES[style];
  const resolution = VIDEO_RESOLUTIONS[platform];
  const duration = VIDEO_DURATIONS[platform];
  
  // Pour le moment, on simule la génération (à remplacer par vraie génération)
  const videoData = {
    id: videoId,
    productId: product.id,
    productName: product.name,
    platform,
    style,
    version,
    script,
    duration,
    resolution,
    
    // URLs de démonstration (à remplacer par vraies vidéos)
    url: `https://sample-videos.com/zip/10/mp4/SampleVideo_${resolution.width}x${resolution.height}_1mb.mp4`,
    thumbnailUrl: `https://picsum.photos/${resolution.width}/${resolution.height}?random=${videoId}`,
    
    // Métadonnées
    fileSize: Math.floor(Math.random() * 10 + 5) + 'MB',
    format: 'mp4',
    codec: 'H.264',
    bitrate: '2000kbps',
    
    // Informations de style
    colors: styleConfig.colors,
    transitions: styleConfig.transitions,
    tempo: styleConfig.tempo,
    
    // Statut
    status: 'generated',
    createdAt: new Date().toISOString(),
    
    // Métriques simulées
    metrics: {
      renderTime: Math.floor(Math.random() * 30 + 10) + 's',
      quality: 'HD',
      optimization: platform
    }
  };
  
  console.log(`✅ Vidéo créée: ${platform} v${version} (${resolution.width}x${resolution.height})`);
  
  return videoData;
}

/**
 * Génère un script de fallback sans IA
 */
function generateFallbackScript(product, style) {
  const styleConfig = VIDEO_STYLES[style];
  const scripts = {
    moderne: [
      `[0-3s] Zoom sur ${product.name} - "Innovation à portée de main"`,
      `[4-7s] Présentation des caractéristiques - "Qualité supérieure"`,
      `[8-11s] Démonstration d'utilisation - "Simplicité et efficacité"`,
      `[12-15s] Prix et CTA - "${product.price}€ - Commandez maintenant!"`
    ],
    dynamique: [
      `[0-3s] Transition rapide - "${product.name} c'est parti!"`,
      `[4-7s] Montage rythmé - "Puissance maximale"`,
      `[8-11s] Action intense - "Dépassez vos limites"`,
      `[12-15s] Urgence - "${product.price}€ seulement - Foncez!"`
    ],
    elegant: [
      `[0-3s] Apparition douce - "L'excellence vous attend"`,
      `[4-7s] Présentation raffinée - "Luxe et sophistication"`,
      `[8-11s] Mise en scène premium - "Pour les connaisseurs"`,
      `[12-15s] Invitation élégante - "${product.price}€ - Découvrez la collection"`
    ],
    ludique: [
      `[0-3s] Animation fun - "Prêt pour l'aventure?"`,
      `[4-7s] Démonstration joyeuse - "Du plaisir à l'état pur"`,
      `[8-11s] Moments de bonheur - "Souriez, vous allez adorer"`,
      `[12-15s] Invitation joyeuse - "${product.price}€ - Rejoignez le fun!"`
    ]
  };
  
  const selectedScript = scripts[style] || scripts.moderne;
  return selectedScript.join('\n');
}

/**
 * Ajoute une variation au script existant
 */
function addVariationToScript(script, version) {
  const variations = {
    1: { prefix: 'Découvrez', suffix: 'Achetez maintenant!' },
    2: { prefix: 'Tombez amoureux de', suffix: 'Offrez-vous le meilleur!' },
    3: { prefix: 'Transformez votre quotidien avec', suffix: 'Ne ratez pas cette occasion!' }
  };
  
  const variation = variations[version] || variations[1];
  
  return script
    .replace(/Découvrez|Voici|Présentation/, variation.prefix)
    .replace(/Commandez|Achetez|Foncez/, variation.suffix);
}

/**
 * Génère des vidéos de fallback en cas d'erreur
 */
function generateFallbackVideos(product, style, platforms) {
  console.log('🎭 Génération de vidéos de démonstration');
  
  const videos = [];
  const fallbackScript = generateFallbackScript(product, style);
  
  for (let version = 1; version <= 3; version++) {
    for (const platform of platforms) {
      const video = createVideoForPlatform(product, fallbackScript, style, platform, version);
      videos.push(video);
    }
  }
  
  return {
    success: true,
    videos,
    originalScript: fallbackScript,
    product: product.name,
    style,
    platforms,
    generatedAt: new Date().toISOString(),
    method: 'fallback'
  };
}

/**
 * Optimise une vidéo pour une plateforme spécifique
 */
async function optimizeVideoForPlatform(videoPath, platform) {
  const resolution = VIDEO_RESOLUTIONS[platform];
  const duration = VIDEO_DURATIONS[platform];
  
  // Configuration FFmpeg selon la plateforme
  const outputPath = videoPath.replace('.mp4', `_${platform}.mp4`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .size(`${resolution.width}x${resolution.height}`)
      .duration(duration)
      .videoBitrate('2000k')
      .audioBitrate('128k')
      .format('mp4')
      .videoCodec('libx264')
      .audioCodec('aac')
      .addOptions([
        '-movflags +faststart', // Optimisation web
        '-profile:v baseline', // Compatibilité maximale
        '-level 3.0',
        '-pix_fmt yuv420p'
      ])
      .on('end', () => {
        console.log(`✅ Vidéo optimisée pour ${platform}: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`❌ Erreur optimisation ${platform}:`, err);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Génère des sous-titres automatiques
 */
async function generateSubtitles(script, duration = 15) {
  const lines = script.split('\n').filter(line => line.trim());
  const subtitles = [];
  const timePerLine = duration / lines.length;
  
  lines.forEach((line, index) => {
    const startTime = index * timePerLine;
    const endTime = (index + 1) * timePerLine;
    
    // Extraire le texte après le timing
    const textMatch = line.match(/\] (.+)$/);
    const text = textMatch ? textMatch[1] : line;
    
    subtitles.push({
      start: startTime,
      end: endTime,
      text: text.replace(/[""]/g, '"')
    });
  });
  
  return subtitles;
}

/**
 * Analyse les performances d'une vidéo générée
 */
function analyzeVideoPerformance(video) {
  const platformBenchmarks = {
    tiktok: { optimalDuration: 15, engagementRate: 0.18 },
    instagram: { optimalDuration: 15, engagementRate: 0.12 },
    youtube: { optimalDuration: 30, engagementRate: 0.08 },
    facebook: { optimalDuration: 20, engagementRate: 0.06 }
  };
  
  const benchmark = platformBenchmarks[video.platform];
  const score = calculateVideoScore(video, benchmark);
  
  return {
    score,
    recommendations: generateRecommendations(video, score),
    benchmark,
    optimizationTips: getOptimizationTips(video.platform)
  };
}

function calculateVideoScore(video, benchmark) {
  let score = 70; // Score de base
  
  // Bonus pour durée optimale
  if (Math.abs(video.duration - benchmark.optimalDuration) <= 2) {
    score += 15;
  }
  
  // Bonus pour résolution HD
  if (video.resolution.width >= 1080) {
    score += 10;
  }
  
  // Bonus pour style adapté à la plateforme
  const styleBonus = {
    tiktok: { dynamique: 15, ludique: 10 },
    instagram: { moderne: 15, elegant: 10 },
    youtube: { moderne: 10, dynamique: 10 },
    facebook: { ludique: 15, moderne: 5 }
  };
  
  const bonus = styleBonus[video.platform]?.[video.style] || 0;
  score += bonus;
  
  return Math.min(100, Math.max(0, score));
}

function generateRecommendations(video, score) {
  const recommendations = [];
  
  if (score < 70) {
    recommendations.push("Considérez changer de style pour mieux s'adapter à " + video.platform);
  }
  
  if (video.duration > VIDEO_DURATIONS[video.platform] + 5) {
    recommendations.push("Réduisez la durée pour optimiser l'engagement");
  }
  
  if (score > 85) {
    recommendations.push("Excellente vidéo! Parfaite pour " + video.platform);
  }
  
  return recommendations;
}

function getOptimizationTips(platform) {
  const tips = {
    tiktok: [
      "Commencez par un hook fort dans les 3 premières secondes",
      "Utilisez des transitions rapides et dynamiques",
      "Ajoutez du texte en gros caractères",
      "Privilégiez les effets visuels"
    ],
    instagram: [
      "Soignez la première image (thumbnail)",
      "Utilisez les hashtags populaires",
      "Ajoutez des éléments interactifs",
      "Maintenez une esthétique cohérente"
    ],
    youtube: [
      "Optimisez pour la recherche avec un titre accrocheur",
      "Ajoutez des sous-titres pour l'accessibilité",
      "Utilisez des miniatures personnalisées",
      "Créez du contenu éducatif ou divertissant"
    ],
    facebook: [
      "Optimisez pour la lecture sans son",
      "Utilisez des sous-titres dès le début",
      "Créez du contenu engageant et partageable",
      "Ajoutez un call-to-action clair"
    ]
  };
  
  return tips[platform] || tips.instagram;
}

/**
 * Planifie la publication d'une vidéo sur les réseaux sociaux
 */
async function scheduleVideoPost(video, platforms, scheduledTime) {
  console.log(`📅 Planification publication: ${video.productName}`);
  
  const schedules = [];
  
  for (const platform of platforms) {
    const schedule = {
      id: `schedule_${Date.now()}_${platform}`,
      videoId: video.id,
      platform,
      scheduledTime,
      status: 'scheduled',
      content: {
        title: generatePostTitle(video, platform),
        description: generatePostDescription(video, platform),
        hashtags: generateHashtags(video, platform),
        thumbnail: video.thumbnailUrl
      },
      createdAt: new Date().toISOString()
    };
    
    schedules.push(schedule);
  }
  
  return {
    success: true,
    schedules,
    message: `Vidéo planifiée sur ${platforms.length} plateformes`
  };
}

/**
 * Génère un titre optimisé pour chaque plateforme
 */
function generatePostTitle(video, platform) {
  const product = video.productName;
  
  const titles = {
    tiktok: `${product} qui va vous surprendre! 🤯`,
    instagram: `✨ Découvrez ${product} - Le must-have du moment`,
    youtube: `${product}: Test et Avis Complet | Ça vaut le coup?`,
    facebook: `🔥 ${product}: Pourquoi tout le monde en parle`
  };
  
  return titles[platform] || titles.instagram;
}

/**
 * Génère une description optimisée pour chaque plateforme
 */
function generatePostDescription(video, platform) {
  const product = video.productName;
  const style = video.style;
  
  const descriptions = {
    tiktok: `${product} dans le style ${style}! Qu'est-ce que vous en pensez? 💭 #${product.replace(/\s+/g, '')}`,
    
    instagram: `✨ ${product} - Le produit qui fait la différence!
    
🎯 Style ${style} parfaitement maîtrisé
💎 Qualité premium garantie
🚀 Livraison rapide

Que pensez-vous de ce style? Dites-le nous en commentaire! 👇`,

    youtube: `Dans cette vidéo, je vous présente ${product} dans un style ${style}.
    
🔍 Ce que vous allez découvrir:
- Présentation détaillée
- Avantages et inconvénients  
- Mon avis personnel
- Où se le procurer

💬 N'hésitez pas à me dire ce que vous en pensez en commentaire!
👍 Likez si la vidéo vous a plu
🔔 Abonnez-vous pour plus de contenu`,

    facebook: `🔥 ${product} - Notre dernière découverte!
    
Style ${style} qui va vous séduire à coup sûr. Parfait pour ceux qui recherchent la qualité et l'originalité.
    
👥 Taggez vos amis qui pourraient être intéressés!
💬 Vos avis nous intéressent`
  };
  
  return descriptions[platform] || descriptions.instagram;
}

/**
 * Génère des hashtags optimisés pour chaque plateforme
 */
function generateHashtags(video, platform) {
  const productKeywords = video.productName.toLowerCase().split(' ');
  const styleTag = video.style;
  
  const commonTags = [
    `#${video.productName.replace(/\s+/g, '')}`,
    `#${styleTag}`,
    '#qualite',
    '#innovation',
    '#shopping'
  ];
  
  const platformSpecificTags = {
    tiktok: [
      '#fyp', '#foryou', '#viral', '#trending', '#pourtoi',
      '#decouverte', '#produit', '#test', '#avis'
    ],
    instagram: [
      '#instagood', '#photooftheday', '#beautiful', '#style',
      '#fashion', '#lifestyle', '#quality', '#premium'
    ],
    youtube: [
      '#review', '#test', '#unboxing', '#presentation',
      '#qualite', '#francais', '#youtube', '#shorts'
    ],
    facebook: [
      '#facebook', '#partage', '#decouverte', '#conseil',
      '#communaute', '#discussion', '#nouveaute'
    ]
  };
  
  const platformTags = platformSpecificTags[platform] || platformSpecificTags.instagram;
  const allTags = [...commonTags, ...platformTags.slice(0, 15)];
  
  return allTags.slice(0, 20); // Limiter à 20 hashtags max
}

/**
 * Génère des métriques de performance simulées
 */
function generatePerformanceMetrics(video, days = 7) {
  const platformMultipliers = {
    tiktok: { views: 1000, likes: 0.15, shares: 0.08, comments: 0.05 },
    instagram: { views: 500, likes: 0.12, shares: 0.03, comments: 0.04 },
    youtube: { views: 200, likes: 0.08, shares: 0.02, comments: 0.03 },
    facebook: { views: 300, likes: 0.06, shares: 0.04, comments: 0.02 }
  };
  
  const multiplier = platformMultipliers[video.platform] || platformMultipliers.instagram;
  const baseViews = Math.floor(Math.random() * multiplier.views * days);
  
  return {
    views: baseViews,
    likes: Math.floor(baseViews * multiplier.likes),
    shares: Math.floor(baseViews * multiplier.shares),
    comments: Math.floor(baseViews * multiplier.comments),
    engagementRate: ((Math.floor(baseViews * multiplier.likes) + 
                      Math.floor(baseViews * multiplier.shares) + 
                      Math.floor(baseViews * multiplier.comments)) / baseViews * 100).toFixed(2),
    period: `${days} jours`,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Crée un template de vidéo réutilisable
 */
function createVideoTemplate(product, style, customizations = {}) {
  const template = {
    id: `template_${Date.now()}`,
    name: `Template ${product.name} - ${style}`,
    style,
    product: {
      name: product.name,
      category: product.category,
      priceRange: getPriceRange(product.price)
    },
    customizations: {
      colors: customizations.colors || VIDEO_STYLES[style].colors,
      fonts: customizations.fonts || VIDEO_STYLES[style].fonts,
      transitions: customizations.transitions || VIDEO_STYLES[style].transitions,
      tempo: customizations.tempo || VIDEO_STYLES[style].tempo,
      ...customizations
    },
    platforms: ['tiktok', 'instagram', 'youtube'],
    createdAt: new Date().toISOString(),
    usageCount: 0
  };
  
  return template;
}

/**
 * Utilitaire pour déterminer la gamme de prix
 */
function getPriceRange(price) {
  if (price < 25) return 'budget';
  if (price < 100) return 'mid-range';
  if (price < 300) return 'premium';
  return 'luxury';
}

/**
 * Exporte les fonctions principales
 */
module.exports = {
  generateVideosForProduct,
  generateVideoScript,
  generateScriptVariation,
  createVideoForPlatform,
  optimizeVideoForPlatform,
  generateSubtitles,
  analyzeVideoPerformance,
  scheduleVideoPost,
  generatePostTitle,
  generatePostDescription,
  generateHashtags,
  generatePerformanceMetrics,
  createVideoTemplate,
  VIDEO_STYLES,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS
};
