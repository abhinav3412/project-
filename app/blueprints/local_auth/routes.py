from flask import jsonify, render_template

from app.db_manager import CampManager
from . import local_auth_bp
from flask_login import current_user, login_required

@local_auth_bp.route('/')
@login_required
def index():
    return render_template('local_auth/index.html')


@local_auth_bp.route('/get_camp_details')
def get_camp_details():
    data = CampManager.get_camp_data(current_user.associated_camp_id)
    return jsonify(data)

@local_auth_bp.route('/get_camp_list')
def list_all_camps():
    data = CampManager.list_all_camps()
    return jsonify(data)