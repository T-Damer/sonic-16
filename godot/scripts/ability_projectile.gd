extends Area3D
class_name AbilityProjectile

var attack_kind: StringName = &"ring"
var team: StringName = &"player"
var direction: Vector3 = Vector3.RIGHT
var speed: float = 9.0
var lifetime: float = 1.5
var source: Node
var elapsed: float = 0.0
var visual_root: Node3D


func configure(
    new_kind: StringName,
    new_team: StringName,
    new_direction: Vector3,
    new_source: Node,
    new_speed: float = 9.0,
    new_lifetime: float = 1.5,
) -> void:
    attack_kind = new_kind
    team = new_team
    direction = new_direction.normalized() if new_direction.length_squared() > 0.001 else Vector3.RIGHT
    source = new_source
    speed = new_speed
    lifetime = new_lifetime


func _ready() -> void:
    collision_layer = 0
    collision_mask = 3 if team == &"player" else 1
    monitoring = true
    monitorable = false
    body_entered.connect(_on_body_entered)
    _build_visual()


func _physics_process(delta: float) -> void:
    elapsed += delta
    global_position += direction * speed * delta

    if visual_root != null:
        if attack_kind == &"ring":
            visual_root.rotation.y += delta * 15.0
            visual_root.rotation.z += delta * 6.0
        elif attack_kind == &"spike":
            visual_root.rotation.x += delta * 12.0
        else:
            visual_root.rotation.z += delta * 8.0

    if elapsed >= lifetime:
        queue_free()


func _on_body_entered(body: Node3D) -> void:
    if body == source:
        return

    if team == &"player":
        if body.has_method("take_hit"):
            body.call("take_hit", attack_kind, direction, global_position)
            queue_free()
        elif body is StaticBody3D:
            queue_free()
    else:
        if body.has_method("take_damage"):
            body.call("take_damage", global_position)
            queue_free()
        elif body is StaticBody3D:
            queue_free()


func _build_visual() -> void:
    visual_root = Node3D.new()
    visual_root.name = "ProjectileVisual"
    add_child(visual_root)

    var collider := CollisionShape3D.new()
    var shape := SphereShape3D.new()
    collider.shape = shape
    add_child(collider)

    match attack_kind:
        &"ring":
            shape.radius = 0.24
            var ring_mesh := TorusMesh.new()
            ring_mesh.inner_radius = 0.105
            ring_mesh.outer_radius = 0.235
            ring_mesh.rings = 12
            ring_mesh.ring_segments = 6
            var ring := MeshInstance3D.new()
            ring.mesh = ring_mesh
            ring.material_override = RetroMaterials.make(
                Color("#e8aa18"), Color("#5b2f05"), Color("#fff28a"), 0.72, 0.28,
                Color("#ffcf32"), 0.55
            )
            ring.rotation.x = PI * 0.5
            ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
            visual_root.add_child(ring)
        &"spike":
            shape.radius = 0.17
            var spike_mesh := CylinderMesh.new()
            spike_mesh.top_radius = 0.0
            spike_mesh.bottom_radius = 0.075
            spike_mesh.height = 0.42
            spike_mesh.radial_segments = 6
            var spike := MeshInstance3D.new()
            spike.mesh = spike_mesh
            spike.material_override = RetroMaterials.make(
                Color("#dce8ef"), Color("#344456"), Color.WHITE, 0.18, 0.48,
                Color("#79cfff"), 0.18
            )
            spike.rotation.z = PI * 0.5
            spike.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
            visual_root.add_child(spike)
            visual_root.look_at(global_position + direction, Vector3.UP)
        _:
            shape.radius = 0.20
            var bolt_mesh := SphereMesh.new()
            bolt_mesh.radius = 0.16
            bolt_mesh.height = 0.32
            bolt_mesh.radial_segments = 10
            bolt_mesh.rings = 5
            var bolt := MeshInstance3D.new()
            bolt.mesh = bolt_mesh
            bolt.scale = Vector3(1.55, 0.82, 0.82)
            bolt.material_override = RetroMaterials.make(
                Color("#6f130d"), Color("#1a0202"), Color("#ff8e61"), 0.05, 0.42,
                Color("#ff351f"), 3.6
            )
            visual_root.add_child(bolt)

    var light := OmniLight3D.new()
    light.light_color = Color("#ffd05a") if team == &"player" else Color("#ff3c25")
    light.light_energy = 0.65 if attack_kind != &"enemy_bolt" else 1.25
    light.omni_range = 2.2
    light.shadow_enabled = false
    visual_root.add_child(light)
