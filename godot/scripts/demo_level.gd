extends Node3D

@export_node_path("CharacterBody3D") var player_path: NodePath
@onready var player: SonicPlayer = get_node(player_path) as SonicPlayer

var rotors: Array[Node3D] = []
var rings: Array[Area3D] = []
var moving_bodies: Array[Dictionary] = []
var door_panels: Array[Node3D] = []
var elapsed: float = 0.0
var door_open: bool = false
var ring_label: Label
var state_label: Label
var status_label: Label
var status_time: float = 0.0

var floor_top: Material
var floor_edge: Material
var wall_blue: Material
var wall_dark: Material
var pipe_light: Material
var pipe_dark: Material
var hazard_gold: Material
var hazard_black: Material
var screen_cyan: Material
var warning_red: Material
var steel: Material
var grime: Material


func _ready() -> void:
    process_mode = Node.PROCESS_MODE_ALWAYS
    _build_materials()
    _build_environment()
    _build_robotropolis_corridor()
    _build_ui()

    player.rings_changed.connect(_on_rings_changed)
    player.status_changed.connect(_on_player_status)
    player.state_changed.connect(_on_player_state)
    _on_rings_changed(player.rings)
    _on_player_state(player.state)


func _process(delta: float) -> void:
    if get_tree().paused:
        return

    elapsed += delta
    for rotor in rotors:
        if is_instance_valid(rotor):
            rotor.rotation.z += delta * float(rotor.get_meta("speed", 3.2))
    for ring in rings:
        if is_instance_valid(ring):
            ring.rotation.y += delta * 3.2
            ring.position.y = float(ring.get_meta("base_y", ring.position.y)) + sin(
                elapsed * 2.2 + float(ring.get_meta("phase", 0.0))
            ) * 0.045

    if status_time > 0.0:
        status_time -= delta
        if status_time <= 0.0:
            status_label.text = ""


func _physics_process(delta: float) -> void:
    if get_tree().paused:
        return

    for item in moving_bodies:
        var body := item["body"] as AnimatableBody3D
        if not is_instance_valid(body):
            continue
        var phase := fmod(float(item["phase"]) + delta / float(item["duration"]), 1.0)
        item["phase"] = phase
        var weight := (1.0 - cos(phase * TAU)) * 0.5
        body.position = (item["start"] as Vector3).lerp(item["finish"] as Vector3, weight)


func _unhandled_input(_event: InputEvent) -> void:
    if Input.is_action_just_pressed(&"pause"):
        get_tree().paused = not get_tree().paused
        status_label.text = "PAUSED · ESC / P" if get_tree().paused else ""
        get_viewport().set_input_as_handled()
    elif Input.is_action_just_pressed(&"restart"):
        get_tree().paused = false
        player.reset_to_spawn()
        status_label.text = "CHECKPOINT RESTORED"
        status_time = 1.2
        get_viewport().set_input_as_handled()


func _build_materials() -> void:
    floor_top = RetroMaterials.make(
        Color("#8d6826"), Color("#291a08"), Color("#d3aa52"), 0.34, 0.82,
        Color.BLACK, 0.0, Color("#3d2b10"), Vector2(9.0, 5.0), 0.65, 0.075
    )
    floor_edge = RetroMaterials.make(
        Color("#1e5963"), Color("#061a20"), Color("#67a8b4"), 0.48, 0.66,
        Color.BLACK, 0.0, Color("#0b3139"), Vector2(8.0, 3.0), 0.58, 0.035
    )
    wall_blue = RetroMaterials.make(
        Color("#215d6b"), Color("#071a23"), Color("#71adba"), 0.42, 0.68,
        Color.BLACK, 0.0, Color("#0d3945"), Vector2(4.0, 4.0), 0.72, 0.035
    )
    wall_dark = RetroMaterials.make(
        Color("#12333e"), Color("#030b10"), Color("#3d7481"), 0.45, 0.74,
        Color.BLACK, 0.0, Color("#071e26"), Vector2(3.0, 5.0), 0.56, 0.025
    )
    pipe_light = RetroMaterials.make(
        Color("#8caeb8"), Color("#1c3239"), Color("#d6edf1"), 0.76, 0.28
    )
    pipe_dark = RetroMaterials.make(
        Color("#284d56"), Color("#07151a"), Color("#6c939c"), 0.70, 0.38
    )
    hazard_gold = RetroMaterials.make(
        Color("#d3a52a"), Color("#412605"), Color("#ffe67a"), 0.42, 0.52
    )
    hazard_black = RetroMaterials.make(
        Color("#171c1f"), Color("#010203"), Color("#5e686d"), 0.54, 0.54
    )
    screen_cyan = RetroMaterials.make(
        Color("#0d4c5c"), Color("#031419"), Color("#7cecff"), 0.10, 0.46,
        Color("#19c9e6"), 2.7
    )
    warning_red = RetroMaterials.make(
        Color("#61120e"), Color("#150101"), Color("#ff956d"), 0.08, 0.43,
        Color("#ff321d"), 3.2
    )
    steel = RetroMaterials.make(
        Color("#65737a"), Color("#151d22"), Color("#d7e6e9"), 0.72, 0.38
    )
    grime = RetroMaterials.make(
        Color("#33280f"), Color("#090601"), Color("#7a632e"), 0.12, 0.94,
        Color.BLACK, 0.0, Color("#181005"), Vector2(5.0, 4.0), 0.42, 0.095
    )


