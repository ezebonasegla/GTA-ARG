// Sky, sun, fog and the day/night cycle (sun path for Quilmes' latitude, ~34.7°S).
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;

    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b5a45, 0.8);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -110;
    sc.right = sc.top = 110;
    sc.near = 10;
    sc.far = 700;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);

    scene.fog = new THREE.Fog(0xc9d6e2, 200, 1100);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 1500; i++) {
      const v = new THREE.Vector3().randomDirection();
      if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05;
      pts.push(...v.normalize().multiplyScalar(1000).toArray());
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    scene.add(this.stars);
    this.night = 0;
  }

  // hours: 0..24. focus: point the shadow camera follows.
  update(hours, focus) {
    // Simple solar model: sunrise ~6:30, sunset ~19:30, sun passes to the north.
    const dayFrac = (hours - 6.5) / 13; // 0 at sunrise, 1 at sunset
    const elev = Math.sin(Math.PI * dayFrac) * 72; // max elevation ~72° at noon (summer-ish)
    const az = THREE.MathUtils.lerp(100, -100, dayFrac); // east -> north -> west
    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(az);
    // World axes: +x east, -z north; azimuth 0 = north (the sun crosses the northern sky here).
    const sunDir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(phi), -Math.cos(theta) * Math.sin(phi));
    this.sky.material.uniforms.sunPosition.value.copy(sunDir);

    const day = THREE.MathUtils.smoothstep(elev, -6, 8);
    this.night = 1 - day;
    const golden = THREE.MathUtils.smoothstep(elev, 0, 20);
    this.sun.intensity = 2.8 * THREE.MathUtils.smoothstep(elev, -2, 10);
    this.sun.color.setHSL(0.09 + golden * 0.04, 0.8 - golden * 0.5, 0.6 + golden * 0.3);
    this.hemi.intensity = 0.55 + 0.35 * day;
    this.hemi.color.setHSL(0.6, 0.5 - 0.1 * day, 0.35 + 0.45 * day);
    this.hemi.groundColor.setHSL(0.08, 0.3, 0.12 + 0.2 * day);
    this.renderer.toneMappingExposure = 0.75 + 0.1 * day;
    const fogDay = new THREE.Color(0xc9d6e2), fogGold = new THREE.Color(0xe0b98f), fogNight = new THREE.Color(0x0c1220);
    const fog = fogNight.clone().lerp(fogGold, day).lerp(fogDay, golden);
    this.scene.fog.color.copy(fog);
    this.starMat.opacity = this.night;
    this.stars.position.set(focus.x, 0, focus.z);

    const lightDir = elev > 0 ? sunDir : new THREE.Vector3(0.3, 0.8, 0.2).normalize(); // moonlight
    if (elev <= 0) {
      this.sun.intensity = 0.25;
      this.sun.color.set(0x8fa6ff);
    }
    // snap to texel grid to avoid shimmering
    const snap = 4;
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.position.set(fx + lightDir.x * 300, lightDir.y * 300, fz + lightDir.z * 300);
    this.sun.target.position.set(fx, 0, fz);
    return this.night;
  }
}
