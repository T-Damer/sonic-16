extends Node3D

const ALLY_TEXTURE: Texture2D = preload("res://assets/ally.svg")

@export_node_path("CharacterBody3D") var player_path: NodePath
@onready var player: SonicPlayer = get_node(player_path) as SonicPlayer

var rotors: Array[Node3D] = []
var rings: Array[Area3D] = []
var hoverers: Array[Dictionary] = []
var platforms: Array[Dictionary] = []
var door_panels: Array[AnimatableBody3D] = []
var door_open := false
var elapsed := 0.0
var ring_label: Label
var status_label: Label


func _ready() -> void:
    process_mode = Node.PROCESS_MODE_ALWAYS
    _build_environment()
    _build_level()
    _build_ui()
    player.rings_changed.connect(_on_rings_changed)
    _on_rings_changed(player.rings)


func _process(delta: float) -> void:
    if get_tree().paused:
        return
    elapsed += delta

    for rotor in rotors:
        if is_instance_valid(rotor):
            rotor.rotation.z += delta * 3.8
    for ring in rings:
        if is_instance_valid(ring):
            ring.rotation.y += delta * 2.8
    for item in hoverers:
        var node := item["node"] as Node3D
        if is_instance_valid(node):
            var origin: Vector3 = item["origin"]
            node.position.y = origin.y + sin(elapsed * 1.7 + float(item["phase"])) * 0.24
            node.rotation.y += delta * 0.35


func _physics_process(delta: float) -> void:
    if get_tree().paused:
        return
    for item in platforms:
        var body := item["body"] as AnimatableBody3D
        if not is_instance_valid(body):
            continue
        var phase := fmod(float(item["phase"]) + delta / float(item["duration"]), 1.0)
        item["phase"] = phase
        var weight := (1.0 - cos(phase * TAU)) * 0.5
        var start: Vector3 = item["start"]
        var finish: Vector3 = item["finish"]
        body.position = start.lerp(finish, weight)


func _unhandled_input(_event: InputEvent) -> void:
    if Input.is_action_just_pressed(&"pause"):
        get_tree().paused = not get_tree().paused
        status_label.text = "PAUSED · ESC / P" if get_tree().paused else ""
        get_viewport().set_input_as_handled()
    elif Input.is_action_just_pressed(&"restart"):
        get_tree().paused = false
        player.reset_to_spawn()
        status_label.text = ""
        get_viewport().set_input_as_handled()


func _build_environment() -> void:
    var world := WorldEnvironment.new()
    var environment := Environment.new()
    environment.background_mode = Environment.BG_COLOR
    environment.background_color = Color("#081522")
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color("#7189a5")
    environment.ambient_light_energy = 0.48
    environment.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
    environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
    environment.fog_enabled = true
    environment.fog_light_color = Color("#18354a")
    environment.fog_light_energy = 0.75
    environment.fog_density = 0.013
    environment.fog_height = 5.0
    environment.fog_height_density = 0.08
    world.environment = environment
    add_child(world)

    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-52.0, -38.0, 0.0)
    sun.light_color = Color("#ffd6a3")
    sun.light_energy = 1.35
    sun.shadow_enabled = true
    sun.directional_shadow_max_distance = 85.0
    add_child(sun)

    var fill := DirectionalLight3D.new()
    fill.rotation_degrees = Vector3(-25.0, 145.0, 0.0)
    fill.light_color = Color("#69b6d8")
    fill.light_energy = 0.32
    add_child(fill)


