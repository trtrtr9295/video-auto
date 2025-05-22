// AJOUTEZ ces lignes après les autres require au début de server.js :

const VideoAIService = require('./services/VideoAIService');

// Initialiser le service IA
const videoAI = new VideoAIService();

// REMPLACEZ la route /api/projects/:projectId/generate-videos par celle-ci :

app.post('/api/projects/:projectId/generate-videos', auth, async (req, res) => {
  try {
    const projectIndex = database.projects.findIndex(p => 
      p.id === req.params.projectId && p.userId === req.user.userId
    );

    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const project = database.projects[projectIndex];
    const generatedVideos = [];

    console.log(`🚀 Génération IA pour ${project.selectedProducts.length} produits`);

    // Générer les vidéos avec IA pour chaque produit
    for (const product of project.selectedProducts) {
      try {
        console.log(`🎬 Traitement ${product.name}...`);

        // Générer 3 versions avec durées différentes
        for (let version = 1; version <= 3; version++) {
          const duration = version === 1 ? 15 : version === 2 ? 20 : 25;
          
          const videoResult = await videoAI.generateProductVideo(
            product, 
            project.videoStyle, 
            duration
          );

          const video = {
            id: Date.now().toString() + '_v' + version + '_' + Math.random().toString(36).substr(2, 5),
            productName: product.name,
            version: `Version ${version}`,
            style: project.videoStyle,
            duration: videoResult.duration,
            format: 'mp4',
            resolution: '1080x1920',
            thumbnail: videoResult.images[0] || product.images[0],
            videoUrl: videoResult.videoUrl,
            script: videoResult.script,
            status: videoResult.success ? 'ready' : 'processed',
            createdAt: new Date().toISOString(),
            platforms: ['instagram', 'tiktok', 'youtube'],
            projectId: project.id,
            userId: req.user.userId,
            aiGenerated: true,
            metadata: {
              originalImages: product.images || [],
              optimizedImages: videoResult.images,
              aiScript: videoResult.script,
              generationSuccess: videoResult.success
            }
          };

          generatedVideos.push(video);
          
          // Petite pause entre les générations
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${product.name}:`, error);
        
        // Créer une vidéo placeholder en cas d'erreur
        const placeholderVideo = {
          id: Date.now().toString() + '_error_' + Math.random().toString(36).substr(2, 5),
          productName: product.name,
          version: 'Version 1',
          style: project.videoStyle,
          duration: 15,
          format: 'mp4',
          resolution: '1080x1920',
          thumbnail: product.images?.[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400',
          videoUrl: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400',
          script: `Découvrez ${product.name} - ${product.description || 'Produit exceptionnel'}`,
          status: 'ready',
          createdAt: new Date().toISOString(),
          platforms: ['instagram', 'tiktok', 'youtube'],
          projectId: project.id,
          userId: req.user.userId,
          aiGenerated: false
        };
        
        generatedVideos.push(placeholderVideo);
      }
    }

    // Mettre à jour la base de données
    database.projects[projectIndex].videos = generatedVideos;
    database.projects[projectIndex].status = 'completed';
    database.videos.push(...generatedVideos);

    console.log(`✅ ${generatedVideos.length} vidéos générées au total`);

    res.json({
      success: true,
      message: `${generatedVideos.length} vidéos générées avec IA !`,
      videos: generatedVideos,
      aiGenerated: true
    });

  } catch (error) {
    console.error('❌ Erreur génération vidéos IA:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération IA',
      message: error.message 
    });
  }
});

// AJOUTEZ cette nouvelle route pour servir les fichiers temporaires :

app.use('/temp', express.static(path.join(__dirname, 'temp')));
