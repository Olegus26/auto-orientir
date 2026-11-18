#!/usr/bin/env python3
"""
Повна синхронізація, нормалізація та прив'язка бази житлових комплексів Харкова (data/complexes.json)
до «Єдиного адресного реєстру міста Харкова» (data/streets.json + data/houses.json).

Охоплює:
  1. Усі ЖК, КМ та таунхауси ЛУН по Харкову й передмістю (активні + продані/архівні з building_uk.xml та leftovers_uk.xml).
  2. Комплекси без комерційної назви («ЖК вул. Велозаводська, 37», «ЖК просп. Олександрівський, 69-Д» тощо).
  3. Енциклопедію новобудов Харкова БудОгляд (StroyObzor) та DIM.RIA.
  4. Курований реєстр вторинних новобудов 2000–2012 рр. (ЖК Олімп, ЖК Піонер, ЖК Ковчег, ЖК Парус, ЖК Гвардійський,
     ЖК Слобідська Садиба, ЖК Світлий Дім, ЖК Союз, ЖК Форпост, МЖК Інтернаціоналіст тощо).

Запуск:
    python scripts/sync_complexes.py --refresh                    # повне завантаження з мережі та перезбірка
    python scripts/sync_complexes.py --cache-dir <шлях_до_кешу>   # швидка перезбірка з локального кешу
"""
import argparse
import concurrent.futures
import html as html_lib
import json
import math
import os
import re
import time
import urllib.error
import urllib.request
from collections import defaultdict

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "uk-UA,uk;q=0.9,ru;q=0.8,en;q=0.7",
}

LUN_SUBPAGE_SUFFIXES = [
    "-construction", "-projects", "-contacts", "-showroom", "-drone-flight",
    "-documents", "-promotions", "-infrastructure", "-developer", "-reviews",
    "-video", "-news", "-aero", "-3d", "-forum", "-terms", "-apartments",
    "-cottages", "-townhouses", "-commercial", "-parking",
]

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

LUN_DISTRICT_MAP = {
    "індустріальний": "Індустріальний р-н",
    "орджонікідзевський": "Індустріальний р-н",
    "київський": "Київський р-н",
    "немишлянський": "Немишлянський р-н",
    "фрунзенський": "Немишлянський р-н",
    "новобаварський": "Новобаварський р-н",
    "жовтневий": "Новобаварський р-н",
    "основ'янський": "Основ'янський р-н",
    "червонозаводський": "Основ'янський р-н",
    "салтівський": "Салтівський р-н",
    "московський": "Салтівський р-н",
    "слобідський": "Слобідський р-н",
    "комінтернівський": "Слобідський р-н",
    "холодногірський": "Холодногірський р-н",
    "ленінський": "Холодногірський р-н",
    "шевченківський": "Шевченківський р-н",
    "дзержинський": "Шевченківський р-н",
}

CLASS_NORM = {
    "економ": "Економ",
    "эконом": "Економ",
    "комфорт": "Комфорт",
    "бізнес": "Бізнес",
    "бизнес": "Бізнес",
    "преміум": "Преміум",
    "премиум": "Преміум",
    "еліт": "Преміум",
    "элит": "Преміум",
}

LAT_TO_CYR_IN_UK = str.maketrans({"i": "і", "I": "І"})

STREET_PREFIX_RE = re.compile(
    r"^(?:вулиця|вул\.?|улица|ул\.?|проспект|просп\.?|пр-т|пр\.?|провулок|пров\.?|переулок|пер\.?|бульвар|б-р|бул\.?|шосе|шоссе|набережна|набережная|наб\.?|майдан|площа|площадь|пл\.?|узвіз|спуск|в'їзд|в’їзд|въезд|в-д|проїзд|проезд|пр-д|тупик|туп\.?)\b",
    re.I,
)

# Bare street-only frozen land-plot placeholders on LUN that duplicate real named complexes on those streets
SKIP_LUN_SLUGS = {
    "balakirieva-st",
    "myru-st",
    "peremohy-ave",
    "petra-hryhorenka-ave-2b",
    "shatilovka-hillside-townhouse",  # duplicate of shatilovka-hillside
    "renesans-park",                  # duplicate of renesans-park-cottages
}

FALLBACK_CLASS_BY_NAME = {
    "ЖК Авантаж": "Преміум",
    "ЖК Фаворит": "Преміум",
    "ЖК Ультра": "Преміум",
    "ЖК Монте-Плаза": "Преміум",
    "ЖК Олімп": "Преміум",
    "ЖК Піонер": "Преміум",
    "ЖК Схід-Захід": "Преміум",
    "ЖК Будинок на Набережній": "Преміум",
    "ЖК Фелічіта": "Преміум",
    "ЖК Дім у Сокільниках": "Преміум",
    "ЖК Садиба Чернишевського": "Преміум",
    "ЖК Театральний": "Преміум",
    "ЖК Резиденція": "Преміум",
    "ЖК Квітка": "Преміум",
    "ЖК Інфініті": "Преміум",
    "ЖК Дипломат Клаб": "Преміум",
    "ЖК Слобідська Садиба": "Преміум",
    "ЖК Тріумф": "Бізнес",
    "ЖК Світлий Дім": "Бізнес",
    "ЖК Ковчег": "Бізнес",
    "ЖК Парус": "Бізнес",
    "ЖК Гвардійський": "Бізнес",
    "ЖК Союз": "Бізнес",
    "ЖК Адмірал": "Бізнес",
    "ЖК Садова Гірка": "Бізнес",
    "ЖК Моноліт на Чернишевській": "Бізнес",
    "ЖК Джокер": "Бізнес",
    "ЖК Гранд": "Бізнес",
    "ЖК Мир": "Бізнес",
    "ЖК Оптима": "Бізнес",
    "ЖК Дует": "Бізнес",
    "ЖК Павловський квартал": "Бізнес",
    "ЖК Будинок із Ротондами": "Бізнес",
    "ЖК Флагман": "Бізнес",
    "ЖК Домініон": "Бізнес",
    "ЖК Аксіома": "Бізнес",
    "ЖК Лайнер": "Бізнес",
    "ЖК Карат": "Бізнес",
    "ЖК Каскад": "Бізнес",
    "ЖК Подільський": "Бізнес",
    "ЖК Квант": "Бізнес",
    "ЖК Науковий": "Бізнес",
}

