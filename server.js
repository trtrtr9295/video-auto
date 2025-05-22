require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Base de données en mémoire (sera sauvegardée en JSON)
let database = {
  users: [],
  projects: [],
  videos: [],
  settings: {
    maxFreeUsers: 100,
    currentFreeUsers: 0
  }
};

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Middleware d'authentification
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }
  try {
    const decoded = jwt.verify(token, 'video-auto-secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

// === ROUTES PUBLIQUES ===

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Vidéo Auto API fonctionnelle !',
    freeUsersLeft: database.settings.maxFreeUsers - database.settings.currentFreeUsers,
    totalUsers: database.users.length
  });
});

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, companyName, websiteUrl } = req.body;

    if (!email || !password || !companyName) {
      return res.status(400).json({ error: 'Tous les champs requis' });
    }

    if (database.settings.currentFreeUsers >= database.settings.maxFreeUsers) {
      return res.status(400).json({ error: 'Limite de 100 utilisateurs atteinte' });
    }

    const existingUser = database.users.find(u => u.email === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      email: email.toLowerCase(),
      password: hashedPassword,
      companyName,
      websiteUrl: websiteUrl || '',
      earlyBirdNumber: database.settings.currentFreeUsers + 1,
      createdAt: new Date().toISOString()
    };

    database.users.push(user);
    database.settings.currentFreeUsers++;

    const token = jwt.sign({ userId: user.id, email: user.email }, 'video-auto-secret', { expiresIn: '30d' });

    res.json({
      success: true,
      message: 'Compte créé !',
      user: {
        id: user.id,
        email: user.email,
        companyName: user.companyName,
        earlyBirdNumber: user.earlyBirdNumber
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur inscription' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = database.users.find(u => u.email === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, 'video-auto-secret', { expiresIn: '30d' });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        companyName: user.companyName,
        earlyBirdNumber: user.earlyBirdNumber
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur connexion' });
  }
});

// === ROUTES PROTÉGÉES ===

app.get('/api/user/profile', auth, (req, res) => {
  const user = database.users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }
  res.json({
    id: user.id,
    email: user.email,
    companyName: user.companyName,
    websiteUrl: user.websiteUrl,
    earlyBirdNumber: user.earlyBirdNumber
  });
});

app.post('/api/analyze-website', auth, (req, res) => {
  const { websiteUrl } = req.body;
  
  if (!websiteUrl) {
    return res.status(400).json({ error: 'URL requis' });
  }

  // Simulation d'analyse avec produits réalistes
  const products = [
    {
      name: 'iPhone 15 Pro',
      price: '1199€',
      images: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400'],
      description: 'Smartphone dernière génération'
    },
    {
      name: 'MacBook Air M2',
      price: '1499€',
      images: ['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400'],
      description: 'Ordinateur portable ultra-fin'
    },
    {
      name: 'AirPods Pro',
      price: '279€',
      images: ['https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=400'],
      description: 'Écouteurs sans fil premium'
    }
  ];

  setTimeout(() => {
    res.json({
      success: true,
      websiteUrl,
      productsFound: products.length,
      products
    });
  }, 2000);
});

app.get('/api/video-styles', auth, (req, res) => {
  const styles = [
    {
      id: 'modern',
      name: 'Moderne',
      description: 'Style épuré avec transitions fluides',
      preview: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=300'
    },
    {
      id: 'dynamic',
      name: 'Dynamique',
      description: 'Animations énergiques avec effets',
      preview: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300'
    },
    {
      id: 'elegant',
      name: 'Élégant',
      description: 'Style premium sophistiqué',
      preview: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=300'
    },
    {
      id: 'playful',
      name: 'Ludique',
      description: 'Couleurs vives et animations fun',
      preview: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300'
    }
  ];
  
  res.json({ styles });
});

