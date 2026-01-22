// Global compact view synchronizer
(function(){
    function setKeys(enabled){
        try{
            localStorage.setItem('calc_compact_view', enabled ? '1' : '0');
            localStorage.setItem('index_compact_view', enabled ? '1' : '0');
            localStorage.setItem('projects_compact_view', enabled ? '1' : '0');
            localStorage.setItem('global_compact_view', enabled ? '1' : '0');
        }catch(e){}
    }

    function applyToDocument(enabled){
        try{
            document.querySelectorAll('table').forEach(t=>{
                if (enabled) t.classList.add('compact-view'); else t.classList.remove('compact-view');
            });
            // toggle any known local buttons for visual feedback
            const bCalc = document.getElementById('compactToggle'); if (bCalc) bCalc.classList[enabled? 'add':'remove']('active');
            const bIdx = document.getElementById('compactToggleIndex'); if (bIdx) bIdx.classList[enabled? 'add':'remove']('active');
            const bProj = document.getElementById('compactToggleProjects'); if (bProj) bProj.classList[enabled? 'add':'remove']('active');
            // fleeting highlight
            document.body.classList.add('compact-activation-flash');
            setTimeout(()=>document.body.classList.remove('compact-activation-flash'), 700);
        }catch(e){}
    }

    window.syncCompactGlobal = function(){
        try{
            const cur = localStorage.getItem('global_compact_view') === '1';
            const next = !cur;
            setKeys(next);
            applyToDocument(next);
        }catch(e){ console.warn('syncCompactGlobal error', e); }
    };

    // If page loads and global flag is set, ensure current page applies it
    try{
        if (localStorage.getItem('global_compact_view') === '1') applyToDocument(true);
    }catch(e){}

    // Sync across tabs: respond to storage events so toggles reflect in other windows
    try {
        window.addEventListener('storage', (ev) => {
            try {
                const page = (location.pathname || '').split('/').pop() || '';
                const pageKeyMap = {
                    'calculadora.html': 'calc_compact_view',
                    'index.html': 'index_compact_view',
                    'proyectos.html': 'projects_compact_view',
                    'visita_campo.html': 'projects_compact_view'
                };
                const pageKey = pageKeyMap[page] || null;
                const global = localStorage.getItem('global_compact_view') === '1';
                const pageEnabled = pageKey ? (localStorage.getItem(pageKey) === '1') : false;
                const enabled = global || pageEnabled;
                applyToDocument(enabled);
            } catch (e) { console.warn('storage event handler error', e); }
        });
    } catch (e) { /* ignore */ }

    // --- Accessibility helpers for .wm-tooltip elements ---
    try {
        function initTooltips() {
            const wrappers = document.querySelectorAll('.wm-tooltip');
            let idCounter = 0;
            wrappers.forEach(w => {
                const tip = w.querySelector('.wm-tooltip-text');
                if (!tip) return;
                if (!tip.id) {
                    tip.id = 'wm-tooltip-text-' + (++idCounter);
                }
                tip.setAttribute('role', 'tooltip');
                // find first interactive child (button, a, input) to reference
                const ctrl = w.querySelector('button, a, input, [tabindex]');
                if (ctrl) {
                    ctrl.setAttribute('aria-describedby', tip.id);
                    // ensure focus styles reveal tooltip via :focus-within
                    ctrl.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Escape' || ev.key === 'Esc') {
                            try { ev.target.blur(); } catch(e){}
                        }
                    });
                }
                // allow tooltip to be dismissed by Escape when focus is inside wrapper
                w.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Escape' || ev.key === 'Esc') {
                        const active = document.activeElement;
                        try { active && active.blur && active.blur(); } catch(e){}
                    }
                });
            });
        }
        // Initialize now and whenever DOM changes (in case tooltips are injected)
        initTooltips();
        const moTip = new MutationObserver(() => initTooltips());
        moTip.observe(document.body, { childList: true, subtree: true });
    } catch (e) { console.warn('initTooltips error', e); }

    // --- Compact columns configuration ---
    function getPageKeyName() {
        const page = (location.pathname || '').split('/').pop() || '';
        if (page === 'calculadora.html') return 'compact_columns_calc';
        if (page === 'index.html') return 'compact_columns_index';
        if (page === 'proyectos.html') return 'compact_columns_projects';
        if (page === 'visita_campo.html') return 'compact_columns_visita';
        return 'compact_columns_generic';
    }

    // Compute a stable id for a table if it doesn't have one
    function generateTableId(table, idx) {
        if (table.id) return table.id;
        try {
            const headers = Array.from(table.querySelectorAll('th')).map(h => (h.innerText || h.textContent || '').trim()).join('|');
            const seed = headers + '::' + table.rows.length + '::' + idx;
            // simple djb2 hash
            let hash = 5381;
            for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) + hash) + seed.charCodeAt(i); hash = hash & 0xFFFFFFFF; }
            const hex = (hash >>> 0).toString(16);
            const id = 'wm-table-' + hex;
            table.id = id; // assign so future queries can use it
            return id;
        } catch (e) {
            const fallback = 'wm-table-' + idx;
            try { table.id = fallback; } catch(e){}
            return fallback;
        }
    }

    function getPerTableKeyName(tableId) {
        return getPageKeyName() + '_' + tableId;
    }

    function loadCompactPrefs(tableId) {
        try { return JSON.parse(localStorage.getItem(getPerTableKeyName(tableId)) || '[]'); } catch(e){ return []; }
    }

    function saveCompactPrefs(tableId, arr) {
        try { localStorage.setItem(getPerTableKeyName(tableId), JSON.stringify(arr || [])); updateCompactRules(); } catch(e){}
    }

    function updateCompactRules() {
        try {
            // iterate all tables on page, generate/ensure ids, and collect per-table prefs
            const tables = Array.from(document.querySelectorAll('table'));
            let css = '';
            tables.forEach((t, idx) => {
                const id = generateTableId(t, idx);
                const prefs = loadCompactPrefs(id);
                if (prefs && prefs.length) {
                    const selectors = prefs.map(i => `#${id}.compact-view th:nth-child(${i}), #${id}.compact-view td:nth-child(${i})`).join(', ');
                    css += selectors + ' { display: none !important; }\n';
                }
            });
            let style = document.getElementById('wm-compact-style');
            if (!style) { style = document.createElement('style'); style.id = 'wm-compact-style'; document.head.appendChild(style); }
            style.innerHTML = css;
        } catch(e) { console.warn('updateCompactRules error', e); }
    }

    function openCompactConfig() {
        try {
            const existing = document.getElementById('wm-compact-config-modal');
            if (existing) { existing.remove(); }
            const modal = document.createElement('div');
            modal.id = 'wm-compact-config-modal';
            modal.setAttribute('role','dialog');
            modal.style.position = 'fixed'; modal.style.left = '50%'; modal.style.top = '50%'; modal.style.transform = 'translate(-50%,-50%)';
            modal.style.zIndex = 100000; modal.style.background = '#fff'; modal.style.padding = '18px'; modal.style.borderRadius = '10px';
            modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)'; modal.style.minWidth = '320px';
            const title = document.createElement('div'); title.innerText = 'Configurar columnas - Vista Compacta'; title.style.fontWeight='700'; title.style.marginBottom='10px';
            modal.appendChild(title);
            const tables = Array.from(document.querySelectorAll('table'));
            if (!tables || !tables.length) {
                const p = document.createElement('div'); p.innerText = 'No se detectó ninguna tabla en esta página.'; modal.appendChild(p);
            } else {
                // build selector for tables
                const selWrap = document.createElement('div'); selWrap.style.marginBottom='10px';
                const selLabel = document.createElement('div'); selLabel.innerText = 'Seleccionar tabla:'; selLabel.style.fontSize='0.95rem'; selLabel.style.marginBottom='6px';
                selWrap.appendChild(selLabel);
                const sel = document.createElement('select'); sel.style.width='100%'; sel.style.padding='6px';
                tables.forEach((t, idx) => {
                    const id = generateTableId(t, idx);
                    const caption = (t.getAttribute('data-wm-table-name') || t.caption && t.caption.textContent) || (t.querySelector('th') ? t.querySelector('th').innerText.trim() : '') || ('Tabla ' + (idx+1));
                    const opt = document.createElement('option'); opt.value = id; opt.innerText = caption + ' (' + id + ')';
                    sel.appendChild(opt);
                });
                selWrap.appendChild(sel);
                modal.appendChild(selWrap);

                const list = document.createElement('div'); list.style.maxHeight='280px'; list.style.overflow='auto'; list.style.marginBottom='10px';
                modal.appendChild(list);

                function renderHeadersForTableId(tableId) {
                    list.innerHTML = '';
                    const table = document.getElementById(tableId);
                    if (!table) { list.innerText = 'Tabla no encontrada.'; return; }
                    const headers = Array.from(table.querySelectorAll('th')).map(h=> (h.innerText || h.textContent || '').trim());
                    const prefs = loadCompactPrefs(tableId);
                    headers.forEach((txt, idx) => {
                        const i = idx+1;
                        const row = document.createElement('label'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px'; row.style.padding='6px 0';
                        const cb = document.createElement('input'); cb.type='checkbox'; cb.value = String(i); if (prefs.includes(i)) cb.checked = true;
                        const span = document.createElement('span'); span.innerText = txt || ('Col ' + i); span.style.fontSize='0.95rem';
                        row.appendChild(cb); row.appendChild(span); list.appendChild(row);
                    });
                }

                // initial render for selected table
                renderHeadersForTableId(sel.value);
                sel.addEventListener('change', ()=> renderHeadersForTableId(sel.value));

                const btnSave = document.createElement('button'); btnSave.innerText='Guardar'; btnSave.style.marginRight='8px'; btnSave.className='compact-toggle-global';
                const btnCancel = document.createElement('button'); btnCancel.innerText='Cancelar';
                btnSave.onclick = function(){
                    const checks = Array.from(list.querySelectorAll('input[type=checkbox]')).filter(n=>n.checked).map(n=>Number(n.value));
                    const tableId = sel.value;
                    saveCompactPrefs(tableId, checks);
                    modal.remove();
                };
                btnCancel.onclick = function(){ modal.remove(); };
                modal.appendChild(btnSave); modal.appendChild(btnCancel);
            }
            document.body.appendChild(modal);
            // close on escape
            modal.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') modal.remove(); });
            // focus
            modal.tabIndex = -1; modal.focus();
        } catch(e) { console.warn('openCompactConfig error', e); }
    }

    // ensure rules applied on load
    updateCompactRules();
})();