func _build_environment() -> void:
    var world := WorldEnvironment.new()
    var environment := Environment.new()
    environment.background_mode = Environment.BG_COLOR
    environment.background_color = Color("#06151d")
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color("#5f8190")
    environment.ambient_light_energy = 0.46
    environment.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
    environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
    environment.fog_enabled = true
    environment.fog_light_color = Color("#0b2a35")
    environment.fog_light_energy = 0.46
    environment.fog_density = 0.010
    environment.fog_height = 1.0
    environment.fog_height_density = 0.055
    world.environment = environment
    add_child(world)

    var key := DirectionalLight3D.new()
    key.name = "WarmFactoryKey"
    key.rotation_degrees = Vector3(-58.0, -24.0, 0.0)
    key.light_color = Color("#ffd08a")
    key.light_energy = 1.18
    key.shadow_enabled = true
    key.directional_shadow_max_distance = 72.0
    add_child(key)

    var fill := DirectionalLight3D.new()
    fill.name = "ColdFactoryFill"
    fill.rotation_degrees = Vector3(-24.0, 156.0, 0.0)
    fill.light_color = Color("#6cc9dd")
    fill.light_energy = 0.38
    add_child(fill)

    var rim := DirectionalLight3D.new()
    rim.name = "BackRim"
    rim.rotation_degrees = Vector3(-10.0, 10.0, 0.0)
    rim.light_color = Color("#2e7f94")
    rim.light_energy = 0.24
    add_child(rim)


