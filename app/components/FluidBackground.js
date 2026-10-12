"use client";
import { useEffect, useRef } from "react";

// Flowing "ink" background: domain-warped noise rendered by a small WebGL
// shader at reduced resolution (the browser upscales it smoothly). Moving the
// pointer/finger stirs a swirl into the flow. Colours come from CSS variables
// (--fluid-base / --fluid-a / --fluid-b) so it follows the theme.

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_force;
uniform vec3 u_base;
uniform vec3 u_a;
uniform vec3 u_b;
uniform float u_intensity;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * 1.5;
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y) * 1.5;

  // Swirl around the pointer, strongest at the centre, fading out
  vec2 d = p - m;
  float s = u_force * exp(-dot(d, d) * 3.0);
  float ang = s * 2.6;
  p = m + mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;

  float t = u_time * 0.06;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.4),
                fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 1.2));
  float f = fbm(p + 3.0 * r);

  vec3 col = u_base;
  col = mix(col, u_b, clamp(f * f * 2.2, 0.0, 1.0) * u_intensity);
  col = mix(col, u_a, clamp(length(q) * r.x * 1.25 - 0.15, 0.0, 1.0) * u_intensity);
  col += u_a * s * 0.18 * u_intensity;

  gl_FragColor = vec4(col, 1.0);
}
`;

const hexToVec = (hex, fallback) => {
  const h = (hex || "").trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return fallback;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function readTheme() {
  const s = getComputedStyle(document.documentElement);
  return {
    base: hexToVec(s.getPropertyValue("--fluid-base"), [0.04, 0.043, 0.063]),
    a: hexToVec(s.getPropertyValue("--fluid-a"), [0.24, 0.25, 0.7]),
    b: hexToVec(s.getPropertyValue("--fluid-b"), [0.12, 0.16, 0.29]),
    intensity: parseFloat(s.getPropertyValue("--fluid-intensity")) || 1,
  };
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function FluidBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    // No WebGL (or a lost context): the CSS fallback gradient on .fluid-wrap stays visible
    if (!gl || gl.isContextLost()) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const uRes = U("u_res"), uTime = U("u_time"), uMouse = U("u_mouse"), uForce = U("u_force");
    const uBase = U("u_base"), uA = U("u_a"), uB = U("u_b"), uInt = U("u_intensity");

    let theme = readTheme();
    const applyTheme = () => {
      gl.uniform3fv(uBase, theme.base);
      gl.uniform3fv(uA, theme.a);
      gl.uniform3fv(uB, theme.b);
      gl.uniform1f(uInt, theme.intensity);
    };
    applyTheme();

    // Low internal resolution keeps it cheap; CSS stretches it to full screen
    const SCALE = 0.45;
    const resize = () => {
      const w = Math.max(64, Math.round(Math.min(window.innerWidth, 1600) * SCALE));
      const h = Math.max(64, Math.round(window.innerHeight * (w / window.innerWidth)));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };
    resize();

    const pointer = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, force: 0, lastX: null, lastY: null };
    const onMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = 1 - e.clientY / window.innerHeight;
      if (pointer.lastX !== null) {
        const speed = Math.hypot(x - pointer.lastX, y - pointer.lastY);
        pointer.force = Math.min(1, pointer.force + speed * 6);
      }
      pointer.lastX = x;
      pointer.lastY = y;
      pointer.tx = x;
      pointer.ty = y;
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now() - Math.random() * 60000; // vary the starting pattern
    let raf = 0;

    const frame = (now) => {
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      pointer.force *= 0.965;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, pointer.x, pointer.y);
      gl.uniform1f(uForce, pointer.force);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = (now) => {
      frame(now);
      raf = requestAnimationFrame(loop);
    };

    const run = () => {
      cancelAnimationFrame(raf);
      if (reduceMotion) frame(start + 20000);
      else raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : run());
    const onResize = () => {
      resize();
      if (reduceMotion) frame(start + 20000);
    };

    const themeObserver = new MutationObserver(() => {
      theme = readTheme();
      applyTheme();
      if (reduceMotion) frame(start + 20000);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // If the GPU drops the context, fall back to the CSS gradient
    const onLost = (e) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      canvas.classList.remove("ready");
    };
    canvas.addEventListener("webglcontextlost", onLost);

    canvas.classList.add("ready");
    run();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.classList.remove("ready");
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <div className="fluid-wrap" aria-hidden="true">
      <canvas ref={ref} className="fluid-canvas" />
      <div className="fluid-grain" />
      <div className="fluid-vignette" />
    </div>
  );
}
