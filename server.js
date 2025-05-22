require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Base de données JSON
const DB_FILE = path.join(__dirname, 'database.json');

let database = {
  users: [],
  projects: [],
  videos: [],
  settings: {
    maxFreeUsers: 100,
    currentFreeUsers: 0,
    videoStyles: [
      {
        id: 'modern',
        name: 'Moderne',
        description: 'Style épuré avec transitions fluides',
        preview: '/api/placeholder/300/200'
      },
      {
        id: 'dynamic',
        name: 'Dynamique',
        description: 'Animations énergiques avec effets de zoom',
        preview: '/api/placeholder/300/200'
      },
      {
        id: 'elegant',
        name: 'Élégant',
        description: 'Style premium avec typographie soignée',
        preview: '/api/placeholder/300/200'
      },
      {
        id: 'playful',
        name: 'Ludique',
        description: 'Couleurs vives avec animations amusantes',
        preview: '/api/placeholder/300/200'
      }
    ]
  }
};

// Fonctions de base de données
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      database = { ...database, ...JSON.parse(data) };
    }
  } catch (error) {
    console.log('Initialisation nouvelle base de données');
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }
}

loadDatabase();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token d\'accès requis' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'video-auto-secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
};

// === ROUTES PUBLIQUES ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Vidéo Auto API fonctionnelle !',
    freeUsersLeft: database.settings.maxFreeUsers - database.settings.currentFreeUsers,
    totalUsers: database.users.length
  });
});

// Compteur utilisateurs
app.get('/api/free-users-count', (req, res) => {
  const used = database.settings.currentFreeUsers;
  const total = database.settings.maxFreeUsers;
  
  res.json({
    totalFreeUsers: total,
    usedSlots: used,
    remainingSlots: total - used,
    percentage: (used / total) * 100
  });
});

// Inscription
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, companyName, websiteUrl } = req.body;

    // Validations
    if (!email || !password || !companyName) {
      return res.status(400).json({ error: 'Email, mot de passe et nom d\'entreprise requis' });
    }

    if (database.settings.currentFreeUsers >= database.settings.maxFreeUsers) {
      return res.status(400).json({ 
        error: 'Limite atteinte',
        message: 'Les 100 comptes gratuits ont été attribués'
      });
    }

    // Vérifier email existant
    const existingUser = database.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    // Créer utilisateur
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      email: email.toLowerCase(),
      password: hashedPassword,
      companyName,
      websiteUrl: websiteUrl || '',
      earlyBirdNumber: database.settings.currentFreeUsers + 1,
      createdAt: new Date().toISOString(),
      status: 'active',
      accountType: 'free_lifetime'
    };

    database.users.push(user);
    database.settings.currentFreeUsers++;
    saveDatabase();

    // Générer token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'video-auto-secret',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Compte créé avec succès !',
      user: {
        id: user.id,
        email: user.email,
        companyName: user.companyName,
        earlyBirdNumber: user.earlyBirdNumber
      },
      token
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// Connexion
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Trouver utilisateur
    const user = database.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'video-auto-secret',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Connexion réussie !',
      user: {
        id: user.id,
        email: user.email,
        companyName: user.companyName,
        earlyBirdNumber: user.earlyBirdNumber
      },
      token
    });

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// === ROUTES PROTÉGÉES ===

// Profil utilisateur
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const user = database.users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  res.json({
    id: user.id,
    email: user.email,
    companyName: user.companyName,
    websiteUrl: user.websiteUrl,
    earlyBirdNumber: user.earlyBirdNumber,
    accountType: user.accountType,
    createdAt: user.createdAt
  });
});

