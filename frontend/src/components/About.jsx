import React from 'react';
import './About.css';

function About() {
  return (
    <section className="about">
      <h1>About FIRERVERSE</h1>
      <p>
        FIRERVERSE is a real‑time wildfire monitoring and intelligence dashboard built on NASA FIRMS satellite data (VIIRS NOAA‑21 NRT). It visualizes the full five‑day detection dataset, provides daily statistics, and lets users explore fire activity across the globe.
      </p>
      <p>
        The application uses a FastAPI backend to fetch and cache the NASA CSV, aggregates the data into a geographic grid for performant map rendering, and delivers a React/Leaflet front‑end with a dark theme that works on both desktop and mobile browsers.
      </p>
      <p>
        All data is sourced directly from NASA FIRMS; no synthetic or fabricated detections are shown. See the footer for attribution.
      </p>
    </section>
  );
}

export default React.memo(About);
