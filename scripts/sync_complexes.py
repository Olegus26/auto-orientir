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

# Exact house overrides (replaces auto-bound list when phases share a marketing streetAddress)
SLUG_EXACT_HOUSES = {
    "svoboda": [(2763, "30")],
    "svoboda-2": [(2763, "32")],
    "cheremushky": [(3547, "65-Г, корп. 1")],
    "cheremushky-2": [(3547, "65-Г, корп. 2")],
    "molodizhnyi": [(200040, "48"), (200040, "48-Б")],
    "molodizhnyi-2": [(200040, "48-В"), (200040, "46")],
    "balakirieva": [(200070, "19-А"), (200070, "21-А"), (200070, "23-А")],
}

# Extra verified registry bindings appended to LUN projects
SLUG_EXTRA_HOUSES = {
    "budynok-na-sumskii": [(4058, "77/1")],
    "monte-plaza": [(3107, "45/1"), (3107, "45/2"), (3107, "45/3")],
    "zhuravli": [(2027, "158")],
    "kaskad": [(3060, "20")],
    "luxemburg": [(2564, "3"), (2564, "15-А")],
    "nimetskyi-proekt-hryhorivske-shose": [(2937, "28"), (2937, "30")],
    "now": [(3070, "20-Б")],
    "iskrynskyi": [(2791, "19-А"), (2791, "19-Б"), (2791, "19-В"), (2791, "19-Г"), (2791, "19-Д"), (2791, "19-Ж")],
    "biblyka-st-4": [(2615, "4, корп. 3")],
    "sofiivskyi": [(3147, "35")],
    "sadovyi": [(3845, "13")],
    "velozavodska-st": [(2297, "37"), (2297, "37-А"), (2297, "35"), (2297, "38")],
    "valentynivska-st-haribaldi-st": [(2206, "55")],
    "komfort-na-saltivtsi": [(2632, "5-А")],
    "dmytrivska-st-19": [(2573, "19"), (2573, "19, корп. 2")],
    "levada": [(3119, "1"), (3119, "1-Б"), (3119, "3-Б"), (3119, "3-Г")],
    "oleksiivski-akvareli": [(200040, "54"), (200040, "54-А")],
    "plekhanivska": [(200032, "18-Б"), (200032, "18-В")],
    "poltavskyi-shliakh": [(3651, "28/19"), (3651, "28/19-Д")],
    "promin": [(200006, "193-А"), (200006, "193-Б")],
    "zhuravlevskaia-sloboda-townhouse": [(3094, "8")],
    "perspektyva-raduzhnaia": [(200049, "163"), (200049, "165"), (200049, "167")],
    "myru-3": [(3265, "41"), (3265, "43"), (3265, "47"), (3265, "49"), (3265, "51"), (3265, "53")],
    "myru-4": [(3265, "55"), (3265, "57"), (3265, "59"), (3265, "61")],
    "klemenova-dacha": [(4895, "11, корп. 1"), (4895, "11, корп. 2"), (4895, "11, корп. 3"), (4895, "12"), (4895, "14")],
}

SLUG_TITLE_OVERRIDE = {
    "biblyka-st-4": ("ЖК Олівія (вул. Біблика, 4)", ["ЖК Олівія", "ЖК Оливия", "ЖК вул. Біблика, 4", "Другої П'ятирічки 4", "Второй Пятилетки 4"]),
    "valentynivska-st-haribaldi-st": ("ЖК вул. Валентинівська, 55", ["ЖК по вул. Валентинівській", "вул. Валентинівська / вул. Гарібальді"]),
    "perspektyva-raduzhnaia": ("ЖК Перспектива Радужна (просп. Байрона, 163)", ["ЖК на просп. Байрона", "ЖК Перспектива Радужная", "Героїв Сталінграда 163"]),
    "velozavodska-st": ("ЖК вул. Велозаводська, 37", ["ЖК вул. Велозаводська", "ЖК по ул. Велозаводская", "ЖК по вул. Велозаводська", "Велозаводская 37"]),
    "vremena-hoda": ("ЖК Пори року", ["ЖК Дача 55", "Дача 55", "ЖК Времена года"]),
}