// Mettre à jour profil
app.put('/api/user/profile', authenticateToken, (req, res) => {
  const { companyName, websiteUrl } = req.body;
  const userIndex = database.users.findIndex(u => u.id === req.user.userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  if (companyName) database.users[userIndex].companyName = companyName;
  if (websiteUrl) database.users[userIndex].websiteUrl = websiteUrl;
  
  saveDatabase();
  
  res.json({ success: true, message: 'Profil mis à jour' });
});

// Analyser site web pour extraire produits
app.post('/api/analyze-website', authenticateToken, async (req, res) => {
  try {
    const { websiteUrl } = req.body;
    
    if (!websiteUrl) {
      return res.status(400).json({ error: 'URL du site requis' });
    }

    // Simulation d'analyse de site web
    // En production, vous utiliseriez Puppeteer ou une API de scraping
    const products = [
      {
        name: 'iPhone 15 Pro',
        price: '1199€',
        images: [
          'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400',
          'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'
        ],
        description: 'Le dernier iPhone avec puce A17 Pro'
      },
      {
        name: 'MacBook Air M2',
        price: '1499€',
        images: [
          'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400',
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400'
        ],
        description: 'Ultraportable avec puce M2'
      },
      {
        name: 'AirPods Pro',
        price: '279€',
        images: [
          'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=400'
        ],
        description: 'Écouteurs sans fil avec réduction de bruit'
      }
    ];

    res.json({
      success: true,
      websiteUrl,
      productsFound: products.length,
      products
    });

  } catch (error) {
    console.error('Erreur analyse site:', error);
    res.status(500).json({ error: 'Erreur lors de l\'analyse du site' });
  }
});

// Styles de vidéo disponibles
app.get('/api/video-styles', authenticateToken, (req, res) => {
  res.json({
    styles: database.settings.videoStyles
  });
});

// Créer projet vidéo
app.post('/api/projects', authenticateToken, (req, res) => {
  try {
    const { name, websiteUrl, selectedProducts, videoStyle } = req.body;

    if (!name || !selectedProducts || !videoStyle) {
      return res.status(400).json({ error: 'Nom, produits et style requis' });
    }

    const project = {
      id: Date.now().toString(),
      userId: req.user.userId,
      name,
      websiteUrl,
      selectedProducts,
      videoStyle,
      status: 'pending',
      createdAt: new Date().toISOString(),
      videos: []
    };

    database.projects.push(project);
    saveDatabase();

    res.json({
      success: true,
      message: 'Projet créé avec succès',
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        createdAt: project.createdAt
      }
    });

  } catch (error) {
    console.error('Erreur création projet:', error);
    res.status(500).json({ error: 'Erreur lors de la création du projet' });
  }
});

// Lister projets utilisateur
app.get('/api/projects', authenticateToken, (req, res) => {
  const userProjects = database.projects.filter(p => p.userId === req.user.userId);
  
  res.json({
    projects: userProjects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      videoStyle: p.videoStyle,
      createdAt: p.createdAt,
      videosCount: p.videos.length
    }))
  });
});

// Détails d'un projet
app.get('/api/projects/:projectId', authenticateToken, (req, res) => {
  const project = database.projects.find(p => 
    p.id === req.params.projectId && p.userId === req.user.userId
  );

  if (!project) {
    return res.status(404).json({ error: 'Projet non trouvé' });
  }

  res.json({ project });
});

// Générer vidéos pour un projet
app.post('/api/projects/:projectId/generate-videos', authenticateToken, async (req, res) => {
  try {
    const projectIndex = database.projects.findIndex(p => 
      p.id === req.params.projectId && p.userId === req.user.userId
    );

    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const project = database.projects[projectIndex];
    
    // Simulation de génération de vidéos avec IA
    const generatedVideos = [];
    
    for (const product of project.selectedProducts) {
      // Simuler plusieurs versions de vidéo pour chaque produit
      const videoVersions = [
        {
          id: Date.now().toString() + '_v1',
          productName: product.name,
          version: 'Version 1',
          style: project.videoStyle,
          duration: 15,
          format: 'mp4',
          resolution: '1080x1920',
          thumbnail: product.images[0],
          videoUrl: `/api/placeholder/video/${product.name.replace(/\s+/g, '-')}-v1.mp4`,
          status: 'ready',
          createdAt: new Date().toISOString(),
          platforms: ['instagram', 'tiktok', 'youtube']
        },
        {
          id: Date.now().toString() + '_v2',
          productName: product.name,
          version: 'Version 2',
          style: project.videoStyle,
          duration: 20,
          format: 'mp4',
          resolution: '1080x1920',
          thumbnail: product.images[0],
          videoUrl: `/api/placeholder/video/${product.name.replace(/\s+/g, '-')}-v2.mp4`,
          status: 'ready',
          createdAt: new Date().toISOString(),
          platforms: ['instagram', 'tiktok', 'youtube']
        },
        {
          id: Date.now().toString() + '_v3',
          productName: product.name,
          version: 'Version 3',
          style: project.videoStyle,
          duration: 25,
          format: 'mp4',
          resolution: '1080x1920',
          thumbnail: product.images[0],
          videoUrl: `/api/placeholder/video/${product.name.replace(/\s+/g, '-')}-v3.mp4`,
          status: 'ready',
          createdAt: new Date().toISOString(),
          platforms: ['instagram', 'tiktok', 'youtube']
        }
      ];

      generatedVideos.push(...videoVersions);
    }

    // Mettre à jour le projet
    database.projects[projectIndex].videos = generatedVideos;
    database.projects[projectIndex].status = 'completed';
    
    // Ajouter les vidéos à la collection globale
    database.videos.push(...generatedVideos.map(v => ({
      ...v,
      projectId: project.id,
      userId: req.user.userId
    })));

    saveDatabase();

    res.json({
      success: true,
      message: `${generatedVideos.length} vidéos générées avec succès !`,
      videos: generatedVideos
    });

  } catch (error) {
    console.error('Erreur génération vidéos:', error);
    res.status(500).json({ error: 'Erreur lors de la génération des vidéos' });
  }
});

