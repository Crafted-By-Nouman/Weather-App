// API Configuration
const API_KEY = "4a95e70c9a696cdca8355375ea62cdd3"; // Replace with your actual API key
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
const AIR_QUALITY_URL = "https://api.openweathermap.org/data/2.5/air_pollution";

// DOM Elements
const searchInput = document.querySelector(".search-input");
const searchBtn = document.querySelector(".search-btn");
const searchHistoryDropdown = document.querySelector(
  ".search-history-dropdown"
);
const historyList = document.querySelector(".history-list");
const clearHistoryBtn = document.querySelector(".clear-history");
const themeToggle = document.querySelector(".theme-toggle");
const unitBtns = document.querySelectorAll(".unit-btn");
const hourlyScroll = document.querySelector(".hourly-scroll");
const hourlyList = document.querySelector(".hourly-list");
const dailyContainer = document.querySelector(".daily-container");
const scrollLeftBtn = document.querySelector(".scroll-btn.left");
const scrollRightBtn = document.querySelector(".scroll-btn.right");
const favoritesBar = document.querySelector(".favorites-bar");
const favoritesList = document.querySelector(".favorites-list");
const weatherAlert = document.querySelector(".weather-alert");
const alertCloseBtn = document.querySelector(".alert-close");
const errorModal = document.querySelector(".error-modal");
const modalBtn = document.querySelector(".modal-btn");
const preloader = document.querySelector(".preloader");
const container = document.querySelector(".container");

// App State
let currentUnit = "c";
let currentWeatherData = null;
let hourlyForecastData = null;
let dailyForecastData = null;
let airQualityData = null;
let searchHistory = JSON.parse(localStorage.getItem("searchHistory")) || [];
let favoriteCities = JSON.parse(localStorage.getItem("favoriteCities")) || [];

// Initialize the app
function init() {
  // Load saved theme preference
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", savedTheme);

  // Load saved unit preference
  const savedUnit = localStorage.getItem("unit") || "c";
  currentUnit = savedUnit;
  updateUnitButtons();

  // Load favorites
  renderFavorites();

  // Load search history
  renderSearchHistory();

  // Check geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoords(latitude, longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
        // Default to a popular city if geolocation fails
        fetchWeatherByCity("London");
      }
    );
  } else {
    // Default to a popular city if geolocation is not supported
    fetchWeatherByCity("London");
  }

  // Event Listeners
  searchBtn.addEventListener("click", handleSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });
  searchInput.addEventListener("focus", () => {
    if (searchHistory.length > 0) {
      searchHistoryDropdown.classList.add("show");
    }
  });
  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      searchHistoryDropdown.classList.remove("show");
    }, 200);
  });
  clearHistoryBtn.addEventListener("click", clearSearchHistory);
  themeToggle.addEventListener("click", toggleTheme);
  unitBtns.forEach((btn) => {
    btn.addEventListener("click", () => handleUnitChange(btn.dataset.unit));
  });
  scrollLeftBtn.addEventListener("click", () => {
    hourlyScroll.scrollBy({ left: -200, behavior: "smooth" });
  });
  scrollRightBtn.addEventListener("click", () => {
    hourlyScroll.scrollBy({ left: 200, behavior: "smooth" });
  });
  alertCloseBtn.addEventListener("click", () => {
    weatherAlert.classList.remove("show");
  });
  modalBtn.addEventListener("click", () => {
    errorModal.classList.remove("show");
    searchInput.focus();
  });

  // Hide preloader after 2 seconds (or when data loads)
  setTimeout(() => {
    preloader.classList.add("fade-out");
    container.classList.add("show");
  }, 2000);
}

