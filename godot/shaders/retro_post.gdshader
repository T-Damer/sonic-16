shader_type canvas_item;
render_mode unshaded;

uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_nearest;
uniform float color_levels : hint_range(8.0, 64.0, 1.0) = 28.0;
uniform float dither_strength : hint_range(0.0, 2.0, 0.05) = 0.65;
uniform float saturation : hint_range(0.0, 2.0, 0.05) = 1.14;
uniform float contrast : hint_range(0.5, 1.8, 0.05) = 1.10;
uniform float scanline_strength : hint_range(0.0, 0.15, 0.005) = 0.025;

void fragment() {
    vec4 source = texture(screen_texture, SCREEN_UV);
    vec3 color = source.rgb;

    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, saturation);
    color = (color - 0.5) * contrast + 0.5;

    vec2 pixel = floor(FRAGCOORD.xy);
    float pattern = mod(pixel.x + pixel.y * 2.0, 4.0) / 3.0 - 0.5;
    color += pattern * dither_strength / color_levels;
    color = floor(clamp(color, 0.0, 1.0) * color_levels + 0.5) / color_levels;

    float scanline = mix(1.0, 1.0 - scanline_strength, mod(pixel.y, 2.0));
    COLOR = vec4(color * scanline, source.a);
}
