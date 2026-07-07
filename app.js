// BPCL & CLR Retail Outlets Directory and Analytics App Logic

// App State
const state = {
    allData: dealersData, // From dealers_data.js
    filteredData: [],
    currentPage: 1,
    pageSize: 12,
    activeTab: 'dashboard',
    map: null,
    markersLayer: null,
    activeMarker: null,
    charts: {},
    mapMarkersMap: new Map() // Mapping of slNo -> Leaflet Marker
};

// Colors matching BPCL and CLR theme (Slate background, Orange/Blue accents)
const colorPalette = {
    blue: '#0054A6',
    blueAlpha: 'rgba(0, 84, 166, 0.75)',
    orange: '#F37021',
    orangeAlpha: 'rgba(243, 112, 33, 0.75)',
    green: '#10b981',
    greenAlpha: 'rgba(16, 185, 129, 0.75)',
    purple: '#a855f7',
    purpleAlpha: 'rgba(168, 85, 247, 0.75)',
    slate: '#475569',
    gridColor: 'rgba(148, 163, 184, 0.1)',
    textColor: '#475569'
};

// Document Load Event
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();
    
    // Initialize Theme
    initTheme();
    
    // Initialize Sidebar Controls
    initSidebar();
    
    // Populate Dropdown Filters
    populateFilters();
    
    // Set Initial Filtered Data
    state.filteredData = [...state.allData];
    
    // Initialize Dashboard & Charts
    initCharts();
    
    // Apply initial statistics and render Table
    applyFilters();
    
    // Setup event handlers for filters
    setupFilterListeners();
    
    // Handle tab switching
    setupTabs();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme);
        
        // Re-init chart colors for grid lines & text
        updateChartThemeColors(newTheme);
    });
}

function updateThemeUI(theme) {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    
    if (theme === 'dark') {
        themeIcon.setAttribute('data-lucide', 'sun');
        themeText.textContent = 'Light Mode';
        colorPalette.textColor = '#94a3b8';
        colorPalette.gridColor = 'rgba(255, 255, 255, 0.08)';
    } else {
        themeIcon.setAttribute('data-lucide', 'moon');
        themeText.textContent = 'Dark Mode';
        colorPalette.textColor = '#475569';
        colorPalette.gridColor = 'rgba(0, 0, 0, 0.05)';
    }
    
    lucide.createIcons({
        attrs: {
            id: ['theme-icon']
        }
    });
}

function updateChartThemeColors(theme) {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
    
    Object.values(state.charts).forEach(chart => {
        if (!chart) return;
        
        if (chart.options.scales) {
            if (chart.options.scales.x) {
                chart.options.scales.x.ticks.color = textColor;
                chart.options.scales.x.grid.color = gridColor;
            }
            if (chart.options.scales.y) {
                chart.options.scales.y.ticks.color = textColor;
                chart.options.scales.y.grid.color = gridColor;
            }
        }
        
        if (chart.options.plugins && chart.options.plugins.legend) {
            chart.options.plugins.legend.labels.color = textColor;
        }
        
        chart.update();
    });
}

// Sidebar Collapsing
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const collapseToggle = document.getElementById('collapse-toggle');
    const collapseIcon = document.getElementById('collapse-icon');
    
    collapseToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            collapseIcon.setAttribute('data-lucide', 'chevron-right');
        } else {
            collapseIcon.setAttribute('data-lucide', 'chevron-left');
        }
        
        lucide.createIcons({
            attrs: {
                id: ['collapse-icon']
            }
        });
        
        // Recalculate map size since the sidebar transitioned width
        setTimeout(() => {
            if (state.map) {
                state.map.invalidateSize();
            }
        }, 300);
    });

    // Mobile Responsive Toggle
    const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    if (window.innerWidth <= 768) {
        mobileSidebarToggle.style.display = 'flex';
    }
    
    mobileSidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
            sidebar.style.transform = 'translateX(-100%)';
        } else {
            sidebar.style.transform = 'translateX(0)';
        }
    });

    // Close sidebar on tapping main content wrapper on mobile
    const mainWrapper = document.querySelector('.main-wrapper');
    mainWrapper.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !sidebar.classList.contains('collapsed')) {
            if (mobileSidebarToggle.contains(e.target)) return;
            sidebar.classList.add('collapsed');
            sidebar.style.transform = 'translateX(-100%)';
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            mobileSidebarToggle.style.display = 'flex';
            sidebar.classList.add('collapsed');
            sidebar.style.transform = 'translateX(-100%)';
        } else {
            mobileSidebarToggle.style.display = 'none';
            sidebar.style.transform = 'translateX(0)';
            sidebar.classList.remove('collapsed');
        }
    });
}

