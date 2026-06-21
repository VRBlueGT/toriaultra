// Copyright (C) 2026 Index
// Kiln - a quality-of-life browser extension for Polytoria.com
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
import type { AvatarIFrameState } from "@/utils/types";

const BODY_GLB = "https://cdn.polytoria.com/static/Pauly-DS-yCzTt.glb";
const RETRO_HAT_Y_OFFSET = 1.5;

const MAT_TO_COLOR: Partial<Record<string, keyof AvatarIFrameState>> = {
	Head: "headColor",
	"Head.001": "headColor",
	Torso: "torsoColor",
	LeftArm: "leftArmColor",
	RightArm: "rightArmColor",
	LeftLeg: "leftLegColor",
	RightLeg: "rightLegColor",
	"Left Arm": "leftArmColor",
	"Right Arm": "rightArmColor",
	"Left Leg": "leftLegColor",
	"Right Leg": "rightLegColor",
};

const isUrl = (v: unknown): v is string =>
	typeof v === "string" && (v.startsWith("http") || v.startsWith("data:"));

async function loadImage(url: string): Promise<HTMLImageElement> {
	const buf = await fetch(url).then((r) => r.arrayBuffer());
	const objUrl = URL.createObjectURL(new Blob([buf], { type: "image/png" }));
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(objUrl);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(objUrl);
			reject(new Error(`Failed to load image: ${url}`));
		};
		img.src = objUrl;
	});
}

function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const tex = new THREE.CanvasTexture(canvas);
	tex.flipY = false;
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.generateMipmaps = false;
	tex.minFilter = THREE.LinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	return tex;
}

async function buildFaceTexture(
	headColor: string,
	faceUrl: string,
): Promise<THREE.CanvasTexture> {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 512;
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = headColor;
	ctx.fillRect(0, 0, 512, 512);
	try {
		ctx.drawImage(await loadImage(faceUrl), 0, 0, 512, 512);
	} catch {}
	return makeTexture(canvas);
}

function buildClothingTex(
	images: HTMLImageElement[],
	skinColor: string,
): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 512;
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = skinColor;
	ctx.fillRect(0, 0, 512, 512);
	for (const img of images) ctx.drawImage(img, 0, 0, 512, 512);
	return makeTexture(canvas);
}

export class AvatarRenderer {
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;
	private controls: OrbitControls;
	private loader = new GLTFLoader();
	private cachedBodyGltf: any | null = null;
	private avatarGroup: THREE.Group | null = null;
	private mixer: THREE.AnimationMixer | null = null;
	private clips: THREE.AnimationClip[] = [];
	private clock = new THREE.Clock();
	private hasLoaded = false;
	private animId: number | null = null;
	private ro: ResizeObserver;

	constructor(canvas: HTMLCanvasElement) {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x1a1a1a);

		const w = canvas.clientWidth || 300;
		const h = canvas.clientHeight || 314;

