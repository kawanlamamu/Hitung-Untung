// ─── DATA ────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let selectedType = 'income';
let selectedExpenseType = 'harian';
let budgetLimit  = parseInt(localStorage.getItem('budgetLimit')) || 0;
let selectedIncomeType = 'harian';
let goals = JSON.parse(localStorage.getItem('goals')) || {
  harian:   { name: '', amount: 0 },
  mingguan: { name: '', amount: 0 },
  bulanan:  { name: '', amount: 0 }
  
};

const CATEGORIES = {
  transportasi: { label: '🛵 Transportasi', color: '#e8f5e9' },
  makan:        { label: '🍱 Makan & Minum', color: '#fff3e0' },
  keluarga:     { label: '👨‍👩‍👧 Keluarga',    color: '#fce4ec' },
  pulsa:        { label: '📱 Pulsa & Internet', color: '#e3f2fd' },
  tinggal:      { label: '🏠 Tempat Tinggal', color: '#f3e5f5' },
  lainnya:      { label: '💰 Lainnya',        color: '#f5f5f5' }
};

// ─── INIT ────────────────────────────────────────────
window.onload = function() {
  setDefaultDate();
  updateSummary();
  renderHistory();
  checkBudget();
  renderAllGoals();
  updateSettings();
  updateBudgetDisplay();
  renderStreak();
  renderLocks();
  renderScorecard();
  renderCategoryBreakdown();
  initRiwayat();
}

// Auto-refresh date every minute (in case app stays open overnight)
setInterval(function() {
  const dateInput = document.getElementById('input-date');
  if (dateInput && dateInput.value !== getToday()) {
    dateInput.value = getToday();
    renderScorecard();
  }
}, 60000);

// ─── DATE HELPERS ────────────────────────────────────
function getToday() {
  return new Date().toISOString().split('T')[0];
}
function getPreviousDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
function setDefaultDate() {
  document.getElementById('input-date').value = getToday();
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
function isToday(dateStr)    { return dateStr === getToday(); }
function isThisWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0,0,0,0);
  return d >= start;
}
function isThisMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ─── DAILY SCORECARD ─────────────────────────────────
function renderScorecard() {
  const scorecard = document.getElementById('daily-scorecard');
  if (!scorecard) return;

  // Pull target from calculator result, fallback to harian goal
  const dailyTarget = goals.harian && goals.harian.amount > 0
    ? goals.harian.amount : 0;

  // Only Harian income counts toward daily target
  let todayIncome = 0;
  transactions.forEach(t => {
    if (isToday(t.date) && t.type === 'income' && t.incomeType !== 'nonharian') {
      todayIncome += t.amount;
    }
  });

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  // No target set yet
  if (dailyTarget === 0) {
    scorecard.innerHTML = `
      <div class="scorecard scorecard-neutral">
        <p class="scorecard-date">${today}</p>
        <p class="scorecard-hint">Set target di Kalkulator untuk melihat progress harianmu 🎯</p>
        <button class="scorecard-cta" onclick="switchTab('kalkulator')">Buka Kalkulator →</button>
      </div>
    `;
    return;
  }

  const gap     = dailyTarget - todayIncome;
  const percent = Math.min((todayIncome / dailyTarget) * 100, 100);
  const done    = gap <= 0;

  let emoji, status, gapText;
  if (done) {
    emoji = '✅'; status = 'Target Tercapai!';
    gapText = `Lebih ${formatRupiah(Math.abs(gap))} dari target 🔥`;
  } else if (percent >= 75) {
    emoji = '⚡'; status = 'Hampir Sampai!';
    gapText = `Kurang ${formatRupiah(gap)} lagi`;
  } else if (percent >= 40) {
    emoji = '💪'; status = 'Terus Semangat!';
    gapText = `Kurang ${formatRupiah(gap)} lagi`;
  } else {
    emoji = '🎯'; status = 'Yuk Kejar Target!';
    gapText = `Kurang ${formatRupiah(gap)} lagi`;
  }

  scorecard.innerHTML = `
    <div class="scorecard ${done ? 'scorecard-done' : 'scorecard-active'}">
      <p class="scorecard-date">${today}</p>
      <div class="scorecard-body">
        <div class="scorecard-left">
          <p class="scorecard-income-label">Pemasukan hari ini</p>
          <p class="scorecard-income-amount">${formatRupiah(todayIncome)}</p>
          <p class="scorecard-gap-text">${gapText}</p>
        </div>
        <div class="scorecard-badge">
          <p class="scorecard-badge-emoji">${emoji}</p>
          <p class="scorecard-badge-text">${status}</p>
        </div>
      </div>
      <div class="sc-bar-bg">
        <div class="sc-bar-fill ${done ? 'sc-bar-done' : ''}" style="width:${percent}%"></div>
      </div>
      <div class="sc-footer">
        <span>Target: ${formatRupiah(dailyTarget)}</span>
        <span>${Math.round(percent)}%</span>
      </div>
    </div>
  `;
}

