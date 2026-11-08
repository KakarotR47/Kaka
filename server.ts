import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

import { spawn } from 'child_process';
import { renderReceiptSlipHtml } from './src/services/receiptHtmlGenerator.ts';

dotenv.config();
// Ensure HMR is disabled in AI Studio dev environment to prevent WebSocket connection failures
process.env.DISABLE_HMR = 'true';
process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// In-memory cache for clean print URLs
const recentPrintReceipts = new Map<string, { transaction: any; settings?: any }>();

// Determine port: CLI arguments (--port 3000) take precedence; in dev mode, default strictly to 3000
function resolvePort(): number {
  const args = process.argv.slice(2);
  const portIdx = args.findIndex((arg) => arg === '--port' || arg === '-p');
  if (portIdx !== -1 && args[portIdx + 1]) {
    const parsed = parseInt(args[portIdx + 1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  // In development, always default to 3000 for AI Studio dev server
  if (process.env.NODE_ENV !== 'production') {
    return 3000;
  }
  // In production, use container PORT env var if available
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 3000;
}

const PORT = resolvePort();

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dedicated Print Window Endpoints (Opens outside iframe for native printer dialog)
app.post('/api/prepare-print-slip', (req, res) => {
  try {
    const { transaction, settings } = req.body;
    if (!transaction || !transaction.receiptNumber) {
      return res.status(400).json({ error: 'Invalid transaction data' });
    }
    recentPrintReceipts.set(transaction.receiptNumber, { transaction, settings });
    res.json({
      ok: true,
      url: `/print-slip/${encodeURIComponent(transaction.receiptNumber)}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.get('/print-slip/:receiptNumber', (req, res) => {
  const { receiptNumber } = req.params;
  const entry = recentPrintReceipts.get(receiptNumber);
  if (entry) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderReceiptSlipHtml(entry.transaction, entry.settings));
  }
  res.status(404).send('<h1>Receipt not found</h1><p>Please open the receipt in the POS register and click Print.</p>');
});

app.get('/print-slip', (req, res) => {
  try {
    const rawData = req.query.receipt as string;
    if (!rawData) {
      return res.status(400).send('Receipt data required');
    }
    let transaction: any;
    try {
      transaction = JSON.parse(rawData);
    } catch {
      try {
        transaction = JSON.parse(decodeURIComponent(rawData));
      } catch (err2: any) {
        return res.status(400).send('Invalid receipt payload: ' + err2?.message);
      }
    }
    const html = renderReceiptSlipHtml(transaction);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send('Failed to generate print slip: ' + err?.message);
  }
});

// Download full project source code archive
app.get('/api/download-project', (_req, res) => {
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', 'attachment; filename="sa-brothers-vendors-project.tar.gz"');

  const tarProcess = spawn('tar', [
    '--exclude=node_modules',
    '--exclude=dist',
    '--exclude=.git',
    '-czf',
    '-',
    '-C',
    path.resolve(__dirname),
    '.'
  ]);

  tarProcess.stdout.pipe(res);

  tarProcess.stderr.on('data', (data) => {
    console.error('Tar stderr:', data.toString());
  });

  tarProcess.on('error', (err) => {
    console.error('Failed to create archive:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create archive' });
    }
  });
});

// Download ready-to-import MySQL database dump
app.get('/api/download-sql', (_req, res) => {
  const sqlFilePath = path.resolve(__dirname, 'sa_brothers_pos.sql');
  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sa_brothers_pos.sql"');
  res.sendFile(sqlFilePath);
});

// Automated End-of-Day AI Executive Analysis Endpoint (Powered by Gemini Pro)
app.post('/api/analyze-eod', async (req, res) => {
  try {
    const { reportData, shopName, currency = 'PKR' } = req.body;

    if (!reportData) {
      return res.status(400).json({ error: 'Missing reportData in request body' });
    }

    const cur = currency || 'PKR';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback to rich automated analysis when no Gemini API key is configured
      const automatedSummary = generateRuleBasedAnalysis(reportData, shopName || 'SA Brothers Vendors', cur);
      return res.json({
        analysis: automatedSummary,
        source: 'automated-rule-engine'
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert retail shop business consultant. Analyze the following End-of-Day (EOD) sales, profit, and inventory report for "${shopName || 'SA Brothers Vendors'}".
Date: ${reportData.date}
Gross Revenue: ${cur} ${Number(reportData.grossSales || 0).toFixed(2)}
Net Sales: ${cur} ${Number(reportData.netSales || 0).toFixed(2)}
Discounts Given: ${cur} ${Number(reportData.discountsGiven || 0).toFixed(2)}
Cost of Goods Sold (COGS): ${cur} ${Number(reportData.totalCostOfGoods || 0).toFixed(2)}
Gross Profit: ${cur} ${Number(reportData.grossProfit || 0).toFixed(2)} (${Number(reportData.grossMarginPercent || 0).toFixed(1)}% margin)
Operating Expenses: ${cur} ${Number(reportData.totalExpenses || 0).toFixed(2)}
Net Daily Profit: ${cur} ${Number(reportData.netDailyProfit || 0).toFixed(2)}
Total Transactions: ${reportData.transactionCount || 0}
Total Items Sold: ${reportData.itemsSoldCount || 0}
Payment Breakdown: Cash: ${cur} ${Number(reportData.cashSales || 0).toFixed(2)}, Card: ${cur} ${Number(reportData.cardSales || 0).toFixed(2)}, Mobile/QR: ${cur} ${Number(reportData.mobileSales || 0).toFixed(2)}
Expected Cash in Drawer: ${cur} ${Number(reportData.expectedCashInDrawer || 0).toFixed(2)}
Low Stock Alerts: ${reportData.lowStockAlertCount || 0} items low on stock
Top Selling Products: ${JSON.stringify(reportData.topSellingProducts || [])}

Provide a concise, practical executive briefing for the shopkeeper divided into 3 short sections:
1. **Daily Financial Health & Margin Highlights**: Evaluate today's revenue, profit margin, and expense ratios.
2. **Sales & Product Velocity**: Highlight what performed best and any slow-moving category observations.
3. **Actionable Recommendations for Tomorrow**: 2-3 specific actions (e.g. restocking, promotion, cash drawer checks).
Keep tone professional, encouraging, and razor-focused on retail store profitability. Use currency ${cur}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });

    const analysisText = response.text || generateRuleBasedAnalysis(reportData, shopName || 'SA Brothers Vendors', cur);

    return res.json({
      analysis: analysisText,
      source: 'gemini-2.5-pro'
    });
  } catch (error: any) {
    console.error('Error generating AI analysis:', error);
    // Graceful fallback to rule-based engine on error
    const cur = req.body?.currency || 'PKR';
    const fallback = generateRuleBasedAnalysis(req.body?.reportData || {}, req.body?.shopName || 'SA Brothers Vendors', cur);
    return res.json({
      analysis: fallback,
      source: 'automated-rule-engine-fallback'
    });
  }
});

function generateRuleBasedAnalysis(data: any, shopName: string, cur: string = 'PKR'): string {
  const margin = Number(data.grossMarginPercent || 0);
  const netProfit = Number(data.netDailyProfit || 0);
  const netSales = Number(data.netSales || 0);
  const expenses = Number(data.totalExpenses || 0);
  const lowStock = Number(data.lowStockAlertCount || 0);
  const topProducts = Array.isArray(data.topSellingProducts) ? data.topSellingProducts : [];
  const topItemName = topProducts[0]?.name || 'Top items';

  let marginAssessment = 'healthy and balanced';
  if (margin < 20) marginAssessment = 'tight; review supplier cost pricing or adjust markups';
  else if (margin > 45) marginAssessment = 'exceptionally strong';

  let expenseAssessment = 'operating expenses are within normal retail thresholds';
  if (netSales > 0 && expenses / netSales > 0.35) {
    expenseAssessment = 'operating overhead consumed over 35% of revenue today; monitor utility or freight costs';
  }

  return `### Daily Financial Health & Margin Highlights
Today, ${shopName} generated **${cur} ${netSales.toFixed(2)}** in net sales with a **${margin.toFixed(1)}%** gross margin, yielding **${cur} ${netProfit.toFixed(2)}** in net daily profit. The store's gross margin is ${marginAssessment}, and ${expenseAssessment}.

### Sales & Product Velocity
A total of **${data.itemsSoldCount || 0} units** were sold across **${data.transactionCount || 0} customer orders**. Customer demand was led by **${topItemName}**, which generated the highest turnover today. Payment collection was well-distributed across payment channels.

### Actionable Recommendations for Tomorrow
- **Stock Replenishment**: There are currently **${lowStock} products** at or below low-stock safety thresholds. Submit supplier purchase orders before peak morning trade.
- **Cash Drawer Audit**: Verify the physical cash count against the expected till total of **${cur} ${Number(data.expectedCashInDrawer || 0).toFixed(2)}**.
- **Promotional Bundles**: Consider pairing high-margin items with fast-moving staples to further increase the average basket size.`;
}

// Development and Production setup
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: false,
        hmr: false,
      },
      plugins: [
        {
          name: 'disable-hmr-ws-client',
          transform(code, id) {
            if (id.includes('@vite/client') || id.includes('vite/dist/client/client.mjs')) {
              return {
                code: code
                  .replace('async connect(handlers) {', 'async connect(handlers) { return; /* HMR disabled */')
                  .replace(/throw e;/g, 'return;')
                  .replace(/console\.error\(`\[vite\] failed to connect to websocket[^\`]*`\);/g, '/* HMR WebSocket disabled */'),
              };
            }
          },
        },
      ],
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Generic error handling middleware
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', details: err?.message });
    }
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Error] Port ${PORT} is already in use. Please terminate any conflicting processes.`);
    } else {
      console.error('[Error] Server encounter an error:', err);
    }
  });
}

// Global safety net for unexpected exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

startServer();
