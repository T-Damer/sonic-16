extends CharacterBody3D
class_name SonicPlayer

signal rings_changed(value: int)
signal status_changed(message: String)
signal state_changed(value: StringName)

const STATE_IDLE: StringName = &"idle"
const STATE_RUN: StringName = &"run"
const STATE_JUMP: StringName = &"jump"
const STATE_BUZZSAW: StringName = &"buzzsaw"
const STATE_SPIKE_BLAST: StringName = &"spike_blast"
const STATE_WALL_HIDE: StringName = &"wall_hide"
const STATE_LEDGE_HANG: StringName = &"ledge_hang"
const STATE_HURT: StringName = &"hurt"

@export var run_speed: float = 5.15
@export var depth_speed: float = 3.15
@export var ground_acceleration: float = 23.0
@export var ground_friction: float = 31.0
@export var air_acceleration: float = 10.5
@export var gravity: float = 22.0
@export var jump_velocity: float = 7.55
@export var jump_cut_multiplier: float = 0.52
@export var coyote_time: float = 0.12
@export var jump_buffer_time: float = 0.14
@export var buzzsaw_speed: float = 8.6
@export var lane_min_z: float = -2.25
@export var lane_max_z: float = 2.25
@export var kill_plane_y: float = -11.0

@onready var avatar: SatamPlayerVisual = $VisualRoot as SatamPlayerVisual
@onready var buzz_hitbox: Area3D = $BuzzHitbox

var state: StringName = STATE_IDLE
var rings: int = 8
var facing: float = 1.0
var spawn_position: Vector3
var last_move_direction: Vector3 = Vector3.RIGHT
var input_axis: Vector2 = Vector2.ZERO
var coyote_remaining: float = 0.0
var jump_buffer_remaining: float = 0.0
var ability_remaining: float = 0.0
var ring_attack_cooldown: float = 0.0
var invulnerability_remaining: float = 0.0
var hidden_against_wall: bool = false
var ledge_point: Vector3


func _ready() -> void:
    collision_layer = 1
    collision_mask = 3
    spawn_position = global_position
    _install_default_input()
    buzz_hitbox.monitoring = false
    buzz_hitbox.body_entered.connect(_on_buzzsaw_body_entered)
    rings_changed.emit(rings)
    state_changed.emit(state)


func _physics_process(delta: float) -> void:
    ring_attack_cooldown = maxf(0.0, ring_attack_cooldown - delta)
    invulnerability_remaining = maxf(0.0, invulnerability_remaining - delta)
    ability_remaining = maxf(0.0, ability_remaining - delta)
    input_axis = Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")

    if state == STATE_LEDGE_HANG:
        _update_ledge_hang(delta)
        _update_avatar(delta)
        return

    if Input.is_action_just_pressed(&"ring_attack"):
        _ring_attack()

    if not is_on_floor() and Input.is_action_just_pressed(&"buzzsaw"):
        _start_buzzsaw()
    elif not is_on_floor() and Input.is_action_just_pressed(&"spike_blast"):
        _start_spike_blast()

    if state == STATE_BUZZSAW:
        _update_buzzsaw(delta)
    elif state == STATE_SPIKE_BLAST:
        _update_spike_blast(delta)
    elif state == STATE_HURT:
        _update_hurt(delta)
    else:
        _update_standard_movement(delta)

    if global_position.y < kill_plane_y:
        reset_to_spawn()

    _update_avatar(delta)


