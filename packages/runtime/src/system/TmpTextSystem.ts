/**
 * Main system for managing TMP-like text rendering
 */

import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { IDisposable } from "@babylonjs/core/scene";
import { TextRendererEx, type ITextRendererEx } from "../extended/TextRendererEx";
import type { AllocatorStats } from "../allocator/types";
import { FontPack, type IFontPack } from "../fonts/FontPack";
import { FallbackChain, type IFallbackChain } from "../fonts/FallbackChain";
import { TextLabel, type ITextLabel, type ITextLabelInternal } from "../objects/TextLabel";
import type { TextLabelOptions } from "../objects/TextLabelOptions";
import { DisposedError, FontNotFoundError, InitializationError } from "../core/errors";
import { DEFAULT_INITIAL_CAPACITY, DEFAULT_COMPACTION_THRESHOLD } from "../core/constants";

/**
 * Options for creating TmpTextSystem
 */
export interface TmpTextSystemOptions {
    /** Font pack manifest URLs to load */
    fonts: string[];
    /** Fallback chain (font names in priority order) */
    fallback?: string[];
    /** Whether to use HarfBuzz WASM shaper (not implemented yet) */
    shaper?: "harfbuzz-wasm" | "simple" | null;
    /** Line breaking strategy (not implemented yet) */
    lineBreak?: "uax14" | "simple";
    /** Initial buffer capacity per renderer */
    initialCapacity?: number;
    /** Fragmentation threshold for auto-compaction (0.0-1.0) */
    compactionThreshold?: number;
    /** Whether to auto-attach to scene render loop */
    autoAttach?: boolean;
}

/**
 * Main system interface
 */
export interface ITmpTextSystem extends IDisposable {
    // Label Management
    createLabel(options?: TextLabelOptions): ITextLabel;
    removeLabel(label: ITextLabel): void;
    readonly labels: ReadonlyArray<ITextLabel>;
    readonly labelCount: number;

    // Rendering
    render(camera: Camera): void;
    attachToScene(scene: Scene, cameraProvider?: () => Camera): void;
    detachFromScene(): void;

    // Font Management
    loadFonts(manifestUrls: string[]): Promise<void>;
    readonly loadedFonts: ReadonlyArray<string>;

    // Performance
    flush(): void;
    queueUpdate(label: ITextLabel): void;
    getStats(): Map<string, AllocatorStats>;
    compact(): void;
}

/**
 * TmpTextSystem implementation
 */
export class TmpTextSystem implements ITmpTextSystem {
    private _scene: Scene;
    private _engine: AbstractEngine;
    private _options: TmpTextSystemOptions;

    // Font management
    private _fontPacks: Map<string, IFontPack> = new Map();
    private _fallbackChain: IFallbackChain;

    // Renderers (one per font pack for now, could add material style bucketing later)
    private _renderers: Map<string, ITextRendererEx> = new Map();

    // Labels
    private _labels: Set<ITextLabelInternal> = new Set();
    private _pendingUpdates: Set<ITextLabelInternal> = new Set();

    // Scene attachment
    private _sceneObserver: Observer<Scene> | null = null;
    private _cameraProvider: (() => Camera) | null = null;

    // State
    private _isDisposed: boolean = false;

    private constructor(scene: Scene, options: TmpTextSystemOptions) {
        this._scene = scene;
        this._engine = scene.getEngine();
        this._options = {
            initialCapacity: DEFAULT_INITIAL_CAPACITY,
            compactionThreshold: DEFAULT_COMPACTION_THRESHOLD,
            autoAttach: true,
            ...options,
        };
        this._fallbackChain = new FallbackChain();
    }

    /**
     * Create a new TmpTextSystem asynchronously
     */
    public static async CreateAsync(
        scene: Scene,
        options: TmpTextSystemOptions
    ): Promise<TmpTextSystem> {
        const system = new TmpTextSystem(scene, options);

        try {
            // Load font packs
            await system.loadFonts(options.fonts);

            // Set fallback order if specified
            if (options.fallback) {
                system._fallbackChain.setOrder(options.fallback);
            }

            // Auto-attach to scene if requested
            if (options.autoAttach !== false) {
                system.attachToScene(scene);
            }

            return system;
        } catch (error) {
            system.dispose();
            throw new InitializationError("Failed to initialize TmpTextSystem", error as Error);
        }
    }

