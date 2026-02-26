// ============================================================================
// STOCK SCREENER - FINANCIAL TABS ENHANCEMENT
// ============================================================================
// Ce fichier ajoute les 4 onglets financiers (Income, Balance, Cash Flow, Ratios)
// avec les boutons Annual/Quarterly/TTM fonctionnels
// ============================================================================

// Variables globales pour stocker les données
let currentSymbol = '';
let financialData = {
    income: { annual: [], quarterly: [], ttm: null },
    balance: { annual: [], quarterly: [], ttm: null },
    cashflow: { annual: [], quarterly: [], ttm: null },
    ratios: { annual: [], quarterly: [], ttm: null }
};

// ============================================================================
// CONFIGURATION DES LIGNES POUR CHAQUE STATEMENT
// ============================================================================

const INCOME_STATEMENT_ROWS = [
    { label: "Revenue", key: "revenue", bold: true },
    { label: "Revenue Growth (YoY)", key: "growth", isPercent: true },
    { label: "Cost of Revenue", key: "costOfRevenue" },
    { label: "Gross Profit", key: "grossProfit", bold: true },
    { label: "  Selling, General & Admin", key: "sellingGeneralAndAdministrativeExpenses", indent: true },
    { label: "  Research & Development", key: "researchAndDevelopmentExpenses", indent: true },
    { label: "  Other Operating Expenses", key: "otherExpenses", indent: true },
    { label: "Operating Expenses", key: "operatingExpenses", bold: true },
    { label: "Operating Income", key: "operatingIncome", bold: true },
    { label: "Interest Expense", key: "interestExpense" },
    { label: "Interest & Investment Income", key: "interestIncome" },
    { label: "Earnings From Equity Investments", key: "incomeFromEquityInvestments" },
    { label: "Currency Exchange Gain (Loss)", key: "foreignExchangeGainLoss" },
    { label: "Other Non Operating Income (Expense)", key: "otherNonOperatingIncome" },
    { label: "EBT Excluding Unusual Items", key: "incomeBeforeTax", bold: true },
    { label: "Gain (Loss) on Sale of Investments", key: "gainLossOnSaleOfInvestments" },
    { label: "Asset Writedown", key: "assetImpairmentCharge" },
    { label: "Other Unusual Items", key: "unusualItems" },
    { label: "Pretax Income", key: "incomeBeforeTax", bold: true },
    { label: "Income Tax Expense", key: "incomeTaxExpense" },
    { label: "Net Income", key: "netIncome", bold: true },
    { label: "Net Income to Common", key: "netIncomeToCommon" },
    { label: "  Net Income Growth", key: "netIncomeGrowth", isPercent: true, indent: true },
    { label: "Shares Outstanding (Basic)", key: "weightedAverageShsOut" },
    { label: "Shares Outstanding (Diluted)", key: "weightedAverageShsOutDil" },
    { label: "  Shares Change (YoY)", key: "sharesChange", isPercent: true, indent: true },
    { label: "EPS (Basic)", key: "eps", isCurrency: true },
    { label: "EPS (Diluted)", key: "epsdiluted", isCurrency: true },
    { label: "  EPS Growth", key: "epsGrowth", isPercent: true, indent: true }
];

