from flask import jsonify, render_template, request
from . import camp_manager_bp
from flask_login import current_user, login_required
from app.db_manager import CampManager, CampNotFound
from app.resource_allocation import (
    allocate_resources,
    calculate_road_distance_and_duration,
    format_eta
)
from app.models import Camp, Vehicle, UserRequest, ResourceRequest, Warehouse, User
from app import db
from datetime import datetime, timedelta
import os
import json
from flask import flash

@camp_manager_bp.route('/')
@login_required
def index():
    # Get the camp managed by the current user
    camp = Camp.query.filter_by(camp_head_id=current_user.uid).first()
    if not camp:
        return render_template('camp_manager/no_camp.html')
    
    return render_template('camp_manager/index.html', camp=camp)

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
            if request.vehicle and request.warehouse:
                # Get vehicle's current location (in a real system, this would come from GPS)
                # For now, we'll use the warehouse location
                warehouse = request.warehouse
                current_location = (warehouse.coordinates_lat, warehouse.coordinates_lng)
                camp_location = (camp.coordinates_lat, camp.coordinates_lng)
            
                # Calculate ETA
                _, duration = calculate_road_distance_and_duration(current_location, camp_location)
                if duration:
                    eta = datetime.now() + timedelta(seconds=duration)
                    formatted_eta = format_eta(duration)
                    
                    delivery_status.append({
                        'request_id': request.id,
                        'vehicle_id': request.vehicle.vid,
                        'warehouse': warehouse.name,
                        'eta': formatted_eta,
                        'status': request.status
                    })
        
        return jsonify({
            'success': True,
            'deliveries': delivery_status
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting delivery status: {str(e)}'
        }), 500 