import requests
from datetime import datetime, timedelta
from geopy.distance import geodesic
from concurrent.futures import ThreadPoolExecutor
import heapq
from app.models import Camp, Warehouse, Vehicle
from app.extensions import db

# Ensure no accidental reassignment of 'requests'
assert requests.__name__ == 'requests', "The 'requests' library has been overwritten!"

# Helper function to calculate straight-line distance
def calculate_straight_line_distance(origin, destination):
    """
    Calculates the straight-line distance between two points.
    :param origin: (latitude, longitude) of the starting point
    :param destination: (latitude, longitude) of the ending point
    :return: Distance in kilometers
    """
    try:
        # Validate coordinates
        if not all(isinstance(x, (int, float)) for x in origin + destination):
            print("Invalid coordinates in straight-line calculation: coordinates must be numbers")
            return 0
        
        # Check if coordinates are within valid ranges
        if not all(-90 <= lat <= 90 for lat in [origin[0], destination[0]]):
            print("Invalid latitude in straight-line calculation: must be between -90 and 90")
            return 0
        
        if not all(-180 <= lng <= 180 for lng in [origin[1], destination[1]]):
            print("Invalid longitude in straight-line calculation: must be between -180 and 180")
            return 0
        
        return round(geodesic(origin, destination).kilometers, 2)
    except Exception as e:
        print(f"Error calculating straight-line distance: {e}")
        return 0

# Helper function to calculate road distance and duration using OSRM API
def calculate_road_distance_and_duration(origin, destination):
    """
    Fetches the road distance and duration between two points using OSRM API.
    Falls back to straight-line distance if the API fails.
    :param origin: (latitude, longitude) of the starting point
    :param destination: (latitude, longitude) of the ending point
    :return: Road distance in kilometers and duration in seconds
    """
    # Validate coordinates
    try:
        # Check if coordinates are valid numbers
        if not all(isinstance(x, (int, float)) for x in origin + destination):
            print("Invalid coordinates: coordinates must be numbers")
            return calculate_straight_line_distance(origin, destination), None
        
        # Check if coordinates are within valid ranges
        if not all(-90 <= lat <= 90 for lat in [origin[0], destination[0]]):
            print("Invalid latitude: must be between -90 and 90")
            return calculate_straight_line_distance(origin, destination), None
        
        if not all(-180 <= lng <= 180 for lng in [origin[1], destination[1]]):
            print("Invalid longitude: must be between -180 and 180")
            return calculate_straight_line_distance(origin, destination), None
    except Exception as e:
        print(f"Error validating coordinates: {e}")
        return calculate_straight_line_distance(origin, destination), None
    
    base_url = "http://router.project-osrm.org/route/v1/driving/"
    coords = f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
    url = f"{base_url}{coords}?overview=false"
    
    try:
        response = requests.get(url, timeout=5)  # Add timeout to prevent hanging
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and data.get('code') == 'Ok':
                routes = data.get('routes')
                if isinstance(routes, list) and len(routes) > 0:
                    route = routes[0]
                    distance_in_kilometers = round(route.get('distance', 0) / 1000, 2)
                    duration_in_seconds = route.get('duration', 0)
                    return distance_in_kilometers, duration_in_seconds
        print(f"OSRM API returned status code {response.status_code}")
        return calculate_straight_line_distance(origin, destination), None
    except requests.exceptions.Timeout:
        print("OSRM API request timed out")
        return calculate_straight_line_distance(origin, destination), None
    except requests.exceptions.RequestException as e:
        print(f"Error making request to OSRM API: {e}")
        return calculate_straight_line_distance(origin, destination), None
    except Exception as e:
        print(f"Error calculating road distance: {e}")
        return calculate_straight_line_distance(origin, destination), None

