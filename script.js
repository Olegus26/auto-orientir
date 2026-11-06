// ==========================================
// Constants & Configuration
// ==========================================
const DATA_VERSION = '20261107_1';
const MAP_INITIAL_CENTER = [36.2720, 50.0010]; // [lon, lat] Kharkiv overview
const MAP_INITIAL_ZOOM = 10.65;
const OPENFREEMAP_BRIGHT_URL = 'https://tiles.openfreemap.org/styles/bright';

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

// Official Kharkiv Metro Line Colors (Rieltor.ua palette)
const METRO_LINE_COLORS = {
    "Холодногірсько-Заводська": "#c91d52",
    "Салтівська": "#1877f2",
    "Олексіївська": "#11965d"
};

// Key well-spaced stations visible with full 'M' + label even at city overview zoom (< 13.1), matching Rieltor.ua
const OVERVIEW_PRIMARY_METROS = new Set([
    "Перемога",
    "23 Серпня",
    "Наукова",
    "Холодна Гора",
    "Київська",
    "Академіка Павлова",
    "Салтівська",
    "Захисників України",
    "Заводська",
    "Палац Спорту",
    "Ім. О.С. Масельського",
    "Індустріальна"
]);

// Transfer twin anti-collision pixel offsets (dotDx/dotDy at overview zoom; zoomDx/zoomDy when zoomed in)
const METRO_OFFSETS = {
    "Історичний музей":   { dotDx: 2,  dotDy: -5, zoomDx: 0,   zoomDy: -15 },
    "Майдан Конституції": { dotDx: -1, dotDy: 4,  zoomDx: 0,   zoomDy: 15  },
    "Держпром":           { dotDx: 0,  dotDy: 0,  zoomDx: -8,  zoomDy: -13 },
    "Університет":        { dotDx: 0,  dotDy: 0,  zoomDx: 8,   zoomDy: 13  },
    "Спортивна":          { dotDx: 0,  dotDy: -2, zoomDx: 0,   zoomDy: -14 },
    "Метробудівників":    { dotDx: 0,  dotDy: 2,  zoomDx: 0,   zoomDy: 14  }
};

// Semantic RU -> UA root & phrase translations for Kharkiv street search
const RU_UA_ROOTS = [
    [/героев\s+труда/g, 'героїв праці'],
    [/героев\s+харькова/g, 'героїв харкова'],
    [/героев\s+сталинграда/g, 'героїв сталінграда'],
    [/дружбы\s+народов/g, 'дружби народів'],
    [/веры\s+холодной/g, 'віри холодної'],
    [/любови\s+малой/g, 'любові малої'],
    [/(?:второй|2\s*й|2\s*ої|2)\s+пятилетк[иа]?/g, 'другої пятирічки'],
    [/пятилетк/g, 'пятирічк'],
    [/50\s*(?:лет|річчя|років)/g, 'пятдесятиріччя'],
    [/60\s*(?:лет|річчя|років)/g, 'шістдесятиріччя'],
    [/(\d+)\s*лет(?=\s|$)/g, '$1 річчя'],
    [/23(?:\s*го)?\s+(?:августа|серпня)/g, '23 серпня двадцять третього серпня'],
    [/тракторостроителей/g, 'тракторобудівників'],
    [/машиностроителей/g, 'машинобудівників'],
    [/метростроителей/g, 'метробудівників'],
    [/станкостроителей/g, 'верстатобудівників'],
    [/домостроител/g, 'домобудівельн'],
    [/строителей/g, 'будівельників'],
    [/тракторостроител/g, 'тракторобудівник'],
    [/строительн/g, 'будівельн'],
    [/строител/g, 'будівельник'],
    [/гимназическ/g, 'гімназійн'],
    [/восстания/g, 'повстання'],
    [/гвардейц/g, 'гвардійц'],
    [/железнодорож/g, 'залізнич'],
    [/независимост/g, 'незалежност'],
    [/защитник/g, 'захисник'],
    [/непокоренн/g, 'нескорен'],
    [/возрожден/g, 'відроджен'],
    [/просвещен/g, 'просвіт'],
    [/побед[ыа](?=\s|$)/g, 'перемоги'],
    [/победн/g, 'переможн'],
    [/труда(?=\s|$)/g, 'праці'],
    [/целиноград/g, 'цілиноград'],
    [/белгород/g, 'білгород'],
    [/холодногор/g, 'холодногір'],
    [/(?:лысогор|лисогор)/g, 'лисогір'],
    [/высокогор/g, 'високогір'],
    [/подгорн/g, 'підгірн'],
    [/нагорн/g, 'нагірн'],
    [/красногор/g, 'червоногір'],
    [/школьн/g, 'шкільн'],
    [/светл/g, 'світл'],
    [/солнечн/g, 'сонячн'],
    [/песчан/g, 'піщан'],
    [/средн/g, 'середн'],
    [/осенн/g, 'осінн'],
    [/летн(яя|ей|юю|ий)/g, 'літн$1'],
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
    [/лесн(ая|ой|ое)/g, 'лісов'],
    [/полев(ая|ой|ое)/g, 'польов'],
    [/речн(ая|ой|ое)/g, 'річков'],
    [/степн(ая|ой|ое)/g, 'степов'],
    [/жилстро[йя]/g, 'житлобуд'],
    [/(^|\s)жс\s*1(?=\s|$)/g, '$1житлобуд 1'],
    [/(^|\s)жс\s*2(?=\s|$)/g, '$1житлобуд 2'],
    [/воробьев/g, 'воробйов'],
    [/бел(ый|ого|ому)/g, 'білий'],
    [/изумрудн/g, 'смарагдов'],
    [/янтарн/g, 'бурштинов'],
    [/сирен(ь|и)(?=\s|$)/g, 'бузок'],
    [/(^|\s)мира(?=\s|$)/g, '$1миру']
];

const LAT_TO_CYR = {
    a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к',
    m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', i: 'і'
};

const naturalCollator = new Intl.Collator(['uk', 'ru', 'en'], { numeric: true, sensitivity: 'base' });

// ==========================================
// Global State & Data
// ==========================================
let map = null;
let marker = null;
let hoverPopup = null;
let metroMarkers = [];
let mapStyleLoaded = false;
let allDataLoaded = false;
let customLayersReady = false;
let showJKDotsOnMap = true;
let activeDistrictMaskName = '';

let streetsData = [];
let streetById = new Map();
let housesData = {};
let streetNormHouses = new Map();
let flatHouses = [];

let districtPolygons = null;
let jkList = [];
let jkByName = new Map();
let houseToJKMap = new Map();
let metroData = [];
let landmarksData = [];

let selectedStreetId = null;
let selectedJK = null;
let activePostCode = 0;
let nearbyLandmarkPool = [];
let silentState = false;
let houseInputTimer = null;
let dataLoadFailed = false;

// DOM Elements
const elements = {
    mapEl: document.getElementById('map'),
    btnModeMap: document.getElementById('btn_mode_map'),
    btnModeSat: document.getElementById('btn_mode_sat'),
    btnToggleJKs: document.getElementById('btn_toggle_jks'),
    btnClear: document.getElementById('btn_clear'),
    btnCopyAll: document.getElementById('btn_copy_all'),
    street: document.getElementById('street'),
    clearStreet: document.getElementById('clear_street'),
    streetRenameBadge: document.getElementById('street_rename_badge'),
    house: document.getElementById('house_number'),
    clearHouse: document.getElementById('clear_house'),
    apartment: document.getElementById('apartment_number'),
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
    postDisplay: document.getElementById('post_display'),
    gmapsLink: document.getElementById('gmaps_link'),
    toast: document.getElementById('toast')
};

// ==========================================
// Normalization, Phonetics & Fuzzy Helpers
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
        .replace(/(^|\s)(въезд|вїзд|в-д)(?=\s|$)/g, '$1вд')
        .replace(/(^|\s)(проезд|проїзд|пр-д)(?=\s|$)/g, '$1прд')
        .replace(/(^|\s)(набережная|набережна|наб\.?)(?=\s|$)/g, '$1наб')
        .replace(/(^|\s)(спуск|узвіз|узв\.?)(?=\s|$)/g, '$1узв')
        .replace(/(^|\s)(площадь|площа|пл\.?|майдан|м-н)(?=\s|$)/g, '$1мн')
        .replace(/(^|\s)(шоссе|шосе)(?=\s|$)/g, '$1шосе')
        .replace(/(^|\s)(тупик|туп\.?)(?=\s|$)/g, '$1туп')
        .replace(/(^|\s)(аллея|алея)(?=\s|$)/g, '$1алея');
}