// ─── CATEGORIES ──────────────────────────────────────
function selectCategory(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getSelectedCategory() {
  const active = document.querySelector('.cat-btn.active');
  return active ? active.dataset.cat : 'lainnya';
}

function renderCategoryBreakdown() {
  const container = document.getElementById('category-breakdown');
  if (!container) return;

  const harianTotals  = {};
  const bulananTotals = {};

  transactions.forEach(t => {
    if (t.type === 'expense' && isThisMonth(t.date) && t.category) {
      if (t.expenseType === 'bulanan') {
        bulananTotals[t.category] = (bulananTotals[t.category] || 0) + t.amount;
      } else {
        harianTotals[t.category] = (harianTotals[t.category] || 0) + t.amount;
      }
    }
  });

  const hasHarian  = Object.keys(harianTotals).length > 0;
  const hasBulanan = Object.keys(bulananTotals).length > 0;

  if (!hasHarian && !hasBulanan) { container.innerHTML = ''; return; }

  let html = '';

  // ── Harian breakdown ──
  if (hasHarian) {
    const total = Object.values(harianTotals).reduce((a,b) => a+b, 0);
    html += `<p class="breakdown-title" style="color:#e65100">⚡ Pengeluaran Harian Bulan Ini</p>
             <div class="breakdown-scroll">`;
    Object.entries(harianTotals).sort((a,b) => b[1]-a[1]).forEach(([cat, amount]) => {
      const info = CATEGORIES[cat] || CATEGORIES.lainnya;
      const pct  = Math.round((amount / total) * 100);
      html += `
        <div class="breakdown-card breakdown-card-harian">
          <p class="breakdown-cat-label">${info.label}</p>
          <p class="breakdown-cat-amount">${formatRupiah(amount)}</p>
        </div>
      `;
    });
    html += '</div>';
  }

  // ── Bulanan breakdown ──
  if (hasBulanan) {
    const total = Object.values(bulananTotals).reduce((a,b) => a+b, 0);
    html += `<p class="breakdown-title" style="color:#1565c0;margin-top:${hasHarian ? '16px' : '0'}">📅 Pengeluaran Bulanan Bulan Ini</p>
             <div class="breakdown-scroll">`;
    Object.entries(bulananTotals).sort((a,b) => b[1]-a[1]).forEach(([cat, amount]) => {
      const info = CATEGORIES[cat] || CATEGORIES.lainnya;
      const pct  = Math.round((amount / total) * 100);
      html += `
        <div class="breakdown-card breakdown-card-bulanan">
          <p class="breakdown-cat-label">${info.label}</p>
          <p class="breakdown-cat-amount">${formatRupiah(amount)}</p>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

// ─── TAB SWITCHING ───────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');

  if (tabName === 'beranda')    { setDefaultDate(); renderScorecard(); }
  if (tabName === 'riwayat')    { refreshActiveSubTab(); }
  if (tabName === 'pengaturan') { renderHistory(); renderCategoryBreakdown(); }
  if (tabName === 'insight')    { renderInsightLock(); }

  const tabOrder = ['beranda', 'riwayat', 'kalkulator', 'target', 'insight'];
  const idx = tabOrder.indexOf(tabName);
  if (idx !== -1) {
    document.querySelectorAll('.nav-btn')[idx].classList.add('active');
  }

  const titles = {
    beranda:    'Aplikasi pencatat keuangan kamu',
    riwayat:    'Riwayat Transaksi',
    kalkulator: 'Kalkulator Target Harian',
    target:     'Budget & Target Tabungan',
    insight:    'Insight Keuangan AI',
    pengaturan: 'Pengaturan'
  };
  document.getElementById('header-subtitle').textContent = titles[tabName] || '';
  window.scrollTo(0, 0);
}

// ─── TRANSACTION ─────────────────────────────────────
function setType(type) {
  selectedType = type;
  document.getElementById('btn-income').classList.remove('active');
  document.getElementById('btn-expense').classList.remove('active');
  document.getElementById('btn-' + type).classList.add('active');

  const isExpense = type === 'expense';
  const isIncome  = type === 'income';

  document.getElementById('income-type-group').style.display  = isIncome  ? 'block' : 'none';
  document.getElementById('expense-type-group').style.display = isExpense ? 'block' : 'none';
  document.getElementById('category-group').style.display     = isExpense ? 'block' : 'none';
}

function setExpenseType(type) {
  selectedExpenseType = type;
  document.getElementById('btn-harian-exp').classList.remove('active');
  document.getElementById('btn-bulanan-exp').classList.remove('active');
  document.getElementById('btn-' + type + '-exp').classList.add('active');
}
function setIncomeType(type) {
  selectedIncomeType = type;
  document.getElementById('btn-harian-inc').classList.remove('active');
  document.getElementById('btn-nonharian-inc').classList.remove('active');
  document.getElementById('btn-' + type + '-inc').classList.add('active');
}

function formatRupiah(number) {
  return 'Rp ' + number.toLocaleString('id-ID');
}

function addTransaction() {
  const date   = document.getElementById('input-date').value;
  const desc   = document.getElementById('input-desc').value;
  const amount = parseInt(document.getElementById('input-amount').value);
  if (!desc || !amount) { alert('Mohon isi keterangan dan jumlah!'); return; }

  const prevStreak = getCurrentStreak();

  transactions.push({
    id:          Date.now(),
    date:        date || getToday(),
    desc,
    amount,
    type:        selectedType,
    incomeType:  selectedType === 'income'  ? selectedIncomeType  : null,
    expenseType: selectedType === 'expense' ? selectedExpenseType : null,
    category:    selectedType === 'expense' ? getSelectedCategory() : null
  });

  localStorage.setItem('transactions', JSON.stringify(transactions));
  document.getElementById('input-desc').value   = '';
  document.getElementById('input-amount').value = '';
  setDefaultDate();

  const newStreak = getCurrentStreak();

  updateSummary();
  renderHistory();
  checkBudget();
  renderAllGoals();
  updateSettings();
  renderStreak();
  renderLocks();
  renderScorecard();
  renderCategoryBreakdown();
  checkMilestoneUnlock(prevStreak, newStreak);
}

function updateSummary() {
  let totalIncome = 0, totalExpense = 0;
  transactions.forEach(t => {
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpense += t.amount;
  });
  const balance = totalIncome - totalExpense;
  document.getElementById('total-income').textContent  = formatRupiah(totalIncome);
  document.getElementById('total-expense').textContent = formatRupiah(totalExpense);
  document.getElementById('total-balance').textContent = formatRupiah(balance);
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  localStorage.setItem('transactions', JSON.stringify(transactions));
  updateSummary(); renderHistory(); checkBudget();
  renderAllGoals(); updateSettings(); renderStreak();
  renderLocks(); renderScorecard(); renderCategoryBreakdown();
}

// ─── HISTORY ─────────────────────────────────────────
function renderHistory() {
const container = document.getElementById('history-list');
  if (transactions.length === 0) {
    container.innerHTML = '<p class="empty-msg">Belum ada transaksi.</p>';
    return;
  }

  // Split into 3 groups: income, harian expense, bulanan expense
  const incomes  = [...transactions].filter(t => t.type === 'income').reverse();
  const harians  = [...transactions].filter(t => t.type === 'expense' && t.expenseType !== 'bulanan').reverse();
  const bulanans = [...transactions].filter(t => t.type === 'expense' && t.expenseType === 'bulanan').reverse();

  const totalHarian  = harians.reduce((sum, t)  => sum + t.amount, 0);
  const totalBulanan = bulanans.reduce((sum, t) => sum + t.amount, 0);

  container.innerHTML = '';

  // ── Pemasukan Harian ──
  const harianIncome    = incomes.filter(t => t.incomeType !== 'nonharian');
  const nonHarianIncome = incomes.filter(t => t.incomeType === 'nonharian');

  if (harianIncome.length > 0) {
    const total = harianIncome.reduce((s,t) => s+t.amount, 0);
    container.innerHTML += `
      <div class="riwayat-section-title" style="color:#2d6a4f">
        ⚡ Pemasukan Harian
        <span class="riwayat-section-total">${formatRupiah(total)}</span>
      </div>
    `;
    harianIncome.forEach(t => container.appendChild(buildHistoryItem(t)));
  }

  // ── Pemasukan Non-Harian ──
  if (nonHarianIncome.length > 0) {
    const total = nonHarianIncome.reduce((s,t) => s+t.amount, 0);
    if (harianIncome.length > 0) container.innerHTML += '<div class="section-divider"></div>';
    container.innerHTML += `
      <div class="riwayat-section-title" style="color:#1565c0">
        📅 Pemasukan Non-Harian
        <span class="riwayat-section-total">${formatRupiah(total)}</span>
      </div>
    `;
    nonHarianIncome.forEach(t => container.appendChild(buildHistoryItem(t)));
  }

  // ── Pengeluaran Harian ──
  if (harians.length > 0) {
    if (incomes.length > 0) container.innerHTML += '<div class="section-divider"></div>';
    container.innerHTML += `
      <div class="riwayat-section-title riwayat-section-harian">
        ⚡ Pengeluaran Harian
        <span class="riwayat-section-total">${formatRupiah(totalHarian)}</span>
      </div>
    `;
    harians.forEach(t => container.appendChild(buildHistoryItem(t)));
  }

  // ── Pengeluaran Bulanan ──
  if (bulanans.length > 0) {
    if (incomes.length > 0 || harians.length > 0) {
      container.innerHTML += '<div class="section-divider"></div>';
    }
    container.innerHTML += `
      <div class="riwayat-section-title riwayat-section-bulanan">
        📅 Pengeluaran Bulanan
        <span class="riwayat-section-total">${formatRupiah(totalBulanan)}</span>
      </div>
    `;
    bulanans.forEach(t => container.appendChild(buildHistoryItem(t)));
  }

  if (transactions.length === 0) {
    container.innerHTML = '<p class="empty-msg">Belum ada transaksi.</p>';
  }
}

function buildHistoryItem(t) {
  const item     = document.createElement('div');
  item.className = 'history-item';
  const isIncome  = t.type === 'income';
  const catInfo   = t.category ? CATEGORIES[t.category] : null;

  let typeTag = '';
  if (t.type === 'expense') {
    typeTag = t.expenseType === 'bulanan'
      ? '<span class="tag-bulanan">📅 Bulanan</span>'
      : '<span class="tag-harian">⚡ Harian</span>';
  } else if (t.type === 'income') {
    typeTag = t.incomeType === 'nonharian'
      ? '<span class="tag-income-nonharian">📅 Non-Harian</span>'
      : '<span class="tag-income-harian">⚡ Harian</span>';
  }

  const catTag = catInfo
    ? `<span class="cat-tag" style="background:${catInfo.color}">${catInfo.label}</span>`
    : '';

  item.innerHTML = `
    <div class="history-row1">
      <div class="history-info">
        <span class="history-icon">${isIncome ? '⬆' : '⬇'}</span>
        <div class="history-desc-wrap">
          <span class="history-desc">${t.desc}</span>
          <div>${typeTag}${catTag}</div>
        </div>
      </div>
      <div class="history-right">
        <span class="history-amount ${isIncome ? 'income' : 'expense'}">
          ${isIncome ? '+' : '-'} ${formatRupiah(t.amount)}
        </span>
        <button class="delete-btn" onclick="deleteTransaction(${t.id})">✕</button>
      </div>
    </div>
    <div class="history-date">📅 ${formatDate(t.date)}</div>
  `;
  return item;    
}

function downloadCSV() {
  if (transactions.length === 0) { alert('Belum ada transaksi untuk diunduh.'); return; }
  const header = ['Tanggal','Keterangan','Jenis','Kategori','Jumlah (Rp)'];
  const rows   = [...transactions].reverse().map(t => [
    t.date, t.desc,
    t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    t.category ? (CATEGORIES[t.category]?.label || t.category) : '-',
    t.amount
  ]);
  const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'finansialku-riwayat.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── BUDGET ──────────────────────────────────────────
function saveBudget() {
  const input = parseInt(document.getElementById('input-budget').value);
  if (!input || input <= 0) { alert('Mohon masukkan jumlah budget yang valid!'); return; }
  budgetLimit = input;
  localStorage.setItem('budgetLimit', budgetLimit);
  document.getElementById('input-budget').value = '';
  updateBudgetDisplay();
  checkBudget();
}
function updateBudgetDisplay() {
  document.getElementById('budget-current-amount').textContent =
    budgetLimit > 0 ? formatRupiah(budgetLimit) : 'Belum diset';
}
function checkBudget() {
  if (budgetLimit === 0) return;

  // Daily: only count today's expenses
  let todayExpense = 0;
  transactions.forEach(t => {
    if (t.type === 'expense' && isToday(t.date)) todayExpense += t.amount;
  });

  const percent   = (todayExpense / budgetLimit) * 100;
  const remaining = budgetLimit - todayExpense;

  let cssClass, message;
  if (percent >= 100) {
    cssClass = 'danger';
    message  = '🚨 Budget harian terlampaui! Melebihi ' + formatRupiah(budgetLimit) + ' sebesar ' + formatRupiah(Math.abs(remaining));
  } else if (percent >= 75) {
    cssClass = 'warning';
    message  = '⚠️ Hati-hati! Pengeluaran hari ini sudah ' + Math.round(percent) + '% dari budget. Sisa ' + formatRupiah(remaining);
  } else {
    cssClass = 'safe';
    message  = '✅ Budget aman. Terpakai ' + Math.round(percent) + '% hari ini. Sisa ' + formatRupiah(remaining);
  }

  // Update Target tab
  const statusBox = document.getElementById('budget-status');
  if (statusBox) {
    statusBox.className   = 'budget-status ' + cssClass;
    statusBox.textContent = message;
  }

  // Update Home tab alert (only if >= 75%)
  const alertBox = document.getElementById('budget-alert');
  if (alertBox) {
    alertBox.innerHTML = percent >= 75
      ? `<div class="budget-status ${cssClass}" style="display:block">${message}</div>` : '';
  }
}
function renderDailyBudget(dateStr) {
  const container = document.getElementById('budget-harian');
  if (!container || budgetLimit === 0) {
    if (container) container.innerHTML = '';
    return;
  }

  let dayExpense = 0;
  transactions.forEach(t => {
    if (t.type === 'expense' && t.date === dateStr) dayExpense += t.amount;
  });

  const percent   = Math.min((dayExpense / budgetLimit) * 100, 100);
  const remaining = budgetLimit - dayExpense;
  const isOver    = dayExpense > budgetLimit;

  let barClass, footerClass, footerText;
  if (percent >= 100) {
    barClass    = 'daily-budget-bar-danger';
    footerClass = 'danger';
    footerText  = '🚨 Over budget ' + formatRupiah(Math.abs(remaining));
  } else if (percent >= 75) {
    barClass    = 'daily-budget-bar-warning';
    footerClass = 'warning';
    footerText  = '⚠️ Sisa ' + formatRupiah(remaining);
  } else {
    barClass    = 'daily-budget-bar-safe';
    footerClass = 'safe';
    footerText  = '✅ Sisa ' + formatRupiah(remaining);
  }

  container.innerHTML = `
    <div class="daily-budget-card">
      <div class="daily-budget-header">
        <p class="daily-budget-label">🚨 Budget Harian</p>
        <p class="daily-budget-amounts">
          ${formatRupiah(dayExpense)} / ${formatRupiah(budgetLimit)}
        </p>
      </div>
      <div class="daily-budget-bar-bg">
        <div class="daily-budget-bar-fill ${barClass}"
             style="width:${percent}%"></div>
      </div>
      <p class="daily-budget-footer ${footerClass}">${footerText}</p>
    </div>
  `;
}

// ─── CALCULATOR ──────────────────────────────────────
function addCalcRow(group) {
  const nameMap = { living:'new-living-name', working:'new-working-name', income:'new-income-name' };
  const contMap = { living:'calc-living-costs', working:'calc-working-costs', income:'calc-other-income' };
  const nameInput = document.getElementById(nameMap[group]);
  const label     = nameInput.value.trim();
  if (!label) { alert('Mohon isi nama terlebih dahulu.'); return; }
  const row = document.createElement('div');
  row.className = 'calc-row';
  row.innerHTML = `
    <span class="calc-row-label">${label}</span>
    <input type="number" class="calc-input" placeholder="0">
    <button class="calc-delete-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  document.getElementById(contMap[group]).appendChild(row);
  nameInput.value = '';
}
function getCalcTotal(containerId) {
  let total = 0;
  document.querySelectorAll(`#${containerId} .calc-input`).forEach(i => { total += parseFloat(i.value) || 0; });
  return total;
}
function calculateDaily() {
  const totalLiving  = getCalcTotal('calc-living-costs');
  const totalWorking = getCalcTotal('calc-working-costs');
  const totalIncome  = getCalcTotal('calc-other-income');
  const dailySaving  = parseFloat(document.getElementById('calc-daily-saving').value) || 0;
  const dailyLiving  = totalLiving / 30;
  const rawTarget    = dailyLiving + totalWorking + dailySaving;
  const netTarget    = Math.max(rawTarget - (totalIncome / 30), 0);

  document.getElementById('res-living').textContent       = formatRupiah(totalLiving);
  document.getElementById('res-working').textContent      = formatRupiah(totalWorking);
  document.getElementById('res-saving').textContent       = formatRupiah(dailySaving);
  document.getElementById('res-other-income').textContent = formatRupiah(totalIncome);
  document.getElementById('res-daily-target').textContent = formatRupiah(netTarget);
  document.getElementById('res-daily-note').textContent   =
    `Per jam (10 jam kerja): ${formatRupiah(netTarget / 10)}`;

  // Temporarily store for copy button
  localStorage.setItem('calculatedDailyTarget', Math.round(netTarget));

  document.getElementById('calc-results').style.display = 'block';
  document.getElementById('calc-results').scrollIntoView({ behavior:'smooth' });

  // Refresh scorecard with new target
  renderScorecard();
}
function copyToTarget() {
  const netTarget = parseInt(localStorage.getItem('calculatedDailyTarget') || 0);

  // Read directly from the last calculated result
  const resultEl = document.getElementById('res-daily-target');
  if (!resultEl || !resultEl.textContent || resultEl.textContent === '') {
    alert('Hitung dulu target harianmu!');
    return;
  }

  // Read directly from localStorage — avoids Indonesian number format parse issues
  const amount = parseInt(localStorage.getItem('calculatedDailyTarget') || '0');

  if (!amount || amount <= 0) {
    alert('Target tidak valid. Coba hitung ulang di Kalkulator.');
    return;
  }

  // Save as harian goal
  goals.harian = {
    name:   'Target Harian (Kalkulator)',
    amount: amount
  };
  localStorage.setItem('goals', JSON.stringify(goals));

  // Update button to show success
  const btn = document.querySelector('.copy-target-btn');
  if (btn) {
    btn.textContent = '✅ Tersimpan ke Target Harian!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = '📋 Salin ke Target Harian';
      btn.classList.remove('copied');
    }, 2500);
  }

  // Refresh everything that depends on harian goal
  renderScorecard();
  renderAllGoals();

  // Show a helpful nudge
  showCelebration(
    '🎯',
    'Target Harian Tersimpan!',
    `Target Rp ${amount.toLocaleString('id-ID')} sudah aktif di Beranda. Semangat hari ini!`
  );
}
function downloadCalcResult() {
  const today   = new Date().toLocaleDateString('id-ID');
  const content = `FINANSIALKU - Kalkulator Target Harian\nTanggal: ${today}\n\n` +
    `Biaya Hidup Bulanan : ${document.getElementById('res-living').textContent}\n` +
    `Biaya Operasional   : ${document.getElementById('res-working').textContent}\n` +
    `Target Tabungan     : ${document.getElementById('res-saving').textContent}\n` +
    `Penghasilan Lain    : ${document.getElementById('res-other-income').textContent}\n` +
    `─────────────────────────────────\n` +
    `TARGET HARIAN       : ${document.getElementById('res-daily-target').textContent}\n`;
  const blob = new Blob([content], { type:'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `finansialku-target-${today}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ─── STREAK ──────────────────────────────────────────
function getCurrentStreak() {
  if (transactions.length === 0) return 0;
  const uniqueDates = [...new Set(transactions.map(t => t.date))].sort().reverse();
  const today       = getToday();
  const yesterday   = getPreviousDay(today);
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;
  let streak     = 0;
  let expectDate = uniqueDates[0];
  for (const date of uniqueDates) {
    if (date === expectDate) { streak++; expectDate = getPreviousDay(expectDate); }
    else if (date < expectDate) break;
  }
  return streak;
}
function getTotalUniqueDays() {
  const uniqueDates = new Set(transactions.map(t => t.date));
  return uniqueDates.size;
}
function isUnlocked(feature) {
  const totalDays = getTotalUniqueDays();
  const thresholds = { mingguan: 7, bulanan: 14, badge: 21 };
  return totalDays >= (thresholds[feature] || 0);
}
function getNextMilestone(streak) {
  const totalDays = getTotalUniqueDays();
  if (totalDays < 7)  return { target: 7,  feature: 'Target Mingguan 📆', usingTotal: true };
  if (totalDays < 14) return { target: 14, feature: 'Target Bulanan & Insight 🗓💡', usingTotal: true };
  if (totalDays < 21) return { target: 21, feature: 'Badge Driver Finansial Sejati 🏆', usingTotal: true };
  return null;
}
function renderStreak() {
  const streak    = getCurrentStreak();
  const milestone = getNextMilestone(streak);
  const card      = document.getElementById('streak-card');
  const fireEmoji = streak === 0 ? '💤' : streak >= 14 ? '🔥🔥' : '🔥';

  
}
function renderLocks() {
  const totalDays = getTotalUniqueDays();

  // Calculator always unlocked
  document.getElementById('calc-lock').style.display = 'none';
  document.getElementById('calc-main').style.display = 'block';

  // Target Mingguan — 7 unique days
  const mingguanUnlocked = totalDays >= 7;
  document.getElementById('mingguan-lock').style.display = mingguanUnlocked ? 'none'  : 'flex';
  document.getElementById('mingguan-main').style.display = mingguanUnlocked ? 'block' : 'none';
  if (!mingguanUnlocked) {
    document.getElementById('mingguan-lock-bar').innerHTML = buildTotalDaysBar(totalDays, 7);
  }

  // Target Bulanan — 14 unique days
  const bulananUnlocked = totalDays >= 14;
  document.getElementById('bulanan-lock').style.display = bulananUnlocked ? 'none'  : 'flex';
  document.getElementById('bulanan-main').style.display = bulananUnlocked ? 'block' : 'none';
  if (!bulananUnlocked) {
    document.getElementById('bulanan-lock-bar').innerHTML = buildTotalDaysBar(totalDays, 14);
  }

  // Insight — 14 unique days
  renderInsightLock();

  // Badge
  document.getElementById('badge-settings-section').style.display =
    totalDays >= 21 ? 'block' : 'none';
}
function buildLockBar(current, target) {
  const pct = Math.round((current / target) * 100);
  return `
    <div class="lock-progress-bg">
      <div class="lock-progress-fill" style="width:${pct}%"></div>
    </div>
    <p class="lock-progress-text">${current} / ${target} hari</p>
  `;
}
function buildTotalDaysBar(current, target) {
  const pct = Math.round((current / target) * 100);
  return `
    <div class="lock-progress-bg">
      <div class="lock-progress-fill" style="width:${Math.min(pct,100)}%"></div>
    </div>
    <p class="lock-progress-text">${current} / ${target} hari tercatat</p>
  `;
}
function checkMilestoneUnlock(prevTotal, newTotal) {
  const milestones = [
    { day: 7,  emoji: '📆', title: 'Target Mingguan Terbuka!',
      desc: '7 hari data tercatat! Sekarang kamu bisa set target tabungan mingguan.' },
    { day: 14, emoji: '🗓', title: 'Target Bulanan & Insight Terbuka!',
      desc: '14 hari data! Target Bulanan dan Analisis AI sekarang aktif untukmu.' },
    { day: 21, emoji: '🏆', title: 'Driver Finansial Sejati!',
      desc: '21 hari data tercatat! Badge spesial menantimu di Pengaturan!' }
  ];
  for (const m of milestones) {
    if (prevTotal < m.day && newTotal >= m.day) {
      showCelebration(m.emoji, m.title, m.desc);
      break;
    }
  }
}

// ─── CELEBRATION ─────────────────────────────────────
function showCelebration(emoji, title, desc) {
  document.getElementById('celebration-emoji').textContent = emoji;
  document.getElementById('celebration-title').textContent = title;
  document.getElementById('celebration-desc').textContent  = desc;
  document.getElementById('celebration-modal').style.display = 'flex';
}
function closeCelebration() {
  document.getElementById('celebration-modal').style.display = 'none';
}

// ─── BADGE ───────────────────────────────────────────
function showBadgeModal() {
  const today = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('badge-date').textContent = today;
  document.getElementById('badge-modal').style.display = 'flex';
}
function closeBadgeModal(event) {
  if (!event || event.target.id === 'badge-modal') {
    document.getElementById('badge-modal').style.display = 'none';
  }
}
function downloadBadge() {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 800;
  const ctx  = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 800);
  grad.addColorStop(0, '#1a4a35'); grad.addColorStop(1, '#2d6a4f');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.roundRect(0, 0, 800, 800, 40); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(400, 260, 160, 0, Math.PI * 2); ctx.fill();
  ctx.font = '130px Arial'; ctx.textAlign = 'center'; ctx.fillText('🏆', 400, 310);
  ctx.fillStyle = '#FFD700'; ctx.font = 'bold 56px Arial';
  ctx.fillText('DRIVER FINANSIAL', 400, 420); ctx.fillText('SEJATI', 400, 485);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '30px Arial';
  ctx.fillText('21 Hari Konsisten', 400, 560);
  ctx.fillText('Catat Keuangan Harian', 400, 600);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(120, 640); ctx.lineTo(680, 640); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '26px Arial';
  ctx.fillText('Finansialku 💰', 400, 690);
  const today = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  ctx.font = '22px Arial'; ctx.fillText(today, 400, 730);
  const link = document.createElement('a');
  link.download = 'driver-finansial-sejati.png';
  link.href = canvas.toDataURL('image/png'); link.click();
}
function shareToWhatsApp() {
  const today = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  const text  = encodeURIComponent(
    `Alhamdulillah! Saya sudah *21 hari berturut-turut* konsisten catat keuangan harian! 💰🏆\n\n` +
    `Pakai aplikasi *Finansialku* — gratis, bisa dipakai offline, khusus buat kita para driver & pekerja gig.\n\n` +
    `📅 Dicapai: ${today}\n\n` +
    `#DriverFinansialSejati #Finansialku #KeuanganSehat`
  );
  window.open('https://wa.me/?text=' + text, '_blank');
}

// ─── GOALS ───────────────────────────────────────────
function saveGoal(period) {
  const name   = document.getElementById('input-goal-' + period + '-name').value;
  const amount = parseInt(document.getElementById('input-goal-' + period + '-amount').value);
  if (!name || !amount || amount <= 0) { alert('Mohon isi nama dan jumlah target!'); return; }
  goals[period] = { name, amount };
  localStorage.setItem('goals', JSON.stringify(goals));
  document.getElementById('input-goal-' + period + '-name').value   = '';
  document.getElementById('input-goal-' + period + '-amount').value = '';
  renderAllGoals();
  renderScorecard();
}
function getIncomeFor(filterFn) {
  let income = 0;
  transactions.forEach(t => {
    if (filterFn(t.date) && t.type === 'income') income += t.amount;
  });
  return income;
}
function getBalanceFor(filterFn) {
  let income = 0, expense = 0;
  transactions.forEach(t => {
    if (filterFn(t.date)) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
  });
  return income - expense;
}
function renderGoalCard(period, containerId) {
  const goal = goals[period];
  if (!goal || goal.amount === 0) {
    document.getElementById(containerId).innerHTML = '';
    return;
  }
  const filters    = { harian: isToday, mingguan: isThisWeek, bulanan: isThisMonth };
  // Harian uses income only (earning target), others use balance
  const balance    = period === 'harian'
    ? getIncomeFor(filters[period])
    : getBalanceFor(filters[period]);
  const percent    = Math.min(Math.max((balance / goal.amount) * 100, 0), 100);
  const isComplete = percent >= 100;

  document.getElementById(containerId).innerHTML = `
    <div class="goal-card">
      <div class="goal-card-header">
        <p class="goal-card-title">${isComplete ? '🏆' : '🎯'} ${goal.name}</p>
        <button class="goal-delete-btn" onclick="deleteGoal('${period}')">✕ Hapus</button>
      </div>
      <p class="goal-card-amounts">
        Terkumpul: ${formatRupiah(Math.max(balance, 0))} / ${formatRupiah(goal.amount)}
      </p>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill ${isComplete ? 'complete' : ''}"
             style="width:${percent}%"></div>
      </div>
      <p class="goal-percent">
        ${Math.round(percent)}% ${isComplete ? '— Tercapai! 🎉' : 'tercapai'}
      </p>
    </div>
  `;
}
function deleteGoal(period) {
  if (!window.confirm('Hapus target ini?')) return;
  goals[period] = { name: '', amount: 0 };
  localStorage.setItem('goals', JSON.stringify(goals));

  // Also clear calculator target if deleting harian
  if (period === 'harian') {
    localStorage.removeItem('calculatedDailyTarget');
  }

  renderAllGoals();
  renderScorecard();
}
function renderAllGoals() {
  renderGoalCard('harian', 'goal-harian-display');
  if (isUnlocked('mingguan')) renderGoalCard('mingguan', 'goal-mingguan-display');
  if (isUnlocked('bulanan'))  renderGoalCard('bulanan',  'goal-bulanan-display');
  const preview = document.getElementById('goal-preview');
  if (goals.bulanan && goals.bulanan.amount > 0 && isUnlocked('bulanan')) {
    const balance    = getBalanceFor(isThisMonth);
    const percent    = Math.min((balance / goals.bulanan.amount) * 100, 100);
    const isComplete = percent >= 100;
    preview.innerHTML = `
      <div class="goal-card" style="background:white;box-shadow:0 2px 8px rgba(0,0,0,0.07)">
        <p class="goal-card-title">${isComplete ? '🏆' : '🎯'} ${goals.bulanan.name} (Bulan ini)</p>
        <p class="goal-card-amounts">Terkumpul: ${formatRupiah(Math.max(balance,0))} / ${formatRupiah(goals.bulanan.amount)}</p>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${isComplete ? 'complete' : ''}" style="width:${percent}%"></div>
        </div>
        <p class="goal-percent">${Math.round(percent)}% ${isComplete ? '— Tercapai! 🎉' : 'tercapai'}</p>
      </div>
    `;
  } else { preview.innerHTML = ''; }
}

// ─── SETTINGS ────────────────────────────────────────
function updateSettings() {
  const streak = getCurrentStreak();
  document.getElementById('total-transactions').textContent = transactions.length + ' transaksi';
  document.getElementById('settings-streak').textContent    = streak + ' hari 🔥';
}
// ─── RIWAYAT SUB-TABS ────────────────────────────────

function initRiwayat() {
  // Set default values for all pickers
  document.getElementById('picker-harian').value   = getToday();
  document.getElementById('picker-mingguan').value = getTodayWeek();
  document.getElementById('picker-bulanan').value  = getTodayMonth();
  renderHarian();
  renderMingguan();
  renderBulanan();
}

function switchSubTab(name) {
  document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));
  document.getElementById('subtab-' + name).classList.add('active');
  document.getElementById('sub-' + name).classList.add('active');
}

function refreshActiveSubTab() {
  const active = document.querySelector('.sub-tab.active');
  if (!active) return;
  const name = active.id.replace('subtab-', '');
  if (name === 'harian')   renderHarian();
  if (name === 'mingguan') renderMingguan();
  if (name === 'bulanan')  renderBulanan();
}

// ── Date/Week/Month helpers ──────────────────────────
function getTodayWeek() {
  const now  = new Date();
  const year = now.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const startW1 = new Date(jan4);
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = Math.floor((now - startW1) / (7 * 24 * 60 * 60 * 1000));
  const week = diff + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getTodayMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekRange(weekStr) {
  const [yearStr, wStr] = weekStr.split('-W');
  const year  = parseInt(yearStr);
  const week  = parseInt(wStr);
  const jan4  = new Date(year, 0, 4);
  const startW1 = new Date(jan4);
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(startW1);
  monday.setDate(startW1.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function dateInRange(dateStr, from, to) {
  const d = new Date(dateStr + 'T00:00:00');
  return d >= from && d <= to;
}

// ── Navigation arrows ────────────────────────────────
function shiftDate(dir) {
  const input = document.getElementById('picker-harian');
  const d = new Date(input.value + 'T00:00:00');
  d.setDate(d.getDate() + dir);
  input.value = d.toISOString().split('T')[0];
  renderHarian();
}

function shiftWeek(dir) {
  const input = document.getElementById('picker-mingguan');
  const [yearStr, wStr] = input.value.split('-W');
  let year = parseInt(yearStr);
  let week = parseInt(wStr) + dir;
  if (week < 1)  { year--; week = 52; }
  if (week > 52) { year++; week = 1;  }
  input.value = `${year}-W${String(week).padStart(2, '0')}`;
  renderMingguan();
}

function shiftMonth(dir) {
  const input = document.getElementById('picker-bulanan');
  const [yearStr, monStr] = input.value.split('-');
  const d = new Date(parseInt(yearStr), parseInt(monStr) - 1 + dir, 1);
  input.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderBulanan();
}

// ── Render helpers ───────────────────────────────────
function buildPeriodSummary(filtered) {
  let income = 0, expense = 0;
  filtered.forEach(t => {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  });
  const balance = income - expense;
  return `
    <div class="period-summary">
      <div class="period-card period-card-income">
        <p class="period-card-label">Pemasukan</p>
        <p class="period-card-amount">${formatRupiah(income)}</p>
      </div>
      <div class="period-card period-card-expense">
        <p class="period-card-label">Pengeluaran</p>
        <p class="period-card-amount">${formatRupiah(expense)}</p>
      </div>
      <div class="period-card period-card-balance">
        <p class="period-card-label">Saldo</p>
        <p class="period-card-amount">${formatRupiah(balance)}</p>
      </div>
    </div>
  `;
}

function buildPeriodBreakdown(filtered) {
  const harianTotals = {}, bulananTotals = {};
  filtered.forEach(t => {
    if (t.type === 'expense' && t.category) {
      if (t.expenseType === 'bulanan') bulananTotals[t.category] = (bulananTotals[t.category] || 0) + t.amount;
      else harianTotals[t.category] = (harianTotals[t.category] || 0) + t.amount;
    }
  });

  let html = '';

  if (Object.keys(harianTotals).length > 0) {
    const total = Object.values(harianTotals).reduce((a,b) => a+b, 0);
    html += `<p class="breakdown-title" style="color:#e65100">⚡ Pengeluaran Harian</p>
             <div class="breakdown-scroll">`;
    Object.entries(harianTotals).sort((a,b) => b[1]-a[1]).forEach(([cat, amount]) => {
      const info = CATEGORIES[cat] || CATEGORIES.lainnya;
      const pct  = Math.round((amount / total) * 100);
      html += `<div class="breakdown-card breakdown-card-harian">
        <p class="breakdown-cat-label">${info.label}</p>
        <p class="breakdown-cat-amount">${formatRupiah(amount)}</p>
      </div>`;
    });
    html += '</div>';
  }

  if (Object.keys(bulananTotals).length > 0) {
    const total = Object.values(bulananTotals).reduce((a,b) => a+b, 0);
    html += `<p class="breakdown-title" style="color:#1565c0;margin-top:12px">📅 Pengeluaran Bulanan</p>
             <div class="breakdown-scroll">`;
    Object.entries(bulananTotals).sort((a,b) => b[1]-a[1]).forEach(([cat, amount]) => {
      const info = CATEGORIES[cat] || CATEGORIES.lainnya;
      const pct  = Math.round((amount / total) * 100);
      html += `<div class="breakdown-card breakdown-card-bulanan">
        <p class="breakdown-cat-label">${info.label}</p>
        <p class="breakdown-cat-amount">${formatRupiah(amount)}</p>
      </div>`;
    });
    html += '</div>';
  }
  return html;
}

function buildPeriodList(filtered) {
  if (filtered.length === 0) return '';
  const incomes  = filtered.filter(t => t.type === 'income');
  const harians  = filtered.filter(t => t.type === 'expense' && t.expenseType !== 'bulanan');
  const bulanans = filtered.filter(t => t.type === 'expense' && t.expenseType === 'bulanan');

  const container = document.createElement('div');

  if (incomes.length > 0) {
    const total = incomes.reduce((s,t) => s + t.amount, 0);
    container.innerHTML += `<div class="riwayat-section-title" style="color:#2d6a4f">
      ⬆ Pemasukan <span class="riwayat-section-total">${formatRupiah(total)}</span></div>`;
    incomes.forEach(t => container.appendChild(buildHistoryItem(t)));
  }
  if (harians.length > 0) {
    const total = harians.reduce((s,t) => s + t.amount, 0);
    if (incomes.length > 0) container.innerHTML += '<div class="section-divider"></div>';
    container.innerHTML += `<div class="riwayat-section-title riwayat-section-harian">
      ⚡ Pengeluaran Harian <span class="riwayat-section-total">${formatRupiah(total)}</span></div>`;
    harians.forEach(t => container.appendChild(buildHistoryItem(t)));
  }
  if (bulanans.length > 0) {
    const total = bulanans.reduce((s,t) => s + t.amount, 0);
    if (incomes.length > 0 || harians.length > 0) container.innerHTML += '<div class="section-divider"></div>';
    container.innerHTML += `<div class="riwayat-section-title riwayat-section-bulanan">
      📅 Pengeluaran Bulanan <span class="riwayat-section-total">${formatRupiah(total)}</span></div>`;
    bulanans.forEach(t => container.appendChild(buildHistoryItem(t)));
  }
  return container;
}

function renderEmptyPeriod(message) {
  return `<div class="empty-period">📭<br>${message}</div>`;
}

// ── Harian ───────────────────────────────────────────
function renderHarian() {
  const dateStr  = document.getElementById('picker-harian').value;
  if (!dateStr) return;
  const filtered = transactions.filter(t => t.date === dateStr);

  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  document.getElementById('summary-harian').innerHTML =
    filtered.length > 0 ? buildPeriodSummary(filtered) : '';
  renderDailyBudget(dateStr);
  document.getElementById('breakdown-harian').innerHTML =
    buildPeriodBreakdown(filtered);

  const listEl = document.getElementById('list-harian');
  if (filtered.length === 0) {
    listEl.innerHTML = renderEmptyPeriod(`Tidak ada transaksi\npada ${label}`);
  } else {
    listEl.innerHTML = '';
    listEl.appendChild(buildPeriodList(filtered));
  }
}

// ── Mingguan ─────────────────────────────────────────
function renderMingguan() {
  const weekStr = document.getElementById('picker-mingguan').value;
  if (!weekStr) return;

  const { monday, sunday } = getWeekRange(weekStr);
  const filtered = transactions.filter(t => dateInRange(t.date, monday, sunday));

  const fmt = { day: 'numeric', month: 'short' };
  const rangeLabel = `${monday.toLocaleDateString('id-ID', fmt)} – ${sunday.toLocaleDateString('id-ID', fmt)}`;
  document.getElementById('week-label').textContent = rangeLabel;

  document.getElementById('summary-mingguan').innerHTML =
    filtered.length > 0 ? buildPeriodSummary(filtered) : '';
  document.getElementById('breakdown-mingguan').innerHTML =
    buildPeriodBreakdown(filtered);

  const listEl = document.getElementById('list-mingguan');
  if (filtered.length === 0) {
    listEl.innerHTML = renderEmptyPeriod(`Tidak ada transaksi\npada minggu ini`);
  } else {
    listEl.innerHTML = '';
    listEl.appendChild(buildPeriodList(filtered));
  }
}

// ── Bulanan ──────────────────────────────────────────
function renderBulanan() {
  const monthStr = document.getElementById('picker-bulanan').value;
  if (!monthStr) return;

  const [year, month] = monthStr.split('-').map(Number);
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0); // last day of month
  const filtered = transactions.filter(t => dateInRange(t.date, from, to));

  document.getElementById('summary-bulanan').innerHTML =
    filtered.length > 0 ? buildPeriodSummary(filtered) : '';
  document.getElementById('breakdown-bulanan').innerHTML =
    buildPeriodBreakdown(filtered);

  const listEl = document.getElementById('list-bulanan');
  if (filtered.length === 0) {
    listEl.innerHTML = renderEmptyPeriod(`Tidak ada transaksi\npada bulan ini`);
  } else {
    listEl.innerHTML = '';
    listEl.appendChild(buildPeriodList(filtered));
  }
}
// ─── INSIGHT ─────────────────────────────────────────

function renderInsightLock() {
  const totalDays = getTotalUniqueDays();
  const unlocked  = totalDays >= 14;
  const lockEl    = document.getElementById('insight-lock');
  const mainEl    = document.getElementById('insight-main');
  if (!lockEl || !mainEl) return;

  lockEl.style.display = unlocked ? 'none'  : 'block';
  mainEl.style.display = unlocked ? 'block' : 'none';

  if (!unlocked) {
    document.getElementById('insight-lock-bar').innerHTML =
      buildTotalDaysBar(totalDays, 14);
  }
}

function buildInsightData() {
  // Collect last 14 days of data
  const today  = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - 14);

  const recent = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d >= cutoff;
  });

  // Daily income summary
  const dailyIncome = {};
  recent.forEach(t => {
    if (t.type === 'income') {
      dailyIncome[t.date] = (dailyIncome[t.date] || 0) + t.amount;
    }
  });

  // Category totals
  const catTotals = {};
  recent.forEach(t => {
    if (t.type === 'expense' && t.category) {
      const label = CATEGORIES[t.category]?.label || t.category;
      catTotals[label] = (catTotals[label] || 0) + t.amount;
    }
  });

  // Totals
  let totalIncome = 0, totalExpense = 0;
  recent.forEach(t => {
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpense += t.amount;
  });

  // Target comparison
  const dailyTarget = goals.harian?.amount || 0;
  const daysHitTarget = dailyTarget > 0
    ? Object.values(dailyIncome).filter(v => v >= dailyTarget).length
    : 'belum diset';

  // Best and worst day
  const sortedDays = Object.entries(dailyIncome).sort((a,b) => b[1]-a[1]);
  const bestDay    = sortedDays[0] || null;
  const worstDay   = sortedDays[sortedDays.length - 1] || null;

  return {
    periode:       '14 hari terakhir',
    streak:        getCurrentStreak(),
    totalDays:     Object.keys(dailyIncome).length,
    totalIncome,
    totalExpense,
    saldo:         totalIncome - totalExpense,
    rataHarian:    Math.round(totalIncome / 14),
    targetHarian:  dailyTarget,
    hariHitTarget: daysHitTarget,
    bestDay:       bestDay ? { tanggal: bestDay[0], jumlah: bestDay[1] } : null,
    worstDay:      worstDay ? { tanggal: worstDay[0], jumlah: worstDay[1] } : null,
    kategoriTertinggi: Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0,3),
    totalTransaksi: recent.length
  };
}

