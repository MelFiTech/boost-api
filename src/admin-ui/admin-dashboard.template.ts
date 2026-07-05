import { ADMIN_DASHBOARD_STYLES } from './admin-dashboard.styles';
import { getAdminDashboardScript } from './admin-dashboard.script';

export function getAdminDashboardHtml(apiBase: string): string {
  const base = apiBase.replace(/\/$/, '');
  const logoUrl = `${base}/admin/assets/logo.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BoostLab Admin</title>
  <link rel="icon" href="${logoUrl}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css" />
  <style>${ADMIN_DASHBOARD_STYLES}</style>
</head>
<body>
  <div id="loginView" class="login-screen">
    <div class="login-card">
      <div class="login-brand">
        <img src="${logoUrl}" alt="BoostLab" />
        <h1>BoostLab Admin</h1>
        <p>Full platform control — orders, users, KYC, services, providers &amp; more.</p>
      </div>
      <form id="loginForm">
        <label class="field-label">Email</label>
        <input class="input" id="email" type="email" value="admin@boost.com" required />
        <label class="field-label">Password</label>
        <input class="input" id="password" type="password" value="Boost2025" required />
        <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:4px">Sign in</button>
      </form>
      <p id="loginError" class="muted" style="color:var(--danger);margin-top:14px;text-align:center"></p>
    </div>
  </div>

  <div id="appView" class="app-shell hidden">
    <aside id="sidebar" class="sidebar">
      <div class="sidebar-top">
        <img class="sidebar-logo" src="${logoUrl}" alt="BoostLab" />
        <span class="brand-text">BoostLab</span>
        <button id="sidebarToggle" class="sidebar-toggle" title="Collapse sidebar" aria-label="Toggle sidebar">
          <i id="sidebarToggleIcon" class="ph ph-sidebar-simple"></i>
        </button>
      </div>
      <nav class="nav">
        <div class="nav-section">Overview</div>
        <button class="nav-item active" data-page="dashboard"><span class="nav-icon"><i class="ph ph-squares-four"></i></span><span class="nav-label">Dashboard</span></button>

        <div class="nav-section">Operations</div>
        <button class="nav-item" data-page="orders"><span class="nav-icon"><i class="ph ph-package"></i></span><span class="nav-label">Orders</span></button>
        <button class="nav-item" data-page="services"><span class="nav-icon"><i class="ph ph-storefront"></i></span><span class="nav-label">Services</span></button>
        <button class="nav-item" data-page="integrations"><span class="nav-icon"><i class="ph ph-plugs-connected"></i></span><span class="nav-label">Integrations</span></button>

        <div class="nav-section">People &amp; Trust</div>
        <button class="nav-item" data-page="users"><span class="nav-icon"><i class="ph ph-users"></i></span><span class="nav-label">Users</span></button>
        <button class="nav-item" data-page="kyc"><span class="nav-icon"><i class="ph ph-identification-card"></i></span><span class="nav-label">KYC Review</span></button>

        <div class="nav-section">Platform Control</div>
        <button class="nav-item" data-page="providers"><span class="nav-icon"><i class="ph ph-gear-six"></i></span><span class="nav-label">Providers</span></button>
        <button class="nav-item" data-page="features"><span class="nav-icon"><i class="ph ph-flag"></i></span><span class="nav-label">Feature Flags</span></button>
        <button class="nav-item" data-page="pricing"><span class="nav-icon"><i class="ph ph-currency-circle-dollar"></i></span><span class="nav-label">Pricing &amp; Rates</span></button>
        <button class="nav-item" data-page="settings"><span class="nav-icon"><i class="ph ph-device-mobile"></i></span><span class="nav-label">App Settings</span></button>
        <button class="nav-item" data-page="push"><span class="nav-icon"><i class="ph ph-bell-ringing"></i></span><span class="nav-label">Push Notifications</span></button>
        <button class="nav-item" data-page="emails"><span class="nav-icon"><i class="ph ph-envelope-simple"></i></span><span class="nav-label">Email Templates</span></button>

        <div class="nav-section">Monitoring</div>
        <button class="nav-item" data-page="webhooks"><span class="nav-icon"><i class="ph ph-broadcast"></i></span><span class="nav-label">Webhooks</span></button>
      </nav>
      <div class="sidebar-footer">
        <a class="btn btn-ghost btn-sm" href="${base}/docs" target="_blank" rel="noopener" style="width:100%;justify-content:center;text-decoration:none">
          <i class="ph ph-book-open-text"></i><span class="nav-label-text">API Docs</span>
        </a>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <h2 id="pageTitle">Dashboard</h2>
        <div class="topbar-actions">
          <button class="btn btn-ghost btn-sm" id="refreshBtn" title="Refresh page"><i class="ph ph-arrow-clockwise"></i> Refresh</button>
          <button class="btn btn-ghost btn-sm" id="logoutBtn">Sign out</button>
        </div>
      </header>

      <main class="content">
        <section data-page-panel="dashboard">
          <div class="dashboard-toolbar">
            <div class="period-tabs" id="periodTabs">
              <button class="tab" data-period="today">Today</button>
              <button class="tab active" data-period="week">This week</button>
              <button class="tab" data-period="month">30 days</button>
              <button class="tab" data-period="all">All time</button>
              <button class="tab" data-period="custom">Custom</button>
            </div>
            <div id="customRangeBar" class="custom-range hidden">
              <input class="input input-inline" type="date" id="rangeStart" />
              <span class="muted">to</span>
              <input class="input input-inline" type="date" id="rangeEnd" />
              <button class="btn btn-primary btn-sm" id="applyRangeBtn">Apply</button>
            </div>
            <span id="periodLabel" class="period-label muted"></span>
          </div>
          <div id="attentionBanner" class="attention-banner hidden"></div>
          <div id="dashboardMetrics" class="grid-metrics grid-metrics-wide"></div>
          <div class="grid-2" style="margin-bottom:20px">
            <div class="panel">
              <div class="panel-header"><h3>Volume breakdown</h3></div>
              <div class="panel-body padded" id="volumeBreakdownBody"></div>
            </div>
            <div class="panel">
              <div class="panel-header"><h3>Fees collected</h3></div>
              <div class="panel-body padded" id="feesBreakdownBody"></div>
            </div>
          </div>
          <div class="grid-2">
            <div class="panel">
              <div class="panel-header"><h3>Recent orders</h3><button class="btn btn-ghost btn-sm" onclick="setPage('orders')">View all</button></div>
              <div class="panel-body" id="recentOrdersBody"></div>
            </div>
            <div>
              <div class="panel" style="margin-bottom:20px">
                <div class="panel-header"><h3>Orders by status</h3></div>
                <div id="orderStatusBars" class="status-bars"></div>
              </div>
              <div class="panel">
                <div class="panel-header"><h3>Platform health</h3></div>
                <div class="panel-body padded" id="platformHealthBody"></div>
              </div>
            </div>
          </div>
        </section>

        <section data-page-panel="orders" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>Order management</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Track fulfillment, recover stuck payments, refire provider jobs, and refund users.</p>
              </div>
              <button class="btn btn-ghost btn-sm" id="cleanupOrdersBtn">Cleanup expired</button>
            </div>
            <div class="tabs" id="orderTabs">
              <button class="tab" data-order-tab="attention">Needs attention <span class="tab-badge hidden" id="attentionTabBadge">0</span></button>
              <button class="tab active" data-order-tab="all">All</button>
              <button class="tab" data-order-tab="pending">Pending</button>
              <button class="tab" data-order-tab="ongoing">Ongoing</button>
              <button class="tab" data-order-tab="fulfilled">Fulfilled</button>
            </div>
            <div class="panel-body padded" id="ordersTableWrap"></div>
          </div>
        </section>

        <section data-page-panel="services" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>Service catalog</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Browse and search all SMM services on the platform.</p>
              </div>
            </div>
            <div class="filter-bar" id="servicesFilterBar">
              <input class="input input-inline" id="servicesSearch" placeholder="Search services…" />
              <input class="input input-inline" id="servicesPlatform" placeholder="Platform filter" />
              <button class="btn btn-primary btn-sm" id="servicesSearchBtn">Search</button>
            </div>
            <div class="panel-body padded" id="servicesTableWrap"></div>
          </div>
        </section>

        <section data-page-panel="integrations" class="hidden">
          <div class="grid-metrics" id="integrationMetrics"></div>
          <div class="grid-2">
            <div class="panel">
              <div class="panel-header"><h3>Nyra master wallet</h3></div>
              <div class="panel-body padded" id="nyraWalletBody"></div>
            </div>
            <div class="panel">
              <div class="panel-header"><h3>SMMStone</h3></div>
              <div class="panel-body padded" id="smmstoneBody"></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h3>System stats</h3></div>
            <div class="panel-body padded" id="systemStatsBody"></div>
          </div>
        </section>

        <section data-page-panel="users" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>User management</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Search users, view activity, and inspect order history.</p>
              </div>
            </div>
            <div class="filter-bar">
              <input class="input input-inline" id="usersSearch" placeholder="Search email or username…" />
              <select class="select select-inline" id="usersVerified">
                <option value="">All users</option>
                <option value="true">Verified only</option>
                <option value="false">Unverified only</option>
              </select>
              <button class="btn btn-primary btn-sm" id="usersSearchBtn">Search</button>
            </div>
            <div class="panel-body padded" id="usersTableWrap"></div>
          </div>
        </section>

        <section data-page-panel="kyc" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>KYC submissions</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Approve users before they can add bank accounts and withdraw.</p>
              </div>
            </div>
            <div class="tabs" id="kycTabs">
              <button class="tab active" data-status="PENDING">Pending</button>
              <button class="tab" data-status="VERIFIED">Approved</button>
              <button class="tab" data-status="REJECTED">Rejected</button>
              <button class="tab" data-status="">All</button>
            </div>
            <div class="panel-body padded" id="kycTableWrap"></div>
          </div>
        </section>

        <section data-page-panel="providers" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>Payment providers</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Switch funding, bills, and Nyra VA rails at runtime.</p>
              </div>
            </div>
            <div class="panel-body padded" id="providersBody"></div>
          </div>
        </section>

        <section data-page-panel="features" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>Feature flags</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Enable or disable platform features — changes push to apps instantly.</p>
              </div>
            </div>
            <div class="panel-body padded" id="featuresBody"></div>
          </div>
        </section>

        <section data-page-panel="pricing" class="hidden">
          <div class="grid-2">
            <div class="panel">
              <div class="panel-header"><h3>Current rates</h3></div>
              <div class="panel-body padded" id="ratesViewBody"></div>
            </div>
            <div class="panel">
              <div class="panel-header"><h3>Update rates</h3></div>
              <div class="panel-body padded">
                <label class="field-label">Markup %</label>
                <input class="input" id="markupInput" type="number" min="0" max="100" step="0.1" />
                <label class="field-label">USDT → NGN exchange rate</label>
                <input class="input" id="exchangeInput" type="number" min="1" step="1" />
                <div class="toolbar" style="margin-top:8px">
                  <button class="btn btn-primary btn-sm" id="saveRatesBtn">Save rates</button>
                  <button class="btn btn-ghost btn-sm" id="recalcPricesBtn">Recalculate all prices</button>
                </div>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>Wallet fees</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Flat NGN fees applied to wallet funding and withdrawals. Shown to users in the app.</p>
              </div>
            </div>
            <div class="panel-body padded" id="walletFeesBody"></div>
          </div>
        </section>

        <section data-page-panel="settings" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>App settings</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Support links and URLs shown in the mobile app.</p>
              </div>
            </div>
            <div class="panel-body padded" id="settingsBody"></div>
          </div>
        </section>

        <section data-page-panel="push" class="hidden">
          <div class="grid-2">
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h3>Compose push</h3>
                  <p class="muted" style="margin-top:4px;font-size:.82rem">Send Expo push notifications to targeted app users.</p>
                </div>
              </div>
              <div class="panel-body padded" id="pushComposeBody"></div>
            </div>
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h3>Quick templates</h3>
                  <p class="muted" style="margin-top:4px;font-size:.82rem">One-click templates — tap to fill the form.</p>
                </div>
              </div>
              <div class="panel-body padded" id="pushTemplatesBody"></div>
            </div>
          </div>
        </section>

        <section data-page-panel="emails" class="hidden">
          <div class="grid-2">
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h3>Email templates</h3>
                  <p class="muted" style="margin-top:4px;font-size:.82rem">Preview ZeptoMail templates. Edit HTML in <code>src/emails/templates/</code>.</p>
                </div>
              </div>
              <div class="panel-body padded" id="emailTemplatesBody"></div>
            </div>
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h3>Live preview</h3>
                  <p class="muted" style="margin-top:4px;font-size:.82rem">Sample data — production sends real user values.</p>
                </div>
              </div>
              <div class="panel-body padded" style="padding-top:0">
                <iframe id="emailPreviewFrame" title="Email preview" class="email-preview-frame"></iframe>
              </div>
            </div>
          </div>
        </section>

        <section data-page-panel="webhooks" class="hidden">
          <div class="panel">
            <div class="panel-header">
              <div>
                <h3>Webhook logs</h3>
                <p class="muted" style="margin-top:4px;font-size:.82rem">Payment and provider webhook events for debugging.</p>
              </div>
            </div>
            <div class="filter-bar">
              <select class="select select-inline" id="webhookProvider">
                <option value="">All providers</option>
                <option value="nyra">Nyra</option>
                <option value="budpay">BudPay</option>
              </select>
              <select class="select select-inline" id="webhookProcessed">
                <option value="">All statuses</option>
                <option value="true">Processed</option>
                <option value="false">Failed / pending</option>
              </select>
              <button class="btn btn-primary btn-sm" id="webhookFilterBtn">Filter</button>
            </div>
            <div class="panel-body padded" id="webhooksTableWrap"></div>
          </div>
        </section>
      </main>
    </div>
  </div>

  <div id="modal" class="modal-backdrop hidden"></div>
  <div id="toast" class="toast hidden"></div>

  <script>${getAdminDashboardScript(base)}</script>
</body>
</html>`;
}
