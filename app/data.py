import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
from sklearn.model_selection import GridSearchCV
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score, precision_score, recall_score, f1_score
import datetime
import time
import os
from collections import defaultdict
import logging
import math
from typing import Dict, List, Optional
import seaborn as sns
import matplotlib.pyplot as plt

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app/static/data/sensor_service.log'),
        logging.StreamHandler()
    ]
)

# Label Encoders for soil types and sensors
label_encoder = LabelEncoder()
soil_types_categories = ['clay', 'sand', 'loam', 'silt']
label_encoder.fit(soil_types_categories)

# Historical data storage
historical_data = defaultdict(list)
MAX_HISTORY_SIZE = 1000  # Store last 1000 readings per sensor

# Soil-specific thresholds with enhanced values
soil_thresholds = {
    'clay': {
        'rainfall_high': 180,
        'rainfall_medium': 100,
        'soil_saturation_high': 80,
        'soil_saturation_medium': 65,
        'slope_high': 30,
        'slope_medium': 22,
        'seismic_activity_high': 5.5,
        'seismic_activity_medium': 4.5,
        'cohesion': 20,
        'friction_angle': 20,
        'density': 1800
    },
    'sand': {
        'rainfall_high': 250,
        'rainfall_medium': 160,
        'soil_saturation_high': 90,
        'soil_saturation_medium': 75,
        'slope_high': 40,
        'slope_medium': 32,
        'seismic_activity_high': 6.5,
        'seismic_activity_medium': 5.5,
        'cohesion': 0,
        'friction_angle': 35,
        'density': 1600
    },
    'loam': {
        'rainfall_high': 220,
        'rainfall_medium': 130,
        'soil_saturation_high': 85,
        'soil_saturation_medium': 60,
        'slope_high': 35,
        'slope_medium': 28,
        'seismic_activity_high': 6.0,
        'seismic_activity_medium': 5,
        'cohesion': 10,
        'friction_angle': 30,
        'density': 1700
    },
    'silt': {
        'rainfall_high': 200,
        'rainfall_medium': 120,
        'soil_saturation_high': 80,
        'soil_saturation_medium': 70,
        'slope_high': 32,
        'slope_medium': 28,
        'seismic_activity_high': 5.8,
        'seismic_activity_medium': 4.5,
        'cohesion': 15,
        'friction_angle': 25,
        'density': 1700
    }
}

def generate_rainfall():
    """Generate rainfall value aligned with global standards."""
    rainfall = np.random.normal(loc=100, scale=40)
    return max(0, min(300, round(rainfall, 2)))

def generate_forecasted_rainfall():
    """Generate forecasted rainfall value aligned with global standards."""
    forecasted_rainfall = np.random.normal(loc=75, scale=30)
    return max(0, min(200, round(forecasted_rainfall, 2)))

def generate_soil_saturation(soil_type):
    """Generate soil saturation value based on soil type and global standards."""
    if soil_type == "clay":
        return round(np.random.uniform(50, 60), 2)
    elif soil_type == "sand":
        return round(np.random.uniform(60, 75), 2)
    elif soil_type == "loam":
        return round(np.random.uniform(45, 55), 2)
    elif soil_type == "silt":
        return round(np.random.uniform(55, 65), 2)
    else:
        return round(np.random.uniform(60, 90), 2)  

def generate_slope():
    """Generate slope value aligned with global standards."""
    slope = np.random.normal(loc=25, scale=10)
    return max(0, min(90, round(slope, 2)))

def generate_seismic_activity():
    """Generate seismic activity value aligned with global standards."""
    seismic_activity = np.random.normal(loc=3.0, scale=2.0)
    return max(0, min(10, round(seismic_activity, 2)))

