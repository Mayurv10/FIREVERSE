
import os
import time
import asyncio
from io import StringIO

import httpx
import pandas as pd

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


# ==========================================
# ENVIRONMENT CONFIGURATION
# ==========================================

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path)
load_dotenv()

FIRMS_MAP_KEY = os.getenv("NASA_FIRMS_MAP_KEY")

FIRMS_BASE_URL = (
    "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
)

SOURCE = "VIIRS_NOAA21_NRT"
AREA = "world"

CACHE_DURATION = 300  # 5 minutes

MAX_MAP_RECORDS = 5000

SNAPSHOT_PATH = os.path.join(
    os.path.dirname(__file__), "data", "nasa_firms_viirs_5day_snapshot.csv"
)


# ==========================================
# FASTAPI INITIALIZATION
# ==========================================

app = FastAPI(
    title="FIRERVERSE API",
    description="Wildfire monitoring and intelligence backend",
    version="1.3.0",
)

# Global cache for the parsed CSV dataframe (kept in memory across requests)
_cached_df = None


# ==========================================
# CORS CONFIGURATION
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# CACHE CONFIGURATION
# ==========================================

fire_cache = {}

cache_lock = asyncio.Lock()


# ==========================================
# EMPTY RESPONSE
# ==========================================

def empty_response(days):

    return {
        "count": 0,
        "returned": 0,
        "source": SOURCE,
        "days_requested": days,
        "daily_counts": [],
        "fires": [],
        "grid": [],
        "daily_grids": {},
        "cached": False,
    }


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/")
def home():

    return {
        "message": "Welcome to FIRERVERSE API",
        "status": "running",
        "version": "1.3.0",
    }


@app.get("/api/health")
def health():

    return {
        "status": "healthy",
        "nasa_api_key_configured": bool(FIRMS_MAP_KEY),
        "cache_duration_seconds": CACHE_DURATION,
        "map_record_limit": MAX_MAP_RECORDS,
        "snapshot_available": os.path.exists(SNAPSHOT_PATH),
    }


# ==========================================
# FETCH AND PROCESS NASA DATA
# ==========================================