# Exact house overrides ONLY where registry uses a different street ID or corpus format than LUN's text
SLUG_EXACT_HOUSES = {
    "cheremushky": [(3547, "65-Г, корп. 1")],
    "cheremushky-2": [(3547, "65-Г, корп. 2")],
    "molodizhnyi": [(200040, "48")],
    "molodizhnyi-2": [(200040, "48-В")],
    "budynok-na-sumskii": [(4058, "77/1")],
    "monte-plaza": [(3107, "45/1"), (3107, "45/2"), (3107, "45/3")],
    "kaskad": [(3060, "20")],
    "luxemburg": [(2564, "3")],
    "iskrynskyi": [(2791, "19-В"), (2791, "19-Б"), (2791, "19-Г"), (2791, "19-Ж")],
    "valentynivska-st-haribaldi-st": [(2206, "55")],
    "klemenova-dacha": [(4895, "11"), (4895, "12"), (4895, "14"), (4896, "15")],
    "concept-house-futurium": [(4349, "81"), (4349, "83")],
    "bonaparte": [(3152, "4-Б")],
    "kontorskyi": [(4327, "15")],
    "kontorskyi-2": [(4327, "10")],
}

# Extra registry bindings ONLY for houses listed in LUN's mailing_addresses that failed automatic regex due to street rename/typo on LUN
SLUG_EXTRA_HOUSES = {
    "kazka": [(3651, "184-А, корп. 10"), (3651, "184-А, корп. 21")],
    "mriia": [(200438, "5")],
    "myru-2": [(200006, "268-Г"), (200006, "268-Д")],
    "seminarskyi": [(2937, "63")],
}

RIELTOR_ALPHABET_PATHS = [
    "/novostroyki/a-z/",
    "/novostroyki/%D0%90/",
    "/novostroyki/%D0%91/",
    "/novostroyki/%D0%B2/",
    "/novostroyki/%D0%93/",
    "/novostroyki/%D0%94/",
    "/novostroyki/%D0%95/",
    "/novostroyki/%D0%96/",
    "/novostroyki/%D0%97/",
    "/novostroyki/%D0%86/",
    "/novostroyki/%D0%9A/",
    "/novostroyki/%D0%9B/",
    "/novostroyki/%D0%9C/",
    "/novostroyki/%D0%9D/",
    "/novostroyki/%D0%9E/",
    "/novostroyki/%D0%9F/",
    "/novostroyki/%D0%A0/",
    "/novostroyki/%D0%A1/",
    "/novostroyki/%D0%A2/",
    "/novostroyki/%D0%A3/",
    "/novostroyki/%D0%A4/",
    "/novostroyki/%D0%A7/",
    "/novostroyki/%D0%AE/",
    "/novostroyki/%D0%AF/",
]

# Explicit Rieltor ID -> LUN slug mapping for disambiguation
RIELTOR_ID_TO_LUN_SLUG = {
    15416: "raiduzhnyi",        # ЖК Райдужний (вул. Зубарєва, 34)
    18075: "raiduzhnyi-zhb1",   # ЖК Райдужний (просп. Льва Ландау, 52)
    14279: "yuvileinyi",        # ЖК Ювілейний (просп. Ювілейний, 67-Б)
}

# The 16 Rieltor.ua complexes (n21xxx) that are 2000s secondary-market buildings without a dedicated LUN /new/ page
RIELTOR_CLASSIC_BY_ID = {
    21183: {
        "jk_name": "ЖК Атолл",
        "class": "Бізнес",
        "developer": "Житлобуд-2",
        "houses": [(2886, "52")],
        "aliases": ["ЖК Атол", "Клапцова 52", "Петра Болбочана 52"],
    },
    21193: {
        "jk_name": "ЖК Адмірал",
        "class": "Бізнес",
        "developer": "Констракшн Груп",
        "houses": [(2893, "258")],
        "aliases": ["ЖК Адмирал", "Клочковская 258"],
    },
    21203: {
        "jk_name": "ЖК Атлант",
        "class": "Бізнес",
        "developer": "МКДУ",
        "houses": [(2937, "57")],
        "aliases": ["Комсомольське шосе 57", "Григорівське шосе 57"],
    },
    21209: {
        "jk_name": "ЖК Будинок на Петровського",
        "class": "Бізнес",
        "developer": "Житлобуд-2",
        "houses": [(3577, "35-А")],
        "aliases": ["ЖК Дом на Петровского", "Ярослава Мудрого 35а", "Петровского 35а"],
    },
    21207: {
        "jk_name": "ЖК Гвардійський",
        "class": "Бізнес",
        "developer": "Житлобуд-2",
        "houses": [(2418, "33")],
        "aliases": ["ЖК Гвардейский", "Гвардейцев Широнинцев 33"],
    },
    21162: {
        "jk_name": "ЖК Джерело",
        "class": "Бізнес",
        "developer": "Консоль",
        "houses": [(200056, "49")],
        "aliases": ["Мінська 49", "Дмитра Антоненка 49", "ЖК Родник"],
    },
    21233: {
        "jk_name": "ЖК Дружба",
        "class": "Комфорт",
        "developer": "ТММ",
        "houses": [(200627, "228-А"), (200627, "228-Б")],
        "aliases": ["Дружбы Народов 228а", "Дружбы Народов 238а", "Соборності України 228-А"],
    },
    21212: {
        "jk_name": "ЖК Зелена шапочка",
        "class": "Комфорт",
        "developer": "Житлобуд-2",
        "houses": [(2045, "144")],
        "aliases": ["ЖК Зеленая шапочка", "Академика Павлова 144"],
    },
    21190: {
        "jk_name": "ЖК Олімп",
        "class": "Преміум",
        "developer": "Авантаж",
        "houses": [(3070, "20-В")],
        "aliases": ["ЖК Олимп", "Культуры 20в", "Авантаж на Культури 20в"],
    },
    21200: {
        "jk_name": "ЖК Острів",
        "class": "Преміум",
        "developer": "МКДУ",
        "houses": [(3786, "25")],
        "aliases": ["ЖК Остров", "Римарська 25", "Рымарская 25"],
    },
    21185: {
        "jk_name": "ЖК Павлово Поле",
        "class": "Бізнес",
        "developer": "МКДУ",
        "houses": [(3107, "77")],
        "aliases": ["ЖК Павлове Поле", "просп. Науки 77", "Ленина 77"],
    },
    21188: {
        "jk_name": "ЖК Парус",
        "class": "Бізнес",
        "developer": "Моноліт",
        "houses": [(2147, "36-А")],
        "aliases": ["Парус на Песках", "Барабашова 36а", "ЖК Парус на Салтівці"],
    },
    21202: {
        "jk_name": "ЖК Піонер",
        "class": "Преміум",
        "developer": "Авантаж",
        "houses": [(4158, "9")],
        "aliases": ["ЖК Пионер", "Тринклера 9", "Будинок на Трінклера 9"],
    },
    21163: {
        "jk_name": "ЖК Садова гірка",
        "class": "Бізнес",
        "developer": "Авантаж",
        "houses": [(2505, "40"), (2505, "42")],
        "aliases": ["ЖК Садова Гірка", "ЖК Садовая Горка", "Данилевского 40", "Данилевского 42"],
    },
    21197: {
        "jk_name": "ЖК Слобідська садиба",
        "class": "Преміум",
        "developer": "Моноліт",
        "houses": [(2505, "26")],
        "aliases": ["ЖК Слобідська Садиба", "ЖК Слободская Усадьба", "Данилевского 26"],
    },
    21201: {
        "jk_name": "ЖК Світлий дім",
        "class": "Бізнес",
        "developer": "МКДУ",
        "houses": [(2522, "33-Г")],
        "aliases": ["ЖК Світлий Дім", "ЖК Светлый Дом", "23 Августа 33г", "23 Серпня 33г"],
    },
}

