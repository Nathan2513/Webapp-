// FMP API Manager with Intelligent Caching
// Architecture: /api/v3/{endpoint}/{symbol} (free plan compatible)

class FMPCache {
    constructor() {
        this.API_KEY  = 'RxYKGPJbSbTuLhW15Bdrop3OxJ2tiXDf';
        this.BASE_URL = 'https://financialmodelingprep.com/api/v3';
        this.CACHE_DURATION = 3600000; // 1h
    }

    // ── Cache helpers ──────────────────────────────────────────────────────────
    getCacheKey(endpoint, params = {}) {
        const p = Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`).join('&');
        return `fmp_v3_${endpoint}_${p}`;
    }

    isCacheValid(d) { return d && (Date.now() - d.ts) < this.CACHE_DURATION; }

    getFromCache(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const d = JSON.parse(raw);
            if (this.isCacheValid(d)) { console.log(`✅ cache: ${key}`); return d.v; }
            localStorage.removeItem(key);
            return null;
        } catch { return null; }
    }

    saveToCache(key, v) {
        try {
            localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() }));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                this.clearOldCache();
                try { localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() })); } catch {}
            }
        }
    }

    clearOldCache() {
        const now = Date.now(), rm = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith('fmp_')) {
                try { const d = JSON.parse(localStorage.getItem(k)); if (now - d.ts > this.CACHE_DURATION) rm.push(k); }
                catch { rm.push(k); }
            }
        }
        rm.forEach(k => localStorage.removeItem(k));
    }

    // ── Core fetch ─────────────────────────────────────────────────────────────
    // symbol must be embedded in `endpoint` path already, e.g. '/income-statement/AAPL'
    async makeRequest(endpoint, params = {}) {
        // AUTO-FIX: if old-style call passes symbol as param, move it to path
        let ep = endpoint;
        if (params.symbol && !endpoint.includes(params.symbol)) {
            const { symbol, ...rest } = params;
            ep = `${endpoint}/${symbol}`;
            params = rest;
        }

        const cacheKey = this.getCacheKey(ep, params);
        const cached = this.getFromCache(cacheKey);
        if (cached !== null) return cached;

        const qs = new URLSearchParams({ ...params, apikey: this.API_KEY }).toString();
        const url = `${this.BASE_URL}${ep}?${qs}`;
        console.log(`🌐 FMP: ${url}`);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`FMP ${res.status}: ${ep}`);
        const data = await res.json();
        if (data?.['Error Message']) throw new Error(data['Error Message']);

        this.saveToCache(cacheKey, data);
        return data;
    }

    async batchRequest(requests) {
        return Promise.all(requests.map(r =>
            this.makeRequest(r.endpoint, r.params || {}).catch(err => {
                console.error(`Batch fail [${r.endpoint}]:`, err.message);
                return null;
            })
        ));
    }

    // ── Individual endpoints ───────────────────────────────────────────────────
    async getQuote(symbol)              { return this.makeRequest(`/quote/${symbol}`); }
    async getIncomeStatement(sym, l=5)  { return this.makeRequest(`/income-statement/${sym}`, { limit: l }); }
    async getBalanceSheet(sym, l=5)     { return this.makeRequest(`/balance-sheet-statement/${sym}`, { limit: l }); }
    async getCashFlow(sym, l=5)         { return this.makeRequest(`/cash-flow-statement/${sym}`, { limit: l }); }
    async getFinancialGrowth(sym, l=5)  { return this.makeRequest(`/financial-growth/${sym}`, { limit: l }); }
    async getKeyMetrics(sym, l=5)       { return this.makeRequest(`/key-metrics/${sym}`, { limit: l }); }
    async getRatios(sym, l=5)           { return this.makeRequest(`/ratios/${sym}`, { limit: l }); }
    async getDividendHistory(sym)       { return this.makeRequest(`/historical/stock_dividend/${sym}`); }

    // Search: symbol goes in ?query= (no path segment)
    async searchStocks(query) {
        if (!query) return [];
        return this.makeRequest(`/search`, { query, limit: 10 });
    }

    // ── DCF data ───────────────────────────────────────────────────────────────
    async getDCFData(symbol) {
        const [qRaw, cfRaw, incRaw, grwRaw] = await this.batchRequest([
            { endpoint: `/quote/${symbol}` },
            { endpoint: `/cash-flow-statement/${symbol}`,  params: { limit: 10 } },
            { endpoint: `/income-statement/${symbol}`,     params: { limit: 10 } },
            { endpoint: `/financial-growth/${symbol}`,     params: { limit: 10 } },
        ]);
        const q   = Array.isArray(qRaw)   ? qRaw[0]  : (qRaw   || {});
        const cf  = Array.isArray(cfRaw)  ? cfRaw    : [];
        const inc = Array.isArray(incRaw) ? incRaw   : [];
        const grw = Array.isArray(grwRaw) ? grwRaw   : [];
        return {
            profile: { symbol, companyName: q.name||symbol, sector: q.sector||'N/A', industry: q.industry||'N/A', mktCap: q.marketCap||0, lastDiv: q.lastAnnualDividend||0 },
            quote: q, cashFlow: cf, income: inc, growth: grw,
        };
    }

    // ── Screener data (annual) ─────────────────────────────────────────────────
    async getFullScreenerData(symbol) {
        const [qRaw, incRaw, cfRaw, balRaw, grwRaw, ratRaw, kmRaw] = await this.batchRequest([
            { endpoint: `/quote/${symbol}` },
            { endpoint: `/income-statement/${symbol}`,        params: { limit: 5 } },
            { endpoint: `/cash-flow-statement/${symbol}`,     params: { limit: 5 } },
            { endpoint: `/balance-sheet-statement/${symbol}`, params: { limit: 5 } },
            { endpoint: `/financial-growth/${symbol}`,        params: { limit: 5 } },
            { endpoint: `/ratios/${symbol}`,                  params: { limit: 5 } },
            { endpoint: `/key-metrics/${symbol}`,             params: { limit: 5 } },
        ]);
        const q   = Array.isArray(qRaw)   ? qRaw[0]  : (qRaw   || {});
        const inc = Array.isArray(incRaw) ? incRaw   : [];
        const cf  = Array.isArray(cfRaw)  ? cfRaw    : [];
        const bal = Array.isArray(balRaw) ? balRaw   : [];
        const grw = Array.isArray(grwRaw) ? grwRaw   : [];
        const rat = Array.isArray(ratRaw) ? ratRaw   : [];
        const km  = Array.isArray(kmRaw)  ? kmRaw    : [];

        // Most recent rows
        const rttm = rat[0] || {};
        const kttm = km[0]  || {};

        return {
            profile: {
                symbol, companyName: q.name||q.companyName||symbol,
                sector: q.sector||'N/A', industry: q.industry||'N/A',
                exchangeShortName: q.exchange||'', mktCap: q.marketCap||0,
                lastDiv: q.lastAnnualDividend||0,
            },
            quote:          q,
            ratios:         rttm,   // most recent /ratios row
            metrics:        kttm,   // most recent /key-metrics row
            income:         inc,
            balance:        bal,
            cashflow:       cf,
            ratiosHistory:  rat,    // full history for score engine & valuation charts
            metricsHistory: km,     // full key-metrics history
            growth:         grw,
        };
    }

    async getScreenerData(symbol) { return this.getFullScreenerData(symbol); }

    // ── Screener data (quarterly) ─────────────────────────────────────────────
    async getFullScreenerDataQuarterly(symbol) {
        const pages = [0, 1, 2, 3];
        const dedupe = arr => {
            const seen = new Set();
            return (Array.isArray(arr) ? arr : []).filter(r => r?.date && !seen.has(r.date) && seen.add(r.date));
        };

        const [qRaw, incPages, cfPages, balPages, ratRaw, kmRaw] = await Promise.all([
            this.makeRequest(`/quote/${symbol}`),
            Promise.all(pages.map(p => this.makeRequest(`/income-statement/${symbol}`,        { period: 'quarter', limit: 5, page: p }).catch(() => []))),
            Promise.all(pages.map(p => this.makeRequest(`/cash-flow-statement/${symbol}`,     { period: 'quarter', limit: 5, page: p }).catch(() => []))),
            Promise.all(pages.map(p => this.makeRequest(`/balance-sheet-statement/${symbol}`, { period: 'quarter', limit: 5, page: p }).catch(() => []))),
            this.makeRequest(`/ratios/${symbol}`,      { limit: 5 }).catch(() => []),
            this.makeRequest(`/key-metrics/${symbol}`, { limit: 5 }).catch(() => []),
        ]);

        const q   = Array.isArray(qRaw) ? qRaw[0] : (qRaw || {});
        const inc = dedupe(incPages.flat());
        const cf  = dedupe(cfPages.flat());
        const bal = dedupe(balPages.flat());
        const rat = Array.isArray(ratRaw) ? ratRaw : [];
        const km  = Array.isArray(kmRaw)  ? kmRaw  : [];

        return {
            profile: {
                symbol, companyName: q.name||q.companyName||symbol,
                sector: q.sector||'N/A', industry: q.industry||'N/A',
                exchangeShortName: q.exchange||'', mktCap: q.marketCap||0,
                lastDiv: q.lastAnnualDividend||0,
            },
            quote:          q,
            ratios:         rat[0] || {},
            metrics:        km[0]  || {},
            income:         inc,
            balance:        bal,
            cashflow:       cf,
            ratiosHistory:  rat,
            metricsHistory: km,
            growth:         [],
        };
    }

    // ── Valorisation data ──────────────────────────────────────────────────────
    async getValorisationData(symbol) {
        const [qRaw, incRaw, cfRaw, grwRaw, ratRaw, kmRaw] = await this.batchRequest([
            { endpoint: `/quote/${symbol}` },
            { endpoint: `/income-statement/${symbol}`,    params: { limit: 5 } },
            { endpoint: `/cash-flow-statement/${symbol}`, params: { limit: 5 } },
            { endpoint: `/financial-growth/${symbol}`,    params: { limit: 5 } },
            { endpoint: `/ratios/${symbol}`,              params: { limit: 5 } },
            { endpoint: `/key-metrics/${symbol}`,         params: { limit: 5 } },
        ]);
        const q   = Array.isArray(qRaw)   ? qRaw[0]  : (qRaw   || {});
        const inc = Array.isArray(incRaw) ? incRaw   : [];
        const cf  = Array.isArray(cfRaw)  ? cfRaw    : [];
        const grw = Array.isArray(grwRaw) ? grwRaw   : [];
        const rat = Array.isArray(ratRaw) ? ratRaw   : [];
        const km  = Array.isArray(kmRaw)  ? kmRaw    : [];

        return {
            profile:          { symbol, companyName: q.name||symbol },
            quote:            q,
            ratiosTTM:        rat[0] || null,
            metricsTTM:       km[0]  || null,
            historicalRatios: rat,
            historicalMetrics: km,
            income:           inc,
            cashFlow:         cf,
            growth:           grw,
        };
    }

    // ── Cache utils ────────────────────────────────────────────────────────────
    getCacheStats() {
        let n = 0;
        for (let i = 0; i < localStorage.length; i++) { if (localStorage.key(i)?.startsWith('fmp_')) n++; }
        return { cachedEntries: n };
    }

    clearAllCache() {
        const rm = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('fmp_')) rm.push(k); }
        rm.forEach(k => localStorage.removeItem(k));
        console.log(`🗑️ Cleared ${rm.length} FMP cache entries`);
    }
}

const fmpAPI = new FMPCache();
window.fmpAPI = fmpAPI;

export default fmpAPI;
