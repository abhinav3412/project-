from flask import Blueprint
local_auth_bp = Blueprint('local_auth',__name__,url_prefix='/local_auth')
from .routes import *