func _build_robotropolis_corridor() -> void:
    # The route follows the pitch footage: broad entry deck, two-stage descent,
    # lower service corridor, spike wall, moving skiff, then a SWATbot arena.
    _deck("EntryDeck", -4.0, 16.0, 0.0)
    _ramp("EntryDescent", 5.8, 5.0, -0.72, -17.0)
    _deck("MidDeck", 10.9, 5.4, -1.46)
    _ramp("ServiceDescent", 15.2, 4.0, -2.18, -19.0)
    _deck("LowDeck", 23.0, 12.0, -3.0)
    _deck("ArenaDeck", 42.0, 13.0, -1.15)
    _deck("ExitDeck", 50.2, 4.8, -1.15)

    _wall_run(-12.0, 8.0, 0.0, 0)
    _wall_run(8.0, 14.0, -1.46, 1)
    _wall_run(14.0, 31.0, -3.0, 2)
    _wall_run(31.0, 53.0, -1.15, 3)

    _front_pipe(-4.0, 16.0, -0.78)
    _front_pipe(10.9, 5.4, -2.24)
    _front_pipe(23.0, 12.0, -3.78)
    _front_pipe(42.0, 13.0, -1.93)
    _front_pipe(50.2, 4.8, -1.93)

    _sewer_hatch(Vector3(-10.2, 0.075, 0.65))
    _floor_hole(Vector3(-6.6, 0.09, -0.15), Vector2(1.4, 0.82))
    _floor_hole(Vector3(-2.7, 0.09, 0.72), Vector2(1.2, 0.75))
    _floor_hole(Vector3(19.8, -2.91, -0.52), Vector2(1.4, 0.82))

    _ring_line(Vector3(-8.8, 0.62, 0.20), Vector3(1.28, 0.0, 0.28), 7)
    _ring_arc(Vector3(3.0, 0.38, -0.45), 1.55, 6, -0.1, 2.15)
    _ring_line(Vector3(8.8, -0.82, 0.78), Vector3(0.85, 0.0, -0.35), 5)
    _ring_line(Vector3(17.8, -2.34, -0.58), Vector3(1.12, 0.0, 0.28), 8)
    _ring_line(Vector3(33.0, -1.45, 0.0), Vector3(1.05, 0.25, 0.0), 5)
    _ring_line(Vector3(37.8, -0.53, -0.72), Vector3(1.10, 0.0, 0.35), 5)

    _checkpoint(Vector3(9.0, -1.30, 0.0))
    _checkpoint(Vector3(18.0, -2.84, 0.0))
    _checkpoint(Vector3(37.0, -0.99, 0.0))

    _spawn_enemy(&"camera", Vector3(-0.2, 2.05, -1.48), 2.0, 0.9)
    _spawn_enemy(&"camera", Vector3(20.3, -0.50, -1.65), 2.0, 0.9)
    _spawn_enemy(&"swatbot", Vector3(39.4, -1.08, -0.62), 1.9, 1.0)
    _spawn_enemy(&"swatbot", Vector3(44.6, -1.08, 0.78), 1.5, 1.0)

    var spike_wall := BreakableHazard.new()
    spike_wall.name = "BuzzsawBarricade"
    spike_wall.span = 4.1
    spike_wall.spike_height = 1.42
    spike_wall.spike_count = 8
    spike_wall.position = Vector3(26.7, -2.99, 0.0)
    add_child(spike_wall)

    _damage_spikes(Vector3(23.0, -2.98, 1.68), 4)
    _moving_skiff(Vector3(29.8, -3.55, 0.0), Vector3(35.0, -1.42, 0.0))
    _blast_door(Vector3(48.8, 0.68, -2.68))
    _ally(Vector3(46.4, -1.08, -1.55))
    _finish_trigger(Vector3(47.0, -0.15, 0.0), Vector3(2.0, 3.0, 4.8))

    # Frontmost foreground pipes create the same strong frame as the 320×200 pitch.
    _cylinder_mesh(
        "ForegroundConduit",
        Vector3(12.0, -5.15, 4.25),
        0.28,
        64.0,
        pipe_dark,
        Vector3(0.0, 0.0, PI * 0.5),
        false,
    )
    for x in range(-12, 54, 4):
        _cylinder_mesh(
            "ForegroundClamp%d" % x,
            Vector3(float(x), -5.15, 4.25),
            0.38,
            0.24,
            steel,
            Vector3(0.0, 0.0, PI * 0.5),
            false,
        )


func _deck(node_name: String, center_x: float, length: float, top_y: float) -> void:
    _box(
        node_name + "Base",
        Vector3(center_x, top_y - 0.48, 0.0),
        Vector3(length, 0.96, 5.2),
        floor_edge,
        Vector3.ZERO,
        true,
    )
    _box(
        node_name + "Top",
        Vector3(center_x, top_y + 0.025, 0.0),
        Vector3(length - 0.04, 0.07, 5.16),
        floor_top,
        Vector3.ZERO,
        false,
    )
    _box(
        node_name + "FrontBand",
        Vector3(center_x, top_y - 0.26, 2.62),
        Vector3(length - 0.08, 0.42, 0.12),
        wall_dark,
        Vector3.ZERO,
        false,
    )
    _hazard_stripe(center_x - length * 0.5 + 0.25, top_y + 0.085, length - 0.5)


func _ramp(
    node_name: String,
    center_x: float,
    length: float,
    center_y: float,
    angle_degrees: float,
) -> void:
    var rotation := Vector3(0.0, 0.0, angle_degrees)
    _box(
        node_name + "Base",
        Vector3(center_x, center_y - 0.34, 0.0),
        Vector3(length, 0.74, 5.2),
        floor_edge,
        rotation,
        true,
    )
    _box(
        node_name + "Top",
        Vector3(center_x, center_y + 0.04, 0.0),
        Vector3(length, 0.065, 5.16),
        floor_top,
        rotation,
        false,
    )


