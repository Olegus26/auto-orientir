// ==========================================
// Constants & Configuration
// ==========================================
const MAP_INITIAL_COORDS = [49.9935, 36.2304];
const MAP_INITIAL_ZOOM = 12;

const DISTRICT_BY_ID = {
    1: "Немишлянський р-н",
    2: "Індустріальний р-н",
    3: "Шевченківський р-н",
    4: "Київський р-н",
    5: "Салтівський р-н",
    6: "Холодногірський р-н",
    7: "Новобаварський р-н",
    8: "Основ'янський р-н",
    9: "Слобідський р-н"
};

const DISTRICTS = [
    "Індустріальний р-н",
    "Київський р-н",
    "Немишлянський р-н",
    "Новобаварський р-н",
    "Основ'янський р-н",
    "Салтівський р-н",
    "Слобідський р-н",
    "Холодногірський р-н",
    "Шевченківський р-н",
    "Передмістя"
];

// Semantic RU -> UA translations for Kharkiv street roots
const RU_UA_ROOTS = [
    [/героев\s+труда/g, 'героїв праці'],
    [/героев\s+харькова/g, 'героїв харкова'],
    [/героев\s+сталинграда/g, 'героїв сталінграда'],
    [/дружбы\s+народов/g, 'дружби народів'],
    [/50[-\s]*(?:лет|річчя|років)/g, 'пятдесятиріччя'],
    [/60[-\s]*(?:лет|річчя|років)/g, 'шістдесятиріччя'],
    [/(\d+)[-\s]*лет(?=\s|$)/g, '$1 річчя'],
    [/23(?:-го)?\s+(?:августа|серпня)/g, '23 серпня двадцять третього серпня'],
    [/тракторостроителей/g, 'тракторобудівників'],
    [/машиностроителей/g, 'машинобудівників'],
    [/метростроителей/g, 'метробудівників'],
    [/станкостроителей/g, 'верстатобудівників'],
    [/строителей/g, 'будівельників'],
    [/тракторостроител/g, 'тракторобудівник'],
    [/строител/g, 'будівельник'],
    [/гвардейц/g, 'гвардійц'],
    [/железнодорож/g, 'залізнич'],
    [/независимост/g, 'незалежност'],
    [/защитник/g, 'захисник'],
    [/непокоренн/g, 'нескорен'],
    [/возрожден/g, 'відроджен'],
    [/просвещен/g, 'просвіт'],
    [/побед[ыа](?=\s|$)/g, 'перемоги'],
    [/труда(?=\s|$)/g, 'праці'],
    [/целиноград/g, 'цілиноград'],
    [/белгород/g, 'білгород'],
    [/кольцев/g, 'кільцев'],
    [/северн/g, 'північн'],
    [/южн/g, 'південн'],
    [/восточн/g, 'східн'],
    [/западн/g, 'західн'],
    [/красно/g, 'червоно'],
    [/красн/g, 'червон'],
    [/октябр/g, 'жовтн'],
    [/января/g, 'січня'],
    [/февраля/g, 'лютого'],
    [/марта/g, 'березня'],
    [/апреля/g, 'квітня'],
    [/мая(?=\s|$)/g, 'травня'],
    [/июня/g, 'червня'],
    [/июля/g, 'липня'],
    [/августа/g, 'серпня'],
    [/сентября/g, 'вересня'],
    [/ноября/g, 'листопада'],
    [/декабря/g, 'грудня'],
    [/путейск/g, 'колійськ'],
    [/кузнечн/g, 'ковальськ'],
    [/больничн/g, 'лікарнян'],
    [/цветочн/g, 'квітков'],
    [/звездн/g, 'зорян'],
    [/радужн/g, 'райдужн'],
    [/весенн/g, 'веснян'],
    [/лесн(ая|ой)/g, 'лісов'],
    [/полев(ая|ой)/g, 'польов'],
    [/речн(ая|ой)/g, 'річков']
];

const naturalCollator = new Intl.Collator(['uk', 'ru', 'en'], { numeric: true, sensitivity: 'base' });

// ==========================================
// Global State & Data
// ==========================================
let map = null;
let marker = null;
let activeDistrictLayer = null;

let streetsData = [];
let streetById = new Map();
let housesData = {};
let streetNormHouses = new Map(); // stId -> Map(normHouseKey -> canonicalLabel)
let flatHouses = [];              // [{ lat, lon, stId, house, distId, postCode }]

let districtPolygons = null;
let jkList = [];
let houseToJKMap = new Map();     // `${stId}:${normHouse}` -> jkObj
let metroData = [];
let landmarksData = [];

let selectedStreetId = null;
let selectedJK = null;
let nearbyLandmarkPool = [];
let silentState = false;
let houseInputTimer = null;

// DOM Elements
const elements = {
    dbStats: document.getElementById('db_stats'),
    quickAddress: document.getElementById('quick_address'),
    btnQuickParse: document.getElementById('btn_quick_parse'),
    btnClear: document.getElementById('btn_clear'),
    btnCopyAll: document.getElementById('btn_copy_all'),
    street: document.getElementById('street'),
    clearStreet: document.getElementById('clear_street'),
    streetRenameBadge: document.getElementById('street_rename_badge'),
    house: document.getElementById('house_number'),
    apartment: document.getElementById('apartment_number'),
    postalCode: document.getElementById('postal_code'),
    jkHousesBar: document.getElementById('jk_houses_bar'),
    district: document.getElementById('district'),
    complexSearch: document.getElementById('complex_search'),
    clearJK: document.getElementById('clear_jk'),
    complexSelect: document.getElementById('complex'),
    jkClass: document.getElementById('jk_class'),
    landmark: document.getElementById('landmark'),
    landmarkChips: document.getElementById('landmark_chips'),
    metro: document.getElementById('metro'),
    metroHint: document.getElementById('metro_hint'),
    metroChips: document.getElementById('metro_chips'),
    streetDrop: document.getElementById('SD'),
    houseDrop: document.getElementById('HD'),
    jkDrop: document.getElementById('JKD'),
    mapStatus: document.getElementById('map_status'),
    mapLinks: document.getElementById('map_links'),
    coordsDisplay: document.getElementById('coords_display'),
    gmapsLink: document.getElementById('gmaps_link'),
    toast: document.getElementById('toast')
};

// ==========================================
// Normalization & Distance Helpers
// ==========================================
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function formatDist(meters) {
    if (meters < 1000) return `${meters} м`;
    return `${(meters / 1000).toFixed(1)} км`;
}

