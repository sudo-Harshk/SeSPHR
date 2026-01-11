
from flask import Blueprint
from app.services.crypto.keys import get_or_create_srs_key
from app.services.utils import api_success, api_error

bp = Blueprint('common', __name__, url_prefix='/api')

@bp.route("/srs/public-key")
def api_srs_public_key():
    try:
        _, public_key_pem = get_or_create_srs_key()
        return api_success({"public_key": public_key_pem.decode("utf-8")})
    except Exception as e:
        return api_error(str(e), 500)
