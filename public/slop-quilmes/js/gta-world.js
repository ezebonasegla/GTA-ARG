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
function r(e) {
	let t = 0;
	for (let n = 0, r = e.length - 1; n < e.length; r = n++) t += (e[r][0] - e[n][0]) * (e[r][1] + e[n][1]);
	return t / 2;
}
function i(e, t, n) {
	let r = !1;
	for (let i = 0, a = n.length - 1; i < n.length; a = i++) {
		let o = n[i][0], s = n[i][1], c = n[a][0], l = n[a][1];
		s > t != l > t && e < (c - o) * (t - s) / (l - s) + o && (r = !r);
	}
	return r;
}
function a(e, t, n, r, i, a) {
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
function o(e) {
	let t = Infinity, n = Infinity, r = -Infinity, i = -Infinity;
	for (let [a, o] of e) a < t && (t = a), o < n && (n = o), a > r && (r = a), o > i && (i = o);
	return {
		minX: t,
		minZ: n,
		maxX: r,
		maxZ: i
	};
}
var s = class {
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
function c(e, t, n, r = 12) {
	let o = null, s = r;
	for (let c of e.query(t - r, n - r, t + r, n + r)) {
		if (i(t, n, c.pts)) return c;
		let e = c.pts;
		for (let r = 0, i = e.length - 1; r < e.length; i = r++) {
			let l = Math.sqrt(a(t, n, e[i][0], e[i][1], e[r][0], e[r][1])[3]);
			l < s && (s = l, o = c);
		}
	}
	return o;
}
function l(e, t = 0, n = 0) {
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
var u = class n {
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
function d(t) {
	let n = new e.Matrix4().makeRotationY(Math.atan2(-t.uz, t.ux));
	return n.setPosition(t.cx, 0, t.cz), n;
}
var f = new e.Matrix4();
function p(t, n, r, i, a = 0, o = 1) {
	let s = new e.Matrix4().makeRotationY(a).scale(new e.Vector3(o, o, o)).setPosition(n, r, i);
	return f.copy(t).multiply(s).clone();
}
function m(e, t, n) {
	return [e.cx + e.ux * t - e.uz * n, e.cz + e.uz * t + e.ux * n];
}
function h(t, n, r, i = 6) {
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
var g = (e, t, n, r) => {
	let i = h(e, t, n, r);
	return i.translate(0, t / 2, 0), i;
};
function _(t, n, r) {
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
function v(t, n, r) {
	let i = document.createElement("canvas");
	i.width = t, i.height = n, r(i.getContext("2d"), t, n);
	let a = new e.CanvasTexture(i);
	return a.colorSpace = e.SRGBColorSpace, a.anisotropy = 4, a;
}
function y(e, t, n, r = 1024, i = 160, a = "bold 96px Arial, sans-serif") {
	return v(r, i, (o) => {
		o.fillStyle = t, o.fillRect(0, 0, r, i), o.strokeStyle = n, o.lineWidth = 8, o.strokeRect(10, 10, r - 20, i - 20), o.fillStyle = n, o.font = a, o.textAlign = "center", o.textBaseline = "middle", o.fillText(e, r / 2, i / 2 + 4, r - 60);
	});
}
function b() {
	return v(300, 200, (e) => {
		e.fillStyle = "#74acdf", e.fillRect(0, 0, 300, 200), e.fillStyle = "#ffffff", e.fillRect(0, 67, 300, 66), e.fillStyle = "#f6b40e", e.beginPath(), e.arc(150, 100, 20, 0, Math.PI * 2), e.fill();
		for (let t = 0; t < 16; t++) {
			let n = t / 16 * Math.PI * 2;
			e.beginPath(), e.moveTo(150 + Math.cos(n) * 18, 100 + Math.sin(n) * 18), e.lineTo(150 + Math.cos(n + .1) * 30, 100 + Math.sin(n + .1) * 30), e.lineTo(150 + Math.cos(n - .1) * 30, 100 + Math.sin(n - .1) * 30), e.fill();
		}
	});
}
function x(e, t) {
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
		let [n, o] = m(e, a.nu * (a.off + 2), a.nv * (a.off + 2)), s = t.nearest(n, o, 80)?.dist ?? 999;
		s < i && (i = s, r = a);
	}
	return r;
}
function S(t, { root: n, collision: r, graph: i, tex: a }) {
	let o = [], s = [], c = (t, n = {}) => new e.MeshStandardMaterial({
		color: t,
		roughness: .8,
		...n
	}), f = {
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
			map: v(128, 128, (e) => {
				e.fillStyle = "#fff", e.fillRect(0, 0, 128, 128), e.fillStyle = "#d62828", e.fillRect(44, 12, 40, 104), e.fillRect(12, 44, 104, 40);
			}),
			emissive: 16724016,
			emissiveIntensity: 0
		}),
		flag: new e.MeshStandardMaterial({
			map: b(),
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
	o.push([f.lamp, 2.5], [f.flood, 4], [f.redCross, .8]);
	let h = new u(), S = new u(), C = (e) => (t.specials || []).filter((t) => t.type === e);
	for (let n of t.buildings) {
		let t = n.special;
		if (!t || t.type !== "cathedral" && t.type !== "church") continue;
		let a = t.box, o = d(a), s = a.hu * 2, c = a.hv * 2, l = (i.nearest(...m(a, a.hu + 3, 0), 80)?.dist ?? 999) <= (i.nearest(...m(a, -a.hu - 3, 0), 80)?.dist ?? 999) ? 1 : -1, u = l > 0 ? 0 : Math.PI;
		if (t.type === "cathedral") {
			let t = c * .56, i = (c - t) / 2, a = t / 2, d = s - 7 - a, m = l * (a - 7) / 2;
			h.add(g(d, 17, t, 10), f.stone, p(o, m, 0, 0));
			for (let e of [-1, 1]) {
				h.add(g(d, 10, i, 10), f.stone, p(o, m, 0, e * (t / 2 + i / 2))), h.add(g(d, .6, i + .4), f.slate, p(o, m, 10, e * (t / 2 + i / 2)));
				for (let t = -d / 2 + 4; t < d / 2 - 2; t += 6) h.add(g(1.2, 9, 1.2), f.stuccoDark, p(o, m + t, 0, e * (c / 2 + .3)));
			}
			h.add(_(d, t + .6, 6), f.slate, p(o, m, 17, 0));
			let v = new e.CylinderGeometry(a, a, 15, 20, 1, !1, 0, Math.PI);
			v.translate(0, 15 / 2, 0), h.add(v, f.stucco, p(o, -l * (s / 2 - a), 0, 0, u + Math.PI));
			let y = new e.SphereGeometry(a, 20, 8, Math.PI / 2, Math.PI, 0, Math.PI / 2);
			h.add(y, f.slate, p(o, -l * (s / 2 - a), 15, 0, u + Math.PI));
			let b = l * (s / 2 - 3.5);
			h.add(g(7, 21, c), f.stone, p(o, b, 0, 0));
			let x = _(7.5, c + .6, 5.5);
			h.add(x, f.stucco, p(o, b + l * .2, 21, 0)), h.add(g(.6, 1.2, c + .8), f.stuccoDark, p(o, b + l * 3.5, 20, 0)), h.add(g(.4, 6, 3.4), f.dark, p(o, l * (s / 2 + .05), 0, 0));
			for (let e of [-1, 1]) h.add(g(.4, 4.5, 2.2), f.dark, p(o, l * (s / 2 + .05), 0, e * c * .3));
			let S = new e.CylinderGeometry(2.3, 2.3, .4, 20);
			S.rotateZ(Math.PI / 2), h.add(S, f.dark, p(o, l * (s / 2 + .1), 13, 0));
			for (let t of [-1, 1]) for (let n of [.18, .42]) {
				let r = new e.CylinderGeometry(.45, .5, 17, 12);
				r.translate(0, 8.5, 0), h.add(r, f.cream, p(o, l * (s / 2 + .5), 0, t * c * n));
			}
			let C = l * (s / 2 - 4);
			h.add(g(7.5, 30, 7.5), f.stone, p(o, C, 0, 0)), h.add(g(8.3, 1, 8.3), f.stuccoDark, p(o, C, 30, 0)), h.add(g(6.6, 6, 6.6), f.stucco, p(o, C, 31, 0));
			for (let [e, t] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) h.add(g(e ? .3 : 2.4, 4, t ? .3 : 2.4), f.dark, p(o, C + e * 3.35, 32, t * 3.35));
			h.add(g(7.2, .8, 7.2), f.stuccoDark, p(o, C, 37, 0));
			let w = new e.CylinderGeometry(2.8, 3.1, 3.5, 8);
			w.translate(0, 1.75, 0), h.add(w, f.stucco, p(o, C, 37.8, 0)), h.add(new e.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), f.dome, p(o, C, 41.3, 0));
			let T = new e.CylinderGeometry(.7, .8, 2, 8);
			T.translate(0, 1, 0), h.add(T, f.stucco, p(o, C, 44, 0)), h.add(g(.3, 3.2, .3), f.gold, p(o, C, 46, 0)), h.add(g(.3, .3, 1.6), f.gold, p(o, C, 48, 0)), r.addPolygon(n.pts, 20, "building");
		} else {
			let t = Math.min(10, Math.max(8, n.h));
			h.add(g(s, t, c, 10), f.stone, p(o, 0, 0, 0)), h.add(_(s + .6, c + .8, Math.min(c * .4, 7)), f.tile, p(o, 0, t, 0));
			let i = _(.6, c + .8, Math.min(c * .4, 7));
			h.add(i, f.stucco, p(o, l * (s / 2 + .2), t, 0)), h.add(g(.4, 4.5, 2.6), f.dark, p(o, l * (s / 2 + .05), 0, 0));
			let a = Math.min(5, c * .35), u = l * (s / 2 - a / 2), d = c / 2 - a / 2, m = t + 9;
			h.add(g(a, m, a), f.stucco, p(o, u, 0, d));
			for (let [e, t] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) h.add(g(e ? .3 : 1.4, 2.4, t ? .3 : 1.4), f.dark, p(o, u + e * a / 2, m - 3.5, d + t * a / 2));
			let v = new e.ConeGeometry(a * .72, 6, 4);
			v.rotateY(Math.PI / 4), v.translate(0, 3, 0), h.add(v, f.slate, p(o, u, m, d)), h.add(g(.2, 2.2, .2), f.gold, p(o, u, m + 6, d)), h.add(g(.2, .2, 1.1), f.gold, p(o, u, m + 7.4, d)), r.addPolygon(n.pts, t, "building");
		}
	}
	for (let n of t.buildings) {
		let t = n.special;
		if (!t || t.type !== "civic" && t.type !== "hospital") continue;
		let r = t.box, a = d(r), s = x(r, i), c = -s.nv, l = s.nu, u = s.nu ? Math.PI / 2 : 0;
		if (t.type === "civic") {
			let r = Math.min(s.half * 2 * .7, 26), i = Math.min(n.h - 2, 10), o = Math.max(4, Math.round(r / 3.5) | 1), d = s.off + 2.6;
			for (let t = 0; t < o; t++) {
				let n = -r / 2 + r * t / (o - 1), u = new e.CylinderGeometry(.42, .5, i, 14);
				u.translate(0, i / 2 + .9, 0), h.add(u, f.cream, p(a, s.nu * d + c * n, 0, s.nv * d + l * n));
			}
			h.add(g(r + 2, 1.2, 4.2), f.cream, p(a, s.nu * (s.off + 2.1), i + .9, s.nv * (s.off + 2.1), u));
			let m = _(4.2, r + 2.4, 2.8);
			h.add(m, f.stucco, p(a, s.nu * (s.off + 2.1), i + 2.1, s.nv * (s.off + 2.1), u + Math.PI / 2));
			for (let e = 0; e < 3; e++) h.add(g(r + 3 - e, .3, 5.2 - e * .7), f.concrete, p(a, s.nu * (s.off + 2.4 - e * .3), e * .3, s.nv * (s.off + 2.4 - e * .3), u));
			if (t.flag) {
				let o = s.nu * (s.off - 2), c = s.nv * (s.off - 2), l = new e.CylinderGeometry(.08, .1, 9, 8);
				l.translate(0, 4.5, 0), h.add(l, f.metal, p(a, o, n.h, c));
				let u = new e.PlaneGeometry(3, 2);
				u.translate(1.5, 0, 0), h.add(u, f.flag, p(a, o, n.h + 7.8, c, Math.atan2(s.nu, s.nv) + Math.PI / 2));
				let d = new e.PlaneGeometry(Math.min(r, 18), 1.6), m = new e.MeshStandardMaterial({
					map: y(t.name.toUpperCase(), "#efe4cc", "#3a3024"),
					roughness: .8
				});
				h.add(d, m, p(a, s.nu * (s.off + 4.35), i + 1.5, s.nv * (s.off + 4.35), Math.atan2(s.nu, s.nv)));
			}
		} else {
			let r = Math.atan2(s.nu, s.nv), i = new e.PlaneGeometry(2.6, 2.6);
			h.add(i, f.redCross, p(a, s.nu * (s.off + .08), n.h - 2.2, s.nv * (s.off + .08), r)), h.add(g(8, .3, 4), f.white, p(a, s.nu * (s.off + 2), 3.2, s.nv * (s.off + 2), u));
			for (let e of [-3.6, 3.6]) h.add(g(.2, 3.2, .2), f.metal, p(a, s.nu * (s.off + 3.8) + c * e, 0, s.nv * (s.off + 3.8) + l * e));
			let d = new e.PlaneGeometry(Math.min(s.half * 1.6, 16), 1.4), m = new e.MeshStandardMaterial({
				map: y(t.name.toUpperCase(), "#ffffff", "#1d4e89"),
				emissive: 16777215,
				emissiveIntensity: 0
			});
			m.emissiveMap = m.map, o.push([m, .6]), h.add(d, m, p(a, s.nu * (s.off + .1), 4.4, s.nv * (s.off + .1), r));
		}
	}
	for (let t of C("station")) {
		let n = {
			cx: t.cx,
			cz: t.cz,
			ux: t.ux,
			uz: t.uz
		}, i = d(n), a = t.length / 2, o = 1.05, s = 6.5, c = [t.lo - 1.7 - s / 2, t.hi + 1.7 + s / 2], u = new e.MeshStandardMaterial({
			map: y(t.name.toUpperCase(), "#1f3f8f", "#ffffff"),
			roughness: .6
		});
		for (let d of c) {
			h.add(g(t.length, o, s, 3), f.concrete, p(i, 0, 0, d));
			let c = d < t.lo ? d + s / 2 - .25 : d - s / 2 + .25;
			S.add(new e.PlaneGeometry(t.length, .35).rotateX(-Math.PI / 2), new e.MeshBasicMaterial({ color: 15255088 }), p(i, 0, 1.06, c));
			for (let t = -48; t <= 48; t += 12) {
				let n = new e.CylinderGeometry(.12, .15, 3.6, 8);
				n.translate(0, 2.85, 0), h.add(n, f.canopy, p(i, t, 0, d));
			}
			h.add(g(98, .25, 6.1), f.canopy, p(i, 0, 4.65, d)), h.add(_(98, 6.3, 1.2), f.metal, p(i, 0, 4.9, d));
			for (let e of [-1, 1]) h.add(g(98, .5, .08), f.cream, p(i, 0, 4.15, d + e * (s / 2 - .25)));
			for (let t of [
				-a + 20,
				0,
				a - 20
			]) {
				for (let e of [-2.2, 2.2]) h.add(g(.12, 2.6, .12), f.iron, p(i, t + e, o, d));
				h.add(new e.PlaneGeometry(4.6, .8), u, p(i, t, 3.55, d + .05)), h.add(new e.PlaneGeometry(4.6, .8), u, p(i, t, 3.55, d - .05, Math.PI));
			}
			for (let e = -40; e <= 40; e += 16) h.add(g(2, .45, .5), f.wood, p(i, e + 6, o, d));
			for (let t of [-1, 1]) {
				let n = new e.BoxGeometry(12, .2, 5.5);
				n.rotateZ(t * Math.atan2(o, 12)), h.add(n, f.concrete, p(i, t * (a + 5.8), o / 2, d));
			}
			r.addPolygon(l({
				cx: 0,
				cz: 0,
				ux: 1,
				uz: 0,
				vx: 0,
				vz: 1,
				hu: a,
				hv: s / 2
			}).map(([e, t]) => m(n, e, t + d)), o, "platform");
		}
		let v = t.houseSide > 0 ? t.hi + 1.7 + s + 5.5 : t.lo - 1.7 - s - 5.5;
		h.add(g(34, 7, 10), f.brick, p(i, 0, 0, v)), h.add(_(35, 11, 3.2), f.tile, p(i, 0, 7, v)), h.add(g(10, 9.5, 11), f.brick, p(i, 0, 0, v));
		let b = _(11, 12, 3);
		b.rotateY(Math.PI / 2), h.add(b, f.tile, p(i, 0, 9.5, v));
		let x = new e.PlaneGeometry(12, 1.6);
		h.add(x, u, p(i, 0, 5.4, v + (t.houseSide > 0 ? 5.06 : -5.06), t.houseSide > 0 ? 0 : Math.PI)), h.add(x, u, p(i, 0, 5.4, v - (t.houseSide > 0 ? 5.06 : -5.06), t.houseSide > 0 ? Math.PI : 0)), r.addPolygon([
			[-17, -5],
			[17, -5],
			[17, 5],
			[-17, 5]
		].map(([e, t]) => m(n, e, t + v)), 9, "building");
	}
	let w = (t) => {
		let n = t.clone();
		return n.side = e.DoubleSide, n;
	}, T = {
		concrete: w(f.concrete),
		white: w(f.white),
		iron: f.iron,
		metal: w(f.metal),
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
		h.add(l, s, t.clone().multiply(f));
	}, ee = (t, n, r, i, a, o, s) => {
		let c = r > 0 ? Math.PI / 2 : Math.PI * 1.5, l = i > 0 ? 0 : Math.PI, u = Math.abs(c - l) > Math.PI ? Math.max(c, l) : Math.min(c, l), d = new e.LatheGeometry(n.map(([t, n]) => new e.Vector2(Math.max(.01, t), n)), 10, u, Math.PI / 2);
		h.add(d, s, p(t, r * a, 0, i * o));
	}, O = (e, t, n, i, a, o, s) => {
		let c = [
			[-o / 2, i],
			[o / 2, i],
			[o / 2, i + a],
			[-o / 2, i + a]
		];
		r.addPolygon(c.map(([r, i]) => t ? m(e, t * i, r) : m(e, r, n * i)), s, "building");
	}, k = (t, n, i, a) => {
		for (let [o, s] of [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		]) {
			let c = o * (t.hu + i), l = s * (t.hv + i), u = new e.CylinderGeometry(.45, .8, a, 8);
			u.translate(0, a / 2, 0), h.add(u, f.metal, p(n, c, 0, l)), h.add(g(5, 3, .6), f.flood, p(n, c, a - 1, l, Math.atan2(-o, -s))), r.addCircle(...m(t, c, l), 1, "pole");
		}
	}, A = (t, n, r, i, a, o, s, c, l) => {
		let u = new e.MeshStandardMaterial({
			map: y(n, r, "#ffffff"),
			roughness: .6
		});
		h.add(new e.PlaneGeometry(c, l), u, p(t, i * o, s, a * o, Math.atan2(i, a)));
	};
	for (let t of C("stadium")) {
		let n = t.box, a = d(n);
		if (/centenario/i.test(t.name)) {
			let e = t.depth, o = t.height, c = E(e, o, 12), l = x(n, i);
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
			], t, r, i, s, T.concrete), O(n, t, r, i, e, s, o), t === l.nu && r === l.nv && A(a, "ESTADIO CENTENARIO · QUILMES ATLÉTICO CLUB", "#1b3a8c", t, r, i + e + .14, o * .55, Math.min(60, s * .6), 4);
			for (let [t, i] of [
				[1, 1],
				[1, -1],
				[-1, 1],
				[-1, -1]
			]) {
				ee(a, c, t, i, n.hu + 3, n.hv + 3, T.concrete);
				let o = m(n, t * (n.hu + 3 + e * .5), i * (n.hv + 3 + e * .5));
				r.addCircle(o[0], o[1], e * .6, "building");
			}
			A(a, "QUILMES", "#1b3a8c", 1, 0, n.hu + 3 + e * .55, o * .55 + 1, 26, 4.5), k(n, a, 3 + e + 4, o + 26), s.push([
				n.cx,
				n.cz,
				Math.hypot(n.hu, n.hv) + e + 10
			]);
			continue;
		}
		if (/argentino/i.test(t.name)) {
			let t = x(n, i), [r, o] = [t.nu, t.nv], c = {
				D: 12,
				H: 6,
				len: (r ? n.hv : n.hu) * 1.4,
				off: (r ? n.hu : n.hv) + 3
			};
			D(a, E(c.D, c.H, 8, .2), r, o, c.off, c.len, T.concrete), O(n, r, o, c.off, c.D, c.len, c.H + 5);
			let l = new e.Shape([
				[c.D - .4, 0],
				[c.D, 0],
				[c.D, c.H + 5.2],
				[c.D - .4, c.H + 5.2]
			].map(([t, n]) => new e.Vector2(t, n))), u = new e.Vector3(-o, 0, r), d = new e.Vector3(r, 0, o), f = (t) => a.clone().multiply(new e.Matrix4().makeBasis(d, new e.Vector3(0, 1, 0), u).setPosition(d.clone().multiplyScalar(t).addScaledVector(u, -c.len / 2)));
			h.add(new e.ExtrudeGeometry(l, {
				depth: c.len,
				bevelEnabled: !1
			}), T.white, f(c.off));
			let m = new e.Shape([
				[-1.2, c.H + 3.6],
				[c.D + .4, c.H + 5.2],
				[c.D + .4, c.H + 5.45],
				[-1.2, c.H + 3.85]
			].map(([t, n]) => new e.Vector2(t, n)));
			h.add(new e.ExtrudeGeometry(m, {
				depth: c.len,
				bevelEnabled: !1
			}), T.metal, f(c.off));
			let g = new e.Shape([
				[-1.3, c.H + 2.9],
				[-1.1, c.H + 2.9],
				[-1.1, c.H + 3.9],
				[-1.3, c.H + 3.9]
			].map(([t, n]) => new e.Vector2(t, n)));
			h.add(new e.ExtrudeGeometry(g, {
				depth: c.len,
				bevelEnabled: !1
			}), T.celeste, f(c.off));
			for (let t = -c.len / 2 + 3; t <= c.len / 2 - 3; t += 7) {
				let n = new e.CylinderGeometry(.12, .14, c.H + 3.7, 6);
				n.translate(0, (c.H + 3.7) / 2, 0);
				let i = c.off - .9;
				h.add(n, T.iron, r ? p(a, r * i, 0, t) : p(a, t, 0, o * i));
			}
			A(a, "CLUB ATLÉTICO ARGENTINO DE QUILMES", "#4f8fc9", -r, -o, -(c.off - 1.35), c.H + 3.4, Math.min(40, c.len * .8), 1), A(a, "ARGENTINO DE QUILMES · PLATEA 1927", "#4f8fc9", r, o, c.off + c.D + .05, c.H * .6, Math.min(34, c.len * .7), 2.6);
			let _ = 2 * ((r ? n.hv : n.hu) + 3), v = c.off;
			D(a, E(10, 5, 10), -r, -o, v, _, T.concrete), D(a, [
				[9.6, 5],
				[10, 5],
				[10, 6.1],
				[9.6, 6.1]
			], -r, -o, v, _, T.celeste), O(n, -r, -o, v, 10, _, 6);
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
				], t, i, y + 2, b, T.celeste), O(n, t, i, y + 2, .3, b, 2.2);
			}
			k(n, a, 11, 22), s.push([
				n.cx,
				n.cz,
				Math.hypot(n.hu, n.hv) + 16
			]);
			continue;
		}
		let o = t.colors.map((e) => c(e, { roughness: .6 })), l = t.depth, u = t.height, _ = l > 16 ? 6 : 4, v = x(n, i), b = [
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
		for (let i of b) {
			let s = i.nu === v.nu && i.nv === v.nv, c = s ? u * 1.25 : u, d = i.nu ? Math.PI / 2 : 0, b = l / _;
			for (let e = 0; e < _; e++) {
				let t = i.off + 3 + b * (e + .5);
				h.add(g(i.len, c * (e + 1) / _, b), o[e % o.length], p(a, i.nu * t, 0, i.nv * t, d));
			}
			h.add(g(i.len, c + 1.2, .6), f.concrete, p(a, i.nu * (i.off + 3 + l + .3), 0, i.nv * (i.off + 3 + l + .3), d));
			let x = i.off + 3 + l + .6, S = [
				[-i.len / 2, i.off + 3],
				[i.len / 2, i.off + 3],
				[i.len / 2, x],
				[-i.len / 2, x]
			];
			if (r.addPolygon(S.map(([e, t]) => i.nu ? m(n, i.nu * t, e) : m(n, e, i.nv * t)), c, "building"), s) {
				h.add(g(i.len, .4, l + 3), f.metal, p(a, i.nu * (i.off + 3 + l / 2), c + 4, i.nv * (i.off + 3 + l / 2), d));
				for (let t = -i.len / 2 + 4; t <= i.len / 2 - 4; t += 12) {
					let n = new e.CylinderGeometry(.25, .3, c + 4, 8);
					n.translate(0, (c + 4) / 2, 0), h.add(n, f.metal, i.nu ? p(a, i.nu * (i.off + 3 + l), 0, t) : p(a, t, 0, i.nv * (i.off + 3 + l)));
				}
				if (t.name) {
					let n = /centenario|quilmes atl/i.test(t.name) ? "QUILMES ATLÉTICO CLUB" : t.name.toUpperCase(), r = new e.MeshStandardMaterial({
						map: y(n, t.colors[1], (t.colors[0], "#ffffff")),
						roughness: .6
					}), o = Math.atan2(i.nu, i.nv) + Math.PI, s = i.off + 3 + .5;
					h.add(new e.PlaneGeometry(Math.min(40, i.len * .5), 3), r, p(a, i.nu * s, c + 2.4, i.nv * s, o)), h.add(new e.PlaneGeometry(Math.min(40, i.len * .5), 3), r, p(a, i.nu * (s + l + .4), c + 2.4, i.nv * (s + l + .4), o + Math.PI));
				}
			}
		}
		for (let [t, i] of [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		]) {
			let o = t * (n.hu + 3 + l * .7), s = i * (n.hv + 3 + l * .7), c = new e.CylinderGeometry(.5, .9, u + 22, 8);
			c.translate(0, (u + 22) / 2, 0), h.add(c, f.metal, p(a, o, 0, s));
			let d = g(5, 3, .6);
			h.add(d, f.flood, p(a, o, u + 21, s, Math.atan2(-t, -i))), r.addCircle(...m(n, o, s), 1, "pole");
		}
		t.turf && S.add(new e.PlaneGeometry(n.hu * 2, n.hv * 2).rotateX(-Math.PI / 2), c(t.turf, {
			depthWrite: !1,
			polygonOffset: !0,
			polygonOffsetFactor: -1
		}), p(a, 0, .05, 0)), s.push([
			n.cx,
			n.cz,
			Math.hypot(n.hu, n.hv) + l + 6
		]);
	}
	for (let t of C("pitch")) {
		let n = t.box, r = d(n), i = .14, a = .06, o = (t, n, o, s = 0) => S.add(new e.PlaneGeometry(t, i).rotateX(-Math.PI / 2), f.line, p(r, n, a, o, s)), s = n.hu - 1, c = n.hv - 1;
		o(s * 2, 0, c), o(s * 2, 0, -c), o(c * 2, s, 0, Math.PI / 2), o(c * 2, -s, 0, Math.PI / 2), o(c * 2, 0, 0, Math.PI / 2);
		let l = Math.min(9.15, c * .3);
		S.add(new e.RingGeometry(l - i / 2, l + i / 2, 40).rotateX(-Math.PI / 2), f.line, p(r, 0, a, 0));
		let u = Math.min(7.32, c * .3), m = u > 5 ? 2.44 : 2, _ = Math.min(16.5, s * .3), v = Math.min(40.3, c * 1.3);
		for (let t of [-1, 1]) {
			o(v, t * (s - _), 0, Math.PI / 2), o(_, t * (s - _ / 2), v / 2), o(_, t * (s - _ / 2), -v / 2);
			for (let n of [-1, 1]) {
				let i = new e.CylinderGeometry(.06, .06, m, 6);
				i.translate(0, m / 2, 0), h.add(i, f.white, p(r, t * s, 0, n * u / 2));
			}
			h.add(g(.12, .12, u), f.white, p(r, t * s, m - .06, 0)), h.add(g(.1, .1, u), f.white, p(r, t * (s + 1.5), 0, 0));
		}
	}
	for (let t of C("brewery")) {
		let n = t.box, i = d(n), a = t.h || 12;
		for (let t = 0; t < 4; t++) for (let r of [-5.2, 5.2]) {
			let o = new e.CylinderGeometry(4.5, 4.5, a + 18, 20);
			o.translate(0, (a + 18) / 2, 0), h.add(o, f.silo, p(i, n.hu - 8 - t * 9.6, 0, r));
			let s = new e.ConeGeometry(4.6, 2.2, 20);
			s.translate(0, a + 19.1, 0), h.add(s, f.silo, p(i, n.hu - 8 - t * 9.6, 0, r));
		}
		h.add(g(40, 3, 1.4), f.metal, p(i, n.hu - 22, a + 18, 0));
		let s = new e.CylinderGeometry(1.7, 2.8, a + 38, 16);
		s.translate(0, (a + 38) / 2, 0), h.add(s, f.brick, p(i, -n.hu + 10, 0, 0)), h.add(new e.CylinderGeometry(2, 2, 1.2, 16).translate(0, a + 38, 0), f.stuccoDark, p(i, -n.hu + 10, 0, 0));
		let c = new e.MeshStandardMaterial({
			map: v(1024, 256, (e, t, n) => {
				e.fillStyle = "#12308a", e.fillRect(0, 0, t, n), e.fillStyle = "#ffffff", e.fillRect(0, n - 46, t, 14), e.fillStyle = "#d7263d", e.fillRect(0, n - 32, t, 14), e.fillStyle = "#ffffff", e.font = "italic bold 170px Georgia, serif", e.textAlign = "center", e.textBaseline = "middle", e.fillText("Quilmes", t / 2, n / 2 - 16);
			}),
			emissive: 16777215,
			emissiveIntensity: 0,
			roughness: .5
		});
		c.emissiveMap = c.map, o.push([c, .9]);
		let l = Math.min(70, n.hu * .5), u = l / 4;
		for (let e of [
			-l * .4,
			0,
			l * .4
		]) h.add(g(.5, 6, .5), f.iron, p(i, e, a, 0));
		for (let t of [0, Math.PI]) h.add(new e.PlaneGeometry(l, u), c, p(i, 0, a + 5 + u / 2, t ? -.15 : .15, t));
		r.addCircle(...m(n, -n.hu + 10, 0), 2.8, "building");
	}
	for (let t of C("plaza")) {
		let n = t.box, r = d(n), i = n.hu - 3, a = n.hv - 3, o = (t, i, a, o, c) => {
			let l = Math.hypot(a - t, o - i), u = new e.PlaneGeometry(l, c).rotateX(-Math.PI / 2), d = u.attributes.uv;
			for (let e = 0; e < d.count; e++) d.setXY(e, d.getX(e) * l / 4, d.getY(e) * c / 4);
			S.add(u, f.path, p(r, (t + a) / 2, .045, (i + o) / 2, -Math.atan2(o - i, a - t)));
			for (let e = 0; e <= l; e += 6) s.push([...m(n, t + (a - t) * e / l, i + (o - i) * e / l), c / 2 + 1.5]);
		};
		o(-i, -a, i, -a, 3), o(-i, a, i, a, 3), o(-i, -a, -i, a, 3), o(i, -a, i, a, 3), o(-i, -a, i, a, 3.2), o(-i, a, i, -a, 3.2), o(-i, 0, i, 0, 2.6), o(0, -a, 0, a, 2.6);
		let c = new e.CircleGeometry(Math.min(9, a * .3), 32).rotateX(-Math.PI / 2);
		S.add(c, f.path, p(r, 0, .05, 0)), s.push([
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
				let s = t * i * e, c = n * a * e, l = -Math.sin(o) * 2.4, u = Math.cos(o) * 2.4, d = -o;
				h.add(g(1.8, .45, .5), f.wood, p(r, s + l, 0, c + u, d)), h.add(g(1.8, .5, .08), f.wood, p(r, s + l * 1.1, .45, c + u * 1.1, d));
			}
			let s = t * i * .5, c = n * a * .5;
			h.add(new e.CylinderGeometry(.07, .1, 3.6, 6).translate(0, 1.8, 0), f.iron, p(r, s, 0, c)), h.add(new e.SphereGeometry(.32, 12, 8), f.lamp, p(r, s, 3.8, c));
		}
		j(t.monument, r, n);
	}
	function j(t, n, i) {
		if (t === "equestrian") {
			h.add(g(7, 1, 4.6), f.stuccoDark, p(n, 0, 0, 0)), h.add(g(5.6, 4.5, 3), f.stone, p(n, 0, 1, 0)), h.add(g(6, .5, 3.4), f.stuccoDark, p(n, 0, 5.5, 0));
			let t = 1.7, a = (r, i, a, o, s, c, l = 0) => {
				let u = new e.BoxGeometry(r * t, i * t, a * t);
				u.rotateZ(l), u.translate(o * t, 6 + s * t, c * t), h.add(u, f.bronze, n.clone());
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
			].map(([e, t]) => m(i, e, t)), 6, "building");
		} else if (t === "obelisk") {
			h.add(g(4, .8, 4), f.stuccoDark, p(n, 0, 0, 0));
			let t = new e.CylinderGeometry(.9, 1.4, 12, 4);
			t.rotateY(Math.PI / 4), t.translate(0, 6.8, 0), h.add(t, f.cream, p(n, 0, 0, 0));
			let a = new e.ConeGeometry(.95, 1.6, 4);
			a.rotateY(Math.PI / 4), a.translate(0, 13.6, 0), h.add(a, f.cream, p(n, 0, 0, 0)), r.addCircle(i.cx, i.cz, 2.2, "building");
		} else if (t === "fountain") {
			let t = new e.CylinderGeometry(5, 5.2, .7, 32, 1, !0);
			t.translate(0, .35, 0), h.add(t, f.stone, p(n, 0, 0, 0)), h.add(new e.TorusGeometry(5.05, .18, 6, 32).rotateX(Math.PI / 2), f.stone, p(n, 0, .7, 0)), h.add(new e.CircleGeometry(5, 32).rotateX(-Math.PI / 2), f.water, p(n, 0, .55, 0)), h.add(new e.CylinderGeometry(.5, .7, 2.2, 12).translate(0, 1.1, 0), f.stone, p(n, 0, 0, 0)), h.add(new e.CylinderGeometry(1.8, .6, .5, 20).translate(0, 2.3, 0), f.stone, p(n, 0, 0, 0)), h.add(new e.CylinderGeometry(.25, .35, 1.2, 10).translate(0, 3, 0), f.stone, p(n, 0, 0, 0)), h.add(new e.SphereGeometry(.45, 12, 8).translate(0, 3.8, 0), f.stone, p(n, 0, 0, 0)), r.addCircle(i.cx, i.cz, 5.3, "building");
		} else h.add(g(1.2, 2, 1.2), f.stone, p(n, 0, 0, 0)), h.add(g(.8, .5, .4), f.bronze, p(n, 0, 2, 0)), h.add(g(.36, .45, .36), f.bronze, p(n, 0, 2.5, 0)), r.addCircle(i.cx, i.cz, .9, "building");
	}
	return h.build(n), S.build(n, {
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
var C = 2.6, w = 34, T = .32;
(() => {
	let t = (t, n, r, i, a, o) => new e.BoxGeometry(t, n, r).translate(i, a + n / 2, o), n = [t(C, T, w, 0, 0, 0)], r = [t(.3, .01, w, -2.6 / 2 + .15, T, 0)], i = [t(3, .12, w * .7, .1, 3, 0)];
	for (let e = -11.22; e <= w * .34; e += w * .165) i.push(t(.12, 2.7, .12, C / 2 - .25, T, e));
	return i.push(t(.1, 1, w, C / 2 - .05, T, 0)), {
		deck: n,
		edge: r,
		frame: i,
		glass: [t(.03, 1.6, w * .66, C / 2 - .12, 1.32, 0)],
		sign: [t(.08, .7, 3.2, .1, 3.12, w * .35 - 1.6)]
	};
})();
//#endregion
//#region src/world/geobuf.js
var E = class {
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
}, D = [
	0,
	1,
	2,
	0,
	2,
	3
], ee = [
	0,
	2,
	1,
	0,
	3,
	2
], O = (e) => Math.max(-127, Math.min(127, Math.round(e * 127))), k = (e) => Math.max(0, Math.min(255, Math.round(e * 255))), A = class {
	constructor(e = !1) {
		this.layered = e, this.pos = new E(Float32Array), this.nor = new E(Int8Array), this.uv = new E(Float32Array), this.col = new E(Uint8Array), this.lay = new E(Float32Array);
	}
	tri(e, t, n, r, i, a, o, s, c = 0) {
		let l = t[0] - e[0], u = t[1] - e[1], d = t[2] - e[2], f = n[0] - e[0], p = n[1] - e[1], m = n[2] - e[2], h = u * m - d * p, g = d * f - l * m, _ = l * p - u * f;
		s && h * s[0] + g * s[1] + _ * s[2] < 0 && ([t, n] = [n, t], [i, a] = [a, i], h = -h, g = -g, _ = -_);
		let v = Math.hypot(h, g, _) || 1;
		h = O(h / v), g = O(g / v), _ = O(_ / v);
		let y = k(o.r), b = k(o.g), x = k(o.b);
		for (let [o, s] of [
			[e, r],
			[t, i],
			[n, a]
		]) this.pos.push(o[0], o[1], o[2]), this.nor.push(h, g, _), this.nor.push(0), this.uv.push(s[0], s[1]), this.col.push(y, b, x), this.col.push(255), this.layered && this.lay.push(c);
	}
	quadRaw(e, t, n, r, i) {
		let a = e[3] - e[0], o = e[4] - e[1], s = e[5] - e[2], c = e[6] - e[0], l = e[7] - e[1], u = e[8] - e[2], d = o * u - s * l, f = s * c - a * u, p = a * l - o * c, m = d * n + f * r + p * i < 0;
		m && (d = -d, f = -f, p = -p);
		let h = Math.hypot(d, f, p) || 1, g = O(d / h), _ = O(f / h), v = O(p / h), y = k(t.r), b = k(t.g), x = k(t.b), S = m ? ee : D;
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
};
new e.Vector3(), new e.Vector3(), new e.Matrix3(), new e.Matrix4();
function j(e) {
	let t = e.index ? e.toNonIndexed() : e;
	for (let e of Object.keys(t.attributes)) e !== "position" && e !== "normal" && t.deleteAttribute(e);
	return t;
}
//#endregion
//#region src/world/conurbanoTextures.js
var M = 256;
function N(e = M, t = M) {
	let n = document.createElement("canvas");
	return n.width = e, n.height = t, [n, n.getContext("2d", { willReadFrequently: !0 })];
}
function P(e, t, n, r, i, a = .08, o = 0, s = 0) {
	for (let c = 0; c < r; c++) {
		let r = Math.floor(i() * 255);
		e.fillStyle = `rgba(${r},${r},${r},${a})`, e.fillRect(o + i() * t, s + i() * n, 1 + i() * 3, 1 + i() * 3);
	}
}
function F(e, t, n, r, i, a) {
	let o = e.createRadialGradient(n, r, 0, n, r, i);
	o.addColorStop(0, a), o.addColorStop(1, "rgba(0,0,0,0)"), e.fillStyle = o, e.beginPath(), e.ellipse(n, r, i, i * (.5 + t() * .8), t() * 3, 0, Math.PI * 2), e.fill();
}
function I(e, t, n, r, i = 6) {
	for (let a = 0; a < i; a++) F(e, t, t() * n, r - t() * 20, 20 + t() * 40, `rgba(70,60,45,${.12 + t() * .12})`);
	for (let a = 0; a < i * 2; a++) {
		let i = t() * n, a = t() * r, o = 10 + t() * 40, s = e.createLinearGradient(i, a, i, a + o);
		s.addColorStop(0, "rgba(50,45,35,0.18)"), s.addColorStop(1, "rgba(50,45,35,0)"), e.fillStyle = s, e.fillRect(i, a, 2 + t() * 4, o);
	}
}
function te(e, t, n, r, i = 4) {
	e.strokeStyle = "rgba(40,35,30,0.35)", e.lineWidth = 1;
	for (let a = 0; a < i; a++) {
		let i = t() * n, a = t() * r;
		e.beginPath(), e.moveTo(i, a);
		for (let n = 0; n < 6; n++) e.lineTo(i += (t() - .5) * 14, a += 3 + t() * 8);
		e.stroke();
	}
}
function ne(e, t, n, r, i, a, o = 14, s = 8) {
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
function L(e, t, n, r, i, a) {
	e.fillStyle = `hsl(40,${4 + t() * 5}%,${58 + t() * 8}%)`, e.fillRect(n, r, i, a), P(e, i, a, i * a / 12, t, .14, n, r), e.fillStyle = "rgba(0,0,0,0.12)", e.fillRect(n, r + a - 2, i, 2);
}
function R(e, t, n, r, i, a, o) {
	if (a) e.fillStyle = o() < .8 ? `hsl(${34 + o() * 12},90%,${52 + o() * 15}%)` : `hsl(200,55%,${60 + o() * 15}%)`;
	else {
		let a = e.createLinearGradient(t, n, t + r, n + i);
		a.addColorStop(0, "#26313a"), a.addColorStop(.5, "#56697a"), a.addColorStop(1, "#222b33"), e.fillStyle = a;
	}
	e.fillRect(t, n, r, i);
}
function re(e, t, n, r, i, a = 7, o = "#1b1b1b") {
	e.fillStyle = o;
	for (let o = t + a / 2; o < t + r; o += a) e.fillRect(o, n, 2, i);
	e.fillRect(t, n, r, 2), e.fillRect(t, n + i - 2, r, 2), e.fillRect(t, n + i * .45, r, 2);
}
function z(e, t, n, r, i, a, o, s = {}) {
	if (e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(r - 3, i - 3, a + 6, o + 7), e.fillStyle = "rgba(255,255,255,0.35)", e.fillRect(r - 4, i + o + 1, a + 8, 3), R(e, r, i, a, o, !1, n), t && n() < .5 && R(t, r, i, a, o, !0, n), s.persiana ?? n() < .6) {
		let s = o * (.25 + n() * .75);
		e.fillStyle = n() < .5 ? "#b9b2a2" : "#7d6a52", e.fillRect(r, i, a, s), e.fillStyle = "rgba(0,0,0,0.25)";
		for (let t = i; t < i + s; t += 3) e.fillRect(r, t, a, 1);
		t && (t.fillStyle = "#000", t.fillRect(r, i, a, s));
	}
	(s.reja ?? !0) && re(e, r - 1, i - 1, a + 2, o + 2, 6 + n() * 3);
}
function ie(e, t, n, r, i, a, o) {
	let s = n();
	if (e.fillStyle = "rgba(0,0,0,0.3)", e.fillRect(r - 3, i - 3, a + 6, o + 3), s < .45) e.fillStyle = `hsl(${22 + n() * 10},${35 + n() * 20}%,${22 + n() * 12}%)`, e.fillRect(r, i, a, o), e.strokeStyle = "rgba(0,0,0,0.35)", e.lineWidth = 2, e.strokeRect(r + 5, i + 6, a - 10, o * .4), e.strokeRect(r + 5, i + o * .52, a - 10, o * .4);
	else {
		e.fillStyle = [
			"#2e3a33",
			"#262626",
			"#4a3b2c",
			"#34404c",
			"#6b6e70"
		][Math.floor(n() * 5)], e.fillRect(r, i, a, o), R(e, r + 6, i + 8, a - 12, o * .3, !1, n), re(e, r + 6, i + 8, a - 12, o * .3, 5), e.fillStyle = "rgba(255,255,255,0.1)";
		for (let t = i + o * .45; t < i + o; t += 5) e.fillRect(r, t, a, 1);
	}
	e.fillStyle = "#c9b27a", e.fillRect(r + a - 8, i + o * .5, 4, 3), e.fillStyle = "#ddd", e.fillRect(r + a / 2 - 3, i - 12, 6, 5), t && (t.fillStyle = "#ffd890", t.fillRect(r + a / 2 - 4, i - 13, 8, 7));
}
function ae(e, t, n, r, i, a, o = t() < .4) {
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
	for (let o = 0; o < 6; o++) F(e, t, n + t() * i, r + a - t() * 12, 6 + t() * 10, "rgba(120,70,30,0.3)");
}
function oe(e, t, n, r, i, a) {
	e.lineCap = "round", e.lineJoin = "round", e.strokeStyle = `hsl(${t() * 360},${60 + t() * 30}%,${35 + t() * 25}%)`, e.lineWidth = 2 + t() * 4, e.beginPath();
	let o = n, s = r + a / 2;
	e.moveTo(o, s);
	for (let n = 0; n < 8; n++) o += i / 8, e.quadraticCurveTo(o - i / 16, r + t() * a, o, r + t() * a);
	e.stroke();
}
function se(e, t, n) {
	e.fillStyle = "#ece7dc", e.fillRect(0, 0, M, M), P(e, M, M, 4e3, t, .06), L(e, t, 0, 0, M, 10), I(e, t, M, M, 4), te(e, t, M, M, 3);
	let r = e.createLinearGradient(0, 216, 0, M);
	if (r.addColorStop(0, "rgba(90,75,50,0)"), r.addColorStop(1, "rgba(90,75,50,0.4)"), e.fillStyle = r, e.fillRect(0, 216, M, 40), n >= 1) for (let n = 0; n < 2; n++) oe(e, t, t() * 180, 110 + t() * 90, 40 + t() * 60, 25 + t() * 25);
	n >= 2 && (e.font = `bold ${26 + t() * 12}px Impact, Arial Black, sans-serif`, e.textAlign = "center", e.fillStyle = `hsl(${t() < .5 ? 210 : t() * 360},65%,${30 + t() * 20}%)`, e.fillText(ce[Math.floor(t() * ce.length)], M / 2 + (t() - .5) * 60, 140 + t() * 50, 226));
}
var ce = [
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
function le(e, t) {
	e.strokeStyle = t, e.lineWidth = 10, e.strokeRect(5, 5, 246, 246);
}
function ue(e, t, n, r) {
	let i = n() < .6 ? "#c7cacc" : "#f2f2ef";
	e.fillStyle = i, e.fillRect(0, 0, M, M), t.fillStyle = "#000", t.fillRect(0, 0, M, M);
	let a = [[
		14,
		14,
		M / 2 - 18,
		228
	], [
		132,
		14,
		M / 2 - 18,
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
	e.fillStyle = i, e.fillRect(M / 2 - 6, 8, 12, 240), e.fillStyle = "rgba(0,0,0,0.3)", e.fillRect(134, 8, 2, 240), e.fillRect(12, 240, 232, 3), e.strokeStyle = "rgba(0,0,0,0.35)", e.lineWidth = 3, e.strokeRect(2, 2, 252, 252);
}
function de(e, t, n, r, i, a) {
	e.fillStyle = "#ddd5c6", e.fillRect(0, 0, M, M), e.fillStyle = n, e.fillRect(8, 30, 240, 196), e.fillStyle = r, e.textAlign = "center", e.textBaseline = "middle", e.font = "bold 54px Impact, Arial Black, sans-serif", e.fillText(i, M / 2, 105, 226), e.font = "bold 22px Arial, sans-serif", e.fillText(a, M / 2, 165, 226), e.fillStyle = "rgba(235,228,214,0.35)", e.fillRect(0, 0, M, M);
	for (let n = 0; n < 40; n++) {
		e.fillStyle = `rgba(221,213,198,${.5 + t() * .5})`;
		let n = t() < .5 ? t() * 30 : M - t() * 30;
		e.fillRect(n, 30 + t() * 196, 4 + t() * 12, 3 + t() * 10);
	}
	P(e, M, M, 3e3, t, .08), I(e, t, M, M, 3);
}
var fe = {
	medianera(e, t, n) {
		e.fillStyle = "#e6dfd2", e.fillRect(0, 0, M, M);
		for (let t = 0; t < 5; t++) e.fillStyle = `rgba(${200 + n() * 40},${190 + n() * 40},${170 + n() * 40},0.5)`, e.fillRect(n() * M, n() * M, 30 + n() * 80, 20 + n() * 60);
		P(e, M, M, 5e3, n, .07), I(e, n, M, M, 4);
		for (let t = 0; t < 2; t++) F(e, n, n() * M, n() * M * .6, 25 + n() * 30, "rgba(90,85,70,0.1)");
		te(e, n, M, M, 4);
		let r = 40 + n() * 156, i = 40 + n() * 156;
		e.save(), e.beginPath(), e.moveTo(r, i);
		for (let t = 0; t < 9; t++) e.lineTo(r + (n() - .3) * 40, i + (n() - .3) * 24);
		e.closePath(), e.clip(), ne(e, n, r - 20, i - 12, 70, 50), e.restore(), e.fillStyle = "rgba(0,0,0,0.1)", e.fillRect(0, 0, M, 4);
	},
	medianeraLadrillo(e, t, n) {
		ne(e, n, 0, 0, M, M);
		for (let t of [0, M / 2]) L(e, n, 0, t, M, 9);
		for (let t of [0, M / 2]) L(e, n, t, 0, 9, M);
		I(e, n, M, M, 4);
	},
	hueco(e, t, n) {
		ne(e, n, 0, 0, M, M);
		for (let t of [0, M / 2]) L(e, n, 0, t, M, 10);
		for (let t of [0, M / 2]) L(e, n, t - 1, 0, 10, M);
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
				F(e, n, a + 60, o + 112, 16, "rgba(120,70,30,0.35)");
				continue;
			}
			if (s < .15) continue;
			let c = a + 34 + n() * 20, l = o + 34, u = 40 + n() * 14, d = 36 + n() * 8;
			if (L(e, n, c - 4, l - 5, u + 8, 5), s < .3) {
				e.fillStyle = n() < .5 ? "#2f5f9e" : `hsl(${n() * 360},40%,40%)`, e.fillRect(c, l, u, d), e.fillStyle = "rgba(0,0,0,0.25)";
				for (let t = 0; t < 4; t++) e.fillRect(c + n() * u, l, 1.5, d);
			} else R(e, c, l, u, d, !1, n), n() < .45 && R(t, c, l, u, d, !0, n), e.strokeStyle = s < .7 ? "#b8bcbf" : "#2a2a2a", e.lineWidth = 3, e.strokeRect(c, l, u, d), e.beginPath(), e.moveTo(c + u / 2, l), e.lineTo(c + u / 2, l + d), e.stroke(), n() < .5 && re(e, c, l, u, d, 7);
		}
		I(e, n, M, M, 4);
	},
	villa(e, t, n) {
		e.fillStyle = "#ece8e0", e.fillRect(0, 0, M, M), P(e, M, M, 6e3, n, .1);
		for (let t = 0; t < 4; t++) {
			let t = n() * 196, r = n() * 206, i = 25 + n() * 45, a = 15 + n() * 30;
			e.save(), e.beginPath(), e.moveTo(t, r + a * n());
			for (let o = 0; o < 7; o++) e.lineTo(t + i * n(), r + a * n());
			e.closePath(), e.clip(), ne(e, n, t, r, i, a), e.restore();
		}
		for (let t of [M / 2 - 8, 248]) e.fillStyle = "rgba(0,0,0,0.12)", e.fillRect(0, t, M, 8);
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
			n() < .2 || z(e, t, n, a + 36 + n() * 20, o + 38, 40 + n() * 10, 36, { persiana: n() < .3 });
		}
		for (let t of [M / 2, M]) {
			let n = e.createLinearGradient(0, t - 26, 0, t);
			n.addColorStop(0, "rgba(90,70,45,0)"), n.addColorStop(1, "rgba(90,70,45,0.45)"), e.fillStyle = n, e.fillRect(0, t - 26, M, 26);
		}
		I(e, n, M, M, 3);
	},
	muro0: (e, t, n) => se(e, n, 2),
	muro1: (e, t, n) => se(e, n, 1),
	muro2: (e, t, n) => se(e, n, 0),
	revoque(e, t, n) {
		e.fillStyle = "#efe9de", e.fillRect(0, 0, M, M);
		for (let t = 0; t < 6; t++) F(e, n, n() * M, n() * M, 30 + n() * 60, `rgba(${n() < .5 ? "255,255,255" : "180,170,150"},0.12)`);
		P(e, M, M, 7e3, n, .05);
		for (let t = 0; t < 4; t++) {
			let t = n() * M, r = 20 + n() * 50, i = e.createLinearGradient(0, M * .3, 0, M * .3 + r);
			i.addColorStop(0, "rgba(60,55,45,0.1)"), i.addColorStop(1, "rgba(60,55,45,0)"), e.fillStyle = i, e.fillRect(t, M * .3, 2 + n() * 3, r);
		}
		let r = e.createLinearGradient(0, 226, 0, M);
		r.addColorStop(0, "rgba(80,70,50,0)"), r.addColorStop(1, "rgba(80,70,50,0.25)"), e.fillStyle = r, e.fillRect(0, 226, M, 30);
	},
	ventana: (e, t, n) => ue(e, t, n, "open"),
	ventanaCortina: (e, t, n) => ue(e, t, n, "closed"),
	ventanaPersiana: (e, t, n) => ue(e, t, n, "persiana"),
	puerta0(e, t, n) {
		e.fillStyle = "#5e3a22", e.fillRect(0, 0, M, M);
		for (let t = 0; t < M; t += 4) e.fillStyle = `rgba(${n() < .5 ? "255,220,180" : "30,15,5"},${.04 + n() * .06})`, e.fillRect(t, 0, 2 + n() * 3, M);
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
		R(e, 44, 34, 168, 50, !1, n), R(t, 44, 34, 168, 50, !0, n), re(e, 44, 34, 168, 50, 14, "#20180f"), e.fillStyle = "#c9a646", e.fillRect(196, 128, 18, 6), e.fillRect(204, 140, 5, 10), le(e, "#3a2414");
	},
	puerta1(e, t, n) {
		e.fillStyle = "#e8e8e8", e.fillRect(0, 0, M, M);
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
		R(e, 30, 20, 196, 100, !1, n), R(t, 30, 20, 196, 100, !0, n), e.strokeStyle = "#1b1b1b", e.lineWidth = 3;
		for (let t = 40; t < 226; t += 16) e.beginPath(), e.moveTo(t, 20), e.lineTo(t, 120), e.stroke();
		for (let t = 48; t < 220; t += 32) e.beginPath(), e.arc(t, 70, 9, 0, Math.PI * 2), e.stroke();
		e.fillStyle = "#777", e.fillRect(200, 132, 16, 8), P(e, M, M, 1500, n, .05);
		for (let t = 0; t < 4; t++) F(e, n, n() * M, M - n() * 30, 10 + n() * 14, "rgba(110,70,30,0.3)");
		le(e, "#2a2a2a");
	},
	portal(e, t, n) {
		e.fillStyle = "#4a3a28", e.fillRect(0, 0, M, M), t.fillStyle = "#000", t.fillRect(0, 0, M, M);
		for (let n of [14, 132]) {
			let r = e.createLinearGradient(n, 14, n + 60, M);
			r.addColorStop(0, "#7f93a3"), r.addColorStop(.5, "#3a4752"), r.addColorStop(1, "#232b31"), e.fillStyle = r, e.fillRect(n, 14, M / 2 - 18, 216), t.fillStyle = "#e8d2a0", t.fillRect(n, 14, M / 2 - 18, 216), e.fillStyle = "rgba(255,255,255,0.12)", e.fillRect(n + 10, 14, 18, 216), e.fillStyle = "rgba(30,25,20,0.5)", e.fillRect(n + 20, 166, 40, 64);
		}
		e.fillStyle = "#c9a646", e.fillRect(M / 2 - 16, M / 2, 6, 40), e.fillRect(138, M / 2, 6, 40), e.fillStyle = "#3a2c1e", e.fillRect(0, 230, M, 26);
	},
	pub0: (e, t, n) => de(e, n, "#c62828", "#fff4d6", "MUDANZAS", "Y FLETES · 4253-1180"),
	pub1: (e, t, n) => de(e, n, "#1f4e8c", "#ffffff", "PINTURERÍA", "EL PINCEL · DESDE 1978"),
	pub2: (e, t, n) => de(e, n, "#f2c200", "#1b1b1b", "GOMERÍA", "24 HS · AUXILIO"),
	huella(e, t, n) {
		e.fillStyle = "#e2dacb", e.fillRect(0, 0, M, M), P(e, M, M, 5e3, n, .07);
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
		e.stroke(), I(e, n, M, M, 4), te(e, n, M, M, 3);
	},
	porton(e, t, n) {
		e.fillStyle = "#9a9a98", e.fillRect(0, 0, M, M);
		for (let t = 0; t < M; t += 10) {
			let n = e.createLinearGradient(t, 0, t + 10, 0);
			n.addColorStop(0, "rgba(255,255,255,0.18)"), n.addColorStop(.5, "rgba(0,0,0,0.05)"), n.addColorStop(1, "rgba(0,0,0,0.22)"), e.fillStyle = n, e.fillRect(t, 0, 10, M);
		}
		e.strokeStyle = "#3a3a3a", e.lineWidth = 8, e.strokeRect(4, 4, 248, 248), e.fillRect(M / 2 - 2, 0, 4, M), e.fillStyle = "#3a3a3a", e.fillRect(M / 2 - 3, 0, 6, M), e.fillStyle = "#d8c070", e.fillRect(136, M / 2, 10, 5);
		for (let t = 0; t < 8; t++) F(e, n, n() * M, M - n() * 50, 8 + n() * 16, "rgba(120,65,25,0.35)");
		n() < .6 && oe(e, n, 30 + n() * 60, 100 + n() * 60, 100 + n() * 60, 40);
	},
	roofMembrana(e, t, n) {
		e.fillStyle = "#b9bbb8", e.fillRect(0, 0, M, M);
		for (let t = 0; t < M; t += 43) e.fillStyle = `rgba(${200 + n() * 30},${200 + n() * 30},${200 + n() * 30},0.5)`, e.fillRect(0, t, M, 40), e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(0, t + 40, M, 3);
		P(e, M, M, 6e3, n, .1);
		for (let t = 0; t < 6; t++) e.fillStyle = `rgba(40,40,40,${.2 + n() * .3})`, e.fillRect(n() * M, n() * M, 15 + n() * 40, 10 + n() * 30);
		for (let t = 0; t < 5; t++) F(e, n, n() * M, n() * M, 20 + n() * 30, "rgba(80,70,50,0.25)");
	},
	roofBaldosa(e, t, n) {
		e.fillStyle = "#c9b9a8", e.fillRect(0, 0, M, M);
		for (let t = 0; t < M; t += 8) for (let r = 0; r < M; r += 8) e.fillStyle = `hsl(${12 + n() * 8},${45 + n() * 15}%,${40 + n() * 10}%)`, e.fillRect(r + 1, t + 1, 7, 7);
		for (let t = 0; t < 6; t++) F(e, n, n() * M, n() * M, 20 + n() * 40, "rgba(50,50,40,0.25)");
	},
	chapa(e, t, n) {
		e.fillStyle = "#a7aaac", e.fillRect(0, 0, M, M);
		for (let t = 0; t < M; t += 4) e.fillStyle = "rgba(255,255,255,0.22)", e.fillRect(t, 0, 1, M), e.fillStyle = "rgba(0,0,0,0.22)", e.fillRect(t + 2, 0, 1.5, M);
		for (let t = 60; t < M; t += 64 + n() * 20) e.fillStyle = "rgba(0,0,0,0.35)", e.fillRect(0, t, M, 2);
		for (let t = 0; t < 10; t++) F(e, n, n() * M, n() * M, 15 + n() * 45, `rgba(${130 + n() * 40},${60 + n() * 20},20,${.25 + n() * .3})`);
		for (let t = 0; t < 20; t++) {
			let t = n() * M, r = n() * M, i = 20 + n() * 60, a = e.createLinearGradient(t, r, t, r + i);
			a.addColorStop(0, "rgba(120,60,20,0.4)"), a.addColorStop(1, "rgba(120,60,20,0)"), e.fillStyle = a, e.fillRect(t, r, 2 + n() * 3, i);
		}
	}
};
function pe(e, t, n, r) {
	if (e.save(), t.save(), e.scale(1, 2), t.scale(1, 2), e.fillStyle = "#efe9dd", e.fillRect(0, 0, M, 128), P(e, M, 128, 3500, n, .08), e.fillStyle = "rgba(0,0,0,0.1)", e.fillRect(0, 0, M, 5), r === 3) for (let t = 0; t < M; t += 16) for (let r = 110; r < 128; r += 6) e.fillStyle = `hsl(35,${10 + n() * 10}%,${45 + n() * 15}%)`, e.fillRect(t + r / 6 % 2 * 8, r, 15, 5);
	else e.fillStyle = `hsl(40,5%,${45 + n() * 15}%)`, e.fillRect(0, 111, M, 17);
	r === 0 ? (ie(e, t, n, 18, 23, 38, 88), z(e, t, n, 76, 32, 50, 46), ae(e, n, 146, 15, 100, 96)) : r === 1 ? (z(e, t, n, 22, 32, 52, 46), ie(e, t, n, 108, 23, 38, 88), z(e, t, n, 178, 32, 52, 46)) : r === 2 ? (ae(e, n, 14, 15, 118, 96, !0), ie(e, t, n, 162, 23, 38, 88), e.fillStyle = "#333", e.fillRect(214, 50, 22, 14)) : (z(e, t, n, 16, 30, 56, 50, { persiana: !0 }), ie(e, t, n, 104, 21, 40, 90), z(e, t, n, 170, 30, 56, 50)), I(e, n, M, 128, 5), e.restore(), t.restore();
}
function me(e, t) {
	let r = {};
	{
		let i = n(31), [a, o] = N();
		o.fillStyle = "#7b6650", o.fillRect(0, 0, M, M);
		for (let e = 0; e < 14; e++) F(o, i, i() * M, i() * M, 20 + i() * 40, i() < .5 ? "rgba(60,48,36,0.35)" : "rgba(150,130,100,0.3)");
		for (let e = 0; e < 9e3; e++) {
			let e = 70 + i() * 80;
			o.fillStyle = `rgba(${e + 20},${e},${e - 20},0.35)`, o.fillRect(i() * M, i() * M, 1 + i() * 2, 1 + i() * 2);
		}
		for (let e = 0; e < 25; e++) o.fillStyle = `hsl(${i() * 360},${20 + i() * 30}%,${45 + i() * 35}%)`, o.fillRect(i() * M, i() * M, 2 + i() * 2, 1 + i() * 2);
		for (let e = 0; e < 5; e++) {
			o.fillStyle = "rgba(70,90,40,0.5)";
			for (let e = 0; e < 60; e++) o.fillRect(i() * M, i() * M, 1, 3);
		}
		r.dirt = t(a, e);
	}
	{
		let i = n(32), [a, o] = N();
		o.fillStyle = "#8f8a55", o.fillRect(0, 0, M, M);
		for (let e = 0; e < 12; e++) F(o, i, i() * M, i() * M, 25 + i() * 45, i() < .4 ? "rgba(120,100,70,0.45)" : "rgba(90,110,50,0.35)");
		for (let e = 0; e < 12e3; e++) o.fillStyle = `hsl(${40 + i() * 35},${25 + i() * 25}%,${28 + i() * 30}%)`, o.fillRect(i() * M, i() * M, 1, 2 + i() * 5);
		for (let e = 0; e < 18; e++) o.fillStyle = `hsl(${i() * 360},${20 + i() * 30}%,${50 + i() * 35}%)`, o.fillRect(i() * M, i() * M, 2 + i() * 2, 1 + i() * 2);
		r.dryGrass = t(a, e);
	}
	{
		let i = n(33), [a, o] = N();
		o.fillStyle = "#9d978c", o.fillRect(0, 0, M, M), P(o, M, M, 7e3, i, .14);
		for (let e = 0; e < 6; e++) F(o, i, i() * M, i() * M, 20 + i() * 30, "rgba(90,75,55,0.4)");
		te(o, i, M, M, 8);
		for (let e of [0, 216]) {
			let t = o.createLinearGradient(e, 0, e + 40, 0), n = "rgba(100,80,58,0.85)", r = "rgba(100,80,58,0)";
			t.addColorStop(0, e ? r : n), t.addColorStop(1, e ? n : r), o.fillStyle = t, o.fillRect(e, 0, 40, M);
		}
		o.fillStyle = "rgba(40,50,60,0.35)", o.fillRect(M / 2 - 3, 0, 6, M), r.pasillo = t(a, e);
	}
	{
		let i = n(35), [a, o] = N();
		o.fillStyle = "#8f8d87", o.fillRect(0, 0, M, M);
		for (let e = 0; e < M; e += M / 3) for (let t of [0, M / 2]) o.fillStyle = `hsl(40,${3 + i() * 4}%,${50 + i() * 8}%)`, o.fillRect(t + 1, e + 1, M / 2 - 2, M / 3 - 2);
		P(o, M, M, 9e3, i, .12);
		for (let e = 0; e < 8; e++) F(o, i, i() * M, i() * M, 10 + i() * 25, "rgba(40,40,40,0.25)");
		te(o, i, M, M, 6), o.fillStyle = "rgba(30,30,30,0.55)";
		for (let e = 0; e < M; e += M / 3) o.fillRect(0, e, M, 2);
		o.fillRect(M / 2 - 1, 0, 2, M), o.fillStyle = "rgba(200,198,190,0.6)", o.fillRect(0, 0, 10, M), o.fillRect(246, 0, 10, M), r.concrete = t(a, e);
	}
	{
		let i = n(34), [a, o] = N();
		o.fillStyle = "#56603a", o.fillRect(0, 0, M, M);
		for (let e = 0; e < 9; e++) F(o, i, i() * M, i() * M, 18 + i() * 30, "rgba(70,80,70,0.6)");
		for (let e = 0; e < 1e4; e++) o.fillStyle = `hsl(${60 + i() * 40},${25 + i() * 25}%,${20 + i() * 25}%)`, o.fillRect(i() * M, i() * M, 1, 2 + i() * 6);
		r.wetland = t(a, e);
	}
	return r;
}
function he(t) {
	let r = n(41), [i, a] = N(512, 512);
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
function ge(t) {
	let n = t.length, r = M * M * 4, i = new Uint8Array(r * n), a = new Uint8Array(r * n), o = (e, t, n) => {
		let r = e.getContext("2d").getImageData(0, 0, M, M).data;
		for (let e = 0; e < M; e++) t.set(r.subarray((255 - e) * M * 4, (M - e) * M * 4), n + e * M * 4);
	};
	t.forEach((e, t) => {
		o(e.canvas, i, t * r), e.ecanvas && o(e.ecanvas, a, t * r);
	});
	let s = (t) => {
		let r = new e.DataArrayTexture(t, M, M, n);
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
function _e(e, t) {
	let r = n(t), [i, a] = N(), [o, s] = N();
	return s.fillStyle = "#000", s.fillRect(0, 0, M, M), e(a, s, r), {
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
].map((t) => new e.Color(t)), new e.Color(1, 1, 1), new e.Color(.62, .62, .6), new e.Color(.93, .74, .12), new e.Color(.7, .68, .64), ((t, n, r, i = n / 2) => j(new e.BoxGeometry(t, n, r).translate(0, i, 0)))(1, 1, 1), j(new e.CylinderGeometry(.34, .34, .2, 7).translate(0, .1, 0)), j(new e.OctahedronGeometry(.2, 0).scale(1, .6, 1)), j(new e.CylinderGeometry(.55, .5, 1.1, 8, 1, !0).translate(0, .55, 0)), j(new e.CylinderGeometry(.3, .55, .18, 8).translate(0, 1.19, 0)), j(new e.CylinderGeometry(.5, .5, 1, 6).translate(0, .5, 0)), j(new e.ConeGeometry(.5, .4, 6).translate(0, .2, 0)), j(new e.CylinderGeometry(.42, .3, .08, 10).rotateX(1.1).translate(0, .75, 0)), new e.Matrix4(), new e.Quaternion(), new e.Euler(), new e.Vector3(), new e.Vector3();
var B = (t) => new e.Color(t);
B("#9d988e"), B("#5b3b28"), B("#1d1d1d"), B("#8a857c"), B("#b5603c"), B("#6d6f70"), B("#b8bcbf"), B("#c9c3b6"), B("#8e9396"), B("#7a4a2c"), B("#202020"), B("#d6cba2"), B("#2d5f9a"), B("#e8e8e4");
//#endregion
//#region src/world/corridors.js
var ve = 6.2, ye = -5.6, be = 42, xe = 11.5, Se = 3.6, Ce = 7.95;
function we(e, t, n, r) {
	let i = t[0] - e[0], a = t[1] - e[1], o = r[0] - n[0], s = r[1] - n[1], c = i * s - a * o;
	if (Math.abs(c) < 1e-9) return null;
	let l = ((n[0] - e[0]) * s - (n[1] - e[1]) * o) / c, u = ((n[0] - e[0]) * a - (n[1] - e[1]) * i) / c;
	return l >= 0 && l < 1 && u >= 0 && u <= 1 ? l : null;
}
var Te = (e, t, n) => {
	let r = Infinity;
	for (let i = 0; i < n.length - 1; i++) r = Math.min(r, a(e, t, n[i][0], n[i][1], n[i + 1][0], n[i + 1][1])[3]);
	return Math.sqrt(r);
};
function Ee(e, t, n, r) {
	let i = (n) => {
		let r = 1;
		for (; r < t.length - 1 && t[r] < n;) r++;
		let i = (n - t[r - 1]) / (t[r] - t[r - 1] || 1);
		return [e[r - 1][0] + (e[r][0] - e[r - 1][0]) * i, e[r - 1][1] + (e[r][1] - e[r - 1][1]) * i];
	}, a = [i(n)];
	for (let i = 0; i < e.length; i++) t[i] > n && t[i] < r && a.push(e[i]);
	return a.push(i(r)), a;
}
function De(e) {
	let t = {
		decks: [],
		levels: [],
		obstacles: []
	};
	if (!e.decks) return t;
	let n = e.roads.filter((e) => e.motorway), r = e.roads.filter((e) => e.ramp);
	e.roads = e.roads.filter((e) => !(e.kind === "primary" && e.w >= 24 && e.oneway && !e.motorway && e.pts.filter(([e, t]) => r.some((n) => Te(e, t, n.pts) < 5)).length >= e.pts.length * .6));
	for (let e of n) e.w = xe;
	let i = new s(60), c = (e, n, r) => {
		for (let a = 0; a < e.length - 1; a++) {
			let s = {
				a: e[a],
				b: e[a + 1],
				type: n,
				half: r
			};
			i.insert(s, o([e[a], e[a + 1]])), t.obstacles.push(s);
		}
	};
	for (let t of e.rails || []) c(t.pts, "rail", Se);
	for (let e of n) c(e.pts, "mw", Ce);
	let l = (t, n, r, i, a) => e.decks.find((e) => {
		if ((a ? e.rail || e.highway === "motorway" : !(e.rail || e.highway === "motorway")) || Te(t, n, e.pts) > (a ? 8 : 30)) return !1;
		if (!a) return !0;
		let [o, s] = [e.pts[0], e.pts[e.pts.length - 1]], c = Math.hypot(s[0] - o[0], s[1] - o[1]) || 1;
		return Math.abs(((s[0] - o[0]) * r + (s[1] - o[1]) * i) / c) > .6;
	}), u = (t, n) => e.levelCrossings.some((e) => Math.hypot(e.x - t, e.z - n) < 16), d = new s(40);
	for (let t of e.roads) if (!(t.kind === "footway" || t.motorway)) for (let e = 0; e < t.pts.length - 1; e++) d.insert([
		t.pts[e],
		t.pts[e + 1],
		t.w
	], o([t.pts[e], t.pts[e + 1]]));
	let f = (e) => {
		let t = 0, n = 0;
		for (let r = e.span + 2; r < e.span + e.ramp; r += 3) for (let i of [-1, 1]) {
			let o = e.x + e.ux * r * i, s = e.z + e.uz * r * i;
			n++;
			for (let [n, r, i] of d.query(o, s, o, s)) {
				let c = Math.hypot(r[0] - n[0], r[1] - n[1]) || 1;
				if (Math.abs(((r[0] - n[0]) * e.ux + (r[1] - n[1]) * e.uz) / c) > .8 && a(o, s, n[0], n[1], r[0], r[1])[3] < (i / 2) ** 2) {
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
				let i = we(a, o, s.a, s.b);
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
			let i = (r.s0 + r.s1) / 2, [a, s] = Ee(n.pts, e, i, i)[0], [c, d] = Ee(n.pts, e, Math.max(0, i - 5), Math.min(e[e.length - 1], i + 5)), p = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1, m = (d[0] - c[0]) / p, h = (d[1] - c[1]) / p, g = l(a, s, m, h, !0), _ = g ? g.type === "bridge" ? "over" : "under" : l(a, s, m, h, !1) ? "under" : null;
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
				ramp: y ? 26 : be,
				half: y ? n.w / 2 + .6 : n.w / 2 + 2.2,
				h: _ === "over" ? y ? 5.4 : ve : ye,
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
			pts: Ee(n.pts, e, s, t)
		}), s = r;
		c - s > 4 && p.push({
			...n,
			pts: Ee(n.pts, e, s, c)
		});
	}
	e.roads = p;
	for (let e of t.decks) e.len = e.span + e.ramp;
	return t;
}
//#endregion
//#region src/world/textures.js
var V = 256;
function H(e = V, t = V) {
	let n = document.createElement("canvas");
	return n.width = e, n.height = t, [n, n.getContext("2d", { willReadFrequently: !0 })];
}
function U(t, n, { srgb: r = !0, repeat: i = !0 } = {}) {
	let a = new e.CanvasTexture(t);
	return i && (a.wrapS = a.wrapT = e.RepeatWrapping), r && (a.colorSpace = e.SRGBColorSpace), a.anisotropy = n.capabilities.getMaxAnisotropy(), a.generateMipmaps = !0, a.needsUpdate = !0, a;
}
function Oe(e, t, n, r, i, a = .08) {
	for (let o = 0; o < r; o++) {
		let r = Math.floor(i() * 255);
		e.fillStyle = `rgba(${r},${r},${r},${a})`, e.fillRect(i() * t, i() * n, 1 + i() * 3, 1 + i() * 3);
	}
}
function ke(e, { base: t, drawWall: r, drawWindow: i, seed: a }) {
	let o = n(a), [s, c] = H(), [l, u] = H();
	c.fillStyle = t, c.fillRect(0, 0, V, V), r && r(c, o), Oe(c, V, V, 2500, o), u.fillStyle = "#000", u.fillRect(0, 0, V, V);
	let d = V / 2;
	for (let e = 0; e < 2; e++) for (let t = 0; t < 2; t++) {
		let n = o() < .45;
		i(c, t * d, e * d, d, d, o, !1), n && i(u, t * d, e * d, d, d, o, !0);
	}
	return {
		map: U(s, e),
		emissive: U(l, e),
		canvas: s,
		ecanvas: l
	};
}
function Ae(e, t, n, r, i, a, o) {
	if (a) e.fillStyle = o() < .75 ? `hsl(${38 + o() * 10},90%,${55 + o() * 15}%)` : `hsl(200,60%,${60 + o() * 15}%)`;
	else {
		let a = e.createLinearGradient(t, n, t + r, n + i);
		a.addColorStop(0, "#2c3a46"), a.addColorStop(.5, "#5d7385"), a.addColorStop(1, "#27323b"), e.fillStyle = a;
	}
	e.fillRect(t, n, r, i);
}
function je(e) {
	let t = {};
	t.house = ke(e, {
		seed: 1,
		base: "#f1ece2",
		drawWall(e) {
			e.fillStyle = "rgba(0,0,0,0.10)", e.fillRect(0, V / 2 - 6, V, 6), e.fillRect(0, 250, V, 6);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .22, c = n + i * .22, l = r * .56, u = i * .52;
			o || (e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(s - 5, c - 5, l + 10, u + 12));
			let d = a();
			if (Ae(e, s, c, l, u, o, a), !o) {
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
	}), t.brick = ke(e, {
		seed: 2,
		base: "#b0643f",
		drawWall(e, t) {
			for (let n = 0; n < V; n += 8) {
				let r = n / 8 % 2 ? 11 : 0;
				for (let i = -22; i < V; i += 22) {
					let a = 38 + t() * 14;
					e.fillStyle = `hsl(${16 + t() * 8},${45 + t() * 15}%,${a}%)`, e.fillRect(i + r + 1, n + 1, 20, 6);
				}
			}
			e.fillStyle = "#d8d2c4", e.fillRect(0, V / 2 - 8, V, 8), e.fillRect(0, 248, V, 8);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .18, c = n + i * .2, l = r * .64, u = i * .55;
			Ae(e, s, c, l, u, o, a), !o && (e.strokeStyle = "#e8e6e0", e.lineWidth = 3, e.strokeRect(s, c, l, u), e.beginPath(), e.moveTo(s + l / 2, c), e.lineTo(s + l / 2, c + u), e.stroke());
		}
	}), t.apartments = ke(e, {
		seed: 3,
		base: "#e4e0d8",
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .1, c = n + i * .12, l = r * .8, u = i * .62;
			if (Ae(e, s, c, l, u, o, a), !o) {
				a() < .5 && (e.fillStyle = "#9d9a90", e.fillRect(s, c, l, u * (.2 + a() * .6))), e.fillStyle = "#cfcac0", e.fillRect(t, n + i * .74, r, i * .06), e.fillStyle = "rgba(40,40,40,0.85)", e.fillRect(t + 2, n + i * .55, r - 4, 3);
				for (let a = t + 4; a < t + r; a += 7) e.fillRect(a, n + i * .55, 2, i * .19);
				e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(t, n + i * .8, r, i * .04);
			}
		}
	}), t.office = ke(e, {
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
	}), t.church = ke(e, {
		seed: 5,
		base: "#e9e0cc",
		drawWall(e) {
			e.fillStyle = "rgba(0,0,0,0.12)";
			for (let t = 0; t < V; t += 16) e.fillRect(0, t, V, 1);
			e.fillRect(0, 238, V, 18);
		},
		drawWindow(e, t, n, r, i, a, o) {
			let s = t + r * .32, c = n + i * .18, l = r * .36, u = i * .6;
			e.fillStyle = o ? "#f2c77a" : "#3a4250", e.beginPath(), e.moveTo(s, c + u), e.lineTo(s, c + l / 2), e.arc(s + l / 2, c + l / 2, l / 2, Math.PI, 0), e.lineTo(s + l, c + u), e.closePath(), e.fill();
		}
	});
	{
		let r = n(7), [i, a] = H();
		a.fillStyle = "#8d8a84", a.fillRect(0, 0, V, V), Oe(a, V, V, 5e3, r, .12), a.fillStyle = "rgba(60,40,30,0.25)";
		for (let e = 0; e < 6; e++) a.fillRect(r() * V, r() * V, 40 + r() * 60, 30 + r() * 60);
		t.roofFlat = U(i, e), t.roofFlatCanvas = i;
	}
	{
		let r = n(8), [i, a] = H();
		a.fillStyle = "#9a3f25", a.fillRect(0, 0, V, V);
		for (let e = 0; e < V; e += 16) {
			for (let t = 0; t < V; t += 16) a.fillStyle = `hsl(${10 + r() * 10},${55 + r() * 10}%,${30 + r() * 10}%)`, a.beginPath(), a.arc(t + 8, e + 14, 8, Math.PI, 0), a.fill();
			a.fillStyle = "rgba(0,0,0,0.3)", a.fillRect(0, e + 14, V, 2);
		}
		t.roofTile = U(i, e), t.roofTileCanvas = i;
	}
	let r = (e, t, { cuneta: n = !1, tracks: r = 0, patches: i = 2 } = {}) => {
		e.fillStyle = "#3d3e40", e.fillRect(0, 0, V, V), Oe(e, V, V, 9e3, t, .1);
		for (let n = 0; n < 5; n++) e.fillStyle = `rgba(20,20,20,${.1 + t() * .2})`, e.beginPath(), e.ellipse(t() * V, t() * V, 10 + t() * 30, 6 + t() * 20, t() * 3, 0, Math.PI * 2), e.fill();
		for (let n = 0; n < r; n++) {
			let i = (n + .5) / r * V;
			for (let t of [-.17, .17]) {
				let n = e.createLinearGradient(i + V / r * t - 14, 0, i + V / r * t + 14, 0);
				n.addColorStop(0, "rgba(150,150,150,0)"), n.addColorStop(.5, "rgba(150,150,150,0.13)"), n.addColorStop(1, "rgba(150,150,150,0)"), e.fillStyle = n, e.fillRect(i + V / r * t - 14, 0, 28, V);
			}
			e.fillStyle = "rgba(15,12,10,0.16)";
			for (let n = 0; n < V; n += 4) e.fillRect(i - 5 + (t() - .5) * 3, n, 10, 4);
		}
		for (let n = 0; n < i; n++) {
			let n = 30 + t() * 60, r = 30 + t() * 80, i = 20 + t() * (216 - n), a = t() * (V - r);
			e.fillStyle = t() < .6 ? "rgba(18,18,20,0.22)" : "rgba(120,118,112,0.16)", e.fillRect(i, a, n, r), e.strokeStyle = "rgba(10,10,10,0.3)", e.lineWidth = 1, e.strokeRect(i, a, n, r);
		}
		e.strokeStyle = "rgba(12,12,12,0.55)";
		for (let n = 0; n < 7; n++) {
			let n = t() * V, r = t() * V;
			e.lineWidth = .6 + t() * 1.2, e.beginPath(), e.moveTo(n, r);
			for (let i = 0; i < 8; i++) n += (t() - .5) * 22, r += (t() - .3) * 18, e.lineTo(n, r);
			e.stroke();
		}
		if (n) {
			for (let t of [0, 247]) {
				e.fillStyle = "#8f8b84", e.fillRect(t, 0, 9, V), e.fillStyle = "rgba(40,36,30,0.35)", e.fillRect(t === 0 ? 8 : t, 0, 1, V);
				for (let n = 0; n < V; n += 32) e.fillRect(t, n, 9, 1);
			}
			Oe(e, V, V, 800, t, .08);
		}
	};
	{
		let i = n(9), [a, o] = H();
		r(o, i, {
			cuneta: !0,
			tracks: 2
		}), t.road2 = U(a, e);
	}
	{
		let i = n(10), [a, o] = H();
		r(o, i, {
			cuneta: !0,
			tracks: 1
		}), t.road1 = U(a, e);
	}
	{
		let i = n(11), [a, o] = H();
		r(o, i, { patches: 0 }), t.asphalt = U(a, e);
	}
	{
		let r = n(12), [i, a] = H();
		a.fillStyle = "#bdb6a6", a.fillRect(0, 0, V, V);
		for (let e = 0; e < V; e += 32) for (let t = 0; t < V; t += 32) {
			a.fillStyle = `hsl(40,14%,${66 + r() * 10}%)`, a.fillRect(t + 1, e + 1, 30, 30), a.fillStyle = "rgba(0,0,0,0.08)";
			for (let n = 0; n < 9; n++) a.fillRect(t + 5 + n % 3 * 9, e + 5 + Math.floor(n / 3) * 9, 4, 4);
		}
		Oe(a, V, V, 2e3, r, .12), t.sidewalk = U(i, e);
	}
	{
		let r = n(13), [i, a] = H();
		a.fillStyle = "#5b7a3a", a.fillRect(0, 0, V, V);
		for (let e = 0; e < 9e3; e++) a.fillStyle = `hsl(${75 + r() * 30},${30 + r() * 25}%,${22 + r() * 22}%)`, a.fillRect(r() * V, r() * V, 1 + r() * 2, 2 + r() * 4);
		for (let e = 0; e < 25; e++) a.fillStyle = "rgba(110,90,60,0.25)", a.beginPath(), a.ellipse(r() * V, r() * V, 8 + r() * 20, 6 + r() * 14, r() * 3, 0, Math.PI * 2), a.fill();
		t.grass = U(i, e);
	}
	{
		let r = n(14), [i, a] = H();
		a.fillStyle = "#c9b48a", a.fillRect(0, 0, V, V), Oe(a, V, V, 12e3, r, .15), t.sand = U(i, e);
	}
	{
		let r = n(15), [i, a] = H();
		a.fillStyle = "#6d6259", a.fillRect(0, 0, V, V);
		for (let e = 0; e < 14e3; e++) {
			let e = 70 + r() * 90;
			a.fillStyle = `rgb(${e},${e * .95},${e * .9})`, a.fillRect(r() * V, r() * V, 2, 2);
		}
		t.gravel = U(i, e);
	}
	{
		let r = n(16), [i, a] = H();
		a.fillStyle = "#a4553a", a.fillRect(0, 0, V, V), Oe(a, V, V, 9e3, r, .14), t.plaza = U(i, e);
	}
	{
		let r = n(17), [i, a] = H();
		a.fillStyle = "#6b8a3c", a.fillRect(0, 0, V, V), Oe(a, V, V, 6e3, r, .1), t.pitch = U(i, e);
	}
	return Object.assign(t, me(e, U)), t.atlas = he(e), t.facades = ge([
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
			..._e((t, n, r) => pe(t, n, r, e), 50 + e)
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
			..._e(fe[e], 60 + t),
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
			..._e(fe[e], 80 + t),
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
var Me = class {
	constructor(e) {
		this.nodes = [], this.edges = [], this.byKey = /* @__PURE__ */ new Map(), this.segIndex = new s(40);
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
		let r = this.segIndex.query(e - n, t - n, e + n, t + n), i = null, o = n * n;
		for (let n of r) {
			let [r, s, c, l] = a(e, t, n.a.x, n.a.z, n.b.x, n.b.z);
			l < o && (o = l, i = {
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
};
((t, n, r, i = n / 2) => j(new e.BoxGeometry(t, n, r).translate(0, i, 0)))(1, 1, 1), j(new e.DodecahedronGeometry(1, 0).scale(1, .45, 1)), j(new e.OctahedronGeometry(.3, 0).scale(1, .75, 1)), j(new e.CylinderGeometry(.34, .34, .22, 6)), j(new e.CylinderGeometry(.1, .15, 8.6, 5, 1, !0).translate(0, 4.3, 0)), j(new e.CylinderGeometry(.32, .32, .9, 6)), new e.Matrix4(), new e.Quaternion(), new e.Euler(), new e.Vector3(), new e.Vector3();
var W = (t) => new e.Color(t);
W("#5d5246"), W("#a39e94"), W("#3d5a28"), W("#2a2a2a"), W("#7d8286"), W("#4b4236"), W("#8f8577"), W("#b0603c"), W("#dcdcd4"), W("#1c1c1c"), [
	"#1c1c1c",
	"#2b2b2b",
	"#dcdcdc",
	"#3a5fa0",
	"#3f7a3a",
	"#c8b24a",
	"#8a2a2a",
	"#e0e0e0"
].map(W), [
	"#7a5a3c",
	"#8c8f94",
	"#4d5f7a",
	"#9a3a2a",
	"#c8c2b0",
	"#3d4a3a",
	"#b0a070"
].map(W), [
	"#efe6d6",
	"#e9dcc4",
	"#f1efe8",
	"#e2d4bd",
	"#d9dfd9",
	"#efd9c6",
	"#dfe6ea",
	"#e8e0a8"
].map(W), [
	"#4a5a4a",
	"#2e2e2e",
	"#6b4a32",
	"#7a7f84",
	"#3c4f66",
	"#8a3b2a",
	"#e0e0e0",
	"#2f4f3f"
].map(W), new e.Color(.92, .92, .88), new e.Color(.93, .72, .08), new e.Color(.74, .73, .7), new e.Color(.9, .7, .1), new e.Color(.1, .1, .1), new e.Color(.8, .79, .76);
var Ne = class {
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
}, Pe = (e) => e.kind === "pedestrian" && /^rivadavia$/i.test(e.name);
function Fe(e) {
	for (let t of e.roads) Pe(t) && (t.noCars = !0);
}
var Ie = new e.Matrix4(), Le = new e.Quaternion(), Re = new e.Vector3(0, 1, 0);
function G(t, n, r, i = 0, a = 1, o = a, s = a) {
	return Ie.compose(new e.Vector3(t, n, r), Le.setFromAxisAngle(Re, i), new e.Vector3(a, o, s)).clone();
}
var K = (t, n, r) => new e.BoxGeometry(t, n, r).translate(0, n / 2, 0), q = (t, n, r, i = 10) => new e.CylinderGeometry(t, n, r, i).translate(0, r / 2, 0);
function ze() {
	let t = v(256, 256, (e, t, r) => {
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
function Be(e, t = !1) {
	return v(256, 128, (r, i, a) => {
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
function Ve(t) {
	let r = v(128, 128, (e, r, i) => {
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
function He(t, { root: r, graph: i, collision: a, ribbon: o, flatMat: s, keepOut: c, GeoBuf: l }) {
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
			map: b(),
			side: e.DoubleSide,
			roughness: .9
		}),
		diarios: d(16777215, { map: y("DIARIOS · REVISTAS", "#f2efe4", "#1f3a2a", 1024, 160) }),
		rack: d(16777215, { map: Be(5) }),
		floreria: d(16777215, { map: y("FLORERÍA", "#f6e7ef", "#8a1c4a", 1024, 160) }),
		flowers: d(16777215, { map: Be(9, !0) }),
		taxi: d(16777215, { map: y("PARADA DE TAXIS", "#111111", "#f2c200", 1024, 200, "bold 92px Arial, sans-serif") }),
		choripan: d(16777215, { map: y("CHORIPÁN · BONDIOLA", "#c0392b", "#fff4d6", 1024, 160) })
	}, p = new u(), m = new u(), h = s(ze()), g = n(2024), _ = (e, t, n) => a.addCircle(e, t, n, "prop"), v = (e, t, n, r, i) => {
		let o = Math.cos(n), s = Math.sin(n);
		a.addPolygon([
			[-r, -i],
			[r, -i],
			[r, i],
			[-r, i]
		].map(([n, r]) => [e + o * n + s * r, t - s * n + o * r]), 3, "prop");
	};
	function x(t, n, r = 3.2, i = f.leaf) {
		p.add(q(.12, .18, r, 7), f.trunk, G(t, 0, n));
		let a = new e.IcosahedronGeometry(1.7, 0);
		p.add(a, i, G(t, r + .6, n, g() * 6, 1, .8 + g() * .3, 1)), p.add(new e.IcosahedronGeometry(1.1, 0), i, G(t + .6, r + 1.4, n - .3, g() * 6));
	}
	function S(e, t, n) {
		p.add(K(1.9, .55, 1.9), f.brick, G(e, 0, t, n)), p.add(K(1.6, .02, 1.6), f.soil, G(e, .55, t, n)), x(e, t, 3 + g()), v(e, t, n, .95, .95);
	}
	function C(e, t, n) {
		p.add(K(1.8, .08, .5), f.wood, G(e, .42, t, n)), p.add(K(1.8, .45, .06), f.wood, G(e - Math.sin(n) * .24, .5, t - Math.cos(n) * .24, n));
		for (let r of [-.75, .75]) p.add(K(.08, .42, .45), f.iron, G(e + Math.cos(n) * r, 0, t - Math.sin(n) * r, n));
	}
	let w = [];
	function T(t, n, r) {
		p.add(q(.07, .11, 4.6, 8), f.green, G(t, 0, n)), p.add(K(1.5, .08, .08), f.green, G(t, 4.5, n, r));
		for (let i of [-.7, .7]) {
			let a = t + Math.cos(r) * i, o = n - Math.sin(r) * i;
			p.add(q(.03, .03, .25, 6), f.green, G(a, 4.55, o)), p.add(new e.SphereGeometry(.24, 12, 8), f.lamp, G(a, 5, o));
		}
		w.push([t, n]), _(t, n, .15);
	}
	function E(e, t) {
		p.add(q(.24, .22, .85, 10), f.green, G(e, 0, t)), p.add(q(.27, .27, .06, 10), f.iron, G(e, .85, t)), _(e, t, .3);
	}
	function D(e, t) {
		p.add(q(.1, .12, .85, 8), f.iron, G(e, 0, t)), p.add(q(.11, .11, .08, 8), f.yellow, G(e, .7, t)), _(e, t, .13);
	}
	function ee(t, n, r, i = !1) {
		p.add(K(2.6, 2.3, 1.6), f.green, G(t, 0, n, r)), p.add(K(3.4, .12, 2.4), f.green, G(t, 2.3, n, r));
		let a = i ? f.floreria : f.diarios, o = i ? f.flowers : f.rack;
		for (let i of [-1, 1]) {
			let s = Math.sin(r) * i, c = Math.cos(r) * i, l = r + (i < 0 ? Math.PI : 0);
			p.add(new e.PlaneGeometry(3.2, .42), a, G(t + s * 1.21, 2.62, n + c * 1.21, l)), p.add(new e.PlaneGeometry(3.2, .42), a, G(t + s * 1.19, 2.62, n + c * 1.19, l + Math.PI)), p.add(new e.PlaneGeometry(2.4, 1.2), o, G(t + s * .81, 1, n + c * .81, l));
		}
		p.add(K(3.2, .42, .04), f.white, G(t, 2.42, n, r)), v(t, n, r, 1.4, .9);
	}
	function O(t, n, r, i) {
		for (let [e, i] of [
			[-1, -.8],
			[1, -.8],
			[-1, .8],
			[1, .8]
		]) {
			let a = t + Math.cos(r) * e + Math.sin(r) * i, o = n - Math.sin(r) * e + Math.cos(r) * i;
			p.add(q(.025, .025, 2.2, 5), f.iron, G(a, 0, o));
		}
		let a = new e.PlaneGeometry(2.4, 2).rotateX(-Math.PI / 2 + .12);
		p.add(a, i, G(t, 2.25, n, r)), p.add(K(1.9, .05, .9), f.wood, G(t, .75, n, r)), p.add(new e.PlaneGeometry(1.8, .8).rotateX(-Math.PI / 2), f.rack, G(t, .81, n, r)), v(t, n, r, 1, .5);
	}
	function k(t, n, r) {
		p.add(K(1.8, .95, .9), f.white, G(t, .25, n, r)), p.add(K(1.7, .08, .8), f.grill, G(t, 1.2, n, r)), p.add(K(1.4, .03, .6), f.ember, G(t, 1.22, n, r));
		for (let i of [-.7, .7]) p.add(new e.CylinderGeometry(.25, .25, .08, 12).rotateX(Math.PI / 2).translate(0, .25, 0), f.iron, G(t + Math.cos(r) * i, 0, n - Math.sin(r) * i, r));
		p.add(new e.PlaneGeometry(1.8, .4), f.choripan, G(t + Math.sin(r) * .46, .7, n + Math.cos(r) * .46, r)), p.add(new e.PlaneGeometry(1.8, .4), f.choripan, G(t - Math.sin(r) * .46, .7, n - Math.cos(r) * .46, r + Math.PI)), p.add(q(.03, .03, 2.4, 5), f.iron, G(t, 0, n)), p.add(new e.ConeGeometry(1.4, .5, 10, 1, !0).translate(0, 2.5, 0), f.tarpRed, G(t, 0, n));
		for (let r = 0; r < 4; r++) p.add(new e.SphereGeometry(.25 + r * .12, 8, 6), f.smoke, G(t + r * .15, 1.5 + r * .35, n + r * .05));
		v(t, n, r, .95, .5);
	}
	function A(t, n, r) {
		for (let e = 0; e < 4; e++) p.add(q(.2 - e * .02, .22 - e * .02, r / 4 + .05, 8), f.palm, G(t + e * .05, e * r / 4, n));
		for (let i = 0; i < 9; i++) {
			let a = new e.PlaneGeometry(.7, 3.4, 1, 3), o = a.attributes.position;
			for (let e = 0; e < o.count; e++) o.setZ(e, -((o.getY(e) + 1.7) ** 2) * .12);
			a.translate(0, 1.7, 0).rotateX(-1), p.add(a, f.frond, G(t + .15, r, n, i / 9 * Math.PI * 2 + g() * .3));
		}
		_(t, n, .3);
	}
	function j(t, n, r, i, a, o, s) {
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
	let M = new l(), N = new l(), P = ([e, t]) => i.byKey.get(`${Math.round(e * 2)},${Math.round(t * 2)}`), F = 0;
	for (let e of t.roads.filter(Pe)) {
		let t = new Ne(e.pts), n = [];
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
			let a = P(e.pts[n]);
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
			}), j(N, a.x, a.z, s, c, o, Math.min(2 * r - 1, 6)));
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
			o(M, s, r * 2, .14, 1 / 6);
			for (let [o, s] of [[e + .6, i], [n - .6, a]]) {
				if (!s) continue;
				let [e, n, i, a] = t.at(o);
				for (let t = -r + .8; t <= r - .7; t += 1.5) D(e - a * t, n + i * t);
			}
			let l = 0;
			for (let r = e + 6; r < n - 5; r += 8, l++) {
				let [i, a, o, s] = t.at(r), u = Math.atan2(-s, o), d = l % 4;
				d === 0 || d === 2 ? S(i, a, u) : d === 1 ? F < 3 && n - e > 50 && l === 5 ? (ee(i, a, u, F === 2), F++) : (C(i - s * .35, a + o * .35, u), C(i + s * .35, a - o * .35, u + Math.PI)) : (T(i, a, u + Math.PI / 2), E(i + o * 1.2 - s * .6, a + s * 1.2 + o * .6)), c.push([
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
			a.isBlocked(i, o, 1.3) || (t === "chori" ? k(i, o, l) : O(i, o, l, r), c.push([
				i,
				o,
				2.5
			]));
		}
		let [g, v] = n(-8, s.v - r * .6);
		p.add(q(.04, .04, 2.6, 6), f.iron, G(g, 0, v)), p.add(new e.PlaneGeometry(1.3, .26), f.taxi, G(g, 2.45, v, l)), p.add(new e.PlaneGeometry(1.3, .26), f.taxi, G(g, 2.45, v, l + Math.PI)), _(g, v, .1);
		let y = Math.abs(s.v - o) - 5;
		if (y > 2) {
			let t = new e.PlaneGeometry(60, y).rotateX(-Math.PI / 2), i = t.attributes.uv;
			for (let e = 0; e < i.count; e++) i.setXY(e, i.getX(e) * 10, i.getY(e) * 3);
			let [a, c] = n(0, (o + r * 5 + s.v - r * 3.2) / 2);
			m.add(t, h, G(a, .14, c, l));
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
	let te = (t.specials || []).filter((e) => e.type === "station" && /quilmes|bernal/i.test(e.name || ""));
	for (let e of te) I(e);
	let ne = [
		0,
		1,
		2
	].map((t) => new e.MeshStandardMaterial({
		map: Ve(t),
		roughness: 1
	}));
	function L(t, n, r) {
		let i = Math.cos(r), a = Math.sin(r), o = (e, r) => [t + i * e + a * r, n - a * e + i * r], s = new e.PlaneGeometry(9, 7).rotateX(-Math.PI / 2);
		p.add(s, f.sand, G(t, .16, n, r));
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
			p.add(K(n, .3, i), f.concrete, G(a, 0, s, r));
		}
		{
			let [t, n] = o(-2, -1.5);
			for (let o of [-1.7, 1.7]) for (let s of [-.25, .25]) {
				let c = new e.CylinderGeometry(.05, .05, 2.6, 6).translate(0, 1.3, 0).rotateX(s);
				p.add(c, f.red, G(t + i * o, 0, n - a * o, r));
			}
			p.add(new e.CylinderGeometry(.06, .06, 3.5, 6).rotateZ(Math.PI / 2).translate(0, 2.5, 0), f.red, G(t, 0, n, r));
			for (let o of [-.8, .8]) {
				for (let s of [-.22, .22]) p.add(new e.CylinderGeometry(.01, .01, 2, 4).translate(0, 1.5, 0), f.iron, G(t + i * (o + s), 0, n - a * (o + s), r));
				p.add(K(.5, .05, .25), f.yellow, G(t + i * o, .45, n - a * o, r));
			}
			v(t, n, r, 1.8, .5);
		}
		{
			let [t, n] = o(2.5, -1.2);
			p.add(K(.9, .06, .9), f.blue, G(t, 1.6, n, r));
			for (let [e, r] of [
				[-.4, -.4],
				[.4, -.4],
				[-.4, .4],
				[.4, .4]
			]) p.add(q(.04, .04, 1.6, 5), f.iron, G(t + i * e + a * r, 0, n - a * e + i * r));
			let s = new e.BoxGeometry(2.6, .06, .6).rotateZ(-.62);
			p.add(s, f.yellow, G(t + i * 1.5, .8, n - a * 1.5, r));
			for (let e = 0; e < 4; e++) p.add(K(.6, .04, .06), f.iron, G(t - i * .55, .35 + e * .38, n + a * .55, r));
			v(t + i * .6, n - a * .6, r, 1.4, .5);
		}
		{
			let [t, n] = o(0, 2.2);
			p.add(K(.2, .5, .3), f.iron, G(t, 0, n, r)), p.add(new e.BoxGeometry(3.2, .08, .3).rotateZ(.14).translate(0, .55, 0), f.blue, G(t, 0, n, r)), v(t, n, r, 1.6, .25);
		}
	}
	function R(t, n, r) {
		p.add(q(1.2, 1.4, .6, 16), f.concrete, G(t, 0, n)), p.add(q(.07, .12, 14, 8), f.white, G(t, .6, n)), p.add(new e.PlaneGeometry(3, 2).translate(1.5, 0, 0), f.flag, G(t, 13.4, n, r + .6)), _(t, n, 1.3), c.push([
			t,
			n,
			3
		]);
	}
	function re(t, { palms: n = !1, kids: r = !1 } = {}) {
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
			p.add(new e.CircleGeometry(r, 20).rotateX(-Math.PI / 2), ne[t % 3], G(i, .22, a)), p.add(new e.CylinderGeometry(r + .1, r + .15, .22, 20, 1, !0).translate(0, .11, 0), f.concrete, G(i, 0, a)), c.push([
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
				A(e, r, 7 + g() * 3), c.push([
					e,
					r,
					2
				]);
			}
		}
		if (r) {
			let [e, t] = o(-.68 * l, .5 * (u * .68 + 1.5));
			L(e, t, s), c.push([
				e,
				t,
				6.5
			]);
		}
		let [_, v] = o(l - 8, 4.5);
		R(_, v, s);
		for (let e = -l + 6; e <= l - 6; e += 14) for (let t of [-u - 1.8, u + 1.8]) {
			let [n, r] = o(e, t);
			a.isBlocked(n, r, .4) || T(n, r, s);
		}
		for (let e = -u + 6; e <= u - 6; e += 14) for (let t of [-l - 1.8, l + 1.8]) {
			let [n, r] = o(t, e);
			a.isBlocked(n, r, .4) || T(n, r, s + Math.PI / 2);
		}
	}
	let z = (e) => (t.specials || []).find((t) => t.type === "plaza" && e.test(t.name || ""));
	z(/san mart/i) && re(z(/san mart/i), { palms: !0 }), z(/f[ée]lix bernal/i) && re(z(/f[ée]lix bernal/i), { kids: !0 });
	let ie = te.map((e) => [e.cx, e.cz]), ae = /^(cafe|restaurant|pub|bar|ice_cream|fast_food)$/, oe = new e.SphereGeometry(.06, 6, 4);
	for (let n of t.shops || []) {
		if (!ae.test(n.kind) || !ie.some(([e, t]) => Math.hypot(n.x - e, n.z - t) < 650)) continue;
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
				p.add(q(.05, .05, .72, 6), f.iron, G(i, 0, o)), p.add(q(.42, .42, .04, 14), f.tableTop, G(i, .72, o));
				for (let e of [-.65, .65]) {
					let t = i + u * e, n = o + d * e;
					p.add(K(.42, .04, .42), f.chair, G(t, .45, n, v)), p.add(K(.04, .45, .42), f.chair, G(t + u * Math.sign(e) * .2, .45, n + d * Math.sign(e) * .2, v));
					for (let e of [-.18, .18]) p.add(q(.015, .015, .45, 4), f.iron, G(t + u * e, 0, n + d * e));
				}
				y || (p.add(q(.025, .025, 2.3, 5), f.white, G(i, 0, o)), p.add(new e.ConeGeometry(1.25, .45, 8, 1, !0).translate(0, 2.35, 0), [
					f.tarpRed,
					f.tarpGreen,
					f.tarpBlue
				][b.length % 3], G(i, 0, o))), _(i, o, .75), c.push([
					i,
					o,
					1.5
				]), b.push([i, o]);
			}
		}
		if (y && b.length >= 2) {
			let [e, t] = [b[0], b[b.length - 1]], n = [e[0] - u * 1.4, e[1] - d * 1.4], r = [t[0] + u * 1.4, t[1] + d * 1.4];
			for (let e of [n, r]) p.add(q(.03, .03, 2.9, 5), f.iron, G(e[0], 0, e[1]));
			for (let e = 0; e <= 12; e++) {
				let t = e / 12;
				p.add(oe, f.bulb, G(n[0] + (r[0] - n[0]) * t, 2.85 - Math.sin(t * Math.PI) * .35, n[1] + (r[1] - n[1]) * t));
			}
		}
	}
	for (let t of i.nodes) {
		if (t.degree < 3 || !ie.some(([e, n]) => Math.hypot(t.x - e, t.z - n) < 500) || (t.id * 2654435761 >>> 0) % 5 > 1) continue;
		let n = [...t.links].filter(([, e]) => e.kind === "residential" || e.kind === "secondary" || e.kind === "tertiary");
		if (!n.length) continue;
		let r = 0;
		for (let e of t.roads) r = Math.max(r, e.w);
		let [i, o] = n[0], s = Math.hypot(i.x - t.x, i.z - t.z), l = r / 2 + 9;
		if (s < l + 6) continue;
		let u = (i.x - t.x) / s, d = (i.z - t.z) / s, m = o.w / 2 + 1.1, h = t.x + u * l - d * m, g = t.z + d * l + u * m;
		if (a.isBlocked(h, g, 1)) continue;
		let _ = Math.atan2(-d, u);
		p.add(K(1.8, 1.15, 1.2), f.dumpster, G(h, .12, g, _)), p.add(new e.BoxGeometry(1.86, .08, 1.3).rotateX(-.1).translate(0, 1.32, 0), f.dumpsterLid, G(h, 0, g, _));
		for (let [e, t] of [
			[-.75, -.45],
			[.75, -.45],
			[-.75, .45],
			[.75, .45]
		]) p.add(q(.07, .07, .12, 6), f.iron, G(h + Math.cos(_) * e + Math.sin(_) * t, 0, g - Math.sin(_) * e + Math.cos(_) * t));
		v(h, g, _, .95, .65), c.push([
			h,
			g,
			1.8
		]);
	}
	if (M.pos.length) {
		let t = new e.Mesh(M.geometry(), h);
		t.receiveShadow = !0, t.renderOrder = -6.5, r.add(t);
	}
	if (N.pos.length) {
		let t = new e.Mesh(N.geometry(), s(null, 16777215, { vertexColors: !0 }));
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
var Ue = 440, We = 3, Ge = [], Ke = e.Object3D.prototype.add;
e.Object3D.prototype.add = function(...e) {
	Ke.apply(this, e);
	for (let t = this; t; t = t.parent) if (t.userData?.frozen) {
		for (let t of e) t.parent === this && (t.updateMatrixWorld(!0), t.traverse(qe));
		break;
	}
	return this;
};
var qe = (e) => {
	e.matrixAutoUpdate = !1;
};
function J(t, n, r, i, a, o = {}) {
	let s = /* @__PURE__ */ new Map();
	for (let e of i) {
		let t = `${Math.floor(e[0] / Ue)},${Math.floor(e[1] / Ue)}`;
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
		Ge.push({
			mesh: s,
			x: s.boundingSphere.center.x,
			z: s.boundingSphere.center.z,
			r2: u * u
		});
	}
	return l;
}
function Je(t) {
	let n = [], r = [], i = [], a = 0;
	for (let e of t) {
		let t = e.index ? e : e.toNonIndexed(), o = t.attributes.position.array, s = t.attributes.normal.array;
		if (n.push(...o), r.push(...s), t.index) for (let e of t.index.array) i.push(e + a);
		a += o.length / 3;
	}
	let o = new e.BufferGeometry();
	return o.setAttribute("position", new e.Float32BufferAttribute(n, 3)), o.setAttribute("normal", new e.Float32BufferAttribute(r, 3)), i.length && o.setIndex(i), o;
}
function Ye(e, t, n) {
	let r = n[0] - t[0], i = n[1] - t[1], a = Math.hypot(r, i);
	if (a < 2.5) return null;
	let o = i / a, s = -r / a, c = (t[0] + n[0]) / 2, l = (t[1] + n[1]) / 2, u = e.nearest(c + o * 5, l + s * 5, 14);
	if (!u || u.seg.road.kind === "footway") return null;
	let { a: d, b: f, road: p } = u.seg, m = f.x - d.x, h = f.z - d.z;
	if (Math.abs(r * m + i * h) < .8 * a * Math.hypot(m, h)) return null;
	let g = (u.x - c) * o + (u.z - l) * s;
	return g <= 0 || g > p.w / 2 + We + 6 ? null : {
		road: p,
		room: g - p.w / 2
	};
}
function Xe(t) {
	let n = document.createElement("canvas");
	n.width = 64, n.height = 4;
	let r = n.getContext("2d");
	for (let e = 0; e < 8; e++) r.fillStyle = e % 2 ? "#f4efe4" : t, r.fillRect(e * 8, 0, 8, 4);
	let i = new e.CanvasTexture(n);
	return i.colorSpace = e.SRGBColorSpace, i;
}
//#endregion
//#region src/world/shopkit.js
var Ze = [
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
], Qe = {
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
function $e(e) {
	let t = e.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
	for (let [e, n] of Ze) if (n.test(t)) return e;
	return Qe[e.kind] || "resto";
}
var et = {
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
}, tt = {
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
}, nt = {
	hotel: {
		canopy: 1776411,
		props: ["planters"]
	},
	flores: { props: ["flowers"] },
	boliche: {
		canopy: 723723,
		props: ["vallas"]
	}
}, Y = (e, t) => t[Math.floor(e() * t.length)];
function rt(e, t, n, r, i, a, o) {
	e.fillStyle = a, e.fillRect(t, n, r, i), e.fillStyle = "rgba(0,0,0,0.25)";
	for (let a = 0, o = n; o < n + i; o += 9, a++) {
		e.fillRect(t, o, r, 1.5);
		for (let n = t + a % 2 * 10; n < t + r; n += 20) e.fillRect(n, o, 1.5, 9);
	}
	for (let a = 0; a < 60; a++) e.fillStyle = `rgba(${o() < .5 ? "255,220,190" : "60,20,10"},0.12)`, e.fillRect(t + o() * r, n + o() * i, 18, 7);
}
function it(e, t, n, r, i, a, o) {
	for (let s = n, c = 0; s < n + i; s += 12, c++) for (let n = t, i = 0; n < t + r; n += 12, i++) e.fillStyle = (c + i) % 2 ? a : o, e.fillRect(n, s, 12, 12);
}
function at(e, t, n, r, i, a, o, s) {
	e.fillStyle = o, e.fillRect(n, r, i, a), t.fillStyle = s, t.fillRect(n, r, i, a);
}
function ot(e, t, n, r, i) {
	e.fillStyle = "rgba(255,255,255,0.1)", e.beginPath(), e.moveTo(t + r * .1, n + i), e.lineTo(t + r * .35, n), e.lineTo(t + r * .5, n), e.lineTo(t + r * .25, n + i), e.fill();
}
function st(e, t, n, r, i, a, o = 5) {
	e.fillStyle = a, e.fillRect(t - o, n - o, r + o * 2, o), e.fillRect(t - o, n + i, r + o * 2, o), e.fillRect(t - o, n, o, i), e.fillRect(t + r, n, o, i);
}
function ct(e, t, n, r) {
	e.fillStyle = r, e.fillRect(t, n, 36, 7), e.fillStyle = "rgba(30,15,5,0.7)", e.fillRect(t + 16, n + 7, 4, 28), e.beginPath(), e.arc(t + 4, n - 16, 8, 0, Math.PI * 2), e.arc(t + 32, n - 14, 8, 0, Math.PI * 2), e.fill();
}
function lt(e, t, n, r, i, a, o) {
	for (let s = 0; s < i; s++) {
		e.fillStyle = "rgba(90,60,30,0.9)", e.fillRect(t, n + s * 24 + 20, r, 3);
		for (let i = t + 3; i < t + r - 6; i += 7) e.fillStyle = Y(a, o), e.fillRect(i, n + s * 24 + 4, 5, 16), e.fillRect(i + 1.5, n + s * 24, 2, 5);
	}
}
function X(e, t, n, r, i) {
	i.brick ? rt(e, n, 0, r, r, i.wall, i.rng) : (e.fillStyle = i.wall, e.fillRect(n, 0, r, r)), e.fillStyle = i.fascia, e.fillRect(n, 0, r, 54), at(e, t, n + 14, 72, 146, 128, i.tint, i.lit), i.interior?.(e, t, n + 14, 72, 146, 128), ot(e, n + 14, 72, 146, 128), st(e, n + 14, 72, 146, 128, i.frame), i.zocalo ? i.zocalo(e, n + 9, 205, 156, 51) : (e.fillStyle = i.frame, e.fillRect(n + 9, 205, 156, 51)), at(e, t, n + 180, 76, 62, 180, i.tint, i.lit), ot(e, n + 180, 76, 62, 180), st(e, n + 180, 76, 62, 180, i.door || i.frame, 6), e.fillStyle = "#c9b27a", e.fillRect(n + 232, 160, 4, 22);
}
var ut = {
	parrilla: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		brick: !0,
		wall: Y(i, [
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
		zocalo: (e, t, n, r, a) => rt(e, t, n, r, a, "#5c2716", i)
	}),
	bodegon: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: Y(i, [
			"#e8dcc0",
			"#d9c9a3",
			"#efe6cf"
		]),
		fascia: "#6b1f1f",
		frame: "#4a2a17",
		tint: "#3a2416",
		lit: "#ffcf8a",
		interior(e, t, n, r, a) {
			lt(e, n + 6, r + 6, a - 12, 2, i, [
				"#2c4a1e",
				"#5a1414",
				"#1f3b2a",
				"#3a2a10"
			]);
			for (let t of [n + 18, n + 88]) ct(e, t, r + 98, "#c62828");
		},
		zocalo: (e, t, n, r, i) => it(e, t, n, r, i, "#1d4f8a", "#f4f0e6")
	}),
	pizzeria: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: "#f4efe6",
		fascia: "#b3261e",
		frame: "#2b2b2b",
		tint: "#3a2418",
		lit: "#ffb36a",
		interior(e, t, n, r, i, a) {
			e.fillStyle = "#9a4a2c", e.beginPath(), e.arc(n + i / 2, r + a - 10, 52, Math.PI, 0), e.fill(), e.fillStyle = "#1a0d06", e.beginPath(), e.arc(n + i / 2, r + a - 10, 26, Math.PI, 0), e.fill(), e.fillStyle = "#ff8a1e", e.fillRect(n + i / 2 - 18, r + a - 24, 36, 12), t.fillStyle = "#ff9a2a", t.fillRect(n + i / 2 - 26, r + a - 36, 52, 26);
		},
		zocalo: (e, t, n, r, i) => it(e, t, n, r, i, "#b3261e", "#f4f0e6")
	}),
	italiano: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: Y(i, [
			"#e9dcc4",
			"#f1e6d0",
			"#d8c7a8"
		]),
		fascia: "#1e5e33",
		frame: "#1e5e33",
		tint: "#3a2a1c",
		lit: "#ffd08f",
		interior(e, t, n, r, i) {
			for (let t of [n + 16, n + 86]) ct(e, t, r + 96, "#f4f4f4");
			e.fillStyle = "#3f7a2f";
			for (let t = 0; t < 5; t++) e.beginPath(), e.arc(n + 16 + t * 28, r + 14, 9, 0, Math.PI * 2), e.fill();
		}
	}),
	cerveceria: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		brick: i() < .5,
		wall: Y(i, [
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
	sushi: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: Y(i, ["#2b2622", "#3a2e24"]),
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
	burger: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: Y(i, ["#151515", "#2b2b2b"]),
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
	cafe: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: Y(i, [
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
			for (let t = 0; t < 9; t++) e.fillStyle = Y(i, [
				"#c88a3e",
				"#8a4a20",
				"#f0d9a8",
				"#c2477a"
			]), e.beginPath(), e.ellipse(n + 18 + t * 14, r + 88, 6, 4, 0, 0, Math.PI * 2), e.fill();
			e.fillStyle = "#9aa0a6", e.fillRect(n + a - 44, r + 40, 30, 34);
		}
	}),
	heladeria: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: Y(i, [
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
			for (let t = 0; t < 10; t++) e.fillStyle = Y(i, [
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
	bar: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: Y(i, [
			"#1b1b1b",
			"#2a1f2b",
			"#1f2a2b"
		]),
		fascia: "#000",
		frame: "#000",
		tint: "#160f1a",
		lit: "#ff9ad0",
		interior(e, t, n, r, a) {
			lt(e, n + 8, r + 8, a - 16, 3, i, [
				"#e0a526",
				"#5ad1e8",
				"#e85a9a",
				"#9be85a",
				"#f4f4f4"
			]), t.fillStyle = "#ff7ac0", t.fillRect(n + 8, r + 4, a - 16, 3);
		}
	}),
	resto: (e, t, n, r, i) => X(e, t, n, r, {
		rng: i,
		wall: Y(i, [
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
			for (let t of [n + 18, n + 88]) ct(e, t, r + 96, "#f4f4f4");
		}
	})
};
function dt(t) {
	let r = document.createElement("canvas"), i = document.createElement("canvas");
	r.width = i.width = 1024, r.height = i.height = 256;
	let a = r.getContext("2d"), o = i.getContext("2d");
	o.fillStyle = "#000", o.fillRect(0, 0, 1024, 256);
	let s = n(t.length * 131 + 7);
	for (let e = 0; e < 4; e++) ut[t](a, o, e * 256, 256, s);
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
var ft = {
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
function pt(t, n) {
	let r = document.createElement("canvas");
	r.width = r.height = 128;
	let i = r.getContext("2d");
	i.fillStyle = n, i.fillRect(0, 0, 128, 128), i.strokeStyle = "rgba(255,255,255,0.9)", i.lineWidth = 6, i.strokeRect(5, 5, 118, 118), i.fillStyle = "#fff", ft[t](i);
	let a = new e.CanvasTexture(r);
	return a.colorSpace = e.SRGBColorSpace, new e.MeshStandardMaterial({
		map: a,
		emissiveMap: a,
		emissive: 16777215,
		emissiveIntensity: 0,
		roughness: .6
	});
}
function mt(t, n, r, i = {}) {
	let a = document.createElement("canvas");
	a.width = t, a.height = n, r(a.getContext("2d"));
	let o = new e.CanvasTexture(a);
	return o.colorSpace = e.SRGBColorSpace, new e.MeshStandardMaterial({
		map: o,
		roughness: .8,
		...i
	});
}
function ht(t, r, { graph: i, collision: a, nightMaterials: o }) {
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
		let t = e.rubro === "comida" ? et[e.sub] : nt[e.rubro], n = t?.icon || tt[e.rubro], r = e.signColor;
		if (n && g(h.blades, `${n}|${r}`, d(e, e.w / 2 - .3, .55, Math.min(e.h - 1.1, 2.9))), !t) continue;
		let i = new Set(t.props), a = e.h - .8;
		if (t.awning) {
			let n = t.awning === "italia" ? "italia" : Y(m, t.awning);
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
				Y(m, [
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
		let [r, i] = e.split("|"), a = pt(r, i);
		b.push([a, .9]), J(t, y, a, n, u, { range: 350 }), J(t, v, _, n, u, { range: 250 });
	}
	let x = new A(), S = new e.Color(1, 1, 1);
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
		let i = n === "italia" ? _t() : Xe(n);
		J(t, C, new e.MeshStandardMaterial({
			map: i,
			side: e.DoubleSide,
			roughness: .9
		}), r, u, { cast: !0 });
	}
	let w = new e.BoxGeometry(1, .14, 1.1);
	for (let [n, r] of h.canopies) J(t, w, new e.MeshStandardMaterial({
		color: n,
		roughness: .6,
		metalness: .3
	}), r, u, { cast: !0 });
	let T = new e.MeshStandardMaterial({
		color: 8016436,
		roughness: .85
	});
	J(t, Je([
		new e.CylinderGeometry(.45, .45, .05, 12).translate(0, .74, 0),
		new e.CylinderGeometry(.04, .04, .72, 5).translate(0, .36, 0),
		...[-.75, .75].flatMap((t) => [new e.BoxGeometry(.42, .45, .42).translate(t, .225, 0), new e.BoxGeometry(.06, .45, .42).translate(t + Math.sign(t) * .18, .67, 0)])
	]), T, h.tables, u, { cast: !0 }), J(t, Je([new e.CylinderGeometry(.03, .03, 2.3, 5).translate(0, 1.15, 0), new e.ConeGeometry(1.3, .45, 8).translate(0, 2.35, 0)]), new e.MeshStandardMaterial({
		color: 16777215,
		roughness: .9
	}), h.umbrellas, u, {
		cast: !0,
		color: (t) => new e.Color(t[5])
	}), J(t, new e.LatheGeometry([
		[.26, 0],
		[.33, .25],
		[.35, .5],
		[.33, .75],
		[.26, .98],
		[0, .98]
	].map(([t, n]) => new e.Vector2(t, n)), 12), mt(64, 64, (e) => {
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
	J(t, new e.BoxGeometry(.18, .28, .18), E, h.lamps, u), J(t, new e.BoxGeometry(.03, .03, .22).translate(0, .16, -.12), _, h.lamps, u);
	let D = new e.MeshStandardMaterial({
		color: 12986408,
		emissive: 16726570,
		emissiveIntensity: .15,
		roughness: .8
	});
	J(t, new e.CylinderGeometry(.17, .17, .42, 10), D, h.lanterns, u);
	let ee = new e.MeshStandardMaterial({
		color: 16773576,
		emissive: 16756816,
		emissiveIntensity: 0
	});
	J(t, new e.SphereGeometry(.07, 6, 4), ee, h.bulbs, u);
	let O = mt(128, 64, (e) => {
		e.fillStyle = "#1b2a4a", e.fillRect(0, 0, 128, 64), e.fillStyle = "#0b0f16";
		for (let t of [42, 85]) e.fillRect(t, 18, 2, 46);
		e.fillStyle = "#f4f4f4", e.beginPath(), e.arc(64, 30, 12, 0, Math.PI * 2), e.fill();
	}, { side: e.DoubleSide });
	J(t, new e.PlaneGeometry(1.2, .55), O, h.noren, u);
	let k = mt(96, 128, (e) => {
		e.fillStyle = "#6b4a2f", e.fillRect(0, 0, 96, 128), e.fillStyle = "#1e2a22", e.fillRect(6, 6, 84, 116), e.fillStyle = "#f4f4e8", e.font = "bold 15px Arial", e.textAlign = "center", e.fillText("MENÚ", 48, 28), e.fillText("DEL DÍA", 48, 46), e.font = "11px Arial";
		for (let t = 0; t < 4; t++) e.fillRect(16, 62 + t * 14, 40 + t * 17 % 24, 2);
	}), j = (t) => new e.BoxGeometry(.55, .85, .03).translate(0, .42, 0).applyMatrix4(new e.Matrix4().makeRotationAxis(l, t)).translate(0, 0, t * .6);
	J(t, gt([j(.2), j(-.2)]), k, h.chalk, u, { cast: !0 }), J(t, new e.BoxGeometry(.85, .45, .38).translate(0, .225, 0), new e.MeshStandardMaterial({
		color: 3815994,
		roughness: .9
	}), h.planters, u, { cast: !0 }), J(t, new e.IcosahedronGeometry(.36, 0).scale(1.2, .8, .6).translate(0, .72, 0), new e.MeshStandardMaterial({
		color: 4160047,
		roughness: .9,
		flatShading: !0
	}), h.planters, u, { cast: !0 }), J(t, gt([...[
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
	}), h.vallas, (t, [n, r, i, a]) => t.compose(new e.Vector3(n, i, r), s.setFromAxisAngle(c, a), new e.Vector3(1, 1, 1)), { cast: !0 }), J(t, gt([-.7, .7].map((t) => new e.TorusGeometry(.7, .03, 6, 16, Math.PI).rotateZ(Math.PI).scale(1, .3, 1).translate(t, .92, 0))), new e.MeshStandardMaterial({
		color: 11735583,
		roughness: .6
	}), h.vallas, (t, [n, r, i, a]) => t.compose(new e.Vector3(n, i, r), s.setFromAxisAngle(c, a), new e.Vector3(1, 1, 1))), J(t, new e.CylinderGeometry(.2, .16, .4, 10).translate(0, .2, 0), new e.MeshStandardMaterial({
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
	J(t, new e.IcosahedronGeometry(.26, 0).scale(1, .8, 1).translate(0, .62, 0), new e.MeshStandardMaterial({
		color: 16777215,
		roughness: .9,
		flatShading: !0
	}), h.flowers, u, {
		cast: !0,
		color: (t) => new e.Color(M[(t[5] * 7 + Math.round(t[0])) % M.length])
	});
	let N = mt(64, 128, (e) => {
		e.fillStyle = "#8a3b24", e.fillRect(0, 0, 64, 128), e.fillStyle = "rgba(0,0,0,0.3)";
		for (let t = 0, n = 0; n < 128; n += 8, t++) {
			e.fillRect(0, n, 64, 1.5);
			for (let r = t % 2 * 8; r < 64; r += 16) e.fillRect(r, n, 1.5, 8);
		}
	});
	return J(t, gt([new e.BoxGeometry(.8, 1.8, .8).translate(0, .9, 0), new e.BoxGeometry(1, .15, 1).translate(0, 1.85, 0)]), N, h.chimneys, u, { cast: !0 }), { setNight(e) {
		for (let [t, n] of b) t.emissiveIntensity = e * n;
		E.emissiveIntensity = e * 3.5, ee.emissiveIntensity = e * 4, D.emissiveIntensity = .15 + e * 2.5;
	} };
}
function gt(t) {
	let n = [], r = [], i = [];
	for (let e of t) {
		let t = e.index ? e.toNonIndexed() : e;
		n.push(...t.attributes.position.array), r.push(...t.attributes.normal.array), i.push(...t.attributes.uv.array);
	}
	let a = new e.BufferGeometry();
	return a.setAttribute("position", new e.Float32BufferAttribute(n, 3)), a.setAttribute("normal", new e.Float32BufferAttribute(r, 3)), a.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), a;
}
function _t() {
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
var vt = [
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
function yt(e) {
	for (let [t, n] of vt) if (t.test(e)) return n;
	return {
		name: e.toUpperCase(),
		band: "#00796b",
		accent: "#ffffff",
		sign: "#00796b",
		ink: "#ffffff"
	};
}
var bt = new e.Color(1, 1, 1), xt = (t, n, r) => {
	let i = document.createElement("canvas");
	i.width = t, i.height = n, r(i.getContext("2d"), t, n);
	let a = new e.CanvasTexture(i);
	return a.colorSpace = e.SRGBColorSpace, a.anisotropy = 8, a;
};
function St(t, n, { collision: i, nightMaterials: a }) {
	if (!n.length) return { setNight() {} };
	let o = new A(), s = xt(64, 64, (e) => {
		e.fillStyle = "#d9dcdf", e.fillRect(0, 0, 64, 64);
		for (let t = 0; t < 64; t += 8) e.fillStyle = "rgba(0,0,0,0.12)", e.fillRect(t, 0, 2, 64), e.fillStyle = "rgba(255,255,255,0.35)", e.fillRect(t + 2, 0, 1, 64);
	});
	s.wrapS = s.wrapT = e.RepeatWrapping;
	let c = /* @__PURE__ */ new Map(), l = new A(), u = [], d = [], f = [], p = [], m = /* @__PURE__ */ new Set();
	for (let e of n) {
		let t = e.building, n = t.h;
		if (!m.has(t)) {
			m.add(t);
			let e = r(t.pts) < 0 ? t.pts.slice().reverse() : t.pts;
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
				], [0, 0], [a / 3, 0], [a / 3, (n + .6) / 3], [0, (n + .6) / 3], bt, [
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
		c.has(S) || c.set(S, new A());
		let C = c.get(S), w = (e, t, n, r, i, a, o = 1) => {
			let s = x(t, a, r), c = x(n, a, r), l = x(n, a, i), u = x(t, a, i);
			e.quad(s, c, l, u, [0, 0], [o, 0], [o, 1], [0, 1], bt, [
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
			]), i.addCircle(t[0], t[2], .25, "pole");
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
			i.addCircle(t[0], t[2], 1.2, "pole");
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
	let g = xt(256, 96, (e, t, n) => {
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
	for (let [n, r] of b) J(t, new e.BoxGeometry(1, .45, 4.6), new e.MeshStandardMaterial({
		color: n,
		roughness: .5
	}), r, (t, [n, r, i, a, o]) => {
		t.compose(new e.Vector3(n, i, r), v.setFromAxisAngle(y, a), new e.Vector3(o, 1, 1));
	}, { cast: !0 });
	J(t, new e.CylinderGeometry(.22, .22, 4, 10).translate(0, 2, 0), new e.MeshStandardMaterial({
		color: 13225425,
		metalness: .6,
		roughness: .4
	}), f, (e, [t, n]) => e.makeTranslation(t, 0, n), { cast: !0 }), J(t, wt(), new e.MeshStandardMaterial({
		color: 12107460,
		metalness: .7,
		roughness: .35
	}), p, (t, [n, r, i]) => t.compose(new e.Vector3(n, 0, r), v.setFromAxisAngle(y, i), new e.Vector3(1, 1, 1)), { cast: !0 });
	let x = [];
	for (let n of u) {
		let r = xt(1024, 192, (e, t, r) => {
			e.fillStyle = n.chain.sign, e.fillRect(0, 0, t, r), e.fillStyle = n.chain.accent, e.fillRect(0, r - 14, t, 14);
			let i = Ct[n.chain.name];
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
var Ct = {
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
function wt() {
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
var Tt = Object.fromEntries(Object.entries({
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
}).flatMap(([e, t]) => t.map((t) => [t, e]))), Et = {
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
}, Dt = {
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
function Ot(e) {
	return /fr[aá]vega|garbarino|musimundo|cetrogar|megatone|naldo|on city/i.test(e.name) ? "tecno" : Tt[e.kind] || "local";
}
function kt(t, { root: i, graph: l, collision: u, nightMaterials: d }) {
	let f = t.shops || [];
	if (!f.length) return {
		count: 0,
		setNight() {}
	};
	let p = new s(30);
	for (let e of t.buildings) !e.special && e.h >= 3 && p.insert(e, o(e.pts));
	let m = new A();
	for (let n of f) {
		if (Ot(n) !== "boliche" || c(p, n.x, n.z, 15)) continue;
		let i = l.nearest(n.x, n.z, 120);
		if (!i) continue;
		let { a, b: s } = i.seg, d = Math.hypot(s.x - a.x, s.z - a.z) || 1, f = (s.x - a.x) / d, h = (s.z - a.z) / d, g = i.x - n.x, _ = i.z - n.z, v = Math.hypot(g, _) || 1;
		g /= v, _ /= v;
		let y = i.seg.road.w / 2 + 3, b = i.x - g * y, x = i.z - _ * y, S = (e, t) => [b + f * e - g * t, x + h * e - _ * t], C = [
			S(-9, 0),
			S(9, 0),
			S(9, 14),
			S(-9, 14)
		];
		if (r(C) < 0 && (C = C.reverse()), C.some(([e, t]) => u.isBlocked(e, t, 0))) continue;
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
		]), u.addPolygon(C, 7, "building"), t.buildings.push(w), p.insert(w, o(C));
	}
	if (!m.empty) {
		let t = new e.Mesh(m.geometry(), new e.MeshStandardMaterial({
			vertexColors: !0,
			roughness: .9
		}));
		t.castShadow = t.receiveShadow = !0, i.add(t);
	}
	let h = /* @__PURE__ */ new Map(), g = [];
	for (let e of f) {
		let n = c(p, e.x, e.z, 15);
		if (!n) continue;
		let i = r(n.pts) < 0 ? n.pts.slice().reverse() : n.pts, o = null;
		for (let t = 0; t < i.length; t++) {
			let n = i[t], r = i[(t + 1) % i.length], s = Ye(l, n, r);
			if (!s) continue;
			let [, , c, u] = a(e.x, e.z, n[0], n[1], r[0], r[1]);
			(!o || u < o.d2) && (o = {
				i: t,
				p0: n,
				p1: r,
				t: c,
				d2: u,
				front: s
			});
		}
		if (!o) continue;
		let s = Ot(e), { p0: u, p1: d, front: f } = o, m = Math.hypot(d[0] - u[0], d[1] - u[1]), _ = s === "super" && Math.abs(r(n.pts)) >= 1200, v = _ ? Math.min(m - 1, 34) : Math.min(Et[s].w, m - .4);
		if (v < 2.4) continue;
		let y = Math.min(m - v / 2 - .2, Math.max(v / 2 + .2, o.t * m)), b = `${t.buildings.indexOf(n)}:${o.i}`, x = h.get(b) || [], S = (e) => x.some(([t, n]) => e - v / 2 < n && e + v / 2 > t);
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
		let C = (d[0] - u[0]) / m, w = (d[1] - u[1]) / m, T = s === "comida" ? $e(e) : null, E = s === "super" ? yt(e.name) : null;
		g.push({
			shop: e,
			rubro: s,
			sub: T,
			w: v,
			big: _,
			chain: E,
			building: n,
			room: f.room,
			roof: n.h,
			label: T ? et[T].label : _ ? "Hipermercado" : Dt[s],
			signColor: T ? et[T].sign : E ? E.band : Et[s].sign,
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
		_[t] || (_[t] = e.sub ? dt(e.sub) : At(e.rubro), d.push(_[t]), v[t] = new A());
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
		n.receiveShadow = !0, i.add(n);
	}
	let x = 2048;
	for (let t = 0; t * 408 < g.length; t++) {
		let n = document.createElement("canvas");
		n.width = n.height = x;
		let r = n.getContext("2d");
		r.textAlign = "center", r.textBaseline = "middle";
		let a = new A();
		g.slice(t * 408, (t + 1) * 408).forEach((e, t) => {
			if (e.big) return;
			let n = t % 8 * 256, i = Math.floor(t / 8) * 40;
			r.fillStyle = e.signColor, r.fillRect(n, i, 256, 40), r.fillStyle = "rgba(255,255,255,0.85)", r.fillRect(n, i + 40 - 3, 256, 3), r.fillStyle = "#fff", r.font = "bold 26px Arial, sans-serif", r.fillText(e.shop.name.toUpperCase(), n + 128, i + 20, 242);
			let o = e.w - .2, s = Math.min(.62, o / 5.5), c = e.h - .42, l = e.x + e.ox * .1, u = e.z + e.oz * .1, d = [l + e.ux * o / 2, u + e.uz * o / 2], f = [l - e.ux * o / 2, u - e.uz * o / 2], p = n / x, m = (n + 256) / x, h = 1 - (i + 40) / x, g = 1 - i / x;
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
		d.push(s), i.add(new e.Mesh(a.geometry(), s));
	}
	let S = new e.Quaternion(), C = new e.Vector3(0, 1, 0);
	new e.Vector3(1, 1, 1);
	let w = (t, [n, r, i, a, o = 1]) => t.compose(new e.Vector3(n, i, r), S.setFromAxisAngle(C, a), new e.Vector3(o, 1, 1)), T = (e, t, n, r = 0) => [
		e.x + e.ux * t + e.ox * n,
		e.z + e.uz * t + e.oz * n,
		r,
		Math.atan2(e.ox, e.oz)
	], E = [], D = [], ee = [], O = [];
	n(8);
	let k = (e, t, n) => u.addCircle(e, t, n, "pole");
	for (let e of g) {
		let t = e.shop.kind;
		if (e.rubro === "farmacia" && E.push(T(e, e.w / 2 - .5, .55, e.h - .5)), e.rubro === "kiosco" && e.room > 1.8) {
			let t = T(e, e.w / 2 - .55, .4);
			D.push(t), k(t[0], t[1], .5);
		}
		if (t === "greengrocer" && e.room > 1.8) {
			for (let t = 0; t < 3; t++) ee.push([
				...T(e, -e.w / 2 + .6 + t * .7, .35, .15),
				1,
				t
			]);
			let t = T(e, -e.w / 2 + 1.3, .35);
			k(t[0], t[1], .7);
		}
		if (e.rubro === "taller" && e.room > 1.8) {
			let t = T(e, e.w / 2 - .6, .5);
			for (let e = 0; e < 4; e++) O.push([
				t[0],
				t[1],
				.12 + e * .23,
				0
			]);
			k(t[0], t[1], .45);
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
	let I = new e.BoxGeometry(1, 1, 1).translate(0, .5, 0), te = (t, [n, r, i, a, o, s, c]) => t.compose(new e.Vector3(n, i, r), S.setFromAxisAngle(C, a), new e.Vector3(o, s, c));
	J(i, I, j, M, te, {
		cast: !0,
		range: 300
	}), J(i, I, new e.MeshStandardMaterial({
		color: 16777215,
		roughness: .5
	}), P, te, {
		cast: !0,
		range: 400,
		color: (t) => new e.Color(t[7]).multiplyScalar(.6)
	});
	let ne = new e.MeshStandardMaterial({
		map: It(),
		roughness: .5,
		metalness: .4,
		side: e.DoubleSide
	}), L = new e.InstancedMesh(new e.PlaneGeometry(1, 1).translate(0, -.5, 0), ne, N.length);
	L.userData.dynamic = !0, L.frustumCulled = !1, i.add(L);
	let R = new e.Matrix4(), re = -1, z = (t) => {
		Math.abs(t - re) < .03 || (re = t, N.forEach((n, r) => {
			let i = Math.max(n.always, Math.min(1, t * 1.4) * n.close), a = Math.max(.02, i * n.top);
			R.compose(new e.Vector3(n.at[0], n.top, n.at[1]), S.setFromAxisAngle(C, n.at[3]), new e.Vector3(n.w, a, 1)), L.setMatrixAt(r, R);
		}), L.instanceMatrix.needsUpdate = !0);
	};
	z(0);
	let ie = ht(i, g.filter((e) => !e.big), {
		graph: l,
		collision: u,
		nightMaterials: d
	}), ae = St(i, g.filter((e) => e.big), {
		collision: u,
		nightMaterials: d
	}), oe = new e.MeshStandardMaterial({
		map: Lt(),
		emissiveMap: Lt(),
		emissive: 3211120,
		emissiveIntensity: .4
	});
	J(i, new e.BoxGeometry(.08, .8, .8), oe, E, w), J(i, new e.BoxGeometry(.9, .85, .6).translate(0, .425, 0), new e.MeshStandardMaterial({
		map: Rt(),
		roughness: .4
	}), D, w, { cast: !0 });
	let se = [
		12597547,
		15105570,
		6989903
	];
	return J(i, new e.BoxGeometry(.6, .3, .4), new e.MeshStandardMaterial({
		color: 16777215,
		roughness: .9
	}), ee, w, {
		cast: !0,
		color: (t) => new e.Color(se[t[5]])
	}), J(i, new e.TorusGeometry(.28, .11, 6, 12).rotateX(Math.PI / 2), new e.MeshStandardMaterial({
		color: 1776411,
		roughness: .95
	}), O, w, { cast: !0 }), {
		count: g.length,
		placed: g,
		setNight(e) {
			z(e), ie.setNight(e), ae.setNight(e), oe.emissiveIntensity = .4 + e * 2.5;
		}
	};
}
function At(t) {
	let r = document.createElement("canvas"), i = document.createElement("canvas");
	r.width = i.width = 1024, r.height = i.height = 256;
	let a = r.getContext("2d"), o = i.getContext("2d");
	o.fillStyle = "#000", o.fillRect(0, 0, 1024, 256);
	let s = n(t.length * 97);
	for (let e = 0; e < 4; e++) (Ft[t] || (t === "super" ? Ft.almacen : Ft.local))(a, o, e * 256, 256, s);
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
var Z = (e, t) => t[Math.floor(e() * t.length)];
function Q(e, t, n, r, i) {
	e.fillStyle = r, e.fillRect(t, 0, n, n), e.fillStyle = i, e.fillRect(t, 0, n, 54), e.fillStyle = "rgba(0,0,0,0.25)", e.fillRect(t, 54, n, 3);
}
function $(e, t, n, r, i, a, o = "#27343c", s = "#ffe7b8") {
	let c = e.createLinearGradient(n, r, n + i, r + a);
	c.addColorStop(0, o), c.addColorStop(1, "#46565f"), e.fillStyle = c, e.fillRect(n, r, i, a), e.fillStyle = "rgba(255,255,255,0.12)", e.beginPath(), e.moveTo(n + i * .1, r + a), e.lineTo(n + i * .35, r), e.lineTo(n + i * .5, r), e.lineTo(n + i * .25, r + a), e.fill(), t.fillStyle = s, t.fillRect(n, r, i, a);
}
function jt(e, t, n, r, i, a, o = "#222") {
	e.fillStyle = o, e.fillRect(n - 4, r - 4, i + 8, a + 4), $(e, t, n, r, i, a), e.fillStyle = "#bbb", e.fillRect(n + i - 10, r + a / 2, 4, 20);
}
function Mt(e, t, n, r, i, a = "#8f9396") {
	e.fillStyle = a, e.fillRect(t, n, r, i), e.fillStyle = "rgba(0,0,0,0.28)";
	for (let a = n; a < n + i; a += 6) e.fillRect(t, a, r, 2);
}
function Nt(e, t, n, r, i, a, o) {
	for (let s = n + 8; s < n + i - 6; s += 22) {
		e.fillStyle = "rgba(230,230,230,0.8)", e.fillRect(t + 4, s + 16, r - 8, 3);
		for (let n = t + 6; n < t + r - 10; n += 7 + a() * 5) e.fillStyle = Z(a, o), e.fillRect(n, s + 16 - (8 + a() * 8), 5 + a() * 3, 8 + a() * 8);
	}
}
var Pt = [
	"#e53935",
	"#fdd835",
	"#43a047",
	"#1e88e5",
	"#fb8c00",
	"#8e24aa",
	"#ffffff"
], Ft = {
	kiosco(e, t, n, r, i) {
		Q(e, n, r, Z(i, [
			"#e9e2d0",
			"#d7dde0",
			"#f1d9b5"
		]), "#3a3a3a"), $(e, t, n + 14, 72, 140, 130, "#39444a", "#fff3cf"), Nt(e, n + 14, 72, 140, 130, i, Pt), e.fillStyle = "#1f1f1f";
		for (let t = n + 14; t <= n + 154; t += 12) e.fillRect(t, 72, 3, 130);
		e.fillRect(n + 14, 200, 140, 8), jt(e, t, n + 176, 84, 62, 172, "#1f1f1f");
	},
	farmacia(e, t, n, r, i) {
		Q(e, n, r, "#f5f7f5", "#1f8a4c"), $(e, t, n + 12, 70, 150, 150, "#dfeee6", "#f4fff8"), Nt(e, n + 12, 70, 150, 150, i, [
			"#ffffff",
			"#b8e0c8",
			"#1f8a4c",
			"#90caf9",
			"#f8bbd0"
		]), jt(e, t, n + 178, 70, 66, 186, "#b0b8b4"), e.fillStyle = "#1f8a4c", e.fillRect(n + 12, 226, 150, 8);
	},
	almacen(e, t, n, r, i) {
		Q(e, n, r, Z(i, ["#f0ebe0", "#e0e6ea"]), "#b8431b"), $(e, t, n + 10, 70, 236, 150, "#3a464c", "#f7f2de"), Nt(e, n + 10, 70, 236, 150, i, [
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
		Q(e, n, r, "#d9d2c4", "#c46a12"), e.fillStyle = "#2b2622", e.fillRect(n + 12, 70, 232, 186), t.fillStyle = "#6a5a40", t.fillRect(n + 12, 120, 232, 136);
		for (let t = 0; t < 16; t++) {
			let r = n + 22 + t % 8 * 28, a = 126 + Math.floor(t / 8) * 56;
			e.fillStyle = Z(i, [
				"#c46a12",
				"#d32f2f",
				"#9e9e9e",
				"#fbc02d",
				"#1565c0"
			]), e.fillRect(r, a, 6, 30), e.fillStyle = "#bdbdbd", e.fillRect(r - 5, a, 16, 7);
		}
		Mt(e, n + 12, 70, 232, 52);
	},
	ropa(e, t, n, r, i) {
		Q(e, n, r, Z(i, [
			"#1e1e1e",
			"#f4f4f4",
			"#d8cfc4"
		]), "#111"), $(e, t, n + 10, 64, 170, 192, "#e8e4df", "#fffaf0");
		for (let t of [
			40,
			95,
			145
		]) e.fillStyle = Z(i, [
			"#c62828",
			"#283593",
			"#f9a825",
			"#2e7d32",
			"#f5f5f5",
			"#212121"
		]), e.beginPath(), e.moveTo(n + t - 16, 120), e.lineTo(n + t + 16, 120), e.lineTo(n + t + 22, 205), e.lineTo(n + t - 22, 205), e.fill(), e.fillStyle = "#d7ccc8", e.beginPath(), e.arc(n + t, 106, 10, 0, Math.PI * 2), e.fill(), e.fillRect(n + t - 2, 205, 4, 40);
		jt(e, t, n + 192, 70, 56, 186, "#111");
	},
	banco(e, t, n, r) {
		Q(e, n, r, "#c9c3b8", "#1d3f8a"), e.fillStyle = "rgba(0,0,0,0.12)";
		for (let t = 60; t < r; t += 32) e.fillRect(n, t, r, 2);
		$(e, t, n + 20, 70, 120, 186, "#1f2e3a", "#dfe9ff"), e.fillStyle = "#546e7a", e.fillRect(n + 164, 110, 70, 110), e.fillStyle = "#90caf9", e.fillRect(n + 176, 124, 46, 32), t.fillStyle = "#90caf9", t.fillRect(n + 176, 124, 46, 32), e.fillStyle = "#263238", e.fillRect(n + 180, 170, 38, 20);
	},
	taller(e, t, n, r, i) {
		Q(e, n, r, Z(i, ["#bdb6a8", "#9fa6ab"]), "#3d4a55"), e.fillStyle = "#1a1a1a", e.fillRect(n + 10, 66, 236, 190), t.fillStyle = "#403828", t.fillRect(n + 10, 66, 236, 190), e.fillStyle = "#2e2e2e", e.fillRect(n + 10, 66, 236, 26), e.fillStyle = Z(i, [
			"#8a1c1c",
			"#1c3f8a",
			"#c0c0c0"
		]), e.fillRect(n + 50, 150, 150, 40), e.fillRect(n + 80, 128, 90, 26), e.fillStyle = "#111", e.beginPath(), e.arc(n + 80, 192, 14, 0, Math.PI * 2), e.arc(n + 170, 192, 14, 0, Math.PI * 2), e.fill();
	},
	tecno(e, t, n, r, i) {
		Q(e, n, r, "#eceff1", "#1e6f8a"), $(e, t, n + 10, 70, 170, 150, "#263238", "#e3f2fd");
		for (let t = 0; t < 6; t++) {
			let r = n + 20 + t % 3 * 54, a = 84 + Math.floor(t / 3) * 64;
			e.fillStyle = "#111", e.fillRect(r, a, 44, 50), e.fillStyle = Z(i, [
				"#42a5f5",
				"#66bb6a",
				"#ab47bc",
				"#ffa726"
			]), e.fillRect(r + 3, a + 3, 38, 44);
		}
		jt(e, t, n + 192, 70, 56, 186, "#455a64");
	},
	hotel(e, t, n, r) {
		Q(e, n, r, "#d8d0c2", "#1f2a3a"), e.fillStyle = "rgba(0,0,0,0.1)";
		for (let t = 60; t < r; t += 28) e.fillRect(n, t, r, 2);
		$(e, t, n + 70, 74, 116, 182, "#3a3226", "#ffe2a8"), e.fillStyle = "#b8963e", e.fillRect(n + 64, 68, 128, 6), e.fillRect(n + 64, 68, 6, 188), e.fillRect(n + 186, 68, 6, 188), e.fillRect(n + 125, 74, 6, 182), e.fillStyle = "rgba(60,40,20,0.6)", e.fillRect(n + 90, 190, 76, 30);
		for (let r of [n + 14, n + 206]) $(e, t, r, 90, 36, 110, "#2a3440", "#ffe2a8");
	},
	hogar(e, t, n, r, i) {
		Q(e, n, r, Z(i, ["#efe9df", "#e2e6e8"]), "#8a5a2b"), $(e, t, n + 10, 66, 236, 154, "#e9e2d6", "#fff6e0"), e.fillStyle = Z(i, [
			"#6d4c41",
			"#37474f",
			"#8d6e63"
		]), e.fillRect(n + 24, 170, 90, 30), e.fillRect(n + 24, 150, 90, 22), e.fillRect(n + 18, 160, 10, 40), e.fillRect(n + 110, 160, 10, 40), e.fillStyle = "#f4f4f4", e.fillRect(n + 140, 176, 96, 24), e.fillStyle = Z(i, [
			"#1e5bb8",
			"#c2477a",
			"#3aa7a3"
		]), e.fillRect(n + 140, 168, 96, 10), e.fillStyle = "#5d4037", e.fillRect(n + 140, 146, 8, 54), e.fillStyle = "#ffe082", e.beginPath(), e.moveTo(n + 128, 110), e.lineTo(n + 148, 110), e.lineTo(n + 142, 96), e.lineTo(n + 134, 96), e.fill(), e.fillStyle = "#7a7f82", e.fillRect(n + 10, 220, 236, 36);
	},
	flores(e, t, n, r, i) {
		Q(e, n, r, "#e8efe2", "#2e7d32"), $(e, t, n + 12, 70, 160, 150, "#2f4a32", "#f6ffe8");
		for (let t = 0; t < 70; t++) e.fillStyle = t % 3 ? Z(i, [
			"#e53935",
			"#f06292",
			"#fdd835",
			"#ffffff",
			"#ab47bc",
			"#ff7043"
		]) : "#3f7a2f", e.beginPath(), e.arc(n + 20 + i() * 144, 90 + i() * 120, 4 + i() * 5, 0, Math.PI * 2), e.fill();
		jt(e, t, n + 186, 70, 60, 186, "#2e7d32");
	},
	libreria(e, t, n, r, i) {
		Q(e, n, r, Z(i, ["#efe6d6", "#e3dccf"]), "#5d4037"), $(e, t, n + 12, 70, 160, 150, "#3a3026", "#fff1d0");
		for (let t = 82; t < 210; t += 32) {
			e.fillStyle = "#6d4c41", e.fillRect(n + 16, t + 26, 152, 4);
			for (let r = n + 18; r < n + 164; r += 6 + i() * 4) e.fillStyle = Z(i, [
				"#c62828",
				"#1e5bb8",
				"#2e7d32",
				"#f9a825",
				"#4e342e",
				"#6a1b9a",
				"#eeeeee"
			]), e.fillRect(r, t + 26 - (16 + i() * 9), 5, 16 + i() * 9);
		}
		jt(e, t, n + 186, 70, 60, 186, "#5d4037");
	},
	boliche(e, t, n, r, i) {
		Q(e, n, r, "#0d0d12", "#000");
		let a = Z(i, [
			["#ff3fd0", "#3fe6ff"],
			["#a64dff", "#ffe03f"],
			["#ff4d4d", "#4dff9a"]
		]);
		for (let [i, o] of [[64, a[0]], [236, a[1]]]) e.fillStyle = o, e.fillRect(n, i, r, 5), t.fillStyle = o, t.fillRect(n, i - 2, r, 9);
		for (let r = 0; r < 6; r++) e.fillStyle = t.fillStyle = a[r % 2], e.fillRect(n + 8 + r * 42, 80, 3, 140), t.fillRect(n + 7 + r * 42, 80, 5, 140);
		e.fillStyle = "#1a1a22", e.fillRect(n + 70, 96, 116, 140), e.fillStyle = "#2b2b38", e.fillRect(n + 74, 100, 52, 136), e.fillRect(n + 130, 100, 52, 136), e.fillStyle = "#c0c4c8", e.fillRect(n + 120, 160, 4, 20), e.fillRect(n + 132, 160, 4, 20), $(e, t, n + 200, 130, 44, 40, "#2a1f30", "#ff9ad0"), e.fillStyle = "#fff", e.font = "bold 9px Arial", e.textAlign = "center", e.fillText("BOLETERÍA", n + 222, 182);
	},
	armeria(e, t, n, r, i) {
		Q(e, n, r, Z(i, ["#2b2e31", "#3a332c"]), "#1b1f23"), $(e, t, n + 12, 70, 160, 150, "#1c2226", "#f2e6c8");
		for (let t = 0; t < 6; t++) {
			let r = n + 24 + t * 25;
			e.fillStyle = "#4a3020", e.fillRect(r, 150, 7, 50), e.fillStyle = "#1a1a1a", e.fillRect(r + 2, 82, 3, 72);
		}
		e.fillStyle = "#111";
		for (let t = n + 12; t <= n + 172; t += 10) e.fillRect(t, 70, 2, 150);
		e.fillStyle = "#6d6d6d", e.fillRect(n + 12, 220, 160, 36), jt(e, t, n + 186, 70, 60, 186, "#111");
	},
	local(e, t, n, r, i) {
		Q(e, n, r, Z(i, [
			"#e6e0d4",
			"#d9dfe3",
			"#efe3c8"
		]), "#444"), $(e, t, n + 12, 70, 160, 150), e.fillStyle = "#6d6d6d", e.fillRect(n + 12, 220, 160, 36), jt(e, t, n + 186, 70, 60, 186);
	}
};
function It() {
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
function Lt() {
	let t = document.createElement("canvas");
	t.width = t.height = 64;
	let n = t.getContext("2d");
	n.fillStyle = "#0d3b1f", n.fillRect(0, 0, 64, 64), n.fillStyle = "#2ee66b", n.fillRect(22, 6, 20, 52), n.fillRect(6, 22, 52, 20);
	let r = new e.CanvasTexture(t);
	return r.colorSpace = e.SRGBColorSpace, r;
}
function Rt() {
	let t = document.createElement("canvas");
	t.width = 128, t.height = 128;
	let n = t.getContext("2d");
	n.fillStyle = "#f4f7fb", n.fillRect(0, 0, 128, 128), n.fillStyle = "#1e5bb8", n.fillRect(0, 0, 128, 34), n.fillStyle = "#fff", n.font = "bold 22px Arial, sans-serif", n.textAlign = "center", n.fillText("HELADOS", 64, 25);
	let r = new e.CanvasTexture(t);
	return r.colorSpace = e.SRGBColorSpace, r;
}
//#endregion
//#region src/entities/train.js
var zt = 20, Bt = 6, Vt = 2.9, Ht = 17, Ut = 18;
function Wt(n) {
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
	l(r, Vt, 2.9, zt, 0, 2.55, 0), l(o, 2.94, .9, 17, 0, 2.9, 0), l(i, 2.9499999999999997, .28, zt, 0, 2.2, 0), l(a, 2.9499999999999997, .12, zt, 0, 1.95, 0), l(s, 2.6, .5, 19, 0, .85, 0);
	for (let e of [-7, zt / 2 - 3]) for (let t of [-1, 1]) l(s, .08, 2.1, 1.3, t * 1.47, 2.25, e);
	l(s, .3, .4, .3, 0, 4.2, 0), n && (l(o, 2.6, 1.2, .1, 0, 3.1, 10.02), l(i, Vt, .6, .12, 0, 1.9, 10.03), l(new e.MeshStandardMaterial({
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
var Gt = class {
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
}, Kt = class {
	constructor(t, n) {
		this.trains = [];
		let r = (n.rails || []).map((e) => new Gt(e.pts)).filter((e) => e.length > 800).sort((e, t) => t.length - e.length).slice(0, 2), i = (n.specials || []).filter((e) => e.type === "station");
		r.forEach((n, r) => {
			let a = i.map((e) => n.project(e.cx, e.cz)).filter((e) => e.d < 25).map((e) => e.s).sort((e, t) => e - t), o = [];
			for (let n = 0; n < Bt; n++) {
				let r = Wt(n === 0 || n === 5);
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
				v: Ht,
				wait: 0
			});
		});
	}
	update(e) {
		let t = [];
		for (let n of this.trains) {
			let r = Bt * 20.8;
			if (n.wait > 0) n.wait -= e, n.v = 0;
			else {
				let t = n.stops.map((e) => (e - n.s) * n.dir).filter((e) => e > 1).sort((e, t) => e - t)[0], i = n.dir > 0 ? n.track.length - n.s : n.s - r, a = Math.min(t ?? Infinity, i), o = a < 120 ? Math.max(1.5, Math.sqrt(2.2 * Math.max(0, a))) : Ht;
				n.v += Math.sign(o - n.v) * Math.min(Math.abs(o - n.v), 1.1 * e), n.s += n.dir * n.v * e, t !== void 0 && t < 1.5 && (n.wait = Ut, n.s = n.stops.find((e) => Math.abs(e - n.s) < 2) ?? n.s), i < 1 && (n.dir = -n.dir, n.s = n.dir > 0 ? n.s - r : n.s + r, n.wait = Ut);
			}
			n.cars.forEach((e, r) => {
				let i = n.s - n.dir * (r * 20.8 + zt / 2), a = n.track.at(i), o = a.dx * n.dir, s = a.dz * n.dir;
				e.position.set(a.x, 0, a.z), e.rotation.y = Math.atan2(o, s), t.push({
					x: a.x,
					z: a.z,
					dx: o,
					dz: s,
					hl: zt / 2,
					hw: Vt / 2,
					vx: o * n.v,
					vz: s * n.v
				});
			});
		}
		return t;
	}
}, qt = class {
	constructor() {
		this.hash = new s(24), this.solids = [];
	}
	addPolygon(e, t = 10, n = "building") {
		let r = {
			type: "poly",
			pts: e,
			height: t,
			tag: n,
			bb: o(e)
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
		} else if (i(e, t, r.pts)) return !0;
		else if (n > 0) {
			let i = r.pts;
			for (let r = 0, o = i.length - 1; r < i.length; o = r++) if (a(e, t, i[o][0], i[o][1], i[r][0], i[r][1])[3] < n * n) return !0;
		}
		return !1;
	}
}, Jt = new e.Color(1, 1, 1);
function Yt(e, t, n, r, i) {
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
		e.quad(o[n], s[n], s[n + 1], o[n + 1], [0, a], [1, a], [1, l], [0, l], Jt, [
			0,
			1,
			0
		]), c += r;
	}
}
function Xt(e) {
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
function Zt(t, n, r, i) {
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
async function Qt(t, { dataUrl: n, frame: r, lift: i = .2 }) {
	let a = await (await fetch(n)).json(), o = je({ capabilities: { getMaxAnisotropy: () => 8 } }), s = new qt();
	Fe(a);
	let c = De(a), l = new Me(a.roads), u = new e.Group();
	u.name = "GtaQuilmesPlaces";
	let d = Xt(r), f = (t, n = 16777215, r = {}) => new e.MeshStandardMaterial({
		map: t,
		color: n,
		roughness: .95,
		depthWrite: !1,
		polygonOffset: !0,
		polygonOffsetFactor: -2,
		...r
	}), p = S(a, {
		root: u,
		collision: s,
		graph: l,
		tex: o
	}), m = kt(a, {
		root: u,
		graph: l,
		collision: s,
		nightMaterials: []
	}), h = He(a, {
		root: u,
		graph: l,
		collision: s,
		ribbon: Yt,
		flatMat: f,
		keepOut: p.keepOut,
		GeoBuf: A
	}), g = new e.Group();
	g.name = "GtaQuilmesTrains", g.position.y = i;
	let _ = $t(a, c, {
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
	}), Zt(u, d, r.theta, i), t.add(u), t.add(g), u.updateMatrixWorld(!0), g.updateMatrixWorld(!0);
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
function $t(n, r, { root: i, live: a, tex: o, flatMat: s, collision: c, toGrid: l, theta: u }) {
	let d = { update() {} };
	if (!n.rails?.length) return d;
	let f = new A(), p = new A();
	for (let e of n.rails) Yt(f, e.pts, 3.6, .05, 1 / 4);
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
	let E = new Kt(a, n), D = null;
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
//#endregion
export { Qt as buildGtaWorld };
