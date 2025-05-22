const express = require('express');
const { generateVideosForProduct } = require('../utils/videoGenerator');
const fs = require('fs').promises;
const router = express.Router();

// Données globales (à synchroniser avec server.js)
let users = [];
let projects = [];
let videos = [];

// Middleware d'authentification simple
const authenticateToken = (req, res, next) => {
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
};

// Fonction de sauvegarde
const saveData = async () => {
  try {
    const data = { users, projects, videos };
    await fs.writeFile('data.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde vidéos:', error);
  }
};

// GET /api/videos - Liste des vidéos utilisateur
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userVideos = videos.filter(v => v.userId === req.user.userId);
    
    // Trier par date de création (plus récent en premier)
    userVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedVideos = userVideos.slice(startIndex, endIndex);
    
    res.json({
      videos: paginatedVideos,
      pagination: {
        page,
        limit,
        total: userVideos.length,
        pages: Math.ceil(userVideos.length / limit)
      },
      stats: {
        totalVideos: userVideos.length,
        byPlatform: getVideosByPlatform(userVideos),
        byStyle: getVideosByStyle(userVideos)
      }
    });
    
  } catch (error) {
    console.error('Erreur récupération vidéos:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/videos/:id - Détails d'une vidéo
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const video = videos.find(v => v.id === req.params.id && v.userId === req.user.userId);
    
    if (!video) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    
    // Ajouter des métriques simulées si pas présentes
    if (!video.metrics) {
      video.metrics = generateSimulatedMetrics(video);
    }
    
    res.json(video);
    
  } catch (error) {
    console.error('Erreur récupération vidéo:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/videos/generate - Générer des vidéos pour un produit
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { productId, projectId, style, platforms } = req.body;
    
    // Validation
    if (!productId || !projectId || !style) {
      return res.status(400).json({ 
        error: 'productId, projectId et style sont requis' 
      });
    }
    
    // Trouver le projet et le produit
    const project = projects.find(p => p.id === projectId && p.userId === req.user.userId);
    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    const product = project.products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    // Vérifier les quotas (100 vidéos max par utilisateur gratuit)
    const userVideos = videos.filter(v => v.userId === req.user.userId);
    if (userVideos.length >= 100) {
      return res.status(429).json({ 
        error: 'Limite de 100 vidéos atteinte pour les comptes gratuits' 
      });
    }
    
    console.log(`🎬 Génération vidéo: ${product.name} (Style: ${style})`);
    
    // Générer les vidéos
    const targetPlatforms = platforms || ['tiktok', 'instagram', 'youtube'];
    const result = await generateVideosForProduct(product, style, targetPlatforms);
    
    if (!result.success) {
      return res.status(500).json({ 
        error: 'Erreur lors de la génération', 
        details: result.error 
      });
    }
    
    // Ajouter les informations utilisateur aux vidéos
    const generatedVideos = result.videos.map(video => ({
      ...video,
      userId: req.user.userId,
      projectId,
      productId,
      createdAt: new Date().toISOString(),
      status: 'generated'
    }));
    
    // Sauvegarder les vidéos
    videos.push(...generatedVideos);
    await saveData();
    
    console.log(`✅ ${generatedVideos.length} vidéos générées pour ${product.name}`);
    
    res.status(201).json({
      message: `${generatedVideos.length} vidéos générées avec succès`,
      videos: generatedVideos,
      product: product.name,
      style,
      platforms: targetPlatforms
    });
    
  } catch (error) {
    console.error('❌ Erreur génération vidéos:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération de vidéos',
      details: error.message 
    });
  }
});

