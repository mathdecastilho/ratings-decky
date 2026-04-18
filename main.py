import os
import json
import time
import aiohttp
import decky

CACHE_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "ratings_cache.json")
CACHE_TTL = 7 * 24 * 60 * 60  # 1 week in seconds


def _load_cache() -> dict:
    try:
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_cache(cache: dict):
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f)
    except Exception as e:
        decky.logger.warning(f"Could not save cache: {e}")


class Plugin:
    _cache: dict = {}

    async def _main(self):
        self._cache = _load_cache()
        decky.logger.info("Steam Rating plugin loaded")

    async def _unload(self):
        _save_cache(self._cache)
        decky.logger.info("Steam Rating plugin unloaded")

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _cache_get(self, key: str):
        entry = self._cache.get(key)
        if entry is None:
            return None, False
        fresh = (time.time() - entry["ts"]) < CACHE_TTL
        return entry["data"], fresh

    def _cache_set(self, key: str, data):
        self._cache[key] = {"ts": time.time(), "data": data}

    async def _fetch_json(self, url: str, headers: dict = None):
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers or {}, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                resp.raise_for_status()
                return await resp.json(content_type=None)

    # ------------------------------------------------------------------ #
    # SteamDB rating (Steam review score %)                               #
    # Uses the unofficial Steam reviews summary endpoint.                 #
    # ------------------------------------------------------------------ #

    async def get_steamdb_rating(self, app_id: str) -> dict:
        """
        Returns {"score": int (0-100), "total": int, "error": str|None}
        score is the positive-review percentage shown on SteamDB.
        """
        key = f"steamdb:{app_id}"
        cached, fresh = self._cache_get(key)
        if fresh:
            return cached

        try:
            url = (
                f"https://store.steampowered.com/appreviews/{app_id}"
                "?json=1&language=all&purchase_type=all&num_per_page=0"
            )
            data = await self._fetch_json(url)
            summary = data.get("query_summary", {})
            total = summary.get("total_reviews", 0)
            positive = summary.get("total_positive", 0)
            score = round(positive / total * 100) if total > 0 else None
            result = {"score": score, "total": total, "error": None}
            self._cache_set(key, result)
            return result
        except Exception as e:
            decky.logger.warning(f"SteamDB fetch failed for {app_id}: {e}")
            if cached is not None:
                return cached
            return {"score": None, "total": None, "error": str(e)}

    # ------------------------------------------------------------------ #
    # OpenCritic rating                                                   #
    # ------------------------------------------------------------------ #

    async def get_opencritic_rating(self, app_id: str) -> dict:
        """
        Returns {"score": int (0-100), "tier": str, "error": str|None}
        Uses the OpenCritic API via the game's Steam app ID.
        """
        key = f"opencritic:{app_id}"
        cached, fresh = self._cache_get(key)
        if fresh:
            return cached

        try:
            # Step 1: search for the game on OpenCritic by Steam app ID
            search_url = f"https://api.opencritic.com/api/game?steam-id={app_id}"
            games = await self._fetch_json(search_url)
            if not games:
                result = {"score": None, "tier": None, "url": None, "error": "Not found on OpenCritic"}
                self._cache_set(key, result)
                return result

            game = games[0]
            score = game.get("topCriticScore")
            tier = game.get("tier")
            oc_id = game.get("id")
            oc_name = game.get("url", "")
            result = {
                "score": round(score) if score is not None else None,
                "tier": tier,
                "url": f"https://opencritic.com/game/{oc_id}/{oc_name}" if oc_id else None,
                "error": None,
            }
            self._cache_set(key, result)
            return result
        except Exception as e:
            decky.logger.warning(f"OpenCritic fetch failed for {app_id}: {e}")
            if cached is not None:
                return cached
            return {"score": None, "tier": None, "url": None, "error": str(e)}

    # ------------------------------------------------------------------ #
    # Metacritic rating                                                   #
    # ------------------------------------------------------------------ #

    async def get_metacritic_rating(self, app_id: str) -> dict:
        """
        Returns {"score": int (0-100), "error": str|None}
        Fetches the Metacritic score from the Steam store API (which includes it).
        """
        key = f"metacritic:{app_id}"
        cached, fresh = self._cache_get(key)
        if fresh:
            return cached

        try:
            url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&filters=metacritic"
            data = await self._fetch_json(url)
            app_data = data.get(str(app_id), {})
            if not app_data.get("success"):
                result = {"score": None, "url": None, "error": "App not found"}
                self._cache_set(key, result)
                return result

            metacritic = app_data.get("data", {}).get("metacritic")
            score = metacritic.get("score") if metacritic else None
            mc_url = metacritic.get("url") if metacritic else None
            result = {"score": score, "url": mc_url, "error": None}
            self._cache_set(key, result)
            return result
        except Exception as e:
            decky.logger.warning(f"Metacritic fetch failed for {app_id}: {e}")
            if cached is not None:
                return cached
            return {"score": None, "url": None, "error": str(e)}
