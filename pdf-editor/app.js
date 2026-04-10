/* ============================================
   CC Auth Form Generator
   Builds the entire PDF template from scratch.
   Dealer fields = static text.
   Cardholder fields = editable AcroForm fields.
   ============================================ */

(function () {
    'use strict';

    // ========================================
    // Page constants (US Letter, PDF points)
    // ========================================

    var W = 612, H = 792;
    var ML = 52;               // left margin
    var MR = 52;               // right margin
    var RX = W - MR;           // right edge of content
    var CW = W - ML - MR;      // content width

    // ========================================
    // DOM
    // ========================================

    var formEl     = document.getElementById('form');
    var btnGen     = document.getElementById('btn-generate');
    var fBuyer     = document.getElementById('f-buyer');
    var fDeal      = document.getElementById('f-deal');
    var fStock     = document.getElementById('f-stock');
    var fInvoice   = document.getElementById('f-invoice');
    var fDate      = document.getElementById('f-date');
    var fAmount    = document.getElementById('f-amount');
    var toastEl    = document.getElementById('toast');

    // ========================================
    // Notes text (matches original form)
    // ========================================

    var NOTES = [
        'There is no working credit card terminal anywhere in the dealership. If this happens, once the transaction has been processed on a working terminal, the credit card number (except the last four digits) and the security code MUST BE REDACTED and this form is to be turned into the accounting office, where it must be kept in a central, locked location and stored for a maximum of 60 days.',
        'A customer is putting a deposit on a purchase via phone and will physically be present at a later date/time. Once that transaction is processed on a terminal, this form will be attached to the related invoice and sent to the accounting office, where the GL transaction will be recorded and this form will be IMMEDIATELY PLACED IN A SECURE SHREDDING BIN. When that cardholder is physically present in the dealership, they must sign the actual credit card slip that was printed when the transaction was processed. The signed slip must be attached to a copy of the related invoice and sent to the accounting office.',
        'A customer is putting a deposit on a purchase via phone and will NOT ever be physically present at the dealership. Once that transaction is processed on a terminal, this form will be attached to the related invoice and sent to the accounting office, where the GL transaction will be recorded and this form will be IMMEDIATELY PLACED IN A SECURE SHREDDING BIN. BE AWARE that these transactions are very risky and should be avoided whenever possible.',
    ];
    var NOTES_BOLD = 'THIS FORM SHOULD NEVER BE SCANNED FOR EMAIL OR DIGITAL DEAL JACKET PURPOSES.';

    // ========================================
    // Init
    // ========================================

    function init() {
        // Default date to today
        fDate.value = new Date().toISOString().split('T')[0];

        formEl.addEventListener('submit', function (e) {
            e.preventDefault();
            generate();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========================================
    // Generate
    // ========================================

    async function generate() {
        btnGen.disabled = true;
        btnGen.querySelector('span').textContent = 'Generating...';

        try {
            var values = {
                buyer:   fBuyer.value.trim(),
                deal:    fDeal.value.trim(),
                stock:   fStock.value.trim(),
                invoice: fInvoice.value.trim(),
                date:    formatDate(fDate.value),
                amount:  fAmount.value.trim(),
            };

            var pdfBytes = await buildPDF(values);
            download(pdfBytes, values.buyer);
            showToast('PDF downloaded!', 'success');
        } catch (err) {
            console.error('Generate failed:', err);
            showToast('Error: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            btnGen.disabled = false;
            btnGen.querySelector('span').textContent = 'Generate & Download PDF';
        }
    }

    // ========================================
    // Build PDF
    // ========================================

    async function buildPDF(v) {
        var pdf  = await PDFLib.PDFDocument.create();
        var page = pdf.addPage([W, H]);

        var font     = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
        var fontBold = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

        var black    = PDFLib.rgb(0, 0, 0);
        var gray     = PDFLib.rgb(0.45, 0.45, 0.45);

        // ---- Helper: draw centered text ----
        function centered(text, y, size, f) {
            var tw = f.widthOfTextAtSize(text, size);
            page.drawText(text, { x: (W - tw) / 2, y: y, size: size, font: f, color: black });
        }

        // ---- Helper: draw field row (label + line + optional value) ----
        function fieldRow(label, value, y, labelFont) {
            var lf = labelFont || fontBold;
            var lw = lf.widthOfTextAtSize(label, 10);
            page.drawText(label, { x: ML, y: y, size: 10, font: lf, color: black });

            var lineX = ML + lw + 6;
            page.drawLine({
                start: { x: lineX, y: y - 3 },
                end:   { x: RX, y: y - 3 },
                thickness: 0.5,
                color: black,
            });

            if (value) {
                page.drawText(value, { x: lineX + 4, y: y, size: 11, font: font, color: black });
            }

            return lineX; // return where the line starts (for form field positioning)
        }

        // ---- Helper: draw wrapped text, returns final y ----
        function drawWrapped(text, x, y, maxW, size, f, col) {
            var words = text.split(' ');
            var line = '';
            var cy = y;
            var lh = size * 1.35;

            for (var i = 0; i < words.length; i++) {
                var test = line ? line + ' ' + words[i] : words[i];
                if (f.widthOfTextAtSize(test, size) > maxW && line) {
                    page.drawText(line, { x: x, y: cy, size: size, font: f, color: col || black });
                    line = words[i];
                    cy -= lh;
                } else {
                    line = test;
                }
            }
            if (line) {
                page.drawText(line, { x: x, y: cy, size: size, font: f, color: col || black });
                cy -= lh;
            }
            return cy;
        }

        // ================================================
        // 1. Header
        // ================================================

        centered('The Ultimate', H - 55, 9, font);
        centered('Driving Machine', H - 67, 9, font);

        page.drawText('CREDIT CARD AUTHORIZATION FORM', {
            x: ML, y: H - 97, size: 17, font: fontBold, color: black,
        });

        var verText = 'v1.0 081918';
        page.drawText(verText, {
            x: RX - font.widthOfTextAtSize(verText, 8),
            y: H - 93, size: 8, font: font, color: gray,
        });

        // ================================================
        // 2. Dealer fields (static, pre-filled)
        // ================================================

        var dy = H - 130;   // starting y for first field
        var sp = 27;         // vertical spacing

        fieldRow('BUYER NAME:',                                v.buyer,   dy);
        fieldRow('DEAL # (IF APPLICABLE):',                    v.deal,    dy - sp);
        fieldRow('STOCK # (IF APPLICABLE):',                   v.stock,   dy - sp * 2);
        fieldRow('PARTS/SERVICE INVOICE # (IF APPLICABLE):',   v.invoice, dy - sp * 3);
        fieldRow('DATE OF PURCHASE:',                          v.date,    dy - sp * 4);

        // Amount row — label includes $
        var amtLabel = 'AMOUNT DUE:  $';
        var amtLW = fontBold.widthOfTextAtSize(amtLabel, 10);
        page.drawText(amtLabel, { x: ML, y: dy - sp * 5, size: 10, font: fontBold, color: black });
        var amtLineX = ML + amtLW + 6;
        page.drawLine({
            start: { x: amtLineX, y: dy - sp * 5 - 3 },
            end:   { x: RX,       y: dy - sp * 5 - 3 },
            thickness: 0.5, color: black,
        });
        if (v.amount) {
            page.drawText(v.amount, { x: amtLineX + 4, y: dy - sp * 5, size: 11, font: font, color: black });
        }

        // ================================================
        // 3. Cardholder box
        // ================================================

        var boxTop = dy - sp * 6 - 16;
        var boxPad = 12;
        var bfSp = 27;  // spacing inside box
        var bfY = boxTop - 22;  // first field inside box

        // Draw cardholder labels + lines inside box area
        var chLabels = [
            'CARDHOLDER NAME:',
            'CARD TYPE:',
            'CARD #:',
            'EXPIRATION DATE:',
            'CVV #:',
            'CARDHOLDER ZIP CODE:',
            'CARDHOLDER PHONE NUMBER:',
        ];

        var boxInnerLeft = ML + boxPad;
        var boxInnerRight = RX - boxPad;
        var lineStarts = [];

        for (var i = 0; i < chLabels.length; i++) {
            var ly = bfY - i * bfSp;
            var lbl = chLabels[i];
            var lw = fontBold.widthOfTextAtSize(lbl, 10);
            page.drawText(lbl, { x: boxInnerLeft, y: ly, size: 10, font: fontBold, color: black });

            if (i !== 1) { // skip line for CARD TYPE (has checkboxes instead)
                var lx = boxInnerLeft + lw + 6;
                page.drawLine({
                    start: { x: lx, y: ly - 3 },
                    end:   { x: boxInnerRight, y: ly - 3 },
                    thickness: 0.5, color: black,
                });
                lineStarts.push({ x: lx, y: ly, w: boxInnerRight - lx, label: lbl });
            }
        }

        // Card type row — draw checkbox squares and labels
        var ctY = bfY - bfSp;  // CARD TYPE row y
        var ctLW = fontBold.widthOfTextAtSize('CARD TYPE:', 10);
        var cbX = boxInnerLeft + ctLW + 16;
        var cbLabels = ['MC', 'VISA', 'AMEX', 'DISCOVER'];
        var cbSpacing = 75;

        for (var c = 0; c < cbLabels.length; c++) {
            var cx = cbX + c * cbSpacing;
            // Draw empty checkbox square
            page.drawRectangle({
                x: cx, y: ctY - 2,
                width: 11, height: 11,
                borderWidth: 0.8,
                borderColor: black,
                color: PDFLib.rgb(1, 1, 1),
            });
            // Label after checkbox
            page.drawText(cbLabels[c], { x: cx + 15, y: ctY, size: 9, font: font, color: black });
        }

        // Box bottom
        var boxBottom = bfY - (chLabels.length - 1) * bfSp - 18;

        // Draw box border (4 lines)
        var bx1 = ML, bx2 = RX;
        page.drawLine({ start: { x: bx1, y: boxTop },    end: { x: bx2, y: boxTop },    thickness: 1, color: black });
        page.drawLine({ start: { x: bx1, y: boxBottom },  end: { x: bx2, y: boxBottom },  thickness: 1, color: black });
        page.drawLine({ start: { x: bx1, y: boxTop },    end: { x: bx1, y: boxBottom },  thickness: 1, color: black });
        page.drawLine({ start: { x: bx2, y: boxTop },    end: { x: bx2, y: boxBottom },  thickness: 1, color: black });

        // ================================================
        // 4. Signature line (below box)
        // ================================================

        var sigY = boxBottom - 22;
        var sigLabel = 'CARDHOLDER SIGNATURE/DATE:  X';
        var sigLW = fontBold.widthOfTextAtSize(sigLabel, 10);
        page.drawText(sigLabel, { x: ML, y: sigY, size: 10, font: fontBold, color: black });
        var sigLineX = ML + sigLW + 6;
        page.drawLine({
            start: { x: sigLineX, y: sigY - 3 },
            end:   { x: RX, y: sigY - 3 },
            thickness: 0.5, color: black,
        });

        // ================================================
        // 5. Create editable AcroForm fields (client section)
        // ================================================

        var form = pdf.getForm();
        var fieldH = 15;

        // Text fields (Cardholder Name, Card #, Exp, CVV, Zip, Phone)
        var editableFields = [
            { name: 'cardholder_name',  idx: 0 },
            { name: 'card_number',      idx: 2 },
            { name: 'expiration_date',  idx: 3 },
            { name: 'cvv',             idx: 4 },
            { name: 'zip_code',        idx: 5 },
            { name: 'phone_number',    idx: 6 },
        ];

        // lineStarts was built skipping CARD TYPE (index 1), so:
        // lineStarts[0] = Cardholder Name, [1] = Card #, [2] = Exp, [3] = CVV, [4] = Zip, [5] = Phone
        for (var f = 0; f < editableFields.length; f++) {
            var ef = editableFields[f];
            var ls = lineStarts[f];
            if (!ls) continue;

            var tf = form.createTextField(ef.name);
            tf.addToPage(page, {
                x: ls.x + 2,
                y: ls.y - 5,
                width: ls.w - 4,
                height: fieldH,
                borderWidth: 0,
                backgroundColor: PDFLib.rgb(0.96, 0.97, 1.0),
            });
        }

        // Card type checkboxes (editable)
        for (var cb = 0; cb < cbLabels.length; cb++) {
            var chk = form.createCheckBox('card_type_' + cbLabels[cb].toLowerCase());
            chk.addToPage(page, {
                x: cbX + cb * cbSpacing + 0.5,
                y: ctY - 1.5,
                width: 10, height: 10,
            });
        }

        // Signature field
        var sigField = form.createTextField('signature_date');
        sigField.addToPage(page, {
            x: sigLineX + 2,
            y: sigY - 5,
            width: RX - sigLineX - 4,
            height: fieldH,
            borderWidth: 0,
            backgroundColor: PDFLib.rgb(0.96, 0.97, 1.0),
        });

        // Update appearances so fields render in all viewers
        form.updateFieldAppearances(font);

        // ================================================
        // 6. Notes section
        // ================================================

        var noteY = sigY - 34;
        var noteLabel = 'NOTE: This form is ONLY to be used to record information in the following situations:';
        page.drawText('NOTE:', { x: ML, y: noteY, size: 7.5, font: fontBold, color: black });
        var afterNote = ML + fontBold.widthOfTextAtSize('NOTE: ', 7.5);
        noteY = drawWrapped(
            'This form is ONLY to be used to record information in the following situations:',
            afterNote, noteY, RX - afterNote, 7.5, font, black
        );
        noteY -= 4;

        // Bullet points
        for (var n = 0; n < NOTES.length; n++) {
            page.drawText('\u2022', { x: ML + 12, y: noteY, size: 7, font: font, color: black });
            noteY = drawWrapped(NOTES[n], ML + 24, noteY, RX - ML - 24, 7, font, black);
            noteY -= 3;
        }

        // Bold last bullet
        page.drawText('\u2022', { x: ML + 12, y: noteY, size: 7, font: fontBold, color: black });
        page.drawText(NOTES_BOLD, { x: ML + 24, y: noteY, size: 7, font: fontBold, color: black });

        // ================================================
        // Done — return bytes
        // ================================================

        return await pdf.save();
    }

    // ========================================
    // Download
    // ========================================

    function download(pdfBytes, buyerName) {
        var blob = new Blob([pdfBytes], { type: 'application/pdf' });
        var url = URL.createObjectURL(blob);
        var today = new Date().toISOString().split('T')[0];
        var safe = (buyerName || 'Document').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');

        var a = document.createElement('a');
        a.href = url;
        a.download = safe + '_' + today + '.pdf';
        a.style.display = 'none';
        document.body.appendChild(a);

        setTimeout(function () {
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 2000);
        }, 50);
    }

    // ========================================
    // Helpers
    // ========================================

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        return parts[1] + '/' + parts[2] + '/' + parts[0];
    }

    var toastTimer = null;
    function showToast(msg, type) {
        toastEl.textContent = msg;
        toastEl.className = 'toast show' + (type ? ' ' + type : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 4000);
    }

})();