SLUG_EXTRA_ALIASES = {
    "biblyka-st-4": ["ЖК Олівія", "ЖК Оливия", "Другої П'ятирічки 4", "Второй Пятилетки 4"],
    "valentynivska-st-haribaldi-st": ["ЖК вул. Валентинівська, 55", "ЖК по вул. Валентинівській"],
    "velozavodska-st": ["ЖК вул. Велозаводська, 37", "ЖК по ул. Велозаводская", "Велозаводская 37"],
    "vremena-hoda": ["ЖК Пори року", "ЖК Дача 55", "Дача 55"],
    "oleksandrivskyi-ave-69e": ["ЖК просп. Олександрівський, 69-Д", "Косиора 69д", "Косиора 69е"],
}


def http_get(url: str, timeout: int = 20):
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.geturl(), r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return e.code, url, ""
            if attempt == 0:
                time.sleep(0.5)
        except Exception:
            if attempt == 0:
                time.sleep(0.5)
    return 0, url, ""


def extract_balanced_json(text: str, start_idx: int) -> str:
    if start_idx < 0 or start_idx >= len(text) or text[start_idx] != "{":
        return ""
    depth, in_str, esc = 0, False, False
    for i in range(start_idx, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start_idx : i + 1]
    return ""


def parse_lun_page(url: str):
    status, final_url, html = http_get(url)
    if status != 200 or not html or "/new/" not in final_url or final_url.rstrip("/").endswith("/новобудови-харкова"):
        return None
    rec = {
        "source": "lun", "requested_url": url, "url": final_url, "slug": final_url.rstrip("/").split("/")[-1],
        "sku": None, "name": "", "locality": "", "street_address": "", "district_raw": "", "class_raw": "",
        "developer": "", "lat": None, "lon": None, "synonyms": "", "project_synonym": "",
        "is_cottage": False, "mailing_addresses": [],
    }
    for block in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        try:
            data = json.loads(block)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        t = data.get("@type")
        types = t if isinstance(t, list) else [t]
        if "BreadcrumbList" in types:
            for el in data.get("itemListElement", []):
                nm = (el.get("item") or {}).get("name", "")
                if "район" in nm.lower():
                    rec["district_raw"] = nm
        if "ApartmentComplex" in types or "Product" in types:
            rec["name"] = data.get("name", "") or rec["name"]
            rec["sku"] = data.get("sku") or rec["sku"]
            rec["url"] = data.get("url") or rec["url"]
            addr = data.get("address") or {}
            if isinstance(addr, dict):
                rec["locality"] = addr.get("addressLocality", "")
                rec["street_address"] = addr.get("streetAddress", "")
            geo = data.get("geo") or {}
            if isinstance(geo, dict):
                try:
                    rec["lat"], rec["lon"] = float(geo["latitude"]), float(geo["longitude"])
                except Exception:
                    pass
            for prop in data.get("additionalProperty") or []:
                if isinstance(prop, dict) and prop.get("name") == "Клас":
                    rec["class_raw"] = str(prop.get("value") or "").strip()
            offers = data.get("offers") or {}
            if isinstance(offers, dict):
                sellers = offers.get("seller") or []
                if isinstance(sellers, list) and sellers:
                    rec["developer"] = ", ".join(s.get("name", "").strip() for s in sellers if isinstance(s, dict) and s.get("name"))

    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.S)
    joined = ""
    for c in chunks:
        try:
            joined += json.loads('"' + c + '"')
        except Exception:
            pass
    if joined:
        bi_m = re.search(r'"baseInfo"\s*:\s*\{', joined)
        if bi_m:
            bi_str = extract_balanced_json(joined, bi_m.end() - 1)
            if bi_str:
                try:
                    bi = json.loads(bi_str)
                    rec["sku"] = rec["sku"] or bi.get("projectId")
                    rec["name"] = rec["name"] or bi.get("name", "")
                    rec["street_address"] = rec["street_address"] or bi.get("address", "")
                    rec["synonyms"] = bi.get("synonyms") or ""
                    rec["is_cottage"] = bool(bi.get("isCottage"))
                except Exception:
                    pass
        ps_m = re.search(r'"projectSynonym"\s*:\s*"([^"]*)"', joined)
        if ps_m:
            rec["project_synonym"] = ps_m.group(1).strip()
        seen_addrs = []
        for hm in re.finditer(r'"houseMailingAddress"\s*:\s*"([^"]*)"', joined):
            ma = hm.group(1).strip()
            if ma and ma not in seen_addrs:
                seen_addrs.append(ma)
        rec["mailing_addresses"] = seen_addrs
    return rec


def parse_stroyobzor_page(ru_url: str):
    ua_url = ru_url.replace("/ru/kharkov/estate/", "/ua/kharkov/estate/")
    status, final_url, html = http_get(ua_url)
    if status != 200 or not html:
        status, final_url, html = http_get(ru_url)
    if status != 200 or not html:
        return None
    rec = {"source": "stroyobzor", "url": final_url, "name": "", "address": "", "class_raw": "", "developer": "", "lat": None, "lon": None}
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
    if h1:
        rec["name"] = html_lib.unescape(re.sub(r"<[^>]+>", "", h1.group(1))).strip()
    clean_txt = html_lib.unescape(re.sub(r"<[^>]+>", "\n", html))
    lines = [ln.strip() for ln in clean_txt.splitlines() if ln.strip()]
    for i, ln in enumerate(lines[:260]):
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if ln in ("Адреса", "Адрес") and not rec["address"]:
            rec["address"] = nxt
        elif ln in ("Забудовник", "Застройщик") and not rec["developer"]:
            rec["developer"] = nxt
        elif ln in ("Клас", "Класс") and not rec["class_raw"]:
            rec["class_raw"] = nxt
    return rec