def find_nearest_warehouse(camp_location, required_items):
    """
    Finds the nearest warehouse with sufficient stock using road distances.
    :param camp_location: (latitude, longitude) of the camp
    :param required_items: Dictionary of required items and quantities
    :return: Nearest warehouse or None if no warehouse has stock
    """
    warehouses = Warehouse.query.filter_by(status='Operational').all()
    nearest_warehouse = None
    min_distance = float('inf')
    
    for warehouse in warehouses:
        # Check if warehouse has sufficient stock
        has_sufficient_stock = True
        if required_items.get('food', 0) > warehouse.food_capacity:
            has_sufficient_stock = False
        if required_items.get('water', 0) > warehouse.water_capacity:
            has_sufficient_stock = False
        if required_items.get('essentials', 0) > warehouse.essential_capacity:
            has_sufficient_stock = False
        if required_items.get('clothes', 0) > warehouse.clothes_capacity:
            has_sufficient_stock = False
            
        if has_sufficient_stock:
            distance, _ = calculate_road_distance_and_duration(
                camp_location,
                (warehouse.coordinates_lat, warehouse.coordinates_lng)
            )
            if distance and distance < min_distance:
                nearest_warehouse = warehouse
                min_distance = distance
                
    return nearest_warehouse

class PriorityQueue:
    def __init__(self):
        self._queue = []
        self._index = 0

    def push(self, item, priority):
        heapq.heappush(self._queue, (-priority, self._index, item))
        self._index += 1

    def pop(self):
        return heapq.heappop(self._queue)[-1]

    def is_empty(self):
        return len(self._queue) == 0

class Vehicle:
    def __init__(self, id, capacity):
        self.id = id
        self.capacity = capacity
        self.current_load = 0
        self.deliveries = []
        self.emergency_deliveries = []

    def add_delivery(self, camp, items, priority):
        if priority == "emergency":
            self.emergency_deliveries.append((camp, items))
        elif priority == "general":
            total_weight = sum(items.values())
            if self.current_load + total_weight <= self.capacity:
                self.deliveries.append((camp, items))
                self.current_load += total_weight

    def get_all_deliveries(self):
        return self.emergency_deliveries + self.deliveries

    def process_emergency_deliveries(self, etas):
        while self.emergency_deliveries:
            camp, items = self.emergency_deliveries.pop(0)
            eta = etas.pop(0) if etas else None
            formatted_eta = format_eta((eta - datetime.now()).total_seconds()) if eta else "N/A"
            total_weight = sum(items.values())
            self.current_load -= total_weight
            return {
                'camp': camp,
                'items': items,
                'eta': formatted_eta,
                'priority': 'emergency'
            }
        return None

    def process_general_deliveries(self, etas):
        while self.deliveries:
            camp, items = self.deliveries.pop(0)
            eta = etas.pop(0) if etas else None
            formatted_eta = format_eta((eta - datetime.now()).total_seconds()) if eta else "N/A"
            total_weight = sum(items.values())
            self.current_load -= total_weight
            return {
                'camp': camp,
                'items': items,
                'eta': formatted_eta,
                'priority': 'general'
            }
        return None

def optimize_route(start_location, delivery_points):
    """
    Optimizes the delivery route using road distances via OSRM API.
    :param start_location: (latitude, longitude) of the starting point
    :param delivery_points: List of (latitude, longitude) for delivery points
    :return: Optimized route as a list of locations and ETAs
    """
    coords = ";".join([f"{loc[1]},{loc[0]}" for loc in [start_location] + delivery_points])
    base_url = "http://router.project-osrm.org/route/v1/driving/"
    url = f"{base_url}{coords}?steps=true&geometries=geojson"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and data.get('code') == 'Ok':
                routes = data.get('routes')
                if isinstance(routes, list) and len(routes) > 0:
                    route = routes[0]
                    geometry = route.get('geometry')
                    if geometry and 'coordinates' in geometry:
                        route_geometry = geometry['coordinates']
                        optimized_route = [(coord[1], coord[0]) for coord in route_geometry]
                        legs = route.get('legs', [])
                        etas = []
                        current_time = datetime.now()
                        for leg in legs:
                            current_time += timedelta(seconds=leg.get('duration', 0))
                            etas.append(current_time)
                        return optimized_route, etas
        return None, None
    except Exception as e:
        print(f"Error optimizing route: {e}")
        return None, None

