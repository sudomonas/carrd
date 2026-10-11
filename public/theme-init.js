// Applies the saved theme before first paint to avoid a flash. Kept as an
// external file so the Content-Security-Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('carrd:theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {
  /* storage unavailable: follow the system theme */
}
