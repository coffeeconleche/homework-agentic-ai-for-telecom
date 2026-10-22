// Adapted from Rare UI FluidOrb, copyright (c) 2026 Swami Malode.
// https://github.com/swamimalode07/rare-ui/tree/8944172746e8e836aea2061790ee16b0577dd655
// MIT + Commons Clause + Attribution. See ../../../licenses/rare-ui-LICENSE.txt.

import { useEffect, useRef } from 'react'

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.6;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * 0.22;

  vec2 drift = vec2(
    sin(t) + 0.6 * sin(t * 1.7 + 1.3),
    cos(t * 0.8) + 0.6 * cos(t * 1.3 + 2.1)
  );

  vec2 p = vec2(uv.x * 1.8, uv.y * 1.0) + drift * 0.7;

  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(3.2, 1.5) - drift));
  float f = fbm(p + 1.2 * q);

  float g = clamp(1.0 - uv.y, 0.0, 1.0);
  float anchor = smoothstep(0.0, 0.3, uv.y);
  float shade = clamp(g + (f - 0.5) * 0.8 * anchor, 0.0, 1.0);

  vec3 white = vec3(0.99, 1.0, 1.0);
  vec3 light = mix(white, u_color, 0.5);
  vec3 dark = u_color;

  vec3 col = white;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, dark, smoothstep(0.58, 0.88, shade));

  float edge = 1.0 - smoothstep(0.49, 0.5, distance(uv, vec2(0.5)));

  gl_FragColor = vec4(col * edge, edge);
}
`

export default function FluidOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: true })
    if (!gl) return

    function compile(type: number, source: string) {
      const shader = gl!.createShader(type)
      if (!shader) return null
      gl!.shaderSource(shader, source)
      gl!.compileShader(shader)
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        gl!.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertex = compile(gl.VERTEX_SHADER, VERT)
    const fragment = compile(gl.FRAGMENT_SHADER, FRAG)
    const program = gl.createProgram()
    let buffer: WebGLBuffer | null = null
    const dispose = () => {
      if (buffer) gl.deleteBuffer(buffer)
      if (vertex) gl.deleteShader(vertex)
      if (fragment) gl.deleteShader(fragment)
      if (program) gl.deleteProgram(program)
    }
    if (!vertex || !fragment || !program) {
      dispose()
      return
    }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      dispose()
      return
    }
    gl.useProgram(program)
    buffer = gl.createBuffer()
    if (!buffer) {
      dispose()
      return
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const position = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const size = Math.round(176 * Math.min(window.devicePixelRatio || 1, 1.5))
    canvas.width = size
    canvas.height = size
    gl.viewport(0, 0, size, size)
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), size, size)
    gl.uniform3f(gl.getUniformLocation(program, 'u_color'), 0.98, 0.37, 0.17)
    const time = gl.getUniformLocation(program, 'u_time')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const started = performance.now()
    let frame = 0
    let lastPaint = -Infinity
    let onScreen = true

    function render(now: number) {
      if (now - lastPaint >= 33) {
        gl!.uniform1f(time, reducedMotion.matches ? 0 : (now - started) / 1000)
        gl!.drawArrays(gl!.TRIANGLES, 0, 6)
        lastPaint = now
      }
      if (!reducedMotion.matches && !document.hidden && onScreen)
        frame = requestAnimationFrame(render)
    }
    function resume() {
      cancelAnimationFrame(frame)
      lastPaint = -Infinity
      render(performance.now())
    }
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      resume()
    })
    observer.observe(canvas)
    reducedMotion.addEventListener('change', resume)
    document.addEventListener('visibilitychange', resume)
    resume()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      reducedMotion.removeEventListener('change', resume)
      document.removeEventListener('visibilitychange', resume)
      dispose()
    }
  }, [])

  return (
    <div className="fluid-orb" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
