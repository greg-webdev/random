extends Sprite2D

var angular_velocity: float = 0.0
var is_spinning: bool = false
var original_scale: Vector2 = Vector2.ONE
var wobble_timer: float = 0.0

@onready var baa: AudioStreamPlayer = get_node_or_null("TitleBaa")

func _ready():
	original_scale = scale

func _input(event: InputEvent):
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var local_pos = to_local(get_global_mouse_position())
		# Title local bounds: width ~560, height ~210 centered at (0,0)
		if abs(local_pos.x) <= 290.0 and abs(local_pos.y) <= 115.0:
			spin()

func _on_title_button_pressed():
	spin()

func spin():
	print("Title clicked! Spinning!")
	# Launch into multiple high-speed 360-degree rotations
	angular_velocity += 35.0
	is_spinning = true
	wobble_timer = 0.0

	# Play funny sheep bleat
	if baa and baa.is_inside_tree():
		baa.pitch_scale = randf_range(1.05, 1.55)
		baa.play()

func _process(delta: float):
	if is_spinning:
		rotation += angular_velocity * delta
		wobble_timer += delta * 16.0

		# Cartoon squash & stretch bounce while spinning
		var intensity = clamp(angular_velocity / 35.0, 0.0, 1.0)
		var bounce = sin(wobble_timer) * 0.18 * intensity
		scale = original_scale + Vector2(bounce, -bounce)

		# Smooth drag deceleration
		angular_velocity = lerp(angular_velocity, 0.0, 2.0 * delta)

		# Seamlessly snap back to upright 0 orientation when slowing down
		if abs(angular_velocity) < 3.5:
			rotation = lerp_angle(rotation, 0.0, 8.0 * delta)
			scale = scale.lerp(original_scale, 9.0 * delta)
			if abs(rotation) < 0.02 and abs(angular_velocity) < 0.2:
				rotation = 0.0
				scale = original_scale
				angular_velocity = 0.0
				is_spinning = false
