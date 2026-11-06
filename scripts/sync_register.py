#!/usr/bin/env python3
"""
Синхронізація бази вулиць та будинків із офіційним API
«Єдиного адресного реєстру міста Харкова» (https://geo-portal.khmr.gov.ua/kharkiv/index.html).

Запуск:
    python scripts/sync_register.py
"""
import argparse
import json
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_API = "https://dev.geo-portal.com.ua/portal/api/v1/register/kharkiv"
HEADERS = {"User-Agent": "Mozilla/5.0", "token": "null"}


def fetch_json(path: str):
    for attempt in range(5):
        try:
            req = urllib.request.Request(BASE_API + path, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            if attempt == 4:
                raise
            time.sleep(0.5 * (attempt + 1))


def format_house_number(addr_num: str, block: str) -> str:
    num = re.sub(r"\s+", " ", (addr_num or "").strip())
    blk = re.sub(r"\s+", " ", (block or "").strip())
    if not blk:
        # Normalize inline "корпус № 17" -> "корп. 17"
        num = re.sub(r",?\s*корп(?:ус|\.)?\s*№?\s*", ", корп. ", num, flags=re.IGNORECASE)
        return num
    # Strip redundant prefixes from block like "№ 1" or "корп. 2"
    blk = re.sub(r"^(?:корп(?:ус|\.)?\s*)?№?\s*", "", blk, flags=re.IGNORECASE).strip()
    if not blk:
        return num
    return f"{num}, корп. {blk}"


def download_snapshot(workers: int = 25) -> dict:
    t0 = time.time()
    print("Завантаження метаданих та списку вулиць з Єдиного адресного реєстру м. Харкова...")
    info = fetch_json("")
    districts = fetch_json("/district")
    street_types = fetch_json("/streetype")
    streets = fetch_json("/street")
    print(f"Отримано записів вулиць у реєстрі: {len(streets)} ({time.time() - t0:.1f} с).")

    addresses_by_street = {}

    def get_street_addrs(st):
        sid = st["id"]
        return sid, fetch_json(f"/street/{sid}/address")

    print("Завантаження адрес будинків...")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(get_street_addrs, s): s["id"] for s in streets}
        done = 0
        for fut in as_completed(futures):
            _, addrs = fut.result()
            sid = futures[fut]
            if addrs:
                addresses_by_street[str(sid)] = addrs
            done += 1
            if done % 500 == 0 or done == len(streets):
                print(f"  Оброблено вулиць: {done}/{len(streets)} ({time.time() - t0:.1f} с)")

    return {
        "info": info,
        "districts": districts,
        "street_types": street_types,
        "streets": streets,
        "addresses_by_street": addresses_by_street,
    }


def clean_historical_name(name: str) -> str:
    # Clean disambiguators like "Кутузівська (сел. Циркуни)" -> keep clean or strip outer "(сел. ...)" if needed
    return re.sub(r"\s+", " ", (name or "").strip())


