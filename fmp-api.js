// FMP API Manager — FREE PLAN ONLY
// ═══════════════════════════════════════════════════════════════════════
// OPTIMISATIONS :
//   1. Request coalescing  — si deux pages demandent le même endpoint
//      simultanément, UNE SEULE requête réseau part (les autres attendent).
//   2. Cache unifié        — getFullScreenerData est la seule source de
//      vérité ; getRatios / getKeyMetrics / getValorisationData / getDCFData
//      la réutilisent tous sans refetch.
//   3. Quarterly smart     — on ne charge la page N+1 QUE si page N avait
//      (limit) résultats (évite ~9 requêtes vides sur 12).
//   4. Zéro appel aux endpoints payants (/ratios, /key-metrics, etc.)
//      → tout calculé côté client.
//
// Budget réseau par symbole (cold) :
//   Annual   : 5 requêtes  (quote + profile + income + balance + cashflow + growth — 6 en vrai)
//   Quarterly: 4–10 req   (quote + 1–3 pages × 3 statements selon volume de données)
//   DCF/Valori: 0 req extra si annual déjà chargé (même Promise réutilisée)
// ═══════════════════════════════════════════════════════════════════════

class FMPCache {
    constructor() {
        this.API_KEY   = 'RxYKGPJbSbTuLhW15Bdrop3OxJ2tiXDf';
        this.BASE_URL  = 'https://financialmodelingprep.com/api/v3';
        this.CACHE_TTL = 3600000; // 1 heure

        // In-flight deduplication : cacheKey → Promise en cours
        this._inflight = {};

        // Mémo des données annuelles déjà assemblées (memoKey → Promise<data>)
        // Permet à getDCFData, getValorisationData, getRatios, etc. de réutiliser
        // le même fetch sans lancer de nouvelles requêtes réseau.
        this._annual = {};
    }

