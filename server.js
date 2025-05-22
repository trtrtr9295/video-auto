require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-key-here'
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"]
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Configuration multer pour upload
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Base de données en mémoire (à remplacer par une vraie DB en production)
let users = [];
let projects = [];
let videos = [];

// Fonctions utilitaires
const saveData = async () => {
  try {
    await fs.writeFile('data.json', JSON.stringify({ users, projects, videos }, null, 2));
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

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
};

// Génération de script IA avec OpenAI
const generateVideoScript = async (productName, productDescription, style) => {
  try {
    const stylePrompts = {
      moderne: "Créez un script moderne et épuré pour une vidéo de 15 secondes",
      dynamique: "Créez un script énergique et dynamique pour une vidéo de 15 secondes",
      elegant: "Créez un script élégant et sophistiqué pour une vidéo de 15 secondes",
      ludique: "Créez un script amusant et ludique pour une vidéo de 15 secondes"
    };

    const prompt = `${stylePrompts[style] || stylePrompts.moderne} présentant le produit "${productName}".
    Description: ${productDescription}
    
    Le script doit être:
    - Optimisé pour les réseaux sociaux (TikTok, Instagram Reels, YouTube Shorts)
    - Accrocheur dès les 3 premières secondes
    - Avec un call-to-action clair
    - Format: [Seconde 0-3] Action/Texte, [Seconde 4-8] Action/Texte, etc.
    
    Répondez uniquement avec le script structuré.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Erreur génération script:', error);
    return generateFallbackScript(productName, style);
  }
};

// Script de fallback si OpenAI échoue
const generateFallbackScript = (productName, style) => {
  const scripts = {
    moderne: `[0-3s] Zoom sur ${productName} - texte: "Découvrez l'innovation"
[4-8s] Présentation des caractéristiques principales
[9-12s] Démonstration d'utilisation
[13-15s] Call-to-action: "Commandez maintenant!"`,
    
    dynamique: `[0-3s] Transition rapide - texte: "${productName} c'est parti!"
[4-8s] Montage rythmé des fonctionnalités
[9-12s] Témoignage client éclair
[13-15s] "Obtenez le vôtre dès maintenant!"`,
    
    elegant: `[0-3s] Apparition douce - texte: "L'excellence à portée de main"
[4-8s] Présentation raffinée du produit
[9-12s] Mise en scène sophistiquée
[13-15s] "Découvrez notre collection"`,
    
    ludique: `[0-3s] Animation fun - texte: "Prêt pour du plaisir?"
[4-8s] Démonstration amusante
[9-12s] Moments de joie avec le produit
[13-15s] "Rejoignez l'aventure!"`
  };
  
  return scripts[style] || scripts.moderne;
};

// Simulation de génération vidéo (à remplacer par vraie génération)
const generateVideoWithAI = async (productData, script, style) => {
  // Simulation - en production, intégrer FFmpeg + images
  const videoId = Date.now().toString();
  const videoUrls = [];
  
  // Générer 3 versions
  for (let i = 1; i <= 3; i++) {
    videoUrls.push({
      id: `${videoId}_v${i}`,
      url: `https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4`,
      thumbnail: `https://picsum.photos/400/600?random=${videoId}_${i}`,
      style: style,
      version: i,
      duration: 15,
      format: "mp4",
      resolution: "1080x1920",
      script: script
    });
  }
  
  return videoUrls;
};

