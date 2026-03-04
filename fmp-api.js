// FMP API Manager — FREE PLAN ONLY
// Uses ONLY these free endpoints:
//   /quote/{sym}
//   /income-statement/{sym}
//   /balance-sheet-statement/{sym}
//   /cash-flow-statement/{sym}
//   /financial-growth/{sym}
//   /search
//   /historical/stock_dividend/{sym}  (gracefully fails if 403)
//
// ALL ratios/metrics are COMPUTED locally from the free statements.
// No /ratios, /key-metrics, /ratios-ttm, /key-metrics-ttm calls ever.
//
// Load with: <script src="fmp-api.js">  →  sets window.fmpAPI globally

class FMPCache {
    constructor() {
        this.API_KEY   = 'RxYKGPJbSbTuLhW15Bdrop3OxJ2tiXDf';
        this.BASE_URL  = 'https://financialmodelingprep.com/api/v3';
        this.CACHE_TTL = 3600000; // 1h
    }

    // ── Cache ──────────────────────────────────────────────────────────────────
    _cacheKey(ep, p = {}) {
        const qs = Object.entries(p).sort().map(([k,v])=>`${k}=${v}`).join('&');
        return ('fmp_free_' + ep + '_' + qs).replace(/[^a-zA-Z0-9_=&]/g,'_').substring(0,200);
    }
    _get(key) {
        try {
            const r = localStorage.getItem(key);
            if (!r) return null;
            const d = JSON.parse(r);
            if (Date.now() - d.ts < this.CACHE_TTL) return d.v;
            localStorage.removeItem(key);
        } catch {}
        return null;
    }
    _set(key, v) {
        try { localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() })); }
        catch (e) {
            if (e.name === 'QuotaExceededError') {
                const rm = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('fmp_')) rm.push(k);
                }
                rm.slice(0, Math.ceil(rm.length / 2)).forEach(k => localStorage.removeItem(k));
                try { localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() })); } catch {}
            }
        }
    }

    // ── Core fetch (only free endpoints) ──────────────────────────────────────
    async makeRequest(endpoint, params = {}) {
        const key = this._cacheKey(endpoint, params);
        const cached = this._get(key);
        if (cached !== null) { console.log('cache hit: ' + endpoint); return cached; }

        const qs = new URLSearchParams(Object.assign({}, params, { apikey: this.API_KEY })).toString();
        const url = this.BASE_URL + endpoint + '?' + qs;
        console.log('FMP fetch: ' + url);

        const res = await fetch(url);
        if (!res.ok) throw new Error('FMP ' + res.status + ': ' + endpoint);
        const data = await res.json();
        if (data && data['Error Message']) throw new Error(data['Error Message']);

        this._set(key, data);
        return data;
    }

    // ── Math helpers ───────────────────────────────────────────────────────────
    _s(v) { return (v != null && isFinite(v)) ? +v : null; }
    _d(a, b) {
        const sa = this._s(a), sb = this._s(b);
        return (sa != null && sb != null && sb !== 0) ? sa / sb : null;
    }

    // ── Compute ratios from free statement data ────────────────────────────────
    _computeRatios(q, inc0, cf0, bal0) {
        const s = this._s.bind(this), d = this._d.bind(this);
        const price  = s(q.price);
        const shares = s(inc0.weightedAverageShsOutDil) || s(inc0.weightedAverageShsOut) || s(q.sharesOutstanding);
        const eps    = s(inc0.epsdiluted) || s(inc0.eps) || s(q.eps);
        const rev    = s(inc0.revenue);
        const ni     = s(inc0.netIncome);
        const gp     = s(inc0.grossProfit);
        const op     = s(inc0.operatingIncome);
        const da     = s(cf0.depreciationAndAmortization) || s(inc0.depreciationAndAmortization);
        const ebitda = s(inc0.ebitda) || (op != null && da != null ? op + da : null);
        const fcf    = s(cf0.freeCashFlow);
        const ocf    = s(cf0.operatingCashFlow);
        const fcfPS  = d(fcf, shares);
        const ocfPS  = d(ocf, shares);
        const revPS  = d(rev, shares);
        const bvPS   = d(s(bal0.totalStockholdersEquity), shares);
        const debt   = s(bal0.totalDebt) || 0;
        const cash   = s(bal0.cashAndCashEquivalents) || s(bal0.cashAndShortTermInvestments) || 0;
        const mktCap = (price && shares) ? price * shares : s(q.marketCap) || 0;
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
        const payR  = (eps && eps > 0) ? divAnn / eps : null;
        const eyld  = pe  && pe  > 0 ? 1/pe   : null;
        const fyld  = pfcf && pfcf > 0 ? 1/pfcf : null;
        const repA  = Math.abs(s(cf0.commonStockRepurchased) || 0);
        const buyY  = (mktCap > 0 && repA > 0) ? repA / mktCap : null;
        const sbc   = s(cf0.stockBasedCompensation) || 0;
        const graham = (eps && eps > 0 && bvPS && bvPS > 0) ? Math.sqrt(22.5 * eps * bvPS) : null;

        const r = {
            // standard names (no TTM suffix)
            priceEarningsRatio:               pe,
            priceToSalesRatio:                ps,
            priceToBookRatio:                 pb,
            priceToFreeCashFlowsRatio:        pfcf,
            priceToOperatingCashFlowsRatio:   pocf,
            enterpriseValueMultiple:          evEb,
            debtEquityRatio:                  deR,
            currentRatio:                     curR,
            quickRatio:                       qkR,
            returnOnEquity:                   roe,
            returnOnAssets:                   roa,
            returnOnCapitalEmployed:          roic,
            grossProfitMargin:                d(gp, rev),
            operatingProfitMargin:            d(op, rev),
            netProfitMargin:                  d(ni, rev),
            freeCashFlowMargin:               d(fcf, rev),
            ebitdaMargin:                     d(ebitda, rev),
            dividendYield:                    divY,
            payoutRatio:                      payR,
            earningsYield:                    eyld,
            freeCashFlowYield:                fyld,
            buybackYield:                     buyY,
            grahamNumber:                     graham,
            freeCashFlowPerShare:             fcfPS,
            operatingCashFlowPerShare:        ocfPS,
            revenuePerShare:                  revPS,
            bookValuePerShare:                bvPS,
            priceEarningsToGrowthRatio:       null,
            _computed: true,
        };
        // TTM aliases — score engine uses these
        const ttm = [
            ['priceEarningsRatioTTM',               pe],
            ['priceToSalesRatioTTM',                ps],
            ['priceToBookRatioTTM',                 pb],
            ['priceToFreeCashFlowsRatioTTM',        pfcf],
            ['priceToOperatingCashFlowsRatioTTM',   pocf],
            ['enterpriseValueMultipleTTM',          evEb],
            ['debtEquityRatioTTM',                  deR],
            ['currentRatioTTM',                     curR],
            ['quickRatioTTM',                       qkR],
            ['returnOnEquityTTM',                   roe],
            ['returnOnAssetsTTM',                   roa],
            ['roicTTM',                             roic],
            ['returnOnCapitalEmployedTTM',          roce],
            ['grossProfitMarginTTM',                d(gp, rev)],
            ['operatingProfitMarginTTM',            d(op, rev)],
            ['netProfitMarginTTM',                  d(ni, rev)],
            ['dividendYieldTTM',                    divY],
            ['payoutRatioTTM',                      payR],
            ['earningsYieldTTM',                    eyld],
            ['freeCashFlowYieldTTM',                fyld],
            ['pegRatioTTM',                         null],
        ];
        ttm.forEach(([k, v]) => { r[k] = v; });
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
            marketCap:                mktCap,
            enterpriseValue:          ev,
            freeCashFlowPerShare:     d(fcf, shares),
            operatingCashFlowPerShare:d(ocf, shares),
            revenuePerShare:          d(rev, shares),
            netIncomePerShare:        d(ni, shares),
            bookValuePerShare:        d(s(bal0.totalStockholdersEquity), shares),
            earningsPerShare:         s(inc0.epsdiluted) || s(inc0.eps) || s(q.eps),
            grahamNumber:             ratios.grahamNumber,
            roe:                      ratios.returnOnEquity,
            roa:                      ratios.returnOnAssets,
            roic:                     ratios.returnOnCapitalEmployed,
            returnOnTangibleAssets:   null,
            evToSales:                d(ev, rev),
            evToEbitda:               (ev && ebitda && ebitda > 0) ? ev / ebitda : null,
            evToFreeCashFlow:         d(ev, fcf),
            debtToEquity:             ratios.debtEquityRatio,
            debtToAssets:             d(debt, s(bal0.totalAssets)),
            netDebtToEBITDA:          (ebitda && ebitda > 0) ? (debt - cash) / ebitda : null,
            interestCoverage:         d(op, s(inc0.interestExpense)),
            buybackYield:             ratios.buybackYield,
            earningsYield:            ratios.earningsYield,
            freeCashFlowYield:        ratios.freeCashFlowYield,
            piotroskiScore:           null,
            _computed: true,
        };
    }

    // Build ratios-history array (one row per annual year)
    _buildRatiosHistory(q, incArr, cfArr, balArr) {
        const s = this._s.bind(this), d = this._d.bind(this);
        return incArr.map((inc, i) => {
            const cf  = cfArr[i]  || {};
            const bal = balArr[i] || {};
            // For historical years we have no historical prices → valuation multiples null except year 0
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
                priceEarningsRatio:             (price && eps   && eps   > 0) ? price/eps   : null,
                priceToSalesRatio:              (price && revPS && revPS > 0) ? price/revPS : null,
                priceToBookRatio:               (price && bvPS  && bvPS  > 0) ? price/bvPS  : null,
                priceToFreeCashFlowsRatio:      (price && fcfPS && fcfPS > 0) ? price/fcfPS : null,
                priceToOperatingCashFlowsRatio: (price && ocfPS && ocfPS > 0) ? price/ocfPS : null,
                enterpriseValueMultiple:        (ev && ebitda && ebitda > 0)  ? ev/ebitda   : null,
                evToSales:                      (ev && rev && rev > 0)        ? ev/rev       : null,
                returnOnEquity:    d(ni, equity),
                returnOnAssets:    d(ni, assets),
                grossProfitMargin: d(gp, rev),
                operatingProfitMargin: d(op, rev),
                netProfitMargin:   d(ni, rev),
                freeCashFlowMargin: d(fcf, rev),
                currentRatio:      d(curA, curL),
                debtEquityRatio:   d(debt, equity),
                freeCashFlowPerShare: fcfPS,
                revenuePerShare:      revPS,
                bookValuePerShare:    bvPS,
                earningsYield:     (price && eps   && eps   > 0) ? eps/price   : null,
                freeCashFlowYield: (price && fcfPS && fcfPS > 0) ? fcfPS/price : null,
                dividendYield:     null,
                payoutRatio:       null,
                _computed: true,
            };
        });
    }

    // ── PUBLIC convenience methods ─────────────────────────────────────────────
    async searchStocks(query) {
        if (!query) return [];
        try { return await this.makeRequest('/search', { query, limit: 10 }); }
        catch { return []; }
    }

    async getDividendHistory(sym) {
        try { return await this.makeRequest('/historical/stock_dividend/' + sym); }
        catch { return { historical: [] }; }
    }

    async getIncomeStatement(sym, l=5) { return this.makeRequest('/income-statement/' + sym, { limit: l }); }
    async getBalanceSheet(sym, l=5)    { return this.makeRequest('/balance-sheet-statement/' + sym, { limit: l }); }
    async getCashFlow(sym, l=5)        { return this.makeRequest('/cash-flow-statement/' + sym, { limit: l }); }
    async getFinancialGrowth(sym, l=5) { return this.makeRequest('/financial-growth/' + sym, { limit: l }); }
    async getQuote(sym)                { return this.makeRequest('/quote/' + sym); }

    // These now compute locally instead of hitting premium endpoints
    async getRatios(sym, l=5) {
        return this._loadAndBuildRatiosHistory(sym, l);
    }
    async getFinancialRatios(sym, l=5) { return this.getRatios(sym, l); }
    async getKeyMetrics(sym, l=5) {
        const [qRaw, incRaw, cfRaw, balRaw] = await Promise.all([
            this.makeRequest('/quote/' + sym),
            this.makeRequest('/income-statement/' + sym,        { limit: l }).catch(() => []),
            this.makeRequest('/cash-flow-statement/' + sym,     { limit: l }).catch(() => []),
            this.makeRequest('/balance-sheet-statement/' + sym, { limit: l }).catch(() => []),
        ]);
        const q   = Array.isArray(qRaw) ? qRaw[0] : (qRaw || {});
        const inc = Array.isArray(incRaw) ? incRaw : [];
        const cf  = Array.isArray(cfRaw)  ? cfRaw  : [];
        const bal = Array.isArray(balRaw) ? balRaw : [];
        const ratios = this._computeRatios(q, inc[0]||{}, cf[0]||{}, bal[0]||{});
        return [this._computeMetrics(q, inc[0]||{}, cf[0]||{}, bal[0]||{}, ratios)];
    }

    async _loadAndBuildRatiosHistory(sym, l=5) {
        const [qRaw, incRaw, cfRaw, balRaw] = await Promise.all([
            this.makeRequest('/quote/' + sym),
            this.makeRequest('/income-statement/' + sym,        { limit: l }).catch(() => []),
            this.makeRequest('/cash-flow-statement/' + sym,     { limit: l }).catch(() => []),
            this.makeRequest('/balance-sheet-statement/' + sym, { limit: l }).catch(() => []),
        ]);
        const q   = Array.isArray(qRaw) ? qRaw[0] : (qRaw || {});
        const inc = Array.isArray(incRaw) ? incRaw : [];
        const cf  = Array.isArray(cfRaw)  ? cfRaw  : [];
        const bal = Array.isArray(balRaw) ? balRaw : [];
        return this._buildRatiosHistory(q, inc, cf, bal);
    }

    // ── Main aggregator ────────────────────────────────────────────────────────
    async getFullScreenerData(symbol) {
        const [qRaw, incRaw, cfRaw, balRaw, grwRaw] = await Promise.all([
            this.makeRequest('/quote/' + symbol),
            this.makeRequest('/income-statement/' + symbol,        { limit: 5 }).catch(() => []),
            this.makeRequest('/cash-flow-statement/' + symbol,     { limit: 5 }).catch(() => []),
            this.makeRequest('/balance-sheet-statement/' + symbol, { limit: 5 }).catch(() => []),
            this.makeRequest('/financial-growth/' + symbol,        { limit: 5 }).catch(() => []),
        ]);
        const q   = Array.isArray(qRaw)   ? qRaw[0]  : (qRaw   || {});
        const inc = Array.isArray(incRaw) ? incRaw   : [];
        const cf  = Array.isArray(cfRaw)  ? cfRaw    : [];
        const bal = Array.isArray(balRaw) ? balRaw   : [];
        const grw = Array.isArray(grwRaw) ? grwRaw   : [];
        if (!q.price && !inc.length) throw new Error('No data for "' + symbol + '"');
        const ratios        = this._computeRatios(q, inc[0]||{}, cf[0]||{}, bal[0]||{});
        const metrics       = this._computeMetrics(q, inc[0]||{}, cf[0]||{}, bal[0]||{}, ratios);
        const ratiosHistory = this._buildRatiosHistory(q, inc, cf, bal);
        return {
            profile: { symbol, companyName: q.name||q.companyName||symbol, sector: q.sector||'N/A', industry: q.industry||'N/A', exchangeShortName: q.exchange||'', mktCap: q.marketCap||0, lastDiv: q.lastAnnualDividend||0 },
            quote: q,
            ratios,
            metrics,
            income:          inc,
            balance:         bal,
            cashflow:        cf,
            ratiosHistory,
            metricsHistory:  ratiosHistory,
            growth:          grw,
        };
    }

    async getScreenerData(symbol) { return this.getFullScreenerData(symbol); }

    async getFullScreenerDataQuarterly(symbol) {
        const pages = [0,1,2,3];
        const dedup = arr => { const seen = new Set(); return (Array.isArray(arr)?arr:[]).filter(r => r && r.date && !seen.has(r.date) && seen.add(r.date)); };
        const [qRaw, incP, cfP, balP] = await Promise.all([
            this.makeRequest('/quote/' + symbol),
            Promise.all(pages.map(p => this.makeRequest('/income-statement/' + symbol,        { period:'quarter', limit:5, page:p }).catch(()=>[]))),
            Promise.all(pages.map(p => this.makeRequest('/cash-flow-statement/' + symbol,     { period:'quarter', limit:5, page:p }).catch(()=>[]))),
            Promise.all(pages.map(p => this.makeRequest('/balance-sheet-statement/' + symbol, { period:'quarter', limit:5, page:p }).catch(()=>[]))),
        ]);
        const q   = Array.isArray(qRaw) ? qRaw[0] : (qRaw||{});
        const inc = dedup(incP.flat());
        const cf  = dedup(cfP.flat());
        const bal = dedup(balP.flat());
        const ratios  = this._computeRatios(q, inc[0]||{}, cf[0]||{}, bal[0]||{});
        const metrics = this._computeMetrics(q, inc[0]||{}, cf[0]||{}, bal[0]||{}, ratios);
        const ratiosHistory = this._buildRatiosHistory(q, inc, cf, bal);
        return {
            profile: { symbol, companyName: q.name||symbol, sector: q.sector||'N/A', industry: q.industry||'N/A', exchangeShortName: q.exchange||'', mktCap: q.marketCap||0, lastDiv: q.lastAnnualDividend||0 },
            quote: q, ratios, metrics, income: inc, balance: bal, cashflow: cf,
            ratiosHistory, metricsHistory: ratiosHistory, growth: [],
        };
    }

    async getDCFData(symbol) {
        const [qRaw, cfRaw, incRaw, grwRaw] = await Promise.all([
            this.makeRequest('/quote/' + symbol),
            this.makeRequest('/cash-flow-statement/' + symbol,  { limit: 10 }).catch(()=>[]),
            this.makeRequest('/income-statement/' + symbol,     { limit: 10 }).catch(()=>[]),
            this.makeRequest('/financial-growth/' + symbol,     { limit: 10 }).catch(()=>[]),
        ]);
        const q   = Array.isArray(qRaw)   ? qRaw[0]  : (qRaw   ||{});
        const cf  = Array.isArray(cfRaw)  ? cfRaw    : [];
        const inc = Array.isArray(incRaw) ? incRaw   : [];
        const grw = Array.isArray(grwRaw) ? grwRaw   : [];
        return { profile: { symbol, companyName: q.name||symbol, sector: q.sector||'N/A', industry: q.industry||'N/A', mktCap: q.marketCap||0, lastDiv: q.lastAnnualDividend||0 }, quote: q, cashFlow: cf, income: inc, growth: grw };
    }

    async getValorisationData(symbol) {
        const d = await this.getFullScreenerData(symbol);
        return { profile: d.profile, quote: d.quote, ratiosTTM: d.ratios, metricsTTM: d.metrics, historicalRatios: d.ratiosHistory, historicalMetrics: d.metricsHistory, income: d.income, cashFlow: d.cashflow, growth: d.growth };
    }

    // ── Cache utils ────────────────────────────────────────────────────────────
    clearAllCache() {
        const rm = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('fmp_')) rm.push(k); }
        rm.forEach(k => localStorage.removeItem(k));
        console.log('Cleared ' + rm.length + ' FMP cache entries');
    }
    getCacheStats() {
        let n = 0;
        for (let i = 0; i < localStorage.length; i++) { if (localStorage.key(i) && localStorage.key(i).startsWith('fmp_')) n++; }
        return { cachedEntries: n };
    }
}

const fmpAPI = new FMPCache();
window.fmpAPI = fmpAPI;
