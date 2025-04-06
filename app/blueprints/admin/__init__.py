from flask import Blueprint
admin_bp = Blueprint('admin',__name__,url_prefix='/admin')

# Import routes from admin_api.py first
from .admin_api import (
    get_all_users, get_user, user_activity, add_user, update_user, delete_user,
    get_all_camps, get_camp, add_camp, update_camp, delete_camp,
    get_all_warehouses, create_warehouse, update_warehouse, delete_warehouse, assign_warehouse_manager
)

# Import template rendering routes from routes.py
from .routes import (
    index, user, camp, warehouse, sensor,
    add_sensor, delete_sensor, get_sensors, get_sensor, update_sensor
)