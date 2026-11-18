import json
import math
import os
import re

ROOT_DIR = r"c:\Users\olego\OneDrive\Документы\GitHub\auto-orientir"
SCRATCH_DIR = r"C:\Users\olego\.gemini\antigravity\brain\ac34ec8e-7144-44fa-af2e-708e5476599b\scratch"

with open(os.path.join(SCRATCH_DIR, "rieltor_orients_list.json"), encoding="utf-8") as f:
    orients = json.load(f)
with open(os.path.join(SCRATCH_DIR, "rieltor_orients_geospaces.json"), encoding="utf-8") as f:
    geospaces = json.load(f)
with open(os.path.join(SCRATCH_DIR, "osm_residential_polygons.json"), encoding="utf-8") as f:
    osm_res = json.load(f)
with open(os.path.join(SCRATCH_DIR, "osm_places.json"), encoding="utf-8") as f:
    osm_places = json.load(f)
with open(os.path.join(SCRATCH_DIR, "osm_relations_geom.json"), encoding="utf-8") as f:
    osm_rels = json.load(f)
with open(os.path.join(SCRATCH_DIR, "osm_unnamed_residential.json"), encoding="utf-8") as f:
    osm_unnamed = json.load(f)
with open(os.path.join(ROOT_DIR, "data", "houses.json"), encoding="utf-8") as f:
    houses_data = json.load(f)
landmarks_backup_path = os.path.join(SCRATCH_DIR, "legacy_curated_landmarks.json")
landmarks_live_path = os.path.join(ROOT_DIR, "data", "landmarks.json")
with open(landmarks_backup_path if os.path.exists(landmarks_backup_path) else landmarks_live_path, encoding="utf-8") as f:
    old_landmarks = json.load(f)
if not os.path.exists(landmarks_backup_path):
    with open(landmarks_backup_path, "w", encoding="utf-8") as f:
        json.dump(old_landmarks, f, ensure_ascii=False, indent=2)

POI_NAMES = {
    "Аквапарк Джунглі": "landmark",
    "Автовокзал": "landmark",
    "Автостанція Привокзальна": "landmark",
    "Аерокосмічний університет": "landmark",
    "Архангело-Михайлівський храм": "landmark",
    'Авторинок "Барабашово"': "market",
    "Барабашово": "market",
    "Велозаводський сквер": "park",
    "Григорівський бір": "park",
    "Журавлівський гідропарк": "park",
    'Завод "Електроважмаш"': "landmark",
    "Іподром": "landmark",
    "Інститут банківської справи": "landmark",
    "Кінний ринок": "market",
    "карʼєр Дружба": "park",
    "Константино-Єленівський храм": "landmark",
    "Карпівський сад": "park",
    'Кінотеатр "Palladium"': "landmark",
    "Комунальний ринок": "market",
    'Кінотеатр "Київ"': "landmark",
    "КСК «Коммунар»": "landmark",
    "Лісопарк": "park",
    "Локомотив": "landmark",
    "Майдан Захисників України": "landmark",
    "Молодіжний парк": "park",
    'Медичний центр "Вікторія"': "landmark",
    "Міська лікарня №7": "landmark",
    "Міська лікарня №2": "landmark",
    "Олексіївський лугопарк": "park",
    "Основ'янське озеро": "park",
    "Обласна інфекційна лікарня": "landmark",
    "парк Зелений гай": "park",
    "парк ім. М. Горького": "park",
    "парк Зустріч": "park",
    "парк Юність": "park",
    "парк Машинобудівників": "park",
    "парк Перемога": "park",
    "Палац Залізничників": "landmark",
    "Пташиний ринок": "market",
    "Парк Мирський Гай": "park",
    "Пам'ятник Гвардійцям Широнінцям": "landmark",
    "Парк Пам'яті": "park",
    "Педагогічний університет": "landmark",
    "стадіон Металіст": "landmark",
    "Саржин Яр": "park",
    "Савкин Яр": "park",
    "Свято-Успенський собор": "landmark",
    "Сад ім. Т. Шевченка": "park",
    "Сумський ринок": "market",
    'Спортклуб "Фенікс"': "landmark",
    "Сквер Стрілка": "park",
    'Спорткомплекс "Зміна"': "landmark",
    "Стадіон ХТЗ": "landmark",
    "Салтівський м'ясокомбінат": "landmark",
    "Сад «ім. 50-річчя Жовтня»": "park",
    "Свято-Миколаївський храм": "landmark",
    "Свято-Покровський храм": "landmark",
    'Спортклуб "ADRENALIN"': "landmark",
    "ТРЦ Французький бульвар": "mall",
    "ТРЦ Караван": "mall",
    "ТРК Україна": "mall",
    "ТРЦ Sun Mall": "mall",
    "ТРЦ Planeta Mall": "mall",
    "ТРЦ Nikolsky": "mall",
    'ТЦ "Екватор"': "mall",
    'ТРЦ "Дафі"': "mall",
    "Урбан-парк": "park",
    "Університет радіоелектроніки": "landmark",
    "Університет міського господарства": "landmark",
    "Харківський зоопарк": "park",
    "Харківська Швейцарія": "landmark",
    "Храм Казанської Божої Матері": "landmark",
    "Цирк": "landmark",
    "Центральний Ринок": "market",
    "ЦНАП": "landmark",
}