function normalizePhonetic(raw) {
    if (!raw) return '';
    let s = raw.toLowerCase().trim();

    s = s.replace(/\S+/g, w => (
        /[а-яіїєґёъыэ]/.test(w)
            ? w.replace(/[abcehkmoptxyi]/g, ch => LAT_TO_CYR[ch] || ch)
            : w
    ));

    s = s.replace(/['’`ʼ]/g, '').replace(/["«»(),;№]/g, ' ');
    s = normalizeStreetTypes(s);
    s = s.replace(/[.\-/]/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/([аоуеиіїяює])\1+/g, '$1');
    s = normalizeStreetTypes(s);

    for (const [rx, rep] of RU_UA_ROOTS) {
        s = s.replace(rx, rep);
    }

    s = s
        .replace(/ционн/g, 'цийн')
        .replace(/(?:овская|евская|овська|евська|євська|івська|ївська|ьовська)(?=\s|$)/g, 'овска')
        .replace(/(?:овский|евский|овський|евський|євський|івський|ївський|ьовський)(?=\s|$)/g, 'овски')
        .replace(/(?:овское|евское|овське|евське|євське|івське|ївське|ьовське)(?=\s|$)/g, 'овске')
        .replace(/(?:овских|евских|овських|евських|євських|івських|ївських|ьовських)(?=\s|$)/g, 'овских')
        .replace(/(?:овского|евского|овського|евського|євського|івського|ївського|ьовського)(?=\s|$)/g, 'овского')
        .replace(/(?:овцев|евцев|івців|ївців)(?=\s|$)/g, 'овцив')
        .replace(/(?:ческая|чна)(?=\s|$)/g, 'чна')
        .replace(/(?:ческий|чний)(?=\s|$)/g, 'чни')
        .replace(/(?:ческое|чне)(?=\s|$)/g, 'чне')
        .replace(/(?:цкая|цька)(?=\s|$)/g, 'цка')
        .replace(/(?:цкий|цький)(?=\s|$)/g, 'цки')
        .replace(/(?:цкое|цьке)(?=\s|$)/g, 'цке')
        .replace(/(?:цкого|цького)(?=\s|$)/g, 'цкого')
        .replace(/(?:ская|ська)(?=\s|$)/g, 'ска')
        .replace(/(?:ский|ський)(?=\s|$)/g, 'ски')
        .replace(/(?:ское|ське)(?=\s|$)/g, 'ске')
        .replace(/(?:ских|ських)(?=\s|$)/g, 'ских')
        .replace(/(?:ского|ського)(?=\s|$)/g, 'ского')
        .replace(/цев(?=\s|$)/g, 'цив')
        .replace(/нко(?=\s|$)/g, 'нка')
        .replace(/([а-яіїєґ]{2,})ої(?=\s|$)/g, '$1ой')
        .replace(/([а-яіїєґ]{2,})ая(?=\s|$)/g, '$1а')
        .replace(/([а-яіїєґ]{2,})яя(?=\s|$)/g, '$1я')
        .replace(/([а-яіїєґ]{2,})(?:ое|ее|єє)(?=\s|$)/g, '$1е');

    s = s
        .replace(/ії/g, 'и')
        .replace(/[іїы]/g, 'и')
        .replace(/[єэё]/g, 'е')
        .replace(/ґ/g, 'г')
        .replace(/[ьъ]/g, '');

    s = s.replace(/([а-яa-z])\1+/g, '$1');
    return s.replace(/\s+/g, ' ').trim();
}

function toAkanje(phoneticStr) {
    return phoneticStr
        .replace(/о/g, 'а')
        .replace(/е/g, 'и')
        .replace(/([а-яa-z])\1+/g, '$1');
}

function editDistanceBounded(a, b, maxDist = 2) {
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > maxDist) return maxDist + 1;

    const prev2 = new Array(lb + 1);
    const prev = new Array(lb + 1);
    const curr = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;

    for (let i = 1; i <= la; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        for (let j = 1; j <= lb; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                val = Math.min(val, prev2[j - 2] + 1);
            }
            curr[j] = val;
            if (val < rowMin) rowMin = val;
        }
        if (rowMin > maxDist) return maxDist + 1;
        for (let j = 0; j <= lb; j++) {
            prev2[j] = prev[j];
            prev[j] = curr[j];
        }
    }
    return prev[lb];
}

function normHouseKey(raw) {
    if (!raw) return '';
    let s = String(raw).toLowerCase().trim();
    s = s.replace(/корпус|корп\.?|к\./g, 'к').replace(/№/g, '');
    s = s.replace(/[abcehkmoptxyi]/g, ch => LAT_TO_CYR[ch] || ch);
    s = s.replace(/(\d|[а-яіїєґ])\s+к\s*(\d)/g, '$1к$2');
    return s.replace(/[\s,\-.]/g, '');
}

function showToast(msg) {
    elements.toast.textContent = msg;
    elements.toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { elements.toast.hidden = true; }, 2300);
}

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initDistrictDropdown();
    setupEventListeners();
    await Promise.all([initMap(), loadAllData()]);
    ensureCustomMapLayers();
});

function initDistrictDropdown() {
    DISTRICTS.forEach(d => elements.district.append(new Option(d, d)));
}

// ==========================================
// Rieltor.ua Vector Map Style & MapLibre Setup
// ==========================================
const MAJOR_YELLOW_ROAD_IDS = new Set([
    'highway-motorway-link-casing',
    'highway-primary-casing',
    'highway-trunk-casing',
    'highway-motorway-casing',
    'highway-motorway-link',
    'highway-primary',
    'highway-trunk',
    'highway-motorway',
    'bridge-motorway-link-casing',
    'bridge-trunk-primary-casing',
    'bridge-motorway-casing',
    'bridge-motorway-link',
    'bridge-trunk-primary',
    'bridge-motorway',
    'road_oneway',
    'road_oneway_opposite'
]);

const BASE_SURFACE_LAYER_IDS = new Set([
    'background',
    'landcover-glacier',
    'landuse-residential',
    'landuse-suburb',
    'landuse-commercial',
    'landuse-industrial',
    'landuse-cemetery',
    'landuse-hospital',
    'landuse-school',
    'landuse-railway',
    'park',
    'landcover-wood',
    'landcover-grass',
    'landcover-grass-park',
    'waterway_tunnel',
    'waterway-other',
    'waterway-other-intermittent',
    'waterway-stream-canal',
    'waterway-stream-canal-intermittent',
    'waterway-river',
    'waterway-river-intermittent',
    'water',
    'water-intermittent',
    'landcover-ice-shelf',
    'landcover-sand',
    'building',
    'building-top'
]);

