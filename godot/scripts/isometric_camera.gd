extends Camera3D

@export_node_path("Node3D") var target_path: NodePath
@export var offset: Vector3 = Vector3(10.5, 8.5, 13.0)
@export var orthographic_size: float = 11.5
@export var follow_speed: float = 7.5
@export var look_ahead_seconds: float = 0.32
@export var vertical_offset: float = 1.1
@export var pixel_snap: float = 1.0 / 48.0

var target: Node3D
var focus: Vector3


func _ready() -> void:
    projection = Camera3D.PROJECTION_ORTHOGONAL
    size = orthographic_size
    current = true
    target = get_node_or_null(target_path) as Node3D

    if target != null:
        focus = target.global_position + Vector3.UP * vertical_offset
        global_position = focus + offset
        look_at(focus, Vector3.UP)


func _process(delta: float) -> void:
    if target == null:
        return

    var look_ahead := Vector3.ZERO
    var body := target as CharacterBody3D
    if body != null:
        look_ahead = Vector3(body.velocity.x, 0.0, body.velocity.z) * look_ahead_seconds
        look_ahead = look_ahead.limit_length(2.2)

    var desired_focus := target.global_position + Vector3.UP * vertical_offset + look_ahead
    var blend := 1.0 - exp(-follow_speed * delta)
    focus = focus.lerp(desired_focus, blend)

    if pixel_snap > 0.0:
        focus.x = snappedf(focus.x, pixel_snap)
        focus.y = snappedf(focus.y, pixel_snap)
        focus.z = snappedf(focus.z, pixel_snap)

    global_position = focus + offset
    look_at(focus, Vector3.UP)
