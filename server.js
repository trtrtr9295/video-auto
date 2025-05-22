require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// Import des routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');

// Import des utils
const { scrapeWebsite } = require('./utils/scraper');
const { generateVideosForProduct } = require('./utils/videoGenerator');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de base
app.use(helmet({
  contentSecurityPolicy: false  // Désactive CSP pour permettre JavaScript inline
}));
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Base de données en mémoire (à remplacer par une vraie DB)
let users = [];
let projects = [];
let videos = [];

// Fonction de sauvegarde
const saveData = async () => {
  const fs = require('fs').promises;
  try {
    await fs.writeFile('data.json', JSON.stringify({ users, projects, videos }, null, 2));
  } catch (error) {
    console.log('Sauvegarde échouée:', error.message);
  }
};

// Fonction de chargement
const loadData = async () => {
  const fs = require('fs').promises;
  try {
    const data = await fs.readFile('data.json', 'utf8');
    const parsed = JSON.parse(data);
    users = parsed.users || [];
    projects = parsed.projects || [];
    videos = parsed.videos || [];
  } catch (error) {
    console.log('Chargement des données échoué, utilisation de données vides');
  }
};

// Partager les données avec les modules
const updateModulesData = () => {
  try {
    if (authRoutes.setUsers) authRoutes.setUsers(users);
    if (projectRoutes.setData) projectRoutes.setData(projects, users);
  } catch (error) {
    console.log('Erreur partage données:', error.message);
  }
};

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

// Route de santé (OBLIGATOIRE pour Railway)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    version: '2.1.0-LITE',
    timestamp: new Date().toISOString(),
    features: ['Authentication', 'Projects', 'Scraping', 'AI Generation'],
    users: users.length,
    projects: projects.length,
    videos: videos.length
  });
});