CLASSIC_KHARKIV_COMPLEXES = [
    {
        "jk_name": "ЖК Олімп",
        "class": "Преміум",
        "developer": "Авантаж",
        "houses": [(3070, "20-В")],
        "aliases": ["ЖК Олимп", "Культуры 20в", "Авантаж на Культури 20в"],
    },
    {
        "jk_name": "ЖК Піонер",
        "class": "Преміум",
        "developer": "Авантаж",
        "houses": [(4158, "9")],
        "aliases": ["ЖК Пионер", "Тринклера 9", "Будинок на Трінклера 9"],
    },
    {
        "jk_name": "ЖК Ковчег",
        "class": "Бізнес",
        "developer": "МКДУ",
        "houses": [(2974, "20")],
        "aliases": ["Космическая 20", "ЖК на Космічній 20"],
    },
    {
        "jk_name": "ЖК Слобідська Садиба",
        "class": "Преміум",
        "developer": "Моноліт",
        "houses": [(2505, "26")],
        "aliases": ["ЖК Слободская Усадьба", "Данилевского 26"],
    },
    {
        "jk_name": "ЖК Світлий Дім",
        "class": "Бізнес",
        "developer": "МКДУ",
        "houses": [(2522, "33-Г")],
        "aliases": ["ЖК Светлый Дом", "23 Августа 33г", "23 Серпня 33г"],
    },
    {
        "jk_name": "ЖК Парус",
        "class": "Бізнес",
        "developer": "Моноліт",
        "houses": [(2147, "36-А")],
        "aliases": ["Парус на Песках", "Барабашова 36а", "ЖК Парус на Салтівці"],
    },
    {
        "jk_name": "ЖК Гвардійський",
        "class": "Бізнес",
        "developer": "Житлобуд-2",
        "houses": [(2418, "33")],
        "aliases": ["ЖК Гвардейский", "Гвардейцев Широнинцев 33"],
    },
    {
        "jk_name": "ЖК Союз",
        "class": "Бізнес",
        "developer": "Моноліт",
        "houses": [(3547, "61-Ж")],
        "aliases": ["ЖК Моноліт на Перемоги", "просп. Перемоги, 61-Ж", "Победы 61ж"],
    },
    {
        "jk_name": "ЖК Форпост",
        "class": "Комфорт",
        "developer": "Форпост",
        "houses": [(200040, "42")],
        "aliases": ["ЖК Целіноградська, 42", "ЖК по ул. Целиноградская, 42", "Мирослава Мисли 42"],
    },
    {
        "jk_name": "ЖК Садова Гірка",
        "class": "Бізнес",
        "developer": "Авантаж",
        "houses": [(2505, "40"), (2505, "42")],
        "aliases": ["ЖК Садовая Горка", "Данилевского 40", "Данилевского 42"],
    },
    {
        "jk_name": "ЖК Адмірал",
        "class": "Бізнес",
        "developer": "Констракшн Груп",
        "houses": [(2893, "258")],
        "aliases": ["ЖК Адмирал", "Клочковская 258"],
        "url": "https://lun.ua/sale/kharkiv/admiral",
    },
    {
        "jk_name": "ЖК Моноліт на Чернишевській",
        "class": "Бізнес",
        "developer": "Моноліт",
        "houses": [(4349, "31-А")],
        "aliases": ["ЖК Моноліт", "ЖК Монолит", "Чернышевская 31а"],
    },
    {
        "jk_name": "ЖК Джокер",
        "class": "Бізнес",
        "developer": "МКДУ",
        "houses": [(200624, "14")],
        "aliases": ["Героев Труда 14", "Нескорених 14"],
    },
    {
        "jk_name": "ЖК Садиба на Дерев'янка",
        "class": "Бізнес",
        "developer": "Консоль",
        "houses": [(2546, "16-А")],
        "aliases": ["ЖК Садиба", "ЖК Консоль на Балакірєва", "Деревянко 16а"],
    },
    {
        "jk_name": "ЖК Джерело",
        "class": "Комфорт",
        "developer": "Флас",
        "houses": [(3519, "24-Б")],
        "aliases": ["Отакара Яроша 24б", "ЖК Родник на Отакара Яроша"],
    },
    {
        "jk_name": "ЖК Авеню 5",
        "class": "Бізнес",
        "developer": "Global Development",
        "houses": [(3519, "1"), (3519, "3")],
        "aliases": ["ЖК Авеню5", "ЖК 5th Avenue", "Отакара Яроша 1"],
    },
    {
        "jk_name": "ЖК Епоха",
        "class": "Комфорт",
        "developer": "",
        "houses": [(2869, "19-В")],
        "aliases": ["ЖК Эпоха", "Киргизская 19в"],
    },
    {
        "jk_name": "ЖК Золочівський",
        "class": "Економ",
        "developer": "Мегаінвестбуд",
        "houses": [(2752, "22")],
        "aliases": ["ЖК Золочевский", "2-й Золочевский пер. 22"],
    },
    {
        "jk_name": "ЖК Меркурій",
        "class": "Комфорт",
        "developer": "",
        "houses": [(200484, "9-А")],
        "aliases": ["ЖК Меркурий", "Родниковая 9а", "Яни Червоної 9а"],
    },
    {
        "jk_name": "ЖК Олексіївські Акварелі-2",
        "class": "Комфорт",
        "developer": "Воробйові гори",
        "houses": [(2005, "18/31")],
        "aliases": ["ЖК Алексеевские Акварели-2", "Авиахимическая 18/31"],
    },
    {
        "jk_name": "ЖК Левада-2",
        "class": "Комфорт",
        "developer": "Трест Житлобуд-1",
        "houses": [(2696, "8-Б"), (3119, "2-Б")],
        "aliases": ["ЖК Левада 2", "Заливная 8б", "Елизаветинская 2б"],
    },
    {
        "jk_name": "МЖК Інтернаціоналіст",
        "class": "Комфорт",
        "developer": "МЖК Інтернаціоналіст",
        "houses": [(2932, "45-Б"), (4716, "38"), (4716, "39"), (4716, "40"), (4716, "41")],
        "aliases": ["МЖК Интернационалист", "Кричевского", "Леся Сердюка 45б"],
    },
    {
        "jk_name": "Таунхаус Гармонія",
        "class": "Комфорт",
        "developer": "",
        "houses": [(200056, "79")],
        "aliases": ["Таунхаус Гармония", "Минская 79", "Дмитра Антоненка 79"],
    },
    {
        "jk_name": "ЖК вул. Сухумська, 24",
        "class": "Бізнес",
        "developer": "Житлобуд-2",
        "houses": [(4064, "24")],
        "aliases": ["ЖК по ул. Сухумская, 24", "ЖК Сухумська 24", "Жилстрой-2 на Сухумской"],
    },
    {
        "jk_name": "ЖК вул. Культури, 22-В",
        "class": "Бізнес",
        "developer": "Житлобуд-2",
        "houses": [(3070, "22-В")],
        "aliases": ["ЖК по ул. Культуры, 22в", "Культури 22в"],
    },
    {
        "jk_name": "ЖК вул. Біблика, 25-А",
        "class": "Комфорт",
        "developer": "Авантаж",
        "houses": [(2615, "25-А")],
        "aliases": ["ЖК по ул. Второй Пятилетки, 25а", "ЖК Другої П'ятирічки, 25-А", "Авантаж на Пятилетки"],
    },
    {
        "jk_name": "ЖК вул. Северина Потоцького, 26",
        "class": "Економ",
        "developer": "Авантаж",
        "houses": [(3935, "26")],
        "aliases": ["ЖК по ул. 17-го Партсъезда, 26", "Сімнадцятого Партз'їзду, 26", "Авантаж на Потоцького"],
    },
    {
        "jk_name": "ЖК вул. Греківська, 5",
        "class": "Комфорт",
        "developer": "Трест Житлобуд-1",
        "houses": [(2475, "5")],
        "aliases": ["ЖК по ул. Грековская, 5", "Греківська 5"],
    },
    {
        "jk_name": "ЖК вул. Клочківська, 197",
        "class": "Комфорт",
        "developer": "Трест Житлобуд-1",
        "houses": [(2893, "197-Б"), (2893, "197-В"), (2893, "197-Г")],
        "aliases": ["ЖК по ул. Клочковская, 197", "Клочковская 197б", "Клочковская 197в"],
    },
    {
        "jk_name": "ЖК вул. Соборності України, 238-А",
        "class": "Бізнес",
        "developer": "ТММ",
        "houses": [(200627, "238-А")],
        "aliases": ["ЖК по ул. Дружбы Народов, 238а", "ЖК Дружби Народів, 238-А", "ТММ на Дружбы Народов"],
    },
    {
        "jk_name": "ЖК вул. Ахсарова, 3-В",
        "class": "Бізнес",
        "developer": "ТММ",
        "houses": [(2107, "3-В")],
        "aliases": ["ЖК по ул. Ахсарова, 3в", "ТММ на Ахсарова"],
    },
    {
        "jk_name": "ЖК вул. Старицького, 13",
        "class": "Бізнес",
        "developer": "С-Інвест",
        "houses": [(4020, "13")],
        "aliases": ["ЖК по ул. Старицкого, 13", "Старицького 13"],
    },
    {
        "jk_name": "ЖК просп. Героїв Харкова, 131",
        "class": "Комфорт",
        "developer": "Трест Житлобуд-1",
        "houses": [(3307, "131"), (3307, "131-А"), (3307, "131-В")],
        "aliases": ["ЖК Героїв Харкова, 131", "ЖК по пр. Московский, 131"],
    },
    {
        "jk_name": "ЖК просп. Тракторобудівників, 2-Г",
        "class": "Економ",
        "developer": "Трест Житлобуд-1",
        "houses": [(4149, "2-Г")],
        "aliases": ["ЖК Тракторобудівників", "ЖК по пр. Тракторостроителей, 2г"],
    },
    {
        "jk_name": "ЖК вул. Полтавський Шлях, 177-Б",
        "class": "Економ",
        "developer": "",
        "houses": [(3651, "177-А")],
        "address_override": "вул. Полтавський Шлях, 177-Б",
        "aliases": ["ЖК Дім на Полтавському 177б", "Полтавский Шлях 177б"],
    },
]


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


