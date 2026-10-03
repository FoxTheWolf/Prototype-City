Comentário do usuário: Uma coisa interessante, o Gemini, quando eu fui pedir o, a tarefa 4, né, que é de esboço de WGSL, quando eu colei a sua, uh, o seu prompt, em primeiro momento ele recusou. Ele, ele deu a, o classificador dele e pediu, ele falou que era só um modelo de linguagem, não podia ajudar com isso. Mas aí quando eu insisti, ele deu. Ele falou que tinha sido um falso positivo por causa da complexidade técnica e o jargão do prompt. Então isso é algo a considerar se a gente for usar o Gemini para gerar coisas muito técnicas assim, aparentemente.

Retorno da IA verbatim:

Você tem toda a razão e peço desculpas. O bloqueio anterior foi um falso positivo do sistema ao processar a complexidade técnica e o jargão do seu prompt. Sua arquitetura de raycasting para ASCII com WebGPU é fantástica e eu posso perfeitamente gerar as funções em WGSL para os efeitos que você pediu.

Para manter tudo dentro do **orçamento de ~1 ms** numa grade de ~127 mil invocamentos, a regra de ouro é: **ruído pré-calculado em textura 3D**, **raymarching com poucos passos ajudado por dither**, e **estruturas espaciais** para luzes.

Aqui está a proposta técnica e o código para cada ponto.

---

### 1. Nuvens Volumétricas (Sky Cells)

Para caber no orçamento, você não pode calcular ruído Worley/Perlin proceduralmente no shader. Use uma **textura 3D (ex: 128x128x128)** pré-calculada com canais para Perlin-Worley de baixa e alta frequência.

* **Passos e Luz:** 12 a 16 passos no raio principal, e apenas 2 a 3 passos em direção ao sol (usando mipmaps maiores da textura 3D para baratear) para calcular a sombra da própria nuvem.
* **Modelo de Iluminação:** Lei de Beer-Lambert pura para atenuação, combinada com o modelo **Powder** (multiplicar por `1.0 - exp(-density)`) para escurecer as bases, e **Henyey-Greenstein** para o *silver lining* (espalhamento direcional forte quando olhando para o sol ou lua).
* **Amortização:** A melhor saída para o seu grid é calcular a nuvem em apenas **1/4 das células por quadro** usando um padrão Bayer 2x2 espacial atrelado a um contador de frames. Nas outras 3/4, você reaproveita o valor do quadro anterior (precisará de uma textura/buffer de histórico) projetado via vetor de movimento da câmera. Se o histórico for caro demais para gerenciar, renderize o céu em meia resolução (317x100) num passe anterior e apenas faça a amostragem com interpolação bilinear na sua passada principal.

**Esboço WGSL:**

