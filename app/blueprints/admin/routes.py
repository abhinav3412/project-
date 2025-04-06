from flask import render_template, request, jsonify, flash
from flask_login import login_required
from app.db_manager import get_table_count
from app.data import load_sensor_configs, save_sensor_configs, generate_sensor_data, save_sensor_data_to_json
from . import admin_bp
import json
import os
from app.models import User, Camp, Warehouse, Sensor, Request
from app.extensions import db

def get_table_count():
    """Get count of records from various tables"""
    return {
        'users': User.query.count(),
        'camps': Camp.query.count(),
        'warehouses': Warehouse.query.count(),
        'sensors': Sensor.query.count()
    }

@admin_bp.route('/')
@login_required
def index():
    counts = get_table_count()
    return render_template('admin/index.html', counts=counts)

@admin_bp.route('/user')
@login_required
def user():
    return render_template('admin/user.html')

@admin_bp.route('/camp')
@login_required
def camp():
    return render_template('admin/camp.html')

@admin_bp.route('/warehouse')
@login_required
def warehouse():
    return render_template('admin/warehouse.html')

@admin_bp.route('/sensor')
@login_required
def sensor():
    try:
        # Get sensors from database
        db_sensors = Sensor.query.all()
        
        # Get sensors from JSON file
        try:
            with open('app/static/data/sensor_data.json', 'r') as f:
                json_sensors = json.load(f)
                json_sensor_list = [{
                    'sid': sensor['id'],
                    'name': sensor['name'],
                    'latitude': sensor['latitude'],
                    'longitude': sensor['longitude'],
                    'soil_type': sensor['soil_type'],
                    'status': sensor.get('status', 'Active'),
                    'operational_status': sensor.get('operational_status', 'Active')
                } for sensor in json_sensors]
        except (FileNotFoundError, json.JSONDecodeError):
            json_sensor_list = []
        
        # Combine both lists, avoiding duplicates based on sensor ID
        all_sensors = []
        seen_ids = set()
        
        # Add database sensors first
        for sensor in db_sensors:
            seen_ids.add(sensor.sid)
            all_sensors.append(sensor)
        
        # Add JSON sensors that aren't in the database
        for sensor_data in json_sensor_list:
            if sensor_data['sid'] not in seen_ids:
                # Create a Sensor object from the JSON data
                json_sensor = Sensor(
                    sid=sensor_data['sid'],
                    name=sensor_data['name'],
                    latitude=sensor_data['latitude'],
                    longitude=sensor_data['longitude'],
                    soil_type=sensor_data['soil_type'],
                    status=sensor_data['status'],
                    operational_status=sensor_data['operational_status']
                )
                all_sensors.append(json_sensor)
        
        return render_template('admin/sensor.html', sensors=all_sensors)
    except Exception as e:
        flash(f"Error loading sensors: {str(e)}", "error")
        return render_template('admin/sensor.html', sensors=[])