func _build_level() -> void:
    var deck := _material(Color("#6b7a76"), 0.55, 0.50)
    var deck_side := _material(Color("#244c56"), 0.65, 0.38)
    var wall := _material(Color("#263746"), 0.70, 0.42)
    var pipe := _material(Color("#8eb9c6"), 0.75, 0.28)
    var dark := _material(Color("#111d28"), 0.80, 0.35)
    var green := _material(Color("#2e654f"), 0.65, 0.45)
    var cyan := _material(Color("#14516a"), 0.30, 0.35, Color("#37c8ee"), 2.4)
    var red := _material(Color("#4a1919"), 0.25, 0.45, Color("#ff503d"), 2.8)
    var gold := _material(Color("#f0b722"), 0.85, 0.22, Color("#ffcf45"), 0.65)

    # Native StaticBody3D blockout. Replace these with a GridMap + CC0 GLTF kit after approval.
    var blocks := [
        ["EntryDeck", Vector3(-5.0, -0.5, 0.0), Vector3(18.0, 1.0, 7.0), deck, Vector3.ZERO],
        ["EntryRamp", Vector3(3.6, -0.82, 0.0), Vector3(4.8, 0.55, 6.4), deck_side, Vector3(0.0, 0.0, -13.0)],
        ["MidDeck", Vector3(8.6, -1.65, -0.45), Vector3(6.2, 1.0, 6.0), deck, Vector3.ZERO],
        ["DescentRamp", Vector3(13.3, -2.28, -0.25), Vector3(4.8, 0.55, 5.8), deck_side, Vector3(0.0, 0.0, -16.0)],
        ["LowDeck", Vector3(20.8, -3.55, 0.0), Vector3(11.0, 1.0, 8.0), deck, Vector3.ZERO],
        ["ArenaDeck", Vector3(40.8, -1.75, 0.0), Vector3(13.0, 1.0, 10.0), deck, Vector3.ZERO],
        ["ExitDeck", Vector3(50.2, -1.75, 0.0), Vector3(6.0, 1.0, 6.0), deck, Vector3.ZERO],
        ["MachineA", Vector3(-5.0, 1.25, -1.8), Vector3(2.2, 2.5, 1.5), wall, Vector3.ZERO],
        ["MachineB", Vector3(-0.7, 1.65, 1.7), Vector3(1.7, 3.3, 1.6), wall, Vector3.ZERO],
        ["MachineC", Vector3(7.8, 0.15, -1.8), Vector3(1.5, 2.6, 1.4), green, Vector3.ZERO],
        ["MachineD", Vector3(19.0, -1.55, 2.2), Vector3(1.8, 3.0, 1.5), wall, Vector3.ZERO],
    ]
    for block in blocks:
        _box(block[0], block[1], block[2], block[3], block[4])

    _cylinder(Vector3(-5.0, -0.1, 3.7), 0.12, 18.0, green, Vector3(0.0, 0.0, 90.0))
    _cylinder(Vector3(20.8, -3.15, 4.15), 0.13, 11.0, green, Vector3(0.0, 0.0, 90.0))
    _cylinder(Vector3(11.0, 3.1, -4.6), 0.28, 24.0, pipe, Vector3(0.0, 0.0, 90.0))

    _sewer_grate(Vector3(-11.0, 0.04, 0.0), dark)
    _fan(Vector3(-7.2, 2.8, -4.8), 1.15, cyan, wall)
    _fan(Vector3(1.9, 2.7, -4.8), 1.35, cyan, wall)
    _fan(Vector3(38.2, 1.5, -5.5), 1.45, cyan, wall)
    _fan(Vector3(45.2, 1.5, -5.5), 1.45, red, wall)
    _robotropolis(wall, dark, pipe, cyan, red)

    var ring_route := [
        Vector3(-9.0, 0.65, 0.0), Vector3(-7.4, 0.65, 1.6), Vector3(-5.5, 0.65, 0.9),
        Vector3(-3.3, 0.65, -1.5), Vector3(-1.1, 0.65, -0.4), Vector3(2.1, 0.3, 1.2),
        Vector3(5.9, -0.65, -0.8), Vector3(9.0, -0.55, 1.4), Vector3(12.2, -1.1, 0.0),
        Vector3(17.0, -2.35, -1.8), Vector3(19.0, -2.35, 0.0), Vector3(21.0, -2.35, 1.8),
        Vector3(23.2, -2.35, 0.7), Vector3(25.0, -2.35, -1.2), Vector3(36.8, -0.55, -1.8),
        Vector3(39.0, -0.55, 0.0), Vector3(41.2, -0.55, 1.8),
    ]
    for point in ring_route:
        _ring(point, gold)

    _spikes(Vector3(22.4, -3.0, -2.0), gold)
    _spikes(Vector3(24.8, -3.0, 1.2), gold)
    _skiff(Vector3(27.3, -2.8, 0.0), Vector3(34.6, -0.95, 0.0), green, cyan)
    _drone(Vector3(4.5, 2.5, 1.8), wall, red)
    _drone(Vector3(18.0, 0.2, -2.3), wall, cyan)
    _blast_door(Vector3(47.4, 0.95, 0.0), wall, green, red)
    _ally(Vector3(44.8, -1.18, 2.5))
    _finish_trigger(Vector3(46.0, -0.2, 0.0), Vector3(3.0, 3.0, 8.0))