// Fetch weather data by city name
async function fetchWeatherByCity(city) {
  try {
    // Show loading state
    searchInput.value = city;

    // First get coordinates for the city
    const geoResponse = await fetch(
      `${GEO_URL}?q=${city}&limit=1&appid=${API_KEY}`
    );
    const geoData = await geoResponse.json();

    if (!geoData || geoData.length === 0) {
      showErrorModal();
      return;
    }

    const { lat, lon, name, country } = geoData[0];

    // Fetch current weather, forecast, and air quality in parallel
    const [weatherRes, forecastRes, airQualityRes] = await Promise.all([
      fetch(
        `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
      ),
      fetch(
        `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
      ),
      fetch(`${AIR_QUALITY_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
    ]);

    const weatherData = await weatherRes.json();
    const forecastData = await forecastRes.json();
    const airData = await airQualityRes.json();

    if (weatherData.cod !== 200 || forecastData.cod !== "200") {
      showErrorModal();
      return;
    }

    // Process and store data
    currentWeatherData = processCurrentWeather(weatherData, name, country);
    hourlyForecastData = processHourlyForecast(forecastData);
    dailyForecastData = processDailyForecast(forecastData);
    airQualityData = processAirQuality(airData);

    // Update UI
    updateCurrentWeather();
    updateHourlyForecast();
    updateDailyForecast();
    updateAdditionalData();
    updateBackground();
    checkWeatherAlerts(weatherData);

    // Add to search history
    addToSearchHistory(city);

    // Show favorites bar if we have favorites
    if (favoriteCities.length > 0) {
      favoritesBar.classList.add("show");
    }
  } catch (error) {
    console.error("Error fetching weather data:", error);
    showErrorModal();
  }
}

// Fetch weather data by coordinates
async function fetchWeatherByCoords(lat, lon) {
  try {
    // Fetch current weather, forecast, and air quality in parallel
    const [weatherRes, forecastRes, airQualityRes, geoRes] = await Promise.all([
      fetch(
        `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
      ),
      fetch(
        `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
      ),
      fetch(`${AIR_QUALITY_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      fetch(`${GEO_URL}?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`),
    ]);

    const weatherData = await weatherRes.json();
    const forecastData = await forecastRes.json();
    const airData = await airQualityRes.json();
    const geoData = await geoRes.json();

    if (weatherData.cod !== 200 || forecastData.cod !== "200") {
      showErrorModal();
      return;
    }

    const city = geoData[0]?.name || "Current Location";
    const country = geoData[0]?.country || "";

    // Process and store data
    currentWeatherData = processCurrentWeather(weatherData, city, country);
    hourlyForecastData = processHourlyForecast(forecastData);
    dailyForecastData = processDailyForecast(forecastData);
    airQualityData = processAirQuality(airData);

    // Update UI
    updateCurrentWeather();
    updateHourlyForecast();
    updateDailyForecast();
    updateAdditionalData();
    updateBackground();
    checkWeatherAlerts(weatherData);

    // Add to search history
    addToSearchHistory(city);

    // Show favorites bar if we have favorites
    if (favoriteCities.length > 0) {
      favoritesBar.classList.add("show");
    }
  } catch (error) {
    console.error("Error fetching weather data:", error);
    showErrorModal();
  }
}

// Process current weather data
function processCurrentWeather(data, city, country) {
  return {
    city: city,
    country: country,
    temp: data.main.temp,
    feels_like: data.main.feels_like,
    humidity: data.main.humidity,
    pressure: data.main.pressure,
    wind_speed: data.wind.speed,
    wind_deg: data.wind.deg,
    visibility: data.visibility,
    weather: data.weather[0],
    sunrise: data.sys.sunrise,
    sunset: data.sys.sunset,
    dt: data.dt,
    timezone: data.timezone,
  };
}

// Process hourly forecast data
function processHourlyForecast(data) {
  // Get next 24 hours (3-hour intervals, so 8 data points)
  const hourlyData = data.list.slice(0, 8).map((item) => ({
    time: item.dt,
    temp: item.main.temp,
    icon: item.weather[0].icon,
    description: item.weather[0].description,
    pop: item.pop * 100, // Probability of precipitation (0-100)
    wind_speed: item.wind.speed,
  }));

  return hourlyData;
}

// Process daily forecast data
function processDailyForecast(data) {
  // Group by day (OpenWeatherMap provides 5-day forecast in 3-hour intervals)
  const dailyData = {};

  data.list.forEach((item) => {
    const date = new Date(item.dt * 1000);
    const dayKey = date.toLocaleDateString("en-US", { weekday: "long" });

    if (!dailyData[dayKey]) {
      dailyData[dayKey] = {
        minTemp: item.main.temp_min,
        maxTemp: item.main.temp_max,
        icon: item.weather[0].icon,
        description: item.weather[0].description,
        date: date,
      };
    } else {
      // Update min and max temps for the day
      if (item.main.temp_min < dailyData[dayKey].minTemp) {
        dailyData[dayKey].minTemp = item.main.temp_min;
      }
      if (item.main.temp_max > dailyData[dayKey].maxTemp) {
        dailyData[dayKey].maxTemp = item.main.temp_max;
      }
    }
  });

  // Convert to array and take next 7 days
  const days = Object.keys(dailyData);
  return days.slice(0, 7).map((day) => ({
    day,
    ...dailyData[day],
  }));
}

// Process air quality data
function processAirQuality(data) {
  const aqi = data.list[0].main.aqi;
  const components = data.list[0].components;

  // AQI descriptions
  const aqiLevels = [
    { level: 1, desc: "Good", color: "success" },
    { level: 2, desc: "Fair", color: "success" },
    { level: 3, desc: "Moderate", color: "warning" },
    { level: 4, desc: "Poor", color: "warning" },
    { level: 5, desc: "Very Poor", color: "danger" },
  ];

  return {
    aqi,
    description: aqiLevels[aqi - 1].desc,
    level: aqiLevels[aqi - 1].level,
    color: aqiLevels[aqi - 1].color,
    components,
  };
}

// Update current weather UI
function updateCurrentWeather() {
  if (!currentWeatherData) return;

  const {
    city,
    country,
    temp,
    feels_like,
    humidity,
    pressure,
    wind_speed,
    weather,
    visibility,
  } = currentWeatherData;

  // Location
  document.querySelector(".city-name").textContent = city;

  // Date and time
  const now = new Date();
  document.querySelector(".date").textContent = now.toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
    }
  );
  document.querySelector(".time").textContent = now.toLocaleTimeString(
    "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  // Weather icon and description
  const weatherIcon = document.querySelector(".weather-icon");
  weatherIcon.setAttribute("data-icon", weather.icon);
  document.querySelector(".weather-description").textContent =
    weather.description;

  // Temperature
  const tempValue =
    currentUnit === "c" ? Math.round(temp) : Math.round((temp * 9) / 5 + 32);
  document.querySelector(".temp-value").textContent = tempValue;

  // Feels like
  const feelsLikeValue =
    currentUnit === "c"
      ? Math.round(feels_like)
      : Math.round((feels_like * 9) / 5 + 32);
  document.querySelector(
    ".feels-like span"
  ).textContent = `${feelsLikeValue}°${currentUnit.toUpperCase()}`;

  // Details
  document.querySelector(".wind-speed").textContent = `${Math.round(
    wind_speed * 3.6
  )} km/h`; // Convert m/s to km/h
  document.querySelector(".humidity").textContent = `${humidity}%`;
  document.querySelector(".pressure").textContent = `${pressure} hPa`;
}

// Update hourly forecast UI
function updateHourlyForecast() {
  if (!hourlyForecastData) return;

  hourlyList.innerHTML = "";

  hourlyForecastData.forEach((hour) => {
    const hourElement = document.createElement("div");
    hourElement.className = "hourly-item fade-in";

    const time = new Date(hour.time * 1000);
    const hourString = time
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
      })
      .replace(" AM", "")
      .replace(" PM", "");

    const tempValue =
      currentUnit === "c"
        ? Math.round(hour.temp)
        : Math.round((hour.temp * 9) / 5 + 32);

    hourElement.innerHTML = `
            <div class="hourly-time">${hourString}</div>
            <div class="hourly-icon" data-icon="${hour.icon}"></div>
            <div class="hourly-temp">${tempValue}°</div>
        `;

    hourlyList.appendChild(hourElement);
  });
}

