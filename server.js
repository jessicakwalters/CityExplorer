'use-strict'

require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/location', (req, res) => {
  res.send('working');
})

app.listen(PORT, () => {
  console.log('Listening on port: ' + PORT);
})