func _wall_run(start_x: float, end_x: float, floor_y: float, variant: int) -> void:
    var length := end_x - start_x
    var center_x := (start_x + end_x) * 0.5
    _box(
        "BackWall%d" % variant,
        Vector3(center_x, floor_y + 2.75, -2.95),
        Vector3(length, 6.4, 0.36),
        wall_blue if variant % 2 == 0 else wall_dark,
        Vector3.ZERO,
        true,
    )

    var panel_count := maxi(2, int(floor(length / 3.1)))
    for index in range(panel_count):
        var t := (float(index) + 0.5) / float(panel_count)
        var x := lerpf(start_x, end_x, t)
        var panel_height := 3.5 + float((index + variant) % 3) * 0.65
        _box(
            "WallPanel%d_%d" % [variant, index],
            Vector3(x, floor_y + panel_height * 0.5 + 0.15, -2.70),
            Vector3(2.25, panel_height, 0.22),
            wall_blue if (index + variant) % 2 == 0 else wall_dark,
            Vector3.ZERO,
            false,
        )
        _vent(Vector3(x + 0.45, floor_y + 1.05, -2.55), 0.72, 0.82)
        if index % 2 == 0:
            _indicator_panel(Vector3(x - 0.56, floor_y + 2.10, -2.54), index % 3 == 0)

    var fan_x := start_x + length * (0.28 if variant % 2 == 0 else 0.67)
    _fan(Vector3(fan_x, floor_y + 3.65, -2.42), 0.88 + float(variant % 2) * 0.18, variant % 2 == 0)

    _cylinder_mesh(
        "WallPipe%d" % variant,
        Vector3(center_x, floor_y + 5.12, -2.45),
        0.16,
        length - 0.8,
        pipe_light,
        Vector3(0.0, 0.0, PI * 0.5),
        false,
    )
    for x in range(int(start_x) + 2, int(end_x), 5):
        _pipe_drop(Vector3(float(x), floor_y + 3.4, -2.40), 2.4 + float((x + variant) % 2) * 0.6)


func _front_pipe(center_x: float, length: float, y: float) -> void:
    _cylinder_mesh(
        "FrontPipe%.1f" % center_x,
        Vector3(center_x, y, 2.83),
        0.16,
        length - 0.25,
        pipe_dark,
        Vector3(0.0, 0.0, PI * 0.5),
        false,
    )
    var clamp_count := maxi(2, int(length / 2.4))
    for index in range(clamp_count + 1):
        var x := center_x - length * 0.5 + float(index) * length / float(clamp_count)
        _cylinder_mesh(
            "FrontClamp%.1f_%d" % [center_x, index],
            Vector3(x, y, 2.83),
            0.22,
            0.13,
            steel,
            Vector3(0.0, 0.0, PI * 0.5),
            false,
        )


func _hazard_stripe(start_x: float, y: float, length: float) -> void:
    var count := maxi(1, int(length / 0.42))
    for index in range(count):
        var x := start_x + (float(index) + 0.5) * length / float(count)
        var material := hazard_gold if index % 2 == 0 else hazard_black
        _box(
            "HazardStripe%d_%d" % [int(start_x * 10.0), index],
            Vector3(x, y, 2.54),
            Vector3(length / float(count) * 0.86, 0.035, 0.28),
            material,
            Vector3(0.0, 0.0, -24.0 if index % 2 == 0 else 24.0),
            false,
        )


func _fan(position: Vector3, radius: float, clockwise: bool) -> void:
    var root := Node3D.new()
    root.position = position
    add_child(root)

    var housing_mesh := CylinderMesh.new()
    housing_mesh.top_radius = radius * 1.14
    housing_mesh.bottom_radius = radius * 1.14
    housing_mesh.height = 0.30
    housing_mesh.radial_segments = 18
    var housing := MeshInstance3D.new()
    housing.mesh = housing_mesh
    housing.rotation.x = PI * 0.5
    housing.material_override = steel
    housing.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    root.add_child(housing)

    var cavity_mesh := CylinderMesh.new()
    cavity_mesh.top_radius = radius * 0.92
    cavity_mesh.bottom_radius = radius * 0.92
    cavity_mesh.height = 0.34
    cavity_mesh.radial_segments = 18
    var cavity := MeshInstance3D.new()
    cavity.mesh = cavity_mesh
    cavity.rotation.x = PI * 0.5
    cavity.position.z = 0.10
    cavity.material_override = hazard_black
    root.add_child(cavity)

    var rotor := Node3D.new()
    rotor.position.z = 0.31
    rotor.set_meta("speed", -3.6 if clockwise else 3.2)
    root.add_child(rotor)
    rotors.append(rotor)

    for index in range(5):
        var blade := MeshInstance3D.new()
        var mesh := BoxMesh.new()
        mesh.size = Vector3(radius * 0.28, radius * 0.88, 0.07)
        blade.mesh = mesh
        blade.position.y = radius * 0.42
        blade.rotation.z = float(index) / 5.0 * TAU
        blade.material_override = pipe_light
        rotor.add_child(blade)
    _sphere_mesh("FanHub", Vector3(0.0, 0.0, 0.37), radius * 0.17, steel, root)


