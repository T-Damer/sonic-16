extends Node3D
class_name SatamPlayerVisual

var rig_root: Node3D
var ball_root: Node3D
var burst_root: Node3D
var body_root: Node3D
var head_root: Node3D
var arm_left: Node3D
var arm_right: Node3D
var leg_left: Node3D
var leg_right: Node3D
var elapsed: float = 0.0
var facing: float = 1.0


func _ready() -> void:
    _build_character()


func set_motion(
    state: StringName,
    speed: float,
    facing_direction: float,
    depth_speed: float,
    delta: float,
) -> void:
    elapsed += delta
    if absf(facing_direction) > 0.01:
        facing = signf(facing_direction)

    var blend := minf(1.0, delta * 14.0)
    var is_buzzsaw := state == &"buzzsaw"
    rig_root.visible = not is_buzzsaw
    ball_root.visible = is_buzzsaw
    burst_root.visible = state == &"spike_blast"

    rig_root.rotation.y = lerp_angle(rig_root.rotation.y, 0.0 if facing > 0.0 else PI, blend)
    rig_root.rotation.x = lerp_angle(rig_root.rotation.x, clampf(depth_speed * 0.035, -0.10, 0.10), blend)

    var body_tilt := 0.0
    var body_bob := 0.0
    var arm_left_angle := 0.10
    var arm_right_angle := -0.10
    var leg_left_angle := 0.0
    var leg_right_angle := 0.0
    var head_tilt := 0.0
    var target_scale := Vector3.ONE

    match state:
        &"run":
            var phase := elapsed * (7.0 + speed * 1.55)
            var stride := sin(phase) * clampf(speed / 5.0, 0.25, 1.0)
            body_tilt = -0.16
            body_bob = absf(sin(phase * 2.0)) * 0.035
            arm_left_angle = stride * 0.78
            arm_right_angle = -stride * 0.78
            leg_left_angle = -stride * 0.66
            leg_right_angle = stride * 0.66
            head_tilt = sin(phase * 2.0) * 0.025
        &"jump":
            body_tilt = -0.10
            body_bob = 0.05
            arm_left_angle = -1.05
            arm_right_angle = -0.72
            leg_left_angle = 0.72
            leg_right_angle = -0.30
            head_tilt = 0.08
            target_scale = Vector3(0.96, 1.05, 0.96)
        &"spike_blast":
            body_tilt = -0.04
            arm_left_angle = 1.42
            arm_right_angle = -1.42
            leg_left_angle = 0.56
            leg_right_angle = -0.56
            target_scale = Vector3(1.08, 0.94, 1.08)
            burst_root.rotation.z += delta * 12.0
        &"wall_hide":
            body_tilt = 0.04
            arm_left_angle = 0.35
            arm_right_angle = -0.35
            leg_left_angle = 0.08
            leg_right_angle = -0.08
            head_tilt = clampf(facing * 0.10, -0.10, 0.10)
            target_scale = Vector3(1.0, 1.0, 0.62)
        &"ledge_hang":
            arm_left_angle = -2.65
            arm_right_angle = -2.40
            leg_left_angle = 0.18
            leg_right_angle = -0.18
            body_bob = -0.06
        &"hurt":
            body_tilt = 0.38
            arm_left_angle = 1.05
            arm_right_angle = -1.05
            leg_left_angle = -0.72
            leg_right_angle = 0.72
            head_tilt = -0.18
        _:
            body_bob = sin(elapsed * 2.4) * 0.018
            arm_left_angle = 0.08 + sin(elapsed * 2.4) * 0.035
            arm_right_angle = -0.08 - sin(elapsed * 2.4) * 0.035
            head_tilt = sin(elapsed * 1.4) * 0.018

    body_root.position.y = lerpf(body_root.position.y, 0.72 + body_bob, blend)
    body_root.rotation.z = lerp_angle(body_root.rotation.z, body_tilt, blend)
    head_root.rotation.z = lerp_angle(head_root.rotation.z, head_tilt, blend)
    arm_left.rotation.z = lerp_angle(arm_left.rotation.z, arm_left_angle, blend)
    arm_right.rotation.z = lerp_angle(arm_right.rotation.z, arm_right_angle, blend)
    leg_left.rotation.z = lerp_angle(leg_left.rotation.z, leg_left_angle, blend)
    leg_right.rotation.z = lerp_angle(leg_right.rotation.z, leg_right_angle, blend)
    rig_root.scale = rig_root.scale.lerp(target_scale, blend)

    if is_buzzsaw:
        ball_root.position.y = 0.78 + sin(elapsed * 18.0) * 0.02
        ball_root.rotation.z += delta * (24.0 + speed * 2.0)
        ball_root.rotation.y += delta * 4.5