// Routes API

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
            .btn { background: #ff6b6b; color: white; padding: 15px 30px; border: none; border-radius: 25px; font-size: 1.1rem; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px; }
            .btn:hover { background: #ff5252; }
            .features { padding: 80px 20px; background: #f8f9fa; }
            .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin-top: 50px; }
            .feature { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; }
            .feature h3 { color: #333; margin-bottom: 15px; }
            .stats { background: #2c3e50; color: white; padding: 60px 20px; text-align: center; }
            .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px; margin-top: 40px; }
            .stat { padding: 20px; }
            .stat-number { font-size: 2.5rem; font-weight: bold; color: #3498db; }
            .countdown { background: #e74c3c; color: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
            .pricing { padding: 80px 20px; text-align: center; }
            .price-card { background: white; border: 3px solid #3498db; border-radius: 15px; padding: 40px; max-width: 400px; margin: 0 auto; }
            .price { font-size: 3rem; color: #3498db; font-weight: bold; }
            .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
            .modal-content { background: white; padding: 40px; border-radius: 15px; max-width: 500px; margin: 100px auto; }
            .form-group { margin-bottom: 20px; }
            .form-group input { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem; }
            .close { float: right; font-size: 28px; cursor: pointer; }
            @media (max-width: 768px) { h1 { font-size: 2rem; } .feature-grid { grid-template-columns: 1fr; } }
        </style>
    </head>
    <body>
        <div class="hero">
            <div class="container">
                <h1>🎬 Vidéo Auto</h1>
                <p style="font-size: 1.3rem; margin-bottom: 30px;">L'IA qui transforme vos produits en vidéos virales</p>
                
                <div class="countdown">
                    ⚡ OFFRE LIMITÉE: Plus que ${remainingSlots}/100 comptes GRATUITS À VIE !
                </div>
                
                <button class="btn" onclick="openModal('signup')">RÉSERVER MA PLACE GRATUITE</button>
                <a href="#" class="btn" onclick="openModal('login')" style="background: transparent; border: 2px solid white;">Se connecter</a>
            </div>
        </div>

        <div class="features">
            <div class="container">
                <h2 style="text-align: center; font-size: 2.5rem; color: #333; margin-bottom: 20px;">
                    🚀 IA de Nouvelle Génération
                </h2>
                <p style="text-align: center; font-size: 1.2rem; color: #666;">
                    Transformez automatiquement vos produits e-commerce en vidéos optimisées pour TikTok, Instagram et YouTube
                </p>
                
                <div class="feature-grid">
                    <div class="feature">
                        <h3>🤖 IA Avancée</h3>
                        <p>Notre IA analyse vos produits et génère automatiquement des scripts personnalisés avec OpenAI GPT-4</p>
                    </div>
                    <div class="feature">
                        <h3>🎨 4 Styles Uniques</h3>
                        <p>Moderne, Dynamique, Élégant, ou Ludique - Choisissez le style parfait pour votre marque</p>
                    </div>
                    <div class="feature">
                        <h3>📱 Multi-Réseaux</h3>
                        <p>Formats optimisés pour TikTok, Instagram Reels et YouTube Shorts - 1080x1920px parfait</p>
                    </div>
                    <div class="feature">
                        <h3>⚡ 3 Versions par Produit</h3>
                        <p>L'IA génère 3 versions différentes pour maximiser vos chances de viralité</p>
                    </div>
                    <div class="feature">
                        <h3>📅 Planification Auto</h3>
                        <p>Programmez et publiez automatiquement sur tous vos réseaux sociaux</p>
                    </div>
                    <div class="feature">
                        <h3>💾 Téléchargement HD</h3>
                        <p>Téléchargez vos vidéos en haute définition pour tous vos besoins marketing</p>
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
                    <div class="stat">
                        <div class="stat-number">4.9/5</div>
                        <div>Note Moyenne</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="pricing">
            <div class="container">
                <h2 style="margin-bottom: 40px;">💎 Offre Exceptionnelle</h2>
                <div class="price-card">
                    <h3>Plan Fondateur</h3>
                    <div class="price">GRATUIT</div>
                    <p style="text-decoration: line-through; color: #999; margin: 10px 0;">Valeur: 99€/mois</p>
                    <ul style="text-align: left; margin: 30px 0;">
                        <li>✅ Génération IA illimitée</li>
                        <li>✅ Tous les styles de vidéo</li>
                        <li>✅ 3 versions par produit</li>
                        <li>✅ Planification réseaux sociaux</li>
                        <li>✅ Support prioritaire</li>
                        <li>✅ Mises à jour à vie</li>
                    </ul>
                    <button class="btn" onclick="openModal('signup')">RÉSERVER MAINTENANT</button>
                    <p style="color: #e74c3c; margin-top: 15px; font-weight: bold;">
                        ⏰ Plus que ${remainingSlots} places disponibles !
                    </p>
                </div>
            </div>
        </div>

        <!-- Modal Inscription -->
        <div id="signupModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeModal('signup')">&times;</span>
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
                <span class="close" onclick="closeModal('login')">&times;</span>
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
            function openModal(type) {
                document.getElementById(type + 'Modal').style.display = 'block';
            }

            function closeModal(type) {
                document.getElementById(type + 'Modal').style.display = 'none';
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
                        alert('🎉 Félicitations! Votre compte gratuit à vie a été créé!');
                        localStorage.setItem('token', result.token);
                        window.location.href = '/dashboard';
                    } else {
                        alert('Erreur: ' + result.error);
                    }
                } catch (error) {
                    alert('Erreur de connexion: ' + error.message);
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
                        localStorage.setItem('token', result.token);
                        window.location.href = '/dashboard';
                    } else {
                        alert('Erreur: ' + result.error);
                    }
                } catch (error) {
                    alert('Erreur de connexion: ' + error.message);
                }
            });

            // Fermer modal en cliquant à l'extérieur
            window.onclick = function(event) {
                if (event.target.classList.contains('modal')) {
                    event.target.style.display = 'none';
                }
            }
        </script>
    </body>
    </html>
  `);
});

// API Inscription
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, website } = req.body;

    // Vérifier limite des 100 utilisateurs
    if (users.length >= 100) {
      return res.status(400).json({ error: 'Limite de 100 utilisateurs gratuits atteinte' });
    }

    // Vérifier si l'email existe déjà
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
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

    // Générer JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Compte créé avec succès',
      token,
      user: { id: user.id, name: user.name, email: user.email, accountNumber: user.accountNumber }
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
});

// API Connexion
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Email ou mot de passe incorrect' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: { id: user.id, name: user.name, email: user.email, accountNumber: user.accountNumber }
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
});

// Dashboard
app.get('/dashboard', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  const userProjects = projects.filter(p => p.userId === req.user.userId);
  const userVideos = videos.filter(v => v.userId === req.user.userId);

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
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; }
            .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
            .user-info { display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #ff6b6b; padding: 5px 15px; border-radius: 15px; font-size: 0.9rem; }
            .main { padding: 40px 20px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
            .stat-card { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center; }
            .stat-number { font-size: 2.5rem; font-weight: bold; color: #3498db; }
            .btn { background: #3498db; color: white; padding: 12px 24px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; cursor: pointer; }
            .btn-primary { background: #e74c3c; }
            .btn:hover { opacity: 0.9; }
            .section { background: white; border-radius: 15px; padding: 30px; margin-bottom: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
            .project-card { border: 2px solid #eee; border-radius: 10px; padding: 20px; }
            .project-card:hover { border-color: #3498db; }
            @media (max-width: 768px) { .stats { grid-template-columns: 1fr; } }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="container">
                <div class="user-info">
                    <div>
                        <h1>👋 Bonjour, ${user.name}</h1>
                        <div class="badge">Compte Gratuit à Vie #${user.accountNumber}/100</div>
                    </div>
                    <button class="btn" onclick="logout()">Déconnexion</button>
                </div>
            </div>
        </div>

        <div class="main">
            <div class="container">
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number">${userProjects.length}</div>
                        <div>Projets Créés</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${userVideos.length}</div>
                        <div>Vidéos Générées</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">∞</div>
                        <div>Génération Illimitée</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">4</div>
                        <div>Styles IA Disponibles</div>
                    </div>
                </div>

                <div class="section">
                    <h2 style="margin-bottom: 20px;">🚀 Actions Rapides</h2>
                    <a href="/create-project" class="btn btn-primary">Nouveau Projet</a>
                    <a href="/my-videos" class="btn">Mes Vidéos</a>
                    <a href="/analytics" class="btn">Analytics</a>
                </div>

                <div class="section">
                    <h2 style="margin-bottom: 20px;">📊 Mes Projets (${userProjects.length})</h2>
                    <div class="projects-grid">
                        ${userProjects.length === 0 ? `
                            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                                <p>Aucun projet créé pour le moment</p>
                                <a href="/create-project" class="btn" style="margin-top: 20px;">Créer votre premier projet</a>
                            </div>
                        ` : userProjects.map(project => `
                            <div class="project-card">
                                <h3>${project.name}</h3>
                                <p style="color: #666; margin: 10px 0;">${project.website}</p>
                                <p><strong>${project.products ? project.products.length : 0}</strong> produits détectés</p>
                                <div style="margin-top: 15px;">
                                    <a href="/project/${project.id}" class="btn">Voir Détails</a>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <script>
            function logout() {
                localStorage.removeItem('token');
                window.location.href = '/';
            }
        </script>
    </body>
    </html>
  `);
});

// Création de projet
app.get('/create-project', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Nouveau Projet - Vidéo Auto</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
            .section { background: white; border-radius: 15px; padding: 40px; margin-bottom: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .form-group { margin-bottom: 25px; }
            .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #333; }
            .form-group input, .form-group select { width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem; }
            .form-group input:focus, .form-group select:focus { border-color: #3498db; outline: none; }
            .btn { background: #3498db; color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 1.1rem; cursor: pointer; width: 100%; }
            .btn:hover { background: #2980b9; }
            .btn:disabled { background: #bdc3c7; cursor: not-allowed; }
            .loading { display: none; text-align: center; padding: 20px; }
            .back-btn { background: #95a5a6; margin-bottom: 20px; width: auto; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎬 Nouveau Projet Vidéo</h1>
            <p>Analysez votre site et générez des vidéos IA automatiquement</p>
        </div>

        <div class="container">
            <button class="btn back-btn" onclick="window.location.href='/dashboard'">← Retour au Dashboard</button>
            
            <div class="section">
                <h2 style="margin-bottom: 30px;">📝 Informations du Projet</h2>
                <form id="projectForm">
                    <div class="form-group">
                        <label for="projectName">Nom du Projet</label>
                        <input type="text" id="projectName" placeholder="Ex: Boutique Mode Automne 2024" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="website">URL du Site Web</label>
                        <input type="url" id="website" placeholder="https://votre-boutique.com" required>
                        <small style="color: #666; margin-top: 5px; display: block;">Notre IA va analyser automatiquement vos produits</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="category">Catégorie</label>
                        <select id="category" required>
                            <option value="">Sélectionnez une catégorie</option>
                            <option value="fashion">Mode & Vêtements</option>
                            <option value="electronics">Électronique</option>
                            <option value="beauty">Beauté & Cosmétiques</option>
                            <option value="home">Maison & Décoration</option>
                            <option value="sports">Sport & Loisirs</option>
                            <option value="food">Alimentation</option>
                            <option value="other">Autre</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn" id="submitBtn">🚀 Analyser le Site & Créer le Projet</button>
                </form>
                
                <div class="loading" id="loading">
                    <h3>🔍 Analyse en cours...</h3>
                    <p>Notre IA analyse votre site web et détecte automatiquement vos produits</p>
                    <div style="margin: 20px 0;">⏳ Cela peut prendre 30-60 secondes</div>
                </div>
            </div>
        </div>

        <script>
            document.getElementById('projectForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const projectData = {
                    name: document.getElementById('projectName').value,
                    website: document.getElementById('website').value,
                    category: document.getElementById('category').value
                };

                document.getElementById('submitBtn').disabled = true;
                document.getElementById('loading').style.display = 'block';

                try {
                    const response = await fetch('/api/create-project', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + localStorage.getItem('token')
                        },
                        body: JSON.stringify(projectData)
                    });

                    const result = await response.json();
                    
                    if (response.ok) {
                        window.location.href = '/project/' + result.project.id;
                    } else {
                        alert('Erreur: ' + result.error);
                        document.getElementById('submitBtn').disabled = false;
                        document.getElementById('loading').style.display = 'none';
                    }
                } catch (error) {
                    alert('Erreur de connexion: ' + error.message);
                    document.getElementById('submitBtn').disabled = false;
                    document.getElementById('loading').style.display = 'none';
                }
            });
        </script>
    </body>
    </html>
  `);
});