# Build OSM polygon lookup (keep all candidates per name to pick best/largest full block)
osm_polys = {}
osm_ways_by_id = {}

def poly_area_approx(ring):
    if len(ring) < 3:
        return 0.0
    clat = sum(p[1] for p in ring) / len(ring)
    cos_lat = math.cos(math.radians(clat))
    area = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i][0] * 111.32 * cos_lat, ring[i][1] * 111.32
        x2, y2 = ring[(i + 1) % len(ring)][0] * 111.32 * cos_lat, ring[(i + 1) % len(ring)][1] * 111.32
        area += x1 * y2 - x2 * y1
    return abs(area) * 0.5

def add_osm_poly(key, ring):
    k = key.lower().strip()
    area = poly_area_approx(ring)
    if k not in osm_polys or area > osm_polys[k][0]:
        osm_polys[k] = (area, ring)

osm_periph_path = os.path.join(SCRATCH_DIR, "osm_api_peripheral.json")
osm_periph_ways = []
if os.path.exists(osm_periph_path):
    with open(osm_periph_path, encoding="utf-8") as f:
        periph_dict = json.load(f)
    for plist in periph_dict.values():
        for item in plist:
            ring = item.get("polygon", [])
            if len(ring) >= 4:
                osm_ways_by_id[item["id"]] = ring
                tags = item.get("tags", {})
                for k in ("name:uk", "name", "name:ru", "alt_name"):
                    if tags.get(k):
                        add_osm_poly(tags[k], ring)

for e in osm_res + osm_places + osm_unnamed:
    if e.get("type") == "way" and e.get("geometry"):
        ring = [[round(pt["lon"], 6), round(pt["lat"], 6)] for pt in e["geometry"]]
        if len(ring) >= 3:
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            osm_ways_by_id[e["id"]] = ring
            tags = e.get("tags", {})
            for k in ("name:uk", "name", "name:ru", "alt_name"):
                if tags.get(k):
                    add_osm_poly(tags[k], ring)

for rid, rdata in osm_rels.items():
    tags = rdata.get("tags", {})
    ring = [[round(pt[0], 6), round(pt[1], 6)] for pt in rdata["polygon"]]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    for k in ("name:uk", "name", "name:ru", "alt_name"):
        if tags.get(k):
            add_osm_poly(tags[k], ring)

DIRECT_WAY_IDS = {
    "615 м.р.": 165612351,                 # Full 615-й мікрорайон (0.427 km2), not tiny 165709434 sliver
    "627 м.р.": 330646782,                 # 624А / 627 м.р.
    "4 м.р.": 1298632592,
    "2 м.р.": 442328997,
    "Відрадне": 998782667,
    "Дальня Журавлівка": 1276818885,
    "Друге Салтівське селище": 1276818875,
    "Перше Салтівське селище": 1277911159,
    "Заїки": 86084367,                     # Exact Заїки residential polygon (0.523 km2)
    "Зелене": 85897282,
    "Інтернаціоналіст": 1018294359,
    "Кулиничі": 1539779348,
    "Карпівка": 1277777649,
    "Лагерне": 1277779000,
    "Лазьківка": 1381347841,
    "Нахалівка": 1446588562,
    "Павленки": 498287914,                 # Exact Павленки residential polygon (0.358 km2)
    "Перемога": 254498459,
    "Петренки": 1277912943,
    "Рубанівка": 1279072948,
    "Федірці": 329426484,                  # Exact Федірці residential polygon (1.205 km2)
    "Ясні Зорі": 1276786473,               # Exact Ясні Зорі quarter (0.840 km2)
    "Чунихи": 1565180913,
    "Шевченки": 1381347842,
}