func _vent(position: Vector3, width: float, height: float) -> void:
    _box("VentBack", position, Vector3(width, height, 0.08), hazard_black, Vector3.ZERO, false)
    var slats := 5
    for index in range(slats):
        var y := position.y - height * 0.34 + float(index) * height * 0.17
        _box(
            "VentSlat%d_%d" % [int(position.x * 10.0), index],
            Vector3(position.x, y, position.z + 0.06),
            Vector3(width * 0.78, 0.055, 0.06),
            steel,
            Vector3.ZERO,
            false,
        )


func _indicator_panel(position: Vector3, red: bool) -> void:
    _box("IndicatorCase%d" % int(position.x * 10.0), position, Vector3(0.50, 0.54, 0.10), steel, Vector3.ZERO, false)
    for index in range(3):
        _box(
            "IndicatorLamp%d_%d" % [int(position.x * 10.0), index],
            position + Vector3(0.0, 0.16 - float(index) * 0.16, 0.075),
            Vector3(0.26, 0.065, 0.04),
            warning_red if red and index == 0 else screen_cyan,
            Vector3.ZERO,
            false,
        )


func _pipe_drop(position: Vector3, height: float) -> void:
    _cylinder_mesh("PipeDrop%d" % int(position.x * 10.0), position, 0.13, height, pipe_light, Vector3.ZERO, false)
    _cylinder_mesh(
        "PipeElbow%d" % int(position.x * 10.0),
        position + Vector3(0.23, -height * 0.5, 0.0),
        0.16,
        0.46,
        pipe_dark,
        Vector3(0.0, 0.0, PI * 0.5),
        false,
    )


func _sewer_hatch(position: Vector3) -> void:
    _box("HatchPlate", position, Vector3(1.75, 0.09, 1.35), steel, Vector3.ZERO, false)
    for index in range(7):
        _box(
            "HatchBar%d" % index,
            position + Vector3(0.0, 0.075, -0.52 + float(index) * 0.17),
            Vector3(1.48, 0.045, 0.075),
            hazard_black,
            Vector3.ZERO,
            false,
        )


func _floor_hole(position: Vector3, size: Vector2) -> void:
    _box(
        "FloorHole%d" % int(position.x * 10.0),
        position,
        Vector3(size.x, 0.055, size.y),
        hazard_black,
        Vector3.ZERO,
        false,
    )
    _hazard_stripe(position.x - size.x * 0.48, position.y + 0.04, size.x * 0.96)


func _damage_spikes(position: Vector3, count: int) -> void:
    var area := Area3D.new()
    area.position = position
    area.collision_layer = 0
    area.collision_mask = 1
    add_child(area)

    for index in range(count):
        var mesh := CylinderMesh.new()
        mesh.top_radius = 0.0
        mesh.bottom_radius = 0.17
        mesh.height = 0.72
        mesh.radial_segments = 6
        var spike := MeshInstance3D.new()
        spike.mesh = mesh
        spike.position = Vector3(-0.55 + float(index) * 0.37, 0.36, 0.0)
        spike.material_override = steel
        spike.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
        area.add_child(spike)

    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = Vector3(1.55, 0.68, 0.70)
    collider.shape = shape
    collider.position.y = 0.34
    area.add_child(collider)
    area.body_entered.connect(_on_hazard_body_entered)