function normalizeStreetTypes(str) {
    return str
        .replace(/(^|\s)(улица|ул\.?|вулиця|вул\.?)(?=\s|$)/g, '$1вул')
        .replace(/(^|\s)(проспект|просп\.?|пр-т|пр\.?)(?=\s|$)/g, '$1просп')
        .replace(/(^|\s)(переулок|пер\.?|провулок|пров\.?)(?=\s|$)/g, '$1пров')
        .replace(/(^|\s)(бульвар|бул\.?|б-р)(?=\s|$)/g, '$1бр')
        .replace(/(^|\s)(въезд|в'їзд|в’їзд|в-д)(?=\s|$)/g, '$1вд')
        .replace(/(^|\s)(проезд|проїзд|пр-д)(?=\s|$)/g, '$1прд')
        .replace(/(^|\s)(набережная|набережна|наб\.?)(?=\s|$)/g, '$1наб')
        .replace(/(^|\s)(спуск|узвіз|узв\.?)(?=\s|$)/g, '$1узв')
        .replace(/(^|\s)(площадь|пл\.?|майдан|м-н)(?=\s|$)/g, '$1мн')
        .replace(/(^|\s)(шоссе|шосе)(?=\s|$)/g, '$1шосе')
        .replace(/(^|\s)(тупик|туп\.?)(?=\s|$)/g, '$1туп')
        .replace(/(^|\s)(аллея|алея)(?=\s|$)/g, '$1алея');
}

function normalizePhonetic(raw) {
    if (!raw) return '';
    let s = raw.toLowerCase().trim();
    // Strip word-internal apostrophes (Дерев'янка -> деревянка, М'ясницька -> мясницька)
    s = s.replace(/['’`ʼ]/g, '').replace(/["«»().,]/g, ' ').replace(/-/g, ' ');
    s = normalizeStreetTypes(s);

    for (const [rx, rep] of RU_UA_ROOTS) {
        s = s.replace(rx, rep);
    }

    // Unify UA/RU adjective & surname endings (note: use (?=\s|$) instead of \b for Cyrillic!)
    s = s
        .replace(/(?:овская|евская|івська|ївська|ьовська)(?=\s|$)/g, 'овска')
        .replace(/(?:овский|евский|івський|ївський|ьовський)(?=\s|$)/g, 'овски')
        .replace(/(?:ческая|чна)(?=\s|$)/g, 'чна')
        .replace(/(?:ческий|чний)(?=\s|$)/g, 'чни')
        .replace(/(?:цкая|цька)(?=\s|$)/g, 'цка')
        .replace(/(?:цкий|цький)(?=\s|$)/g, 'цки')
        .replace(/(?:цкого|цького)(?=\s|$)/g, 'цкого')
        .replace(/(?:ская|ська)(?=\s|$)/g, 'ска')
        .replace(/(?:ский|ський)(?=\s|$)/g, 'ски')
        .replace(/(?:ских|ських)(?=\s|$)/g, 'ских')
        .replace(/(?:ского|ського)(?=\s|$)/g, 'ского')
        .replace(/цев(?=\s|$)/g, 'цив')
        .replace(/нко(?=\s|$)/g, 'нка');

    // Fold vowels/consonants
    s = s
        .replace(/ії/g, 'и')
        .replace(/[іїы]/g, 'и')
        .replace(/[єэё]/g, 'е')
        .replace(/ґ/g, 'г')
        .replace(/[ьъ]/g, '');

    // Collapse double letters ("мангеттен" == "мангетен", "філіппова" == "филипова")
    s = s.replace(/([а-яіїєґa-z])\1+/g, '$1');
    return s.replace(/\s+/g, ' ').trim();
}

function normHouseKey(raw) {
    if (!raw) return '';
    let s = String(raw).toLowerCase().trim();
    s = s.replace(/корпус|корп\.?|к\./g, 'к').replace(/№/g, '');
    // Convert Latin lookalike letters to Ukrainian/Cyrillic
    const latToCyr = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', i: 'і' };
    s = s.replace(/[abcehkmoptxyi]/g, ch => latToCyr[ch] || ch);
    // Allow "165 к 1" == "165, корп. 1"
    s = s.replace(/(\d|[а-яіїєґ])\s+к\s*(\d)/g, '$1к$2');
    return s.replace(/[\s,\-.]/g, '');
}

function showToast(msg) {
    elements.toast.textContent = msg;
    elements.toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { elements.toast.hidden = true; }, 2400);
}

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    initDistrictDropdown();
    await loadAllData();
    setupEventListeners();
});

function initMap() {
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    });

    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri Satellite'
    });

    map = L.map('map', {
        center: MAP_INITIAL_COORDS,
        zoom: MAP_INITIAL_ZOOM,
        layers: [osmLayer]
    });

    L.control.layers(
        { 'Схема (OSM)': osmLayer, 'Спутник (Esri)': satLayer },
        null,
        { position: 'topright' }
    ).addTo(map);

    map.on('click', e => handleMapClickOrDrag(e.latlng.lat, e.latlng.lng, 'Клик на карте'));
}

function initDistrictDropdown() {
    DISTRICTS.forEach(d => elements.district.append(new Option(d, d)));
}

