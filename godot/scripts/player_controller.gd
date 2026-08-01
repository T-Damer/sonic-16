extends CharacterBody3D
class_name SonicPlayer

signal rings_changed(value: int)

const IDLE_A: Texture2D = preload("res://assets/player_idle_a.svg")
const IDLE_B: Texture2D = preload("res://assets/player_idle_b.svg")
const RUN_A: Texture2D = preload("res://assets/player_run_a.svg")
const RUN_B: Texture2D = preload("res://assets/player_run_b.svg")
const JUMP: Texture2D = preload("res://assets/player_jump.svg")

@export var move_speed: float = 7.2
@export var ground_acceleration: float = 34.0
@export var ground_friction: float = 42.0
@export var air_acceleration: float = 16.0
@export var gravity: float = 24.0
@export var jump_velocity: float = 9.2
@export var jump_cut_multiplier: float = 0.48
@export var coyote_time: float = 0.11
@export var jump_buffer_time: float = 0.13
@export var kill_plane_y: float = -10.0

@onready var visual_root: Node3D = $VisualRoot

var sprite: AnimatedSprite3D
var spawn_position: Vector3
var coyote_remaining: float = 0.0
var jump_buffer_remaining: float = 0.0
var rings: int = 0
var visual_time: float = 0.0


func _ready() -> void:
    spawn_position = global_position
    _install_default_input()
    _build_sprite()
    rings_changed.emit(rings)


func _physics_process(delta: float) -> void:
    var grounded_before_move := is_on_floor()

    if grounded_before_move:
        coyote_remaining = coyote_time
    else:
        coyote_remaining = maxf(0.0, coyote_remaining - delta)

    if Input.is_action_just_pressed(&"jump"):
        jump_buffer_remaining = jump_buffer_time
    else:
        jump_buffer_remaining = maxf(0.0, jump_buffer_remaining - delta)

    var input_axis := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
    var direction := _camera_relative_direction(input_axis)
    var horizontal := Vector3(velocity.x, 0.0, velocity.z)
    var target_horizontal := direction * move_speed

    if direction.length_squared() > 0.0001:
        var acceleration := ground_acceleration if grounded_before_move else air_acceleration
        horizontal = horizontal.move_toward(target_horizontal, acceleration * delta)
    else:
        var deceleration := ground_friction if grounded_before_move else air_acceleration * 0.35
        horizontal = horizontal.move_toward(Vector3.ZERO, deceleration * delta)

    velocity.x = horizontal.x
    velocity.z = horizontal.z

    if jump_buffer_remaining > 0.0 and coyote_remaining > 0.0:
        velocity.y = jump_velocity
        jump_buffer_remaining = 0.0
        coyote_remaining = 0.0

    if Input.is_action_just_released(&"jump") and velocity.y > 0.0:
        velocity.y *= jump_cut_multiplier

    if not grounded_before_move:
        velocity.y -= gravity * delta
    elif velocity.y < 0.0:
        velocity.y = -0.1

    move_and_slide()
    _update_visual(delta, horizontal)

    if global_position.y < kill_plane_y:
        reset_to_spawn()


func _camera_relative_direction(input_axis: Vector2) -> Vector3:
    if input_axis.length_squared() <= 0.0001:
        return Vector3.ZERO

    var camera := get_viewport().get_camera_3d()
    if camera == null:
        return Vector3(input_axis.x, 0.0, input_axis.y).normalized()

    var camera_right := camera.global_transform.basis.x
    camera_right.y = 0.0
    camera_right = camera_right.normalized()

    var camera_forward := -camera.global_transform.basis.z
    camera_forward.y = 0.0
    camera_forward = camera_forward.normalized()

    return (camera_right * input_axis.x + camera_forward * -input_axis.y).normalized()


func _update_visual(delta: float, horizontal: Vector3) -> void:
    if sprite == null:
        return

    visual_time += delta
    var speed := horizontal.length()

    if not is_on_floor():
        if sprite.animation != &"jump":
            sprite.play(&"jump")
    elif speed > 0.35:
        if sprite.animation != &"run":
            sprite.play(&"run")
        sprite.speed_scale = clampf(speed / 4.2, 0.85, 1.9)
    else:
        if sprite.animation != &"idle":
            sprite.play(&"idle")
        sprite.speed_scale = 1.0

    var camera := get_viewport().get_camera_3d()
    var side_speed := horizontal.x
    if camera != null:
        var camera_right := camera.global_transform.basis.x
        camera_right.y = 0.0
        side_speed = horizontal.dot(camera_right.normalized())

    if absf(side_speed) > 0.08:
        sprite.flip_h = side_speed < 0.0

    var target_roll := clampf(-side_speed * 0.018, -0.11, 0.11)
    visual_root.rotation.z = lerp_angle(visual_root.rotation.z, target_roll, minf(1.0, delta * 11.0))

    var bob := 0.0
    if is_on_floor() and speed > 0.35:
        bob = absf(sin(visual_time * (9.0 + speed))) * 0.035
    visual_root.position.y = lerpf(visual_root.position.y, bob, minf(1.0, delta * 16.0))


