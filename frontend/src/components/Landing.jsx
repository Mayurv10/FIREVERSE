import React from 'react';
import './Landing.css';

function Landing({ onEnter }) {
  return (
    <div className="landing">
      <div className="hero">
        <img src="/src/assets/hero.png" alt="FIRERVERSE" className="hero-image" />
        <h1>FIRERVERSE</h1>
        <p className="tagline">Real‑time wildfire monitoring powered by NASA FIRMS data</p>
        <button className="enter-button" onClick={onEnter}>Enter Dashboard</button>
      </div>
    </div>
  );
}

export default React.memo(Landing);
