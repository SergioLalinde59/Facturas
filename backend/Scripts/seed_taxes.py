import sys
import os
import json
import logging

# Add the project root directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.infrastructure.database.postgres_tax_repository import PostgresTaxRepository
from src.application.services.tax_service import TaxService

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("seed_taxes")

def seed_taxes():
    config_path = os.path.join(os.path.dirname(__file__), '..', 'tax_config.json')
    
    if not os.path.exists(config_path):
        logger.error(f"Config file not found at {config_path}")
        return

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        
        repository = PostgresTaxRepository()
        service = TaxService(repository)
        
        logger.info("Initializing taxes from configuration...")
        results = service.initialize_taxes_from_config(config_data)
        
        logger.info(f"Successfully seeded {len(results)} taxes.")
        for tax in results:
            logger.info(f" - {tax.code}: {tax.name}")
            
    except Exception as e:
        logger.error(f"Failed to seed taxes: {e}")

if __name__ == "__main__":
    seed_taxes()