// Update daily forecast UI
function updateDailyForecast() {
  if (!dailyForecastData) return;

  dailyContainer.innerHTML = "";

  dailyForecastData.forEach((day) => {
    const dayElement = document.createElement("div");
    dayElement.className = "daily-item slide-in";

    const maxTemp =
      currentUnit === "c"
        ? Math.round(day.maxTemp)
        : Math.round((day.maxTemp * 9) / 5 + 32);
    const minTemp =
      currentUnit === "c"
        ? Math.round(day.minTemp)
        : Math.round((day.minTemp * 9) / 5 + 32);

    dayElement.innerHTML = `
            <div class="daily-day">${day.day}</div>
            <div class="daily-icon" data-icon="${day.icon}"></div>
            <div class="daily-temp">
                <span class="daily-high">${maxTemp}°</span>
                <span class="daily-low">${minTemp}°</span>
            </div>
        `;

    dailyContainer.appendChild(dayElement);
  });
}

// Update additional weather data UI
function updateAdditionalData() {
  if (!currentWeatherData || !airQualityData) return;

  const { sunrise, sunset, visibility } = currentWeatherData;

  // UV Index (simulated since OpenWeatherMap doesn't provide this in free tier)
  const uvIndex = Math.floor(Math.random() * 11); // Random UV index 0-10
  document.querySelector(".uv-value").textContent = uvIndex;

  // Update UV scale visualization
  document.querySelectorAll(".uv-level").forEach((level) => {
    const levelNum = parseInt(level.dataset.level);
    level.classList.toggle("active", levelNum <= Math.ceil(uvIndex / 2));
  });

  // UV description
  let uvDesc = "";
  if (uvIndex <= 2) uvDesc = "Low - No protection needed";
  else if (uvIndex <= 5) uvDesc = "Moderate - Stay in shade near midday";
  else if (uvIndex <= 7) uvDesc = "High - Wear sunscreen and hat";
  else if (uvIndex <= 10) uvDesc = "Very high - Extra protection needed";
  else uvDesc = "Extreme - Avoid being outside";

  document.querySelector(".uv-description").textContent = uvDesc;

  // Air Quality
  document.querySelector(".aqi-value").textContent = airQualityData.aqi;
  document.querySelector(".aqi-description").textContent =
    airQualityData.description;

  // Air quality components
  document.querySelector(".aqi-details").innerHTML = `
        <div class="aqi-detail">
            <span class="detail-name">PM2.5</span>
            <span class="detail-value">${airQualityData.components.pm2_5.toFixed(
              1
            )} µg/m³</span>
        </div>
        <div class="aqi-detail">
            <span class="detail-name">PM10</span>
            <span class="detail-value">${airQualityData.components.pm10.toFixed(
              1
            )} µg/m³</span>
        </div>
        <div class="aqi-detail">
            <span class="detail-name">O3</span>
            <span class="detail-value">${airQualityData.components.o3.toFixed(
              1
            )} µg/m³</span>
        </div>
    `;

  // Sunrise & Sunset
  const sunriseTime = new Date(sunrise * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sunsetTime = new Date(sunset * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  document.querySelector(".sunrise").textContent = sunriseTime;
  document.querySelector(".sunset").textContent = sunsetTime;

  // Moon Phase (simulated)
  const moonPhases = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ];
  const moonPhase = moonPhases[Math.floor(Math.random() * moonPhases.length)];
  const moonIllumination = Math.floor(Math.random() * 100) + 1;

  const moonIcon = document.querySelector(".moon-icon");
  moonIcon.setAttribute("data-phase", moonPhase);
  document.querySelector(".moon-phase-text").textContent = moonPhase;
  document.querySelector(
    ".moon-illumination"
  ).textContent = `${moonIllumination}% illuminated`;

  // Visibility
  const visibilityKm = (visibility / 1000).toFixed(1);
  document.querySelector(
    ".visibility-value"
  ).textContent = `${visibilityKm} km`;

  let visibilityDesc = "";
  if (visibility >= 10) visibilityDesc = "Excellent visibility";
  else if (visibility >= 5) visibilityDesc = "Good visibility";
  else if (visibility >= 1) visibilityDesc = "Moderate visibility";
  else visibilityDesc = "Poor visibility";

  document.querySelector(".visibility-description").textContent =
    visibilityDesc;
}

// Update background based on weather and time
function updateBackground() {
  if (!currentWeatherData) return;

  const { weather, sunrise, sunset } = currentWeatherData;
  const now = new Date().getTime() / 1000;

  // Determine if it's day or night
  const isDay = now > sunrise && now < sunset;

  // Clear weather background classes
  document.body.className = "";
  document.body.classList.add(isDay ? "weather-bg-day" : "weather-bg-night");

  // Add specific weather class
  const weatherMain = weather.main.toLowerCase();
  if (weatherMain.includes("rain")) {
    document.body.classList.add("weather-bg-rainy");
  } else if (weatherMain.includes("cloud")) {
    document.body.classList.add("weather-bg-cloudy");
  } else if (weatherMain.includes("snow")) {
    document.body.classList.add("weather-bg-snowy");
  } else if (weatherMain.includes("thunderstorm")) {
    document.body.classList.add("weather-bg-stormy");
  } else if (weatherMain.includes("clear")) {
    document.body.classList.add(
      isDay ? "weather-bg-sunny" : "weather-bg-night"
    );
  } else if (
    weatherMain.includes("mist") ||
    weatherMain.includes("fog") ||
    weatherMain.includes("haze")
  ) {
    document.body.classList.add("weather-bg-foggy");
  }
}

// Check for severe weather alerts
function checkWeatherAlerts(weatherData) {
  const { main, description } = weatherData.weather[0];

  let alertMessage = "";

  if (main === "Thunderstorm") {
    alertMessage = "Thunderstorm warning! Stay indoors if possible.";
  } else if (main === "Extreme") {
    alertMessage = "Extreme weather warning! Take necessary precautions.";
  } else if (weatherData.main.temp > 35) {
    // 35°C / 95°F
    alertMessage = "Heat wave warning! Stay hydrated and avoid sun exposure.";
  } else if (weatherData.main.temp < 0) {
    // 0°C / 32°F
    alertMessage = "Freezing temperatures! Dress warmly.";
  }

  if (alertMessage) {
    document.querySelector(".alert-message").textContent = alertMessage;
    weatherAlert.classList.add("show");
  }
}

// Handle search
function handleSearch() {
  const city = searchInput.value.trim();
  if (city) {
    fetchWeatherByCity(city);
    searchHistoryDropdown.classList.remove("show");
  }
}

// Add city to search history
function addToSearchHistory(city) {
  // Avoid duplicates
  if (searchHistory.includes(city)) {
    searchHistory = searchHistory.filter((item) => item !== city);
  }

  // Add to beginning of array
  searchHistory.unshift(city);

  // Keep only last 5 searches
  if (searchHistory.length > 5) {
    searchHistory = searchHistory.slice(0, 5);
  }

  // Save to localStorage
  localStorage.setItem("searchHistory", JSON.stringify(searchHistory));

  // Update UI
  renderSearchHistory();
}

// Render search history
function renderSearchHistory() {
  historyList.innerHTML = "";

  searchHistory.forEach((city) => {
    const li = document.createElement("li");
    li.textContent = city;
    li.addEventListener("click", () => {
      fetchWeatherByCity(city);
      searchInput.value = city;
      searchHistoryDropdown.classList.remove("show");
    });

    const deleteBtn = document.createElement("span");
    deleteBtn.className = "delete-history";
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      searchHistory = searchHistory.filter((item) => item !== city);
      localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
      renderSearchHistory();
    });

    li.appendChild(deleteBtn);
    historyList.appendChild(li);
  });
}

