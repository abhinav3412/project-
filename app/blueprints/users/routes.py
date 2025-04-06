from flask import render_template, request
from app.models import Feedback
from . import user_bp
from flask_login import current_user, login_required
from app.extensions import db
from .user_api import *

@user_bp.route('/')
@user_bp.route('/index')
@login_required
def index():
    """
    Render the index page for logged-in users.
    """
    return render_template('user/index.html')

@user_bp.route('/camps')
@login_required
def camps():
    """
    Render the camps page, displaying information about various camps.
    """
    return render_template('user/camps.html')

@user_bp.route('/alerts')
@login_required
def alerts():
    """
    Display alerts page.
    """
    return render_template('user/alerts.html')

@user_bp.route('/donations')
@login_required
def donations():
    """
    Display donations page.
    """
    return render_template('user/donations.html')

@user_bp.route('/guide')
@login_required
def guide():
    """
    Display guide page.
    """
    return render_template('user/guide.html')

@user_bp.route('/volunteer')
@login_required
def volunteer():
    """
    Display volunteer page.
    """
    user = current_user
    return render_template('user/volunteer.html', user=user)

@user_bp.route('/forums', methods=['GET'])
@login_required
def forums():
    """
    Display the forums page.
    """
    return render_template('user/forums.html')

@user_bp.route('/submit_feedback', methods=['POST'])
@login_required
def submit_feedback():
    """
    Handle feedback form submissions:
    - Retrieves feedback details (name, email, message) from the request.
    - Stores the feedback in the database.
    - Returns a success response upon completion.
    """
    
    name = request.values.get('feedback-name')
    email = request.values.get('feedback-email')
    message = request.values.get('feedback-message')
    
    new_feedback = Feedback(name=name,email=email,message=message)
    db.session.add(new_feedback)
    db.session.commit()
    return {"status": "success"}, 201