def build_complexes(lun_raw, so_raw, dr_raw, streets_list, houses_db, districts_geo):
    binder = AddressBinder(streets_list, houses_db)
    streets_by_id = binder.streets_by_id
    projects = []

    # 1. Process all valid LUN complexes
    for item in lun_raw:
        raw_name = (item.get("name") or "").strip()
        slug = item.get("slug", "")
        if not raw_name or slug in SKIP_LUN_SLUGS:
            continue
        locality = (item.get("locality") or "").strip()
        lat, lon = item.get("lat"), item.get("lon")

        if slug in SLUG_EXACT_HOUSES:
            bound = [[sid, hl] for sid, hl in SLUG_EXACT_HOUSES[slug] if str(sid) in houses_db and hl in houses_db[str(sid)]]
        else:
            addr_candidates = list(item.get("mailing_addresses") or [])
            if item.get("street_address") and not item.get("mailing_addresses"):
                addr_candidates.append(item["street_address"])
            elif item.get("street_address"):
                addr_candidates.append(item["street_address"])
            bound = binder.bind_addresses(addr_candidates, lat, lon, locality)

        if slug in SLUG_EXTRA_HOUSES:
            seen = {tuple(p) for p in bound}
            for sid, hl in SLUG_EXTRA_HOUSES[slug]:
                if str(sid) in houses_db and hl in houses_db[str(sid)] and (sid, hl) not in seen:
                    bound.append([sid, hl])
                    seen.add((sid, hl))

        if slug in SLUG_TITLE_OVERRIDE:
            jk_name, extra_al = SLUG_TITLE_OVERRIDE[slug]
            extra_al = list(extra_al)
        else:
            jk_name, extra_al = format_canonical_jk_name(raw_name, bound, streets_by_id, locality)

        aliases = []
        for src_syn in [item.get("project_synonym", "")] + (item.get("synonyms") or "").split(",") + extra_al:
            s_clean = fix_mixed_cyrillic(src_syn).strip().strip("\\").strip()
            if s_clean.count('"') == 1:
                s_clean = s_clean.replace('"', "").strip()
            if s_clean and s_clean.lower() != jk_name.lower() and s_clean not in aliases:
                aliases.append(s_clean)

        cls = CLASS_NORM.get((item.get("class_raw") or "").lower(), "")
        if not cls:
            cls = FALLBACK_CLASS_BY_NAME.get(jk_name, "")
        if not cls:
            dev_low = (item.get("developer") or "").lower()
            if item.get("is_cottage") or jk_name.startswith("КМ ") or "Таунхаус" in jk_name:
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
            "jk_name": jk_name,
            "address": address_str,
            "class": cls,
            "district": district,
            "houses": bound,
            "aliases": aliases,
            "developer": (item.get("developer") or "").strip(),
            "lat": round(float(lat), 6) if lat else None,
            "lon": round(float(lon), 6) if lon else None,
            "url": item.get("url") or "",
        })

    by_house = {}
    by_norm = defaultdict(list)
    for p in projects:
        by_norm[norm_dedup_key(p["jk_name"])].append(p)
        for al in p["aliases"]:
            by_norm[norm_dedup_key(al)].append(p)
        for sid, hl in p["houses"]:
            by_house[(sid, hl)] = p

    # 2. Add Classic 2000–2012 Kharkiv Secondary-Market Complexes & Address-Named Houses
    for ex in CLASSIC_KHARKIV_COMPLEXES:
        valid_houses = [[sid, hl] for sid, hl in ex["houses"] if str(sid) in houses_db and hl in houses_db[str(sid)]]
        if not valid_houses:
            continue
        sid0, hl0 = valid_houses[0]
        h0 = houses_db[str(sid0)][hl0]

        nk = norm_dedup_key(ex["jk_name"])
        existing = None
        for sid, hl in valid_houses:
            if (sid, hl) in by_house:
                existing = by_house[(sid, hl)]
                break
        if not existing and nk in by_norm:
            for cand in by_norm[nk]:
                if cand.get("lat") and cand.get("lon") and haversine_m(h0[0], h0[1], cand["lat"], cand["lon"]) <= 800:
                    existing = cand
                    break

        if existing:
            seen_h = {tuple(h) for h in existing["houses"]}
            for sid, hl in valid_houses:
                if (sid, hl) not in seen_h:
                    existing["houses"].append([sid, hl])
                    seen_h.add((sid, hl))
                    by_house[(sid, hl)] = existing
            for al in ex.get("aliases", []):
                if al not in existing["aliases"] and al.lower() != existing["jk_name"].lower():
                    existing["aliases"].append(al)
            if not existing.get("developer") and ex.get("developer"):
                existing["developer"] = ex["developer"]
            if existing["houses"]:
                parts = []
                for sid, hl in existing["houses"]:
                    st = streets_by_id.get(sid)
                    if st:
                        s_p = f"{st['short_type']} {st['current_name']}, {hl}"
                        if s_p not in parts:
                            parts.append(s_p)
                existing["address"] = "; ".join(parts)
            continue

        dist = DISTRICT_BY_ID.get(h0[2], detect_district_by_coords(h0[0], h0[1], districts_geo))
        addr_parts = [f"{streets_by_id[sid]['short_type']} {streets_by_id[sid]['current_name']}, {hl}" for sid, hl in valid_houses]
        rec = {
            "jk_name": ex["jk_name"],
            "address": ex.get("address_override") or "; ".join(addr_parts),
            "class": ex["class"],
            "district": dist,
            "houses": valid_houses,
            "aliases": list(ex.get("aliases", [])),
            "developer": ex.get("developer", ""),
            "lat": round(h0[0], 6),
            "lon": round(h0[1], 6),
            "url": ex.get("url", ""),
        }
        projects.append(rec)
        by_norm[nk].append(rec)
        for sid, hl in valid_houses:
            by_house[(sid, hl)] = rec

    # 3. Enrich from StroyObzor & DOM.RIA
    for sec in list(so_raw) + list(dr_raw):
        nm_raw = fix_mixed_cyrillic(sec.get("name") or "").strip()
        if not nm_raw or re.match(r"^(?:БЦ|ТЦ|ТРЦ)\b", nm_raw, re.I):
            continue
        nk = norm_dedup_key(nm_raw)
        if nk in by_norm:
            matched_cand = None
            for cand in by_norm[nk]:
                if not sec.get("lat") or not cand.get("lat") or haversine_m(sec["lat"], sec["lon"], cand["lat"], cand["lon"]) <= 1500:
                    matched_cand = cand
                    break
            if matched_cand:
                if not matched_cand.get("developer") and sec.get("developer"):
                    matched_cand["developer"] = sec["developer"]
                continue

        addr_raw = sec.get("address") or ""
        is_suburb = any(sub in addr_raw.lower() for sub in ["песочин", "пісочин", "подворки", "подвірки", "циркун", "солониців", "мала данилівка"])
        bound = [] if is_suburb else binder.bind_addresses([addr_raw], sec.get("lat"), sec.get("lon"), "Харків")
        if bound and any((sid, hl) in by_house for sid, hl in bound):
            target = next(by_house[(sid, hl)] for sid, hl in bound if (sid, hl) in by_house)
            if nm_raw not in target["aliases"] and nm_raw.lower() != target["jk_name"].lower():
                target["aliases"].append(nm_raw)
            continue

        # Only add secondary-source complex if it has an explicit address or bound houses
        if not bound and not addr_raw:
            continue
        if not bound and not sec.get("lat"):
            continue

        jk_name, extra_al = format_canonical_jk_name(nm_raw, bound, streets_by_id, "Передмістя" if is_suburb else "Харків")
        if not re.match(r"^(ЖК|КМ|МЖК|КЖК|Таунхаус|Клубний)", jk_name, re.I):
            jk_name = f"ЖК {jk_name}"

        cls = CLASS_NORM.get((sec.get("class_raw") or "").lower(), "") or "Комфорт"
        lat, lon = sec.get("lat"), sec.get("lon")
        if bound:
            sid0, hl0 = bound[0]
            h0 = houses_db[str(sid0)][hl0]
            lat, lon = h0[0], h0[1]
            dist = DISTRICT_BY_ID.get(h0[2], "Шевченківський р-н")
            addr_str = "; ".join(f"{streets_by_id[s]['short_type']} {streets_by_id[s]['current_name']}, {h}" for s, h in bound)
        else:
            dist = "Передмістя" if is_suburb else detect_district_by_coords(lat, lon, districts_geo)
            addr_str = addr_raw

        rec = {
            "jk_name": jk_name,
            "address": addr_str,
            "class": cls,
            "district": dist,
            "houses": bound,
            "aliases": extra_al,
            "developer": (sec.get("developer") or "").strip(),
            "lat": round(float(lat), 6) if lat else None,
            "lon": round(float(lon), 6) if lon else None,
            "url": sec.get("url") or "",
        }
        projects.append(rec)
        by_norm[nk].append(rec)
        for sid, hl in bound:
            by_house[(sid, hl)] = rec

    # 4. Disambiguate distinct complexes sharing identical jk_name
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
        final_out.append(item)

    final_out.sort(key=lambda x: x["jk_name"].lower())
    return final_out