def format_eta(duration_in_seconds):
    """
    Formats the ETA into a human-readable format (minutes, hours, or days).
    :param duration_in_seconds: Duration in seconds
    :return: Formatted ETA string
    """
    try:
        # Handle invalid input
        if not isinstance(duration_in_seconds, (int, float)) or duration_in_seconds <= 0:
            return "Calculating..."
        
        if duration_in_seconds < 60 * 60:  # Less than 1 hour
            minutes = round(duration_in_seconds / 60)
            return f"{minutes} minute(s)"
        elif duration_in_seconds < 24 * 60 * 60:  # Less than 1 day
            hours = round(duration_in_seconds / (60 * 60))
            return f"{hours} hour(s)"
        else:  # More than 1 day
            days = round(duration_in_seconds / (24 * 60 * 60))
            return f"{days} day(s)"
    except Exception as e:
        print(f"Error formatting ETA: {e}")
        return "Calculating..."

def allocate_resources(camp_id, required_items, priority="general"):
    """
    Allocates resources to a camp using real-time data from the database.
    :param camp_id: ID of the camp requesting resources
    :param required_items: Dictionary of required items and quantities
    :param priority: Priority of the request ("emergency" or "general")
    :return: Dictionary containing allocation details and ETA
    """
    try:
        # Get camp details from database
        camp = Camp.query.get_or_404(camp_id)
        camp_location = (camp.coordinates_lat, camp.coordinates_lng)
        
        # Find nearest warehouse with sufficient stock
        warehouse = find_nearest_warehouse(camp_location, required_items)
        if not warehouse:
            return {
                'success': False,
                'message': 'No warehouse found with sufficient stock'
            }
            
        # Get available vehicles from the warehouse
        vehicles = Vehicle.query.filter_by(
            warehouse_id=warehouse.wid,
            status='available'
        ).all()
        
        if not vehicles:
            return {
                'success': False,
                'message': 'No vehicles available at the warehouse'
            }
            
        # Create vehicle objects
        vehicle_objects = [Vehicle(v.vid, v.capacity) for v in vehicles]
        
        # Add delivery to the first available vehicle
        vehicle = vehicle_objects[0]
        vehicle.add_delivery(camp, required_items, priority)
        
        # Optimize route
        delivery_points = [(camp.coordinates_lat, camp.coordinates_lng)]
        optimized_route, etas = optimize_route(
            (warehouse.coordinates_lat, warehouse.coordinates_lng),
            delivery_points
        )
        
        if not optimized_route or not etas:
            return {
                'success': False,
                'message': 'Failed to optimize delivery route'
            }
            
        # Process delivery and get ETA
        if priority == "emergency":
            delivery_info = vehicle.process_emergency_deliveries(etas)
        else:
            delivery_info = vehicle.process_general_deliveries(etas)
            
        if not delivery_info:
            return {
                'success': False,
                'message': 'Failed to process delivery'
            }
            
        # Update available and used resources (capacity remains fixed)
        warehouse.food_available -= required_items.get('food', 0)
        warehouse.water_available -= required_items.get('water', 0)
        warehouse.essentials_available -= required_items.get('essentials', 0)
        warehouse.clothes_available -= required_items.get('clothes', 0)
        
        warehouse.food_used += required_items.get('food', 0)
        warehouse.water_used += required_items.get('water', 0)
        warehouse.essentials_used += required_items.get('essentials', 0)
        warehouse.clothes_used += required_items.get('clothes', 0)
        
        # Update vehicle status
        vehicle_db = Vehicle.query.get(vehicle.id)
        vehicle_db.status = 'in_transit'
        
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Resources allocated successfully',
            'warehouse': warehouse.name,
            'vehicle_id': vehicle.id,
            'eta': delivery_info['eta'],
            'items': delivery_info['items']
        }
        
    except Exception as e:
        db.session.rollback()
        return {
            'success': False,
            'message': f'Error allocating resources: {str(e)}'
        }