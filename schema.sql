DROP TABLE IF EXISTS yelp;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS locations;

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  formatted_query VARCHAR(255),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7)
);

CREATE TABLE weathers (
  id SERIAL PRIMARY KEY,
  forecast VARCHAR(255),
  time VARCHAR(255),
  created_at BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  link VARCHAR(255),
  name VARCHAR(255),
  event_date VARCHAR(255),
  summary VARCHAR(255),
  created_at BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE movies ( 
    id SERIAL PRIMARY KEY, 
    title VARCHAR(255),
    overview VARCHAR(8000),
    average_votes DECIMAL(255, 5),
    total_votes INTEGER,
    image_url VARCHAR(255),
    popularity VARCHAR(255),
    released_on VARCHAR(255),
    created_at BIGINT,
    location_id INTEGER NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE yelp (
    id SERIAL PRIMARY KEY, 
    name VARCHAR(255),
    image_url VARCHAR(255),
    price VARCHAR(255),
    rating DECIMAL(255, 5),
    url VARCHAR(255),
    created_at BIGINT,
    location_id INTEGER NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (id)
);

