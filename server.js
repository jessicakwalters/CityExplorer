'use-strict'

//Load Environment Variables
require('dotenv').config();

//Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

//App SetUp
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

//database setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

//ROUTES
app.get('/location', (request, response) => {
  getLocation(request.query.data)
    .then(locationData => response.send(locationData))
    .catch(error => handleError(error, response));
});

app.get('/weather', getWeather);

app.get('/events', getEvents);

// Error handler
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

//LOGIC

function Location(query, data) {
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}


function getLocation(query) {

  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [query];

  return client.query(SQL, values)
    .then((result) => {
      if (result.rowCount > 0) {
        console.log('From SQL');
        return result.rows[0];
      } else {
        const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
        return superagent.get(_URL)

          .then(data => {
            console.log('FROM API');
            if (!data.body.results.length) { throw 'No Data'; }
            else {
              let location = new Location(query, data.body.results[0]);
              let NEWSQL = `INSERT INTO locations (search_query,formatted_query,latitude,longitude) VALUES($1,$2,$3,$4) RETURNING id`;
              let newValues = Object.values(location);
              return client.query(NEWSQL, newValues)
                .then(results => {
                  location.id = results.rows[0].id;
                  return location;
                })
                .catch(console.error);
            }
          });
      }
    })
    .catch(console.error);
}

// function searchToLatLong(request, response) {
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`

//   return superagent.get(url)
//     .then((result) => {
//       const location = new Location(request.query.data, JSON.parse(result.text));
//       response.send(location);
//     })
//     .catch((error) => {
//       handleError(error);
//     });
// }

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
