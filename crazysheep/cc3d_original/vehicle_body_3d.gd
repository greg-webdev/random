extends VehicleBody3D

var isdead = false
var iswinstate = false
var is_super_heavy = false

# Cheat variables
var is_flying: bool = false
var is_god_mode: bool = false
var speed_multiplier: float = 1.0
var mega_shockwave: bool = false
var low_gravity: bool = false

var normal_mass: float = 30.0
var normal_movespeed: float = 100.0
var normal_sheep_scale: Vector3 = Vector3.ONE
var doamovespeed = 100.0
var won = false

var ram_area: Area3D

func _ready():
	add_to_group("player")
	normal_mass = mass
	normal_movespeed = doamovespeed
	if has_node("sheep"):
		normal_sheep_scale = $sheep.scale

	# Setup front ramming bumper area
	ram_area = Area3D.new()
	ram_area.name = "RamBumper"
	var col = CollisionShape3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = 2.4
	col.shape = sphere
	col.position = Vector3(0, 0, -0.7)
	ram_area.add_child(col)
	add_child(ram_area)
	ram_area.body_entered.connect(_on_ram_body_entered)

func toggle_super_heavy():
	is_super_heavy = !is_super_heavy
	if is_super_heavy:
		mass = 120.0
		center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
		center_of_mass = Vector3(0, -0.4, 0)
		doamovespeed = 250.0

		if has_node("sheep"):
			$sheep.scale = normal_sheep_scale * 1.3

		Global.eliminated = "[rainbow][wave]★ [F2] SUPER HEAVY & POWERFUL ACTIVE! ★[/wave][/rainbow]"
		print("★ [F2] SUPER HEAVY & POWERFUL: ON (Mass: 120, Speed: 250, Ram Power: MAX) ★")
		$Bleat.pitch_scale = 0.45
		$Bleat.play()
	else:
		mass = normal_mass
		center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_AUTO
		center_of_mass = Vector3.ZERO
		doamovespeed = normal_movespeed

		if has_node("sheep"):
			$sheep.scale = normal_sheep_scale

		Global.eliminated = "[pulse]Super Heavy Mode Deactivated[/pulse]"
		print("[F2] Super Heavy: OFF")
		$Bleat.pitch_scale = 1.0
		$Bleat.play()

func _on_ram_body_entered(body: Node):
	if is_super_heavy and body is VehicleBody3D and body != self:
		_ram_target(body)

func _ram_target(target: VehicleBody3D):
	var knock_dir = (target.global_position - global_position).normalized()
	knock_dir.y = 0.55
	knock_dir = knock_dir.normalized()
	target.apply_central_impulse(knock_dir * 1200.0)
	target.apply_torque_impulse(Vector3(randf_range(-1.0, 1.0), randf_range(0.5, 1.5), randf_range(-1.0, 1.0)) * 600.0)
	$Bleat.pitch_scale = randf_range(0.4, 0.6)
	$Bleat.play()

