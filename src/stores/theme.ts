import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
export type ThemeMode = 'light' | 'dark';
const storageKey = 'yuda.theme.v1';
function savedTheme(): ThemeMode {
    try {
        return uni.getStorageSync(storageKey) === 'dark' ? 'dark' : 'light';
    }
    catch {
        return 'light';
    }
}
// Dark values for the CSS variables behind uni.scss ($ink, $surface, ...) and the wot-design-uni component tokens.
const darkVars: Record<string, string> = {
    '--yd-ink': '#e8eeeb', '--yd-muted': '#b8c6be', '--yd-muted-subtle': '#93a39b', '--yd-line': '#3a443e',
    '--yd-accent': '#6fcf9f', '--yd-accent-strong': '#9be3bf', '--yd-accent-soft': '#223a2f',
    '--yd-surface': '#242b27', '--yd-surface-alt': '#2d3531', '--yd-paper': '#171c1a',
    '--wot-color-theme': '#4fae88', '--wot-button-primary-bg-color': '#2f7a5c', '--wot-button-plain-bg-color': 'transparent',
    '--wot-color-title': '#e8eeeb', '--wot-color-content': '#d5dfd9', '--wot-color-secondary': '#b8c6be', '--wot-color-bg': '#2d3531',
    '--wot-cell-title-color': '#e8eeeb', '--wot-cell-label-color': '#b8c6be', '--wot-cell-value-color': '#d5dfd9',
    '--wot-input-bg': '#242b27', '--wot-input-color': '#e8eeeb', '--wot-textarea-bg': '#242b27', '--wot-textarea-color': '#e8eeeb',
    '--wot-picker-bg': '#242b27', '--wot-picker-column-color': '#d5dfd9', '--wot-picker-toolbar-title-color': '#e8eeeb',
    '--wot-search-input-bg': '#2d3531', '--wot-search-input-color': '#e8eeeb',
    '--wot-segmented-item-bg-color': '#2d3531', '--wot-segmented-item-color': '#d5dfd9', '--wot-segmented-item-acitve-bg': '#3a443e',
    '--wot-action-sheet-bg': '#242b27', '--wot-action-sheet-color': '#e8eeeb',
    '--wot-message-box-bg': '#242b27', '--wot-message-box-title-color': '#e8eeeb', '--wot-message-box-content-color': '#d5dfd9',
    '--wot-checkbox-label-color': '#e8eeeb',
};
const darkStyle = Object.entries(darkVars).map(([key, value]) => `${key}:${value}`).join(';');
export const useThemeStore = defineStore('theme', () => {
    const mode = ref<ThemeMode>(savedTheme());
    const isDark = computed(() => mode.value === 'dark');
    /** Bound to <page-meta :page-style> on every page (see composables/useAppearance.ts). */
    const pageStyle = computed(() => isDark.value ? `${darkStyle};background-color:#171c1a;color:#e8eeeb` : '');
    watch(mode, (value) => {
        try {
            uni.setStorageSync(storageKey, value);
        }
        catch { /* Theme changes still apply when storage is unavailable. */ }
    }, { immediate: true });
    function toggle() { mode.value = isDark.value ? 'light' : 'dark'; }
    return { mode, isDark, pageStyle, toggle };
});
