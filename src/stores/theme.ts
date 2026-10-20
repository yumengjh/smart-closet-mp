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
export const useThemeStore = defineStore('theme', () => {
    const mode = ref<ThemeMode>(savedTheme());
    const isDark = computed(() => mode.value === 'dark');
    watch(mode, (value) => {
        try {
            uni.setStorageSync(storageKey, value);
        }
        catch { /* Theme changes still apply when storage is unavailable. */ }
    }, { immediate: true });
    function toggle() { mode.value = isDark.value ? 'light' : 'dark'; }
    return { mode, isDark, toggle };
});