const BALANCE_SHEET_ROWS = [
    // Assets
    { label: "Cash & Equivalents", key: "cashAndCashEquivalents", bold: true },
    { label: "Short-Term Investments", key: "shortTermInvestments" },
    { label: "Trading Asset Securities", key: "marketableSecurities" },
    { label: "Cash & Short-Term Investments", key: "cashAndShortTermInvestments", bold: true },
    { label: "  Cash Growth", key: "cashGrowth", isPercent: true, indent: true },
    { label: "Accounts Receivable", key: "netReceivables" },
    { label: "Other Receivables", key: "otherReceivables" },
    { label: "Receivables", key: "totalReceivables", bold: true },
    { label: "Inventory", key: "inventory" },
    { label: "Prepaid Expenses", key: "prepaidExpenses" },
    { label: "Restricted Cash", key: "restrictedCash" },
    { label: "Other Current Assets", key: "otherCurrentAssets" },
    { label: "Total Current Assets", key: "totalCurrentAssets", bold: true },
    { label: "Property, Plant & Equipment", key: "propertyPlantEquipmentNet" },
    { label: "Long-Term Investments", key: "longTermInvestments" },
    { label: "Goodwill", key: "goodwill" },
    { label: "Other Intangible Assets", key: "intangibleAssets" },
    { label: "Long-Term Accounts Receivable", key: "longTermReceivables" },
    { label: "Long-Term Deferred Tax Assets", key: "deferredTaxAssetsNonCurrent" },
    { label: "Other Long-Term Assets", key: "otherNonCurrentAssets" },
    { label: "Total Assets", key: "totalAssets", bold: true },
    // Liabilities
    { label: "Accounts Payable", key: "accountPayables" },
    { label: "Accrued Expenses", key: "accruedLiabilities" },
    { label: "Short-Term Debt", key: "shortTermDebt" },
    { label: "Current Portion of Long-Term Debt", key: "capitalLeaseObligations" },
    { label: "Current Portion of Leases", key: "currentPortionOfLeases" },
    { label: "Current Income Taxes Payable", key: "taxPayables" },
    { label: "Current Unearned Revenue", key: "deferredRevenue" },
    { label: "Other Current Liabilities", key: "otherCurrentLiabilities" },
    { label: "Total Current Liabilities", key: "totalCurrentLiabilities", bold: true },
    { label: "Long-Term Debt", key: "longTermDebt" },
    { label: "Long-Term Leases", key: "longTermLeases" },
    { label: "Long-Term Deferred Tax Liabilities", key: "deferredTaxLiabilitiesNonCurrent" },
    { label: "Other Long-Term Liabilities", key: "otherNonCurrentLiabilities" },
    { label: "Total Liabilities", key: "totalLiabilities", bold: true },
    // Equity
    { label: "Additional Paid-In Capital", key: "commonStock" },
    { label: "Retained Earnings", key: "retainedEarnings" },
    { label: "Treasury Stock", key: "treasuryStock" },
    { label: "Comprehensive Income & Other", key: "accumulatedOtherComprehensiveIncomeLoss" },
    { label: "Total Common Equity", key: "totalStockholdersEquity", bold: true },
    { label: "Shareholders' Equity", key: "totalEquity", bold: true },
    { label: "Total Liabilities & Equity", key: "totalLiabilitiesAndStockholdersEquity", bold: true },
    // Additional
    { label: "Total Debt", key: "totalDebt", bold: true },
    { label: "Net Cash (Debt)", key: "netDebt" },
    { label: "  Net Cash Per Share", key: "netCashPerShare", isCurrency: true, indent: true },
    { label: "Filing Date Shares Outstanding", key: "filingDateSharesOutstanding" },
    { label: "Total Common Shares Outstanding", key: "commonStockSharesOutstanding" },
    { label: "Working Capital", key: "workingCapital" },
    { label: "Book Value Per Share", key: "bookValuePerShare", isCurrency: true },
    { label: "Tangible Book Value", key: "tangibleAssets" },
    { label: "  Tangible Book Value Per Share", key: "tangibleBookValuePerShare", isCurrency: true, indent: true }
];

