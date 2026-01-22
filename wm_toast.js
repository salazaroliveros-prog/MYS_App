(function(){
  if (typeof window === 'undefined') return;
  if (window.wmToast) return; // already defined

  // Inject minimal CSS for toasts
  const css = `
    .wm-toast-container{position:fixed;left:50%;transform:translateX(-50%);bottom:28px;z-index:999999;}
    .wm-toast{background:#111827;color:#fff;padding:10px 14px;border-radius:8px;margin-top:8px;box-shadow:0 6px 18px rgba(0,0,0,.2);opacity:0;transition:all .25s ease;pointer-events:none}
    .wm-toast.show{opacity:1;transform:translateY(0);pointer-events:auto}
  `;
  try{
    const style = document.createElement('style'); style.type = 'text/css'; style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }catch(e){ /* ignore */ }

  function createContainer(){
    let c = document.getElementById('wm-toast-container');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'wm-toast-container';
    c.className = 'wm-toast-container';
    document.body.appendChild(c);
    return c;
  }

  window.wmToast = function(msg, ms=3000){
    try{
      const container = createContainer();
      const t = document.createElement('div');
      t.className = 'wm-toast';
      t.innerText = msg;
      container.appendChild(t);
      // show
      setTimeout(()=> t.classList.add('show'), 10);
      // hide
      setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=> t.remove(), 250); }, ms);
    }catch(e){
      try{ alert(msg); }catch(e){ console.warn(msg); }
    }
  };
})();