async function loadAllData() {
    try {
        const [streets, houses, polygons, jks, metro, landmarks] = await Promise.all([
            fetch('data/streets.json').then(r => r.json()),
            fetch('data/houses.json').then(r => r.json()),
            fetch('data/districts.json').then(r => r.json()),
            fetch('data/complexes.json').then(r => r.json()),
            fetch('data/metro.json').then(r => r.ok ? r.json() : []).catch(() => []),
            fetch('data/landmarks.json').then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        housesData = houses;
        districtPolygons = polygons;
        metroData = metro;
        landmarksData = landmarks;

        // Index houses for instant normalized lookup & reverse geocoding
        flatHouses = [];
        streetNormHouses.clear();
        for (const [stIdStr, hMap] of Object.entries(houses)) {
            const stId = Number(stIdStr);
            const nMap = new Map();
            const sortedLabels = Object.keys(hMap).sort(naturalCollator.compare);
            for (const label of sortedLabels) {
                const arr = hMap[label];
                nMap.set(normHouseKey(label), label);
                flatHouses.push({
                    lat: arr[0],
                    lon: arr[1],
                    stId,
                    house: label,
                    distId: arr[2] || 0,
                    postCode: arr[3] || 0
                });
            }
            streetNormHouses.set(stId, nMap);
        }

        // Index streets with phonetic & old-name search keys
        streetById.clear();
        streetsData = streets.map(s => {
            const typePart = s.short_type ? ` ${s.short_type}` : '';
            let display = `${s.current_name}${typePart}`;
            if (s.old_names && s.old_names.length > 0) {
                display += ` (колиш. ${s.old_names.join(', ')})`;
            }
            const houseCount = houses[s.street_id] ? Object.keys(houses[s.street_id]).length : 0;
            const distNames = (s.districts || []).map(id => DISTRICT_BY_ID[id]).filter(Boolean);

            const normCurrent = normalizePhonetic(s.current_name);
            const normType = normalizePhonetic(s.short_type || s.type_name || '');
            const normOldList = (s.old_names || []).map(normalizePhonetic).filter(Boolean);
            const normAliasList = (s.aliases || []).map(normalizePhonetic).filter(Boolean);
            const combinedPhonetic = [normCurrent, normType, ...normOldList, ...normAliasList].join(' ');

            const obj = {
                ...s,
                full: display,
                shortDisplay: `${s.current_name}${typePart}`,
                houseCount,
                distNames,
                _normCurrent: normCurrent,
                _normType: normType,
                _normOldList: normOldList,
                _normAliasList: normAliasList,
                _phoneticAll: combinedPhonetic
            };
            streetById.set(s.street_id, obj);
            return obj;
        });

        // Index residential complexes
        houseToJKMap.clear();
        jkList = jks.map(jk => {
            const enriched = {
                ...jk,
                _normName: normalizePhonetic(jk.jk_name),
                _normAddr: normalizePhonetic((jk.address || '') + ' ' + (jk.raw_address || ''))
            };
            if (Array.isArray(jk.houses)) {
                for (const [stId, hLabel] of jk.houses) {
                    const key = `${stId}:${normHouseKey(hLabel)}`;
                    if (!houseToJKMap.has(key)) houseToJKMap.set(key, enriched);
                }
            }
            return enriched;
        });

        syncHiddenComplexSelect();

        elements.dbStats.textContent = `${streetsData.length.toLocaleString('ru-RU')} улиц • ${flatHouses.length.toLocaleString('ru-RU')} домов • ${jkList.length} ЖК`;
    } catch (e) {
        console.error('Ошибка загрузки базы данных:', e);
        elements.dbStats.textContent = 'Ошибка загрузки базы';
    }
}

function syncHiddenComplexSelect(districtFilter = '') {
    elements.complexSelect.innerHTML = '';
    elements.complexSelect.append(new Option('Все', 'all'));
    elements.complexSelect.append(new Option('Нет', 'none'));
    const list = districtFilter ? jkList.filter(j => j.district === districtFilter) : jkList;
    list.forEach(j => elements.complexSelect.append(new Option(j.jk_name, j.jk_name)));
    elements.complexSelect.value = selectedJK ? selectedJK.jk_name : 'none';
}

// ==========================================
// Smart Street Search & Quick Address Parser
// ==========================================
function searchStreetsRanked(query, limit = 12) {
    const qNorm = normalizePhonetic(query);
    if (!qNorm) return [];
    const tokens = qNorm.split(' ').filter(Boolean);
    if (!tokens.length) return [];

    // Separate street-type tokens from name tokens if user typed e.g. "просп гагарина"
    const typeSet = new Set(['вул', 'просп', 'пров', 'бр', 'вд', 'прд', 'наб', 'узв', 'мн', 'шосе', 'туп', 'алея']);
    const typeTokens = tokens.filter(t => typeSet.has(t));
    const nameTokens = tokens.filter(t => !typeSet.has(t));
    const effectiveTokens = nameTokens.length > 0 ? tokens : typeTokens;
    const mainQuery = (nameTokens.length > 0 ? nameTokens : tokens).join(' ');

    const scored = [];
    for (const st of streetsData) {
        let allMatch = true;
        for (const tk of effectiveTokens) {
            if (!st._phoneticAll.includes(tk)) {
                allMatch = false;
                break;
            }
        }
        if (!allMatch) continue;

        let score = 10;
        if (st._normCurrent === mainQuery) score += 120;
        else if (st._normCurrent.startsWith(mainQuery)) score += 90;
        else if ((' ' + st._normCurrent).includes(' ' + mainQuery)) score += 65;

        let matchedOld = null;
        for (let i = 0; i < st._normOldList.length; i++) {
            const oldN = st._normOldList[i];
            if (oldN === mainQuery) {
                score = Math.max(score, 105);
                matchedOld = st.old_names[i];
                break;
            } else if (oldN.startsWith(mainQuery)) {
                score = Math.max(score, 80);
                matchedOld = st.old_names[i];
            } else if ((' ' + oldN).includes(' ' + mainQuery)) {
                score = Math.max(score, 55);
                matchedOld = st.old_names[i];
            }
        }

        for (const al of st._normAliasList) {
            if (al === mainQuery) score = Math.max(score, 100);
            else if (al.startsWith(mainQuery)) score = Math.max(score, 75);
        }

        // Boost if user explicitly specified matching street type (e.g. "просп" vs "пров")
        if (typeTokens.length > 0) {
            if (typeTokens.includes(st._normType)) score += 35;
            else score -= 20;
        }

        // Tie-break by number of registered buildings so major streets rank above tiny lanes
        score += Math.min(st.houseCount, 300) / 25;

        scored.push({ st, score, matchedOld });
    }

    scored.sort((a, b) => b.score - a.score || naturalCollator.compare(a.st.current_name, b.st.current_name));
    return scored.slice(0, limit);
}

function parseQuickAddress(rawInput) {
    if (!rawInput || rawInput.trim().length < 3) return null;
    let s = rawInput.trim();

    // Strip city/country/postal prefixes
    s = s.replace(/\b61\d{3}\b/g, ' ');
    s = s.replace(/^(?:україна|украина|харківська\s+обл\.?|харьковская\s+обл\.?|м\.\s*харків|г\.\s*харьков|харків|харьков)[\s,]+/gi, '');
    s = s.replace(/^(?:м\.\s*харків|г\.\s*харьков|харків|харьков)[\s,]+/gi, '');

    // Extract apartment/office at end
    let apartment = '';
    const aptMatch = s.match(/(?:,|\s)+(?:кв\.?|квартира|оф\.?|офіс|офис|кімн\.?)\s*№?\s*([0-9а-яa-zіїєґ-]+)\s*$/i);
    if (aptMatch) {
        apartment = aptMatch[1];
        s = s.slice(0, aptMatch.index).trim();
    }

    // Extract house (+ optional block/korpus) at end
    // Be careful not to eat street numbers like "вул. 23 Серпня" or "вул. 92-ї бригади" when no house is given
    let houseCandidate = '';
    let streetCandidate = s;

    const houseRegex = /^(.*?)(?:,|\s+)(?:буд\.?|будинок|дом|д\.?)?\s*№?\s*(\d+\s*(?:[-/]\s*[0-9а-яa-zіїєґ]+|[а-яa-zіїєґ])?(?:\s*,?\s*(?:корп(?:ус|\.)?|к\.?)\s*№?\s*[0-9а-яa-zіїєґ-]+)?)\s*$/i;
    const hm = s.match(houseRegex);
    if (hm && hm[1].trim().length >= 2) {
        streetCandidate = hm[1].replace(/[,\s]+$/, '').trim();
        houseCandidate = hm[2].trim();
    }

    // Remove parenthetical old-name hints if user pasted e.g. "Нескорених (Героїв Праці)"
    const streetClean = streetCandidate.replace(/\(([^)]*)\)/g, ' $1 ').replace(/\s+/g, ' ').trim();
    const ranked = searchStreetsRanked(streetClean, 5);
    if (!ranked.length) {
        // Fallback: try whole string as street without splitting house (e.g. "23 Серпня")
        const wholeRanked = searchStreetsRanked(s, 3);
        if (!wholeRanked.length) return null;
        return { street: wholeRanked[0].st, house: '', apartment };
    }

    const bestStreet = ranked[0].st;
    let resolvedHouse = houseCandidate;
    if (houseCandidate) {
        const nMap = streetNormHouses.get(bestStreet.street_id);
        const nk = normHouseKey(houseCandidate);
        if (nMap && nMap.has(nk)) {
            resolvedHouse = nMap.get(nk);
        }
    }

    return { street: bestStreet, house: resolvedHouse, apartment };
}

// ==========================================
// Dropdowns UI
// ==========================================
function closeStreetDropdown() { elements.streetDrop.classList.remove('open'); }
function closeHouseDropdown() { elements.houseDrop.classList.remove('open'); }
function closeJKDropdown() { elements.jkDrop.classList.remove('open'); }

function showStreetSuggestions(val) {
    const results = searchStreetsRanked(val, 12);
    elements.streetDrop.classList.add('open');
    elements.streetDrop.innerHTML = '';

    // Check if user typed "Street + House" directly in the street field (e.g. "Сумская 25")
    if (results.length === 0) {
        const parsed = parseQuickAddress(val);
        if (parsed && parsed.street && parsed.house) {
            const el = document.createElement('div');
            el.className = 'di';
            el.tabIndex = 0;
            el.innerHTML = `
                <div class="di-main">
                    <div class="di-n">⚡ ${parsed.street.shortDisplay}, буд. ${parsed.house}</div>
                    <div class="di-s">Быстрый переход к адресу${parsed.street.old_names?.length ? ' (колиш. ' + parsed.street.old_names.join(', ') + ')' : ''}</div>
                </div>
                <span class="di-tag">Адрес</span>
            `;
            const pickParsed = () => {
                closeStreetDropdown();
                applySelectedStreetAndHouse(parsed.street, parsed.house, parsed.apartment);
            };
            el.onmousedown = e => { e.preventDefault(); pickParsed(); };
            el.onkeydown = e => { if (e.key === 'Enter') pickParsed(); };
            elements.streetDrop.appendChild(el);
            return;
        }

        elements.streetDrop.innerHTML = '<div class="dmsg">😕 Улица не найдена в реестре Харькова</div>';
        return;
    }

    results.forEach(({ st }) => {
        const el = document.createElement('div');
        el.className = 'di';
        el.tabIndex = 0;

        const subParts = [];
        if (st.old_names && st.old_names.length > 0) {
            subParts.push(`колиш. ${st.old_names.join(', ')}`);
        }
        if (st.distNames && st.distNames.length > 0) {
            subParts.push(st.distNames.map(d => d.replace(' р-н', '')).join(', ') + ' р-н');
        }

        el.innerHTML = `
            <div class="di-main">
                <div class="di-n">${st.shortDisplay}</div>
                ${subParts.length ? `<div class="di-s">${subParts.join(' • ')}</div>` : ''}
            </div>
            <span class="di-tag">${st.houseCount} буд.</span>
        `;

        const pick = () => {
            selectStreetObject(st);
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

function selectStreetObject(st) {
    selectedStreetId = st.street_id;
    elements.street.value = st.full;
    elements.clearStreet.hidden = false;
    if (st.old_names && st.old_names.length > 0) {
        elements.streetRenameBadge.textContent = `колиш. ${st.old_names[0]}`;
        elements.streetRenameBadge.title = `Колишні назви: ${st.old_names.join(', ')}`;
        elements.streetRenameBadge.hidden = false;
    } else {
        elements.streetRenameBadge.hidden = true;
    }
}

function showHouseSuggestions(val) {
    if (!selectedStreetId) {
        const typedSt = elements.street.value.trim();
        if (typedSt.length >= 2) {
            const exact = streetsData.find(s => s.full.toLowerCase() === typedSt.toLowerCase() || s.shortDisplay.toLowerCase() === typedSt.toLowerCase());
            if (exact) selectStreetObject(exact);
        }
    }

    if (!selectedStreetId) {
        elements.houseDrop.classList.add('open');
        elements.houseDrop.innerHTML = '<div class="dmsg">Сначала выберите улицу</div>';
        return;
    }

    const streetHouses = housesData[selectedStreetId];
    if (!streetHouses) {
        elements.houseDrop.classList.add('open');
        elements.houseDrop.innerHTML = '<div class="dmsg">Для этой улицы в реестре нет отдельных домов</div>';
        return;
    }

    const allHouses = Object.keys(streetHouses).sort(naturalCollator.compare);
    const qNorm = normHouseKey(val);

    let matches;
    if (!qNorm) {
        matches = allHouses.slice(0, 30);
    } else {
        const starts = [];
        const contains = [];
        for (const h of allHouses) {
            const hk = normHouseKey(h);
            if (hk.startsWith(qNorm)) starts.push(h);
            else if (hk.includes(qNorm)) contains.push(h);
        }
        matches = [...starts, ...contains].slice(0, 25);
    }

    elements.houseDrop.classList.add('open');
    if (!matches.length) {
        elements.houseDrop.innerHTML = '<div class="dmsg">Нет точного номера в реестре (при вводе определим по улице)</div>';
        return;
    }

    elements.houseDrop.innerHTML = '';
    matches.forEach(h => {
        const info = streetHouses[h];
        const distName = info && info[2] ? DISTRICT_BY_ID[info[2]]?.replace(' р-н', '') : '';
        const jkMatch = houseToJKMap.get(`${selectedStreetId}:${normHouseKey(h)}`);

        const el = document.createElement('div');
        el.className = 'di';
        el.tabIndex = 0;
        el.innerHTML = `
            <div class="di-main">
                <div class="di-n">${h}</div>
                ${jkMatch ? `<div class="di-s">${jkMatch.jk_name}</div>` : ''}
            </div>
            ${distName ? `<span class="di-tag">${distName}</span>` : ''}
        `;

        const pick = () => {
            elements.house.value = h;
            closeHouseDropdown();
            handleHouseSelection();
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

function showJKSuggestions(val) {
    const distFilter = elements.district.value;
    const qNorm = normalizePhonetic(val);

    let pool = jkList;
    if (distFilter && !qNorm) {
        pool = jkList.filter(j => j.district === distFilter);
    }

    let matches = pool;
    if (qNorm) {
        const tokens = qNorm.split(' ').filter(Boolean);
        matches = jkList.filter(j => tokens.every(tk => j._normName.includes(tk) || j._normAddr.includes(tk)));
        matches.sort((a, b) => {
            const aStarts = a._normName.includes(qNorm) ? 1 : 0;
            const bStarts = b._normName.includes(qNorm) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;
            return naturalCollator.compare(a.jk_name, b.jk_name);
        });
    }

    elements.jkDrop.classList.add('open');
    elements.jkDrop.innerHTML = '';

    // Option "Нет (без ЖК)"
    if (!qNorm) {
        const noneEl = document.createElement('div');
        noneEl.className = 'di';
        noneEl.tabIndex = 0;
        noneEl.innerHTML = '<div class="di-main"><div class="di-n" style="color:#64748b;">— Нет (вторичный фонд / частный сектор)</div></div>';
        noneEl.onmousedown = e => { e.preventDefault(); clearSelectedJK(); closeJKDropdown(); };
        elements.jkDrop.appendChild(noneEl);
    }

    const shown = matches.slice(0, 30);
    if (!shown.length) {
        elements.jkDrop.innerHTML = '<div class="dmsg">😕 ЖК не найден</div>';
        return;
    }

    shown.forEach(jk => {
        const el = document.createElement('div');
        el.className = 'di';
        el.tabIndex = 0;
        const sub = [jk.district, jk.address ? jk.address.split(';')[0] : ''].filter(Boolean).join(' • ');
        el.innerHTML = `
            <div class="di-main">
                <div class="di-n">${jk.jk_name}</div>
                ${sub ? `<div class="di-s">${sub}</div>` : ''}
            </div>
            ${jk.class ? `<span class="di-tag">${jk.class}</span>` : ''}
        `;

        const pick = () => {
            closeJKDropdown();
            applyManualJKSelection(jk);
        };
        el.onmousedown = e => { e.preventDefault(); pick(); };
        el.onkeydown = e => {
            if (e.key === 'Enter') pick();
            if (e.key === 'ArrowDown') { e.preventDefault(); el.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); el.previousElementSibling ? el.previousElementSibling.focus() : elements.complexSearch.focus(); }
        };
        elements.jkDrop.appendChild(el);
    });
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
    // Quick Parse Bar
    const triggerQuickParse = () => {
        const raw = elements.quickAddress.value.trim();
        if (!raw) return;
        const parsed = parseQuickAddress(raw);
        if (!parsed) {
            showToast('Не удалось распознать улицу Харькова в строке');
            return;
        }
        applySelectedStreetAndHouse(parsed.street, parsed.house, parsed.apartment);
        showToast(`Распознано: ${parsed.street.shortDisplay}${parsed.house ? ', ' + parsed.house : ''}`);
    };
    elements.btnQuickParse.addEventListener('click', triggerQuickParse);
    elements.quickAddress.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); triggerQuickParse(); }
    });

    // Clear & Copy buttons
    elements.btnClear.addEventListener('click', clearEntireForm);
    elements.btnCopyAll.addEventListener('click', copyFullCard);

    document.querySelectorAll('.mini-copy').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.copyTarget);
            if (target && target.value.trim()) {
                navigator.clipboard.writeText(target.value.trim());
                showToast('Скопировано в буфер обмена');
            }
        });
    });

    elements.coordsDisplay.addEventListener('click', () => {
        if (elements.coordsDisplay.textContent) {
            navigator.clipboard.writeText(elements.coordsDisplay.textContent);
            showToast('Координаты скопированы');
        }
    });

    // Street Input
    elements.street.addEventListener('input', e => {
        selectedStreetId = null;
        elements.streetRenameBadge.hidden = true;
        const v = e.target.value.trim();
        elements.clearStreet.hidden = v.length === 0;
        if (v.length < 2) { closeStreetDropdown(); return; }
        showStreetSuggestions(v);
    });

    elements.street.addEventListener('focus', e => {
        const v = e.target.value.trim();
        if (v.length >= 2 && !selectedStreetId) showStreetSuggestions(v);
    });

    elements.street.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeStreetDropdown();
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstMatch = searchStreetsRanked(elements.street.value.trim(), 1);
            if (!selectedStreetId && firstMatch.length) {
                selectStreetObject(firstMatch[0].st);
            }
            closeStreetDropdown();
            elements.house.focus();
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); elements.streetDrop.querySelector('.di')?.focus(); }
    });

    elements.clearStreet.addEventListener('click', () => {
        elements.street.value = '';
        elements.house.value = '';
        elements.clearStreet.hidden = true;
        elements.streetRenameBadge.hidden = true;
        selectedStreetId = null;
        resetAutoComputedFields();
        elements.street.focus();
    });

    // House Input
    elements.house.addEventListener('input', e => {
        const v = e.target.value.trim();
        showHouseSuggestions(v);
        clearTimeout(houseInputTimer);
        if (selectedStreetId && v.length > 0) {
            const nMap = streetNormHouses.get(selectedStreetId);
            if (nMap && nMap.has(normHouseKey(v))) {
                houseInputTimer = setTimeout(() => handleHouseSelection(), 380);
            }
        }
    });

    elements.house.addEventListener('focus', e => {
        showHouseSuggestions(e.target.value.trim());
    });

    elements.house.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeHouseDropdown();
        if (e.key === 'Enter') {
            e.preventDefault();
            closeHouseDropdown();
            handleHouseSelection();
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); elements.houseDrop.querySelector('.di')?.focus(); }
    });

    elements.house.addEventListener('blur', () => {
        clearTimeout(houseInputTimer);
        setTimeout(() => {
            if (document.activeElement?.closest('#HD')) return;
            handleHouseSelection();
        }, 120);
    });

    // JK Search Input
    elements.complexSearch.addEventListener('focus', () => {
        showJKSuggestions(selectedJK ? '' : elements.complexSearch.value.trim());
    });

    elements.complexSearch.addEventListener('input', e => {
        const v = e.target.value.trim();
        elements.clearJK.hidden = v.length === 0;
        if (!v) selectedJK = null;
        showJKSuggestions(v);
    });

    elements.complexSearch.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeJKDropdown();
        if (e.key === 'ArrowDown') { e.preventDefault(); elements.jkDrop.querySelector('.di')?.focus(); }
    });

    elements.clearJK.addEventListener('click', () => {
        clearSelectedJK();
        elements.jkHousesBar.hidden = true;
    });

    // District Change
    elements.district.addEventListener('change', () => {
        if (silentState) return;
        const dist = elements.district.value;
        highlightDistrictPolygon(dist);
        syncHiddenComplexSelect(dist);
    });

    // Sync Landmark Chips when user manually edits textarea
    elements.landmark.addEventListener('input', syncLandmarkChipStates);

    // Close dropdowns on outside click
    document.addEventListener('click', e => {
        if (!e.target.closest('#AW')) closeStreetDropdown();
        if (!e.target.closest('#H_AW')) closeHouseDropdown();
        if (!e.target.closest('#JK_AW')) closeJKDropdown();
    });
}

