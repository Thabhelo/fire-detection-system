// Fire Detection System Dashboard JavaScript
// Advanced monitoring system for Nqobizitha Moyo's final year project

// Global variables and state management
let dashboardState = {
    activeTab: 'overview',
    devices: [],
    sensorData: {},
    alerts: [],
    map: null,
    charts: {},
    intervals: {},
    settings: {
        updateInterval: 3000,
        alertThresholds: {
            gasLPG: 400,
            gasSmoke: 300,
            temperature: 45,
            flameIR: 2.5,
            flameUV: 2.0
        },
        notifications: {
            email: true,
            sms: true,
            push: true
        }
    }
};

// Risk assessment thresholds (based on LLD specifications)
const RISK_THRESHOLDS = {
    GAS_THRESHOLD_CRITICAL: 1000,
    SMOKE_THRESHOLD_CRITICAL: 800,
    TEMP_THRESHOLD_HIGH: 50,
    FLAME_IR_THRESHOLD: 3.0,
    FLAME_UV_THRESHOLD: 2.5
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// Main initialization function
function initializeDashboard() {
    console.log('🔥 Initializing Fire Detection System Dashboard...');
    
    // Initialize components
    initializeTabNavigation();
    initializeDevices();
    initializeSensorData();
    initializeMap();
    initializeCharts();
    initializeAlerts();
    initializeSettings();
    
    // Start real-time updates
    startRealTimeUpdates();
    
    // Initial data load
    updateDashboard();
    
    console.log('✅ Dashboard initialized successfully');
}

// Tab Navigation
function initializeTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    dashboardState.activeTab = tabName;
    
    // Handle tab-specific initialization
    switch(tabName) {
        case 'map':
            if (dashboardState.map) {
                setTimeout(() => dashboardState.map.invalidateSize(), 100);
            }
            break;
        case 'analytics':
            updateCharts();
            break;
        case 'devices':
            updateDevicesGrid();
            break;
        case 'alerts':
            updateAlertsTable();
            break;
        case 'settings':
            updateSettingsContent();
            break;
    }
}

// Device Management
function initializeDevices() {
    // Simulate device data (based on LLD specifications)
    dashboardState.devices = [
        {
            id: 'FD-001',
            name: 'Zone A - Main Gate',
            type: 'ESP32-S3',
            location: { lat: -25.7479, lng: 28.2293 },
            status: 'online',
            battery: 78,
            lastSeen: new Date(),
            sensors: ['gas', 'flame', 'temperature', 'wind'],
            riskLevel: 'safe',
            firmware: 'v2.1.0'
        },
        {
            id: 'FD-002',
            name: 'Zone B - Storage Area',
            type: 'ESP32-S3',
            location: { lat: -25.7489, lng: 28.2303 },
            status: 'online',
            battery: 92,
            lastSeen: new Date(),
            sensors: ['gas', 'flame', 'temperature'],
            riskLevel: 'low',
            firmware: 'v2.1.0'
        },
        {
            id: 'FD-003',
            name: 'Zone C - Processing Unit',
            type: 'ESP32-S3',
            location: { lat: -25.7469, lng: 28.2283 },
            status: 'warning',
            battery: 45,
            lastSeen: new Date(Date.now() - 300000), // 5 minutes ago
            sensors: ['gas', 'flame', 'temperature', 'wind'],
            riskLevel: 'medium',
            firmware: 'v2.0.9'
        }
    ];
}

// Sensor Data Simulation
function initializeSensorData() {
    dashboardState.sensorData = {
        timestamp: new Date(),
        gasLPG: 45,
        gasSmoke: 23,
        temperature: 24.5,
        humidity: 65,
        flameIR: 0.2,
        flameUV: 0.1,
        flameDetected: false,
        windSpeed: 12,
        windDirection: 45,
        batteryLevel: 78,
        solarPower: 15.2,
        gpsQuality: 8,
        commStatus: {
            lte: true,
            lora: true,
            wifi: true
        }
    };
}

