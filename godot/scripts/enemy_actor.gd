extends CharacterBody3D
class_name EnemyActor

signal defeated(enemy: EnemyActor)

var enemy_kind: StringName = &"camera"
var target: Node3D
var patrol_range: float = 2.0
var patrol_speed: float = 1.15
var facing: float = -1.0
var hp: int = 2
var home_position: Vector3
var elapsed: float = 0.0
var fire_cooldown: float = 0.8
var alert_charge: float = 0.0
var destroyed: bool = false
var visual_root: Node3D
var scan_light: SpotLight3D
var contact_area: Area3D


func configure(
    kind: StringName,
    player_target: Node3D,
    range_value: float = 2.0,
    speed_value: float = 1.15,
) -> void:
    enemy_kind = kind
    target = player_target
    patrol_range = range_value
    patrol_speed = speed_value


func _ready() -> void:
    collision_layer = 2
    collision_mask = 1
    add_to_group("enemy")
    home_position = global_position
    hp = 3 if enemy_kind == &"swatbot" else 2
    _build_collision()
    _build_visual()
    _build_contact_area()


func _physics_process(delta: float) -> void:
    if destroyed:
        return

    elapsed += delta
    fire_cooldown = maxf(0.0, fire_cooldown - delta)

    if enemy_kind == &"camera":
        _update_camera_enemy(delta)
    else:
        _update_swatbot(delta)


func take_hit(
    attack_kind: StringName,
    direction: Vector3 = Vector3.ZERO,
    _hit_position: Vector3 = Vector3.ZERO,
) -> void:
    if destroyed:
        return

    if (
        enemy_kind == &"swatbot"
        and attack_kind == &"ring"
        and direction.x * facing < -0.18
    ):
        _deflect_feedback()
        return

    var damage := 1
    if attack_kind == &"spike":
        damage = 2
    elif attack_kind == &"buzzsaw":
        damage = 3

    hp -= damage
    if hp <= 0:
        _defeat()
    else:
        _hit_feedback(direction)


func _update_camera_enemy(delta: float) -> void:
    global_position = Vector3(
        home_position.x + sin(elapsed * 0.62) * 0.55,
        home_position.y + sin(elapsed * 1.85) * 0.20,
        home_position.z + cos(elapsed * 0.71) * 0.18,
    )
    visual_root.rotation.y += delta * 0.22

    if target == null:
        return

    if scan_light != null:
        scan_light.look_at(target.global_position + Vector3.UP * 0.65, Vector3.UP)

    if not _can_detect_target(7.4):
        alert_charge = maxf(0.0, alert_charge - delta * 1.8)
        return

    alert_charge += delta
    if alert_charge >= 0.55 and fire_cooldown <= 0.0:
        _fire_at_target(5.4)
        fire_cooldown = 1.35
        alert_charge = 0.0


func _update_swatbot(delta: float) -> void:
    var target_in_range := _can_detect_target(6.2)

    if target_in_range and target != null:
        facing = signf(target.global_position.x - global_position.x)
        velocity.x = move_toward(velocity.x, 0.0, 12.0 * delta)
        if fire_cooldown <= 0.0:
            _fire_at_target(4.8)
            fire_cooldown = 1.55
    else:
        var left_edge := home_position.x - patrol_range
        var right_edge := home_position.x + patrol_range
        if global_position.x <= left_edge:
            facing = 1.0
        elif global_position.x >= right_edge:
            facing = -1.0
        velocity.x = move_toward(velocity.x, facing * patrol_speed, 7.0 * delta)

    velocity.z = move_toward(velocity.z, 0.0, 8.0 * delta)
    if not is_on_floor():
        velocity.y -= 22.0 * delta
    else:
        velocity.y = -0.1

    move_and_slide()
    visual_root.rotation.y = lerp_angle(
        visual_root.rotation.y,
        0.0 if facing > 0.0 else PI,
        minf(1.0, delta * 12.0),
    )

    var walk_phase := elapsed * (5.0 + absf(velocity.x) * 2.2)
    var body := visual_root.get_node_or_null("Body") as Node3D
    if body != null:
        body.position.y = 0.72 + absf(sin(walk_phase)) * 0.025


func _can_detect_target(max_distance: float) -> bool:
    if target == null or destroyed:
        return false
    if target.has_method("is_hidden_from_enemies") and bool(target.call("is_hidden_from_enemies")):
        return global_position.distance_to(target.global_position) < 1.6
    if global_position.distance_to(target.global_position) > max_distance:
        return false

    var from := global_position + Vector3.UP * 0.55
    var to := target.global_position + Vector3.UP * 0.60
    var query := PhysicsRayQueryParameters3D.create(from, to, 1, [get_rid()])
    var result := get_world_3d().direct_space_state.intersect_ray(query)
    return result.is_empty() or result.get("collider") == target


