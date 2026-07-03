export const ADMIN_DASHBOARD_STYLES = `
:root {
  --bg: #050505;
  --bg-elevated: #0c0c0c;
  --panel: #111111;
  --panel-hover: #161616;
  --border: #222222;
  --border-light: #2e2e2e;
  --text: #f8fafc;
  --muted: #94a3b8;
  --lime: #d9ff02;
  --lime-soft: rgba(217, 255, 2, 0.12);
  --lime-dim: #b8d602;
  --danger: #ef4444;
  --danger-soft: rgba(239, 68, 68, 0.12);
  --success: #22c55e;
  --success-soft: rgba(34, 197, 94, 0.12);
  --warn: #f59e0b;
  --warn-soft: rgba(245, 158, 11, 0.12);
  --sidebar-width: 200px;
  --sidebar-collapsed: 52px;
  --header-height: 56px;
  --radius: 14px;
  --shadow: 0 10px 40px rgba(0,0,0,.35);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body {
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
button, input, textarea, select { font: inherit; }
.hidden { display: none !important; }

/* Login */
.login-screen {
  min-height: 100vh; display: grid; place-items: center;
  background:
    radial-gradient(circle at top right, rgba(217,255,2,.08), transparent 30%),
    radial-gradient(circle at bottom left, rgba(217,255,2,.04), transparent 25%),
    var(--bg);
  padding: 24px;
}
.login-card {
  width: 100%; max-width: 420px; background: var(--panel);
  border: 1px solid var(--border); border-radius: 20px; padding: 32px;
  box-shadow: var(--shadow);
}
.login-brand { text-align: center; margin-bottom: 28px; }
.login-brand img { height: 42px; width: auto; margin-bottom: 14px; }
.login-brand h1 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; }
.login-brand p { color: var(--muted); font-size: 0.9rem; margin-top: 6px; }

/* App shell */
.app-shell { display: flex; height: 100vh; width: 100vw; overflow: hidden; }
.sidebar {
  width: var(--sidebar-width); flex-shrink: 0; background: var(--bg-elevated);
  border-right: 1px solid var(--border); display: flex; flex-direction: column;
  transition: width .22s ease;
}
.sidebar.collapsed { width: var(--sidebar-collapsed); }
.sidebar-top {
  height: var(--header-height); display: flex; align-items: center;
  gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sidebar-top .sidebar-logo { height: 24px; width: auto; flex-shrink: 0; }
.sidebar-top .brand-text {
  font-weight: 700; font-size: 0.88rem; white-space: nowrap; overflow: hidden;
  transition: opacity .2s, width .2s;
}
.sidebar.collapsed .sidebar-top {
  justify-content: center; padding: 0 10px; gap: 0;
}
.sidebar.collapsed .sidebar-logo,
.sidebar.collapsed .brand-text { display: none; }
.sidebar.collapsed .nav-label,
.sidebar.collapsed .nav-section { opacity: 0; width: 0; overflow: hidden; }
.sidebar-toggle {
  margin-left: auto; background: transparent; border: 1px solid var(--border);
  color: var(--text); width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
  display: grid; place-items: center; flex-shrink: 0;
  transition: color .15s, border-color .15s, background .15s;
}
.sidebar-toggle:hover { background: var(--panel); border-color: var(--border-light); color: var(--lime); }
.sidebar.collapsed .sidebar-toggle { margin-left: 0; }
.sidebar.collapsed .nav-item { justify-content: center; padding: 11px 8px; }
.sidebar.collapsed .nav-icon { margin: 0; }
.sidebar.collapsed .sidebar-footer .nav-label-text { display: none; }
.sidebar.collapsed .sidebar-footer .btn { padding: 7px; justify-content: center; }
.nav { flex: 1; padding: 10px 8px; overflow-y: auto; }
.nav-section {
  font-size: 0.62rem; text-transform: uppercase; letter-spacing: .08em;
  color: var(--muted); padding: 6px 10px 6px; transition: opacity .2s;
}
.nav-item {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border: none; background: transparent; color: var(--muted);
  border-radius: 8px; cursor: pointer; margin-bottom: 2px; text-align: left;
  transition: background .15s, color .15s; font-size: 0.84rem;
}
.nav-item:hover { background: var(--panel); color: var(--text); }
.nav-item.active { background: var(--lime-soft); color: var(--lime); font-weight: 600; }
.nav-icon {
  width: 20px; height: 20px; display: grid; place-items: center; flex-shrink: 0;
}
.nav-icon i, .sidebar-toggle i, .btn > i.ph {
  font-size: 1.05rem; line-height: 1; display: block;
}
.nav-item.active .nav-icon i { color: var(--lime); }
.sidebar-footer {
  padding: 10px 8px; border-top: 1px solid var(--border);
}
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg); }
.topbar {
  height: var(--header-height); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px; background: rgba(5,5,5,.85); backdrop-filter: blur(10px);
}
.topbar h2 { font-size: 1.15rem; font-weight: 650; letter-spacing: -0.02em; }
.topbar-actions { display: flex; align-items: center; gap: 10px; }
.content { flex: 1; overflow: auto; padding: 24px 28px 32px; }

/* Components */
.grid-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}
.grid-metrics-wide {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
.dashboard-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border);
}
.period-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.period-tabs .tab { margin: 0; }
.custom-range {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.custom-range .input-inline { max-width: 150px; min-width: 130px; }
.period-label { font-size: 0.82rem; margin-left: auto; }
.metric-card .hint { color: var(--muted); font-size: 0.72rem; margin-top: auto; }
.metric-card.provider { border-color: rgba(96,165,250,.2); }
.metric-card.wallet { border-color: rgba(52,211,153,.2); }
.metric-card.fees { border-color: rgba(217,255,2,.2); }
.metric-card {
  background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 10px 14px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
}
.metric-card .label {
  color: var(--muted); font-size: 0.68rem; text-transform: uppercase;
  letter-spacing: .06em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  width: 100%;
}
.metric-card .value {
  font-size: 1.32rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1;
  white-space: nowrap; width: 100%;
}
.metric-card .sub { display: none; }
.metric-card.accent { border-color: rgba(217,255,2,.25); background: linear-gradient(90deg, rgba(217,255,2,.06), var(--panel)); }
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; margin-bottom: 20px;
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 18px; border-bottom: 1px solid var(--border);
}
.panel-header h3 { font-size: 0.95rem; font-weight: 650; }
.panel-body { padding: 0; }
.panel-body.padded { padding: 18px; }
.grid-2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
@media (max-width: 1100px) { .grid-2 { grid-template-columns: 1fr; } }

label.field-label { display: block; font-size: 0.78rem; color: var(--muted); margin-bottom: 6px; }
.input, .textarea, .select {
  width: 100%; background: #0a0a0a; border: 1px solid var(--border);
  color: var(--text); border-radius: 10px; padding: 10px 12px;
}
.textarea { min-height: 88px; resize: vertical; }
.input { margin-bottom: 14px; }

.btn {
  border: none; border-radius: 10px; padding: 10px 14px; font-weight: 600;
  cursor: pointer; font-size: 0.84rem; display: inline-flex; align-items: center; gap: 8px;
}
.btn-primary { background: var(--lime); color: #000; }
.btn-primary:hover { background: var(--lime-dim); }
.btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--panel-hover); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-success { background: var(--success); color: #000; }
.btn-sm { padding: 7px 10px; font-size: 0.76rem; border-radius: 8px; }
.btn-link { background: none; border: none; color: var(--lime); cursor: pointer; padding: 0; }

.tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 14px 18px 0; }
.tab {
  background: transparent; border: 1px solid var(--border); color: var(--muted);
  padding: 7px 12px; border-radius: 999px; cursor: pointer; font-size: 0.78rem;
}
.tab.active { background: var(--lime); color: #000; border-color: var(--lime); font-weight: 700; }

.table-wrap { overflow: auto; }
table.data-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 720px; }
table.data-table thead th {
  position: sticky; top: 0; z-index: 1; background: #121212;
  text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: .07em;
  color: var(--muted); padding: 12px 16px; border-bottom: 1px solid var(--border);
}
table.data-table tbody td {
  padding: 14px 16px; border-bottom: 1px solid var(--border); font-size: 0.86rem; vertical-align: middle;
}
table.data-table tbody tr:hover td { background: var(--panel-hover); }
table.data-table tbody tr:last-child td { border-bottom: none; }
.cell-title { font-weight: 600; }
.cell-sub { color: var(--muted); font-size: 0.78rem; margin-top: 2px; }

.badge {
  display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px;
  font-size: 0.7rem; font-weight: 700; letter-spacing: .02em; text-transform: uppercase;
}
.badge-pending, .badge-pending_review, .badge-processing { background: var(--warn-soft); color: var(--warn); }
.badge-verified, .badge-completed, .badge-approved { background: var(--success-soft); color: var(--success); }
.badge-rejected, .badge-failed, .badge-cancelled { background: var(--danger-soft); color: var(--danger); }

.status-bars { display: grid; gap: 10px; padding: 18px; }
.status-row { display: grid; grid-template-columns: 90px 1fr 40px; gap: 10px; align-items: center; font-size: 0.82rem; }
.status-track { height: 8px; background: #1a1a1a; border-radius: 999px; overflow: hidden; }
.status-fill { height: 100%; background: var(--lime); border-radius: 999px; }

.empty { padding: 28px; text-align: center; color: var(--muted); font-size: 0.9rem; }
.loading { padding: 28px; text-align: center; color: var(--muted); }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.72); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100;
}
.modal {
  width: 100%; max-width: 720px; max-height: 90vh; overflow: auto;
  background: var(--panel); border: 1px solid var(--border); border-radius: 18px;
  box-shadow: var(--shadow);
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid var(--border);
}
.modal-body { padding: 20px; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.detail-grid .full { grid-column: 1 / -1; }
pre.json {
  background: #0a0a0a; border: 1px solid var(--border); border-radius: 10px;
  padding: 12px; overflow: auto; font-size: 0.74rem; color: #cbd5e1;
}
.toast {
  position: fixed; right: 20px; bottom: 20px; background: var(--panel);
  border: 1px solid var(--border); padding: 12px 16px; border-radius: 10px; z-index: 200;
  box-shadow: var(--shadow);
}
.toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.muted { color: var(--muted); }

.filter-bar {
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
}
.input-inline, .select-inline {
  width: auto; flex: 1; min-width: 140px; margin-bottom: 0;
}
.select-inline { max-width: 180px; }
.pagination {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border);
}
.pagination .muted { font-size: 0.82rem; }

.config-card {
  background: #0a0a0a; border: 1px solid var(--border); border-radius: 12px;
  padding: 16px; margin-bottom: 12px;
}
.config-card h4 { font-size: 0.9rem; margin-bottom: 6px; }
.config-card p { color: var(--muted); font-size: 0.82rem; margin-bottom: 12px; }
.config-card.active { border-color: rgba(217,255,2,.3); background: var(--lime-soft); }

.flag-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 16px 0; border-bottom: 1px solid var(--border);
}
.flag-row:last-child { border-bottom: none; }
.flag-info h4 { font-size: 0.92rem; margin-bottom: 4px; }
.flag-info p { color: var(--muted); font-size: 0.82rem; }

.toggle {
  position: relative; width: 46px; height: 26px; flex-shrink: 0;
  background: #2a2a2a; border-radius: 999px; border: 1px solid var(--border);
  cursor: pointer; transition: background .2s;
}
.toggle.on { background: var(--lime); border-color: var(--lime); }
.toggle::after {
  content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
  background: #fff; border-radius: 50%; transition: transform .2s;
}
.toggle.on::after { transform: translateX(20px); background: #000; }

.health-grid { display: grid; gap: 10px; }
.health-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 0.86rem;
}
.health-item:last-child { border-bottom: none; }
.progress-mini {
  height: 6px; background: #1a1a1a; border-radius: 999px; overflow: hidden; margin-top: 6px;
}
.progress-mini-fill { height: 100%; background: var(--lime); border-radius: 999px; }

.quick-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 20px; }
.quick-link {
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  padding: 14px; cursor: pointer; text-align: left; color: var(--text);
  transition: border-color .15s, background .15s;
}
.quick-link:hover { border-color: rgba(217,255,2,.3); background: var(--panel-hover); }
.quick-link strong { display: block; font-size: 0.88rem; margin-bottom: 4px; }
.quick-link span { color: var(--muted); font-size: 0.76rem; }

@media (max-width: 800px) {
  .sidebar { position: absolute; z-index: 50; height: 100%; box-shadow: var(--shadow); }
  .sidebar.collapsed { transform: translateX(-100%); width: var(--sidebar-width); }
  .content { padding: 16px; }
  .detail-grid { grid-template-columns: 1fr; }
}
`;