async function buildRieltorMapStyle() {
    try {
        const res = await fetch(OPENFREEMAP_BRIGHT_URL);
        if (!res.ok) throw new Error('Style fetch failed');
        const style = await res.json();

        // Add Esri World Imagery source for Hybrid Satellite toggle
        style.sources['esri-sat'] = {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '&copy; Esri'
        };

        const baseLayers = [];
        const underMaskLayers = [];
        const majorRoadLayers = [];
        const labelLayers = [];
        let housenumberInserted = false;

        const ukNameExpr = ['coalesce', ['get', 'name:uk'], ['get', 'name_uk'], ['get', 'name']];

        for (const layer of style.layers) {
            const id = layer.id;
            layer.paint = layer.paint || {};
            layer.layout = layer.layout || {};

            // 1. Clean cool-slate background (Rieltor.ua base)
            if (id === 'background') {
                layer.paint['background-color'] = '#f2f4f8';
            }

            // 2. Landuse & Parks (Rieltor.ua soft pastel greens & cool grays)
            if (id === 'landuse-residential' || id === 'landuse-suburb') {
                layer.paint['fill-color'] = '#eceff5';
            } else if (id === 'landuse-industrial' || id === 'landuse-commercial' || id === 'landuse-railway') {
                layer.paint['fill-color'] = '#e1e5ef';
            } else if (id === 'landuse-hospital' || id === 'landuse-school') {
                layer.paint['fill-color'] = '#e9edf5';
            } else if (id === 'landuse-cemetery') {
                layer.paint['fill-color'] = '#dce8d6';
            } else if (id === 'park' || id === 'landcover-grass' || id === 'landcover-grass-park') {
                layer.paint['fill-color'] = '#bde39c';
                layer.paint['fill-opacity'] = 0.94;
            } else if (id === 'landcover-wood') {
                layer.paint['fill-color'] = '#afd98a';
                layer.paint['fill-opacity'] = 0.94;
            } else if (id === 'aeroway-area') {
                layer.paint['fill-color'] = '#d5dae8';
            }

            // 3. Water (crisp sky blue)
            if (id === 'water' || id === 'water-intermittent') {
                layer.paint['fill-color'] = '#74c8f4';
            } else if (id.startsWith('waterway') && layer.type === 'line') {
                layer.paint['line-color'] = '#74c8f4';
            }

            // 4. Buildings
            if (id === 'building' || id === 'building-top') {
                layer.paint['fill-color'] = '#dfe4ed';
                if (id === 'building') layer.paint['fill-outline-color'] = '#cfd6e3';
            }

            // 5. Golden-yellow Rieltor.ua arterial roads (above district mask) vs crisp white secondary/minor streets (under district mask)
            if (
                id === 'highway-motorway' || id === 'highway-trunk' || id === 'highway-primary' ||
                id === 'bridge-motorway' || id === 'bridge-trunk-primary'
            ) {
                layer.paint['line-color'] = '#f4c236';
                layer.paint['line-width'] = [
                    'interpolate', ['exponential', 1.25], ['zoom'],
                    9, 1.3,
                    11.2, 2.7,
                    13.5, 4.8,
                    16, 10,
                    19, 20
                ];
            } else if (
                id === 'highway-motorway-casing' || id === 'highway-trunk-casing' || id === 'highway-primary-casing' ||
                id === 'bridge-motorway-casing' || id === 'bridge-trunk-primary-casing'
            ) {
                layer.paint['line-color'] = '#d89d1e';
                layer.paint['line-width'] = [
                    'interpolate', ['exponential', 1.25], ['zoom'],
                    9, 2.1,
                    11.2, 3.8,
                    13.5, 6.4,
                    16, 12.2,
                    19, 23
                ];
            } else if (id === 'highway-motorway-link' || id === 'bridge-motorway-link' || id === 'tunnel-motorway' || id === 'tunnel-trunk-primary') {
                layer.paint['line-color'] = '#f4c236';
            } else if (id === 'highway-motorway-link-casing' || id === 'bridge-motorway-link-casing') {
                layer.paint['line-color'] = '#d89d1e';
            } else if (
                id === 'highway-secondary-tertiary' || id === 'bridge-secondary-tertiary' ||
                id === 'highway-link' || id === 'bridge-link'
            ) {
                layer.paint['line-color'] = '#ffffff';
                layer.paint['line-width'] = [
                    'interpolate', ['exponential', 1.25], ['zoom'],
                    9.5, 0.6,
                    11.2, 1.3,
                    13.5, 3.0,
                    16, 7.5,
                    19, 15
                ];
            } else if (
                id === 'highway-secondary-tertiary-casing' || id === 'bridge-secondary-tertiary-casing' ||
                id === 'highway-link-casing' || id === 'bridge-link-casing'
            ) {
                layer.paint['line-color'] = '#cfd7e3';
                layer.paint['line-width'] = [
                    'interpolate', ['exponential', 1.25], ['zoom'],
                    9.5, 1.1,
                    11.2, 2.1,
                    13.5, 4.2,
                    16, 9.2,
                    19, 17.5
                ];
            } else if (id === 'highway-minor' || id === 'bridge-minor') {
                layer.paint['line-color'] = '#ffffff';
            } else if (id === 'highway-minor-casing' || id === 'bridge-minor-casing') {
                layer.paint['line-color'] = '#d5dce6';
            } else if (id.startsWith('railway')) {
                layer.paint['line-color'] = '#cbd4e3';
            }

            // 6. Hide noisy commercial POIs, highway shields & dashed internal admin boundaries
            if (
                id.startsWith('poi_') ||
                id.includes('shield') ||
                id === 'airport' ||
                id === 'boundary_3' ||
                id === 'boundary_disputed'
            ) {
                layer.layout['visibility'] = 'none';
            }

            // Keep overview zoom clean of street and river names; show from zoom 13.2+
            if (id === 'highway-name-major' || id === 'waterway_line_label' || id === 'water_name_line_label' || id === 'water_name_point_label') {
                layer.minzoom = 13.2;
            }

            // 7. Split label_other into surrounding hamlets (zoom 10.2+) vs internal suburbs (zoom 13.3+), normal case
            if (id === 'label_other') {
                const hamletLayer = JSON.parse(JSON.stringify(layer));
                hamletLayer.id = 'label_hamlet';
                hamletLayer.minzoom = 10.2;
                hamletLayer.filter = ['in', ['get', 'class'], ['literal', ['hamlet', 'isolated_dwelling']]];
                hamletLayer.layout['text-field'] = ukNameExpr;
                hamletLayer.layout['text-font'] = ['Noto Sans Regular'];
                hamletLayer.layout['text-transform'] = 'none';
                hamletLayer.layout['text-letter-spacing'] = 0;
                hamletLayer.layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 10, 11, 13, 12.5];
                hamletLayer.paint['text-color'] = '#3f4b73';
                hamletLayer.paint['text-halo-color'] = 'rgba(255, 255, 255, 0.78)';
                hamletLayer.paint['text-halo-width'] = 1.4;
                labelLayers.push(hamletLayer);

                layer.id = 'label_suburb';
                layer.minzoom = 13.3;
                layer.filter = [
                    'all',
                    ['!', ['in', ['get', 'class'], ['literal', ['city', 'continent', 'country', 'state', 'town', 'village', 'hamlet', 'isolated_dwelling']]]]
                ];
                layer.layout['text-field'] = ukNameExpr;
                layer.layout['text-font'] = ['Noto Sans Regular'];
                layer.layout['text-transform'] = 'none';
                layer.layout['text-letter-spacing'] = 0.02;
                layer.layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 13.3, 11.5, 16, 13.5];
                layer.paint['text-color'] = '#4a5678';
                layer.paint['text-halo-color'] = 'rgba(255, 255, 255, 0.85)';
                layer.paint['text-halo-width'] = 1.5;
                labelLayers.push(layer);
                continue;
            }

            // 8. Ukrainian labels & Rieltor.ua slate-indigo typography
            if (layer.type === 'symbol' && layer.layout['text-field']) {
                layer.layout['text-field'] = ukNameExpr;
                if (id === 'label_city' || id === 'label_city_capital') {
                    layer.layout['text-font'] = ['Noto Sans Bold'];
                    layer.layout['icon-image'] = '';
                    layer.layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 6, 13, 11, 20, 13, 22];
                    layer.paint['text-color'] = '#364163';
                    layer.paint['text-halo-color'] = 'rgba(255, 255, 255, 0.75)';
                    layer.paint['text-halo-width'] = 1.6;
                } else if (id.startsWith('label_')) {
                    layer.layout['icon-image'] = '';
                    layer.paint['text-color'] = '#3f4b73';
                    layer.paint['text-halo-color'] = 'rgba(255, 255, 255, 0.78)';
                    layer.paint['text-halo-width'] = 1.4;
                } else if (id.startsWith('highway-name')) {
                    layer.paint['text-color'] = '#475569';
                    layer.paint['text-halo-color'] = 'rgba(255, 255, 255, 0.92)';
                    layer.paint['text-halo-width'] = 1.6;
                }
            }

            // Insert building house numbers right before street labels
            if (!housenumberInserted && id === 'highway-name-path' && style.sources.openmaptiles) {
                labelLayers.push({
                    id: 'building-housenumber',
                    type: 'symbol',
                    source: 'openmaptiles',
                    'source-layer': 'housenumber',
                    minzoom: 16,
                    layout: {
                        'text-field': ['get', 'housenumber'],
                        'text-font': ['Noto Sans Regular'],
                        'text-size': 10.5,
                        'text-allow-overlap': false
                    },
                    paint: {
                        'text-color': '#64748b',
                        'text-halo-color': 'rgba(255,255,255,0.9)',
                        'text-halo-width': 1.3
                    }
                });
                housenumberInserted = true;
            }

            // Route layer into deterministic Rieltor.ua z-order bucket
            if (BASE_SURFACE_LAYER_IDS.has(id)) {
                baseLayers.push(layer);
            } else if (MAJOR_YELLOW_ROAD_IDS.has(id)) {
                majorRoadLayers.push(layer);
            } else if (layer.type === 'symbol') {
                labelLayers.push(layer);
            } else {
                underMaskLayers.push(layer);
            }
        }

        const satLayer = {
            id: 'esri-sat-layer',
            type: 'raster',
            source: 'esri-sat',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 1 }
        };

        style.layers = [
            ...baseLayers,
            satLayer,
            ...underMaskLayers,
            ...majorRoadLayers,
            ...labelLayers
        ];
        return style;
    } catch (err) {
        console.warn('Fallback to Carto Voyager raster style:', err);
        return {
            version: 8,
            sources: {
                voyager: {
                    type: 'raster',
                    tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
                    tileSize: 256,
                    attribution: '&copy; OpenStreetMap &copy; CARTO'
                },
                'esri-sat': {
                    type: 'raster',
                    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                    tileSize: 256,
                    attribution: '&copy; Esri'
                }
            },
            layers: [
                { id: 'voyager-base', type: 'raster', source: 'voyager' },
                { id: 'esri-sat-layer', type: 'raster', source: 'esri-sat', layout: { visibility: 'none' } }
            ]
        };
    }
}

async function initMap() {
    if (!window.maplibregl) return;

    const rieltorStyle = await buildRieltorMapStyle();

    map = new maplibregl.Map({
        container: 'map',
        style: rieltorStyle,
        center: MAP_INITIAL_CENTER,
        zoom: MAP_INITIAL_ZOOM,
        maxZoom: 19,
        minZoom: 9.5,
        attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'rieltor-tip',
        offset: 8
    });

    const syncZoomClass = () => {
        if (!elements.mapEl) return;
        const isOverview = map.getZoom() < 13.15;
        elements.mapEl.classList.toggle('map-overview-zoom', isOverview);
    };
    syncZoomClass();
    map.on('zoom', syncZoomClass);

    map.on('load', () => {
        mapStyleLoaded = true;
        ensureCustomMapLayers();
    });

    map.on('click', e => {
        // Check if user clicked a purple JK / house dot first
        if (customLayersReady && map.getLayer('rieltor-dots-layer')) {
            const hits = map.queryRenderedFeatures(e.point, { layers: ['rieltor-dots-layer'] });
            if (hits && hits.length > 0) {
                const props = hits[0].properties || {};
                if (props.stId && props.house) {
                    const stObj = streetById.get(Number(props.stId));
                    if (stObj) {
                        applySelectedStreetAndHouse(stObj, String(props.house), '');
                        return;
                    }
                }
                if (props.jkName && jkByName.has(props.jkName)) {
                    applyManualJKSelection(jkByName.get(props.jkName));
                    return;
                }
            }
        }
        handleMapClickOrDrag(e.lngLat.lat, e.lngLat.lng, 'Клик на карте');
    });
}

