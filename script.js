let data = null;

const districtSelect = document.getElementById("districtSelect");
const streetInput = document.getElementById("streetInput");
const houseInput = document.getElementById("houseInput");
const streetSuggestions = document.getElementById("streetSuggestions");
const houseSuggestions = document.getElementById("houseSuggestions");
const microInput = document.getElementById("microInput");

// загрузка выбранного района
async function loadDistrict(file) {
  if (!file) {
    data = null;
    streetInput.disabled = true;
    houseInput.disabled = true;
    streetInput.value = "";
    houseInput.value = "";
    microInput.value = "";
    return;
  }

  try {
    const res = await fetch("districts/" + file);
    if (!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();

    streetInput.disabled = false;
    houseInput.disabled = false;
    streetInput.value = "";
    houseInput.value = "";
    microInput.value = "";

  } catch (err) {
    alert("Не вдалося завантажити файл districts/" + file);
    data = null;
  }
}

districtSelect.addEventListener("change", () => {
  loadDistrict(districtSelect.value);
});

// универсальная функция подсказок
function showSuggestions(input, list, values, callback) {
  const query = input.value.toLowerCase();
  list.innerHTML = "";
  if (!query) {
    list.classList.add("hidden");
    return;
  }

  const matches = values.filter(v => v.toLowerCase().includes(query)).slice(0, 5);
  if (matches.length === 0) {
    list.classList.add("hidden");
    return;
  }

  matches.forEach(match => {
    const div = document.createElement("div");
    div.textContent = match;
    div.onclick = () => {
      input.value = match;
      list.classList.add("hidden");
      if (callback) callback(match);
    };
    list.appendChild(div);
  });
  list.classList.remove("hidden");
}

// ======================
// Проверка улиц
// ======================
streetInput.addEventListener("input", () => {
  if (!data) return;

  const allStreets = [];
  for (const [microName, microData] of Object.entries(data.microdistricts)) {
    for (const streetName of Object.keys(microData.streets)) {
      if (!allStreets.includes(streetName)) {
        allStreets.push(streetName);
      }
    }
  }

  showSuggestions(streetInput, streetSuggestions, allStreets, () => {
    houseInput.value = "";
    microInput.value = "";
  });

  const street = streetInput.value.trim().toLowerCase();
  if (!allStreets.map(s => s.toLowerCase()).includes(street)) {
    houseInput.value = "";
    microInput.value = "";
  }
});

// Проверка при потере фокуса (улица)
streetInput.addEventListener("blur", () => {
  if (!data) return;

  const allStreets = [];
  for (const [microName, microData] of Object.entries(data.microdistricts)) {
    for (const streetName of Object.keys(microData.streets)) {
      if (!allStreets.includes(streetName)) {
        allStreets.push(streetName);
      }
    }
  }

  const street = streetInput.value.trim().toLowerCase();
  if (!allStreets.map(s => s.toLowerCase()).includes(street)) {
    streetInput.value = "";   // сброс неправильного ввода
    houseInput.value = "";
    microInput.value = "";
  }
});

// ======================
// Проверка домов
// ======================
houseInput.addEventListener("input", () => {
  if (!data) return;
  const street = streetInput.value.trim();
  const house = houseInput.value.trim();

  // если поле дома пустое → очищаем ориентир
  if (!house) {
    microInput.value = "";
    houseSuggestions.classList.add("hidden");
    return;
  }

  let houses = [];
  let foundMicro = "";
  for (const [microName, microData] of Object.entries(data.microdistricts)) {
    if (microData.streets[street]) {
      houses = microData.streets[street];
      foundMicro = microName;
    }
  }

  // показываем подсказки
  showSuggestions(houseInput, houseSuggestions, houses, (selectedHouse) => {
    microInput.value = foundMicro;
  });

  // если введено вручную → проверяем без регистра
  if (houses.map(h => h.toLowerCase()).includes(house.toLowerCase())) {
    microInput.value = foundMicro;
  } else {
    microInput.value = "";
  }
});

// Проверка при потере фокуса (дом)
houseInput.addEventListener("blur", () => {
  if (!data) return;
  const street = streetInput.value.trim();
  const house = houseInput.value.trim();

  if (!house) {
    microInput.value = "";
    return;
  }

  for (const [microName, microData] of Object.entries(data.microdistricts)) {
    if (microData.streets[street]) {
      if (microData.streets[street].map(h => h.toLowerCase()).includes(house.toLowerCase())) {
        microInput.value = microName;
        return;
      }
    }
  }

  microInput.value = "";
});

// ======================
// Скрывать подсказки при клике вне
// ======================
document.addEventListener("click", (e) => {
  if (!streetSuggestions.contains(e.target) && e.target !== streetInput) {
    streetSuggestions.classList.add("hidden");
  }
  if (!houseSuggestions.contains(e.target) && e.target !== houseInput) {
    houseSuggestions.classList.add("hidden");
  }
});