// Clear search history
function clearSearchHistory() {
  searchHistory = [];
  localStorage.removeItem("searchHistory");
  renderSearchHistory();
}

// Toggle theme (light/dark)
function toggleTheme() {
  const currentTheme = document.body.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  document.body.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
}

// Handle unit change (Celsius/Fahrenheit)
function handleUnitChange(unit) {
  if (unit === currentUnit) return;

  currentUnit = unit;
  localStorage.setItem("unit", unit);
  updateUnitButtons();

  // Update all temperature displays
  updateCurrentWeather();
  updateHourlyForecast();
  updateDailyForecast();
}

// Update active unit buttons
function updateUnitButtons() {
  unitBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.unit === currentUnit);
  });
}

// Render favorite cities
function renderFavorites() {
  favoritesList.innerHTML = "";

  favoriteCities.forEach((city) => {
    const favItem = document.createElement("div");
    favItem.className = "favorite-item";
    favItem.textContent = city;

    const removeBtn = document.createElement("span");
    removeBtn.className = "remove-favorite";
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromFavorites(city);
    });

    favItem.insertBefore(removeBtn, favItem.firstChild);

    favItem.addEventListener("click", () => {
      fetchWeatherByCity(city);
    });

    favoritesList.appendChild(favItem);
  });
}

// Add city to favorites
function addToFavorites(city) {
  if (!favoriteCities.includes(city)) {
    favoriteCities.push(city);
    localStorage.setItem("favoriteCities", JSON.stringify(favoriteCities));
    renderFavorites();
    favoritesBar.classList.add("show");
  }
}

// Remove city from favorites
function removeFromFavorites(city) {
  favoriteCities = favoriteCities.filter((item) => item !== city);
  localStorage.setItem("favoriteCities", JSON.stringify(favoriteCities));
  renderFavorites();

  if (favoriteCities.length === 0) {
    favoritesBar.classList.remove("show");
  }
}

// Show error modal
function showErrorModal() {
  errorModal.classList.add("show");
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
