from flask import jsonify, render_template, request, session, current_app
from . import camp_manager_bp
from flask_login import current_user, login_required
from app.db_manager import CampManager, CampNotFound
from app.resource_allocation import (
    allocate_resources,
    calculate_road_distance_and_duration,
    format_eta
)
from app.models import Camp, Vehicle, UserRequest, ResourceRequest, Warehouse, User, Request, Notification, CampNotification
from app import db
from datetime import datetime, timedelta
import os
import json
from flask import flash
from functools import wraps

def camp_manager_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'camp_manager':
            return jsonify({'success': False, 'error': 'Unauthorized access'}), 403
        return f(*args, **kwargs)
    return decorated_function

@camp_manager_bp.route('/')
@login_required
def index():
    # Get the camp managed by the current user
    camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
    if not camp:
        return render_template('camp_manager/no_camp.html')
    
    return render_template('camp_manager/index.html', camp=camp)

@camp_manager_bp.route('/get_camp_details')
@login_required
def get_camp_details():
    try:
        print(f"Current user ID: {current_user.uid}")  # Debug log
        
        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            print("No camp found for user")  # Debug log
            return jsonify({'success': False, 'error': 'No camp found for this manager'}), 404

        print(f"Found camp: {camp.name}")  # Debug log
        
        # Helper function to safely get attribute value
        def get_safe_value(attr, default=0):
            try:
                value = getattr(camp, attr, default)
                return value if value is not None else default
            except Exception as e:
                print(f"Error getting attribute {attr}: {str(e)}")  # Debug log
                return default
        
        # Create a dictionary of camp attributes with safe values
        camp_data = {
            'success': True,
            'name': get_safe_value('name', ''),
            'location': get_safe_value('location', ''),
            'capacity': get_safe_value('capacity', 0),
            'current_occupancy': get_safe_value('current_occupancy', 0),
            'phone': get_safe_value('contact_number', ''),
            'food_capacity': get_safe_value('food_capacity', 0),
            'water_capacity': get_safe_value('water_capacity', 0),
            'essentials_capacity': get_safe_value('essentials_capacity', 0),
            'clothes_capacity': get_safe_value('clothes_capacity', 0),
            'food_stock_quota': get_safe_value('food_stock_quota', 0),
            'water_stock_litres': get_safe_value('water_stock_litres', 0),
            'essentials_stock': get_safe_value('essentials_stock', 0),
            'clothes_stock': get_safe_value('clothes_stock', 0),
            'food_used': get_safe_value('food_used', 0),
            'water_used': get_safe_value('water_used', 0),
            'essentials_used': get_safe_value('essentials_used', 0),
            'clothes_used': get_safe_value('clothes_used', 0),
            'status': get_safe_value('status', 'active'),
            'coordinates_lat': get_safe_value('coordinates_lat', 0),
            'coordinates_lng': get_safe_value('coordinates_lng', 0)
        }

        print(f"Camp data prepared: {camp_data}")  # Debug log
        return jsonify(camp_data)
    except Exception as e:
        print(f"Error in get_camp_details: {str(e)}")  # Debug log
        print(f"Error type: {type(e)}")  # Debug log
        import traceback
        print(f"Traceback: {traceback.format_exc()}")  # Debug log
        return jsonify({'success': False, 'error': str(e)}), 500

