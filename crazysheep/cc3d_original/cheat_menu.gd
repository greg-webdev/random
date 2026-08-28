extends CanvasLayer

var is_menu_open: bool = false
var time_frozen: bool = false
var current_time_scale: float = 1.0
var speed_multiplier_index: int = 0
var speed_multipliers: Array = [1.0, 2.5, 5.0, 10.0]
var speed_labels: Array = ["1x (NORMAL)", "2.5x (TURBO)", "5x (SONIC)", "10x (LUDICROUS)"]

@onready var panel: Control = $Panel
@onready var open_button: Button = $OpenButton
@onready var btn_freeze: Button = $Panel/VBox/Grid/BtnFreeze
@onready var btn_fly: Button = $Panel/VBox/Grid/BtnFly
@onready var btn_speed: Button = $Panel/VBox/Grid/BtnSpeed
@onready var btn_god: Button = $Panel/VBox/Grid/BtnGod
@onready var btn_heavy: Button = $Panel/VBox/Grid/BtnHeavy
@onready var btn_shockwave: Button = $Panel/VBox/Grid/BtnShockwave
@onready var btn_gravity: Button = $Panel/VBox/Grid/BtnGravity
@onready var btn_explode: Button = $Panel/VBox/Grid/BtnExplode
@onready var btn_unflip: Button = $Panel/VBox/Grid/BtnUnflip
@onready var status_label: Label = $Panel/VBox/StatusLabel
@onready var click_sound: AudioStreamPlayer = $ClickSound

func _ready():
	process_mode = Node.PROCESS_MODE_ALWAYS
	if not panel:
		panel = get_node_or_null("Panel")
	if panel:
		panel.visible = false
	update_all_buttons()

func _input(event: InputEvent):
	if event.is_action_pressed("cheat_menu"):
		toggle_menu()
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F4 or event.physical_keycode == KEY_F4 or event.key_label == KEY_F4:
			toggle_menu()
			get_viewport().set_input_as_handled()

var f4_prev_pressed: bool = false

func _process(_delta: float):
	# Polling fallback so F4 works regardless of input event routing or keyboard hardware layout
	var f4_current = Input.is_key_pressed(KEY_F4) or Input.is_physical_key_pressed(KEY_F4)
	if f4_current and not f4_prev_pressed:
		toggle_menu()
	f4_prev_pressed = f4_current

func toggle_menu():
	if not panel:
		panel = get_node_or_null("Panel")
	if not open_button:
		open_button = get_node_or_null("OpenButton")

	is_menu_open = !is_menu_open
	if panel:
		panel.visible = is_menu_open
	print("[CHEAT ENGINE] F4 toggled! Menu open: ", is_menu_open)
	play_sound(1.2 if is_menu_open else 0.9)

	if is_menu_open:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		update_all_buttons()
	if open_button:
		open_button.text = "✖ CLOSE [F4]" if is_menu_open else "⚡ CHEATS [F4]"

func get_player() -> VehicleBody3D:
	if not is_inside_tree():
		return null
	var tree = get_tree()
	if not tree:
		return null
	var player = tree.get_first_node_in_group("player") as VehicleBody3D
	if player:
		return player
	if tree.root:
		for node in tree.root.find_children("*", "VehicleBody3D", true, false):
			if "is_super_heavy" in node:
				node.add_to_group("player")
				return node as VehicleBody3D
	return null

func play_sound(pitch: float = 1.0):
	if click_sound:
		click_sound.pitch_scale = pitch
		click_sound.play()

# 1. FREEZE / PAUSE TIME
func _on_btn_freeze_pressed():
	play_sound(1.0)
	time_frozen = !time_frozen
	Engine.time_scale = 0.0 if time_frozen else current_time_scale
	update_all_buttons()
	set_status("TIME: " + ("FROZEN [PAUSED]" if time_frozen else "RESUMED (" + str(current_time_scale) + "x)"))

# 2. FLY MODE
func _on_btn_fly_pressed():
	play_sound(1.1)
	var p = get_player()
	if p and "is_flying" in p:
		p.is_flying = !p.is_flying
		set_status("FLY MODE: " + ("ACTIVATED (WASD + Space to Fly)" if p.is_flying else "DISABLED"))
	else:
		set_status("Fly mode only available inside a match!")
	update_all_buttons()

# 3. SUPER SPEED
func _on_btn_speed_pressed():
	play_sound(1.2)
	speed_multiplier_index = (speed_multiplier_index + 1) % speed_multipliers.size()
	var mult = speed_multipliers[speed_multiplier_index]
	var p = get_player()
	if p and "speed_multiplier" in p:
		p.speed_multiplier = mult
	set_status("SPEED MULTIPLIER: " + speed_labels[speed_multiplier_index])
	update_all_buttons()

# 4. GOD MODE
func _on_btn_god_pressed():
	play_sound(1.3)
	var p = get_player()
	if p and "is_god_mode" in p:
		p.is_god_mode = !p.is_god_mode
		set_status("GOD MODE / INVINCIBILITY: " + ("ON" if p.is_god_mode else "OFF"))
	else:
		set_status("Join a match to use God Mode!")
	update_all_buttons()