// ==========================================
// Core Geocoding & Resolution Logic
// ==========================================
function applySelectedStreetAndHouse(stObj, houseVal = '', aptVal = '') {
    selectStreetObject(stObj);
    elements.house.value = houseVal || '';
    elements.apartment.value = aptVal || '';
    if (houseVal) {
        handleHouseSelection();
    } else {
        // Center on street bounds even before house is entered
        const b = stObj.map_bounds;
        if (b && b.top_lat && b.bottom_lat) {
            const cLat = (b.top_lat + b.bottom_lat) / 2;
            const cLon = (b.top_lon + b.bottom_lon) / 2;
            map.setView([cLat, cLon], 15);
        }
        elements.house.focus();
    }
}

function handleHouseSelection() {
    const streetVal = elements.street.value.trim();
    const rawHouse = elements.house.value.trim();

    if (!selectedStreetId && streetVal.length >= 2) {
        const exact = streetsData.find(x => x.full.toLowerCase() === streetVal.toLowerCase() || x.shortDisplay.toLowerCase() === streetVal.toLowerCase());
        if (exact) {
            selectStreetObject(exact);
        } else {
            const top = searchStreetsRanked(streetVal, 1);
            if (top.length && top[0].score >= 85) selectStreetObject(top[0].st);
        }
    }

    if (!selectedStreetId || !rawHouse) return;

    const stObj = streetById.get(selectedStreetId);
    const streetHouses = housesData[selectedStreetId];
    const nMap = streetNormHouses.get(selectedStreetId);
    const nk = normHouseKey(rawHouse);

    let lat, lon, officialDist = null, postCode = 0, exactHouseLabel = rawHouse, isApproximate = false;

    if (streetHouses && nMap && nMap.has(nk)) {
        exactHouseLabel = nMap.get(nk);
        elements.house.value = exactHouseLabel;
        const arr = streetHouses[exactHouseLabel];
        lat = arr[0];
        lon = arr[1];
        officialDist = arr[2] ? DISTRICT_BY_ID[arr[2]] : null;
        postCode = arr[3] || 0;
    } else {
        // Graceful fallback to street center if house is brand new / not in registry
        isApproximate = true;
        if (streetHouses && Object.keys(streetHouses).length > 0) {
            const vals = Object.values(streetHouses);
            const mid = vals[Math.floor(vals.length / 2)];
            lat = mid[0];
            lon = mid[1];
            officialDist = mid[2] ? DISTRICT_BY_ID[mid[2]] : null;
            postCode = mid[3] || 0;
        } else if (stObj && stObj.map_bounds && stObj.map_bounds.top_lat) {
            lat = (stObj.map_bounds.top_lat + stObj.map_bounds.bottom_lat) / 2;
            lon = (stObj.map_bounds.top_lon + stObj.map_bounds.bottom_lon) / 2;
        } else {
            return;
        }
    }

    elements.postalCode.value = postCode ? String(postCode) : '';
    updateMapMarker(lat, lon, 17);

    const detectedDist = officialDist || detectDistrictPolygon(lat, lon) || '';

    // Auto-detect JK
    const jkObj = !isApproximate ? detectResidentialComplex(selectedStreetId, exactHouseLabel) : null;
    if (jkObj) {
        setJKFields(jkObj, jkObj.district || detectedDist);
        renderJKHousesBar(jkObj, selectedStreetId, exactHouseLabel);
    } else {
        clearSelectedJK();
        elements.jkHousesBar.hidden = true;
        setDistrictSilently(detectedDist);
    }

    computeLandmarksAndMetro(lat, lon);

    const statusPrefix = isApproximate
        ? `⚠️ Дом «${rawHouse}» отсутствует в реестре — показан центр улицы ${stObj.shortDisplay}`
        : `✅ Точный адрес из реестра: ${stObj.shortDisplay}, ${exactHouseLabel}`;
    updateMapFooter(lat, lon, statusPrefix);
}