func _build_sprite() -> void:
    var frames := SpriteFrames.new()
    frames.remove_animation(&"default")
    _add_animation(frames, &"idle", 2.2, true, [IDLE_A, IDLE_B])
    _add_animation(frames, &"run", 10.0, true, [RUN_A, RUN_B])
    _add_animation(frames, &"jump", 1.0, false, [JUMP])

    sprite = AnimatedSprite3D.new()
    sprite.name = "AnimatedSprite3D"
    sprite.sprite_frames = frames
    sprite.position = Vector3(0.0, 0.78, 0.0)
    sprite.pixel_size = 0.018
    sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
    sprite.shaded = true
    sprite.double_sided = true
    sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_DOUBLE_SIDED
    visual_root.add_child(sprite)
    sprite.play(&"idle")


func _add_animation(
    frames: SpriteFrames,
    animation_name: StringName,
    speed: float,
    looped: bool,
    textures: Array,
) -> void:
    frames.add_animation(animation_name)
    frames.set_animation_speed(animation_name, speed)
    frames.set_animation_loop(animation_name, looped)
    for texture in textures:
        frames.add_frame(animation_name, texture as Texture2D)


func add_ring(amount: int = 1) -> void:
    rings += amount
    rings_changed.emit(rings)


func reset_to_spawn() -> void:
    global_position = spawn_position
    velocity = Vector3.ZERO
    coyote_remaining = 0.0
    jump_buffer_remaining = 0.0


func set_spawn(new_spawn: Vector3) -> void:
    spawn_position = new_spawn


func _install_default_input() -> void:
    _ensure_keyboard_action(&"move_left", [KEY_A, KEY_LEFT])
    _ensure_keyboard_action(&"move_right", [KEY_D, KEY_RIGHT])
    _ensure_keyboard_action(&"move_up", [KEY_W, KEY_UP])
    _ensure_keyboard_action(&"move_down", [KEY_S, KEY_DOWN])
    _ensure_keyboard_action(&"jump", [KEY_SPACE, KEY_K])
    _ensure_keyboard_action(&"pause", [KEY_ESCAPE, KEY_P])
    _ensure_keyboard_action(&"restart", [KEY_R])

    _ensure_joy_button(&"move_left", JOY_BUTTON_DPAD_LEFT)
    _ensure_joy_button(&"move_right", JOY_BUTTON_DPAD_RIGHT)
    _ensure_joy_button(&"move_up", JOY_BUTTON_DPAD_UP)
    _ensure_joy_button(&"move_down", JOY_BUTTON_DPAD_DOWN)
    _ensure_joy_button(&"jump", JOY_BUTTON_A)
    _ensure_joy_button(&"pause", JOY_BUTTON_START)

    _ensure_joy_axis(&"move_left", JOY_AXIS_LEFT_X, -1.0)
    _ensure_joy_axis(&"move_right", JOY_AXIS_LEFT_X, 1.0)
    _ensure_joy_axis(&"move_up", JOY_AXIS_LEFT_Y, -1.0)
    _ensure_joy_axis(&"move_down", JOY_AXIS_LEFT_Y, 1.0)


func _ensure_keyboard_action(action: StringName, keycodes: Array) -> void:
    _ensure_input_action(action)

    for keycode in keycodes:
        var already_bound := false
        for existing_event in InputMap.action_get_events(action):
            if existing_event is InputEventKey and existing_event.physical_keycode == keycode:
                already_bound = true
                break

        if already_bound:
            continue

        var event := InputEventKey.new()
        event.physical_keycode = keycode
        InputMap.action_add_event(action, event)


func _ensure_joy_button(action: StringName, button_index: JoyButton) -> void:
    _ensure_input_action(action)

    for existing_event in InputMap.action_get_events(action):
        if existing_event is InputEventJoypadButton and existing_event.button_index == button_index:
            return

    var event := InputEventJoypadButton.new()
    event.button_index = button_index
    InputMap.action_add_event(action, event)


func _ensure_joy_axis(action: StringName, axis: JoyAxis, axis_value: float) -> void:
    _ensure_input_action(action)

    for existing_event in InputMap.action_get_events(action):
        if (
            existing_event is InputEventJoypadMotion
            and existing_event.axis == axis
            and is_equal_approx(existing_event.axis_value, axis_value)
        ):
            return

    var event := InputEventJoypadMotion.new()
    event.axis = axis
    event.axis_value = axis_value
    InputMap.action_add_event(action, event)


func _ensure_input_action(action: StringName) -> void:
    if not InputMap.has_action(action):
        InputMap.add_action(action, 0.22)