func _robotropolis(wall: Material, dark: Material, pipe: Material, cyan: Material, red: Material) -> void:
    var heights := [7.0, 11.0, 8.5, 13.0, 9.0, 15.0, 10.0, 12.5, 8.0, 14.0, 9.5, 12.0]
    for index in range(heights.size()):
        var height: float = heights[index]
        var x := -20.0 + float(index) * 7.2
        var z := -17.0 - float(index % 3) * 2.2
        _box("Tower%d" % index, Vector3(x, height * 0.5 - 3.0, z), Vector3(4.2, height, 3.8), wall if index % 2 == 0 else dark, Vector3.ZERO, false)
        _cylinder(Vector3(x + 1.1, height + 0.5, z), 0.42, 4.0 + float(index % 3), pipe)
        for row in range(3):
            _box("Window%d_%d" % [index, row], Vector3(x + 2.12, 0.8 + float(row) * 1.8, z + 0.3), Vector3(0.12, 0.5, 1.1), cyan if index % 3 else red, Vector3.ZERO, false)
    _cylinder(Vector3(8.0, 5.7, -14.0), 0.35, 52.0, pipe, Vector3(0.0, 0.0, 90.0))


func _box(name: String, pos: Vector3, size: Vector3, material: Material, rotation := Vector3.ZERO, collision := true) -> Node3D:
    var root: Node3D = StaticBody3D.new() if collision else Node3D.new()
    root.name = name
    root.position = pos
    root.rotation_degrees = rotation
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
    add_child(root)
    return root


func _cylinder(pos: Vector3, radius: float, height: float, material: Material, rotation := Vector3.ZERO) -> Node3D:
    var root := Node3D.new()
    root.position = pos
    root.rotation_degrees = rotation
    var visual := MeshInstance3D.new()
    var mesh := CylinderMesh.new()
    mesh.top_radius = radius
    mesh.bottom_radius = radius
    mesh.height = height
    mesh.radial_segments = 12
    visual.mesh = mesh
    visual.material_override = material
    visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    root.add_child(visual)
    add_child(root)
    return root


func _sewer_grate(pos: Vector3, material: Material) -> void:
    for index in range(7):
        _box("Grate%d" % index, pos + Vector3(0.0, 0.0, -0.55 + float(index) * 0.18), Vector3(1.7, 0.05, 0.09), material, Vector3.ZERO, false)


func _fan(pos: Vector3, radius: float, blade_material: Material, housing_material: Material) -> void:
    var fan := Node3D.new()
    fan.position = pos
    add_child(fan)
    var housing := MeshInstance3D.new()
    var shell := CylinderMesh.new()
    shell.top_radius = radius * 1.2
    shell.bottom_radius = radius * 1.2
    shell.height = 0.35
    shell.radial_segments = 20
    housing.mesh = shell
    housing.material_override = housing_material
    housing.rotation_degrees.x = 90.0
    fan.add_child(housing)
    var rotor := Node3D.new()
    rotor.position.z = 0.23
    fan.add_child(rotor)
    rotors.append(rotor)
    for index in range(4):
        var blade := MeshInstance3D.new()
        var mesh := BoxMesh.new()
        mesh.size = Vector3(radius * 0.25, radius * 0.95, 0.08)
        blade.mesh = mesh
        blade.material_override = blade_material
        blade.position.y = radius * 0.42
        blade.rotation.z = float(index) * PI * 0.5
        rotor.add_child(blade)


func _ring(pos: Vector3, material: Material) -> void:
    var area := Area3D.new()
    area.position = pos
    area.collision_layer = 0
    area.collision_mask = 1
    var visual := MeshInstance3D.new()
    var mesh := TorusMesh.new()
    mesh.inner_radius = 0.14
    mesh.outer_radius = 0.30
    mesh.rings = 16
    mesh.ring_segments = 8
    visual.mesh = mesh
    visual.material_override = material
    visual.rotation_degrees.x = 90.0
    area.add_child(visual)
    var collider := CollisionShape3D.new()
    var shape := SphereShape3D.new()
    shape.radius = 0.38
    collider.shape = shape
    area.add_child(collider)
    area.body_entered.connect(_on_ring_entered.bind(area))
    add_child(area)
    rings.append(area)


