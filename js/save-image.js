/* 存圖：桌機直接下載；手機與 App 內建瀏覽器（LINE、FB、IG）多半不理會 a.download，
   改用系統分享面板存到相簿，不支援時再開一層大圖讓玩家長按儲存。 */
(function () {
  const DH = (window.DH = window.DH || {});

  /* 回傳值：'download'｜'share'｜'cancel'（使用者自己取消分享）｜'overlay' */
  const MOBILE_UA = /iPhone|iPad|iPod|Android|Line\/|FBAN|FBAV|Instagram/i;

  function isMobile() {
    const nav = window.navigator;
    if (MOBILE_UA.test(nav.userAgent || '')) return true;
    /* iPadOS 預設要桌面版網頁，UA 寫的是 Mac，只能從觸控點數分辨 */
    return /Macintosh/.test(nav.userAgent || '') && nav.maxTouchPoints > 1;
  }

  /* 畫布被跨網域圖片污染時 toBlob 會同步丟 SecurityError，統一轉成可讀的錯誤 */
  function canvasToBlob(canvas, type = 'image/png') {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('無法輸出圖片'))), type);
      } catch (e) {
        reject(e && e.name === 'SecurityError' ? new Error('圖片含有外部素材，瀏覽器不允許存檔') : e);
      }
    });
  }

  function downloadLink(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    /* Firefox 與部分 Safari 版本要求連結真的在文件裡才會觸發下載 */
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function tryShare(blob, filename) {
    const nav = window.navigator;
    if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || typeof File !== 'function') return null;
    const file = blob instanceof File && blob.name === filename ? blob : new File([blob], filename, { type: blob.type || 'image/png' });
    if (!nav.canShare({ files: [file] })) return null;
    try {
      await nav.share({ files: [file] });
      return 'share';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancel';
      /* 例如等圖片輸出太久、失去使用者手勢而被拒，就改用長按存圖 */
      console.warn('分享面板開不起來，改用長按存圖', e);
      return null;
    }
  }

  const readDataURL = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('無法讀取圖片'));
    r.readAsDataURL(blob);
  });

  let overlay = null;
  function closeOverlay() {
    if (!overlay) return;
    const { el, back, onKey } = overlay;
    overlay = null;
    document.removeEventListener('keydown', onKey, true);
    el.remove();
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }

  /* 全螢幕大圖：LINE、FB 的 WebView 長按 blob 網址常常存不下來，用 data URL 最穩 */
  async function showOverlay(blob, filename) {
    closeOverlay();
    const src = await readDataURL(blob);
    const back = document.activeElement;
    const el = document.createElement('div');
    el.id = 'save-sheet';
    el.className = 'save-sheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'save-sheet-tip');
    el.innerHTML = `
      <div class="save-sheet-box">
        <p class="save-sheet-tip" id="save-sheet-tip">長按圖片即可儲存</p>
        <p class="save-sheet-sub">選「加入照片」或「儲存影像」，就會存到手機相簿</p>
        <img class="save-sheet-img" alt="">
        <button type="button" class="btn btn-primary save-sheet-close">關閉</button>
      </div>`;
    const img = el.querySelector('img');
    img.src = src;
    img.alt = filename.replace(/\.png$/i, '');
    el.querySelector('.save-sheet-close').addEventListener('click', closeOverlay);
    el.addEventListener('click', (e) => {
      if (e.target === el) closeOverlay();
    });
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(el);
    overlay = { el, back, onKey };
    el.querySelector('.save-sheet-close').focus({ preventScroll: true });
    return 'overlay';
  }

  async function saveImage(blob, filename) {
    if (!blob || !blob.size) throw new Error('圖片是空的');
    if (!isMobile()) {
      downloadLink(blob, filename);
      return 'download';
    }
    return (await tryShare(blob, filename)) || showOverlay(blob, filename);
  }

  DH.saveImage = saveImage;
  Object.assign(saveImage, { isMobile, canvasToBlob, close: closeOverlay });
})();
