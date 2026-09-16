// ==========================================
// Constants & Configuration
// ==========================================
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const NOMINATIM_HEADERS = { 'User-Agent': 'OrientirHKH/3.0', 'Accept-Language': 'uk' };
const MAP_INITIAL_COORDS = [49.9935, 36.2304];
const MAP_INITIAL_ZOOM = 12;

// ==========================================
// Global State & Data
// ==========================================
let map = null;
let marker = null;
let streetsData = [];
let housesData = {};
let districtPolygons = null;
let jkAddressesData = null;
let selectedStreetId = null;
let silentState = false;

// DOM Elements
const elements = {
    street: document.getElementById('street'),
    house: document.getElementById('house_number'),
    landmark: document.getElementById('landmark'),
    metro: document.getElementById('metro'),
    district: document.getElementById('district'),
    complex: document.getElementById('complex'),
    streetDrop: document.getElementById('SD'),
    houseDrop: document.getElementById('HD')
};

const DISTRICTS = [
    "Індустріальний р-н", "Київський р-н", "Немишлянський р-н",
    "Новобаварський р-н", "Основ'янський р-н", "Салтівський р-н",
    "Слобідський р-н", "Холодногірський р-н", "Шевченківський р-н",
    "Без району"
];

// ==========================================
// Helpers
// ==========================================
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function getPlaceName(item) {
    if (item.name && item.name.length < 80) return item.name;
    if (item.display_name) {
        const part = item.display_name.split(',')[0].trim();
        if (part.length > 1 && part.length < 80) return part;
    }
    return null;
}

function getPlaceType(item) {
    const cl = item.class || '';
    const tp = item.type || '';
    const n = (item.name || item.display_name || '').toLowerCase();
    
    if (cl === 'place' && ['suburb', 'neighbourhood', 'quarter'].includes(tp)) return 'ngb';
    if (cl === 'railway' && ['subway_entrance', 'station'].includes(tp)) return 'metro';
    if (cl === 'amenity' && tp === 'subway_entrance') return 'metro';
    if (cl === 'leisure' && ['park', 'garden'].includes(tp)) return 'prk';
    
    if (/метро|subway|підземк/.test(n)) return 'metro';
    if (/парк|сквер|сад/.test(n)) return 'prk';
    if (/мікрорайон|мкр/.test(n)) return 'ngb';
    
    return 'oth';
}

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    initDropdowns();
    await loadAllData();
    setupEventListeners();
});