# Exact street-bounded polygons for historic quarters & microdistricts where OSM had no single named way
CUSTOM_STREET_POLYGONS = {
    "537 м.р.": [
        [36.3578, 50.0322], [36.3695, 50.0322], [36.3695, 50.0268], [36.3578, 50.0268], [36.3578, 50.0322]
    ],
    "606-А м.р.": [
        [36.3502, 50.0088], [36.3646, 50.0088], [36.3646, 50.0005], [36.3502, 50.0005], [36.3502, 50.0088]
    ],
    "25 м.р.": [
        [36.3143, 49.9516], [36.3242, 49.9516], [36.3242, 49.9432], [36.3143, 49.9432], [36.3143, 49.9516]
    ],
    "841 м.р.": [
        [36.2505, 49.9542], [36.2621, 49.9542], [36.2621, 49.9462], [36.2505, 49.9462], [36.2505, 49.9542]
    ],
    "Поділ": [
        [36.2285, 49.9898], [36.2412, 49.9898], [36.2422, 49.9865], [36.2405, 49.9818],
        [36.2315, 49.9818], [36.2275, 49.9852], [36.2285, 49.9898]
    ],
    "Університетська гірка": [
        [36.2275, 49.9935], [36.2335, 49.9935], [36.2345, 49.9882], [36.2282, 49.9875], [36.2275, 49.9935]
    ],
    "Залопань": [
        [36.2075, 49.9958], [36.2255, 49.9958], [36.2248, 49.9845], [36.2075, 49.9845], [36.2075, 49.9958]
    ],
    "Лопанська стрілка": [
        [36.2202, 49.9885], [36.2288, 49.9885], [36.2288, 49.9818], [36.2202, 49.9818], [36.2202, 49.9885]
    ],
    "Захарків": [
        [36.2435, 49.9905], [36.2575, 49.9905], [36.2575, 49.9805], [36.2435, 49.9805], [36.2435, 49.9905]
    ],
    "Серп і молот": [
        [36.2862, 49.9879], [36.2980, 49.9879], [36.2980, 49.9793], [36.2862, 49.9793], [36.2862, 49.9879]
    ],
    "Третє Салтівське селище": [
        [36.3295, 49.9877], [36.3440, 49.9877], [36.3440, 49.9798], [36.3295, 49.9798], [36.3295, 49.9877]
    ],
    "Воєнвід": [
        [36.4150, 49.9272], [36.4295, 49.9272], [36.4295, 49.9184], [36.4150, 49.9184], [36.4150, 49.9272]
    ],
    "Григорівка": [
        [36.1520, 49.9682], [36.1712, 49.9682], [36.1712, 49.9566], [36.1520, 49.9566], [36.1520, 49.9682]
    ],
    "Кабанова Дача": [
        [36.2678, 50.0658], [36.2800, 50.0658], [36.2800, 50.0568], [36.2678, 50.0568], [36.2678, 50.0658]
    ],
    "Помірки": [
        [36.2712, 50.0498], [36.2848, 50.0498], [36.2848, 50.0408], [36.2712, 50.0408], [36.2712, 50.0498]
    ],
    "Південні П'ятихатки": [
        [36.3912, 49.9258], [36.4058, 49.9258], [36.4058, 49.9158], [36.3912, 49.9158], [36.3912, 49.9258]
    ],
    "Филиппівка": [
        [36.1810, 49.9475], [36.2065, 49.9475], [36.2065, 49.9325], [36.1810, 49.9325], [36.1810, 49.9475]
    ],
}

