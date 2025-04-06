from sqlalchemy import func
from .extensions import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    uid = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    associated_camp_id = db.Column(db.Integer, db.ForeignKey('camps.cid'))
    associated_warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.wid'))
    location = db.Column(db.String(200))
    mobile = db.Column(db.String(20))
    
    # Relationships
    associated_camp = db.relationship('Camp', foreign_keys=[associated_camp_id], backref='users')
    associated_warehouse = db.relationship('Warehouse', foreign_keys=[associated_warehouse_id], backref='associated_users')
    managed_warehouse = db.relationship('Warehouse', foreign_keys='Warehouse.manager_id', back_populates='manager', uselist=False)
    donation = db.relationship("Donation", back_populates="user", lazy=True)
    donation_amount = db.relationship("DonationAmount", backref="user", lazy=True)

    # One-to-one relationship with Volunteer
    volunteer = db.relationship('Volunteer', backref='user', uselist=False)

    def __repr__(self):
        return f'<User {self.username}>'
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_id(self):
        return str(self.uid)


class Camp(db.Model):
    __tablename__ = 'camps'
    
    cid = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)
    current_occupancy = db.Column(db.Integer, default=0)
    food_capacity = db.Column(db.Integer, default=0)  # in kg
    water_capacity = db.Column(db.Integer, default=0)  # in liters
    essentials_capacity = db.Column(db.Integer, default=0)  # in kits
    clothes_capacity = db.Column(db.Integer, default=0)  # in sets
    food_stock_quota = db.Column(db.Integer, default=0)  # in kg
    water_stock_litres = db.Column(db.Integer, default=0)  # in liters
    essentials_stock = db.Column(db.Integer, default=0)  # in kits
    clothes_stock = db.Column(db.Integer, default=0)  # in sets
    food_used = db.Column(db.Integer, default=0)  # in kg
    water_used = db.Column(db.Integer, default=0)  # in liters
    essentials_used = db.Column(db.Integer, default=0)  # in kits
    clothes_used = db.Column(db.Integer, default=0)  # in sets
    status = db.Column(db.String(20), default='active')
    camp_head_id = db.Column(db.Integer, db.ForeignKey('users.uid'))
    coordinates_lat = db.Column(db.Float, nullable=False)
    coordinates_lng = db.Column(db.Float, nullable=False)
    contact_number = db.Column(db.String(20))
    people_list = db.Column(db.String(1000), default='')  # Changed to String with larger size
    
    # Relationships
    camp_head = db.relationship('User', backref='managed_camp', foreign_keys=[camp_head_id])
    
    @hybrid_property
    def num_people_present(self):
        if not self.people_list:
            return 0
        return len(self.people_list.split('|')) if self.people_list else 0
    
    def __repr__(self):
        return f'<Camp {self.name}>'


class CampNotification(db.Model):
    __tablename__ = 'camp_notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    camp_id = db.Column(db.Integer, db.ForeignKey('camps.cid'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)
    
    def __repr__(self):
        return f'<CampNotification {self.id}>'


class Volunteer(db.Model):
    vid = db.Column(db.Integer, primary_key=True)  # Volunteer ID
    user_id = db.Column(
        db.Integer, 
        db.ForeignKey('users.uid', name='fk_volunteer_user_id', ondelete='SET NULL'),  # Named foreign key
        nullable=False
    )
    name = db.Column(db.String(100), nullable=False)  # Name of the volunteer
    email = db.Column(db.String(100), nullable=False)  # Email address
    mobile = db.Column(db.String(20))  # Phone number
    location = db.Column(db.String(100))  # Location of the volunteer
    role_id = db.Column(db.Integer, nullable=False)  # Role ID (e.g., 1 for Admin, 2 for Volunteer, etc.)

    def __repr__(self):
        return f"<Volunteer {self.name}>"


