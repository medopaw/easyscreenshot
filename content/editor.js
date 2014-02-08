/* vim: set ts=2 et sw=2 tw=80: */
window.ssInstalled = true;
const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

(function() {

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://easyscreenshot/snapshot.js');

var Utils = {
  parse: function(element) {
    return {
      x: parseInt(element.style.left, 10),
      y: parseInt(element.style.top, 10),
      w: parseInt(element.style.width, 10),
      h: parseInt(element.style.height, 10),
    }
  },
  qs: function(selector) document.querySelector(selector),
  contains: function(node, otherNode) {
    if (node.contains) {
      return node.contains(otherNode);
    } else {
      // not really equivalent, but enough here
      return [].some.call(node.children, function(n) n == otherNode);
    }
  },
  // Copy all attributes of one object into another. Very useful.
  merge: function(mergeTo, mergeFrom) {
    var bothAreObjects = [mergeTo, mergeFrom].every(function(value) {
      return typeof value == 'object';
    });
    if (bothAreObjects) {
      Object.keys(mergeFrom).forEach(function(key) {
        mergeTo[key] = mergeFrom[key];
      });
    }
    // Returned value is useful for anonymous objects
    return mergeTo;
  },
  interrupt: function(callback) {
    setTimeout(callback, 0);
  },
  // Simple downloading tool function
  download: function(url, path, onsuccess, onerror, oncancel) {
    var jsm = {};
    try {
      Cu.import('resource://gre/modules/Downloads.jsm', jsm);
    } catch(ex) {}

    if (jsm.Downloads && jsm.Downloads.getList) {
      jsm.Downloads.getList(jsm.Downloads.ALL).then(function(aDownloadList) {
        jsm.Downloads.createDownload({
          source: url,
          target: path,
          launchWhenSucceeded: false
        }).then(function(aDownload) {
          aDownloadList.add(aDownload);
          aDownload.start().then(function() {
            if (aDownload.succeeded && onsuccess) {
              onsuccess(aDownload);
            }
          }, function() {
            if (aDownload.error && onerror) {
              onerror(aDownload);
            } else if (aDownload.canceled && oncancel) {
              oncancel(aDownload);
            }
          }).then(null, Cu.reportError);
        }).then(null, Cu.reportError);
      });
    } else {
      var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
      var source = ios.newURI(url, 'utf8', null);
      var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
      file.initWithPath(path);
      var target = ios.newFileURI(file);

      var persist = Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].
              createInstance(Ci.nsIWebBrowserPersist);
      persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES
                 | Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

      var downloadManager = Cc['@mozilla.org/download-manager;1'].getService(Ci.nsIDownloadManager);
      var download = downloadManager.addDownload(Ci.nsIDownload.DOWNLOAD_TYPE_DOWNLOAD,
        source, target, '', null, null, null, persist, null);
      var downloadProgressListener = {
        complete: [
          Ci.nsIDownloadManager.DOWNLOAD_FINISHED,
          Ci.nsIDownloadManager.DOWNLOAD_FAILED,
          Ci.nsIDownloadManager.DOWNLOAD_CANCELED,
          Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL,
          Ci.nsIDownloadManager.DOWNLOAD_DIRTY,
          Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY
        ],
        success: [
          Ci.nsIDownloadManager.DOWNLOAD_FINISHED
        ],
        error: [
          Ci.nsIDownloadManager.DOWNLOAD_FAILED,
          Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL,
          Ci.nsIDownloadManager.DOWNLOAD_DIRTY,
          Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY
        ],
        cancel: [
          Ci.nsIDownloadManager.DOWNLOAD_CANCELED,
          Ci.nsIDownloadManager.DOWNLOAD_PAUSED
        ],
        status: function(state) {
          var status = ['success', 'error', 'cancel'];
          var result = 'unknown';
          for (var i = 0; i < status.length; i++) {
            if (this[status[i]].indexOf(state) >= 0) {
              return status[i];
            }
          }
          return 'unknown';
        },
        onDownloadStateChange: function(a, aDownload) {
          if (decodeURI(aDownload.source.spec) == decodeURI(source.spec) &&
            decodeURI(aDownload.targetFile.path) == decodeURI(target.path) &&
            this.complete.indexOf(aDownload.state) >= 0) {
            downloadManager.removeListener(downloadProgressListener);
            switch (this.status(aDownload.state)) {
              case 'success': {
                if (onsuccess) {
                  onsuccess(aDownload);
                }
                break;
              }
              case 'error': {
                if (onerror) {
                  onerror(aDownload);
                }
                break;
              }
              case 'cancel': {
                if (oncancel) {
                  oncancel(aDownload);
                }
                break;
              }
              default: {
                break;
              }
            }
          }
        }
      };
      downloadManager.addListener(downloadProgressListener);
      persist.progressListener = download;

      persist.saveURI(source, null, null, null, null, target, null);
    }
  },
  // Simple string bundle tool object
  strings: {
    _bundle: Services.strings.createBundle('chrome://easyscreenshot/locale/easyscreenshot.properties'),
    get: function(name, args) {
      if (args) {
        args = Array.prototype.slice.call(arguments, 1);
        return this._bundle.formatStringFromName(name, args, args.length);
      } else {
        return this._bundle.GetStringFromName(name);
      }
    }
  },
  // Simple preference tool object
  prefs: {
    _branch: Services.prefs.getBranch('extensions.easyscreenshot.'),
    // Use typeof paramter to determine the pref type
    _type: function(value) {
      return {
        boolean: 'Bool',
        number: 'Int',
        string: 'Char',
        object: 'Complex'
      }[typeof value];
    },
    _getter: function(value) {
      return {
        boolean: 'getBoolPref',
        number: 'getIntPref',
        string: 'getCharPref',
        object: 'getComplexPref'
      }[typeof value];
    },
    _setter: function(value) {
      return {
        boolean: 'setBoolPref',
        number: 'setIntPref',
        string: 'setCharPref',
        object: 'setComplexPref'
      }[typeof value];
    },
    get: function(name, defaultValue) {
      var type = this._type(defaultValue);
      var getter = this._getter(defaultValue);
      var value;

      switch (type) {
        case 'Complex': {
          try {
            value = this._branch.getComplexValue(name, defaultValue.type);
          } catch (ex) {
            this.set(name, defaultValue);
            value = defaultValue.value;
          }
        }
        case 'Bool':
        case 'Int':
        case 'Char':
        default: {
          try {
            value = this._branch[getter](name);
          } catch (ex) {
            this.set(name, defaultValue);
            value = defaultValue;
          }
        }
      }

      return value;
    },
    set: function(name, newValue) {
      var type = this._type(newValue);
      var setter = this._setter(newValue);

      switch (type) {
        case 'Complex': {
          this._branch.setComplexValue(name, newValue.type, newValue.value);
        }
        case 'Bool':
        case 'Int':
        case 'Char':
        default: {
          this._branch[setter](name, newValue);
        }
      }
    },
    observe: function(name, callback) {
      this._branch.addObserver(name, {observe: callback}, false);
    }
  },
  notification: {
    check: function() {
      if (Notification && Notification.permission !== 'granted') {
        Notification.requestPermission(function(status) {
          if (Notification.permission !== status) {
            Notification.permission = status;
          }
        });
      }
    },
    notify: function(msg, options) {
      if (Notification && Notification.permission === 'granted') {
        new Notification(msg, Utils.merge({
          tag: 'easyscreenshot',
          icon: 'chrome://easyscreenshot/skin/image/easyscreenshot.png'
        }, options || {}));
      }
    }
  },
  // e.g. (#FFFFFF, 0.5) => (255, 255, 255, 0.5)
  hex2rgba: function(hex, alpha) {
    if (/^#/.test(hex) && hex.length == 7 && alpha !== undefined) {
      return 'rgba('
        + parseInt(hex.slice(1, 3), 16) + ','
        + parseInt(hex.slice(3, 5), 16) + ','
        + parseInt(hex.slice(5, 7), 16) + ','
        + alpha + ')';
    }
    return hex;
  }
};

var CropOverlay = {
  _listeners: {},
  _overlay: {},
  _status: {
    isMoving: false,
    isResizing: false,
    isNew: false,
  },
  _dblclick: function(evt) {
    Editor.current = {id: 'crop'};
  },
  _display: function(x, y, w, h, ix, iy, iw, ih) {
    this._displayItem(this._overlay.overlay, x, y, w, h);
    this._displayItem(this._overlay.top, 0, 0, w, iy);
    this._displayItem(this._overlay.right, ix + iw, iy, w - (ix + iw), ih);
    this._displayItem(this._overlay.bottom, 0, iy + ih, w, h - (iy + ih));
    this._displayItem(this._overlay.left, 0, iy, ix, ih);
    this._displayItem(this._overlay.target, (iw ? ix : -5), (ih ? iy: -5), iw, ih);
    this._overlay.overlay.style.display = '';
  },
  _displayItem: function(element, x, y, w, h) {
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.width = w + 'px';
    element.style.height = h + 'px';
  },
  _hide: function() {
    this._overlay.overlay.style.display = 'none';
  },
  _mousedown: function(evt) {
    var { x, y } = Utils.parse(this._overlay.overlay);
    var { x:ix, y:iy } = Utils.parse(this._overlay.target);
    var rx = evt.pageX - x;
    var ry = evt.pageY - y;
    if (this._overlay.target == evt.target) {
      this._status.isMoving = [rx - ix, ry - iy];
    } else if (Utils.contains(this._overlay.target, evt.target)) {
      this._status.isResizing = evt.target.id;
    } else {
      this._status.isNew = [rx, ry];
    }
    document.addEventListener('mousemove', this._listeners.mousemove, false);
    document.addEventListener('mouseup', this._listeners.mouseup, false);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _mousemove: function(evt) {
    var { x, y, w, h } = Utils.parse(this._overlay.overlay);
    var { x:ix, y:iy, w:iw, h:ih } = Utils.parse(this._overlay.target);
    var rx = evt.pageX - x;
    var ry = evt.pageY - y;
    var nix, niy, nih, niw;
    if (this._status.isNew) {
      var startXY = this._status.isNew;
      rx = Math.min(Math.max(rx, 0), w);
      ry = Math.min(Math.max(ry, 0), h);
      nix = Math.min(startXY[0], rx);
      niy = Math.min(startXY[1], ry);
      nih = Math.abs(ry - startXY[1]);
      niw = Math.abs(rx - startXY[0]);
    } else if (this._status.isMoving) {
      var origXY = this._status.isMoving;
      nix = rx - origXY[0];
      niy = ry - origXY[1];
      nih = ih;
      niw = iw;
      nix = Math.min(Math.max(nix, 0), w - niw);
      niy = Math.min(Math.max(niy, 0), h - nih);
    } else if (this._status.isResizing) {
      switch (this._status.isResizing) {
        case 'ctrlnw':
          nix = Math.min(Math.max(rx, 0), ix + iw - 50);
          niy = Math.min(Math.max(ry, 0), iy + ih - 50);
          nih = ih - (niy - iy);
          niw = iw - (nix - ix);
          break;
        case 'ctrlne':
          nix = ix;
          niy = Math.min(Math.max(ry, 0), iy + ih - 50);
          nih = ih - (niy - iy);
          niw = Math.min(Math.max(rx - nix, 50), w - nix);
          break;
        case 'ctrlse':
          nix = ix;
          niy = iy;
          nih = Math.min(Math.max(ry - niy, 50), h - niy);
          niw = Math.min(Math.max(rx - nix, 50), w - nix);
          break;
        case 'ctrlsw':
          nix = Math.min(Math.max(rx, 0), ix + iw - 50);
          niy = iy;
          nih = Math.min(Math.max(ry - niy, 50), h - niy);
          niw = iw - (nix - ix);
          break;
        default:
          break;
      }
    }
    this._display(x, y, w, h, nix, niy, niw, nih);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _mouseup: function(evt) {
    this._status = {
      isMoving: false,
      isResizing: false,
      isNew: false,
    }
    document.removeEventListener('mousemove', this._listeners.mousemove, false);
    document.removeEventListener('mouseup', this._listeners.mouseup, false);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _refreshImageData: function() {
    var { x, y, w, h } = Utils.parse(this._overlay.target);
    if (!h || !w) {
      return;
    }
    Editor.canvasData = Editor.ctx.getImageData(x, y, w, h);
  },
  init: function() {
    this._overlay = {
      overlay: Utils.qs('#crop'),
      top:   Utils.qs('#croptop'),
      right:   Utils.qs('#cropright'),
      bottom:  Utils.qs('#cropbottom'),
      left:  Utils.qs('#cropleft'),
      target:  Utils.qs('#croptarget'),
    };
    this._listeners['dblclick'] = this._dblclick.bind(this);
    this._listeners['mousedown'] = this._mousedown.bind(this);
    this._listeners['mousemove'] = this._mousemove.bind(this);
    this._listeners['mouseup'] = this._mouseup.bind(this);
    this._hide();
  },
  reposition: function() {
    if (this._overlay.overlay && Editor.canvas) {
      this._overlay.overlay.style.left = Editor.canvas.getBoundingClientRect().left + 'px';
    }
  },
  start: function(x, y, w, h) {
    this._display(x, y, w, h, 0, 0, 0, 0);
    this._overlay.overlay.addEventListener('dblclick', this._listeners.dblclick, false);
    this._overlay.overlay.addEventListener('mousedown', this._listeners.mousedown, false);
  },
  cancel: function() {
    this._hide();
    this._overlay.overlay.removeEventListener('dblclick', this._listeners.dblclick, false);
    this._overlay.overlay.removeEventListener('mousedown', this._listeners.mousedown, false);
  },
  stop: function() {
    this._refreshImageData();
    Editor.updateHistory();
  }
};

var BaseControl = {
  _canvas: null,
  _ctx: null,
  _listeners: {},
  _origRect: null,
  _rect: null,
  _startxy: null,
//         _dir's value
//
//          |
//         2  |  1
//       -----------
//         3  |  4
//          |
//

  _dir: 1,
  _mousedown: function(evt) {
    var rx = evt.pageX - this._origRect[0];
    var ry = evt.pageY - this._origRect[1];
    this._startxy = [rx, ry];
    document.addEventListener('mousemove', this._listeners.mousemove, false);
    document.addEventListener('mouseup', this._listeners.mouseup, false);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _mousemove: function(evt) {
    var x = this._origRect[0];
    var y = this._origRect[1];
    var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
    var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
    var x = Math.min(rx, this._startxy[0]);
    var y = Math.min(ry, this._startxy[1]);
    var w = Math.abs(rx - this._startxy[0]);
    var h = Math.abs(ry - this._startxy[1]);
    if (evt.shiftKey) {
      w = Math.min(w, h);
      h = Math.min(w, h);
      if (x != this._startxy[0]) {
        x = this._startxy[0] - w;
      }
      if (y != this._startxy[1]) {
        y = this._startxy[1] - h;
      }
    }
    if(rx > this._startxy[0] && ry < this._startxy[1])
      this._dir = 1;
    else if(rx < this._startxy[0] && ry < this._startxy[1])
      this._dir = 2;
    else if(rx < this._startxy[0] && ry > this._startxy[1])
      this._dir = 3;
    else if(rx > this._startxy[0] && ry > this._startxy[1])
      this._dir = 4;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._rect = [x, y, w, h];
    var dx = Math.min(this.lineWidth, x);
    var dy = this.lineWidth;
    var dw = Math.min(x + w + this.lineWidth, this._origRect[2]) - x + dx;
    var dh = Math.min(y + h + this.lineWidth, this._origRect[3]) - y + dy;
    x += this._origRect[0];
    y += this._origRect[1];
    this._canvas.style.left = x - dx + 'px';
    this._canvas.style.top = y - dy + 'px';
    this._canvas.left = x - dx;
    this._canvas.top = y - dy;
    this._canvas.width = dw;
    this._canvas.height = dh;
    this._ctx.lineWidth = this.lineWidth;
    this._ctx.strokeStyle = Color.selected;
    this._ctx.save();
    this._stroke(this._ctx, dx, dy, w, h);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _mouseup: function(evt) {
    document.removeEventListener('mousemove', this._listeners.mousemove, false);
    document.removeEventListener('mouseup', this._listeners.mouseup, false);
    evt.stopPropagation();
    evt.preventDefault();
    this._refreshImageData();
    Editor.updateHistory();
  },
  _refreshImageData: function() {
    var [x, y, w, h] = this._rect;
    Editor.ctx.lineWidth = this.lineWidth;
    Editor.ctx.strokeStyle = Color.selected;
    Editor.ctx.save();
    this._stroke(Editor.ctx, x, y, w, h);
  },
  _stroke: function(ctx, x, y, w, h) {
  },
  get lineWidth() {
    return Utils.prefs.get('lineWidth', 6);
  },
  set lineWidth(value) {
    if (!isNaN(value)) {
      Utils.prefs.set('lineWidth', Number(value));
    }
  },
  get fontSize() {
    return Utils.prefs.get('fontSize', 18);
  },
  set fontSize(value) {
    if (!isNaN(value)) {
      Utils.prefs.set('fontSize', Number(value));
    }
  },
  init: function() {
    this._listeners['mousedown'] = this._mousedown.bind(this);
    this._listeners['mousemove'] = this._mousemove.bind(this);
    this._listeners['mouseup'] = this._mouseup.bind(this);
  },
  start: function(x, y, w, h, canvasId, evtName) {
    if (!evtName) {
      evtName = 'mousedown';
    }
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._canvas.id = canvasId;
    Editor.canvas.className = canvasId;
    document.body.appendChild(this._canvas);
    this._origRect = [x, y, w, h];

    this._canvas.style.left = x + 'px';
    this._canvas.style.top = y + 'px';
    this._canvas.width = 0;
    this._canvas.height = 0;
    this._canvas.addEventListener(evtName, this._listeners[evtName], false);
    Editor.canvas.addEventListener(evtName, this._listeners[evtName], false);
  },
  cancel: function() {
    this._canvas.removeEventListener('mousedown', this._listeners.mousedown, false);
    Editor.canvas.removeEventListener('mousedown', this._listeners.mousedown, false);
    document.body.removeChild(this._canvas);
  }
};

var Rect = {
  __proto__: BaseControl,
  _canvas: null,
  _ctx: null,
  _listeners: {},
  _origRect: null,
  _rect: null,
  _startxy: null,
  _stroke: function(ctx, x, y, w, h) {
    ctx.strokeRect(x, y, w, h);
  },
  start: function(x, y, w, h) {
    this.__proto__.start.bind(this)(x, y, w, h, 'rectcanvas');
  }
};

var Line = {
  __proto__: BaseControl,
  _canvas: null,
  _ctx: null,
  _listeners: {},
  _origRect: null,
  _rect: null,
  _startxy: null,
  _stroke: function(ctx, x, y, w, h) {
    ctx.beginPath();
    var dir = this._dir;
    if(dir == 1 || dir == 3){
      ctx.moveTo(x, y+h);
      ctx.lineTo(x+w, y);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x+w, y+h);
    }
    ctx.stroke();
    ctx.closePath();
  },
  start: function(x, y, w, h) {
    this.__proto__.start.bind(this)(x, y, w, h, 'linecanvas');
  }
};

var Circ = {
  __proto__: BaseControl,
  _canvas: null,
  _ctx: null,
  _listeners: {},
  _origRect: null,
  _rect: null,
  _startxy: null,
  _stroke: function(ctx, x, y, w, h) {
    this._strokeCirc(ctx, x, y, w, h);
  },
  _strokeCirc: function(ctx, x, y, w, h) {
    // see http://www.whizkidtech.redprince.net/bezier/circle/kappa/
    var br = (Math.sqrt(2) - 1) * 4 / 3;
    var bx = w * br / 2;
    var by = h * br / 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.bezierCurveTo(x + w / 2 + bx, y, x + w, y + h / 2 - by, x + w, y + h / 2);
    ctx.bezierCurveTo(x + w, y + h / 2 + by, x + w / 2 + bx, y + h, x + w / 2, y + h);
    ctx.bezierCurveTo(x + w / 2 - bx, y + h, x, y + h / 2 + by, x, y + h / 2);
    ctx.bezierCurveTo(x, y + h / 2 - by, x + w / 2 - bx, y, x + w / 2, y);
    ctx.closePath();
    ctx.stroke();
  },
  start: function(x, y, w, h) {
    this.__proto__.start.bind(this)(x, y, w, h, 'circcanvas');
  }
};

var TextInput = {
  __proto__: BaseControl,
  _canvas: null,
  _ctx: null,
  _input: null,
  _listeners: {},
  _origRect: null,
  _size: {},
  _refreshSize: function() {
    // Factor 1.2 per character looks good
    const factor = 1.2;
    // Initial size set to 2x1 characters
    this._size.width = Math.ceil(BaseControl.fontSize * factor * 2);
    this._size.height = Math.ceil(BaseControl.fontSize * factor);
  },
  _refreshImageData: function() {
    var textRect = this._input.getBoundingClientRect();

    // Textarea borders are not needed when capturing screen
    var x = textRect.left + 1;
    var y = textRect.top + 1;
    var w = textRect.width - 2;
    var h = textRect.height - 2;

    this._canvas.width = w;
    this._canvas.height = h;

    // Hide floatbar temporarily to avoid overlapping
    Editor.floatbar.hide();
    this._ctx.drawWindow(window.content, x + window.scrollX, y + window.scrollY, w, h, 'rgb(255,255,255)');
    // Show floatbar again after capturing text area
    Editor.floatbar.show();

    var canvasRect = Editor.canvas.getBoundingClientRect();
    Editor.ctx.putImageData(this._ctx.getImageData(0, 0, w, h), x - canvasRect.left, y - canvasRect.top);
  },
  _blur: function() {
    if (!/^\s*$/.test(this._input.value)) {
      this._refreshImageData();
      Editor.updateHistory();
    }
    this._hide();
  },
  _click: function(evt) {
    this._input.blur();
    this._input.style.fontSize = BaseControl.fontSize + 'px';
    this._input.style.left = evt.pageX + 'px';
    this._input.style.top = Math.min(Math.max(evt.pageY - 7, this._origRect[1]), this._origRect[1] + this._origRect[3] - 20) + 'px';

    this._refreshSize();
    // marginX and marginY are to leave some minimal space between text input and page edge
    const marginX = 10;
    const marginY = 5;
    var maxWidth = this._origRect[0] + this._origRect[2] - evt.pageX - marginX;
    var maxHeight = this._origRect[1] + this._origRect[3] - evt.pageY - marginY;
    // Don't show text input if too close to page edge
    if (maxWidth <= 0 || maxHeight <= 0) {
      this._hide();
      return;
    }

    // Text input cannot bypass page edge
    var initialWidth = Math.min(this._size.width, maxWidth);
    var initialHeight = Math.min(this._size.height, maxHeight);

    // Initial size is minimal size. Cannot be smaller than this.
    this._size.minWidth = initialWidth;
    this._size.minHeight = initialHeight;

    // Set minimal size
    this._input.style.minWidth = initialWidth + 'px';
    this._input.style.minHeight = initialHeight + 'px';

    // Set maximal size
    this._input.style.maxWidth = maxWidth + 'px';
    this._input.style.maxHeight = maxHeight + 'px';

    // Set text color and transparent border
    this._input.style.color = Color.selected;
    this._input.style.borderColor = Utils.hex2rgba(Color.selected, 0.5);

    // Show and focus on the text input
    this._input.style.display = '';
    this._input.focus();

    // Let Chinese input method put all characters first
    Utils.interrupt(() => {
      this._input.value = '';
      this._input.style.width = initialWidth + 'px';
      this._input.style.height = initialHeight + 'px';
    });
  },
  _hide: function() {
    this._input.style.display = 'none';
  },
  init: function() {
    var self = this;
    this._input = Utils.qs('#textinput');
    this._hide();
    this._listeners['blur'] = this._blur.bind(this);
    this._listeners['click'] = this._click.bind(this);
    this._input.addEventListener('blur', this._listeners.blur, false);
    this._input.wrap = 'off';
    // Auto resize according to content
    this._input.addEventListener('input', function(evt) {
      // Always shrink to minimal size first
      this.style.width = self._size.minWidth + 'px';
      this.style.width = this.scrollWidth + 'px';
      // And then extend to scroll size
      this.style.height = self._size.minHeight + 'px';
      this.style.height = this.scrollHeight + 'px';
    }, false);
    // Disallow scroll. Make sure content on screen doesn't scroll away.
    this._input.addEventListener('scroll',function(evt) {
      this.scrollTop = 0;
      this.scrollLeft = 0;
    });
  },
  start: function(x, y, w, h) {
    this.__proto__.start.bind(this)(x, y, w, h, 'textcanvas', 'click');
  },
  cancel: function() {
    this._input.value = '';
    this._canvas.removeEventListener('click', this._listeners.click, false);
    Editor.canvas.removeEventListener('click', this._listeners.click, false);
    document.body.removeChild(this._canvas);
    this._hide();
  }
};

var Blur = {
  __proto__: BaseControl,
  _canvas: null,
  _ctx: null,
  _listeners: {},
  _origData: null,
  _bluredData: null,
  _origRect: null,
  _radius: 7,
  _blurAround: function(x, y) {
    var sx = Math.max(0, x - this._radius);
    var sy = Math.max(0, y - this._radius);
    var ex = Math.min(this._origRect[2], x + this._radius);
    var ey = Math.min(this._origRect[3], y + this._radius);
    var dx = Math.min(3, sx);
    var dy = Math.min(3, sy);
    var dw = Math.min(ex + 3, this._origRect[2]) - sx + dx;
    var dh = Math.min(ey + 3, this._origRect[3]) - sy + dy;
    this._origData = Editor.ctx.getImageData(sx - dx, sy - dy, dw, dh);
    this._bluredData = this._origData;
    for (var i = 0; i < this._origData.width; i++) {
      for (var j = 0; j < this._origData.height; j++) {
        if (Math.pow(i - (x - sx + dx), 2) + Math.pow(j - (y - sy + dy), 2) <= Math.pow(this._radius, 2)) {
          this._calcBluredData(i, j);
        }
      }
    }
    Editor.ctx.putImageData(this._bluredData, sx - dx, sy - dy);
  },
  _calcBluredData: function(x, y) {
    var maxradius = Math.min(x, y, this._origData.width - 1 - x, this._origData.height - 1 - y);
    var radius = Math.min(3, maxradius);
    var tmp = [0, 0, 0, 0, 0];
    for (var i = x - radius; i <= x + radius; i++) {
      for (var j = y - radius; j <= y + radius; j++) {
        for (var k = 0; k < 4; k++) {
          tmp[k] += this._origData.data[this._xyToIndex(i, j, k)];
        }
        tmp[4] += 1;
      }
    }
    for (var i = 0; i < 4; i++) {
      this._bluredData.data[this._xyToIndex(x, y, i)] = Math.floor(tmp[i] / tmp[4]);
    }
  },
  _refreshImageData: function() {
  },
  _xyToIndex: function(x, y, i) {
    return 4 * (y * this._origData.width + x) + i;
  },
  _mousemove: function(evt) {
    var x = this._origRect[0];
    var y = this._origRect[1];
    var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
    var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
    this._blurAround(rx, ry);
    evt.stopPropagation();
    evt.preventDefault();
  },
  start: function(x, y, w, h) {
    this.__proto__.start.bind(this)(x, y, w, h, 'blurcanvas');
  },
  cancel: function() {
    this.__proto__.cancel.bind(this)();
    this._origData = null;
    this._bluredData = null;
  }
};

var Pencil = {
  __proto__: BaseControl,
  _canvas: null,
  _ctx: null,
  _listeners: {},
  _origRect: null,
  _radius: 1,
  _draw: function(x, y) {
    Editor.ctx.lineTo(x, y);
    Editor.ctx.stroke();
  },
  _mousedown: function(evt) {
    var rx = evt.pageX - this._origRect[0];
    var ry = evt.pageY - this._origRect[1];
    this._startxy = [rx, ry];
    Editor.ctx.lineWidth = BaseControl.lineWidth;
    Editor.ctx.strokeStyle = Color.selected;
      Editor.ctx.moveTo(rx, ry);
      Editor.ctx.beginPath();
    document.addEventListener('mousemove', this._listeners.mousemove, false);
    document.addEventListener('mouseup', this._listeners.mouseup, false);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _mouseup: function(evt) {
    Editor.ctx.closePath();
    document.removeEventListener('mousemove', this._listeners.mousemove, false);
    document.removeEventListener('mouseup', this._listeners.mouseup, false);
    evt.stopPropagation();
    evt.preventDefault();
    this._refreshImageData();
    Editor.updateHistory();
  },
  _mousemove: function(evt) {
    var x = this._origRect[0];
    var y = this._origRect[1];
    var rx = Math.min(Math.max(evt.pageX - x, 0), this._origRect[2]);
    var ry = Math.min(Math.max(evt.pageY - y, 0), this._origRect[3]);
    this._draw(rx, ry);
    evt.stopPropagation();
    evt.preventDefault();
  },
  _refreshImageData: function() {
  },
  start: function(x, y, w, h) {
    this.__proto__.start.bind(this)(x, y, w, h, 'pencilcanvas');
  },
  cancel: function() {
    this.__proto__.cancel.bind(this)();
  }
};

var Color = {
  ele: null,
  listeners: {},
  usePrefix: false,
  get selected() {
    return Utils.prefs.get('color', '#FF0000');
  },
  set selected(value) {
    Utils.prefs.set('color', value);
  },
  select: function(evt) {
    this.selected = evt.target.color;
  },
  init: function() {
    // Setup colorpicker
    this.ele = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'colorpicker');
    this.ele.id = 'colorpicker';
    this.parent.ele.appendChild(this.ele);
    this.listeners.select = this.select.bind(this);
    this.listeners.hide = (function() {
      this.visible = false;
    }).bind(this);
    this.ele.addEventListener('select', this.listeners.select, false);

    // Hide colorpicker
    this.hide();
  }
};

var FontSelect = {
  ele: null,
  listeners: {},
  init: function() {
    this.ele = Utils.qs('#button-fontSize').appendChild(Utils.qs('#fontselect'));
    this.listeners.click = this.click.bind(this);
    this.listeners.hide = (function() {
      this.visible = false;
    }).bind(this);
    this.ele.addEventListener('click', this.listeners.click, false);
    this.hide();
  },
  click: function(evt) {
    if (evt.target.nodeName == 'li') {
      BaseControl.fontSize = Number(evt.target.textContent);
    }
  }
};

const HISTORY_LENGHT_MAX = 50;
var Editor = {
  _controls: {
    'crop': CropOverlay,
    'rectangle': Rect,
    'line': Line,
    'pencil': Pencil,
    'circle': Circ,
    'text': TextInput,
    'blur': Blur
  },
  _canvas: null,
  _ctx: null,
  _current: null,
  _history: [],
  buttons: {},
  floatbar: {
    ele: null,
    panels: {},
    buttonEle: null,
    init: function() {
      var self = this;
      this.ele = Utils.qs('#floatbar');
      // Define panel structure
      var Panel = function(options) {
        this.listeners = {};
        Utils.merge(this, options);
        this.ele = Utils.qs('#button-' + this.id);
      };
      Object.defineProperty(Panel.prototype, 'pressed', {
        enumerable: true,
        get: function() {
          return this.ele.classList.contains('current');
        },
        set: function(value) {
          this.toggle(value);
          if (this.child) {
            this.child.toggle(value);
          }
        }
      });
      Utils.merge(Panel.prototype, {
        _init: function() {
          if (this.refresh) {
            this.refresh();
            Utils.prefs.observe(this.id, this.refresh.bind(this));
          }
          if (this.click) {
            this.listeners.click = this.click.bind(this);
            this.ele.addEventListener('click', this.listeners.click);
          }
        },
        _setChild: function(child) {
          this.child = child;
          this.child.parent = this;
          Object.defineProperty(this.child, 'visible', {
            enumerable: true,
            get: function() {
              return this.ele.style.display != 'none';
            },
            set: function(value) {
              this.toggle(value);
              this.parent.toggle(value);
            }
          });
          Utils.merge(this.child, {
            show: function() {
              this.toggle(true);
            },
            hide: function() {
              this.toggle(false);
            },
            toggle: function(toShow) {
              if (toShow === undefined) {
                toShow = !this.visible;
              }
              this.ele.style.display = toShow ? '' : 'none';
              if (this.listeners.hide) {
                document[(toShow ? 'add' : 'remove') + 'EventListener']('click', this.listeners.hide, false);
              }
            }
          });
          if (this.child.init) {
            this.child.init();
          }
        },
        press: function() {
          this.toggle(true);
        },
        release: function() {
          this.toggle(false);
        },
        toggle: function(toPress) {
          if (toPress === undefined) {
            toPress = !this.pressed;
          }
          this.ele.classList[toPress ? 'add' : 'remove']('current');
        }
      });
      // Generate panels
      [{
        id: 'lineWidth',
        init: function() {
          this._init();
        },
        refresh: function() {
          Array.prototype.forEach.call(this.ele.getElementsByTagName('li'), function(li) {
            li.classList[li.value == BaseControl.lineWidth ? 'add' : 'remove']('current');
          });
        },
        click: function(evt) {
          if (evt.target.nodeName == 'li') {
            BaseControl.lineWidth = evt.target.value;
          }
        }
      }, {
        id: 'fontSize',
        init: function() {
          this._init();
          this._setChild(FontSelect);
        },
        refresh: function() {
          this.ele.firstChild.textContent = BaseControl.fontSize + ' px';
        },
        click: function(evt) {
          this.pressed = !this.pressed;
          self.panels.color.pressed = false;
          evt.stopPropagation();
        }
      }, {
        id: 'color',
        init: function() {
          this._init();
          this._setChild(Color);
        },
        refresh: function() {
          this.ele.firstChild.style.backgroundColor = Color.selected;
        },
        click: function(evt) {
          this.pressed = !this.pressed;
          self.panels.fontSize.pressed = false;
          evt.stopPropagation();
        }
      }].forEach(function(options) {
        this.panels[options.id] = new Panel(options);
      }, this);

      Object.keys(this.panels).forEach(function(id) {
        this.panels[id].init();
      }, this);

      this.hide();
    },
    reposition: function() {
      if (this.ele && this.buttonEle) {
        this.ele.style.left = this.buttonEle.getBoundingClientRect().left + 'px';
      }
    },
    show: function(button, panelsToShow) {
      if (button) {
        this.buttonEle = button;
        this.reposition();
      }

      this.ele.style.display = '';

      if (panelsToShow) {
        Object.keys(this.panels).forEach(function(id) {
          this.panels[id].ele.style.display = panelsToShow.indexOf(id) >= 0 ? 'inline-block' : 'none';
        }, this);
      }
    },
    hide: function() {
      this.ele.style.display = 'none';
    }
  },
  get canvas() {
    return this._canvas;
  },
  set canvas(canvas) {
    this._canvas = canvas;
    this._ctx = this._canvas.getContext('2d');
  },
  get ctx() {
    return this._ctx;
  },
  get canvasData() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  },
  set canvasData(data) {
    this.canvas.width = data.width;
    this.canvas.height = data.height;
    this.ctx.putImageData(data, 0, 0);
  },
  get current() {
    return this._current;
  },
  set current(newCurrent) {
    var oldID = this._current ? this._getID(this._current) : '';
    var newID = newCurrent ? this._getID(newCurrent) : '';

    var oldBtn = this.buttons[oldID];
    var newBtn = this.buttons[newID];

    // Clear last button, normally clearing style and hiding floatbar
    if (oldBtn && !oldBtn.simple) {
      oldBtn.clear();
    }
    // finish() will only be called when a pressed button is clicked
    // start() is the main task this button is binding on
    newBtn[!newBtn.simple && newID == oldID ? 'finish' : 'start']();
  },
  init: function() {
    var self = this;

    this.canvas = Utils.qs('#display');
    try {
      this.canvasData = SnapshotStorage.pop();
    } catch(ex) {
      ['fontselect', 'floatbar', 'textinput'].forEach(function(id) {
        Utils.qs('#' + id).style.display = 'none';
      });
      window.location.href = 'http://mozilla.com.cn/addon/325-easyscreenshot/';
      return;
    }
    this.updateHistory();
    this._disableUndo();
    this._setupToolbar();
    this.floatbar.init();

    document.body.addEventListener('keypress', function(evt) {
      if (evt.keyCode == 27) { // Esc
        self.current = null;
      }
      if (self._getID(evt.target) == 'textinput') {
        return;
      }
      Object.keys(self.buttons).some(function(id) {
        var button = self.buttons[id];
        var key = button.key;
        return key ? [key.toLowerCase(), key.toUpperCase()].some(function(letter) {
          var found = evt.charCode == letter.charCodeAt(0);
          if (found) {
            self.current = {id: id};
            evt.preventDefault();
          }
          return found;
        }) : false;
      });
    }, false);
    [CropOverlay, Rect, Line, Pencil, Circ, TextInput, Blur].forEach(function(control) {
      control.init();
    });
    this.playSound('capture');
  },
  updateHistory: function() {
    this._history.push(this.canvasData);
    if (this._history.length > HISTORY_LENGHT_MAX) {
      this._history.shift();
      //this._history.splice(1, 1);
    }
    if (this._history.length > 1) {
      this._enableUndo();
    }
  },
  _getID: function(ele) {
    return ele.id.replace(/^button-/, '');
  },
  _setupToolbar: function() {
    var self = this;
    [].forEach.call(document.querySelectorAll('#toolbar > li'), function(li) {
      li.addEventListener('click', function(evt) {
        self.current = evt.target;
      }, false);
    });
    this._setupButtons();
  },
  _setupButtons: function() {
    var self = this;
    // Define floatbar types to avoid repetition
    var floatbars = {
      line: ['lineWidth', 'color'],
      text: ['fontSize', 'color']
    };
    // Define button structure
    var Button = function(options) {
      Utils.merge(this, options);
      // id is a must
      this.ele = Utils.qs('#button-' + this.id);
    };
    Utils.merge(Button.prototype, {
      start: function() {
        this.ele.classList.add('current');
        self._current = this.ele;
        if (this.floatbar) {
          self.floatbar.show(this.ele, this.floatbar);
        }
        self._controls[this.id].start(
          parseInt(self.canvas.offsetLeft, 10),
          parseInt(self.canvas.offsetTop, 10),
          parseInt(self.canvas.offsetWidth, 10),
          parseInt(self.canvas.offsetHeight, 10)
        );
      },
      finish: function() {},
      clear: function() {
        self._current.classList.remove('current');
        self._current = null;
        if (this.floatbar) {
          self.floatbar.hide();
        }
        self.canvas.className = '';
        self._controls[this.id].cancel();
      }
    });
    // Generate buttons
    [{
      id: 'crop',
      key: 'X',
      finish: function() {
        self._controls.crop.stop();
      }
    }, {
      id: 'rectangle',
      key: 'R',
      floatbar: floatbars.line
    }, {
      id: 'line',
      key: 'D',
      floatbar: floatbars.line
    }, {
      id: 'pencil',
      key: 'F',
      floatbar: floatbars.line
    }, {
      id: 'circle',
      key: 'E',
      floatbar: floatbars.line
    }, {
      id: 'text',
      key: 'T',
      floatbar: floatbars.text
    }, {
      id: 'blur',
      key: 'B'
    }, {
      id: 'undo',
      key: 'Z',
      simple: true,
      start: self._undo.bind(self)
    }, {
      id: 'local',
      key: 'S',
      simple: true,
      start: self._saveLocal.bind(self)
    }, {
      id: 'copy',
      key: 'C',
      simple: true,
      start: self._copyToClipboard.bind(self)
    }, {
      id: 'cancel',
      key: 'Q',
      simple: true,
      start: self._cancelAndClose.bind(self)
    }].forEach(function(options) {
      this.buttons[options.id] = new Button(options);
    }, this);
  },
  _undo: function() {
    if(this._history.length > 1) {
      this._history.pop();
      this.canvasData = this._history[this._history.length - 1];
      if (this._history.length <= 1) {
        this._disableUndo();
      }
    }
  },
  _enableUndo: function() {
    Utils.qs('#button-undo').removeAttribute('disabled');
  },
  _disableUndo: function() {
    Utils.qs('#button-undo').setAttribute('disabled', 'true');
  },
  _saveLocal: function() {
    var file = Utils.prefs.get('savePosition', {
      type: Ci.nsILocalFile,
      value: Cc['@mozilla.org/file/directory_service;1']
          .getService(Ci.nsIProperties)
          .get('Desk', Ci.nsILocalFile)
    });
    var defaultFilename = Utils.strings.get('SnapFilePrefix') + '_' + (new Date()).toISOString().replace(/:/g, '-') + '.png';
    file.append(defaultFilename);

    Utils.download(this.canvas.toDataURL('image/png', ''), file.path, function() {
      var openDirectory = Utils.prefs.get('openDirectory', true);
      if (openDirectory) {
        try {
          file.reveal();
        } catch (ex) {
          file.parent.launch();
        }
      }
    });

    this.playSound('export');
    Utils.notification.notify(Utils.strings.get('saveNotification'), {
      body: file.parent.path
    });
    Utils.interrupt('window.close();');
  },
  _copyToClipboard: function() {
    var imagedata = this.canvas.toDataURL('image/png', '');
    var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    var channel = ios.newChannel(imagedata, null, null);
    var input = channel.open();
    var imgTools = Cc['@mozilla.org/image/tools;1'].getService(Ci.imgITools);

    var container = {};
    imgTools.decodeImageData(input, channel.contentType, container);

    var wrapped = Cc['@mozilla.org/supports-interface-pointer;1'].createInstance(Ci.nsISupportsInterfacePointer);
    wrapped.data = container.value;

    var trans = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
    trans.addDataFlavor(channel.contentType);
    trans.setTransferData(channel.contentType, wrapped, channel.contentLength);

    Services.clipboard.setData(trans, null, Ci.nsIClipboard.kGlobalClipboard);

    this.playSound('export');
    Utils.notification.notify(Utils.strings.get('copyNotification'));
    Utils.interrupt('window.close();');
  },
  _cancelAndClose: function() {
    window.close();
  },
  _upToXiuxiu: function() {
    if (window.console) {
      console.log('not implemented');
    }
    window.close();
  },
  playSound: function(sound) {
    Utils.qs('#sound-' + sound).play();
  }
};

window.addEventListener('load', function(evt) {
  Editor.init();
  Utils.notification.check();
}, false);

window.addEventListener('resize', function(evt) {
  Editor.floatbar.reposition();
  CropOverlay.reposition();
}, false);

})();
