// Shared by the theme toggle (client) and the layout's pre-paint script (server).
export const THEME_KEY = "cosign-theme";

// Runs before first paint so a stored choice never flashes the wrong theme.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();`;
