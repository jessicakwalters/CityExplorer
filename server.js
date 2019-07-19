'use-strict'

require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

const PORT = process.env.PORT || 3000;

app.use(cors());


//ROUTES
app.get('/location', (req, res) => {
  try {
    const locationData = searchToLatLong(req.query.data);
    res.send(locationData);
  } catch (error) {
    console.log(error);
    response.status(500).send('Status: 500. Something is broken.');
  }
});

app.get('/weather', (req, res) => {
  try {
    const weatherData = getWeather();
    res.send(weatherData);
  } catch (error) {
    console.log(error);
    response.status(500).send('Status: 500. Something is broken.');
  }
});

//LOGIC

function searchToLatLong(query) {
  const geoData = require('./data/geo.json');
  const location = new Location(query, geoData);
  return location;
}

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.results[0].formatted_address;
  this.latitude = res.results[0].geometry.location.lat;
  this.longitude = res.results[0].geometry.location.lng;
}

function getWeather(){
  const darksyData = require('./data/darksky.json');

  const weatherSummaries = [];

  darksyData.daily.data.forEach( (day) => {
    weatherSummaries.push(new Weather(day));
  });

  return weatherSummaries;
}

function Weather(day){
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0,15);
}

app.listen(PORT, () => {
  console.log('Listening on port: ' + PORT);
})
