// ============================================
// MOCK DATA FOR DCF CALCULATOR
// ============================================
// Ce fichier contient des données factices pour tester le calculateur DCF.
// Plus tard, tu remplaceras ces fonctions par de vrais appels API.
//
// COMMENT UTILISER CE FICHIER:
// 1. Place ce fichier dans le même dossier que dcf-calculator.html
// 2. Le fichier est déjà importé dans dcf-calculator.html avec:
//    import { getStockData, searchStocks } from './mock-data.js';
//
// COMMENT REMPLACER PAR TON API:
// 1. Garde la même structure des fonctions (getStockData et searchStocks)
// 2. Remplace le contenu des fonctions par tes appels API
// 3. Assure-toi que les données retournées ont la même structure
// ============================================

// Base de données factice d'actions
const MOCK_STOCKS = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        currentPrice: 178.50,
        freeCashFlow: 99803,      // en millions $
        growthRate: 8.5,          // en %
        terminalGrowth: 3.0,      // en %
        discountRate: 9.2,        // en % (WACC)
        sharesOutstanding: 15441, // en millions
        netDebt: 80130            // en millions $
    },
    {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        currentPrice: 378.91,
        freeCashFlow: 72738,
        growthRate: 10.2,
        terminalGrowth: 3.0,
        discountRate: 8.9,
        sharesOutstanding: 7433,
        netDebt: -48752  // Negative = net cash
    },
    {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        currentPrice: 140.25,
        freeCashFlow: 69495,
        growthRate: 11.5,
        terminalGrowth: 3.5,
        discountRate: 9.5,
        sharesOutstanding: 12437,
        netDebt: -108689
    },
    {
        symbol: 'AMZN',
        name: 'Amazon.com Inc.',
        currentPrice: 175.33,
        freeCashFlow: 36752,
        growthRate: 15.8,
        terminalGrowth: 4.0,
        discountRate: 10.2,
        sharesOutstanding: 10334,
        netDebt: 50733
    },
    {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        currentPrice: 248.50,
        freeCashFlow: 4391,
        growthRate: 25.0,
        terminalGrowth: 5.0,
        discountRate: 12.5,
        sharesOutstanding: 3178,
        netDebt: -16039
    },
    {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        currentPrice: 495.22,
        freeCashFlow: 10431,
        growthRate: 28.5,
        terminalGrowth: 5.0,
        discountRate: 11.8,
        sharesOutstanding: 2465,
        netDebt: -11865
    },
    {
        symbol: 'META',
        name: 'Meta Platforms Inc.',
        currentPrice: 487.82,
        freeCashFlow: 43000,
        growthRate: 12.3,
        terminalGrowth: 3.5,
        discountRate: 10.0,
        sharesOutstanding: 2548,
        netDebt: -38105
    },
    {
        symbol: 'V',
        name: 'Visa Inc.',
        currentPrice: 275.44,
        freeCashFlow: 18327,
        growthRate: 9.8,
        terminalGrowth: 3.0,
        discountRate: 8.5,
        sharesOutstanding: 1993,
        netDebt: 16450
    },
    {
        symbol: 'JNJ',
        name: 'Johnson & Johnson',
        currentPrice: 156.89,
        freeCashFlow: 17933,
        growthRate: 5.5,
        terminalGrowth: 2.5,
        discountRate: 7.8,
        sharesOutstanding: 2409,
        netDebt: 18523
    },
    {
        symbol: 'WMT',
        name: 'Walmart Inc.',
        currentPrice: 162.45,
        freeCashFlow: 24099,
        growthRate: 6.2,
        terminalGrowth: 2.8,
        discountRate: 7.5,
        sharesOutstanding: 2691,
        netDebt: 47748
    },
    {
        symbol: 'JPM',
        name: 'JPMorgan Chase & Co.',
        currentPrice: 195.33,
        freeCashFlow: 38450,
        growthRate: 7.5,
        terminalGrowth: 3.0,
        discountRate: 9.0,
        sharesOutstanding: 2876,
        netDebt: 0  // Banks are treated differently
    },
    {
        symbol: 'DIS',
        name: 'The Walt Disney Company',
        currentPrice: 111.25,
        freeCashFlow: 5466,
        growthRate: 8.5,
        terminalGrowth: 3.0,
        discountRate: 9.8,
        sharesOutstanding: 1823,
        netDebt: 38234
    },
    {
        symbol: 'NFLX',
        name: 'Netflix Inc.',
        currentPrice: 634.50,
        freeCashFlow: 6921,
        growthRate: 14.2,
        terminalGrowth: 4.0,
        discountRate: 11.5,
        sharesOutstanding: 434,
        netDebt: 13866
    },
    {
        symbol: 'COST',
        name: 'Costco Wholesale Corporation',
        currentPrice: 728.45,
        freeCashFlow: 7490,
        growthRate: 8.0,
        terminalGrowth: 3.0,
        discountRate: 8.2,
        sharesOutstanding: 443,
        netDebt: 5822
    },
    {
        symbol: 'UNH',
        name: 'UnitedHealth Group Inc.',
        currentPrice: 515.67,
        freeCashFlow: 26778,
        growthRate: 9.5,
        terminalGrowth: 3.5,
        discountRate: 8.8,
        sharesOutstanding: 919,
        netDebt: 55000
    },
    {
        symbol: 'HD',
        name: 'The Home Depot Inc.',
        currentPrice: 355.88,
        freeCashFlow: 14850,
        growthRate: 6.8,
        terminalGrowth: 2.8,
        discountRate: 8.3,
        sharesOutstanding: 1009,
        netDebt: 35500
    },
    {
        symbol: 'MA',
        name: 'Mastercard Inc.',
        currentPrice: 445.23,
        freeCashFlow: 11450,
        growthRate: 11.0,
        terminalGrowth: 3.5,
        discountRate: 8.9,
        sharesOutstanding: 950,
        netDebt: 12345
    },
    {
        symbol: 'PG',
        name: 'Procter & Gamble Co.',
        currentPrice: 168.90,
        freeCashFlow: 15823,
        growthRate: 5.0,
        terminalGrowth: 2.5,
        discountRate: 7.2,
        sharesOutstanding: 2365,
        netDebt: 28900
    },
    {
        symbol: 'KO',
        name: 'The Coca-Cola Company',
        currentPrice: 62.15,
        freeCashFlow: 10482,
        growthRate: 4.5,
        terminalGrowth: 2.5,
        discountRate: 7.5,
        sharesOutstanding: 4317,
        netDebt: 38211
    },
    {
        symbol: 'ADBE',
        name: 'Adobe Inc.',
        currentPrice: 562.33,
        freeCashFlow: 7145,
        growthRate: 12.5,
        terminalGrowth: 4.0,
        discountRate: 10.2,
        sharesOutstanding: 456,
        netDebt: -4520
    }
];