const CASH_FLOW_ROWS = [
    { label: "Net Income", key: "netIncome", bold: true },
    { label: "Depreciation & Amortization", key: "depreciationAndAmortization" },
    { label: "Loss (Gain) on Equity Investments", key: "lossGainOnEquityInvestments" },
    { label: "Stock-Based Compensation", key: "stockBasedCompensation" },
    { label: "Provision & Write-off of Bad Debts", key: "provisionWriteOffBadDebts" },
    { label: "Other Operating Activities", key: "otherOperatingActivities" },
    { label: "Change in Accounts Receivable", key: "changeInReceivables" },
    { label: "Change in Inventory", key: "changeInInventory" },
    { label: "Change in Accounts Payable", key: "changeInAccountsPayable" },
    { label: "Change in Other Net Operating Assets", key: "changeInOtherNetOperatingAssets" },
    { label: "Operating Cash Flow", key: "operatingCashFlow", bold: true },
    { label: "  Operating Cash Flow Growth", key: "operatingCashFlowGrowth", isPercent: true, indent: true },
    { label: "Capital Expenditures", key: "capitalExpenditure" },
    { label: "Cash Acquisitions", key: "acquisitionsNet" },
    { label: "Sale (Purchase) of Intangibles", key: "purchaseOfIntangibles" },
    { label: "Investment in Securities", key: "investmentsInPropertyPlantAndEquipment" },
    { label: "Other Investing Activities", key: "otherInvestingActivites" },
    { label: "Investing Cash Flow", key: "netCashUsedForInvestingActivites", bold: true },
    { label: "Long-Term Debt Issued", key: "debtRepayment" },
    { label: "Long-Term Debt Repaid", key: "longTermDebtPayment" },
    { label: "Net Debt Issued (Repaid)", key: "netDebtIssued" },
    { label: "Issuance of Common Stock", key: "commonStockIssued" },
    { label: "Repurchase of Common Stock", key: "commonStockRepurchased" },
    { label: "Other Financing Activities", key: "otherFinancingActivites" },
    { label: "Financing Cash Flow", key: "netCashUsedProvidedByFinancingActivities", bold: true },
    { label: "Foreign Exchange Rate Adjustment", key: "effectOfForexChangesOnCash" },
    { label: "Net Cash Flow", key: "netChangeInCash", bold: true },
    { label: "Free Cash Flow", key: "freeCashFlow", bold: true },
    { label: "  Free Cash Flow Growth", key: "freeCashFlowGrowth", isPercent: true, indent: true },
    { label: "  Free Cash Flow Margin", key: "freeCashFlowMargin", isPercent: true, indent: true },
    { label: "  Free Cash Flow Per Share", key: "freeCashFlowPerShare", isCurrency: true, indent: true },
    { label: "Cash Interest Paid", key: "cashInterestPaid" },
    { label: "Cash Income Tax Paid", key: "incomeTaxesPaid" },
    { label: "Levered Free Cash Flow", key: "leveredFreeCashFlow" },
    { label: "Unlevered Free Cash Flow", key: "unleveredFreeCashFlow" },
    { label: "Change in Working Capital", key: "changeInWorkingCapital" }
];

const RATIOS_KPIS_ROWS = [
    // Market
    { label: "Market Capitalization", key: "marketCap", bold: true },
    { label: "  Market Cap Growth", key: "marketCapGrowth", isPercent: true, indent: true },
    { label: "Enterprise Value", key: "enterpriseValue" },
    { label: "Last Close Price", key: "lastClosePrice", isCurrency: true },
    // Valuation
    { label: "PE Ratio", key: "priceToEarningsRatio", bold: true },
    { label: "Forward PE", key: "forwardPE" },
    { label: "PS Ratio", key: "priceToSalesRatio" },
    { label: "PB Ratio", key: "priceToBookRatio" },
    { label: "P/TBV Ratio", key: "priceTangibleBookValueRatio" },
    { label: "P/FCF Ratio", key: "priceToFreeCashFlowsRatio" },
    { label: "P/OCF Ratio", key: "priceToOperatingCashFlowsRatio" },
    { label: "PEG Ratio", key: "priceEarningsToGrowthRatio" },
    { label: "EV/Sales Ratio", key: "enterpriseValueToSalesRatio" },
    { label: "EV/EBITDA Ratio", key: "enterpriseValueToEBITDARatio" },
    { label: "EV/EBIT Ratio", key: "enterpriseValueToOperatingCashFlowRatio" },
    { label: "EV/FCF Ratio", key: "enterpriseValueToFreeCashFlowRatio" },
    // Debt
    { label: "Debt / Equity Ratio", key: "debtToEquity" },
    { label: "Debt / EBITDA Ratio", key: "debtToEBITDA" },
    { label: "Debt / FCF Ratio", key: "debtToFreeCashFlow" },
    { label: "Net Debt / Equity Ratio", key: "netDebtToEquity" },
    { label: "Net Debt / EBITDA Ratio", key: "netDebtToEBITDA" },
    { label: "Net Debt / FCF Ratio", key: "netDebtToFreeCashFlow" },
    // Activity
    { label: "Asset Turnover", key: "assetTurnover" },
    { label: "Inventory Turnover", key: "inventoryTurnover" },
    { label: "Quick Ratio", key: "quickRatio" },
    { label: "Current Ratio", key: "currentRatio" },
    // Returns
    { label: "Return on Equity (ROE)", key: "returnOnEquity", isPercent: true, bold: true },
    { label: "Return on Assets (ROA)", key: "returnOnAssets", isPercent: true },
    { label: "Return on Invested Capital (ROIC)", key: "returnOnCapitalEmployed", isPercent: true },
    { label: "Return on Capital Employed (ROCE)", key: "returnOnTangibleAssets", isPercent: true },
    // Yields
    { label: "Earnings Yield", key: "earningsYield", isPercent: true },
    { label: "FCF Yield", key: "freeCashFlowYield", isPercent: true },
    { label: "Buyback Yield / Dilution", key: "buybackYield", isPercent: true },
    { label: "Total Shareholder Return", key: "totalShareholderReturn", isPercent: true },
    // Margins
    { label: "Gross Margin", key: "grossProfitMargin", isPercent: true },
    { label: "Operating Margin", key: "operatingProfitMargin", isPercent: true },
    { label: "Profit Margin", key: "netProfitMargin", isPercent: true },
    { label: "Free Cash Flow Margin", key: "freeCashFlowMargin", isPercent: true },
    { label: "EBITDA", key: "ebitda", bold: true },
    { label: "  EBITDA Margin", key: "ebitdaMargin", isPercent: true, indent: true },
    { label: "D&A For EBITDA", key: "depreciationAndAmortization" },
    { label: "EBIT", key: "operatingIncome", bold: true },
    { label: "  EBIT Margin", key: "operatingProfitMargin", isPercent: true, indent: true },
    { label: "Effective Tax Rate", key: "effectiveTaxRate", isPercent: true },
    { label: "Revenue as Reported", key: "revenue" }
];