def make_circle_polygon(lat, lon, radius_km, n_pts=24):
    ring = []
    r_lat = radius_km / 111.32
    r_lon = radius_km / (111.32 * math.cos(math.radians(lat)))
    for i in range(n_pts):
        ang = 2 * math.pi * i / n_pts
        px = round(lon + r_lon * math.cos(ang), 6)
        py = round(lat + r_lat * math.sin(ang), 6)
        ring.append([px, py])
    ring.append(ring[0])
    return ring

def get_osm_poly(name):
    if name in DIRECT_WAY_IDS and DIRECT_WAY_IDS[name] in osm_ways_by_id:
        return osm_ways_by_id[DIRECT_WAY_IDS[name]], "osm"
    if name in CUSTOM_STREET_POLYGONS:
        return None, None
    nl = name.lower().strip()
    if nl in osm_polys:
        return osm_polys[nl][1], "osm"
    m = re.match(r"^(\d+(?:-[аa])?)\s*м\.р\.$", nl)
    if m:
        num = m.group(1)
        for c in (
            f"{num}-й мікрорайон",
            f"мікрорайон {num}",
            f"мікрорайон {num.replace('-', ' ')}",
            f"мікрорайон {num.replace('-', '')}",
            f"{num} мікрорайон",
        ):
            if c in osm_polys:
                return osm_polys[c][1], "osm"
    if "північний-1" in nl:
        return (osm_polys["джерела"][1] if "джерела" in osm_polys else None), "osm"
    m_ns = re.match(r"^північний-(\d)$", nl)
    if m_ns:
        k = f"північна салтівка {m_ns.group(1)}"
        return (osm_polys[k][1] if k in osm_polys else None), "osm"
    if nl == "піски (522 м.р.)":
        return (osm_polys["522-й мікрорайон"][1] if "522-й мікрорайон" in osm_polys else None), "osm"
    if nl == "обрій-1":
        return (osm_polys["обрій 1"][1] if "обрій 1" in osm_polys else None), "osm"
    if nl == "обрій-2":
        return (osm_polys["обрій 2"][1] if "обрій 2" in osm_polys else None), "osm"
    if nl == "п'ятихатки":
        return (osm_polys["п’ятихатки"][1] if "п’ятихатки" in osm_polys else None), "osm"
    return None, None

def extract_rieltor_ring(polys):
    if not polys:
        return None
    cur = polys
    while isinstance(cur, list) and len(cur) > 0 and isinstance(cur[0], list) and isinstance(cur[0][0], list):
        cur = cur[0]
    ring = [[round(float(pt[0]), 6), round(float(pt[1]), 6)] for pt in cur if len(pt) >= 2]
    if len(ring) >= 3:
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        return ring
    return None

def polygon_centroid_and_area(ring):
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    if not pts:
        return 50.0, 36.25, 0.5
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    clon = round(sum(lons) / len(lons), 6)
    clat = round(sum(lats) / len(lats), 6)
    # Shoelace area in km^2
    cos_lat = math.cos(math.radians(clat))
    area = 0.0
    n = len(pts)
    for i in range(n):
        x1 = pts[i][0] * 111.32 * cos_lat
        y1 = pts[i][1] * 111.32
        x2 = pts[(i + 1) % n][0] * 111.32 * cos_lat
        y2 = pts[(i + 1) % n][1] * 111.32
        area += x1 * y2 - x2 * y1
    area_km2 = round(max(abs(area) * 0.5, 0.02), 3)
    return clat, clon, area_km2

def pip(lon, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi):
            inside = not inside
        j = i
    return inside

# Flatten houses from houses.json for district detection
DISTRICT_BY_ID = {
    1: "Немишлянський р-н",
    2: "Індустріальний р-н",
    3: "Шевченківський р-н",
    4: "Київський р-н",
    5: "Салтівський р-н",
    6: "Холодногірський р-н",
    7: "Новобаварський р-н",
    8: "Основ'янський р-н",
    9: "Слобідський р-н",
}

