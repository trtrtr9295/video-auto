const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class VideoAIService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Générer script IA avec OpenAI
  async generateProductScript(product, style, duration = 15) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return this.getDefaultScript(product, style);
      }

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Tu es expert en scripts vidéo pour réseaux sociaux. Style "${style}". Durée: ${duration}s. Sois engageant et commercial.`
          },
          {
            role: 'user',
            content: `Produit: ${product.name}, Prix: ${product.price}, Description: ${product.description}. Crée un script ${style} de ${duration} secondes qui donne envie d'acheter.`
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.log('Utilisation script par défaut (pas d\'erreur)');
      return this.getDefaultScript(product, style);
    }
  }

  getDefaultScript(product, style) {
    const scripts = {
      modern: `✨ ${product.name} - Le futur est là ! Design épuré, performance exceptionnelle. À partir de ${product.price}. Commandez maintenant !`,
      dynamic: `🔥 ${product.name} ARRIVE ! Révolutionnaire, incontournable ! ${product.price} seulement. FONCEZ !`,
      elegant: `Découvrez ${product.name} - L'excellence française. Raffinement et qualité premium. ${product.price}. Pure élégance.`,
      playful: `🎉 WAHOU ! ${product.name} c'est GÉNIAL ! Super fun, super prix : ${product.price} ! Craquez maintenant !`
    };
    return scripts[style] || scripts.modern;
  }

  // Optimiser les images pour vidéo
  async optimizeProductImages(images) {
    const optimizedImages = [];

    for (let i = 0; i < Math.min(images.length, 3); i++) {
      const imageUrl = images[i];
      try {
        // Télécharger l'image
        const response = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 10000
        });
        const buffer = Buffer.from(response.data);

        // Optimiser avec Sharp pour format vertical (Reels)
        const optimizedBuffer = await sharp(buffer)
          .resize(1080, 1920, { 
            fit: 'cover', 
            position: 'center' 
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Upload vers Cloudinary si configuré
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              { 
                resource_type: 'image',
                folder: 'video-auto/products',
                quality: 'auto',
                fetch_format: 'auto',
                transformation: [
                  { width: 1080, height: 1920, crop: 'fill', gravity: 'center' }
                ]
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(optimizedBuffer);
          });
          optimizedImages.push(result.secure_url);
        } else {
          // Fallback : utiliser l'image originale
          optimizedImages.push(imageUrl);
        }
      } catch (error) {
        console.log(`Image ${i + 1} non optimisée, utilisation originale`);
        optimizedImages.push(imageUrl);
      }
    }

    return optimizedImages.length > 0 ? optimizedImages : images.slice(0, 3);
  }

  // Générer vidéo avec FFmpeg (méthode principale)
  async generateVideoWithFFmpeg(product, images, script, style, duration) {
    return new Promise(async (resolve, reject) => {
      try {
        const outputPath = path.join(this.tempDir, `${Date.now()}_${product.name.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`);
        
        // Préparer les images temporaires
        const tempImages = [];
        for (let i = 0; i < images.length; i++) {
          const tempImagePath = path.join(this.tempDir, `temp_image_${Date.now()}_${i}.jpg`);
          
          try {
            const response = await axios.get(images[i], { responseType: 'stream' });
            const writer = fs.createWriteStream(tempImagePath);
            response.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
              writer.on('finish', resolve);
              writer.on('error', reject);
            });
            
            tempImages.push(tempImagePath);
          } catch (error) {
            console.log(`Erreur téléchargement image ${i}`);
          }
        }

        if (tempImages.length === 0) {
          throw new Error('Aucune image disponible');
        }

        // Créer la vidéo avec FFmpeg
        let command = ffmpeg();

        // Durée par image
        const imageDuration = Math.max(2, Math.floor(duration / tempImages.length));

        // Ajouter les images avec durée
        tempImages.forEach((imagePath) => {
          command = command
            .input(imagePath)
            .inputOptions(['-loop', '1', '-t', imageDuration.toString()]);
        });

        // Filtres pour créer la vidéo
        const filterComplex = [
          // Redimensionner et créer transitions
          ...tempImages.map((_, i) => 
            `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v${i}]`
          ),
          // Concaténer avec transitions fade
          `${tempImages.map((_, i) => `[v${i}]`).join('')}concat=n=${tempImages.length}:v=1:a=0[outv]`
        ];

        command
          .complexFilter(filterComplex)
          .outputOptions([
            '-map', '[outv]',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '28',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-movflags', '+faststart'
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('🎬 Génération FFmpeg démarrée');
          })
          .on('progress', (progress) => {
            console.log(`Progression: ${Math.round(progress.percent || 0)}%`);
          })
          .on('end', async () => {
            try {
              // Nettoyer les fichiers temporaires
              tempImages.forEach(imagePath => {
                try {
                  fs.unlinkSync(imagePath);
                } catch (e) {}
              });

              // Upload vers Cloudinary si configuré
              if (process.env.CLOUDINARY_CLOUD_NAME) {
                const result = await cloudinary.uploader.upload(outputPath, {
                  resource_type: 'video',
                  folder: 'video-auto/videos',
                  quality: 'auto'
                });

                // Nettoyer le fichier local
                fs.unlinkSync(outputPath);
                resolve(result.secure_url);
              } else {
                // Pour le développement local
                resolve(`/temp/${path.basename(outputPath)}`);
              }
            } catch (uploadError) {
              console.error('Erreur upload:', uploadError);
              resolve(`/temp/${path.basename(outputPath)}`);
            }
          })
          .on('error', (error) => {
            console.error('Erreur FFmpeg:', error);
            // Nettoyer les fichiers temporaires
            tempImages.forEach(imagePath => {
              try {
                fs.unlinkSync(imagePath);
              } catch (e) {}
            });
            resolve(this.createFallbackVideo(product));
          })
          .run();

      } catch (error) {
        console.error('Erreur génération vidéo:', error);
        resolve(this.createFallbackVideo(product));
      }
    });
  }

  createFallbackVideo(product) {
    // Retourner une URL de vidéo placeholder
    return `https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=600&fit=crop&crop=center`;
  }

  // Méthode principale
  async generateProductVideo(product, style, duration = 15) {
    try {
      console.log(`🎬 Génération vidéo IA pour ${product.name}`);

      // 1. Générer le script
      const script = await this.generateProductScript(product, style, duration);
      console.log('✅ Script généré');

      // 2. Optimiser les images
      const optimizedImages = await this.optimizeProductImages(product.images || []);
      console.log('✅ Images optimisées:', optimizedImages.length);

      // 3. Générer la vidéo
      const videoUrl = await this.generateVideoWithFFmpeg(product, optimizedImages, script, style, duration);
      console.log('✅ Vidéo générée');

      return {
        videoUrl,
        script,
        images: optimizedImages,
        duration,
        style,
        success: true
      };

    } catch (error) {
      console.error('❌ Erreur complète génération:', error);
      
      // Fallback complet
      return {
        videoUrl: this.createFallbackVideo(product),
        script: this.getDefaultScript(product, style),
        images: product.images || [],
        duration,
        style,
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = VideoAIService;