// POST /api/videos/:id/schedule - Programmer une vidéo
router.post('/:id/schedule', authenticateToken, async (req, res) => {
  try {
    const { platforms, scheduledTime, content } = req.body;
    
    const video = videos.find(v => v.id === req.params.id && v.userId === req.user.userId);
    if (!video) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    
    // Validation des plateformes
    const validPlatforms = ['tiktok', 'instagram', 'youtube', 'facebook'];
    const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
    if (invalidPlatforms.length > 0) {
      return res.status(400).json({ 
        error: `Plateformes non supportées: ${invalidPlatforms.join(', ')}` 
      });
    }
    
    // Créer les programmations
    const schedules = platforms.map(platform => ({
      id: `schedule_${Date.now()}_${platform}`,
      videoId: video.id,
      platform,
      scheduledTime: new Date(scheduledTime).toISOString(),
      status: 'scheduled',
      content: {
        title: content?.title || generateDefaultTitle(video, platform),
        description: content?.description || generateDefaultDescription(video, platform),
        hashtags: content?.hashtags || generateDefaultHashtags(video, platform)
      },
      createdAt: new Date().toISOString()
    }));
    
    // Ajouter les programmations à la vidéo
    if (!video.schedules) video.schedules = [];
    video.schedules.push(...schedules);
    
    await saveData();
    
    console.log(`📅 Vidéo programmée sur ${platforms.length} plateformes`);
    
    res.json({
      message: `Vidéo programmée sur ${platforms.length} plateformes`,
      schedules
    });
    
  } catch (error) {
    console.error('Erreur programmation:', error);
    res.status(500).json({ error: 'Erreur lors de la programmation' });
  }
});

// DELETE /api/videos/:id - Supprimer une vidéo
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const videoIndex = videos.findIndex(v => v.id === req.params.id && v.userId === req.user.userId);
    
    if (videoIndex === -1) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    
    const deletedVideo = videos[videoIndex];
    videos.splice(videoIndex, 1);
    
    await saveData();
    
    console.log(`🗑️ Vidéo supprimée: ${deletedVideo.productName}`);
    
    res.json({
      message: 'Vidéo supprimée avec succès',
      deletedVideo: {
        id: deletedVideo.id,
        productName: deletedVideo.productName
      }
    });
    
  } catch (error) {
    console.error('Erreur suppression vidéo:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// GET /api/videos/:id/download - Télécharger une vidéo
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const video = videos.find(v => v.id === req.params.id && v.userId === req.user.userId);
    
    if (!video) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    
    // Pour le moment, redirection vers l'URL de la vidéo
    // En production, cela devrait servir le fichier directement
    res.redirect(video.url);
    
  } catch (error) {
    console.error('Erreur téléchargement:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement' });
  }
});

// GET /api/videos/:id/analytics - Analytics d'une vidéo
router.get('/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const video = videos.find(v => v.id === req.params.id && v.userId === req.user.userId);
    
    if (!video) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    
    // Générer des analytics simulées
    const analytics = generateVideoAnalytics(video);
    
    res.json({
      videoId: video.id,
      productName: video.productName,
      platform: video.platform,
      style: video.style,
      analytics,
      period: '7 derniers jours'
    });
    
  } catch (error) {
    console.error('Erreur analytics:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des analytics' });
  }
});

// Fonctions utilitaires
function getVideosByPlatform(videos) {
  const byPlatform = {};
  videos.forEach(video => {
    byPlatform[video.platform] = (byPlatform[video.platform] || 0) + 1;
  });
  return byPlatform;
}

function getVideosByStyle(videos) {
  const byStyle = {};
  videos.forEach(video => {
    byStyle[video.style] = (byStyle[video.style] || 0) + 1;
  });
  return byStyle;
}

function generateSimulatedMetrics(video) {
  const platformMultipliers = {
    tiktok: { views: 1000, likes: 0.15, shares: 0.08, comments: 0.05 },
    instagram: { views: 500, likes: 0.12, shares: 0.03, comments: 0.04 },
    youtube: { views: 200, likes: 0.08, shares: 0.02, comments: 0.03 },
    facebook: { views: 300, likes: 0.06, shares: 0.04, comments: 0.02 }
  };
  
  const multiplier = platformMultipliers[video.platform] || platformMultipliers.instagram;
  const baseViews = Math.floor(Math.random() * multiplier.views * 7); // 7 jours
  
  return {
    views: baseViews,
    likes: Math.floor(baseViews * multiplier.likes),
    shares: Math.floor(baseViews * multiplier.shares),
    comments: Math.floor(baseViews * multiplier.comments),
    engagementRate: ((baseViews * (multiplier.likes + multiplier.shares + multiplier.comments)) / baseViews * 100).toFixed(2),
    period: '7 jours',
    lastUpdated: new Date().toISOString()
  };
}

