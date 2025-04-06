from flask import Blueprint
camp_manager_bp = Blueprint('camp_manager',__name__,url_prefix='/camp_manager')
from .routes import *