// Populating Select Box Filters Dynamically from Data
function populateFilters() {
    const districts = new Set();
    const salesOfficers = new Set();
    const mstReps = new Set();
    
    state.allData.forEach(item => {
        if (item.district) districts.add(item.district.trim());
        if (item.soName) salesOfficers.add(item.soName.trim());
        if (item.mstName) mstReps.add(item.mstName.trim());
    });
    
    const filterDistrict = document.getElementById('filter-district');
    const filterSO = document.getElementById('filter-so');
    const filterMst = document.getElementById('filter-mst');
    
    // Sort and Populate Districts
    Array.from(districts).sort().forEach(dist => {
        const option = document.createElement('option');
        option.value = dist;
        option.textContent = dist;
        filterDistrict.appendChild(option);
    });
    
    // Sort and Populate SOs
    Array.from(salesOfficers).sort().forEach(so => {
        const option = document.createElement('option');
        option.value = so;
        option.textContent = so;
        filterSO.appendChild(option);
    });
    
    // Sort and Populate MSTs
    Array.from(mstReps).sort().forEach(mst => {
        const option = document.createElement('option');
        option.value = mst;
        option.textContent = mst;
        filterMst.appendChild(option);
    });
}

// Setup Tab Switching System
function setupTabs() {
    const menuItems = document.querySelectorAll('.menu-item');
    const contentPanels = document.querySelectorAll('.content-panel');
    const pageTitle = document.getElementById('current-page-title');
    const pageSubtitle = document.getElementById('current-page-subtitle');
    
    const tabDetails = {
        'dashboard': {
            title: 'Dashboard Overview',
            subtitle: 'Key metrics and statistics of BPCL outlets managed by CLR'
        },
        'map-view': {
            title: 'Interactive Maps Directory',
            subtitle: 'Geographical mapping, coordinates, and nearby routing of BPCL retail outlets'
        },
        'analytics': {
            title: 'Detailed Analytical Charts',
            subtitle: 'Graphical analysis of control types, district distributions, and personnel loads'
        },
        'directory': {
            title: 'Outlets Directory Database',
            subtitle: 'Searchable grid view database of all BPCL outlets, actions, and CSV extraction'
        }
    };
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            state.activeTab = targetTab;
            
            // Switch active classes in menu
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            
            // Switch active panel
            contentPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `panel-${targetTab}`) {
                    panel.classList.add('active');
                }
            });
            
            // Update Headers
            const info = tabDetails[targetTab];
            pageTitle.textContent = info.title;
            pageSubtitle.textContent = info.subtitle;
            
            // Lazy load map when map tab is activated
            if (targetTab === 'map-view') {
                if (!state.map) {
                    initMap();
                } else {
                    setTimeout(() => {
                        state.map.invalidateSize();
                    }, 50);
                }
            }
            
            // For Mobile, close sidebar on tap
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.add('collapsed');
                sidebar.style.transform = 'translateX(-100%)';
            }
        });
    });
}

