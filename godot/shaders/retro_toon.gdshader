shader_type spatial;
render_mode cull_disabled, diffuse_lambert, specular_disabled, depth_draw_opaque;

uniform vec4 base_color : source_color = vec4(0.18, 0.38, 0.45, 1.0);
uniform vec4 shadow_tint : source_color = vec4(0.025, 0.07, 0.10, 1.0);
uniform vec4 highlight_tint : source_color = vec4(0.72, 0.90, 0.94, 1.0);
uniform vec4 emission_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float emission_energy : hint_range(0.0, 8.0, 0.05) = 0.0;
uniform float roughness_value : hint_range(0.0, 1.0, 0.05) = 0.88;
uniform float metallic_value : hint_range(0.0, 1.0, 0.05) = 0.15;
uniform float shade_steps : hint_range(2.0, 6.0, 1.0) = 4.0;
uniform vec4 detail_color : source_color = vec4(0.04, 0.13, 0.16, 1.0);
uniform vec2 detail_scale = vec2(0.0);
uniform float detail_strength : hint_range(0.0, 1.0, 0.05) = 0.0;
uniform float surface_noise : hint_range(0.0, 0.15, 0.005) = 0.0;

float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
}

void fragment() {
    vec3 surface = base_color.rgb;

    if (detail_scale.x > 0.0 && detail_scale.y > 0.0 && detail_strength > 0.0) {
        vec2 tile = fract(UV * detail_scale);
        float seam_x = smoothstep(0.90, 0.98, tile.x);
        float seam_y = smoothstep(0.90, 0.98, tile.y);
        float seam = max(seam_x, seam_y);
        surface = mix(surface, detail_color.rgb, seam * detail_strength);

        float rivet = 1.0 - smoothstep(0.025, 0.075, length(tile - vec2(0.10)));
        surface = mix(surface, highlight_tint.rgb, rivet * detail_strength * 0.36);
    }

    float grain = (hash21(floor(UV * 256.0)) - 0.5) * surface_noise;
    ALBEDO = clamp(surface + vec3(grain), vec3(0.0), vec3(1.0));
    ROUGHNESS = roughness_value;
    METALLIC = metallic_value;
    EMISSION = emission_color.rgb * emission_energy + shadow_tint.rgb * 0.035;
}

void light() {
    float ndl = max(dot(NORMAL, LIGHT), 0.0);
    float band = floor(ndl * shade_steps) / max(shade_steps - 1.0, 1.0);
    band = clamp(band, 0.0, 1.0);
    float light_ramp = mix(0.24, 1.0, band);
    DIFFUSE_LIGHT += light_ramp * ATTENUATION * LIGHT_COLOR;
}
