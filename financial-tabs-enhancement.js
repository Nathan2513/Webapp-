// ============================================================================
// STOCK SCREENER - FINANCIAL TABS ENHANCEMENT
// Fixed: uses fmpAPI from fmp-api.js (window.fmpAPI), correct /api/v3 endpoints
// ============================================================================

let currentSymbol = '';
let financialData = {
    income:   { annual: [], quarterly: [] },
    balance:  { annual: [], quarterly: [] },
    cashflow: { annual: [], quarterly: [] },
    ratios:   { annual: [], quarterly: [] },
    metrics:  { annual: [], quarterly: [] },
};

// ============================================================================
// ROW DEFINITIONS
// ============================================================================

const INCOME_STATEMENT_ROWS = [
    { label: "Revenue",                              key: "revenue",                                    bold: true },
    { label: "Revenue Growth (YoY)",                key: "_revenueGrowth",                             isGrowth: true, indent: true },
    { label: "Cost of Revenue",                     key: "costOfRevenue" },
    { label: "Gross Profit",                        key: "grossProfit",                                bold: true },
    { label: "Gross Margin",                        key: "_grossMargin",                               isPercent: true, indent: true },
    { label: "Selling, General & Admin",            key: "sellingGeneralAndAdministrativeExpenses",    indent: true },
    { label: "Research & Development",              key: "researchAndDevelopmentExpenses",             indent: true },
    { label: "Other Operating Expenses",            key: "otherExpenses",                              indent: true },
    { label: "Operating Expenses",                  key: "operatingExpenses",                          bold: true },
    { label: "Operating Income",                    key: "operatingIncome",                            bold: true },
    { label: "Operating Margin",                    key: "_operatingMargin",                           isPercent: true, indent: true },
    { label: "Interest Expense",                    key: "interestExpense" },
    { label: "Interest Income",                     key: "interestIncome" },
    { label: "Pretax Income",                       key: "incomeBeforeTax",                            bold: true },
    { label: "Income Tax Expense",                  key: "incomeTaxExpense" },
    { label: "Net Income",                          key: "netIncome",                                  bold: true },
    { label: "Net Margin",                          key: "_netMargin",                                 isPercent: true, indent: true },
    { label: "Net Income Growth",                   key: "_netIncomeGrowth",                           isGrowth: true, indent: true },
    { label: "Shares Outstanding (Basic)",          key: "weightedAverageShsOut" },
    { label: "Shares Outstanding (Diluted)",        key: "weightedAverageShsOutDil",                   bold: true },
    { label: "Shares Change (YoY)",                 key: "_sharesGrowth",                              isGrowth: true, indent: true },
    { label: "EPS (Basic)",                         key: "eps",                                        isCurrency: true },
    { label: "EPS (Diluted)",                       key: "epsdiluted",                                 isCurrency: true, bold: true },
    { label: "EPS Growth",                          key: "_epsGrowth",                                 isGrowth: true, indent: true },
    { label: "EBITDA",                              key: "ebitda",                                     bold: true },
    { label: "EBITDA Margin",                       key: "_ebitdaMargin",                              isPercent: true, indent: true },
    { label: "D&A",                                 key: "depreciationAndAmortization",                indent: true },
];

