#!/usr/bin/env python3
"""
Очищення, дедуплікація та збагачення бази житлових комплексів Харкова (data/complexes.json).
Усуває латинські літери у кирилиці, об'єднує дублікати корпусів (ЖК Миру-3 буд ..., Клеменова Дача тощо),
заповнює класи ЖК (Економ / Комфорт / Бізнес / Преміум) та прив'язує будинки до реєстру.
"""
import json
import re

LAT_TO_CYR_IN_UK = str.maketrans({
    "i": "і",
    "I": "І",
})


def fix_mixed_cyrillic(name: str) -> str:
    # Fix words that mix Cyrillic and Latin 'i' (e.g. "Воробйовi")
    def repl_word(m):
        w = m.group(0)
        if re.search(r"[а-яіїєґА-ЯІЇЄҐ]", w) and re.search(r"[iI]", w):
            return w.translate(LAT_TO_CYR_IN_UK)
        return w

    return re.sub(r"\S+", repl_word, name).strip()


CANONICAL_RENAMES = {
    "ЖК Воробйові гори на Полях": "ЖК Воробйові гори на Полях",
    "ЖК Воробйові гори на полях-3": "ЖК Воробйові гори на Полях-3",
    "ЖК Воробйові Гори-1": "ЖК Воробйові гори",
    "ЖК Воробйові Гори-2": "ЖК Воробйові гори",
    "ЖК Воробйові Гори-5": "ЖК Воробйові гори",
    "ЖК Роял Резіденс": "ЖК Royal Residence",
    "ЖК ЗерНова": "ЖК ZerNova",
    "ЖК Комфорт": "ЖК Комфорт на Салтівці",
    "ЖК Континенталь": "ЖК Континенталь на Валентинівській",
    "ЖК Конторський-2": "ЖК Конторський",
    "ЖК Ковалівські сади": "ЖК Бестужевські сади",
    "ЖК Левада 1": "ЖК Левада",
    "ЖК Левада 2": "ЖК Левада-2",
    "ЖК Манхетен": "ЖК Мангеттен",
    "ЖК Миру 1": "ЖК Миру-1",
    "ЖК Миру 4": "ЖК Миру-4",
    "ЖК Олексіївський Акварелі 2": "ЖК Олексіївські Акварелі-2",
    "ЖК Павловський квартал": "ЖК Павлівський квартал",
    "ЖК Райдужний 1": "ЖК Райдужний",
    "ЖК Ренесанс парк": "КМ Ренесанс Парк",
    "ЖК Park House": "КМ Park House",
    "ЖК Роганский": "ЖК Роганський",
    "ЖК Журавли": "ЖК Журавлі",
    "ЖК Сокольники": "ЖК Сокільники",
    "ЖК Салтівський 1": "ЖК Салтівський",
    "ЖК Стожари-3": "ЖК Воробйові гори",
    "ЖК Стожари-4": "ЖК Воробйові гори",
    "ЖК Стожари-7": "ЖК Воробйові гори",
    "ЖК Титул": "ЖК Титул Будинок на Пушкінській",
    "ЖК ТИТУЛ Будинок на Пушкінській": "ЖК Титул Будинок на Пушкінській",
    "ЖК the first capital residence": "ЖК The First Capital Residence",
    "ЖК Л. Малої": "ЖК Постишева (Л. Малої)",
    "ЖК Плеханівська": "ЖК Плеханівський",
    "Новий дім": "ЖК Новий Дім на Котлова",
    "Таунхаус Shatilovka Hillside": "ЖК Shatilovka Hillside",
}

DROP_NAMES = {
    "Мегаінвестбуд",
    "Трест Житлобуд-1",
    "просп. Перемоги",
    "просп. Петра Григоренка, 2б",
    "ЖК вул. Білогірська",
    "ЖК вул. Миру",
    "КМ River Park",
    "ЖК Смерековий двір",
}

