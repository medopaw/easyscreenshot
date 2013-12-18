window.ssInstalled = true;
(function() {

Components.utils.import("resource://easyscreenshot/snapshot.js");

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
    merge: function(mergeTo, mergeFrom) {
        var allObject = [mergeTo, mergeFrom].every(function(value) {
            return typeof value == 'object';
        });
        if (allObject) {
            Object.keys(mergeFrom).forEach(function(key) {
                mergeTo[key] = mergeFrom[key];
            });
        }
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
            switch(this._status.isResizing) {
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
            top:     Utils.qs('#croptop'),
            right:   Utils.qs('#cropright'),
            bottom:  Utils.qs('#cropbottom'),
            left:    Utils.qs('#cropleft'),
            target:  Utils.qs('#croptarget'),
        };
        this._listeners['dblclick'] = this._dblclick.bind(this);
        this._listeners['mousedown'] = this._mousedown.bind(this);
        this._listeners['mousemove'] = this._mousemove.bind(this);
        this._listeners['mouseup'] = this._mouseup.bind(this);
        this._hide();
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
//               _dir's value
//
//                  |
//               2  |  1
//             -----------
//               3  |  4
//                  |
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
    _lineWidth: {
        value: 0,
        levels: [3, 6, 9]
    },
    get lineWidth() {
        var _lineWidth = this._lineWidth;
        if (!_lineWidth.value) {
            var prefs = Components.classes['@mozilla.org/preferences-service;1']
                                        .getService(Components.interfaces.nsIPrefService)
                                        .getBranch('snapshot.settings.');
            try {
                _lineWidth.value = prefs.getIntPref('lineWidth');
            } catch (ex) {
                // lineWidth not set in preference. Trigger set function.
                this.lineWidthLevel = 1;
            }
        }
        return _lineWidth.value;
    },
    set lineWidth(value) {
        var _lineWidth = this._lineWidth;
        if (typeof value == 'string') {
            value = _lineWidth.level[value];
        }
        if (!isNaN(value) && _lineWidth.value != value) {
            _lineWidth.value = value;
            var prefs = Components.classes['@mozilla.org/preferences-service;1']
                                        .getService(Components.interfaces.nsIPrefService)
                                        .getBranch('snapshot.settings.');
            prefs.setIntPref('lineWidth', value);
        }
    },
    get lineWidthLevel() {
    	return this._lineWidth.levels.indexOf(this.lineWidth);
    },
    set lineWidthLevel(value) {
    	this.lineWidth = this._lineWidth.levels[value];
    },
    _fontSize: null,
    get fontSize() {
    },
    set fontSize(fontSize) {
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
    _blur: function() {
        var msg = this._input.value;
        this._input.value = '';
        var x = parseInt(this._input.style.left, 10) - this._origRect[0];
        var y = parseInt(this._input.style.top, 10) - this._origRect[1];
        if (msg) {
            Editor.ctx.font = 'bold 14px Arial,Helvetica,sans-serif';
            // why the offset ? baseline ?
            Editor.ctx.fillText(msg, x + 1, y + 14 + 1);
            Editor.updateHistory();
        }
    },
    _click: function(evt) {
        this._input.blur();
        Editor.ctx.fillStyle = Color.selected;
        Editor.ctx.save();
        this._input.style.left = evt.pageX + 'px';
        this._input.style.top = Math.min(Math.max(evt.pageY - 7, this._origRect[1]), this._origRect[1] + this._origRect[3] - 20) + 'px';
        this._input.style.width = Math.min(184, this._origRect[0] + this._origRect[2] - evt.pageX) + 'px';
        this._input.style.color = Color.selected;
        this._input.style.borderBottomColor = Color.selected;
        this._input.style.display = '';
        this._input.focus();
    },
    _hide: function() {
        this._input.style.display = 'none';
    },
    init: function() {
        this._input = Utils.qs('#textinput');
        this._hide();
        this._listeners['blur'] = this._blur.bind(this);
        this._listeners['click'] = this._click.bind(this);
        this._input.addEventListener('blur', this._listeners.blur, false);
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
    _colorpicker: null,
    _listeners: {},
    _selected: null,
    _usePrefix: false,
    get selected() {
        if (!this._selected) {
            var prefs = Components.classes['@mozilla.org/preferences-service;1']
                                        .getService(Components.interfaces.nsIPrefService)
                                        .getBranch('snapshot.settings.');
            try {
                this._selected = prefs.getCharPref('color');
            } catch (ex) {
                // color not set in preference. Trigger set function.
                this.selected = '#FF0000';
            }
        }
        return this._selected;
    },
    set selected(value) {
        if (this._selected != value) {
            this._selected = value;

            Editor.floatbar.panels.color.setColor(value);

            var prefs = Components.classes['@mozilla.org/preferences-service;1']
                                        .getService(Components.interfaces.nsIPrefService)
                                        .getBranch('snapshot.settings.');
            prefs.setCharPref('color', value);
	    }
    },
    _click: function(evt) {
        this.toggle();
    },
    _select: function(evt) {
        this.selected = evt.target.color;
        this.toggle();
    },
    init: function() {
        // Setup colorpicker
        this._colorpicker = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'colorpicker');
        this._colorpicker.id = 'colorpicker';
        document.body.appendChild(this._colorpicker);
        this._listeners['click'] = this._click.bind(this);
        this._listeners['select'] = this._select.bind(this);
        this._colorpicker.addEventListener('select', this._listeners.select, false);

        // Hide colorpicker
        this.toggle(false);
    },
    toggle: function(visible) {
        if ((visible === true || visible === undefined) && this._colorpicker.style.display == 'none') {
            this._colorpicker.style.display = '';
            document.addEventListener('click', this._listeners.click, false);
            Editor.floatbar.panels.color.setBackgroundImage({ pressed: 0 });
        } else if ((visible === false || visible === undefined) && this._colorpicker.style.display == '') {
            this._colorpicker.style.display = 'none';
            document.removeEventListener('click', this._listeners.click, false);
            Editor.floatbar.panels.color.setBackgroundImage({ pressed: -1 });
        }
    }
}
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
                this.hover = -1;
                this.pressed = -1;
                this.init = function() {};
                this.getIndex = function(evt) {
                    var rect = this.ele.getBoundingClientRect();
                    var width = this.ele.clientWidth;
                    var x = evt.clientX - rect.left;
                    if (x < 0) {
                        x = 0;
                    } else if (x >= width) {
                        x = width - 1;
                    }
                    return Math.floor(x * this.size / width);
                };
                this.getBackgroundImage = function() {
                    var states = [];
                    for (var i = 0; i < this.size; i++) {
                        states.push('normal');
                    }
                    states[this.hover] = 'highlight';
                    states[this.pressed] = 'pressed';
                    return 'url(chrome://easyscreenshot/skin/image/' + this.id + '-' + states.join('-') + '.png)';
                };
                this.setBackgroundImage = function(options) {
                    Utils.merge(this, options);
                    var newImg = this.getBackgroundImage();
                    var oldImg = window.getComputedStyle(this.ele).backgroundImage;
                    if (newImg != oldImg) {
                        this.ele.style.backgroundImage = newImg;
                    }
                };
                Utils.merge(this, options);
                this.ele = Utils.qs('#button-' + this.id);
            };
            // Generate panels
            [{
                id: 'linewidth',
                size: 3,
                pressed: BaseControl.lineWidthLevel,
                init: function() {
                    this.setBackgroundImage();
                }
            }, {
                id: 'fontsize',
                size: 2
            }, {
                id: 'color',
                size: 1,
                getIndex: function() {
                    return 0;
                },
                init: function() {
                    this.setColor(Color.selected);
                },
                setColor: function(color) {
                    this.ele.firstChild.style.backgroundColor = color;
                }
            }].forEach(function(options) {
                this.panels[options.id] = new Panel(options);
            }, this);

            var eventHandler = function(evt) {
                // Detect which panel is the event on
                var id = Editor._getID(evt.target);
                var panel = self.panels[id];
                // Detect which region is the event on
                var index = panel.getIndex(evt);
                // Call different callbacks according to different event types
                switch (evt.type) {
                    case 'mousemove': {
                        panel.hover = index;
                        break;
                    }
                    case 'mouseleave': {
                        panel.hover = -1;
                        break;
                    }
                    case 'click': {
                        switch (id) {
                            case 'linewidth': {
                                BaseControl.lineWidthLevel = index;
                                panel.pressed = index;
                                break;
                            }
                            case 'fontsize': {
                                break;
                            }
                            case 'color': {
                                panel.pressed = panel.pressed < 0 ? 0 : -1;
                                var rect = panel.ele.getBoundingClientRect();
                                var picker = Color._colorpicker;
                                picker.style.top = rect.bottom + 3 + 'px';
                                picker.style.left = rect.left + 'px';
                                Color.toggle();
                                break;
                            }
                            default: {
                                break;
                            }
                        }
                        break;
                    }
                    default: {
                        break;
                    }
                }
                panel.setBackgroundImage();
                evt.stopPropagation();
            };
            [].forEach.call(document.querySelectorAll('#floatbar > li'), function(li) {
                li.addEventListener('mousemove', eventHandler, false);
                li.addEventListener('mouseleave', eventHandler, false);
                li.addEventListener('click', eventHandler, false);
                self.panels[Editor._getID(li)].init();
            });
        },
        reposition: function() {
            if (this.buttonEle) {
                this.ele.style.left = this.buttonEle.getBoundingClientRect().left + 'px';
            }
        },
        show: function(button, panelsToShow) {
            this.buttonEle = button;
            this.reposition();
            this.ele.style.display = 'block';

            Object.keys(this.panels).forEach(function(id) {
                this.panels[id].ele.style.display = panelsToShow.indexOf(id) >= 0 ? 'inline-block' : 'none';
            }, this);
        },
        hide: function() {
            this.ele.style.display = 'none';
            Color.toggle(false);
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
        var self = this;

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
        this.canvas = Utils.qs('#display');
        this.canvasData = SnapshotStorage.pop();
        this.updateHistory();
        this._disableUndo();
        this._setupToolbar();
        this.floatbar.init();
        var self = this;
        document.body.addEventListener('keypress', function(evt) {
            if (evt.keyCode == 27) {//Esc
                self.current = null;
            }
            if (evt.ctrlKey && evt.charCode == 99) {//^C
                self.current = {id: 'copy'};
                evt.preventDefault();
            }
            if (evt.ctrlKey && evt.charCode == 115) {//^S
                self.current = {id: 'local'};
                evt.preventDefault();
            }
            if (evt.ctrlKey && evt.charCode == 122) {//^Z
                self.current = {id: 'undo'};
            }
        }, false);
        [CropOverlay, Rect, Line, Pencil, Circ, TextInput, Blur, Color].forEach(function(control) {
            control.init();
        });
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
            var isControl = !!self._controls[self._getID(li)];
            if (!isControl) {
                li.addEventListener('mousedown', function(evt) {
                    this.classList.add('current');
                    self.pressedBtn = this;
                    evt.stopPropagation();
                }, false);
            }
            li.addEventListener('click', function(evt) {
                self.current = evt.target;
                evt.stopPropagation();
            }, false);
        });
        this._setupButtons();
    },
    _setupButtons: function() {
        var self = this;
        // Define floatbar types to avoid repetition
        var floatbars = {
            line: ['linewidth', 'color'],
            text: ['fontsize', 'color']
        };
        // Define button structure
        var Button = function(options) {
            Utils.merge(this, options);
            // options must has id
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
            finish: function() {
                self._controls.crop.stop();
            }
        }, {
            id: 'rectangle',
            floatbar: floatbars.line
        }, {
            id: 'line',
            floatbar: floatbars.line
        }, {
            id: 'pencil',
            floatbar: floatbars.line
        }, {
            id: 'circle',
            floatbar: floatbars.line
        }, {
            id: 'text',
            floatbar: floatbars.text
        }, {
            id: 'blur'
        }, {
            id: 'undo',
            simple: true,
            start: self._undo.bind(self)
        }, {
            id: 'local',
            simple: true,
            start: self._saveLocal.bind(self)
        }, {
            id: 'copy',
            simple: true,
            start: self._copyToClipboard.bind(self)
        }, {
            id: 'cancel',
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
        var { classes: Cc, interfaces: Ci } = Components;
        var _strings = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService).createBundle("chrome://easyscreenshot/locale/easyscreenshot.properties");

        var path = '';
        var prefs = Cc['@mozilla.org/preferences-service;1']
                        .getService(Components.interfaces.nsIPrefService)
                        .getBranch('snapshot.settings.');
        try {
            path = prefs.getCharPref('saveposition');
        } catch (ex) {
            path = Cc["@mozilla.org/file/directory_service;1"]
                    .getService(Components.interfaces.nsIProperties)
                    .get("Desk", Ci.nsILocalFile).path;
            prefs.setCharPref('saveposition', path);
        }

        var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
        file.initWithPath(path);
        var defaultFilename = _strings.GetStringFromName('SnapFilePrefix') + '_' + (new Date()).toISOString().replace(/:/g, '-') + '.png';
        file.append(defaultFilename);

        var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
        var source = ios.newURI(this.canvas.toDataURL("image/png", ""), 'utf8', null);
        var target = ios.newFileURI(file);

        var persist = Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Ci.nsIWebBrowserPersist);
        persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

        var transfer = Cc['@mozilla.org/transfer;1'].createInstance(Ci.nsITransfer);
        transfer.init(source, target, '', null, null, null, persist, false);
        persist.progressListener = transfer;

        persist.saveURI(source, null, null, null, null, file, null);
        this._history = [];

        var openDirectory = false;
        try {
            openDirectory = prefs.getBoolPref('opendirectory');
        } catch (ex) {
            prefs.setBoolPref('opendirectory', false);
        }
        if (openDirectory) {
            try {
              file.reveal();
            } catch (ex) {
              file.parent.launch();
            }
        }

        window.close();
    },
    _copyToClipboard: function() {
        var imagedata = this.canvas.toDataURL("image/png", "");
        var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
        var channel = ios.newChannel(imagedata, null, null);
        var input = channel.open();
        var imgTools = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);

        var container = {};
        imgTools.decodeImageData(input, channel.contentType, container);

        var wrapped = Components.classes["@mozilla.org/supports-interface-pointer;1"].createInstance(Components.interfaces.nsISupportsInterfacePointer);
        wrapped.data = container.value;

        var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
        trans.addDataFlavor(channel.contentType);
        trans.setTransferData(channel.contentType, wrapped, channel.contentLength);

        var clipid = Components.interfaces.nsIClipboard;
        var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
        clip.setData(trans, null, clipid.kGlobalClipboard);

        window.close();
    },
    _cancelAndClose: function() {
        window.close();
    },
    _upToXiuxiu: function() {
        if(window.console) {
            console.log('not implemented');
        }
        window.close();
    },
};
window.addEventListener('load', function(evt) {
    Editor.init();
}, false);
/*
window.addEventListener('beforeunload', function(evt) {
    if (Editor._history.length > 1) {
        evt.preventDefault();
    }
}, false);
*/
window.addEventListener('resize', function(evt) {
    Editor.floatbar.reposition();
}, false);

window.addEventListener('mouseup', function(evt) {
    if (Editor.pressedBtn) {
        Editor.pressedBtn.classList.remove('current');
        Editor.pressedBtn = null;
    }
}, false);

})();