/**
 * Fonction de recherche d'actions
 * @param {string} query - Le texte de recherche (ticker ou nom)
 * @returns {Array} - Liste des actions correspondantes
 * 
 * POUR REMPLACER PAR TON API:
 * async function searchStocks(query) {
 *     const response = await fetch(`https://ton-api.com/search?q=${query}`);
 *     const data = await response.json();
 *     return data.results.map(stock => ({
 *         symbol: stock.ticker,
 *         name: stock.companyName
 *     }));
 * }
 */
export function searchStocks(query) {
    const searchTerm = query.toLowerCase();
    
    return MOCK_STOCKS
        .filter(stock => 
            stock.symbol.toLowerCase().includes(searchTerm) ||
            stock.name.toLowerCase().includes(searchTerm)
        )
        .slice(0, 8)  // Limit to 8 results
        .map(stock => ({
            symbol: stock.symbol,
            name: stock.name
        }));
}

/**
 * Fonction pour récupérer les données d'une action spécifique
 * @param {string} symbol - Le ticker de l'action (ex: 'AAPL')
 * @returns {Object|null} - Les données de l'action ou null si non trouvée
 * 
 * POUR REMPLACER PAR TON API:
 * async function getStockData(symbol) {
 *     const response = await fetch(`https://ton-api.com/stock/${symbol}`);
 *     const data = await response.json();
 *     return {
 *         symbol: data.ticker,
 *         name: data.companyName,
 *         currentPrice: data.price,
 *         freeCashFlow: data.financials.fcf,
 *         growthRate: data.estimates.growthRate,
 *         terminalGrowth: 3.0,  // Valeur par défaut
 *         discountRate: data.wacc,
 *         sharesOutstanding: data.sharesOutstanding,
 *         netDebt: data.financials.netDebt
 *     };
 * }
 */
export function getStockData(symbol) {
    const stock = MOCK_STOCKS.find(s => s.symbol === symbol);
    
    if (!stock) {
        console.error(`Stock ${symbol} not found`);
        return null;
    }
    
    // Return a copy to avoid mutations
    return { ...stock };
}

/**
 * Fonction pour récupérer toutes les actions disponibles
 * Utile pour afficher une liste complète
 * @returns {Array} - Liste de toutes les actions
 */
export function getAllStocks() {
    return MOCK_STOCKS.map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.currentPrice
    }));
}

/**
 * EXEMPLE D'UTILISATION:
 * 
 * // Rechercher des actions
 * const results = searchStocks('app');
 * console.log(results); // [{ symbol: 'AAPL', name: 'Apple Inc.' }]
 * 
 * // Récupérer les données d'une action
 * const appleData = getStockData('AAPL');
 * console.log(appleData);
 * // {
 * //   symbol: 'AAPL',
 * //   name: 'Apple Inc.',
 * //   currentPrice: 178.50,
 * //   freeCashFlow: 99803,
 * //   ...
 * // }
 */

// Export pour utilisation dans d'autres fichiers
export default {
    searchStocks,
    getStockData,
    getAllStocks
};