all_houses = []
for st_id, h_dict in houses_data.items():
    if not isinstance(h_dict, dict):
        continue
    for h_num, arr in h_dict.items():
        if isinstance(arr, list) and len(arr) >= 3 and arr[0] and arr[1] and arr[2] in DISTRICT_BY_ID:
            all_houses.append((float(arr[1]), float(arr[0]), DISTRICT_BY_ID[arr[2]]))

CENTRAL_MASSIFS = {
    "Центр", "Держпром", "Нагірний", "Поділ", "Університетська гірка",
    "Левада", "Соснова гірка", "Шатилівка", "Залопань", "Лопанська стрілка",
    "Південна залізниця", "Панасівка", "Гончарівка", "Захарків", "Москалівка",
    "Павлівка"
}

def detect_districts_for_polygon(name, ring, clat, clon):
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    dist_counts = {}
    for hlon, hlat, hd in all_houses:
        if min_lon <= hlon <= max_lon and min_lat <= hlat <= max_lat:
            if pip(hlon, hlat, ring):
                dist_counts[hd] = dist_counts.get(hd, 0) + 1
    if not dist_counts:
        # Fallback to nearest houses within 800m of centroid
        for hlon, hlat, hd in all_houses:
            d_m = math.hypot((hlon - clon) * 111320 * 0.64, (hlat - clat) * 111320)
            if d_m < 800:
                dist_counts[hd] = dist_counts.get(hd, 0) + 1
    total_h = sum(dist_counts.values()) or 1
    # Keep districts that have >= 15 houses or >= 10% of houses in the massif
    dists = [
        d for d, cnt in sorted(dist_counts.items(), key=lambda x: -x[1])
        if cnt >= 12 or (cnt / total_h) >= 0.12
    ]
    if not dists and dist_counts:
        dists = [max(dist_counts.items(), key=lambda x: x[1])[0]]
    if name in CENTRAL_MASSIFS and "Центр" not in dists:
        dists.append("Центр")
    return dists

def build_aliases(name):
    aliases = set()
    nl = name.lower()
    # Numbered microdistrict aliases: "524 м.р." -> "524", "524 мкр", "524 мікрорайон", "Салтівка 524"
    m = re.match(r"^(\d+(?:-[аaАA])?)\s*м\.р\.$", name)
    if m:
        num = m.group(1)
        aliases.add(f"{num} мкр")
        aliases.add(f"{num}-й мкр.")
        aliases.add(f"{num} мікрорайон")
        aliases.add(f"{num} микрорайон")
        if num.startswith(("5", "6")):
            aliases.add(f"Салтівка {num}")
            aliases.add(f"Салтовка {num}")
            if num == "521":
                aliases.add("608 м.р.")
                aliases.add("Салтівка 521 (608)")
                aliases.add("608 мкр")
            elif num == "627":
                aliases.add("624-А м.р.")
                aliases.add("624А м.р.")
                aliases.add("Салтівка 624-А")
        elif num.startswith("2"):
            aliases.add(f"Нові Будинки {num}")
        elif num.startswith("33"):
            aliases.add(f"Олексіївка {num}")
        elif num.startswith("759"):
            aliases.add(f"Рогань {num}")
    if name == "Піски (522 м.р.)":
        aliases.update(["522 м.р.", "522 мкр", "Салтівка 522", "Салтовка 522", "Піски", "Пески"])
    elif name == "Північний-1 (Джерела)":
        aliases.update(["Північна Салтівка-1", "Северная Салтовка-1", "Джерела", "Джерело (Родник)", "Родники"])
    elif name.startswith("Північний-"):
        num = name.split("-")[1]
        aliases.update([f"Північна Салтівка-{num}", f"Северная Салтовка-{num}"])
    elif name == "Північна Салтівка":
        aliases.update(["Северная Салтовка"])
    elif name == "Павлове поле":
        aliases.update(["Павлове Поле", "Павлово Поле"])
    elif name == "Олексіївка":
        aliases.update(["Алексеевка", "Стара Олексіївка"])
    elif name == "Нові будинки":
        aliases.update(["Нові Будинки", "Новые Дома"])
    elif name == "Холодна гора":
        aliases.update(["Холодна Гора", "Холодная Гора"])
    elif name == "Соснова гірка":
        aliases.update(["Соснова Гірка", "Сосновая Горка"])
    elif name == "Сокольники":
        aliases.update(["Сокільники"])
    elif name == "Тюринка":
        aliases.update(["Тюрінка"])
    elif name == "Держпром":
        aliases.update(["Госпром"])
    elif name == "Нагірний":
        aliases.update(["Нагорный", "Нагірний район"])
    elif name == "Поділ":
        aliases.update(["Подол"])
    elif name == "Центр":
        aliases.update(["Історичний Центр", "Тихий центр"])
    elif name == "Рогань":
        aliases.update(["Роганський", "Роганський ж/м"])
    elif name == "Горизонт":
        aliases.update(["Обрій"])
    elif name == "Обрій":
        aliases.update(["Горизонт"])
    elif name == "Жуковського":
        aliases.update(["Селище Жуковського", "Поселок Жуковского"])
    elif name == "селище ім. Герцена":
        aliases.update(["Селище Герцена", "Поселок Герцена"])
    elif name == "Артема":
        aliases.update(["Селище Артема", "Поселок Артема"])
    elif name == "Федірці":
        aliases.update(["Федорці"])
    elif name == "Филиппівка":
        aliases.update(["Пилипівка"])
    elif name == "Новожаново":
        aliases.update(["Новожанове"])
    elif name == "Сортировка":
        aliases.update(["Сортувальня"])
    return sorted(aliases)