def calculate_soil_stability(soil_data):
    """Calculate soil stability using advanced soil mechanics principles."""
    cohesion = round(soil_data.get('cohesion', 0), 2)
    friction_angle = round(soil_data.get('friction_angle', 0), 2)
    effective_stress = round(soil_data.get('effective_stress', 0), 2)
    pore_pressure = round(soil_data.get('pore_pressure', 0), 2)
    soil_density = round(soil_data.get('soil_density', 0), 2)
    void_ratio = round(soil_data.get('void_ratio', 0), 2)
    
    shear_strength = round((cohesion + (effective_stress - pore_pressure) * math.tan(math.radians(friction_angle))), 2)
    shear_stress = round(soil_data.get('shear_stress', 1), 2)
    slope_angle = round(soil_data.get('slope_angle', 0), 2)
    gravity = 9.81
    
    driving_force = round(soil_density * gravity * math.sin(math.radians(slope_angle)), 2)
    resisting_force = round(shear_strength * math.cos(math.radians(slope_angle)), 2)
    
    factor_of_safety = round(resisting_force / driving_force if driving_force > 0 else float('inf'), 2)
    
    stability_index = round(min(1.0, (
        (factor_of_safety / 2.0) *
        (1 - (pore_pressure / effective_stress)) *
        (1 - (void_ratio / 1.5))
    )), 2)
    
    return {
        'shear_strength': shear_strength,
        'factor_of_safety': factor_of_safety,
        'stability_index': stability_index,
        'driving_force': driving_force,
        'resisting_force': resisting_force,
        'pore_pressure_ratio': round(pore_pressure / effective_stress if effective_stress > 0 else 0, 2)
    }

def analyze_trends(sensor_id: str, metric: str) -> Dict:
    """Analyze trends in historical data for a specific metric."""
    if not historical_data[sensor_id]:
        return {"trend": "stable", "change_rate": 0, "volatility": 0}
    
    values = [data[metric] for data in historical_data[sensor_id]]
    if len(values) < 2:
        return {"trend": "stable", "change_rate": 0, "volatility": 0}
    
    # Calculate trend
    slope = np.polyfit(range(len(values)), values, 1)[0]
    change_rate = slope / np.mean(values) if np.mean(values) != 0 else 0
    
    # Calculate volatility
    volatility = np.std(values) / np.mean(values) if np.mean(values) != 0 else 0
    
    return {
        "trend": "increasing" if change_rate > 0.1 else "decreasing" if change_rate < -0.1 else "stable",
        "change_rate": round(change_rate, 3),
        "volatility": round(volatility, 3)
    }

def validate_sensor_data(data: Dict) -> bool:
    """Validate sensor data against expected ranges and types."""
    try:
        required_fields = ['id', 'name', 'latitude', 'longitude', 'soil_type', 'rainfall', 
                         'soil_saturation', 'slope', 'seismic_activity']
        
        # Check required fields
        if not all(field in data for field in required_fields):
            logging.error(f"Missing required fields in sensor data: {data}")
            return False
            
        # Validate numeric ranges
        if not (0 <= data['rainfall'] <= 300):
            logging.error(f"Invalid rainfall value: {data['rainfall']}")
            return False
            
        if not (0 <= data['soil_saturation'] <= 100):
            logging.error(f"Invalid soil saturation value: {data['soil_saturation']}")
            return False
            
        if not (0 <= data['slope'] <= 90):
            logging.error(f"Invalid slope value: {data['slope']}")
            return False
            
        if not (0 <= data['seismic_activity'] <= 10):
            logging.error(f"Invalid seismic activity value: {data['seismic_activity']}")
            return False
            
        # Validate coordinates
        if not (-90 <= data['latitude'] <= 90):
            logging.error(f"Invalid latitude value: {data['latitude']}")
            return False
            
        if not (-180 <= data['longitude'] <= 180):
            logging.error(f"Invalid longitude value: {data['longitude']}")
            return False
            
        return True
    except Exception as e:
        logging.error(f"Error validating sensor data: {str(e)}")
        return False

