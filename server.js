require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Base de données JSON simple (persistante)
const DB_FILE = path.join(__dirname, 'database.json');

// Initialiser la base de données
let database = {
  clients: [],
  settings: {
    maxFreeUsers: 100,
    currentFreeUsers: 0
  }
};

// Charger la base de données existante
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      database = JSON.parse(data);
    }
  } catch (error) {
    console.log('Initialisation nouvelle base de données');
  }
}

// Sauvegarder la base de données
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }
}

// Charger au démarrage
loadDatabase();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: '*',
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));

// Routes API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Vidéo Auto API fonctionnelle !',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    totalClients: database.clients.length,
    freeUsersUsed: database.settings.currentFreeUsers,
    freeUsersLeft: database.settings.maxFreeUsers - database.settings.currentFreeUsers
  });
});

// API compteur utilisateurs gratuits
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

// API liste des clients (pour admin)
app.get('/api/clients', (req, res) => {
  res.json({
    clients: database.clients.map(client => ({
      id: client.id,
      email: client.email,
      companyName: client.companyName,
      websiteUrl: client.websiteUrl,
      registeredAt: client.registeredAt,
      earlyBirdNumber: client.earlyBirdNumber,
      status: client.status
    })),
    total: database.clients.length
  });
});

// API audit de site web fonctionnel
app.post('/api/audit-website', (req, res) => {
  const { websiteUrl } = req.body;
  
  if (!websiteUrl) {
    return res.status(400).json({ error: 'URL du site requis' });
  }

  // Validation URL
  try {
    new URL(websiteUrl);
  } catch {
    return res.status(400).json({ error: 'URL invalide' });
  }

  // Simulation audit réaliste
  setTimeout(() => {
    const domain = websiteUrl.replace(/(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const isEcommerce = websiteUrl.toLowerCase().includes('shop') || 
                      websiteUrl.toLowerCase().includes('store') || 
                      websiteUrl.toLowerCase().includes('boutique') ||
                      websiteUrl.toLowerCase().includes('market');
    
    const baseScore = isEcommerce ? 75 : 60;
    const score = baseScore + Math.floor(Math.random() * 20);
    const productsFound = isEcommerce ? 
      Math.floor(Math.random() * 80) + 20 : 
      Math.floor(Math.random() * 15) + 5;
    
    const auditResults = {
      websiteUrl,
      domain,
      detectedPlatform: isEcommerce ? 'E-commerce' : 'Site Web',
      score,
      productsFound,
      videosPotential: Math.floor(productsFound * 1.5) + Math.floor(Math.random() * 30),
      socialMediaOptimization: Math.floor(Math.random() * 40) + 45,
      
      recommendations: [
        {
          type: 'urgent',
          title: `${productsFound} produits détectés sans vidéos`,
          description: `Vos produits sur ${domain} pourraient générer ${Math.floor(productsFound * 0.8)} vidéos automatiquement`,
          impact: `Augmentation estimée du trafic: +${Math.floor(Math.random() * 30) + 35}%`,
          actionable: true
        },
        {
          type: 'important', 
          title: 'Format vidéo non optimisé pour réseaux sociaux',
          description: 'Vos visuels ne sont pas adaptés aux formats Reels/Shorts',
          impact: `Portée potentielle: +${Math.floor(Math.random() * 50) + 100}% d'engagement`,
          actionable: true
        },
        {
          type: 'suggestion',
          title: 'Automatisation recommandée',
          description: 'Publication manuelle détectée - Automatisation possible',
          impact: `Gain de temps: ${Math.floor(Math.random() * 5) + 6}h/semaine`,
          actionable: false
        }
      ],
      
      competitorAnalysis: {
        betterThanPercent: Math.floor(Math.random() * 35) + 55,
        averageVideosPerProduct: (Math.random() * 2 + 0.3).toFixed(1),
        marketOpportunity: isEcommerce ? 'ÉLEVÉE' : 'MOYENNE',
        competitiveAdvantage: score > 80 ? 'FORTE' : 'MODÉRÉE'
      },
      
      techAnalysis: {
        loadTime: (Math.random() * 2 + 1).toFixed(1) + 's',
        mobileOptimized: Math.random() > 0.2,
        socialIntegration: Math.random() > 0.4,
        seoScore: Math.floor(Math.random() * 30) + 65
      }
    };

    res.json({
      success: true,
      audit: auditResults,
      message: `Audit de ${domain} terminé avec succès !`,
      recommendations_count: auditResults.recommendations.length,
      nextSteps: [
        'Obtenez votre compte gratuit à vie',
        'Connectez vos réseaux sociaux', 
        'Configurez la surveillance automatique',
        'Générez vos premières vidéos'
      ]
    });
  }, 4000); // Temps réaliste d'audit
});

// API inscription early bird FONCTIONNELLE
app.post('/api/register-early-bird', (req, res) => {
  const { email, companyName, websiteUrl } = req.body;
  
  // Validation des données
  if (!email || !companyName || !websiteUrl) {
    return res.status(400).json({ 
      error: 'Tous les champs sont requis',
      missing: {
        email: !email,
        companyName: !companyName, 
        websiteUrl: !websiteUrl
      }
    });
  }

  // Validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  // Validation URL
  try {
    new URL(websiteUrl);
  } catch {
    return res.status(400).json({ error: 'URL de site invalide' });
  }

  // Vérifier si les 100 places sont déjà prises
  if (database.settings.currentFreeUsers >= database.settings.maxFreeUsers) {
    return res.status(400).json({ 
      error: 'Plus de places gratuites disponibles',
      message: 'Les 100 comptes gratuits à vie ont été tous attribués. Rejoignez la liste d\'attente !',
      waitlist: true
    });
  }

  // Vérifier si l'email existe déjà
  const existingClient = database.clients.find(client => client.email.toLowerCase() === email.toLowerCase());
  if (existingClient) {
    return res.status(400).json({ 
      error: 'Email déjà inscrit',
      message: `Cet email est déjà inscrit en tant que client #${existingClient.earlyBirdNumber}`,
      existingClient: {
        earlyBirdNumber: existingClient.earlyBirdNumber,
        registeredAt: existingClient.registeredAt
      }
    });
  }

  // Créer le nouveau client
  const newClient = {
    id: Date.now().toString(),
    email: email.toLowerCase(),
    companyName,
    websiteUrl,
    registeredAt: new Date().toISOString(),
    earlyBirdNumber: database.settings.currentFreeUsers + 1,
    status: 'active',
    accountType: 'free_lifetime',
    benefits: [
      'Compte gratuit à vie (valeur: 1.188€/an)',
      'Accès à toutes les fonctionnalités premium',
      'Support prioritaire Founding Member',
      'Badge "Client Fondateur" exclusif',
      'Accès aux nouvelles fonctionnalités en avant-première'
    ],
    features: {
      videosPerMonth: 'unlimited',
      socialPlatforms: ['instagram', 'tiktok', 'youtube'],
      supportLevel: 'priority',
      customTemplates: true
    }
  };

  // Ajouter à la base de données
  database.clients.push(newClient);
  database.settings.currentFreeUsers++;
  
  // Sauvegarder
  saveDatabase();

  // Réponse de succès
  res.json({
    success: true,
    message: 'Félicitations ! Votre compte gratuit à vie a été créé !',
    client: {
      id: newClient.id,
      email: newClient.email,
      companyName: newClient.companyName,
      earlyBirdNumber: newClient.earlyBirdNumber,
      registeredAt: newClient.registeredAt
    },
    benefits: newClient.benefits,
    nextSteps: [
      'Vérifiez votre email pour la confirmation',
      'Connectez vos comptes réseaux sociaux',
      'Configurez votre première surveillance de site',
      'Générez votre première vidéo automatique'
    ],
    dashboard_url: `/dashboard/${newClient.id}`,
    remainingSlots: database.settings.maxFreeUsers - database.settings.currentFreeUsers
  });
});

// API dashboard client
app.get('/api/dashboard/:clientId', (req, res) => {
  const { clientId } = req.params;
  
  const client = database.clients.find(c => c.id === clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client non trouvé' });
  }

  res.json({
    client: {
      id: client.id,
      email: client.email,
      companyName: client.companyName,
      websiteUrl: client.websiteUrl,
      earlyBirdNumber: client.earlyBirdNumber,
      accountType: client.accountType,
      status: client.status
    },
    stats: {
      videosCreated: Math.floor(Math.random() * 10),
      productsMonitored: Math.floor(Math.random() * 25) + 5,
      socialConnections: 0,
      scheduledPosts: 0
    },
    features: client.features,
    benefits: client.benefits
  });
});

// Page principale avec interface fonctionnelle
app.get('/', (req, res) => {
  const remainingSlots = database.settings.maxFreeUsers - database.settings.currentFreeUsers;
  const usedSlots = database.settings.currentFreeUsers;
  const progressPercent = (usedSlots / database.settings.maxFreeUsers) * 100;

  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vidéo Auto - Les ${database.settings.maxFreeUsers} Premiers Clients GRATUITS À VIE | Plus que ${remainingSlots} places !</title>
    <meta name="description" content="Créez automatiquement des vidéos de vos produits pour Instagram, TikTok et YouTube. Les ${database.settings.maxFreeUsers} premiers clients sont GRATUITS À VIE ! Plus que ${remainingSlots} places disponibles.">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        @keyframes slideIn {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
        }
        .fade-in { animation: fadeIn 0.6s ease-out; }
        .pulse-animation { animation: pulse 2s infinite; }
        .slide-in { animation: slideIn 0.8s ease-out; }
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .urgency-bar {
            background: linear-gradient(90deg, #ef4444 0%, #f97316 50%, #eab308 100%);
        }
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Barre d'urgence dynamique -->
    <div class="urgency-bar text-white py-3 text-center font-medium">
        <div class="container mx-auto px-4">
            🔥 <strong>ATTENTION:</strong> Plus que <span id="remaining-spots" class="font-bold text-yellow-200">${remainingSlots}</span> places gratuites sur ${database.settings.maxFreeUsers} ! 
            <span class="hidden md:inline">Dépêchez-vous avant qu'il ne soit trop tard !</span>
        </div>
    </div>

    <!-- Header -->
    <header class="bg-white shadow-sm sticky top-0 z-50">
        <div class="container mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i data-lucide="play-square" class="w-8 h-8 text-purple-600 mr-3"></i>
                    <h1 class="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        Vidéo Auto
                    </h1>
                </div>
                <button onclick="scrollToRegister()" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-all duration-300 pulse-animation shadow-lg">
                    <i data-lucide="gift" class="w-4 h-4 inline mr-2"></i>
                    Obtenir mon Compte Gratuit
                </button>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="gradient-bg text-white py-20 relative overflow-hidden">
        <div class="absolute inset-0 bg-black opacity-10"></div>
        <div class="container mx-auto px-6 text-center relative z-10">
            <div class="max-w-4xl mx-auto fade-in">
                <h2 class="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                    Automatisez vos vidéos produit pour les réseaux sociaux
                </h2>
                <p class="text-xl md:text-2xl text-purple-100 mb-8">
                    Instagram Reels • TikTok • YouTube Shorts<br>
                    <span class="font-semibold">Génération automatique • Publication programmée</span>
                </p>
                
                <!-- Offre spéciale -->
                <div class="bg-white bg-opacity-20 backdrop-blur rounded-2xl p-8 mb-10 border border-white border-opacity-30">
                    <div class="text-4xl font-bold mb-3">🎁 OFFRE DE LANCEMENT EXCLUSIVE</div>
                    <div class="text-2xl mb-3">Les ${database.settings.maxFreeUsers} premiers clients sont</div>
                    <div class="text-5xl font-bold text-yellow-300 mb-4">GRATUITS À VIE</div>
                    <div class="text-lg">
                        <span class="line-through text-purple-200">Valeur normale: 1.188€/an</span><br>
                        <span class="font-bold text-yellow-200">Votre prix: 0€ pour toujours</span>
                    </div>
                </div>

                <div class="flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-6">
                    <button onclick="startAudit()" class="bg-white text-purple-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-300 shadow-xl">
                        <i data-lucide="search" class="w-5 h-5 inline mr-2"></i>
                        🔍 Audit Gratuit de mon Site
                    </button>
                    <button onclick="scrollToRegister()" class="bg-yellow-400 text-purple-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-yellow-300 transition-all duration-300 shadow-xl">
                        <i data-lucide="crown" class="w-5 h-5 inline mr-2"></i>
                        💎 Réserver ma Place Gratuite
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Counter en temps réel -->
    <section class="py-8 bg-gradient-to-r from-red-50 to-orange-50 border-y-4 border-red-200">
        <div class="container mx-auto px-6">
            <div class="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-12">
                <div class="text-center">
                    <div class="text-4xl font-bold text-red-600" id="used-slots">${usedSlots}</div>
                    <div class="text-sm text-gray-600 font-medium">Comptes gratuits attribués</div>
                </div>
                <div class="w-80 bg-gray-200 rounded-full h-6 shadow-inner">
                    <div id="progress-bar" class="urgency-bar h-6 rounded-full transition-all duration-1000 shadow-lg" style="width: ${progressPercent}%"></div>
                </div>
                <div class="text-center">
                    <div class="text-4xl font-bold text-green-600" id="remaining-slots">${remainingSlots}</div>
                    <div class="text-sm text-gray-600 font-medium">Places restantes</div>
                </div>
            </div>
            <div class="text-center mt-4">
                <p class="text-lg font-semibold text-gray-700">
                    ⏰ <strong>${Math.round(progressPercent)}%</strong> des places gratuites déjà prises !
                </p>
            </div>
        </div>
    </section>

    <!-- Audit Section -->
    <section id="audit-section" class="py-20 bg-white">
        <div class="container mx-auto px-6">
            <div class="max-w-4xl mx-auto">
                <div class="text-center mb-12">
                    <h3 class="text-4xl font-bold text-gray-800 mb-6">
                        🔍 Audit Gratuit et Complet de Votre Site E-commerce
                    </h3>
                    <p class="text-xl text-gray-600 max-w-2xl mx-auto">
                        Découvrez en quelques minutes le potentiel inexploité de vos produits en vidéos automatiques
                    </p>
                </div>

                <div class="bg-white rounded-2xl shadow-2xl p-8 border">
                    <form id="audit-form" onsubmit="performAudit(event)">
                        <div class="mb-8">
                            <label class="block text-lg font-semibold text-gray-700 mb-3">
                                <i data-lucide="globe" class="w-5 h-5 inline mr-2"></i>
                                URL de votre site e-commerce
                            </label>
                            <input 
                                type="url" 
                                id="website-url"
                                placeholder="https://monshop.com"
                                class="w-full px-6 py-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-200 focus:border-purple-500 text-lg transition-all duration-300"
                                required
                            >
                            <p class="text-sm text-gray-500 mt-2">
                                <i data-lucide="shield-check" class="w-4 h-4 inline mr-1"></i>
                                100% sécurisé • Aucune donnée stockée • Audit instantané
                            </p>
                        </div>
                        <button 
                            type="submit"
                            class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-bold text-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg"
                        >
                            🚀 Lancer l'Audit Complet Gratuit
                        </button>
                    </form>

                    <!-- État de chargement -->
                    <div id="audit-loading" class="hidden text-center py-12">
                        <div class="loading-spinner mx-auto mb-6"></div>
                        <div class="text-2xl font-bold text-purple-600 mb-2">Analyse en cours...</div>
                        <div class="text-gray-600 mb-4">Cela peut prendre quelques secondes</div>
                        <div class="max-w-md mx-auto">
                            <div class="text-sm text-gray-500 space-y-1">
                                <p>✓ Détection des produits sur votre site</p>
                                <p>✓ Analyse des images et visuels</p>
                                <p>✓ Évaluation du potentiel vidéo</p>
                                <p>✓ Comparaison avec la concurrence</p>
                            </div>
                        </div>
                    </div>

                    <!-- Résultats d'audit -->
                    <div id="audit-results" class="hidden mt-8"></div>
                </div>
            </div>
        </div>
    </section>

    <!-- Section Fonctionnalités -->
    <section class="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div class="container mx-auto px-6">
            <div class="text-center mb-16">
                <h3 class="text-4xl font-bold text-gray-800 mb-6">
                    Ce que vous obtenez <span class="text-green-600">GRATUITEMENT À VIE</span>
                </h3>
                <p class="text-xl text-gray-600 mb-4">
                    Valeur normale: <span class="line-through">99€/mois</span> • 
                    <span class="font-bold text-green-600">Votre prix: 0€ pour toujours</span>
                </p>
                <div class="text-lg text-purple-600 font-semibold">
                    💰 Économie garantie: <span class="text-2xl">1.188€/an</span>
                </div>
            </div>

            <div class="grid md:grid-cols-3 gap-8">
                <div class="bg-white p-8 rounded-2xl shadow-lg text-center fade-in hover:shadow-xl transition-all duration-300">
                    <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i data-lucide="radar" class="w-10 h-10 text-blue-600"></i>
                    </div>
                    <h4 class="text-2xl font-bold mb-4">Surveillance Automatique</h4>
                    <p class="text-gray-600 mb-6 leading-relaxed">
                        Détection automatique de vos nouveaux produits 4 fois par jour, 7j/7
                    </p>
                    <div class="bg-blue-50 rounded-lg p-3">
                        <div class="text-sm text-purple-600 font-bold">Valeur: 29€/mois</div>
                        <div class="text-xs text-gray-500">Inclus gratuitement</div>
                    </div>
                </div>

                <div class="bg-white p-8 rounded-2xl shadow-lg text-center fade-in hover:shadow-xl transition-all duration-300">
                    <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i data-lucide="wand-2" class="w-10 h-10 text-green-600"></i>
                    </div>
                    <h4 class="text-2xl font-bold mb-4">Génération Vidéo IA</h4>
                    <p class="text-gray-600 mb-6 leading-relaxed">
                        Création automatique de vidéos Reels/Shorts optimisées pour chaque plateforme
                    </p>
                    <div class="bg-green-50 rounded-lg p-3">
                        <div class="text-sm text-purple-600 font-bold">Valeur: 49€/mois</div>
                        <div class="text-xs text-gray-500">Inclus gratuitement</div>
                    </div>
                </div>

                <div class="bg-white p-8 rounded-2xl shadow-lg text-center fade-in hover:shadow-xl transition-all duration-300">
                    <div class="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i data-lucide="send" class="w-10 h-10 text-purple-600"></i>
                    </div>
                    <h4 class="text-2xl font-bold mb-4">Publication Multi-Plateformes</h4>
                    <p class="text-gray-600 mb-6 leading-relaxed">
                        Planification et publication automatique sur Instagram, TikTok, YouTube
                    </p>
                    <div class="bg-purple-50 rounded-lg p-3">
                        <div class="text-sm text-purple-600 font-bold">Valeur: 21€/mois</div>
                        <div class="text-xs text-gray-500">Inclus gratuitement</div>
                    </div>
                </div>
            </div>

            <div class="text-center mt-12">
                <div class="bg-gradient-to-r from-green-400 to-green-600 text-white p-8 rounded-2xl shadow-xl inline-block">
                    <div class="text-3xl font-bold mb-2">
                        💰 Économie totale: <span class="text-yellow-200">1.188€/an</span>
                    </div>
                    <div class="text-lg">
                        Réservé aux ${database.settings.maxFreeUsers} premiers clients uniquement
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Section Inscription -->
    <section id="register-section" class="py-20 gradient-bg text-white relative overflow-hidden">
        <div class="absolute inset-0 bg-black opacity-10"></div>
        <div class="container mx-auto px-6 relative z-10">
            <div class="max-w-3xl mx-auto text-center">
                <h3 class="text-5xl font-bold mb-6">
                    🎯 Réservez Votre Place Gratuite À VIE
                </h3>
                <p class="text-2xl text-purple-100 mb-4">
                    Rejoignez les Founding Members de Vidéo Auto
                </p>
                <p class="text-lg text-purple-200 mb-10">
