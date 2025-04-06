from flask import flash, jsonify, redirect, request, url_for
from flask_login import current_user, login_required
from app.db_manager import UserManager, CampManager, get_user_activity, log_recent_activity
from app.models import User, Warehouse, Camp, UserActivity
from . import admin_bp
from app.extensions import db

################## User Management APIs ##################

@admin_bp.route('/get_all_users')
@login_required
def get_all_users():
    """
    List all users.
    """
    try:
        users = User.query.all()
        return jsonify([{
            'uid': user.uid,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'location': user.location,
            'mobile': user.mobile,
            'managed_warehouse': {
                'wid': user.managed_warehouse.wid,
                'name': user.managed_warehouse.name
            } if hasattr(user, 'managed_warehouse') and user.managed_warehouse else None
        } for user in users]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/get_user/<int:user_id>')
@login_required
def get_user(user_id):
    """
    List all users.
    """
    try:
        users = UserManager.get_user(user_id)
        return jsonify(users), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/get_user_activity/<int:uid>')
@login_required
def user_activity(uid):
    data = get_user_activity(uid)
    
    return jsonify(data)

@admin_bp.route("/add_user", methods=["POST"])
@login_required
def add_user():
    try:
        data = request.json
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        location = data.get("location")
        mobile = data.get("mobile")
        role = data.get("role")
        associated_camp_id = data.get("associated_camp_id")
        warehouse_id = data.get("warehouse_id")

        if not all([username, email, password, role]):  
            return jsonify({"error": "Username, email, password, and role are required"}), 400
        
        # Create the user
        response, status_code = UserManager.create_user(username, email, password, location, mobile, role, associated_camp_id)

        if status_code == 201 and role == "warehouse_manager" and warehouse_id:
            # Assign warehouse to the manager
            warehouse = Warehouse.query.get(warehouse_id)
            if warehouse:
                warehouse.manager_id = response['user']['uid']
                db.session.commit()
                log_recent_activity(user_id=current_user.uid, action=f"Assigned warehouse {warehouse.name} to manager {username}")

        return jsonify(response), status_code

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
@admin_bp.route('/update_user/<int:uid>', methods=['PUT'])
@login_required
def update_user(uid):
    """
    Edit user details.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Remove empty fields
        update_data = {key: value for key, value in data.items() if value is not None}

        # Check if email is already in use
        if 'email' in update_data:
            existing_user = User.query.filter_by(email=update_data['email']).first()
            if existing_user and existing_user.uid != uid:
                return jsonify({'error': 'Email already in use'}), 400

        # Handle warehouse assignment
        warehouse_id = update_data.pop('warehouse_id', None)
        user = User.query.get(uid)
        
        if warehouse_id and user.role == "warehouse_manager":
            warehouse = Warehouse.query.get(warehouse_id)
            if warehouse:
                warehouse.manager_id = uid
                db.session.commit()
                log_recent_activity(user_id=current_user.uid, action=f"Assigned warehouse {warehouse.name} to manager {user.username}")

        # Update user
        updated_user, status_code = UserManager.update_user(uid, **update_data)
        return jsonify({'message': 'User updated successfully', 'user': updated_user}), status_code

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/delete_user/<int:uid>', methods=['DELETE'])
@login_required
def delete_user(uid):
    """
    Delete a user by their ID.
    """
    try:
        user = User.query.get(uid)
        if user:
            username = user.username  # Store username before deletion
            db.session.delete(user)
            db.session.commit()
            log_recent_activity(user_id=current_user.uid, action=f"Deleted user: {username} (ID: {uid})")
            return jsonify({'message': f'User {username} deleted successfully'}), 200
        else:
            return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

################## Camp Management APIs ##################

@admin_bp.route('/get_all_camps')
@login_required
def get_all_camps():
    try:
        camps = Camp.query.all()
        return jsonify([{
            'cid': camp.cid,
            'name': camp.name,
            'location': camp.location,
            'capacity': camp.capacity,
            'current_occupancy': camp.current_occupancy,
            'food_capacity': camp.food_capacity,
            'water_capacity': camp.water_capacity,
            'essentials_capacity': camp.essentials_capacity,
            'clothes_capacity': camp.clothes_capacity,
            'status': camp.status,
            'camp_head_id': camp.camp_head_id,
            'camp_head': {
                'uid': camp.camp_head.uid,
                'username': camp.camp_head.username
            } if camp.camp_head else None,
            'coordinates_lat': camp.coordinates_lat,
            'coordinates_lng': camp.coordinates_lng,
            'contact_number': camp.contact_number
        } for camp in camps])
    except Exception as e:
        current_app.logger.error(f"Error fetching camps: {str(e)}")
        return jsonify({'error': 'Failed to fetch camps'}), 500

@admin_bp.route('/get_camp/<int:camp_id>')
@login_required
def get_camp(camp_id):
    try:
        camp = Camp.query.get_or_404(camp_id)
        return jsonify({
            'cid': camp.cid,
            'name': camp.name,
            'location': camp.location,
            'capacity': camp.capacity,
            'current_occupancy': camp.current_occupancy,
            'food_capacity': camp.food_capacity,
            'water_capacity': camp.water_capacity,
            'essentials_capacity': camp.essentials_capacity,
            'clothes_capacity': camp.clothes_capacity,
            'status': camp.status,
            'camp_head_id': camp.camp_head_id,
            'coordinates_lat': camp.coordinates_lat,
            'coordinates_lng': camp.coordinates_lng,
            'contact_number': camp.contact_number
        })
    except Exception as e:
        current_app.logger.error(f"Error fetching camp {camp_id}: {str(e)}")
        return jsonify({'error': 'Failed to fetch camp details'}), 500

@admin_bp.route("/add_camp", methods=["POST"])
@login_required
def add_camp():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["name", "location", "capacity", "coordinates_lat", "coordinates_lng"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Check if camp name already exists
        existing_camp = Camp.query.filter_by(name=data["name"]).first()
        if existing_camp:
            return jsonify({"error": "Camp with this name already exists"}), 400
        
        # Check if camp head is already assigned to another camp
        if "camp_head_id" in data and data["camp_head_id"]:
            existing_camp_head = Camp.query.filter_by(camp_head_id=data["camp_head_id"]).first()
            if existing_camp_head:
                return jsonify({"error": "Camp head is already assigned to another camp"}), 400
        
        # Create new camp
        new_camp = Camp(
            name=data["name"],
            location=data["location"],
            capacity=data["capacity"],
            coordinates_lat=data["coordinates_lat"],
            coordinates_lng=data["coordinates_lng"],
            contact_number=data.get("contact_number"),
            camp_head_id=data.get("camp_head_id"),
            food_capacity=data.get("food_capacity", 0),
            water_capacity=data.get("water_capacity", 0),
            essentials_capacity=data.get("essentials_capacity", 0),
            clothes_capacity=data.get("clothes_capacity", 0),
            food_stock_quota=0,  # Initialize stock values
            water_stock_litres=0,
            essentials_stock=0,
            clothes_stock=0
        )
        
        db.session.add(new_camp)
        db.session.commit()
        
        # Update the user's associated_camp_id if a camp head is assigned
        if new_camp.camp_head_id:
            user = User.query.get(new_camp.camp_head_id)
            if user:
                user.associated_camp_id = new_camp.cid
                db.session.commit()
        
        # Return the created camp with camp head name
        return jsonify({
            "cid": new_camp.cid,
            "name": new_camp.name,
            "location": new_camp.location,
            "capacity": new_camp.capacity,
            "current_occupancy": new_camp.current_occupancy,
            "coordinates_lat": new_camp.coordinates_lat,
            "coordinates_lng": new_camp.coordinates_lng,
            "contact_number": new_camp.contact_number,
            "camp_head_id": new_camp.camp_head_id,
            "camp_head": {"username": new_camp.camp_head.username} if new_camp.camp_head else None,
            "food_capacity": new_camp.food_capacity,
            "water_capacity": new_camp.water_capacity,
            "essentials_capacity": new_camp.essentials_capacity,
            "clothes_capacity": new_camp.clothes_capacity,
            "status": new_camp.status
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/update_camp/<int:camp_id>", methods=["PUT"])
@login_required
def update_camp(camp_id):
    try:
        camp = Camp.query.get_or_404(camp_id)
        data = request.get_json()
        
        # Check if camp name already exists (if name is being updated)
        if "name" in data and data["name"] != camp.name:
            existing_camp = Camp.query.filter_by(name=data["name"]).first()
            if existing_camp:
                return jsonify({"error": "Camp with this name already exists"}), 400
        
        # Handle camp head assignment/unassignment
        if "camp_head_id" in data:
            # If there's a current camp head, update their associated_camp_id to None
            if camp.camp_head_id:
                old_head = User.query.get(camp.camp_head_id)
                if old_head:
                    old_head.associated_camp_id = None
            
            # If assigning a new camp head
            if data["camp_head_id"]:
                # Check if camp head is already assigned to another camp
                existing_camp_head = Camp.query.filter_by(camp_head_id=data["camp_head_id"]).first()
                if existing_camp_head and existing_camp_head.cid != camp_id:
                    return jsonify({"error": "Camp head is already assigned to another camp"}), 400
                
                # Update the new camp head's associated_camp_id
                new_head = User.query.get(data["camp_head_id"])
                if new_head:
                    new_head.associated_camp_id = camp_id
        
        # Update camp fields
        for field in ["name", "location", "capacity", "coordinates_lat", "coordinates_lng", 
                     "contact_number", "camp_head_id", "food_capacity", "water_capacity", 
                     "essentials_capacity", "clothes_capacity"]:
            if field in data:
                setattr(camp, field, data[field])
        
        db.session.commit()
        
        # Return the updated camp with camp head name
        return jsonify({
            "cid": camp.cid,
            "name": camp.name,
            "location": camp.location,
            "capacity": camp.capacity,
            "current_occupancy": camp.current_occupancy,
            "coordinates_lat": camp.coordinates_lat,
            "coordinates_lng": camp.coordinates_lng,
            "contact_number": camp.contact_number,
            "camp_head_id": camp.camp_head_id,
            "camp_head": {"username": camp.camp_head.username} if camp.camp_head else None,
            "food_capacity": camp.food_capacity,
            "water_capacity": camp.water_capacity,
            "essentials_capacity": camp.essentials_capacity,
            "clothes_capacity": camp.clothes_capacity,
            "status": camp.status
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/delete_camp/<int:camp_id>', methods=['DELETE'])
@login_required
def delete_camp(camp_id):
    try:
        camp = Camp.query.get_or_404(camp_id)
        camp_name = camp.name  # Store name before deletion
        
        # Log activity before deleting
        log_recent_activity(
            user_id=current_user.uid,
            action=f"Deleted camp: {camp_name}"
        )
        
        db.session.delete(camp)
        db.session.commit()
        
        return jsonify({'message': 'Camp deleted successfully'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting camp {camp_id}: {str(e)}")
        return jsonify({'error': 'Failed to delete camp'}), 500

################## Warehouse Management APIs ##################

@admin_bp.route('/get_all_warehouses')
@login_required
def get_all_warehouses():
    """
    List all warehouses.
    """
    try:
        warehouses = Warehouse.query.all()
        warehouse_list = []
        for warehouse in warehouses:
            warehouse_data = {
                'wid': warehouse.wid,
                'name': warehouse.name,
                'location': warehouse.location,
                'coordinates_lat': warehouse.coordinates_lat,
                'coordinates_lng': warehouse.coordinates_lng,
                'food_capacity': warehouse.food_capacity,
                'water_capacity': warehouse.water_capacity,
                'essential_capacity': warehouse.essential_capacity,
                'clothes_capacity': warehouse.clothes_capacity,
                'manager_id': warehouse.manager_id,
                'manager_name': warehouse.manager.username if warehouse.manager else None,
                'status': warehouse.status,
                'created_at': warehouse.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            warehouse_list.append(warehouse_data)
        return jsonify(warehouse_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/create_warehouse', methods=['POST'])
@login_required
def create_warehouse():
    """
    Create a new warehouse.
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'location', 'food_capacity', 'water_capacity', 
                         'essential_capacity', 'clothes_capacity', 'coordinates_lat', 'coordinates_lng']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing or invalid field: {field}'}), 400

        # Create new warehouse
        new_warehouse = Warehouse(
            name=data['name'],
            location=data['location'],
            coordinates_lat=float(data['coordinates_lat']),
            coordinates_lng=float(data['coordinates_lng']),
            food_capacity=int(data['food_capacity']),
            water_capacity=int(data['water_capacity']),
            essential_capacity=int(data['essential_capacity']),
            clothes_capacity=int(data['clothes_capacity']),
            manager_id=data.get('manager_id'),  # Optional
            status=data.get('status', 'Operational')  # Set default status if not provided
        )

        db.session.add(new_warehouse)
        db.session.commit()

        # Log activity
        log_recent_activity(user_id=current_user.uid, action=f"Created warehouse: {data['name']}")

        return jsonify({
            'message': 'Warehouse created successfully',
            'warehouse': {
                'wid': new_warehouse.wid,
                'name': new_warehouse.name,
                'location': new_warehouse.location,
                'coordinates_lat': new_warehouse.coordinates_lat,
                'coordinates_lng': new_warehouse.coordinates_lng,
                'food_capacity': new_warehouse.food_capacity,
                'water_capacity': new_warehouse.water_capacity,
                'essential_capacity': new_warehouse.essential_capacity,
                'clothes_capacity': new_warehouse.clothes_capacity,
                'manager_id': new_warehouse.manager_id,
                'manager_name': new_warehouse.manager.username if new_warehouse.manager else None,
                'status': new_warehouse.status,
                'created_at': new_warehouse.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/update_warehouse/<int:warehouse_id>', methods=['PUT'])
@login_required
def update_warehouse(warehouse_id):
    """
    Update warehouse details.
    """
    try:
        warehouse = Warehouse.query.get_or_404(warehouse_id)
        data = request.get_json()

        # Update fields if provided
        if 'name' in data:
            warehouse.name = data['name']
        if 'location' in data:
            warehouse.location = data['location']
        if 'coordinates_lat' in data:
            warehouse.coordinates_lat = float(data['coordinates_lat'])
        if 'coordinates_lng' in data:
            warehouse.coordinates_lng = float(data['coordinates_lng'])
        if 'food_capacity' in data:
            warehouse.food_capacity = int(data['food_capacity'])
        if 'water_capacity' in data:
            warehouse.water_capacity = int(data['water_capacity'])
        if 'essential_capacity' in data:
            warehouse.essential_capacity = int(data['essential_capacity'])
        if 'clothes_capacity' in data:
            warehouse.clothes_capacity = int(data['clothes_capacity'])
        if 'manager_id' in data:
            # Validate manager_id if provided
            if data['manager_id']:
                manager = User.query.get(data['manager_id'])
                if not manager:
                    return jsonify({'error': 'Manager not found'}), 404
                if manager.role != 'warehouse_manager':
                    return jsonify({'error': 'User is not a warehouse manager'}), 400
            warehouse.manager_id = data['manager_id']
        if 'status' in data:
            warehouse.status = data['status']

        db.session.commit()

        # Log activity
        log_recent_activity(user_id=current_user.uid, action=f"Updated warehouse: {warehouse.name}")

        return jsonify({
            'message': 'Warehouse updated successfully',
            'warehouse': {
                'wid': warehouse.wid,
                'name': warehouse.name,
                'location': warehouse.location,
                'coordinates_lat': warehouse.coordinates_lat,
                'coordinates_lng': warehouse.coordinates_lng,
                'food_capacity': warehouse.food_capacity,
                'water_capacity': warehouse.water_capacity,
                'essential_capacity': warehouse.essential_capacity,
                'clothes_capacity': warehouse.clothes_capacity,
                'manager_id': warehouse.manager_id,
                'manager_name': warehouse.manager.username if warehouse.manager else None,
                'status': warehouse.status,
                'created_at': warehouse.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/delete_warehouse/<int:warehouse_id>', methods=['DELETE'])
@login_required
def delete_warehouse(warehouse_id):
    """
    Delete a warehouse.
    """
    try:
        warehouse = Warehouse.query.get_or_404(warehouse_id)
        warehouse_name = warehouse.name
        
        db.session.delete(warehouse)
        db.session.commit()

        # Log activity
        log_recent_activity(user_id=current_user.uid, action=f"Deleted warehouse: {warehouse_name}")

        return jsonify({'message': f'Warehouse {warehouse_id} deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/assign_warehouse_manager', methods=['POST'])
@login_required
def assign_warehouse_manager():
    """
    Assign a warehouse manager to a warehouse.
    """
    try:
        data = request.get_json()
        warehouse_id = data.get('warehouse_id')
        manager_id = data.get('manager_id')

        if not warehouse_id or not manager_id:
            return jsonify({'error': 'Warehouse ID and manager ID are required'}), 400

        warehouse = Warehouse.query.get_or_404(warehouse_id)
        manager = User.query.get_or_404(manager_id)

        # Verify the user is a warehouse manager
        if manager.role != 'warehouse_manager':
            return jsonify({'error': 'User is not a warehouse manager'}), 400

        # Update warehouse manager
        warehouse.manager_id = manager_id
        db.session.commit()

        # Log activity
        log_recent_activity(user_id=current_user.uid, action=f"Assigned manager {manager.username} to warehouse {warehouse.name}")

        return jsonify({
            'message': 'Warehouse manager assigned successfully',
            'warehouse': {
                'wid': warehouse.wid,
                'name': warehouse.name,
                'manager_id': warehouse.manager_id,
                'manager_name': warehouse.manager.username
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/get_warehouse_managers')
@login_required
def get_warehouse_managers():
    """
    Get all users with the warehouse_manager role.
    """
    try:
        managers = User.query.filter_by(role='warehouse_manager').all()
        manager_list = []
        for manager in managers:
            manager_data = {
                'uid': manager.uid,
                'username': manager.username,
                'email': manager.email,
                'location': manager.location,
                'mobile': manager.mobile
            }
            manager_list.append(manager_data)
        return jsonify(manager_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/get_camp_managers", methods=["GET"])
@login_required
def get_camp_managers():
    try:
        camp_managers = User.query.filter_by(role="camp_manager").all()
        return jsonify([{
            "uid": manager.uid,
            "username": manager.username
        } for manager in camp_managers])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/get_recent_activities')
@login_required
def get_recent_activities():
    """
    Get all recent activities across all users.
    """
    try:
        activities = UserActivity.query.order_by(UserActivity.timestamp.desc()).limit(10).all()
        
        activity_list = [
            {
                "id": activity.id,
                "user_id": activity.user_id,
                "action": activity.action,
                "timestamp": activity.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            }
            for activity in activities
        ]
        return jsonify(activity_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500