function ensureCustomMapLayers() {
    if (!map || !mapStyleLoaded || !allDataLoaded || customLayersReady) return;
    customLayersReady = true;

    // 1. Spotlight District Mask (inserted ABOVE land/parks/water/minor-secondary streets, BELOW golden-yellow arterial roads & labels!)
    map.addSource('district-mask-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    map.addSource('district-outline-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    const beforeMajorRoadLayerId = [
        'highway-motorway-link-casing',
        'highway-primary-casing',
        'highway-trunk-casing',
        'highway-motorway'
    ].find(id => Boolean(map.getLayer(id)));

    map.addLayer(
        {
            id: 'district-mask-fill',
            type: 'fill',
            source: 'district-mask-src',
            paint: {
                'fill-color': '#6873f7',
                'fill-opacity': 0.40
            }
        },
        beforeMajorRoadLayerId
    );

    const beforeLabelLayerId = [
        'waterway_line_label',
        'building-housenumber',
        'label_hamlet',
        'label_village',
        'label_city'
    ].find(id => Boolean(map.getLayer(id)));

    map.addLayer(
        {
            id: 'district-outline-line',
            type: 'line',
            source: 'district-outline-src',
            paint: {
                'line-color': '#5662f6',
                'line-width': 1.0,
                'line-opacity': 0.22
            }
        },
        beforeLabelLayerId
    );

    // 2. Rieltor.ua Purple Dots Layer (JK buildings & active street buildings)
    map.addSource('rieltor-dots-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    map.addLayer({
        id: 'rieltor-dots-layer',
        type: 'circle',
        source: 'rieltor-dots-src',
        paint: {
            'circle-color': [
                'case',
                ['==', ['get', 'kind'], 'street-house'], '#9333ea',
                '#7c3aed'
            ],
            'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                10.5, 2.8,
                12.5, 3.8,
                15, 5.2,
                17.5, 6.8
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': [
                'interpolate', ['linear'], ['zoom'],
                11, 1.1,
                15, 1.6
            ],
            'circle-opacity': 0.95
        }
    });

    map.on('mouseenter', 'rieltor-dots-layer', e => {
        map.getCanvas().style.cursor = 'pointer';
        const feat = e.features?.[0];
        if (feat && hoverPopup) {
            const coords = feat.geometry.coordinates.slice();
            const label = feat.properties?.title || '';
            if (label) hoverPopup.setLngLat(coords).setHTML(label).addTo(map);
        }
    });

    map.on('mouseleave', 'rieltor-dots-layer', () => {
        map.getCanvas().style.cursor = '';
        hoverPopup?.remove();
    });

    // 3. Render 30 Kharkiv Metro Stations with curved 'M' + Line Colors
    renderMetroMarkersOnMap();

    // 4. Refresh initial purple dots & any pending district mask
    refreshPurpleDotsLayer();
    if (activeDistrictMaskName) {
        highlightDistrictPolygon(activeDistrictMaskName);
    }
}

function formatMetroDisplayLabel(name) {
    if (name === 'Ім. О.С. Масельського') return 'Імені О.С.<br>Масельського';
    if (name === 'Холодна Гора') return 'Холодна гора';
    if (name === 'Палац Спорту') return 'Палац спорту';
    if (name === '23 Серпня') return '23 серпня';
    return name;
}

function renderMetroMarkersOnMap() {
    if (!map || !window.maplibregl) return;
    metroMarkers.forEach(m => m.remove());
    metroMarkers = [];

    metroData.forEach(station => {
        const color = METRO_LINE_COLORS[station.line] || '#1877f2';
        const isPrimary = OVERVIEW_PRIMARY_METROS.has(station.name);
        const off = METRO_OFFSETS[station.name] || null;

        const el = document.createElement('div');
        el.className = 'metro-marker' + (isPrimary ? ' metro-primary' : ' metro-minor');
        el.style.setProperty('--m-color', color);
        if (off) {
            el.style.setProperty('--dot-dx', `${off.dotDx}px`);
            el.style.setProperty('--dot-dy', `${off.dotDy}px`);
            el.style.setProperty('--zoom-dx', `${off.zoomDx}px`);
            el.style.setProperty('--zoom-dy', `${off.zoomDy}px`);
        }
        el.title = `м. ${station.name}${station.old_name ? ' (колиш. ' + station.old_name + ')' : ''}`;

        // Crisp Rieltor.ua / LUN Metro 'M' emblem with white halo + station label + minor overview dot
        el.innerHTML = `
            <div class="metro-dot"></div>
            <div class="metro-badge">
                <svg class="metro-m-svg" viewBox="0 0 24 16" aria-hidden="true">
                    <path d="M 2.6 13.6 L 7.5 2.5 L 12 10.2 L 16.5 2.5 L 21.4 13.6"
                          fill="none" stroke="#ffffff" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M 2.6 13.6 L 7.5 2.5 L 12 10.2 L 16.5 2.5 L 21.4 13.6"
                          fill="none" stroke="${color}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="metro-label">${formatMetroDisplayLabel(station.name)}</div>
            </div>
        `;

        el.addEventListener('click', ev => {
            ev.stopPropagation();
            elements.metro.value = station.name;
            elements.metroHint.textContent = `🚇 ${station.line} линия${station.old_name ? ' • колиш. ' + station.old_name : ''}`;
            showToast(`Метро: ${station.name}`);
        });

        const mk = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([station.lon, station.lat])
            .addTo(map);
        metroMarkers.push(mk);
    });
}

function refreshPurpleDotsLayer() {
    if (!customLayersReady || !map) return;
    const src = map.getSource('rieltor-dots-src');
    if (!src) return;

    const features = [];
    const distFilter = elements.district.value;

    // 1. JK Residential Complex Buildings (Rieltor.ua violet dots)
    if (showJKDotsOnMap) {
        for (const jk of jkList) {
            if (distFilter && distFilter !== 'Передмістя' && jk.district !== distFilter) continue;
            const clsText = jk.class ? ` (${jk.class})` : '';

            if (Array.isArray(jk.houses) && jk.houses.length > 0) {
                for (const [stId, hLabel] of jk.houses) {
                    const arr = housesData[stId]?.[hLabel];
                    if (!arr) continue;
                    const stObj = streetById.get(stId);
                    features.push({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [arr[1], arr[0]] },
                        properties: {
                            kind: 'jk-house',
                            jkName: jk.jk_name,
                            stId,
                            house: hLabel,
                            title: `${jk.jk_name}${clsText}<br><span style="font-weight:400;opacity:0.85">${stObj ? stObj.shortDisplay + ', ' : ''}${hLabel}</span>`
                        }
                    });
                }
            } else if (jk.lat && jk.lon) {
                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [jk.lon, jk.lat] },
                    properties: {
                        kind: 'jk-center',
                        jkName: jk.jk_name,
                        title: `${jk.jk_name}${clsText}`
                    }
                });
            }
        }
    }

    // 2. Also show registered houses on the currently selected street so agent can click any building
    if (selectedStreetId && housesData[selectedStreetId]) {
        const stObj = streetById.get(selectedStreetId);
        const hMap = housesData[selectedStreetId];
        for (const [hLabel, arr] of Object.entries(hMap)) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [arr[1], arr[0]] },
                properties: {
                    kind: 'street-house',
                    stId: selectedStreetId,
                    house: hLabel,
                    title: `${stObj ? stObj.shortDisplay : ''}, буд. ${hLabel}`
                }
            });
        }
    }

    src.setData({ type: 'FeatureCollection', features });
}

// Compute signed ring area to ensure proper hole winding for Rieltor.ua inverted district spotlight
function ringSignedArea(ring) {
    let area = 0;
    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
        area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    return area / 2;
}

function buildInvertedSpotlightMask(geom) {
    const worldRing = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    const worldSign = Math.sign(ringSignedArea(worldRing)) || 1;
    const holeRings = [];

    const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    for (const poly of polys) {
        if (!poly || !poly[0]) continue;
        const ext = poly[0].map(pt => [pt[0], pt[1]]);
        const extSign = Math.sign(ringSignedArea(ext)) || 1;
        if (extSign === worldSign) ext.reverse();
        holeRings.push(ext);
    }

    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [worldRing, ...holeRings]
            }
        }]
    };
}