class VolunteerHistory(db.Model):
    vhid = db.Column(db.Integer, primary_key=True)
    vid = db.Column(
        db.Integer, 
        db.ForeignKey('volunteer.vid', name='fk_volunteer_history_volunteer_vid', ondelete='SET NULL'),  # Named foreign key
        nullable=False
    )
    camp_id = db.Column(
        db.Integer, 
        db.ForeignKey('camps.cid', name='fk_volunteer_history_camp_cid', ondelete='SET NULL'),  # Named foreign key
        nullable=False
    )
    role_id = db.Column(
        db.String, 
        db.ForeignKey('volunteer_role.role_id', name='fk_volunteer_history_role_role_id', ondelete='SET NULL'),
        nullable=False
    )
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    end_date = db.Column(db.DateTime, nullable=True)

    # Relationships
    volunteer = db.relationship('Volunteer', backref='volunteer_history', lazy=True)
    camp = db.relationship('Camp', backref='volunteer_history', lazy=True)
    role = db.relationship('VolunteerRole', backref='volunteer_history', lazy=True)


class VolunteerRole(db.Model):
    role_id = db.Column(db.String, primary_key=True)
    role = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=False)


class Thread(db.Model):
    tid = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(
        db.Integer, 
        db.ForeignKey('users.uid', name='fk_thread_user_id', ondelete='SET NULL'),  # Named foreign key
        nullable=False
    )
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

    replies = db.relationship('Reply', backref='thread', lazy=True)


class Reply(db.Model):
    rid = db.Column(db.Integer, primary_key=True, autoincrement=True)
    thread_id = db.Column(
        db.Integer, 
        db.ForeignKey('thread.tid', name='fk_reply_thread_id', ondelete='SET NULL'),  # Named foreign key
        nullable=False
    )
    user_id = db.Column(
        db.Integer, 
        db.ForeignKey('users.uid', name='fk_reply_user_id', ondelete='SET NULL'),  # Named foreign key
        nullable=False
    )
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())


class Feedback(db.Model):
    fid = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    message = db.Column(db.String(500), nullable=False)


class Donation(db.Model):
    did = db.Column(db.Integer, primary_key=True, autoincrement=True)  # Unique donation ID
    user_id = db.Column(
        db.Integer, 
        db.ForeignKey('users.uid', name='fk_donation_user_id', ondelete='SET NULL'),  # Named foreign key
        nullable=False
    )  # User who made the donation
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp(), nullable=False)  # Timestamp of donation
    items = db.Column(db.JSON, nullable=True)  # Dictionary of donated items (nullable)

    # Relationship to the User model (assuming you have a User model)
    user = db.relationship("User", back_populates="donation")

    def __init__(self, user_id, amount=None, items=None):
        """
        Initialize a new donation.
        :param user_id: ID of the user making the donation.
        :param amount: Monetary donation amount (optional).
        :param items: Dictionary of donated items (optional).
        """
        if amount is None and items is None:
            raise ValueError("Either 'amount' or 'items' must be provided.")

        self.user_id = user_id
        self.amount = amount
        self.items = items

    def __repr__(self):
        return f"<Donation(did={self.did}, user_id={self.user_id}, amount={self.amount}, items={self.items})>"


class DonationAmount(db.Model):
    user_id = db.Column(
        db.Integer, 
        db.ForeignKey('users.uid', name='fk_donation_amount_user_id'),  # Named foreign key
        primary_key=True
    )
    amount_id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)


class UserActivity(db.Model):
    __tablename__ = 'user_activity'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, 
        db.ForeignKey('users.uid', name='fk_user_activity_user_id', ondelete='SET NULL'),  # Named foreign key
        nullable=False
    )
    action = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp(), nullable=False)

    def __repr__(self):
        return f"<UserActivity(id={self.id}, user_id={self.user_id}, action='{self.action}', timestamp='{self.timestamp}')>"


class RecentActivity(db.Model):
    __tablename__ = 'recent_activities'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, 
        db.ForeignKey('users.uid', name='fk_recent_activity_user_id', ondelete='SET NULL'),  # Named foreign key
        nullable=True  # Nullable for soft deletes
    )
    action = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp(), nullable=False)

    # Relationship to the User model
    user = db.relationship('User', backref='recent_activities')

    def __repr__(self):
        return f"<RecentActivity(id={self.id}, user_id={self.user_id}, action='{self.action}', timestamp='{self.timestamp}')>"


