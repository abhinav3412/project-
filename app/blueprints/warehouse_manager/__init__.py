from flask import Blueprint

warehouse_manager_bp = Blueprint('warehouse_manager', __name__, url_prefix='/warehouse_manager')

from . import routes