app.post('/api/projects', auth, (req, res) => {
  const { name, websiteUrl, selectedProducts, videoStyle } = req.body;

  if (!name || !selectedProducts || !videoStyle) {
    return res.status(400).json({ error: 'Données manquantes' });
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

  res.json({
    success: true,
    message: 'Projet créé',
    project: {
      id: project.id,
      name: project.name,
      status: project.status
    }
  });
});

app.get('/api/projects', auth, (req, res) => {
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

app.post('/api/projects/:projectId/generate-videos', auth, (req, res) => {
  const projectIndex = database.projects.findIndex(p => 
    p.id === req.params.projectId && p.userId === req.user.userId
  );

  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Projet non trouvé' });
  }

  const project = database.projects[projectIndex];
  
  // Générer 3 versions par produit
  const generatedVideos = [];
  
  project.selectedProducts.forEach(product => {
    for (let i = 1; i <= 3; i++) {
      const video = {
        id: Date.now().toString() + '_' + i,
        productName: product.name,
        version: `Version ${i}`,
        style: project.videoStyle,
        duration: 15 + (i * 5),
        format: 'mp4',
        resolution: '1080x1920',
        thumbnail: product.images[0],
        videoUrl: `/videos/${product.name}-v${i}.mp4`,
        status: 'ready',
        createdAt: new Date().toISOString(),
        platforms: ['instagram', 'tiktok', 'youtube'],
        projectId: project.id,
        userId: req.user.userId
      };
      generatedVideos.push(video);
    }
  });

  // Mettre à jour le projet
  database.projects[projectIndex].videos = generatedVideos;
  database.projects[projectIndex].status = 'completed';
  
  // Ajouter à la collection globale
  database.videos.push(...generatedVideos);

  setTimeout(() => {
    res.json({
      success: true,
      message: `${generatedVideos.length} vidéos générées avec succès !`,
      videos: generatedVideos
    });
  }, 3000);
});

app.get('/api/videos', auth, (req, res) => {
  const userVideos = database.videos.filter(v => v.userId === req.user.userId);
  res.json({ videos: userVideos, total: userVideos.length });
});

app.get('/api/videos/:videoId/download', auth, (req, res) => {
  const video = database.videos.find(v => 
    v.id === req.params.videoId && v.userId === req.user.userId
  );

  if (!video) {
    return res.status(404).json({ error: 'Vidéo non trouvée' });
  }

  res.json({
    success: true,
    downloadUrl: video.videoUrl,
    fileName: `${video.productName}-${video.version}.${video.format}`
  });
});

app.post('/api/videos/:videoId/schedule', auth, (req, res) => {
  const { platforms, scheduledDate, caption } = req.body;
  
  const video = database.videos.find(v => 
    v.id === req.params.videoId && v.userId === req.user.userId
  );

  if (!video) {
    return res.status(404).json({ error: 'Vidéo non trouvée' });
  }

  res.json({
    success: true,
    message: `Vidéo programmée sur ${platforms.length} plateformes`,
    scheduledPosts: platforms.map(platform => ({
      platform,
      scheduledDate,
      caption,
      status: 'scheduled'
    }))
  });
});

// Page d'accueil
app.get('/', (req, res) => {
  const remaining = database.settings.maxFreeUsers - database.settings.currentFreeUsers;
  
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vidéo Auto - ${remaining} Places Gratuites !</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
</head>
<body class="bg-gray-50">
    <div class="bg-red-600 text-white py-2 text-center font-bold">
        🔥 Plus que ${remaining} places gratuites sur 100 !
    </div>

    <header class="bg-white shadow-sm py-4">
        <div class="container mx-auto px-6 flex justify-between items-center">
            <h1 class="text-2xl font-bold text-purple-600">Vidéo Auto</h1>
            <div class="space-x-4">
                <button onclick="showLogin()" class="text-purple-600">Connexion</button>
                <button onclick="showRegister()" class="bg-purple-600 text-white px-6 py-2 rounded-lg">Inscription</button>
            </div>
        </div>
    </header>

    <section class="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div class="container mx-auto px-6 text-center">
            <h2 class="text-5xl font-bold mb-6">Créez des vidéos produit automatiquement</h2>
            <p class="text-xl mb-8">IA • Styles personnalisés • 3 versions par produit</p>
            
            <div class="bg-white bg-opacity-20 rounded-lg p-6 mb-8 max-w-md mx-auto">
                <div class="text-3xl font-bold mb-2">🎁 100 COMPTES GRATUITS</div>
                <div class="text-xl">Plus que ${remaining} places !</div>
            </div>

            <button onclick="showRegister()" class="bg-yellow-400 text-purple-900 px-8 py-3 rounded-lg font-bold text-xl">
                💎 Créer mon Compte
            </button>
        </div>
    </section>

    <section class="py-16">
        <div class="container mx-auto px-6">
            <h3 class="text-3xl font-bold text-center mb-12">Comment ça marche</h3>
            <div class="grid md:grid-cols-4 gap-8">
                <div class="text-center">
                    <div class="text-4xl mb-4">🔍</div>
                    <h4 class="font-bold mb-2">1. Analysez</h4>
                    <p class="text-gray-600">URL de votre boutique</p>
                </div>
                <div class="text-center">
                    <div class="text-4xl mb-4">🎨</div>
                    <h4 class="font-bold mb-2">2. Choisissez</h4>
                    <p class="text-gray-600">Style de vidéo</p>
                </div>
                <div class="text-center">
                    <div class="text-4xl mb-4">🤖</div>
                    <h4 class="font-bold mb-2">3. Générez</h4>
                    <p class="text-gray-600">3 versions par produit</p>
                </div>
                <div class="text-center">
                    <div class="text-4xl mb-4">📱</div>
                    <h4 class="font-bold mb-2">4. Publiez</h4>
                    <p class="text-gray-600">Tous réseaux sociaux</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Modals -->
    <div id="loginModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 class="text-2xl font-bold mb-6">Connexion</h3>
            <form onsubmit="login(event)">
                <div class="space-y-4">
                    <input type="email" id="loginEmail" placeholder="Email" class="w-full px-4 py-3 border rounded-lg" required>
                    <input type="password" id="loginPassword" placeholder="Mot de passe" class="w-full px-4 py-3 border rounded-lg" required>
                    <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold">Connexion</button>
                </div>
            </form>
            <button onclick="hideLogin()" class="mt-4 text-gray-500">Fermer</button>
        </div>
    </div>

    <div id="registerModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 class="text-2xl font-bold mb-6">Inscription Gratuite</h3>
            <form onsubmit="register(event)">
                <div class="space-y-4">
                    <input type="email" id="registerEmail" placeholder="Email" class="w-full px-4 py-3 border rounded-lg" required>
                    <input type="password" id="registerPassword" placeholder="Mot de passe" class="w-full px-4 py-3 border rounded-lg" required>
                    <input type="text" id="registerCompany" placeholder="Nom entreprise" class="w-full px-4 py-3 border rounded-lg" required>
                    <input type="url" id="registerWebsite" placeholder="https://monsite.com" class="w-full px-4 py-3 border rounded-lg">
                    <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold">Créer compte</button>
                </div>
            </form>
            <button onclick="hideRegister()" class="mt-4 text-gray-500">Fermer</button>
        </div>
    </div>

    <script>
        lucide.createIcons();

        function showLogin() { document.getElementById('loginModal').classList.remove('hidden'); }
        function hideLogin() { document.getElementById('loginModal').classList.add('hidden'); }
        function showRegister() { document.getElementById('registerModal').classList.remove('hidden'); }
        function hideRegister() { document.getElementById('registerModal').classList.add('hidden'); }

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
                    alert('🎉 Compte créé ! Vous êtes le client #' + data.user.earlyBirdNumber);
                    window.location.href = '/dashboard';
                } else {
                    alert('Erreur: ' + data.error);
                }
            } catch (error) {
                alert('Erreur inscription');
            }
        }

        if (localStorage.getItem('token')) {
            window.location.href = '/dashboard';
        }
    </script>
</body>
</html>
  `);
});

// Dashboard
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
    <header class="bg-white shadow-sm">
        <div class="container mx-auto px-6 py-4 flex justify-between items-center">
            <h1 class="text-2xl font-bold text-purple-600">Vidéo Auto</h1>
            <div class="flex items-center space-x-4">
                <span id="userName"></span>
                <button onclick="logout()" class="text-red-600">Déconnexion</button>
            </div>
        </div>
    </header>

    <nav class="bg-gray-100 border-b">
        <div class="container mx-auto px-6">
            <div class="flex space-x-8">
                <button onclick="showSection('dashboard')" class="py-4 px-2 border-b-2 border-purple-600 text-purple-600 font-medium" id="dashboardTab">Dashboard</button>
                <button onclick="showSection('projects')" class="py-4 px-2 text-gray-600 hover:text-purple-600" id="projectsTab">Projets</button>
                <button onclick="showSection('videos')" class="py-4 px-2 text-gray-600 hover:text-purple-600" id="videosTab">Vidéos</button>
                <button onclick="showSection('create')" class="py-4 px-2 text-gray-600 hover:text-purple-600" id="createTab">Nouveau</button>
            </div>
        </div>
    </nav>

    <div id="dashboardSection" class="container mx-auto px-6 py-8">
        <h2 class="text-3xl font-bold mb-8">Dashboard</h2>
        
        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="bg-blue-100 rounded-lg p-3 mr-4">
                        <i data-lucide="folder" class="w-6 h-6 text-blue-600"></i>
                    </div>
                    <div>
                        <p class="text-2xl font-bold" id="projectsCount">0</p>
                        <p class="text-gray-600">Projets</p>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="bg-green-100 rounded-lg p-3 mr-4">
                        <i data-lucide="video" class="w-6 h-6 text-green-600"></i>
                    </div>
                    <div>
                        <p class="text-2xl font-bold" id="videosCount">0</p>
                        <p class="text-gray-600">Vidéos</p>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center">
                    <div class="bg-purple-100 rounded-lg p-3 mr-4">
                        <i data-lucide="crown" class="w-6 h-6 text-purple-600"></i>
                    </div>
                    <div>
                        <p class="text-2xl font-bold">GRATUIT</p>
                        <p class="text-gray-600">À vie</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-bold mb-4">Actions rapides</h3>
            <div class="grid md:grid-cols-2 gap-4">
                <button onclick="showSection('create')" class="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700">
                    <div class="flex items-center mb-2">
                        <i data-lucide="plus" class="w-5 h-5 mr-2"></i>
                        <span class="font-bold">Nouveau projet</span>
                    </div>
                    <p class="text-sm opacity-90">Créer des vidéos produit</p>
                </button>
                <button onclick="showSection('videos')" class="bg-gray-100 text-gray-800 p-4 rounded-lg hover:bg-gray-200">
                    <div class="flex items-center mb-2">
                        <i data-lucide="play" class="w-5 h-5 mr-2"></i>
                        <span class="font-bold">Mes vidéos</span>
                    </div>
                    <p class="text-sm">Gérer mes créations</p>
                </button>
            </div>
        </div>
    </div>

    <div id="projectsSection" class="hidden container mx-auto px-6 py-8">
        <h2 class="text-3xl font-bold mb-8">Mes Projets</h2>
        <div id="projectsList"></div>
    </div>

    <div id="videosSection" class="hidden container mx-auto px-6 py-8">
        <h2 class="text-3xl font-bold mb-8">Mes Vidéos</h2>
        <div id="videosList"></div>
    </div>

    <div id="createSection" class="hidden container mx-auto px-6 py-8">
        <h2 class="text-3xl font-bold mb-8">Nouveau Projet</h2>
        
        <div id="step1" class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-xl font-bold mb-4">1. Informations</h3>
            <div class="space-y-4">
                <input type="text" id="projectName" placeholder="Nom du projet" class="w-full px-4 py-2 border rounded-lg">
                <input type="url" id="websiteUrl" placeholder="https://monsite.com" class="w-full px-4 py-2 border rounded-lg">
                <button onclick="analyzeWebsite()" class="bg-purple-600 text-white px-6 py-2 rounded-lg">Analyser</button>
            </div>
        </div>

        <div id="step2" class="hidden bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-xl font-bold mb-4">2. Produits</h3>
            <div id="productsList" class="grid md:grid-cols-3 gap-4"></div>
            <button onclick="showStep3()" class="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg">Continuer</button>
        </div>

        <div id="step3" class="hidden bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-xl font-bold mb-4">3. Style vidéo</h3>
            <div id="stylesList" class="grid md:grid-cols-2 gap-4"></div>
            <button onclick="createProject()" class="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg">Générer vidéos</button>
        </div>

        <div id="generatingVideos" class="hidden bg-white rounded-lg shadow p-6 text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h3 class="text-xl font-bold mb-2">Génération en cours...</h3>
            <p class="text-gray-600">L'IA crée vos vidéos</p>
        </div>
    </div>

    <script>
        lucide.createIcons();
        
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token) window.location.href = '/';
        
        document.getElementById('userName').textContent = user.companyName || user.email;
        
        let selectedProducts = [];
        let selectedStyle = null;
        let videoStyles = [];

        loadDashboardData();
        loadVideoStyles();

        function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }

        function showSection(section) {
            document.querySelectorAll('[id$="Section"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id$="Tab"]').forEach(el => {
                el.className = 'py-4 px-2 text-gray-600 hover:text-purple-600';
            });
            
            document.getElementById(section + 'Section').classList.remove('hidden');
            const tab = document.getElementById(section + 'Tab');
            if (tab) {
                tab.className = 'py-4 px-2 border-b-2 border-purple-600 text-purple-600 font-medium';
            }

            if (section === 'projects') loadProjects();
            if (section === 'videos') loadVideos();
        }

        async function loadDashboardData() {
            try {
                const [projectsRes, videosRes] = await Promise.all([
                    fetch('/api/projects', { headers: { 'Authorization': 'Bearer ' + token } }),
                    fetch('/api/videos', { headers: { 'Authorization': 'Bearer ' + token } })
                ]);

                const projectsData = await projectsRes.json();
                const videosData = await videosRes.json();

                document.getElementById('projectsCount').textContent = projectsData.projects.length;
                document.getElementById('videosCount').textContent = videosData.videos.length;
            } catch (error) {
                console.error('Erreur:', error);
            }
        }

        async function loadVideoStyles() {
            try {
                const response = await fetch('/api/video-styles', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await response.json();
                videoStyles = data.styles;
            } catch (error) {
                console.error('Erreur styles:', error);
            }
        }

        async function analyzeWebsite() {
            const websiteUrl = document.getElementById('websiteUrl').value;
            const projectName = document.getElementById('projectName').value;

            if (!websiteUrl || !projectName) {
                alert('Veuillez remplir tous les champs');
                return;
            }

            try {
                const response = await fetch('/api/analyze-website', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ websiteUrl })
                });

                const data = await response.json();

                if (data.success) {
                    displayProducts(data.products);
                    document.getElementById('step2').classList.remove('hidden');
                } else {
                    alert('Erreur: ' + data.error);
                }
            } catch (error) {
                alert('Erreur analyse site');
            }
        }

        function displayProducts(products) {
            const productsList = document.getElementById('productsList');
            productsList.innerHTML = products.map(product => 
                '<div class="border rounded-lg p-4 cursor-pointer hover:bg-gray-50" onclick="toggleProduct(this, ' + 
                JSON.stringify(product).replace(/"/g, '&quot;') + ')">' +
                '<img src="' + product.images[0] + '" alt="' + product.name + '" class="w-full h-32 object-cover rounded mb-2">' +
                '<h4 class="font-bold">' + product.name + '</h4>' +
                '<p class="text-gray-600">' + product.price + '</p>' +
                '<p class="text-sm text-gray-500 mt-1">' + product.description + '</p>' +
                '<div class="mt-2">' +
                '<input type="checkbox" class="mr-2">' +
                '<span class="text-sm">Sélectionner</span>' +
                '</div>' +
                '</div>'
            ).join('');
        }

        function toggleProduct(element, product) {
            const checkbox = element.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            
            if (checkbox.checked) {
                selectedProducts.push(product);
                element.classList.add('bg-purple-50', 'border-purple-300');
            } else {
                selectedProducts = selectedProducts.filter(p => p.name !== product.name);
                element.classList.remove('bg-purple-50', 'border-purple-300');
            }
        }

        function showStep3() {
            if (selectedProducts.length === 0) {
                alert('Sélectionnez au moins un produit');
                return;
            }

            const stylesList = document.getElementById('stylesList');
            stylesList.innerHTML = videoStyles.map(style => 
                '<div class="border rounded-lg p-4 cursor-pointer hover:bg-gray-50" onclick="selectStyle(this, \'' + style.id + '\')">' +
                '<img src="' + style.preview + '" alt="' + style.name + '" class="w-full h-32 object-cover rounded mb-2">' +
                '<h4 class="font-bold">' + style.name + '</h4>' +
                '<p class="text-gray-600">' + style.description + '</p>' +
                '<div class="mt-2">' +
                '<input type="radio" name="videoStyle" class="mr-2">' +
                '<span class="text-sm">Choisir</span>' +
                '</div>' +
                '</div>'
            ).join('');

            document.getElementById('step3').classList.remove('hidden');
        }

        function selectStyle(element, styleId) {
            document.querySelectorAll('[name="videoStyle"]').forEach(radio => {
                radio.checked = false;
                radio.closest('div').parentNode.classList.remove('bg-purple-50', 'border-purple-300');
            });

            const radio = element.querySelector('input[type="radio"]');
            radio.checked = true;
            element.classList.add('bg-purple-50', 'border-purple-300');
            selectedStyle = styleId;
        }

        async function createProject() {
            if (!selectedStyle) {
                alert('Sélectionnez un style');
                return;
            }

            const projectName = document.getElementById('projectName').value;
            const websiteUrl = document.getElementById('websiteUrl').value;

            document.getElementById('step1').classList.add('hidden');
            document.getElementById('step2').classList.add('hidden');
            document.getElementById('step3').classList.add('hidden');
            document.getElementById('generatingVideos').classList.remove('hidden');

            try {
                const createResponse = await fetch('/api/projects', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        name: projectName,
                        websiteUrl,
                        selectedProducts,
                        videoStyle: selectedStyle
                    })
                });

                const createData = await createResponse.json();

                if (createData.success) {
                    const generateResponse = await fetch('/api/projects/' + createData.project.id + '/generate-videos', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });

                    const generateData = await generateResponse.json();

                    if (generateData.success) {
                        alert('🎉 ' + generateData.message);
                        showSection('videos');
                        loadVideos();
                    }
                }
            } catch (error) {
                alert('Erreur création projet');
            }

            document.getElementById('generatingVideos').classList.add('hidden');
            document.getElementById('step1').classList.remove('hidden');
            document.getElementById('step2').classList.add('hidden');
            document.getElementById('step3').classList.add('hidden');
            selectedProducts = [];
            selectedStyle = null;
        }

        async function loadProjects() {
            try {
                const response = await fetch('/api/projects', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await response.json();

                const projectsList = document.getElementById('projectsList');
                
                if (data.projects.length === 0) {
                    projectsList.innerHTML = 
                        '<div class="text-center py-12">' +
                        '<i data-lucide="folder-plus" class="w-16 h-16 text-gray-400 mx-auto mb-4"></i>' +
                        '<p class="text-gray-600 mb-4">Aucun projet</p>' +
                        '<button onclick="showSection(\'create\')" class="bg-purple-600 text-white px-6 py-2 rounded-lg">Créer projet</button>' +
                        '</div>';
                } else {
                    projectsList.innerHTML = 
                        '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">' +
                        data.projects.map(project => 
                            '<div class="bg-white rounded-lg shadow p-6">' +
                            '<h3 class="font-bold text-lg mb-2">' + project.name + '</h3>' +
                            '<p class="text-gray-600 mb-4">Style: ' + project.videoStyle + '</p>' +
                            '<div class="flex justify-between items-center text-sm text-gray-500 mb-4">' +
                            '<span>' + project.videosCount + ' vidéos</span>' +
                            '<span>' + new Date(project.createdAt).toLocaleDateString() + '</span>' +
                            '</div>' +
                            '<button class="w-full bg-purple-600 text-white px-4 py-2 rounded">Voir</button>' +
                            '</div>'
                        ).join('') +
                        '</div>';
                }
                
                lucide.createIcons();
            } catch (error) {
                console.error('Erreur projets:', error);
            }
        }

        async function loadVideos() {
            try {
                const response = await fetch('/api/videos', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await response.json();

                const videosList = document.getElementById('videosList');
                
                if (data.videos.length === 0) {
                    videosList.innerHTML = 
                        '<div class="text-center py-12">' +
                        '<i data-lucide="video" class="w-16 h-16 text-gray-400 mx-auto mb-4"></i>' +
                        '<p class="text-gray-600 mb-4">Aucune vidéo</p>' +
                        '<button onclick="showSection(\'create\')" class="bg-purple-600 text-white px-6 py-2 rounded-lg">Créer vidéo</button>' +
                        '</div>';
                } else {
                    videosList.innerHTML = 
                        '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">' +
                        data.videos.map(video => 
                            '<div class="bg-white rounded-lg shadow overflow-hidden">' +
                            '<img src="' + video.thumbnail + '" alt="' + video.productName + '" class="w-full h-48 object-cover">' +
                            '<div class="p-4">' +
                            '<h3 class="font-bold mb-1">' + video.productName + '</h3>' +
                            '<p class="text-gray-600 text-sm mb-2">' + video.version + '</p>' +
                            '<div class="flex justify-between items-center text-sm text-gray-500 mb-4">' +
                            '<span>' + video.duration + 's</span>' +
                            '<span>' + video.resolution + '</span>' +
                            '</div>' +
                            '<div class="space-y-2">' +
                            '<button onclick="downloadVideo(\'' + video.id + '\')" class="w-full bg-green-600 text-white px-4 py-2 rounded text-sm">Télécharger</button>' +
                            '<button onclick="scheduleVideo(\'' + video.id + '\')" class="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm">Programmer</button>' +
                            '</div>' +
                            '</div>' +
                            '</div>'
                        ).join('') +
                        '</div>';
                }
                
                lucide.createIcons();
            } catch (error) {
                console.error('Erreur vidéos:', error);
            }
        }

        async function downloadVideo(videoId) {
            try {
                const response = await fetch('/api/videos/' + videoId + '/download', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await response.json();

                if (data.success) {
                    alert('Téléchargement: ' + data.fileName);
                }
            } catch (error) {
                alert('Erreur téléchargement');
            }
        }

        function scheduleVideo(videoId) {
            const platforms = prompt('Plateformes (instagram,tiktok,youtube):', 'instagram,tiktok');
            const date = prompt('Date (YYYY-MM-DD HH:MM):', '2024-12-25 10:00');
            const caption = prompt('Légende:', 'Nouveau produit ! #ecommerce');

            if (platforms && date && caption) {
                scheduleVideoPost(videoId, platforms.split(','), date, caption);
            }
        }

        async function scheduleVideoPost(videoId, platforms, scheduledDate, caption) {
            try {
                const response = await fetch('/api/videos/' + videoId + '/schedule', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ platforms, scheduledDate, caption })
                });

                const data = await response.json();
                if (data.success) {
                    alert('✅ ' + data.message);
                }
            } catch (error) {
                alert('Erreur programmation');
            }
        }
    </script>
</body>
</html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Vidéo Auto running on port ' + PORT);
  console.log('💎 Free slots: ' + (database.settings.maxFreeUsers - database.settings.currentFreeUsers) + '/100');
  console.log('👥 Total users: ' + database.users.length);
});