// Lister toutes les vidéos de l'utilisateur
app.get('/api/videos', authenticateToken, (req, res) => {
  const userVideos = database.videos.filter(v => v.userId === req.user.userId);
  
  res.json({
    videos: userVideos,
    total: userVideos.length
  });
});

// Télécharger vidéo
app.get('/api/videos/:videoId/download', authenticateToken, (req, res) => {
  const video = database.videos.find(v => 
    v.id === req.params.videoId && v.userId === req.user.userId
  );

  if (!video) {
    return res.status(404).json({ error: 'Vidéo non trouvée' });
  }

  // En production, vous retourneriez le fichier vidéo réel
  res.json({
    success: true,
    downloadUrl: video.videoUrl,
    fileName: `${video.productName}-${video.version}.${video.format}`
  });
});

// Programmer publication sur réseaux sociaux
app.post('/api/videos/:videoId/schedule', authenticateToken, (req, res) => {
  try {
    const { platforms, scheduledDate, caption } = req.body;
    
    const video = database.videos.find(v => 
      v.id === req.params.videoId && v.userId === req.user.userId
    );

    if (!video) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }

    // Simuler la programmation
    const scheduledPosts = platforms.map(platform => ({
      id: Date.now().toString() + '_' + platform,
      videoId: video.id,
      platform,
      scheduledDate,
      caption,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    }));

    // En production, vous intégreriez avec les APIs des réseaux sociaux
    res.json({
      success: true,
      message: `Vidéo programmée sur ${platforms.length} plateformes`,
      scheduledPosts
    });

  } catch (error) {
    console.error('Erreur programmation:', error);
    res.status(500).json({ error: 'Erreur lors de la programmation' });
  }
});