// ==========================================
// Reverse Geocoding (Click on Map / Drag Pin)
// ==========================================
function handleMapClickOrDrag(lat, lon, sourceLabel) {
    // Find nearest registered building within 85 meters
    let best = null;
    let bestDist = 85;

    for (let i = 0; i < flatHouses.length; i++) {
        const h = flatHouses[i];
        if (Math.abs(h.lat - lat) > 0.001 || Math.abs(h.lon - lon) > 0.0015) continue;
        const d = getHaversineDistance(lat, lon, h.lat, h.lon);
        if (d < bestDist) {
            bestDist = d;
            best = h;
        }
    }

    if (best) {
        const stObj = streetById.get(best.stId);
        if (stObj) {
            selectStreetObject(stObj);
            elements.house.value = best.house;
            elements.postalCode.value = best.postCode ? String(best.postCode) : '';
            updateMapMarker(best.lat, best.lon, Math.max(map.getZoom(), 16));

            const distName = (best.distId && DISTRICT_BY_ID[best.distId]) || detectDistrictPolygon(best.lat, best.lon) || '';
            const jkObj = detectResidentialComplex(best.stId, best.house);
            if (jkObj) {
                setJKFields(jkObj, jkObj.district || distName);
                renderJKHousesBar(jkObj, best.stId, best.house);
            } else {
                clearSelectedJK();
                elements.jkHousesBar.hidden = true;
                setDistrictSilently(distName);
            }

            computeLandmarksAndMetro(best.lat, best.lon);
            updateMapFooter(best.lat, best.lon, `🏠 ${sourceLabel}: выбран дом ${stObj.shortDisplay}, ${best.house} (${bestDist} м)`);
            return;
        }
    }

    // Clicked outside any building (open plot / cottage / park)
    updateMapMarker(lat, lon, Math.max(map.getZoom(), 15));
    const polyDist = detectDistrictPolygon(lat, lon) || 'Передмістя';
    setDistrictSilently(polyDist);
    elements.postalCode.value = '';
    computeLandmarksAndMetro(lat, lon);
    updateMapFooter(lat, lon, `📍 ${sourceLabel}: точка вне зданий реестра (${polyDist})`);
}