function initMap() {
    map = L.map('map').setView(MAP_INITIAL_COORDS, MAP_INITIAL_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

function initDropdowns() {
    DISTRICTS.forEach(d => elements.district.append(new Option(d, d)));
}

async function loadAllData() {
    try {
        const [streets, houses, polygons, jks] = await Promise.all([
            fetch('data/streets.json').then(r => r.json()),
            fetch('data/houses.json').then(r => r.json()),
            fetch('data/districts.json').then(r => r.json()),
            fetch('data/complexes.json').then(r => r.json())
        ]);

        streetsData = streets.map(s => {
            let display = `${s.current_name} ${s.short_type}`;
            if (s.old_names && s.old_names.length > 0) {
                display += ` (колиш. ${s.old_names.join(', ')})`;
            }
            return {
                ...s,
                full: display,
                _lowerFull: display.toLowerCase()
            };
        });

        housesData = houses;
        districtPolygons = polygons;
        jkAddressesData = jks;

        populateComplexDropdown();
    } catch (e) {
        console.error('Ошибка загрузки данных:', e);
    }
}

// ==========================================
// Autocomplete Logic
// ==========================================
function closeStreetDropdown() { elements.streetDrop.classList.remove('open'); }
function closeHouseDropdown() { elements.houseDrop.classList.remove('open'); }

function showStreetSuggestions(val) {
    const lowerVal = val.toLowerCase();
    const matches = streetsData.filter(s => 
        (s.search_key && s.search_key.includes(lowerVal)) || 
        (s._lowerFull && s._lowerFull.includes(lowerVal))
    ).slice(0, 10);

    elements.streetDrop.classList.add('open');
    if (!matches.length) {
        elements.streetDrop.innerHTML = '<div class="dmsg">😕 Не знайдено</div>';
        return;
    }
    
    elements.streetDrop.innerHTML = '';
    matches.forEach(item => {
        const el = document.createElement('div');
        el.className = 'di';
        el.tabIndex = 0;
        el.innerHTML = `<div><div class="di-n">${item.full}</div></div>`;
        
        const pick = () => {
            elements.street.value = item.full;
            selectedStreetId = item.street_id;
            closeStreetDropdown();
            elements.house.focus();
        };
        
        el.onmousedown = e => { e.preventDefault(); pick(); };
        el.onkeydown = e => {
            if (e.key === 'Enter') pick();
            if (e.key === 'ArrowDown') { e.preventDefault(); el.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); el.previousElementSibling ? el.previousElementSibling.focus() : elements.street.focus(); }
        };
        elements.streetDrop.appendChild(el);
    });
}

function showHouseSuggestions(val) {
    if (!selectedStreetId) {
        elements.houseDrop.classList.add('open');
        elements.houseDrop.innerHTML = '<div class="dmsg">Спочатку оберіть вулицю</div>';
        return;
    }
    
    const streetHouses = housesData[selectedStreetId];
    if (!streetHouses) {
        elements.houseDrop.classList.add('open');
        elements.houseDrop.innerHTML = '<div class="dmsg">Немає будинків для цієї вулиці</div>';
        return;
    }
    
    const allHouses = Object.keys(streetHouses);
    const lowerVal = val.toLowerCase().replace(/[\s-]/g, '');
    
    const matches = allHouses.filter(h => h.toLowerCase().replace(/[\s-]/g, '').includes(lowerVal)).slice(0, 15);
    
    elements.houseDrop.classList.add('open');
    if (!matches.length) {
        elements.houseDrop.innerHTML = '<div class="dmsg">😕 Не знайдено</div>';
        return;
    }
    
    elements.houseDrop.innerHTML = '';
    matches.forEach(h => {
        const el = document.createElement('div');
        el.className = 'di';
        el.tabIndex = 0;
        el.innerHTML = `<div><div class="di-n">${h}</div></div>`;
        
        const pick = () => {
            elements.house.value = h;
            closeHouseDropdown();
            elements.house.dispatchEvent(new Event('blur'));
        };
        
        el.onmousedown = e => { e.preventDefault(); pick(); };
        el.onkeydown = e => {
            if (e.key === 'Enter') pick();
            if (e.key === 'ArrowDown') { e.preventDefault(); el.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); el.previousElementSibling ? el.previousElementSibling.focus() : elements.house.focus(); }
        };
        elements.houseDrop.appendChild(el);
    });
}

function resetFieldsOnChange() {
    elements.complex.value = "none";
    elements.district.value = "";
    elements.metro.value = '';
    elements.landmark.value = '';
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
    // Street Input
    elements.street.addEventListener('input', e => {
        selectedStreetId = null;
        resetFieldsOnChange();
        const v = e.target.value.trim();
        if (v.length < 2) { closeStreetDropdown(); return; }
        showStreetSuggestions(v);
    });

    elements.street.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeStreetDropdown();
        if (e.key === 'Enter') { closeStreetDropdown(); elements.house.focus(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); document.querySelector('#SD .di')?.focus(); }
    });

    // House Input
    elements.house.addEventListener('input', e => {
        resetFieldsOnChange();
        const v = e.target.value.trim();
        if (v.length === 0) { closeHouseDropdown(); return; }
        showHouseSuggestions(v);
    });

    elements.house.addEventListener('focus', e => {
        showHouseSuggestions(e.target.value.trim());
    });

    elements.house.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeHouseDropdown();
        if (e.key === 'Enter') {
            closeHouseDropdown();
            elements.house.dispatchEvent(new Event('blur'));
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); document.querySelector('#HD .di')?.focus(); }
    });

    // Outside clicks
    document.addEventListener('click', e => {
        if (!e.target.closest('#AW')) closeStreetDropdown();
        if (!e.target.closest('#H_AW')) closeHouseDropdown();
    });

    // Main Geocoding Trigger
    elements.house.addEventListener('blur', handleHouseSelection);

    // District & Complex overrides
    elements.district.addEventListener('change', async () => {
        if (silentState) return;
        const dist = elements.district.value;
        if (dist) await applyDistrictFilter(dist, elements.complex.value);
        else populateComplexDropdown();
    });

    elements.complex.addEventListener('change', async () => {
        if (silentState) return;
        const selected = elements.complex.value;
        if (selected === "all" || selected === "none") return;
        
        const dist = getDistrictForComplex(selected);
        if (dist) {
            silentState = true;
            elements.district.value = dist;
            silentState = false;
            await applyDistrictFilter(dist, selected);
        }
    });
}

