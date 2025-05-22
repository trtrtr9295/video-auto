require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Simuler un compteur d'utilisateurs gratuits
let freeUsersCount = Math.floor(Math.random() * 15) + 67; // Entre 67-82 pour créer l'urgence

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
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Vidéo Auto API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    freeUsersLeft: 100 - freeUsersCount
  });
});

// API pour le compteur d'utilisateurs gratuits
app.get('/api/free-users-count', (req, res) => {
  res.json({
    totalFreeUsers: 100,
    usedSlots: freeUsersCount,
    remainingSlots: 100 - freeUsersCount,
    percentage: (freeUsersCount / 100) * 100
  });
});

// API d'audit de site web
app.post('/api/audit-website', (req, res) => {
  const { websiteUrl } = req.body;
  
  if (!websiteUrl) {
    return res.status(400).json({ error: 'URL du site requis' });
  }

  // Simulation d'audit
  setTimeout(() => {
    const auditResults = {
      websiteUrl,
      score: Math.floor(Math.random() * 30) + 70, // Score entre 70-100
      productsFound: Math.floor(Math.random() * 50) + 15,
      videosPotential: Math.floor(Math.random() * 100) + 50,
      socialMediaOptimization: Math.floor(Math.random() * 40) + 60,
      recommendations: [
        {
          type: 'urgent',
          title: 'Produits sans vidéos détectés',
          description: `${Math.floor(Math.random() * 20) + 10} produits pourraient générer des vidéos automatiquement`,
          impact: 'Augmentation estimée du trafic: +45%'
        },
        {
          type: 'important', 
          title: 'Optimisation réseaux sociaux',
          description: 'Vos produits ne sont pas optimisés pour Instagram Reels et TikTok',
          impact: 'Portée potentielle: +127% d\'engagement'
        },
        {
          type: 'suggestion',
          title: 'Automatisation des publications',
          description: 'Publication manuelle détectée - Automatisation recommandée',
          impact: 'Gain de temps: 8h/semaine'
        }
      ],
      competitorAnalysis: {
        betterThan: Math.floor(Math.random() * 30) + 65,
        averageVideosPerProduct: Math.random() * 2 + 0.3,
        socialMediaPresence: Math.floor(Math.random() * 40) + 40
      }
    };

    res.json({
      success: true,
      audit: auditResults,
      message: 'Audit terminé avec succès !'
    });
  }, 3000); // 3 secondes pour simulation réaliste
});

// API inscription early bird
app.post('/api/register-early-bird', (req, res) => {
  const { email, websiteUrl, companyName } = req.body;
  
  if (freeUsersCount >= 100) {
    return res.status(400).json({ 
      error: 'Plus de places gratuites disponibles',
      message: 'Les 100 comptes gratuits à vie ont été attribués'
    });
  }

  // Simulation d'inscription
  freeUsersCount++;
  
  res.json({
    success: true,
    message: 'Félicitations ! Vous êtes client gratuit À VIE !',
    earlyBirdNumber: freeUsersCount,
    benefits: [
      'Compte gratuit à vie (valeur: 1188€/an)',
      'Accès à toutes les fonctionnalités premium',
      'Support prioritaire',
      'Badge "Founding Member"'
    ],
    nextSteps: [
      'Connectez vos réseaux sociaux',
      'Configurez votre premier audit automatique',
      'Générez vos premières vidéos'
    ]
  });
});