// Route statistiques
app.get('/api/stats', (req, res) => {
  res.json({
    totalUsers: users.length,
    availableSlots: Math.max(0, 100 - users.length),
    totalProjects: projects.length,
    totalVideos: videos.length,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Page d'accueil
app.get('/', (req, res) => {
  const remainingSlots = Math.max(0, 100 - users.length);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Vidéo Auto - IA Génération Vidéo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 80px 20px; text-align: center; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { font-size: 3rem; margin-bottom: 20px; }
            .highlight { background: #ff6b6b; padding: 10px 20px; border-radius: 25px; display: inline-block; margin: 20px 0; }
            .btn { 
                background: #ff6b6b; 
                color: white; 
                padding: 15px 30px; 
                border: none; 
                border-radius: 25px; 
                font-size: 1.1rem; 
                cursor: pointer; 
                text-decoration: none; 
                display: inline-block; 
                margin: 10px;
                transition: all 0.3s ease;
            }
            .btn:hover { 
                background: #ff5252; 
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(255,107,107,0.4);
            }
            .features { padding: 80px 20px; background: #f8f9fa; }
            .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin-top: 50px; }
            .feature { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; }
            .stats { background: #2c3e50; color: white; padding: 60px 20px; text-align: center; }
            .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px; margin-top: 40px; }
            .stat-number { font-size: 2.5rem; font-weight: bold; color: #3498db; }
            .modal { 
                display: none; 
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%; 
                background: rgba(0,0,0,0.8); 
                z-index: 1000;
            }
            .modal.show { display: flex; align-items: center; justify-content: center; }
            .modal-content { 
                background: white; 
                padding: 40px; 
                border-radius: 15px; 
                max-width: 500px; 
                width: 90%;
                position: relative;
            }
            .form-group { margin-bottom: 20px; }
            .form-group input { 
                width: 100%; 
                padding: 15px; 
                border: 2px solid #ddd; 
                border-radius: 8px; 
                font-size: 1rem;
            }
            .close { 
                position: absolute;
                top: 15px;
                right: 20px;
                font-size: 28px; 
                cursor: pointer;
            }
            @media (max-width: 768px) { 
                h1 { font-size: 2rem; } 
                .feature-grid { grid-template-columns: 1fr; } 
            }
        </style>
    </head>
    <body>
        <div class="hero">
            <div class="container">
                <h1>🎬 Vidéo Auto</h1>
                <p style="font-size: 1.3rem; margin-bottom: 30px;">L'IA qui transforme vos produits en vidéos virales</p>
                
                <div class="highlight">
                    ⚡ OFFRE LIMITÉE: Plus que ${remainingSlots}/100 comptes GRATUITS À VIE !
                </div>
                
                <button class="btn" id="signupBtn">RÉSERVER MA PLACE GRATUITE</button>
                <button class="btn" id="loginBtn" style="background: transparent; border: 2px solid white;">Se connecter</button>
            </div>
        </div>

        <div class="features">
            <div class="container">
                <h2 style="text-align: center; font-size: 2.5rem; color: #333; margin-bottom: 20px;">
                    🚀 IA de Nouvelle Génération
                </h2>
                
                <div class="feature-grid">
                    <div class="feature">
                        <h3>🤖 IA Avancée</h3>
                        <p>Notre IA analyse vos produits et génère automatiquement des scripts personnalisés</p>
                    </div>
                    <div class="feature">
                        <h3>🎨 4 Styles Uniques</h3>
                        <p>Moderne, Dynamique, Élégant, ou Ludique - Choisissez le style parfait</p>
                    </div>
                    <div class="feature">
                        <h3>📱 Multi-Réseaux</h3>
                        <p>Formats optimisés pour TikTok, Instagram Reels et YouTube Shorts</p>
                    </div>
                    <div class="feature">
                        <h3>⚡ 3 Versions par Produit</h3>
                        <p>L'IA génère 3 versions différentes pour maximiser vos chances</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="stats">
            <div class="container">
                <h2>📊 Résultats Prouvés</h2>
                <div class="stat-grid">
                    <div class="stat">
                        <div class="stat-number">${users.length}</div>
                        <div>Clients Satisfaits</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${projects.length}</div>
                        <div>Projets Créés</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${videos.length}</div>
                        <div>Vidéos Générées</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal Inscription -->
        <div id="signupModal" class="modal">
            <div class="modal-content">
                <span class="close" id="closeSignup">&times;</span>
                <h2>🎉 Réservez Votre Place Gratuite</h2>
                <form id="signupForm">
                    <div class="form-group">
                        <input type="text" id="signupName" placeholder="Nom complet" required>
                    </div>
                    <div class="form-group">
                        <input type="email" id="signupEmail" placeholder="Email" required>
                    </div>
                    <div class="form-group">
                        <input type="password" id="signupPassword" placeholder="Mot de passe" required>
                    </div>
                    <div class="form-group">
                        <input type="url" id="signupWebsite" placeholder="URL de votre site web (optionnel)">
                    </div>
                    <button type="submit" class="btn" style="width: 100%;">CRÉER MON COMPTE GRATUIT</button>
                </form>
            </div>
        </div>

        <!-- Modal Connexion -->
        <div id="loginModal" class="modal">
            <div class="modal-content">
                <span class="close" id="closeLogin">&times;</span>
                <h2>🔐 Connexion</h2>
                <form id="loginForm">
                    <div class="form-group">
                        <input type="email" id="loginEmail" placeholder="Email" required>
                    </div>
                    <div class="form-group">
                        <input type="password" id="loginPassword" placeholder="Mot de passe" required>
                    </div>
                    <button type="submit" class="btn" style="width: 100%;">SE CONNECTER</button>
                </form>
            </div>
        </div>

        <script>
            // Elements du DOM
            const signupModal = document.getElementById('signupModal');
            const loginModal = document.getElementById('loginModal');
            const signupBtn = document.getElementById('signupBtn');
            const loginBtn = document.getElementById('loginBtn');
            const closeSignup = document.getElementById('closeSignup');
            const closeLogin = document.getElementById('closeLogin');

            // Ouvrir modals
            if(signupBtn) {
                signupBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    signupModal.classList.add('show');
                });
            }

            if(loginBtn) {
                loginBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    loginModal.classList.add('show');
                });
            }

            // Fermer modals
            if(closeSignup) {
                closeSignup.addEventListener('click', function() {
                    signupModal.classList.remove('show');
                });
            }

            if(closeLogin) {
                closeLogin.addEventListener('click', function() {
                    loginModal.classList.remove('show');
                });
            }

            // Fermer en cliquant à l'extérieur
            window.addEventListener('click', function(event) {
                if (event.target === signupModal) {
                    signupModal.classList.remove('show');
                }
                if (event.target === loginModal) {
                    loginModal.classList.remove('show');
                }
            });

            // Formulaire d'inscription
            const signupForm = document.getElementById('signupForm');
            if(signupForm) {
                signupForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const userData = {
                        name: document.getElementById('signupName').value,
                        email: document.getElementById('signupEmail').value,
                        password: document.getElementById('signupPassword').value,
                        website: document.getElementById('signupWebsite').value
                    };

                    try {
                        const response = await fetch('/api/auth/signup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(userData)
                        });

                        const result = await response.json();
                        
                        if (response.ok) {
                            alert('🎉 Félicitations! Votre compte gratuit à vie a été créé! Vous êtes le client #' + result.user.accountNumber);
                            localStorage.setItem('token', result.token);
                            window.location.href = '/dashboard';
                        } else {
                            alert('Erreur: ' + result.error);
                        }
                    } catch (error) {
                        alert('Erreur de connexion: ' + error.message);
                    }
                });
            }

            // Formulaire de connexion
            const loginForm = document.getElementById('loginForm');
            if(loginForm) {
                loginForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const loginData = {
                        email: document.getElementById('loginEmail').value,
                        password: document.getElementById('loginPassword').value
                    };

                    try {
                        const response = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(loginData)
                        });

                        const result = await response.json();
                        
                        if (response.ok) {
                            localStorage.setItem('token', result.token);
                            window.location.href = '/dashboard';
                        } else {
                            alert('Erreur: ' + result.error);
                        }
                    } catch (error) {
                        alert('Erreur de connexion: ' + error.message);
                    }
                });
            }

            console.log('JavaScript chargé avec succès!');
        </script>
    </body>
    </html>
  `);
});

// Dashboard simple
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Dashboard - Vidéo Auto</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
            .welcome { background: white; border-radius: 15px; padding: 40px; text-align: center; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .btn { background: #3498db; color: white; padding: 15px 30px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; margin: 10px; cursor: pointer; }
            .btn:hover { background: #2980b9; }
            .btn-success { background: #27ae60; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎉 Bienvenue dans Vidéo Auto !</h1>
            <p>Votre compte gratuit à vie est activé</p>
        </div>

        <div class="container">
            <div class="welcome">
                <h2>🚀 Application Opérationnelle !</h2>
                <p style="margin: 20px 0; font-size: 1.2rem;">Toutes les fonctionnalités de base sont maintenant disponibles.</p>
                
                <div style="margin: 40px 0;">
                    <a href="/api/health" class="btn btn-success">🔍 Vérifier l'API</a>
                    <a href="/api/stats" class="btn">📊 Voir les Stats</a>
                    <a href="/" class="btn">🏠 Accueil</a>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 30px;">
                    <h3>🎯 Prochaines étapes :</h3>
                    <ol style="text-align: left; margin: 15px 0;">
                        <li>✅ Application fonctionnelle</li>
                        <li>✅ Système d'authentification</li>
                        <li>✅ Base pour projets et scraping</li>
                        <li>🔄 Interface de création de projets</li>
                        <li>🔄 Génération de vidéos</li>
                    </ol>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ 
    error: 'Erreur serveur interne',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Route 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// Chargement des données au démarrage
loadData().then(() => {
  updateModulesData();
  console.log(`📊 Données chargées: ${users.length} utilisateurs, ${projects.length} projets`);
});

// Sauvegarde périodique des données
setInterval(async () => {
  await saveData();
}, 5 * 60 * 1000); // Toutes les 5 minutes

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Vidéo Auto v2.1.0-LITE démarré sur le port ${PORT}`);
  console.log(`📊 ${users.length}/100 utilisateurs inscrits`);
  console.log(`🔧 Healthcheck disponible sur /api/health`);
  console.log(`✅ Application prête !`);
});
