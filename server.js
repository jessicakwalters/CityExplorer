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
client.on('error', (err) => {
  console.error(err)
});

//ROUTES
// app.get('/location', (request, response) => {
//   getLocation(request.query.data)
//     .then(locationData => response.send(locationData))
//     .catch(error => handleError(error, response));
// });
app.get('/location', getLocation);

app.get('/weather', getWeather);

app.get('/events', getEvents);

app.get('/movies', getMovies);

// Error handler
function handleError(err, res) {
  console.error(err);
  if(res) {
    return res.status(500).send('Sorry, something went wrong');
  }
}

// Check the DB for Info
function lookup(options) {
  //SQL Query match on location id
  console.log(options.tableName);
  const SQL = `SELECT * FROM ${options.tableName} WHERE location_id=$1;`;
  //grab big option object - look for location property
  const values = [options.location];
  //query the DB
  client.query(SQL, values)
    .then( (result) => {
      //if the result has at least one row
      if (result.rowCount > 0) {
        //then there's something there
        options.cacheHit(result);
      } else {
        //if not, then we need to hit the API
        options.cacheMiss();
      }
    })
    .catch( (error) => {
      return handleError(error);
    });
}

// Delete something from the DB
function deleteByLocationId(table, city) {
  //sql query to delete from DB by location id
  const SQL = `DELETE from ${table} WHERE location_id=${city};`;
  return client.query(SQL);
}
//set timeout vars so that we know when to reset the db
const timeouts = {
  weathers: 15 * 1000
}

// Models
function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
}

Location.tableName = 'locations';

Location.lookupLocation = (location) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [location.query];
  //check the db for the value in the first slot in the values array
  return client.query(SQL, values)
    .then( (result) => {
      //if we get back rows >0 then we know there's something there and can render the results
      if (result.rowCount > 0) {
        location.cacheHit(result);
        //if there's nothing there, we need to hit the api
      } else {
        location.cacheMiss();
      }
      console.log('lookuplocation end');
    })
    .catch( (error) => {
      return handleError(error);
    });

};

//don't use an arrow function here cause we'll need THIS
Location.prototype.save = function () {
  //insert the new location into the db passing the 4 array columns in order to the table
  const SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id;`;

  const values = [this.search_query, this.formatted_query, this.latitude, this.longitude];

  return client.query(SQL, values)
    .then( (result) => {
      //set the id on the location object to be the db id
      this.id = result.rows[0].id;
      return this;
    }).catch( (error) => {
      return handleError(error);
    });
};

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.created_at = Date.now();
}
Weather.tableName = 'weathers';
Weather.lookup = lookup;
Weather.deleteByLocationId = deleteByLocationId;

Weather.prototype.save = function (location_id) {
  
  const SQL = `INSERT INTO ${Weather.tableName} (forecast, time, created_at, location_id) VALUES ($1, $2, $3, $4);`;

  const values = [this.forecast, this.time, this.created_at, location_id];

  client.query(SQL, values);
};

function Event(event) {
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toString().slice(0, 15);
  this.summary = event.summary;
}

Event.lookup = lookup;
Event.tableName = 'events';

Event.prototype.save = function (location_id) {

  const SQL = `INSERT INTO ${Event.tableName} (link, name, event_date, summary, location_id) VALUES ($1, $2, $3, $4, $5);`;

  const values = [this.link, this.name, this.event_date, this.summary, location_id];

  client.query(SQL, values);
};

function getLocation(request, response) {
  Location.lookupLocation({

    tableName: Location.tableName,

    query: request.query.data,

    cacheHit: function (result) {
      response.send(result.rows[0]);
    },

    cacheMiss: function () {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GEOCODE_API_KEY}`;

      return superagent.get(url)
        .then( (result) => {
          const location = new Location(this.query, result);
          console.log(result);
          location.save()
            .then((location) => response.send(location))
            .catch(err => console.error(err));
        })
        .catch( (error) => {
          return handleError(error);
        });
    }
  });
}

function getWeather(request, response) {

  Weather.lookup({
    tableName: Weather.tableName,

    location: request.query.data.id,

    // check created_at values for timeout
    cacheHit: function (result) {

      let ageOfResults = (Date.now() - result.rows[0].created_at);

      if (ageOfResults > timeouts.weathers) {
        console.log('Old weather data for location: ', request.query.data.search_query);
        Weather.deleteByLocationId(Weather.tableName, request.query.data.id);

        this.cacheMiss();
      } else {
        response.send(result.rows);
      }
    },

    cacheMiss: function () {

      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

      superagent.get(url)
        .then( (result) => {

          const weatherSummaries = result.body.daily.data.map(day => {

            const summary = new Weather(day);
            summary.save(request.query.data.id);
            return summary;
          });
          response.send(weatherSummaries);
        })
        .catch((error) => {
          return handleError(error, response);
        });
    }
  });
}