// ==========================================
// Data Loading & Indexing
// ==========================================
async function loadAllData() {
    try {
        const q = `?v=${DATA_VERSION}`;
        const [streets, houses, polygons, jks, metro, landmarks] = await Promise.all([
            fetch('data/streets.json' + q).then(r => r.json()),
            fetch('data/houses.json' + q).then(r => r.json()),
            fetch('data/districts.json' + q).then(r => r.json()),
            fetch('data/complexes.json' + q).then(r => r.json()),
            fetch('data/metro.json' + q).then(r => r.ok ? r.json() : []).catch(() => []),
            fetch('data/landmarks.json' + q).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        housesData = houses;
        districtPolygons = polygons;
        metroData = metro;
        landmarksData = landmarks;

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
            const combinedAkanje = toAkanje(combinedPhonetic);
            const akanjeWords = Array.from(new Set(combinedAkanje.split(' ').filter(w => w.length >= 3)));

            const obj = {
                ...s,
                full: display,
                shortDisplay: `${s.current_name}${typePart}`,
                houseCount,
                distNames,
                _normCurrent: normCurrent,
                _akanjeCurrent: toAkanje(normCurrent),
                _normType: normType,
                _normOldList: normOldList,
                _akanjeOldList: normOldList.map(toAkanje),
                _normAliasList: normAliasList,
                _phoneticAll: combinedPhonetic,
                _akanjeAll: combinedAkanje,
                _akanjeWords: akanjeWords
            };
            streetById.set(s.street_id, obj);
            return obj;
        });

        houseToJKMap.clear();
        jkByName.clear();
        jkList = jks.map(jk => {
            const normName = normalizePhonetic(jk.jk_name);
            const normAliases = (jk.aliases || []).map(normalizePhonetic).filter(Boolean);
            const normDev = normalizePhonetic(jk.developer || '');

            // Collect historical street names from all bound registry houses so searching e.g. "косиора" or "целиноградская" finds JKs on that street
            const boundStreetOldNames = [];
            if (Array.isArray(jk.houses)) {
                const seenSt = new Set();
                for (const [stId] of jk.houses) {
                    if (seenSt.has(stId)) continue;
                    seenSt.add(stId);
                    const stObj = streetById.get(stId);
                    if (stObj) {
                        boundStreetOldNames.push(stObj.current_name, ...(stObj.old_names || []), ...(stObj.aliases || []));
                    }
                }
            }
            const normAddr = normalizePhonetic(
                [jk.address || '', jk.raw_address || '', ...boundStreetOldNames].join(' ')
            );
            const phoneticAll = [normName, ...normAliases, normAddr, normDev].filter(Boolean).join(' ');
            const akanjeAll = toAkanje(phoneticAll);
            const akanjeWords = Array.from(new Set(akanjeAll.split(' ').filter(w => w.length >= 3)));

            const enriched = {
                ...jk,
                _normName: normName,
                _akanjeName: toAkanje(normName),
                _normAliases: normAliases,
                _akanjeAliases: normAliases.map(toAkanje),
                _normAddr: normAddr,
                _akanjeAddr: toAkanje(normAddr),
                _normDev: normDev,
                _phoneticAll: phoneticAll,
                _akanjeAll: akanjeAll,
                _akanjeWords: akanjeWords
            };
            jkByName.set(jk.jk_name, enriched);
            if (Array.isArray(jk.houses)) {
                for (const [stId, hLabel] of jk.houses) {
                    const key = `${stId}:${normHouseKey(hLabel)}`;
                    if (!houseToJKMap.has(key)) houseToJKMap.set(key, enriched);
                }
            }
            return enriched;
        });

        syncHiddenComplexSelect();
        allDataLoaded = true;
    } catch (e) {
        dataLoadFailed = true;
        console.error('Ошибка загрузки базы данных:', e);
        if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
            elements.mapStatus.textContent = '⚠️ Откройте проект через локальный сервер (например Live Server или python -m http.server)';
        } else {
            elements.mapStatus.textContent = '⚠️ Ошибка загрузки базы адресов. Обновите страницу (Ctrl+F5).';
        }
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
// 3-Tier Street Search (Phonetic + Akan'ye + Fuzzy Typo)
// ==========================================
function searchStreetsRanked(query, limit = 12) {
    const qNorm = normalizePhonetic(query);
    if (!qNorm) return [];
    const tokens = qNorm.split(' ').filter(Boolean);
    if (!tokens.length) return [];

    const typeSet = new Set(['вул', 'просп', 'пров', 'бр', 'вд', 'прд', 'наб', 'узв', 'мн', 'шосе', 'туп', 'алея']);
    const typeTokens = tokens.filter(t => typeSet.has(t));
    const nameTokens = tokens.filter(t => !typeSet.has(t));

    const effectiveTokens = nameTokens.length > 0 ? nameTokens : typeTokens;
    const mainQuery = effectiveTokens.join(' ');
    const mainAkanje = toAkanje(mainQuery);
    const effectiveAkanje = effectiveTokens.map(toAkanje);

    const scored = [];
    for (const st of streetsData) {
        let exactMatch = true;
        for (const tk of effectiveTokens) {
            if (!st._phoneticAll.includes(tk)) {
                exactMatch = false;
                break;
            }
        }

        let akanjeMatch = false;
        if (!exactMatch) {
            akanjeMatch = true;
            for (const atk of effectiveAkanje) {
                if (!st._akanjeAll.includes(atk)) {
                    akanjeMatch = false;
                    break;
                }
            }
        }

        if (!exactMatch && !akanjeMatch) continue;

        let score = exactMatch ? 20 : 8;
        if (st._normCurrent === mainQuery) score += 120;
        else if (st._normCurrent.startsWith(mainQuery)) score += 90;
        else if ((' ' + st._normCurrent).includes(' ' + mainQuery)) score += 65;
        else if (st._akanjeCurrent === mainAkanje) score += 105;
        else if (st._akanjeCurrent.startsWith(mainAkanje)) score += 78;
        else if ((' ' + st._akanjeCurrent).includes(' ' + mainAkanje)) score += 55;

        for (let i = 0; i < st._normOldList.length; i++) {
            const oldN = st._normOldList[i];
            const oldA = st._akanjeOldList[i];
            if (oldN === mainQuery) { score = Math.max(score, 110); break; }
            if (oldN.startsWith(mainQuery)) score = Math.max(score, 85);
            else if ((' ' + oldN).includes(' ' + mainQuery)) score = Math.max(score, 60);
            else if (oldA === mainAkanje) score = Math.max(score, 95);
            else if (oldA.startsWith(mainAkanje)) score = Math.max(score, 72);
        }

        for (const al of st._normAliasList) {
            if (al === mainQuery) score = Math.max(score, 105);
            else if (al.startsWith(mainQuery)) score = Math.max(score, 78);
        }

        if (typeTokens.length > 0) {
            if (typeTokens.includes(st._normType)) score += 35;
            else score -= 15;
        }

        score += Math.min(st.houseCount, 300) / 25;
        scored.push({ st, score });
    }

    const fuzzyTokens = effectiveAkanje.filter(t => t.length >= 4);
    if (scored.length < 3 && fuzzyTokens.length > 0) {
        const alreadyIds = new Set(scored.map(x => x.st.street_id));
        for (const st of streetsData) {
            if (alreadyIds.has(st.street_id)) continue;

            let totalDist = 0;
            let ok = true;
            for (const qTk of fuzzyTokens) {
                const maxD = qTk.length >= 7 ? 2 : 1;
                let bestD = maxD + 1;
                for (const w of st._akanjeWords) {
                    const target = w.length > qTk.length + 1 ? w.slice(0, qTk.length) : w;
                    const d = editDistanceBounded(qTk, target, maxD);
                    if (d < bestD) bestD = d;
                    if (bestD === 0) break;
                }
                if (bestD > maxD) { ok = false; break; }
                totalDist += bestD;
            }
            if (!ok) continue;

            let fuzzyScore = 40 - totalDist * 12 + Math.min(st.houseCount, 300) / 30;
            if (typeTokens.length > 0) {
                fuzzyScore += typeTokens.includes(st._normType) ? 15 : -10;
            }
            scored.push({ st, score: fuzzyScore });
        }
    }

    scored.sort((a, b) => b.score - a.score || naturalCollator.compare(a.st.current_name, b.st.current_name));
    return scored.slice(0, limit);
}

function parseFullAddressString(rawInput) {
    if (!rawInput || rawInput.trim().length < 4) return null;
    let s = rawInput.trim();

    s = s.replace(/\b61\d{3}\b/g, ' ');
    s = s.replace(/^(?:україна|украина|харківська\s+обл\.?|харьковская\s+обл\.?|м\.\s*харків|г\.\s*харьков|харків|харьков)[\s,]+/gi, '');
    s = s.replace(/^(?:м\.\s*харків|г\.\s*харьков|харків|харьков)[\s,]+/gi, '');

    let apartment = '';
    const aptMatch = s.match(/(?:,|\s)+(?:кв\.?|квартира|оф\.?|офіс|офис|кімн\.?)\s*№?\s*([0-9а-яa-zіїєґ-]+)\s*$/i);
    if (aptMatch) {
        apartment = aptMatch[1];
        s = s.slice(0, aptMatch.index).trim();
    }

    const houseRegex = /^(.*?)(?:,|\s+)(?:буд\.?|будинок|дом|д\.?)?\s*№?\s*(\d+\s*(?:[-/]\s*[0-9а-яa-zіїєґ]+|[а-яa-zіїєґ])?(?:\s*,?\s*(?:корп(?:ус|\.)?|к\.?)\s*№?\s*[0-9а-яa-zіїєґ-]+)?)\s*$/i;
    const hm = s.match(houseRegex);
    if (!hm || hm[1].trim().length < 2) return null;

    const streetCandidate = hm[1].replace(/[,\s]+$/, '').replace(/\(([^)]*)\)/g, ' $1 ').replace(/\s+/g, ' ').trim();
    const houseCandidate = hm[2].trim();
    if (!houseCandidate || /^\d+$/.test(streetCandidate)) return null;

    const ranked = searchStreetsRanked(streetCandidate, 3);
    if (!ranked.length) return null;

    const bestStreet = ranked[0].st;
    let resolvedHouse = houseCandidate;
    const nMap = streetNormHouses.get(bestStreet.street_id);
    const nk = normHouseKey(houseCandidate);
    const existsInRegistry = Boolean(nMap && nMap.has(nk));
    if (existsInRegistry) {
        resolvedHouse = nMap.get(nk);
    }

    return { street: bestStreet, house: resolvedHouse, apartment, existsInRegistry };
}

// ==========================================
// Dropdowns UI
// ==========================================
function closeStreetDropdown() { elements.streetDrop.classList.remove('open'); }
function closeHouseDropdown() { elements.houseDrop.classList.remove('open'); }
function closeJKDropdown() { elements.jkDrop.classList.remove('open'); }

