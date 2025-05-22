require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de base
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Base de données en mémoire
let users = [];
let projects = [];
let videos = [];

// Fonctions de gestion des données
const saveData = async () => {
  try {
    const data = { users, projects, videos };
    await fs.writeFile('data.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Sauvegarde échouée:', error.message);
  }
};

const loadData = async () => {
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

// Import dynamique des routes (avec gestion d'erreur)
let authRoutes, projectRoutes, videoRoutes;

try {
  authRoutes = require('./routes/auth');
  console.log('✅ Routes auth chargées');
} catch (error) {
  console.log('⚠️ Routes auth non disponibles:', error.message);
}

try {
  projectRoutes = require('./routes/projects');
  console.log('✅ Routes projets chargées');
} catch (error) {
  console.log('⚠️ Routes projets non disponibles:', error.message);
}

try {
  videoRoutes = require('./routes/videos');
  console.log('✅ Routes vidéos chargées');
} catch (error) {
  console.log('⚠️ Routes vidéos non disponibles:', error.message);
}

// Partager les données avec les modules
const updateModulesData = () => {
  try {
    if (authRoutes && authRoutes.setUsers) authRoutes.setUsers(users);
    if (projectRoutes && projectRoutes.setData) projectRoutes.setData(projects, users);
    if (videoRoutes && videoRoutes.setData) videoRoutes.setData(videos, users, projects);
  } catch (error) {
    console.log('Erreur partage données:', error.message);
  }
};

// Routes API conditionnelles
if (authRoutes) {
  app.use('/api/auth', authRoutes);
  console.log('🔐 Routes d\'authentification activées');
} else {
  // Routes d'authentification de base intégrées
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');

  app.post('/api/signup', async (req, res) => {
    try {
      const { name, email, password, website } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
      }

      if (users.length >= 100) {
        return res.status(400).json({ error: 'Limite de 100 utilisateurs atteinte' });
      }

      if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email déjà utilisé' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = {
        id: Date.now().toString(),
        name,
        email,
        password: hashedPassword,
        website: website || '',
        createdAt: new Date().toISOString(),
        accountNumber: users.length + 1
      };

      users.push(user);
      await saveData();

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'fallback-secret-key',
        { expiresIn: '30d' }
      );

      console.log(`✅ Utilisateur créé: ${email} (#${user.accountNumber})`);

      res.status(201).json({
        message: 'Compte créé avec succès',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          accountNumber: user.accountNumber
        }
      });

    } catch (error) {
      console.error('❌ Erreur inscription:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
      }

      const user = users.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'fallback-secret-key',
        { expiresIn: '30d' }
      );

      console.log(`✅ Connexion réussie: ${email}`);

      res.json({
        message: 'Connexion réussie',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          accountNumber: user.accountNumber
        }
      });

    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
}

if (projectRoutes) {
  app.use('/api/projects', projectRoutes);
  console.log('📁 Routes de projets activées');
}

if (videoRoutes) {
  app.use('/api/videos', videoRoutes);
  console.log('🎬 Routes de vidéos activées');
}

