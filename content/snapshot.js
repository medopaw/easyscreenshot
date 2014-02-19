/* vim: set ts=2 et sw=2 tw=80: */
(function() {
  var jsm = { };
  if (typeof XPCOMUtils == 'undefined') {
    Cu.import('resource://gre/modules/XPCOMUtils.jsm');
  }
  XPCOMUtils.defineLazyGetter(jsm, 'utils', function() {
    let obj = { };
    Cu['import']('resource://easyscreenshot/utils.jsm', obj);
    return obj.utils;
  });
  XPCOMUtils.defineLazyGetter(jsm, 'SnapshotStorage', function() {
    let obj = { };
    Cu['import']('resource://easyscreenshot/snapshot.js', obj);
    return obj.SnapshotStorage;
  });

  var ns = MOA.ns('ESS.Snapshot');
  var _logger = jsm.utils.logger('ESS.snapshot');
  var _strings = null;

  ns.init = function (evt) {
    _strings = document.getElementById('easyscreenshot-strings');
  };

  ns.getSnapshot = function(part,data) {
    if(part == 'data'){
      return sendSnapshot(data.canvas, data.ctx);
    }

    var contentWindow = window.content;
    var contentDocument = contentWindow.document;
    var width, height, x, y;
    switch (part) {
      case 'visible':
        x = contentDocument.documentElement.scrollLeft;
        y = contentDocument.documentElement.scrollTop;
        width = contentDocument.documentElement.clientWidth;
        height = contentDocument.documentElement.clientHeight;
        break;
      case 'entire':
        x = y = 0;
        width = Math.max(contentDocument.documentElement.scrollWidth, contentDocument.body.scrollWidth);
        height = Math.max(contentDocument.documentElement.scrollHeight, contentDocument.body.scrollHeight);
        break;
      default:
        _logger.trace('unknown part argument')
    }

    var canvas = null;
    var success = true;
    try {
      canvas = contentDocument.createElementNS('http://www.w3.org/1999/xhtml', 'html:canvas');
      canvas.height = height;
      canvas.width = width;

      // maybe https://bugzil.la/729026#c10 ?
      var ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.drawWindow(contentWindow, x, y, width, height, 'rgb(255,255,255)');
    } catch(err) {
      success = false;
    }

    if (width != canvas.width || height != canvas.height) {
      success = false;
    }

    if (success) {
      sendSnapshot(canvas, ctx);
    } else {
      Cc['@mozilla.org/alerts-service;1']
        .getService(Ci.nsIAlertsService)
        .showAlertNotification('chrome://easyscreenshot/skin/image/easyscreenshot.png',
          document.getElementById("easyscreenshot-strings")
                  .getString('failToCaptureNotification'));
    }
  };

  var sendSnapshot = function(canvas, ctx) {
    var defaultAction = 'editor';

    switch(defaultAction) {
      case 'local':
        saveDataToDisk(canvas.toDataURL('image/png', ''));
        break;
      case 'editor':
        jsm.SnapshotStorage.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        openUILinkIn('chrome://easyscreenshot/content/editor.xhtml', 'tab');
        break;
    }
  }

  var saveDataToDisk = function(data) {
    var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
    fp.init(window.parent, _strings.getString('saveImageTo'), Ci.nsIFilePicker.modeSave);
    fp.defaultString = _strings.getString('SnapFilePrefix') + '_' + (new Date()).toISOString().replace(/:/g, '-') + '.png';
    fp.appendFilter(_strings.getString('pngImage'), '*.png');

    if (fp.show() != Ci.nsIFilePicker.returnCancel) {
      var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
      var path = fp.file.path;
      file.initWithPath(path + (/\.png$/.test(path) ? '' : '.png'));

      var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
      var source = ios.newURI(data, 'utf8', null);
      var target = ios.newFileURI(file);

      var persist = Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Ci.nsIWebBrowserPersist);
      persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

      var transfer = Cc['@mozilla.org/transfer;1'].createInstance(Ci.nsITransfer);
      transfer.init(source, target, '', null, null, null, persist, false);
      persist.progressListener = transfer;

      persist.saveURI(source, null, null, null, null, file, null);
    }
  }

  ns.openSettings = function() {
    var features = 'chrome,titlebar,toolbar,centerscreen';
    try {
      var instantApply = Services.prefs.getBranch('browser.preferences.').getBoolPref('instantApply');
      features += instantApply ? ',dialog=no' : ',modal';
    } catch (e) {
      features += ',modal';
    }
    window.openDialog('chrome://easyscreenshot/content/settings-dialog.xul', 'Settings', features).focus();
  }

  ns.openSnapshotFeedback = function() {
    var src = 'http://mozilla.com.cn/addon/325-easyscreenshot/';
    gBrowser.selectedTab = gBrowser.addTab(src);
  }

  window.addEventListener('load', function() {
    window.setTimeout(function() {
      ns.init();
    }, 1000);
    window.removeEventListener('load', arguments.callee, false);
  }, false);
})();