    // ============ Label Management ============

    public createLabel(options?: TextLabelOptions): ITextLabel {
        this._checkDisposed();

        const label = new TextLabel(options) as ITextLabelInternal;

        // Determine which font pack to use
        const fontId = options?.font ?? this._getDefaultFontId();
        if (!fontId) {
            throw new FontNotFoundError("No fonts loaded");
        }

        const fontPack = this._fontPacks.get(fontId);
        if (!fontPack) {
            throw new FontNotFoundError(fontId);
        }

        // Get or create renderer for this font
        const renderer = this._getOrCreateRenderer(fontId, fontPack);

        // Create paragraph in renderer
        const handle = renderer.createParagraph(
            label.text,
            {
                ...label.getParagraphOptions(),
                worldMatrix: label.worldMatrix,
                capacityHint: options?.capacityHint,
            }
        );

        // Link label to renderer
        label.setHandle(handle);
        label.setRenderer(renderer);

        // Set up update callback
        label.onSystemUpdate = () => {
            this.queueUpdate(label);
        };

        this._labels.add(label);

        // Update character count from renderer
        const record = renderer.getParagraphRecord(handle);
        if (record) {
            label.setCharacterCount(record.length);
        }

        return label;
    }

    public removeLabel(label: ITextLabel): void {
        this._checkDisposed();

        const internalLabel = label as ITextLabelInternal;
        if (!this._labels.has(internalLabel)) {
            return;
        }

        // Remove from pending updates
        this._pendingUpdates.delete(internalLabel);

        // Dispose will remove from renderer
        label.dispose();

        // Remove from our set
        this._labels.delete(internalLabel);
    }

    public get labels(): ReadonlyArray<ITextLabel> {
        return Array.from(this._labels);
    }

    public get labelCount(): number {
        return this._labels.size;
    }

    // ============ Rendering ============

    public render(camera: Camera): void {
        this._checkDisposed();

        // Process pending updates
        this.flush();

        // Get view and projection matrices
        const viewMatrix = camera.getViewMatrix();
        const projectionMatrix = camera.getProjectionMatrix();

        // Render each renderer
        for (const renderer of this._renderers.values()) {
            renderer.render(viewMatrix, projectionMatrix);
        }
    }

    public attachToScene(scene: Scene, cameraProvider?: () => Camera): void {
        this._checkDisposed();

        // Detach from previous scene if any
        this.detachFromScene();

        this._scene = scene;
        this._cameraProvider = cameraProvider ?? null;

        // Attach to render loop - use onAfterRenderObservable to render AFTER Babylon.js
        // so our content isn't cleared by Babylon's render
        this._sceneObserver = scene.onAfterRenderObservable.add(() => {
            const camera = this._cameraProvider
                ? this._cameraProvider()
                : scene.activeCamera;

            if (camera) {
                this.render(camera);
            }
        });
    }

    public detachFromScene(): void {
        if (this._sceneObserver) {
            this._scene.onAfterRenderObservable.remove(this._sceneObserver);
            this._sceneObserver = null;
        }
        this._cameraProvider = null;
    }

    // ============ Font Management ============

    public async loadFonts(manifestUrls: string[]): Promise<void> {
        this._checkDisposed();

        for (const url of manifestUrls) {
            // Check if it's a BMFont JSON or a font pack manifest
            const fontPack = url.endsWith(".json") && !url.includes("manifest")
                ? await FontPack.LoadFromBmFontAsync(url, this._engine)
                : await FontPack.LoadAsync(url, this._engine);

            this._fontPacks.set(fontPack.manifest.id, fontPack);
            this._fallbackChain.addPack(fontPack);
        }
    }

    public get loadedFonts(): ReadonlyArray<string> {
        return Array.from(this._fontPacks.keys());
    }

