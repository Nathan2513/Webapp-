// score-engine.js
// Système de scoring StockUnlock — 6 catégories, 26 métriques
// Import dans stock-screener.html via: import { computeAllScores, renderScoresTab } from './score-engine.js';

// ============================================================
// SCORE ENGINE — Full StockUnlock-style scoring system
// ============================================================

const SCORE_LABELS = {
    5: { label: 'Très bien',    color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    4: { label: 'Bien',         color: '#86efac', bg: 'rgba(134,239,172,0.15)' },
    3: { label: 'Moyenne',      color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    2: { label: 'Mauvais',      color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
    1: { label: 'Très mauvais', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

function getScoreLabel(score) {
    if (score == null) return { label: 'N/A', color: 'var(--text-secondary)', bg: 'var(--hover-bg)' };
    return SCORE_LABELS[Math.round(Math.max(1, Math.min(5, score)))];
}

function scoreByThreshold(value, [t1, t2, t3, t4], higherIsBetter = true) {
    if (value == null || isNaN(value)) return null;
    if (higherIsBetter) {
        if (value >= t4) return 5;
        if (value >= t3) return 4;
        if (value >= t2) return 3;
        if (value >= t1) return 2;
        return 1;
    } else {
        if (value <= t1) return 5;
        if (value <= t2) return 4;
        if (value <= t3) return 3;
        if (value <= t4) return 2;
        return 1;
    }
}

function pctVal(v) { return v != null ? v * 100 : null; }

function growthPct(curr, prev) {
    if (curr == null || prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
}

function avgArr(arr) {
    const v = arr.filter(x => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// ── Category: Rentabilité ──
function scoreRentabilite(data) {
    const r   = data.ratios   || {};
    const inc = data.income   || [];
    const cf  = data.cashflow || [];

    const rev = inc[0]?.revenue;
    const gp  = inc[0]?.grossProfit;
    const op  = inc[0]?.operatingIncome;
    const ni  = inc[0]?.netIncome;
    const fcf = cf[0]?.freeCashFlow;
    const ocf = cf[0]?.operatingCashFlow;

    const grossM = rev ? (gp  / rev) * 100 : pctVal(r.grossProfitMarginTTM);
    const opM    = rev ? (op  / rev) * 100 : pctVal(r.operatingProfitMarginTTM);
    const netM   = rev ? (ni  / rev) * 100 : pctVal(r.netProfitMarginTTM);
    const fcfM   = (fcf != null && rev) ? (fcf / rev) * 100 : null;
    const cashConv = (fcf != null && ni && ni !== 0) ? (fcf / ni) * 100 : null;

    const metrics = [
        { label: 'Marge brute',           value: grossM,   format: 'pct', score: scoreByThreshold(grossM,   [20, 35, 50, 65]) },
        { label: 'Marge opérationnelle',   value: opM,      format: 'pct', score: scoreByThreshold(opM,      [5, 10, 15, 25]) },
        { label: 'Marge nette',            value: netM,     format: 'pct', score: scoreByThreshold(netM,     [3, 7, 12, 20]) },
        { label: 'Marge FCF',              value: fcfM,     format: 'pct', score: scoreByThreshold(fcfM,     [2, 5, 10, 18]) },
        { label: 'Conversion trésorerie',  value: cashConv, format: 'pct', score: scoreByThreshold(cashConv, [20, 40, 60, 80]) },
    ];

    return buildCategory('Rentabilité', '📈', metrics);
}

// ── Category: Gestion ──
function scoreGestion(data) {
    const r   = data.ratios   || {};
    const inc = data.income   || [];
    const cf  = data.cashflow || [];

    const rev = inc[0]?.revenue;
    const ocf = cf[0]?.operatingCashFlow;
    const fcf = cf[0]?.freeCashFlow;
    const sbc = cf[0]?.stockBasedCompensation;

    const sbcRev = (sbc != null && rev) ? (sbc / rev) * 100 : null;
    const sbcOcf = (sbc != null && ocf && ocf > 0) ? (sbc / ocf) * 100 : null;
    const sbcFcf = (sbc != null && fcf && fcf > 0) ? (sbc / fcf) * 100 : null;
    const roic   = pctVal(r.roicTTM);
    const roce   = pctVal(r.returnOnCapitalEmployedTTM);

    const metrics = [
        { label: "SBC en % du chiffre d'affaires",                   value: sbcRev, format: 'pct', score: scoreByThreshold(sbcRev, [1, 3, 5, 10],   false) },
        { label: "SBC en % du flux de trésorerie d'exploitation",    value: sbcOcf, format: 'pct', score: scoreByThreshold(sbcOcf, [5, 10, 20, 35],  false) },
        { label: "SBC en % du flux de trésorerie disponible",        value: sbcFcf, format: 'pct', score: scoreByThreshold(sbcFcf, [10, 25, 50, 100], false) },
        { label: 'ROIC',                                              value: roic,   format: 'pct', score: scoreByThreshold(roic,   [5, 10, 15, 25]) },
        { label: 'ROCE',                                              value: roce,   format: 'pct', score: scoreByThreshold(roce,   [5, 10, 15, 25]) },
    ];

    return buildCategory('Gestion', '⚙️', metrics);
}

// ── Category: Croissance ──
function scoreCroissance(data) {
    const inc = data.income   || [];
    const cf  = data.cashflow || [];

    const revG  = growthPct(inc[0]?.revenue,        inc[1]?.revenue);
    const gpG   = growthPct(inc[0]?.grossProfit,    inc[1]?.grossProfit);
    const opG   = growthPct(inc[0]?.operatingIncome,inc[1]?.operatingIncome);
    const niG   = growthPct(inc[0]?.netIncome,      inc[1]?.netIncome);
    const ocfG  = growthPct(cf[0]?.operatingCashFlow, cf[1]?.operatingCashFlow);

    const metrics = [
        { label: 'Augmentation des revenus',                           value: revG, format: 'pct', score: scoreByThreshold(revG, [0, 5, 10, 20]) },
        { label: 'Augmentation du bénéfice brut',                      value: gpG,  format: 'pct', score: scoreByThreshold(gpG,  [0, 5, 10, 20]) },
        { label: "Augmentation du résultat d'exploitation",            value: opG,  format: 'pct', score: scoreByThreshold(opG,  [0, 5, 15, 30]) },
        { label: 'Augmentation du revenu net',                         value: niG,  format: 'pct', score: scoreByThreshold(niG,  [0, 5, 15, 30]) },
        { label: "Augmentation des flux de trésorerie d'exploitation", value: ocfG, format: 'pct', score: scoreByThreshold(ocfG, [-5, 0, 10, 25]) },
    ];

    return buildCategory('Croissance', '🚀', metrics);
}

// ── Category: Santé financière ──
function scoreSanteFinanciere(data) {
    const r   = data.ratios   || {};
    const b   = data.balance  || [];
    const inc = data.income   || [];
    const cf  = data.cashflow || [];

    const curRatio = r.currentRatioTTM ?? (b[0] ? (b[0].totalCurrentAssets || 0) / Math.max(b[0].totalCurrentLiabilities || 1, 1) : null);
    const intang   = b[0] ? ((b[0].goodwill || 0) + (b[0].intangibleAssets || 0)) : null;
    const totA     = b[0]?.totalAssets;
    const intangPct = (intang != null && totA) ? (intang / totA) * 100 : null;
    const shareG   = growthPct(inc[0]?.weightedAverageSharesOutDil, inc[1]?.weightedAverageSharesOutDil);
    const ebitda   = inc[0]?.ebitda;
    const debt     = b[0]?.totalDebt;
    const debtEbitda = (debt != null && ebitda && ebitda > 0) ? debt / ebitda : null;

    const metrics = [
        { label: 'Ratio actuel',                              value: curRatio,   format: 'ratio', score: scoreByThreshold(curRatio,   [0.5, 0.8, 1.2, 2.0]) },
        { label: 'Actifs incorporels en % du total des actifs', value: intangPct, format: 'pct',   score: scoreByThreshold(intangPct,  [5, 15, 30, 50], false) },
        { label: 'Les actions augmentent',                    value: shareG,     format: 'pct',   score: scoreByThreshold(shareG,     [-2, 0, 1, 3], false) },
        { label: 'Ratio dette/EBITDA',                        value: debtEbitda, format: 'ratio', score: scoreByThreshold(debtEbitda, [0.5, 1.0, 2.0, 4.0], false) },
    ];

    return buildCategory('Santé financière', '🏦', metrics);
}

// ── Category: Analyste (proxy via croissance historique) ──
function scoreAnalyste(data) {
    const inc = data.income   || [];
    const cf  = data.cashflow || [];

    const epsG    = growthPct(inc[0]?.epsdiluted,  inc[1]?.epsdiluted);
    const revG    = growthPct(inc[0]?.revenue,     inc[1]?.revenue);
    const ebitdaG = growthPct(inc[0]?.ebitda,      inc[1]?.ebitda);

    const metrics = [
        { label: "BPA projeté pour l'année prochaine",    value: epsG,    format: 'pct', score: scoreByThreshold(epsG,    [0, 5, 15, 30]) },
        { label: "Revenus projetés pour l'année prochaine", value: revG,  format: 'pct', score: scoreByThreshold(revG,    [0, 5, 10, 20]) },
        { label: "EBITDA projeté pour l'année prochaine",  value: ebitdaG,format: 'pct', score: scoreByThreshold(ebitdaG, [0, 5, 15, 30]) },
    ];

    return buildCategory('Analyste', '🔭', metrics);
}

// ── Category: Évaluation ──
function scoreEvaluation(data) {
    const r  = data.ratios        || {};
    const rh = data.ratiosHistory || [];

    const pe   = r.priceEarningsRatioTTM;
    const pfcf = r.priceToFreeCashFlowsRatioTTM;
    const ps   = r.priceToSalesRatioTTM;

    const last5 = rh.slice(0, 5);
    const safe  = (arr) => arr.filter(v => v != null && v > 0 && v < 500);
    const avg5  = (arr) => { const a = safe(arr); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; };

    const avgPE5   = avg5(last5.map(y => y.priceEarningsRatio));
    const avgPFCF5 = avg5(last5.map(y => y.priceToFreeCashFlowsRatio));
    const avgPS5   = avg5(last5.map(y => y.priceToSalesRatio));

    const peVs5    = (pe   && avgPE5)   ? ((pe   - avgPE5)   / avgPE5)   * 100 : null;
    const pfcfVs5  = (pfcf && avgPFCF5) ? ((pfcf - avgPFCF5) / avgPFCF5) * 100 : null;
    const psVs5    = (ps   && avgPS5)   ? ((ps   - avgPS5)   / avgPS5)   * 100 : null;
    const RFREE    = 4.5;
    const fcfPrime = pfcf ? ((1 / pfcf) * 100) - RFREE : null;
    const fcfYield = pfcf ? (1 / pfcf) * 100 : null;

    const peLabel   = `Le P/E de ${pe?.toFixed(2) || '?'} est ${peVs5 != null ? (peVs5 < 0 ? 'inférieur' : 'supérieur') : '?'} à la moyenne sur 5 ans de ${avgPE5?.toFixed(2) || '?'}`;
    const pfcfLabel = `Le P/FCF de ${pfcf?.toFixed(2) || '?'} est ${pfcfVs5 != null ? (pfcfVs5 < 0 ? 'inférieur' : 'supérieur') : '?'} à la moyenne sur 5 ans de ${avgPFCF5?.toFixed(2) || '?'}`;
    const psLabel   = `Le P/S de ${ps?.toFixed(2) || '?'} est ${psVs5 != null ? (psVs5 < 0 ? 'inférieur' : 'supérieur') : '?'} à la moyenne sur 5 ans de ${avgPS5?.toFixed(2) || '?'}`;

    const metrics = [
        { label: peLabel,            value: peVs5,    format: 'pct',   score: scoreByThreshold(peVs5,   [-30, -10, 10, 30], false) },
        { label: pfcfLabel,          value: pfcfVs5,  format: 'pct',   score: scoreByThreshold(pfcfVs5, [-30, -10, 10, 30], false) },
        { label: psLabel,            value: psVs5,    format: 'pct',   score: scoreByThreshold(psVs5,   [-30, -10, 10, 30], false) },
        { label: 'Prime de risque FCF', value: fcfPrime, format: 'pct', score: scoreByThreshold(fcfPrime, [-2, 0, 2, 5]) },
        { label: 'Rendement FCF',    value: fcfYield, format: 'pct',   score: scoreByThreshold(fcfYield, [1, 2, 4, 7]) },
    ];

    return buildCategory('Évaluation', '💰', metrics);
}

function buildCategory(name, icon, metrics) {
    const scores = metrics.filter(m => m.score != null).map(m => m.score);
    const categoryScore = scores.length ? avgArr(scores) : null;
    return { name, icon, score: categoryScore, metrics };
}

function computeAllScores(data) {
    const categories = [
        scoreRentabilite(data),
        scoreGestion(data),
        scoreCroissance(data),
        scoreSanteFinanciere(data),
        scoreAnalyste(data),
        scoreEvaluation(data),
    ];
    const valid = categories.filter(c => c.score != null);
    const globalScore = valid.length ? avgArr(valid.map(c => c.score)) : null;
    return { globalScore, categories };
}

// ── Score badge color helper for top badge ──
function calculateScore(metrics, ratios) {
    // kept for backward compat — now replaced by computeAllScores
    return '—';
}

// ── Pagination state ──
const _scorePages = {};
const SCORE_PAGE_SIZE = 5;

function scorePageGo(id, delta) {
    if (!_scorePages[id]) return;
    const state = _scorePages[id];
    const maxPage = Math.ceil(state.metrics.length / SCORE_PAGE_SIZE) - 1;
    state.page = Math.max(0, Math.min(maxPage, state.page + delta));
    _updateScorePage(id);
}

function _updateScorePage(id) {
    const state  = _scorePages[id];
    const start  = state.page * SCORE_PAGE_SIZE;
    const end    = Math.min(start + SCORE_PAGE_SIZE, state.metrics.length);
    const total  = Math.ceil(state.metrics.length / SCORE_PAGE_SIZE);
    const tbody  = document.getElementById('stbody-' + id);
    const lbl    = document.getElementById('spglbl-' + id);
    const cnt    = document.getElementById('spcnt-'  + id);
    if (tbody) tbody.innerHTML = _buildMetricRows(state.metrics, start, SCORE_PAGE_SIZE);
    if (lbl)   lbl.textContent = `Page ${state.page + 1} sur ${total}`;
    if (cnt)   cnt.textContent = `Affichage de ${start + 1} à ${end} sur ${state.metrics.length}`;
}

function _buildMetricRows(metrics, startIdx, pageSize) {
    return metrics.slice(startIdx, startIdx + pageSize).map(m => {
        const lbl = getScoreLabel(m.score);
        const pill = `<span class="sc-pill" style="background:${lbl.bg};color:${lbl.color};">${lbl.label}</span>`;
        const val  = m.value != null ? (m.format === 'pct' ? m.value.toFixed(2) + '%' : m.value.toFixed(2)) : 'N/A';
        return `<tr class="sc-row"><td class="sc-td-m"><span class="sc-icon">ⓘ</span>${m.label}</td><td class="sc-td-v">${val}</td><td class="sc-td-s">${pill}</td></tr>`;
    }).join('');
}

function _buildCategoryCard(cat) {
    const id  = cat.name.replace(/[^a-z]/gi, '').toLowerCase() + 'card';
    const lbl = getScoreLabel(cat.score);
    const scoreStr = cat.score != null ? cat.score.toFixed(2) : '—';
    _scorePages[id] = { page: 0, metrics: cat.metrics };

    const totalPages = Math.ceil(cat.metrics.length / SCORE_PAGE_SIZE);
    const showCount  = Math.min(SCORE_PAGE_SIZE, cat.metrics.length);

    return `
    <div class="sc-card">
        <div class="sc-card-header">
            <div>
                <div class="sc-card-title">${cat.icon} ${cat.name}</div>
                <div class="sc-card-sub">Cliquez sur n'importe quelle métrique pour une analyse approfondie</div>
            </div>
            <div class="sc-badge" style="background:${lbl.bg};color:${lbl.color};border-color:${lbl.color};">${scoreStr}</div>
        </div>
        <table class="sc-table">
            <thead><tr>
                <th class="sc-th sc-th-m">⚡ Métrique</th>
                <th class="sc-th sc-th-v">Valeur</th>
                <th class="sc-th sc-th-s">🚀 Score de perspicacité</th>
            </tr></thead>
            <tbody id="stbody-${id}">${_buildMetricRows(cat.metrics, 0, SCORE_PAGE_SIZE)}</tbody>
        </table>
        <div class="sc-pagination">
            <button class="sc-pg-btn" onclick="scorePageGo('${id}',-1)">◀ Précédent</button>
            <span id="spglbl-${id}" class="sc-pg-lbl">Page 1 sur ${totalPages}</span>
            <button class="sc-pg-btn" onclick="scorePageGo('${id}',1)">Suivant ▶</button>
            <span id="spcnt-${id}" class="sc-pg-cnt">Affichage de 1 à ${showCount} sur ${cat.metrics.length}</span>
        </div>
    </div>`;
}

function _buildDonutSVG(globalScore, categories) {
    const SZ = 170, CX = 85, CY = 85, R = 65;
    const count = categories.length;
    const segDeg = 360 / count;
    const GAP = 3;
    let paths = '';

    function polar(cx, cy, r, deg) {
        const rad = (deg * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }
    function arc(cx, cy, r, s, e) {
        const p1 = polar(cx, cy, r, s), p2 = polar(cx, cy, r, e);
        return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${(e - s) > 180 ? 1 : 0} 1 ${p2.x} ${p2.y}`;
    }

    categories.forEach((cat, i) => {
        const lbl  = getScoreLabel(cat.score);
        const fill = cat.score != null ? (cat.score - 1) / 4 : 0.08;
        const sA   = i * segDeg - 90 + GAP / 2;
        const eA   = sA + segDeg - GAP;
        const fillEnd = sA + (segDeg - GAP) * fill;
        paths += `<path d="${arc(CX, CY, R, sA, eA)}" fill="none" stroke="var(--border-color)" stroke-width="14" stroke-linecap="butt"/>`;
        if (fill > 0.01) {
            paths += `<path d="${arc(CX, CY, R, sA, fillEnd)}" fill="none" stroke="${lbl.color}" stroke-width="14" stroke-linecap="butt"/>`;
        }
    });

    const gl = getScoreLabel(globalScore);
    const gs = globalScore != null ? globalScore.toFixed(2) : '—';
    return `<svg width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}">
        ${paths}
        <text x="${CX}" y="${CY - 10}" text-anchor="middle" style="fill:${gl.color};font-size:26px;font-weight:800;font-family:Inter,sans-serif;">${gs}</text>
        <text x="${CX}" y="${CY + 14}" text-anchor="middle" style="fill:${gl.color};font-size:12px;font-weight:600;font-family:Inter,sans-serif;">${gl.label}</text>
    </svg>`;
}

function renderScoresTab(result) {
    const { globalScore, categories } = result;
    const gl = getScoreLabel(globalScore);

    // Update top score badge color
    const scoreValueEl = document.getElementById('scoreValue');
    if (scoreValueEl) {
        scoreValueEl.textContent = globalScore != null ? `${globalScore.toFixed(2)}/5` : 'N/A';
        scoreValueEl.style.color = gl.color;
    }

    const donut   = _buildDonutSVG(globalScore, categories);
    const breakdown = categories.map(cat => {
        const l = getScoreLabel(cat.score);
        return `<div class="sc-breakdown-item"><span class="sc-dot" style="background:${l.color};"></span>${cat.name} — <strong style="color:${l.color}">${cat.score != null ? cat.score.toFixed(2) : 'N/A'}</strong></div>`;
    }).join('');

    const cards = categories.map(_buildCategoryCard).join('');

    document.getElementById('scores-content').innerHTML = `
    <style>
        .sc-global { display:flex; align-items:center; gap:28px; background:var(--bg-topbar); border:1px solid var(--border-color); border-radius:14px; padding:28px 32px; margin-bottom:28px; flex-wrap:wrap; }
        .sc-breakdown { display:flex; flex-wrap:wrap; gap:10px 24px; flex:1; }
        .sc-breakdown-item { display:flex; align-items:center; gap:8px; font-size:0.9rem; font-weight:500; color:var(--text-secondary); }
        .sc-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
        .sc-global-right { text-align:right; }
        .sc-global-num { font-size:3.2rem; font-weight:800; line-height:1; }
        .sc-global-lbl { font-size:1rem; font-weight:600; margin-top:4px; }
        .sc-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
        @media(max-width:860px) { .sc-grid { grid-template-columns:1fr; } .sc-global { flex-direction:column; text-align:center; } }
        .sc-card { background:var(--bg-topbar); border:1px solid var(--border-color); border-radius:14px; padding:24px; }
        .sc-card-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; gap:16px; }
        .sc-card-title { font-size:1.25rem; font-weight:700; color:var(--text-primary); margin-bottom:4px; }
        .sc-card-sub { font-size:0.78rem; color:var(--text-secondary); }
        .sc-badge { min-width:58px; height:58px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.45rem; font-weight:800; border-width:2px; border-style:solid; flex-shrink:0; }
        .sc-table { width:100%; border-collapse:collapse; }
        .sc-th { font-size:0.8rem; color:var(--text-secondary); font-weight:600; padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:left; white-space:nowrap; }
        .sc-th-v, .sc-th-s { text-align:right; }
        .sc-row { border-bottom:1px solid var(--border-color); transition:background 0.12s; }
        .sc-row:hover { background:var(--hover-bg); cursor:pointer; }
        .sc-row:last-child { border-bottom:none; }
        .sc-td-m { padding:12px; font-size:0.86rem; color:var(--text-primary); display:flex; align-items:flex-start; gap:8px; }
        .sc-td-v { padding:12px; text-align:right; font-weight:600; font-size:0.86rem; white-space:nowrap; }
        .sc-td-s { padding:12px; text-align:right; white-space:nowrap; }
        .sc-icon { color:var(--text-secondary); font-size:0.85rem; flex-shrink:0; margin-top:1px; }
        .sc-pill { display:inline-block; padding:4px 14px; border-radius:6px; font-weight:600; font-size:0.82rem; }
        .sc-pagination { display:flex; align-items:center; gap:12px; padding-top:14px; margin-top:4px; border-top:1px solid var(--border-color); flex-wrap:wrap; }
        .sc-pg-btn { padding:6px 14px; background:var(--hover-bg); border:1px solid var(--border-color); border-radius:8px; color:var(--text-primary); font-weight:600; font-size:0.8rem; cursor:pointer; transition:all 0.15s; }
        .sc-pg-btn:hover { background:var(--primary-orange); color:#fff; border-color:var(--primary-orange); }
        .sc-pg-lbl { font-size:0.84rem; font-weight:600; color:var(--text-primary); }
        .sc-pg-cnt { font-size:0.8rem; color:var(--text-secondary); margin-left:auto; }
    </style>

    <div class="sc-global">
        <div>${donut}</div>
        <div class="sc-breakdown">${breakdown}</div>
        <div class="sc-global-right">
            <div class="sc-global-num" style="color:${gl.color};">${globalScore != null ? globalScore.toFixed(2) : '—'}</div>
            <div class="sc-global-lbl" style="color:${gl.color};">${gl.label}</div>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:6px;">Score global /5</div>
        </div>
    </div>

    <div class="sc-grid">${cards}</div>`;
}



// Expose scorePageGo globally for onclick handlers in generated HTML
if (typeof window !== 'undefined') window.scorePageGo = scorePageGo;

export { computeAllScores, renderScoresTab };