def calculate_status_and_risk(sensor_data):
    """Determine the status, risk level, and affected radius based on sensor data."""
    rainfall = sensor_data["rainfall"]
    forecasted_rainfall = sensor_data["forecasted_rainfall"]
    soil_saturation = sensor_data["soil_saturation"]
    slope = sensor_data["slope"]
    seismic_activity = sensor_data["seismic_activity"]
    soil_type = sensor_data["soil_type"]

    thresholds = soil_thresholds.get(soil_type, soil_thresholds['clay'])

    # Analyze trends
    trends = {
        'rainfall': analyze_trends(sensor_data['id'], 'rainfall'),
        'soil_saturation': analyze_trends(sensor_data['id'], 'soil_saturation'),
        'slope': analyze_trends(sensor_data['id'], 'slope'),
        'seismic_activity': analyze_trends(sensor_data['id'], 'seismic_activity')
    }

    # Adjust risk based on trends
    trend_risk_multiplier = 1.0
    for trend in trends.values():
        if trend['trend'] == 'increasing' and trend['change_rate'] > 0.2:
            trend_risk_multiplier *= 1.2
        elif trend['trend'] == 'decreasing' and trend['change_rate'] < -0.2:
            trend_risk_multiplier *= 0.8

    if (rainfall > thresholds['rainfall_high'] or 
        soil_saturation > thresholds['soil_saturation_high'] or 
        slope > thresholds['slope_high'] or 
        seismic_activity > thresholds['seismic_activity_high']):
        status = "Alert"
        risk = "High"
        affected_radius = int(np.random.randint(5000, 10000) * trend_risk_multiplier)
    elif (thresholds['rainfall_medium'] <= rainfall <= thresholds['rainfall_high'] or 
          thresholds['soil_saturation_medium'] <= soil_saturation <= thresholds['soil_saturation_high'] or 
          thresholds['slope_medium'] <= slope <= thresholds['slope_high'] or 
          thresholds['seismic_activity_medium'] <= seismic_activity <= thresholds['seismic_activity_high']):
        status = "Warning"
        risk = "Medium"
        affected_radius = int(np.random.randint(1000, 5000) * trend_risk_multiplier)
    else:
        status = "Normal"
        risk = "Low"
        affected_radius = 0

    return status, risk, affected_radius, trends

def calculate_landslide_time(sensor_data):
    """Calculate the approximate time of a landslide using a sophisticated prediction model."""
    soil_type = sensor_data["soil_type"]
    rainfall = sensor_data["rainfall"]
    soil_saturation = sensor_data["soil_saturation"]
    slope = sensor_data["slope"]
    seismic_activity = sensor_data["seismic_activity"]
    current_time = datetime.datetime.now()

    # Analyze trends
    trends = {
        'rainfall': analyze_trends(sensor_data['id'], 'rainfall'),
        'soil_saturation': analyze_trends(sensor_data['id'], 'soil_saturation'),
        'slope': analyze_trends(sensor_data['id'], 'slope'),
        'seismic_activity': analyze_trends(sensor_data['id'], 'seismic_activity')
    }

    # Adjust prediction based on trends
    trend_adjustment = 1.0
    for trend in trends.values():
        if trend['trend'] == 'increasing' and trend['change_rate'] > 0.2:
            trend_adjustment *= 0.8  # Reduce prediction time for increasing trends
        elif trend['trend'] == 'decreasing' and trend['change_rate'] < -0.2:
            trend_adjustment *= 1.2  # Increase prediction time for decreasing trends

    # Calculate status first
    if (rainfall > soil_thresholds[soil_type]['rainfall_high'] or 
        soil_saturation > soil_thresholds[soil_type]['soil_saturation_high'] or 
        slope > soil_thresholds[soil_type]['slope_high'] or 
        seismic_activity > soil_thresholds[soil_type]['seismic_activity_high']):
        # High risk conditions
        if rainfall > soil_thresholds[soil_type]['rainfall_high'] and soil_saturation > soil_thresholds[soil_type]['soil_saturation_high']:
            predicted_time = current_time + datetime.timedelta(hours=int(1 * trend_adjustment))
            return f"1h - {predicted_time.strftime('%d/%m %H:%M')}"
        elif slope > soil_thresholds[soil_type]['slope_high'] and seismic_activity > soil_thresholds[soil_type]['seismic_activity_high']:
            predicted_time = current_time + datetime.timedelta(hours=int(24 * trend_adjustment))
            return f"24h - {predicted_time.strftime('%d/%m %H:%M')}"
        else:
            predicted_time = current_time + datetime.timedelta(hours=int(48 * trend_adjustment))
            return f"48h - {predicted_time.strftime('%d/%m %H:%M')}"
    elif (soil_thresholds[soil_type]['rainfall_medium'] <= rainfall <= soil_thresholds[soil_type]['rainfall_high'] or 
          soil_thresholds[soil_type]['soil_saturation_medium'] <= soil_saturation <= soil_thresholds[soil_type]['soil_saturation_high'] or 
          soil_thresholds[soil_type]['slope_medium'] <= slope <= soil_thresholds[soil_type]['slope_high'] or 
          soil_thresholds[soil_type]['seismic_activity_medium'] <= seismic_activity <= soil_thresholds[soil_type]['seismic_activity_high']):
        # Medium risk conditions
        if rainfall > soil_thresholds[soil_type]['rainfall_medium'] and soil_saturation > soil_thresholds[soil_type]['soil_saturation_medium']:
            predicted_time = current_time + datetime.timedelta(hours=int(72 * trend_adjustment))
            return f"72h - {predicted_time.strftime('%d/%m %H:%M')}"
        else:
            predicted_time = current_time + datetime.timedelta(days=int(7 * trend_adjustment))
            return f"7d - {predicted_time.strftime('%d/%m %H:%M')}"
    else:
        # Low risk conditions
        return "No immediate risk"