func _fire_at_target(projectile_speed: float) -> void:
    if target == null:
        return

    var origin := global_position + Vector3(facing * 0.42, 0.62, 0.0)
    if enemy_kind == &"camera":
        origin = global_position + Vector3(0.0, -0.05, 0.0)
    var aim := (target.global_position + Vector3.UP * 0.58 - origin).normalized()
    var projectile := AbilityProjectile.new()
    projectile.configure(&"enemy_bolt", &"enemy", aim, self, projectile_speed, 2.4)
    get_tree().current_scene.add_child(projectile)
    projectile.global_position = origin


func _build_collision() -> void:
    var collider := CollisionShape3D.new()
    if enemy_kind == &"camera":
        var shape := SphereShape3D.new()
        shape.radius = 0.42
        collider.shape = shape
        collider.position.y = 0.02
    else:
        var shape := CapsuleShape3D.new()
        shape.radius = 0.30
        shape.height = 1.42
        collider.shape = shape
        collider.position.y = 0.70
    add_child(collider)


func _build_contact_area() -> void:
    contact_area = Area3D.new()
    contact_area.name = "DamageArea"
    contact_area.collision_layer = 0
    contact_area.collision_mask = 1
    contact_area.monitorable = false
    var collider := CollisionShape3D.new()
    var shape := SphereShape3D.new()
    shape.radius = 0.48 if enemy_kind == &"camera" else 0.56
    collider.shape = shape
    collider.position.y = 0.55 if enemy_kind == &"swatbot" else 0.0
    contact_area.add_child(collider)
    contact_area.body_entered.connect(_on_contact_body_entered)
    add_child(contact_area)


func _on_contact_body_entered(body: Node3D) -> void:
    if destroyed:
        return
    if body.has_method("take_damage"):
        body.call("take_damage", global_position)


func _build_visual() -> void:
    visual_root = Node3D.new()
    visual_root.name = "EnemyVisual"
    add_child(visual_root)

    if enemy_kind == &"camera":
        _build_camera_visual()
    else:
        _build_swatbot_visual()


func _build_camera_visual() -> void:
    var shell := RetroMaterials.make(
        Color("#66737d"), Color("#151b22"), Color("#d2e1e8"), 0.72, 0.38,
        Color.BLACK, 0.0, Color("#252f37"), Vector2(3.0, 2.0), 0.36
    )
    var dark := RetroMaterials.make(
        Color("#202a32"), Color("#05080b"), Color("#84919c"), 0.62, 0.48
    )
    var lens := RetroMaterials.make(
        Color("#7c130d"), Color("#180101"), Color("#ff8a5c"), 0.12, 0.32,
        Color("#ff2e1b"), 3.4
    )
    var warning := RetroMaterials.make(
        Color("#d4a52a"), Color("#3d2505"), Color("#fff282"), 0.45, 0.48
    )

    _sphere_mesh("Shell", 0.40, Vector3.ZERO, Vector3(1.05, 0.88, 0.92), shell, visual_root)
    _cylinder_mesh("LensHousing", 0.19, 0.20, Vector3(0.36, 0.0, 0.0), Vector3(0.0, 0.0, -PI * 0.5), dark, visual_root)
    _sphere_mesh("Lens", 0.16, Vector3(0.46, 0.0, 0.0), Vector3(0.55, 1.0, 1.0), lens, visual_root)
    _cylinder_mesh("Antenna", 0.025, 0.32, Vector3(0.0, 0.48, 0.0), Vector3.ZERO, dark, visual_root)
    _sphere_mesh("WarningLamp", 0.07, Vector3(0.0, 0.67, 0.0), Vector3.ONE, lens, visual_root)
    _box_mesh("StripeA", Vector3(-0.12, 0.0, 0.38), Vector3(0.16, 0.10, 0.05), warning, visual_root)
    _box_mesh("StripeB", Vector3(0.10, 0.0, 0.39), Vector3(0.12, 0.10, 0.05), dark, visual_root)

    scan_light = SpotLight3D.new()
    scan_light.name = "ScanCone"
    scan_light.position = Vector3(0.38, -0.02, 0.0)
    scan_light.light_color = Color("#ff3b2a")
    scan_light.light_energy = 2.0
    scan_light.spot_range = 7.5
    scan_light.spot_angle = 20.0
    scan_light.shadow_enabled = true
    visual_root.add_child(scan_light)


