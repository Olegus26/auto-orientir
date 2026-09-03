const NOM = 'https://nominatim.openstreetmap.org/search';
const H = { 'User-Agent': 'OrientirHKH/3.0', 'Accept-Language': 'uk' };

// Helpers for distance and parsing
const slp = ms => new Promise(r => setTimeout(r, ms));
function hav(a,b,c,d){const R=6371000,p1=a*Math.PI/180,p2=c*Math.PI/180,dp=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180;const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return Math.round(2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)))}
function gN(x){
  if(x.name&&x.name.length<80)return x.name;
  if(x.display_name){const p=x.display_name.split(',')[0].trim();if(p.length>1&&p.length<80)return p}
  return null;
}
function gT(x){
  const cl=x.class||'',tp=x.type||'',n=(x.name||x.display_name||'').toLowerCase();
  if(cl==='place' && (tp==='suburb'||tp==='neighbourhood'||tp==='quarter')) return 'ngb';
  if(cl==='railway' && (tp==='subway_entrance'||tp==='station')) return 'metro';
  if(cl==='amenity' && tp==='subway_entrance') return 'metro';
  if(cl==='leisure' && (tp==='park'||tp==='garden')) return 'prk';
  if(/метро|subway|підземк/.test(n))return 'metro';
  if(/парк|сквер|сад/.test(n))return 'prk';
  if(/мікрорайон|мкр/.test(n))return 'ngb';
  return 'oth';
}

