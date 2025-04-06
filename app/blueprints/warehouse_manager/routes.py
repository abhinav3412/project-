from flask import render_template, jsonify, request, current_app
from flask_login import login_required, current_user
from app.models import Warehouse, Vehicle, db, ResourceRequest, Camp, User, Notification
from app.decorators import warehouse_manager_required
from . import warehouse_manager_bp
from app.db_manager import VehicleManager
from app.resource_allocation import allocate_resources, calculate_road_distance_and_duration, format_eta
from datetime import datetime, timedelta
import json

@warehouse_manager_bp.route('/')
@login_required
@warehouse_manager_required
def index():
    return render_template('warehouse_manager/index.html')

@warehouse_manager_bp.route('/get_warehouse')
@login_required
@warehouse_manager_required
def get_warehouse():
    try:
        # Validate current user
        if not current_user or not hasattr(current_user, 'uid'):
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401

        # Get the warehouse managed by the current user
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'success': False, 'error': 'Warehouse not found'}), 404

        # Return warehouse data with all fields
        return jsonify({
            'success': True,
            'id': warehouse.wid,
            'name': warehouse.name or '',
            'location': warehouse.location or '',
            'latitude': warehouse.coordinates_lat or 0.0,
            'longitude': warehouse.coordinates_lng or 0.0,
            'status': warehouse.status or 'Unknown',
            'food_capacity': warehouse.food_capacity or 0,
            'water_capacity': warehouse.water_capacity or 0,
            'essential_capacity': warehouse.essential_capacity or 0,
            'clothes_capacity': warehouse.clothes_capacity or 0,
            'food_available': warehouse.food_available or 0,
            'water_available': warehouse.water_available or 0,
            'essentials_available': warehouse.essentials_available or 0,
            'clothes_available': warehouse.clothes_available or 0,
            'food_used': warehouse.food_used or 0,
            'water_used': warehouse.water_used or 0,
            'essentials_used': warehouse.essentials_used or 0,
            'clothes_used': warehouse.clothes_used or 0,
            'contact_number': warehouse.contact_number or '',
            'manager_id': warehouse.manager_id,
            'created_at': warehouse.created_at.isoformat() if warehouse.created_at else None
        })
        
    except Exception as e:
        current_app.logger.error(f"Error in get_warehouse: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@warehouse_manager_bp.route('/get_resource_requests')
@login_required
@warehouse_manager_required
def get_resource_requests():
    try:
        # Get the warehouse managed by the current user
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'success': False, 'error': 'No warehouse found'}), 404
            
        # Get all resource requests assigned to this warehouse that are truly pending
        # (not yet accepted by any vehicle and not rejected)
        requests = ResourceRequest.query.filter_by(
            warehouse_id=warehouse.wid,
            status='pending',
            vehicle_id=None  # Only show requests not yet assigned to any vehicle
        ).all()
        
        # Get all vehicles that have pending requests
        waiting_vehicles = db.session.query(
            Vehicle,
            db.func.sum(
                ResourceRequest.food_quantity +
                ResourceRequest.water_quantity +
                ResourceRequest.essentials_quantity +
                ResourceRequest.clothes_quantity
            ).label('current_load')
        ).join(
            ResourceRequest,
            Vehicle.vid == ResourceRequest.vehicle_id
        ).filter(
            Vehicle.warehouse_id == warehouse.wid,
            ResourceRequest.status == 'pending',  # Only count pending requests
            Vehicle.status == 'available'  # Only show vehicles that are still available
        ).group_by(Vehicle.vid).all()
        
        # Format the response to match what the frontend expects
        formatted_requests = []
        for request in requests:
            # Get camp information
            camp = Camp.query.get(request.camp_id)
            if not camp:
                continue
                
            # Calculate distance between camp and warehouse
            camp_location = (camp.coordinates_lat, camp.coordinates_lng)
            warehouse_location = (warehouse.coordinates_lat, warehouse.coordinates_lng)
            distance, _ = calculate_road_distance_and_duration(camp_location, warehouse_location)
            
            formatted_requests.append({
                'id': request.id,
                'camp_id': request.camp_id,
                'camp_name': camp.name,
                'location': camp.location,
                'distance': distance if distance else 0,
                'food_quantity': request.food_quantity,
                'water_quantity': request.water_quantity,
                'essentials_quantity': request.essentials_quantity,
                'clothes_quantity': request.clothes_quantity,
                'priority': request.priority,
                'status': request.status,
                'created_at': request.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'updated_at': request.updated_at.strftime('%Y-%m-%d %H:%M:%S') if request.updated_at else None,
                'eta': request.eta.strftime('%Y-%m-%d %H:%M:%S') if request.eta else None,
                'vehicle_id': request.vehicle_id
            })
        
        # Format waiting vehicles information
        waiting_vehicles_info = []
        for vehicle, current_load in waiting_vehicles:
            # Check if the vehicle has any pending requests
            pending_requests = ResourceRequest.query.filter_by(
                vehicle_id=vehicle.vid,
                status='pending'
            ).count()
            
            # Calculate total load including the new request if it's being added
            total_load = current_load or 0
            
            # Only include vehicles that have at least one pending request
            if pending_requests > 0:
                waiting_vehicles_info.append({
                    'vehicle_id': vehicle.vehicle_id,
                    'capacity': vehicle.capacity,
                    'current_load': total_load,
                    'available_capacity': vehicle.capacity - total_load,
                    'needs_more': total_load < (vehicle.capacity * 0.9),
                    'pending_requests': pending_requests
                })
        
        return jsonify({
            'success': True,
            'requests': formatted_requests,
            'waiting_vehicles': waiting_vehicles_info
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting resource requests: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@warehouse_manager_bp.route('/process_resource_request', methods=['POST'])
@login_required
@warehouse_manager_required
def process_resource_request():
    try:
        data = request.get_json()
        if not data or 'request_id' not in data:
            return jsonify({'success': False, 'error': 'Missing required data'}), 400

        request_id = data['request_id']
        action = data.get('action', 'accept')  # Default to accept if not specified
        vehicle_id = data.get('vehicle_id')  # This is actually the vid

        # Get the resource request
        resource_request = ResourceRequest.query.get(request_id)
        if not resource_request:
            return jsonify({'success': False, 'error': 'Resource request not found'}), 404

        if action == 'accept':
            if not vehicle_id:
                return jsonify({'success': False, 'error': 'Vehicle ID is required for accepting requests'}), 400

            # Get the vehicle using vid
            vehicle = Vehicle.query.get(vehicle_id)
            if not vehicle:
                return jsonify({'success': False, 'error': 'Vehicle not found'}), 404

            # Calculate total weight of the new request
            new_request_weight = (
                resource_request.food_quantity +
                resource_request.water_quantity +
                resource_request.essentials_quantity +
                resource_request.clothes_quantity
            )

            # Get current load of the vehicle from pending requests
            current_load = db.session.query(
                db.func.sum(
                    ResourceRequest.food_quantity +
                    ResourceRequest.water_quantity +
                    ResourceRequest.essentials_quantity +
                    ResourceRequest.clothes_quantity
                )
            ).filter(
                ResourceRequest.vehicle_id == vehicle.vid,
                ResourceRequest.status == 'pending'
            ).scalar() or 0

            # Calculate total load after adding the new request
            total_load = current_load + new_request_weight

            # Update resource request with vehicle assignment
            resource_request.vehicle_id = vehicle.vid
            resource_request.status = 'pending'  # Keep as pending until 90% capacity is reached
            resource_request.updated_at = datetime.now()

            # Set to in_transit immediately for emergency requests or if we've reached 90% capacity
            if resource_request.priority == 'emergency' or total_load >= (vehicle.capacity * 0.9):
                # Get all pending requests for this vehicle and update their status to in_transit
                pending_requests = ResourceRequest.query.filter_by(
                    vehicle_id=vehicle.vid,
                    status='pending'
                ).all()
                
                # Calculate ETA once for all requests
                camp = Camp.query.get(resource_request.camp_id)
                if not camp:
                    return jsonify({'success': False, 'error': 'Camp not found'}), 404

                warehouse = Warehouse.query.get(resource_request.warehouse_id)
                if not warehouse:
                    return jsonify({'success': False, 'error': 'Warehouse not found'}), 404

                camp_location = (camp.coordinates_lat, camp.coordinates_lng)
                warehouse_location = (warehouse.coordinates_lat, warehouse.coordinates_lng)
                _, duration = calculate_road_distance_and_duration(camp_location, warehouse_location)

                eta = None
                if duration:
                    eta = datetime.now() + timedelta(minutes=duration)

                # Update all pending requests to in_transit and update warehouse resources
                for req in pending_requests:
                    req.status = 'in_transit'
                    req.updated_at = datetime.now()
                    req.eta = eta
                    
                    # Update warehouse resources
                    warehouse.food_available -= req.food_quantity
                    warehouse.water_available -= req.water_quantity
                    warehouse.essentials_available -= req.essentials_quantity
                    warehouse.clothes_available -= req.clothes_quantity
                    
                    warehouse.food_used += req.food_quantity
                    warehouse.water_used += req.water_quantity
                    warehouse.essentials_used += req.essentials_quantity
                    warehouse.clothes_used += req.clothes_quantity

                # Update vehicle status
                vehicle.status = 'in_transit'
                vehicle.updated_at = datetime.now()

                # Create notification for camp manager
                notification_data = {
                    'vehicle_id': vehicle.vehicle_id,
                    'warehouse_name': warehouse.name,
                    'eta': eta.strftime('%Y-%m-%d %H:%M:%S') if eta else None,
                    'request_id': resource_request.id
                }

                # Create notification in database
                notification = Notification(
                    user_id=resource_request.camp_id,  # Using camp_id as user_id for camp manager
                    type='vehicle_dispatch',
                    message=f'Vehicle {vehicle.vehicle_id} has been dispatched from {warehouse.name}',
                    data=notification_data
                )
                db.session.add(notification)
            else:
                # Vehicle is still waiting for more requests
                vehicle.status = 'available'
                vehicle.updated_at = datetime.now()

        elif action == 'reject':
            # Get the camp for this request
            camp = Camp.query.get(resource_request.camp_id)
            if not camp:
                return jsonify({'success': False, 'error': 'Camp not found'}), 404
                
            # Get the current warehouse
            current_warehouse = Warehouse.query.get(resource_request.warehouse_id)
            if not current_warehouse:
                return jsonify({'success': False, 'error': 'Current warehouse not found'}), 404
                
            # Find the next nearest warehouse
            warehouses = Warehouse.query.filter(
                Warehouse.wid != current_warehouse.wid,
                Warehouse.status == 'Operational'
            ).all()
            
            next_warehouse = None
            min_distance = float('inf')
            
            camp_location = (camp.coordinates_lat, camp.coordinates_lng)
            
            for warehouse in warehouses:
                warehouse_location = (warehouse.coordinates_lat, warehouse.coordinates_lng)
                distance, _ = calculate_road_distance_and_duration(camp_location, warehouse_location)
                
                if distance and distance < min_distance:
                    min_distance = distance
                    next_warehouse = warehouse
            
            if next_warehouse:
                # Create a new resource request for the next warehouse
                new_request = ResourceRequest(
                    camp_id=resource_request.camp_id,
                    warehouse_id=next_warehouse.wid,
                    food_quantity=resource_request.food_quantity,
                    water_quantity=resource_request.water_quantity,
                    essentials_quantity=resource_request.essentials_quantity,
                    clothes_quantity=resource_request.clothes_quantity,
                    priority=resource_request.priority,
                    status='pending'
                )
                
                # Update the original request status to rejected
                resource_request.status = 'rejected'
                resource_request.updated_at = datetime.now()
                
                # Add the new request to the database
                db.session.add(new_request)
                
                # Create notification for camp manager about rejection and forwarding
                notification = Notification(
                    user_id=resource_request.camp_id,
                    type='request_rejected_and_forwarded',
                    message=f'Your resource request has been rejected by {current_warehouse.name} and forwarded to {next_warehouse.name}',
                    data={
                        'request_id': resource_request.id,
                        'forwarded_to': next_warehouse.name
                    }
                )
                db.session.add(notification)
                
                # Commit changes before returning response
                db.session.commit()
                
                # Return success with next warehouse info
                return jsonify({
                    'success': True,
                    'message': 'Resource request rejected and forwarded to next nearest warehouse',
                    'next_warehouse': next_warehouse.name,
                    'status': 'rejected_and_forwarded'
                })
            else:
                # No other warehouses available, just reject the request
                resource_request.status = 'rejected'
                resource_request.updated_at = datetime.now()
                
                # Create notification for camp manager about rejection
                notification = Notification(
                    user_id=resource_request.camp_id,
                    type='request_rejected',
                    message='Your resource request has been rejected',
                    data={'request_id': resource_request.id}
                )
                db.session.add(notification)
                
                # Commit changes before returning response
                db.session.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Resource request rejected (no other warehouses available)',
                    'status': 'rejected'
                })

        # Commit all changes for accept action
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Resource request {action}ed successfully',
            'eta': resource_request.eta.strftime('%Y-%m-%d %H:%M:%S') if resource_request.eta else None,
            'status': resource_request.status
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error processing resource request: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@warehouse_manager_bp.route('/update_warehouse_status', methods=['PUT'])
@login_required
@warehouse_manager_required
def update_warehouse_status():
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400

        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'error': 'No warehouse found'}), 404

        warehouse.status = new_status
        db.session.commit()

        return jsonify({
            'message': 'Warehouse status updated successfully',
            'status': new_status
        })
    except Exception as e:
        current_app.logger.error(f"Error updating warehouse status: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

@warehouse_manager_bp.route('/list_vehicles')
@login_required
@warehouse_manager_required
def list_vehicles():
    try:
        # Get the warehouse managed by the current user
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'error': 'No warehouse found'}), 404

        # Get all vehicles for this warehouse
        vehicles = Vehicle.query.filter_by(warehouse_id=warehouse.wid).all()
        
        return jsonify([{
            'vid': vehicle.vid,
            'vehicle_id': vehicle.vehicle_id,
            'capacity': vehicle.capacity,
            'status': vehicle.status,
            'warehouse_id': vehicle.warehouse_id
        } for vehicle in vehicles])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@warehouse_manager_bp.route('/add_vehicle', methods=['POST'])
