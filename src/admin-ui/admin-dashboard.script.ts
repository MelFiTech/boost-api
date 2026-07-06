export function getAdminDashboardScript(apiBase: string): string {
  const api = `${apiBase.replace(/\/$/, '')}/api/v1`;
  return `
(function(){
  const API = ${JSON.stringify(api)};
  let token = localStorage.getItem('boost_admin_token') || '';
  let page = 'dashboard';
  let kycStatus = 'PENDING';
  let orderTab = 'all';
  let usersPage = 1;
  let servicesPage = 1;
  let webhooksPage = 1;
  let pushSelectedUsers = [];
  let pushTemplates = [];
  let activeUserId = '';
  let sidebarCollapsed = localStorage.getItem('boost_admin_sidebar') === 'collapsed';
  let dashboardPeriod = localStorage.getItem('boost_admin_period') || 'week';
  let dashboardStart = localStorage.getItem('boost_admin_range_start') || '';
  let dashboardEnd = localStorage.getItem('boost_admin_range_end') || '';

  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    services: 'Services',
    integrations: 'Integrations',
    users: 'Users',
    kyc: 'KYC Review',
    providers: 'Providers',
    features: 'Feature Flags',
    pricing: 'Pricing & Rates',
    settings: 'App Settings',
    push: 'Push Notifications',
    emails: 'Email Templates',
    webhooks: 'Webhooks',
  };

  const LOADERS = {
    dashboard: loadDashboard,
    orders: loadOrders,
    services: loadServices,
    integrations: loadIntegrations,
    users: loadUsers,
    kyc: loadKyc,
    providers: loadProviders,
    features: loadFeatures,
    pricing: loadPricing,
    settings: loadSettings,
    push: loadPushNotifications,
    emails: loadEmailTemplates,
    webhooks: loadWebhooks,
  };

  const $ = (id) => document.getElementById(id);
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  function toast(msg, err) {
    const el = $('toast');
    el.textContent = msg;
    el.style.borderColor = err ? 'var(--danger)' : 'var(--lime)';
    show(el);
    setTimeout(() => hide(el), 3500);
  }

  function parseApiError(data, fallback) {
    if (!data) return fallback;
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) return data.message[0] || fallback;
    if (typeof data.error === 'string') return data.error;
    return fallback;
  }

  function errorMessage(err, fallback) {
    if (err instanceof Error) return err.message;
    return parseApiError(err, fallback);
  }

  async function apiFetch(path, options) {
    const headers = { 'Content-Type': 'application/json', ...(options && options.headers || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(API + path, { ...(options || {}), headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      token = '';
      localStorage.removeItem('boost_admin_token');
      hide($('appView'));
      show($('loginView'));
      throw new Error('Session expired — sign in again');
    }
    if (!res.ok) throw new Error(parseApiError(data, res.statusText || 'Request failed'));
    return data;
  }

  function money(n) {
    return '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
  }

  function badge(status) {
    const s = String(status || '').toLowerCase().replace(/\\s+/g, '_');
    const cls = ['verified','completed','approved','processing'].includes(s) ? 'badge-verified'
      : ['rejected','failed','cancelled'].includes(s) ? 'badge-rejected' : 'badge-pending';
    return '<span class="badge ' + cls + '">' + String(status || '—') + '</span>';
  }

  function issueBadge(issue) {
    const label = String(issue || 'UNKNOWN').replace(/_/g, ' ');
    const cls = issue === 'LOW_PROVIDER_BALANCE'
      ? 'badge-rejected'
      : issue === 'NOT_SUBMITTED'
        ? 'badge-issue'
        : 'badge-rejected';
    return '<span class="badge ' + cls + '">' + label + '</span>';
  }

  function smmstoneMetricCard(smm) {
    const low = !!smm.lowBalance;
    const bal = smm.error ? '—' : usd(smm.balance);
    const hint = smm.error
      ? 'Balance unavailable'
      : low
        ? (smm.pendingDueToLowBalance || 0) + ' order' + ((smm.pendingDueToLowBalance || 0) === 1 ? '' : 's') + ' queued · top up SMMStone'
        : 'Provider balance healthy';
    return metricCard('SMMStone', bal, low ? 'provider danger' : 'provider', hint);
  }

  function updateAttentionBadge(count) {
    const badge = $('attentionTabBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function renderAttentionBanner(count) {
    const banner = $('attentionBanner');
    if (!banner) return;
    if (count > 0) {
      const lowBalanceCount = window.__attentionLowBalanceCount || 0;
      const lowBalanceNote = lowBalanceCount > 0
        ? ' · ' + lowBalanceCount + ' queued because SMMStone balance is low'
        : '';
      banner.innerHTML = '<div class="attention-banner-inner"><div><strong>' + count + ' order' + (count === 1 ? '' : 's') + ' need attention</strong><div class="muted" style="margin-top:4px;font-size:.82rem">Paid-but-not-submitted, failed, or cancelled — refire, refund, or notify customers.' + lowBalanceNote + '</div></div><button class="btn btn-primary btn-sm" onclick="setOrdersTab(\\'attention\\')">Review now</button></div>';
      show(banner);
    } else {
      banner.innerHTML = '';
      hide(banner);
    }
  }

  window.setOrdersTab = function(tab) {
    orderTab = tab;
    document.querySelectorAll('#orderTabs .tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.orderTab === tab);
    });
    setPage('orders');
  };

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function shortId(id) {
    return id ? '#' + String(id).slice(-8) : '—';
  }

  function errHtml(el, msg) {
    return '<div class="empty" style="color:var(--danger)">' + msg + '</div>';
  }

  function metricCard(label, value, extraClass, hint) {
    return '<div class="metric-card' + (extraClass ? ' ' + extraClass : '') + '">' +
      '<div class="label">' + label + '</div>' +
      '<div class="value">' + value + '</div>' +
      (hint ? '<div class="hint">' + hint + '</div>' : '') +
      '</div>';
  }

  function setPage(next) {
    page = next;
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.page === next);
    });
    $('pageTitle').textContent = PAGE_TITLES[next] || 'Admin';
    document.querySelectorAll('[data-page-panel]').forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.pagePanel !== next);
    });
    const loader = LOADERS[next];
    if (loader) loader();
  }

  function applySidebar() {
    const sb = $('sidebar');
    const toggleBtn = $('sidebarToggle');
    const toggleIcon = $('sidebarToggleIcon');
    sb.classList.toggle('collapsed', sidebarCollapsed);
    if (toggleIcon) {
      toggleIcon.className = sidebarCollapsed ? 'ph ph-caret-double-right' : 'ph ph-sidebar-simple';
    }
    if (toggleBtn) {
      toggleBtn.title = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }
    localStorage.setItem('boost_admin_sidebar', sidebarCollapsed ? 'collapsed' : 'expanded');
  }

  function refreshPage() {
    const loader = LOADERS[page];
    if (loader) loader();
    toast('Refreshed');
  }

  function usd(n) {
    if (n == null || n === '') return '—';
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function analyticsQuery() {
    let qs = '?period=' + encodeURIComponent(dashboardPeriod);
    if (dashboardPeriod === 'custom') {
      if (dashboardStart) qs += '&startDate=' + encodeURIComponent(dashboardStart);
      if (dashboardEnd) qs += '&endDate=' + encodeURIComponent(dashboardEnd);
    }
    return qs;
  }

  function syncPeriodUi() {
    document.querySelectorAll('#periodTabs .tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.period === dashboardPeriod);
    });
    const customBar = $('customRangeBar');
    if (dashboardPeriod === 'custom') {
      show(customBar);
      if (dashboardStart) $('rangeStart').value = dashboardStart;
      if (dashboardEnd) $('rangeEnd').value = dashboardEnd;
    } else {
      hide(customBar);
    }
  }

  // ─── Dashboard ───────────────────────────────────────────────
  async function loadDashboard() {
    syncPeriodUi();
    const loading = '<div class="loading">Loading…</div>';
    $('dashboardMetrics').innerHTML = loading;
    $('volumeBreakdownBody').innerHTML = loading;
    $('feesBreakdownBody').innerHTML = loading;
    $('recentOrdersBody').innerHTML = loading;
    $('platformHealthBody').innerHTML = loading;
    $('orderStatusBars').innerHTML = loading;

    const [analyticsRes, statsRes, metricsRes, providersRes, attentionRes] = await Promise.allSettled([
      apiFetch('/admin/dashboard/analytics' + analyticsQuery()),
      apiFetch('/admin/dashboard/stats'),
      apiFetch('/admin/dashboard/metrics'),
      apiFetch('/admin/providers'),
      apiFetch('/admin/orders/attention'),
    ]);

    const analytics = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null;
    const stats = statsRes.status === 'fulfilled' ? statsRes.value : {};
    const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value : {};
    const providers = providersRes.status === 'fulfilled' ? providersRes.value : { data: {} };
    const attentionResVal = attentionRes.status === 'fulfilled' ? attentionRes.value : { data: [] };

    if (!analytics) {
      $('dashboardMetrics').innerHTML = errHtml(null, errorMessage(analyticsRes.reason, 'Failed to load analytics'));
      $('volumeBreakdownBody').innerHTML = errHtml(null, 'Analytics unavailable');
      $('feesBreakdownBody').innerHTML = errHtml(null, 'Analytics unavailable');
      $('platformHealthBody').innerHTML = errHtml(null, 'Analytics unavailable');
    }

    const attentionList = attentionResVal.data || [];
    const attentionCount = attentionList.length;
    window.__attentionLowBalanceCount = attentionList.filter((o) => o.issue === 'LOW_PROVIDER_BALANCE').length;
    updateAttentionBadge(attentionCount);
    renderAttentionBanner(attentionCount);

    if (analytics) {
      const a = analytics;
      const range = a.range || {};
      const prov = a.providers || {};
      const smm = prov.smmstone || {};
      const nyraMaster = prov.nyraMaster || {};
      const nyraFloat = prov.nyraFloat || {};
      const wallets = a.wallets || {};
      const users = a.users || {};
      const txns = a.transactions || {};
      const fees = a.fees || {};
      const volume = a.volume || {};
      const orders = a.orders || {};
      const periodSuffix = range.label ? ' · ' + range.label : '';

      if ($('periodLabel')) {
        $('periodLabel').textContent = 'Showing: ' + (range.label || dashboardPeriod);
      }

      const nyraSettled = nyraMaster.error ? '—' : money(nyraMaster.availableBalance);
      const nyraUnsettled = nyraMaster.error ? '—' : money(nyraMaster.unsettledBalance ?? 0);

      $('dashboardMetrics').innerHTML =
        metricCard('Nyra settled', nyraSettled, 'provider accent', 'Live provider balance') +
        metricCard('Nyra unsettled', nyraUnsettled, 'provider', 'Pending T+1 settlement') +
        smmstoneMetricCard(smm) +
        metricCard('User wallets', money(wallets.totalBalance), 'wallet', wallets.activeWithBalance + ' wallets with balance') +
        metricCard('Users', String(users.total || 0), '', (users.newInPeriod || 0) + ' new' + periodSuffix) +
        metricCard('Wallet txns', String(txns.walletTxCount || 0), '', periodSuffix.replace(' · ', '') || 'In period') +
        metricCard('Fees', money(fees.total), 'fees accent', periodSuffix.replace(' · ', '') || 'In period') +
        metricCard('Order revenue', money(volume.orderRevenue), 'accent', periodSuffix.replace(' · ', '') || 'In period') +
        metricCard('Funding', money(volume.walletFunding), '', periodSuffix.replace(' · ', '') || 'In period') +
        metricCard('Bills', money(volume.billPayments), '', periodSuffix.replace(' · ', '') || 'In period') +
        metricCard('Withdrawals', money(volume.withdrawals), '', periodSuffix.replace(' · ', '') || 'In period') +
        metricCard('Gross volume', money(volume.grossVolume), '', periodSuffix.replace(' · ', '') || 'In period') +
        metricCard('Open orders', String((orders.pending || 0) + (orders.processing || 0)), '', 'Pending + processing now') +
        metricCard('Needs attention', String(attentionCount), attentionCount > 0 ? 'accent' : '', 'Paid but stuck') +
        metricCard('Services', String(stats.services || 0), '', 'Active catalog size');

      $('volumeBreakdownBody').innerHTML = '<div class="health-grid">' +
        '<div class="health-item"><span>Order revenue</span><strong>' + money(volume.orderRevenue) + '</strong></div>' +
        '<div class="health-item"><span>Wallet SMM debits</span><strong>' + money(volume.walletSmmOrders) + '</strong></div>' +
        '<div class="health-item"><span>Wallet funding</span><strong>' + money(volume.walletFunding) + '</strong></div>' +
        '<div class="health-item"><span>Bill payments</span><strong>' + money(volume.billPayments) + '</strong></div>' +
        '<div class="health-item"><span>Withdrawals</span><strong>' + money(volume.withdrawals) + '</strong></div>' +
        '<div class="health-item"><span>Gross volume</span><strong>' + money(volume.grossVolume) + '</strong></div>' +
        '<div class="health-item"><span>Orders created</span><strong>' + (orders.createdInPeriod || 0) + '</strong></div>' +
        '<div class="health-item"><span>Completed in period</span><strong>' + (orders.completedInPeriod || 0) + '</strong></div>' +
        '<div class="health-item"><span>Legacy payment txns</span><strong>' + (txns.legacyPaymentTxCount || 0) + '</strong></div>' +
        '</div>';

      $('feesBreakdownBody').innerHTML = '<div class="health-grid">' +
        '<div class="health-item"><span>Total fees</span><strong style="color:var(--lime)">' + money(fees.total) + '</strong></div>' +
        '<div class="health-item"><span>Platform markup (SMM)</span><strong>' + money(fees.platformMarkup) + '</strong></div>' +
        '<div class="health-item"><span>Funding fees</span><strong>' + money(fees.fundingFees) + '</strong></div>' +
        '<div class="health-item"><span>Withdrawal fees</span><strong>' + money(fees.withdrawalFees) + '</strong></div>' +
        '<div class="health-item"><span>Verified users</span><strong>' + (users.verified || 0) + '</strong></div>' +
        '<div class="health-item"><span>Pending KYC</span><strong>' + (users.pendingKyc || 0) + '</strong></div>' +
        '<div class="health-item"><span>Exchange rate</span><strong>₦' + (a.exchangeRate || stats.exchangeRate || 1500) + '/USDT</strong></div>' +
        '</div>';

      const pData = providers.data || {};
      const activeFunding = (pData.configs || []).find((c) => c.kind === 'FUNDING' && c.active);
      const activeBills = (pData.configs || []).find((c) => c.kind === 'BILLS' && c.active);
      $('platformHealthBody').innerHTML = '<div class="health-grid">' +
        '<div class="health-item"><span>Nyra settled</span><strong>' + (nyraMaster.error ? '—' : money(nyraMaster.availableBalance)) + '</strong></div>' +
        '<div class="health-item"><span>Nyra unsettled</span><strong>' + (nyraMaster.error ? '—' : money(nyraMaster.unsettledBalance)) + '</strong></div>' +
        '<div class="health-item"><span>Nyra total</span><strong>' + (nyraMaster.error ? '—' : money(nyraMaster.balance)) + '</strong></div>' +
        '<div class="health-item"><span>Settlement T+1</span><strong>' + (nyraMaster.settlementEnabled ? 'On' : 'Off') + '</strong></div>' +
        '<div class="health-item"><span>Funding provider</span><strong>' + (activeFunding?.provider || '—') + '</strong></div>' +
        '<div class="health-item"><span>Bills provider</span><strong>' + (activeBills?.provider || '—') + '</strong></div>' +
        '<div class="health-item"><span>Nyra VA rail</span><strong>' + (pData.nyraFundingRail || '—') + '</strong></div>' +
        '<div class="health-item"><span>Float accounts</span><strong>' + (nyraFloat.walletCount || 0) + '</strong></div>' +
        '<div class="health-item"><span>All-time order revenue</span><strong>' + money(stats.totalRevenue) + '</strong></div>' +
        '</div>';
    } else if (providersRes.status === 'rejected') {
      $('platformHealthBody').innerHTML = errHtml(null, errorMessage(providersRes.reason, 'Providers unavailable'));
    }

    const byStatus = metrics.ordersByStatus || {};
    const statusTotal = Math.max(1, (byStatus.pending || 0) + (byStatus.processing || 0) + (byStatus.completed || 0) + (byStatus.cancelled || 0));
    $('orderStatusBars').innerHTML = ['pending','processing','completed','cancelled'].map((key) => {
      const val = byStatus[key] || 0;
      const pct = Math.round((val / statusTotal) * 100);
      return '<div class="status-row"><span>' + key + '</span><div class="status-track"><div class="status-fill" style="width:' + pct + '%"></div></div><span>' + val + '</span></div>';
    }).join('');

    const recent = metrics.recentOrders || [];
    $('recentOrdersBody').innerHTML = recent.length ? (
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Service</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
      recent.map((o) => '<tr><td class="cell-title">' + shortId(o.id) + '</td><td><div class="cell-title">' + (o.service || '—') + '</div><div class="cell-sub">' + (o.platform || '') + '</div></td><td>' + money(o.amount) + '</td><td>' + badge(o.status) + '</td><td class="muted">' + fmtDate(o.createdAt) + '</td></tr>').join('') +
      '</tbody></table></div>'
    ) : '<div class="empty">No recent orders</div>';
  }

  // ─── Orders ──────────────────────────────────────────────────
  function renderAttentionRow(o) {
    const customer = o.isGuest
      ? '<div class="cell-title">Guest</div><div class="cell-sub">' + (o.userEmail || 'No email on file') + '</div>'
      : '<div class="cell-title">' + (o.userEmail || 'Registered user') + '</div><div class="cell-sub">Account holder</div>';
    const refundBtn = o.isGuest
      ? ''
      : '<button class="btn btn-danger btn-sm" onclick="refundAttentionOrder(\\'' + o.id + '\\')">Refund</button>';
    const actions = '<div class="action-group">' +
      '<button class="btn btn-success btn-sm" onclick="refireAttentionOrder(\\'' + o.id + '\\')">Refire</button>' +
      refundBtn +
      '<button class="btn btn-ghost btn-sm" onclick="openNotifyOrder(\\'' + o.id + '\\', \\'' + String(o.userEmail || '').replace(/'/g, '') + '\\')">Notify</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="openAttentionOrder(\\'' + o.id + '\\')">Details</button>' +
      '</div>';
    return '<tr><td class="cell-title">' + shortId(o.id) + '</td>' +
      '<td>' + customer + '</td>' +
      '<td><div class="cell-title">' + (o.service || '—') + '</div><div class="cell-sub">' + (o.platform || '') + ' · ' + (o.quantity || 0) + ' qty</div></td>' +
      '<td>' + money(o.price) + '</td>' +
      '<td>' + issueBadge(o.issue) + '</td>' +
      '<td>' + badge(o.status) + '</td>' +
      '<td>' + badge(o.paymentStatus) + '</td>' +
      '<td class="muted">' + fmtDate(o.updatedAt || o.createdAt) + '</td>' +
      '<td>' + actions + '</td></tr>';
  }

  function renderOrderRow(o, showActions) {
    const pricing = o.pricing || {};
    const user = o.user || {};
    const progress = o.progress;
    let progressHtml = '';
    if (progress && progress.progressPercentage != null) {
      progressHtml = '<div class="progress-mini"><div class="progress-mini-fill" style="width:' + progress.progressPercentage + '%"></div></div><div class="cell-sub">' + progress.progressPercentage + '% delivered</div>';
    }
    const actions = showActions ? '<button class="btn btn-ghost btn-sm" onclick="openOrder(\\'' + o.id + '\\')">Manage</button>' : '<button class="btn btn-ghost btn-sm" onclick="openOrder(\\'' + o.id + '\\')">View</button>';
    return '<tr><td class="cell-title">' + shortId(o.id) + '</td>' +
      '<td><div class="cell-title">' + (user.username || user.email || '—') + '</div><div class="cell-sub">' + (user.email || '') + '</div></td>' +
      '<td><div class="cell-title">' + (o.serviceName || '—') + '</div><div class="cell-sub">' + (o.platform || '') + ' · ' + (o.quantity || 0) + ' qty</div>' + progressHtml + '</td>' +
      '<td>' + money(pricing.amountNGN || o.amount) + '</td>' +
      '<td>' + badge(o.status) + '</td>' +
      '<td class="muted">' + fmtDate(o.createdAt) + '</td>' +
      '<td>' + actions + '</td></tr>';
  }

  async function loadOrders() {
    $('ordersTableWrap').innerHTML = '<div class="loading">Loading orders…</div>';
    try {
      let orders = [];
      if (orderTab === 'attention') {
        const res = await apiFetch('/admin/orders/attention');
        orders = res.data || [];
        window.__attentionLowBalanceCount = orders.filter((o) => o.issue === 'LOW_PROVIDER_BALANCE').length;
        updateAttentionBadge(orders.length);
        renderAttentionBanner(orders.length);
        $('ordersTableWrap').innerHTML = orders.length ? (
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Service</th><th>Amount</th><th>Issue</th><th>Status</th><th>Payment</th><th>Updated</th><th>Actions</th></tr></thead><tbody>' +
          orders.map((o) => renderAttentionRow(o)).join('') +
          '</tbody></table></div><div class="pagination"><span class="muted">' + orders.length + ' order' + (orders.length === 1 ? '' : 's') + ' need attention</span></div>'
        ) : '<div class="empty">No orders need attention right now</div>';
        return;
      } else if (orderTab === 'all') {
        const res = await apiFetch('/admin/orders');
        orders = res.orders || [];
      } else if (orderTab === 'pending') {
        const res = await apiFetch('/admin/orders/pending');
        orders = res.orders || [];
      } else if (orderTab === 'ongoing') {
        const res = await apiFetch('/admin/orders/ongoing');
        orders = res.data?.orders || [];
      } else if (orderTab === 'fulfilled') {
        const res = await apiFetch('/admin/orders/fulfilled?page=1&limit=50');
        orders = res.data?.orders || [];
      }
      const showActions = orderTab === 'pending' || orderTab === 'all';
      $('ordersTableWrap').innerHTML = orders.length ? (
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>User</th><th>Service</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>' +
        orders.map((o) => renderOrderRow(o, showActions)).join('') +
        '</tbody></table></div><div class="pagination"><span class="muted">' + orders.length + ' orders</span></div>'
      ) : '<div class="empty">No orders in this view</div>';
    } catch (e) {
      $('ordersTableWrap').innerHTML = errHtml(null, e.message);
    }
  }

  window.openAttentionOrder = async function(id) {
    try {
      const res = await apiFetch('/admin/orders/attention');
      const o = (res.data || []).find((x) => x.id === id);
      if (!o) { toast('Order not found in attention list', true); return; }
      const refundAction = o.isGuest
        ? '<div class="muted" style="font-size:.82rem">Guest order — refund is unavailable. Use notify instead.</div>'
        : '<button class="btn btn-danger btn-sm" onclick="refundAttentionOrder(\\'' + id + '\\')">Refund to wallet</button>';
      const actions = '<div class="toolbar">' +
        '<button class="btn btn-success btn-sm" onclick="refireAttentionOrder(\\'' + id + '\\')">Refire to SMMStone</button>' +
        refundAction +
        '<button class="btn btn-ghost btn-sm" onclick="openNotifyOrder(\\'' + id + '\\', \\'' + String(o.userEmail || '').replace(/'/g, '') + '\\')">Notify customer</button>' +
        '</div>';
      $('modal').innerHTML = '<div class="modal"><div class="modal-head"><h3>Attention · ' + shortId(id) + '</h3><button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div><div class="modal-body">' +
        '<div class="detail-grid">' +
        '<div><div class="field-label">Customer</div><div class="cell-title">' + (o.isGuest ? 'Guest' : 'Registered') + '</div><div class="cell-sub">' + (o.userEmail || '—') + '</div></div>' +
        '<div><div class="field-label">Issue</div>' + issueBadge(o.issue) + '</div>' +
        '<div><div class="field-label">Status</div>' + badge(o.status) + '</div>' +
        '<div><div class="field-label">Payment</div>' + badge(o.paymentStatus) + '</div>' +
        '<div><div class="field-label">Service</div><div>' + (o.service || '—') + '</div></div>' +
        '<div><div class="field-label">Platform</div><div>' + (o.platform || '—') + '</div></div>' +
        '<div><div class="field-label">Quantity</div><div>' + (o.quantity || '—') + '</div></div>' +
        '<div><div class="field-label">Amount</div><div>' + money(o.price) + '</div></div>' +
        '<div class="full"><div class="field-label">Social URL</div><div style="word-break:break-all">' + (o.link || '—') + '</div></div>' +
        '<div><div class="field-label">Provider ref</div><div class="muted">' + (o.providerOrderId || 'Not submitted') + '</div></div>' +
        '<div><div class="field-label">Updated</div><div class="muted">' + fmtDate(o.updatedAt || o.createdAt) + '</div></div>' +
        '</div>' + actions + '</div></div>';
      show($('modal'));
    } catch (e) { toast(e.message, true); }
  };

  window.refireAttentionOrder = async function(id) {
    if (!confirm('Re-submit this order to SMMStone?')) return;
    try {
      const res = await apiFetch('/admin/orders/' + id + '/refire', { method: 'POST' });
      toast('Order refired' + (res.data?.providerOrderId ? ' · ref ' + res.data.providerOrderId : ''));
      closeModal();
      loadOrders();
      if (page === 'dashboard') loadDashboard();
    } catch (e) { toast(e.message, true); }
  };

  window.refundAttentionOrder = async function(id) {
    if (!confirm('Refund this order amount back to the user wallet?')) return;
    try {
      const res = await apiFetch('/admin/orders/' + id + '/refund', { method: 'POST' });
      toast('Refunded ' + money(res.data?.amount || 0) + ' · ' + (res.data?.reference || ''));
      closeModal();
      loadOrders();
      if (page === 'dashboard') loadDashboard();
    } catch (e) { toast(e.message, true); }
  };

  window.openNotifyOrder = function(id, defaultEmail) {
    $('modal').innerHTML = '<div class="modal"><div class="modal-head"><h3>Notify customer · ' + shortId(id) + '</h3><button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div><div class="modal-body">' +
      '<label class="field-label" for="notifyEmail">Email</label>' +
      '<input class="input" id="notifyEmail" type="email" placeholder="customer@example.com" value="' + String(defaultEmail || '').replace(/"/g, '&quot;') + '" />' +
      '<label class="field-label" for="notifyMessage" style="margin-top:14px">Message (optional)</label>' +
      '<textarea class="input" id="notifyMessage" rows="5" placeholder="Leave blank to send the default BoostLab update email."></textarea>' +
      '<div class="toolbar" style="margin-top:16px">' +
      '<button class="btn btn-primary btn-sm" onclick="sendNotifyOrder(\\'' + id + '\\')">Send email</button>' +
      '</div></div></div>';
    show($('modal'));
  };

  window.sendNotifyOrder = async function(id) {
    const email = ($('notifyEmail') || {}).value || '';
    const message = ($('notifyMessage') || {}).value || '';
    try {
      const res = await apiFetch('/admin/orders/' + id + '/notify', {
        method: 'POST',
        body: JSON.stringify({ email: email || undefined, message: message || undefined }),
      });
      toast('Email sent to ' + (res.data?.to || email));
      closeModal();
    } catch (e) { toast(e.message, true); }
  };

  window.openOrder = async function(id) {
    try {
      const res = await apiFetch('/admin/orders/' + id);
      const o = res.order;
      if (!o) { toast('Order not found', true); return; }
      const user = o.user || {};
      const pricing = o.pricing || {};
      const payment = o.payment || {};
      const canFulfill = o.status === 'PENDING';
      const actions = canFulfill
        ? '<button class="btn btn-success btn-sm" onclick="fulfillOrder(\\'' + id + '\\')">Approve &amp; fulfill</button><button class="btn btn-danger btn-sm" onclick="declineOrder(\\'' + id + '\\')">Decline</button>'
        : '';
      $('modal').innerHTML = '<div class="modal"><div class="modal-head"><h3>Order ' + shortId(id) + '</h3><button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div><div class="modal-body">' +
        '<div class="detail-grid">' +
        '<div><div class="field-label">User</div><div class="cell-title">' + (user.username || '') + '</div><div class="cell-sub">' + (user.email || '') + '</div></div>' +
        '<div><div class="field-label">Status</div>' + badge(o.status) + '</div>' +
        '<div><div class="field-label">Service</div><div>' + (o.serviceName || '—') + '</div></div>' +
        '<div><div class="field-label">Platform</div><div>' + (o.platform || '—') + '</div></div>' +
        '<div><div class="field-label">Quantity</div><div>' + (o.quantity || '—') + '</div></div>' +
        '<div><div class="field-label">Amount</div><div>' + money(pricing.amountNGN) + ' <span class="muted">(' + (pricing.amountUSDT || 0) + ' USDT)</span></div></div>' +
        '<div class="full"><div class="field-label">Social URL</div><div style="word-break:break-all">' + (o.socialUrl || '—') + '</div></div>' +
        '<div><div class="field-label">Payment</div><div>' + badge(payment.status || 'N/A') + '</div></div>' +
        '<div><div class="field-label">Created</div><div class="muted">' + fmtDate(o.createdAt) + '</div></div>' +
        '</div><div class="toolbar">' + actions + '</div></div></div>';
      show($('modal'));
    } catch (e) { toast(e.message, true); }
  };

  window.fulfillOrder = async function(id) {
    if (!confirm('Approve and mark this order as fulfilled?')) return;
    try {
      await apiFetch('/admin/orders/' + id + '/fulfill', { method: 'POST' });
      toast('Order fulfilled'); closeModal(); loadOrders();
    } catch (e) { toast(e.message, true); }
  };

  window.declineOrder = async function(id) {
    const reason = prompt('Decline reason:');
    if (!reason) return;
    try {
      await apiFetch('/admin/orders/' + id + '/decline', { method: 'POST', body: JSON.stringify({ reason }) });
      toast('Order declined'); closeModal(); loadOrders();
    } catch (e) { toast(e.message, true); }
  };

  // ─── Services ────────────────────────────────────────────────
  async function loadServices() {
    $('servicesTableWrap').innerHTML = '<div class="loading">Loading services…</div>';
    try {
      const search = ($('servicesSearch') || {}).value || '';
      const platform = ($('servicesPlatform') || {}).value || '';
      const qs = '?page=' + servicesPage + '&limit=40' + (search ? '&search=' + encodeURIComponent(search) : '') + (platform ? '&platform=' + encodeURIComponent(platform) : '');
      const res = await apiFetch('/admin/services' + qs);
      const services = res.services || [];
      const pag = res.pagination || {};
      $('servicesTableWrap').innerHTML = services.length ? (
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Service</th><th>Platform</th><th>Category</th><th>Provider rate</th><th>Boost rate</th><th>Limits</th><th>Status</th></tr></thead><tbody>' +
        services.map((s) => '<tr><td><div class="cell-title">' + s.name + '</div><div class="cell-sub">ID: ' + (s.serviceId || s.id) + '</div></td><td>' + (s.platform || '—') + '</td><td>' + (s.category || '—') + '</td><td>$' + (s.providerRate || 0) + '</td><td>$' + (s.boostRate || 0) + '</td><td class="muted">' + (s.minOrder || 0) + '–' + (s.maxOrder || 0) + '</td><td>' + badge(s.active ? 'ACTIVE' : 'INACTIVE') + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<div class="pagination"><span class="muted">Page ' + (pag.currentPage || 1) + ' of ' + (pag.totalPages || 1) + ' · ' + (pag.totalServices || services.length) + ' services</span>' +
        '<div class="toolbar">' +
        (pag.hasPrev ? '<button class="btn btn-ghost btn-sm" onclick="servicesPageNav(-1)">← Prev</button>' : '') +
        (pag.hasNext ? '<button class="btn btn-ghost btn-sm" onclick="servicesPageNav(1)">Next →</button>' : '') +
        '</div></div>'
      ) : '<div class="empty">No services found</div>';
    } catch (e) {
      $('servicesTableWrap').innerHTML = errHtml(null, e.message);
    }
  }

  window.servicesPageNav = function(delta) {
    servicesPage = Math.max(1, servicesPage + delta);
    loadServices();
  };

  // ─── Integrations ────────────────────────────────────────────
  async function loadIntegrations() {
    $('integrationMetrics').innerHTML = '<div class="loading">Loading…</div>';
    $('nyraWalletBody').innerHTML = '<div class="loading">Loading…</div>';
    $('smmstoneBody').innerHTML = '<div class="loading">Loading…</div>';
    $('systemStatsBody').innerHTML = '<div class="loading">Loading…</div>';
    try {
      const [balance, stats, nyraWallet, rates] = await Promise.all([
        apiFetch('/admin/smmstone/balance').catch((e) => ({ success: false, error: e.message })),
        apiFetch('/admin/stats'),
        apiFetch('/admin/providers/nyra/wallet-balance').catch((e) => ({ success: false, error: e.message })),
        apiFetch('/admin/rates').catch(() => null),
      ]);
      const bal = balance.data || {};
      const nyra = nyraWallet.data || {};
      const smmMetric = {
        balance: bal.balance,
        lowBalance: !!bal.lowBalance,
        pendingDueToLowBalance: bal.pendingDueToLowBalance || 0,
        error: balance.success === false ? (balance.error || 'Unavailable') : null,
      };
      $('integrationMetrics').innerHTML =
        metricCard('Nyra settled', nyraWallet.success === false ? '—' : money(nyra.available_balance), 'accent') +
        metricCard('Nyra unsettled', nyraWallet.success === false ? '—' : money(nyra.unsettled_balance), 'provider') +
        smmstoneMetricCard(smmMetric) +
        metricCard('Services', String(stats.services || 0)) +
        metricCard('Categories', String(stats.categories || 0)) +
        metricCard('Orders', String(stats.orders || 0));

      $('nyraWalletBody').innerHTML = nyraWallet.success === false
        ? '<div class="empty" style="color:var(--danger)">' + (nyraWallet.error || nyraWallet.message || 'Failed to load') + '</div>'
        : '<div class="health-grid">' +
          '<div class="health-item"><span>Business</span><strong>' + (nyra.businessName || '—') + '</strong></div>' +
          '<div class="health-item"><span>Settled</span><strong style="color:var(--lime)">' + money(nyra.available_balance) + '</strong></div>' +
          '<div class="health-item"><span>Unsettled</span><strong>' + money(nyra.unsettled_balance) + '</strong></div>' +
          '<div class="health-item"><span>Total</span><strong>' + money(nyra.balance) + '</strong></div>' +
          '<div class="health-item"><span>T+1 settlement</span><strong>' + (nyra.settlement_enabled ? 'Enabled' : 'Disabled') + '</strong></div>' +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" style="margin-top:14px" id="refreshNyraBtn">Refresh balance</button>' +
          '<pre class="json" style="margin-top:14px">' + JSON.stringify(nyra, null, 2) + '</pre>';
      if ($('refreshNyraBtn')) $('refreshNyraBtn').onclick = () => loadIntegrations();

      $('smmstoneBody').innerHTML =
        (bal.lowBalance
          ? '<div class="attention-banner" style="margin-bottom:14px"><div class="attention-banner-inner"><div><strong>SMMStone balance is low</strong><div class="muted" style="margin-top:4px;font-size:.82rem">' +
            (bal.pendingDueToLowBalance || 0) + ' paid order' + ((bal.pendingDueToLowBalance || 0) === 1 ? '' : 's') +
            ' waiting to be submitted. Top up SMMStone, then refire from Orders → Needs attention.</div></div></div></div>'
          : '') +
        '<p class="muted" style="margin-bottom:14px">Sync services from SMMStone and check provider balance.</p>' +
        '<div class="toolbar"><button class="btn btn-primary btn-sm" id="syncSmmstoneBtn">Sync services</button><button class="btn btn-ghost btn-sm" id="refreshBalanceBtn">Refresh balance</button></div>' +
        '<pre class="json" style="margin-top:14px">' + JSON.stringify(bal, null, 2) + '</pre>';
      $('syncSmmstoneBtn').onclick = async () => {
        $('syncSmmstoneBtn').disabled = true;
        try {
          const r = await apiFetch('/admin/smmstone/sync-services', { method: 'POST' });
          toast(r.message || 'Services synced');
          loadIntegrations();
        } catch (e) { toast(e.message, true); }
        $('syncSmmstoneBtn').disabled = false;
      };
      $('refreshBalanceBtn').onclick = () => loadIntegrations();

      const ratesInfo = (stats.rates || {});
      const markupPct = rates?.markupPercentage ?? ratesInfo.markupPercentage ?? 0;
      const usdtRate = rates?.usdtExchangeRate ?? ratesInfo.usdtExchangeRate ?? 1500;
      $('systemStatsBody').innerHTML = '<div class="health-grid">' +
        '<div class="health-item"><span>Markup</span><strong>' + markupPct + '%</strong></div>' +
        '<div class="health-item"><span>USDT rate</span><strong>₦' + usdtRate + '</strong></div>' +
        '<div class="health-item"><span>Platforms</span><strong>' + (stats.platforms || 0) + '</strong></div>' +
        '<div class="health-item"><span>Categories</span><strong>' + (stats.categories || 0) + '</strong></div>' +
        '</div><button class="btn btn-ghost btn-sm" style="margin-top:14px" onclick="setPage(\\'pricing\\')">Edit rates →</button>';
    } catch (e) {
      $('integrationMetrics').innerHTML = errHtml(null, e.message);
      $('nyraWalletBody').innerHTML = errHtml(null, e.message);
      $('smmstoneBody').innerHTML = errHtml(null, e.message);
      $('systemStatsBody').innerHTML = errHtml(null, e.message);
    }
  }

  // ─── Users ───────────────────────────────────────────────────
  async function loadUsers() {
    $('usersTableWrap').innerHTML = '<div class="loading">Loading users…</div>';
    try {
      const search = ($('usersSearch') || {}).value || '';
      const verified = ($('usersVerified') || {}).value || '';
      let qs = '?page=' + usersPage + '&limit=30';
      if (search) qs += '&search=' + encodeURIComponent(search);
      if (verified) qs += '&verified=' + verified;
      const res = await apiFetch('/admin/users' + qs);
      const users = res.users || [];
      const pag = res.pagination || {};
      $('usersTableWrap').innerHTML = users.length ? (
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Wallet</th><th>Verified</th><th>Orders</th><th>Spent</th><th>Last order</th><th>Joined</th><th></th></tr></thead><tbody>' +
        users.map((u) => '<tr><td><div class="cell-title">' + (u.username || '—') + '</div><div class="cell-sub">' + (u.email || '') + (u.isGuest ? ' · guest' : '') + '</div></td><td><strong style="color:var(--lime)">' + money(u.walletBalance) + '</strong></td><td>' + badge(u.isVerified ? 'VERIFIED' : 'PENDING') + '</td><td>' + (u.totalOrders || 0) + ' <span class="muted">(' + (u.completedOrders || 0) + ' done)</span></td><td>' + money(u.totalSpent) + '</td><td class="muted">' + fmtDate(u.lastOrderDate) + '</td><td class="muted">' + fmtDate(u.createdAt) + '</td><td><button class="btn btn-ghost btn-sm" onclick="openUser(\\'' + u.id + '\\')">Details</button></td></tr>').join('') +
        '</tbody></table></div>' +
        '<div class="pagination"><span class="muted">Page ' + (pag.currentPage || 1) + ' of ' + (pag.totalPages || 1) + ' · ' + (pag.totalUsers || users.length) + ' users</span>' +
        '<div class="toolbar">' +
        (pag.hasPrev ? '<button class="btn btn-ghost btn-sm" onclick="usersPageNav(-1)">← Prev</button>' : '') +
        (pag.hasNext ? '<button class="btn btn-ghost btn-sm" onclick="usersPageNav(1)">Next →</button>' : '') +
        '</div></div>'
      ) : '<div class="empty">No users found</div>';
    } catch (e) {
      $('usersTableWrap').innerHTML = errHtml(null, e.message);
    }
  }

  window.usersPageNav = function(delta) {
    usersPage = Math.max(1, usersPage + delta);
    loadUsers();
  };


  window.closeSidesheet = function() {
    hide($('sidesheet'));
    $('sidesheet').innerHTML = '';
    activeUserId = '';
  };

  function openSidesheet(html) {
    $('sidesheet').innerHTML = '<div class="sidesheet" onclick="event.stopPropagation()">' + html + '</div>';
    show($('sidesheet'));
  }

  function renderUserSidesheet(u) {
    const stats = u.statistics || {};
    const orders = u.recentOrders || [];
    const wallet = u.wallet || {};
    return (
      '<div class="sidesheet-head">' +
        '<div><h3>' + (u.username || u.email || 'User') + '</h3><div class="cell-sub muted">' + (u.email || '—') + '</div></div>' +
        '<button class="btn btn-ghost btn-sm" onclick="closeSidesheet()">Close</button>' +
      '</div>' +
      '<div class="sidesheet-body">' +
        '<div class="sidesheet-section">' +
          '<h4>Wallet</h4>' +
          '<div class="wallet-balance-pill" id="userWalletBalance">' + money(wallet.balance) + '</div>' +
          '<p class="muted" style="margin-top:10px;font-size:.82rem">Credit this wallet instantly. The user gets a push notification.</p>' +
          '<label class="field-label" style="margin-top:14px">Amount (NGN)</label>' +
          '<input class="input" id="walletCreditAmount" type="number" min="1" step="1" placeholder="e.g. 5000" />' +
          '<label class="field-label">Reason (optional)</label>' +
          '<textarea class="textarea" id="walletCreditReason" placeholder="Why is this wallet being credited?" style="min-height:72px"></textarea>' +
          '<div class="toolbar" style="margin-top:12px">' +
            '<button class="btn btn-primary btn-sm" onclick="submitWalletCredit(\\'' + u.id + '\\')">Credit wallet</button>' +
          '</div>' +
        '</div>' +
        '<div class="detail-grid">' +
          '<div><div class="field-label">Verified</div>' + badge(u.isVerified ? 'VERIFIED' : 'PENDING') + '</div>' +
          '<div><div class="field-label">Total orders</div><div>' + (stats.totalOrders || 0) + '</div></div>' +
          '<div><div class="field-label">Total spent</div><div>' + money(stats.totalSpent) + '</div></div>' +
          '<div><div class="field-label">Favorite platform</div><div>' + (stats.favoritePlatform || '—') + '</div></div>' +
          '<div><div class="field-label">Device tokens</div><div>' + (u.deviceTokens || 0) + '</div></div>' +
        '</div>' +
        '<div class="field-label">Recent orders</div>' +
        (orders.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Service</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
        orders.map((o) => '<tr><td>' + shortId(o.id) + '</td><td>' + (o.serviceName || o.service || '—') + '</td><td>' + money(o.amountNGN || o.amount) + '</td><td>' + badge(o.status) + '</td></tr>').join('') +
        '</tbody></table></div>' : '<div class="empty">No orders</div>') +
      '</div>'
    );
  }

  window.openUser = async function(id) {
    try {
      activeUserId = id;
      const res = await apiFetch('/admin/users/' + id);
      openSidesheet(renderUserSidesheet(res.user || {}));
    } catch (e) { toast(e.message, true); }
  };

  window.submitWalletCredit = async function(userId) {
    const amountInput = $('walletCreditAmount');
    const reasonInput = $('walletCreditReason');
    const amount = Number((amountInput || {}).value);
    const reason = ((reasonInput || {}).value || '').trim();
    if (!amount || amount < 1) {
      toast('Enter a valid amount', true);
      return;
    }
    try {
      const res = await apiFetch('/admin/users/' + userId + '/wallet/credit', {
        method: 'POST',
        body: JSON.stringify({ amount, reason: reason || undefined }),
      });
      toast('Wallet credited · ' + money(res.data && res.data.amount));
      if (amountInput) amountInput.value = '';
      if (reasonInput) reasonInput.value = '';
      const balanceEl = $('userWalletBalance');
      if (balanceEl && res.data) balanceEl.textContent = money(res.data.balanceAfter);
      loadUsers();
    } catch (e) { toast(e.message, true); }
  };

  // ─── KYC ─────────────────────────────────────────────────────
  function renderKycTable(items) {
    if (!items.length) return '<div class="empty">No KYC submissions in this filter.</div>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>BVN / NIN</th><th>Names</th><th>Mode</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>' +
      items.map((item) => {
        const user = item.user || {};
        return '<tr><td><div class="cell-title">' + (user.username || '—') + '</div><div class="cell-sub">' + (user.email || '') + '</div></td>' +
          '<td>***' + (item.bvnLast4 || '') + '<br><span class="muted">***' + (item.ninLast4 || '') + '</span></td>' +
          '<td><div class="cell-sub">' + (item.bvnFullName || '—') + '</div></td>' +
          '<td>' + (item.verificationMode || '—') + '</td>' +
          '<td>' + badge(item.status) + '</td>' +
          '<td class="muted">' + fmtDate(item.createdAt) + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" onclick="openKyc(\\'' + item.id + '\\')">Review</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  async function loadKyc() {
    $('kycTableWrap').innerHTML = '<div class="loading">Loading KYC submissions…</div>';
    try {
      const qs = kycStatus ? '?status=' + kycStatus : '';
      const res = await apiFetch('/admin/kyc' + qs);
      $('kycTableWrap').innerHTML = renderKycTable(res.data.items || []);
    } catch (e) {
      $('kycTableWrap').innerHTML = errHtml(null, e.message);
    }
  }

  window.openKyc = async function(id) {
    try {
      const res = await apiFetch('/admin/kyc/' + id);
      const k = res.data;
      const user = k.user || {};
      const actions = k.status === 'PENDING'
        ? '<button class="btn btn-success btn-sm" onclick="approveKyc(\\'' + id + '\\')">Approve</button><button class="btn btn-danger btn-sm" onclick="rejectKyc(\\'' + id + '\\')">Reject</button>'
        : k.status === 'VERIFIED'
        ? '<button class="btn btn-danger btn-sm" onclick="revokeKyc(\\'' + id + '\\')">Revoke</button>'
        : '';
      $('modal').innerHTML = '<div class="modal"><div class="modal-head"><h3>KYC review</h3><button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div><div class="modal-body">' +
        '<div class="detail-grid">' +
        '<div><div class="field-label">User</div><div class="cell-title">' + (user.username || '') + '</div><div class="cell-sub">' + (user.email || '') + '</div></div>' +
        '<div><div class="field-label">Status</div>' + badge(k.status) + '</div>' +
        '<div><div class="field-label">BVN</div><div>' + (k.bvn || '—') + '</div></div>' +
        '<div><div class="field-label">NIN</div><div>' + (k.nin || '—') + '</div></div>' +
        '<div><div class="field-label">BVN name</div><div>' + (k.bvnFullName || '—') + '</div></div>' +
        '<div><div class="field-label">NIN name</div><div>' + (k.ninFullName || '—') + '</div></div>' +
        '<div><div class="field-label">Mode</div><div>' + (k.verificationMode || '—') + '</div></div>' +
        '<div><div class="field-label">Reviewed</div><div class="muted">' + (k.reviewedBy ? k.reviewedBy + ' · ' + fmtDate(k.reviewedAt) : '—') + '</div></div>' +
        '</div>' +
        '<div class="field-label">BVN name tokens</div><pre class="json">' + JSON.stringify(k.bvnNames || [], null, 2) + '</pre>' +
        '<div class="field-label">NIN name tokens</div><pre class="json">' + JSON.stringify(k.ninNames || [], null, 2) + '</pre>' +
        (k.rejectionReason ? '<div class="field-label">Rejection reason</div><p style="color:var(--danger);margin-bottom:12px">' + k.rejectionReason + '</p>' : '') +
        '<div class="field-label">Admin note</div><textarea class="textarea" id="adminNote" placeholder="Optional note">' + (k.adminNote || '') + '</textarea>' +
        '<div class="toolbar" style="margin-top:14px">' + actions + '</div></div></div>';
      show($('modal'));
    } catch (e) { toast(e.message, true); }
  };

  window.closeModal = function() { hide($('modal')); $('modal').innerHTML = ''; };
  window.approveKyc = async function(id) {
    try {
      await apiFetch('/admin/kyc/' + id + '/approve', { method: 'PATCH', body: JSON.stringify({ adminNote: ($('adminNote') || {}).value || undefined }) });
      toast('KYC approved'); closeModal(); loadKyc();
    } catch (e) { toast(e.message, true); }
  };
  window.rejectKyc = async function(id) {
    const reason = prompt('Rejection reason:'); if (!reason) return;
    try {
      await apiFetch('/admin/kyc/' + id + '/reject', { method: 'PATCH', body: JSON.stringify({ reason, adminNote: ($('adminNote') || {}).value || undefined }) });
      toast('KYC rejected'); closeModal(); loadKyc();
    } catch (e) { toast(e.message, true); }
  };
  window.revokeKyc = async function(id) {
    const reason = prompt('Revocation reason:') || 'Revoked by admin';
    try {
      await apiFetch('/admin/kyc/' + id + '/revoke', { method: 'PATCH', body: JSON.stringify({ reason, adminNote: ($('adminNote') || {}).value || undefined }) });
      toast('KYC revoked'); closeModal(); loadKyc();
    } catch (e) { toast(e.message, true); }
  };

  // ─── Providers ───────────────────────────────────────────────
  async function loadProviders() {
    $('providersBody').innerHTML = '<div class="loading">Loading providers…</div>';
    try {
      const res = await apiFetch('/admin/providers');
      const data = res.data || {};
      const configs = data.configs || [];
      const registered = data.registered || {};
      const rail = data.nyraFundingRail || 'Flutterwave';
      const rails = data.nyraFundingRails || ['Safe_Haven', 'Flutterwave'];

      let html = '<div class="field-label">Active providers</div>';
      ['FUNDING', 'BILLS'].forEach((kind) => {
        const active = configs.find((c) => c.kind === kind && c.active);
        const providers = registered[kind] || registered[kind.toLowerCase()] || [];
        html += '<div class="config-card' + (active ? ' active' : '') + '"><h4>' + kind + '</h4><p>Currently: <strong>' + (active?.provider || 'none') + '</strong></p><div class="toolbar">';
        (Array.isArray(providers) ? providers : []).forEach((p) => {
          const isActive = active?.provider === p;
          html += '<button class="btn ' + (isActive ? 'btn-primary' : 'btn-ghost') + ' btn-sm" onclick="setProvider(\\'' + kind + '\\',\\'' + p + '\\')"' + (isActive ? ' disabled' : '') + '>' + p + '</button>';
        });
        html += '</div></div>';
      });

      html += '<div class="field-label" style="margin-top:20px">Nyra funding rail (dynamic VA)</div>';
      html += '<div class="config-card active"><h4>Active rail: ' + rail + '</h4><p>Switch between Safe Haven and Flutterwave for wallet funding virtual accounts.</p><div class="toolbar">';
      rails.forEach((r) => {
        html += '<button class="btn ' + (r === rail ? 'btn-primary' : 'btn-ghost') + ' btn-sm" onclick="setNyraRail(\\'' + r + '\\')"' + (r === rail ? ' disabled' : '') + '>' + r + '</button>';
      });
      html += '</div></div>';

      html += '<div class="field-label" style="margin-top:20px">All configs</div>';
      html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Kind</th><th>Provider</th><th>Active</th><th>Updated</th></tr></thead><tbody>';
      configs.forEach((c) => {
        html += '<tr><td>' + c.kind + '</td><td class="cell-title">' + c.provider + '</td><td>' + badge(c.active ? 'ACTIVE' : 'INACTIVE') + '</td><td class="muted">' + fmtDate(c.updatedAt) + '</td></tr>';
      });
      html += '</tbody></table></div>';

      $('providersBody').innerHTML = html;
    } catch (e) {
      $('providersBody').innerHTML = errHtml(null, e.message);
    }
  }

  window.setProvider = async function(kind, provider) {
    if (!confirm('Switch ' + kind + ' provider to ' + provider + '?')) return;
    try {
      await apiFetch('/admin/providers/active', { method: 'PATCH', body: JSON.stringify({ kind, provider }) });
      toast('Provider updated'); loadProviders();
    } catch (e) { toast(e.message, true); }
  };

  window.setNyraRail = async function(rail) {
    if (!confirm('Switch Nyra funding rail to ' + rail + '?')) return;
    try {
      await apiFetch('/admin/providers/nyra/funding-rail', { method: 'PATCH', body: JSON.stringify({ rail }) });
      toast('Nyra rail updated'); loadProviders();
    } catch (e) { toast(e.message, true); }
  };

  // ─── Feature flags ───────────────────────────────────────────
  async function loadFeatures() {
    $('featuresBody').innerHTML = '<div class="loading">Loading feature flags…</div>';
    try {
      const res = await apiFetch('/admin/features');
      const flags = res.data || [];
      $('featuresBody').innerHTML = flags.map((f) =>
        '<div class="flag-row"><div class="flag-info"><h4>' + f.name + ' <span class="muted">(' + f.key + ')</span></h4><p>' + (f.description || '') + '</p>' +
        (f.updatedBy ? '<p class="muted" style="font-size:.76rem">Last updated by ' + f.updatedBy + ' · ' + fmtDate(f.updatedAt) + '</p>' : '') +
        '</div><div class="toggle ' + (f.enabled ? 'on' : '') + '" data-flag="' + f.key + '" onclick="toggleFlag(\\'' + f.key + '\\',' + !f.enabled + ')"></div></div>'
      ).join('') || '<div class="empty">No feature flags configured</div>';
    } catch (e) {
      $('featuresBody').innerHTML = errHtml(null, e.message);
    }
  }

  window.toggleFlag = async function(key, enabled) {
    try {
      await apiFetch('/admin/features/' + key, { method: 'PATCH', body: JSON.stringify({ enabled }) });
      toast('Feature ' + key + ' ' + (enabled ? 'enabled' : 'disabled'));
      loadFeatures();
    } catch (e) { toast(e.message, true); }
  };

  // ─── Pricing ─────────────────────────────────────────────────
  async function loadPricing() {
    $('ratesViewBody').innerHTML = '<div class="loading">Loading rates…</div>';
    $('walletFeesBody').innerHTML = '<div class="loading">Loading wallet fees…</div>';
    try {
      const [res, settingsRes] = await Promise.all([
        apiFetch('/admin/rates'),
        apiFetch('/admin/app-settings'),
      ]);
      const fees = settingsRes.data || {};
      const fundingFee = Number(fees.fundingFee || 0);
      const withdrawalFee = Number(fees.withdrawalFee || 0);

      $('ratesViewBody').innerHTML = '<div class="health-grid">' +
        '<div class="health-item"><span>Markup</span><strong>' + res.markupPercentage + '%</strong></div>' +
        '<div class="health-item"><span>USDT exchange rate</span><strong>₦' + res.usdtExchangeRate + '</strong></div>' +
        '<div class="health-item"><span>Example provider rate</span><strong>$' + res.calculation.exampleProviderRate + '</strong></div>' +
        '<div class="health-item"><span>Example boost rate</span><strong>$' + res.calculation.exampleBoostRate + '</strong></div>' +
        '<div class="health-item"><span>Markup amount</span><strong>$' + res.calculation.markupAmount + '</strong></div>' +
        '<div class="health-item"><span>Funding fee</span><strong>' + money(fundingFee) + '</strong></div>' +
        '<div class="health-item"><span>Withdrawal fee</span><strong>' + money(withdrawalFee) + '</strong></div>' +
        '</div>';
      $('markupInput').value = res.markupPercentage;
      $('exchangeInput').value = res.usdtExchangeRate;

      $('walletFeesBody').innerHTML =
        '<div class="grid-2" style="gap:20px">' +
        '<div><label class="field-label">Funding fee (₦)</label>' +
        '<p class="muted" style="font-size:.82rem;margin-bottom:8px">Deducted when a deposit is confirmed. User pays ₦5,000 with ₦50 fee → ₦4,950 credited.</p>' +
        '<input class="input" id="fundingFeeInput" type="number" min="0" step="1" value="' + fundingFee + '" /></div>' +
        '<div><label class="field-label">Withdrawal fee (₦)</label>' +
        '<p class="muted" style="font-size:.82rem;margin-bottom:8px">Added on top of each withdrawal. User withdraws ₦5,000 with ₦50 fee → ₦5,050 debited.</p>' +
        '<input class="input" id="withdrawalFeeInput" type="number" min="0" step="1" value="' + withdrawalFee + '" /></div>' +
        '</div>' +
        (fees.updatedBy ? '<p class="muted" style="margin:14px 0;font-size:.82rem">Last updated by ' + fees.updatedBy + ' · ' + fmtDate(fees.updatedAt) + '</p>' : '') +
        '<button class="btn btn-primary btn-sm" id="saveWalletFeesBtn">Save wallet fees</button>';

      $('saveWalletFeesBtn').onclick = async () => {
        try {
          await apiFetch('/admin/app-settings', {
            method: 'PATCH',
            body: JSON.stringify({
              fundingFee: parseFloat($('fundingFeeInput').value) || 0,
              withdrawalFee: parseFloat($('withdrawalFeeInput').value) || 0,
            }),
          });
          toast('Wallet fees saved');
          loadPricing();
        } catch (e) { toast(e.message, true); }
      };
    } catch (e) {
      $('ratesViewBody').innerHTML = errHtml(null, e.message);
      $('walletFeesBody').innerHTML = errHtml(null, e.message);
    }
  }

  // ─── Push notifications ──────────────────────────────────────
  async function loadPushNotifications() {
    $('pushComposeBody').innerHTML = '<div class="loading">Loading push composer…</div>';
    $('pushTemplatesBody').innerHTML = '<div class="loading">Loading templates…</div>';
    try {
      const templatesRes = await apiFetch('/admin/notifications/templates');
      pushTemplates = templatesRes.data || [];
      renderPushTemplates();
      renderPushComposer();
      await refreshPushPreview();
    } catch (e) {
      $('pushComposeBody').innerHTML = errHtml(null, e.message);
      $('pushTemplatesBody').innerHTML = errHtml(null, e.message);
    }
  }

  function renderPushTemplates() {
    $('pushTemplatesBody').innerHTML =
      '<div class="template-chips">' +
      pushTemplates.map((t) =>
        '<button type="button" class="template-chip" data-template="' + t.key + '">' + t.label + '</button>'
      ).join('') +
      '</div>' +
      '<p class="muted" style="margin-top:16px;font-size:.82rem">Templates only fill title and message — choose your audience before sending.</p>';
    $('pushTemplatesBody').querySelectorAll('[data-template]').forEach((btn) => {
      btn.onclick = () => {
        const tpl = pushTemplates.find((t) => t.key === btn.getAttribute('data-template'));
        if (!tpl) return;
        $('pushTitleInput').value = tpl.title;
        $('pushBodyInput').value = tpl.body;
        $('pushTypeInput').value = tpl.type;
        $('pushTemplateKeyInput').value = tpl.key;
        toast('Template applied');
      };
    });
  }

  function renderSelectedUsers() {
    const wrap = $('pushSelectedUsers');
    if (!wrap) return;
    if (!pushSelectedUsers.length) {
      wrap.innerHTML = '<p class="muted" style="font-size:.82rem">No users selected yet.</p>';
      return;
    }
    wrap.innerHTML = pushSelectedUsers.map((u) =>
      '<span class="selected-user-tag">' + (u.email || u.username || u.id) +
      ' <button type="button" data-remove-user="' + u.id + '" style="background:none;border:none;color:inherit;cursor:pointer">×</button></span>'
    ).join('');
    wrap.querySelectorAll('[data-remove-user]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-remove-user');
        pushSelectedUsers = pushSelectedUsers.filter((u) => u.id !== id);
        renderSelectedUsers();
        refreshPushPreview();
      };
    });
  }

  async function searchPushUsers() {
    const q = ($('pushUserSearchInput') || {}).value || '';
    const wrap = $('pushUserSearchResults');
    if (!wrap) return;
    if (!q.trim()) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = '<div class="loading">Searching…</div>';
    try {
      const res = await apiFetch('/admin/users?search=' + encodeURIComponent(q.trim()) + '&limit=8');
      const users = res.users || [];
      if (!users.length) {
        wrap.innerHTML = '<p class="muted" style="padding:10px;font-size:.82rem">No users found.</p>';
        return;
      }
      wrap.innerHTML = '<div class="user-pick-list">' + users.map((u) =>
        '<label class="user-pick-item"><input type="checkbox" data-user-id="' + u.id + '" data-user-email="' + (u.email || '') + '" data-user-username="' + (u.username || '') + '" ' +
        (pushSelectedUsers.some((s) => s.id === u.id) ? 'checked' : '') + ' />' +
        '<span>' + (u.email || u.username || u.id) + '</span></label>'
      ).join('') + '</div>';
      wrap.querySelectorAll('input[data-user-id]').forEach((input) => {
        input.onchange = () => {
          const id = input.getAttribute('data-user-id');
          if (input.checked) {
            if (!pushSelectedUsers.some((u) => u.id === id)) {
              pushSelectedUsers.push({
                id,
                email: input.getAttribute('data-user-email'),
                username: input.getAttribute('data-user-username'),
              });
            }
          } else {
            pushSelectedUsers = pushSelectedUsers.filter((u) => u.id !== id);
          }
          renderSelectedUsers();
          refreshPushPreview();
        };
      });
    } catch (e) {
      wrap.innerHTML = errHtml(null, e.message);
    }
  }

  async function refreshPushPreview() {
    const audience = ($('pushAudienceInput') || {}).value || 'all';
    const preview = $('pushAudiencePreview');
    if (!preview) return;
    preview.innerHTML = '<span class="muted">Calculating audience…</span>';
    try {
      let qs = '?audience=' + encodeURIComponent(audience);
      if (audience === 'individuals' && pushSelectedUsers.length) {
        pushSelectedUsers.forEach((u) => { qs += '&userIds=' + encodeURIComponent(u.id); });
      }
      const res = await apiFetch('/admin/notifications/audience-preview' + qs);
      const d = res.data || {};
      preview.innerHTML =
        '<strong>Audience preview</strong><br>' +
        '<span class="muted">' + d.userCount + ' users · ' + d.deviceCount + ' devices' +
        (d.guestDeviceCount ? ' · ' + d.guestDeviceCount + ' guest devices' : '') + '</span>';
    } catch (e) {
      preview.innerHTML = errHtml(null, e.message);
    }
  }

  function renderPushComposer() {
    $('pushComposeBody').innerHTML =
      '<label class="field-label">Audience</label>' +
      '<select class="select" id="pushAudienceInput">' +
      '<option value="all">All users (every active device)</option>' +
      '<option value="individuals">Selected individuals</option>' +
      '<option value="verified_users">Verified users only</option>' +
      '<option value="unverified_users">Unverified users only</option>' +
      '<option value="ios_only">iOS users only</option>' +
      '<option value="android_only">Android users only</option>' +
      '<option value="active_30d">Active in last 30 days</option>' +
      '<option value="with_orders">Users with at least one order</option>' +
      '<option value="guest_devices">Guest devices only</option>' +
      '</select>' +
      '<div id="pushIndividualsWrap" class="hidden" style="margin-top:14px">' +
      '<label class="field-label">Find users</label>' +
      '<input class="input" id="pushUserSearchInput" placeholder="Search by email or username" />' +
      '<button type="button" class="btn btn-ghost btn-sm" id="pushUserSearchBtn" style="margin-top:8px">Search users</button>' +
      '<div id="pushUserSearchResults"></div>' +
      '<div id="pushSelectedUsers"></div>' +
      '</div>' +
      '<div class="push-preview" id="pushAudiencePreview"></div>' +
      '<label class="field-label">Title</label>' +
      '<input class="input" id="pushTitleInput" maxlength="120" placeholder="Notification title" />' +
      '<label class="field-label">Message</label>' +
      '<textarea class="input" id="pushBodyInput" rows="4" maxlength="500" placeholder="Notification message"></textarea>' +
      '<label class="field-label">Type</label>' +
      '<select class="select" id="pushTypeInput">' +
      '<option value="PROMOTIONAL">Promotional</option>' +
      '<option value="SYSTEM_ALERT">System alert</option>' +
      '<option value="SECURITY">Security</option>' +
      '<option value="ORDER_UPDATE">Order update</option>' +
      '<option value="PAYMENT_UPDATE">Payment / wallet</option>' +
      '</select>' +
      '<input type="hidden" id="pushTemplateKeyInput" value="" />' +
      '<label class="field-label">Click action (optional)</label>' +
      '<input class="input" id="pushClickActionInput" placeholder="e.g. wallet, orders, boost" />' +
      '<div class="toolbar" style="margin-top:16px">' +
      '<button class="btn btn-primary" id="sendPushBtn">Send push notification</button>' +
      '<button class="btn btn-ghost btn-sm" id="refreshPushPreviewBtn">Refresh audience</button>' +
      '</div>';

    const audienceInput = $('pushAudienceInput');
    const individualsWrap = $('pushIndividualsWrap');
    const toggleIndividuals = () => {
      if (audienceInput.value === 'individuals') show(individualsWrap);
      else hide(individualsWrap);
      refreshPushPreview();
    };
    audienceInput.onchange = toggleIndividuals;
    toggleIndividuals();
    renderSelectedUsers();

    $('pushUserSearchBtn').onclick = searchPushUsers;
    $('pushUserSearchInput').onkeydown = (e) => { if (e.key === 'Enter') searchPushUsers(); };
    $('refreshPushPreviewBtn').onclick = refreshPushPreview;

    $('sendPushBtn').onclick = async () => {
      const audience = audienceInput.value;
      const title = $('pushTitleInput').value.trim();
      const body = $('pushBodyInput').value.trim();
      const type = $('pushTypeInput').value;
      const templateKey = $('pushTemplateKeyInput').value || undefined;
      const clickAction = $('pushClickActionInput').value.trim() || undefined;
      if (!title || !body) {
        toast('Title and message are required', true);
        return;
      }
      if (audience === 'individuals' && !pushSelectedUsers.length) {
        toast('Select at least one user for individual sends', true);
        return;
      }
      if (!confirm('Send this push notification now?')) return;
      try {
        const payload = {
          audience,
          title,
          body,
          type,
          templateKey,
          clickAction,
          userIds: audience === 'individuals' ? pushSelectedUsers.map((u) => u.id) : undefined,
        };
        const res = await apiFetch('/admin/notifications/send', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const d = res.data || {};
        toast(d.message || ('Sent to ' + (d.sentCount || 0) + ' devices'));
      } catch (e) {
        toast(e.message, true);
      }
    };
  }

  // ─── Email templates ─────────────────────────────────────────
  async function loadEmailTemplates() {
    $('emailTemplatesBody').innerHTML = '<div class="loading">Loading templates…</div>';
    const frame = $('emailPreviewFrame');
    if (frame) frame.srcdoc = '<p style="padding:24px;color:#888;font-family:sans-serif">Loading preview…</p>';
    try {
      const [templatesRes, statusRes] = await Promise.all([
        apiFetch('/admin/emails/templates'),
        apiFetch('/admin/emails/status'),
      ]);
      const templates = templatesRes.data || [];
      const status = statusRes.data || {};
      $('emailTemplatesBody').innerHTML =
        '<div class="health-grid" style="margin-bottom:16px">' +
        '<div class="health-item"><span>Provider</span><strong>' + (status.provider || 'zeptomail') + '</strong></div>' +
        '<div class="health-item"><span>Mode</span><strong>' + (status.devMode ? 'Dev (no send)' : 'Production') + '</strong></div>' +
        '<div class="health-item"><span>From</span><strong>' + (status.fromEmail || '—') + '</strong></div>' +
        '</div>' +
        '<label class="field-label">Template</label>' +
        '<select class="select" id="emailTemplateSelect">' +
        templates.map((t) => '<option value="' + t.slug + '">' + t.name + '</option>').join('') +
        '</select>' +
        '<p class="muted" style="margin:12px 0 0;font-size:.82rem" id="emailTemplateDesc">' + (templates[0]?.description || '') + '</p>' +
        '<p class="muted" style="margin:8px 0 0;font-size:.82rem">Subject: <strong id="emailTemplateSubject">' + (templates[0]?.subject || '') + '</strong></p>' +
        '<div class="template-file-list">' +
        '<p class="muted" style="font-size:.82rem;margin-bottom:8px">Edit these files to restyle:</p>' +
        '<code>src/emails/templates/layout.ts</code><br/>' +
        '<code>src/emails/templates/otp.template.ts</code><br/>' +
        '<code>src/emails/templates/welcome.template.ts</code><br/>' +
        '<code>src/emails/templates/order-status.template.ts</code><br/>' +
        '<code>src/emails/templates/order-completion.template.ts</code><br/>' +
        '<code>src/emails/templates/txn-success.template.ts</code><br/>' +
        '<code>src/emails/templates/withdrawal.template.ts</code><br/>' +
        '<code>src/emails/templates/wallet-topup.template.ts</code><br/>' +
        '<code>src/emails/templates/electricity-token.template.ts</code><br/>' +
        '<code>src/emails/templates/custom.template.ts</code>' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" id="refreshEmailPreviewBtn" style="margin-top:16px">Refresh preview</button>';

      async function previewTemplate(slug) {
        const tpl = templates.find((t) => t.slug === slug);
        if ($('emailTemplateDesc')) $('emailTemplateDesc').textContent = tpl?.description || '';
        if ($('emailTemplateSubject')) $('emailTemplateSubject').textContent = tpl?.subject || '';
        const res = await fetch(API + '/admin/emails/preview/' + slug, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const html = await res.text();
        if (frame) frame.srcdoc = html;
      }

      const select = $('emailTemplateSelect');
      select.onchange = () => previewTemplate(select.value);
      $('refreshEmailPreviewBtn').onclick = () => previewTemplate(select.value);
      if (templates.length) await previewTemplate(templates[0].slug);
    } catch (e) {
      $('emailTemplatesBody').innerHTML = errHtml(null, e.message);
      if (frame) frame.srcdoc = errHtml(null, e.message);
    }
  }

  // ─── App settings ────────────────────────────────────────────
  async function loadSettings() {
    $('settingsBody').innerHTML = '<div class="loading">Loading settings…</div>';
    try {
      const res = await apiFetch('/admin/app-settings');
      const s = res.data || {};
      $('settingsBody').innerHTML =
        '<label class="field-label">SMM web flow URL</label>' +
        '<p class="muted" style="font-size:.82rem;margin-bottom:8px">Opened when users tap &ldquo;Boost your socials&rdquo; in the app (production). Dev builds keep using the local Vite server.</p>' +
        '<input class="input" id="smmWebUrlInput" value="' + (s.smmWebUrl || '') + '" placeholder="https://boostlab.ng/boost" />' +
        '<label class="field-label">WhatsApp support line</label>' +
        '<input class="input" id="whatsappInput" value="' + (s.whatsappSupportLine || '') + '" placeholder="+234… or wa.me link" />' +
        '<label class="field-label">Help &amp; support URL</label>' +
        '<input class="input" id="helpUrlInput" value="' + (s.helpSupportUrl || '') + '" placeholder="https://…" />' +
        '<label class="field-label">About page URL</label>' +
        '<input class="input" id="aboutUrlInput" value="' + (s.aboutPageUrl || '') + '" placeholder="https://…" />' +
        (s.updatedBy ? '<p class="muted" style="margin-bottom:14px;font-size:.82rem">Last updated by ' + s.updatedBy + ' · ' + fmtDate(s.updatedAt) + '</p>' : '') +
        '<button class="btn btn-primary" id="saveSettingsBtn">Save settings</button>';
      $('saveSettingsBtn').onclick = async () => {
        try {
          await apiFetch('/admin/app-settings', {
            method: 'PATCH',
            body: JSON.stringify({
              smmWebUrl: $('smmWebUrlInput').value,
              whatsappSupportLine: $('whatsappInput').value,
              helpSupportUrl: $('helpUrlInput').value,
              aboutPageUrl: $('aboutUrlInput').value,
            }),
          });
          toast('Settings saved'); loadSettings();
        } catch (e) { toast(e.message, true); }
      };
    } catch (e) {
      $('settingsBody').innerHTML = errHtml(null, e.message);
    }
  }

  // ─── Webhooks ────────────────────────────────────────────────
  async function loadWebhooks() {
    $('webhooksTableWrap').innerHTML = '<div class="loading">Loading webhooks…</div>';
    try {
      const provider = ($('webhookProvider') || {}).value || '';
      const processed = ($('webhookProcessed') || {}).value || '';
      let qs = '?page=' + webhooksPage + '&limit=25';
      if (provider) qs += '&provider=' + provider;
      if (processed) qs += '&processed=' + processed;
      const res = await apiFetch('/admin/webhooks' + qs);
      const logs = res.data?.webhookLogs || [];
      const pag = res.data?.pagination || {};
      $('webhooksTableWrap').innerHTML = logs.length ? (
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Provider</th><th>Event</th><th>Status</th><th>Reference</th><th>Amount</th><th>Date</th><th></th></tr></thead><tbody>' +
        logs.map((l) => {
          const ext = l.extractedData || {};
          return '<tr><td class="cell-title">' + l.provider + '</td><td>' + (l.event || '—') + '</td><td>' + badge(l.processed ? 'PROCESSED' : 'FAILED') + '</td><td class="cell-sub">' + (ext.reference || l.paymentId || '—') + '</td><td>' + (ext.amount ? money(ext.amount) : '—') + '</td><td class="muted">' + fmtDate(l.createdAt) + '</td><td><button class="btn btn-ghost btn-sm" onclick="openWebhook(\\'' + l.id + '\\')">Details</button></td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        '<div class="pagination"><span class="muted">Page ' + pag.page + ' of ' + pag.totalPages + ' · ' + pag.total + ' logs</span>' +
        '<div class="toolbar">' +
        (pag.page > 1 ? '<button class="btn btn-ghost btn-sm" onclick="webhooksPageNav(-1)">← Prev</button>' : '') +
        (pag.page < pag.totalPages ? '<button class="btn btn-ghost btn-sm" onclick="webhooksPageNav(1)">Next →</button>' : '') +
        '</div></div>'
      ) : '<div class="empty">No webhook logs</div>';
    } catch (e) {
      $('webhooksTableWrap').innerHTML = errHtml(null, e.message);
    }
  }

  window.webhooksPageNav = function(delta) {
    webhooksPage = Math.max(1, webhooksPage + delta);
    loadWebhooks();
  };

  window.openWebhook = async function(id) {
    try {
      const res = await apiFetch('/admin/webhooks/' + id);
      const w = res.data || {};
      $('modal').innerHTML = '<div class="modal"><div class="modal-head"><h3>Webhook ' + shortId(id) + '</h3><button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div><div class="modal-body">' +
        '<div class="detail-grid">' +
        '<div><div class="field-label">Provider</div><div>' + w.provider + '</div></div>' +
        '<div><div class="field-label">Event</div><div>' + (w.event || '—') + '</div></div>' +
        '<div><div class="field-label">Processed</div>' + badge(w.processed ? 'PROCESSED' : 'FAILED') + '</div>' +
        '<div><div class="field-label">IP</div><div class="muted">' + (w.ipAddress || '—') + '</div></div>' +
        '</div>' +
        (w.processingError ? '<div class="field-label">Error</div><p style="color:var(--danger);margin-bottom:12px">' + w.processingError + '</p>' : '') +
        '<div class="field-label">Payload</div><pre class="json">' + JSON.stringify(w.payload, null, 2) + '</pre></div></div>';
      show($('modal'));
    } catch (e) { toast(e.message, true); }
  };

  window.setPage = setPage;

  // ─── Auth & events ───────────────────────────────────────────
  async function showApp() {
    hide($('loginView'));
    show($('appView'));
    applySidebar();
    try {
      await apiFetch('/admin/dashboard/stats');
      setPage('dashboard');
    } catch (err) {
      hide($('appView'));
      show($('loginView'));
      $('loginError').textContent = err.message || 'Session expired';
    }
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginError').textContent = '';
    try {
      const res = await fetch(API + '/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('email').value, password: $('password').value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      token = data.access_token;
      localStorage.setItem('boost_admin_token', token);
      showApp();
    } catch (err) {
      $('loginError').textContent = err.message;
    }
  });

  $('logoutBtn').addEventListener('click', () => {
    token = '';
    localStorage.removeItem('boost_admin_token');
    hide($('appView'));
    show($('loginView'));
  });

  $('sidebarToggle').addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    applySidebar();
  });

  $('refreshBtn').addEventListener('click', refreshPage);

  $('saveRatesBtn').addEventListener('click', async () => {
    try {
      const res = await apiFetch('/admin/rates', {
        method: 'POST',
        body: JSON.stringify({
          markupPercentage: parseFloat($('markupInput').value),
          usdtExchangeRate: parseFloat($('exchangeInput').value),
        }),
      });
      toast(res.message || 'Rates updated'); loadPricing();
    } catch (e) { toast(e.message, true); }
  });

  $('recalcPricesBtn').addEventListener('click', async () => {
    if (!confirm('Recalculate all service prices with current rates?')) return;
    try {
      const res = await apiFetch('/admin/recalculate-prices', { method: 'POST' });
      toast(res.message || 'Prices recalculated');
    } catch (e) { toast(e.message, true); }
  });

  $('cleanupOrdersBtn').addEventListener('click', async () => {
    if (!confirm('Clean up expired pending orders older than 3 days?')) return;
    try {
      const res = await apiFetch('/admin/cleanup/expired-orders', { method: 'POST' });
      toast(res.message || 'Cleanup complete'); loadOrders();
    } catch (e) { toast(e.message, true); }
  });

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });

  document.querySelectorAll('#kycTabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#kycTabs .tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      kycStatus = btn.dataset.status;
      loadKyc();
    });
  });

  document.querySelectorAll('#orderTabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#orderTabs .tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      orderTab = btn.dataset.orderTab;
      loadOrders();
    });
  });

  $('usersSearchBtn').addEventListener('click', () => { usersPage = 1; loadUsers(); });
  $('usersSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') { usersPage = 1; loadUsers(); } });
  $('servicesSearchBtn').addEventListener('click', () => { servicesPage = 1; loadServices(); });
  $('servicesSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') { servicesPage = 1; loadServices(); } });
  $('webhookFilterBtn').addEventListener('click', () => { webhooksPage = 1; loadWebhooks(); });

  document.querySelectorAll('#periodTabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      dashboardPeriod = btn.dataset.period;
      localStorage.setItem('boost_admin_period', dashboardPeriod);
      if (dashboardPeriod === 'custom') {
        syncPeriodUi();
      } else {
        loadDashboard();
      }
    });
  });

  $('applyRangeBtn').addEventListener('click', () => {
    dashboardStart = $('rangeStart').value;
    dashboardEnd = $('rangeEnd').value;
    if (!dashboardStart || !dashboardEnd) {
      toast('Select start and end dates', true);
      return;
    }
    localStorage.setItem('boost_admin_range_start', dashboardStart);
    localStorage.setItem('boost_admin_range_end', dashboardEnd);
    loadDashboard();
  });

  if (token) showApp();
  else {
    hide($('appView'));
    show($('loginView'));
  }
})();
`;
}