function updateMapMarker(lat, lon, zoom = 16) {
    map.setView([lat, lon], zoom);
    if (marker) {
        marker.setLatLng([lat, lon]);
    } else {
        marker = L.marker([lat, lon], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            handleMapClickOrDrag(pos.lat, pos.lng, 'Перемещение маркера');
        });
    }
}

function updateMapFooter(lat, lon, statusText) {
    const latStr = lat.toFixed(6);
    const lonStr = lon.toFixed(6);
    elements.mapStatus.textContent = statusText;
    elements.coordsDisplay.textContent = `${latStr}, ${lonStr}`;
    elements.gmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${latStr},${lonStr}`;
    elements.mapLinks.hidden = false;
}

// ==========================================
// District & Residential Complex (ЖК) Logic
// ==========================================
function detectDistrictPolygon(lat, lon) {
    if (!districtPolygons || !window.turf) return null;
    const pt = turf.point([lon, lat]);
    for (const [distName, geom] of Object.entries(districtPolygons)) {
        try {
            const poly = geom.type === 'MultiPolygon'
                ? turf.multiPolygon(geom.coordinates)
                : turf.polygon(geom.coordinates);
            if (turf.booleanPointInPolygon(pt, poly)) {
                return distName;
            }
        } catch (err) {
            console.error('Polygon error:', distName, err);
        }
    }
    return null;
}

function highlightDistrictPolygon(distName) {
    if (activeDistrictLayer) {
        map.removeLayer(activeDistrictLayer);
        activeDistrictLayer = null;
    }
    if (!distName || !districtPolygons || !districtPolygons[distName]) return;
    activeDistrictLayer = L.geoJSON(districtPolygons[distName], {
        style: {
            color: '#2563eb',
            weight: 1.5,
            opacity: 0.45,
            fillColor: '#3b82f6',
            fillOpacity: 0.04,
            interactive: false
        }
    }).addTo(map);
}

function setDistrictSilently(distName) {
    silentState = true;
    elements.district.value = distName || '';
    silentState = false;
    highlightDistrictPolygon(distName);
    syncHiddenComplexSelect(distName);
}

function detectResidentialComplex(stId, houseLabel) {
    const nk = normHouseKey(houseLabel);
    const direct = houseToJKMap.get(`${stId}:${nk}`);
    if (direct) return direct;

    // Fallback string check for complexes without pre-matched house IDs
    const stObj = streetById.get(stId);
    if (!stObj) return null;
    const numMatch = nk.match(/^\d+/);
    if (!numMatch) return null;

    for (const jk of jkList) {
        if (!jk.address) continue;
        const addrLower = ((jk.address || '') + '; ' + (jk.raw_address || '')).toLowerCase();
        const namesToCheck = [stObj.current_name, ...(stObj.old_names || [])];
        if (!namesToCheck.some(n => n && addrLower.includes(n.toLowerCase()))) continue;

        for (const seg of addrLower.split(';')) {
            const commaIdx = seg.indexOf(',');
            if (commaIdx === -1) continue;
            const segHouseNorm = normHouseKey(seg.slice(commaIdx + 1));
            if (segHouseNorm === nk) return jk;
        }
    }
    return null;
}

function setJKFields(jkObj, distOverride = '') {
    selectedJK = jkObj;
    elements.complexSearch.value = jkObj.jk_name;
    elements.clearJK.hidden = false;
    elements.jkClass.value = jkObj.class || '';
    const dist = distOverride || jkObj.district || '';
    setDistrictSilently(dist);
    elements.complexSelect.value = jkObj.jk_name;
}

function clearSelectedJK() {
    selectedJK = null;
    elements.complexSearch.value = '';
    elements.clearJK.hidden = true;
    elements.jkClass.value = '';
    elements.complexSelect.value = 'none';
}

function applyManualJKSelection(jkObj) {
    setJKFields(jkObj);

    if (Array.isArray(jkObj.houses) && jkObj.houses.length > 0) {
        const [firstStId, firstHouse] = jkObj.houses[0];
        const stObj = streetById.get(firstStId);
        if (stObj) {
            selectStreetObject(stObj);
            elements.house.value = firstHouse;
            handleHouseSelection();
            renderJKHousesBar(jkObj, firstStId, firstHouse);
            return;
        }
    }

    elements.jkHousesBar.hidden = true;
    if (jkObj.lat && jkObj.lon) {
        updateMapMarker(jkObj.lat, jkObj.lon, 16);
        computeLandmarksAndMetro(jkObj.lat, jkObj.lon);
        updateMapFooter(jkObj.lat, jkObj.lon, `🏢 Выбран комплекс: ${jkObj.jk_name}${jkObj.address ? ' (' + jkObj.address + ')' : ''}`);
    }
}

function renderJKHousesBar(jkObj, activeStId, activeHouse) {
    if (!jkObj || !Array.isArray(jkObj.houses) || jkObj.houses.length <= 1) {
        elements.jkHousesBar.hidden = true;
        return;
    }

    elements.jkHousesBar.innerHTML = `<strong>Корпуса / дома ${jkObj.jk_name}:</strong>`;
    jkObj.houses.forEach(([stId, hLabel]) => {
        const stObj = streetById.get(stId);
        const chip = document.createElement('span');
        const isActive = stId === activeStId && hLabel === activeHouse;
        chip.className = 'chip chip-jk' + (isActive ? ' active' : '');
        const multiStreet = new Set(jkObj.houses.map(x => x[0])).size > 1;
        chip.textContent = multiStreet && stObj ? `${stObj.shortDisplay}, ${hLabel}` : hLabel;
        chip.onclick = () => {
            if (stObj) {
                selectStreetObject(stObj);
                elements.house.value = hLabel;
                handleHouseSelection();
            }
        };
        elements.jkHousesBar.appendChild(chip);
    });
    elements.jkHousesBar.hidden = false;
}

// ==========================================
// Smart Landmarks & Metro Computation
// ==========================================
function computeLandmarksAndMetro(lat, lon) {
    // 1. METRO
    if (metroData.length > 0) {
        const sortedMetros = metroData
            .map(m => ({ ...m, dist: getHaversineDistance(lat, lon, m.lat, m.lon) }))
            .sort((a, b) => a.dist - b.dist);

        const closest = sortedMetros[0];
        if (closest && closest.dist <= 6000) {
            elements.metro.value = closest.name;
            updateMetroHint(closest);
        } else {
            elements.metro.value = 'Немає поруч';
            elements.metroHint.textContent = closest ? `Ближайшая ст. «${closest.name}» в ${formatDist(closest.dist)}` : 'Нет данных';
        }

        // Show nearby alternative metro stations (within 2.2 km) as quick-pick chips
        const altMetros = sortedMetros.filter(m => m.dist <= 2200).slice(0, 4);
        elements.metroChips.innerHTML = '';
        if (altMetros.length > 1) {
            altMetros.forEach(m => {
                const chip = document.createElement('span');
                chip.className = 'chip' + (elements.metro.value === m.name ? ' active' : '');
                chip.innerHTML = `🚇 ${m.name} <span class="chip-dist">${formatDist(m.dist)}</span>`;
                chip.onclick = () => {
                    elements.metro.value = m.name;
                    updateMetroHint(m);
                    Array.from(elements.metroChips.children).forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                };
                elements.metroChips.appendChild(chip);
            });
        }
    }

    // 2. LANDMARKS (Balanced Realtor Selection: 1 Area/Microdistrict + up to 2 Notable Places)
    if (landmarksData.length > 0) {
        const withDist = landmarksData
            .map(l => ({ ...l, dist: getHaversineDistance(lat, lon, l.lat, l.lon) }))
            .filter(l => l.dist <= 2800)
            .sort((a, b) => a.dist - b.dist);

        const areas = withDist.filter(l => l.type === 'area' && l.dist <= 2200);
        const pois = withDist.filter(l => l.type !== 'area' && l.dist <= 1900);

        const autoPicked = [];
        const pickedNames = new Set();

        if (areas.length > 0) {
            autoPicked.push(areas[0]);
            pickedNames.add(areas[0].name.toLowerCase());
        }

        // Prefer diverse POI types (e.g. mall + park rather than 2 parks right next to each other)
        const usedTypes = new Set();
        for (const p of pois) {
            if (autoPicked.length >= 3) break;
            if (pickedNames.has(p.name.toLowerCase())) continue;
            if (!usedTypes.has(p.type) || p.dist <= 450) {
                autoPicked.push(p);
                pickedNames.add(p.name.toLowerCase());
                usedTypes.add(p.type);
            }
        }

        // Fill remaining slot if needed
        for (const item of [...pois, ...areas]) {
            if (autoPicked.length >= 3) break;
            if (!pickedNames.has(item.name.toLowerCase())) {
                autoPicked.push(item);
                pickedNames.add(item.name.toLowerCase());
            }
        }

        elements.landmark.value = autoPicked.length > 0
            ? autoPicked.map(x => x.name).join(', ')
            : 'Немає';

        // Build clickable chip pool of top nearby options (up to 9)
        const chipCandidates = [];
        const seenChip = new Set();
        for (const item of [...autoPicked, ...areas.slice(0, 3), ...pois.slice(0, 7)]) {
            const k = item.name.toLowerCase();
            if (seenChip.has(k)) continue;
            seenChip.add(k);
            chipCandidates.push(item);
            if (chipCandidates.length >= 9) break;
        }
        nearbyLandmarkPool = chipCandidates;
        renderLandmarkChips();
    }
}

function updateMetroHint(m) {
    const walkMin = Math.max(1, Math.round(m.dist / 72)); // ~72m/min realistic city walk
    const travelStr = m.dist <= 2200
        ? `🚶 ~${formatDist(m.dist)} (~${walkMin} мин пешком)`
        : `🚌 ~${formatDist(m.dist)} (на транспорте)`;
    const parts = [travelStr];
    if (m.line) parts.push(`${m.line} линия`);
    if (m.old_name) parts.push(`колиш. ${m.old_name}`);
    elements.metroHint.textContent = parts.join(' • ');
}

function getCurrentLandmarkList() {
    const raw = elements.landmark.value.trim();
    if (!raw || raw === 'Немає') return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function renderLandmarkChips() {
    elements.landmarkChips.innerHTML = '';
    const activeSet = new Set(getCurrentLandmarkList().map(s => s.toLowerCase()));

    nearbyLandmarkPool.forEach(item => {
        const isSelected = activeSet.has(item.name.toLowerCase());
        const chip = document.createElement('span');
        chip.className = 'chip' + (isSelected ? ' active' : '');
        chip.innerHTML = `${isSelected ? '✓' : '+'} ${item.name} <span class="chip-dist">${formatDist(item.dist)}</span>`;
        chip.onclick = () => toggleLandmarkInTextarea(item.name);
        elements.landmarkChips.appendChild(chip);
    });
}

function syncLandmarkChipStates() {
    if (nearbyLandmarkPool.length > 0) renderLandmarkChips();
}

function toggleLandmarkInTextarea(name) {
    const current = getCurrentLandmarkList();
    const idx = current.findIndex(x => x.toLowerCase() === name.toLowerCase());
    if (idx !== -1) {
        current.splice(idx, 1);
    } else {
        current.push(name);
    }
    elements.landmark.value = current.join(', ');
    renderLandmarkChips();
}

// ==========================================
// Form Reset & Copy Summary
// ==========================================
function resetAutoComputedFields() {
    clearSelectedJK();
    setDistrictSilently('');
    elements.postalCode.value = '';
    elements.metro.value = '';
    elements.metroHint.textContent = 'Определяется автоматически по координатам дома';
    elements.metroChips.innerHTML = '';
    elements.landmark.value = '';
    elements.landmarkChips.innerHTML = '';
    elements.jkHousesBar.hidden = true;
    elements.mapLinks.hidden = true;
    elements.mapStatus.textContent = '💡 Совет: можно кликнуть в любую точку карты или перетащить маркер для определения ближайшего дома и ориентиров.';
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
}

function clearEntireForm() {
    elements.quickAddress.value = '';
    elements.street.value = '';
    elements.clearStreet.hidden = true;
    elements.streetRenameBadge.hidden = true;
    elements.house.value = '';
    elements.apartment.value = '';
    selectedStreetId = null;
    nearbyLandmarkPool = [];
    resetAutoComputedFields();
    map.setView(MAP_INITIAL_COORDS, MAP_INITIAL_ZOOM);
    elements.street.focus();
    showToast('Форма очищена');
}

function copyFullCard() {
    const lines = [];
    const stObj = selectedStreetId ? streetById.get(selectedStreetId) : null;
    const streetStr = stObj ? stObj.full : elements.street.value.trim();
    const houseStr = elements.house.value.trim();
    const aptStr = elements.apartment.value.trim();

    if (streetStr) {
        let addrLine = streetStr;
        if (houseStr) addrLine += `, буд. ${houseStr}`;
        if (aptStr) addrLine += `, кв. ${aptStr}`;
        lines.push(`Адреса: ${addrLine}`);
    }
    if (elements.district.value) lines.push(`Район: ${elements.district.value}`);
    if (selectedJK) {
        lines.push(`ЖК: ${selectedJK.jk_name}${elements.jkClass.value ? ' (' + elements.jkClass.value + ')' : ''}`);
    }
    if (elements.metro.value && elements.metro.value !== 'Немає поруч') {
        lines.push(`Метро: ${elements.metro.value}`);
    }
    if (elements.landmark.value && elements.landmark.value !== 'Немає') {
        lines.push(`Орієнтир: ${elements.landmark.value}`);
    }
    if (elements.postalCode.value) {
        lines.push(`Індекс: ${elements.postalCode.value}`);
    }

    if (!lines.length) {
        showToast('Сначала выберите адрес или точку на карте');
        return;
    }

    navigator.clipboard.writeText(lines.join('\n'));
    showToast('📋 Карточка объекта скопирована в буфер обмена!');
}