// API Création de projet
app.post('/api/create-project', authenticateToken, async (req, res) => {
  try {
    const { name, website, category } = req.body;

    // Simulation d'analyse de site web (remplacer par vraie analyse)
    const mockProducts = [
      {
        id: '1',
        name: 'Smartphone Pro Max',
        description: 'Le dernier smartphone avec caméra IA avancée',
        price: 899,
        image: 'https://picsum.photos/400/400?random=1',
        category: 'electronics'
      },
      {
        id: '2', 
        name: 'Casque Audio Premium',
        description: 'Casque sans fil avec réduction de bruit active',
        price: 249,
        image: 'https://picsum.photos/400/400?random=2',
        category: 'electronics'
      },
      {
        id: '3',
        name: 'Montre Connectée Sport',
        description: 'Montre intelligente pour le fitness et la santé',
        price: 199,
        image: 'https://picsum.photos/400/400?random=3',
        category: 'electronics'
      }
    ];

    const project = {
      id: Date.now().toString(),
      userId: req.user.userId,
      name,
      website,
      category,
      products: mockProducts,
      createdAt: new Date().toISOString(),
      status: 'analysé'
    };

    projects.push(project);
    await saveData();

    res.json({
      message: 'Projet créé avec succès',
      project
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
});

// Page projet individuel
app.get('/project/:id', authenticateToken, (req, res) => {
  const project = projects.find(p => p.id === req.params.id && p.userId === req.user.userId);
  
  if (!project) {
    return res.status(404).send('Projet non trouvé');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${project.name} - Vidéo Auto</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; }
            .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
            .project-info { display: flex; justify-content: space-between; align-items: center; }
            .main { padding: 40px 20px; }
            .section { background: white; border-radius: 15px; padding: 30px; margin-bottom: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
            .product-card { border: 2px solid #eee; border-radius: 10px; padding: 20px; text-align: center; }
            .product-card.selected { border-color: #3498db; background: #f8f9ff; }
            .product-image { width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px; }
            .btn { background: #3498db; color: white; padding: 12px 24px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; cursor: pointer; margin: 5px; }
            .btn:hover { background: #2980b9; }
            .btn-success { background: #27ae60; }
            .btn-warning { background: #f39c12; }
            .style-selector { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .style-option { border: 2px solid #ddd; border-radius: 10px; padding: 20px; text-align: center; cursor: pointer; }
            .style-option.selected { border-color: #3498db; background: #f8f9ff; }
            .back-btn { background: #95a5a6; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="container">
                <div class="project-info">
                    <div>
                        <h1>📁 ${project.name}</h1>
                        <p>${project.website} • ${project.products.length} produits détectés</p>
                    </div>
                    <span style="background: #27ae60; padding: 8px 16px; border-radius: 15px;">✅ ${project.status}</span>
                </div>
            </div>
        </div>

        <div class="main">
            <div class="container">
                <button class="btn back-btn" onclick="window.location.href='/dashboard'">← Retour au Dashboard</button>
                
                <div class="section">
                    <h2 style="margin-bottom: 20px;">🛍️ Sélectionnez les Produits pour Génération Vidéo</h2>
                    <div class="products-grid">
                        ${project.products.map(product => `
                            <div class="product-card" data-product-id="${product.id}" onclick="toggleProduct('${product.id}')">
                                <img src="${product.image}" alt="${product.name}" class="product-image">
                                <h3>${product.name}</h3>
                                <p style="color: #666; margin: 10px 0;">${product.description}</p>
                                <p style="font-size: 1.2rem; font-weight: bold; color: #27ae60;">${product.price}€</p>
                                <div style="margin-top: 15px;">
                                    <span class="selection-status">Cliquez pour sélectionner</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="section">
                    <h2 style="margin-bottom: 20px;">🎨 Choisissez le Style de Vidéo</h2>
                    <div class="style-selector">
                        <div class="style-option" data-style="moderne" onclick="selectStyle('moderne')">
                            <h3>🔥 Moderne</h3>
                            <p>Design épuré, transitions fluides, esthétique minimaliste</p>
                        </div>
                        <div class="style-option" data-style="dynamique" onclick="selectStyle('dynamique')">
                            <h3>⚡ Dynamique</h3>
                            <p>Rythme rapide, effets énergiques, parfait pour TikTok</p>
                        </div>
                        <div class="style-option" data-style="elegant" onclick="selectStyle('elegant')">
                            <h3>✨ Élégant</h3>
                            <p>Sophistiqué, luxueux, idéal pour produits premium</p>
                        </div>
                        <div class="style-option" data-style="ludique" onclick="selectStyle('ludique')">
                            <h3>🎮 Ludique</h3>
                            <p>Fun, coloré, parfait pour jeune audience</p>
                        </div>
                    </div>
                </div>

                <div class="section" style="text-align: center;">
                    <button class="btn btn-success" onclick="generateVideos()" id="generateBtn" disabled>
                        🎬 Générer les Vidéos IA (3 versions par produit)
                    </button>
                    <p style="margin-top: 15px; color: #666;">
                        Sélectionnez au moins 1 produit et 1 style pour commencer la génération
                    </p>
                </div>
            </div>
        </div>

        <script>
            let selectedProducts = [];
            let selectedStyle = null;

            function toggleProduct(productId) {
                const card = document.querySelector('[data-product-id="' + productId + '"]');
                const status = card.querySelector('.selection-status');
                
                if (selectedProducts.includes(productId)) {
                    selectedProducts = selectedProducts.filter(id => id !== productId);
                    card.classList.remove('selected');
                    status.textContent = 'Cliquez pour sélectionner';
                } else {
                    selectedProducts.push(productId);
                    card.classList.add('selected');
                    status.textContent = '✅ Sélectionné';
                }
                
                updateGenerateButton();
            }

            function selectStyle(style) {
                // Désélectionner tous
                document.querySelectorAll('.style-option').forEach(el => el.classList.remove('selected'));
                
                // Sélectionner le nouveau
                document.querySelector('[data-style="' + style + '"]').classList.add('selected');
                selectedStyle = style;
                
                updateGenerateButton();
            }

            function updateGenerateButton() {
                const btn = document.getElementById('generateBtn');
                if (selectedProducts.length > 0 && selectedStyle) {
                    btn.disabled = false;
                    btn.textContent = '🎬 Générer ' + (selectedProducts.length * 3) + ' Vidéos IA (' + selectedProducts.length + ' produits × 3 versions)';
                } else {
                    btn.disabled = true;
                    btn.textContent = '🎬 Générer les Vidéos IA (3 versions par produit)';
                }
            }

            async function generateVideos() {
                if (selectedProducts.length === 0 || !selectedStyle) {
                    alert('Veuillez sélectionner au moins 1 produit et 1 style');
                    return;
                }

                const btn = document.getElementById('generateBtn');
                btn.disabled = true;
                btn.textContent = '🤖 Génération IA en cours...';

                try {
                    const response = await fetch('/api/generate-videos', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + localStorage.getItem('token')
                        },
                        body: JSON.stringify({
                            projectId: '${project.id}',
                            productIds: selectedProducts,
                            style: selectedStyle
                        })
                    });

                    const result = await response.json();
                    
                    if (response.ok) {
                        alert('🎉 ' + result.videos.length + ' vidéos générées avec succès!');
                        window.location.href = '/my-videos';
                    } else {
                        alert('Erreur: ' + result.error);
                    }
                } catch (error) {
                    alert('Erreur: ' + error.message);
                } finally {
                    btn.disabled = false;
                    updateGenerateButton();
                }
            }
        </script>
    </body>
    </html>
  `);
});

// API Génération de vidéos
app.post('/api/generate-videos', authenticateToken, async (req, res) => {
  try {
    const { projectId, productIds, style } = req.body;

    const project = projects.find(p => p.id === projectId && p.userId === req.user.userId);
    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const selectedProducts = project.products.filter(p => productIds.includes(p.id));
    const generatedVideos = [];

    // Générer vidéos pour chaque produit
    for (const product of selectedProducts) {
      // Générer script avec IA
      const script = await generateVideoScript(product.name, product.description, style);
      
      // Générer 3 versions de vidéo
      const videoVersions = await generateVideoWithAI(product, script, style);
      
      // Enregistrer les vidéos
      for (const video of videoVersions) {
        const videoRecord = {
          ...video,
          userId: req.user.userId,
          projectId,
          productId: product.id,
          productName: product.name,
          createdAt: new Date().toISOString(),
          status: 'generated'
        };
        
        videos.push(videoRecord);
        generatedVideos.push(videoRecord);
      }
    }

    await saveData();

    res.json({
      message: `${generatedVideos.length} vidéos générées avec succès`,
      videos: generatedVideos
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur génération: ' + error.message });
  }
});

// Page mes vidéos
app.get('/my-videos', authenticateToken, (req, res) => {
  const userVideos = videos.filter(v => v.userId === req.user.userId);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Mes Vidéos - Vidéo Auto</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
            .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
            .section { background: white; border-radius: 15px; padding: 30px; margin-bottom: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .videos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
            .video-card { border: 2px solid #eee; border-radius: 10px; padding: 20px; }
            .video-thumbnail { width: 100%; height: 200px; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; margin-bottom: 15px; }
            .btn { background: #3498db; color: white; padding: 8px 16px; border: none; border-radius: 6px; text-decoration: none; display: inline-block; cursor: pointer; margin: 3px; }
            .btn:hover { background: #2980b9; }
            .btn-success { background: #27ae60; }
            .btn-warning { background: #f39c12; }
            .btn-info { background: #17a2b8; }
            .back-btn { background: #95a5a6; margin-bottom: 20px; }
            .style-badge { padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; color: white; }
            .style-moderne { background: #3498db; }
            .style-dynamique { background: #e74c3c; }
            .style-elegant { background: #9b59b6; }
            .style-ludique { background: #f39c12; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎬 Mes Vidéos Générées</h1>
            <p>${userVideos.length} vidéos créées par IA</p>
        </div>

        <div class="container">
            <button class="btn back-btn" onclick="window.location.href='/dashboard'">← Retour au Dashboard</button>
            
            <div class="section">
                <h2 style="margin-bottom: 30px;">📹 Vos Vidéos (${userVideos.length})</h2>
                
                ${userVideos.length === 0 ? `
                    <div style="text-align: center; padding: 60px 20px; color: #666;">
                        <h3>Aucune vidéo générée pour le moment</h3>
                        <p style="margin: 20px 0;">Créez votre premier projet pour commencer à générer des vidéos IA</p>
                        <a href="/create-project" class="btn btn-success">Créer un Projet</a>
                    </div>
                ` : `
                    <div class="videos-grid">
                        ${userVideos.map(video => `
                            <div class="video-card">
                                <div class="video-thumbnail">
                                    🎥 ${video.productName}
                                </div>
                                <h3>${video.productName}</h3>
                                <p style="color: #666; margin: 10px 0;">Version ${video.version} • ${video.duration}s</p>
                                <span class="style-badge style-${video.style}">${video.style}</span>
                                <div style="margin-top: 15px;">
                                    <a href="${video.url}" class="btn btn-success" target="_blank">▶️ Regarder</a>
                                    <a href="${video.url}" class="btn btn-info" download>📥 Télécharger</a>
                                    <button class="btn btn-warning" onclick="scheduleVideo('${video.id}')">📅 Programmer</button>
                                </div>
                                <div style="margin-top: 10px; font-size: 0.9rem; color: #666;">
                                    Créée le ${new Date(video.createdAt).toLocaleDateString('fr-FR')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        </div>

        <script>
            function scheduleVideo(videoId) {
                // Modal de programmation (à développer)
                alert('🚀 Fonctionnalité bientôt disponible!\\n\\nVous pourrez programmer vos vidéos sur:\\n• Instagram\\n• TikTok\\n• YouTube Shorts');
            }
        </script>
    </body>
    </html>
  `);
});

// Routes API additionnelles
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    version: '2.0.0-AI',
    features: ['OpenAI Integration', 'Video Generation', 'Multi-Style', 'User Accounts'],
    users: users.length,
    projects: projects.length,
    videos: videos.length
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    totalUsers: users.length,
    availableSlots: Math.max(0, 100 - users.length),
    totalProjects: projects.length,
    totalVideos: videos.length,
    styles: ['moderne', 'dynamique', 'elegant', 'ludique']
  });
});

// Chargement des données au démarrage
loadData();

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Vidéo Auto avec IA démarré sur le port ${PORT}`);
  console.log(`📊 ${users.length}/100 utilisateurs inscrits`);
  console.log(`🎬 ${videos.length} vidéos générées`);
});