// Servir l'interface web
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vidéo Auto - Automatisez vos vidéos produit | 100 Premiers Clients GRATUITS À VIE</title>
    <meta name="description" content="Créez automatiquement des vidéos de vos produits pour Instagram, TikTok et YouTube. Les 100 premiers clients sont GRATUITS À VIE !">
    
    <!-- Open Graph -->
    <meta property="og:title" content="Vidéo Auto - 100 Premiers Clients GRATUITS À VIE">
    <meta property="og:description" content="Automatisez vos vidéos produit pour réseaux sociaux. Plus que quelques places gratuites !">
    <meta property="og:type" content="website">
    
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
        .gradient-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .urgency-bar {
            background: linear-gradient(90deg, #ef4444 0%, #f97316 50%, #eab308 100%);
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Barre d'urgence -->
    <div class="urgency-bar text-white py-2 text-center text-sm font-medium">
        🔥 <span id="remaining-spots">33</span> places gratuites restantes sur 100 ! Dépêchez-vous !
    </div>

    <!-- Header -->
    <header class="bg-white shadow-sm">
        <div class="container mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i data-lucide="play-square" class="w-8 h-8 text-purple-600 mr-3"></i>
                    <h1 class="text-2xl font-bold gradient-text">Vidéo Auto</h1>
                </div>
                <button onclick="scrollToRegister()" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors pulse-animation">
                    Obtenir mon Compte Gratuit
                </button>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="gradient-bg text-white py-20">
        <div class="container mx-auto px-6 text-center">
            <div class="max-w-4xl mx-auto fade-in">
                <h2 class="text-5xl font-bold mb-6">
                    Automatisez vos vidéos produit pour les réseaux sociaux
                </h2>
                <p class="text-xl text-purple-100 mb-8">
                    Instagram Reels • TikTok • YouTube Shorts • Génération automatique • Publication programmée
                </p>
                
                <!-- Offer Special -->
                <div class="bg-white bg-opacity-20 rounded-lg p-6 mb-8 pulse-animation">
                    <div class="text-3xl font-bold mb-2">🎁 OFFRE DE LANCEMENT</div>
                    <div class="text-xl mb-2">Les 100 premiers clients sont</div>
                    <div class="text-4xl font-bold text-yellow-300">GRATUITS À VIE</div>
                    <div class="text-sm mt-2">Valeur: 1.188€/an • Économie garantie</div>
                </div>

                <div class="flex justify-center space-x-4">
                    <button onclick="startAudit()" class="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors">
                        🔍 Audit Gratuit de mon Site
                    </button>
                    <button onclick="scrollToRegister()" class="bg-yellow-400 text-purple-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition-colors">
                        💎 Réserver ma Place Gratuite
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Counter Section -->
    <section class="py-8 bg-red-50 border-y-2 border-red-200">
        <div class="container mx-auto px-6">
            <div class="flex justify-center items-center space-x-8">
                <div class="text-center">
                    <div class="text-3xl font-bold text-red-600" id="used-slots">67</div>
                    <div class="text-sm text-gray-600">Comptes gratuits attribués</div>
                </div>
                <div class="w-64 bg-gray-200 rounded-full h-4">
                    <div id="progress-bar" class="urgency-bar h-4 rounded-full transition-all duration-500" style="width: 67%"></div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-green-600" id="remaining-slots">33</div>
                    <div class="text-sm text-gray-600">Places restantes</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Audit Section -->
    <section id="audit-section" class="py-16">
        <div class="container mx-auto px-6">
            <div class="max-w-3xl mx-auto">
                <div class="text-center mb-12">
                    <h3 class="text-3xl font-bold text-gray-800 mb-4">
                        🔍 Audit Gratuit de Votre Site E-commerce
                    </h3>
                    <p class="text-xl text-gray-600">
                        Découvrez le potentiel de vos produits en vidéos automatiques
                    </p>
                </div>

                <div class="bg-white rounded-lg shadow-lg p-8">
                    <form id="audit-form" onsubmit="performAudit(event)">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                URL de votre site e-commerce
                            </label>
                            <input 
                                type="url" 
                                id="website-url"
                                placeholder="https://monshop.com"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                required
                            >
                        </div>
                        <button 
                            type="submit"
                            class="w-full bg-purple-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-purple-700 transition-colors"
                        >
                            🚀 Lancer l'Audit Gratuit
                        </button>
                    </form>

                    <!-- Audit Results -->
                    <div id="audit-loading" class="hidden text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
                        <div class="text-lg font-medium">Analyse en cours...</div>
                        <div class="text-sm text-gray-500 mt-2">Détection des produits, analyse des images, évaluation du potentiel vidéo</div>
                    </div>

                    <div id="audit-results" class="hidden mt-8"></div>
                </div>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="py-16 bg-gray-100">
        <div class="container mx-auto px-6">
            <div class="text-center mb-12">
                <h3 class="text-3xl font-bold text-gray-800 mb-4">
                    Ce que vous obtenez GRATUITEMENT À VIE
                </h3>
                <p class="text-xl text-gray-600">
                    Valeur normale: 99€/mois • Votre prix: 0€ pour toujours
                </p>
            </div>

            <div class="grid md:grid-cols-3 gap-8">
                <div class="bg-white p-8 rounded-lg shadow-lg text-center fade-in">
                    <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="search" class="w-8 h-8 text-blue-600"></i>
                    </div>
                    <h4 class="text-xl font-bold mb-4">Surveillance Automatique</h4>
                    <p class="text-gray-600 mb-4">
                        Détection automatique de vos nouveaux produits 4 fois par jour
                    </p>
                    <div class="text-sm text-purple-600 font-medium">Valeur: 29€/mois</div>
                </div>

                <div class="bg-white p-8 rounded-lg shadow-lg text-center fade-in">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="video" class="w-8 h-8 text-green-600"></i>
                    </div>
                    <h4 class="text-xl font-bold mb-4">Génération Vidéo IA</h4>
                    <p class="text-gray-600 mb-4">
                        Création automatique de vidéos Reels/Shorts pour chaque produit
                    </p>
                    <div class="text-sm text-purple-600 font-medium">Valeur: 49€/mois</div>
                </div>

                <div class="bg-white p-8 rounded-lg shadow-lg text-center fade-in">
                    <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="calendar" class="w-8 h-8 text-purple-600"></i>
                    </div>
                    <h4 class="text-xl font-bold mb-4">Publication Multi-Plateformes</h4>
                    <p class="text-gray-600 mb-4">
                        Planification et publication sur Instagram, TikTok, YouTube
                    </p>
                    <div class="text-sm text-purple-600 font-medium">Valeur: 21€/mois</div>
                </div>
            </div>

            <div class="text-center mt-12">
                <div class="bg-white p-6 rounded-lg shadow-lg inline-block">
                    <div class="text-2xl font-bold text-gray-800 mb-2">
                        Économie totale: <span class="text-green-600">1.188€/an</span>
                    </div>
                    <div class="text-purple-600 font-medium">
                        Pour les 100 premiers clients uniquement
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Registration Section -->
    <section id="register-section" class="py-16 gradient-bg text-white">
        <div class="container mx-auto px-6">
            <div class="max-w-2xl mx-auto text-center">
                <h3 class="text-4xl font-bold mb-6">
                    🎯 Réservez Votre Place Gratuite
                </h3>
                <p class="text-xl text-purple-100 mb-8">
                    Rejoignez les Founding Members de Vidéo Auto
                </p>

                <div class="bg-white bg-opacity-20 rounded-lg p-8">
                    <form id="register-form" onsubmit="registerEarlyBird(event)">
                        <div class="grid md:grid-cols-2 gap-4 mb-6">
                            <input 
                                type="email" 
                                id="user-email"
                                placeholder="votre@email.com"
                                class="px-4 py-3 rounded-lg text-gray-800"
                                required
                            >
                            <input 
                                type="text" 
                                id="company-name"
                                placeholder="Nom de votre entreprise"
                                class="px-4 py-3 rounded-lg text-gray-800"
                                required
                            >
                        </div>
                        <input 
                            type="url" 
                            id="company-website"
                            placeholder="https://monsite.com"
                            class="w-full px-4 py-3 rounded-lg text-gray-800 mb-6"
                            required
                        >
                        <button 
                            type="submit"
                            class="w-full bg-yellow-400 text-purple-900 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition-colors"
                        >
                            💎 Obtenir mon Compte Gratuit À VIE
                        </button>
                    </form>

                    <div class="mt-6 text-sm text-purple-100">
                        ✅ Aucun engagement • ✅ Aucune carte bancaire • ✅ Gratuit pour toujours
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Social Proof -->
    <section class="py-16">
        <div class="container mx-auto px-6 text-center">
            <h3 class="text-2xl font-bold text-gray-800 mb-8">
                Ils nous font déjà confiance
            </h3>
            <div class="grid md:grid-cols-4 gap-8">
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600">2.4M+</div>
                    <div class="text-gray-600">Vidéos générées</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600">15K+</div>
                    <div class="text-gray-600">Produits analysés</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600">+127%</div>
                    <div class="text-gray-600">Engagement moyen</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600">8h/sem</div>
                    <div class="text-gray-600">Temps économisé</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gray-800 text-white py-12">
        <div class="container mx-auto px-6 text-center">
            <div class="flex items-center justify-center mb-6">
                <i data-lucide="play-square" class="w-8 h-8 text-purple-400 mr-2"></i>
                <span class="text-2xl font-bold">Vidéo Auto</span>
            </div>
            <p class="text-gray-400 mb-6">
                Automatisez vos vidéos produit • 100 premiers clients gratuits à vie
            </p>
            <div class="flex justify-center space-x-6">
                <a href="/api/health" class="text-gray-400 hover:text-white">API Status</a>
                <a href="https://github.com/trtrtr9295/video-auto" class="text-gray-400 hover:text-white">GitHub</a>
                <a href="mailto:contact@video-auto.com" class="text-gray-400 hover:text-white">Contact</a>
            </div>
        </div>
    </footer>

    <script>
        // Initialiser Lucide icons
        lucide.createIcons();

        // Charger le compteur au démarrage
        async function loadCounter() {
            try {
                const response = await fetch('/api/free-users-count');
                const data = await response.json();
                
                document.getElementById('used-slots').textContent = data.usedSlots;
                document.getElementById('remaining-slots').textContent = data.remainingSlots;
                document.getElementById('remaining-spots').textContent = data.remainingSlots;
                document.getElementById('progress-bar').style.width = data.percentage + '%';
            } catch (error) {
                console.error('Erreur compteur:', error);
            }
        }

        // Audit du site web
        async function performAudit(event) {
            event.preventDefault();
            
            const websiteUrl = document.getElementById('website-url').value;
            const form = document.getElementById('audit-form');
            const loading = document.getElementById('audit-loading');
            const results = document.getElementById('audit-results');
            
            form.classList.add('hidden');
            loading.classList.remove('hidden');
            results.classList.add('hidden');
            
            try {
                const response = await fetch('/api/audit-website', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ websiteUrl })
                });
                
                const data = await response.json();
                
                loading.classList.add('hidden');
                results.classList.remove('hidden');
                
                results.innerHTML = \`
                    <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                        <div class="flex items-center mb-4">
                            <i data-lucide="check-circle" class="w-6 h-6 text-green-600 mr-2"></i>
                            <h4 class="text-lg font-bold text-green-800">Audit Terminé !</h4>
                        </div>
                        <div class="grid md:grid-cols-3 gap-4 mb-4">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-green-600">\${data.audit.score}/100</div>
                                <div class="text-sm text-gray-600">Score d'optimisation</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-blue-600">\${data.audit.productsFound}</div>
                                <div class="text-sm text-gray-600">Produits détectés</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-purple-600">\${data.audit.videosPotential}</div>
                                <div class="text-sm text-gray-600">Vidéos possibles</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        \${data.audit.recommendations.map(rec => \`
                            <div class="border-l-4 \${rec.type === 'urgent' ? 'border-red-500 bg-red-50' : rec.type === 'important' ? 'border-yellow-500 bg-yellow-50' : 'border-blue-500 bg-blue-50'} p-4">
                                <h5 class="font-bold \${rec.type === 'urgent' ? 'text-red-800' : rec.type === 'important' ? 'text-yellow-800' : 'text-blue-800'}">\${rec.title}</h5>
                                <p class="text-gray-700 mt-1">\${rec.description}</p>
                                <p class="text-sm font-medium text-green-600 mt-2">\${rec.impact}</p>
                            </div>
                        \`).join('')}
                    </div>
                    
                    <div class="text-center mt-8">
                        <button onclick="scrollToRegister()" class="bg-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-purple-700 transition-colors pulse-animation">
                            🚀 Automatiser mes Vidéos GRATUITEMENT
                        </button>
                    </div>
                \`;
                
                lucide.createIcons();
                
            } catch (error) {
                loading.classList.add('hidden');
                form.classList.remove('hidden');
                alert('Erreur lors de l\'audit. Veuillez réessayer.');
            }
        }

        // Inscription early bird
        async function registerEarlyBird(event) {
            event.preventDefault();
            
            const email = document.getElementById('user-email').value;
            const companyName = document.getElementById('company-name').value;
            const websiteUrl = document.getElementById('company-website').value;
            
            try {
                const response = await fetch('/api/register-early-bird', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, companyName, websiteUrl })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert(\`🎉 FÉLICITATIONS !\\n\\nVous êtes le client #\${data.earlyBirdNumber}/100 !\\nVotre compte est GRATUIT À VIE !\\n\\nValeur économisée: 1.188€/an\`);
                    loadCounter(); // Mettre à jour le compteur
                } else {
                    alert(data.message || 'Erreur
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Simuler un compteur d'utilisateurs gratuits
let freeUsersCount = Math.floor(Math.random() * 15) + 67; // Entre 67-82 pour créer l'urgence

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
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Vidéo Auto API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    freeUsersLeft: 100 - freeUsersCount
  });
});

// API pour le compteur d'utilisateurs gratuits
app.get('/api/free-users-count', (req, res) => {
  res.json({
    totalFreeUsers: 100,
    usedSlots: freeUsersCount,
    remainingSlots: 100 - freeUsersCount,
    percentage: (freeUsersCount / 100) * 100
  });
});

// API d'audit de site web
app.post('/api/audit-website', (req, res) => {
  const { websiteUrl } = req.body;
  
  if (!websiteUrl) {
    return res.status(400).json({ error: 'URL du site requis' });
  }

  // Simulation d'audit
  setTimeout(() => {
    const auditResults = {
      websiteUrl,
      score: Math.floor(Math.random() * 30) + 70, // Score entre 70-100
      productsFound: Math.floor(Math.random() * 50) + 15,
      videosPotential: Math.floor(Math.random() * 100) + 50,
      socialMediaOptimization: Math.floor(Math.random() * 40) + 60,
      recommendations: [
        {
          type: 'urgent',
          title: 'Produits sans vidéos détectés',
          description: `${Math.floor(Math.random() * 20) + 10} produits pourraient générer des vidéos automatiquement`,
          impact: 'Augmentation estimée du trafic: +45%'
        },
        {
          type: 'important', 
          title: 'Optimisation réseaux sociaux',
          description: 'Vos produits ne sont pas optimisés pour Instagram Reels et TikTok',
          impact: 'Portée potentielle: +127% d\'engagement'
        },
        {
          type: 'suggestion',
          title: 'Automatisation des publications',
          description: 'Publication manuelle détectée - Automatisation recommandée',
          impact: 'Gain de temps: 8h/semaine'
        }
      ],
      competitorAnalysis: {
        betterThan: Math.floor(Math.random() * 30) + 65,
        averageVideosPerProduct: Math.random() * 2 + 0.3,
        socialMediaPresence: Math.floor(Math.random() * 40) + 40
      }
    };

    res.json({
      success: true,
      audit: auditResults,
      message: 'Audit terminé avec succès !'
    });
  }, 3000); // 3 secondes pour simulation réaliste
});

// API inscription early bird
app.post('/api/register-early-bird', (req, res) => {
  const { email, websiteUrl, companyName } = req.body;
  
  if (freeUsersCount >= 100) {
    return res.status(400).json({ 
      error: 'Plus de places gratuites disponibles',
      message: 'Les 100 comptes gratuits à vie ont été attribués'
    });
  }

  // Simulation d'inscription
  freeUsersCount++;
  
  res.json({
    success: true,
    message: 'Félicitations ! Vous êtes client gratuit À VIE !',
    earlyBirdNumber: freeUsersCount,
    benefits: [
      'Compte gratuit à vie (valeur: 1188€/an)',
      'Accès à toutes les fonctionnalités premium',
      'Support prioritaire',
      'Badge "Founding Member"'
    ],
    nextSteps: [
      'Connectez vos réseaux sociaux',
      'Configurez votre premier audit automatique',
      'Générez vos premières vidéos'
    ]
  });
});

// Servir l'interface web
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vidéo Auto - Automatisez vos vidéos produit | 100 Premiers Clients GRATUITS À VIE</title>
    <meta name="description" content="Créez automatiquement des vidéos de vos produits pour Instagram, TikTok et YouTube. Les 100 premiers clients sont GRATUITS À VIE !">
    
    <!-- Open Graph -->
    <meta property="og:title" content="Vidéo Auto - 100 Premiers Clients GRATUITS À VIE">
    <meta property="og:description" content="Automatisez vos vidéos produit pour réseaux sociaux. Plus que quelques places gratuites !">
    <meta property="og:type" content="website">
    
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
        .gradient-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .urgency-bar {
            background: linear-gradient(90deg, #ef4444 0%, #f97316 50%, #eab308 100%);
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Barre d'urgence -->
    <div class="urgency-bar text-white py-2 text-center text-sm font-medium">
        🔥 <span id="remaining-spots">33</span> places gratuites restantes sur 100 ! Dépêchez-vous !
    </div>

    <!-- Header -->
    <header class="bg-white shadow-sm">
        <div class="container mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i data-lucide="play-square" class="w-8 h-8 text-purple-600 mr-3"></i>
                    <h1 class="text-2xl font-bold gradient-text">Vidéo Auto</h1>
                </div>
                <button onclick="scrollToRegister()" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors pulse-animation">
                    Obtenir mon Compte Gratuit
                </button>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="gradient-bg text-white py-20">
        <div class="container mx-auto px-6 text-center">
            <div class="max-w-4xl mx-auto fade-in">
                <h2 class="text-5xl font-bold mb-6">
                    Automatisez vos vidéos produit pour les réseaux sociaux
                </h2>
                <p class="text-xl text-purple-100 mb-8">
                    Instagram Reels • TikTok • YouTube Shorts • Génération automatique • Publication programmée
                </p>
                
                <!-- Offer Special -->
                <div class="bg-white bg-opacity-20 rounded-lg p-6 mb-8 pulse-animation">
                    <div class="text-3xl font-bold mb-2">🎁 OFFRE DE LANCEMENT</div>
                    <div class="text-xl mb-2">Les 100 premiers clients sont</div>
                    <div class="text-4xl font-bold text-yellow-300">GRATUITS À VIE</div>
                    <div class="text-sm mt-2">Valeur: 1.188€/an • Économie garantie</div>
                </div>

                <div class="flex justify-center space-x-4">
                    <button onclick="startAudit()" class="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors">
                        🔍 Audit Gratuit de mon Site
                    </button>
                    <button onclick="scrollToRegister()" class="bg-yellow-400 text-purple-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition-colors">
                        💎 Réserver ma Place Gratuite
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Counter Section -->
    <section class="py-8 bg-red-50 border-y-2 border-red-200">
        <div class="container mx-auto px-6">
            <div class="flex justify-center items-center space-x-8">
                <div class="text-center">
                    <div class="text-3xl font-bold text-red-600" id="used-slots">67</div>
                    <div class="text-sm text-gray-600">Comptes gratuits attribués</div>
                </div>
                <div class="w-64 bg-gray-200 rounded-full h-4">
                    <div id="progress-bar" class="urgency-bar h-4 rounded-full transition-all duration-500" style="width: 67%"></div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-green-600" id="remaining-slots">33</div>
                    <div class="text-sm text-gray-600">Places restantes</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Audit Section -->
    <section id="audit-section" class="py-16">
        <div class="container mx-auto px-6">
            <div class="max-w-3xl mx-auto">
                <div class="text-center mb-12">
                    <h3 class="text-3xl font-bold text-gray-800 mb-4">
                        🔍 Audit Gratuit de Votre Site E-commerce
                    </h3>
                    <p class="text-xl text-gray-600">
                        Découvrez le potentiel de vos produits en vidéos automatiques
                    </p>
                </div>

                <div class="bg-white rounded-lg shadow-lg p-8">
                    <form id="audit-form" onsubmit="performAudit(event)">
                        <div class="mb-6">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                URL de votre site e-commerce
                            </label>
                            <input 
                                type="url" 
                                id="website-url"
                                placeholder="https://monshop.com"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                required
                            >
                        </div>
                        <button 
                            type="submit"
                            class="w-full bg-purple-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-purple-700 transition-colors"
                        >
                            🚀 Lancer l'Audit Gratuit
                        </button>
                    </form>

                    <!-- Audit Results -->
                    <div id="audit-loading" class="hidden text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
                        <div class="text-lg font-medium">Analyse en cours...</div>
                        <div class="text-sm text-gray-500 mt-2">Détection des produits, analyse des images, évaluation du potentiel vidéo</div>
                    </div>

                    <div id="audit-results" class="hidden mt-8"></div>
                </div>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="py-16 bg-gray-100">
        <div class="container mx-auto px-6">
            <div class="text-center mb-12">
                <h3 class="text-3xl font-bold text-gray-800 mb-4">
                    Ce que vous obtenez GRATUITEMENT À VIE
                </h3>
                <p class="text-xl text-gray-600">
                    Valeur normale: 99€/mois • Votre prix: 0€ pour toujours
                </p>
            </div>

            <div class="grid md:grid-cols-3 gap-8">
                <div class="bg-white p-8 rounded-lg shadow-lg text-center fade-in">
                    <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="search" class="w-8 h-8 text-blue-600"></i>
                    </div>
                    <h4 class="text-xl font-bold mb-4">Surveillance Automatique</h4>
                    <p class="text-gray-600 mb-4">
                        Détection automatique de vos nouveaux produits 4 fois par jour
                    </p>
                    <div class="text-sm text-purple-600 font-medium">Valeur: 29€/mois</div>
                </div>

                <div class="bg-white p-8 rounded-lg shadow-lg text-center fade-in">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="video" class="w-8 h-8 text-green-600"></i>
                    </div>
                    <h4 class="text-xl font-bold mb-4">Génération Vidéo IA</h4>
                    <p class="text-gray-600 mb-4">
                        Création automatique de vidéos Reels/Shorts pour chaque produit
                    </p>
                    <div class="text-sm text-purple-600 font-medium">Valeur: 49€/mois</div>
                </div>

                <div class="bg-white p-8 rounded-lg shadow-lg text-center fade-in">
                    <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="calendar" class="w-8 h-8 text-purple-600"></i>
                    </div>
                    <h4 class="text-xl font-bold mb-4">Publication Multi-Plateformes</h4>
                    <p class="text-gray-600 mb-4">
                        Planification et publication sur Instagram, TikTok, YouTube
                    </p>
                    <div class="text-sm text-purple-600 font-medium">Valeur: 21€/mois</div>
                </div>
            </div>

            <div class="text-center mt-12">
                <div class="bg-white p-6 rounded-lg shadow-lg inline-block">
                    <div class="text-2xl font-bold text-gray-800 mb-2">
                        Économie totale: <span class="text-green-600">1.188€/an</span>
                    </div>
                    <div class="text-purple-600 font-medium">
                        Pour les 100 premiers clients uniquement
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Registration Section -->
    <section id="register-section" class="py-16 gradient-bg text-white">
        <div class="container mx-auto px-6">
            <div class="max-w-2xl mx-auto text-center">
                <h3 class="text-4xl font-bold mb-6">
                    🎯 Réservez Votre Place Gratuite
                </h3>
                <p class="text-xl text-purple-100 mb-8">
                    Rejoignez les Founding Members de Vidéo Auto
                </p>

                <div class="bg-white bg-opacity-20 rounded-lg p-8">
                    <form id="register-form" onsubmit="registerEarlyBird(event)">
                        <div class="grid md:grid-cols-2 gap-4 mb-6">
                            <input 
                                type="email" 
                                id="user-email"
                                placeholder="votre@email.com"
                                class="px-4 py-3 rounded-lg text-gray-800"
                                required
                            >
                            <input 
                                type="text" 
                                id="company-name"
                                placeholder="Nom de votre entreprise"
                                class="px-4 py-3 rounded-lg text-gray-800"
                                required
                            >
                        </div>
                        <input 
                            type="url" 
                            id="company-website"
                            placeholder="https://monsite.com"
                            class="w-full px-4 py-3 rounded-lg text-gray-800 mb-6"
                            required
                        >
                        <button 
                            type="submit"
                            class="w-full bg-yellow-400 text-purple-900 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition-colors"
                        >
                            💎 Obtenir mon Compte Gratuit À VIE
                        </button>
                    </form>

                    <div class="mt-6 text-sm text-purple-100">
                        ✅ Aucun engagement • ✅ Aucune carte bancaire • ✅ Gratuit pour toujours
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Social Proof -->
    <section class="py-16">
        <div class="container mx-auto px-6 text-center">
            <h3 class="text-2xl font-bold text-gray-800 mb-8">
                Ils nous font déjà confiance
            </h3>
            <div class="grid md:grid-cols-4 gap-8">
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600">2.4M+</div>
                    <div class="text-gray-600">Vidéos générées</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600">15K+</div>
                    <div class="text-gray-600">Produits analysés</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600">+127%</div>
                    <div class="text-gray-600">Engagement moyen</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600">8h/sem</div>
                    <div class="text-gray-600">Temps économisé</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gray-800 text-white py-12">
        <div class="container mx-auto px-6 text-center">
            <div class="flex items-center justify-center mb-6">
                <i data-lucide="play-square" class="w-8 h-8 text-purple-400 mr-2"></i>
                <span class="text-2xl font-bold">Vidéo Auto</span>
            </div>
            <p class="text-gray-400 mb-6">
                Automatisez vos vidéos produit • 100 premiers clients gratuits à vie
            </p>
            <div class="flex justify-center space-x-6">
                <a href="/api/health" class="text-gray-400 hover:text-white">API Status</a>
                <a href="https://github.com/trtrtr9295/video-auto" class="text-gray-400 hover:text-white">GitHub</a>
                <a href="mailto:contact@video-auto.com" class="text-gray-400 hover:text-white">Contact</a>
            </div>
        </div>
    </footer>

    <script>
        // Initialiser Lucide icons
        lucide.createIcons();

        // Charger le compteur au démarrage
        async function loadCounter() {
            try {
                const response = await fetch('/api/free-users-count');
                const data = await response.json();
                
                document.getElementById('used-slots').textContent = data.usedSlots;
                document.getElementById('remaining-slots').textContent = data.remainingSlots;
                document.getElementById('remaining-spots').textContent = data.remainingSlots;
                document.getElementById('progress-bar').style.width = data.percentage + '%';
            } catch (error) {
                console.error('Erreur compteur:', error);
            }
        }

        // Audit du site web
        async function performAudit(event) {
            event.preventDefault();
            
            const websiteUrl = document.getElementById('website-url').value;
            const form = document.getElementById('audit-form');
            const loading = document.getElementById('audit-loading');
            const results = document.getElementById('audit-results');
            
            form.classList.add('hidden');
            loading.classList.remove('hidden');
            results.classList.add('hidden');
            
            try {
                const response = await fetch('/api/audit-website', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ websiteUrl })
                });
                
                const data = await response.json();
                
                loading.classList.add('hidden');
                results.classList.remove('hidden');
                
                results.innerHTML = \`
                    <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                        <div class="flex items-center mb-4">
                            <i data-lucide="check-circle" class="w-6 h-6 text-green-600 mr-2"></i>
                            <h4 class="text-lg font-bold text-green-800">Audit Terminé !</h4>
                        </div>
                        <div class="grid md:grid-cols-3 gap-4 mb-4">
                            <div class="text-center">
                                <div class="text-2xl font-bold text-green-600">\${data.audit.score}/100</div>
                                <div class="text-sm text-gray-600">Score d'optimisation</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-blue-600">\${data.audit.productsFound}</div>
                                <div class="text-sm text-gray-600">Produits détectés</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold text-purple-600">\${data.audit.videosPotential}</div>
                                <div class="text-sm text-gray-600">Vidéos possibles</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        \${data.audit.recommendations.map(rec => \`
                            <div class="border-l-4 \${rec.type === 'urgent' ? 'border-red-500 bg-red-50' : rec.type === 'important' ? 'border-yellow-500 bg-yellow-50' : 'border-blue-500 bg-blue-50'} p-4">
                                <h5 class="font-bold \${rec.type === 'urgent' ? 'text-red-800' : rec.type === 'important' ? 'text-yellow-800' : 'text-blue-800'}">\${rec.title}</h5>
                                <p class="text-gray-700 mt-1">\${rec.description}</p>
                                <p class="text-sm font-medium text-green-600 mt-2">\${rec.impact}</p>
                            </div>
                        \`).join('')}
                    </div>
                    
                    <div class="text-center mt-8">
                        <button onclick="scrollToRegister()" class="bg-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-purple-700 transition-colors pulse-animation">
                            🚀 Automatiser mes Vidéos GRATUITEMENT
                        </button>
                    </div>
                \`;
                
                lucide.createIcons();
                
            } catch (error) {
                loading.classList.add('hidden');
                form.classList.remove('hidden');
                alert('Erreur lors de l\'audit. Veuillez réessayer.');
            }
        }

        // Inscription early bird
        async function registerEarlyBird(event) {
            event.preventDefault();
            
            const email = document.getElementById('user-email').value;
            const companyName = document.getElementById('company-name').value;
            const websiteUrl = document.getElementById('company-website').value;
            
            try {
                const response = await fetch('/api/register-early-bird', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, companyName, websiteUrl })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert(\`🎉 FÉLICITATIONS !\\n\\nVous êtes le client #\${data.earlyBirdNumber}/100 !\\nVotre compte est GRATUIT À VIE !\\n\\nValeur économisée: 1.188€/an\`);
                    loadCounter(); // Mettre à jour le compteur
                } else {
                    alert(data.message || 'Erreur lors de l\'inscription');
                }
                
            } catch (error) {
                alert('Erreur lors de l\'inscription. Veuillez réessayer.');
            }
        }

        // Navigation fluide
        function scrollToRegister() {
            document.getElementById('register-section').scrollIntoView({ 
                behavior: 'smooth' 
            });
        }

        function startAudit() {
            document.getElementById('audit-section').scrollIntoView({ 
                behavior: 'smooth' 
            });
        }

        // Charger les données au démarrage
        document.addEventListener('DOMContentLoaded', function() {
            loadCounter();
            
            // Mettre à jour le compteur toutes les 30 secondes
            setInterval(loadCounter, 30000);
        });

        // Effet de typing pour certains éléments
        function typeWriter(element, text, speed = 50) {
            let i = 0;
            element.innerHTML = '';
            function type() {
                if (i < text.length) {
                    element.innerHTML += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                }
            }
            type();
        }
    </script>
</body>
</html>
  `);
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Démarrer le serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 Vidéo Auto running on port \${PORT}\`);
  console.log(\`📊 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🔗 Health check: http://localhost:\${PORT}/api/health\`);
  console.log(\`🌐 App: http://localhost:\${PORT}\`);
  console.log(\`💎 Free users: \${100 - freeUsersCount}/100 remaining\`);
});

// Gestion gracieuse des signaux
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT received, shutting down gracefully');  
  process.exit(0);
});
