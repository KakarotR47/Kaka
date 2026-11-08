import React, { useState, useMemo } from 'react';
import { useShop } from '../../context/ShopContext';
import { SaleTransaction } from '../../types';
import {
  Receipt,
  Search,
  Printer,
  RotateCcw,
  Calendar,
  Banknote,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';

export const SalesHistory: React.FC = () => {
  const { transactions, refundSale, openReceiptModal, formatCurrency, isOwner, openProfileModal } = useShop();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'refunded'>('all');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          tx.receiptNumber.toLowerCase().includes(q) ||
          (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
          tx.items.some((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, searchQuery]);

  const summary = useMemo(() => {
    let totalSales = 0;
    let totalProfit = 0;
    let completedCount = 0;
    let refundedCount = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'completed') {
        totalSales += tx.grandTotal;
        totalProfit += tx.grossProfit;
        completedCount++;
      } else {
        refundedCount++;
      }
    });

    return { totalSales, totalProfit, completedCount, refundedCount };
  }, [transactions]);

  const [txToRefund, setTxToRefund] = useState<SaleTransaction | null>(null);

  const confirmRefund = () => {
    if (!txToRefund) return;
    refundSale(txToRefund.id);
    setTxToRefund(null);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Sales Transactions &amp; Receipts
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Full register audit log, customer reprint archive, and inventory return processing
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Completed Sales
          </div>
          <div className="mt-1 text-2xl font-bold font-mono-numbers text-slate-900 dark:text-white">
            {summary.completedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">transactions settled</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Revenue Settled
          </div>
          <div className="mt-1 text-2xl font-bold font-mono-numbers text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.totalSales)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">gross payments collected</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Gross Profit Generated</span>
            {!isOwner && <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">Owner Only</span>}
          </div>
          <div className="mt-1 text-2xl font-bold font-mono-numbers text-slate-900 dark:text-white">
            {isOwner ? (
              formatCurrency(summary.totalProfit)
            ) : (
              <span className="text-slate-400 tracking-widest text-lg">••••••</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isOwner ? 'after merchandise costs' : 'Restricted to store owner'}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Refunds &amp; Returns
          </div>
          <div className="mt-1 text-2xl font-bold font-mono-numbers text-rose-600 dark:text-rose-400">
            {summary.refundedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">stock returned to shelves</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt # (e.g. RCP-20261107-0001), item name, or customer..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Receipts
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter('refunded')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'refunded'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Refunded
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3">Items Sold</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3 text-right">Sale Total</th>
                {isOwner && <th className="py-3 px-3 text-right">Gross Profit</th>}
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.map((tx) => {
                const totalUnits = tx.items.reduce((s, i) => s + i.quantity, 0);
                const isRefunded = tx.status === 'refunded';

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {tx.receiptNumber}
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      <div>{new Date(tx.timestamp).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3 px-3 max-w-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {tx.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {totalUnits} units total
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {tx.customerName ? (
                        <div>
                          <div className="font-medium">{tx.customerName}</div>
                          {tx.customerPhone && <div className="text-[10px] text-slate-400 font-mono">{tx.customerPhone}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Walk-in Customer</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 capitalize">
                        {tx.paymentMethod === 'cash' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                        {tx.paymentMethod === 'card' && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                        {tx.paymentMethod === 'mobile_qr' && <QrCode className="w-3.5 h-3.5 text-purple-600" />}
                        <span>{tx.paymentMethod.replace('_', ' ')}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono-numbers font-bold text-slate-900 dark:text-white text-sm">
                      {formatCurrency(tx.grandTotal)}
                    </td>

                    {isOwner && (
                      <td className="py-3 px-3 text-right font-mono-numbers font-semibold text-emerald-600 dark:text-emerald-400">
                        {isRefunded ? '—' : `+${formatCurrency(tx.grossProfit)}`}
                      </td>
                    )}

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isRefunded
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {isRefunded ? <AlertOctagon className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span className="capitalize">{tx.status}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openReceiptModal(tx)}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Print / View Receipt"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>

                        {!isRefunded && (
                          <button
                            onClick={() => {
                              if (!isOwner) {
                                openProfileModal('prof-owner');
                              } else {
                                setTxToRefund(tx);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title={isOwner ? "Process customer return / refund & restore stock" : "Owner PIN required to refund & restore stock"}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              No transactions match your search criteria
            </p>
          </div>
        )}
      </div>

      {/* In-app Refund Confirmation Modal */}
      {txToRefund && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <span>Confirm Refund &amp; Return</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Refund receipt <strong className="font-mono text-slate-900 dark:text-white">{txToRefund.receiptNumber}</strong>?
                This will restore{' '}
                <strong className="text-emerald-600">
                  {txToRefund.items.reduce((s, i) => s + i.quantity, 0)} units
                </strong>{' '}
                back to your shop inventory.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTxToRefund(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRefund}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
