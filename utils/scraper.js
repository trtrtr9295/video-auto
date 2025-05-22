const axios = require('axios');
const cheerio = require('cheerio');

// Configuration du user agent pour éviter les blocages
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

// Timeout pour les requêtes
const REQUEST_TIMEOUT = 10000; // 10 secondes

// Fonction principale de scraping (version allégée)
async function scrapeWebsite(url, category = '') {
  console.log(`🔍 Début du scraping (version allégée): ${url}`);
  
  try {
    // Nettoyer et valider l'URL
    const cleanUrl = cleanAndValidateUrl(url);
    
    // Détecter le type de site e-commerce
    const siteType = detectEcommercePlatform(cleanUrl);
    console.log(`🏪 Plateforme détectée: ${siteType}`);
    
    // Scraping avec Axios + Cheerio uniquement
    const scrapingResult = await scrapeWithAxios(cleanUrl, siteType, category);
    
    console.log(`✅ Scraping terminé: ${scrapingResult.products.length} produits trouvés`);
    
    return {
      ...scrapingResult,
      scrapedAt: new Date().toISOString(),
      sourceUrl: cleanUrl,
      platform: siteType
    };
    
  } catch (error) {
    console.error('❌ Erreur scraping:', error);
    
    // Retourner des données de démonstration en cas d'erreur
    return getFallbackData(url, category);
  }
}

// Scraping avec Axios + Cheerio uniquement
async function scrapeWithAxios(url, siteType, category) {
  console.log(`📡 Scraping Axios: ${url}`);
  
  try {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    
    // Sélecteurs selon la plateforme
    const selectors = getSelectorsForPlatform(siteType);
    
    // Extraire les produits
    $(selectors.productContainer).each((index, element) => {
      if (products.length >= 20) return false; // Limiter à 20 produits
      
      const product = extractProductData($, element, selectors, url);
      if (product && product.name && product.image) {
        products.push(product);
      }
    });
    
    // Si pas assez de produits trouvés, essayer des sélecteurs génériques
    if (products.length < 3) {
      const genericProducts = extractGenericProducts($, url);
      products.push(...genericProducts);
    }
    
    return {
      products: products.slice(0, 15), // Limiter à 15 produits
      totalFound: products.length,
      method: 'axios-lite',
      metadata: {
        title: $('title').text().trim() || '',
        description: $('meta[name="description"]').attr('content') || '',
        siteName: extractSiteName($)
      }
    };
    
  } catch (error) {
    console.error('Erreur requête HTTP:', error.message);
    throw new Error('Impossible d\'accéder au site web');
  }
}

// Détecter la plateforme e-commerce
function detectEcommercePlatform(url) {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes('shopify') || url.includes('myshopify.com')) {
    return 'shopify';
  }
  
  if (hostname.includes('woocommerce') || url.includes('wc-api')) {
    return 'woocommerce';
  }
  
  if (hostname.includes('prestashop')) {
    return 'prestashop';
  }
  
  // Sites français populaires
  if (hostname.includes('cdiscount') || hostname.includes('fnac') || 
      hostname.includes('darty') || hostname.includes('boulanger')) {
    return 'french_retail';
  }
  
  return 'generic';
}

// Obtenir les sélecteurs selon la plateforme
function getSelectorsForPlatform(platform) {
  const selectors = {
    shopify: {
      productContainer: '.product-item, .product, .grid__item, .product-card',
      name: '.product-title, .product__title, .product-item__title, h3',
      price: '.price, .product-price, .money, .product__price',
      image: '.product-item__image img, .product__image img, img',
      link: '.product-item__link, .product__link, a'
    },
    woocommerce: {
      productContainer: '.product, .woocommerce-LoopProduct-link, .type-product',
      name: '.woocommerce-loop-product__title, .product-title, h2',
      price: '.price, .woocommerce-Price-amount, .amount',
      image: '.wp-post-image, .attachment-woocommerce_thumbnail',
      link: '.woocommerce-loop-product__link, a'
    },
    generic: {
      productContainer: '[class*="product"], [class*="item"], .card, article',
      name: 'h1, h2, h3, h4, [class*="title"], [class*="name"]',
      price: '[class*="price"], [class*="cost"], [class*="euro"], [class*="amount"]',
      image: 'img',
      link: 'a'
    }
  };
  
  return selectors[platform] || selectors.generic;
}

