import React, { useState, useMemo } from 'react';
import { useShop } from '../../context/ShopContext';
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  AlertTriangle,
  ArrowUpRight,
  Receipt,
  Wallet,
  Clock,
  ChevronRight,
  ShieldAlert,
  Lock,
} from 'lucide-react';

type TimeRange = 'today' | 'yesterday' | '7days' | '30days';

export const ShopDashboard: React.FC<{
  onNavigateToPos: () => void;
  onNavigateToInventory: () => void;
  onNavigateToExpenses: () => void;
  onNavigateToReports: () => void;
}> = ({
  onNavigateToPos,
  onNavigateToInventory,
  onNavigateToExpenses,
  onNavigateToReports,
}) => {
  const {
    products,
    transactions,
    expenses,
    todayStats,
    lowStockProducts,
    outOfStockProducts,
    totalAlertsCount,
    formatCurrency,
    restockProduct,
    isOwner,
    openProfileModal,
  } = useShop();

  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  // Compute stats according to selected time range
  const rangeMetrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let filteredTransactions = transactions.filter((t) => t.status === 'completed');
    let filteredExpenses = expenses;

    if (timeRange === 'today') {
      filteredTransactions = filteredTransactions.filter((t) => t.timestamp.startsWith(todayStr));
      filteredExpenses = filteredExpenses.filter((e) => e.date === todayStr);
    } else if (timeRange === 'yesterday') {
      filteredTransactions = filteredTransactions.filter((t) => t.timestamp.startsWith(yesterdayStr));
      filteredExpenses = filteredExpenses.filter((e) => e.date === yesterdayStr);
    } else if (timeRange === '7days') {
      filteredTransactions = filteredTransactions.filter((t) => new Date(t.timestamp) >= sevenDaysAgo);
      filteredExpenses = filteredExpenses.filter((e) => new Date(e.date) >= sevenDaysAgo);
    } else if (timeRange === '30days') {
      filteredTransactions = filteredTransactions.filter((t) => new Date(t.timestamp) >= thirtyDaysAgo);
      filteredExpenses = filteredExpenses.filter((e) => new Date(e.date) >= thirtyDaysAgo);
    }

    let grossRevenue = 0;
    let discounts = 0;
    let netRevenue = 0;
    let cogs = 0;
    let itemsSold = 0;

    filteredTransactions.forEach((tx) => {
      grossRevenue += tx.subtotal;
      discounts += tx.discountAmount;
      netRevenue += (tx.subtotal - tx.discountAmount);
      cogs += tx.totalCost;
      itemsSold += tx.items.reduce((s, i) => s + i.quantity, 0);
    });

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = netRevenue - cogs;
    const netProfit = grossProfit - totalExpenses;
    const marginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const aov = filteredTransactions.length > 0 ? netRevenue / filteredTransactions.length : 0;

    return {
      grossRevenue,
      discounts,
      netRevenue,
      cogs,
      totalExpenses,
      grossProfit,
      netProfit,
      marginPercent,
      ordersCount: filteredTransactions.length,
      itemsSold,
      aov,
      transactions: filteredTransactions,
      expenses: filteredExpenses,
    };
  }, [transactions, expenses, timeRange]);

  // Hourly curve breakdown for today
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 to 21:00
    const todayStr = new Date().toISOString().slice(0, 10);

    return hours.map((hour) => {
      let sales = 0;
      let cost = 0;
      let items = 0;

      transactions
        .filter((t) => t.status === 'completed' && t.timestamp.startsWith(todayStr))
        .forEach((tx) => {
          const txHour = new Date(tx.timestamp).getHours();
          if (txHour === hour) {
            sales += (tx.subtotal - tx.discountAmount);
            cost += tx.totalCost;
            items += tx.items.reduce((s, i) => s + i.quantity, 0);
          }
        });

      const profit = sales - cost;
      return {
        hour,
        label: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`,
        sales,
        profit,
        items,
      };
    });
  }, [transactions]);

  const maxHourlySales = Math.max(...hourlyData.map((d) => d.sales), 50);

  // Category revenue contribution breakdown
  const categoryContribution = useMemo(() => {
    const catMap: Record<string, { revenue: number; profit: number; items: number }> = {};

    rangeMetrics.transactions.forEach((tx) => {
      tx.items.forEach((item) => {
        const prod = products.find(
          (p) => p.id === item.productId || p.name.toLowerCase() === item.name.toLowerCase()
        );
        let cat = prod?.category;
        if (!cat) {
          const lower = item.name.toLowerCase();
          if (
            lower.includes('stamp') ||
            lower.includes('agreement') ||
            lower.includes('court') ||
            lower.includes('notry')
          ) {
            cat = 'Court Items';
          } else if (
            lower.includes('rim') ||
            lower.includes('paper') ||
            lower.includes('ledger') ||
            lower.includes('form') ||
            lower.includes('recpit') ||
            lower.includes('book') ||
            lower.includes('licence') ||
            lower.includes('domicile') ||
            lower.includes('nikah')
          ) {
            cat = 'Office Paper';
          } else {
            cat = 'Court Items';
          }
        }
        if (!catMap[cat]) {
          catMap[cat] = { revenue: 0, profit: 0, items: 0 };
        }
        catMap[cat].revenue += item.total;
        catMap[cat].profit += item.profit;
        catMap[cat].items += item.quantity;
      });
    });

    const totalRev = rangeMetrics.netRevenue || 1;
    return Object.entries(catMap)
      .map(([category, data]) => ({
        category,
        revenue: data.revenue,
        profit: data.profit,
        items: data.items,
        percentage: (data.revenue / totalRev) * 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [rangeMetrics, products]);

  // Top 5 Best Selling Products by Profit and Volume
  const topPerformers = useMemo(() => {
    const pMap: Record<string, { name: string; sku: string; units: number; revenue: number; profit: number }> = {};

    rangeMetrics.transactions.forEach((tx) => {
      tx.items.forEach((item) => {
        if (!pMap[item.productId]) {
          pMap[item.productId] = {
            name: item.name,
            sku: item.sku,
            units: 0,
            revenue: 0,
            profit: 0,
          };
        }
        pMap[item.productId].units += item.quantity;
        pMap[item.productId].revenue += item.total;
        pMap[item.productId].profit += item.profit;
      });
    });

    return Object.values(pMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [rangeMetrics]);

  if (!isOwner) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-2xs">
          <Lock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Profit Dashboard Restricted
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Staff profiles cannot view daily revenue, gross margins, net profit, or shop financial analytics. Please enter the Owner password to unlock.
          </p>
        </div>
        <button
          onClick={() => openProfileModal('prof-owner')}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
        >
          Unlock with Owner PIN
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header with Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Shop Performance Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time sales revenue, inventory health, operating expenses &amp; net profitability
          </p>
        </div>

        {/* Timeframe Segmented Control (Zero-pill button tabs) */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setTimeRange('today')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              timeRange === 'today'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeRange('yesterday')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              timeRange === 'yesterday'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setTimeRange('7days')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              timeRange === '7days'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeRange('30days')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              timeRange === '30days'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Main KPI Metric Cards (Clean, single elevation, tabular figures) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Daily Profit */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Net Operating Profit</span>
            <span
              className={`font-mono text-[11px] font-bold ${
                rangeMetrics.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
              }`}
            >
              {rangeMetrics.marginPercent.toFixed(1)}% margin
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-numbers text-slate-900 dark:text-white">
            {formatCurrency(rangeMetrics.netProfit)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Gross Profit: {formatCurrency(rangeMetrics.grossProfit)}</span>
            <span>Expenses: -{formatCurrency(rangeMetrics.totalExpenses)}</span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Net Sales Revenue</span>
            <span className="text-[11px] font-mono text-slate-400">
              {rangeMetrics.ordersCount} orders
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-numbers text-emerald-600 dark:text-emerald-400">
            {formatCurrency(rangeMetrics.netRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Avg Ticket: {formatCurrency(rangeMetrics.aov)}</span>
            <span>Discounts: {formatCurrency(rangeMetrics.discounts)}</span>
          </div>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Cost of Goods (COGS)</span>
            <span className="text-[11px] font-mono text-slate-400">
              {rangeMetrics.itemsSold} items sold
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-numbers text-slate-900 dark:text-white">
            {formatCurrency(rangeMetrics.cogs)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Supplier acquisition cost of sold items
          </div>
        </div>

        {/* Shop Operating Expenses */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Operating Expenses</span>
            <button
              onClick={onNavigateToExpenses}
              className="text-[11px] text-emerald-600 hover:underline flex items-center gap-0.5"
            >
              <span>Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-numbers text-rose-600 dark:text-rose-400">
            {formatCurrency(rangeMetrics.totalExpenses)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Rent, wages, utilities &amp; shop overhead
          </div>
        </div>
      </div>

      {/* Low Stock Alerts & Immediate Reorder Panel */}
      {totalAlertsCount > 0 && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Live Inventory Alerts ({totalAlertsCount} items require replenishment)
              </h2>
            </div>
            <button
              onClick={onNavigateToInventory}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>Manage All Inventory</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...outOfStockProducts, ...lowStockProducts].slice(0, 6).map((item) => {
              const isOut = item.currentStock <= 0;
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs ${
                    isOut
                      ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                      : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{item.sku}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-bold ${
                          isOut ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isOut ? 'Out of stock' : `${item.currentStock} remaining`}
                      </span>
                      <span className="text-slate-400">(min {item.minStockThreshold})</span>
                    </div>
                  </div>

                  <button
                    onClick={() => restockProduct(item.id, 12, undefined, 'Quick dashboard reorder')}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 rounded text-[11px] font-semibold transition-colors shrink-0"
                  >
                    +12 Restock
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts & Analytical Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Hourly Sales & Profit Velocity Chart */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sales &amp; Profit Velocity (Today by Hour)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hourly transaction volume and net gross profit generated at the shop
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" />
                <span className="text-slate-600 dark:text-slate-400">Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-slate-800 dark:bg-slate-300 rounded-xs" />
                <span className="text-slate-600 dark:text-slate-400">Gross Profit</span>
              </div>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-56 w-full flex items-end gap-1.5 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
            {hourlyData.map((d, index) => {
              const salesHeight = maxHourlySales > 0 ? (d.sales / maxHourlySales) * 100 : 0;
              const profitHeight = maxHourlySales > 0 ? (d.profit / maxHourlySales) * 100 : 0;
              const isHovered = hoveredHour === d.hour;

              return (
                <div
                  key={d.hour}
                  onMouseEnter={() => setHoveredHour(d.hour)}
                  onMouseLeave={() => setHoveredHour(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-14 bg-slate-900 text-white text-[11px] py-1 px-2 rounded shadow-lg z-20 whitespace-nowrap pointer-events-none">
                      <div className="font-bold">{d.label}</div>
                      <div>Sales: {formatCurrency(d.sales)}</div>
                      <div className="text-emerald-400">Profit: {formatCurrency(d.profit)}</div>
                    </div>
                  )}

                  {/* Dual Bar (Sales and Profit) */}
                  <div className="w-full flex items-end justify-center gap-0.5 h-full">
                    {/* Sales Bar */}
                    <div
                      style={{ height: `${Math.max(4, salesHeight)}%` }}
                      className={`w-1/2 rounded-t-xs transition-all ${
                        d.sales > 0
                          ? 'bg-emerald-500 group-hover:bg-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    />
                    {/* Profit Bar */}
                    <div
                      style={{ height: `${Math.max(4, profitHeight)}%` }}
                      className={`w-1/2 rounded-t-xs transition-all ${
                        d.profit > 0
                          ? 'bg-slate-800 dark:bg-slate-300 group-hover:bg-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    />
                  </div>

                  {/* Hour label */}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1.5">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Opening 8:00 AM</span>
            <span className="font-mono-numbers">
              Today&apos;s Peak: {hourlyData.reduce((prev, curr) => (curr.sales > prev.sales ? curr : prev)).label}
            </span>
            <span>Closing 10:00 PM</span>
          </div>
        </div>

        {/* Right: Category Revenue Share */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Sales by Category
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Category turnover and profit generation
            </p>
          </div>

          <div className="space-y-3.5 my-2">
            {categoryContribution.slice(0, 5).map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {cat.category}
                  </span>
                  <span className="font-mono-numbers text-slate-900 dark:text-white font-bold">
                    {formatCurrency(cat.revenue)} ({cat.percentage.toFixed(1)}%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                    className="h-full bg-emerald-600 rounded-full"
                  />
                </div>
              </div>
            ))}

            {categoryContribution.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                No category sales recorded for this period.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-500">Need detailed breakdown?</span>
            <button
              onClick={onNavigateToReports}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>View EOD Sales Report</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Top Performing Products Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Top 5 Best-Selling Products
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Items driving the highest turnover and profit margin in this period
            </p>
          </div>
          <button
            onClick={onNavigateToPos}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>Open Register</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3 text-right">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Total Revenue</th>
                <th className="py-2.5 px-3 text-right">Gross Profit</th>
                <th className="py-2.5 px-3 text-right">Profit Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {topPerformers.map((item, idx) => {
                const margin = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
                return (
                  <tr key={item.sku} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span>{item.name}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {item.sku}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers font-semibold text-slate-800 dark:text-slate-200">
                      {item.units} units
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers font-bold text-slate-900 dark:text-white">
                      {formatCurrency(item.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(item.profit)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers text-slate-600 dark:text-slate-400">
                      {margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
