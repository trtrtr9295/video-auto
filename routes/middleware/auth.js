const jwt = require('jsonwebtoken');
const fs = require('fs').promises;

// Cache pour éviter de relire le fichier à chaque requête
let usersCache = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 60000; // 1 minute

// Charger les utilisateurs depuis le fichier
const loadUsers = async () => {
  try {
    const now = Date.now();
    if (now - lastCacheUpdate < CACHE_DURATION && usersCache.length > 0) {
      return usersCache;
    }

    const data = await fs.readFile('data.json', 'utf8');
    const parsed = JSON.parse(data);
    usersCache = parsed.users || [];
    lastCacheUpdate = now;
    return usersCache;
  } catch (error) {
    console.error('Erreur chargement utilisateurs:', error);
    return [];
  }
};

// Middleware d'authentification principal
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Token d\'authentification requis',
        code: 'NO_TOKEN'
      });
    }

    // Vérifier le token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
    
    // Charger les utilisateurs
    const users = await loadUsers();
    const user = users.find(u => u.id === decoded.userId);

    if (!user) {
      return res.status(404).json({ 
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        error: 'Compte désactivé',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Ajouter les informations utilisateur à la requête
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      accountNumber: user.accountNumber,
      settings: user.settings || {},
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    // Ajouter le token décodé
    req.tokenData = decoded;

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        error: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Erreur middleware auth:', error);
    res.status(500).json({ 
      error: 'Erreur serveur d\'authentification',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware optionnel (n'échoue pas si pas de token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
    const users = await loadUsers();
    const user = users.find(u => u.id === decoded.userId);

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        accountNumber: user.accountNumber,
        settings: user.settings || {},
        isActive: user.isActive,
        createdAt: user.createdAt
      };
    } else {
      req.user = null;
    }

    next();

  } catch (error) {
    // En cas d'erreur, on continue sans utilisateur
    req.user = null;
    next();
  }
};

// Middleware pour vérifier les permissions admin (pour les 10 premiers utilisateurs)
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentification requise',
      code: 'AUTH_REQUIRED'
    });
  }

  // Les 10 premiers utilisateurs sont admins
  if (req.user.accountNumber > 10) {
    return res.status(403).json({ 
      error: 'Accès admin requis',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

// Middleware pour vérifier les limites de quota
const checkQuota = async (quotaType, limit = 100) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentification requise',
          code: 'AUTH_REQUIRED'
        });
      }

      // Charger les données utilisateur
      const users = await loadUsers();
      const user = users.find(u => u.id === req.user.id);

      if (!user) {
        return res.status(404).json({ 
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      // Vérifier les quotas selon le type
      let currentUsage = 0;
      
      switch (quotaType) {
        case 'projects':
          currentUsage = user.projects ? user.projects.length : 0;
          break;
        case 'videos':
          currentUsage = user.videos ? user.videos.length : 0;
          break;
        case 'api_calls':
          // Compteur de calls API par jour
          const today = new Date().toISOString().split('T')[0];
          currentUsage = user.apiCalls && user.apiCalls[today] ? user.apiCalls[today] : 0;
          break;
        default:
          currentUsage = 0;
      }

      // Limites spéciales pour les utilisateurs gratuits (premiers 100)
      let userLimit = limit;
      if (req.user.accountNumber <= 100) {
        // Utilisateurs gratuits ont des limites plus élevées
        switch (quotaType) {
          case 'projects':
            userLimit = 50;
            break;
          case 'videos':
            userLimit = 1000;
            break;
          case 'api_calls':
            userLimit = 500;
            break;
        }
      }

      if (currentUsage >= userLimit) {
        return res.status(429).json({ 
          error: `Limite de ${quotaType} atteinte (${currentUsage}/${userLimit})`,
          code: 'QUOTA_EXCEEDED',
          quota: {
            type: quotaType,
            current: currentUsage,
            limit: userLimit,
            remaining: Math.max(0, userLimit - currentUsage)
          }
        });
      }

      // Ajouter les infos de quota à la requête
      req.quota = {
        type: quotaType,
        current: currentUsage,
        limit: userLimit,
        remaining: userLimit - currentUsage
      };

      next();

    } catch (error) {
      console.error('Erreur vérification quota:', error);
      res.status(500).json({ 
        error: 'Erreur serveur de quota',
        code: 'QUOTA_ERROR'
      });
    }
  };
};

// Middleware pour logger les actions utilisateur
const logUserAction = (action) => {
  return (req, res, next) => {
    if (req.user) {
      console.log(`📊 [${new Date().toISOString()}] User #${req.user.accountNumber} (${req.user.email}): ${action}`);
    }
    next();
  };
};

// Middleware pour valider les données d'entrée
const validateInput = (schema) => {
  return (req, res, next) => {
    const errors = [];

    // Validation basique selon le schéma
    for (const field in schema) {
      const rules = schema[field];
      const value = req.body[field];

      if (rules.required && (!value || value.toString().trim() === '')) {
        errors.push(`Le champ ${field} est requis`);
        continue;
      }

      if (value && rules.type) {
        switch (rules.type) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              errors.push(`Le champ ${field} doit être un email valide`);
            }
            break;
          case 'url':
            try {
              new URL(value);
            } catch {
              errors.push(`Le champ ${field} doit être une URL valide`);
            }
            break;
          case 'string':
            if (typeof value !== 'string') {
              errors.push(`Le champ ${field} doit être une chaîne de caractères`);
            } else if (rules.minLength && value.length < rules.minLength) {
              errors.push(`Le champ ${field} doit contenir au moins ${rules.minLength} caractères`);
            } else if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`Le champ ${field} ne peut pas dépasser ${rules.maxLength} caractères`);
            }
            break;
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Données invalides',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    next();
  };
};

// Middleware pour gérer les erreurs async
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Export des middlewares
module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  checkQuota,
  logUserAction,
  validateInput,
  asyncHandler,
  loadUsers
};
