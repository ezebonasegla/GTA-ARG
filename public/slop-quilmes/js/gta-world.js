import * as e from "three";
import { mergeGeometries as t } from "three/addons/utils/BufferGeometryUtils.js";
//#region src/world/geo.js
function n(e) {
	let t = e >>> 0;
	return function() {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function r(e, t, n) {
	let r = !1;
	for (let i = 0, a = n.length - 1; i < n.length; a = i++) {
		let o = n[i][0], s = n[i][1], c = n[a][0], l = n[a][1];
		s > t != l > t && e < (c - o) * (t - s) / (l - s) + o && (r = !r);
	}
	return r;
}
function i(e, t, n, r, i, a) {
	let o = i - n, s = a - r, c = o * o + s * s, l = c > 0 ? ((e - n) * o + (t - r) * s) / c : 0;
	l = Math.max(0, Math.min(1, l));
	let u = n + o * l, d = r + s * l, f = e - u, p = t - d;
	return [
		u,
		d,
		l,
		f * f + p * p
	];
}
function a(e) {
	let t = Infinity, n = Infinity, r = -Infinity, i = -Infinity;
	for (let [a, o] of e) a < t && (t = a), o < n && (n = o), a > r && (r = a), o > i && (i = o);
	return {
		minX: t,
		minZ: n,
		maxX: r,
		maxZ: i
	};
}
var o = class {
	constructor(e = 32) {
		this.cell = e, this.map = /* @__PURE__ */ new Map();
	}
	key(e, t) {
		return e * 73856093 ^ t * 19349663;
	}
	insert(e, t) {
		let n = this.cell;
		for (let r = Math.floor(t.minX / n); r <= Math.floor(t.maxX / n); r++) for (let i = Math.floor(t.minZ / n); i <= Math.floor(t.maxZ / n); i++) {
			let t = this.key(r, i), n = this.map.get(t);
			n || this.map.set(t, n = []), n.push(e);
		}
	}
	query(e, t, n, r, i = /* @__PURE__ */ new Set()) {
		let a = this.cell;
		for (let o = Math.floor(e / a); o <= Math.floor(n / a); o++) for (let e = Math.floor(t / a); e <= Math.floor(r / a); e++) {
			let t = this.map.get(this.key(o, e));
			if (t) for (let e of t) i.add(e);
		}
		return i;
	}
};
function s(e, t = 0, n = 0) {
	let r = e.hu + t, i = e.hv + n;
	return [
		[-r, -i],
		[r, -i],
		[r, i],
		[-r, i]
	].map(([t, n]) => [e.cx + e.ux * t + e.vx * n, e.cz + e.uz * t + e.vz * n]);
}
//#endregion
//#region src/world/landmarks.js
var c = class n {
	constructor() {
		this.parts = /* @__PURE__ */ new Map();
	}
	add(t, n, r) {
		let i = t.index ? t.toNonIndexed() : t.clone();
		for (let e of Object.keys(i.attributes)) [
			"position",
			"normal",
			"uv"
		].includes(e) || i.deleteAttribute(e);
		i.attributes.uv || i.setAttribute("uv", new e.Float32BufferAttribute(new Float32Array(i.attributes.position.count * 2), 2)), i.applyMatrix4(r), this.parts.has(n) || this.parts.set(n, []), this.parts.get(n).push(i);
	}
	build(r, { cast: i = !0, receive: a = !0, order: o } = {}) {
		let s = (t) => t.isMeshStandardMaterial && !t.map && !t.transparent && t.depthWrite !== !1 && t.side === e.FrontSide && !t.emissive?.getHex() && !t.vertexColors && t.onBeforeCompile === e.Material.prototype.onBeforeCompile, c = [];
		for (let [t, n] of this.parts) if (s(t) && !t.flatShading) {
			for (let r of n) {
				r.deleteAttribute("uv");
				let n = new Float32Array(r.attributes.position.count * 3);
				for (let e = 0; e < n.length; e += 3) n[e] = t.color.r, n[e + 1] = t.color.g, n[e + 2] = t.color.b;
				r.setAttribute("color", new e.BufferAttribute(n, 3)), c.push(r);
			}
			this.parts.delete(t);
		}
		if (c.length) {
			let o = new e.Mesh(t(c), n.plainMaterial ||= new e.MeshStandardMaterial({
				vertexColors: !0,
				roughness: .75,
				metalness: .1
			}));
			o.castShadow = i, o.receiveShadow = a, r.add(o);
		}
		for (let [n, s] of this.parts) {
			let c = new e.Mesh(t(s), n);
			c.castShadow = i && !n.transparent && n.depthWrite !== !1, c.receiveShadow = a, (o !== void 0 || n.depthWrite === !1) && (c.renderOrder = o ?? -5.5), r.add(c);
		}
		this.parts.clear();
	}
};
function l(t) {
	let n = new e.Matrix4().makeRotationY(Math.atan2(-t.uz, t.ux));
	return n.setPosition(t.cx, 0, t.cz), n;
}
var u = new e.Matrix4();
function d(t, n, r, i, a = 0, o = 1) {
	let s = new e.Matrix4().makeRotationY(a).scale(new e.Vector3(o, o, o)).setPosition(n, r, i);
	return u.copy(t).multiply(s).clone();
}
function f(e, t, n) {
	return [e.cx + e.ux * t - e.uz * n, e.cz + e.uz * t + e.ux * n];
}
function p(t, n, r, i = 6) {
	let a = new e.BoxGeometry(t, n, r), o = a.attributes.uv, s = [
		[r, n],
		[r, n],
		[t, r],
		[t, r],
		[t, n],
		[t, n]
	];
	for (let e = 0; e < 6; e++) for (let t = 0; t < 4; t++) {
		let n = e * 4 + t;
		o.setXY(n, o.getX(n) * s[e][0] / i, o.getY(n) * s[e][1] / i);
	}
	return a;
}
var m = (e, t, n, r) => {
	let i = p(e, t, n, r);
	return i.translate(0, t / 2, 0), i;
};
function h(t, n, r) {
	let i = new e.Shape([
		new e.Vector2(-n / 2, 0),
		new e.Vector2(n / 2, 0),
		new e.Vector2(0, r)
	]), a = new e.ExtrudeGeometry(i, {
		depth: t,
		bevelEnabled: !1
	});
	a.translate(0, 0, -t / 2), a.rotateY(Math.PI / 2);
	let o = a.attributes.uv;
	for (let e = 0; e < o.count; e++) o.setXY(e, o.getX(e) / 4, o.getY(e) / 4);
	return a;
}
function g(t, n, r) {
	let i = document.createElement("canvas");
	i.width = t, i.height = n, r(i.getContext("2d"), t, n);
	let a = new e.CanvasTexture(i);
	return a.colorSpace = e.SRGBColorSpace, a.anisotropy = 4, a;
}
function _(e, t, n, r = 1024, i = 160, a = "bold 96px Arial, sans-serif") {
	return g(r, i, (o) => {
		o.fillStyle = t, o.fillRect(0, 0, r, i), o.strokeStyle = n, o.lineWidth = 8, o.strokeRect(10, 10, r - 20, i - 20), o.fillStyle = n, o.font = a, o.textAlign = "center", o.textBaseline = "middle", o.fillText(e, r / 2, i / 2 + 4, r - 60);
	});
}
function v() {
	return g(300, 200, (e) => {
		e.fillStyle = "#74acdf", e.fillRect(0, 0, 300, 200), e.fillStyle = "#ffffff", e.fillRect(0, 67, 300, 66), e.fillStyle = "#f6b40e", e.beginPath(), e.arc(150, 100, 20, 0, Math.PI * 2), e.fill();
		for (let t = 0; t < 16; t++) {
			let n = t / 16 * Math.PI * 2;
			e.beginPath(), e.moveTo(150 + Math.cos(n) * 18, 100 + Math.sin(n) * 18), e.lineTo(150 + Math.cos(n + .1) * 30, 100 + Math.sin(n + .1) * 30), e.lineTo(150 + Math.cos(n - .1) * 30, 100 + Math.sin(n - .1) * 30), e.fill();
		}
	});
}
function y(e, t) {
	let n = [
		{
			nu: 1,
			nv: 0,
			off: e.hu,
			half: e.hv
		},
		{
			nu: -1,
			nv: 0,
			off: e.hu,
			half: e.hv
		},
		{
			nu: 0,
			nv: 1,
			off: e.hv,
			half: e.hu
		},
		{
			nu: 0,
			nv: -1,
			off: e.hv,
			half: e.hu
		}
	], r = n[0], i = Infinity;
	for (let a of n) {
		let [n, o] = f(e, a.nu * (a.off + 2), a.nv * (a.off + 2)), s = t.nearest(n, o, 80)?.dist ?? 999;
		s < i && (i = s, r = a);
	}
	return r;
}
function b(t, { root: n, collision: r, graph: i, tex: a }) {
	let o = [], u = [], p = (t, n = {}) => new e.MeshStandardMaterial({
		color: t,
		roughness: .8,
		...n
	}), b = {
		stone: p(15787727, { map: a.church.map }),
		stucco: p(15721676),
		stuccoDark: p(14207400),
		slate: p(5661290, { roughness: .6 }),
		tile: p(11556410, { map: a.roofTile }),
		dome: p(7314584, {
			roughness: .4,
			metalness: .5
		}),
		gold: p(14202458, {
			roughness: .3,
			metalness: .9
		}),
		dark: p(2762018, { roughness: .9 }),
		brick: p(16777215, { map: a.brick.map }),
		concrete: p(12170668, { roughness: .95 }),
		metal: p(7305843, {
			roughness: .5,
			metalness: .6
		}),
		canopy: p(4153164, {
			roughness: .6,
			metalness: .3
		}),
		cream: p(15853513),
		white: p(16185078, { roughness: .5 }),
		wood: p(7031343),
		iron: p(1975334, {
			roughness: .5,
			metalness: .6
		}),
		bronze: p(5916210, {
			roughness: .45,
			metalness: .7
		}),
		water: p(6263720, {
			roughness: .05,
			metalness: .2
		}),
		silo: p(13225166, {
			roughness: .35,
			metalness: .7
		}),
		lamp: p(16774358, {
			emissive: 16765578,
			emissiveIntensity: 0
		}),
		flood: p(16777215, {
			emissive: 16054527,
			emissiveIntensity: 0
		}),
		redCross: p(16777215, {
			map: g(128, 128, (e) => {
				e.fillStyle = "#fff", e.fillRect(0, 0, 128, 128), e.fillStyle = "#d62828", e.fillRect(44, 12, 40, 104), e.fillRect(12, 44, 104, 40);
			}),
			emissive: 16724016,
			emissiveIntensity: 0
		}),
		flag: new e.MeshStandardMaterial({
			map: v(),
			side: e.DoubleSide,
			roughness: .9
		}),
		line: new e.MeshBasicMaterial({
			color: 16053492,
			depthWrite: !1,
			polygonOffset: !0,
			polygonOffsetFactor: -4
		}),
		path: new e.MeshStandardMaterial({
			map: a.plaza,
			color: 14731184,
			roughness: 1,
			depthWrite: !1,
			polygonOffset: !0,
			polygonOffsetFactor: -2
		})
	};
	o.push([b.lamp, 2.5], [b.flood, 4], [b.redCross, .8]);
	let x = new c(), S = new c(), C = (e) => (t.specials || []).filter((t) => t.type === e);
	for (let n of t.buildings) {
		let t = n.special;
		if (!t || t.type !== "cathedral" && t.type !== "church") continue;
		let a = t.box, o = l(a), s = a.hu * 2, c = a.hv * 2, u = (i.nearest(...f(a, a.hu + 3, 0), 80)?.dist ?? 999) <= (i.nearest(...f(a, -a.hu - 3, 0), 80)?.dist ?? 999) ? 1 : -1, p = u > 0 ? 0 : Math.PI;
		if (t.type === "cathedral") {
			let t = c * .56, i = (c - t) / 2, a = t / 2, l = s - 7 - a, f = u * (a - 7) / 2;
			x.add(m(l, 17, t, 10), b.stone, d(o, f, 0, 0));
			for (let e of [-1, 1]) {
				x.add(m(l, 10, i, 10), b.stone, d(o, f, 0, e * (t / 2 + i / 2))), x.add(m(l, .6, i + .4), b.slate, d(o, f, 10, e * (t / 2 + i / 2)));
				for (let t = -l / 2 + 4; t < l / 2 - 2; t += 6) x.add(m(1.2, 9, 1.2), b.stuccoDark, d(o, f + t, 0, e * (c / 2 + .3)));
			}
			x.add(h(l, t + .6, 6), b.slate, d(o, f, 17, 0));
			let g = new e.CylinderGeometry(a, a, 15, 20, 1, !1, 0, Math.PI);
			g.translate(0, 15 / 2, 0), x.add(g, b.stucco, d(o, -u * (s / 2 - a), 0, 0, p + Math.PI));
			let _ = new e.SphereGeometry(a, 20, 8, Math.PI / 2, Math.PI, 0, Math.PI / 2);
			x.add(_, b.slate, d(o, -u * (s / 2 - a), 15, 0, p + Math.PI));
			let v = u * (s / 2 - 3.5);
			x.add(m(7, 21, c), b.stone, d(o, v, 0, 0));
			let y = h(7.5, c + .6, 5.5);
			x.add(y, b.stucco, d(o, v + u * .2, 21, 0)), x.add(m(.6, 1.2, c + .8), b.stuccoDark, d(o, v + u * 3.5, 20, 0)), x.add(m(.4, 6, 3.4), b.dark, d(o, u * (s / 2 + .05), 0, 0));
			for (let e of [-1, 1]) x.add(m(.4, 4.5, 2.2), b.dark, d(o, u * (s / 2 + .05), 0, e * c * .3));
			let S = new e.CylinderGeometry(2.3, 2.3, .4, 20);
			S.rotateZ(Math.PI / 2), x.add(S, b.dark, d(o, u * (s / 2 + .1), 13, 0));
			for (let t of [-1, 1]) for (let n of [.18, .42]) {
				let r = new e.CylinderGeometry(.45, .5, 17, 12);
				r.translate(0, 8.5, 0), x.add(r, b.cream, d(o, u * (s / 2 + .5), 0, t * c * n));
			}
			let C = u * (s / 2 - 4);
			x.add(m(7.5, 30, 7.5), b.stone, d(o, C, 0, 0)), x.add(m(8.3, 1, 8.3), b.stuccoDark, d(o, C, 30, 0)), x.add(m(6.6, 6, 6.6), b.stucco, d(o, C, 31, 0));
			for (let [e, t] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) x.add(m(e ? .3 : 2.4, 4, t ? .3 : 2.4), b.dark, d(o, C + e * 3.35, 32, t * 3.35));
			x.add(m(7.2, .8, 7.2), b.stuccoDark, d(o, C, 37, 0));
			let w = new e.CylinderGeometry(2.8, 3.1, 3.5, 8);
			w.translate(0, 1.75, 0), x.add(w, b.stucco, d(o, C, 37.8, 0)), x.add(new e.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), b.dome, d(o, C, 41.3, 0));
			let T = new e.CylinderGeometry(.7, .8, 2, 8);
			T.translate(0, 1, 0), x.add(T, b.stucco, d(o, C, 44, 0)), x.add(m(.3, 3.2, .3), b.gold, d(o, C, 46, 0)), x.add(m(.3, .3, 1.6), b.gold, d(o, C, 48, 0)), r.addPolygon(n.pts, 20, "building");
		} else {
			let t = Math.min(10, Math.max(8, n.h));
			x.add(m(s, t, c, 10), b.stone, d(o, 0, 0, 0)), x.add(h(s + .6, c + .8, Math.min(c * .4, 7)), b.tile, d(o, 0, t, 0));
			let i = h(.6, c + .8, Math.min(c * .4, 7));
			x.add(i, b.stucco, d(o, u * (s / 2 + .2), t, 0)), x.add(m(.4, 4.5, 2.6), b.dark, d(o, u * (s / 2 + .05), 0, 0));
			let a = Math.min(5, c * .35), l = u * (s / 2 - a / 2), f = c / 2 - a / 2, p = t + 9;
			x.add(m(a, p, a), b.stucco, d(o, l, 0, f));
			for (let [e, t] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) x.add(m(e ? .3 : 1.4, 2.4, t ? .3 : 1.4), b.dark, d(o, l + e * a / 2, p - 3.5, f + t * a / 2));
			let g = new e.ConeGeometry(a * .72, 6, 4);
			g.rotateY(Math.PI / 4), g.translate(0, 3, 0), x.add(g, b.slate, d(o, l, p, f)), x.add(m(.2, 2.2, .2), b.gold, d(o, l, p + 6, f)), x.add(m(.2, .2, 1.1), b.gold, d(o, l, p + 7.4, f)), r.addPolygon(n.pts, t, "building");
		}
	}
	for (let n of t.buildings) {
		let t = n.special;
		if (!t || t.type !== "civic" && t.type !== "hospital") continue;
		let r = t.box, a = l(r), s = y(r, i), c = -s.nv, u = s.nu, f = s.nu ? Math.PI / 2 : 0;
		if (t.type === "civic") {
			let r = Math.min(s.half * 2 * .7, 26), i = Math.min(n.h - 2, 10), o = Math.max(4, Math.round(r / 3.5) | 1), l = s.off + 2.6;
			for (let t = 0; t < o; t++) {
				let n = -r / 2 + r * t / (o - 1), f = new e.CylinderGeometry(.42, .5, i, 14);
				f.translate(0, i / 2 + .9, 0), x.add(f, b.cream, d(a, s.nu * l + c * n, 0, s.nv * l + u * n));
			}
			x.add(m(r + 2, 1.2, 4.2), b.cream, d(a, s.nu * (s.off + 2.1), i + .9, s.nv * (s.off + 2.1), f));
			let p = h(4.2, r + 2.4, 2.8);
			x.add(p, b.stucco, d(a, s.nu * (s.off + 2.1), i + 2.1, s.nv * (s.off + 2.1), f + Math.PI / 2));
			for (let e = 0; e < 3; e++) x.add(m(r + 3 - e, .3, 5.2 - e * .7), b.concrete, d(a, s.nu * (s.off + 2.4 - e * .3), e * .3, s.nv * (s.off + 2.4 - e * .3), f));
			if (t.flag) {
				let o = s.nu * (s.off - 2), c = s.nv * (s.off - 2), l = new e.CylinderGeometry(.08, .1, 9, 8);
				l.translate(0, 4.5, 0), x.add(l, b.metal, d(a, o, n.h, c));
				let u = new e.PlaneGeometry(3, 2);
				u.translate(1.5, 0, 0), x.add(u, b.flag, d(a, o, n.h + 7.8, c, Math.atan2(s.nu, s.nv) + Math.PI / 2));
				let f = new e.PlaneGeometry(Math.min(r, 18), 1.6), p = new e.MeshStandardMaterial({
					map: _(t.name.toUpperCase(), "#efe4cc", "#3a3024"),
					roughness: .8
				});
				x.add(f, p, d(a, s.nu * (s.off + 4.35), i + 1.5, s.nv * (s.off + 4.35), Math.atan2(s.nu, s.nv)));
			}
		} else {
			let r = Math.atan2(s.nu, s.nv), i = new e.PlaneGeometry(2.6, 2.6);
			x.add(i, b.redCross, d(a, s.nu * (s.off + .08), n.h - 2.2, s.nv * (s.off + .08), r)), x.add(m(8, .3, 4), b.white, d(a, s.nu * (s.off + 2), 3.2, s.nv * (s.off + 2), f));
			for (let e of [-3.6, 3.6]) x.add(m(.2, 3.2, .2), b.metal, d(a, s.nu * (s.off + 3.8) + c * e, 0, s.nv * (s.off + 3.8) + u * e));
			let l = new e.PlaneGeometry(Math.min(s.half * 1.6, 16), 1.4), p = new e.MeshStandardMaterial({
				map: _(t.name.toUpperCase(), "#ffffff", "#1d4e89"),
				emissive: 16777215,
				emissiveIntensity: 0
			});
			p.emissiveMap = p.map, o.push([p, .6]), x.add(l, p, d(a, s.nu * (s.off + .1), 4.4, s.nv * (s.off + .1), r));
		}
	}
	for (let t of C("station")) {
		let n = {
			cx: t.cx,
			cz: t.cz,
			ux: t.ux,
			uz: t.uz
		}, i = l(n), a = t.length / 2, o = 1.05, c = 6.5, u = [t.lo - 1.7 - c / 2, t.hi + 1.7 + c / 2], p = new e.MeshStandardMaterial({
			map: _(t.name.toUpperCase(), "#1f3f8f", "#ffffff"),
			roughness: .6
		});
		for (let l of u) {
			x.add(m(t.length, o, c, 3), b.concrete, d(i, 0, 0, l));
			let u = l < t.lo ? l + c / 2 - .25 : l - c / 2 + .25;
			S.add(new e.PlaneGeometry(t.length, .35).rotateX(-Math.PI / 2), new e.MeshBasicMaterial({ color: 15255088 }), d(i, 0, 1.06, u));
			for (let t = -48; t <= 48; t += 12) {
				let n = new e.CylinderGeometry(.12, .15, 3.6, 8);
				n.translate(0, 2.85, 0), x.add(n, b.canopy, d(i, t, 0, l));
			}
			x.add(m(98, .25, 6.1), b.canopy, d(i, 0, 4.65, l)), x.add(h(98, 6.3, 1.2), b.metal, d(i, 0, 4.9, l));
			for (let e of [-1, 1]) x.add(m(98, .5, .08), b.cream, d(i, 0, 4.15, l + e * (c / 2 - .25)));
			for (let t of [
				-a + 20,
				0,
				a - 20
			]) {
				for (let e of [-2.2, 2.2]) x.add(m(.12, 2.6, .12), b.iron, d(i, t + e, o, l));
				x.add(new e.PlaneGeometry(4.6, .8), p, d(i, t, 3.55, l + .05)), x.add(new e.PlaneGeometry(4.6, .8), p, d(i, t, 3.55, l - .05, Math.PI));
			}
			for (let e = -40; e <= 40; e += 16) x.add(m(2, .45, .5), b.wood, d(i, e + 6, o, l));
			for (let t of [-1, 1]) {
				let n = new e.BoxGeometry(12, .2, 5.5);
				n.rotateZ(t * Math.atan2(o, 12)), x.add(n, b.concrete, d(i, t * (a + 5.8), o / 2, l));
			}
			r.addPolygon(s({
				cx: 0,
				cz: 0,
				ux: 1,
				uz: 0,
				vx: 0,
				vz: 1,
				hu: a,
				hv: c / 2
			}).map(([e, t]) => f(n, e, t + l)), o, "platform");
		}
		let g = t.houseSide > 0 ? t.hi + 1.7 + c + 5.5 : t.lo - 1.7 - c - 5.5;
		x.add(m(34, 7, 10), b.brick, d(i, 0, 0, g)), x.add(h(35, 11, 3.2), b.tile, d(i, 0, 7, g)), x.add(m(10, 9.5, 11), b.brick, d(i, 0, 0, g));
		let v = h(11, 12, 3);
		v.rotateY(Math.PI / 2), x.add(v, b.tile, d(i, 0, 9.5, g));
		let y = new e.PlaneGeometry(12, 1.6);
		x.add(y, p, d(i, 0, 5.4, g + (t.houseSide > 0 ? 5.06 : -5.06), t.houseSide > 0 ? 0 : Math.PI)), x.add(y, p, d(i, 0, 5.4, g - (t.houseSide > 0 ? 5.06 : -5.06), t.houseSide > 0 ? Math.PI : 0)), r.addPolygon([
			[-17, -5],
			[17, -5],
			[17, 5],
			[-17, 5]
		].map(([e, t]) => f(n, e, t + g)), 9, "building");
	}
	let w = (t) => {
		let n = t.clone();
		return n.side = e.DoubleSide, n;
	}, T = {
		concrete: w(b.concrete),
		white: w(b.white),
		iron: b.iron,
		metal: w(b.metal),
		blue: w(p(1784460, { roughness: .6 })),
		celeste: w(p(7711451, { roughness: .6 }))
	}, E = (e, t, n, r = 1.1) => {
		let i = [[0, 0]];
		for (let r = 0; r < n; r++) i.push([e * r / n, t * (r + 1) / n], [e * (r + 1) / n, t * (r + 1) / n]);
		return i.push([e - .35, t], [e - .35, t + r], [e, t + r], [e, 0]), i;
	}, D = (t, n, r, i, a, o, s) => {
		let c = new e.Shape(n.map(([t, n]) => new e.Vector2(t, n))), l = new e.ExtrudeGeometry(c, {
			depth: o,
			bevelEnabled: !1
		}), u = new e.Vector3(r, 0, i), d = new e.Vector3(-i, 0, r), f = new e.Matrix4().makeBasis(u, new e.Vector3(0, 1, 0), d).setPosition(u.clone().multiplyScalar(a).addScaledVector(d, -o / 2));
		x.add(l, s, t.clone().multiply(f));
	}, O = (t, n, r, i, a, o, s) => {
		let c = r > 0 ? Math.PI / 2 : Math.PI * 1.5, l = i > 0 ? 0 : Math.PI, u = Math.abs(c - l) > Math.PI ? Math.max(c, l) : Math.min(c, l), f = new e.LatheGeometry(n.map(([t, n]) => new e.Vector2(Math.max(.01, t), n)), 10, u, Math.PI / 2);
		x.add(f, s, d(t, r * a, 0, i * o));
	}, k = (e, t, n, i, a, o, s) => {
		let c = [
			[-o / 2, i],
			[o / 2, i],
			[o / 2, i + a],
			[-o / 2, i + a]
		];
		r.addPolygon(c.map(([r, i]) => t ? f(e, t * i, r) : f(e, r, n * i)), s, "building");
	}, A = (t, n, i, a) => {
		for (let [o, s] of [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		]) {
			let c = o * (t.hu + i), l = s * (t.hv + i), u = new e.CylinderGeometry(.45, .8, a, 8);
			u.translate(0, a / 2, 0), x.add(u, b.metal, d(n, c, 0, l)), x.add(m(5, 3, .6), b.flood, d(n, c, a - 1, l, Math.atan2(-o, -s))), r.addCircle(...f(t, c, l), 1, "pole");
		}
	}, j = (t, n, r, i, a, o, s, c, l) => {
		let u = new e.MeshStandardMaterial({
			map: _(n, r, "#ffffff"),
			roughness: .6
		});
		x.add(new e.PlaneGeometry(c, l), u, d(t, i * o, s, a * o, Math.atan2(i, a)));
	};
	for (let t of C("stadium")) {
		let n = t.box, a = l(n);
		if (/centenario/i.test(t.name)) {
			let e = t.depth, o = t.height, s = E(e, o, 12), c = y(n, i);
			for (let [t, r, i, l] of [
				[
					0,
					1,
					n.hv + 3,
					2 * (n.hu + 3)
				],
				[
					0,
					-1,
					n.hv + 3,
					2 * (n.hu + 3)
				],
				[
					1,
					0,
					n.hu + 3,
					2 * (n.hv + 3)
				],
				[
					-1,
					0,
					n.hu + 3,
					2 * (n.hv + 3)
				]
			]) D(a, s, t, r, i, l, r ? T.blue : T.concrete), r && D(a, [
				[e, 0],
				[e + .08, 0],
				[e + .08, o + 1.1],
				[e, o + 1.1]
			], t, r, i, l, T.concrete), k(n, t, r, i, e, l, o), t === c.nu && r === c.nv && j(a, "ESTADIO CENTENARIO · QUILMES ATLÉTICO CLUB", "#1b3a8c", t, r, i + e + .14, o * .55, Math.min(60, l * .6), 4);
			for (let [t, i] of [
				[1, 1],
				[1, -1],
				[-1, 1],
				[-1, -1]
			]) {
				O(a, s, t, i, n.hu + 3, n.hv + 3, T.concrete);
				let o = f(n, t * (n.hu + 3 + e * .5), i * (n.hv + 3 + e * .5));
				r.addCircle(o[0], o[1], e * .6, "building");
			}
			j(a, "QUILMES", "#1b3a8c", 1, 0, n.hu + 3 + e * .55, o * .55 + 1, 26, 4.5), A(n, a, 3 + e + 4, o + 26), u.push([
				n.cx,
				n.cz,
				Math.hypot(n.hu, n.hv) + e + 10
			]);
			continue;
		}
		if (/argentino/i.test(t.name)) {
			let t = y(n, i), [r, o] = [t.nu, t.nv], s = {
				D: 12,
				H: 6,
				len: (r ? n.hv : n.hu) * 1.4,
				off: (r ? n.hu : n.hv) + 3
			};
			D(a, E(s.D, s.H, 8, .2), r, o, s.off, s.len, T.concrete), k(n, r, o, s.off, s.D, s.len, s.H + 5);
			let c = new e.Shape([
				[s.D - .4, 0],
				[s.D, 0],
				[s.D, s.H + 5.2],
				[s.D - .4, s.H + 5.2]
			].map(([t, n]) => new e.Vector2(t, n))), l = new e.Vector3(-o, 0, r), f = new e.Vector3(r, 0, o), p = (t) => a.clone().multiply(new e.Matrix4().makeBasis(f, new e.Vector3(0, 1, 0), l).setPosition(f.clone().multiplyScalar(t).addScaledVector(l, -s.len / 2)));
			x.add(new e.ExtrudeGeometry(c, {
				depth: s.len,
				bevelEnabled: !1
			}), T.white, p(s.off));
			let m = new e.Shape([
				[-1.2, s.H + 3.6],
				[s.D + .4, s.H + 5.2],
				[s.D + .4, s.H + 5.45],
				[-1.2, s.H + 3.85]
			].map(([t, n]) => new e.Vector2(t, n)));
			x.add(new e.ExtrudeGeometry(m, {
				depth: s.len,
				bevelEnabled: !1
			}), T.metal, p(s.off));
			let h = new e.Shape([
				[-1.3, s.H + 2.9],
				[-1.1, s.H + 2.9],
				[-1.1, s.H + 3.9],
				[-1.3, s.H + 3.9]
			].map(([t, n]) => new e.Vector2(t, n)));
			x.add(new e.ExtrudeGeometry(h, {
				depth: s.len,
				bevelEnabled: !1
			}), T.celeste, p(s.off));
			for (let t = -s.len / 2 + 3; t <= s.len / 2 - 3; t += 7) {
				let n = new e.CylinderGeometry(.12, .14, s.H + 3.7, 6);
				n.translate(0, (s.H + 3.7) / 2, 0);
				let i = s.off - .9;
				x.add(n, T.iron, r ? d(a, r * i, 0, t) : d(a, t, 0, o * i));
			}
			j(a, "CLUB ATLÉTICO ARGENTINO DE QUILMES", "#4f8fc9", -r, -o, -(s.off - 1.35), s.H + 3.4, Math.min(40, s.len * .8), 1), j(a, "ARGENTINO DE QUILMES · PLATEA 1927", "#4f8fc9", r, o, s.off + s.D + .05, s.H * .6, Math.min(34, s.len * .7), 2.6);
			let g = 2 * ((r ? n.hv : n.hu) + 3), _ = s.off;
			D(a, E(10, 5, 10), -r, -o, _, g, T.concrete), D(a, [
				[9.6, 5],
				[10, 5],
				[10, 6.1],
				[9.6, 6.1]
			], -r, -o, _, g, T.celeste), k(n, -r, -o, _, 10, g, 6);
			let v = (r ? n.hv : n.hu) + 3, b = 2 * ((r ? n.hu : n.hv) + 3);
			for (let e of [1, -1]) {
				let [t, i] = r ? [0, e] : [e, 0];
				D(a, [
					[0, 0],
					[0, 2.2],
					[.3, 2.2],
					[.3, 0]
				], t, i, v + 2, b, T.white), D(a, [
					[-.02, 1.4],
					[-.02, 1.9],
					[.32, 1.9],
					[.32, 1.4]
				], t, i, v + 2, b, T.celeste), k(n, t, i, v + 2, .3, b, 2.2);
			}
			A(n, a, 11, 22), u.push([
				n.cx,
				n.cz,
				Math.hypot(n.hu, n.hv) + 16
			]);
			continue;
		}
		let o = t.colors.map((e) => p(e, { roughness: .6 })), s = t.depth, c = t.height, h = s > 16 ? 6 : 4, g = y(n, i), v = [
			{
				nu: 0,
				nv: 1,
				len: n.hu * 2 + 4,
				off: n.hv
			},
			{
				nu: 0,
				nv: -1,
				len: n.hu * 2 + 4,
				off: n.hv
			},
			{
				nu: 1,
				nv: 0,
				len: n.hv * 2 + 4,
				off: n.hu
			},
			{
				nu: -1,
				nv: 0,
				len: n.hv * 2 + 4,
				off: n.hu
			}
		];
		for (let i of v) {
			let l = i.nu === g.nu && i.nv === g.nv, u = l ? c * 1.25 : c, p = i.nu ? Math.PI / 2 : 0, v = s / h;
			for (let e = 0; e < h; e++) {
				let t = i.off + 3 + v * (e + .5);
				x.add(m(i.len, u * (e + 1) / h, v), o[e % o.length], d(a, i.nu * t, 0, i.nv * t, p));
			}
			x.add(m(i.len, u + 1.2, .6), b.concrete, d(a, i.nu * (i.off + 3 + s + .3), 0, i.nv * (i.off + 3 + s + .3), p));
			let y = i.off + 3 + s + .6, S = [
				[-i.len / 2, i.off + 3],
				[i.len / 2, i.off + 3],
				[i.len / 2, y],
				[-i.len / 2, y]
			];
			if (r.addPolygon(S.map(([e, t]) => i.nu ? f(n, i.nu * t, e) : f(n, e, i.nv * t)), u, "building"), l) {
				x.add(m(i.len, .4, s + 3), b.metal, d(a, i.nu * (i.off + 3 + s / 2), u + 4, i.nv * (i.off + 3 + s / 2), p));
				for (let t = -i.len / 2 + 4; t <= i.len / 2 - 4; t += 12) {
					let n = new e.CylinderGeometry(.25, .3, u + 4, 8);
					n.translate(0, (u + 4) / 2, 0), x.add(n, b.metal, i.nu ? d(a, i.nu * (i.off + 3 + s), 0, t) : d(a, t, 0, i.nv * (i.off + 3 + s)));
				}
				if (t.name) {
					let n = /centenario|quilmes atl/i.test(t.name) ? "QUILMES ATLÉTICO CLUB" : t.name.toUpperCase(), r = new e.MeshStandardMaterial({
						map: _(n, t.colors[1], (t.colors[0], "#ffffff")),
						roughness: .6
					}), o = Math.atan2(i.nu, i.nv) + Math.PI, c = i.off + 3 + .5;
					x.add(new e.PlaneGeometry(Math.min(40, i.len * .5), 3), r, d(a, i.nu * c, u + 2.4, i.nv * c, o)), x.add(new e.PlaneGeometry(Math.min(40, i.len * .5), 3), r, d(a, i.nu * (c + s + .4), u + 2.4, i.nv * (c + s + .4), o + Math.PI));
				}
			}
		}
		for (let [t, i] of [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		]) {
			let o = t * (n.hu + 3 + s * .7), l = i * (n.hv + 3 + s * .7), u = new e.CylinderGeometry(.5, .9, c + 22, 8);
			u.translate(0, (c + 22) / 2, 0), x.add(u, b.metal, d(a, o, 0, l));
			let p = m(5, 3, .6);
			x.add(p, b.flood, d(a, o, c + 21, l, Math.atan2(-t, -i))), r.addCircle(...f(n, o, l), 1, "pole");
		}
		t.turf && S.add(new e.PlaneGeometry(n.hu * 2, n.hv * 2).rotateX(-Math.PI / 2), p(t.turf, {
			depthWrite: !1,
			polygonOffset: !0,
			polygonOffsetFactor: -1
		}), d(a, 0, .05, 0)), u.push([
			n.cx,
			n.cz,
			Math.hypot(n.hu, n.hv) + s + 6
		]);
	}
	for (let t of C("pitch")) {
		let n = t.box, r = l(n), i = .14, a = .06, o = (t, n, o, s = 0) => S.add(new e.PlaneGeometry(t, i).rotateX(-Math.PI / 2), b.line, d(r, n, a, o, s)), s = n.hu - 1, c = n.hv - 1;
		o(s * 2, 0, c), o(s * 2, 0, -c), o(c * 2, s, 0, Math.PI / 2), o(c * 2, -s, 0, Math.PI / 2), o(c * 2, 0, 0, Math.PI / 2);
		let u = Math.min(9.15, c * .3);
		S.add(new e.RingGeometry(u - i / 2, u + i / 2, 40).rotateX(-Math.PI / 2), b.line, d(r, 0, a, 0));
		let f = Math.min(7.32, c * .3), p = f > 5 ? 2.44 : 2, h = Math.min(16.5, s * .3), g = Math.min(40.3, c * 1.3);
		for (let t of [-1, 1]) {
			o(g, t * (s - h), 0, Math.PI / 2), o(h, t * (s - h / 2), g / 2), o(h, t * (s - h / 2), -g / 2);
			for (let n of [-1, 1]) {
				let i = new e.CylinderGeometry(.06, .06, p, 6);
				i.translate(0, p / 2, 0), x.add(i, b.white, d(r, t * s, 0, n * f / 2));
			}
			x.add(m(.12, .12, f), b.white, d(r, t * s, p - .06, 0)), x.add(m(.1, .1, f), b.white, d(r, t * (s + 1.5), 0, 0));
		}
	}
	for (let t of C("brewery")) {
		let n = t.box, i = l(n), a = t.h || 12;
		for (let t = 0; t < 4; t++) for (let r of [-5.2, 5.2]) {
			let o = new e.CylinderGeometry(4.5, 4.5, a + 18, 20);
			o.translate(0, (a + 18) / 2, 0), x.add(o, b.silo, d(i, n.hu - 8 - t * 9.6, 0, r));
			let s = new e.ConeGeometry(4.6, 2.2, 20);
			s.translate(0, a + 19.1, 0), x.add(s, b.silo, d(i, n.hu - 8 - t * 9.6, 0, r));
		}
		x.add(m(40, 3, 1.4), b.metal, d(i, n.hu - 22, a + 18, 0));
		let s = new e.CylinderGeometry(1.7, 2.8, a + 38, 16);
		s.translate(0, (a + 38) / 2, 0), x.add(s, b.brick, d(i, -n.hu + 10, 0, 0)), x.add(new e.CylinderGeometry(2, 2, 1.2, 16).translate(0, a + 38, 0), b.stuccoDark, d(i, -n.hu + 10, 0, 0));
		let c = new e.MeshStandardMaterial({
			map: g(1024, 256, (e, t, n) => {
				e.fillStyle = "#12308a", e.fillRect(0, 0, t, n), e.fillStyle = "#ffffff", e.fillRect(0, n - 46, t, 14), e.fillStyle = "#d7263d", e.fillRect(0, n - 32, t, 14), e.fillStyle = "#ffffff", e.font = "italic bold 170px Georgia, serif", e.textAlign = "center", e.textBaseline = "middle", e.fillText("Quilmes", t / 2, n / 2 - 16);
			}),
			emissive: 16777215,
			emissiveIntensity: 0,
			roughness: .5
		});
		c.emissiveMap = c.map, o.push([c, .9]);
		let u = Math.min(70, n.hu * .5), p = u / 4;
		for (let e of [
			-u * .4,
			0,
			u * .4
		]) x.add(m(.5, 6, .5), b.iron, d(i, e, a, 0));
		for (let t of [0, Math.PI]) x.add(new e.PlaneGeometry(u, p), c, d(i, 0, a + 5 + p / 2, t ? -.15 : .15, t));
		r.addCircle(...f(n, -n.hu + 10, 0), 2.8, "building");
	}
	for (let t of C("plaza")) {
		let n = t.box, r = l(n), i = n.hu - 3, a = n.hv - 3, o = (t, i, a, o, s) => {
			let c = Math.hypot(a - t, o - i), l = new e.PlaneGeometry(c, s).rotateX(-Math.PI / 2), p = l.attributes.uv;
			for (let e = 0; e < p.count; e++) p.setXY(e, p.getX(e) * c / 4, p.getY(e) * s / 4);
			S.add(l, b.path, d(r, (t + a) / 2, .045, (i + o) / 2, -Math.atan2(o - i, a - t)));
			for (let e = 0; e <= c; e += 6) u.push([...f(n, t + (a - t) * e / c, i + (o - i) * e / c), s / 2 + 1.5]);
		};
		o(-i, -a, i, -a, 3), o(-i, a, i, a, 3), o(-i, -a, -i, a, 3), o(i, -a, i, a, 3), o(-i, -a, i, a, 3.2), o(-i, a, i, -a, 3.2), o(-i, 0, i, 0, 2.6), o(0, -a, 0, a, 2.6);
		let s = new e.CircleGeometry(Math.min(9, a * .3), 32).rotateX(-Math.PI / 2);
		S.add(s, b.path, d(r, 0, .05, 0)), u.push([
			n.cx,
			n.cz,
			Math.min(9, a * .3) + 2
		]);
		for (let [t, n] of [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		]) {
			let o = Math.atan2(n * a, t * i);
			for (let e of [.35, .65]) {
				let s = t * i * e, c = n * a * e, l = -Math.sin(o) * 2.4, u = Math.cos(o) * 2.4, f = -o;
				x.add(m(1.8, .45, .5), b.wood, d(r, s + l, 0, c + u, f)), x.add(m(1.8, .5, .08), b.wood, d(r, s + l * 1.1, .45, c + u * 1.1, f));
			}
			let s = t * i * .5, c = n * a * .5;
			x.add(new e.CylinderGeometry(.07, .1, 3.6, 6).translate(0, 1.8, 0), b.iron, d(r, s, 0, c)), x.add(new e.SphereGeometry(.32, 12, 8), b.lamp, d(r, s, 3.8, c));
		}
		ee(t.monument, r, n);
	}
	function ee(t, n, i) {
		if (t === "equestrian") {
			x.add(m(7, 1, 4.6), b.stuccoDark, d(n, 0, 0, 0)), x.add(m(5.6, 4.5, 3), b.stone, d(n, 0, 1, 0)), x.add(m(6, .5, 3.4), b.stuccoDark, d(n, 0, 5.5, 0));
			let t = 1.7, a = (r, i, a, o, s, c, l = 0) => {
				let u = new e.BoxGeometry(r * t, i * t, a * t);
				u.rotateZ(l), u.translate(o * t, 6 + s * t, c * t), x.add(u, b.bronze, n.clone());
			};
			a(1.9, .8, .7, 0, 1.45, 0);
			for (let [e, t, n] of [
				[
					.75,
					.22,
					-.35
				],
				[
					.75,
					-.22,
					0
				],
				[
					-.75,
					.22,
					.2
				],
				[
					-.75,
					-.22,
					0
				]
			]) a(.16, 1.1, .16, e + (n ? .1 : 0), .6, t, n);
			a(.35, .9, .35, 1.05, 2.05, 0, -.6), a(.7, .3, .28, 1.45, 2.45, 0, -.25), a(.12, .7, .12, -1, 1.4, 0, .5), a(.45, .8, .4, -.05, 2.25, 0), a(.25, .28, .25, -.05, 2.8, 0), a(.3, .12, .3, -.05, 2.98, 0), a(.12, .7, .12, .35, 2.8, .2, -1.1), a(.14, .5, .14, -.05, 1.85, .3), a(.14, .5, .14, -.05, 1.85, -.3), r.addPolygon([
				[-3.5, -2.3],
				[3.5, -2.3],
				[3.5, 2.3],
				[-3.5, 2.3]
			].map(([e, t]) => f(i, e, t)), 6, "building");
		} else if (t === "obelisk") {
			x.add(m(4, .8, 4), b.stuccoDark, d(n, 0, 0, 0));
			let t = new e.CylinderGeometry(.9, 1.4, 12, 4);
			t.rotateY(Math.PI / 4), t.translate(0, 6.8, 0), x.add(t, b.cream, d(n, 0, 0, 0));
			let a = new e.ConeGeometry(.95, 1.6, 4);
			a.rotateY(Math.PI / 4), a.translate(0, 13.6, 0), x.add(a, b.cream, d(n, 0, 0, 0)), r.addCircle(i.cx, i.cz, 2.2, "building");
		} else if (t === "fountain") {
			let t = new e.CylinderGeometry(5, 5.2, .7, 32, 1, !0);
			t.translate(0, .35, 0), x.add(t, b.stone, d(n, 0, 0, 0)), x.add(new e.TorusGeometry(5.05, .18, 6, 32).rotateX(Math.PI / 2), b.stone, d(n, 0, .7, 0)), x.add(new e.CircleGeometry(5, 32).rotateX(-Math.PI / 2), b.water, d(n, 0, .55, 0)), x.add(new e.CylinderGeometry(.5, .7, 2.2, 12).translate(0, 1.1, 0), b.stone, d(n, 0, 0, 0)), x.add(new e.CylinderGeometry(1.8, .6, .5, 20).translate(0, 2.3, 0), b.stone, d(n, 0, 0, 0)), x.add(new e.CylinderGeometry(.25, .35, 1.2, 10).translate(0, 3, 0), b.stone, d(n, 0, 0, 0)), x.add(new e.SphereGeometry(.45, 12, 8).translate(0, 3.8, 0), b.stone, d(n, 0, 0, 0)), r.addCircle(i.cx, i.cz, 5.3, "building");
		} else x.add(m(1.2, 2, 1.2), b.stone, d(n, 0, 0, 0)), x.add(m(.8, .5, .4), b.bronze, d(n, 0, 2, 0)), x.add(m(.36, .45, .36), b.bronze, d(n, 0, 2.5, 0)), r.addCircle(i.cx, i.cz, .9, "building");
	}
	return x.build(n), S.build(n, {
		cast: !1,
		order: -5.5
	}), {
		keepOut: u,
		setNight(e) {
			for (let [t, n] of o) t.emissiveIntensity = e * n;
		}
	};
}
//#endregion
//#region src/world/geobuf.js
var x = class {
	constructor(e, t = 768) {
		this.Type = e, this.a = new e(t), this.length = 0;
	}
	grow(e) {
		if (this.length + e <= this.a.length) return;
		let t = new this.Type(Math.max(this.a.length * 2, this.length + e));
		t.set(this.a), this.a = t;
	}
	push(e, t, n) {
		this.grow(3);
		let r = this.a;
		r[this.length++] = e, t !== void 0 && (r[this.length++] = t), n !== void 0 && (r[this.length++] = n);
	}
	take() {
		let e = this.length > this.a.length * .8 ? this.a.subarray(0, this.length) : this.a.slice(0, this.length);
		return this.a = new this.Type(0), this.length = 0, e;
	}
}, S = [
	0,
	1,
	2,
	0,
	2,
	3
], C = [
	0,
	2,
	1,
	0,
	3,
	2
], w = (e) => Math.max(-127, Math.min(127, Math.round(e * 127))), T = (e) => Math.max(0, Math.min(255, Math.round(e * 255))), E = class {
	constructor(e = !1) {
		this.layered = e, this.pos = new x(Float32Array), this.nor = new x(Int8Array), this.uv = new x(Float32Array), this.col = new x(Uint8Array), this.lay = new x(Float32Array);
	}
	tri(e, t, n, r, i, a, o, s, c = 0) {
		let l = t[0] - e[0], u = t[1] - e[1], d = t[2] - e[2], f = n[0] - e[0], p = n[1] - e[1], m = n[2] - e[2], h = u * m - d * p, g = d * f - l * m, _ = l * p - u * f;
		s && h * s[0] + g * s[1] + _ * s[2] < 0 && ([t, n] = [n, t], [i, a] = [a, i], h = -h, g = -g, _ = -_);
		let v = Math.hypot(h, g, _) || 1;
		h = w(h / v), g = w(g / v), _ = w(_ / v);
		let y = T(o.r), b = T(o.g), x = T(o.b);
		for (let [o, s] of [
			[e, r],
			[t, i],
			[n, a]
		]) this.pos.push(o[0], o[1], o[2]), this.nor.push(h, g, _), this.nor.push(0), this.uv.push(s[0], s[1]), this.col.push(y, b, x), this.col.push(255), this.layered && this.lay.push(c);
	}
	quadRaw(e, t, n, r, i) {
		let a = e[3] - e[0], o = e[4] - e[1], s = e[5] - e[2], c = e[6] - e[0], l = e[7] - e[1], u = e[8] - e[2], d = o * u - s * l, f = s * c - a * u, p = a * l - o * c, m = d * n + f * r + p * i < 0;
		m && (d = -d, f = -f, p = -p);
		let h = Math.hypot(d, f, p) || 1, g = w(d / h), _ = w(f / h), v = w(p / h), y = T(t.r), b = T(t.g), x = T(t.b), E = m ? C : S;
		for (let t = 0; t < 6; t++) {
			let n = E[t] * 3;
			this.pos.push(e[n], e[n + 1], e[n + 2]), this.nor.push(g, _, v), this.nor.push(0), this.uv.push(0, 0), this.col.push(y, b, x), this.col.push(255);
		}
	}
	quad(e, t, n, r, i, a, o, s, c, l, u = 0) {
		this.tri(e, t, n, i, a, o, c, l, u), this.tri(e, n, r, i, o, s, c, l, u);
	}
	wall(e, t, n, r, i, a, o, s, c, l = n / o, u = null) {
		let d = i - Math.hypot(t[0] - e[0], t[1] - e[1]) / a, f = l, p = l + (r - n) / o, m = u || [
			t[1] - e[1],
			0,
			-(t[0] - e[0])
		];
		return this.quad([
			e[0],
			n,
			e[1]
		], [
			t[0],
			n,
			t[1]
		], [
			t[0],
			r,
			t[1]
		], [
			e[0],
			r,
			e[1]
		], [i, f], [d, f], [d, p], [i, p], s, m, c), d;
	}
	get empty() {
		return this.pos.length === 0;
	}
	geometry() {
		let t = new e.BufferGeometry();
		return t.setAttribute("position", new e.BufferAttribute(this.pos.take(), 3)), t.setAttribute("normal", new e.BufferAttribute(this.nor.take(), 4, !0)), t.setAttribute("uv", new e.BufferAttribute(this.uv.take(), 2)), t.setAttribute("color", new e.BufferAttribute(this.col.take(), 4, !0)), this.layered && t.setAttribute("layer", new e.BufferAttribute(this.lay.take(), 1)), t.computeBoundingSphere(), t.computeBoundingBox(), t;
	}
};
new e.Vector3(), new e.Vector3(), new e.Matrix3(), new e.Matrix4();
function D(e) {
	let t = e.index ? e.toNonIndexed() : e;
	for (let e of Object.keys(t.attributes)) e !== "position" && e !== "normal" && t.deleteAttribute(e);
	return t;
}
//#endregion
//#region src/world/metrobus.js
var O = 2.6, k = 34, A = .32;
(() => {
	let t = (t, n, r, i, a, o) => new e.BoxGeometry(t, n, r).translate(i, a + n / 2, o), n = [t(O, A, k, 0, 0, 0)], r = [t(.3, .01, k, -2.6 / 2 + .15, A, 0)], i = [t(3, .12, k * .7, .1, 3, 0)];
	for (let e = -11.22; e <= k * .34; e += k * .165) i.push(t(.12, 2.7, .12, O / 2 - .25, A, e));
	return i.push(t(.1, 1, k, O / 2 - .05, A, 0)), {
		deck: n,
		edge: r,
		frame: i,
		glass: [t(.03, 1.6, k * .66, O / 2 - .12, 1.32, 0)],
		sign: [t(.08, .7, 3.2, .1, 3.12, k * .35 - 1.6)]
	};
})(), new e.Color(.92, .92, .88), new e.Color(.93, .72, .08), new e.Color(.74, .73, .7), new e.Color(.9, .7, .1), new e.Color(.1, .1, .1), new e.Color(.8, .79, .76);
var j = class {
	constructor(e) {
		this.pts = e, this.d = [0];
		for (let t = 1; t < e.length; t++) this.d.push(this.d[t - 1] + Math.hypot(e[t][0] - e[t - 1][0], e[t][1] - e[t - 1][1]));
		this.len = this.d[this.d.length - 1];
	}
	at(e) {
		let { pts: t, d: n } = this, r = 1;
		for (; r < n.length - 1 && n[r] < e;) r++;
		let i = t[r - 1], a = t[r], o = n[r] - n[r - 1] || 1, s = Math.max(0, Math.min(1, (e - n[r - 1]) / o));
		return [
			i[0] + (a[0] - i[0]) * s,
			i[1] + (a[1] - i[1]) * s,
			(a[0] - i[0]) / o,
			(a[1] - i[1]) / o
		];
	}
	sub(e, t) {
		if (t - e < .05) return null;
		let n = [this.at(e).slice(0, 2)];
		for (let r = 1; r < this.pts.length - 1; r++) this.d[r] > e && this.d[r] < t && n.push(this.pts[r]);
		return n.push(this.at(t).slice(0, 2)), n;
	}
}, ee = (e) => e.kind === "pedestrian" && /^rivadavia$/i.test(e.name);
function te(e) {
	for (let t of e.roads) ee(t) && (t.noCars = !0);
}
var ne = new e.Matrix4(), re = new e.Quaternion(), ie = new e.Vector3(0, 1, 0);
function M(t, n, r, i = 0, a = 1, o = a, s = a) {
	return ne.compose(new e.Vector3(t, n, r), re.setFromAxisAngle(ie, i), new e.Vector3(a, o, s)).clone();
}
var N = (t, n, r) => new e.BoxGeometry(t, n, r).translate(0, n / 2, 0), P = (t, n, r, i = 10) => new e.CylinderGeometry(t, n, r, i).translate(0, r / 2, 0);
function ae() {
	let t = g(256, 256, (e, t, r) => {
		let i = n(77), a = (t, n, a, o) => {
			for (let s = 0; s < r; s += 10) {
				let r = s / 10 % 2 ? 0 : 10;
				for (let c = t - r; c < n; c += 20) {
					let r = a[2] + (i() - .5) * o;
					e.fillStyle = `hsl(${a[0]},${a[1]}%,${r}%)`, e.fillRect(Math.max(t, c) + 1, s + 1, Math.min(n, c + 20) - Math.max(t, c) - 1, 9);
				}
			}
		};
		e.fillStyle = "#6d6a64", e.fillRect(0, 0, t, r), a(0, t, [
			38,
			8,
			64
		], 8), a(t * .36, t * .64, [
			16,
			42,
			42
		], 8), e.fillStyle = "#4a4844", e.fillRect(0, 0, t, 6), e.fillRect(t * .36 - 3, 0, 3, r), e.fillRect(t * .64, 0, 3, r);
		for (let n = 0; n < 1500; n++) {
			let n = Math.floor(i() * 255);
			e.fillStyle = `rgba(${n},${n},${n},0.07)`, e.fillRect(i() * t, i() * r, 2, 2);
		}
	});
	return t.wrapS = t.wrapT = e.RepeatWrapping, t;
}
function oe(e, t = !1) {
	return g(256, 128, (r, i, a) => {
		let o = n(e);
		r.fillStyle = t ? "#2f4a22" : "#203828", r.fillRect(0, 0, i, a);
		let s = t ? [
			"#e63946",
			"#f1c40f",
			"#ff8fab",
			"#ffffff",
			"#9b5de5",
			"#ff6b35"
		] : [
			"#d62828",
			"#f4f1de",
			"#1d3557",
			"#e9c46a",
			"#2a9d8f",
			"#f77f00",
			"#ffffff"
		];
		for (let e = 6; e < a - 10; e += t ? 14 : 30) for (let n = 4; n < i - 20; n += t ? 10 + o() * 6 : 22 + o() * 6) r.fillStyle = s[Math.floor(o() * s.length)], t ? (r.beginPath(), r.arc(n + 5, e + 6, 4 + o() * 2, 0, Math.PI * 2), r.fill()) : (r.fillRect(n, e, 18, 25), r.fillStyle = "rgba(0,0,0,0.5)", r.fillRect(n + 2, e + 3, 14, 3));
	});
}
function se(t) {
	let r = g(128, 128, (e, r, i) => {
		let a = n(t);
		e.fillStyle = "#3d5a2a", e.fillRect(0, 0, r, i);
		let o = [
			"#e63946",
			"#f1c40f",
			"#ff8fab",
			"#ffffff",
			"#9b5de5",
			"#ff7b00"
		], s = o[t % o.length], c = o[(t + 2) % o.length];
		for (let t = 0; t < 900; t++) e.fillStyle = a() < .3 ? "#4f7a33" : a() < .7 ? s : c, e.beginPath(), e.arc(a() * r, a() * i, 1.5 + a() * 2, 0, Math.PI * 2), e.fill();
	});
	return r.wrapS = r.wrapT = e.RepeatWrapping, r;
}
function ce(t, { root: r, graph: i, collision: a, ribbon: o, flatMat: s, keepOut: l, GeoBuf: u }) {
	let d = (t, n = {}) => new e.MeshStandardMaterial({
		color: t,
		roughness: .8,
		...n
	}), f = {
		green: d(3100474, {
			roughness: .5,
			metalness: .4
		}),
		brick: d(10770236, { roughness: .95 }),
		concrete: d(12433581, { roughness: .95 }),
		soil: d(3877406, { roughness: 1 }),
		trunk: d(5916210, { roughness: 1 }),
		leaf: d(5602619, { flatShading: !0 }),
		leaf2: d(7049022, { flatShading: !0 }),
		frond: d(5012018, {
			side: e.DoubleSide,
			flatShading: !0
		}),
		palm: d(9075298, { roughness: 1 }),
		wood: d(8016948),
		iron: d(2304042, {
			roughness: .5,
			metalness: .6
		}),
		yellow: d(14725920),
		white: d(15921906, { roughness: .4 }),
		lamp: d(16774358, {
			emissive: 16765578,
			emissiveIntensity: 0
		}),
		tarpBlue: d(2781109, { side: e.DoubleSide }),
		tarpRed: d(12597547, { side: e.DoubleSide }),
		tarpGreen: d(3050327, { side: e.DoubleSide }),
		red: d(12597547, {
			roughness: .5,
			metalness: .3
		}),
		blue: d(2781109, {
			roughness: .5,
			metalness: .3
		}),
		sand: d(14272666, { roughness: 1 }),
		tableTop: d(15262420, { roughness: .5 }),
		chair: d(9067058),
		bulb: d(16773572, {
			emissive: 16762992,
			emissiveIntensity: 0
		}),
		dumpster: d(3042106, { roughness: .7 }),
		dumpsterLid: d(2314284, { roughness: .7 }),
		grill: d(1381653, {
			roughness: .6,
			metalness: .5
		}),
		ember: d(16734751, {
			emissive: 16726528,
			emissiveIntensity: .6
		}),
		smoke: new e.MeshBasicMaterial({
			color: 14540253,
			transparent: !0,
			opacity: .25,
			depthWrite: !1
		}),
		flag: new e.MeshStandardMaterial({
			map: v(),
			side: e.DoubleSide,
			roughness: .9
		}),
		diarios: d(16777215, { map: _("DIARIOS · REVISTAS", "#f2efe4", "#1f3a2a", 1024, 160) }),
		rack: d(16777215, { map: oe(5) }),
		floreria: d(16777215, { map: _("FLORERÍA", "#f6e7ef", "#8a1c4a", 1024, 160) }),
		flowers: d(16777215, { map: oe(9, !0) }),
		taxi: d(16777215, { map: _("PARADA DE TAXIS", "#111111", "#f2c200", 1024, 200, "bold 92px Arial, sans-serif") }),
		choripan: d(16777215, { map: _("CHORIPÁN · BONDIOLA", "#c0392b", "#fff4d6", 1024, 160) })
	}, p = new c(), m = new c(), h = s(ae()), g = n(2024), y = (e, t, n) => a.addCircle(e, t, n, "prop"), b = (e, t, n, r, i) => {
		let o = Math.cos(n), s = Math.sin(n);
		a.addPolygon([
			[-r, -i],
			[r, -i],
			[r, i],
			[-r, i]
		].map(([n, r]) => [e + o * n + s * r, t - s * n + o * r]), 3, "prop");
	};
	function x(t, n, r = 3.2, i = f.leaf) {
		p.add(P(.12, .18, r, 7), f.trunk, M(t, 0, n));
		let a = new e.IcosahedronGeometry(1.7, 0);
		p.add(a, i, M(t, r + .6, n, g() * 6, 1, .8 + g() * .3, 1)), p.add(new e.IcosahedronGeometry(1.1, 0), i, M(t + .6, r + 1.4, n - .3, g() * 6));
	}
	function S(e, t, n) {
		p.add(N(1.9, .55, 1.9), f.brick, M(e, 0, t, n)), p.add(N(1.6, .02, 1.6), f.soil, M(e, .55, t, n)), x(e, t, 3 + g()), b(e, t, n, .95, .95);
	}
	function C(e, t, n) {
		p.add(N(1.8, .08, .5), f.wood, M(e, .42, t, n)), p.add(N(1.8, .45, .06), f.wood, M(e - Math.sin(n) * .24, .5, t - Math.cos(n) * .24, n));
		for (let r of [-.75, .75]) p.add(N(.08, .42, .45), f.iron, M(e + Math.cos(n) * r, 0, t - Math.sin(n) * r, n));
	}
	let w = [];
	function T(t, n, r) {
		p.add(P(.07, .11, 4.6, 8), f.green, M(t, 0, n)), p.add(N(1.5, .08, .08), f.green, M(t, 4.5, n, r));
		for (let i of [-.7, .7]) {
			let a = t + Math.cos(r) * i, o = n - Math.sin(r) * i;
			p.add(P(.03, .03, .25, 6), f.green, M(a, 4.55, o)), p.add(new e.SphereGeometry(.24, 12, 8), f.lamp, M(a, 5, o));
		}
		w.push([t, n]), y(t, n, .15);
	}
	function E(e, t) {
		p.add(P(.24, .22, .85, 10), f.green, M(e, 0, t)), p.add(P(.27, .27, .06, 10), f.iron, M(e, .85, t)), y(e, t, .3);
	}
	function D(e, t) {
		p.add(P(.1, .12, .85, 8), f.iron, M(e, 0, t)), p.add(P(.11, .11, .08, 8), f.yellow, M(e, .7, t)), y(e, t, .13);
	}
	function O(t, n, r, i = !1) {
		p.add(N(2.6, 2.3, 1.6), f.green, M(t, 0, n, r)), p.add(N(3.4, .12, 2.4), f.green, M(t, 2.3, n, r));
		let a = i ? f.floreria : f.diarios, o = i ? f.flowers : f.rack;
		for (let i of [-1, 1]) {
			let s = Math.sin(r) * i, c = Math.cos(r) * i, l = r + (i < 0 ? Math.PI : 0);
			p.add(new e.PlaneGeometry(3.2, .42), a, M(t + s * 1.21, 2.62, n + c * 1.21, l)), p.add(new e.PlaneGeometry(3.2, .42), a, M(t + s * 1.19, 2.62, n + c * 1.19, l + Math.PI)), p.add(new e.PlaneGeometry(2.4, 1.2), o, M(t + s * .81, 1, n + c * .81, l));
		}
		p.add(N(3.2, .42, .04), f.white, M(t, 2.42, n, r)), b(t, n, r, 1.4, .9);
	}
	function k(t, n, r, i) {
		for (let [e, i] of [
			[-1, -.8],
			[1, -.8],
			[-1, .8],
			[1, .8]
		]) {
			let a = t + Math.cos(r) * e + Math.sin(r) * i, o = n - Math.sin(r) * e + Math.cos(r) * i;
			p.add(P(.025, .025, 2.2, 5), f.iron, M(a, 0, o));
		}
		let a = new e.PlaneGeometry(2.4, 2).rotateX(-Math.PI / 2 + .12);
		p.add(a, i, M(t, 2.25, n, r)), p.add(N(1.9, .05, .9), f.wood, M(t, .75, n, r)), p.add(new e.PlaneGeometry(1.8, .8).rotateX(-Math.PI / 2), f.rack, M(t, .81, n, r)), b(t, n, r, 1, .5);
	}
	function A(t, n, r) {
		p.add(N(1.8, .95, .9), f.white, M(t, .25, n, r)), p.add(N(1.7, .08, .8), f.grill, M(t, 1.2, n, r)), p.add(N(1.4, .03, .6), f.ember, M(t, 1.22, n, r));
		for (let i of [-.7, .7]) p.add(new e.CylinderGeometry(.25, .25, .08, 12).rotateX(Math.PI / 2).translate(0, .25, 0), f.iron, M(t + Math.cos(r) * i, 0, n - Math.sin(r) * i, r));
		p.add(new e.PlaneGeometry(1.8, .4), f.choripan, M(t + Math.sin(r) * .46, .7, n + Math.cos(r) * .46, r)), p.add(new e.PlaneGeometry(1.8, .4), f.choripan, M(t - Math.sin(r) * .46, .7, n - Math.cos(r) * .46, r + Math.PI)), p.add(P(.03, .03, 2.4, 5), f.iron, M(t, 0, n)), p.add(new e.ConeGeometry(1.4, .5, 10, 1, !0).translate(0, 2.5, 0), f.tarpRed, M(t, 0, n));
		for (let r = 0; r < 4; r++) p.add(new e.SphereGeometry(.25 + r * .12, 8, 6), f.smoke, M(t + r * .15, 1.5 + r * .35, n + r * .05));
		b(t, n, r, .95, .5);
	}
	function te(t, n, r) {
		for (let e = 0; e < 4; e++) p.add(P(.2 - e * .02, .22 - e * .02, r / 4 + .05, 8), f.palm, M(t + e * .05, e * r / 4, n));
		for (let i = 0; i < 9; i++) {
			let a = new e.PlaneGeometry(.7, 3.4, 1, 3), o = a.attributes.position;
			for (let e = 0; e < o.count; e++) o.setZ(e, -((o.getY(e) + 1.7) ** 2) * .12);
			a.translate(0, 1.7, 0).rotateX(-1), p.add(a, f.frond, M(t + .15, r, n, i / 9 * Math.PI * 2 + g() * .3));
		}
		y(t, n, .3);
	}
	function ne(t, n, r, i, a, o, s) {
		let c = new e.Color(.92, .92, .88);
		for (let e = -o + .5; e < o - .4; e += 1) {
			let o = (e, t) => [
				n + i * e - a * t,
				.075,
				r + a * e + i * t
			];
			t.quad(o(-s / 2, e), o(-s / 2, e + .5), o(s / 2, e + .5), o(s / 2, e), [0, 0], [0, 0], [0, 0], [0, 0], c, [
				0,
				1,
				0
			]);
		}
	}
	let re = new u(), ie = new u(), ce = ([e, t]) => i.byKey.get(`${Math.round(e * 2)},${Math.round(t * 2)}`), F = 0;
	for (let e of t.roads.filter(ee)) {
		let t = new j(e.pts), n = [];
		for (let e = 5; e < t.len; e += 7) {
			let [r, i, o, s] = t.at(e);
			for (let e of [-1, 1]) {
				let t = 4;
				for (; t < 10 && !a.isBlocked(r - s * e * t, i + o * e * t, .2);) t += .5;
				n.push(t);
			}
		}
		n.sort((e, t) => e - t);
		let r = Math.max(4, Math.min(8, n[Math.floor(n.length * .3)] ?? 4) - .2), i = [];
		for (let n = 0; n < e.pts.length; n++) {
			let a = ce(e.pts[n]);
			if (!a) continue;
			let o = 0, s = 0, c = 0;
			for (let [t, n] of a.links) if (n !== e && n.kind !== "footway" && n.kind !== "pedestrian" && n.w / 2 > o) {
				o = n.w / 2;
				let e = Math.hypot(t.x - a.x, t.z - a.z) || 1;
				s = (t.x - a.x) / e, c = (t.z - a.z) / e;
			}
			o && (i.push({
				s: t.d[n],
				cw: o
			}), ne(ie, a.x, a.z, s, c, o, Math.min(2 * r - 1, 6)));
		}
		let s = [], c = {
			s: 0,
			cw: 0
		};
		for (let e of [...i, {
			s: t.len,
			cw: 0
		}]) e.s - c.s > 1 && s.push([
			c.s + c.cw + (c.cw ? .3 : 0),
			e.s - e.cw - (e.cw ? .3 : 0),
			!!c.cw,
			!!e.cw
		]), c = e;
		for (let [e, n, i, a] of s) {
			let s = t.sub(e, n);
			if (!s) continue;
			o(re, s, r * 2, .14, 1 / 6);
			for (let [o, s] of [[e + .6, i], [n - .6, a]]) {
				if (!s) continue;
				let [e, n, i, a] = t.at(o);
				for (let t = -r + .8; t <= r - .7; t += 1.5) D(e - a * t, n + i * t);
			}
			let c = 0;
			for (let r = e + 6; r < n - 5; r += 8, c++) {
				let [i, a, o, s] = t.at(r), u = Math.atan2(-s, o), d = c % 4;
				d === 0 || d === 2 ? S(i, a, u) : d === 1 ? F < 3 && n - e > 50 && c === 5 ? (O(i, a, u, F === 2), F++) : (C(i - s * .35, a + o * .35, u), C(i + s * .35, a - o * .35, u + Math.PI)) : (T(i, a, u + Math.PI / 2), E(i + o * 1.2 - s * .6, a + s * 1.2 + o * .6)), l.push([
					i,
					a,
					2.5
				]);
			}
		}
	}
	function I(t) {
		let n = (e, n) => [t.cx + t.ux * e - t.uz * n, t.cz + t.uz * e + t.ux * n], r = t.houseSide > 0 ? 1 : -1, o = r > 0 ? t.hi + 1.7 + 6.5 + 5.5 : t.lo - 1.7 - 6.5 - 5.5, s = null;
		for (let e = o + r * 6; Math.abs(e - o) < 70; e += r) {
			let [t, r] = n(0, e), a = i.nearest(t, r, 20);
			if (a && a.seg.road.kind !== "footway" && a.seg.road.kind !== "pedestrian" && a.dist < a.seg.road.w / 2 + 3.5) {
				s = {
					v: e,
					road: a.seg.road
				};
				break;
			}
		}
		if (!s) return;
		let c = Math.atan2(-t.uz, t.ux), u = s.v - r * 1.8, d = [
			[
				-28,
				"stall",
				f.tarpBlue
			],
			[
				-22,
				"stall",
				f.tarpRed
			],
			[-16, "chori"],
			[
				16,
				"stall",
				f.tarpGreen
			],
			[
				22,
				"stall",
				f.tarpBlue
			],
			[
				28,
				"stall",
				f.tarpRed
			]
		];
		for (let [e, t, r] of d) {
			let [i, o] = n(e, u);
			a.isBlocked(i, o, 1.3) || (t === "chori" ? A(i, o, c) : k(i, o, c, r), l.push([
				i,
				o,
				2.5
			]));
		}
		let [g, _] = n(-8, s.v - r * .6);
		p.add(P(.04, .04, 2.6, 6), f.iron, M(g, 0, _)), p.add(new e.PlaneGeometry(1.3, .26), f.taxi, M(g, 2.45, _, c)), p.add(new e.PlaneGeometry(1.3, .26), f.taxi, M(g, 2.45, _, c + Math.PI)), y(g, _, .1);
		let v = Math.abs(s.v - o) - 5;
		if (v > 2) {
			let t = new e.PlaneGeometry(60, v).rotateX(-Math.PI / 2), i = t.attributes.uv;
			for (let e = 0; e < i.count; e++) i.setXY(e, i.getX(e) * 10, i.getY(e) * 3);
			let [a, l] = n(0, (o + r * 5 + s.v - r * 3.2) / 2);
			m.add(t, h, M(a, .14, l, c));
		}
		for (let e of [
			-24,
			-8,
			8,
			24
		]) {
			let [t, r] = n(e, (o + s.v) / 2);
			a.isBlocked(t, r, 1) || (T(t, r, c), C(t + Math.sin(c) * 1.5, r + Math.cos(c) * 1.5, c));
		}
	}
	let L = (t.specials || []).filter((e) => e.type === "station" && /quilmes|bernal/i.test(e.name || ""));
	for (let e of L) I(e);
	let R = [
		0,
		1,
		2
	].map((t) => new e.MeshStandardMaterial({
		map: se(t),
		roughness: 1
	}));
	function z(t, n, r) {
		let i = Math.cos(r), a = Math.sin(r), o = (e, r) => [t + i * e + a * r, n - a * e + i * r], s = new e.PlaneGeometry(9, 7).rotateX(-Math.PI / 2);
		p.add(s, f.sand, M(t, .16, n, r));
		for (let [e, t, n, i] of [
			[
				0,
				-3.5,
				9,
				.2
			],
			[
				0,
				3.5,
				9,
				.2
			],
			[
				-4.5,
				0,
				.2,
				7
			],
			[
				4.5,
				0,
				.2,
				7
			]
		]) {
			let [a, s] = o(e, t);
			p.add(N(n, .3, i), f.concrete, M(a, 0, s, r));
		}
		{
			let [t, n] = o(-2, -1.5);
			for (let o of [-1.7, 1.7]) for (let s of [-.25, .25]) {
				let c = new e.CylinderGeometry(.05, .05, 2.6, 6).translate(0, 1.3, 0).rotateX(s);
				p.add(c, f.red, M(t + i * o, 0, n - a * o, r));
			}
			p.add(new e.CylinderGeometry(.06, .06, 3.5, 6).rotateZ(Math.PI / 2).translate(0, 2.5, 0), f.red, M(t, 0, n, r));
			for (let o of [-.8, .8]) {
				for (let s of [-.22, .22]) p.add(new e.CylinderGeometry(.01, .01, 2, 4).translate(0, 1.5, 0), f.iron, M(t + i * (o + s), 0, n - a * (o + s), r));
				p.add(N(.5, .05, .25), f.yellow, M(t + i * o, .45, n - a * o, r));
			}
			b(t, n, r, 1.8, .5);
		}
		{
			let [t, n] = o(2.5, -1.2);
			p.add(N(.9, .06, .9), f.blue, M(t, 1.6, n, r));
			for (let [e, r] of [
				[-.4, -.4],
				[.4, -.4],
				[-.4, .4],
				[.4, .4]
			]) p.add(P(.04, .04, 1.6, 5), f.iron, M(t + i * e + a * r, 0, n - a * e + i * r));
			let s = new e.BoxGeometry(2.6, .06, .6).rotateZ(-.62);
			p.add(s, f.yellow, M(t + i * 1.5, .8, n - a * 1.5, r));
			for (let e = 0; e < 4; e++) p.add(N(.6, .04, .06), f.iron, M(t - i * .55, .35 + e * .38, n + a * .55, r));
			b(t + i * .6, n - a * .6, r, 1.4, .5);
		}
		{
			let [t, n] = o(0, 2.2);
			p.add(N(.2, .5, .3), f.iron, M(t, 0, n, r)), p.add(new e.BoxGeometry(3.2, .08, .3).rotateZ(.14).translate(0, .55, 0), f.blue, M(t, 0, n, r)), b(t, n, r, 1.6, .25);
		}
	}
	function B(t, n, r) {
		p.add(P(1.2, 1.4, .6, 16), f.concrete, M(t, 0, n)), p.add(P(.07, .12, 14, 8), f.white, M(t, .6, n)), p.add(new e.PlaneGeometry(3, 2).translate(1.5, 0, 0), f.flag, M(t, 13.4, n, r + .6)), y(t, n, 1.3), l.push([
			t,
			n,
			3
		]);
	}
	function V(t, { palms: n = !1, kids: r = !1 } = {}) {
		let i = t.box, o = (e, t) => [i.cx + i.ux * e - i.uz * t, i.cz + i.uz * e + i.ux * t], s = Math.atan2(-i.uz, i.ux), c = i.hu - 3, u = i.hv - 3, d = Math.atan2(u, c), m = [
			0,
			d,
			Math.PI / 2,
			Math.PI - d,
			Math.PI,
			Math.PI + d,
			Math.PI * 1.5,
			Math.PI * 2 - d,
			Math.PI * 2
		], h = Math.min(15, u * .6);
		for (let t = 0; t < 8; t++) {
			let n = (m[t] + m[t + 1]) / 2, r = Math.min(2.6, h * (m[t + 1] - m[t]) * .3);
			if (r < 1) continue;
			let [i, a] = o(Math.cos(n) * h, Math.sin(n) * h);
			p.add(new e.CircleGeometry(r, 20).rotateX(-Math.PI / 2), R[t % 3], M(i, .22, a)), p.add(new e.CylinderGeometry(r + .1, r + .15, .22, 20, 1, !0).translate(0, .11, 0), f.concrete, M(i, 0, a)), l.push([
				i,
				a,
				r + .5
			]);
		}
		if (n) {
			let e = [];
			for (let t of [
				-.75,
				-.4,
				.4,
				.75
			]) e.push([t * c, 3.2], [t * c, -3.2]);
			for (let t of [-.55, .55]) e.push([3.2, t * u], [-3.2, t * u]);
			for (let [t, n] of e) {
				let [e, r] = o(t, n);
				te(e, r, 7 + g() * 3), l.push([
					e,
					r,
					2
				]);
			}
		}
		if (r) {
			let [e, t] = o(-.68 * c, .5 * (u * .68 + 1.5));
			z(e, t, s), l.push([
				e,
				t,
				6.5
			]);
		}
		let [_, v] = o(c - 8, 4.5);
		B(_, v, s);
		for (let e = -c + 6; e <= c - 6; e += 14) for (let t of [-u - 1.8, u + 1.8]) {
			let [n, r] = o(e, t);
			a.isBlocked(n, r, .4) || T(n, r, s);
		}
		for (let e = -u + 6; e <= u - 6; e += 14) for (let t of [-c - 1.8, c + 1.8]) {
			let [n, r] = o(t, e);
			a.isBlocked(n, r, .4) || T(n, r, s + Math.PI / 2);
		}
	}
	let H = (e) => (t.specials || []).find((t) => t.type === "plaza" && e.test(t.name || ""));
	H(/san mart/i) && V(H(/san mart/i), { palms: !0 }), H(/f[ée]lix bernal/i) && V(H(/f[ée]lix bernal/i), { kids: !0 });
	let U = L.map((e) => [e.cx, e.cz]), W = /^(cafe|restaurant|pub|bar|ice_cream|fast_food)$/, G = new e.SphereGeometry(.06, 6, 4);
	for (let n of t.shops || []) {
		if (!W.test(n.kind) || !U.some(([e, t]) => Math.hypot(n.x - e, n.z - t) < 650)) continue;
		let t = i.nearest(n.x, n.z, 35);
		if (!t || t.seg.road.kind === "footway" || t.seg.road.kind === "pedestrian" || t.seg.road.pasillo) continue;
		let { a: r, b: o, road: s } = t.seg, c = Math.hypot(o.x - r.x, o.z - r.z) || 1, u = (o.x - r.x) / c, d = (o.z - r.z) / c, m = Math.max(0, Math.min(c, (n.x - r.x) * u + (n.z - r.z) * d)), h = (n.x - r.x) * -d + (n.z - r.z) * u > 0 ? 1 : -1, g = s.w / 2 + 1.5, _ = Math.atan2(-d, u), v = /pub|bar/.test(n.kind), b = [];
		for (let t of [
			-1,
			0,
			1
		]) {
			let n = m + t * 2.8;
			if (n < 4 || n > c - 4) continue;
			let i = r.x + u * n - d * g * h, o = r.z + d * n + u * g * h;
			if (!a.isBlocked(i, o, .9)) {
				p.add(P(.05, .05, .72, 6), f.iron, M(i, 0, o)), p.add(P(.42, .42, .04, 14), f.tableTop, M(i, .72, o));
				for (let e of [-.65, .65]) {
					let t = i + u * e, n = o + d * e;
					p.add(N(.42, .04, .42), f.chair, M(t, .45, n, _)), p.add(N(.04, .45, .42), f.chair, M(t + u * Math.sign(e) * .2, .45, n + d * Math.sign(e) * .2, _));
					for (let e of [-.18, .18]) p.add(P(.015, .015, .45, 4), f.iron, M(t + u * e, 0, n + d * e));
				}
				v || (p.add(P(.025, .025, 2.3, 5), f.white, M(i, 0, o)), p.add(new e.ConeGeometry(1.25, .45, 8, 1, !0).translate(0, 2.35, 0), [
					f.tarpRed,
					f.tarpGreen,
					f.tarpBlue
				][b.length % 3], M(i, 0, o))), y(i, o, .75), l.push([
					i,
					o,
					1.5
				]), b.push([i, o]);
			}
		}
		if (v && b.length >= 2) {
			let [e, t] = [b[0], b[b.length - 1]], n = [e[0] - u * 1.4, e[1] - d * 1.4], r = [t[0] + u * 1.4, t[1] + d * 1.4];
			for (let e of [n, r]) p.add(P(.03, .03, 2.9, 5), f.iron, M(e[0], 0, e[1]));
			for (let e = 0; e <= 12; e++) {
				let t = e / 12;
				p.add(G, f.bulb, M(n[0] + (r[0] - n[0]) * t, 2.85 - Math.sin(t * Math.PI) * .35, n[1] + (r[1] - n[1]) * t));
			}
		}
	}
	for (let t of i.nodes) {
		if (t.degree < 3 || !U.some(([e, n]) => Math.hypot(t.x - e, t.z - n) < 500) || (t.id * 2654435761 >>> 0) % 5 > 1) continue;
		let n = [...t.links].filter(([, e]) => e.kind === "residential" || e.kind === "secondary" || e.kind === "tertiary");
		if (!n.length) continue;
		let r = 0;
		for (let e of t.roads) r = Math.max(r, e.w);
		let [i, o] = n[0], s = Math.hypot(i.x - t.x, i.z - t.z), c = r / 2 + 9;
		if (s < c + 6) continue;
		let u = (i.x - t.x) / s, d = (i.z - t.z) / s, m = o.w / 2 + 1.1, h = t.x + u * c - d * m, g = t.z + d * c + u * m;
		if (a.isBlocked(h, g, 1)) continue;
		let _ = Math.atan2(-d, u);
		p.add(N(1.8, 1.15, 1.2), f.dumpster, M(h, .12, g, _)), p.add(new e.BoxGeometry(1.86, .08, 1.3).rotateX(-.1).translate(0, 1.32, 0), f.dumpsterLid, M(h, 0, g, _));
		for (let [e, t] of [
			[-.75, -.45],
			[.75, -.45],
			[-.75, .45],
			[.75, .45]
		]) p.add(P(.07, .07, .12, 6), f.iron, M(h + Math.cos(_) * e + Math.sin(_) * t, 0, g - Math.sin(_) * e + Math.cos(_) * t));
		b(h, g, _, .95, .65), l.push([
			h,
			g,
			1.8
		]);
	}
	if (re.pos.length) {
		let t = new e.Mesh(re.geometry(), h);
		t.receiveShadow = !0, t.renderOrder = -6.5, r.add(t);
	}
	if (ie.pos.length) {
		let t = new e.Mesh(ie.geometry(), s(null, 16777215, { vertexColors: !0 }));
		t.renderOrder = -5.8, r.add(t);
	}
	return m.build(r, {
		cast: !1,
		order: -6.5
	}), p.build(r), {
		lamps: w,
		setNight(e) {
			f.lamp.emissiveIntensity = e * 2.5, f.bulb.emissiveIntensity = e * 3;
		}
	};
}
//#endregion
//#region src/world/roadGraph.js
var F = class {
	constructor(e) {
		this.nodes = [], this.edges = [], this.byKey = /* @__PURE__ */ new Map(), this.segIndex = new o(40);
		for (let t of e) {
			let e = t.kind !== "footway" && !t.noCars;
			for (let n = 0; n < t.pts.length - 1; n++) {
				let r = this.node(t.pts[n]), i = this.node(t.pts[n + 1]);
				if (r === i) continue;
				r.roads.add(t), i.roads.add(t), r.neighbors.add(i), i.neighbors.add(r), r.links.set(i, t), i.links.set(r, t);
				let a = {
					a: r,
					b: i,
					road: t
				};
				this.segIndex.insert(a, {
					minX: Math.min(r.x, i.x) - t.w,
					maxX: Math.max(r.x, i.x) + t.w,
					minZ: Math.min(r.z, i.z) - t.w,
					maxZ: Math.max(r.z, i.z) + t.w
				}), e && (this.edge(r, i, t), t.oneway || this.edge(i, r, t));
			}
		}
		for (let e of this.nodes) e.degree = e.neighbors.size;
	}
	node([e, t]) {
		let n = `${Math.round(e * 2)},${Math.round(t * 2)}`, r = this.byKey.get(n);
		return r || (r = {
			id: this.nodes.length,
			x: e,
			z: t,
			out: [],
			roads: /* @__PURE__ */ new Set(),
			neighbors: /* @__PURE__ */ new Set(),
			links: /* @__PURE__ */ new Map()
		}, this.byKey.set(n, r), this.nodes.push(r)), r;
	}
	edge(e, t, n) {
		let r = t.x - e.x, i = t.z - e.z, a = Math.hypot(r, i), o = {
			id: this.edges.length,
			a: e,
			b: t,
			road: n,
			len: a,
			dx: r / a,
			dz: i / a
		};
		return this.edges.push(o), e.out.push(o), o;
	}
	nearest(e, t, n = 30) {
		let r = this.segIndex.query(e - n, t - n, e + n, t + n), a = null, o = n * n;
		for (let n of r) {
			let [r, s, c, l] = i(e, t, n.a.x, n.a.z, n.b.x, n.b.z);
			l < o && (o = l, a = {
				seg: n,
				x: r,
				z: s,
				t: c,
				dist: Math.sqrt(l)
			});
		}
		return a;
	}
	nearestEdge(e, t, n = 60) {
		let r = this.nearest(e, t, n);
		if (!r) return null;
		let { a: i, b: a } = r.seg;
		return i.out.find((e) => e.b === a) || a.out.find((e) => e.b === i) || null;
	}
	nearestNode(e, t, n = 150) {
		let r = this.nearest(e, t, n);
		if (!r) return null;
		let { a: i, b: a } = r.seg;
		return Math.hypot(i.x - e, i.z - t) < Math.hypot(a.x - e, a.z - t) ? i : a;
	}
	path(e, t, n = 4e3, r = !1) {
		if (!e || !t) return null;
		let i = /* @__PURE__ */ new Map([[e, 0]]), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = [[Math.hypot(e.x - t.x, e.z - t.z), e]], c = (e) => {
			s.push(e);
			for (let e = s.length - 1; e > 0;) {
				let t = e - 1 >> 1;
				if (s[t][0] <= s[e][0]) break;
				[s[t], s[e]] = [s[e], s[t]], e = t;
			}
		}, l = () => {
			let e = s[0], t = s.pop();
			if (s.length) {
				s[0] = t;
				for (let e = 0;;) {
					let t = e * 2 + 1, n = t + 1, r = e;
					if (t < s.length && s[t][0] < s[r][0] && (r = t), n < s.length && s[n][0] < s[r][0] && (r = n), r === e) break;
					[s[r], s[e]] = [s[e], s[r]], e = r;
				}
			}
			return e[1];
		};
		for (; s.length && o.size < n;) {
			let e = l();
			if (o.has(e)) continue;
			if (e === t) break;
			o.add(e);
			let n = r ? e.out.map((e) => e.b) : e.neighbors;
			for (let o of n) {
				if (!r && e.links.get(o)?.kind === "footway") continue;
				let n = i.get(e) + Math.hypot(o.x - e.x, o.z - e.z);
				n < (i.get(o) ?? Infinity) && (i.set(o, n), a.set(o, e), c([n + Math.hypot(o.x - t.x, o.z - t.z), o]));
			}
		}
		if (!a.has(t) && e !== t) return null;
		let u = [t];
		for (; u[0] !== e;) u.unshift(a.get(u[0]));
		return u;
	}
	randomEdgeNear(e, t, n, r, i) {
		let a = [...this.segIndex.query(e - n, t - n, e + n, t + n)];
		for (let e = 0; e < 40 && a.length; e++) {
			let e = a[Math.floor(r() * a.length)], t = e.a.out.filter((t) => t.b === e.b).concat(e.b.out.filter((t) => t.b === e.a)), n = t[Math.floor(r() * t.length)];
			if (n && n.len > 20 && (!i || i(n))) return n;
		}
		return null;
	}
	randomEdge(e, t) {
		for (let n = 0; n < 200; n++) {
			let n = this.edges[Math.floor(e() * this.edges.length)];
			if (n && n.len > 20 && (!t || t(n))) return n;
		}
		return this.edges[0];
	}
}, I = 256;
function L(e = I, t = I) {
	let n = document.createElement("canvas");
	return n.width = e, n.height = t, [n, n.getContext("2d", { willReadFrequently: !0 })];
}
function R(e, t, n, r, i, a = .08, o = 0, s = 0) {
	for (let c = 0; c < r; c++) {
		let r = Math.floor(i() * 255);
		e.fillStyle = `rgba(${r},${r},${r},${a})`, e.fillRect(o + i() * t, s + i() * n, 1 + i() * 3, 1 + i() * 3);
	}
}
function z(e, t, n, r, i, a) {
	let o = e.createRadialGradient(n, r, 0, n, r, i);
	o.addColorStop(0, a), o.addColorStop(1, "rgba(0,0,0,0)"), e.fillStyle = o, e.beginPath(), e.ellipse(n, r, i, i * (.5 + t() * .8), t() * 3, 0, Math.PI * 2), e.fill();
}
function B(e, t, n, r, i = 6) {
	for (let a = 0; a < i; a++) z(e, t, t() * n, r - t() * 20, 20 + t() * 40, `rgba(70,60,45,${.12 + t() * .12})`);
	for (let a = 0; a < i * 2; a++) {
		let i = t() * n, a = t() * r, o = 10 + t() * 40, s = e.createLinearGradient(i, a, i, a + o);
		s.addColorStop(0, "rgba(50,45,35,0.18)"), s.addColorStop(1, "rgba(50,45,35,0)"), e.fillStyle = s, e.fillRect(i, a, 2 + t() * 4, o);
	}
}
function V(e, t, n, r, i = 4) {
	e.strokeStyle = "rgba(40,35,30,0.35)", e.lineWidth = 1;
	for (let a = 0; a < i; a++) {
		let i = t() * n, a = t() * r;
		e.beginPath(), e.moveTo(i, a);
		for (let n = 0; n < 6; n++) e.lineTo(i += (t() - .5) * 14, a += 3 + t() * 8);
		e.stroke();
	}
}
function H(e, t, n, r, i, a, o = 14, s = 8) {
	e.fillStyle = "#9d968a", e.fillRect(n, r, i, a);
	for (let c = r; c < r + a; c += s) {
		let a = (c - r) / s % 2 ? o / 2 : 0;
		for (let r = n - o; r < n + i; r += o) {
			let n = 42 + t() * 14;
			if (e.fillStyle = `hsl(${13 + t() * 9},${50 + t() * 18}%,${n}%)`, e.fillRect(r + a + 1.2, c + 1.2, o - 2, s - 2), t() < .015) {
				e.fillStyle = "rgba(40,20,10,0.45)";
				for (let t = 0; t < 3; t++) e.fillRect(r + a + 2 + t * 4, c + 2.5, 2.5, s - 5);
			}
		}
	}
	e.fillStyle = "rgba(160,154,142,0.7)";
	for (let o = 0; o < i * a / 60; o++) e.fillRect(n + t() * i, r + Math.floor(t() * (a / s)) * s - 1, 2 + t() * 5, 2 + t() * 1.5);
}
function U(e, t, n, r, i, a) {
	e.fillStyle = `hsl(40,${4 + t() * 5}%,${58 + t() * 8}%)`, e.fillRect(n, r, i, a), R(e, i, a, i * a / 12, t, .14, n, r), e.fillStyle = "rgba(0,0,0,0.12)", e.fillRect(n, r + a - 2, i, 2);
}
function W(e, t, n, r, i, a, o) {
	if (a) e.fillStyle = o() < .8 ? `hsl(${34 + o() * 12},90%,${52 + o() * 15}%)` : `hsl(200,55%,${60 + o() * 15}%)`;
	else {
		let a = e.createLinearGradient(t, n, t + r, n + i);
		a.addColorStop(0, "#26313a"), a.addColorStop(.5, "#56697a"), a.addColorStop(1, "#222b33"), e.fillStyle = a;
	}
	e.fillRect(t, n, r, i);
}
function G(e, t, n, r, i, a = 7, o = "#1b1b1b") {
	e.fillStyle = o;
	for (let o = t + a / 2; o < t + r; o += a) e.fillRect(o, n, 2, i);
	e.fillRect(t, n, r, 2), e.fillRect(t, n + i - 2, r, 2), e.fillRect(t, n + i * .45, r, 2);
}
function K(e, t, n, r, i, a, o, s = {}) {
	if (e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(r - 3, i - 3, a + 6, o + 7), e.fillStyle = "rgba(255,255,255,0.35)", e.fillRect(r - 4, i + o + 1, a + 8, 3), W(e, r, i, a, o, !1, n), t && n() < .5 && W(t, r, i, a, o, !0, n), s.persiana ?? n() < .6) {
		let s = o * (.25 + n() * .75);
		e.fillStyle = n() < .5 ? "#b9b2a2" : "#7d6a52", e.fillRect(r, i, a, s), e.fillStyle = "rgba(0,0,0,0.25)";
		for (let t = i; t < i + s; t += 3) e.fillRect(r, t, a, 1);
		t && (t.fillStyle = "#000", t.fillRect(r, i, a, s));
	}
	(s.reja ?? !0) && G(e, r - 1, i - 1, a + 2, o + 2, 6 + n() * 3);
}
function le(e, t, n, r, i, a, o) {
	let s = n();
	if (e.fillStyle = "rgba(0,0,0,0.3)", e.fillRect(r - 3, i - 3, a + 6, o + 3), s < .45) e.fillStyle = `hsl(${22 + n() * 10},${35 + n() * 20}%,${22 + n() * 12}%)`, e.fillRect(r, i, a, o), e.strokeStyle = "rgba(0,0,0,0.35)", e.lineWidth = 2, e.strokeRect(r + 5, i + 6, a - 10, o * .4), e.strokeRect(r + 5, i + o * .52, a - 10, o * .4);
	else {
		e.fillStyle = [
			"#2e3a33",
			"#262626",
			"#4a3b2c",
			"#34404c",
			"#6b6e70"
		][Math.floor(n() * 5)], e.fillRect(r, i, a, o), W(e, r + 6, i + 8, a - 12, o * .3, !1, n), G(e, r + 6, i + 8, a - 12, o * .3, 5), e.fillStyle = "rgba(255,255,255,0.1)";
		for (let t = i + o * .45; t < i + o; t += 5) e.fillRect(r, t, a, 1);
	}
	e.fillStyle = "#c9b27a", e.fillRect(r + a - 8, i + o * .5, 4, 3), e.fillStyle = "#ddd", e.fillRect(r + a / 2 - 3, i - 12, 6, 5), t && (t.fillStyle = "#ffd890", t.fillRect(r + a / 2 - 4, i - 13, 8, 7));
}
function ue(e, t, n, r, i, a, o = t() < .4) {
	if (e.fillStyle = "rgba(0,0,0,0.3)", e.fillRect(n - 3, r - 3, i + 6, a + 3), o) {
		e.fillStyle = "#8e9296", e.fillRect(n, r, i, a), e.fillStyle = "rgba(0,0,0,0.28)";
		for (let t = r; t < r + a; t += 4) e.fillRect(n, t, i, 1.5);
	} else {
		e.fillStyle = [
			"#3d4b3f",
			"#2a2a2a",
			"#5a4632",
			"#6b6f73",
			"#3b4a5e",
			"#7a2e22"
		][Math.floor(t() * 6)], e.fillRect(n, r, i, a), e.fillStyle = "rgba(255,255,255,0.12)";
		for (let t = n + 3; t < n + i; t += 6) e.fillRect(t, r, 2, a);
		e.fillStyle = "rgba(0,0,0,0.3)", e.fillRect(n + i / 2 - 1, r, 2, a);
	}
	for (let o = 0; o < 6; o++) z(e, t, n + t() * i, r + a - t() * 12, 6 + t() * 10, "rgba(120,70,30,0.3)");
}
function de(e, t, n, r, i, a) {
	e.lineCap = "round", e.lineJoin = "round", e.strokeStyle = `hsl(${t() * 360},${60 + t() * 30}%,${35 + t() * 25}%)`, e.lineWidth = 2 + t() * 4, e.beginPath();
	let o = n, s = r + a / 2;
	e.moveTo(o, s);
	for (let n = 0; n < 8; n++) o += i / 8, e.quadraticCurveTo(o - i / 16, r + t() * a, o, r + t() * a);
	e.stroke();
}
function fe(e, t, n) {
	e.fillStyle = "#ece7dc", e.fillRect(0, 0, I, I), R(e, I, I, 4e3, t, .06), U(e, t, 0, 0, I, 10), B(e, t, I, I, 4), V(e, t, I, I, 3);
	let r = e.createLinearGradient(0, 216, 0, I);
	if (r.addColorStop(0, "rgba(90,75,50,0)"), r.addColorStop(1, "rgba(90,75,50,0.4)"), e.fillStyle = r, e.fillRect(0, 216, I, 40), n >= 1) for (let n = 0; n < 2; n++) de(e, t, t() * 180, 110 + t() * 90, 40 + t() * 60, 25 + t() * 25);
	n >= 2 && (e.font = `bold ${26 + t() * 12}px Impact, Arial Black, sans-serif`, e.textAlign = "center", e.fillStyle = `hsl(${t() < .5 ? 210 : t() * 360},65%,${30 + t() * 20}%)`, e.fillText(pe[Math.floor(t() * pe.length)], I / 2 + (t() - .5) * 60, 140 + t() * 50, 226));
}
var pe = [
	"QUILMES",
	"CERVECERO",
	"AGUANTE QAC",
	"LA BANDA",
	"TE AMO FLOR",
	"BARRIO",
	"NO TIRAR BASURA",
	"VIVA EL BARRIO",
	"MATE",
	"ARGENTINO"
];
function me(e, t) {
	e.strokeStyle = t, e.lineWidth = 10, e.strokeRect(5, 5, 246, 246);
}
function he(e, t, n, r) {
	let i = n() < .6 ? "#c7cacc" : "#f2f2ef";
	e.fillStyle = i, e.fillRect(0, 0, I, I), t.fillStyle = "#000", t.fillRect(0, 0, I, I);
	let a = [[
		14,
		14,
		I / 2 - 18,
		228
	], [
		132,
		14,
		I / 2 - 18,
		228
	]];
	for (let [n, i, o, s] of a) {
		let a = e.createLinearGradient(n, i, n + o * .4, i + s);
		a.addColorStop(0, "#8fa6b8"), a.addColorStop(.45, "#4b5c6a"), a.addColorStop(1, "#1f272e"), e.fillStyle = a, e.fillRect(n, i, o, s), e.fillStyle = "rgba(255,255,255,0.14)", e.beginPath(), e.moveTo(n + o * .2, i), e.lineTo(n + o * .45, i), e.lineTo(n + o * .05, i + s), e.lineTo(n, i + s), e.lineTo(n, i + s * .6), e.fill();
		let c = t.createLinearGradient(n, i, n, i + s);
		c.addColorStop(0, r === "closed" ? "#8a5a26" : "#d99a48"), c.addColorStop(1, r === "closed" ? "#6a4018" : "#b0702c"), t.fillStyle = c, t.fillRect(n, i, o, s);
	}
	let o = [
		"#e9dfc8",
		"#c9b48a",
		"#b9c7d0",
		"#d8b8b0",
		"#f1ece2"
	][Math.floor(n() * 5)], s = (t, n) => {
		for (let r = 0; r < n; r += 6) e.fillStyle = o, e.globalAlpha = .55, e.fillRect(t + r, 14, 4, 228), e.fillStyle = "rgba(0,0,0,0.15)", e.fillRect(t + r + 4, 14, 2, 228);
		e.globalAlpha = 1;
	};
	if (r === "closed" ? s(14, 228) : s(14, 40 + n() * 30), r === "persiana") {
		let r = 228 * (.55 + n() * .25);
		e.fillStyle = n() < .6 ? "#ece8df" : "#8a6e4e", e.fillRect(10, 10, 236, r);
		for (let t = 10; t < 10 + r; t += 7) e.fillStyle = "rgba(0,0,0,0.18)", e.fillRect(10, t, 236, 1.5), e.fillStyle = "rgba(255,255,255,0.25)", e.fillRect(10, t + 2, 236, 1);
		t.fillStyle = "#000", t.fillRect(10, 10, 236, r);
	}
	e.fillStyle = i, e.fillRect(I / 2 - 6, 8, 12, 240), e.fillStyle = "rgba(0,0,0,0.3)", e.fillRect(134, 8, 2, 240), e.fillRect(12, 240, 232, 3), e.strokeStyle = "rgba(0,0,0,0.35)", e.lineWidth = 3, e.strokeRect(2, 2, 252, 252);
}
function ge(e, t, n, r, i, a) {
	e.fillStyle = "#ddd5c6", e.fillRect(0, 0, I, I), e.fillStyle = n, e.fillRect(8, 30, 240, 196), e.fillStyle = r, e.textAlign = "center", e.textBaseline = "middle", e.font = "bold 54px Impact, Arial Black, sans-serif", e.fillText(i, I / 2, 105, 226), e.font = "bold 22px Arial, sans-serif", e.fillText(a, I / 2, 165, 226), e.fillStyle = "rgba(235,228,214,0.35)", e.fillRect(0, 0, I, I);
	for (let n = 0; n < 40; n++) {
		e.fillStyle = `rgba(221,213,198,${.5 + t() * .5})`;
		let n = t() < .5 ? t() * 30 : I - t() * 30;
		e.fillRect(n, 30 + t() * 196, 4 + t() * 12, 3 + t() * 10);
	}
	R(e, I, I, 3e3, t, .08), B(e, t, I, I, 3);
}
var _e = {
	medianera(e, t, n) {
		e.fillStyle = "#e6dfd2", e.fillRect(0, 0, I, I);
		for (let t = 0; t < 5; t++) e.fillStyle = `rgba(${200 + n() * 40},${190 + n() * 40},${170 + n() * 40},0.5)`, e.fillRect(n() * I, n() * I, 30 + n() * 80, 20 + n() * 60);
		R(e, I, I, 5e3, n, .07), B(e, n, I, I, 4);
		for (let t = 0; t < 2; t++) z(e, n, n() * I, n() * I * .6, 25 + n() * 30, "rgba(90,85,70,0.1)");
		V(e, n, I, I, 4);
		let r = 40 + n() * 156, i = 40 + n() * 156;
		e.save(), e.beginPath(), e.moveTo(r, i);
		for (let t = 0; t < 9; t++) e.lineTo(r + (n() - .3) * 40, i + (n() - .3) * 24);
		e.closePath(), e.clip(), H(e, n, r - 20, i - 12, 70, 50), e.restore(), e.fillStyle = "rgba(0,0,0,0.1)", e.fillRect(0, 0, I, 4);
	},
	medianeraLadrillo(e, t, n) {
		H(e, n, 0, 0, I, I);
		for (let t of [0, I / 2]) U(e, n, 0, t, I, 9);
		for (let t of [0, I / 2]) U(e, n, t, 0, 9, I);
		B(e, n, I, I, 4);
	},
	hueco(e, t, n) {
		H(e, n, 0, 0, I, I);
		for (let t of [0, I / 2]) U(e, n, 0, t, I, 10);
		for (let t of [0, I / 2]) U(e, n, t - 1, 0, 10, I);
		for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) {
			let a = i * 128, o = r * 128, s = n();
			if (r === 1 && i === 0) {
				e.fillStyle = [
					"#5d6f7c",
					"#6e5a48",
					"#3c4c3c",
					"#7b7f82"
				][Math.floor(n() * 4)], e.fillRect(a + 40, o + 36, 38, 82), e.fillStyle = "rgba(0,0,0,0.25)";
				for (let t = a + 42; t < a + 78; t += 5) e.fillRect(t, o + 36, 1.5, 82);
				z(e, n, a + 60, o + 112, 16, "rgba(120,70,30,0.35)");
				continue;
			}
			if (s < .15) continue;
			let c = a + 34 + n() * 20, l = o + 34, u = 40 + n() * 14, d = 36 + n() * 8;
			if (U(e, n, c - 4, l - 5, u + 8, 5), s < .3) {
				e.fillStyle = n() < .5 ? "#2f5f9e" : `hsl(${n() * 360},40%,40%)`, e.fillRect(c, l, u, d), e.fillStyle = "rgba(0,0,0,0.25)";
				for (let t = 0; t < 4; t++) e.fillRect(c + n() * u, l, 1.5, d);
			} else W(e, c, l, u, d, !1, n), n() < .45 && W(t, c, l, u, d, !0, n), e.strokeStyle = s < .7 ? "#b8bcbf" : "#2a2a2a", e.lineWidth = 3, e.strokeRect(c, l, u, d), e.beginPath(), e.moveTo(c + u / 2, l), e.lineTo(c + u / 2, l + d), e.stroke(), n() < .5 && G(e, c, l, u, d, 7);
		}
		B(e, n, I, I, 4);
	},
	villa(e, t, n) {
		e.fillStyle = "#ece8e0", e.fillRect(0, 0, I, I), R(e, I, I, 6e3, n, .1);
		for (let t = 0; t < 4; t++) {
			let t = n() * 196, r = n() * 206, i = 25 + n() * 45, a = 15 + n() * 30;
			e.save(), e.beginPath(), e.moveTo(t, r + a * n());
			for (let o = 0; o < 7; o++) e.lineTo(t + i * n(), r + a * n());
			e.closePath(), e.clip(), H(e, n, t, r, i, a), e.restore();
		}
		for (let t of [I / 2 - 8, 248]) e.fillStyle = "rgba(0,0,0,0.12)", e.fillRect(0, t, I, 8);
		for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) {
			let a = i * 128, o = r * 128;
			if (r === 1 && i === 1) {
				e.fillStyle = [
					"#5d6f7c",
					"#6e5a48",
					"#2d2d2d",
					"#8a3a2a"
				][Math.floor(n() * 4)], e.fillRect(a + 44, o + 40, 38, 80), e.fillStyle = "rgba(255,255,255,0.12)";
				for (let t = o + 44; t < o + 120; t += 6) e.fillRect(a + 44, t, 38, 1);
				continue;
			}
			n() < .2 || K(e, t, n, a + 36 + n() * 20, o + 38, 40 + n() * 10, 36, { persiana: n() < .3 });
		}
		for (let t of [I / 2, I]) {
			let n = e.createLinearGradient(0, t - 26, 0, t);
			n.addColorStop(0, "rgba(90,70,45,0)"), n.addColorStop(1, "rgba(90,70,45,0.45)"), e.fillStyle = n, e.fillRect(0, t - 26, I, 26);
		}
		B(e, n, I, I, 3);
	},
	muro0: (e, t, n) => fe(e, n, 2),
	muro1: (e, t, n) => fe(e, n, 1),
	muro2: (e, t, n) => fe(e, n, 0),
	revoque(e, t, n) {
		e.fillStyle = "#efe9de", e.fillRect(0, 0, I, I);
		for (let t = 0; t < 6; t++) z(e, n, n() * I, n() * I, 30 + n() * 60, `rgba(${n() < .5 ? "255,255,255" : "180,170,150"},0.12)`);
		R(e, I, I, 7e3, n, .05);
		for (let t = 0; t < 4; t++) {
			let t = n() * I, r = 20 + n() * 50, i = e.createLinearGradient(0, I * .3, 0, I * .3 + r);
			i.addColorStop(0, "rgba(60,55,45,0.1)"), i.addColorStop(1, "rgba(60,55,45,0)"), e.fillStyle = i, e.fillRect(t, I * .3, 2 + n() * 3, r);
		}
		let r = e.createLinearGradient(0, 226, 0, I);
		r.addColorStop(0, "rgba(80,70,50,0)"), r.addColorStop(1, "rgba(80,70,50,0.25)"), e.fillStyle = r, e.fillRect(0, 226, I, 30);
	},
	ventana: (e, t, n) => he(e, t, n, "open"),
	ventanaCortina: (e, t, n) => he(e, t, n, "closed"),
	ventanaPersiana: (e, t, n) => he(e, t, n, "persiana"),
	puerta0(e, t, n) {
		e.fillStyle = "#5e3a22", e.fillRect(0, 0, I, I);
		for (let t = 0; t < I; t += 4) e.fillStyle = `rgba(${n() < .5 ? "255,220,180" : "30,15,5"},${.04 + n() * .06})`, e.fillRect(t, 0, 2 + n() * 3, I);
		e.strokeStyle = "rgba(25,12,4,0.6)", e.lineWidth = 3;
		for (let [t, n, r, i] of [
			[
				30,
				24,
				196,
				70
			],
			[
				30,
				112,
				90,
				120
			],
			[
				136,
				112,
				90,
				120
			]
		]) e.strokeRect(t, n, r, i);
		W(e, 44, 34, 168, 50, !1, n), W(t, 44, 34, 168, 50, !0, n), G(e, 44, 34, 168, 50, 14, "#20180f"), e.fillStyle = "#c9a646", e.fillRect(196, 128, 18, 6), e.fillRect(204, 140, 5, 10), me(e, "#3a2414");
	},
	puerta1(e, t, n) {
		e.fillStyle = "#e8e8e8", e.fillRect(0, 0, I, I);
		for (let [t, n, r, i] of [[
			26,
			140,
			92,
			96
		], [
			138,
			140,
			92,
			96
		]]) {
			let a = e.createLinearGradient(t, n, t + r, n + i);
			a.addColorStop(0, "rgba(255,255,255,0.5)"), a.addColorStop(1, "rgba(0,0,0,0.25)"), e.fillStyle = a, e.fillRect(t, n, r, i);
		}
		W(e, 30, 20, 196, 100, !1, n), W(t, 30, 20, 196, 100, !0, n), e.strokeStyle = "#1b1b1b", e.lineWidth = 3;
		for (let t = 40; t < 226; t += 16) e.beginPath(), e.moveTo(t, 20), e.lineTo(t, 120), e.stroke();
		for (let t = 48; t < 220; t += 32) e.beginPath(), e.arc(t, 70, 9, 0, Math.PI * 2), e.stroke();
		e.fillStyle = "#777", e.fillRect(200, 132, 16, 8), R(e, I, I, 1500, n, .05);
		for (let t = 0; t < 4; t++) z(e, n, n() * I, I - n() * 30, 10 + n() * 14, "rgba(110,70,30,0.3)");
		me(e, "#2a2a2a");
	},
	portal(e, t, n) {
		e.fillStyle = "#4a3a28", e.fillRect(0, 0, I, I), t.fillStyle = "#000", t.fillRect(0, 0, I, I);
		for (let n of [14, 132]) {
			let r = e.createLinearGradient(n, 14, n + 60, I);
			r.addColorStop(0, "#7f93a3"), r.addColorStop(.5, "#3a4752"), r.addColorStop(1, "#232b31"), e.fillStyle = r, e.fillRect(n, 14, I / 2 - 18, 216), t.fillStyle = "#e8d2a0", t.fillRect(n, 14, I / 2 - 18, 216), e.fillStyle = "rgba(255,255,255,0.12)", e.fillRect(n + 10, 14, 18, 216), e.fillStyle = "rgba(30,25,20,0.5)", e.fillRect(n + 20, 166, 40, 64);
		}
		e.fillStyle = "#c9a646", e.fillRect(I / 2 - 16, I / 2, 6, 40), e.fillRect(138, I / 2, 6, 40), e.fillStyle = "#3a2c1e", e.fillRect(0, 230, I, 26);
	},
	pub0: (e, t, n) => ge(e, n, "#c62828", "#fff4d6", "MUDANZAS", "Y FLETES · 4253-1180"),
	pub1: (e, t, n) => ge(e, n, "#1f4e8c", "#ffffff", "PINTURERÍA", "EL PINCEL · DESDE 1978"),
	pub2: (e, t, n) => ge(e, n, "#f2c200", "#1b1b1b", "GOMERÍA", "24 HS · AUXILIO"),
	huella(e, t, n) {
		e.fillStyle = "#e2dacb", e.fillRect(0, 0, I, I), R(e, I, I, 5e3, n, .07);
		let r = [
			"#c9d6c2",
			"#e8c9a8",
			"#b9c9d8",
			"#e6d79a",
			"#d8b4b4"
		];
		e.fillStyle = r[Math.floor(n() * r.length)], e.globalAlpha = .7, e.fillRect(10, 120, 110, 136), e.fillStyle = r[Math.floor(n() * r.length)], e.fillRect(130, 140, 116, 116), e.globalAlpha = 1;
		for (let t = 170; t < 236; t += 9) for (let n = 140; n < 230; n += 9) e.fillStyle = (n + t) % 18 ? "#f4f6f6" : "#9cc7d8", e.fillRect(n, t, 8, 8);
		e.strokeStyle = "rgba(70,60,50,0.5)", e.lineWidth = 7, e.beginPath(), e.moveTo(4, 120), e.lineTo(128, 60), e.lineTo(252, 120), e.stroke(), e.lineWidth = 5, e.beginPath(), e.moveTo(20, 256);
		for (let t = 0; t < 8; t++) e.lineTo(20 + t * 12, 256 - t * 14), e.lineTo(32 + t * 12, 256 - t * 14);
		e.stroke(), B(e, n, I, I, 4), V(e, n, I, I, 3);
	},
	porton(e, t, n) {
		e.fillStyle = "#9a9a98", e.fillRect(0, 0, I, I);
		for (let t = 0; t < I; t += 10) {
			let n = e.createLinearGradient(t, 0, t + 10, 0);
			n.addColorStop(0, "rgba(255,255,255,0.18)"), n.addColorStop(.5, "rgba(0,0,0,0.05)"), n.addColorStop(1, "rgba(0,0,0,0.22)"), e.fillStyle = n, e.fillRect(t, 0, 10, I);
		}
		e.strokeStyle = "#3a3a3a", e.lineWidth = 8, e.strokeRect(4, 4, 248, 248), e.fillRect(I / 2 - 2, 0, 4, I), e.fillStyle = "#3a3a3a", e.fillRect(I / 2 - 3, 0, 6, I), e.fillStyle = "#d8c070", e.fillRect(136, I / 2, 10, 5);
		for (let t = 0; t < 8; t++) z(e, n, n() * I, I - n() * 50, 8 + n() * 16, "rgba(120,65,25,0.35)");
		n() < .6 && de(e, n, 30 + n() * 60, 100 + n() * 60, 100 + n() * 60, 40);
	},
	roofMembrana(e, t, n) {
		e.fillStyle = "#b9bbb8", e.fillRect(0, 0, I, I);
		for (let t = 0; t < I; t += 43) e.fillStyle = `rgba(${200 + n() * 30},${200 + n() * 30},${200 + n() * 30},0.5)`, e.fillRect(0, t, I, 40), e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(0, t + 40, I, 3);
		R(e, I, I, 6e3, n, .1);
		for (let t = 0; t < 6; t++) e.fillStyle = `rgba(40,40,40,${.2 + n() * .3})`, e.fillRect(n() * I, n() * I, 15 + n() * 40, 10 + n() * 30);
		for (let t = 0; t < 5; t++) z(e, n, n() * I, n() * I, 20 + n() * 30, "rgba(80,70,50,0.25)");
	},
	roofBaldosa(e, t, n) {
		e.fillStyle = "#c9b9a8", e.fillRect(0, 0, I, I);
		for (let t = 0; t < I; t += 8) for (let r = 0; r < I; r += 8) e.fillStyle = `hsl(${12 + n() * 8},${45 + n() * 15}%,${40 + n() * 10}%)`, e.fillRect(r + 1, t + 1, 7, 7);
		for (let t = 0; t < 6; t++) z(e, n, n() * I, n() * I, 20 + n() * 40, "rgba(50,50,40,0.25)");
	},
	chapa(e, t, n) {
		e.fillStyle = "#a7aaac", e.fillRect(0, 0, I, I);
		for (let t = 0; t < I; t += 4) e.fillStyle = "rgba(255,255,255,0.22)", e.fillRect(t, 0, 1, I), e.fillStyle = "rgba(0,0,0,0.22)", e.fillRect(t + 2, 0, 1.5, I);
		for (let t = 60; t < I; t += 64 + n() * 20) e.fillStyle = "rgba(0,0,0,0.35)", e.fillRect(0, t, I, 2);
		for (let t = 0; t < 10; t++) z(e, n, n() * I, n() * I, 15 + n() * 45, `rgba(${130 + n() * 40},${60 + n() * 20},20,${.25 + n() * .3})`);
		for (let t = 0; t < 20; t++) {
			let t = n() * I, r = n() * I, i = 20 + n() * 60, a = e.createLinearGradient(t, r, t, r + i);
			a.addColorStop(0, "rgba(120,60,20,0.4)"), a.addColorStop(1, "rgba(120,60,20,0)"), e.fillStyle = a, e.fillRect(t, r, 2 + n() * 3, i);
		}
	}
};
function ve(e, t, n, r) {
	if (e.save(), t.save(), e.scale(1, 2), t.scale(1, 2), e.fillStyle = "#efe9dd", e.fillRect(0, 0, I, 128), R(e, I, 128, 3500, n, .08), e.fillStyle = "rgba(0,0,0,0.1)", e.fillRect(0, 0, I, 5), r === 3) for (let t = 0; t < I; t += 16) for (let r = 110; r < 128; r += 6) e.fillStyle = `hsl(35,${10 + n() * 10}%,${45 + n() * 15}%)`, e.fillRect(t + r / 6 % 2 * 8, r, 15, 5);
	else e.fillStyle = `hsl(40,5%,${45 + n() * 15}%)`, e.fillRect(0, 111, I, 17);
	r === 0 ? (le(e, t, n, 18, 23, 38, 88), K(e, t, n, 76, 32, 50, 46), ue(e, n, 146, 15, 100, 96)) : r === 1 ? (K(e, t, n, 22, 32, 52, 46), le(e, t, n, 108, 23, 38, 88), K(e, t, n, 178, 32, 52, 46)) : r === 2 ? (ue(e, n, 14, 15, 118, 96, !0), le(e, t, n, 162, 23, 38, 88), e.fillStyle = "#333", e.fillRect(214, 50, 22, 14)) : (K(e, t, n, 16, 30, 56, 50, { persiana: !0 }), le(e, t, n, 104, 21, 40, 90), K(e, t, n, 170, 30, 56, 50)), B(e, n, I, 128, 5), e.restore(), t.restore();
}
function ye(e, t) {
	let r = {};
	{
		let i = n(31), [a, o] = L();
		o.fillStyle = "#7b6650", o.fillRect(0, 0, I, I);
		for (let e = 0; e < 14; e++) z(o, i, i() * I, i() * I, 20 + i() * 40, i() < .5 ? "rgba(60,48,36,0.35)" : "rgba(150,130,100,0.3)");
		for (let e = 0; e < 9e3; e++) {
			let e = 70 + i() * 80;
			o.fillStyle = `rgba(${e + 20},${e},${e - 20},0.35)`, o.fillRect(i() * I, i() * I, 1 + i() * 2, 1 + i() * 2);
		}
		for (let e = 0; e < 25; e++) o.fillStyle = `hsl(${i() * 360},${20 + i() * 30}%,${45 + i() * 35}%)`, o.fillRect(i() * I, i() * I, 2 + i() * 2, 1 + i() * 2);
		for (let e = 0; e < 5; e++) {
			o.fillStyle = "rgba(70,90,40,0.5)";
			for (let e = 0; e < 60; e++) o.fillRect(i() * I, i() * I, 1, 3);
		}
		r.dirt = t(a, e);
	}
	{
		let i = n(32), [a, o] = L();
		o.fillStyle = "#8f8a55", o.fillRect(0, 0, I, I);
		for (let e = 0; e < 12; e++) z(o, i, i() * I, i() * I, 25 + i() * 45, i() < .4 ? "rgba(120,100,70,0.45)" : "rgba(90,110,50,0.35)");
		for (let e = 0; e < 12e3; e++) o.fillStyle = `hsl(${40 + i() * 35},${25 + i() * 25}%,${28 + i() * 30}%)`, o.fillRect(i() * I, i() * I, 1, 2 + i() * 5);
		for (let e = 0; e < 18; e++) o.fillStyle = `hsl(${i() * 360},${20 + i() * 30}%,${50 + i() * 35}%)`, o.fillRect(i() * I, i() * I, 2 + i() * 2, 1 + i() * 2);
		r.dryGrass = t(a, e);
	}
	{
		let i = n(33), [a, o] = L();
		o.fillStyle = "#9d978c", o.fillRect(0, 0, I, I), R(o, I, I, 7e3, i, .14);
		for (let e = 0; e < 6; e++) z(o, i, i() * I, i() * I, 20 + i() * 30, "rgba(90,75,55,0.4)");
		V(o, i, I, I, 8);
		for (let e of [0, 216]) {
			let t = o.createLinearGradient(e, 0, e + 40, 0), n = "rgba(100,80,58,0.85)", r = "rgba(100,80,58,0)";
			t.addColorStop(0, e ? r : n), t.addColorStop(1, e ? n : r), o.fillStyle = t, o.fillRect(e, 0, 40, I);
		}
		o.fillStyle = "rgba(40,50,60,0.35)", o.fillRect(I / 2 - 3, 0, 6, I), r.pasillo = t(a, e);
	}
	{
		let i = n(35), [a, o] = L();
		o.fillStyle = "#8f8d87", o.fillRect(0, 0, I, I);
		for (let e = 0; e < I; e += I / 3) for (let t of [0, I / 2]) o.fillStyle = `hsl(40,${3 + i() * 4}%,${50 + i() * 8}%)`, o.fillRect(t + 1, e + 1, I / 2 - 2, I / 3 - 2);
		R(o, I, I, 9e3, i, .12);
		for (let e = 0; e < 8; e++) z(o, i, i() * I, i() * I, 10 + i() * 25, "rgba(40,40,40,0.25)");
		V(o, i, I, I, 6), o.fillStyle = "rgba(30,30,30,0.55)";
		for (let e = 0; e < I; e += I / 3) o.fillRect(0, e, I, 2);
		o.fillRect(I / 2 - 1, 0, 2, I), o.fillStyle = "rgba(200,198,190,0.6)", o.fillRect(0, 0, 10, I), o.fillRect(246, 0, 10, I), r.concrete = t(a, e);
	}
	{
		let i = n(34), [a, o] = L();
		o.fillStyle = "#56603a", o.fillRect(0, 0, I, I);
		for (let e = 0; e < 9; e++) z(o, i, i() * I, i() * I, 18 + i() * 30, "rgba(70,80,70,0.6)");
		for (let e = 0; e < 1e4; e++) o.fillStyle = `hsl(${60 + i() * 40},${25 + i() * 25}%,${20 + i() * 25}%)`, o.fillRect(i() * I, i() * I, 1, 2 + i() * 6);
		r.wetland = t(a, e);
	}
	return r;
}
function be(t) {
	let r = n(41), [i, a] = L(512, 512);
	a.clearRect(0, 0, 512, 512), a.fillStyle = "#1e1e1e";
	for (let e = 4; e < 256; e += 11) a.fillRect(e, 10, 3, 114), a.beginPath(), a.moveTo(e - 2, 11), a.lineTo(e + 1.5, 2), a.lineTo(e + 5, 11), a.fill();
	a.fillRect(0, 14, 256, 4), a.fillRect(0, 70, 256, 3), a.fillRect(0, 120, 256, 6), a.save(), a.beginPath(), a.rect(256, 0, 256, 128), a.clip(), a.strokeStyle = "rgba(150,155,158,0.95)", a.lineWidth = 1.2;
	for (let e = -128; e < 256; e += 9) a.beginPath(), a.moveTo(256 + e, 6), a.lineTo(256 + e + 122, 128), a.moveTo(256 + e + 122, 6), a.lineTo(256 + e, 128), a.stroke();
	a.restore(), a.fillStyle = "#7d8286", a.fillRect(256, 4, 256, 3);
	for (let e = 0; e < 3; e++) a.clearRect(286 + r() * 180, 40 + r() * 60, 14 + r() * 20, 10 + r() * 20);
	a.fillStyle = "#2b2b2b", a.fillRect(0, 130, 256, 6), a.fillRect(0, 184, 256, 5);
	for (let e = 3; e < 256; e += 14) a.fillRect(e, 130, 3, 58);
	a.fillStyle = "#ddd", a.fillRect(256, 131, 256, 2);
	let o = 262;
	for (; o < 500;) {
		let e = r(), t = e < .35 ? 34 : e < .6 ? 22 : e < .85 ? 46 : 12;
		if (o + t > 508) break;
		a.fillStyle = `hsl(${r() * 360},${25 + r() * 40}%,${40 + r() * 40}%)`, e < .35 ? (a.fillRect(o + 6, 134, t - 12, 44), a.fillRect(o, 134, t, 14)) : e < .6 ? (a.fillRect(o, 134, t, 14), a.fillRect(o, 134, t / 2 - 1, 64), a.fillRect(o + t / 2 + 1, 134, t / 2 - 1, 64)) : e < .85 ? (a.fillRect(o, 134, t, 70 + r() * 40), a.fillStyle = "rgba(255,255,255,0.3)", a.fillRect(o, 150, t, 4)) : a.fillRect(o, 134, t, 22), a.fillStyle = "#c7a26b", a.fillRect(o + 2, 130, 3, 6), o += t + 3 + r() * 8;
	}
	let s = (e, t) => {
		for (let n = 0; n < 110; n++) {
			let n = e + 128 + (r() - .5) * 120, i = 90 + r() * 150, o = (r() - .5) * 90;
			a.strokeStyle = t[Math.floor(r() * t.length)], a.lineWidth = 1.5 + r() * 2, a.beginPath(), a.moveTo(n, 512), a.quadraticCurveTo(n + o * .3, 512 - i * .6, n + o, 512 - i), a.stroke();
		}
	};
	s(0, [
		"#a79a5a",
		"#8c8a4a",
		"#b8a868",
		"#6f7a3a",
		"#9a8a50",
		"#c2b27a"
	]), s(256, [
		"#5f7040",
		"#6b7a45",
		"#7a8450",
		"#8f8a55"
	]);
	for (let e = 0; e < 9; e++) {
		let e = 316 + r() * 136, t = 270 + r() * 60;
		a.strokeStyle = "#8f8260", a.lineWidth = 2, a.beginPath(), a.moveTo(e, 512), a.lineTo(e + (r() - .5) * 30, t + 40), a.stroke(), a.fillStyle = "rgba(236,226,200,0.95)", a.beginPath(), a.ellipse(e + (r() - .5) * 20, t + 20, 9 + r() * 4, 28 + r() * 10, (r() - .5) * .4, 0, Math.PI * 2), a.fill();
	}
	let c = new e.CanvasTexture(i);
	return c.colorSpace = e.SRGBColorSpace, c.anisotropy = 4, c;
}
function xe(t) {
	let n = t.length, r = I * I * 4, i = new Uint8Array(r * n), a = new Uint8Array(r * n), o = (e, t, n) => {
		let r = e.getContext("2d").getImageData(0, 0, I, I).data;
		for (let e = 0; e < I; e++) t.set(r.subarray((255 - e) * I * 4, (I - e) * I * 4), n + e * I * 4);
	};
	t.forEach((e, t) => {
		o(e.canvas, i, t * r), e.ecanvas && o(e.ecanvas, a, t * r);
	});
	let s = (t) => {
		let r = new e.DataArrayTexture(t, I, I, n);
		return r.wrapS = r.wrapT = e.RepeatWrapping, r.magFilter = e.LinearFilter, r.minFilter = e.LinearMipmapLinearFilter, r.generateMipmaps = !0, r.anisotropy = 4, r.colorSpace = e.SRGBColorSpace, r.needsUpdate = !0, r;
	};
	return {
		map: s(i),
		emissive: s(a),
		layer: Object.fromEntries(t.map((e, t) => [e.name, t])),
		rough: t.map((e) => e.rough ?? .9),
		metal: t.map((e) => e.metal ?? 0)
	};
}
function Se(e, t) {
	let r = n(t), [i, a] = L(), [o, s] = L();
	return s.fillStyle = "#000", s.fillRect(0, 0, I, I), e(a, s, r), {
		canvas: i,
		ecanvas: o
	};
}
[
	"#2f4a35",
	"#3b3b3b",
	"#7a2e22",
	"#e8e8e8",
	"#5a4632",
	"#1f3550"
].map((t) => new e.Color(t)), [
	"#3b3b3b",
	"#2f4a35",
	"#e8e8e8",
	"#5a5a5a",
	"#6b3a22",
	"#1f3550",
	"#9a9a98"
].map((t) => new e.Color(t)), [
	"#8f8a82",
	"#5d5a56",
	"#a4553a",
	"#c9c2b4",
	"#3f3f3f"
].map((t) => new e.Color(t)), new e.Color(1, 1, 1), new e.Color(.62, .62, .6), new e.Color(.93, .74, .12), new e.Color(.7, .68, .64), ((t, n, r, i = n / 2) => D(new e.BoxGeometry(t, n, r).translate(0, i, 0)))(1, 1, 1), D(new e.CylinderGeometry(.34, .34, .2, 7).translate(0, .1, 0)), D(new e.OctahedronGeometry(.2, 0).scale(1, .6, 1)), D(new e.CylinderGeometry(.55, .5, 1.1, 8, 1, !0).translate(0, .55, 0)), D(new e.CylinderGeometry(.3, .55, .18, 8).translate(0, 1.19, 0)), D(new e.CylinderGeometry(.5, .5, 1, 6).translate(0, .5, 0)), D(new e.ConeGeometry(.5, .4, 6).translate(0, .2, 0)), D(new e.CylinderGeometry(.42, .3, .08, 10).rotateX(1.1).translate(0, .75, 0)), new e.Matrix4(), new e.Quaternion(), new e.Euler(), new e.Vector3(), new e.Vector3();
var q = (t) => new e.Color(t);
q("#9d988e"), q("#5b3b28"), q("#1d1d1d"), q("#8a857c"), q("#b5603c"), q("#6d6f70"), q("#b8bcbf"), q("#c9c3b6"), q("#8e9396"), q("#7a4a2c"), q("#202020"), q("#d6cba2"), q("#2d5f9a"), q("#e8e8e4");
//#endregion
//#region src/world/corridors.js
var Ce = 6.2, we = -5.6, Te = 42, Ee = 11.5, De = 3.6, Oe = 7.95;
function ke(e, t, n, r) {
	let i = t[0] - e[0], a = t[1] - e[1], o = r[0] - n[0], s = r[1] - n[1], c = i * s - a * o;
	if (Math.abs(c) < 1e-9) return null;
	let l = ((n[0] - e[0]) * s - (n[1] - e[1]) * o) / c, u = ((n[0] - e[0]) * a - (n[1] - e[1]) * i) / c;
	return l >= 0 && l < 1 && u >= 0 && u <= 1 ? l : null;
}
var Ae = (e, t, n) => {
	let r = Infinity;
	for (let a = 0; a < n.length - 1; a++) r = Math.min(r, i(e, t, n[a][0], n[a][1], n[a + 1][0], n[a + 1][1])[3]);
	return Math.sqrt(r);
};
function je(e, t, n, r) {
	let i = (n) => {
		let r = 1;
		for (; r < t.length - 1 && t[r] < n;) r++;
		let i = (n - t[r - 1]) / (t[r] - t[r - 1] || 1);
		return [e[r - 1][0] + (e[r][0] - e[r - 1][0]) * i, e[r - 1][1] + (e[r][1] - e[r - 1][1]) * i];
	}, a = [i(n)];
	for (let i = 0; i < e.length; i++) t[i] > n && t[i] < r && a.push(e[i]);
	return a.push(i(r)), a;
}
function Me(e) {
	let t = {
		decks: [],
		levels: [],
		obstacles: []
	};
	if (!e.decks) return t;
	let n = e.roads.filter((e) => e.motorway), r = e.roads.filter((e) => e.ramp);
	e.roads = e.roads.filter((e) => !(e.kind === "primary" && e.w >= 24 && e.oneway && !e.motorway && e.pts.filter(([e, t]) => r.some((n) => Ae(e, t, n.pts) < 5)).length >= e.pts.length * .6));
	for (let e of n) e.w = Ee;
	let s = new o(60), c = (e, n, r) => {
		for (let i = 0; i < e.length - 1; i++) {
			let o = {
				a: e[i],
				b: e[i + 1],
				type: n,
				half: r
			};
			s.insert(o, a([e[i], e[i + 1]])), t.obstacles.push(o);
		}
	};
	for (let t of e.rails || []) c(t.pts, "rail", De);
	for (let e of n) c(e.pts, "mw", Oe);
	let l = (t, n, r, i, a) => e.decks.find((e) => {
		if ((a ? e.rail || e.highway === "motorway" : !(e.rail || e.highway === "motorway")) || Ae(t, n, e.pts) > (a ? 8 : 30)) return !1;
		if (!a) return !0;
		let [o, s] = [e.pts[0], e.pts[e.pts.length - 1]], c = Math.hypot(s[0] - o[0], s[1] - o[1]) || 1;
		return Math.abs(((s[0] - o[0]) * r + (s[1] - o[1]) * i) / c) > .6;
	}), u = (t, n) => e.levelCrossings.some((e) => Math.hypot(e.x - t, e.z - n) < 16), d = new o(40);
	for (let t of e.roads) if (!(t.kind === "footway" || t.motorway)) for (let e = 0; e < t.pts.length - 1; e++) d.insert([
		t.pts[e],
		t.pts[e + 1],
		t.w
	], a([t.pts[e], t.pts[e + 1]]));
	let f = (e) => {
		let t = 0, n = 0;
		for (let r = e.span + 2; r < e.span + e.ramp; r += 3) for (let a of [-1, 1]) {
			let o = e.x + e.ux * r * a, s = e.z + e.uz * r * a;
			n++;
			for (let [n, r, a] of d.query(o, s, o, s)) {
				let c = Math.hypot(r[0] - n[0], r[1] - n[1]) || 1;
				if (Math.abs(((r[0] - n[0]) * e.ux + (r[1] - n[1]) * e.uz) / c) > .8 && i(o, s, n[0], n[1], r[0], r[1])[3] < (a / 2) ** 2) {
					t++;
					break;
				}
			}
		}
		return t >= n * .45;
	}, p = [];
	for (let n of e.roads) {
		if (n.motorway || n.pasillo) {
			p.push(n);
			continue;
		}
		let e = [0];
		for (let t = 1; t < n.pts.length; t++) e.push(e[t - 1] + Math.hypot(n.pts[t][0] - n.pts[t - 1][0], n.pts[t][1] - n.pts[t - 1][1]));
		let r = [];
		for (let t = 0; t < n.pts.length - 1; t++) {
			let i = n.pts[t], a = n.pts[t + 1];
			for (let o of s.query(Math.min(i[0], a[0]), Math.min(i[1], a[1]), Math.max(i[0], a[0]), Math.max(i[1], a[1]))) {
				if (n.ramp && o.type === "mw") continue;
				let s = ke(i, a, o.a, o.b);
				if (s === null) continue;
				let c = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]) || 1, l = e[t + 1] - e[t] || 1, u = Math.abs(((a[0] - i[0]) * (o.b[1] - o.a[1]) - (a[1] - i[1]) * (o.b[0] - o.a[0])) / (c * l));
				r.push({
					s: e[t] + l * s,
					half: o.half / Math.max(.35, u),
					type: o.type
				});
			}
		}
		if (!r.length) {
			p.push(n);
			continue;
		}
		r.sort((e, t) => e.s - t.s);
		let i = [];
		for (let e of r) {
			let t = i[i.length - 1];
			t && e.s - e.half - t.s1 < 30 ? (t.s1 = Math.max(t.s1, e.s + e.half), t.types.add(e.type)) : i.push({
				s0: e.s - e.half,
				s1: e.s + e.half,
				types: /* @__PURE__ */ new Set([e.type])
			});
		}
		let a = [];
		for (let r of i) {
			let i = (r.s0 + r.s1) / 2, [o, s] = je(n.pts, e, i, i)[0], [c, d] = je(n.pts, e, Math.max(0, i - 5), Math.min(e[e.length - 1], i + 5)), p = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1, m = (d[0] - c[0]) / p, h = (d[1] - c[1]) / p, g = l(o, s, m, h, !0), _ = g ? g.type === "bridge" ? "over" : "under" : l(o, s, m, h, !1) ? "under" : null;
			if (!_ && !r.types.has("mw") && u(o, s) && (_ = "level"), _ === "level") {
				t.levels.push({
					x: o,
					z: s,
					ux: m,
					uz: h,
					w: n.w,
					half: (r.s1 - r.s0) / 2,
					ped: n.kind === "footway" || n.kind === "pedestrian" || n.kind === "steps"
				});
				continue;
			}
			if (!_) {
				a.push([r.s0 - 3, r.s1 + 3]);
				continue;
			}
			let v = (r.s1 - r.s0) / 2 + 1.5, y = n.kind === "footway" || n.kind === "pedestrian";
			if (t.decks.find((e) => Math.hypot(e.x - o, e.z - s) < 10)) continue;
			let b = {
				x: o,
				z: s,
				ux: m,
				uz: h,
				span: v,
				ramp: y ? 26 : Te,
				half: y ? n.w / 2 + .6 : n.w / 2 + 2.2,
				h: _ === "over" ? y ? 5.4 : Ce : we,
				mode: _,
				rail: r.types.has("rail"),
				mw: r.types.has("mw"),
				ped: y,
				name: n.name
			};
			f(b) ? t.decks.push(b) : a.push([r.s0 - 3, r.s1 + 3]);
		}
		if (!a.length) {
			p.push(n);
			continue;
		}
		let o = 0, c = e[e.length - 1];
		for (let [t, r] of a) t - o > 4 && p.push({
			...n,
			pts: je(n.pts, e, o, t)
		}), o = r;
		c - o > 4 && p.push({
			...n,
			pts: je(n.pts, e, o, c)
		});
	}
	e.roads = p;
	for (let e of t.decks) e.len = e.span + e.ramp;
	return t;
}
//#endregion
//#region src/entities/train.js
var J = 20, Ne = 6, Pe = 2.9, Fe = 17, Ie = 18;
function Le(n) {
	let r = new e.MeshStandardMaterial({
		color: 15922421,
		roughness: .4,
		metalness: .3
	}), i = new e.MeshStandardMaterial({
		color: 1920928,
		roughness: .4
	}), a = new e.MeshStandardMaterial({
		color: 3057888,
		roughness: .4
	}), o = new e.MeshStandardMaterial({
		color: 1581611,
		roughness: .1,
		metalness: .6
	}), s = new e.MeshStandardMaterial({
		color: 2829099,
		roughness: .8
	}), c = /* @__PURE__ */ new Map(), l = (t, n, r, i, a, o, s) => {
		let l = new e.BoxGeometry(n, r, i);
		l.translate(a, o, s), c.has(t) || c.set(t, []), c.get(t).push(l);
	};
	l(r, Pe, 2.9, J, 0, 2.55, 0), l(o, 2.94, .9, 17, 0, 2.9, 0), l(i, 2.9499999999999997, .28, J, 0, 2.2, 0), l(a, 2.9499999999999997, .12, J, 0, 1.95, 0), l(s, 2.6, .5, 19, 0, .85, 0);
	for (let e of [-7, J / 2 - 3]) for (let t of [-1, 1]) l(s, .08, 2.1, 1.3, t * 1.47, 2.25, e);
	l(s, .3, .4, .3, 0, 4.2, 0), n && (l(o, 2.6, 1.2, .1, 0, 3.1, 10.02), l(i, Pe, .6, .12, 0, 1.9, 10.03), l(new e.MeshStandardMaterial({
		color: 16777215,
		emissive: 16773836,
		emissiveIntensity: 1
	}), .4, .2, .08, -.9, 1.6, 10.06), l(new e.MeshStandardMaterial({
		color: 16777215,
		emissive: 16773836,
		emissiveIntensity: 1
	}), .4, .2, .08, .9, 1.6, 10.06));
	let u = new e.Group();
	for (let [n, r] of c) {
		let i = new e.Mesh(t(r), n);
		i.castShadow = !0, u.add(i);
	}
	return u;
}
var Re = class {
	constructor(e) {
		this.pts = e, this.cum = [0];
		for (let t = 1; t < e.length; t++) this.cum.push(this.cum[t - 1] + Math.hypot(e[t][0] - e[t - 1][0], e[t][1] - e[t - 1][1]));
		this.length = this.cum[this.cum.length - 1];
	}
	at(e) {
		e = Math.max(0, Math.min(this.length, e));
		let t = 0, n = this.cum.length - 1;
		for (; n - t > 1;) {
			let r = t + n >> 1;
			this.cum[r] <= e ? t = r : n = r;
		}
		let r = this.pts[t], i = this.pts[n], a = this.cum[n] - this.cum[t] || 1, o = (e - this.cum[t]) / a;
		return {
			x: r[0] + (i[0] - r[0]) * o,
			z: r[1] + (i[1] - r[1]) * o,
			dx: (i[0] - r[0]) / a,
			dz: (i[1] - r[1]) / a
		};
	}
	project(e, t) {
		let n = Infinity, r = 0;
		for (let i = 0; i < this.pts.length - 1; i++) {
			let [a, o] = this.pts[i], [s, c] = this.pts[i + 1], l = s - a, u = c - o, d = l * l + u * u || 1, f = Math.max(0, Math.min(1, ((e - a) * l + (t - o) * u) / d)), p = (a + l * f - e) ** 2 + (o + u * f - t) ** 2;
			p < n && (n = p, r = this.cum[i] + Math.sqrt(d) * f);
		}
		return {
			s: r,
			d: Math.sqrt(n)
		};
	}
}, ze = class {
	constructor(t, n) {
		this.trains = [];
		let r = (n.rails || []).map((e) => new Re(e.pts)).filter((e) => e.length > 800).sort((e, t) => t.length - e.length).slice(0, 2), i = (n.specials || []).filter((e) => e.type === "station");
		r.forEach((n, r) => {
			let a = i.map((e) => n.project(e.cx, e.cz)).filter((e) => e.d < 25).map((e) => e.s).sort((e, t) => e - t), o = [];
			for (let n = 0; n < Ne; n++) {
				let r = Le(n === 0 || n === 5);
				n === 5 && (r.rotation.y = Math.PI);
				let i = new e.Group();
				i.add(r), t.add(i), o.push(i);
			}
			let s = r % 2 ? -1 : 1;
			this.trains.push({
				track: n,
				stops: a,
				cars: o,
				dir: s,
				s: r % 2 ? n.length * .7 : n.length * .2,
				v: Fe,
				wait: 0
			});
		});
	}
	update(e) {
		let t = [];
		for (let n of this.trains) {
			let r = Ne * 20.8;
			if (n.wait > 0) n.wait -= e, n.v = 0;
			else {
				let t = n.stops.map((e) => (e - n.s) * n.dir).filter((e) => e > 1).sort((e, t) => e - t)[0], i = n.dir > 0 ? n.track.length - n.s : n.s - r, a = Math.min(t ?? Infinity, i), o = a < 120 ? Math.max(1.5, Math.sqrt(2.2 * Math.max(0, a))) : Fe;
				n.v += Math.sign(o - n.v) * Math.min(Math.abs(o - n.v), 1.1 * e), n.s += n.dir * n.v * e, t !== void 0 && t < 1.5 && (n.wait = Ie, n.s = n.stops.find((e) => Math.abs(e - n.s) < 2) ?? n.s), i < 1 && (n.dir = -n.dir, n.s = n.dir > 0 ? n.s - r : n.s + r, n.wait = Ie);
			}
			n.cars.forEach((e, r) => {
				let i = n.s - n.dir * (r * 20.8 + J / 2), a = n.track.at(i), o = a.dx * n.dir, s = a.dz * n.dir;
				e.position.set(a.x, 0, a.z), e.rotation.y = Math.atan2(o, s), t.push({
					x: a.x,
					z: a.z,
					dx: o,
					dz: s,
					hl: J / 2,
					hw: Pe / 2,
					vx: o * n.v,
					vz: s * n.v
				});
			});
		}
		return t;
	}
}, Y = 256;
function X(e = Y, t = Y) {
	let n = document.createElement("canvas");
	return n.width = e, n.height = t, [n, n.getContext("2d", { willReadFrequently: !0 })];
}
function Z(t, n, { srgb: r = !0, repeat: i = !0 } = {}) {
	let a = new e.CanvasTexture(t);
	return i && (a.wrapS = a.wrapT = e.RepeatWrapping), r && (a.colorSpace = e.SRGBColorSpace), a.anisotropy = n.capabilities.getMaxAnisotropy(), a.generateMipmaps = !0, a.needsUpdate = !0, a;
}
function Q(e, t, n, r, i, a = .08) {
	for (let o = 0; o < r; o++) {
		let r = Math.floor(i() * 255);
		e.fillStyle = `rgba(${r},${r},${r},${a})`, e.fillRect(i() * t, i() * n, 1 + i() * 3, 1 + i() * 3);
	}
}
function $(e, { base: t, drawWall: r, drawWindow: i, seed: a }) {
	let o = n(a), [s, c] = X(), [l, u] = X();
	c.fillStyle = t, c.fillRect(0, 0, Y, Y), r && r(c, o), Q(c, Y, Y, 2500, o), u.fillStyle = "#000", u.fillRect(0, 0, Y, Y);
	let d = Y / 2;
	for (let e = 0; e < 2; e++) for (let t = 0; t < 2; t++) {
		let n = o() < .45;
		i(c, t * d, e * d, d, d, o, !1), n && i(u, t * d, e * d, d, d, o, !0);
	}
	return {
		map: Z(s, e),
		emissive: Z(l, e),
		canvas: s,
		ecanvas: l
	};
}
function Be(e, t, n, r, i, a, o) {
	if (a) e.fillStyle = o() < .75 ? `hsl(${38 + o() * 10},90%,${55 + o() * 15}%)` : `hsl(200,60%,${60 + o() * 15}%)`;
	else {
		let a = e.createLinearGradient(t, n, t + r, n + i);
		a.addColorStop(0, "#2c3a46"), a.addColorStop(.5, "#5d7385"), a.addColorStop(1, "#27323b"), e.fillStyle = a;
	}
	e.fillRect(t, n, r, i);
}
function Ve(e) {
	let t = {};
	t.house = $(e, {
		seed: 1,
		base: "#f1ece2",
		drawWall(e) {
			e.fillStyle = "rgba(0,0,0,0.10)", e.fillRect(0, Y / 2 - 6, Y, 6), e.fillRect(0, 250, Y, 6);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .22, c = n + i * .22, l = r * .56, u = i * .52;
			o || (e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(s - 5, c - 5, l + 10, u + 12));
			let d = a();
			if (Be(e, s, c, l, u, o, a), !o) {
				if (d < .45) {
					let t = u * (.3 + a() * .7);
					e.fillStyle = "#b8b2a4", e.fillRect(s, c, l, t), e.fillStyle = "rgba(0,0,0,0.25)";
					for (let n = c; n < c + t; n += 4) e.fillRect(s, n, l, 1);
				}
				e.strokeStyle = "#1d1d1d", e.lineWidth = 2;
				for (let t = s + 6; t < s + l; t += 9) e.beginPath(), e.moveTo(t, c), e.lineTo(t, c + u), e.stroke();
				e.strokeRect(s, c, l, u);
			}
		}
	}), t.brick = $(e, {
		seed: 2,
		base: "#b0643f",
		drawWall(e, t) {
			for (let n = 0; n < Y; n += 8) {
				let r = n / 8 % 2 ? 11 : 0;
				for (let i = -22; i < Y; i += 22) {
					let a = 38 + t() * 14;
					e.fillStyle = `hsl(${16 + t() * 8},${45 + t() * 15}%,${a}%)`, e.fillRect(i + r + 1, n + 1, 20, 6);
				}
			}
			e.fillStyle = "#d8d2c4", e.fillRect(0, Y / 2 - 8, Y, 8), e.fillRect(0, 248, Y, 8);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .18, c = n + i * .2, l = r * .64, u = i * .55;
			Be(e, s, c, l, u, o, a), !o && (e.strokeStyle = "#e8e6e0", e.lineWidth = 3, e.strokeRect(s, c, l, u), e.beginPath(), e.moveTo(s + l / 2, c), e.lineTo(s + l / 2, c + u), e.stroke());
		}
	}), t.apartments = $(e, {
		seed: 3,
		base: "#e4e0d8",
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .1, c = n + i * .12, l = r * .8, u = i * .62;
			if (Be(e, s, c, l, u, o, a), !o) {
				a() < .5 && (e.fillStyle = "#9d9a90", e.fillRect(s, c, l, u * (.2 + a() * .6))), e.fillStyle = "#cfcac0", e.fillRect(t, n + i * .74, r, i * .06), e.fillStyle = "rgba(40,40,40,0.85)", e.fillRect(t + 2, n + i * .55, r - 4, 3);
				for (let a = t + 4; a < t + r; a += 7) e.fillRect(a, n + i * .55, 2, i * .19);
				e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(t, n + i * .8, r, i * .04);
			}
		}
	}), t.office = $(e, {
		seed: 4,
		base: "#8a9aa6",
		drawWindow(e, t, n, r, i, a, o) {
			let s = e.createLinearGradient(t, n, t, n + i);
			if (o) {
				e.fillStyle = a() < .6 ? `hsl(45,60%,${62 + a() * 15}%)` : `hsl(205,35%,${70 + a() * 15}%)`, e.fillRect(t + 3, n + 3, r - 6, i * .8);
				return;
			}
			s.addColorStop(0, "#6e8699"), s.addColorStop(1, "#2d3d4b"), e.fillStyle = s, e.fillRect(t + 3, n + 3, r - 6, i * .8), e.fillStyle = "#4b5963", e.fillRect(t, n + i * .84, r, i * .16), e.fillRect(t + r / 2 - 2, n, 4, i);
		}
	}), t.church = $(e, {
		seed: 5,
		base: "#e9e0cc",
		drawWall(e) {
			e.fillStyle = "rgba(0,0,0,0.12)";
			for (let t = 0; t < Y; t += 16) e.fillRect(0, t, Y, 1);
			e.fillRect(0, 238, Y, 18);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .32, c = n + i * .18, l = r * .36, u = i * .6;
			e.fillStyle = o ? "#f2c77a" : "#3a4250", e.beginPath(), e.moveTo(s, c + u), e.lineTo(s, c + l / 2), e.arc(s + l / 2, c + l / 2, l / 2, Math.PI, 0), e.lineTo(s + l, c + u), e.closePath(), e.fill();
		}
	});
	{
		let r = n(7), [i, a] = X();
		a.fillStyle = "#8d8a84", a.fillRect(0, 0, Y, Y), Q(a, Y, Y, 5e3, r, .12), a.fillStyle = "rgba(60,40,30,0.25)";
		for (let e = 0; e < 6; e++) a.fillRect(r() * Y, r() * Y, 40 + r() * 60, 30 + r() * 60);
		t.roofFlat = Z(i, e), t.roofFlatCanvas = i;
	}
	{
		let r = n(8), [i, a] = X();
		a.fillStyle = "#9a3f25", a.fillRect(0, 0, Y, Y);
		for (let e = 0; e < Y; e += 16) {
			for (let t = 0; t < Y; t += 16) a.fillStyle = `hsl(${10 + r() * 10},${55 + r() * 10}%,${30 + r() * 10}%)`, a.beginPath(), a.arc(t + 8, e + 14, 8, Math.PI, 0), a.fill();
			a.fillStyle = "rgba(0,0,0,0.3)", a.fillRect(0, e + 14, Y, 2);
		}
		t.roofTile = Z(i, e), t.roofTileCanvas = i;
	}
	let r = (e, t, { cuneta: n = !1, tracks: r = 0, patches: i = 2 } = {}) => {
		e.fillStyle = "#3d3e40", e.fillRect(0, 0, Y, Y), Q(e, Y, Y, 9e3, t, .1);
		for (let n = 0; n < 5; n++) e.fillStyle = `rgba(20,20,20,${.1 + t() * .2})`, e.beginPath(), e.ellipse(t() * Y, t() * Y, 10 + t() * 30, 6 + t() * 20, t() * 3, 0, Math.PI * 2), e.fill();
		for (let n = 0; n < r; n++) {
			let i = (n + .5) / r * Y;
			for (let t of [-.17, .17]) {
				let n = e.createLinearGradient(i + Y / r * t - 14, 0, i + Y / r * t + 14, 0);
				n.addColorStop(0, "rgba(150,150,150,0)"), n.addColorStop(.5, "rgba(150,150,150,0.13)"), n.addColorStop(1, "rgba(150,150,150,0)"), e.fillStyle = n, e.fillRect(i + Y / r * t - 14, 0, 28, Y);
			}
			e.fillStyle = "rgba(15,12,10,0.16)";
			for (let n = 0; n < Y; n += 4) e.fillRect(i - 5 + (t() - .5) * 3, n, 10, 4);
		}
		for (let n = 0; n < i; n++) {
			let n = 30 + t() * 60, r = 30 + t() * 80, i = 20 + t() * (216 - n), a = t() * (Y - r);
			e.fillStyle = t() < .6 ? "rgba(18,18,20,0.22)" : "rgba(120,118,112,0.16)", e.fillRect(i, a, n, r), e.strokeStyle = "rgba(10,10,10,0.3)", e.lineWidth = 1, e.strokeRect(i, a, n, r);
		}
		e.strokeStyle = "rgba(12,12,12,0.55)";
		for (let n = 0; n < 7; n++) {
			let n = t() * Y, r = t() * Y;
			e.lineWidth = .6 + t() * 1.2, e.beginPath(), e.moveTo(n, r);
			for (let i = 0; i < 8; i++) n += (t() - .5) * 22, r += (t() - .3) * 18, e.lineTo(n, r);
			e.stroke();
		}
		if (n) {
			for (let t of [0, 247]) {
				e.fillStyle = "#8f8b84", e.fillRect(t, 0, 9, Y), e.fillStyle = "rgba(40,36,30,0.35)", e.fillRect(t === 0 ? 8 : t, 0, 1, Y);
				for (let n = 0; n < Y; n += 32) e.fillRect(t, n, 9, 1);
			}
			Q(e, Y, Y, 800, t, .08);
		}
	};
	{
		let i = n(9), [a, o] = X();
		r(o, i, {
			cuneta: !0,
			tracks: 2
		}), t.road2 = Z(a, e);
	}
	{
		let i = n(10), [a, o] = X();
		r(o, i, {
			cuneta: !0,
			tracks: 1
		}), t.road1 = Z(a, e);
	}
	{
		let i = n(11), [a, o] = X();
		r(o, i, { patches: 0 }), t.asphalt = Z(a, e);
	}
	{
		let r = n(12), [i, a] = X();
		a.fillStyle = "#bdb6a6", a.fillRect(0, 0, Y, Y);
		for (let e = 0; e < Y; e += 32) for (let t = 0; t < Y; t += 32) {
			a.fillStyle = `hsl(40,14%,${66 + r() * 10}%)`, a.fillRect(t + 1, e + 1, 30, 30), a.fillStyle = "rgba(0,0,0,0.08)";
			for (let n = 0; n < 9; n++) a.fillRect(t + 5 + n % 3 * 9, e + 5 + Math.floor(n / 3) * 9, 4, 4);
		}
		Q(a, Y, Y, 2e3, r, .12), t.sidewalk = Z(i, e);
	}
	{
		let r = n(13), [i, a] = X();
		a.fillStyle = "#5b7a3a", a.fillRect(0, 0, Y, Y);
		for (let e = 0; e < 9e3; e++) a.fillStyle = `hsl(${75 + r() * 30},${30 + r() * 25}%,${22 + r() * 22}%)`, a.fillRect(r() * Y, r() * Y, 1 + r() * 2, 2 + r() * 4);
		for (let e = 0; e < 25; e++) a.fillStyle = "rgba(110,90,60,0.25)", a.beginPath(), a.ellipse(r() * Y, r() * Y, 8 + r() * 20, 6 + r() * 14, r() * 3, 0, Math.PI * 2), a.fill();
		t.grass = Z(i, e);
	}
	{
		let r = n(14), [i, a] = X();
		a.fillStyle = "#c9b48a", a.fillRect(0, 0, Y, Y), Q(a, Y, Y, 12e3, r, .15), t.sand = Z(i, e);
	}
	{
		let r = n(15), [i, a] = X();
		a.fillStyle = "#6d6259", a.fillRect(0, 0, Y, Y);
		for (let e = 0; e < 14e3; e++) {
			let e = 70 + r() * 90;
			a.fillStyle = `rgb(${e},${e * .95},${e * .9})`, a.fillRect(r() * Y, r() * Y, 2, 2);
		}
		t.gravel = Z(i, e);
	}
	{
		let r = n(16), [i, a] = X();
		a.fillStyle = "#a4553a", a.fillRect(0, 0, Y, Y), Q(a, Y, Y, 9e3, r, .14), t.plaza = Z(i, e);
	}
	{
		let r = n(17), [i, a] = X();
		a.fillStyle = "#6b8a3c", a.fillRect(0, 0, Y, Y), Q(a, Y, Y, 6e3, r, .1), t.pitch = Z(i, e);
	}
	return Object.assign(t, ye(e, Z)), t.atlas = be(e), t.facades = xe([
		{
			name: "house",
			...t.house
		},
		{
			name: "brick",
			...t.brick
		},
		{
			name: "apartments",
			...t.apartments
		},
		{
			name: "office",
			...t.office,
			rough: .35,
			metal: .3
		},
		{
			name: "church",
			...t.church
		},
		...[
			0,
			1,
			2,
			3
		].map((e) => ({
			name: `ground${e}`,
			...Se((t, n, r) => ve(t, n, r, e), 50 + e)
		})),
		...[
			"medianera",
			"medianeraLadrillo",
			"hueco",
			"villa",
			"muro0",
			"muro1",
			"muro2",
			"porton",
			"roofMembrana",
			"roofBaldosa",
			"chapa"
		].map((e, t) => ({
			name: e,
			...Se(_e[e], 60 + t),
			rough: e === "chapa" ? .55 : e === "porton" ? .6 : .9,
			metal: e === "chapa" ? .45 : e === "porton" ? .3 : 0
		})),
		...[
			"revoque",
			"ventana",
			"ventanaCortina",
			"ventanaPersiana",
			"puerta0",
			"puerta1",
			"portal",
			"pub0",
			"pub1",
			"pub2",
			"huella"
		].map((e, t) => ({
			name: e,
			...Se(_e[e], 80 + t),
			rough: e.startsWith("ventana") || e === "portal" ? .15 : e === "puerta1" ? .5 : .85,
			metal: e.startsWith("ventana") || e === "portal" ? .35 : e === "puerta1" ? .3 : 0
		})),
		{
			name: "roofFlat",
			canvas: t.roofFlatCanvas,
			rough: 1
		},
		{
			name: "roofTile",
			canvas: t.roofTileCanvas,
			rough: .8
		}
	]), t;
}
//#endregion
//#region src/slop/gtaWorld.js
var He = class {
	constructor() {
		this.hash = new o(24), this.solids = [];
	}
	addPolygon(e, t = 10, n = "building") {
		let r = {
			type: "poly",
			pts: e,
			height: t,
			tag: n,
			bb: a(e)
		};
		return this.solids.push(r), this.hash.insert(r, r.bb), r;
	}
	addCircle(e, t, n, r = "prop") {
		let i = {
			type: "circle",
			x: e,
			z: t,
			r: n,
			tag: r,
			bb: {
				minX: e - n,
				minZ: t - n,
				maxX: e + n,
				maxZ: t + n
			}
		};
		return this.solids.push(i), this.hash.insert(i, i.bb), i;
	}
	isBlocked(e, t, n = 0) {
		for (let a of this.hash.query(e - n, t - n, e + n, t + n)) if (a.type === "circle") {
			if (Math.hypot(e - a.x, t - a.z) < a.r + n) return !0;
		} else if (r(e, t, a.pts)) return !0;
		else if (n > 0) {
			let r = a.pts;
			for (let a = 0, o = r.length - 1; a < r.length; o = a++) if (i(e, t, r[o][0], r[o][1], r[a][0], r[a][1])[3] < n * n) return !0;
		}
		return !1;
	}
}, Ue = new e.Color(1, 1, 1);
function We(e, t, n, r, i) {
	let a = t.length, o = [], s = [];
	for (let e = 0; e < a; e++) {
		let i = t[e], c = t[Math.max(0, e - 1)], l = t[Math.min(a - 1, e + 1)], u = i[0] - c[0], d = i[1] - c[1], f = l[0] - i[0], p = l[1] - i[1], m = Math.hypot(u, d) || 1, h = Math.hypot(f, p) || 1;
		u /= m, d /= m, f /= h, p /= h, e === 0 && (u = f, d = p), e === a - 1 && (f = u, p = d);
		let g = u + f, _ = d + p, v = Math.hypot(g, _) || 1;
		g /= v, _ /= v;
		let y = -_, b = g, x = Math.min(2, 1 / Math.max(.3, y * -d + b * u)), S = n / 2 * x;
		o.push([
			i[0] + y * S,
			r,
			i[1] + b * S
		]), s.push([
			i[0] - y * S,
			r,
			i[1] - b * S
		]);
	}
	let c = 0;
	for (let n = 0; n < a - 1; n++) {
		let r = Math.hypot(t[n + 1][0] - t[n][0], t[n + 1][1] - t[n][1]), a = c * i, l = (c + r) * i;
		e.quad(o[n], s[n], s[n + 1], o[n + 1], [0, a], [1, a], [1, l], [0, l], Ue, [
			0,
			1,
			0
		]), c += r;
	}
}
async function Ge(t, { dataUrl: n, frame: r, lift: i = .2 }) {
	let a = await (await fetch(n)).json(), o = Ve({ capabilities: { getMaxAnisotropy: () => 8 } }), s = new He();
	te(a);
	let c = Me(a), l = new F(a.roads), u = new e.Group();
	u.name = "GtaQuilmesPlaces", u.rotation.y = r.theta, u.position.set(r.x, i, r.z);
	let d = (t, n = 16777215, r = {}) => new e.MeshStandardMaterial({
		map: t,
		color: n,
		roughness: .95,
		depthWrite: !1,
		polygonOffset: !0,
		polygonOffsetFactor: -2,
		...r
	}), f = b(a, {
		root: u,
		collision: s,
		graph: l,
		tex: o
	}), p = ce(a, {
		root: u,
		graph: l,
		collision: s,
		ribbon: We,
		flatMat: d,
		keepOut: f.keepOut,
		GeoBuf: E
	}), m = Ke(a, c, {
		root: u,
		tex: o,
		flatMat: d,
		collision: s
	});
	u.traverse((e) => {
		e.isMesh && (e.castShadow = e.castShadow || !e.material?.transparent, e.receiveShadow = !0);
	}), t.add(u), u.updateMatrixWorld(!0);
	let h = Math.cos(r.theta), g = Math.sin(r.theta), _ = (e, t) => ({
		x: e * h + t * g + r.x,
		z: -e * g + t * h + r.z
	}), v = [];
	for (let e of s.solids) {
		let t = e.type === "poly" ? e.pts.map(([e, t]) => _(e, t)) : Array.from({ length: 8 }, (t, n) => _(e.x + Math.cos(n * Math.PI / 4) * e.r, e.z + Math.sin(n * Math.PI / 4) * e.r)), n = t.map((e) => e.x), r = t.map((e) => e.z);
		v.push({
			minX: Math.min(...n),
			maxX: Math.max(...n),
			minZ: Math.min(...r),
			maxZ: Math.max(...r),
			minY: 0,
			maxY: e.type === "poly" ? e.height : 3,
			polygon: {
				outer: t,
				holes: []
			},
			gta: e.tag
		});
	}
	return {
		root: u,
		colliders: v,
		keepOut: f.keepOut.map(([e, t, n]) => {
			let r = _(e, t);
			return [
				r.x,
				r.z,
				n
			];
		}),
		setNight(e) {
			f.setNight(e), p.setNight(e);
		},
		dynamic: m.dynamic || null,
		update(e) {
			m.update(Math.min(e, .1));
		}
	};
}
function Ke(n, r, { root: i, tex: a, flatMat: o, collision: s }) {
	let c = { update() {} };
	if (!n.rails?.length) return c;
	let l = new E(), u = new E();
	for (let e of n.rails) We(l, e.pts, 3.6, .05, 1 / 4);
	let d = new e.Mesh(l.geometry(), o(a.gravel));
	d.receiveShadow = !0, i.add(d);
	let f = new e.Color(.55, .55, .58), p = [];
	for (let e of n.rails) for (let t = 0; t < e.pts.length - 1; t++) {
		let [n, r] = e.pts[t], [i, a] = e.pts[t + 1], o = Math.hypot(i - n, a - r);
		if (o < .01) continue;
		let s = (i - n) / o, c = (a - r) / o, l = -c, d = s;
		for (let e of [-.72, .72]) {
			let t = .18, o = .05, s = [
				n + l * (e - o),
				t,
				r + d * (e - o)
			], c = [
				n + l * (e + o),
				t,
				r + d * (e + o)
			], p = [
				i + l * (e - o),
				t,
				a + d * (e - o)
			], m = [
				i + l * (e + o),
				t,
				a + d * (e + o)
			];
			u.quad(s, c, m, p, [0, 0], [1, 0], [1, 1], [0, 1], f, [
				0,
				1,
				0
			]);
		}
		for (let e = 0; e < o; e += .7) p.push([
			n + s * e,
			r + c * e,
			Math.atan2(s, c)
		]);
	}
	i.add(new e.Mesh(u.geometry(), new e.MeshStandardMaterial({
		vertexColors: !0,
		metalness: .8,
		roughness: .35
	})));
	{
		let t = new e.InstancedMesh(new e.BoxGeometry(2.4, .14, .24), new e.MeshStandardMaterial({
			color: 5917242,
			roughness: 1
		}), p.length), n = new e.Matrix4(), r = new e.Quaternion(), a = new e.Vector3(0, 1, 0), o = new e.Vector3(1, 1, 1), s = new e.Vector3();
		p.forEach(([e, i, c], l) => t.setMatrixAt(l, n.compose(s.set(e, .08, i), r.setFromAxisAngle(a, c), o))), t.receiveShadow = !0, t.computeBoundingSphere(), i.add(t);
	}
	let m = r.levels || [], h = [];
	for (let e of m) if (!e.ped) for (let t of [-1, 1]) {
		let n = t * (e.half + 2.2), r = -t * (e.w / 2 + .6), i = e.x + e.ux * n - e.uz * r, a = e.z + e.uz * n + e.ux * r, o = -t * e.uz, c = t * e.ux;
		h.push({
			x: i,
			z: a,
			ry: Math.atan2(-c, o),
			Dx: o,
			Dz: c,
			len: e.w / 2 + .2,
			l: e,
			a: Math.PI / 2
		}), s.addCircle(i, a, .2, "pole");
	}
	let g = null, _ = new e.Matrix4(), v = new e.Euler(), y = new e.Quaternion(), b = new e.Vector3(), x = new e.Vector3(), S = () => {
		h.forEach((e, t) => {
			v.set(0, e.ry, e.a, "YXZ"), y.setFromEuler(v), g.setMatrixAt(t, _.compose(b.set(e.x, 1.05, e.z), y, x.set(e.len, 1, 1)));
		}), g.instanceMatrix.needsUpdate = !0;
	};
	if (h.length) {
		let n = document.createElement("canvas");
		n.width = 64, n.height = 4;
		let r = n.getContext("2d");
		for (let e = 0; e < 8; e++) r.fillStyle = e % 2 ? "#f4f4f4" : "#d11f1f", r.fillRect(e * 8, 0, 8, 4);
		let a = new e.CanvasTexture(n);
		a.colorSpace = e.SRGBColorSpace, g = new e.InstancedMesh(new e.BoxGeometry(1, .12, .12).translate(.5, 0, 0), new e.MeshStandardMaterial({
			map: a,
			roughness: .6
		}), h.length), g.castShadow = !0, g.frustumCulled = !1, i.add(g);
		let o = [], s = [];
		for (let t of h) {
			o.push(new e.CylinderGeometry(.1, .12, 1.2, 6).translate(t.x, .6, t.z), new e.BoxGeometry(.35, .5, .35).translate(t.x, 1, t.z));
			let n = new e.CylinderGeometry(.06, .06, 3.2, 5).translate(0, 1.6, 0), r = (t) => new e.BoxGeometry(1.4, .22, .04).rotateZ(t).translate(0, 2.9, .06);
			for (let i of [
				n,
				r(.6),
				r(-.6)
			]) s.push(i.applyMatrix4(new e.Matrix4().makeRotationY(t.ry + Math.PI / 2).setPosition(t.x - t.Dx * .7, 0, t.z - t.Dz * .7)));
		}
		let c = (n, r) => {
			let a = new e.Mesh(t(n.map((e) => e.index ? e.toNonIndexed() : e)), r);
			a.castShadow = !0, i.add(a);
		};
		c(o, new e.MeshStandardMaterial({
			color: 15263976,
			roughness: .6
		})), c(s, new e.MeshStandardMaterial({
			color: 16053492,
			roughness: .6
		})), S();
	}
	let C = new e.Group();
	C.name = "GtaQuilmesTrains", i.add(C);
	let w = new ze(C, n), T = null;
	return {
		trains: w,
		dynamic: C,
		update(e) {
			if (w.update(e), !g || !w.trains.length) return;
			T ||= m.map((e) => w.trains.map((t) => {
				let n = t.track.project(e.x, e.z);
				return n.d < 20 ? n.s : null;
			}));
			let t = m.map((e, t) => w.trains.some((e, n) => T[t][n] !== null && Math.abs(e.s - T[t][n]) < 250)), n = !1;
			for (let r of h) {
				let i = t[m.indexOf(r.l)] ? 0 : Math.PI / 2 - .05, a = r.a + Math.sign(i - r.a) * Math.min(Math.abs(i - r.a), e * .9);
				a !== r.a && (r.a = a, n = !0);
			}
			n && S();
		}
	};
}
//#endregion
export { Ge as buildGtaWorld };
