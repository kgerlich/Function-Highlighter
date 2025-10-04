export interface ColorConfig {
    baseColor: string;
    minLines: number;
    maxLines: number;
}

export interface RGBColor {
    r: number;
    g: number;
    b: number;
}

export class ColorCalculator {
    // Godbolt-inspired soft pastel color palette
    // Light, subtle colors that don't interfere with code readability
    private colorPalette: { dark: string[], light: string[] } = {
        dark: [
            '#2d4a2c', // muted dark green
            '#4a3829', // muted dark brown/tan
            '#2c3e50', // muted dark blue
            '#4a3547', // muted dark purple
            '#4a4532', // muted dark olive
            '#2c4a47', // muted dark teal
            '#4a2f2f', // muted dark red
            '#34495e', // muted slate
            '#3d5a3d', // muted forest
            '#3d2f52', // muted violet
        ],
        light: [
            '#d4f1d4', // soft light green (Godbolt style)
            '#ffe8cc', // soft peach
            '#d4e4f7', // soft light blue
            '#f0d4f0', // soft lavender
            '#fef8d4', // soft light yellow
            '#d4f0f0', // soft aqua
            '#ffd4d4', // soft pink
            '#e0e8f0', // soft grey-blue
            '#e8f4e8', // soft mint
            '#e8d4f4', // soft purple
        ]
    };

    /**
     * Converts hex color to RGB
     */
    private hexToRgb(hex: string): RGBColor | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Converts RGB to hex
     */
    private rgbToHex(rgb: RGBColor): string {
        const toHex = (n: number) => {
            const hex = Math.round(n).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
    }

    /**
     * Calculate relative luminance for contrast checking
     * https://www.w3.org/TR/WCAG20/#relativeluminancedef
     */
    private getLuminance(rgb: RGBColor): number {
        const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
            const v = val / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * Calculate contrast ratio between two colors
     * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
     */
    private getContrastRatio(color1: RGBColor, color2: RGBColor): number {
        const lum1 = this.getLuminance(color1);
        const lum2 = this.getLuminance(color2);
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Get a distinct solid color for a function based on its index
     * The color brightness is modulated by function length
     */
    calculateColor(functionIndex: number, lineCount: number, config: ColorConfig, isDarkTheme: boolean): string {
        const palette = isDarkTheme ? this.colorPalette.dark : this.colorPalette.light;
        const baseColor = palette[functionIndex % palette.length];
        const baseRgb = this.hexToRgb(baseColor);

        if (!baseRgb) {
            return isDarkTheme ? '#2d5016' : '#c8e6c9';
        }

        // Normalize line count to adjust brightness (0-1 range)
        const normalized = Math.min(
            Math.max((lineCount - config.minLines) / (config.maxLines - config.minLines), 0),
            1
        );

        // Adjust brightness based on function length (very subtle)
        // Longer functions get slightly more visible
        const brightnessAdjust = normalized * 0.15; // 0-15% adjustment (reduced from 30%)

        let adjustedRgb: RGBColor;
        if (isDarkTheme) {
            // In dark mode, make longer functions slightly brighter
            adjustedRgb = {
                r: Math.min(255, baseRgb.r + (255 - baseRgb.r) * brightnessAdjust),
                g: Math.min(255, baseRgb.g + (255 - baseRgb.g) * brightnessAdjust),
                b: Math.min(255, baseRgb.b + (255 - baseRgb.b) * brightnessAdjust)
            };
        } else {
            // In light mode, make longer functions very slightly darker
            adjustedRgb = {
                r: Math.max(0, baseRgb.r - baseRgb.r * brightnessAdjust * 0.2),
                g: Math.max(0, baseRgb.g - baseRgb.g * brightnessAdjust * 0.2),
                b: Math.max(0, baseRgb.b - baseRgb.b * brightnessAdjust * 0.2)
            };
        }

        return this.rgbToHex(adjustedRgb);
    }

    /**
     * Get border color - slightly brighter/darker than background for visibility
     */
    getBorderColor(functionIndex: number, lineCount: number, config: ColorConfig, isDarkTheme: boolean): string {
        const palette = isDarkTheme ? this.colorPalette.dark : this.colorPalette.light;
        const baseColor = palette[functionIndex % palette.length];
        const baseRgb = this.hexToRgb(baseColor);

        if (!baseRgb) {
            return isDarkTheme ? '#4a7c2f' : '#a5d6a7';
        }

        // Return the bright, vivid color directly - no adjustment needed
        // The palette colors are already optimized for visibility
        return this.rgbToHex(baseRgb);
    }
}