// ==========================================
// Core Geo Logic
// ==========================================
async function handleHouseSelection() {
    const streetVal = elements.street.value.trim();
    const houseVal = elements.house.value.trim();
    
    if (!selectedStreetId) {
        const match = streetsData.find(x => x.full === streetVal);
        if (match) selectedStreetId = match.street_id;
    }

    if (selectedStreetId && houseVal.length > 0) {
        elements.metro.value = 'Пошук...';
        elements.landmark.value = 'Пошук...';
        
        try {
            const coords = geocodeLocal(selectedStreetId, houseVal);
            updateMap(coords.lat, coords.lon);
            const district = detectDistrictPolygon(coords.lat, coords.lon);
            
            // Auto-detect JK
            const jkName = detectResidentialComplex(selectedStreetId, houseVal);
            if (jkName) {
                const jkDistrict = getDistrictForComplex(jkName) || district;
                silentState = true;
                elements.district.value = jkDistrict;
                silentState = false;
                await applyDistrictFilter(jkDistrict, jkName);
            } else {
                elements.complex.value = "none";
            }

            await fetchLandmarks(coords.lat, coords.lon);
        } catch (error) {
            console.error(error);
            elements.metro.value = 'Помилка';
            elements.landmark.value = 'Помилка';
        }
    } else {
        resetFieldsOnChange();
    }
}

function geocodeLocal(stId, house) {
    const streetHouses = housesData[stId];
    if (!streetHouses || !streetHouses[house]) throw new Error('Будинок не знайдено');
    return { lat: streetHouses[house][0], lon: streetHouses[house][1] };
}

function updateMap(lat, lon) {
    map.setView([lat, lon], 16);
    if (marker) marker.setLatLng([lat, lon]);
    else marker = L.marker([lat, lon]).addTo(map);
}

function detectDistrictPolygon(lat, lon) {
    if (!districtPolygons || !window.turf) return null;
    const pt = turf.point([lon, lat]);
    for (const [distName, geom] of Object.entries(districtPolygons)) {
        try {
            const poly = geom.type === 'MultiPolygon' ? turf.multiPolygon(geom.coordinates) : turf.polygon(geom.coordinates);
            if (turf.booleanPointInPolygon(pt, poly)) {
                if (elements.district.value !== distName) {
                    elements.district.value = distName;
                    elements.district.dispatchEvent(new Event('change'));
                }
                return distName;
            }
        } catch (e) {
            console.error('Error polygon:', distName, e);
        }
    }
    return null;
}

function detectResidentialComplex(stId, userHouse) {
    if (!jkAddressesData) return null;
    
    const streetObj = streetsData.find(x => x.street_id === stId);
    if (!streetObj) return null;

    const cleanUserHouse = userHouse.toLowerCase().replace(/[\s-]/g, '');
    const matchUserNumber = cleanUserHouse.match(/^\d+/);
    if (!matchUserNumber) return null;

    let bestMatch = null;

    for (const jk of jkAddressesData) {
        if (!jk.address) continue;
        const addresses = jk.address.split(';');
        
        for (let addr of addresses) {
            addr = addr.toLowerCase().trim();
            let hasStreet = false;
            
            if (streetObj.current_name && addr.includes(streetObj.current_name.toLowerCase())) {
                hasStreet = true;
            } else if (streetObj.old_names && streetObj.old_names.some(old => addr.includes(old.toLowerCase()))) {
                hasStreet = true;
            }
            
            if (hasStreet) {
                const addrParts = addr.split(',');
                const cleanJKHouse = addrParts[addrParts.length - 1].replace(/[\s-]/g, '');
                const matchJKNumber = cleanJKHouse.match(/^\d+/);
                
                if (matchJKNumber && matchUserNumber[0] === matchJKNumber[0]) {
                    if (cleanJKHouse.includes(cleanUserHouse) || cleanUserHouse.includes(cleanJKHouse)) {
                        bestMatch = jk.jk_name;
                        break;
                    }
                }
            }
        }
        if (bestMatch) break;
    }
    
    return bestMatch;
}