def build_datasets(raw: dict):
    raw_streets = raw["streets"]
    addrs_by_street = raw["addresses_by_street"]
    street_types = {t["id"]: t for t in raw.get("street_types", [])}
    by_id = {s["id"]: s for s in raw_streets}

    # Build bidirectional predecessor graph:
    # B has beforeIds=[A] => A is predecessor of B
    # A has afterIds=[B]  => A is predecessor of B
    preds = {s["id"]: [] for s in raw_streets}
    for s in raw_streets:
        sid = s["id"]
        for bid in (s.get("beforeIds") or []):
            if bid in by_id and bid not in preds[sid]:
                preds[sid].append(bid)
    for s in raw_streets:
        sid = s["id"]
        for aid in (s.get("afterIds") or []):
            if aid in preds and sid not in preds[aid]:
                preds[aid].append(sid)

    def collect_history_and_aliases(start_id: int, current_name: str):
        old_names = []
        aliases = []
        seen_names = {current_name.lower()}
        seen_aliases = {current_name.lower()}

        start_obj = by_id[start_id]
        if start_obj.get("aliasOne"):
            al = clean_historical_name(start_obj["aliasOne"])
            if al and al.lower() not in seen_aliases:
                aliases.append(al)
                seen_aliases.add(al.lower())

        visited = {start_id}
        queue = list(preds.get(start_id, []))
        while queue:
            cid = queue.pop(0)
            if cid in visited or cid not in by_id:
                continue
            visited.add(cid)
            cs = by_id[cid]
            nm = clean_historical_name(cs.get("name", ""))
            # Also extract clean version without "(сел. ...)" as alias if present
            nm_no_paren = re.sub(r"\s*\([^)]*\)\s*", " ", nm).strip()
            if nm and nm.lower() not in seen_names:
                old_names.append(nm_no_paren if nm_no_paren else nm)
                seen_names.add((nm_no_paren if nm_no_paren else nm).lower())
                seen_aliases.add(nm.lower())
                if nm_no_paren:
                    seen_aliases.add(nm_no_paren.lower())

            if cs.get("aliasOne"):
                al = clean_historical_name(cs["aliasOne"])
                if al and al.lower() not in seen_aliases:
                    aliases.append(al)
                    seen_aliases.add(al.lower())

            if cs.get("beforeText"):
                bt = clean_historical_name(cs["beforeText"])
                if bt and bt.lower() not in seen_names:
                    old_names.append(bt)
                    seen_names.add(bt.lower())

            for nxt in preds.get(cid, []):
                if nxt not in visited:
                    queue.append(nxt)

        # Deduplicate preserving order
        dedup_old = []
        s_old = {current_name.lower()}
        for x in old_names:
            if x.lower() not in s_old:
                dedup_old.append(x)
                s_old.add(x.lower())

        dedup_aliases = [a for a in aliases if a.lower() not in s_old]
        return dedup_old, dedup_aliases

    streets_out = []
    houses_out = {}

    for s in raw_streets:
        sid = s["id"]
        status = s.get("status")
        raw_addrs = addrs_by_street.get(str(sid), [])
        active_addrs = [a for a in raw_addrs if a.get("status") != 2]

        # Include all active streets (status != 2) AND any cancelled street without replacement that still holds active houses
        if status == 2 and not (active_addrs and not s.get("afterIds")):
            continue

        st_type_obj = street_types.get(s.get("typeId"), {})
        type_name = (s.get("typeName") or st_type_obj.get("typeName") or "").strip()
        short_type = (s.get("shortTypeName") or st_type_obj.get("shortTypeName") or "").strip()
        current_name = clean_historical_name(s.get("name", ""))

        old_names, aliases = collect_history_and_aliases(sid, current_name)

        # Build houses dict for this street: house_label -> [lat, lon, districtId, postCode]
        street_houses = {}
        district_set = set()
        for a in active_addrs:
            lat = a.get("latitude")
            lon = a.get("longitude")
            if not lat or not lon:
                continue
            label = format_house_number(a.get("addressNumber", ""), a.get("block", ""))
            if not label:
                continue
            dist_id = int(a.get("districtId") or 0)
            post_code = int(a.get("postCode") or 0)
            if dist_id:
                district_set.add(dist_id)
            street_houses[label] = [round(float(lat), 6), round(float(lon), 6), dist_id, post_code]

        if street_houses:
            houses_out[str(sid)] = street_houses

        top_lat = round(float(s.get("rightTopLatitude") or 0), 6)
        top_lon = round(float(s.get("rightTopLongitude") or 0), 6)
        bot_lat = round(float(s.get("leftBottomLatitude") or 0), 6)
        bot_lon = round(float(s.get("leftBottomLongitude") or 0), 6)

        # If bounds are missing/zero, compute from houses
        if (not top_lat or not top_lon) and street_houses:
            lats = [v[0] for v in street_houses.values()]
            lons = [v[1] for v in street_houses.values()]
            top_lat, bot_lat = max(lats), min(lats)
            top_lon, bot_lon = max(lons), min(lons)

        entry = {
            "street_id": sid,
            "type_name": type_name,
            "short_type": short_type,
            "current_name": current_name,
            "old_names": old_names,
            "map_bounds": {
                "top_lat": top_lat,
                "top_lon": top_lon,
                "bottom_lat": bot_lat,
                "bottom_lon": bot_lon,
            },
        }
        if aliases:
            entry["aliases"] = aliases
        if district_set:
            entry["districts"] = sorted(district_set)
        streets_out.append(entry)

    # Sort Ukrainian alphabetically (case-insensitive)
    streets_out.sort(key=lambda x: (x["current_name"].lower(), x["short_type"].lower()))
    return streets_out, houses_out


def main():
    parser = argparse.ArgumentParser(description="Sync Kharkiv Unified Address Register")
    parser.add_argument("--snapshot", help="Optional path to pre-downloaded raw_register.json")
    parser.add_argument("--out-dir", default="data", help="Output data directory (default: data)")
    args = parser.parse_args()

    if args.snapshot and os.path.exists(args.snapshot):
        print(f"Читання знімка реєстру з {args.snapshot}...")
        with open(args.snapshot, "r", encoding="utf-8") as f:
            raw = json.load(f)
    else:
        raw = download_snapshot()

    streets_out, houses_out = build_datasets(raw)
    os.makedirs(args.out_dir, exist_ok=True)

    streets_path = os.path.join(args.out_dir, "streets.json")
    houses_path = os.path.join(args.out_dir, "houses.json")

    with open(streets_path, "w", encoding="utf-8") as f:
        json.dump(streets_out, f, ensure_ascii=False, indent=2)

    # Compact JSON for houses.json to minimize network transfer size & speed up parsing
    with open(houses_path, "w", encoding="utf-8") as f:
        json.dump(houses_out, f, ensure_ascii=False, separators=(",", ":"))

    total_houses = sum(len(v) for v in houses_out.values())
    with_old = sum(1 for s in streets_out if s.get("old_names"))
    with_aliases = sum(1 for s in streets_out if s.get("aliases"))
    print(f"Успішно збережено:")
    print(f"  - {streets_path}: {len(streets_out)} вулиць (з колишніми назвами: {with_old}, з аліасами: {with_aliases})")
    print(f"  - {houses_path}: {total_houses} активних адрес на {len(houses_out)} вулицях")


if __name__ == "__main__":
    main()