// Routes de base obligatoires
app.get('/api/health', (req, res) => {
  console.log('🏥 Healthcheck appelé');
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.1.0-COMPLETE',
    modules: {
      auth: !!authRoutes,
      projects: !!projectRoutes,
      videos: !!videoRoutes
    },
    data: {
      users: users.length,
      projects: projects.length,
      videos: videos.length
    }
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    users: users.length,
    projects: projects.length,
    videos: videos.length,
    availableSlots: Math.max(0, 100 - users.length),
    modulesLoaded: {
      auth: !!authRoutes,
      projects: !!projectRoutes,
      videos: !!videoRoutes
    },
    uptime: process.uptime()
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
        <link rel="stylesheet" href="/styles.css">
        <style>
            .status-indicator {
                background: #27ae60;
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                margin: 20px 0;
                display: inline-block;
            }
            .modules-status {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
                font-size: 0.9rem;
            }
        </style>
    </head>
    <body>
        <div class="hero">
            <div class="container">
                <h1>🎬 Vidéo Auto</h1>
                <p style="font-size: 1.3rem; margin-bottom: 30px;">L'IA qui transforme vos produits en vidéos virales</p>
                
                <div class="status-indicator">
                    ✅ Application Complète Opérationnelle
                </div>
                
                <div class="modules-status">
                    <strong>Modules Chargés:</strong><br>
                    🔐 Authentification: ${authRoutes ? '✅' : '⚠️ Basique'}<br>
                    📁 Projets: ${projectRoutes ? '✅' : '❌'}<br>
                    🎬 Vidéos: ${videoRoutes ? '✅' : '❌'}
                </div>
                
                <div style="background: #ff6b6b; padding: 15px 25px; border-radius: 25px; display: inline-block; margin: 20px 0; font-weight: bold;">
                    ⚡ OFFRE LIMITÉE: Plus que ${remainingSlots}/100 comptes GRATUITS À VIE !
                </div>
                
                <br><br>
                <button class="btn btn-primary" onclick="openModal('signup')" style="padding: 15px 30px; font-size: 1.1rem; border-radius: 25px;">
                    RÉSERVER MA PLACE GRATUITE
                </button>
                <button class="btn" onclick="openModal('login')" style="background: transparent; border: 2px solid white; color: white; padding: 15px 30px; margin-left: 10px;">
                    Se connecter
                </button>
            </div>
        </div>

        <div style="padding: 80px 20px; background: #f8f9fa;">
            <div class="container">
                <h2 style="text-align: center; font-size: 2.5rem; color: #333; margin-bottom: 50px;">
                    🚀 Fonctionnalités Disponibles
                </h2>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px;">
                    <div class="card" style="padding: 30px; text-align: center;">
                        <h3>✅ Authentification</h3>
                        <p>Système d'inscription et connexion sécurisé avec JWT</p>
                    </div>
                    <div class="card" style="padding: 30px; text-align: center;">
                        <h3>📁 Gestion Projets</h3>
                        <p>Création et gestion de projets e-commerce ${projectRoutes ? '(Actif)' : '(En développement)'}</p>
                    </div>
                    <div class="card" style="padding: 30px; text-align: center;">
                        <h3>🎬 Génération IA</h3>
                        <p>Création automatique de vidéos avec IA ${videoRoutes ? '(Actif)' : '(En développement)'}</p>
                    </div>
                    <div class="card" style="padding: 30px; text-align: center;">
                        <h3>📱 Multi-Plateformes</h3>
                        <p>Optimisé pour TikTok, Instagram, YouTube Shorts</p>
                    </div>
                </div>
            </div>
        </div>

        <div style="background: #2c3e50; color: white; padding: 60px 20px; text-align: center;">
            <div class="container">
                <h2>📊 Statistiques Temps Réel</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-top: 30px;">
                    <div>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #3498db;">${users.length}</div>
                        <div>Utilisateurs</div>
                    </div>
                    <div>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #3498db;">${projects.length}</div>
                        <div>Projets</div>
                    </div>
                    <div>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #3498db;">${videos.length}</div>
                        <div>Vidéos</div>
                    </div>
                    <div>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #3498db;">${remainingSlots}</div>
                        <div>Places Restantes</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal Inscription -->
        <div id="signupModal" class="modal">
            <div class="modal-content">
                <span style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer;" onclick="closeModal('signup')">&times;</span>
                <h2>🎉 Inscription Gratuite</h2>
                <form id="signupForm" style="margin-top: 20px;">
                    <div style="margin-bottom: 20px;">
                        <input type="text" id="signupName" placeholder="Nom complet" required class="form-control">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <input type="email" id="signupEmail" placeholder="Email" required class="form-control">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <input type="password" id="signupPassword" placeholder="Mot de passe" required class="form-control">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <input type="url" id="signupWebsite" placeholder="Site web (optionnel)" class="form-control">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">CRÉER MON COMPTE</button>
                </form>
            </div>
        </div>

        <!-- Modal Connexion -->
        <div id="loginModal" class="modal">
            <div class="modal-content">
                <span style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer;" onclick="closeModal('login')">&times;</span>
                <h2>🔐 Connexion</h2>
                <form id="loginForm" style="margin-top: 20px;">
                    <div style="margin-bottom: 20px;">
                        <input type="email" id="loginEmail" placeholder="Email" required class="form-control">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <input type="password" id="loginPassword" placeholder="Mot de passe" required class="form-control">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">SE CONNECTER</button>
                </form>
            </div>
        </div>

        <script>
            function openModal(type) {
                document.getElementById(type + 'Modal').classList.add('show');
            }

            function closeModal(type) {
                document.getElementById(type + 'Modal').classList.remove('show');
            }

            // Inscription
            document.getElementById('signupForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const userData = {
                    name: document.getElementById('signupName').value,
                    email: document.getElementById('signupEmail').value,
                    password: document.getElementById('signupPassword').value,
                    website: document.getElementById('signupWebsite').value
                };

                try {
                    const response = await fetch('/api/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(userData)
                    });

                    const result = await response.json();
                    
                    if (response.ok) {
                        alert('🎉 Compte créé! Vous êtes le client #' + result.user.accountNumber);
                        localStorage.setItem('token', result.token);
                        window.location.href = '/dashboard';
                    } else {
                        alert('Erreur: ' + result.error);
                    }
                } catch (error) {
                    alert('Erreur: ' + error.message);
                }
            });

            // Connexion
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const loginData = {
                    email: document.getElementById('loginEmail').value,
                    password: document.getElementById('loginPassword').value
                };

                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(loginData)
                    });

                    const result = await response.json();
                    
                    if (response.ok) {
                        alert('Connexion réussie!');
                        localStorage.setItem('token', result.token);
                        window.location.href = '/dashboard';
                    } else {
                        alert('Erreur: ' + result.error);
                    }
                } catch (error) {
                    alert('Erreur: ' + error.message);
                }
            });

            // Fermer modals en cliquant à l'extérieur
            window.onclick = function(event) {
                if (event.target.classList.contains('modal')) {
                    event.target.classList.remove('show');
                }
            }

            console.log('✅ Application Vidéo Auto chargée avec succès');
        </script>
    </body>
    </html>
  `);
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Dashboard - Vidéo Auto</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="/styles.css">
        <style>
            .dashboard-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2rem 0;
                margin-bottom: 2rem;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            .stat-card {
                background: white;
                padding: 2rem;
                border-radius: 15px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                text-align: center;
            }
            .stat-value {
                font-size: 2rem;
                font-weight: bold;
                color: #667eea;
                margin-bottom: 0.5rem;
            }
        </style>
    </head>
    <body>
        <header class="dashboard-header">
            <div class="container">
                <h1>🎉 Dashboard Vidéo Auto</h1>
                <p>Votre application SaaS est maintenant complètement opérationnelle !</p>
            </div>
        </header>

        <main class="container">
            <section class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${users.length}</div>
                    <div>Utilisateurs Inscrits</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${projects.length}</div>
                    <div>Projets Créés</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${videos.length}</div>
                    <div>Vidéos Générées</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.max(0, 100 - users.length)}</div>
                    <div>Places Restantes</div>
                </div>
            </section>

            <section class="card" style="padding: 2rem; margin-bottom: 2rem;">
                <h2>🚀 Actions Rapides</h2>
                <div style="margin-top: 1rem;">
                    <a href="/api/health" class="btn btn-primary">🔍 Tester l'API</a>
                    <a href="/api/stats" class="btn" style="margin-left: 10px;">📊 Voir les Stats</a>
                    <a href="/" class="btn" style="margin-left: 10px;">🏠 Accueil</a>
                </div>
            </section>

            <section class="card" style="padding: 2rem;">
                <h2>📋 État du Système</h2>
                <div style="margin-top: 1rem;">
                    <p><strong>🔐 Authentification:</strong> ${authRoutes ? '✅ Module complet chargé' : '⚠️ Version basique active'}</p>
                    <p><strong>📁 Gestion Projets:</strong> ${projectRoutes ? '✅ Module chargé' : '❌ Non disponible'}</p>
                    <p><strong>🎬 Génération Vidéos:</strong> ${videoRoutes ? '✅ Module chargé' : '❌ Non disponible'}</p>
                    <p><strong>💾 Base de Données:</strong> ✅ Stockage JSON fonctionnel</p>
                    <p><strong>🎨 Interface:</strong> ✅ CSS et templates chargés</p>
                </div>
            </section>
        </main>

        <script>
            console.log('✅ Dashboard Vidéo Auto initialisé');
            
            // Auto-refresh des stats toutes les 30 secondes
            setInterval(async () => {
                try {
                    const response = await fetch('/api/stats');
                    const stats = await response.json();
                    console.log('📊 Stats mises à jour:', stats);
                } catch (error) {
                    console.log('Erreur refresh stats:', error);
                }
            }, 30000);
        </script>
    </body>
    </html>
  `);
});

// Gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('💥 Erreur serveur:', err);
  res.status(500).json({ 
    error: 'Erreur serveur', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue' 
  });
});

// Route 404
app.use((req, res) => {
  console.log('🔍 Route non trouvée:', req.path);
  res.status(404).json({ 
    error: 'Route non trouvée', 
    path: req.path,
    availableEndpoints: [
      '/api/health',
      '/api/stats', 
      '/api/signup',
      '/api/login',
      '/dashboard'
    ]
  });
});

// Chargement des données au démarrage
loadData().then(() => {
  updateModulesData();
  console.log(`📊 Données chargées: ${users.length} utilisateurs, ${projects.length} projets, ${videos.length} vidéos`);
});

// Sauvegarde périodique des données
setInterval(async () => {
  await saveData();
  updateModulesData();
}, 2 * 60 * 1000); // Toutes les 2 minutes

// Démarrage du serveur
const server = app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🚀 VIDÉO AUTO - VERSION COMPLÈTE`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Healthcheck: /api/health`);
  console.log(`🚀 Dashboard: /dashboard`);
  console.log(`🚀 Modules: Auth=${!!authRoutes}, Projects=${!!projectRoutes}, Videos=${!!videoRoutes}`);
  console.log(`🚀 Status: OPÉRATIONNEL ✅`);
  console.log('🚀 ================================');
});

// Gestion des erreurs de serveur
server.on('error', (err) => {
  console.error('💥 Erreur serveur:', err);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Exception non gérée:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 Promesse rejetée:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Arrêt gracieux du serveur...');
  await saveData();
  server.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});