// ============================================================================
// FONCTION: Charger les données financières complètes
// ============================================================================

async function loadAllFinancialData(symbol) {
    try {
        currentSymbol = symbol;
        console.log(`📊 Loading all financial data for ${symbol}...`);

        // Fetch Annual data
        const [incomeAnnual, balanceAnnual, cashflowAnnual, ratiosAnnual, metricsAnnual] = await Promise.all([
            fmpAPI.getIncomeStatement(symbol, 5),
            fmpAPI.getBalanceSheet(symbol, 5),
            fmpAPI.getCashFlow(symbol, 5),
            fmpAPI.getFinancialRatios(symbol),
            fmpAPI.getKeyMetrics(symbol)
        ]);

        // Fetch Quarterly data
        const [incomeQuarterly, balanceQuarterly, cashflowQuarterly] = await Promise.all([
            fmpAPI.makeRequest(`/income-statement/${symbol}?period=quarter&limit=8`),
            fmpAPI.makeRequest(`/balance-sheet-statement/${symbol}?period=quarter&limit=8`),
            fmpAPI.makeRequest(`/cash-flow-statement/${symbol}?period=quarter&limit=8`)
        ]);

        // Fetch TTM data
        const ratiosTTM = await fmpAPI.getFinancialRatios(symbol); // Already TTM
        const metricsTTM = await fmpAPI.getKeyMetrics(symbol); // Already TTM

        // Store data
        financialData = {
            income: {
                annual: incomeAnnual || [],
                quarterly: incomeQuarterly || [],
                ttm: incomeAnnual && incomeAnnual[0] || null
            },
            balance: {
                annual: balanceAnnual || [],
                quarterly: balanceQuarterly || [],
                ttm: balanceAnnual && balanceAnnual[0] || null
            },
            cashflow: {
                annual: cashflowAnnual || [],
                quarterly: cashflowQuarterly || [],
                ttm: cashflowAnnual && cashflowAnnual[0] || null
            },
            ratios: {
                annual: ratiosAnnual || [],
                quarterly: [],
                ttm: { ...ratiosTTM[0], ...metricsTTM[0] }
            }
        };

        console.log('✅ All financial data loaded successfully');
        return financialData;
    } catch (error) {
        console.error('❌ Error loading financial data:', error);
        return null;
    }
}

// ============================================================================
// FONCTION: Render un tableau financier
// ============================================================================