// Event listeners for Filters
function setupFilterListeners() {
    const filterDistrict = document.getElementById('filter-district');
    const filterType = document.getElementById('filter-type');
    const filterSO = document.getElementById('filter-so');
    const filterMst = document.getElementById('filter-mst');
    const globalSearch = document.getElementById('global-search');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    const btnExportCSV = document.getElementById('btn-export-csv');
    
    const triggerFilterUpdate = () => {
        state.currentPage = 1; // Reset to page 1
        applyFilters();
    };
    
    filterDistrict.addEventListener('change', triggerFilterUpdate);
    filterType.addEventListener('change', triggerFilterUpdate);
    filterSO.addEventListener('change', triggerFilterUpdate);
    filterMst.addEventListener('change', triggerFilterUpdate);
    
    // Debounced search trigger
    let searchTimeout;
    globalSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(triggerFilterUpdate, 300);
    });
    
    btnResetFilters.addEventListener('click', () => {
        filterDistrict.value = '';
        filterType.value = '';
        filterSO.value = '';
        filterMst.value = '';
        globalSearch.value = '';
        triggerFilterUpdate();
    });
    
    btnExportCSV.addEventListener('click', () => {
        exportToCSV();
    });
}

// core filter calculation
function applyFilters() {
    const districtVal = document.getElementById('filter-district').value.toLowerCase();
    const typeVal = document.getElementById('filter-type').value.toLowerCase();
    const soVal = document.getElementById('filter-so').value.toLowerCase();
    const mstVal = document.getElementById('filter-mst').value.toLowerCase();
    const searchVal = document.getElementById('global-search').value.toLowerCase().trim();
    
    state.filteredData = state.allData.filter(item => {
        // District filter
        if (districtVal && item.district.toLowerCase() !== districtVal) return false;
        
        // Type filter
        if (typeVal && item.type.toLowerCase() !== typeVal) return false;
        
        // SO filter
        if (soVal && item.soName.toLowerCase() !== soVal) return false;
        
        // MST filter
        if (mstVal && item.mstName.toLowerCase() !== mstVal) return false;
        
        // Search filter
        if (searchVal) {
            const matchesSearch = 
                item.outletName.toLowerCase().includes(searchVal) ||
                item.ccNumber.toLowerCase().includes(searchVal) ||
                item.blCode.toLowerCase().includes(searchVal) ||
                item.location.toLowerCase().includes(searchVal) ||
                item.district.toLowerCase().includes(searchVal) ||
                item.contact.toLowerCase().includes(searchVal);
            
            if (!matchesSearch) return false;
        }
        
        return true;
    });
    
    // Update dashboard components
    updateMetrics();
    updateChartsData();
    renderTable();
    
    if (state.map) {
        updateMapMarkers();
    }
}

// Update KPI Metrics Cards
function updateMetrics() {
    let ccCount = 0;
    let dcCount = 0;
    let cocoCount = 0;
    
    state.filteredData.forEach(item => {
        const type = item.type.toUpperCase();
        if (type === 'CC') ccCount++;
        else if (type === 'DC') dcCount++;
        else if (type === 'COCO') cocoCount++;
    });
    
    document.getElementById('kpi-total').textContent = state.filteredData.length;
    document.getElementById('kpi-cc').textContent = ccCount;
    document.getElementById('kpi-dc').textContent = dcCount;
    document.getElementById('kpi-coco').textContent = cocoCount;
}

// Initialize Leaflet Map
function initMap() {
    // Center of outlets range
    const initialCenter = [15.70, 75.20];
    const initialZoom = 8;
    
    state.map = L.map('map-container').setView(initialCenter, initialZoom);
    
    // Add custom styled theme map tiles
    // Using CartoDB Positron for cleaner dashboard looks
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        
    L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);
    
    state.markersLayer = L.layerGroup().addTo(state.map);
    
    updateMapMarkers();
}

