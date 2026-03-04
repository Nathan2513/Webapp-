// FMP API Manager — NEW /stable/ API
// ═══════════════════════════════════════════════════════════════════════
// Uses the new FMP /stable/ endpoints (not legacy /api/v3/)
// Format: /stable/income-statement?symbol=AAPL&limit=5&apikey=...
//
// FIXES vs previous version:
//   1. NO "export default" at the bottom → fixes SyntaxError on import
//      (loaded via <script src="fmp-api.js">, sets window.fmpAPI)
//   2. /ratios and /key-metrics computed client-side if they 403
//   3. Request coalescing + memory memo to avoid duplicate fetches
//
// Budget réseau par symbole (cold) :
//   Annual   : 7 req (quote + ratios-ttm + key-metrics-ttm + income + balance + cashflow + ratios)
//   Quarterly: 4 req extra (income/balance/cashflow/ratios quarterly)
//   DCF/Valori: 0 req extra if annual already loaded
// ═══════════════════════════════════════════════════════════════════════

class FMPCache {
    constructor() {
        this.API_KEY      = 'RxYKGPJbSbTuLhW15Bdrop3OxJ2tiXDf';
        this.BASE_URL     = 'https://financialmodelingprep.com/stable';
        this.CACHE_TTL    = 3600000; // 1h
        this._inflight    = {};      // request coalescing
        this._annual      = {};      // memory memo: symbol → Promise<data>
    }