# 5. SUPER HEAVY
func _on_btn_heavy_pressed():
	play_sound(0.8)
	var p = get_player()
	if p and "toggle_super_heavy" in p:
		p.toggle_super_heavy()
		set_status("SUPER HEAVY TANK: " + ("ON (120 KG)" if p.is_super_heavy else "OFF"))
	else:
		set_status("Join a match to toggle Super Heavy!")
	update_all_buttons()

# 6. MEGA SHOCKWAVE
func _on_btn_shockwave_pressed():
	play_sound(1.4)
	var p = get_player()
	if p and "mega_shockwave" in p:
		p.mega_shockwave = !p.mega_shockwave
		set_status("MEGA SHOCKWAVE BLEAT: " + ("ON (Press Space to Blast All Sheep!)" if p.mega_shockwave else "OFF"))
	else:
		set_status("Join a match to use Mega Shockwave!")
	update_all_buttons()

# 7. MOON GRAVITY
func _on_btn_gravity_pressed():
	play_sound(1.15)
	var p = get_player()
	if p and "low_gravity" in p:
		p.low_gravity = !p.low_gravity
		p.gravity_scale = 0.2 if p.low_gravity else 1.0
		set_status("MOON GRAVITY: " + ("0.2x (FLOATY PHYSICS)" if p.low_gravity else "NORMAL (1.0x)"))
	else:
		set_status("Join a match to change gravity!")
	update_all_buttons()

# 8. EXPLODE ALL BOTS
func _on_btn_explode_pressed():
	play_sound(0.6)
	var p = get_player()
	var count = 0
	for node in get_tree().root.find_children("*", "VehicleBody3D", true, false):
		if node != p:
			if node.has_node("Explode"):
				node.get_node("Explode").play()
			if node.has_node("explosion"):
				node.get_node("explosion").play()
			if node.has_node("sheep"):
				node.get_node("sheep").queue_free()
			if node.has_node("CollisionShape3D"):
				node.get_node("CollisionShape3D").queue_free()
			count += 1
	var global_node = get_node_or_null("/root/Global")
	if global_node:
		global_node.global_sheep = 0
	set_status("KABOOM! Obliterated " + str(count) + " opponent sheep!")

# 9. UNFLIP / RESET
func _on_btn_unflip_pressed():
	play_sound(1.3)
	var p = get_player()
	if p:
		p.global_position.y += 2.0
		p.rotation = Vector3(0, p.rotation.y, 0)
		p.linear_velocity = Vector3.ZERO
		p.angular_velocity = Vector3.ZERO
		p.isdead = false
		set_status("SHEEP UNFLIPPED AND RESTORED!")
	else:
		set_status("No player sheep found in scene!")

# 10. TIME SLOW-MO BUTTONS
func _on_btn_slowmo_pressed():
	play_sound(0.9)
	time_frozen = false
	current_time_scale = 0.25 if Engine.time_scale != 0.25 else 1.0
	Engine.time_scale = current_time_scale
	set_status("SLOW MOTION: " + str(current_time_scale) + "x")
	update_all_buttons()

func _on_btn_close_pressed():
	toggle_menu()

func set_status(msg: String):
	if status_label:
		status_label.text = msg

func update_all_buttons():
	var p = get_player()
	
	if btn_freeze:
		btn_freeze.text = "❄ TIME: " + ("FROZEN [ON]" if time_frozen else "RUNNING [OFF]")
		btn_freeze.modulate = Color(0.4, 0.9, 1.0) if time_frozen else Color.WHITE

	if btn_fly:
		var flying = p != null and p.get("is_flying") == true
		btn_fly.text = "🕊 FLY MODE: " + ("ACTIVE [ON]" if flying else "[OFF]")
		btn_fly.modulate = Color(0.4, 1.0, 0.4) if flying else Color.WHITE

	if btn_speed:
		btn_speed.text = "⚡ SPEED: " + speed_labels[speed_multiplier_index]

	if btn_god:
		var god = p != null and p.get("is_god_mode") == true
		btn_god.text = "🛡 GOD MODE: " + ("ACTIVE [ON]" if god else "[OFF]")
		btn_god.modulate = Color(1.0, 0.85, 0.2) if god else Color.WHITE

	if btn_heavy:
		var heavy = p != null and p.get("is_super_heavy") == true
		btn_heavy.text = "🚜 SUPER HEAVY: " + ("ON (120kg)" if heavy else "[OFF]")
		btn_heavy.modulate = Color(1.0, 0.4, 0.2) if heavy else Color.WHITE

	if btn_shockwave:
		var sw = p != null and p.get("mega_shockwave") == true
		btn_shockwave.text = "📢 SHOCKWAVE BLEAT: " + ("ACTIVE" if sw else "[OFF]")
		btn_shockwave.modulate = Color(1.0, 0.3, 0.9) if sw else Color.WHITE

	if btn_gravity:
		var lg = p != null and p.get("low_gravity") == true
		btn_gravity.text = "🌙 MOON GRAVITY: " + ("0.2x [ON]" if lg else "[OFF]")
		btn_gravity.modulate = Color(0.8, 0.6, 1.0) if lg else Color.WHITE