function getEvents(request, response) {
  Event.lookup({
    tableName: Event.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      response.send(result.rows);
    },

    cacheMiss: function () {
      const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.address=${request.query.data.formatted_query}`;

      superagent.get(url)

        .then( (result) => {
          const events = result.body.events.map(eventData => {

            const event = new Event(eventData);
            event.save(request.query.data.id);
            return event;
          });

          response.send(events);
        })
        .catch((error) => {
          return handleError(error, response);
        });
    }
  });
}

function getMovies(request, response) {
  console.log('Movies: ' + request.query.data.formatted_query);

  Movie.lookup({
    tableName: Movie.tableName,

    location: request.query.data.id,

    cacheHit: function (result) {
      response.send(result.rows);
    },

    cacheMiss: function () {
      const stringQuery = request.query.data.formatted_query.slice(0, request.query.data.formatted_query.indexOf(','));

      const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${stringQuery}`;

      superagent.get(url)

        .then( (result) => {
          const movieEntries = result.body.results.map(movieData => {

            const movie = new Movie(movieData);
            movie.save(request.query.data.id);
            return movie;
          });

          response.send(movieEntries);
        })
        .catch((error) => {
          return handleError(error, response);
        });
    }
  });
}

function Movie(movieObj) {
  this.title = movieObj.title;
  this.overview = movieObj.overview;
  this.average_votes = movieObj.vote_average;
  this.total_votes = movieObj.vote_count;
  this.image_url = 'https://image.tmdb.org/t/p/w185_and_h278_bestv2/'+ movieObj.poster_path;
  this.popularity = movieObj.popularity;
  this.released_on = movieObj.release_date;
}
Movie.tableName = 'movies';

Movie.prototype.save = function (location_id) {

  const SQL = `INSERT INTO ${Movie.tableName} (title, overview, average_votes, image_url, popularity, released_on, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7);`;

  const values = [this.title, this.overview, this.average_votes, this.image_url, this.popularity, this.released_on, location_id];

  client.query(SQL, values);
};

Movie.lookup = lookup;

app.listen(PORT, () => {
  console.log('Listening on port: ' + PORT);
})

//+-----------------+
//  PRIOR LOGIC
//+-----------------+
// //LOGIC

// function Location(query, data) {
//   this.search_query = query;
//   this.formatted_query = data.formatted_address;
//   this.latitude = data.geometry.location.lat;
//   this.longitude = data.geometry.location.lng;
// }


// function getLocation(query) {

//   const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
//   const values = [query];

//   return client.query(SQL, values)
//     .then((result) => {
//       if (result.rowCount > 0) {
//         console.log('From SQL');
//         return result.rows[0];
//       } else {
//         const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
//         return superagent.get(_URL)

//           .then(data => {
//             console.log('FROM API');
//             if (!data.body.results.length) { throw 'No Data'; }
//             else {
//               let location = new Location(query, data.body.results[0]);
//               let NEWSQL = `INSERT INTO locations (search_query,formatted_query,latitude,longitude) VALUES($1,$2,$3,$4) RETURNING id`;
//               let newValues = Object.values(location);
//               return client.query(NEWSQL, newValues)
//                 .then(results => {
//                   location.id = results.rows[0].id;
//                   return location;
//                 })
//                 .catch(console.error);
//             }
//           });
//       }
//     })
//     .catch(console.error);
// }

// // function searchToLatLong(request, response) {
// //   const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`

// //   return superagent.get(url)
// //     .then((result) => {
// //       const location = new Location(request.query.data, JSON.parse(result.text));
// //       response.send(location);
// //     })
// //     .catch((error) => {
// //       handleError(error);
// //     });
// // }

// function getWeather(request, response) {
//   const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`

//   return superagent.get(url)
//     .then(res => {
//       const weatherEntries = res.body.daily.data.map((day) => {
//         return new Weather(day);
//       })

//       response.send(weatherEntries);
//     })
//     .catch((error) => {
//       handleError(error);
//     });
// }

// function Weather(day){
//   this.forecast = day.summary;
//   this.time = new Date(day.time * 1000).toString().slice(0,15);
// }

// function getEvents(request, response) {
//   const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.address=${request.query.data.formatted_query}`;

//   return superagent.get(url)
//     .then(res => {
//       const eventEntries = res.body.events.map((event) => {
//         return new Event(event);
//       })

//       response.send(eventEntries);
//     })
//     .catch( (error) => {
//       handleError(error);
//     });
// }

// function Event(event) {
//   this.link = event.url;
//   this.name = event.name.text;
//   this.event_date = new Date(event.start.local).toString().slice(0, 15);
//   this.summary = event.summary;
// }

// app.listen(PORT, () => {
//   console.log('Listening on port: ' + PORT);
// })
