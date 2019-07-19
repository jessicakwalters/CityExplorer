'use-strict'

//Load Environment Variables
require('dotenv').config();

//Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent')

//App SetUp
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());


//ROUTES
app.get('/location', searchToLatLong);

app.get('/weather', getWeather);

//LOGIC

function searchToLatLong(request, response) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`

  return superagent.get(url)
    .then((result) => {
      const location = new Location(request.query.data, JSON.parse(result.text));
      response.send(location);
    })
    .catch((error) => {
      response.send(error);
    });
}

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.results[0].formatted_address;
  this.latitude = res.results[0].geometry.location.lat;
  this.longitude = res.results[0].geometry.location.lng;
}

function getWeather(request, response) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`

  return superagent.get(url)
    .then(res => {
      const weatherEntries = res.body.daily.data.map(day => {
        return new Weather(day);
      })

      response.send(weatherEntries);
    })
    .catch(error => {
      response.send(error);
    });
}

function Weather(day){
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0,15);
}

app.listen(PORT, () => {
  console.log('Listening on port: ' + PORT);
})
