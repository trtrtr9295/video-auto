#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Installation automatique de Vidéo Auto...\n');

// Créer la structure des dossiers
const directories = [
  'routes',
  'middleware', 
  'utils',
  'views',
  'public',
  'config'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Dossier créé: ${dir}`);
  }
});

// Fichiers à créer avec leur contenu
const files = {
  'routes/auth.js': `const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const router = express.Router();

// Rate limiter pour les tentatives de connexion
const loginLimiter = new RateLimiterMemory({
  points: 5, // 5 tentatives
  duration: 900, // Par 15 minutes
});

const signupLimiter = new RateLimiterMemory({
  points: 3, // 3 inscriptions
  duration: 3600, // Par heure par IP
});

// Import des données (à remplacer par vraie DB)
let users = [];

// Fonction de sauvegarde
const saveData = async () => {
  const fs = require('fs').promises;
  try {
    const data = { users, projects: [], videos: [] };
    await fs.writeFile('data.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }
};

// Fonction de validation email
const isValidEmail = (email) => {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
};

// Fonction de validation mot de passe
const isValidPassword = (password) => {
  return password.length >= 6;
};

// Route d'inscription
router.post('/signup', async (req, res) => {
  try {
    // Rate limiting
    try {
      await signupLimiter.consume(req.ip);
    } catch (rejRes) {
      return res.status(429).json({ 
        error: 'Trop de tentatives d\\'inscription. Réessayez dans une heure.' 
      });
    }

    const { name, email, password, website } = req.body;

    // Validation des données
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Nom, email et mot de passe sont requis' 
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        error: 'Format d\\'email invalide' 
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ 
        error: 'Le mot de passe doit contenir au moins 6 caractères' 
      });
    }

    // Vérifier limite des 100 utilisateurs
    if (users.length >= 100) {
      return res.status(400).json({ 
        error: 'Limite de 100 utilisateurs gratuits atteinte! Le service devient payant.' 
      });
    }

    // Vérifier si l'email existe déjà
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Un compte avec cet email existe déjà' 
      });
    }

    // Hasher le mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const user = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      website: website ? website.trim() : '',
      createdAt: new Date().toISOString(),
      accountNumber: users.length + 1,
      isActive: true,
      lastLogin: new Date().toISOString(),
      projects: [],
      videos: [],
      settings: {
        notifications: true,
        autoPost: false,
        defaultStyle: 'moderne'
      }
    };

    users.push(user);
    await saveData();

    // Générer JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        accountNumber: user.accountNumber 
      },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '30d' }
    );

    // Log de succès
    console.log(\`✅ Nouvel utilisateur inscrit: \${user.email} (#\${user.accountNumber}/100)\`);

    res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\\'inscription' 
    });
  }
});

// Route de connexion
router.post('/login', async (req, res) => {
  try {
    // Rate limiting
    try {
      await loginLimiter.consume(req.ip);
    } catch (rejRes) {
      return res.status(429).json({ 
        error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' 
      });
    }

    const { email, password } = req.body;

    // Validation des données
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email et mot de passe requis' 
      });
    }

    // Chercher l'utilisateur
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Compte désactivé. Contactez le support.' 
      });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date().toISOString();
    await saveData();

    // Générer JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        accountNumber: user.accountNumber 
      },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '30d' }
    );

    // Log de succès
    console.log(\`✅ Connexion utilisateur: \${user.email} (#\${user.accountNumber})\`);

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber,
        lastLogin: user.lastLogin,
        settings: user.settings
      }
    });

  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la connexion' 
    });
  }
});

// Export des données pour les autres modules
router.setUsers = (usersArray) => {
  users = usersArray;
};

router.getUsers = () => users;

module.exports = router;`,

  'public/styles.css': `/* Variables CSS */
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --accent-color: #ff6b6b;
  --success-color: #27ae60;
  --warning-color: #f39c12;
  --danger-color: #e74c3c;
  --info-color: #3498db;
  
  --text-dark: #2c3e50;
  --text-light: #ecf0f1;
  --text-muted: #7f8c8d;
  
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;
  
  --border-color: #dee2e6;
  --border-radius: 8px;
  --border-radius-lg: 15px;
  
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
  --shadow-md: 0 5px 15px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 30px rgba(0,0,0,0.15);
  
  --transition: all 0.3s ease;
  --font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Reset et Base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  line-height: 1.6;
  color: var(--text-dark);
  background-color: var(--bg-secondary);
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 12px 24px;
  border: none;
  border-radius: var(--border-radius);
  font-size: 1rem;
  font-weight: 500;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: var(--transition);
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Layout */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: var(--text-light);
  padding: 80px 20px;
  text-align: center;
}

/* Cards */
.card {
  background: var(--bg-primary);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  transition: var(--transition);
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-lg);
}

/* Forms */
.form-control {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 1rem;
  transition: var(--transition);
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-color);
}

/* Modals */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
}

.modal.show {
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: var(--border-radius-lg);
  max-width: 500px;
  width: 90%;
  padding: 30px;
}

/* Responsive */
@media (max-width: 768px) {
  .hero {
    padding: 60px 15px;
  }
  
  .modal-content {
    margin: 20px;
    padding: 20px;
  }
}`,

  '.env.example': `# Configuration Serveur
NODE_ENV=production
PORT=3001

# Sécurité JWT
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production

# OpenAI pour génération de scripts IA (optionnel)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Configuration Base de Données (futur)
DATABASE_URL=postgresql://username:password@localhost:5432/video_auto

# URLs et Domaines
FRONTEND_URL=https://your-app.railway.app
API_BASE_URL=https://your-app.railway.app/api

# Limites et Quotas
MAX_FREE_USERS=100
MAX_VIDEOS_PER_USER=1000
MAX_PROJECTS_PER_USER=50`,

  'package.json': `{
  "name": "video-auto",
  "version": "2.1.0",
  "description": "Vidéo Auto - Génération automatique de vidéos IA pour e-commerce",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "echo 'Build completed successfully'",
    "setup": "node setup-files.js"
  },
  "keywords": [
    "video",
    "ai", 
    "automation",
    "e-commerce",
    "saas"
  ],
  "author": {
    "name": "Vidéo Auto Team"
  },
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cheerio": "^1.0.0-rc.12",
    "rate-limiter-flexible": "^4.0.1",
    "openai": "^4.20.1"
  }
}`
};

// Créer tous les fichiers
console.log('\\n📝 Création des fichiers...');

Object.entries(files).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  if (dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ ${filePath}`);
});

console.log('\\n🎉 Installation terminée !');
console.log('\\n🚀 Prochaines étapes:');
console.log('1. npm install');
console.log('2. Configurez vos variables d\\'environnement');
console.log('3. npm start');
console.log('\\n✨ Votre SaaS Vidéo Auto est prêt !');
