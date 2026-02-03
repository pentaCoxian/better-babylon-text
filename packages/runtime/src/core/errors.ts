/**
 * Custom error classes for babylon-tmp-text
 */

/**
 * Base error class for the package
 */
export class TmpTextError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TmpTextError";
    }
}

/**
 * Error thrown when a font fails to load
 */
export class FontLoadError extends TmpTextError {
    public readonly url: string;
    public readonly cause?: Error;

    constructor(url: string, cause?: Error) {
        super(`Failed to load font from: ${url}`);
        this.name = "FontLoadError";
        this.url = url;
        this.cause = cause;
    }
}

/**
 * Error thrown when a font pack manifest is invalid
 */
export class FontManifestError extends TmpTextError {
    public readonly url: string;

    constructor(url: string, reason: string) {
        super(`Invalid font manifest at ${url}: ${reason}`);
        this.name = "FontManifestError";
        this.url = url;
    }
}

/**
 * Error thrown when a paragraph handle is invalid
 */
export class InvalidHandleError extends TmpTextError {
    public readonly handleId: number;

    constructor(handleId: number) {
        super(`Invalid paragraph handle: ${handleId}`);
        this.name = "InvalidHandleError";
        this.handleId = handleId;
    }
}

/**
 * Error thrown when buffer allocation fails
 */
export class AllocationError extends TmpTextError {
    public readonly requestedSize: number;

    constructor(requestedSize: number, reason: string) {
        super(`Failed to allocate ${requestedSize} slots: ${reason}`);
        this.name = "AllocationError";
        this.requestedSize = requestedSize;
    }
}

/**
 * Error thrown when the system is used after disposal
 */
export class DisposedError extends TmpTextError {
    constructor(componentName: string) {
        super(`Cannot use ${componentName} after disposal`);
        this.name = "DisposedError";
    }
}

/**
 * Error thrown when a required font is not loaded
 */
export class FontNotFoundError extends TmpTextError {
    public readonly fontId: string;

    constructor(fontId: string) {
        super(`Font not found: ${fontId}`);
        this.name = "FontNotFoundError";
        this.fontId = fontId;
    }
}

/**
 * Error thrown when initialization fails
 */
export class InitializationError extends TmpTextError {
    public readonly cause?: Error;

    constructor(message: string, cause?: Error) {
        super(`Initialization failed: ${message}`);
        this.name = "InitializationError";
        this.cause = cause;
    }
}
