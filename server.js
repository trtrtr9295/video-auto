require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de base uniquement
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Base de données en mémoire
let users = [];
let projects = [];
let videos = [];

// ROUTE HEALTH CRITIQUE (doit marcher)
app.get('/api/health', (req, res) => {
  console.log('🏥 Healthcheck appelé');
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.1.0-EMERGENCY',
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// Route de test simple
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!', time: new Date().toISOString() });
});

// Route stats
app.get('/api/stats', (req, res) => {
  res.json({
    users: users.length,
    projects: projects.length,
    videos: videos.length,
    availableSlots: Math.max(0, 100 - users.length)
  });
});

// Inscription simple
app.post('/api/signup', async (req, res) => {
  try {
    console.log('📝 Tentative inscription:', req.body.email);
    
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

// Connexion simple
app.post('/api/login', async (req, res) => {
  try {
    console.log('🔐 Tentative connexion:', req.body.email);
    
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
            .highlight { background: #ff6b6b; padding: 15px 25px; border-radius: 25px; display: inline-block; margin: 20px 0; font-weight: bold; }
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
            }
            .features { padding: 80px 20px; background: #f8f9fa; }
            .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px; margin-top: 50px; }
            .feature { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; }
            .stats { background: #2c3e50; color: white; padding: 60px 20px; text-align: center; }
            .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-top: 30px; }
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
                max-width: 450px; 
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
                color: #999;
            }
            .close:hover { color: #333; }
            .status { background: #27ae60; color: white; padding: 10px 20px; border-radius: 20px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="hero">
            <div class="container">
                <h1>🎬 Vidéo Auto</h1>
                <p style="font-size: 1.3rem; margin-bottom: 30px;">L'IA qui transforme vos produits en vidéos virales</p>
                
                <div class="status">✅ Application Opérationnelle - Version d'Urgence</div>
                
                <div class="highlight">
                    ⚡ OFFRE LIMITÉE: Plus que ${remainingSlots}/100 comptes GRATUITS À VIE !
                </div>
                
                <button class="btn" onclick="openModal('signup')">RÉSERVER MA PLACE GRATUITE</button>
                <button class="btn" onclick="openModal('login')" style="background: transparent; border: 2px solid white;">Se connecter</button>
            </div>
        </div>

        <div class="features">
            <div class="container">
                <h2 style="text-align: center; font-size: 2.5rem; color: #333; margin-bottom: 50px;">
                    🚀 Fonctionnalités Disponibles
                </h2>
                
                <div class="feature-grid">
                    <div class="feature">
                        <h3>✅ Inscription</h3>
                        <p>Système d'inscription et authentification fonctionnel</p>
                    </div>
                    <div class="feature">
                        <h3>✅ Comptes Gratuits</h3>
                        <p>Limite de 100 utilisateurs gratuits à vie respectée</p>
                    </div>
                    <div class="feature">
                        <h3>✅ Sécurité</h3>
                        <p>Mots de passe hashés et tokens JWT sécurisés</p>
                    </div>
                    <div class="feature">
                        <h3>🔄 En Développement</h3>
                        <p>Scraping, génération IA et réseaux sociaux arrivent</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="stats">
            <div class="container">
                <h2>📊 Statistiques Temps Réel</h2>
                <div class="stat-grid">
                    <div class="stat">
                        <div class="stat-number">${users.length}</div>
                        <div>Utilisateurs</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${remainingSlots}</div>
                        <div>Places Restantes</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">100%</div>
                        <div>Opérationnel</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal Inscription -->
        <div id="signupModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeModal('signup')">&times;</span>
                <h2>🎉 Inscription Gratuite</h2>
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
                        <input type="url" id="signupWebsite" placeholder="Site web (optionnel)">
                    </div>
                    <button type="submit" class="btn" style="width: 100%;">CRÉER MON COMPTE</button>
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
                        window.location.reload();
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
                        window.location.reload();
                    } else {
                        alert('Erreur: ' + result.error);
                    }
                } catch (error) {
                    alert('Erreur: ' + error.message);
                }
            });

            console.log('✅ Application d\\'urgence chargée');
        </script>
    </body>
    </html>
  `);
});

// Route de test dashboard
app.get('/dashboard', (req, res) => {
  res.send(`
    <h1>🎉 Dashboard Fonctionnel!</h1>
    <p>L'application fonctionne correctement.</p>
    <a href="/">← Retour accueil</a>
    <br><br>
    <a href="/api/health">Tester l'API Health</a><br>
    <a href="/api/stats">Voir les Statistiques</a>
  `);
});

// Gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('💥 Erreur serveur:', err);
  res.status(500).json({ error: 'Erreur serveur', details: err.message });
});

// Route 404
app.use((req, res) => {
  console.log('🔍 Route non trouvée:', req.path);
  res.status(404).json({ error: 'Route non trouvée', path: req.path });
});

// Démarrage du serveur
const server = app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🚀 VIDÉO AUTO - VERSION D'URGENCE`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Healthcheck: /api/health`);
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
