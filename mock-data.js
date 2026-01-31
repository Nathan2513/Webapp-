// ==========================================
// CONFIGURATION
// ==========================================
const API_TOKEN = "TA_CLE_EOD"; // Tu mettras ta vraie clé plus tard
const USE_MOCK_DATA = true;     // <--- METTRE SUR FALSE POUR PASSER EN RÉEL

// ==========================================
// DONNÉES FACTICES (AMAZON - STYLE EOD)
// ==========================================
const MOCK_AMZN = {
    "General": {
        "Code": "AMZN",
        "Type": "Common Stock",
        "Name": "Amazon.com Inc",
        "Exchange": "US",
        "CurrencyCode": "USD",
        "Sector": "Consumer Cyclical",
        "Industry": "Internet Retail",
        "Description": "Amazon.com, Inc. engages in the retail sale of consumer products and subscriptions in North America and internationally...",
        "LogoURL": "https://eodhistoricaldata.com/img/logos/US/amzn.png"
    },
    "Highlights": {
        "MarketCapitalization": 1500000000000,
        "MarketCapitalizationMln": 1500000.00,
        "EBITDA": 85000000000,
        "PERatio": 60.5,
        "PEGRatio": 2.1,
        "WallStreetTargetPrice": 185.00,
        "BookValue": 15.2,
        "DividendShare": 0,
        "DividendYield": 0,
        "EarningsShare": 2.5,
        "EPSEstimateCurrentYear": 3.1,
        "EPSEstimateNextYear": 4.5,
        "ProfitMargin": 0.05,
        "OperatingMarginTtm": 0.08,
        "ReturnOnAssetsTTM": 0.04,
        "ReturnOnEquityTTM": 0.12
    },
    "Financials": {
        "Balance_Sheet": {
            "currency_symbol": "$",
            "yearly": {
                "2023-12-31": {
                    "date": "2023-12-31",
                    "totalAssets": "462675000000",
                    "totalLiabilities": "260000000000",
                    "totalStockholderEquity": "202675000000",
                    "netDebt": "50000000000"
                },
                "2022-12-31": {
                    "date": "2022-12-31",
                    "totalAssets": "420000000000",
                    "totalLiabilities": "240000000000",
                    "totalStockholderEquity": "180000000000",
                    "netDebt": "60000000000"
                }
            }
        },
        "Income_Statement": {
            "currency_symbol": "$",
            "yearly": {
                "2023-12-31": {
                    "date": "2023-12-31",
                    "totalRevenue": "574785000000",
                    "costOfRevenue": "350000000000",
                    "grossProfit": "224785000000",
                    "netIncome": "30425000000",
                    "ebitda": "85500000000"
                },
                "2022-12-31": {
                    "date": "2022-12-31",
                    "totalRevenue": "513983000000",
                    "costOfRevenue": "310000000000",
                    "grossProfit": "203983000000",
                    "netIncome": "-2722000000",
                    "ebitda": "55000000000"
                }
            }
        },
        "Cash_Flow": {
            "currency_symbol": "$",
            "yearly": {
                "2023-12-31": {
                    "date": "2023-12-31",
                    "investments": "-20000000000",
                    "changeToLiabilities": "5000000000",
                    "totalCashFromOperatingActivities": "84900000000",
                    "capitalExpenditures": "-48000000000",
                    "freeCashFlow": "36900000000" 
                },
                "2022-12-31": {
                    "date": "2022-12-31",
                    "totalCashFromOperatingActivities": "46752000000",
                    "capitalExpenditures": "-63645000000",
                    "freeCashFlow": "-16893000000"
                }
            }
        }
    }
};

// ==========================================
// FONCTION PRINCIPALE POUR RÉCUPÉRER LES INFOS
// ==========================================
async function getStockData(ticker) {
    // 1. MODE MOCK : On renvoie les fausses données immédiatement
    if (USE_MOCK_DATA) {
        console.log(`[DEV MODE] Chargement des données factices pour ${ticker}...`);
        
        // Petite simulation de délai pour faire "vrai" (500ms)
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(MOCK_AMZN); 
            }, 500);
        });
    }

    // 2. MODE RÉEL : Appel API EOD (Ne sera exécuté que si USE_MOCK_DATA = false)
    try {
        const symbol = ticker + ".US"; // EOD demande le suffixe .US pour les USA
        const url = `https://eodhd.com/api/fundamentals/${symbol}?api_token=${API_TOKEN}&fmt=json`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Erreur API EOD");
        
        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Erreur lors de la récupération :", error);
        return null;
    }
}

// ==========================================
// EXEMPLE D'UTILISATION
// ==========================================
// Cette fonction permet de tester si ça marche
async function test() {
    const data = await getStockData("AMZN");
    console.log("Nom de l'entreprise : ", data.General.Name);
    console.log("Prix Cible WallStreet : ", data.Highlights.WallStreetTargetPrice);
    console.log("Free Cash Flow 2023 : ", data.Financials.Cash_Flow.yearly['2023-12-31'].freeCashFlow);
}

// Décommente la ligne ci-dessous pour tester dans ta console
// test();