func _update_standard_movement(delta: float) -> void:
    var grounded_before_move := is_on_floor()
    if grounded_before_move:
        coyote_remaining = coyote_time
    else:
        coyote_remaining = maxf(0.0, coyote_remaining - delta)

    if Input.is_action_just_pressed(&"jump"):
        jump_buffer_remaining = jump_buffer_time
    else:
        jump_buffer_remaining = maxf(0.0, jump_buffer_remaining - delta)

    hidden_against_wall = (
        grounded_before_move
        and Input.is_action_pressed(&"wall_hide")
        and _near_back_wall(delta)
    )

    var desired := _camera_relative_velocity(input_axis)
    if hidden_against_wall:
        desired *= Vector3(0.36, 0.0, 0.0)
        _set_state(STATE_WALL_HIDE)
    elif Vector2(desired.x, desired.z).length() > 0.08:
        facing = signf(desired.x) if absf(desired.x) > 0.08 else facing
        last_move_direction = Vector3(desired.x, 0.0, desired.z).normalized()

    var horizontal := Vector3(velocity.x, 0.0, velocity.z)
    if desired.length_squared() > 0.001:
        var acceleration := ground_acceleration if grounded_before_move else air_acceleration
        horizontal = horizontal.move_toward(desired, acceleration * delta)
    else:
        var deceleration := ground_friction if grounded_before_move else air_acceleration * 0.28
        horizontal = horizontal.move_toward(Vector3.ZERO, deceleration * delta)

    velocity.x = horizontal.x
    velocity.z = horizontal.z

    if jump_buffer_remaining > 0.0 and coyote_remaining > 0.0:
        velocity.y = jump_velocity
        jump_buffer_remaining = 0.0
        coyote_remaining = 0.0
        hidden_against_wall = false
        _set_state(STATE_JUMP)

    if Input.is_action_just_released(&"jump") and velocity.y > 0.0:
        velocity.y *= jump_cut_multiplier

    if not grounded_before_move:
        velocity.y -= gravity * delta
    elif velocity.y < 0.0:
        velocity.y = -0.1

    move_and_slide()
    _clamp_depth_lane()

    if not is_on_floor() and velocity.y < -0.5 and _try_ledge_grab():
        return

    if hidden_against_wall:
        _set_state(STATE_WALL_HIDE)
    elif not is_on_floor():
        _set_state(STATE_JUMP)
    elif Vector2(velocity.x, velocity.z).length() > 0.30:
        _set_state(STATE_RUN)
    else:
        _set_state(STATE_IDLE)


func _update_buzzsaw(delta: float) -> void:
    var dash_direction := last_move_direction
    if dash_direction.length_squared() < 0.01:
        dash_direction = Vector3(facing, 0.0, 0.0)

    velocity.x = move_toward(velocity.x, dash_direction.x * buzzsaw_speed, 34.0 * delta)
    velocity.z = move_toward(velocity.z, dash_direction.z * buzzsaw_speed * 0.66, 24.0 * delta)
    velocity.y -= gravity * 0.24 * delta
    move_and_slide()
    _clamp_depth_lane()

    if ability_remaining <= 0.0 or is_on_floor():
        _set_state(STATE_IDLE if is_on_floor() else STATE_JUMP)


func _update_spike_blast(delta: float) -> void:
    velocity.x = move_toward(velocity.x, 0.0, 18.0 * delta)
    velocity.z = move_toward(velocity.z, 0.0, 18.0 * delta)
    velocity.y -= gravity * 0.18 * delta
    move_and_slide()
    _clamp_depth_lane()

    if ability_remaining <= 0.0 or is_on_floor():
        _set_state(STATE_IDLE if is_on_floor() else STATE_JUMP)


func _update_hurt(delta: float) -> void:
    velocity.x = move_toward(velocity.x, 0.0, 6.0 * delta)
    velocity.z = move_toward(velocity.z, 0.0, 6.0 * delta)
    velocity.y -= gravity * delta
    move_and_slide()
    _clamp_depth_lane()

    if ability_remaining <= 0.0:
        _set_state(STATE_IDLE if is_on_floor() else STATE_JUMP)


func _start_buzzsaw() -> void:
    if state == STATE_BUZZSAW or state == STATE_SPIKE_BLAST or state == STATE_HURT:
        return
    ability_remaining = 0.52
    hidden_against_wall = false
    velocity.y = maxf(velocity.y, 1.25)
    _set_state(STATE_BUZZSAW)
    status_changed.emit("BUZZSAW · breaks armoured obstacles")


func _start_spike_blast() -> void:
    if state == STATE_BUZZSAW or state == STATE_SPIKE_BLAST or state == STATE_HURT:
        return
    ability_remaining = 0.44
    hidden_against_wall = false
    velocity *= Vector3(0.25, 0.20, 0.25)
    velocity.y = maxf(velocity.y, 1.1)
    _set_state(STATE_SPIKE_BLAST)
    _spawn_spike_burst()
    status_changed.emit("SPIKE BLAST · radial mid-air attack")


func _ring_attack() -> void:
    if ring_attack_cooldown > 0.0 or state == STATE_LEDGE_HANG or state == STATE_HURT:
        return
    if rings <= 0:
        status_changed.emit("NO RINGS · collect ammunition")
        return

    rings -= 1
    rings_changed.emit(rings)
    ring_attack_cooldown = 0.28

    var aim := _current_aim_direction()
    var projectile := AbilityProjectile.new()
    projectile.configure(&"ring", &"player", aim, self, 9.4, 1.8)
    get_tree().current_scene.add_child(projectile)
    projectile.global_position = global_position + Vector3(aim.x * 0.36, 0.86, aim.z * 0.36)
    status_changed.emit("RING ATTACK · two hits disable a camera")


