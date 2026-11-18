import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { createShip, lerp, smooth } from '../common.js';

// SET E · Océano (etapa 05). El barco casi no se mueve: lo que avanza es el agua, el cielo
// (día → noche) y el minimapa del HTML. Shader liviano: 3 ondas sumadas, normal analítica,
// sombreado lambert y fundido al color del cielo en el horizonte. En modo liviano, menos malla.
const DAY = new Color(0x8c8986);
const NIGHT = new Color(0x14161c);
const SEA_DAY = new Color(0x4a5054);
const SEA_NIGHT = new Color(0x15191f);

const vertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vW;
  // onda: dirección, longitud, amplitud, velocidad
  vec3 wave(vec2 p, vec2 dir, float len, float amp, float spd, inout vec3 n) {
    float k = 6.2831 / len;
    float f = k * dot(dir, p) - spd * uTime;
    n.xz -= dir * k * amp * cos(f);
    return vec3(0.0, amp * sin(f), 0.0);
  }
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vec3 n = vec3(0.0, 1.0, 0.0);
    w.xyz += wave(w.xz, normalize(vec2(1.0, 0.3)), 38.0, 0.9, 1.1, n);
    w.xyz += wave(w.xz, normalize(vec2(-0.4, 1.0)), 21.0, 0.45, 1.5, n);
    w.xyz += wave(w.xz, normalize(vec2(0.7, -0.8)), 9.0, 0.16, 2.3, n);
    vN = normalize(n);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSky;
  uniform vec3 uLight;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    float d = max(dot(vN, normalize(uLight)), 0.0);
    vec3 col = uColor * (0.45 + 0.75 * d);
    float far = smoothstep(220.0, 430.0, distance(vW, cameraPosition));
    gl_FragColor = vec4(mix(col, uSky, far), 1.0);
  }
`;

export function buildOcean({ group, mats, lite }) {
  const seg = lite ? 90 : 180;
  const mat = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: SEA_DAY.clone() },
      uSky: { value: DAY.clone() },
      uLight: { value: new Vector3(0.4, 1, 0.3) },
    },
  });
  const sea = new Mesh(new PlaneGeometry(900, 900, seg, seg).rotateX(-Math.PI / 2), mat);
  sea.name = 'oceano';
  sea.frustumCulled = false;
  group.add(sea);

  const ship = createShip(mats, { seed: 21 });
  group.add(ship);
  const sky = new Color();

  return {
    background: sky,
    update(u, time) {
      mat.uniforms.uTime.value = time;
      const night = smooth(5.15, 5.85, u);
      sky.copy(DAY).lerp(NIGHT, night);
      mat.uniforms.uSky.value.copy(sky);
      mat.uniforms.uColor.value.copy(SEA_DAY).lerp(SEA_NIGHT, night);
      ship.position.set(lerp(-30, 20, smooth(5, 6, u)), Math.sin(time * 0.7) * 0.35 - 0.4, 0);
      ship.rotation.set(Math.sin(time * 0.5) * 0.012, 0, Math.sin(time * 0.62) * 0.02);
    },
  };
}