// Page d'accueil publique
app.get('/', (req, res) => {
  const remaining = database.settings.maxFreeUsers - database.settings.currentFreeUsers;
  
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vidéo Auto - ${remaining} Places Gratuites Restantes !</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
</head>
<body class="bg-gray-50">
    <!-- Barre urgence -->
    <div class="bg-red-600 text-white py-2 text-center font-bold">
        🔥 Plus que ${remaining} places gratuites sur 100 !
    </div>

    <!-- Header -->
    <header class="bg-white shadow-sm py-4">
        <div class="container mx-auto px-6 flex justify-between items-center">
            <h1 class="text-2xl font-bold text-purple-600">Vidéo Auto</h1>
            <div class="space-x-4">
                <button onclick="showLogin()" class="text-purple-600 hover:text-purple-800">
                    Connexion
                </button>
                <button onclick="showRegister()" class="bg-purple-600 text-white px-6 py-2 rounded-lg">
                    Inscription Gratuite
                </button>
            </div>
        </div>
    </header>

    <!-- Hero -->
    <section class="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div class="container mx-auto px-6 text-center">
            <h2 class="text-5xl font-bold mb-6">
                Créez des vidéos produit automatiquement
            </h2>
            <p class="text-xl mb-8">
                Analysez votre site • Choisissez votre style • Générez des vidéos IA
            </p>
            
            <div class="bg-white bg-opacity-20 rounded-lg p-6 mb-8 max-w-md mx-auto">
                <div class="text-3xl font-bold mb-2">🎁 100 COMPTES GRATUITS</div>
                <div class="text-xl mb-2">Accès complet à vie</div>
                <div class="text-lg">Plus que ${remaining} places !</div>
            </div>

            <button onclick="showRegister()" class="bg-yellow-400 text-purple-900 px-8 py-3 rounded-lg font-bold text-xl">
                💎 Créer mon Compte Gratuit
            </button>
        </div>
    </section>

    <!-- Fonctionnalités -->
    <section class="py-16">
        <div class="container mx-auto px-6">
            <h3 class="text-3xl font-bold text-center mb-12">Comment ça marche</h3>
            <div class="grid md:grid-cols-4 gap-8">
                <div class="text-center">
                    <div class="text-4xl mb-4">🔍</div>
                    <h4 class="font-bold mb-2">1. Analysez votre site</h4>
                    <p class="text-gray-600">Entrez l'URL de votre boutique</p>
                </div>
                <div class="text-center">
                    <div class="text-4xl mb-4">🎨</div>
                    <h4 class="font-bold mb-2">2. Choisissez le style</h4>
                    <p class="text-gray-600">Sélectionnez parmi 4 styles de vidéo</p>
                </div>
                <div class="text-center">
                    <div class="text-4xl mb-4">🤖</div>
                    <h4 class="font-bold mb-2">3. IA génère les vidéos</h4>
                    <p class="text-gray-600">3 versions par produit automatiquement</p>
                </div>
                <div class="text-center">
                    <div class="text-4xl mb-4">📱</div>
                    <h4 class="font-bold mb-2">4. Publiez partout</h4>
                    <p class="text-gray-600">Instagram, TikTok, YouTube</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Modals -->
    <div id="loginModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold">Connexion</h3>
                <button onclick="hideLogin()" class="text-gray-500 hover:text-gray-700">
                    <i data-lucide="x" class="w-6 h-6"></i>
                </button>
            </div>
            <form id="loginForm" onsubmit="login(event)">
                <div class="space-y-4">
                    <input type="email" id="loginEmail" placeholder="Email" class="w-full px-4 py-3 border rounded-lg" required>
                    <input type="password" id="loginPassword" placeholder="Mot de passe" class="w-full px-4 py-3 border rounded-lg" required>
                    <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold">
                        Se connecter
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div id="registerModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold">Inscription Gratuite</h3>
                <button onclick="hideRegister()" class="text-gray-500 hover:text-gray-700">
                    <i data-lucide="x" class="w-6 h-6"></i>
                </button>
            </div>
            <form id="registerForm" onsubmit="register(event)">
                <div class="space-y-4">
                    <input type="email" id="registerEmail" placeholder="Email" class="w-full px-4 py-3 border rounded-lg" required>
                    <input type="password" id="registerPassword" placeholder="Mot de passe" class="w-full px-4 py-3 border rounded-lg" required>
                    <input type="text" id="registerCompany" placeholder="Nom de votre entreprise" class="w-full px-4 py-3 border rounded-lg" required>
                    <input type="url" id="registerWebsite" placeholder="https://monsite.com (optionnel)" class="w-full px-4 py-3 border rounded-lg">
                    <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold">
                        Créer mon compte gratuit
                    </button>
                </div>
            </form>
        </div>
    </div>

    <script>
        lucide.createIcons();

        function showLogin() {
            document.getElementById('loginModal').classList.remove('hidden');
        }

        function hideLogin() {
            document.getElementById('loginModal').classList.add('hidden');
        }

        function showRegister() {
            document.getElementById('registerModal').classList.remove('hidden');
        }

        function hideRegister() {
            document.getElementById('registerModal').classList.add('hidden');
        }

        async function login(event) {
            event.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/dashboard';
                } else {
                    alert('Erreur: ' + data.error);
                }
            } catch (error) {
                alert('Erreur de connexion');
            }
        }

        async function register(event) {
            event.preventDefault();
            
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const companyName = document.getElementById('registerCompany').value;
            const websiteUrl = document.getElementById('registerWebsite').value;
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, companyName, websiteUrl })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    alert('🎉 Compte créé ! Vous êtes le client #' + data.user.earlyBirdNumber + '/100');
                    window.location.href = '/dashboard';
                } else {
                    alert('Erreur: ' + data.error);
                }
            } catch (error) {
                alert('Erreur d\\'inscription');
            }
        }

        // Vérifier si déjà connecté
        if (localStorage.getItem('token')) {
            window.location.href = '/dashboard';
        }
    </script>
</body>
</html>
  `);
});

// Dashboard utilisateur
app.get('/dashboard', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Vidéo Auto</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
</head>
<body class="bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
        <div class="container mx-auto px-6 py-4">
            <div class="flex justify-between items-center">
                <h1 class="text-2xl font-bold text-purple-600">Vidéo Auto</h1>
                <div class="flex items-center space-x-4">
                    <span id="