		this.camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100);
		this.camera.position.set(0, 3, 6);

		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(w, h, false);
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;

		this.controls = new OrbitControls(this.camera, canvas);
		this.controls.target.set(0, 2.5, 0);
		this.controls.minDistance = 1.5;
		this.controls.maxDistance = 20;
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.update();

		this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
		const sun = new THREE.DirectionalLight(0xffffff, 1.5);
		sun.position.set(5, 10, 7);
		this.scene.add(sun);
		const fill = new THREE.DirectionalLight(0xffffff, 0.5);
		fill.position.set(-5, 3, -5);
		this.scene.add(fill);

		this.ro = new ResizeObserver(() => this.resize());
		this.ro.observe(canvas);

		this.animate();
	}

	private animate(): void {
		this.animId = requestAnimationFrame(() => this.animate());
		this.mixer?.update(this.clock.getDelta());
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
	}

	private resize(): void {
		const canvas = this.renderer.domElement;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (w === 0 || h === 0) return;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}

	private clearAvatar(): void {
		if (this.mixer) {
			this.mixer.stopAllAction();
			this.mixer = null;
		}
		if (!this.avatarGroup) return;
		this.avatarGroup.traverse((obj) => {
			if (!(obj instanceof THREE.Mesh)) return;
			obj.geometry.dispose();
			const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
			for (const m of mats) {
				const stdMat = m as THREE.MeshStandardMaterial;
				stdMat.map?.dispose();
				stdMat.dispose();
			}
		});
		this.scene.remove(this.avatarGroup);
		this.avatarGroup = null;
	}

	async load(avatar: AvatarIFrameState): Promise<void> {
		this.clearAvatar();

		const faceUrl = isUrl(avatar.face) ? avatar.face : undefined;
		const clothingUrls = (avatar.clothing ?? []).filter(isUrl) as string[];
		const bodyUrl = isUrl(avatar.body) ? avatar.body : undefined;
		const toolUrl = isUrl(avatar.tool) ? avatar.tool : undefined;
		const accUrls = (avatar.items as (string | number)[]).filter(
			isUrl,
		) as string[];

		if (!this.cachedBodyGltf) {
			this.cachedBodyGltf = await this.loader.loadAsync(BODY_GLB);
		}

		const clothingImages: HTMLImageElement[] = [];
		if (clothingUrls.length) {
			await Promise.all(
				clothingUrls.map(async (url) => {
					try {
						clothingImages.push(await loadImage(url));
					} catch {}
				}),
			);
		}

		const faceTexture = faceUrl
			? await buildFaceTexture(avatar.headColor, faceUrl)
			: null;

		const partTexCache = new Map<string, THREE.CanvasTexture>();
		const getClothingTex = (skinColor: string): THREE.CanvasTexture => {
			const cached = partTexCache.get(skinColor);
			if (cached) return cached;
			const tex = buildClothingTex(clothingImages, skinColor);
			partTexCache.set(skinColor, tex);
			return tex;
		};

		const bodyScene = skeletonClone(this.cachedBodyGltf.scene);

		const animations: THREE.AnimationClip[] = (
			this.cachedBodyGltf.animations ?? []
		).map((clip: THREE.AnimationClip) =>
			THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(clip)),
		);
		const animName = toolUrl ? "ToolHold" : "Idle";
		this.clips = animations;
		const clipToPlay =
			animations.find((a) => a.name === animName) ?? animations[0];
		if (clipToPlay) {
			this.mixer = new THREE.AnimationMixer(bodyScene);
			const action = this.mixer.clipAction(clipToPlay).reset().play();
			if (animName === "Idle") action.paused = true;
		}

		bodyScene.traverse((node: THREE.Object3D) => {
			if (!(node instanceof THREE.Mesh)) return;
			const mat = (node.material as THREE.MeshStandardMaterial).clone();
			node.material = mat;
			const matName: string = mat.name ?? "";
			const colorKey = MAT_TO_COLOR[matName];
			const skinColor = colorKey
				? ((avatar as Record<string, unknown>)[colorKey] as string)
				: null;

			if (faceTexture && /head/i.test(matName)) {
				mat.map = faceTexture;
				mat.color.set(0xffffff);
				mat.metalness = 0;
				mat.roughness = 1;
			} else if (clothingImages.length && skinColor && /torso|arm|leg/i.test(matName)) {
				mat.map = getClothingTex(skinColor);
				mat.color.set(0xffffff);
				mat.metalness = 0;
				mat.roughness = 1;
			} else if (colorKey && skinColor) {
				mat.color = new THREE.Color(skinColor);
				mat.metalness = 0;
				mat.roughness = 1;
				mat.map = null;
			}
			mat.needsUpdate = true;
		});

		const group = new THREE.Group();
		group.add(bodyScene);

		if (bodyUrl) {
			try {
				const bodyGltf = await this.loader.loadAsync(bodyUrl);
				const bodyGltfScene = bodyGltf.scene;

				bodyGltfScene.traverse((node: THREE.Object3D) => {
					if (!(node instanceof THREE.Mesh)) return;
					const mat = (node.material as THREE.MeshStandardMaterial).clone();
					node.material = mat;
					const colorKey =
						MAT_TO_COLOR[(mat.name as string) ?? ""] ?? MAT_TO_COLOR[node.name];
					if (!colorKey) return;
					const skinColor = (avatar as Record<string, unknown>)[
						colorKey
					] as string;
					mat.metalness = 0;
					mat.roughness = 1;
					if (colorKey === "headColor") {
						if (faceTexture) {
							mat.map = faceTexture;
							mat.color.set(0xffffff);
						} else {
							mat.color = new THREE.Color(skinColor);
							mat.map = null;
						}
					} else if (clothingImages.length) {
						mat.map = getClothingTex(skinColor);
						mat.color.set(0xffffff);
					} else {
						mat.color = new THREE.Color(skinColor);
						mat.map = null;
					}
					mat.needsUpdate = true;
				});

				this.mixer?.stopAllAction();
				const rawBodyAnims: THREE.AnimationClip[] = bodyGltf.animations?.length
					? bodyGltf.animations
					: (this.cachedBodyGltf.animations ?? []);
				const bodyAnims = rawBodyAnims.map((clip: THREE.AnimationClip) =>
					THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(clip)),
				);
				this.clips = bodyAnims;
				const bodyClip =
					bodyAnims.find((a: THREE.AnimationClip) => a.name === animName) ??
					bodyAnims[0];
				if (bodyClip) {
					this.mixer = new THREE.AnimationMixer(bodyGltfScene);
					const action = this.mixer.clipAction(bodyClip).reset().play();
					if (animName === "Idle") action.paused = true;
				}

				group.add(bodyGltfScene);

				bodyScene.visible = false;
			} catch {}
		}

		await Promise.all(
			[...accUrls, ...(toolUrl ? [toolUrl] : [])].map(async (url) => {
				try {
					const gltf = await this.loader.loadAsync(url);
					if (url.includes("poly-upd-archival.pages.dev"))
						gltf.scene.position.y += RETRO_HAT_Y_OFFSET;
					group.add(gltf.scene);
				} catch {}
			}),
		);

		this.avatarGroup = group;
		this.scene.add(group);

		if (!this.hasLoaded) {
			this.hasLoaded = true;
			const box = new THREE.Box3().setFromObject(group);
			const center = box.getCenter(new THREE.Vector3());
			const size = box.getSize(new THREE.Vector3());
			const dist = Math.max(size.x, size.y, size.z) * 1.8;
			this.controls.target.copy(center);
			this.camera.position.set(
				center.x,
				center.y + size.y * 0.05,
				center.z + dist,
			);
			this.controls.update();
		}
	}

	async exportGLB(): Promise<ArrayBuffer> {
		if (!this.avatarGroup) throw new Error("No avatar loaded");
		const { GLTFExporter } = await import(
			"three/addons/exporters/GLTFExporter.js"
		);
		const exporter = new GLTFExporter();
		return new Promise((resolve, reject) => {
			exporter.parse(
				this.avatarGroup!,
				(result) => resolve(result as ArrayBuffer),
				reject,
				{ binary: true, animations: this.clips },
			);
		});
	}

	playAnimation(name: string): void {
		if (!this.mixer) return;
		this.mixer.stopAllAction();
		const clip = this.clips.find((c) => c.name === name) ?? this.clips[0];
		if (!clip) return;
		const action = this.mixer.clipAction(clip).reset().play();
		if (name === "Idle") action.paused = true;
	}

	dispose(): void {
		this.ro.disconnect();
		if (this.animId !== null) cancelAnimationFrame(this.animId);
		this.clearAvatar();
		this.renderer.dispose();
	}
}