def parse_domria_page(url: str):
    status, final_url, html = http_get(url)
    if status != 200 or not html:
        return None
    rec = {"source": "domria", "url": final_url, "name": "", "address": "", "developer": "", "class_raw": "", "lat": None, "lon": None}
    for block in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(block)
        except Exception:
            continue
        if isinstance(d, dict) and d.get("@type") == "Product":
            rec["name"] = d.get("name", "").strip()
            am = re.search(r"【\s*(.*?)\s*】", d.get("description", ""))
            if am:
                rec["address"] = am.group(1).strip()
    gm = re.search(r'"latitude"\s*:\s*"?(49\.\d+|50\.\d+)"?\s*,\s*"longitude"\s*:\s*"?(36\.\d+)"?', html)
    if gm:
        rec["lat"], rec["lon"] = float(gm.group(1)), float(gm.group(2))
    return rec


def download_all_sources():
    print("Завантаження карт сайту ЛУН (building_uk.xml + leftovers_uk.xml)...")
    _, _, b_xml = http_get("https://lun.ua/sitemaps/building_uk.xml")
    lun_urls = set(re.findall(r"<loc>(https://lun\.ua/new/kharkiv/[^<]+)</loc>", b_xml))
    _, _, l_xml = http_get("https://lun.ua/sitemaps/leftovers_uk.xml")
    for u in re.findall(r"<loc>(https://lun\.ua/new/kharkiv/[^<]+)</loc>", l_xml):
        slug = u.rstrip("/").split("/")[-1]
        for suf in LUN_SUBPAGE_SUFFIXES:
            if slug.endswith(suf):
                slug = slug[: -len(suf)]
                break
        lun_urls.add(f"https://lun.ua/new/kharkiv/{slug}")

    print(f"Опитування {len(lun_urls)} сторінок ЖК на ЛУН...")
    lun_dedup = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for res in ex.map(parse_lun_page, sorted(lun_urls)):
            if res:
                k = str(res.get("sku") or res["url"])
                lun_dedup.setdefault(k, res)

    print("Опитування каталогу новобудов Харкова БудОгляд (StroyObzor)...")
    _, _, so_xml = http_get("https://stroyobzor.ua/sitemap.xml")
    so_urls = sorted(set(re.findall(r"<loc>(https://stroyobzor\.ua/[^<]*/kharkov/estate/[^<]+)</loc>", so_xml)))
    so_res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for r in ex.map(parse_stroyobzor_page, so_urls):
            if r and r.get("name"):
                so_res.append(r)

    print("Опитування каталогу новобудов Харкова DIM.RIA...")
    _, _, dr_xml = http_get("https://dom.ria.com/sitemapNewbuild/newbuildPage-KHARKIV.xml")
    dr_urls = sorted(set(re.findall(r"<loc>(https://dom\.ria\.com/uk/[^<]+)</loc>", dr_xml)))
    dr_res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for r in ex.map(parse_domria_page, dr_urls):
            if r and r.get("name"):
                dr_res.append(r)

    return list(lun_dedup.values()), so_res, dr_res


def fix_mixed_cyrillic(name: str) -> str:
    def repl_word(m):
        w = m.group(0)
        if re.search(r"[а-яіїєґА-ЯІЇЄҐ]", w) and re.search(r"[iI]", w):
            return w.translate(LAT_TO_CYR_IN_UK)
        return w

    return re.sub(r"\S+", repl_word, (name or "")).strip()


def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def point_in_ring(lon, lat, ring):
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


def detect_district_by_coords(lat, lon, districts_geo):
    if lat is None or lon is None:
        return ""
    for dname, geom in districts_geo.items():
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for poly in polys:
            if poly and point_in_ring(lon, lat, poly[0]):
                return dname
    return "Передмістя"


def norm_phonetic_py(s: str) -> str:
    if not s:
        return ""
    t = fix_mixed_cyrillic(s).lower()
    t = t.replace("i", "і").replace("ї", "і").replace("є", "е").replace("ё", "е").replace("ы", "и").replace("э", "е").replace("ґ", "г")
    t = re.sub(r"['’ʼ`\"«»„“]", "", t)
    repls = [
        ("героев труда", "героів праці"),
        ("героев харькова", "героів харкова"),
        ("героев сталинграда", "героів сталінграда"),
        ("дружбы народов", "дружби народів"),
        ("любови малой", "любові малоі"),
        ("л. малоі", "любові малоі"),
        ("л малоі", "любові малоі"),
        ("второй пятилетки", "другоі пятирічки"),
        ("тракторостроителей", "тракторобудівників"),
        ("гвардейцев широнинцев", "гвардійців широнінців"),
        ("гв широнинцев", "гвардійців широнінців"),
        ("гв. широнинцев", "гвардійців широнінців"),
        ("победы", "перемоги"),
        ("целиноградская", "цілиноградська"),
        ("целиноградська", "цілиноградська"),
        ("сокольницкая", "сокільницька"),
        ("сокольницька", "сокільницька"),
        ("дергачевская", "деркачівська"),
        ("дергачівська", "деркачівська"),
        ("клочковська", "клочківська"),
        ("клочковская", "клочківська"),
        ("абрамівська", "аврамівська"),
        ("верхньогіевська", "верхня гиівська"),
        ("верхня гіівська", "верхня гиівська"),
        ("малиновська", "малинівська"),
        ("петропавліська", "петропавлівська"),
        ("куряжська", "курязька"),
        ("кузнецька", "кузнечна"),
        ("плехановская", "плеханівська"),
        ("елизаветинская", "лисаветинська"),
        ("елизаветинська", "лисаветинська"),
        ("єлизаветинська", "лисаветинська"),
        ("нетеченська", "нетіченська"),
        ("нетеченская", "нетіченська"),
        ("димитрова", "дмитрівська"),
        ("гагарина", "гагаріна"),
        ("холодногорська", "холодногірська"),
        ("холодногорская", "холодногірська"),
        ("балакірева", "балакірева"),
        ("григоренко", "григоренка"),
        ("москаленко", "москаленка"),
        ("плоходько", "плоходька"),
        ("чернишевського", "чернишевська"),
        ("чернышевская", "чернишевська"),
        ("родниковая", "родникова"),
        ("роднікова", "родникова"),
        ("гипиків братів", "братів гипиків"),
        ("чигирина", "чигирина юлія"),
        ("чигирина юлія юлія", "чигирина юлія"),
        ("новый дом", "новий дім"),
        ("радужн", "райдужн"),
        ("форест", "forest"),
    ]
    for a, b in repls:
        t = t.replace(a, b)
    t = t.replace("і", "и")
    t = re.sub(r"([бвгджзклмнпрстфхцчшщ])\1+", r"\1", t)
    t = re.sub(r"[^a-zа-я0-9]+", " ", t).strip()
    return t


