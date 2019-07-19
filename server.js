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

app.get('/events', getEvents);



// Error handler
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

//LOGIC

function searchToLatLong(request, response) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`

  return superagent.get(url)
    .then((result) => {
      const location = new Location(request.query.data, JSON.parse(result.text));
      response.send(location);
    })
    .catch((error) => {
      handleError(error);
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
      const weatherEntries = res.body.daily.data.map((day) => {
        return new Weather(day);
      })

      response.send(weatherEntries);
    })
    .catch((error) => {
      handleError(error);
    });
}

function Weather(day){
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0,15);
}

function getEvents(request, response) {
  const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.address=${request.query.data.formatted_query}`;

  return superagent.get(url)
    .then(res => {
      const eventEntries = res.body.events.map((event) => {
        return new Event(event);
      })

      response.send(eventEntries);
    })
    .catch( (error) => {
      handleError(error);
    });
}

function Event(event) {
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toString().slice(0, 15);
  this.summary = event.summary;
}

app.listen(PORT, () => {
  console.log('Listening on port: ' + PORT);
})