# Known classes for Kharkiv residential complexes
CLASS_MAP = {
    # Преміум
    "ЖК Авантаж": "Преміум",
    "ЖК Фаворит": "Преміум",
    "ЖК Ультра": "Преміум",
    "ЖК Монте Плаза": "Преміум",
    "ЖК Олімп": "Преміум",
    "ЖК Схід-Захід": "Преміум",
    "ЖК Будинок на Набережній": "Преміум",
    "ЖК Фелічіта": "Преміум",
    "ЖК Білий Слон": "Преміум",
    "ЖК Садиба Чернишевського": "Преміум",
    "ЖК Театральний": "Преміум",
    "ЖК Резиденція": "Преміум",
    "ЖК Квітка": "Преміум",
    "ЖК Інфініті": "Преміум",
    # Бізнес
    "ЖК Павлівський квартал": "Бізнес",
    "ЖК Дует": "Бізнес",
    "ЖК Німецький проект": "Бізнес",
    "ЖК Адмірал": "Бізнес",
    "ЖК Дім з Ротондами": "Бізнес",
    "ЖК Флагман": "Бізнес",
    "ЖК Домініон": "Бізнес",
    "ЖК Аксіома": "Бізнес",
    "ЖК Будинок в Сокільниках": "Бізнес",
    "ЖК Сокільники": "Бізнес",
    "ЖК Мир": "Бізнес",
    "ЖК Оптіма": "Бізнес",
    "ЖК Гранд": "Бізнес",
    "ЖК Джокер": "Бізнес",
    "ЖК Парус": "Бізнес",
    "ЖК Лайнер": "Бізнес",
    "ЖК Садова Гірка": "Бізнес",
    "ЖК Плеханівський": "Бізнес",
    "ЖК Nodus": "Бізнес",
    "ЖК Dixie": "Бізнес",
    "ЖК Urban One Naukova Apartments": "Бізнес",
    "ЖК Віденський Дім": "Бізнес",
    "ЖК Карат": "Бізнес",
    "ЖК Моноліт": "Бізнес",
    "ЖК На Бакуліна": "Бізнес",
    "ЖК Вікторія": "Бізнес",
    "ЖК Green Town": "Бізнес",
    "КЖК Клеменова Дача": "Бізнес",
    "ЖК Berlin house": "Бізнес",
    "ЖК Авеню5": "Бізнес",
    "ЖК Білобровський": "Бізнес",
    "ЖК Квант": "Бізнес",
    "ЖК Науковий": "Бізнес",
    "ЖК Свобода": "Бізнес",
    "ЖК Свобода-2": "Бізнес",
    "ЖК Садиба": "Бізнес",
    "ЖК Подільський": "Бізнес",
    "ЖК Каскад": "Бізнес",
    "ЖК Зарічний": "Бізнес",
    # Комфорт
    "ЖК Gaudi Hall": "Комфорт",
    "ЖК Рогатинський": "Комфорт",
    "ЖК Гідропарк": "Комфорт",
    "ЖК Левада-2": "Комфорт",
    "ЖК Балакірєва": "Комфорт",
    "ЖК Іскринський": "Комфорт",
    "ЖК Макеєвська": "Комфорт",
    "ЖК Маршал": "Комфорт",
    "ЖК Черемушки-1": "Комфорт",
    "ЖК Черемушки-2": "Комфорт",
    "ЖК Молодіжний": "Комфорт",
    "ЖК Молодіжний-2": "Комфорт",
    "ЖК Молодіжне містечко": "Комфорт",
    "ЖК Олексіївські Акварелі": "Комфорт",
    "ЖК Олексіївські Акварелі-2": "Комфорт",
    "ЖК Карамель": "Комфорт",
    "ЖК Лазурний": "Комфорт",
    "ЖК Одеський": "Комфорт",
    "ЖК Смарагдове місто": "Комфорт",
    "ЖК Садовий": "Комфорт",
    "ЖК Сонячний квартал": "Комфорт",
    "ЖК Сонячний Дім": "Комфорт",
    "ЖК Панорама": "Комфорт",
    "ЖК Кристал": "Комфорт",
    "ЖК Таунхауси Журавлівська Слобода": "Комфорт",
    "МЖК Інтернаціоналіст": "Комфорт",
    "ЖК Джерело": "Комфорт",
    "ЖК Дім Академіка": "Комфорт",
    "ЖК Захисник": "Комфорт",
    "ЖК Меркурій": "Комфорт",
    "ЖК Металіст": "Комфорт",
    "ЖК Мрія": "Комфорт",
    "ЖК Муромець": "Комфорт",
    "ЖК Олівія": "Комфорт",
    "ЖК Промінь": "Комфорт",
    "ЖК Родніки": "Комфорт",
    "ЖК Садове Місто": "Комфорт",
    "ЖК Семінарський": "Комфорт",
    "ЖК Слов'янський": "Комфорт",
    "ЖК Софія": "Комфорт",
    "ЖК Софіївський": "Комфорт",
    "ЖК Столичний": "Комфорт",
    "ЖК Фесенківський": "Комфорт",
    "ЖК Чумацький шлях": "Комфорт",
    "ЖК Ярославський": "Комфорт",
    "ЖК Благовіст": "Комфорт",
    "ЖК Крокус": "Комфорт",
    "ЖК Епоха": "Комфорт",
    # Економ
    "ЖК Миру-1": "Економ",
    "ЖК Миру-2": "Економ",
    "ЖК Миру-3": "Економ",
    "ЖК Миру-4": "Економ",
    "ЖК Ньютона": "Економ",
    "ЖК Олександрівський": "Економ",
    "ЖК Салтівський": "Економ",
    "ЖК Постишева (Л. Малої)": "Економ",
    "ЖК Райдужний-2": "Економ",
    "ЖК Роганський": "Економ",
    "ЖК Тракторобудівників": "Економ",
    "ЖК Індустріальний": "Економ",
    "ЖК Перемоги": "Економ",
    "ЖК Косарева": "Економ",
    "ЖК Кільцевий": "Економ",
    "ЖК Будинок на Зерновій": "Економ",
    "ЖК Бузок": "Економ",
    "ЖК Дипломат Клаб": "Преміум",
    "ЖК на Балакірєва (Моноліт)": "Бізнес",
    "ЖК Примерівське": "Бізнес",
    "ЖК Парковий квартал": "Комфорт",
    "ЖК Полтавський Шлях": "Комфорт",
    "ЖК Будинок на Озерянській": "Комфорт",
    "ЖК Затишний дворик": "Комфорт",
    "ЖК На Холодній горі": "Комфорт",
    "ЖК Одеський дворик": "Комфорт",
    "ЖК Сабурівський": "Комфорт",
    "ЖК Титаренківський": "Комфорт",
    "ЖК Пори року": "Економ",
    "ЖК Архітекторів": "Економ",
    "ЖК по Валентинівській вулиці": "Економ",
    "ЖК NewTown": "Економ",
    "ЖК Золочівський": "Економ",
    "ЖК Околиця": "Економ",
    "ЖК Південний Горизонт": "Економ",
}