func _moving_skiff(start: Vector3, finish: Vector3) -> void:
    var body := AnimatableBody3D.new()
    body.name = "SlipstreamSkiff"
    body.position = start
    body.sync_to_physics = true
    body.collision_layer = 1
    body.collision_mask = 1
    add_child(body)

    _box_child("SkiffHull", Vector3.ZERO, Vector3(2.35, 0.34, 1.65), wall_blue, body)
    _box_child("SkiffDeck", Vector3(0.0, 0.20, 0.0), Vector3(1.95, 0.09, 1.32), floor_top, body)
    _cylinder_child("SkiffThrusterL", Vector3(-0.78, -0.22, -0.56), 0.16, 0.52, screen_cyan, Vector3(0.0, 0.0, PI * 0.5), body)
    _cylinder_child("SkiffThrusterR", Vector3(-0.78, -0.22, 0.56), 0.16, 0.52, screen_cyan, Vector3(0.0, 0.0, PI * 0.5), body)
    _cylinder_child("SkiffGrabBar", Vector3(0.0, -0.65, 0.0), 0.07, 1.35, steel, Vector3(0.0, 0.0, PI * 0.5), body)

    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = Vector3(2.35, 0.34, 1.65)
    collider.shape = shape
    body.add_child(collider)

    moving_bodies.append({
        "body": body,
        "start": start,
        "finish": finish,
        "duration": 4.2,
        "phase": 0.0,
    })


func _spawn_enemy(kind: StringName, position: Vector3, range_value: float, speed: float) -> void:
    var enemy := EnemyActor.new()
    enemy.name = "CameraEnemy" if kind == &"camera" else "SWATbot"
    enemy.configure(kind, player, range_value, speed)
    enemy.position = position
    add_child(enemy)


func _ring_line(start: Vector3, step: Vector3, count: int) -> void:
    for index in range(count):
        _ring(start + step * float(index), float(index) * 0.7)


func _ring_arc(center: Vector3, radius: float, count: int, start_angle: float, end_angle: float) -> void:
    for index in range(count):
        var t := 0.5 if count == 1 else float(index) / float(count - 1)
        var angle := lerpf(start_angle, end_angle, t)
        _ring(center + Vector3(cos(angle) * radius, sin(angle) * radius, 0.0), float(index) * 0.45)


func _ring(position: Vector3, phase: float) -> void:
    var area := Area3D.new()
    area.position = position
    area.collision_layer = 0
    area.collision_mask = 1
    area.set_meta("base_y", position.y)
    area.set_meta("phase", phase)

    var mesh := TorusMesh.new()
    mesh.inner_radius = 0.11
    mesh.outer_radius = 0.24
    mesh.rings = 12
    mesh.ring_segments = 6
    var visual := MeshInstance3D.new()
    visual.mesh = mesh
    visual.rotation.x = PI * 0.5
    visual.material_override = hazard_gold
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    area.add_child(visual)

    var collider := CollisionShape3D.new()
    var shape := SphereShape3D.new()
    shape.radius = 0.32
    collider.shape = shape
    area.add_child(collider)
    area.body_entered.connect(_on_ring_body_entered.bind(area))
    add_child(area)
    rings.append(area)


func _checkpoint(position: Vector3) -> void:
    var area := Area3D.new()
    area.position = position
    area.collision_layer = 0
    area.collision_mask = 1
    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = Vector3(0.8, 2.0, 4.4)
    collider.shape = shape
    area.add_child(collider)
    area.body_entered.connect(_on_checkpoint_body_entered.bind(position))
    add_child(area)

    _cylinder_mesh(
        "Checkpoint%d" % int(position.x),
        position + Vector3(-0.30, 0.72, -2.26),
        0.07,
        1.42,
        screen_cyan,
        Vector3.ZERO,
        false,
    )


func _blast_door(position: Vector3) -> void:
    _box("DoorFrameTop", position + Vector3(0.0, 2.15, 0.0), Vector3(4.5, 0.42, 0.36), steel, Vector3.ZERO, false)
    _box("DoorFrameLeft", position + Vector3(-2.15, 0.15, 0.0), Vector3(0.42, 4.4, 0.36), steel, Vector3.ZERO, false)
    _box("DoorFrameRight", position + Vector3(2.15, 0.15, 0.0), Vector3(0.42, 4.4, 0.36), steel, Vector3.ZERO, false)

    var left := Node3D.new()
    left.position = position + Vector3(-1.0, 0.0, 0.18)
    add_child(left)
    _box_child("DoorLeft", Vector3.ZERO, Vector3(2.0, 4.0, 0.25), wall_dark, left)
    _indicator_panel(left.position + Vector3(0.45, 0.15, 0.22), true)

    var right := Node3D.new()
    right.position = position + Vector3(1.0, 0.0, 0.18)
    add_child(right)
    _box_child("DoorRight", Vector3.ZERO, Vector3(2.0, 4.0, 0.25), wall_blue, right)
    door_panels = [left, right]