// Real-time sensor data updates with realistic patterns
function generateSensorData() {
    const currentTime = new Date();
    const timeOfDay = currentTime.getHours();
    const data = dashboardState.sensorData;
    
    // Temperature varies with time of day
    const baseTemp = 20 + Math.sin((timeOfDay - 6) * Math.PI / 12) * 10;
    data.temperature = baseTemp + (Math.random() - 0.5) * 2;
    data.temperature = Math.max(0, Math.min(50, data.temperature));
    
    // Humidity inversely related to temperature
    data.humidity = 80 - (data.temperature - 20) * 1.5 + (Math.random() - 0.5) * 10;
    data.humidity = Math.max(10, Math.min(100, data.humidity));
    
    // Gas readings with occasional spikes
    data.gasLPG = 30 + Math.random() * 40 + (Math.random() < 0.05 ? Math.random() * 200 : 0);
    data.gasSmoke = 15 + Math.random() * 30 + (Math.random() < 0.03 ? Math.random() * 150 : 0);
    
    // Flame sensor baseline with noise
    data.flameIR = 0.1 + Math.random() * 0.3;
    data.flameUV = 0.05 + Math.random() * 0.15;
    data.flameDetected = (data.flameIR > 2.5 && data.flameUV > 2.0);
    
    // Wind conditions
    data.windSpeed = 5 + Math.random() * 20;
    data.windDirection = (data.windDirection + (Math.random() - 0.5) * 10) % 360;
    if (data.windDirection < 0) data.windDirection += 360;
    
    // Power system simulation
    const solarMultiplier = Math.max(0, Math.sin((timeOfDay - 6) * Math.PI / 12));
    data.solarPower = solarMultiplier * 20 * (0.8 + Math.random() * 0.4);
    
    // Battery discharge/charge simulation
    const powerConsumption = 0.4; // 400mA average
    const solarCharging = data.solarPower / 14.8; // Convert to charging current
    const netCurrent = solarCharging - powerConsumption;
    const batteryChange = netCurrent * (dashboardState.settings.updateInterval / 1000) / 3600 / 5; // 5Ah battery
    data.batteryLevel = Math.max(0, Math.min(100, data.batteryLevel + batteryChange));
    
    // Communication status (occasional dropouts)
    data.commStatus.lte = Math.random() > 0.02;
    data.commStatus.lora = Math.random() > 0.01;
    data.commStatus.wifi = Math.random() > 0.05;
    
    data.timestamp = currentTime;
    
    return data;
}

// Risk Assessment Algorithm (based on LLD)
function calculateRiskLevel(data) {
    let riskScore = 0.0;
    
    // Gas concentration risk (weighted)
    riskScore += (data.gasLPG / RISK_THRESHOLDS.GAS_THRESHOLD_CRITICAL) * 0.4;
    riskScore += (data.gasSmoke / RISK_THRESHOLDS.SMOKE_THRESHOLD_CRITICAL) * 0.3;
    
    // Temperature risk
    if (data.temperature > RISK_THRESHOLDS.TEMP_THRESHOLD_HIGH) {
        riskScore += ((data.temperature - RISK_THRESHOLDS.TEMP_THRESHOLD_HIGH) / 50.0) * 0.2;
    }
    
    // Flame detection (immediate critical)
    if (data.flameDetected) {
        return { level: 'CRITICAL', score: 1.0, factors: ['Flame Detected'] };
    }
    
    // Wind factor (dispersal effect)
    const windFactor = 1.0 - (data.windSpeed * 0.01);
    riskScore *= Math.max(0.5, windFactor);
    
    // Convert to discrete levels
    let level, factors = [];
    
    if (riskScore < 0.2) {
        level = 'SAFE';
    } else if (riskScore < 0.4) {
        level = 'LOW';
        factors.push('Elevated gas levels');
    } else if (riskScore < 0.6) {
        level = 'MEDIUM';
        factors.push('High gas concentration', 'Temperature rising');
    } else if (riskScore < 0.8) {
        level = 'HIGH';
        factors.push('Critical gas levels', 'High temperature');
    } else {
        level = 'CRITICAL';
        factors.push('Extreme conditions detected');
    }
    
    return { level, score: riskScore, factors };
}

// Map Integration
function initializeMap() {
    if (typeof L === 'undefined') {
        console.warn('Leaflet not loaded, skipping map initialization');
        return;
    }
    
    const mapView = document.getElementById('mapView');
    if (!mapView) return;
    
    // Initialize Leaflet map centered on Pretoria, South Africa
    dashboardState.map = L.map('mapView').setView([-25.7479, 28.2293], 15);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ' OpenStreetMap contributors'
    }).addTo(dashboardState.map);
    
    // Add device markers
    updateMapMarkers();
}

