import json
import os
from typing import Dict, Any, Optional

class TaxConfigurationService:
    _instance = None
    _config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'tax_config.json')

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TaxConfigurationService, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        self.taxes = {}
        if os.path.exists(self._config_path):
            try:
                with open(self._config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.taxes = data.get('taxes', {})
            except Exception as e:
                print(f"Error loading tax config: {e}")
                # Fallback basics if file fails
                self.taxes = {}
        else:
             print(f"Tax config not found at {self._config_path}")

    def get_rule(self, code: str) -> Optional[Dict[str, Any]]:
        return self.taxes.get(code)

    def add_rule(self, code: str, name: str, tax_type: str, operation: str, description: str):
        self.taxes[code] = {
            "name": name,
            "type": tax_type,
            "operation": operation, # add, subtract, ignore
            "description": description
        }
        self._save_config()

    def _save_config(self):
        try:
            with open(self._config_path, 'w', encoding='utf-8') as f:
                json.dump({"taxes": self.taxes}, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving tax config: {e}")

    def get_all_rules(self) -> Dict[str, Any]:
        return self.taxes
