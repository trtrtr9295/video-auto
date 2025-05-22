const express = require('express');
const { 
  authenticateToken, 
  checkQuota, 
  logUserAction, 
  validateInput, 
  asyncHandler 
} = require('../middleware/auth');
const { scrapeWebsite } = require('../utils/scraper');
const fs = require('fs').promises;
const router = express.Router();

// Données globales (à remplacer par une vraie DB)
let projects = [];
let users = [];

// Fonction de sauvegarde
const saveData = async () => {
  try {
    const data = { users, projects, videos: [] };
    await fs.writeFile('data.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde projets:', error);
  }
};

// Fonction de chargement des données
const loadData = async () => {
  try {
    const data = await fs.readFile('data.json', 'utf8');
    const parsed = JSON.parse(data);
    projects = parsed.projects || [];
    users = parsed.users || [];
  } catch (error) {
    console.error('Erreur chargement projets:', error);
  }
};

// Schéma de validation pour création de projet
const projectSchema = {
  name: { required: true, type: 'string', minLength: 3, maxLength: 100 },
  website: { required: true, type: 'url' },
  category: { required: true, type: 'string' }
};

// GET /api/projects - Liste des projets utilisateur
router.get('/', 
  authenticateToken,
  logUserAction('Liste des projets'),
  asyncHandler(async (req, res) => {
    await loadData();
    
    const userProjects = projects.filter(p => p.userId === req.user.id);
    
    // Trier par date de création (plus récent en premier)
    userProjects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      projects: userProjects,
      total: userProjects.length,
      quota: {
        used: userProjects.length,
        limit: req.user.accountNumber <= 100 ? 50 : 10,
        remaining: Math.max(0, (req.user.accountNumber <= 100 ? 50 : 10) - userProjects.length)
      }
    });
  })
);

// GET /api/projects/:id - Détails d'un projet
router.get('/:id', 
  authenticateToken,
  logUserAction('Voir projet'),
  asyncHandler(async (req, res) => {
    await loadData();
    
    const project = projects.find(p => p.id === req.params.id && p.userId === req.user.id);
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Projet non trouvé',
        code: 'PROJECT_NOT_FOUND'
      });
    }
    
    res.json(project);
  })
);

// POST /api/projects - Créer un nouveau projet
router.post('/', 
  authenticateToken,
  checkQuota('projects'),
  validateInput(projectSchema),
  logUserAction('Créer projet'),
  asyncHandler(async (req, res) => {
    const { name, website, category, description } = req.body;
    
    await loadData();
    
    // Vérifier si un projet avec le même nom existe déjà pour cet utilisateur
    const existingProject = projects.find(p => 
      p.userId === req.user.id && 
      p.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingProject) {
      return res.status(409).json({ 
        error: 'Un projet avec ce nom existe déjà',
        code: 'PROJECT_NAME_EXISTS'
      });
    }
    
    // Créer le projet
    const project = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      userId: req.user.id,
      name: name.trim(),
      website: website.trim(),
      category,
      description: description ? description.trim() : '',
      status: 'created',
      products: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        autoGenerate: false,
        defaultStyle: req.user.settings.defaultStyle || 'moderne',
        targetPlatforms: ['instagram', 'tiktok', 'youtube']
      },
      stats: {
        totalProducts: 0,
        videosGenerated: 0,
        lastScrapedAt: null
      }
    };
    
    try {
      // Lancer l'analyse du site web
      console.log(`🔍 Analyse du site web: ${website}`);
      const scrapedData = await scrapeWebsite(website, category);
      
      project.products = scrapedData.products || [];
      project.stats.totalProducts = project.products.length;
      project.stats.lastScrapedAt = new Date().toISOString();
      project.status = 'analyzed';
      
      console.log(`✅ Analyse terminée: ${project.products.length} produits trouvés`);
      
    } catch (error) {
      console.error('❌ Erreur analyse site:', error);
      project.status = 'analysis_failed';
      project.error = error.message;
    }
    
    projects.push(project);
    
    // Mettre à jour le compteur de projets utilisateur
    const user = users.find(u => u.id === req.user.id);
    if (user) {
      user.projects = user.projects || [];
      user.projects.push(project.id);
    }
    
    await saveData();
    
    res.status(201).json({
      message: 'Projet créé avec succès',
      project: {
        ...project,
        // Ne pas renvoyer tous les produits dans la réponse initiale
        products: project.products.slice(0, 5),
        productsCount: project.products.length
      }
    });
  })
);