    // ============ Performance ============

    public flush(): void {
        this._checkDisposed();

        if (this._pendingUpdates.size === 0) {
            return;
        }

        for (const label of this._pendingUpdates) {
            this._updateLabel(label);
        }

        this._pendingUpdates.clear();
    }

    public queueUpdate(label: ITextLabel): void {
        this._checkDisposed();

        const internalLabel = label as ITextLabelInternal;
        if (this._labels.has(internalLabel)) {
            this._pendingUpdates.add(internalLabel);
        }
    }

    public getStats(): Map<string, AllocatorStats> {
        const stats = new Map<string, AllocatorStats>();
        for (const [fontId, renderer] of this._renderers) {
            stats.set(fontId, renderer.getStats());
        }
        return stats;
    }

    public compact(): void {
        this._checkDisposed();

        for (const renderer of this._renderers.values()) {
            renderer.compact();
        }
    }

    public dispose(): void {
        if (this._isDisposed) return;

        // Detach from scene
        this.detachFromScene();

        // Dispose all labels
        for (const label of this._labels) {
            label.dispose();
        }
        this._labels.clear();
        this._pendingUpdates.clear();

        // Dispose all renderers
        for (const renderer of this._renderers.values()) {
            renderer.dispose();
        }
        this._renderers.clear();

        // Dispose all font packs
        for (const fontPack of this._fontPacks.values()) {
            fontPack.dispose();
        }
        this._fontPacks.clear();

        this._isDisposed = true;
    }

    // ============ Private Methods ============

    private _checkDisposed(): void {
        if (this._isDisposed) {
            throw new DisposedError("TmpTextSystem");
        }
    }

    private _getDefaultFontId(): string | null {
        const packIds = this._fallbackChain.packIds;
        return packIds.length > 0 ? packIds[0] : null;
    }

    private _getOrCreateRenderer(fontId: string, _fontPack: IFontPack): ITextRendererEx {
        const renderer = this._renderers.get(fontId);
        if (renderer) {
            return renderer;
        }

        // Create renderer synchronously using the already-loaded font asset
        // Note: In a real implementation, we'd want to handle async creation better
        // For now, we'll create it lazily
        throw new Error("Renderer not yet created - call _ensureRendererAsync first");
    }

    /** @internal */
    public async _ensureRendererAsync(fontId: string, fontPack: IFontPack): Promise<ITextRendererEx> {
        let renderer = this._renderers.get(fontId);
        if (renderer) {
            return renderer;
        }

        // Create new renderer for this font
        renderer = await TextRendererEx.CreateAsync(
            fontPack.getPrimaryAsset(),
            this._engine,
            this._options.initialCapacity,
            this._options.compactionThreshold
        );

        this._renderers.set(fontId, renderer);
        return renderer;
    }

    private _updateLabel(label: ITextLabelInternal): void {
        if (!label.isDirty) return;

        const handle = label.handle;
        const renderer = label.renderer;

        if (!handle || !renderer) return;

        // Check visibility
        if (!label.visible) {
            // Could hide by setting scale to 0 or removing
            // For now, just skip rendering updates
            label.clearDirty();
            return;
        }

        // Update paragraph in renderer
        renderer.updateParagraph(handle, {
            text: label.text,
            options: label.getParagraphOptions(),
            worldMatrix: label.worldMatrix,
            color: label.color as any,
        });

        // Update character count
        const record = renderer.getParagraphRecord(handle);
        if (record) {
            label.setCharacterCount(record.length);
        }

        label.clearDirty();
    }
}

// Export a factory that ensures renderers are created
export async function createTmpTextSystem(
    scene: Scene,
    options: TmpTextSystemOptions
): Promise<ITmpTextSystem> {
    const system = await TmpTextSystem.CreateAsync(scene, options);

    // Pre-create renderers for all loaded fonts
    const fontPacks = Array.from((system as any)._fontPacks.entries()) as [string, IFontPack][];
    for (const [fontId, fontPack] of fontPacks) {
        await (system as any)._ensureRendererAsync(fontId, fontPack);
    }

    return system;
}