@admin_bp.route('/add_sensor', methods=['POST'])
@login_required
def add_sensor():
    try:
        data = request.get_json()

        # Create new sensor in database
        new_sensor = Sensor(
            name=data['sensor_name'],
            latitude=data['latitude'],
            longitude=data['longitude'],
            soil_type=data['soil_type'],
            status='Active',
            operational_status='Active'
        )
        db.session.add(new_sensor)
        db.session.commit()  # Commit to get the sid
        
        # Now we can use new_sensor.sid
        sensor_id = new_sensor.sid
        
        # Generate fake data for the new sensor
        fake_data = generate_fake_sensor_data(
            sensor_id=sensor_id,
            name=new_sensor.name,
            latitude=new_sensor.latitude,
            longitude=new_sensor.longitude,
            soil_type=new_sensor.soil_type
        )
        
        # Update sensor_data.json
        try:
            with open('app/static/data/sensor_data.json', 'r') as f:
                sensor_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            sensor_data = []
            
        # Remove any existing entries for this sensor ID
        sensor_data = [s for s in sensor_data if s.get('id') != sensor_id]
        sensor_data.append(fake_data)
        
        with open('app/static/data/sensor_data.json', 'w') as f:
            json.dump(sensor_data, f, indent=4)
            
        # Update sensor_configs.json
        try:
            with open('app/static/data/sensor_configs.json', 'r') as f:
                configs = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            configs = []
            
        # Remove any existing config for this sensor ID
        configs = [c for c in configs if c.get('id') != sensor_id]
        
        # Add new config
        new_config = {
            'id': sensor_id,
            'name': new_sensor.name,
            'latitude': new_sensor.latitude,
            'longitude': new_sensor.longitude,
            'soil_type': new_sensor.soil_type,
            'operational_status': new_sensor.operational_status
        }
        configs.append(new_config)
        
        with open('app/static/data/sensor_configs.json', 'w') as f:
            json.dump(configs, f, indent=4)
            
        # Update map sensor data
        try:
            with open('app/static/sensor_data.json', 'r') as f:
                map_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            map_data = []
            
        # Remove any existing entries for this sensor ID
        map_data = [m for m in map_data if m.get('id') != sensor_id]
        
        # Add new map data
        new_map_data = {
            'id': sensor_id,
            'lat': new_sensor.latitude,
            'lng': new_sensor.longitude,
            'label': f"{new_sensor.name}: {new_sensor.soil_type}, India",
            'rainfall': fake_data['rainfall'],
            'forecasted_rainfall': fake_data['forecasted_rainfall'],
            'soil_saturation': fake_data['soil_saturation'],
            'slope': fake_data['slope'],
            'seismic_activity': fake_data['seismic_activity'],
            'soil_type': new_sensor.soil_type,
            'status': fake_data['status'],
            'risk': fake_data['risk_level'],
            'affectedRadius': fake_data['affected_radius'],
            'sensor': new_sensor.name,
            'predicted_landslide_time': fake_data['predicted_landslide_time']
        }
        map_data.append(new_map_data)
        
        with open('app/static/sensor_data.json', 'w') as f:
            json.dump(map_data, f, indent=4)
            
        return jsonify({
            'success': True,
            'message': 'Sensor added successfully',
            'sensor': {
                'id': sensor_id,
                'name': new_sensor.name,
                'latitude': new_sensor.latitude,
                'longitude': new_sensor.longitude,
                'soil_type': new_sensor.soil_type,
                'operational_status': new_sensor.operational_status
            }
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error in add_sensor: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

def generate_fake_sensor_data(sensor_id, name, latitude, longitude, soil_type):
    """Generate fake sensor data with realistic values"""
    import random
    from datetime import datetime, timedelta
    
    # Generate base values
    rainfall = random.uniform(0, 200)
    soil_saturation = random.uniform(40, 80)
    slope = random.uniform(10, 50)
    seismic_activity = random.uniform(0, 10)
    
    # Calculate risk level based on parameters
    risk_score = (rainfall/200 * 0.3 + 
                 soil_saturation/80 * 0.2 + 
                 slope/50 * 0.3 + 
                 seismic_activity/10 * 0.2)
    
    if risk_score > 0.7:
        risk_level = "High"
        status = "Alert"
        affected_radius = random.randint(5000, 10000)
        predicted_time = (datetime.now() + timedelta(hours=random.randint(1, 48))).strftime("%d-%m-%Y %H:%M")
        predicted_landslide_time = f"48h - {predicted_time}"
    elif risk_score > 0.4:
        risk_level = "Medium"
        status = "Warning"
        affected_radius = random.randint(2000, 5000)
        predicted_time = (datetime.now() + timedelta(hours=random.randint(49, 168))).strftime("%d-%m-%Y %H:%M")
        predicted_landslide_time = f"1w - {predicted_time}"
    else:
        risk_level = "Low"
        status = "Normal"
        affected_radius = 0
        predicted_landslide_time = "No immediate risk"
    
    return {
        "id": sensor_id,
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "soil_type": soil_type,
        "timestamp": datetime.now().isoformat(),
        "rainfall": round(rainfall, 2),
        "forecasted_rainfall": round(rainfall * random.uniform(0.5, 1.5), 2),
        "soil_saturation": round(soil_saturation, 2),
        "slope": round(slope, 2),
        "seismic_activity": round(seismic_activity, 2),
        "status": status,
        "risk_level": risk_level,
        "affected_radius": affected_radius,
        "predicted_landslide_time": predicted_landslide_time,
        "trends": {
            "rainfall": {"trend": "stable", "change_rate": 0, "volatility": 0},
            "soil_saturation": {"trend": "stable", "change_rate": 0, "volatility": 0},
            "slope": {"trend": "stable", "change_rate": 0, "volatility": 0},
            "seismic_activity": {"trend": "stable", "change_rate": 0, "volatility": 0}
        },
        "soil_stability": {
            "shear_strength": round(random.uniform(-1, 1), 2),
            "factor_of_safety": round(random.uniform(-1, 1), 2),
            "stability_index": round(random.uniform(-1, 1), 2),
            "driving_force": round(random.uniform(1000, 10000), 2),
            "resisting_force": round(random.uniform(-1, 1), 2),
            "pore_pressure_ratio": round(random.uniform(0.5, 1.5), 2)
        },
        "operational_status": "Active"
    }

@admin_bp.route('/delete_sensor/<int:sensor_id>', methods=['POST'])
@login_required
def delete_sensor(sensor_id):
    try:
        # Check if sensor exists in database
        sensor = Sensor.query.get(sensor_id)
        if not sensor:
            print(f"Sensor with ID {sensor_id} not found in database")
            # Even if not in database, we should still try to remove from JSON files
            sensor_sid = sensor_id  # Use the provided ID
        else:
            print(f"Found sensor with ID {sensor_id}, sid: {sensor.sid}")
            sensor_sid = sensor.sid  # Store the sid before deleting
        db.session.delete(sensor)
        db.session.commit()
        print(f"Deleted sensor from database")
        
        # Remove from sensor_data.json
        try:
            with open('app/static/data/sensor_data.json', 'r') as f:
                sensor_data = json.load(f)
            print(f"Loaded sensor_data.json with {len(sensor_data)} entries")
            sensor_data = [s for s in sensor_data if s.get('id') != sensor_sid]
            print(f"Filtered to {len(sensor_data)} entries")
            with open('app/static/data/sensor_data.json', 'w') as f:
                json.dump(sensor_data, f, indent=4)
            print(f"Updated sensor_data.json")
        except Exception as e:
            print(f"Error updating sensor_data.json: {str(e)}")
            
        # Remove from sensor_configs.json
        try:
            with open('app/static/data/sensor_configs.json', 'r') as f:
                configs = json.load(f)
            print(f"Loaded sensor_configs.json with {len(configs)} entries")
            configs = [c for c in configs if c.get('id') != sensor_sid]
            print(f"Filtered to {len(configs)} entries")
            with open('app/static/data/sensor_configs.json', 'w') as f:
                json.dump(configs, f, indent=4)
            print(f"Updated sensor_configs.json")
        except Exception as e:
            print(f"Error updating sensor_configs.json: {str(e)}")
            
        return jsonify({"success": True, "message": "Sensor deleted successfully"})
    except Exception as e:
        print(f"Error deleting sensor: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route('/get_sensors')
@login_required
def get_sensors():
    try:
        # Get sensors from database
        db_sensors = Sensor.query.all()
        db_sensor_list = [{
            'id': sensor.sid,
            'name': sensor.name,
            'latitude': sensor.latitude,
            'longitude': sensor.longitude,
            'soil_type': sensor.soil_type,
            'status': sensor.status,
            'operational_status': sensor.operational_status,
            'source': 'database'
        } for sensor in db_sensors]

        # Get sensors from JSON file
        try:
            with open('app/static/data/sensor_data.json', 'r') as f:
                json_sensors = json.load(f)
                json_sensor_list = [{
                    'id': sensor['id'],
                    'name': sensor['name'],
                    'latitude': sensor['latitude'],
                    'longitude': sensor['longitude'],
                    'soil_type': sensor['soil_type'],
                    'status': sensor['status'],
                    'operational_status': sensor.get('operational_status', 'Active'),
                    'source': 'json'
                } for sensor in json_sensors]
        except (FileNotFoundError, json.JSONDecodeError):
            json_sensor_list = []

        # Combine both lists, avoiding duplicates based on sensor ID
        all_sensors = []
        seen_ids = set()
        
        for sensor in db_sensor_list + json_sensor_list:
            if sensor['id'] not in seen_ids:
                seen_ids.add(sensor['id'])
                all_sensors.append(sensor)

        return jsonify({
            'success': True,
            'sensors': all_sensors
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/get_sensor/<int:sensor_id>')
@login_required
def get_sensor(sensor_id):
    try:
        sensor = Sensor.query.get_or_404(sensor_id)
        return jsonify({
            'success': True,
            'sensor': {
                'sid': sensor.sid,
                'name': sensor.name,
                'latitude': sensor.latitude,
                'longitude': sensor.longitude,
                'soil_type': sensor.soil_type,
                'status': sensor.status,
                'operational_status': sensor.operational_status
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/update_sensor/<int:sensor_id>', methods=['POST'])
@login_required
def update_sensor(sensor_id):
    try:
        sensor = Sensor.query.get_or_404(sensor_id)
        data = request.get_json()
        
        if 'name' in data:
            sensor.name = data['name']
        if 'latitude' in data:
            sensor.latitude = data['latitude']
        if 'longitude' in data:
            sensor.longitude = data['longitude']
        if 'soil_type' in data:
            sensor.soil_type = data['soil_type']
        if 'status' in data:
            sensor.status = data['status']
            # Also update operational_status to match status
            sensor.operational_status = data['status']
            
        db.session.commit()

        # Update sensor_data.json
        try:
            with open('app/static/data/sensor_data.json', 'r') as f:
                sensor_data = json.load(f)
            for s in sensor_data:
                if s.get('id') == sensor_id:
                    s['status'] = sensor.status
                    s['operational_status'] = sensor.status
                    # Set is_inactive flag based on status
                    s['is_inactive'] = sensor.status.lower() != 'active'
            with open('app/static/data/sensor_data.json', 'w') as f:
                json.dump(sensor_data, f, indent=4)
        except Exception as e:
            print(f"Error updating sensor_data.json: {str(e)}")

        # Update sensor_configs.json
        try:
            with open('app/static/data/sensor_configs.json', 'r') as f:
                configs = json.load(f)
            for config in configs:
                if config.get('id') == sensor_id:
                    config['operational_status'] = sensor.status
                    # Set is_inactive flag based on status
                    config['is_inactive'] = sensor.status.lower() != 'active'
            with open('app/static/data/sensor_configs.json', 'w') as f:
                json.dump(configs, f, indent=4)
        except Exception as e:
            print(f"Error updating sensor_configs.json: {str(e)}")

        # Update map sensor data
        try:
            with open('app/static/sensor_data.json', 'r') as f:
                map_data = json.load(f)
            for m in map_data:
                if m.get('id') == sensor_id:
                    m['status'] = sensor.status
                    m['operational_status'] = sensor.status
                    # Set is_inactive flag based on status
                    m['is_inactive'] = sensor.status.lower() != 'active'
            with open('app/static/sensor_data.json', 'w') as f:
                json.dump(map_data, f, indent=4)
        except Exception as e:
            print(f"Error updating map sensor data: {str(e)}")
            
        return jsonify({'success': True, 'message': 'Sensor updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/delete_json_sensor', methods=['POST'])
@login_required
def delete_json_sensor():
    try:
        data = request.get_json()
        sensor_id = data.get('sensor_id')
        
        if not sensor_id:
            return jsonify({'success': False, 'message': 'No sensor ID provided'}), 400
            
        # Load current sensor data
        try:
            with open('app/static/data/sensor_data.json', 'r') as f:
                sensors_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify({'success': False, 'message': 'No sensor data found'}), 404
            
        # Remove the sensor
        sensors_data = [s for s in sensors_data if s['id'] != sensor_id]
        
        # Save updated data
        save_sensor_data_to_json(sensors_data)
        
        # Also update sensor configs
        sensor_configs = load_sensor_configs()
        sensor_configs = [c for c in sensor_configs if c['id'] != sensor_id]
        save_sensor_configs(sensor_configs)
        
        return jsonify({'success': True, 'message': 'Sensor deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/warehouse_manager/get_warehouse_details')
@login_required
def get_warehouse_details():
    try:
        warehouses = Warehouse.query.all()
        return jsonify({
            'success': True,
            'warehouses': [{
                'wid': warehouse.wid,
                'name': warehouse.name,
                'location': warehouse.location,
                'coordinates_lat': warehouse.coordinates_lat,
                'coordinates_lng': warehouse.coordinates_lng,
                'contact_number': warehouse.contact_number,
                'food_capacity': warehouse.food_capacity,
                'water_capacity': warehouse.water_capacity,
                'essential_capacity': warehouse.essential_capacity,
                'clothes_capacity': warehouse.clothes_capacity,
                'manager_id': warehouse.manager_id,
                'status': warehouse.status,
                'created_at': warehouse.created_at.isoformat() if warehouse.created_at else None
            } for warehouse in warehouses]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@admin_bp.route('/get_sensor_data')
@login_required
def get_sensor_data():
    """
    Get sensor data in the same format as the user endpoint.
    This ensures consistency between admin and user maps.
    """
    try:
        # Get sensors from JSON file
        json_sensors = []
        try:
            with open('app/static/data/sensor_data.json') as file:
                json_sensors = json.load(file)
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        
        # Get sensors from database
        db_sensors = Sensor.query.all()
        
        # Create a dictionary to store unique sensors by ID
        unique_sensors = {}
        
        # First, add JSON sensors to the dictionary
        for sensor in json_sensors:
            sensor_id = sensor.get('id')
            if sensor_id and sensor_id not in unique_sensors:
                unique_sensors[sensor_id] = sensor
        
        # Then, add database sensors that aren't in JSON
        for sensor in db_sensors:
            if sensor.sid not in unique_sensors:
                # Create sensor data for this database sensor
                sensor_data = {
                    'id': sensor.sid,
                    'name': sensor.name,
                    'latitude': sensor.latitude,
                    'longitude': sensor.longitude,
                    'soil_type': sensor.soil_type,
                    'status': sensor.status,
                    'operational_status': sensor.operational_status,
                    'is_inactive': sensor.operational_status.lower() != 'active'
                }
                unique_sensors[sensor.sid] = sensor_data
        
        # Process all sensors
        result = []
        for sensor in unique_sensors.values():
            # Check if sensor is inactive
            is_inactive = sensor.get('operational_status', '').lower() != 'active' or sensor.get('is_inactive', False)
            
            if is_inactive:
                # For inactive sensors, return N/A values for all data fields
                result.append({
                    'id': sensor.get('id'),
                    'name': sensor.get('name'),
                    'latitude': sensor.get('latitude'),
                    'longitude': sensor.get('longitude'),
                    'soil_type': sensor.get('soil_type'),
                    'rainfall': 'N/A',
                    'forecasted_rainfall': 'N/A',
                    'soil_saturation': 'N/A',
                    'slope': 'N/A',
                    'seismic_activity': 'N/A',
                    'status': 'Inactive',
                    'risk_level': 'N/A',
                    'affected_radius': 'N/A',
                    'predicted_landslide_time': 'N/A',
                    'operational_status': 'Inactive',
                    'timestamp': sensor.get('timestamp', ''),
                    'is_inactive': True
                })
            else:
                # For active sensors, generate new data
                new_data = generate_fake_sensor_data(
                    sensor_id=sensor.get('id'),
                    name=sensor.get('name'),
                    latitude=sensor.get('latitude'),
                    longitude=sensor.get('longitude'),
                    soil_type=sensor.get('soil_type')
                )
                if new_data:
                    result.append(new_data)
        
        # Sort by ID to ensure consistent order
        result.sort(key=lambda x: x['id'])
        
        return jsonify({
            'success': True,
            'sensors': result
        })
    except Exception as e:
        print(f"Error in get_sensor_data: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500