// Rebuild Markers based on filtered data
function updateMapMarkers() {
    if (!state.markersLayer) return;
    
    // Clear existing markers
    state.markersLayer.clearLayers();
    state.mapMarkersMap.clear();
    
    let validCoordsCount = 0;
    
    state.filteredData.forEach(item => {
        const lat = parseFloat(item.latitude);
        const lng = parseFloat(item.longitude);
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;
        
        validCoordsCount++;
        
        // Icon pin colors depending on Control Type
        let pinColor = colorPalette.blue;
        if (item.type.toUpperCase() === 'DC') pinColor = colorPalette.orange;
        if (item.type.toUpperCase() === 'COCO') pinColor = colorPalette.purple;
        
        // Custom HTML Marker Icon
        const customIcon = L.divIcon({
            html: `<div class="marker-pin" style="background: ${pinColor}"></div>`,
            className: 'custom-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });
        
        const marker = L.marker([lat, lng], { icon: customIcon });
        
        // Styled Popup content
        const popupContent = `
            <div class="map-popup-header">
                <h3>${item.outletName}</h3>
                <span class="popup-type">${item.type.toUpperCase()} Outlet</span>
            </div>
            <div class="map-popup-body">
                <div class="popup-row">
                    <i data-lucide="map-pin"></i>
                    <div>
                        <span class="popup-label">Location:</span>
                        <span class="popup-val">${item.location}</span>
                    </div>
                </div>
                <div class="popup-row">
                    <i data-lucide="hash"></i>
                    <div>
                        <span class="popup-label">CC Num:</span>
                        <span class="popup-val">${item.ccNumber}</span>
                    </div>
                </div>
                <div class="popup-row">
                    <i data-lucide="users"></i>
                    <div>
                        <span class="popup-label">SO Officer:</span>
                        <span class="popup-val">${item.soName}</span>
                    </div>
                </div>
                <div class="popup-row">
                    <i data-lucide="wrench"></i>
                    <div>
                        <span class="popup-label">MST Rep:</span>
                        <span class="popup-val">${item.mstName}</span>
                    </div>
                </div>
                <div class="popup-row">
                    <i data-lucide="phone"></i>
                    <div>
                        <span class="popup-label">Contact:</span>
                        <span class="popup-val">${item.contact || 'N/A'}</span>
                    </div>
                </div>
            </div>
            <div class="map-popup-footer">
                ${item.contact ? `<a href="tel:${item.contact}" class="popup-action-btn"><i data-lucide="phone-call" style="width:12px;height:12px;"></i> Call Dealer</a>` : ''}
                <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" class="popup-action-btn"><i data-lucide="navigation" style="width:12px;height:12px;"></i> Directions</a>
            </div>
        `;
        
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            closeButton: false
        });
        
        // Lucide SVG rendering when popup opens
        marker.on('popupopen', () => {
            lucide.createIcons();
            
            // Set marker active styling
            marker.getElement().classList.add('active');
            state.activeMarker = marker;
        });
        
        marker.on('popupclose', () => {
            if (marker.getElement()) {
                marker.getElement().classList.remove('active');
            }
            state.activeMarker = null;
        });
        
        state.markersLayer.addLayer(marker);
        state.mapMarkersMap.set(item.slNo, marker);
    });
    
    document.getElementById('map-counter-text').textContent = `Showing ${validCoordsCount} of ${state.filteredData.length} filtered outlets on map.`;
}

// Fly to specific outlet coordinate and open popup
function flyToOutlet(slNo, lat, lng, name) {
    // Switch to Map Tab first
    document.querySelector('.menu-item[data-tab="map-view"]').click();
    
    if (!state.map) return;
    
    // Zoom and Center on marker
    state.map.flyTo([lat, lng], 13, {
        animate: true,
        duration: 1.5
    });
    
    // Find Leaflet Marker and Open Popup
    setTimeout(() => {
        const marker = state.mapMarkersMap.get(slNo);
        if (marker) {
            marker.openPopup();
        }
    }, 1600);
}

