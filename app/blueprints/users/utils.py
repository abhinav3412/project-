from flask_wtf import FlaskForm
from wtforms import StringField, IntegerField, SubmitField, TextAreaField
from wtforms.validators import DataRequired, Email

class VolunteerForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    mobile = StringField('Mobile', validators=[DataRequired()])
    location = StringField('Location', validators=[DataRequired()])
    role_id = IntegerField('Role ID', validators=[DataRequired()])

class ThreadForm(FlaskForm):
    title = StringField("title", validators=[DataRequired()])
    content = TextAreaField("Content", validators=[DataRequired()])
    submit = SubmitField("Submit Thread")
