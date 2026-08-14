/**
 * js/charts.js - Visual Statistics & Financial Intelligence Reports Manager
 * High-grade Financial Reporting System:
 * - KPI summary cards with Month-over-Month (MoM %) comparison
 * - Daily Burn-Rate projection & Monthly Expense Forecast
 * - Emergency Fund Coverage Ratio
 * - 50/30/20 Rule Financial Allocation Breakdown
 * - Cash Flow & Cumulative Net Worth Line Chart
 * - Smart Executive Management Summary Text Generator
 * - Top 5 Outliers Expenses & Pareto 80/20 Analysis
 * - Category Chart Drill-Down Modal
 * - CSV/Excel & Native PDF/Print Export Engine
 */

(function(global) {
  'use strict';

  class ChartManager {
    constructor() {
      this.categoryChartInstance = null;
      this.comparisonChartInstance = null;
      this.trendChartInstance = null;
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
        if (tx.type === 'transfer' || tx.category === 'Chuyển tiền nội bộ' || tx.is_transfer) return;
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'income') {
          totalIncome += amount;
        } else if (tx.type === 'expense') {
          totalExpense += amount;
        }
      });

      const netBalance = totalIncome - totalExpense;

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
     * @param {string} overrideRange 
     * @returns {Array} Filtered transactions
     */
    filterTransactionsByDateRange(transactions = [], overrideRange = null) {
      const activeTransactions = transactions.filter(t => t.sync_status !== 'pending_delete');

      const selectedWallet = typeof document !== 'undefined' ? (document.getElementById('filter-report-wallet')?.value || 'all') : 'all';
      let walletFiltered = activeTransactions;
      if (selectedWallet !== 'all') {
        walletFiltered = walletFiltered.filter(t => (t.wallet_id || 'wallet_cash') === selectedWallet);
      }

      const range = overrideRange || this.currentDateRange;
      if (range === 'all_time') return walletFiltered;

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

      if (range === 'this_month') {
        start = formatYMD(new Date(currentYear, currentMonth, 1));
        end = formatYMD(new Date(currentYear, currentMonth + 1, 0));
      } else if (range === 'last_month') {
        start = formatYMD(new Date(currentYear, currentMonth - 1, 1));
        end = formatYMD(new Date(currentYear, currentMonth, 0));
      } else if (range === 'this_year') {
        start = `${currentYear}-01-01`;
        end = `${currentYear}-12-31`;
      } else if (range === 'last_year') {
        start = `${currentYear - 1}-01-01`;
        end = `${currentYear - 1}-12-31`;
      } else if (range === 'custom') {
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
     * Compute Month-over-Month (MoM %) comparison metrics against previous period
     */
    calculateMoMComparison(allTransactions = [], currentSummary = {}) {
      let prevRange = 'last_month';
      if (this.currentDateRange === 'this_month') prevRange = 'last_month';
      else if (this.currentDateRange === 'this_year') prevRange = 'last_year';
      else prevRange = 'last_month';

      const prevTxs = this.filterTransactionsByDateRange(allTransactions, prevRange);
      const prevSummary = this.calculateSummary(prevTxs);

      const calcPct = (curr, prev) => {
        if (prev === 0) return curr > 0 ? '+100%' : '0%';
        const diff = ((curr - prev) / Math.abs(prev)) * 100;
        const sign = diff >= 0 ? '+' : '';
        return `${sign}${diff.toFixed(1)}%`;
      };

      return {
        incomeDiff: calcPct(currentSummary.totalIncome, prevSummary.totalIncome),
        incomeIsUp: currentSummary.totalIncome >= prevSummary.totalIncome,
        expenseDiff: calcPct(currentSummary.totalExpense, prevSummary.totalExpense),
        expenseIsUp: currentSummary.totalExpense > prevSummary.totalExpense,
        balanceDiff: calcPct(currentSummary.netBalance, prevSummary.netBalance),
        balanceIsUp: currentSummary.netBalance >= prevSummary.netBalance,
        savingsDiff: (currentSummary.savingsRate - prevSummary.savingsRate).toFixed(1)
      };
    }

    /**
     * Compute Burn-rate, End-of-month projection and Emergency Fund Ratio
     */
    calculateBurnRateAndForecast(filteredTxs = [], allTxs = [], currentSummary = {}) {
      const now = new Date();
      const currentDay = now.getDate();
      const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      let dailyBurnRate = 0;
      let monthlyForecast = currentSummary.totalExpense;

      if (this.currentDateRange === 'this_month' || this.currentDateRange === 'all_time') {
        const daysPassed = Math.max(1, currentDay);
        dailyBurnRate = Math.round(currentSummary.totalExpense / daysPassed);
        monthlyForecast = currentSummary.totalExpense + (dailyBurnRate * (totalDaysInMonth - daysPassed));
      } else {
        dailyBurnRate = Math.round(currentSummary.totalExpense / 30);
      }

      // Calculate average monthly expense across history
      let avgMonthlyExpense = currentSummary.totalExpense;
      if (allTxs.length > 0) {
        const activeTxs = allTxs.filter(t => t.sync_status !== 'pending_delete' && t.type === 'expense' && t.category !== 'Chuyển tiền nội bộ' && !t.is_transfer);
        const monthsMap = {};
        activeTxs.forEach(t => {
          const ym = t.date ? t.date.substring(0, 7) : 'other';
          monthsMap[ym] = (monthsMap[ym] || 0) + (Number(t.amount) || 0);
        });
        const monthCount = Math.max(1, Object.keys(monthsMap).length);
        const grandExpense = Object.values(monthsMap).reduce((a, b) => a + b, 0);
        avgMonthlyExpense = grandExpense / monthCount;
      }

      let totalLiquidAssets = 0;
      const db = (typeof globalThis !== 'undefined' && globalThis.DB) || (typeof window !== 'undefined' && window.DB) || (typeof global !== 'undefined' && global.DB) || global.DB;
      if (db && typeof db.getWallets === 'function') {
        const wallets = db.getWallets(false);
        totalLiquidAssets = (wallets || []).reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
      } else {
        totalLiquidAssets = Math.max(0, currentSummary.netBalance || 0);
      }

      const emergencyFundMonths = avgMonthlyExpense > 0 
        ? Number((Math.max(0, totalLiquidAssets) / avgMonthlyExpense).toFixed(1)) 
        : 0;

      return {
        dailyBurnRate,
        monthlyForecast,
        emergencyFundMonths,
        avgMonthlyExpense
      };
    }

    /**
     * Compute 50/30/20 Financial Allocation
     * Needs: 50% (Ăn uống, Nhà cửa, Điện nước, Y tế, Giáo dục, Đi lại)
     * Wants: 30% (Giải trí, Mua sắm, Du lịch, Cà phê, Quần áo, Thể thao)
     * Savings: 20% (Tiết kiệm, Đầu tư, Bất động sản, Tích lũy)
     */
    calculate503020Allocation(filteredTxs = [], totalExpense = 0) {
      let needs = 0;
      let wants = 0;
      let savings = 0;

      const needsKeywords = ['ăn', 'uống', 'nhà', 'điện', 'nước', 'y tế', 'thuốc', 'xăng', 'đi lại', 'học', 'học phí', 'bảo hiểm', 'tạp hóa'];
      const savingsKeywords = ['tiết kiệm', 'đầu tư', 'bất động sản', 'chứng khoán', 'tích lũy', 'vàng', 'gửi tiết kiệm'];

      filteredTxs.forEach(tx => {
        if (tx.type !== 'expense') return;
        const amount = Number(tx.amount) || 0;
        const cat = (tx.category || '').toLowerCase();

        if (savingsKeywords.some(k => cat.includes(k))) {
          savings += amount;
        } else if (needsKeywords.some(k => cat.includes(k))) {
          needs += amount;
        } else {
          wants += amount;
        }
      });

      const denominator = totalExpense > 0 ? totalExpense : 1;
      return {
        needsAmount: needs,
        needsPct: Number(((needs / denominator) * 100).toFixed(1)),
        wantsAmount: wants,
        wantsPct: Number(((wants / denominator) * 100).toFixed(1)),
        savingsAmount: savings,
        savingsPct: Number(((savings / denominator) * 100).toFixed(1))
      };
    }

    /**
     * Compute Financial Health Score (0 - 100)
     */
    calculateFinancialHealthScore(summary, alloc, emergencyMonths) {
      let score = 0;

      // 1. Savings Rate Score (Max 30 pts)
      if (summary.savingsRate >= 25) score += 30;
      else if (summary.savingsRate >= 15) score += 22;
      else if (summary.savingsRate >= 5) score += 15;
      else if (summary.savingsRate > 0) score += 8;

      // 2. Emergency Fund Score (Max 25 pts)
      if (emergencyMonths >= 6) score += 25;
      else if (emergencyMonths >= 3) score += 18;
      else if (emergencyMonths >= 1) score += 10;
      else score += 3;

      // 3. Needs Control Score (Max 25 pts)
      if (alloc.needsPct <= 50) score += 25;
      else if (alloc.needsPct <= 65) score += 18;
      else if (alloc.needsPct <= 80) score += 10;
      else score += 5;

      // 4. Net Cash Flow Positive Score (Max 20 pts)
      if (summary.netBalance > 0) score += 20;
      else if (summary.netBalance === 0) score += 10;
      else score += 0;

      let levelText = 'Rất Tốt 🟢';
      let badgeClass = 'health-excellent';
      if (score < 40) {
        levelText = 'Cần Cải Thiện 🔴';
        badgeClass = 'health-warning';
      } else if (score < 65) {
        levelText = 'Khá / Trung Bình 🟡';
        badgeClass = 'health-moderate';
      } else if (score < 85) {
        levelText = 'Tốt 🔵';
        badgeClass = 'health-good';
      }

      return { score, levelText, badgeClass };
    }

    /**
     * Prepare category breakdown chart dataset
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
     * Update DOM KPI summary cards & MoM Badges
     */
    updateSummaryCards(summary, mom, forecast) {
      if (typeof document === 'undefined') return;
      const db = global.DB || (global.window && global.window.DB);
      const formatVND = (db && db.formatVND) || global.formatVND || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      const doc = (typeof window !== 'undefined' && window.document) || (typeof globalThis !== 'undefined' && globalThis.document) || (typeof document !== 'undefined' ? document : null) || (global && global.document);
      const incEls = doc ? [doc.getElementById('total-income'), doc.getElementById('report-total-income')].filter(Boolean) : [];
      const expEls = doc ? [doc.getElementById('total-expense'), doc.getElementById('report-total-expense')].filter(Boolean) : [];
      const balEls = doc ? [doc.getElementById('net-balance'), doc.getElementById('report-net-balance')].filter(Boolean) : [];
      const savEls = doc ? [doc.getElementById('savings-rate'), doc.getElementById('report-savings-rate')].filter(Boolean) : [];

      incEls.forEach(el => el.textContent = formatVND(summary.totalIncome));
      expEls.forEach(el => el.textContent = formatVND(summary.totalExpense));

      balEls.forEach(el => {
        el.textContent = formatVND(summary.netBalance);
        if (summary.netBalance < 0) {
          el.classList.add('negative-balance');
          el.classList.remove('positive-balance');
        } else {
          el.classList.add('positive-balance');
          el.classList.remove('negative-balance');
        }
      });

      savEls.forEach(el => {
        el.textContent = `${summary.savingsRate}%`;
        if (summary.savingsRate < 0) {
          el.classList.add('negative-savings');
          el.classList.remove('positive-savings');
        } else {
          el.classList.add('positive-savings');
          el.classList.remove('negative-savings');
        }
      });

      // MoM Badges
      if (mom) {
        const incMomEls = [document.getElementById('income-mom'), document.getElementById('report-income-mom')].filter(Boolean);
        const expMomEls = [document.getElementById('expense-mom'), document.getElementById('report-expense-mom')].filter(Boolean);
        const balMomEls = [document.getElementById('balance-mom'), document.getElementById('report-balance-mom')].filter(Boolean);

        incMomEls.forEach(el => {
          el.textContent = `${mom.incomeIsUp ? '▲' : '▼'} ${mom.incomeDiff} so với kỳ trước`;
          el.className = `mom-badge ${mom.incomeIsUp ? 'mom-positive' : 'mom-negative'}`;
        });
        expMomEls.forEach(el => {
          el.textContent = `${mom.expenseIsUp ? '▲' : '▼'} ${mom.expenseDiff} so với kỳ trước`;
          el.className = `mom-badge ${mom.expenseIsUp ? 'mom-negative' : 'mom-positive'}`;
        });
        balMomEls.forEach(el => {
          el.textContent = `${mom.balanceIsUp ? '▲' : '▼'} ${mom.balanceDiff} so với kỳ trước`;
          el.className = `mom-badge ${mom.balanceIsUp ? 'mom-positive' : 'mom-negative'}`;
        });
      }

      // Forecast & Emergency Cards
      if (forecast) {
        const fcEl = document.getElementById('monthly-forecast');
        const brEl = document.getElementById('daily-burnrate');
        const emEl = document.getElementById('emergency-fund-months');
        const stEl = document.getElementById('emergency-status');

        if (fcEl) fcEl.textContent = formatVND(forecast.monthlyForecast);
        if (brEl) brEl.textContent = `Tốc độ tiêu dùng: ${formatVND(forecast.dailyBurnRate)}/ngày`;
        if (emEl) emEl.textContent = `${forecast.emergencyFundMonths} tháng`;
        if (stEl) {
          stEl.textContent = forecast.emergencyFundMonths >= 3 
            ? '✅ An toàn (Duy trì >3 tháng)' 
            : '⚠️ Cần tích lũy thêm quỹ khẩn cấp';
        }
      }
    }

    /**
     * Render Smart Executive Summary Card Text
     */
    renderSmartExecutiveSummary(summary, mom, health, forecast, alloc) {
      const summaryEl = document.getElementById('smart-executive-summary-text');
      const badgeEl = document.getElementById('financial-health-badge');
      if (!summaryEl) return;

      if (badgeEl) {
        badgeEl.textContent = `Điểm Sức Khỏe: ${health.score}/100 (${health.levelText})`;
        badgeEl.className = `health-score-badge ${health.badgeClass}`;
      }

      const db = global.DB || (global.window && global.window.DB);
      const formatVND = (db && db.formatVND) || global.formatVND || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      let textHtml = '';
      if (summary.totalIncome === 0 && summary.totalExpense === 0) {
        textHtml = '<p>Chưa có đủ dữ liệu giao dịch trong khoảng thời gian này để lập báo cáo tài chính.</p>';
      } else {
        const statusIcon = summary.netBalance >= 0 ? '🟢' : '🚨';
        const balanceWord = summary.netBalance >= 0 ? 'thặng dư ròng' : 'bội chi';
        
        textHtml = `
          <p>${statusIcon} Trong kỳ báo cáo, tổng thu nhập đạt <strong>${formatVND(summary.totalIncome)}</strong> và tổng chi tiêu là <strong>${formatVND(summary.totalExpense)}</strong>, ghi nhận mức ${balanceWord} <strong>${formatVND(Math.abs(summary.netBalance))}</strong> (Tỷ lệ tiết kiệm: <strong>${summary.savingsRate}%</strong>).</p>
          <p>📊 <strong>Xu hướng & Dự báo:</strong> Chi tiêu trung bình hiện tại đạt <strong>${formatVND(forecast.dailyBurnRate)}/ngày</strong>. Dự kiến tổng chi tiêu cả tháng chạm mốc <strong>${formatVND(forecast.monthlyForecast)}</strong>.</p>
          <p>🎯 <strong>Cơ cấu 50/30/20:</strong> Nhu cầu thiết yếu chiếm <strong>${alloc.needsPct}%</strong> (ngân sách khuyến nghị: 50%), Mong muốn cá nhân chiếm <strong>${alloc.wantsPct}%</strong>, và Tiết kiệm chiếm <strong>${alloc.savingsPct}%</strong>.</p>
        `;
      }

      summaryEl.innerHTML = textHtml;
    }

    /**
     * Render 50/30/20 Progress Bar Section
     */
    render503020RuleSection(alloc) {
      const container = document.getElementById('rule-503020-container');
      if (!container) return;

      const db = global.DB || (global.window && global.window.DB);
      const formatVND = (db && db.formatVND) || global.formatVND || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      container.innerHTML = `
        <div class="rule-item">
          <div class="rule-header">
            <span>🏠 Nhu cầu thiết yếu (Mục tiêu 50%)</span>
            <strong>${formatVND(alloc.needsAmount)} (${alloc.needsPct}%)</strong>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill fill-needs" style="width: ${Math.min(100, alloc.needsPct)}%"></div>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-header">
            <span>☕ Mong muốn cá nhân (Mục tiêu 30%)</span>
            <strong>${formatVND(alloc.wantsAmount)} (${alloc.wantsPct}%)</strong>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill fill-wants" style="width: ${Math.min(100, alloc.wantsPct)}%"></div>
          </div>
        </div>
        <div class="rule-item">
          <div class="rule-header">
            <span>💎 Tiết kiệm & Đầu tư (Mục tiêu 20%)</span>
            <strong>${formatVND(alloc.savingsAmount)} (${alloc.savingsPct}%)</strong>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill fill-savings" style="width: ${Math.min(100, alloc.savingsPct)}%"></div>
          </div>
        </div>
      `;
    }

    /**
     * Render Top 5 Expenses & Pareto 80/20 Analysis
     */
    renderParetoAndTopExpenses(filteredTxs = [], totalExpense = 0) {
      const container = document.getElementById('top-expenses-container');
      if (!container) return;

      const db = global.DB || (global.window && global.window.DB);
      const formatVND = (db && db.formatVND) || global.formatVND || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      const expenses = filteredTxs
        .filter(t => t.type === 'expense')
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 5);

      if (expenses.length === 0) {
        container.innerHTML = '<p class="empty-list-msg">Chưa có giao dịch chi tiêu nào trong kỳ này.</p>';
        return;
      }

      let html = '<div class="top-expenses-list">';
      expenses.forEach((tx, idx) => {
        const amount = Number(tx.amount) || 0;
        const pct = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : 0;

        html += `
          <div class="top-expense-item">
            <div class="expense-rank">#${idx + 1}</div>
            <div class="expense-details">
              <strong>${tx.category || 'Khác'}</strong>
              <span class="expense-note">${tx.note || 'Không có ghi chú'} • ${tx.date}</span>
            </div>
            <div class="expense-amount-box">
              <span class="expense-amount-val">${formatVND(amount)}</span>
              <span class="expense-pct-tag">${pct}% ngân sách</span>
            </div>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
    }

    /**
     * Render Cash Flow & Trend Analysis Chart (Line Chart)
     */
    renderTrendChart(filteredTxs = []) {
      const canvas = document.getElementById('trend-chart');
      if (!canvas) return;
      const Chart = global.Chart || (typeof window !== 'undefined' && window.Chart);
      if (!Chart) return;

      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDarkMode ? '#f8fafc' : '#0f172a';
      const gridColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

      // Group transactions by date
      const dateMap = {};
      filteredTxs.forEach(tx => {
        const d = tx.date || 'Khác';
        if (!dateMap[d]) dateMap[d] = { income: 0, expense: 0 };
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') dateMap[d].income += amt;
        else dateMap[d].expense += amt;
      });

      const sortedDates = Object.keys(dateMap).sort();
      const incomeData = [];
      const expenseData = [];
      const cumulativeData = [];

      let runningBalance = 0;
      sortedDates.forEach(d => {
        const inc = dateMap[d].income;
        const exp = dateMap[d].expense;
        runningBalance += (inc - exp);

        incomeData.push(inc);
        expenseData.push(exp);
        cumulativeData.push(runningBalance);
      });

      const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
      if (!ctx) return;

      if (this.trendChartInstance) {
        try { this.trendChartInstance.destroy(); } catch (e) {}
        this.trendChartInstance = null;
      }

      const db = global.DB || (global.window && global.window.DB);
      const formatVND = (db && db.formatVND) || global.formatVND || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      this.trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: sortedDates.length > 0 ? sortedDates : ['Chưa có dữ liệu'],
          datasets: [
            {
              label: 'Thu nhập',
              data: incomeData.length > 0 ? incomeData : [0],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.3,
              fill: true
            },
            {
              label: 'Chi tiêu',
              data: expenseData.length > 0 ? expenseData : [0],
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.3,
              fill: true
            },
            {
              label: 'Số dư tích lũy',
              data: cumulativeData.length > 0 ? cumulativeData : [0],
              borderColor: '#3b82f6',
              borderDash: [5, 5],
              backgroundColor: 'transparent',
              tension: 0.3,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: textColor } },
            tooltip: {
              callbacks: {
                label: (context) => ` ${context.dataset.label}: ${formatVND(context.parsed.y || 0)}`
              }
            }
          },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });
    }

    /**
     * Destroy Chart.js instances to prevent canvas reuse errors & memory leaks
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

      this.trendChartInstance = null;
    }

    /**
     * Open Drill-down Modal showing category transaction details
     */
    openDrilldownModal(categoryName, categoryType, filteredTxs) {
      const modal = document.getElementById('modal-drilldown');
      const titleEl = document.getElementById('drilldown-modal-title');
      const summaryBarEl = document.getElementById('drilldown-summary-bar');
      const listEl = document.getElementById('drilldown-tx-list');
      if (!modal || !listEl) return;

      const targetTxs = filteredTxs.filter(t => t.type === categoryType && (t.category || 'Khác') === categoryName);
      const totalAmount = targetTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      const db = global.DB || (global.window && global.window.DB);
      const formatVND = (db && db.formatVND) || global.formatVND || (n => Number(n).toLocaleString('vi-VN') + ' ₫');

      if (titleEl) titleEl.textContent = `Chi Tiết: ${categoryName}`;
      if (summaryBarEl) {
        summaryBarEl.innerHTML = `
          <div class="drilldown-summary-item">
            <span>Tổng giao dịch: <strong>${targetTxs.length}</strong></span>
            <span>Tổng số tiền: <strong>${formatVND(totalAmount)}</strong></span>
          </div>
        `;
      }

      if (targetTxs.length === 0) {
        listEl.innerHTML = '<p class="empty-list-msg">Không tìm thấy giao dịch nào.</p>';
      } else {
        let html = '<ul class="drilldown-tx-items">';
        targetTxs.forEach(tx => {
          html += `
            <li class="drilldown-tx-item">
              <div class="tx-main">
                <span class="tx-date">${tx.date}</span>
                <span class="tx-note">${tx.note || 'Không có ghi chú'}</span>
              </div>
              <div class="tx-amount ${tx.type === 'income' ? 'income-text' : 'expense-text'}">
                ${tx.type === 'income' ? '+' : '-'}${formatVND(tx.amount)}
              </div>
            </li>
          `;
        });
        html += '</ul>';
        listEl.innerHTML = html;
      }

      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Export Report to CSV file
     */
    exportReportCSV() {
      const db = global.DB || (global.window && global.window.DB);
      const rawTxs = db && typeof db.getTransactions === 'function' ? db.getTransactions() : [];
      const filteredTxs = this.filterTransactionsByDateRange(rawTxs);

      let csvContent = '\uFEFFGiaoDichID,Ngay,Loai,HangMuc,SoTien,GhiChu\n';
      filteredTxs.forEach(t => {
        const id = t.id || '';
        const date = t.date || '';
        const type = t.type === 'income' ? 'Thu nhập' : 'Chi tiêu';
        const category = `"${(t.category || '').replace(/"/g, '""')}"`;
        const amount = t.amount || 0;
        const note = `"${(t.note || '').replace(/"/g, '""')}"`;
        csvContent += `${id},${date},${type},${category},${amount},${note}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Bao_Cao_Tai_Chinh_${this.currentDateRange}_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    /**
     * Print / PDF Export
     */
    printReportPDF() {
      if (typeof window !== 'undefined') {
        window.print();
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
      const mom = this.calculateMoMComparison(transactions, summary);
      const forecast = this.calculateBurnRateAndForecast(filteredTxs, transactions, summary);
      const alloc = this.calculate503020Allocation(filteredTxs, summary.totalExpense);
      const health = this.calculateFinancialHealthScore(summary, alloc, forecast.emergencyFundMonths);

      this.updateSummaryCards(summary, mom, forecast);
      this.renderSmartExecutiveSummary(summary, mom, health, forecast, alloc);
      this.render503020RuleSection(alloc);
      this.renderParetoAndTopExpenses(filteredTxs, summary.totalExpense);
      this.renderTrendChart(filteredTxs);

      const Chart = global.Chart || (typeof window !== 'undefined' && window.Chart);
      if (!Chart || typeof document === 'undefined') return;

      this.destroyCharts();

      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDarkMode ? '#f8fafc' : '#0f172a';

      // 1. Category Breakdown Doughnut Chart
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
              onClick: (evt, elements) => {
                if (elements && elements.length > 0 && catData.labels.length > 0) {
                  const clickedIdx = elements[0].index;
                  const catName = catData.labels[clickedIdx];
                  this.openDrilldownModal(catName, this.categoryType, filteredTxs);
                }
              },
              plugins: {
                legend: { position: 'bottom', labels: { color: textColor } },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      if (catData.data.length === 0) return ' Chưa có giao dịch';
                      const label = context.label || '';
                      const value = context.parsed || 0;
                      const pct = catData.percentages[context.dataIndex] || 0;
                      const formatted = (db && db.formatVND) ? db.formatVND(value) : value + ' ₫';
                      return ` ${label}: ${formatted} (${pct}%) (Bấm để xem chi tiết)`;
                    }
                  }
                }
              }
            }
          });
        }
      }

      // 2. Income vs Expense Bar Chart
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
                    label: (context) => ` ${(db && db.formatVND) ? db.formatVND(context.parsed.y || 0) : (context.parsed.y || 0) + ' ₫'}`
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

      ['transactionadded', 'transactionupdated', 'transactiondeleted'].forEach(evtName => {
        window.addEventListener(evtName, () => this.renderCharts());
      });

      window.addEventListener('routechanged', (e) => {
        if (e && e.detail && e.detail.route === 'reports') {
          this.renderCharts();
        }
      });

      window.addEventListener('themechanged', () => {
        this.renderCharts();
      });

      if (typeof document !== 'undefined') {
        document.getElementById('filter-report-wallet')?.addEventListener('change', () => this.renderCharts());
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

        // Export Actions
        const btnCsv = document.getElementById('btn-export-csv');
        if (btnCsv) {
          btnCsv.addEventListener('click', () => this.exportReportCSV());
        }

        const btnPdf = document.getElementById('btn-print-pdf');
        if (btnPdf) {
          btnPdf.addEventListener('click', () => this.printReportPDF());
        }

        // Close drilldown modal listeners
        document.querySelectorAll('[data-close-modal="drilldown"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const modal = document.getElementById('modal-drilldown');
            if (modal) {
              modal.setAttribute('hidden', '');
              modal.setAttribute('aria-hidden', 'true');
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
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