async def fetch_nasa_data(days, mode="both"):

    url = (
        f"{FIRMS_BASE_URL}/"
        f"{FIRMS_MAP_KEY}/"
        f"{SOURCE}/"
        f"{AREA}/"
        f"{days}"
    )

    csv_text = None

    try:
        timeout_config = httpx.Timeout(20.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.get(url)
            response.raise_for_status()
            csv_text = response.text

            # Update offline snapshot if directory exists or can be created
            try:
                os.makedirs(os.path.dirname(SNAPSHOT_PATH), exist_ok=True)
                with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
                    f.write(csv_text)
            except Exception:
                pass

    except Exception as exc:
        print(f"NASA FIRMS online fetch failed: {exc}")
        if os.path.exists(SNAPSHOT_PATH):
            print("Loading backup NASA FIRMS 5-day snapshot...")
            with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
                csv_text = f.read()
        else:
            raise exc

    if not csv_text or not csv_text.strip():

        return empty_response(days)

    dataframe = pd.read_csv(
        StringIO(csv_text)
    )

    if dataframe.empty:

        return empty_response(days)

    # --------------------------------------
    # CALCULATE COMPLETE DAILY TOTALS
    # --------------------------------------

    dataframe["acq_date"] = (
        dataframe["acq_date"].astype(str)
    )

    daily_totals = (
        dataframe.groupby("acq_date")
        .size()
        .reset_index(name="count")
        .sort_values("acq_date")
    )

    daily_counts = [
        {
            "date": str(row["acq_date"]),
            "count": int(row["count"]),
        }
        for _, row in daily_totals.iterrows()
    ]

    # --------------------------------------
    # FULL DATASET COUNT
    # --------------------------------------

    total_count = len(dataframe)

    # --------------------------------------
    # SERVER-SIDE SPATIAL GRID AGGREGATION
    # --------------------------------------
    # Aggregates 100% of NASA detections into 1.5-degree cells (~165km)
    # for high-performance canvas/grid visualization without dropping points.

    grid_lat = (dataframe["latitude"] / 1.5).round() * 1.5
    grid_lon = (dataframe["longitude"] / 1.5).round() * 1.5

    grid_grouped = (
        dataframe.groupby([grid_lat.rename("lat"), grid_lon.rename("lon")])
        .agg(
            count=("latitude", "count"),
            max_frp=("frp", "max"),
            avg_frp=("frp", "mean"),
            avg_brightness=("bright_ti4", "mean"),
        )
        .reset_index()
    )

    grid_cells = [
        {
            "lat": round(float(row["lat"]), 2),
            "lon": round(float(row["lon"]), 2),
            "count": int(row["count"]),
            "max_frp": round(float(row["max_frp"]), 1) if pd.notna(row["max_frp"]) else 0.0,
            "avg_frp": round(float(row["avg_frp"]), 1) if pd.notna(row["avg_frp"]) else 0.0,
            "avg_brightness": round(float(row["avg_brightness"]), 1) if pd.notna(row["avg_brightness"]) else 0.0,
        }
        for _, row in grid_grouped.iterrows()
    ]

    # Per-date grid aggregation for timeline exploration
    daily_grid_grouped = (
        dataframe.groupby(["acq_date", grid_lat.rename("lat"), grid_lon.rename("lon")])
        .agg(
            count=("latitude", "count"),
            max_frp=("frp", "max"),
            avg_frp=("frp", "mean"),
            avg_brightness=("bright_ti4", "mean"),
        )
        .reset_index()
    )

    daily_grids = {}
    for date_val, group in daily_grid_grouped.groupby("acq_date"):
        daily_grids[str(date_val)] = [
            {
                "lat": round(float(row["lat"]), 2),
                "lon": round(float(row["lon"]), 2),
                "count": int(row["count"]),
                "max_frp": round(float(row["max_frp"]), 1) if pd.notna(row["max_frp"]) else 0.0,
                "avg_frp": round(float(row["avg_frp"]), 1) if pd.notna(row["avg_frp"]) else 0.0,
                "avg_brightness": round(float(row["avg_brightness"]), 1) if pd.notna(row["avg_brightness"]) else 0.0,
            }
            for _, row in group.iterrows()
        ]

    # --------------------------------------
    # RANDOM MAP SAMPLING
    # --------------------------------------
    # All records are used for statistics & grid.
    # A representative sample is sent
    # to the frontend for individual fire inspection.

    sample_size = min(
        MAX_MAP_RECORDS,
        total_count
    )

    map_dataframe = dataframe.sample(
        n=sample_size,
        random_state=42
    )

    # --------------------------------------
    # JSON COMPATIBILITY
    # --------------------------------------

    map_dataframe = (
        map_dataframe.astype(object)
        .where(pd.notna(map_dataframe), None)
    )

    fire_records = map_dataframe.to_dict(
        orient="records"
    )

    # --------------------------------------
    # COMPLETE PROCESSED RESPONSE
    # --------------------------------------

    return {
        "count": total_count,
        "returned": len(fire_records),
        "source": SOURCE,
        "days_requested": days,
        "daily_counts": daily_counts,
        "fires": fire_records,
        "grid": grid_cells,
        "daily_grids": daily_grids,
        "cached": False,
    }


# ==========================================
# NASA FIRMS FIRE ENDPOINT
# ==========================================

@app.get("/api/fires")
async def get_fires(

    days: int = Query(
        default=5,
        ge=1,
        le=5
    ),

    mode: str = Query(
        default="both",
        regex="^(grid|detail|both)$"
    ),

    mode: str = Query(
        default="both",
        regex="^(grid|detail|both)$"
    ),

):

    # --------------------------------------
    # CHECK API KEY
    # --------------------------------------

    if not FIRMS_MAP_KEY:

        raise HTTPException(
            status_code=503,
            detail=(
                "NASA FIRMS API key is not configured. "
                "Check NASA_FIRMS_MAP_KEY in your .env file."
            ),
        )

    # --------------------------------------
    # CHECK CACHE
    # --------------------------------------

    current_time = time.monotonic()

    cached_data = fire_cache.get(days)

    if cached_data:

        cache_age = (
            current_time - cached_data["timestamp"]
        )

        if cache_age < CACHE_DURATION:

            result = cached_data["data"].copy()

            result["fires"] = (
                cached_data["data"]["fires"][:limit]
            )

            result["returned"] = len(result["fires"])

            result["cached"] = True

            result["cache_age_seconds"] = round(
                cache_age,
                2
            )

            return result

    # --------------------------------------
    # FETCH DATA WITH LOCK
    # --------------------------------------

    async with cache_lock:

        # Another request may have refreshed
        # the cache while this request waited.

        current_time = time.monotonic()

        cached_data = fire_cache.get(days)

        if cached_data:

            cache_age = (
                current_time - cached_data["timestamp"]
            )

            if cache_age < CACHE_DURATION:

                result = cached_data["data"].copy()

                result["fires"] = (
                    cached_data["data"]["fires"][:limit]
                )

                result["returned"] = len(
                    result["fires"]
                )

                result["cached"] = True

                result["cache_age_seconds"] = round(
                    cache_age,
                    2
                )

                return result

        # ----------------------------------
        # DOWNLOAD FROM NASA FIRMS
        # ----------------------------------

        try:

            print(
                f"Downloading NASA FIRMS data: {days} days"
            )

            nasa_data = await fetch_nasa_data(days)

            # ----------------------------------
            # SAVE CACHE
            # ----------------------------------

            fire_cache[days] = {
                "timestamp": time.monotonic(),
                "data": nasa_data,
            }

            # ----------------------------------
            # RETURN REQUESTED MAP RECORDS
            # ----------------------------------

            result = nasa_data.copy()

            result["fires"] = (
                nasa_data["fires"][:limit]
            )

            result["returned"] = len(
                result["fires"]
            )

            result["cached"] = False

            return result

        except httpx.HTTPStatusError as exc:

            print(
                "NASA FIRMS HTTP error:",
                exc.response.status_code
            )

            raise HTTPException(
                status_code=502,
                detail=(
                    "NASA FIRMS returned an error: "
                    f"HTTP {exc.response.status_code}"
                ),
            )

        except httpx.HTTPError as exc:

            print(
                "NASA connection error:",
                str(exc)
            )

            raise HTTPException(
                status_code=502,
                detail="Could not connect to NASA FIRMS.",
            )

        except pd.errors.EmptyDataError:

            return empty_response(days)

        except Exception as exc:

            print(
                "Error processing NASA data:",
                str(exc)
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "An error occurred while processing "
                    "NASA fire data."
                ),
            )


# ==========================================
# CACHE MANAGEMENT ENDPOINT
# ==========================================

@app.get("/api/cache")
def cache_status():

    current_time = time.monotonic()

    cache_info = {}

    for days, item in fire_cache.items():

        age = (
            current_time - item["timestamp"]
        )

        cache_info[str(days)] = {
            "age_seconds": round(age, 2),
            "valid": age < CACHE_DURATION,
            "records": item["data"]["count"],
        }

    return {
        "cache_duration_seconds": CACHE_DURATION,
        "cached_periods": cache_info,
    }


# ==========================================
# CLEAR CACHE
# ==========================================

@app.post("/api/cache/clear")
async def clear_cache():

    async with cache_lock:

        fire_cache.clear()

    return {
        "status": "success",
        "message": "NASA FIRMS cache cleared.",
    }

