/* 山景照：把 3D 拍下的畫面排進社群貼文風格的相框，並管理這一趟的相簿。
   只是「感覺像」社群貼文，帳號是遊戲自己的，角落會標明是遊戲畫面。 */
(function () {
  const DH = (window.DH = window.DH || {});
  const $ = (id) => document.getElementById(id);

  const W = 1080;
  const HEADER = 124;
  const FOOTER = 226;
  const FONT = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'sans-serif';
  const INK = '#262626';
  const SOFT = '#7a7168';

  const CAPTIONS = {
    trailhead: '從這裡開始，先把今天的路想清楚。',
    forest: '在林子裡喘口氣，水也記得喝。',
    ridge: '風很大，景也很大。',
    summit: '站上來了。平安下山才算走完。',
    descent: '下山的路，一樣一步一步走。',
  };
  const PLAIN_CAPTION = '這趟走到這裡。';

  function path(c, d, scale, x, y) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    const p = new Path2D(d);
    return { p, done: () => c.restore() };
  }
  /* 通用圖示：心、對話框、紙飛機，都是自己畫的簡單造型 */
  const ICON = {
    heart: 'M12 21s-8.5-5.3-10.3-10.2C.5 7.2 2.8 4 6.2 4 8.6 4 10.6 5.3 12 7.3 13.4 5.3 15.4 4 17.8 4c3.4 0 5.7 3.2 4.5 6.8C20.5 15.7 12 21 12 21z',
    bubble: 'M12 3c5.5 0 10 3.9 10 8.8 0 4.8-4.5 8.7-10 8.7-1.3 0-2.6-.2-3.7-.6L3 21.5l1.6-4.6C3 15.4 2 13.7 2 11.8 2 6.9 6.5 3 12 3z',
    plane: 'M22 3 2 10.5l7.6 3.1L13 21.5 22 3zM9.6 13.6 22 3',
  };
  function drawIcon(c, name, x, y, size, fill) {
    const { p, done } = path(c, ICON[name], size / 24, x, y);
    if (fill) {
      c.fillStyle = fill;
      c.fill(p);
    } else {
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.lineJoin = 'round';
      c.stroke(p);
    }
    done();
  }

  function fitFont(c, text, weight, size, maxWidth) {
    let s = size;
    do {
      c.font = `${weight} ${s}px ${FONT}`;
      s -= 2;
    } while (c.measureText(text).width > maxWidth && s > 24);
  }

  const altText = (alt) => `海拔 ${Math.round(alt).toLocaleString('en-US')} 公尺`;

  /* info = { mountain, season, altitude, section, plain } */
  function compose(src, info) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = HEADER + W + FOOTER;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff';
    c.fillRect(0, 0, cv.width, cv.height);

    /* 帳號列 */
    c.fillStyle = '#2f6b52';
    c.beginPath();
    c.arc(70, HEADER / 2, 40, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fffdf6';
    c.beginPath();
    c.moveTo(44, HEADER / 2 + 20);
    c.lineTo(66, HEADER / 2 - 20);
    c.lineTo(78, HEADER / 2);
    c.lineTo(86, HEADER / 2 - 10);
    c.lineTo(98, HEADER / 2 + 20);
    c.closePath();
    c.fill();
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = INK;
    c.font = `800 36px ${FONT}`;
    c.fillText('數位登山', 128, HEADER / 2 - 20);
    c.fillStyle = SOFT;
    c.font = `500 28px ${FONT}`;
    c.fillText(`${info.mountain}｜${info.season}`.replace(/｜$/, ''), 128, HEADER / 2 + 22);
    c.fillStyle = INK;
    [0, 1, 2].forEach((i) => {
      c.beginPath();
      c.arc(W - 88 + i * 20, HEADER / 2, 5, 0, Math.PI * 2);
      c.fill();
    });

    /* 照片：來源不是正方形時裁中間 */
    const side = Math.min(src.width, src.height);
    c.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, HEADER, W, W);

    /* 山名與海拔壓在照片左下，底下墊一層漸層才讀得到 */
    const grad = c.createLinearGradient(0, HEADER + W - 300, 0, HEADER + W);
    grad.addColorStop(0, 'rgba(20,28,32,0)');
    grad.addColorStop(1, 'rgba(20,28,32,.62)');
    c.fillStyle = grad;
    c.fillRect(0, HEADER + W - 300, W, 300);
    c.fillStyle = '#fff';
    c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(0,0,0,.45)';
    c.shadowBlur = 12;
    fitFont(c, info.mountain, 800, 84, W - 96);
    c.fillText(info.mountain, 48, HEADER + W - 92);
    c.font = `700 44px ${FONT}`;
    c.fillText(altText(info.altitude), 48, HEADER + W - 34);
    c.shadowBlur = 0;

    /* 互動列與說明 */
    const y = HEADER + W + 22;
    drawIcon(c, 'heart', 40, y, 54, info.plain ? null : '#e5484d');
    drawIcon(c, 'bubble', 118, y, 54);
    drawIcon(c, 'plane', 196, y, 54);
    c.textBaseline = 'middle';
    c.fillStyle = INK;
    c.font = `800 30px ${FONT}`;
    c.fillText('數位登山', 40, y + 94);
    const nameWidth = c.measureText('數位登山').width;
    c.font = `500 30px ${FONT}`;
    const caption = info.plain ? PLAIN_CAPTION : CAPTIONS[info.section] || PLAIN_CAPTION;
    c.fillText(caption, 40 + nameWidth + 14, y + 94);
    c.fillStyle = SOFT;
    c.font = `500 25px ${FONT}`;
    c.fillText('遊戲畫面｜山景為示意，不是實際地形', 40, y + 146);
    return cv;
  }

  function fileName(photo) {
    return `數位登山-${photo.info.mountain}-${Math.round(photo.info.altitude)}m.png`.replace(/[\\/:*?"<>|\s]+/g, '');
  }
  function download(photo) {
    return new Promise((resolve, reject) => {
      photo.canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('無法輸出圖片'));
          return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName(photo);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        resolve();
      }, 'image/png');
    });
  }

  const altLabel = (photo) => `${photo.info.mountain}，${altText(photo.info.altitude)}`;

  function paintInto(target, photo) {
    target.width = photo.canvas.width;
    target.height = photo.canvas.height;
    target.getContext('2d').drawImage(photo.canvas, 0, 0);
    target.setAttribute('aria-label', `山景照：${altLabel(photo)}`);
  }

  DH.photo = {
    LIMIT: 6,
    compose,
    download,
    fileName,

    /* 拍照後的全螢幕相框 */
    openViewer(photo, handlers) {
      paintInto($('photo-frame'), photo);
      $('photo-count').textContent = `第 ${handlers.index} 張，結束時可以下載`;
      $('photo-again').onclick = (e) => {
        e.stopPropagation();
        handlers.again();
      };
      $('photo-close').onclick = (e) => {
        e.stopPropagation();
        handlers.close();
      };
      $('photo-mode').onclick = handlers.close;
      $('photo-view').hidden = false;
      $('photo-again').focus({ preventScroll: true });
    },
    showMode(on) {
      $('photo-mode').hidden = !on;
      ['photo-mode', 'photo-again', 'photo-close'].forEach((id) => { $(id).onclick = null; });
      $('photo-view').hidden = true;
      $('photo-flash').classList.remove('go');
      if (on) $('photo-mode').focus({ preventScroll: true });
      if (!on) {
        $('photo-frame').width = $('photo-frame').height = 0;
      }
    },
    flash() {
      const f = $('photo-flash');
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
    },

    /* 結局頁的相簿 */
    showAlbum(photos) {
      const box = $('ending-photos');
      box.hidden = !photos.length;
      const big = $('album-big');
      const thumbs = $('album-thumbs');
      thumbs.textContent = '';
      $('album-save').onclick = null;
      big.width = big.height = 0;
      big.removeAttribute('aria-label');
      if (!photos.length) return;
      let current = photos[photos.length - 1];
      const pick = (photo) => {
        current = photo;
        paintInto(big, photo);
        Array.from(thumbs.children).forEach((b, i) => {
          b.setAttribute('aria-pressed', String(photos[i] === photo));
        });
      };
      photos.forEach((photo, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'album-thumb';
        b.setAttribute('aria-label', `第 ${i + 1} 張：${altLabel(photo)}`);
        const mini = document.createElement('canvas');
        mini.width = 144;
        mini.height = 180;
        mini.getContext('2d').drawImage(photo.canvas, 0, 0, 144, 180);
        b.appendChild(mini);
        b.addEventListener('click', () => pick(photo));
        thumbs.appendChild(b);
      });
      thumbs.hidden = photos.length < 2;
      pick(current);
      $('album-save').onclick = () => download(current).catch(() => DH.ui.toast('照片下載失敗，請再試一次', 'warn'));
    },
  };
})();