func _build_swatbot_visual() -> void:
    var armour := RetroMaterials.make(
        Color("#626d78"), Color("#151a21"), Color("#d6e2e7"), 0.76, 0.36,
        Color.BLACK, 0.0, Color("#2c353e"), Vector2(3.0, 4.0), 0.32
    )
    var dark := RetroMaterials.make(
        Color("#242b34"), Color("#05070a"), Color("#75818c"), 0.62, 0.48
    )
    var visor := RetroMaterials.make(
        Color("#6b0d0d"), Color("#160101"), Color("#ff8b65"), 0.08, 0.35,
        Color("#ff2b1e"), 3.2
    )
    var hazard := RetroMaterials.make(
        Color("#c79e2b"), Color("#3e2605"), Color("#ffe785"), 0.42, 0.52
    )

    var body := Node3D.new()
    body.name = "Body"
    body.position.y = 0.72
    visual_root.add_child(body)

    _box_mesh("Torso", Vector3.ZERO, Vector3(0.62, 0.72, 0.48), armour, body)
    _box_mesh("ChestPlate", Vector3(0.32, 0.02, 0.0), Vector3(0.10, 0.44, 0.38), hazard, body)
    _box_mesh("Head", Vector3(0.0, 0.54, 0.0), Vector3(0.52, 0.34, 0.42), dark, body)
    _box_mesh("Visor", Vector3(0.27, 0.55, 0.0), Vector3(0.06, 0.12, 0.28), visor, body)
    _cylinder_mesh("Cannon", 0.13, 0.58, Vector3(0.18, 0.18, -0.38), Vector3(0.0, 0.0, -PI * 0.5), dark, body)
    _sphere_mesh("CannonGlow", 0.10, Vector3(0.49, 0.18, -0.38), Vector3(0.58, 1.0, 1.0), visor, body)
    _cylinder_mesh("Arm", 0.085, 0.52, Vector3(0.0, 0.10, 0.38), Vector3.ZERO, armour, body)
    _box_mesh("Fist", Vector3(0.0, -0.18, 0.38), Vector3(0.25, 0.20, 0.24), dark, body)
    _cylinder_mesh("LegLeft", 0.10, 0.58, Vector3(0.0, -0.60, -0.16), Vector3.ZERO, dark, body)
    _cylinder_mesh("LegRight", 0.10, 0.58, Vector3(0.0, -0.60, 0.16), Vector3.ZERO, dark, body)
    _box_mesh("FootLeft", Vector3(0.10, -0.90, -0.16), Vector3(0.38, 0.16, 0.22), armour, body)
    _box_mesh("FootRight", Vector3(0.10, -0.90, 0.16), Vector3(0.38, 0.16, 0.22), armour, body)


func _hit_feedback(direction: Vector3) -> void:
    if visual_root == null:
        return
    var push := -signf(direction.x) * 0.10 if absf(direction.x) > 0.01 else 0.08
    var tween := create_tween()
    tween.tween_property(visual_root, "position:x", push, 0.055)
    tween.tween_property(visual_root, "position:x", 0.0, 0.09)


func _deflect_feedback() -> void:
    if visual_root == null:
        return
    var tween := create_tween()
    tween.tween_property(visual_root, "rotation:z", -0.08, 0.04)
    tween.tween_property(visual_root, "rotation:z", 0.08, 0.04)
    tween.tween_property(visual_root, "rotation:z", 0.0, 0.05)


func _defeat() -> void:
    destroyed = true
    collision_layer = 0
    collision_mask = 0
    contact_area.set_deferred("monitoring", false)
    for child in get_children():
        if child is CollisionShape3D:
            child.set_deferred("disabled", true)

    var flash := OmniLight3D.new()
    flash.light_color = Color("#ffb34d")
    flash.light_energy = 3.8
    flash.omni_range = 4.0
    add_child(flash)

    var tween := create_tween().set_parallel(true)
    tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
    tween.tween_property(visual_root, "scale", Vector3(1.45, 0.05, 1.45), 0.24)
    tween.tween_property(visual_root, "rotation:y", visual_root.rotation.y + PI * 1.5, 0.24)
    tween.tween_property(flash, "light_energy", 0.0, 0.24)
    tween.chain().tween_callback(_finish_defeat)


func _finish_defeat() -> void:
    defeated.emit(self)
    queue_free()


func _sphere_mesh(
    node_name: String,
    radius: float,
    local_position: Vector3,
    local_scale: Vector3,
    material: Material,
    parent: Node3D,
) -> MeshInstance3D:
    var mesh := SphereMesh.new()
    mesh.radius = radius
    mesh.height = radius * 2.0
    mesh.radial_segments = 10
    mesh.rings = 5
    var instance := _mesh(node_name, mesh, material, parent)
    instance.position = local_position
    instance.scale = local_scale
    return instance


func _cylinder_mesh(
    node_name: String,
    radius: float,
    height: float,
    local_position: Vector3,
    local_rotation: Vector3,
    material: Material,
    parent: Node3D,
) -> MeshInstance3D:
    var mesh := CylinderMesh.new()
    mesh.top_radius = radius
    mesh.bottom_radius = radius
    mesh.height = height
    mesh.radial_segments = 8
    var instance := _mesh(node_name, mesh, material, parent)
    instance.position = local_position
    instance.rotation = local_rotation
    return instance


func _box_mesh(
    node_name: String,
    local_position: Vector3,
    size: Vector3,
    material: Material,
    parent: Node3D,
) -> MeshInstance3D:
    var mesh := BoxMesh.new()
    mesh.size = size
    var instance := _mesh(node_name, mesh, material, parent)
    instance.position = local_position
    return instance


func _mesh(
    node_name: String,
    mesh: Mesh,
    material: Material,
    parent: Node3D,
) -> MeshInstance3D:
    var instance := MeshInstance3D.new()
    instance.name = node_name
    instance.mesh = mesh
    instance.material_override = material
    instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    parent.add_child(instance)
    return instance
