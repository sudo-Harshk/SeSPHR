
import os
from pathlib import Path

class Config:
    # config.py is in backend/, so parent is backend/.
    BASE_DIR = Path(__file__).parent
    
    # Storage Paths
    CLOUD_DIR = BASE_DIR.parent / "cloud"
    CLOUD_DATA = CLOUD_DIR / "data"
    CLOUD_META = CLOUD_DIR / "meta"
    CLOUD_KEYS_SRS = CLOUD_DIR / "keys" / "srs"
    CLOUD_KEYS_USERS = CLOUD_DIR / "keys" / "users"
    
    # Audit
    AUDIT_DIR = BASE_DIR / "app" / "services" / "audit" 
    AUDIT_LOG_PATH = BASE_DIR / "app" / "services" / "audit" / "audit.log"
    
    # DB
    DB_PATH = BASE_DIR / "app" / "services" / "storage" / "sesphr.db"

    SECRET_KEY = os.environ.get("SECRET_KEY", "sesphr-secret-key-prod")
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False # Dev default

    # Optional artificial delays (ms) to make demo/proof timings feel realistic.
    # Keep these at 0 in production unless you explicitly want them.
    PROOF_DELAY_FETCH_MS = float(os.environ.get("PROOF_DELAY_FETCH_MS", "0"))
    PROOF_DELAY_POLICY_MS = float(os.environ.get("PROOF_DELAY_POLICY_MS", "0"))
    PROOF_DELAY_REENC_MS = float(os.environ.get("PROOF_DELAY_REENC_MS", "0"))
    
    @staticmethod
    def init_app(app):
        # Ensure directories exist
        for d in [Config.CLOUD_DATA, Config.CLOUD_META, Config.CLOUD_KEYS_SRS, Config.CLOUD_KEYS_USERS]:
            d.mkdir(parents=True, exist_ok=True)
            
class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