func _spawn_spike_burst() -> void:
    var directions: Array[Vector3] = [
        Vector3(1.0, 0.0, 0.0),
        Vector3(-1.0, 0.0, 0.0),
        Vector3(0.0, 0.0, 1.0),
        Vector3(0.0, 0.0, -1.0),
        Vector3(0.72, 0.48, 0.0),
        Vector3(-0.72, 0.48, 0.0),
        Vector3(0.72, -0.42, 0.0),
        Vector3(-0.72, -0.42, 0.0),
        Vector3(0.0, 0.42, 0.90),
        Vector3(0.0, 0.42, -0.90),
    ]
    for direction in directions:
        var projectile := AbilityProjectile.new()
        projectile.configure(&"spike", &"player", direction, self, 7.2, 0.85)
        get_tree().current_scene.add_child(projectile)
        projectile.global_position = global_position + Vector3.UP * 0.78


func take_damage(source_position: Vector3 = Vector3.ZERO) -> void:
    if invulnerability_remaining > 0.0 or state == STATE_BUZZSAW:
        return

    if rings <= 0:
        reset_to_spawn()
        status_changed.emit("CAPTURED · returned to checkpoint")
        return

    var lost := mini(4, rings)
    rings -= lost
    rings_changed.emit(rings)
    invulnerability_remaining = 1.15
    ability_remaining = 0.42
    hidden_against_wall = false

    var actual_source := source_position
    if actual_source.is_equal_approx(Vector3.ZERO):
        actual_source = global_position + Vector3(facing, 0.0, 0.0)
    var away := global_position - actual_source
    away.y = 0.0
    if away.length_squared() < 0.01:
        away = Vector3(-facing, 0.0, 0.0)
    away = away.normalized()
    velocity = away * 4.2 + Vector3.UP * 5.1
    _set_state(STATE_HURT)
    status_changed.emit("HIT · lost %d rings" % lost)


func add_ring(amount: int = 1) -> void:
    rings += amount
    rings_changed.emit(rings)


func reset_to_spawn() -> void:
    global_position = spawn_position
    velocity = Vector3.ZERO
    coyote_remaining = 0.0
    jump_buffer_remaining = 0.0
    ability_remaining = 0.0
    hidden_against_wall = false
    invulnerability_remaining = 0.45
    _set_state(STATE_IDLE)


func set_spawn(new_spawn: Vector3) -> void:
    spawn_position = new_spawn


func is_hidden_from_enemies() -> bool:
    return hidden_against_wall


func get_camera_bias() -> Vector3:
    if hidden_against_wall and absf(input_axis.x) > 0.15:
        return Vector3(signf(input_axis.x) * 1.55, 0.10, 0.0)
    if state == STATE_LEDGE_HANG:
        return Vector3(facing * 0.85, -0.30, 0.0)
    return Vector3.ZERO


func _current_aim_direction() -> Vector3:
    var aim := _camera_relative_velocity(input_axis)
    aim.y = 0.0
    if aim.length_squared() <= 0.04:
        aim = Vector3(facing, 0.0, 0.0)
    return aim.normalized()


func _camera_relative_velocity(axis: Vector2) -> Vector3:
    if axis.length_squared() <= 0.001:
        return Vector3.ZERO

    var camera := get_viewport().get_camera_3d()
    if camera == null:
        return Vector3(axis.x * run_speed, 0.0, axis.y * depth_speed)

    var camera_right := camera.global_transform.basis.x
    camera_right.y = 0.0
    camera_right = camera_right.normalized()
    var camera_forward := -camera.global_transform.basis.z
    camera_forward.y = 0.0
    camera_forward = camera_forward.normalized()

    return camera_right * axis.x * run_speed + camera_forward * -axis.y * depth_speed


func _near_back_wall(delta: float) -> bool:
    var from := global_position + Vector3.UP * 0.72
    var to := from + Vector3(0.0, 0.0, -0.72)
    var query := PhysicsRayQueryParameters3D.create(from, to, 1, [get_rid()])
    var hit := get_world_3d().direct_space_state.intersect_ray(query)
    if hit.is_empty():
        return false

    var hit_position: Vector3 = hit.get("position")
    global_position.z = move_toward(global_position.z, hit_position.z + 0.31, delta * 4.0)
    velocity.z = 0.0
    return true