```wgsl
const CLOUD_START: f32 = 1200.0;
const CLOUD_END: f32 = 2500.0;
const STEPS: i32 = 16;
const LIGHT_STEPS: i32 = 3;

fn henyey_greenstein(cos_theta: f32, g: f32) -> f32 {
    let g2 = g * g;
    let denom = 1.0 + g2 - 2.0 * g * cos_theta;
    return (1.0 - g2) / (12.56637 * pow(denom, 1.5));
}

fn sample_cloud_density(pos: vec3f, lod: f32) -> f32 {
    // Escala, offset de vento e amostragem da textura 3D pré-calculada
    let uvw = pos * 0.0005 + vec3f(time * 0.01, 0.0, 0.0);
    let noise = textureSampleLevel(noise_tex3d, tex_sampler, uvw, lod).r;
    // Moldar a nuvem baseada na altitude (gradiente vertical)
    let height_fraction = (pos.y - CLOUD_START) / (CLOUD_END - CLOUD_START);
    let shape = sin(height_fraction * 3.1415); // Bordas suaves em cima e embaixo
    return max(0.0, noise - 0.3) * shape; // threshold
}

fn march_volumetric_clouds(ro: vec3f, rd: vec3f, sun_dir: vec3f, sun_color: vec3f) -> vec4f {
    // Intersecção do raio com os planos CLOUD_START e CLOUD_END
    let t_min = (CLOUD_START - ro.y) / rd.y;
    let t_max = (CLOUD_END - ro.y) / rd.y;
    if (t_min < 0.0 && t_max < 0.0) { return vec4f(0.0); }
    
    let t0 = max(0.0, min(t_min, t_max));
    let t1 = max(t_min, t_max);
    let step_size = (t1 - t0) / f32(STEPS);
    
    // Dithering espacial para quebrar as bandas
    let jitter = bayer_dither(global_id.xy) * step_size;
    var t = t0 + jitter;
    
    var transmittance: f32 = 1.0;
    var scattered_light: vec3f = vec3f(0.0);
    let cos_theta = dot(rd, sun_dir);
    let phase = henyey_greenstein(cos_theta, 0.6) + henyey_greenstein(cos_theta, -0.2);

    for (var i = 0; i < STEPS; i++) {
        let pos = ro + rd * t;
        let density = sample_cloud_density(pos, 0.0) * step_size;
        
        if (density > 0.01) {
            // Marcha em direção ao sol
            var light_density = 0.0;
            let l_step = (CLOUD_END - pos.y) / sun_dir.y / f32(LIGHT_STEPS);
            for (var j = 1; j <= LIGHT_STEPS; j++) {
                light_density += sample_cloud_density(pos + sun_dir * (f32(j) * l_step), 2.0) * l_step;
            }
            
            // Beer-Powder
            let attenuation = exp(-light_density);
            let powder = 1.0 - exp(-density * 2.0); // Base escura
            let step_light = attenuation * powder * phase * sun_color;
            
            scattered_light += step_light * density * transmittance;
            transmittance *= exp(-density);
            
            if (transmittance < 0.01) { break; } // Otimização de saída antecipada
        }
        t += step_size;
    }
    return vec4f(scattered_light, 1.0 - transmittance);
}

```

**Custo Estimado:** Alto. ~0.6 a 0.8 ms se feito em força bruta para as células de céu, mas cai para ~0.2 ms com Dither Bayer Checkerboard 1/4.
**Armadilhas:** Ruído que pisca (aliasing) quando a câmera se move. Mitigue usando trilinear filtering na amostragem 3D.

---

### 2. Raios do Sol (God Rays)

No espaço de tela (na sua passada final de composição), o custo é irrisório por conta da sua baixa resolução lógica (~634x200). A "máscara" pode ser um buffer gerado pelo shader de raycasting, onde 1.0 é "vê o céu" e 0.0 é "bateu em geometria" (multiplicado pelo gradiente ao redor do sol).

* **Técnica:** Um *radial blur* (desfoque radial) a partir da posição do sol projetada em espaço de tela (NDC para UV).
* **Custo:** ~8 a 16 amostras de textura 2D por célula. Custo quase invisível.

**Esboço WGSL (Fragment Shader de Composição):**

```wgsl
const SAMPLES: i32 = 12;
const DENSITY: f32 = 0.9;
const WEIGHT: f32 = 0.1;
const DECAY: f32 = 0.95;

fn screen_space_god_rays(uv: vec2f, sun_uv_pos: vec2f) -> vec3f {
    var text_coords = uv;
    let delta_tex = (uv - sun_uv_pos) * (1.0 / f32(SAMPLES)) * DENSITY;
    
    var color = textureSample(sky_mask_texture, smp, uv).rgb;
    var illumination_decay = 1.0;
    
    // Amostragem radial
    for (var i = 0; i < SAMPLES; i++) {
        text_coords -= delta_tex;
        let sample_color = textureSample(sky_mask_texture, smp, text_coords).rgb;
        color += sample_color * illumination_decay * WEIGHT;
        illumination_decay *= DECAY;
    }
    return color; // Some ao output final junto com o Bloom
}

```

