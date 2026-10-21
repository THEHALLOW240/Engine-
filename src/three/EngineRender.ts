// ── EngineRender.ts: procedural 3D engine cutaway (Three.js) ────────────────
// Builds a live animated engine from an EngineSpec: pistons, rods, crank,
// valvetrain, cam, cooling fan — with solid and neon-wireframe (X-ray) modes.

import * as THREE from 'three';
import { EngineSpec } from '../sim/types';
import { sim } from '../sim/core';

const D2R = Math.PI / 180;

interface CylParts {
  piston: THREE.Group;
  rod: THREE.Mesh;
  intakeValve: THREE.Mesh;
  exhaustValve: THREE.Mesh;
  intakeSpring: THREE.Mesh;
  exhaustSpring: THREE.Mesh;
  intakeLobe: THREE.Mesh;
  exhaustLobe: THREE.Mesh;
  glow: THREE.Mesh;
  x: number;
  bankRot: number; // rotation about X (YZ plane)
}

export class EngineRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private root: THREE.Group | null = null;      // orbit group
  private crank: THREE.Group | null = null;
  private camGroups: THREE.Group[] = [];
  private fan: THREE.Group | null = null;
  private cyls: CylParts[] = [];
  private wire = false;
  private solids: Array<{ obj: THREE.Object3D; mat: THREE.Material }> = [];
  private wireMat = new THREE.MeshBasicMaterial({ color: 0x00ff41, wireframe: true, transparent: true, opacity: 0.6 });
  private wireLineMat = new THREE.LineBasicMaterial({ color: 0x00ff41, transparent: true, opacity: 0.8 });
  private lastFire: number[] = [];
  private camHousing: THREE.Group | null = null;

  // orbit state — start from the front-left corner (fan side visible)
  private theta = 2.2;
  private phi = 1.12;
  private dist = 5;
  private target = new THREE.Vector3(0, 0.1, 0);
  private dragging = false;
  private lastX = 0; private lastY = 0;
  private velTheta = 0;
  public reduceMotion = false;
  private ro: ResizeObserver | null = null;
  private sizeMM = { deckTop: 200, blockW: 300, headH: 80, scale: 0.01 };
  private spec: EngineSpec | null = null;
  private glowMats: THREE.MeshBasicMaterial[] = [];
  private failed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
    } catch (e) {
      this.failed = true;
      return;
    }

    const hemi = new THREE.HemisphereLight(0xdde6ff, 0x14161c, 0.85);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1e0, 1.9);
    key.position.set(4, 6, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7aa2ff, 0.75);
    rim.position.set(-5, 2.5, -4);
    this.scene.add(rim);
    const under = new THREE.PointLight(0xff8c3b, 0.0, 10);
    under.position.set(0, -1, 0.6);
    this.scene.add(under);

    // orbit controls (custom, lightweight)
    const el = canvas;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX; this.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.theta -= dx * 0.008;
      this.velTheta = -dx * 0.008;
      this.phi = THREE.MathUtils.clamp(this.phi - dy * 0.006, 0.45, 1.6);
    });
    const end = () => { this.dragging = false; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = THREE.MathUtils.clamp(this.dist + e.deltaY * 0.004, this.dist * 0.45, this.dist * 2.2);
    }, { passive: false });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  resize() {
    if (!this.renderer) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth, h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── materials ──────────────────────────────────────────────────────────────
  private mat(color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    return new THREE.MeshStandardMaterial({ color, metalness: 0.88, roughness: 0.36, ...o });
  }
  private track(obj: THREE.Object3D, mat: THREE.Material) {
    (obj as THREE.Mesh).userData.solid = mat;
    this.solids.push({ obj, mat });
  }

  // ── build ──────────────────────────────────────────────────────────────────
  build(spec: EngineSpec) {
    if (this.failed) return;
    this.spec = spec;
    if (this.root) { this.scene.remove(this.root); disposeGroup(this.root); }
    this.solids = [];
    this.cyls = [];
    this.camGroups = [];
    this.glowMats = [];
    this.lastFire = Array(spec.cylinders).fill(-10);

    const root = new THREE.Group();
    this.root = root;
    this.scene.add(root);

    const bore = spec.boreMm;
    const stroke = spec.strokeMm;
    const r = spec.crankRadiusM * 1000; // mm
    const l = spec.rodLengthM * 1000;
    const pistonH = bore * 0.52;
    const n = spec.cylinders;
    const isV = spec.layout === 'v';
    const isFlat = spec.layout === 'flat';
    const perRow = isV || isFlat ? Math.ceil(n / 2) : n;
    const spacing = bore * 1.3;
    const blockW = perRow * spacing + bore * 0.5;
    const deckTop = r + l + pistonH * 0.62;
    const headH = bore * 0.9;
    const blockH = deckTop + headH * 0.55 + r * 1.7;
    const depth = bore * 1.6;

    const scale = 2.6 / (blockH + headH);
    this.sizeMM = { deckTop, blockW, headH, scale };

    const mAlu = this.mat(0xd3d6dc, { metalness: 0.9, roughness: 0.3 });
    const mSteel = this.mat(0x848b96, { metalness: 0.92, roughness: 0.4 });
    const mRod = this.mat(0xb8bec9, { metalness: 0.85, roughness: 0.34 });
    const mDark = this.mat(0x4c5159, { metalness: 0.8, roughness: 0.5 });
    const mRing = this.mat(0x35393f, { metalness: 0.7, roughness: 0.5 });

    // ── transparent block + oil pan + head cover ──
    const mBlock = new THREE.MeshStandardMaterial({
      color: 0xa9b4c2, transparent: true, opacity: 0.13, metalness: 0.05,
      roughness: 0.15, depthWrite: false, side: THREE.DoubleSide,
    });
    const blockGeo = new THREE.BoxGeometry(blockW, blockH, depth);
    const block = new THREE.Mesh(blockGeo, mBlock);
    block.position.y = (-r * 1.7 + blockH / 2 - r * 0.1) * 1;
    block.position.y = blockH / 2 - r * 2.15;
    block.renderOrder = 20;
    root.add(block); this.track(block, mBlock);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(blockGeo),
      new THREE.LineBasicMaterial({ color: 0x7d8894, transparent: true, opacity: 0.5 }),
    );
    edges.position.copy(block.position);
    root.add(edges);
    (edges as any).userData.isEdge = true;
    this.solids.push({ obj: edges, mat: edges.material as THREE.Material });

    const panGeo = new THREE.BoxGeometry(blockW * 0.86, r * 1.15, depth * 0.8);
    const pan = new THREE.Mesh(panGeo, mBlock);
    pan.position.y = -r * 1.7 - r * 0.2;
    pan.renderOrder = 20;
    root.add(pan); this.track(pan, mBlock);

    // bores (ghost cylinders)
    const boreEdge = new THREE.LineBasicMaterial({ color: 0x707a86, transparent: true, opacity: 0.35 });
    for (let i = 0; i < n; i++) {
      const { x, bankRot } = this.cylFrame(i, spec, spacing, perRow);
      const boreGeo = new THREE.CylinderGeometry(bore * 0.53, bore * 0.53, deckTop * 0.92, 20, 1, true);
      const bm = new THREE.Mesh(boreGeo, new THREE.MeshStandardMaterial({
        color: 0xc2ccd8, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide,
      }));
      bm.position.set(x, deckTop * 0.5 + pistonH * 0.1, 0);
      bm.rotation.x = bankRot;
      bm.renderOrder = 15;
      root.add(bm); this.track(bm, bm.material);
    }

    // ── crankshaft ──
    const crank = new THREE.Group();
    this.crank = crank;
    root.add(crank);
    const mainGeo = new THREE.CylinderGeometry(bore * 0.17, bore * 0.17, blockW * 1.04, 14);
    mainGeo.rotateZ(Math.PI / 2);
    const main = new THREE.Mesh(mainGeo, mSteel);
    crank.add(main); this.track(main, mSteel);

    for (let i = 0; i < n; i++) {
      const { x, bankRot } = this.cylFrame(i, spec, spacing, perRow);
      const phase = spec.cylPhaseDeg[i % spec.cylPhaseDeg.length] * D2R;
      // crank pin
      const pinGeo = new THREE.CylinderGeometry(bore * 0.13, bore * 0.13, spacing * 0.34, 12);
      pinGeo.rotateZ(Math.PI / 2);
      const pin = new THREE.Mesh(pinGeo, mSteel);
      pin.position.set(x, r * Math.cos(phase), r * Math.sin(phase));
      crank.add(pin); this.track(pin, mSteel);
      // webs
      [-1, 1].forEach((side) => {
        const webGeo = new THREE.BoxGeometry(spacing * 0.12, r * 2.35, bore * 0.55);
        const web = new THREE.Mesh(webGeo, mSteel);
        web.position.set(
          x + side * spacing * 0.2,
          (r / 2) * Math.cos(phase),
          (r / 2) * Math.sin(phase),
        );
        web.rotation.x = phase;
        crank.add(web); this.track(web, mSteel);
      });
      // counterweight opposite throw
      const cwGeo = new THREE.CylinderGeometry(bore * 0.62, bore * 0.62, spacing * 0.22, 18, 1, false, Math.PI, Math.PI);
      cwGeo.rotateZ(Math.PI / 2);
      const cw = new THREE.Mesh(cwGeo, mSteel);
      cw.position.set(x, 0, 0);
      cw.rotation.x = phase + Math.PI / 2;
      crank.add(cw); this.track(cw, mSteel);
    }
    // crank nose pulley
    const pulleyGeo = new THREE.CylinderGeometry(bore * 0.34, bore * 0.34, spacing * 0.5, 18);
    pulleyGeo.rotateZ(Math.PI / 2);
    const pulley = new THREE.Mesh(pulleyGeo, mDark);
    pulley.position.x = -blockW / 2 - spacing * 0.28;
    crank.add(pulley); this.track(pulley, mDark);

    // ── per-cylinder moving parts ──
    for (let i = 0; i < n; i++) {
      const { x, bankRot } = this.cylFrame(i, spec, spacing, perRow);

      // piston group
      const pg = new THREE.Group();
      const pGeo = new THREE.CylinderGeometry(bore * 0.49, bore * 0.49, pistonH, 24);
      const piston = new THREE.Mesh(pGeo, mAlu);
      pg.add(piston); this.track(piston, mAlu);
      for (let rr = 0; rr < 3; rr++) {
        const ringGeo = new THREE.CylinderGeometry(bore * 0.5, bore * 0.5, pistonH * 0.09, 24);
        const ring = new THREE.Mesh(ringGeo, mRing);
        ring.position.y = pistonH * 0.38 - rr * pistonH * 0.16;
        pg.add(ring); this.track(ring, mRing);
      }
      pg.rotation.x = bankRot;
      root.add(pg);

      // connecting rod
      const rodGeo = new THREE.CylinderGeometry(bore * 0.055, bore * 0.085, 1, 10);
      const rod = new THREE.Mesh(rodGeo, mRod);
      // big end cap
      const capGeo = new THREE.CylinderGeometry(bore * 0.16, bore * 0.16, spacing * 0.2, 12);
      capGeo.rotateZ(Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, mRod);
      rod.add(cap); this.track(cap, mRod);
      cap.position.y = -0.5;
      root.add(rod); this.track(rod, mRod);

      // valves + springs + cam lobes (positioned relative to bank axis)
      const mkValve = (mat: THREE.Material) => {
        const g = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(bore * 0.045, bore * 0.045, headH * 0.85, 8), mat);
        stem.position.y = headH * 0.42;
        const tulip = new THREE.Mesh(new THREE.CylinderGeometry(bore * 0.19, bore * 0.26, bore * 0.09, 14), mat);
        g.add(stem); g.add(tulip);
        this.track(stem, mat); this.track(tulip, mat);
        return { group: g, tulip };
      };
      const vIn = mkValve(mAlu);
      const vEx = mkValve(mAlu);
      const mkSpring = () => {
        const s = new THREE.Mesh(
          new THREE.CylinderGeometry(bore * 0.14, bore * 0.14, headH * 0.5, 12),
          new THREE.MeshStandardMaterial({ color: 0x9aa1ad, metalness: 0.85, roughness: 0.45, wireframe: true }),
        );
        return s;
      };
      const sIn = mkSpring();
      const sEx = mkSpring();
      root.add(vIn.group, vEx.group, sIn, sEx);
      this.track(sIn, sIn.material); this.track(sEx, sEx.material);

      // valve placement along bank: stems along bank axis near deck top
      const vDist = deckTop + headH * 0.05;
      const side = isV || isFlat ? 0 : bore * 0.24;
      const place = (
        g: THREE.Object3D, bankRotV: number, offT: number, dist: number,
      ) => {
        const ay = Math.cos(bankRotV) * dist - Math.sin(bankRotV) * offT;
        const az = Math.sin(bankRotV) * dist + Math.cos(bankRotV) * offT;
        g.position.set(x, ay, az);
        g.rotation.x = bankRotV;
      };
      const tangOff = (isV || isFlat ? bore * 0.22 : bore * 0.26);
      place(vIn.group, bankRot, tangOff, vDist);
      place(vEx.group, bankRot, -tangOff, vDist);
      place(sIn as THREE.Object3D, bankRot, tangOff, vDist + headH * 0.22);
      place(sEx as THREE.Object3D, bankRot, -tangOff, vDist + headH * 0.22);

      // cam lobes (small flattened spheres on the cam line)
      const lobeGeo = new THREE.SphereGeometry(bore * 0.13, 10, 8);
      lobeGeo.scale(0.55, 1.35, 0.55);
      const lobIn = new THREE.Mesh(lobeGeo, mSteel);
      const lobEx = new THREE.Mesh(lobeGeo, mSteel);
      const camDist = vDist + headH * 0.62;
      place(lobIn, bankRot, tangOff, camDist);
      place(lobEx, bankRot, -tangOff, camDist);
      root.add(lobIn, lobEx);
      this.track(lobIn, mSteel); this.track(lobEx, mSteel);

      // combustion glow
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a1f, transparent: true, opacity: 0 });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(bore * 0.3, 10, 8), glowMat);
      const gDist = r + l + pistonH * 0.7;
      place(glow, bankRot, 0, gDist);
      glow.renderOrder = 12;
      root.add(glow);
      this.glowMats.push(glowMat);

      this.cyls.push({
        piston: pg, rod,
        intakeValve: vIn.tulip.parent === vIn.group ? vIn.group.children[1] as THREE.Mesh : vIn.group as any,
        exhaustValve: vEx.group.children[1] as THREE.Mesh,
        intakeSpring: sIn, exhaustSpring: sEx,
        intakeLobe: lobIn, exhaustLobe: lobEx,
        glow, x, bankRot,
      });
      // store base positions for per-frame animation
      (pg as any).__base = { x, bankRot, pistonH, r, l };
      (vIn.group as any).__base = { dist: vDist, off: tangOff, x, bankRot };
      (vEx.group as any).__base = { dist: vDist, off: -tangOff, x, bankRot };
      (sIn as any).__base = { dist: vDist + headH * 0.22, off: tangOff, x, bankRot };
      (sEx as any).__base = { dist: vDist + headH * 0.22, off: -tangOff, x, bankRot };
      (lobIn as any).__base = { dist: camDist, off: tangOff, x, bankRot, inValve: true };
      (lobEx as any).__base = { dist: camDist, off: -tangOff, x, bankRot, inValve: false };
    }

    // ── camshafts (visual straight shafts through lobes) ──
    const doCam = (bankRot: number) => {
      const g = new THREE.Group();
      const camDist = deckTop + headH * 0.67;
      const geo = new THREE.CylinderGeometry(bore * 0.09, bore * 0.09, blockW * 0.98, 10);
      geo.rotateZ(Math.PI / 2);
      const shaft = new THREE.Mesh(geo, mDark);
      const ay = Math.cos(bankRot) * camDist;
      const az = Math.sin(bankRot) * camDist;
      g.add(shaft); this.track(shaft, mDark);
      g.position.set(0, ay, az);
      this.camGroups.push(g);
      root.add(g);
    };
    if (isV || isFlat) { doCam(spec.bankAngleDeg / 2 * D2R); doCam(-spec.bankAngleDeg / 2 * D2R); }
    else doCam(0);

    // head cover
    const cover = new THREE.Mesh(new THREE.BoxGeometry(blockW * 1.0, headH * 0.5, depth * 1.02), mBlock);
    cover.position.y = deckTop + headH * 0.92;
    cover.renderOrder = 20;
    root.add(cover); this.track(cover, mBlock);

    // header stubs (small curved pipes out the front side)
    for (let i = 0; i < n; i++) {
      const { x, bankRot } = this.cylFrame(i, spec, spacing, perRow);
      const zOut = (isV || isFlat) ? Math.sign(bankRot) * depth * 0.55 : depth * 0.55;
      const yBase = deckTop * (0.92) * (isV || isFlat ? Math.cos(Math.abs(bankRot)) : 1);
      const p0 = new THREE.Vector3(x, yBase, zOut * 0.55);
      const p1 = new THREE.Vector3(x, yBase + headH * 0.35, zOut);
      const p2 = new THREE.Vector3(x + spacing * 0.3, deckTop + headH * 1.05, zOut);
      const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, bore * 0.13, 8), mSteel);
      root.add(tube); this.track(tube, mSteel);
      // hot tip
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(bore * 0.14, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.0 }),
      );
      tip.position.copy(p0);
      tip.renderOrder = 11;
      root.add(tip);
      this.glowMats.push(tip.material as THREE.MeshBasicMaterial);
    }

    // cooling fan at front nose
    const fan = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(bore * 0.16, bore * 0.16, bore * 0.22, 12), mDark);
    hub.geometry.rotateZ(Math.PI / 2);
    fan.add(hub); this.track(hub, mDark);
    const mFan = new THREE.MeshStandardMaterial({
      color: 0x7fc4d8, transparent: true, opacity: 0.62, metalness: 0.2,
      roughness: 0.25, side: THREE.DoubleSide, depthWrite: false,
    });
    const bladeGeo = new THREE.BoxGeometry(bore * 0.06, bore * 0.9, bore * 0.34);
    bladeGeo.translate(0, bore * 0.52, 0);
    for (let b = 0; b < 6; b++) {
      const blade = new THREE.Mesh(bladeGeo, mFan);
      blade.rotation.x = (b / 6) * Math.PI * 2;
      blade.rotation.y = 0.5;
      const holder = new THREE.Group();
      holder.rotation.x = (b / 6) * Math.PI * 2;
      const bl = new THREE.Mesh(bladeGeo, mFan);
      bl.rotation.y = 0.55;
      holder.add(bl);
      fan.add(holder); this.track(bl, mFan);
    }
    fan.position.set(-blockW / 2 - spacing * 0.3, -r * 1.15, depth * 0.3);
    root.add(fan);
    this.fan = fan;

    // scale everything
    root.scale.setScalar(scale);
    root.position.y = -(deckTop * 0.42) * scale;

    // camera fit
    this.dist = Math.max(3.6, (blockW * scale) * 1.9);
    this.target.set(0, 0.05, 0);
    this.theta = 2.2;
    this.phi = 1.12;

    this.applyWire();
    this.resize();
  }

  setWireframe(on: boolean) {
    this.wire = on;
    this.applyWire();
  }

  private applyWire() {
    for (const { obj, mat } of this.solids) {
      const m = obj as THREE.Mesh;
      if ((obj as any).type === 'LineSegments') {
        m.material = this.wire ? (this.wireLineMat as any) : (mat as any);
      } else {
        m.material = this.wire ? (this.wireMat as any) : (mat as any);
      }
    }
  }

  private cylFrame(i: number, spec: EngineSpec, spacing: number, perRow: number) {
    const isV = spec.layout === 'v';
    const isFlat = spec.layout === 'flat';
    const pair = isV || isFlat ? Math.floor(i / 2) : i;
    const x = (pair - (perRow - 1) / 2) * spacing;
    let bankRot = 0;
    if (isV) bankRot = (i % 2 === 0 ? 1 : -1) * (spec.bankAngleDeg / 2) * D2R;
    if (isFlat) bankRot = (i % 2 === 0 ? 1 : -1) * (spec.bankAngleDeg / 2) * D2R;
    return { x, bankRot };
  }

  // ── per-frame update ───────────────────────────────────────────────────────
  update(dt: number) {
    if (!this.renderer || !this.root || !this.spec || this.failed) return;
    const spec = this.spec;
    const thetaDeg = sim.crankAngleDeg;
    const shaftRad = thetaDeg * D2R;
    if (this.crank) this.crank.rotation.x = shaftRad;
    const camRad = shaftRad / 2;
    this.camGroups.forEach((g) => { g.rotation.x = camRad; });
    if (this.fan) this.fan.rotation.x = shaftRad * 2.2;

    const r = spec.crankRadiusM * 1000;
    const l = spec.rodLengthM * 1000;

    // consume fire events → timestamps
    for (const f of sim.fires) this.lastFire[f.cyl] = Math.max(this.lastFire[f.cyl] ?? -10, f.time);

    for (let i = 0; i < this.cyls.length; i++) {
      const c = this.cyls[i];
      const phase = spec.cylPhaseDeg[i % spec.cylPhaseDeg.length] * D2R;
      const a = shaftRad + phase;
      const xA = r * Math.sin(a);
      const yA = r * Math.cos(a);
      const pinY = yA + Math.sqrt(Math.max(0.0001, l * l - xA * xA));
      const base = (c.piston as any).__base;

      // bank rotation
      const cosB = Math.cos(c.bankRot), sinB = Math.sin(c.bankRot);
      const py = pinY * cosB;
      const pz = pinY * sinB;
      c.piston.position.set(c.x, py, pz);
      c.piston.rotation.x = c.bankRot;

      // rod: small end at piston pin (py,pz), big end at crank pin rotated to bank plane
      const ey = yA * cosB - xA * sinB;
      const ez = yA * sinB + xA * cosB;
      const mx = c.x, my = (py + ey) / 2, mz = (pz + ez) / 2;
      c.rod.position.set(mx, my, mz);
      const dy = py - ey, dz = pz - ez;
      const len = Math.sqrt(dy * dy + dz * dz);
      c.rod.scale.y = len;
      c.rod.rotation.x = Math.atan2(dz, dy);

      // valve motion from cycle
      const cycle = ((thetaDeg + spec.cylPhaseDeg[i % spec.cylPhaseDeg.length]) % 720 + 720) % 720;
      const liftMax = spec.boreMm * 0.22;
      const inLift = Math.max(0, Math.sin(Math.PI * (cycle - 355) / 210)) * liftMax;
      const exLift = Math.max(0, Math.sin(Math.PI * (cycle - 165) / 210)) * liftMax;

      const placeAlong = (obj: THREE.Object3D, b: any, lift: number) => {
        const d = b.dist - lift;
        obj.position.set(
          b.x,
          Math.cos(b.bankRot) * d - Math.sin(b.bankRot) * b.off,
          Math.sin(b.bankRot) * d + Math.cos(b.bankRot) * b.off,
        );
      };
      const bIn = (c.intakeValve.parent as any).__base;
      const bEx = (c.exhaustValve.parent as any).__base;
      placeAlong(c.intakeValve.parent as THREE.Object3D, bIn, inLift);
      placeAlong(c.exhaustValve.parent as THREE.Object3D, bEx, exLift);
      placeAlong(c.intakeSpring, (c.intakeSpring as any).__base, inLift * 0.55);
      placeAlong(c.exhaustSpring, (c.exhaustSpring as any).__base, exLift * 0.55);
      const scaleS = (s: THREE.Object3D, lift: number) => {
        (s as THREE.Mesh).scale.y = 1 - lift / (this.sizeMM.headH * 0.85);
      };
      scaleS(c.intakeSpring, inLift);
      scaleS(c.exhaustSpring, exLift);
      // lobes spin at cam speed; lobe tip toward valve when opening
      c.intakeLobe.rotation.x = camRad - 0.9;
      c.exhaustLobe.rotation.x = camRad + 0.9;

      // glow
      if (!this.wire) {
        const dtFire = sim.timeSec - (this.lastFire[i] ?? -10);
        const inten = dtFire < 0.5 ? Math.exp(-dtFire * 22) : 0;
        const mat = this.glowMats[i];
        mat.opacity = this.wire ? 0 : inten * 0.85;
        c.glow.scale.setScalar(1 + inten * 0.4);
      } else {
        this.glowMats[i].opacity = 0;
      }
      // header tip heat
      const tipIdx = this.cyls.length + i;
      if (this.glowMats[tipIdx]) {
        this.glowMats[tipIdx].opacity = this.wire ? 0 : Math.min(0.7, sim.rpm / spec.redline) * sim.throttlePos * 0.7;
      }
    }

    // header tips stay green-free in wire mode handled above

    // orbit
    if (!this.dragging) {
      this.theta += this.velTheta;
      this.velTheta *= 0.92;
      if (!this.reduceMotion && sim.rpm < 60) this.theta += dt * 0.1;
    }
    const cx = this.target.x + this.dist * Math.sin(this.phi) * Math.cos(this.theta);
    const cy = this.target.y + this.dist * Math.cos(this.phi) * 0.82;
    const cz = this.target.z + this.dist * Math.sin(this.phi) * Math.sin(this.theta);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.target);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.ro?.disconnect();
    if (this.root) disposeGroup(this.root);
    this.renderer?.dispose();
  }

  get isFailed() { return this.failed; }
}

function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const m = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else if (m) m.dispose();
  });
}
