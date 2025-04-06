# Disaster Management System

A comprehensive disaster management system with real-time alerts, evacuation routes, and resource management.

## Features

- Real-time sensor monitoring
- Alert and warning system
- Evacuation route planning
- Resource allocation
- User management
- Admin dashboard

## Local Development

1. Clone the repository
2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   ```
   cp .env.example .env
   # Edit .env with your configuration
   ```
5. Run the application:
   ```
   flask run
   ```

## Deployment on Render

This application is configured for easy deployment on Render.

### Automatic Deployment

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Create a new Web Service on Render
3. Connect your repository
4. Render will automatically detect the configuration and deploy your application

### Manual Deployment

1. Create a new Web Service on Render
2. Set the following configuration:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app.run:app`
   - **Environment Variables**:
     - `SECRET_KEY`: (Generate a secure key)
     - `DATABASE_URL`: (Your database URL)

## Environment Variables

- `SECRET_KEY`: Secret key for Flask application
- `DATABASE_URL`: Database connection URL
- `FLASK_ENV`: Environment (development/production)
- `FLASK_APP`: Application entry point

## License

This project is licensed under the MIT License - see the LICENSE file for details. 