class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    
    wid = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    coordinates_lat = db.Column(db.Float, nullable=False)
    coordinates_lng = db.Column(db.Float, nullable=False)
    contact_number = db.Column(db.String(20))
    food_capacity = db.Column(db.Integer, nullable=False)  # in kg
    water_capacity = db.Column(db.Integer, nullable=False)  # in liters
    essential_capacity = db.Column(db.Integer, nullable=False)  # in kits
    clothes_capacity = db.Column(db.Integer, nullable=False)  # in sets
    food_available = db.Column(db.Integer, default=0)  # in kg
    water_available = db.Column(db.Integer, default=0)  # in liters
    essentials_available = db.Column(db.Integer, default=0)  # in kits
    clothes_available = db.Column(db.Integer, default=0)  # in sets
    food_used = db.Column(db.Integer, default=0)  # in kg
    water_used = db.Column(db.Integer, default=0)  # in liters
    essentials_used = db.Column(db.Integer, default=0)  # in kits
    clothes_used = db.Column(db.Integer, default=0)  # in sets
    manager_id = db.Column(db.Integer, db.ForeignKey('users.uid'))
    status = db.Column(db.String(20), default='Operational')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Add relationship to manager
    manager = db.relationship('User', foreign_keys=[manager_id], back_populates='managed_warehouse')
    
    # Relationships
    vehicles = db.relationship('Vehicle', backref='warehouse_ref', lazy=True)
    resource_requests = db.relationship('ResourceRequest', backref='warehouse_ref', lazy=True)
    
    def __repr__(self):
        return f'<Warehouse {self.name}>'


class Sensor(db.Model):
    __tablename__ = 'sensor'
    sid = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    soil_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='Active')
    operational_status = db.Column(db.String(20), default='Active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_reading = db.Column(db.DateTime)
    moisture_level = db.Column(db.Float)
    temperature = db.Column(db.Float)
    battery_level = db.Column(db.Float)

    def __repr__(self):
        return f'<Sensor {self.name}>'


class Vehicle(db.Model):
    __tablename__ = 'vehicles'
    
    vid = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.String(50), unique=True, nullable=False)
    capacity = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='available')
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.wid'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Vehicle {self.vehicle_id}>'


class UserRequest(db.Model):
    """Model for user requests for camp slots."""
    __tablename__ = 'user_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    number_slots = db.Column(db.Integer, nullable=False)
    camp_id = db.Column(db.Integer, db.ForeignKey('camps.cid'), nullable=False)
    priority = db.Column(db.Integer, nullable=False)  # 1 for first priority, 2 for second, etc.
    status = db.Column(db.String(20), nullable=False, default='Pending')  # Pending, Approved, Rejected
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    
    # Relationship with Camp
    camp = db.relationship('Camp', backref=db.backref('user_requests', lazy=True))

class ResourceRequest(db.Model):
    """Model for resource requests from camps to warehouses."""
    __tablename__ = 'resource_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    camp_id = db.Column(db.Integer, db.ForeignKey('camps.cid'), nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.wid'), nullable=True)
    food_quantity = db.Column(db.Integer, default=0)
    water_quantity = db.Column(db.Integer, default=0)
    essentials_quantity = db.Column(db.Integer, default=0)
    clothes_quantity = db.Column(db.Integer, default=0)
    priority = db.Column(db.String(20), default='general')  # 'emergency' or 'general'
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected, in_transit, delivered
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    eta = db.Column(db.DateTime, nullable=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.vid'), nullable=True)
    
    # Relationships
    camp = db.relationship('Camp', backref=db.backref('resource_requests', lazy=True))
    vehicle = db.relationship('Vehicle', backref=db.backref('resource_requests', lazy=True))
    
    def __repr__(self):
        return f'<ResourceRequest {self.id}: Camp {self.camp_id} -> Warehouse {self.warehouse_id}>'

class Request(db.Model):
    """Model for user requests"""
    __tablename__ = 'requests'
    __table_args__ = {'extend_existing': True}
    
    rid = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.uid'), nullable=False)
    request_type = db.Column(db.String(50), nullable=False)  # e.g., 'food', 'water', 'shelter'
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, approved, rejected
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', backref=db.backref('requests', lazy=True))

class Notification(db.Model):
    """Model for storing notifications."""
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.uid'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # e.g., 'vehicle_dispatch'
    message = db.Column(db.String(500), nullable=False)
    data = db.Column(db.JSON, nullable=False)  # Store notification data as JSON
    created_at = db.Column(db.DateTime, default=datetime.now)

    def __init__(self, user_id, type, message, data):
        self.user_id = user_id
        self.type = type
        self.message = message
        self.data = data

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'message': self.message,
            'data': self.data,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }

    def __repr__(self):
        return f'<Notification {self.id}: {self.type}>'