// Setup Charts Layout using Chart.js
function initCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#475569';
    
    // Chart 1: Mini Districts Chart
    const ctxMiniDistrict = document.getElementById('mini-district-chart').getContext('2d');
    state.charts.miniDistrict = new Chart(ctxMiniDistrict, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor, stepSize: 10 },
                    grid: { color: colorPalette.gridColor }
                }
            }
        }
    });

    // Chart 2: Mini Types Doughnut Chart
    const ctxMiniType = document.getElementById('mini-type-chart').getContext('2d');
    state.charts.miniType = new Chart(ctxMiniType, {
        type: 'doughnut',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, padding: 15, font: { size: 11 } }
                }
            },
            cutout: '70%'
        }
    });

    // Chart 3: Detailed Districts Chart
    const ctxDistrictDetailed = document.getElementById('chart-district-detailed').getContext('2d');
    state.charts.districtDetailed = new Chart(ctxDistrictDetailed, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bars
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: colorPalette.gridColor }
                },
                y: {
                    ticks: { color: textColor },
                    grid: { display: false }
                }
            }
        }
    });

    // Chart 4: Detailed Control Type Doughnut Chart
    const ctxTypeDetailed = document.getElementById('chart-type-detailed').getContext('2d');
    state.charts.typeDetailed = new Chart(ctxTypeDetailed, {
        type: 'pie',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, padding: 10 }
                }
            }
        }
    });

    // Chart 5: Detailed Sales Officers Load Chart
    const ctxSOLoad = document.getElementById('chart-so-load').getContext('2d');
    state.charts.soLoad = new Chart(ctxSOLoad, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: textColor, maxRotation: 45, minRotation: 45 },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: colorPalette.gridColor }
                }
            }
        }
    });

    // Chart 6: Detailed MST support Load Chart
    const ctxMstLoad = document.getElementById('chart-mst-load').getContext('2d');
    state.charts.mstLoad = new Chart(ctxMstLoad, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: textColor, maxRotation: 45, minRotation: 45 },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: colorPalette.gridColor }
                }
            }
        }
    });
}