// ==========================================
// External API (Nominatim)
// ==========================================
async function fetchLandmarks(lat, lon) {
    const delta = 0.014;
    const viewbox = `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`;
    const baseParams = { format: 'json', addressdetails: 1, bounded: 1, viewbox, countrycodes: 'ua', 'accept-language': 'uk' };
    
    const queries = [
        { ...baseParams, amenity: 'subway_entrance', limit: 10 },
        { ...baseParams, q: 'парк', limit: 8 },
        { ...baseParams, place: 'neighbourhood', limit: 5 }
    ];

    let results = [];
    for (const q of queries) {
        try {
            const res = await fetch(`${NOMINATIM_URL}/search?` + new URLSearchParams(q), { headers: NOMINATIM_HEADERS });
            if (res.ok) results.push(...(await res.json()));
        } catch (e) {
            console.error('API Error:', e);
        }
        await sleep(1000); // Nominatim 1 req/sec policy
    }

    try {
        const rev = await fetch(`${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=uk`, { headers: NOMINATIM_HEADERS });
        const dRev = await rev.json();
        const hood = dRev.address?.residential || dRev.address?.neighbourhood || dRev.address?.suburb;
        if (hood) results.push({ name: hood, lat: String(lat), lon: String(lon), class: 'place', type: 'neighbourhood', isReverse: true });
    } catch(e) {}

    const sorted = [
        ...results.filter(x => x.isReverse),
        ...results.filter(x => !x.isReverse).sort((a,b) => getHaversineDistance(lat, lon, parseFloat(a.lat), parseFloat(a.lon)) - getHaversineDistance(lat, lon, parseFloat(b.lat), parseFloat(b.lon)))
    ];

    let metros = [], orientirs = [], seen = new Set();
    
    for (let item of sorted) {
        const name = getPlaceName(item);
        if (!name) continue;
        
        const type = getPlaceType(item);
        if (!['metro', 'ngb', 'prk'].includes(type)) continue;

        if (type === 'prk' && !/парк|сквер|сад/i.test(name)) continue;
        if (type === 'metro' && !/метро|subway/i.test(name) && item.class !== 'railway') continue;

        const key = (name + type).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        if (type === 'metro') metros.push(name);
        else orientirs.push(name);
    }

    elements.metro.value = metros.length > 0 ? metros[0] : 'Нет';
    elements.landmark.value = orientirs.length > 0 ? orientirs.slice(0, 3).join(', ') : 'Нет';
}

// ==========================================
// Complex & District Mapping
// ==========================================
function getDistrictForComplex(jkName) {
    if (!jkAddressesData) return null;
    const jk = jkAddressesData.find(x => x.jk_name === jkName);
    return jk ? jk.district : null;
}

function resetComplexDropdown() {
    elements.complex.innerHTML = "";
    elements.complex.append(new Option("Все", "all"));
    elements.complex.append(new Option("Нет", "none"));
}

function populateComplexDropdown() {
    resetComplexDropdown();
    
    if (jkAddressesData) {
        const names = jkAddressesData.map(j => j.jk_name).filter(Boolean).sort((a,b) => a.localeCompare(b, "ru"));
        names.forEach(n => elements.complex.append(new Option(n, n)));
    }
}

async function applyDistrictFilter(districtName, keepValue = null) {
    resetComplexDropdown();

    if (!districtName || !jkAddressesData) return;

    const filteredNames = jkAddressesData
        .filter(jk => jk.district === districtName && jk.jk_name)
        .map(jk => jk.jk_name)
        .sort((a,b) => a.localeCompare(b, "ru"));

    filteredNames.forEach(n => elements.complex.append(new Option(n, n)));

    const options = Array.from(elements.complex.options).map(o => o.value);
    if (keepValue && options.includes(keepValue)) {
        elements.complex.value = keepValue;
    } else {
        elements.complex.value = keepValue && keepValue !== "all" && keepValue !== "none" ? "none" : "all";
    }
}