@camp_manager_bp.route('/get_people')
@login_required
def get_people():
    try:
        users = User.query.filter_by(role='user').all()
        return jsonify({
            'success': True,
            'people': [{
                'uid': user.uid,
                'username': user.username,
                'email': user.email,
                'location': user.location,
                'mobile': user.mobile
            } for user in users]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@camp_manager_bp.route('/get_user_requests')
@login_required
def get_user_requests():
    try:
        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'No camp found for this manager'}), 404

        # Get all pending requests for this camp
        requests = UserRequest.query.filter_by(
            camp_id=camp.cid,
            status='Pending'
        ).all()

        return jsonify({
            'success': True,
            'requests': [{
                'id': request.id,
                'name': request.name,
                'phone': request.phone,
                'number_slots': request.number_slots,
                'request_date': request.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'status': request.status
            } for request in requests]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@camp_manager_bp.route('/update_resource', methods=['POST'])
@login_required
def update_resource():
    try:
        data = request.get_json()
        camp_id = data.get('camp_id')
        resource_type = data.get('resource_type')
        update_type = data.get('update_type')
        amount = data.get('amount')
        reset = data.get('reset', False)  # New parameter to control reset behavior

        # Allow amount to be zero, but ensure other fields are present
        if not all([camp_id, resource_type, update_type]) or amount is None:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400

        # Verify the camp belongs to the current user
        camp = Camp.query.filter_by(cid=camp_id, camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'message': 'Camp not found or unauthorized'}), 404
        
        print(f"Updating resource: {resource_type}, type: {update_type}, amount: {amount}, reset: {reset}")  # Debug log
        
        if update_type == 'stock':
            # Check capacity limits based on resource type
            if resource_type == 'food':
                if amount > camp.food_capacity:
                    return jsonify({'success': False, 'message': f'Stock cannot exceed capacity ({camp.food_capacity} kg)'}), 400
                camp.food_stock_quota = amount
            elif resource_type == 'water':
                if amount > camp.water_capacity:
                    return jsonify({'success': False, 'message': f'Stock cannot exceed capacity ({camp.water_capacity} L)'}), 400
                camp.water_stock_litres = amount
            elif resource_type == 'essentials':
                if amount > camp.essentials_capacity:
                    return jsonify({'success': False, 'message': f'Stock cannot exceed capacity ({camp.essentials_capacity} kits)'}), 400
                camp.essentials_stock = amount
            elif resource_type == 'clothes':
                if amount > camp.clothes_capacity:
                    return jsonify({'success': False, 'message': f'Stock cannot exceed capacity ({camp.clothes_capacity} sets)'}), 400
                camp.clothes_stock = amount
            else:
                return jsonify({'success': False, 'message': 'Invalid resource type'}), 400
        elif update_type == 'used':
            # Update used amount without checking against current stock
            if resource_type == 'food':
                if reset:
                    camp.food_used = amount  # Set directly to the new value
                else:
                    camp.food_used = camp.food_used + amount  # Add to previous value
            elif resource_type == 'water':
                if reset:
                    camp.water_used = amount  # Set directly to the new value
                else:
                    camp.water_used = camp.water_used + amount  # Add to previous value
            elif resource_type == 'essentials':
                if reset:
                    camp.essentials_used = amount  # Set directly to the new value
                else:
                    camp.essentials_used = camp.essentials_used + amount  # Add to previous value
            elif resource_type == 'clothes':
                if reset:
                    camp.clothes_used = amount  # Set directly to the new value
                else:
                    camp.clothes_used = camp.clothes_used + amount  # Add to previous value
            else:
                return jsonify({'success': False, 'message': 'Invalid resource type'}), 400
        else:
            return jsonify({'success': False, 'message': 'Invalid update type'}), 400

        db.session.commit()
        print(f"Resource updated successfully: {resource_type} {update_type} = {amount}, reset: {reset}")  # Debug log
        return jsonify({'success': True, 'message': 'Resource updated successfully'})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating resource: {str(e)}")  # Debug log
        return jsonify({'success': False, 'message': str(e)}), 500

@camp_manager_bp.route('/get_delivery_status')
@login_required
def get_delivery_status():
    try:
        # Get the camp managed by the current camp manager
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({"success": False, "error": "No camp assigned"}), 404
        
        # Get resource requests for this camp that are in transit
        resource_requests = ResourceRequest.query.filter_by(
            camp_id=camp.cid,
            status='in_transit'
        ).all()
        
        delivery_status = []
        for request in resource_requests:
            try:
                if request.vehicle and request.warehouse:
                    # Get vehicle's current location (in a real system, this would come from GPS)
                    # For now, we'll use the warehouse location
                    warehouse = request.warehouse
                    
                    # Check if coordinates are valid
                    if (warehouse.coordinates_lat is None or warehouse.coordinates_lng is None or 
                        camp.coordinates_lat is None or camp.coordinates_lng is None):
                        # Skip this request if coordinates are invalid
                        continue
                    
                    current_location = (warehouse.coordinates_lat, warehouse.coordinates_lng)
                    camp_location = (camp.coordinates_lat, camp.coordinates_lng)
                
                    # Calculate ETA
                    try:
                        _, duration = calculate_road_distance_and_duration(current_location, camp_location)
                        if duration:
                            eta = datetime.now() + timedelta(seconds=duration)
                            formatted_eta = format_eta(duration)
                        else:
                            # If duration is None, use a default value
                            formatted_eta = "Calculating..."
                    except Exception as e:
                        print(f"Error calculating ETA: {e}")
                        formatted_eta = "Calculating..."
                    
                    delivery_status.append({
                        'request_id': request.id,
                        'vehicle_id': request.vehicle.vid,
                        'warehouse': warehouse.name,
                        'eta': formatted_eta,
                        'status': request.status
                    })
            except Exception as e:
                print(f"Error processing request {request.id}: {e}")
                # Continue with the next request
                continue
        
        return jsonify({
            'success': True,
            'deliveries': delivery_status
        })
        
    except Exception as e:
        print(f"Error in get_delivery_status: {e}")
        return jsonify({
            'success': False,
            'message': f'Error getting delivery status: {str(e)}'
        }), 500

@camp_manager_bp.route('/send_resource_request', methods=['POST'])
@login_required
def send_resource_request():
    """Send a resource request from a camp to the nearest warehouse."""
    try:
        # Get the camp managed by the current camp manager
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({"success": False, "error": "No camp assigned"}), 404
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
            
        food_quantity = data.get('food', 0)
        water_quantity = data.get('water', 0)
        essentials_quantity = data.get('essentials', 0)
        clothes_quantity = data.get('clothes', 0)
        priority = data.get('priority', 'general')
        
        # Validate request
        if food_quantity == 0 and water_quantity == 0 and essentials_quantity == 0 and clothes_quantity == 0:
            return jsonify({"success": False, "error": "At least one resource must be requested"}), 400
            
        # Validate quantities are non-negative
        if any(q < 0 for q in [food_quantity, water_quantity, essentials_quantity, clothes_quantity]):
            return jsonify({"success": False, "error": "Resource quantities cannot be negative"}), 400
        
        # Find the nearest warehouse
        warehouses = Warehouse.query.all()
        nearest_warehouse = None
        min_distance = float('inf')
        
        camp_location = (camp.coordinates_lat, camp.coordinates_lng)
        
        for warehouse in warehouses:
            warehouse_location = (warehouse.coordinates_lat, warehouse.coordinates_lng)
            distance, _ = calculate_road_distance_and_duration(camp_location, warehouse_location)
            
            if distance and distance < min_distance:
                min_distance = distance
                nearest_warehouse = warehouse
        
        if not nearest_warehouse:
            return jsonify({"success": False, "error": "No warehouses available"}), 404
        
        # Create a new resource request
        resource_request = ResourceRequest(
            camp_id=camp.cid,
            warehouse_id=nearest_warehouse.wid,  # Assign the nearest warehouse
            food_quantity=food_quantity,
            water_quantity=water_quantity,
            essentials_quantity=essentials_quantity,
            clothes_quantity=clothes_quantity,
            priority=priority,
            status='pending'
        )
        
        # Save the request
        db.session.add(resource_request)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Resource request sent successfully",
            "request_id": resource_request.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": f"Error sending resource request: {str(e)}"
        }), 500