function showStreetSuggestions(val) {
    if (dataLoadFailed) {
        elements.streetDrop.classList.add('open');
        elements.streetDrop.innerHTML = '<div class="dmsg">⚠️ База адресов не загружена (откройте проект через HTTP-сервер или обновите страницу Ctrl+F5)</div>';
        return;
    }

    const results = searchStreetsRanked(val, 12);
    const parsedAddr = parseFullAddressString(val);

    elements.streetDrop.classList.add('open');
    elements.streetDrop.innerHTML = '';

    if (parsedAddr && (parsedAddr.existsInRegistry || results.length === 0)) {
        const fastEl = document.createElement('div');
        fastEl.className = 'di di-fast';
        fastEl.tabIndex = 0;
        const aptText = parsedAddr.apartment ? `, кв. ${parsedAddr.apartment}` : '';
        fastEl.innerHTML = `
            <div class="di-main">
                <div class="di-n">⚡ ${parsedAddr.street.shortDisplay}, буд. ${parsedAddr.house}${aptText}</div>
                <div class="di-s">Заполнить адрес целиком${parsedAddr.street.old_names?.length ? ' • колиш. ' + parsedAddr.street.old_names.join(', ') : ''}</div>
            </div>
            <span class="di-tag">Полный адрес</span>
        `;
        const pickFast = () => {
            closeStreetDropdown();
            applySelectedStreetAndHouse(parsedAddr.street, parsedAddr.house, parsedAddr.apartment);
        };
        fastEl.pickAction = pickFast;
        fastEl.onmousedown = e => { e.preventDefault(); pickFast(); };
        fastEl.onkeydown = e => {
            if (e.key === 'Enter') { e.preventDefault(); pickFast(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); fastEl.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); elements.street.focus(); }
        };
        elements.streetDrop.appendChild(fastEl);
    }

    if (results.length === 0 && !elements.streetDrop.children.length) {
        elements.streetDrop.innerHTML = '<div class="dmsg">Улица не найдена в реестре г. Харькова</div>';
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

        const pick = () => pickStreetFromDropdown(st);
        el.pickAction = pick;
        el.onmousedown = e => { e.preventDefault(); pick(); };
        el.onkeydown = e => {
            if (e.key === 'Enter') { e.preventDefault(); pick(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); el.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                el.previousElementSibling ? el.previousElementSibling.focus() : elements.street.focus();
            }
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
    refreshPurpleDotsLayer();
}

function pickStreetFromDropdown(st) {
    const streetChanged = selectedStreetId !== st.street_id;
    selectStreetObject(st);
    closeStreetDropdown();

    if (streetChanged) {
        elements.house.value = '';
        elements.clearHouse.hidden = true;
    }

    const b = st.map_bounds;
    if (st.houseCount === 0 && b && b.top_lat && b.bottom_lat) {
        const cLat = (b.top_lat + b.bottom_lat) / 2;
        const cLon = (b.top_lon + b.bottom_lon) / 2;
        updateMapMarker(cLat, cLon, 16);
        const dist = (st.districts?.[0] && DISTRICT_BY_ID[st.districts[0]]) || detectDistrictPolygon(cLat, cLon) || '';
        setDistrictSilently(dist);
        computeLandmarksAndMetro(cLat, cLon);
        updateMapFooter(cLat, cLon, `${st.shortDisplay} (без отдельных номеров домов в реестре)`, 0);
        elements.house.focus();
        return;
    }

    if (map && b && b.top_lat && b.bottom_lat) {
        map.flyTo({
            center: [(b.top_lon + b.bottom_lon) / 2, (b.top_lat + b.bottom_lat) / 2],
            zoom: 15,
            duration: 550
        });
    }

    elements.house.focus();
    showHouseSuggestions(elements.house.value.trim());
}

function showHouseSuggestions(val) {
    if (!selectedStreetId) {
        const typedSt = elements.street.value.trim();
        if (typedSt.length >= 2) {
            const exact = streetsData.find(s =>
                s.full.toLowerCase() === typedSt.toLowerCase() ||
                s.shortDisplay.toLowerCase() === typedSt.toLowerCase()
            );
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
        matches = allHouses.slice(0, 35);
    } else {
        const exact = [];
        const starts = [];
        const contains = [];
        for (const h of allHouses) {
            const hk = normHouseKey(h);
            if (hk === qNorm) exact.push(h);
            else if (hk.startsWith(qNorm)) starts.push(h);
            else if (hk.includes(qNorm)) contains.push(h);
        }
        matches = [...exact, ...starts, ...contains].slice(0, 30);
    }

    elements.houseDrop.classList.add('open');
    if (!matches.length) {
        elements.houseDrop.innerHTML = '<div class="dmsg">Точного номера нет в реестре — ориентиры определятся по улице</div>';
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
                ${jkMatch ? `<div class="di-s">${jkMatch.jk_name}${jkMatch.class ? ' (' + jkMatch.class + ')' : ''}</div>` : ''}
            </div>
            ${distName ? `<span class="di-tag">${distName}</span>` : ''}
        `;

        const pick = () => {
            elements.house.value = h;
            elements.clearHouse.hidden = false;
            closeHouseDropdown();
            handleHouseSelection();
        };
        el.pickAction = pick;
        el.onmousedown = e => { e.preventDefault(); pick(); };
        el.onkeydown = e => {
            if (e.key === 'Enter') { e.preventDefault(); pick(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); el.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                el.previousElementSibling ? el.previousElementSibling.focus() : elements.house.focus();
            }
        };
        elements.houseDrop.appendChild(el);
    });
}

const JK_STOP_TOKENS = new Set([
    'жк', 'жб', 'жд', 'жбк', 'км', 'кг', 'мжк', 'кжк', 'кб', 'мфк',
    'таунхаус', 'таунхауси', 'таунхаусы', 'новобудова', 'новострой', 'новостройка',
    'по', 'на', 'в', 'у', 'за', 'от', 'від',
    'вул', 'улице', 'улици', 'вулици', 'просп', 'пров', 'бр', 'вд', 'прд', 'наб', 'узв', 'мн', 'шосе'
]);

function searchJKsRanked(query, distFilter = '', limit = 35) {
    const qNorm = normalizePhonetic(query);
    if (!qNorm) return [];
    const rawTokens = qNorm.split(' ').filter(Boolean);
    const contentTokens = rawTokens.filter(t => !JK_STOP_TOKENS.has(t));
    const effectiveTokens = contentTokens.length > 0 ? contentTokens : rawTokens;
    const mainQuery = effectiveTokens.join(' ');
    const mainAkanje = toAkanje(mainQuery);
    const effectiveAkanje = effectiveTokens.map(toAkanje);

    const tokenMatchesHaystack = (haystack, tk) => {
        if (/^\d+$/.test(tk)) {
            return new RegExp(`(?:^|\\s)${tk}(?:\\s|[а-яіїєґa-z]|$)`).test(haystack);
        }
        return haystack.includes(tk);
    };

    const scored = [];
    for (const jk of jkList) {
        let exactMatch = true;
        for (const tk of effectiveTokens) {
            if (!tokenMatchesHaystack(jk._phoneticAll, tk)) {
                exactMatch = false;
                break;
            }
        }
        let akanjeMatch = false;
        if (!exactMatch) {
            akanjeMatch = true;
            for (const atk of effectiveAkanje) {
                if (!tokenMatchesHaystack(jk._akanjeAll, atk)) {
                    akanjeMatch = false;
                    break;
                }
            }
        }
        if (!exactMatch && !akanjeMatch) continue;

        let score = exactMatch ? 45 : 30;
        if (jk._normName.includes(mainQuery)) score += jk._normName.startsWith('жк ' + mainQuery) || jk._normName === mainQuery ? 110 : 80;
        else if (jk._akanjeName.includes(mainAkanje)) score += 68;

        for (let i = 0; i < jk._normAliases.length; i++) {
            if (jk._normAliases[i] === mainQuery || jk._normAliases[i] === 'жк ' + mainQuery) {
                score = Math.max(score, 135);
                break;
            }
            if (jk._akanjeAliases[i].includes(mainAkanje)) {
                score = Math.max(score, 90);
            }
        }

        if (jk._akanjeAddr.includes(mainAkanje)) score += 40;
        if (distFilter && jk.district === distFilter) score += 12;
        if (jk.houses && jk.houses.length > 0) score += 4;

        scored.push({ jk, score });
    }

    const fuzzyTokens = effectiveAkanje.filter(t => t.length >= 4);
    const shortTokens = effectiveAkanje.filter(t => t.length < 4);
    if (scored.length < 3 && fuzzyTokens.length > 0) {
        const alreadyNames = new Set(scored.map(x => x.jk.jk_name));
        for (const jk of jkList) {
            if (alreadyNames.has(jk.jk_name)) continue;
            if (shortTokens.length > 0 && shortTokens.some(st => !jk._akanjeAll.includes(st))) continue;
            let totalDist = 0;
            let ok = true;
            for (const qTk of fuzzyTokens) {
                const maxD = qTk.length >= 7 ? 2 : 1;
                let bestD = maxD + 1;
                for (const w of jk._akanjeWords) {
                    const target = w.length > qTk.length + 1 ? w.slice(0, qTk.length) : w;
                    const d = editDistanceBounded(qTk, target, maxD);
                    if (d < bestD) bestD = d;
                    if (bestD === 0) break;
                }
                if (bestD > maxD) { ok = false; break; }
                totalDist += bestD;
            }
            if (!ok) continue;
            let fuzzyScore = 26 - totalDist * 8 + (jk.houses?.length ? 3 : 0);
            if (distFilter && jk.district === distFilter) fuzzyScore += 6;
            scored.push({ jk, score: fuzzyScore });
        }
    }

    scored.sort((a, b) => b.score - a.score || naturalCollator.compare(a.jk.jk_name, b.jk.jk_name));
    return scored.slice(0, limit).map(x => x.jk);
}

function showJKSuggestions(val) {
    const distFilter = elements.district.value;
    const qNorm = normalizePhonetic(val);

    let matches = jkList;
    if (distFilter && !qNorm) {
        matches = jkList.filter(j => j.district === distFilter);
    } else if (qNorm) {
        matches = searchJKsRanked(val, distFilter, 35);
    }

    elements.jkDrop.classList.add('open');
    elements.jkDrop.innerHTML = '';

    if (!qNorm) {
        const noneEl = document.createElement('div');
        noneEl.className = 'di';
        noneEl.tabIndex = 0;
        noneEl.innerHTML = '<div class="di-main"><div class="di-n" style="color:#64748b;">Нет (вторичный фонд / частный сектор)</div></div>';
        noneEl.onmousedown = e => {
            e.preventDefault();
            clearSelectedJK();
            elements.jkHousesBar.hidden = true;
            closeJKDropdown();
        };
        elements.jkDrop.appendChild(noneEl);
    }

    const shown = matches.slice(0, 35);
    if (!shown.length) {
        elements.jkDrop.innerHTML = '<div class="dmsg">ЖК не найден</div>';
        return;
    }

    shown.forEach(jk => {
        const el = document.createElement('div');
        el.className = 'di';
        el.tabIndex = 0;
        const firstAddr = jk.address ? jk.address.split(';')[0] : '';
        const firstAlias = (jk.aliases || []).find(a =>
            !a.startsWith('ЖК по ') && !jk.jk_name.toLowerCase().includes(a.toLowerCase())
        ) || '';
        const sub = [jk.district?.replace(' р-н', ''), firstAddr, firstAlias].filter(Boolean).join(' • ');
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
        el.pickAction = pick;
        el.onmousedown = e => { e.preventDefault(); pick(); };
        el.onkeydown = e => {
            if (e.key === 'Enter') { e.preventDefault(); pick(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); el.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                el.previousElementSibling ? el.previousElementSibling.focus() : elements.complexSearch.focus();
            }
        };
        elements.jkDrop.appendChild(el);
    });
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
    elements.btnClear.addEventListener('click', clearEntireForm);
    elements.btnCopyAll.addEventListener('click', copyFullCard);

    // Map Mode Switcher (Rieltor Map / Satellite) & JK Dots Toggle
    const setMinorRoadOpacity = (op) => {
        if (!map) return;
        ['highway-minor', 'highway-minor-casing', 'bridge-minor', 'bridge-minor-casing'].forEach(id => {
            if (map.getLayer(id)) map.setPaintProperty(id, 'line-opacity', op);
        });
    };

    elements.btnModeMap?.addEventListener('click', () => {
        elements.btnModeMap.classList.add('active');
        elements.btnModeSat?.classList.remove('active');
        if (map && map.getLayer('esri-sat-layer')) {
            map.setLayoutProperty('esri-sat-layer', 'visibility', 'none');
            setMinorRoadOpacity(1);
        }
    });

    elements.btnModeSat?.addEventListener('click', () => {
        elements.btnModeSat.classList.add('active');
        elements.btnModeMap?.classList.remove('active');
        if (map && map.getLayer('esri-sat-layer')) {
            map.setLayoutProperty('esri-sat-layer', 'visibility', 'visible');
            setMinorRoadOpacity(0.42);
        }
    });

    elements.btnToggleJKs?.addEventListener('click', () => {
        showJKDotsOnMap = !showJKDotsOnMap;
        elements.btnToggleJKs.classList.toggle('active', showJKDotsOnMap);
        refreshPurpleDotsLayer();
    });

    document.querySelectorAll('[data-copy-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.copyTarget);
            if (target && target.value.trim()) {
                navigator.clipboard.writeText(target.value.trim());
                showToast('Скопировано в буфер обмена');
            }
        });
    });

    // Street Input
    elements.street.addEventListener('input', e => {
        selectedStreetId = null;
        elements.streetRenameBadge.hidden = true;
        const v = e.target.value.trim();
        elements.clearStreet.hidden = v.length === 0;
        if (v.length < 2) {
            closeStreetDropdown();
            refreshPurpleDotsLayer();
            return;
        }
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
            const firstItem = elements.streetDrop.classList.contains('open')
                ? elements.streetDrop.querySelector('.di')
                : null;
            if (firstItem && typeof firstItem.pickAction === 'function') {
                firstItem.pickAction();
                return;
            }
            const raw = elements.street.value.trim();
            const parsed = parseFullAddressString(raw);
            if (parsed) {
                closeStreetDropdown();
                applySelectedStreetAndHouse(parsed.street, parsed.house, parsed.apartment);
                return;
            }
            const firstMatch = searchStreetsRanked(raw, 1);
            if (!selectedStreetId && firstMatch.length) {
                pickStreetFromDropdown(firstMatch[0].st);
            }
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!elements.streetDrop.classList.contains('open') && elements.street.value.trim().length >= 2) {
                showStreetSuggestions(elements.street.value.trim());
            }
            elements.streetDrop.querySelector('.di')?.focus();
        }
    });

    elements.clearStreet.addEventListener('click', () => {
        elements.street.value = '';
        elements.house.value = '';
        elements.clearStreet.hidden = true;
        elements.clearHouse.hidden = true;
        elements.streetRenameBadge.hidden = true;
        selectedStreetId = null;
        nearbyLandmarkPool = [];
        resetAutoComputedFields();
        refreshPurpleDotsLayer();
        elements.street.focus();
    });

    // House Input
    elements.house.addEventListener('input', e => {
        const v = e.target.value.trim();
        elements.clearHouse.hidden = v.length === 0;
        showHouseSuggestions(v);
        clearTimeout(houseInputTimer);
        if (selectedStreetId && v.length > 0) {
            const nMap = streetNormHouses.get(selectedStreetId);
            if (nMap && nMap.has(normHouseKey(v))) {
                houseInputTimer = setTimeout(() => handleHouseSelection(), 340);
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
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            elements.houseDrop.querySelector('.di')?.focus();
        }
    });

    elements.house.addEventListener('blur', () => {
        clearTimeout(houseInputTimer);
        setTimeout(() => {
            if (document.activeElement?.closest('#HD')) return;
            if (elements.house.value.trim()) handleHouseSelection();
        }, 120);
    });

    elements.clearHouse.addEventListener('click', () => {
        elements.house.value = '';
        elements.clearHouse.hidden = true;
        elements.house.focus();
        showHouseSuggestions('');
    });

    // JK Combobox Input
    elements.complexSearch.addEventListener('focus', () => {
        showJKSuggestions(selectedJK ? '' : elements.complexSearch.value.trim());
    });

    elements.complexSearch.addEventListener('input', e => {
        const v = e.target.value.trim();
        elements.clearJK.hidden = v.length === 0;
        if (!v) {
            selectedJK = null;
            elements.jkClass.value = '';
        }
        showJKSuggestions(v);
    });

    elements.complexSearch.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeJKDropdown();
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstItem = elements.jkDrop.classList.contains('open')
                ? elements.jkDrop.querySelector('.di')
                : null;
            if (firstItem && typeof firstItem.pickAction === 'function') {
                firstItem.pickAction();
            }
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            elements.jkDrop.querySelector('.di')?.focus();
        }
    });

    elements.clearJK.addEventListener('click', () => {
        clearSelectedJK();
        elements.jkHousesBar.hidden = true;
    });

    // District Change -> Rieltor.ua Spotlight Cutout + Filter JK Dots + Frame District
    elements.district.addEventListener('change', () => {
        if (silentState) return;
        const dist = elements.district.value;
        highlightDistrictPolygon(dist);
        syncHiddenComplexSelect(dist);
        refreshPurpleDotsLayer();

        if (map && dist && districtPolygons?.[dist] && window.turf) {
            try {
                const bbox = turf.bbox(districtPolygons[dist]);
                map.fitBounds(
                    [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
                    { padding: 55, maxZoom: 13.5, duration: 650 }
                );
            } catch (err) {
                console.error(err);
            }
        } else if (map && !dist) {
            map.flyTo({ center: MAP_INITIAL_CENTER, zoom: MAP_INITIAL_ZOOM, duration: 550 });
        }
    });

    elements.landmark.addEventListener('input', syncLandmarkChipStates);

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
    elements.clearHouse.hidden = !houseVal;
    if (aptVal) elements.apartment.value = aptVal;

    if (houseVal) {
        handleHouseSelection();
    } else {
        const b = stObj.map_bounds;
        if (map && b && b.top_lat && b.bottom_lat) {
            map.flyTo({
                center: [(b.top_lon + b.bottom_lon) / 2, (b.top_lat + b.bottom_lat) / 2],
                zoom: 15,
                duration: 550
            });
        }
        elements.house.focus();
        showHouseSuggestions('');
    }
}

function handleHouseSelection() {
    const streetVal = elements.street.value.trim();
    const rawHouse = elements.house.value.trim();

    if (!selectedStreetId && streetVal.length >= 2) {
        const exact = streetsData.find(x =>
            x.full.toLowerCase() === streetVal.toLowerCase() ||
            x.shortDisplay.toLowerCase() === streetVal.toLowerCase()
        );
        if (exact) {
            selectStreetObject(exact);
        } else {
            const top = searchStreetsRanked(streetVal, 1);
            if (top.length && top[0].score >= 80) selectStreetObject(top[0].st);
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
        elements.clearHouse.hidden = false;
        const arr = streetHouses[exactHouseLabel];
        lat = arr[0];
        lon = arr[1];
        officialDist = arr[2] ? DISTRICT_BY_ID[arr[2]] : null;
        postCode = arr[3] || 0;
    } else {
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

    activePostCode = postCode;
    updateMapMarker(lat, lon, 16.5);

    const detectedDist = officialDist || detectDistrictPolygon(lat, lon) || '';

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

    const statusText = isApproximate
        ? `Дом «${rawHouse}» не числится в реестре — показан центр ${stObj.shortDisplay}`
        : `📍 ${stObj.shortDisplay}, ${exactHouseLabel}`;
    updateMapFooter(lat, lon, statusText, postCode);
}

// ==========================================
// Reverse Geocoding (Click on Map / Drag Pin)
// ==========================================
function handleMapClickOrDrag(lat, lon, sourceLabel) {
    let best = null;
    let bestDist = 130;

    for (let i = 0; i < flatHouses.length; i++) {
        const h = flatHouses[i];
        if (Math.abs(h.lat - lat) > 0.0014 || Math.abs(h.lon - lon) > 0.002) continue;
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
            elements.clearHouse.hidden = false;
            activePostCode = best.postCode || 0;
            const targetZoom = map ? Math.max(map.getZoom(), 16) : 16;
            updateMapMarker(best.lat, best.lon, targetZoom);

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
            updateMapFooter(best.lat, best.lon, `📍 ${stObj.shortDisplay}, ${best.house}`, activePostCode);
            return;
        }
    }

    activePostCode = 0;
    const targetZoom = map ? Math.max(map.getZoom(), 14.5) : 15;
    updateMapMarker(lat, lon, targetZoom);
    const polyDist = detectDistrictPolygon(lat, lon) || 'Передмістя';
    setDistrictSilently(polyDist);
    computeLandmarksAndMetro(lat, lon);
    updateMapFooter(lat, lon, `${sourceLabel}: участок вне зданий реестра (${polyDist})`, 0);
}

function createRieltorPinElement() {
    const wrap = document.createElement('div');
    wrap.className = 'object-pin-wrap';
    wrap.innerHTML = `
        <div class="object-pin-pulse"></div>
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 1.5C8.00 1.5 1.5 8.00 1.5 16C1.5 26.25 16 38.5 16 38.5C16 38.5 30.5 26.25 30.5 16C30.5 8.00 24.00 1.5 16 1.5Z"
                  fill="#6d28d9" stroke="#ffffff" stroke-width="2.2"/>
            <circle cx="16" cy="15.5" r="5.5" fill="#ffffff"/>
        </svg>
    `;
    return wrap;
}

function updateMapMarker(lat, lon, zoom = 16) {
    if (!map || !window.maplibregl) return;

    map.flyTo({ center: [lon, lat], zoom, duration: 520 });

    if (marker) {
        marker.setLngLat([lon, lat]);
    } else {
        marker = new maplibregl.Marker({
            element: createRieltorPinElement(),
            anchor: 'bottom',
            draggable: true
        })
            .setLngLat([lon, lat])
            .addTo(map);

        marker.on('dragend', () => {
            const pos = marker.getLngLat();
            handleMapClickOrDrag(pos.lat, pos.lng, 'Маркер');
        });
    }
}

function updateMapFooter(lat, lon, statusText, postCode = 0) {
    const latStr = lat.toFixed(6);
    const lonStr = lon.toFixed(6);
    elements.mapStatus.textContent = statusText;
    if (postCode) {
        elements.postDisplay.textContent = `Индекс ${postCode}`;
        elements.postDisplay.hidden = false;
    } else {
        elements.postDisplay.hidden = true;
    }
    elements.gmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${latStr},${lonStr}`;
    elements.mapLinks.hidden = false;
}

// ==========================================
// District Spotlight Mask & ЖК Logic
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

// Rieltor.ua Spotlight Effect: dim everything outside selected district in periwinkle-indigo (#6974f7)
function highlightDistrictPolygon(distName) {
    activeDistrictMaskName = distName || '';
    if (!customLayersReady || !map) return;

    const maskSrc = map.getSource('district-mask-src');
    const outSrc = map.getSource('district-outline-src');
    if (!maskSrc || !outSrc) return;

    if (!distName || !districtPolygons || !districtPolygons[distName]) {
        maskSrc.setData({ type: 'FeatureCollection', features: [] });
        outSrc.setData({ type: 'FeatureCollection', features: [] });
        return;
    }

    const geom = districtPolygons[distName];
    maskSrc.setData(buildInvertedSpotlightMask(geom));
    outSrc.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: geom, properties: { name: distName } }]
    });
}

