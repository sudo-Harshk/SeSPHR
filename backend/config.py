
import os
from pathlib import Path

class Config:
    BASE_DIR = Path(__file__).parent.parent
    
    # Storage Paths
    CLOUD_DIR = BASE_DIR / "cloud"
    CLOUD_DATA = CLOUD_DIR / "data"
    CLOUD_META = CLOUD_DIR / "meta"
    CLOUD_KEYS_SRS = CLOUD_DIR / "keys" / "srs"
    CLOUD_KEYS_USERS = CLOUD_DIR / "keys" / "users"
    
    # Audit
    AUDIT_DIR = BASE_DIR / "app" / "services" / "audit" # Actually tests write to app/services/audit? 
    # The original structure had audit/ at root of backend.
    # We moved audit/ to app/services/audit.
    # So logs should probably go to a var directory or stay local.
    # Let's keep logs in a 'logs' dir in root for cleanliness, or just inside the service for now.
    AUDIT_LOG_PATH = BASE_DIR / "app" / "services" / "audit" / "audit.log"
    
    # DB
    DB_PATH = BASE_DIR / "app" / "services" / "storage" / "sesphr.db"

    SECRET_KEY = os.environ.get("SECRET_KEY", "sesphr-secret-key-prod")
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False # Dev default
    
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
