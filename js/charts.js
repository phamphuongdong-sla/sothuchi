/**
 * js/charts.js - Visual Statistics & Chart.js Reports Manager
 * Computes financial KPI summary cards (Total Income, Total Expense, Net Balance, Savings Rate),
 * date range filtering, category breakdown doughnut chart, income vs expense comparison chart,
 * and chart lifecycle management with destroy() cleanup.
 */

(function(global) {
  'use strict';

  class ChartManager {
    constructor() {
      this.categoryChartInstance = null;
      this.comparisonChartInstance = null;
      this.currentDateRange = 'all_time';
      this.customStartDate = '';
      this.customEndDate = '';
      this.categoryType = 'expense';
      this.isInitialized = false;
    }

    /**
     * Calculate financial summary metrics from transaction array
     * @param {Array} transactions 
     * @returns {Object} { totalIncome, totalExpense, netBalance, savingsRate }
     */
    calculateSummary(transactions = []) {
      let totalIncome = 0;
      let totalExpense = 0;

      transactions.forEach(tx => {
        if (tx.sync_status === 'pending_delete') return;
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'income') {
          totalIncome += amount;
        } else {
          totalExpense += amount;
        }
      });

      const netBalance = totalIncome - totalExpense;

      // Savings Rate calculation with zero-income protection
      let savingsRate = 0.0;
      if (totalIncome > 0) {
        savingsRate = Number(((totalIncome - totalExpense) / totalIncome * 100).toFixed(1));
      }

      return {
        totalIncome,
        totalExpense,
        netBalance,
        savingsRate
      };
    }

    /**
     * Filter transactions by selected report date range
     * @param {Array} transactions 
     * @returns {Array} Filtered transactions
     */
    filterTransactionsByDateRange(transactions = []) {
      const activeTransactions = transactions.filter(t => t.sync_status !== 'pending_delete');
      if (this.currentDateRange === 'all_time') return activeTransactions;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      let start = '';
      let end = '';

      const formatYMD = global.formatLocalYMD || (d => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });

      if (this.currentDateRange === 'this_month') {
        start = formatYMD(new Date(currentYear, currentMonth, 1));
        end = formatYMD(new Date(currentYear, currentMonth + 1, 0));
      } else if (this.currentDateRange === 'last_month') {
        start = formatYMD(new Date(currentYear, currentMonth - 1, 1));
        end = formatYMD(new Date(currentYear, currentMonth, 0));
      } else if (this.currentDateRange === 'this_year') {
        start = `${currentYear}-01-01`;
        end = `${currentYear}-12-31`;
      } else if (this.currentDateRange === 'custom') {
        start = this.customStartDate;
        end = this.customEndDate;
      }

      if (!start && !end) return activeTransactions;

      return activeTransactions.filter(tx => {
        if (start && tx.date < start) return false;
        if (end && tx.date > end) return false;
        return true;
      });
    }

    /**
     * Prepare category breakdown chart dataset
     * @param {Array} transactions 
     * @param {string} targetType - 'expense' | 'income'
     * @returns {Object} { labels, data, percentages, total }
     */
    prepareCategoryChartData(transactions = [], targetType = null) {
      const type = targetType || this.categoryType || 'expense';
      const categoryMap = {};
      let totalAmount = 0;

      transactions.forEach(tx => {
        if (tx.sync_status === 'pending_delete') return;
        if (tx.type === type) {
          const categoryName = tx.category || 'Khác';
          const amount = Number(tx.amount) || 0;
          categoryMap[categoryName] = (categoryMap[categoryName] || 0) + amount;
          totalAmount += amount;
        }
      });

      const labels = Object.keys(categoryMap);
      const data = labels.map(lbl => categoryMap[lbl]);
      const percentages = labels.map(lbl => {
        if (totalAmount === 0) return 0;
        const pct = (categoryMap[lbl] / totalAmount) * 100;
        return Number(pct.toFixed(1));
      });

      return {
        labels,
        data,
        percentages,
        total: totalAmount
      };
    }

    /**
     * Update DOM KPI summary card elements
     * @param {Object} summary - { totalIncome, totalExpense, netBalance, savingsRate }
     */
    updateSummaryCards(summary) {
      if (typeof document === 'undefined') return;
      const db = global.DB || (global.window && global.window.DB);
      const formatVND = (db && db.formatVND) || global.formatVND || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      const incEl = document.getElementById('total-income');
      const expEl = document.getElementById('total-expense');
      const balEl = document.getElementById('net-balance');
      const savEl = document.getElementById('savings-rate');

      if (incEl) incEl.textContent = formatVND(summary.totalIncome);
      if (expEl) expEl.textContent = formatVND(summary.totalExpense);

      if (balEl) {
        balEl.textContent = formatVND(summary.netBalance);
        if (summary.netBalance < 0) {
          balEl.classList.add('negative-balance');
          balEl.classList.remove('positive-balance');
        } else {
          balEl.classList.add('positive-balance');
          balEl.classList.remove('negative-balance');
        }
      }

      if (savEl) {
        savEl.textContent = `${summary.savingsRate}%`;
        if (summary.savingsRate < 0) {
          savEl.classList.add('negative-savings');
          savEl.classList.remove('positive-savings');
        } else {
          savEl.classList.add('positive-savings');
          savEl.classList.remove('negative-savings');
        }
      }
    }

    /**
     * Destroy previous Chart.js instances to prevent canvas reuse errors & memory leaks
     */
    destroyCharts() {
      if (this.categoryChartInstance) {
        try {
          if (typeof this.categoryChartInstance.destroy === 'function') {
            this.categoryChartInstance.destroy();
          }
        } catch (e) {
          console.warn('[ChartManager] Category chart destruction warning:', e);
        }
        this.categoryChartInstance = null;
      }

      if (this.comparisonChartInstance) {
        try {
          if (typeof this.comparisonChartInstance.destroy === 'function') {
            this.comparisonChartInstance.destroy();
          }
        } catch (e) {
          console.warn('[ChartManager] Comparison chart destruction warning:', e);
        }
        this.comparisonChartInstance = null;
      }
    }

    /**
     * Render or refresh Chart.js charts on canvas elements
     * @param {Array} rawTransactions 
     */
    renderCharts(rawTransactions = null) {
      const db = global.DB || (global.window && global.window.DB);
      const transactions = rawTransactions || (db && typeof db.getTransactions === 'function' ? db.getTransactions() : []);

      const filteredTxs = this.filterTransactionsByDateRange(transactions);
      const summary = this.calculateSummary(filteredTxs);
      this.updateSummaryCards(summary);

      // Fault Tolerance Guard: If Chart.js library or document DOM is unavailable, return gracefully
      const Chart = global.Chart || (typeof window !== 'undefined' && window.Chart);
      if (!Chart || typeof document === 'undefined') return;

      // Clean up existing Chart instances before creating new ones
      this.destroyCharts();

      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDarkMode ? '#f8fafc' : '#0f172a';

      // 1. Render Category Breakdown Chart
      const categoryCanvas = document.getElementById('category-chart');
      if (categoryCanvas) {
        const catData = this.prepareCategoryChartData(filteredTxs, this.categoryType);
        const ctx = typeof categoryCanvas.getContext === 'function' ? categoryCanvas.getContext('2d') : null;
        if (ctx) {
          this.categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: catData.labels.length > 0 ? catData.labels : ['Chưa có dữ liệu'],
              datasets: [{
                data: catData.data.length > 0 ? catData.data : [1],
                backgroundColor: catData.data.length > 0 ? [
                  '#4f46e5', '#10b981', '#f59e0b', '#ef4444',
                  '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'
                ] : ['#e2e8f0']
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { color: textColor }
                },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      if (catData.data.length === 0) return ' Chưa có giao dịch';
                      const label = context.label || '';
                      const value = context.parsed || 0;
                      const pct = catData.percentages[context.dataIndex] || 0;
                      const formatted = (db && db.formatVND) ? db.formatVND(value) : value + ' ₫';
                      return ` ${label}: ${formatted} (${pct}%)`;
                    }
                  }
                }
              }
            }
          });
        }
      }

      // 2. Render Income vs Expense Bar Chart
      const comparisonCanvas = document.getElementById('income-expense-chart');
      if (comparisonCanvas) {
        const ctxComp = typeof comparisonCanvas.getContext === 'function' ? comparisonCanvas.getContext('2d') : null;
        if (ctxComp) {
          this.comparisonChartInstance = new Chart(ctxComp, {
            type: 'bar',
            data: {
              labels: ['Thu nhập', 'Chi tiêu'],
              datasets: [{
                label: 'Số tiền (VND)',
                data: [summary.totalIncome, summary.totalExpense],
                backgroundColor: ['#10b981', '#ef4444'],
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const val = context.parsed.y || 0;
                      return ` ${(db && db.formatVND) ? db.formatVND(val) : val + ' ₫'}`;
                    }
                  }
                }
              },
              scales: {
                x: { ticks: { color: textColor } },
                y: { ticks: { color: textColor } }
              }
            }
          });
        }
      }
    }

    /**
     * Bind System & UI Event Listeners
     */
    initEventListeners() {
      if (this.isInitialized || typeof window === 'undefined') return;
      this.isInitialized = true;

      // Listen to transaction data updates
      ['transactionadded', 'transactionupdated', 'transactiondeleted'].forEach(evtName => {
        window.addEventListener(evtName, () => this.renderCharts());
      });

      // Listen to route changes (re-render when navigating to 'reports')
      window.addEventListener('routechanged', (e) => {
        if (e && e.detail && e.detail.route === 'reports') {
          this.renderCharts();
        }
      });

      // Listen to theme changes (update chart label text colors)
      window.addEventListener('themechanged', () => {
        this.renderCharts();
      });

      // DOM Filter Controls
      if (typeof document !== 'undefined') {
        const rangeSelect = document.getElementById('chart-date-range');
        const customContainer = document.getElementById('chart-custom-date-container');
        const startDateInput = document.getElementById('chart-start-date');
        const endDateInput = document.getElementById('chart-end-date');

        if (rangeSelect) {
          rangeSelect.addEventListener('change', (e) => {
            this.currentDateRange = e.target.value;
            if (customContainer) {
              if (this.currentDateRange === 'custom') {
                customContainer.classList.remove('hidden');
              } else {
                customContainer.classList.add('hidden');
              }
            }
            this.renderCharts();
          });
        }

        if (startDateInput) {
          startDateInput.addEventListener('change', (e) => {
            this.customStartDate = e.target.value;
            this.renderCharts();
          });
        }

        if (endDateInput) {
          endDateInput.addEventListener('change', (e) => {
            this.customEndDate = e.target.value;
            this.renderCharts();
          });
        }

        // Category Type Toggle Buttons (Expense vs Income)
        const toggleBtns = document.querySelectorAll('[data-chart-category-type]');
        toggleBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const catType = target.getAttribute('data-chart-category-type');
            if (catType) {
              this.categoryType = catType;
              toggleBtns.forEach(b => b.classList.remove('active'));
              target.classList.add('active');
              this.renderCharts();
            }
          });
        });
      }
    }

    /**
     * Initialization method
     */
    init() {
      this.initEventListeners();
      this.renderCharts();
    }
  }

  const manager = new ChartManager();
  global.ChartManager = manager;
  global.Charts = manager;
  global.ChartsUI = manager;
  if (typeof window !== 'undefined') {
    window.ChartManager = manager;
    window.Charts = manager;
    window.ChartsUI = manager;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.ChartManager = manager;
    globalThis.Charts = manager;
    globalThis.ChartsUI = manager;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = manager;
  }
})(typeof window !== 'undefined' ? window : this);
