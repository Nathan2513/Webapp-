// FMP API Manager with Intelligent Caching
// Updated to support the new FMP "/stable/" API architecture

class FMPCache {
    constructor() {
        this.API_KEY = 'RxYKGPJbSbTuLhW15Bdrop3OxJ2tiXDf';
        // NOUVELLE ARCHITECTURE FMP (remplace /api/v3/)
        this.BASE_URL = 'https://financialmodelingprep.com/stable';
        this.CACHE_DURATION = 3600000; // 1 hour in milliseconds
        this.requestQueue = [];
        this.isProcessing = false;
    }

    getCacheKey(endpoint, params = {}) {
        const paramString = Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('&');
        return `fmp_${endpoint}_${paramString}`;
    }

    isCacheValid(cacheData) {
        if (!cacheData) return false;
        const now = Date.now();
        return (now - cacheData.timestamp) < this.CACHE_DURATION;
    }

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
    }

    // Make API request with the new parameter format (?symbol=XYZ)
    async makeRequest(endpoint, params = {}) {
        const cacheKey = this.getCacheKey(endpoint, params);
        
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const queryParams = new URLSearchParams({
            ...params,
            apikey: this.API_KEY
        });
        
        const url = `${this.BASE_URL}${endpoint}?${queryParams}`;

        console.log(`🌐 API Request: ${url}`);

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.saveToCache(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

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

    async getQuote(symbol) {
        return this.makeRequest(`/quote`, { symbol });
    }

    async getFinancialRatios(symbol) {
        return this.makeRequest(`/ratios-ttm`, { symbol });
    }

    async getKeyMetrics(symbol) {
        return this.makeRequest(`/key-metrics-ttm`, { symbol });
    }

    async getIncomeStatement(symbol, limit = 5) {
        return this.makeRequest(`/income-statement`, { symbol, limit });
    }

    async getBalanceSheet(symbol, limit = 5) {
        return this.makeRequest(`/balance-sheet-statement`, { symbol, limit });
    }

    async getCashFlow(symbol, limit = 5) {
        return this.makeRequest(`/cash-flow-statement`, { symbol, limit });
    }

    async getFinancialGrowth(symbol, limit = 5) {
        return this.makeRequest(`/financial-growth`, { symbol, limit });
    }

    async getDividendHistory(symbol) {
        return this.makeRequest(`/historical-price-full/stock_dividend`, { symbol });
    }

    // ===== COMPOSITE DATA METHODS =====

    async getScreenerData(symbol) {
        const requests = [
            { endpoint: `/quote`, params: { symbol } },
            { endpoint: `/ratios-ttm`, params: { symbol } },
            { endpoint: `/key-metrics-ttm`, params: { symbol } },
            { endpoint: `/income-statement`, params: { symbol, limit: 5 } }
        ];

        const [quote, ratios, metrics, income] = await this.batchRequest(requests);
        const quoteData = quote?.[0] || {};

        return {
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

    async getDCFData(symbol) {
        const requests = [
            { endpoint: `/quote`, params: { symbol } },
            { endpoint: `/cash-flow-statement`, params: { symbol, limit: 10 } },
            { endpoint: `/income-statement`, params: { symbol, limit: 10 } },
            { endpoint: `/financial-growth`, params: { symbol, limit: 5 } },
            { endpoint: `/discounted-cash-flow`, params: { symbol } }
        ];

        const [quote, cashFlow, income, growth, dcf] = await this.batchRequest(requests);
        const quoteData = quote?.[0] || {};

        return {
            profile: { symbol: quoteData.symbol || symbol, companyName: quoteData.name || symbol },
            quote: quoteData,
            cashFlow: cashFlow || [],
            income: income || [],
            growth: growth || [],
            dcf: dcf?.[0] || null
        };
    }

    async getValorisationData(symbol) {
        const requests = [
            { endpoint: `/quote`, params: { symbol } },
            { endpoint: `/ratios-ttm`, params: { symbol } },
            { endpoint: `/key-metrics-ttm`, params: { symbol } },
            { endpoint: `/ratios`, params: { symbol, limit: 5 } },
            { endpoint: `/income-statement`, params: { symbol, limit: 5 } },
            { endpoint: `/cash-flow-statement`, params: { symbol, limit: 5 } }
        ];

        const [quote, ratiosTTM, metricsTTM, historicalRatios, income, cashFlow] = await this.batchRequest(requests);
        const quoteData = quote?.[0] || {};

        return {
            profile: { symbol: quoteData.symbol || symbol, companyName: quoteData.name || symbol },
            quote: quoteData,
            ratiosTTM: ratiosTTM?.[0] || null,
            metricsTTM: metricsTTM?.[0] || null,
            historicalRatios: historicalRatios || [],
            income: income || [],
            cashFlow: cashFlow || []
        };
    }

    // Le nouvel endpoint de recherche de FMP
    async searchStocks(query) {
        if (query.length < 1) return [];
        return this.makeRequest(`/search-symbol`, { query, limit: 10 });
    }

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
    }
}

const fmpAPI = new FMPCache();
window.fmpAPI = fmpAPI;

export default fmpAPI;