def detect_street_type_token(s: str) -> str:
    sl = s.lower()
    if re.search(r"\b(провулок|пров\.?|переулок|пер\.?)\b", sl):
        return "пров."
    if re.search(r"\b(проспект|просп\.?|пр-т|пр\.?)\b", sl):
        return "просп."
    if re.search(r"\b(вулиця|вул\.?|улица|ул\.?)\b", sl):
        return "вул."
    if re.search(r"\b(шосе|шоссе)\b", sl):
        return "шосе"
    if re.search(r"\b(набережна|набережная|наб\.?)\b", sl):
        return "наб."
    if re.search(r"\b(проїзд|проезд|пр-д)\b", sl):
        return "пр-д"
    if re.search(r"\b(в'їзд|в’їзд|въезд|в-д)\b", sl):
        return "в-д"
    if re.search(r"\b(бульвар|б-р|бул\.?)\b", sl):
        return "б-р"
    if re.search(r"\b(майдан|площа|площадь|пл\.?)\b", sl):
        return "м-н"
    return ""


def norm_house_key_py(h: str) -> str:
    if not h:
        return ""
    s = fix_mixed_cyrillic(h).strip().lower()
    s = re.sub(r"^(?:буд\.?|будинок|дом|д\.?)\s*№?\s*", "", s)
    s = re.sub(r"[,;\s]*(?:корп(?:ус|\.)?|к\.?)\s*№?\s*([0-9а-яіїєґa-z]+)", r"к\1", s)
    s = re.sub(r"[,;\s]*секц(?:ія|ия|\.)?\s*№?\s*([0-9а-яіїєґa-z]+)", r"с\1", s)
    s = re.sub(r"[\s,\-]+", "", s)
    return s


class AddressBinder:
    def __init__(self, streets_list, houses_db):
        self.streets_list = streets_list
        self.houses_db = houses_db
        self.streets_by_id = {s["street_id"]: s for s in streets_list}
        self.street_index = defaultdict(list)
        for s in streets_list:
            all_names = [s["current_name"]] + s.get("old_names", []) + s.get("aliases", [])
            for nm in all_names:
                for variant in [nm, nm.replace("№", " ")]:
                    nk = norm_phonetic_py(variant)
                    if nk and s not in self.street_index[nk]:
                        self.street_index[nk].append(s)
                    words = nk.split()
                    if len(words) == 2:
                        rev = f"{words[1]} {words[0]}"
                        if s not in self.street_index[rev]:
                            self.street_index[rev].append(s)

        self.street_norm_houses = {}
        self.street_prefix_sections = defaultdict(lambda: defaultdict(list))
        for sid_str, hmap in houses_db.items():
            sid = int(sid_str)
            nmap = {}
            for label in sorted(hmap.keys()):
                nk = norm_house_key_py(label)
                if nk not in nmap:
                    nmap[nk] = label
                bm = re.match(r"^(\d+[а-яіїєґa-z]?)(?:к|с)\d+$", nk)
                if bm:
                    self.street_prefix_sections[sid][bm.group(1)].append(label)
            self.street_norm_houses[sid] = nmap

    def street_center(self, st_obj):
        sid_str = str(st_obj["street_id"])
        hmap = self.houses_db.get(sid_str)
        if hmap:
            vals = list(hmap.values())
            return sum(v[0] for v in vals) / len(vals), sum(v[1] for v in vals) / len(vals)
        b = st_obj.get("map_bounds") or {}
        if b.get("top_lat") and b.get("bottom_lat"):
            return (b["top_lat"] + b["bottom_lat"]) / 2, (b["top_lon"] + b["bottom_lon"]) / 2
        return None, None

    def resolve_street_candidates(self, raw_street_part: str, ref_lat=None, ref_lon=None):
        if not raw_street_part:
            return []
        want_type = detect_street_type_token(raw_street_part)
        paren_parts = re.findall(r"\(([^)]+)\)", raw_street_part)
        outer = re.sub(r"\([^)]*\)", " ", raw_street_part)

        matched_streets = []
        for cr in [outer] + paren_parts:
            cleaned = re.sub(
                r"\b(?:вулиця|вул\.?|улица|ул\.?|проспект|просп\.?|пр-т|пр\.?|провулок|пров\.?|переулок|пер\.?|бульвар|б-р|бул\.?|шосе|шоссе|набережна|набережная|наб\.?|майдан|площа|площадь|пл\.?|узвіз|спуск|в'їзд|в’їзд|въезд|в-д|проїзд|проезд|пр-д|тупик|туп\.?|місто|м\.|харків|харьков)\b",
                " ",
                cr,
                flags=re.I,
            )
            nk = norm_phonetic_py(cleaned)
            if not nk:
                continue
            for s in self.street_index.get(nk, []):
                if s not in matched_streets:
                    matched_streets.append(s)

        def score_st(s):
            sc = 0.0
            if want_type and s.get("short_type") == want_type:
                sc += 45.0
            elif want_type and s.get("short_type") and s.get("short_type") != want_type:
                sc -= 20.0
            hcnt = len(self.houses_db.get(str(s["street_id"]), {}))
            if hcnt > 0:
                sc += min(hcnt, 200) * 0.05
            if ref_lat is not None and ref_lon is not None:
                clat, clon = self.street_center(s)
                if clat is not None:
                    sc -= haversine_m(ref_lat, ref_lon, clat, clon) / 140.0
            return sc

        matched_streets.sort(key=score_st, reverse=True)
        return matched_streets

    def bind_addresses(self, addr_strings, ref_lat=None, ref_lon=None, locality="Харків"):
        if locality and locality not in ("Харків", ""):
            return []
        bound = []
        seen = set()

        for raw in addr_strings:
            if not raw:
                continue
            raw_fixed = re.sub(r"\b(вул|просп|пров|ул|пр|пер)\s*,\s*", r"\1. ", raw, flags=re.I)
            raw_fixed = re.sub(r"Дача\s*,?\s*№?\s*55", "Дача 55", raw_fixed, flags=re.I)

            for chunk in raw_fixed.split(";"):
                chunk = chunk.strip()
                if not chunk:
                    continue
                if "/" in chunk and not re.search(r",\s*\d+", chunk):
                    continue

                if "," not in chunk:
                    m_nc = re.match(r"^(.*?\D)\s+(\d+[0-9а-яіїєґa-z/\-\s]*)$", chunk, re.I)
                    if m_nc and not m_nc.group(1).strip().lower().endswith("дача"):
                        st_part, h_part = m_nc.group(1).strip(), m_nc.group(2).strip()
                    else:
                        continue
                else:
                    st_part, h_part = chunk.split(",", 1)
                    st_part, h_part = st_part.strip(), h_part.strip()

                if re.search(r"\b(вул\.|просп\.|пров\.|ул\.|пр\.)\b", h_part, re.I):
                    sub_parts = re.split(r",\s*(?=(?:вул\.|просп\.|пров\.|ул\.|пр\.))", chunk, flags=re.I)
                    if len(sub_parts) > 1:
                        for sp in sub_parts:
                            for pair in self.bind_addresses([sp], ref_lat, ref_lon, locality):
                                if tuple(pair) not in seen:
                                    bound.append(pair)
                                    seen.add(tuple(pair))
                        continue

                st_candidates = self.resolve_street_candidates(st_part, ref_lat, ref_lon)
                if not st_candidates:
                    continue

                if re.search(r"\b(корп|секц)", h_part, re.I):
                    h_tokens = [h_part]
                else:
                    h_tokens = [t.strip() for t in h_part.split(",") if t.strip()]

                for ht in h_tokens:
                    nk = norm_house_key_py(ht)
                    if not nk or not re.match(r"^\d", nk):
                        continue

                    for st_obj in st_candidates:
                        sid = st_obj["street_id"]
                        nmap = self.street_norm_houses.get(sid, {})
                        hmap = self.houses_db.get(str(sid), {})
                        if not nmap:
                            continue

                        matched_labels = []
                        if nk in nmap:
                            matched_labels = [nmap[nk]]
                        elif nk in self.street_prefix_sections.get(sid, {}):
                            matched_labels = list(self.street_prefix_sections[sid][nk])
                        elif "/" in ht:
                            alt_k = norm_house_key_py(ht.replace("/", " корп. "))
                            if alt_k in nmap:
                                matched_labels = [nmap[alt_k]]
                            else:
                                base_k = norm_house_key_py(ht.split("/")[0])
                                if base_k in nmap and ref_lat is not None:
                                    cand = nmap[base_k]
                                    if haversine_m(ref_lat, ref_lon, hmap[cand][0], hmap[cand][1]) <= 220:
                                        matched_labels = [cand]

                        valid_here = []
                        for ml in matched_labels:
                            hc = hmap[ml]
                            if ref_lat is not None and ref_lon is not None:
                                if haversine_m(ref_lat, ref_lon, hc[0], hc[1]) > 850:
                                    continue
                            valid_here.append(ml)

                        if valid_here:
                            for ml in valid_here:
                                if (sid, ml) not in seen:
                                    bound.append([sid, ml])
                                    seen.add((sid, ml))
                            break

        return bound