@camp_manager_bp.route('/add_person', methods=['POST'])
@login_required
def add_person():
    try:
        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'No camp found for this manager'}), 404

        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        number_of_people = data.get('number_of_people', 1)  # Default to 1 if not specified

        if not name or not phone:
            return jsonify({'success': False, 'error': 'Name and phone are required'}), 400

        # Check if adding these people would exceed camp capacity
        if camp.current_occupancy + number_of_people > camp.capacity:
            return jsonify({
                'success': False, 
                'error': f'Cannot add {number_of_people} people. This would exceed camp capacity of {camp.capacity}. Current occupancy: {camp.current_occupancy}'
            }), 400

        # Create a new person entry
        person_data = {
            'name': name,
            'phone': phone,
            'entry_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        # Update the camp's people_list
        if not camp.people_list:
            people_list = []
        else:
            try:
                people_list = json.loads(camp.people_list)
            except json.JSONDecodeError:
                people_list = []

        # Add the person for each slot requested
        for _ in range(number_of_people):
            people_list.append(person_data)
            
        camp.people_list = json.dumps(people_list)

        # Update current occupancy
        camp.current_occupancy = len(people_list)

        # Save changes to the database
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Person added successfully',
            'person': person_data
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@camp_manager_bp.route('/get_current_camp')
@login_required
def get_current_camp():
    try:
        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'No camp found for this manager'}), 404

        return jsonify({
            'success': True,
            'camp_id': camp.cid
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@camp_manager_bp.route('/get_camp_people')
@login_required
def get_camp_people():
    try:
        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'No camp found for this manager'}), 404

        # Parse the people list from JSON string
        people_list = []
        if camp.people_list:
            try:
                people_list = json.loads(camp.people_list)
                # Ensure people_list is a list
                if not isinstance(people_list, list):
                    people_list = []
            except json.JSONDecodeError:
                people_list = []

        # Ensure each person has all required fields
        formatted_people = []
        for person in people_list:
            if isinstance(person, dict):
                formatted_people.append({
                    'name': person.get('name', 'Unknown'),
                    'phone': person.get('phone', 'N/A'),
                    'entry_date': person.get('entry_date', 'N/A')
                })

        return jsonify({
            'success': True,
            'people': formatted_people
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@camp_manager_bp.route('/remove_people', methods=['POST'])
@login_required
def remove_people():
    try:
        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'No camp found for this manager'}), 404

        data = request.get_json()
        people_to_remove = data.get('people', [])

        if not people_to_remove:
            return jsonify({'success': False, 'error': 'No people selected for removal'}), 400

        # Parse the current people list
        if not camp.people_list:
            people_list = []
        else:
            try:
                people_list = json.loads(camp.people_list)
            except json.JSONDecodeError:
                people_list = []

        # Remove the selected people
        original_length = len(people_list)
        people_list = [person for person in people_list 
                      if not any(p['name'] == person['name'] and p['phone'] == person['phone'] 
                               for p in people_to_remove)]

        # Update the camp's people list
        camp.people_list = json.dumps(people_list)
        
        # Update current occupancy
        camp.current_occupancy = len(people_list)

        # Save changes to the database
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Successfully removed {original_length - len(people_list)} person(s) from the camp'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@camp_manager_bp.route('/update_request_status', methods=['POST'])
@login_required
def update_request_status():
    try:
        data = request.get_json()
        request_id = data.get('request_id')
        status = data.get('status')

        if not all([request_id, status]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400

        # Get the request
        user_request = UserRequest.query.get(request_id)
        if not user_request:
            return jsonify({'success': False, 'error': 'Request not found'}), 404

        # Verify the request belongs to the camp managed by the current user
        camp = Camp.query.filter_by(cid=user_request.camp_id, camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'Unauthorized to update this request'}), 403

        # Check if accepting this request would exceed camp capacity
        if status == 'Approved':
            # Calculate current occupancy
            current_occupancy = camp.current_occupancy
            
            # Check if adding the requested slots would exceed capacity
            if current_occupancy + user_request.number_slots > camp.capacity:
                return jsonify({
                    'success': False, 
                    'error': f'Cannot approve request. Adding {user_request.number_slots} slots would exceed camp capacity of {camp.capacity}. Current occupancy: {current_occupancy}'
                }), 400

        # Update the request status
        user_request.status = status

        # If request is accepted, add the person to the camp's people list
        if status == 'Approved':
            # Parse the current people list
            if not camp.people_list:
                people_list = []
            else:
                try:
                    people_list = json.loads(camp.people_list)
                except json.JSONDecodeError:
                    people_list = []

            # Add the person for each slot requested
            for _ in range(user_request.number_slots):
                person_data = {
                    'name': user_request.name,
                    'phone': user_request.phone,
                    'entry_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                people_list.append(person_data)

            # Update the camp's people list
            camp.people_list = json.dumps(people_list)
            
            # Update current occupancy based on the total number of people
            camp.current_occupancy = len(people_list)

        # Create a notification for the user
        notification_message = f"Your slot booking request for {camp.name} has been {status.lower()}"
        if status == 'Approved':
            notification_message += ". Please report to the camp within 2 hours."
        elif status == 'Rejected':
            notification_message += "."
            
        # Create a camp notification
        camp_notification = CampNotification(
            camp_id=camp.cid,
            message=notification_message,
            created_at=datetime.now()
        )
        db.session.add(camp_notification)

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Request {status.lower()} successfully'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@camp_manager_bp.route('/vehicle_dispatch_notification', methods=['POST'])
@login_required
def vehicle_dispatch_notification():
    """Receive notification when a vehicle is dispatched from a warehouse to a camp."""
    try:
        # Get the camp managed by the current camp manager
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({"success": False, "error": "No camp assigned"}), 404
        
        # Get notification data
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
            
        vehicle_id = data.get('vehicle_id')
        warehouse_name = data.get('warehouse_name')
        eta = data.get('eta')
        
        if not vehicle_id or not warehouse_name:
            return jsonify({"success": False, "error": "Missing vehicle_id or warehouse_name"}), 400
        
        # Store the notification in the session for later retrieval
        if 'dispatch_notifications' not in session:
            session['dispatch_notifications'] = []
            
        notification = {
            'vehicle_id': vehicle_id,
            'warehouse_name': warehouse_name,
            'camp_name': camp.name,
            'eta': eta,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        session['dispatch_notifications'].append(notification)
        session.modified = True
        
        return jsonify({
            "success": True,
            "message": "Notification received successfully"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f'Error processing notification: {str(e)}'
        }), 500

@camp_manager_bp.route('/get_dispatch_notifications')
@login_required
def get_dispatch_notifications():
    """Get all vehicle dispatch notifications for the current camp."""
    try:
        # Get the camp managed by the current camp manager
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({"success": False, "error": "No camp assigned"}), 404
        
        # Get notifications from session
        notifications = session.get('dispatch_notifications', [])
        
        # Clear notifications after retrieving them
        session['dispatch_notifications'] = []
        session.modified = True
        
        return jsonify({
            "success": True,
            "notifications": notifications
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f'Error retrieving notifications: {str(e)}'
        }), 500

@camp_manager_bp.route('/get_notifications')
@login_required
def get_notifications():
    try:
        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'Camp not found'}), 404

        # Get all notifications for this camp
        notifications = Notification.query.filter_by(
            user_id=camp.cid
        ).order_by(Notification.created_at.desc()).all()

        # Format notifications
        formatted_notifications = []
        for notification in notifications:
            formatted_notifications.append({
                'id': notification.id,
                'type': notification.type,
                'message': notification.message,
                'data': notification.data,
                'created_at': notification.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })

        return jsonify({
            'success': True,
            'notifications': formatted_notifications
        })

    except Exception as e:
        current_app.logger.error(f"Error getting notifications: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@camp_manager_bp.route('/complete_delivery', methods=['POST'])
@login_required
def complete_delivery():
    """Mark a delivery as completed and update vehicle status."""
    try:
        # Check if user is a camp manager
        if current_user.role != 'camp_manager':
            return jsonify({'success': False, 'error': 'Unauthorized access'}), 403

        data = request.get_json()
        if not data or 'vehicle_id' not in data or 'request_id' not in data:
            return jsonify({'success': False, 'error': 'Missing required data'}), 400

        vehicle_id = data['vehicle_id']  # This is the vehicle's display ID
        request_id = data['request_id']

        # Get the vehicle using vehicle_id (display ID)
        vehicle = Vehicle.query.filter_by(vehicle_id=vehicle_id).first()
        if not vehicle:
            return jsonify({'success': False, 'error': 'Vehicle not found'}), 404

        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'Camp not found'}), 404

        # Get the initial request
        initial_request = ResourceRequest.query.get(request_id)
        if not initial_request:
            return jsonify({'success': False, 'error': 'Request not found'}), 404

        # Check if the initial request is in_transit
        if initial_request.status != 'in_transit':
            return jsonify({'success': False, 'error': f'Request {request_id} is not in transit (status: {initial_request.status})'}), 400

        # Get ALL in_transit requests for this vehicle and camp using vehicle's primary key (vid)
        pending_requests = ResourceRequest.query.filter_by(
            vehicle_id=vehicle.vid,  # Use the vehicle's primary key (vid)
            camp_id=camp.cid,
            status='in_transit'
        ).all()

        if not pending_requests:
            return jsonify({'success': False, 'error': 'No in-transit requests found'}), 404

        # Mark all in-transit requests as completed
        for req in pending_requests:
            req.status = 'completed'
            req.updated_at = datetime.now()

            # Update camp resources based on the request
            camp.food_stock_quota += req.food_quantity
            camp.water_stock_litres += req.water_quantity
            camp.essentials_stock += req.essentials_quantity
            camp.clothes_stock += req.clothes_quantity

        # Update vehicle status to available
        vehicle.status = 'available'
        vehicle.updated_at = datetime.now()

        # Commit all changes
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'All deliveries completed successfully',
            'completed_requests': len(pending_requests)
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error completing delivery: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@camp_manager_bp.route('/check_request_status/<int:request_id>')
@login_required
def check_request_status(request_id):
    """Check the status of a resource request."""
    try:
        # Get the request
        request = ResourceRequest.query.get(request_id)
        if not request:
            return jsonify({'success': False, 'error': 'Request not found'}), 404

        # Get the camp managed by the current user
        camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
        if not camp:
            return jsonify({'success': False, 'error': 'Camp not found'}), 404

        # Check if the request belongs to this camp
        if request.camp_id != camp.cid:
            return jsonify({'success': False, 'error': 'Unauthorized access'}), 403

        return jsonify({
            'success': True,
            'status': request.status
        })

    except Exception as e:
        current_app.logger.error(f"Error checking request status: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500 