// app.js - tablas maestras y utilidades para "explosión" de materiales
(function(global){
    const concreteDosages = {
        2000: { label: '2000 (Bajo)', proportion: '1:3:5', sacksPerM3: 6.5, sandM3: 0.50, gravelM3: 0.85, waterLPerSack: 25 },
        2500: { label: '2500 (Vivienda)', proportion: '1:2.5:4', sacksPerM3: 7.5, sandM3: 0.48, gravelM3: 0.80, waterLPerSack: 23 },
        3000: { label: '3000 (Estructural)', proportion: '1:2:3', sacksPerM3: 9.0, sandM3: 0.45, gravelM3: 0.70, waterLPerSack: 20 },
        4000: { label: '4000 (Industrial)', proportion: '1:1.5:2.5', sacksPerM3: 10.5, sandM3: 0.42, gravelM3: 0.65, waterLPerSack: 18 }
    };

    const mortars = {
        levantadoMuros: { proportion: '1:4', sacksPerM3: 7.0, rendimiento_m2_por_m3: 18 }, // 1 m3 mezcla rinde ~18 m2 muro 14cm
        repelloBase: { proportion: '1:3', sacksPerM3: 8.0, espesor_m: 0.015 }, // espesor 1.5cm
        cernidoFino: { proportion: '1:1:2', sacksPerM3: 10.0, espesor_m: 0.01 }
    };

    const steelTable = {
        "1/4": { peso_kg_m: 0.25, metros_por_quintal: 180 },
        "3/8": { peso_kg_m: 0.56, metros_por_quintal: 81 },
        "1/2": { peso_kg_m: 0.99, metros_por_quintal: 45 },
        "5/8": { peso_kg_m: 1.55, metros_por_quintal: 29 }
    };

    const block = { unidades_por_m2: 12.5, desperdicio: 0.05 };
    const ladrillo = { unidades_por_m2: 55 };

    // Tipos de losa (parámetros por m2)
    const slabTypes = {
        losa_maciza: { concrete_m3_per_m2: 0.12, steel_kg_per_m2: 12, descripcion: 'Losa maciza (e=12cm)'} ,
        losa_prefabricada: { concrete_m3_per_m2: 0.045, steel_kg_per_m2: 5, descripcion: 'Losa prefabricada (paneles)'} ,
        losa_vigueta_bovedilla: { concrete_m3_per_m2: 0.06, steel_kg_per_m2: 8, descripcion: 'Vigueta y bovedilla (sistema mixto)'}
    };

    // Tipos de techo y parámetros constructivos por m2
    const roofTypes = {
        lamina_aluzinc: { chapa_m2: 1, estructura_kg_per_m2: 4, mano_obra_h_per_m2: 0.03, descripcion: 'Lámina Aluzinc'} ,
        estructura_metalica: { estructura_kg_per_m2: 10, chapa_m2: 0, mano_obra_h_per_m2: 0.06, descripcion: 'Estructura metálica'} ,
        pergola_madera: { madera_m3_per_m2: 0.02, estructura_kg_per_m2: 2, mano_obra_h_per_m2: 0.04, descripcion: 'Pérgola de madera'} ,
        pergola_metal: { estructura_kg_per_m2: 6, mano_obra_h_per_m2: 0.035, descripcion: 'Pérgola metálica'} ,
        teja_barro: { tejas_per_m2: 11, madera_ml_per_m2: 0.5, mano_obra_h_per_m2: 0.05, descripcion: 'Teja de barro'}
    };

    // Valores por defecto para estimaciones económicas
    const defaults = {
        avgCostoConcretoPorM3: 420, // Q por m3 (aprox.)
        avgCostoMuroPorM2: 155, // Q por m2 para levantado de muros (incluye mano de obra)
        avgCostoMorteroPorM3: 600, // Q por m3 de mortero (estimado)
        steelKgPerM3Concrete: 100 // kg acero por m3 concreto (estimación típica)
    };

    /**
     * Obtener explosión de materiales aproximada a partir de un subtotal directo (Q).
     * @param {number} subtotalDirecto - valor en moneda local (Q) del costo directo.
     * @param {object} options - opciones: { concreteStrength: 2500|3000|4000|2000, shares: {concrete:0.3, masonry:0.2, steel:0.1}, overrides... }
     * @returns {object} resumen de cantidades estimadas y supuestos.
     */
    function obtenerExplosionMateriales(subtotalDirecto, options={}){
        const opts = Object.assign({
            concreteStrength: 2500,
            shares: { concrete: 0.30, masonry: 0.20, steel: 0.10, mortar: 0.12 },
            avgCostoConcretoPorM3: defaults.avgCostoConcretoPorM3,
            avgCostoMuroPorM2: defaults.avgCostoMuroPorM2,
            avgCostoMorteroPorM3: defaults.avgCostoMorteroPorM3,
            steelKgPerM3Concrete: defaults.steelKgPerM3Concrete
        }, options || {});

        const strength = opts.concreteStrength in concreteDosages ? opts.concreteStrength : 2500;
        const dosage = concreteDosages[strength];

        // Estimar volumen de concreto a partir del presupuesto asignado a concreto
        const presupuestoConcreto = subtotalDirecto * (opts.shares.concrete || 0);
        const m3Concreto = presupuestoConcreto / opts.avgCostoConcretoPorM3;
        const sacosCemento = m3Concreto * dosage.sacksPerM3;
        const arena_m3 = m3Concreto * dosage.sandM3;
        const piedrin_m3 = m3Concreto * dosage.gravelM3;
        const agua_L = sacosCemento * dosage.waterLPerSack;

        // Estimar acero (en quintales) con supuesto kg por m3
        const kgAcero = m3Concreto * opts.steelKgPerM3Concrete;
        const quintalesAcero = kgAcero / 100; // 1 quintal = 100 kg (estimado)

        // Estimar muros y bloques desde el share de masonry
        const presupuestoMuro = subtotalDirecto * (opts.shares.masonry || 0);
        const areaMuro_m2 = presupuestoMuro / opts.avgCostoMuroPorM2;
        const bloquesNecesarios = Math.ceil(areaMuro_m2 * block.unidades_por_m2 * (1 + block.desperdicio));
        const ladrillosNecesarios = Math.ceil(areaMuro_m2 * ladrillo.unidades_por_m2);

        // Mortero necesario para levantado (m3) estimado desde rendimiento
        const mortero_levantado_m3 = areaMuro_m2 / mortars.levantadoMuros.rendimiento_m2_por_m3;
        const sacosMorteroLevantado = Math.ceil(mortero_levantado_m3 * mortars.levantadoMuros.sacksPerM3);

        // Mortero para repello (suponiendo área igual a areaMuro) y espesor
        const volumenRepello_m3 = areaMuro_m2 * mortars.repelloBase.espesor_m;
        const sacosRepello = Math.ceil((volumenRepello_m3 * mortars.repelloBase.sacksPerM3) || 0);

        const resultado = {
            subtotalDirecto: subtotalDirecto,
            supuestos: {
                concreteStrength: strength,
                dosage: dosage,
                shares: opts.shares,
                avgCostoConcretoPorM3: opts.avgCostoConcretoPorM3,
                avgCostoMuroPorM2: opts.avgCostoMuroPorM2,
                steelKgPerM3Concrete: opts.steelKgPerM3Concrete
            },
            concreto: {
                presupuesto: Number(presupuestoConcreto.toFixed(2)),
                volumen_m3: Number(m3Concreto.toFixed(3)),
                sacos_cemento: Math.ceil(sacosCemento),
                arena_m3: Number(arena_m3.toFixed(3)),
                piedrin_m3: Number(piedrin_m3.toFixed(3)),
                agua_litros: Math.ceil(agua_L)
            },
            acero: {
                peso_kg: Math.round(kgAcero),
                quintales: Number(quintalesAcero.toFixed(2))
            },
            muros: {
                presupuesto: Number(presupuestoMuro.toFixed(2)),
                area_m2: Number(areaMuro_m2.toFixed(2)),
                bloques_unidades: bloquesNecesarios,
                ladrillos_unidades: ladrillosNecesarios
            },
            morteros: {
                levantado_m3: Number(mortero_levantado_m3.toFixed(3)),
                sacos_levantado: sacosMorteroLevantado,
                repello_m3: Number(volumenRepello_m3.toFixed(3)),
                sacos_repello: sacosRepello
            }
        };

        return resultado;
    }

    // Exponer en global
    global.obtenerExplosionMateriales = obtenerExplosionMateriales;
    global.__WM_TABLES__ = { concreteDosages, mortars, steelTable, block, ladrillo };

    /**
     * Calcular explosión de materiales por m2 según tipología (factores locales promedio)
     * Devuelve sacos de cemento, hierro (qq), arena m3, piedrín m3, blocks unidades.
     */
    function calcularExplosionMateriales(m2, tipo) {
        // Coeficientes técnicos ajustados para SOFTCON-WM (Guatemala / CA)
        const factores = {
            if (resumenEl) {
                let extraHtml = '';
                try {
                    if (mat && mat.slab && mat.slab.concreto_m3) {
                        extraHtml += `<div class="mat-item"><label>Losa (${mat.slab.descripcion})</label><span>${mat.slab.concreto_m3} m³</span><small>Acero: ${mat.slab.hierro_kg} kg</small></div>`;
                    }
                    if (mat && mat.techo) {
                        const t = mat.techo;
                        let tlines = '';
                        if (t.chapa_m2) tlines += `<div><small>Chapa: ${t.chapa_m2} m²</small></div>`;
                        if (t.tejas) tlines += `<div><small>Tejas: ${t.tejas} un.</small></div>`;
                        if (t.madera_m3) tlines += `<div><small>Madera: ${t.madera_m3} m³</small></div>`;
                        if (t.madera_ml) tlines += `<div><small>Madera (ml): ${t.madera_ml} ml</small></div>`;
                        if (t.estructura_kg) tlines += `<div><small>Estructura: ${t.estructura_kg} kg</small></div>`;
                        tlines += `<div><small>Mano obra: ${t.mano_obra_h} hh</small></div>`;
                        extraHtml += `<div class="mat-item"><label>Techo (${t.descripcion || ''})</label><span>Detalles</span>${tlines}</div>`;
                    }
                } catch (e) { console.warn('render extra materials error', e); }

                resumenEl.innerHTML = `
                    <div class="mat-item">
                        <label>Cemento</label>
                        <span>${mat.cemento} Sacos</span>
                        <small>UGC 4000 PSI</small>
                    </div>
                    <div class="mat-item">
                        <label>Hierro</label>
                        <span>${mat.hierro} QQ</span>
                        <small>Grado 40/60</small>
                    </div>
                    <div class="mat-item">
                        <label>Agregados (Arena)</label>
                        <span>${mat.arenaCamiones} Viajes</span>
                        <small>Camión de 6 m³ c/u · ${mat.arena_m3} m³</small>
                    </div>
                    <div class="mat-item">
                        <label>Agregados (Piedrín)</label>
                        <span>${mat.piedrinCamiones} Viajes</span>
                        <small>Camión de 6 m³ c/u · ${mat.piedrin_m3} m³</small>
                    </div>
                    <div class="mat-item">
                        <label>Mampostería</label>
                        <span>${mat.blockMillares} Mill.</span>
                        <small>${mat.unidadesBlock} unidades (14x19x39)</small>
                    </div>
                    ${extraHtml}
                `;
            }
        // Camiones estándar volteo ~6 m3
        const capacidadCamion = 6;
        const arenaCamiones = Math.ceil(arenaTotalM3 / capacidadCamion);
        const piedrinCamiones = Math.ceil(piedrinTotalM3 / capacidadCamion);

        // Blocks en millares
        const blockMillares = Number(((m2 * f.block) / 1000).toFixed(2));

        // Añadir cálculo por tipo de losa
        let slabExtra = {};
        try {
            const tipoLosa = (document.getElementById('tipoLosa') && document.getElementById('tipoLosa').value) || 'losa_vigueta_bovedilla';
            const s = slabTypes[tipoLosa] || slabTypes.losa_vigueta_bovedilla;
            const concretoLosa_m3 = Number((m2 * (s.concrete_m3_per_m2 || 0)).toFixed(3));
            const hierroLosa_kg = Math.round(m2 * (s.steel_kg_per_m2 || 0));
            slabExtra = { tipo: tipoLosa, descripcion: s.descripcion, concreto_m3: concretoLosa_m3, hierro_kg: hierroLosa_kg };
        } catch (e) { slabExtra = {}; }

        // Añadir cálculo por tipo de techo
        let roofExtra = {};
        try {
            const tipoTecho = (document.getElementById('tipoTecho') && document.getElementById('tipoTecho').value) || 'lamina_aluzinc';
            const r = roofTypes[tipoTecho] || roofTypes.lamina_aluzinc;
            const roof = {};
            if (r.chapa_m2) roof.chapa_m2 = Number((m2 * r.chapa_m2).toFixed(2));
            if (r.tejas_per_m2) roof.tejas = Math.ceil(m2 * (r.tejas_per_m2 || 0));
            if (r.madera_m3_per_m2) roof.madera_m3 = Number((m2 * (r.madera_m3_per_m2 || 0)).toFixed(3));
            if (r.estructura_kg_per_m2) roof.estructura_kg = Math.round(m2 * (r.estructura_kg_per_m2 || 0));
            if (r.madera_ml_per_m2) roof.madera_ml = Number((m2 * (r.madera_ml_per_m2 || 0)).toFixed(2));
            roof.mano_obra_h = Number((m2 * (r.mano_obra_h_per_m2 || 0)).toFixed(2));
            roof.descripcion = r.descripcion;
            roofExtra = roof;
        } catch (e) { roofExtra = {}; }

        return {
            cemento: cementoTotal,
            hierro: hierroTotalQQ,
            arena_m3: arenaTotalM3,
            piedrin_m3: piedrinTotalM3,
            arenaCamiones: arenaCamiones,
            piedrinCamiones: piedrinCamiones,
            blockMillares: blockMillares,
            unidadesBlock: Math.ceil(m2 * f.block),
            slab: slabExtra,
            techo: roofExtra
        };
    }

    /**
     * Actualizar totales financieros y mostrar explosión de materiales.
     * Espera que exista en el DOM: #totalCostoDirecto, #costoIndirecto, #costoImprevisto,
     * #costoUtilidad, #precioVentaTotal, y #resumenMateriales.
     */
    function actualizarTotales(directo) {
        const m2 = parseFloat(document.getElementById('cantidadGlobal').value) || 0;
        const tipo = document.getElementById('tipoObra').value;
        const indirecto = directo * 0.15;
        const imprevistos = directo * 0.05;
        const utilidad = (directo + indirecto + imprevistos) * 0.12;
        const totalVenta = directo + indirecto + imprevistos + utilidad;

        // Render financieros
        const fmt = v => `Q ${Number(v).toFixed(2)}`;
        const totalCostoEl = document.getElementById('totalCostoDirecto');
        if (totalCostoEl) totalCostoEl.innerText = fmt(directo);
        const indEl = document.getElementById('costoIndirecto'); if (indEl) indEl.innerText = fmt(indirecto);
        const impEl = document.getElementById('costoImprevisto'); if (impEl) impEl.innerText = fmt(imprevistos);
        const utiEl = document.getElementById('costoUtilidad'); if (utiEl) utiEl.innerText = fmt(utilidad);
        const pvEl = document.getElementById('precioVentaTotal'); if (pvEl) pvEl.innerText = fmt(totalVenta);

        // Explosión de materiales por m2 (formato logístico: camiones/millares)
        const mat = calcularExplosionMateriales(m2, tipo);
        const resumenEl = document.getElementById('resumenMateriales');
        if (resumenEl) {
            resumenEl.innerHTML = `\n                <div class="mat-item">\n                    <label>Cemento</label>\n                    <span>${mat.cemento} Sacos</span>\n                    <small>UGC 4000 PSI</small>\n                </div>\n                <div class="mat-item">\n                    <label>Hierro</label>\n                    <span>${mat.hierro} QQ</span>\n                    <small>Grado 40/60</small>\n                </div>\n                <div class="mat-item">\n                    <label>Agregados (Arena)</label>\n                    <span>${mat.arenaCamiones} Viajes</span>\n                    <small>Camión de 6 m³ c/u · ${mat.arena_m3} m³</small>\n                </div>\n                <div class="mat-item">\n                    <label>Agregados (Piedrín)</label>\n                    <span>${mat.piedrinCamiones} Viajes</span>\n                    <small>Camión de 6 m³ c/u · ${mat.piedrin_m3} m³</small>\n                </div>\n                <div class="mat-item">\n                    <label>Mampostería</label>\n                    <span>${mat.blockMillares} Mill.</span>\n                    <small>${mat.unidadesBlock} unidades (14x19x39)</small>\n                </div>\n            `;
        }
    }

    global.calcularExplosionMateriales = calcularExplosionMateriales;
    global.actualizarTotales = actualizarTotales;

    // Exportar resumen de materiales a CSV
    function exportarResumenMaterialesCSV(projectName) {
        try {
            const m2 = parseFloat(document.getElementById('cantidadGlobal').value) || 0;
            const tipo = document.getElementById('tipoObra').value || 'residencial';
            const mat = calcularExplosionMateriales(m2, tipo);
            const rows = [
                ['Material','Cantidad','Unidad'],
                ['Sacos Cemento', mat.cemento, 'sacos'],
                ['Acero (QQ)', mat.hierro, 'qq'],
                ['Arena (m³)', mat.arena_m3, 'm³'],
                ['Arena (viajes 6m³)', mat.arenaCamiones, 'viajes'],
                ['Piedrín (m³)', mat.piedrin_m3, 'm³'],
                ['Piedrín (viajes 6m³)', mat.piedrinCamiones, 'viajes'],
                ['Blocks (unidades)', mat.unidadesBlock, 'un'],
                ['Blocks (millares)', mat.blockMillares, 'mill.']
            ];

                // incluir losa/techo si existen
                if (mat.slab && mat.slab.concreto_m3) {
                    rows.push(['Losa - concreto (m³)', mat.slab.concreto_m3, 'm³']);
                    rows.push(['Losa - acero (kg)', mat.slab.hierro_kg, 'kg']);
                }
                if (mat.techo) {
                    if (mat.techo.chapa_m2) rows.push(['Techo - chapa (m²)', mat.techo.chapa_m2, 'm²']);
                    if (mat.techo.tejas) rows.push(['Techo - tejas (unid)', mat.techo.tejas, 'un']);
                    if (mat.techo.madera_m3) rows.push(['Techo - madera (m³)', mat.techo.madera_m3, 'm³']);
                    if (mat.techo.estructura_kg) rows.push(['Techo - estructura (kg)', mat.techo.estructura_kg, 'kg']);
                    if (typeof mat.techo.mano_obra_h !== 'undefined') rows.push(['Techo - mano obra (hh)', mat.techo.mano_obra_h, 'hh']);
                }

            let csv = rows.map(r => r.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const name = (projectName || document.getElementById('nombreProyecto').value || 'resumen_materiales').toString().trim().replace(/\s+/g,'_');
            a.download = `${name}_materiales.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) { console.warn('exportarResumenMaterialesCSV error:', e); }
    }

    // Exportar resumen de materiales a PDF (usa jsPDF + autotable disponible en index.html)
    function exportarResumenMaterialesPDF(projectName) {
        try {
            const m2 = parseFloat(document.getElementById('cantidadGlobal').value) || 0;
            const tipo = document.getElementById('tipoObra').value || 'residencial';
            const mat = calcularExplosionMateriales(m2, tipo);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const title = 'Resumen de Materiales - ' + (projectName || document.getElementById('nombreProyecto').value || 'Proyecto');
            doc.setFontSize(14);
            doc.text(title, 14, 18);
            const body = [
                ['Sacos Cemento', mat.cemento, 'sacos'],
                ['Acero (QQ)', mat.hierro, 'qq'],
                ['Arena (m³)', mat.arena_m3, 'm³'],
                ['Arena (viajes 6m³)', mat.arenaCamiones, 'viajes'],
                ['Piedrín (m³)', mat.piedrin_m3, 'm³'],
                ['Piedrín (viajes 6m³)', mat.piedrinCamiones, 'viajes'],
                ['Blocks (unidades)', mat.unidadesBlock, 'un'],
                ['Blocks (millares)', mat.blockMillares, 'mill.']
            ];
            if (mat.slab && mat.slab.concreto_m3) {
                body.push(['Losa - concreto (m³)', mat.slab.concreto_m3, 'm³']);
                body.push(['Losa - acero (kg)', mat.slab.hierro_kg, 'kg']);
            }
            if (mat.techo) {
                if (mat.techo.chapa_m2) body.push(['Techo - chapa (m²)', mat.techo.chapa_m2, 'm²']);
                if (mat.techo.tejas) body.push(['Techo - tejas (unid)', mat.techo.tejas, 'un']);
                if (mat.techo.madera_m3) body.push(['Techo - madera (m³)', mat.techo.madera_m3, 'm³']);
                if (mat.techo.estructura_kg) body.push(['Techo - estructura (kg)', mat.techo.estructura_kg, 'kg']);
                body.push(['Techo - mano obra (hh)', mat.techo.mano_obra_h, 'hh']);
            }
            doc.autoTable({ startY: 26, head: [['Material','Cantidad','Unidad']], body: body });
            const name = (projectName || document.getElementById('nombreProyecto').value || 'resumen_materiales').toString().trim().replace(/\s+/g,'_');
            doc.save(`${name}_materiales.pdf`);
        } catch (e) { console.warn('exportarResumenMaterialesPDF error:', e); }
    }

    global.exportarResumenMaterialesCSV = exportarResumenMaterialesCSV;
    global.exportarResumenMaterialesPDF = exportarResumenMaterialesPDF;

    // Aliases para compatibilidad con botones existentes en index.html
    global.exportarMaterialesCSV = function(name){ return exportarResumenMaterialesCSV(name); };
    global.exportarMaterialesPDF = function(name){ return exportarResumenMaterialesPDF(name); };

    // Enviar pedido por WhatsApp (formatea mensaje y abre wa.me)
    function enviarWhatsApp() {
        try {
            const nombre = document.getElementById('nombreProyecto').value || 'Nuevo Proyecto';
            const area = document.getElementById('cantidadGlobal').value || 0;
            const total = document.getElementById('precioVentaTotal') ? document.getElementById('precioVentaTotal').innerText : '';
            const tipo = document.getElementById('tipoObra').value || 'residencial';
            const mat = calcularExplosionMateriales(parseFloat(area) || 0, tipo);

    // Aplica PRECIOS_MAESTROS sobre `baseDatos` (heurístico) y persiste resultado.
    function aplicarPreciosMaestros() {
        if (!window.PRECIOS_MAESTROS || !window.baseDatos) {
            if (typeof window !== 'undefined' && window.wmToast) window.wmToast('No se encontró `PRECIOS_MAESTROS` o `baseDatos` en el contexto.'); else alert('No se encontró `PRECIOS_MAESTROS` o `baseDatos` en el contexto.');
            return;
        }
        if (!confirm('¿Aplicar precios maestros a los renglones base? Esto sobreescribirá los precios unitarios visibles.')) return;

        const pm = window.PRECIOS_MAESTROS;
        const normalizedKey = s => (s||'').toString().toLowerCase();
        let cambios = 0;

        Object.keys(window.baseDatos).forEach(tipo => {
            const arr = window.baseDatos[tipo];
            if (!Array.isArray(arr)) return;
            arr.forEach(r => {
                const nombre = normalizedKey(r.n);
                const materiales = normalizedKey(r.m);
                let nuevo = 0;

                // Heurísticas básicas: buscar palabras clave en nombre o materiales
                if (nombre.includes('block') || materiales.includes('block')) {
                    if (typeof pm.block === 'number') nuevo = pm.block * (r.c || 1);
                } else if (nombre.includes('cement') || nombre.includes('cemento') || materiales.includes('cement') || materiales.includes('cemento')) {
                    if (typeof pm.cemento === 'number') nuevo = pm.cemento * (r.c || 1);
                } else if (nombre.includes('hierro') || nombre.includes('acero') || materiales.includes('hierro') || materiales.includes('acero')) {
                    if (typeof pm.hierro === 'number') nuevo = pm.hierro * (r.c || 1);
                } else if (nombre.includes('arena') || materiales.includes('arena')) {
                    if (typeof pm.arena === 'number') nuevo = pm.arena * (r.c || 1);
                } else if (nombre.includes('piedrin') || nombre.includes('piedra') || materiales.includes('piedrin') || materiales.includes('piedra')) {
                    if (typeof pm.piedrin === 'number') nuevo = pm.piedrin * (r.c || 1);
                }

                if (nuevo && Number.isFinite(nuevo)) {
                    // conservar precio antiguo para posible reversión
                    if (!r._p_orig) r._p_orig = r.p;
                    r.p = Math.round((nuevo + Number.EPSILON) * 100) / 100;
                    cambios++;
                }
            });
        });

        // Persistimos la versión aplicada para referencia
        try {
            const payload = { ts: Date.now(), cambios };
            localStorage.setItem('wm_base_precios_aplicados', JSON.stringify(payload));
        } catch (e) {
            console.warn('No se pudo persistir wm_base_precios_aplicados', e);
        }

        // Forzar recálculo y re-render si las funciones existen
        if (typeof window.cargarRenglones === 'function') window.cargarRenglones();
        if (typeof window.actualizarGranTotal === 'function') window.actualizarGranTotal();

        if (typeof window !== 'undefined' && window.wmToast) window.wmToast('Aplicación de precios maestros completada. Renglones actualizados: ' + cambios); else alert('Aplicación de precios maestros completada. Renglones actualizados: ' + cambios);
    }

    window.aplicarPreciosMaestros = aplicarPreciosMaestros;

            let mensaje = `*SOFTCON-MYS-CONSTRU-WM*\n`;
            mensaje += `_CONSTRUYENDO TU FUTURO_\n\n`;
            mensaje += `*PROYECTO:* ${nombre.toUpperCase()}\n`;
            mensaje += `*ÁREA:* ${area} m²\n`;
            mensaje += `*PRECIO TOTAL ESTIMADO:* ${total}\n\n`;
            mensaje += `*PEDIDO DE MATERIALES ESTIMADO:*\n`;
            mensaje += `• Cemento: ${mat.cemento} sacos\n`;
            mensaje += `• Hierro: ${mat.hierro} QQ\n`;
            mensaje += `• Arena: ${mat.arenaCamiones} viajes (6m³) — ${mat.arena_m3} m³\n`;
            mensaje += `• Piedrín: ${mat.piedrinCamiones} viajes (6m³) — ${mat.piedrin_m3} m³\n`;
            mensaje += `• Block: ${mat.blockMillares} millares — ${mat.unidadesBlock} unidades\n\n`;
            mensaje += `_Generado por WM Pro Manager_`;

            // Si el usuario proporcionó número, úsalo (limpiar caracteres no numéricos)
            let phoneInput = (document.getElementById('waPhone') && document.getElementById('waPhone').value) || '';
            phoneInput = phoneInput.toString().replace(/\D+/g, ''); // solo dígitos
            let url = '';
            if (phoneInput && phoneInput.length >= 8) {
                // guardar número para próximas sesiones
                try { localStorage.setItem('WM_PROVIDER_PHONE', phoneInput); } catch(e) {}
                // usar wa.me/<phone>?text=...
                url = `https://wa.me/${phoneInput}?text=${encodeURIComponent(mensaje)}`;
            } else {
                // abrir sin número (seleccionar contacto en app/wa web)
                url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
            }
            window.open(url, '_blank');
        } catch (e) {
            console.warn('enviarWhatsApp error:', e);
        }
    }

    global.enviarWhatsApp = enviarWhatsApp;

    // Precargar número de proveedor guardado en localStorage (si existe)
    try {
        const stored = localStorage.getItem('WM_PROVIDER_PHONE');
        if (stored && document.getElementById('waPhone')) {
            document.getElementById('waPhone').value = stored;
        }
    } catch (e) {
        console.warn('No se pudo precargar WM_PROVIDER_PHONE:', e);
    }

    // Cargar configuración de precios guardada (si existe) y sincronizar inputs
    function cargarPreciosConfig() {
        try {
            const raw = localStorage.getItem('wm_precios_config');
            if (raw) {
                const cfg = JSON.parse(raw);
                // Merge into global PRECIOS_MAESTROS if disponible
                if (window.PRECIOS_MAESTROS && typeof window.PRECIOS_MAESTROS === 'object') {
                    window.PRECIOS_MAESTROS = Object.assign({}, window.PRECIOS_MAESTROS, cfg);
                } else {
                    window.PRECIOS_MAESTROS = cfg;
                }
            }
        } catch (e) {
            console.warn('No se pudo cargar wm_precios_config:', e);
        }

        // Escribir valores en los inputs del panel (si existen)
        try {
            if (document.getElementById('p_cemento') && window.PRECIOS_MAESTROS) {
                document.getElementById('p_cemento').value = Number(window.PRECIOS_MAESTROS.cemento || 0);
            }
            if (document.getElementById('p_hierro') && window.PRECIOS_MAESTROS) {
                document.getElementById('p_hierro').value = Number(window.PRECIOS_MAESTROS.hierro || 0);
            }
            if (document.getElementById('p_block') && window.PRECIOS_MAESTROS) {
                document.getElementById('p_block').value = Number(window.PRECIOS_MAESTROS.block || 0);
            }
            if (document.getElementById('p_arena') && window.PRECIOS_MAESTROS) {
                document.getElementById('p_arena').value = Number(window.PRECIOS_MAESTROS.arena || 0);
            }
        } catch (e) { /* ignore */ }
    }

    // Actualizar PRECIOS_MAESTROS desde inputs y persistir
    function actualizarPreciosBase() {
        try {
            const pC = parseFloat(document.getElementById('p_cemento')?.value || 0) || 0;
            const pH = parseFloat(document.getElementById('p_hierro')?.value || 0) || 0;
            const pB = parseFloat(document.getElementById('p_block')?.value || 0) || 0;
            const pA = parseFloat(document.getElementById('p_arena')?.value || 0) || 0;

            window.PRECIOS_MAESTROS = Object.assign({}, window.PRECIOS_MAESTROS || {}, {
                cemento: pC,
                hierro: pH,
                block: pB,
                arena: pA
            });

            try { localStorage.setItem('wm_precios_config', JSON.stringify(window.PRECIOS_MAESTROS)); } catch(e) {}

            // Recalcular todo para que los cambios afecten al presupuesto
            if (window.calcularTodo) {
                try { window.calcularTodo(); } catch(e) { console.warn('calcularTodo error tras actualizar precios:', e); }
            }
        } catch (e) {
            console.warn('actualizarPreciosBase error:', e);
        }
    }

    // Ejecutar carga inicial de precios (y sincronizar inputs)
    try { cargarPreciosConfig(); } catch(e) {}
    // Exponer funciones para que el HTML pueda invocarlas
    global.actualizarPreciosBase = actualizarPreciosBase;
    global.cargarPreciosConfig = cargarPreciosConfig;

    // Resetear cantidades a estimado (usa cargarRenglones que recalcula desde coeficientes)
    function resetearCantidades() {
        try {
            if (confirm("¿Deseas restaurar todas las cantidades a los valores estimados por m²? Se perderán los cambios manuales.")) {
                if (typeof window.cargarRenglones === 'function') {
                    window.cargarRenglones();
                    // foco breve para confirmar acción
                    console.info('Cantidades restauradas a estimados por m²');
                } else {
                    console.warn('cargarRenglones() no está disponible en el scope global');
                }
            }
        } catch (e) { console.warn('resetearCantidades error:', e); }
    }
    global.resetearCantidades = resetearCantidades;

})(window);
