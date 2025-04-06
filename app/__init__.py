from flask import Flask, redirect, url_for
from flask_login import login_required, LoginManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_mail import Mail
from datetime import datetime

from app.models import Camp, User, Vehicle, Warehouse
from .config import Config

from .extensions import db, migrate, bcrypt

# Initialize Flask extensions
login_manager = LoginManager()
mail = Mail()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def has_no_empty_params(rule):
    defaults = rule.defaults if rule.defaults is not None else ()
    arguments = rule.arguments if rule.arguments is not None else ()
    return len(defaults) >= len(arguments)


# Factory function
def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)  # Initialize Flask-Migrate
    login_manager.init_app(app)
    mail.init_app(app)
    
    with app.app_context():
        db.create_all()  # Create tables if they don't exist

    # Register blueprints
    from .blueprints.admin import admin_bp
    from .blueprints.auth import auth_bp
    from .blueprints.warehouse_manager import warehouse_manager_bp
    from .blueprints.camp_manager import camp_manager_bp
    from .blueprints.local_auth import local_auth_bp
    from .blueprints.users import user_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(warehouse_manager_bp)
    app.register_blueprint(camp_manager_bp)
    app.register_blueprint(local_auth_bp)
    app.register_blueprint(user_bp)
    
    @app.route('/')
    @app.route('/index')
    def index():
        return redirect(url_for('auth.login'))
    
    @app.route("/site-map")
    def site_map():
        links = []
        for rule in app.url_map.iter_rules():
            # Filter out rules we can't navigate to in a browser
            # and rules that require parameters
            if "GET" in rule.methods and has_no_empty_params(rule):
                url = url_for(rule.endpoint, **(rule.defaults or {}))
                links.append((url, rule.endpoint))
        return '<br>'.join(['<a href="{url}">{endpoint}</a>'.format(url=url, endpoint=endpoint) for url, endpoint in links])
    
    return app
