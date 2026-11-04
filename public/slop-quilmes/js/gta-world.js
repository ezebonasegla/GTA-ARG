import * as e from "three";
import { mergeGeometries as t } from "three/addons/utils/BufferGeometryUtils.js";
import "three/addons/loaders/GLTFLoader.js";
import "three/addons/loaders/OBJLoader.js";
import "three/addons/loaders/DRACOLoader.js";
//#region src/world/geo.js
function n(e) {
	let t = e >>> 0;
	return function() {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function r(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return t >>> 0;
}
function i(e) {
	let t = 0;
	for (let n = 0, r = e.length - 1; n < e.length; r = n++) t += (e[r][0] - e[n][0]) * (e[r][1] + e[n][1]);
	return t / 2;
}
function a(e, t, n) {
	let r = !1;
	for (let i = 0, a = n.length - 1; i < n.length; a = i++) {
		let o = n[i][0], s = n[i][1], c = n[a][0], l = n[a][1];
		s > t != l > t && e < (c - o) * (t - s) / (l - s) + o && (r = !r);
	}
	return r;
}
function o(e, t, n, r, i, a) {
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
function s(e) {
	let t = Infinity, n = Infinity, r = -Infinity, i = -Infinity;
	for (let [a, o] of e) a < t && (t = a), o < n && (n = o), a > r && (r = a), o > i && (i = o);
	return {
		minX: t,
		minZ: n,
		maxX: r,
		maxZ: i
	};
}
var c = class {
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
function l(e, t, n, r = 12) {
	let i = null, s = r;
	for (let c of e.query(t - r, n - r, t + r, n + r)) {
		if (a(t, n, c.pts)) return c;
		let e = c.pts;
		for (let r = 0, a = e.length - 1; r < e.length; a = r++) {
			let l = Math.sqrt(o(t, n, e[a][0], e[a][1], e[r][0], e[r][1])[3]);
			l < s && (s = l, i = c);
		}
	}
	return i;
}
function u(e, t = 0, n = 0) {
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
var d = class n {
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
function f(t) {
	let n = new e.Matrix4().makeRotationY(Math.atan2(-t.uz, t.ux));
	return n.setPosition(t.cx, 0, t.cz), n;
}
var p = new e.Matrix4();
function m(t, n, r, i, a = 0, o = 1) {
	let s = new e.Matrix4().makeRotationY(a).scale(new e.Vector3(o, o, o)).setPosition(n, r, i);
	return p.copy(t).multiply(s).clone();
}
function h(e, t, n) {
	return [e.cx + e.ux * t - e.uz * n, e.cz + e.uz * t + e.ux * n];
}
function g(t, n, r, i = 6) {
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
var _ = (e, t, n, r) => {
	let i = g(e, t, n, r);
	return i.translate(0, t / 2, 0), i;
};
function v(t, n, r) {
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
function y(t, n, r) {
	let i = document.createElement("canvas");
	i.width = t, i.height = n, r(i.getContext("2d"), t, n);
	let a = new e.CanvasTexture(i);
	return a.colorSpace = e.SRGBColorSpace, a.anisotropy = 4, a;
}
function b(e, t, n, r = 1024, i = 160, a = "bold 96px Arial, sans-serif") {
	return y(r, i, (o) => {
		o.fillStyle = t, o.fillRect(0, 0, r, i), o.strokeStyle = n, o.lineWidth = 8, o.strokeRect(10, 10, r - 20, i - 20), o.fillStyle = n, o.font = a, o.textAlign = "center", o.textBaseline = "middle", o.fillText(e, r / 2, i / 2 + 4, r - 60);
	});
}
function x() {
	return y(300, 200, (e) => {
		e.fillStyle = "#74acdf", e.fillRect(0, 0, 300, 200), e.fillStyle = "#ffffff", e.fillRect(0, 67, 300, 66), e.fillStyle = "#f6b40e", e.beginPath(), e.arc(150, 100, 20, 0, Math.PI * 2), e.fill();
		for (let t = 0; t < 16; t++) {
			let n = t / 16 * Math.PI * 2;
			e.beginPath(), e.moveTo(150 + Math.cos(n) * 18, 100 + Math.sin(n) * 18), e.lineTo(150 + Math.cos(n + .1) * 30, 100 + Math.sin(n + .1) * 30), e.lineTo(150 + Math.cos(n - .1) * 30, 100 + Math.sin(n - .1) * 30), e.fill();
		}
	});
}
function S(e, t) {
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
		let [n, o] = h(e, a.nu * (a.off + 2), a.nv * (a.off + 2)), s = t.nearest(n, o, 80)?.dist ?? 999;
		s < i && (i = s, r = a);
	}
	return r;
}
function C(t, { root: n, collision: r, graph: i, tex: a }) {
	let o = [], s = [], c = (t, n = {}) => new e.MeshStandardMaterial({
		color: t,
		roughness: .8,
		...n
	}), l = {
		stone: c(15787727, { map: a.church.map }),
		stucco: c(15721676),
		stuccoDark: c(14207400),
		slate: c(5661290, { roughness: .6 }),
		tile: c(11556410, { map: a.roofTile }),
		dome: c(7314584, {
			roughness: .4,
			metalness: .5
		}),
		gold: c(14202458, {
			roughness: .3,
			metalness: .9
		}),
		dark: c(2762018, { roughness: .9 }),
		brick: c(16777215, { map: a.brick.map }),
		concrete: c(12170668, { roughness: .95 }),
		metal: c(7305843, {
			roughness: .5,
			metalness: .6
		}),
		canopy: c(4153164, {
			roughness: .6,
			metalness: .3
		}),
		cream: c(15853513),
		white: c(16185078, { roughness: .5 }),
		wood: c(7031343),
		iron: c(1975334, {
			roughness: .5,
			metalness: .6
		}),
		bronze: c(5916210, {
			roughness: .45,
			metalness: .7
		}),
		water: c(6263720, {
			roughness: .05,
			metalness: .2
		}),
		silo: c(13225166, {
			roughness: .35,
			metalness: .7
		}),
		lamp: c(16774358, {
			emissive: 16765578,
			emissiveIntensity: 0
		}),
		flood: c(16777215, {
			emissive: 16054527,
			emissiveIntensity: 0
		}),
		redCross: c(16777215, {
			map: y(128, 128, (e) => {
				e.fillStyle = "#fff", e.fillRect(0, 0, 128, 128), e.fillStyle = "#d62828", e.fillRect(44, 12, 40, 104), e.fillRect(12, 44, 104, 40);
			}),
			emissive: 16724016,
			emissiveIntensity: 0
		}),
		flag: new e.MeshStandardMaterial({
			map: x(),
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
	o.push([l.lamp, 2.5], [l.flood, 4], [l.redCross, .8]);
	let p = new d(), g = new d(), C = (e) => (t.specials || []).filter((t) => t.type === e);
	for (let n of t.buildings) {
		let t = n.special;
		if (!t || t.type !== "cathedral" && t.type !== "church") continue;
		let a = t.box, o = f(a), s = a.hu * 2, c = a.hv * 2, u = (i.nearest(...h(a, a.hu + 3, 0), 80)?.dist ?? 999) <= (i.nearest(...h(a, -a.hu - 3, 0), 80)?.dist ?? 999) ? 1 : -1, d = u > 0 ? 0 : Math.PI;
		if (t.type === "cathedral") {
			let t = c * .56, i = (c - t) / 2, a = t / 2, f = s - 7 - a, h = u * (a - 7) / 2;
			p.add(_(f, 17, t, 10), l.stone, m(o, h, 0, 0));
			for (let e of [-1, 1]) {
				p.add(_(f, 10, i, 10), l.stone, m(o, h, 0, e * (t / 2 + i / 2))), p.add(_(f, .6, i + .4), l.slate, m(o, h, 10, e * (t / 2 + i / 2)));
				for (let t = -f / 2 + 4; t < f / 2 - 2; t += 6) p.add(_(1.2, 9, 1.2), l.stuccoDark, m(o, h + t, 0, e * (c / 2 + .3)));
			}
			p.add(v(f, t + .6, 6), l.slate, m(o, h, 17, 0));
			let g = new e.CylinderGeometry(a, a, 15, 20, 1, !1, 0, Math.PI);
			g.translate(0, 15 / 2, 0), p.add(g, l.stucco, m(o, -u * (s / 2 - a), 0, 0, d + Math.PI));
			let y = new e.SphereGeometry(a, 20, 8, Math.PI / 2, Math.PI, 0, Math.PI / 2);
			p.add(y, l.slate, m(o, -u * (s / 2 - a), 15, 0, d + Math.PI));
			let b = u * (s / 2 - 3.5);
			p.add(_(7, 21, c), l.stone, m(o, b, 0, 0));
			let x = v(7.5, c + .6, 5.5);
			p.add(x, l.stucco, m(o, b + u * .2, 21, 0)), p.add(_(.6, 1.2, c + .8), l.stuccoDark, m(o, b + u * 3.5, 20, 0)), p.add(_(.4, 6, 3.4), l.dark, m(o, u * (s / 2 + .05), 0, 0));
			for (let e of [-1, 1]) p.add(_(.4, 4.5, 2.2), l.dark, m(o, u * (s / 2 + .05), 0, e * c * .3));
			let S = new e.CylinderGeometry(2.3, 2.3, .4, 20);
			S.rotateZ(Math.PI / 2), p.add(S, l.dark, m(o, u * (s / 2 + .1), 13, 0));
			for (let t of [-1, 1]) for (let n of [.18, .42]) {
				let r = new e.CylinderGeometry(.45, .5, 17, 12);
				r.translate(0, 8.5, 0), p.add(r, l.cream, m(o, u * (s / 2 + .5), 0, t * c * n));
			}
			let C = u * (s / 2 - 4);
			p.add(_(7.5, 30, 7.5), l.stone, m(o, C, 0, 0)), p.add(_(8.3, 1, 8.3), l.stuccoDark, m(o, C, 30, 0)), p.add(_(6.6, 6, 6.6), l.stucco, m(o, C, 31, 0));
			for (let [e, t] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) p.add(_(e ? .3 : 2.4, 4, t ? .3 : 2.4), l.dark, m(o, C + e * 3.35, 32, t * 3.35));
			p.add(_(7.2, .8, 7.2), l.stuccoDark, m(o, C, 37, 0));
			let w = new e.CylinderGeometry(2.8, 3.1, 3.5, 8);
			w.translate(0, 1.75, 0), p.add(w, l.stucco, m(o, C, 37.8, 0)), p.add(new e.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), l.dome, m(o, C, 41.3, 0));
			let T = new e.CylinderGeometry(.7, .8, 2, 8);
			T.translate(0, 1, 0), p.add(T, l.stucco, m(o, C, 44, 0)), p.add(_(.3, 3.2, .3), l.gold, m(o, C, 46, 0)), p.add(_(.3, .3, 1.6), l.gold, m(o, C, 48, 0)), r.addPolygon(n.pts, 20, "building");
		} else {
			let t = Math.min(10, Math.max(8, n.h));
			p.add(_(s, t, c, 10), l.stone, m(o, 0, 0, 0)), p.add(v(s + .6, c + .8, Math.min(c * .4, 7)), l.tile, m(o, 0, t, 0));
			let i = v(.6, c + .8, Math.min(c * .4, 7));
			p.add(i, l.stucco, m(o, u * (s / 2 + .2), t, 0)), p.add(_(.4, 4.5, 2.6), l.dark, m(o, u * (s / 2 + .05), 0, 0));
			let a = Math.min(5, c * .35), d = u * (s / 2 - a / 2), f = c / 2 - a / 2, h = t + 9;
			p.add(_(a, h, a), l.stucco, m(o, d, 0, f));
			for (let [e, t] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) p.add(_(e ? .3 : 1.4, 2.4, t ? .3 : 1.4), l.dark, m(o, d + e * a / 2, h - 3.5, f + t * a / 2));
			let g = new e.ConeGeometry(a * .72, 6, 4);
			g.rotateY(Math.PI / 4), g.translate(0, 3, 0), p.add(g, l.slate, m(o, d, h, f)), p.add(_(.2, 2.2, .2), l.gold, m(o, d, h + 6, f)), p.add(_(.2, .2, 1.1), l.gold, m(o, d, h + 7.4, f)), r.addPolygon(n.pts, t, "building");
		}
	}
	for (let n of t.buildings) {
		let t = n.special;
		if (!t || t.type !== "civic" && t.type !== "hospital") continue;
		let r = t.box, a = f(r), s = S(r, i), c = -s.nv, u = s.nu, d = s.nu ? Math.PI / 2 : 0;
		if (t.type === "civic") {
			let r = Math.min(s.half * 2 * .7, 26), i = Math.min(n.h - 2, 10), o = Math.max(4, Math.round(r / 3.5) | 1), f = s.off + 2.6;
			for (let t = 0; t < o; t++) {
				let n = -r / 2 + r * t / (o - 1), d = new e.CylinderGeometry(.42, .5, i, 14);
				d.translate(0, i / 2 + .9, 0), p.add(d, l.cream, m(a, s.nu * f + c * n, 0, s.nv * f + u * n));
			}
			p.add(_(r + 2, 1.2, 4.2), l.cream, m(a, s.nu * (s.off + 2.1), i + .9, s.nv * (s.off + 2.1), d));
			let h = v(4.2, r + 2.4, 2.8);
			p.add(h, l.stucco, m(a, s.nu * (s.off + 2.1), i + 2.1, s.nv * (s.off + 2.1), d + Math.PI / 2));
			for (let e = 0; e < 3; e++) p.add(_(r + 3 - e, .3, 5.2 - e * .7), l.concrete, m(a, s.nu * (s.off + 2.4 - e * .3), e * .3, s.nv * (s.off + 2.4 - e * .3), d));
			if (t.flag) {
				let o = s.nu * (s.off - 2), c = s.nv * (s.off - 2), u = new e.CylinderGeometry(.08, .1, 9, 8);
				u.translate(0, 4.5, 0), p.add(u, l.metal, m(a, o, n.h, c));
				let d = new e.PlaneGeometry(3, 2);
				d.translate(1.5, 0, 0), p.add(d, l.flag, m(a, o, n.h + 7.8, c, Math.atan2(s.nu, s.nv) + Math.PI / 2));
				let f = new e.PlaneGeometry(Math.min(r, 18), 1.6), h = new e.MeshStandardMaterial({
					map: b(t.name.toUpperCase(), "#efe4cc", "#3a3024"),
					roughness: .8
				});
				p.add(f, h, m(a, s.nu * (s.off + 4.35), i + 1.5, s.nv * (s.off + 4.35), Math.atan2(s.nu, s.nv)));
			}
		} else {
			let r = Math.atan2(s.nu, s.nv), i = new e.PlaneGeometry(2.6, 2.6);
			p.add(i, l.redCross, m(a, s.nu * (s.off + .08), n.h - 2.2, s.nv * (s.off + .08), r)), p.add(_(8, .3, 4), l.white, m(a, s.nu * (s.off + 2), 3.2, s.nv * (s.off + 2), d));
			for (let e of [-3.6, 3.6]) p.add(_(.2, 3.2, .2), l.metal, m(a, s.nu * (s.off + 3.8) + c * e, 0, s.nv * (s.off + 3.8) + u * e));
			let f = new e.PlaneGeometry(Math.min(s.half * 1.6, 16), 1.4), h = new e.MeshStandardMaterial({
				map: b(t.name.toUpperCase(), "#ffffff", "#1d4e89"),
				emissive: 16777215,
				emissiveIntensity: 0
			});
			h.emissiveMap = h.map, o.push([h, .6]), p.add(f, h, m(a, s.nu * (s.off + .1), 4.4, s.nv * (s.off + .1), r));
		}
	}
	for (let t of C("station")) {
		let n = {
			cx: t.cx,
			cz: t.cz,
			ux: t.ux,
			uz: t.uz
		}, i = f(n), a = t.length / 2, o = 1.05, s = 6.5, c = [t.lo - 1.7 - s / 2, t.hi + 1.7 + s / 2], d = new e.MeshStandardMaterial({
			map: b(t.name.toUpperCase(), "#1f3f8f", "#ffffff"),
			roughness: .6
		});
		for (let f of c) {
			p.add(_(t.length, o, s, 3), l.concrete, m(i, 0, 0, f));
			let c = f < t.lo ? f + s / 2 - .25 : f - s / 2 + .25;
			g.add(new e.PlaneGeometry(t.length, .35).rotateX(-Math.PI / 2), new e.MeshBasicMaterial({ color: 15255088 }), m(i, 0, 1.06, c));
			for (let t = -48; t <= 48; t += 12) {
				let n = new e.CylinderGeometry(.12, .15, 3.6, 8);
				n.translate(0, 2.85, 0), p.add(n, l.canopy, m(i, t, 0, f));
			}
			p.add(_(98, .25, 6.1), l.canopy, m(i, 0, 4.65, f)), p.add(v(98, 6.3, 1.2), l.metal, m(i, 0, 4.9, f));
			for (let e of [-1, 1]) p.add(_(98, .5, .08), l.cream, m(i, 0, 4.15, f + e * (s / 2 - .25)));
			for (let t of [
				-a + 20,
				0,
				a - 20
			]) {
				for (let e of [-2.2, 2.2]) p.add(_(.12, 2.6, .12), l.iron, m(i, t + e, o, f));
				p.add(new e.PlaneGeometry(4.6, .8), d, m(i, t, 3.55, f + .05)), p.add(new e.PlaneGeometry(4.6, .8), d, m(i, t, 3.55, f - .05, Math.PI));
			}
			for (let e = -40; e <= 40; e += 16) p.add(_(2, .45, .5), l.wood, m(i, e + 6, o, f));
			for (let t of [-1, 1]) {
				let n = new e.BoxGeometry(12, .2, 5.5);
				n.rotateZ(t * Math.atan2(o, 12)), p.add(n, l.concrete, m(i, t * (a + 5.8), o / 2, f));
			}
			r.addPolygon(u({
				cx: 0,
				cz: 0,
				ux: 1,
				uz: 0,
				vx: 0,
				vz: 1,
				hu: a,
				hv: s / 2
			}).map(([e, t]) => h(n, e, t + f)), o, "platform");
		}
		let y = t.houseSide > 0 ? t.hi + 1.7 + s + 5.5 : t.lo - 1.7 - s - 5.5;
		p.add(_(34, 7, 10), l.brick, m(i, 0, 0, y)), p.add(v(35, 11, 3.2), l.tile, m(i, 0, 7, y)), p.add(_(10, 9.5, 11), l.brick, m(i, 0, 0, y));
		let x = v(11, 12, 3);
		x.rotateY(Math.PI / 2), p.add(x, l.tile, m(i, 0, 9.5, y));
		let S = new e.PlaneGeometry(12, 1.6);
		p.add(S, d, m(i, 0, 5.4, y + (t.houseSide > 0 ? 5.06 : -5.06), t.houseSide > 0 ? 0 : Math.PI)), p.add(S, d, m(i, 0, 5.4, y - (t.houseSide > 0 ? 5.06 : -5.06), t.houseSide > 0 ? Math.PI : 0)), r.addPolygon([
			[-17, -5],
			[17, -5],
			[17, 5],
			[-17, 5]
		].map(([e, t]) => h(n, e, t + y)), 9, "building");
	}
	let w = (t) => {
		let n = t.clone();
		return n.side = e.DoubleSide, n;
	}, T = {
		concrete: w(l.concrete),
		white: w(l.white),
		iron: l.iron,
		metal: w(l.metal),
		blue: w(c(1784460, { roughness: .6 })),
		celeste: w(c(7711451, { roughness: .6 }))
	}, E = (e, t, n, r = 1.1) => {
		let i = [[0, 0]];
		for (let r = 0; r < n; r++) i.push([e * r / n, t * (r + 1) / n], [e * (r + 1) / n, t * (r + 1) / n]);
		return i.push([e - .35, t], [e - .35, t + r], [e, t + r], [e, 0]), i;
	}, D = (t, n, r, i, a, o, s) => {
		let c = new e.Shape(n.map(([t, n]) => new e.Vector2(t, n))), l = new e.ExtrudeGeometry(c, {
			depth: o,
			bevelEnabled: !1
		}), u = new e.Vector3(r, 0, i), d = new e.Vector3(-i, 0, r), f = new e.Matrix4().makeBasis(u, new e.Vector3(0, 1, 0), d).setPosition(u.clone().multiplyScalar(a).addScaledVector(d, -o / 2));
		p.add(l, s, t.clone().multiply(f));
	}, O = (t, n, r, i, a, o, s) => {
		let c = r > 0 ? Math.PI / 2 : Math.PI * 1.5, l = i > 0 ? 0 : Math.PI, u = Math.abs(c - l) > Math.PI ? Math.max(c, l) : Math.min(c, l), d = new e.LatheGeometry(n.map(([t, n]) => new e.Vector2(Math.max(.01, t), n)), 10, u, Math.PI / 2);
		p.add(d, s, m(t, r * a, 0, i * o));
	}, k = (e, t, n, i, a, o, s) => {
		let c = [
			[-o / 2, i],
			[o / 2, i],
			[o / 2, i + a],
			[-o / 2, i + a]
		];
		r.addPolygon(c.map(([r, i]) => t ? h(e, t * i, r) : h(e, r, n * i)), s, "building");
	}, A = (t, n, i, a) => {
		for (let [o, s] of [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		]) {
			let c = o * (t.hu + i), u = s * (t.hv + i), d = new e.CylinderGeometry(.45, .8, a, 8);
			d.translate(0, a / 2, 0), p.add(d, l.metal, m(n, c, 0, u)), p.add(_(5, 3, .6), l.flood, m(n, c, a - 1, u, Math.atan2(-o, -s))), r.addCircle(...h(t, c, u), 1, "pole");
		}
	}, j = (t, n, r, i, a, o, s, c, l) => {
		let u = new e.MeshStandardMaterial({
			map: b(n, r, "#ffffff"),
			roughness: .6
		});
		p.add(new e.PlaneGeometry(c, l), u, m(t, i * o, s, a * o, Math.atan2(i, a)));
	};
	for (let t of C("stadium")) {
		let n = t.box, a = f(n);
		if (/centenario/i.test(t.name)) {
			let e = t.depth, o = t.height, c = E(e, o, 12), l = S(n, i);
			for (let [t, r, i, s] of [
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
			]) D(a, c, t, r, i, s, r ? T.blue : T.concrete), r && D(a, [
				[e, 0],
				[e + .08, 0],
				[e + .08, o + 1.1],
				[e, o + 1.1]
			], t, r, i, s, T.concrete), k(n, t, r, i, e, s, o), t === l.nu && r === l.nv && j(a, "ESTADIO CENTENARIO · QUILMES ATLÉTICO CLUB", "#1b3a8c", t, r, i + e + .14, o * .55, Math.min(60, s * .6), 4);
			for (let [t, i] of [
				[1, 1],
				[1, -1],
				[-1, 1],
				[-1, -1]
			]) {
				O(a, c, t, i, n.hu + 3, n.hv + 3, T.concrete);
				let o = h(n, t * (n.hu + 3 + e * .5), i * (n.hv + 3 + e * .5));
				r.addCircle(o[0], o[1], e * .6, "building");
			}
			j(a, "QUILMES", "#1b3a8c", 1, 0, n.hu + 3 + e * .55, o * .55 + 1, 26, 4.5), A(n, a, 3 + e + 4, o + 26), s.push([
				n.cx,
				n.cz,
				Math.hypot(n.hu, n.hv) + e + 10
			]);
			continue;
		}
		if (/argentino/i.test(t.name)) {
			let t = S(n, i), [r, o] = [t.nu, t.nv], c = {
				D: 12,
				H: 6,
				len: (r ? n.hv : n.hu) * 1.4,
				off: (r ? n.hu : n.hv) + 3
			};
			D(a, E(c.D, c.H, 8, .2), r, o, c.off, c.len, T.concrete), k(n, r, o, c.off, c.D, c.len, c.H + 5);
			let l = new e.Shape([
				[c.D - .4, 0],
				[c.D, 0],
				[c.D, c.H + 5.2],
				[c.D - .4, c.H + 5.2]
			].map(([t, n]) => new e.Vector2(t, n))), u = new e.Vector3(-o, 0, r), d = new e.Vector3(r, 0, o), f = (t) => a.clone().multiply(new e.Matrix4().makeBasis(d, new e.Vector3(0, 1, 0), u).setPosition(d.clone().multiplyScalar(t).addScaledVector(u, -c.len / 2)));
			p.add(new e.ExtrudeGeometry(l, {
				depth: c.len,
				bevelEnabled: !1
			}), T.white, f(c.off));
			let h = new e.Shape([
				[-1.2, c.H + 3.6],
				[c.D + .4, c.H + 5.2],
				[c.D + .4, c.H + 5.45],
				[-1.2, c.H + 3.85]
			].map(([t, n]) => new e.Vector2(t, n)));
			p.add(new e.ExtrudeGeometry(h, {
				depth: c.len,
				bevelEnabled: !1
			}), T.metal, f(c.off));
			let g = new e.Shape([
				[-1.3, c.H + 2.9],
				[-1.1, c.H + 2.9],
				[-1.1, c.H + 3.9],
				[-1.3, c.H + 3.9]
			].map(([t, n]) => new e.Vector2(t, n)));
			p.add(new e.ExtrudeGeometry(g, {
				depth: c.len,
				bevelEnabled: !1
			}), T.celeste, f(c.off));
			for (let t = -c.len / 2 + 3; t <= c.len / 2 - 3; t += 7) {
				let n = new e.CylinderGeometry(.12, .14, c.H + 3.7, 6);
				n.translate(0, (c.H + 3.7) / 2, 0);
				let i = c.off - .9;
				p.add(n, T.iron, r ? m(a, r * i, 0, t) : m(a, t, 0, o * i));
			}
			j(a, "CLUB ATLÉTICO ARGENTINO DE QUILMES", "#4f8fc9", -r, -o, -(c.off - 1.35), c.H + 3.4, Math.min(40, c.len * .8), 1), j(a, "ARGENTINO DE QUILMES · PLATEA 1927", "#4f8fc9", r, o, c.off + c.D + .05, c.H * .6, Math.min(34, c.len * .7), 2.6);
			let _ = 2 * ((r ? n.hv : n.hu) + 3), v = c.off;
			D(a, E(10, 5, 10), -r, -o, v, _, T.concrete), D(a, [
				[9.6, 5],
				[10, 5],
				[10, 6.1],
				[9.6, 6.1]
			], -r, -o, v, _, T.celeste), k(n, -r, -o, v, 10, _, 6);
			let y = (r ? n.hv : n.hu) + 3, b = 2 * ((r ? n.hu : n.hv) + 3);
			for (let e of [1, -1]) {
				let [t, i] = r ? [0, e] : [e, 0];
				D(a, [
					[0, 0],
					[0, 2.2],
					[.3, 2.2],
					[.3, 0]
				], t, i, y + 2, b, T.white), D(a, [
					[-.02, 1.4],
					[-.02, 1.9],
					[.32, 1.9],
					[.32, 1.4]
				], t, i, y + 2, b, T.celeste), k(n, t, i, y + 2, .3, b, 2.2);
			}
			A(n, a, 11, 22), s.push([
				n.cx,
				n.cz,
				Math.hypot(n.hu, n.hv) + 16
			]);
			continue;
		}
		let o = t.colors.map((e) => c(e, { roughness: .6 })), u = t.depth, d = t.height, v = u > 16 ? 6 : 4, y = S(n, i), x = [
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
		for (let i of x) {
			let s = i.nu === y.nu && i.nv === y.nv, c = s ? d * 1.25 : d, f = i.nu ? Math.PI / 2 : 0, g = u / v;
			for (let e = 0; e < v; e++) {
				let t = i.off + 3 + g * (e + .5);
				p.add(_(i.len, c * (e + 1) / v, g), o[e % o.length], m(a, i.nu * t, 0, i.nv * t, f));
			}
			p.add(_(i.len, c + 1.2, .6), l.concrete, m(a, i.nu * (i.off + 3 + u + .3), 0, i.nv * (i.off + 3 + u + .3), f));
			let x = i.off + 3 + u + .6, S = [
				[-i.len / 2, i.off + 3],
				[i.len / 2, i.off + 3],
				[i.len / 2, x],
				[-i.len / 2, x]
			];
			if (r.addPolygon(S.map(([e, t]) => i.nu ? h(n, i.nu * t, e) : h(n, e, i.nv * t)), c, "building"), s) {
				p.add(_(i.len, .4, u + 3), l.metal, m(a, i.nu * (i.off + 3 + u / 2), c + 4, i.nv * (i.off + 3 + u / 2), f));
				for (let t = -i.len / 2 + 4; t <= i.len / 2 - 4; t += 12) {
					let n = new e.CylinderGeometry(.25, .3, c + 4, 8);
					n.translate(0, (c + 4) / 2, 0), p.add(n, l.metal, i.nu ? m(a, i.nu * (i.off + 3 + u), 0, t) : m(a, t, 0, i.nv * (i.off + 3 + u)));
				}
				if (t.name) {
					let n = /centenario|quilmes atl/i.test(t.name) ? "QUILMES ATLÉTICO CLUB" : t.name.toUpperCase(), r = new e.MeshStandardMaterial({
						map: b(n, t.colors[1], (t.colors[0], "#ffffff")),
						roughness: .6
					}), o = Math.atan2(i.nu, i.nv) + Math.PI, s = i.off + 3 + .5;
					p.add(new e.PlaneGeometry(Math.min(40, i.len * .5), 3), r, m(a, i.nu * s, c + 2.4, i.nv * s, o)), p.add(new e.PlaneGeometry(Math.min(40, i.len * .5), 3), r, m(a, i.nu * (s + u + .4), c + 2.4, i.nv * (s + u + .4), o + Math.PI));
				}
			}
		}
		for (let [t, i] of [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		]) {
			let o = t * (n.hu + 3 + u * .7), s = i * (n.hv + 3 + u * .7), c = new e.CylinderGeometry(.5, .9, d + 22, 8);
			c.translate(0, (d + 22) / 2, 0), p.add(c, l.metal, m(a, o, 0, s));
			let f = _(5, 3, .6);
			p.add(f, l.flood, m(a, o, d + 21, s, Math.atan2(-t, -i))), r.addCircle(...h(n, o, s), 1, "pole");
		}
		t.turf && g.add(new e.PlaneGeometry(n.hu * 2, n.hv * 2).rotateX(-Math.PI / 2), c(t.turf, {
			depthWrite: !1,
			polygonOffset: !0,
			polygonOffsetFactor: -1
		}), m(a, 0, .05, 0)), s.push([
			n.cx,
			n.cz,
			Math.hypot(n.hu, n.hv) + u + 6
		]);
	}
	for (let t of C("pitch")) {
		let n = t.box, r = f(n), i = .14, a = .06, o = (t, n, o, s = 0) => g.add(new e.PlaneGeometry(t, i).rotateX(-Math.PI / 2), l.line, m(r, n, a, o, s)), s = n.hu - 1, c = n.hv - 1;
		o(s * 2, 0, c), o(s * 2, 0, -c), o(c * 2, s, 0, Math.PI / 2), o(c * 2, -s, 0, Math.PI / 2), o(c * 2, 0, 0, Math.PI / 2);
		let u = Math.min(9.15, c * .3);
		g.add(new e.RingGeometry(u - i / 2, u + i / 2, 40).rotateX(-Math.PI / 2), l.line, m(r, 0, a, 0));
		let d = Math.min(7.32, c * .3), h = d > 5 ? 2.44 : 2, v = Math.min(16.5, s * .3), y = Math.min(40.3, c * 1.3);
		for (let t of [-1, 1]) {
			o(y, t * (s - v), 0, Math.PI / 2), o(v, t * (s - v / 2), y / 2), o(v, t * (s - v / 2), -y / 2);
			for (let n of [-1, 1]) {
				let i = new e.CylinderGeometry(.06, .06, h, 6);
				i.translate(0, h / 2, 0), p.add(i, l.white, m(r, t * s, 0, n * d / 2));
			}
			p.add(_(.12, .12, d), l.white, m(r, t * s, h - .06, 0)), p.add(_(.1, .1, d), l.white, m(r, t * (s + 1.5), 0, 0));
		}
	}
	for (let t of C("brewery")) {
		let n = t.box, i = f(n), a = t.h || 12;
		for (let t = 0; t < 4; t++) for (let r of [-5.2, 5.2]) {
			let o = new e.CylinderGeometry(4.5, 4.5, a + 18, 20);
			o.translate(0, (a + 18) / 2, 0), p.add(o, l.silo, m(i, n.hu - 8 - t * 9.6, 0, r));
			let s = new e.ConeGeometry(4.6, 2.2, 20);
			s.translate(0, a + 19.1, 0), p.add(s, l.silo, m(i, n.hu - 8 - t * 9.6, 0, r));
		}
		p.add(_(40, 3, 1.4), l.metal, m(i, n.hu - 22, a + 18, 0));
		let s = new e.CylinderGeometry(1.7, 2.8, a + 38, 16);
		s.translate(0, (a + 38) / 2, 0), p.add(s, l.brick, m(i, -n.hu + 10, 0, 0)), p.add(new e.CylinderGeometry(2, 2, 1.2, 16).translate(0, a + 38, 0), l.stuccoDark, m(i, -n.hu + 10, 0, 0));
		let c = new e.MeshStandardMaterial({
			map: y(1024, 256, (e, t, n) => {
				e.fillStyle = "#12308a", e.fillRect(0, 0, t, n), e.fillStyle = "#ffffff", e.fillRect(0, n - 46, t, 14), e.fillStyle = "#d7263d", e.fillRect(0, n - 32, t, 14), e.fillStyle = "#ffffff", e.font = "italic bold 170px Georgia, serif", e.textAlign = "center", e.textBaseline = "middle", e.fillText("Quilmes", t / 2, n / 2 - 16);
			}),
			emissive: 16777215,
			emissiveIntensity: 0,
			roughness: .5
		});
		c.emissiveMap = c.map, o.push([c, .9]);
		let u = Math.min(70, n.hu * .5), d = u / 4;
		for (let e of [
			-u * .4,
			0,
			u * .4
		]) p.add(_(.5, 6, .5), l.iron, m(i, e, a, 0));
		for (let t of [0, Math.PI]) p.add(new e.PlaneGeometry(u, d), c, m(i, 0, a + 5 + d / 2, t ? -.15 : .15, t));
		r.addCircle(...h(n, -n.hu + 10, 0), 2.8, "building");
	}
	for (let t of C("plaza")) {
		let n = t.box, r = f(n), i = n.hu - 3, a = n.hv - 3, o = (t, i, a, o, c) => {
			let u = Math.hypot(a - t, o - i), d = new e.PlaneGeometry(u, c).rotateX(-Math.PI / 2), f = d.attributes.uv;
			for (let e = 0; e < f.count; e++) f.setXY(e, f.getX(e) * u / 4, f.getY(e) * c / 4);
			g.add(d, l.path, m(r, (t + a) / 2, .045, (i + o) / 2, -Math.atan2(o - i, a - t)));
			for (let e = 0; e <= u; e += 6) s.push([...h(n, t + (a - t) * e / u, i + (o - i) * e / u), c / 2 + 1.5]);
		};
		o(-i, -a, i, -a, 3), o(-i, a, i, a, 3), o(-i, -a, -i, a, 3), o(i, -a, i, a, 3), o(-i, -a, i, a, 3.2), o(-i, a, i, -a, 3.2), o(-i, 0, i, 0, 2.6), o(0, -a, 0, a, 2.6);
		let c = new e.CircleGeometry(Math.min(9, a * .3), 32).rotateX(-Math.PI / 2);
		g.add(c, l.path, m(r, 0, .05, 0)), s.push([
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
				let s = t * i * e, c = n * a * e, u = -Math.sin(o) * 2.4, d = Math.cos(o) * 2.4, f = -o;
				p.add(_(1.8, .45, .5), l.wood, m(r, s + u, 0, c + d, f)), p.add(_(1.8, .5, .08), l.wood, m(r, s + u * 1.1, .45, c + d * 1.1, f));
			}
			let s = t * i * .5, c = n * a * .5;
			p.add(new e.CylinderGeometry(.07, .1, 3.6, 6).translate(0, 1.8, 0), l.iron, m(r, s, 0, c)), p.add(new e.SphereGeometry(.32, 12, 8), l.lamp, m(r, s, 3.8, c));
		}
		M(t.monument, r, n);
	}
	function M(t, n, i) {
		if (t === "equestrian") {
			p.add(_(7, 1, 4.6), l.stuccoDark, m(n, 0, 0, 0)), p.add(_(5.6, 4.5, 3), l.stone, m(n, 0, 1, 0)), p.add(_(6, .5, 3.4), l.stuccoDark, m(n, 0, 5.5, 0));
			let t = 1.7, a = (r, i, a, o, s, c, u = 0) => {
				let d = new e.BoxGeometry(r * t, i * t, a * t);
				d.rotateZ(u), d.translate(o * t, 6 + s * t, c * t), p.add(d, l.bronze, n.clone());
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
			].map(([e, t]) => h(i, e, t)), 6, "building");
		} else if (t === "obelisk") {
			p.add(_(4, .8, 4), l.stuccoDark, m(n, 0, 0, 0));
			let t = new e.CylinderGeometry(.9, 1.4, 12, 4);
			t.rotateY(Math.PI / 4), t.translate(0, 6.8, 0), p.add(t, l.cream, m(n, 0, 0, 0));
			let a = new e.ConeGeometry(.95, 1.6, 4);
			a.rotateY(Math.PI / 4), a.translate(0, 13.6, 0), p.add(a, l.cream, m(n, 0, 0, 0)), r.addCircle(i.cx, i.cz, 2.2, "building");
		} else if (t === "fountain") {
			let t = new e.CylinderGeometry(5, 5.2, .7, 32, 1, !0);
			t.translate(0, .35, 0), p.add(t, l.stone, m(n, 0, 0, 0)), p.add(new e.TorusGeometry(5.05, .18, 6, 32).rotateX(Math.PI / 2), l.stone, m(n, 0, .7, 0)), p.add(new e.CircleGeometry(5, 32).rotateX(-Math.PI / 2), l.water, m(n, 0, .55, 0)), p.add(new e.CylinderGeometry(.5, .7, 2.2, 12).translate(0, 1.1, 0), l.stone, m(n, 0, 0, 0)), p.add(new e.CylinderGeometry(1.8, .6, .5, 20).translate(0, 2.3, 0), l.stone, m(n, 0, 0, 0)), p.add(new e.CylinderGeometry(.25, .35, 1.2, 10).translate(0, 3, 0), l.stone, m(n, 0, 0, 0)), p.add(new e.SphereGeometry(.45, 12, 8).translate(0, 3.8, 0), l.stone, m(n, 0, 0, 0)), r.addCircle(i.cx, i.cz, 5.3, "building");
		} else p.add(_(1.2, 2, 1.2), l.stone, m(n, 0, 0, 0)), p.add(_(.8, .5, .4), l.bronze, m(n, 0, 2, 0)), p.add(_(.36, .45, .36), l.bronze, m(n, 0, 2.5, 0)), r.addCircle(i.cx, i.cz, .9, "building");
	}
	return p.build(n), g.build(n, {
		cast: !1,
		order: -5.5
	}), {
		keepOut: s,
		setNight(e) {
			for (let [t, n] of o) t.emissiveIntensity = e * n;
		}
	};
}
//#endregion
//#region src/world/metrobus.js
var w = 3.6, T = 2.6, E = 34, D = .32, O = (() => {
	let t = (t, n, r, i, a, o) => new e.BoxGeometry(t, n, r).translate(i, a + n / 2, o), n = [t(T, D, E, 0, 0, 0)], r = [t(.3, .01, E, -2.6 / 2 + .15, D, 0)], i = [t(3, .12, E * .7, .1, 3, 0)];
	for (let e = -11.22; e <= E * .34; e += E * .165) i.push(t(.12, 2.7, .12, T / 2 - .25, D, e));
	return i.push(t(.1, 1, E, T / 2 - .05, D, 0)), {
		deck: n,
		edge: r,
		frame: i,
		glass: [t(.03, 1.6, E * .66, T / 2 - .12, 1.32, 0)],
		sign: [t(.08, .7, 3.2, .1, 3.12, E * .35 - 1.6)]
	};
})();
function k(t, n, r, i, a) {
	let o = -a, s = i, c = 4.9 + .15, l = n + o * c, u = r + s * c, d = new e.Matrix4().makeBasis(new e.Vector3(o, 0, s), new e.Vector3(0, 1, 0), new e.Vector3(i, 0, a)).setPosition(l, 0, u), f = {};
	for (let [e, t] of Object.entries(O)) f[e] = t.map((e) => e.clone().applyMatrix4(d));
	return {
		geos: f,
		corners: [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		].map(([e, t]) => [l + o * e * T / 2 + i * t * E / 2, u + s * e * T / 2 + a * t * E / 2]),
		height: D,
		wait: {
			x: l - o * .3,
			z: u - s * .3,
			nx: o,
			nz: s,
			dx: i,
			dz: a,
			len: E * .7
		}
	};
}
function A() {
	let t = document.createElement("canvas");
	t.width = 256, t.height = 64;
	let n = t.getContext("2d");
	n.fillStyle = "#e4002b", n.fillRect(0, 0, 256, 64), n.fillStyle = "#fff", n.font = "bold 34px Arial, sans-serif", n.textAlign = "center", n.textBaseline = "middle", n.fillText("METROBUS", 128, 34);
	let r = new e.CanvasTexture(t);
	return r.colorSpace = e.SRGBColorSpace, r;
}
//#endregion
//#region src/world/geobuf.js
var j = class {
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
}, M = [
	0,
	1,
	2,
	0,
	2,
	3
], N = [
	0,
	2,
	1,
	0,
	3,
	2
], P = (e) => Math.max(-127, Math.min(127, Math.round(e * 127))), F = (e) => Math.max(0, Math.min(255, Math.round(e * 255)));
function ee(e) {
	for (let t of Object.values(e.attributes)) t.onUpload(function() {
		this.array = null;
	});
	return e;
}
var I = class {
	constructor(e = !1) {
		this.layered = e, this.pos = new j(Float32Array), this.nor = new j(Int8Array), this.uv = new j(Float32Array), this.col = new j(Uint8Array), this.lay = new j(Float32Array);
	}
	tri(e, t, n, r, i, a, o, s, c = 0) {
		let l = t[0] - e[0], u = t[1] - e[1], d = t[2] - e[2], f = n[0] - e[0], p = n[1] - e[1], m = n[2] - e[2], h = u * m - d * p, g = d * f - l * m, _ = l * p - u * f;
		s && h * s[0] + g * s[1] + _ * s[2] < 0 && ([t, n] = [n, t], [i, a] = [a, i], h = -h, g = -g, _ = -_);
		let v = Math.hypot(h, g, _) || 1;
		h = P(h / v), g = P(g / v), _ = P(_ / v);
		let y = F(o.r), b = F(o.g), x = F(o.b);
		for (let [o, s] of [
			[e, r],
			[t, i],
			[n, a]
		]) this.pos.push(o[0], o[1], o[2]), this.nor.push(h, g, _), this.nor.push(0), this.uv.push(s[0], s[1]), this.col.push(y, b, x), this.col.push(255), this.layered && this.lay.push(c);
	}
	quadRaw(e, t, n, r, i) {
		let a = e[3] - e[0], o = e[4] - e[1], s = e[5] - e[2], c = e[6] - e[0], l = e[7] - e[1], u = e[8] - e[2], d = o * u - s * l, f = s * c - a * u, p = a * l - o * c, m = d * n + f * r + p * i < 0;
		m && (d = -d, f = -f, p = -p);
		let h = Math.hypot(d, f, p) || 1, g = P(d / h), _ = P(f / h), v = P(p / h), y = F(t.r), b = F(t.g), x = F(t.b), S = m ? N : M;
		for (let t = 0; t < 6; t++) {
			let n = S[t] * 3;
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
}, L = new e.Vector3(), R = new e.Vector3(), z = new e.Matrix3(), B = new e.Matrix4(), te = class {
	constructor() {
		this.tpls = [], this.tpl = new j(Uint16Array), this.mat = new j(Float32Array), this.col = new j(Float32Array);
	}
	add(e, t, n, r = 0) {
		let i = this.tpls.indexOf(e);
		i < 0 && (i = this.tpls.push(e) - 1), this.tpl.push(i);
		let a = t.elements;
		for (let e = 0; e < 16; e += 2) this.mat.push(a[e], a[e + 1]);
		this.col.push(n.r, n.g, n.b), this.col.push(r);
	}
	get empty() {
		return this.tpl.length === 0;
	}
	bakeStep(t) {
		let n = performance.now(), r = this.job;
		if (!r) {
			let e = 0;
			for (let t = 0; t < this.tpl.length; t++) e += this.tpls[this.tpl.a[t]].attributes.position.count;
			r = this.job = {
				k: 0,
				o: 0,
				o4: 0,
				pos: new Float32Array(e * 3),
				nor: new Int8Array(e * 4),
				col: new Uint8Array(e * 4).fill(255)
			};
		}
		let { pos: i, nor: a, col: o } = r;
		for (; r.k < this.tpl.length; r.k++) {
			if (!(r.k & 63) && performance.now() - n > t) return null;
			let e = r.k, s = this.tpls[this.tpl.a[e]], c = s.attributes.position.array, l = s.attributes.normal.array;
			B.fromArray(this.mat.a, e * 16), z.getNormalMatrix(B);
			let u = this.col.a[e * 4], d = this.col.a[e * 4 + 1], f = this.col.a[e * 4 + 2], p = this.col.a[e * 4 + 3];
			for (let e = 0; e < c.length; e += 3, r.o += 3, r.o4 += 4) {
				let t = r.o, n = r.o4;
				L.set(c[e], c[e + 1], c[e + 2]).applyMatrix4(B), R.set(l[e], l[e + 1], l[e + 2]).applyMatrix3(z).normalize(), i[t] = L.x, i[t + 1] = L.y, i[t + 2] = L.z, a[n] = P(R.x), a[n + 1] = P(R.y), a[n + 2] = P(R.z);
				let s = p ? 1 - p * (e * 7919 % 13) / 13 : 1;
				o[n] = F(u * s), o[n + 1] = F(d * s), o[n + 2] = F(f * s);
			}
		}
		this.job = null;
		let s = new e.BufferGeometry();
		return s.setAttribute("position", new e.BufferAttribute(i, 3)), s.setAttribute("normal", new e.BufferAttribute(a, 4, !0)), s.setAttribute("color", new e.BufferAttribute(o, 4, !0)), s.computeBoundingSphere(), s;
	}
	geometry() {
		let t = 0;
		for (let e = 0; e < this.tpl.length; e++) t += this.tpls[this.tpl.a[e]].attributes.position.count;
		let n = new Float32Array(t * 3), r = new Int8Array(t * 4), i = new Uint8Array(t * 4).fill(255), a = 0, o = 0;
		for (let e = 0; e < this.tpl.length; e++) {
			let t = this.tpls[this.tpl.a[e]], s = t.attributes.position.array, c = t.attributes.normal.array;
			B.fromArray(this.mat.a, e * 16), z.getNormalMatrix(B);
			let l = this.col.a[e * 4], u = this.col.a[e * 4 + 1], d = this.col.a[e * 4 + 2], f = this.col.a[e * 4 + 3];
			for (let e = 0; e < s.length; e += 3, a += 3, o += 4) {
				L.set(s[e], s[e + 1], s[e + 2]).applyMatrix4(B), R.set(c[e], c[e + 1], c[e + 2]).applyMatrix3(z).normalize(), n[a] = L.x, n[a + 1] = L.y, n[a + 2] = L.z, r[o] = P(R.x), r[o + 1] = P(R.y), r[o + 2] = P(R.z);
				let t = f ? 1 - f * (e * 7919 % 13) / 13 : 1;
				i[o] = F(l * t), i[o + 1] = F(u * t), i[o + 2] = F(d * t);
			}
		}
		let s = new e.BufferGeometry();
		return s.setAttribute("position", new e.BufferAttribute(n, 3)), s.setAttribute("normal", new e.BufferAttribute(r, 4, !0)), s.setAttribute("color", new e.BufferAttribute(i, 4, !0)), s.computeBoundingSphere(), s;
	}
	pack() {
		for (let e of [
			this.tpl,
			this.mat,
			this.col
		]) {
			let t = e.length;
			e.a = e.a.slice(0, t), e.length = t;
		}
	}
};
function V(e) {
	let t = e.index ? e.toNonIndexed() : e;
	for (let e of Object.keys(t.attributes)) e !== "position" && e !== "normal" && t.deleteAttribute(e);
	return t;
}
var ne = { range: 1 }, re = class {
	constructor(e) {
		this.size = e, this.map = /* @__PURE__ */ new Map(), this.detail = [], this.lazy = [], this.streamed = [];
	}
	at(e, t) {
		let n = `${Math.floor(e / this.size)},${Math.floor(t / this.size)}`, r = this.map.get(n);
		return r || this.map.set(n, r = {
			facade: new I(!0),
			props: new te(),
			alpha: new I(),
			lines: []
		}), r;
	}
	build(t, n) {
		this.root = t, this.mats = n;
		for (let [r, i] of this.map) {
			let [a, o] = r.split(",").map(Number), s = (a + .5) * this.size, c = (o + .5) * this.size, l = (e, t) => this.detail.push({
				mesh: e,
				cx: s,
				cz: c,
				range: t + this.size * .7
			});
			if (!i.facade.empty) {
				let t = new e.Mesh(i.facade.geometry(), n.facade);
				t.castShadow = t.receiveShadow = !0, this.streamed.push({
					mesh: t,
					cx: s,
					cz: c,
					range: 950 * ne.range + this.size * .7,
					on: !1
				});
			}
			if (i.props.empty || (i.props.pack(), this.lazy.push({
				props: i.props,
				mesh: null,
				cx: s,
				cz: c,
				range: 420 + this.size * .7
			})), !i.alpha.empty) {
				let t = new e.Mesh(i.alpha.geometry(), n.alpha);
				t.receiveShadow = !0, this.streamed.push({
					mesh: t,
					cx: s,
					cz: c,
					range: 320 * ne.range + this.size * .7,
					on: !1
				});
			}
			if (i.lines.length) {
				let r = new e.BufferGeometry();
				r.setAttribute("position", new e.Float32BufferAttribute(i.lines, 3)), i.lines = null, r.computeBoundingSphere(), ee(r);
				let a = new e.LineSegments(r, n.cables);
				t.add(a), l(a, 350);
			}
			this.map.delete(r);
		}
	}
	updateDetail(e, t = !1, n = !1, r = !0) {
		if (!r) {
			let e = this.addQueue?.pop();
			if (e && !e.on && (this.root.add(e.mesh), e.on = !0), this.pending && !this.pending.mesh && !t) {
				let e = this.pending.props.bakeStep(2);
				e && this.finishBake(this.pending, e);
			}
			return;
		}
		for (let t of this.detail) t.mesh.visible = (t.cx - e.x) ** 2 + (t.cz - e.z) ** 2 < t.range * t.range;
		let i = n ? Infinity : 1;
		this.addQueue = [];
		for (let t of this.streamed) {
			let n = (t.cx - e.x) ** 2 + (t.cz - e.z) ** 2;
			!t.on && n < t.range * t.range ? i-- > 0 ? (this.root.add(t.mesh), t.on = !0) : this.addQueue.push(t) : t.on && n > (t.range * 1.15) ** 2 && (this.root.remove(t.mesh), t.mesh.geometry.dispose(), t.on = !1);
		}
		let a = null, o = Infinity;
		for (let t of this.lazy) {
			let r = (t.cx - e.x) ** 2 + (t.cz - e.z) ** 2;
			r < t.range * t.range ? !t.mesh && n ? this.finishBake(t, t.props.bakeStep(Infinity)) : !t.mesh && (t.props.job ? -1 : r) < o && (o = t.props.job ? -1 : r, a = t) : t.mesh && r > (t.range * 1.4) ** 2 ? (this.root.remove(t.mesh), t.mesh.geometry.dispose(), t.mesh = null) : !t.mesh && t.props.job && r > (t.range * 1.4) ** 2 && (t.props.job = null);
		}
		if (this.pending = a, a && !t) {
			let e = a.props.bakeStep(2);
			e && this.finishBake(a, e);
		}
	}
	finishBake(t, n) {
		t.mesh = new e.Mesh(ee(n), this.mats.props), t.mesh.castShadow = t.mesh.receiveShadow = !0, this.root.add(t.mesh);
	}
}, H = 256;
function ie(e = H, t = H) {
	let n = document.createElement("canvas");
	return n.width = e, n.height = t, [n, n.getContext("2d", { willReadFrequently: !0 })];
}
function ae(e, t, n, r, i, a = .08, o = 0, s = 0) {
	for (let c = 0; c < r; c++) {
		let r = Math.floor(i() * 255);
		e.fillStyle = `rgba(${r},${r},${r},${a})`, e.fillRect(o + i() * t, s + i() * n, 1 + i() * 3, 1 + i() * 3);
	}
}
function U(e, t, n, r, i, a) {
	let o = e.createRadialGradient(n, r, 0, n, r, i);
	o.addColorStop(0, a), o.addColorStop(1, "rgba(0,0,0,0)"), e.fillStyle = o, e.beginPath(), e.ellipse(n, r, i, i * (.5 + t() * .8), t() * 3, 0, Math.PI * 2), e.fill();
}
function oe(e, t, n, r, i = 6) {
	for (let a = 0; a < i; a++) U(e, t, t() * n, r - t() * 20, 20 + t() * 40, `rgba(70,60,45,${.12 + t() * .12})`);
	for (let a = 0; a < i * 2; a++) {
		let i = t() * n, a = t() * r, o = 10 + t() * 40, s = e.createLinearGradient(i, a, i, a + o);
		s.addColorStop(0, "rgba(50,45,35,0.18)"), s.addColorStop(1, "rgba(50,45,35,0)"), e.fillStyle = s, e.fillRect(i, a, 2 + t() * 4, o);
	}
}
function se(e, t, n, r, i = 4) {
	e.strokeStyle = "rgba(40,35,30,0.35)", e.lineWidth = 1;
	for (let a = 0; a < i; a++) {
		let i = t() * n, a = t() * r;
		e.beginPath(), e.moveTo(i, a);
		for (let n = 0; n < 6; n++) e.lineTo(i += (t() - .5) * 14, a += 3 + t() * 8);
		e.stroke();
	}
}
function ce(e, t, n, r, i, a, o = 14, s = 8) {
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
function le(e, t, n, r, i, a) {
	e.fillStyle = `hsl(40,${4 + t() * 5}%,${58 + t() * 8}%)`, e.fillRect(n, r, i, a), ae(e, i, a, i * a / 12, t, .14, n, r), e.fillStyle = "rgba(0,0,0,0.12)", e.fillRect(n, r + a - 2, i, 2);
}
function ue(e, t, n, r, i, a, o) {
	if (a) e.fillStyle = o() < .8 ? `hsl(${34 + o() * 12},90%,${52 + o() * 15}%)` : `hsl(200,55%,${60 + o() * 15}%)`;
	else {
		let a = e.createLinearGradient(t, n, t + r, n + i);
		a.addColorStop(0, "#26313a"), a.addColorStop(.5, "#56697a"), a.addColorStop(1, "#222b33"), e.fillStyle = a;
	}
	e.fillRect(t, n, r, i);
}
function de(e, t, n, r, i, a = 7, o = "#1b1b1b") {
	e.fillStyle = o;
	for (let o = t + a / 2; o < t + r; o += a) e.fillRect(o, n, 2, i);
	e.fillRect(t, n, r, 2), e.fillRect(t, n + i - 2, r, 2), e.fillRect(t, n + i * .45, r, 2);
}
function fe(e, t, n, r, i, a, o, s = {}) {
	if (e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(r - 3, i - 3, a + 6, o + 7), e.fillStyle = "rgba(255,255,255,0.35)", e.fillRect(r - 4, i + o + 1, a + 8, 3), ue(e, r, i, a, o, !1, n), t && n() < .5 && ue(t, r, i, a, o, !0, n), s.persiana ?? n() < .6) {
		let s = o * (.25 + n() * .75);
		e.fillStyle = n() < .5 ? "#b9b2a2" : "#7d6a52", e.fillRect(r, i, a, s), e.fillStyle = "rgba(0,0,0,0.25)";
		for (let t = i; t < i + s; t += 3) e.fillRect(r, t, a, 1);
		t && (t.fillStyle = "#000", t.fillRect(r, i, a, s));
	}
	(s.reja ?? !0) && de(e, r - 1, i - 1, a + 2, o + 2, 6 + n() * 3);
}
function pe(e, t, n, r, i, a, o) {
	let s = n();
	if (e.fillStyle = "rgba(0,0,0,0.3)", e.fillRect(r - 3, i - 3, a + 6, o + 3), s < .45) e.fillStyle = `hsl(${22 + n() * 10},${35 + n() * 20}%,${22 + n() * 12}%)`, e.fillRect(r, i, a, o), e.strokeStyle = "rgba(0,0,0,0.35)", e.lineWidth = 2, e.strokeRect(r + 5, i + 6, a - 10, o * .4), e.strokeRect(r + 5, i + o * .52, a - 10, o * .4);
	else {
		e.fillStyle = [
			"#2e3a33",
			"#262626",
			"#4a3b2c",
			"#34404c",
			"#6b6e70"
		][Math.floor(n() * 5)], e.fillRect(r, i, a, o), ue(e, r + 6, i + 8, a - 12, o * .3, !1, n), de(e, r + 6, i + 8, a - 12, o * .3, 5), e.fillStyle = "rgba(255,255,255,0.1)";
		for (let t = i + o * .45; t < i + o; t += 5) e.fillRect(r, t, a, 1);
	}
	e.fillStyle = "#c9b27a", e.fillRect(r + a - 8, i + o * .5, 4, 3), e.fillStyle = "#ddd", e.fillRect(r + a / 2 - 3, i - 12, 6, 5), t && (t.fillStyle = "#ffd890", t.fillRect(r + a / 2 - 4, i - 13, 8, 7));
}
function me(e, t, n, r, i, a, o = t() < .4) {
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
	for (let o = 0; o < 6; o++) U(e, t, n + t() * i, r + a - t() * 12, 6 + t() * 10, "rgba(120,70,30,0.3)");
}
function he(e, t, n, r, i, a) {
	e.lineCap = "round", e.lineJoin = "round", e.strokeStyle = `hsl(${t() * 360},${60 + t() * 30}%,${35 + t() * 25}%)`, e.lineWidth = 2 + t() * 4, e.beginPath();
	let o = n, s = r + a / 2;
	e.moveTo(o, s);
	for (let n = 0; n < 8; n++) o += i / 8, e.quadraticCurveTo(o - i / 16, r + t() * a, o, r + t() * a);
	e.stroke();
}
function ge(e, t, n) {
	e.fillStyle = "#ece7dc", e.fillRect(0, 0, H, H), ae(e, H, H, 4e3, t, .06), le(e, t, 0, 0, H, 10), oe(e, t, H, H, 4), se(e, t, H, H, 3);
	let r = e.createLinearGradient(0, 216, 0, H);
	if (r.addColorStop(0, "rgba(90,75,50,0)"), r.addColorStop(1, "rgba(90,75,50,0.4)"), e.fillStyle = r, e.fillRect(0, 216, H, 40), n >= 1) for (let n = 0; n < 2; n++) he(e, t, t() * 180, 110 + t() * 90, 40 + t() * 60, 25 + t() * 25);
	n >= 2 && (e.font = `bold ${26 + t() * 12}px Impact, Arial Black, sans-serif`, e.textAlign = "center", e.fillStyle = `hsl(${t() < .5 ? 210 : t() * 360},65%,${30 + t() * 20}%)`, e.fillText(_e[Math.floor(t() * _e.length)], H / 2 + (t() - .5) * 60, 140 + t() * 50, 226));
}
var _e = [
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
function ve(e, t) {
	e.strokeStyle = t, e.lineWidth = 10, e.strokeRect(5, 5, 246, 246);
}
function ye(e, t, n, r) {
	let i = n() < .6 ? "#c7cacc" : "#f2f2ef";
	e.fillStyle = i, e.fillRect(0, 0, H, H), t.fillStyle = "#000", t.fillRect(0, 0, H, H);
	let a = [[
		14,
		14,
		H / 2 - 18,
		228
	], [
		132,
		14,
		H / 2 - 18,
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
	e.fillStyle = i, e.fillRect(H / 2 - 6, 8, 12, 240), e.fillStyle = "rgba(0,0,0,0.3)", e.fillRect(134, 8, 2, 240), e.fillRect(12, 240, 232, 3), e.strokeStyle = "rgba(0,0,0,0.35)", e.lineWidth = 3, e.strokeRect(2, 2, 252, 252);
}
function be(e, t, n, r, i, a) {
	e.fillStyle = "#ddd5c6", e.fillRect(0, 0, H, H), e.fillStyle = n, e.fillRect(8, 30, 240, 196), e.fillStyle = r, e.textAlign = "center", e.textBaseline = "middle", e.font = "bold 54px Impact, Arial Black, sans-serif", e.fillText(i, H / 2, 105, 226), e.font = "bold 22px Arial, sans-serif", e.fillText(a, H / 2, 165, 226), e.fillStyle = "rgba(235,228,214,0.35)", e.fillRect(0, 0, H, H);
	for (let n = 0; n < 40; n++) {
		e.fillStyle = `rgba(221,213,198,${.5 + t() * .5})`;
		let n = t() < .5 ? t() * 30 : H - t() * 30;
		e.fillRect(n, 30 + t() * 196, 4 + t() * 12, 3 + t() * 10);
	}
	ae(e, H, H, 3e3, t, .08), oe(e, t, H, H, 3);
}
var xe = {
	medianera(e, t, n) {
		e.fillStyle = "#e6dfd2", e.fillRect(0, 0, H, H);
		for (let t = 0; t < 5; t++) e.fillStyle = `rgba(${200 + n() * 40},${190 + n() * 40},${170 + n() * 40},0.5)`, e.fillRect(n() * H, n() * H, 30 + n() * 80, 20 + n() * 60);
		ae(e, H, H, 5e3, n, .07), oe(e, n, H, H, 4);
		for (let t = 0; t < 2; t++) U(e, n, n() * H, n() * H * .6, 25 + n() * 30, "rgba(90,85,70,0.1)");
		se(e, n, H, H, 4);
		let r = 40 + n() * 156, i = 40 + n() * 156;
		e.save(), e.beginPath(), e.moveTo(r, i);
		for (let t = 0; t < 9; t++) e.lineTo(r + (n() - .3) * 40, i + (n() - .3) * 24);
		e.closePath(), e.clip(), ce(e, n, r - 20, i - 12, 70, 50), e.restore(), e.fillStyle = "rgba(0,0,0,0.1)", e.fillRect(0, 0, H, 4);
	},
	medianeraLadrillo(e, t, n) {
		ce(e, n, 0, 0, H, H);
		for (let t of [0, H / 2]) le(e, n, 0, t, H, 9);
		for (let t of [0, H / 2]) le(e, n, t, 0, 9, H);
		oe(e, n, H, H, 4);
	},
	hueco(e, t, n) {
		ce(e, n, 0, 0, H, H);
		for (let t of [0, H / 2]) le(e, n, 0, t, H, 10);
		for (let t of [0, H / 2]) le(e, n, t - 1, 0, 10, H);
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
				U(e, n, a + 60, o + 112, 16, "rgba(120,70,30,0.35)");
				continue;
			}
			if (s < .15) continue;
			let c = a + 34 + n() * 20, l = o + 34, u = 40 + n() * 14, d = 36 + n() * 8;
			if (le(e, n, c - 4, l - 5, u + 8, 5), s < .3) {
				e.fillStyle = n() < .5 ? "#2f5f9e" : `hsl(${n() * 360},40%,40%)`, e.fillRect(c, l, u, d), e.fillStyle = "rgba(0,0,0,0.25)";
				for (let t = 0; t < 4; t++) e.fillRect(c + n() * u, l, 1.5, d);
			} else ue(e, c, l, u, d, !1, n), n() < .45 && ue(t, c, l, u, d, !0, n), e.strokeStyle = s < .7 ? "#b8bcbf" : "#2a2a2a", e.lineWidth = 3, e.strokeRect(c, l, u, d), e.beginPath(), e.moveTo(c + u / 2, l), e.lineTo(c + u / 2, l + d), e.stroke(), n() < .5 && de(e, c, l, u, d, 7);
		}
		oe(e, n, H, H, 4);
	},
	villa(e, t, n) {
		e.fillStyle = "#ece8e0", e.fillRect(0, 0, H, H), ae(e, H, H, 6e3, n, .1);
		for (let t = 0; t < 4; t++) {
			let t = n() * 196, r = n() * 206, i = 25 + n() * 45, a = 15 + n() * 30;
			e.save(), e.beginPath(), e.moveTo(t, r + a * n());
			for (let o = 0; o < 7; o++) e.lineTo(t + i * n(), r + a * n());
			e.closePath(), e.clip(), ce(e, n, t, r, i, a), e.restore();
		}
		for (let t of [H / 2 - 8, 248]) e.fillStyle = "rgba(0,0,0,0.12)", e.fillRect(0, t, H, 8);
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
			n() < .2 || fe(e, t, n, a + 36 + n() * 20, o + 38, 40 + n() * 10, 36, { persiana: n() < .3 });
		}
		for (let t of [H / 2, H]) {
			let n = e.createLinearGradient(0, t - 26, 0, t);
			n.addColorStop(0, "rgba(90,70,45,0)"), n.addColorStop(1, "rgba(90,70,45,0.45)"), e.fillStyle = n, e.fillRect(0, t - 26, H, 26);
		}
		oe(e, n, H, H, 3);
	},
	muro0: (e, t, n) => ge(e, n, 2),
	muro1: (e, t, n) => ge(e, n, 1),
	muro2: (e, t, n) => ge(e, n, 0),
	revoque(e, t, n) {
		e.fillStyle = "#efe9de", e.fillRect(0, 0, H, H);
		for (let t = 0; t < 6; t++) U(e, n, n() * H, n() * H, 30 + n() * 60, `rgba(${n() < .5 ? "255,255,255" : "180,170,150"},0.12)`);
		ae(e, H, H, 7e3, n, .05);
		for (let t = 0; t < 4; t++) {
			let t = n() * H, r = 20 + n() * 50, i = e.createLinearGradient(0, H * .3, 0, H * .3 + r);
			i.addColorStop(0, "rgba(60,55,45,0.1)"), i.addColorStop(1, "rgba(60,55,45,0)"), e.fillStyle = i, e.fillRect(t, H * .3, 2 + n() * 3, r);
		}
		let r = e.createLinearGradient(0, 226, 0, H);
		r.addColorStop(0, "rgba(80,70,50,0)"), r.addColorStop(1, "rgba(80,70,50,0.25)"), e.fillStyle = r, e.fillRect(0, 226, H, 30);
	},
	ventana: (e, t, n) => ye(e, t, n, "open"),
	ventanaCortina: (e, t, n) => ye(e, t, n, "closed"),
	ventanaPersiana: (e, t, n) => ye(e, t, n, "persiana"),
	puerta0(e, t, n) {
		e.fillStyle = "#5e3a22", e.fillRect(0, 0, H, H);
		for (let t = 0; t < H; t += 4) e.fillStyle = `rgba(${n() < .5 ? "255,220,180" : "30,15,5"},${.04 + n() * .06})`, e.fillRect(t, 0, 2 + n() * 3, H);
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
		ue(e, 44, 34, 168, 50, !1, n), ue(t, 44, 34, 168, 50, !0, n), de(e, 44, 34, 168, 50, 14, "#20180f"), e.fillStyle = "#c9a646", e.fillRect(196, 128, 18, 6), e.fillRect(204, 140, 5, 10), ve(e, "#3a2414");
	},
	puerta1(e, t, n) {
		e.fillStyle = "#e8e8e8", e.fillRect(0, 0, H, H);
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
		ue(e, 30, 20, 196, 100, !1, n), ue(t, 30, 20, 196, 100, !0, n), e.strokeStyle = "#1b1b1b", e.lineWidth = 3;
		for (let t = 40; t < 226; t += 16) e.beginPath(), e.moveTo(t, 20), e.lineTo(t, 120), e.stroke();
		for (let t = 48; t < 220; t += 32) e.beginPath(), e.arc(t, 70, 9, 0, Math.PI * 2), e.stroke();
		e.fillStyle = "#777", e.fillRect(200, 132, 16, 8), ae(e, H, H, 1500, n, .05);
		for (let t = 0; t < 4; t++) U(e, n, n() * H, H - n() * 30, 10 + n() * 14, "rgba(110,70,30,0.3)");
		ve(e, "#2a2a2a");
	},
	portal(e, t, n) {
		e.fillStyle = "#4a3a28", e.fillRect(0, 0, H, H), t.fillStyle = "#000", t.fillRect(0, 0, H, H);
		for (let n of [14, 132]) {
			let r = e.createLinearGradient(n, 14, n + 60, H);
			r.addColorStop(0, "#7f93a3"), r.addColorStop(.5, "#3a4752"), r.addColorStop(1, "#232b31"), e.fillStyle = r, e.fillRect(n, 14, H / 2 - 18, 216), t.fillStyle = "#e8d2a0", t.fillRect(n, 14, H / 2 - 18, 216), e.fillStyle = "rgba(255,255,255,0.12)", e.fillRect(n + 10, 14, 18, 216), e.fillStyle = "rgba(30,25,20,0.5)", e.fillRect(n + 20, 166, 40, 64);
		}
		e.fillStyle = "#c9a646", e.fillRect(H / 2 - 16, H / 2, 6, 40), e.fillRect(138, H / 2, 6, 40), e.fillStyle = "#3a2c1e", e.fillRect(0, 230, H, 26);
	},
	pub0: (e, t, n) => be(e, n, "#c62828", "#fff4d6", "MUDANZAS", "Y FLETES · 4253-1180"),
	pub1: (e, t, n) => be(e, n, "#1f4e8c", "#ffffff", "PINTURERÍA", "EL PINCEL · DESDE 1978"),
	pub2: (e, t, n) => be(e, n, "#f2c200", "#1b1b1b", "GOMERÍA", "24 HS · AUXILIO"),
	huella(e, t, n) {
		e.fillStyle = "#e2dacb", e.fillRect(0, 0, H, H), ae(e, H, H, 5e3, n, .07);
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
		e.stroke(), oe(e, n, H, H, 4), se(e, n, H, H, 3);
	},
	porton(e, t, n) {
		e.fillStyle = "#9a9a98", e.fillRect(0, 0, H, H);
		for (let t = 0; t < H; t += 10) {
			let n = e.createLinearGradient(t, 0, t + 10, 0);
			n.addColorStop(0, "rgba(255,255,255,0.18)"), n.addColorStop(.5, "rgba(0,0,0,0.05)"), n.addColorStop(1, "rgba(0,0,0,0.22)"), e.fillStyle = n, e.fillRect(t, 0, 10, H);
		}
		e.strokeStyle = "#3a3a3a", e.lineWidth = 8, e.strokeRect(4, 4, 248, 248), e.fillRect(H / 2 - 2, 0, 4, H), e.fillStyle = "#3a3a3a", e.fillRect(H / 2 - 3, 0, 6, H), e.fillStyle = "#d8c070", e.fillRect(136, H / 2, 10, 5);
		for (let t = 0; t < 8; t++) U(e, n, n() * H, H - n() * 50, 8 + n() * 16, "rgba(120,65,25,0.35)");
		n() < .6 && he(e, n, 30 + n() * 60, 100 + n() * 60, 100 + n() * 60, 40);
	},
	roofMembrana(e, t, n) {
		e.fillStyle = "#b9bbb8", e.fillRect(0, 0, H, H);
		for (let t = 0; t < H; t += 43) e.fillStyle = `rgba(${200 + n() * 30},${200 + n() * 30},${200 + n() * 30},0.5)`, e.fillRect(0, t, H, 40), e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(0, t + 40, H, 3);
		ae(e, H, H, 6e3, n, .1);
		for (let t = 0; t < 6; t++) e.fillStyle = `rgba(40,40,40,${.2 + n() * .3})`, e.fillRect(n() * H, n() * H, 15 + n() * 40, 10 + n() * 30);
		for (let t = 0; t < 5; t++) U(e, n, n() * H, n() * H, 20 + n() * 30, "rgba(80,70,50,0.25)");
	},
	roofBaldosa(e, t, n) {
		e.fillStyle = "#c9b9a8", e.fillRect(0, 0, H, H);
		for (let t = 0; t < H; t += 8) for (let r = 0; r < H; r += 8) e.fillStyle = `hsl(${12 + n() * 8},${45 + n() * 15}%,${40 + n() * 10}%)`, e.fillRect(r + 1, t + 1, 7, 7);
		for (let t = 0; t < 6; t++) U(e, n, n() * H, n() * H, 20 + n() * 40, "rgba(50,50,40,0.25)");
	},
	chapa(e, t, n) {
		e.fillStyle = "#a7aaac", e.fillRect(0, 0, H, H);
		for (let t = 0; t < H; t += 4) e.fillStyle = "rgba(255,255,255,0.22)", e.fillRect(t, 0, 1, H), e.fillStyle = "rgba(0,0,0,0.22)", e.fillRect(t + 2, 0, 1.5, H);
		for (let t = 60; t < H; t += 64 + n() * 20) e.fillStyle = "rgba(0,0,0,0.35)", e.fillRect(0, t, H, 2);
		for (let t = 0; t < 10; t++) U(e, n, n() * H, n() * H, 15 + n() * 45, `rgba(${130 + n() * 40},${60 + n() * 20},20,${.25 + n() * .3})`);
		for (let t = 0; t < 20; t++) {
			let t = n() * H, r = n() * H, i = 20 + n() * 60, a = e.createLinearGradient(t, r, t, r + i);
			a.addColorStop(0, "rgba(120,60,20,0.4)"), a.addColorStop(1, "rgba(120,60,20,0)"), e.fillStyle = a, e.fillRect(t, r, 2 + n() * 3, i);
		}
	}
};
function Se(e, t, n, r) {
	if (e.save(), t.save(), e.scale(1, 2), t.scale(1, 2), e.fillStyle = "#efe9dd", e.fillRect(0, 0, H, 128), ae(e, H, 128, 3500, n, .08), e.fillStyle = "rgba(0,0,0,0.1)", e.fillRect(0, 0, H, 5), r === 3) for (let t = 0; t < H; t += 16) for (let r = 110; r < 128; r += 6) e.fillStyle = `hsl(35,${10 + n() * 10}%,${45 + n() * 15}%)`, e.fillRect(t + r / 6 % 2 * 8, r, 15, 5);
	else e.fillStyle = `hsl(40,5%,${45 + n() * 15}%)`, e.fillRect(0, 111, H, 17);
	r === 0 ? (pe(e, t, n, 18, 23, 38, 88), fe(e, t, n, 76, 32, 50, 46), me(e, n, 146, 15, 100, 96)) : r === 1 ? (fe(e, t, n, 22, 32, 52, 46), pe(e, t, n, 108, 23, 38, 88), fe(e, t, n, 178, 32, 52, 46)) : r === 2 ? (me(e, n, 14, 15, 118, 96, !0), pe(e, t, n, 162, 23, 38, 88), e.fillStyle = "#333", e.fillRect(214, 50, 22, 14)) : (fe(e, t, n, 16, 30, 56, 50, { persiana: !0 }), pe(e, t, n, 104, 21, 40, 90), fe(e, t, n, 170, 30, 56, 50)), oe(e, n, H, 128, 5), e.restore(), t.restore();
}
function Ce(e, t) {
	let r = {};
	{
		let i = n(31), [a, o] = ie();
		o.fillStyle = "#7b6650", o.fillRect(0, 0, H, H);
		for (let e = 0; e < 14; e++) U(o, i, i() * H, i() * H, 20 + i() * 40, i() < .5 ? "rgba(60,48,36,0.35)" : "rgba(150,130,100,0.3)");
		for (let e = 0; e < 9e3; e++) {
			let e = 70 + i() * 80;
			o.fillStyle = `rgba(${e + 20},${e},${e - 20},0.35)`, o.fillRect(i() * H, i() * H, 1 + i() * 2, 1 + i() * 2);
		}
		for (let e = 0; e < 25; e++) o.fillStyle = `hsl(${i() * 360},${20 + i() * 30}%,${45 + i() * 35}%)`, o.fillRect(i() * H, i() * H, 2 + i() * 2, 1 + i() * 2);
		for (let e = 0; e < 5; e++) {
			o.fillStyle = "rgba(70,90,40,0.5)";
			for (let e = 0; e < 60; e++) o.fillRect(i() * H, i() * H, 1, 3);
		}
		r.dirt = t(a, e);
	}
	{
		let i = n(32), [a, o] = ie();
		o.fillStyle = "#8f8a55", o.fillRect(0, 0, H, H);
		for (let e = 0; e < 12; e++) U(o, i, i() * H, i() * H, 25 + i() * 45, i() < .4 ? "rgba(120,100,70,0.45)" : "rgba(90,110,50,0.35)");
		for (let e = 0; e < 12e3; e++) o.fillStyle = `hsl(${40 + i() * 35},${25 + i() * 25}%,${28 + i() * 30}%)`, o.fillRect(i() * H, i() * H, 1, 2 + i() * 5);
		for (let e = 0; e < 18; e++) o.fillStyle = `hsl(${i() * 360},${20 + i() * 30}%,${50 + i() * 35}%)`, o.fillRect(i() * H, i() * H, 2 + i() * 2, 1 + i() * 2);
		r.dryGrass = t(a, e);
	}
	{
		let i = n(33), [a, o] = ie();
		o.fillStyle = "#9d978c", o.fillRect(0, 0, H, H), ae(o, H, H, 7e3, i, .14);
		for (let e = 0; e < 6; e++) U(o, i, i() * H, i() * H, 20 + i() * 30, "rgba(90,75,55,0.4)");
		se(o, i, H, H, 8);
		for (let e of [0, 216]) {
			let t = o.createLinearGradient(e, 0, e + 40, 0), n = "rgba(100,80,58,0.85)", r = "rgba(100,80,58,0)";
			t.addColorStop(0, e ? r : n), t.addColorStop(1, e ? n : r), o.fillStyle = t, o.fillRect(e, 0, 40, H);
		}
		o.fillStyle = "rgba(40,50,60,0.35)", o.fillRect(H / 2 - 3, 0, 6, H), r.pasillo = t(a, e);
	}
	{
		let i = n(35), [a, o] = ie();
		o.fillStyle = "#8f8d87", o.fillRect(0, 0, H, H);
		for (let e = 0; e < H; e += H / 3) for (let t of [0, H / 2]) o.fillStyle = `hsl(40,${3 + i() * 4}%,${50 + i() * 8}%)`, o.fillRect(t + 1, e + 1, H / 2 - 2, H / 3 - 2);
		ae(o, H, H, 9e3, i, .12);
		for (let e = 0; e < 8; e++) U(o, i, i() * H, i() * H, 10 + i() * 25, "rgba(40,40,40,0.25)");
		se(o, i, H, H, 6), o.fillStyle = "rgba(30,30,30,0.55)";
		for (let e = 0; e < H; e += H / 3) o.fillRect(0, e, H, 2);
		o.fillRect(H / 2 - 1, 0, 2, H), o.fillStyle = "rgba(200,198,190,0.6)", o.fillRect(0, 0, 10, H), o.fillRect(246, 0, 10, H), r.concrete = t(a, e);
	}
	{
		let i = n(34), [a, o] = ie();
		o.fillStyle = "#56603a", o.fillRect(0, 0, H, H);
		for (let e = 0; e < 9; e++) U(o, i, i() * H, i() * H, 18 + i() * 30, "rgba(70,80,70,0.6)");
		for (let e = 0; e < 1e4; e++) o.fillStyle = `hsl(${60 + i() * 40},${25 + i() * 25}%,${20 + i() * 25}%)`, o.fillRect(i() * H, i() * H, 1, 2 + i() * 6);
		r.wetland = t(a, e);
	}
	return r;
}
var we = {
	reja: [
		0,
		.75,
		.5,
		1
	],
	alambre: [
		.5,
		.75,
		1,
		1
	],
	baranda: [
		0,
		.625,
		.5,
		.75
	],
	ropa: [
		.5,
		.5,
		1,
		.75
	],
	pasto: [
		0,
		0,
		.5,
		.5
	],
	cortadera: [
		.5,
		0,
		1,
		.5
	]
};
function Te(t) {
	let r = n(41), [i, a] = ie(512, 512);
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
function Ee(t) {
	let n = t.length, r = H * H * 4, i = new Uint8Array(r * n), a = new Uint8Array(r * n), o = (e, t, n) => {
		let r = e.getContext("2d").getImageData(0, 0, H, H).data;
		for (let e = 0; e < H; e++) t.set(r.subarray((255 - e) * H * 4, (H - e) * H * 4), n + e * H * 4);
	};
	t.forEach((e, t) => {
		o(e.canvas, i, t * r), e.ecanvas && o(e.ecanvas, a, t * r);
	});
	let s = (t) => {
		let r = new e.DataArrayTexture(t, H, H, n);
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
function De(e, t) {
	let r = n(t), [i, a] = ie(), [o, s] = ie();
	return s.fillStyle = "#000", s.fillRect(0, 0, H, H), e(a, s, r), {
		canvas: i,
		ecanvas: o
	};
}
//#endregion
//#region src/world/houseFronts.js
var Oe = 2.9, ke = [
	0,
	1,
	0
], Ae = [
	"#2f4a35",
	"#3b3b3b",
	"#7a2e22",
	"#e8e8e8",
	"#5a4632",
	"#1f3550"
].map((t) => new e.Color(t)), je = [
	"#3b3b3b",
	"#2f4a35",
	"#e8e8e8",
	"#5a5a5a",
	"#6b3a22",
	"#1f3550",
	"#9a9a98"
].map((t) => new e.Color(t)), Me = [
	"#8f8a82",
	"#5d5a56",
	"#a4553a",
	"#c9c2b4",
	"#3f3f3f"
].map((t) => new e.Color(t)), Ne = new e.Color(1, 1, 1);
function Pe(e, t, r, i, a) {
	let o = n(i), s = [];
	if (e < 2.2 || t < 2.4) return s;
	let c = Math.min(3, t), l = [];
	if (a && e >= 6.2 && o() < .45) {
		let t = Math.min(2.9, 2.5 + o() * .4), n = o() < .5 ? .35 : e - .35 - t;
		s.push({
			kind: "garage",
			a: n,
			w: t,
			y0: 0,
			y1: Math.min(2.3, c - .35),
			tint: je[Math.floor(o() * je.length)]
		}), l.push([n - .45, n + t + .45]);
	}
	if (a && e >= 2.6) {
		let t = .9, n = s[0], r;
		r = n ? n.a < e / 2 ? n.a + n.w + .55 : n.a - .55 - t : e >= 6.5 ? o() < .5 ? .7 : e - .7 - t : e < 4 ? e - t - .4 : (e - t) / 2 + (o() - .5) * (e - t - 1.2), r >= .3 && r + t <= e - .3 && (s.push({
			kind: "door",
			a: r,
			w: t,
			y0: 0,
			y1: 2.1,
			v: o() < .55 ? 0 : 1,
			tint: Ae[Math.floor(o() * Ae.length)]
		}), l.push([r - .5, r + t + .5]));
	}
	l.sort((e, t) => e[0] - t[0]);
	let u = [], d = .4;
	for (let [e, t] of l) e > d && u.push([d, e]), d = Math.max(d, t);
	e - .4 > d && u.push([d, e - .4]);
	let f = () => {
		let e = o();
		return e < .45 ? "ventana" : e < .7 ? "ventanaCortina" : "ventanaPersiana";
	}, p = [];
	for (let [e, t] of u) {
		let n = t - e, r = n > 4.2 ? 1.5 : 1.25, i = Math.floor((n + .8) / (r + .8));
		!i && n >= .9 && (i = 1, r = Math.min(1, n - .3));
		let a = (n - i * r) / (i + 1);
		for (let t = 0; t < i; t++) {
			let n = {
				kind: "window",
				a: e + a + t * (r + a),
				w: r,
				y0: .95,
				y1: Math.min(c - .45, 2.2),
				tex: f(),
				reja: o() < .85
			};
			s.push(n), p.push(n);
		}
	}
	let m = [...p.map((e) => [e.a, e.w]), ...s.filter((e) => e.kind === "garage").map((e) => [e.a + .4, e.w - .8])];
	!m.length && e >= 2.4 && m.push([(e - 1.2) / 2, 1.2]);
	let h = +(r >= 2 && e >= 5 && o() < .4);
	for (let e = 1; e < r; e++) {
		let n = e * Oe;
		if (n + 2.4 > t - .3) break;
		let r = -1;
		m.forEach(([, e], t) => {
			(r < 0 || e > m[r][1]) && (r = t);
		}), m.forEach(([t, i], a) => {
			if (e === h && a === r) {
				let e = Math.max(1.4, Math.min(i, 2));
				s.push({
					kind: "balcony",
					a: t + (i - e) / 2,
					w: e,
					y0: n + .05,
					y1: n + 2.15,
					tex: "ventanaCortina"
				});
			} else s.push({
				kind: "window",
				a: t,
				w: i,
				y0: n + .95,
				y1: n + 2.2,
				tex: f(),
				reja: o() < .25
			});
		});
	}
	return s;
}
function Fe(e, t, r, i, a) {
	let o = n(i), s = [];
	if (e < 3 || r < 3) return s;
	let c = Math.min(3.3, Math.max(2.7, (t - .6) / r)), l = o() < .55, u = Math.max(1, Math.floor((e - .6) / 3.3)), d = (e - .6) / u, f = o() < .5 ? "ventanaPersiana" : o() < .5 ? "ventana" : "ventanaCortina", p = () => o() < .6 ? f : o() < .5 ? "ventanaCortina" : "ventanaPersiana", m = -1;
	if (a) {
		m = Math.floor(o() * u);
		let e = Math.min(2, d - .6);
		e >= 1.2 ? s.push({
			kind: "portal",
			a: .3 + m * d + (d - e) / 2,
			w: e,
			y0: 0,
			y1: Math.min(2.6, c - .25)
		}) : m = -1;
	}
	for (let e = 0; e < u; e++) {
		if (e === m) continue;
		let t = Math.min(1.6, d - .9);
		t > .7 && s.push({
			kind: "window",
			a: .3 + e * d + (d - t) / 2,
			w: t,
			y0: .95,
			y1: Math.min(2.25, c - .4),
			tex: p(),
			reja: o() < .6
		});
	}
	for (let e = 1; e < r; e++) {
		let n = e * c;
		if (n + 2.3 > t - .3) break;
		for (let e = 0; e < u; e++) if (l && (e % 2 == 0 || u <= 2)) {
			let t = Math.min(1.8, d - .7);
			t > .9 && s.push({
				kind: "balcony",
				a: .3 + e * d + (d - t) / 2,
				w: t,
				y0: n + .05,
				y1: n + 2.15,
				tex: "ventanaCortina",
				block: !0
			});
		} else {
			let t = Math.min(1.5, d - .9);
			t > .7 && s.push({
				kind: "window",
				a: .3 + e * d + (d - t) / 2,
				w: t,
				y0: n + .9,
				y1: n + 2.15,
				tex: p(),
				reja: !1,
				ac: o() < .15
			});
		}
	}
	return s.fh = c, s;
}
function Ie(e, t, n, r, i, a, o, s, c, l) {
	let u = Math.hypot(r[0] - n[0], r[1] - n[1]), d = (r[0] - n[0]) / u, f = (r[1] - n[1]) / u, p = f, m = -d;
	e.wall(n, r, 0, a, c, 3, 3, o, s);
	let h = (e, t, r = .03) => [
		n[0] + d * e + p * r,
		t,
		n[1] + f * e + m * r
	], g = [
		p,
		0,
		m
	];
	for (let n of l) {
		if (n.y1 > a + .01) continue;
		let r = n.kind === "door" ? t[`puerta${n.v}`] : n.kind === "garage" ? t.porton : n.kind === "portal" ? t.portal : t[n.tex], i = n.kind === "garage" || n.kind === "door" && n.v === 1 ? n.tint : Ne;
		e.quad(h(n.a, n.y0), h(n.a + n.w, n.y0), h(n.a + n.w, n.y1), h(n.a, n.y1), [1, 0], [0, 0], [0, 1], [1, 1], i, g, r);
	}
}
var Le = 120, Re = 2, ze = class {
	constructor() {
		this.cells = /* @__PURE__ */ new Map();
	}
	add(e, t, n, r, i, a, o, s, c, l) {
		let u = `${Math.floor((e[0] + t[0]) / 2 / Le)},${Math.floor((e[1] + t[1]) / 2 / Le)}`, d = this.cells.get(u);
		d || this.cells.set(u, d = {
			fronts: [],
			mesh: null,
			alpha: null
		}), d.fronts.push({
			p0: e,
			p1: t,
			h: n,
			top: r,
			levels: i,
			tint: a.getHex(),
			seed: o,
			main: s,
			setback: c,
			kind: l
		});
	}
	addMed(e, t, n, r) {
		let i = `${Math.floor((e[0] + t[0]) / 2 / Le)},${Math.floor((e[1] + t[1]) / 2 / Le)}`, a = this.cells.get(i);
		a || this.cells.set(i, a = {
			fronts: [],
			mesh: null,
			alpha: null
		}), (a.meds ||= []).push(e[0], e[1], t[0], t[1], n, r);
	}
	build(e, t) {
		this.root = e, this.mats = t;
		for (let [e, t] of this.cells) {
			let [n, r] = e.split(",").map(Number);
			t.cx = (n + .5) * Le, t.cz = (r + .5) * Le;
		}
	}
	update(e, t = !1, n = !0) {
		if (!n && !t) {
			this.busy?.job && !this.busy.mesh ? this.bake(this.busy, Re) : this.next && !this.next.mesh && (this.busy = this.next, this.bake(this.next, Re));
			return;
		}
		let r = null, i = Infinity;
		for (let t of this.cells.values()) {
			let n = (t.cx - e.x) ** 2 + (t.cz - e.z) ** 2;
			if (n < 54756) !t.mesh && n < i && (i = n, r = t);
			else if (t.mesh && n > 304.2 ** 2) {
				for (let e of [t.mesh, t.alpha]) e && (this.root.remove(e), e.geometry?.dispose());
				t.mesh = t.alpha = null;
			} else t.job && n > 304.2 ** 2 && (t.job = null);
		}
		if (t) {
			for (let t of this.cells.values()) !t.mesh && (t.cx - e.x) ** 2 + (t.cz - e.z) ** 2 < 54756 && this.bake(t, Infinity);
			return;
		}
		this.next = r;
		let a = this.busy?.job && !this.busy.mesh ? this.busy : r;
		a && (this.busy = a, this.bake(a, Re));
	}
	bake(t, n) {
		let r = performance.now(), i = t.job ||= {
			solid: new I(),
			alpha: new I(),
			i: 0,
			j: 0
		}, a = t.meds || [];
		for (; i.i < t.fronts.length;) if (Be(i.solid, i.alpha, t.fronts[i.i++]), performance.now() - r > n) return;
		for (; i.j < a.length;) if (We(i.solid, [a[i.j], a[i.j + 1]], [a[i.j + 2], a[i.j + 3]], a[i.j + 4], a[i.j + 5]), i.j += 6, performance.now() - r > n) return;
		let { solid: o, alpha: s } = i;
		t.job = null, o.empty || (t.mesh = new e.Mesh(o.geometry(), this.mats.props), t.mesh.castShadow = t.mesh.receiveShadow = !0, this.root.add(t.mesh)), s.empty || (t.alpha = new e.Mesh(s.geometry(), this.mats.alpha), t.alpha.receiveShadow = !0, this.root.add(t.alpha)), t.mesh ||= new e.Object3D();
	}
};
function Be(t, r, i) {
	let { p0: a, p1: o, h: s, top: c } = i, l = Math.hypot(o[0] - a[0], o[1] - a[1]), u = (o[0] - a[0]) / l, d = (o[1] - a[1]) / l, f = d, p = -u, m = n(i.seed ^ 1540483477), h = new e.Color(i.tint), g = h.clone().lerp(Ne, .45), _ = (e, t, n) => [
		a[0] + u * e + f * n,
		t,
		a[1] + d * e + p * n
	], v = Ke(t, a, u, d), y = (e, t, n, i, a, o, s = 1.2) => {
		let [c, l, u, d] = o, m = Math.max(1, Math.round((t - e) / s));
		for (let o = 0; o < m; o++) {
			let s = e + (t - e) * o / m, h = e + (t - e) * (o + 1) / m;
			r.quad(_(s, n, a), _(h, n, a), _(h, i, a), _(s, i, a), [c, l], [u, l], [u, d], [c, d], Ne, [
				f,
				0,
				p
			]);
		}
	}, b = i.kind === "block", x = b ? Fe(l, s, i.levels, i.seed, i.main) : Pe(l, s, i.levels, i.seed, i.main), S = x.filter((e) => e.kind === "door" || e.kind === "garage" || e.kind === "portal").map((e) => [e.a - .12, e.a + e.w + .12]), C = .45 + m() * .4, w = Me[Math.floor(m() * Me.length)], T = 0;
	for (let [e, t] of [...S.sort((e, t) => e[0] - t[0]), [l, l]]) e - T > .1 && v(T, Math.min(e, l), 0, C, 0, .035, w), T = Math.max(T, t);
	let E = x.fh || Oe;
	for (let e = 1; e < (b ? i.levels : 2); e++) i.levels > e && c > e * E + .5 && v(0, l, e * E - .1, e * E + .08, 0, b ? .04 : .06, g);
	for (let t of x) {
		if (t.y1 > c + .01) continue;
		let { a: n, w: i, y0: a, y1: o } = t;
		if (t.kind === "window") v(n - .12, n + i + .12, o, o + .12, 0, .07, g), v(n - .12, n, a, o, 0, .07, g), v(n + i, n + i + .12, a, o, 0, .07, g), v(n - .17, n + i + .17, a - .07, a, 0, .15, new e.Color(.86, .84, .8)), t.reja && y(n - .05, n + i + .05, a - .02, o + .05, .13, we.reja, 1.3), t.ac && v(n + i + .2, n + i + 1, a + .2, a + .75, 0, .32, new e.Color(.93, .93, .91));
		else if (t.kind === "door") {
			let r = t.v === 0 ? new e.Color(.25, .16, .09) : new e.Color(.18, .18, .18);
			v(n - .1, n, 0, o + .1, 0, .06, r), v(n + i, n + i + .1, 0, o + .1, 0, .06, r), v(n - .1, n + i + .1, o, o + .1, 0, .06, r), v(n - .35, n + i + .35, 0, .14, 0, .32, new e.Color(.78, .76, .72));
			let a = n > l / 2 ? -1 : 1, s = a > 0 ? n + i + .3 : n - .3;
			if (v(s - .07, s + .07, 2.15, 2.4, 0, .12, new e.Color(.95, .92, .8)), v(s - .14, s + .14, 1.55, 1.7, 0, .02, new e.Color(.95, .95, .95)), v(s - .03, s + .03, 1.3, 1.4, 0, .02, new e.Color(.2, .2, .2)), m() < .4) {
				let t = a > 0 ? Math.min(l - .4, n + i + .9) : Math.max(.4, n - .9);
				v(t - .3, t + .3, .3, .95, 0, .12, new e.Color(.62, .64, .64));
			}
		} else if (t.kind === "portal") {
			let t = new e.Color(.3, .24, .17);
			v(n - .12, n, 0, o + .12, 0, .08, t), v(n + i, n + i + .12, 0, o + .12, 0, .08, t), v(n - .12, n + i + .12, o, o + .12, 0, .08, t), v(n - .6, n + i + .6, o + .3, o + .42, 0, 1.3, g), v(n - .5, n + i + .5, 0, .12, 0, .6, new e.Color(.7, .68, .64));
			let r = n + i + .35;
			v(r - .12, r + .12, 1.2, 1.6, 0, .04, new e.Color(.75, .75, .73)), v(n + i / 2 - .25, n + i / 2 + .25, o + .5, o + .75, 0, .03, new e.Color(.95, .95, .95));
		} else if (t.kind === "garage") v(n - .15, n + i + .15, o, o + .28, 0, .1, g), v(n - .15, n, 0, o, 0, .1, g), v(n + i, n + i + .15, 0, o, 0, .1, g);
		else if (t.kind === "balcony" && t.block) v(n - .12, n + i + .12, o, o + .12, 0, .07, g);
		else if (t.kind === "balcony") {
			v(n - .12, n + i + .12, o, o + .12, 0, .07, g), v(n - .4, n + i + .4, a - .17, a, 0, .9, new e.Color(.82, .8, .76));
			let t = (e, t, n, i) => {
				let o = _(e, a, n), s = _(t, a, i), c = Math.max(1, Math.round(Math.hypot(s[0] - o[0], s[2] - o[2]) / 1.2));
				for (let e = 0; e < c; e++) {
					let t = [o[0] + (s[0] - o[0]) * e / c, o[2] + (s[2] - o[2]) * e / c], n = [o[0] + (s[0] - o[0]) * (e + 1) / c, o[2] + (s[2] - o[2]) * (e + 1) / c], [i, l, u, d] = we.baranda;
					r.quad([
						t[0],
						a,
						t[1]
					], [
						n[0],
						a,
						n[1]
					], [
						n[0],
						a + 1,
						n[1]
					], [
						t[0],
						a + 1,
						t[1]
					], [i, l], [u, l], [u, d], [i, d], Ne, [
						n[1] - t[1],
						0,
						t[0] - n[0]
					]);
				}
			};
			t(n - .35, n + i + .35, .85, .85), t(n - .35, n - .35, 0, .85), t(n + i + .35, n + i + .35, .85, 0);
		}
	}
	let D = i.setback;
	if (i.main && D > 1.6 && D < 12) {
		let n = D - .1, i = m() < .55 ? new e.Color(.36, .5, .25) : new e.Color(.66, .6, .55);
		t.quad(_(0, .15, .05), _(l, .15, .05), _(l, .15, n - .15), _(0, .15, n - .15), [0, 0], [1, 0], [1, 1], [0, 1], i, ke);
		let a = h.clone().lerp(Ne, .2), o = .5 + m() * .3, s = o + 1.2, c = x.find((e) => e.kind === "garage") || x.find((e) => e.kind === "door") || x.find((e) => e.kind === "portal"), u = c ? c.a - .1 : -1, d = c ? c.a + c.w + .1 : -1, g = (e) => v(e - .17, e + .17, 0, s + .1, n - .17, n + .17, a);
		for (let [e, t] of c ? [[0, u], [d, l]] : [[0, l]]) {
			if (t - e < .3) continue;
			v(e, t, 0, o, n - .1, n + .1, a);
			let [i, c, l, u] = we.reja, d = Math.max(1, Math.round((t - e) / 1.4));
			for (let a = 0; a < d; a++) {
				let m = e + (t - e) * a / d, h = e + (t - e) * (a + 1) / d;
				r.quad(_(m, o, n), _(h, o, n), _(h, s, n), _(m, s, n), [i, c], [l, c], [l, u], [i, u], Ne, [
					f,
					0,
					p
				]);
			}
			g(e + .17), g(t - .17);
		}
		if (c) {
			let e = c.tint || je[0];
			for (let t = u + .05; t < d - .04; t += .12) v(t, t + .03, .05, s - .05, n - .02, n + .02, e);
			v(u, d, s - .12, s - .04, n - .03, n + .03, e), v(u, d, .05, .13, n - .03, n + .03, e), v(u, d, s * .5, s * .5 + .06, n - .03, n + .03, e);
		}
	}
}
var Ve = new e.Color(.62, .62, .6), He = new e.Color(.93, .74, .12), Ue = new e.Color(.7, .68, .64);
function We(e, t, r, i, a) {
	let o = Math.hypot(r[0] - t[0], r[1] - t[1]);
	if (o < 1) return;
	let s = (r[0] - t[0]) / o, c = (r[1] - t[1]) / o, l = n(a), u = Ke(e, t, s, c);
	if (u(0, o, i, i + .12, -.2, .06, Ue), l() < .4) {
		let e = .3 + l() * (o - .6);
		u(e - .05, e + .05, 0, i + .05, .02, .12, Ve);
	}
	if (l() < .2 && i > 5) {
		let e = .5 + l() * (o - 1), t = 1.2 + l() * (i - 3);
		u(Math.max(0, e - 2.5), Math.min(o, e + 2.5), t, t + .05, .02, .08, He), u(e - .025, e + .025, .4, t, .02, .08, He);
	}
}
var Ge = /* @__PURE__ */ new Float64Array(12);
function Ke(e, t, n, r) {
	let i = r, a = -n, o = t[0], s = t[1], c = (e, t, c, l) => {
		Ge[e] = o + n * t + i * l, Ge[e + 1] = c, Ge[e + 2] = s + r * t + a * l;
	}, l = (t, n, r, i, a, o, s, l, u, d, f, p, m, h, g, _) => {
		c(0, t, n, r), c(3, i, a, o), c(6, s, l, u), c(9, d, f, p), e.quadRaw(Ge, m, h, g, _);
	};
	return (e, t, o, s, c, u, d) => {
		l(e, o, u, t, o, u, t, s, u, e, s, u, d, i, 0, a), l(e, s, c, t, s, c, t, s, u, e, s, u, d, 0, 1, 0), l(e, o, c, t, o, c, t, o, u, e, o, u, d, 0, -1, 0), l(e, o, c, e, o, u, e, s, u, e, s, c, d, -n, 0, -r), l(t, o, c, t, o, u, t, s, u, t, s, c, d, n, 0, r);
	};
}
//#endregion
//#region src/world/buildings.js
var qe = {
	house: [
		"#f3eee2",
		"#efe1c4",
		"#f2d6c0",
		"#e9c9a8",
		"#dfe4dc",
		"#d9e2ea",
		"#f4e7a8",
		"#e7b89a",
		"#cfd8c0",
		"#ffffff",
		"#e9dccb",
		"#d8c7b0",
		"#c9d6de",
		"#f0c9b4",
		"#e8d9b0",
		"#d6c3a5",
		"#c7cfc0",
		"#e3cfc2",
		"#bfcfd8",
		"#f1e3d3"
	],
	brick: [
		"#ffffff",
		"#f2eeea",
		"#e6dcd6",
		"#ffece0"
	],
	apartments: [
		"#ffffff",
		"#efece6",
		"#e6e1d6",
		"#d9d6d0",
		"#f3eadb",
		"#dfe3e6"
	],
	office: [
		"#ffffff",
		"#dfe8ee",
		"#e8efe8",
		"#d6dde6"
	],
	church: ["#ffffff", "#f4ead6"],
	villa: [
		"#7fb3e0",
		"#e88a8a",
		"#9fcf8a",
		"#f5d97a",
		"#f4b27a",
		"#d59ac0",
		"#ffffff",
		"#b8acdf",
		"#8fd0c8",
		"#e9e1a0",
		"#f0c0c0"
	]
}, Je = {
	house: "house",
	ph: "house",
	apartments: "apartments",
	brick: "brick",
	office: "office",
	church: "church",
	civic: "church",
	station: "brick",
	mall: "office",
	monument: "church",
	industrial: "brick",
	school: "brick",
	hospital: "apartments",
	brewery: "brick"
}, W = {
	cube: ((t, n, r, i = n / 2) => V(new e.BoxGeometry(t, n, r).translate(0, i, 0)))(1, 1, 1),
	tire: V(new e.CylinderGeometry(.34, .34, .2, 7).translate(0, .1, 0)),
	stone: V(new e.OctahedronGeometry(.2, 0).scale(1, .6, 1)),
	tank: V(new e.CylinderGeometry(.55, .5, 1.1, 8, 1, !0).translate(0, .55, 0)),
	lid: V(new e.CylinderGeometry(.3, .55, .18, 8).translate(0, 1.19, 0)),
	pipe: V(new e.CylinderGeometry(.5, .5, 1, 6).translate(0, .5, 0)),
	hat: V(new e.ConeGeometry(.5, .4, 6).translate(0, .2, 0)),
	dish: V(new e.CylinderGeometry(.42, .3, .08, 10).rotateX(1.1).translate(0, .75, 0))
}, Ye = new e.Matrix4(), Xe = new e.Quaternion(), Ze = new e.Euler(), Qe = new e.Vector3(), $e = new e.Vector3();
function G(e, t, n, r, i, a, o = 0, s = 0, c = 0) {
	return Ze.set(s, o, c), Xe.setFromEuler(Ze), Ye.compose($e.set(e, t, n), Xe, Qe.set(r, i, a));
}
var et = (t) => new e.Color(t), K = {
	concrete: et("#9d988e"),
	rebar: et("#5b3b28"),
	tire: et("#1d1d1d"),
	stone: et("#8a857c"),
	brick: et("#b5603c"),
	metal: et("#6d6f70"),
	alu: et("#b8bcbf"),
	pilar: et("#c9c3b6"),
	meter: et("#8e9396"),
	rust: et("#7a4a2c"),
	black: et("#202020"),
	beige: et("#d6cba2"),
	blue: et("#2d5f9a"),
	white: et("#e8e8e4")
};
function tt(t, { chunks: o, collision: c, tex: l, graph: u }) {
	let d = l.facades.layer, f = [], p = new ze(), m = new e.Color(1, 1, 1), h = (t.specials || []).filter((e) => e.type === "stadium").map((e) => [e.box, 3 + Math.max(e.depth || 0, 12)]), g = (e, t) => h.some(([n, r]) => {
		let i = e - n.cx, a = t - n.cz;
		return Math.abs(i * n.ux + a * n.uz) < n.hu + r && Math.abs(i * n.vx + a * n.vz) < n.hv + r;
	});
	return t.buildings.forEach((t, l) => {
		let h = t.pts;
		if (h.length < 3 || t.special && (t.special.type === "cathedral" || t.special.type === "church") || !t.special && g(h[0][0], h[0][1])) return;
		let _ = h.length, v = i(h) < 0;
		v && (h = h.slice().reverse());
		let y = n(r(`${l}:${h[0][0].toFixed(1)}`)), b = Math.max(2.5, t.h || 6), x = s(h), S = (x.minX + x.maxX) / 2, C = (x.minZ + x.maxZ) / 2, w = o.at(S, C), T = w.facade;
		if (c.addPolygon(h, b, "building"), t.villa || t.style === "villa") {
			ct(h, b, t.levels || 1, y, w, d, f);
			return;
		}
		let E = Je[t.style] || "house";
		t.style === "brick" && b < 10.5 && y() < .55 && (E = "house");
		let D = qe[E], O = new e.Color(t.color || D[Math.floor(y() * D.length)]), k = (E === "house" || E === "brick") && b < 10.5 && !t.special, A = t.front !== void 0 && t.front !== null, j = (e) => {
			if (!A) return !0;
			let n = v ? (2 * _ - 2 - e) % _ : e;
			return n < 30 ? (t.front >>> n & 1) == 1 : t.front !== 0;
		}, M = Math.abs(i(h)), N = d[E], P = d[`ground${Math.floor(y() * 4)}`], F = y(), ee = A && t.front === 0 ? N : E === "brick" || F < .25 ? d.medianeraLadrillo : F < .4 ? d.hueco : d.medianera, I = ee === d.medianeraLadrillo || ee === d.hueco ? new e.Color().setScalar(.92 + y() * .1) : O, L = (e, t, n, i, a, o) => {
			if (T.wall(e, t, 0, i, a, 6, 6, I, ee), i >= 4.5 && p.addMed(e, t, i, r(`m${l}:${o}`)), i < 6 || n < 5) return;
			let s = y();
			if (s > .22) return;
			let c = (t[0] - e[0]) / n, u = (t[1] - e[1]) / n, f = u, h = -c, g = s < .13, _ = Math.min(n - 1, g ? 8 : 9), v = g ? Math.min(i - .5, 6) : Math.min(i * .45, 4.5), b = (n - _) / 2, x = g ? .2 : i - v - .8, S = (t, n) => [
				e[0] + c * t + f * .02,
				n,
				e[1] + u * t + h * .02
			], C = g ? d.huella : d[`pub${Math.floor(y() * 3)}`];
			T.quad(S(b, x), S(b + _, x), S(b + _, x + v), S(b, x + v), [1, 0], [0, 0], [0, 1], [1, 1], m, [
				f,
				0,
				h
			], C);
		}, R = k && !t.shop && (t.levels >= 2 ? y() < .16 : y() < .05), z = R ? Math.max(0, b - 2.9) : b, B = Math.floor(y() * 4) * 1.5, te = /* @__PURE__ */ new Set(), V = -1, ne = 0;
		for (let e = 0; e < _; e++) {
			let t = Math.hypot(h[(e + 1) % _][0] - h[e][0], h[(e + 1) % _][1] - h[e][1]);
			j(e) && t > ne && (ne = t, V = e);
		}
		let re = 0;
		for (let e = 0; e < _; e++) {
			let n = h[e], i = h[(e + 1) % _], a = Math.hypot(i[0] - n[0], i[1] - n[1]);
			if (a < .01) continue;
			let o = -re / 6 + B, s = j(e);
			if (k && s && !t.shop && a >= 2.2) {
				let s = r(`${l}:${e}`), c = e === V, f = Pe(a, b, t.levels || 1, s, c);
				Ie(T, d, n, i, b, z, O, E === "brick" ? d.medianeraLadrillo : d.revoque, o, f), p.add(n, i, b, z, t.levels || 1, O, s, c, c ? nt(u, n, i, a) : 0, E), R && b - z > .05 && T.wall(n, i, z, b, o, 6, 5.8, m, d.hueco, .5);
			} else if (k) {
				if (s) {
					let e = 0;
					{
						let t = Math.min(3, b);
						T.wall(n, i, 0, t, o, 6, 3, O, P, 0), e = t;
					}
					z - e > .05 && T.wall(n, i, e, z, o, 6, 6, O, N);
				} else z > .05 && L(n, i, a, z, o, e);
				R && b - z > .05 && T.wall(n, i, z, b, o, 6, 5.8, m, s ? d.hueco : d.medianeraLadrillo, .5);
			} else if (s && !t.shop && !t.special && (E === "apartments" || E === "brick") && (t.levels || 0) >= 3 && b < 80 && a >= 3) {
				let s = r(`${l}:${e}`), c = e === V, f = Fe(a, b, t.levels, s, c);
				Ie(T, d, n, i, b, b, O, E === "brick" ? d.medianeraLadrillo : d.revoque, o, f), te.add(e);
				let m = (i[0] - n[0]) / a, h = (i[1] - n[1]) / a, g = h, _ = -m, v = Math.atan2(-h, m), y = (e, t) => [n[0] + m * e + g * t, n[1] + h * e + _ * t];
				for (let e of f) {
					if (e.kind !== "balcony") continue;
					let [t, n] = y(e.a + e.w / 2, .45);
					w.props.add(W.cube, G(t, e.y0 - .17, n, e.w + .8, .17, .9, v), K.white, .1);
					let r = y(e.a - .35, .85), i = y(e.a + e.w + .35, .85);
					at(w.alpha, r, i, e.y0, 1, we.baranda, 1.2), at(w.alpha, y(e.a - .35, 0), r, e.y0, 1, we.baranda, 1), at(w.alpha, i, y(e.a + e.w + .35, 0), e.y0, 1, we.baranda, 1);
				}
				p.add(n, i, b, b, t.levels, O, s, c, c ? nt(u, n, i, a) : 0, "block");
			} else !s && A && t.front !== 0 && (t.levels || 0) < 10 && E !== "office" && E !== "church" ? L(n, i, a, b, o, e) : b - 0 > .1 && T.wall(n, i, 0, b, o, 6, 6, O, N);
			re += a;
		}
		let H = .85 + y() * .3, ie = new e.Color(H, H, H), ae = k && !t.shop && !R && _ === 4 && b < 7.5 && M > 45 && M < 320 && y() < .3;
		if (ae && t.roof !== "gable" && y() < .55) ut(h, b, T, ie, d.roofTile);
		else if ((t.roof === "gable" || ae) && _ === 4) dt(h, b, T, O, ie, d.roofTile, E === "brick" ? d.brick : d.medianera);
		else if (t.roof === "spire") {
			let t = [
				S,
				b + Math.max(8, b * .35),
				C
			];
			for (let n = 0; n < _; n++) {
				let r = h[n], i = h[(n + 1) % _];
				T.tri([
					r[0],
					b,
					r[1]
				], [
					i[0],
					b,
					i[1]
				], t, [0, 0], [1, 0], [.5, 1], new e.Color(.55, .6, .62), [
					(r[0] + i[0]) / 2 - S,
					.5,
					(r[1] + i[1]) / 2 - C
				], d.roofTile);
			}
		} else {
			let e = y(), t = E === "office" || E === "church" || e < .45 ? d.roofFlat : e < .78 ? d.roofMembrana : d.roofBaldosa;
			if (it(T, h, b, ie, t), E !== "office" && E !== "church" && M > 40 && y() < .7 && a(S, C, h) && f.push([
				S + (y() - .5) * 2,
				C + (y() - .5) * 2,
				b,
				b > 12 ? 1.6 : 1
			]), k && a(S, C, h) && rt(w.props, S, C, b, y, 1), k) {
				if (R) ot(w.props, h, b, y, .6);
				else if (y() < .35) for (let e = 0; e < _; e++) {
					if (!j(e)) continue;
					let t = h[e], n = h[(e + 1) % _];
					at(w.alpha, t, n, b, 1, we.baranda);
				}
			}
		}
		if (!A) return;
		let U = (t.roof !== "gable" && !ae || _ !== 4) && t.roof !== "spire", oe = (E === "apartments" || E === "brick") && (t.levels || 0) >= 3, se = O.clone().lerp(m, .45);
		for (let e = 0; e < _; e++) {
			if (!j(e)) continue;
			let n = h[e], r = h[(e + 1) % _], i = Math.hypot(r[0] - n[0], r[1] - n[1]);
			if (i < 2) continue;
			let a = (r[0] - n[0]) / i, o = (r[1] - n[1]) / i, s = o, c = -a, l = Math.atan2(-o, a), u = (n[0] + r[0]) / 2, d = (n[1] + r[1]) / 2;
			if (U && E !== "church" && w.props.add(W.cube, G(u + s * .1, b - .34, d + c * .1, i + .2, .54, .24, l), se), oe && !te.has(e)) {
				let e = Math.floor((i - .6) / 3.4);
				for (let r = 0; r < e; r++) {
					if (y() < .2) continue;
					let u = (r + .5) / e, d = n[0] + a * i * u, f = n[1] + o * i * u, p = y() < .4 ? 1 + Math.floor(y() * (t.levels - 1)) : 0;
					for (let e = 1; e < t.levels; e++) {
						let t = e * 3;
						w.props.add(W.cube, G(d + s * .5, t - .08, f + c * .5, 2.6, .16, 1, l), K.white, .1);
						let n = [d - a * 1.3 + s, f - o * 1.3 + c], r = [d + a * 1.3 + s, f + o * 1.3 + c];
						at(w.alpha, n, r, t + .08, 1, we.baranda, 2.6), at(w.alpha, [d - a * 1.3, f - o * 1.3], n, t + .08, 1, we.baranda, 1), at(w.alpha, r, [d + a * 1.3, f + o * 1.3], t + .08, 1, we.baranda, 1), e === p && w.props.add(W.cube, G(d + a * 1.75 + s * .17, t + 1.62, f + o * 1.75 + c * .17, .82, .56, .3, l), K.white);
					}
				}
			}
			if (k && y() < .3 && i > 4) {
				let e = y() < .5 ? .12 : .88, t = n[0] + a * i * e + s * .25, r = n[1] + o * i * e + c * .25;
				w.props.add(W.cube, G(t, 0, r, .5, 1.7, .32, l), K.pilar, .2), w.props.add(W.cube, G(t + s * .17, .9, r + c * .17, .34, .42, .06, l), K.meter), w.props.add(W.pipe, G(t, 1.7, r, .05, 1.2, .05), K.metal);
			}
			if (!oe && k && y() < .22) {
				let e = .2 + y() * .6;
				w.props.add(W.cube, G(n[0] + a * i * e + s * .17, Math.min(2.3, b - .8) - .28, n[1] + o * i * e + c * .17, .82, .56, .3, l), K.white);
			}
		}
	}), {
		tanks: f,
		detail: p
	};
}
function nt(e, t, n, r) {
	if (!e) return 0;
	let i = (n[0] - t[0]) / r, a = (n[1] - t[1]) / r, o = a, s = -i, c = (t[0] + n[0]) / 2, l = (t[1] + n[1]) / 2, u = e.nearest(c + o, l + s, 30);
	if (!u) return 0;
	let d = u.seg.road;
	if (d.kind === "footway" || d.kind === "pedestrian" || d.pasillo || d.dirt || d.kind === "service") return 0;
	let f = u.x - c, p = u.z - l, m = Math.hypot(f, p) || 1;
	if ((f * o + p * s) / m < .85) return 0;
	let h = u.seg.b.x - u.seg.a.x, g = u.seg.b.z - u.seg.a.z, _ = Math.hypot(h, g) || 1;
	return Math.abs((h * i + g * a) / _) < .85 ? 0 : Math.max(0, m - d.w / 2 - 3);
}
function rt(e, t, n, r, i, a) {
	let o = () => (i() - .5) * 2.4;
	if (i() < .22) {
		let a = t + o(), s = n + o(), c = 2.4 + i() * 1.6, l = i() * 3;
		e.add(W.pipe, G(a, r, s, .05, c, .05), K.alu);
		for (let t = 0; t < 3; t++) e.add(W.cube, G(a, r + c - .15 - t * .32, s, 1.3 - t * .3, .025, .025, l), K.alu);
	}
	if (i() < .2 * a && e.add(W.dish, G(t + o(), r, n + o(), 1, 1, 1, -.8 + i() * .6), K.white, .1), i() < .35) {
		let i = t + o(), a = n + o();
		e.add(W.pipe, G(i, r, a, .12, 1.1, .12), K.metal), e.add(W.hat, G(i, r + 1.1, a, .42, .5, .42), K.metal);
	}
}
function it(t, n, r, i, a, o = 1 / 6) {
	let s = n.map(([t, n]) => new e.Vector2(t, n)), c = e.ShapeUtils.triangulateShape(s, []);
	for (let [e, s, l] of c) {
		let c = [
			n[e],
			n[s],
			n[l]
		];
		t.tri(...c.map(([e, t]) => [
			e,
			r,
			t
		]), ...c.map(([e, t]) => [e * o, t * o]), i, [
			0,
			1,
			0
		], a);
	}
}
function at(t, n, r, i, a, o, s = 3, c = new e.Color(1, 1, 1)) {
	let l = Math.hypot(r[0] - n[0], r[1] - n[1]), u = Math.max(1, Math.round(l / s)), [d, f, p, m] = o;
	for (let e = 0; e < u; e++) {
		let o = [n[0] + (r[0] - n[0]) * e / u, n[1] + (r[1] - n[1]) * e / u], s = [n[0] + (r[0] - n[0]) * (e + 1) / u, n[1] + (r[1] - n[1]) * (e + 1) / u];
		t.quad([
			o[0],
			i,
			o[1]
		], [
			s[0],
			i,
			s[1]
		], [
			s[0],
			i + a,
			s[1]
		], [
			o[0],
			i + a,
			o[1]
		], [d, f], [p, f], [p, m], [d, m], c, [
			s[1] - o[1],
			0,
			o[0] - s[0]
		]);
	}
}
function ot(e, t, n, r, i) {
	let a = t.length;
	for (let o = 0; o < a; o++) {
		if (r() > i) continue;
		let s = t[o], c = t[(o + a - 1) % a], l = t[(o + 1) % a], u = (c[0] + l[0]) / 2 - s[0], d = (c[1] + l[1]) / 2 - s[1], f = Math.hypot(u, d) || 1, p = s[0] + u / f * .2, m = s[1] + d / f * .2, h = .2 + r() * .6;
		e.add(W.cube, G(p, n, m, .22, h, .22), K.concrete, .3);
		for (let [t, i] of [[-.07, -.07], [.07, .07]]) e.add(W.cube, G(p + t, n + h, m + i, .022, .5 + r() * .6, .022, 0, (r() - .5) * .3, (r() - .5) * .3), K.rebar);
	}
}
function st(e, t, n, r, i) {
	let a = 1.2 + i() * 1.4, o = i() < .5 ? K.metal : K.rust;
	for (let [i, s] of [
		[-.45, -.45],
		[.45, -.45],
		[.45, .45],
		[-.45, .45]
	]) e.add(W.cube, G(t + i, r, n + s, .06, a, .06), o);
	e.add(W.cube, G(t, r + a, n, 1.1, .06, 1.1), o);
	let s = i(), c = s < .5 ? K.black : s < .8 ? K.beige : K.blue;
	e.add(W.tank, G(t, r + a + .06, n, 1, 1, 1), c, .15), e.add(W.lid, G(t, r + a + .06, n, 1, 1, 1), c);
}
function ct(t, n, r, i, o, c, l) {
	let u = o.facade, d = t.length, f = i(), p = f < .55 ? "hueco" : f < .85 ? "paint" : "mixed", m = new e.Color(qe.villa[Math.floor(i() * qe.villa.length)]), h = new e.Color().setRGB(.92 + i() * .12, .9 + i() * .1, .88 + i() * .1), g = n / Math.max(1, r), _ = i() * 6, v = 0;
	for (let e = 0; e < d; e++) {
		let r = t[e], i = t[(e + 1) % d], a = Math.hypot(i[0] - r[0], i[1] - r[1]);
		if (a < .01) continue;
		let o = -v / 6 + _;
		p === "hueco" ? u.wall(r, i, 0, n, o, 6, g * 2, h, c.hueco) : p === "paint" ? u.wall(r, i, 0, n, o, 6, g * 2, m, c.villa) : (u.wall(r, i, 0, g, o, 6, g * 2, m, c.villa, 0), n - g > .05 && u.wall(r, i, g, n, o, 6, g * 2, h, c.hueco)), v += a;
	}
	let y = s(t), b = (y.minX + y.maxX) / 2, x = (y.minZ + y.maxZ) / 2;
	if ((r === 1 ? i() < .72 : i() < .4) && d === 4) lt(o, t, n, i, p === "paint" ? m : h, c);
	else {
		let r = .75 + i() * .3;
		it(u, t, n, new e.Color(r, r, r), c.roofFlat), i() < .6 && ot(o.props, t, n, i, .7);
		let s = i();
		a(b, x, t) && (s < .35 ? st(o.props, b + (i() - .5), x + (i() - .5), n, i) : s < .6 && l.push([
			b,
			x,
			n,
			.9
		])), a(b, x, t) && rt(o.props, b + 1, x - 1, n, i, 1.3), i() < .4 && o.props.add(W.cube, G(b + (i() - .5) * 2, n, x + (i() - .5) * 2, .9, .25 + i() * .3, .6, i() * 3), K.brick, .3);
	}
}
function lt(t, n, r, i, a, o) {
	let s = t.facade, c = Math.hypot(n[1][0] - n[0][0], n[1][1] - n[0][1]) >= Math.hypot(n[2][0] - n[1][0], n[2][1] - n[1][1]) ? n : [
		n[1],
		n[2],
		n[3],
		n[0]
	], l = (c[0][0] + c[2][0]) / 2, u = (c[0][1] + c[2][1]) / 2, d = (e) => {
		let t = e[0] - l, n = e[1] - u, r = Math.hypot(t, n) || 1;
		return [e[0] + t / r * .3, e[1] + n / r * .3];
	}, f = r + .3 + i() * .2, p = r - .05, m = c.map(d), h = i(), g = h < .55 ? new e.Color().setScalar(.85 + i() * .25) : h < .85 ? new e.Color(1, .72 + i() * .1, .55) : new e.Color(qe.villa[Math.floor(i() * 4)]).lerp(new e.Color(1, 1, 1), .4), _ = [
		m[0][0],
		f,
		m[0][1]
	], v = [
		m[1][0],
		f,
		m[1][1]
	], y = [
		m[2][0],
		p,
		m[2][1]
	], b = [
		m[3][0],
		p,
		m[3][1]
	], x = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]), S = Math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1]);
	s.quad(_, v, y, b, [0, 0], [x / 4, 0], [x / 4, S / 4], [0, S / 4], g, [
		0,
		1,
		0
	], o.chapa), s.quad(_, v, y, b, [0, 0], [x / 4, 0], [x / 4, S / 4], [0, S / 4], new e.Color(.45, .45, .45), [
		0,
		-1,
		0
	], o.chapa);
	let C = (e, t) => [
		e[0],
		t,
		e[1]
	], w = r + .3;
	s.quad(C(c[0], r), C(c[1], r), C(c[1], w), C(c[0], w), [0, 0], [1, 0], [1, .05], [0, .05], a, [
		(c[0][0] + c[1][0]) / 2 - l,
		0,
		(c[0][1] + c[1][1]) / 2 - u
	], o.hueco), s.tri(C(c[1], r), C(c[2], r), C(c[1], w), [0, 0], [1, 0], [0, .05], a, [
		(c[1][0] + c[2][0]) / 2 - l,
		0,
		(c[1][1] + c[2][1]) / 2 - u
	], o.hueco), s.tri(C(c[3], r), C(c[0], r), C(c[0], w), [0, 0], [1, 0], [1, .05], a, [
		(c[3][0] + c[0][0]) / 2 - l,
		0,
		(c[3][1] + c[0][1]) / 2 - u
	], o.hueco);
	let T = 1 + Math.floor(i() * 4);
	for (let e = 0; e < T; e++) {
		let e = .15 + i() * .7, n = .15 + i() * .7, r = c[0][0] + (c[1][0] - c[0][0]) * e + (c[3][0] - c[0][0]) * n, a = c[0][1] + (c[1][1] - c[0][1]) * e + (c[3][1] - c[0][1]) * n, o = f + (p - f) * n + .02, s = i();
		s < .4 ? t.props.add(W.tire, G(r, o, a, 1, 1, 1, 0, (i() - .5) * .3), K.tire) : s < .8 ? t.props.add(W.stone, G(r, o + .08, a, 1 + i(), 1, 1 + i(), i() * 3), K.stone, .4) : t.props.add(W.cube, G(r, o, a, .18, .12, .33, i() * 3), K.brick);
	}
}
function ut(t, n, r, i, a) {
	let o = Math.hypot(t[1][0] - t[0][0], t[1][1] - t[0][1]), s = Math.hypot(t[2][0] - t[1][0], t[2][1] - t[1][1]), c = o >= s ? t : [
		t[1],
		t[2],
		t[3],
		t[0]
	], l = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, u = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4, d = Math.max(o, s), f = Math.min(o, s), p = (c[1][0] - c[0][0]) / d, m = (c[1][1] - c[0][1]) / d, h = -m, g = p, _ = .4, v = n - .12, y = f * .3, b = c.map(([e, t]) => {
		let n = (e - l) * p + (t - u) * m, r = (e - l) * h + (t - u) * g, i = n + Math.sign(n) * _, a = r + Math.sign(r) * _;
		return [
			l + p * i + h * a,
			v,
			u + m * i + g * a
		];
	}), x = Math.max(0, (d - f) / 2), S = [
		l - p * x,
		n + y,
		u - m * x
	], C = [
		l + p * x,
		n + y,
		u + m * x
	], w = (e, t) => [
		(e[0] + t[0]) / 2 - l,
		1.2,
		(e[2] + t[2]) / 2 - u
	], T = [
		[0, 0],
		[d / 4, 0],
		[d / 4 - f / 8, f / 4],
		[f / 8, f / 4]
	];
	r.quad(b[0], b[1], C, S, ...T, i, w(b[0], b[1]), a), r.quad(b[2], b[3], S, C, ...T, i, w(b[2], b[3]), a), r.tri(b[1], b[2], C, [0, 0], [f / 4, 0], [f / 8, f / 4], i, w(b[1], b[2]), a), r.tri(b[3], b[0], S, [0, 0], [f / 4, 0], [f / 8, f / 4], i, w(b[3], b[0]), a);
	let E = new e.Color(.55, .52, .48);
	r.quad(b[0], b[1], b[2], b[3], [0, 0], [1, 0], [1, 1], [0, 1], E, [
		0,
		-1,
		0
	], a);
}
function dt(e, t, n, r, i, a, o) {
	let s = Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]), c = Math.hypot(e[2][0] - e[1][0], e[2][1] - e[1][1]), l = s >= c ? e : [
		e[1],
		e[2],
		e[3],
		e[0]
	], u = Math.min(s, c), d = Math.max(s, c), f = u * .32, p = (e, n) => [
		(e[0] + n[0]) / 2,
		t + f,
		(e[1] + n[1]) / 2
	], m = p(l[3], l[0]), h = p(l[1], l[2]), g = (e) => [
		e[0],
		t,
		e[1]
	], _ = (l[0][0] + l[2][0]) / 2, v = (l[0][1] + l[2][1]) / 2, y = (e, t) => [
		(e[0] + t[0]) / 2 - _,
		u,
		(e[1] + t[1]) / 2 - v
	], b = d / 4, x = u / 4;
	n.quad(g(l[0]), g(l[1]), h, m, [0, 0], [b, 0], [b, x], [0, x], i, y(l[0], l[1]), a), n.quad(g(l[2]), g(l[3]), m, h, [0, 0], [b, 0], [b, x], [0, x], i, y(l[2], l[3]), a);
	let S = (e, t) => [
		(e[0] + t[0]) / 2 - _,
		0,
		(e[1] + t[1]) / 2 - v
	];
	n.tri(g(l[1]), g(l[2]), h, [0, t / 6], [u / 6, t / 6], [u / 12, (t + f) / 6], r, S(l[1], l[2]), o), n.tri(g(l[3]), g(l[0]), m, [0, t / 6], [u / 6, t / 6], [u / 12, (t + f) / 6], r, S(l[3], l[0]), o);
}
//#endregion
//#region src/world/corridors.js
var ft = 6.2, pt = -5.6, mt = 42, ht = 11.5, gt = 3.6, _t = 7.95, vt = /* @__PURE__ */ new Set([
	"barrier",
	"railfence",
	"deckwall",
	"tree",
	"pole",
	"prop",
	"building",
	"platform"
]);
function yt(e, t, n, r) {
	let i = t[0] - e[0], a = t[1] - e[1], o = r[0] - n[0], s = r[1] - n[1], c = i * s - a * o;
	if (Math.abs(c) < 1e-9) return null;
	let l = ((n[0] - e[0]) * s - (n[1] - e[1]) * o) / c, u = ((n[0] - e[0]) * a - (n[1] - e[1]) * i) / c;
	return l >= 0 && l < 1 && u >= 0 && u <= 1 ? l : null;
}
var bt = (e, t, n) => {
	let r = Infinity;
	for (let i = 0; i < n.length - 1; i++) r = Math.min(r, o(e, t, n[i][0], n[i][1], n[i + 1][0], n[i + 1][1])[3]);
	return Math.sqrt(r);
};
function xt(e, t, n, r) {
	let i = (n) => {
		let r = 1;
		for (; r < t.length - 1 && t[r] < n;) r++;
		let i = (n - t[r - 1]) / (t[r] - t[r - 1] || 1);
		return [e[r - 1][0] + (e[r][0] - e[r - 1][0]) * i, e[r - 1][1] + (e[r][1] - e[r - 1][1]) * i];
	}, a = [i(n)];
	for (let i = 0; i < e.length; i++) t[i] > n && t[i] < r && a.push(e[i]);
	return a.push(i(r)), a;
}
function St(e) {
	let t = {
		decks: [],
		levels: [],
		obstacles: []
	};
	if (!e.decks) return t;
	let n = e.roads.filter((e) => e.motorway), r = e.roads.filter((e) => e.ramp);
	e.roads = e.roads.filter((e) => !(e.kind === "primary" && e.w >= 24 && e.oneway && !e.motorway && e.pts.filter(([e, t]) => r.some((n) => bt(e, t, n.pts) < 5)).length >= e.pts.length * .6));
	for (let e of n) e.w = ht;
	let i = new c(60), a = (e, n, r) => {
		for (let a = 0; a < e.length - 1; a++) {
			let o = {
				a: e[a],
				b: e[a + 1],
				type: n,
				half: r
			};
			i.insert(o, s([e[a], e[a + 1]])), t.obstacles.push(o);
		}
	};
	for (let t of e.rails || []) a(t.pts, "rail", gt);
	for (let e of n) a(e.pts, "mw", _t);
	let l = (t, n, r, i, a) => e.decks.find((e) => {
		if ((a ? e.rail || e.highway === "motorway" : !(e.rail || e.highway === "motorway")) || bt(t, n, e.pts) > (a ? 8 : 30)) return !1;
		if (!a) return !0;
		let [o, s] = [e.pts[0], e.pts[e.pts.length - 1]], c = Math.hypot(s[0] - o[0], s[1] - o[1]) || 1;
		return Math.abs(((s[0] - o[0]) * r + (s[1] - o[1]) * i) / c) > .6;
	}), u = (t, n) => e.levelCrossings.some((e) => Math.hypot(e.x - t, e.z - n) < 16), d = new c(40);
	for (let t of e.roads) if (!(t.kind === "footway" || t.motorway)) for (let e = 0; e < t.pts.length - 1; e++) d.insert([
		t.pts[e],
		t.pts[e + 1],
		t.w
	], s([t.pts[e], t.pts[e + 1]]));
	let f = (e) => {
		let t = 0, n = 0;
		for (let r = e.span + 2; r < e.span + e.ramp; r += 3) for (let i of [-1, 1]) {
			let a = e.x + e.ux * r * i, s = e.z + e.uz * r * i;
			n++;
			for (let [n, r, i] of d.query(a, s, a, s)) {
				let c = Math.hypot(r[0] - n[0], r[1] - n[1]) || 1;
				if (Math.abs(((r[0] - n[0]) * e.ux + (r[1] - n[1]) * e.uz) / c) > .8 && o(a, s, n[0], n[1], r[0], r[1])[3] < (i / 2) ** 2) {
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
			let a = n.pts[t], o = n.pts[t + 1];
			for (let s of i.query(Math.min(a[0], o[0]), Math.min(a[1], o[1]), Math.max(a[0], o[0]), Math.max(a[1], o[1]))) {
				if (n.ramp && s.type === "mw") continue;
				let i = yt(a, o, s.a, s.b);
				if (i === null) continue;
				let c = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1, l = e[t + 1] - e[t] || 1, u = Math.abs(((o[0] - a[0]) * (s.b[1] - s.a[1]) - (o[1] - a[1]) * (s.b[0] - s.a[0])) / (c * l));
				r.push({
					s: e[t] + l * i,
					half: s.half / Math.max(.35, u),
					type: s.type
				});
			}
		}
		if (!r.length) {
			p.push(n);
			continue;
		}
		r.sort((e, t) => e.s - t.s);
		let a = [];
		for (let e of r) {
			let t = a[a.length - 1];
			t && e.s - e.half - t.s1 < 30 ? (t.s1 = Math.max(t.s1, e.s + e.half), t.types.add(e.type)) : a.push({
				s0: e.s - e.half,
				s1: e.s + e.half,
				types: /* @__PURE__ */ new Set([e.type])
			});
		}
		let o = [];
		for (let r of a) {
			let i = (r.s0 + r.s1) / 2, [a, s] = xt(n.pts, e, i, i)[0], [c, d] = xt(n.pts, e, Math.max(0, i - 5), Math.min(e[e.length - 1], i + 5)), p = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1, m = (d[0] - c[0]) / p, h = (d[1] - c[1]) / p, g = l(a, s, m, h, !0), _ = g ? g.type === "bridge" ? "over" : "under" : l(a, s, m, h, !1) ? "under" : null;
			if (!_ && !r.types.has("mw") && u(a, s) && (_ = "level"), _ === "level") {
				t.levels.push({
					x: a,
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
				o.push([r.s0 - 3, r.s1 + 3]);
				continue;
			}
			let v = (r.s1 - r.s0) / 2 + 1.5, y = n.kind === "footway" || n.kind === "pedestrian";
			if (t.decks.find((e) => Math.hypot(e.x - a, e.z - s) < 10)) continue;
			let b = {
				x: a,
				z: s,
				ux: m,
				uz: h,
				span: v,
				ramp: y ? 26 : mt,
				half: y ? n.w / 2 + .6 : n.w / 2 + 2.2,
				h: _ === "over" ? y ? 5.4 : ft : pt,
				mode: _,
				rail: r.types.has("rail"),
				mw: r.types.has("mw"),
				ped: y,
				name: n.name
			};
			f(b) ? t.decks.push(b) : o.push([r.s0 - 3, r.s1 + 3]);
		}
		if (!o.length) {
			p.push(n);
			continue;
		}
		let s = 0, c = e[e.length - 1];
		for (let [t, r] of o) t - s > 4 && p.push({
			...n,
			pts: xt(n.pts, e, s, t)
		}), s = r;
		c - s > 4 && p.push({
			...n,
			pts: xt(n.pts, e, s, c)
		});
	}
	e.roads = p;
	for (let e of t.decks) e.len = e.span + e.ramp;
	return t;
}
//#endregion
//#region src/world/textures.js
var q = 256;
function Ct(e = q, t = q) {
	let n = document.createElement("canvas");
	return n.width = e, n.height = t, [n, n.getContext("2d", { willReadFrequently: !0 })];
}
function wt(t, n, { srgb: r = !0, repeat: i = !0 } = {}) {
	let a = new e.CanvasTexture(t);
	return i && (a.wrapS = a.wrapT = e.RepeatWrapping), r && (a.colorSpace = e.SRGBColorSpace), a.anisotropy = n.capabilities.getMaxAnisotropy(), a.generateMipmaps = !0, a.needsUpdate = !0, a;
}
function Tt(e, t, n, r, i, a = .08) {
	for (let o = 0; o < r; o++) {
		let r = Math.floor(i() * 255);
		e.fillStyle = `rgba(${r},${r},${r},${a})`, e.fillRect(i() * t, i() * n, 1 + i() * 3, 1 + i() * 3);
	}
}
function Et(e, { base: t, drawWall: r, drawWindow: i, seed: a }) {
	let o = n(a), [s, c] = Ct(), [l, u] = Ct();
	c.fillStyle = t, c.fillRect(0, 0, q, q), r && r(c, o), Tt(c, q, q, 2500, o), u.fillStyle = "#000", u.fillRect(0, 0, q, q);
	let d = q / 2;
	for (let e = 0; e < 2; e++) for (let t = 0; t < 2; t++) {
		let n = o() < .45;
		i(c, t * d, e * d, d, d, o, !1), n && i(u, t * d, e * d, d, d, o, !0);
	}
	return {
		map: wt(s, e),
		emissive: wt(l, e),
		canvas: s,
		ecanvas: l
	};
}
function Dt(e, t, n, r, i, a, o) {
	if (a) e.fillStyle = o() < .75 ? `hsl(${38 + o() * 10},90%,${55 + o() * 15}%)` : `hsl(200,60%,${60 + o() * 15}%)`;
	else {
		let a = e.createLinearGradient(t, n, t + r, n + i);
		a.addColorStop(0, "#2c3a46"), a.addColorStop(.5, "#5d7385"), a.addColorStop(1, "#27323b"), e.fillStyle = a;
	}
	e.fillRect(t, n, r, i);
}
function Ot(e) {
	let t = {};
	t.house = Et(e, {
		seed: 1,
		base: "#f1ece2",
		drawWall(e) {
			e.fillStyle = "rgba(0,0,0,0.10)", e.fillRect(0, q / 2 - 6, q, 6), e.fillRect(0, 250, q, 6);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .22, c = n + i * .22, l = r * .56, u = i * .52;
			o || (e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(s - 5, c - 5, l + 10, u + 12));
			let d = a();
			if (Dt(e, s, c, l, u, o, a), !o) {
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
	}), t.brick = Et(e, {
		seed: 2,
		base: "#b0643f",
		drawWall(e, t) {
			for (let n = 0; n < q; n += 8) {
				let r = n / 8 % 2 ? 11 : 0;
				for (let i = -22; i < q; i += 22) {
					let a = 38 + t() * 14;
					e.fillStyle = `hsl(${16 + t() * 8},${45 + t() * 15}%,${a}%)`, e.fillRect(i + r + 1, n + 1, 20, 6);
				}
			}
			e.fillStyle = "#d8d2c4", e.fillRect(0, q / 2 - 8, q, 8), e.fillRect(0, 248, q, 8);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .18, c = n + i * .2, l = r * .64, u = i * .55;
			Dt(e, s, c, l, u, o, a), !o && (e.strokeStyle = "#e8e6e0", e.lineWidth = 3, e.strokeRect(s, c, l, u), e.beginPath(), e.moveTo(s + l / 2, c), e.lineTo(s + l / 2, c + u), e.stroke());
		}
	}), t.apartments = Et(e, {
		seed: 3,
		base: "#e4e0d8",
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .1, c = n + i * .12, l = r * .8, u = i * .62;
			if (Dt(e, s, c, l, u, o, a), !o) {
				a() < .5 && (e.fillStyle = "#9d9a90", e.fillRect(s, c, l, u * (.2 + a() * .6))), e.fillStyle = "#cfcac0", e.fillRect(t, n + i * .74, r, i * .06), e.fillStyle = "rgba(40,40,40,0.85)", e.fillRect(t + 2, n + i * .55, r - 4, 3);
				for (let a = t + 4; a < t + r; a += 7) e.fillRect(a, n + i * .55, 2, i * .19);
				e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(t, n + i * .8, r, i * .04);
			}
		}
	}), t.office = Et(e, {
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
	}), t.church = Et(e, {
		seed: 5,
		base: "#e9e0cc",
		drawWall(e) {
			e.fillStyle = "rgba(0,0,0,0.12)";
			for (let t = 0; t < q; t += 16) e.fillRect(0, t, q, 1);
			e.fillRect(0, 238, q, 18);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .32, c = n + i * .18, l = r * .36, u = i * .6;
			e.fillStyle = o ? "#f2c77a" : "#3a4250", e.beginPath(), e.moveTo(s, c + u), e.lineTo(s, c + l / 2), e.arc(s + l / 2, c + l / 2, l / 2, Math.PI, 0), e.lineTo(s + l, c + u), e.closePath(), e.fill();
		}
	});
	{
		let r = n(7), [i, a] = Ct();
		a.fillStyle = "#8d8a84", a.fillRect(0, 0, q, q), Tt(a, q, q, 5e3, r, .12), a.fillStyle = "rgba(60,40,30,0.25)";
		for (let e = 0; e < 6; e++) a.fillRect(r() * q, r() * q, 40 + r() * 60, 30 + r() * 60);
		t.roofFlat = wt(i, e), t.roofFlatCanvas = i;
	}
	{
		let r = n(8), [i, a] = Ct();
		a.fillStyle = "#9a3f25", a.fillRect(0, 0, q, q);
		for (let e = 0; e < q; e += 16) {
			for (let t = 0; t < q; t += 16) a.fillStyle = `hsl(${10 + r() * 10},${55 + r() * 10}%,${30 + r() * 10}%)`, a.beginPath(), a.arc(t + 8, e + 14, 8, Math.PI, 0), a.fill();
			a.fillStyle = "rgba(0,0,0,0.3)", a.fillRect(0, e + 14, q, 2);
		}
		t.roofTile = wt(i, e), t.roofTileCanvas = i;
	}
	let r = (e, t, { cuneta: n = !1, tracks: r = 0, patches: i = 2 } = {}) => {
		e.fillStyle = "#3d3e40", e.fillRect(0, 0, q, q), Tt(e, q, q, 9e3, t, .1);
		for (let n = 0; n < 5; n++) e.fillStyle = `rgba(20,20,20,${.1 + t() * .2})`, e.beginPath(), e.ellipse(t() * q, t() * q, 10 + t() * 30, 6 + t() * 20, t() * 3, 0, Math.PI * 2), e.fill();
		for (let n = 0; n < r; n++) {
			let i = (n + .5) / r * q;
			for (let t of [-.17, .17]) {
				let n = e.createLinearGradient(i + q / r * t - 14, 0, i + q / r * t + 14, 0);
				n.addColorStop(0, "rgba(150,150,150,0)"), n.addColorStop(.5, "rgba(150,150,150,0.13)"), n.addColorStop(1, "rgba(150,150,150,0)"), e.fillStyle = n, e.fillRect(i + q / r * t - 14, 0, 28, q);
			}
			e.fillStyle = "rgba(15,12,10,0.16)";
			for (let n = 0; n < q; n += 4) e.fillRect(i - 5 + (t() - .5) * 3, n, 10, 4);
		}
		for (let n = 0; n < i; n++) {
			let n = 30 + t() * 60, r = 30 + t() * 80, i = 20 + t() * (216 - n), a = t() * (q - r);
			e.fillStyle = t() < .6 ? "rgba(18,18,20,0.22)" : "rgba(120,118,112,0.16)", e.fillRect(i, a, n, r), e.strokeStyle = "rgba(10,10,10,0.3)", e.lineWidth = 1, e.strokeRect(i, a, n, r);
		}
		e.strokeStyle = "rgba(12,12,12,0.55)";
		for (let n = 0; n < 7; n++) {
			let n = t() * q, r = t() * q;
			e.lineWidth = .6 + t() * 1.2, e.beginPath(), e.moveTo(n, r);
			for (let i = 0; i < 8; i++) n += (t() - .5) * 22, r += (t() - .3) * 18, e.lineTo(n, r);
			e.stroke();
		}
		if (n) {
			for (let t of [0, 247]) {
				e.fillStyle = "#8f8b84", e.fillRect(t, 0, 9, q), e.fillStyle = "rgba(40,36,30,0.35)", e.fillRect(t === 0 ? 8 : t, 0, 1, q);
				for (let n = 0; n < q; n += 32) e.fillRect(t, n, 9, 1);
			}
			Tt(e, q, q, 800, t, .08);
		}
	};
	{
		let i = n(9), [a, o] = Ct();
		r(o, i, {
			cuneta: !0,
			tracks: 2
		}), t.road2 = wt(a, e);
	}
	{
		let i = n(10), [a, o] = Ct();
		r(o, i, {
			cuneta: !0,
			tracks: 1
		}), t.road1 = wt(a, e);
	}
	{
		let i = n(11), [a, o] = Ct();
		r(o, i, { patches: 0 }), t.asphalt = wt(a, e);
	}
	{
		let r = n(12), [i, a] = Ct();
		a.fillStyle = "#bdb6a6", a.fillRect(0, 0, q, q);
		for (let e = 0; e < q; e += 32) for (let t = 0; t < q; t += 32) {
			a.fillStyle = `hsl(40,14%,${66 + r() * 10}%)`, a.fillRect(t + 1, e + 1, 30, 30), a.fillStyle = "rgba(0,0,0,0.08)";
			for (let n = 0; n < 9; n++) a.fillRect(t + 5 + n % 3 * 9, e + 5 + Math.floor(n / 3) * 9, 4, 4);
		}
		Tt(a, q, q, 2e3, r, .12), t.sidewalk = wt(i, e);
	}
	{
		let r = n(13), [i, a] = Ct();
		a.fillStyle = "#5b7a3a", a.fillRect(0, 0, q, q);
		for (let e = 0; e < 9e3; e++) a.fillStyle = `hsl(${75 + r() * 30},${30 + r() * 25}%,${22 + r() * 22}%)`, a.fillRect(r() * q, r() * q, 1 + r() * 2, 2 + r() * 4);
		for (let e = 0; e < 25; e++) a.fillStyle = "rgba(110,90,60,0.25)", a.beginPath(), a.ellipse(r() * q, r() * q, 8 + r() * 20, 6 + r() * 14, r() * 3, 0, Math.PI * 2), a.fill();
		t.grass = wt(i, e);
	}
	{
		let r = n(14), [i, a] = Ct();
		a.fillStyle = "#c9b48a", a.fillRect(0, 0, q, q), Tt(a, q, q, 12e3, r, .15), t.sand = wt(i, e);
	}
	{
		let r = n(15), [i, a] = Ct();
		a.fillStyle = "#6d6259", a.fillRect(0, 0, q, q);
		for (let e = 0; e < 14e3; e++) {
			let e = 70 + r() * 90;
			a.fillStyle = `rgb(${e},${e * .95},${e * .9})`, a.fillRect(r() * q, r() * q, 2, 2);
		}
		t.gravel = wt(i, e);
	}
	{
		let r = n(16), [i, a] = Ct();
		a.fillStyle = "#a4553a", a.fillRect(0, 0, q, q), Tt(a, q, q, 9e3, r, .14), t.plaza = wt(i, e);
	}
	{
		let r = n(17), [i, a] = Ct();
		a.fillStyle = "#6b8a3c", a.fillRect(0, 0, q, q), Tt(a, q, q, 6e3, r, .1), t.pitch = wt(i, e);
	}
	return Object.assign(t, Ce(e, wt)), t.atlas = Te(e), t.facades = Ee([
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
			...De((t, n, r) => Se(t, n, r, e), 50 + e)
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
			...De(xe[e], 60 + t),
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
			...De(xe[e], 80 + t),
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
//#region src/world/roadGraph.js
var kt = class {
	constructor(e) {
		this.nodes = [], this.edges = [], this.byKey = /* @__PURE__ */ new Map(), this.segIndex = new c(40);
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
		let r = this.segIndex.query(e - n, t - n, e + n, t + n), i = null, a = n * n;
		for (let n of r) {
			let [r, s, c, l] = o(e, t, n.a.x, n.a.z, n.b.x, n.b.z);
			l < a && (a = l, i = {
				seg: n,
				x: r,
				z: s,
				t: c,
				dist: Math.sqrt(l)
			});
		}
		return i;
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
}, At = /* @__PURE__ */ new Set([
	"primary",
	"secondary",
	"residential",
	"pedestrian"
]), jt = {
	av: "avenida",
	avda: "avenida",
	avd: "avenida",
	c: "calle",
	cl: "calle",
	pje: "pasaje",
	psje: "pasaje",
	pasj: "pasaje",
	gral: "general",
	gdor: "gobernador",
	pres: "presidente",
	pte: "presidente",
	dr: "doctor",
	dra: "doctora",
	ing: "ingeniero",
	almte: "almirante",
	alte: "almirante",
	cnel: "coronel",
	tte: "teniente",
	cap: "capitan",
	cmte: "comandante",
	sgto: "sargento",
	sta: "santa",
	sto: "santo",
	prof: "profesor",
	mons: "monsenor",
	gob: "gobernador",
	diag: "diagonal"
}, Mt = /* @__PURE__ */ new Set([
	"avenida",
	"calle",
	"pasaje",
	"peatonal"
]), Nt = /* @__PURE__ */ new Set([
	"de",
	"del",
	"la",
	"las",
	"los",
	"el",
	"y",
	"e",
	"general",
	"presidente",
	"doctor",
	"doctora",
	"ingeniero",
	"almirante",
	"coronel",
	"teniente",
	"capitan",
	"comandante",
	"sargento",
	"gobernador",
	"profesor",
	"monsenor",
	"bis"
]);
function Pt(e) {
	return e.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).map((e) => jt[e] || e);
}
function Ft(e) {
	let t = Pt(e || "");
	for (; t.length > 1 && Mt.has(t[0]);) t.shift();
	return t.join(" ");
}
function It(e) {
	return new Set(Pt(e).filter((e) => !Mt.has(e) && !Nt.has(e) && (e.length > 2 || /\d/.test(e))));
}
function Lt(e, t) {
	if (Ft(e) === Ft(t)) return !0;
	let n = It(e), r = It(t);
	if (!n.size || !r.size) return !1;
	let [i, a] = n.size <= r.size ? [n, r] : [r, n];
	for (let e of i) if (!a.has(e)) return !1;
	return !0;
}
function Rt(e) {
	return e.replace(/^avenida\s+/i, "Av. ").replace(/^calle\s+(?=\D)/i, "").trim();
}
var zt = (e) => {
	let t = e.slice().sort((e, t) => e - t);
	return t[Math.floor(t.length / 2)];
};
function Bt(e, t = [], n = {}) {
	let r = n.blocked || (() => !1), i = e.filter((e) => e.name && At.has(e.kind) && Ft(e.name)), a = new kt(i), s = new Map(i.map((e) => [e, Ft(e.name)])), l = /* @__PURE__ */ new Map();
	for (let e of i) {
		let t = s.get(e);
		l.has(t) || l.set(t, /* @__PURE__ */ new Map());
		let n = l.get(t);
		n.set(e.name, (n.get(e.name) || 0) + 1);
	}
	let u = new Map([...l].map(([e, t]) => [e, Rt([...t].sort((e, t) => t[1] - e[1])[0][0])])), d = (e) => {
		let t = /* @__PURE__ */ new Set();
		for (let n of e.links.values()) t.add(s.get(n));
		return t;
	}, f = (e, t) => e.id < t.id ? `${e.id}:${t.id}` : `${t.id}:${e.id}`, p = /* @__PURE__ */ new Map(), m = [], h = [], g = /* @__PURE__ */ new Set(), _ = (e, t) => [...e.links].filter(([, e]) => s.get(e) === t).map(([e]) => e);
	for (let e of a.nodes) for (let t of d(e)) {
		if (g.has(`${t}|${e.id}`)) continue;
		let n = [], r = [e];
		for (g.add(`${t}|${e.id}`); r.length;) {
			let e = r.pop();
			n.push(e);
			for (let n of _(e, t)) g.has(`${t}|${n.id}`) || (g.add(`${t}|${n.id}`), r.push(n));
		}
		let i = {
			key: t,
			nodes: n,
			blocks: []
		}, a = v(n[0], t), o = n[0];
		for (let [e, t] of a) t > a.get(o) && (o = e);
		i.s = v(o, t);
		let s = (e) => d(e).size > 1 || _(e, t).length !== 2;
		for (let e of n) if (s(e)) for (let n of _(e, t)) {
			if (p.has(f(e, n))) continue;
			let r = {
				comp: i,
				segs: [],
				a: e,
				b: null
			}, a = e, o = n;
			for (; r.segs.push([a, o]), p.set(f(a, o), r), !s(o);) {
				let e = _(o, t).find((e) => e !== a);
				if (!e || p.has(f(o, e))) break;
				a = o, o = e;
			}
			r.b = o;
			let c = i.s.get(r.a) ?? 0, l = i.s.get(r.b) ?? 0;
			r.s0 = Math.min(c, l), r.s1 = Math.max(c, l), r.mid = (c + l) / 2, r.nums = [], i.blocks.push(r), m.push(r);
		}
		h.push(i);
	}
	function v(e, t) {
		let n = /* @__PURE__ */ new Map([[e, 0]]), r = [e];
		for (; r.length;) {
			let e = 0;
			for (let t = 1; t < r.length; t++) n.get(r[t]) < n.get(r[e]) && (e = t);
			let i = r.splice(e, 1)[0];
			for (let e of _(i, t)) {
				let t = n.get(i) + Math.hypot(e.x - i.x, e.z - i.z);
				t < (n.get(e) ?? Infinity) && (n.has(e) || r.push(e), n.set(e, t));
			}
		}
		return n;
	}
	let y = new c(50);
	for (let e of m) for (let [t, n] of e.segs) y.insert({
		p: t,
		q: n,
		block: e
	}, {
		minX: Math.min(t.x, n.x),
		minZ: Math.min(t.z, n.z),
		maxX: Math.max(t.x, n.x),
		maxZ: Math.max(t.z, n.z)
	});
	let b = 0, x = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = null, n = 2025;
		for (let r of y.query(e.x - 45, e.z - 45, e.x + 45, e.z + 45)) {
			let i = `${e.street}|${r.block.comp.key}`;
			if (x.has(i) || x.set(i, Lt(e.street, u.get(r.block.comp.key))), !x.get(i)) continue;
			let a = o(e.x, e.z, r.p.x, r.p.z, r.q.x, r.q.z);
			a[3] < n && (n = a[3], t = {
				sg: r,
				t: a[2]
			});
		}
		if (!t) continue;
		let { p: r, q: i, block: a } = t.sg, s = a.comp.s, c = s.get(r), l = s.get(i), d = c + (l - c) * t.t, f = (i.x - r.x) * Math.sign(l - c || 1), p = (i.z - r.z) * Math.sign(l - c || 1), m = Math.sign(f * (e.z - r.z) - p * (e.x - r.x)) || 1;
		a.nums.push({
			n: e.number,
			s: d,
			side: m
		}), b++;
	}
	let S = 0, C = 0, w = [], T = 0, E = /* @__PURE__ */ new Map();
	for (let e of h) {
		let t = e.blocks.flatMap((e) => e.nums);
		if (!t.length) continue;
		let n = 0;
		if (t.length >= 2) {
			let e = [];
			for (let n = 0; n < t.length; n++) for (let r = n + 1; r < t.length && e.length < 4e3; r++) {
				let i = t[r].s - t[n].s;
				Math.abs(i) > 20 && e.push((t[r].n - t[n].n) / i);
			}
			e.length && (n = zt(e));
		}
		let r = zt(t.map((e) => e.n - n * e.s)), i = (e) => t.length < 4 || Math.abs(e.n - (r + n * e.s)) < 450, a = [];
		for (let t of e.blocks) {
			let e = t.nums.filter(i);
			e.length && (t.hundred = Math.floor(zt(e.map((e) => e.n)) / 100) * 100, t.weight = e.length, a.push(t));
		}
		a.sort((e, t) => e.mid - t.mid);
		let o = 0;
		if (a.length >= 2 ? o = Math.sign(a[a.length - 1].hundred - a[0].hundred) || Math.sign(n) : Math.abs(n) > .2 && t.length >= 3 && (o = Math.sign(n)), o && a.length >= 3) {
			let e = a.map((e) => e.weight), t = a.map(() => -1);
			for (let n = 0; n < a.length; n++) for (let r = 0; r < n; r++) (a[n].hundred - a[r].hundred) * o >= 0 && e[r] + a[n].weight > e[n] && (e[n] = e[r] + a[n].weight, t[n] = r);
			let n = e.indexOf(Math.max(...e)), r = /* @__PURE__ */ new Set();
			for (; n >= 0; n = t[n]) r.add(a[n]);
			for (let e of a) r.has(e) || delete e.hundred;
			a = a.filter((e) => r.has(e));
		}
		C += a.length, o && E.set(e, o);
		let s = 0;
		for (let e of t.filter(i)) s += e.side * (e.n % 2 == 0 ? 1 : -1);
		o && s && (T += Math.sign(s) * o), w.push([e, s]);
	}
	T = Math.sign(T);
	for (let [e, t] of w) !E.has(e) && T && Math.abs(t) >= 2 && E.set(e, Math.sign(t) * T);
	for (let e of h) {
		let t = e.blocks.filter((e) => e.hundred !== void 0).sort((e, t) => e.mid - t.mid);
		if (!t.length) continue;
		let n = E.get(e) || 0, r = e.blocks.slice().sort((e, t) => e.mid - t.mid), i = new Map(r.map((e, t) => [e, t]));
		for (let e of r) {
			if (e.hundred !== void 0) continue;
			let r = t.findIndex((t) => t.mid > e.mid), a = t[r > 0 ? r - 1 : t.length - 1], o = t[r], s = r > 0 ? Math.abs(o.hundred - a.hundred) / Math.max(1, o.mid - a.mid) : 0, c;
			if (r > 0 && s < 2.5 && (s > .4 || i.get(o) - i.get(a) < 3)) {
				let t = (e.mid - a.mid) / (o.mid - a.mid || 1);
				c = Math.round((a.hundred + (o.hundred - a.hundred) * t) / 100) * 100;
			} else if (n || r > 0) {
				let t = r === 0 ? o : r < 0 || i.get(e) - i.get(a) <= i.get(o) - i.get(e) ? a : o, s = r > 0 && Math.sign(o.hundred - a.hundred) || n;
				c = t.hundred + s * 100 * (i.get(e) - i.get(t));
			} else continue;
			c >= 0 && (e.hundred = c, e.estimated = !0, S++);
		}
		e.dir = n || (t.length >= 2 ? Math.sign(t[t.length - 1].hundred - t[0].hundred) : 0);
	}
	let D = [], O = new c(40);
	for (let t of e) for (let e = 0; e < t.pts.length - 1; e++) {
		let n = t.pts[e], r = t.pts[e + 1];
		O.insert({
			a: n,
			b: r,
			w: t.w
		}, {
			minX: Math.min(n[0], r[0]),
			minZ: Math.min(n[1], r[1]),
			maxX: Math.max(n[0], r[0]),
			maxZ: Math.max(n[1], r[1])
		});
	}
	let k = (e, t) => {
		for (let n of O.query(e - 15, t - 15, e + 15, t + 15)) if (o(e, t, n.a[0], n.a[1], n.b[0], n.b[1])[3] < (n.w / 2 + .5) ** 2) return !0;
		return !1;
	}, A = [], j = new c(30);
	for (let e of a.nodes) {
		let t = d(e);
		if (t.size < 2) continue;
		let n = [...e.links].map(([t, n]) => {
			let r = t.x - e.x, i = t.z - e.z, a = Math.hypot(r, i) || 1;
			return {
				m: t,
				r: n,
				key: s.get(n),
				dx: r / a,
				dz: i / a,
				ang: Math.atan2(i, r)
			};
		}).sort((e, t) => e.ang - t.ang);
		if ([...j.query(e.x - 30, e.z - 30, e.x + 30, e.z + 30)].some((n) => Math.hypot(n.x - e.x, n.z - e.z) < 30 && [...t].every((e) => n.keys.has(e)))) continue;
		let i = [];
		for (let t = 0; t < n.length; t++) {
			let r = n[t], a = n[(t + 1) % n.length], o = a.ang - r.ang;
			if (o <= 0 && (o += Math.PI * 2), n.length === 1 || o < .6) continue;
			let s = r.ang + o / 2, c = Math.max(r.r.w, a.r.w) / 2 + 1.3, l = Math.min(c * 2.2, c / Math.sin(Math.min(o, Math.PI) / 2)), u = e.x + Math.cos(s) * l, d = e.z + Math.sin(s) * l, f = +(r.key === a.key) + Math.abs(o - Math.PI / 2) * .3;
			i.push({
				x: u,
				z: d,
				a: r,
				b: a,
				score: f
			});
		}
		i.sort((e, t) => e.score - t.score);
		let a = i.find((e) => !k(e.x, e.z) && !r(e.x, e.z));
		if (!a) continue;
		let o = Math.atan2(a.z - e.z, a.x - e.x), c = [];
		for (let r of t) {
			let t = [a.a, a.b].find((e) => e.key === r);
			if (!t) {
				let e = Infinity;
				for (let i of n) {
					if (i.key !== r) continue;
					let n = Math.abs(i.ang - o) % (Math.PI * 2);
					n > Math.PI && (n = Math.PI * 2 - n), n < e && (e = n, t = i);
				}
			}
			let i = p.get(f(e, t.m)), s = {
				name: u.get(r),
				dir: [Ht(t.dx), Ht(t.dz)]
			};
			if (i?.hundred !== void 0) {
				let n = i.comp.s.get(e), r = i.comp.s.get(t.m), a = (i.comp.dir || 1) * Math.sign(r - n || 1) > 0;
				s.from = a ? i.hundred : i.hundred + 100, s.to = a ? i.hundred + 100 : i.hundred, (i.estimated || !i.comp.dir) && (s.est = 1);
			}
			c.push(s);
		}
		let l = {
			x: Vt(a.x),
			z: Vt(a.z),
			signs: c
		};
		D.push(l);
		let m = {
			x: e.x,
			z: e.z,
			keys: t
		};
		j.insert(m, {
			minX: e.x,
			minZ: e.z,
			maxX: e.x,
			maxZ: e.z
		}), A.push(m);
	}
	let M = D.reduce((e, t) => e + t.signs.length, 0), N = D.reduce((e, t) => e + t.signs.filter((e) => e.from !== void 0).length, 0);
	return {
		posts: D,
		stats: {
			addresses: t.length,
			matched: b,
			blocks: m.length,
			known: C,
			estimated: S,
			posts: D.length,
			plates: M,
			withNum: N
		}
	};
}
var Vt = (e) => Math.round(e * 10) / 10, Ht = (e) => Math.round(e * 1e3) / 1e3, Ut = 160, Wt = 300, Gt = 420, Kt = 1.1, qt = .3, Jt = .03, Yt = 2.45, Xt = .04, Zt = 512, Qt = 140, $t = 2, en = 16, tn = "#1f3a2a", nn = "#133b82";
function rn(t, { root: n, collision: r }) {
	let i = t.streetSigns;
	i ||= Bt(t.roads, t.addresses || [], { blocked: (e, t) => r.isBlocked(e, t, .5) }).posts;
	let a = /* @__PURE__ */ new Map();
	for (let e of i) {
		if (!e.signs?.length || r.isBlocked(e.x, e.z, .25)) continue;
		r.addCircle(e.x, e.z, .1, "pole");
		let t = `${Math.floor(e.x / Ut)},${Math.floor(e.z / Ut)}`;
		a.has(t) || a.set(t, {
			key: t,
			cx: (Math.floor(e.x / Ut) + .5) * Ut,
			cz: (Math.floor(e.z / Ut) + .5) * Ut,
			posts: [],
			mesh: null
		}), a.get(t).posts.push(e);
	}
	let o = new e.Group();
	o.name = "streetSigns", n.add(o);
	let s = 0, c = /* @__PURE__ */ new Set();
	function l(t) {
		let n = t.posts.reduce((e, t) => e + t.signs.length, 0), r = Math.ceil(n / $t), i = Math.min(1, 4e3 / (r * Qt + en)), a = Math.round(Zt * i), l = Math.round(Qt * i), u = document.createElement("canvas");
		u.width = a * $t, u.height = en + r * l;
		let d = u.getContext("2d");
		d.fillStyle = tn, d.fillRect(0, 0, u.width, en);
		let f = u.width, p = u.height, m = [.5, 1 - en / 2 / p], h = [], g = [], _ = [], v = (e, t, n, r, i, a, o, s, c) => {
			for (let [l, u] of [
				[e, a],
				[t, o],
				[n, s],
				[e, a],
				[n, s],
				[r, c]
			]) h.push(l[0], l[1], l[2]), g.push(i[0], i[1], i[2]), _.push(u[0], u[1]);
		}, y = (e, t, n, r, i, a, o, s, c) => {
			let l = (c, l, u) => [
				e + r[0] * a * c + i[0] * s * u,
				t + o * l,
				n + r[1] * a * c + i[1] * s * u
			], u = [
				[[
					1,
					0,
					0
				], (e, t) => l(1, t, -e)],
				[[
					-1,
					0,
					0
				], (e, t) => l(-1, t, e)],
				[[
					0,
					0,
					1
				], (e, t) => l(e, t, 1)],
				[[
					0,
					0,
					-1
				], (e, t) => l(-e, t, -1)],
				[[
					0,
					1,
					0
				], (e, t) => l(e, 1, -t)],
				[[
					0,
					-1,
					0
				], (e, t) => l(e, -1, t)]
			];
			for (let [[e, t, n], a] of u) {
				let o = [
					r[0] * e + i[0] * n,
					t,
					r[1] * e + i[1] * n
				], s = c?.(e, t, n);
				v(a(-1, -1), a(1, -1), a(1, 1), a(-1, 1), o, ...s || [
					m,
					m,
					m,
					m
				]);
			}
		}, b = 0;
		for (let e of t.posts) {
			let t = e.signs.length, n = Yt - (t - 1) * .33999999999999997 - qt / 2;
			y(e.x, n / 2, e.z, [1, 0], [0, 1], Xt, n / 2, Xt);
			for (let n = 0; n < t - 1; n++) y(e.x, Yt - n * .33999999999999997 - .33999999999999997 / 2, e.z, [1, 0], [0, 1], .025, .025, .025);
			e.signs.forEach((t, n) => {
				let r = b % $t, i = Math.floor(b / $t);
				b++;
				let o = r * a, s = en + i * l;
				an(d, o, s, a, l, t);
				let c = (o + 2) / f, u = (o + a - 2) / f, m = 1 - (s + 2) / p, h = 1 - (s + l - 2) / p, [g, _] = t.dir, v = Math.hypot(g, _) || 1;
				g /= v, _ /= v;
				let x = [g, _], S = [-_, g], C = Yt - n * .33999999999999997, w = [
					[c, h],
					[u, h],
					[u, m],
					[c, m]
				];
				y(e.x, C, e.z, x, S, Kt / 2, qt / 2, Jt / 2, (e, t, n) => n ? w : null);
			});
		}
		let x = new e.BufferGeometry();
		x.setAttribute("position", new e.Float32BufferAttribute(h, 3)), x.setAttribute("normal", new e.Float32BufferAttribute(g, 3)), x.setAttribute("uv", new e.Float32BufferAttribute(_, 2)), x.computeBoundingSphere();
		let S = new e.CanvasTexture(u);
		S.colorSpace = e.SRGBColorSpace, S.onUpdate = () => {
			u.width = u.height = 1;
		}, S.anisotropy = 4;
		let C = new e.MeshStandardMaterial({
			map: S,
			emissiveMap: S,
			emissive: 16777215,
			emissiveIntensity: s * .35,
			roughness: .55,
			metalness: .2
		}), w = new e.Mesh(x, C);
		w.castShadow = !0, t.mesh = w, o.add(w), c.add(t);
	}
	function u(e) {
		o.remove(e.mesh), e.mesh.geometry.dispose(), e.mesh.material.map.dispose(), e.mesh.material.dispose(), e.mesh = null, c.delete(e);
	}
	return {
		posts: [...a.values()].flatMap((e) => e.posts),
		update(e, t, n = !1) {
			for (let n of c) Math.hypot(n.cx - e, n.cz - t) > Gt && u(n);
			let r = Math.floor(e / Ut), i = Math.floor(t / Ut), o = Math.ceil(Wt / Ut), s = null, d = Wt;
			for (let n = r - o; n <= r + o; n++) for (let r = i - o; r <= i + o; r++) {
				let i = a.get(`${n},${r}`);
				if (!i || i.mesh) continue;
				let o = Math.hypot(i.cx - e, i.cz - t);
				o < d && (d = o, s = i);
			}
			s && !n && l(s);
		},
		setNight(e) {
			s = e;
			for (let t of c) t.mesh.material.emissiveIntensity = e * .35;
		}
	};
}
function an(e, t, n, r, i, a) {
	let o = i / Qt;
	e.save(), e.translate(t, n), e.fillStyle = nn, e.fillRect(0, 0, r, i), e.strokeStyle = "#ffffff", e.lineWidth = 4 * o, e.strokeRect(8 * o, 8 * o, r - 16 * o, i - 16 * o), e.fillStyle = "#ffffff", e.textAlign = "center", e.textBaseline = "middle";
	let s = a.name.toUpperCase(), c = a.from !== void 0;
	e.font = `bold ${Math.round((c ? 56 : 62) * o)}px "Arial Narrow", Arial, Helvetica, sans-serif`, e.fillText(s, r / 2, (c ? 52 : 72) * o, r - 44 * o), c && (e.fillRect(40 * o, 86 * o, r - 80 * o, 2 * o), e.font = `bold ${Math.round(40 * o)}px Arial, Helvetica, sans-serif`, e.fillText(`${Math.min(a.from, a.to)} - ${Math.max(a.from, a.to)}`, r / 2, 113 * o, r - 60 * o)), e.restore();
}
((t, n, r, i = n / 2) => V(new e.BoxGeometry(t, n, r).translate(0, i, 0)))(1, 1, 1), V(new e.DodecahedronGeometry(1, 0).scale(1, .45, 1)), V(new e.OctahedronGeometry(.3, 0).scale(1, .75, 1)), V(new e.CylinderGeometry(.34, .34, .22, 6)), V(new e.CylinderGeometry(.1, .15, 8.6, 5, 1, !0).translate(0, 4.3, 0)), V(new e.CylinderGeometry(.32, .32, .9, 6)), new e.Matrix4(), new e.Quaternion(), new e.Euler(), new e.Vector3(), new e.Vector3();
var on = (t) => new e.Color(t);
on("#5d5246"), on("#a39e94"), on("#3d5a28"), on("#2a2a2a"), on("#7d8286"), on("#4b4236"), on("#8f8577"), on("#b0603c"), on("#dcdcd4"), on("#1c1c1c"), [
	"#1c1c1c",
	"#2b2b2b",
	"#dcdcdc",
	"#3a5fa0",
	"#3f7a3a",
	"#c8b24a",
	"#8a2a2a",
	"#e0e0e0"
].map(on), [
	"#7a5a3c",
	"#8c8f94",
	"#4d5f7a",
	"#9a3a2a",
	"#c8c2b0",
	"#3d4a3a",
	"#b0a070"
].map(on), [
	"#efe6d6",
	"#e9dcc4",
	"#f1efe8",
	"#e2d4bd",
	"#d9dfd9",
	"#efd9c6",
	"#dfe6ea",
	"#e8e0a8"
].map(on), [
	"#4a5a4a",
	"#2e2e2e",
	"#6b4a32",
	"#7a7f84",
	"#3c4f66",
	"#8a3b2a",
	"#e0e0e0",
	"#2f4f3f"
].map(on), new e.Color(.92, .92, .88), new e.Color(.93, .72, .08), new e.Color(.74, .73, .7), new e.Color(.9, .7, .1), new e.Color(.1, .1, .1), new e.Color(.8, .79, .76);
var sn = class {
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
}, cn = (e) => e.kind === "pedestrian" && /^rivadavia$/i.test(e.name);
function ln(e) {
	for (let t of e.roads) cn(t) && (t.noCars = !0);
}
var un = new e.Matrix4(), dn = new e.Quaternion(), fn = new e.Vector3(0, 1, 0);
function J(t, n, r, i = 0, a = 1, o = a, s = a) {
	return un.compose(new e.Vector3(t, n, r), dn.setFromAxisAngle(fn, i), new e.Vector3(a, o, s)).clone();
}
var Y = (t, n, r) => new e.BoxGeometry(t, n, r).translate(0, n / 2, 0), X = (t, n, r, i = 10) => new e.CylinderGeometry(t, n, r, i).translate(0, r / 2, 0);
function pn() {
	let t = y(256, 256, (e, t, r) => {
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
function mn(e, t = !1) {
	return y(256, 128, (r, i, a) => {
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
function hn(t) {
	let r = y(128, 128, (e, r, i) => {
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
function gn(t, { root: r, graph: i, collision: a, ribbon: o, flatMat: s, keepOut: c, GeoBuf: l }) {
	let u = (t, n = {}) => new e.MeshStandardMaterial({
		color: t,
		roughness: .8,
		...n
	}), f = {
		green: u(3100474, {
			roughness: .5,
			metalness: .4
		}),
		brick: u(10770236, { roughness: .95 }),
		concrete: u(12433581, { roughness: .95 }),
		soil: u(3877406, { roughness: 1 }),
		trunk: u(5916210, { roughness: 1 }),
		leaf: u(5602619, { flatShading: !0 }),
		leaf2: u(7049022, { flatShading: !0 }),
		frond: u(5012018, {
			side: e.DoubleSide,
			flatShading: !0
		}),
		palm: u(9075298, { roughness: 1 }),
		wood: u(8016948),
		iron: u(2304042, {
			roughness: .5,
			metalness: .6
		}),
		yellow: u(14725920),
		white: u(15921906, { roughness: .4 }),
		lamp: u(16774358, {
			emissive: 16765578,
			emissiveIntensity: 0
		}),
		tarpBlue: u(2781109, { side: e.DoubleSide }),
		tarpRed: u(12597547, { side: e.DoubleSide }),
		tarpGreen: u(3050327, { side: e.DoubleSide }),
		red: u(12597547, {
			roughness: .5,
			metalness: .3
		}),
		blue: u(2781109, {
			roughness: .5,
			metalness: .3
		}),
		sand: u(14272666, { roughness: 1 }),
		tableTop: u(15262420, { roughness: .5 }),
		chair: u(9067058),
		bulb: u(16773572, {
			emissive: 16762992,
			emissiveIntensity: 0
		}),
		dumpster: u(3042106, { roughness: .7 }),
		dumpsterLid: u(2314284, { roughness: .7 }),
		grill: u(1381653, {
			roughness: .6,
			metalness: .5
		}),
		ember: u(16734751, {
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
			map: x(),
			side: e.DoubleSide,
			roughness: .9
		}),
		diarios: u(16777215, { map: b("DIARIOS · REVISTAS", "#f2efe4", "#1f3a2a", 1024, 160) }),
		rack: u(16777215, { map: mn(5) }),
		floreria: u(16777215, { map: b("FLORERÍA", "#f6e7ef", "#8a1c4a", 1024, 160) }),
		flowers: u(16777215, { map: mn(9, !0) }),
		taxi: u(16777215, { map: b("PARADA DE TAXIS", "#111111", "#f2c200", 1024, 200, "bold 92px Arial, sans-serif") }),
		choripan: u(16777215, { map: b("CHORIPÁN · BONDIOLA", "#c0392b", "#fff4d6", 1024, 160) })
	}, p = new d(), m = new d(), h = s(pn()), g = n(2024), _ = (e, t, n) => a.addCircle(e, t, n, "prop"), v = (e, t, n, r, i) => {
		let o = Math.cos(n), s = Math.sin(n);
		a.addPolygon([
			[-r, -i],
			[r, -i],
			[r, i],
			[-r, i]
		].map(([n, r]) => [e + o * n + s * r, t - s * n + o * r]), 3, "prop");
	};
	function y(t, n, r = 3.2, i = f.leaf) {
		p.add(X(.12, .18, r, 7), f.trunk, J(t, 0, n));
		let a = new e.IcosahedronGeometry(1.7, 0);
		p.add(a, i, J(t, r + .6, n, g() * 6, 1, .8 + g() * .3, 1)), p.add(new e.IcosahedronGeometry(1.1, 0), i, J(t + .6, r + 1.4, n - .3, g() * 6));
	}
	function S(e, t, n) {
		p.add(Y(1.9, .55, 1.9), f.brick, J(e, 0, t, n)), p.add(Y(1.6, .02, 1.6), f.soil, J(e, .55, t, n)), y(e, t, 3 + g()), v(e, t, n, .95, .95);
	}
	function C(e, t, n) {
		p.add(Y(1.8, .08, .5), f.wood, J(e, .42, t, n)), p.add(Y(1.8, .45, .06), f.wood, J(e - Math.sin(n) * .24, .5, t - Math.cos(n) * .24, n));
		for (let r of [-.75, .75]) p.add(Y(.08, .42, .45), f.iron, J(e + Math.cos(n) * r, 0, t - Math.sin(n) * r, n));
	}
	let w = [];
	function T(t, n, r) {
		p.add(X(.07, .11, 4.6, 8), f.green, J(t, 0, n)), p.add(Y(1.5, .08, .08), f.green, J(t, 4.5, n, r));
		for (let i of [-.7, .7]) {
			let a = t + Math.cos(r) * i, o = n - Math.sin(r) * i;
			p.add(X(.03, .03, .25, 6), f.green, J(a, 4.55, o)), p.add(new e.SphereGeometry(.24, 12, 8), f.lamp, J(a, 5, o));
		}
		w.push([t, n]), _(t, n, .15);
	}
	function E(e, t) {
		p.add(X(.24, .22, .85, 10), f.green, J(e, 0, t)), p.add(X(.27, .27, .06, 10), f.iron, J(e, .85, t)), _(e, t, .3);
	}
	function D(e, t) {
		p.add(X(.1, .12, .85, 8), f.iron, J(e, 0, t)), p.add(X(.11, .11, .08, 8), f.yellow, J(e, .7, t)), _(e, t, .13);
	}
	function O(t, n, r, i = !1) {
		p.add(Y(2.6, 2.3, 1.6), f.green, J(t, 0, n, r)), p.add(Y(3.4, .12, 2.4), f.green, J(t, 2.3, n, r));
		let a = i ? f.floreria : f.diarios, o = i ? f.flowers : f.rack;
		for (let i of [-1, 1]) {
			let s = Math.sin(r) * i, c = Math.cos(r) * i, l = r + (i < 0 ? Math.PI : 0);
			p.add(new e.PlaneGeometry(3.2, .42), a, J(t + s * 1.21, 2.62, n + c * 1.21, l)), p.add(new e.PlaneGeometry(3.2, .42), a, J(t + s * 1.19, 2.62, n + c * 1.19, l + Math.PI)), p.add(new e.PlaneGeometry(2.4, 1.2), o, J(t + s * .81, 1, n + c * .81, l));
		}
		p.add(Y(3.2, .42, .04), f.white, J(t, 2.42, n, r)), v(t, n, r, 1.4, .9);
	}
	function k(t, n, r, i) {
		for (let [e, i] of [
			[-1, -.8],
			[1, -.8],
			[-1, .8],
			[1, .8]
		]) {
			let a = t + Math.cos(r) * e + Math.sin(r) * i, o = n - Math.sin(r) * e + Math.cos(r) * i;
			p.add(X(.025, .025, 2.2, 5), f.iron, J(a, 0, o));
		}
		let a = new e.PlaneGeometry(2.4, 2).rotateX(-Math.PI / 2 + .12);
		p.add(a, i, J(t, 2.25, n, r)), p.add(Y(1.9, .05, .9), f.wood, J(t, .75, n, r)), p.add(new e.PlaneGeometry(1.8, .8).rotateX(-Math.PI / 2), f.rack, J(t, .81, n, r)), v(t, n, r, 1, .5);
	}
	function A(t, n, r) {
		p.add(Y(1.8, .95, .9), f.white, J(t, .25, n, r)), p.add(Y(1.7, .08, .8), f.grill, J(t, 1.2, n, r)), p.add(Y(1.4, .03, .6), f.ember, J(t, 1.22, n, r));
		for (let i of [-.7, .7]) p.add(new e.CylinderGeometry(.25, .25, .08, 12).rotateX(Math.PI / 2).translate(0, .25, 0), f.iron, J(t + Math.cos(r) * i, 0, n - Math.sin(r) * i, r));
		p.add(new e.PlaneGeometry(1.8, .4), f.choripan, J(t + Math.sin(r) * .46, .7, n + Math.cos(r) * .46, r)), p.add(new e.PlaneGeometry(1.8, .4), f.choripan, J(t - Math.sin(r) * .46, .7, n - Math.cos(r) * .46, r + Math.PI)), p.add(X(.03, .03, 2.4, 5), f.iron, J(t, 0, n)), p.add(new e.ConeGeometry(1.4, .5, 10, 1, !0).translate(0, 2.5, 0), f.tarpRed, J(t, 0, n));
		for (let r = 0; r < 4; r++) p.add(new e.SphereGeometry(.25 + r * .12, 8, 6), f.smoke, J(t + r * .15, 1.5 + r * .35, n + r * .05));
		v(t, n, r, .95, .5);
	}
	function j(t, n, r) {
		for (let e = 0; e < 4; e++) p.add(X(.2 - e * .02, .22 - e * .02, r / 4 + .05, 8), f.palm, J(t + e * .05, e * r / 4, n));
		for (let i = 0; i < 9; i++) {
			let a = new e.PlaneGeometry(.7, 3.4, 1, 3), o = a.attributes.position;
			for (let e = 0; e < o.count; e++) o.setZ(e, -((o.getY(e) + 1.7) ** 2) * .12);
			a.translate(0, 1.7, 0).rotateX(-1), p.add(a, f.frond, J(t + .15, r, n, i / 9 * Math.PI * 2 + g() * .3));
		}
		_(t, n, .3);
	}
	function M(t, n, r, i, a, o, s) {
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
	let N = new l(), P = new l(), F = ([e, t]) => i.byKey.get(`${Math.round(e * 2)},${Math.round(t * 2)}`), ee = 0;
	for (let e of t.roads.filter(cn)) {
		let t = new sn(e.pts), n = [];
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
			let a = F(e.pts[n]);
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
			}), M(P, a.x, a.z, s, c, o, Math.min(2 * r - 1, 6)));
		}
		let s = [], l = {
			s: 0,
			cw: 0
		};
		for (let e of [...i, {
			s: t.len,
			cw: 0
		}]) e.s - l.s > 1 && s.push([
			l.s + l.cw + (l.cw ? .3 : 0),
			e.s - e.cw - (e.cw ? .3 : 0),
			!!l.cw,
			!!e.cw
		]), l = e;
		for (let [e, n, i, a] of s) {
			let s = t.sub(e, n);
			if (!s) continue;
			o(N, s, r * 2, .14, 1 / 6);
			for (let [o, s] of [[e + .6, i], [n - .6, a]]) {
				if (!s) continue;
				let [e, n, i, a] = t.at(o);
				for (let t = -r + .8; t <= r - .7; t += 1.5) D(e - a * t, n + i * t);
			}
			let l = 0;
			for (let r = e + 6; r < n - 5; r += 8, l++) {
				let [i, a, o, s] = t.at(r), u = Math.atan2(-s, o), d = l % 4;
				d === 0 || d === 2 ? S(i, a, u) : d === 1 ? ee < 3 && n - e > 50 && l === 5 ? (O(i, a, u, ee === 2), ee++) : (C(i - s * .35, a + o * .35, u), C(i + s * .35, a - o * .35, u + Math.PI)) : (T(i, a, u + Math.PI / 2), E(i + o * 1.2 - s * .6, a + s * 1.2 + o * .6)), c.push([
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
		let l = Math.atan2(-t.uz, t.ux), u = s.v - r * 1.8, d = [
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
			a.isBlocked(i, o, 1.3) || (t === "chori" ? A(i, o, l) : k(i, o, l, r), c.push([
				i,
				o,
				2.5
			]));
		}
		let [g, v] = n(-8, s.v - r * .6);
		p.add(X(.04, .04, 2.6, 6), f.iron, J(g, 0, v)), p.add(new e.PlaneGeometry(1.3, .26), f.taxi, J(g, 2.45, v, l)), p.add(new e.PlaneGeometry(1.3, .26), f.taxi, J(g, 2.45, v, l + Math.PI)), _(g, v, .1);
		let y = Math.abs(s.v - o) - 5;
		if (y > 2) {
			let t = new e.PlaneGeometry(60, y).rotateX(-Math.PI / 2), i = t.attributes.uv;
			for (let e = 0; e < i.count; e++) i.setXY(e, i.getX(e) * 10, i.getY(e) * 3);
			let [a, c] = n(0, (o + r * 5 + s.v - r * 3.2) / 2);
			m.add(t, h, J(a, .14, c, l));
		}
		for (let e of [
			-24,
			-8,
			8,
			24
		]) {
			let [t, r] = n(e, (o + s.v) / 2);
			a.isBlocked(t, r, 1) || (T(t, r, l), C(t + Math.sin(l) * 1.5, r + Math.cos(l) * 1.5, l));
		}
	}
	let L = (t.specials || []).filter((e) => e.type === "station" && /quilmes|bernal/i.test(e.name || ""));
	for (let e of L) I(e);
	let R = [
		0,
		1,
		2
	].map((t) => new e.MeshStandardMaterial({
		map: hn(t),
		roughness: 1
	}));
	function z(t, n, r) {
		let i = Math.cos(r), a = Math.sin(r), o = (e, r) => [t + i * e + a * r, n - a * e + i * r], s = new e.PlaneGeometry(9, 7).rotateX(-Math.PI / 2);
		p.add(s, f.sand, J(t, .16, n, r));
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
			p.add(Y(n, .3, i), f.concrete, J(a, 0, s, r));
		}
		{
			let [t, n] = o(-2, -1.5);
			for (let o of [-1.7, 1.7]) for (let s of [-.25, .25]) {
				let c = new e.CylinderGeometry(.05, .05, 2.6, 6).translate(0, 1.3, 0).rotateX(s);
				p.add(c, f.red, J(t + i * o, 0, n - a * o, r));
			}
			p.add(new e.CylinderGeometry(.06, .06, 3.5, 6).rotateZ(Math.PI / 2).translate(0, 2.5, 0), f.red, J(t, 0, n, r));
			for (let o of [-.8, .8]) {
				for (let s of [-.22, .22]) p.add(new e.CylinderGeometry(.01, .01, 2, 4).translate(0, 1.5, 0), f.iron, J(t + i * (o + s), 0, n - a * (o + s), r));
				p.add(Y(.5, .05, .25), f.yellow, J(t + i * o, .45, n - a * o, r));
			}
			v(t, n, r, 1.8, .5);
		}
		{
			let [t, n] = o(2.5, -1.2);
			p.add(Y(.9, .06, .9), f.blue, J(t, 1.6, n, r));
			for (let [e, r] of [
				[-.4, -.4],
				[.4, -.4],
				[-.4, .4],
				[.4, .4]
			]) p.add(X(.04, .04, 1.6, 5), f.iron, J(t + i * e + a * r, 0, n - a * e + i * r));
			let s = new e.BoxGeometry(2.6, .06, .6).rotateZ(-.62);
			p.add(s, f.yellow, J(t + i * 1.5, .8, n - a * 1.5, r));
			for (let e = 0; e < 4; e++) p.add(Y(.6, .04, .06), f.iron, J(t - i * .55, .35 + e * .38, n + a * .55, r));
			v(t + i * .6, n - a * .6, r, 1.4, .5);
		}
		{
			let [t, n] = o(0, 2.2);
			p.add(Y(.2, .5, .3), f.iron, J(t, 0, n, r)), p.add(new e.BoxGeometry(3.2, .08, .3).rotateZ(.14).translate(0, .55, 0), f.blue, J(t, 0, n, r)), v(t, n, r, 1.6, .25);
		}
	}
	function B(t, n, r) {
		p.add(X(1.2, 1.4, .6, 16), f.concrete, J(t, 0, n)), p.add(X(.07, .12, 14, 8), f.white, J(t, .6, n)), p.add(new e.PlaneGeometry(3, 2).translate(1.5, 0, 0), f.flag, J(t, 13.4, n, r + .6)), _(t, n, 1.3), c.push([
			t,
			n,
			3
		]);
	}
	function te(t, { palms: n = !1, kids: r = !1 } = {}) {
		let i = t.box, o = (e, t) => [i.cx + i.ux * e - i.uz * t, i.cz + i.uz * e + i.ux * t], s = Math.atan2(-i.uz, i.ux), l = i.hu - 3, u = i.hv - 3, d = Math.atan2(u, l), m = [
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
			p.add(new e.CircleGeometry(r, 20).rotateX(-Math.PI / 2), R[t % 3], J(i, .22, a)), p.add(new e.CylinderGeometry(r + .1, r + .15, .22, 20, 1, !0).translate(0, .11, 0), f.concrete, J(i, 0, a)), c.push([
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
			]) e.push([t * l, 3.2], [t * l, -3.2]);
			for (let t of [-.55, .55]) e.push([3.2, t * u], [-3.2, t * u]);
			for (let [t, n] of e) {
				let [e, r] = o(t, n);
				j(e, r, 7 + g() * 3), c.push([
					e,
					r,
					2
				]);
			}
		}
		if (r) {
			let [e, t] = o(-.68 * l, .5 * (u * .68 + 1.5));
			z(e, t, s), c.push([
				e,
				t,
				6.5
			]);
		}
		let [_, v] = o(l - 8, 4.5);
		B(_, v, s);
		for (let e = -l + 6; e <= l - 6; e += 14) for (let t of [-u - 1.8, u + 1.8]) {
			let [n, r] = o(e, t);
			a.isBlocked(n, r, .4) || T(n, r, s);
		}
		for (let e = -u + 6; e <= u - 6; e += 14) for (let t of [-l - 1.8, l + 1.8]) {
			let [n, r] = o(t, e);
			a.isBlocked(n, r, .4) || T(n, r, s + Math.PI / 2);
		}
	}
	let V = (e) => (t.specials || []).find((t) => t.type === "plaza" && e.test(t.name || ""));
	V(/san mart/i) && te(V(/san mart/i), { palms: !0 }), V(/f[ée]lix bernal/i) && te(V(/f[ée]lix bernal/i), { kids: !0 });
	let ne = L.map((e) => [e.cx, e.cz]), re = /^(cafe|restaurant|pub|bar|ice_cream|fast_food)$/, H = new e.SphereGeometry(.06, 6, 4);
	for (let n of t.shops || []) {
		if (!re.test(n.kind) || !ne.some(([e, t]) => Math.hypot(n.x - e, n.z - t) < 650)) continue;
		let t = i.nearest(n.x, n.z, 35);
		if (!t || t.seg.road.kind === "footway" || t.seg.road.kind === "pedestrian" || t.seg.road.pasillo) continue;
		let { a: r, b: o, road: s } = t.seg, l = Math.hypot(o.x - r.x, o.z - r.z) || 1, u = (o.x - r.x) / l, d = (o.z - r.z) / l, m = Math.max(0, Math.min(l, (n.x - r.x) * u + (n.z - r.z) * d)), h = (n.x - r.x) * -d + (n.z - r.z) * u > 0 ? 1 : -1, g = s.w / 2 + 1.5, v = Math.atan2(-d, u), y = /pub|bar/.test(n.kind), b = [];
		for (let t of [
			-1,
			0,
			1
		]) {
			let n = m + t * 2.8;
			if (n < 4 || n > l - 4) continue;
			let i = r.x + u * n - d * g * h, o = r.z + d * n + u * g * h;
			if (!a.isBlocked(i, o, .9)) {
				p.add(X(.05, .05, .72, 6), f.iron, J(i, 0, o)), p.add(X(.42, .42, .04, 14), f.tableTop, J(i, .72, o));
				for (let e of [-.65, .65]) {
					let t = i + u * e, n = o + d * e;
					p.add(Y(.42, .04, .42), f.chair, J(t, .45, n, v)), p.add(Y(.04, .45, .42), f.chair, J(t + u * Math.sign(e) * .2, .45, n + d * Math.sign(e) * .2, v));
					for (let e of [-.18, .18]) p.add(X(.015, .015, .45, 4), f.iron, J(t + u * e, 0, n + d * e));
				}
				y || (p.add(X(.025, .025, 2.3, 5), f.white, J(i, 0, o)), p.add(new e.ConeGeometry(1.25, .45, 8, 1, !0).translate(0, 2.35, 0), [
					f.tarpRed,
					f.tarpGreen,
					f.tarpBlue
				][b.length % 3], J(i, 0, o))), _(i, o, .75), c.push([
					i,
					o,
					1.5
				]), b.push([i, o]);
			}
		}
		if (y && b.length >= 2) {
			let [e, t] = [b[0], b[b.length - 1]], n = [e[0] - u * 1.4, e[1] - d * 1.4], r = [t[0] + u * 1.4, t[1] + d * 1.4];
			for (let e of [n, r]) p.add(X(.03, .03, 2.9, 5), f.iron, J(e[0], 0, e[1]));
			for (let e = 0; e <= 12; e++) {
				let t = e / 12;
				p.add(H, f.bulb, J(n[0] + (r[0] - n[0]) * t, 2.85 - Math.sin(t * Math.PI) * .35, n[1] + (r[1] - n[1]) * t));
			}
		}
	}
	for (let t of i.nodes) {
		if (t.degree < 3 || !ne.some(([e, n]) => Math.hypot(t.x - e, t.z - n) < 500) || (t.id * 2654435761 >>> 0) % 5 > 1) continue;
		let n = [...t.links].filter(([, e]) => e.kind === "residential" || e.kind === "secondary" || e.kind === "tertiary");
		if (!n.length) continue;
		let r = 0;
		for (let e of t.roads) r = Math.max(r, e.w);
		let [i, o] = n[0], s = Math.hypot(i.x - t.x, i.z - t.z), l = r / 2 + 9;
		if (s < l + 6) continue;
		let u = (i.x - t.x) / s, d = (i.z - t.z) / s, m = o.w / 2 + 1.1, h = t.x + u * l - d * m, g = t.z + d * l + u * m;
		if (a.isBlocked(h, g, 1)) continue;
		let _ = Math.atan2(-d, u);
		p.add(Y(1.8, 1.15, 1.2), f.dumpster, J(h, .12, g, _)), p.add(new e.BoxGeometry(1.86, .08, 1.3).rotateX(-.1).translate(0, 1.32, 0), f.dumpsterLid, J(h, 0, g, _));
		for (let [e, t] of [
			[-.75, -.45],
			[.75, -.45],
			[-.75, .45],
			[.75, .45]
		]) p.add(X(.07, .07, .12, 6), f.iron, J(h + Math.cos(_) * e + Math.sin(_) * t, 0, g - Math.sin(_) * e + Math.cos(_) * t));
		v(h, g, _, .95, .65), c.push([
			h,
			g,
			1.8
		]);
	}
	if (N.pos.length) {
		let t = new e.Mesh(N.geometry(), h);
		t.receiveShadow = !0, t.renderOrder = -6.5, r.add(t);
	}
	if (P.pos.length) {
		let t = new e.Mesh(P.geometry(), s(null, 16777215, { vertexColors: !0 }));
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
[
	new e.Color(1, .12, .08),
	new e.Color(1, .62, .05),
	new e.Color(.15, 1, .45)
].map((e) => e.clone().multiplyScalar(.06));
//#endregion
//#region src/world/builder.js
var _n = 440, vn = 3, yn = [], bn = e.Object3D.prototype.add;
e.Object3D.prototype.add = function(...e) {
	bn.apply(this, e);
	for (let t = this; t; t = t.parent) if (t.userData?.frozen) {
		for (let t of e) t.parent === this && (t.updateMatrixWorld(!0), t.traverse(xn));
		break;
	}
	return this;
};
var xn = (e) => {
	e.matrixAutoUpdate = !1;
};
function Z(t, n, r, i, a, o = {}) {
	let s = /* @__PURE__ */ new Map();
	for (let e of i) {
		let t = `${Math.floor(e[0] / _n)},${Math.floor(e[1] / _n)}`;
		s.has(t) || s.set(t, []), s.get(t).push(e);
	}
	let c = new e.Matrix4(), l = [];
	n.boundingSphere || n.computeBoundingSphere();
	let u = n.boundingSphere.radius, d = o.range ?? Math.min(450, Math.max(140, u * 220)), f = !!o.cast && u >= .4;
	for (let i of s.values()) {
		let s = new e.InstancedMesh(n, r, i.length);
		i.forEach((e, t) => {
			a(c, e), s.setMatrixAt(t, c), o.color && s.setColorAt(t, o.color(e));
		}), s.castShadow = f, s.receiveShadow = !!o.receive, s.computeBoundingSphere(), t.add(s), l.push(s);
		let u = d + s.boundingSphere.radius;
		yn.push({
			mesh: s,
			x: s.boundingSphere.center.x,
			z: s.boundingSphere.center.z,
			r2: u * u
		});
	}
	return l;
}
function Sn(t) {
	let n = [], r = [], i = [], a = 0;
	for (let e of t) {
		let t = e.index ? e : e.toNonIndexed(), o = t.attributes.position.array, s = t.attributes.normal.array;
		if (n.push(...o), r.push(...s), t.index) for (let e of t.index.array) i.push(e + a);
		a += o.length / 3;
	}
	let o = new e.BufferGeometry();
	return o.setAttribute("position", new e.Float32BufferAttribute(n, 3)), o.setAttribute("normal", new e.Float32BufferAttribute(r, 3)), i.length && o.setIndex(i), o;
}
function Cn(e, t, n) {
	let r = n[0] - t[0], i = n[1] - t[1], a = Math.hypot(r, i);
	if (a < 2.5) return null;
	let o = i / a, s = -r / a, c = (t[0] + n[0]) / 2, l = (t[1] + n[1]) / 2, u = e.nearest(c + o * 5, l + s * 5, 14);
	if (!u || u.seg.road.kind === "footway") return null;
	let { a: d, b: f, road: p } = u.seg, m = f.x - d.x, h = f.z - d.z;
	if (Math.abs(r * m + i * h) < .8 * a * Math.hypot(m, h)) return null;
	let g = (u.x - c) * o + (u.z - l) * s;
	return g <= 0 || g > p.w / 2 + vn + 6 ? null : {
		road: p,
		room: g - p.w / 2
	};
}
function wn(t) {
	let n = document.createElement("canvas");
	n.width = 64, n.height = 4;
	let r = n.getContext("2d");
	for (let e = 0; e < 8; e++) r.fillStyle = e % 2 ? "#f4efe4" : t, r.fillRect(e * 8, 0, 8, 4);
	let i = new e.CanvasTexture(n);
	return i.colorSpace = e.SRGBColorSpace, i;
}
//#endregion
//#region src/world/shopkit.js
var Tn = [
	["sushi", /sushi|nikkei|meishi|japon|ramen|wok/],
	["heladeria", /helad|grido|gelat|freddo|ice roll/],
	["parrilla", /parrill|asador|brasas|gaucho|estancia|kamado|campo|chorip|costill/],
	["pizzeria", /pizz|napolitan|horneria|focacc|empanad|la masa/],
	["italiano", /ristorante|pasta|tavola|trattor|tanita|cappott|fiore|italian|bini/],
	["cerveceria", /cervec|brewing|beer|birr|antares|garage|jard[ií]n|lupulo/],
	["burger", /burger|hamburg|papas|mostrador/],
	["cafe", /caf[eé]|bakery|boulanger|chocolat|crepe|panader|confiter|medialun|tea\b/],
	["bodegon", /bodeg|cantina|taberna|gallegos|almac[eé]n|carlitos|del viejo|club|colonial|abuel/],
	["bar", /\bbar\b|wine|vinsanto|barric|pub|mexican|lupita|tapas/]
], En = {
	cafe: "cafe",
	ice_cream: "heladeria",
	fast_food: "burger",
	pub: "cerveceria",
	biergarten: "cerveceria",
	bar: "bar",
	bakery: "cafe",
	pastry: "cafe",
	confectionery: "cafe"
};
function Dn(e) {
	let t = e.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
	for (let [e, n] of Tn) if (n.test(t)) return e;
	return En[e.kind] || "resto";
}
var On = {
	parrilla: {
		label: "Parrilla",
		sign: "#5a2e17",
		canopy: 3875862,
		props: [
			"chimney",
			"wallLamps",
			"barrels"
		],
		icon: "flame"
	},
	bodegon: {
		label: "Bodegón",
		sign: "#6b1f1f",
		canopy: 2759956,
		props: ["wallLamps", "chalkboard"],
		icon: "fork"
	},
	pizzeria: {
		label: "Pizzería",
		sign: "#b3261e",
		awning: ["#b3261e"],
		props: ["tables", "chalkboard"],
		icon: "pizza"
	},
	italiano: {
		label: "Cocina italiana",
		sign: "#1e5e33",
		awning: "italia",
		props: ["planters", "tables"],
		icon: "pasta"
	},
	cerveceria: {
		label: "Cervecería",
		sign: "#2b1d12",
		canopy: 1710618,
		props: ["barrels", "bulbs"],
		icon: "beer"
	},
	sushi: {
		label: "Sushi",
		sign: "#1a1a1a",
		canopy: 1710618,
		props: [
			"lanterns",
			"noren",
			"planters"
		],
		icon: "sushi"
	},
	burger: {
		label: "Hamburguesería",
		sign: "#d9901a",
		canopy: 1118481,
		props: [],
		icon: "burger"
	},
	cafe: {
		label: "Café",
		sign: "#6b4a2f",
		awning: [
			"#2f4f3a",
			"#1f5f9e",
			"#6b4a2f"
		],
		props: ["umbrellas", "planters"],
		icon: "cup"
	},
	heladeria: {
		label: "Heladería",
		sign: "#c2477a",
		awning: ["#c2477a", "#3aa7a3"],
		props: ["umbrellas"],
		icon: "cone"
	},
	bar: {
		label: "Bar",
		sign: "#151515",
		canopy: 1381653,
		props: ["bulbs", "tables"],
		icon: "wine"
	},
	resto: {
		label: "Restaurante",
		sign: "#7a2b1f",
		awning: [
			"#7a1f1f",
			"#2f4f3a",
			"#b3261e",
			"#1f5f9e"
		],
		props: ["tables", "chalkboard"],
		icon: "fork"
	}
}, kn = {
	kiosco: "candy",
	ferreteria: "hammer",
	ropa: "hanger",
	tecno: "phone",
	almacen: "cart",
	banco: "coin",
	taller: "wrench",
	hotel: "bed",
	hogar: "sofa",
	flores: "flower",
	libreria: "book",
	boliche: "disco",
	super: "cart"
}, An = {
	hotel: {
		canopy: 1776411,
		props: ["planters"]
	},
	flores: { props: ["flowers"] },
	boliche: {
		canopy: 723723,
		props: ["vallas"]
	}
}, jn = (e, t) => t[Math.floor(e() * t.length)];
function Mn(e, t, n, r, i, a, o) {
	e.fillStyle = a, e.fillRect(t, n, r, i), e.fillStyle = "rgba(0,0,0,0.25)";
	for (let a = 0, o = n; o < n + i; o += 9, a++) {
		e.fillRect(t, o, r, 1.5);
		for (let n = t + a % 2 * 10; n < t + r; n += 20) e.fillRect(n, o, 1.5, 9);
	}
	for (let a = 0; a < 60; a++) e.fillStyle = `rgba(${o() < .5 ? "255,220,190" : "60,20,10"},0.12)`, e.fillRect(t + o() * r, n + o() * i, 18, 7);
}
function Nn(e, t, n, r, i, a, o) {
	for (let s = n, c = 0; s < n + i; s += 12, c++) for (let n = t, i = 0; n < t + r; n += 12, i++) e.fillStyle = (c + i) % 2 ? a : o, e.fillRect(n, s, 12, 12);
}
function Pn(e, t, n, r, i, a, o, s) {
	e.fillStyle = o, e.fillRect(n, r, i, a), t.fillStyle = s, t.fillRect(n, r, i, a);
}
function Fn(e, t, n, r, i) {
	e.fillStyle = "rgba(255,255,255,0.1)", e.beginPath(), e.moveTo(t + r * .1, n + i), e.lineTo(t + r * .35, n), e.lineTo(t + r * .5, n), e.lineTo(t + r * .25, n + i), e.fill();
}
function In(e, t, n, r, i, a, o = 5) {
	e.fillStyle = a, e.fillRect(t - o, n - o, r + o * 2, o), e.fillRect(t - o, n + i, r + o * 2, o), e.fillRect(t - o, n, o, i), e.fillRect(t + r, n, o, i);
}
function Ln(e, t, n, r) {
	e.fillStyle = r, e.fillRect(t, n, 36, 7), e.fillStyle = "rgba(30,15,5,0.7)", e.fillRect(t + 16, n + 7, 4, 28), e.beginPath(), e.arc(t + 4, n - 16, 8, 0, Math.PI * 2), e.arc(t + 32, n - 14, 8, 0, Math.PI * 2), e.fill();
}
function Rn(e, t, n, r, i, a, o) {
	for (let s = 0; s < i; s++) {
		e.fillStyle = "rgba(90,60,30,0.9)", e.fillRect(t, n + s * 24 + 20, r, 3);
		for (let i = t + 3; i < t + r - 6; i += 7) e.fillStyle = jn(a, o), e.fillRect(i, n + s * 24 + 4, 5, 16), e.fillRect(i + 1.5, n + s * 24, 2, 5);
	}
}
function zn(e, t, n, r, i) {
	i.brick ? Mn(e, n, 0, r, r, i.wall, i.rng) : (e.fillStyle = i.wall, e.fillRect(n, 0, r, r)), e.fillStyle = i.fascia, e.fillRect(n, 0, r, 54), Pn(e, t, n + 14, 72, 146, 128, i.tint, i.lit), i.interior?.(e, t, n + 14, 72, 146, 128), Fn(e, n + 14, 72, 146, 128), In(e, n + 14, 72, 146, 128, i.frame), i.zocalo ? i.zocalo(e, n + 9, 205, 156, 51) : (e.fillStyle = i.frame, e.fillRect(n + 9, 205, 156, 51)), Pn(e, t, n + 180, 76, 62, 180, i.tint, i.lit), Fn(e, n + 180, 76, 62, 180), In(e, n + 180, 76, 62, 180, i.door || i.frame, 6), e.fillStyle = "#c9b27a", e.fillRect(n + 232, 160, 4, 22);
}
var Bn = {
	parrilla: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		brick: !0,
		wall: jn(i, [
			"#8a3b24",
			"#7a3420",
			"#9a4a2c"
		]),
		fascia: "#3b2416",
		frame: "#3b2416",
		tint: "#2a140a",
		lit: "#ff9a3c",
		interior(e, t, n, r, i, a) {
			let o = e.createLinearGradient(0, r + a - 40, 0, r + a);
			o.addColorStop(0, "#ff7a1a"), o.addColorStop(1, "#ffd23c"), e.fillStyle = o, e.fillRect(n + 10, r + a - 40, i - 20, 34), t.fillStyle = "#ffb040", t.fillRect(n + 10, r + a - 40, i - 20, 34), e.fillStyle = "#222";
			for (let t = n + 12; t < n + i - 12; t += 8) e.fillRect(t, r + a - 46, 2, 10);
			e.fillRect(n + 10, r + a - 48, i - 20, 3), e.fillStyle = "#6b2a10";
			for (let t = 0; t < 6; t++) e.fillRect(n + 18 + t * 21, r + a - 56, 16, 9);
		},
		zocalo: (e, t, n, r, a) => Mn(e, t, n, r, a, "#5c2716", i)
	}),
	bodegon: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: jn(i, [
			"#e8dcc0",
			"#d9c9a3",
			"#efe6cf"
		]),
		fascia: "#6b1f1f",
		frame: "#4a2a17",
		tint: "#3a2416",
		lit: "#ffcf8a",
		interior(e, t, n, r, a) {
			Rn(e, n + 6, r + 6, a - 12, 2, i, [
				"#2c4a1e",
				"#5a1414",
				"#1f3b2a",
				"#3a2a10"
			]);
			for (let t of [n + 18, n + 88]) Ln(e, t, r + 98, "#c62828");
		},
		zocalo: (e, t, n, r, i) => Nn(e, t, n, r, i, "#1d4f8a", "#f4f0e6")
	}),
	pizzeria: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: "#f4efe6",
		fascia: "#b3261e",
		frame: "#2b2b2b",
		tint: "#3a2418",
		lit: "#ffb36a",
		interior(e, t, n, r, i, a) {
			e.fillStyle = "#9a4a2c", e.beginPath(), e.arc(n + i / 2, r + a - 10, 52, Math.PI, 0), e.fill(), e.fillStyle = "#1a0d06", e.beginPath(), e.arc(n + i / 2, r + a - 10, 26, Math.PI, 0), e.fill(), e.fillStyle = "#ff8a1e", e.fillRect(n + i / 2 - 18, r + a - 24, 36, 12), t.fillStyle = "#ff9a2a", t.fillRect(n + i / 2 - 26, r + a - 36, 52, 26);
		},
		zocalo: (e, t, n, r, i) => Nn(e, t, n, r, i, "#b3261e", "#f4f0e6")
	}),
	italiano: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: jn(i, [
			"#e9dcc4",
			"#f1e6d0",
			"#d8c7a8"
		]),
		fascia: "#1e5e33",
		frame: "#1e5e33",
		tint: "#3a2a1c",
		lit: "#ffd08f",
		interior(e, t, n, r, i) {
			for (let t of [n + 16, n + 86]) Ln(e, t, r + 96, "#f4f4f4");
			e.fillStyle = "#3f7a2f";
			for (let t = 0; t < 5; t++) e.beginPath(), e.arc(n + 16 + t * 28, r + 14, 9, 0, Math.PI * 2), e.fill();
		}
	}),
	cerveceria: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		brick: i() < .5,
		wall: jn(i, [
			"#2b2b2b",
			"#4a3626",
			"#6b3a22"
		]),
		fascia: "#111",
		frame: "#111",
		tint: "#22160c",
		lit: "#ffc24a",
		interior(e, t, n, r, i) {
			e.fillStyle = "#1b1f1b", e.fillRect(n + 10, r + 8, i - 20, 44), e.fillStyle = "#e8e8d8";
			for (let t = 0; t < 4; t++) e.fillRect(n + 18, r + 14 + t * 9, 40 + t * 23 % 60, 3);
			e.fillStyle = "#c0c4c8";
			for (let t = n + 16; t < n + i - 12; t += 14) e.fillRect(t, r + 62, 5, 18);
			e.fillStyle = "#5a3a1e", e.fillRect(n + 6, r + 80, i - 12, 10);
		}
	}),
	sushi: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: jn(i, ["#2b2622", "#3a2e24"]),
		fascia: "#111",
		frame: "#5a3e26",
		door: "#5a3e26",
		tint: "#2a1a12",
		lit: "#ffd9a0",
		interior(e, t, n, r, i) {
			e.fillStyle = "#6b4a2f", e.fillRect(n + 6, r + 80, i - 12, 12);
			for (let t = 0; t < 8; t++) e.fillStyle = "#f4f4f4", e.beginPath(), e.arc(n + 16 + t * 16, r + 74, 6, 0, Math.PI * 2), e.fill(), e.fillStyle = "#e8613a", e.beginPath(), e.arc(n + 16 + t * 16, r + 74, 3, 0, Math.PI * 2), e.fill();
			e.fillStyle = "#c62828", e.beginPath(), e.arc(n + i / 2, r + 30, 16, 0, Math.PI * 2), e.fill();
		},
		zocalo: (e, t, n, r, i) => {
			e.fillStyle = "#5a3e26", e.fillRect(t, n, r, i), e.fillStyle = "rgba(0,0,0,0.3)";
			for (let a = t; a < t + r; a += 10) e.fillRect(a, n, 2, i);
		}
	}),
	burger: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: jn(i, ["#151515", "#2b2b2b"]),
		fascia: "#d9901a",
		frame: "#d9901a",
		tint: "#2a1a10",
		lit: "#ffe1a0",
		interior(e, t, n, r, i) {
			for (let i = 0; i < 3; i++) e.fillStyle = [
				"#d9901a",
				"#c62828",
				"#f4f4f4"
			][i], e.fillRect(n + 10 + i * 46, r + 8, 40, 30), t.fillStyle = "#fff2c0", t.fillRect(n + 10 + i * 46, r + 8, 40, 30);
			e.fillStyle = "#777", e.fillRect(n + 6, r + 86, i - 12, 10);
		}
	}),
	cafe: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: jn(i, [
			"#f4ece0",
			"#e6efe9",
			"#f3e1e4",
			"#efe7d6"
		]),
		fascia: "#6b4a2f",
		frame: "#3a2a1c",
		tint: "#3a2a20",
		lit: "#ffe4b8",
		interior(e, t, n, r, a) {
			e.fillStyle = "#e8e2d6", e.fillRect(n + 8, r + 78, a - 16, 26);
			for (let t = 0; t < 9; t++) e.fillStyle = jn(i, [
				"#c88a3e",
				"#8a4a20",
				"#f0d9a8",
				"#c2477a"
			]), e.beginPath(), e.ellipse(n + 18 + t * 14, r + 88, 6, 4, 0, 0, Math.PI * 2), e.fill();
			e.fillStyle = "#9aa0a6", e.fillRect(n + a - 44, r + 40, 30, 34);
		}
	}),
	heladeria: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: jn(i, [
			"#fde3ee",
			"#e0f4f2",
			"#fff4d6"
		]),
		fascia: "#c2477a",
		frame: "#f4f4f4",
		tint: "#e8f0f2",
		lit: "#ffffff",
		interior(e, t, n, r, a) {
			e.fillStyle = "#c9d6dc", e.fillRect(n + 6, r + 74, a - 12, 34);
			for (let t = 0; t < 10; t++) e.fillStyle = jn(i, [
				"#f8bbd0",
				"#5d4037",
				"#fff59d",
				"#a5d6a7",
				"#ffcc80",
				"#ce93d8",
				"#ffffff",
				"#ef9a9a"
			]), e.fillRect(n + 10 + t * 13, r + 80, 11, 14);
		}
	}),
	bar: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: jn(i, [
			"#1b1b1b",
			"#2a1f2b",
			"#1f2a2b"
		]),
		fascia: "#000",
		frame: "#000",
		tint: "#160f1a",
		lit: "#ff9ad0",
		interior(e, t, n, r, a) {
			Rn(e, n + 8, r + 8, a - 16, 3, i, [
				"#e0a526",
				"#5ad1e8",
				"#e85a9a",
				"#9be85a",
				"#f4f4f4"
			]), t.fillStyle = "#ff7ac0", t.fillRect(n + 8, r + 4, a - 16, 3);
		}
	}),
	resto: (e, t, n, r, i) => zn(e, t, n, r, {
		rng: i,
		wall: jn(i, [
			"#6b4a2f",
			"#e8dcc2",
			"#7a2b1f",
			"#d9d2c4"
		]),
		fascia: "#2a1d14",
		frame: "#3a2618",
		tint: "#4a3326",
		lit: "#ffc27a",
		interior(e, t, n, r) {
			for (let t of [n + 18, n + 88]) Ln(e, t, r + 96, "#f4f4f4");
		}
	})
};
function Vn(t) {
	let r = document.createElement("canvas"), i = document.createElement("canvas");
	r.width = i.width = 1024, r.height = i.height = 256;
	let a = r.getContext("2d"), o = i.getContext("2d");
	o.fillStyle = "#000", o.fillRect(0, 0, 1024, 256);
	let s = n(t.length * 131 + 7);
	for (let e = 0; e < 4; e++) Bn[t](a, o, e * 256, 256, s);
	let c = new e.CanvasTexture(r), l = new e.CanvasTexture(i);
	return c.colorSpace = l.colorSpace = e.SRGBColorSpace, c.anisotropy = 8, new e.MeshStandardMaterial({
		map: c,
		emissiveMap: l,
		emissive: 16769712,
		emissiveIntensity: 0,
		roughness: .7,
		polygonOffset: !0,
		polygonOffsetFactor: -1
	});
}
var Hn = {
	flame(e) {
		e.beginPath(), e.moveTo(64, 18), e.bezierCurveTo(96, 50, 100, 80, 64, 108), e.bezierCurveTo(28, 80, 36, 56, 52, 40), e.bezierCurveTo(54, 60, 62, 64, 64, 18), e.fill();
	},
	fork(e) {
		e.fillRect(40, 20, 6, 88);
		for (let t of [
			30,
			40,
			50
		]) e.fillRect(t, 20, 4, 26);
		e.fillRect(30, 44, 24, 6), e.beginPath(), e.ellipse(84, 44, 10, 26, 0, 0, Math.PI * 2), e.fill(), e.fillRect(80, 60, 8, 48);
	},
	pizza(e) {
		e.beginPath(), e.moveTo(24, 30), e.lineTo(104, 30), e.lineTo(64, 108), e.fill(), e.fillStyle = "rgba(0,0,0,0.35)";
		for (let [t, n] of [
			[50, 48],
			[76, 50],
			[64, 74]
		]) e.beginPath(), e.arc(t, n, 7, 0, Math.PI * 2), e.fill();
	},
	pasta(e) {
		e.beginPath(), e.arc(64, 70, 38, 0, Math.PI), e.fill(), e.lineWidth = 4, e.strokeStyle = e.fillStyle;
		for (let t = 0; t < 4; t++) e.beginPath(), e.arc(64, 70, 14 + t * 6, Math.PI * 1.1, Math.PI * 1.9), e.stroke();
	},
	beer(e) {
		e.fillRect(36, 34, 46, 70), e.lineWidth = 8, e.strokeStyle = e.fillStyle, e.beginPath(), e.arc(84, 66, 14, -Math.PI / 2, Math.PI / 2), e.stroke(), e.beginPath(), e.arc(46, 32, 12, 0, Math.PI * 2), e.arc(66, 28, 12, 0, Math.PI * 2), e.fill();
	},
	sushi(e) {
		e.beginPath(), e.arc(64, 64, 40, 0, Math.PI * 2), e.fill(), e.fillStyle = "#111", e.beginPath(), e.arc(64, 64, 30, 0, Math.PI * 2), e.fill(), e.fillStyle = "#e8613a", e.beginPath(), e.arc(64, 64, 14, 0, Math.PI * 2), e.fill();
	},
	burger(e) {
		e.beginPath(), e.ellipse(64, 46, 40, 20, 0, Math.PI, 0), e.fill(), e.fillRect(24, 54, 80, 10), e.fillRect(22, 68, 84, 12), e.fillRect(26, 84, 76, 14);
	},
	cup(e) {
		e.fillRect(32, 50, 50, 46), e.lineWidth = 7, e.strokeStyle = e.fillStyle, e.beginPath(), e.arc(84, 70, 12, -Math.PI / 2, Math.PI / 2), e.stroke(), e.fillRect(26, 98, 64, 6);
		for (let t of [
			44,
			58,
			72
		]) e.fillRect(t, 24, 4, 18);
	},
	cone(e) {
		e.beginPath(), e.moveTo(42, 60), e.lineTo(86, 60), e.lineTo(64, 112), e.fill();
		for (let [t, n] of [
			[50, 50],
			[78, 50],
			[64, 32]
		]) e.beginPath(), e.arc(t, n, 18, 0, Math.PI * 2), e.fill();
	},
	wine(e) {
		e.beginPath(), e.moveTo(38, 22), e.lineTo(90, 22), e.quadraticCurveTo(90, 70, 64, 72), e.quadraticCurveTo(38, 70, 38, 22), e.fill(), e.fillRect(61, 70, 6, 30), e.fillRect(44, 98, 40, 6);
	},
	candy(e) {
		e.beginPath(), e.arc(64, 64, 24, 0, Math.PI * 2), e.fill();
		for (let t of [-1, 1]) e.beginPath(), e.moveTo(64 + t * 22, 64), e.lineTo(64 + t * 52, 44), e.lineTo(64 + t * 52, 84), e.fill();
	},
	hammer(e) {
		e.save(), e.translate(64, 64), e.rotate(-.6), e.fillRect(-6, -10, 12, 60), e.fillRect(-30, -34, 60, 24), e.restore();
	},
	hanger(e) {
		e.lineWidth = 8, e.strokeStyle = e.fillStyle, e.beginPath(), e.moveTo(16, 92), e.lineTo(64, 56), e.lineTo(112, 92), e.closePath(), e.stroke(), e.beginPath(), e.arc(64, 40, 12, Math.PI, Math.PI * 2.5), e.stroke();
	},
	phone(e) {
		e.fillRect(42, 16, 44, 96), e.fillStyle = "rgba(0,0,0,0.45)", e.fillRect(48, 26, 32, 70);
	},
	cart(e) {
		e.fillRect(26, 40, 70, 36), e.fillRect(14, 30, 18, 6), e.beginPath(), e.arc(40, 92, 9, 0, Math.PI * 2), e.arc(84, 92, 9, 0, Math.PI * 2), e.fill();
	},
	coin(e) {
		e.beginPath(), e.arc(64, 64, 40, 0, Math.PI * 2), e.fill(), e.fillStyle = "rgba(0,0,0,0.4)", e.font = "bold 56px Arial", e.textAlign = "center", e.textBaseline = "middle", e.fillText("$", 64, 66);
	},
	disco(e) {
		e.beginPath(), e.arc(64, 70, 34, 0, Math.PI * 2), e.fill(), e.fillStyle = "rgba(0,0,0,0.35)";
		for (let t = -3; t <= 3; t++) e.fillRect(30, 70 + t * 9, 68, 2), e.fillRect(64 + t * 9, 36, 2, 68);
		e.fillStyle = "#fff", e.fillRect(62, 14, 4, 24);
	},
	bed(e) {
		e.fillRect(18, 62, 92, 22), e.fillRect(18, 84, 8, 22), e.fillRect(102, 84, 8, 22), e.fillRect(18, 40, 8, 30), e.beginPath(), e.ellipse(42, 56, 14, 8, 0, 0, Math.PI * 2), e.fill();
	},
	sofa(e) {
		e.fillRect(22, 58, 84, 30), e.fillRect(14, 50, 16, 40), e.fillRect(98, 50, 16, 40), e.fillRect(22, 40, 84, 20), e.fillRect(22, 88, 8, 12), e.fillRect(98, 88, 8, 12);
	},
	flower(e) {
		for (let t = 0; t < 6; t++) {
			let n = t / 6 * Math.PI * 2;
			e.beginPath(), e.arc(64 + Math.cos(n) * 20, 52 + Math.sin(n) * 20, 13, 0, Math.PI * 2), e.fill();
		}
		e.fillRect(61, 70, 6, 42), e.fillStyle = "rgba(0,0,0,0.35)", e.beginPath(), e.arc(64, 52, 10, 0, Math.PI * 2), e.fill();
	},
	book(e) {
		e.beginPath(), e.moveTo(64, 36), e.lineTo(22, 26), e.lineTo(22, 96), e.lineTo(64, 106), e.lineTo(106, 96), e.lineTo(106, 26), e.closePath(), e.fill(), e.fillStyle = "rgba(0,0,0,0.35)", e.fillRect(62, 36, 4, 70);
	},
	wrench(e) {
		e.save(), e.translate(64, 64), e.rotate(.8), e.fillRect(-7, -20, 14, 70), e.beginPath(), e.arc(0, -30, 20, 0, Math.PI * 2), e.fill(), e.fillStyle = "rgba(0,0,0,0.5)", e.fillRect(-6, -52, 12, 24), e.restore();
	}
};
function Un(t, n) {
	let r = document.createElement("canvas");
	r.width = r.height = 128;
	let i = r.getContext("2d");
	i.fillStyle = n, i.fillRect(0, 0, 128, 128), i.strokeStyle = "rgba(255,255,255,0.9)", i.lineWidth = 6, i.strokeRect(5, 5, 118, 118), i.fillStyle = "#fff", Hn[t](i);
	let a = new e.CanvasTexture(r);
	return a.colorSpace = e.SRGBColorSpace, new e.MeshStandardMaterial({
		map: a,
		emissiveMap: a,
		emissive: 16777215,
		emissiveIntensity: 0,
		roughness: .6
	});
}
function Wn(t, n, r, i = {}) {
	let a = document.createElement("canvas");
	a.width = t, a.height = n, r(a.getContext("2d"));
	let o = new e.CanvasTexture(a);
	return o.colorSpace = e.SRGBColorSpace, new e.MeshStandardMaterial({
		map: o,
		roughness: .8,
		...i
	});
}
function Gn(t, r, { graph: i, collision: a, nightMaterials: o }) {
	let s = new e.Quaternion(), c = new e.Vector3(0, 1, 0), l = new e.Vector3(1, 0, 0), u = (t, [n, r, i, a, o = 1]) => t.compose(new e.Vector3(n, i, r), s.setFromAxisAngle(c, a), new e.Vector3(o, 1, 1)), d = (e, t, n, r = 0) => [
		e.x + e.ux * t + e.ox * n,
		e.z + e.uz * t + e.oz * n,
		r,
		Math.atan2(e.ox, e.oz)
	], f = (e, t = .8) => {
		let n = i.nearest(e[0], e[1], 20);
		return !n || n.dist > n.seg.road.w / 2 + t;
	}, p = (e, t) => a.addCircle(e[0], e[1], t, "pole"), m = n(17), h = {
		vallas: [],
		flowers: [],
		blades: /* @__PURE__ */ new Map(),
		awnings: /* @__PURE__ */ new Map(),
		canopies: /* @__PURE__ */ new Map(),
		tables: [],
		umbrellas: [],
		barrels: [],
		lamps: [],
		lanterns: [],
		noren: [],
		chalk: [],
		planters: [],
		bulbs: [],
		chimneys: []
	}, g = (e, t, n) => (e.get(t) || e.set(t, []).get(t)).push(n);
	for (let e of r) {
		let t = e.rubro === "comida" ? On[e.sub] : An[e.rubro], n = t?.icon || kn[e.rubro], r = e.signColor;
		if (n && g(h.blades, `${n}|${r}`, d(e, e.w / 2 - .3, .55, Math.min(e.h - 1.1, 2.9))), !t) continue;
		let i = new Set(t.props), a = e.h - .8;
		if (t.awning) {
			let n = t.awning === "italia" ? "italia" : jn(m, t.awning);
			g(h.awnings, n, [...d(e, 0, 0, a), e.w - .3]);
		} else t.canopy !== void 0 && g(h.canopies, t.canopy, [...d(e, 0, .5, a), e.w - .2]);
		if (i.has("chimney") && e.roof && h.chimneys.push(d(e, -e.w / 4, -1.4, e.roof)), i.has("wallLamps")) for (let t of [-1, 1]) h.lamps.push(d(e, t * (e.w / 2 - .25), .2, 2.3));
		if (i.has("lanterns")) for (let t of [-1, 1]) h.lanterns.push(d(e, t * (e.w / 2 - .6), .45, Math.min(2.6, a - .5)));
		if (i.has("noren") && h.noren.push([...d(e, -.32 * e.w, .07, 2.5), 1]), i.has("bulbs")) for (let t = 0; t < 6; t++) h.bulbs.push(d(e, (t / 5 - .5) * (e.w - .8), .9, a - .15));
		if (i.has("planters") && e.room > 1.6) for (let t of [-1, 1]) {
			let n = d(e, t * (e.w / 2 - .55), .3);
			f(n) && (h.planters.push(n), p(n, .4));
		}
		if (i.has("vallas") && e.room > 2) {
			let t = d(e, 0, 1.3);
			f(t) && (h.vallas.push([...t, 1]), p(t, .3));
		}
		if (i.has("flowers") && e.room > 1.8) {
			for (let t = 0; t < 4; t++) {
				let n = d(e, -e.w / 2 + .5 + t * .55, .35);
				f(n) && h.flowers.push([
					...n,
					1,
					t
				]);
			}
			p(d(e, -e.w / 2 + 1.3, .35), .7);
		}
		if (i.has("chalkboard") && e.room > 1.8) {
			let t = d(e, -.32 * e.w + 1.1, 1);
			t[3] += .4, f(t) && (h.chalk.push(t), p(t, .35));
		}
		if (e.room > 2.6 && (i.has("tables") || i.has("umbrellas") || i.has("barrels"))) for (let t of e.w >= 5 ? [-e.w / 4 + .3, e.w / 4] : [.4]) {
			let n = d(e, t, 1.45);
			f(n) && (n[3] += m() * .5, i.has("barrels") ? h.barrels.push(n) : (h.tables.push(n), i.has("umbrellas") && h.umbrellas.push([
				...n.slice(0, 4),
				1,
				jn(m, [
					"#2f4f3a",
					"#c62828",
					"#f4f4f4",
					"#1f5f9e"
				])
			])), p(n, .6));
		}
	}
	let _ = new e.MeshStandardMaterial({
		color: 1975334,
		roughness: .5,
		metalness: .6
	}), v = new e.BoxGeometry(.04, .04, .7).translate(0, .36, -.2), y = new e.BoxGeometry(.06, .62, .62), b = [];
	for (let [e, n] of h.blades) {
		let [r, i] = e.split("|"), a = Un(r, i);
		b.push([a, .9]), Z(t, y, a, n, u, { range: 350 }), Z(t, v, _, n, u, { range: 250 });
	}
	let x = new I(), S = new e.Color(1, 1, 1);
	x.quad([
		-.5,
		0,
		0
	], [
		.5,
		0,
		0
	], [
		.5,
		-.5,
		1.2
	], [
		-.5,
		-.5,
		1.2
	], [0, 0], [1, 0], [1, 1], [0, 1], S, [
		0,
		1,
		.4
	]), x.quad([
		-.5,
		-.5,
		1.2
	], [
		.5,
		-.5,
		1.2
	], [
		.5,
		-.75,
		1.2
	], [
		-.5,
		-.75,
		1.2
	], [0, 0], [1, 0], [1, 1], [0, 1], S, [
		0,
		0,
		1
	]);
	let C = x.geometry();
	for (let [n, r] of h.awnings) {
		let i = n === "italia" ? qn() : wn(n);
		Z(t, C, new e.MeshStandardMaterial({
			map: i,
			side: e.DoubleSide,
			roughness: .9
		}), r, u, { cast: !0 });
	}
	let w = new e.BoxGeometry(1, .14, 1.1);
	for (let [n, r] of h.canopies) Z(t, w, new e.MeshStandardMaterial({
		color: n,
		roughness: .6,
		metalness: .3
	}), r, u, { cast: !0 });
	let T = new e.MeshStandardMaterial({
		color: 8016436,
		roughness: .85
	});
	Z(t, Sn([
		new e.CylinderGeometry(.45, .45, .05, 12).translate(0, .74, 0),
		new e.CylinderGeometry(.04, .04, .72, 5).translate(0, .36, 0),
		...[-.75, .75].flatMap((t) => [new e.BoxGeometry(.42, .45, .42).translate(t, .225, 0), new e.BoxGeometry(.06, .45, .42).translate(t + Math.sign(t) * .18, .67, 0)])
	]), T, h.tables, u, { cast: !0 }), Z(t, Sn([new e.CylinderGeometry(.03, .03, 2.3, 5).translate(0, 1.15, 0), new e.ConeGeometry(1.3, .45, 8).translate(0, 2.35, 0)]), new e.MeshStandardMaterial({
		color: 16777215,
		roughness: .9
	}), h.umbrellas, u, {
		cast: !0,
		color: (t) => new e.Color(t[5])
	}), Z(t, new e.LatheGeometry([
		[.26, 0],
		[.33, .25],
		[.35, .5],
		[.33, .75],
		[.26, .98],
		[0, .98]
	].map(([t, n]) => new e.Vector2(t, n)), 12), Wn(64, 64, (e) => {
		e.fillStyle = "#6b4321", e.fillRect(0, 0, 64, 64), e.fillStyle = "#2a2a2a";
		for (let t of [
			8,
			30,
			52
		]) e.fillRect(0, t, 64, 5);
		e.fillStyle = "rgba(0,0,0,0.25)";
		for (let t = 0; t < 64; t += 8) e.fillRect(t, 0, 1, 64);
	}), h.barrels, u, { cast: !0 });
	let E = new e.MeshStandardMaterial({
		color: 16773576,
		emissive: 16756816,
		emissiveIntensity: 0
	});
	Z(t, new e.BoxGeometry(.18, .28, .18), E, h.lamps, u), Z(t, new e.BoxGeometry(.03, .03, .22).translate(0, .16, -.12), _, h.lamps, u);
	let D = new e.MeshStandardMaterial({
		color: 12986408,
		emissive: 16726570,
		emissiveIntensity: .15,
		roughness: .8
	});
	Z(t, new e.CylinderGeometry(.17, .17, .42, 10), D, h.lanterns, u);
	let O = new e.MeshStandardMaterial({
		color: 16773576,
		emissive: 16756816,
		emissiveIntensity: 0
	});
	Z(t, new e.SphereGeometry(.07, 6, 4), O, h.bulbs, u);
	let k = Wn(128, 64, (e) => {
		e.fillStyle = "#1b2a4a", e.fillRect(0, 0, 128, 64), e.fillStyle = "#0b0f16";
		for (let t of [42, 85]) e.fillRect(t, 18, 2, 46);
		e.fillStyle = "#f4f4f4", e.beginPath(), e.arc(64, 30, 12, 0, Math.PI * 2), e.fill();
	}, { side: e.DoubleSide });
	Z(t, new e.PlaneGeometry(1.2, .55), k, h.noren, u);
	let A = Wn(96, 128, (e) => {
		e.fillStyle = "#6b4a2f", e.fillRect(0, 0, 96, 128), e.fillStyle = "#1e2a22", e.fillRect(6, 6, 84, 116), e.fillStyle = "#f4f4e8", e.font = "bold 15px Arial", e.textAlign = "center", e.fillText("MENÚ", 48, 28), e.fillText("DEL DÍA", 48, 46), e.font = "11px Arial";
		for (let t = 0; t < 4; t++) e.fillRect(16, 62 + t * 14, 40 + t * 17 % 24, 2);
	}), j = (t) => new e.BoxGeometry(.55, .85, .03).translate(0, .42, 0).applyMatrix4(new e.Matrix4().makeRotationAxis(l, t)).translate(0, 0, t * .6);
	Z(t, Kn([j(.2), j(-.2)]), A, h.chalk, u, { cast: !0 }), Z(t, new e.BoxGeometry(.85, .45, .38).translate(0, .225, 0), new e.MeshStandardMaterial({
		color: 3815994,
		roughness: .9
	}), h.planters, u, { cast: !0 }), Z(t, new e.IcosahedronGeometry(.36, 0).scale(1.2, .8, .6).translate(0, .72, 0), new e.MeshStandardMaterial({
		color: 4160047,
		roughness: .9,
		flatShading: !0
	}), h.planters, u, { cast: !0 }), Z(t, Kn([...[
		-1.4,
		0,
		1.4
	].flatMap((t) => [
		new e.CylinderGeometry(.035, .035, .95, 8).translate(t, .475, 0),
		new e.CylinderGeometry(.16, .18, .05, 10).translate(t, .025, 0),
		new e.SphereGeometry(.06, 8, 6).translate(t, .97, 0)
	])]), new e.MeshStandardMaterial({
		color: 14212578,
		metalness: .9,
		roughness: .25
	}), h.vallas, (t, [n, r, i, a]) => t.compose(new e.Vector3(n, i, r), s.setFromAxisAngle(c, a), new e.Vector3(1, 1, 1)), { cast: !0 }), Z(t, Kn([-.7, .7].map((t) => new e.TorusGeometry(.7, .03, 6, 16, Math.PI).rotateZ(Math.PI).scale(1, .3, 1).translate(t, .92, 0))), new e.MeshStandardMaterial({
		color: 11735583,
		roughness: .6
	}), h.vallas, (t, [n, r, i, a]) => t.compose(new e.Vector3(n, i, r), s.setFromAxisAngle(c, a), new e.Vector3(1, 1, 1))), Z(t, new e.CylinderGeometry(.2, .16, .4, 10).translate(0, .2, 0), new e.MeshStandardMaterial({
		color: 10134440,
		metalness: .5,
		roughness: .4
	}), h.flowers, u, { cast: !0 });
	let M = [
		"#e53935",
		"#f06292",
		"#fdd835",
		"#ffffff",
		"#ab47bc",
		"#ff7043"
	];
	Z(t, new e.IcosahedronGeometry(.26, 0).scale(1, .8, 1).translate(0, .62, 0), new e.MeshStandardMaterial({
		color: 16777215,
		roughness: .9,
		flatShading: !0
	}), h.flowers, u, {
		cast: !0,
		color: (t) => new e.Color(M[(t[5] * 7 + Math.round(t[0])) % M.length])
	});
	let N = Wn(64, 128, (e) => {
		e.fillStyle = "#8a3b24", e.fillRect(0, 0, 64, 128), e.fillStyle = "rgba(0,0,0,0.3)";
		for (let t = 0, n = 0; n < 128; n += 8, t++) {
			e.fillRect(0, n, 64, 1.5);
			for (let r = t % 2 * 8; r < 64; r += 16) e.fillRect(r, n, 1.5, 8);
		}
	});
	return Z(t, Kn([new e.BoxGeometry(.8, 1.8, .8).translate(0, .9, 0), new e.BoxGeometry(1, .15, 1).translate(0, 1.85, 0)]), N, h.chimneys, u, { cast: !0 }), { setNight(e) {
		for (let [t, n] of b) t.emissiveIntensity = e * n;
		E.emissiveIntensity = e * 3.5, O.emissiveIntensity = e * 4, D.emissiveIntensity = .15 + e * 2.5;
	} };
}
function Kn(t) {
	let n = [], r = [], i = [];
	for (let e of t) {
		let t = e.index ? e.toNonIndexed() : e;
		n.push(...t.attributes.position.array), r.push(...t.attributes.normal.array), i.push(...t.attributes.uv.array);
	}
	let a = new e.BufferGeometry();
	return a.setAttribute("position", new e.Float32BufferAttribute(n, 3)), a.setAttribute("normal", new e.Float32BufferAttribute(r, 3)), a.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), a;
}
function qn() {
	let t = document.createElement("canvas");
	t.width = 96, t.height = 4;
	let n = t.getContext("2d");
	[
		"#1e7a3a",
		"#f4efe4",
		"#c62828"
	].forEach((e, t) => {
		n.fillStyle = e, n.fillRect(t * 32, 0, 32, 4);
	});
	let r = new e.CanvasTexture(t);
	return r.colorSpace = e.SRGBColorSpace, r;
}
//#endregion
//#region src/world/supermarkets.js
var Jn = [
	[/carrefour/i, {
		name: "Carrefour",
		band: "#1e4fa0",
		accent: "#e21b23",
		sign: "#ffffff",
		ink: "#1e4fa0"
	}],
	[/\bcoto\b/i, {
		name: "COTO",
		band: "#d2232a",
		accent: "#ffffff",
		sign: "#d2232a",
		ink: "#ffffff"
	}],
	[/jumbo/i, {
		name: "JUMBO",
		band: "#00a650",
		accent: "#ffffff",
		sign: "#00a650",
		ink: "#ffffff"
	}],
	[/\bd[ií]a\b/i, {
		name: "Día",
		band: "#e2001a",
		accent: "#ffffff",
		sign: "#e2001a",
		ink: "#ffffff"
	}],
	[/chango ?m[aá]s/i, {
		name: "ChangoMás",
		band: "#0b8a3a",
		accent: "#ffd200",
		sign: "#0b8a3a",
		ink: "#ffd200"
	}],
	[/vital/i, {
		name: "VITAL",
		band: "#c62828",
		accent: "#ffd200",
		sign: "#c62828",
		ink: "#ffd200"
	}],
	[/\bvea\b/i, {
		name: "VEA",
		band: "#e30613",
		accent: "#ffcc00",
		sign: "#e30613",
		ink: "#ffffff"
	}],
	[/disco\b/i, {
		name: "DISCO",
		band: "#d71920",
		accent: "#ffffff",
		sign: "#d71920",
		ink: "#ffffff"
	}]
];
function Yn(e) {
	for (let [t, n] of Jn) if (t.test(e)) return n;
	return {
		name: e.toUpperCase(),
		band: "#00796b",
		accent: "#ffffff",
		sign: "#00796b",
		ink: "#ffffff"
	};
}
var Xn = new e.Color(1, 1, 1), Zn = (t, n, r) => {
	let i = document.createElement("canvas");
	i.width = t, i.height = n, r(i.getContext("2d"), t, n);
	let a = new e.CanvasTexture(i);
	return a.colorSpace = e.SRGBColorSpace, a.anisotropy = 8, a;
};
function Qn(t, n, { collision: r, nightMaterials: a }) {
	if (!n.length) return { setNight() {} };
	let o = new I(), s = Zn(64, 64, (e) => {
		e.fillStyle = "#d9dcdf", e.fillRect(0, 0, 64, 64);
		for (let t = 0; t < 64; t += 8) e.fillStyle = "rgba(0,0,0,0.12)", e.fillRect(t, 0, 2, 64), e.fillStyle = "rgba(255,255,255,0.35)", e.fillRect(t + 2, 0, 1, 64);
	});
	s.wrapS = s.wrapT = e.RepeatWrapping;
	let c = /* @__PURE__ */ new Map(), l = new I(), u = [], d = [], f = [], p = [], m = /* @__PURE__ */ new Set();
	for (let e of n) {
		let t = e.building, n = t.h;
		if (!m.has(t)) {
			m.add(t);
			let e = i(t.pts) < 0 ? t.pts.slice().reverse() : t.pts;
			for (let t = 0; t < e.length; t++) {
				let r = e[t], i = e[(t + 1) % e.length], a = Math.hypot(i[0] - r[0], i[1] - r[1]);
				if (a < .5) continue;
				let s = (i[1] - r[1]) / a, c = -(i[0] - r[0]) / a, l = [r[0] + s * .05, r[1] + c * .05], u = [i[0] + s * .05, i[1] + c * .05];
				o.quad([
					l[0],
					0,
					l[1]
				], [
					u[0],
					0,
					u[1]
				], [
					u[0],
					n + .6,
					u[1]
				], [
					l[0],
					n + .6,
					l[1]
				], [0, 0], [a / 3, 0], [a / 3, (n + .6) / 3], [0, (n + .6) / 3], Xn, [
					s,
					0,
					c
				]);
			}
		}
		let { x: a, z: s, ux: h, uz: g, ox: _, oz: v, w: y, chain: b } = e, x = (e, t, n = 0) => [
			a + h * e + _ * t,
			n,
			s + g * e + v * t
		], S = b.band;
		c.has(S) || c.set(S, new I());
		let C = c.get(S), w = (e, t, n, r, i, a, o = 1) => {
			let s = x(t, a, r), c = x(n, a, r), l = x(n, a, i), u = x(t, a, i);
			e.quad(s, c, l, u, [0, 0], [o, 0], [o, 1], [0, 1], Xn, [
				_,
				0,
				v
			]);
		};
		w(C, y / 2, -y / 2, n - 1.6, n + .6, .12);
		let T = Math.min(10, y * .4);
		w(l, T / 2, -T / 2, 0, Math.min(3.6, n - 1.8), .1);
		let E = x(0, 2.2);
		d.push([
			E[0],
			E[2],
			Math.min(3.9, n - 1.7),
			Math.atan2(_, v),
			T + 3,
			b.band
		]);
		for (let e of [-1, 1]) {
			let t = x(e * (T / 2 + 1), 4.1);
			f.push([
				t[0],
				t[2],
				Math.atan2(_, v)
			]), r.addCircle(t[0], t[2], .25, "pole");
		}
		if (u.push({
			p: e,
			at: x(0, .3, n + .6),
			w: Math.min(y * .55, 24),
			chain: b
		}), e.room > 3) for (let e of [-1, 1]) {
			for (let t = 0; t < 6; t++) {
				let n = x(e * (T / 2 + 2.5 + t * .55), 1.4);
				p.push([
					n[0],
					n[2],
					Math.atan2(h, g) * e
				]);
			}
			let t = x(e * (T / 2 + 3.9), 1.4);
			r.addCircle(t[0], t[2], 1.2, "pole");
		}
	}
	let h = new e.Mesh(o.geometry(), new e.MeshStandardMaterial({
		map: s,
		roughness: .55,
		metalness: .4,
		polygonOffset: !0,
		polygonOffsetFactor: -1
	}));
	h.castShadow = h.receiveShadow = !0, t.add(h);
	for (let [n, r] of c) {
		let i = new e.Mesh(r.geometry(), new e.MeshStandardMaterial({
			color: n,
			roughness: .5,
			polygonOffset: !0,
			polygonOffsetFactor: -2
		}));
		t.add(i);
	}
	let g = Zn(256, 96, (e, t, n) => {
		e.fillStyle = "#1d2a33", e.fillRect(0, 0, t, n), e.fillStyle = "rgba(255,255,255,0.12)";
		for (let t = 0; t < 4; t++) e.fillRect(20 + t * 60, 0, 18, n);
		e.fillStyle = "#9aa3a8";
		for (let r = 0; r <= t; r += 64) e.fillRect(r, 0, 3, n);
		e.fillRect(0, 0, t, 4), e.fillStyle = "#fff", e.font = "bold 12px Arial", e.textAlign = "center", e.fillText("ENTRADA", t / 2, 16);
	}), _ = new e.MeshStandardMaterial({
		map: g,
		emissiveMap: g,
		emissive: 16773840,
		emissiveIntensity: 0,
		roughness: .15,
		metalness: .5,
		polygonOffset: !0,
		polygonOffsetFactor: -3
	});
	a.push(_), t.add(new e.Mesh(l.geometry(), _));
	let v = new e.Quaternion(), y = new e.Vector3(0, 1, 0), b = /* @__PURE__ */ new Map();
	for (let e of d) (b.get(e[5]) || b.set(e[5], []).get(e[5])).push(e);
	for (let [n, r] of b) Z(t, new e.BoxGeometry(1, .45, 4.6), new e.MeshStandardMaterial({
		color: n,
		roughness: .5
	}), r, (t, [n, r, i, a, o]) => {
		t.compose(new e.Vector3(n, i, r), v.setFromAxisAngle(y, a), new e.Vector3(o, 1, 1));
	}, { cast: !0 });
	Z(t, new e.CylinderGeometry(.22, .22, 4, 10).translate(0, 2, 0), new e.MeshStandardMaterial({
		color: 13225425,
		metalness: .6,
		roughness: .4
	}), f, (e, [t, n]) => e.makeTranslation(t, 0, n), { cast: !0 }), Z(t, er(), new e.MeshStandardMaterial({
		color: 12107460,
		metalness: .7,
		roughness: .35
	}), p, (t, [n, r, i]) => t.compose(new e.Vector3(n, 0, r), v.setFromAxisAngle(y, i), new e.Vector3(1, 1, 1)), { cast: !0 });
	let x = [];
	for (let n of u) {
		let r = Zn(1024, 192, (e, t, r) => {
			e.fillStyle = n.chain.sign, e.fillRect(0, 0, t, r), e.fillStyle = n.chain.accent, e.fillRect(0, r - 14, t, 14);
			let i = $n[n.chain.name];
			e.fillStyle = n.chain.ink, e.font = "bold 128px Arial, sans-serif", e.textAlign = "center", e.textBaseline = "middle", i ? (i(e, 100, r / 2 - 6, 70), e.fillStyle = n.chain.ink, e.fillText(n.chain.name, t / 2 + 70, r / 2 - 4, t - 260)) : e.fillText(n.chain.name, t / 2, r / 2 - 4, t - 60);
		}), i = new e.MeshStandardMaterial({
			map: r,
			emissiveMap: r,
			emissive: 16777215,
			emissiveIntensity: 0,
			roughness: .5
		});
		x.push(i);
		let a = n.w / 5.3, o = new e.BoxGeometry(n.w, a, .3), s = new e.Mesh(o, i);
		s.position.set(n.at[0], n.at[1] + a / 2, n.at[2]), s.rotation.y = Math.atan2(n.p.ox, n.p.oz), s.castShadow = !0, t.add(s);
	}
	return { setNight(e) {
		for (let t of x) t.emissiveIntensity = e * 1.2;
	} };
}
var $n = {
	Carrefour(e, t, n, r) {
		e.fillStyle = "#e21b23", e.beginPath(), e.moveTo(t - r * .15, n - r), e.lineTo(t - r, n), e.lineTo(t - r * .15, n + r), e.lineTo(t - r * .15, n + r * .45), e.lineTo(t - r * .45, n), e.lineTo(t - r * .15, n - r * .45), e.fill(), e.fillStyle = "#1e4fa0", e.beginPath(), e.moveTo(t + r * .15, n - r), e.lineTo(t + r, n), e.lineTo(t + r * .15, n + r), e.lineTo(t + r * .15, n + r * .45), e.lineTo(t + r * .45, n), e.lineTo(t + r * .15, n - r * .45), e.fill(), e.fillStyle = "#ffffff", e.beginPath(), e.arc(t, n, r * .42, Math.PI * .25, Math.PI * 1.75), e.lineTo(t + r * .15, n - r * .12), e.arc(t, n, r * .2, Math.PI * 1.75, Math.PI * .25, !0), e.fill();
	},
	COTO(e, t, n, r) {
		e.fillStyle = "#ffffff", e.beginPath(), e.arc(t, n, r, 0, Math.PI * 2), e.fill(), e.fillStyle = "#d2232a", e.font = `bold ${r * 1.1}px Arial`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("C", t, n + 3);
	},
	JUMBO(e, t, n, r) {
		e.fillStyle = "#ffffff", e.beginPath(), e.ellipse(t, n, r, r * .75, 0, 0, Math.PI * 2), e.fill(), e.fillStyle = "#00a650", e.beginPath(), e.arc(t - r * .3, n, r * .35, 0, Math.PI * 2), e.arc(t + r * .3, n, r * .35, 0, Math.PI * 2), e.fill();
	},
	Día(e, t, n, r) {
		e.fillStyle = "#ffffff", e.beginPath(), e.arc(t, n, r, 0, Math.PI * 2), e.fill(), e.fillStyle = "#e2001a", e.font = `bold ${r}px Arial`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("%", t, n + 2);
	},
	VITAL(e, t, n, r) {
		e.fillStyle = "#ffd200", e.beginPath(), e.moveTo(t - r, n - r * .7), e.lineTo(t, n + r * .8), e.lineTo(t + r, n - r * .7), e.lineTo(t + r * .5, n - r * .7), e.lineTo(t, n + r * .1), e.lineTo(t - r * .5, n - r * .7), e.fill();
	}
};
function er() {
	let t = [], n = (n, r, i, a, o, s) => t.push(new e.BoxGeometry(n, r, i).translate(a, o, s));
	n(.5, .42, .02, 0, .78, -.42), n(.5, .42, .02, 0, .78, .42), n(.02, .42, .86, -.25, .78, 0), n(.02, .42, .86, .25, .78, 0), n(.5, .02, .86, 0, .58, 0), n(.5, .03, .03, 0, 1.02, -.5);
	for (let [e, t] of [
		[-.2, -.35],
		[.2, -.35],
		[-.2, .35],
		[.2, .35]
	]) n(.02, .5, .02, e, .33, t), n(.04, .1, .1, e, .05, t);
	let r = [], i = [];
	for (let e of t) {
		let t = e.toNonIndexed();
		r.push(...t.attributes.position.array), i.push(...t.attributes.normal.array);
	}
	let a = new e.BufferGeometry();
	return a.setAttribute("position", new e.Float32BufferAttribute(r, 3)), a.setAttribute("normal", new e.Float32BufferAttribute(i, 3)), a;
}
//#endregion
//#region src/world/shops.js
var tr = Object.fromEntries(Object.entries({
	kiosco: [
		"kiosk",
		"convenience",
		"newsagent",
		"tobacco",
		"lottery",
		"e-cigarette"
	],
	farmacia: [
		"pharmacy",
		"chemist",
		"medical_supply"
	],
	comida: [
		"restaurant",
		"cafe",
		"bar",
		"pub",
		"fast_food",
		"ice_cream",
		"biergarten",
		"bakery",
		"pastry",
		"confectionery",
		"deli"
	],
	almacen: [
		"greengrocer",
		"butcher",
		"food",
		"beverages",
		"alcohol",
		"wine",
		"dairy",
		"frozen_food",
		"cheese",
		"farm"
	],
	ferreteria: [
		"hardware",
		"doityourself",
		"paint",
		"electrical",
		"trade",
		"building_materials",
		"houseware",
		"locksmith"
	],
	ropa: [
		"clothes",
		"shoes",
		"jewelry",
		"optician",
		"boutique",
		"fashion_accessories",
		"bag",
		"cosmetics",
		"perfumery",
		"beauty",
		"hairdresser",
		"sports",
		"toys",
		"gift"
	],
	banco: [
		"bank",
		"money_lender",
		"bureau_de_change"
	],
	taller: [
		"car_repair",
		"car_parts",
		"tyres",
		"motorcycle",
		"car",
		"bicycle",
		"car_rental"
	],
	tecno: [
		"electronics",
		"mobile_phone",
		"computer",
		"appliance",
		"hifi"
	],
	hotel: [
		"hotel",
		"motel",
		"guest_house",
		"hostel"
	],
	hogar: [
		"furniture",
		"bed",
		"interior_decoration"
	],
	flores: ["florist", "garden_centre"],
	libreria: ["books", "stationery"],
	boliche: ["nightclub"],
	super: [
		"supermarket",
		"wholesale",
		"department_store"
	],
	armeria: ["weapons", "hunting"]
}).flatMap(([e, t]) => t.map((t) => [t, e]))), nr = {
	kiosco: {
		w: 3,
		sign: "#c0392b"
	},
	farmacia: {
		w: 5,
		sign: "#1f8a4c"
	},
	comida: {
		w: 6,
		sign: "#7a2b1f"
	},
	almacen: {
		w: 6,
		sign: "#b8431b"
	},
	ferreteria: {
		w: 5,
		sign: "#c46a12"
	},
	ropa: {
		w: 5,
		sign: "#4a2a63"
	},
	banco: {
		w: 7,
		sign: "#1d3f8a"
	},
	taller: {
		w: 6,
		sign: "#3d4a55"
	},
	tecno: {
		w: 4,
		sign: "#1e6f8a"
	},
	local: {
		w: 4.5,
		sign: "#34495e"
	},
	hotel: {
		w: 6,
		sign: "#1f2a3a"
	},
	boliche: {
		w: 9,
		sign: "#6a1b9a"
	},
	super: {
		w: 7,
		sign: "#00796b"
	},
	hogar: {
		w: 7,
		sign: "#8a5a2b"
	},
	flores: {
		w: 4,
		sign: "#2e7d32"
	},
	libreria: {
		w: 4.5,
		sign: "#5d4037"
	},
	armeria: {
		w: 5,
		sign: "#1b1f23"
	}
}, rr = {
	kiosco: "Kiosco",
	farmacia: "Farmacia",
	almacen: "Almacén",
	ferreteria: "Ferretería",
	ropa: "Ropa y accesorios",
	banco: "Banco",
	taller: "Autos y talleres",
	tecno: "Tecnología",
	hotel: "Hotel",
	boliche: "Boliche",
	super: "Supermercado",
	hogar: "Muebles y hogar",
	flores: "Florería",
	libreria: "Librería",
	armeria: "Armería",
	local: "Local"
};
function ir(e) {
	return /fr[aá]vega|garbarino|musimundo|cetrogar|megatone|naldo|on city/i.test(e.name) ? "tecno" : tr[e.kind] || "local";
}
function ar(t, { root: r, graph: a, collision: u, nightMaterials: d }) {
	let f = t.shops || [];
	if (!f.length) return {
		count: 0,
		setNight() {}
	};
	let p = new c(30);
	for (let e of t.buildings) !e.special && e.h >= 3 && p.insert(e, s(e.pts));
	let m = new I();
	for (let n of f) {
		if (ir(n) !== "boliche" || l(p, n.x, n.z, 15)) continue;
		let r = a.nearest(n.x, n.z, 120);
		if (!r) continue;
		let { a: o, b: c } = r.seg, d = Math.hypot(c.x - o.x, c.z - o.z) || 1, f = (c.x - o.x) / d, h = (c.z - o.z) / d, g = r.x - n.x, _ = r.z - n.z, v = Math.hypot(g, _) || 1;
		g /= v, _ /= v;
		let y = r.seg.road.w / 2 + 3, b = r.x - g * y, x = r.z - _ * y, S = (e, t) => [b + f * e - g * t, x + h * e - _ * t], C = [
			S(-9, 0),
			S(9, 0),
			S(9, 14),
			S(-9, 14)
		];
		if (i(C) < 0 && (C = C.reverse()), C.some(([e, t]) => u.isBlocked(e, t, 0))) continue;
		let w = {
			pts: C,
			h: 7,
			levels: 1,
			style: "industrial"
		}, T = new e.Color(.16, .15, .18);
		for (let e = 0; e < 4; e++) {
			let t = C[e], n = C[(e + 1) % 4];
			m.quad([
				t[0],
				0,
				t[1]
			], [
				n[0],
				0,
				n[1]
			], [
				n[0],
				7,
				n[1]
			], [
				t[0],
				7,
				t[1]
			], [0, 0], [1, 0], [1, 1], [0, 1], T, [
				n[1] - t[1],
				0,
				t[0] - n[0]
			]);
		}
		m.quad(...C.map(([e, t]) => [
			e,
			7,
			t
		]), [0, 0], [1, 0], [1, 1], [0, 1], new e.Color(.35, .35, .36), [
			0,
			1,
			0
		]), u.addPolygon(C, 7, "building"), t.buildings.push(w), p.insert(w, s(C));
	}
	if (!m.empty) {
		let t = new e.Mesh(m.geometry(), new e.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .9
		}));
		t.castShadow = t.receiveShadow = !0, r.add(t);
	}
	let h = /* @__PURE__ */ new Map(), g = [];
	for (let e of f) {
		let n = l(p, e.x, e.z, 15);
		if (!n) continue;
		let r = i(n.pts) < 0 ? n.pts.slice().reverse() : n.pts, s = null;
		for (let t = 0; t < r.length; t++) {
			let n = r[t], i = r[(t + 1) % r.length], c = Cn(a, n, i);
			if (!c) continue;
			let [, , l, u] = o(e.x, e.z, n[0], n[1], i[0], i[1]);
			(!s || u < s.d2) && (s = {
				i: t,
				p0: n,
				p1: i,
				t: l,
				d2: u,
				front: c
			});
		}
		if (!s) continue;
		let c = ir(e), { p0: u, p1: d, front: f } = s, m = Math.hypot(d[0] - u[0], d[1] - u[1]), _ = c === "super" && Math.abs(i(n.pts)) >= 1200, v = _ ? Math.min(m - 1, 34) : Math.min(nr[c].w, m - .4);
		if (v < 2.4) continue;
		let y = Math.min(m - v / 2 - .2, Math.max(v / 2 + .2, s.t * m)), b = `${t.buildings.indexOf(n)}:${s.i}`, x = h.get(b) || [], S = (e) => x.some(([t, n]) => e - v / 2 < n && e + v / 2 > t);
		for (let e of [
			0,
			1,
			-1,
			2,
			-2,
			3,
			-3
		]) {
			let t = y + e * (v / 2 + .3);
			if (t - v / 2 >= .2 && t + v / 2 <= m - .2 && !S(t)) {
				y = t;
				break;
			}
			e === -3 && (y = null);
		}
		if (y === null) continue;
		x.push([y - v / 2 - .2, y + v / 2 + .2]), h.set(b, x);
		let C = (d[0] - u[0]) / m, w = (d[1] - u[1]) / m, T = c === "comida" ? Dn(e) : null, E = c === "super" ? Yn(e.name) : null;
		g.push({
			shop: e,
			rubro: c,
			sub: T,
			w: v,
			big: _,
			chain: E,
			building: n,
			room: f.room,
			roof: n.h,
			label: T ? On[T].label : _ ? "Hipermercado" : rr[c],
			signColor: T ? On[T].sign : E ? E.band : nr[c].sign,
			h: Math.min(3.8, n.h - .3),
			x: u[0] + C * y,
			z: u[1] + w * y,
			ux: C,
			uz: w,
			ox: w,
			oz: -C
		});
	}
	let _ = {}, v = {}, y = n(21), b = new e.Color(1, 1, 1);
	for (let e of g) {
		if (e.big) continue;
		let t = e.sub ? `comida:${e.sub}` : e.rubro;
		_[t] || (_[t] = e.sub ? Vn(e.sub) : or(e.rubro), d.push(_[t]), v[t] = new I());
		let n = Math.floor(y() * 4), { x: r, z: i, ux: a, uz: o, ox: s, oz: c, w: l, h: u } = e, f = [r + a * l / 2 + s * .04, i + o * l / 2 + c * .04], p = [r - a * l / 2 + s * .04, i - o * l / 2 + c * .04];
		v[t].quad([
			f[0],
			0,
			f[1]
		], [
			p[0],
			0,
			p[1]
		], [
			p[0],
			u,
			p[1]
		], [
			f[0],
			u,
			f[1]
		], [n / 4, 0], [(n + 1) / 4, 0], [(n + 1) / 4, 1], [n / 4, 1], b, [
			s,
			0,
			c
		]);
	}
	for (let t in v) {
		let n = new e.Mesh(v[t].geometry(), _[t]);
		n.receiveShadow = !0, r.add(n);
	}
	let x = 2048;
	for (let t = 0; t * 408 < g.length; t++) {
		let n = document.createElement("canvas");
		n.width = n.height = x;
		let i = n.getContext("2d");
		i.textAlign = "center", i.textBaseline = "middle";
		let a = new I();
		g.slice(t * 408, (t + 1) * 408).forEach((e, t) => {
			if (e.big) return;
			let n = t % 8 * 256, r = Math.floor(t / 8) * 40;
			i.fillStyle = e.signColor, i.fillRect(n, r, 256, 40), i.fillStyle = "rgba(255,255,255,0.85)", i.fillRect(n, r + 40 - 3, 256, 3), i.fillStyle = "#fff", i.font = "bold 26px Arial, sans-serif", i.fillText(e.shop.name.toUpperCase(), n + 128, r + 20, 242);
			let o = e.w - .2, s = Math.min(.62, o / 5.5), c = e.h - .42, l = e.x + e.ox * .1, u = e.z + e.oz * .1, d = [l + e.ux * o / 2, u + e.uz * o / 2], f = [l - e.ux * o / 2, u - e.uz * o / 2], p = n / x, m = (n + 256) / x, h = 1 - (r + 40) / x, g = 1 - r / x;
			a.quad([
				d[0],
				c - s / 2,
				d[1]
			], [
				f[0],
				c - s / 2,
				f[1]
			], [
				f[0],
				c + s / 2,
				f[1]
			], [
				d[0],
				c + s / 2,
				d[1]
			], [p, h], [m, h], [m, g], [p, g], b, [
				e.ox,
				0,
				e.oz
			]);
		});
		let o = new e.CanvasTexture(n);
		o.colorSpace = e.SRGBColorSpace, o.anisotropy = 8;
		let s = new e.MeshStandardMaterial({
			map: o,
			emissiveMap: o,
			emissive: 16777215,
			emissiveIntensity: 0,
			roughness: .6
		});
		d.push(s), r.add(new e.Mesh(a.geometry(), s));
	}
	let S = new e.Quaternion(), C = new e.Vector3(0, 1, 0);
	new e.Vector3(1, 1, 1);
	let w = (t, [n, r, i, a, o = 1]) => t.compose(new e.Vector3(n, i, r), S.setFromAxisAngle(C, a), new e.Vector3(o, 1, 1)), T = (e, t, n, r = 0) => [
		e.x + e.ux * t + e.ox * n,
		e.z + e.uz * t + e.oz * n,
		r,
		Math.atan2(e.ox, e.oz)
	], E = [], D = [], O = [], k = [];
	n(8);
	let A = (e, t, n) => u.addCircle(e, t, n, "pole");
	for (let e of g) {
		let t = e.shop.kind;
		if (e.rubro === "farmacia" && E.push(T(e, e.w / 2 - .5, .55, e.h - .5)), e.rubro === "kiosco" && e.room > 1.8) {
			let t = T(e, e.w / 2 - .55, .4);
			D.push(t), A(t[0], t[1], .5);
		}
		if (t === "greengrocer" && e.room > 1.8) {
			for (let t = 0; t < 3; t++) O.push([
				...T(e, -e.w / 2 + .6 + t * .7, .35, .15),
				1,
				t
			]);
			let t = T(e, -e.w / 2 + 1.3, .35);
			A(t[0], t[1], .7);
		}
		if (e.rubro === "taller" && e.room > 1.8) {
			let t = T(e, e.w / 2 - .6, .5);
			for (let e = 0; e < 4; e++) k.push([
				t[0],
				t[1],
				.12 + e * .23,
				0
			]);
			A(t[0], t[1], .45);
		}
	}
	let j = new e.MeshStandardMaterial({
		color: 9277587,
		roughness: .55,
		metalness: .45
	}), M = [], N = [], P = [], F = n(31);
	for (let e of g) {
		if (e.big) continue;
		let t = e.h - 1, n = Math.atan2(e.ox, e.oz), r = (t, r, i) => [
			e.x + e.ux * t + e.ox * r,
			e.z + e.uz * t + e.oz * r,
			i,
			n
		];
		M.push([
			...r(0, .11, t),
			e.w - .1,
			.26,
			.22
		]);
		for (let n of [-1, 1]) M.push([
			...r(n * (e.w / 2 - .08), .05, 0),
			.07,
			t,
			.08
		]);
		M.push([
			...r(0, .02, 0),
			e.w,
			.35,
			.06
		]);
		let i = /comida|kiosco|farmacia|boliche|hotel|super/.test(e.rubro), a = +(F() < .06);
		N.push({
			at: r(0, .14, t),
			w: e.w - .2,
			top: t,
			close: i ? F() < .2 ? .55 : 0 : 1,
			always: a
		});
		let o = Math.min(.62, (e.w - .2) / 5.5);
		P.push([
			...r(0, .02, e.h - .42 - o / 2 - .05),
			e.w - .1,
			o + .1,
			.15,
			e.signColor
		]);
	}
	let ee = new e.BoxGeometry(1, 1, 1).translate(0, .5, 0), L = (t, [n, r, i, a, o, s, c]) => t.compose(new e.Vector3(n, i, r), S.setFromAxisAngle(C, a), new e.Vector3(o, s, c));
	Z(r, ee, j, M, L, {
		cast: !0,
		range: 300
	}), Z(r, ee, new e.MeshStandardMaterial({
		color: 16777215,
		roughness: .5
	}), P, L, {
		cast: !0,
		range: 400,
		color: (t) => new e.Color(t[7]).multiplyScalar(.6)
	});
	let R = new e.MeshStandardMaterial({
		map: mr(),
		roughness: .5,
		metalness: .4,
		side: e.DoubleSide
	}), z = new e.InstancedMesh(new e.PlaneGeometry(1, 1).translate(0, -.5, 0), R, N.length);
	z.userData.dynamic = !0, z.frustumCulled = !1, r.add(z);
	let B = new e.Matrix4(), te = -1, V = (t) => {
		Math.abs(t - te) < .03 || (te = t, N.forEach((n, r) => {
			let i = Math.max(n.always, Math.min(1, t * 1.4) * n.close), a = Math.max(.02, i * n.top);
			B.compose(new e.Vector3(n.at[0], n.top, n.at[1]), S.setFromAxisAngle(C, n.at[3]), new e.Vector3(n.w, a, 1)), z.setMatrixAt(r, B);
		}), z.instanceMatrix.needsUpdate = !0);
	};
	V(0);
	let ne = Gn(r, g.filter((e) => !e.big), {
		graph: a,
		collision: u,
		nightMaterials: d
	}), re = Qn(r, g.filter((e) => e.big), {
		collision: u,
		nightMaterials: d
	}), H = new e.MeshStandardMaterial({
		map: hr(),
		emissiveMap: hr(),
		emissive: 3211120,
		emissiveIntensity: .4
	});
	Z(r, new e.BoxGeometry(.08, .8, .8), H, E, w), Z(r, new e.BoxGeometry(.9, .85, .6).translate(0, .425, 0), new e.MeshStandardMaterial({
		map: gr(),
		roughness: .4
	}), D, w, { cast: !0 });
	let ie = [
		12597547,
		15105570,
		6989903
	];
	return Z(r, new e.BoxGeometry(.6, .3, .4), new e.MeshStandardMaterial({
		color: 16777215,
		roughness: .9
	}), O, w, {
		cast: !0,
		color: (t) => new e.Color(ie[t[5]])
	}), Z(r, new e.TorusGeometry(.28, .11, 6, 12).rotateX(Math.PI / 2), new e.MeshStandardMaterial({
		color: 1776411,
		roughness: .95
	}), k, w, { cast: !0 }), {
		count: g.length,
		placed: g,
		setNight(e) {
			V(e), ne.setNight(e), re.setNight(e), H.emissiveIntensity = .4 + e * 2.5;
		}
	};
}
function or(t) {
	let r = document.createElement("canvas"), i = document.createElement("canvas");
	r.width = i.width = 1024, r.height = i.height = 256;
	let a = r.getContext("2d"), o = i.getContext("2d");
	o.fillStyle = "#000", o.fillRect(0, 0, 1024, 256);
	let s = n(t.length * 97);
	for (let e = 0; e < 4; e++) (pr[t] || (t === "super" ? pr.almacen : pr.local))(a, o, e * 256, 256, s);
	let c = new e.CanvasTexture(r), l = new e.CanvasTexture(i);
	return c.colorSpace = l.colorSpace = e.SRGBColorSpace, c.anisotropy = 8, new e.MeshStandardMaterial({
		map: c,
		emissiveMap: l,
		emissive: 16769712,
		emissiveIntensity: 0,
		roughness: .7,
		polygonOffset: !0,
		polygonOffsetFactor: -1
	});
}
var Q = (e, t) => t[Math.floor(e() * t.length)];
function sr(e, t, n, r, i) {
	e.fillStyle = r, e.fillRect(t, 0, n, n), e.fillStyle = i, e.fillRect(t, 0, n, 54), e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(t, 54, n, 3);
}
function cr(e, t, n, r, i, a, o = "#27343c", s = "#ffe7b8") {
	let c = e.createLinearGradient(n, r, n + i, r + a);
	c.addColorStop(0, o), c.addColorStop(1, "#46565f"), e.fillStyle = c, e.fillRect(n, r, i, a), e.fillStyle = "rgba(255,255,255,0.12)", e.beginPath(), e.moveTo(n + i * .1, r + a), e.lineTo(n + i * .35, r), e.lineTo(n + i * .5, r), e.lineTo(n + i * .25, r + a), e.fill(), t.fillStyle = s, t.fillRect(n, r, i, a);
}
function lr(e, t, n, r, i, a, o = "#222") {
	e.fillStyle = o, e.fillRect(n - 4, r - 4, i + 8, a + 4), cr(e, t, n, r, i, a), e.fillStyle = "#bbb", e.fillRect(n + i - 10, r + a / 2, 4, 20);
}
function ur(e, t, n, r, i, a = "#8f9396") {
	e.fillStyle = a, e.fillRect(t, n, r, i), e.fillStyle = "rgba(0,0,0,0.28)";
	for (let a = n; a < n + i; a += 6) e.fillRect(t, a, r, 2);
}
function dr(e, t, n, r, i, a, o) {
	for (let s = n + 8; s < n + i - 6; s += 22) {
		e.fillStyle = "rgba(230,230,230,0.8)", e.fillRect(t + 4, s + 16, r - 8, 3);
		for (let n = t + 6; n < t + r - 10; n += 7 + a() * 5) e.fillStyle = Q(a, o), e.fillRect(n, s + 16 - (8 + a() * 8), 5 + a() * 3, 8 + a() * 8);
	}
}
var fr = [
	"#e53935",
	"#fdd835",
	"#43a047",
	"#1e88e5",
	"#fb8c00",
	"#8e24aa",
	"#ffffff"
], pr = {
	kiosco(e, t, n, r, i) {
		sr(e, n, r, Q(i, [
			"#e9e2d0",
			"#d7dde0",
			"#f1d9b5"
		]), "#3a3a3a"), cr(e, t, n + 14, 72, 140, 130, "#39444a", "#fff3cf"), dr(e, n + 14, 72, 140, 130, i, fr), e.fillStyle = "#1f1f1f";
		for (let t = n + 14; t <= n + 154; t += 12) e.fillRect(t, 72, 3, 130);
		e.fillRect(n + 14, 200, 140, 8), lr(e, t, n + 176, 84, 62, 172, "#1f1f1f");
	},
	farmacia(e, t, n, r, i) {
		sr(e, n, r, "#f5f7f5", "#1f8a4c"), cr(e, t, n + 12, 70, 150, 150, "#dfeee6", "#f4fff8"), dr(e, n + 12, 70, 150, 150, i, [
			"#ffffff",
			"#b8e0c8",
			"#1f8a4c",
			"#90caf9",
			"#f8bbd0"
		]), lr(e, t, n + 178, 70, 66, 186, "#b0b8b4"), e.fillStyle = "#1f8a4c", e.fillRect(n + 12, 226, 150, 8);
	},
	almacen(e, t, n, r, i) {
		sr(e, n, r, Q(i, ["#f0ebe0", "#e0e6ea"]), "#b8431b"), cr(e, t, n + 10, 70, 236, 150, "#3a464c", "#f7f2de"), dr(e, n + 10, 70, 236, 150, i, [
			"#e53935",
			"#fdd835",
			"#43a047",
			"#1e88e5",
			"#ffffff",
			"#8d6e63",
			"#ff7043"
		]), e.fillStyle = "#7a7f82", e.fillRect(n + 10, 220, 236, 36);
	},
	ferreteria(e, t, n, r, i) {
		sr(e, n, r, "#d9d2c4", "#c46a12"), e.fillStyle = "#2b2622", e.fillRect(n + 12, 70, 232, 186), t.fillStyle = "#6a5a40", t.fillRect(n + 12, 120, 232, 136);
		for (let t = 0; t < 16; t++) {
			let r = n + 22 + t % 8 * 28, a = 126 + Math.floor(t / 8) * 56;
			e.fillStyle = Q(i, [
				"#c46a12",
				"#d32f2f",
				"#9e9e9e",
				"#fbc02d",
				"#1565c0"
			]), e.fillRect(r, a, 6, 30), e.fillStyle = "#bdbdbd", e.fillRect(r - 5, a, 16, 7);
		}
		ur(e, n + 12, 70, 232, 52);
	},
	ropa(e, t, n, r, i) {
		sr(e, n, r, Q(i, [
			"#1e1e1e",
			"#f4f4f4",
			"#d8cfc4"
		]), "#111"), cr(e, t, n + 10, 64, 170, 192, "#e8e4df", "#fffaf0");
		for (let t of [
			40,
			95,
			145
		]) e.fillStyle = Q(i, [
			"#c62828",
			"#283593",
			"#f9a825",
			"#2e7d32",
			"#f5f5f5",
			"#212121"
		]), e.beginPath(), e.moveTo(n + t - 16, 120), e.lineTo(n + t + 16, 120), e.lineTo(n + t + 22, 205), e.lineTo(n + t - 22, 205), e.fill(), e.fillStyle = "#d7ccc8", e.beginPath(), e.arc(n + t, 106, 10, 0, Math.PI * 2), e.fill(), e.fillRect(n + t - 2, 205, 4, 40);
		lr(e, t, n + 192, 70, 56, 186, "#111");
	},
	banco(e, t, n, r) {
		sr(e, n, r, "#c9c3b8", "#1d3f8a"), e.fillStyle = "rgba(0,0,0,0.12)";
		for (let t = 60; t < r; t += 32) e.fillRect(n, t, r, 2);
		cr(e, t, n + 20, 70, 120, 186, "#1f2e3a", "#dfe9ff"), e.fillStyle = "#546e7a", e.fillRect(n + 164, 110, 70, 110), e.fillStyle = "#90caf9", e.fillRect(n + 176, 124, 46, 32), t.fillStyle = "#90caf9", t.fillRect(n + 176, 124, 46, 32), e.fillStyle = "#263238", e.fillRect(n + 180, 170, 38, 20);
	},
	taller(e, t, n, r, i) {
		sr(e, n, r, Q(i, ["#bdb6a8", "#9fa6ab"]), "#3d4a55"), e.fillStyle = "#1a1a1a", e.fillRect(n + 10, 66, 236, 190), t.fillStyle = "#403828", t.fillRect(n + 10, 66, 236, 190), e.fillStyle = "#2e2e2e", e.fillRect(n + 10, 66, 236, 26), e.fillStyle = Q(i, [
			"#8a1c1c",
			"#1c3f8a",
			"#c0c0c0"
		]), e.fillRect(n + 50, 150, 150, 40), e.fillRect(n + 80, 128, 90, 26), e.fillStyle = "#111", e.beginPath(), e.arc(n + 80, 192, 14, 0, Math.PI * 2), e.arc(n + 170, 192, 14, 0, Math.PI * 2), e.fill();
	},
	tecno(e, t, n, r, i) {
		sr(e, n, r, "#eceff1", "#1e6f8a"), cr(e, t, n + 10, 70, 170, 150, "#263238", "#e3f2fd");
		for (let t = 0; t < 6; t++) {
			let r = n + 20 + t % 3 * 54, a = 84 + Math.floor(t / 3) * 64;
			e.fillStyle = "#111", e.fillRect(r, a, 44, 50), e.fillStyle = Q(i, [
				"#42a5f5",
				"#66bb6a",
				"#ab47bc",
				"#ffa726"
			]), e.fillRect(r + 3, a + 3, 38, 44);
		}
		lr(e, t, n + 192, 70, 56, 186, "#455a64");
	},
	hotel(e, t, n, r) {
		sr(e, n, r, "#d8d0c2", "#1f2a3a"), e.fillStyle = "rgba(0,0,0,0.1)";
		for (let t = 60; t < r; t += 28) e.fillRect(n, t, r, 2);
		cr(e, t, n + 70, 74, 116, 182, "#3a3226", "#ffe2a8"), e.fillStyle = "#b8963e", e.fillRect(n + 64, 68, 128, 6), e.fillRect(n + 64, 68, 6, 188), e.fillRect(n + 186, 68, 6, 188), e.fillRect(n + 125, 74, 6, 182), e.fillStyle = "rgba(60,40,20,0.6)", e.fillRect(n + 90, 190, 76, 30);
		for (let r of [n + 14, n + 206]) cr(e, t, r, 90, 36, 110, "#2a3440", "#ffe2a8");
	},
	hogar(e, t, n, r, i) {
		sr(e, n, r, Q(i, ["#efe9df", "#e2e6e8"]), "#8a5a2b"), cr(e, t, n + 10, 66, 236, 154, "#e9e2d6", "#fff6e0"), e.fillStyle = Q(i, [
			"#6d4c41",
			"#37474f",
			"#8d6e63"
		]), e.fillRect(n + 24, 170, 90, 30), e.fillRect(n + 24, 150, 90, 22), e.fillRect(n + 18, 160, 10, 40), e.fillRect(n + 110, 160, 10, 40), e.fillStyle = "#f4f4f4", e.fillRect(n + 140, 176, 96, 24), e.fillStyle = Q(i, [
			"#1e5bb8",
			"#c2477a",
			"#3aa7a3"
		]), e.fillRect(n + 140, 168, 96, 10), e.fillStyle = "#5d4037", e.fillRect(n + 140, 146, 8, 54), e.fillStyle = "#ffe082", e.beginPath(), e.moveTo(n + 128, 110), e.lineTo(n + 148, 110), e.lineTo(n + 142, 96), e.lineTo(n + 134, 96), e.fill(), e.fillStyle = "#7a7f82", e.fillRect(n + 10, 220, 236, 36);
	},
	flores(e, t, n, r, i) {
		sr(e, n, r, "#e8efe2", "#2e7d32"), cr(e, t, n + 12, 70, 160, 150, "#2f4a32", "#f6ffe8");
		for (let t = 0; t < 70; t++) e.fillStyle = t % 3 ? Q(i, [
			"#e53935",
			"#f06292",
			"#fdd835",
			"#ffffff",
			"#ab47bc",
			"#ff7043"
		]) : "#3f7a2f", e.beginPath(), e.arc(n + 20 + i() * 144, 90 + i() * 120, 4 + i() * 5, 0, Math.PI * 2), e.fill();
		lr(e, t, n + 186, 70, 60, 186, "#2e7d32");
	},
	libreria(e, t, n, r, i) {
		sr(e, n, r, Q(i, ["#efe6d6", "#e3dccf"]), "#5d4037"), cr(e, t, n + 12, 70, 160, 150, "#3a3026", "#fff1d0");
		for (let t = 82; t < 210; t += 32) {
			e.fillStyle = "#6d4c41", e.fillRect(n + 16, t + 26, 152, 4);
			for (let r = n + 18; r < n + 164; r += 6 + i() * 4) e.fillStyle = Q(i, [
				"#c62828",
				"#1e5bb8",
				"#2e7d32",
				"#f9a825",
				"#4e342e",
				"#6a1b9a",
				"#eeeeee"
			]), e.fillRect(r, t + 26 - (16 + i() * 9), 5, 16 + i() * 9);
		}
		lr(e, t, n + 186, 70, 60, 186, "#5d4037");
	},
	boliche(e, t, n, r, i) {
		sr(e, n, r, "#0d0d12", "#000");
		let a = Q(i, [
			["#ff3fd0", "#3fe6ff"],
			["#a64dff", "#ffe03f"],
			["#ff4d4d", "#4dff9a"]
		]);
		for (let [i, o] of [[64, a[0]], [236, a[1]]]) e.fillStyle = o, e.fillRect(n, i, r, 5), t.fillStyle = o, t.fillRect(n, i - 2, r, 9);
		for (let r = 0; r < 6; r++) e.fillStyle = t.fillStyle = a[r % 2], e.fillRect(n + 8 + r * 42, 80, 3, 140), t.fillRect(n + 7 + r * 42, 80, 5, 140);
		e.fillStyle = "#1a1a22", e.fillRect(n + 70, 96, 116, 140), e.fillStyle = "#2b2b38", e.fillRect(n + 74, 100, 52, 136), e.fillRect(n + 130, 100, 52, 136), e.fillStyle = "#c0c4c8", e.fillRect(n + 120, 160, 4, 20), e.fillRect(n + 132, 160, 4, 20), cr(e, t, n + 200, 130, 44, 40, "#2a1f30", "#ff9ad0"), e.fillStyle = "#fff", e.font = "bold 9px Arial", e.textAlign = "center", e.fillText("BOLETERÍA", n + 222, 182);
	},
	armeria(e, t, n, r, i) {
		sr(e, n, r, Q(i, ["#2b2e31", "#3a332c"]), "#1b1f23"), cr(e, t, n + 12, 70, 160, 150, "#1c2226", "#f2e6c8");
		for (let t = 0; t < 6; t++) {
			let r = n + 24 + t * 25;
			e.fillStyle = "#4a3020", e.fillRect(r, 150, 7, 50), e.fillStyle = "#1a1a1a", e.fillRect(r + 2, 82, 3, 72);
		}
		e.fillStyle = "#111";
		for (let t = n + 12; t <= n + 172; t += 10) e.fillRect(t, 70, 2, 150);
		e.fillStyle = "#6d6d6d", e.fillRect(n + 12, 220, 160, 36), lr(e, t, n + 186, 70, 60, 186, "#111");
	},
	local(e, t, n, r, i) {
		sr(e, n, r, Q(i, [
			"#e6e0d4",
			"#d9dfe3",
			"#efe3c8"
		]), "#444"), cr(e, t, n + 12, 70, 160, 150), e.fillStyle = "#6d6d6d", e.fillRect(n + 12, 220, 160, 36), lr(e, t, n + 186, 70, 60, 186);
	}
};
function mr() {
	let t = document.createElement("canvas");
	t.width = 128, t.height = 256;
	let r = t.getContext("2d"), i = n(55);
	r.fillStyle = "#a3a6a8", r.fillRect(0, 0, 128, 256);
	for (let e = 0; e < 256; e += 8) {
		let t = r.createLinearGradient(0, e, 0, e + 8);
		t.addColorStop(0, "rgba(255,255,255,0.35)"), t.addColorStop(.6, "rgba(0,0,0,0.05)"), t.addColorStop(1, "rgba(0,0,0,0.35)"), r.fillStyle = t, r.fillRect(0, e, 128, 8);
	}
	for (let e = 0; e < 10; e++) r.fillStyle = `rgba(120,70,30,${.1 + i() * .2})`, r.fillRect(i() * 128, 200 + i() * 56, 4 + i() * 14, 2 + i() * 6);
	r.strokeStyle = "rgba(30,30,120,0.55)", r.lineWidth = 4, r.beginPath(), r.moveTo(20, 150);
	for (let e = 0; e < 6; e++) r.quadraticCurveTo(28 + e * 15, 120 + i() * 30, 34 + e * 15, 150 + i() * 20);
	r.stroke(), r.fillStyle = "#3b3b3b", r.fillRect(0, 248, 128, 8);
	let a = new e.CanvasTexture(t);
	return a.colorSpace = e.SRGBColorSpace, a;
}
function hr() {
	let t = document.createElement("canvas");
	t.width = t.height = 64;
	let n = t.getContext("2d");
	n.fillStyle = "#0d3b1f", n.fillRect(0, 0, 64, 64), n.fillStyle = "#2ee66b", n.fillRect(22, 6, 20, 52), n.fillRect(6, 22, 52, 20);
	let r = new e.CanvasTexture(t);
	return r.colorSpace = e.SRGBColorSpace, r;
}
function gr() {
	let t = document.createElement("canvas");
	t.width = 128, t.height = 128;
	let n = t.getContext("2d");
	n.fillStyle = "#f4f7fb", n.fillRect(0, 0, 128, 128), n.fillStyle = "#1e5bb8", n.fillRect(0, 0, 128, 34), n.fillStyle = "#fff", n.font = "bold 22px Arial, sans-serif", n.textAlign = "center", n.fillText("HELADOS", 64, 25);
	let r = new e.CanvasTexture(t);
	return r.colorSpace = e.SRGBColorSpace, r;
}
//#endregion
//#region src/entities/train.js
var _r = 20, vr = 6, yr = 2.9, br = 17, xr = 18;
function Sr(n) {
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
	l(r, yr, 2.9, _r, 0, 2.55, 0), l(o, 2.94, .9, 17, 0, 2.9, 0), l(i, 2.9499999999999997, .28, _r, 0, 2.2, 0), l(a, 2.9499999999999997, .12, _r, 0, 1.95, 0), l(s, 2.6, .5, 19, 0, .85, 0);
	for (let e of [-7, _r / 2 - 3]) for (let t of [-1, 1]) l(s, .08, 2.1, 1.3, t * 1.47, 2.25, e);
	l(s, .3, .4, .3, 0, 4.2, 0), n && (l(o, 2.6, 1.2, .1, 0, 3.1, 10.02), l(i, yr, .6, .12, 0, 1.9, 10.03), l(new e.MeshStandardMaterial({
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
var Cr = class {
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
}, wr = class {
	constructor(t, n) {
		this.trains = [];
		let r = (n.rails || []).map((e) => new Cr(e.pts)).filter((e) => e.length > 800).sort((e, t) => t.length - e.length).slice(0, 2), i = (n.specials || []).filter((e) => e.type === "station");
		r.forEach((n, r) => {
			let a = i.map((e) => n.project(e.cx, e.cz)).filter((e) => e.d < 25).map((e) => e.s).sort((e, t) => e - t), o = [];
			for (let n = 0; n < vr; n++) {
				let r = Sr(n === 0 || n === 5);
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
				v: br,
				wait: 0
			});
		});
	}
	update(e) {
		let t = [];
		for (let n of this.trains) {
			let r = vr * 20.8;
			if (n.wait > 0) n.wait -= e, n.v = 0;
			else {
				let t = n.stops.map((e) => (e - n.s) * n.dir).filter((e) => e > 1).sort((e, t) => e - t)[0], i = n.dir > 0 ? n.track.length - n.s : n.s - r, a = Math.min(t ?? Infinity, i), o = a < 120 ? Math.max(1.5, Math.sqrt(2.2 * Math.max(0, a))) : br;
				n.v += Math.sign(o - n.v) * Math.min(Math.abs(o - n.v), 1.1 * e), n.s += n.dir * n.v * e, t !== void 0 && t < 1.5 && (n.wait = xr, n.s = n.stops.find((e) => Math.abs(e - n.s) < 2) ?? n.s), i < 1 && (n.dir = -n.dir, n.s = n.dir > 0 ? n.s - r : n.s + r, n.wait = xr);
			}
			n.cars.forEach((e, r) => {
				let i = n.s - n.dir * (r * 20.8 + _r / 2), a = n.track.at(i), o = a.dx * n.dir, s = a.dz * n.dir;
				e.position.set(a.x, 0, a.z), e.rotation.y = Math.atan2(o, s), t.push({
					x: a.x,
					z: a.z,
					dx: o,
					dz: s,
					hl: _r / 2,
					hw: yr / 2,
					vx: o * n.v,
					vz: s * n.v
				});
			});
		}
		return t;
	}
}, Tr = new e.CylinderGeometry(.34, .34, .24, 14);
Tr.rotateZ(Math.PI / 2);
var Er = new e.MeshStandardMaterial({
	color: 1776411,
	roughness: .9
}), Dr = new e.MeshStandardMaterial({
	color: 1911347,
	roughness: .1,
	metalness: .6
}), Or = new e.MeshStandardMaterial({
	color: 12567752,
	roughness: .3,
	metalness: .9
}), kr = new e.MeshStandardMaterial({
	color: 16777215,
	emissive: 16773836,
	emissiveIntensity: .3
}), Ar = new e.MeshStandardMaterial({ color: 15921906 });
function jr(e) {
	if (e) {
		if (e.isObject3D) return e.traverse((e) => {
			jr(e.geometry), [].concat(e.material || []).forEach(jr);
		});
		if (e.userData.keep = !0, e.isMaterial) for (let t of Object.values(e)) t?.isTexture && (t.userData.keep = !0);
	}
}
[
	Tr,
	Er,
	Dr,
	Or,
	kr,
	Ar
].forEach(jr);
var Mr = {
	sedan: {
		length: 4.5,
		width: 1.8,
		height: 1.45,
		maxSpeed: 46,
		accel: 7.5,
		mass: 1.2,
		colors: [
			12106944,
			2764081,
			15132390,
			8199453,
			2046822,
			5988195,
			10260346,
			4020794
		]
	},
	hatch: {
		length: 3.9,
		width: 1.72,
		height: 1.5,
		maxSpeed: 40,
		accel: 7,
		mass: 1,
		colors: [
			13685718,
			10689564,
			3038346,
			15790320,
			3355443,
			13214247
		]
	},
	pickup: {
		length: 5.2,
		width: 1.9,
		height: 1.8,
		maxSpeed: 42,
		accel: 6.5,
		mass: 1.6,
		colors: [
			15790320,
			7040624,
			1710618,
			8018486
		]
	},
	taxi: {
		length: 4.5,
		width: 1.8,
		height: 1.45,
		maxSpeed: 44,
		accel: 7.2,
		mass: 1.2,
		colors: [1118481]
	},
	bus: {
		length: 11.5,
		width: 2.55,
		height: 3.1,
		maxSpeed: 26,
		accel: 3.2,
		mass: 5,
		colors: [
			13709359,
			2843312,
			15906565,
			3116878,
			14904094
		]
	},
	police: {
		length: 4.6,
		width: 1.82,
		height: 1.5,
		maxSpeed: 52,
		accel: 8.8,
		mass: 1.3,
		colors: [16053492]
	}
}, Nr = {}, Pr = [];
function Fr(t, n) {
	let r = t.cell.join() + n;
	if (t.variants.has(r)) return t.variants.get(r);
	let i = t.material.map;
	if (t.mean === void 0) {
		let n = i.image, r = document.createElement("canvas");
		r.width = 8, r.height = 4;
		let a = r.getContext("2d", { willReadFrequently: !0 });
		a.drawImage(n, 0, 0, 8, 4);
		let o = a.getImageData(t.cell[0], t.cell[1], 1, 1).data;
		t.mean = Math.max(1, (o[0] + o[1] + o[2]) / 3) / 255, i.magFilter = i.minFilter = e.NearestFilter, i.needsUpdate = !0;
	}
	let a = i.flipY ? 1 - (t.cell[1] + 1) / 4 : t.cell[1] / 4, o = new e.Vector4(t.cell[0] / 8, a, (t.cell[0] + 1) / 8, a + .25), s = new e.Color(n), c = t.mean, l = t.material.clone();
	return l.onBeforeCompile = (e) => {
		e.uniforms.paintCell = { value: o }, e.uniforms.paintColor = { value: s }, e.uniforms.paintMean = { value: c }, e.fragmentShader = "uniform vec4 paintCell;\nuniform vec3 paintColor;\nuniform float paintMean;\n" + e.fragmentShader.replace("#include <map_fragment>", "\n      vec4 sampledDiffuseColor = texture2D(map, vMapUv);\n      if (all(greaterThanEqual(vMapUv, paintCell.xy)) && all(lessThan(vMapUv, paintCell.zw))) {\n        float k = dot(pow(sampledDiffuseColor.rgb, vec3(1.0 / 2.2)), vec3(1.0 / 3.0)) / paintMean;\n        sampledDiffuseColor.rgb = pow(min(vec3(1.0), paintColor * k), vec3(2.2));\n      }\n      diffuseColor *= sampledDiffuseColor;");
	}, l.customProgramCacheKey = () => "paintCell", jr(l), t.variants.set(r, l), l;
}
function Ir(t, n, r) {
	let i = Nr[t], a = new e.Group(), o = i.scene.clone(!0), s = r.length / i.size.z;
	o.scale.setScalar(s);
	let c = t === "police" ? i.material : Fr(i, n), l = [];
	o.traverse((e) => {
		e.isMesh && (e.material = c, e.castShadow = !0);
	});
	for (let t of [...o.children]) {
		if (!/^wheel-(front|back)-(left|right)$/.test(t.name)) continue;
		let n = new e.Group();
		n.position.copy(t.position), t.position.set(0, 0, 0), o.add(n), n.add(t), l.push(n);
	}
	l.sort((e, t) => t.position.z - e.position.z), a.add(o);
	let u = r.length, d = i.size.x * s, f = i.size.y * s * .45;
	for (let t of [-d / 2 + .3, d / 2 - .3]) {
		let n = new e.Mesh(new e.BoxGeometry(.3, .12, .04), kr);
		n.position.set(t, f, u / 2 - .02), a.add(n);
	}
	let p = new e.MeshStandardMaterial({
		color: 5570560,
		emissive: 16711680,
		emissiveIntensity: .25
	});
	for (let t of [-d / 2 + .25, d / 2 - .25]) {
		let n = new e.Mesh(new e.BoxGeometry(.28, .12, .04), p);
		n.position.set(t, f, -u / 2 + .02), a.add(n);
	}
	if (a.userData.tail = p, t === "police") {
		let t = new e.MeshStandardMaterial({
			color: 5570560,
			emissive: 16715792,
			emissiveIntensity: 0
		}), n = new e.MeshStandardMaterial({
			color: 85,
			emissive: 1065215,
			emissiveIntensity: 0
		}), r = new e.Group();
		for (let [i, a] of [[t, -.3], [n, .3]]) {
			let t = new e.Mesh(new e.BoxGeometry(.5, .12, .24), i);
			t.position.x = a, r.add(t);
		}
		r.position.set(0, i.size.y * s + .04, -.1), a.add(r), a.userData.siren = {
			red: t,
			blu: n
		};
	}
	return a.userData.wheels = l, a.userData.spec = r, a;
}
var Lr = (t, n = {}) => new e.MeshStandardMaterial({
	color: t,
	roughness: .45,
	metalness: .2,
	side: e.DoubleSide,
	...n
}), Rr = {
	Windows: Lr(1911347, {
		roughness: .1,
		metalness: .6
	}),
	Lights: kr,
	Bumper: Lr(2829616, { roughness: .7 }),
	Material: Er
};
function zr(t, n) {
	let r = Nr.bus, [i, a, o] = typeof t == "object" ? t : [
		15921906,
		t,
		2236962
	], s = {
		Top: Lr(i),
		Bottom: Lr(a),
		Details: Lr(o)
	}, c = new e.Group(), l = new e.Mesh(r.body.geometry, r.body.materials.map((e) => Rr[e] || s[e] || s.Bottom));
	return l.castShadow = !0, c.add(l), c.userData.wheels = r.axles.map((t) => {
		let n = new e.Group();
		n.position.copy(t.center);
		let r = new e.Mesh(t.geometry, Er);
		return r.castShadow = !0, n.add(r), c.add(n), n;
	}), c.userData.steer = 1, c.userData.spec = n, c;
}
new e.MeshStandardMaterial({
	vertexColors: !0,
	roughness: .45,
	metalness: .4
});
var Br = /* @__PURE__ */ new Map();
function Vr(t, n, r) {
	let i = `${n.uuid}:${r}`;
	if (t.paints.has(i)) return t.paints.get(i);
	let a = n.clone();
	if (a.color = new e.Color(r), n.map) {
		if (!Br.has(n.map)) {
			let e = n.map.image, t = document.createElement("canvas");
			t.width = t.height = 16;
			let r = t.getContext("2d", { willReadFrequently: !0 });
			r.drawImage(e, 0, 0, 16, 16);
			let i = r.getImageData(0, 0, 16, 16).data, a = 0;
			for (let e = 0; e < i.length; e += 4) a += (i[e] + i[e + 1] + i[e + 2]) / 3;
			Br.set(n.map, 235 / Math.max(1, a / (i.length / 4)));
		}
		let e = Br.get(n.map);
		a.onBeforeCompile = (t) => {
			t.uniforms.greyScale = { value: e }, t.fragmentShader = "uniform float greyScale;\n" + t.fragmentShader.replace("#include <map_fragment>", "\n        vec4 sampledDiffuseColor = texture2D(map, vMapUv);\n        float greyPaint = min(1.0, dot(pow(sampledDiffuseColor.rgb, vec3(1.0 / 2.2)), vec3(1.0 / 3.0)) * greyScale);\n        diffuseColor *= vec4(vec3(pow(greyPaint, 2.2)), sampledDiffuseColor.a);");
		}, a.customProgramCacheKey = () => "greyPaint";
	}
	return jr(a), t.paints.set(i, a), a;
}
function Hr(t, n, r) {
	let i = Pr.filter((e) => e.types.includes(t)), a = i[Math.floor(Math.random() * i.length)], o = new e.Group(), s = a.scene.clone(!0), c = [];
	if (s.traverse((e) => {
		e.isMesh && (e.castShadow = !0, /^paint/.test(e.material.name) && (e.material = Vr(a, e.material, t === "taxi" ? 1118481 : n))), /^wheel-(front|back)-(left|right)$/.test(e.name) && c.push(e);
	}), c.sort((e, t) => t.position.z - e.position.z), o.add(s), t === "taxi") {
		let t = new e.Mesh(new e.BoxGeometry(.75, .2, .28), new e.MeshStandardMaterial({
			color: 16765952,
			emissive: 16760832,
			emissiveIntensity: .4
		}));
		t.position.set(0, a.size.y + .1, -.2), o.add(t);
	}
	if (t === "police") {
		let t = new e.MeshStandardMaterial({
			color: 5570560,
			emissive: 16715792,
			emissiveIntensity: 0
		}), n = new e.MeshStandardMaterial({
			color: 85,
			emissive: 1065215,
			emissiveIntensity: 0
		}), r = new e.Group();
		for (let [i, a] of [[t, -.3], [n, .3]]) {
			let t = new e.Mesh(new e.BoxGeometry(.5, .12, .24), i);
			t.position.x = a, r.add(t);
		}
		r.position.set(0, a.size.y + .02, -.2), o.add(r), o.userData.siren = {
			red: t,
			blu: n
		};
	}
	return o.userData.wheels = c, o.userData.spec = {
		...r,
		length: a.size.z,
		width: a.size.x * .9,
		height: a.size.y
	}, o;
}
function Ur(t, n) {
	let r = Mr[t];
	if (Pr.some((e) => e.types.includes(t))) return Hr(t, t === "police" ? 16053492 : n, r);
	if (t === "bus" && Nr.bus) return zr(n, r);
	if (Nr[t] && t !== "bus") return Ir(t, n, r);
	typeof n == "object" && (n = n[1]);
	let i = new e.Group(), a = new e.MeshStandardMaterial({
		color: n,
		roughness: .35,
		metalness: .4
	}), o = r.length, s = r.width, c = r.height, l = (t, n, r, a, o) => {
		let s = new e.Mesh(t, n);
		return s.position.set(r, a, o), s.castShadow = !0, i.add(s), s;
	};
	if (t === "bus") {
		l(new e.BoxGeometry(s, c - .5, o), a, 0, .35 + (c - .5) / 2, 0);
		let t = new e.MeshStandardMaterial({
			color: 15921906,
			roughness: .4
		});
		l(new e.BoxGeometry(s + .02, .35, o - .2), t, 0, c - .55, 0), l(new e.BoxGeometry(s + .04, 1, o - 2.2), Dr, 0, 1.95, -.4), l(new e.BoxGeometry(s - .2, 1.3, .05), Dr, 0, 1.9, o / 2 + .01);
		let n = new e.Mesh(new e.PlaneGeometry(1.6, .35), Kr(String([
			85,
			98,
			148,
			159,
			257,
			278,
			324,
			582
		][Math.floor(Math.random() * 8)])));
		n.position.set(0, c - .3, o / 2 + .03), i.add(n);
		for (let e of [o / 2 - 2.2, -o / 2 + 2.6]) for (let t of [-s / 2 + .15, s / 2 - .15]) Gr(i, t, e, .5);
	} else {
		let n = t === "pickup" ? .75 : .62;
		l(new e.BoxGeometry(s, n, o), a, 0, .35 + n / 2, 0);
		let r = t === "pickup" ? o * .38 : t === "hatch" ? o * .55 : o * .48, u = t === "pickup" ? o * .08 : t === "hatch" ? -o * .08 : -o * .04, d = c - .35 - n, f = t === "taxi" ? new e.MeshStandardMaterial({
			color: 16106496,
			roughness: .4,
			metalness: .3
		}) : a;
		if (l(new e.BoxGeometry(s * .86, d, r), Dr, 0, .35 + n + d / 2, u), l(new e.BoxGeometry(s * .87, .08, r * .92), f, 0, .35 + n + d, u), t === "pickup") {
			let t = new e.MeshStandardMaterial({ color: 2236962 });
			l(new e.BoxGeometry(s * .9, .05, o * .36), t, 0, .35 + n + .01, -o * .28);
		}
		if (t === "police") {
			let t = new e.MeshStandardMaterial({
				color: 1196172,
				roughness: .4
			});
			l(new e.BoxGeometry(s + .02, .22, o * .7), t, 0, .35 + n * .55, 0);
			let r = new e.Group(), a = new e.MeshStandardMaterial({
				color: 5570560,
				emissive: 16715792,
				emissiveIntensity: 0
			}), c = new e.MeshStandardMaterial({
				color: 85,
				emissive: 1065215,
				emissiveIntensity: 0
			}), f = new e.Mesh(new e.BoxGeometry(.55, .14, .26), a);
			f.position.x = -.32;
			let p = new e.Mesh(new e.BoxGeometry(.55, .14, .26), c);
			p.position.x = .32, r.add(f, p), r.position.set(0, .35 + n + d + .1, u), i.add(r), i.userData.siren = {
				red: a,
				blu: c
			};
		}
		if (t === "taxi") {
			let t = l(new e.BoxGeometry(.8, .22, .3), new e.MeshStandardMaterial({
				color: 16777215,
				emissive: 16765514,
				emissiveIntensity: .4
			}), 0, .35 + n + d + .15, u);
			t.castShadow = !1;
		}
		for (let t of [-s / 2 + .3, s / 2 - .3]) l(new e.BoxGeometry(.35, .14, .05), kr, t, .35 + n * .7, o / 2 + .01);
		let p = new e.MeshStandardMaterial({
			color: 5570560,
			emissive: 16711680,
			emissiveIntensity: .25
		});
		for (let t of [-s / 2 + .25, s / 2 - .25]) l(new e.BoxGeometry(.3, .14, .05), p, t, .35 + n * .7, -o / 2 - .01);
		i.userData.tail = p, l(new e.BoxGeometry(s * .9, .12, .1), Or, 0, .42, o / 2 + .03), l(new e.BoxGeometry(s * .9, .12, .1), Or, 0, .42, -o / 2 - .03), l(new e.BoxGeometry(.5, .13, .02), Ar, 0, .55, -o / 2 - .06);
		let m = o * .32;
		for (let e of [m, -m]) for (let t of [-s / 2 + .12, s / 2 - .12]) Gr(i, t, e, .34);
	}
	return i.userData.spec = r, Wr(i), i;
}
function Wr(n) {
	let r = new Set(n.userData.wheels || []), i = /* @__PURE__ */ new Map();
	for (let e of [...n.children]) {
		if (!e.isMesh || r.has(e)) continue;
		e.updateMatrix();
		let t = e.geometry.index ? e.geometry.toNonIndexed() : e.geometry.clone();
		for (let e of Object.keys(t.attributes)) [
			"position",
			"normal",
			"uv"
		].includes(e) || t.deleteAttribute(e);
		t.applyMatrix4(e.matrix), i.has(e.material) || i.set(e.material, []), i.get(e.material).push(t), n.remove(e);
	}
	for (let [r, a] of i) {
		let i = new e.Mesh(t(a), r);
		i.castShadow = !0, n.add(i);
	}
}
function Gr(t, n, r, i) {
	let a = new e.Mesh(Tr, Er);
	return a.scale.setScalar(i / .34), a.position.set(n, i, r), a.castShadow = !0, t.add(a), (t.userData.wheels ||= []).push(a), a;
}
function Kr(t) {
	let n = document.createElement("canvas");
	n.width = 256, n.height = 56;
	let r = n.getContext("2d");
	r.fillStyle = "#111", r.fillRect(0, 0, 256, 56), r.fillStyle = "#ffb000", r.font = "bold 40px monospace", r.textAlign = "center", r.textBaseline = "middle", r.fillText(`${t}  QUILMES`, 128, 30, 240);
	let i = new e.CanvasTexture(n);
	return i.colorSpace = e.SRGBColorSpace, new e.MeshStandardMaterial({
		map: i,
		emissive: 16777215,
		emissiveMap: i,
		emissiveIntensity: .6
	});
}
//#endregion
//#region src/entities/vehicle.js
var qr = 1, Jr = class {
	constructor(e, t, n, r, i) {
		this.id = qr++, this.type = e, this.spec = Mr[e], i ??= this.spec.colors[Math.floor(Math.random() * this.spec.colors.length)], this.mesh = Ur(e, i), this.lodColor = typeof i == "object" ? i[1] : i, this.spec = this.mesh.userData.spec || this.spec, this.x = t, this.z = n, this.heading = r, this.vx = 0, this.vz = 0, this.steer = 0, this.wheelSpin = 0, this.health = 100, this.driver = null, this.braking = !1, this.y = 0, this.pitch = 0, this.mesh.position.set(t, 0, n), this.mesh.rotation.y = r;
	}
	get speed() {
		return Math.sin(this.heading) * this.vx + Math.cos(this.heading) * this.vz;
	}
	get radius() {
		return this.spec.width / 2 + .05;
	}
	circles() {
		let e = this.spec.length / 2 - this.spec.width / 2, t = Math.sin(this.heading), n = Math.cos(this.heading), r = this.type === "bus" ? 3 : 2, i = [];
		for (let a = 0; a < r; a++) {
			let o = r === 2 ? a ? -1 : 1 : 1 - a;
			i.push([this.x + t * e * o, this.z + n * e * o]);
		}
		return i;
	}
	update(t, n, r) {
		let i = this.spec, a = Math.sin(this.heading), o = Math.cos(this.heading), s = a * this.vx + o * this.vz, c = Math.abs(s), l = e.MathUtils.lerp(.62, .14, Math.min(1, c / i.maxSpeed)), u = n.steer * l;
		this.steer += (u - this.steer) * Math.min(1, t * 8);
		let d = i.length * .62, f = s / d * Math.tan(this.steer);
		n.handbrake && c > 4 && (f *= 1.35), this.heading += f * t;
		let p = Math.sin(this.heading), m = Math.cos(this.heading), h = m, g = -p;
		s = p * this.vx + m * this.vz;
		let _ = h * this.vx + g * this.vz;
		if (this.braking = !1, n.throttle > 0) {
			let e = i.accel * n.throttle * (1 - Math.max(0, s) / i.maxSpeed);
			s += (s < -.5 ? i.accel * 2 : e) * t;
		}
		n.brake > 0 && (s > .5 ? (s -= 16 * n.brake * t, this.braking = !0) : s > -i.maxSpeed * .3 && (s -= i.accel * .6 * n.brake * t)), n.handbrake && (s -= Math.sign(s) * Math.min(Math.abs(s), 6 * t), this.braking = !0), s -= s * (.12 + Math.abs(s) * .004) * t, !n.throttle && !n.brake && Math.abs(s) < .3 && (s = 0);
		let v = n.handbrake ? 1.6 : 11;
		_ *= Math.exp(-v * t), this.vx = p * s + h * _, this.vz = m * s + g * _, this.x += this.vx * t, this.z += this.vz * t;
		let y = 0;
		if (r) for (let e = 0; e < 2; e++) for (let [e, t] of this.circles()) {
			let n = r.resolve(e, t, this.radius, Math.abs(this.y) > 1 ? vt : void 0);
			if (!n.hit) continue;
			this.x += n.x - e, this.z += n.z - t;
			let i = this.vx * n.nx + this.vz * n.nz;
			i < 0 && (y = Math.max(y, -i), this.vx -= 1.3 * i * n.nx, this.vz -= 1.3 * i * n.nz, this.vx *= .8, this.vz *= .8);
		}
		if (y > 6 && (this.health = Math.max(0, this.health - (y - 6) * 2)), r?.levelAt) {
			let e = Math.sin(this.heading), n = Math.cos(this.heading), i = r.levelAt(this.x, this.z, e, n, this.y) ?? 0, a = r.levelAt(this.x + e * 2, this.z + n * 2, e, n, this.y) ?? 0;
			this.y += (i - this.y) * Math.min(1, t * 14), this.pitch += (-Math.atan((a - i) / 2) - this.pitch) * Math.min(1, t * 10);
		}
		return this.wheelSpin += s * t / .34, this.sync(), y;
	}
	sync() {
		this.mesh.position.set(this.x, this.y, this.z), this.mesh.rotation.set(this.pitch, this.heading, 0, "YXZ"), (this.mesh.userData.wheels || []).forEach((e, t) => {
			e.rotation.x = this.wheelSpin, t < (this.mesh.userData.steer ?? 2) && (e.rotation.y = this.steer);
		}), this.mesh.userData.tail && (this.mesh.userData.tail.emissiveIntensity = this.braking ? 2.5 : .35);
	}
}, Yr = new e.MeshStandardMaterial({
	vertexColors: !0,
	roughness: .78,
	metalness: 0
}), Xr = [
	16109744,
	15384736,
	14263422,
	13012578,
	11038026,
	9263675,
	7029808
], Zr = [
	1774865,
	1774865,
	3022612,
	4861984,
	7031339,
	9071173,
	12098154,
	8010526
], Qr = [
	12105912,
	14342874,
	9408399,
	15658734
], $r = [
	16777215,
	15328472,
	7711451,
	1916794,
	12597547,
	3046706,
	2236962,
	15844367,
	9323693,
	8359053,
	15105570,
	13920922,
	3829413,
	5597999,
	10167093,
	2792847
], ei = [
	2899558,
	3889802,
	2042436,
	4876954,
	2372946
], ti = [
	2829099,
	4868682,
	7035717,
	12759680,
	4013357,
	1908004
], ni = [
	15921906,
	15921906,
	2236962,
	12597547,
	3038346,
	10132122,
	3046706
], ri = [
	1916794,
	12597547,
	2236962,
	15921906,
	3046706,
	15844367
], ii = [
	2236962,
	1916794,
	8007214,
	5597999,
	7031339,
	13920922
], $ = {
	root: 0,
	pelvis: 1,
	spine: 2,
	head: 3,
	shL: 4,
	elL: 5,
	shR: 6,
	elR: 7,
	hipL: 8,
	knL: 9,
	anL: 10,
	hipR: 11,
	knR: 12,
	anR: 13
}, ai = .95, oi = new e.Color();
new e.Matrix4(), new e.Quaternion();
var si = new e.Vector3(), ci = new e.Vector3(0, 1, 0);
function li(e, t) {
	let n = [];
	for (let r = 0; r < e.length - 1; r++) {
		let [i, a] = e[r], [o, s] = e[r + 1], c = Math.max(1, Math.round(Math.hypot(o - i, s - a) / .6 * t));
		for (let e = 0; e < c; e++) n.push([i + (o - i) * e / c, a + (s - a) * e / c]);
	}
	return n.push(e[e.length - 1]), n;
}
function ui(t, n = 10) {
	return new e.LatheGeometry(t.map(([t, n]) => new e.Vector2(t, n)), n);
}
function di(e, t, n, r = 8, i = 3) {
	let a = [];
	for (let t = 0; t <= i; t++) {
		let n = -Math.PI / 2 + t / i * (Math.PI / 2);
		a.push([Math.max(1e-4, e * Math.cos(n)), e * Math.sin(n)]);
	}
	for (let e = 0; e <= i; e++) {
		let r = e / i * (Math.PI / 2);
		a.push([Math.max(1e-4, t * Math.cos(r)), n + t * Math.sin(r)]);
	}
	return ui(a, r);
}
function fi(e, t, n, r = 8) {
	let i = [[t - .01, 0], [t, 0]];
	i.push([e, n]);
	for (let t = 1; t <= 3; t++) {
		let r = t / 3 * (Math.PI / 2);
		i.push([Math.max(1e-4, e * Math.cos(r)), n + e * Math.sin(r)]);
	}
	return ui(i, r);
}
var pi = class {
	constructor() {
		this.geos = [], this.flat = !1;
	}
	add(t, n, r, { p: i, r: a, s: o, q: s } = {}) {
		for (let e of Object.keys(t.attributes)) e !== "position" && e !== "normal" && t.deleteAttribute(e);
		if (typeof r == "function") {
			t = t.toNonIndexed(), this.flat = !0;
			let n = t.attributes.position, i = new Float32Array(n.count * 3);
			for (let e = 0; e < n.count; e += 3) {
				let t = (n.getX(e) + n.getX(e + 1) + n.getX(e + 2)) / 3, a = (n.getY(e) + n.getY(e + 1) + n.getY(e + 2)) / 3, o = (n.getZ(e) + n.getZ(e + 1) + n.getZ(e + 2)) / 3;
				oi.setHex(r(t, a, o));
				for (let t = 0; t < 3; t++) i.set([
					oi.r,
					oi.g,
					oi.b
				], (e + t) * 3);
			}
			t.setAttribute("color", new e.BufferAttribute(i, 3));
		} else {
			oi.setHex(r);
			let n = t.attributes.position.count, i = new Float32Array(n * 3);
			for (let e = 0; e < n; e++) i.set([
				oi.r,
				oi.g,
				oi.b
			], e * 3);
			t.setAttribute("color", new e.BufferAttribute(i, 3));
		}
		let c = new e.Matrix4().compose(new e.Vector3(...i || [
			0,
			0,
			0
		]), s || new e.Quaternion().setFromEuler(new e.Euler(...a || [
			0,
			0,
			0
		])), new e.Vector3(...o || [
			1,
			1,
			1
		]));
		t.applyMatrix4(c);
		let l = t.attributes.position.count, u = new Uint16Array(l * 4), d = new Float32Array(l * 4);
		for (let e = 0; e < l; e++) u[e * 4] = n, d[e * 4] = 1;
		t.setAttribute("skinIndex", new e.BufferAttribute(u, 4)), t.setAttribute("skinWeight", new e.BufferAttribute(d, 4)), this.geos.push(t);
	}
	seg(t, n, r, i, a, o, s = 8, c) {
		let l = si.set(n[0] - t[0], n[1] - t[1], n[2] - t[2]), u = di(r, i, l.length(), s);
		c && u.scale(c[0], 1, c[1]), this.add(u, a, o, {
			p: t,
			q: new e.Quaternion().setFromUnitVectors(ci, l.normalize())
		});
	}
	build() {
		let e = this.flat ? this.geos.map((e) => e.index ? e.toNonIndexed() : e) : this.geos, n = t(e);
		for (let e of this.geos) e.dispose();
		return n;
	}
}, mi = {
	arg: (e, t, n) => Math.floor((Math.atan2(e, n) + Math.PI) / (Math.PI * 2 / 26)) % 2 ? 16777215 : 7711451,
	boca: (e, t) => t > 1.19 && t < 1.3 ? 16040461 : 732794,
	river: (e, t) => Math.abs(t - 1.17 + e * 1.3) < .055 ? 14034984 : 16448250,
	quilmes: (e, t) => t > 1.4 || t > 1.3 && t < 1.33 ? 1254235 : 16448250,
	rayas: (e, t) => Math.floor(t / .06) % 2 ? 15921906 : 1916794
}, hi = {
	arg: 7711451,
	boca: 732794,
	river: 16448250,
	quilmes: 16448250,
	rayas: 1916794
};
function gi(e = Math.random) {
	let t = (t) => t[Math.floor(e() * t.length)], n = e(), r = n < .1 ? "kid" : n < .26 ? "elder" : "adult", i = e() < .5, a = {
		age: r,
		fem: i,
		skin: t(Xr),
		build: .92 + e() * .26,
		rng: e
	};
	a.hairColor = t(r === "elder" ? Qr : Zr), a.hair = t(i ? r === "elder" ? [
		"bun",
		"short",
		"bob"
	] : [
		"long",
		"long",
		"ponytail",
		"ponytail",
		"bun",
		"bob",
		"cap"
	] : r === "elder" ? [
		"bald",
		"bald",
		"short",
		"cap"
	] : [
		"short",
		"short",
		"buzz",
		"cap",
		"cap",
		"long",
		"bald",
		"afro"
	]), a.beard = !i && r !== "kid" && e() < .3, a.glasses = r === "elder" ? e() < .6 : e() < .08, a.shirt = t($r);
	let o = e();
	a.pattern = r !== "elder" && o < .16 ? t([
		"arg",
		"boca",
		"river",
		"quilmes",
		"rayas",
		"boca",
		"river"
	]) : null, a.longSleeves = r === "elder" ? e() < .8 : e() < .3, a.shorts = r !== "elder" && e() < .25, a.pants = a.shorts || e() < .6 ? t(ei) : t(ti), a.shorts && e() < .4 && (a.pants = t(ti)), a.shoes = t(r === "elder" ? [
		2825492,
		2236962,
		5978654
	] : ni), a.sole = r === "elder" ? 2763306 : t([
		16119285,
		16119285,
		3355443
	]);
	let s = e();
	return a.backpack = r !== "elder" && s < .18, a.bag = !a.backpack && s < (i ? .45 : .28), a.mate = r !== "kid" && e() < .12, a.capColor = t(ri), a.bagColor = t(ii), a;
}
function _i(t = {}) {
	let n = t.rng || Math.random;
	t.full || (t = {
		...gi(n),
		...t
	}), t.stripes && !t.pattern && (t.pattern = "arg");
	let { fem: r, age: i } = t, a = new pi(), o = t.skin, s = t.hairColor, c = t.pants, l = t.pattern ? mi[t.pattern] : t.shirt, u = t.pattern ? hi[t.pattern] : t.shirt, d = t.build ?? 1, f = (r ? .168 : .186) * (.94 + d * .06), p = r ? .095 : .09, m = i === "kid" ? 1.14 : 1, h = (r ? 1.06 : 1) * d;
	a.add(ui([
		[1e-4, .8],
		[.1, .8],
		[.13 * h, .84],
		[.136 * h, .89],
		[.128 * d, .95],
		[1e-4, .97]
	], 12), $.pelvis, c, { s: [
		1,
		1,
		.64
	] });
	let g = d, _ = r ? .145 : .16, v = li([
		[1e-4, .875],
		[.148 * g * (r ? 1.04 : 1), .88],
		[.15 * g, .95],
		[(r ? .125 : .142) * g, 1.06],
		[(r ? .135 : .15) * g, 1.16],
		[_ * (.95 + g * .05), 1.27],
		[_ * 1.03, 1.35],
		[_ * .98, 1.41],
		[.12, 1.455],
		[.06, 1.48],
		[1e-4, 1.485]
	], t.pattern ? 16 : 5);
	if (a.add(ui(v, t.pattern ? 26 : 12), $.spine, l, { s: [
		1,
		1,
		r ? .66 : .64
	] }), r && i !== "kid") for (let t of [-1, 1]) a.add(new e.SphereGeometry(.058, 10, 7), $.spine, typeof l == "function" ? l(0, 1.25, 1) : l, {
		p: [
			t * .05,
			1.245,
			.058
		],
		s: [
			1.15,
			.8,
			.6
		]
	});
	(t.pattern === "arg" || t.pattern === "boca" || t.pattern === "quilmes") && a.add(new e.TorusGeometry(.052, .011, 4, 10), $.spine, t.pattern === "boca" ? 16040461 : t.pattern === "quilmes" ? 1254235 : 16777215, {
		p: [
			0,
			1.472,
			.004
		],
		r: [
			Math.PI / 2 + .15,
			0,
			0
		]
	}), a.seg([
		0,
		1.43,
		-.005
	], [
		0,
		1.56,
		.005
	], .047, .043, $.head, o, 8);
	let y = 1.63, b = .008, x = (e, t, n) => [
		e * m,
		y + (t - y) * m,
		b + (n - b) * m
	], S = (e) => e.map((e) => e * m);
	a.add(ui([
		[1e-4, -.125],
		[.045, -.12],
		[.074, -.097],
		[.091, -.052],
		[.099, -.005],
		[.1, .035],
		[.089, .083],
		[.062, .114],
		[.03, .128],
		[1e-4, .131]
	], 12), $.head, o, {
		p: x(0, y, b),
		s: S([
			.94,
			1,
			1.08
		])
	});
	for (let t of [-1, 1]) a.add(new e.SphereGeometry(.0125, 6, 4), $.head, 1709072, {
		p: x(t * .035, 1.642, .101),
		s: S([
			1,
			1.1,
			.6
		])
	}), a.add(new e.BoxGeometry(.036, .009, .012), $.head, s, {
		p: x(t * .036, 1.668, .10300000000000001),
		r: [
			0,
			0,
			t * -.12
		],
		s: S([
			1,
			1,
			1
		])
	}), a.add(new e.SphereGeometry(.022, 6, 4), $.head, o, {
		p: x(t * .093, 1.632, .004),
		s: S([
			.5,
			1.1,
			.8
		])
	});
	if (a.add(new e.BoxGeometry(.022, .042, .03), $.head, o, {
		p: x(0, 1.6179999999999999, .10800000000000001),
		r: [
			-.25,
			0,
			0
		],
		s: S([
			1,
			1,
			1
		])
	}), a.add(new e.BoxGeometry(.038, .007, .012), $.head, 8007728, {
		p: x(0, 1.5719999999999998, .098),
		s: S([
			1,
			1,
			1
		])
	}), t.glasses) {
		for (let t of [-1, 1]) a.add(new e.TorusGeometry(.02, .004, 3, 8), $.head, 1381653, {
			p: x(t * .036, 1.642, .11199999999999999),
			s: S([
				1,
				1,
				1
			])
		});
		a.add(new e.BoxGeometry(.03, .005, .005), $.head, 1381653, {
			p: x(0, 1.646, .11399999999999999),
			s: S([
				1,
				1,
				1
			])
		});
	}
	t.beard && (a.add(new e.SphereGeometry(.103, 12, 6, 0, Math.PI * 2, Math.PI * .57, Math.PI * .33), $.head, s, {
		p: x(0, 1.626, .012),
		r: [
			.3,
			0,
			0
		],
		s: S([
			.97,
			1.22,
			1.1
		])
	}), a.add(new e.BoxGeometry(.06, .012, .015), $.head, s, {
		p: x(0, 1.5859999999999999, .10800000000000001),
		s: S([
			1,
			1,
			1
		])
	}));
	let C = (t, n, r, i = .012, o = -.008) => a.add(new e.SphereGeometry(t, 12, 7, 0, Math.PI * 2, 0, r), $.head, s, {
		p: x(0, y + i, b + o),
		r: [
			-n,
			0,
			0
		],
		s: S([
			.98,
			1.2,
			1.1
		])
	});
	switch (t.hair) {
		case "buzz":
			C(.107, .35, 1.55, .014);
			break;
		case "bald":
			C(.104, 1.25, 1.2, 0, -.004);
			break;
		case "afro":
			C(.126, .45, 1.7, .02, -.02);
			break;
		case "long":
			C(.111, .25, 1.64, .016), a.seg(x(0, 1.67, -.047), x(0, 1.43, -.067), .085 * m, .07 * m, $.head, s, 8, [1.18, .55]);
			break;
		case "bob":
			C(.111, .25, 1.64, .016), a.seg(x(0, 1.66, -.022), x(0, 1.5499999999999998, -.037), .1 * m, .098 * m, $.head, s, 10, [1.02, .85]);
			break;
		case "ponytail":
			C(.11, .3, 1.6, .016), a.add(new e.SphereGeometry(.028, 6, 4), $.head, s, { p: x(0, 1.6649999999999998, -.10400000000000001) }), a.seg(x(0, 1.66, -.11699999999999999), x(0, 1.4899999999999998, -.157), .035 * m, .014 * m, $.head, s, 6);
			break;
		case "bun":
			C(.11, .3, 1.6, .016), a.add(new e.SphereGeometry(.048, 8, 6), $.head, s, {
				p: x(0, 1.74, -.07700000000000001),
				s: S([
					1,
					.85,
					1
				])
			});
			break;
		case "cap": {
			C(.105, .9, 1.45, 0, -.006);
			let n = t.capColor ?? 1916794;
			a.add(new e.SphereGeometry(.112, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), $.head, n, {
				p: x(0, 1.66, .004),
				s: S([
					.97,
					1.05,
					1.1
				])
			}), a.add(new e.CylinderGeometry(.085, .085, .012, 10, 1, !1, -Math.PI / 2, Math.PI), $.head, n, {
				p: x(0, 1.6649999999999998, .10800000000000001),
				r: [
					.12,
					0,
					0
				],
				s: S([
					1,
					1,
					1.05
				])
			}), a.add(new e.SphereGeometry(.012, 5, 3), $.head, n, { p: x(0, 1.777, b) });
			break;
		}
		default: C(.111, .28, 1.62, .016);
	}
	for (let n of [1, -1]) {
		let r = n === 1, i = r ? $.shL : $.shR, s = r ? $.elL : $.elR, c = n * f, l = t.longSleeves ? u : o;
		a.seg([
			c,
			1.14,
			0
		], [
			c,
			1.42,
			0
		], .041, .05, i, l, 8), t.longSleeves || a.add(fi(.058, .056, .15, 9), i, u, { p: [
			c,
			1.27,
			0
		] }), a.seg([
			c,
			.895,
			0
		], [
			c,
			1.14,
			0
		], .032, .04, s, l, 8), t.longSleeves && a.add(new e.CylinderGeometry(.041, .043, .04, 8), s, u, { p: [
			c,
			.915,
			0
		] }), a.add(new e.SphereGeometry(.04, 7, 5), s, o, {
			p: [
				c + n * .004,
				.845,
				.006
			],
			s: [
				.62,
				1.3,
				1
			]
		}), a.add(new e.SphereGeometry(.016, 5, 4), s, o, {
			p: [
				c - n * .004,
				.865,
				.034
			],
			s: [
				.9,
				1.5,
				.9
			]
		});
	}
	t.mate && (a.add(new e.SphereGeometry(.034, 8, 6), $.elR, 7029795, {
		p: [
			-f,
			.83,
			.05
		],
		s: [
			1,
			1.15,
			1
		]
	}), a.add(new e.CylinderGeometry(.004, .004, .08, 4), $.elR, 13224393, {
		p: [
			-f + .01,
			.875,
			.052
		],
		r: [
			0,
			0,
			.2
		]
	}), a.add(new e.CylinderGeometry(.034, .034, .3, 10), $.elL, 9182236, {
		p: [
			f,
			.83,
			.1
		],
		r: [
			Math.PI / 2,
			0,
			0
		]
	}), a.add(new e.CylinderGeometry(.036, .036, .05, 10), $.elL, 2236962, {
		p: [
			f,
			.83,
			.265
		],
		r: [
			Math.PI / 2,
			0,
			0
		]
	}));
	for (let n of [1, -1]) {
		let i = n === 1, s = i ? $.hipL : $.hipR, l = i ? $.knL : $.knR, u = i ? $.anL : $.anR, f = n * p, m = t.shorts ? o : c;
		a.seg([
			f,
			.5,
			0
		], [
			f,
			.93,
			0
		], .058, .082 * (r ? 1.04 : 1) * d, s, m, 9), t.shorts && a.add(fi(.09 * d, .084, .3, 10), s, c, { p: [
			f,
			.64,
			0
		] }), a.seg([
			f,
			.1,
			-.005
		], [
			f,
			.5,
			0
		], .042, .056, l, m, 8), t.shorts ? a.add(new e.CylinderGeometry(.047, .045, .12, 8), l, 15921906, { p: [
			f,
			.15,
			-.004
		] }) : a.add(new e.CylinderGeometry(.052, .058, .07, 9), l, c, { p: [
			f,
			.15,
			-.004
		] }), a.seg([
			f,
			.065,
			-.05
		], [
			f,
			.058,
			.14
		], .052, .046, u, t.shoes ?? 15921906, 8, [1.05, .72]), a.add(new e.BoxGeometry(.094, .034, .25), u, t.sole ?? 16119285, { p: [
			f,
			.017,
			.042
		] });
	}
	if (t.backpack) {
		let n = t.bagColor ?? 2236962;
		a.add(new e.BoxGeometry(.26, .34, .13), $.spine, n, { p: [
			0,
			1.2,
			-.165
		] }), a.seg([
			-.12,
			1.37,
			-.165
		], [
			.12,
			1.37,
			-.165
		], .065, .065, $.spine, n, 8, [1, 1]), a.add(new e.BoxGeometry(.2, .12, .04), $.spine, n, { p: [
			0,
			1.1,
			-.245
		] });
		for (let t of [-1, 1]) a.add(new e.BoxGeometry(.035, .3, .018), $.spine, 1710618, {
			p: [
				t * .085,
				1.3,
				.103
			],
			r: [
				-.12,
				0,
				0
			]
		}), a.add(new e.BoxGeometry(.035, .02, .24), $.spine, 1710618, { p: [
			t * .095,
			1.456,
			-.02
		] });
	} else if (t.bag) {
		let n = t.bagColor ?? 7031339;
		for (let t of [.104, -.104]) a.add(new e.BoxGeometry(.03, .56, .012), $.spine, 2760726, {
			p: [
				0,
				1.2,
				t
			],
			r: [
				0,
				0,
				-.62
			]
		});
		a.add(new e.BoxGeometry(.07, .2, .23), $.spine, n, {
			p: [
				-.2,
				.92,
				.02
			],
			r: [
				0,
				0,
				.12
			]
		});
	}
	let w = [], T = (t, n, r, i) => {
		let a = new e.Bone();
		return a.position.set(n, r, i), t && t.add(a), w.push(a), a;
	}, E = T(null, 0, 0, 0), D = T(E, 0, ai, 0), O = T(D, 0, .05, 0), k = T(O, 0, .47, 0), A = T(O, f, .42, 0), j = T(A, 0, -.28, 0), M = T(O, -f, .42, 0), N = T(M, 0, -.28, 0), P = T(D, p, -.02, 0), F = T(P, 0, -.43, 0), ee = T(F, 0, -.41, 0), I = T(D, -p, -.02, 0), L = T(I, 0, -.43, 0), R = T(L, 0, -.41, 0), z = new e.Group();
	z.rotation.order = "YXZ";
	let B = new e.SkinnedMesh(a.build(), Yr);
	B.castShadow = !0, B.boundingSphere = new e.Sphere(new e.Vector3(0, .9, 0), 1.25), z.add(E, B), z.updateMatrixWorld(!0), B.bind(new e.Skeleton(w));
	let te = i === "kid" ? .66 + n() * .14 : (r ? .93 : .98) * (.96 + n() * .08) * (i === "elder" ? .97 : 1);
	return z.scale.setScalar(t.scale ?? te), z.userData.rig = {
		pelvis: D,
		spine: O,
		head: k,
		shL: A,
		elL: j,
		shR: M,
		elR: N,
		hipL: P,
		knL: F,
		anL: ee,
		hipR: I,
		knR: L,
		anR: R
	}, z.userData.skinned = B, z.userData.look = t, z.userData.anim = {
		phase: n() * Math.PI * 2,
		t: n() * 100,
		seed: n() * 1e3,
		move: 0,
		run: 0,
		air: 0,
		down: 0,
		downAir: 0,
		sit: 0,
		panic: 0,
		stoop: i === "elder" ? .18 : 0,
		mate: !!t.mate,
		fem: !!r
	}, z;
}
function vi(e) {
	let t = e.userData.skinned;
	t && (t.geometry.dispose(), t.skeleton.dispose());
}
var yi = /* @__PURE__ */ "py.px.pz.prx.pry.prz.srx.sry.srz.hrx.hry.hrz.lsx.lsy.lsz.le.rsx.rsy.rsz.re.lhx.lhy.lhz.lk.la.rhx.rhy.rhz.rk.ra".split("."), bi = () => Object.fromEntries(yi.map((e) => [e, 0])), xi = bi(), Si = bi(), Ci = bi();
function wi(e, t, n) {
	if (!(n <= 0)) {
		if (n >= 1) {
			for (let n of yi) e[n] = t[n];
			return;
		}
		for (let r of yi) e[r] += (t[r] - e[r]) * n;
	}
}
var Ti = (e) => Math.max(0, Math.min(1, e)), Ei = (e, t, n) => {
	let r = Ti((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}, Di = (e, t, n, r) => e + (t - e) * Math.min(1, n * r);
function Oi(e, t) {
	let n = t.t, r = Math.sin(n * 2.1 + t.seed), i = Math.sin(n * .45 + t.seed * .7);
	if (e.py = -.008 + r * .003, e.px = i * .022, e.prz = -i * .035, e.srz = i * .03, e.srx = .02 + t.stoop + r * .012, e.hrx = -.03 - t.stoop * .6, e.hry = Math.sin(n * .23 + t.seed) * Math.sin(n * .11 + t.seed * 1.3) * .5, e.lhz = i * .035 - .015, e.rhz = i * .035 + .015, e.lk = .05 + Math.max(0, -i) * .16, e.rk = .05 + Math.max(0, i) * .16, e.lhx = -e.lk * .35, e.rhx = -e.rk * .35, e.la = e.lk * .5, e.ra = e.rk * .5, e.lsz = .09 + r * .012, e.rsz = -.09 - r * .012, e.lsx = .03, e.rsx = .03, e.le = -.16, e.re = -.16, t.mate) {
		let r = (n + t.seed) % 7, i = Ei(0, .5, r) * (1 - Ei(2.2, 2.8, r));
		e.rsx = -.45 * i + .03 * (1 - i) - .25, e.rsz = -.09 + .25 * i, e.re = -1.1 - 1 * i, e.rsy = .35 * i, e.hrx -= .08 * i, e.hry *= 1 - i, e.le = -1.3, e.lsx = -.1;
	}
}
function ki(e, t) {
	let n = t.phase, r = t.run, i = Math.sin(n), a = (e, t) => e + (t - e) * r, o = a(.42, .78), s = a(.95, 1.75);
	e.lhx = -o * i + a(0, -.12), e.rhx = o * i + a(0, -.12);
	let c = (e) => .05 + s * Math.max(0, Math.cos(e + a(.45, .2))) ** +a(1.6, 1.2) + a(.1, .4) * Math.max(0, Math.sin(e - a(1.8, 1.4)));
	e.lk = c(n), e.rk = c(n + Math.PI), e.la = -(e.lhx + e.lk) * .75 + a(.15, .35) * Math.max(0, -i), e.ra = -(e.rhx + e.rk) * .75 + a(.15, .35) * Math.max(0, i), e.lhz = -.03, e.rhz = .03;
	let l = i * i;
	e.py = a(-.012 - .05 * l, -.1 + .06 * l), e.pry = -a(.13, .18) * i, e.prz = a(.035, .02) * Math.sin(n * 2), e.px = a(.012, 0) * i, e.srx = a(.06, .26) + t.stoop + a(.015, .04) * Math.cos(n * 2), e.sry = a(.22, .34) * i, e.srz = -e.prz * .8, e.hrx = -e.srx * .6 - a(0, .06), e.hry = -(e.pry + e.sry) * .8;
	let u = a(.4, .75);
	if (e.lsx = u * i + a(.04, .1), e.rsx = -u * i + a(.04, .1), e.lsz = a(.1, .16), e.rsz = -a(.1, .16), e.lsy = a(0, -.25), e.rsy = a(0, .25), e.le = -a(.2, 1.45) - a(.3, .35) * Math.max(0, -i), e.re = -a(.2, 1.45) - a(.3, .35) * Math.max(0, i), t.panic > 0) {
		let n = t.panic, r = Math.sin(t.t * 14 + t.seed);
		e.lsx += (-2.5 + r * .25 - e.lsx) * n, e.rsx += (-2.5 - r * .25 - e.rsx) * n, e.lsz += (.35 - e.lsz) * n, e.rsz += (-.35 - e.rsz) * n, e.le += (-.5 - e.le) * n, e.re += (-.5 - e.re) * n, e.hrx += -.2 * n;
	}
	t.mate && (e.re = Math.min(e.re, -1.25), e.le = Math.min(e.le, -1.1));
}
function Ai(e, t, n) {
	let r = Ei(3, -4, n);
	e.py = -.02, e.srx = .12 - .08 * r, e.hrx = -.1, e.lhx = -1 + .6 * r, e.lk = 1.5 - .95 * r, e.la = .3, e.rhx = .3 - .35 * r, e.rk = 1 - .6 * r, e.ra = .3, e.lhz = -.06, e.rhz = .06, e.lsx = .3 - .9 * r, e.rsx = -.9 + .5 * r, e.lsz = .35 + .5 * r, e.rsz = -.35 - .5 * r, e.le = -.7, e.re = -.9;
}
function ji(e, t) {
	let n = Ei(.06, .18, t);
	e.py = -.05, e.srx = .1 + .22 * n, e.sry = .15 * (1 - n), e.hrx = -.1 - .12 * n, e.lhx = -.45, e.lk = .25, e.la = .25, e.rhx = .35, e.rk = .12, e.ra = -.2, e.lsx = -.9 - .62 * n, e.rsx = -.9 - .62 * n, e.lsz = .05 - .2 * n, e.rsz = -.05 + .2 * n, e.lsy = .5 * (1 - n), e.rsy = -.5 * (1 - n), e.le = -1.9 + 1.75 * n, e.re = -1.9 + 1.75 * n;
}
function Mi(e, t) {
	let n = t.t, r = t.seed, i = t.downAir, a = (e) => Math.sin(r * 3.1 + e * 7.7);
	if (e.py = -.02, e.srx = -.05, e.srz = a(1) * .15, e.hry = a(2) * .8, e.hrx = -.2, e.lsx = -1.3 + a(3) * .8, e.lsz = 1.1 + a(4) * .35, e.le = -.4 - Math.max(0, a(5)) * 1.2, e.rsx = -.4 + a(6) * .8, e.rsz = -1.2 - a(7) * .3, e.re = -.3 - Math.max(0, -a(5)) * 1.2, e.lhx = -.15 + a(8) * .35, e.lhz = .22, e.lk = .15 + Math.max(0, a(9)) * 1.1, e.rhx = -.2 - Math.max(0, -a(9)) * .9, e.rhz = -.2, e.rk = .2 + Math.max(0, -a(9)) * 1.4, e.la = .5, e.ra = .5, i > 0) {
		let t = Math.sin(n * 17 + r), a = Math.cos(n * 13 + r);
		e.lsx += (-2.3 + t * .5 - e.lsx) * i, e.rsx += (-1.9 - a * .5 - e.rsx) * i, e.lsz += (.8 - e.lsz) * i, e.rsz += (-.8 - e.rsz) * i, e.le += (-.6 - e.le) * i, e.re += (-.8 - e.re) * i, e.lhx += (-.6 + a * .4 - e.lhx) * i, e.rhx += (.2 + t * .4 - e.rhx) * i, e.lk += (1 - e.lk) * i, e.rk += (.6 - e.rk) * i, e.srx += (-.3 - e.srx) * i, e.hrx += (-.4 - e.hrx) * i;
	}
}
function Ni(e) {
	e.py = -.43, e.srx = -.08, e.hrx = .05, e.lhx = -1.5, e.rhx = -1.5, e.lhz = -.05, e.rhz = .05, e.lk = 1.45, e.rk = 1.45, e.lsx = -.95, e.rsx = -.95, e.lsz = -.05, e.rsz = .05, e.le = -.75, e.re = -.75;
}
function Pi(e, t, n = {}) {
	let r = e.userData.anim, i = e.userData.rig, a = n.speed || 0;
	r.t += t;
	let o = e.scale.x || 1;
	r.move = Di(r.move, Ei(.08, .9, a), 10, t), r.run = Di(r.run, Ei(2.3, 4.6, a), 6, t), r.air = Di(r.air, +!!n.air, n.air ? 14 : 20, t), r.down = Di(r.down, +!!n.down, 10, t), r.downAir = Di(r.downAir, +!!n.downAir, 6, t), r.sit = n.sit ?? 0, r.panic = Di(r.panic, +!!n.panic, 6, t);
	let s = (1.35 + (2.9 - 1.35) * r.run) * o;
	r.phase = (r.phase + t * a * Math.PI * 2 / s) % (Math.PI * 2);
	let c = xi;
	Oi(c, r), r.move > .001 && (ki(Si, r), wi(c, Si, r.move)), r.air > .001 && (Ai(Si, r, n.vy || 0), wi(c, Si, r.air));
	let l = n.push ?? -1;
	l >= 0 && l < .6 && (ji(Si, l), wi(c, Si, Ei(0, .07, l) * (1 - Ei(.32, .58, l)))), r.sit > 0 && (Ni(Si), wi(c, Si, r.sit)), r.down > .001 && (Mi(Ci, r), wi(c, Ci, r.down)), i.pelvis.position.set(c.px, ai + c.py, c.pz), i.pelvis.rotation.set(c.prx, c.pry, c.prz), i.spine.rotation.set(c.srx, c.sry, c.srz), i.head.rotation.set(c.hrx, c.hry, c.hrz), i.shL.rotation.set(c.lsx, c.lsy, c.lsz), i.elL.rotation.x = c.le, i.shR.rotation.set(c.rsx, c.rsy, c.rsz), i.elR.rotation.x = c.re, i.hipL.rotation.set(c.lhx, c.lhy, c.lhz), i.knL.rotation.x = c.lk, i.anL.rotation.x = c.la, i.hipR.rotation.set(c.rhx, c.rhy, c.rhz), i.knR.rotation.x = c.rk, i.anR.rotation.x = c.ra;
}
//#endregion
//#region src/entities/buses.js
var Fi = 9, Ii = 120, Li = 320, Ri = 420, zi = 7, Bi = 2.3, Vi = 250, Hi = 15722184, Ui = 16053492, Wi = 1842204, Gi = {
	22: [
		Hi,
		9226634,
		9080724
	],
	85: [
		Hi,
		2062906,
		Wi
	],
	98: [
		Hi,
		1920299,
		12986408
	],
	129: [
		Ui,
		12986408,
		1920928
	],
	148: [
		15909376,
		3046706,
		Wi
	],
	159: [
		Ui,
		Ui,
		15909376
	],
	219: [
		Ui,
		Ui,
		15909376
	],
	300: [
		Ui,
		Ui,
		15909376
	],
	372: [
		Ui,
		Ui,
		15909376
	],
	178: [
		Ui,
		12986408,
		Wi
	]
}, Ki = [
	13709359,
	1920928,
	15906565,
	3116878,
	14904094,
	8007052,
	953484,
	12720219,
	6122878,
	9329195
];
function qi(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t = Math.imul(t ^ e.charCodeAt(n), 16777619);
	return t >>> 0;
}
var Ji = class {
	constructor(e) {
		this.pts = e, this.cum = [0];
		for (let t = 1; t < e.length; t++) this.cum.push(this.cum[t - 1] + Math.hypot(e[t][0] - e[t - 1][0], e[t][1] - e[t - 1][1]));
		this.length = this.cum[this.cum.length - 1];
	}
	at(e, t = 0) {
		e = Math.max(0, Math.min(this.length - .01, e));
		let n = 0, r = this.cum.length - 1;
		for (; r - n > 1;) {
			let t = n + r >> 1;
			this.cum[t] <= e ? n = t : r = t;
		}
		let i = this.pts[n], a = this.pts[r], o = this.cum[r] - this.cum[n] || 1, s = (e - this.cum[n]) / o, c = (a[0] - i[0]) / o, l = (a[1] - i[1]) / o;
		return {
			x: i[0] + (a[0] - i[0]) * s - l * t,
			z: i[1] + (a[1] - i[1]) * s + c * t,
			dx: c,
			dz: l
		};
	}
	project(e, t, n = null, r = 80) {
		let i = Infinity, a = 0;
		for (let o = 0; o < this.pts.length - 1; o++) {
			if (n !== null && (this.cum[o + 1] < n - r || this.cum[o] > n + r)) continue;
			let [s, c] = this.pts[o], [l, u] = this.pts[o + 1], d = l - s, f = u - c, p = d * d + f * f || 1, m = Math.max(0, Math.min(1, ((e - s) * d + (t - c) * f) / p)), h = (s + d * m - e) ** 2 + (c + f * m - t) ** 2;
			h < i && (i = h, a = this.cum[o] + Math.sqrt(p) * m);
		}
		return {
			s: a,
			d: Math.sqrt(i)
		};
	}
};
function Yi(t, n = 512, r = 64) {
	let i = document.createElement("canvas");
	i.width = n, i.height = r;
	let a = i.getContext("2d");
	a.fillStyle = "#0b0b0b", a.fillRect(0, 0, n, r), a.fillStyle = "#ffb000", a.font = "bold 40px monospace", a.textBaseline = "middle", a.fillText(t, 12, r / 2 + 2, n - 24);
	let o = new e.CanvasTexture(i);
	return o.colorSpace = e.SRGBColorSpace, new e.MeshStandardMaterial({
		map: o,
		emissive: 16777215,
		emissiveMap: o,
		emissiveIntensity: .9
	});
}
var Xi = class {
	constructor(e, t, { collision: n, traffic: r, graph: i }) {
		this.scene = e, this.graph = i, this.traffic = r, this.collision = n, this.routes = t.routes.map((e) => ({
			...e,
			pathObj: new Ji(e.path)
		})), this.stops = t.stops, this.stopById = new Map(this.stops.map((e) => [e.id, e])), this.list = [], this.spawnTimer = 0, this.stations = [], this.buildStops(), this.buildStations();
	}
	buildStops() {
		let n = (() => {
			let t = document.createElement("canvas");
			t.width = 128, t.height = 160;
			let n = t.getContext("2d");
			n.fillStyle = "#1d4fa0", n.fillRect(0, 0, 128, 160), n.fillStyle = "#fff", n.font = "bold 26px Arial, sans-serif", n.textAlign = "center", n.fillText("PARADA", 64, 34), n.fillRect(28, 56, 72, 48), n.fillStyle = "#1d4fa0", n.fillRect(34, 62, 60, 18), n.beginPath(), n.arc(44, 108, 8, 0, Math.PI * 2), n.arc(84, 108, 8, 0, Math.PI * 2), n.fill(), n.fillStyle = "#fff", n.font = "bold 18px Arial, sans-serif", n.fillText("COLECTIVOS", 64, 146);
			let r = new e.CanvasTexture(t);
			return r.colorSpace = e.SRGBColorSpace, r;
		})(), r = new e.MeshStandardMaterial({
			color: 3104058,
			roughness: .6,
			metalness: .4
		}), i = new e.MeshStandardMaterial({
			map: n,
			roughness: .6,
			side: e.DoubleSide
		}), a = new e.MeshStandardMaterial({
			color: 599e4,
			roughness: .5,
			metalness: .6
		}), o = new e.MeshStandardMaterial({
			color: 12572896,
			roughness: .1,
			transparent: !0,
			opacity: .35,
			depthWrite: !1
		}), s = (t, n, r, i, a, o) => new e.BoxGeometry(t, n, r).translate(i, a + n / 2, o), c = [
			s(3.4, .08, 1.4, 0, 2.4, 0),
			s(2.4, .06, .4, 0, .45, .35),
			...[-1.6, 1.6].flatMap((e) => [s(.07, 2.4, .07, e, 0, .6), s(.07, 2.4, .07, e, 0, -.6)])
		], l = s(3.2, 2, .03, 0, .3, .62), u = new e.Vector3(0, 1, 0), d = /* @__PURE__ */ new Map();
		for (let e of this.stops) {
			let t = `${Math.floor(e.x / Vi)},${Math.floor(e.z / Vi)}`;
			d.has(t) || d.set(t, []), d.get(t).push(e);
		}
		for (let n of d.values()) {
			let s = [], d = [], f = [], p = [];
			for (let t of n) {
				let n = this.routes.find((e) => e.stops.some((e) => e.id === t.id)), r = n?.stops.find((e) => e.id === t.id).s, i = n ? this.curb(n.pathObj.at(r), .6) : {
					x: t.x,
					z: t.z,
					dx: 1,
					dz: 0
				};
				if (n && this.stationFor(t, n, r)) continue;
				let a = n ? n.pathObj.at(r, Bi) : i;
				if (t.px = i?.x ?? a.x, t.pz = i?.z ?? a.z, !i) continue;
				let o = Math.atan2(i.dx, i.dz) + Math.PI, m = new e.CylinderGeometry(.05, .06, 2.7, 6);
				m.translate(0, 1.35, 0), m.applyMatrix4(new e.Matrix4().makeRotationY(o).setPosition(i.x, 0, i.z)), s.push(m);
				let h = new e.PlaneGeometry(.5, .62);
				if (h.translate(.28, 2.35, 0), h.applyMatrix4(new e.Matrix4().makeRotationY(o).setPosition(i.x, 0, i.z)), d.push(h), this.collision.addCircle(i.x, i.z, .12, "pole"), n && t.lines?.length >= 3) {
					let t = this.curb(n.pathObj.at(r + 3), 1.9);
					if (!t) continue;
					let i = new e.Vector3(t.ox, 0, t.oz);
					if ([-1.6, 1.6].flatMap((e) => [[t.x + i.z * e + i.x * .6, t.z - i.x * e + i.z * .6], [t.x + i.z * e - i.x * .6, t.z - i.x * e - i.z * .6]]).some(([e, t]) => this.onRoad(e, t))) continue;
					let a = new e.Matrix4().makeBasis(new e.Vector3().crossVectors(u, i), u, i).setPosition(t.x, 0, t.z);
					for (let e of c) f.push(e.clone().applyMatrix4(a));
					p.push(l.clone().applyMatrix4(a));
					for (let e of [-1.6, 1.6]) this.collision.addCircle(t.x + i.z * e + i.x * .6, t.z - i.x * e + i.z * .6, .1, "pole");
				}
			}
			if (!s.length) continue;
			let m = new e.Mesh(t(s), r);
			m.castShadow = !0;
			let h = new e.Mesh(t(d), i);
			if (this.scene.add(m, h), f.length) {
				let n = new e.Mesh(t(f), a);
				n.castShadow = !0, this.scene.add(n, new e.Mesh(t(p), o));
			}
		}
	}
	metroAt(e) {
		if (!this.graph) return null;
		let t = null;
		for (let n of this.graph.segIndex.query(e.x - 20, e.z - 20, e.x + 20, e.z + 20)) {
			let r = n.road;
			if (!r.metro) continue;
			let i = Math.hypot(n.b.x - n.a.x, n.b.z - n.a.z) || 1, a = (n.b.x - n.a.x) / i, s = (n.b.z - n.a.z) / i, c = a * e.dx + s * e.dz;
			if (r.oneway ? c < .8 : Math.abs(c) < .8) continue;
			let [l, u, , d] = o(e.x, e.z, n.a.x, n.a.z, n.b.x, n.b.z);
			if (d > (r.w / 2 + 2) ** 2 || t && d >= t.d2) continue;
			let f = c < 0 ? -a : a, p = c < 0 ? -s : s, m = r.oneway ? r.metro.median : 0;
			t = {
				road: r,
				d2: d,
				x: l - p * m,
				z: u + f * m,
				dx: f,
				dz: p
			};
		}
		return t;
	}
	stationFor(e, t, n) {
		let r = t.pathObj.at(n), i = this.metroAt(r);
		if (!i) return null;
		let a = this.stations.find((e) => Math.hypot(e.x - i.x, e.z - i.z) < 40 && e.dx * i.dx + e.dz * i.dz > .5);
		if (!a) {
			let e = w + T / 2;
			for (let t of [
				0,
				7,
				-7,
				13,
				-13,
				19,
				-19
			]) {
				let n = i.x + i.dx * t, r = i.z + i.dz * t, o = !0;
				for (let t = -19; t <= 19 && o; t += 2.5) {
					let a = n + i.dx * t - i.dz * e, s = r + i.dz * t + i.dx * e, c = this.graph.nearest(a, s, 20);
					c && !c.seg.road.metro && c.seg.road.kind !== "footway" && c.seg.road.kind !== "pedestrian" && c.dist < c.seg.road.w / 2 + 1.5 && (o = !1), this.collision.isBlocked(a, s, .2) && (o = !1);
				}
				if (o) {
					a = {
						x: n,
						z: r,
						dx: i.dx,
						dz: i.dz,
						road: i.road,
						people: [],
						cool: 0,
						...k(i.road, n, r, i.dx, i.dz)
					}, this.collision.addPolygon(a.corners, a.height, "platform"), this.stations.push(a);
					break;
				}
			}
			if (!a) return null;
		}
		e.station = a, e.px = a.wait.x, e.pz = a.wait.z;
		for (let t of this.routes) for (let n of t.stops) n.id === e.id && (n.s = t.pathObj.project(a.x, a.z, n.s, 60).s);
		return a;
	}
	buildStations() {
		if (!this.stations.length) return;
		let n = {
			deck: new e.MeshStandardMaterial({
				color: 10723739,
				roughness: .9
			}),
			edge: new e.MeshStandardMaterial({
				color: 15909376,
				roughness: .8
			}),
			frame: new e.MeshStandardMaterial({
				color: 13159632,
				roughness: .4,
				metalness: .7
			}),
			glass: new e.MeshStandardMaterial({
				color: 12572896,
				roughness: .1,
				transparent: !0,
				opacity: .3,
				depthWrite: !1
			}),
			sign: new e.MeshStandardMaterial({
				map: A(),
				roughness: .5
			})
		};
		for (let r of Object.keys(n)) {
			let i = new e.Mesh(t(this.stations.flatMap((e) => e.geos[r])), n[r]);
			i.castShadow = r !== "glass", i.receiveShadow = r === "deck", this.scene.add(i);
		}
		for (let e of this.stations) delete e.geos;
	}
	updateStations(e, t, n, r) {
		for (let i of this.stations) {
			let a = Math.hypot(i.x - t, i.z - n);
			if (a > 170) {
				for (let e of i.people) this.scene.remove(e.mesh), vi(e.mesh);
				i.people.length = 0;
				continue;
			}
			let o = this.list.find((e) => e.wait > 0 && this.stopById.get(e.r.stops[e.nextStop]?.id)?.station === i);
			if (i.cool -= e, !o && i.people.length < 4 && i.cool <= 0 && a > 35) {
				i.cool = 6 + r() * 10;
				let e = i.wait, t = (r() - .5) * e.len, n = r() * .9, a = _i({ rng: r }), o = {
					mesh: a,
					x: e.x + e.dx * t + e.nx * n,
					z: e.z + e.dz * t + e.nz * n
				};
				a.rotation.y = Math.atan2(-e.nx, -e.nz) + (r() - .5) * 1.2, this.scene.add(a), i.people.push(o);
			}
			for (let t of [...i.people]) {
				let n = 0;
				if (o) {
					let r = o.v.x - t.x, a = o.v.z - t.z, s = Math.hypot(r, a);
					if (s < 2.6) {
						this.scene.remove(t.mesh), vi(t.mesh), i.people.splice(i.people.indexOf(t), 1);
						continue;
					}
					n = 1.3, t.x += r / s * n * e, t.z += a / s * n * e, t.mesh.rotation.y = Math.atan2(r, a);
				}
				t.mesh.position.set(t.x, i.height, t.z), Pi(t.mesh, e, { speed: n });
			}
		}
	}
	near(e, t, n = 4.5) {
		return this.list.find((r) => r.v.driver === "bus" && Math.min(...r.v.circles().map(([n, r]) => Math.hypot(n - e, r - t))) < n) || null;
	}
	nextStopName(e) {
		let t = e.r.stops[e.nextStop];
		return t ? this.stopById.get(t.id)?.name || "parada" : "terminal";
	}
	curb(e, t) {
		let n = this.parallelRoad(e) || this.graph?.nearest(e.x, e.z, 25);
		if (!n) return {
			...e,
			x: e.x - e.dz * (4.3 + t),
			z: e.z + e.dx * (4.3 + t),
			ox: -e.dz,
			oz: e.dx
		};
		let { a: r, b: i, road: a } = n.seg, o = Math.hypot(i.x - r.x, i.z - r.z) || 1, s = -(i.z - r.z) / o, c = (i.x - r.x) / o;
		s * -e.dz + c * e.dx < 0 && (s = -s, c = -c);
		let l = (i.x - r.x) / o, u = (i.z - r.z) / o;
		for (let r of [
			0,
			-5,
			5,
			-10,
			10,
			-15,
			15
		]) for (let i = a.w / 2 + t; i < a.w / 2 + t + 8; i += 1) {
			let t = n.x + s * i + l * r, a = n.z + c * i + u * r, o = this.graph.nearest(t, a, 20);
			if (!o || o.seg.road.kind === "footway" || o.seg.road.kind === "pedestrian" || o.dist > o.seg.road.w / 2 + .5) return {
				x: t,
				z: a,
				dx: e.dx,
				dz: e.dz,
				ox: s,
				oz: c
			};
		}
		return null;
	}
	parallelRoad(e) {
		if (!this.graph) return null;
		let t = null;
		for (let n of this.graph.segIndex.query(e.x - 25, e.z - 25, e.x + 25, e.z + 25)) {
			if (n.road.kind === "footway" || n.road.kind === "pedestrian") continue;
			let r = n.b.x - n.a.x, i = n.b.z - n.a.z, a = Math.hypot(r, i) || 1;
			if (Math.abs((r * e.dx + i * e.dz) / a) < .8) continue;
			let [s, c, , l] = o(e.x, e.z, n.a.x, n.a.z, n.b.x, n.b.z);
			l < 625 && (!t || l < t.d2) && (t = {
				seg: n,
				x: s,
				z: c,
				d2: l,
				dist: Math.sqrt(l)
			});
		}
		return t;
	}
	onRoad(e, t) {
		let n = this.graph?.nearest(e, t, 20);
		return !!n && n.seg.road.kind !== "footway" && n.seg.road.kind !== "pedestrian" && n.dist < n.seg.road.w / 2 + .3;
	}
	nearestStop(e, t, n = 10) {
		let r = null, i = n;
		for (let n of this.stops) {
			let a = Math.hypot((n.px ?? n.x) - e, (n.pz ?? n.z) - t);
			a < i && (i = a, r = n);
		}
		return r;
	}
	spawn(e, t, n) {
		for (let r = 0; r < 12; r++) {
			let r = this.routes[Math.floor(n() * this.routes.length)], i = r.pathObj, a = i.project(e, t);
			if (a.d > Li) continue;
			let o = a.s + (n() < .5 ? -1 : 1) * (Ii + n() * (200 - a.d));
			if (o < 5 || o > i.length - 30) continue;
			let s = i.at(o, Bi);
			if (Math.hypot(s.x - e, s.z - t) < Ii * .8 || this.traffic.vehicles.some((e) => Math.hypot(e.x - s.x, e.z - s.z) < 15)) continue;
			let c = Gi[r.line] || [
				Ui,
				Ki[qi(r.agency || r.line) % Ki.length],
				Wi
			], l = new Jr("bus", s.x, s.z, Math.atan2(s.dx, s.dz), c);
			l.driver = "bus", l.managed = !0, l.vx = s.dx * 6, l.vz = s.dz * 6, this.decorate(l, r), this.traffic.add(l);
			let u = r.stops.findIndex((e) => e.s > o + 5);
			this.list.push({
				v: l,
				r,
				s: o,
				nextStop: u,
				wait: 0,
				stuck: 0
			});
			return;
		}
	}
	decorate(t, n) {
		let { length: r, width: i, height: a } = t.spec, o = n.headsign.trim(), s = o.match(/^(.*?)\s*-\s*(ida|vuelta)$/i);
		o = s ? s[1] : o.replace(/^[A-Z0-9]{1,3}\s*-\s*/, ""), (!o || /^(ida|vuelta)$/i.test(o)) && (o = n.name);
		let c = new e.Mesh(new e.PlaneGeometry(i - .3, .42), Yi(`${n.line}  ${o.toUpperCase()}`));
		c.position.set(0, a - .3, r / 2 + .07);
		let l = new e.Mesh(new e.PlaneGeometry(1.6, .34), Yi(`${n.line} ${o.toUpperCase()}`, 384, 64));
		l.position.set(-i / 2 - .03, a - .75, r / 2 - 2.2), l.rotation.y = -Math.PI / 2;
		let u = new e.Mesh(new e.PlaneGeometry(.8, .4), Yi(n.line, 128, 64));
		u.position.set(0, a - .35, -r / 2 - .07), u.rotation.y = Math.PI, t.mesh.add(c, l, u), t.busLine = n.line, t.busHeadsign = o;
	}
	release(e) {
		e.v.managed = !1, this.list.splice(this.list.indexOf(e), 1);
	}
	update(e, t, n) {
		let { px: r, pz: i } = t;
		for (let n of [...this.list]) {
			let a = n.v;
			if (!this.traffic.vehicles.includes(a)) {
				this.list.splice(this.list.indexOf(n), 1);
				continue;
			}
			if (a.driver !== "bus") {
				this.release(n);
				continue;
			}
			if (n === t.riding && n.s > n.r.pathObj.length - 8) {
				n.ended = !0;
				continue;
			}
			if (Math.hypot(a.x - r, a.z - i) > Ri || n.s > n.r.pathObj.length - 8) {
				this.traffic.remove(a), this.list.splice(this.list.indexOf(n), 1);
				continue;
			}
			this.drive(n, e, t);
		}
		this.spawnTimer -= e, this.list.length < Fi && this.spawnTimer <= 0 && !t.fast && (this.spawn(r, i, n), this.spawnTimer = 1.5), this.updateStations(e, r, i, n);
	}
	drive(e, t, n) {
		let r = e.v, i = e.r.pathObj, a = i.project(r.x, r.z, e.s, 60);
		if (e.s = Math.max(e.s, a.s), a.d > 30 || r.health <= 0) {
			r.driver = null, this.release(e);
			return;
		}
		let o = Math.max(0, r.speed), s = 7 + o * .6, c = this.graph?.nearest(r.x, r.z, 20)?.seg.road, l = c ? Math.min(c.oneway ? c.w * .12 : Math.min(Bi, c.w * .25), Math.max(c.oneway ? 0 : .3, c.w / 2 - 3.4)) : Bi;
		e.overtake > 0 && (e.overtake -= t, l = 0);
		let u = i.at(e.s + s, l), d = this.metroAt(i.at(e.s + s));
		d && (u = {
			x: d.x - d.dz * w / 2,
			z: d.z + d.dx * w / 2
		});
		let f = Math.atan2(u.x - r.x, u.z - r.z) - r.heading;
		for (; f > Math.PI;) f -= Math.PI * 2;
		for (; f < -Math.PI;) f += Math.PI * 2;
		let p = i.at(e.s + 25), m = i.at(e.s), h = Math.acos(Math.max(-1, Math.min(1, p.dx * m.dx + p.dz * m.dz))) > .5 ? 5 : 11, g = e.r.stops[e.nextStop];
		if (e.wait > 0) e.wait -= t, h = 0, e.wait <= 0 && e.nextStop++;
		else if (g) {
			let t = g.s - e.s;
			t < -3 ? e.nextStop++ : t < 2.5 ? (e.wait = zi, h = 0) : t < 45 && (h = Math.min(h, Math.max(1.5, t * .35)));
		}
		let _ = this.traffic.obstacleAhead(r, n, 8 + o * 1.5 + r.spec.length / 2);
		_ < Infinity && (h = Math.min(h, Math.max(0, (_ - r.spec.length / 2 - 3) * .6)));
		let v = Math.sin(r.heading), y = Math.cos(r.heading);
		this.traffic.closedAt?.(r.x + v * 16, r.z + y * 16) && !this.traffic.closedAt(r.x, r.z) && (h = 0);
		let b = this.traffic.signals, x = b?.stopAhead(r.x, r.z, v, y, 45 + o * 2, o) ?? Infinity;
		x < Infinity && (h = Math.min(h, Math.max(0, (x - r.spec.length / 2 - .3) * .5)));
		let S = x < Infinity || (b?.stopAhead(r.x, r.z, v, y, 80) ?? Infinity) < Infinity;
		e.wait <= 0 && o < .5 && h < 1 && !S ? e.stuck += t : e.stuck = Math.max(0, e.stuck - t), e.stuck > 6 && (e.stuck = 0, e.overtake = 8), e.overtake > 0 && _ < Infinity && (h = Math.max(h, 3));
		let C = h - o, T = Math.max(-1, Math.min(1, f * 2.2)), E = {
			throttle: C > .3 ? Math.min(1, C * .3) : 0,
			brake: C < -.4 && o > .6 ? Math.min(1, -C * .3) : 0,
			handbrake: h === 0 && o < 1.5,
			steer: T
		};
		if (e.reverse > 0) e.reverse -= t, Object.assign(E, {
			throttle: 0,
			brake: 1,
			handbrake: !1,
			steer: -T
		});
		else if (e.wait <= 0 && h >= 1 && o < .4 && _ === Infinity) {
			if (e.wall = (e.wall || 0) + t, e.wall > 3 && (e.wall = 0, e.reverse = 2, e.fails = (e.fails || 0) + 1, e.fails >= 3)) {
				e.fails = 0, e.reverse = 0;
				for (let t of [
					8,
					16,
					24,
					32
				]) {
					let n = i.at(e.s + t, l);
					if (!this.collision.isBlocked(n.x, n.z, r.radius)) {
						e.s += t, r.x = n.x, r.z = n.z, r.heading = Math.atan2(n.dx, n.dz), r.vx = r.vz = 0;
						break;
					}
				}
			}
		} else e.wall = Math.max(0, (e.wall || 0) - t), o > 3 && (e.fails = 0);
		r.update(t, E, this.collision);
	}
}, Zi = class {
	constructor() {
		this.hash = new c(24), this.solids = [];
	}
	addPolygon(e, t = 10, n = "building") {
		let r = {
			type: "poly",
			pts: e,
			height: t,
			tag: n,
			bb: s(e)
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
		for (let r of this.hash.query(e - n, t - n, e + n, t + n)) if (r.type === "circle") {
			if (Math.hypot(e - r.x, t - r.z) < r.r + n) return !0;
		} else if (a(e, t, r.pts)) return !0;
		else if (n > 0) {
			let i = r.pts;
			for (let r = 0, a = i.length - 1; r < i.length; a = r++) if (o(e, t, i[a][0], i[a][1], i[r][0], i[r][1])[3] < n * n) return !0;
		}
		return !1;
	}
}, Qi = new e.Color(1, 1, 1);
function $i(e, t, n, r, i) {
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
		e.quad(o[n], s[n], s[n + 1], o[n + 1], [0, a], [1, a], [1, l], [0, l], Qi, [
			0,
			1,
			0
		]), c += r;
	}
}
function ea(e) {
	if (e.u && e.v) {
		let t = e.u, n = e.v;
		return (e, r) => {
			let i = e / 1e3, a = r / 1e3, o = i * i, s = i * a, c = a * a;
			return [t[0] + t[1] * i + t[2] * a + t[3] * o + t[4] * s + t[5] * c, n[0] + n[1] * i + n[2] * a + n[3] * o + n[4] * s + n[5] * c];
		};
	}
	let t = Math.cos(e.theta), n = Math.sin(e.theta);
	return (r, i) => [r * t + i * n + e.x, -r * n + i * t + e.z];
}
function ta(t, n, r, i) {
	t.updateMatrixWorld(!0);
	let a = [];
	t.traverse((e) => {
		e.isMesh && a.push(e);
	});
	let o = new e.Quaternion().setFromAxisAngle(new e.Vector3(0, 1, 0), r), s = new e.Matrix3().setFromMatrix4(new e.Matrix4().makeRotationY(r)), c = new e.Matrix4(), l = new e.Vector3(), u = new e.Quaternion(), d = new e.Vector3();
	for (let r of a) {
		if (r.isInstancedMesh) {
			for (let e = 0; e < r.count; e++) {
				r.getMatrixAt(e, c), c.premultiply(r.matrixWorld).decompose(l, u, d);
				let [t, a] = n(l.x, l.z);
				r.setMatrixAt(e, c.compose(l.set(t, l.y + i, a), u.premultiply(o), d));
			}
			r.instanceMatrix.needsUpdate = !0;
			let t = r.matrixWorld.clone(), a = r.setMatrixAt.bind(r), s = new e.Matrix4(), f = new e.Vector3(), p = new e.Quaternion(), m = new e.Vector3();
			r.setMatrixAt = (e, r) => {
				s.copy(r).premultiply(t).decompose(f, p, m);
				let [c, l] = n(f.x, f.z);
				a(e, s.compose(f.set(c, f.y + i, l), p.premultiply(o), m));
			};
		} else {
			let e = r.geometry.clone();
			e.applyMatrix4(r.matrixWorld);
			let t = e.attributes.position;
			for (let e = 0; e < t.count; e++) {
				let [r, a] = n(t.getX(e), t.getZ(e));
				t.setXYZ(e, r, t.getY(e) + i, a);
			}
			e.attributes.normal && e.attributes.normal.applyMatrix3(s), e.computeBoundingSphere(), e.computeBoundingBox(), r.geometry = e;
		}
		r.position.set(0, 0, 0), r.quaternion.identity(), r.scale.set(1, 1, 1), r.parent !== t && t.add(r), r.isInstancedMesh && r.computeBoundingSphere();
	}
	for (let e of [...t.children]) e.isMesh || t.remove(e);
	t.position.set(0, 0, 0), t.quaternion.identity();
}
async function na(t, { dataUrl: n, frame: r, lift: i = .2 }) {
	let a = await (await fetch(n)).json(), o = Ot({ capabilities: { getMaxAnisotropy: () => 8 } }), s = new Zi();
	ln(a);
	let c = St(a), l = new kt(a.roads), u = new e.Group();
	u.name = "GtaQuilmesPlaces";
	let d = ea(r), f = (t, n = 16777215, r = {}) => new e.MeshStandardMaterial({
		map: t,
		color: n,
		roughness: .95,
		depthWrite: !1,
		polygonOffset: !0,
		polygonOffsetFactor: -2,
		...r
	}), p = C(a, {
		root: u,
		collision: s,
		graph: l,
		tex: o
	}), m = ar(a, {
		root: u,
		graph: l,
		collision: s,
		nightMaterials: []
	});
	if (a.buses) try {
		new Xi(u, a.buses, {
			collision: s,
			traffic: {
				vehicles: [],
				add() {}
			},
			graph: l
		});
	} catch (e) {
		console.warn("[gta-world] paradas", e);
	}
	let h = gn(a, {
		root: u,
		graph: l,
		collision: s,
		ribbon: $i,
		flatMat: f,
		keepOut: p.keepOut,
		GeoBuf: I
	}), g = new e.Group();
	g.name = "GtaQuilmesTrains", g.position.y = i;
	let _ = ra(a, c, {
		root: u,
		live: g,
		tex: o,
		flatMat: f,
		collision: s,
		toGrid: d,
		theta: r.theta
	});
	u.traverse((e) => {
		e.isMesh && (e.castShadow = e.castShadow || !e.material?.transparent, e.receiveShadow = !0);
	}), ta(u, d, r.theta, i), t.add(u), t.add(g), u.updateMatrixWorld(!0), g.updateMatrixWorld(!0);
	let v = [];
	for (let e of s.solids) {
		let t = (e.type === "poly" ? e.pts.map(([e, t]) => d(e, t)) : Array.from({ length: 8 }, (t, n) => d(e.x + Math.cos(n * Math.PI / 4) * e.r, e.z + Math.sin(n * Math.PI / 4) * e.r))).map(([e, t]) => ({
			x: e,
			z: t
		})), n = t.map((e) => e.x), r = t.map((e) => e.z);
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
		keepOut: p.keepOut.map(([e, t, n]) => [...d(e, t), n]),
		shops: m.count,
		setNight(e) {
			p.setNight(e), h.setNight(e), m.setNight(e);
		},
		dynamic: g,
		update(e) {
			_.update(Math.min(e, .1));
		}
	};
}
function ra(n, r, { root: i, live: a, tex: o, flatMat: s, collision: c, toGrid: l, theta: u }) {
	let d = { update() {} };
	if (!n.rails?.length) return d;
	let f = new I(), p = new I();
	for (let e of n.rails) $i(f, e.pts, 3.6, .05, 1 / 4);
	let m = new e.Mesh(f.geometry(), s(o.gravel));
	m.receiveShadow = !0, i.add(m);
	let h = new e.Color(.55, .55, .58), g = [];
	for (let e of n.rails) for (let t = 0; t < e.pts.length - 1; t++) {
		let [n, r] = e.pts[t], [i, a] = e.pts[t + 1], o = Math.hypot(i - n, a - r);
		if (o < .01) continue;
		let s = (i - n) / o, c = (a - r) / o, l = -c, u = s;
		for (let e of [-.72, .72]) {
			let t = .18, o = .05, s = [
				n + l * (e - o),
				t,
				r + u * (e - o)
			], c = [
				n + l * (e + o),
				t,
				r + u * (e + o)
			], d = [
				i + l * (e - o),
				t,
				a + u * (e - o)
			], f = [
				i + l * (e + o),
				t,
				a + u * (e + o)
			];
			p.quad(s, c, f, d, [0, 0], [1, 0], [1, 1], [0, 1], h, [
				0,
				1,
				0
			]);
		}
		for (let e = 0; e < o; e += .7) g.push([
			n + s * e,
			r + c * e,
			Math.atan2(s, c)
		]);
	}
	i.add(new e.Mesh(p.geometry(), new e.MeshStandardMaterial({
		vertexColors: !0,
		metalness: .8,
		roughness: .35
	})));
	{
		let t = new e.InstancedMesh(new e.BoxGeometry(2.4, .14, .24), new e.MeshStandardMaterial({
			color: 5917242,
			roughness: 1
		}), g.length), n = new e.Matrix4(), r = new e.Quaternion(), a = new e.Vector3(0, 1, 0), o = new e.Vector3(1, 1, 1), s = new e.Vector3();
		g.forEach(([e, i, c], l) => t.setMatrixAt(l, n.compose(s.set(e, .08, i), r.setFromAxisAngle(a, c), o))), t.receiveShadow = !0, t.computeBoundingSphere(), i.add(t);
	}
	let _ = r.levels || [], v = [];
	for (let e of _) if (!e.ped) for (let t of [-1, 1]) {
		let n = t * (e.half + 2.2), r = -t * (e.w / 2 + .6), i = e.x + e.ux * n - e.uz * r, a = e.z + e.uz * n + e.ux * r, o = -t * e.uz, s = t * e.ux, [u, d] = l(i, a);
		v.push({
			x: i,
			z: a,
			gx: u,
			gz: d,
			ry: Math.atan2(-s, o),
			Dx: o,
			Dz: s,
			len: e.w / 2 + .2,
			l: e,
			a: Math.PI / 2
		}), c.addCircle(i, a, .2, "pole");
	}
	let y = null, b = new e.Matrix4(), x = new e.Euler(), S = new e.Quaternion(), C = new e.Vector3(), w = new e.Vector3(), T = () => {
		v.forEach((e, t) => {
			x.set(0, e.ry, e.a, "YXZ"), S.setFromEuler(x), x.set(0, e.ry + u, e.a, "YXZ"), S.setFromEuler(x), y.setMatrixAt(t, b.compose(C.set(e.gx, 1.05, e.gz), S, w.set(e.len, 1, 1)));
		}), y.instanceMatrix.needsUpdate = !0;
	};
	if (v.length) {
		let n = document.createElement("canvas");
		n.width = 64, n.height = 4;
		let r = n.getContext("2d");
		for (let e = 0; e < 8; e++) r.fillStyle = e % 2 ? "#f4f4f4" : "#d11f1f", r.fillRect(e * 8, 0, 8, 4);
		let o = new e.CanvasTexture(n);
		o.colorSpace = e.SRGBColorSpace, y = new e.InstancedMesh(new e.BoxGeometry(1, .12, .12).translate(.5, 0, 0), new e.MeshStandardMaterial({
			map: o,
			roughness: .6
		}), v.length), y.castShadow = !0, y.frustumCulled = !1, a.add(y);
		let s = [], c = [];
		for (let t of v) {
			s.push(new e.CylinderGeometry(.1, .12, 1.2, 6).translate(t.x, .6, t.z), new e.BoxGeometry(.35, .5, .35).translate(t.x, 1, t.z));
			let n = new e.CylinderGeometry(.06, .06, 3.2, 5).translate(0, 1.6, 0), r = (t) => new e.BoxGeometry(1.4, .22, .04).rotateZ(t).translate(0, 2.9, .06);
			for (let i of [
				n,
				r(.6),
				r(-.6)
			]) c.push(i.applyMatrix4(new e.Matrix4().makeRotationY(t.ry + Math.PI / 2).setPosition(t.x - t.Dx * .7, 0, t.z - t.Dz * .7)));
		}
		let l = (n, r) => {
			let a = new e.Mesh(t(n.map((e) => e.index ? e.toNonIndexed() : e)), r);
			a.castShadow = !0, i.add(a);
		};
		l(s, new e.MeshStandardMaterial({
			color: 15263976,
			roughness: .6
		})), l(c, new e.MeshStandardMaterial({
			color: 16053492,
			roughness: .6
		})), T();
	}
	let E = new wr(a, n), D = null;
	return {
		trains: E,
		update(e) {
			E.update(e);
			for (let e of E.trains) for (let t of e.cars) {
				let [e, n] = l(t.position.x, t.position.z);
				t.position.x = e, t.position.z = n, t.rotation.y += u;
			}
			if (!y || !E.trains.length) return;
			D ||= _.map((e) => E.trains.map((t) => {
				let n = t.track.project(e.x, e.z);
				return n.d < 20 ? n.s : null;
			}));
			let t = _.map((e, t) => E.trains.some((e, n) => D[t][n] !== null && Math.abs(e.s - D[t][n]) < 250)), n = !1;
			for (let r of v) {
				let i = t[_.indexOf(r.l)] ? 0 : Math.PI / 2 - .05, a = r.a + Math.sign(i - r.a) * Math.min(Math.abs(i - r.a), e * .9);
				a !== r.a && (r.a = a, n = !0);
			}
			n && T();
		}
	};
}
async function ia(t, { dataUrl: n, lift: r = .2 }) {
	let [i, a] = await Promise.all([fetch(n).then((e) => e.json()), import("three/tsl")]), { styles: o, houses: s, roads: c, streetSigns: l } = i, u = s.map((e) => {
		let t = [[e[7] / 10, e[8] / 10]];
		for (let n = 9; n + 1 < e.length; n += 2) t.push([t[t.length - 1][0] + e[n] / 10, t[t.length - 1][1] + e[n + 1] / 10]);
		let n = {
			pts: t,
			h: e[0] / 10,
			levels: e[1],
			style: o[e[2]]
		};
		return e[3] >= 0 && (n.front = e[3]), e[4] && (n.shop = !0), e[5] && (n.villa = !0), e[6] && (n.roof = "gable"), n;
	}), d = Ot({ capabilities: { getMaxAnisotropy: () => 8 } }), f = new kt(c), p = new Zi(), m = new re(220), { tanks: h, detail: g } = tt({
		buildings: u,
		roads: c,
		specials: []
	}, {
		chunks: m,
		collision: p,
		tex: d,
		graph: f
	}), _ = new e.Group();
	_.name = "GtaQuilmesHouses", _.position.y = r, t.add(_);
	let { texture: v, attribute: y, uv: b, vertexColor: x, uniformArray: S, uniform: C, int: w, vec3: T } = a, E = d.facades, D = y("layer", "float"), O = C(0), k = new e.MeshStandardNodeMaterial();
	k.colorNode = v(E.map, b()).depth(D).rgb.mul(x()), k.roughnessNode = S(E.rough, "float").element(w(D.add(.5))), k.metalnessNode = S(E.metal, "float").element(w(D.add(.5))), k.emissiveNode = v(E.emissive, b()).depth(D).rgb.mul(T(1, .85, .6)).mul(O);
	let A = {
		facade: k,
		props: new e.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .9
		}),
		alpha: new e.MeshStandardMaterial({
			map: d.atlas,
			vertexColors: !0,
			alphaTest: .5,
			side: e.DoubleSide,
			roughness: .9
		}),
		cables: new e.LineBasicMaterial({ color: 1710618 })
	};
	m.build(_, A), g.build(_, A);
	let j = new e.CylinderGeometry(.6, .6, 1.1, 8).translate(0, 1.15, 0), M = new e.BoxGeometry(1, .6, 1).translate(0, .3, 0);
	for (let [t, n] of [[j, 2961459], [M, 10131087]]) {
		let r = new e.InstancedMesh(t, new e.MeshStandardMaterial({
			color: n,
			roughness: .6
		}), h.length), i = new e.Matrix4();
		h.forEach(([e, t, n, a], o) => r.setMatrixAt(o, i.makeScale(a, a, a).setPosition(e, n, t))), r.castShadow = !0, r.computeBoundingSphere(), _.add(r);
	}
	let N = rn({
		streetSigns: l || [],
		roads: c
	}, {
		root: _,
		collision: p
	});
	_.updateMatrixWorld(!0);
	let P = p.solids.filter((e) => e.type === "poly").map((e) => {
		let t = e.pts.map(([e, t]) => ({
			x: e,
			z: t
		}));
		return {
			minX: e.bb.minX,
			maxX: e.bb.maxX,
			minZ: e.bb.minZ,
			maxZ: e.bb.maxZ,
			minY: 0,
			maxY: e.height,
			polygon: {
				outer: t,
				holes: []
			},
			gta: "house"
		};
	}), F = null, ee = !0, I = {
		x: 0,
		z: 0
	};
	return {
		root: _,
		colliders: P,
		count: u.length,
		setNight(e) {
			O.value = e * .85, N.setNight(e);
		},
		update(e, t) {
			I.x = e, I.z = t;
			let n = ee || !F || (e - F.x) ** 2 + (t - F.z) ** 2 > 9;
			n && (F = {
				x: e,
				z: t
			}), m.updateDetail(I, !1, ee, n), g.update(I, ee, n), N.update(e, t), n && _.updateMatrixWorld(!0), ee = !1;
		}
	};
}
//#endregion
export { na as buildGtaWorld, ia as buildHouses };
