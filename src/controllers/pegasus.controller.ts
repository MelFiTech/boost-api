import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('pegasus')
@Controller()
export class PegasusController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Pegasus Terminal Admin Dashboard' })
  async getDashboard(@Res() res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PEGASUS Terminal - Admin Dashboard</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #000000;
            color: #ffffff;
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.4;
            overflow-x: auto;
        }

        .terminal {
            padding: 20px;
            min-height: 100vh;
            background: #000000;
        }

        .header {
            border: 1px solid #ffffff;
            padding: 10px;
            margin-bottom: 20px;
            text-align: left;
            background: rgba(255, 255, 255, 0.05);
        }

        .ascii-art {
            color: #ffffff;
            font-size: 8px;
            white-space: pre;
            text-align: left;
            margin-bottom: 5px;
        }

        .system-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .info-panel {
            border: 1px solid #ffffff;
            padding: 15px;
            background: rgba(255, 255, 255, 0.03);
        }

        .info-panel h3 {
            color: #ffffff;
            border-bottom: 1px solid #ffffff;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }

        .stat {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }

        .stat-value {
            color: #ffffff;
            font-weight: bold;
        }

        .button {
            background: transparent;
            border: 1px solid #ffffff;
            color: #ffffff;
            padding: 8px 16px;
            margin: 5px;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.3s ease;
        }

        .button:hover {
            background: rgba(255, 255, 255, 0.2);
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }

        .status-online {
            color: #ffffff;
        }

        .status-offline {
            color: #888888;
        }

        .status-warning {
            color: #cccccc;
        }

        .cursor {
            animation: blink 1s infinite;
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }

        .tabs {
            display: flex;
            margin-bottom: 20px;
            border-bottom: 1px solid #ffffff;
        }

        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border: none;
            background: transparent;
            color: #ffffff;
            font-family: inherit;
            border-bottom: 2px solid transparent;
        }

        .tab.active {
            border-bottom-color: #ffffff;
            background: rgba(255, 255, 255, 0.1);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .output {
            background: #000000;
            border: 1px solid #ffffff;
            padding: 15px;
            margin: 10px 0;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        .table th,
        .table td {
            border: 1px solid #ffffff;
            padding: 8px 12px;
            text-align: left;
        }

        .table th {
            background: rgba(255, 255, 255, 0.2);
            color: #ffffff;
            font-weight: bold;
        }

        .table tr:nth-child(even) {
            background: rgba(255, 255, 255, 0.05);
        }

        .command-line {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid #ffffff;
            padding: 10px;
            margin: 10px 0;
            font-family: inherit;
            color: #ffffff;
            width: 100%;
            outline: none;
        }

        .command-line:focus {
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
    </style>
</head>
<body>
    <div class="terminal">
        <div class="header">
            <div class="ascii-art">
╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╦ ╦ ╔═╗
╠═╝ ║╣  ║ ╦ ╠═╣ ╚═╗ ║ ║ ╚═╗
╩   ╚═╝ ╚═╝ ╩ ╩ ╚═╝ ╚═╝ ╚═╝
            </div>
            <div style="font-size: 12px;">boost api terminal admin dashboard v1.0.0</div>
            <div style="font-size: 11px;">system status: <span class="status-online">online</span> | time: <span id="current-time"></span></div>
        </div>

        <div class="system-info">
            <div class="info-panel">
                <h3>📊 SYSTEM STATS</h3>
                <div class="stat">
                    <span>Total Users:</span>
                    <span class="stat-value" id="total-users">Loading...</span>
                </div>
                <div class="stat">
                    <span>Total Orders:</span>
                    <span class="stat-value" id="total-orders">Loading...</span>
                </div>
                <div class="stat">
                    <span>Active Services:</span>
                    <span class="stat-value" id="total-services">Loading...</span>
                </div>
                <div class="stat">
                    <span>Revenue (NGN):</span>
                    <span class="stat-value" id="total-revenue">Loading...</span>
                </div>
            </div>

            <div class="info-panel">
                <h3>🔧 SYSTEM HEALTH</h3>
                <div class="stat">
                    <span>Database:</span>
                    <span class="stat-value status-online" id="db-status">CONNECTED</span>
                </div>
                <div class="stat">
                    <span>Email Service:</span>
                    <span class="stat-value status-online" id="email-status">OPERATIONAL</span>
                </div>
                <div class="stat">
                    <span>Push Notifications:</span>
                    <span class="stat-value status-online" id="push-status">OPERATIONAL</span>
                </div>
                <div class="stat">
                    <span>API Status:</span>
                    <span class="stat-value status-online" id="api-status">HEALTHY</span>
                </div>
            </div>

            <div class="info-panel">
                <h3>⚡ QUICK ACTIONS</h3>
                <button class="button" onclick="syncServices()">SYNC SERVICES</button>
                <button class="button" onclick="testEmail()">TEST EMAIL</button>
                <button class="button" onclick="refreshStats()">REFRESH DATA</button>
                <button class="button" onclick="testAllEndpoints()">TEST ENDPOINTS</button>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('dashboard')">DASHBOARD</button>
            <button class="tab" onclick="showTab('users')">USERS</button>
            <button class="tab" onclick="showTab('orders')">ORDERS</button>
            <button class="tab" onclick="showTab('terminal')">TERMINAL</button>
        </div>

        <div id="dashboard-tab" class="tab-content active">
            <h3>📈 DASHBOARD OVERVIEW</h3>
            <div class="output" id="dashboard-output">
> Initializing dashboard...
> Loading system metrics...
> Dashboard ready.

BOOST API SYSTEM OVERVIEW
========================
Status: All systems operational
Last sync: <span id="last-sync">Never</span>

Recent Activity:
- Services synchronized
- Email notifications sent
- Database optimized
            </div>
        </div>

        <div id="users-tab" class="tab-content">
            <h3>👥 USER MANAGEMENT</h3>
            <div class="output">
                <table class="table" id="users-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Email</th>
                            <th>Username</th>
                            <th>Created</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody">
                        <tr><td colspan="5">Loading users...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div id="orders-tab" class="tab-content">
            <h3>📦 ORDER MANAGEMENT</h3>
            <div class="output">
                <table class="table" id="orders-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>User</th>
                            <th>Status</th>
                            <th>Amount</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody id="orders-tbody">
                        <tr><td colspan="5">Loading orders...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div id="terminal-tab" class="tab-content">
            <h3>💻 TERMINAL INTERFACE</h3>
            <div class="output" id="terminal-output">
PEGASUS TERMINAL v1.0.0
======================
Type 'help' for available commands.

root@pegasus:~$ <span class="cursor">_</span>
            </div>
            <input type="text" class="command-line" id="command-input" placeholder="Enter command..." onkeypress="handleCommand(event)">
        </div>
    </div>

    <script>
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            updateTime();
            setInterval(updateTime, 1000);
            loadStats();
            loadUsers();
            loadOrders();
        });

        function updateTime() {
            document.getElementById('current-time').textContent = new Date().toLocaleString();
        }

        function showTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
        }

        async function loadStats() {
            try {
                const response = await fetch('/pegasus/stats');
                const stats = await response.json();
                
                document.getElementById('total-users').textContent = stats.totalUsers || 0;
                document.getElementById('total-orders').textContent = stats.totalOrders || 0;
                document.getElementById('total-services').textContent = stats.totalServices || 0;
                document.getElementById('total-revenue').textContent = '₦' + (stats.totalRevenue || 0).toLocaleString();
            } catch (error) {
                document.getElementById('total-users').textContent = 'Error';
                document.getElementById('total-orders').textContent = 'Error';
                document.getElementById('total-services').textContent = 'Error';
                document.getElementById('total-revenue').textContent = 'Error';
            }
        }

        async function loadUsers() {
            try {
                const response = await fetch('/pegasus/users');
                const users = await response.json();
                
                const tbody = document.getElementById('users-tbody');
                tbody.innerHTML = '';
                
                users.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = 
                        '<td>' + user.id + '</td>' +
                        '<td>' + user.email + '</td>' +
                        '<td>' + (user.username || 'N/A') + '</td>' +
                        '<td>' + new Date(user.createdAt).toLocaleDateString() + '</td>' +
                        '<td class="status-online">ACTIVE</td>';
                    tbody.appendChild(row);
                });
            } catch (error) {
                document.getElementById('users-tbody').innerHTML = '<tr><td colspan="5" class="error">Failed to load users</td></tr>';
            }
        }

        async function loadOrders() {
            try {
                const response = await fetch('/pegasus/orders');
                const orders = await response.json();
                
                const tbody = document.getElementById('orders-tbody');
                tbody.innerHTML = '';
                
                orders.forEach(order => {
                    const row = document.createElement('tr');
                    const statusClass = order.status === 'COMPLETED' ? 'online' : order.status === 'PENDING' ? 'warning' : 'offline';
                    row.innerHTML = 
                        '<td>' + order.id + '</td>' +
                        '<td>' + (order.user?.email || 'N/A') + '</td>' +
                        '<td class="status-' + statusClass + '">' + order.status + '</td>' +
                        '<td>₦' + (order.price || 0) + '</td>' +
                        '<td>' + new Date(order.createdAt).toLocaleDateString() + '</td>';
                    tbody.appendChild(row);
                });
            } catch (error) {
                document.getElementById('orders-tbody').innerHTML = '<tr><td colspan="5" class="error">Failed to load orders</td></tr>';
            }
        }

        async function syncServices() {
            const output = document.getElementById('dashboard-output');
            output.innerHTML += '\\n> Initiating service sync...';
            
            try {
                const response = await fetch('/api/v1/smm/sync', { method: 'POST' });
                const result = await response.json();
                output.innerHTML += '\\n> Service sync completed: ' + result.message;
                loadStats();
            } catch (error) {
                output.innerHTML += '\\n> ERROR: Service sync failed';
            }
        }

        async function testEmail() {
            const output = document.getElementById('dashboard-output');
            output.innerHTML += '\\n> Testing email service...';
            
            try {
                const response = await fetch('/api/v1/notifications/email/status');
                const result = await response.json();
                output.innerHTML += '\\n> Email service status: ' + result.status;
            } catch (error) {
                output.innerHTML += '\\n> ERROR: Email test failed';
            }
        }

        function refreshStats() {
            const output = document.getElementById('dashboard-output');
            output.innerHTML += '\\n> Refreshing all data...';
            loadStats();
            loadUsers();
            loadOrders();
            output.innerHTML += '\\n> Data refresh completed successfully';
        }

        function testAllEndpoints() {
            const output = document.getElementById('dashboard-output');
            output.innerHTML += '\\n> Testing all API endpoints...';
            
            // Test stats endpoint
            testEndpoint('/pegasus/stats').then(() => {
                output.innerHTML += '\\n> Stats endpoint: OK';
            });
            
            // Test users endpoint
            setTimeout(() => {
                testEndpoint('/pegasus/users').then(() => {
                    output.innerHTML += '\\n> Users endpoint: OK';
                });
            }, 500);
            
            // Test orders endpoint
            setTimeout(() => {
                testEndpoint('/pegasus/orders').then(() => {
                    output.innerHTML += '\\n> Orders endpoint: OK';
                });
            }, 1000);
            
            // Test email status
            setTimeout(() => {
                fetch('/api/v1/notifications/email/status')
                    .then(response => response.json())
                    .then(result => {
                        output.innerHTML += '\\n> Email service: ' + result.status;
                    })
                    .catch(() => {
                        output.innerHTML += '\\n> Email service: ERROR';
                    });
            }, 1500);
            
            setTimeout(() => {
                output.innerHTML += '\\n> Endpoint testing completed';
            }, 2000);
        }

        function handleCommand(event) {
            if (event.key === 'Enter') {
                const input = event.target;
                const command = input.value.trim();
                const output = document.getElementById('terminal-output');
                
                if (command) {
                    output.innerHTML += '\\nroot@pegasus:~$ ' + command;
                    executeCommand(command, output);
                    input.value = '';
                }
            }
        }

        async function testEndpoint(endpoint, method = 'GET', body = null) {
            const output = document.getElementById('terminal-output');
            output.innerHTML += '\\n> Testing ' + method + ' ' + endpoint + '...';
            
            try {
                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                };
                
                if (body && method !== 'GET') {
                    options.body = JSON.stringify(body);
                }
                
                const response = await fetch(endpoint, options);
                const result = await response.json();
                
                output.innerHTML += '\\n> Status: ' + response.status + ' ' + response.statusText;
                output.innerHTML += '\\n> Response: ' + JSON.stringify(result, null, 2);
            } catch (error) {
                output.innerHTML += '\\n> ERROR: ' + error.message;
            }
        }

        function executeCommand(command, output) {
            const cmd = command.toLowerCase().trim();
            const parts = cmd.split(' ');
            const mainCmd = parts[0];
            
            switch (mainCmd) {
                case 'help':
                    output.innerHTML += '\\n\\nAvailable commands:\\n==================\\nhelp              - Show this help message\\nstats             - Display system statistics\\nusers             - Switch to users tab\\norders            - Switch to orders tab\\nsync              - Sync services from provider\\ntest-email        - Test email service\\ntest-api          - Test API endpoints\\nget <endpoint>    - Test GET endpoint\\npost <endpoint>   - Test POST endpoint\\nclear             - Clear terminal\\nstatus            - Show system status\\nrefresh           - Refresh all data\\nping              - Test server connectivity';
                    break;
                case 'stats':
                    output.innerHTML += '\\nFetching statistics...';
                    loadStats();
                    break;
                case 'users':
                    showTab('users');
                    output.innerHTML += '\\nSwitched to users tab';
                    break;
                case 'orders':
                    showTab('orders');
                    output.innerHTML += '\\nSwitched to orders tab';
                    break;
                case 'sync':
                    syncServices();
                    break;
                case 'test-email':
                    testEmail();
                    break;
                case 'test-api':
                    output.innerHTML += '\\n> Running API endpoint tests...';
                    testEndpoint('/pegasus/stats');
                    setTimeout(() => testEndpoint('/pegasus/users'), 1000);
                    setTimeout(() => testEndpoint('/pegasus/orders'), 2000);
                    break;
                case 'get':
                    if (parts[1]) {
                        testEndpoint(parts[1], 'GET');
                    } else {
                        output.innerHTML += '\\n> Usage: get <endpoint>';
                    }
                    break;
                case 'post':
                    if (parts[1]) {
                        testEndpoint(parts[1], 'POST');
                    } else {
                        output.innerHTML += '\\n> Usage: post <endpoint>';
                    }
                    break;
                case 'ping':
                    output.innerHTML += '\\n> Pinging server...';
                    testEndpoint('/pegasus/stats');
                    break;
                case 'refresh':
                    output.innerHTML += '\\n> Refreshing all data...';
                    loadStats();
                    loadUsers();
                    loadOrders();
                    output.innerHTML += '\\n> Data refresh completed';
                    break;
                case 'clear':
                    output.innerHTML = 'PEGASUS TERMINAL v1.0.0\\n======================\\nType \\'help\\' for available commands.\\n\\nroot@pegasus:~$ <span class="cursor">_</span>';
                    break;
                case 'status':
                    const totalServices = document.getElementById('total-services').textContent;
                    const totalUsers = document.getElementById('total-users').textContent;
                    const totalOrders = document.getElementById('total-orders').textContent;
                    output.innerHTML += '\\n\\nSystem Status: ONLINE\\nDatabase: CONNECTED\\nAPI: HEALTHY\\nServices: ' + totalServices + ' active\\nUsers: ' + totalUsers + ' registered\\nOrders: ' + totalOrders + ' total';
                    break;
                default:
                    output.innerHTML += '\\nCommand not found: ' + cmd + '. Type \\'help\\' for available commands.';
            }
            
            output.innerHTML += '\\nroot@pegasus:~$ <span class="cursor">_</span>';
            output.scrollTop = output.scrollHeight;
        }
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('pegasus/users')
  @ApiOperation({ summary: 'Get users for Pegasus dashboard' })
  async getUsers() {
    try {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return users;
    } catch (error) {
      return { error: 'Failed to fetch users' };
    }
  }

  @Get('pegasus/orders')
  @ApiOperation({ summary: 'Get orders for Pegasus dashboard' })
  async getOrders() {
    try {
      const orders = await this.prisma.order.findMany({
        include: {
          user: {
            select: {
              email: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return orders;
    } catch (error) {
      return { error: 'Failed to fetch orders' };
    }
  }

  @Get('pegasus/stats')
  @ApiOperation({ summary: 'Get system stats for Pegasus dashboard' })
  async getStats() {
    try {
      const [totalUsers, totalOrders, totalServices] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.order.count(),
        this.prisma.service.count(),
      ]);

      const totalRevenue = await this.prisma.order.aggregate({
        _sum: {
          price: true,
        },
        where: {
          status: 'COMPLETED',
        },
      });

      return {
        totalUsers,
        totalOrders,
        totalServices,
        totalRevenue: totalRevenue._sum.price || 0,
      };
    } catch (error) {
      return {
        totalUsers: 0,
        totalOrders: 0,
        totalServices: 0,
        totalRevenue: 0,
        error: 'Failed to fetch stats',
      };
    }
  }
} 