// PUT /api/projects/:id - Mettre à jour un projet
router.put('/:id', 
  authenticateToken,
  logUserAction('Modifier projet'),
  asyncHandler(async (req, res) => {
    await loadData();
    
    const projectIndex = projects.findIndex(p => p.id === req.params.id && p.userId === req.user.id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ 
        error: 'Projet non trouvé',
        code: 'PROJECT_NOT_FOUND'
      });
    }
    
    const { name, description, settings } = req.body;
    const project = projects[projectIndex];
    
    // Mettre à jour les champs modifiables
    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (settings) project.settings = { ...project.settings, ...settings };
    
    project.updatedAt = new Date().toISOString();
    
    await saveData();
    
    res.json({
      message: 'Projet mis à jour avec succès',
      project
    });
  })
);

// POST /api/projects/:id/refresh - Rafraîchir l'analyse du site
router.post('/:id/refresh', 
  authenticateToken,
  logUserAction('Rafraîchir analyse'),
  asyncHandler(async (req, res) => {
    await loadData();
    
    const projectIndex = projects.findIndex(p => p.id === req.params.id && p.userId === req.user.id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ 
        error: 'Projet non trouvé',
        code: 'PROJECT_NOT_FOUND'
      });
    }
    
    const project = projects[projectIndex];
    
    try {
      project.status = 'analyzing';
      await saveData();
      
      console.log(`🔄 Rafraîchissement analyse: ${project.website}`);
      const scrapedData = await scrapeWebsite(project.website, project.category);
      
      const oldProductsCount = project.products.length;
      project.products = scrapedData.products || [];
      project.stats.totalProducts = project.products.length;
      project.stats.lastScrapedAt = new Date().toISOString();
      project.status = 'analyzed';
      project.updatedAt = new Date().toISOString();
      
      const newProducts = project.products.length - oldProductsCount;
      
      console.log(`✅ Rafraîchissement terminé: ${newProducts} nouveaux produits`);
      
      await saveData();
      
      res.json({
        message: 'Analyse rafraîchie avec succès',
        project: {
          ...project,
          products: project.products.slice(0, 5),
          productsCount: project.products.length
        },
        changes: {
          newProducts,
          totalProducts: project.products.length
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur rafraîchissement:', error);
      project.status = 'analysis_failed';
      project.error = error.message;
      await saveData();
      
      res.status(500).json({
        error: 'Erreur lors du rafraîchissement',
        code: 'REFRESH_ERROR',
        details: error.message
      });
    }
  })
);

// GET /api/projects/:id/products - Liste des produits d'un projet
router.get('/:id/products', 
  authenticateToken,
  logUserAction('Voir produits'),
  asyncHandler(async (req, res) => {
    await loadData();
    
    const project = projects.find(p => p.id === req.params.id && p.userId === req.user.id);
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Projet non trouvé',
        code: 'PROJECT_NOT_FOUND'
      });
    }
    
    const { page = 1, limit = 20, category, search } = req.query;
    let filteredProducts = project.products || [];
    
    // Filtrer par catégorie
    if (category) {
      filteredProducts = filteredProducts.filter(p => 
        p.category && p.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Filtrer par recherche
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower))
      );
    }
    
    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    res.json({
      products: paginatedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredProducts.length,
        pages: Math.ceil(filteredProducts.length / parseInt(limit))
      },
      filters: {
        category,
        search
      }
    });
  })
);

// DELETE /api/projects/:id - Supprimer un projet
router.delete('/:id', 
  authenticateToken,
  logUserAction('Supprimer projet'),
  asyncHandler(async (req, res) => {
    await loadData();
    
    const projectIndex = projects.findIndex(p => p.id === req.params.id && p.userId === req.user.id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ 
        error: 'Projet non trouvé',
        code: 'PROJECT_NOT_FOUND'
      });
    }
    
    const project = projects[projectIndex];
    projects.splice(projectIndex, 1);
    
    // Supprimer de la liste utilisateur
    const user = users.find(u => u.id === req.user.id);
    if (user && user.projects) {
      user.projects = user.projects.filter(pid => pid !== req.params.id);
    }
    
    await saveData();
    
    console.log(`🗑️ Projet supprimé: ${project.name} (${req.user.email})`);
    
    res.json({
      message: 'Projet supprimé avec succès',
      deletedProject: {
        id: project.id,
        name: project.name
      }
    });
  })
);

// Export des données pour les autres modules
router.setData = (projectsArray, usersArray) => {
  projects = projectsArray;
  users = usersArray;
};

router.getData = () => ({ projects, users });

module.exports = router;
