import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Product,
  SaleTransaction,
  Expense,
  StockMovement,
  ShopSettings,
  CartItem,
  PaymentMethod,
  HeldOrder,
  EndOfDayReport,
  SaleItem,
  UserProfile,
} from '../types';
import { storageService, DEFAULT_SETTINGS, DEFAULT_PROFILES } from '../services/storage';

interface ShopContextType {
  products: Product[];
  transactions: SaleTransaction[];
  expenses: Expense[];
  movements: StockMovement[];
  settings: ShopSettings;
  heldOrders: HeldOrder[];
  cart: CartItem[];
  cartDiscountPercent: number;
  customerName: string;
  customerPhone: string;
  currentReceipt: SaleTransaction | null;
  isReceiptModalOpen: boolean;

  // Profile & Access Control (Owner vs Staff)
  profiles: UserProfile[];
  activeProfile: UserProfile;
  isOwner: boolean;
  isProfileModalOpen: boolean;
  targetProfileIdForModal: string | null;
  openProfileModal: (targetProfileId?: string) => void;
  closeProfileModal: () => void;
  switchProfile: (profileId: string, pin: string) => { success: boolean; message?: string };
  quickSwitchToStaff: () => void;
  updateProfilePin: (profileId: string, newPin: string) => { success: boolean; message?: string };
  updateProfileName: (profileId: string, newName: string) => void;

  // Manual Item Addition (Owner Catalog Feature)
  isAddProductModalOpen: boolean;
  addProductInitialCategory: string;
  openAddProductModal: (initialCategory?: string) => void;
  closeAddProductModal: () => void;
  
  // Cart Actions
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  setCartDiscountPercent: (percent: number) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  clearCart: () => void;
  holdCurrentOrder: () => void;
  recallOrder: (heldId: string) => void;
  deleteHeldOrder: (heldId: string) => void;
  
  // Checkout & Receipts
  checkoutSale: (paymentMethod: PaymentMethod, amountTendered: number, notes?: string) => SaleTransaction | null;
  refundSale: (transactionId: string) => void;
  openReceiptModal: (transaction: SaleTransaction) => void;
  closeReceiptModal: () => void;
  