function setDistrictSilently(distName) {
    silentState = true;
    elements.district.value = distName || '';
    silentState = false;
    highlightDistrictPolygon(distName);
    syncHiddenComplexSelect(distName);
    refreshPurpleDotsLayer();
}

function detectResidentialComplex(stId, houseLabel) {
    const nk = normHouseKey(houseLabel);
    const direct = houseToJKMap.get(`${stId}:${nk}`);
    if (direct) return direct;

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
            elements.clearHouse.hidden = false;
            handleHouseSelection();
            renderJKHousesBar(jkObj, firstStId, firstHouse);
            return;
        }
    }

    elements.jkHousesBar.hidden = true;
    if (jkObj.lat && jkObj.lon) {
        updateMapMarker(jkObj.lat, jkObj.lon, 16);
        computeLandmarksAndMetro(jkObj.lat, jkObj.lon);
        updateMapFooter(jkObj.lat, jkObj.lon, `🏢 ${jkObj.jk_name}${jkObj.address ? ' (' + jkObj.address + ')' : ''}`, 0);
    }
}

function renderJKHousesBar(jkObj, activeStId, activeHouse) {
    if (!jkObj || !Array.isArray(jkObj.houses) || jkObj.houses.length <= 1) {
        elements.jkHousesBar.hidden = true;
        return;
    }

    elements.jkHousesBar.innerHTML = `<strong>Дома ${jkObj.jk_name}:</strong>`;
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
                elements.clearHouse.hidden = false;
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
    if (metroData.length > 0) {
        const sortedMetros = metroData
            .map(m => ({ ...m, dist: getHaversineDistance(lat, lon, m.lat, m.lon) }))
            .sort((a, b) => a.dist - b.dist);

        const closest = sortedMetros[0];
        if (closest && closest.dist <= 5800) {
            elements.metro.value = closest.name;
            updateMetroHint(closest);
        } else {
            elements.metro.value = 'Нет';
            elements.metroHint.textContent = closest ? `Ближайшая ст. «${closest.name}» — ${formatDist(closest.dist)}` : 'Нет данных';
        }

        const altMetros = sortedMetros.filter(m => m.dist <= 2200).slice(0, 3);
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

    if (landmarksData.length > 0) {
        const withDist = landmarksData
            .map(l => ({ ...l, dist: getHaversineDistance(lat, lon, l.lat, l.lon) }))
            .filter(l => l.dist <= 2800)
            .sort((a, b) => a.dist - b.dist);

        const areas = withDist.filter(l => l.type === 'area' && l.dist <= 2000);
        const pois = withDist.filter(l => l.type !== 'area' && l.dist <= 1800);

        const autoPicked = [];
        const pickedNames = new Set();

        if (areas.length > 0) {
            autoPicked.push(areas[0]);
            pickedNames.add(areas[0].name.toLowerCase());
        }

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

        for (const item of [...pois, ...areas]) {
            if (autoPicked.length >= 3) break;
            if (!pickedNames.has(item.name.toLowerCase())) {
                autoPicked.push(item);
                pickedNames.add(item.name.toLowerCase());
            }
        }

        elements.landmark.value = autoPicked.length > 0
            ? autoPicked.map(x => x.name).join(', ')
            : '';

        const chipCandidates = [];
        const seenChip = new Set();
        for (const item of [...autoPicked, ...areas.slice(0, 3), ...pois.slice(0, 6)]) {
            const k = item.name.toLowerCase();
            if (seenChip.has(k)) continue;
            seenChip.add(k);
            chipCandidates.push(item);
            if (chipCandidates.length >= 8) break;
        }
        nearbyLandmarkPool = chipCandidates;
        renderLandmarkChips();
    }
}

function updateMetroHint(m) {
    const walkMin = Math.max(1, Math.round(m.dist / 72));
    const travelStr = m.dist <= 2000
        ? `🚶 ~${formatDist(m.dist)} (~${walkMin} мин пешком)`
        : `🚌 ~${formatDist(m.dist)} (на транспорте)`;
    const parts = [travelStr];
    if (m.line) parts.push(`${m.line} линия`);
    if (m.old_name) parts.push(`колиш. ${m.old_name}`);
    elements.metroHint.textContent = parts.join(' • ');
}

function getCurrentLandmarkList() {
    const raw = elements.landmark.value.trim();
    if (!raw || raw === 'Нет' || raw === 'Немає') return [];
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
// Form Reset & Copy Card
// ==========================================
function resetAutoComputedFields() {
    clearSelectedJK();
    setDistrictSilently('');
    activePostCode = 0;
    elements.metro.value = '';
    elements.metroHint.textContent = 'Подтянется автоматически по координатам дома';
    elements.metroChips.innerHTML = '';
    elements.landmark.value = '';
    elements.landmarkChips.innerHTML = '';
    elements.jkHousesBar.hidden = true;
    elements.mapLinks.hidden = true;
    elements.mapStatus.textContent = 'Кликните по карте, станции метро, ЖК или перетащите маркер для выбора дома';
    if (marker) {
        marker.remove();
        marker = null;
    }
}

function clearEntireForm() {
    elements.street.value = '';
    elements.clearStreet.hidden = true;
    elements.streetRenameBadge.hidden = true;
    elements.house.value = '';
    elements.clearHouse.hidden = true;
    elements.apartment.value = '';
    selectedStreetId = null;
    nearbyLandmarkPool = [];
    resetAutoComputedFields();
    refreshPurpleDotsLayer();
    if (map) {
        map.flyTo({ center: MAP_INITIAL_CENTER, zoom: MAP_INITIAL_ZOOM, duration: 550 });
    }
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
    if (elements.metro.value && elements.metro.value !== 'Нет') {
        lines.push(`Метро: ${elements.metro.value}`);
    }
    if (elements.landmark.value) {
        lines.push(`Орієнтир: ${elements.landmark.value}`);
    }
    if (activePostCode) {
        lines.push(`Індекс: ${activePostCode}`);
    }

    if (!lines.length) {
        showToast('Сначала выберите адрес или точку на карте');
        return;
    }

    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Карточка объекта скопирована');
}
