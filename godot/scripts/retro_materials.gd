extends RefCounted
class_name RetroMaterials

const TOON_SHADER = preload("res://shaders/retro_toon.gdshader")


static func make(
    base: Color,
    shadow: Color = Color(0.02, 0.06, 0.08, 1.0),
    highlight: Color = Color(0.75, 0.90, 0.94, 1.0),
    metallic: float = 0.15,
    roughness: float = 0.88,
    emission: Color = Color(0.0, 0.0, 0.0, 1.0),
    emission_energy: float = 0.0,
    detail: Color = Color(0.04, 0.12, 0.15, 1.0),
    detail_scale: Vector2 = Vector2.ZERO,
    detail_strength: float = 0.0,
    surface_noise: float = 0.0,
) -> ShaderMaterial:
    var material := ShaderMaterial.new()
    material.shader = TOON_SHADER
    material.set_shader_parameter("base_color", base)
    material.set_shader_parameter("shadow_tint", shadow)
    material.set_shader_parameter("highlight_tint", highlight)
    material.set_shader_parameter("metallic_value", metallic)
    material.set_shader_parameter("roughness_value", roughness)
    material.set_shader_parameter("emission_color", emission)
    material.set_shader_parameter("emission_energy", emission_energy)
    material.set_shader_parameter("detail_color", detail)
    material.set_shader_parameter("detail_scale", detail_scale)
    material.set_shader_parameter("detail_strength", detail_strength)
    material.set_shader_parameter("surface_noise", surface_noise)
    return material