def generate_sensor_data(sensor_config):
    """Generate sensor data based on sensor configuration."""
    current_time = datetime.datetime.now()
    
    # Generate sensor readings
    rainfall = generate_rainfall()
    forecasted_rainfall = generate_forecasted_rainfall()
    soil_saturation = generate_soil_saturation(sensor_config['soil_type'])
    slope = generate_slope()
    seismic_activity = generate_seismic_activity()
    
    # Create sensor data dictionary
    sensor_data = {
        "id": sensor_config['id'],
        "name": sensor_config['name'],
        "latitude": sensor_config['latitude'],
        "longitude": sensor_config['longitude'],
        "soil_type": sensor_config['soil_type'],
        "timestamp": current_time.isoformat(),
        "rainfall": rainfall,
        "forecasted_rainfall": forecasted_rainfall,
        "soil_saturation": soil_saturation,
        "slope": slope,
        "seismic_activity": seismic_activity,
        "operational_status": "Active"  # Default to Active for new sensors
    }
    
    # Validate data
    if not validate_sensor_data(sensor_data):
        logging.error(f"Invalid sensor data generated for sensor {sensor_config['id']}")
        return None
    
    # Calculate status and risk
    status, risk, affected_radius, trends = calculate_status_and_risk(sensor_data)
    
    # Calculate soil stability
    soil_data = {
        'cohesion': soil_thresholds[sensor_config['soil_type']]['cohesion'],
        'friction_angle': soil_thresholds[sensor_config['soil_type']]['friction_angle'],
        'effective_stress': calculate_effective_stress(sensor_config['soil_type'], soil_saturation),
        'pore_pressure': calculate_pore_pressure(soil_saturation),
        'soil_density': soil_thresholds[sensor_config['soil_type']]['density'],
        'void_ratio': calculate_void_ratio(sensor_config['soil_type'], soil_saturation),
        'shear_stress': calculate_shear_stress(slope, soil_saturation),
        'slope_angle': slope
    }
    
    stability = calculate_soil_stability(soil_data)
    
    # Add additional fields required by the alert page and map
    sensor_data.update({
        "status": status,
        "risk_level": risk,
        "affected_radius": affected_radius,
        "predicted_landslide_time": calculate_landslide_time(sensor_data),
        "trends": trends,
        "soil_stability": stability,
        "last_reading": current_time.isoformat()  # Required by alert page
    })
    
    # Update historical data
    historical_data[sensor_config['id']].append(sensor_data)
    if len(historical_data[sensor_config['id']]) > MAX_HISTORY_SIZE:
        historical_data[sensor_config['id']].pop(0)
    
    return sensor_data

def calculate_effective_stress(soil_type, soil_saturation):
    """Calculate effective stress based on soil type and saturation."""
    unit_weights = {
        'clay': 18,
        'sand': 16,
        'loam': 17,
        'silt': 17
    }
    
    depth = 1
    unit_weight = unit_weights.get(soil_type, 17)
    total_stress = unit_weight * depth
    saturation_factor = soil_saturation / 100
    effective_stress = total_stress * (1 - saturation_factor)
    
    return effective_stress

def calculate_pore_pressure(soil_saturation):
    """Calculate pore water pressure based on saturation."""
    return soil_saturation * 0.1