function generateDefaultTitle(video, platform) {
  const titles = {
    tiktok: `${video.productName} qui va vous surprendre! 🤯`,
    instagram: `✨ Découvrez ${video.productName} - Le must-have`,
    youtube: `${video.productName}: Test et Avis | Ça vaut le coup?`,
    facebook: `🔥 ${video.productName}: Pourquoi tout le monde en parle`
  };
  
  return titles[platform] || titles.instagram;
}

function generateDefaultDescription(video, platform) {
  const descriptions = {
    tiktok: `${video.productName} dans le style ${video.style}! Qu'est-ce que vous en pensez? 💭`,
    instagram: `✨ ${video.productName} - Le produit qui fait la différence!\n🎯 Style ${video.style}\n💎 Qualité premium`,
    youtube: `Présentation de ${video.productName} dans un style ${video.style}. N'hésitez pas à me dire ce que vous en pensez!`,
    facebook: `🔥 ${video.productName} - Notre dernière découverte! Style ${video.style} qui va vous séduire.`
  };
  
  return descriptions[platform] || descriptions.instagram;
}

function generateDefaultHashtags(video, platform) {
  const common = [`#${video.productName.replace(/\s+/g, '')}`, `#${video.style}`, '#qualite'];
  
  const platformSpecific = {
    tiktok: ['#fyp', '#foryou', '#viral', '#trending'],
    instagram: ['#instagood', '#style', '#lifestyle', '#premium'],
    youtube: ['#review', '#test', '#youtube', '#shorts'],
    facebook: ['#decouverte', '#conseil', '#nouveaute']
  };
  
  return [...common, ...(platformSpecific[platform] || platformSpecific.instagram)];
}

function generateVideoAnalytics(video) {
  const days = 7;
  const dailyData = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    dailyData.push({
      date: date.toISOString().split('T')[0],
      views: Math.floor(Math.random() * 200) + 50,
      likes: Math.floor(Math.random() * 30) + 5,
      shares: Math.floor(Math.random() * 10) + 1,
      comments: Math.floor(Math.random() * 15) + 2
    });
  }
  
  const totals = dailyData.reduce((acc, day) => ({
    views: acc.views + day.views,
    likes: acc.likes + day.likes,
    shares: acc.shares + day.shares,
    comments: acc.comments + day.comments
  }), { views: 0, likes: 0, shares: 0, comments: 0 });
  
  return {
    daily: dailyData,
    totals,
    engagementRate: ((totals.likes + totals.shares + totals.comments) / totals.views * 100).toFixed(2),
    bestDay: dailyData.reduce((best, day) => day.views > best.views ? day : best),
    growth: calculateGrowth(dailyData)
  };
}

function calculateGrowth(dailyData) {
  if (dailyData.length < 2) return 0;
  
  const firstHalf = dailyData.slice(0, Math.floor(dailyData.length / 2));
  const secondHalf = dailyData.slice(Math.floor(dailyData.length / 2));
  
  const firstViews = firstHalf.reduce((sum, day) => sum + day.views, 0);
  const secondViews = secondHalf.reduce((sum, day) => sum + day.views, 0);
  
  return firstViews === 0 ? 0 : (((secondViews - firstViews) / firstViews) * 100).toFixed(1);
}

// Export des données pour synchronisation
router.setData = (videosArray, usersArray, projectsArray) => {
  videos = videosArray;
  users = usersArray;
  projects = projectsArray;
};

router.getData = () => ({ videos, users, projects });

module.exports = router;