func _build_character() -> void:
    var blue := RetroMaterials.make(
        Color("#2558c7"), Color("#071b56"), Color("#75a8ff"), 0.02, 0.82
    )
    var dark_blue := RetroMaterials.make(
        Color("#102c82"), Color("#03091e"), Color("#4168d7"), 0.04, 0.86
    )
    var skin := RetroMaterials.make(
        Color("#e7a868"), Color("#542f1d"), Color("#ffd7a0"), 0.0, 0.92
    )
    var white := RetroMaterials.make(
        Color("#e8eef0"), Color("#4e5a66"), Color.WHITE, 0.02, 0.72
    )
    var red := RetroMaterials.make(
        Color("#c42d32"), Color("#4b0b12"), Color("#ff7470"), 0.05, 0.76
    )
    var sole := RetroMaterials.make(
        Color("#d8c58e"), Color("#554522"), Color("#fff1b8"), 0.0, 0.92
    )
    var black := RetroMaterials.make(
        Color("#11161c"), Color("#020305"), Color("#68717b"), 0.15, 0.68
    )
    var green := RetroMaterials.make(
        Color("#1d744e"), Color("#042416"), Color("#83e59c"), 0.0, 0.62,
        Color("#1aff7d"), 0.35
    )

    rig_root = Node3D.new()
    rig_root.name = "ArticulatedRig"
    add_child(rig_root)

    body_root = Node3D.new()
    body_root.name = "Body"
    body_root.position = Vector3(0.0, 0.72, 0.0)
    rig_root.add_child(body_root)

    _sphere("Torso", 0.25, Vector3.ZERO, Vector3(0.88, 1.18, 0.82), blue, body_root)
    _sphere("Belly", 0.17, Vector3(0.18, -0.02, 0.0), Vector3(0.58, 1.06, 0.92), skin, body_root)
    _cone("Tail", 0.065, 0.22, Vector3(-0.22, -0.12, 0.0), Vector3(0.0, 0.0, PI * 0.5), blue, body_root)

    head_root = Node3D.new()
    head_root.name = "Head"
    head_root.position = Vector3(0.0, 0.47, 0.0)
    body_root.add_child(head_root)

    _sphere("Skull", 0.36, Vector3.ZERO, Vector3(1.02, 0.96, 0.90), blue, head_root)
    _sphere("EyeMask", 0.19, Vector3(0.27, 0.085, 0.0), Vector3(0.54, 0.96, 1.16), white, head_root)
    _sphere("Muzzle", 0.18, Vector3(0.27, -0.095, 0.0), Vector3(0.74, 0.72, 1.03), skin, head_root)
    _sphere("Nose", 0.065, Vector3(0.43, -0.05, 0.0), Vector3(1.18, 0.74, 0.82), black, head_root)
    _sphere("PupilLeft", 0.045, Vector3(0.405, 0.105, -0.072), Vector3(0.45, 1.18, 0.72), green, head_root)
    _sphere("PupilRight", 0.045, Vector3(0.405, 0.105, 0.072), Vector3(0.45, 1.18, 0.72), green, head_root)

    _cone("QuillTop", 0.105, 0.54, Vector3(-0.31, 0.17, 0.0), Vector3(0.0, 0.0, PI * 0.5), dark_blue, head_root)
    _cone("QuillMid", 0.12, 0.60, Vector3(-0.34, -0.015, 0.0), Vector3(0.0, 0.0, PI * 0.5), blue, head_root)
    _cone("QuillLow", 0.105, 0.48, Vector3(-0.28, -0.19, 0.0), Vector3(0.0, 0.0, PI * 0.5), dark_blue, head_root)
    _cone("QuillSideA", 0.075, 0.39, Vector3(-0.25, 0.05, -0.18), Vector3(0.0, -0.30, PI * 0.5), blue, head_root)
    _cone("QuillSideB", 0.075, 0.39, Vector3(-0.25, 0.05, 0.18), Vector3(0.0, 0.30, PI * 0.5), blue, head_root)
    _cone("EarLeft", 0.075, 0.20, Vector3(-0.02, 0.32, -0.18), Vector3.ZERO, blue, head_root)
    _cone("EarRight", 0.075, 0.20, Vector3(-0.02, 0.32, 0.18), Vector3.ZERO, blue, head_root)

    arm_left = _limb("ArmLeft", Vector3(0.0, 0.15, -0.25), blue, white, body_root)
    arm_right = _limb("ArmRight", Vector3(0.0, 0.15, 0.25), blue, white, body_root)
    leg_left = _leg("LegLeft", Vector3(-0.015, -0.20, -0.115), blue, red, white, sole, body_root)
    leg_right = _leg("LegRight", Vector3(-0.015, -0.20, 0.115), blue, red, white, sole, body_root)

    ball_root = Node3D.new()
    ball_root.name = "BuzzsawForm"
    ball_root.position = Vector3(0.0, 0.78, 0.0)
    ball_root.visible = false
    add_child(ball_root)
    _sphere("BuzzsawCore", 0.37, Vector3.ZERO, Vector3(1.0, 1.0, 0.62), dark_blue, ball_root)
    for index in range(12):
        var angle := float(index) / 12.0 * TAU
        var point := Vector3(cos(angle) * 0.42, sin(angle) * 0.42, 0.0)
        _cone(
            "BuzzTooth%d" % index,
            0.065,
            0.22,
            point,
            Vector3(0.0, 0.0, -angle),
            blue,
            ball_root,
        )

    burst_root = Node3D.new()
    burst_root.name = "SpikeBlastQuills"
    burst_root.position = Vector3(0.0, 0.02, 0.0)
    burst_root.visible = false
    body_root.add_child(burst_root)
    for index in range(8):
        var angle := float(index) / 8.0 * TAU
        var point := Vector3(cos(angle) * 0.32, sin(angle) * 0.32, 0.0)
        _cone(
            "BurstQuill%d" % index,
            0.055,
            0.34,
            point,
            Vector3(0.0, 0.0, -angle),
            white if index % 2 == 0 else blue,
            burst_root,
        )


