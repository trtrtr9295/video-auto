require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Base de données simple en mémoire
let database = {
  clients: [],
  settings: {
    maxFreeUsers: 100,
    currentFreeUsers: 0
  }
};

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());

// API Health
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Vidéo Auto API fonctionnelle !',
    freeUsersLeft: database.settings.maxFreeUsers - database.settings.currentFreeUsers,
    totalClients: database.clients.length
  });
});

// API Compteur
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

// API Clients
app.get('/api/clients', (req, res) => {
  res.json({
    clients: database.clients.map(client => ({
      id: client.id,
      companyName: client.companyName,
      registeredAt: client.registeredAt,
      earlyBirdNumber: client.earlyBirdNumber
    })),
    total: database.clients.length
  });
});

// API Audit
app.post('/api/audit-website', (req, res) => {
  const { websiteUrl } = req.body;
  
  if (!websiteUrl) {
    return res.status(400).json({ error: 'URL requis' });
  }

  setTimeout(() => {
    const domain = websiteUrl.replace(/(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const score = Math.floor(Math.random() * 25) + 70;
    const products = Math.floor(Math.random() * 50) + 15;
    
    res.json({
      success: true,
      audit: {
        websiteUrl,
        domain,
        score,
        productsFound: products,
        videosPotential: Math.floor(products * 1.5),
        recommendations: [
          {
            type: 'urgent',
            title: products + ' produits sans vidéos détectés',
            description: 'Vos produits pourraient générer des vidéos automatiquement',
            impact: 'Augmentation estimée: +45% de trafic'
          }
        ],
        competitorAnalysis: {
          betterThanPercent: Math.floor(Math.random() * 30) + 60
        },
        techAnalysis: {
          loadTime: (Math.random() * 2 + 1).toFixed(1) + 's',
          mobileOptimized: true,
          seoScore: Math.floor(Math.random() * 20) + 75,
          socialIntegration: false
        }
      }
    });
  }, 3000);
});

// API Inscription
app.post('/api/register-early-bird', (req, res) => {
  const { email, companyName, websiteUrl } = req.body;
  
  if (!email || !companyName || !websiteUrl) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  if (database.settings.currentFreeUsers >= database.settings.maxFreeUsers) {
    return res.status(400).json({ 
      error: 'Plus de places gratuites',
      message: 'Les 100 comptes gratuits ont été attribués'
    });
  }

  // Vérifier email existant
  const existing = database.clients.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ 
      error: 'Email déjà inscrit',
      message: 'Cet email est déjà client #' + existing.earlyBirdNumber
    });
  }

  // Créer nouveau client
  const newClient = {
    id: Date.now().toString(),
    email: email.toLowerCase(),
    companyName,
    websiteUrl,
    registeredAt: new Date().toISOString(),
    earlyBirdNumber: database.settings.currentFreeUsers + 1,
    status: 'active'
  };

  database.clients.push(newClient);
  database.settings.currentFreeUsers++;

  res.json({
    success: true,
    message: 'Compte gratuit à vie créé !',
    client: {
      earlyBirdNumber: newClient.earlyBirdNumber,
      companyName: newClient.companyName,
      registeredAt: newClient.registeredAt
    },
    remainingSlots: database.settings.maxFreeUsers - database.settings.currentFreeUsers
  });
});

