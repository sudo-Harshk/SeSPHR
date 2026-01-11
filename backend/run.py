
import os
from app import create_app

config_name = os.getenv("FLASK_ENV", "development")
os.environ["FLASK_ENV"] = config_name # Ensure it's available for Blueprint checks
app = create_app(config_name)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