function renderFinancialTable(tableId, rows, data, period = 'annual') {
    const table = document.getElementById(tableId);
    if (!table) return;

    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">Données non disponibles</td></tr>';
        return;
    }

    // Limiter aux 5 dernières années pour annual, 8 quarters pour quarterly
    const displayData = period === 'quarterly' ? data.slice(0, 8) : data.slice(0, 5);

    // Generate table headers
    thead.innerHTML = `
        <th style="text-align: left;">Fiscal Year</th>
        ${displayData.map(d => `<th>${period === 'quarterly' ? `Q${d.period} ${new Date(d.date).getFullYear()}` : `FY ${new Date(d.date).getFullYear()}`}</th>`).join('')}
    `;

    // Generate Period Ending row
    let html = `
        <tr style="font-size: 0.85rem; border-bottom: 2px solid var(--border-color); background-color: var(--bg-main);">
            <td><strong>Period Ending</strong></td>
            ${displayData.map(d => `<td><strong>${new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></td>`).join('')}
        </tr>
    `;

    // Generate data rows
    rows.forEach((row, index) => {
        let nameStyle = "";
        if (row.bold) nameStyle += "font-weight: 700; ";
        if (row.indent) nameStyle += "padding-left: 30px; color: var(--text-secondary); font-size: 0.9rem; ";

        let rowHtml = `<tr><td style="${nameStyle}">${row.label}</td>`;

        displayData.forEach((yearData, colIndex) => {
            let value;
            let formattedValue = "-";
            let colorStyle = "";

            // Handle special growth calculations
            if (row.key === "growth" && tableId === 'incomeTable') {
                if (colIndex < displayData.length - 1) {
                    const current = yearData.revenue;
                    const previous = displayData[colIndex + 1].revenue;
                    if (previous && previous !== 0) {
                        value = ((current - previous) / previous) * 100;
                        formattedValue = value.toFixed(2) + "%";
                        colorStyle = value > 0 ? 'color: var(--success-color);' : 'color: var(--danger-color);';
                    }
                }
            } else {
                value = yearData[row.key];
                if (value !== undefined && value !== null && value !== 0) {
                    if (row.isPercent) {
                        formattedValue = (value * 100).toFixed(2) + "%";
                        colorStyle = value > 0 ? 'color: var(--success-color);' : value < 0 ? 'color: var(--danger-color);' : '';
                    } else if (row.isCurrency) {
                        formattedValue = "$" + value.toFixed(2);
                    } else {
                        // Format as millions
                        formattedValue = (value / 1000000).toLocaleString('en-US', { maximumFractionDigits: 0 });
                    }
                }
            }

            rowHtml += `<td style="${row.bold ? 'font-weight: 600;' : ''} ${colorStyle} text-align: right;">${formattedValue}</td>`;
        });

        rowHtml += '</tr>';
        html += rowHtml;
    });

    tbody.innerHTML = html;
}

// ============================================================================
// FONCTION: Update un onglet financier
// ============================================================================

function updateFinancialTab(tabName, period) {
    console.log(`🔄 Updating ${tabName} tab with ${period} data`);

    const tableId = `${tabName}Table`;
    const dataKey = tabName === 'income' ? 'income' :
                    tabName === 'balance' ? 'balance' :
                    tabName === 'cashflow' ? 'cashflow' :
                    'ratios';

    const rows = tabName === 'income' ? INCOME_STATEMENT_ROWS :
                 tabName === 'balance' ? BALANCE_SHEET_ROWS :
                 tabName === 'cashflow' ? CASH_FLOW_ROWS :
                 RATIOS_KPIS_ROWS;

    let data = financialData[dataKey][period];

    // Handle TTM
    if (period === 'ttm') {
        data = [financialData[dataKey].ttm];
    }

    renderFinancialTable(tableId, rows, data, period);
}

// ============================================================================
// ÉVÉNEMENTS: Period buttons
// ============================================================================

function initializePeriodButtons() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const period = this.dataset.period;
            const tab = this.closest('.tab-content');
            const tabId = tab.id.replace('-tab', '');

            // Update active state
            tab.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Update table
            updateFinancialTab(tabId, period);
        });
    });
}

// ============================================================================
// EXPORT: Fonction d'initialisation globale
// ============================================================================

window.initializeFinancialTabs = async function(symbol) {
    console.log('🚀 Initializing financial tabs for:', symbol);

    // Load all data
    await loadAllFinancialData(symbol);

    // Render initial state (Annual for all tabs)
    updateFinancialTab('income', 'annual');
    updateFinancialTab('balance', 'annual');
    updateFinancialTab('cashflow', 'annual');
    updateFinancialTab('ratios', 'annual');

    // Initialize button listeners
    initializePeriodButtons();

    console.log('✅ Financial tabs initialized');
};
