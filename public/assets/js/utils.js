export function qs(sel, scope = document) { return scope.querySelector(sel); }
export function qsa(sel, scope = document) { return [...scope.querySelectorAll(sel)]; }
export function on(el, evt, fn) { el.addEventListener(evt, fn); }
export const debounce = (fn, ms=250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), ms);
  };
};