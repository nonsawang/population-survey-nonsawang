export const getSwal = () => typeof window !== 'undefined' ? window.Swal : null;
export const swal = (opts) => { const S = getSwal(); return S ? S.fire(opts) : Promise.resolve(window.alert(opts.text || opts.title || '')); };
export const Toast = (icon, title) => { const S = getSwal(); return S ? S.mixin({ toast:true, position:'top-end', showConfirmButton:false, timer:2000, timerProgressBar:true }).fire({ icon, title }) : null; };
export const showLoading = (title) => { const S = getSwal(); return S ? S.fire({ title, allowOutsideClick:false, didOpen:()=>S.showLoading() }) : null; };
export const closeLoading = () => { const S = getSwal(); return S ? S.close() : null; };