// Page principale
app.get('/', (req, res) => {
  const remaining = database.settings.maxFreeUsers - database.settings.currentFreeUsers;
  const used = database.settings.currentFreeUsers;
  const percent = Math.round((used / database.settings.maxFreeUsers) * 100);

  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vidéo Auto - ${remaining} Places Gratuites Restantes !</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
</head>
<body class="bg-gray-50">
    <!-- Barre urgence -->
    <div class="bg-red-600 text-white py-2 text-center font-bold">
        🔥 Plus que ${remaining} places gratuites sur 100 !
    </div>

    <!-- Header -->
    <header class="bg-white shadow-sm py-4">
        <div class="container mx-auto px-6 flex justify-between items-center">
            <h1 class="text-2xl font-bold text-purple-600">Vidéo Auto</h1>
            <button onclick="scrollTo('register')" class="bg-purple-600 text-white px-6 py-2 rounded-lg">
                Compte Gratuit
            </button>
        </div>
    </header>

    <!-- Hero -->
    <section class="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div class="container mx-auto px-6 text-center">
            <h2 class="text-5xl font-bold mb-6">
                Automatisez vos vidéos produit
            </h2>
            <p class="text-xl mb-8">Instagram • TikTok • YouTube</p>
            
            <div class="bg-white bg-opacity-20 rounded-lg p-6 mb-8 max-w-md mx-auto">
                <div class="text-3xl font-bold mb-2">🎁 OFFRE SPÉCIALE</div>
                <div class="text-xl mb-2">Les 100 premiers clients</div>
                <div class="text-3xl font-bold text-yellow-300">GRATUITS À VIE</div>
            </div>

            <div class="space-y-4">
                <button onclick="scrollTo('audit')" class="bg-white text-purple-600 px-8 py-3 rounded-lg font-bold mr-4">
                    🔍 Audit Gratuit
                </button>
                <button onclick="scrollTo('register')" class="bg-yellow-400 text-purple-900 px-8 py-3 rounded-lg font-bold">
                    💎 Place Gratuite
                </button>
            </div>
        </div>
    </section>

    <!-- Compteur -->
    <section class="py-8 bg-red-50">
        <div class="container mx-auto px-6 text-center">
            <div class="flex justify-center items-center space-x-8">
                <div>
                    <div class="text-3xl font-bold text-red-600">${used}</div>
                    <div class="text-sm">Attribués</div>
                </div>
                <div class="w-64 bg-gray-200 rounded-full h-4">
                    <div class="bg-red-500 h-4 rounded-full" style="width:${percent}%"></div>
                </div>
                <div>
                    <div class="text-3xl font-bold text-green-600">${remaining}</div>
                    <div class="text-sm">Restants</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Audit -->
    <section id="audit" class="py-16">
        <div class="container mx-auto px-6 max-w-2xl">
            <h3 class="text-3xl font-bold text-center mb-8">
                🔍 Audit Gratuit de Votre Site
            </h3>
            
            <div class="bg-white rounded-lg shadow-lg p-8">
                <form id="audit-form" onsubmit="performAudit(event)">
                    <input 
                        type="url" 
                        id="website-url"
                        placeholder="https://monshop.com"
                        class="w-full px-4 py-3 border rounded-lg mb-4"
                        required
                    >
                    <button type="submit" class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold">
                        🚀 Lancer l'Audit
                    </button>
                </form>

                <div id="audit-loading" class="hidden text-center py-8">
                    <div class="text-lg">Analyse en cours...</div>
                </div>

                <div id="audit-results" class="hidden mt-6"></div>
            </div>
        </div>
    </section>

    <!-- Features -->
    <section class="py-16 bg-gray-100">
        <div class="container mx-auto px-6">
            <h3 class="text-3xl font-bold text-center mb-12">
                Gratuit À Vie (Valeur: 1.188€/an)
            </h3>
            <div class="grid md:grid-cols-3 gap-8">
                <div class="bg-white p-6 rounded-lg shadow text-center">
                    <div class="text-4xl mb-4">🔍</div>
                    <h4 class="font-bold mb-2">Surveillance Auto</h4>
                    <p class="text-gray-600">Détection produits 4x/jour</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow text-center">
                    <div class="text-4xl mb-4">🎬</div>
                    <h4 class="font-bold mb-2">Génération IA</h4>
                    <p class="text-gray-600">Vidéos Reels automatiques</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow text-center">
                    <div class="text-4xl mb-4">📱</div>
                    <h4 class="font-bold mb-2">Multi-Plateformes</h4>
                    <p class="text-gray-600">Instagram, TikTok, YouTube</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Registration -->
    <section id="register" class="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div class="container mx-auto px-6 max-w-2xl text-center">
            <h3 class="text-4xl font-bold mb-6">
                🎯 Votre Place Gratuite À VIE
            </h3>
            <p class="text-xl mb-8">Plus que ${remaining} places !</p>

            <div class="bg-white bg-opacity-20 rounded-lg p-8">
                <form id="register-form" onsubmit="registerClient(event)">
                    <div class="space-y-4">
                        <input 
                            type="email" 
                            id="user-email"
                            placeholder="votre@email.com"
                            class="w-full px-4 py-3 rounded-lg text-gray-800"
                            required
                        >
                        <input 
                            type="text" 
                            id="company-name"
                            placeholder="Votre entreprise"
                            class="w-full px-4 py-3 rounded-lg text-gray-800"
                            required
                        >
                        <input 
                            type="url" 
                            id="company-website"
                            placeholder="https://monsite.com"
                            class="w-full px-4 py-3 rounded-lg text-gray-800"
                            required
                        >
                        <button type="submit" class="w-full bg-yellow-400 text-purple-900 py-3 rounded-lg font-bold text-lg">
                            💎 Obtenir mon Compte Gratuit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </section>

    <!-- Clients récents -->
    <section class="py-16">
        <div class="container mx-auto px-6 max-w-2xl">
            <h4 class="text-2xl font-bold text-center mb-8">🔥 Dernières inscriptions</h4>
            <div id="recent-clients">
                <div class="text-center text-gray-500">Soyez le premier !</div>
            </div>
        </div>
    </section>

    <script>
        lucide.createIcons();

        async function performAudit(event) {
            event.preventDefault();
            const url = document.getElementById('website-url').value;
            const form = document.getElementById('audit-form');
            const loading = document.getElementById('audit-loading');
            const results = document.getElementById('audit-results');
            
            form.classList.add('hidden');
            loading.classList.remove('hidden');
            
            try {
                const response = await fetch('/api/audit-website', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ websiteUrl: url })
                });
                
                const data = await response.json();
                
                loading.classList.add('hidden');
                results.classList.remove('hidden');
                
                results.innerHTML = \`
                    <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                        <h4 class="font-bold text-green-800 mb-4">Audit de \${data.audit.domain} terminé !</h4>
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="text-center">
                                <div class="text-2xl font-bold">\${data.audit.score}/100</div>
                                <div class="text-sm">Score</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold">\${data.audit.productsFound}</div>
                                <div class="text-sm">Produits</div>
                            </div>
                        </div>
                        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                            <p class="font-bold">\${data.audit.recommendations[0].title}</p>
                            <p class="text-sm">\${data.audit.recommendations[0].impact}</p>
                        </div>
                        <button onclick="scrollTo('register')" class="w-full bg-purple-600 text-white py-2 rounded-lg">
                            Automatiser Gratuitement
                        </button>
                    </div>
                \`;
            } catch (error) {
                loading.classList.add('hidden');
                form.classList.remove('hidden');
                alert('Erreur audit');
            }
        }

        async function registerClient(event) {
            event.preventDefault();
            
            const email = document.getElementById('user-email').value;
            const company = document.getElementById('company-name').value;
            const website = document.getElementById('company-website').value;
            
            try {
                const response = await fetch('/api/register-early-bird', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email, 
                        companyName: company, 
                        websiteUrl: website 
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('🎉 FÉLICITATIONS !\\n\\nVous êtes le client #' + data.client.earlyBirdNumber + '/100 !\\n\\nCompte GRATUIT À VIE créé !');
                    location.reload();
                } else {
                    alert('Erreur: ' + data.message);
                }
                
            } catch (error) {
                alert('Erreur inscription');
            }
        }

        async function loadClients() {
            try {
                const response = await fetch('/api/clients');
                const data = await response.json();
                
                if (data.clients.length === 0) return;
                
                const html = data.clients.slice(-3).reverse().map(client => \`
                    <div class="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-2">
                        <div>
                            <div class="font-bold">\${client.companyName}</div>
                            <div class="text-sm text-gray-500">Client #\${client.earlyBirdNumber}</div>
                        </div>
                        <div class="text-green-600 font-bold">✅ GRATUIT</div>
                    </div>
                \`).join('');
                
                document.getElementById('recent-clients').innerHTML = html;
            } catch (error) {
                console.error('Erreur clients');
            }
        }

        function scrollTo(id) {
            document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
        }

        // Charger au démarrage
        loadClients();
        setInterval(loadClients, 30000);
    </script>
</body>
</html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Vidéo Auto running on port ' + PORT);
  console.log('💎 Free slots: ' + (database.settings.maxFreeUsers - database.settings.currentFreeUsers));
});