const BALANCE_SHEET_ROWS = [
    { label: "— ASSETS —",                          isSection: true },
    { label: "Cash & Equivalents",                  key: "cashAndCashEquivalents",                     bold: true },
    { label: "Short-Term Investments",              key: "shortTermInvestments" },
    { label: "Cash & Short-Term Investments",       key: "cashAndShortTermInvestments",                bold: true },
    { label: "Accounts Receivable",                 key: "netReceivables" },
    { label: "Inventory",                           key: "inventory" },
    { label: "Other Current Assets",                key: "otherCurrentAssets" },
    { label: "Total Current Assets",               key: "totalCurrentAssets",                          bold: true },
    { label: "Property, Plant & Equipment",         key: "propertyPlantEquipmentNet" },
    { label: "Long-Term Investments",               key: "longTermInvestments" },
    { label: "Goodwill",                            key: "goodwill" },
    { label: "Other Intangible Assets",             key: "intangibleAssets" },
    { label: "Other Long-Term Assets",              key: "otherNonCurrentAssets" },
    { label: "Total Assets",                        key: "totalAssets",                                bold: true },
    { label: "— LIABILITIES —",                     isSection: true },
    { label: "Accounts Payable",                    key: "accountPayables" },
    { label: "Short-Term Debt",                     key: "shortTermDebt" },
    { label: "Deferred Revenue",                    key: "deferredRevenue" },
    { label: "Other Current Liabilities",           key: "otherCurrentLiabilities" },
    { label: "Total Current Liabilities",          key: "totalCurrentLiabilities",                     bold: true },
    { label: "Long-Term Debt",                      key: "longTermDebt" },
    { label: "Other Long-Term Liabilities",         key: "otherNonCurrentLiabilities" },
    { label: "Total Liabilities",                   key: "totalLiabilities",                           bold: true },
    { label: "— EQUITY —",                          isSection: true },
    { label: "Retained Earnings",                   key: "retainedEarnings" },
    { label: "Total Common Equity",                 key: "totalStockholdersEquity",                    bold: true },
    { label: "Total Liabilities & Equity",          key: "totalLiabilitiesAndStockholdersEquity",      bold: true },
    { label: "— KEY METRICS —",                     isSection: true },
    { label: "Total Debt",                          key: "totalDebt",                                  bold: true },
    { label: "Net Cash (Debt)",                     key: "_netCash" },
    { label: "Working Capital",                     key: "_workingCapital" },
    { label: "Book Value Per Share",                key: "_bookValuePerShare",                         isCurrency: true },
    { label: "Tangible Book Value",                 key: "_tangibleBV" },
];

const CASH_FLOW_ROWS = [
    { label: "— OPERATING —",                       isSection: true },
    { label: "Net Income",                          key: "netIncome",                                  bold: true },
    { label: "Depreciation & Amortization",         key: "depreciationAndAmortization" },
    { label: "Stock-Based Compensation",            key: "stockBasedCompensation" },
    { label: "Change in Working Capital",           key: "changeInWorkingCapital" },
    { label: "Operating Cash Flow",                 key: "operatingCashFlow",                          bold: true },
    { label: "Operating Cash Flow Growth",          key: "_ocfGrowth",                                isGrowth: true, indent: true },
    { label: "— INVESTING —",                       isSection: true },
    { label: "Capital Expenditures",               key: "capitalExpenditure" },
    { label: "Cash Acquisitions",                   key: "acquisitionsNet" },
    { label: "Other Investing Activities",          key: "otherInvestingActivites" },
    { label: "Investing Cash Flow",                 key: "netCashUsedForInvestingActivites",           bold: true },
    { label: "— FINANCING —",                       isSection: true },
    { label: "Debt Issued (Repaid)",                key: "debtRepayment" },
    { label: "Common Stock Repurchased",            key: "commonStockRepurchased" },
    { label: "Dividends Paid",                      key: "dividendsPaid" },
    { label: "Other Financing Activities",          key: "otherFinancingActivites" },
    { label: "Financing Cash Flow",                 key: "netCashUsedProvidedByFinancingActivities",   bold: true },
    { label: "— SUMMARY —",                         isSection: true },
    { label: "Net Cash Flow",                       key: "netChangeInCash",                            bold: true },
    { label: "Free Cash Flow",                      key: "freeCashFlow",                               bold: true },
    { label: "FCF Growth",                          key: "_fcfGrowth",                                isGrowth: true, indent: true },
    { label: "FCF Margin",                          key: "_fcfMargin",                                isPercent: true, indent: true },
    { label: "FCF Per Share",                       key: "_fcfPerShare",                               isCurrency: true, indent: true },
];