func _spikes(pos: Vector3, material: Material) -> void:
    var area := Area3D.new()
    area.position = pos
    area.collision_layer = 0
    area.collision_mask = 1
    add_child(area)
    for index in range(5):
        var spike := MeshInstance3D.new()
        var mesh := CylinderMesh.new()
        mesh.top_radius = 0.0
        mesh.bottom_radius = 0.23
        mesh.height = 0.85
        mesh.radial_segments = 6
        spike.mesh = mesh
        spike.material_override = material
        spike.position = Vector3(-0.8 + float(index) * 0.4, 0.42, 0.0)
        area.add_child(spike)
    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = Vector3(2.0, 0.8, 0.8)
    collider.position.y = 0.4
    collider.shape = shape
    area.add_child(collider)
    area.body_entered.connect(_on_hazard_entered)


func _skiff(start: Vector3, finish: Vector3, hull_material: Material, glow_material: Material) -> void:
    var body := AnimatableBody3D.new()
    body.position = start
    body.sync_to_physics = true
    add_child(body)
    var size := Vector3(2.8, 0.38, 2.0)
    var hull := MeshInstance3D.new()
    var mesh := BoxMesh.new()
    mesh.size = size
    hull.mesh = mesh
    hull.material_override = hull_material
    body.add_child(hull)
    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = size
    collider.shape = shape
    body.add_child(collider)
    for side in [-1.0, 1.0]:
        var thruster := MeshInstance3D.new()
        var thruster_mesh := CylinderMesh.new()
        thruster_mesh.top_radius = 0.18
        thruster_mesh.bottom_radius = 0.24
        thruster_mesh.height = 0.55
        thruster.mesh = thruster_mesh
        thruster.material_override = glow_material
        thruster.rotation_degrees.z = 90.0
        thruster.position = Vector3(-0.9, -0.25, side * 0.65)
        body.add_child(thruster)
    platforms.append({"body": body, "start": start, "finish": finish, "duration": 3.8, "phase": 0.0})


func _drone(pos: Vector3, shell_material: Material, eye_material: Material) -> void:
    var drone := Node3D.new()
    drone.position = pos
    add_child(drone)
    var shell := MeshInstance3D.new()
    var shell_mesh := SphereMesh.new()
    shell_mesh.radius = 0.42
    shell_mesh.height = 0.84
    shell.mesh = shell_mesh
    shell.material_override = shell_material
    drone.add_child(shell)
    var eye := MeshInstance3D.new()
    var eye_mesh := SphereMesh.new()
    eye_mesh.radius = 0.16
    eye_mesh.height = 0.22
    eye.mesh = eye_mesh
    eye.material_override = eye_material
    eye.position = Vector3(0.0, 0.02, 0.37)
    eye.scale = Vector3(1.25, 0.8, 0.55)
    drone.add_child(eye)
    var light := SpotLight3D.new()
    light.light_color = Color("#ff493d")
    light.light_energy = 2.0
    light.spot_range = 7.0
    light.spot_angle = 22.0
    light.rotation_degrees.x = -55.0
    light.position = Vector3(0.0, -0.15, 0.25)
    light.shadow_enabled = true
    drone.add_child(light)
    hoverers.append({"node": drone, "origin": pos, "phase": float(hoverers.size()) * 1.7})


func _blast_door(pos: Vector3, frame: Material, panel: Material, warning: Material) -> void:
    _box("DoorTop", pos + Vector3(0.0, 2.45, 0.0), Vector3(0.8, 0.5, 5.8), frame)
    _box("DoorSideL", pos + Vector3(0.0, 0.0, -3.0), Vector3(0.8, 5.0, 0.5), frame)
    _box("DoorSideR", pos + Vector3(0.0, 0.0, 3.0), Vector3(0.8, 5.0, 0.5), frame)
    door_panels.append(_moving_box(pos + Vector3(0.0, 0.0, -1.35), Vector3(0.45, 4.5, 2.7), panel))
    door_panels.append(_moving_box(pos + Vector3(0.0, 0.0, 1.35), Vector3(0.45, 4.5, 2.7), panel))
    _box("DoorWarning", pos + Vector3(-0.45, 2.65, 0.0), Vector3(0.15, 0.28, 0.55), warning, Vector3.ZERO, false)