EXTRA_COMPLEXES = [
    {
        "jk_name": "ЖК Білий Слон",
        "class": "Преміум",
        "district": "Шевченківський р-н",
        "street_id": 4251,  # вул. Фронтова
        "house_Candidates": ["3"],
        "address": "вул. Фронтова, 3",
        "lat": 50.03657,
        "lon": 36.26125,
    },
    {
        "jk_name": "ЖК Садова Гірка",
        "class": "Бізнес",
        "district": "Шевченківський р-н",
        "street_id": 2505,  # вул. Данилевського
        "house_Candidates": ["40", "42"],
        "address": "вул. Данилевського, 40; вул. Данилевського, 42",
        "lat": 50.01195,
        "lon": 36.22110,
    },
    {
        "jk_name": "ЖК Парус",
        "class": "Бізнес",
        "district": "Київський р-н",
        "street_id": 2149,  # вул. Барабашова
        "house_Candidates": ["36-А"],
        "address": "вул. Барабашова, 36-А",
        "lat": 50.01856,
        "lon": 36.33245,
    },
    {
        "jk_name": "ЖК Іскринський",
        "class": "Комфорт",
        "district": "Салтівський р-н",
        "street_id": 2796,  # вул. Іскринська
        "house_Candidates": ["19-А", "19-Б", "19-В", "19-Г"],
        "address": "вул. Іскринська, 19-А; вул. Іскринська, 19-Б; вул. Іскринська, 19-В",
        "lat": 49.98885,
        "lon": 36.26655,
    },
    {
        "jk_name": "ЖК Гранд",
        "class": "Бізнес",
        "district": "Шевченківський р-н",
        "street_id": 3520,  # пров. Отакара Яроша
        "house_Candidates": ["12-А"],
        "address": "пров. Отакара Яроша, 12-А",
        "lat": 50.02585,
        "lon": 36.22485,
    },
]


def normalize_jk_name(raw_name: str) -> str:
    n = fix_mixed_cyrillic(raw_name)
    if re.match(r"^ЖК Миру-3 буд\b", n, flags=re.IGNORECASE):
        return "ЖК Миру-3"
    if re.match(r"^ЖК Миру-4 буд\b", n, flags=re.IGNORECASE):
        return "ЖК Миру-4"
    if re.match(r"^ЖК Клеменова Дача\b", n, flags=re.IGNORECASE):
        return "КЖК Клеменова Дача"
    return CANONICAL_RENAMES.get(n, n)


