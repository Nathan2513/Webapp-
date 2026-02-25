// FMP API Manager with Intelligent Caching
// API Key updated to fix Legacy Endpoint 403 error

class FMPCache {
    constructor() {
        // Nouvelle clé API valide
        this.API_KEY = 'RxYKGPJbSbTuLhW15Bdrop3OxJ2tiXDf';
        this.BASE_URL = 'https://financialmodelingprep.com/api/v3';
        this.CACHE_DURATION = 3600000; // 1 hour in milliseconds
        this.requestQueue = [];
        this.isProcessing = false;
    }

    // Get cache key
    getCacheKey(endpoint, params = {}) {
        const paramString = Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('&');
        return `fmp_${endpoint}_${paramString}`;
    }

    // Check if cache is valid
    isCacheValid(cacheData) {
        if (!cacheData) return false;
        const now = Date.now();
        return (now - cacheData.timestamp) < this.CACHE_DURATION;
    }

    // Get from cache
    getFromCache(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            if (this.isCacheValid(data)) {
                console.log(`✅ Cache hit for ${key}`);
                return data.value;
            } else {
                console.log(`⏰ Cache expired for ${key}`);
                localStorage.removeItem(key);
                return null;
            }
        } catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    }

    // Save to cache
    saveToCache(key, value) {
        try {
            const cacheData = {
                value: value,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheData));
            console.log(`💾 Cached: ${key}`);
        } catch (error) {
            console.error('Cache write error:', error);
            // If localStorage is full, clear old cache
            if (error.name === 'QuotaExceededError') {
                this.clearOldCache();
                try {
                    localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
                } catch (e) {
                    console.error('Failed to cache even after cleanup:', e);
                }
            }
        }
    }

    // Clear old cache entries
    clearOldCache() {
        console.log('🧹 Clearing old cache...');
        const now = Date.now();
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('fmp_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (now - data.timestamp > this.CACHE_DURATION) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    keysToRemove.push(key);
                }
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`Removed ${keysToRemove.length} old cache entries`);
    }

    // Make API request with rate limiting
    async makeRequest(endpoint, params = {}) {
        const cacheKey = this.getCacheKey(endpoint, params);
        
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        // Build URL
        const queryParams = new URLSearchParams({
            ...params,
            apikey: this.API_KEY
        });
        const url = `${this.BASE_URL}${endpoint}?${queryParams}`;

        console.log(`🌐 API Request: ${endpoint}`);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Save to cache
            this.saveToCache(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Batch requests - makes multiple calls but returns when all complete
    async batchRequest(requests) {
        console.log(`📦 Batch request: ${requests.length} items`);
        const promises = requests.map(req => 
            this.makeRequest(req.endpoint, req.params)
                .catch(error => {
                    console.error(`Failed request for ${req.endpoint}:`, error);
                    return null;
                })
        );
        
        return await Promise.all(promises);
    }

    // ===== STOCK DATA METHODS =====

    // Get company profile (MODIFIÉ: Utilise /quote au lieu de /profile pour contourner l'erreur Legacy)
    async getCompanyProfile(symbol) {
        const quote = await this.makeRequest(`/quote/${symbol}`);
        if (quote && quote.length > 0) {
            // On recrée une structure similaire à profile pour ne pas casser l'UI
            return [{
                symbol: quote[0].symbol,
                companyName: quote[0].name,
                price: quote[0].price,
                mktCap: quote[0].marketCap,
                exchange: quote[0].exchange,
                industry: "N/A", // Secteur indisponible via quote
                sector: "N/A"
            }];
        }
        return null;
    }

    // Get quote (current price, change, etc.)
    async getQuote(symbol) {
        return this.makeRequest(`/quote/${symbol}`);
    }

    // Get financial ratios (TTM)
    async getFinancialRatios(symbol) {
        return this.makeRequest(`/ratios-ttm/${symbol}`);
    }

    // Get key metrics (TTM)
    async getKeyMetrics(symbol) {
        return this.makeRequest(`/key-metrics-ttm/${symbol}`);
    }

    // Get income statement (annual)
    async getIncomeStatement(symbol, limit = 5) {
        return this.makeRequest(`/income-statement/${symbol}`, { limit });
    }

    // Get balance sheet (annual)
    async getBalanceSheet(symbol, limit = 5) {
        return this.makeRequest(`/balance-sheet-statement/${symbol}`, { limit });
    }

    // Get cash flow statement (annual)
    async getCashFlow(symbol, limit = 5) {
        return this.makeRequest(`/cash-flow-statement/${symbol}`, { limit });
    }

    // Get financial growth
    async getFinancialGrowth(symbol, limit = 5) {
        return this.makeRequest(`/financial-growth/${symbol}`, { limit });
    }

    // Get dividend history
    async getDividendHistory(symbol) {
        return this.makeRequest(`/historical-price-full/stock_dividend/${symbol}`);
    }

    // Get DCF valuation
    async getDCFValuation(symbol) {
        return this.makeRequest(`/discounted-cash-flow/${symbol}`);
    }

    // Get historical DCF
    async getHistoricalDCF(symbol, limit = 5) {
        return this.makeRequest(`/historical-discounted-cash-flow-statement/${symbol}`, { limit });
    }

    // ===== COMPOSITE DATA METHODS =====

    // Get all data for stock screener (optimized - single batch)
    async getScreenerData(symbol) {
        const requests = [
            // L'endpoint /profile/ a été retiré ici
            { endpoint: `/quote/${symbol}`, params: {} },
            { endpoint: `/ratios-ttm/${symbol}`, params: {} },
            { endpoint: `/key-metrics-ttm/${symbol}`, params: {} },
            { endpoint: `/income-statement/${symbol}`, params: { limit: 5 } }
        ];

        const [quote, ratios, metrics, income] = await this.batchRequest(requests);
        const quoteData = quote?.[0] || {};

        return {
            // On recrée manuellement l'objet profile attendu par le HTML
            profile: {
                symbol: quoteData.symbol || symbol,
                companyName: quoteData.name || symbol,
                sector: "N/A",
                industry: "N/A",
                mktCap: quoteData.marketCap || 0,
                lastDiv: 0
            },
            quote: quoteData,
            ratios: ratios?.[0] || null,
            metrics: metrics?.[0] || null,
            income: income || []
        };
    }

    // Get all data for DCF calculator (optimized - single batch)
    async getDCFData(symbol) {
        const requests = [
            // L'endpoint /profile/ a été retiré ici
            { endpoint: `/quote/${symbol}`, params: {} },
            { endpoint: `/cash-flow-statement/${symbol}`, params: { limit: 10 } },
            { endpoint: `/income-statement/${symbol}`, params: { limit: 10 } },
            { endpoint: `/financial-growth/${symbol}`, params: { limit: 5 } },
            { endpoint: `/discounted-cash-flow/${symbol}`, params: {} }
        ];

        const [quote, cashFlow, income, growth, dcf] = await this.batchRequest(requests);
        const quoteData = quote?.[0] || {};

        return {
            profile: {
                symbol: quoteData.symbol || symbol,
                companyName: quoteData.name || symbol,
                sector: "N/A"
            },
            quote: quoteData,
            cashFlow: cashFlow || [],
            income: income || [],
            growth: growth || [],
            dcf: dcf?.[0] || null
        };
    }

    // Get all data for valorisation analysis (optimized - single batch)
    async getValorisationData(symbol) {
        const requests = [
            // L'endpoint /profile/ a été retiré ici
            { endpoint: `/quote/${symbol}`, params: {} },
            { endpoint: `/ratios-ttm/${symbol}`, params: {} },
            { endpoint: `/key-metrics-ttm/${symbol}`, params: {} },
            { endpoint: `/ratios/${symbol}`, params: { limit: 5 } }, // Historical ratios
            { endpoint: `/income-statement/${symbol}`, params: { limit: 5 } },
            { endpoint: `/cash-flow-statement/${symbol}`, params: { limit: 5 } }
        ];

        const [quote, ratiosTTM, metricsTTM, historicalRatios, income, cashFlow] = await this.batchRequest(requests);
        const quoteData = quote?.[0] || {};

        return {
            profile: {
                symbol: quoteData.symbol || symbol,
                companyName: quoteData.name || symbol,
                sector: "N/A"
            },
            quote: quoteData,
            ratiosTTM: ratiosTTM?.[0] || null,
            metricsTTM: metricsTTM?.[0] || null,
            historicalRatios: historicalRatios || [],
            income: income || [],
            cashFlow: cashFlow || []
        };
    }

    // Search stocks
    async searchStocks(query) {
        if (query.length < 1) return [];
        return this.makeRequest(`/search`, { query, limit: 10 });
    }

    // Get stock list (with cache - this is heavy)
    async getStockList() {
        const cacheKey = 'fmp_stock_list';
        const cached = this.getFromCache(cacheKey);
        
        if (cached) {
            return cached;
        }

        // This endpoint returns all stocks - cache it heavily
        const data = await this.makeRequest('/stock/list');
        this.saveToCache(cacheKey, data);
        return data;
    }

    // Clear all cache
    clearAllCache() {
        console.log('🗑️ Clearing all FMP cache...');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('fmp_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`Cleared ${keysToRemove.length} cache entries`);
    }

    // Get cache statistics
    getCacheStats() {
        let totalEntries = 0;
        let validEntries = 0;
        let expiredEntries = 0;
        let totalSize = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('fmp_')) {
                totalEntries++;
                const item = localStorage.getItem(key);
                totalSize += item.length;
                
                try {
                    const data = JSON.parse(item);
                    if (this.isCacheValid(data)) {
                        validEntries++;
                    } else {
                        expiredEntries++;
                    }
                } catch (e) {
                    expiredEntries++;
                }
            }
        }

        return {
            totalEntries,
            validEntries,
            expiredEntries,
            totalSizeKB: (totalSize / 1024).toFixed(2)
        };
    }
}

// Export singleton instance
const fmpAPI = new FMPCache();
window.fmpAPI = fmpAPI;

export default fmpAPI;