def format_canonical_jk_name(raw_name: str, bound_houses: list, streets_by_id: dict, locality: str) -> tuple[str, list[str]]:
    extra_aliases = []
    nm = fix_mixed_cyrillic(raw_name)
    nm = re.sub(r"\s+", " ", nm).strip()

    if re.match(r"^(?:ЖБ|ЖД|ЖБК)\s+", nm, re.I):
        extra_aliases.append(nm)
        nm = re.sub(r"^(?:ЖБ|ЖД|ЖБК)\s+", "ЖК ", nm, flags=re.I)

    if re.match(r"^КП\s+", nm, re.I):
        extra_aliases.append(nm)
        nm = re.sub(r"^КП\s+", "КМ ", nm, flags=re.I)

    title_fixes = {
        "ЖК Журавли": "ЖК Журавлі",
        "ЖК Защитник": "ЖК Захисник",
        "ЖК Благовест": "ЖК Благовіст",
        "ЖК Сирень": "ЖК Бузок",
        "ЖК Времена года": "ЖК Пори року",
        "ЖК Ізумрудне місто": "ЖК Смарагдове місто",
        "ЖК Мироносицка": "ЖК Мироносицька",
        "ЖК ТИТУЛ Будинок на Пушкінській": "ЖК Титул Будинок на Пушкінській",
        "ЖК the first capital residence": "ЖК The First Capital Residence",
        "ЖК Л. Малої": "ЖК Постишева (просп. Любові Малої)",
        "ЖК Новий дім Котлова": "ЖК Новий Дім на Котлова",
        "ЖК Воробйові гори на полях-3": "ЖК Воробйові гори на Полях-3",
        "ЖК Куликовський": "ЖК Куликівський",
        "ЖК Безлюдовский": "ЖК Безлюдівський",
        "Urban One Klochkivska": "ЖК Urban One Klochkivska",
        "Urban One Sumskaya": "ЖК Urban One Sumskaya",
    }
    if nm in title_fixes:
        extra_aliases.append(nm)
        nm = title_fixes[nm]

    if STREET_PREFIX_RE.match(nm):
        extra_aliases.append(nm)
        if bound_houses:
            first_sid, first_hl = bound_houses[0]
            st = streets_by_id.get(first_sid)
            if st:
                same_street_houses = [hl for sid, hl in bound_houses if sid == first_sid]
                if len(same_street_houses) == 1 or "," not in nm:
                    clean_addr_title = f"ЖК {st['short_type']} {st['current_name']}, {first_hl}"
                else:
                    clean_addr_title = f"ЖК {nm}"
                extra_aliases.append(f"ЖК по {st['short_type']} {st['current_name']}")
                for old_n in st.get("old_names", []):
                    extra_aliases.append(f"ЖК {old_n}")
                nm = clean_addr_title
            else:
                nm = f"ЖК {nm}"
        else:
            prefix = f"{locality}, " if locality and locality != "Харків" and locality.lower() not in nm.lower() else ""
            nm = f"ЖК {prefix}{nm}"

    return nm, extra_aliases


def norm_dedup_key(name: str) -> str:
    s = norm_phonetic_py(name)
    s = re.sub(r"\b(жк|км|мжк|кжк|клубний будинок|кб|мфк|таунхауси|таунхаус|будинок|дім|дом)\b", " ", s)
    s = re.sub(r"\s+", "", s)
    return s


