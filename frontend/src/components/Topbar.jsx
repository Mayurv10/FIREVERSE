import React from 'react';
import { Flame, Share2 } from 'lucide-react';

function Topbar({ children }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-icon"><Flame size={22} /></div>
        <span>FIRERVERSE</span>
        <span className="brand-divider">/</span>
        <small>EARTH INTELLIGENCE</small>
      </div>

      <div className="top-links">
        <span>NASA EARTH DATA</span>
        <span className="top-separator">|</span>
        <span>MODIS</span>
        <span>VIIRS</span>
        <span className="top-separator">|</span>
        <button aria-label="Share dashboard"><Share2 size={15} /> Share</button>
      </div>

      {children && <div className="nav-links">{children}</div>}
    </header>
  );
}

export default React.memo(Topbar);