# Also fetch Obriy Rieltor polygon for Горизонт
obriy_oid = "184"
obriy_poly = extract_rieltor_ring(geospaces[obriy_oid]["geoSpaces"].get("polygons", []))

massif_entries = []
poly_sources = {"osm": 0, "rieltor": 0, "custom_street": 0, "circle_poly": 0}

for it in orients:
    name = it["name"]
    if name.endswith("(M)") or name in POI_NAMES:
        continue
    oid = re.search(r"-o(\d+)/?$", it["path"]).group(1)
    gs = geospaces[oid]["geoSpaces"]

    # 1. Try OpenStreetMap polygon first
    ring, src = get_osm_poly(name)
    # 2. Try Rieltor.ua official polygon
    if not ring:
        r_ring = extract_rieltor_ring(gs.get("polygons", []))
        if r_ring:
            ring, src = r_ring, "rieltor"
    # 3. For Горизонт, use Обрій's exact polygon
    if not ring and name == "Горизонт" and obriy_poly:
        ring, src = obriy_poly, "rieltor"
    # 4. Try custom street-bounded polygon
    if not ring and name in CUSTOM_STREET_POLYGONS:
        ring, src = CUSTOM_STREET_POLYGONS[name], "custom_street"
    # 5. Otherwise build 24-gon from Rieltor circle
    if not ring:
        circ = gs.get("circles", [{}])[0]
        clat = float(circ.get("latitude", 50.0))
        clon = float(circ.get("longitude", 36.25))
        rad = float(circ.get("radius", 0.5))
        ring = make_circle_polygon(clat, clon, rad)
        src = "circle_poly"

    poly_sources[src] += 1
    clat, clon, area_km2 = polygon_centroid_and_area(ring)
    dists = detect_districts_for_polygon(name, ring, clat, clon)
    aliases = build_aliases(name)

    massif_entries.append({
        "name": name,
        "group": dists[0] if dists else "",
        "lat": clat,
        "lon": clon,
        "area_km2": area_km2,
        "districts": dists,
        "aliases": aliases,
        "polygon": ring,
    })

out_massifs_path = os.path.join(ROOT_DIR, "data", "massifs.json")
with open(out_massifs_path, "w", encoding="utf-8") as f:
    json.dump(massif_entries, f, ensure_ascii=False, indent=2)

print(f"Saved {len(massif_entries)} massifs to {out_massifs_path}")
print("Polygon sources breakdown:", poly_sources)