def download_rieltor_jks():
    all_items = []
    seen_hrefs = set()
    for path in RIELTOR_ALPHABET_PATHS:
        url = "https://rieltor.ua/harkov" + path
        status, _, html = http_get(url)
        if status == 404 and "%D0%92" in url:
            status, _, html = http_get(url.replace("%D0%92", "%D0%B2"))
        if status != 200 or not html:
            continue
        items = re.findall(
            r'<div class="entity-hub_list-entity-hub-item">\s*<a href="([^"]+)">([^<]+)</a>',
            html,
        )
        for href, name in items:
            name_clean = name.strip()
            href_clean = href.strip()
            if href_clean not in seen_hrefs:
                seen_hrefs.add(href_clean)
                m_id = re.search(r"-n(\d+)/?$", href_clean)
                all_items.append({
                    "name": name_clean,
                    "href": "https://rieltor.ua" + href_clean if href_clean.startswith("/") else href_clean,
                    "rieltor_id": int(m_id.group(1)) if m_id else None,
                    "tab": path,
                })
    return all_items


def norm_rieltor_match_key(s: str) -> str:
    s = fix_mixed_cyrillic(s or "").lower().strip()
    s = re.sub(r"^(?:жк|жб|жд|жбк|км|кг|мжк|кжк|кб|клубний\s+будинок)\s+", "", s)
    s = re.sub(r"^(?:жк|жб|жд|жбк|км|кг|мжк|кжк|кб|клубний\s+будинок)\s+", "", s)
    s = re.sub(r"['’`ʼ\"«».,\-/()]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def build_complexes(rieltor_list, lun_raw, streets_list, houses_db, districts_geo):
    binder = AddressBinder(streets_list, houses_db)
    streets_by_id = binder.streets_by_id

    # Index LUN records by slug, exact normalized title, and synonyms
    lun_by_slug = {item["slug"]: item for item in lun_raw if item.get("slug")}
    lun_by_exact_norm = defaultdict(list)
    lun_by_syn_norm = defaultdict(list)
    for item in lun_raw:
        if not item.get("name"):
            continue
        nk = norm_rieltor_match_key(item["name"])
        if nk:
            lun_by_exact_norm[nk].append(item)
        for syn in [item.get("project_synonym", "")] + (item.get("synonyms") or "").split(","):
            snk = norm_rieltor_match_key(syn)
            if snk:
                lun_by_syn_norm[snk].append(item)

    projects = []
    for r_entry in rieltor_list:
        rid = r_entry.get("rieltor_id")
        r_name = fix_mixed_cyrillic(r_entry["name"]).strip()
        r_url = r_entry.get("href", "")

        # 1. Check if this Rieltor JK is one of the 16 classic 2000s complexes (n21xxx)
        if rid in RIELTOR_CLASSIC_BY_ID:
            ex = RIELTOR_CLASSIC_BY_ID[rid]
            valid_houses = [[sid, hl] for sid, hl in ex["houses"] if str(sid) in houses_db and hl in houses_db[str(sid)]]
            sid0, hl0 = valid_houses[0]
            h0 = houses_db[str(sid0)][hl0]
            dist = DISTRICT_BY_ID.get(h0[2], detect_district_by_coords(h0[0], h0[1], districts_geo))
            addr_parts = [f"{streets_by_id[sid]['short_type']} {streets_by_id[sid]['current_name']}, {hl}" for sid, hl in valid_houses]
            projects.append({
                "jk_name": r_name,
                "address": "; ".join(addr_parts),
                "class": ex["class"],
                "district": dist,
                "houses": valid_houses,
                "aliases": [a for a in ex.get("aliases", []) if a.lower() != r_name.lower()],
                "developer": ex.get("developer", ""),
                "lat": round(h0[0], 6),
                "lon": round(h0[1], 6),
                "url": r_url,
                "rieltor_id": rid,
            })
            continue

        # 2. Match to LUN complex
        item = None
        if rid in RIELTOR_ID_TO_LUN_SLUG:
            slug = RIELTOR_ID_TO_LUN_SLUG[rid]
            item = lun_by_slug.get(slug)
        if not item:
            nk = norm_rieltor_match_key(r_name)
            if nk in lun_by_exact_norm:
                item = lun_by_exact_norm[nk][0]
            elif nk in lun_by_syn_norm:
                item = lun_by_syn_norm[nk][0]

        if not item:
            continue

        slug = item.get("slug", "")
        locality = (item.get("locality") or "").strip()
        lat, lon = item.get("lat"), item.get("lon")

        if slug in SLUG_EXACT_HOUSES:
            bound = [[sid, hl] for sid, hl in SLUG_EXACT_HOUSES[slug] if str(sid) in houses_db and hl in houses_db[str(sid)]]
        else:
            # Strictly use LUN's commissioned "Статус будівництва" mailing_addresses if present;
            # only fall back to header street_address when mailing_addresses is empty!
            addr_candidates = list(item.get("mailing_addresses") or [])
            if not addr_candidates and item.get("street_address"):
                addr_candidates.append(item["street_address"])
            bound = binder.bind_addresses(addr_candidates, lat, lon, locality)

        if slug in SLUG_EXTRA_HOUSES:
            seen = {tuple(p) for p in bound}
            for sid, hl in SLUG_EXTRA_HOUSES[slug]:
                if str(sid) in houses_db and hl in houses_db[str(sid)] and (sid, hl) not in seen:
                    bound.append([sid, hl])
                    seen.add((sid, hl))

        extra_al = list(SLUG_EXTRA_ALIASES.get(slug, []))
        _, fmt_al = format_canonical_jk_name(item.get("name", ""), bound, streets_by_id, locality)
        extra_al.extend(fmt_al)

        aliases = []
        for src_syn in [item.get("name", ""), item.get("project_synonym", "")] + (item.get("synonyms") or "").split(",") + extra_al:
            s_clean = fix_mixed_cyrillic(src_syn).strip().strip("\\").strip()
            if s_clean.count('"') == 1:
                s_clean = s_clean.replace('"', "").strip()
            if s_clean and s_clean.lower() != r_name.lower() and s_clean not in aliases:
                aliases.append(s_clean)

        cls = CLASS_NORM.get((item.get("class_raw") or "").lower(), "")
        if not cls:
            cls = FALLBACK_CLASS_BY_NAME.get(r_name, "")
        if not cls:
            dev_low = (item.get("developer") or "").lower()
            if item.get("is_cottage") or r_name.startswith("КМ ") or "Таунхаус" in r_name:
                cls = "Комфорт"
            elif any(k in dev_low for k in ["авантаж", "тмм", "моноліт", "мкду", "альянс"]):
                cls = "Бізнес"
            elif "житлобуд-2" in dev_low or "строй сіті" in dev_low:
                cls = "Комфорт"
            else:
                cls = "Комфорт" if bound else "Економ"

        district = ""
        if locality and locality != "Харків":
            district = "Передмістя"
        elif bound:
            sid0, hl0 = bound[0]
            h_info = houses_db.get(str(sid0), {}).get(hl0)
            if h_info and h_info[2] in DISTRICT_BY_ID:
                district = DISTRICT_BY_ID[h_info[2]]
                lat, lon = h_info[0], h_info[1]
        if not district and lat and lon:
            district = detect_district_by_coords(lat, lon, districts_geo)
        if not district and item.get("district_raw"):
            dr_low = item["district_raw"].lower()
            for k, v in LUN_DISTRICT_MAP.items():
                if k in dr_low:
                    district = v
                    break
        if not district:
            district = "Передмістя" if (locality and locality != "Харків") else "Шевченківський р-н"

        if bound:
            addr_parts = []
            for sid, hl in bound:
                st = streets_by_id.get(sid)
                if st:
                    p = f"{st['short_type']} {st['current_name']}, {hl}"
                    if p not in addr_parts:
                        addr_parts.append(p)
            address_str = "; ".join(addr_parts)
        else:
            raw_st_addr = fix_mixed_cyrillic(item.get("street_address") or "")
            if locality and locality != "Харків" and locality.lower() not in raw_st_addr.lower():
                address_str = f"{locality}, {raw_st_addr}".strip(", ")
            else:
                address_str = raw_st_addr

        projects.append({
            "jk_name": r_name,
            "address": address_str,
            "class": cls,
            "district": district,
            "houses": bound,
            "aliases": aliases,
            "developer": (item.get("developer") or "").strip(),
            "lat": round(float(lat), 6) if lat else None,
            "lon": round(float(lon), 6) if lon else None,
            "url": item.get("url") or r_url,
            "rieltor_url": r_url,
            "rieltor_id": rid,
        })

    # Disambiguate distinct complexes sharing identical jk_name (e.g. the two ЖК Райдужний on Rieltor.ua)
    name_groups = defaultdict(list)
    for p in projects:
        name_groups[p["jk_name"].lower()].append(p)

    for _, grp in name_groups.items():
        if len(grp) <= 1:
            continue
        for p in grp:
            orig_nm = p["jk_name"]
            if orig_nm not in p["aliases"]:
                p["aliases"].append(orig_nm)
            short_addr = (p["address"].split(";")[0] if p["address"] else p["district"]).strip()
            if short_addr:
                p["jk_name"] = f"{orig_nm} ({short_addr})"

    final_out = []
    for p in projects:
        item = {
            "jk_name": p["jk_name"],
            "address": p["address"],
            "class": p["class"],
            "district": p["district"],
            "houses": p["houses"],
        }
        if p.get("aliases"):
            item["aliases"] = p["aliases"]
        if p.get("developer"):
            item["developer"] = p["developer"]
        if p.get("lat") and p.get("lon"):
            item["lat"] = p["lat"]
            item["lon"] = p["lon"]
        if p.get("url"):
            item["url"] = p["url"]
        if p.get("rieltor_url"):
            item["rieltor_url"] = p["rieltor_url"]
        if p.get("rieltor_id"):
            item["rieltor_id"] = p["rieltor_id"]
        final_out.append(item)

    final_out.sort(key=lambda x: x["jk_name"].lower())
    return final_out


def main():
    parser = argparse.ArgumentParser(description="Build Kharkiv residential complexes database from Rieltor.ua 24-tab catalog + LUN metadata")
    parser.add_argument("--cache-dir", default="", help="Optional directory with cached rieltor_jks_list.json and raw_lun_kharkiv.json")
    parser.add_argument("--refresh", action="store_true", help="Download fresh complex list from Rieltor.ua and LUN")
    parser.add_argument("--out", default="data/complexes.json", help="Output JSON path (default: data/complexes.json)")
    args = parser.parse_args()

    rieltor_cache = os.path.join(args.cache_dir, "rieltor_jks_list.json") if args.cache_dir else ""
    lun_cache = os.path.join(args.cache_dir, "raw_lun_kharkiv.json") if args.cache_dir else ""

    if rieltor_cache and not args.refresh and os.path.exists(rieltor_cache):
        with open(rieltor_cache, encoding="utf-8") as f:
            rieltor_list = json.load(f)
    else:
        rieltor_list = download_rieltor_jks()
        if rieltor_cache:
            os.makedirs(args.cache_dir, exist_ok=True)
            with open(rieltor_cache, "w", encoding="utf-8") as f:
                json.dump(rieltor_list, f, ensure_ascii=False, indent=2)

    if lun_cache and not args.refresh and os.path.exists(lun_cache):
        with open(lun_cache, encoding="utf-8") as f:
            lun_raw = json.load(f)
    else:
        lun_raw, _, _ = download_all_sources()
        if lun_cache:
            os.makedirs(args.cache_dir, exist_ok=True)
            with open(lun_cache, "w", encoding="utf-8") as f:
                json.dump(lun_raw, f, ensure_ascii=False, indent=2)

    with open("data/streets.json", encoding="utf-8") as f:
        streets_list = json.load(f)
    with open("data/houses.json", encoding="utf-8") as f:
        houses_db = json.load(f)
    with open("data/districts.json", encoding="utf-8") as f:
        districts_geo = json.load(f)

    out = build_complexes(rieltor_list, lun_raw, streets_list, houses_db, districts_geo)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    kharkiv_city = [x for x in out if x["district"] != "Передмістя"]
    suburbs = [x for x in out if x["district"] == "Передмістя"]
    with_houses = [x for x in out if x["houses"]]
    total_houses = sum(len(x["houses"]) for x in out)
    with_aliases = sum(1 for x in out if x.get("aliases"))
    addr_named = [x for x in out if re.search(r"^ЖК\s+(?:вул\.|просп\.|пров\.|шосе|наб\.|б-р|пр-д|в-д)", x["jk_name"])]

    print(f"Успішно збережено {len(out)} ЖК (рівно за списком Rieltor.ua) у {args.out}:")
    print(f"  - Місто Харків: {len(kharkiv_city)} ЖК | Передмістя: {len(suburbs)} ЖК")
    print(f"  - Прив'язано до будинків реєстру: {len(with_houses)} ЖК ({total_houses} корпусів/адрес)")
    print(f"  - ЖК за адресою вулиці: {len(addr_named)}")
    print(f"  - ЖК із синонімами (aliases): {with_aliases}")
    print(f"  - Із заповненим класом: {sum(1 for x in out if x.get('class'))}/{len(out)}")


if __name__ == "__main__":
    main()