document.addEventListener('DOMContentLoaded', () => {
    const streetInput = document.getElementById('street');
    const houseNumberInput = document.getElementById('house_number');
    const landmarkInput = document.getElementById('landmark');
    const metroInput = document.getElementById('metro');
    const drop = document.getElementById('SD');
    
    // --- 0. Map Initialization ---
    let map = L.map('map').setView([49.9935, 36.2304], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    let marker = null;

    let streetsData = [];
    fetch('streets_sorted_ua.json')
      .then(r => r.json())
      .then(d => { 
          streetsData = d.map(s => ({
              ...s,
              _lowerFull: s.full ? s.full.toLowerCase() : ''
          })); 
      })
      .catch(e => console.error('Помилка завантаження вулиць:', e));

    let districtPolygons = null;
    fetch('data/districts_polygons.json')
      .then(r => r.json())
      .then(d => { districtPolygons = d; })
      .catch(e => console.error('Помилка завантаження полігонів:', e));

    // --- 1. Street Autocomplete ---
    function sugg(val){
      const lowerVal = val.toLowerCase();
      const matches = streetsData.filter(s => 
          (s.search_key && s.search_key.includes(lowerVal)) || 
          (s._lowerFull && s._lowerFull.includes(lowerVal))
      ).slice(0, 10);

      drop.classList.add('open');
      
      if(!matches.length){
          drop.innerHTML='<div class="dmsg">😕 Не знайдено</div>';
          return;
      }
      
      drop.innerHTML='';
      matches.forEach(it => {
        const el=document.createElement('div');el.className='di';el.tabIndex=0;
        el.innerHTML='<div><div class="di-n">'+it.full+'</div></div>';
        const pick=()=>{streetInput.value=it.full; cD(); houseNumberInput.focus();};
        el.onclick=pick; 
        el.onkeydown=e=>{
            if(e.key==='Enter') pick();
            if(e.key==='ArrowDown') { e.preventDefault(); const next = el.nextElementSibling; if(next) next.focus(); }
            if(e.key==='ArrowUp') { e.preventDefault(); const prev = el.previousElementSibling; if(prev) prev.focus(); else streetInput.focus(); }
        };
        drop.appendChild(el);
      });
    }

    function cD(){drop.classList.remove('open');}

    streetInput.addEventListener('input', e => {
      const v = e.target.value.trim();
      if(v.length < 2) { cD(); return; }
      sugg(v);
    });

    streetInput.addEventListener('keydown', e => {
      if(e.key==='Escape') cD();
      if(e.key==='Enter') { cD(); houseNumberInput.focus(); }
      if(e.key==='ArrowDown') { 
          e.preventDefault();
          const f=document.querySelector('#SD .di'); 
          f&&f.focus(); 
      }
    });

    document.addEventListener('click', e => { if(!e.target.closest('#AW')) cD(); });

    // --- 2. Auto-fetch Landmarks on House Number Blur ---
    houseNumberInput.addEventListener('blur', async () => {
        const s = streetInput.value.trim();
        const h = houseNumberInput.value.trim();
        
        if(s.length > 2 && h.length > 0) {
            metroInput.value = 'Пошук...';
            landmarkInput.value = 'Пошук...';
            
            try {
                // Geocode Address
                const geoUrl = NOM+'?'+new URLSearchParams({
                    q:s+' '+h+', Харків',format:'json',limit:1,addressdetails:1,countrycodes:'ua','accept-language':'uk'
                });
                const rGeo = await fetch(geoUrl, {headers:H});
                const dGeo = await rGeo.json();
                if(!dGeo.length) throw new Error('Адреса не знайдена');
                
                const lat = parseFloat(dGeo[0].lat);
                const lon = parseFloat(dGeo[0].lon);

                // Update Map
                map.setView([lat, lon], 16);
                if (marker) {
                    marker.setLatLng([lat, lon]);
                } else {
                    marker = L.marker([lat, lon]).addTo(map);
                }

                // Check Polygon for District
                if (districtPolygons && window.turf) {
                    const pt = turf.point([lon, lat]);
                    for (const [distName, geom] of Object.entries(districtPolygons)) {
                        try {
                            const poly = geom.type === 'MultiPolygon' ? turf.multiPolygon(geom.coordinates) : turf.polygon(geom.coordinates);
                            if (turf.booleanPointInPolygon(pt, poly)) {
                                if (districtSelect.value !== distName) {
                                    districtSelect.value = distName;
                                    districtSelect.dispatchEvent(new Event('change'));
                                }
                                break;
                            }
                        } catch (e) {
                            console.error('Error checking polygon for', distName, e);
                        }
                    }
                }

                // Fetch Landmarks 
                const D = 0.014;
                const vb = `${lon-D},${lat+D},${lon+D},${lat-D}`;
                const B = {format:'json',addressdetails:1,bounded:1,viewbox:vb,countrycodes:'ua','accept-language':'uk'};
                
                const Q = [
                    {...B,amenity:'subway_entrance',limit:10}, 
                    {...B,q:'парк',limit:8},
                    {...B,place:'neighbourhood',limit:5}
                ];

                let allItems = [];
                for(let i=0; i<Q.length; i++){
                    try {
                        const res = await fetch(NOM+'?'+new URLSearchParams(Q[i]),{headers:H});
                        if(res.ok) { const d = await res.json(); allItems.push(...d); }
                    } catch(e) {}
                    await slp(1000); // 1000ms delay to respect Nominatim policy
                }

                // Reverse geocode for microraion
                try {
                    const revR = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=uk`, {headers:H});
                    const dRev = await revR.json();
                    const hood = dRev.address?.residential || dRev.address?.neighbourhood || dRev.address?.suburb;
                    if(hood) {
                        allItems.push({name:hood, lat:String(lat), lon:String(lon), class:'place', type:'neighbourhood', _R:true});
                    }
                } catch(e) {}

                // Filter and sort by distance
                const sorted = [
                    ...allItems.filter(x=>x._R),
                    ...allItems.filter(x=>!x._R).sort((a,b)=>hav(lat,lon,parseFloat(a.lat),parseFloat(a.lon))-hav(lat,lon,parseFloat(b.lat),parseFloat(b.lon)))
                ];

                let metros = [];
                let orientirs = [];
                let seen = new Set();

                for(let x of sorted) {
                    const n = gN(x);
                    if(!n) continue;
                    const type = gT(x);
                    
                    if(!['metro', 'ngb', 'prk'].includes(type)) continue;

                    // Exclude fake matches
                    if(type === 'prk' && !/парк|сквер|сад/i.test(n)) continue;
                    if(type === 'metro' && !/метро|subway/i.test(n) && x.class !== 'railway') continue;

                    const k = (n + type).toLowerCase();
                    if(seen.has(k)) continue;
                    seen.add(k);

                    if(type === 'metro') {
                        metros.push(n);
                    } else {
                        orientirs.push(n);
                    }
                }

                metroInput.value = metros.length > 0 ? metros[0] : 'Нет';
                landmarkInput.value = orientirs.length > 0 ? orientirs.slice(0, 3).join(', ') : 'Нет';

            } catch (error) {
                metroInput.value = 'Помилка';
                landmarkInput.value = 'Помилка';
            }
        } else if (h.length === 0) {
            metroInput.value = '';
            landmarkInput.value = '';
            if (marker) {
                map.removeLayer(marker);
                marker = null;
            }
        }
    });

    // --- 3. Районы и ЖК ---
    const DISTRICTS = {
      "Індустріальний р-н": "industrialnyi.json",
      "Київський р-н": "kyivskyi.json",
      "Немишлянський р-н": "nemyshlianskyi.json",
      "Новобаварський р-н": "novobavarskyi.json",
      "Основ'янський р-н": "osnovianskyi.json",
      "Салтівський р-н": "saltivskyi.json",
      "Слобідський р-н": "slobidskyi.json",
      "Холодногірський р-н": "kholodnohirskyi.json",
      "Шевченківський р-н": "shevchenkivskyi.json",
      "Без району": "unknown.json",
    };

    const districtSelect = document.getElementById("district");
    const complexSelect  = document.getElementById("complex");
    
    const districtToNamesCache = new Map();
    let nameToDistrictMap = null;
    let silent = false;

    function resetComplexSelect() {
      if (!complexSelect) return;
      complexSelect.innerHTML = "";
      complexSelect.append(new Option("Все", "all"));
      complexSelect.append(new Option("Нет", "none"));
    }

    function fillDistricts() {
      if (!districtSelect) return;
      const names = Object.keys(DISTRICTS).sort((a,b)=>a.localeCompare(b, "uk"));
      for (const name of names) districtSelect.append(new Option(name, name));
    }

    async function loadDistrictNames(filename) {
      if (districtToNamesCache.has(filename)) return districtToNamesCache.get(filename);

      const url = `./data/${filename}`;
      try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
              console.warn(`Не удалось загрузить ${url}`);
              return [];
          }
          const data = await res.json();
          const names = [...new Set(
            (Array.isArray(data) ? data : [])
              .map(x => (x && x.name ? String(x.name).trim() : ""))
              .filter(Boolean)
          )].sort((a,b)=>a.localeCompare(b, "ru"));

          districtToNamesCache.set(filename, names);
          return names;
      } catch (e) {
          console.error(e);
          return [];
      }
    }

    async function buildNameToDistrictMap() {
      if (nameToDistrictMap) return nameToDistrictMap;

      const map = new Map();
      for (const [districtName, filename] of Object.entries(DISTRICTS)) {
        const names = await loadDistrictNames(filename);
        for (const n of names) {
          if (!map.has(n)) map.set(n, districtName);
        }
      }

      nameToDistrictMap = map;
      return map;
    }

    async function applyDistrict(districtName, keepValue = null) {
      resetComplexSelect();

      if (!districtName) {
        complexSelect.disabled = true;
        return;
      }

      const filename = DISTRICTS[districtName];
      if (!filename) {
        complexSelect.disabled = true;
        return;
      }

      complexSelect.disabled = true;
      const names = await loadDistrictNames(filename);

      for (const n of names) complexSelect.append(new Option(n, n));

      complexSelect.disabled = false;

      if (keepValue && [...complexSelect.options].some(o => o.value === keepValue)) {
        complexSelect.value = keepValue;
      } else if (keepValue && keepValue !== "all" && keepValue !== "none") {
        complexSelect.value = "all";
      }
    }

    async function fillComplexAll() {
      resetComplexSelect();
      if (!complexSelect) return;
      complexSelect.disabled = true;

      const map = await buildNameToDistrictMap();
      const allNames = Array.from(map.keys()).sort((a,b)=>a.localeCompare(b,"ru"));

      for (const n of allNames) complexSelect.append(new Option(n, n));

      complexSelect.disabled = false;
    }

    if (districtSelect) {
        districtSelect.addEventListener("change", async () => {
          if (silent) return;
          const districtName = districtSelect.value;
          try {
            if (districtName) {
              await applyDistrict(districtName, complexSelect.value);
            } else {
              await fillComplexAll();
            }
          } catch (e) {
            console.error(e);
            complexSelect.disabled = true;
          }
        });
    }

    if (complexSelect) {
        complexSelect.addEventListener("change", async () => {
          if (silent) return;
          const selected = complexSelect.value;
          if (selected === "all" || selected === "none") return;

          try {
            const map = await buildNameToDistrictMap();
            const districtName = map.get(selected);

            if (!districtName) return;

            silent = true;
            districtSelect.value = districtName;
            silent = false;

            await applyDistrict(districtName, selected);
          } catch (e) {
            console.error(e);
          }
        });
    }

    (async function init() {
      fillDistricts();
      await fillComplexAll();
    })();
});
