import os
import json
import decky

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")


class Plugin:
    _settings: dict = {}

    async def _main(self):
        self._settings = self._load_settings()
        decky.logger.info("Ratings Decky plugin loaded")

    async def _unload(self):
        decky.logger.info("Ratings Decky plugin unloaded")

    # ------------------------------------------------------------------ #
    # Settings                                                            #
    # ------------------------------------------------------------------ #

    def _load_settings(self) -> dict:
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_settings(self):
        try:
            os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
            with open(SETTINGS_FILE, "w") as f:
                json.dump(self._settings, f)
        except Exception as e:
            decky.logger.warning(f"Could not save settings: {e}")

    async def get_setting(self, key: str, default):
        return self._settings.get(key, default)

    async def set_setting(self, key: str, value):
        self._settings[key] = value
        self._save_settings()
        return True