# Build data/landmarks.json:
# 1. All 75 concrete POIs from Rieltor.ua's /harkov/orients/ list (canonicalized cleanly)
# 2. Existing non-area concrete POIs from old_landmarks (strictly deduplicated)
RIELTOR_POI_RENAME = {
    "Автовокзал": "Автовокзал (пр. Аерокосмічний)",
    "Аерокосмічний університет": "ХАІ (Аерокосмічний університет)",
    "Барабашово": "ТЦ Барабашово",
    "парк ім. М. Горького": "Центральний парк (парк Горького)",
    "ТЦ \"Екватор\"": "ТРЦ Екватор",
    "ТРЦ \"Дафі\"": "ТРЦ Дафі",
    "Університет радіоелектроніки": "ХНУРЕ",
    "Цирк": "Харківський цирк",
    "парк Зелений гай": "Парк Зелений гай",
    "парк Зустріч": "Парк Зустріч",
    "парк Юність": "Парк Юність",
    "парк Машинобудівників": "Парк Машинобудівників",
    "парк Перемога": "Парк Перемога",
    "стадіон Металіст": "Стадіон Металіст",
    "карʼєр Дружба": "Кар'єр Дружба",
}

SKIP_LEGACY_DUPLICATES = {
    "Автовокзал",
    "Автовокзал (пр. Аерокосмічний)",
    "ХАІ",
    "ТЦ Барабашово",
    "Кам'яні ряди (Кам'янка)",
    "Центральний парк",
    "парк ім. М. Горького",
    "Міський сад імені Тараса Шевченка",
    "ТРЦ Нікольський",
    "ТРЦ Екватор",
    "ХНУРЕ",
    "Харківський цирк",
    "4-та невідкладна (Медкомплекс)",
    "ХНУ ім. Каразіна",
    "Юракадемія",
} | set(RIELTOR_POI_RENAME.keys())

new_landmarks = []
seen_lm_norm = set()

def norm_lm(s):
    return re.sub(r"[^а-яіїєґa-z0-9]+", "", s.lower())

for it in orients:
    raw_name = it["name"]
    if raw_name not in POI_NAMES:
        continue
    name = RIELTOR_POI_RENAME.get(raw_name, raw_name)
    n_norm = norm_lm(name)
    if n_norm in seen_lm_norm:
        continue
    seen_lm_norm.add(n_norm)

    oid = re.search(r"-o(\d+)/?$", it["path"]).group(1)
    gs = geospaces[oid]["geoSpaces"]
    ltype = POI_NAMES[raw_name]
    r_ring = extract_rieltor_ring(gs.get("polygons", []))
    if r_ring:
        clat, clon, _ = polygon_centroid_and_area(r_ring)
    else:
        circ = gs.get("circles", [{}])[0]
        clat = round(float(circ.get("latitude", 50.0)), 6)
        clon = round(float(circ.get("longitude", 36.25)), 6)
    new_landmarks.append({
        "name": name,
        "lat": clat,
        "lon": clon,
        "type": ltype,
    })

massif_names_norm = {norm_lm(m["name"]) for m in massif_entries}
for m in massif_entries:
    for a in m.get("aliases", []):
        massif_names_norm.add(norm_lm(a))

added_extra = 0
for lm in old_landmarks:
    if lm.get("type") == "area":
        continue
    lm_name = lm["name"]
    if lm_name in SKIP_LEGACY_DUPLICATES:
        continue
    n_norm = norm_lm(lm_name)
    if n_norm in massif_names_norm or n_norm in seen_lm_norm:
        continue
    lat, lon = float(lm["lat"]), float(lm["lon"])
    is_dup = False
    for ex in new_landmarks:
        ex_norm = norm_lm(ex["name"])
        d_m = math.hypot((ex["lon"] - lon) * 111320 * 0.64, (ex["lat"] - lat) * 111320)
        if ex_norm == n_norm or (d_m < 140 and (ex_norm in n_norm or n_norm in ex_norm)):
            is_dup = True
            break
    if not is_dup:
        seen_lm_norm.add(n_norm)
        new_landmarks.append({
            "name": lm_name,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "type": lm["type"],
        })
        added_extra += 1

out_landmarks_path = os.path.join(ROOT_DIR, "data", "landmarks.json")
with open(out_landmarks_path, "w", encoding="utf-8") as f:
    json.dump(new_landmarks, f, ensure_ascii=False, indent=2)

print(f"Saved {len(new_landmarks)} landmarks to {out_landmarks_path} (75 from Rieltor.ua + {added_extra} extra curated POIs, 0 area/synonym duplicates)")