// Process and update data inside Chart instances
function updateChartsData() {
    const districtsMap = {};
    const typesMap = { 'CC': 0, 'DC': 0, 'COCO': 0 };
    const soMap = {};
    const mstMap = {};
    
    state.filteredData.forEach(item => {
        // District counting
        if (item.district) {
            const dist = item.district.trim();
            districtsMap[dist] = (districtsMap[dist] || 0) + 1;
        }
        
        // Type counting
        const type = item.type.trim().toUpperCase();
        if (type in typesMap) {
            typesMap[type]++;
        } else {
            typesMap[type] = (typesMap[type] || 0) + 1;
        }
        
        // Sales Officer counting
        if (item.soName) {
            const so = item.soName.trim();
            soMap[so] = (soMap[so] || 0) + 1;
        }
        
        // MST Representative counting
        if (item.mstName) {
            const mst = item.mstName.trim();
            mstMap[mst] = (mstMap[mst] || 0) + 1;
        }
    });
    
    // Sort Districts by count descending
    const sortedDistricts = Object.entries(districtsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Take top 10
        
    const distLabels = sortedDistricts.map(x => x[0]);
    const distCounts = sortedDistricts.map(x => x[1]);
    
    // Sort SOs by count descending
    const sortedSOs = Object.entries(soMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12); // Take top 12
        
    const soLabels = sortedSOs.map(x => x[0]);
    const soCounts = sortedSOs.map(x => x[1]);
    
    // Sort MSTs by count descending
    const sortedMSTs = Object.entries(mstMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12); // Take top 12
        
    const mstLabels = sortedMSTs.map(x => x[0]);
    const mstCounts = sortedMSTs.map(x => x[1]);
    
    // 1. Update Mini District Chart
    if (state.charts.miniDistrict) {
        state.charts.miniDistrict.data.labels = distLabels.slice(0, 5); // top 5
        state.charts.miniDistrict.data.datasets = [{
            label: 'Outlets Count',
            data: distCounts.slice(0, 5),
            backgroundColor: colorPalette.blueAlpha,
            borderColor: colorPalette.blue,
            borderWidth: 1,
            borderRadius: 6
        }];
        state.charts.miniDistrict.update();
    }
    
    // 2. Update Mini Type Chart
    if (state.charts.miniType) {
        state.charts.miniType.data.labels = ['CC Outlets', 'DC Outlets', 'COCO Outlets'];
        state.charts.miniType.data.datasets = [{
            data: [typesMap['CC'], typesMap['DC'], typesMap['COCO']],
            backgroundColor: [colorPalette.blue, colorPalette.orange, colorPalette.purple],
            borderWidth: 0
        }];
        state.charts.miniType.update();
    }
    
    // 3. Update Detailed District Chart (Horizontal Bars)
    if (state.charts.districtDetailed) {
        state.charts.districtDetailed.data.labels = distLabels;
        state.charts.districtDetailed.data.datasets = [{
            label: 'Outlets Count',
            data: distCounts,
            backgroundColor: colorPalette.orangeAlpha,
            borderColor: colorPalette.orange,
            borderWidth: 1,
            borderRadius: 4
        }];
        state.charts.districtDetailed.update();
    }
    
    // 4. Update Detailed Type Pie Chart
    if (state.charts.typeDetailed) {
        state.charts.typeDetailed.data.labels = ['CC (Company Controlled)', 'DC (Dealer Controlled)', 'COCO (Owned Operated)'];
        state.charts.typeDetailed.data.datasets = [{
            data: [typesMap['CC'], typesMap['DC'], typesMap['COCO']],
            backgroundColor: [colorPalette.blue, colorPalette.orange, colorPalette.purple],
            borderWidth: 2,
            borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#131c2e' : '#ffffff'
        }];
        state.charts.typeDetailed.update();
    }
    
    // 5. Update SO load chart
    if (state.charts.soLoad) {
        state.charts.soLoad.data.labels = soLabels;
        state.charts.soLoad.data.datasets = [{
            label: 'Outlets Managed',
            data: soCounts,
            backgroundColor: colorPalette.blueAlpha,
            borderColor: colorPalette.blue,
            borderWidth: 1,
            borderRadius: 6
        }];
        state.charts.soLoad.update();
    }
    
    // 6. Update MST load chart
    if (state.charts.mstLoad) {
        state.charts.mstLoad.data.labels = mstLabels;
        state.charts.mstLoad.data.datasets = [{
            label: 'Support Load',
            data: mstCounts,
            backgroundColor: colorPalette.purpleAlpha,
            borderColor: colorPalette.purple,
            borderWidth: 1,
            borderRadius: 6
        }];
        state.charts.mstLoad.update();
    }
}

// Render paginated data table
function renderTable() {
    const tbody = document.getElementById('directory-tbody');
    tbody.innerHTML = '';
    
    const totalRecords = state.filteredData.length;
    
    if (totalRecords === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 48px; color: var(--text-secondary);">
                    <i data-lucide="alert-circle" style="width: 32px; height: 32px; margin-bottom: 8px; stroke-width: 1.5;"></i>
                    <p style="font-weight: 600;">No matching retail outlets found</p>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Try loosening your filters or search query.</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        document.getElementById('pagination-info-text').textContent = 'Showing 0 to 0 of 0 entries';
        document.getElementById('pagination-buttons-container').innerHTML = '';
        return;
    }
    
    // Paginate slice
    const totalPages = Math.ceil(totalRecords / state.pageSize);
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;
    
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, totalRecords);
    const paginatedRecords = state.filteredData.slice(startIndex, endIndex);
    
    const searchVal = document.getElementById('global-search').value.trim();
    
    // Populate rows
    paginatedRecords.forEach(item => {
        const tr = document.createElement('tr');
        
        // Highlight helper
        const highlight = (text) => {
            if (!searchVal) return text;
            const regex = new RegExp(`(${searchVal.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
            return text.replace(regex, '<span class="highlight-text">$1</span>');
        };
        
        let typeBadge = `<span class="badge badge-blue">CC</span>`;
        if (item.type.toUpperCase() === 'DC') {
            typeBadge = `<span class="badge badge-orange">DC</span>`;
        } else if (item.type.toUpperCase() === 'COCO') {
            typeBadge = `<span class="badge badge-green">COCO</span>`;
        }
        
        tr.innerHTML = `
            <td>${item.slNo}</td>
            <td><code>${highlight(item.ccNumber)}</code></td>
            <td><code>${highlight(item.blCode)}</code></td>
            <td style="font-weight: 600;">${highlight(item.outletName)}</td>
            <td>${highlight(item.district)}</td>
            <td>${highlight(item.mstName)}</td>
            <td>${highlight(item.soName)}</td>
            <td>${typeBadge}</td>
            <td>${item.contact ? `<a href="tel:${item.contact}" style="color:var(--bpcl-blue); text-decoration:none;"><i data-lucide="phone-call" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>${highlight(item.contact)}</a>` : '<span style="color:var(--text-muted)">N/A</span>'}</td>
            <td>
                <div style="display:flex; gap:8px;">
                    ${item.latitude && item.longitude ? `
                    <button class="btn btn-secondary" onclick="flyToOutlet(${item.slNo}, ${item.latitude}, ${item.longitude}, '${item.outletName.replace(/'/g, "\\'")}')" style="padding: 4px 8px;" title="View on Map">
                        <i data-lucide="map-pin" style="width:14px;height:14px;color:var(--bpcl-orange);"></i> Map
                    </button>
                    <a class="btn btn-secondary" href="https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}" target="_blank" style="padding: 4px 8px;" title="Get Directions">
                        <i data-lucide="navigation" style="width:14px;height:14px;color:var(--bpcl-blue);"></i> Directions
                    </a>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Lucide Icon parser
    lucide.createIcons();
    
    // Update pagination footer text
    document.getElementById('pagination-info-text').textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalRecords} entries`;
    
    // Render pagination buttons
    renderPaginationButtons(totalPages);
}

function renderPaginationButtons(totalPages) {
    const container = document.getElementById('pagination-buttons-container');
    container.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous Page Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pag-btn';
    prevBtn.disabled = state.currentPage === 1;
    prevBtn.innerHTML = '<i data-lucide="chevron-left" style="width:16px;height:16px;"></i>';
    prevBtn.addEventListener('click', () => {
        state.currentPage--;
        renderTable();
    });
    container.appendChild(prevBtn);
    
    // Numeric Page buttons
    const range = 2; // Pages to show before and after current
    let startPage = Math.max(1, state.currentPage - range);
    let endPage = Math.min(totalPages, state.currentPage + range);
    
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.className = 'pag-btn';
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => {
            state.currentPage = 1;
            renderTable();
        });
        container.appendChild(firstBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.margin = '0 6px';
            dots.style.color = 'var(--text-secondary)';
            container.appendChild(dots);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `pag-btn ${state.currentPage === i ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
            state.currentPage = i;
            renderTable();
        });
        container.appendChild(btn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.margin = '0 6px';
            dots.style.color = 'var(--text-secondary)';
            container.appendChild(dots);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.className = 'pag-btn';
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener('click', () => {
            state.currentPage = totalPages;
            renderTable();
        });
        container.appendChild(lastBtn);
    }
    
    // Next Page Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pag-btn';
    nextBtn.disabled = state.currentPage === totalPages;
    nextBtn.innerHTML = '<i data-lucide="chevron-right" style="width:16px;height:16px;"></i>';
    nextBtn.addEventListener('click', () => {
        state.currentPage++;
        renderTable();
    });
    container.appendChild(nextBtn);
    
    lucide.createIcons();
}

// Export Filtered Data to CSV file download
function exportToCSV() {
    if (state.filteredData.length === 0) return;
    
    // CSV headers
    const headers = [
        'Sl.No',
        'CC Number',
        'BL Code',
        'Outlet Name',
        'Location Details',
        'District',
        'Executive Officer (EO)',
        'Sales Officer (SO)',
        'MST support Rep',
        'Type (CC/DC/COCO)',
        'Latitude',
        'Longitude',
        'Contact Number'
    ];
    
    const csvRows = [headers.join(',')];
    
    state.filteredData.forEach(item => {
        const row = [
            item.slNo,
            `"${item.ccNumber}"`,
            `"${item.blCode}"`,
            `"${item.outletName.replace(/"/g, '""')}"`,
            `"${item.location.replace(/"/g, '""')}"`,
            `"${item.district.replace(/"/g, '""')}"`,
            `"${item.eoName.replace(/"/g, '""')}"`,
            `"${item.soName.replace(/"/g, '""')}"`,
            `"${item.mstName.replace(/"/g, '""')}"`,
            `"${item.type}"`,
            item.latitude,
            item.longitude,
            `"${item.contact}"`
        ];
        csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const filename = `BPCL_Outlets_CLR_Filtered_${new Date().toISOString().slice(0,10)}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Register Service Worker for PWA Offline Capabilities
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered successfully!', reg.scope))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

