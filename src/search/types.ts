// DesktopApp interface matching Rust struct
export interface DesktopApp {
    name: string;
    path: string;
    target: string | null;
    icon: string | null;
}

// Calculator result interface
export interface CalcResult {
    expression: string;
    result: string;
}

// URL match result
export interface UrlResult {
    displayUrl: string;
    fullUrl: string;
}