func trigger_shockwave():
	var count = 0
	for node in get_tree().root.find_children("*", "VehicleBody3D", true, false):
		if node != self and node is VehicleBody3D:
			var diff = node.global_position - global_position
			var dist = diff.length()
			if dist < 35.0:
				var dir = diff.normalized()
				dir.y = 0.6
				dir = dir.normalized()
				var strength = clamp((35.0 - dist) / 35.0, 0.2, 1.0)
				node.apply_central_impulse(dir * (1600.0 * strength))
				node.apply_torque_impulse(Vector3(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * 500.0)
				count += 1
	if count > 0:
		print("Mega shockwave blasted ", count, " sheep!")

func bleat():
	$Bleat.pitch_scale = 0.45 if is_super_heavy else randf_range(0.7, 1.3)
	$Bleat.play()
	if mega_shockwave:
		trigger_shockwave()

func freeCam():
	$Node / Camera3D3 / AudioListener3D.make_current()
	$Node / Camera3D3.make_current()

func unlockshit():
	if Global.currentlevel == "ireland":
		if Global.unlockedlevels == 1:
			Global.beatenlevels = 1
			Global.unlockedlevels = 2
	elif Global.currentlevel == "egypt":
		if Global.unlockedlevels == 2:
			Global.beatenlevels = 2
			Global.unlockedlevels = 3
	elif Global.currentlevel == "sweden":
		if Global.unlockedlevels == 3:
			Global.beatenlevels = 3
			Global.unlockedlevels = 4

func win():
	$Node / Camera3D3 / freecamlisten / Crowd.play()
	$detect_dead / RichTextLabel5.show()
	freeCam()
	unlockshit()
	saveprogress()
	iswinstate = true
	print("You win!")

func saveprogress():
	var data = SaveData.new()
	data.saveunlockedlevels = Global.unlockedlevels
	data.beatenlevels = Global.beatenlevels
	data.savename = Global.playername
	data.mastervol = AudioServer.get_bus_volume_db(0)
	data.musicvol = AudioServer.get_bus_volume_db(1)
	if DisplayServer.window_get_mode() == (DisplayServer.WINDOW_MODE_FULLSCREEN):
		data.fullscreen = true
	else:
		data.fullscreen = false
	print("Saved")
	ResourceSaver.save(data, "user://savefile.tres")

func _input(event):
	if event.is_action_pressed("horn"):
		bleat()
		if isdead == true and iswinstate == false:
			Global.global_sheep = 0
			Global.sheepnum = 0
			Global.eliminated = ""
			get_tree().reload_current_scene()
		elif iswinstate == true:
			get_tree().change_scene_to_file("res://worldmap.tscn")
	if event.is_action_released("horn"):
		$Bleat.stop()
	if event.is_action_pressed("debug_win"):
		win()
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F2:
			toggle_super_heavy()

func _physics_process(delta):
	var dead = $detect_dead.is_colliding()

	if is_flying:
		dead = false
		var move_dir = Vector3.ZERO
		var fwd = -global_transform.basis.z
		var right = global_transform.basis.x
		fwd.y = 0.0
		if fwd.length() > 0.001: fwd = fwd.normalized()
		right.y = 0.0
		if right.length() > 0.001: right = right.normalized()

		if Input.is_key_pressed(KEY_W): move_dir += fwd
		if Input.is_key_pressed(KEY_S): move_dir -= fwd
		if Input.is_key_pressed(KEY_A): move_dir -= right
		if Input.is_key_pressed(KEY_D): move_dir += right
		if Input.is_key_pressed(KEY_SPACE): move_dir.y += 1.0
		if Input.is_key_pressed(KEY_SHIFT) or Input.is_key_pressed(KEY_CTRL): move_dir.y -= 1.0

		linear_velocity = move_dir.normalized() * (35.0 * speed_multiplier)
		angular_velocity = Vector3.ZERO
		steering = 0.0
		engine_force = 0.0
	else:
		steering = lerp(steering, Input.get_axis("right", "left") * 0.4, 5 * delta)
		engine_force = Input.get_axis("back", "forward") * (doamovespeed * speed_multiplier)

	if is_super_heavy or is_god_mode:
		dead = false # Invulnerable!
		if ram_area:
			for b in ram_area.get_overlapping_bodies():
				if b is VehicleBody3D and b != self:
					var dir = (b.global_position - global_position).normalized()
					dir.y = 0.4
					b.apply_central_impulse(dir.normalized() * 600.0 * delta * 60.0)

	if isdead == false:
		if dead == true and iswinstate == false:
			print("DEAD")
			doamovespeed = 0
			Global.eliminated = "[pulse]" + Global.playername + " has been eliminated."
			$detect_dead / RichTextLabel2.show()
			freeCam()
			$sheep.queue_free()
			$CollisionShape3D.queue_free()
			$Node / Camera3D3 / freecamlisten / Explode.play()
			$Node / Camera3D3 / freecamlisten / explosion.play()
			isdead = true
	if dead == false and Global.global_sheep == 0:
		if won == false:
			win()
			won = true