def main():
    with open("data/complexes.json", encoding="utf-8") as f:
        raw_jks = json.load(f)
    with open("data/houses.json", encoding="utf-8") as f:
        houses_db = json.load(f)
    with open("data/streets.json", encoding="utf-8") as f:
        streets_db = {s["street_id"]: s for s in json.load(f)}

    merged = {}

    for item in raw_jks:
        orig_name = item.get("jk_name", "").strip()
        if not orig_name or orig_name in DROP_NAMES:
            continue
        # Drop pure street-address pseudo-JKs like "ЖК вул. Дмитрівська, 19" unless they have a real name
        if re.match(r"^ЖК\s+(?:на\s+)?(?:вул\.|пров\.|просп\.)\s+", orig_name):
            continue

        name = normalize_jk_name(orig_name)
        if name in DROP_NAMES:
            continue

        if name not in merged:
            merged[name] = {
                "jk_name": name,
                "address": item.get("address", ""),
                "class": item.get("class", ""),
                "district": item.get("district", ""),
                "houses": [],
            }
            if item.get("raw_address"):
                merged[name]["raw_address"] = item["raw_address"]
            if item.get("lat") and item.get("lon"):
                merged[name]["lat"] = item["lat"]
                merged[name]["lon"] = item["lon"]
            if item.get("url"):
                merged[name]["url"] = item["url"]

        rec = merged[name]
        if not rec["class"] and item.get("class"):
            rec["class"] = item["class"]
        if not rec["district"] and item.get("district"):
            rec["district"] = item["district"]
        if (not rec.get("lat")) and item.get("lat") and item.get("lon"):
            rec["lat"] = item["lat"]
            rec["lon"] = item["lon"]
        if (not rec.get("url")) and item.get("url"):
            rec["url"] = item["url"]

        existing_pairs = {(h[0], h[1]) for h in rec["houses"]}
        for pair in item.get("houses", []):
            if len(pair) == 2 and (pair[0], pair[1]) not in existing_pairs:
                # Verify house exists in houses_db if possible
                rec["houses"].append([int(pair[0]), str(pair[1])])
                existing_pairs.add((int(pair[0]), str(pair[1])))

    # Add curated extra major complexes if absent
    for ex in EXTRA_COMPLEXES:
        nm = ex["jk_name"]
        st_id = ex["street_id"]
        st_houses = houses_db.get(str(st_id), {})
        matched_pairs = []
        for hc in ex["house_Candidates"]:
            if hc in st_houses:
                matched_pairs.append([st_id, hc])
        if nm not in merged:
            rec = {
                "jk_name": nm,
                "address": ex["address"],
                "class": ex["class"],
                "district": ex["district"],
                "houses": matched_pairs,
                "lat": ex["lat"],
                "lon": ex["lon"],
            }
            if matched_pairs:
                h0 = st_houses[matched_pairs[0][1]]
                rec["lat"], rec["lon"] = h0[0], h0[1]
            merged[nm] = rec

    # Specific house backfills for famous JKs that had houses=[]
    MANUAL_HOUSE_LINKS = {
        "ЖК Журавлі": [(2027, "158")],  # Академіка Павлова
        "ЖК Конторський": [(2954, "15, корп. 1"), (2954, "15, корп. 2"), (2954, "10")],
        "ЖК NOW": [(3070, "20-Б")],
        "ЖК Аквамарин": [(2234, "4")],
    }
    for nm, pairs in MANUAL_HOUSE_LINKS.items():
        if nm in merged:
            rec = merged[nm]
            existing = {(h[0], h[1]) for h in rec["houses"]}
            for sid, hl in pairs:
                if str(sid) in houses_db and hl in houses_db[str(sid)] and (sid, hl) not in existing:
                    rec["houses"].append([sid, hl])
                    existing.add((sid, hl))
                    if not rec.get("lat"):
                        rec["lat"], rec["lon"] = houses_db[str(sid)][hl][0], houses_db[str(sid)][hl][1]

    # Apply CLASS_MAP and rebuild clean address string when multiple houses were merged
    out = []
    for nm, rec in merged.items():
        if not rec.get("class"):
            if nm in CLASS_MAP:
                rec["class"] = CLASS_MAP[nm]
            elif nm.startswith("КМ ") or nm.startswith("Таунхаус"):
                rec["class"] = "Комфорт"

        if rec["houses"]:
            addr_parts = []
            for sid, hl in rec["houses"]:
                st = streets_db.get(sid)
                if st:
                    part = f"{st['short_type']} {st['current_name']}, {hl}".strip()
                    if part not in addr_parts:
                        addr_parts.append(part)
            if addr_parts:
                rec["address"] = "; ".join(addr_parts)
            if not rec.get("lat"):
                sid0, hl0 = rec["houses"][0]
                h_arr = houses_db.get(str(sid0), {}).get(hl0)
                if h_arr:
                    rec["lat"], rec["lon"] = h_arr[0], h_arr[1]

        out.append(rec)

    out.sort(key=lambda x: x["jk_name"].lower())
    with open("data/complexes.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    with_class = sum(1 for x in out if x.get("class"))
    with_houses = sum(1 for x in out if x.get("houses"))
    print(f"Збережено {len(out)} ЖК (із класом: {with_class}/{len(out)}, із прив'язкою будинків: {with_houses}).")


if __name__ == "__main__":
    main()