    // ── Cache localStorage ─────────────────────────────────────────────
    _cacheKey(ep, p = {}) {
        const qs = Object.entries(p).sort().map(([k,v]) => `${k}=${v}`).join('&');
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
                entries.sort((a,b) => a.ts - b.ts)
                       .slice(0, Math.ceil(entries.length / 2))
                       .forEach(e => localStorage.removeItem(e.k));
                try { localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() })); } catch {}
            }
        }
    }

    // ── Core fetch with coalescing ─────────────────────────────────────
    async _fetch(endpoint, params = {}) {
        const lsKey  = this._cacheKey(endpoint, params);
        const cached = this._lsGet(lsKey);
        if (cached !== null) return cached;
        if (this._inflight[lsKey]) return this._inflight[lsKey];

        const url = this.BASE_URL + endpoint + '?' +
                    new URLSearchParams(Object.assign({}, params, { apikey: this.API_KEY }));
        console.log('🌐 FMP:', endpoint, params);

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

    // Public alias (backward compat)
    async makeRequest(endpoint, params = {}) { return this._fetch(endpoint, params); }

    async batchRequest(requests) {
        return Promise.all(requests.map(r =>
            this._fetch(r.endpoint, r.params || {}).catch(err => {
                console.warn('Batch fail [' + r.endpoint + ']:', err.message);
                return null;
            })
        ));
    }

    // ── Math helpers ───────────────────────────────────────────────────
    _s(v) { return (v != null && isFinite(v)) ? +v : null; }
    _d(a, b) {
        const sa = this._s(a), sb = this._s(b);
        return (sa != null && sb != null && sb !== 0) ? sa / sb : null;
    }

    // ── Client-side ratio computation (fallback if /ratios-ttm 403) ───
    _computeRatios(q, inc0, cf0, bal0) {
        const s = this._s.bind(this), d = this._d.bind(this);
        const price  = s(q.price);
        const shares = s(inc0.weightedAverageShsOutDil) || s(inc0.weightedAverageShsOut) || s(q.sharesOutstanding);
        const eps    = s(inc0.epsdiluted) || s(inc0.eps) || s(q.eps);
        const rev    = s(inc0.revenue);
        const ni     = s(inc0.netIncome);
        const gp     = s(inc0.grossProfit);
        const op     = s(inc0.operatingIncome);
        const da     = s(cf0.depreciationAndAmortization) || 0;
        const ebitda = s(inc0.ebitda) || (op != null ? op + da : null);
        const fcf    = s(cf0.freeCashFlow);
        const ocf    = s(cf0.operatingCashFlow);
        const fcfPS  = d(fcf, shares), ocfPS = d(ocf, shares);
        const revPS  = d(rev, shares), bvPS  = d(s(bal0.totalStockholdersEquity), shares);
        const debt   = s(bal0.totalDebt) || 0;
        const cash   = s(bal0.cashAndCashEquivalents) || 0;
        const mktCap = (price && shares) ? price * shares : (s(q.marketCap) || 0);
        const ev     = mktCap + debt - cash;
        const equity = s(bal0.totalStockholdersEquity);
        const assets = s(bal0.totalAssets);
        const curA   = s(bal0.totalCurrentAssets), curL = s(bal0.totalCurrentLiabilities);
        const inv    = s(bal0.inventory) || 0;
        const ic     = (equity || 0) + debt - cash;
        const ce     = (assets || 0) - (curL || 0);
        const pe     = (price && eps   && eps   > 0) ? price / eps   : null;
        const pfcf   = (price && fcfPS && fcfPS > 0) ? price / fcfPS : null;
        const pocf   = (price && ocfPS && ocfPS > 0) ? price / ocfPS : null;
        const ps     = (price && revPS && revPS > 0) ? price / revPS : null;
        const pb     = (price && bvPS  && bvPS  > 0) ? price / bvPS  : null;
        const evEb   = (ev && ebitda && ebitda > 0)  ? ev / ebitda   : null;
        const roe    = d(ni, equity), roa = d(ni, assets);
        const roic   = (ni != null && ic > 0) ? ni / ic : null;
        const roce   = (op != null && ce > 0) ? op / ce : null;
        const curR   = d(curA, curL);
        const qkR    = (curL && curL > 0) ? (curA - inv) / curL : null;
        const deR    = d(debt, equity);
        const divAnn = s(q.lastAnnualDividend) || 0;
        const divY   = (price && price > 0 && divAnn > 0) ? divAnn / price : null;
        const payR   = (eps && eps > 0 && divAnn > 0) ? divAnn / eps : null;
        const eyld   = pe   && pe   > 0 ? 1/pe   : null;
        const fyld   = pfcf && pfcf > 0 ? 1/pfcf : null;
        const repA   = Math.abs(s(cf0.commonStockRepurchased) || 0);
        const buyY   = (mktCap > 0 && repA > 0) ? repA / mktCap : null;
        const graham = (eps && eps > 0 && bvPS && bvPS > 0) ? Math.sqrt(22.5 * eps * bvPS) : null;
        const r = {
            priceEarningsRatio:pe, priceToSalesRatio:ps, priceToBookRatio:pb,
            priceToFreeCashFlowsRatio:pfcf, priceToOperatingCashFlowsRatio:pocf,
            enterpriseValueMultiple:evEb, debtEquityRatio:deR, currentRatio:curR,
            quickRatio:qkR, returnOnEquity:roe, returnOnAssets:roa,
            returnOnCapitalEmployed:roic, returnOnCapitalEmployedRoce:roce,
            grossProfitMargin:d(gp,rev), operatingProfitMargin:d(op,rev),
            netProfitMargin:d(ni,rev), freeCashFlowMargin:d(fcf,rev),
            ebitdaMargin:d(ebitda,rev), dividendYield:divY, payoutRatio:payR,
            earningsYield:eyld, freeCashFlowYield:fyld, buybackYield:buyY,
            grahamNumber:graham, freeCashFlowPerShare:fcfPS,
            operatingCashFlowPerShare:ocfPS, revenuePerShare:revPS, bookValuePerShare:bvPS,
            _computed: true,
        };
        // TTM aliases
        ['priceEarningsRatioTTM','priceToSalesRatioTTM','priceToBookRatioTTM',
         'priceToFreeCashFlowsRatioTTM','priceToOperatingCashFlowsRatioTTM',
         'enterpriseValueMultipleTTM','debtEquityRatioTTM','currentRatioTTM','quickRatioTTM',
         'returnOnEquityTTM','returnOnAssetsTTM','roicTTM','returnOnCapitalEmployedTTM',
         'grossProfitMarginTTM','operatingProfitMarginTTM','netProfitMarginTTM',
         'dividendYieldTTM','payoutRatioTTM','earningsYieldTTM','freeCashFlowYieldTTM',
        ].forEach(k => {
            const base = k.replace('TTM','');
            r[k] = r[base] !== undefined ? r[base] : null;
        });
        return r;
    }

    _computeMetrics(q, inc0, cf0, bal0, ratios) {
        const s = this._s.bind(this), d = this._d.bind(this);
        const price  = s(q.price);
        const shares = s(inc0.weightedAverageShsOutDil) || s(inc0.weightedAverageShsOut) || s(q.sharesOutstanding);
        const fcf    = s(cf0.freeCashFlow), ocf = s(cf0.operatingCashFlow);
        const rev    = s(inc0.revenue), ni = s(inc0.netIncome), op = s(inc0.operatingIncome);
        const da     = s(cf0.depreciationAndAmortization) || 0;
        const ebitda = s(inc0.ebitda) || (op != null ? op + da : null);
        const debt   = s(bal0.totalDebt) || 0, cash = s(bal0.cashAndCashEquivalents) || 0;
        const mktCap = (price && shares) ? price * shares : s(q.marketCap);
        const ev     = (mktCap || 0) + debt - cash;
        return {
            marketCap:mktCap, enterpriseValue:ev,
            freeCashFlowPerShare:d(fcf,shares), operatingCashFlowPerShare:d(ocf,shares),
            revenuePerShare:d(rev,shares), netIncomePerShare:d(ni,shares),
            bookValuePerShare:d(s(bal0.totalStockholdersEquity),shares),
            earningsPerShare:s(inc0.epsdiluted)||s(inc0.eps)||s(q.eps),
            grahamNumber:ratios.grahamNumber, roe:ratios.returnOnEquity,
            roa:ratios.returnOnAssets, roic:ratios.returnOnCapitalEmployed,
            evToSales:d(ev,rev), evToEbitda:(ev&&ebitda&&ebitda>0)?ev/ebitda:null,
            evToFreeCashFlow:d(ev,fcf), debtToEquity:ratios.debtEquityRatio,
            debtToAssets:d(debt,s(bal0.totalAssets)),
            netDebtToEBITDA:(ebitda&&ebitda>0)?(debt-cash)/ebitda:null,
            interestCoverage:d(op,s(inc0.interestExpense)),
            earningsYield:ratios.earningsYield, freeCashFlowYield:ratios.freeCashFlowYield,
            _computed:true,
        };
    }

    _buildRatiosHistory(q, incArr, cfArr, balArr) {
        const s = this._s.bind(this), d = this._d.bind(this);
        return (incArr||[]).map((inc, i) => {
            const cf = (cfArr||[])[i]||{}, bal = (balArr||[])[i]||{};
            const price  = (i===0) ? s(q.price) : null;
            const shares = s(inc.weightedAverageShsOutDil)||s(inc.weightedAverageShsOut);
            const eps    = s(inc.epsdiluted)||s(inc.eps);
            const fcfPS  = d(s(cf.freeCashFlow),shares);
            const ocfPS  = d(s(cf.operatingCashFlow),shares);
            const revPS  = d(s(inc.revenue),shares);
            const bvPS   = d(s(bal.totalStockholdersEquity),shares);
            const ni=s(inc.netIncome),gp=s(inc.grossProfit),op=s(inc.operatingIncome);
            const da=s(cf.depreciationAndAmortization)||0;
            const ebitda=s(inc.ebitda)||(op!=null?op+da:null);
            const fcf=s(cf.freeCashFlow),rev=s(inc.revenue);
            const debt=s(bal.totalDebt)||0,cash=s(bal.cashAndCashEquivalents)||0;
            const mktCap=(price&&shares)?price*shares:null;
            const ev=mktCap!=null?mktCap+debt-cash:null;
            const equity=s(bal.totalStockholdersEquity),assets=s(bal.totalAssets);
            const curA=s(bal.totalCurrentAssets),curL=s(bal.totalCurrentLiabilities);
            return {
                date:inc.date,
                priceEarningsRatio:(price&&eps&&eps>0)?price/eps:null,
                priceToSalesRatio:(price&&revPS&&revPS>0)?price/revPS:null,
                priceToBookRatio:(price&&bvPS&&bvPS>0)?price/bvPS:null,
                priceToFreeCashFlowsRatio:(price&&fcfPS&&fcfPS>0)?price/fcfPS:null,
                priceToOperatingCashFlowsRatio:(price&&ocfPS&&ocfPS>0)?price/ocfPS:null,
                enterpriseValueMultiple:(ev&&ebitda&&ebitda>0)?ev/ebitda:null,
                evToSales:(ev&&rev&&rev>0)?ev/rev:null,
                returnOnEquity:d(ni,equity),returnOnAssets:d(ni,assets),
                grossProfitMargin:d(gp,rev),operatingProfitMargin:d(op,rev),
                netProfitMargin:d(ni,rev),freeCashFlowMargin:d(fcf,rev),
                currentRatio:d(curA,curL),debtEquityRatio:d(debt,equity),
                freeCashFlowPerShare:fcfPS,revenuePerShare:revPS,bookValuePerShare:bvPS,
                earningsYield:(price&&eps&&eps>0)?eps/price:null,
                freeCashFlowYield:(price&&fcfPS&&fcfPS>0)?fcfPS/price:null,
                dividendYield:null,payoutRatio:null,_computed:true,
            };
        });
    }

    // ── Unified data layer ─────────────────────────────────────────────
    // Single source of truth — all public methods reuse this Promise.
    _loadAnnual(symbol) {
        if (this._annual[symbol]) return this._annual[symbol];

        this._annual[symbol] = Promise.all([
            this._fetch('/quote',                    { symbol }),
            this._fetch('/ratios-ttm',               { symbol }).catch(() => null),
            this._fetch('/key-metrics-ttm',          { symbol }).catch(() => null),
            this._fetch('/income-statement',         { symbol, limit: 10 }).catch(() => []),
            this._fetch('/cash-flow-statement',      { symbol, limit: 10 }).catch(() => []),
            this._fetch('/balance-sheet-statement',  { symbol, limit: 10 }).catch(() => []),
            this._fetch('/financial-growth',         { symbol, limit: 10 }).catch(() => []),
            this._fetch('/profile',                  { symbol }).catch(() => []),
        ]).then(([qRaw, ratiosTTMRaw, metricsTTMRaw, incRaw, cfRaw, balRaw, grwRaw, profRaw]) => {
            const q   = Array.isArray(qRaw)      ? (qRaw[0]||{})      : (qRaw||{});
            const p   = Array.isArray(profRaw)   ? (profRaw[0]||{})   : (profRaw||{});
            const inc = Array.isArray(incRaw)    ? incRaw    : [];
            const cf  = Array.isArray(cfRaw)     ? cfRaw     : [];
            const bal = Array.isArray(balRaw)    ? balRaw    : [];
            const grw = Array.isArray(grwRaw)    ? grwRaw    : [];

            // Use API ratios if available, else compute client-side
            let ratios   = Array.isArray(ratiosTTMRaw)  ? ratiosTTMRaw[0]  : (ratiosTTMRaw||null);
            let metrics  = Array.isArray(metricsTTMRaw) ? metricsTTMRaw[0] : (metricsTTMRaw||null);
            if (!ratios  || ratios._computed  === undefined && Object.keys(ratios).length < 5) {
                ratios = this._computeRatios(q, inc[0]||{}, cf[0]||{}, bal[0]||{});
            }
            if (!metrics || metrics._computed === undefined && Object.keys(metrics).length < 5) {
                const r = ratios._computed ? ratios : this._computeRatios(q, inc[0]||{}, cf[0]||{}, bal[0]||{});
                metrics = this._computeMetrics(q, inc[0]||{}, cf[0]||{}, bal[0]||{}, r);
            }

            const ratiosHistory = this._buildRatiosHistory(q, inc, cf, bal);

            const profile = {
                symbol,
                companyName:       p.companyName || q.name || q.companyName || symbol,
                sector:            p.sector      || q.sector      || 'N/A',
                industry:          p.industry    || q.industry    || 'N/A',
                exchangeShortName: p.exchangeShortName || q.exchange || '',
                mktCap:            p.mktCap      || q.marketCap   || 0,
                lastDiv:           p.lastDiv     || q.lastAnnualDividend || 0,
                website:           p.website     || '',
                description:       p.description || '',
                ceo:               p.ceo         || '',
                image:             p.image       || '',
            };

            return {
                profile, quote:q, ratios, metrics,
                income:inc, balance:bal, cashflow:cf,
                ratiosHistory, metricsHistory:ratiosHistory, growth:grw,
            };
        }).catch(err => {
            delete this._annual[symbol];
            throw err;
        });

        return this._annual[symbol];
    }

    // ── Public API ─────────────────────────────────────────────────────

    async getFullScreenerData(symbol)  { return this._loadAnnual(symbol); }
    async getScreenerData(symbol)      { return this.getFullScreenerData(symbol); }
    async getRatios(sym)               { return (await this._loadAnnual(sym)).ratiosHistory; }
    async getFinancialRatios(sym)      { return this.getRatios(sym); }
    async getKeyMetrics(sym)           { return (await this._loadAnnual(sym)).metricsHistory; }

    async getDCFData(symbol) {
        const d = await this._loadAnnual(symbol);
        return {
            profile:  d.profile,
            quote:    d.quote,
            cashFlow: d.cashflow,
            income:   d.income,
            growth:   d.growth,
            dcf:      null, // /discounted-cash-flow computed in DCF page itself
        };
    }

    async getValorisationData(symbol) {
        const d = await this._loadAnnual(symbol);
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

    /** Quarterly — smart pagination, stops when page is incomplete */
    async getFullScreenerDataQuarterly(symbol) {
        const LIMIT = 8;
        const dedup = arr => {
            const seen = new Set();
            return (Array.isArray(arr)?arr:[]).filter(r=>r&&r.date&&!seen.has(r.date)&&seen.add(r.date));
        };
        const fetchPages = async (ep) => {
            const all = [];
            for (let page = 0; page <= 3; page++) {
                const rows = await this._fetch(ep, { symbol, period:'quarter', limit:LIMIT, page }).catch(()=>[]);
                const arr  = Array.isArray(rows) ? rows : [];
                all.push(...arr);
                if (arr.length < LIMIT) break;
            }
            return dedup(all);
        };

        const qRaw = await this._fetch('/quote', { symbol });
        const q    = Array.isArray(qRaw) ? (qRaw[0]||{}) : (qRaw||{});

        const [inc, cf, bal] = await Promise.all([
            fetchPages('/income-statement'),
            fetchPages('/cash-flow-statement'),
            fetchPages('/balance-sheet-statement'),
        ]);

        const ratios  = this._computeRatios(q, inc[0]||{}, cf[0]||{}, bal[0]||{});
        const metrics = this._computeMetrics(q, inc[0]||{}, cf[0]||{}, bal[0]||{}, ratios);
        const ratiosHistory = this._buildRatiosHistory(q, inc, cf, bal);

        return {
            profile: { symbol, companyName:q.name||symbol, sector:q.sector||'N/A', industry:q.industry||'N/A', exchangeShortName:q.exchange||'', mktCap:q.marketCap||0, lastDiv:q.lastAnnualDividend||0 },
            quote:q, ratios, metrics, income:inc, balance:bal, cashflow:cf,
            ratiosHistory, metricsHistory:ratiosHistory, growth:[],
        };
    }

    /** Search — /search-symbol on /stable/ */
    async searchStocks(query) {
        if (!query) return [];
        try {
            const r = await this._fetch('/search-symbol', { query, limit: 10 });
            return Array.isArray(r) ? r : [];
        } catch {
            // fallback: try profile lookup for exact ticker
            const sym = query.toUpperCase().trim();
            if (/^[A-Z]{1,5}$/.test(sym)) {
                try {
                    const prof = await this._fetch('/profile', { symbol: sym });
                    if (Array.isArray(prof) && prof.length) {
                        return prof.map(p => ({ symbol:p.symbol, name:p.companyName, exchangeShortName:p.exchangeShortName||'' }));
                    }
                } catch {}
            }
            return [];
        }
    }

    async getDividendHistory(symbol) {
        try { return await this._fetch('/historical-price-full/stock_dividend', { symbol }); }
        catch { return { historical: [] }; }
    }

    // ── Low-level accessors (backward compat) ──────────────────────────
    async getQuote(sym)                  { return this._fetch('/quote',                   { symbol:sym }); }
    async getProfile(sym)                { return this._fetch('/profile',                 { symbol:sym }); }
    async getIncomeStatement(sym, l=5)   { return this._fetch('/income-statement',        { symbol:sym, limit:l }); }
    async getBalanceSheet(sym, l=5)      { return this._fetch('/balance-sheet-statement', { symbol:sym, limit:l }); }
    async getCashFlow(sym, l=5)          { return this._fetch('/cash-flow-statement',     { symbol:sym, limit:l }); }
    async getFinancialGrowth(sym, l=5)   { return this._fetch('/financial-growth',        { symbol:sym, limit:l }); }

    // ── Cache utils ────────────────────────────────────────────────────
    clearAllCache() {
        const rm = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i); if (k&&k.startsWith('fmp_')) rm.push(k);
        }
        rm.forEach(k => localStorage.removeItem(k));
        this._annual = {};
        console.log('🗑️ FMP cache cleared (' + rm.length + ' entries)');
    }
    getCacheStats() {
        let n = 0;
        for (let i = 0; i < localStorage.length; i++) { if (localStorage.key(i)&&localStorage.key(i).startsWith('fmp_')) n++; }
        return { cachedEntries:n, memoizedSymbols:Object.keys(this._annual) };
    }
}

const fmpAPI = new FMPCache();
window.fmpAPI = fmpAPI;
// ✅ NO "export default" — loaded via <script src="fmp-api.js">