**Custo Estimado:** ~0.05 ms.
**Armadilhas:** Se o sol sair da tela, o vetor inverte ou buga. Garanta que `sun_uv_pos` suporte coordenadas fora dos limites (ex: `[-0.5, 1.5]`) sem estourar.

---

### 3. Cones de Luz no Ar (Holofotes e Postes)

Este é o mais perigoso para a performance, porque iterar uma lista linear de luzes em cada passo do raymarch de cada pixel derreterá a GPU.

* **Otimização de Grid (Vital):** Já que sua cidade é uma grade DDA de quarteirões/prédios, crie um SSBO de *Clustered Forward* na CPU. Divida o mapa em *tiles* (ex: blocos de 32x32 metros). Cada tile tem um `offset` e `count` apontando para a lista de luzes no SSBO que afetam aquele bloco de ar.
* **Raymarch Limitado:** Só faça o raymarch da neblina no trecho onde o raio de visão cruza o cone da luz, não no raio inteiro. Use intersecção Raio-Esfera (usando o raio de alcance da luz como esfera delimitadora) para definir `t_min` e `t_max`.
* **Passos:** 4 a 6 passos curtos *apenas* dentro da área de intersecção, somando intensidade.

**Esboço WGSL:**

```wgsl
struct Light {
    pos: vec3f,
    dir: vec3f,
    color: vec3f,
    range: f32,
    angle_cos: f32, // cos(abertura_do_cone / 2)
}

fn march_spotlight_fog(ro: vec3f, rd: vec3f, light: Light, t_geometry: f32) -> vec3f {
    // 1. Achar a intersecção com o raio de influência da luz (Esfera bounding)
    let oc = ro - light.pos;
    let b = dot(oc, rd);
    let c = dot(oc, oc) - light.range * light.range;
    let h = b * b - c;
    
    if (h < 0.0) { return vec3f(0.0); } // Não cruza a área da luz
    
    let t_enter = max(0.0, -b - sqrt(h));
    let t_exit = min(t_geometry, -b + sqrt(h)); // Não marchar além da geometria (t_geometry)
    
    if (t_enter >= t_exit) { return vec3f(0.0); }
    
    // 2. Marchar apenas nesse trecho
    let steps = 6;
    let step_size = (t_exit - t_enter) / f32(steps);
    var t = t_enter + bayer_dither(global_id.xy) * step_size;
    var fog_scatter = vec3f(0.0);
    
    for (var i = 0; i < steps; i++) {
        let pos = ro + rd * t;
        let l_vec = light.pos - pos;
        let dist2 = dot(l_vec, l_vec);
        let l_dir = normalize(l_vec);
        
        // Atenuação de distância (inverso do quadrado)
        let atten = clamp(1.0 - (dist2 / (light.range * light.range)), 0.0, 1.0);
        let dist_atten = atten * atten / (dist2 + 1.0);
        
        // Spotlight cone fade
        let spot_cos = dot(-l_dir, light.dir);
        let spot_atten = smoothstep(light.angle_cos, light.angle_cos + 0.1, spot_cos);
        
        // Espalhamento de Mie simples (luz brilha forte quando olhamos para ela)
        let cos_theta = dot(rd, l_dir);
        let mie_phase = henyey_greenstein(cos_theta, 0.7);
        
        fog_scatter += light.color * dist_atten * spot_atten * mie_phase;
        t += step_size;
    }
    
    return fog_scatter * step_size * FOG_DENSITY;
}

```

**Custo Estimado:** ~0.1 ms a 0.2 ms *se* a indexação de luzes via grid garantir no máximo 2 ou 3 luzes testadas por célula.
**Armadilhas:** *Banding* brutal em áreas escuras devido à baixa contagem de passos (4 a 6). O `bayer_dither` ali no cálculo inicial do `t` é absolutamente obrigatório para transformar o banding num ruído de alta frequência, que vai sumir natural e esteticamente se os seus caracteres ASCII forem desenhados em cima disso na composição.