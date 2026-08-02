extends Camera3D

@export_node_path("Node3D") var target_path: NodePath
@export var offset: Vector3 = Vector3(2.6, 3.8, 14.8)
@export var orthographic_size: float = 7.1
@export var follow_speed: float = 8.5
@export var horizontal_look_ahead: float = 0.34
@export var depth_look_ahead: float = 0.10
@export var vertical_offset: float = 1.0
@export var pixel_snap: float = 1.0 / 40.0
@export var min_x: float = -12.0
@export var max_x: float = 52.0
@export var min_y: float = -4.0
@export var max_y: float = 4.5

var target: Node3D
var focus: Vector3


func _ready() -> void:
    projection = Camera3D.PROJECTION_ORTHOGONAL
    size = orthographic_size
    current = true
    target = get_node_or_null(target_path) as Node3D

    if target != null:
        focus = _desired_focus()
        global_position = focus + offset
        look_at(focus, Vector3.UP)


func _process(delta: float) -> void:
    if target == null:
        return

    var desired := _desired_focus()
    var blend := 1.0 - exp(-follow_speed * delta)
    focus = focus.lerp(desired, blend)

    if pixel_snap > 0.0:
        focus.x = snappedf(focus.x, pixel_snap)
        focus.y = snappedf(focus.y, pixel_snap)
        focus.z = snappedf(focus.z, pixel_snap)

    global_position = focus + offset
    look_at(focus, Vector3.UP)


func _desired_focus() -> Vector3:
    var desired := target.global_position + Vector3.UP * vertical_offset
    var body := target as CharacterBody3D
    if body != null:
        desired.x += clampf(body.velocity.x * horizontal_look_ahead, -1.9, 1.9)
        desired.z += clampf(body.velocity.z * depth_look_ahead, -0.35, 0.35)

    if target.has_method("get_camera_bias"):
        desired += target.call("get_camera_bias") as Vector3

    desired.x = clampf(desired.x, min_x, max_x)
    desired.y = clampf(desired.y, min_y, max_y)
    return desired