  // Product & Inventory Actions
  addProduct: (product: Omit<Product, 'id' | 'updatedAt' | 'totalSold'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  restockProduct: (id: string, quantityToAdd: number, costPrice?: number, note?: string) => void;
  adjustStock: (id: string, newStock: number, reason: string, type: 'damage_waste' | 'audit_adjustment') => void;
  
  // Expenses Actions
  addExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => Expense;
  deleteExpense: (id: string) => void;
  
  // Settings & Management
  updateSettings: (updates: Partial<ShopSettings>) => void;
  resetDemoData: () => void;
  exportDatabaseBackup: () => string;
  importDatabaseBackup: (jsonStr: string) => boolean;
  
  // Computed Alerts & Metrics
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  totalAlertsCount: number;
  todayStats: {
    date: string;
    grossSales: number;
    discounts: number;
    netSales: number;
    costOfGoods: number;
    grossProfit: number;
    expenses: number;
    cashExpenses: number;
    netProfit: number;
    marginPercent: number;
    transactionCount: number;
    itemsSold: number;
    cashSales: number;
    cardSales: number;
    mobileSales: number;
    expectedCashInDrawer: number;
  };
  generateEndOfDayReport: (targetDate?: string) => EndOfDayReport;
  formatCurrency: (amount: number) => string;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => storageService.getProducts());
  const [transactions, setTransactions] = useState<SaleTransaction[]>(() => storageService.getTransactions());
  const [expenses, setExpenses] = useState<Expense[]>(() => storageService.getExpenses());
  const [movements, setMovements] = useState<StockMovement[]>(() => storageService.getMovements());
  const [settings, setSettings] = useState<ShopSettings>(() => storageService.getSettings());
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => storageService.getHeldOrders());

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDiscountPercent, setCartDiscountPercent] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [currentReceipt, setCurrentReceipt] = useState<SaleTransaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Profile & Access Control State
  const [profiles, setProfiles] = useState<UserProfile[]>(() => storageService.getProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string>(() => storageService.getActiveProfileId());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [targetProfileIdForModal, setTargetProfileIdForModal] = useState<string | null>(null);

  // Manual Add Product Modal State (For Owner adding items anywhere)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState<boolean>(false);
  const [addProductInitialCategory, setAddProductInitialCategory] = useState<string>('Stationery');

  // Sync to local storage on change
  useEffect(() => {
    storageService.saveProducts(products);
  }, [products]);

  useEffect(() => {
    storageService.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    storageService.saveExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    storageService.saveMovements(movements);
  }, [movements]);

  useEffect(() => {
    storageService.saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    storageService.saveHeldOrders(heldOrders);
  }, [heldOrders]);

  useEffect(() => {
    storageService.saveProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    storageService.saveActiveProfileId(activeProfileId);
  }, [activeProfileId]);

  // Compute active profile and role
  const activeProfile = useMemo(() => {
    const found = profiles.find((p) => p.id === activeProfileId);
    return found || profiles[0] || DEFAULT_PROFILES[0];
  }, [profiles, activeProfileId]);

  const isOwner = activeProfile.role === 'owner';

  const openProfileModal = (targetProfileId?: string) => {
    setTargetProfileIdForModal(targetProfileId || null);
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
    setTargetProfileIdForModal(null);
  };

  const switchProfile = (profileId: string, pin: string): { success: boolean; message?: string } => {
    const target = profiles.find((p) => p.id === profileId);
    if (!target) return { success: false, message: 'Profile not found' };

    if (target.pin.trim() !== pin.trim()) {
      return { success: false, message: 'Incorrect password / PIN code' };
    }

    setActiveProfileId(profileId);
    closeProfileModal();
    return { success: true };
  };

  const quickSwitchToStaff = () => {
    const staff = profiles.find((p) => p.role === 'staff');
    if (staff) {
      setActiveProfileId(staff.id);
    }
  };

  const updateProfilePin = (profileId: string, newPin: string): { success: boolean; message?: string } => {
    if (!newPin || newPin.trim().length < 4) {
      return { success: false, message: 'Password / PIN must be at least 4 digits' };
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, pin: newPin.trim() } : p))
    );
    return { success: true, message: 'Password updated successfully' };
  };

  const updateProfileName = (profileId: string, newName: string) => {
    if (!newName.trim()) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, name: newName.trim() } : p))
    );
  };

  const openAddProductModal = (initialCategory?: string) => {
    if (!isOwner) return;
    setAddProductInitialCategory(initialCategory || 'Stationery');
    setIsAddProductModalOpen(true);
  };

  const closeAddProductModal = () => {
    setIsAddProductModalOpen(false);
  };


  // Inventory Alerts computation
  const lowStockProducts = useMemo(() => {
    return products.filter(
      (p) => p.currentStock > 0 && p.currentStock <= p.minStockThreshold
    );
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter((p) => p.currentStock <= 0);
  }, [products]);

  const totalAlertsCount = lowStockProducts.length + outOfStockProducts.length;

  const formatCurrency = (amount: number): string => {
    const sym = settings.currency || 'PKR';
    const num = Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return sym.length > 1 ? `${sym} ${num}` : `${sym}${num}`;
  };

  // Cart operations
  const addToCart = (product: Product, quantity = 1) => {
    const qtyToAdd = Math.max(1, quantity);

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity;
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: currentQty + qtyToAdd,
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            product,
            quantity: qtyToAdd,
            unitPrice: product.sellingPrice,
          },
        ];
      }
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.floor(quantity) } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCartDiscountPercent(0);
    setCustomerName('');
    setCustomerPhone('');
  };

  const holdCurrentOrder = () => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const newHold: HeldOrder = {
      id: `hold-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customerName: customerName || undefined,
      items: [...cart],
      subtotal,
    };
    setHeldOrders((prev) => [newHold, ...prev]);
    clearCart();
  };

  const recallOrder = (heldId: string) => {
    const target = heldOrders.find((h) => h.id === heldId);
    if (!target) return;
    setCart(target.items);
    setCustomerName(target.customerName || '');
    setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
  };

  const deleteHeldOrder = (heldId: string) => {
    setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
  };

  // Checkout process
  const checkoutSale = (
    paymentMethod: PaymentMethod,
    amountTendered: number,
    notes?: string
  ): SaleTransaction | null => {
    if (cart.length === 0) return null;

    const now = new Date();
    const dateFormatted = now.toISOString().slice(0, 10).replace(/-/g, '');
    const dailyTxCount = transactions.filter((t) => t.timestamp.startsWith(now.toISOString().slice(0, 10))).length;
    const receiptNumber = `RCP-${dateFormatted}-${String(dailyTxCount + 1).padStart(4, '0')}`;
    const txId = `tx-${Date.now()}`;

    // Calculate line items and costs
    const saleItems: SaleItem[] = cart.map((item) => {
      const lineTotal = item.unitPrice * item.quantity;
      const lineCost = item.product.costPrice * item.quantity;
      return {
        productId: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.product.costPrice,
        total: lineTotal,
        profit: lineTotal - lineCost,
      };
    });

    const subtotal = saleItems.reduce((acc, item) => acc + item.total, 0);
    const discountAmount = Number(((subtotal * cartDiscountPercent) / 100).toFixed(2));
    const netAfterDiscount = subtotal - discountAmount;
    const taxRate = 0; // Tax removed from sales
    const taxAmount = 0;
    const grandTotal = Number(netAfterDiscount.toFixed(2));
    const totalCost = saleItems.reduce((acc, item) => acc + item.costPrice * item.quantity, 0);
    const grossProfit = Number((netAfterDiscount - totalCost).toFixed(2));

    const finalTendered = paymentMethod === 'cash' ? Math.max(amountTendered, grandTotal) : grandTotal;
    const changeDue = Number(Math.max(0, finalTendered - grandTotal).toFixed(2));

    const newTransaction: SaleTransaction = {
      id: txId,
      receiptNumber,
      timestamp: now.toISOString(),
      items: saleItems,
      subtotal,
      discountAmount,
      discountPercent: cartDiscountPercent,
      taxRate,
      taxAmount,
      grandTotal,
      totalCost,
      grossProfit,
      paymentMethod,
      amountTendered: finalTendered,
      changeDue,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      cashierName: settings.cashierName || 'Cashier',
      notes,
      status: 'completed',
    };

    // 1. Decrement stock & record movements
    const newMovements: StockMovement[] = [];
    setProducts((prevProducts) =>
      prevProducts.map((prod) => {
        const boughtItem = cart.find((c) => c.product.id === prod.id);
        if (!boughtItem) return prod;

        const newStock = Math.max(0, prod.currentStock - boughtItem.quantity);
        newMovements.push({
          id: `mov-${Date.now()}-${prod.id}`,
          productId: prod.id,
          productName: prod.name,
          type: 'sale',
          quantityDelta: -boughtItem.quantity,
          previousStock: prod.currentStock,
          newStock,
          reason: `Sale ${receiptNumber}`,
          timestamp: now.toISOString(),
        });

        return {
          ...prod,
          currentStock: newStock,
          totalSold: (prod.totalSold || 0) + boughtItem.quantity,
          updatedAt: now.toISOString(),
        };
      })
    );

    setMovements((prev) => [...newMovements, ...prev]);
    setTransactions((prev) => [newTransaction, ...prev]);

    // Reset cart and open receipt
    clearCart();
    setCurrentReceipt(newTransaction);
    setIsReceiptModalOpen(true);

    return newTransaction;
  };

  // Refund Sale
  const refundSale = (transactionId: string) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx || tx.status === 'refunded') return;

    const now = new Date();
    // Restore stock
    const refundMovements: StockMovement[] = [];
    setProducts((prev) =>
      prev.map((prod) => {
        const item = tx.items.find((i) => i.productId === prod.id);
        if (!item) return prod;

        const newStock = prod.currentStock + item.quantity;
        refundMovements.push({
          id: `mov-${Date.now()}-${prod.id}`,
          productId: prod.id,
          productName: prod.name,
          type: 'refund',
          quantityDelta: item.quantity,
          previousStock: prod.currentStock,
          newStock,
          reason: `Refund for receipt ${tx.receiptNumber}`,
          timestamp: now.toISOString(),
        });

        return {
          ...prod,
          currentStock: newStock,
          totalSold: Math.max(0, (prod.totalSold || 0) - item.quantity),
          updatedAt: now.toISOString(),
        };
      })
    );

    setMovements((prev) => [...refundMovements, ...prev]);
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, status: 'refunded' } : t))
    );
  };

  const openReceiptModal = (tx: SaleTransaction) => {
    setCurrentReceipt(tx);
    setIsReceiptModalOpen(true);
  };

  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
  };

  // Product CRUD
  const addProduct = (prodData: Omit<Product, 'id' | 'updatedAt' | 'totalSold'>): Product => {
    const newProd: Product = {
      ...prodData,
      id: `prod-${Date.now()}`,
      totalSold: 0,
      updatedAt: new Date().toISOString(),
    };

    setProducts((prev) => [newProd, ...prev]);

    // Record initial stock movement
    if (newProd.currentStock > 0) {
      setMovements((prev) => [
        {
          id: `mov-${Date.now()}`,
          productId: newProd.id,
          productName: newProd.name,
          type: 'restock',
          quantityDelta: newProd.currentStock,
          previousStock: 0,
          newStock: newProd.currentStock,
          reason: 'Initial stock intake',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    return newProd;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const restockProduct = (
    id: string,
    quantityToAdd: number,
    newCostPrice?: number,
    note?: string
  ) => {
    if (quantityToAdd <= 0) return;
    const now = new Date().toISOString();

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const newStock = p.currentStock + quantityToAdd;
        const updatedCost = newCostPrice !== undefined && newCostPrice > 0 ? newCostPrice : p.costPrice;

        setMovements((movs) => [
          {
            id: `mov-${Date.now()}`,
            productId: p.id,
            productName: p.name,
            type: 'restock',
            quantityDelta: quantityToAdd,
            previousStock: p.currentStock,
            newStock,
            reason: note || 'Supplier replenishment',
            timestamp: now,
          },
          ...movs,
        ]);

        return {
          ...p,
          currentStock: newStock,
          costPrice: updatedCost,
          updatedAt: now,
        };
      })
    );
  };

  const adjustStock = (
    id: string,
    newStock: number,
    reason: string,
    type: 'damage_waste' | 'audit_adjustment'
  ) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;

    const delta = newStock - target.currentStock;
    const now = new Date().toISOString();

    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, currentStock: newStock, updatedAt: now } : p
      )
    );

    setMovements((prev) => [
      {
        id: `mov-${Date.now()}`,
        productId: target.id,
        productName: target.name,
        type,
        quantityDelta: delta,
        previousStock: target.currentStock,
        newStock,
        reason,
        timestamp: now,
      },
      ...prev,
    ]);
  };

  // Expenses CRUD
  const addExpense = (expenseData: Omit<Expense, 'id' | 'timestamp'>): Expense => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    return newExpense;
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  // Settings
  const updateSettings = (updates: Partial<ShopSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const resetDemoData = () => {
    storageService.resetToDemo();
    setProducts(storageService.getProducts());
    setTransactions(storageService.getTransactions());
    setExpenses(storageService.getExpenses());
    setSettings(storageService.getSettings());
    setProfiles(storageService.getProfiles());
    setActiveProfileId('prof-owner');
    setMovements(storageService.getMovements());
    setHeldOrders([]);
    clearCart();
  };

  const exportDatabaseBackup = () => {
    return storageService.exportBackup();
  };

  const importDatabaseBackup = (jsonStr: string) => {
    const success = storageService.importBackup(jsonStr);
    if (success) {
      setProducts(storageService.getProducts());
      setTransactions(storageService.getTransactions());
      setExpenses(storageService.getExpenses());
      setSettings(storageService.getSettings());
      setProfiles(storageService.getProfiles());
      setActiveProfileId(storageService.getActiveProfileId());
      setMovements(storageService.getMovements());
      return true;
    }
    return false;
  };


  // Compute Today's Financial & Sales KPIs
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTransactions = transactions.filter(
      (t) => t.timestamp.startsWith(todayStr) && t.status === 'completed'
    );
    const todayExpensesList = expenses.filter((e) => e.date === todayStr);

    let grossSales = 0;
    let discounts = 0;
    let netSales = 0;
    let costOfGoods = 0;
    let itemsSold = 0;
    let cashSales = 0;
    let cardSales = 0;
    let mobileSales = 0;

    todayTransactions.forEach((tx) => {
      grossSales += tx.subtotal;
      discounts += tx.discountAmount;
      netSales += (tx.subtotal - tx.discountAmount);
      costOfGoods += tx.totalCost;
      itemsSold += tx.items.reduce((sum, item) => sum + item.quantity, 0);

      if (tx.paymentMethod === 'cash') cashSales += tx.grandTotal;
      else if (tx.paymentMethod === 'card') cardSales += tx.grandTotal;
      else if (tx.paymentMethod === 'mobile_qr') mobileSales += tx.grandTotal;
    });

    const totalExpenses = todayExpensesList.reduce((sum, exp) => sum + exp.amount, 0);
    const cashExpenses = todayExpensesList
      .filter((e) => e.paymentMethod === 'cash')
      .reduce((sum, exp) => sum + exp.amount, 0);

    const grossProfit = netSales - costOfGoods;
    const netProfit = grossProfit - totalExpenses;
    const marginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const openingFloat = settings.defaultCashFloat || 150;
    const expectedCashInDrawer = openingFloat + cashSales - cashExpenses;

    return {
      date: todayStr,
      grossSales: Number(grossSales.toFixed(2)),
      discounts: Number(discounts.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      costOfGoods: Number(costOfGoods.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      expenses: Number(totalExpenses.toFixed(2)),
      cashExpenses: Number(cashExpenses.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      marginPercent: Number(marginPercent.toFixed(1)),
      transactionCount: todayTransactions.length,
      itemsSold,
      cashSales: Number(cashSales.toFixed(2)),
      cardSales: Number(cardSales.toFixed(2)),
      mobileSales: Number(mobileSales.toFixed(2)),
      expectedCashInDrawer: Number(expectedCashInDrawer.toFixed(2)),
    };
  }, [transactions, expenses, settings.defaultCashFloat]);

  // Generate End-of-Day Report for any selected date
  const generateEndOfDayReport = (targetDate?: string): EndOfDayReport => {
    const reportDate = targetDate || new Date().toISOString().slice(0, 10);
    const dateTransactions = transactions.filter(
      (t) => t.timestamp.startsWith(reportDate)
    );
    const completedTx = dateTransactions.filter((t) => t.status === 'completed');
    const refundedTx = dateTransactions.filter((t) => t.status === 'refunded');
    const dateExpenses = expenses.filter((e) => e.date === reportDate);

    let grossSales = 0;
    let discountsGiven = 0;
    let refundsGiven = 0;
    let netSales = 0;
    let totalCostOfGoods = 0;
    let itemsSoldCount = 0;
    let cashSales = 0;
    let cardSales = 0;
    let mobileSales = 0;

    const productVelocityMap: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};

    completedTx.forEach((tx) => {
      grossSales += tx.subtotal;
      discountsGiven += tx.discountAmount;
      netSales += (tx.subtotal - tx.discountAmount);
      totalCostOfGoods += tx.totalCost;

      if (tx.paymentMethod === 'cash') cashSales += tx.grandTotal;
      else if (tx.paymentMethod === 'card') cardSales += tx.grandTotal;
      else if (tx.paymentMethod === 'mobile_qr') mobileSales += tx.grandTotal;

      tx.items.forEach((item) => {
        itemsSoldCount += item.quantity;
        if (!productVelocityMap[item.productId]) {
          productVelocityMap[item.productId] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
            profit: 0,
          };
        }
        productVelocityMap[item.productId].quantity += item.quantity;
        productVelocityMap[item.productId].revenue += item.total;
        productVelocityMap[item.productId].profit += item.profit;
      });
    });

    refundedTx.forEach((tx) => {
      refundsGiven += tx.grandTotal;
    });

    const totalExpenses = dateExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const cashExpenses = dateExpenses
      .filter((e) => e.paymentMethod === 'cash')
      .reduce((sum, exp) => sum + exp.amount, 0);

    const grossProfit = netSales - totalCostOfGoods;
    const netDailyProfit = grossProfit - totalExpenses;
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const openingCashFloat = settings.defaultCashFloat || 150;
    const expectedCashInDrawer = openingCashFloat + cashSales - cashExpenses;

    const topSellingProducts = Object.values(productVelocityMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      date: reportDate,
      generatedAt: new Date().toISOString(),
      openingCashFloat,
      cashSales: Number(cashSales.toFixed(2)),
      cardSales: Number(cardSales.toFixed(2)),
      mobileSales: Number(mobileSales.toFixed(2)),
      grossSales: Number(grossSales.toFixed(2)),
      discountsGiven: Number(discountsGiven.toFixed(2)),
      refundsGiven: Number(refundsGiven.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      totalCostOfGoods: Number(totalCostOfGoods.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      cashExpenses: Number(cashExpenses.toFixed(2)),
      netDailyProfit: Number(netDailyProfit.toFixed(2)),
      expectedCashInDrawer: Number(expectedCashInDrawer.toFixed(2)),
      transactionCount: completedTx.length,
      itemsSoldCount,
      topSellingProducts,
      lowStockAlertCount: lowStockProducts.length + outOfStockProducts.length,
    };
  };

  return (
    <ShopContext.Provider
      value={{
        products,
        transactions,
        expenses,
        movements,
        settings,
        heldOrders,
        cart,
        cartDiscountPercent,
        customerName,
        customerPhone,
        currentReceipt,
        isReceiptModalOpen,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        setCartDiscountPercent,
        setCustomerName,
        setCustomerPhone,
        clearCart,
        holdCurrentOrder,
        recallOrder,
        deleteHeldOrder,
        checkoutSale,
        refundSale,
        openReceiptModal,
        closeReceiptModal,
        addProduct,
        updateProduct,
        deleteProduct,
        restockProduct,
        adjustStock,
        addExpense,
        deleteExpense,
        updateSettings,
        resetDemoData,
        exportDatabaseBackup,
        importDatabaseBackup,
        lowStockProducts,
        outOfStockProducts,
        totalAlertsCount,
        todayStats,
        generateEndOfDayReport,
        formatCurrency,

        // Profile & Access Control
        profiles,
        activeProfile,
        isOwner,
        isProfileModalOpen,
        targetProfileIdForModal,
        openProfileModal,
        closeProfileModal,
        switchProfile,
        quickSwitchToStaff,
        updateProfilePin,
        updateProfileName,

        // Manual Product Catalog addition (Owner)
        isAddProductModalOpen,
        addProductInitialCategory,
        openAddProductModal,
        closeAddProductModal,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = (): ShopContextType => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