func _limb(
    node_name: String,
    anchor: Vector3,
    limb_material: Material,
    glove_material: Material,
    parent: Node3D,
) -> Node3D:
    var pivot := Node3D.new()
    pivot.name = node_name
    pivot.position = anchor
    parent.add_child(pivot)
    _cylinder("Arm", 0.048, 0.30, Vector3(0.0, -0.15, 0.0), Vector3.ZERO, limb_material, pivot)
    _cylinder("Cuff", 0.072, 0.07, Vector3(0.0, -0.30, 0.0), Vector3.ZERO, glove_material, pivot)
    _sphere("Glove", 0.105, Vector3(0.0, -0.37, 0.0), Vector3(1.0, 0.88, 1.0), glove_material, pivot)
    return pivot


func _leg(
    node_name: String,
    anchor: Vector3,
    limb_material: Material,
    shoe_material: Material,
    stripe_material: Material,
    sole_material: Material,
    parent: Node3D,
) -> Node3D:
    var pivot := Node3D.new()
    pivot.name = node_name
    pivot.position = anchor
    parent.add_child(pivot)
    _cylinder("Leg", 0.052, 0.29, Vector3(0.0, -0.145, 0.0), Vector3.ZERO, limb_material, pivot)
    _cylinder("Sock", 0.075, 0.07, Vector3(0.0, -0.29, 0.0), Vector3.ZERO, stripe_material, pivot)
    _box("Shoe", Vector3(0.12, -0.36, 0.0), Vector3(0.38, 0.15, 0.19), shoe_material, pivot)
    _box("Stripe", Vector3(0.12, -0.31, 0.0), Vector3(0.10, 0.05, 0.205), stripe_material, pivot)
    _box("Sole", Vector3(0.12, -0.45, 0.0), Vector3(0.40, 0.055, 0.20), sole_material, pivot)
    return pivot


func _sphere(
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
    mesh.radial_segments = 12
    mesh.rings = 6
    var instance := _mesh_instance(node_name, mesh, material, parent)
    instance.position = local_position
    instance.scale = local_scale
    return instance


func _cylinder(
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
    var instance := _mesh_instance(node_name, mesh, material, parent)
    instance.position = local_position
    instance.rotation = local_rotation
    return instance


func _cone(
    node_name: String,
    radius: float,
    height: float,
    local_position: Vector3,
    local_rotation: Vector3,
    material: Material,
    parent: Node3D,
) -> MeshInstance3D:
    var mesh := CylinderMesh.new()
    mesh.top_radius = 0.0
    mesh.bottom_radius = radius
    mesh.height = height
    mesh.radial_segments = 6
    var instance := _mesh_instance(node_name, mesh, material, parent)
    instance.position = local_position
    instance.rotation = local_rotation
    return instance


func _box(
    node_name: String,
    local_position: Vector3,
    size: Vector3,
    material: Material,
    parent: Node3D,
) -> MeshInstance3D:
    var mesh := BoxMesh.new()
    mesh.size = size
    var instance := _mesh_instance(node_name, mesh, material, parent)
    instance.position = local_position
    return instance


func _mesh_instance(
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