func _ally(position: Vector3) -> void:
    var ally := Node3D.new()
    ally.name = "SallyPlaceholder"
    ally.position = position
    add_child(ally)

    var fur := RetroMaterials.make(Color("#a85b32"), Color("#35130c"), Color("#f0a266"), 0.0, 0.86)
    var hair := RetroMaterials.make(Color("#6f2418"), Color("#1e0704"), Color("#bd5a38"), 0.0, 0.90)
    var vest := RetroMaterials.make(Color("#2c6aa2"), Color("#071c35"), Color("#76b7df"), 0.08, 0.78)
    _sphere_mesh("AllyBody", Vector3(0.0, 0.72, 0.0), 0.24, vest, ally)
    _sphere_mesh("AllyHead", Vector3(0.0, 1.17, 0.0), 0.30, fur, ally)
    _sphere_mesh("AllyHair", Vector3(-0.18, 1.23, 0.0), 0.26, hair, ally)
    _cylinder_child("AllyLegL", Vector3(0.0, 0.30, -0.11), 0.045, 0.48, fur, Vector3.ZERO, ally)
    _cylinder_child("AllyLegR", Vector3(0.0, 0.30, 0.11), 0.045, 0.48, fur, Vector3.ZERO, ally)


func _finish_trigger(position: Vector3, size: Vector3) -> void:
    var area := Area3D.new()
    area.position = position
    area.collision_layer = 0
    area.collision_mask = 1
    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = size
    collider.shape = shape
    area.add_child(collider)
    area.body_entered.connect(_on_finish_body_entered)
    add_child(area)


func _open_door() -> void:
    if door_open or door_panels.size() != 2:
        return
    door_open = true
    var tween := create_tween().set_parallel(true)
    tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
    tween.tween_property(door_panels[0], "position:x", door_panels[0].position.x - 1.75, 1.0)
    tween.tween_property(door_panels[1], "position:x", door_panels[1].position.x + 1.75, 1.0)
    status_label.text = "RENDEZVOUS · ROUTE TO THE NEXT ROOM OPEN"
    status_time = 3.0


func _build_ui() -> void:
    var canvas := CanvasLayer.new()
    canvas.layer = 20
    add_child(canvas)

    var title := Label.new()
    title.position = Vector2(10.0, 7.0)
    title.text = "ROBOTROPOLIS · SERVICE SECTOR"
    title.add_theme_font_size_override("font_size", 12)
    title.add_theme_color_override("font_color", Color("#d8f0f1"))
    canvas.add_child(title)

    ring_label = Label.new()
    ring_label.position = Vector2(10.0, 25.0)
    ring_label.add_theme_font_size_override("font_size", 12)
    ring_label.add_theme_color_override("font_color", Color("#ffd44d"))
    canvas.add_child(ring_label)

    state_label = Label.new()
    state_label.position = Vector2(10.0, 42.0)
    state_label.add_theme_font_size_override("font_size", 9)
    state_label.add_theme_color_override("font_color", Color("#80e7ff"))
    canvas.add_child(state_label)

    status_label = Label.new()
    status_label.position = Vector2(80.0, 8.0)
    status_label.size = Vector2(230.0, 30.0)
    status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
    status_label.add_theme_font_size_override("font_size", 9)
    status_label.add_theme_color_override("font_color", Color("#ff9e72"))
    canvas.add_child(status_label)

    var controls := Label.new()
    controls.position = Vector2(8.0, 177.0)
    controls.size = Vector2(304.0, 18.0)
    controls.text = "MOVE WASD · JUMP SPACE · RING F · BUZZSAW E · SPIKE Q · HIDE C"
    controls.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    controls.add_theme_font_size_override("font_size", 7)
    controls.add_theme_color_override("font_color", Color("#bed0d3"))
    canvas.add_child(controls)