const RATIOS_ROWS = [
    { label: "— VALUATION —",                       isSection: true },
    { label: "PE Ratio",                            key: "priceEarningsRatio",                         bold: true },
    { label: "PS Ratio",                            key: "priceToSalesRatio" },
    { label: "PB Ratio",                            key: "priceToBookRatio" },
    { label: "P/FCF Ratio",                         key: "priceToFreeCashFlowsRatio" },
    { label: "P/OCF Ratio",                         key: "priceToOperatingCashFlowsRatio" },
    { label: "EV/EBITDA",                           key: "enterpriseValueMultiple" },
    { label: "PEG Ratio",                           key: "priceEarningsToGrowthRatio" },
    { label: "— PROFITABILITY —",                   isSection: true },
    { label: "Gross Margin",                        key: "grossProfitMargin",                          isPercent: true, bold: true },
    { label: "Operating Margin",                    key: "operatingProfitMargin",                      isPercent: true },
    { label: "Net Margin",                          key: "netProfitMargin",                            isPercent: true },
    { label: "FCF Margin",                          key: "freeCashFlowMargin",                         isPercent: true },
    { label: "ROE",                                 key: "returnOnEquity",                             isPercent: true },
    { label: "ROA",                                 key: "returnOnAssets",                             isPercent: true },
    { label: "ROIC",                                key: "returnOnCapitalEmployed",                    isPercent: true },
    { label: "— LEVERAGE —",                        isSection: true },
    { label: "Debt / Equity",                       key: "debtEquityRatio" },
    { label: "Current Ratio",                       key: "currentRatio" },
    { label: "Quick Ratio",                         key: "quickRatio" },
    { label: "— YIELDS —",                          isSection: true },
    { label: "Earnings Yield",                      key: "earningsYield",                              isPercent: true },
    { label: "FCF Yield",                           key: "freeCashFlowYield",                          isPercent: true },
    { label: "Dividend Yield",                      key: "dividendYield",                              isPercent: true },
    { label: "Payout Ratio",                        key: "payoutRatio",                                isPercent: true },
];

const KPIS_ROWS = [
    { label: "— PER SHARE —",                       isSection: true },
    { label: "Revenue Per Share",                   key: "revenuePerShare",                            isCurrency: true, bold: true },
    { label: "Net Income Per Share",                key: "netIncomePerShare",                          isCurrency: true },
    { label: "FCF Per Share",                       key: "freeCashFlowPerShare",                       isCurrency: true },
    { label: "OCF Per Share",                       key: "operatingCashFlowPerShare",                  isCurrency: true },
    { label: "Book Value Per Share",                key: "bookValuePerShare",                          isCurrency: true },
    { label: "Graham Number",                       key: "grahamNumber",                               isCurrency: true },
    { label: "— MARKET —",                          isSection: true },
    { label: "Market Cap",                          key: "marketCap",                                  bold: true },
    { label: "Enterprise Value",                    key: "enterpriseValue" },
    { label: "EV / Sales",                          key: "evToSales" },
    { label: "EV / EBITDA",                         key: "evToEbitda" },
    { label: "EV / FCF",                            key: "evToFreeCashFlow" },
    { label: "— RETURNS —",                         isSection: true },
    { label: "ROE",                                 key: "roe",                                        isPercent: true, bold: true },
    { label: "ROA",                                 key: "roa",                                        isPercent: true },
    { label: "ROIC",                                key: "roic",                                       isPercent: true },
    { label: "ROCE",                                key: "returnOnTangibleAssets",                     isPercent: true },
    { label: "Earnings Yield",                      key: "earningsYield",                              isPercent: true },
    { label: "FCF Yield",                           key: "freeCashFlowYield",                          isPercent: true },
    { label: "Buyback Yield",                       key: "buybackYield",                               isPercent: true },
    { label: "— DEBT —",                            isSection: true },
    { label: "Debt to Equity",                      key: "debtToEquity" },
    { label: "Debt to Assets",                      key: "debtToAssets" },
    { label: "Net Debt to EBITDA",                  key: "netDebtToEBITDA" },
    { label: "Interest Coverage",                   key: "interestCoverage" },
    { label: "Piotroski Score",                     key: "piotroskiScore" },
];

