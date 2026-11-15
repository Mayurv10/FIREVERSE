# FIREVERSE

**FIREVERSE** is a hackathon‑ready wildfire monitoring dashboard built with React, Vite, Leaflet, and a FastAPI backend that consumes NASA FIRMS data.

## Features
- Real‑time fire visualisation on an interactive map (markers, heatmap, clusters).
- Confidence and FRP filters with reset support.
- Weather overlay via OpenWeatherMap API.
- CSV export of filtered fire records (PDF export placeholder).
- Responsive layout for desktop and mobile.
- Attribution to NASA FIRMS data source.

## Project Structure
```
FIREVERSE/
├─ backend/                # FastAPI service
│   └─ app/main.py         # API entry point (serves FIRMS data)
├─ frontend/               # React Vite app
│   ├─ src/
│   │   ├─ components/    # UI components (Topbar, ControlBar, etc.)
│   │   ├─ services/      # API helper (fetchFires)
│   │   ├─ App.jsx
│   │   └─ index.html
│   └─ vite.config.js
├─ .gitignore              # Ignored files (node_modules, .env, build output)
├─ package.json            # Scripts and dependencies
└─ README.md               # This file
```

## Getting Started
### Prerequisites
- **Node.js** (v20+)
- **Python** (3.10+) with `uvicorn` and `fastapi`
- A **NASA FIRMS MAP_KEY** (store in a `.env` file – **do not commit**)
- (Optional) **OpenWeatherMap API key** for the weather panel.

### Setup Frontend
```bash
cd frontend
npm install               # install dependencies
npm run dev               # start dev server at http://localhost:5173
npm run build             # create production build in /dist
```
### Setup Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # on Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # API available at http://localhost:8000
```
The frontend fetches fire data from `http://127.0.0.1:8000/api/fires`.

## Deployment
1. Build the frontend (`npm run build`).
2. Deploy the `dist/` folder with any static‑file host (Netlify, Vercel, GitHub Pages, etc.).
3. Deploy the FastAPI backend on a cloud provider (Railway, Render, etc.) and set the `NASA_FIRMS_MAP_KEY` environment variable.

## License & Attribution
- Data: NASA FIRMS (VIIRS) – https://firms.modaps.eosdis.nasa.gov
- Code: MIT License (feel free to fork and improve).

---
*Prepared for the Space Apps Hackathon – ready for live demonstration.*