// Extraire les données d'un produit
function extractProductData($, element, selectors, baseUrl) {
  const $el = $(element);
  
  const name = $el.find(selectors.name).first().text().trim();
  const priceText = $el.find(selectors.price).first().text().trim();
  const imageEl = $el.find(selectors.image).first();
  const linkEl = $el.find(selectors.link).first();
  
  if (!name || name.length < 2) return null;
  
  const image = imageEl.attr('src') || imageEl.attr('data-src') || imageEl.attr('data-lazy-src') || '';
  const link = linkEl.attr('href') || '';
  
  return {
    id: `scraped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.substring(0, 80),
    description: `${name} - Produit trouvé automatiquement`,
    price: extractPriceFromText(priceText),
    image: makeAbsoluteUrl(image, baseUrl),
    url: makeAbsoluteUrl(link, baseUrl),
    category: 'general',
    inStock: true,
    scrapedAt: new Date().toISOString()
  };
}

// Extraire les produits avec des sélecteurs génériques  
function extractGenericProducts($, baseUrl) {
  console.log('🔄 Tentative sélecteurs génériques...');
  
  const products = [];
  const images = $('img').slice(0, 10);
  
  images.each((index, img) => {
    const $img = $(img);
    const src = $img.attr('src') || $img.attr('data-src');
    const alt = $img.attr('alt') || '';
    
    if (src && alt && alt.length > 3 && !src.includes('logo') && !src.includes('icon')) {
      products.push({
        id: `generic_${Date.now()}_${index}`,
        name: alt.substring(0, 50),
        description: `Produit ${alt}`,
        price: Math.floor(Math.random() * 200) + 20,
        image: makeAbsoluteUrl(src, baseUrl),
        url: baseUrl,
        category: 'general',
        inStock: true,
        isGeneric: true
      });
    }
  });
  
  return products.slice(0, 8);
}

// Utilitaires
function cleanAndValidateUrl(url) {
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  
  try {
    const urlObj = new URL(url);
    return urlObj.toString();
  } catch (error) {
    throw new Error(`URL invalide: ${url}`);
  }
}

function makeAbsoluteUrl(url, baseUrl) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return baseUrl + url;
  return baseUrl + '/' + url;
}

function extractPriceFromText(priceText) {
  if (!priceText) return Math.floor(Math.random() * 100) + 10;
  
  const match = priceText.match(/[\d,.]+ ?€|€ ?[\d,.]+|\$[\d,.]+|[\d,.]+ ?\$/);
  if (match) {
    const price = parseFloat(match[0].replace(/[€$,\s]/g, '').replace(',', '.'));
    return isNaN(price) ? 99 : Math.round(price * 100) / 100;
  }
  
  return Math.floor(Math.random() * 150) + 25;
}

function extractSiteName($) {
  return $('meta[property="og:site_name"]').attr('content') || 
         $('title').text().split('-')[0].trim() || 
         'Site E-commerce';
}

// Données de fallback en cas d'erreur
function getFallbackData(url, category) {
  console.log('🎭 Utilisation des données de démonstration');
  
  const categories = {
    fashion: ['T-shirt Premium', 'Jean Skinny', 'Sneakers Tendance', 'Veste d\'Hiver'],
    electronics: ['Smartphone Pro', 'Casque Bluetooth', 'Tablette HD', 'Montre Connectée'],
    beauty: ['Crème Hydratante', 'Rouge à Lèvres', 'Parfum Elite', 'Masque Visage'],
    home: ['Coussin Design', 'Lampe LED', 'Tapis Moderne', 'Cadre Photo'],
    sports: ['Chaussures Running', 'T-shirt Sport', 'Sac de Sport', 'Montre Fitness']
  };
  
  const productNames = categories[category] || categories.electronics;
  const products = [];
  
  for (let i = 0; i < 6; i++) {
    products.push({
      id: `demo_${Date.now()}_${i}`,
      name: productNames[i] || `Produit ${i + 1}`,
      description: `${productNames[i]} de qualité premium avec livraison rapide`,
      price: Math.floor(Math.random() * 200) + 30,
      image: `https://picsum.photos/400/400?random=${Date.now()}_${i}`,
      url: url,
      category: category || 'general',
      inStock: true,
      isDemo: true
    });
  }
  
  return {
    products,
    totalFound: products.length,
    method: 'fallback',
    metadata: {
      title: 'Site E-commerce de Démonstration',
      description: 'Données de démonstration pour test',
      siteName: 'Demo Store'
    }
  };
}

module.exports = {
  scrapeWebsite,
  detectEcommercePlatform,
  getFallbackData
};