// ============================================================================
// HELPERS
// ============================================================================

function fmtBig(v) {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e12) return '$' + (v/1e12).toFixed(2) + 'T';
    if (a >= 1e9)  return '$' + (v/1e9).toFixed(2)  + 'B';
    if (a >= 1e6)  return '$' + (v/1e6).toFixed(2)  + 'M';
    if (a >= 1e3)  return '$' + (v/1e3).toFixed(1)  + 'K';
    return '$' + v.toFixed(0);
}

function fmtNum(v) {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e12) return (v/1e12).toFixed(2) + 'T';
    if (a >= 1e9)  return (v/1e9).toFixed(2)  + 'B';
    if (a >= 1e6)  return (v/1e6).toFixed(2)  + 'M';
    if (a >= 1e3)  return (v/1e3).toFixed(1)  + 'K';
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function growthPct(curr, prev) {
    if (curr == null || prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
}

function computeDerived(row, yearData, nextYearData, incomeRow) {
    const v = yearData;
    const p = nextYearData;
    switch (row.key) {
        case '_revenueGrowth':  return growthPct(v.revenue, p?.revenue);
        case '_grossMargin':    return v.revenue ? (v.grossProfit / v.revenue) * 100 : null;
        case '_operatingMargin':return v.revenue ? (v.operatingIncome / v.revenue) * 100 : null;
        case '_netMargin':      return v.revenue ? (v.netIncome / v.revenue) * 100 : null;
        case '_ebitdaMargin':   return v.revenue && v.ebitda ? (v.ebitda / v.revenue) * 100 : null;
        case '_netIncomeGrowth':return growthPct(v.netIncome, p?.netIncome);
        case '_epsGrowth':      return growthPct(v.epsdiluted, p?.epsdiluted);
        case '_sharesGrowth':   return growthPct(v.weightedAverageShsOutDil, p?.weightedAverageShsOutDil);
        case '_netCash':        return (v.cashAndShortTermInvestments != null && v.totalDebt != null) ? v.cashAndShortTermInvestments - v.totalDebt : null;
        case '_workingCapital': return (v.totalCurrentAssets != null && v.totalCurrentLiabilities != null) ? v.totalCurrentAssets - v.totalCurrentLiabilities : null;
        case '_bookValuePerShare': {
            const sh = v.commonStockSharesOutstanding || v.totalCommonShares;
            return v.totalStockholdersEquity && sh ? v.totalStockholdersEquity / sh : null;
        }
        case '_tangibleBV':     return v.totalStockholdersEquity != null ? v.totalStockholdersEquity - (v.goodwill||0) - (v.intangibleAssets||0) : null;
        case '_ocfGrowth':      return growthPct(v.operatingCashFlow, p?.operatingCashFlow);
        case '_fcfGrowth':      return growthPct(v.freeCashFlow, p?.freeCashFlow);
        case '_fcfMargin': {
            const rev = incomeRow?.revenue ?? v.revenue;
            return v.freeCashFlow && rev ? (v.freeCashFlow / rev) * 100 : null;
        }
        case '_fcfPerShare': {
            const sh = incomeRow?.weightedAverageShsOutDil;
            return v.freeCashFlow && sh ? v.freeCashFlow / sh : null;
        }
        default: return null;
    }
}

function periodLabel(item, period) {
    if (!item?.date) return '—';
    const d = new Date(item.date);
    if (period === 'quarterly') {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `Q${q} ${d.getFullYear()}`;
    }
    return `FY ${d.getFullYear()}`;
}

// ============================================================================
// RENDER TABLE
// ============================================================================

function renderFinancialTable(tableId, rows, data, period = 'annual', incomeDataForCF = null) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    const MAX = period === 'quarterly' ? 8 : 5;
    const displayData = (data || []).slice(0, MAX);

    if (!displayData.length) {
        if (thead) thead.innerHTML = '<th>Metric</th>';
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-secondary)">Data unavailable</td></tr>`;
        return;
    }

    // Header
    if (thead) {
        thead.innerHTML = `<th style="text-align:left;min-width:220px">Fiscal Year</th>` +
            displayData.map(d => `<th>${periodLabel(d, period)}</th>`).join('');
    }

    // Period ending row
    let html = `<tr style="background:var(--hover-bg);border-bottom:2px solid var(--border-color)">
        <td><strong>Period Ending</strong></td>
        ${displayData.map(d => `<td><strong>${new Date(d.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</strong></td>`).join('')}
    </tr>`;

    rows.forEach(row => {
        // Section header
        if (row.isSection) {
            html += `<tr style="background:var(--hover-bg)">
                <td colspan="${displayData.length + 1}" style="font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-secondary);padding:8px 14px">${row.label}</td>
            </tr>`;
            return;
        }

        let nameStyle = '';
        if (row.bold)   nameStyle += 'font-weight:700;';
        if (row.indent) nameStyle += 'padding-left:28px;color:var(--text-secondary);font-size:0.88rem;';

        let rowHtml = `<tr><td style="${nameStyle}">${row.label}</td>`;

        displayData.forEach((yearData, idx) => {
            const nextYearData = displayData[idx + 1] || null;
            const incRow = incomeDataForCF ? (incomeDataForCF[idx] || null) : null;

            let value;
            const isDerived = row.key?.startsWith('_');

            if (isDerived) {
                value = computeDerived(row, yearData, nextYearData, incRow);
            } else {
                value = yearData[row.key];
            }

            let cell = '—';
            let colorStyle = '';

            if (value != null && isFinite(value)) {
                if (row.isGrowth || (row.isPercent && isDerived)) {
                    cell = value.toFixed(2) + '%';
                    colorStyle = value > 0 ? 'color:#10B981' : value < 0 ? 'color:#EF4444' : '';
                } else if (row.isPercent) {
                    // /ratios values are already in ratio form (0.45 = 45%)
                    const pct = Math.abs(value) <= 2 ? value * 100 : value;
                    cell = pct.toFixed(2) + '%';
                    colorStyle = value > 0 ? 'color:#10B981' : value < 0 ? 'color:#EF4444' : '';
                } else if (row.isCurrency) {
                    if (Math.abs(value) >= 1) cell = '$' + value.toFixed(2);
                    else cell = '$' + value.toFixed(4);
                } else {
                    cell = fmtNum(value);
                }
            }

            rowHtml += `<td style="text-align:right;${row.bold ? 'font-weight:600;' : ''}${colorStyle}">${cell}</td>`;
        });

        rowHtml += '</tr>';
        html += rowHtml;
    });

    if (tbody) tbody.innerHTML = html;
}

// ============================================================================
// LOAD DATA
// ============================================================================

async function loadAllFinancialData(symbol) {
    try {
        currentSymbol = symbol;
        console.log(`📊 Loading financial tabs data for ${symbol}...`);

        // Annual: income, balance, cashflow, ratios, key-metrics
        const [incA, balA, cfA, ratA, kmA] = await Promise.all([
            fmpAPI.getIncomeStatement(symbol, 5),
            fmpAPI.getBalanceSheet(symbol, 5),
            fmpAPI.getCashFlow(symbol, 5),
            fmpAPI.getRatios(symbol, 5),
            fmpAPI.getKeyMetrics(symbol, 5),
        ]);

        // Quarterly: income, balance, cashflow (pages 0+1 = up to 10 quarters)
        const [incQ0, incQ1, balQ0, balQ1, cfQ0, cfQ1] = await Promise.all([
            fmpAPI.makeRequest(`/income-statement/${symbol}`,        { period: 'quarter', limit: 5, page: 0 }).catch(() => []),
            fmpAPI.makeRequest(`/income-statement/${symbol}`,        { period: 'quarter', limit: 5, page: 1 }).catch(() => []),
            fmpAPI.makeRequest(`/balance-sheet-statement/${symbol}`, { period: 'quarter', limit: 5, page: 0 }).catch(() => []),
            fmpAPI.makeRequest(`/balance-sheet-statement/${symbol}`, { period: 'quarter', limit: 5, page: 1 }).catch(() => []),
            fmpAPI.makeRequest(`/cash-flow-statement/${symbol}`,     { period: 'quarter', limit: 5, page: 0 }).catch(() => []),
            fmpAPI.makeRequest(`/cash-flow-statement/${symbol}`,     { period: 'quarter', limit: 5, page: 1 }).catch(() => []),
        ]);

        const dedup = arr => {
            const seen = new Set();
            return arr.filter(r => r?.date && !seen.has(r.date) && seen.add(r.date));
        };

        financialData = {
            income:  { annual: Array.isArray(incA) ? incA : [], quarterly: dedup([...(incQ0||[]), ...(incQ1||[])]) },
            balance: { annual: Array.isArray(balA) ? balA : [], quarterly: dedup([...(balQ0||[]), ...(balQ1||[])]) },
            cashflow:{ annual: Array.isArray(cfA)  ? cfA  : [], quarterly: dedup([...(cfQ0||[]),  ...(cfQ1||[])]) },
            ratios:  { annual: Array.isArray(ratA) ? ratA : [], quarterly: [] },
            metrics: { annual: Array.isArray(kmA)  ? kmA  : [], quarterly: [] },
        };

        console.log('✅ Financial tabs data loaded');
        return financialData;
    } catch (err) {
        console.error('❌ Error loading financial tabs:', err);
        return null;
    }
}

// ============================================================================
// UPDATE TAB
// ============================================================================

function updateFinancialTab(tabName, period) {
    const tableId = tabName + 'Table';

    if (tabName === 'income') {
        renderFinancialTable(tableId, INCOME_STATEMENT_ROWS, financialData.income[period], period);
    } else if (tabName === 'balance') {
        renderFinancialTable(tableId, BALANCE_SHEET_ROWS, financialData.balance[period], period);
    } else if (tabName === 'cashflow') {
        // Pass income data so FCF/share and FCF margin can use shares + revenue
        renderFinancialTable(tableId, CASH_FLOW_ROWS, financialData.cashflow[period], period, financialData.income[period]);
    } else if (tabName === 'ratios') {
        renderFinancialTable(tableId, RATIOS_ROWS, financialData.ratios['annual'], period);
    } else if (tabName === 'kpis') {
        renderFinancialTable(tableId, KPIS_ROWS, financialData.metrics['annual'], period);
    }
}

// ============================================================================
// PERIOD BUTTON LISTENERS
// ============================================================================

function initializePeriodButtons() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const period = this.dataset.period;

            // Determine which tab panel contains this button
            const panel = this.closest('.fin-content') || this.closest('[id$="-tab"]') || this.closest('.tab-content');
            if (!panel) return;

            // Toggle active class among siblings
            const siblings = this.closest('.period-toggle, .fin-period-nav')?.querySelectorAll('.period-btn');
            if (siblings) siblings.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Determine which tab
            const tabName = panel.id.replace('-tab','').replace('fin-','').replace('Tab','').toLowerCase();
            updateFinancialTab(tabName, period);
        });
    });
}

// ============================================================================
// GLOBAL INIT
// ============================================================================

window.initializeFinancialTabs = async function (symbol) {
    console.log('🚀 Initializing financial tabs for:', symbol);
    await loadAllFinancialData(symbol);

    // Render all tabs at default Annual period
    ['income', 'balance', 'cashflow', 'ratios', 'kpis'].forEach(tab => updateFinancialTab(tab, 'annual'));

    initializePeriodButtons();
    console.log('✅ Financial tabs initialized');
};

// Also expose updateFinancialTab globally for inline onclick
window.updateFinancialTab = updateFinancialTab;