async function generateInsight() {
  const btn        = document.getElementById('insight-btn');
  const resultEl   = document.getElementById('insight-result');
  const data       = buildInsightData();

  // Loading state
  btn.disabled     = true;
  btn.textContent  = '⏳ Sedang menganalisis...';
  resultEl.innerHTML = `
    <div class="insight-loading">
      <span class="insight-loading-emoji">🤖</span>
      <p class="insight-loading-text">AI sedang membaca data keuanganmu...<br>Ini mungkin membutuhkan beberapa detik.</p>
    </div>
  `;

  const prompt = `Kamu adalah konsultan keuangan yang ramah dan berpengalaman membantu pekerja gig (ojol, freelancer) di Indonesia mengelola keuangan mereka dengan lebih baik.

Berikut data keuangan pengguna selama ${data.periode}:

📊 RINGKASAN:
- Total hari ada transaksi: ${data.totalDays} dari 14 hari
- Total Pemasukan: Rp ${data.totalIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${data.totalExpense.toLocaleString('id-ID')}
- Saldo Bersih: Rp ${data.saldo.toLocaleString('id-ID')}
- Rata-rata pemasukan harian: Rp ${data.rataHarian.toLocaleString('id-ID')}
- Target harian: ${data.targetHarian > 0 ? 'Rp ' + data.targetHarian.toLocaleString('id-ID') : 'Belum diset'}
- Hari berhasil mencapai target: ${data.hariHitTarget} dari 14 hari
- Streak saat ini: ${data.streak} hari

📈 HARI TERBAIK & TERBURUK:
- Pendapatan tertinggi: ${data.bestDay ? formatDate(data.bestDay.tanggal) + ' (Rp ' + data.bestDay.jumlah.toLocaleString('id-ID') + ')' : 'Tidak ada data'}
- Pendapatan terendah: ${data.worstDay ? formatDate(data.worstDay.tanggal) + ' (Rp ' + data.worstDay.jumlah.toLocaleString('id-ID') + ')' : 'Tidak ada data'}

💸 PENGELUARAN TERBESAR:
${data.kategoriTertiggi ? data.kategoriTertiggi.map(([k,v]) => `- ${k}: Rp ${v.toLocaleString('id-ID')}`).join('\n') : '- Belum ada data kategori'}

Berikan analisis keuangan personal yang:
1. Hangat, supportif, dan tidak menghakimi — ingat ini pekerja gig yang sudah berusaha keras
2. Spesifik berdasarkan angka di atas — bukan saran generik
3. Mencakup: ✅ yang sudah bagus, ⚠️ yang perlu diperhatikan, 💡 saran konkret minggu depan, 📚 satu tips literasi keuangan yang relevan
4. Dalam Bahasa Indonesia yang santai dan mudah dipahami
5. Maksimal 300 kata — ringkas tapi berisi
6. Gunakan emoji secukupnya agar mudah dibaca

Jangan gunakan format markdown seperti **bold** atau *italic*. Gunakan emoji sebagai pengganti bullet points.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages:   [{ role: 'user', content: prompt }]
      })
    });

    const json   = await response.json();
    const text   = json.content?.[0]?.text || '';

    if (!text) throw new Error('Empty response');

    const now = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    resultEl.innerHTML = `
      <div class="insight-result-card">
        <div class="insight-result-header">
          <p class="insight-result-title">💡 Analisis Keuanganmu</p>
          <p class="insight-result-date">${now}</p>
        </div>
        <p class="insight-result-body">${text}</p>
      </div>
      <button class="insight-refresh-btn" onclick="generateInsight()">
        🔄 Analisis Ulang
      </button>
    `;

  } catch (err) {
    resultEl.innerHTML = `
      <div class="insight-error">
        😕 Gagal terhubung ke AI.<br><br>
        Pastikan kamu terhubung ke internet, lalu coba lagi.
        <br><br>
        <button class="insight-refresh-btn" onclick="generateInsight()" style="background:#fdecea;border-color:#c0392b;color:#c0392b">
          🔄 Coba Lagi
        </button>
      </div>
    `;
  } finally {
    btn.disabled    = false;
    btn.textContent = '✨ Analisis Ulang';
  }
}
function confirmReset() {
  if (window.confirm('Yakin ingin menghapus semua data? Tindakan ini tidak bisa dibatalkan.')) {
    localStorage.clear();
    transactions = []; budgetLimit = 0;
    goals = { harian:{name:'',amount:0}, mingguan:{name:'',amount:0}, bulanan:{name:'',amount:0} };
    updateSummary(); renderHistory(); updateSettings();
    updateBudgetDisplay(); renderAllGoals();
    renderStreak(); renderLocks(); renderScorecard(); renderCategoryBreakdown();
    document.getElementById('budget-status').className   = 'budget-status';
    document.getElementById('budget-status').textContent = '';
    document.getElementById('budget-alert').innerHTML    = '';
    alert('Semua data telah dihapus.');
    switchTab('beranda');
  }
}