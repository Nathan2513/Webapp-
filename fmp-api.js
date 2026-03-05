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
            const cacheData = { value: value, timestamp: Date.now() };
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

        const queryParams = new URLSearchParams({ ...params, apikey: this.API_KEY });
        const url = `${this.BASE_URL}${endpoint}?${queryParams}`;

        console.log(`🌐 API Request: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

    // ===== INDIVIDUAL DATA METHODS (kept for backward compatibility) =====

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

    /**
     * ANNUAL - Full screener data in ONE batch (7 requests total)
     * Called once per symbol. Results cached for 1h.
     * - quote (price, change, mktCap)
     * - ratios-ttm (current valuation ratios)
     * - key-metrics-ttm (ROE, EPS, etc.)
     * - income-statement (5 years)
     * - balance-sheet-statement (5 years)
     * - cash-flow-statement (5 years)
     * - ratios (historical ratios, 5 years, for Ratios tab)
     */
    async getFullScreenerData(symbol) {
        const requests = [
            { endpoint: `/quote`,                       params: { symbol } },
            { endpoint: `/ratios-ttm`,                  params: { symbol } },
            { endpoint: `/key-metrics-ttm`,             params: { symbol } },
            { endpoint: `/income-statement`,             params: { symbol, limit: 5 } },
            { endpoint: `/balance-sheet-statement`,      params: { symbol, limit: 5 } },
            { endpoint: `/cash-flow-statement`,          params: { symbol, limit: 5 } },
            { endpoint: `/ratios`,                       params: { symbol, limit: 5 } },
        ];

        const [quote, ratios, metrics, income, balance, cashflow, ratiosHistory] =
            await this.batchRequest(requests);

        const quoteData = Array.isArray(quote) ? quote[0] : (quote || {});

        return {
            profile: {
                symbol:      quoteData.symbol    || symbol,
                companyName: quoteData.name       || symbol,
                sector:      quoteData.sector     || 'N/A',
                industry:    quoteData.industry   || 'N/A',
                mktCap:      quoteData.marketCap  || 0,
                lastDiv:     quoteData.lastAnnualDividend || 0,
            },
            quote:         quoteData,
            ratios:        Array.isArray(ratios) ? ratios[0] : (ratios || null),
            metrics:       Array.isArray(metrics) ? metrics[0] : (metrics || null),
            income:        income        || [],
            balance:       balance       || [],
            cashflow:      cashflow      || [],
            ratiosHistory: ratiosHistory || [],
        };
    }

    /**
     * QUARTERLY - Same structure, quarterly period, 8 quarters shown.
     * Called only when user clicks "Quarterly". Results cached separately.
     * Total: 5 requests (no ratios-ttm / key-metrics-ttm re-fetched — already cached from annual)
     */
    async getFullScreenerDataQuarterly(symbol) {
        const requests = [
            { endpoint: `/income-statement`,        params: { symbol, period: 'quarter', limit: 8 } },
            { endpoint: `/balance-sheet-statement`, params: { symbol, period: 'quarter', limit: 8 } },
            { endpoint: `/cash-flow-statement`,     params: { symbol, period: 'quarter', limit: 8 } },
            { endpoint: `/ratios`,                  params: { symbol, period: 'quarter', limit: 8 } },
        ];

        const [income, balance, cashflow, ratiosHistory] = await this.batchRequest(requests);

        // Reuse already-cached annual data for profile/quote/ratios/metrics
        const annualCacheKey = this.getCacheKey(`/quote`, { symbol });
        const quoteData = (() => {
            const c = this.getFromCache(annualCacheKey);
            return Array.isArray(c) ? c[0] : (c || {});
        })();

        const ratiosCacheKey = this.getCacheKey(`/ratios-ttm`, { symbol });
        const ratios = (() => {
            const c = this.getFromCache(ratiosCacheKey);
            return Array.isArray(c) ? c[0] : (c || null);
        })();

        const metricsCacheKey = this.getCacheKey(`/key-metrics-ttm`, { symbol });
        const metrics = (() => {
            const c = this.getFromCache(metricsCacheKey);
            return Array.isArray(c) ? c[0] : (c || null);
        })();

        return {
            profile: {
                symbol:      quoteData.symbol    || symbol,
                companyName: quoteData.name       || symbol,
                sector:      quoteData.sector     || 'N/A',
                industry:    quoteData.industry   || 'N/A',
                mktCap:      quoteData.marketCap  || 0,
                lastDiv:     quoteData.lastAnnualDividend || 0,
            },
            quote:         quoteData,
            ratios:        ratios,
            metrics:       metrics,
            income:        income        || [],
            balance:       balance       || [],
            cashflow:      cashflow      || [],
            ratiosHistory: ratiosHistory || [],
        };
    }

    // ===== LEGACY METHODS (kept for DCF & Valorisation pages) =====

    async getScreenerData(symbol) {
        return this.getFullScreenerData(symbol);
    }

    async getDCFData(symbol) {
        const requests = [
            { endpoint: `/quote`,                   params: { symbol } },
            { endpoint: `/cash-flow-statement`,     params: { symbol, limit: 10 } },
            { endpoint: `/income-statement`,        params: { symbol, limit: 10 } },
            { endpoint: `/financial-growth`,        params: { symbol, limit: 5 } },
            { endpoint: `/discounted-cash-flow`,    params: { symbol } },
        ];
        const [quote, cashFlow, income, growth, dcf] = await this.batchRequest(requests);
        const quoteData = Array.isArray(quote) ? quote[0] : (quote || {});
        return {
            profile: { symbol: quoteData.symbol || symbol, companyName: quoteData.name || symbol },
            quote: quoteData,
            cashFlow: cashFlow || [],
            income:   income   || [],
            growth:   growth   || [],
            dcf:      Array.isArray(dcf) ? dcf[0] : (dcf || null),
        };
    }

    async getValorisationData(symbol) {
        const requests = [
            { endpoint: `/quote`,                   params: { symbol } },
            { endpoint: `/ratios-ttm`,              params: { symbol } },
            { endpoint: `/key-metrics-ttm`,         params: { symbol } },
            { endpoint: `/ratios`,                  params: { symbol, limit: 5 } },
            { endpoint: `/income-statement`,        params: { symbol, limit: 5 } },
            { endpoint: `/cash-flow-statement`,     params: { symbol, limit: 5 } },
        ];
        const [quote, ratiosTTM, metricsTTM, historicalRatios, income, cashFlow] =
            await this.batchRequest(requests);
        const quoteData = Array.isArray(quote) ? quote[0] : (quote || {});
        return {
            profile:          { symbol: quoteData.symbol || symbol, companyName: quoteData.name || symbol },
            quote:            quoteData,
            ratiosTTM:        Array.isArray(ratiosTTM) ? ratiosTTM[0] : (ratiosTTM || null),
            metricsTTM:       Array.isArray(metricsTTM) ? metricsTTM[0] : (metricsTTM || null),
            historicalRatios: historicalRatios || [],
            income:           income    || [],
            cashFlow:         cashFlow  || [],
        };
    }

    // Search
    async searchStocks(query) {
        if (query.length < 1) return [];
        return this.makeRequest(`/search-symbol`, { query, limit: 10 });
    }

    getCacheStats() {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i)?.startsWith('fmp_')) count++;
        }
        return { cachedEntries: count };
    }

    clearAllCache() {
        console.log('🗑️ Clearing all FMP cache...');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('fmp_')) keysToRemove.push(key);
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
}

const fmpAPI = new FMPCache();
window.fmpAPI = fmpAPI;

export default fmpAPI;
