extends Node2D

@export var radius: float = 40.0
@export var base_speed: float = 3.5

var current_angle: float = 0.0
var angular_velocity: float = 3.5
var is_dragging: bool = false
var last_mouse_angle: float = 0.0
var particles: Array = []

@onready var icon: Sprite2D = $Icon
@onready var label: Label = $Label

func _ready():
	if icon:
		icon.position = Vector2.ZERO
		icon.scale = Vector2(0.45, 0.45)

func _process(delta: float):
	# Spin physics: smoothly interpolate extra spin velocity back to base_speed
	if not is_dragging:
		angular_velocity = lerp(angular_velocity, base_speed, 1.8 * delta)
	current_angle += angular_velocity * delta

	if icon:
		icon.rotation = current_angle

	# Update status label
	if label:
		var speed_val = abs(angular_velocity)
		if speed_val > 25.0:
			label.text = "CRAZY SPEED!"
			label.modulate = Color(1.0, 0.2, 0.2, 1.0)
		elif speed_val > 12.0:
			label.text = "WHEEE!"
			label.modulate = Color(1.0, 0.8, 0.1, 1.0)
		else:
			label.text = "SPINNER"
			label.modulate = Color(0.8, 0.9, 1.0, 0.9)

	# Spawn trail particles when spinning fast
	if abs(angular_velocity) > 6.0:
		var p_angle = current_angle + randf_range(-0.6, 0.6)
		var p_pos = Vector2(cos(p_angle), sin(p_angle)) * radius
		particles.append({
			"pos": p_pos,
			"vel": Vector2(cos(p_angle + PI / 2.0), sin(p_angle + PI / 2.0)) * (angular_velocity * 4.0),
			"life": 0.35,
			"max_life": 0.35,
			"color": Color(1.0, 0.85, 0.2, 0.8)
		})

	# Update particles
	for i in range(particles.size() - 1, -1, -1):
		var p = particles[i]
		p["life"] -= delta
		if p["life"] <= 0:
			particles.remove_at(i)
		else:
			p["pos"] += p["vel"] * delta

	queue_redraw()

func _input(event: InputEvent):
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			var local_pos = to_local(get_global_mouse_position())
			if event.pressed:
				if local_pos.length() <= radius * 1.6:
					is_dragging = true
					last_mouse_angle = local_pos.angle()
					angular_velocity += 16.0
					var ui_hover = get_node_or_null("../Node/Uihover")
					if ui_hover:
						ui_hover.play()
			else:
				is_dragging = false
	elif event is InputEventMouseMotion and is_dragging:
		var local_pos = to_local(get_global_mouse_position())
		var cur_angle = local_pos.angle()
		var diff = angle_difference(last_mouse_angle, cur_angle)
		angular_velocity += diff * 40.0
		last_mouse_angle = cur_angle

func _draw():
	# 1. Background dark ring
	draw_circle(Vector2.ZERO, radius + 4.0, Color(0.05, 0.08, 0.12, 0.45))

	# 2. Static track ring
	draw_arc(Vector2.ZERO, radius, 0, TAU, 48, Color(0.3, 0.4, 0.5, 0.3), 3.5, true)

	# 3. Main glowing rotating arc
	draw_arc(Vector2.ZERO, radius, current_angle, current_angle + 2.3, 32, Color(1.0, 0.85, 0.1, 0.95), 4.5, true)

	# 4. Leading glowing tip bead
	var tip = Vector2(cos(current_angle + 2.3), sin(current_angle + 2.3)) * radius
	draw_circle(tip, 4.0, Color(1.0, 1.0, 0.9, 1.0))

	# 5. Secondary inner counter-spinning arc
	draw_arc(Vector2.ZERO, radius - 8.0, -current_angle * 1.3, -current_angle * 1.3 + 1.7, 24, Color(0.2, 0.8, 1.0, 0.8), 2.5, true)

	# 6. Orbiting colored satellite dots
	for i in range(3):
		var a = current_angle + (i * TAU / 3.0)
		var dot_pos = Vector2(cos(a), sin(a)) * (radius + 8.0)
		draw_circle(dot_pos, 2.5, Color(1.0, 0.45, 0.15, 0.9))

	# 7. Speed particles
	for p in particles:
		var alpha = p["life"] / p["max_life"]
		draw_circle(p["pos"], 2.0 * alpha, Color(p["color"].r, p["color"].g, p["color"].b, alpha))
