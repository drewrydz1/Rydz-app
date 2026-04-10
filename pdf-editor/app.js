/* ============================================
   FormFlow — CC Auth Generator
   Fills dealer fields, exports editable PDF
   for client to complete cardholder section.
   ============================================ */

(function () {
    'use strict';

    // ========================================
    // Config — field definitions
    // ========================================

    const DEALER_FIELDS = [
        { key: 'buyer',   label: 'Buyer Name',   inputId: 'f-buyer' },
        { key: 'deal',    label: 'Deal #',        inputId: 'f-deal' },
        { key: 'stock',   label: 'Stock #',       inputId: 'f-stock' },
        { key: 'invoice', label: 'Invoice #',     inputId: 'f-invoice' },
        { key: 'date',    label: 'Date of Purchase', inputId: 'f-date' },
        { key: 'amount',  label: 'Amount Due',    inputId: 'f-amount' },
    ];

    // Vertical offset from first field (Buyer Name) in PDF points.
    // Used when PDF has no AcroForm fields and we need to place text.
    const FIELD_SPACING = 30;  // pts between each dealer field line

    // ========================================
    // State
    // ========================================

    const state = {
        pdfBytes: null,
        pdfDoc: null,       // PDF.js document
        fileName: '',
        totalPages: 0,
        scale: 1.5,

        // Detected form fields from PDF.js annotations
        hasFormFields: false,
        topAnnotations: [],     // sorted annotations for dealer fields
        bottomAnnotations: [],  // annotations for client fields
        allAnnotations: [],

        // Calibration (fallback when no form fields)
        calibrating: false,
        calAnchor: null,  // {x, y} in PDF points — where Buyer Name line starts
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
    // PDF Rendering (preview)
    // ========================================

    async function loadPDF() {
        showView('editor');
        dom.previewContainer.innerHTML = '<div class="loading-wrap"><div class="spinner"></div>Loading PDF&hellip;</div>';

        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        try {
            state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes }).promise;
            state.totalPages = state.pdfDoc.numPages;
            await renderPreview();
            await detectFields();
        } catch (err) {
            console.error(err);
            dom.previewContainer.innerHTML = '<div class="loading-wrap" style="color:var(--red)">Failed to load PDF</div>';
        }
    }

    async function renderPreview() {
        dom.previewContainer.innerHTML = '';

        for (let i = 1; i <= state.totalPages; i++) {
            const page = await state.pdfDoc.getPage(i);
            const vp = page.getViewport({ scale: state.scale });

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
    // Form Field Detection
    // ========================================

    async function detectFields() {
        state.allAnnotations = [];

        for (let i = 1; i <= state.totalPages; i++) {
            const page = await state.pdfDoc.getPage(i);
            const annots = await page.getAnnotations();

            for (const a of annots) {
                if (a.subtype !== 'Widget') continue;
                state.allAnnotations.push({
                    page: i,
                    fieldName: a.fieldName || '',
                    fieldType: a.fieldType,
                    rect: a.rect,       // [x1, y1, x2, y2] PDF coords (bottom-left origin)
                    checkBox: !!a.checkBox,
                    fieldValue: a.fieldValue,
                });
            }
        }

        // Filter to text fields only (ignore checkboxes for splitting)
        const textFields = state.allAnnotations
            .filter((a) => a.fieldType === 'Tx')
            .sort((a, b) => {
                // Sort top-to-bottom: higher y = higher on page, so descending y
                if (a.page !== b.page) return a.page - b.page;
                return b.rect[1] - a.rect[1];
            });

        state.hasFormFields = textFields.length >= 6;

        if (state.hasFormFields) {
            // Split: top 6 are dealer, rest are client
            state.topAnnotations = textFields.slice(0, 6);
            state.bottomAnnotations = textFields.slice(6);

            dom.fieldCount.textContent = textFields.length + ' form fields detected';
            dom.fieldCount.className = 'field-count found';
            dom.calBanner.classList.remove('active');
            showToast('Form fields detected — fill in your info and hit Generate');
        } else {
            dom.fieldCount.textContent = 'No form fields detected';
            dom.fieldCount.className = 'field-count none';
            startCalibration();
        }

        updateGenerateButton();
    }

    // ========================================
    // Calibration (fallback — no form fields)
    // ========================================

    function startCalibration() {
        state.calibrating = true;
        state.calAnchor = null;
        dom.calBanner.classList.add('active');
        dom.calText.innerHTML = 'Click on the PDF where the <strong>Buyer Name</strong> line starts';

        // Add click overlays to pages
        document.querySelectorAll('.page-wrap').forEach((wrap) => {
            const overlay = document.createElement('div');
            overlay.className = 'cal-overlay';
            overlay.addEventListener('click', (e) => onCalClick(e, wrap));
            wrap.appendChild(overlay);
        });
    }

    function onCalClick(e, wrap) {
        if (!state.calibrating) return;

        const rect = wrap.querySelector('canvas').getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // Convert to PDF points
        const page = parseInt(wrap.dataset.page);
        const pdfX = sx / state.scale;
        const pdfY = sy / state.scale; // from top (we'll convert when drawing)

        state.calAnchor = { page, x: pdfX, y: pdfY };

        // Show marker
        wrap.querySelectorAll('.cal-marker').forEach((m) => m.remove());
        const marker = document.createElement('div');
        marker.className = 'cal-marker';
        marker.style.left = sx + 'px';
        marker.style.top = sy + 'px';
        wrap.appendChild(marker);

        endCalibration();
    }

    function endCalibration() {
        state.calibrating = false;
        dom.calBanner.classList.remove('active');

        // Remove overlays
        document.querySelectorAll('.cal-overlay').forEach((o) => o.remove());

        showToast('Position set — fill in your info and hit Generate', 'success');
        updateGenerateButton();
    }

    function initCalibration() {
        dom.btnCalSkip.addEventListener('click', () => {
            // Use default center position
            state.calAnchor = { page: 1, x: 200, y: 170 }; // reasonable default
            endCalibration();
        });
    }

    // ========================================
    // Form Validation & Generate Button
    // ========================================

    function getFormValues() {
        return {
            buyer: $('f-buyer').value.trim(),
            deal: $('f-deal').value.trim(),
            stock: $('f-stock').value.trim(),
            invoice: $('f-invoice').value.trim(),
            date: $('f-date').value.trim(),
            amount: $('f-amount').value.trim(),
        };
    }

    function isFormValid() {
        const v = getFormValues();
        return v.buyer && v.date && v.amount && (state.hasFormFields || state.calAnchor);
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

        try {
            const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const values = getFormValues();
            const valuesList = [values.buyer, values.deal, values.stock, values.invoice, values.date, values.amount ? '$' + values.amount : ''];

            if (state.hasFormFields) {
                await fillWithFormFields(pdfDoc, font, valuesList);
            } else {
                await fillWithoutFormFields(pdfDoc, font, valuesList);
            }

            // Save and download
            const pdfBytes = await pdfDoc.save();
            downloadBlob(pdfBytes, values.buyer);

            showToast('PDF generated successfully!', 'success');
        } catch (err) {
            console.error('Generate failed:', err);
            showToast('Failed to generate PDF: ' + err.message, 'error');
        } finally {
            dom.btnGenerate.classList.remove('loading');
            dom.btnGenerate.innerHTML =
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Generate &amp; Download PDF';
        }
    }

    // ---- Path A: PDF has AcroForm fields ----

    async function fillWithFormFields(pdfDoc, font, valuesList) {
        const form = pdfDoc.getForm();
        const allPdfFields = form.getFields();

        // Try to fill top fields (dealer) — match by detected annotation order
        for (let i = 0; i < state.topAnnotations.length && i < valuesList.length; i++) {
            const annotName = state.topAnnotations[i].fieldName;
            if (!annotName) continue;

            try {
                const field = form.getTextField(annotName);
                field.setText(valuesList[i]);
                field.enableReadOnly();

                // Style: make it look "locked"
                field.defaultUpdateAppearances(font);
            } catch (e) {
                console.warn('Could not fill field:', annotName, e.message);

                // Fallback: draw text directly at the annotation's position
                const annot = state.topAnnotations[i];
                const pages = pdfDoc.getPages();
                const page = pages[annot.page - 1];
                if (page && valuesList[i]) {
                    const [x1, y1] = annot.rect;
                    page.drawText(valuesList[i], {
                        x: x1 + 3,
                        y: y1 + 4,
                        size: 11,
                        font: font,
                        color: PDFLib.rgb(0, 0, 0),
                    });
                }
            }
        }

        // Ensure bottom (client) fields remain editable and empty
        for (const annot of state.bottomAnnotations) {
            if (!annot.fieldName) continue;
            try {
                const field = form.getTextField(annot.fieldName);
                field.setText('');
                field.disableReadOnly();
            } catch (_) { /* not a text field or doesn't exist */ }
        }

        // Handle checkboxes — make sure they're editable
        state.allAnnotations
            .filter((a) => a.checkBox || a.fieldType === 'Btn')
            .forEach((a) => {
                try {
                    const cb = form.getCheckBox(a.fieldName);
                    cb.uncheck();
                    cb.disableReadOnly();
                } catch (_) { /* ignore */ }
            });

        // Need to update appearances so filled fields render properly
        form.updateFieldAppearances(font);
    }

    // ---- Path B: No AcroForm fields — draw text + create editable fields ----

    async function fillWithoutFormFields(pdfDoc, font, valuesList) {
        const pages = pdfDoc.getPages();
        const anchor = state.calAnchor;
        const pageIdx = (anchor.page || 1) - 1;
        const page = pages[pageIdx];
        if (!page) return;

        const { height: pageH } = page.getSize();

        // Convert anchor from top-down screen coords to PDF bottom-up coords
        const anchorPdfX = anchor.x;
        const anchorPdfY = pageH - anchor.y;

        // Draw dealer values at anchor + offsets
        for (let i = 0; i < valuesList.length; i++) {
            if (!valuesList[i]) continue;
            page.drawText(valuesList[i], {
                x: anchorPdfX + 4,
                y: anchorPdfY - (i * FIELD_SPACING) - 2,
                size: 11,
                font: font,
                color: PDFLib.rgb(0, 0, 0),
            });
        }

        // Create editable form fields for the cardholder section
        const form = pdfDoc.getForm();
        const startY = anchorPdfY - (6 * FIELD_SPACING) - 60; // gap after dealer fields
        const fieldW = 320;
        const fieldH = 18;
        const fieldX = anchorPdfX;

        const clientFields = [
            'Cardholder Name',
            'Card #',
            'Expiration Date',
            'CVV #',
            'Cardholder Zip Code',
            'Cardholder Phone Number',
            'Signature / Date',
        ];

        clientFields.forEach((label, i) => {
            const fieldName = 'client_' + label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const tf = form.createTextField(fieldName);
            const y = startY - (i * (FIELD_SPACING + 2));

            tf.addToPage(page, {
                x: fieldX,
                y: y,
                width: fieldW,
                height: fieldH,
                borderWidth: 1,
                borderColor: PDFLib.rgb(0.7, 0.7, 0.7),
                backgroundColor: PDFLib.rgb(0.97, 0.97, 1),
            });

            tf.disableReadOnly();
        });

        // Create checkboxes for card type
        const cbY = startY + FIELD_SPACING; // above the text fields
        const cbLabels = ['MC', 'VISA', 'AMEX', 'DISCOVER'];
        cbLabels.forEach((label, i) => {
            const cb = form.createCheckBox('cardType_' + label);
            cb.addToPage(page, {
                x: fieldX + (i * 80),
                y: cbY,
                width: 14,
                height: 14,
                borderWidth: 1,
                borderColor: PDFLib.rgb(0.5, 0.5, 0.5),
            });
        });

        form.updateFieldAppearances(font);
    }

    // ========================================
    // Download
    // ========================================

    function downloadBlob(pdfBytes, clientName) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const today = new Date().toISOString().split('T')[0];
        const safe = (clientName || 'Document').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
        const fileName = safe + '_' + today + '.pdf';

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // ========================================
    // View management
    // ========================================

    function showView(name) {
        dom.uploadView.classList.toggle('active', name === 'upload');
        dom.editorView.classList.toggle('active', name === 'editor');
    }

    function initBack() {
        dom.btnBack.addEventListener('click', () => {
            state.pdfBytes = null;
            state.pdfDoc = null;
            state.hasFormFields = false;
            state.topAnnotations = [];
            state.bottomAnnotations = [];
            state.allAnnotations = [];
            state.calAnchor = null;
            state.calibrating = false;
            dom.previewContainer.innerHTML = '';
            dom.fileInput.value = '';
            dom.calBanner.classList.remove('active');

            // Clear form inputs
            DEALER_FIELDS.forEach((f) => { $(f.inputId).value = ''; });
            updateGenerateButton();
            showView('upload');
        });
    }

    // ========================================
    // Toast
    // ========================================

    let toastTimer = null;
    function showToast(msg, type) {
        dom.toast.textContent = msg;
        dom.toast.className = 'toast show' + (type ? ' ' + type : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { dom.toast.className = 'toast'; }, 4000);
    }

    // ========================================
    // Init
    // ========================================

    function init() {
        initUpload();
        initFormListeners();
        initCalibration();
        initBack();

        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        $('f-date').value = today;

        dom.btnGenerate.addEventListener('click', generate);

        // Keyboard: Enter to generate
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.target.matches('textarea') && isFormValid()) {
                generate();
            }
        });

        updateGenerateButton();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