@login_required
@warehouse_manager_required
def add_vehicle():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        vehicle_id = data.get('vehicle_id')
        capacity = data.get('capacity')

        if not vehicle_id or not capacity:
            return jsonify({'error': 'Missing required fields'}), 400

        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'error': 'No warehouse found'}), 404

        # Check if vehicle_id already exists
        existing_vehicle = Vehicle.query.filter_by(vehicle_id=vehicle_id).first()
        if existing_vehicle:
            return jsonify({'error': 'Vehicle ID already exists'}), 400

        vehicle = VehicleManager.add_vehicle(vehicle_id, capacity, warehouse.wid)
        if not vehicle:
            return jsonify({'error': 'Failed to add vehicle'}), 500

        return jsonify({
            'vid': vehicle.vid,
            'vehicle_id': vehicle.vehicle_id,
            'capacity': vehicle.capacity,
            'status': vehicle.status
        }), 201
    except Exception as e:
        current_app.logger.error(f"Error adding vehicle: {str(e)}")
        return jsonify({'error': str(e)}), 500

@warehouse_manager_bp.route('/update_vehicle/<int:vid>', methods=['PUT'])
@login_required
@warehouse_manager_required
def update_vehicle(vid):
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        vehicle = Vehicle.query.get(vid)
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404

        # Verify the vehicle belongs to the user's warehouse
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse or vehicle.warehouse_id != warehouse.wid:
            return jsonify({'error': 'Unauthorized access'}), 403

        # Update vehicle details
        if 'vehicle_id' in data:
            vehicle.vehicle_id = data['vehicle_id']
        if 'capacity' in data:
            vehicle.capacity = data['capacity']
        if 'status' in data:
            vehicle.status = data['status']

        db.session.commit()
        return jsonify({
            'message': 'Vehicle updated successfully',
            'vehicle': {
                'vid': vehicle.vid,
                'vehicle_id': vehicle.vehicle_id,
                'capacity': vehicle.capacity,
                'status': vehicle.status
            }
        })
    except Exception as e:
        current_app.logger.error(f"Error updating vehicle: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@warehouse_manager_bp.route('/delete_vehicle/<int:vid>', methods=['DELETE'])
@login_required
@warehouse_manager_required
def delete_vehicle(vid):
    try:
        vehicle = Vehicle.query.get(vid)
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404

        # Verify the vehicle belongs to the user's warehouse
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse or vehicle.warehouse_id != warehouse.wid:
            return jsonify({'error': 'Unauthorized access'}), 403

        # Check if vehicle has any active resource requests
        active_requests = ResourceRequest.query.filter_by(
            vehicle_id=vid,
            status='in_transit'
        ).all()

        if active_requests:
            return jsonify({
                'error': 'Cannot delete vehicle with active deliveries. Please complete or cancel all deliveries first.'
            }), 400

        # Update any pending resource requests that were assigned to this vehicle
        pending_requests = ResourceRequest.query.filter_by(
            vehicle_id=vid,
            status='pending'
        ).all()

        for request in pending_requests:
            request.vehicle_id = None

        # Delete the vehicle
        db.session.delete(vehicle)
        db.session.commit()

        return jsonify({'message': 'Vehicle deleted successfully'})
    except Exception as e:
        current_app.logger.error(f"Error deleting vehicle: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@warehouse_manager_bp.route('/update_resources', methods=['POST'])
@login_required
@warehouse_manager_required
def update_resources():
    try:
        data = request.get_json()
        
        # Get the warehouse managed by the current user
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'success': False, 'error': 'Warehouse not found'}), 404
            
        # Get new capacity values
        food = data.get('food', warehouse.food_capacity)
        water = data.get('water', warehouse.water_capacity)
        essentials = data.get('essentials', warehouse.essential_capacity)
        clothes = data.get('clothes', warehouse.clothes_capacity)
        
        # Validate that new capacity is not less than current available resources
        if food < warehouse.food_available:
            return jsonify({'success': False, 'error': 'Food capacity cannot be less than current available food'}), 400
        if water < warehouse.water_available:
            return jsonify({'success': False, 'error': 'Water capacity cannot be less than current available water'}), 400
        if essentials < warehouse.essentials_available:
            return jsonify({'success': False, 'error': 'Essential capacity cannot be less than current available essentials'}), 400
        if clothes < warehouse.clothes_available:
            return jsonify({'success': False, 'error': 'Clothes capacity cannot be less than current available clothes'}), 400
            
        # Validate that quantities are non-negative
        if any(q < 0 for q in [food, water, essentials, clothes]):
            return jsonify({"success": False, "error": "Resource quantities cannot be negative"}), 400
        
        # Update warehouse resources
        warehouse.food_capacity = food
        warehouse.water_capacity = water
        warehouse.essential_capacity = essentials
        warehouse.clothes_capacity = clothes
        
        # Commit changes
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Resources updated successfully",
            "warehouse": {
                "food_capacity": warehouse.food_capacity,
                "water_capacity": warehouse.water_capacity,
                "essential_capacity": warehouse.essential_capacity,
                "clothes_capacity": warehouse.clothes_capacity
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@warehouse_manager_bp.route('/update_available_resources', methods=['POST'])
@login_required
@warehouse_manager_required
def update_available_resources():
    try:
        data = request.get_json()
        
        # Get the warehouse managed by the current user
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'success': False, 'error': 'Warehouse not found'}), 404
            
        # Validate that available resources don't exceed capacity
        if 'food' in data and data['food'] > warehouse.food_capacity:
            return jsonify({'success': False, 'error': 'Food available cannot exceed food capacity'}), 400
        if 'water' in data and data['water'] > warehouse.water_capacity:
            return jsonify({'success': False, 'error': 'Water available cannot exceed water capacity'}), 400
        if 'essentials' in data and data['essentials'] > warehouse.essential_capacity:
            return jsonify({'success': False, 'error': 'Essentials available cannot exceed essentials capacity'}), 400
        if 'clothes' in data and data['clothes'] > warehouse.clothes_capacity:
            return jsonify({'success': False, 'error': 'Clothes available cannot exceed clothes capacity'}), 400
            
        # Update available resources
        if 'food' in data:
            warehouse.food_available = data['food']
        if 'water' in data:
            warehouse.water_available = data['water']
        if 'essentials' in data:
            warehouse.essentials_available = data['essentials']
        if 'clothes' in data:
            warehouse.clothes_available = data['clothes']
            
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Available resources updated successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@warehouse_manager_bp.route('/update_used_resources', methods=['POST'])
@login_required
@warehouse_manager_required
def update_used_resources():
    try:
        data = request.get_json()
        
        # Get the warehouse managed by the current user
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'success': False, 'error': 'Warehouse not found'}), 404
            
        # Update used resources
        if 'food' in data:
            warehouse.food_used = data['food']
        if 'water' in data:
            warehouse.water_used = data['water']
        if 'essentials' in data:
            warehouse.essentials_used = data['essentials']
        if 'clothes' in data:
            warehouse.clothes_used = data['clothes']
            
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Used resources updated successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@warehouse_manager_bp.route('/get_available_vehicles/<int:request_id>')
@login_required
@warehouse_manager_required
def get_available_vehicles(request_id):
    """Get available vehicles for a resource request."""
    try:
        # Get the warehouse managed by the current user
        warehouse = Warehouse.query.filter_by(manager_id=current_user.uid).first()
        if not warehouse:
            return jsonify({'success': False, 'error': 'No warehouse found'}), 404
            
        # Get the resource request
        resource_request = ResourceRequest.query.get_or_404(request_id)
        
        # Check if the request is still pending
        if resource_request.status != 'pending':
            return jsonify({'success': False, 'error': 'Request is no longer pending'}), 400
            
        # Calculate total request weight
        total_weight = (
            resource_request.food_quantity +
            resource_request.water_quantity +
            resource_request.essentials_quantity +
            resource_request.clothes_quantity
        )
        
        # Get available vehicles
        vehicles = Vehicle.query.filter_by(
            warehouse_id=warehouse.wid,
            status='available'
        ).all()
        
        available_vehicles = []
        for vehicle in vehicles:
            try:
                # Get current vehicle load from other pending requests
                current_load = db.session.query(
                    db.func.sum(
                        ResourceRequest.food_quantity +
                        ResourceRequest.water_quantity +
                        ResourceRequest.essentials_quantity +
                        ResourceRequest.clothes_quantity
                    )
                ).filter(
                    ResourceRequest.vehicle_id == vehicle.vid,
                    ResourceRequest.status == 'pending'
                ).scalar() or 0
                
                # Check if vehicle can accommodate the request
                if (current_load + total_weight) <= vehicle.capacity:
                    available_vehicles.append({
                        'vid': vehicle.vid,
                        'vehicle_id': vehicle.vehicle_id,
                        'capacity': vehicle.capacity,
                        'current_load': current_load,
                        'available_capacity': vehicle.capacity - current_load,
                        'will_reach_90_percent': (current_load + total_weight) >= (vehicle.capacity * 0.9)
                    })
            except Exception as e:
                current_app.logger.error(f"Error processing vehicle {vehicle.vid}: {str(e)}")
                continue
        
        return jsonify({
            'success': True,
            'vehicles': available_vehicles,
            'request_priority': resource_request.priority
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting available vehicles: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