func _try_ledge_grab() -> bool:
    if absf(input_axis.x) < 0.18 or state == STATE_HURT:
        return false

    var direction := Vector3(facing, 0.0, 0.0)
    var space := get_world_3d().direct_space_state
    var chest_from := global_position + Vector3.UP * 0.80
    var chest_query := PhysicsRayQueryParameters3D.create(
        chest_from,
        chest_from + direction * 0.52,
        1,
        [get_rid()],
    )
    var wall_hit := space.intersect_ray(chest_query)
    if wall_hit.is_empty():
        return false

    var head_from := global_position + Vector3.UP * 1.35
    var head_query := PhysicsRayQueryParameters3D.create(
        head_from,
        head_from + direction * 0.54,
        1,
        [get_rid()],
    )
    if not space.intersect_ray(head_query).is_empty():
        return false

    var down_from := global_position + direction * 0.56 + Vector3.UP * 1.52
    var down_query := PhysicsRayQueryParameters3D.create(
        down_from,
        down_from - Vector3.UP * 0.95,
        1,
        [get_rid()],
    )
    var top_hit := space.intersect_ray(down_query)
    if top_hit.is_empty():
        return false
    var normal: Vector3 = top_hit.get("normal")
    if normal.y < 0.72:
        return false

    ledge_point = top_hit.get("position")
    var wall_point: Vector3 = wall_hit.get("position")
    global_position = Vector3(
        wall_point.x - direction.x * 0.30,
        ledge_point.y - 1.22,
        global_position.z,
    )
    velocity = Vector3.ZERO
    _set_state(STATE_LEDGE_HANG)
    status_changed.emit("LEDGE · jump/up climbs, down drops")
    return true


func _update_ledge_hang(delta: float) -> void:
    velocity = Vector3.ZERO
    if Input.is_action_just_pressed(&"jump") or Input.is_action_pressed(&"move_up"):
        global_position = Vector3(
            ledge_point.x + facing * 0.42,
            ledge_point.y + 0.06,
            global_position.z,
        )
        _set_state(STATE_IDLE)
    elif Input.is_action_just_pressed(&"move_down"):
        global_position.x -= facing * 0.12
        velocity.y = -1.0
        _set_state(STATE_JUMP)
    else:
        global_position.y = move_toward(global_position.y, ledge_point.y - 1.22, delta * 5.0)


func _clamp_depth_lane() -> void:
    var clamped_z := clampf(global_position.z, lane_min_z, lane_max_z)
    if not is_equal_approx(clamped_z, global_position.z):
        global_position.z = clamped_z
        velocity.z = 0.0


func _set_state(new_state: StringName) -> void:
    if state == new_state:
        return
    state = new_state
    buzz_hitbox.set_deferred("monitoring", state == STATE_BUZZSAW)
    state_changed.emit(state)


func _on_buzzsaw_body_entered(body: Node3D) -> void:
    if state != STATE_BUZZSAW or body == self:
        return
    if body.has_method("take_hit"):
        body.call("take_hit", &"buzzsaw", last_move_direction, global_position)


func _update_avatar(delta: float) -> void:
    if avatar == null:
        return
    var horizontal_speed := Vector2(velocity.x, velocity.z).length()
    avatar.set_motion(state, horizontal_speed, facing, velocity.z, delta)
    avatar.visible = (
        invulnerability_remaining <= 0.0
        or int(floor(invulnerability_remaining * 18.0)) % 2 == 0
    )


func _install_default_input() -> void:
    _ensure_keyboard_action(&"move_left", [KEY_A, KEY_LEFT])
    _ensure_keyboard_action(&"move_right", [KEY_D, KEY_RIGHT])
    _ensure_keyboard_action(&"move_up", [KEY_W, KEY_UP])
    _ensure_keyboard_action(&"move_down", [KEY_S, KEY_DOWN])
    _ensure_keyboard_action(&"jump", [KEY_SPACE, KEY_K])
    _ensure_keyboard_action(&"ring_attack", [KEY_F, KEY_J])
    _ensure_keyboard_action(&"buzzsaw", [KEY_E, KEY_L])
    _ensure_keyboard_action(&"spike_blast", [KEY_Q, KEY_I])
    _ensure_keyboard_action(&"wall_hide", [KEY_C])
    _ensure_keyboard_action(&"pause", [KEY_ESCAPE, KEY_P])
    _ensure_keyboard_action(&"restart", [KEY_R])

    _ensure_joy_button(&"move_left", JOY_BUTTON_DPAD_LEFT)
    _ensure_joy_button(&"move_right", JOY_BUTTON_DPAD_RIGHT)
    _ensure_joy_button(&"move_up", JOY_BUTTON_DPAD_UP)
    _ensure_joy_button(&"move_down", JOY_BUTTON_DPAD_DOWN)
    _ensure_joy_button(&"jump", JOY_BUTTON_A)
    _ensure_joy_button(&"ring_attack", JOY_BUTTON_X)
    _ensure_joy_button(&"buzzsaw", JOY_BUTTON_B)
    _ensure_joy_button(&"spike_blast", JOY_BUTTON_Y)
    _ensure_joy_button(&"wall_hide", JOY_BUTTON_LEFT_SHOULDER)
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
