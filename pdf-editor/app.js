/* ============================================
   FormFlow — CC Auth Generator
   Fills dealer fields, exports editable PDF
   for client to complete cardholder section.
   ============================================ */

(function () {
    'use strict';

    // ========================================
    // Config
    // ========================================

    const DEALER_FIELDS = [
        { key: 'buyer',   label: 'Buyer Name',          inputId: 'f-buyer' },
        { key: 'deal',    label: 'Deal #',               inputId: 'f-deal' },
        { key: 'stock',   label: 'Stock #',              inputId: 'f-stock' },
        { key: 'invoice', label: 'Invoice #',            inputId: 'f-invoice' },
        { key: 'date',    label: 'Date of Purchase',     inputId: 'f-date' },
        { key: 'amount',  label: 'Amount Due',           inputId: 'f-amount' },
    ];

    // Vertical spacing between field lines in PDF points
    const FIELD_SPACING = 30;

    // Button SVG icon (cached so we can restore it after loading state)
    const BTN_ICON_HTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    // ========================================
    // State
    // ========================================

    const state = {
        pdfBytes: null,
        pdfDoc: null,
        fileName: '',
        totalPages: 0,
        scale: 1.5,

        hasFormFields: false,
        topAnnotations: [],
        bottomAnnotations: [],
        allAnnotations: [],

        // Calibration (when no form fields detected)
        calibrating: false,
        calAnchor: null,

        // Page dimensions in PDF points (per page)
        pageSizes: [],
    };

    // ========================================
    // DOM refs
    // ========================================

    const $ = (id) => document.getElementById(id);
    const dom = {
        uploadView: $('v-upload'),
        editorView: $('v-editor'),
        dropZone: $('drop-zone'),
        fileInput: $('file-input'),
        fileName: $('file-name'),
        fieldCount: $('field-count'),
        previewContainer: $('preview-container'),
        btnBack: $('btn-back'),
        btnGenerate: $('btn-generate'),
        calBanner: $('calibrate-banner'),
        calText: $('cal-text'),
        btnCalSkip: $('btn-cal-skip'),
        toast: $('toast'),
    };

    // ========================================
    // Upload
    // ========================================

    function initUpload() {
        const dz = dom.dropZone;

        dz.addEventListener('dragover', (e) => {
            e.preventDefault();
            dz.classList.add('drag-over');
        });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
        dz.addEventListener('drop', (e) => {
            e.preventDefault();
            dz.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });
        dz.addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleFile(e.target.files[0]);
        });
    }

    function handleFile(file) {
        if (file.type !== 'application/pdf') {
            showToast('Please upload a PDF file', 'error');
            return;
        }
        state.fileName = file.name;
        dom.fileName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            state.pdfBytes = new Uint8Array(e.target.result);
            loadPDF();
        };
        reader.readAsArrayBuffer(file);
    }

    // ========================================
    // PDF Rendering
    // ========================================

    async function loadPDF() {
        showView('editor');
        dom.previewContainer.innerHTML = '<div class="loading-wrap"><div class="spinner"></div>Loading PDF&hellip;</div>';

        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        try {
            state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes.slice() }).promise;
            state.totalPages = state.pdfDoc.numPages;
            state.pageSizes = [];

            await renderPreview();
            await detectFields();
        } catch (err) {
            console.error('PDF load error:', err);
            dom.previewContainer.innerHTML =
                '<div class="loading-wrap" style="color:var(--red)">Failed to load PDF. Try a different file.</div>';
        }
    }

    async function renderPreview() {
        dom.previewContainer.innerHTML = '';

        for (let i = 1; i <= state.totalPages; i++) {
            const page = await state.pdfDoc.getPage(i);
            const vp = page.getViewport({ scale: state.scale });

            // Store page size in PDF points
            const rawVp = page.getViewport({ scale: 1 });
            state.pageSizes[i] = { w: rawVp.width, h: rawVp.height };

            const wrap = document.createElement('div');
            wrap.className = 'page-wrap';
            wrap.dataset.page = i;
            wrap.style.width = vp.width + 'px';
            wrap.style.height = vp.height + 'px';

            const canvas = document.createElement('canvas');
            canvas.width = vp.width;
            canvas.height = vp.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

            wrap.appendChild(canvas);

            if (state.totalPages > 1) {
                const label = document.createElement('div');
                label.className = 'page-label';
                label.textContent = 'Page ' + i + ' of ' + state.totalPages;
                wrap.appendChild(label);
            }

            dom.previewContainer.appendChild(wrap);
        }
    }

    // ========================================
    // Field Detection
    // ========================================

    async function detectFields() {
        state.allAnnotations = [];

        for (let i = 1; i <= state.totalPages; i++) {
            const page = await state.pdfDoc.getPage(i);
            try {
                const annots = await page.getAnnotations();
                for (const a of annots) {
                    if (a.subtype !== 'Widget') continue;
                    state.allAnnotations.push({
                        page: i,
                        fieldName: a.fieldName || '',
                        fieldType: a.fieldType,
                        rect: a.rect,
                        checkBox: !!a.checkBox,
                        fieldValue: a.fieldValue,
                    });
                }
            } catch (_) { /* annotations not available */ }
        }

        const textFields = state.allAnnotations
            .filter((a) => a.fieldType === 'Tx')
            .sort((a, b) => {
                if (a.page !== b.page) return a.page - b.page;
                return b.rect[1] - a.rect[1]; // top-to-bottom
            });

        state.hasFormFields = textFields.length >= 6;

        if (state.hasFormFields) {
            state.topAnnotations = textFields.slice(0, 6);
            state.bottomAnnotations = textFields.slice(6);

            dom.fieldCount.textContent = textFields.length + ' form fields detected';
            dom.fieldCount.className = 'field-count found';
            dom.calBanner.classList.remove('active');
            showToast('Form fields detected automatically');
        } else {
            // No form fields — set a smart default anchor and offer calibration
            setDefaultAnchor();
            dom.fieldCount.textContent = 'No form fields — using overlay mode';
            dom.fieldCount.className = 'field-count none';
            showCalibrationOption();
            showToast('No form fields found. Fill your info and hit Generate.');
        }

        updateGenerateButton();
    }

    // ========================================
    // Anchor / Calibration
    // ========================================

    function setDefaultAnchor() {
        // Smart default: estimate where "Buyer Name:" line starts on a standard letter PDF
        // This positions text at roughly 33% from left, 27% from top of page
        const ps = state.pageSizes[1] || { w: 612, h: 792 };
        state.calAnchor = {
            page: 1,
            x: ps.w * 0.33,
            y: ps.h * 0.27,
        };
    }

    function showCalibrationOption() {
        dom.calBanner.classList.add('active');
        dom.calText.innerHTML = 'Want precise positioning? Click on the PDF where the <strong>Buyer Name</strong> line starts. Or just use defaults.';

        document.querySelectorAll('.page-wrap').forEach((wrap) => {
            const overlay = document.createElement('div');
            overlay.className = 'cal-overlay';
            overlay.addEventListener('click', (e) => onCalClick(e, wrap));
            wrap.appendChild(overlay);
        });
    }

    function onCalClick(e, wrap) {
        const rect = wrap.querySelector('canvas').getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const pageNum = parseInt(wrap.dataset.page);

        // Convert screen pixels to PDF points
        // sx/sy are in screen pixels at state.scale; divide to get PDF points from top-left
        const pdfX = sx / state.scale;
        const pdfYFromTop = sy / state.scale;

        // Store as PDF coords (bottom-up) for drawing
        const pageH = (state.pageSizes[pageNum] || { h: 792 }).h;
        state.calAnchor = {
            page: pageNum,
            x: pdfX,
            y: pageH - pdfYFromTop,  // convert to bottom-up PDF coords
        };

        // Show marker
        wrap.querySelectorAll('.cal-marker').forEach((m) => m.remove());
        const marker = document.createElement('div');
        marker.className = 'cal-marker';
        marker.style.left = sx + 'px';
        marker.style.top = sy + 'px';
        wrap.appendChild(marker);

        endCalibration();
        showToast('Position set!', 'success');
    }

    function endCalibration() {
        state.calibrating = false;
        dom.calBanner.classList.remove('active');
        document.querySelectorAll('.cal-overlay').forEach((o) => o.remove());
        updateGenerateButton();
    }

    function initCalibration() {
        dom.btnCalSkip.addEventListener('click', () => {
            endCalibration();
            showToast('Using default positioning');
        });
    }

    // ========================================
    // Form Validation
    // ========================================

    function getFormValues() {
        return {
            buyer:   $('f-buyer').value.trim(),
            deal:    $('f-deal').value.trim(),
            stock:   $('f-stock').value.trim(),
            invoice: $('f-invoice').value.trim(),
            date:    $('f-date').value.trim(),
            amount:  $('f-amount').value.trim(),
        };
    }

    function isFormValid() {
        const v = getFormValues();
        // Only require buyer name. Date and amount are nice-to-have.
        return v.buyer.length > 0;
    }

    function updateGenerateButton() {
        dom.btnGenerate.disabled = !isFormValid();
    }

    function initFormListeners() {
        DEALER_FIELDS.forEach((f) => {
            $(f.inputId).addEventListener('input', updateGenerateButton);
        });
    }

    // ========================================
    // PDF Generation
    // ========================================

    async function generate() {
        if (!isFormValid()) return;

        dom.btnGenerate.classList.add('loading');
        dom.btnGenerate.textContent = 'Generating...';
        dom.btnGenerate.disabled = true;

        try {
            // Load with pdf-lib (separate from PDF.js instance)
            const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes, {
                ignoreEncryption: true,
                updateMetadata: false,
            });

            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

            const values = getFormValues();
            const valuesList = [
                values.buyer,
                values.deal,
                values.stock,
                values.invoice,
                values.date,
                values.amount ? '$' + values.amount : '',
            ];

            if (state.hasFormFields) {
                fillWithFormFields(pdfDoc, font, valuesList);
            } else {
                fillWithoutFormFields(pdfDoc, font, valuesList);
            }

            // Save
            const pdfBytes = await pdfDoc.save();

            // Download
            downloadBlob(pdfBytes, values.buyer);
            showToast('PDF downloaded!', 'success');

        } catch (err) {
            console.error('Generate error:', err);
            showToast('Generation failed: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            dom.btnGenerate.classList.remove('loading');
            dom.btnGenerate.innerHTML = BTN_ICON_HTML + ' Generate &amp; Download PDF';
            dom.btnGenerate.disabled = !isFormValid();
        }
    }

    // ---- Path A: PDF has AcroForm fields ----

    function fillWithFormFields(pdfDoc, font, valuesList) {
        let form;
        try {
            form = pdfDoc.getForm();
        } catch (e) {
            console.warn('Could not get form, falling back to overlay:', e.message);
            fillWithoutFormFields(pdfDoc, font, valuesList);
            return;
        }

        // Fill dealer fields (top 6) and lock them
        for (let i = 0; i < state.topAnnotations.length && i < valuesList.length; i++) {
            const annot = state.topAnnotations[i];
            if (!annot.fieldName) continue;

            try {
                const field = form.getTextField(annot.fieldName);
                if (valuesList[i]) {
                    field.setText(valuesList[i]);
                }
                field.enableReadOnly();
            } catch (e) {
                // Field might not be a TextField or doesn't exist in pdf-lib's view.
                // Fallback: draw text directly on the page at the annotation's rect.
                console.warn('Filling field via drawText fallback:', annot.fieldName);
                try {
                    const pages = pdfDoc.getPages();
                    const page = pages[annot.page - 1];
                    if (page && valuesList[i]) {
                        const [x1, y1, , y2] = annot.rect;
                        const h = y2 - y1;
                        page.drawText(valuesList[i], {
                            x: x1 + 2,
                            y: y1 + h * 0.25,
                            size: Math.min(11, h * 0.65),
                            font: font,
                            color: PDFLib.rgb(0, 0, 0),
                        });
                    }
                } catch (_) { /* last resort failed, skip */ }
            }
        }

        // Client fields: ensure they're editable and empty
        for (const annot of state.bottomAnnotations) {
            if (!annot.fieldName) continue;
            try {
                const field = form.getTextField(annot.fieldName);
                field.setText('');
                field.disableReadOnly();
            } catch (_) { /* ignore — not every annotation maps cleanly */ }
        }

        // Checkboxes: ensure editable
        for (const annot of state.allAnnotations) {
            if (!annot.checkBox && annot.fieldType !== 'Btn') continue;
            try {
                const cb = form.getCheckBox(annot.fieldName);
                cb.uncheck();
                cb.disableReadOnly();
            } catch (_) { /* ignore */ }
        }

        // Rebuild appearances so filled text is visible in all viewers
        try {
            form.updateFieldAppearances(font);
        } catch (e) {
            console.warn('Could not update field appearances:', e.message);
        }
    }

    // ---- Path B: No AcroForm fields — overlay text + create editable fields ----

    function fillWithoutFormFields(pdfDoc, font, valuesList) {
        const pages = pdfDoc.getPages();
        const anchor = state.calAnchor;
        if (!anchor) {
            setDefaultAnchor();
        }

        const a = state.calAnchor;
        const pageIdx = (a.page || 1) - 1;
        const page = pages[pageIdx];
        if (!page) return;

        const { height: pageH, width: pageW } = page.getSize();

        // anchor.x and anchor.y are already in PDF coordinate space (bottom-up)
        const ax = a.x;
        const ay = a.y;

        // Draw dealer values
        for (let i = 0; i < valuesList.length; i++) {
            if (!valuesList[i]) continue;
            page.drawText(valuesList[i], {
                x: ax + 2,
                y: ay - (i * FIELD_SPACING),
                size: 11,
                font: font,
                color: PDFLib.rgb(0, 0, 0),
            });
        }

        // Create editable form fields for cardholder section
        try {
            const form = pdfDoc.getForm();

            // Position client fields below dealer fields with a gap
            const clientStartY = ay - (DEALER_FIELDS.length * FIELD_SPACING) - 55;
            const fieldW = Math.min(320, pageW - ax - 30);
            const fieldH = 18;

            const clientTextFields = [
                'Cardholder Name',
                'Card Number',
                'Expiration Date',
                'CVV',
                'Cardholder Zip Code',
                'Cardholder Phone Number',
                'Cardholder Signature / Date',
            ];

            clientTextFields.forEach((label, i) => {
                const safeName = 'client_' + label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                try {
                    const tf = form.createTextField(safeName);
                    tf.addToPage(page, {
                        x: ax,
                        y: clientStartY - (i * (FIELD_SPACING + 2)),
                        width: fieldW,
                        height: fieldH,
                        borderWidth: 1,
                        borderColor: PDFLib.rgb(0.65, 0.65, 0.65),
                        backgroundColor: PDFLib.rgb(0.96, 0.97, 1.0),
                    });
                } catch (e) {
                    console.warn('Could not create field:', safeName, e.message);
                }
            });

            // Card type checkboxes
            const cbY = clientStartY + FIELD_SPACING;
            var cbLabels = ['MC', 'VISA', 'AMEX', 'DISCOVER'];
            cbLabels.forEach(function(label, i) {
                try {
                    var cb = form.createCheckBox('cardType_' + label);
                    cb.addToPage(page, {
                        x: ax + (i * 80),
                        y: cbY,
                        width: 14,
                        height: 14,
                        borderWidth: 1,
                        borderColor: PDFLib.rgb(0.5, 0.5, 0.5),
                    });
                } catch (e) {
                    console.warn('Could not create checkbox:', label, e.message);
                }
            });

            try {
                form.updateFieldAppearances(font);
            } catch (_) { /* best effort */ }

        } catch (e) {
            console.warn('Could not create client form fields:', e.message);
            // Still OK — the dealer text was drawn, just no editable client fields
        }
    }

    // ========================================
    // Download
    // ========================================

    function downloadBlob(pdfBytes, clientName) {
        var blob = new Blob([pdfBytes], { type: 'application/pdf' });
        var url = URL.createObjectURL(blob);
        var today = new Date().toISOString().split('T')[0];
        var safe = (clientName || 'Document').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
        var fileName = safe + '_' + today + '.pdf';

        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;

        // For iOS/Safari compatibility: need to open in same tab
        a.style.display = 'none';
        document.body.appendChild(a);

        // Use setTimeout to ensure the click is processed
        setTimeout(function() {
            a.click();
            setTimeout(function() {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 3000);
        }, 100);
    }

    // ========================================
    // Views
    // ========================================

    function showView(name) {
        dom.uploadView.classList.toggle('active', name === 'upload');
        dom.editorView.classList.toggle('active', name === 'editor');
    }

    function initBack() {
        dom.btnBack.addEventListener('click', function() {
            state.pdfBytes = null;
            state.pdfDoc = null;
            state.hasFormFields = false;
            state.topAnnotations = [];
            state.bottomAnnotations = [];
            state.allAnnotations = [];
            state.calAnchor = null;
            state.calibrating = false;
            state.pageSizes = [];
            dom.previewContainer.innerHTML = '';
            dom.fileInput.value = '';
            dom.calBanner.classList.remove('active');
            DEALER_FIELDS.forEach(function(f) { $(f.inputId).value = ''; });
            updateGenerateButton();
            showView('upload');
        });
    }

    // ========================================
    // Toast
    // ========================================

    var toastTimer = null;
    function showToast(msg, type) {
        dom.toast.textContent = msg;
        dom.toast.className = 'toast show' + (type ? ' ' + type : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function() { dom.toast.className = 'toast'; }, 4000);
    }

    // ========================================
    // Init
    // ========================================

    function init() {
        initUpload();
        initFormListeners();
        initCalibration();
        initBack();

        // Default date to today
        var today = new Date().toISOString().split('T')[0];
        $('f-date').value = today;

        dom.btnGenerate.addEventListener('click', generate);

        // Enter key triggers generate
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && isFormValid()) {
                generate();
            }
        });

        updateGenerateButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