func _on_ring_body_entered(body: Node3D, ring: Area3D) -> void:
    if body == player and is_instance_valid(ring):
        player.add_ring()
        rings.erase(ring)
        ring.queue_free()


func _on_hazard_body_entered(body: Node3D) -> void:
    if body == player:
        player.take_damage(global_position)


func _on_checkpoint_body_entered(body: Node3D, position: Vector3) -> void:
    if body == player:
        player.set_spawn(position + Vector3.UP * 0.10)


func _on_finish_body_entered(body: Node3D) -> void:
    if body == player:
        _open_door()


func _on_rings_changed(value: int) -> void:
    ring_label.text = "RINGS / AMMO  %02d" % value


func _on_player_state(value: StringName) -> void:
    state_label.text = "MOVE  %s" % String(value).to_upper().replace("_", " ")


func _on_player_status(message: String) -> void:
    status_label.text = message
    status_time = 2.2


func _box(
    node_name: String,
    position: Vector3,
    size: Vector3,
    material: Material,
    rotation_degrees: Vector3 = Vector3.ZERO,
    collision: bool = true,
) -> Node3D:
    var root: Node3D = StaticBody3D.new() if collision else Node3D.new()
    root.name = node_name
    root.position = position
    root.rotation_degrees = rotation_degrees

    var visual := MeshInstance3D.new()
    var mesh := BoxMesh.new()
    mesh.size = size
    visual.mesh = mesh
    visual.material_override = material
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    root.add_child(visual)

    if collision:
        var collider := CollisionShape3D.new()
        var shape := BoxShape3D.new()
        shape.size = size
        collider.shape = shape
        root.add_child(collider)
        (root as StaticBody3D).collision_layer = 1
        (root as StaticBody3D).collision_mask = 1

    add_child(root)
    return root


func _box_child(
    node_name: String,
    position: Vector3,
    size: Vector3,
    material: Material,
    parent: Node3D,
) -> MeshInstance3D:
    var mesh := BoxMesh.new()
    mesh.size = size
    var visual := MeshInstance3D.new()
    visual.name = node_name
    visual.mesh = mesh
    visual.position = position
    visual.material_override = material
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    parent.add_child(visual)
    return visual


func _cylinder_mesh(
    node_name: String,
    position: Vector3,
    radius: float,
    height: float,
    material: Material,
    rotation: Vector3 = Vector3.ZERO,
    collision: bool = false,
) -> Node3D:
    var root: Node3D = StaticBody3D.new() if collision else Node3D.new()
    root.name = node_name
    root.position = position
    root.rotation = rotation

    var mesh := CylinderMesh.new()
    mesh.top_radius = radius
    mesh.bottom_radius = radius
    mesh.height = height
    mesh.radial_segments = 10
    var visual := MeshInstance3D.new()
    visual.mesh = mesh
    visual.material_override = material
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    root.add_child(visual)

    if collision:
        var collider := CollisionShape3D.new()
        var shape := CylinderShape3D.new()
        shape.radius = radius
        shape.height = height
        collider.shape = shape
        root.add_child(collider)
        (root as StaticBody3D).collision_layer = 1

    add_child(root)
    return root


func _cylinder_child(
    node_name: String,
    position: Vector3,
    radius: float,
    height: float,
    material: Material,
    rotation: Vector3,
    parent: Node3D,
) -> MeshInstance3D:
    var mesh := CylinderMesh.new()
    mesh.top_radius = radius
    mesh.bottom_radius = radius
    mesh.height = height
    mesh.radial_segments = 9
    var visual := MeshInstance3D.new()
    visual.name = node_name
    visual.mesh = mesh
    visual.position = position
    visual.rotation = rotation
    visual.material_override = material
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    parent.add_child(visual)
    return visual


func _sphere_mesh(
    node_name: String,
    position: Vector3,
    radius: float,
    material: Material,
    parent: Node3D,
) -> MeshInstance3D:
    var mesh := SphereMesh.new()
    mesh.radius = radius
    mesh.height = radius * 2.0
    mesh.radial_segments = 10
    mesh.rings = 5
    var visual := MeshInstance3D.new()
    visual.name = node_name
    visual.mesh = mesh
    visual.position = position
    visual.material_override = material
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    parent.add_child(visual)
    return visual
