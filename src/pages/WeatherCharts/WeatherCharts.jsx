import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chart, registerables } from 'chart.js';
import {
  Box, Button, Typography, CircularProgress, Card, CardContent,
  Alert, Avatar, TextField, Grid, Divider
} from "@mui/material";
import { WbSunny, Cloud, Thunderstorm, DateRange } from "@mui/icons-material";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import esLocale from 'date-fns/locale/es';

Chart.register(...registerables);

const GEO_API_KEY = import.meta.env.VITE_GEO_API_KEY;
const GEO_API_HOST = import.meta.env.VITE_GEO_API_HOST;
const WEATHER_API_URL = import.meta.env.VITE_WEATHER_API_URL;

const WeatherCharts = () => {
  const { cityId } = useParams();
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState(null);
  const [cityInfo, setCityInfo] = useState(null);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  });

  // Formatea fecha a YYYY-MM-DD
  const formatDate = (date) => date.toISOString().split('T')[0];

  useEffect(() => {
    let isMounted = true;

    const fetchCityInfo = async () => {
      try {
        const cachedCity = localStorage.getItem(`city_${cityId}`);
        if (cachedCity) {
          setCityInfo(JSON.parse(cachedCity));
          return JSON.parse(cachedCity);
        }
        const response = await fetch(
          `https://${GEO_API_HOST}/v1/geo/cities/${cityId}`,
          {
            headers: {
              "X-RapidAPI-Key": GEO_API_KEY,
              "X-RapidAPI-Host": GEO_API_HOST
            }
          }
        );
        if (!response.ok) throw new Error("Error al obtener datos de la ciudad");
        const data = await response.json();
        if (isMounted) {
          localStorage.setItem(`city_${cityId}`, JSON.stringify(data.data));
          setCityInfo(data.data);
        }
        return data.data;
      } catch (error) {
        if (isMounted) setError(error.message);
        return null;
      }
    };

    const fetchWeatherData = async (city) => {
      try {
        setLoading(true);
        const response = await fetch(
          `${WEATHER_API_URL}?latitude=${city.latitude}&longitude=${city.longitude}&current_weather=true&hourly=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&timezone=auto`
        );
        if (!response.ok) throw new Error("Error al obtener datos del clima");
        const data = await response.json();
        if (isMounted) {
          setForecast(data);
          setTimeout(() => createChart(data), 0);
        }
      } catch (error) {
        if (isMounted) setError(error.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const createChart = (weatherData) => {
      if (!weatherData || !chartRef.current) return;
      const ctx = chartRef.current.getContext('2d');
      if (chartRef.current.chartInstance) {
        chartRef.current.chartInstance.destroy();
      }
      // Filtrar datos por rango de fechas
      const filteredData = weatherData.hourly.time
        .map((time, index) => ({
          time: new Date(time),
          temperature: weatherData.hourly.temperature_2m[index]
        }))
        .filter(item => item.time >= startDate && item.time <= endDate);

      const labels = filteredData.map(item =>
        item.time.toLocaleString([], { day: '2-digit', hour: '2-digit', minute: '2-digit' })
      );
      const temperatures = filteredData.map(item => item.temperature);

      chartRef.current.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Temperatura (°C)',
            data: temperatures,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: true,
            backgroundColor: 'rgba(75, 192, 192, 0.2)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: {
              display: true,
              text: `Pronóstico de temperatura (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`
            }
          },
          scales: {
            x: { ticks: { maxTicksLimit: 8 } }
          }
        }
      });
    };

    fetchCityInfo().then(city => {
      if (city) fetchWeatherData(city);
    });

    return () => {
      if (chartRef.current && chartRef.current.chartInstance) {
        chartRef.current.chartInstance.destroy();
      }
    };
  }, [cityId, startDate, endDate]);

  const handleDateChange = (newStartDate, newEndDate) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const getWeatherIcon = (weathercode) => {
    if (weathercode >= 80) return <Thunderstorm color="error" fontSize="large" />;
    if (weathercode >= 51 || weathercode <= 3) return <Cloud color="info" fontSize="large" />;
    return <WbSunny color="warning" fontSize="large" />;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={esLocale}>
      <Box
        sx={{
          minHeight: 'calc(100vh - 64px - 56px)', // Ajusta según el alto de tu header y footer
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          p: 3,
        }}
      >
        <Button onClick={() => navigate(-1)} variant="contained" sx={{ mb: 3 }}>
          Volver
        </Button>

        <Grid container spacing={3}>
          {/* Clima actual a la izquierda */}
          <Grid item xs={12} md={4}>
            {cityInfo && forecast && (
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      src={`https://flagcdn.com/w40/${cityInfo.countryCode?.toLowerCase()}.png`}
                      alt={cityInfo.country}
                      sx={{ mr: 2 }}
                    />
                    <Box>
                      <Typography variant="h5">
                        {cityInfo.name}, {cityInfo.country}
                      </Typography>
                      <Typography variant="subtitle2" color="text.secondary">
                        {cityInfo.region}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {getWeatherIcon(forecast.current_weather.weathercode)}
                    <Typography variant="h2">
                      {forecast.current_weather.temperature}°C
                    </Typography>
                  </Box>
                  <Typography>
                    <strong>Viento:</strong> {forecast.current_weather.windspeed} km/h
                  </Typography>
                  <Typography>
                    <strong>Hora:</strong> {new Date(forecast.current_weather.time).toLocaleTimeString()}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  {/* Información extra de la ciudad */}
                  <Typography variant="body2">
                    <strong>Población:</strong> {cityInfo.population?.toLocaleString() || "N/A"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Latitud:</strong> {cityInfo.latitude}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Longitud:</strong> {cityInfo.longitude}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Selector de fechas, gráfico e info a la derecha */}
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <DatePicker
                    label="Fecha inicial"
                    value={startDate}
                    onChange={(newValue) => handleDateChange(newValue, endDate)}
                    maxDate={endDate}
                    renderInput={(params) => <TextField {...params} size="small" />}
                  />
                  <DatePicker
                    label="Fecha final"
                    value={endDate}
                    onChange={(newValue) => handleDateChange(startDate, newValue)}
                    minDate={startDate}
                    renderInput={(params) => <TextField {...params} size="small" />}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<DateRange />}
                    onClick={() => {
                      const today = new Date();
                      const nextWeek = new Date();
                      nextWeek.setDate(today.getDate() + 7);
                      handleDateChange(today, nextWeek);
                    }}
                  >
                    Restablecer
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Mensaje de carga o error */}
            {loading && !error && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress size={40} thickness={4} />
              </Box>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Gráfico */}
            {forecast && (
              <Box sx={{ mb: 4, height: 260 }}>
                <Typography variant="h6" gutterBottom>
                  Pronóstico de temperatura
                </Typography>
                <Box sx={{ height: 200 }}>
                  <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
                </Box>
              </Box>
            )}

            {/* Info de la ciudad si no hay gráfico */}
            {!forecast && cityInfo && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6">Información de la ciudad</Typography>
                  <Typography variant="body2">
                    <strong>Población:</strong> {cityInfo.population?.toLocaleString() || "N/A"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Latitud:</strong> {cityInfo.latitude}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Longitud:</strong> {cityInfo.longitude}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* Pronóstico diario */}
            {forecast && (
              <>
                <Typography variant="h6" gutterBottom>
                  Pronóstico diario ({startDate.toLocaleDateString()} - {endDate.toLocaleDateString()})
                </Typography>
                <Grid container spacing={2}>
                  {forecast.daily.time.map((day, index) => {
                    const dayDate = new Date(day);
                    if (dayDate >= startDate && dayDate <= endDate) {
                      return (
                        <Grid item xs={6} sm={4} md={3} key={day}>
                          <Card sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {dayDate.toLocaleDateString([], { weekday: 'short' })}
                            </Typography>
                            <Typography variant="body2">
                              {dayDate.toLocaleDateString()}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              {getWeatherIcon(forecast.daily.weathercode[index])}
                              <Box sx={{ ml: 1 }}>
                                <Typography variant="body2">
                                  ↑ {forecast.daily.temperature_2m_max[index]}°C
                                </Typography>
                                <Typography variant="body2">
                                  ↓ {forecast.daily.temperature_2m_min[index]}°C
                                </Typography>
                              </Box>
                            </Box>
                          </Card>
                        </Grid>
                      );
                    }
                    return null;
                  })}
                </Grid>
              </>
            )}
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default WeatherCharts;