function updateMapMarkers() {
    if (!dashboardState.map) return;
    
    dashboardState.devices.forEach(device => {
        const color = getRiskColor(device.riskLevel);
        const marker = L.circleMarker([device.location.lat, device.location.lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            radius: 8
        }).addTo(dashboardState.map);
        
        const popupContent = `
            <div class="map-popup">
                <h4>${device.name}</h4>
                <p><strong>Device ID:</strong> ${device.id}</p>
                <p><strong>Status:</strong> ${device.status}</p>
                <p><strong>Risk Level:</strong> ${device.riskLevel.toUpperCase()}</p>
                <p><strong>Battery:</strong> ${device.battery}%</p>
                <p><strong>Last Seen:</strong> ${formatTime(device.lastSeen)}</p>
            </div>
        `;
        marker.bindPopup(popupContent);
    });
}

function getRiskColor(riskLevel) {
    const colors = {
        safe: '#10b981',
        low: '#84cc16',
        medium: '#f59e0b',
        high: '#f97316',
        critical: '#ef4444'
    };
    return colors[riskLevel] || '#94a3b8';
}

// Charts Integration
function initializeCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded, skipping chart initialization');
        return;
    }
    
    const chartConfigs = {
        sensorChart: {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Temperature (°C)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        fill: true
                    },
                    {
                        label: 'Gas LPG (ppm)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true
                    },
                    {
                        label: 'Humidity (%)',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true },
                    title: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        },
        riskChart: {
            type: 'doughnut',
            data: {
                labels: ['Safe', 'Low', 'Medium', 'High', 'Critical'],
                datasets: [{
                    data: [80, 12, 5, 2, 1],
                    backgroundColor: ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        },
        performanceChart: {
            type: 'bar',
            data: {
                labels: ['Uptime', 'Response Time', 'Accuracy', 'Coverage'],
                datasets: [{
                    label: 'Performance %',
                    data: [99.2, 95.8, 98.5, 97.1],
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        },
        alertChart: {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Alerts',
                    data: [2, 1, 4, 2, 3, 1, 2],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        }
    };
    
    // Initialize charts
    Object.keys(chartConfigs).forEach(chartId => {
        const canvas = document.getElementById(chartId);
        if (canvas) {
            dashboardState.charts[chartId] = new Chart(canvas, chartConfigs[chartId]);
        }
    });
}

function updateCharts() {
    // Update sensor chart with historical data
    const sensorChart = dashboardState.charts.sensorChart;
    if (sensorChart) {
        const now = new Date();
        const labels = [];
        const tempData = [];
        const gasData = [];
        const humidityData = [];
        
        // Generate 24 hours of sample data
        for (let i = 23; i >= 0; i--) {
            const time = new Date(now - i * 3600000);
            labels.push(time.getHours() + ':00');
            tempData.push(20 + Math.sin((time.getHours() - 6) * Math.PI / 12) * 8 + Math.random() * 4);
            gasData.push(30 + Math.random() * 50);
            humidityData.push(60 + Math.random() * 20);
        }
        
        sensorChart.data.labels = labels;
        sensorChart.data.datasets[0].data = tempData;
        sensorChart.data.datasets[1].data = gasData;
        sensorChart.data.datasets[2].data = humidityData;
        sensorChart.update();
    }
}

// Alert Management
function initializeAlerts() {
    dashboardState.alerts = [
        {
            id: 1,
            timestamp: new Date(Date.now() - 120000),
            device: 'FD-001',
            type: 'warning',
            message: 'Temperature threshold exceeded',
            location: 'Zone A',
            acknowledged: false,
            value: 47.2
        },
        {
            id: 2,
            timestamp: new Date(Date.now() - 900000),
            device: 'FD-003',
            type: 'info',
            message: 'Device calibration completed',
            location: 'Zone B',
            acknowledged: true,
            value: null
        },
        {
            id: 3,
            timestamp: new Date(Date.now() - 3600000),
            device: 'System',
            type: 'success',
            message: 'System test completed',
            location: 'All zones',
            acknowledged: true,
            value: null
        }
    ];
}

function addAlert(alert) {
    alert.id = Date.now();
    alert.timestamp = new Date();
    dashboardState.alerts.unshift(alert);
    
    // Check if emergency alert
    if (alert.type === 'critical') {
        showEmergencyModal(alert);
    }
    
    // Update alerts display
    updateAlertsDisplay();
}

function updateAlertsDisplay() {
    // Update recent alerts in overview
    const alertsList = document.querySelector('.alerts-list');
    if (alertsList) {
        alertsList.innerHTML = dashboardState.alerts.slice(0, 3).map(alert => `
            <div class="alert-item ${alert.type}">
                <div class="alert-icon">
                    <i class="fas ${getAlertIcon(alert.type)}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-title">${alert.message}</div>
                    <div class="alert-detail">${alert.device} - ${alert.location}</div>
                    <div class="alert-time">${formatRelativeTime(alert.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }
    
    // Update alert count in header
    const currentAlerts = document.getElementById('currentAlerts');
    if (currentAlerts) {
        const unacknowledgedCount = dashboardState.alerts.filter(a => !a.acknowledged).length;
        currentAlerts.textContent = unacknowledgedCount;
    }
}

function updateAlertsTable() {
    const tableBody = document.getElementById('alertsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = dashboardState.alerts.map(alert => `
        <tr>
            <td>${formatDateTime(alert.timestamp)}</td>
            <td>${alert.device}</td>
            <td><span class="alert-badge ${alert.type}">${alert.type.toUpperCase()}</span></td>
            <td>${alert.message}</td>
            <td>${alert.acknowledged ? 'Acknowledged' : 'Pending'}</td>
            <td>
                <button class="btn btn-sm" onclick="acknowledgeAlert(${alert.id})">
                    <i class="fas fa-check"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function getAlertIcon(type) {
    const icons = {
        critical: 'fa-fire',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
        success: 'fa-check-circle'
    };
    return icons[type] || 'fa-bell';
}

// Settings Management
function initializeSettings() {
    // Settings will be initialized when settings tab is accessed
}

function updateSettingsContent() {
    const settingsContent = document.querySelector('.settings-content');
    if (!settingsContent) return;
    
    settingsContent.innerHTML = `
        <div class="settings-section">
            <h3>General Settings</h3>
            <div class="setting-item">
                <label>Update Interval (seconds)</label>
                <input type="number" value="${dashboardState.settings.updateInterval / 1000}" 
                       onchange="updateSetting('updateInterval', this.value * 1000)">
            </div>
            <div class="setting-item">
                <label>System Name</label>
                <input type="text" value="Fire Detection System" readonly>
            </div>
        </div>
        
        <div class="settings-section">
            <h3>Alert Thresholds</h3>
            <div class="setting-item">
                <label>LPG Gas Threshold (ppm)</label>
                <input type="number" value="${dashboardState.settings.alertThresholds.gasLPG}" 
                       onchange="updateThreshold('gasLPG', this.value)">
            </div>
            <div class="setting-item">
                <label>Smoke Threshold (ppm)</label>
                <input type="number" value="${dashboardState.settings.alertThresholds.gasSmoke}" 
                       onchange="updateThreshold('gasSmoke', this.value)">
            </div>
            <div class="setting-item">
                <label>Temperature Threshold (°C)</label>
                <input type="number" value="${dashboardState.settings.alertThresholds.temperature}" 
                       onchange="updateThreshold('temperature', this.value)">
            </div>
        </div>
        
        <div class="settings-section">
            <h3>Notifications</h3>
            <div class="setting-item">
                <label>
                    <input type="checkbox" ${dashboardState.settings.notifications.email ? 'checked' : ''}
                           onchange="updateNotificationSetting('email', this.checked)">
                    Email Notifications
                </label>
            </div>
            <div class="setting-item">
                <label>
                    <input type="checkbox" ${dashboardState.settings.notifications.sms ? 'checked' : ''}
                           onchange="updateNotificationSetting('sms', this.checked)">
                    SMS Notifications
                </label>
            </div>
            <div class="setting-item">
                <label>
                    <input type="checkbox" ${dashboardState.settings.notifications.push ? 'checked' : ''}
                           onchange="updateNotificationSetting('push', this.checked)">
                    Push Notifications
                </label>
            </div>
        </div>
    `;
}

function updateSetting(key, value) {
    dashboardState.settings[key] = value;
    console.log(`Setting updated: ${key} = ${value}`);
}

function updateThreshold(key, value) {
    dashboardState.settings.alertThresholds[key] = parseFloat(value);
    console.log(`Threshold updated: ${key} = ${value}`);
}

function updateNotificationSetting(key, value) {
    dashboardState.settings.notifications[key] = value;
    console.log(`Notification setting updated: ${key} = ${value}`);
}

// Device Grid Management
function updateDevicesGrid() {
    const devicesGrid = document.querySelector('.devices-grid');
    if (!devicesGrid) return;
    
    devicesGrid.innerHTML = dashboardState.devices.map(device => `
        <div class="device-card">
            <div class="device-header">
                <h4>${device.name}</h4>
                <span class="device-status ${device.status}">${device.status.toUpperCase()}</span>
            </div>
            <div class="device-info">
                <div class="device-detail">
                    <span class="label">Device ID:</span>
                    <span class="value">${device.id}</span>
                </div>
                <div class="device-detail">
                    <span class="label">Type:</span>
                    <span class="value">${device.type}</span>
                </div>
                <div class="device-detail">
                    <span class="label">Battery:</span>
                    <span class="value">${device.battery}%</span>
                </div>
                <div class="device-detail">
                    <span class="label">Risk Level:</span>
                    <span class="value risk-${device.riskLevel}">${device.riskLevel.toUpperCase()}</span>
                </div>
                <div class="device-detail">
                    <span class="label">Last Seen:</span>
                    <span class="value">${formatRelativeTime(device.lastSeen)}</span>
                </div>
            </div>
            <div class="device-actions">
                <button class="btn btn-secondary" onclick="configureDevice('${device.id}')">
                    <i class="fas fa-cog"></i> Configure
                </button>
                <button class="btn btn-primary" onclick="viewDeviceDetails('${device.id}')">
                    <i class="fas fa-eye"></i> Details
                </button>
            </div>
        </div>
    `).join('');
}

// Main dashboard update function
function updateDashboard() {
    // Generate new sensor data
    const data = generateSensorData();
    
    // Calculate risk assessment
    const riskAssessment = calculateRiskLevel(data);
    
    // Update UI elements
    updateSensorReadings(data);
    updateRiskDisplay(riskAssessment);
    updateSystemHealth(data);
    updateLastUpdated();
    
    // Check for alerts
    checkForAlerts(data);
    
    // Update device statuses
    updateDeviceStatuses();
}

function updateSensorReadings(data) {
    // Gas sensors
    updateElement('gasLPG', `${Math.round(data.gasLPG)} ppm`);
    updateElement('gasSmoke', `${Math.round(data.gasSmoke)} ppm`);
    
    // Environmental sensors
    updateElement('temperature', `${data.temperature.toFixed(1)}°C`);
    updateElement('humidity', `${Math.round(data.humidity)}%`);
    
    // Flame detection
    updateElement('flameIR', `${data.flameIR.toFixed(1)}V`);
    updateElement('flameUV', `${data.flameUV.toFixed(1)}V`);
    
    // Wind conditions
    updateElement('windSpeed', `${Math.round(data.windSpeed)} m/s`);
    updateElement('windDirection', `${getWindDirection(data.windDirection)} (${Math.round(data.windDirection)}°)`);
}

function updateRiskDisplay(assessment) {
    const riskLevel = document.getElementById('riskLevel');
    const riskScore = document.getElementById('riskScore');
    const riskIndicator = document.getElementById('riskIndicator');
    
    if (riskLevel) {
        riskLevel.textContent = assessment.level;
        riskLevel.className = `risk-text risk-${assessment.level.toLowerCase()}`;
    }
    
    if (riskScore) {
        riskScore.textContent = assessment.score.toFixed(2);
    }
    
    if (riskIndicator) {
        // Update risk circle gradient based on level
        const riskCircle = riskIndicator.querySelector('.risk-circle');
        if (riskCircle) {
            const colors = {
                'SAFE': '#10b981',
                'LOW': '#84cc16',
                'MEDIUM': '#f59e0b',
                'HIGH': '#f97316',
                'CRITICAL': '#ef4444'
            };
            const color = colors[assessment.level];
            const percentage = Math.min(assessment.score * 360, 360);
            riskCircle.style.background = `conic-gradient(${color} 0deg ${percentage}deg, var(--bg-tertiary) ${percentage}deg 360deg)`;
        }
    }
    
    // Update risk factors
    updateRiskFactors(assessment);
}

function updateRiskFactors(assessment) {
    const data = dashboardState.sensorData;
    const factors = [
        {
            name: 'Gas Concentration',
            value: Math.max(data.gasLPG / 1000, data.gasSmoke / 800) * 100,
            label: data.gasLPG > 200 || data.gasSmoke > 150 ? 'Elevated' : 'Low'
        },
        {
            name: 'Temperature',
            value: Math.max(0, (data.temperature - 20) / 30) * 100,
            label: data.temperature > 35 ? 'High' : 'Normal'
        },
        {
            name: 'Flame Detection',
            value: data.flameDetected ? 100 : 0,
            label: data.flameDetected ? 'DETECTED' : 'Clear'
        }
    ];
    
    factors.forEach((factor, index) => {
        const factorElements = document.querySelectorAll('.factor');
        if (factorElements[index]) {
            const fill = factorElements[index].querySelector('.factor-fill');
            const label = factorElements[index].querySelector('.factor-value');
            
            if (fill) {
                fill.style.width = `${Math.min(factor.value, 100)}%`;
                fill.style.backgroundColor = factor.value > 70 ? '#ef4444' : 
                                            factor.value > 40 ? '#f59e0b' : '#10b981';
            }
            
            if (label) {
                label.textContent = factor.label;
                label.className = `factor-value ${factor.value > 70 ? 'risk-critical' : 
                                                  factor.value > 40 ? 'risk-medium' : 'risk-safe'}`;
            }
        }
    });
}

function updateSystemHealth(data) {
    // Battery level
    updateElement('batteryLevel', `${Math.round(data.batteryLevel)}%`);
    const batteryFill = document.querySelector('.battery-fill');
    if (batteryFill) {
        batteryFill.style.width = `${data.batteryLevel}%`;
    }
    
    // Solar power
    updateElement('solarPower', `${data.solarPower.toFixed(1)}W`);
    
    // Communication status
    const commItems = document.querySelectorAll('.comm-item');
    if (commItems.length >= 3) {
        commItems[0].className = `comm-item ${data.commStatus.lte ? 'online' : 'offline'}`;
        commItems[1].className = `comm-item ${data.commStatus.lora ? 'online' : 'offline'}`;
        commItems[2].className = `comm-item ${data.commStatus.wifi ? 'online' : 'offline'}`;
    }
}

function updateLastUpdated() {
    const lastUpdated = document.getElementById('lastUpdated');
    if (lastUpdated) {
        lastUpdated.textContent = new Date().toLocaleTimeString();
    }
}

function checkForAlerts(data) {
    const thresholds = dashboardState.settings.alertThresholds;
    
    // Check gas thresholds
    if (data.gasLPG > thresholds.gasLPG) {
        addAlert({
            device: 'FD-001',
            type: 'warning',
            message: `LPG concentration exceeded threshold: ${Math.round(data.gasLPG)} ppm`,
            location: 'Zone A',
            acknowledged: false,
            value: data.gasLPG
        });
    }
    
    // Check temperature threshold
    if (data.temperature > thresholds.temperature) {
        addAlert({
            device: 'FD-001',
            type: 'warning',
            message: `Temperature exceeded threshold: ${data.temperature.toFixed(1)}°C`,
            location: 'Zone A',
            acknowledged: false,
            value: data.temperature
        });
    }
    
    // Check flame detection
    if (data.flameDetected) {
        addAlert({
            device: 'FD-001',
            type: 'critical',
            message: 'FLAME DETECTED - Emergency response required',
            location: 'Zone A',
            acknowledged: false,
            value: null
        });
    }
}

function updateDeviceStatuses() {
    // Update device statuses based on current conditions
    dashboardState.devices.forEach(device => {
        if (device.id === 'FD-001') {
            const riskAssessment = calculateRiskLevel(dashboardState.sensorData);
            device.riskLevel = riskAssessment.level.toLowerCase();
        }
    });
    
    // Update active devices count
    const activeDevices = document.getElementById('activeDevices');
    if (activeDevices) {
        const onlineCount = dashboardState.devices.filter(d => d.status === 'online').length;
        activeDevices.textContent = onlineCount;
    }
}

// Real-time updates
function startRealTimeUpdates() {
    // Update dashboard every 3 seconds (configurable)
    dashboardState.intervals.dashboard = setInterval(() => {
        updateDashboard();
    }, dashboardState.settings.updateInterval);
    
    // Update charts every 30 seconds
    dashboardState.intervals.charts = setInterval(() => {
        if (dashboardState.activeTab === 'analytics') {
            updateCharts();
        }
    }, 30000);
    
    console.log('✅ Real-time updates started');
}

// Emergency Modal
function showEmergencyModal(alert) {
    const modal = document.getElementById('emergencyModal');
    if (!modal) return;
    
    document.getElementById('emergencyDevice').textContent = alert.device;
    document.getElementById('emergencyLocation').textContent = alert.location;
    document.getElementById('emergencyTime').textContent = formatDateTime(alert.timestamp);
    
    modal.classList.add('show');
    
    // Auto-play alarm sound (if available)
    playAlarmSound();
}

function acknowledgeEmergency() {
    const modal = document.getElementById('emergencyModal');
    if (modal) {
        modal.classList.remove('show');
    }
    
    // Acknowledge the most recent critical alert
    const criticalAlert = dashboardState.alerts.find(a => a.type === 'critical' && !a.acknowledged);
    if (criticalAlert) {
        criticalAlert.acknowledged = true;
        updateAlertsDisplay();
    }
}

function callEmergencyServices() {
    alert('🚨 Emergency services would be contacted automatically.\n\n' +
          'Fire Department: +27 12 358 7095\n' +
          'Location: Transmitted via GPS\n' +
          'Device: ' + dashboardState.devices[0].id);
}

function acknowledgeAlert(alertId) {
    const alert = dashboardState.alerts.find(a => a.id === alertId);
    if (alert) {
        alert.acknowledged = true;
        updateAlertsDisplay();
        updateAlertsTable();
    }
}

// Utility Functions
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatTime(date) {
    return date.toLocaleTimeString();
}

function formatDateTime(date) {
    return date.toLocaleString();
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

function playAlarmSound() {
    // Create audio context for alarm sound
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.warn('Could not play alarm sound:', error);
    }
}

// Global functions for HTML onclick handlers
window.refreshSensorData = function() {
    updateDashboard();
    console.log('🔄 Sensor data refreshed manually');
};

window.testAlert = function() {
    addAlert({
        device: 'FD-001',
        type: 'warning',
        message: 'Test alert generated by user',
        location: 'Zone A',
        acknowledged: false,
        value: null
    });
    console.log('🧪 Test alert generated');
};

window.resetSystem = function() {
    if (confirm('Are you sure you want to reset the system? This will recalibrate all sensors.')) {
        // Reset sensor baselines
        dashboardState.sensorData.gasLPG = 30 + Math.random() * 20;
        dashboardState.sensorData.gasSmoke = 15 + Math.random() * 15;
        
        addAlert({
            device: 'System',
            type: 'info',
            message: 'System reset and sensor recalibration completed',
            location: 'All zones',
            acknowledged: false,
            value: null
        });
        
        console.log('🔄 System reset completed');
    }
};

window.configureDevice = function(deviceId) {
    alert(`Device configuration for ${deviceId} would open in a new window.\n\n` +
          'Available options:\n' +
          '• Sensor calibration\n' +
          '• Communication settings\n' +
          '• Power management\n' +
          '• Firmware updates');
};

window.viewDeviceDetails = function(deviceId) {
    const device = dashboardState.devices.find(d => d.id === deviceId);
    if (device) {
        alert(`Device Details: ${device.name}\n\n` +
              `ID: ${device.id}\n` +
              `Type: ${device.type}\n` +
              `Status: ${device.status}\n` +
              `Battery: ${device.battery}%\n` +
              `Risk Level: ${device.riskLevel}\n` +
              `Firmware: ${device.firmware}\n` +
              `Location: ${device.location.lat.toFixed(4)}, ${device.location.lng.toFixed(4)}\n` +
              `Last Seen: ${formatDateTime(device.lastSeen)}`);
    }
};

window.acknowledgeEmergency = acknowledgeEmergency;
window.callEmergencyServices = callEmergencyServices;
window.acknowledgeAlert = acknowledgeAlert;

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        dashboardState,
        calculateRiskLevel,
        generateSensorData,
        initializeDashboard
    };
}

console.log('🔥 Fire Detection System Dashboard Script Loaded');