def calculate_void_ratio(soil_type, soil_saturation):
    """Calculate void ratio based on soil type and saturation."""
    base_void_ratios = {
        'clay': 0.8,
        'sand': 0.6,
        'loam': 0.7,
        'silt': 0.7
    }
    
    saturation_factor = soil_saturation / 100
    void_ratio = base_void_ratios.get(soil_type, 0.7) * (1 + saturation_factor)
    
    return void_ratio

def calculate_shear_stress(slope, soil_saturation):
    """Calculate shear stress based on slope and saturation."""
    return (slope / 45) * (soil_saturation / 100) * 100

def save_sensor_data_to_json(sensors_data):
    """Save sensor data to a JSON file."""
    output_file = os.path.join('app', 'static', 'data', 'sensor_data.json')
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w') as f:
        json.dump(sensors_data, f, indent=4)

def load_sensor_configs():
    """Load sensor configurations from JSON file."""
    config_file = os.path.join('app', 'static', 'data', 'sensor_configs.json')
    
    # Check if file exists
    if not os.path.exists(config_file):
        print(f"Sensor config file not found: {config_file}")
        # Create an empty file with valid JSON
        os.makedirs(os.path.dirname(config_file), exist_ok=True)
        with open(config_file, 'w') as f:
            json.dump([], f)
        return []
    
    # Check if file is empty
    if os.path.getsize(config_file) == 0:
        print(f"Sensor config file is empty: {config_file}")
        # Initialize with empty JSON array
        with open(config_file, 'w') as f:
            json.dump([], f)
        return []
    
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {config_file}: {e}")
        # Reset the file with valid JSON
        with open(config_file, 'w') as f:
            json.dump([], f)
        return []
    except Exception as e:
        print(f"Unexpected error loading sensor configs: {e}")
        return []

def save_sensor_configs(configs):
    """Save sensor configurations to JSON file."""
    config_file = os.path.join('app', 'static', 'data', 'sensor_configs.json')
    os.makedirs(os.path.dirname(config_file), exist_ok=True)
    
    with open(config_file, 'w') as f:
        json.dump(configs, f, indent=4)

def save_historical_data():
    """Save historical data to a JSON file."""
    output_file = os.path.join('app', 'static', 'data', 'historical_data.json')
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    serializable_data = {}
    for sensor_id, data in historical_data.items():
        serializable_data[sensor_id] = data
    
    with open(output_file, 'w') as f:
        json.dump(serializable_data, f, indent=4)

def load_historical_data():
    """Load historical data from JSON file."""
    input_file = os.path.join('app', 'static', 'data', 'historical_data.json')
    
    # Check if file exists
    if not os.path.exists(input_file):
        print(f"Historical data file not found: {input_file}")
        # Create an empty file with valid JSON
        os.makedirs(os.path.dirname(input_file), exist_ok=True)
        with open(input_file, 'w') as f:
            json.dump({}, f)
        return
    
    # Check if file is empty
    if os.path.getsize(input_file) == 0:
        print(f"Historical data file is empty: {input_file}")
        # Initialize with empty JSON object
        with open(input_file, 'w') as f:
            json.dump({}, f)
        return
    
    try:
        with open(input_file, 'r') as f:
            data = json.load(f)
            for sensor_id, sensor_data in data.items():
                historical_data[sensor_id] = sensor_data
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {input_file}: {e}")
        # Reset the file with valid JSON
        with open(input_file, 'w') as f:
            json.dump({}, f)
    except Exception as e:
        print(f"Unexpected error loading historical data: {e}")

def calculate_confusion_matrix(y_true, y_pred):
    """Calculate and visualize confusion matrix."""
    cm = confusion_matrix(y_true, y_pred)
    
    # Calculate metrics
    accuracy = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, average='weighted')
    recall = recall_score(y_true, y_pred, average='weighted')
    f1 = f1_score(y_true, y_pred, average='weighted')
    
    # Create classification report
    report = classification_report(y_true, y_pred)
    
    # Calculate percentages for confusion matrix
    cm_percentage = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis]
    
    # Create visualization
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm_percentage, annot=True, fmt='.2%', cmap='Blues',
                xticklabels=['No Landslide', 'Landslide'],
                yticklabels=['No Landslide', 'Landslide'])
    plt.title('Confusion Matrix (Percentage)')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    
    # Save the plot
    plt.savefig('app/static/data/confusion_matrix.png')
    plt.close()
    
    return {
        'matrix': cm.tolist(),
        'matrix_percentage': cm_percentage.tolist(),
        'metrics': {
            'accuracy': round(accuracy, 4),
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'f1_score': round(f1, 4)
        },
        'report': report
    }

