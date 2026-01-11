
from flask import Flask
from config import config
from flask_cors import CORS # Ensure installed, or stick to Vite proxy. 
# Original code had CORS commented out. We can stick to that.

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # Enable CORS for frontend integration
    CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}}) # Allow all origins for dev simplicity, or specify localhost:5173
    
    # Register Blueprints
    from .api import auth, patient, doctor, admin, debug, common
    
    app.register_blueprint(auth.bp)
    app.register_blueprint(patient.bp)
    app.register_blueprint(doctor.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(debug.bp)
    app.register_blueprint(common.bp) # for / and static stuff if needed
    
    return app
