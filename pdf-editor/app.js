/* ============================================
   FormFlow — PDF Form Filler
   Pure client-side PDF → editable form tool
   ============================================ */

(function () {
    'use strict';

    // ---- Configuration ----
    const SCALE = 1.5;
    const TEXT_FIELD_W = 200;
    const TEXT_FIELD_H = 30;
    const SIG_FIELD_W = 220;
    const SIG_FIELD_H = 70;
    const HINT_DURATION = 4000;

    // ---- State ----
    const state = {
        pdfDoc: null,
        pdfBytes: null,
        fileName: '',
        totalPages: 0,
        scale: SCALE,
        tool: 'select',
        fields: [],
        fieldIdCounter: 0,
        selectedField: null,
        dragging: null,
        dragOffset: { x: 0, y: 0 },
        resizing: null,
        resizeStart: { x: 0, y: 0, w: 0, h: 0 },
        pageHeights: [],
        pendingSigPage: 0,
        pendingSigX: 0,
        pendingSigY: 0,
    };

    // ---- DOM ----
    const $ = (id) => document.getElementById(id);
    const dom = {
        uploadView: $('v-upload'),
        editorView: $('v-editor'),
        dropZone: $('drop-zone'),
        fileInput: $('file-input'),
        fileName: $('file-name'),
        container: $('pdf-container'),
        pageInfo: $('page-info'),
        btnPrev: $('btn-prev'),
        btnNext: $('btn-next'),
        btnBack: $('btn-back'),
        btnExport: $('btn-export'),
        hint: $('hint'),
        modalExport: $('modal-export'),
        clientName: $('client-name'),
        filePreview: $('file-preview'),
        btnCancelExport: $('btn-cancel-export'),
        btnConfirmExport: $('btn-confirm-export'),
        modalSig: $('modal-sig'),
        sigCanvas: $('sig-canvas'),
        btnClearSig: $('btn-clear-sig'),
        btnCancelSig: $('btn-cancel-sig'),
        btnSaveSig: $('btn-save-sig'),
    };

    // ============================================
    // Upload
    // ============================================

    function initUpload() {
        const dz = dom.dropZone;

        dz.addEventListener('dragover', (e) => {
            e.preventDefault();
            dz.classList.add('drag-over');
        });

        dz.addEventListener('dragleave', () => {
            dz.classList.remove('drag-over');
        });

        dz.addEventListener('drop', (e) => {
            e.preventDefault();
            dz.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        });

        dz.addEventListener('click', () => dom.fileInput.click());

        dom.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFile(file);
        });
    }

    function handleFile(file) {
        if (file.type !== 'application/pdf') {
            showHint('Please upload a PDF file');
            return;
        }

        state.fileName = file.name;
        dom.fileName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            state.pdfBytes = new Uint8Array(e.target.result);
            loadPDF(state.pdfBytes);
        };
        reader.readAsArrayBuffer(file);
    }

    // ============================================
    // PDF Rendering
    // ============================================

    async function loadPDF(bytes) {
        showView('editor');
        dom.container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div>Rendering document&hellip;</div>';

        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        try {
            state.pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
            state.totalPages = state.pdfDoc.numPages;
            state.pageHeights = [];
            await renderAllPages();
            updatePageNav();
            showHint('Select a tool and click on the document to add fields');
        } catch (err) {
            dom.container.innerHTML =
                '<div class="loading-wrap" style="color:var(--red)">Failed to load PDF. Please try another file.</div>';
            console.error(err);
        }
    }

    async function renderAllPages() {
        dom.container.innerHTML = '';

        for (let i = 1; i <= state.totalPages; i++) {
            const page = await state.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: state.scale });

            state.pageHeights[i] = viewport.height / state.scale;

            const wrapper = document.createElement('div');
            wrapper.className = 'page-wrapper';
            wrapper.dataset.page = i;
            wrapper.style.width = viewport.width + 'px';
            wrapper.style.height = viewport.height + 'px';

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const overlay = document.createElement('div');
            overlay.className = 'page-overlay tool-' + state.tool;
            overlay.dataset.page = i;
            overlay.addEventListener('mousedown', (e) => onOverlayMouseDown(e, i));
            overlay.addEventListener('touchstart', (e) => onOverlayTouch(e, i), { passive: false });

            const pageLabel = document.createElement('div');
            pageLabel.className = 'page-number';
            pageLabel.textContent = 'Page ' + i + ' of ' + state.totalPages;

            wrapper.appendChild(canvas);
            wrapper.appendChild(overlay);
            wrapper.appendChild(pageLabel);
            dom.container.appendChild(wrapper);

            // Detect existing form fields
            await detectAnnotations(page, i, viewport);
        }
    }

    async function detectAnnotations(page, pageNum, viewport) {
        try {
            const annotations = await page.getAnnotations();
            for (const annot of annotations) {
                if (annot.subtype !== 'Widget') continue;

                const [x1, y1, x2, y2] = annot.rect;
                const pageH = viewport.height / state.scale;

                const sx = x1 * state.scale;
                const sy = (pageH - y2) * state.scale;
                const sw = (x2 - x1) * state.scale;
                const sh = (y2 - y1) * state.scale;

                if (sw < 5 || sh < 5) continue;

                if (annot.fieldType === 'Tx') {
                    createField('text', pageNum, sx, sy, sw, Math.max(sh, 26), annot.fieldValue || '');
                } else if (annot.fieldType === 'Btn' && annot.checkBox) {
                    createField('checkbox', pageNum, sx, sy, 24, 24, annot.fieldValue === 'Yes');
                }
            }
        } catch (_) {
            // Annotations not available, that's fine
        }
    }

    // ============================================
    // Page Navigation
    // ============================================

    function updatePageNav() {
        dom.pageInfo.textContent = '1 / ' + state.totalPages;
        dom.btnPrev.disabled = true;
        dom.btnNext.disabled = state.totalPages <= 1;
    }

    function getCurrentVisiblePage() {
        const container = dom.container;
        const scrollTop = container.scrollTop;
        const wrappers = container.querySelectorAll('.page-wrapper');
        let best = 1;
        let bestDist = Infinity;

        wrappers.forEach((w) => {
            const top = w.offsetTop - container.offsetTop;
            const mid = top + w.offsetHeight / 2;
            const dist = Math.abs(scrollTop + container.clientHeight / 2 - mid);
            if (dist < bestDist) {
                bestDist = dist;
                best = parseInt(w.dataset.page);
            }
        });

        return best;
    }

    function scrollToPage(num) {
        const wrapper = dom.container.querySelector(`.page-wrapper[data-page="${num}"]`);
        if (wrapper) {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function initPageNav() {
        dom.btnPrev.addEventListener('click', () => {
            const cur = getCurrentVisiblePage();
            if (cur > 1) scrollToPage(cur - 1);
        });

        dom.btnNext.addEventListener('click', () => {
            const cur = getCurrentVisiblePage();
            if (cur < state.totalPages) scrollToPage(cur + 1);
        });

        dom.container.addEventListener('scroll', () => {
            const cur = getCurrentVisiblePage();
            dom.pageInfo.textContent = cur + ' / ' + state.totalPages;
            dom.btnPrev.disabled = cur <= 1;
            dom.btnNext.disabled = cur >= state.totalPages;
        });
    }

    // ============================================
    // Tool Management
    // ============================================

    function setTool(tool) {
        state.tool = tool;

        document.querySelectorAll('.tool-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.tool === tool);
        });

        document.querySelectorAll('.page-overlay').forEach((o) => {
            o.className = 'page-overlay tool-' + tool;
        });

        if (tool !== 'select') {
            deselectField();
        }
    }

    function initTools() {
        document.querySelectorAll('.tool-btn').forEach((btn) => {
            btn.addEventListener('click', () => setTool(btn.dataset.tool));
        });
    }

    // ============================================
    // Field Creation
    // ============================================

    function createField(type, pageNum, x, y, w, h, value) {
        const id = 'field_' + ++state.fieldIdCounter;

        const overlay = dom.container.querySelector(`.page-overlay[data-page="${pageNum}"]`);
        if (!overlay) return null;

        const el = document.createElement('div');
        el.className = 'field ' + type + '-field';
        el.dataset.id = id;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = w + 'px';
        el.style.height = h + 'px';

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'field-delete';
        delBtn.textContent = '\u00D7';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteField(id);
        });
        el.appendChild(delBtn);

        // Resize handle (not for checkboxes)
        if (type !== 'checkbox') {
            const resizer = document.createElement('div');
            resizer.className = 'resize-handle';
            resizer.addEventListener('mousedown', (e) => startResize(e, id));
            resizer.addEventListener('touchstart', (e) => startResizeTouch(e, id), { passive: false });
            el.appendChild(resizer);
        }

        // Inner content by type
        if (type === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Type here...';
            input.value = value || '';
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            input.addEventListener('touchstart', (e) => e.stopPropagation());
            input.addEventListener('input', () => {
                const f = state.fields.find((f) => f.id === id);
                if (f) f.value = input.value;
            });
            input.addEventListener('focus', () => selectField(id));
            el.appendChild(input);
        } else if (type === 'checkbox') {
            const box = document.createElement('div');
            box.className = 'cb-box' + (value ? ' checked' : '');
            box.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            box.addEventListener('click', (e) => {
                e.stopPropagation();
                const f = state.fields.find((f) => f.id === id);
                if (f) {
                    f.value = !f.value;
                    box.classList.toggle('checked', f.value);
                }
            });
            el.appendChild(box);
        } else if (type === 'signature') {
            if (value) {
                const img = document.createElement('img');
                img.src = value;
                el.appendChild(img);
            } else {
                const ph = document.createElement('div');
                ph.className = 'sig-placeholder';
                ph.textContent = 'Click to sign';
                el.appendChild(ph);
            }
        }

        // Drag support
        el.addEventListener('mousedown', (e) => onFieldMouseDown(e, id));
        el.addEventListener('touchstart', (e) => onFieldTouch(e, id), { passive: false });

        overlay.appendChild(el);

        const field = { id, type, page: pageNum, x, y, w, h, value: value || (type === 'checkbox' ? false : ''), el };
        state.fields.push(field);

        return field;
    }

    // ============================================
    // Field Selection & Deletion
    // ============================================

    function selectField(id) {
        deselectField();
        const f = state.fields.find((f) => f.id === id);
        if (!f) return;
        f.el.classList.add('selected');
        state.selectedField = f;
    }

    function deselectField() {
        if (state.selectedField) {
            state.selectedField.el.classList.remove('selected');
            state.selectedField = null;
        }
    }

    function deleteField(id) {
        const idx = state.fields.findIndex((f) => f.id === id);
        if (idx === -1) return;
        const f = state.fields[idx];
        f.el.remove();
        state.fields.splice(idx, 1);
        if (state.selectedField && state.selectedField.id === id) {
            state.selectedField = null;
        }
    }

    // ============================================
    // Overlay Clicks (add new fields)
    // ============================================

    function onOverlayMouseDown(e, pageNum) {
        if (e.target !== e.currentTarget) return;
        if (e.button !== 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        handleOverlayAction(pageNum, x, y);
    }

    function onOverlayTouch(e, pageNum) {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();

        const touch = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        handleOverlayAction(pageNum, x, y);
    }

    function handleOverlayAction(pageNum, x, y) {
        if (state.tool === 'select') {
            deselectField();
            return;
        }

        if (state.tool === 'text') {
            const f = createField('text', pageNum, x - 4, y - 4, TEXT_FIELD_W, TEXT_FIELD_H, '');
            if (f) {
                selectField(f.id);
                const input = f.el.querySelector('input');
                if (input) input.focus();
            }
        } else if (state.tool === 'checkbox') {
            const f = createField('checkbox', pageNum, x - 12, y - 12, 24, 24, false);
            if (f) selectField(f.id);
        } else if (state.tool === 'signature') {
            state.pendingSigPage = pageNum;
            state.pendingSigX = x - 4;
            state.pendingSigY = y - 4;
            openSignatureModal();
        }
    }

    // ============================================
    // Field Dragging
    // ============================================

    function onFieldMouseDown(e, id) {
        // Don't drag if clicking delete, resize, input, or checkbox
        if (
            e.target.classList.contains('field-delete') ||
            e.target.classList.contains('resize-handle') ||
            e.target.tagName === 'INPUT' ||
            e.target.classList.contains('cb-box') ||
            e.target.closest('.cb-box')
        ) return;

        e.preventDefault();
        e.stopPropagation();
        selectField(id);
        startDrag(id, e.clientX, e.clientY);
    }

    function onFieldTouch(e, id) {
        if (
            e.target.classList.contains('field-delete') ||
            e.target.classList.contains('resize-handle') ||
            e.target.tagName === 'INPUT' ||
            e.target.classList.contains('cb-box') ||
            e.target.closest('.cb-box')
        ) return;

        e.preventDefault();
        e.stopPropagation();
        selectField(id);

        const touch = e.touches[0];
        startDrag(id, touch.clientX, touch.clientY);
    }

    function startDrag(id, cx, cy) {
        const f = state.fields.find((f) => f.id === id);
        if (!f) return;

        const rect = f.el.getBoundingClientRect();
        state.dragging = f;
        state.dragOffset.x = cx - rect.left;
        state.dragOffset.y = cy - rect.top;
    }

    function onDragMove(cx, cy) {
        if (!state.dragging) return;
        const f = state.dragging;
        const overlay = f.el.parentElement;
        const r = overlay.getBoundingClientRect();

        let nx = cx - r.left - state.dragOffset.x;
        let ny = cy - r.top - state.dragOffset.y;

        // Clamp
        nx = Math.max(0, Math.min(nx, r.width - f.w));
        ny = Math.max(0, Math.min(ny, r.height - f.h));

        f.x = nx;
        f.y = ny;
        f.el.style.left = nx + 'px';
        f.el.style.top = ny + 'px';
    }

    function onDragEnd() {
        state.dragging = null;
    }

    // ============================================
    // Field Resizing
    // ============================================

    function startResize(e, id) {
        e.preventDefault();
        e.stopPropagation();

        const f = state.fields.find((f) => f.id === id);
        if (!f) return;

        selectField(id);
        state.resizing = f;
        state.resizeStart = { x: e.clientX, y: e.clientY, w: f.w, h: f.h };
    }

    function startResizeTouch(e, id) {
        e.preventDefault();
        e.stopPropagation();

        const f = state.fields.find((f) => f.id === id);
        if (!f) return;

        selectField(id);
        const touch = e.touches[0];
        state.resizing = f;
        state.resizeStart = { x: touch.clientX, y: touch.clientY, w: f.w, h: f.h };
    }

    function onResizeMove(cx, cy) {
        if (!state.resizing) return;
        const f = state.resizing;
        const s = state.resizeStart;

        let nw = Math.max(60, s.w + (cx - s.x));
        let nh = Math.max(24, s.h + (cy - s.y));

        f.w = nw;
        f.h = nh;
        f.el.style.width = nw + 'px';
        f.el.style.height = nh + 'px';
    }

    function onResizeEnd() {
        state.resizing = null;
    }

    // ============================================
    // Global Mouse/Touch Handlers
    // ============================================

    function initGlobalHandlers() {
        document.addEventListener('mousemove', (e) => {
            if (state.dragging) onDragMove(e.clientX, e.clientY);
            if (state.resizing) onResizeMove(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', () => {
            if (state.dragging) onDragEnd();
            if (state.resizing) onResizeEnd();
        });

        document.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            if (state.dragging) { e.preventDefault(); onDragMove(t.clientX, t.clientY); }
            if (state.resizing) { e.preventDefault(); onResizeMove(t.clientX, t.clientY); }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (state.dragging) onDragEnd();
            if (state.resizing) onResizeEnd();
        });
    }

    // ============================================
    // Signature Pad
    // ============================================

    const sigState = {
        drawing: false,
        paths: [],
        currentPath: [],
        ctx: null,
    };

    function initSignaturePad() {
        const canvas = dom.sigCanvas;

        function getPos(e) {
            const r = canvas.getBoundingClientRect();
            const scaleX = canvas.width / r.width;
            const scaleY = canvas.height / r.height;
            if (e.touches) {
                return { x: (e.touches[0].clientX - r.left) * scaleX, y: (e.touches[0].clientY - r.top) * scaleY };
            }
            return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
        }

        function startDraw(e) {
            e.preventDefault();
            sigState.drawing = true;
            sigState.currentPath = [getPos(e)];
        }

        function draw(e) {
            if (!sigState.drawing) return;
            e.preventDefault();
            const pos = getPos(e);
            sigState.currentPath.push(pos);
            renderSig();
        }

        function endDraw() {
            if (!sigState.drawing) return;
            sigState.drawing = false;
            if (sigState.currentPath.length > 1) {
                sigState.paths.push([...sigState.currentPath]);
            }
            sigState.currentPath = [];
        }

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseleave', endDraw);
        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', endDraw);

        dom.btnClearSig.addEventListener('click', clearSig);
        dom.btnCancelSig.addEventListener('click', closeSignatureModal);
        dom.btnSaveSig.addEventListener('click', saveSignature);
    }

    function renderSig() {
        const canvas = dom.sigCanvas;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1d1d1f';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const allPaths = [...sigState.paths, sigState.currentPath];
        for (const path of allPaths) {
            if (path.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(path[i].x, path[i].y);
            }
            ctx.stroke();
        }
    }

    function clearSig() {
        sigState.paths = [];
        sigState.currentPath = [];
        const ctx = dom.sigCanvas.getContext('2d');
        ctx.clearRect(0, 0, dom.sigCanvas.width, dom.sigCanvas.height);
    }

    function openSignatureModal() {
        clearSig();
        // Set canvas resolution
        const canvas = dom.sigCanvas;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;

        dom.modalSig.classList.add('active');
    }

    function closeSignatureModal() {
        dom.modalSig.classList.remove('active');
    }

    function saveSignature() {
        if (sigState.paths.length === 0) {
            showHint('Please draw a signature first');
            return;
        }

        const dataUrl = dom.sigCanvas.toDataURL('image/png');
        closeSignatureModal();

        const f = createField(
            'signature',
            state.pendingSigPage,
            state.pendingSigX,
            state.pendingSigY,
            SIG_FIELD_W,
            SIG_FIELD_H,
            dataUrl
        );
        if (f) selectField(f.id);
    }

    // ============================================
    // Export Modal
    // ============================================

    function initExportModal() {
        dom.btnExport.addEventListener('click', openExportModal);
        dom.btnCancelExport.addEventListener('click', closeExportModal);
        dom.btnConfirmExport.addEventListener('click', doExport);

        dom.clientName.addEventListener('input', () => {
            const name = dom.clientName.value.trim();
            dom.btnConfirmExport.disabled = !name;
            updateFilePreview(name);
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach((b) => {
            b.addEventListener('click', () => {
                dom.modalExport.classList.remove('active');
                dom.modalSig.classList.remove('active');
            });
        });
    }

    function openExportModal() {
        dom.clientName.value = '';
        dom.btnConfirmExport.disabled = true;
        updateFilePreview('');
        dom.modalExport.classList.add('active');
        setTimeout(() => dom.clientName.focus(), 100);
    }

    function closeExportModal() {
        dom.modalExport.classList.remove('active');
    }

    function updateFilePreview(name) {
        const today = new Date().toISOString().split('T')[0];
        const safeName = (name || 'ClientName').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
        dom.filePreview.textContent = safeName + '_' + today + '.pdf';
    }

    // ============================================
    // PDF Export
    // ============================================

    async function doExport() {
        const clientName = dom.clientName.value.trim();
        if (!clientName) return;

        dom.btnConfirmExport.textContent = 'Generating...';
        dom.btnConfirmExport.disabled = true;

        try {
            const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
            const pages = pdfDoc.getPages();

            // Embed a standard font for text fields
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

            for (const field of state.fields) {
                const pageIdx = field.page - 1;
                if (pageIdx < 0 || pageIdx >= pages.length) continue;

                const page = pages[pageIdx];
                const { height: pageH } = page.getSize();
                const scale = state.scale;

                if (field.type === 'text' && field.value) {
                    const fontSize = Math.min(14, (field.h / scale) * 0.7);
                    const pdfX = field.x / scale;
                    const pdfY = pageH - (field.y / scale) - (field.h / scale) * 0.75;

                    page.drawText(field.value, {
                        x: pdfX + 4,
                        y: pdfY,
                        size: fontSize,
                        font: font,
                        color: PDFLib.rgb(0, 0, 0),
                    });
                } else if (field.type === 'checkbox' && field.value) {
                    const sz = field.w / scale;
                    const pdfX = field.x / scale;
                    const pdfY = pageH - (field.y / scale) - sz;

                    // Draw check mark
                    page.drawText('\u2713', {
                        x: pdfX + 2,
                        y: pdfY + 2,
                        size: sz * 0.85,
                        font: font,
                        color: PDFLib.rgb(0, 0, 0),
                    });
                } else if (field.type === 'signature' && field.value) {
                    try {
                        const sigBytes = dataUrlToBytes(field.value);
                        const sigImage = await pdfDoc.embedPng(sigBytes);

                        const fw = field.w / scale;
                        const fh = field.h / scale;
                        const pdfX = field.x / scale;
                        const pdfY = pageH - (field.y / scale) - fh;

                        page.drawImage(sigImage, {
                            x: pdfX,
                            y: pdfY,
                            width: fw,
                            height: fh,
                        });
                    } catch (imgErr) {
                        console.warn('Could not embed signature:', imgErr);
                    }
                }
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const today = new Date().toISOString().split('T')[0];
            const safeName = clientName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
            const fileName = safeName + '_' + today + '.pdf';

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            closeExportModal();
            showHint('Downloaded: ' + fileName);
        } catch (err) {
            console.error('Export failed:', err);
            showHint('Export failed. Please try again.');
        } finally {
            dom.btnConfirmExport.textContent = 'Download PDF';
            dom.btnConfirmExport.disabled = false;
        }
    }

    function dataUrlToBytes(dataUrl) {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // ============================================
    // Keyboard Shortcuts
    // ============================================

    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Ignore when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.key === 'Escape') e.target.blur();
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'v':
                    setTool('select');
                    break;
                case 't':
                    setTool('text');
                    break;
                case 'c':
                    setTool('checkbox');
                    break;
                case 's':
                    if (!e.ctrlKey && !e.metaKey) setTool('signature');
                    break;
                case 'delete':
                case 'backspace':
                    if (state.selectedField) {
                        e.preventDefault();
                        deleteField(state.selectedField.id);
                    }
                    break;
                case 'escape':
                    deselectField();
                    dom.modalExport.classList.remove('active');
                    dom.modalSig.classList.remove('active');
                    break;
            }
        });
    }

    // ============================================
    // View Management
    // ============================================

    function showView(name) {
        dom.uploadView.classList.toggle('active', name === 'upload');
        dom.editorView.classList.toggle('active', name === 'editor');
    }

    function initBack() {
        dom.btnBack.addEventListener('click', () => {
            if (state.fields.length > 0) {
                if (!confirm('Going back will discard all your changes. Continue?')) return;
            }
            state.pdfDoc = null;
            state.pdfBytes = null;
            state.fields = [];
            state.selectedField = null;
            state.fieldIdCounter = 0;
            dom.container.innerHTML = '';
            dom.fileInput.value = '';
            showView('upload');
        });
    }

    // ============================================
    // Hint Toast
    // ============================================

    let hintTimeout = null;
    function showHint(msg) {
        dom.hint.textContent = msg;
        dom.hint.classList.add('show');
        clearTimeout(hintTimeout);
        hintTimeout = setTimeout(() => dom.hint.classList.remove('show'), HINT_DURATION);
    }

    // ============================================
    // Init
    // ============================================

    function init() {
        initUpload();
        initTools();
        initPageNav();
        initGlobalHandlers();
        initSignaturePad();
        initExportModal();
        initKeyboard();
        initBack();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
