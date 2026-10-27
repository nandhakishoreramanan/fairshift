/* FairShift Camera QR Scanner - Supports BarcodeDetector with jsQR fallback */
(function () {
  'use strict';

  const { h, toast } = window.FS;

  /**
   * Sound beep on successful scan using Web Audio API
   */
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext not allowed or not supported
    }
  }

  /**
   * Open camera scanner modal
   * @param {Object} options
   * @param {string} options.title - Header text (e.g. "Scan Gate QR Poster")
   * @param {Function} options.onScan - Callback with raw scanned string
   */
  function openScanner({ title = 'Scan QR Code', onScan }) {
    let stream = null;
    let animId = null;
    let active = true;

    const video = h('video', { playsinline: true, muted: true, style: 'width:100%; border-radius:12px; background:#000;' });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const statusText = h('p', { class: 'muted small', style: 'text-align:center; margin-top:8px;' }, 'Point camera at the QR code...');

    function cleanup() {
      active = false;
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      modal.remove();
    }

    // Fallback file input for devices without WebRTC camera access
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/*',
      capture: 'environment',
      style: 'display:none;',
      onchange: (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, img.width, img.height);
            let code = null;
            if (window.jsQR) {
              const res = window.jsQR(imgData.data, imgData.width, imgData.height);
              if (res) code = res.data;
            }
            if (code) {
              beep();
              cleanup();
              onScan(code);
            } else {
              toast('No QR code found in photo. Please try again.', 'warn');
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      },
    });

    const fileBtn = h(
      'button',
      {
        class: 'btn btn-secondary',
        type: 'button',
        style: 'margin-top:8px;',
        onclick: () => fileInput.click(),
      },
      '📁 Upload QR Photo instead',
    );

    const closeBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: cleanup }, '✕ Close Camera');

    const modal = h(
      'div',
      {
        class: 'scanner-modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title,
      },
      h(
        'div',
        { class: 'scanner-modal-body card' },
        h('div', { class: 'row space', style: 'margin-bottom:10px;' }, h('h3', {}, `📷 ${title}`), closeBtn),
        h('div', { class: 'viewfinder-container' }, video, h('div', { class: 'viewfinder-reticle' })),
        statusText,
        h('div', { class: 'row space', style: 'margin-top:12px;' }, fileBtn, closeBtn),
        fileInput,
      ),
    );

    document.body.append(modal);

    // Native BarcodeDetector if available
    let barcodeDetector = null;
    if ('BarcodeDetector' in window) {
      try {
        barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        barcodeDetector = null;
      }
    }

    async function tick() {
      if (!active) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        let detected = null;

        if (barcodeDetector) {
          try {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              detected = barcodes[0].rawValue;
            }
          } catch {
            // fallback to jsQR
          }
        }

        if (!detected && window.jsQR) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = window.jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (qr && qr.data) {
            detected = qr.data;
          }
        }

        if (detected) {
          beep();
          cleanup();
          onScan(detected);
          return;
        }
      }

      animId = requestAnimationFrame(tick);
    }

    // Start video stream
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        .then((s) => {
          stream = s;
          video.srcObject = s;
          video.setAttribute('playsinline', 'true');
          video.play().then(() => {
            animId = requestAnimationFrame(tick);
          });
        })
        .catch((err) => {
          console.warn('Camera access denied or unavailable:', err);
          statusText.textContent = 'Camera not available. You can upload a photo of the QR code:';
          video.style.display = 'none';
        });
    } else {
      statusText.textContent = 'Camera not supported on this browser. Upload a photo:';
      video.style.display = 'none';
    }
  }

  window.FS_Scanner = { openScanner };
})();
