extends StaticBody3D
class_name BreakableHazard

@export var span: float = 3.8
@export var spike_height: float = 1.35
@export var spike_count: int = 7

var visual_root: Node3D
var destroyed: bool = false


func _ready() -> void:
    collision_layer = 2
    collision_mask = 1
    add_to_group("enemy")
    _build_spike_wall()


func take_hit(
    attack_kind: StringName,
    _direction: Vector3 = Vector3.ZERO,
    _hit_position: Vector3 = Vector3.ZERO,
) -> void:
    if destroyed:
        return

    if attack_kind != &"buzzsaw" and attack_kind != &"spike":
        _ring_deflect()
        return

    destroyed = true
    collision_layer = 0
    collision_mask = 0
    for child in get_children():
        if child is CollisionShape3D:
            child.set_deferred("disabled", true)

    var tween := create_tween().set_parallel(true)
    tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
    tween.tween_property(visual_root, "scale", Vector3(1.35, 0.06, 1.35), 0.22)
    tween.tween_property(visual_root, "rotation:y", visual_root.rotation.y + PI, 0.22)
    tween.chain().tween_callback(queue_free)


func _ring_deflect() -> void:
    if visual_root == null:
        return
    var tween := create_tween()
    tween.tween_property(visual_root, "position:x", -0.05, 0.035)
    tween.tween_property(visual_root, "position:x", 0.05, 0.035)
    tween.tween_property(visual_root, "position:x", 0.0, 0.035)


func _build_spike_wall() -> void:
    visual_root = Node3D.new()
    visual_root.name = "SpikeVisual"
    add_child(visual_root)

    var gold := RetroMaterials.make(
        Color("#c79a26"), Color("#3e2505"), Color("#ffe57a"), 0.58, 0.42
    )
    var steel := RetroMaterials.make(
        Color("#b8cbd2"), Color("#26333b"), Color("#f4ffff"), 0.72, 0.33
    )
    var base_material := RetroMaterials.make(
        Color("#1d4b55"), Color("#07191e"), Color("#75b9c7"), 0.48, 0.58,
        Color.BLACK, 0.0, Color("#0c2b34"), Vector2(4.0, 2.0), 0.55
    )

    var base_mesh := BoxMesh.new()
    base_mesh.size = Vector3(0.52, 0.32, span)
    var base := MeshInstance3D.new()
    base.mesh = base_mesh
    base.position.y = 0.16
    base.material_override = base_material
    base.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    visual_root.add_child(base)

    for index in range(spike_count):
        var t := 0.5 if spike_count == 1 else float(index) / float(spike_count - 1)
        var z := lerpf(-span * 0.44, span * 0.44, t)
        var cone_mesh := CylinderMesh.new()
        cone_mesh.top_radius = 0.0
        cone_mesh.bottom_radius = 0.19
        cone_mesh.height = spike_height
        cone_mesh.radial_segments = 6
        var cone := MeshInstance3D.new()
        cone.mesh = cone_mesh
        cone.position = Vector3(0.0, 0.32 + spike_height * 0.5, z)
        cone.material_override = steel if index % 2 == 0 else gold
        cone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
        visual_root.add_child(cone)

    var collider := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = Vector3(0.62, spike_height + 0.30, span)
    collider.shape = shape
    collider.position.y = (spike_height + 0.30) * 0.5
    add_child(collider)
