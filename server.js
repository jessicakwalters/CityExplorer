'use-strict'

require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

const PORT = process.env.PORT || 3000;

app.use(cors());


//ROUTES
app.get('/location', (req, res) => {
  const geoData = require('./data/geo.json');
  const location = new Location(req.query.data, geoData);
  res.send(location);
})

//LOGIC

function Location(query, geoData) {
  this.search_query = query;
  this.formatted_query = geoData.results[0].formatted_address;
  this.latitude = geoData.results[0].geometry.location.lat;
  this.longitude = geoData.results[0].geometry.location.lng;
}



app.listen(PORT, () => {
  console.log('Listening on port: ' + PORT);
})
