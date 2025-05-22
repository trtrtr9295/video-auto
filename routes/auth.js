const express = require('express');
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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
        error: 'Trop de tentatives d\'inscription. Réessayez dans une heure.' 
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
        error: 'Format d\'email invalide' 
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
    console.log(`✅ Nouvel utilisateur inscrit: ${user.email} (#${user.accountNumber}/100)`);

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
      error: 'Erreur serveur lors de l\'inscription' 
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
    console.log(`✅ Connexion utilisateur: ${user.email} (#${user.accountNumber})`);

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

// Route de vérification du token
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret-key', (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }

    const user = users.find(u => u.id === decoded.userId);
    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber
      }
    });
  });
});

// Route de déconnexion (côté client principalement)
router.post('/logout', (req, res) => {
  // En JWT, la déconnexion se fait côté client en supprimant le token
  // Ici on peut logger l'événement
  console.log('🔓 Déconnexion utilisateur');
  res.json({ message: 'Déconnexion réussie' });
});

// Route de changement de mot de passe
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token requis' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
    const user = users.find(u => u.id === decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Mot de passe actuel et nouveau mot de passe requis' 
      });
    }

    // Vérifier le mot de passe actuel
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Mot de passe actuel incorrect' 
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ 
        error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' 
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    
    await saveData();

    console.log(`🔒 Mot de passe changé pour: ${user.email}`);

    res.json({ message: 'Mot de passe changé avec succès' });

  } catch (error) {
    console.error('❌ Erreur changement mot de passe:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors du changement de mot de passe' 
    });
  }
});

// Export des données pour les autres modules
router.setUsers = (usersArray) => {
  users = usersArray;
};

router.getUsers = () => users;

module.exports = router;