def main():
    parser = argparse.ArgumentParser(description="Build comprehensive Kharkiv residential complexes database")
    parser.add_argument("--cache-dir", default="", help="Optional directory with cached raw_*.json files")
    parser.add_argument("--refresh", action="store_true", help="Download fresh complex data from LUN, StroyObzor, and DIM.RIA")
    parser.add_argument("--out", default="data/complexes.json", help="Output JSON path (default: data/complexes.json)")
    args = parser.parse_args()

    if args.cache_dir and not args.refresh and os.path.exists(os.path.join(args.cache_dir, "raw_lun_kharkiv.json")):
        with open(os.path.join(args.cache_dir, "raw_lun_kharkiv.json"), encoding="utf-8") as f:
            lun_raw = json.load(f)
        with open(os.path.join(args.cache_dir, "raw_stroyobzor_kharkiv.json"), encoding="utf-8") as f:
            so_raw = json.load(f)
        with open(os.path.join(args.cache_dir, "raw_domria_kharkiv.json"), encoding="utf-8") as f:
            dr_raw = json.load(f)
    else:
        lun_raw, so_raw, dr_raw = download_all_sources()
        if args.cache_dir:
            os.makedirs(args.cache_dir, exist_ok=True)
            with open(os.path.join(args.cache_dir, "raw_lun_kharkiv.json"), "w", encoding="utf-8") as f:
                json.dump(lun_raw, f, ensure_ascii=False, indent=2)
            with open(os.path.join(args.cache_dir, "raw_stroyobzor_kharkiv.json"), "w", encoding="utf-8") as f:
                json.dump(so_raw, f, ensure_ascii=False, indent=2)
            with open(os.path.join(args.cache_dir, "raw_domria_kharkiv.json"), "w", encoding="utf-8") as f:
                json.dump(dr_raw, f, ensure_ascii=False, indent=2)

    with open("data/streets.json", encoding="utf-8") as f:
        streets_list = json.load(f)
    with open("data/houses.json", encoding="utf-8") as f:
        houses_db = json.load(f)
    with open("data/districts.json", encoding="utf-8") as f:
        districts_geo = json.load(f)

    out = build_complexes(lun_raw, so_raw, dr_raw, streets_list, houses_db, districts_geo)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    kharkiv_city = [x for x in out if x["district"] != "Передмістя"]
    suburbs = [x for x in out if x["district"] == "Передмістя"]
    with_houses = [x for x in out if x["houses"]]
    total_houses = sum(len(x["houses"]) for x in out)
    with_aliases = sum(1 for x in out if x.get("aliases"))
    addr_named = [x for x in out if re.search(r"^ЖК\s+(?:вул\.|просп\.|пров\.|шосе|наб\.|б-р|пр-д|в-д)", x["jk_name"])]

    print(f"Успішно збережено {len(out)} ЖК у {args.out}:")
    print(f"  - Місто Харків: {len(kharkiv_city)} ЖК | Передмістя: {len(suburbs)} ЖК")
    print(f"  - Прив'язано до будинків реєстру: {len(with_houses)} ЖК ({total_houses} корпусів/адрес)")
    print(f"  - ЖК без комерційної назви (за адресою вулиці): {len(addr_named)}")
    print(f"  - ЖК із народними назвами / синонімами (aliases): {with_aliases}")
    print(f"  - Із заповненим класом: {sum(1 for x in out if x.get('class'))}/{len(out)}")


if __name__ == "__main__":
    main()