    // ── Cache localStorage ─────────────────────────────────────────────────────
    _cacheKey(ep, p = {}) {
        const qs = Object.entries(p).sort().map(([k, v]) => `${k}=${v}`).join('&');
        return ('fmp_' + ep + '_' + qs).replace(/[^a-zA-Z0-9_=&]/g, '_').substring(0, 200);
    }
    _lsGet(key) {
        try {
            const r = localStorage.getItem(key);
            if (!r) return null;
            const d = JSON.parse(r);
            if (Date.now() - d.ts < this.CACHE_TTL) return d.v;
            localStorage.removeItem(key);
        } catch {}
        return null;
    }
    _lsSet(key, v) {
        try { localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() })); }
        catch (e) {
            if (e.name === 'QuotaExceededError') {
                const entries = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('fmp_')) {
                        try { entries.push({ k, ts: JSON.parse(localStorage.getItem(k)).ts }); } catch {}
                    }
                }
                entries.sort((a, b) => a.ts - b.ts)
                       .slice(0, Math.ceil(entries.length / 2))
                       .forEach(e => localStorage.removeItem(e.k));
                try { localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() })); } catch {}
            }
        }
    }

    // ── Fetch de base avec coalescing ──────────────────────────────────────────
    // Si le même endpoint+params est déjà en vol, on retourne la même Promise.
    async _fetch(endpoint, params = {}) {
        const lsKey = this._cacheKey(endpoint, params);

        // 1. Cache localStorage (données fraîches < 1h)
        const cached = this._lsGet(lsKey);
        if (cached !== null) return cached;

        // 2. Dedup : si une requête identique est déjà en cours, on attend la même
        if (this._inflight[lsKey]) return this._inflight[lsKey];

        const url = this.BASE_URL + endpoint + '?' +
                    new URLSearchParams(Object.assign({}, params, { apikey: this.API_KEY }));
        console.log('🌐 FMP:', url);

        this._inflight[lsKey] = fetch(url)
            .then(async res => {
                if (!res.ok) throw new Error('FMP ' + res.status + ': ' + endpoint);
                const data = await res.json();
                if (data && data['Error Message']) throw new Error(data['Error Message']);
                this._lsSet(lsKey, data);
                return data;
            })
            .finally(() => { delete this._inflight[lsKey]; });

        return this._inflight[lsKey];
    }

    // Alias public (rétrocompatibilité)
    async makeRequest(endpoint, params = {}) { return this._fetch(endpoint, params); }

    // ── Helpers mathématiques ──────────────────────────────────────────────────
    _s(v) { return (v != null && isFinite(v)) ? +v : null; }
    _d(a, b) {
        const sa = this._s(a), sb = this._s(b);
        return (sa != null && sb != null && sb !== 0) ? sa / sb : null;
    }

    // ── Calcul des ratios (client-side, 0 requête) ─────────────────────────────
    _computeRatios(q, inc0, cf0, bal0) {
        const s = this._s.bind(this), d = this._d.bind(this);
        const price  = s(q.price);
        const shares = s(inc0.weightedAverageShsOutDil) || s(inc0.weightedAverageShsOut) || s(q.sharesOutstanding);
        const eps    = s(inc0.epsdiluted) || s(inc0.eps) || s(q.eps);
        const rev    = s(inc0.revenue);
        const ni     = s(inc0.netIncome);
        const gp     = s(inc0.grossProfit);
        const op     = s(inc0.operatingIncome);
        const da     = s(cf0.depreciationAndAmortization) || s(inc0.depreciationAndAmortization) || 0;
        const ebitda = s(inc0.ebitda) || (op != null ? op + da : null);
        const fcf    = s(cf0.freeCashFlow);
        const ocf    = s(cf0.operatingCashFlow);
        const fcfPS  = d(fcf, shares);
        const ocfPS  = d(ocf, shares);
        const revPS  = d(rev, shares);
        const bvPS   = d(s(bal0.totalStockholdersEquity), shares);
        const debt   = s(bal0.totalDebt) || 0;
        const cash   = s(bal0.cashAndCashEquivalents) || s(bal0.cashAndShortTermInvestments) || 0;
        const mktCap = (price && shares) ? price * shares : (s(q.marketCap) || 0);
        const ev     = mktCap + debt - cash;
        const equity = s(bal0.totalStockholdersEquity);
        const assets = s(bal0.totalAssets);
        const curA   = s(bal0.totalCurrentAssets);
        const curL   = s(bal0.totalCurrentLiabilities);
        const inv    = s(bal0.inventory) || 0;
        const ic     = (equity || 0) + debt - cash;
        const ce     = (assets || 0) - (curL || 0);

        const pe    = (price && eps   && eps   > 0) ? price / eps   : null;
        const pfcf  = (price && fcfPS && fcfPS > 0) ? price / fcfPS : null;
        const pocf  = (price && ocfPS && ocfPS > 0) ? price / ocfPS : null;
        const ps    = (price && revPS && revPS > 0)  ? price / revPS : null;
        const pb    = (price && bvPS  && bvPS  > 0)  ? price / bvPS  : null;
        const evEb  = (ev && ebitda && ebitda > 0)   ? ev / ebitda   : null;
        const roe   = d(ni, equity);
        const roa   = d(ni, assets);
        const roic  = (ni != null && ic > 0) ? ni / ic : null;
        const roce  = (op != null && ce > 0) ? op / ce : null;
        const curR  = d(curA, curL);
        const qkR   = (curL && curL > 0) ? (curA - inv) / curL : null;
        const deR   = d(debt, equity);
        const divAnn = s(q.lastAnnualDividend) || 0;
        const divY  = (price && price > 0 && divAnn > 0) ? divAnn / price : null;
        const payR  = (eps  && eps  > 0 && divAnn > 0)   ? divAnn / eps   : null;
        const eyld  = pe   && pe   > 0 ? 1 / pe   : null;
        const fyld  = pfcf && pfcf > 0 ? 1 / pfcf : null;
        const repA  = Math.abs(s(cf0.commonStockRepurchased) || 0);
        const buyY  = (mktCap > 0 && repA > 0) ? repA / mktCap : null;
        const graham = (eps && eps > 0 && bvPS && bvPS > 0) ? Math.sqrt(22.5 * eps * bvPS) : null;

        const r = {
            priceEarningsRatio:             pe,
            priceToSalesRatio:              ps,
            priceToBookRatio:               pb,
            priceToFreeCashFlowsRatio:      pfcf,
            priceToOperatingCashFlowsRatio: pocf,
            enterpriseValueMultiple:        evEb,
            debtEquityRatio:                deR,
            currentRatio:                   curR,
            quickRatio:                     qkR,
            returnOnEquity:                 roe,
            returnOnAssets:                 roa,
            returnOnCapitalEmployed:        roic,
            returnOnCapitalEmployedRoce:    roce,
            grossProfitMargin:              d(gp, rev),
            operatingProfitMargin:          d(op, rev),
            netProfitMargin:                d(ni, rev),
            freeCashFlowMargin:             d(fcf, rev),
            ebitdaMargin:                   d(ebitda, rev),
            dividendYield:                  divY,
            payoutRatio:                    payR,
            earningsYield:                  eyld,
            freeCashFlowYield:              fyld,
            buybackYield:                   buyY,
            grahamNumber:                   graham,
            freeCashFlowPerShare:           fcfPS,
            operatingCashFlowPerShare:      ocfPS,
            revenuePerShare:                revPS,
            bookValuePerShare:              bvPS,
            priceEarningsToGrowthRatio:     null,
            _computed: true,
        };
        // Aliases TTM (score engine)
        [
            ['priceEarningsRatioTTM',              pe],
            ['priceToSalesRatioTTM',               ps],
            ['priceToBookRatioTTM',                pb],
            ['priceToFreeCashFlowsRatioTTM',       pfcf],
            ['priceToOperatingCashFlowsRatioTTM',  pocf],
            ['enterpriseValueMultipleTTM',         evEb],
            ['debtEquityRatioTTM',                 deR],
            ['currentRatioTTM',                    curR],
            ['quickRatioTTM',                      qkR],
            ['returnOnEquityTTM',                  roe],
            ['returnOnAssetsTTM',                  roa],
            ['roicTTM',                            roic],
            ['returnOnCapitalEmployedTTM',         roce],
            ['grossProfitMarginTTM',               d(gp, rev)],
            ['operatingProfitMarginTTM',           d(op, rev)],
            ['netProfitMarginTTM',                 d(ni, rev)],
            ['dividendYieldTTM',                   divY],
            ['payoutRatioTTM',                     payR],
            ['earningsYieldTTM',                   eyld],
            ['freeCashFlowYieldTTM',               fyld],
            ['pegRatioTTM',                        null],
        ].forEach(([k, v]) => { r[k] = v; });
        return r;
    }

    _computeMetrics(q, inc0, cf0, bal0, ratios) {
        const s = this._s.bind(this), d = this._d.bind(this);
        const price  = s(q.price);
        const shares = s(inc0.weightedAverageShsOutDil) || s(inc0.weightedAverageShsOut) || s(q.sharesOutstanding);
        const fcf    = s(cf0.freeCashFlow);
        const ocf    = s(cf0.operatingCashFlow);
        const rev    = s(inc0.revenue);
        const ni     = s(inc0.netIncome);
        const op     = s(inc0.operatingIncome);
        const da     = s(cf0.depreciationAndAmortization) || 0;
        const ebitda = s(inc0.ebitda) || (op != null ? op + da : null);
        const debt   = s(bal0.totalDebt) || 0;
        const cash   = s(bal0.cashAndCashEquivalents) || 0;
        const mktCap = (price && shares) ? price * shares : s(q.marketCap);
        const ev     = (mktCap || 0) + debt - cash;
        return {
            marketCap:                 mktCap,
            enterpriseValue:           ev,
            freeCashFlowPerShare:      d(fcf, shares),
            operatingCashFlowPerShare: d(ocf, shares),
            revenuePerShare:           d(rev, shares),
            netIncomePerShare:         d(ni, shares),
            bookValuePerShare:         d(s(bal0.totalStockholdersEquity), shares),
            earningsPerShare:          s(inc0.epsdiluted) || s(inc0.eps) || s(q.eps),
            grahamNumber:              ratios.grahamNumber,
            roe:                       ratios.returnOnEquity,
            roa:                       ratios.returnOnAssets,
            roic:                      ratios.returnOnCapitalEmployed,
            returnOnTangibleAssets:    null,
            evToSales:                 d(ev, rev),
            evToEbitda:                (ev && ebitda && ebitda > 0) ? ev / ebitda : null,
            evToFreeCashFlow:          d(ev, fcf),
            debtToEquity:              ratios.debtEquityRatio,
            debtToAssets:              d(debt, s(bal0.totalAssets)),
            netDebtToEBITDA:           (ebitda && ebitda > 0) ? (debt - cash) / ebitda : null,
            interestCoverage:          d(op, s(inc0.interestExpense)),
            buybackYield:              ratios.buybackYield,
            earningsYield:             ratios.earningsYield,
            freeCashFlowYield:         ratios.freeCashFlowYield,
            piotroskiScore:            null,
            _computed: true,
        };
    }

    _buildRatiosHistory(q, incArr, cfArr, balArr) {
        const s = this._s.bind(this), d = this._d.bind(this);
        return incArr.map((inc, i) => {
            const cf  = cfArr[i]  || {};
            const bal = balArr[i] || {};
            const price  = (i === 0) ? s(q.price) : null;
            const shares = s(inc.weightedAverageShsOutDil) || s(inc.weightedAverageShsOut);
            const eps    = s(inc.epsdiluted) || s(inc.eps);
            const fcfPS  = d(s(cf.freeCashFlow), shares);
            const ocfPS  = d(s(cf.operatingCashFlow), shares);
            const revPS  = d(s(inc.revenue), shares);
            const bvPS   = d(s(bal.totalStockholdersEquity), shares);
            const ni     = s(inc.netIncome);
            const gp     = s(inc.grossProfit);
            const op     = s(inc.operatingIncome);
            const da     = s(cf.depreciationAndAmortization) || 0;
            const ebitda = s(inc.ebitda) || (op != null ? op + da : null);
            const fcf    = s(cf.freeCashFlow);
            const rev    = s(inc.revenue);
            const debt   = s(bal.totalDebt) || 0;
            const cash   = s(bal.cashAndCashEquivalents) || s(bal.cashAndShortTermInvestments) || 0;
            const mktCap = (price && shares) ? price * shares : null;
            const ev     = mktCap != null ? mktCap + debt - cash : null;
            const equity = s(bal.totalStockholdersEquity);
            const assets = s(bal.totalAssets);
            const curA   = s(bal.totalCurrentAssets);
            const curL   = s(bal.totalCurrentLiabilities);
            return {
                date: inc.date,
                priceEarningsRatio:             (price && eps   && eps   > 0) ? price / eps   : null,
                priceToSalesRatio:              (price && revPS && revPS > 0) ? price / revPS : null,
                priceToBookRatio:               (price && bvPS  && bvPS  > 0) ? price / bvPS  : null,
                priceToFreeCashFlowsRatio:      (price && fcfPS && fcfPS > 0) ? price / fcfPS : null,
                priceToOperatingCashFlowsRatio: (price && ocfPS && ocfPS > 0) ? price / ocfPS : null,
                enterpriseValueMultiple:        (ev && ebitda && ebitda > 0)  ? ev / ebitda   : null,
                evToSales:                      (ev && rev && rev > 0)        ? ev / rev       : null,
                returnOnEquity:    d(ni, equity),
                returnOnAssets:    d(ni, assets),
                grossProfitMargin: d(gp, rev),
                operatingProfitMargin: d(op, rev),
                netProfitMargin:   d(ni, rev),
                freeCashFlowMargin: d(fcf, rev),
                currentRatio:      d(curA, curL),
                debtEquityRatio:   d(debt, equity),
                freeCashFlowPerShare: fcfPS,
                revenuePerShare:   revPS,
                bookValuePerShare: bvPS,
                earningsYield:     (price && eps   && eps   > 0) ? eps   / price : null,
                freeCashFlowYield: (price && fcfPS && fcfPS > 0) ? fcfPS / price : null,
                dividendYield:     null,
                payoutRatio:       null,
                _computed: true,
            };
        });
    }

    // ── Couche de données unifiée ──────────────────────────────────────────────
    // Source de vérité unique : 6 req réseau en parallèle (cold), 0 (warm).
    // Toutes les méthodes publiques appellent _loadAnnual() — elles réutilisent
    // la même Promise et donc le même résultat sans aucun refetch.
    _loadAnnual(symbol, limit = 10) {
        const memoKey = symbol + '_' + limit;
        if (this._annual[memoKey]) return this._annual[memoKey];

        this._annual[memoKey] = Promise.all([
            this._fetch('/quote/'                   + symbol),
            this._fetch('/profile/'                 + symbol).catch(() => [{}]),
            this._fetch('/income-statement/'        + symbol, { limit }).catch(() => []),
            this._fetch('/cash-flow-statement/'     + symbol, { limit }).catch(() => []),
            this._fetch('/balance-sheet-statement/' + symbol, { limit }).catch(() => []),
            this._fetch('/financial-growth/'        + symbol, { limit }).catch(() => []),
        ]).then(([qRaw, profRaw, incRaw, cfRaw, balRaw, grwRaw]) => {
            const q   = Array.isArray(qRaw)   ? (qRaw[0]   || {}) : (qRaw   || {});
            const p   = Array.isArray(profRaw) ? (profRaw[0] || {}) : (profRaw || {});
            const inc = Array.isArray(incRaw) ? incRaw : [];
            const cf  = Array.isArray(cfRaw)  ? cfRaw  : [];
            const bal = Array.isArray(balRaw) ? balRaw : [];
            const grw = Array.isArray(grwRaw) ? grwRaw : [];
            if (!q.price && !inc.length) throw new Error('Aucune donnée pour "' + symbol + '"');
            const ratios        = this._computeRatios(q, inc[0] || {}, cf[0] || {}, bal[0] || {});
            const metrics       = this._computeMetrics(q, inc[0] || {}, cf[0] || {}, bal[0] || {}, ratios);
            const ratiosHistory = this._buildRatiosHistory(q, inc, cf, bal);
            const profile = {
                symbol,
                companyName:       p.companyName  || q.name || q.companyName || symbol,
                sector:            p.sector       || q.sector       || 'N/A',
                industry:          p.industry     || q.industry     || 'N/A',
                exchangeShortName: p.exchangeShortName || q.exchange || '',
                mktCap:            p.mktCap       || q.marketCap    || 0,
                lastDiv:           p.lastDiv      || q.lastAnnualDividend || 0,
                website:           p.website      || '',
                description:       p.description  || '',
                ceo:               p.ceo          || '',
                image:             p.image        || q.image        || '',
            };
            return {
                profile, quote: q, ratios, metrics,
                income: inc, balance: bal, cashflow: cf,
                ratiosHistory, metricsHistory: ratiosHistory, growth: grw,
            };
        }).catch(err => {
            delete this._annual[memoKey]; // autorise un retry après erreur
            throw err;
        });

        return this._annual[memoKey];
    }

    // ── API publique ───────────────────────────────────────────────────────────

    /** 6 req réseau (cold) / 0 (warm) */
    async getFullScreenerData(symbol)  { return this._loadAnnual(symbol, 10); }
    async getScreenerData(symbol)      { return this.getFullScreenerData(symbol); }

    /** 0 req extra — réutilise _loadAnnual */
    async getRatios(sym)               { return (await this._loadAnnual(sym, 10)).ratiosHistory; }
    async getFinancialRatios(sym)      { return this.getRatios(sym); }

    /** 0 req extra */
    async getKeyMetrics(sym)           { return (await this._loadAnnual(sym, 10)).metricsHistory; }

    /** 0 req extra */
    async getDCFData(symbol) {
        const d = await this._loadAnnual(symbol, 10);
        return { profile: d.profile, quote: d.quote, cashFlow: d.cashflow, income: d.income, growth: d.growth };
    }

    /** 0 req extra */
    async getValorisationData(symbol) {
        const d = await this._loadAnnual(symbol, 10);
        return {
            profile:           d.profile,
            quote:             d.quote,
            ratiosTTM:         d.ratios,
            metricsTTM:        d.metrics,
            historicalRatios:  d.ratiosHistory,
            historicalMetrics: d.metricsHistory,
            income:            d.income,
            cashFlow:          d.cashflow,
            growth:            d.growth,
        };
    }

    /** Smart pagination : s'arrête dès qu'une page est incomplète.
     *  Économise jusqu'à 9 requêtes sur les petites/moyennes caps. */
    async getFullScreenerDataQuarterly(symbol) {
        const LIMIT = 5;
        const dedup = arr => {
            const seen = new Set();
            return (Array.isArray(arr) ? arr : []).filter(r => r && r.date && !seen.has(r.date) && seen.add(r.date));
        };
        const fetchPages = async (ep) => {
            const all = [];
            for (let page = 0; page <= 3; page++) {
                const rows = await this._fetch(ep, { period: 'quarter', limit: LIMIT, page }).catch(() => []);
                const arr  = Array.isArray(rows) ? rows : [];
                all.push(...arr);
                if (arr.length < LIMIT) break; // page incomplète → on arrête
            }
            return dedup(all);
        };

        const qRaw = await this._fetch('/quote/' + symbol);
        const q    = Array.isArray(qRaw) ? (qRaw[0] || {}) : (qRaw || {});

        const [inc, cf, bal] = await Promise.all([
            fetchPages('/income-statement/'        + symbol),
            fetchPages('/cash-flow-statement/'     + symbol),
            fetchPages('/balance-sheet-statement/' + symbol),
        ]);

        const ratios  = this._computeRatios(q, inc[0] || {}, cf[0] || {}, bal[0] || {});
        const metrics = this._computeMetrics(q, inc[0] || {}, cf[0] || {}, bal[0] || {}, ratios);
        const ratiosHistory = this._buildRatiosHistory(q, inc, cf, bal);

        return {
            profile: {
                symbol,
                companyName:       q.name || symbol,
                sector:            q.sector || 'N/A',
                industry:          q.industry || 'N/A',
                exchangeShortName: q.exchange || '',
                mktCap:            q.marketCap || 0,
                lastDiv:           q.lastAnnualDividend || 0,
            },
            quote: q, ratios, metrics,
            income: inc, balance: bal, cashflow: cf,
            ratiosHistory, metricsHistory: ratiosHistory, growth: [],
        };
    }

    /** /search est 403 sur plan gratuit → fallback ticker exact */
    async searchStocks(query) {
        if (!query) return [];
        try { return await this._fetch('/search', { query, limit: 10 }); }
        catch {
            const sym = query.toUpperCase().trim();
            if (/^[A-Z]{1,5}$/.test(sym)) {
                try {
                    const prof = await this._fetch('/profile/' + sym);
                    if (Array.isArray(prof) && prof.length) {
                        return prof.map(p => ({ symbol: p.symbol, name: p.companyName, exchangeShortName: p.exchangeShortName || '' }));
                    }
                } catch {}
            }
            return [];
        }
    }

    /** /historical/stock_dividend est 403 sur plan gratuit → tableau vide */
    async getDividendHistory(sym) {
        try { return await this._fetch('/historical/stock_dividend/' + sym); }
        catch { return { historical: [] }; }
    }

    // ── Accès bas-niveau (rétrocompatibilité) ──────────────────────────────────
    async getQuote(sym)                   { return this._fetch('/quote/'                   + sym); }
    async getProfile(sym)                 { return this._fetch('/profile/'                 + sym); }
    async getIncomeStatement(sym, l = 5)  { return this._fetch('/income-statement/'        + sym, { limit: l }); }
    async getBalanceSheet(sym, l = 5)     { return this._fetch('/balance-sheet-statement/' + sym, { limit: l }); }
    async getCashFlow(sym, l = 5)         { return this._fetch('/cash-flow-statement/'     + sym, { limit: l }); }
    async getFinancialGrowth(sym, l = 5)  { return this._fetch('/financial-growth/'        + sym, { limit: l }); }

    // ── Utilitaires cache ──────────────────────────────────────────────────────
    clearAllCache() {
        const rm = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('fmp_')) rm.push(k);
        }
        rm.forEach(k => localStorage.removeItem(k));
        this._annual = {};
        console.log('🗑️ FMP cache effacé (' + rm.length + ' entrées localStorage + mémo mémoire)');
    }
    getCacheStats() {
        let n = 0;
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i) && localStorage.key(i).startsWith('fmp_')) n++;
        }
        return { cachedEntries: n, memoizedSymbols: Object.keys(this._annual) };
    }
}

const fmpAPI = new FMPCache();
window.fmpAPI = fmpAPI;
