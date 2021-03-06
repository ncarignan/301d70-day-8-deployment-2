'use strict';

// 1. Create db
// 2. add pg, the package
// 3. create the client variable and pass it the DATABASE_URL
// 3.5 create the .env variable for DATABASE_URL
// 4. conenct to the db
// 6. create the table
// 7. create a schema.sql file
// 8. run the schema.sql file with psql -d city_explorer_301d70 -f schema.sql
// 9. add to our route a check for if there is data in the db
// 10. check the table for the location

// ==== packages ====
const express = require('express');
require('dotenv').config();
const cors = require('cors');
const superagent = require('superagent'); // getting data from a url
const pg = require('pg');
pg.defaults.ssl=true;

// ==== setup the application (server) ====
const app = express();
app.use(cors());

const DATABASE_URL = process.env.DATABASE_URL;
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==== other global variables ====
const PORT = process.env.PORT || 3111;

// ==== Routes ====

app.get('/location', (req, res) => {
  const searchedCity = req.query.city;
  const key = process.env.LOCATION_API_KEY;

  // if it is in the db already, just use that
  const sqlQuery = 'SELECT * FROM location WHERE search_query=$1';
  const sqlArray = [searchedCity];


  client.query(sqlQuery, sqlArray)
    .then(result => {
      console.log('result.rows', result.rows);

      if(result.rows.length !== 0){
        console.log('it exists');
        res.send(result.rows[0]);

      } else {
        console.log('using superagent to get new data');
        if (req.query.city === 'newark') {
          res.status(500).send('ew newark');
          return;
        }
        // const theDataArrayFromTheLocationJson = require('./data/location.json');
        const url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${searchedCity}&format=json`;
        superagent.get(url)
          .then(result => {
            // console.log(result.body); // always check the body with superagent

            const theDataObjFromJson = result.body[0]; // since my data is identical, i just need to use the superagent data in place of the location.json file data

            const newLocation = new Location(
              searchedCity,
              theDataObjFromJson.display_name,
              theDataObjFromJson.lat,
              theDataObjFromJson.lon
            );

            // TODO: save the location to the database so that the next time someone searches, they can use it

            const sqlQuery = 'INSERT INTO location (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4)';
            const sqlArray = [newLocation.search_query, newLocation.formatted_query, newLocation.latitude, newLocation.longitude];

            client.query(sqlQuery, sqlArray);

            res.send(newLocation);
          })
          .catch(error => {
            res.status(500).send('locationiq failed');
            console.log(error.message);
          });

      }
    });

  // else go get it





});

app.get('/restaurants', (req, res) => {
  console.log(req.query);

  const latitude = req.query.latitude;
  const longitude = req.query.longitude;
  const apiKey = process.env.ZOMATO_API_KEY;

  const url = `https://developers.zomato.com/api/v2.1/geocode?lat=${latitude}&lng=${longitude}`;

  superagent.get(url)
    .set('user-key', apiKey) // is not necessary unless a doc says so (hint hint not necessary for weather)
    .then(dataThatComesBack => {
      console.log(dataThatComesBack.body);


      const arr = [];
      dataThatComesBack.body.nearby_restaurants.forEach(jsonObj => {
        const restaurant = new Restaurant(jsonObj);
        arr.push(restaurant);
      });

      res.send(arr);

    })
    .catch(error => {
      res.status(500).send('zomato failed');
      console.log(error.message);
    });

});

// ==== Helper Functions ====

function Location(search_query, formatted_query, latitude, longitude){
  this.search_query = search_query;
  this.formatted_query = formatted_query;
  this.longitude = longitude;
  this.latitude = latitude;
}

// arr[0] === jsonObj
function Restaurant(jsonObj){
  this.restaurant = jsonObj.restaurant.name;
  this.locality = jsonObj.restaurant.location.locality_verbose;
  this.cuisines = jsonObj.restaurant.cuisines;
}



// ==== Start the server ====
client.connect()
  .catch(err => console.log(err));
app.listen(PORT, () => console.log(`we are up on PORT ${PORT}`));