def evaluate_predictions(historical_data):
    """Evaluate prediction accuracy using historical data."""
    # Check if there's any data to evaluate
    if not historical_data:
        print("No historical data available for evaluation")
        return {
            'matrix': [[0, 0], [0, 0]],
            'matrix_percentage': [[0, 0], [0, 0]],
            'metrics': {
                'accuracy': 0,
                'precision': 0,
                'recall': 0,
                'f1_score': 0
            },
            'report': "No data available for evaluation"
        }
    
    # Prepare data
    y_true = []
    y_pred = []
    
    for sensor_id, data in historical_data.items():
        for reading in data:
            # True label (actual landslide occurrence)
            true_label = 1 if reading.get('status') in ['Alert', 'Warning'] else 0
            
            # Predicted label (based on risk assessment)
            predicted_label = 1 if reading.get('risk_level') in ['High', 'Medium'] else 0
            
            y_true.append(true_label)
            y_pred.append(predicted_label)
    
    # Check if we have any predictions to evaluate
    if not y_true or not y_pred:
        print("No predictions available for evaluation")
        return {
            'matrix': [[0, 0], [0, 0]],
            'matrix_percentage': [[0, 0], [0, 0]],
            'metrics': {
                'accuracy': 0,
                'precision': 0,
                'recall': 0,
                'f1_score': 0
            },
            'report': "No predictions available for evaluation"
        }
    
    # Calculate confusion matrix and metrics
    evaluation = calculate_confusion_matrix(y_true, y_pred)
    
    # Save evaluation results
    output_file = os.path.join('app', 'static', 'data', 'evaluation_results.json')
    with open(output_file, 'w') as f:
        json.dump(evaluation, f, indent=4)
    
    return evaluation

def main():
    """Main function to continuously generate and save sensor data."""
    logging.info("Starting sensor data generation service...")
    
    # Load historical data
    load_historical_data()
    
    # Run initial evaluation
    evaluation = evaluate_predictions(historical_data)
    logging.info(f"Initial prediction evaluation results: {evaluation['metrics']}")
    
    while True:
        try:
            # Load sensor configurations
            sensor_configs = load_sensor_configs()
            
            # Check if there are any sensor configurations
            if not sensor_configs:
                logging.warning("No sensor configurations found. Waiting for configurations...")
                time.sleep(60)  # Wait for 1 minute before checking again
                continue
            
            # Generate data for each sensor
            sensors_data = []
            for config in sensor_configs:
                sensor_data = generate_sensor_data(config)
                if sensor_data:
                    sensors_data.append(sensor_data)
                    logging.info(f"Generated data for sensor {config['id']}: {sensor_data['status']} - {sensor_data['risk_level']}")
            
            # Save the generated data
            if sensors_data:
                save_sensor_data_to_json(sensors_data)
                save_historical_data()
                
                # Evaluate predictions every 5 minutes
                current_time = datetime.datetime.now()
                if current_time.minute % 5 == 0:  # Run every 5 minutes
                    evaluation = evaluate_predictions(historical_data)
                    logging.info(f"Prediction evaluation results: {evaluation['metrics']}")
                    logging.info(f"Confusion Matrix: {evaluation['matrix']}")
                    logging.info(f"Classification Report: {evaluation['report']}")
            else:
                logging.warning("No sensor data generated. Check sensor configurations.")
            
            # Print timestamp for monitoring
            current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            logging.info(f"Sensor data updated at {current_time}")
            
            # Wait for 1 minute before next update
            time.sleep(60)
            
        except Exception as e:
            logging.error(f"Error updating sensor data: {str(e)}")
            # Wait for 1 minute before retrying
            time.sleep(60)

if __name__ == "__main__":
    main()