func _moving_box(pos: Vector3, size: Vector3, material: Material) -> AnimatableBody3D:
    var body := AnimatableBody3D.new()
    body.position = pos
    body.sync_to_physics = true
    add_child(body)
    var visual := MeshInstance3D.new()
    var mesh := BoxMesh.new()
    mesh.size = size
    visual.mesh = mesh
    visual.material_override = material
    body.add_child(visual)
    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = size
    collider.shape = shape
    body.add_child(collider)
    return body


func _ally(pos: Vector3) -> void:
    var sprite := Sprite3D.new()
    sprite.texture = ALLY_TEXTURE
    sprite.position = pos + Vector3.UP * 0.85
    sprite.pixel_size = 0.018
    sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
    sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
    sprite.shaded = true
    sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_DOUBLE_SIDED
    add_child(sprite)


func _finish_trigger(pos: Vector3, size: Vector3) -> void:
    var area := Area3D.new()
    area.position = pos
    area.collision_layer = 0
    area.collision_mask = 1
    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = size
    collider.shape = shape
    area.add_child(collider)
    area.body_entered.connect(_on_finish_entered)
    add_child(area)


func _open_door() -> void:
    if door_open or door_panels.size() != 2:
        return
    door_open = true
    var tween := create_tween().set_parallel(true)
    tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
    tween.tween_property(door_panels[0], "position:z", door_panels[0].position.z - 2.4, 1.15)
    tween.tween_property(door_panels[1], "position:z", door_panels[1].position.z + 2.4, 1.15)
    status_label.text = "RENDEZVOUS REACHED · DOOR OPEN"


func _build_ui() -> void:
    var canvas := CanvasLayer.new()
    add_child(canvas)
    var title := Label.new()
    title.position = Vector2(14.0, 10.0)
    title.text = "ROBOTROPOLIS · ACT 1"
    title.add_theme_font_size_override("font_size", 16)
    title.add_theme_color_override("font_color", Color("#d9f2ff"))
    canvas.add_child(title)
    ring_label = Label.new()
    ring_label.position = Vector2(14.0, 34.0)
    ring_label.add_theme_font_size_override("font_size", 14)
    ring_label.add_theme_color_override("font_color", Color("#ffd154"))
    canvas.add_child(ring_label)
    var controls := Label.new()
    controls.position = Vector2(14.0, 238.0)
    controls.text = "WASD / ARROWS · MOVE IN DEPTH    SPACE / K · JUMP    R · RESET    ESC / P · PAUSE"
    controls.add_theme_font_size_override("font_size", 10)
    controls.add_theme_color_override("font_color", Color("#b8cad4"))
    canvas.add_child(controls)
    status_label = Label.new()
    status_label.position = Vector2(150.0, 12.0)
    status_label.size = Vector2(320.0, 28.0)
    status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
    status_label.add_theme_font_size_override("font_size", 12)
    status_label.add_theme_color_override("font_color", Color("#ff7568"))
    canvas.add_child(status_label)


func _on_ring_entered(body: Node3D, ring: Area3D) -> void:
    if body == player and is_instance_valid(ring):
        player.add_ring()
        ring.queue_free()


func _on_hazard_entered(body: Node3D) -> void:
    if body == player:
        player.reset_to_spawn()


func _on_finish_entered(body: Node3D) -> void:
    if body == player:
        _open_door()


func _on_rings_changed(value: int) -> void:
    ring_label.text = "RINGS  %02d" % value


func _material(albedo: Color, metallic: float, roughness: float, emission := Color.BLACK, energy := 1.0) -> StandardMaterial3D:
    var material := StandardMaterial3D.new()
    material.albedo_color = albedo
    material.metallic = metallic
    material.roughness = roughness
    if emission != Color.BLACK:
        material.emission_enabled = true
        material.emission = emission
        material.emission_energy_multiplier = energy
    return material
