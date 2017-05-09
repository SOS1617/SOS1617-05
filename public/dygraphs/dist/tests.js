(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright (c) 2011 Google, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/** 
 * @fileoverview Assertions and other code used to test a canvas proxy.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var CanvasAssertions = {};

/**
 * Updates path attributes to match fill/stroke operations.
 *
 * This sets fillStyle to undefined for stroked paths,
 * and strokeStyle to undefined for filled paths, to simplify
 * matchers such as numLinesDrawn.
 *
 * @private
 * @param {Array.<Object>} List of operations.
 */
CanvasAssertions.cleanPathAttrs_ = function (calls) {
  var isStroked = true;
  for (var i = calls.length - 1; i >= 0; --i) {
    var call = calls[i];
    var name = call.name;
    if (name == 'stroke') {
      isStroked = true;
    } else if (name == 'fill') {
      isStroked = false;
    } else if (name == 'lineTo') {
      if (isStroked) {
        call.properties.fillStyle = undefined;
      } else {
        call.properties.strokeStyle = undefined;
      }
    }
  }
};

/**
 * Assert that a line is drawn between the two points
 *
 * This merely looks for one of these four possibilities:
 * moveTo(p1) -> lineTo(p2)
 * moveTo(p2) -> lineTo(p1)
 * lineTo(p1) -> lineTo(p2)
 * lineTo(p2) -> lineTo(p1)
 *
 * predicate is meant to be used when you want to track things like
 * color and stroke width. It can either be a hash of context properties,
 * or a function that accepts the current call.
 */
CanvasAssertions.assertLineDrawn = function (proxy, p1, p2, predicate) {
  CanvasAssertions.cleanPathAttrs_(proxy.calls__);
  // found = 1 when prior loop found p1.
  // found = 2 when prior loop found p2.
  var priorFound = 0;
  for (var i = 0; i < proxy.calls__.length; i++) {
    var call = proxy.calls__[i];

    // This disables lineTo -> moveTo pairs.
    if (call.name == "moveTo" && priorFound > 0) {
      priorFound = 0;
    }

    var found = 0;
    if (call.name == "moveTo" || call.name == "lineTo") {
      var matchp1 = CanvasAssertions.matchPixels(p1, call.args);
      var matchp2 = CanvasAssertions.matchPixels(p2, call.args);
      if (matchp1 || matchp2) {
        if (priorFound == 1 && matchp2) {
          if (CanvasAssertions.match(predicate, call)) {
            return;
          }
        }
        if (priorFound == 2 && matchp1) {
          if (CanvasAssertions.match(predicate, call)) {
            return;
          }
        }
        found = matchp1 ? 1 : 2;
      }
    }
    priorFound = found;
  }

  var toString = function toString(x) {
    var s = "{";
    for (var prop in x) {
      if (x.hasOwnProperty(prop)) {
        if (s.length > 1) {
          s = s + ", ";
        }
        s = s + prop + ": " + x[prop];
      }
    }
    return s + "}";
  };
  throw "Can't find a line drawn between " + p1 + " and " + p2 + " with attributes " + toString(predicate);
};

/**
 * Return the lines drawn with specific attributes.
 *
 * This merely looks for one of these four possibilities:
 * moveTo(p1) -> lineTo(p2)
 * moveTo(p2) -> lineTo(p1)
 * lineTo(p1) -> lineTo(p2)
 * lineTo(p2) -> lineTo(p1)
 *
 * attrs is meant to be used when you want to track things like
 * color and stroke width.
 */
CanvasAssertions.getLinesDrawn = function (proxy, predicate) {
  CanvasAssertions.cleanPathAttrs_(proxy.calls__);
  var lastCall;
  var lines = [];
  for (var i = 0; i < proxy.calls__.length; i++) {
    var call = proxy.calls__[i];

    if (call.name == "lineTo") {
      if (lastCall != null) {
        if (CanvasAssertions.match(predicate, call)) {
          lines.push([lastCall, call]);
        }
      }
    }

    lastCall = call.name === "lineTo" || call.name === "moveTo" ? call : null;
  }
  return lines;
};

/**
 * Verifies that every call to context.save() has a matching call to
 * context.restore().
 */
CanvasAssertions.assertBalancedSaveRestore = function (proxy) {
  var depth = 0;
  for (var i = 0; i < proxy.calls__.length; i++) {
    var call = proxy.calls__[i];
    if (call.name == "save") depth++;
    if (call.name == "restore") {
      if (depth == 0) {
        fail("Too many calls to restore()");
      }
      depth--;
    }
  }

  if (depth > 0) {
    fail("Missing matching 'context.restore()' calls.");
  }
};

/**
 * Checks how many lines of the given color have been drawn.
 * @return {Integer} The number of lines of the given color.
 */
// TODO(konigsberg): change 'color' to predicate? color is the
// common case. Possibly allow predicate to be function, hash, or
// string representing color?
CanvasAssertions.numLinesDrawn = function (proxy, color) {
  CanvasAssertions.cleanPathAttrs_(proxy.calls__);
  var num_lines = 0;
  var num_potential_calls = 0;
  for (var i = 0; i < proxy.calls__.length; i++) {
    var call = proxy.calls__[i];
    if (call.name == "beginPath") {
      num_potential_calls = 0;
    } else if (call.name == "lineTo") {
      num_potential_calls++;
    } else if (call.name == "stroke") {
      // note: Don't simplify these two conditionals into one. The
      // separation simplifies debugging tricky tests.
      if (call.properties.strokeStyle == color) {
        num_lines += num_potential_calls;
      }
      num_potential_calls = 0;
    }
  }
  return num_lines;
};

/**
 * Asserts that a series of lines are connected. For example,
 * assertConsecutiveLinesDrawn(proxy, [[x1, y1], [x2, y2], [x3, y3]], predicate)
 * is shorthand for
 * assertLineDrawn(proxy, [x1, y1], [x2, y2], predicate)
 * assertLineDrawn(proxy, [x2, y2], [x3, y3], predicate)
 */
CanvasAssertions.assertConsecutiveLinesDrawn = function (proxy, segments, predicate) {
  for (var i = 0; i < segments.length - 1; i++) {
    CanvasAssertions.assertLineDrawn(proxy, segments[i], segments[i + 1], predicate);
  }
};

CanvasAssertions.matchPixels = function (expected, actual) {
  // Expect array of two integers. Assuming the values are within one
  // integer unit of each other. This should be tightened down by someone
  // who knows what pixel a value of 5.8888 results in.
  return Math.abs(expected[0] - actual[0]) < 1 && Math.abs(expected[1] - actual[1]) < 1;
};

/**
 * For matching a proxy call against defined conditions.
 * predicate can either by a hash of items compared against call.properties,
 * or it can be a function that accepts the call, and returns true or false.
 * If it's null, this function returns true.
 */
CanvasAssertions.match = function (predicate, call) {
  if (predicate === null) {
    return true;
  }
  if (typeof predicate === "function") {
    return predicate(call);
  } else {
    for (var attr in predicate) {
      if (predicate.hasOwnProperty(attr) && predicate[attr] != call.properties[attr]) {
        return false;
      }
    }
  }
  return true;
};

exports['default'] = CanvasAssertions;
module.exports = exports['default'];

},{}],2:[function(require,module,exports){
// Copyright (c) 2011 Google, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

/** 
 * @fileoverview Utility functions for Dygraphs.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */
var DygraphOps = {};

DygraphOps.defaultEvent_ = {
  type: '',
  canBubble: true,
  cancelable: true,
  view: document.defaultView,
  detail: 0,
  screenX: 0,
  screenY: 0,
  clientX: 0,
  clientY: 0,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  button: 0,
  relatedTarget: null
};

/**
 * Create an event. Sets default event values except for special ones
 * overridden by the 'custom' parameter.
 *
 * @param command the command to create.
 * @param custom an associative array of event attributes and their new values.
 */
DygraphOps.createEvent = function (command, custom) {

  var copy = function copy(from, to) {
    if (from != null) {
      for (var prop in from) {
        if (from.hasOwnProperty(prop)) {
          to[prop] = from[prop];
        }
      }
    }
  };

  var e = {};
  copy(DygraphOps.defaultEvent_, e);
  copy(command, e);
  copy(custom, e);

  var event = document.createEvent('MouseEvents');
  event.initMouseEvent(e.type, e.canBubble, e.cancelable, e.view, e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);
  return event;
};

/**
 * Dispatch an event onto the graph's canvas.
 */
DygraphOps.dispatchCanvasEvent = function (g, event) {
  g.canvas_.dispatchEvent(event);
};

DygraphOps.dispatchDoubleClick = function (g, custom) {
  var opts = {
    type: 'dblclick',
    detail: 2
  };
  var event = DygraphOps.createEvent(opts, custom);
  DygraphOps.dispatchCanvasEvent(g, event);
};

/*
 * Create an 'opts' argument which can be passed to createEvent that contains
 * type, screenX, screenY, clientX, clientY.
 */
DygraphOps.createOptsForPoint_ = function (g, type, x, y) {
  var pos = utils.findPos(g.canvas_);
  var pageX = pos.x + x;
  var pageY = pos.y + y;

  return {
    type: type,
    screenX: pageX,
    screenY: pageY,
    clientX: pageX,
    clientY: pageY
  };
};

DygraphOps.dispatchMouseDown_Point = function (g, x, y, custom) {
  var opts = DygraphOps.createOptsForPoint_(g, 'mousedown', x, y);
  opts.detail = 1;
  var event = DygraphOps.createEvent(opts, custom);
  DygraphOps.dispatchCanvasEvent(g, event);
};

DygraphOps.dispatchMouseMove_Point = function (g, x, y, custom) {
  var opts = DygraphOps.createOptsForPoint_(g, 'mousemove', x, y);
  var event = DygraphOps.createEvent(opts, custom);
  DygraphOps.dispatchCanvasEvent(g, event);
};

DygraphOps.dispatchMouseUp_Point = function (g, x, y, custom) {
  var opts = DygraphOps.createOptsForPoint_(g, 'mouseup', x, y);
  var event = DygraphOps.createEvent(opts, custom);
  DygraphOps.dispatchCanvasEvent(g, event);
};

DygraphOps.dispatchMouseOver_Point = function (g, x, y, custom) {
  var opts = DygraphOps.createOptsForPoint_(g, 'mouseover', x, y);
  var event = DygraphOps.createEvent(opts, custom);
  DygraphOps.dispatchCanvasEvent(g, event);
};

DygraphOps.dispatchMouseOut_Point = function (g, x, y, custom) {
  var opts = DygraphOps.createOptsForPoint_(g, 'mouseout', x, y);
  var event = DygraphOps.createEvent(opts, custom);
  DygraphOps.dispatchCanvasEvent(g, event);
};

/**
 * Dispatches a mouse down using the graph's data coordinate system.
 * (The y value mapped to the first axis.)
 */
DygraphOps.dispatchMouseDown = function (g, x, y, custom) {
  DygraphOps.dispatchMouseDown_Point(g, g.toDomXCoord(x), g.toDomYCoord(y), custom);
};

/**
 * Dispatches a mouse move using the graph's data coordinate system.
 * (The y value mapped to the first axis.)
 */
DygraphOps.dispatchMouseMove = function (g, x, y, custom) {
  DygraphOps.dispatchMouseMove_Point(g, g.toDomXCoord(x), g.toDomYCoord(y), custom);
};

/**
 * Dispatches a mouse up using the graph's data coordinate system.
 * (The y value mapped to the first axis.)
 */
DygraphOps.dispatchMouseUp = function (g, x, y, custom) {
  DygraphOps.dispatchMouseUp_Point(g, g.toDomXCoord(x), g.toDomYCoord(y), custom);
};

/**
 * Dispatches a mouse over using the graph's data coordinate system.
 * (The y value mapped to the first axis.)
 */
DygraphOps.dispatchMouseOver = function (g, x, y, custom) {
  DygraphOps.dispatchMouseOver_Point(g, g.toDomXCoord(x), g.toDomYCoord(y), custom);
};

/**
 * Dispatches a mouse out using the graph's data coordinate system.
 * (The y value mapped to the first axis.)
 */
DygraphOps.dispatchMouseOut = function (g, x, y, custom) {
  DygraphOps.dispatchMouseOut_Point(g, g.toDomXCoord(x), g.toDomYCoord(y), custom);
};

exports['default'] = DygraphOps;
module.exports = exports['default'];

},{"../../src/dygraph-utils":138}],3:[function(require,module,exports){
// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview A class to facilitate sampling colors at particular pixels on a
 * dygraph.
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

/**
 * @constructor
 */
Object.defineProperty(exports, "__esModule", {
  value: true
});
var PixelSampler = function PixelSampler(dygraph) {
  this.dygraph_ = dygraph;

  var canvas = dygraph.hidden_;
  var ctx = canvas.getContext("2d");
  this.imageData_ = ctx.getImageData(0, 0, canvas.width, canvas.height);
  this.scale = canvas.width / dygraph.width_;
};

/**
 * @param {number} x The screen x-coordinate at which to sample.
 * @param {number} y The screen y-coordinate at which to sample.
 * @return {Array.<number>} a 4D array: [R, G, B, alpha]. All four values
 * are in [0, 255]. A pixel which has never been touched will be [0,0,0,0].
 */
PixelSampler.prototype.colorAtPixel = function (x, y) {
  var i = 4 * (x * this.scale + this.imageData_.width * y * this.scale);
  var d = this.imageData_.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
};

/**
 * Convenience wrapper around colorAtPixel if you only care about RGB (not A).
 * @param {number} x The screen x-coordinate at which to sample.
 * @param {number} y The screen y-coordinate at which to sample.
 * @return {Array.<number>} a 3D array: [R, G, B]. All three values
 *     are in [0, 255]. A pixel which has never been touched will be [0,0,0].
 */
PixelSampler.prototype.rgbAtPixel = function (x, y) {
  return this.colorAtPixel(x, y).slice(0, 3);
};

/**
 * The method samples a color using data coordinates (not screen coordinates).
 * This will round your data coordinates to the nearest screen pixel before
 * sampling.
 * @param {number} x The data x-coordinate at which to sample.
 * @param {number} y The data y-coordinate at which to sample.
 * @return {Array.<number>} a 4D array: [R, G, B, alpha]. All four values
 * are in [0, 255]. A pixel which has never been touched will be [0,0,0,0].
 */
PixelSampler.prototype.colorAtCoordinate = function (x, y) {
  var dom_xy = this.dygraph_.toDomCoords(x, y);
  return this.colorAtPixel(Math.round(dom_xy[0]), Math.round(dom_xy[1]));
};

exports["default"] = PixelSampler;
module.exports = exports["default"];

},{}],4:[function(require,module,exports){
// Copyright (c) 2011 Google, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/** 
 * @fileoverview A general purpose object proxy that logs all method calls.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var Proxy = function Proxy(delegate) {
  this.delegate__ = delegate;
  this.calls__ = [];
  this.propertiesToTrack__ = [];

  for (var propname in delegate) {
    var type = typeof delegate[propname];

    // Functions are passed through to the delegate, and are logged
    // prior to the call.
    if (type == "function") {
      var makeFunc = function makeFunc(name) {
        return function () {
          this.log__(name, arguments);
          return this.delegate__[name].apply(this.delegate__, arguments);
        };
      };

      ;
      this[propname] = makeFunc(propname);
    } else if (type == "string" || type == "number") {
      var makeSetter = function makeSetter(name) {
        return function (x) {
          this.delegate__[name] = x;
        };
      };

      var makeGetter = function makeGetter(name) {
        return function () {
          return this.delegate__[name];
        };
      };

      // String and number properties are just passed through to the delegate.
      this.propertiesToTrack__.push(propname);
      ;
      this.__defineSetter__(propname, makeSetter(propname));

      ;
      this.__defineGetter__(propname, makeGetter(propname));
    }
  }
};

Proxy.prototype.log__ = function (name, args) {
  var properties = {};
  for (var propIdx in this.propertiesToTrack__) {
    var prop = this.propertiesToTrack__[propIdx];
    properties[prop] = this.delegate__[prop];
  }
  var call = { name: name, args: args, properties: properties };
  this.calls__.push(call);
};

Proxy.reset = function (proxy) {
  proxy.calls__ = [];
};

exports["default"] = Proxy;
module.exports = exports["default"];

},{}],5:[function(require,module,exports){
/** 
 * @fileoverview Utility functions for Dygraphs.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var Util = {};

/**
 * Get the y-labels for a given axis.
 *
 * You can specify a parent if more than one graph is in the document.
 */
Util.getYLabels = function (axis_num, parent) {
  axis_num = axis_num || "";
  parent = parent || document;
  var y_labels = parent.getElementsByClassName("dygraph-axis-label-y" + axis_num);
  var ary = [];
  for (var i = 0; i < y_labels.length; i++) {
    ary.push(y_labels[i].innerHTML.replace(/&#160;|&nbsp;/g, ' '));
  }
  return ary;
};

/**
 * Get the x-labels for a given axis.
 *
 * You can specify a parent if more than one graph is in the document.
 */
Util.getXLabels = function (parent) {
  parent = parent || document;
  var x_labels = parent.getElementsByClassName("dygraph-axis-label-x");
  var ary = [];
  for (var i = 0; i < x_labels.length; i++) {
    ary.push(x_labels[i].innerHTML.replace(/&#160;|&nbsp;/g, ' '));
  }
  return ary;
};

/**
 * Returns all text in tags w/ a given css class, sorted.
 * You can specify a parent if more than one graph is on the document.
 */
Util.getClassTexts = function (css_class, parent) {
  parent = parent || document;
  var texts = [];
  var els = parent.getElementsByClassName(css_class);
  for (var i = 0; i < els.length; i++) {
    texts[i] = els[i].textContent;
  }
  texts.sort();
  return texts;
};

// Convert &nbsp; to a normal space
Util.nbspToSpace = function (str) {
  var re = new RegExp(String.fromCharCode(160), 'g');
  return str.replace(re, ' ');
};

Util.getLegend = function (parent) {
  parent = parent || document;
  var legend = parent.getElementsByClassName("dygraph-legend")[0];
  return Util.nbspToSpace(legend.textContent);
};

/**
 * Assert that all elements have a certain style property.
 */
Util.assertStyleOfChildren = function (selector, property, expectedValue) {
  assert.isTrue(selector.length > 0);
  for (var idx = 0; idx < selector.length; idx++) {
    var child = selector[idx];
    assert.equal(expectedValue, window.getComputedStyle(child)[property]);
  }
};

/**
 * Takes in an array of strings and returns an array of floats.
 */
Util.makeNumbers = function (ary) {
  var ret = [];
  for (var i = 0; i < ary.length; i++) {
    ret.push(parseFloat(ary[i]));
  }
  return ret;
};

/**
 * Sample a pixel from the canvas.
 * Returns an [r, g, b, a] tuple where each values is in [0, 255].
 * This is _very_ slow! If you want to sample many pixels, use PixelSampler.
 */
Util.samplePixel = function (canvas, x, y) {
  var ctx = canvas.getContext("2d"); // bypasses Proxy if applied.

  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  var scale = utils.getContextPixelRatio(ctx);

  var i = 4 * (x * scale + imageData.width * y * scale);
  var d = imageData.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
};

/**
 * Overrides the browser's built-in XMLHttpRequest with a mock.
 * Usage:
 *
 * var mockXhr = Util.overrideXMLHttpRequest(your_data);
 * ... call code that does an XHR ...
 * mockXhr.respond();  // restores default behavior.
 * ... do your assertions ...
 */
Util.overrideXMLHttpRequest = function (data) {
  var originalXMLHttpRequest = XMLHttpRequest;

  var requests = [];
  var FakeXMLHttpRequest = function FakeXMLHttpRequest() {
    requests.push(this);
  };
  FakeXMLHttpRequest.prototype.open = function () {};
  FakeXMLHttpRequest.prototype.send = function () {
    this.readyState = 4;
    this.status = 200;
    this.responseText = data;
  };
  FakeXMLHttpRequest.restore = function () {
    window.XMLHttpRequest = originalXMLHttpRequest;
  };
  FakeXMLHttpRequest.respond = function () {
    for (var i = 0; i < requests.length; i++) {
      requests[i].onreadystatechange();
    }
    FakeXMLHttpRequest.restore();
  };
  window.XMLHttpRequest = FakeXMLHttpRequest;
  return FakeXMLHttpRequest;
};

/**
 * Format a date as 2000/01/23
 * @param {number} dateMillis Millis since epoch.
 * @return {string} The date formatted as YYYY-MM-DD.
 */
Util.formatDate = function (dateMillis) {
  return utils.dateString_(dateMillis).slice(0, 10); // 10 == "YYYY/MM/DD".length
};

/**
 * Capture console.{log,warn,error} statements into obj.
 * obj will look like {log:[], warn:[], error:[]}
 * This returns a function which will restore the original console.
 */
Util.captureConsole = function (obj) {
  obj.log = [];
  obj.warn = [];
  obj.error = [];
  var orig = [console.log, console.warn, console.error];
  console.log = function (text) {
    obj.log.push(text);
  };
  console.warn = function (text) {
    obj.warn.push(text);
  };
  console.error = function (text) {
    obj.error.push(text);
  };

  return function () {
    console.log = orig[0];
    console.warn = orig[1];
    console.error = orig[2];
  };
};

exports["default"] = Util;
module.exports = exports["default"];

},{"../../src/dygraph-utils":138}],6:[function(require,module,exports){
/**
 * @fileoverview Tests relating to annotations
 *
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("annotations", function () {

  cleanupAfterEach();

  it('testAnnotationsDrawn', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    g.setAnnotations([{
      series: 'Y',
      x: 1,
      shortText: 'A',
      text: 'Long A',
      cssClass: 'ann1'
    }, {
      series: 'Y',
      x: 2,
      shortText: 'B',
      text: 'Long B',
      cssClass: 'ann2'
    }]);

    assert.equal(2, g.annotations().length);
    var a1 = document.getElementsByClassName('ann1');
    assert.equal(1, a1.length);
    a1 = a1[0];
    assert.equal('A', a1.textContent);

    var a2 = document.getElementsByClassName('ann2');
    assert.equal(1, a2.length);
    a2 = a2[0];
    assert.equal('B', a2.textContent);
  });

  // Some errors that should be flagged:
  // 1. Invalid series name (e.g. 'X' or 'non-existent')
  // 2. Passing a string as 'x' instead of a number (e.g. x: '1')

  it('testAnnotationsDontDisappearOnResize', function () {
    var opts = {};
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    g.setAnnotations([{
      series: 'Y',
      x: 1,
      shortText: 'A',
      text: 'Long A',
      cssClass: 'ann1'
    }]);

    // Check that it displays at all
    assert.equal(1, g.annotations().length);
    var a1 = document.getElementsByClassName('ann1');
    assert.equal(1, a1.length);
    a1 = a1[0];
    assert.equal('A', a1.textContent);

    // ... and that resizing doesn't kill it.
    g.resize(400, 300);
    assert.equal(1, g.annotations().length);
    var a1 = document.getElementsByClassName('ann1');
    assert.equal(1, a1.length);
    a1 = a1[0];
    assert.equal('A', a1.textContent);
  });

  // Verify that annotations outside of the visible x-range are not shown.
  it('testAnnotationsOutOfRangeX', function () {
    var opts = {};
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    g.setAnnotations([{
      series: 'Y',
      x: 1,
      shortText: 'A',
      text: 'Long A',
      cssClass: 'ann1'
    }]);

    // Check that it displays at all
    assert.equal(1, g.annotations().length);
    var a1 = document.getElementsByClassName('ann1');
    assert.equal(1, a1.length);
    a1 = a1[0];
    assert.equal('A', a1.textContent);

    // ... and that panning right removes the annotation.
    g.updateOptions({ dateWindow: [2, 6] });
    assert.equal(1, g.annotations().length);
    a1 = document.getElementsByClassName('ann1');
    assert.equal(0, a1.length);

    // ... and that panning left brings it back.
    g.updateOptions({ dateWindow: [0, 4] });
    assert.equal(1, g.annotations().length);
    a1 = document.getElementsByClassName('ann1');
    assert.equal(1, a1.length);
  });

  // Verify that annotations outside of the visible y-range are not shown.
  it('testAnnotationsOutOfRangeY', function () {
    var opts = {};
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    g.setAnnotations([{
      series: 'Y',
      x: 1,
      shortText: 'A',
      text: 'Long A',
      cssClass: 'ann1'
    }]);

    // ... check that panning up removes the annotation.
    g.updateOptions({ valueRange: [0.5, 2.5] });
    assert.equal(1, g.annotations().length);
    var a1 = document.getElementsByClassName('ann1');
    assert.equal(0, a1.length);

    // ... and that panning down brings it back.
    g.updateOptions({ valueRange: [-1, 1] });
    assert.equal(1, g.annotations().length);
    a1 = document.getElementsByClassName('ann1');
    assert.equal(1, a1.length);
  });

  it('testAnnotationsDrawnInDrawCallback', function () {
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n";

    var graph = document.getElementById("graph");

    var calls = [];
    var g = new _srcDygraph2['default'](graph, data, {
      width: 480,
      height: 320,
      drawCallback: function drawCallback(g, initial) {
        calls.push(initial);
        if (initial) {
          g.setAnnotations([{
            series: 'Y',
            x: 1,
            shortText: 'A',
            text: 'Long A'
          }]);
        }
      }
    });

    assert.deepEqual([true, false], calls);
  });

  // Test that annotations on the same point are stacked.
  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=256
  it('testAnnotationsStacked', function () {
    var data = 'X,Y1,Y2\n' + '0,1,2\n' + '1,2,3\n';
    var graph = document.getElementById("graph");
    var annotations = [{
      series: 'Y1',
      x: 0,
      shortText: '1',
      attachAtBottom: true
    }, {
      series: 'Y2',
      x: 0,
      shortText: '2',
      attachAtBottom: true
    }];
    var g = new _srcDygraph2['default'](graph, data, {
      width: 480,
      height: 320
    });
    g.setAnnotations(annotations);

    var annEls = document.getElementsByClassName('dygraphDefaultAnnotation');
    assert.equal(2, annEls.length);

    assert.equal(annEls[0].offsetLeft, annEls[1].offsetLeft);
    assert(annEls[1].offsetTop < annEls[0].offsetTop - 10);
  });

  // Test the .ready() method, which is most often used with setAnnotations().
  it('testReady', function () {
    var data = 'X,Y1,Y2\n' + '0,1,2\n' + '1,2,3\n';
    var mockXhr = _Util2['default'].overrideXMLHttpRequest(data);

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, "data.csv", {
      width: 480,
      height: 320
    });

    var ready_calls = 0;
    g.ready(function () {
      ready_calls++;
    });

    assert.equal(0, ready_calls);
    mockXhr.respond();
    assert.equal(1, ready_calls);

    // Make sure that ready isn't called on redraws.
    g.updateOptions({});
    assert.equal(1, ready_calls);

    // Or data changes.
    g.updateOptions({ file: data });
    assert.equal(1, ready_calls);
  });
});

},{"../../src/dygraph":139,"./Util":5}],7:[function(require,module,exports){
/**
 * @fileoverview Test cases for how axis labels are chosen and formatted.
 *
 * @author dan@dygraphs.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _srcDygraphDefaultAttrs = require('../../src/dygraph-default-attrs');

var _srcDygraphDefaultAttrs2 = _interopRequireDefault(_srcDygraphDefaultAttrs);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

var _custom_asserts = require('./custom_asserts');

describe("axis-labels", function () {

  cleanupAfterEach();

  var simpleData = "X,Y,Y2\n" + "0,-1,.5\n" + "1,0,.7\n" + "2,1,.4\n" + "3,0,.98\n";

  var kCloseFloat = 1.0e-10;

  it('testMinusOneToOne', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    // TODO(danvk): would ['-1.0','-0.5','0.0','0.5','1.0'] be better?
    assert.deepEqual(['-1', '-0.5', '0', '0.5', '1'], _Util2['default'].getYLabels());

    // Go up to 2
    data += "4,2\n";
    g.updateOptions({ file: data });
    assert.deepEqual(['-1', '-0.5', '0', '0.5', '1', '1.5', '2'], _Util2['default'].getYLabels());

    // Now 10
    data += "5,10\n";
    g.updateOptions({ file: data });
    assert.deepEqual(['-2', '0', '2', '4', '6', '8', '10'], _Util2['default'].getYLabels());

    // Now 100
    data += "6,100\n";
    g.updateOptions({ file: data });
    assert.deepEqual(['0', '20', '40', '60', '80', '100'], _Util2['default'].getYLabels());

    g.setSelection(0);
    assert.equal('0: Y: -1', _Util2['default'].getLegend());
  });

  it('testSmallRangeNearZero', function () {
    var opts = {
      drawAxesAtZero: true,
      width: 480,
      height: 320
    };
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";
    opts.valueRange = [-0.1, 0.1];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    (0, _custom_asserts.assertDeepCloseTo)([-0.1, -0.05, 0, 0.05], _Util2['default'].makeNumbers(_Util2['default'].getYLabels()), kCloseFloat);

    opts.valueRange = [-0.05, 0.05];
    g.updateOptions(opts);
    assert.deepEqual([-0.04, -0.02, 0, 0.02, 0.04], _Util2['default'].makeNumbers(_Util2['default'].getYLabels()));

    opts.valueRange = [-0.01, 0.01];
    g.updateOptions(opts);
    assert.deepEqual([-0.01, -0.005, 0, 0.005], _Util2['default'].makeNumbers(_Util2['default'].getYLabels()));

    g.setSelection(1);
    assert.equal('1: Y: 0', _Util2['default'].getLegend());
  });

  it('testSmallRangeAwayFromZero', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";
    var graph = document.getElementById("graph");

    opts.valueRange = [9.9, 10.1];
    var g = new _srcDygraph2['default'](graph, data, opts);
    assert.deepEqual(["9.9", "9.92", "9.94", "9.96", "9.98", "10", "10.02", "10.04", "10.06", "10.08"], _Util2['default'].getYLabels());

    opts.valueRange = [9.99, 10.01];
    g.updateOptions(opts);
    // TODO(danvk): this is bad
    assert.deepEqual(["9.99", "9.99", "9.99", "10", "10", "10", "10", "10", "10.01", "10.01"], _Util2['default'].getYLabels());

    opts.valueRange = [9.999, 10.001];
    g.updateOptions(opts);
    // TODO(danvk): this is even worse!
    assert.deepEqual(["10", "10", "10", "10"], _Util2['default'].getYLabels());

    g.setSelection(1);
    assert.equal('1: Y: 0', _Util2['default'].getLegend());
  });

  it('testXAxisTimeLabelFormatter', function () {
    var opts = {
      width: 480,
      height: 320,
      labels: ['X', 'Y1']
    };
    var data = [[5.0, 0], [5.1, 1], [5.2, 2], [5.3, 3], [5.4, 4], [5.5, 5], [5.6, 6], [5.7, 7], [5.8, 8], [5.9, 9]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    g.updateOptions({
      axes: {
        x: {
          axisLabelFormatter: function axisLabelFormatter(totalMinutes) {
            var hours = Math.floor(totalMinutes / 60);
            var minutes = Math.floor(totalMinutes - hours * 60);
            var seconds = Math.round(totalMinutes * 60 - hours * 3600 - minutes * 60);

            if (hours < 10) hours = "0" + hours;
            if (minutes < 10) minutes = "0" + minutes;
            if (seconds < 10) seconds = "0" + seconds;

            return hours + ':' + minutes + ':' + seconds;
          }
        }
      }
    });

    assert.deepEqual(["00:05:00", "00:05:12", "00:05:24", "00:05:36", "00:05:48"], _Util2['default'].getXLabels());

    // The legend does not use the axisLabelFormatter:
    g.setSelection(1);
    assert.equal('5.1: Y1: 1', _Util2['default'].getLegend());
  });

  it('testAxisLabelFormatter', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          axisLabelFormatter: function axisLabelFormatter(x, granularity, opts, dg) {
            assert.equal('number', typeof x);
            assert.equal('number', typeof granularity);
            assert.equal('function', typeof opts);
            assert.equal('[Dygraph graph]', dg.toString());
            return 'x' + x;
          }
        },
        y: {
          axisLabelFormatter: function axisLabelFormatter(y, granularity, opts, dg) {
            assert.equal('number', typeof y);
            assert.equal('number', typeof granularity);
            assert.equal('function', typeof opts);
            assert.equal('[Dygraph graph]', dg.toString());
            return 'y' + y;
          }
        }
      },
      labels: ['x', 'y']
    };
    var data = [];
    for (var i = 0; i < 10; i++) {
      data.push([i, 2 * i]);
    }
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.deepEqual(['x0', 'x2', 'x4', 'x6', 'x8'], _Util2['default'].getXLabels());
    assert.deepEqual(["y0", "y5", "y10", "y15"], _Util2['default'].getYLabels());

    g.setSelection(2);
    assert.equal("2: y: 4", _Util2['default'].getLegend());
  });

  it('testDateAxisLabelFormatter', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          pixelsPerLabel: 60,
          axisLabelFormatter: function axisLabelFormatter(x, granularity, opts, dg) {
            assert.isTrue(utils.isDateLike(x));
            assert.equal('number', typeof granularity);
            assert.equal('function', typeof opts);
            assert.equal('[Dygraph graph]', dg.toString());
            return 'x' + _Util2['default'].formatDate(x);
          }
        },
        y: {
          axisLabelFormatter: function axisLabelFormatter(y, granularity, opts, dg) {
            assert.equal('number', typeof y);
            assert.equal('number', typeof granularity);
            assert.equal('function', typeof opts);
            assert.equal('[Dygraph graph]', dg.toString());
            return 'y' + y;
          }
        }
      },
      labels: ['x', 'y']
    };
    var data = [];
    for (var i = 1; i < 10; i++) {
      data.push([new Date("2011/01/0" + i), 2 * i]);
    }
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.deepEqual(["x2011/01/02", "x2011/01/04", "x2011/01/06", "x2011/01/08"], _Util2['default'].getXLabels());
    assert.deepEqual(["y5", "y10", "y15"], _Util2['default'].getYLabels());

    g.setSelection(0);
    assert.equal("2011/01/01: y: 2", _Util2['default'].getLegend());
  });

  // This test verifies that when a valueFormatter is set (but not an
  // axisLabelFormatter), then the valueFormatter is used to format the axis
  // labels.
  it('testValueFormatter', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          valueFormatter: function valueFormatter(x, opts, series_name, dg, row, col) {
            assert.equal('number', typeof x);
            assert.equal('function', typeof opts);
            assert.equal('string', typeof series_name);
            assert.equal('[Dygraph graph]', dg.toString());
            assert.equal('number', typeof row);
            assert.equal('number', typeof col);
            assert.equal(dg, this);
            return 'x' + x;
          }
        },
        y: {
          valueFormatter: function valueFormatter(y, opts, series_name, dg, row, col) {
            assert.equal('number', typeof y);
            assert.equal('function', typeof opts);
            assert.equal('string', typeof series_name);
            assert.equal('[Dygraph graph]', dg.toString());
            assert.equal('number', typeof row);
            assert.equal('number', typeof col);
            assert.equal(dg, this);
            return 'y' + y;
          }
        }
      },
      labels: ['x', 'y']
    };
    var data = [];
    for (var i = 0; i < 10; i++) {
      data.push([i, 2 * i]);
    }
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    // the valueFormatter options do not affect the ticks.
    assert.deepEqual(['0', '2', '4', '6', '8'], _Util2['default'].getXLabels());
    assert.deepEqual(["0", "5", "10", "15"], _Util2['default'].getYLabels());

    // they do affect the legend, however.
    g.setSelection(2);
    assert.equal("x2: y: y4", _Util2['default'].getLegend());
  });

  it('testDateValueFormatter', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          pixelsPerLabel: 60,
          valueFormatter: function valueFormatter(x, opts, series_name, dg, row, col) {
            assert.equal('number', typeof x);
            assert.equal('function', typeof opts);
            assert.equal('string', typeof series_name);
            assert.equal('[Dygraph graph]', dg.toString());
            assert.equal('number', typeof row);
            assert.equal('number', typeof col);
            assert.equal(dg, this);
            return 'x' + _Util2['default'].formatDate(x);
          }
        },
        y: {
          valueFormatter: function valueFormatter(y, opts, series_name, dg, row, col) {
            assert.equal('number', typeof y);
            assert.equal('function', typeof opts);
            assert.equal('string', typeof series_name);
            assert.equal('[Dygraph graph]', dg.toString());
            assert.equal('number', typeof row);
            assert.equal('number', typeof col);
            assert.equal(dg, this);
            return 'y' + y;
          }
        }
      },
      labels: ['x', 'y']
    };

    var data = [];
    for (var i = 1; i < 10; i++) {
      data.push([new Date("2011/01/0" + i), 2 * i]);
    }
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    // valueFormatters do not affect ticks.
    assert.deepEqual(["02 Jan", "04 Jan", "06 Jan", "08 Jan"], _Util2['default'].getXLabels());
    assert.deepEqual(["5", "10", "15"], _Util2['default'].getYLabels());

    // the valueFormatter options also affect the legend.
    g.setSelection(2);
    assert.equal('x2011/01/03: y: y6', _Util2['default'].getLegend());
  });

  // This test verifies that when both a valueFormatter and an axisLabelFormatter
  // are specified, the axisLabelFormatter takes precedence.
  it('testAxisLabelFormatterPrecedence', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          valueFormatter: function valueFormatter(x) {
            assert.equal('[Dygraph graph]', this.toString());
            return 'xvf' + x;
          },
          axisLabelFormatter: function axisLabelFormatter(x, granularity) {
            assert.equal('[Dygraph graph]', this.toString());
            return 'x' + x;
          }
        },
        y: {
          valueFormatter: function valueFormatter(y) {
            assert.equal('[Dygraph graph]', this.toString());
            return 'yvf' + y;
          },
          axisLabelFormatter: function axisLabelFormatter(y) {
            assert.equal('[Dygraph graph]', this.toString());
            return 'y' + y;
          }
        }
      },
      labels: ['x', 'y']
    };
    var data = [];
    for (var i = 0; i < 10; i++) {
      data.push([i, 2 * i]);
    }
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.deepEqual(['x0', 'x2', 'x4', 'x6', 'x8'], _Util2['default'].getXLabels());
    assert.deepEqual(["y0", "y5", "y10", "y15"], _Util2['default'].getYLabels());

    g.setSelection(9);
    assert.equal("xvf9: y: yvf18", _Util2['default'].getLegend());
  });

  // This is the same as the previous test, except that options are added
  // one-by-one.
  it('testAxisLabelFormatterIncremental', function () {
    var opts = {
      width: 480,
      height: 320,
      labels: ['x', 'y']
    };
    var data = [];
    for (var i = 0; i < 10; i++) {
      data.push([i, 2 * i]);
    }
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    g.updateOptions({
      axes: {
        x: {
          valueFormatter: function valueFormatter(x) {
            return 'xvf' + x;
          }
        }
      }
    });
    g.updateOptions({
      axes: {
        y: {
          valueFormatter: function valueFormatter(y) {
            return 'yvf' + y;
          }
        }
      }
    });
    g.updateOptions({
      axes: {
        x: {
          axisLabelFormatter: function axisLabelFormatter(x, granularity) {
            return 'x' + x;
          }
        }
      }
    });
    g.updateOptions({
      axes: {
        y: {
          axisLabelFormatter: function axisLabelFormatter(y) {
            return 'y' + y;
          }
        }
      }
    });

    assert.deepEqual(["x0", "x2", "x4", "x6", "x8"], _Util2['default'].getXLabels());
    assert.deepEqual(["y0", "y5", "y10", "y15"], _Util2['default'].getYLabels());

    g.setSelection(9);
    assert.equal("xvf9: y: yvf18", _Util2['default'].getLegend());
  });

  it('testGlobalFormatters', function () {
    var opts = {
      width: 480,
      height: 320,
      labels: ['x', 'y'],
      valueFormatter: function valueFormatter(x) {
        assert.equal('[Dygraph graph]', this);
        return 'vf' + x;
      },
      axisLabelFormatter: function axisLabelFormatter(x) {
        assert.equal('[Dygraph graph]', this);
        return 'alf' + x;
      }
    };
    var data = [];
    for (var i = 0; i < 10; i++) {
      data.push([i, 2 * i]);
    }
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.deepEqual(['alf0', 'alf2', 'alf4', 'alf6', 'alf8'], _Util2['default'].getXLabels());
    assert.deepEqual(["alf0", "alf5", "alf10", "alf15"], _Util2['default'].getYLabels());

    g.setSelection(9);
    assert.equal("vf9: y: vf18", _Util2['default'].getLegend());
  });

  it('testValueFormatterParameters', function () {
    var calls = [];
    // change any functions in list to 'fn' -- functions can't be asserted.
    var killFunctions = function killFunctions(list) {
      var out = [];
      for (var i = 0; i < list.length; i++) {
        if (typeof list[i] == 'function') {
          out[i] = 'fn';
        } else {
          out[i] = list[i];
        }
      }
      return out;
    };
    var taggedRecorder = function taggedRecorder(tag) {
      return function () {
        calls.push([tag].concat([this], killFunctions(arguments)));
        return '';
      };
    };
    var opts = {
      axes: {
        x: { valueFormatter: taggedRecorder('x') },
        y: { valueFormatter: taggedRecorder('y') },
        y2: { valueFormatter: taggedRecorder('y2') }
      },
      series: {
        'y1': { axis: 'y1' },
        'y2': { axis: 'y2' }
      },
      labels: ['x', 'y1', 'y2']
    };
    var data = [[0, 1, 2], [1, 3, 4]];
    var graph = document.getElementById('graph');
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.deepEqual([], calls);
    g.setSelection(0);
    assert.deepEqual([
    // num or millis, opts, series, dygraph, row, col
    ['x', g, 0, 'fn', 'x', g, 0, 0], ['y', g, 1, 'fn', 'y1', g, 0, 1], ['y2', g, 2, 'fn', 'y2', g, 0, 2]], calls);

    calls = [];
    g.setSelection(1);
    assert.deepEqual([['x', g, 1, 'fn', 'x', g, 1, 0], ['y', g, 3, 'fn', 'y1', g, 1, 1], ['y2', g, 4, 'fn', 'y2', g, 1, 2]], calls);
  });

  it('testSeriesOrder', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "x,00,01,10,11\n" + "0,101,201,301,401\n" + "1,102,202,302,402\n" + "2,103,203,303,403\n" + "3,104,204,304,404\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    g.setSelection(2);
    assert.equal('2: 00: 103 01: 203 10: 303 11: 403', _Util2['default'].getLegend());

    // Sanity checks for indexFromSetName
    assert.equal(0, g.indexFromSetName("x"));
    assert.equal(1, g.indexFromSetName("00"));
    assert.equal(null, g.indexFromSetName("abcde"));

    // Verify that we get the label list back in the right order
    assert.deepEqual(["x", "00", "01", "10", "11"], g.getLabels());
  });

  it('testLabelKMB', function () {
    var data = [];
    data.push([0, 0]);
    data.push([1, 2000]);
    data.push([2, 1000]);

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['X', 'bar'],
      axes: {
        y: {
          labelsKMB: true
        }
      }
    });

    assert.deepEqual(["0", "500", "1K", "1.5K", "2K"], _Util2['default'].getYLabels());
  });

  it('testLabelKMG2', function () {
    var data = [];
    data.push([0, 0]);
    data.push([1, 2000]);
    data.push([2, 1000]);

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['X', 'bar'],
      axes: {
        y: {
          labelsKMG2: true
        }
      }
    });

    assert.deepEqual(["0", "256", "512", "768", "1k", "1.25k", "1.5k", "1.75k", "2k"], _Util2['default'].getYLabels());
  });

  // Same as testLabelKMG2 but specifies the option at the
  // top of the option dictionary.
  it('testLabelKMG2_top', function () {
    var data = [];
    data.push([0, 0]);
    data.push([1, 2000]);
    data.push([2, 1000]);

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['X', 'bar'],
      labelsKMG2: true
    });

    assert.deepEqual(["0", "256", "512", "768", "1k", "1.25k", "1.5k", "1.75k", "2k"], _Util2['default'].getYLabels());
  });

  it('testSmallLabelKMB', function () {
    var data = [];
    data.push([0, 0]);
    data.push([1, 1e-6]);
    data.push([2, 2e-6]);

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['X', 'bar'],
      axes: {
        y: {
          labelsKMB: true
        }
      }
    });

    // TODO(danvk): use prefixes here (e.g. m, µ, n)
    assert.deepEqual(['0', '5.00e-7', '1.00e-6', '1.50e-6', '2.00e-6'], _Util2['default'].getYLabels());
  });

  it('testSmallLabelKMG2', function () {
    var data = [];
    data.push([0, 0]);
    data.push([1, 1e-6]);
    data.push([2, 2e-6]);

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['X', 'bar'],
      axes: {
        y: {
          labelsKMG2: true
        }
      }
    });

    // TODO(danvk): this is strange--the values aren't on powers of two, and are
    // these units really used for powers of two in <1? See issue #571.
    assert.deepEqual(['0', '0.48u', '0.95u', '1.43u', '1.91u'], _Util2['default'].getYLabels());
  });

  /**
   * Verify that log scale axis range is properly specified.
   */
  it('testLogScale', function () {
    var g = new _srcDygraph2['default']("graph", [[0, 5], [1, 1000]], {
      logscale: true,
      labels: ['X', 'Y']
    });
    var nonEmptyLabels = _Util2['default'].getYLabels().filter(function (x) {
      return x.length > 0;
    });
    assert.deepEqual(["5", "10", "20", "50", "100", "200", "500", "1000"], nonEmptyLabels);

    g.updateOptions({ logscale: false });
    assert.deepEqual(['0', '200', '400', '600', '800', '1000'], _Util2['default'].getYLabels());
  });

  /**
   * Verify that log scale axis range works with yRangePad.
   *
   * This is a regression test for https://github.com/danvk/dygraphs/issues/661 .
   */
  it('testLogScalePad', function () {
    var g = new _srcDygraph2['default']("graph", [[0, 1e-5], [1, 0.25], [2, 1], [3, 3], [4, 10]], {
      width: 250,
      height: 130,
      logscale: true,
      yRangePad: 30,
      axes: { y: { valueRange: [1, 10] } },
      labels: ['X', 'Y']
    });
    var nonEmptyLabels = _Util2['default'].getYLabels().filter(function (x) {
      return x.length > 0;
    });
    assert.deepEqual(['1', '7', '30'], nonEmptyLabels);

    g.updateOptions({ yRangePad: 10, axes: { y: { valueRange: [0.25005, 3] } } });
    nonEmptyLabels = _Util2['default'].getYLabels().filter(function (x) {
      return x.length > 0;
    });
    assert.deepEqual(['0.4', '1', '3'], nonEmptyLabels);

    g.updateOptions({ axes: { y: { valueRange: [0.01, 3] } } });
    nonEmptyLabels = _Util2['default'].getYLabels().filter(function (x) {
      return x.length > 0;
    });
    assert.deepEqual(['0.01', '0.1', '0.7', '5'], nonEmptyLabels);
  });

  /**
   * Verify that include zero range is properly specified.
   */
  it('testIncludeZero', function () {
    var g = new _srcDygraph2['default']("graph", [[0, 500], [1, 1000]], {
      includeZero: true,
      labels: ['X', 'Y1']
    });
    assert.deepEqual(['0', '200', '400', '600', '800', '1000'], _Util2['default'].getYLabels());

    g.updateOptions({ includeZero: false });
    assert.deepEqual(['500', '600', '700', '800', '900', '1000'], _Util2['default'].getYLabels());
  });

  it('testAxisLabelFontSize', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, simpleData, {});

    // Be sure we're dealing with a 14-point default.
    assert.equal(14, _srcDygraphDefaultAttrs2['default'].axisLabelFontSize);

    var assertFontSize = function assertFontSize(selector, expected) {
      _Util2['default'].assertStyleOfChildren(selector, "font-size", expected);
    };

    assertFontSize(document.querySelectorAll(".dygraph-axis-label-x"), "14px");
    assertFontSize(document.querySelectorAll(".dygraph-axis-label-y"), "14px");

    g.updateOptions({ axisLabelFontSize: 8 });
    assertFontSize(document.querySelectorAll(".dygraph-axis-label-x"), "8px");
    assertFontSize(document.querySelectorAll(".dygraph-axis-label-y"), "8px");

    g.updateOptions({
      axisLabelFontSize: null,
      axes: {
        x: { axisLabelFontSize: 5 }
      }
    });

    assertFontSize(document.querySelectorAll(".dygraph-axis-label-x"), "5px");
    assertFontSize(document.querySelectorAll(".dygraph-axis-label-y"), "14px");

    g.updateOptions({
      axes: {
        y: { axisLabelFontSize: 20 }
      }
    });

    assertFontSize(document.querySelectorAll(".dygraph-axis-label-x"), "5px");
    assertFontSize(document.querySelectorAll(".dygraph-axis-label-y"), "20px");

    g.updateOptions({
      series: {
        Y2: { axis: "y2" } // copy y2 series to y2 axis.
      },
      axes: {
        y2: { axisLabelFontSize: 12 }
      }
    });

    assertFontSize(document.querySelectorAll(".dygraph-axis-label-x"), "5px");
    assertFontSize(document.querySelectorAll(".dygraph-axis-label-y1"), "20px");
    assertFontSize(document.querySelectorAll(".dygraph-axis-label-y2"), "12px");
  });

  it('testAxisLabelFontSizeNull', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, simpleData, {
      axisLabelFontSize: null
    });

    var assertFontSize = function assertFontSize(selector, expected) {
      _Util2['default'].assertStyleOfChildren(selector, "font-size", expected);
    };

    // Be sure we're dealing with a 14-point default.
    assert.equal(14, _srcDygraphDefaultAttrs2['default'].axisLabelFontSize);

    assertFontSize(document.querySelectorAll(".dygraph-axis-label-x"), "14px");
    assertFontSize(document.querySelectorAll(".dygraph-axis-label-y"), "14px");
  });

  /*
   * This test shows that the label formatter overrides labelsKMB for all values.
   */
  it('testLabelFormatterOverridesLabelsKMB', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), "X,a,b\n" + "1,0,2000\n" + "2,500,1500\n" + "3,1000,1000\n" + "4,2000,0\n", {
      labelsKMB: true,
      axisLabelFormatter: function axisLabelFormatter(v) {
        return v + ":X";
      }
    });
    assert.deepEqual(["0:X", "500:X", "1000:X", "1500:X", "2000:X"], _Util2['default'].getYLabels());
    assert.deepEqual(["1:X", "2:X", "3:X"], _Util2['default'].getXLabels());
  });

  /*
   * This test shows that you can override labelsKMB on the axis level.
   */
  it('testLabelsKMBPerAxis', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), "x,a,b\n" + "1000,0,2000\n" + "2000,500,1500\n" + "3000,1000,1000\n" + "4000,2000,0\n", {
      labelsKMB: false,
      axes: {
        y2: { labelsKMB: true },
        x: { labelsKMB: true }
      },
      series: {
        b: { axis: "y2" }
      }
    });

    // labelsKMB doesn't apply to the x axis. This value should be different.
    // BUG : https://code.google.com/p/dygraphs/issues/detail?id=488
    assert.deepEqual(["1000", "2000", "3000"], _Util2['default'].getXLabels());
    assert.deepEqual(["0", "500", "1000", "1500", "2000"], _Util2['default'].getYLabels(1));
    assert.deepEqual(["0", "500", "1K", "1.5K", "2K"], _Util2['default'].getYLabels(2));
  });

  /*
   * This test shows that you can override labelsKMG2 on the axis level.
   */
  it('testLabelsKMBG2IPerAxis', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), "x,a,b\n" + "1000,0,2000\n" + "2000,500,1500\n" + "3000,1000,1000\n" + "4000,2000,0\n", {
      labelsKMG2: false,
      axes: {
        y2: { labelsKMG2: true },
        x: { labelsKMG2: true, pixelsPerLabel: 60 }
      },
      series: {
        b: { axis: "y2" }
      }
    });

    // It is weird that labelsKMG2 does something on the x axis but KMB does not.
    // Plus I can't be sure they're doing the same thing as they're done in different
    // bits of code.
    // BUG : https://code.google.com/p/dygraphs/issues/detail?id=488
    assert.deepEqual(["1024", "2048", "3072"], _Util2['default'].getXLabels());
    assert.deepEqual(["0", "500", "1000", "1500", "2000"], _Util2['default'].getYLabels(1));
    assert.deepEqual(["0", "500", "1000", "1.46k", "1.95k"], _Util2['default'].getYLabels(2));
  });

  /**
   * This test shows you can override sigFigs on the axis level.
   */
  it('testSigFigsPerAxis', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), "x,a,b\n" + "1000,0,2000\n" + "2000,500,1500\n" + "3000,1000,1000\n" + "4000,2000,0\n", {
      sigFigs: 2,
      axes: {
        y2: { sigFigs: 6 },
        x: { sigFigs: 8 }
      },
      series: {
        b: { axis: "y2" }
      }

    });
    // sigFigs doesn't apply to the x axis. This value should be different.
    // BUG : https://code.google.com/p/dygraphs/issues/detail?id=488
    assert.deepEqual(["1000", "2000", "3000"], _Util2['default'].getXLabels());
    assert.deepEqual(["0.0", "5.0e+2", "1.0e+3", "1.5e+3", "2.0e+3"], _Util2['default'].getYLabels(1));
    assert.deepEqual(["0.00000", "500.000", "1000.00", "1500.00", "2000.00"], _Util2['default'].getYLabels(2));
  });

  /**
   * This test shows you can override digitsAfterDecimal on the axis level.
   */
  it('testDigitsAfterDecimalPerAxis', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), "x,a,b\n" + "0.006,0.001,0.008\n" + "0.007,0.002,0.007\n" + "0.008,0.003,0.006\n" + "0.009,0.004,0.005\n", {
      digitsAfterDecimal: 1,
      series: {
        b: { axis: "y2" }
      }

    });

    g.updateOptions({ axes: { y: { digitsAfterDecimal: 3 } } });
    assert.deepEqual(["0.001", "0.002", "0.002", "0.003", "0.003", "0.004", "0.004"], _Util2['default'].getYLabels(1));
    g.updateOptions({ axes: { y: { digitsAfterDecimal: 4 } } });
    assert.deepEqual(["0.001", "0.0015", "0.002", "0.0025", "0.003", "0.0035", "0.004"], _Util2['default'].getYLabels(1));
    g.updateOptions({ axes: { y: { digitsAfterDecimal: 5 } } });
    assert.deepEqual(["0.001", "0.0015", "0.002", "0.0025", "0.003", "0.0035", "0.004"], _Util2['default'].getYLabels(1));
    g.updateOptions({ axes: { y: { digitsAfterDecimal: null } } });
    assert.deepEqual(["1e-3", "2e-3", "2e-3", "3e-3", "3e-3", "4e-3", "4e-3"], _Util2['default'].getYLabels(1));

    g.updateOptions({ axes: { y2: { digitsAfterDecimal: 3 } } });
    assert.deepEqual(["0.005", "0.006", "0.006", "0.007", "0.007", "0.008", "0.008"], _Util2['default'].getYLabels(2));
    g.updateOptions({ axes: { y2: { digitsAfterDecimal: 4 } } });
    assert.deepEqual(["0.005", "0.0055", "0.006", "0.0065", "0.007", "0.0075", "0.008"], _Util2['default'].getYLabels(2));
    g.updateOptions({ axes: { y2: { digitsAfterDecimal: 5 } } });
    assert.deepEqual(["0.005", "0.0055", "0.006", "0.0065", "0.007", "0.0075", "0.008"], _Util2['default'].getYLabels(2));
    g.updateOptions({ axes: { y2: { digitsAfterDecimal: null } } });
    assert.deepEqual(["5e-3", "6e-3", "6e-3", "7e-3", "7e-3", "7e-3", "8e-3"], _Util2['default'].getYLabels(2));

    // digitsAfterDecimal is ignored for the x-axis.
    // BUG : https://code.google.com/p/dygraphs/issues/detail?id=488
    g.updateOptions({ axes: { x: { digitsAfterDecimal: 3 } } });
    assert.deepEqual(["0.006", "0.007", "0.008"], _Util2['default'].getXLabels());
    g.updateOptions({ axes: { x: { digitsAfterDecimal: 4 } } });
    assert.deepEqual(["0.006", "0.007", "0.008"], _Util2['default'].getXLabels());
    g.updateOptions({ axes: { x: { digitsAfterDecimal: 5 } } });
    assert.deepEqual(["0.006", "0.007", "0.008"], _Util2['default'].getXLabels());
    g.updateOptions({ axes: { x: { digitsAfterDecimal: null } } });
    assert.deepEqual(["0.006", "0.007", "0.008"], _Util2['default'].getXLabels());
  });

  /**
   * This test shows you can override digitsAfterDecimal on the axis level.
   */
  it('testMaxNumberWidthPerAxis', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), "x,a,b\n" + "12401,12601,12804\n" + "12402,12602,12803\n" + "12403,12603,12802\n" + "12404,12604,12801\n", {
      maxNumberWidth: 1,
      series: {
        b: { axis: "y2" }
      }
    });

    g.updateOptions({ axes: { y: { maxNumberWidth: 4 } } });
    assert.deepEqual(["1.26e+4", "1.26e+4", "1.26e+4", "1.26e+4", "1.26e+4", "1.26e+4", "1.26e+4"], _Util2['default'].getYLabels(1));
    g.updateOptions({ axes: { y: { maxNumberWidth: 5 } } });
    assert.deepEqual(["12601", "12601.5", "12602", "12602.5", "12603", "12603.5", "12604"], _Util2['default'].getYLabels(1));
    g.updateOptions({ axes: { y: { maxNumberWidth: null } } });
    assert.deepEqual(["1.26e+4", "1.26e+4", "1.26e+4", "1.26e+4", "1.26e+4", "1.26e+4", "1.26e+4"], _Util2['default'].getYLabels(1));

    g.updateOptions({ axes: { y2: { maxNumberWidth: 4 } } });
    assert.deepEqual(["1.28e+4", "1.28e+4", "1.28e+4", "1.28e+4", "1.28e+4", "1.28e+4", "1.28e+4"], _Util2['default'].getYLabels(2));
    g.updateOptions({ axes: { y2: { maxNumberWidth: 5 } } });
    assert.deepEqual(["12801", "12801.5", "12802", "12802.5", "12803", "12803.5", "12804"], _Util2['default'].getYLabels(2));
    g.updateOptions({ axes: { y2: { maxNumberWidth: null } } });
    assert.deepEqual(["1.28e+4", "1.28e+4", "1.28e+4", "1.28e+4", "1.28e+4", "1.28e+4", "1.28e+4"], _Util2['default'].getYLabels(2));

    // maxNumberWidth is ignored for the x-axis.
    // BUG : https://code.google.com/p/dygraphs/issues/detail?id=488
    g.updateOptions({ axes: { x: { maxNumberWidth: 4 } } });
    assert.deepEqual(["12401", "12402", "12403"], _Util2['default'].getXLabels());
    g.updateOptions({ axes: { x: { maxNumberWidth: 5 } } });
    assert.deepEqual(["12401", "12402", "12403"], _Util2['default'].getXLabels());
    g.updateOptions({ axes: { x: { maxNumberWidth: null } } });
    assert.deepEqual(["12401", "12402", "12403"], _Util2['default'].getXLabels());
  });

  /*
  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=147
  // Checks that axis labels stay sane across a DST change.
  it('testLabelsCrossDstChange', function() {
    // (From tests/daylight-savings.html)
    var g = new Dygraph(
        document.getElementById("graph"),
        "Date/Time,Purchases\n" +
        "2010-11-05 00:00:00,167082\n" +
        "2010-11-06 00:00:00,168571\n" +
        "2010-11-07 00:00:00,177796\n" +
        "2010-11-08 00:00:00,165587\n" +
        "2010-11-09 00:00:00,164380\n",
        { width: 1024 }
        );
  
    // Dates and "nice" hours: 6AM/PM and noon, not 5AM/11AM/...
    var okLabels = {
      '05Nov': true,
      '06Nov': true,
      '07Nov': true,
      '08Nov': true,
      '09Nov': true,
      '06:00': true,
      '12:00': true,
      '18:00': true
    };
  
    var xLabels = Util.getXLabels();
    for (var i = 0; i < xLabels.length; i++) {
      assert.isTrue(okLabels[xLabels[i]]);
    }
  
    // This range had issues of its own on tests/daylight-savings.html.
    g.updateOptions({
      dateWindow: [1289109997722.8127, 1289261208937.7659]
    });
    xLabels = Util.getXLabels();
    for (var i = 0; i < xLabels.length; i++) {
      assert.isTrue(okLabels[xLabels[i]]);
    }
  });
  
  
  // Tests data which crosses a "fall back" at a high enough frequency that you
  // can see both 1:00 A.M.s.
  it('testLabelsCrossDstChangeHighFreq', function() {
    // Generate data which crosses the EST/EDT boundary.
    var dst_data = [];
    var base_ms = 1383454200000;
    for (var x = base_ms; x < base_ms + 1000 * 60 * 80; x += 1000) {
      dst_data.push([new Date(x), x]);
    }
  
    var g = new Dygraph(
            document.getElementById("graph"),
            dst_data,
        { width: 1024, labels: ['Date', 'Value'] }
        );
  
    assert.deepEqual([
      '00:50', '00:55',
      '01:00', '01:05', '01:10', '01:15', '01:20', '01:25',
      '01:30', '01:35', '01:40', '01:45', '01:50', '01:55',
      '01:00', '01:05'  // 1 AM number two!
    ], Util.getXLabels());
  
    // Now zoom past the initial 1 AM. This used to cause trouble.
    g.updateOptions({
      dateWindow: [1383454200000 + 15*60*1000, g.xAxisExtremes()[1]]}
    );
    assert.deepEqual([
      '01:05', '01:10', '01:15', '01:20', '01:25',
      '01:30', '01:35', '01:40', '01:45', '01:50', '01:55',
      '01:00', '01:05'  // 1 AM number two!
    ], Util.getXLabels());
  });
  
  
  // Tests data which crosses a "spring forward" at a low frequency.
  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=433
  it('testLabelsCrossSpringForward', function() {
    var g = new Dygraph(
        document.getElementById("graph"),
        "Date/Time,Purchases\n" +
        "2011-03-11 00:00:00,167082\n" +
        "2011-03-12 00:00:00,168571\n" +
        "2011-03-13 00:00:00,177796\n" +
        "2011-03-14 00:00:00,165587\n" +
        "2011-03-15 00:00:00,164380\n",
        {
          width: 1024,
          dateWindow: [1299989043119.4365, 1300080693627.4866]
        });
  
    var okLabels = {
      '13Mar': true,
      // '02:00': true,  // not a real time!
      '04:00': true,
      '06:00': true,
      '08:00': true,
      '10:00': true,
      '12:00': true,
      '14:00': true,
      '16:00': true,
      '18:00': true,
      '20:00': true,
      '22:00': true,
      '14Mar': true
    };
  
    var xLabels = Util.getXLabels();
    for (var i = 0; i < xLabels.length; i++) {
      assert.isTrue(okLabels[xLabels[i]]);
    }
  });
  
  it('testLabelsCrossSpringForwardHighFreq', function() {
    var base_ms_spring = 1299999000000;
    var dst_data_spring = [];
    for (var x = base_ms_spring; x < base_ms_spring + 1000 * 60 * 80; x += 1000) {
      dst_data_spring.push([new Date(x), x]);
    }
  
    var g = new Dygraph(
        document.getElementById("graph"),
        dst_data_spring,
        { width: 1024, labels: ['Date', 'Value'] }
    );
  
    assert.deepEqual([
      '01:50', '01:55',
      '03:00', '03:05', '03:10', '03:15', '03:20', '03:25',
      '03:30', '03:35', '03:40', '03:45', '03:50', '03:55',
      '04:00', '04:05'
    ], Util.getXLabels());
  });
  */
});

},{"../../src/dygraph":139,"../../src/dygraph-default-attrs":131,"../../src/dygraph-utils":138,"./Util":5,"./custom_asserts":11}],8:[function(require,module,exports){
/**
 * @fileoverview Test cases for the callbacks.
 *
 * @author uemit.seren@gmail.com (Ümit Seren)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

describe("callback", function () {

  cleanupAfterEach();

  var xhr, styleSheet;
  var graph;

  beforeEach(function () {
    var container = document.getElementById('graph');
    container.innerHTML = "<div id='inner-graph'></div><div id='selection'></div>";
    graph = container.querySelector('#inner-graph');
    xhr = XMLHttpRequest;
    styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    document.getElementsByTagName("head")[0].appendChild(styleSheet);
  });

  afterEach(function () {
    window.XMLHttpRequest = xhr;
  });

  var data = "X,a,b,c\n" + "10,-1,1,2\n" + "11,0,3,1\n" + "12,1,4,2\n" + "13,0,2,3\n";

  /**
   * This tests that when the function idxToRow_ returns the proper row and the onHiglightCallback
   * is properly called when the  first series is hidden (setVisibility = false)
   *
   */
  it('testHighlightCallbackIsCalled', function () {
    var h_row;
    var h_pts;

    var highlightCallback = function highlightCallback(e, x, pts, row) {
      assert.equal(g, this);
      h_row = row;
      h_pts = pts;
    };

    var g = new _srcDygraph2['default'](graph, data, {
      width: 100,
      height: 100,
      visibility: [false, true, true],
      highlightCallback: highlightCallback
    });

    _DygraphOps2['default'].dispatchMouseMove(g, 13, 10);

    //check correct row is returned
    assert.equal(3, h_row);
    //check there are only two points (because first series is hidden)
    assert.equal(2, h_pts.length);
  });

  /**
   * Test that drawPointCallback isn't called when drawPoints is false
   */
  it('testDrawPointCallback_disabled', function () {
    var called = false;

    var callback = function callback() {
      assert.equal(g, this);
      called = true;
    };

    var g = new _srcDygraph2['default'](graph, data, {
      drawPointCallback: callback
    });

    assert.isFalse(called);
  });

  /**
   * Test that drawPointCallback is called when drawPoints is true
   */
  it('testDrawPointCallback_enabled', function () {
    var called = false;
    var callbackThis = null;

    var callback = function callback() {
      callbackThis = this;
      called = true;
    };

    var g = new _srcDygraph2['default'](graph, data, {
      drawPoints: true,
      drawPointCallback: callback
    });

    assert.isTrue(called);
    assert.equal(g, callbackThis);
  });

  /**
   * Test that drawPointCallback is called when drawPoints is true
   */
  it('testDrawPointCallback_pointSize', function () {
    var pointSize = 0;
    var count = 0;

    var callback = function callback(g, seriesName, canvasContext, cx, cy, color, pointSizeParam) {
      assert.equal(g, this);
      pointSize = pointSizeParam;
      count++;
    };

    var g = new _srcDygraph2['default'](graph, data, {
      drawPoints: true,
      drawPointCallback: callback
    });

    assert.equal(1.5, pointSize);
    assert.equal(12, count); // one call per data point.

    var g = new _srcDygraph2['default'](graph, data, {
      drawPoints: true,
      drawPointCallback: callback,
      pointSize: 8
    });

    assert.equal(8, pointSize);
  });

  /**
   * Test that drawPointCallback is called for isolated points when
   * drawPoints is false, and also for gap points if that's enabled.
   */
  it('testDrawPointCallback_isolated', function () {
    var xvalues = [];

    var g;
    var callback = function callback(g, seriesName, canvasContext, cx, cy, color, pointSizeParam) {
      assert.equal(g, this);
      var dx = g.toDataXCoord(cx);
      xvalues.push(dx);
      utils.Circles.DEFAULT.apply(this, arguments);
    };

    var testdata = [[10, 2], [11, 3], [12, NaN], [13, 2], [14, NaN], [15, 3]];
    var graphOpts = {
      labels: ['X', 'Y'],
      valueRange: [0, 4],
      drawPoints: false,
      drawPointCallback: callback,
      pointSize: 8
    };

    // Test that isolated points get drawn
    g = new _srcDygraph2['default'](graph, testdata, graphOpts);
    assert.equal(2, xvalues.length);
    assert.equal(13, xvalues[0]);
    assert.equal(15, xvalues[1]);

    // Test that isolated points + gap points get drawn when
    // drawGapEdgePoints is set.  This should add one point at the right
    // edge of the segment at x=11, but not at the graph edge at x=10.
    xvalues = []; // Reset for new test
    graphOpts.drawGapEdgePoints = true;
    g = new _srcDygraph2['default'](graph, testdata, graphOpts);
    assert.equal(3, xvalues.length);
    assert.equal(11, xvalues[0]);
    assert.equal(13, xvalues[1]);
    assert.equal(15, xvalues[2]);
  });

  /**
   * This tests that when the function idxToRow_ returns the proper row and the onHiglightCallback
   * is properly called when the first series is hidden (setVisibility = false)
   *
   */
  it('testDrawHighlightPointCallbackIsCalled', function () {
    var called = false;

    var drawHighlightPointCallback = function drawHighlightPointCallback() {
      assert.equal(g, this);
      called = true;
    };

    var g = new _srcDygraph2['default'](graph, data, {
      width: 100,
      height: 100,
      drawHighlightPointCallback: drawHighlightPointCallback
    });

    assert.isFalse(called);
    _DygraphOps2['default'].dispatchMouseMove(g, 13, 10);
    assert.isTrue(called);
  });

  /**
   * Test the closest-series highlighting methods for normal and stacked modes.
   * Also pass in line widths for plain and highlighted lines for easier visual
   * confirmation that the highlighted line is drawn on top of the others.
   */
  var runClosestTest = function runClosestTest(isStacked, widthNormal, widthHighlighted) {
    var h_row;
    var h_pts;
    var h_series;

    var g = new _srcDygraph2['default'](graph, data, {
      width: 600,
      height: 400,
      visibility: [false, true, true],
      stackedGraph: isStacked,
      strokeWidth: widthNormal,
      strokeBorderWidth: 2,
      highlightCircleSize: widthNormal * 2,
      highlightSeriesBackgroundAlpha: 0.3,

      highlightSeriesOpts: {
        strokeWidth: widthHighlighted,
        highlightCircleSize: widthHighlighted * 2
      }
    });

    var highlightCallback = function highlightCallback(e, x, pts, row, set) {
      assert.equal(g, this);
      h_row = row;
      h_pts = pts;
      h_series = set;
      document.getElementById('selection').innerHTML = 'row=' + row + ', set=' + set;
    };

    g.updateOptions({ highlightCallback: highlightCallback }, true);

    if (isStacked) {
      _DygraphOps2['default'].dispatchMouseMove(g, 11.45, 1.4);
      assert.equal(1, h_row);
      assert.equal('c', h_series);

      //now move up in the same row
      _DygraphOps2['default'].dispatchMouseMove(g, 11.45, 1.5);
      assert.equal(1, h_row);
      assert.equal('b', h_series);

      //and a bit to the right
      _DygraphOps2['default'].dispatchMouseMove(g, 11.55, 1.5);
      assert.equal(2, h_row);
      assert.equal('c', h_series);
    } else {
      _DygraphOps2['default'].dispatchMouseMove(g, 11, 1.5);
      assert.equal(1, h_row);
      assert.equal('c', h_series);

      //now move up in the same row
      _DygraphOps2['default'].dispatchMouseMove(g, 11, 2.5);
      assert.equal(1, h_row);
      assert.equal('b', h_series);
    }

    return g;
  };

  /**
   * Test basic closest-point highlighting.
   */
  it('testClosestPointCallback', function () {
    runClosestTest(false, 1, 3);
  });

  /**
   * Test setSelection() with series name
   */
  it('testSetSelection', function () {
    var g = runClosestTest(false, 1, 3);
    assert.equal(1, g.attr_('strokeWidth', 'c'));
    g.setSelection(false, 'c');
    assert.equal(3, g.attr_('strokeWidth', 'c'));
  });

  /**
   * Test closest-point highlighting for stacked graph
   */
  it('testClosestPointStackedCallback', function () {
    runClosestTest(true, 1, 3);
  });

  /**
   * Closest-point highlighting with legend CSS - border around active series.
   */
  it('testClosestPointCallbackCss1', function () {
    var css = "div.dygraph-legend > span { display: block; }\n" + "div.dygraph-legend > span.highlight { border: 1px solid grey; }\n";
    styleSheet.innerHTML = css;
    runClosestTest(false, 2, 4);
    styleSheet.innerHTML = '';
  });

  /**
   * Closest-point highlighting with legend CSS - show only closest series.
   */
  it('testClosestPointCallbackCss2', function () {
    var css = "div.dygraph-legend > span { display: none; }\n" + "div.dygraph-legend > span.highlight { display: inline; }\n";
    styleSheet.innerHTML = css;
    runClosestTest(false, 10, 15);
    styleSheet.innerHTML = '';
    // TODO(klausw): verify that the highlighted line is drawn on top?
  });

  /**
   * Closest-point highlighting with locked series.
   */
  it('testSetSelectionLocking', function () {
    var g = runClosestTest(false, 2, 4);

    // Default behavior, 'b' is closest
    _DygraphOps2['default'].dispatchMouseMove(g, 11, 4);
    assert.equal('b', g.getHighlightSeries());

    // Now lock selection to 'c'
    g.setSelection(false, 'c', true);
    _DygraphOps2['default'].dispatchMouseMove(g, 11, 4);
    assert.equal('c', g.getHighlightSeries());

    // Unlock, should be back to 'b'
    g.clearSelection();
    _DygraphOps2['default'].dispatchMouseMove(g, 11, 4);
    assert.equal('b', g.getHighlightSeries());
  });

  /**
   * This tests that closest point searches work for data containing NaNs.
   *
   * It's intended to catch a regression where a NaN Y value confuses the
   * closest-point algorithm, treating it as closer as any previous point.
   */
  it('testNaNData', function () {
    var dataNaN = [[9, -1, NaN, NaN], [10, -1, 1, 2], [11, 0, 3, 1], [12, 1, 4, NaN], [13, 0, 2, 3], [14, -1, 1, 4]];

    var h_row;
    var h_pts;

    var highlightCallback = function highlightCallback(e, x, pts, row) {
      assert.equal(g, this);
      h_row = row;
      h_pts = pts;
    };

    var g = new _srcDygraph2['default'](graph, dataNaN, {
      width: 600,
      height: 400,
      labels: ['x', 'a', 'b', 'c'],
      visibility: [false, true, true],
      highlightCallback: highlightCallback
    });

    _DygraphOps2['default'].dispatchMouseMove(g, 10.1, 0.9);
    //check correct row is returned
    assert.equal(1, h_row);

    // Explicitly test closest point algorithms
    var dom = g.toDomCoords(10.1, 0.9);
    assert.equal(1, g.findClosestRow(dom[0]));

    var res = g.findClosestPoint(dom[0], dom[1]);
    assert.equal(1, res.row);
    assert.equal('b', res.seriesName);

    res = g.findStackedPoint(dom[0], dom[1]);
    assert.equal(1, res.row);
    assert.equal('c', res.seriesName);
  });

  /**
   * This tests that stacked point searches work for data containing NaNs.
   */
  it('testNaNDataStack', function () {
    var dataNaN = [[9, -1, NaN, NaN], [10, -1, 1, 2], [11, 0, 3, 1], [12, 1, NaN, 2], [13, 0, 2, 3], [14, -1, 1, 4], [15, 0, 2, NaN], [16, 1, 1, 3], [17, 1, NaN, 3], [18, 0, 2, 5], [19, 0, 1, 4]];

    var h_row;
    var h_pts;

    var highlightCallback = function highlightCallback(e, x, pts, row) {
      assert.equal(g, this);
      h_row = row;
      h_pts = pts;
    };

    var g = new _srcDygraph2['default'](graph, dataNaN, {
      width: 600,
      height: 400,
      labels: ['x', 'a', 'b', 'c'],
      visibility: [false, true, true],
      stackedGraph: true,
      highlightCallback: highlightCallback
    });

    _DygraphOps2['default'].dispatchMouseMove(g, 10.1, 0.9);
    //check correct row is returned
    assert.equal(1, h_row);

    // Explicitly test stacked point algorithm.
    var dom = g.toDomCoords(10.1, 0.9);
    var res = g.findStackedPoint(dom[0], dom[1]);
    assert.equal(1, res.row);
    assert.equal('c', res.seriesName);

    // All-NaN area at left, should get no points.
    dom = g.toDomCoords(9.1, 0.9);
    res = g.findStackedPoint(dom[0], dom[1]);
    assert.equal(0, res.row);
    assert.equal(undefined, res.seriesName);

    // First gap, get 'c' since it's non-NaN.
    dom = g.toDomCoords(12.1, 0.9);
    res = g.findStackedPoint(dom[0], dom[1]);
    assert.equal(3, res.row);
    assert.equal('c', res.seriesName);

    // Second gap, get 'b' since 'c' is NaN.
    dom = g.toDomCoords(15.1, 0.9);
    res = g.findStackedPoint(dom[0], dom[1]);
    assert.equal(6, res.row);
    assert.equal('b', res.seriesName);

    // Isolated points should work, finding series b in this case.
    dom = g.toDomCoords(15.9, 3.1);
    res = g.findStackedPoint(dom[0], dom[1]);
    assert.equal(7, res.row);
    assert.equal('b', res.seriesName);
  });

  it('testGapHighlight', function () {
    var dataGap = [[1, null, 3], [2, 2, null], [3, null, 5], [4, 4, null], [5, null, 7], [6, NaN, null], [8, 8, null], [10, 10, null]];

    var h_row;
    var h_pts;

    var highlightCallback = function highlightCallback(e, x, pts, row) {
      assert.equal(g, this);
      h_row = row;
      h_pts = pts;
    };

    var g = new _srcDygraph2['default'](graph, dataGap, {
      width: 400,
      height: 300,
      //stackedGraph: true,
      connectSeparatedPoints: true,
      drawPoints: true,
      labels: ['x', 'A', 'B'],
      highlightCallback: highlightCallback
    });

    _DygraphOps2['default'].dispatchMouseMove(g, 1.1, 10);
    //point from series B
    assert.equal(0, h_row);
    assert.equal(1, h_pts.length);
    assert.equal(3, h_pts[0].yval);
    assert.equal('B', h_pts[0].name);

    _DygraphOps2['default'].dispatchMouseMove(g, 6.1, 10);
    // A is NaN at x=6
    assert.equal(1, h_pts.length);
    assert(isNaN(h_pts[0].yval));
    assert.equal('A', h_pts[0].name);

    _DygraphOps2['default'].dispatchMouseMove(g, 8.1, 10);
    //point from series A
    assert.equal(6, h_row);
    assert.equal(1, h_pts.length);
    assert.equal(8, h_pts[0].yval);
    assert.equal('A', h_pts[0].name);
  });

  it('testFailedResponse', function () {

    // Fake out the XMLHttpRequest so it doesn't do anything.
    XMLHttpRequest = function () {};
    XMLHttpRequest.prototype.open = function () {};
    XMLHttpRequest.prototype.send = function () {};

    var highlightCallback = function highlightCallback(e, x, pts, row) {
      throw "should not reach here";
    };

    graph.style.border = "2px solid black";
    var g = new _srcDygraph2['default'](graph, "data.csv", { // fake name
      width: 400,
      height: 300,
      highlightCallback: highlightCallback
    });

    _DygraphOps2['default'].dispatchMouseOver_Point(g, 800, 800);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 100, 100);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 800, 800);

    var oldOnerror = window.onerror;
    var failed = false;
    window.onerror = function () {
      failed = true;return false;
    };

    _DygraphOps2['default'].dispatchMouseOut_Point(g, 800, 800); // This call should not throw an exception.

    assert.isFalse(failed, "exception thrown during mouseout");
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=355
  it('testHighlightCallbackRow', function () {
    var highlightRow;
    var highlightCallback = function highlightCallback(e, x, pts, row) {
      assert.equal(g, this);
      highlightRow = row;
    };

    var g = new _srcDygraph2['default'](graph, "X,Y,Z\n" + "0,1,2\n" + // 0
    "1,2,3\n" + // 100
    "2,3,4\n" + // 200
    "3,4,5\n" + // 300
    "4,5,6\n", // 400
    { // fake name
      width: 400,
      height: 300,
      highlightCallback: highlightCallback
    });

    // Mouse over each of the points
    _DygraphOps2['default'].dispatchMouseOver_Point(g, 0, 0);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 0, 0);
    assert.equal(0, highlightRow);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 100, 0);
    assert.equal(1, highlightRow);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 200, 0);
    assert.equal(2, highlightRow);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 300, 0);
    assert.equal(3, highlightRow);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 400, 0);
    assert.equal(4, highlightRow);

    // Now zoom and verify that the row numbers still refer to rows in the data
    // array.
    g.updateOptions({ dateWindow: [2, 4] });
    _DygraphOps2['default'].dispatchMouseOver_Point(g, 0, 0);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 0, 0);
    assert.equal(2, highlightRow);
    assert.equal('2: Y: 3 Z: 4', _Util2['default'].getLegend());
  });

  /**
   * Test that underlay callback is called even when there are no series,
   * and that the y axis ranges are not NaN.
   */
  it('testUnderlayCallback_noSeries', function () {
    var called = false;
    var yMin, yMax;

    var callback = function callback(canvas, area, g) {
      assert.equal(g, this);
      called = true;
      yMin = g.yAxisRange(0)[0];
      yMax = g.yAxisRange(0)[1];
    };

    var g = new _srcDygraph2['default'](graph, "\n", {
      underlayCallback: callback
    });

    assert.isTrue(called);
    assert.isFalse(isNaN(yMin));
    assert.isFalse(isNaN(yMax));
  });

  /**
   * Test that underlay callback receives the correct y-axis range.
   */
  it('testUnderlayCallback_yAxisRange', function () {
    var called = false;
    var yMin, yMax;

    var callback = function callback(canvas, area, g) {
      assert.equal(g, this);
      yMin = g.yAxisRange(0)[0];
      yMax = g.yAxisRange(0)[1];
    };

    var g = new _srcDygraph2['default'](graph, "\n", {
      valueRange: [0, 10],
      underlayCallback: callback
    });

    assert.equal(0, yMin);
    assert.equal(10, yMax);
  });

  /**
   * Test that drawPointCallback is called for isolated points and correct idx for the point is returned.
   */
  it('testDrawPointCallback_idx', function () {
    var indices = [];

    var g;
    var callback = function callback(g, seriesName, canvasContext, cx, cy, color, pointSizeParam, idx) {
      assert.equal(g, this);
      indices.push(idx);
      utils.Circles.DEFAULT.apply(this, arguments);
    };

    var testdata = [[10, 2], [11, 3], [12, NaN], [13, 2], [14, NaN], [15, 3]];
    var graphOpts = {
      labels: ['X', 'Y'],
      valueRange: [0, 4],
      drawPoints: false,
      drawPointCallback: callback,
      pointSize: 8
    };

    // Test that correct idx for isolated points are passed to the callback.
    g = new _srcDygraph2['default'](graph, testdata, graphOpts);
    assert.equal(2, indices.length);
    assert.deepEqual([3, 5], indices);

    // Test that correct indices for isolated points + gap points are passed to the callback when
    // drawGapEdgePoints is set.  This should add one point at the right
    // edge of the segment at x=11, but not at the graph edge at x=10.
    indices = []; // Reset for new test
    graphOpts.drawGapEdgePoints = true;
    g = new _srcDygraph2['default'](graph, testdata, graphOpts);
    assert.equal(3, indices.length);
    assert.deepEqual([1, 3, 5], indices);

    //Test that correct indices are passed to the callback when zoomed in.
    indices = []; // Reset for new test
    graphOpts.dateWindow = [12.5, 13.5];
    graphOpts.drawPoints = true;
    testdata = [[10, 2], [11, 3], [12, 4], [13, 2], [14, 5], [15, 3]];
    g = new _srcDygraph2['default'](graph, testdata, graphOpts);
    assert.equal(3, indices.length);
    assert.deepEqual([2, 3, 4], indices);
  });

  /**
   * Test that the correct idx is returned for the point in the onHiglightCallback.
   */
  it('testDrawHighlightPointCallback_idx', function () {
    var idxToCheck = null;

    var drawHighlightPointCallback = function drawHighlightPointCallback(g, seriesName, canvasContext, cx, cy, color, pointSizeParam, idx) {
      assert.equal(g, this);
      idxToCheck = idx;
    };
    var testdata = [[1, 2], [2, 3], [3, NaN], [4, 2], [5, NaN], [6, 3]];
    var g = new _srcDygraph2['default'](graph, testdata, {
      drawHighlightPointCallback: drawHighlightPointCallback,
      labels: ['X', 'Y']
    });

    assert.isNull(idxToCheck);
    _DygraphOps2['default'].dispatchMouseMove(g, 3, 0);
    // check that NaN point is not highlighted
    assert.isNull(idxToCheck);
    _DygraphOps2['default'].dispatchMouseMove(g, 1, 2);
    // check that correct index is returned
    assert.equal(0, idxToCheck);
    _DygraphOps2['default'].dispatchMouseMove(g, 6, 3);
    assert.equal(5, idxToCheck);
  });

  /**
   * Test that drawCallback is called with the correct value for `this`.
   */
  it('should set this in drawCallback', function () {
    var g = new _srcDygraph2['default']('graph', data, {
      drawCallback: function drawCallback(g, is_initial) {
        assert.isTrue(is_initial);
        assert.equal(g, this);
      }
    });
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./DygraphOps":2,"./Util":5}],9:[function(require,module,exports){
/**
 * @fileoverview Test cases for the option "connectSeparatedPoints" especially for the scenario where not every series has a value for each timestamp.
 *
 * @author julian.eichstaedt@ch.sauter-bc.com (Fr. Sauter AG)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

describe("connect-separated-points", function () {

  cleanupAfterEach();

  var origFunc = utils.getContext;

  beforeEach(function () {
    utils.getContext = function (canvas) {
      return new _Proxy2['default'](origFunc(canvas));
    };
  });

  afterEach(function () {
    _srcDygraph2['default'].getContext = origFunc;
  });

  it('testEdgePointsSimple', function () {
    var opts = {
      width: 480,
      height: 320,
      labels: ["x", "series1", "series2", "additionalSeries"],
      connectSeparatedPoints: true,
      dateWindow: [2.5, 7.5]
    };

    var data = [[0, -1, 0, null], [1, null, 2, null], [2, null, 4, null], [3, 0.5, 0, null], [4, 1, -1, 5], [5, 2, -2, 6], [6, 2.5, -2.5, 7], [7, 3, -3, null], [8, 4, null, null], [9, 4, -10, null]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {};

    // Test if series1 is drawn correctly.
    // ------------------------------------

    // The first point of the first series
    var x1 = data[0][0];
    var y1 = data[0][1];
    var xy1 = g.toDomCoords(x1, y1);

    // The next valid point of this series
    var x2 = data[3][0];
    var y2 = data[3][1];
    var xy2 = g.toDomCoords(x2, y2);

    // Check if both points are connected at the left edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if series2 is drawn correctly.
    // ------------------------------------

    // The last point of the second series.
    var x2 = data[9][0];
    var y2 = data[9][2];
    var xy2 = g.toDomCoords(x2, y2);

    // The previous valid point of this series
    var x1 = data[7][0];
    var y1 = data[7][2];
    var xy1 = g.toDomCoords(x1, y1);

    // Check if both points are connected at the right edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
  });

  it('testEdgePointsCustomBars', function () {
    var opts = {
      width: 480,
      height: 320,
      labels: ["x", "series1", "series2", "additionalSeries"],
      connectSeparatedPoints: true,
      dateWindow: [2.5, 7.5],
      customBars: true
    };

    var data = [[0, [4, 5, 6], [1, 2, 3], [null, null, null]], [1, [null, null, null], [2, 3, 4], [null, null, null]], [2, [null, null, null], [3, 4, 5], [null, null, null]], [3, [0, 1, 2], [2, 3, 4], [null, null, null]], [4, [1, 2, 3], [2, 3, 4], [4, 5, 6]], [5, [1, 2, 3], [3, 4, 5], [4, 5, 6]], [6, [0, 1, 2], [4, 5, 6], [5, 6, 7]], [7, [0, 1, 2], [4, 5, 6], [null, null, null]], [8, [2, 3, 4], [null, null, null], [null, null, null]], [9, [0, 1, 2], [2, 4, 9], [null, null, null]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {};

    // Test if values of the series1 are drawn correctly.
    // ------------------------------------

    // The first point of the first series
    var x1 = data[0][0];
    var y1 = data[0][1][1];
    var xy1 = g.toDomCoords(x1, y1);

    // The next valid point of this series
    var x2 = data[3][0];
    var y2 = data[3][1][1];
    var xy2 = g.toDomCoords(x2, y2);

    // Check if both points are connected at the left edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if the custom bars of the series1 are drawn correctly
    // --------------------------------------------

    // The first min-point of this series
    x1 = data[0][0];
    y1 = data[0][1][0];
    xy1 = g.toDomCoords(x1, y1);

    // The next valid min-point of the second series.
    x2 = data[3][0];
    y2 = data[3][1][0];
    xy2 = g.toDomCoords(x2, y2);

    // Check if both points are connected at the left edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // The first max-point of this series
    x1 = data[0][0];
    y1 = data[0][1][2];
    xy1 = g.toDomCoords(x1, y1);

    // The next valid max-point of the second series.
    x2 = data[3][0];
    y2 = data[3][1][2];
    xy2 = g.toDomCoords(x2, y2);

    // Check if both points are connected at the left edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if values of the series2 are drawn correctly.
    // ------------------------------------

    // The last point of the second series.
    var x2 = data[9][0];
    var y2 = data[9][2][1];
    var xy2 = g.toDomCoords(x2, y2);

    // The previous valid point of this series
    var x1 = data[7][0];
    var y1 = data[7][2][1];
    var xy1 = g.toDomCoords(x1, y1);

    // Check if both points are connected at the right edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if the custom bars of the series2 are drawn correctly
    // --------------------------------------------

    // The last min-point of the second series.
    x2 = data[9][0];
    y2 = data[9][2][0];
    xy2 = g.toDomCoords(x2, y2);

    // The previous valid min-point of this series
    x1 = data[7][0];
    y1 = data[7][2][0];
    xy1 = g.toDomCoords(x1, y1);

    // Check if both points are connected at the right edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // The last max-point of the second series.
    x2 = data[9][0];
    y2 = data[9][2][2];
    xy2 = g.toDomCoords(x2, y2);

    // The previous valid max-point of this series
    x1 = data[7][0];
    y1 = data[7][2][2];
    xy1 = g.toDomCoords(x1, y1);

    // Check if both points are connected at the right edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
  });

  it('testEdgePointsErrorBars', function () {
    var opts = {
      width: 480,
      height: 320,
      labels: ["x", "series1", "series2", "seriesTestHelper"],
      connectSeparatedPoints: true,
      dateWindow: [2, 7.5],
      errorBars: true

    };

    var data = [[0, [5, 1], [2, 1], [null, null]], [1, [null, null], [3, 1], [null, null]], [2, [null, null], [4, 1], [null, null]], [3, [1, 1], [3, 1], [null, null]], [4, [2, 1], [3, 1], [5, 1]], [5, [2, 1], [4, 1], [5, 1]], [6, [1, 1], [5, 1], [6, 1]], [7, [1, 1], [5, 1], [null, null]], [8, [3, 1], [null, null], [null, null]], [9, [1, 1], [4, 1], [null, null]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {};

    // Test if values of the series1 are drawn correctly.
    // ------------------------------------

    // The first point of the first series
    var x1 = data[0][0];
    var y1 = data[0][1][0];
    var xy1 = g.toDomCoords(x1, y1);

    // The next valid point of this series
    var x2 = data[3][0];
    var y2 = data[3][1][0];
    var xy2 = g.toDomCoords(x2, y2);

    // Check if both points are connected at the left edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if the upper error bars of series1 are drawn correctly
    // --------------------------------------------

    // The first upper error-point of this series
    x1 = data[0][0];
    var y1error = y1 + data[0][1][1] * 2;
    xy1 = g.toDomCoords(x1, y1error);

    // The next valid upper error-point of the second series.
    x2 = data[3][0];
    var y2error = y2 + data[3][1][1] * 2;
    xy2 = g.toDomCoords(x2, y2error);

    // Check if both points are connected at the left edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if the lower error bars of series1 are drawn correctly
    // --------------------------------------------

    // The first lower error-point of this series
    x1 = data[0][0];
    y1error = y1 - data[0][1][1] * 2;
    xy1 = g.toDomCoords(x1, y1error);

    //The next valid lower error-point of the second series.
    x2 = data[3][0];
    y2error = y2 - data[3][1][1] * 2;
    xy2 = g.toDomCoords(x2, y2error);

    // Check if both points are connected at the left edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if values of the series2 are drawn correctly.
    // ------------------------------------

    // The last point of this series
    x2 = data[9][0];
    y2 = data[9][2][0];
    xy2 = g.toDomCoords(x2, y2);

    // The previous valid point of the first series
    x1 = data[7][0];
    y1 = data[7][2][0];
    xy1 = g.toDomCoords(x1, y1);

    // Check if both points are connected at the right edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if the upper error bars of series2 are drawn correctly
    // --------------------------------------------

    // The last upper error-point of the second series.
    x2 = data[9][0];
    var y2error = y2 + data[9][2][1] * 2;
    xy2 = g.toDomCoords(x2, y2error);

    // The previous valid upper error-point of this series
    x1 = data[7][0];
    var y1error = y1 + data[7][2][1] * 2;
    xy1 = g.toDomCoords(x1, y1error);

    // Check if both points are connected at the right edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

    // Test if the lower error bars of series1 are drawn correctly
    // --------------------------------------------

    // The last lower error-point of the second series.
    x2 = data[9][0];
    y2error = y2 - data[9][2][1] * 2;
    xy2 = g.toDomCoords(x2, y2error);

    // The previous valid lower error-point of this series
    x1 = data[7][0];
    y1error = y1 - data[7][2][1] * 2;
    xy1 = g.toDomCoords(x1, y1error);

    // Check if both points are connected at the right edge of the canvas and if the option "connectSeparatedPoints" works properly
    // even if the point is outside the visible range and only one series has a valid value for this point.
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
  });

  it('testConnectSeparatedPointsPerSeries', function () {
    var assertExpectedLinesDrawnPerSeries = function assertExpectedLinesDrawnPerSeries(htx, expectedSeries1, expectedSeries2, expectedSeries3) {
      var expected = [expectedSeries1, expectedSeries2, expectedSeries3];
      var actual = [_CanvasAssertions2['default'].numLinesDrawn(htx, "#ff0000"), _CanvasAssertions2['default'].numLinesDrawn(htx, "#00ff00"), _CanvasAssertions2['default'].numLinesDrawn(htx, "#0000ff")];
      assert.deepEqual(expected, actual);
    };

    var g = new _srcDygraph2['default'](document.getElementById("graph"), [[1, 10, 10, 10], [2, 15, 11, 12], [3, null, null, 12], [4, 20, 14, null], [5, 15, null, 17], [6, 18, null, null], [7, 12, 14, null]], {
      labels: ["Date", "Series1", "Series2", "Series3"],
      connectSeparatedPoints: false,
      colors: ["#ff0000", "#00ff00", "#0000ff"]
    });

    var htx = g.hidden_ctx_;
    assertExpectedLinesDrawnPerSeries(htx, 4, 1, 2);

    _Proxy2['default'].reset(htx);
    g.updateOptions({
      connectSeparatedPoints: true
    });
    assertExpectedLinesDrawnPerSeries(htx, 5, 3, 3);

    _Proxy2['default'].reset(htx);
    g.updateOptions({
      connectSeparatedPoints: false,
      series: {
        Series1: { connectSeparatedPoints: true }
      }
    });
    assertExpectedLinesDrawnPerSeries(htx, 5, 1, 2);

    _Proxy2['default'].reset(htx);
    g.updateOptions({
      connectSeparatedPoints: true,
      series: {
        Series1: { connectSeparatedPoints: false }
      }
    });
    assertExpectedLinesDrawnPerSeries(htx, 4, 3, 3);
  });

  it('testNaNErrorBars', function () {
    var data = [[0, [1, 2, 3]], [1, [2, 3, 4]], [2, [3, 4, 5]], [3, [null, null, null]], [4, [2, 3, 4]], [5, [3, 4, 5]], [6, [2, 3, 4]], [7, [NaN, NaN, NaN]], [8, [2, 3, 4]], [9, [2, 3, 4]], [10, [2, 3, 4]], [11, [2, 3, 4]]];

    var opts = {
      labels: ["x", "y"],
      colors: ["#ff0000"],
      customBars: true,
      connectSeparatedPoints: true
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {};

    // Line should be drawn across the null gap.
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(data[2][0], data[2][1][1]), g.toDomCoords(data[4][0], data[4][1][1]), attrs);

    // No line across the NaN gap, and a single line (not two)
    // across the null gap.
    assert.equal(8, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./Proxy":4}],10:[function(require,module,exports){
// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Regression test based on some strange customBars data.
 * @author danvk@google.com (Dan Vanderkam)
 */

"use strict";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

describe("css", function () {

  cleanupAfterEach();

  var data = "X,Y,Z\n1,2,3\n4,5,6\n";

  var styleSheet;

  beforeEach(function () {
    styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    document.getElementsByTagName("head")[0].appendChild(styleSheet);
  });

  afterEach(function () {
    styleSheet.innerHTML = '';
  });

  // Verifies that an unstyled, unsized dygraph gets a default size.
  it('testDefaultSize', function () {
    var opts = {};
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, opts);

    assert.equal(480, graph.offsetWidth);
    assert.equal(320, graph.offsetHeight);
    assert.deepEqual({ width: 480, height: 320 }, g.size());
  });

  // Verifies that the width/height parameters work.
  it('testExplicitParamSize', function () {
    var opts = {
      width: 640,
      height: 480
    };
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, opts);

    assert.equal(640, graph.offsetWidth);
    assert.equal(480, graph.offsetHeight);
    assert.deepEqual({ width: 640, height: 480 }, g.size());
  });

  // Verifies that setting a style on the div works.
  it('testExplicitStyleSize', function () {
    var opts = {};
    var graph = document.getElementById("graph");
    graph.style.width = '600px';
    graph.style.height = '400px';

    var g = new _srcDygraph2["default"](graph, data, opts);
    assert.equal(600, graph.offsetWidth);
    assert.equal(400, graph.offsetHeight);
    assert.deepEqual({ width: 600, height: 400 }, g.size());
  });

  // Verifies that CSS pixel styles on the div trump explicit parameters.
  it('testPixelStyleWins', function () {
    var opts = {
      width: 987,
      height: 654
    };
    var graph = document.getElementById("graph");
    graph.style.width = '600px';
    graph.style.height = '400px';

    var g = new _srcDygraph2["default"](graph, data, opts);
    assert.equal(600, graph.offsetWidth);
    assert.equal(400, graph.offsetHeight);
    assert.deepEqual({ width: 600, height: 400 }, g.size());
  });

  // Verifies that a CSS percentage size works.
  it('testPercentageSize', function () {
    var testdiv = document.getElementById("graph");
    testdiv.innerHTML = '<div style="width: 600px; height: 400px;">' + '<div id="inner-graph"></div></div>';
    var opts = {};
    var graph = document.getElementById("inner-graph");
    graph.style.width = '50%';
    graph.style.height = '50%';

    var g = new _srcDygraph2["default"](graph, data, opts);
    assert.equal(300, graph.offsetWidth);
    assert.equal(200, graph.offsetHeight);
    assert.deepEqual({ width: 300, height: 200 }, g.size());
  });

  // Verifies that a CSS class size works.
  it('testClassPixelSize', function () {
    styleSheet.innerHTML = '.chart { width: 456px; height: 345px; }';

    var opts = {};
    var graph = document.getElementById("graph");
    graph.className = "chart";
    var g = new _srcDygraph2["default"](graph, data, opts);
    assert.equal(456, graph.offsetWidth);
    assert.equal(345, graph.offsetHeight);
    assert.deepEqual({ width: 456, height: 345 }, g.size());
  });

  // An invisible chart div shouldn't produce an error.
  it('testInvisibleChart', function () {
    graph.innerHTML = '<div style="display:none;">' + '<div id="inner-graph" style="width: 640px; height: 480px;"></div>' + '</div>';
    new _srcDygraph2["default"]('inner-graph', data, {});
  });

  // An invisible chart div shouldn't produce an error.
  it('testInvisibleChartDate', function () {
    graph.innerHTML = '<div style="display:none;">' + '<div id="inner-graph" style="width: 640px; height: 480px;"></div>' + '</div>';
    new _srcDygraph2["default"]('inner-graph', "Date,Y\n" + "2010/01/01,100\n" + "2010/02/01,200\n" + "2010/03/01,300\n" + "2010/04/01,400\n" + "2010/05/01,300\n" + "2010/06/01,100\n", {});
  });

  // An invisible chart div that becomes visible.
  it('testInvisibleThenVisibleChart', function () {
    var testdiv = document.getElementById("graph");
    testdiv.innerHTML = '<div id="x" style="display:none;">' + '<div id="inner-graph" style="width: 640px; height: 480px;"></div>' + '</div>';
    var graph = document.getElementById("inner-graph");
    var g = new _srcDygraph2["default"](graph, "Date,Y\n" + "2010/01/01,100\n" + "2010/02/01,200\n" + "2010/03/01,300\n" + "2010/04/01,400\n" + "2010/05/01,300\n" + "2010/06/01,100\n", {});

    // g.size() is undefined here (probably 0x0)
    document.getElementById("x").style.display = "";

    // This resize() call is annoying but essential.
    // There are no DOM events to inform the dygraph that its div has changed size
    // or visibility so we need to let it know ourselves.
    g.resize();

    assert.equal(640, graph.offsetWidth);
    assert.equal(480, graph.offsetHeight);
    assert.deepEqual({ width: 640, height: 480 }, g.size());
  });

  // Verifies that a div resize gets picked up.
  /*
    this one isn't quite ready yet.
  it('testDivResize', function() {
    var opts = {
    };
    var graph = document.getElementById("graph");
    graph.style.width = '640px';
    graph.style.height = '480px';
    var g = new Dygraph(graph, data, opts);
  
    assert.equal(640, graph.offsetWidth);
    assert.equal(480, graph.offsetHeight);
    assert.deepEqual({width: 640, height: 480}, g.size());
  
    graph.style.width = '650px';
    graph.style.height = '490px';
    assert.equal(650, graph.offsetWidth);
    assert.equal(490, graph.offsetHeight);
    assert.deepEqual({width: 650, height: 490}, g.size());
  });
  */
});

},{"../../src/dygraph":139}],11:[function(require,module,exports){
/**
 * @fileoverview Assertions that chai doesn't provide out of the box.
 */

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.assertDeepCloseTo = assertDeepCloseTo;

function assertDeepCloseTo(actualArray, expectedArray, epsilon) {
  assert.isArray(actualArray);
  assert.isArray(expectedArray);
  for (var i = 0; i < actualArray.length; i++) {
    assert.closeTo(actualArray[i], expectedArray[i], epsilon);
  }
}

;

},{}],12:[function(require,module,exports){
// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Regression test based on some strange customBars data.
 * @author danvk@google.com (Dan Vanderkam)
 */
'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _PixelSampler = require('./PixelSampler');

var _PixelSampler2 = _interopRequireDefault(_PixelSampler);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

describe("custom-bars", function () {

  cleanupAfterEach();

  var _origFunc = utils.getContext;
  beforeEach(function () {
    utils.getContext = function (canvas) {
      return new _Proxy2['default'](_origFunc(canvas));
    };
  });

  afterEach(function () {
    utils.getContext = _origFunc;
  });

  // This test used to reliably produce an infinite loop.
  it('testCustomBarsNoHang', function () {
    var opts = {
      width: 480,
      height: 320,
      customBars: true
    };
    var data = "X,Y1,Y2\n" + "1,1178.0;1527.5;1856.6,0;22365658;0\n" + "2,1253.0;1303.3;1327.3,0;22368228;0\n" + "3,878.0;1267.0;1357.1,0;22368895;0\n" + "4,1155.0;1273.1;1303.5,0;22369665;0\n" + "5,1089.0;1294.8;1355.3,0;22370160;0\n" + "6,1088.0;1268.6;1336.1,0;22372346;0\n" + "7,1141.0;1269.1;1301.2,0;22373318;0\n" + "8,1072.0;1255.8;1326.2,0;22374310;0\n" + "9,1209.0;1309.2;1351.8,0;22374924;0\n" + "10,1230.0;1303.9;1332.6,0;22380163;0\n" + "11,1014.0;1263.5;1330.8,0;22381117;0\n" + "12,853.0;1215.6;1330.6,0;22381556;0\n" + "13,1134.0;1581.9;1690.1,0;22384631;0\n" + "14,1113.0;1540.1;1676.5,0;22386933;0\n" + "15,1130.0;1542.7;1678.3,0;22393459;0\n" + "18,1582.0;1644.4;1690.2,0;22395914;0\n" + "19,878.0;1558.3;1708.1,0;22397732;0\n" + "20,1076.0;1598.4;1723.8,0;22397886;0\n" + "21,1077.0;1574.0;1685.3,0;22398659;0\n" + "22,1118.0;1590.4;1697.6,0;22399009;0\n" + "23,1031.0;1473.1;1644.9,0;22401969;0\n" + "24,1090.0;1480.7;1640.0,0;22417989;0\n" + "25,1592.0;1681.7;1714.4,0;22422819;0\n" + "26,1251.0;1657.8;1750.6,0;22423681;0\n" + "27,1144.0;1660.9;1776.2,0;22426947;0\n" + "28,1178.0;1642.4;1745.6,0;22428238;0\n" + "29,1169.0;1649.1;1757.5,0;22429524;0\n" + "30,1150.0;1596.1;1746.7,0;22433472;0\n" + "31,1099.0;1586.5;1732.8,0;22434308;0\n" + "32,1120.0;1456.0;1620.3,0;22434821;0\n" + "33,1640.0;1687.7;1709.0,0;22434882;0\n" + "34,1671.0;1712.1;1733.7,0;22435116;0\n" + "35,,0;22437620;0\n";
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=201
  it('testCustomBarsZero', function () {
    var opts = {
      customBars: true
    };
    var data = "X,Y1,Y2\n" + "1,1;2;3,0;0;0\n" + "2,2;3;4,0;0;0\n" + "3,1;3;5,0;0;0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var range = g.yAxisRange();
    assert.isTrue(range[0] <= 0, 'y-axis must include 0');
    assert.isTrue(range[1] >= 5, 'y-axis must include 5');
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=229
  it('testCustomBarsAtTop', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), [[1, [10, 10, 100]], [1, [10, 10, 100]], [2, [15, 20, 110]], [3, [10, 30, 100]], [4, [15, 40, 110]], [5, [10, 120, 100]], [6, [15, 50, 110]], [7, [10, 70, 100]], [8, [15, 90, 110]], [9, [10, 50, 100]]], {
      width: 500, height: 350,
      customBars: true,
      errorBars: true,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      valueRange: [0, 120],
      fillAlpha: 0.15,
      colors: ['#00FF00'],
      labels: ['X', 'Y']
    });

    var sampler = new _PixelSampler2['default'](g);
    assert.deepEqual([0, 255, 0, 38], sampler.colorAtCoordinate(5, 60));
  });

  // Tests that custom bars work with log scale.
  it('testCustomBarsLogScale', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), [[1, [10, 10, 100]], [5, [15, 120, 80]], [9, [10, 50, 100]]], {
      width: 500, height: 350,
      customBars: true,
      errorBars: true,
      valueRange: [1, 120],
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      fillAlpha: 1.0,
      logscale: true,
      colors: ['#00FF00'],
      labels: ['X', 'Y']
    });

    // The following assertions describe the sides of the custom bars, which are
    // drawn in two halves.
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(g.hidden_ctx_, [[0, 13.329014086362069], [247.5, 29.64240889852502], [247.5, 152.02209814465604], [0, 181.66450704318103]], { fillStyle: "#00ff00" });

    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(g.hidden_ctx_, [[247.5, 29.64240889852502], [495, 13.329014086362069], [495, 181.66450704318103], [247.5, 152.02209814465604]], { fillStyle: "#00ff00" });
  });

  it('testCustomBarsWithNegativeValuesInLogScale', function () {
    var graph = document.getElementById("graph");

    var count = 0;
    var drawPointCallback = function drawPointCallback() {
      count++;
    };

    var g = new _srcDygraph2['default'](graph, [[1, [10, 20, 30]], [2, [5, 10, 15]], [3, [-1, 5, 10]]], {
      drawPoints: true,
      drawPointCallback: drawPointCallback,
      customBars: true,
      labels: ['X', 'Y']
    });

    // Normally all three points would be drawn.
    assert.equal(3, count);
    count = 0;

    // In log scale, the third point shouldn't be shown.
    g.updateOptions({ logscale: true });
    assert.equal(2, count);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./PixelSampler":3,"./Proxy":4}],13:[function(require,module,exports){
/**
 * @fileoverview Tests for data access methods.
 *
 * @author danvdk@gmail.com (Dan Vanderkam)
 */
'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

describe("data-api", function () {

  cleanupAfterEach();

  var opts, graphDiv;

  beforeEach(function () {
    opts = {
      width: 480,
      height: 320
    };

    graphDiv = document.getElementById("graph");
  });

  it('testBasicAccessors', function () {
    var g = new _srcDygraph2['default'](graphDiv, temperature_data, opts);

    assert.equal(365, g.numRows());
    assert.equal(3, g.numColumns());

    // 2007-01-01,62,39
    assert.equal(62, g.getValue(0, 1));
    assert.equal(39, g.getValue(0, 2));

    // 2007-12-31,57,42
    assert.equal(57, g.getValue(364, 1));
    assert.equal(42, g.getValue(364, 2));
  });

  it('testAccessorsCustomBars', function () {
    var g = new _srcDygraph2['default'](graphDiv, data_temp_high_low, {
      customBars: true
    });

    assert.equal(1070, g.numRows());
    assert.equal(3, g.numColumns());

    // 2007-01-01,46;51;56,43;45;48
    assert.deepEqual([46, 51, 56], g.getValue(0, 1));
    assert.deepEqual([43, 45, 48], g.getValue(0, 2));

    // 2009-12-05,37;42;47  (i.e. missing second column)
    assert.deepEqual([37, 42, 47], g.getValue(1069, 1));
    assert.deepEqual([null, null, null], g.getValue(1069, 2));
  });

  // Regression test for #554.
  it('testGetRowForX', function () {
    var g = new _srcDygraph2['default'](graphDiv, ["x,y", "1,2", "3,4", "5,6", "7,8", "9,10"].join('\n'), opts);

    assert.equal(null, g.getRowForX(0));
    assert.equal(0, g.getRowForX(1));
    assert.equal(null, g.getRowForX(2));
    assert.equal(1, g.getRowForX(3));
    assert.equal(null, g.getRowForX(4));
    assert.equal(2, g.getRowForX(5));
    assert.equal(null, g.getRowForX(6));
    assert.equal(3, g.getRowForX(7));
    assert.equal(null, g.getRowForX(8));
    assert.equal(4, g.getRowForX(9));
    assert.equal(null, g.getRowForX(10));
  });

  // If there are rows with identical x-values, getRowForX promises that it will
  // return the first one.
  it('testGetRowForXDuplicates', function () {
    var g = new _srcDygraph2['default'](graphDiv, ["x,y", "1,2", // 0
    "1,4", // 1
    "1,6", // 2
    "1,8", // 3
    "1,6", // 4
    "9,2", // 5
    "9,4", "9,6", "9,8", "9,10"].join('\n'), opts);

    assert.equal(0, g.getRowForX(1));
    assert.equal(null, g.getRowForX(2));
    assert.equal(5, g.getRowForX(9));
  });

  // indexFromSeriesName should return a value even if the series is invisible
  // In 1.1.1, if you request the last set and it's invisible, the method returns undefined.
  it('testIndexFromSetNameOnInvisibleSet', function () {

    var localOpts = utils.clone(opts);
    localOpts.visibility = [true, false];

    var g = new _srcDygraph2['default'](graphDiv, ["x,y1,y2", "1,1,1", "2,2,2", "3,3,3"].join('\n'), localOpts);

    assert.equal(2, g.indexFromSetName("y2"));
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138}],14:[function(require,module,exports){
/**
 * @fileoverview Tests that various formats of date are understood by dygraphs.
 *
 * @author dan@dygraphs.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

describe("date-formats", function () {

  it('testISO8601', function () {
    // Format: YYYY-MM-DDTHH:MM:SS.ddddddZ
    // The "Z" indicates UTC, so this test should pass regardless of the time
    // zone of the machine on which it is run.

    // Firefox <4 does not support this format:
    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Date/parse
    if (navigator.userAgent.indexOf("Firefox/3.5") == -1) {
      assert.equal(946816496789, utils.dateParser("2000-01-02T12:34:56.789012Z"));
    }
  });

  it('testHyphenatedDate', function () {
    // Format: YYYY-MM-DD HH:MM

    // Midnight February 2, 2000, UTC
    var d = new Date(Date.UTC(2000, 1, 2));

    // Convert to a string in the local time zone: YYYY-DD-MM HH:MM
    var zp = function zp(x) {
      return x < 10 ? '0' + x : x;
    };
    var str = d.getFullYear() + '-' + zp(1 + d.getMonth()) + '-' + zp(d.getDate()) + ' ' + zp(d.getHours()) + ':' + zp(d.getMinutes());
    assert.equal(Date.UTC(2000, 1, 2), utils.dateParser(str));
  });

  it('testMillisecondsDate', function () {
    // Format: YYYY-MM-DD HH:MM:SS.MS

    // Midnight February 2, 2000 14:25:42.123 UTC
    var ts = Date.UTC(2000, 1, 2, 14, 25, 42, 123);
    assert.equal("2000/02/02 14:25:42.123", utils.dateString_(ts, true));
  });
});

},{"../../src/dygraph-utils":138}],15:[function(require,module,exports){
/**
 * @fileoverview Test cases for the tick-generating functions.
 * These were generated by adding logging code to the old ticker functions. The
 * tests serve to track existing behavior should it change in the future.
 *
 * @author danvdk@gmail.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _srcDygraphTickers = require('../../src/dygraph-tickers');

var DygraphTickers = _interopRequireWildcard(_srcDygraphTickers);

var _srcDygraphDefaultAttrs = require('../../src/dygraph-default-attrs');

var _srcDygraphDefaultAttrs2 = _interopRequireDefault(_srcDygraphDefaultAttrs);

describe("date-ticker-tests", function () {

  cleanupAfterEach();

  var createOptionsViewForAxis = function createOptionsViewForAxis(axis, dict) {
    return function (x) {
      if (dict && dict.hasOwnProperty(x)) {
        return dict[x];
      }
      if (_srcDygraphDefaultAttrs2['default'].axes[axis].hasOwnProperty(x)) {
        return _srcDygraphDefaultAttrs2['default'].axes[axis][x];
      }
      if (_srcDygraphDefaultAttrs2['default'].hasOwnProperty(x)) {
        return _srcDygraphDefaultAttrs2['default'][x];
      }
      if (x == 'axisLabelFormatter') return null;
      throw "mysterious " + axis + "-axis option: " + x;
    };
  };

  // Change '&#160;' (non-breaking space) to ' ' in all labels. Cleans up expected values.
  function changeNbspToSpace(ticks) {
    for (var i = 0; i < ticks.length; i++) {
      if (ticks[i].label) {
        ticks[i].label = ticks[i].label.replace(/&#160;/g, ' ');
      }
    }
  }

  it('testBasicDateTicker', function () {
    var opts = { labelsUTC: true };
    var options = createOptionsViewForAxis('x', opts);

    var ticks = DygraphTickers.dateTicker(-1797534000000, 1255579200000, 800, options);
    var expected_ticks = [{ "v": -1577923200000, "label": "1920" }, { "v": -1262304000000, "label": "1930" }, { "v": -946771200000, "label": "1940" }, { "v": -631152000000, "label": "1950" }, { "v": -315619200000, "label": "1960" }, { "v": 0, "label": "1970" }, { "v": 315532800000, "label": "1980" }, { "v": 631152000000, "label": "1990" }, { "v": 946684800000, "label": "2000" }];
    assert.deepEqual(expected_ticks, ticks);

    var start = Date.UTC(1999, 11, 31, 14, 0, 0);
    var end = Date.UTC(2000, 0, 1, 12, 0, 0);
    var granularity = DygraphTickers.Granularity.TWO_HOURLY;
    ticks = DygraphTickers.getDateAxis(start, end, granularity, options);
    changeNbspToSpace(ticks);
    expected_ticks = [// months of the year are zero-based.
    { v: Date.UTC(1999, 11, 31, 14, 0, 0), label: '14:00' }, { v: Date.UTC(1999, 11, 31, 16, 0, 0), label: '16:00' }, { v: Date.UTC(1999, 11, 31, 18, 0, 0), label: '18:00' }, { v: Date.UTC(1999, 11, 31, 20, 0, 0), label: '20:00' }, { v: Date.UTC(1999, 11, 31, 22, 0, 0), label: '22:00' }, { v: Date.UTC(2000, 0, 1, 0, 0, 0), label: '01 Jan' }, { v: Date.UTC(2000, 0, 1, 2, 0, 0), label: '02:00' }, { v: Date.UTC(2000, 0, 1, 4, 0, 0), label: '04:00' }, { v: Date.UTC(2000, 0, 1, 6, 0, 0), label: '06:00' }, { v: Date.UTC(2000, 0, 1, 8, 0, 0), label: '08:00' }, { v: Date.UTC(2000, 0, 1, 10, 0, 0), label: '10:00' }, { v: Date.UTC(2000, 0, 1, 12, 0, 0), label: '12:00' }];
    assert.deepEqual(expected_ticks, ticks);
  });

  it('testAllDateTickers', function () {
    var opts = { labelsUTC: true, pixelsPerLabel: 60 };
    var options = createOptionsViewForAxis('x', opts);

    // For granularities finer than MONTHLY, the first tick returned tick
    // could lie outside [start_time, end_time] range in the original code.
    // In these tests, those spurious ticks are removed to test new behavior.

    var ticker = function ticker() {
      var ticks = DygraphTickers.dateTicker.apply(null, arguments);
      changeNbspToSpace(ticks);
      return ticks;
    };

    assert.deepEqual([{ "v": -1577923200000, "label": "1920" }, { "v": -1262304000000, "label": "1930" }, { "v": -946771200000, "label": "1940" }, { "v": -631152000000, "label": "1950" }, { "v": -315619200000, "label": "1960" }, { "v": 0, "label": "1970" }, { "v": 315532800000, "label": "1980" }, { "v": 631152000000, "label": "1990" }, { "v": 946684800000, "label": "2000" }], ticker(-1797552000000, 1255561200000, 800, options));
    assert.deepEqual([{ "v": -5364662400000, "label": "1800" }, { "v": -2208988800000, "label": "1900" }], ticker(-6122044800000, 189302400000, 480, options));
    assert.deepEqual([{ "v": 1041120000000, "label": "29 Dec" }, { "v": 1041724800000, "label": "05 Jan" }, { "v": 1042329600000, "label": "12 Jan" }, { "v": 1042934400000, "label": "19 Jan" }, { "v": 1043539200000, "label": "26 Jan" }, { "v": 1044144000000, "label": "02 Feb" }, { "v": 1044748800000, "label": "09 Feb" }, { "v": 1045353600000, "label": "16 Feb" }], ticker(1041120000000, 1045353600000, 640, options));
    assert.deepEqual([{ "v": 1041379200000, "label": "Jan 2003" }, { "v": 1072915200000, "label": "Jan 2004" }, { "v": 1104537600000, "label": "Jan 2005" }, { "v": 1136073600000, "label": "Jan 2006" }, { "v": 1167609600000, "label": "Jan 2007" }, { "v": 1199145600000, "label": "Jan 2008" }, { "v": 1230768000000, "label": "Jan 2009" }, { "v": 1262304000000, "label": "Jan 2010" }, { "v": 1293840000000, "label": "Jan 2011" }], ticker(1041120000000, 1307833200000, 800, options));
    assert.deepEqual([{ "v": 1159660800000, "label": "01 Oct" }, { "v": 1160265600000, "label": "08 Oct" }, { "v": 1160870400000, "label": "15 Oct" }, { "v": 1161475200000, "label": "22 Oct" }, { "v": 1162080000000, "label": "29 Oct" }], ticker(1159657200000, 1162252800000, 480, options));
    assert.deepEqual([{ "v": 1159660800000, "label": "01 Oct" }, { "v": 1160265600000, "label": "08 Oct" }, { "v": 1160870400000, "label": "15 Oct" }, { "v": 1161475200000, "label": "22 Oct" }, { "v": 1162080000000, "label": "29 Oct" }], ticker(1159657200000, 1162252800000, 640, options));
    assert.deepEqual([{ "v": 1159660800000, "label": "01 Oct" }, { "v": 1160265600000, "label": "08 Oct" }, { "v": 1160870400000, "label": "15 Oct" }, { "v": 1161475200000, "label": "22 Oct" }, { "v": 1162080000000, "label": "29 Oct" }, { "v": 1162684800000, "label": "05 Nov" }, { "v": 1163289600000, "label": "12 Nov" }, { "v": 1163894400000, "label": "19 Nov" }, { "v": 1164499200000, "label": "26 Nov" }], ticker(1159657200000, 1164758400000, 1150, options));
    assert.deepEqual([{ "v": 1159660800000, "label": "Oct 2006" }, { "v": 1162339200000, "label": "Nov 2006" }], ticker(1159657200000, 1164758400000, 400, options));
    assert.deepEqual([{ "v": 1159660800000, "label": "01 Oct" }, { "v": 1160265600000, "label": "08 Oct" }, { "v": 1160870400000, "label": "15 Oct" }, { "v": 1161475200000, "label": "22 Oct" }, { "v": 1162080000000, "label": "29 Oct" }, { "v": 1162684800000, "label": "05 Nov" }, { "v": 1163289600000, "label": "12 Nov" }, { "v": 1163894400000, "label": "19 Nov" }, { "v": 1164499200000, "label": "26 Nov" }], ticker(1159657200000, 1164758400000, 500, options));
    assert.deepEqual([{ "v": 1159660800000, "label": "01 Oct" }, { "v": 1160265600000, "label": "08 Oct" }, { "v": 1160870400000, "label": "15 Oct" }, { "v": 1161475200000, "label": "22 Oct" }, { "v": 1162080000000, "label": "29 Oct" }, { "v": 1162684800000, "label": "05 Nov" }, { "v": 1163289600000, "label": "12 Nov" }, { "v": 1163894400000, "label": "19 Nov" }, { "v": 1164499200000, "label": "26 Nov" }], ticker(1159657200000, 1164758400000, 600, options));
    assert.deepEqual([{ "v": 1160265600000, "label": "08 Oct" }, { "v": 1160870400000, "label": "15 Oct" }, { "v": 1161475200000, "label": "22 Oct" }, { "v": 1162080000000, "label": "29 Oct" }, { "v": 1162684800000, "label": "05 Nov" }, { "v": 1163289600000, "label": "12 Nov" }], ticker(1160243979962, 1163887694248, 600, options));

    assert.deepEqual([{ "v": 1160611200000, "label": "12 Oct" }, { "v": 1160784000000, "label": "14 Oct" }, { "v": 1160956800000, "label": "16 Oct" }, { "v": 1161129600000, "label": "18 Oct" }], ticker(1160521200000, 1161298800000, 480, options));
    assert.deepEqual([{ "v": 1161475200000, "label": "22 Oct" }, { "v": 1161561600000, "label": "23 Oct" }, { "v": 1161648000000, "label": "24 Oct" }, { "v": 1161734400000, "label": "25 Oct" }, { "v": 1161820800000, "label": "26 Oct" }, { "v": 1161907200000, "label": "27 Oct" }, { "v": 1161993600000, "label": "28 Oct" }], ticker(1161471164461, 1161994065957, 600, options));
    assert.deepEqual([{ "v": 1161561600000, "label": "23 Oct" }, { "v": 1161583200000, "label": "06:00" }, { "v": 1161604800000, "label": "12:00" }, { "v": 1161626400000, "label": "18:00" }], ticker(1161557878860, 1161642991675, 600, options));
    assert.deepEqual([{ "v": 1161756000000, "label": "06:00" }, { "v": 1161759600000, "label": "07:00" }, { "v": 1161763200000, "label": "08:00" }, { "v": 1161766800000, "label": "09:00" }, { "v": 1161770400000, "label": "10:00" }, { "v": 1161774000000, "label": "11:00" }, { "v": 1161777600000, "label": "12:00" }], ticker(1161752537840, 1161777663332, 600, options));
    assert.deepEqual([{ "v": 1167609600000, "label": "01 Jan" }, { "v": 1167696000000, "label": "02 Jan" }, { "v": 1167782400000, "label": "03 Jan" }, { "v": 1167868800000, "label": "04 Jan" }, { "v": 1167955200000, "label": "05 Jan" }, { "v": 1168041600000, "label": "06 Jan" }, { "v": 1168128000000, "label": "07 Jan" }, { "v": 1168214400000, "label": "08 Jan" }, { "v": 1168300800000, "label": "09 Jan" }], ticker(1167609600000, 1168300800000, 480, options));
    assert.deepEqual([{ "v": 1167609600000, "label": "Jan 2007" }], ticker(1167609600000, 1199059200000, 100, options));
    assert.deepEqual([{ "v": 1167609600000, "label": "Jan 2007" }, { "v": 1175385600000, "label": "Apr 2007" }, { "v": 1183248000000, "label": "Jul 2007" }, { "v": 1191196800000, "label": "Oct 2007" }], ticker(1167609600000, 1199059200000, 300, options));
    assert.deepEqual([{ "v": 1167609600000, "label": "Jan 2007" }, { "v": 1175385600000, "label": "Apr 2007" }, { "v": 1183248000000, "label": "Jul 2007" }, { "v": 1191196800000, "label": "Oct 2007" }], ticker(1167609600000, 1199059200000, 480, options));
    assert.deepEqual([{ "v": 1167609600000, "label": "Jan 2007" }, { "v": 1175385600000, "label": "Apr 2007" }, { "v": 1183248000000, "label": "Jul 2007" }, { "v": 1191196800000, "label": "Oct 2007" }], ticker(1167609600000, 1199059200000, 600, options));
    assert.deepEqual([{ "v": 1160611200000, "label": "12 Oct" }, { "v": 1160784000000, "label": "14 Oct" }, { "v": 1160956800000, "label": "16 Oct" }, { "v": 1161129600000, "label": "18 Oct" }], ticker(1160521200000, 1161298800000, 480, options));
    assert.deepEqual([{ "v": 1167609600000, "label": "Jan 2007" }, { "v": 1170288000000, "label": "Feb 2007" }, { "v": 1172707200000, "label": "Mar 2007" }, { "v": 1175385600000, "label": "Apr 2007" }, { "v": 1177977600000, "label": "May 2007" }, { "v": 1180656000000, "label": "Jun 2007" }, { "v": 1183248000000, "label": "Jul 2007" }, { "v": 1185926400000, "label": "Aug 2007" }, { "v": 1188604800000, "label": "Sep 2007" }, { "v": 1191196800000, "label": "Oct 2007" }, { "v": 1193875200000, "label": "Nov 2007" }, { "v": 1196467200000, "label": "Dec 2007" }], ticker(1167609600000, 1199059200000, 800, options));

    assert.deepEqual([{ "v": 1293840000000, "label": "Jan 2011" }, { "v": 1296518400000, "label": "Feb 2011" }, { "v": 1298937600000, "label": "Mar 2011" }, { "v": 1301616000000, "label": "Apr 2011" }, { "v": 1304208000000, "label": "May 2011" }, { "v": 1306886400000, "label": "Jun 2011" }, { "v": 1309478400000, "label": "Jul 2011" }, { "v": 1312156800000, "label": "Aug 2011" }], ticker(1293753600000, 1312844400000, 727, options));
    assert.deepEqual([{ "v": 1201824000000, "label": "01 Feb" }, { "v": 1201910400000, "label": "02 Feb" }, { "v": 1201996800000, "label": "03 Feb" }, { "v": 1202083200000, "label": "04 Feb" }, { "v": 1202169600000, "label": "05 Feb" }, { "v": 1202256000000, "label": "06 Feb" }], ticker(1201824000000, 1202256000000, 700, options));
    assert.deepEqual([{ "v": 1210118400000, "label": "07 May" }, { "v": 1210140000000, "label": "06:00" }, { "v": 1210161600000, "label": "12:00" }, { "v": 1210183200000, "label": "18:00" }, { "v": 1210204800000, "label": "08 May" }, { "v": 1210226400000, "label": "06:00" }, { "v": 1210248000000, "label": "12:00" }, { "v": 1210269600000, "label": "18:00" }, { "v": 1210291200000, "label": "09 May" }], ticker(1210114800000, 1210291200000, 480, options));
    assert.deepEqual([{ "v": 1210118400000, "label": "07 May" }, { "v": 1210204800000, "label": "08 May" }, { "v": 1210291200000, "label": "09 May" }, { "v": 1210377600000, "label": "10 May" }, { "v": 1210464000000, "label": "11 May" }], ticker(1210114800000, 1210464000000, 480, options));
    assert.deepEqual([{ "v": 1210118400000, "label": "07 May" }, { "v": 1210204800000, "label": "08 May" }, { "v": 1210291200000, "label": "09 May" }, { "v": 1210377600000, "label": "10 May" }, { "v": 1210464000000, "label": "11 May" }, { "v": 1210550400000, "label": "12 May" }], ticker(1210114800000, 1210550400000, 480, options));
    assert.deepEqual([{ "v": 1214870400000, "label": "01 Jul" }, { "v": 1214872200000, "label": "00:30" }, { "v": 1214874000000, "label": "01:00" }, { "v": 1214875800000, "label": "01:30" }], ticker(1214870400000, 1214877599000, 600, options));
    assert.deepEqual([{ "v": 1214870400000, "label": "Jul 2008" }, { "v": 1217548800000, "label": "Aug 2008" }, { "v": 1220227200000, "label": "Sep 2008" }], ticker(1214866800000, 1222747200000, 600, options));
    assert.deepEqual([{ "v": 1215820800000, "label": "12 Jul" }, { "v": 1215842400000, "label": "06:00" }, { "v": 1215864000000, "label": "12:00" }, { "v": 1215885600000, "label": "18:00" }, { "v": 1215907200000, "label": "13 Jul" }, { "v": 1215928800000, "label": "06:00" }, { "v": 1215950400000, "label": "12:00" }, { "v": 1215972000000, "label": "18:00" }], ticker(1215817200000, 1215989940000, 600, options));
    assert.deepEqual([{ "v": 1246752000000, "label": "05 Jul" }, { "v": 1247356800000, "label": "12 Jul" }, { "v": 1247961600000, "label": "19 Jul" }], ticker(1246402800000, 1248217200000, 600, options));
    assert.deepEqual([{ "v": 1246752000000, "label": "05 Jul" }, { "v": 1247356800000, "label": "12 Jul" }, { "v": 1247961600000, "label": "19 Jul" }, { "v": 1248566400000, "label": "26 Jul" }, { "v": 1249171200000, "label": "02 Aug" }], ticker(1246402800000, 1249340400000, 600, options));
    assert.deepEqual([{ "v": 1247356800000, "label": "12 Jul" }, { "v": 1247360400000, "label": "01:00" }, { "v": 1247364000000, "label": "02:00" }, { "v": 1247367600000, "label": "03:00" }, { "v": 1247371200000, "label": "04:00" }, { "v": 1247374800000, "label": "05:00" }, { "v": 1247378400000, "label": "06:00" }], ticker(1247356800000, 1247378400000, 600, options));

    assert.deepEqual([{ "v": 1247356800000, "label": "12 Jul" }, { "v": 1247360400000, "label": "01:00" }, { "v": 1247364000000, "label": "02:00" }, { "v": 1247367600000, "label": "03:00" }, { "v": 1247371200000, "label": "04:00" }, { "v": 1247374800000, "label": "05:00" }, { "v": 1247378400000, "label": "06:00" }], ticker(1247356800000, 1247378400000, 600, options));
    assert.deepEqual([{ "v": 1254268800000, "label": "30 Sep" }, { "v": 1254355200000, "label": "01 Oct" }, { "v": 1254441600000, "label": "02 Oct" }, { "v": 1254528000000, "label": "03 Oct" }, { "v": 1254614400000, "label": "04 Oct" }, { "v": 1254700800000, "label": "05 Oct" }, { "v": 1254787200000, "label": "06 Oct" }, { "v": 1254873600000, "label": "07 Oct" }, { "v": 1254960000000, "label": "08 Oct" }, { "v": 1255046400000, "label": "09 Oct" }, { "v": 1255132800000, "label": "10 Oct" }], ticker(1254222000000, 1255172400000, 900, options));
    assert.deepEqual([{ "v": 1254441600000, "label": "02 Oct" }, { "v": 1254528000000, "label": "03 Oct" }, { "v": 1254614400000, "label": "04 Oct" }, { "v": 1254700800000, "label": "05 Oct" }, { "v": 1254787200000, "label": "06 Oct" }, { "v": 1254873600000, "label": "07 Oct" }, { "v": 1254960000000, "label": "08 Oct" }], ticker(1254394800000, 1254999600000, 900, options));
    assert.deepEqual([{ "v": 1259625600000, "label": "01 Dec" }, { "v": 1259712000000, "label": "02 Dec" }, { "v": 1259798400000, "label": "03 Dec" }, { "v": 1259884800000, "label": "04 Dec" }, { "v": 1259971200000, "label": "05 Dec" }, { "v": 1260057600000, "label": "06 Dec" }, { "v": 1260144000000, "label": "07 Dec" }], ticker(1259625600000, 1260144000000, 480, options));
    assert.deepEqual([{ "v": 1259625600000, "label": "01 Dec" }, { "v": 1259712000000, "label": "02 Dec" }, { "v": 1259798400000, "label": "03 Dec" }, { "v": 1259884800000, "label": "04 Dec" }, { "v": 1259971200000, "label": "05 Dec" }, { "v": 1260057600000, "label": "06 Dec" }, { "v": 1260144000000, "label": "07 Dec" }], ticker(1259625600000, 1260144000000, 600, options));
    assert.deepEqual([{ "v": 1260057600000, "label": "06 Dec" }, { "v": 1260662400000, "label": "13 Dec" }, { "v": 1261267200000, "label": "20 Dec" }, { "v": 1261872000000, "label": "27 Dec" }, { "v": 1262476800000, "label": "03 Jan" }, { "v": 1263081600000, "label": "10 Jan" }, { "v": 1263686400000, "label": "17 Jan" }, { "v": 1264291200000, "label": "24 Jan" }], ticker(1260057600000, 1264291200000, 640, options));
    assert.deepEqual([{ "v": 1262304000000, "label": "Jan 2010" }, { "v": 1264982400000, "label": "Feb 2010" }, { "v": 1267401600000, "label": "Mar 2010" }, { "v": 1270080000000, "label": "Apr 2010" }], ticker(1262304000000, 1270857600000, 640, options));
    assert.deepEqual([{ "v": 1288915200000, "label": "05 Nov" }, { "v": 1288936800000, "label": "06:00" }, { "v": 1288958400000, "label": "12:00" }, { "v": 1288980000000, "label": "18:00" }, { "v": 1289001600000, "label": "06 Nov" }, { "v": 1289023200000, "label": "06:00" }, { "v": 1289044800000, "label": "12:00" }, { "v": 1289066400000, "label": "18:00" }, { "v": 1289088000000, "label": "07 Nov" }, { "v": 1289109600000, "label": "06:00" }, { "v": 1289131200000, "label": "12:00" }, { "v": 1289152800000, "label": "18:00" }, { "v": 1289174400000, "label": "08 Nov" }, { "v": 1289196000000, "label": "06:00" }, { "v": 1289217600000, "label": "12:00" }, { "v": 1289239200000, "label": "18:00" }, { "v": 1289260800000, "label": "09 Nov" }], ticker(1288911600000, 1289260800000, 1024, options));
    assert.deepEqual([{ "v": 1291161600000, "label": "01 Dec" }, { "v": 1291248000000, "label": "02 Dec" }, { "v": 1291334400000, "label": "03 Dec" }, { "v": 1291420800000, "label": "04 Dec" }, { "v": 1291507200000, "label": "05 Dec" }, { "v": 1291593600000, "label": "06 Dec" }, { "v": 1291680000000, "label": "07 Dec" }, { "v": 1291766400000, "label": "08 Dec" }, { "v": 1291852800000, "label": "09 Dec" }], ticker(1291161600000, 1291852800000, 600, options));
    assert.deepEqual([{ "v": 1294358400000, "label": "07 Jan" }, { "v": 1294444800000, "label": "08 Jan" }, { "v": 1294531200000, "label": "09 Jan" }, { "v": 1294617600000, "label": "10 Jan" }, { "v": 1294704000000, "label": "11 Jan" }, { "v": 1294790400000, "label": "12 Jan" }, { "v": 1294876800000, "label": "13 Jan" }, { "v": 1294963200000, "label": "14 Jan" }], ticker(1294358400000, 1294963200000, 480, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }], ticker(1307908000112, 1307908050165, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }], ticker(1307908000112, 1307908051166, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }], ticker(1307908000112, 1307908052167, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }], ticker(1307908000112, 1307908053167, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }], ticker(1307908000112, 1307908054168, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }], ticker(1307908000112, 1307908055169, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }], ticker(1307908000112, 1307908056169, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }], ticker(1307908000112, 1307908057170, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }], ticker(1307908000112, 1307908058171, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }], ticker(1307908000112, 1307908059172, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }, { "v": 1307908060000, "label": "19:47:40" }], ticker(1307908000112, 1307908060172, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }, { "v": 1307908060000, "label": "19:47:40" }], ticker(1307908000112, 1307908061174, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }, { "v": 1307908060000, "label": "19:47:40" }], ticker(1307908000112, 1307908062176, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }, { "v": 1307908060000, "label": "19:47:40" }], ticker(1307908000112, 1307908063177, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }, { "v": 1307908060000, "label": "19:47:40" }], ticker(1307908000112, 1307908064178, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908065000, "label": "19:47:45" }], ticker(1307908000112, 1307908065178, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908065000, "label": "19:47:45" }], ticker(1307908000112, 1307908066178, 800, options));
    assert.deepEqual([{ "v": 1307908005000, "label": "19:46:45" }, { "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908015000, "label": "19:46:55" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908025000, "label": "19:47:05" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908035000, "label": "19:47:15" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908045000, "label": "19:47:25" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908055000, "label": "19:47:35" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908065000, "label": "19:47:45" }], ticker(1307908000112, 1307908067179, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }], ticker(1307908000112, 1307908068179, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }], ticker(1307908000112, 1307908069179, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908070180, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908071180, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908072181, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908073181, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908074182, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908075182, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908076183, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908077183, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908078184, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }], ticker(1307908000112, 1307908079185, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908080186, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908081187, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908082188, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908083188, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908084189, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908085190, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908086191, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908087192, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908088192, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }], ticker(1307908000112, 1307908089193, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908090194, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908091194, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908092196, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908093196, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908094197, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908095197, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908096198, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908097199, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908098200, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }], ticker(1307908000112, 1307908099200, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908100201, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908101201, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908102202, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908103203, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908104204, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908105205, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908106205, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908107206, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908108209, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }], ticker(1307908000112, 1307908109209, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908110209, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908111210, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908112211, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908113211, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908114212, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908115213, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908116214, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908117214, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908118215, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908119215, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908120217, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908121218, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908122219, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908123219, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908124220, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908125221, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908126222, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908127222, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908128223, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }], ticker(1307908000112, 1307908129223, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }, { "v": 1307908130000, "label": "19:48:50" }], ticker(1307908000112, 1307908130224, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }, { "v": 1307908130000, "label": "19:48:50" }], ticker(1307908000112, 1307908131225, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }, { "v": 1307908130000, "label": "19:48:50" }], ticker(1307908000112, 1307908132226, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }, { "v": 1307908130000, "label": "19:48:50" }], ticker(1307908000112, 1307908133227, 800, options));
    assert.deepEqual([{ "v": 1307908010000, "label": "19:46:50" }, { "v": 1307908020000, "label": "19:47" }, { "v": 1307908030000, "label": "19:47:10" }, { "v": 1307908040000, "label": "19:47:20" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908060000, "label": "19:47:40" }, { "v": 1307908070000, "label": "19:47:50" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908090000, "label": "19:48:10" }, { "v": 1307908100000, "label": "19:48:20" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908120000, "label": "19:48:40" }, { "v": 1307908130000, "label": "19:48:50" }], ticker(1307908000112, 1307908134227, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908135227, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908136228, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908137230, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908138231, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }], ticker(1307908000112, 1307908139232, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908140233, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908141233, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908142234, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908143240, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908144240, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908145240, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908146241, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908147241, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908148242, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908149243, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908150243, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908151244, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908152245, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908153245, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908154246, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908155247, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908156247, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908157248, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908158249, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908159250, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908160251, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908161252, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908162252, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908163253, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908164254, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908165254, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908166255, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908167256, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908168256, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }], ticker(1307908000112, 1307908169257, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }, { "v": 1307908170000, "label": "19:49:30" }], ticker(1307908000112, 1307908170258, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }, { "v": 1307908170000, "label": "19:49:30" }], ticker(1307908000112, 1307908171258, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }, { "v": 1307908170000, "label": "19:49:30" }], ticker(1307908000112, 1307908172259, 800, options));
    assert.deepEqual([{ "v": 1307908020000, "label": "19:47" }, { "v": 1307908050000, "label": "19:47:30" }, { "v": 1307908080000, "label": "19:48" }, { "v": 1307908110000, "label": "19:48:30" }, { "v": 1307908140000, "label": "19:49" }, { "v": 1307908170000, "label": "19:49:30" }], ticker(1307908000112, 1307908173260, 800, options));
    assert.deepEqual([{ "v": 978307200000, "label": "Jan 2001" }, { "v": 986083200000, "label": "Apr 2001" }, { "v": 993945600000, "label": "Jul 2001" }, { "v": 1001894400000, "label": "Oct 2001" }], ticker(978307200000, 1001894400000, 400, options));
  });
});

},{"../../src/dygraph-default-attrs":131,"../../src/dygraph-tickers":137}],16:[function(require,module,exports){
/**
 * @fileoverview Test cases for the option "drawGapEdgePoints"
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

describe("draw-gap-edge-points", function () {

  cleanupAfterEach();

  it("shouldn't draw any points by default", function () {
    var called = false;
    var g = new _srcDygraph2['default'](document.getElementById("graph"), [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], { labels: ['a', 'b'],
      drawGapEdgePoints: true,
      drawPointCallback: function drawPointCallback() {
        called = true;
      } });

    assert.isFalse(called);
  });

  it("shouldn't draw any points by default (no axes)", function () {
    var called = false;
    var g = new _srcDygraph2['default'](document.getElementById("graph"), [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], { labels: ['a', 'b'],
      drawGapEdgePoints: true,
      drawPointCallback: function drawPointCallback() {
        called = true;
      },
      axes: {
        x: { drawAxis: false },
        y: { drawAxis: false }
      } });

    assert.isFalse(called);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138}],17:[function(require,module,exports){
/** 
 * @fileoverview Test cases for DygraphOptions.
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphOptions = require('../../src/dygraph-options');

var _srcDygraphOptions2 = _interopRequireDefault(_srcDygraphOptions);

var _srcDygraphOptionsReference = require('../../src/dygraph-options-reference');

var _srcDygraphOptionsReference2 = _interopRequireDefault(_srcDygraphOptionsReference);

describe("dygraph-options-tests", function () {

  cleanupAfterEach();

  var graph;

  beforeEach(function () {
    graph = document.getElementById("graph");
  });

  /*
   * Pathalogical test to ensure getSeriesNames works
   */
  it('testGetSeriesNames', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y,Y2,Y3\n" + "0,-1,0,0";

    // Kind of annoying that you need a DOM to test the object.
    var g = new _srcDygraph2['default'](graph, data, opts);

    // We don't need to get at g's attributes_ object just
    // to test DygraphOptions.
    var o = new _srcDygraphOptions2['default'](g);
    assert.deepEqual(["Y", "Y2", "Y3"], o.seriesNames());
  });

  /*
   * Ensures that even if logscale is set globally, it doesn't impact the
   * x axis.
   */
  it('testGetLogscaleForX', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y,Y2,Y3\n" + "1,-1,2,3";

    // Kind of annoying that you need a DOM to test the object.
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.isFalse(!!g.getOptionForAxis('logscale', 'x'));
    assert.isFalse(!!g.getOptionForAxis('logscale', 'y'));

    g.updateOptions({ logscale: true });
    assert.isFalse(!!g.getOptionForAxis('logscale', 'x'));
    assert.isTrue(!!g.getOptionForAxis('logscale', 'y'));
  });

  // Helper to gather all warnings emitted by Dygraph constructor.
  // Removes everything after the first open parenthesis in each warning.
  // Returns them in a (possibly empty) list.
  var getWarnings = function getWarnings(div, data, opts) {
    var warnings = [];
    var oldWarn = console.warn;
    console.warn = function (message) {
      warnings.push(message.replace(/ \(.*/, ''));
    };
    try {
      new _srcDygraph2['default'](graph, data, opts);
    } catch (e) {}
    console.warn = oldWarn;
    return warnings;
  };

  it('testLogWarningForNonexistentOption', function () {
    if (!_srcDygraphOptionsReference2['default']) {
      return; // this test won't pass in non-debug mode.
    }

    var data = "X,Y,Y2,Y3\n" + "1,-1,2,3";

    var expectWarning = function expectWarning(opts, badOptionName) {
      _srcDygraphOptions2['default'].resetWarnings_();
      var warnings = getWarnings(graph, data, opts);
      assert.deepEqual(['Unknown option ' + badOptionName], warnings);
    };
    var expectNoWarning = function expectNoWarning(opts) {
      _srcDygraphOptions2['default'].resetWarnings_();
      var warnings = getWarnings(graph, data, opts);
      assert.deepEqual([], warnings);
    };

    expectNoWarning({});
    expectWarning({ nonExistentOption: true }, 'nonExistentOption');
    expectWarning({ series: { Y: { nonExistentOption: true } } }, 'nonExistentOption');
    // expectWarning({Y: {nonExistentOption: true}});
    expectWarning({ axes: { y: { anotherNonExistentOption: true } } }, 'anotherNonExistentOption');
    expectWarning({ highlightSeriesOpts: { anotherNonExistentOption: true } }, 'anotherNonExistentOption');
    expectNoWarning({ highlightSeriesOpts: { strokeWidth: 20 } });
    expectNoWarning({ strokeWidth: 20 });
  });

  it('testOnlyLogsEachWarningOnce', function () {
    if (!_srcDygraphOptionsReference2['default']) {
      return; // this test won't pass in non-debug mode.
    }

    var data = "X,Y,Y2,Y3\n" + "1,-1,2,3";

    var warnings1 = getWarnings(graph, data, { nonExistent: true });
    var warnings2 = getWarnings(graph, data, { nonExistent: true });
    assert.deepEqual(['Unknown option nonExistent'], warnings1);
    assert.deepEqual([], warnings2);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-options":136,"../../src/dygraph-options-reference":135}],18:[function(require,module,exports){
/**
 * @fileoverview FILL THIS IN
 *
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

describe("error-bars", function () {

  cleanupAfterEach();
  useProxyCanvas(utils, _Proxy2['default']);

  it('testErrorBarsDrawn', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      customBars: true,
      errorBars: true,
      labels: ['X', 'Y']
    };
    var data = [[1, [10, 10, 100]], [2, [15, 20, 110]], [3, [10, 30, 100]], [4, [15, 40, 110]], [5, [10, 120, 100]], [6, [15, 50, 110]], [7, [10, 70, 100]], [8, [15, 90, 110]], [9, [10, 50, 100]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {}; // TODO(danvk): fill in

    for (var i = 0; i < data.length - 1; i++) {
      // bottom line
      var xy1 = g.toDomCoords(data[i][0], data[i][1][0]);
      var xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][1][0]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // top line
      xy1 = g.toDomCoords(data[i][0], data[i][1][2]);
      xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][1][2]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // middle line
      xy1 = g.toDomCoords(data[i][0], data[i][1][1]);
      xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][1][1]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
    }

    g.updateOptions({ logscale: true });

    for (var i = 0; i < data.length - 1; i++) {
      // bottom line
      var xy1 = g.toDomCoords(data[i][0], data[i][1][0]);
      var xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][1][0]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // top line
      xy1 = g.toDomCoords(data[i][0], data[i][1][2]);
      xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][1][2]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // middle line
      xy1 = g.toDomCoords(data[i][0], data[i][1][1]);
      xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][1][1]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
    }
    g.destroy(); // Restore balanced saves and restores.
    _CanvasAssertions2['default'].assertBalancedSaveRestore(htx);
  });

  it('testErrorBarsCorrectColors', function () {
    // Two constant series with constant error.
    var data = [[0, [100, 50], [200, 50]], [1, [100, 50], [200, 50]]];

    var opts = {
      errorBars: true,
      sigma: 1.0,
      fillAlpha: 0.15,
      colors: ['#00ff00', '#0000ff'],
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      width: 400,
      height: 300,
      valueRange: [0, 300],
      labels: ['X', 'Y1', 'Y2']
    };
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    // y-pixels (0=top, 299=bottom)
    //   0- 48: empty (white)
    //  49- 98: Y2 error bar
    //  99:     Y2 center line
    // 100-148: Y2 error bar
    // 149-198: Y1 error bar
    // 199:     Y1 center line
    // 200-248: Y1 error bar
    // 249-299: empty (white)
    // TODO(danvk): test the edges of these regions.

    assert.deepEqual([0, 0, 255, 38], _Util2['default'].samplePixel(g.hidden_, 200, 75));
    assert.deepEqual([0, 0, 255, 38], _Util2['default'].samplePixel(g.hidden_, 200, 125));
    assert.deepEqual([0, 255, 0, 38], _Util2['default'].samplePixel(g.hidden_, 200, 175));
    assert.deepEqual([0, 255, 0, 38], _Util2['default'].samplePixel(g.hidden_, 200, 225));
  });

  // Regression test for https://github.com/danvk/dygraphs/issues/517
  // This verifies that the error bars have alpha=fillAlpha, even if the series
  // color has its own alpha value.
  it('testErrorBarsForAlphaSeriesCorrectColors', function () {
    var data = [[0, [100, 50]], [2, [100, 50]]];

    var opts = {
      errorBars: true,
      sigma: 1.0,
      fillAlpha: 0.15,
      strokeWidth: 10,
      colors: ['rgba(0, 255, 0, 0.5)'],
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      width: 400,
      height: 300,
      valueRange: [0, 300],
      labels: ['X', 'Y']
    };
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    // y-pixels (0=top, 299=bottom)
    //   0-148: empty (white)
    // 149-198: Y error bar
    // 199:     Y center line
    // 200-248: Y error bar
    // 249-299: empty (white)

    //  38 = 255 * 0.15 (fillAlpha)
    // 146 = 255 * (0.15 * 0.5 + 1 * 0.5) (fillAlpha from error bar + alpha from series line)
    assert.deepEqual([0, 255, 0, 38], _Util2['default'].samplePixel(g.hidden_, 1, 175));
    assert.deepEqual([0, 255, 0, 146], _Util2['default'].samplePixel(g.hidden_, 200, 199));
    assert.deepEqual([0, 255, 0, 38], _Util2['default'].samplePixel(g.hidden_, 1, 225));
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=392
  it('testRollingAveragePreservesNaNs', function () {
    var graph = document.getElementById("graph");
    var data = [[1, [null, null], [3, 1]], [2, [2, 1], [null, null]], [3, [null, null], [5, 1]], [4, [4, 0.5], [null, null]], [5, [null, null], [7, 1]], [6, [NaN, NaN], [null, null]], [8, [8, 1], [null, null]], [10, [10, 1], [null, null]]];
    var g = new _srcDygraph2['default'](graph, data, {
      labels: ['x', 'A', 'B'],
      connectSeparatedPoints: true,
      drawPoints: true,
      errorBars: true
    });

    var in_series = g.dataHandler_.extractSeries(data, 1, g.attributes_);

    assert.equal(null, in_series[4][1]);
    assert.equal(null, in_series[4][2][0]);
    assert.equal(null, in_series[4][2][1]);
    assert(isNaN(in_series[5][1]));
    assert(isNaN(in_series[5][2][0]));
    assert(isNaN(in_series[5][2][1]));

    var out_series = g.dataHandler_.rollingAverage(in_series, 1, g.attributes_);
    assert(isNaN(out_series[5][1]));
    assert(isNaN(out_series[5][2][0]));
    assert(isNaN(out_series[5][2][1]));
    assert.equal(null, out_series[4][1]);
    assert.equal(null, out_series[4][2][0]);
    assert.equal(null, out_series[4][2][1]);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./Proxy":4,"./Util":5}],19:[function(require,module,exports){
/**
 * @fileoverview Tests for fastCanvasProxy, which drops superfluous segments.
 *
 * @author danvdk@gmail.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraphCanvas = require('../../src/dygraph-canvas');

var _srcDygraphCanvas2 = _interopRequireDefault(_srcDygraphCanvas);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

describe("fast-canvas-proxy", function () {

  var fakeCanvasContext = {
    moveTo: function moveTo() {},
    lineTo: function lineTo() {},
    beginPath: function beginPath() {},
    closePath: function closePath() {},
    fill: function fill() {},
    stroke: function stroke() {}
  };

  function extractMoveToAndLineToCalls(proxy) {
    var calls = proxy.calls__;
    var out = [];
    for (var i = 0; i < calls.length; i++) {
      var c = calls[i];
      if (c.name == 'moveTo' || c.name == 'lineTo') {
        out.push([c.name, c.args[0], c.args[1]]);
      }
    }
    return out;
  }

  it('testExtraMoveTosElided', function () {
    var htx = new _Proxy2['default'](fakeCanvasContext);
    var fastProxy = _srcDygraphCanvas2['default']._fastCanvasProxy(htx);

    fastProxy.moveTo(1, 1);
    fastProxy.lineTo(2, 1);
    fastProxy.moveTo(2, 1);
    fastProxy.lineTo(3, 1);
    fastProxy.moveTo(3, 1);
    fastProxy.stroke();

    assert.deepEqual([['moveTo', 1, 1], ['lineTo', 2, 1], ['lineTo', 3, 1]], extractMoveToAndLineToCalls(htx));
  });

  it('testConsecutiveMoveTosElided', function () {
    var htx = new _Proxy2['default'](fakeCanvasContext);
    var fastProxy = _srcDygraphCanvas2['default']._fastCanvasProxy(htx);

    fastProxy.moveTo(1, 1);
    fastProxy.lineTo(2, 1);
    fastProxy.moveTo(3, 1);
    fastProxy.moveTo(3.1, 2);
    fastProxy.moveTo(3.2, 3);
    fastProxy.stroke();

    assert.deepEqual([['moveTo', 1, 1], ['lineTo', 2, 1], ['moveTo', 3.2, 3]], extractMoveToAndLineToCalls(htx));
  });

  it('testSuperfluousSegmentsElided', function () {
    var htx = new _Proxy2['default'](fakeCanvasContext);
    var fastProxy = _srcDygraphCanvas2['default']._fastCanvasProxy(htx);

    fastProxy.moveTo(0.6, 1);
    fastProxy.lineTo(0.7, 2);
    fastProxy.lineTo(0.8, 3);
    fastProxy.lineTo(0.9, 4);
    fastProxy.lineTo(1.0, 5); // max for Math.round(x) == 1
    fastProxy.lineTo(1.1, 3);
    fastProxy.lineTo(1.2, 0); // min for Math.round(x) == 1
    fastProxy.lineTo(1.3, 1);
    fastProxy.lineTo(1.4, 2);
    fastProxy.moveTo(1.4, 2);
    fastProxy.lineTo(1.5, 2); // rounding up to 2
    fastProxy.moveTo(1.5, 2);
    fastProxy.lineTo(1.6, 3);
    fastProxy.moveTo(1.6, 3);
    fastProxy.lineTo(1.7, 30); // max for Math.round(x) == 2
    fastProxy.moveTo(1.7, 30);
    fastProxy.lineTo(1.8, -30); // min for Math.round(x) == 2
    fastProxy.moveTo(1.8, -30);
    fastProxy.lineTo(1.9, 0);
    fastProxy.moveTo(3, 0); // dodge the "don't touch the last pixel" rule.
    fastProxy.stroke();

    assert.deepEqual([['moveTo', 0.6, 1], ['lineTo', 1.0, 5], ['lineTo', 1.2, 0], ['lineTo', 1.7, 30], ['lineTo', 1.8, -30], ['moveTo', 3, 0]], extractMoveToAndLineToCalls(htx));
  });

  // For a more visual version of this test, see
  // https://gist.github.com/danvk/e98dbb24253c9b153696
  // The drawing commands in the following two tests are taken from there.
  it('should handle gaps on the left', function () {
    var htx = new _Proxy2['default'](fakeCanvasContext);
    var fastProxy = _srcDygraphCanvas2['default']._fastCanvasProxy(htx);

    fastProxy.moveTo(0, 320);
    fastProxy.lineTo(0, 320);
    fastProxy.lineTo(53.21, 187);
    fastProxy.lineTo(53.23, 29);
    fastProxy.lineTo(53.41, 320);
    fastProxy.lineTo(54.15, 320);
    fastProxy.lineTo(475, 320);
    fastProxy.lineTo(475, 320);
    fastProxy.fill();

    assert.deepEqual([['moveTo', 0, 320], ['lineTo', 0, 320], ['lineTo', 53.21, 187], ['lineTo', 53.23, 29], ['lineTo', 53.41, 320], ['lineTo', 54.15, 320], ['lineTo', 475, 320], ['lineTo', 475, 320]], extractMoveToAndLineToCalls(htx));
  });

  it('should handle gaps on the right', function () {
    var htx = new _Proxy2['default'](fakeCanvasContext);
    var fastProxy = _srcDygraphCanvas2['default']._fastCanvasProxy(htx);
    fastProxy.moveTo(240.2, 320);
    fastProxy.lineTo(240.2, 320);
    fastProxy.lineTo(240.2, 174);
    fastProxy.lineTo(240.7, 145);
    fastProxy.lineTo(240.8, 320);
    fastProxy.lineTo(241.3, 29);
    fastProxy.lineTo(241.4, 320);
    fastProxy.lineTo(715.9, 320);
    fastProxy.lineTo(715.9, 320);
    fastProxy.fill();

    assert.deepEqual([['moveTo', 240.2, 320], ['lineTo', 240.2, 320], ['lineTo', 240.2, 174], ['lineTo', 240.7, 145], ['lineTo', 240.8, 320], ['lineTo', 241.3, 29], ['lineTo', 241.4, 320], ['lineTo', 715.9, 320], ['lineTo', 715.9, 320]], extractMoveToAndLineToCalls(htx));
  });
});

},{"../../src/dygraph-canvas":130,"./Proxy":4}],20:[function(require,module,exports){
/**
 * @fileoverview Test if you give null values to dygraph with stepPlot
 * and fillGraph options enabled
 *
 * @author benoitboivin.pro@gmail.com (Benoit Boivin)
 */
'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

describe("fill-step-plot", function () {

  cleanupAfterEach();

  var origFunc = utils.getContext;

  beforeEach(function () {
    utils.getContext = function (canvas) {
      return new _Proxy2['default'](origFunc(canvas));
    };
  });

  afterEach(function () {
    utils.getContext = origFunc;
  });

  it('testFillStepPlotNullValues', function () {
    var opts = {
      labels: ["x", "y"],
      width: 480,
      height: 320,
      fillGraph: true,
      stepPlot: true
    };
    var data = [[1, 3], [2, 0], [3, 8], [4, null], [5, 9], [6, 8], [7, 6], [8, 3]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;
    var x1 = data[3][0];
    var y1 = data[2][1];
    var x2 = data[3][0];
    var y2 = 0;
    var xy1 = g.toDomCoords(x1, y1);
    var xy2 = g.toDomCoords(x2, y2);

    // Check if a line is drawn between the previous y and the bottom of the chart
    _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, {});
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./Proxy":4}],21:[function(require,module,exports){
/**
 * @fileoverview Tests for data formats.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

"use strict";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

describe("formats", function () {

  cleanupAfterEach();

  var dataString = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

  var dataArray = [[0, -1], [1, 0], [2, 1], [3, 0]];
  var BASE_OPTS = { labels: ['X', 'Y'] };

  it('testCsv', function () {
    var data = dataString;
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, {});
    assertData(g);
  });

  it('testArray', function () {
    var data = dataArray;
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, BASE_OPTS);
    assertData(g);
  });

  it('testFunctionReturnsCsv', function () {
    var data = function data() {
      return dataString;
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, {});
    assertData(g);
  });

  it('testFunctionDefinesArray', function () {
    var array = dataArray;
    var data = function data() {
      return array;
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, BASE_OPTS);
    assertData(g);
  });

  it('testXValueParser', function () {
    var data = "X,Y\n" + "d,-1\n" + "e,0\n" + "f,1\n" + "g,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, {
      xValueParser: function xValueParser(str) {
        assert.equal(1, str.length);
        return str.charCodeAt(0) - "a".charCodeAt(0);
      }
    });

    assert.equal(3, g.getValue(0, 0));
    assert.equal(4, g.getValue(1, 0));
    assert.equal(5, g.getValue(2, 0));
    assert.equal(6, g.getValue(3, 0));
  });

  it('should throw on strings in native format', function () {
    assert.throws(function () {
      new _srcDygraph2["default"]('graph', [['1', '10'], ['2', '20']]);
    }, /expected number or date/i);

    assert.throws(function () {
      new _srcDygraph2["default"]('graph', [[new Date(), '10'], [new Date(), '20']]);
    }, /expected number or array/i);
  });

  var assertData = function assertData(g) {
    var expected = dataArray;

    assert.equal(4, g.numRows());
    assert.equal(2, g.numColumns());

    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 2; j++) {
        assert.equal(expected[i][j], g.getValue(i, j));
      }
    }
  };
});

},{"../../src/dygraph":139}],22:[function(require,module,exports){
/**
 * @fileoverview Test cases for the per-axis grid options, including the new
 *               option "gridLinePattern".
 * 
 * @author david.eberlein@ch.sauter-bc.com (Fr. Sauter AG)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

var _PixelSampler = require('./PixelSampler');

var _PixelSampler2 = _interopRequireDefault(_PixelSampler);

describe("grid-per-axis", function () {

  cleanupAfterEach();
  useProxyCanvas(utils, _Proxy2['default']);

  it('testIndependentGrids', function () {
    var opts = {
      width: 480,
      height: 320,
      errorBars: false,
      labels: ["X", "Left", "Right"],
      series: {
        Left: {
          axis: "y"
        },
        Right: {
          axis: "y2"
        }
      },
      axes: {
        y2: {
          drawGrid: true,
          independentTicks: true
        }
      }
    };

    var data = [[1, 0, 0], [2, 12, 88], [3, 88, 122], [4, 63, 273], [5, 110, 333]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    // The expected gridlines
    var yGridlines = [0, 20, 40, 60, 80, 100, 120];
    var y2Gridlines = [0, 50, 100, 150, 200, 250, 300, 350];
    var gridlines = [yGridlines, y2Gridlines];

    function halfUp(x) {
      return Math.round(x) + 0.5;
    }
    function halfDown(y) {
      return Math.round(y) - 0.5;
    }

    var attrs = {},
        x,
        y;
    x = halfUp(g.plotter_.area.x);
    // Step through y(0) and y2(1) axis
    for (var axis = 0; axis < 2; axis++) {
      // Step through all gridlines of the axis
      for (var i = 0; i < gridlines[axis].length; i++) {
        // Check the labels:
        var labels = _Util2['default'].getYLabels(axis + 1);
        assert.equal(gridlines[axis][i], labels[i], "Expected label not found.");

        // Check that the grid was drawn.
        y = halfDown(g.toDomYCoord(gridlines[axis][i], axis));
        var p1 = [x, y];
        var p2 = [x + g.plotter_.area.w, y];
        _CanvasAssertions2['default'].assertLineDrawn(htx, p1, p2, attrs);
      }
    }
  });

  it('testPerAxisGridColors', function () {
    var opts = {
      width: 480,
      height: 320,
      errorBars: false,
      labels: ["X", "Left", "Right"],
      series: {
        Left: {
          axis: "y"
        },
        Right: {
          axis: "y2"
        }
      },
      axes: {
        y: {
          gridLineColor: "#0000ff",
          gridLineWidth: 2
        },
        y2: {
          drawGrid: true,
          independentTicks: true,
          gridLineColor: "#ff0000",
          gridLineWidth: 2
        }
      }
    };
    var data = [[1, 0, 0], [2, 12, 88], [3, 88, 122], [4, 63, 273], [5, 110, 333]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    var htx = g.hidden_ctx_;

    // The expected gridlines
    var yGridlines = [20, 40, 60, 80, 100, 120];
    var y2Gridlines = [50, 100, 150, 200, 250, 300, 350];
    var gridlines = [yGridlines, y2Gridlines];
    var gridColors = [[0, 0, 255, 255], [255, 0, 0, 255]];

    function halfUp(x) {
      return Math.round(x) + 1;
    }
    function halfDown(y) {
      return Math.round(y) - 1;
    }
    var x, y;
    x = halfUp(g.plotter_.area.x);
    var sampler = new _PixelSampler2['default'](g);
    // Step through y(0) and y2(1) axis
    for (var axis = 0; axis < 2; axis++) {
      // Step through all gridlines of the axis
      for (var i = 0; i < gridlines[axis].length; i++) {
        y = halfDown(g.toDomYCoord(gridlines[axis][i], axis));
        // Check the grid colors.
        assert.deepEqual(gridColors[axis], sampler.colorAtPixel(x, y), "Unexpected grid color found at pixel: x: " + x + "y: " + y);
      }
    }
  });

  it('testPerAxisGridWidth', function () {
    var opts = {
      width: 480,
      height: 320,
      errorBars: false,
      gridLineColor: "#ff0000",
      labels: ["X", "Left", "Right"],
      series: {
        Left: {
          axis: "y"
        },
        Right: {
          axis: "y2"
        }
      },
      axes: {
        x: {
          gridLineWidth: 4
        },
        y: {
          gridLineWidth: 2
        },
        y2: {
          drawGrid: true,
          independentTicks: true,
          gridLineWidth: 1
        }
      }
    };
    var data = [[1, 0, 0], [2, 12, 88], [3, 88, 122], [4, 63, 273], [5, 110, 333]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    var htx = g.hidden_ctx_;

    // The expected gridlines
    var yGridlines = [20, 40, 60, 80];
    var y2Gridlines = [50, 100, 150, 200, 250, 350];
    var gridlines = [yGridlines, y2Gridlines];
    var xGridlines = [2, 3, 4];
    var gridColor = [255, 0, 0];
    var emptyColor = [0, 0, 0];

    function halfUp(x) {
      return Math.round(x) + 1;
    }
    function halfDown(y) {
      return Math.round(y) - 1;
    }
    var x, y;
    x = halfUp(g.plotter_.area.x + 10);

    var sampler = new _PixelSampler2['default'](g);
    // Step through y(0) and y2(1) axis
    for (var axis = 0; axis < 2; axis++) {
      // Step through all gridlines of the axis
      for (var i = 0; i < gridlines[axis].length; i++) {
        y = halfDown(g.toDomYCoord(gridlines[axis][i], axis));
        // Ignore the alpha value

        // FIXME(pholden): this test fails with a context pixel ratio of 2.
        var drawnPixeldown2 = sampler.rgbAtPixel(x, y - 2);
        var drawnPixeldown1 = sampler.rgbAtPixel(x, y - 1);
        var drawnPixel = sampler.rgbAtPixel(x, y);
        var drawnPixelup1 = sampler.rgbAtPixel(x, y + 1);
        var drawnPixelup2 = sampler.rgbAtPixel(x, y + 2);
        // Check the grid width.
        switch (axis) {
          case 0:
            // y with 2 pixels width
            assert.deepEqual(emptyColor, drawnPixeldown2, "Unexpected y-grid color found at pixel: x: " + x + "y: " + y);
            assert.deepEqual(gridColor, drawnPixeldown1, "Unexpected y-grid color found at pixel: x: " + x + "y: " + y);
            assert.deepEqual(gridColor, drawnPixel, "Unexpected y-grid color found at pixel: x: " + x + "y: " + y);
            assert.deepEqual(gridColor, drawnPixelup1, "Unexpected y-grid color found at pixel: x: " + x + "y: " + y);
            assert.deepEqual(emptyColor, drawnPixelup2, "Unexpected y-grid color found at pixel: x: " + x + "y: " + y);
            break;
          case 1:
            // y2 with 1 pixel width
            assert.deepEqual(emptyColor, drawnPixeldown1, "Unexpected y2-grid color found at pixel: x: " + x + "y: " + y);
            assert.deepEqual(gridColor, drawnPixel, "Unexpected y2-grid color found at pixel: x: " + x + "y: " + y);
            assert.deepEqual(emptyColor, drawnPixelup1, "Unexpected y2-grid color found at pixel: x: " + x + "y: " + y);
            break;
        }
      }
    }

    // Check the x axis grid
    y = halfDown(g.plotter_.area.y) + 10;
    for (var i = 0; i < xGridlines.length; i++) {
      x = halfUp(g.toDomXCoord(xGridlines[i]));
      assert.deepEqual(emptyColor, sampler.rgbAtPixel(x - 4, y), "Unexpected x-grid color found at pixel: x: " + x + "y: " + y);
      assert.deepEqual(gridColor, sampler.rgbAtPixel(x - 3, y), "Unexpected x-grid color found at pixel: x: " + x + "y: " + y);
      assert.deepEqual(gridColor, sampler.rgbAtPixel(x - 2, y), "Unexpected x-grid color found at pixel: x: " + x + "y: " + y);
      assert.deepEqual(gridColor, sampler.rgbAtPixel(x - 1, y), "Unexpected x-grid color found at pixel: x: " + x + "y: " + y);
      assert.deepEqual(gridColor, sampler.rgbAtPixel(x, y), "Unexpected x-grid color found at pixel: x: " + x + "y: " + y);
      assert.deepEqual(gridColor, sampler.rgbAtPixel(x + 1, y), "Unexpected x-grid color found at pixel: x: " + x + "y: " + y);
      assert.deepEqual(emptyColor, sampler.rgbAtPixel(x + 2, y), "Unexpected x-grid color found at pixel: x: " + x + "y: " + y);
    }
  });

  // PhantomJS 1.9.x does not support setLineDash
  // When Travis-CI updates to Phantom2, this can be re-enabled.
  // See https://github.com/ariya/phantomjs/issues/12948
  if (!navigator.userAgent.match(/PhantomJS\/1.9/)) {
    it('testGridLinePattern', function () {
      var opts = {
        width: 480,
        height: 320,
        errorBars: false,
        labels: ["X", "Left", "Right"],
        colors: ["rgba(0,0,0,0)", "rgba(0,0,0,0)"],
        series: {
          Left: {
            axis: "y"
          },
          Right: {
            axis: "y2"
          }
        },
        axes: {
          x: {
            drawGrid: false,
            drawAxis: false
          },
          y: {
            drawAxis: false,
            gridLineColor: "#0000ff",
            gridLinePattern: [10, 10]
          }
        }
      };
      var data = [[1, 0, 0], [2, 12, 88], [3, 88, 122], [4, 63, 273], [5, 110, 333]];
      var graph = document.getElementById("graph");
      var g = new _srcDygraph2['default'](graph, data, opts);
      var htx = g.hidden_ctx_;

      // The expected gridlines
      var yGridlines = [0, 20, 40, 60, 80, 100, 120];

      function halfUp(x) {
        return Math.round(x) + 1;
      }
      function halfDown(y) {
        return Math.round(y) - 1;
      }
      var x, y;
      var sampler = new _PixelSampler2['default'](g);
      // Step through all gridlines of the axis
      for (var i = 0; i < yGridlines.length; i++) {
        y = halfDown(g.toDomYCoord(yGridlines[i], 0));
        // Step through the pixels of the line and test the pattern.
        for (x = halfUp(g.plotter_.area.x); x < g.plotter_.area.w; x++) {
          // avoid checking the edge pixels since they differ depending on the OS.
          var pixelpos = x % 10;
          if (pixelpos < 1 || pixelpos > 8) continue;

          // XXX: check what this looks like at master

          // Ignore alpha
          var drawnPixel = sampler.rgbAtPixel(x, y);
          var pattern = Math.floor(x / 10) % 2;
          switch (pattern) {
            case 0:
              // fill
              assert.deepEqual([0, 0, 255], drawnPixel, "Unexpected filled grid-pattern color found at pixel: x: " + x + " y: " + y);
              break;
            case 1:
              // no fill
              assert.deepEqual([0, 0, 0], drawnPixel, "Unexpected empty grid-pattern color found at pixel: x: " + x + " y: " + y);
              break;
          }
        }
      }
    });
  }
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./PixelSampler":3,"./Proxy":4,"./Util":5}],23:[function(require,module,exports){
/**
 * Unit tests for GViz data table support.
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe('gviz', function () {

  cleanupAfterEach();

  // This is a fake version of the gviz DataTable API, which can only be
  // sourced using the google js loader.
  //
  // Their example of the "data" structure is:
  //   cols: [{id: 'task', label: 'Task', type: 'string'},
  //          {id: 'hours', label: 'Hours per Day', type: 'number'}],
  //   rows: [{c:[{v: 'Work'}, {v: 11}]},
  //          {c:[{v: 'Eat'}, {v: 2}]},
  //          {c:[{v: 'Commute'}, {v: 2}]},
  //          {c:[{v: 'Watch TV'}, {v:2}]},
  //          {c:[{v: 'Sleep'}, {v:7, f:'7.000'}]}
  //         ]
  //
  // https://developers.google.com/chart/interactive/docs/reference#DataTable
  var FakeDataTable = function FakeDataTable(data) {
    this.data = data;
  };
  FakeDataTable.prototype.getNumberOfColumns = function () {
    return this.data.cols.length;
  };
  FakeDataTable.prototype.getNumberOfRows = function () {
    return this.data.rows.length;
  };
  FakeDataTable.prototype.getColumnType = function (idx) {
    return this.data.cols[idx].type;
  };
  FakeDataTable.prototype.getColumnLabel = function (idx) {
    return this.data.cols[idx].label;
  };
  FakeDataTable.prototype.getValue = function (row, col) {
    return this.data.rows[row].c[col].v;
  };
  FakeDataTable.prototype.getColumnRange = function (col) {
    throw 'Not Implemented';
  };

  // This mirrors http://dygraphs.com/tests/gviz.html
  var numericData = new FakeDataTable({
    cols: [{ id: "", label: "X", type: "number" }, { id: "", label: "A", type: "number" }, { id: "", label: "B", type: "number" }],
    rows: [{ c: [{ v: 0 }, { v: 1 }, { v: 7 }] }, { c: [{ v: 1 }, { v: 2 }, { v: 4 }] }, { c: [{ v: 2 }, { v: 3 }, { v: 3 }] }, { c: [{ v: 3 }, { v: 4 }, { v: 0 }] }]
  });

  it('should parse simple data tables', function () {
    var g = new _srcDygraph2['default']('graph', numericData);
    assert.equal(4, g.numRows());
    assert.equal(3, g.numColumns());
    assert.equal(0, g.getValue(0, 0));
    assert.equal(1, g.getValue(0, 1));
    assert.equal(7, g.getValue(0, 2));
    assert.equal(3, g.getValue(3, 0));
    assert.equal(4, g.getValue(3, 1));
    assert.equal(0, g.getValue(3, 2));
    assert.deepEqual(['X', 'A', 'B'], g.getLabels());
  });

  it('should parse tables with annotations', function () {
    // Data from https://developers.google.com/chart/interactive/docs/gallery/annotatedtimeline
    var data = new FakeDataTable({
      cols: [{ label: "Date", type: "date" }, { label: "Sold Pencils", type: "number" }, { label: "title1", type: "string" }, { label: "text1", type: "string" }, { label: "Sold Pens", type: "number" }, { label: "title2", type: "string" }, { label: "text2", type: "string" }],
      rows: [{ c: [{ v: new Date(2008, 1, 1) }, { v: 30000 }, { v: null }, { v: null }, { v: 40645 }, { v: null }, { v: null }] }, { c: [{ v: new Date(2008, 1, 2) }, { v: 14045 }, { v: null }, { v: null }, { v: 20374 }, { v: null }, { v: null }] }, { c: [{ v: new Date(2008, 1, 3) }, { v: 55022 }, { v: null }, { v: null }, { v: 50766 }, { v: null }, { v: null }] }, { c: [{ v: new Date(2008, 1, 4) }, { v: 75284 }, { v: null }, { v: null }, { v: 14334 }, { v: "Out of Stock" }, { v: "Ran out of stock" }] }, { c: [{ v: new Date(2008, 1, 5) }, { v: 41476 }, { v: "Bought Pens" }, { v: "Bought 200k pens" }, { v: 66467 }, { v: null }, { v: null }] }, { c: [{ v: new Date(2008, 1, 6) }, { v: 33322 }, { v: null }, { v: null }, { v: 39463 }, { v: null }, { v: null }] }]
    });

    var g = new _srcDygraph2['default']('graph', data, { displayAnnotations: true });

    var annEls = document.getElementsByClassName('dygraphDefaultAnnotation');
    assert.equal(2, annEls.length);

    var annotations = g.annotations();
    assert.equal(2, annotations.length);
    var a0 = annotations[0];
    assert.deepEqual({
      text: 'Out of Stock\nRan out of stock',
      series: 'Sold Pens',
      xval: new Date(2008, 1, 4).getTime(),
      shortText: 'A'
    }, annotations[0]);
  });

  it('should parse tables with dates', function () {
    // This mirrors http://dygraphs.com/tests/gviz.html
    var data = new FakeDataTable({
      cols: [{ id: "", label: "Date", type: "datetime" }, { id: "", label: "Column A", type: "number" }, { id: "", label: "Column B", type: "number" }],
      rows: [{ c: [{ v: new Date(2009, 6, 1) }, { v: 1 }, { v: 7 }] }, { c: [{ v: new Date(2009, 6, 8) }, { v: 2 }, { v: 4 }] }, { c: [{ v: new Date(2009, 6, 15) }, { v: 3 }, { v: 3 }] }, { c: [{ v: new Date(2009, 6, 22) }, { v: 4 }, { v: 0 }] }]
    });

    var g = new _srcDygraph2['default']('graph', data);
    assert.equal(4, g.numRows());
    assert.equal(3, g.numColumns());
    assert.equal(new Date(2009, 6, 1).getTime(), g.getValue(0, 0));
    assert.equal(1, g.getValue(0, 1));
    assert.equal(7, g.getValue(0, 2));
    assert.deepEqual(['Date', 'Column A', 'Column B'], g.getLabels());
  });

  // it('should parse tables with error bars', function() {
  // });

  it('should implement the gviz API', function () {
    var g = new _srcDygraph2['default'].GVizChart(document.getElementById('graph'));
    g.draw(numericData);

    g.setSelection([{ row: 0 }]);
    assert.equal('0: A: 1 B: 7', _Util2['default'].getLegend());
    assert.deepEqual([{ row: 0, column: 1 }, { row: 0, column: 2 }], g.getSelection());
    g.setSelection([]);
    assert.deepEqual([], g.getSelection());
  });
});

},{"../../src/dygraph":139,"./Util":5}],24:[function(require,module,exports){
/**
 * @fileoverview Tests for window.devicePixelRatio > 1.
 *
 * @author danvdk@gmail.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

describe("hidpi", function () {

  cleanupAfterEach();

  var savePixelRatio;
  beforeEach(function () {
    savePixelRatio = window.devicePixelRatio;
    window.devicePixelRatio = 2;
  });

  afterEach(function () {
    window.devicePixelRatio = savePixelRatio;
  });

  it('testDoesntCreateScrollbars', function () {
    var sw = document.body.scrollWidth;
    var cw = document.body.clientWidth;

    var graph = document.getElementById("graph");
    graph.style.width = "70%"; // more than half.
    graph.style.height = "200px";

    var opts = {};
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var g = new _srcDygraph2['default'](graph, data, opts);

    // Adding the graph shouldn't cause the width of the page to change.
    // (essentially, we're checking that we don't end up with a scrollbar)
    // See http://stackoverflow.com/a/2146905/388951
    assert.equal(cw, document.body.clientWidth);
    assert.equal(sw, document.body.scrollWidth);
  });
});

},{"../../src/dygraph":139}],25:[function(require,module,exports){
/**
 * @fileoverview Tests for the highlightSeriesBackgroundAlpha and
 * highlightSeriesBackgroundColor options.
 * @author sergeyslepian@gmail.com
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("highlight-series-background", function () {

  cleanupAfterEach();

  var origRepeatAndCleanup;

  beforeEach(function () {
    // A "fast" version of repeatAndCleanup
    origRepeatAndCleanup = utils.repeatAndCleanup;
    // utils.repeatAndCleanup = function(repeatFn, maxFrames, framePeriodInMillis, cleanupFn) {
    //   repeatFn(0);
    //   if (maxFrames > 1) repeatFn(maxFrames - 1);
    //   cleanupFn();
    // };
  });

  afterEach(function () {
    utils.repeatAndCleanup = origRepeatAndCleanup;
  });

  function setupGraph(highlightSeriesBackgroundAlpha, highlightSeriesBackgroundColor) {
    var opts = {
      width: 480,
      height: 320,
      labels: ['x', 'y'],
      legend: 'always',
      highlightSeriesOpts: {
        strokeWidth: 1,
        strokeBorderWidth: 1,
        highlightCircleSize: 1
      }
    };

    if (highlightSeriesBackgroundAlpha) utils.update(opts, { highlightSeriesBackgroundAlpha: highlightSeriesBackgroundAlpha });
    if (highlightSeriesBackgroundColor) utils.update(opts, { highlightSeriesBackgroundColor: highlightSeriesBackgroundColor });

    var data = [];
    for (var j = 0; j < 10; j++) {
      data.push([j, 0]);
    }

    return new _srcDygraph2['default']('graph', data, opts);
  }

  it('testDefaultHighlight', function (done) {
    var graph = setupGraph();

    assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [0, 0, 0, 0]);

    graph.setSelection(0, 'y', true);

    // handle background color fade-in time
    window.setTimeout(function () {
      assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [255, 255, 255, 127]);
      done();
    }, 500);
  });

  it('testNoHighlight', function (done) {
    var graph = setupGraph(1);

    assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [0, 0, 0, 0]);

    graph.setSelection(0, 'y', true);

    // handle background color fade-in time
    window.setTimeout(function () {
      assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [0, 0, 0, 0]);
      done();
    }, 500);
  });

  it('testCustomHighlightColor', function (done) {
    var graph = setupGraph(null, 'rgb(0,255,255)');

    assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [0, 0, 0, 0]);

    graph.setSelection(0, 'y', true);

    // handle background color fade-in time
    window.setTimeout(function () {
      assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [0, 255, 255, 127]);
      done();
    }, 500);
  });

  it('testCustomHighlightAlpha', function (done) {
    var graph = setupGraph(0.3);

    assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [0, 0, 0, 0]);

    graph.setSelection(0, 'y', true);

    // handle background color fade-in time
    window.setTimeout(function () {
      assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [255, 255, 255, 179]);
      done();
    }, 500);
  });

  it('testCustomHighlightColorAndAlpha', function (done) {
    var graph = setupGraph(0.7, 'rgb(255,0,0)');

    assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [0, 0, 0, 0]);

    graph.setSelection(0, 'y', true);

    // handle background color fade-in time
    window.setTimeout(function () {
      assert.deepEqual(_Util2['default'].samplePixel(graph.canvas_, 100, 100), [255, 0, 0, 76]);
      done();
    }, 500);
  });

  it('testGetSelectionZeroCanvasY', function () {
    var graph = document.getElementById("graph");
    var calls = [];
    function callback(g, seriesName, canvasContext, cx, cy, color, pointSize, idx) {
      calls.push(arguments);
    };

    var g = new _srcDygraph2['default'](document.getElementById("graph"), "X,Y\n" + "1,5\n" + "1,10\n" + "1,12\n", {
      drawHighlightPointCallback: callback,
      axes: {
        y: {
          valueRange: [0, 10]
        }
      }
    });
    g.setSelection(1);
    var args = calls[0];
    assert.equal(args[4], 0);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./Util":5}],26:[function(require,module,exports){
/**
 * @fileoverview Test cases for the interaction model.
 *
 * @author konigsberg@google.com (Robert Konigsbrg)
 */

'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphInteractionModel = require('../../src/dygraph-interaction-model');

var _srcDygraphInteractionModel2 = _interopRequireDefault(_srcDygraphInteractionModel);

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

describe("interaction-model", function () {

  cleanupAfterEach();

  var data1 = "X,Y\n" + "20,-1\n" + "21,0\n" + "22,1\n" + "23,0\n";

  var data2 = "X,Y\n" + "1,10\n" + "2,20\n" + "3,30\n" + "4,40\n" + "5,120\n" + "6,50\n" + "7,70\n" + "8,90\n" + "9,50\n";

  function getXLabels() {
    var x_labels = document.getElementsByClassName("dygraph-axis-label-x");
    var ary = [];
    for (var i = 0; i < x_labels.length; i++) {
      ary.push(x_labels[i].innerHTML);
    }
    return ary;
  }

  /*
  it('testPan', function() {
    var originalXRange = g.xAxisRange();
    var originalYRange = g.yAxisRange(0);
  
    DygraphOps.dispatchMouseDown(g, xRange[0], yRange[0]);
    DygraphOps.dispatchMouseMove(g, xRange[1], yRange[0]); // this is really necessary.
    DygraphOps.dispatchMouseUp(g, xRange[1], yRange[0]);
  
    assert.closeTo(xRange, g.xAxisRange(), 0.2);
    // assert.closeTo(originalYRange, g.yAxisRange(0), 0.2); // Not true, it's something in the middle.
  
    var midX = (xRange[1] - xRange[0]) / 2;
    DygraphOps.dispatchMouseDown(g, midX, yRange[0]);
    DygraphOps.dispatchMouseMove(g, midX, yRange[1]); // this is really necessary.
    DygraphOps.dispatchMouseUp(g, midX, yRange[1]);
  
    assert.closeTo(xRange, g.xAxisRange(), 0.2);
    assert.closeTo(yRange, g.yAxisRange(0), 0.2);
  });
  */

  /**
   * This tests that when changing the interaction model so pan is used instead
   * of zoom as the default behavior, a standard click method is still called.
   */
  it('testClickCallbackIsCalled', function () {
    var clicked;

    var clickCallback = function clickCallback(event, x) {
      clicked = x;
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data1, {
      width: 100,
      height: 100,
      clickCallback: clickCallback
    });

    _DygraphOps2['default'].dispatchMouseDown_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 10, 10);

    assert.equal(20, clicked);
  });

  /**
   * This tests that when changing the interaction model so pan is used instead
   * of zoom as the default behavior, a standard click method is still called.
   */
  it('testClickCallbackIsCalledOnCustomPan', function () {
    var clicked;

    var clickCallback = function clickCallback(event, x) {
      clicked = x;
    };

    function customDown(event, g, context) {
      context.initializeMouseDown(event, g, context);
      _srcDygraphInteractionModel2['default'].startPan(event, g, context);
    }

    function customMove(event, g, context) {
      _srcDygraphInteractionModel2['default'].movePan(event, g, context);
    }

    function customUp(event, g, context) {
      _srcDygraphInteractionModel2['default'].endPan(event, g, context);
    }

    var opts = {
      width: 100,
      height: 100,
      clickCallback: clickCallback,
      interactionModel: {
        'mousedown': customDown,
        'mousemove': customMove,
        'mouseup': customUp
      }
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data1, opts);

    _DygraphOps2['default'].dispatchMouseDown_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 10, 10);

    assert.equal(20, clicked);
  });

  var clickAt = function clickAt(g, x, y) {
    _DygraphOps2['default'].dispatchMouseDown(g, x, y);
    _DygraphOps2['default'].dispatchMouseMove(g, x, y);
    _DygraphOps2['default'].dispatchMouseUp(g, x, y);
  };

  /**
   * This tests that clickCallback is still called with the nonInteractiveModel.
   */
  it('testClickCallbackIsCalledWithNonInteractiveModel', function () {
    var clicked;

    // TODO(danvk): also test pointClickCallback here.
    var clickCallback = function clickCallback(event, x) {
      clicked = x;
    };

    var opts = {
      width: 100,
      height: 100,
      clickCallback: clickCallback,
      interactionModel: _srcDygraphInteractionModel2['default'].nonInteractiveModel_
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data1, opts);

    _DygraphOps2['default'].dispatchMouseDown_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 10, 10);

    assert.equal(20, clicked);
  });

  /**
   * A sanity test to ensure pointClickCallback is called.
   */
  it('testPointClickCallback', function () {
    var clicked = null;
    var g = new _srcDygraph2['default']('graph', data2, {
      pointClickCallback: function pointClickCallback(event, point) {
        clicked = point;
      }
    });

    clickAt(g, 4, 40);

    assert.isNotNull(clicked);
    assert.equal(4, clicked.xval);
    assert.equal(40, clicked.yval);
  });

  /**
   * A sanity test to ensure pointClickCallback is not called when out of range.
   */
  it('testNoPointClickCallbackWhenOffPoint', function () {
    var clicked;
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {
      pointClickCallback: function pointClickCallback(event, point) {
        clicked = point;
      }
    });

    clickAt(g, 5, 40);

    assert.isUndefined(clicked);
  });

  /**
   * Ensures pointClickCallback circle size is taken into account.
   */
  it('testPointClickCallback_circleSize', function () {
    // TODO(konigsberg): Implement.
  });

  /**
   * Ensures that pointClickCallback is called prior to clickCallback
   */
  it('testPointClickCallbackCalledPriorToClickCallback', function () {
    var counter = 0;
    var pointClicked;
    var clicked;
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {
      pointClickCallback: function pointClickCallback(event, point) {
        counter++;
        pointClicked = counter;
      },
      clickCallback: function clickCallback(event, point) {
        counter++;
        clicked = counter;
      }
    });

    clickAt(g, 4, 40);
    assert.equal(1, pointClicked);
    assert.equal(2, clicked);
  });

  /**
   * Ensures that when there's no pointClickCallback, clicking on a point still calls
   * clickCallback
   */
  it('testClickCallback_clickOnPoint', function () {
    var clicked;
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {
      clickCallback: function clickCallback(event, point) {
        clicked = 1;
      }
    });

    clickAt(g, 4, 40);
    assert.equal(1, clicked);
  });

  it('testIsZoomed_none', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {});

    assert.isFalse(g.isZoomed());
    assert.isFalse(g.isZoomed("x"));
    assert.isFalse(g.isZoomed("y"));
  });

  it('testIsZoomed_x', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {});

    _DygraphOps2['default'].dispatchMouseDown_Point(g, 100, 100);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 130, 100);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 130, 100);

    assert.isTrue(g.isZoomed());
    assert.isTrue(g.isZoomed("x"));
    assert.isFalse(g.isZoomed("y"));
  });

  it('testIsZoomed_y', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {});

    _DygraphOps2['default'].dispatchMouseDown_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 10, 30);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 10, 30);

    assert.isTrue(g.isZoomed());
    assert.isFalse(g.isZoomed("x"));
    assert.isTrue(g.isZoomed("y"));
  });

  it('testIsZoomed_both', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {});

    // Zoom x axis
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 100, 100);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 130, 100);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 130, 100);

    // Now zoom y axis
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 100, 100);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 100, 130);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 100, 130);

    assert.isTrue(g.isZoomed());
    assert.isTrue(g.isZoomed("x"));
    assert.isTrue(g.isZoomed("y"));
  });

  it('testIsZoomed_updateOptions_none', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {});

    g.updateOptions({});

    assert.isFalse(g.isZoomed());
    assert.isFalse(g.isZoomed("x"));
    assert.isFalse(g.isZoomed("y"));
  });

  it('testIsZoomed_updateOptions_x', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {});

    g.updateOptions({ dateWindow: [-.5, .3] });
    assert.isTrue(g.isZoomed());
    assert.isTrue(g.isZoomed("x"));
    assert.isFalse(g.isZoomed("y"));
  });

  it('testIsZoomed_updateOptions_y', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {});

    g.updateOptions({ valueRange: [1, 10] });

    assert.isTrue(g.isZoomed());
    assert.isFalse(g.isZoomed("x"));
    assert.isTrue(g.isZoomed("y"));
  });

  it('testIsZoomed_updateOptions_both', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {});

    g.updateOptions({ dateWindow: [-1, 1], valueRange: [1, 10] });

    assert.isTrue(g.isZoomed());
    assert.isTrue(g.isZoomed("x"));
    assert.isTrue(g.isZoomed("y"));
  });

  it('testCorrectAxisValueRangeAfterUnzoom', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {
      valueRange: [1, 50],
      dateWindow: [1, 9],
      animatedZooms: false
    });

    // Zoom x axis
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 100, 100);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 130, 100);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 130, 100);

    // Zoom y axis
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 100, 100);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 100, 130);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 100, 130);
    var currentYAxisRange = g.yAxisRange();
    var currentXAxisRange = g.xAxisRange();

    //check that the range for the axis has changed
    assert.notEqual(1, currentXAxisRange[0]);
    assert.notEqual(10, currentXAxisRange[1]);
    assert.notEqual(1, currentYAxisRange[0]);
    assert.notEqual(50, currentYAxisRange[1]);

    // unzoom by doubleclick.  This is really the order in which a browser
    // generates events, and we depend on it.
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchDoubleClick(g, null);

    // check if the range for both axis was reset to show the full data.
    assert.deepEqual(g.yAxisExtremes()[0], g.yAxisRange());
    assert.deepEqual(g.xAxisExtremes(), g.xAxisRange());
  });

  /**
   * Ensures pointClickCallback is called when some points along the y-axis don't
   * exist.
   */
  it('testPointClickCallback_missingData', function () {

    // There's a B-value at 2, but no A-value.
    var data = "X,A,B\n" + "1,,100\n" + "2,,110\n" + "3,140,120\n" + "4,130,110\n" + "";

    var clicked;
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      pointClickCallback: function pointClickCallback(event, point) {
        clicked = point;
      }
    });

    clickAt(g, 2, 110);

    assert.equal(2, clicked.xval);
    assert.equal(110, clicked.yval);
  });

  describe('animated zooms', function () {
    var oldDuration;

    before(function () {
      oldDuration = _srcDygraph2['default'].ANIMATION_DURATION;
      _srcDygraph2['default'].ANIMATION_DURATION = 100; // speed up the animation for testing
    });
    after(function () {
      _srcDygraph2['default'].ANIMATION_DURATION = oldDuration;
    });

    it('should support animated zooms', function (done) {
      var data = "X,A,B\n" + "1,120,100\n" + "2,110,110\n" + "3,140,120\n" + "4,130,110\n";

      var ranges = [];

      var g = new _srcDygraph2['default']('graph', data, {
        animatedZooms: true
      });

      // updating the dateWindow does not result in an animation.
      assert.deepEqual([1, 4], g.xAxisRange());
      g.updateOptions({ dateWindow: [2, 4] });
      assert.deepEqual([2, 4], g.xAxisRange());

      g.updateOptions({
        // zoomCallback is called once when the animation is complete.
        zoomCallback: function zoomCallback(xMin, xMax) {
          assert.equal(1, xMin);
          assert.equal(4, xMax);
          assert.deepEqual([1, 4], g.xAxisRange());
          done();
        }
      }, false);

      // Zoom out -- resetZoom() _does_ produce an animation.
      g.resetZoom();
      assert.notDeepEqual([2, 4], g.xAxisRange()); // first frame is synchronous
      assert.notDeepEqual([1, 4], g.xAxisRange());

      // at this point control flow goes up to zoomCallback
    });
  });

  //bulk copied from "testCorrectAxisValueRangeAfterUnzoom"
  //tests if the xRangePad is taken into account after unzoom.
  it('testCorrectAxisPaddingAfterUnzoom', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data2, {
      valueRange: [1, 50],
      dateWindow: [1, 9],
      xRangePad: 10,
      animatedZooms: false
    });

    var xExtremes = g.xAxisExtremes();

    var _g$yAxisExtremes = g.yAxisExtremes();

    var _g$yAxisExtremes2 = _slicedToArray(_g$yAxisExtremes, 1);

    var yExtremes = _g$yAxisExtremes2[0];

    // Zoom x axis
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 100, 100);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 130, 100);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 130, 100);

    // Zoom y axis
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 100, 100);
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 100, 130);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 100, 130);

    //check that the range for the axis has changed
    assert.notDeepEqual([1, 10], g.xAxisRange());
    assert.notDeepEqual([1, 50], g.yAxisRange());

    // unzoom by doubleclick.  This is really the order in which a browser
    // generates events, and we depend on it.
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 10, 10);
    _DygraphOps2['default'].dispatchDoubleClick(g, null);

    // check if range for x-axis was reset to original value.
    assert.deepEqual(xExtremes, g.xAxisRange());
    assert.deepEqual(yExtremes, g.yAxisRange());
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-interaction-model":133,"./DygraphOps":2}],27:[function(require,module,exports){
// Copyright (c) 2012 Google, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/**
 * @fileoverview Test cases for drawing lines with missing points.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

var ZERO_TO_FIFTY = [[10, 0], [20, 50]];

describe("missing-points", function () {

  cleanupAfterEach();
  useProxyCanvas(utils, _Proxy2['default']);

  it('testSeparatedPointsDontDraw', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[1, 10, 11], [2, 11, null], [3, 12, 13]], {
      colors: ['red', 'blue'],
      labels: ['X', 'Y1', 'Y2']
    });
    var htx = g.hidden_ctx_;
    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));
    assert.equal(0, _CanvasAssertions2['default'].numLinesDrawn(htx, '#0000ff'));
  });

  it('testSeparatedPointsDontDraw_expanded', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[0, 10], [1, 11], [2, null], [3, 13], [4, 14]], { colors: ['blue'], labels: ['X', 'Y'] });
    var htx = g.hidden_ctx_;

    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#0000ff'));
    _CanvasAssertions2['default'].assertLineDrawn(htx, [56, 275], [161, 212], { strokeStyle: '#0000ff' });
    _CanvasAssertions2['default'].assertLineDrawn(htx, [370, 87], [475, 25], { strokeStyle: '#0000ff' });
  });

  it('testSeparatedPointsDontDraw_expanded_connected', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[0, 10], [1, 11], [2, null], [3, 13], [4, 14]], {
      colors: ['blue'],
      connectSeparatedPoints: true,
      labels: ['X', 'Y']
    });
    var htx = g.hidden_ctx_;
    var num_lines = 0;

    assert.equal(3, _CanvasAssertions2['default'].numLinesDrawn(htx, '#0000ff'));
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(htx, [[56, 275], [161, 212], [370, 87], [475, 25]], { strokeStyle: '#0000ff' });
  });

  /**
   * At the time of writing this test, the blue series is only points, and not lines.
   */
  it('testConnectSeparatedPoints', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), [[1, null, 3], [2, 2, null], [3, null, 7], [4, 5, null], [5, null, 5], [6, 3, null]], {
      connectSeparatedPoints: true,
      drawPoints: true,
      colors: ['red', 'blue'],
      labels: ['X', 'Y1', 'Y2']
    });

    var htx = g.hidden_ctx_;

    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#0000ff'));
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(htx, [[56, 225], [223, 25], [391, 125]], { strokeStyle: '#0000ff' });

    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(htx, [[140, 275], [307, 125], [475, 225]], { strokeStyle: '#ff0000' });
  });

  /**
   * At the time of writing this test, the blue series is only points, and not lines.
   */
  it('testConnectSeparatedPointsWithNan', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), "x,A,B  \n" + "1,,3   \n" + "2,2,   \n" + "3,,5   \n" + "4,4,   \n" + "5,,7   \n" + "6,NaN, \n" + "8,8,   \n" + "10,10, \n", {
      connectSeparatedPoints: true,
      drawPoints: true,
      colors: ['red', 'blue']
    });

    var htx = g.hidden_ctx_;

    // Red has two disconnected line segments
    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));
    _CanvasAssertions2['default'].assertLineDrawn(htx, [102, 275], [195, 212], { strokeStyle: '#ff0000' });
    _CanvasAssertions2['default'].assertLineDrawn(htx, [381, 87], [475, 25], { strokeStyle: '#ff0000' });

    // Blue's lines are consecutive, however.
    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#0000ff'));
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(htx, [[56, 244], [149, 181], [242, 118]], { strokeStyle: '#0000ff' });
  });

  /* These lines contain awesome powa!
    var lines = CanvasAssertions.getLinesDrawn(htx, {strokeStyle: "#0000ff"});
    for (var idx = 0; idx < lines.length; idx++) {
      var line = lines[idx];
      console.log(line[0].args, line[1].args, line[0].properties.strokeStyle);
    }
  */

  it('testErrorBarsWithMissingPoints', function () {
    var data = [[1, [2, 1]], [2, [3, 1]], [3, null], [4, [5, 1]], [5, [4, 1]], [6, [null, null]]];
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      errorBars: true,
      colors: ['red'],
      labels: ['X', 'Y']
    });

    var htx = g.hidden_ctx_;

    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));

    var p0 = g.toDomCoords(data[0][0], data[0][1][0]);
    var p1 = g.toDomCoords(data[1][0], data[1][1][0]);
    var p2 = g.toDomCoords(data[3][0], data[3][1][0]);
    var p3 = g.toDomCoords(data[4][0], data[4][1][0]);
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(htx, [p0, p1], { strokeStyle: '#ff0000' });
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(htx, [p2, p3], { strokeStyle: '#ff0000' });
  });

  it('testErrorBarsWithMissingPointsConnected', function () {
    var data = [[1, [null, 1]], [2, [2, 1]], [3, null], [4, [5, 1]], [5, [null, null]], [6, [3, 1]]];
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      connectSeparatedPoints: true,
      drawPoints: true,
      errorBars: true,
      colors: ['red'],
      labels: ['X', 'Y']
    });

    var htx = g.hidden_ctx_;

    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));

    var p1 = g.toDomCoords(data[1][0], data[1][1][0]);
    var p2 = g.toDomCoords(data[3][0], data[3][1][0]);
    var p3 = g.toDomCoords(data[5][0], data[5][1][0]);
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(htx, [p1, p2, p3], { strokeStyle: '#ff0000' });
  });
  it('testCustomBarsWithMissingPoints', function () {
    var data = [[1, [1, 2, 3]], [2, [2, 3, 4]], [3, null], [4, [4, 5, 6]], [5, [3, 4, 5]], [6, [null, null, null]], [7, [2, 3, 4]], [8, [1, 2, 3]], [9, NaN], [10, [2, 3, 4]], [11, [3, 4, 5]], [12, [NaN, NaN, NaN]]];
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      customBars: true,
      colors: ['red'],
      labels: ['X', 'Y']
    });

    var htx = g.hidden_ctx_;

    assert.equal(4, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));

    var p0 = g.toDomCoords(data[0][0], data[0][1][1]);
    var p1 = g.toDomCoords(data[1][0], data[1][1][1]);
    _CanvasAssertions2['default'].assertLineDrawn(htx, p0, p1, { strokeStyle: '#ff0000' });

    p0 = g.toDomCoords(data[3][0], data[3][1][1]);
    p1 = g.toDomCoords(data[4][0], data[4][1][1]);
    _CanvasAssertions2['default'].assertLineDrawn(htx, p0, p1, { strokeStyle: '#ff0000' });

    p0 = g.toDomCoords(data[6][0], data[6][1][1]);
    p1 = g.toDomCoords(data[7][0], data[7][1][1]);
    _CanvasAssertions2['default'].assertLineDrawn(htx, p0, p1, { strokeStyle: '#ff0000' });;

    p0 = g.toDomCoords(data[9][0], data[9][1][1]);
    p1 = g.toDomCoords(data[10][0], data[10][1][1]);
    _CanvasAssertions2['default'].assertLineDrawn(htx, p0, p1, { strokeStyle: '#ff0000' });
  });

  it('testCustomBarsWithMissingPointsConnected', function () {
    var data = [[1, [1, null, 1]], [2, [1, 2, 3]], [3, null], [4, [4, 5, 6]], [5, [null, null, null]], [6, [2, 3, 4]]];
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      connectSeparatedPoints: true,
      drawPoints: true,
      customBars: true,
      colors: ['red'],
      labels: ['X', 'Y']
    });

    var htx = g.hidden_ctx_;

    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));

    var p1 = g.toDomCoords(data[1][0], data[1][1][1]);
    var p2 = g.toDomCoords(data[3][0], data[3][1][1]);
    var p3 = g.toDomCoords(data[5][0], data[5][1][1]);
    _CanvasAssertions2['default'].assertConsecutiveLinesDrawn(htx, [p1, p2, p3], { strokeStyle: '#ff0000' });
  });

  it('testLeftBoundaryWithMisingPoints', function () {
    var data = [[1, null, 3], [2, 1, null], [3, 0, 5], [4, 2, 1], [5, 4, null], [6, 3, 2]];
    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      connectSeparatedPoints: true,
      drawPoints: true,
      colors: ['red', 'blue'],
      labels: ['X', 'Y1', 'Y2']
    });
    g.updateOptions({ dateWindow: [2.5, 4.5] });
    assert.equal(1, g.getLeftBoundary_(0));
    assert.equal(0, g.getLeftBoundary_(1));

    var domX = g.toDomXCoord(1.9);
    var closestRow = g.findClosestRow(domX);
    assert.equal(1, closestRow);

    g.setSelection(closestRow);
    assert.equal(1, g.selPoints_.length);
    assert.equal(1, g.selPoints_[0].yval);

    g.setSelection(3);
    assert.equal(2, g.selPoints_.length);
    assert.equal(g.selPoints_[0].xval, g.selPoints_[1].xval);
    assert.equal(2, g.selPoints_[0].yval);
    assert.equal(1, g.selPoints_[1].yval);
  });

  // Regression test for issue #411
  it('testEmptySeries', function () {
    var graphDiv = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graphDiv, "Time,Empty Series,Series 1,Series 2\n" + "1381134460,,0,100\n" + "1381134461,,1,99\n" + "1381134462,,2,98\n" + "1381134463,,3,97\n" + "1381134464,,4,96\n" + "1381134465,,5,95\n" + "1381134466,,6,94\n" + "1381134467,,7,93\n" + "1381134468,,8,92\n" + "1381134469,,9,91\n", {
      visibility: [true, false, true],
      dateWindow: [1381134465, 1381134467]
    });

    g.setSelection(6);
    assert.equal("1381134466: Series 2: 94", _Util2['default'].getLegend(graphDiv));
  });

  // Regression test for issue #485
  it('testMissingFill', function () {
    var graphDiv = document.getElementById("graph");
    var N = null;
    var g = new _srcDygraph2['default'](graphDiv, [[1, [8, 10, 12]], [2, [3, 5, 7]], [3, N], [4, [9, N, 2]], // Note: nulls in arrays are not technically valid.
    [5, [N, 2, N]], // see dygraphs.com/data.html.
    [6, [2, 3, 6]]], {
      customBars: true,
      connectSeparatedPoints: false,
      labels: ["X", "Series1"]
    });

    // Make sure there are no 'NaN' line segments.
    var htx = g.hidden_ctx_;
    for (var i = 0; i < htx.calls__.length; i++) {
      var call = htx.calls__[i];
      if ((call.name == 'moveTo' || call.name == 'lineTo') && call.args) {
        for (var j = 0; j < call.args.length; j++) {
          assert.isFalse(isNaN(call.args[j]));
        }
      }
    }
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./Proxy":4,"./Util":5}],28:[function(require,module,exports){
/** 
 * @fileoverview Test cases for how axis labels are chosen and formatted.
 *
 * @author dan@dygraphs.com (Dan Vanderkam)
 */

"use strict";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

describe("multi-csv", function () {

  cleanupAfterEach();

  function getXLabels() {
    var x_labels = document.getElementsByClassName("dygraph-axis-label-x");
    var ary = [];
    for (var i = 0; i < x_labels.length; i++) {
      ary.push(x_labels[i].innerHTML);
    }
    return ary;
  }

  it('testOneCSV', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, opts);

    assert.deepEqual(['0', '1', '2'], getXLabels());
  });

  it('testTwoCSV', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2["default"](graph, data, opts);

    assert.deepEqual(['0', '1', '2'], getXLabels());

    g.updateOptions({ file: data });

    assert.deepEqual(['0', '1', '2'], getXLabels());
  });
});

},{"../../src/dygraph":139}],29:[function(require,module,exports){
/** 
 * @fileoverview Tests involving multiple y-axes.
 *
 * @author danvdk@gmail.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("multiple-axes-tests", function () {

  cleanupAfterEach();

  var getData = function getData() {
    var data = [];
    for (var i = 1; i <= 100; i++) {
      var m = "01",
          d = i;
      if (d > 31) {
        m = "02";d -= 31;
      }
      if (m == "02" && d > 28) {
        m = "03";d -= 28;
      }
      if (m == "03" && d > 31) {
        m = "04";d -= 31;
      }
      if (d < 10) d = "0" + d;
      // two series, one with range 1-100, one with range 1-2M
      data.push([new Date("2010/" + m + "/" + d), i, 100 - i, 1e6 * (1 + i * (100 - i) / (50 * 50)), 1e6 * (2 - i * (100 - i) / (50 * 50))]);
    }
    return data;
  };

  it('testBasicMultipleAxes', function () {
    var data = getData();

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['Date', 'Y1', 'Y2', 'Y3', 'Y4'],
      width: 640,
      height: 350,
      series: {
        'Y3': {
          axis: 'y2'
        },
        'Y4': {
          axis: 'y2'
        }
      },
      axes: {
        y2: {
          // set axis-related properties here
          labelsKMB: true
        }
      }
    });

    assert.deepEqual(["0", "20", "40", "60", "80", "100"], _Util2['default'].getYLabels("1"));
    assert.deepEqual(["900K", "1.12M", "1.34M", "1.55M", "1.77M", "1.99M"], _Util2['default'].getYLabels("2"));
  });

  it('testTwoAxisVisibility', function () {
    var data = [];
    data.push([0, 0, 0]);
    data.push([1, 2, 2000]);
    data.push([2, 4, 1000]);

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['X', 'bar', 'zot'],
      series: {
        zot: {
          axis: 'y2'
        }
      },
      axes: {
        y2: {
          labelsKMB: true
        }
      }
    });

    assert.isTrue(document.getElementsByClassName("dygraph-axis-label-y").length > 0);
    assert.isTrue(document.getElementsByClassName("dygraph-axis-label-y2").length > 0);

    g.setVisibility(0, false);

    assert.isTrue(document.getElementsByClassName("dygraph-axis-label-y").length > 0);
    assert.isTrue(document.getElementsByClassName("dygraph-axis-label-y2").length > 0);

    g.setVisibility(0, true);
    g.setVisibility(1, false);

    assert.isTrue(document.getElementsByClassName("dygraph-axis-label-y").length > 0);
    assert.isTrue(document.getElementsByClassName("dygraph-axis-label-y2").length > 0);
  });

  // verifies that all four chart labels (title, x-, y-, y2-axis label) can be
  // used simultaneously.
  it('testMultiChartLabels', function () {
    var data = getData();

    var el = document.getElementById("graph");
    el.style.border = '1px solid black';
    el.style.marginLeft = '200px';
    el.style.marginTop = '200px';

    var g = new _srcDygraph2['default'](el, data, {
      labels: ['Date', 'Y1', 'Y2', 'Y3', 'Y4'],
      width: 640,
      height: 350,
      series: {
        'Y3': {
          axis: 'y2'
        },
        'Y4': {
          axis: 'y2'
        }
      },
      xlabel: 'x-axis',
      ylabel: 'y-axis',
      y2label: 'y2-axis',
      title: 'Chart title'
    });

    assert.deepEqual(["Chart title", "x-axis", "y-axis", "y2-axis"], _Util2['default'].getClassTexts("dygraph-label"));
    assert.deepEqual(["Chart title"], _Util2['default'].getClassTexts("dygraph-title"));
    assert.deepEqual(["x-axis"], _Util2['default'].getClassTexts("dygraph-xlabel"));
    assert.deepEqual(["y-axis"], _Util2['default'].getClassTexts("dygraph-ylabel"));
    assert.deepEqual(["y2-axis"], _Util2['default'].getClassTexts("dygraph-y2label"));

    // TODO(danvk): check relative positioning here: title on top, y left of y2.
  });

  // Check that a chart w/o a secondary y-axis will not get a y2label, even if one
  // is specified.
  it('testNoY2LabelWithoutSecondaryAxis', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), getData(), {
      labels: ['Date', 'Y1', 'Y2', 'Y3', 'Y4'],
      width: 640,
      height: 350,
      xlabel: 'x-axis',
      ylabel: 'y-axis',
      y2label: 'y2-axis',
      title: 'Chart title'
    });

    assert.deepEqual(["Chart title", "x-axis", "y-axis"], _Util2['default'].getClassTexts("dygraph-label"));
    assert.deepEqual(["Chart title"], _Util2['default'].getClassTexts("dygraph-title"));
    assert.deepEqual(["x-axis"], _Util2['default'].getClassTexts("dygraph-xlabel"));
    assert.deepEqual(["y-axis"], _Util2['default'].getClassTexts("dygraph-ylabel"));
    assert.deepEqual([], _Util2['default'].getClassTexts("dygraph-y2label"));
  });

  it('testValueRangePerAxisOptions', function () {
    var data = getData();

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['Date', 'Y1', 'Y2', 'Y3', 'Y4'],
      series: {
        'Y3': {
          axis: 'y2'
        },
        'Y4': {
          axis: 'y2'
        }
      },
      axes: {
        y: {
          axisLabelWidth: 60,
          valueRange: [40, 70]
        },
        y2: {
          // set axis-related properties here
          labelsKMB: true
        }
      },
      ylabel: 'Primary y-axis',
      y2label: 'Secondary y-axis'
    });
    assert.deepEqual(["40", "45", "50", "55", "60", "65"], _Util2['default'].getYLabels("1"));
    assert.deepEqual(["900K", "1.1M", "1.3M", "1.5M", "1.7M", "1.9M"], _Util2['default'].getYLabels("2"));

    g.updateOptions({
      axes: {
        y: {
          valueRange: [40, 80]
        },
        y2: {
          valueRange: [1e6, 1.2e6]
        }
      }
    });
    assert.deepEqual(["40", "45", "50", "55", "60", "65", "70", "75"], _Util2['default'].getYLabels("1"));
    assert.deepEqual(["1M", "1.02M", "1.05M", "1.08M", "1.1M", "1.13M", "1.15M", "1.18M"], _Util2['default'].getYLabels("2"));
  });

  it('testDrawPointCallback', function () {
    var data = getData();

    var results = { y: {}, y2: {} };
    var firstCallback = function firstCallback(g, seriesName, ctx, canvasx, canvasy, color, radius) {
      results.y[seriesName] = 1;
      utils.Circles.DEFAULT(g, seriesName, ctx, canvasx, canvasy, color, radius);
    };
    var secondCallback = function secondCallback(g, seriesName, ctx, canvasx, canvasy, color, radius) {
      results.y2[seriesName] = 1;
      utils.Circles.DEFAULT(g, seriesName, ctx, canvasx, canvasy, color, radius);
    };

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['Date', 'Y1', 'Y2', 'Y3', 'Y4'],
      drawPoints: true,
      pointSize: 3,
      series: {
        'Y3': {
          axis: 'y2'
        },
        'Y4': {
          axis: 'y2'
        }
      },
      axes: {
        y2: {
          drawPointCallback: secondCallback
        }
      },
      drawPointCallback: firstCallback
    });

    assert.equal(1, results.y["Y1"]);
    assert.equal(1, results.y["Y2"]);
    assert.equal(1, results.y2["Y3"]);
    assert.equal(1, results.y2["Y4"]);
  });

  // Test for http://code.google.com/p/dygraphs/issues/detail?id=436
  it('testRemovingSecondAxis', function () {
    var data = getData();

    var results = { y: {}, y2: {} };

    var g = new _srcDygraph2['default'](document.getElementById("graph"), data, {
      labels: ['Date', 'Y1', 'Y2', 'Y3', 'Y4'],
      drawPoints: true,
      pointSize: 3,
      series: {
        'Y4': {
          axis: 'y2'
        }
      }
    });

    g.updateOptions({ series: { Y4: { axis: 'y' } } });
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./Util":5}],30:[function(require,module,exports){
/**
 * @fileoverview Tests that we don'show specify hours, minutes or seconds
 * in your dates if you don't specify them. This can get mixed up becaues of
 * time zones.
 *
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("no-hours", function () {

  cleanupAfterEach();

  it('testNoHours', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "Date,Y\n" + "2012/03/13,-1\n" + "2012/03/14,0\n" + "2012/03/15,1\n" + "2012/03/16,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    g.setSelection(0);
    assert.equal("2012/03/13: Y: -1", _Util2['default'].getLegend());

    g.setSelection(1);
    assert.equal("2012/03/14: Y: 0", _Util2['default'].getLegend());

    g.setSelection(2);
    assert.equal("2012/03/15: Y: 1", _Util2['default'].getLegend());

    g.setSelection(3);
    assert.equal("2012/03/16: Y: 0", _Util2['default'].getLegend());
  });

  it('testNoHoursDashed', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "Date,Y\n" + "2012-03-13,-1\n" + "2012-03-14,0\n" + "2012-03-15,1\n" + "2012-03-16,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    g.setSelection(0);
    assert.equal("2012/03/13: Y: -1", _Util2['default'].getLegend());

    g.setSelection(1);
    assert.equal("2012/03/14: Y: 0", _Util2['default'].getLegend());

    g.setSelection(2);
    assert.equal("2012/03/15: Y: 1", _Util2['default'].getLegend());

    g.setSelection(3);
    assert.equal("2012/03/16: Y: 0", _Util2['default'].getLegend());
  });
});

},{"../../src/dygraph":139,"./Util":5}],31:[function(require,module,exports){
/**
 * @fileoverview Test cases for the numeric tick-generating functions.
 * These were generated by adding logging code to the old ticker functions. The
 * tests serve to track existing behavior should it change in the future.
 *
 * @author danvdk@gmail.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphTickers = require('../../src/dygraph-tickers');

var DygraphTickers = _interopRequireWildcard(_srcDygraphTickers);

var _srcDygraphDefaultAttrs = require('../../src/dygraph-default-attrs');

var _srcDygraphDefaultAttrs2 = _interopRequireDefault(_srcDygraphDefaultAttrs);

describe("numeric-ticker-tests", function () {

  cleanupAfterEach();

  var createOptionsViewForAxis = function createOptionsViewForAxis(axis, dict) {
    return function (x) {
      if (dict && dict.hasOwnProperty(x)) {
        return dict[x];
      }
      if (_srcDygraphDefaultAttrs2['default'].axes[axis].hasOwnProperty(x)) {
        return _srcDygraphDefaultAttrs2['default'].axes[axis][x];
      }
      if (_srcDygraphDefaultAttrs2['default'].hasOwnProperty(x)) {
        return _srcDygraphDefaultAttrs2['default'][x];
      }
      if (x == 'axisLabelFormatter') return null;
      throw "mysterious " + axis + "-axis option: " + x;
    };
  };

  it('testBasicNumericTicker', function () {
    var opts = { "logscale": null, "labelsKMG2": false, "labelsKMB": false };
    var options = createOptionsViewForAxis('y', opts);

    var ticks = DygraphTickers.numericTicks(-0.4, 4.4, 320, options);
    var expected_ticks = [{ "v": -0.5, "label": "-0.5" }, { "v": 0, "label": "0" }, { "v": 0.5, "label": "0.5" }, { "v": 1, "label": "1" }, { "v": 1.5, "label": "1.5" }, { "v": 2, "label": "2" }, { "v": 2.5, "label": "2.5" }, { "v": 3, "label": "3" }, { "v": 3.5, "label": "3.5" }, { "v": 4, "label": "4" }, { "v": 4.5, "label": "4.5" }];
    assert.deepEqual(expected_ticks, ticks);

    ticks = DygraphTickers.numericTicks(1, 84, 540, options);
    var expected_ticks = [{ "v": 0, "label": "0" }, { "v": 5, "label": "5" }, { "v": 10, "label": "10" }, { "v": 15, "label": "15" }, { "v": 20, "label": "20" }, { "v": 25, "label": "25" }, { "v": 30, "label": "30" }, { "v": 35, "label": "35" }, { "v": 40, "label": "40" }, { "v": 45, "label": "45" }, { "v": 50, "label": "50" }, { "v": 55, "label": "55" }, { "v": 60, "label": "60" }, { "v": 65, "label": "65" }, { "v": 70, "label": "70" }, { "v": 75, "label": "75" }, { "v": 80, "label": "80" }, { "v": 85, "label": "85" }];
    assert.deepEqual(expected_ticks, ticks);
  });

  /*
  it('testAllNumericTickers', function() {
    assert.deepEqual([{"v":-0.5,"label":"-0.5"},{"v":0,"label":"0"},{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"}], Dygraph.numericTicks(-0.4, 4.4, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-1.5,"label":"-1.5"},{"v":-1,"label":"-1"},{"v":-0.5,"label":"-0.5"},{"v":0,"label":"0"},{"v":0.5,"label":"0.5"},{"v":1,"label":"1"}], Dygraph.numericTicks(-1.4157430939856124, 1.4157430939856124, 400, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-10,"label":"-10"},{"v":-8,"label":"-8"},{"v":-6,"label":"-6"},{"v":-4,"label":"-4"},{"v":-2,"label":"-2"},{"v":0,"label":"0"},{"v":2,"label":"2"},{"v":4,"label":"4"},{"v":6,"label":"6"},{"v":8,"label":"8"}], Dygraph.numericTicks(-10, 9.98046875, 400, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-200,"label":"-200"},{"v":0,"label":"0"},{"v":200,"label":"200"},{"v":400,"label":"400"},{"v":600,"label":"600"},{"v":800,"label":"800"},{"v":-17999000,"label":"1000"}], Dygraph.numericTicks(-101.10000000000001, 1100.1, 300, createOptionsViewForAxis('y',{"logscale":false,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-20,"label":"-20"},{"v":-10,"label":"-10"},{"v":0,"label":"0"},{"v":10,"label":"10"},{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"}], Dygraph.numericTicks(-11.687459005175139, 42.287459005175144, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-15,"label":"-15"},{"v":-10,"label":"-10"},{"v":-5,"label":"-5"},{"v":0,"label":"0"},{"v":5,"label":"5"},{"v":10,"label":"10"}], Dygraph.numericTicks(-12, 12, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-15,"label":"-15"},{"v":-10,"label":"-10"},{"v":-5,"label":"-5"},{"v":0,"label":"0"},{"v":5,"label":"5"},{"v":10,"label":"10"}], Dygraph.numericTicks(-13.19792086872138, 13.197062407353386, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-220,"label":"-220"},{"v":-200,"label":"-200"},{"v":-180,"label":"-180"},{"v":-160,"label":"-160"},{"v":-140,"label":"-140"},{"v":-120,"label":"-120"}], Dygraph.numericTicks(-220, -100, 200, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-40,"label":"-40"},{"v":-20,"label":"-20"},{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"},{"v":120,"label":"120"}], Dygraph.numericTicks(-32.8, 132.8, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-40,"label":"-40"},{"v":-30,"label":"-30"},{"v":-20,"label":"-20"},{"v":-10,"label":"-10"},{"v":0,"label":"0"},{"v":10,"label":"10"},{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"}], Dygraph.numericTicks(-34.309, 89.279, 400, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-60,"label":"-60"},{"v":-40,"label":"-40"},{"v":-20,"label":"-20"},{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"}], Dygraph.numericTicks(-60, 60, 200, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":-60,"label":"-60"},{"v":-40,"label":"-40"},{"v":-20,"label":"-20"},{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"}], Dygraph.numericTicks(-60, 60, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.0001,"label":"1.00e-4"},{"v":0.0002,"label":"2.00e-4"},{"v":-17999999,"label":"3.00e-4"},{"v":0.0004,"label":"4.00e-4"},{"v":0.0005,"label":"5.00e-4"}], Dygraph.numericTicks(0, 0.00055, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":0},{"v":0.0001,"label":0.0001},{"v":0.0002,"label":0.0002},{"v":-17999999,"label":0.0003},{"v":0.0004,"label":0.0004},{"v":0.0005,"label":0.0005}], Dygraph.numericTicks(0, 0.00055, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.2,"label":"0.2"},{"v":0.4,"label":"0.4"},{"v":-17999999,"label":"0.6"},{"v":0.8,"label":"0.8"}], Dygraph.numericTicks(0, 1, 200, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.2,"label":"0.2"},{"v":0.4,"label":"0.4"},{"v":-17999999,"label":"0.6"},{"v":0.8,"label":"0.8"}], Dygraph.numericTicks(0, 1, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.1,"label":"0.1"},{"v":0.2,"label":"0.2"},{"v":-17999999,"label":"0.3"},{"v":0.4,"label":"0.4"},{"v":0.5,"label":"0.5"},{"v":-17999999,"label":"0.6"},{"v":-17999999,"label":"0.7"},{"v":0.8,"label":"0.8"},{"v":0.9,"label":"0.9"},{"v":1,"label":"1"},{"v":1.1,"label":"1.1"},{"v":-17999998,"label":"1.2"}], Dygraph.numericTicks(0, 1.2, 400, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":10,"label":"10"},{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"}], Dygraph.numericTicks(0, 100, 400, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"}], Dygraph.numericTicks(0, 104.53192180924043, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"}], Dygraph.numericTicks(0, 109.9856877755916, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":2,"label":"2"},{"v":4,"label":"4"},{"v":6,"label":"6"},{"v":8,"label":"8"},{"v":10,"label":"10"}], Dygraph.numericTicks(0, 11, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"}], Dygraph.numericTicks(0, 110, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"}], Dygraph.numericTicks(0, 110, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":10,"label":"10"},{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"},{"v":100,"label":"100"}], Dygraph.numericTicks(0, 110, 350, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":200,"label":"200"},{"v":400,"label":"400"},{"v":600,"label":"600"},{"v":800,"label":"800"},{"v":-17999000,"label":"1000"}], Dygraph.numericTicks(0, 1100, 300, createOptionsViewForAxis('y',{"logscale":false,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":-17000000,"label":"1M"},{"v":-16000000,"label":"2M"},{"v":-15000000,"label":"3M"},{"v":-14000000,"label":"4M"},{"v":-13000000,"label":"5M"},{"v":-12000000,"label":"6M"},{"v":-11000000,"label":"7M"},{"v":-10000000,"label":"8M"},{"v":-9000000,"label":"9M"},{"v":-8000000,"label":"10M"}], Dygraph.numericTicks(0, 11000000, 480, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":true})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"}], Dygraph.numericTicks(0, 119, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"},{"v":120,"label":"120"}], Dygraph.numericTicks(0, 130.9, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"},{"v":120,"label":"120"}], Dygraph.numericTicks(0, 131, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":-17998000,"label":"2000"},{"v":-17996000,"label":"4000"},{"v":-17994000,"label":"6000"},{"v":-17992000,"label":"8000"},{"v":-17990000,"label":"10000"},{"v":-17988000,"label":"12000"},{"v":-17986000,"label":"14000"},{"v":-17984000,"label":"16000"}], Dygraph.numericTicks(0, 16977.4, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"}], Dygraph.numericTicks(0, 2, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.2,"label":"0.2"},{"v":0.4,"label":"0.4"},{"v":-17999999,"label":"0.6"},{"v":0.8,"label":"0.8"},{"v":1,"label":"1"},{"v":-17999998,"label":"1.2"},{"v":-17999998,"label":"1.4"},{"v":1.6,"label":"1.6"},{"v":1.8,"label":"1.8"}], Dygraph.numericTicks(0, 2, 400, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"}], Dygraph.numericTicks(0, 2.2, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":-17800000,"label":"200K"},{"v":-17600000,"label":"400K"},{"v":-17400000,"label":"600K"},{"v":-17200000,"label":"800K"},{"v":-17000000,"label":"1M"},{"v":-16800000,"label":"1.2M"},{"v":-16600000,"label":"1.4M"},{"v":-16400000,"label":"1.6M"},{"v":-16200000,"label":"1.8M"},{"v":-16000000,"label":"2M"}], Dygraph.numericTicks(0, 2200000, 350, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":true})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":50,"label":"50"},{"v":100,"label":"100"},{"v":150,"label":"150"},{"v":200,"label":"200"}], Dygraph.numericTicks(0, 249, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":500,"label":"500"},{"v":-17999000,"label":"1000"},{"v":1500,"label":"1500"},{"v":-17998000,"label":"2000"},{"v":2500,"label":"2500"}], Dygraph.numericTicks(0, 2747.9970998900817, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":200,"label":"200"},{"v":400,"label":"400"},{"v":600,"label":"600"},{"v":800,"label":"800"},{"v":-17999000,"label":"1K"},{"v":1200,"label":"1.2K"},{"v":1400,"label":"1.4K"},{"v":1600,"label":"1.6K"},{"v":1800,"label":"1.8K"},{"v":-17998000,"label":"2K"},{"v":2200,"label":"2.2K"},{"v":2400,"label":"2.4K"},{"v":2600,"label":"2.6K"}], Dygraph.numericTicks(0, 2747.9970998900817, 480, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":true})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":5,"label":"5"},{"v":10,"label":"10"},{"v":15,"label":"15"},{"v":20,"label":"20"},{"v":25,"label":"25"},{"v":30,"label":"30"}], Dygraph.numericTicks(0, 32.698942321287205, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":-17500000,"label":"500000"},{"v":-17000000,"label":"1.00e+6"},{"v":-16500000,"label":"1.50e+6"},{"v":-16000000,"label":"2.00e+6"},{"v":-15500000,"label":"2.50e+6"},{"v":-15000000,"label":"3.00e+6"}], Dygraph.numericTicks(0, 3263100.6418021005, 480, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":5,"label":"5"},{"v":10,"label":"10"},{"v":15,"label":"15"},{"v":20,"label":"20"},{"v":25,"label":"25"},{"v":30,"label":"30"}], Dygraph.numericTicks(0, 33.16213467701236, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"}], Dygraph.numericTicks(0, 4, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"}], Dygraph.numericTicks(0, 4.4, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":5,"label":"5"},{"v":10,"label":"10"},{"v":15,"label":"15"},{"v":20,"label":"20"},{"v":25,"label":"25"},{"v":30,"label":"30"},{"v":35,"label":"35"},{"v":40,"label":"40"}], Dygraph.numericTicks(0, 42, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":true})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":8,"label":"8"},{"v":16,"label":"16"},{"v":24,"label":"24"},{"v":32,"label":"32"},{"v":40,"label":"40"}], Dygraph.numericTicks(0, 42, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":true,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":0},{"v":8,"label":8},{"v":16,"label":16},{"v":24,"label":24},{"v":32,"label":32},{"v":40,"label":40}], Dygraph.numericTicks(0, 42, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":true,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":999982000000,"label":"1T"},{"v":1999982000000,"label":"2T"},{"v":2999982000000,"label":"3T"},{"v":3999982000000,"label":"4T"}], Dygraph.numericTicks(0, 4837851162214.3, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":true})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":549755813888,"label":"512G"},{"v":1099511627776,"label":"1T"},{"v":1649267441664,"label":"1.5T"},{"v":2199023255552,"label":"2T"},{"v":2748779069440,"label":"2.5T"},{"v":3298534883328,"label":"3T"},{"v":3848290697216,"label":"3.5T"},{"v":4398046511104,"label":"4T"}], Dygraph.numericTicks(0, 4837851162214.3, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":true,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":0},{"v":549755813888,"label":"512G"},{"v":1099511627776,"label":"1T"},{"v":1649267441664,"label":"1.5T"},{"v":2199023255552,"label":"2T"},{"v":2748779069440,"label":"2.5T"},{"v":3298534883328,"label":"3T"},{"v":3848290697216,"label":"3.5T"},{"v":4398046511104,"label":"4T"}], Dygraph.numericTicks(0, 4837851162214.3, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":true,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":-17999000,"label":"1000"},{"v":-17998000,"label":"2000"},{"v":-17997000,"label":"3000"},{"v":-17996000,"label":"4000"},{"v":-17995000,"label":"5000"}], Dygraph.numericTicks(0, 5451.6, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":100,"label":"100"},{"v":200,"label":"200"},{"v":300,"label":"300"},{"v":400,"label":"400"},{"v":500,"label":"500"}], Dygraph.numericTicks(0, 550, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":10,"label":"10"},{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"}], Dygraph.numericTicks(0, 64.9, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":100,"label":"100"},{"v":200,"label":"200"},{"v":300,"label":"300"},{"v":400,"label":"400"},{"v":500,"label":"500"},{"v":600,"label":"600"}], Dygraph.numericTicks(0, 667.9, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"},{"v":6,"label":"6"},{"v":7,"label":"7"}], Dygraph.numericTicks(0, 7.7, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"},{"v":6,"label":"6"},{"v":7,"label":"7"}], Dygraph.numericTicks(0, 7.9347329768293005, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":10,"label":"10"},{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"}], Dygraph.numericTicks(0, 72.6, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"}], Dygraph.numericTicks(0, 99, 200, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"}], Dygraph.numericTicks(0, 99, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":10,"label":"10"},{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"}], Dygraph.numericTicks(0, 99, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":200,"label":"200"},{"v":400,"label":"400"},{"v":600,"label":"600"},{"v":800,"label":"800"}], Dygraph.numericTicks(0, 999, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0.000001,"label":"1.00e-6"},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":"1.00e-5"},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":0.0001,"label":"1.00e-4"},{"v":0.0002,"label":""},{"v":-17999999,"label":""},{"v":0.0004,"label":""},{"v":0.0005,"label":""},{"v":-17999999,"label":""},{"v":0.0007,"label":""},{"v":0.0008,"label":""},{"v":-17999999,"label":""},{"v":0.001,"label":"1.00e-3"},{"v":0.002,"label":""},{"v":0.003,"label":""},{"v":0.004,"label":""},{"v":0.005,"label":""},{"v":0.006,"label":""},{"v":0.007,"label":""},{"v":0.008,"label":""},{"v":-17999999,"label":""},{"v":0.01,"label":"0.01"},{"v":0.02,"label":""},{"v":0.03,"label":""},{"v":0.04,"label":""},{"v":0.05,"label":""},{"v":0.06,"label":""},{"v":0.07,"label":""},{"v":0.08,"label":""},{"v":0.09,"label":""},{"v":0.1,"label":"0.1"},{"v":0.2,"label":""},{"v":-17999999,"label":""},{"v":0.4,"label":""},{"v":0.5,"label":""},{"v":-17999999,"label":""},{"v":-17999999,"label":""},{"v":0.8,"label":""},{"v":0.9,"label":""},{"v":1,"label":"1"},{"v":2,"label":""},{"v":3,"label":""},{"v":4,"label":""},{"v":5,"label":""},{"v":6,"label":""},{"v":7,"label":""},{"v":8,"label":""},{"v":9,"label":""},{"v":10,"label":"10"},{"v":20,"label":""},{"v":30,"label":""},{"v":40,"label":""},{"v":50,"label":""},{"v":60,"label":""},{"v":70,"label":""},{"v":80,"label":""},{"v":90,"label":""},{"v":100,"label":"100"},{"v":200,"label":""},{"v":300,"label":""},{"v":400,"label":""},{"v":500,"label":""},{"v":600,"label":""},{"v":700,"label":""},{"v":800,"label":""},{"v":900,"label":""},{"v":-17999000,"label":"1000"}], Dygraph.numericTicks(0.000001, 1099.9999999, 300, createOptionsViewForAxis('y',{"logscale":true,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"}], Dygraph.numericTicks(0.6, 5.4, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"},{"v":4.5,"label":"4.5"}], Dygraph.numericTicks(0.6373123361267239, 4.824406504982038, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"},{"v":4.5,"label":"4.5"}], Dygraph.numericTicks(0.6373123361267239, 4.824406504982038, 353, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0.6000000000000001,"label":"0.6"},{"v":0.8,"label":"0.8"},{"v":1,"label":"1"},{"v":-17999998,"label":"1.2"},{"v":-17999998,"label":"1.4"},{"v":1.6,"label":"1.6"},{"v":-17999998,"label":"1.8"},{"v":2,"label":"2"},{"v":2.2,"label":"2.2"},{"v":-17999997,"label":"2.4"},{"v":2.6,"label":"2.6"},{"v":-17999997,"label":"2.8"},{"v":-17999997,"label":"3"},{"v":3.2,"label":"3.2"},{"v":-17999996,"label":"3.4"},{"v":3.6,"label":"3.6"},{"v":-17999996,"label":"3.8"},{"v":4,"label":"4"},{"v":4.2,"label":"4.2"},{"v":4.4,"label":"4.4"},{"v":4.6,"label":"4.6"},{"v":-17999995,"label":"4.8"}], Dygraph.numericTicks(0.6373123361267239, 4.824406504982038, 743, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"},{"v":4.5,"label":"4.5"}], Dygraph.numericTicks(0.6386658954698001, 4.8095173522082, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0.5,"label":"0.5"},{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"}], Dygraph.numericTicks(0.7101014279158788, 4.023726495301334, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":20,"label":"20"},{"v":40,"label":"40"},{"v":60,"label":"60"},{"v":80,"label":"80"},{"v":100,"label":"100"}], Dygraph.numericTicks(1, 109, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"}], Dygraph.numericTicks(1, 3, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"}], Dygraph.numericTicks(1, 4, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"}], Dygraph.numericTicks(1, 4, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"},{"v":4.5,"label":"4.5"}], Dygraph.numericTicks(1, 5, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":1},{"v":1.5,"label":1.5},{"v":2,"label":2},{"v":2.5,"label":2.5},{"v":3,"label":3},{"v":3.5,"label":3.5},{"v":4,"label":4},{"v":4.5,"label":4.5}], Dygraph.numericTicks(1, 5, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"}], Dygraph.numericTicks(1, 6, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"},{"v":6,"label":"6"}], Dygraph.numericTicks(1, 7, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"},{"v":6,"label":"6"},{"v":7,"label":"7"},{"v":8,"label":"8"}], Dygraph.numericTicks(1, 9, 300, createOptionsViewForAxis('y',{"logscale":false,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"},{"v":6,"label":""},{"v":7,"label":"7"},{"v":8,"label":""},{"v":9,"label":"9"}], Dygraph.numericTicks(1, 9, 300, createOptionsViewForAxis('y',{"logscale":true,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"},{"v":6,"label":"6"},{"v":7,"label":"7"},{"v":8,"label":"8"}], Dygraph.numericTicks(1, 9, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":2,"label":"2"},{"v":4,"label":"4"},{"v":6,"label":"6"},{"v":8,"label":"8"},{"v":10,"label":"10"}], Dygraph.numericTicks(1.2, 10.8, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":1.5,"label":"1.5"},{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"},{"v":4.5,"label":"4.5"}], Dygraph.numericTicks(1.2872947778969237, 4.765317192093838, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":1,"label":"1"},{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"},{"v":6,"label":"6"},{"v":7,"label":"7"}], Dygraph.numericTicks(1.5, 7.5, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":5,"label":"5"},{"v":10,"label":"10"},{"v":15,"label":"15"},{"v":20,"label":"20"},{"v":25,"label":"25"}], Dygraph.numericTicks(1.7999999999999998, 28.2, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":10,"label":"10"},{"v":10.1,"label":"10.1"},{"v":10.2,"label":"10.2"},{"v":10.3,"label":"10.3"},{"v":10.4,"label":"10.4"},{"v":10.5,"label":"10.5"},{"v":10.6,"label":"10.6"},{"v":10.7,"label":"10.7"},{"v":10.8,"label":"10.8"},{"v":10.9,"label":"10.9"}], Dygraph.numericTicks(10, 11, 480, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":100,"label":"100"},{"v":120,"label":"120"},{"v":140,"label":"140"},{"v":160,"label":"160"},{"v":180,"label":"180"}], Dygraph.numericTicks(100, 200, 200, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":10000,"label":"10000"},{"v":-17988000,"label":"12000"},{"v":-17986000,"label":"14000"},{"v":-17984000,"label":"16000"},{"v":-17982000,"label":"18000"},{"v":-17980000,"label":"20000"},{"v":-17978000,"label":"22000"},{"v":-17976000,"label":"24000"},{"v":-17974000,"label":"26000"},{"v":-17972000,"label":"28000"},{"v":-17970000,"label":"30000"},{"v":-17968000,"label":"32000"},{"v":-17966000,"label":"34000"},{"v":-17964000,"label":"36000"}], Dygraph.numericTicks(10122.8, 36789.2, 480, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":11000,"label":"11000"},{"v":11200,"label":"11200"},{"v":11400,"label":"11400"},{"v":11600,"label":"11600"},{"v":11800,"label":"11800"},{"v":-17988000,"label":"12000"},{"v":12200,"label":"12200"},{"v":12400,"label":"12400"},{"v":12600,"label":"12600"},{"v":12800,"label":"12800"},{"v":-17987000,"label":"13000"},{"v":13200,"label":"13200"},{"v":13400,"label":"13400"}], Dygraph.numericTicks(11110.5, 13579.5, 480, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":162000,"label":"162000"},{"v":-17836000,"label":"164000"},{"v":-17834000,"label":"166000"},{"v":-17832000,"label":"168000"},{"v":-17830000,"label":"170000"},{"v":-17828000,"label":"172000"},{"v":-17826000,"label":"174000"},{"v":-17824000,"label":"176000"},{"v":-17822000,"label":"178000"}], Dygraph.numericTicks(163038.4, 179137.6, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":2,"label":"2"},{"v":2.5,"label":"2.5"},{"v":3,"label":"3"},{"v":3.5,"label":"3.5"}], Dygraph.numericTicks(2, 4, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":2,"label":"2"},{"v":3,"label":"3"},{"v":4,"label":"4"},{"v":5,"label":"5"},{"v":6,"label":"6"},{"v":7,"label":"7"}], Dygraph.numericTicks(2.6, 7.4, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"}], Dygraph.numericTicks(21.7, 97.3, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"}], Dygraph.numericTicks(21.7, 97.3, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"}], Dygraph.numericTicks(24, 96, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"}], Dygraph.numericTicks(26.185714285714287, 90.81428571428572, 20, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"}], Dygraph.numericTicks(26.185714285714287, 90.81428571428572, 200, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false,pixelsPerLabel:20})));
    assert.deepEqual([{"v":25,"label":"25"},{"v":30,"label":"30"},{"v":35,"label":"35"},{"v":40,"label":"40"},{"v":45,"label":"45"},{"v":50,"label":"50"},{"v":55,"label":"55"},{"v":60,"label":"60"},{"v":65,"label":"65"},{"v":70,"label":"70"},{"v":75,"label":"75"},{"v":80,"label":"80"},{"v":85,"label":"85"},{"v":90,"label":"90"}], Dygraph.numericTicks(26.185714285714287, 90.81428571428572, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false,pixelsPerLabel:20})));
    assert.deepEqual([{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"}], Dygraph.numericTicks(26.185714285714287, 90.81428571428572, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":20,"label":"20"},{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"}], Dygraph.numericTicks(28.33333333333333, 88.33333333333334, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":3,"label":"3"},{"v":3.5,"label":"3.5"},{"v":4,"label":"4"},{"v":4.5,"label":"4.5"}], Dygraph.numericTicks(3, 5, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":3000,"label":"3K"},{"v":2500,"label":"2.5K"},{"v":-17998000,"label":"2K"},{"v":1500,"label":"1.5K"},{"v":-17999000,"label":"1K"},{"v":500,"label":"500"}], Dygraph.numericTicks(3000, 0, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":true})));
    assert.deepEqual([{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"}], Dygraph.numericTicks(33.11333333333334, 83.75333333333333, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":30,"label":"30"},{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"}], Dygraph.numericTicks(36.921241050119335, 88.32696897374701, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":50,"label":""},{"v":60,"label":"60"},{"v":70,"label":""},{"v":80,"label":""},{"v":90,"label":""},{"v":100,"label":"100"},{"v":200,"label":""},{"v":300,"label":"300"},{"v":400,"label":""},{"v":500,"label":""},{"v":600,"label":"600"},{"v":700,"label":""},{"v":800,"label":""},{"v":900,"label":""},{"v":-17999000,"label":"1000"},{"v":-17998000,"label":""},{"v":-17997000,"label":"3000"},{"v":-17996000,"label":""},{"v":-17995000,"label":""},{"v":-17994000,"label":"6000"},{"v":-17993000,"label":""},{"v":-17992000,"label":""},{"v":-17991000,"label":""},{"v":-17990000,"label":"10000"}], Dygraph.numericTicks(41.220000000000084, 15576.828000000018, 400, createOptionsViewForAxis('y',{"logscale":true,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":40,"label":"40"},{"v":50,"label":"50"},{"v":60,"label":"60"},{"v":70,"label":"70"},{"v":80,"label":"80"},{"v":90,"label":"90"}], Dygraph.numericTicks(44.5, 98.5, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":5,"label":"5"},{"v":6,"label":""},{"v":7,"label":""},{"v":8,"label":""},{"v":9,"label":""},{"v":10,"label":"10"},{"v":20,"label":"20"},{"v":30,"label":""},{"v":40,"label":""},{"v":50,"label":"50"},{"v":60,"label":""},{"v":70,"label":""},{"v":80,"label":""},{"v":90,"label":""},{"v":100,"label":"100"},{"v":200,"label":"200"},{"v":300,"label":""},{"v":400,"label":""},{"v":500,"label":"500"},{"v":600,"label":""},{"v":700,"label":""},{"v":800,"label":""},{"v":900,"label":""},{"v":-17999000,"label":"1000"}], Dygraph.numericTicks(5, 1099.5, 300, createOptionsViewForAxis('y',{"logscale":true,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":50,"label":"50"},{"v":55,"label":"55"},{"v":60,"label":"60"},{"v":65,"label":"65"},{"v":70,"label":"70"},{"v":75,"label":"75"},{"v":80,"label":"80"}], Dygraph.numericTicks(52.5, 82.5, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":68,"label":"68"},{"v":70,"label":"70"},{"v":72,"label":"72"},{"v":74,"label":"74"},{"v":76,"label":"76"},{"v":78,"label":"78"},{"v":80,"label":"80"}], Dygraph.numericTicks(69, 81, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":0,"label":"0"},{"v":-17980000,"label":"20K"},{"v":-17960000,"label":"40K"},{"v":-17940000,"label":"60K"},{"v":-17920000,"label":"80K"}], Dygraph.numericTicks(7921.099999999999, 81407.9, 240, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":true})));
    assert.deepEqual([{"v":8,"label":"8"},{"v":10,"label":"10"},{"v":12,"label":"12"},{"v":14,"label":"14"},{"v":16,"label":"16"},{"v":18,"label":"18"},{"v":20,"label":"20"}], Dygraph.numericTicks(9, 21, 300, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":8,"label":"8"},{"v":10,"label":"10"},{"v":12,"label":"12"},{"v":14,"label":"14"},{"v":16,"label":"16"},{"v":18,"label":"18"},{"v":20,"label":"20"}], Dygraph.numericTicks(9, 21, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":9,"label":"9"},{"v":10,"label":"10"},{"v":11,"label":"11"},{"v":12,"label":"12"},{"v":13,"label":"13"},{"v":14,"label":"14"},{"v":15,"label":"15"},{"v":16,"label":"16"},{"v":17,"label":"17"},{"v":18,"label":"18"}], Dygraph.numericTicks(9.2, 18.8, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":80,"label":"80"},{"v":100,"label":"100"},{"v":120,"label":"120"},{"v":140,"label":"140"},{"v":160,"label":"160"},{"v":180,"label":"180"},{"v":200,"label":"200"}], Dygraph.numericTicks(90, 210, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":true})));
    assert.deepEqual([{"v":95,"label":"95"},{"v":96,"label":"96"},{"v":97,"label":"97"},{"v":98,"label":"98"},{"v":99,"label":"99"},{"v":100,"label":"100"},{"v":101,"label":"101"},{"v":102,"label":"102"},{"v":103,"label":"103"},{"v":104,"label":"104"}], Dygraph.numericTicks(95.71121718377088, 104.23150357995226, 320, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
    assert.deepEqual([{"v":950,"label":"950"},{"v":-17999000,"label":"1000"},{"v":1050,"label":"1050"},{"v":1100,"label":"1100"},{"v":1150,"label":"1150"},{"v":1200,"label":"1200"}], Dygraph.numericTicks(980.1, 1218.9, 200, createOptionsViewForAxis('y',{"logscale":null,"labelsKMG2":false,"labelsKMB":false})));
  });
  */
});

},{"../../src/dygraph":139,"../../src/dygraph-default-attrs":131,"../../src/dygraph-tickers":137}],32:[function(require,module,exports){
/**
 * @fileoverview Tests the way that dygraphs parses data.
 *
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

describe("parser", function () {

    cleanupAfterEach();

    it('testDetectLineDelimiter', function () {
        var data = "X,Y\r" + "0,-1\r" + "1,0\r" + "2,1\r" + "3,0\r";
        assert.equal("\r", utils.detectLineDelimiter(data));

        data = "X,Y\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";
        assert.equal("\n", utils.detectLineDelimiter(data));

        data = "X,Y\n\r" + "0,-1\n\r" + "1,0\n\r" + "2,1\n\r" + "3,0\n\r";
        assert.equal("\n\r", utils.detectLineDelimiter(data));
    });

    it('testParseDosNewlines', function () {
        var opts = {
            width: 480,
            height: 320
        };
        var data = "X,Y\r" + "0,-1\r" + "1,0\r" + "2,1\r" + "3,0\r";

        var g = new _srcDygraph2['default']('graph', data, opts);
        assert.equal(0, g.getValue(0, 0));
        assert.equal(-1, g.getValue(0, 1));
        assert.equal(1, g.getValue(1, 0));
        assert.equal(0, g.getValue(1, 1));
        assert.deepEqual(['X', 'Y'], g.getLabels());
    });

    it('should parse tab-delimited data', function () {
        var data = "X\tY\n" + "0\t-1\n" + "1\t0\n" + "2\t1\n" + "3\t0\n";

        var g = new _srcDygraph2['default']('graph', data);
        assert.equal(0, g.getValue(0, 0));
        assert.equal(-1, g.getValue(0, 1));
        assert.equal(1, g.getValue(1, 0));
        assert.equal(0, g.getValue(1, 1));
        assert.deepEqual(['X', 'Y'], g.getLabels());
    });

    it('should parse fractions', function () {
        var data = "X,Y\n" + "0,1/4\n" + "1,2/4\n" + "2,3/4\n" + "3,4/4\n";
        var g = new _srcDygraph2['default']('graph', data, { fractions: true });

        assert.equal(0, g.getValue(0, 0));
        assert.deepEqual([1, 4], g.getValue(0, 1));
        assert.equal(1, g.getValue(1, 0));
        assert.deepEqual([2, 4], g.getValue(1, 1));
        assert.deepEqual(['X', 'Y'], g.getLabels());
    });

    it('should parse error bars', function () {
        var data = "X,Y\n" + "0,1,4\n" + "1,2,4\n" + "2,3,4\n" + "3,4,4\n";
        var g = new _srcDygraph2['default']('graph', data, { errorBars: true });

        assert.equal(0, g.getValue(0, 0));
        assert.deepEqual([1, 4], g.getValue(0, 1));
        assert.equal(1, g.getValue(1, 0));
        assert.deepEqual([2, 4], g.getValue(1, 1));
        assert.deepEqual(['X', 'Y'], g.getLabels());
    });

    it('should parse custom bars', function () {
        var data = "X,Y1,Y2\n" + "1,10;20;30,20;5;25\n" + "2,10;25;35,20;10;25\n";
        var g = new _srcDygraph2['default']('graph', data, { customBars: true });

        assert.equal(1, g.getValue(0, 0));
        assert.deepEqual([10, 20, 30], g.getValue(0, 1));
        assert.deepEqual([20, 5, 25], g.getValue(0, 2));
        assert.equal(2, g.getValue(1, 0));
        assert.deepEqual([10, 25, 35], g.getValue(1, 1));
        assert.deepEqual([20, 10, 25], g.getValue(1, 2));
        assert.deepEqual(['X', 'Y1', 'Y2'], g.getLabels());
    });

    /*
    it('should warn on unsorted input', function() {
    });
    
    it('should warn on different length columns', function() {
    });
    
    it('should detect double-labeled data', function() {
    });
    */
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138}],33:[function(require,module,exports){
/**
 * @fileoverview Tests zero and one-point charts.
 * These don't have to render nicely, they just have to not crash.
 *
 * @author dan@dygraphs.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("pathological-cases", function () {

  cleanupAfterEach();

  var restoreConsole;
  var logs = {};
  beforeEach(function () {
    restoreConsole = _Util2['default'].captureConsole(logs);
  });

  afterEach(function () {
    restoreConsole();
  });

  var graph = document.getElementById("graph");

  it('testZeroPoint', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y\n";

    var g = new _srcDygraph2['default'](graph, data, opts);
  });

  it('testOnePoint', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,Y\n" + "1,2\n";

    var g = new _srcDygraph2['default'](graph, data, opts);
  });

  it('testCombinations', function () {
    var dataSets = {
      empty: [],
      onePoint: [[10, 2]],
      nanPoint: [[10, NaN]],
      nanPoints: [[10, NaN], [20, NaN]],
      multiNan1: [[10, NaN, 2], [20, 3, NaN]],
      multiNan2: [[10, NaN, 2], [20, NaN, 4]],
      multiNan3: [[10, NaN, NaN], [20, 3, 4], [30, NaN, NaN]],
      atZero: [[0, 0]],
      atZero2: [[0, 0, 0]],
      negative: [[-10, -1]],
      acrossZero: [[-10, 1], [10, 2]],
      normal: [[0, 1, 9], [10, 3, 5], [20, 2, 7], [30, 4, 3]]
    };

    var baseOpts = {
      lines: {},
      stacked: {
        stackedGraph: true
      }
    };

    var variantOpts = {
      none: {},
      padded: {
        includeZero: true,
        drawAxesAtZero: true,
        xRangePad: 2,
        yRangePad: 4
      }
    };

    for (var baseName in baseOpts) {
      var base = baseOpts[baseName];
      for (var variantName in variantOpts) {
        var variant = variantOpts[variantName];

        var opts = {
          width: 300,
          height: 150,
          pointSize: 10
        };
        for (var key in base) {
          if (base.hasOwnProperty(key)) opts[key] = base[key];
        }
        for (var key in variant) {
          if (variant.hasOwnProperty(key)) opts[key] = variant[key];
        }

        var h = document.createElement('h3');
        h.appendChild(document.createTextNode(baseName + ' ' + variantName));
        graph.appendChild(h);
        for (var dataName in dataSets) {
          var data = dataSets[dataName];

          var box = document.createElement('fieldset');
          box.style.display = 'inline-block';
          var legend = document.createElement('legend');
          legend.appendChild(document.createTextNode(dataName));
          box.appendChild(legend);
          var gdiv = document.createElement('div');
          gdiv.style.display = 'inline-block';
          box.appendChild(gdiv);
          graph.appendChild(box);

          var cols = data && data[0] ? data[0].length : 0;
          opts.labels = ['X', 'A', 'B', 'C'].slice(0, cols);

          var g = new _srcDygraph2['default'](gdiv, data, opts);

          if (dataName == 'empty') {
            assert.deepEqual(logs, {
              log: [], warn: [],
              error: ["Can't plot empty data set"]
            });
            logs.error = []; // reset
          } else {
              assert.deepEqual(logs, { log: [], warn: [], error: [] });
            }
        }
      }
    }
  });

  it('testNullLegend', function () {
    var opts = {
      width: 480,
      height: 320,
      labelsDiv: null
    };
    var data = "X,Y\n" + "1,2\n";

    var g = new _srcDygraph2['default'](graph, data, opts);
  });

  it('testDivAsString', function () {
    var data = "X,Y\n" + "1,2\n";

    var g = new _srcDygraph2['default']('graph', data, {});
  });

  it('testConstantSeriesNegative', function () {
    var data = "X,Y\n" + "1,-1\n" + "2,-1\n";

    var g = new _srcDygraph2['default']('graph', data, {});
    // This check could be loosened to
    // g.yAxisRange()[0] < g.yAxisRange()[1] if it breaks in the future.
    assert.deepEqual([-1.1, -0.9], g.yAxisRange());
  });

  it('testConstantSeriesNegativeIncludeZero', function () {
    var data = "X,Y\n" + "1,-1\n" + "2,-1\n";

    var g = new _srcDygraph2['default']('graph', data, { includeZero: true });
    // This check could be loosened to
    // g.yAxisRange()[0] < g.yAxisRange()[1] if it breaks in the future.
    assert.deepEqual([-1.1, 0], g.yAxisRange());
  });

  it('should throw with non-existent divs', function () {
    var data = "X,Y\n" + "1,-1\n" + "2,1\n";

    assert.throws(function () {
      new _srcDygraph2['default'](null, data);
    }, /non-existent div/);

    assert.throws(function () {
      new _srcDygraph2['default']('non-existent-div-id', data);
    }, /non-existent div/);
  });
});

},{"../../src/dygraph":139,"./Util":5}],34:[function(require,module,exports){
/**
 * @fileoverview Tests for per-axis options.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

describe("per-axis", function () {

  cleanupAfterEach();
  useProxyCanvas(utils, _Proxy2['default']);

  var xAxisLineColor = "#00ffff";
  var yAxisLineColor = "#ffff00";

  var g, graph;

  beforeEach(function () {
    var opts = {
      axes: {
        x: {
          drawAxis: false,
          drawGrid: false,
          gridLineColor: xAxisLineColor
        },
        y: {
          drawAxis: false,
          drawGrid: false,
          gridLineColor: yAxisLineColor
        }
      },
      colors: ['#ff0000', '#0000ff']
    };

    var data = "X,Y,Z\n" + "1,1,0\n" + "8,0,1\n";
    graph = document.getElementById('graph');
    g = new _srcDygraph2['default'](graph, data, opts);
  });

  it('testDrawXAxis', function () {
    g.updateOptions({ axes: { x: { drawAxis: true } } });
    assert.isTrue(graph.getElementsByClassName('dygraph-axis-label-x').length > 0);
    assert.isTrue(graph.getElementsByClassName('dygraph-axis-label-y').length == 0);
  });

  it('testDrawYAxis', function () {
    g.updateOptions({ axes: { y: { drawAxis: true } } });
    assert.isTrue(graph.getElementsByClassName('dygraph-axis-label-x').length == 0);
    assert.isTrue(graph.getElementsByClassName('dygraph-axis-label-y').length > 0);
  });

  it('testDrawXGrid', function () {
    g.updateOptions({ axes: { x: { drawGrid: true } } });
    var htx = g.hidden_ctx_;
    assert.isTrue(_CanvasAssertions2['default'].numLinesDrawn(htx, xAxisLineColor) > 0);
    assert.isTrue(_CanvasAssertions2['default'].numLinesDrawn(htx, yAxisLineColor) == 0);
  });

  it('testDrawYGrid', function () {
    g.updateOptions({ axes: { y: { drawGrid: true } } });
    var htx = g.hidden_ctx_;
    assert.isTrue(_CanvasAssertions2['default'].numLinesDrawn(htx, xAxisLineColor) == 0);
    assert.isTrue(_CanvasAssertions2['default'].numLinesDrawn(htx, yAxisLineColor) > 0);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./Proxy":4,"./Util":5}],35:[function(require,module,exports){
/**
 * @fileoverview Tests for per-series options.
 *
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _PixelSampler = require('./PixelSampler');

var _PixelSampler2 = _interopRequireDefault(_PixelSampler);

describe("per-series", function () {

  cleanupAfterEach();

  it('testPerSeriesFill', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      series: {
        Y: { fillGraph: true }
      },
      colors: ['#FF0000', '#0000FF'],
      fillAlpha: 0.15
    };
    var data = "X,Y,Z\n" + "1,0,0\n" + "2,0,1\n" + "3,0,1\n" + "4,0,0\n" + "5,0,0\n" + "6,1,0\n" + "7,1,0\n" + "8,0,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var sampler = new _PixelSampler2['default'](g);

    // Inside of the "Z" bump -- no fill.
    assert.deepEqual([0, 0, 0, 0], sampler.colorAtCoordinate(2.5, 0.5));

    // Inside of the "Y" bump -- filled in.
    assert.deepEqual([255, 0, 0, 38], sampler.colorAtCoordinate(6.5, 0.5));
  });

  it('testPerSeriesAlpha', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      series: {
        Y: { fillGraph: true, fillAlpha: 0.25 },
        Z: { fillGraph: true, fillAlpha: 0.75 }
      },
      colors: ['#FF0000', '#0000FF']
    };
    var data = "X,Y,Z\n" + "1,0,0\n" + "2,0,1\n" + "3,0,1\n" + "4,0,0\n" + "5,0,0\n" + "6,1,0\n" + "7,1,0\n" + "8,0,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var sampler = new _PixelSampler2['default'](g);

    // Inside of the "Y" bump -- 5% alpha.
    assert.deepEqual([255, 0, 0, 63], sampler.colorAtCoordinate(6.5, 0.5));

    // Inside of the "Z" bump -- 95% alpha.
    assert.deepEqual([0, 0, 255, 191], sampler.colorAtCoordinate(2.5, 0.5));
  });

  it('testNewStyleSeries', function () {
    var opts = {
      pointSize: 5,
      series: {
        Y: { pointSize: 4 }
      }
    };
    var graph = document.getElementById("graph");
    var data = "X,Y,Z\n1,0,0\n";
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.equal(5, g.getOption("pointSize"));
    assert.equal(4, g.getOption("pointSize", "Y"));
    assert.equal(5, g.getOption("pointSize", "Z"));
  });

  // TODO(konigsberg): move to multiple_axes.js
  it('testAxisInNewSeries', function () {
    var opts = {
      series: {
        D: { axis: 'y2' },
        C: { axis: 1 },
        B: { axis: 0 },
        E: { axis: 'y' }
      }
    };
    var graph = document.getElementById("graph");
    var data = "X,A,B,C,D,E\n0,1,2,3,4,5\n";
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.deepEqual(["A", "B", "E"], g.attributes_.seriesForAxis(0));
    assert.deepEqual(["C", "D"], g.attributes_.seriesForAxis(1));
  });

  // TODO(konigsberg): move to multiple_axes.js
  it('testAxisInNewSeries_withAxes', function () {
    var opts = {
      series: {
        D: { axis: 'y2' },
        C: { axis: 1 },
        B: { axis: 0 },
        E: { axis: 'y' }
      },
      axes: {
        y: { pointSize: 7 },
        y2: { pointSize: 6 }
      }
    };
    var graph = document.getElementById("graph");
    var data = "X,A,B,C,D,E\n0,1,2,3,4,5\n";
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert.deepEqual(["A", "B", "E"], g.attributes_.seriesForAxis(0));
    assert.deepEqual(["C", "D"], g.attributes_.seriesForAxis(1));

    assert.equal(1.5, g.getOption("pointSize"));
    assert.equal(7, g.getOption("pointSize", "A"));
    assert.equal(7, g.getOption("pointSize", "B"));
    assert.equal(6, g.getOption("pointSize", "C"));
    assert.equal(6, g.getOption("pointSize", "D"));
    assert.equal(7, g.getOption("pointSize", "E"));
  });

  // TODO(konigsberg): move to multiple_axes.js
  it('testOldAxisSpecInNewSeriesThrows', function () {
    var opts = {
      series: {
        D: { axis: {} }
      }
    };
    var graph = document.getElementById("graph");
    var data = "X,A,B,C,D,E\n0,1,2,3,4,5\n";
    var threw = false;
    try {
      new _srcDygraph2['default'](graph, data, opts);
    } catch (e) {
      threw = true;
    }

    assert.isTrue(threw);
  });

  it('testColorOption', function () {
    var graph = document.getElementById("graph");
    var data = "X,A,B,C\n0,1,2,3\n";
    var g = new _srcDygraph2['default'](graph, data, {});
    assert.deepEqual(['rgb(64,128,0)', 'rgb(64,0,128)', 'rgb(0,128,128)'], g.getColors());
    g.updateOptions({ series: { B: { color: 'purple' } } });
    assert.deepEqual(['rgb(64,128,0)', 'purple', 'rgb(0,128,128)'], g.getColors());
  });
});

},{"../../src/dygraph":139,"./PixelSampler":3}],36:[function(require,module,exports){
/**
 * @fileoverview Tests for the plugins option.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

describe("plugins", function () {

  cleanupAfterEach();

  var data;

  beforeEach(function () {
    data = "X,Y1,Y2\n" + "0,1,2\n" + "1,2,1\n" + "2,1,2\n" + "3,2,1\n";
  });

  it('testWillDrawChart', function () {
    var draw = 0;

    var plugin = (function () {
      var p = function p() {};

      p.prototype.activate = function (g) {
        return {
          willDrawChart: this.willDrawChart
        };
      };

      p.prototype.willDrawChart = function (e) {
        draw++;
      };

      return p;
    })();

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, { plugins: [plugin] });

    assert.equal(1, draw);
  });

  it('testPassingInstance', function () {
    // You can also pass an instance of a plugin instead of a Plugin class.
    var draw = 0;
    var p = {
      activate: function activate(g) {
        return {
          willDrawChart: this.willDrawChart
        };
      },
      willDrawChart: function willDrawChart(g) {
        draw++;
      }
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, { plugins: [p] });

    assert.equal(1, draw);
  });

  it('testPreventDefault', function () {
    var data1 = "X,Y\n" + "20,-1\n" + "21,0\n" + "22,1\n" + "23,0\n";

    var events = [];

    var p = {
      pointClickPreventDefault: false,
      clickPreventDefault: false,
      activate: function activate(g) {
        return {
          pointClick: this.pointClick,
          click: this.click
        };
      },
      pointClick: function pointClick(e) {
        events.push(['plugin.pointClick', e.point.xval, e.point.yval]);
        if (this.pointClickPreventDefault) {
          e.preventDefault();
        }
      },
      click: function click(e) {
        events.push(['plugin.click', e.xval]);
        if (this.clickPreventDefault) {
          e.preventDefault();
        }
      }
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data1, {
      plugins: [p],
      clickCallback: function clickCallback(e, x) {
        events.push(['clickCallback', x]);
      },
      pointClickCallback: function pointClickCallback(e, pt) {
        events.push(['pointClickCallback', pt.xval, pt.yval]);
      }
    });

    // Click the point at x=20
    function clickOnPoint() {
      var x = 58,
          y = 275;
      _DygraphOps2['default'].dispatchMouseDown_Point(g, x, y);
      _DygraphOps2['default'].dispatchMouseMove_Point(g, x, y);
      _DygraphOps2['default'].dispatchMouseUp_Point(g, x, y);
    }

    p.pointClickPreventDefault = false;
    p.clickPreventDefault = false;
    clickOnPoint();
    assert.deepEqual([['plugin.pointClick', 20, -1], ['pointClickCallback', 20, -1], ['plugin.click', 20], ['clickCallback', 20]], events);

    events = [];
    p.pointClickPreventDefault = true;
    p.clickPreventDefault = false;
    clickOnPoint();
    assert.deepEqual([['plugin.pointClick', 20, -1]], events);

    events = [];
    p.pointClickPreventDefault = false;
    p.clickPreventDefault = true;
    clickOnPoint();
    assert.deepEqual([['plugin.pointClick', 20, -1], ['pointClickCallback', 20, -1], ['plugin.click', 20]], events);
  });

  it('testEventSequence', function () {
    var events = [];

    var eventLogger = function eventLogger(name) {
      return function (e) {
        events.push(name);
      };
    };

    var p = {
      activate: function activate(g) {
        return {
          clearChart: eventLogger('clearChart'),
          predraw: eventLogger('predraw'),
          willDrawChart: eventLogger('willDrawChart'),
          didDrawChart: eventLogger('didDrawChart'),
          dataWillUpdate: eventLogger('dataWillUpdate'),
          dataDidUpdate: eventLogger('dataDidUpdate')
        };
      }
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, { plugins: [p] });

    // Initial draw sequence
    assert.deepEqual(["dataDidUpdate", // should dataWillUpdate be called here, too?
    "predraw", "clearChart", "willDrawChart", "didDrawChart"], events);

    // An options change triggers a redraw, but doesn't change the data.
    events = [];
    g.updateOptions({ series: { Y1: { color: 'blue' } } });
    assert.deepEqual(["predraw", "clearChart", "willDrawChart", "didDrawChart"], events);

    // A pan shouldn't cause a new "predraw"
    events = [];
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 100, 100, { shiftKey: true });
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 200, 100, { shiftKey: true });
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 200, 100, { shiftKey: true });
    assert.deepEqual(["clearChart", "willDrawChart", "didDrawChart"], events);

    // New data triggers the full sequence.
    events = [];
    g.updateOptions({ file: data + '\n4,1,2' });
    assert.deepEqual(["dataWillUpdate", "dataDidUpdate", "predraw", "clearChart", "willDrawChart", "didDrawChart"], events);
  });

  it('testDestroyCalledInOrder', function () {
    var destructions = [];
    var makePlugin = function makePlugin(name) {
      return {
        activate: function activate(g) {
          return {};
        },
        destroy: function destroy() {
          destructions.push(name);
        }
      };
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, {
      plugins: [makePlugin('p'), makePlugin('q')]
    });

    assert.deepEqual([], destructions);
    g.destroy();
    assert.deepEqual(['q', 'p'], destructions);
  });
});

},{"../../src/dygraph":139,"./DygraphOps":2}],37:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcPluginsLegend = require('../../src/plugins/legend');

var _srcPluginsLegend2 = _interopRequireDefault(_srcPluginsLegend);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("plugins-legend", function () {

  var graph;

  cleanupAfterEach();
  beforeEach(function () {
    var testDiv = document.getElementById('graph');
    testDiv.innerHTML = "<div id='inner-graph'></div><div id='label'></div>";
    graph = document.getElementById('inner-graph');
  });

  it('testLegendEscape', function () {
    var opts = {
      width: 480,
      height: 320
    };
    var data = "X,<script>alert('XSS')</script>\n" + "0,-1\n" + "1,0\n" + "2,1\n" + "3,0\n";

    var g = new _srcDygraph2['default'](graph, data, opts);

    var legendPlugin = new _srcPluginsLegend2['default']();
    legendPlugin.activate(g);
    var e = {
      selectedX: 'selectedX',
      selectedPoints: [{
        canvasy: 100,
        name: "<script>alert('XSS')</script>",
        yval: 10
      }],
      dygraph: g
    };
    legendPlugin.select(e);

    var legendSpan = legendPlugin.legend_div_.querySelector("span b span");
    assert.equal(legendSpan.innerHTML, "&lt;script&gt;alert('XSS')&lt;/script&gt;");
  });

  it('should let labelsDiv be a string', function () {
    var labelsDiv = document.getElementById('label');
    var g = new _srcDygraph2['default'](graph, 'X,Y\n1,2\n', { labelsDiv: 'label' });
    null;
    g.setSelection(0);
    assert.equal('1: Y: 2', _Util2['default'].nbspToSpace(labelsDiv.textContent));
  });

  it('should let labelsDiv be an Element', function () {
    var labelsDiv = document.getElementById('label');
    var g = new _srcDygraph2['default'](graph, 'X,Y\n1,2\n', { labelsDiv: labelsDiv });
    assert.isNull(labelsDiv.getAttribute('class')); // dygraph-legend not added.
    g.setSelection(0);
    assert.equal('1: Y: 2', _Util2['default'].nbspToSpace(labelsDiv.textContent));
  });

  it('should render dashed patterns', function () {
    var g = new _srcDygraph2['default'](graph, 'X,Y\n1,2\n', {
      strokePattern: [5, 5],
      color: 'red',
      legend: 'always'
    });

    // The legend has a dashed line and a label.
    var legendEl = document.querySelector('.dygraph-legend > span');
    assert.equal(' Y', legendEl.textContent);
    var dashEl = document.querySelector('.dygraph-legend > span > div');
    assert.equal(window.getComputedStyle(dashEl)['border-bottom-color'], 'rgb(255, 0, 0)');
  });

  it('should use a legendFormatter', function () {
    var calls = [];
    var g = new _srcDygraph2['default'](graph, 'X,Y\n1,2\n', {
      color: 'red',
      legend: 'always',
      legendFormatter: function legendFormatter(data) {
        calls.push(data);
        // Note: can't check against `g` because it's not defined yet.
        assert(this.toString().indexOf('Dygraph') >= 0);
        return '';
      }
    });

    assert(calls.length == 1); // legend for no selected points
    g.setSelection(0);
    assert(calls.length == 2); // legend with selected points
    g.clearSelection();
    assert(calls.length == 3);

    assert.equal(calls[0].x, undefined);
    assert.equal(calls[1].x, 1);
    assert.equal(calls[1].xHTML, '1');
    assert.equal(calls[2].x, undefined);

    assert.equal(calls[0].series.length, 1);
    assert.equal(calls[1].series.length, 1);
    assert.equal(calls[2].series.length, 1);

    assert.equal(calls[0].series[0].y, undefined);
    assert.equal(calls[1].series[0].label, 'Y');
    assert.equal(calls[1].series[0].labelHTML, 'Y');
    assert.equal(calls[1].series[0].y, 2);
    assert.equal(calls[1].series[0].yHTML, '2');
    assert.equal(calls[1].series[0].isVisible, true);
    assert.equal(calls[2].series[0].y, undefined);
  });

  it('should work with highlight series', function () {
    var calls = [];
    var g = new _srcDygraph2['default'](graph, 'X,y1,y2\n1,2,3\n', {
      highlightSeriesOpts: {
        strokeWidth: 3
      }
    });

    g.setSelection(false, 'y2');
    assert.equal(_Util2['default'].getLegend(graph), '');
  });

  it('should include point drawn where canvas-y is 0', function () {
    var graph = document.getElementById("graph");
    var calls = [];
    function callback(data) {
      calls.push(data);
    };

    var g = new _srcDygraph2['default'](document.getElementById("graph"), "X,Y\n" + "1,5\n" + "1,10\n" + "1,12\n", {
      legendFormatter: callback,
      axes: {
        y: {
          valueRange: [0, 10]
        }
      }
    });
    g.setSelection(1);
    var data = calls[1];
    assert.isTrue(data.series[0].isVisible);
    assert.notEqual(data.series[0].yHTML, '');
  });
});

},{"../../src/dygraph":139,"../../src/plugins/legend":147,"./Util":5}],38:[function(require,module,exports){
// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Regression tests for range selector.
 * @author paul.eric.felix@gmail.com (Paul Felix)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _srcPluginsRangeSelector = require('../../src/plugins/range-selector');

var _srcPluginsRangeSelector2 = _interopRequireDefault(_srcPluginsRangeSelector);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

describe("range-selector", function () {

  cleanupAfterEach();

  var restoreConsole;
  var logs = {};
  beforeEach(function () {
    restoreConsole = _Util2['default'].captureConsole(logs);
  });

  afterEach(function () {
    restoreConsole();
  });

  it('testRangeSelector', function () {
    var opts = {
      width: 480,
      height: 320,
      showRangeSelector: true,
      labels: ['X', 'Y']
    };
    var data = [[1, 10], [2, 15], [3, 10], [4, 15], [5, 10], [6, 15], [7, 10], [8, 15], [9, 10]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    assertGraphExistence(g, graph);
  });

  it('testRangeSelectorWithErrorBars', function () {
    var opts = {
      width: 480,
      height: 320,
      errorBars: true,
      showRangeSelector: true,
      labels: ['X', 'Y']
    };
    var data = [[1, [10, 10]], [2, [15, 10]], [3, [10, 10]], [4, [15, 10]], [5, [10, 10]], [6, [15, 20]], [7, [10, 20]], [8, [15, 20]], [9, [10, 20]]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    assertGraphExistence(g, graph);
  });

  it('testRangeSelectorWithCustomBars', function () {
    var opts = {
      width: 480,
      height: 320,
      customBars: true,
      showRangeSelector: true,
      labels: ['X', 'Y']
    };
    var data = [[1, [10, 10, 100]], [2, [15, 20, 110]], [3, [10, 30, 100]], [4, [15, 40, 110]], [5, [10, 120, 100]], [6, [15, 50, 110]], [7, [10, 70, 100]], [8, [15, 90, 110]], [9, [10, 50, 100]]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    assertGraphExistence(g, graph);
  });

  it('testRangeSelectorWithLogScale', function () {
    var opts = {
      width: 480,
      height: 320,
      logscale: true,
      showRangeSelector: true,
      labels: ['X', 'Y']
    };
    var data = [[1, 10], [2, 15], [3, 10], [4, 15], [5, 10], [6, 15], [7, 10], [8, 15], [9, 10]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    assertGraphExistence(g, graph);
  });

  it('testRangeSelectorOptions', function () {
    var opts = {
      width: 480,
      height: 320,
      showRangeSelector: true,
      rangeSelectorHeight: 30,
      rangeSelectorPlotFillColor: 'lightyellow',
      rangeSelectorPlotFillGradientColor: 'rgba(200, 200, 42, 10)',
      labels: ['X', 'Y']
    };
    var data = [[1, 10], [2, 15], [3, 10], [4, 15], [5, 10], [6, 15], [7, 10], [8, 15], [9, 10]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    assertGraphExistence(g, graph);
  });

  it('testAdditionalRangeSelectorOptions', function () {
    var opts = {
      width: 480,
      height: 320,
      showRangeSelector: true,
      rangeSelectorHeight: 30,
      rangeSelectorBackgroundStrokeColor: 'blue',
      rangeSelectorBackgroundLineWidth: 3,
      rangeSelectorPlotLineWidth: 0.5,
      rangeSelectorForegroundStrokeColor: 'red',
      rangeSelectorForegroundLineWidth: 2,
      rangeSelectorAlpha: 0.8,
      labels: ['X', 'Y']
    };
    var data = [[1, 10], [2, 15], [3, 10], [4, 15], [5, 10], [6, 15], [7, 10], [8, 15], [9, 10]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    assertGraphExistence(g, graph);
  });

  it('testRangeSelectorEnablingAfterCreation', function () {
    var opts = {
      width: 480,
      height: 320,
      labels: ['X', 'Y']
    };
    var data = [[1, 10], [2, 15], [3, 10], [4, 15], [5, 10], [6, 15], [7, 10], [8, 15], [9, 10]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    var initialChartHeight = g.getArea().h;
    g.updateOptions({ showRangeSelector: true });
    assertGraphExistence(g, graph);
    assert(g.getArea().h < initialChartHeight); // range selector shown

    g.updateOptions({ showRangeSelector: false });
    assert.equal(g.getArea().h, initialChartHeight); // range selector hidden
  });

  // The animatedZooms option does not work with the range selector. Make sure it gets turned off.
  it('testRangeSelectorWithAnimatedZoomsOption', function () {
    var opts = {
      width: 480,
      height: 320,
      showRangeSelector: true,
      animatedZooms: true,
      labels: ['X', 'Y']
    };
    var data = [[1, 10], [2, 15], [3, 10], [4, 15], [5, 10], [6, 15], [7, 10], [8, 15], [9, 10]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    assertGraphExistence(g, graph);
    assert.isFalse(g.getOption('animatedZooms'));
    assert.deepEqual(logs, {
      log: [], error: [],
      warn: ["Animated zooms and range selector are not compatible; disabling animatedZooms."]
    });
  });

  it('testRangeSelectorWithAnimatedZoomsOption2', function () {
    var opts = {
      width: 480,
      height: 320,
      animatedZooms: true,
      labels: ['X', 'Y']
    };
    var data = [[1, 10], [2, 15], [3, 10], [4, 15], [5, 10], [6, 15], [7, 10], [8, 15], [9, 10]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    g.updateOptions({ showRangeSelector: true });
    assertGraphExistence(g, graph);
    assert.isFalse(g.getOption('animatedZooms'));
    assert.deepEqual(logs, {
      log: [], error: [],
      warn: ["Animated zooms and range selector are not compatible; disabling animatedZooms."]
    });
  });

  it('testRangeSelectorInteraction', function () {
    var opts = {
      width: 480,
      height: 320,
      showRangeSelector: true,
      labels: ['X', 'Y']
    };
    var data = [[1, 10], [2, 15], [3, 10], [4, 15], [5, 10], [6, 15], [7, 10], [8, 15], [9, 10]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    assertGraphExistence(g, graph);
    var zoomhandles = graph.getElementsByClassName('dygraph-rangesel-zoomhandle');

    // Move left zoomhandle in
    var xRange = g.xAxisRange().slice();

    var mouseDownEvent = _DygraphOps2['default'].createEvent({
      type: 'dragstart',
      detail: 1,
      clientX: 0,
      clientY: 0
    });
    zoomhandles[0].dispatchEvent(mouseDownEvent);

    var mouseMoveEvent = _DygraphOps2['default'].createEvent({
      type: 'mousemove',
      clientX: 20,
      clientY: 20
    });
    zoomhandles[0].dispatchEvent(mouseMoveEvent);

    var mouseUpEvent = _DygraphOps2['default'].createEvent({
      type: 'mouseup',
      detail: 1,
      clientX: 20,
      clientY: 20
    });
    zoomhandles[0].dispatchEvent(mouseUpEvent);

    var newXRange = g.xAxisRange().slice();
    assert(newXRange[0] > xRange[0], 'left zoomhandle should have moved: ' + newXRange[0] + '>' + xRange[0]);
    assert.equal(xRange[1], newXRange[1], 'right zoomhandle should not have moved');

    // Move right zoomhandle in
    xRange = newXRange;

    mouseDownEvent = _DygraphOps2['default'].createEvent({
      type: 'dragstart',
      detail: 1,
      clientX: 100,
      clientY: 100
    });
    zoomhandles[1].dispatchEvent(mouseDownEvent);

    mouseMoveEvent = _DygraphOps2['default'].createEvent({
      type: 'mousemove',
      clientX: 80,
      clientY: 80
    });
    zoomhandles[1].dispatchEvent(mouseMoveEvent);

    mouseUpEvent = _DygraphOps2['default'].createEvent({
      type: 'mouseup',
      detail: 1,
      clientX: 80,
      clientY: 80
    });
    zoomhandles[1].dispatchEvent(mouseUpEvent);

    var newXRange = g.xAxisRange().slice();
    assert(newXRange[1] < xRange[1], 'right zoomhandle should have moved: ' + newXRange[1] + '<' + xRange[1]);
    assert.equal(xRange[0], newXRange[0], 'left zoomhandle should not have moved');

    // Pan left
    xRange = newXRange;
    var fgcanvas = graph.getElementsByClassName('dygraph-rangesel-fgcanvas')[0];
    var x = parseInt(zoomhandles[0].style.left) + 20;
    var y = parseInt(zoomhandles[0].style.top);

    mouseDownEvent = _DygraphOps2['default'].createEvent({
      type: 'mousedown',
      detail: 1,
      clientX: x,
      clientY: y
    });
    fgcanvas.dispatchEvent(mouseDownEvent);

    x -= 10;

    mouseMoveEvent = _DygraphOps2['default'].createEvent({
      type: 'mousemove',
      clientX: x,
      clientY: y
    });
    fgcanvas.dispatchEvent(mouseMoveEvent);

    mouseUpEvent = _DygraphOps2['default'].createEvent({
      type: 'mouseup',
      detail: 1,
      clientX: x,
      clientY: y
    });
    fgcanvas.dispatchEvent(mouseUpEvent);

    var newXRange = g.xAxisRange().slice();
    assert(newXRange[0] < xRange[0], newXRange[0] + '<' + xRange[0]);
    assert(newXRange[1] < xRange[1], newXRange[1] + '<' + xRange[1]);
  });

  it('testRangeSelectorPositionIfXAxisNotDrawn', function () {
    var opts = {
      width: 480,
      height: 100,
      xAxisHeight: 30,
      axes: { x: { drawAxis: false } },
      showRangeSelector: true,
      rangeSelectorHeight: 30,
      labels: ['X', 'Y']
    };
    var data = [[0, 1], [10, 1]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    //assert, that the range selector is at top position 70 since the 30px of the
    // xAxis shouldn't be reserved since it isn't drawn.
    assertGraphExistence(g, graph);
    var bgcanvas = graph.getElementsByClassName('dygraph-rangesel-bgcanvas')[0];
    assert.equal("70px", bgcanvas.style.top, "Range selector is not at the expected position.");
    var fgcanvas = graph.getElementsByClassName('dygraph-rangesel-fgcanvas')[0];
    assert.equal("70px", fgcanvas.style.top, "Range selector is not at the expected position.");
  });

  it('testMiniPlotDrawn', function () {
    // Install Proxy to track canvas calls.
    var origFunc = utils.getContext;
    var miniHtx;
    utils.getContext = function (canvas) {
      if (canvas.className != 'dygraph-rangesel-bgcanvas') {
        return origFunc(canvas);
      }
      miniHtx = new _Proxy2['default'](origFunc(canvas));
      return miniHtx;
    };

    var opts = {
      width: 480,
      height: 100,
      xAxisHeight: 30,
      axes: { x: { drawAxis: false } },
      showRangeSelector: true,
      rangeSelectorHeight: 30,
      rangeSelectorPlotStrokeColor: '#ff0000',
      labels: ['X', 'Y']
    };
    var data = [[0, 1], [5, 4], [10, 8]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    // TODO(danvk): more precise tests.
    assert.isNotNull(miniHtx);
    assert.isTrue(0 < _CanvasAssertions2['default'].numLinesDrawn(miniHtx, '#ff0000'));

    utils.getContext = origFunc;
  });

  // Tests data computation for the mini plot with a single series.
  it('testSingleCombinedSeries', function () {
    var opts = {
      showRangeSelector: true,
      labels: ['X', 'Y1']
    };
    var data = [[0, 1], [5, 4], [10, 8]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var rangeSelector = g.getPluginInstance_(_srcPluginsRangeSelector2['default']);
    assert.isNotNull(rangeSelector);

    var combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 1 - 7 * 0.25, // 25% padding
      yMax: 8 + 7 * 0.25,
      data: [[0, 1], [5, 4], [10, 8]]
    }, combinedSeries);
  });

  // Tests that multiple series are averaged for the miniplot.
  it('testCombinedSeries', function () {
    var opts = {
      showRangeSelector: true,
      labels: ['X', 'Y1', 'Y2']
    };
    var data = [[0, 1, 3], // average = 2
    [5, 4, 6], // average = 5
    [10, 7, 9] // average = 8
    ];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var rangeSelector = g.getPluginInstance_(_srcPluginsRangeSelector2['default']);
    assert.isNotNull(rangeSelector);

    var combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 2 - 6 * 0.25, // 25% padding on combined series range.
      yMax: 8 + 6 * 0.25,
      data: [[0, 2], [5, 5], [10, 8]]
    }, combinedSeries);
  });

  // Tests selection of a specific series to average for the mini plot.
  it('testSelectedCombinedSeries', function () {
    var opts = {
      showRangeSelector: true,
      labels: ['X', 'Y1', 'Y2', 'Y3', 'Y4'],
      series: {
        'Y1': { showInRangeSelector: true },
        'Y3': { showInRangeSelector: true }
      }
    };
    var data = [[0, 5, 8, 13, 21], // average (first and third) = 9
    [5, 1, 3, 7, 14], // average (first and third) = 4
    [10, 0, 19, 10, 6] // average (first and third) = 5
    ];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var rangeSelector = g.getPluginInstance_(_srcPluginsRangeSelector2['default']);
    assert.isNotNull(rangeSelector);

    var combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 4 - 5 * 0.25, // 25% padding on combined series range.
      yMax: 9 + 5 * 0.25,
      data: [[0, 9], [5, 4], [10, 5]]
    }, combinedSeries);
  });

  // Tests data computation for the mini plot with a single error bar series.
  it('testSingleCombinedSeriesCustomBars', function () {
    var opts = {
      customBars: true,
      showRangeSelector: true,
      labels: ['X', 'Y1']
    };
    var data = [[0, [0, 1, 2]], // [low, value, high]
    [5, [1, 4, 5]], [10, [7, 8, 9]]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var rangeSelector = g.getPluginInstance_(_srcPluginsRangeSelector2['default']);
    assert.isNotNull(rangeSelector);

    var combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 1 - 7 * 0.25, // 25% padding
      yMax: 8 + 7 * 0.25,
      data: [[0, 1], [5, 4], [10, 8]]
    }, combinedSeries);
  });

  it('testSingleCombinedSeriesErrorBars', function () {
    var opts = {
      errorBars: true,
      showRangeSelector: true,
      labels: ['X', 'Y1']
    };
    var data = [[0, [1, 1]], // [value, standard deviation]
    [5, [4, 2]], [10, [8, 1]]];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var rangeSelector = g.getPluginInstance_(_srcPluginsRangeSelector2['default']);
    assert.isNotNull(rangeSelector);

    var combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 1 - 7 * 0.25, // 25% padding
      yMax: 8 + 7 * 0.25,
      data: [[0, 1], [5, 4], [10, 8]]
    }, combinedSeries);
  });

  // Tests data computation for the mini plot with two custom bar series.
  it('testTwoCombinedSeriesCustomBars', function () {
    var opts = {
      customBars: true,
      showRangeSelector: true,
      labels: ['X', 'Y1', 'Y2']
    };
    var data = [[0, [0, 1, 2], [4, 5, 6]], // [low, value, high], avg_val = 3
    [5, [1, 4, 5], [5, 8, 9]], // avg_val = 6
    [10, [7, 8, 9], [11, 12, 13]] // avg_val = 10
    ];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var rangeSelector = g.getPluginInstance_(_srcPluginsRangeSelector2['default']);
    assert.isNotNull(rangeSelector);

    var combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 3 - 7 * 0.25, // 25% padding
      yMax: 10 + 7 * 0.25,
      data: [[0, 3], [5, 6], [10, 10]]
    }, combinedSeries);
  });

  it('testHiddenSeriesExcludedFromMiniplot', function () {
    var opts = {
      showRangeSelector: true,
      labels: ['X', 'Y1', 'Y2'],
      visibility: [true, false]
    };
    var data = [[0, 1, 3], // average = 2
    [5, 4, 6], // average = 5
    [10, 7, 9] // average = 8
    ];
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var rangeSelector = g.getPluginInstance_(_srcPluginsRangeSelector2['default']);
    assert.isNotNull(rangeSelector);

    // Invisible series (e.g. Y2) are not included in the combined series.
    var combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 1 - 6 * 0.25, // 25% padding on single series range.
      yMax: 7 + 6 * 0.25,
      data: [[0, 1], [5, 4], [10, 7]]
    }, combinedSeries);

    // If Y2 is explicitly marked to be included in the range selector,
    // then it will be (even if it's not visible). Since we've started being
    // explicit about marking series for inclusion, this means that Y1 is no
    // longer included.
    g.updateOptions({
      series: {
        Y2: { showInRangeSelector: true }
      }
    });
    combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 3 - 6 * 0.25, // 25% padding on combined series range.
      yMax: 9 + 6 * 0.25,
      data: [[0, 3], [5, 6], [10, 9]]
    }, combinedSeries);

    // If we explicitly mark Y1, too, then it also gets included.
    g.updateOptions({
      series: {
        Y1: { showInRangeSelector: true },
        Y2: { showInRangeSelector: true }
      }
    });
    combinedSeries = rangeSelector.computeCombinedSeriesAndLimits_();
    assert.deepEqual({
      yMin: 2 - 6 * 0.25, // 25% padding on combined series range.
      yMax: 8 + 6 * 0.25,
      data: [[0, 2], [5, 5], [10, 8]]
    }, combinedSeries);
  });

  var assertGraphExistence = function assertGraphExistence(g, graph) {
    assert.isNotNull(g);
    var zoomhandles = graph.getElementsByClassName('dygraph-rangesel-zoomhandle');
    assert.equal(2, zoomhandles.length);
    var bgcanvas = graph.getElementsByClassName('dygraph-rangesel-bgcanvas');
    assert.equal(1, bgcanvas.length);
    var fgcanvas = graph.getElementsByClassName('dygraph-rangesel-fgcanvas');
    assert.equal(1, fgcanvas.length);
  };
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"../../src/plugins/range-selector":148,"./CanvasAssertions":1,"./DygraphOps":2,"./Proxy":4,"./Util":5}],39:[function(require,module,exports){
// Copyright (c) 2011 Google, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/**
 * @fileoverview Test valueRange and dateWindow changes.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

var _custom_asserts = require('./custom_asserts');

var ZERO_TO_FIFTY = [[10, 0], [20, 50]];
var ZERO_TO_FIFTY_STEPS = (function () {
  var a = [];
  var x = 10;
  var y = 0;
  var step = 0;
  for (step = 0; step <= 50; step++) {
    a.push([x + step * .2, y + step]);
  }
  return a;
})();

var FIVE_TO_ONE_THOUSAND = [[1, 10], [2, 20], [3, 30], [4, 40], [5, 50], [6, 60], [7, 70], [8, 80], [9, 90], [10, 1000]];

describe("range-tests", function () {

  cleanupAfterEach();

  var createGraph = function createGraph(opts, data, expectRangeX, expectRangeY) {
    if (data === undefined) data = ZERO_TO_FIFTY_STEPS;
    if (expectRangeX === undefined) expectRangeX = [10, 20];
    if (expectRangeY === undefined) expectRangeY = [0, 55];
    if (!opts) opts = {};
    opts['labels'] = ['X', 'Y'];
    var g = new _srcDygraph2['default']('graph', data, opts);

    (0, _custom_asserts.assertDeepCloseTo)(expectRangeX, g.xAxisRange(), 0.01);
    (0, _custom_asserts.assertDeepCloseTo)(expectRangeY, g.yAxisRange(0), 0.01);

    return g;
  };

  /**
   * Test that changes to valueRange and dateWindow are reflected
   * appropriately.
   */
  it('testRangeSetOperations', function () {
    var g = createGraph({ valueRange: [0, 55] });

    g.updateOptions({ dateWindow: [12, 18] });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([0, 55], g.yAxisRange(0));

    g.updateOptions({ valueRange: [10, 40] });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([10, 40], g.yAxisRange(0));

    g.updateOptions({ valueRange: [10, NaN] });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([10, 44.2], g.yAxisRange(0));

    g.updateOptions({ valueRange: [10, 40] });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([10, 40], g.yAxisRange(0));

    g.updateOptions({ valueRange: [10, null] });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([10, 44.2], g.yAxisRange(0));

    g.updateOptions({ valueRange: [10, 40] });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([10, 40], g.yAxisRange(0));

    g.updateOptions({ valueRange: [10, undefined] });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([10, 44.2], g.yAxisRange(0));

    g.updateOptions({ valueRange: [10, 40] });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([10, 40], g.yAxisRange(0));

    g.updateOptions({});
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([10, 40], g.yAxisRange(0));

    g.updateOptions({ valueRange: null, axes: { y: { valueRange: [15, 20] } } });
    assert.deepEqual([12, 18], g.xAxisRange());
    assert.deepEqual([15, 20], g.yAxisRange(0));

    g.updateOptions({ dateWindow: null, valueRange: null, axes: null });
    assert.deepEqual([10, 20], g.xAxisRange());
    assert.deepEqual([0, 55], g.yAxisRange(0));
  });

  /**
   * Verify that when zoomed in by mouse operations, an empty call to
   * updateOptions doesn't change the displayed ranges.
   */
  var zoom = function zoom(g, xRange, yRange) {
    var originalXRange = g.xAxisRange();
    var originalYRange = g.yAxisRange(0);

    _DygraphOps2['default'].dispatchMouseDown(g, xRange[0], yRange[0]);
    _DygraphOps2['default'].dispatchMouseMove(g, xRange[1], yRange[0]); // this is really necessary.
    _DygraphOps2['default'].dispatchMouseUp(g, xRange[1], yRange[0]);

    (0, _custom_asserts.assertDeepCloseTo)(xRange, g.xAxisRange(), 0.2);
    // assert.closeTo(originalYRange, g.yAxisRange(0), 0.2); // Not true, it's something in the middle.

    var midX = (xRange[1] - xRange[0]) / 2;
    _DygraphOps2['default'].dispatchMouseDown(g, midX, yRange[0]);
    _DygraphOps2['default'].dispatchMouseMove(g, midX, yRange[1]); // this is really necessary.
    _DygraphOps2['default'].dispatchMouseUp(g, midX, yRange[1]);

    (0, _custom_asserts.assertDeepCloseTo)(xRange, g.xAxisRange(), 0.2);
    (0, _custom_asserts.assertDeepCloseTo)(yRange, g.yAxisRange(0), 0.2);
  };

  /**
   * Verify that when zoomed in by mouse operations, an empty call to
   * updateOptions doesn't change the displayed ranges.
   */
  it('testEmptyUpdateOptions_doesntUnzoom', function () {
    var g = createGraph();
    zoom(g, [11, 18], [35, 40]);

    (0, _custom_asserts.assertDeepCloseTo)([11, 18], g.xAxisRange(), 0.1);
    (0, _custom_asserts.assertDeepCloseTo)([35, 40], g.yAxisRange(0), 0.2);

    g.updateOptions({});

    (0, _custom_asserts.assertDeepCloseTo)([11, 18], g.xAxisRange(), 0.1);
    (0, _custom_asserts.assertDeepCloseTo)([35, 40], g.yAxisRange(0), 0.2);
  });

  /**
   * Verify that when zoomed in by mouse operations, a call to
   * updateOptions({ dateWindow : null, valueRange : null }) fully
   * unzooms.
   */
  it('testRestoreOriginalRanges_viaUpdateOptions', function () {
    var g = createGraph();
    zoom(g, [11, 18], [35, 40]);

    g.updateOptions({ dateWindow: null, valueRange: null });

    assert.deepEqual([0, 55], g.yAxisRange(0));
    assert.deepEqual([10, 20], g.xAxisRange());
  });

  /**
   * Verify that log scale axis range is properly specified.
   */
  it('testLogScaleExcludesZero', function () {
    var g = new _srcDygraph2['default']("graph", FIVE_TO_ONE_THOUSAND, {
      logscale: true,
      labels: ['X', 'Y']
    });
    assert.deepEqual([10, 1099], g.yAxisRange(0));

    g.updateOptions({ logscale: false });
    assert.deepEqual([0, 1099], g.yAxisRange(0));
  });

  /**
   * Verify that includeZero range is properly specified.
   */
  it('testIncludeZeroIncludesZero', function () {
    var g = new _srcDygraph2['default']("graph", [[0, 500], [500, 1000]], {
      includeZero: true,
      labels: ['X', 'Y']
    });
    assert.deepEqual([0, 1100], g.yAxisRange(0));

    g.updateOptions({ includeZero: false });
    assert.deepEqual([450, 1050], g.yAxisRange(0));
  });

  /**
   * Verify that includeZero range is properly specified per axis.
   */
  it('testIncludeZeroPerAxis', function () {
    var g = new _srcDygraph2['default']("graph", 'X,A,B\n' + '0,50,50\n' + '50,110,110\n', {
      drawPoints: true,
      pointSize: 5,
      series: {
        A: {
          axis: 'y',
          pointSize: 10
        },
        B: {
          axis: 'y2'
        }
      },
      axes: {
        'y2': { includeZero: true }
      }
    });

    assert.deepEqual([44, 116], g.yAxisRange(0));
    assert.deepEqual([0, 121], g.yAxisRange(1));

    g.updateOptions({
      axes: {
        'y2': { includeZero: false }
      }
    });

    assert.deepEqual([44, 116], g.yAxisRange(1));
  });

  /**
   * Verify that very large Y ranges don't break things.
   */
  it('testHugeRange', function () {
    var g = new _srcDygraph2['default']("graph", [[0, -1e120], [1, 1e230]], {
      includeZero: true,
      labels: ['X', 'Y']
    });
    assert.closeTo(1, -1e229 / g.yAxisRange(0)[0], 0.001);
    assert.closeTo(1, 1.1e230 / g.yAxisRange(0)[1], 0.001);
  });

  /**
   * Verify ranges with user-specified padding, implicit avoidMinZero.
   */
  it('testPaddingAuto', function () {
    var g = createGraph({
      xRangePad: 42,
      yRangePad: 30
    }, ZERO_TO_FIFTY_STEPS, [9, 21], [-5, 55]);
  });

  /**
   * Verify auto range with drawAxesAtZero.
   */
  it('testPaddingAutoAxisAtZero', function () {
    var g = createGraph({
      drawAxesAtZero: true
    }, ZERO_TO_FIFTY_STEPS, [10, 20], [0, 55]);
  });

  /**
   * Verify user-specified range with padding and drawAxesAtZero options.
   * Try explicit range matching the auto range, should have identical results.
   */
  it('testPaddingRange1', function () {
    var g = createGraph({
      valueRange: [0, 50],
      xRangePad: 42,
      yRangePad: 30,
      drawAxesAtZero: true
    }, ZERO_TO_FIFTY_STEPS, [9, 21], [-5, 55]);
  });

  /**
   * Verify user-specified range with padding and drawAxesAtZero options.
   * User-supplied range differs from the auto range.
   */
  it('testPaddingRange2', function () {
    var g = createGraph({
      valueRange: [10, 60],
      xRangePad: 42,
      yRangePad: 30,
      drawAxesAtZero: true
    }, ZERO_TO_FIFTY_STEPS, [9, 21], [5, 65]);
  });

  /**
   * Verify drawAxesAtZero and includeZero.
   */
  it('testPaddingYAtZero', function () {
    var g = createGraph({
      includeZero: true,
      xRangePad: 42,
      yRangePad: 30,
      drawAxesAtZero: true
    }, [[-10, 10], [10, 20], [30, 50]], [-14, 34], [-5, 55]);
  });

  /**
   * Verify logscale, compat mode.
   */
  it('testLogscaleCompat', function () {
    var g = createGraph({
      logscale: true
    }, [[-10, 10], [10, 10], [30, 1000]], [-10, 30], [10, 1099]);
  });

  /**
   * Verify logscale, new mode.
   */
  it('testLogscalePad', function () {
    var g = createGraph({
      logscale: true,
      yRangePad: 30
    }, [[-10, 10], [10, 10], [30, 1000]], [-10, 30], [5.623, 1778.279]);
  });

  /**
   * Verify scrolling all-zero region, new-style.
   */
  it('testZeroScroll2', function () {
    var g = new _srcDygraph2['default'](document.getElementById("graph"), "X,Y\n" + "1,0\n" + "8,0\n" + "9,0.1\n", {
      animatedZooms: true,
      drawAxesAtZero: true,
      xRangePad: 4,
      yRangePad: 4
    });
  });
});

},{"../../src/dygraph":139,"./DygraphOps":2,"./custom_asserts":11}],40:[function(require,module,exports){
/**
 * @fileoverview Test cases for resizing.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("resize", function () {

  cleanupAfterEach();

  var data = "X,Y\n" + "1,100\n" + "2,200\n" + "3,300\n" + "4,400\n" + "5,300\n" + "6,100\n";

  it('testResizeMaintainsMouseOperations', function () {
    var graph = document.getElementById('graph');
    graph.setAttribute('style', 'width: 640px; height: 480px;');

    var callbackCount = 0;
    var callback = function callback() {
      callbackCount++;
    };

    // Strum the mouse along the y-coordinate y, from 0 to x2. These are DOM values.
    var strum = function strum(g, y, x2) {
      _DygraphOps2['default'].dispatchMouseDown_Point(g, 0, y);
      for (var x = 0; x < x2; x++) {
        _DygraphOps2['default'].dispatchMouseMove_Point(g, x, y);
      }
      _DygraphOps2['default'].dispatchMouseUp_Point(g, x2 - 1, y);
    };

    var g = new _srcDygraph2['default'](graph, data, { highlightCallback: callback });

    strum(g, 300, 640);
    assert.equal(6, callbackCount);

    graph.style.width = "500px";
    g.resize();

    callbackCount = 0;
    strum(g, 300, 500);
    assert.equal(6, callbackCount);
  });

  /**
   * Tests that a graph created in a not-displayed div works as expected
   * if the graph options include height and width. Resize not needed.
   */
  it('testHiddenDivWithSizedGraph', function () {
    var div = document.getElementById("graph");

    div.style.display = 'none';
    var g = new _srcDygraph2['default'](div, data, { width: 400, height: 300 });
    div.style.display = '';

    var area = g.getArea();
    assert.isTrue(area.w > 0);
    assert.isTrue(area.h > 0);
  });

  /**
   * Tests that a graph created in a not-displayed div with
   * CSS-specified size but no graph height or width options works as
   * expected. The user needs to call resize() on it after displaying
   * it.
   */
  it('testHiddenDivWithResize', function () {
    var div = document.getElementById("graph");

    div.style.display = 'none';
    div.style.width = '400px';
    div.style.height = '300px';

    // Setting strokeWidth 3 removes any ambiguitiy from the pixel sampling
    // request, below.
    var g = new _srcDygraph2['default'](div, data, { strokeWidth: 3 });
    div.style.display = '';

    g.resize();
    var area = g.getArea();
    assert.isTrue(area.w > 0);
    assert.isTrue(area.h > 0);

    // Regression test: check that graph remains visible after no-op resize.
    g.resize();
    var x = Math.floor(g.toDomXCoord(2));
    var y = Math.floor(g.toDomYCoord(200));
    assert.deepEqual([0, 128, 128, 255], _Util2['default'].samplePixel(g.hidden_, x, y), "Unexpected grid color found at pixel: x: " + x + " y: " + y);
  });
});

},{"../../src/dygraph":139,"./DygraphOps":2,"./Util":5}],41:[function(require,module,exports){
/**
 * @fileoverview Tests for rolling averages.
 *
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("rolling-average", function () {

  cleanupAfterEach();

  it('testRollingAverage', function () {
    var opts = {
      width: 480,
      height: 320,
      rollPeriod: 1,
      showRoller: true
    };
    var data = "X,Y\n" + "0,0\n" + "1,1\n" + "2,2\n" + "3,3\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    g.setSelection(0);assert.equal("0: Y: 0", _Util2['default'].getLegend());
    g.setSelection(1);assert.equal("1: Y: 1", _Util2['default'].getLegend());
    g.setSelection(2);assert.equal("2: Y: 2", _Util2['default'].getLegend());
    g.setSelection(3);assert.equal("3: Y: 3", _Util2['default'].getLegend());
    assert.equal(1, g.rollPeriod());

    g.updateOptions({ rollPeriod: 2 });
    g.setSelection(0);assert.equal("0: Y: 0", _Util2['default'].getLegend());
    g.setSelection(1);assert.equal("1: Y: 0.5", _Util2['default'].getLegend());
    g.setSelection(2);assert.equal("2: Y: 1.5", _Util2['default'].getLegend());
    g.setSelection(3);assert.equal("3: Y: 2.5", _Util2['default'].getLegend());
    assert.equal(2, g.rollPeriod());

    g.updateOptions({ rollPeriod: 3 });
    g.setSelection(0);assert.equal("0: Y: 0", _Util2['default'].getLegend());
    g.setSelection(1);assert.equal("1: Y: 0.5", _Util2['default'].getLegend());
    g.setSelection(2);assert.equal("2: Y: 1", _Util2['default'].getLegend());
    g.setSelection(3);assert.equal("3: Y: 2", _Util2['default'].getLegend());
    assert.equal(3, g.rollPeriod());

    g.updateOptions({ rollPeriod: 4 });
    g.setSelection(0);assert.equal("0: Y: 0", _Util2['default'].getLegend());
    g.setSelection(1);assert.equal("1: Y: 0.5", _Util2['default'].getLegend());
    g.setSelection(2);assert.equal("2: Y: 1", _Util2['default'].getLegend());
    g.setSelection(3);assert.equal("3: Y: 1.5", _Util2['default'].getLegend());
    assert.equal(4, g.rollPeriod());
  });

  it('testRollBoxDoesntDisapper', function () {
    var opts = {
      showRoller: true
    };
    var data = "X,Y\n" + "0,0\n" + "1,1\n" + "2,2\n" + "3,3\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var roll_box = graph.getElementsByTagName("input");
    assert.equal(1, roll_box.length);
    assert.equal("1", roll_box[0].value);

    graph.style.width = "500px";
    g.resize();
    assert.equal(1, roll_box.length);
    assert.equal("1", roll_box[0].value);
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=426
  it('testRollShortFractions', function () {
    var opts = {
      customBars: true,
      labels: ['x', 'A', 'B']
    };
    var data1 = [[1, 10, [1, 20]]];
    var data2 = [[1, 10, [1, 20]], [2, 20, [1, 30]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data2, opts);

    var rolled1 = g.dataHandler_.rollingAverage(data1, 1, g);
    var rolled2 = g.dataHandler_.rollingAverage(data2, 1, g);

    assert.deepEqual(rolled1[0], rolled2[0]);
  });

  it('testRollCustomBars', function () {
    var opts = {
      customBars: true,
      rollPeriod: 2,
      labels: ['x', 'A']
    };
    var data = [[1, [1, 10, 20]], [2, [1, 20, 30]], [3, [1, 30, 40]], [4, [1, 40, 50]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    var rolled = getRolledData(g, data, 1, 2);
    assert.deepEqual([1, 10, [1, 20]], rolled[0]);
    assert.deepEqual([2, 15, [1, 25]], rolled[1]);
    assert.deepEqual([3, 25, [1, 35]], rolled[2]);
    assert.deepEqual([4, 35, [1, 45]], rolled[3]);
  });

  it('testRollErrorBars', function () {
    var opts = {
      errorBars: true,
      rollPeriod: 2,
      labels: ['x', 'A']
    };
    var data = [[1, [10, 1]], [2, [20, 1]], [3, [30, 1]], [4, [40, 1]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    var rolled = getRolledData(g, data, 1, 2);
    assert.deepEqual([1, 10, [8, 12]], rolled[0]);

    // variance = sqrt( pow(error) * rollPeriod)
    var variance = Math.sqrt(2);
    for (var i = 1; i < data.length; i++) {
      var value = data[i][1][0] - 5;
      assert.equal(value, rolled[i][1], "unexpected rolled average");
      assert.equal(value - variance, rolled[i][2][0], "unexpected rolled min");
      assert.equal(value + variance, rolled[i][2][1], "unexpected rolled max");
    }
  });

  it('testRollFractions', function () {
    var opts = {
      fractions: true,
      rollPeriod: 2,
      labels: ['x', 'A']
    };
    var data = [[1, [1, 10]], [2, [2, 10]], [3, [3, 10]], [4, [4, 10]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    var rolled = getRolledData(g, data, 1, 2);
    assert.deepEqual([1, 10], rolled[0]);
    assert.deepEqual([2, 15], rolled[1]);
    assert.deepEqual([3, 25], rolled[2]);
    assert.deepEqual([4, 35], rolled[3]);
  });

  it('testRollFractionsBars', function () {
    var opts = {
      fractions: true,
      errorBars: true,
      wilsonInterval: false,
      rollPeriod: 2,
      labels: ['x', 'A']
    };
    var data = [[1, [1, 10]], [2, [2, 10]], [3, [3, 10]], [4, [4, 10]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    var rolled = getRolledData(g, data, 1, 2);

    // precalculated rounded values expected
    var values = [10, 15, 25, 35];
    var lows = [-9, -1, 6, 14];
    var highs = [29, 31, 44, 56];

    for (var i = 0; i < data.length; i++) {
      assert.equal(values[i], Math.round(rolled[i][1]), "unexpected rolled average");
      assert.equal(lows[i], Math.round(rolled[i][2][0]), "unexpected rolled min");
      assert.equal(highs[i], Math.round(rolled[i][2][1]), "unexpected rolled max");
    }
  });

  it('testRollFractionsBarsWilson', function () {
    var opts = {
      fractions: true,
      errorBars: true,
      wilsonInterval: true,
      rollPeriod: 2,
      labels: ['x', 'A']
    };
    var data = [[1, [1, 10]], [2, [2, 10]], [3, [3, 10]], [4, [4, 10]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);
    var rolled = getRolledData(g, data, 1, 2);

    //precalculated rounded values expected
    var values = [10, 15, 25, 35];
    var lows = [2, 5, 11, 18];
    var highs = [41, 37, 47, 57];

    for (var i = 0; i < data.length; i++) {
      assert.equal(values[i], Math.round(rolled[i][1]), "unexpected rolled average");
      assert.equal(lows[i], Math.round(rolled[i][2][0]), "unexpected rolled min");
      assert.equal(highs[i], Math.round(rolled[i][2][1]), "unexpected rolled max");
    }
  });

  var getRolledData = function getRolledData(g, data, seriesIdx, rollPeriod) {
    var options = g.attributes_;
    return g.dataHandler_.rollingAverage(g.dataHandler_.extractSeries(data, seriesIdx, options), rollPeriod, options);
  };
});

},{"../../src/dygraph":139,"./Util":5}],42:[function(require,module,exports){
// Copyright (c) 2011 Google, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/** 
 * @fileoverview Test cases that ensure Dygraphs works at all.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

describe("dygraphs-sanity", function () {

  var DEAD_SIMPLE_DATA = 'X,Y\n10,2100';
  var ZERO_TO_FIFTY = 'X,Y\n10,0\n20,50';

  cleanupAfterEach();

  /**
   * The sanity test of sanity tests.
   */
  it('testTrue', function () {
    assert.isTrue(true);
  });

  /**
   * Sanity test that ensures the graph element exists.
   */
  it('testGraphExists', function () {
    var graph = document.getElementById("graph");
    assert.isNotNull(graph);
  });

  // TODO(konigsberg): Move the following tests to a new package that
  // tests all kinds of toDomCoords, toDataCoords, toPercent, et cetera.

  /**
   * A sanity test of sorts, by ensuring the dygraph is created, and
   * isn't just some piece of junk object.
   */
  it('testToString', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, DEAD_SIMPLE_DATA, {});
    assert.isNotNull(g);
    assert.equal("[Dygraph graph]", g.toString());
  });

  /**
   * Test that when no valueRange is specified, the y axis range is
   * adjusted by 10% on top.
   */
  it('testYAxisRange_default', function () {
    var graph = document.getElementById("graph");
    assert.equal(0, graph.style.length);
    var g = new _srcDygraph2['default'](graph, ZERO_TO_FIFTY, {});
    assert.deepEqual([0, 55], g.yAxisRange(0));
  });

  /**
   * Test that valueRange matches the y-axis range specifically.
   */
  it('testYAxisRange_custom', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, ZERO_TO_FIFTY, { valueRange: [0, 50] });
    assert.deepEqual([0, 50], g.yAxisRange(0));
    g.updateOptions({ valueRange: null, axes: { y: { valueRange: [10, 40] } } });
    assert.deepEqual([10, 40], g.yAxisRange(0));
  });

  /**
   * Test that valueRange matches the y-axis range specifically.
   *
   * This is based on the assumption that 20 pixels are dedicated to the
   * axis label and tick marks.
   * TODO(konigsberg): change yAxisLabelWidth to 0 (or 20) and try again.
   */
  it('testToDomYCoord', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, ZERO_TO_FIFTY, { height: 70, valueRange: [0, 50] });

    assert.equal(50, g.toDomYCoord(0));
    assert.equal(0, g.toDomYCoord(50));

    for (var x = 0; x <= 50; x++) {
      assert.closeTo(50 - x, g.toDomYCoord(x), 0.00001);
    }
    g.updateOptions({ valueRange: null, axes: { y: { valueRange: [0, 50] } } });

    assert.equal(50, g.toDomYCoord(0));
    assert.equal(0, g.toDomYCoord(50));

    for (var x = 0; x <= 50; x++) {
      assert.closeTo(50 - x, g.toDomYCoord(x), 0.00001);
    }
  });

  /**
   * Test that the two-argument form of the constructor (no options) works.
   */
  it('testTwoArgumentConstructor', function () {
    var graph = document.getElementById("graph");
    new _srcDygraph2['default'](graph, ZERO_TO_FIFTY);
  });

  // Here is the first of a series of tests that just ensure the graph is drawn
  // without exception.
  //TODO(konigsberg): Move to its own test case.
  it('testFillStack1', function () {
    var graph = document.getElementById("graph");
    new _srcDygraph2['default'](graph, ZERO_TO_FIFTY, { stackedGraph: true });
  });

  it('testFillStack2', function () {
    var graph = document.getElementById("graph");
    new _srcDygraph2['default'](graph, ZERO_TO_FIFTY, { stackedGraph: true, fillGraph: true });
  });

  it('testFillStack3', function () {
    var graph = document.getElementById("graph");
    new _srcDygraph2['default'](graph, ZERO_TO_FIFTY, { fillGraph: true });
  });
});

},{"../../src/dygraph":139}],43:[function(require,module,exports){
/**
 * @fileoverview Tests input data which uses scientific notation.
 * This is a regression test for
 * http://code.google.com/p/dygraphs/issues/detail?id=186
 *
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _custom_asserts = require('./custom_asserts');

describe("scientific-notation", function () {

  cleanupAfterEach();

  function getXValues(g) {
    var xs = [];
    for (var i = 0; i < g.numRows(); i++) {
      xs.push(g.getValue(i, 0));
    }
    return xs;
  }

  it('testScientificInput', function () {
    var data = "X,Y\n" + "1.0e1,-1\n" + "2.0e1,0\n" + "3.0e1,1\n" + "4.0e1,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, {});
    (0, _custom_asserts.assertDeepCloseTo)([10, 20, 30, 40], getXValues(g), 1e-6);
  });

  it('testScientificInputPlus', function () {
    var data = "X,Y\n" + "1.0e+1,-1\n" + "2.0e+1,0\n" + "3.0e+1,1\n" + "4.0e+1,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, {});
    (0, _custom_asserts.assertDeepCloseTo)([10, 20, 30, 40], getXValues(g), 1e-6);
  });

  it('testScientificInputMinus', function () {
    var data = "X,Y\n" + "1.0e-1,-1\n" + "2.0e-1,0\n" + "3.0e-1,1\n" + "4.0e-1,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, {});
    (0, _custom_asserts.assertDeepCloseTo)([0.1, 0.2, 0.3, 0.4], getXValues(g), 1e-6);
  });

  it('testScientificInputMinusCap', function () {
    var data = "X,Y\n" + "1.0E-1,-1\n" + "2.0E-1,0\n" + "3.0E-1,1\n" + "4.0E-1,0\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, {});
    (0, _custom_asserts.assertDeepCloseTo)([0.1, 0.2, 0.3, 0.4], getXValues(g), 1e-6);
  });
});

},{"../../src/dygraph":139,"./custom_asserts":11}],44:[function(require,module,exports){
/** 
 * @fileoverview Test cases for a graph contained in a scrolling div
 *
 * @author konigsberg@google.com (Robert Konigsbrg)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

describe("scrolling-div", function () {

  var point, g;

  beforeEach(function () {

    var LOREM_IPSUM = "<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod\n" + "tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,\n" + "quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo\n" + "consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse\n" + "cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat\n" + "non proident, sunt in culpa qui officia deserunt mollit anim id est\n" + "laborum.</p>";

    var testDiv = document.getElementById('graph');
    testDiv.innerHTML = "<div id='scroller' style='overflow: scroll; height: 450px; width: 800px;'>" + "<div id='graph-inner'></div>" + "<div style='height:100px; background-color:green;'>" + LOREM_IPSUM + " </div>" + "<div style='height:100px; background-color:red;'>" + LOREM_IPSUM + "</div>" + "</div>";

    // The old test runner had an 8px margin on the body
    // The Mocha test runner does not. We set it on the test div to keep the
    // coordinates the same.
    testDiv.style.margin = '8px';

    var data = [[10, 1], [20, 3], [30, 2], [40, 4], [50, 3], [60, 5], [70, 4], [80, 6]];

    var graph = document.getElementById("graph-inner");

    point = null;
    g = new _srcDygraph2['default'](graph, data, {
      labels: ['a', 'b'],
      drawPoints: true,
      highlightCircleSize: 6,
      pointClickCallback: function pointClickCallback(evt, p) {
        point = p;
      }
    });
  });

  // This is usually something like 15, but for OS X Lion and its auto-hiding
  // scrollbars, it's 0. This is a large enough difference that we need to
  // consider it when synthesizing clicks.
  // Adapted from http://davidwalsh.name/detect-scrollbar-width
  var detectScrollbarWidth = function detectScrollbarWidth() {
    // Create the measurement node
    var scrollDiv = document.createElement("div");
    scrollDiv.style.width = "100px";
    scrollDiv.style.height = "100px";
    scrollDiv.style.overflow = "scroll";
    scrollDiv.style.position = "absolute";
    scrollDiv.style.top = "-9999px";
    document.body.appendChild(scrollDiv);

    // Get the scrollbar width
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;

    // Delete the DIV
    document.body.removeChild(scrollDiv);

    return scrollbarWidth;
  };

  /**
   * This tests that when the nested div is unscrolled, things work normally.
   */
  it('testUnscrolledDiv', function () {

    document.getElementById('scroller').scrollTop = 0;

    var clickOn4_40 = {
      clientX: 244,
      clientY: 131,
      screenX: 416,
      screenY: 320
    };

    _DygraphOps2['default'].dispatchCanvasEvent(g, _DygraphOps2['default'].createEvent(clickOn4_40, { type: 'mousemove' }));
    _DygraphOps2['default'].dispatchCanvasEvent(g, _DygraphOps2['default'].createEvent(clickOn4_40, { type: 'mousedown' }));
    _DygraphOps2['default'].dispatchCanvasEvent(g, _DygraphOps2['default'].createEvent(clickOn4_40, { type: 'mouseup' }));

    assert.equal(40, point.xval);
    assert.equal(4, point.yval);
  });

  /**
   * This tests that when the nested div is scrolled, things work normally.
   */
  it('testScrolledDiv', function () {
    document.getElementById('scroller').scrollTop = 117;

    var clickOn4_40 = {
      clientX: 244,
      clientY: 30 - detectScrollbarWidth(),
      screenX: 416,
      screenY: 160
    };

    _DygraphOps2['default'].dispatchCanvasEvent(g, _DygraphOps2['default'].createEvent(clickOn4_40, { type: 'mousemove' }));
    _DygraphOps2['default'].dispatchCanvasEvent(g, _DygraphOps2['default'].createEvent(clickOn4_40, { type: 'mousedown' }));
    _DygraphOps2['default'].dispatchCanvasEvent(g, _DygraphOps2['default'].createEvent(clickOn4_40, { type: 'mouseup' }));

    assert.equal(40, point.xval);
    assert.equal(4, point.yval);
  });
});

},{"../../src/dygraph":139,"./DygraphOps":2}],45:[function(require,module,exports){
// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Regression test based on an optimization w/
 * unforeseen consequences.
 * @author danvk@google.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDatahandlerDefault = require('../../src/datahandler/default');

var _srcDatahandlerDefault2 = _interopRequireDefault(_srcDatahandlerDefault);

describe("selection", function () {

  cleanupAfterEach();

  it('testSetGetSelection', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, "X,Y\n" + "1,1\n" + "50,50\n" + "100,100\n");

    g.setSelection(0);
    assert.equal(0, g.getSelection());
    g.setSelection(1);
    assert.equal(1, g.getSelection());
    g.setSelection(2);
    assert.equal(2, g.getSelection());
  });

  it('testSetGetSelectionDense', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, "X,Y\n" + "1,1\n" + "50,50\n" + "50.0001,50.0001\n" + "100,100\n");

    g.setSelection(0);
    assert.equal(0, g.getSelection());
    g.setSelection(1);
    assert.equal(1, g.getSelection());
    g.setSelection(2);
    assert.equal(2, g.getSelection());
    g.setSelection(3);
    assert.equal(3, g.getSelection());
  });

  it('testSetGetSelectionMissingPoints', function () {
    var dataHandler = function dataHandler() {};
    dataHandler.prototype = new _srcDatahandlerDefault2['default']();
    dataHandler.prototype.seriesToPoints = function (series, setName, boundaryIdStart) {
      var val = null;
      if (setName == 'A') {
        val = 1;
      } else if (setName == 'B') {
        val = 2;
      } else if (setName == 'C') {
        val = 3;
      }
      return [{
        x: NaN,
        y: NaN,
        xval: val,
        yval: val,
        name: setName,
        idx: val - 1
      }];
    };
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, "X,A,B,C\n" + "1,1,,\n" + "2,,2,\n" + "3,,,3\n", {
      dataHandler: dataHandler
    });

    g.setSelection(0);
    assert.equal(0, g.getSelection());
    g.setSelection(1);
    assert.equal(1, g.getSelection());
    g.setSelection(2);
    assert.equal(2, g.getSelection());
  });
});

},{"../../src/datahandler/default":129,"../../src/dygraph":139}],46:[function(require,module,exports){
// Copyright (c) 2011 Google, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/** 
 * @fileoverview Test cases for drawing simple lines.
 *
 * @author konigsberg@google.com (Robert Konigsberg)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

var _PixelSampler = require('./PixelSampler');

var _PixelSampler2 = _interopRequireDefault(_PixelSampler);

describe("simple-drawing", function () {

  cleanupAfterEach();
  useProxyCanvas(utils, _Proxy2['default']);

  var ZERO_TO_FIFTY = 'X,Y\n10,0\n20,50';

  it('testDrawSimpleRangePlusOne', function () {
    var opts = {
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      valueRange: [0, 51]
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, ZERO_TO_FIFTY, opts);
    var htx = g.hidden_ctx_;

    _CanvasAssertions2['default'].assertLineDrawn(htx, [0, 320], [475, 6.2745], {
      strokeStyle: "#008080",
      lineWidth: 1
    });
    g.destroy(); // to balance context saves and destroys.
    _CanvasAssertions2['default'].assertBalancedSaveRestore(htx);
  });

  // See http://code.google.com/p/dygraphs/issues/detail?id=185
  it('testDrawSimpleRangeZeroToFifty', function () {
    var opts = {
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      valueRange: [0, 50] };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, ZERO_TO_FIFTY, opts);
    var htx = g.hidden_ctx_;

    var lines = _CanvasAssertions2['default'].getLinesDrawn(htx, {
      strokeStyle: "#008080",
      lineWidth: 1
    });
    assert.equal(1, lines.length);
    g.destroy(); // to balance context saves and destroys.
    _CanvasAssertions2['default'].assertBalancedSaveRestore(htx);
  });

  it('testDrawWithAxis', function () {
    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, ZERO_TO_FIFTY);

    var htx = g.hidden_ctx_;
    g.destroy(); // to balance context saves and destroys.
    _CanvasAssertions2['default'].assertBalancedSaveRestore(htx);
  });

  /**
   * Tests that it is drawing dashes, and it remember the dash history between
   * points.
   */
  it('testDrawSimpleDash', function () {
    var opts = {
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      series: {
        'Y1': { strokePattern: [25, 7, 7, 7] }
      },
      colors: ['#ff0000'],
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    // Set the dims so we pass if default changes.
    graph.style.width = '480px';
    graph.style.height = '320px';
    var g = new _srcDygraph2['default'](graph, [[1, 4], [2, 5], [3, 3], [4, 7], [5, 9]], opts);
    var htx = g.hidden_ctx_;

    // TODO(danvk): figure out a good way to restore this test.
    // assert.equal(29, CanvasAssertions.numLinesDrawn(htx, "#ff0000"));
    g.destroy(); // to balance context saves and destroys.
    _CanvasAssertions2['default'].assertBalancedSaveRestore(htx);
  });

  /**
   * Tests that thick lines are drawn continuously.
   * Regression test for http://code.google.com/p/dygraphs/issues/detail?id=328
   */
  it('testDrawThickLine', function () {
    var opts = {
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      strokeWidth: 15,
      colors: ['#ff0000'],
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    // Set the dims so we pass if default changes.
    graph.style.width = '480px';
    graph.style.height = '320px';
    var g = new _srcDygraph2['default'](graph, [[1, 2], [2, 5], [3, 2], [4, 7], [5, 0]], opts);
    var htx = g.hidden_ctx_;

    // There's a big gap in the line at (2, 5)
    // If the bug is fixed, then there should be some red going up from here.
    var xy = g.toDomCoords(2, 5);
    var x = Math.round(xy[0]),
        y = Math.round(xy[1]);

    var sampler = new _PixelSampler2['default'](g);
    assert.deepEqual([255, 0, 0, 255], sampler.colorAtPixel(x, y));
    assert.deepEqual([255, 0, 0, 255], sampler.colorAtPixel(x, y - 1));
    assert.deepEqual([255, 0, 0, 255], sampler.colorAtPixel(x, y - 2));

    // TODO(danvk): figure out a good way to restore this test.
    // assert.equal(29, CanvasAssertions.numLinesDrawn(htx, "#ff0000"));
    g.destroy(); // to balance context saves and destroys.
    _CanvasAssertions2['default'].assertBalancedSaveRestore(htx);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./PixelSampler":3,"./Proxy":4}],47:[function(require,module,exports){
/**
 * @fileoverview Tests for the smooth (bezier curve) plotter.
 *
 * @author danvdk@gmail.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

require('../../src/extras/smooth-plotter');

// defines Dygraph.smoothPlotter

describe("smooth-plotter", function () {

    var smoothPlotter = _srcDygraph2['default'].smoothPlotter;
    var getControlPoints = smoothPlotter._getControlPoints;

    beforeEach(function () {});

    afterEach(function () {});

    it('testNoSmoothing', function () {
        var lastPt = { x: 10, y: 0 },
            pt = { x: 11, y: 1 },
            nextPt = { x: 12, y: 0 },
            alpha = 0;

        assert.deepEqual([11, 1, 11, 1], getControlPoints(lastPt, pt, nextPt, alpha));
    });

    it('testHalfSmoothing', function () {
        var lastPt = { x: 10, y: 0 },
            pt = { x: 11, y: 1 },
            nextPt = { x: 12, y: 0 },
            alpha = 0.5;

        assert.deepEqual([10.5, 1, 11.5, 1], getControlPoints(lastPt, pt, nextPt, alpha));
    });

    it('testExtrema', function () {
        var lastPt = { x: 10, y: 0 },
            pt = { x: 11, y: 1 },
            nextPt = { x: 12, y: 1 },
            alpha = 0.5;

        assert.deepEqual([10.5, 0.75, 11.5, 1.25], getControlPoints(lastPt, pt, nextPt, alpha, true));

        assert.deepEqual([10.5, 1, 11.5, 1], getControlPoints(lastPt, pt, nextPt, alpha, false));
    });
});

},{"../../src/dygraph":139,"../../src/extras/smooth-plotter":140}],48:[function(require,module,exports){
/**
 * @fileoverview Tests using the "stackedGraph" option.
 *
 * @author dan@dygraphs.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("stacked", function () {

  cleanupAfterEach();
  useProxyCanvas(utils, _Proxy2['default']);

  it('testCorrectColors', function () {
    var opts = {
      width: 400,
      height: 300,
      stackedGraph: true,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      valueRange: [0, 3],
      colors: ['#00ff00', '#0000ff'],
      fillAlpha: 0.15
    };
    var data = "X,Y1,Y2\n" + "0,1,1\n" + "1,1,1\n" + "2,1,1\n" + "3,1,1\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    // y pixels 299-201 = y2 = transparent blue
    // y pixel 200 = y2 line (blue)
    // y pixels 199-101 = y1 = transparent green
    // y pixel 100 = y1 line (green)
    // y pixels 0-99 = nothing (white)

    // 38 = round(0.15 * 255)
    assert.deepEqual([0, 0, 255, 38], _Util2['default'].samplePixel(g.hidden_, 200, 250));
    assert.deepEqual([0, 255, 0, 38], _Util2['default'].samplePixel(g.hidden_, 200, 150));
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=358
  it('testSelectionValues', function () {
    var opts = {
      stackedGraph: true
    };
    var data = "X,Y1,Y2\n" + "0,1,1\n" + "1,1,1\n" + "2,1,1\n" + "3,1,1\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    g.setSelection(0);

    assert.equal("0: Y1: 1 Y2: 1", _Util2['default'].getLegend());

    // Verify that the behavior is correct with highlightSeriesOpts as well.
    g.updateOptions({
      highlightSeriesOpts: {
        strokeWidth: 10
      }
    });
    g.setSelection(0);
    assert.equal("0: Y1: 1 Y2: 1", _Util2['default'].getLegend());

    g.setSelection(1);
    assert.equal("1: Y1: 1 Y2: 1", _Util2['default'].getLegend());

    g.setSelection(0, 'Y2');
    assert.equal("0: Y1: 1 Y2: 1", _Util2['default'].getLegend());
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=176
  it('testDuplicatedXValue', function () {
    var opts = {
      stackedGraph: true,
      fillAlpha: 0.15,
      colors: ['#00ff00'],
      width: 400,
      height: 300
    };
    var data = "X,Y1\n" + "0,1\n" + "1,1\n" + "2,1\n" + "2,1\n" + // duplicate x-value!
    "3,1\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    assert(g.yAxisRange()[1] < 2);

    assert.deepEqual([0, 255, 0, 38], _Util2['default'].samplePixel(g.hidden_, 200, 250));
    assert.deepEqual([0, 255, 0, 38], _Util2['default'].samplePixel(g.hidden_, 317, 250));
  });

  // Validates regression when null values in stacked graphs show up
  // incorrectly in the legend.
  it('testNullValues', function () {
    var opts = {
      stackedGraph: true,
      stepPlot: true
    };
    var data = "X,Y1,Y2,Y3\n" + "0,-5,-1,1\n" + "1,1,,1\n" + "2,1,2,3\n" + "3,3,,4\n" + "4,3,2,3\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    g.setSelection(0);
    assert.equal("0: Y1: -5 Y2: -1 Y3: 1", _Util2['default'].getLegend());

    g.setSelection(1);
    assert.equal("1: Y1: 1 Y3: 1", _Util2['default'].getLegend());

    g.setSelection(2);
    assert.equal("2: Y1: 1 Y2: 2 Y3: 3", _Util2['default'].getLegend());

    g.setSelection(3);
    assert.equal("3: Y1: 3 Y3: 4", _Util2['default'].getLegend());

    g.setSelection(4);
    assert.equal("4: Y1: 3 Y2: 2 Y3: 3", _Util2['default'].getLegend());
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=438
  it('testMissingValueAtZero', function () {
    var opts = {
      stackedGraph: true
    };
    var data = "X,Y1,Y2\n" + "0,,1\n" + "1,1,2\n" + "2,,3\n";

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    g.setSelection(0);
    assert.equal("0: Y2: 1", _Util2['default'].getLegend());

    g.setSelection(1);
    assert.equal("1: Y1: 1 Y2: 2", _Util2['default'].getLegend());

    g.setSelection(2);
    assert.equal("2: Y2: 3", _Util2['default'].getLegend());
  });

  it('testInterpolation', function () {
    var opts = {
      colors: ['#ff0000', '#00ff00', '#0000ff'],
      stackedGraph: true,
      labels: ['X', 'Y1', 'Y2', 'Y3', 'Y4']
    };

    // The last series is all-NaN, it ought to be treated as all zero
    // for stacking purposes.
    var N = NaN;
    var data = [[100, 1, 2, N, N], [101, 1, 2, 2, N], [102, 1, N, N, N], [103, 1, 2, 4, N], [104, N, N, N, N], [105, 1, 2, N, N], [106, 1, 2, 7, N], [107, 1, 2, 8, N], [108, 1, 2, 9, N], [109, 1, N, N, N]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;
    var attrs = {};

    // Check that lines are drawn at the expected positions, using
    // interpolated values for missing data.
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(100, 4), g.toDomCoords(101, 4), { strokeStyle: '#00ff00' });
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(102, 6), g.toDomCoords(103, 7), { strokeStyle: '#ff0000' });
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(107, 8), g.toDomCoords(108, 9), { strokeStyle: '#0000ff' });
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(108, 12), g.toDomCoords(109, 12), { strokeStyle: '#ff0000' });

    // Check that the expected number of line segments gets drawn
    // for each series. Gaps don't get a line.
    assert.equal(7, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));
    assert.equal(4, _CanvasAssertions2['default'].numLinesDrawn(htx, '#00ff00'));
    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#0000ff'));

    // Check that the selection returns the original (non-stacked)
    // values and skips gaps.
    g.setSelection(1);
    assert.equal("101: Y1: 1 Y2: 2 Y3: 2", _Util2['default'].getLegend());

    g.setSelection(8);
    assert.equal("108: Y1: 1 Y2: 2 Y3: 9", _Util2['default'].getLegend());

    g.setSelection(9);
    assert.equal("109: Y1: 1", _Util2['default'].getLegend());
  });

  it('testInterpolationOptions', function () {
    var opts = {
      colors: ['#ff0000', '#00ff00', '#0000ff'],
      stackedGraph: true,
      labels: ['X', 'Y1', 'Y2', 'Y3']
    };

    var data = [[100, 1, NaN, 3], [101, 1, 2, 3], [102, 1, NaN, 3], [103, 1, 2, 3], [104, 1, NaN, 3]];

    var choices = ['all', 'inside', 'none'];
    var stackedY = [[6, 6, 6, 6, 6], [4, 6, 6, 6, 4], [4, 6, 4, 6, 4]];

    for (var i = 0; i < choices.length; ++i) {
      var graph = document.getElementById("graph");
      opts['stackedGraphNaNFill'] = choices[i];
      var g = new _srcDygraph2['default'](graph, data, opts);

      var htx = g.hidden_ctx_;
      var attrs = {};

      // Check top lines get drawn at the expected positions.
      for (var j = 0; j < stackedY[i].length - 1; ++j) {
        _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(100 + j, stackedY[i][j]), g.toDomCoords(101 + j, stackedY[i][j + 1]), { strokeStyle: '#ff0000' });
      }
    }
  });

  it('testMultiAxisInterpolation', function () {
    // Setting 2 axes to test that each axis stacks separately
    var opts = {
      colors: ['#ff0000', '#00ff00', '#0000ff'],
      stackedGraph: true,
      series: {
        'Y1': {
          axis: 'y'
        },
        'Y2': {
          axis: 'y'
        },
        'Y3': {
          axis: 'y2'
        },
        'Y4': {
          axis: 'y2'
        }
      },
      labels: ['X', 'Y1', 'Y2', 'Y3', 'Y4']
    };

    // The last series is all-NaN, it ought to be treated as all zero
    // for stacking purposes.
    var N = NaN;
    var data = [[100, 1, 2, N, N], [101, 1, 2, 2, N], [102, 1, N, N, N], [103, 1, 2, 4, N], [104, N, N, N, N], [105, 1, 2, N, N], [106, 1, 2, 7, N], [107, 1, 2, 8, N], [108, 1, 2, 9, N], [109, 1, N, N, N]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;
    var attrs = {};

    // Check that lines are drawn at the expected positions, using
    // interpolated values for missing data.
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(100, 2), g.toDomCoords(101, 2), { strokeStyle: '#00ff00' });
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(102, 3), g.toDomCoords(103, 3), { strokeStyle: '#ff0000' });
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(107, 2.71), g.toDomCoords(108, 3), { strokeStyle: '#0000ff' });
    _CanvasAssertions2['default'].assertLineDrawn(htx, g.toDomCoords(108, 3), g.toDomCoords(109, 3), { strokeStyle: '#ff0000' });

    // Check that the expected number of line segments gets drawn
    // for each series. Gaps don't get a line.
    assert.equal(7, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));
    assert.equal(4, _CanvasAssertions2['default'].numLinesDrawn(htx, '#00ff00'));
    assert.equal(2, _CanvasAssertions2['default'].numLinesDrawn(htx, '#0000ff'));

    // Check that the selection returns the original (non-stacked)
    // values and skips gaps.
    g.setSelection(1);
    assert.equal("101: Y1: 1 Y2: 2 Y3: 2", _Util2['default'].getLegend());

    g.setSelection(8);
    assert.equal("108: Y1: 1 Y2: 2 Y3: 9", _Util2['default'].getLegend());

    g.setSelection(9);
    assert.equal("109: Y1: 1", _Util2['default'].getLegend());
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./Proxy":4,"./Util":5}],49:[function(require,module,exports){
/**
 * @fileoverview Test cases for the option "stepPlot" especially for the scenario where the option is not set for the whole graph but for single series.
 *
 * TODO(danvk): delete this test once dpxdt screenshot tests are part of the
 *     main dygraphs repo. The tests have extremely specific expectations about
 *     how drawing is performed. It's more realistic to test the resulting
 *     pixels.
 *
 * @author julian.eichstaedt@ch.sauter-bc.com (Fr. Sauter AG)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

describe("step-plot-per-series", function () {

  cleanupAfterEach();
  useProxyCanvas(utils, _Proxy2['default']);

  it('testMixedModeStepAndLineFilled', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      errorBars: false,
      labels: ["X", "Idle", "Used"],
      series: {
        Idle: { stepPlot: false },
        Used: { stepPlot: true }
      },
      fillGraph: true,
      stackedGraph: false,
      includeZero: true
    };

    var data = [[1, 70, 30], [2, 12, 88], [3, 88, 12], [4, 63, 37], [5, 35, 65]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {};

    for (var i = 0; i < data.length - 1; i++) {

      var x1 = data[i][0];
      var x2 = data[i + 1][0];

      var y1 = data[i][1];
      var y2 = data[i + 1][1];

      // First series (line)
      var xy1 = g.toDomCoords(x1, y1);
      var xy2 = g.toDomCoords(x2, y2);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      y1 = data[i][2];
      y2 = data[i + 1][2];

      // Seconds series (step)
      // Horizontal line
      xy1 = g.toDomCoords(x1, y1);
      xy2 = g.toDomCoords(x2, y1);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // Vertical line
      xy1 = g.toDomCoords(x2, y1);
      xy2 = g.toDomCoords(x2, y2);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
    }
  });

  it('testMixedModeStepAndLineStackedAndFilled', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      errorBars: false,
      labels: ["X", "Idle", "Used", "NotUsed", "Active"],
      series: {
        Idle: { stepPlot: false },
        Used: { stepPlot: true },
        NotUsed: { stepPlot: false },
        Active: { stepPlot: true }
      },
      fillGraph: true,
      stackedGraph: true,
      includeZero: true
    };

    var data = [[1, 60, 30, 5, 5], [2, 12, 73, 5, 10], [3, 38, 12, 30, 20], [4, 50, 17, 23, 10], [5, 35, 25, 35, 5]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {};

    for (var i = 0; i < data.length - 1; i++) {

      var x1 = data[i][0];
      var x2 = data[i + 1][0];
      var y1base = 0;
      var y2base = 0;
      var y1 = data[i][4];
      var y2 = data[i + 1][4];

      // Fourth series (step)
      // Test lines
      // Horizontal line
      var xy1 = g.toDomCoords(x1, y1);
      var xy2 = g.toDomCoords(x2, y1);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // Vertical line
      xy1 = g.toDomCoords(x2, y1);
      xy2 = g.toDomCoords(x2, y2);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Test edges of areas (also drawn by dygraphs as lines)
      xy1 = g.toDomCoords(x1, y1);
      xy2 = g.toDomCoords(x2, y1);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x2, y2base);
      // CanvasAssertions.assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x1, y1base);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // The last edge can not be tested via assertLineDrawn since it wasn't drawn as a line but via clossePath.
      // But a rectangle is completely tested with three of its four edges.

      y1base = y1;
      y2base = y1;
      y1 += data[i][3];
      y2 += data[i + 1][3];

      // Third series (line)
      // Test lines
      xy1 = g.toDomCoords(x1, y1);
      xy2 = g.toDomCoords(x2, y2);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Test edges of areas (also drawn by dygraphs as lines)
      xy1 = g.toDomCoords(x1, y1);
      xy2 = g.toDomCoords(x2, y2);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x2, y2base);
      // CanvasAssertions.assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x1, y1base);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // The last edge can not be tested via assertLineDrawn since it wasn't drawn as a line but via clossePath.
      // But a rectangle is completely tested with three of its four edges.

      y1base = y1;
      y2base = y2;
      y1 += data[i][2];
      y2 += data[i + 1][2];

      // Second series (step)
      // Test lines
      // Horizontal line
      xy1 = g.toDomCoords(x1, y1);
      xy2 = g.toDomCoords(x2, y1);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // Vertical line
      xy1 = g.toDomCoords(x2, y1);
      xy2 = g.toDomCoords(x2, y2);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Test edges of areas (also drawn by dygraphs as lines)
      xy1 = g.toDomCoords(x1, y1);
      xy2 = g.toDomCoords(x2, y1);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x2, y2base);
      // CanvasAssertions.assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x1, y1base);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // The last edge can not be tested via assertLineDrawn since it wasn't drawn as a line but via clossePath.
      // But a rectangle is completely tested with three of its four edges.

      y1base = y1;
      y2base = y1;
      y1 += data[i][1];
      y2 += data[i + 1][1];

      // First series (line)
      // Test lines
      xy1 = g.toDomCoords(x1, y1);
      xy2 = g.toDomCoords(x2, y2);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Test edges of areas (also drawn by dygraphs as lines)
      xy1 = g.toDomCoords(x1, y1);
      xy2 = g.toDomCoords(x2, y2);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x2, y2base);
      // CanvasAssertions.assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x1, y1base);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // The last edge can not be tested via assertLineDrawn since it wasn't drawn as a line but via clossePath.
      // But a rectangle is completely tested with three of its four edges.
    }
  });

  it('testMixedModeStepAndLineErrorBars', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      errorBars: true,
      sigma: 1,
      labels: ["X", "Data1", "Data2"],
      series: {
        Data1: { stepPlot: true },
        Data2: { stepPlot: false }
      }
    };
    var data = [[1, [75, 2], [50, 3]], [2, [70, 5], [90, 4]], [3, [80, 7], [112, 5]], [4, [55, 3], [100, 2]], [5, [69, 4], [85, 6]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {};

    // Test first series (step)
    for (var i = 0; i < data.length - 1; i++) {
      var x1 = data[i][0];
      var x2 = data[i + 1][0];

      var y1_middle = data[i][1][0];
      var y2_middle = data[i + 1][1][0];

      var y1_top = y1_middle + data[i][1][1];
      var y2_top = y2_middle + data[i + 1][1][1];

      var y1_bottom = y1_middle - data[i][1][1];
      var y2_bottom = y2_middle - data[i + 1][1][1];
      // Bottom line
      var xy1 = g.toDomCoords(x1, y1_bottom);
      var xy2 = g.toDomCoords(x2, y1_bottom);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Top line
      xy1 = g.toDomCoords(x1, y1_top);
      xy2 = g.toDomCoords(x2, y1_top);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Middle line
      xy1 = g.toDomCoords(x1, y1_middle);
      xy2 = g.toDomCoords(x2, y1_middle);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Test edges of error bar areas(also drawn by dygraphs as lines)
      xy1 = g.toDomCoords(x1, y1_top);
      xy2 = g.toDomCoords(x2, y1_top);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x2, y1_bottom);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x1, y1_bottom);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // The last edge can not be tested via assertLineDrawn since it wasn't drawn as a line but via clossePath.
      // But a rectangle is completely tested with three of its four edges.
    }

    // Test second series (line) 
    for (var i = 0; i < data.length - 1; i++) {
      // bottom line
      var xy1 = g.toDomCoords(data[i][0], data[i][2][0] - data[i][2][1]);
      var xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][2][0] - data[i + 1][2][1]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // top line
      xy1 = g.toDomCoords(data[i][0], data[i][2][0] + data[i][2][1]);
      xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][2][0] + data[i + 1][2][1]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // middle line
      xy1 = g.toDomCoords(data[i][0], data[i][2][0]);
      xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][2][0]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
    }
  });

  it('testMixedModeStepAndLineCustomBars', function () {
    var opts = {
      width: 480,
      height: 320,
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      customBars: true,
      labels: ["X", "Data1", "Data2"],
      series: {
        Data1: { stepPlot: true },
        Data2: { stepPlot: false }
      }
    };
    var data = [[1, [73, 75, 78], [50, 55, 70]], [2, [65, 70, 75], [83, 91, 99]], [3, [75, 85, 90], [98, 107, 117]], [4, [55, 58, 61], [93, 102, 105]], [5, [69, 73, 85], [80, 85, 87]]];

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    var htx = g.hidden_ctx_;

    var attrs = {};

    // Test first series (step)
    for (var i = 0; i < data.length - 1; i++) {

      var x1 = data[i][0];
      var x2 = data[i + 1][0];

      var y1_middle = data[i][1][1];
      var y2_middle = data[i + 1][1][1];

      var y1_top = data[i][1][2];
      var y2_top = data[i + 1][1][2];

      var y1_bottom = data[i][1][0];
      var y2_bottom = data[i + 1][1][0];

      // Bottom line
      var xy1 = g.toDomCoords(x1, y1_bottom);
      var xy2 = g.toDomCoords(x2, y1_bottom);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Top line
      xy1 = g.toDomCoords(x1, y1_top);
      xy2 = g.toDomCoords(x2, y1_top);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Middle line
      xy1 = g.toDomCoords(x1, y1_middle);
      xy2 = g.toDomCoords(x2, y1_middle);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Test edges of custom bar areas(also drawn by dygraphs as lines)
      xy1 = g.toDomCoords(x1, y1_top);
      xy2 = g.toDomCoords(x2, y1_top);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x2, y1_bottom);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      xy1 = xy2;
      xy2 = g.toDomCoords(x1, y1_bottom);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
      // The last edge can not be tested via assertLineDrawn since it wasn't drawn as a line but via clossePath.
      // But a rectangle is completely tested with three of its four edges.
    }

    // Test second series (line)
    for (var i = 0; i < data.length - 1; i++) {
      // Bottom line
      var xy1 = g.toDomCoords(data[i][0], data[i][2][0]);
      var xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][2][0]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Top line
      xy1 = g.toDomCoords(data[i][0], data[i][2][2]);
      xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][2][2]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);

      // Middle line
      xy1 = g.toDomCoords(data[i][0], data[i][2][1]);
      xy2 = g.toDomCoords(data[i + 1][0], data[i + 1][2][1]);
      _CanvasAssertions2['default'].assertLineDrawn(htx, xy1, xy2, attrs);
    }
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./Proxy":4}],50:[function(require,module,exports){
/**
 * @fileoverview Tests synchronizer.
 *
 * @author nyx@nyx.cz (Marek Janda)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

require('../../src/extras/synchronizer');

// Sets Dygraph.synchronize

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

describe("synchronize", function () {
  var gs;
  var originalCallbackCalled;
  var data = "X,a,b,c\n" + "10,-1,1,2\n" + "11,0,3,1\n" + "12,1,4,2\n" + "13,0,2,3\n";
  var h_row, h_pts;
  var graph = document.getElementById('graph');

  beforeEach(function () {
    graph.innerHTML = "<div id='graph1'></div><div id='graph2'></div>";
    originalCallbackCalled = false;
    h_row = 0, h_pts = [];
    gs = [];

    var highlightCallback = function highlightCallback(e, x, pts, row) {
      originalCallbackCalled = true;

      h_row = row;
      h_pts = pts;
      assert.equal(gs[0], this);
    };

    gs.push(new _srcDygraph2['default'](document.getElementById("graph1"), data, {
      width: 100,
      height: 100,
      visibility: [false, true, true],
      highlightCallback: highlightCallback
    }));
    gs.push(new _srcDygraph2['default'](document.getElementById("graph2"), data, {
      width: 100,
      height: 100,
      visibility: [false, true, true]
    }));
  });

  afterEach(function () {});

  /**
   * This tests if original highlightCallback is called when synchronizer is attached
   */
  it('testOriginalHighlightCallbackStillWorks', function () {
    var sync = _srcDygraph2['default'].synchronize(gs);

    _DygraphOps2['default'].dispatchMouseMove(gs[1], 5, 5);
    // check that chart2 doesn't trigger highlightCallback on chart1
    assert.equal(originalCallbackCalled, false);

    _DygraphOps2['default'].dispatchMouseMove(gs[0], 13, 10);
    // check that original highlightCallback was called
    assert.equal(originalCallbackCalled, true);

    sync.detach();
  });

  /**
   * This tests if selection is propagated correctly between charts
   */
  it('testChartsAreSynchronized', function () {
    _DygraphOps2['default'].dispatchMouseMove(gs[0], 13, 10);
    assert.notEqual(gs[0].getSelection(), gs[1].getSelection());
    _DygraphOps2['default'].dispatchMouseMove(gs[0], 0, 0);

    var sync = _srcDygraph2['default'].synchronize(gs);

    _DygraphOps2['default'].dispatchMouseMove(gs[0], 13, 10);

    //check correct row is highlighted on second chart
    assert.equal(3, h_row);
    //check there are only two points (because first series is hidden)
    assert.equal(2, h_pts.length);
    //check that selection on both charts is the same
    assert.equal(gs[0].getSelection(), gs[1].getSelection());

    sync.detach();
  });

  /**
   * This tests if detach works
   */
  it('testSynchronizerDetach', function () {
    var sync = _srcDygraph2['default'].synchronize(gs);
    _DygraphOps2['default'].dispatchMouseMove(gs[1], 10, 10);
    sync.detach();

    originalCallbackCalled = false;
    _DygraphOps2['default'].dispatchMouseMove(gs[1], 0, 0);

    //check that chart2 doesn't have highlightCallback
    assert.equal(originalCallbackCalled, false);

    _DygraphOps2['default'].dispatchMouseMove(gs[0], 13, 10);

    //check that original callback was re-attached
    assert.equal(originalCallbackCalled, true);

    //check that selection isn't synchronized anymore
    assert.equal(gs[0].getSelection(), 3);
    assert.equal(gs[1].getSelection(), 0);
  });
});

},{"../../src/dygraph":139,"../../src/extras/synchronizer":141,"./DygraphOps":2}],51:[function(require,module,exports){
/** 
 * @fileoverview Test cases for toDomCoords/toDataCoords
 *
 * @author danvk@google.com (Dan Vanderkam)
 */
'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _Proxy = require('./Proxy');

var _Proxy2 = _interopRequireDefault(_Proxy);

var _CanvasAssertions = require('./CanvasAssertions');

var _CanvasAssertions2 = _interopRequireDefault(_CanvasAssertions);

var _custom_asserts = require('./custom_asserts');

describe("to-dom-coords", function () {

  cleanupAfterEach();
  useProxyCanvas(utils, _Proxy2['default']);

  // Checks that toDomCoords and toDataCoords are inverses of one another.
  var checkForInverses = function checkForInverses(g) {
    var x_range = g.xAxisRange();
    var y_range = g.yAxisRange();
    for (var i = 0; i <= 10; i++) {
      var x = x_range[0] + i / 10.0 * (x_range[1] - x_range[0]);
      for (var j = 0; j <= 10; j++) {
        var y = y_range[0] + j / 10.0 * (y_range[1] - y_range[0]);
        assert.equal(x, g.toDataXCoord(g.toDomXCoord(x)));
        assert.equal(y, g.toDataYCoord(g.toDomYCoord(y)));
      }
    }
  };

  it('testPlainChart', function () {
    var opts = {
      axes: {
        x: {
          drawAxis: false,
          drawGrid: false
        },
        y: {
          drawAxis: false,
          drawGrid: false
        }
      },
      rightGap: 0,
      valueRange: [0, 100],
      dateWindow: [0, 100],
      width: 400,
      height: 400,
      colors: ['#ff0000'],
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[0, 0], [100, 100]], opts);

    assert.deepEqual([0, 100], g.toDataCoords(0, 0));
    assert.deepEqual([0, 0], g.toDataCoords(0, 400));
    assert.deepEqual([100, 100], g.toDataCoords(400, 0));
    assert.deepEqual([100, 0], g.toDataCoords(400, 400));

    checkForInverses(g);

    // TODO(konigsberg): This doesn't really belong here. Move to its own test.
    var htx = g.hidden_ctx_;
    assert.equal(1, _CanvasAssertions2['default'].numLinesDrawn(htx, '#ff0000'));
  });

  it('testChartWithAxes', function () {
    var opts = {
      axes: {
        x: {
          drawGrid: false,
          drawAxis: true
        },
        y: {
          drawGrid: false,
          drawAxis: true,
          axisLabelWidth: 100
        }
      },
      xAxisHeight: 50,
      axisTickSize: 0,
      rightGap: 0,
      valueRange: [0, 100],
      dateWindow: [0, 100],
      width: 500,
      height: 450,
      colors: ['#ff0000'],
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[0, 0], [100, 100]], opts);

    assert.deepEqual([0, 100], g.toDataCoords(100, 0));
    assert.deepEqual([0, 0], g.toDataCoords(100, 400));
    assert.deepEqual([100, 100], g.toDataCoords(500, 0));
    assert.deepEqual([100, 0], g.toDataCoords(500, 400));

    checkForInverses(g);
  });

  it('testChartWithAxesAndLabels', function () {
    var opts = {
      axes: {
        x: {
          drawGrid: false,
          drawAxis: true
        },
        y: {
          drawGrid: false,
          drawAxis: true,
          axisLabelWidth: 100
        }
      },
      xAxisHeight: 50,
      axisTickSize: 0,
      rightGap: 0,
      valueRange: [0, 100],
      dateWindow: [0, 100],
      width: 500,
      height: 500,
      colors: ['#ff0000'],
      ylabel: 'This is the y-axis',
      xlabel: 'This is the x-axis',
      xLabelHeight: 25,
      title: 'This is the title of the chart',
      titleHeight: 25,
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[0, 0], [100, 100]], opts);

    assert.deepEqual([0, 100], g.toDataCoords(100, 25));
    assert.deepEqual([0, 0], g.toDataCoords(100, 425));
    assert.deepEqual([100, 100], g.toDataCoords(500, 25));
    assert.deepEqual([100, 0], g.toDataCoords(500, 425));

    checkForInverses(g);
  });

  it('testYAxisLabelWidth', function () {
    var opts = {
      axes: { y: { axisLabelWidth: 100 } },
      axisTickSize: 0,
      rightGap: 0,
      valueRange: [0, 100],
      dateWindow: [0, 100],
      width: 500,
      height: 500,
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[0, 0], [100, 100]], opts);

    assert.deepEqual([100, 0], g.toDomCoords(0, 100));
    assert.deepEqual([500, 486], g.toDomCoords(100, 0));

    g.updateOptions({
      axes: { y: { axisLabelWidth: 50 } }
    });
    assert.deepEqual([50, 0], g.toDomCoords(0, 100));
    assert.deepEqual([500, 486], g.toDomCoords(100, 0));
  });

  it('testAxisTickSize', function () {
    var opts = {
      axes: { y: { axisLabelWidth: 100 } },
      axisTickSize: 0,
      rightGap: 0,
      valueRange: [0, 100],
      dateWindow: [0, 100],
      width: 500,
      height: 500,
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[0, 0], [100, 100]], opts);

    assert.deepEqual([100, 0], g.toDomCoords(0, 100));
    assert.deepEqual([500, 486], g.toDomCoords(100, 0));

    g.updateOptions({ axisTickSize: 50 });
    assert.deepEqual([200, 0], g.toDomCoords(0, 100));
    assert.deepEqual([500, 386], g.toDomCoords(100, 0));
  });

  it('testChartLogarithmic_YAxis', function () {
    var opts = {
      rightGap: 0,
      valueRange: [1, 4],
      dateWindow: [0, 10],
      width: 400,
      height: 400,
      colors: ['#ff0000'],
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false
        },
        y: {
          drawGrid: false,
          drawAxis: false,
          logscale: true
        }
      },
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[1, 1], [4, 4]], opts);

    var epsilon = 1e-8;
    (0, _custom_asserts.assertDeepCloseTo)([0, 4], g.toDataCoords(0, 0), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([0, 1], g.toDataCoords(0, 400), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([10, 4], g.toDataCoords(400, 0), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([10, 1], g.toDataCoords(400, 400), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([10, 2], g.toDataCoords(400, 200), epsilon);

    assert.deepEqual([0, 0], g.toDomCoords(0, 4));
    assert.deepEqual([0, 400], g.toDomCoords(0, 1));
    assert.deepEqual([400, 0], g.toDomCoords(10, 4));
    assert.deepEqual([400, 400], g.toDomCoords(10, 1));
    assert.deepEqual([400, 200], g.toDomCoords(10, 2));

    // Verify that the margins are adjusted appropriately for yRangePad.
    g.updateOptions({ yRangePad: 40 });
    (0, _custom_asserts.assertDeepCloseTo)([0, 4], g.toDataCoords(0, 40), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([0, 1], g.toDataCoords(0, 360), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([10, 4], g.toDataCoords(400, 40), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([10, 1], g.toDataCoords(400, 360), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([10, 2], g.toDataCoords(400, 200), epsilon);

    (0, _custom_asserts.assertDeepCloseTo)([0, 40], g.toDomCoords(0, 4), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([0, 360], g.toDomCoords(0, 1), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([400, 40], g.toDomCoords(10, 4), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([400, 360], g.toDomCoords(10, 1), epsilon);
    (0, _custom_asserts.assertDeepCloseTo)([400, 200], g.toDomCoords(10, 2), epsilon);
  });

  it('testChartLogarithmic_XAxis', function () {
    var opts = {
      rightGap: 0,
      valueRange: [1, 1000],
      dateWindow: [1, 1000],
      width: 400,
      height: 400,
      colors: ['#ff0000'],
      axes: {
        x: {
          drawGrid: false,
          drawAxis: false,
          logscale: true
        },
        y: {
          drawGrid: false,
          drawAxis: false
        }
      },
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, [[1, 1], [10, 10], [100, 100], [1000, 1000]], opts);

    var epsilon = 1e-8;
    assert.closeTo(1, g.toDataXCoord(0), epsilon);
    assert.closeTo(5.623413251903489, g.toDataXCoord(100), epsilon);
    assert.closeTo(31.62277660168378, g.toDataXCoord(200), epsilon);
    assert.closeTo(177.8279410038921, g.toDataXCoord(300), epsilon);
    assert.closeTo(1000, g.toDataXCoord(400), epsilon);

    assert.closeTo(0, g.toDomXCoord(1), epsilon);
    assert.closeTo(3.6036036036036037, g.toDomXCoord(10), epsilon);
    assert.closeTo(39.63963963963964, g.toDomXCoord(100), epsilon);
    assert.closeTo(400, g.toDomXCoord(1000), epsilon);

    assert.closeTo(0, g.toPercentXCoord(1), epsilon);
    assert.closeTo(0.3333333333, g.toPercentXCoord(10), epsilon);
    assert.closeTo(0.6666666666, g.toPercentXCoord(100), epsilon);
    assert.closeTo(1, g.toPercentXCoord(1000), epsilon);

    // Now zoom in and ensure that the methods return reasonable values.
    g.updateOptions({ dateWindow: [10, 100] });

    assert.closeTo(10, g.toDataXCoord(0), epsilon);
    assert.closeTo(17.78279410038923, g.toDataXCoord(100), epsilon);
    assert.closeTo(31.62277660168379, g.toDataXCoord(200), epsilon);
    assert.closeTo(56.23413251903491, g.toDataXCoord(300), epsilon);
    assert.closeTo(100, g.toDataXCoord(400), epsilon);

    assert.closeTo(-40, g.toDomXCoord(1), epsilon);
    assert.closeTo(0, g.toDomXCoord(10), epsilon);
    assert.closeTo(400, g.toDomXCoord(100), epsilon);
    assert.closeTo(4400, g.toDomXCoord(1000), epsilon);

    assert.closeTo(-1, g.toPercentXCoord(1), epsilon);
    assert.closeTo(0, g.toPercentXCoord(10), epsilon);
    assert.closeTo(1, g.toPercentXCoord(100), epsilon);
    assert.closeTo(2, g.toPercentXCoord(1000), epsilon);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-utils":138,"./CanvasAssertions":1,"./Proxy":4,"./custom_asserts":11}],52:[function(require,module,exports){
/**
 * @fileoverview Test to check that years < 100 get the correct ticks.
 *
 * @author gmadrid@gmail.com (George Madrid)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _srcDygraphTickers = require('../../src/dygraph-tickers');

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

var _srcDygraphDefaultAttrs = require('../../src/dygraph-default-attrs');

var _srcDygraphDefaultAttrs2 = _interopRequireDefault(_srcDygraphDefaultAttrs);

describe("two-digit-years", function () {

  it('testTwoDigitYears', function () {
    // A date with a one digit year: '9 AD'.
    var start = new Date(9, 2, 3);
    // A date with a two digit year: '11 AD'.
    var end = new Date(11, 3, 5);

    // Javascript will automatically add 1900 to our years if they are < 100.
    // Use setFullYear() to get the actual years we desire.
    start.setFullYear(9);
    end.setFullYear(11);

    var ticks = (0, _srcDygraphTickers.getDateAxis)(start, end, _srcDygraphTickers.Granularity.QUARTERLY, function (x) {
      return _srcDygraphDefaultAttrs2['default'].axes['x'][x];
    });

    // This breaks in Firefox & Safari:
    // assert.deepEqual([{"v":-61875345600000,"label":"Apr 9"},{"v":-61867483200000,"label":"Jul 9"},{"v":-61859534400000,"label":"Oct 9"},{"v":-61851582000000,"label":"Jan 10"},{"v":-61843809600000,"label":"Apr 10"},{"v":-61835947200000,"label":"Jul 10"},{"v":-61827998400000,"label":"Oct 10"},{"v":-61820046000000,"label":"Jan 11"},{"v":-61812273600000,"label":"Apr 11"}], ticks);
  });
});

},{"../../src/dygraph":139,"../../src/dygraph-default-attrs":131,"../../src/dygraph-tickers":137,"../../src/dygraph-utils":138}],53:[function(require,module,exports){
// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Tests for the updateOptions function.
 * @author antrob@google.com (Anthony Robledo)
 */

"use strict";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

describe("update-options", function () {

  cleanupAfterEach();

  var opts = {
    width: 480,
    height: 320
  };

  var data = "X,Y1,Y2\n" + "2011-01-01,2,3\n" + "2011-02-02,5,3\n" + "2011-03-03,6,1\n" + "2011-04-04,9,5\n" + "2011-05-05,8,3\n";

  /*
   * Tweaks the dygraph so it sets g._testDrawCalled to true when internal method
   * drawGraph_ is called. Call unWrapDrawGraph when done with this.
   */
  var wrapDrawGraph = function wrapDrawGraph(g) {
    g._testDrawCalled = false;
    g._oldDrawGraph = g.drawGraph_;
    g.drawGraph_ = function () {
      g._testDrawCalled = true;
      g._oldDrawGraph.call(g);
    };
  };

  /*
   * See wrapDrawGraph
   */
  var unwrapDrawGraph = function unwrapDrawGraph(g) {
    g.drawGraph_ = g._oldDrawGraph;
  };

  it('testStrokeAll', function () {
    var graphDiv = document.getElementById("graph");
    var graph = new _srcDygraph2["default"](graphDiv, data, opts);
    var updatedOptions = {};

    updatedOptions['strokeWidth'] = 3;

    // These options will allow us to jump to renderGraph_()
    // drawGraph_() will be skipped.
    wrapDrawGraph(graph);
    graph.updateOptions(updatedOptions);
    unwrapDrawGraph(graph);
    assert.isFalse(graph._testDrawCalled);
  });

  it('testStrokeSingleSeries', function () {
    var graphDiv = document.getElementById("graph");
    var graph = new _srcDygraph2["default"](graphDiv, data, opts);
    var updatedOptions = {};
    var optionsForY1 = {};

    optionsForY1['strokeWidth'] = 3;
    updatedOptions['series'] = { 'Y1': optionsForY1 };

    // These options will allow us to jump to renderGraph_()
    // drawGraph_() will be skipped.
    wrapDrawGraph(graph);
    graph.updateOptions(updatedOptions);
    unwrapDrawGraph(graph);
    assert.isFalse(graph._testDrawCalled);
  });

  it('testSingleSeriesRequiresNewPoints', function () {
    var graphDiv = document.getElementById("graph");
    var graph = new _srcDygraph2["default"](graphDiv, data, opts);
    var updatedOptions = {
      series: {
        Y1: {
          strokeWidth: 2
        },
        Y2: {
          stepPlot: true
        }
      }
    };

    // These options will not allow us to jump to renderGraph_()
    // drawGraph_() must be called
    wrapDrawGraph(graph);
    graph.updateOptions(updatedOptions);
    unwrapDrawGraph(graph);
    assert.isTrue(graph._testDrawCalled);
  });

  it('testWidthChangeNeedsNewPoints', function () {
    var graphDiv = document.getElementById("graph");
    var graph = new _srcDygraph2["default"](graphDiv, data, opts);
    var updatedOptions = {};

    // This will require new points.
    updatedOptions['width'] = 600;

    // These options will not allow us to jump to renderGraph_()
    // drawGraph_() must be called
    wrapDrawGraph(graph);
    graph.updateOptions(updatedOptions);
    unwrapDrawGraph(graph);
    assert.isTrue(graph._testDrawCalled);
  });

  // Test https://github.com/danvk/dygraphs/issues/87
  it('testUpdateLabelsDivDoesntInfiniteLoop', function () {
    var graphDiv = document.getElementById("graph");
    var labelsDiv = document.getElementById("labels");
    var graph = new _srcDygraph2["default"](graphDiv, data, opts);
    graph.updateOptions({ labelsDiv: labelsDiv });
  });

  // Test https://github.com/danvk/dygraphs/issues/247
  it('testUpdateColors', function () {
    var graphDiv = document.getElementById("graph");
    var graph = new _srcDygraph2["default"](graphDiv, data, opts);

    var defaultColors = ["rgb(0,128,0)", "rgb(0,0,128)"];
    assert.deepEqual(["rgb(0,128,0)", "rgb(0,0,128)"], graph.getColors());

    var colors1 = ["#aaa", "#bbb"];
    graph.updateOptions({ colors: colors1 });
    assert.deepEqual(colors1, graph.getColors());

    // extra colors are ignored until you add additional data series.
    var colors2 = ["#ddd", "#eee", "#fff"];
    graph.updateOptions({ colors: colors2 });
    assert.deepEqual(["#ddd", "#eee"], graph.getColors());

    graph.updateOptions({ file: "X,Y1,Y2,Y3\n" + "2011-01-01,2,3,4\n" + "2011-02-02,5,3,2\n"
    });
    assert.deepEqual(colors2, graph.getColors());

    graph.updateOptions({ colors: null, file: data });
    assert.deepEqual(defaultColors, graph.getColors());
  });

  // Regression test for http://code.google.com/p/dygraphs/issues/detail?id=249
  // Verifies that setting 'legend: always' via update immediately shows the
  // legend.
  it('testUpdateLegendAlways', function () {
    var graphDiv = document.getElementById("graph");
    var graph = new _srcDygraph2["default"](graphDiv, data, opts);

    var legend = document.getElementsByClassName("dygraph-legend");
    assert.equal(1, legend.length);
    legend = legend[0];
    assert.equal("", legend.innerHTML);

    graph.updateOptions({ legend: 'always' });

    legend = document.getElementsByClassName("dygraph-legend");
    assert.equal(1, legend.length);
    legend = legend[0];
    assert.notEqual(-1, legend.textContent.indexOf("Y1"));
    assert.notEqual(-1, legend.textContent.indexOf("Y2"));
  });
});

},{"../../src/dygraph":139}],54:[function(require,module,exports){
/**
 * @fileoverview Regression test for a bug involving data update while panning.
 *
 * See http://stackoverflow.com/questions/9528173
 *
 * @author dan@dygraphs.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _DygraphOps = require('./DygraphOps');

var _DygraphOps2 = _interopRequireDefault(_DygraphOps);

describe("update-while-panning", function () {

  cleanupAfterEach();

  // This tests the following sequence:
  // 1. Begin dragging a chart (x-panning)
  // 2. Do a data update (updateOptions({file: ...}))
  // 3. Verify that the y-axis is still well-defined.
  it('testUpdateWhilePanning', function () {
    var sinewave = function sinewave(start, limit, step) {
      var data = [];
      for (var x = start; x < limit; x += step) {
        data.push([x, Math.sin(x)]);
      }
      return data;
    };

    var opts = {
      width: 480,
      height: 320,
      valueRange: [-2, 2],
      labels: ['X', 'Y']
    };

    var graph = document.getElementById("graph");

    var g = new _srcDygraph2['default'](graph, sinewave(0, 6, 0.1), opts);
    assert.deepEqual([-2, 2], g.yAxisRange());

    // Start a pan, but don't finish it yet.
    _DygraphOps2['default'].dispatchMouseDown_Point(g, 200, 100, { shiftKey: true });
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 100, 100, { shiftKey: true });
    assert.deepEqual([-2, 2], g.yAxisRange());

    // Now do a data update. y-axis should remain the same.
    g.updateOptions({ file: sinewave(0, 7, 0.1) });
    assert.deepEqual([-2, 2], g.yAxisRange());

    // Keep the pan going.
    _DygraphOps2['default'].dispatchMouseMove_Point(g, 50, 100, { shiftKey: true });
    assert.deepEqual([-2, 2], g.yAxisRange());

    // Now finish the pan.
    _DygraphOps2['default'].dispatchMouseUp_Point(g, 100, 100, { shiftKey: true });
    assert.deepEqual([-2, 2], g.yAxisRange());
  });
});

},{"../../src/dygraph":139,"./DygraphOps":2}],55:[function(require,module,exports){
/** 
 * @fileoverview Tests for stand-alone functions in dygraph-utils.js
 *
 * @author danvdk@gmail.com (Dan Vanderkam)
 */

'use strict';

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _srcDygraphUtils = require('../../src/dygraph-utils');

var utils = _interopRequireWildcard(_srcDygraphUtils);

describe("utils-tests", function () {

  it('testUpdate', function () {
    var a = {
      a: 1,
      b: [1, 2, 3],
      c: { x: 1, y: 2 },
      d: { f: 10, g: 20 }
    };
    assert.equal(1, a['a']);
    assert.deepEqual([1, 2, 3], a['b']);
    assert.deepEqual({ x: 1, y: 2 }, a['c']);
    assert.deepEqual({ f: 10, g: 20 }, a['d']);

    utils.update(a, { c: { x: 2 } });
    assert.deepEqual({ x: 2 }, a['c']);

    utils.update(a, { d: null });
    assert.equal(null, a['d']);

    utils.update(a, { a: 10, b: [1, 2] });
    assert.equal(10, a['a']);
    assert.deepEqual([1, 2], a['b']);
    assert.deepEqual({ x: 2 }, a['c']);
    assert.equal(null, a['d']);
  });

  it('testUpdateDeep', function () {
    var a = {
      a: 1,
      b: [1, 2, 3],
      c: { x: 1, y: 2 },
      d: { f: 10, g: 20 }
    };
    assert.equal(1, a['a']);
    assert.deepEqual([1, 2, 3], a['b']);
    assert.deepEqual({ x: 1, y: 2 }, a['c']);
    assert.deepEqual({ f: 10, g: 20 }, a['d']);

    utils.updateDeep(a, { c: { x: 2 } });
    assert.deepEqual({ x: 2, y: 2 }, a['c']);

    utils.updateDeep(a, { d: null });
    assert.equal(null, a['d']);

    utils.updateDeep(a, { a: 10, b: [1, 2] });
    assert.equal(10, a['a']);
    assert.deepEqual([1, 2], a['b']);
    assert.deepEqual({ x: 2, y: 2 }, a['c']);
    assert.equal(null, a['d']);
  });

  it('testUpdateDeepDecoupled', function () {
    var a = {
      a: 1,
      b: [1, 2, 3],
      c: { x: "original", y: 2 }
    };

    var b = {};
    utils.updateDeep(b, a);

    b.a = 2;
    assert.equal(1, a.a);

    b.b[0] = 2;
    assert.equal(1, a.b[0]);

    b.c.x = "new value";
    assert.equal("original", a.c.x);
  });

  it('testIterator_nopredicate', function () {
    var array = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    var iter = utils.createIterator(array, 1, 4);
    assert.isTrue(iter.hasNext);
    assert.equal('b', iter.peek);
    assert.equal('b', iter.next());
    assert.isTrue(iter.hasNext);

    assert.equal('c', iter.peek);
    assert.equal('c', iter.next());

    assert.isTrue(iter.hasNext);
    assert.equal('d', iter.next());

    assert.isTrue(iter.hasNext);
    assert.equal('e', iter.next());

    assert.isFalse(iter.hasNext);
  });

  it('testIterator_predicate', function () {
    var array = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    var iter = utils.createIterator(array, 1, 4, function (array, idx) {
      return array[idx] !== 'd';
    });
    assert.isTrue(iter.hasNext);
    assert.equal('b', iter.peek);
    assert.equal('b', iter.next());
    assert.isTrue(iter.hasNext);

    assert.equal('c', iter.peek);
    assert.equal('c', iter.next());

    assert.isTrue(iter.hasNext);
    assert.equal('e', iter.next());

    assert.isFalse(iter.hasNext);
  });

  it('testIterator_empty', function () {
    var array = [];
    var iter = utils.createIterator([], 0, 0);
    assert.isFalse(iter.hasNext);
  });

  it('testIterator_outOfRange', function () {
    var array = ['a', 'b', 'c'];
    var iter = utils.createIterator(array, 1, 4, function (array, idx) {
      return array[idx] !== 'd';
    });
    assert.isTrue(iter.hasNext);
    assert.equal('b', iter.peek);
    assert.equal('b', iter.next());
    assert.isTrue(iter.hasNext);

    assert.equal('c', iter.peek);
    assert.equal('c', iter.next());

    assert.isFalse(iter.hasNext);
  });

  // Makes sure full array is tested, and that the predicate isn't called
  // with invalid boundaries.
  it('testIterator_whole_array', function () {
    var array = ['a', 'b', 'c'];
    var iter = utils.createIterator(array, 0, array.length, function (array, idx) {
      if (idx < 0 || idx >= array.length) {
        throw "err";
      } else {
        return true;
      }
    });
    assert.isTrue(iter.hasNext);
    assert.equal('a', iter.next());
    assert.isTrue(iter.hasNext);
    assert.equal('b', iter.next());
    assert.isTrue(iter.hasNext);
    assert.equal('c', iter.next());
    assert.isFalse(iter.hasNext);
    assert.isNull(iter.next());
  });

  it('testIterator_no_args', function () {
    var array = ['a', 'b', 'c'];
    var iter = utils.createIterator(array);
    assert.isTrue(iter.hasNext);
    assert.equal('a', iter.next());
    assert.isTrue(iter.hasNext);
    assert.equal('b', iter.next());
    assert.isTrue(iter.hasNext);
    assert.equal('c', iter.next());
    assert.isFalse(iter.hasNext);
    assert.isNull(iter.next());
  });

  it('testToRGB', function () {
    assert.deepEqual({ r: 255, g: 200, b: 150 }, utils.toRGB_('rgb(255,200,150)'));
    assert.deepEqual({ r: 255, g: 200, b: 150 }, utils.toRGB_('#FFC896'));
    assert.deepEqual({ r: 255, g: 0, b: 0 }, utils.toRGB_('red'));
    assert.deepEqual({ r: 255, g: 200, b: 150, a: 0.6 }, utils.toRGB_('rgba(255, 200, 150, 0.6)'));
  });

  it('testIsPixelChangingOptionList', function () {
    var isPx = utils.isPixelChangingOptionList;
    assert.isTrue(isPx([], { axes: { y: { digitsAfterDecimal: 3 } } }));
    assert.isFalse(isPx([], { axes: { y: { axisLineColor: 'blue' } } }));
  });

  /*
  it('testDateSet', function() {
    var base = new Date(1383455100000);
    var d = new Date(base);
  
    // A one hour shift -- this is surprising behavior!
    d.setMilliseconds(10);
    assert.equal(3600010, d.getTime() - base.getTime());
  
    // setDateSameTZ compensates for this surprise.
    d = new Date(base);
    Dygraph.setDateSameTZ(d, {ms: 10});
    assert.equal(10, d.getTime() - base.getTime());
  });
  */
});

},{"../../src/dygraph-utils":138}],56:[function(require,module,exports){
/**
 * @fileoverview Tests for the setVisibility function.
 * @author sergeyslepian@gmail.com
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

describe("visibility", function () {

  cleanupAfterEach();

  /**
   * Does a bunch of the shared busywork of setting up a graph and changing its visibility.
   * @param {boolean} startingVisibility The starting visibility of all series on the graph
   * @param {*[]} setVisibilityArgs An array of arguments to be passed directly to setVisibility()
   * @returns {string} The output of Util.getLegend() called after the visibility is set
   */
  var getVisibleSeries = function getVisibleSeries(startingVisibility, setVisibilityArgs) {
    var opts = {
      width: 480,
      height: 320,
      labels: ['x', 'A', 'B', 'C', 'D', 'E'],
      legend: 'always',
      visibility: []
    };

    // set the starting visibility
    var numSeries = opts.labels.length - 1;
    for (var i = 0; i < numSeries; i++) {
      opts.visibility[i] = startingVisibility;
    }

    var data = [];
    for (var j = 0; j < 10; j++) {
      data.push([j, 1, 2, 3, 4, 5]);
    }

    var graph = document.getElementById("graph");
    var g = new _srcDygraph2['default'](graph, data, opts);

    g.setVisibility.apply(g, setVisibilityArgs);

    return _Util2['default'].getLegend();
  };

  it('testDefaultCases', function () {
    assert.equal(' A  B  C  D  E', getVisibleSeries(true, [[], true]));
    assert.equal('', getVisibleSeries(false, [[], true]));
  });

  it('testSingleSeriesHide', function () {
    assert.equal(' A  C  D  E', getVisibleSeries(true, [1, false]));
  });

  it('testSingleSeriesShow', function () {
    assert.equal(' E', getVisibleSeries(false, [4, true]));
  });

  it('testMultiSeriesHide', function () {
    assert.equal(' A  E', getVisibleSeries(true, [[1, 2, 3], false]));
  });

  it('testMultiSeriesShow', function () {
    assert.equal(' B  D', getVisibleSeries(false, [[1, 3], true]));
  });

  it('testObjectSeriesShowAndHide', function () {
    assert.equal(' B  D', getVisibleSeries(false, [{ 1: true, 2: false, 3: true }, null]));
  });

  it('testBooleanArraySeriesShowAndHide', function () {
    assert.equal(' B  D', getVisibleSeries(false, [[false, true, false, true], null]));
  });
});

},{"../../src/dygraph":139,"./Util":5}],57:[function(require,module,exports){
/**
 * @fileoverview Tests involving issuing XHRs for data.
 *
 * Note that these tests must be run with an HTTP server.
 * XHRs can't be issued from file:/// URLs.
 * This can be done with
 *
 *     npm install http-server
 *     http-server
 *     open http://localhost:8080/auto_tests/runner.html
 *
 */

'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _srcDygraph = require('../../src/dygraph');

var _srcDygraph2 = _interopRequireDefault(_srcDygraph);

var _Util = require('./Util');

var _Util2 = _interopRequireDefault(_Util);

require('core-js/es6/promise');

function dygraphPromise(div, data, opts) {
  return new Promise(function (resolve, reject) {
    var g = new _srcDygraph2['default'](div, data, opts);
    g.ready(function () {
      return resolve(g);
    });
  });
}

describe("xhr", function () {

  it('should issue XHRs for CSV data', function () {
    return dygraphPromise('graph', 'data/sample.csv').then(function (g) {
      assert.isNotNull(g);
      assert.equal(g.numRows(), 4);
      assert.equal(g.numColumns(), 3);
    });
  });

  it('should warn on out-of-order CSV data', function () {
    var calls = {};
    var restore = _Util2['default'].captureConsole(calls);
    return dygraphPromise('graph', 'data/out-of-order.csv').then(function (g) {
      restore();
      assert.isNotNull(g);
      assert.equal(g.numRows(), 4);
      assert.equal(g.numColumns(), 3);
      assert.equal(calls.warn.length, 1);
      assert(/out of order/.exec(calls.warn[0]));
    }, function (e) {
      restore();
      return Promise.reject(e);
    });
  });

  it('should warn on out-of-order CSV data with dates', function () {
    var calls = {};
    var restore = _Util2['default'].captureConsole(calls);
    return dygraphPromise('graph', 'data/out-of-order-dates.csv').then(function (g) {
      restore();
      assert.isNotNull(g);
      assert.equal(g.numRows(), 8);
      assert.equal(g.numColumns(), 5);
      assert.equal(calls.warn.length, 1);
      assert(/out of order/.exec(calls.warn[0]));
    }, function (e) {
      restore();
      return Promise.reject(e);
    });
  });
});

},{"../../src/dygraph":139,"./Util":5,"core-js/es6/promise":58}],58:[function(require,module,exports){
require('../modules/es6.object.to-string');
require('../modules/es6.string.iterator');
require('../modules/web.dom.iterable');
require('../modules/es6.promise');
module.exports = require('../modules/_core').Promise;
},{"../modules/_core":66,"../modules/es6.object.to-string":118,"../modules/es6.promise":119,"../modules/es6.string.iterator":120,"../modules/web.dom.iterable":121}],59:[function(require,module,exports){
module.exports = function(it){
  if(typeof it != 'function')throw TypeError(it + ' is not a function!');
  return it;
};
},{}],60:[function(require,module,exports){
// 22.1.3.31 Array.prototype[@@unscopables]
var UNSCOPABLES = require('./_wks')('unscopables')
  , ArrayProto  = Array.prototype;
if(ArrayProto[UNSCOPABLES] == undefined)require('./_hide')(ArrayProto, UNSCOPABLES, {});
module.exports = function(key){
  ArrayProto[UNSCOPABLES][key] = true;
};
},{"./_hide":77,"./_wks":115}],61:[function(require,module,exports){
module.exports = function(it, Constructor, name, forbiddenField){
  if(!(it instanceof Constructor) || (forbiddenField !== undefined && forbiddenField in it)){
    throw TypeError(name + ': incorrect invocation!');
  } return it;
};
},{}],62:[function(require,module,exports){
var isObject = require('./_is-object');
module.exports = function(it){
  if(!isObject(it))throw TypeError(it + ' is not an object!');
  return it;
};
},{"./_is-object":83}],63:[function(require,module,exports){
// false -> Array#indexOf
// true  -> Array#includes
var toIObject = require('./_to-iobject')
  , toLength  = require('./_to-length')
  , toIndex   = require('./_to-index');
module.exports = function(IS_INCLUDES){
  return function($this, el, fromIndex){
    var O      = toIObject($this)
      , length = toLength(O.length)
      , index  = toIndex(fromIndex, length)
      , value;
    // Array#includes uses SameValueZero equality algorithm
    if(IS_INCLUDES && el != el)while(length > index){
      value = O[index++];
      if(value != value)return true;
    // Array#toIndex ignores holes, Array#includes - not
    } else for(;length > index; index++)if(IS_INCLUDES || index in O){
      if(O[index] === el)return IS_INCLUDES || index || 0;
    } return !IS_INCLUDES && -1;
  };
};
},{"./_to-index":108,"./_to-iobject":110,"./_to-length":111}],64:[function(require,module,exports){
// getting tag from 19.1.3.6 Object.prototype.toString()
var cof = require('./_cof')
  , TAG = require('./_wks')('toStringTag')
  // ES3 wrong here
  , ARG = cof(function(){ return arguments; }()) == 'Arguments';

// fallback for IE11 Script Access Denied error
var tryGet = function(it, key){
  try {
    return it[key];
  } catch(e){ /* empty */ }
};

module.exports = function(it){
  var O, T, B;
  return it === undefined ? 'Undefined' : it === null ? 'Null'
    // @@toStringTag case
    : typeof (T = tryGet(O = Object(it), TAG)) == 'string' ? T
    // builtinTag case
    : ARG ? cof(O)
    // ES3 arguments fallback
    : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
};
},{"./_cof":65,"./_wks":115}],65:[function(require,module,exports){
var toString = {}.toString;

module.exports = function(it){
  return toString.call(it).slice(8, -1);
};
},{}],66:[function(require,module,exports){
var core = module.exports = {version: '2.4.0'};
if(typeof __e == 'number')__e = core; // eslint-disable-line no-undef
},{}],67:[function(require,module,exports){
// optional / simple context binding
var aFunction = require('./_a-function');
module.exports = function(fn, that, length){
  aFunction(fn);
  if(that === undefined)return fn;
  switch(length){
    case 1: return function(a){
      return fn.call(that, a);
    };
    case 2: return function(a, b){
      return fn.call(that, a, b);
    };
    case 3: return function(a, b, c){
      return fn.call(that, a, b, c);
    };
  }
  return function(/* ...args */){
    return fn.apply(that, arguments);
  };
};
},{"./_a-function":59}],68:[function(require,module,exports){
// 7.2.1 RequireObjectCoercible(argument)
module.exports = function(it){
  if(it == undefined)throw TypeError("Can't call method on  " + it);
  return it;
};
},{}],69:[function(require,module,exports){
// Thank's IE8 for his funny defineProperty
module.exports = !require('./_fails')(function(){
  return Object.defineProperty({}, 'a', {get: function(){ return 7; }}).a != 7;
});
},{"./_fails":73}],70:[function(require,module,exports){
var isObject = require('./_is-object')
  , document = require('./_global').document
  // in old IE typeof document.createElement is 'object'
  , is = isObject(document) && isObject(document.createElement);
module.exports = function(it){
  return is ? document.createElement(it) : {};
};
},{"./_global":75,"./_is-object":83}],71:[function(require,module,exports){
// IE 8- don't enum bug keys
module.exports = (
  'constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'
).split(',');
},{}],72:[function(require,module,exports){
var global    = require('./_global')
  , core      = require('./_core')
  , hide      = require('./_hide')
  , redefine  = require('./_redefine')
  , ctx       = require('./_ctx')
  , PROTOTYPE = 'prototype';

var $export = function(type, name, source){
  var IS_FORCED = type & $export.F
    , IS_GLOBAL = type & $export.G
    , IS_STATIC = type & $export.S
    , IS_PROTO  = type & $export.P
    , IS_BIND   = type & $export.B
    , target    = IS_GLOBAL ? global : IS_STATIC ? global[name] || (global[name] = {}) : (global[name] || {})[PROTOTYPE]
    , exports   = IS_GLOBAL ? core : core[name] || (core[name] = {})
    , expProto  = exports[PROTOTYPE] || (exports[PROTOTYPE] = {})
    , key, own, out, exp;
  if(IS_GLOBAL)source = name;
  for(key in source){
    // contains in native
    own = !IS_FORCED && target && target[key] !== undefined;
    // export native or passed
    out = (own ? target : source)[key];
    // bind timers to global for call from export context
    exp = IS_BIND && own ? ctx(out, global) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
    // extend global
    if(target)redefine(target, key, out, type & $export.U);
    // export
    if(exports[key] != out)hide(exports, key, exp);
    if(IS_PROTO && expProto[key] != out)expProto[key] = out;
  }
};
global.core = core;
// type bitmap
$export.F = 1;   // forced
$export.G = 2;   // global
$export.S = 4;   // static
$export.P = 8;   // proto
$export.B = 16;  // bind
$export.W = 32;  // wrap
$export.U = 64;  // safe
$export.R = 128; // real proto method for `library` 
module.exports = $export;
},{"./_core":66,"./_ctx":67,"./_global":75,"./_hide":77,"./_redefine":100}],73:[function(require,module,exports){
module.exports = function(exec){
  try {
    return !!exec();
  } catch(e){
    return true;
  }
};
},{}],74:[function(require,module,exports){
var ctx         = require('./_ctx')
  , call        = require('./_iter-call')
  , isArrayIter = require('./_is-array-iter')
  , anObject    = require('./_an-object')
  , toLength    = require('./_to-length')
  , getIterFn   = require('./core.get-iterator-method')
  , BREAK       = {}
  , RETURN      = {};
var exports = module.exports = function(iterable, entries, fn, that, ITERATOR){
  var iterFn = ITERATOR ? function(){ return iterable; } : getIterFn(iterable)
    , f      = ctx(fn, that, entries ? 2 : 1)
    , index  = 0
    , length, step, iterator, result;
  if(typeof iterFn != 'function')throw TypeError(iterable + ' is not iterable!');
  // fast case for arrays with default iterator
  if(isArrayIter(iterFn))for(length = toLength(iterable.length); length > index; index++){
    result = entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
    if(result === BREAK || result === RETURN)return result;
  } else for(iterator = iterFn.call(iterable); !(step = iterator.next()).done; ){
    result = call(iterator, f, step.value, entries);
    if(result === BREAK || result === RETURN)return result;
  }
};
exports.BREAK  = BREAK;
exports.RETURN = RETURN;
},{"./_an-object":62,"./_ctx":67,"./_is-array-iter":82,"./_iter-call":84,"./_to-length":111,"./core.get-iterator-method":116}],75:[function(require,module,exports){
// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var global = module.exports = typeof window != 'undefined' && window.Math == Math
  ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
if(typeof __g == 'number')__g = global; // eslint-disable-line no-undef
},{}],76:[function(require,module,exports){
var hasOwnProperty = {}.hasOwnProperty;
module.exports = function(it, key){
  return hasOwnProperty.call(it, key);
};
},{}],77:[function(require,module,exports){
var dP         = require('./_object-dp')
  , createDesc = require('./_property-desc');
module.exports = require('./_descriptors') ? function(object, key, value){
  return dP.f(object, key, createDesc(1, value));
} : function(object, key, value){
  object[key] = value;
  return object;
};
},{"./_descriptors":69,"./_object-dp":93,"./_property-desc":98}],78:[function(require,module,exports){
module.exports = require('./_global').document && document.documentElement;
},{"./_global":75}],79:[function(require,module,exports){
module.exports = !require('./_descriptors') && !require('./_fails')(function(){
  return Object.defineProperty(require('./_dom-create')('div'), 'a', {get: function(){ return 7; }}).a != 7;
});
},{"./_descriptors":69,"./_dom-create":70,"./_fails":73}],80:[function(require,module,exports){
// fast apply, http://jsperf.lnkit.com/fast-apply/5
module.exports = function(fn, args, that){
  var un = that === undefined;
  switch(args.length){
    case 0: return un ? fn()
                      : fn.call(that);
    case 1: return un ? fn(args[0])
                      : fn.call(that, args[0]);
    case 2: return un ? fn(args[0], args[1])
                      : fn.call(that, args[0], args[1]);
    case 3: return un ? fn(args[0], args[1], args[2])
                      : fn.call(that, args[0], args[1], args[2]);
    case 4: return un ? fn(args[0], args[1], args[2], args[3])
                      : fn.call(that, args[0], args[1], args[2], args[3]);
  } return              fn.apply(that, args);
};
},{}],81:[function(require,module,exports){
// fallback for non-array-like ES3 and non-enumerable old V8 strings
var cof = require('./_cof');
module.exports = Object('z').propertyIsEnumerable(0) ? Object : function(it){
  return cof(it) == 'String' ? it.split('') : Object(it);
};
},{"./_cof":65}],82:[function(require,module,exports){
// check on default Array iterator
var Iterators  = require('./_iterators')
  , ITERATOR   = require('./_wks')('iterator')
  , ArrayProto = Array.prototype;

module.exports = function(it){
  return it !== undefined && (Iterators.Array === it || ArrayProto[ITERATOR] === it);
};
},{"./_iterators":89,"./_wks":115}],83:[function(require,module,exports){
module.exports = function(it){
  return typeof it === 'object' ? it !== null : typeof it === 'function';
};
},{}],84:[function(require,module,exports){
// call something on iterator step with safe closing on error
var anObject = require('./_an-object');
module.exports = function(iterator, fn, value, entries){
  try {
    return entries ? fn(anObject(value)[0], value[1]) : fn(value);
  // 7.4.6 IteratorClose(iterator, completion)
  } catch(e){
    var ret = iterator['return'];
    if(ret !== undefined)anObject(ret.call(iterator));
    throw e;
  }
};
},{"./_an-object":62}],85:[function(require,module,exports){
'use strict';
var create         = require('./_object-create')
  , descriptor     = require('./_property-desc')
  , setToStringTag = require('./_set-to-string-tag')
  , IteratorPrototype = {};

// 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
require('./_hide')(IteratorPrototype, require('./_wks')('iterator'), function(){ return this; });

module.exports = function(Constructor, NAME, next){
  Constructor.prototype = create(IteratorPrototype, {next: descriptor(1, next)});
  setToStringTag(Constructor, NAME + ' Iterator');
};
},{"./_hide":77,"./_object-create":92,"./_property-desc":98,"./_set-to-string-tag":102,"./_wks":115}],86:[function(require,module,exports){
'use strict';
var LIBRARY        = require('./_library')
  , $export        = require('./_export')
  , redefine       = require('./_redefine')
  , hide           = require('./_hide')
  , has            = require('./_has')
  , Iterators      = require('./_iterators')
  , $iterCreate    = require('./_iter-create')
  , setToStringTag = require('./_set-to-string-tag')
  , getPrototypeOf = require('./_object-gpo')
  , ITERATOR       = require('./_wks')('iterator')
  , BUGGY          = !([].keys && 'next' in [].keys()) // Safari has buggy iterators w/o `next`
  , FF_ITERATOR    = '@@iterator'
  , KEYS           = 'keys'
  , VALUES         = 'values';

var returnThis = function(){ return this; };

module.exports = function(Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED){
  $iterCreate(Constructor, NAME, next);
  var getMethod = function(kind){
    if(!BUGGY && kind in proto)return proto[kind];
    switch(kind){
      case KEYS: return function keys(){ return new Constructor(this, kind); };
      case VALUES: return function values(){ return new Constructor(this, kind); };
    } return function entries(){ return new Constructor(this, kind); };
  };
  var TAG        = NAME + ' Iterator'
    , DEF_VALUES = DEFAULT == VALUES
    , VALUES_BUG = false
    , proto      = Base.prototype
    , $native    = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT]
    , $default   = $native || getMethod(DEFAULT)
    , $entries   = DEFAULT ? !DEF_VALUES ? $default : getMethod('entries') : undefined
    , $anyNative = NAME == 'Array' ? proto.entries || $native : $native
    , methods, key, IteratorPrototype;
  // Fix native
  if($anyNative){
    IteratorPrototype = getPrototypeOf($anyNative.call(new Base));
    if(IteratorPrototype !== Object.prototype){
      // Set @@toStringTag to native iterators
      setToStringTag(IteratorPrototype, TAG, true);
      // fix for some old engines
      if(!LIBRARY && !has(IteratorPrototype, ITERATOR))hide(IteratorPrototype, ITERATOR, returnThis);
    }
  }
  // fix Array#{values, @@iterator}.name in V8 / FF
  if(DEF_VALUES && $native && $native.name !== VALUES){
    VALUES_BUG = true;
    $default = function values(){ return $native.call(this); };
  }
  // Define iterator
  if((!LIBRARY || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])){
    hide(proto, ITERATOR, $default);
  }
  // Plug for library
  Iterators[NAME] = $default;
  Iterators[TAG]  = returnThis;
  if(DEFAULT){
    methods = {
      values:  DEF_VALUES ? $default : getMethod(VALUES),
      keys:    IS_SET     ? $default : getMethod(KEYS),
      entries: $entries
    };
    if(FORCED)for(key in methods){
      if(!(key in proto))redefine(proto, key, methods[key]);
    } else $export($export.P + $export.F * (BUGGY || VALUES_BUG), NAME, methods);
  }
  return methods;
};
},{"./_export":72,"./_has":76,"./_hide":77,"./_iter-create":85,"./_iterators":89,"./_library":90,"./_object-gpo":95,"./_redefine":100,"./_set-to-string-tag":102,"./_wks":115}],87:[function(require,module,exports){
var ITERATOR     = require('./_wks')('iterator')
  , SAFE_CLOSING = false;

try {
  var riter = [7][ITERATOR]();
  riter['return'] = function(){ SAFE_CLOSING = true; };
  Array.from(riter, function(){ throw 2; });
} catch(e){ /* empty */ }

module.exports = function(exec, skipClosing){
  if(!skipClosing && !SAFE_CLOSING)return false;
  var safe = false;
  try {
    var arr  = [7]
      , iter = arr[ITERATOR]();
    iter.next = function(){ return {done: safe = true}; };
    arr[ITERATOR] = function(){ return iter; };
    exec(arr);
  } catch(e){ /* empty */ }
  return safe;
};
},{"./_wks":115}],88:[function(require,module,exports){
module.exports = function(done, value){
  return {value: value, done: !!done};
};
},{}],89:[function(require,module,exports){
module.exports = {};
},{}],90:[function(require,module,exports){
module.exports = false;
},{}],91:[function(require,module,exports){
var global    = require('./_global')
  , macrotask = require('./_task').set
  , Observer  = global.MutationObserver || global.WebKitMutationObserver
  , process   = global.process
  , Promise   = global.Promise
  , isNode    = require('./_cof')(process) == 'process';

module.exports = function(){
  var head, last, notify;

  var flush = function(){
    var parent, fn;
    if(isNode && (parent = process.domain))parent.exit();
    while(head){
      fn   = head.fn;
      head = head.next;
      try {
        fn();
      } catch(e){
        if(head)notify();
        else last = undefined;
        throw e;
      }
    } last = undefined;
    if(parent)parent.enter();
  };

  // Node.js
  if(isNode){
    notify = function(){
      process.nextTick(flush);
    };
  // browsers with MutationObserver
  } else if(Observer){
    var toggle = true
      , node   = document.createTextNode('');
    new Observer(flush).observe(node, {characterData: true}); // eslint-disable-line no-new
    notify = function(){
      node.data = toggle = !toggle;
    };
  // environments with maybe non-completely correct, but existent Promise
  } else if(Promise && Promise.resolve){
    var promise = Promise.resolve();
    notify = function(){
      promise.then(flush);
    };
  // for other environments - macrotask based on:
  // - setImmediate
  // - MessageChannel
  // - window.postMessag
  // - onreadystatechange
  // - setTimeout
  } else {
    notify = function(){
      // strange IE + webpack dev server bug - use .call(global)
      macrotask.call(global, flush);
    };
  }

  return function(fn){
    var task = {fn: fn, next: undefined};
    if(last)last.next = task;
    if(!head){
      head = task;
      notify();
    } last = task;
  };
};
},{"./_cof":65,"./_global":75,"./_task":107}],92:[function(require,module,exports){
// 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
var anObject    = require('./_an-object')
  , dPs         = require('./_object-dps')
  , enumBugKeys = require('./_enum-bug-keys')
  , IE_PROTO    = require('./_shared-key')('IE_PROTO')
  , Empty       = function(){ /* empty */ }
  , PROTOTYPE   = 'prototype';

// Create object with fake `null` prototype: use iframe Object with cleared prototype
var createDict = function(){
  // Thrash, waste and sodomy: IE GC bug
  var iframe = require('./_dom-create')('iframe')
    , i      = enumBugKeys.length
    , lt     = '<'
    , gt     = '>'
    , iframeDocument;
  iframe.style.display = 'none';
  require('./_html').appendChild(iframe);
  iframe.src = 'javascript:'; // eslint-disable-line no-script-url
  // createDict = iframe.contentWindow.Object;
  // html.removeChild(iframe);
  iframeDocument = iframe.contentWindow.document;
  iframeDocument.open();
  iframeDocument.write(lt + 'script' + gt + 'document.F=Object' + lt + '/script' + gt);
  iframeDocument.close();
  createDict = iframeDocument.F;
  while(i--)delete createDict[PROTOTYPE][enumBugKeys[i]];
  return createDict();
};

module.exports = Object.create || function create(O, Properties){
  var result;
  if(O !== null){
    Empty[PROTOTYPE] = anObject(O);
    result = new Empty;
    Empty[PROTOTYPE] = null;
    // add "__proto__" for Object.getPrototypeOf polyfill
    result[IE_PROTO] = O;
  } else result = createDict();
  return Properties === undefined ? result : dPs(result, Properties);
};

},{"./_an-object":62,"./_dom-create":70,"./_enum-bug-keys":71,"./_html":78,"./_object-dps":94,"./_shared-key":103}],93:[function(require,module,exports){
var anObject       = require('./_an-object')
  , IE8_DOM_DEFINE = require('./_ie8-dom-define')
  , toPrimitive    = require('./_to-primitive')
  , dP             = Object.defineProperty;

exports.f = require('./_descriptors') ? Object.defineProperty : function defineProperty(O, P, Attributes){
  anObject(O);
  P = toPrimitive(P, true);
  anObject(Attributes);
  if(IE8_DOM_DEFINE)try {
    return dP(O, P, Attributes);
  } catch(e){ /* empty */ }
  if('get' in Attributes || 'set' in Attributes)throw TypeError('Accessors not supported!');
  if('value' in Attributes)O[P] = Attributes.value;
  return O;
};
},{"./_an-object":62,"./_descriptors":69,"./_ie8-dom-define":79,"./_to-primitive":113}],94:[function(require,module,exports){
var dP       = require('./_object-dp')
  , anObject = require('./_an-object')
  , getKeys  = require('./_object-keys');

module.exports = require('./_descriptors') ? Object.defineProperties : function defineProperties(O, Properties){
  anObject(O);
  var keys   = getKeys(Properties)
    , length = keys.length
    , i = 0
    , P;
  while(length > i)dP.f(O, P = keys[i++], Properties[P]);
  return O;
};
},{"./_an-object":62,"./_descriptors":69,"./_object-dp":93,"./_object-keys":97}],95:[function(require,module,exports){
// 19.1.2.9 / 15.2.3.2 Object.getPrototypeOf(O)
var has         = require('./_has')
  , toObject    = require('./_to-object')
  , IE_PROTO    = require('./_shared-key')('IE_PROTO')
  , ObjectProto = Object.prototype;

module.exports = Object.getPrototypeOf || function(O){
  O = toObject(O);
  if(has(O, IE_PROTO))return O[IE_PROTO];
  if(typeof O.constructor == 'function' && O instanceof O.constructor){
    return O.constructor.prototype;
  } return O instanceof Object ? ObjectProto : null;
};
},{"./_has":76,"./_shared-key":103,"./_to-object":112}],96:[function(require,module,exports){
var has          = require('./_has')
  , toIObject    = require('./_to-iobject')
  , arrayIndexOf = require('./_array-includes')(false)
  , IE_PROTO     = require('./_shared-key')('IE_PROTO');

module.exports = function(object, names){
  var O      = toIObject(object)
    , i      = 0
    , result = []
    , key;
  for(key in O)if(key != IE_PROTO)has(O, key) && result.push(key);
  // Don't enum bug & hidden keys
  while(names.length > i)if(has(O, key = names[i++])){
    ~arrayIndexOf(result, key) || result.push(key);
  }
  return result;
};
},{"./_array-includes":63,"./_has":76,"./_shared-key":103,"./_to-iobject":110}],97:[function(require,module,exports){
// 19.1.2.14 / 15.2.3.14 Object.keys(O)
var $keys       = require('./_object-keys-internal')
  , enumBugKeys = require('./_enum-bug-keys');

module.exports = Object.keys || function keys(O){
  return $keys(O, enumBugKeys);
};
},{"./_enum-bug-keys":71,"./_object-keys-internal":96}],98:[function(require,module,exports){
module.exports = function(bitmap, value){
  return {
    enumerable  : !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable    : !(bitmap & 4),
    value       : value
  };
};
},{}],99:[function(require,module,exports){
var redefine = require('./_redefine');
module.exports = function(target, src, safe){
  for(var key in src)redefine(target, key, src[key], safe);
  return target;
};
},{"./_redefine":100}],100:[function(require,module,exports){
var global    = require('./_global')
  , hide      = require('./_hide')
  , has       = require('./_has')
  , SRC       = require('./_uid')('src')
  , TO_STRING = 'toString'
  , $toString = Function[TO_STRING]
  , TPL       = ('' + $toString).split(TO_STRING);

require('./_core').inspectSource = function(it){
  return $toString.call(it);
};

(module.exports = function(O, key, val, safe){
  var isFunction = typeof val == 'function';
  if(isFunction)has(val, 'name') || hide(val, 'name', key);
  if(O[key] === val)return;
  if(isFunction)has(val, SRC) || hide(val, SRC, O[key] ? '' + O[key] : TPL.join(String(key)));
  if(O === global){
    O[key] = val;
  } else {
    if(!safe){
      delete O[key];
      hide(O, key, val);
    } else {
      if(O[key])O[key] = val;
      else hide(O, key, val);
    }
  }
// add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
})(Function.prototype, TO_STRING, function toString(){
  return typeof this == 'function' && this[SRC] || $toString.call(this);
});
},{"./_core":66,"./_global":75,"./_has":76,"./_hide":77,"./_uid":114}],101:[function(require,module,exports){
'use strict';
var global      = require('./_global')
  , dP          = require('./_object-dp')
  , DESCRIPTORS = require('./_descriptors')
  , SPECIES     = require('./_wks')('species');

module.exports = function(KEY){
  var C = global[KEY];
  if(DESCRIPTORS && C && !C[SPECIES])dP.f(C, SPECIES, {
    configurable: true,
    get: function(){ return this; }
  });
};
},{"./_descriptors":69,"./_global":75,"./_object-dp":93,"./_wks":115}],102:[function(require,module,exports){
var def = require('./_object-dp').f
  , has = require('./_has')
  , TAG = require('./_wks')('toStringTag');

module.exports = function(it, tag, stat){
  if(it && !has(it = stat ? it : it.prototype, TAG))def(it, TAG, {configurable: true, value: tag});
};
},{"./_has":76,"./_object-dp":93,"./_wks":115}],103:[function(require,module,exports){
var shared = require('./_shared')('keys')
  , uid    = require('./_uid');
module.exports = function(key){
  return shared[key] || (shared[key] = uid(key));
};
},{"./_shared":104,"./_uid":114}],104:[function(require,module,exports){
var global = require('./_global')
  , SHARED = '__core-js_shared__'
  , store  = global[SHARED] || (global[SHARED] = {});
module.exports = function(key){
  return store[key] || (store[key] = {});
};
},{"./_global":75}],105:[function(require,module,exports){
// 7.3.20 SpeciesConstructor(O, defaultConstructor)
var anObject  = require('./_an-object')
  , aFunction = require('./_a-function')
  , SPECIES   = require('./_wks')('species');
module.exports = function(O, D){
  var C = anObject(O).constructor, S;
  return C === undefined || (S = anObject(C)[SPECIES]) == undefined ? D : aFunction(S);
};
},{"./_a-function":59,"./_an-object":62,"./_wks":115}],106:[function(require,module,exports){
var toInteger = require('./_to-integer')
  , defined   = require('./_defined');
// true  -> String#at
// false -> String#codePointAt
module.exports = function(TO_STRING){
  return function(that, pos){
    var s = String(defined(that))
      , i = toInteger(pos)
      , l = s.length
      , a, b;
    if(i < 0 || i >= l)return TO_STRING ? '' : undefined;
    a = s.charCodeAt(i);
    return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
      ? TO_STRING ? s.charAt(i) : a
      : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
  };
};
},{"./_defined":68,"./_to-integer":109}],107:[function(require,module,exports){
var ctx                = require('./_ctx')
  , invoke             = require('./_invoke')
  , html               = require('./_html')
  , cel                = require('./_dom-create')
  , global             = require('./_global')
  , process            = global.process
  , setTask            = global.setImmediate
  , clearTask          = global.clearImmediate
  , MessageChannel     = global.MessageChannel
  , counter            = 0
  , queue              = {}
  , ONREADYSTATECHANGE = 'onreadystatechange'
  , defer, channel, port;
var run = function(){
  var id = +this;
  if(queue.hasOwnProperty(id)){
    var fn = queue[id];
    delete queue[id];
    fn();
  }
};
var listener = function(event){
  run.call(event.data);
};
// Node.js 0.9+ & IE10+ has setImmediate, otherwise:
if(!setTask || !clearTask){
  setTask = function setImmediate(fn){
    var args = [], i = 1;
    while(arguments.length > i)args.push(arguments[i++]);
    queue[++counter] = function(){
      invoke(typeof fn == 'function' ? fn : Function(fn), args);
    };
    defer(counter);
    return counter;
  };
  clearTask = function clearImmediate(id){
    delete queue[id];
  };
  // Node.js 0.8-
  if(require('./_cof')(process) == 'process'){
    defer = function(id){
      process.nextTick(ctx(run, id, 1));
    };
  // Browsers with MessageChannel, includes WebWorkers
  } else if(MessageChannel){
    channel = new MessageChannel;
    port    = channel.port2;
    channel.port1.onmessage = listener;
    defer = ctx(port.postMessage, port, 1);
  // Browsers with postMessage, skip WebWorkers
  // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
  } else if(global.addEventListener && typeof postMessage == 'function' && !global.importScripts){
    defer = function(id){
      global.postMessage(id + '', '*');
    };
    global.addEventListener('message', listener, false);
  // IE8-
  } else if(ONREADYSTATECHANGE in cel('script')){
    defer = function(id){
      html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function(){
        html.removeChild(this);
        run.call(id);
      };
    };
  // Rest old browsers
  } else {
    defer = function(id){
      setTimeout(ctx(run, id, 1), 0);
    };
  }
}
module.exports = {
  set:   setTask,
  clear: clearTask
};
},{"./_cof":65,"./_ctx":67,"./_dom-create":70,"./_global":75,"./_html":78,"./_invoke":80}],108:[function(require,module,exports){
var toInteger = require('./_to-integer')
  , max       = Math.max
  , min       = Math.min;
module.exports = function(index, length){
  index = toInteger(index);
  return index < 0 ? max(index + length, 0) : min(index, length);
};
},{"./_to-integer":109}],109:[function(require,module,exports){
// 7.1.4 ToInteger
var ceil  = Math.ceil
  , floor = Math.floor;
module.exports = function(it){
  return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
};
},{}],110:[function(require,module,exports){
// to indexed object, toObject with fallback for non-array-like ES3 strings
var IObject = require('./_iobject')
  , defined = require('./_defined');
module.exports = function(it){
  return IObject(defined(it));
};
},{"./_defined":68,"./_iobject":81}],111:[function(require,module,exports){
// 7.1.15 ToLength
var toInteger = require('./_to-integer')
  , min       = Math.min;
module.exports = function(it){
  return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
};
},{"./_to-integer":109}],112:[function(require,module,exports){
// 7.1.13 ToObject(argument)
var defined = require('./_defined');
module.exports = function(it){
  return Object(defined(it));
};
},{"./_defined":68}],113:[function(require,module,exports){
// 7.1.1 ToPrimitive(input [, PreferredType])
var isObject = require('./_is-object');
// instead of the ES6 spec version, we didn't implement @@toPrimitive case
// and the second argument - flag - preferred type is a string
module.exports = function(it, S){
  if(!isObject(it))return it;
  var fn, val;
  if(S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
  if(typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it)))return val;
  if(!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
  throw TypeError("Can't convert object to primitive value");
};
},{"./_is-object":83}],114:[function(require,module,exports){
var id = 0
  , px = Math.random();
module.exports = function(key){
  return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
};
},{}],115:[function(require,module,exports){
var store      = require('./_shared')('wks')
  , uid        = require('./_uid')
  , Symbol     = require('./_global').Symbol
  , USE_SYMBOL = typeof Symbol == 'function';

var $exports = module.exports = function(name){
  return store[name] || (store[name] =
    USE_SYMBOL && Symbol[name] || (USE_SYMBOL ? Symbol : uid)('Symbol.' + name));
};

$exports.store = store;
},{"./_global":75,"./_shared":104,"./_uid":114}],116:[function(require,module,exports){
var classof   = require('./_classof')
  , ITERATOR  = require('./_wks')('iterator')
  , Iterators = require('./_iterators');
module.exports = require('./_core').getIteratorMethod = function(it){
  if(it != undefined)return it[ITERATOR]
    || it['@@iterator']
    || Iterators[classof(it)];
};
},{"./_classof":64,"./_core":66,"./_iterators":89,"./_wks":115}],117:[function(require,module,exports){
'use strict';
var addToUnscopables = require('./_add-to-unscopables')
  , step             = require('./_iter-step')
  , Iterators        = require('./_iterators')
  , toIObject        = require('./_to-iobject');

// 22.1.3.4 Array.prototype.entries()
// 22.1.3.13 Array.prototype.keys()
// 22.1.3.29 Array.prototype.values()
// 22.1.3.30 Array.prototype[@@iterator]()
module.exports = require('./_iter-define')(Array, 'Array', function(iterated, kind){
  this._t = toIObject(iterated); // target
  this._i = 0;                   // next index
  this._k = kind;                // kind
// 22.1.5.2.1 %ArrayIteratorPrototype%.next()
}, function(){
  var O     = this._t
    , kind  = this._k
    , index = this._i++;
  if(!O || index >= O.length){
    this._t = undefined;
    return step(1);
  }
  if(kind == 'keys'  )return step(0, index);
  if(kind == 'values')return step(0, O[index]);
  return step(0, [index, O[index]]);
}, 'values');

// argumentsList[@@iterator] is %ArrayProto_values% (9.4.4.6, 9.4.4.7)
Iterators.Arguments = Iterators.Array;

addToUnscopables('keys');
addToUnscopables('values');
addToUnscopables('entries');
},{"./_add-to-unscopables":60,"./_iter-define":86,"./_iter-step":88,"./_iterators":89,"./_to-iobject":110}],118:[function(require,module,exports){
'use strict';
// 19.1.3.6 Object.prototype.toString()
var classof = require('./_classof')
  , test    = {};
test[require('./_wks')('toStringTag')] = 'z';
if(test + '' != '[object z]'){
  require('./_redefine')(Object.prototype, 'toString', function toString(){
    return '[object ' + classof(this) + ']';
  }, true);
}
},{"./_classof":64,"./_redefine":100,"./_wks":115}],119:[function(require,module,exports){
'use strict';
var LIBRARY            = require('./_library')
  , global             = require('./_global')
  , ctx                = require('./_ctx')
  , classof            = require('./_classof')
  , $export            = require('./_export')
  , isObject           = require('./_is-object')
  , aFunction          = require('./_a-function')
  , anInstance         = require('./_an-instance')
  , forOf              = require('./_for-of')
  , speciesConstructor = require('./_species-constructor')
  , task               = require('./_task').set
  , microtask          = require('./_microtask')()
  , PROMISE            = 'Promise'
  , TypeError          = global.TypeError
  , process            = global.process
  , $Promise           = global[PROMISE]
  , process            = global.process
  , isNode             = classof(process) == 'process'
  , empty              = function(){ /* empty */ }
  , Internal, GenericPromiseCapability, Wrapper;

var USE_NATIVE = !!function(){
  try {
    // correct subclassing with @@species support
    var promise     = $Promise.resolve(1)
      , FakePromise = (promise.constructor = {})[require('./_wks')('species')] = function(exec){ exec(empty, empty); };
    // unhandled rejections tracking support, NodeJS Promise without it fails @@species test
    return (isNode || typeof PromiseRejectionEvent == 'function') && promise.then(empty) instanceof FakePromise;
  } catch(e){ /* empty */ }
}();

// helpers
var sameConstructor = function(a, b){
  // with library wrapper special case
  return a === b || a === $Promise && b === Wrapper;
};
var isThenable = function(it){
  var then;
  return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
};
var newPromiseCapability = function(C){
  return sameConstructor($Promise, C)
    ? new PromiseCapability(C)
    : new GenericPromiseCapability(C);
};
var PromiseCapability = GenericPromiseCapability = function(C){
  var resolve, reject;
  this.promise = new C(function($$resolve, $$reject){
    if(resolve !== undefined || reject !== undefined)throw TypeError('Bad Promise constructor');
    resolve = $$resolve;
    reject  = $$reject;
  });
  this.resolve = aFunction(resolve);
  this.reject  = aFunction(reject);
};
var perform = function(exec){
  try {
    exec();
  } catch(e){
    return {error: e};
  }
};
var notify = function(promise, isReject){
  if(promise._n)return;
  promise._n = true;
  var chain = promise._c;
  microtask(function(){
    var value = promise._v
      , ok    = promise._s == 1
      , i     = 0;
    var run = function(reaction){
      var handler = ok ? reaction.ok : reaction.fail
        , resolve = reaction.resolve
        , reject  = reaction.reject
        , domain  = reaction.domain
        , result, then;
      try {
        if(handler){
          if(!ok){
            if(promise._h == 2)onHandleUnhandled(promise);
            promise._h = 1;
          }
          if(handler === true)result = value;
          else {
            if(domain)domain.enter();
            result = handler(value);
            if(domain)domain.exit();
          }
          if(result === reaction.promise){
            reject(TypeError('Promise-chain cycle'));
          } else if(then = isThenable(result)){
            then.call(result, resolve, reject);
          } else resolve(result);
        } else reject(value);
      } catch(e){
        reject(e);
      }
    };
    while(chain.length > i)run(chain[i++]); // variable length - can't use forEach
    promise._c = [];
    promise._n = false;
    if(isReject && !promise._h)onUnhandled(promise);
  });
};
var onUnhandled = function(promise){
  task.call(global, function(){
    var value = promise._v
      , abrupt, handler, console;
    if(isUnhandled(promise)){
      abrupt = perform(function(){
        if(isNode){
          process.emit('unhandledRejection', value, promise);
        } else if(handler = global.onunhandledrejection){
          handler({promise: promise, reason: value});
        } else if((console = global.console) && console.error){
          console.error('Unhandled promise rejection', value);
        }
      });
      // Browsers should not trigger `rejectionHandled` event if it was handled here, NodeJS - should
      promise._h = isNode || isUnhandled(promise) ? 2 : 1;
    } promise._a = undefined;
    if(abrupt)throw abrupt.error;
  });
};
var isUnhandled = function(promise){
  if(promise._h == 1)return false;
  var chain = promise._a || promise._c
    , i     = 0
    , reaction;
  while(chain.length > i){
    reaction = chain[i++];
    if(reaction.fail || !isUnhandled(reaction.promise))return false;
  } return true;
};
var onHandleUnhandled = function(promise){
  task.call(global, function(){
    var handler;
    if(isNode){
      process.emit('rejectionHandled', promise);
    } else if(handler = global.onrejectionhandled){
      handler({promise: promise, reason: promise._v});
    }
  });
};
var $reject = function(value){
  var promise = this;
  if(promise._d)return;
  promise._d = true;
  promise = promise._w || promise; // unwrap
  promise._v = value;
  promise._s = 2;
  if(!promise._a)promise._a = promise._c.slice();
  notify(promise, true);
};
var $resolve = function(value){
  var promise = this
    , then;
  if(promise._d)return;
  promise._d = true;
  promise = promise._w || promise; // unwrap
  try {
    if(promise === value)throw TypeError("Promise can't be resolved itself");
    if(then = isThenable(value)){
      microtask(function(){
        var wrapper = {_w: promise, _d: false}; // wrap
        try {
          then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
        } catch(e){
          $reject.call(wrapper, e);
        }
      });
    } else {
      promise._v = value;
      promise._s = 1;
      notify(promise, false);
    }
  } catch(e){
    $reject.call({_w: promise, _d: false}, e); // wrap
  }
};

// constructor polyfill
if(!USE_NATIVE){
  // 25.4.3.1 Promise(executor)
  $Promise = function Promise(executor){
    anInstance(this, $Promise, PROMISE, '_h');
    aFunction(executor);
    Internal.call(this);
    try {
      executor(ctx($resolve, this, 1), ctx($reject, this, 1));
    } catch(err){
      $reject.call(this, err);
    }
  };
  Internal = function Promise(executor){
    this._c = [];             // <- awaiting reactions
    this._a = undefined;      // <- checked in isUnhandled reactions
    this._s = 0;              // <- state
    this._d = false;          // <- done
    this._v = undefined;      // <- value
    this._h = 0;              // <- rejection state, 0 - default, 1 - handled, 2 - unhandled
    this._n = false;          // <- notify
  };
  Internal.prototype = require('./_redefine-all')($Promise.prototype, {
    // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
    then: function then(onFulfilled, onRejected){
      var reaction    = newPromiseCapability(speciesConstructor(this, $Promise));
      reaction.ok     = typeof onFulfilled == 'function' ? onFulfilled : true;
      reaction.fail   = typeof onRejected == 'function' && onRejected;
      reaction.domain = isNode ? process.domain : undefined;
      this._c.push(reaction);
      if(this._a)this._a.push(reaction);
      if(this._s)notify(this, false);
      return reaction.promise;
    },
    // 25.4.5.1 Promise.prototype.catch(onRejected)
    'catch': function(onRejected){
      return this.then(undefined, onRejected);
    }
  });
  PromiseCapability = function(){
    var promise  = new Internal;
    this.promise = promise;
    this.resolve = ctx($resolve, promise, 1);
    this.reject  = ctx($reject, promise, 1);
  };
}

$export($export.G + $export.W + $export.F * !USE_NATIVE, {Promise: $Promise});
require('./_set-to-string-tag')($Promise, PROMISE);
require('./_set-species')(PROMISE);
Wrapper = require('./_core')[PROMISE];

// statics
$export($export.S + $export.F * !USE_NATIVE, PROMISE, {
  // 25.4.4.5 Promise.reject(r)
  reject: function reject(r){
    var capability = newPromiseCapability(this)
      , $$reject   = capability.reject;
    $$reject(r);
    return capability.promise;
  }
});
$export($export.S + $export.F * (LIBRARY || !USE_NATIVE), PROMISE, {
  // 25.4.4.6 Promise.resolve(x)
  resolve: function resolve(x){
    // instanceof instead of internal slot check because we should fix it without replacement native Promise core
    if(x instanceof $Promise && sameConstructor(x.constructor, this))return x;
    var capability = newPromiseCapability(this)
      , $$resolve  = capability.resolve;
    $$resolve(x);
    return capability.promise;
  }
});
$export($export.S + $export.F * !(USE_NATIVE && require('./_iter-detect')(function(iter){
  $Promise.all(iter)['catch'](empty);
})), PROMISE, {
  // 25.4.4.1 Promise.all(iterable)
  all: function all(iterable){
    var C          = this
      , capability = newPromiseCapability(C)
      , resolve    = capability.resolve
      , reject     = capability.reject;
    var abrupt = perform(function(){
      var values    = []
        , index     = 0
        , remaining = 1;
      forOf(iterable, false, function(promise){
        var $index        = index++
          , alreadyCalled = false;
        values.push(undefined);
        remaining++;
        C.resolve(promise).then(function(value){
          if(alreadyCalled)return;
          alreadyCalled  = true;
          values[$index] = value;
          --remaining || resolve(values);
        }, reject);
      });
      --remaining || resolve(values);
    });
    if(abrupt)reject(abrupt.error);
    return capability.promise;
  },
  // 25.4.4.4 Promise.race(iterable)
  race: function race(iterable){
    var C          = this
      , capability = newPromiseCapability(C)
      , reject     = capability.reject;
    var abrupt = perform(function(){
      forOf(iterable, false, function(promise){
        C.resolve(promise).then(capability.resolve, reject);
      });
    });
    if(abrupt)reject(abrupt.error);
    return capability.promise;
  }
});
},{"./_a-function":59,"./_an-instance":61,"./_classof":64,"./_core":66,"./_ctx":67,"./_export":72,"./_for-of":74,"./_global":75,"./_is-object":83,"./_iter-detect":87,"./_library":90,"./_microtask":91,"./_redefine-all":99,"./_set-species":101,"./_set-to-string-tag":102,"./_species-constructor":105,"./_task":107,"./_wks":115}],120:[function(require,module,exports){
'use strict';
var $at  = require('./_string-at')(true);

// 21.1.3.27 String.prototype[@@iterator]()
require('./_iter-define')(String, 'String', function(iterated){
  this._t = String(iterated); // target
  this._i = 0;                // next index
// 21.1.5.2.1 %StringIteratorPrototype%.next()
}, function(){
  var O     = this._t
    , index = this._i
    , point;
  if(index >= O.length)return {value: undefined, done: true};
  point = $at(O, index);
  this._i += point.length;
  return {value: point, done: false};
});
},{"./_iter-define":86,"./_string-at":106}],121:[function(require,module,exports){
var $iterators    = require('./es6.array.iterator')
  , redefine      = require('./_redefine')
  , global        = require('./_global')
  , hide          = require('./_hide')
  , Iterators     = require('./_iterators')
  , wks           = require('./_wks')
  , ITERATOR      = wks('iterator')
  , TO_STRING_TAG = wks('toStringTag')
  , ArrayValues   = Iterators.Array;

for(var collections = ['NodeList', 'DOMTokenList', 'MediaList', 'StyleSheetList', 'CSSRuleList'], i = 0; i < 5; i++){
  var NAME       = collections[i]
    , Collection = global[NAME]
    , proto      = Collection && Collection.prototype
    , key;
  if(proto){
    if(!proto[ITERATOR])hide(proto, ITERATOR, ArrayValues);
    if(!proto[TO_STRING_TAG])hide(proto, TO_STRING_TAG, NAME);
    Iterators[NAME] = ArrayValues;
    for(key in $iterators)if(!proto[key])redefine(proto, key, $iterators[key], true);
  }
}
},{"./_global":75,"./_hide":77,"./_iterators":89,"./_redefine":100,"./_wks":115,"./es6.array.iterator":117}],122:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
    try {
        cachedSetTimeout = setTimeout;
    } catch (e) {
        cachedSetTimeout = function () {
            throw new Error('setTimeout is not defined');
        }
    }
    try {
        cachedClearTimeout = clearTimeout;
    } catch (e) {
        cachedClearTimeout = function () {
            throw new Error('clearTimeout is not defined');
        }
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        return setTimeout(fun, 0);
    } else {
        return cachedSetTimeout.call(null, fun, 0);
    }
}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        clearTimeout(marker);
    } else {
        cachedClearTimeout.call(null, marker);
    }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],123:[function(require,module,exports){
/**
 * @license
 * Copyright 2013 David Eberlein (david.eberlein@ch.sauter-bc.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview DataHandler implementation for the custom bars option.
 * @author David Eberlein (david.eberlein@ch.sauter-bc.com)
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _bars = require('./bars');

var _bars2 = _interopRequireDefault(_bars);

/**
 * @constructor
 * @extends Dygraph.DataHandlers.BarsHandler
 */
var CustomBarsHandler = function CustomBarsHandler() {};

CustomBarsHandler.prototype = new _bars2['default']();

/** @inheritDoc */
CustomBarsHandler.prototype.extractSeries = function (rawData, i, options) {
  // TODO(danvk): pre-allocate series here.
  var series = [];
  var x, y, point;
  var logScale = options.get('logscale');
  for (var j = 0; j < rawData.length; j++) {
    x = rawData[j][0];
    point = rawData[j][i];
    if (logScale && point !== null) {
      // On the log scale, points less than zero do not exist.
      // This will create a gap in the chart.
      if (point[0] <= 0 || point[1] <= 0 || point[2] <= 0) {
        point = null;
      }
    }
    // Extract to the unified data format.
    if (point !== null) {
      y = point[1];
      if (y !== null && !isNaN(y)) {
        series.push([x, y, [point[0], point[2]]]);
      } else {
        series.push([x, y, [y, y]]);
      }
    } else {
      series.push([x, null, [null, null]]);
    }
  }
  return series;
};

/** @inheritDoc */
CustomBarsHandler.prototype.rollingAverage = function (originalData, rollPeriod, options) {
  rollPeriod = Math.min(rollPeriod, originalData.length);
  var rollingData = [];
  var y, low, high, mid, count, i, extremes;

  low = 0;
  mid = 0;
  high = 0;
  count = 0;
  for (i = 0; i < originalData.length; i++) {
    y = originalData[i][1];
    extremes = originalData[i][2];
    rollingData[i] = originalData[i];

    if (y !== null && !isNaN(y)) {
      low += extremes[0];
      mid += y;
      high += extremes[1];
      count += 1;
    }
    if (i - rollPeriod >= 0) {
      var prev = originalData[i - rollPeriod];
      if (prev[1] !== null && !isNaN(prev[1])) {
        low -= prev[2][0];
        mid -= prev[1];
        high -= prev[2][1];
        count -= 1;
      }
    }
    if (count) {
      rollingData[i] = [originalData[i][0], 1.0 * mid / count, [1.0 * low / count, 1.0 * high / count]];
    } else {
      rollingData[i] = [originalData[i][0], null, [null, null]];
    }
  }

  return rollingData;
};

exports['default'] = CustomBarsHandler;
module.exports = exports['default'];

},{"./bars":126}],124:[function(require,module,exports){
/**
 * @license
 * Copyright 2013 David Eberlein (david.eberlein@ch.sauter-bc.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview DataHandler implementation for the error bars option.
 * @author David Eberlein (david.eberlein@ch.sauter-bc.com)
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _bars = require('./bars');

var _bars2 = _interopRequireDefault(_bars);

/**
 * @constructor
 * @extends BarsHandler
 */
var ErrorBarsHandler = function ErrorBarsHandler() {};

ErrorBarsHandler.prototype = new _bars2["default"]();

/** @inheritDoc */
ErrorBarsHandler.prototype.extractSeries = function (rawData, i, options) {
  // TODO(danvk): pre-allocate series here.
  var series = [];
  var x, y, variance, point;
  var sigma = options.get("sigma");
  var logScale = options.get('logscale');
  for (var j = 0; j < rawData.length; j++) {
    x = rawData[j][0];
    point = rawData[j][i];
    if (logScale && point !== null) {
      // On the log scale, points less than zero do not exist.
      // This will create a gap in the chart.
      if (point[0] <= 0 || point[0] - sigma * point[1] <= 0) {
        point = null;
      }
    }
    // Extract to the unified data format.
    if (point !== null) {
      y = point[0];
      if (y !== null && !isNaN(y)) {
        variance = sigma * point[1];
        // preserve original error value in extras for further
        // filtering
        series.push([x, y, [y - variance, y + variance, point[1]]]);
      } else {
        series.push([x, y, [y, y, y]]);
      }
    } else {
      series.push([x, null, [null, null, null]]);
    }
  }
  return series;
};

/** @inheritDoc */
ErrorBarsHandler.prototype.rollingAverage = function (originalData, rollPeriod, options) {
  rollPeriod = Math.min(rollPeriod, originalData.length);
  var rollingData = [];
  var sigma = options.get("sigma");

  var i, j, y, v, sum, num_ok, stddev, variance, value;

  // Calculate the rolling average for the first rollPeriod - 1 points
  // where there is not enough data to roll over the full number of points
  for (i = 0; i < originalData.length; i++) {
    sum = 0;
    variance = 0;
    num_ok = 0;
    for (j = Math.max(0, i - rollPeriod + 1); j < i + 1; j++) {
      y = originalData[j][1];
      if (y === null || isNaN(y)) continue;
      num_ok++;
      sum += y;
      variance += Math.pow(originalData[j][2][2], 2);
    }
    if (num_ok) {
      stddev = Math.sqrt(variance) / num_ok;
      value = sum / num_ok;
      rollingData[i] = [originalData[i][0], value, [value - sigma * stddev, value + sigma * stddev]];
    } else {
      // This explicitly preserves NaNs to aid with "independent
      // series".
      // See testRollingAveragePreservesNaNs.
      v = rollPeriod == 1 ? originalData[i][1] : null;
      rollingData[i] = [originalData[i][0], v, [v, v]];
    }
  }

  return rollingData;
};

exports["default"] = ErrorBarsHandler;
module.exports = exports["default"];

},{"./bars":126}],125:[function(require,module,exports){
/**
 * @license
 * Copyright 2013 David Eberlein (david.eberlein@ch.sauter-bc.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview DataHandler implementation for the combination 
 * of error bars and fractions options.
 * @author David Eberlein (david.eberlein@ch.sauter-bc.com)
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _bars = require('./bars');

var _bars2 = _interopRequireDefault(_bars);

/**
 * @constructor
 * @extends Dygraph.DataHandlers.BarsHandler
 */
var FractionsBarsHandler = function FractionsBarsHandler() {};

FractionsBarsHandler.prototype = new _bars2["default"]();

/** @inheritDoc */
FractionsBarsHandler.prototype.extractSeries = function (rawData, i, options) {
  // TODO(danvk): pre-allocate series here.
  var series = [];
  var x, y, point, num, den, value, stddev, variance;
  var mult = 100.0;
  var sigma = options.get("sigma");
  var logScale = options.get('logscale');
  for (var j = 0; j < rawData.length; j++) {
    x = rawData[j][0];
    point = rawData[j][i];
    if (logScale && point !== null) {
      // On the log scale, points less than zero do not exist.
      // This will create a gap in the chart.
      if (point[0] <= 0 || point[1] <= 0) {
        point = null;
      }
    }
    // Extract to the unified data format.
    if (point !== null) {
      num = point[0];
      den = point[1];
      if (num !== null && !isNaN(num)) {
        value = den ? num / den : 0.0;
        stddev = den ? sigma * Math.sqrt(value * (1 - value) / den) : 1.0;
        variance = mult * stddev;
        y = mult * value;
        // preserve original values in extras for further filtering
        series.push([x, y, [y - variance, y + variance, num, den]]);
      } else {
        series.push([x, num, [num, num, num, den]]);
      }
    } else {
      series.push([x, null, [null, null, null, null]]);
    }
  }
  return series;
};

/** @inheritDoc */
FractionsBarsHandler.prototype.rollingAverage = function (originalData, rollPeriod, options) {
  rollPeriod = Math.min(rollPeriod, originalData.length);
  var rollingData = [];
  var sigma = options.get("sigma");
  var wilsonInterval = options.get("wilsonInterval");

  var low, high, i, stddev;
  var num = 0;
  var den = 0; // numerator/denominator
  var mult = 100.0;
  for (i = 0; i < originalData.length; i++) {
    num += originalData[i][2][2];
    den += originalData[i][2][3];
    if (i - rollPeriod >= 0) {
      num -= originalData[i - rollPeriod][2][2];
      den -= originalData[i - rollPeriod][2][3];
    }

    var date = originalData[i][0];
    var value = den ? num / den : 0.0;
    if (wilsonInterval) {
      // For more details on this confidence interval, see:
      // http://en.wikipedia.org/wiki/Binomial_confidence_interval
      if (den) {
        var p = value < 0 ? 0 : value,
            n = den;
        var pm = sigma * Math.sqrt(p * (1 - p) / n + sigma * sigma / (4 * n * n));
        var denom = 1 + sigma * sigma / den;
        low = (p + sigma * sigma / (2 * den) - pm) / denom;
        high = (p + sigma * sigma / (2 * den) + pm) / denom;
        rollingData[i] = [date, p * mult, [low * mult, high * mult]];
      } else {
        rollingData[i] = [date, 0, [0, 0]];
      }
    } else {
      stddev = den ? sigma * Math.sqrt(value * (1 - value) / den) : 1.0;
      rollingData[i] = [date, mult * value, [mult * (value - stddev), mult * (value + stddev)]];
    }
  }

  return rollingData;
};

exports["default"] = FractionsBarsHandler;
module.exports = exports["default"];

},{"./bars":126}],126:[function(require,module,exports){
/**
 * @license
 * Copyright 2013 David Eberlein (david.eberlein@ch.sauter-bc.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview DataHandler base implementation for the "bar" 
 * data formats. This implementation must be extended and the
 * extractSeries and rollingAverage must be implemented.
 * @author David Eberlein (david.eberlein@ch.sauter-bc.com)
 */

/*global Dygraph:false */
/*global DygraphLayout:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _datahandler = require('./datahandler');

var _datahandler2 = _interopRequireDefault(_datahandler);

var _dygraphLayout = require('../dygraph-layout');

var _dygraphLayout2 = _interopRequireDefault(_dygraphLayout);

/**
 * @constructor
 * @extends {Dygraph.DataHandler}
 */
var BarsHandler = function BarsHandler() {
  _datahandler2['default'].call(this);
};
BarsHandler.prototype = new _datahandler2['default']();

// TODO(danvk): figure out why the jsdoc has to be copy/pasted from superclass.
//   (I get closure compiler errors if this isn't here.)
/**
 * @override
 * @param {!Array.<Array>} rawData The raw data passed into dygraphs where 
 *     rawData[i] = [x,ySeries1,...,ySeriesN].
 * @param {!number} seriesIndex Index of the series to extract. All other
 *     series should be ignored.
 * @param {!DygraphOptions} options Dygraph options.
 * @return {Array.<[!number,?number,?]>} The series in the unified data format
 *     where series[i] = [x,y,{extras}]. 
 */
BarsHandler.prototype.extractSeries = function (rawData, seriesIndex, options) {
  // Not implemented here must be extended
};

/**
 * @override
 * @param {!Array.<[!number,?number,?]>} series The series in the unified 
 *          data format where series[i] = [x,y,{extras}].
 * @param {!number} rollPeriod The number of points over which to average the data
 * @param {!DygraphOptions} options The dygraph options.
 * TODO(danvk): be more specific than "Array" here.
 * @return {!Array.<[!number,?number,?]>} the rolled series.
 */
BarsHandler.prototype.rollingAverage = function (series, rollPeriod, options) {
  // Not implemented here, must be extended.
};

/** @inheritDoc */
BarsHandler.prototype.onPointsCreated_ = function (series, points) {
  for (var i = 0; i < series.length; ++i) {
    var item = series[i];
    var point = points[i];
    point.y_top = NaN;
    point.y_bottom = NaN;
    point.yval_minus = _datahandler2['default'].parseFloat(item[2][0]);
    point.yval_plus = _datahandler2['default'].parseFloat(item[2][1]);
  }
};

/** @inheritDoc */
BarsHandler.prototype.getExtremeYValues = function (series, dateWindow, options) {
  var minY = null,
      maxY = null,
      y;

  var firstIdx = 0;
  var lastIdx = series.length - 1;

  for (var j = firstIdx; j <= lastIdx; j++) {
    y = series[j][1];
    if (y === null || isNaN(y)) continue;

    var low = series[j][2][0];
    var high = series[j][2][1];

    if (low > y) low = y; // this can happen with custom bars,
    if (high < y) high = y; // e.g. in tests/custom-bars.html

    if (maxY === null || high > maxY) maxY = high;
    if (minY === null || low < minY) minY = low;
  }

  return [minY, maxY];
};

/** @inheritDoc */
BarsHandler.prototype.onLineEvaluated = function (points, axis, logscale) {
  var point;
  for (var j = 0; j < points.length; j++) {
    // Copy over the error terms
    point = points[j];
    point.y_top = _dygraphLayout2['default'].calcYNormal_(axis, point.yval_minus, logscale);
    point.y_bottom = _dygraphLayout2['default'].calcYNormal_(axis, point.yval_plus, logscale);
  }
};

exports['default'] = BarsHandler;
module.exports = exports['default'];

},{"../dygraph-layout":134,"./datahandler":127}],127:[function(require,module,exports){
/**
 * @license
 * Copyright 2013 David Eberlein (david.eberlein@ch.sauter-bc.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview This file contains the managment of data handlers
 * @author David Eberlein (david.eberlein@ch.sauter-bc.com)
 *
 * The idea is to define a common, generic data format that works for all data
 * structures supported by dygraphs. To make this possible, the DataHandler
 * interface is introduced. This makes it possible, that dygraph itself can work
 * with the same logic for every data type independent of the actual format and
 * the DataHandler takes care of the data format specific jobs.
 * DataHandlers are implemented for all data types supported by Dygraphs and
 * return Dygraphs compliant formats.
 * By default the correct DataHandler is chosen based on the options set.
 * Optionally the user may use his own DataHandler (similar to the plugin
 * system).
 *
 *
 * The unified data format returend by each handler is defined as so:
 * series[n][point] = [x,y,(extras)]
 *
 * This format contains the common basis that is needed to draw a simple line
 * series extended by optional extras for more complex graphing types. It
 * contains a primitive x value as first array entry, a primitive y value as
 * second array entry and an optional extras object for additional data needed.
 *
 * x must always be a number.
 * y must always be a number, NaN of type number or null.
 * extras is optional and must be interpreted by the DataHandler. It may be of
 * any type.
 *
 * In practice this might look something like this:
 * default: [x, yVal]
 * errorBar / customBar: [x, yVal, [yTopVariance, yBottomVariance] ]
 *
 */
/*global Dygraph:false */
/*global DygraphLayout:false */

"use strict";

/**
 *
 * The data handler is responsible for all data specific operations. All of the
 * series data it receives and returns is always in the unified data format.
 * Initially the unified data is created by the extractSeries method
 * @constructor
 */
Object.defineProperty(exports, "__esModule", {
  value: true
});
var DygraphDataHandler = function DygraphDataHandler() {};

var handler = DygraphDataHandler;

/**
 * X-value array index constant for unified data samples.
 * @const
 * @type {number}
 */
handler.X = 0;

/**
 * Y-value array index constant for unified data samples.
 * @const
 * @type {number}
 */
handler.Y = 1;

/**
 * Extras-value array index constant for unified data samples.
 * @const
 * @type {number}
 */
handler.EXTRAS = 2;

/**
 * Extracts one series from the raw data (a 2D array) into an array of the
 * unified data format.
 * This is where undesirable points (i.e. negative values on log scales and
 * missing values through which we wish to connect lines) are dropped.
 * TODO(danvk): the "missing values" bit above doesn't seem right.
 *
 * @param {!Array.<Array>} rawData The raw data passed into dygraphs where
 *     rawData[i] = [x,ySeries1,...,ySeriesN].
 * @param {!number} seriesIndex Index of the series to extract. All other
 *     series should be ignored.
 * @param {!DygraphOptions} options Dygraph options.
 * @return {Array.<[!number,?number,?]>} The series in the unified data format
 *     where series[i] = [x,y,{extras}].
 */
handler.prototype.extractSeries = function (rawData, seriesIndex, options) {};

/**
 * Converts a series to a Point array.  The resulting point array must be
 * returned in increasing order of idx property.
 *
 * @param {!Array.<[!number,?number,?]>} series The series in the unified
 *          data format where series[i] = [x,y,{extras}].
 * @param {!string} setName Name of the series.
 * @param {!number} boundaryIdStart Index offset of the first point, equal to the
 *          number of skipped points left of the date window minimum (if any).
 * @return {!Array.<Dygraph.PointType>} List of points for this series.
 */
handler.prototype.seriesToPoints = function (series, setName, boundaryIdStart) {
  // TODO(bhs): these loops are a hot-spot for high-point-count charts. In
  // fact,
  // on chrome+linux, they are 6 times more expensive than iterating through
  // the
  // points and drawing the lines. The brunt of the cost comes from allocating
  // the |point| structures.
  var points = [];
  for (var i = 0; i < series.length; ++i) {
    var item = series[i];
    var yraw = item[1];
    var yval = yraw === null ? null : handler.parseFloat(yraw);
    var point = {
      x: NaN,
      y: NaN,
      xval: handler.parseFloat(item[0]),
      yval: yval,
      name: setName, // TODO(danvk): is this really necessary?
      idx: i + boundaryIdStart
    };
    points.push(point);
  }
  this.onPointsCreated_(series, points);
  return points;
};

/**
 * Callback called for each series after the series points have been generated
 * which will later be used by the plotters to draw the graph.
 * Here data may be added to the seriesPoints which is needed by the plotters.
 * The indexes of series and points are in sync meaning the original data
 * sample for series[i] is points[i].
 *
 * @param {!Array.<[!number,?number,?]>} series The series in the unified
 *     data format where series[i] = [x,y,{extras}].
 * @param {!Array.<Dygraph.PointType>} points The corresponding points passed
 *     to the plotter.
 * @protected
 */
handler.prototype.onPointsCreated_ = function (series, points) {};

/**
 * Calculates the rolling average of a data set.
 *
 * @param {!Array.<[!number,?number,?]>} series The series in the unified
 *          data format where series[i] = [x,y,{extras}].
 * @param {!number} rollPeriod The number of points over which to average the data
 * @param {!DygraphOptions} options The dygraph options.
 * @return {!Array.<[!number,?number,?]>} the rolled series.
 */
handler.prototype.rollingAverage = function (series, rollPeriod, options) {};

/**
 * Computes the range of the data series (including confidence intervals).
 *
 * @param {!Array.<[!number,?number,?]>} series The series in the unified
 *     data format where series[i] = [x, y, {extras}].
 * @param {!Array.<number>} dateWindow The x-value range to display with
 *     the format: [min, max].
 * @param {!DygraphOptions} options The dygraph options.
 * @return {Array.<number>} The low and high extremes of the series in the
 *     given window with the format: [low, high].
 */
handler.prototype.getExtremeYValues = function (series, dateWindow, options) {};

/**
 * Callback called for each series after the layouting data has been
 * calculated before the series is drawn. Here normalized positioning data
 * should be calculated for the extras of each point.
 *
 * @param {!Array.<Dygraph.PointType>} points The points passed to
 *          the plotter.
 * @param {!Object} axis The axis on which the series will be plotted.
 * @param {!boolean} logscale Weather or not to use a logscale.
 */
handler.prototype.onLineEvaluated = function (points, axis, logscale) {};

/**
 * Optimized replacement for parseFloat, which was way too slow when almost
 * all values were type number, with few edge cases, none of which were strings.
 * @param {?number} val
 * @return {number}
 * @protected
 */
handler.parseFloat = function (val) {
  // parseFloat(null) is NaN
  if (val === null) {
    return NaN;
  }

  // Assume it's a number or NaN. If it's something else, I'll be shocked.
  return val;
};

exports["default"] = DygraphDataHandler;
module.exports = exports["default"];

},{}],128:[function(require,module,exports){
/**
 * @license
 * Copyright 2013 David Eberlein (david.eberlein@ch.sauter-bc.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview DataHandler implementation for the fractions option.
 * @author David Eberlein (david.eberlein@ch.sauter-bc.com)
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _datahandler = require('./datahandler');

var _datahandler2 = _interopRequireDefault(_datahandler);

var _default = require('./default');

var _default2 = _interopRequireDefault(_default);

/**
 * @extends DefaultHandler
 * @constructor
 */
var DefaultFractionHandler = function DefaultFractionHandler() {};

DefaultFractionHandler.prototype = new _default2['default']();

DefaultFractionHandler.prototype.extractSeries = function (rawData, i, options) {
  // TODO(danvk): pre-allocate series here.
  var series = [];
  var x, y, point, num, den, value;
  var mult = 100.0;
  var logScale = options.get('logscale');
  for (var j = 0; j < rawData.length; j++) {
    x = rawData[j][0];
    point = rawData[j][i];
    if (logScale && point !== null) {
      // On the log scale, points less than zero do not exist.
      // This will create a gap in the chart.
      if (point[0] <= 0 || point[1] <= 0) {
        point = null;
      }
    }
    // Extract to the unified data format.
    if (point !== null) {
      num = point[0];
      den = point[1];
      if (num !== null && !isNaN(num)) {
        value = den ? num / den : 0.0;
        y = mult * value;
        // preserve original values in extras for further filtering
        series.push([x, y, [num, den]]);
      } else {
        series.push([x, num, [num, den]]);
      }
    } else {
      series.push([x, null, [null, null]]);
    }
  }
  return series;
};

DefaultFractionHandler.prototype.rollingAverage = function (originalData, rollPeriod, options) {
  rollPeriod = Math.min(rollPeriod, originalData.length);
  var rollingData = [];

  var i;
  var num = 0;
  var den = 0; // numerator/denominator
  var mult = 100.0;
  for (i = 0; i < originalData.length; i++) {
    num += originalData[i][2][0];
    den += originalData[i][2][1];
    if (i - rollPeriod >= 0) {
      num -= originalData[i - rollPeriod][2][0];
      den -= originalData[i - rollPeriod][2][1];
    }

    var date = originalData[i][0];
    var value = den ? num / den : 0.0;
    rollingData[i] = [date, mult * value];
  }

  return rollingData;
};

exports['default'] = DefaultFractionHandler;
module.exports = exports['default'];

},{"./datahandler":127,"./default":129}],129:[function(require,module,exports){
/**
 * @license
 * Copyright 2013 David Eberlein (david.eberlein@ch.sauter-bc.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview DataHandler default implementation used for simple line charts.
 * @author David Eberlein (david.eberlein@ch.sauter-bc.com)
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _datahandler = require('./datahandler');

var _datahandler2 = _interopRequireDefault(_datahandler);

/**
 * @constructor
 * @extends Dygraph.DataHandler
 */
var DefaultHandler = function DefaultHandler() {};

DefaultHandler.prototype = new _datahandler2['default']();

/** @inheritDoc */
DefaultHandler.prototype.extractSeries = function (rawData, i, options) {
  // TODO(danvk): pre-allocate series here.
  var series = [];
  var logScale = options.get('logscale');
  for (var j = 0; j < rawData.length; j++) {
    var x = rawData[j][0];
    var point = rawData[j][i];
    if (logScale) {
      // On the log scale, points less than zero do not exist.
      // This will create a gap in the chart.
      if (point <= 0) {
        point = null;
      }
    }
    series.push([x, point]);
  }
  return series;
};

/** @inheritDoc */
DefaultHandler.prototype.rollingAverage = function (originalData, rollPeriod, options) {
  rollPeriod = Math.min(rollPeriod, originalData.length);
  var rollingData = [];

  var i, j, y, sum, num_ok;
  // Calculate the rolling average for the first rollPeriod - 1 points
  // where
  // there is not enough data to roll over the full number of points
  if (rollPeriod == 1) {
    return originalData;
  }
  for (i = 0; i < originalData.length; i++) {
    sum = 0;
    num_ok = 0;
    for (j = Math.max(0, i - rollPeriod + 1); j < i + 1; j++) {
      y = originalData[j][1];
      if (y === null || isNaN(y)) continue;
      num_ok++;
      sum += originalData[j][1];
    }
    if (num_ok) {
      rollingData[i] = [originalData[i][0], sum / num_ok];
    } else {
      rollingData[i] = [originalData[i][0], null];
    }
  }

  return rollingData;
};

/** @inheritDoc */
DefaultHandler.prototype.getExtremeYValues = function (series, dateWindow, options) {
  var minY = null,
      maxY = null,
      y;
  var firstIdx = 0,
      lastIdx = series.length - 1;

  for (var j = firstIdx; j <= lastIdx; j++) {
    y = series[j][1];
    if (y === null || isNaN(y)) continue;
    if (maxY === null || y > maxY) {
      maxY = y;
    }
    if (minY === null || y < minY) {
      minY = y;
    }
  }
  return [minY, maxY];
};

exports['default'] = DefaultHandler;
module.exports = exports['default'];

},{"./datahandler":127}],130:[function(require,module,exports){
/**
 * @license
 * Copyright 2006 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview Based on PlotKit.CanvasRenderer, but modified to meet the
 * needs of dygraphs.
 *
 * In particular, support for:
 * - grid overlays
 * - error bars
 * - dygraphs attribute system
 */

/**
 * The DygraphCanvasRenderer class does the actual rendering of the chart onto
 * a canvas. It's based on PlotKit.CanvasRenderer.
 * @param {Object} element The canvas to attach to
 * @param {Object} elementContext The 2d context of the canvas (injected so it
 * can be mocked for testing.)
 * @param {Layout} layout The DygraphLayout object for this graph.
 * @constructor
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _dygraphUtils = require('./dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

var _dygraph = require('./dygraph');

var _dygraph2 = _interopRequireDefault(_dygraph);

/**
 * @constructor
 *
 * This gets called when there are "new points" to chart. This is generally the
 * case when the underlying data being charted has changed. It is _not_ called
 * in the common case that the user has zoomed or is panning the view.
 *
 * The chart canvas has already been created by the Dygraph object. The
 * renderer simply gets a drawing context.
 *
 * @param {Dygraph} dygraph The chart to which this renderer belongs.
 * @param {HTMLCanvasElement} element The &lt;canvas&gt; DOM element on which to draw.
 * @param {CanvasRenderingContext2D} elementContext The drawing context.
 * @param {DygraphLayout} layout The chart's DygraphLayout object.
 *
 * TODO(danvk): remove the elementContext property.
 */
var DygraphCanvasRenderer = function DygraphCanvasRenderer(dygraph, element, elementContext, layout) {
  this.dygraph_ = dygraph;

  this.layout = layout;
  this.element = element;
  this.elementContext = elementContext;

  this.height = dygraph.height_;
  this.width = dygraph.width_;

  // --- check whether everything is ok before we return
  if (!utils.isCanvasSupported(this.element)) {
    throw "Canvas is not supported.";
  }

  // internal state
  this.area = layout.getPlotArea();

  // Set up a clipping area for the canvas (and the interaction canvas).
  // This ensures that we don't overdraw.
  var ctx = this.dygraph_.canvas_ctx_;
  ctx.beginPath();
  ctx.rect(this.area.x, this.area.y, this.area.w, this.area.h);
  ctx.clip();

  ctx = this.dygraph_.hidden_ctx_;
  ctx.beginPath();
  ctx.rect(this.area.x, this.area.y, this.area.w, this.area.h);
  ctx.clip();
};

/**
 * Clears out all chart content and DOM elements.
 * This is called immediately before render() on every frame, including
 * during zooms and pans.
 * @private
 */
DygraphCanvasRenderer.prototype.clear = function () {
  this.elementContext.clearRect(0, 0, this.width, this.height);
};

/**
 * This method is responsible for drawing everything on the chart, including
 * lines, error bars, fills and axes.
 * It is called immediately after clear() on every frame, including during pans
 * and zooms.
 * @private
 */
DygraphCanvasRenderer.prototype.render = function () {
  // attaches point.canvas{x,y}
  this._updatePoints();

  // actually draws the chart.
  this._renderLineChart();
};

/**
 * Returns a predicate to be used with an iterator, which will
 * iterate over points appropriately, depending on whether
 * connectSeparatedPoints is true. When it's false, the predicate will
 * skip over points with missing yVals.
 */
DygraphCanvasRenderer._getIteratorPredicate = function (connectSeparatedPoints) {
  return connectSeparatedPoints ? DygraphCanvasRenderer._predicateThatSkipsEmptyPoints : null;
};

DygraphCanvasRenderer._predicateThatSkipsEmptyPoints = function (array, idx) {
  return array[idx].yval !== null;
};

/**
 * Draws a line with the styles passed in and calls all the drawPointCallbacks.
 * @param {Object} e The dictionary passed to the plotter function.
 * @private
 */
DygraphCanvasRenderer._drawStyledLine = function (e, color, strokeWidth, strokePattern, drawPoints, drawPointCallback, pointSize) {
  var g = e.dygraph;
  // TODO(konigsberg): Compute attributes outside this method call.
  var stepPlot = g.getBooleanOption("stepPlot", e.setName);

  if (!utils.isArrayLike(strokePattern)) {
    strokePattern = null;
  }

  var drawGapPoints = g.getBooleanOption('drawGapEdgePoints', e.setName);

  var points = e.points;
  var setName = e.setName;
  var iter = utils.createIterator(points, 0, points.length, DygraphCanvasRenderer._getIteratorPredicate(g.getBooleanOption("connectSeparatedPoints", setName)));

  var stroking = strokePattern && strokePattern.length >= 2;

  var ctx = e.drawingContext;
  ctx.save();
  if (stroking) {
    if (ctx.setLineDash) ctx.setLineDash(strokePattern);
  }

  var pointsOnLine = DygraphCanvasRenderer._drawSeries(e, iter, strokeWidth, pointSize, drawPoints, drawGapPoints, stepPlot, color);
  DygraphCanvasRenderer._drawPointsOnLine(e, pointsOnLine, drawPointCallback, color, pointSize);

  if (stroking) {
    if (ctx.setLineDash) ctx.setLineDash([]);
  }

  ctx.restore();
};

/**
 * This does the actual drawing of lines on the canvas, for just one series.
 * Returns a list of [canvasx, canvasy] pairs for points for which a
 * drawPointCallback should be fired.  These include isolated points, or all
 * points if drawPoints=true.
 * @param {Object} e The dictionary passed to the plotter function.
 * @private
 */
DygraphCanvasRenderer._drawSeries = function (e, iter, strokeWidth, pointSize, drawPoints, drawGapPoints, stepPlot, color) {

  var prevCanvasX = null;
  var prevCanvasY = null;
  var nextCanvasY = null;
  var isIsolated; // true if this point is isolated (no line segments)
  var point; // the point being processed in the while loop
  var pointsOnLine = []; // Array of [canvasx, canvasy] pairs.
  var first = true; // the first cycle through the while loop

  var ctx = e.drawingContext;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;

  // NOTE: we break the iterator's encapsulation here for about a 25% speedup.
  var arr = iter.array_;
  var limit = iter.end_;
  var predicate = iter.predicate_;

  for (var i = iter.start_; i < limit; i++) {
    point = arr[i];
    if (predicate) {
      while (i < limit && !predicate(arr, i)) {
        i++;
      }
      if (i == limit) break;
      point = arr[i];
    }

    // FIXME: The 'canvasy != canvasy' test here catches NaN values but the test
    // doesn't catch Infinity values. Could change this to
    // !isFinite(point.canvasy), but I assume it avoids isNaN for performance?
    if (point.canvasy === null || point.canvasy != point.canvasy) {
      if (stepPlot && prevCanvasX !== null) {
        // Draw a horizontal line to the start of the missing data
        ctx.moveTo(prevCanvasX, prevCanvasY);
        ctx.lineTo(point.canvasx, prevCanvasY);
      }
      prevCanvasX = prevCanvasY = null;
    } else {
      isIsolated = false;
      if (drawGapPoints || prevCanvasX === null) {
        iter.nextIdx_ = i;
        iter.next();
        nextCanvasY = iter.hasNext ? iter.peek.canvasy : null;

        var isNextCanvasYNullOrNaN = nextCanvasY === null || nextCanvasY != nextCanvasY;
        isIsolated = prevCanvasX === null && isNextCanvasYNullOrNaN;
        if (drawGapPoints) {
          // Also consider a point to be "isolated" if it's adjacent to a
          // null point, excluding the graph edges.
          if (!first && prevCanvasX === null || iter.hasNext && isNextCanvasYNullOrNaN) {
            isIsolated = true;
          }
        }
      }

      if (prevCanvasX !== null) {
        if (strokeWidth) {
          if (stepPlot) {
            ctx.moveTo(prevCanvasX, prevCanvasY);
            ctx.lineTo(point.canvasx, prevCanvasY);
          }

          ctx.lineTo(point.canvasx, point.canvasy);
        }
      } else {
        ctx.moveTo(point.canvasx, point.canvasy);
      }
      if (drawPoints || isIsolated) {
        pointsOnLine.push([point.canvasx, point.canvasy, point.idx]);
      }
      prevCanvasX = point.canvasx;
      prevCanvasY = point.canvasy;
    }
    first = false;
  }
  ctx.stroke();
  return pointsOnLine;
};

/**
 * This fires the drawPointCallback functions, which draw dots on the points by
 * default. This gets used when the "drawPoints" option is set, or when there
 * are isolated points.
 * @param {Object} e The dictionary passed to the plotter function.
 * @private
 */
DygraphCanvasRenderer._drawPointsOnLine = function (e, pointsOnLine, drawPointCallback, color, pointSize) {
  var ctx = e.drawingContext;
  for (var idx = 0; idx < pointsOnLine.length; idx++) {
    var cb = pointsOnLine[idx];
    ctx.save();
    drawPointCallback.call(e.dygraph, e.dygraph, e.setName, ctx, cb[0], cb[1], color, pointSize, cb[2]);
    ctx.restore();
  }
};

/**
 * Attaches canvas coordinates to the points array.
 * @private
 */
DygraphCanvasRenderer.prototype._updatePoints = function () {
  // Update Points
  // TODO(danvk): here
  //
  // TODO(bhs): this loop is a hot-spot for high-point-count charts. These
  // transformations can be pushed into the canvas via linear transformation
  // matrices.
  // NOTE(danvk): this is trickier than it sounds at first. The transformation
  // needs to be done before the .moveTo() and .lineTo() calls, but must be
  // undone before the .stroke() call to ensure that the stroke width is
  // unaffected.  An alternative is to reduce the stroke width in the
  // transformed coordinate space, but you can't specify different values for
  // each dimension (as you can with .scale()). The speedup here is ~12%.
  var sets = this.layout.points;
  for (var i = sets.length; i--;) {
    var points = sets[i];
    for (var j = points.length; j--;) {
      var point = points[j];
      point.canvasx = this.area.w * point.x + this.area.x;
      point.canvasy = this.area.h * point.y + this.area.y;
    }
  }
};

/**
 * Add canvas Actually draw the lines chart, including error bars.
 *
 * This function can only be called if DygraphLayout's points array has been
 * updated with canvas{x,y} attributes, i.e. by
 * DygraphCanvasRenderer._updatePoints.
 *
 * @param {string=} opt_seriesName when specified, only that series will
 *     be drawn. (This is used for expedited redrawing with highlightSeriesOpts)
 * @param {CanvasRenderingContext2D} opt_ctx when specified, the drawing
 *     context.  However, lines are typically drawn on the object's
 *     elementContext.
 * @private
 */
DygraphCanvasRenderer.prototype._renderLineChart = function (opt_seriesName, opt_ctx) {
  var ctx = opt_ctx || this.elementContext;
  var i;

  var sets = this.layout.points;
  var setNames = this.layout.setNames;
  var setName;

  this.colors = this.dygraph_.colorsMap_;

  // Determine which series have specialized plotters.
  var plotter_attr = this.dygraph_.getOption("plotter");
  var plotters = plotter_attr;
  if (!utils.isArrayLike(plotters)) {
    plotters = [plotters];
  }

  var setPlotters = {}; // series name -> plotter fn.
  for (i = 0; i < setNames.length; i++) {
    setName = setNames[i];
    var setPlotter = this.dygraph_.getOption("plotter", setName);
    if (setPlotter == plotter_attr) continue; // not specialized.

    setPlotters[setName] = setPlotter;
  }

  for (i = 0; i < plotters.length; i++) {
    var plotter = plotters[i];
    var is_last = i == plotters.length - 1;

    for (var j = 0; j < sets.length; j++) {
      setName = setNames[j];
      if (opt_seriesName && setName != opt_seriesName) continue;

      var points = sets[j];

      // Only throw in the specialized plotters on the last iteration.
      var p = plotter;
      if (setName in setPlotters) {
        if (is_last) {
          p = setPlotters[setName];
        } else {
          // Don't use the standard plotters in this case.
          continue;
        }
      }

      var color = this.colors[setName];
      var strokeWidth = this.dygraph_.getOption("strokeWidth", setName);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      p({
        points: points,
        setName: setName,
        drawingContext: ctx,
        color: color,
        strokeWidth: strokeWidth,
        dygraph: this.dygraph_,
        axis: this.dygraph_.axisPropertiesForSeries(setName),
        plotArea: this.area,
        seriesIndex: j,
        seriesCount: sets.length,
        singleSeriesName: opt_seriesName,
        allSeriesPoints: sets
      });
      ctx.restore();
    }
  }
};

/**
 * Standard plotters. These may be used by clients via Dygraph.Plotters.
 * See comments there for more details.
 */
DygraphCanvasRenderer._Plotters = {
  linePlotter: function linePlotter(e) {
    DygraphCanvasRenderer._linePlotter(e);
  },

  fillPlotter: function fillPlotter(e) {
    DygraphCanvasRenderer._fillPlotter(e);
  },

  errorPlotter: function errorPlotter(e) {
    DygraphCanvasRenderer._errorPlotter(e);
  }
};

/**
 * Plotter which draws the central lines for a series.
 * @private
 */
DygraphCanvasRenderer._linePlotter = function (e) {
  var g = e.dygraph;
  var setName = e.setName;
  var strokeWidth = e.strokeWidth;

  // TODO(danvk): Check if there's any performance impact of just calling
  // getOption() inside of _drawStyledLine. Passing in so many parameters makes
  // this code a bit nasty.
  var borderWidth = g.getNumericOption("strokeBorderWidth", setName);
  var drawPointCallback = g.getOption("drawPointCallback", setName) || utils.Circles.DEFAULT;
  var strokePattern = g.getOption("strokePattern", setName);
  var drawPoints = g.getBooleanOption("drawPoints", setName);
  var pointSize = g.getNumericOption("pointSize", setName);

  if (borderWidth && strokeWidth) {
    DygraphCanvasRenderer._drawStyledLine(e, g.getOption("strokeBorderColor", setName), strokeWidth + 2 * borderWidth, strokePattern, drawPoints, drawPointCallback, pointSize);
  }

  DygraphCanvasRenderer._drawStyledLine(e, e.color, strokeWidth, strokePattern, drawPoints, drawPointCallback, pointSize);
};

/**
 * Draws the shaded error bars/confidence intervals for each series.
 * This happens before the center lines are drawn, since the center lines
 * need to be drawn on top of the error bars for all series.
 * @private
 */
DygraphCanvasRenderer._errorPlotter = function (e) {
  var g = e.dygraph;
  var setName = e.setName;
  var errorBars = g.getBooleanOption("errorBars") || g.getBooleanOption("customBars");
  if (!errorBars) return;

  var fillGraph = g.getBooleanOption("fillGraph", setName);
  if (fillGraph) {
    console.warn("Can't use fillGraph option with error bars");
  }

  var ctx = e.drawingContext;
  var color = e.color;
  var fillAlpha = g.getNumericOption('fillAlpha', setName);
  var stepPlot = g.getBooleanOption("stepPlot", setName);
  var points = e.points;

  var iter = utils.createIterator(points, 0, points.length, DygraphCanvasRenderer._getIteratorPredicate(g.getBooleanOption("connectSeparatedPoints", setName)));

  var newYs;

  // setup graphics context
  var prevX = NaN;
  var prevY = NaN;
  var prevYs = [-1, -1];
  // should be same color as the lines but only 15% opaque.
  var rgb = utils.toRGB_(color);
  var err_color = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + fillAlpha + ')';
  ctx.fillStyle = err_color;
  ctx.beginPath();

  var isNullUndefinedOrNaN = function isNullUndefinedOrNaN(x) {
    return x === null || x === undefined || isNaN(x);
  };

  while (iter.hasNext) {
    var point = iter.next();
    if (!stepPlot && isNullUndefinedOrNaN(point.y) || stepPlot && !isNaN(prevY) && isNullUndefinedOrNaN(prevY)) {
      prevX = NaN;
      continue;
    }

    newYs = [point.y_bottom, point.y_top];
    if (stepPlot) {
      prevY = point.y;
    }

    // The documentation specifically disallows nulls inside the point arrays,
    // but in case it happens we should do something sensible.
    if (isNaN(newYs[0])) newYs[0] = point.y;
    if (isNaN(newYs[1])) newYs[1] = point.y;

    newYs[0] = e.plotArea.h * newYs[0] + e.plotArea.y;
    newYs[1] = e.plotArea.h * newYs[1] + e.plotArea.y;
    if (!isNaN(prevX)) {
      if (stepPlot) {
        ctx.moveTo(prevX, prevYs[0]);
        ctx.lineTo(point.canvasx, prevYs[0]);
        ctx.lineTo(point.canvasx, prevYs[1]);
      } else {
        ctx.moveTo(prevX, prevYs[0]);
        ctx.lineTo(point.canvasx, newYs[0]);
        ctx.lineTo(point.canvasx, newYs[1]);
      }
      ctx.lineTo(prevX, prevYs[1]);
      ctx.closePath();
    }
    prevYs = newYs;
    prevX = point.canvasx;
  }
  ctx.fill();
};

/**
 * Proxy for CanvasRenderingContext2D which drops moveTo/lineTo calls which are
 * superfluous. It accumulates all movements which haven't changed the x-value
 * and only applies the two with the most extreme y-values.
 *
 * Calls to lineTo/moveTo must have non-decreasing x-values.
 */
DygraphCanvasRenderer._fastCanvasProxy = function (context) {
  var pendingActions = []; // array of [type, x, y] tuples
  var lastRoundedX = null;
  var lastFlushedX = null;

  var LINE_TO = 1,
      MOVE_TO = 2;

  var actionCount = 0; // number of moveTos and lineTos passed to context.

  // Drop superfluous motions
  // Assumes all pendingActions have the same (rounded) x-value.
  var compressActions = function compressActions(opt_losslessOnly) {
    if (pendingActions.length <= 1) return;

    // Lossless compression: drop inconsequential moveTos.
    for (var i = pendingActions.length - 1; i > 0; i--) {
      var action = pendingActions[i];
      if (action[0] == MOVE_TO) {
        var prevAction = pendingActions[i - 1];
        if (prevAction[1] == action[1] && prevAction[2] == action[2]) {
          pendingActions.splice(i, 1);
        }
      }
    }

    // Lossless compression: ... drop consecutive moveTos ...
    for (var i = 0; i < pendingActions.length - 1;) /* incremented internally */{
      var action = pendingActions[i];
      if (action[0] == MOVE_TO && pendingActions[i + 1][0] == MOVE_TO) {
        pendingActions.splice(i, 1);
      } else {
        i++;
      }
    }

    // Lossy compression: ... drop all but the extreme y-values ...
    if (pendingActions.length > 2 && !opt_losslessOnly) {
      // keep an initial moveTo, but drop all others.
      var startIdx = 0;
      if (pendingActions[0][0] == MOVE_TO) startIdx++;
      var minIdx = null,
          maxIdx = null;
      for (var i = startIdx; i < pendingActions.length; i++) {
        var action = pendingActions[i];
        if (action[0] != LINE_TO) continue;
        if (minIdx === null && maxIdx === null) {
          minIdx = i;
          maxIdx = i;
        } else {
          var y = action[2];
          if (y < pendingActions[minIdx][2]) {
            minIdx = i;
          } else if (y > pendingActions[maxIdx][2]) {
            maxIdx = i;
          }
        }
      }
      var minAction = pendingActions[minIdx],
          maxAction = pendingActions[maxIdx];
      pendingActions.splice(startIdx, pendingActions.length - startIdx);
      if (minIdx < maxIdx) {
        pendingActions.push(minAction);
        pendingActions.push(maxAction);
      } else if (minIdx > maxIdx) {
        pendingActions.push(maxAction);
        pendingActions.push(minAction);
      } else {
        pendingActions.push(minAction);
      }
    }
  };

  var flushActions = function flushActions(opt_noLossyCompression) {
    compressActions(opt_noLossyCompression);
    for (var i = 0, len = pendingActions.length; i < len; i++) {
      var action = pendingActions[i];
      if (action[0] == LINE_TO) {
        context.lineTo(action[1], action[2]);
      } else if (action[0] == MOVE_TO) {
        context.moveTo(action[1], action[2]);
      }
    }
    if (pendingActions.length) {
      lastFlushedX = pendingActions[pendingActions.length - 1][1];
    }
    actionCount += pendingActions.length;
    pendingActions = [];
  };

  var addAction = function addAction(action, x, y) {
    var rx = Math.round(x);
    if (lastRoundedX === null || rx != lastRoundedX) {
      // if there are large gaps on the x-axis, it's essential to keep the
      // first and last point as well.
      var hasGapOnLeft = lastRoundedX - lastFlushedX > 1,
          hasGapOnRight = rx - lastRoundedX > 1,
          hasGap = hasGapOnLeft || hasGapOnRight;
      flushActions(hasGap);
      lastRoundedX = rx;
    }
    pendingActions.push([action, x, y]);
  };

  return {
    moveTo: function moveTo(x, y) {
      addAction(MOVE_TO, x, y);
    },
    lineTo: function lineTo(x, y) {
      addAction(LINE_TO, x, y);
    },

    // for major operations like stroke/fill, we skip compression to ensure
    // that there are no artifacts at the right edge.
    stroke: function stroke() {
      flushActions(true);context.stroke();
    },
    fill: function fill() {
      flushActions(true);context.fill();
    },
    beginPath: function beginPath() {
      flushActions(true);context.beginPath();
    },
    closePath: function closePath() {
      flushActions(true);context.closePath();
    },

    _count: function _count() {
      return actionCount;
    }
  };
};

/**
 * Draws the shaded regions when "fillGraph" is set. Not to be confused with
 * error bars.
 *
 * For stacked charts, it's more convenient to handle all the series
 * simultaneously. So this plotter plots all the points on the first series
 * it's asked to draw, then ignores all the other series.
 *
 * @private
 */
DygraphCanvasRenderer._fillPlotter = function (e) {
  // Skip if we're drawing a single series for interactive highlight overlay.
  if (e.singleSeriesName) return;

  // We'll handle all the series at once, not one-by-one.
  if (e.seriesIndex !== 0) return;

  var g = e.dygraph;
  var setNames = g.getLabels().slice(1); // remove x-axis

  // getLabels() includes names for invisible series, which are not included in
  // allSeriesPoints. We remove those to make the two match.
  // TODO(danvk): provide a simpler way to get this information.
  for (var i = setNames.length; i >= 0; i--) {
    if (!g.visibility()[i]) setNames.splice(i, 1);
  }

  var anySeriesFilled = (function () {
    for (var i = 0; i < setNames.length; i++) {
      if (g.getBooleanOption("fillGraph", setNames[i])) return true;
    }
    return false;
  })();

  if (!anySeriesFilled) return;

  var area = e.plotArea;
  var sets = e.allSeriesPoints;
  var setCount = sets.length;

  var stackedGraph = g.getBooleanOption("stackedGraph");
  var colors = g.getColors();

  // For stacked graphs, track the baseline for filling.
  //
  // The filled areas below graph lines are trapezoids with two
  // vertical edges. The top edge is the line segment being drawn, and
  // the baseline is the bottom edge. Each baseline corresponds to the
  // top line segment from the previous stacked line. In the case of
  // step plots, the trapezoids are rectangles.
  var baseline = {};
  var currBaseline;
  var prevStepPlot; // for different line drawing modes (line/step) per series

  // Helper function to trace a line back along the baseline.
  var traceBackPath = function traceBackPath(ctx, baselineX, baselineY, pathBack) {
    ctx.lineTo(baselineX, baselineY);
    if (stackedGraph) {
      for (var i = pathBack.length - 1; i >= 0; i--) {
        var pt = pathBack[i];
        ctx.lineTo(pt[0], pt[1]);
      }
    }
  };

  // process sets in reverse order (needed for stacked graphs)
  for (var setIdx = setCount - 1; setIdx >= 0; setIdx--) {
    var ctx = e.drawingContext;
    var setName = setNames[setIdx];
    if (!g.getBooleanOption('fillGraph', setName)) continue;

    var fillAlpha = g.getNumericOption('fillAlpha', setName);
    var stepPlot = g.getBooleanOption('stepPlot', setName);
    var color = colors[setIdx];
    var axis = g.axisPropertiesForSeries(setName);
    var axisY = 1.0 + axis.minyval * axis.yscale;
    if (axisY < 0.0) axisY = 0.0;else if (axisY > 1.0) axisY = 1.0;
    axisY = area.h * axisY + area.y;

    var points = sets[setIdx];
    var iter = utils.createIterator(points, 0, points.length, DygraphCanvasRenderer._getIteratorPredicate(g.getBooleanOption("connectSeparatedPoints", setName)));

    // setup graphics context
    var prevX = NaN;
    var prevYs = [-1, -1];
    var newYs;
    // should be same color as the lines but only 15% opaque.
    var rgb = utils.toRGB_(color);
    var err_color = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + fillAlpha + ')';
    ctx.fillStyle = err_color;
    ctx.beginPath();
    var last_x,
        is_first = true;

    // If the point density is high enough, dropping segments on their way to
    // the canvas justifies the overhead of doing so.
    if (points.length > 2 * g.width_ || _dygraph2['default'].FORCE_FAST_PROXY) {
      ctx = DygraphCanvasRenderer._fastCanvasProxy(ctx);
    }

    // For filled charts, we draw points from left to right, then back along
    // the x-axis to complete a shape for filling.
    // For stacked plots, this "back path" is a more complex shape. This array
    // stores the [x, y] values needed to trace that shape.
    var pathBack = [];

    // TODO(danvk): there are a lot of options at play in this loop.
    //     The logic would be much clearer if some (e.g. stackGraph and
    //     stepPlot) were split off into separate sub-plotters.
    var point;
    while (iter.hasNext) {
      point = iter.next();
      if (!utils.isOK(point.y) && !stepPlot) {
        traceBackPath(ctx, prevX, prevYs[1], pathBack);
        pathBack = [];
        prevX = NaN;
        if (point.y_stacked !== null && !isNaN(point.y_stacked)) {
          baseline[point.canvasx] = area.h * point.y_stacked + area.y;
        }
        continue;
      }
      if (stackedGraph) {
        if (!is_first && last_x == point.xval) {
          continue;
        } else {
          is_first = false;
          last_x = point.xval;
        }

        currBaseline = baseline[point.canvasx];
        var lastY;
        if (currBaseline === undefined) {
          lastY = axisY;
        } else {
          if (prevStepPlot) {
            lastY = currBaseline[0];
          } else {
            lastY = currBaseline;
          }
        }
        newYs = [point.canvasy, lastY];

        if (stepPlot) {
          // Step plots must keep track of the top and bottom of
          // the baseline at each point.
          if (prevYs[0] === -1) {
            baseline[point.canvasx] = [point.canvasy, axisY];
          } else {
            baseline[point.canvasx] = [point.canvasy, prevYs[0]];
          }
        } else {
          baseline[point.canvasx] = point.canvasy;
        }
      } else {
        if (isNaN(point.canvasy) && stepPlot) {
          newYs = [area.y + area.h, axisY];
        } else {
          newYs = [point.canvasy, axisY];
        }
      }
      if (!isNaN(prevX)) {
        // Move to top fill point
        if (stepPlot) {
          ctx.lineTo(point.canvasx, prevYs[0]);
          ctx.lineTo(point.canvasx, newYs[0]);
        } else {
          ctx.lineTo(point.canvasx, newYs[0]);
        }

        // Record the baseline for the reverse path.
        if (stackedGraph) {
          pathBack.push([prevX, prevYs[1]]);
          if (prevStepPlot && currBaseline) {
            // Draw to the bottom of the baseline
            pathBack.push([point.canvasx, currBaseline[1]]);
          } else {
            pathBack.push([point.canvasx, newYs[1]]);
          }
        }
      } else {
        ctx.moveTo(point.canvasx, newYs[1]);
        ctx.lineTo(point.canvasx, newYs[0]);
      }
      prevYs = newYs;
      prevX = point.canvasx;
    }
    prevStepPlot = stepPlot;
    if (newYs && point) {
      traceBackPath(ctx, point.canvasx, newYs[1], pathBack);
      pathBack = [];
    }
    ctx.fill();
  }
};

exports['default'] = DygraphCanvasRenderer;
module.exports = exports['default'];

},{"./dygraph":139,"./dygraph-utils":138}],131:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _dygraphTickers = require('./dygraph-tickers');

var DygraphTickers = _interopRequireWildcard(_dygraphTickers);

var _dygraphInteractionModel = require('./dygraph-interaction-model');

var _dygraphInteractionModel2 = _interopRequireDefault(_dygraphInteractionModel);

var _dygraphCanvas = require('./dygraph-canvas');

var _dygraphCanvas2 = _interopRequireDefault(_dygraphCanvas);

var _dygraphUtils = require('./dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

// Default attribute values.
var DEFAULT_ATTRS = {
  highlightCircleSize: 3,
  highlightSeriesOpts: null,
  highlightSeriesBackgroundAlpha: 0.5,
  highlightSeriesBackgroundColor: 'rgb(255, 255, 255)',

  labelsSeparateLines: false,
  labelsShowZeroValues: true,
  labelsKMB: false,
  labelsKMG2: false,
  showLabelsOnHighlight: true,

  digitsAfterDecimal: 2,
  maxNumberWidth: 6,
  sigFigs: null,

  strokeWidth: 1.0,
  strokeBorderWidth: 0,
  strokeBorderColor: "white",

  axisTickSize: 3,
  axisLabelFontSize: 14,
  rightGap: 5,

  showRoller: false,
  xValueParser: undefined,

  delimiter: ',',

  sigma: 2.0,
  errorBars: false,
  fractions: false,
  wilsonInterval: true, // only relevant if fractions is true
  customBars: false,
  fillGraph: false,
  fillAlpha: 0.15,
  connectSeparatedPoints: false,

  stackedGraph: false,
  stackedGraphNaNFill: 'all',
  hideOverlayOnMouseOut: true,

  legend: 'onmouseover',
  stepPlot: false,
  xRangePad: 0,
  yRangePad: null,
  drawAxesAtZero: false,

  // Sizes of the various chart labels.
  titleHeight: 28,
  xLabelHeight: 18,
  yLabelWidth: 18,

  axisLineColor: "black",
  axisLineWidth: 0.3,
  gridLineWidth: 0.3,
  axisLabelWidth: 50,
  gridLineColor: "rgb(128,128,128)",

  interactionModel: _dygraphInteractionModel2['default'].defaultModel,
  animatedZooms: false, // (for now)

  // Range selector options
  showRangeSelector: false,
  rangeSelectorHeight: 40,
  rangeSelectorPlotStrokeColor: "#808FAB",
  rangeSelectorPlotFillGradientColor: "white",
  rangeSelectorPlotFillColor: "#A7B1C4",
  rangeSelectorBackgroundStrokeColor: "gray",
  rangeSelectorBackgroundLineWidth: 1,
  rangeSelectorPlotLineWidth: 1.5,
  rangeSelectorForegroundStrokeColor: "black",
  rangeSelectorForegroundLineWidth: 1,
  rangeSelectorAlpha: 0.6,
  showInRangeSelector: null,

  // The ordering here ensures that central lines always appear above any
  // fill bars/error bars.
  plotter: [_dygraphCanvas2['default']._fillPlotter, _dygraphCanvas2['default']._errorPlotter, _dygraphCanvas2['default']._linePlotter],

  plugins: [],

  // per-axis options
  axes: {
    x: {
      pixelsPerLabel: 70,
      axisLabelWidth: 60,
      axisLabelFormatter: utils.dateAxisLabelFormatter,
      valueFormatter: utils.dateValueFormatter,
      drawGrid: true,
      drawAxis: true,
      independentTicks: true,
      ticker: DygraphTickers.dateTicker
    },
    y: {
      axisLabelWidth: 50,
      pixelsPerLabel: 30,
      valueFormatter: utils.numberValueFormatter,
      axisLabelFormatter: utils.numberAxisLabelFormatter,
      drawGrid: true,
      drawAxis: true,
      independentTicks: true,
      ticker: DygraphTickers.numericTicks
    },
    y2: {
      axisLabelWidth: 50,
      pixelsPerLabel: 30,
      valueFormatter: utils.numberValueFormatter,
      axisLabelFormatter: utils.numberAxisLabelFormatter,
      drawAxis: true, // only applies when there are two axes of data.
      drawGrid: false,
      independentTicks: false,
      ticker: DygraphTickers.numericTicks
    }
  }
};

exports['default'] = DEFAULT_ATTRS;
module.exports = exports['default'];

},{"./dygraph-canvas":130,"./dygraph-interaction-model":133,"./dygraph-tickers":137,"./dygraph-utils":138}],132:[function(require,module,exports){
/**
 * @license
 * Copyright 2011 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview A wrapper around the Dygraph class which implements the
 * interface for a GViz (aka Google Visualization API) visualization.
 * It is designed to be a drop-in replacement for Google's AnnotatedTimeline,
 * so the documentation at
 * http://code.google.com/apis/chart/interactive/docs/gallery/annotatedtimeline.html
 * translates over directly.
 *
 * For a full demo, see:
 * - http://dygraphs.com/tests/gviz.html
 * - http://dygraphs.com/tests/annotation-gviz.html
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _dygraph = require('./dygraph');

var _dygraph2 = _interopRequireDefault(_dygraph);

/**
 * A wrapper around Dygraph that implements the gviz API.
 * @param {!HTMLDivElement} container The DOM object the visualization should
 *     live in.
 * @constructor
 */
var GVizChart = function GVizChart(container) {
  this.container = container;
};

/**
 * @param {GVizDataTable} data
 * @param {Object.<*>} options
 */
GVizChart.prototype.draw = function (data, options) {
  // Clear out any existing dygraph.
  // TODO(danvk): would it make more sense to simply redraw using the current
  // date_graph object?
  this.container.innerHTML = '';
  if (typeof this.date_graph != 'undefined') {
    this.date_graph.destroy();
  }

  this.date_graph = new _dygraph2['default'](this.container, data, options);
};

/**
 * Google charts compatible setSelection
 * Only row selection is supported, all points in the row will be highlighted
 * @param {Array.<{row:number}>} selection_array array of the selected cells
 * @public
 */
GVizChart.prototype.setSelection = function (selection_array) {
  var row = false;
  if (selection_array.length) {
    row = selection_array[0].row;
  }
  this.date_graph.setSelection(row);
};

/**
 * Google charts compatible getSelection implementation
 * @return {Array.<{row:number,column:number}>} array of the selected cells
 * @public
 */
GVizChart.prototype.getSelection = function () {
  var selection = [];

  var row = this.date_graph.getSelection();

  if (row < 0) return selection;

  var points = this.date_graph.layout_.points;
  for (var setIdx = 0; setIdx < points.length; ++setIdx) {
    selection.push({ row: row, column: setIdx + 1 });
  }

  return selection;
};

exports['default'] = GVizChart;
module.exports = exports['default'];

},{"./dygraph":139}],133:[function(require,module,exports){
/**
 * @license
 * Copyright 2011 Robert Konigsberg (konigsberg@google.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview The default interaction model for Dygraphs. This is kept out
 * of dygraph.js for better navigability.
 * @author Robert Konigsberg (konigsberg@google.com)
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _dygraphUtils = require('./dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

/**
 * You can drag this many pixels past the edge of the chart and still have it
 * be considered a zoom. This makes it easier to zoom to the exact edge of the
 * chart, a fairly common operation.
 */
var DRAG_EDGE_MARGIN = 100;

/**
 * A collection of functions to facilitate build custom interaction models.
 * @class
 */
var DygraphInteraction = {};

/**
 * Checks whether the beginning & ending of an event were close enough that it
 * should be considered a click. If it should, dispatch appropriate events.
 * Returns true if the event was treated as a click.
 *
 * @param {Event} event
 * @param {Dygraph} g
 * @param {Object} context
 */
DygraphInteraction.maybeTreatMouseOpAsClick = function (event, g, context) {
  context.dragEndX = utils.dragGetX_(event, context);
  context.dragEndY = utils.dragGetY_(event, context);
  var regionWidth = Math.abs(context.dragEndX - context.dragStartX);
  var regionHeight = Math.abs(context.dragEndY - context.dragStartY);

  if (regionWidth < 2 && regionHeight < 2 && g.lastx_ !== undefined && g.lastx_ != -1) {
    DygraphInteraction.treatMouseOpAsClick(g, event, context);
  }

  context.regionWidth = regionWidth;
  context.regionHeight = regionHeight;
};

/**
 * Called in response to an interaction model operation that
 * should start the default panning behavior.
 *
 * It's used in the default callback for "mousedown" operations.
 * Custom interaction model builders can use it to provide the default
 * panning behavior.
 *
 * @param {Event} event the event object which led to the startPan call.
 * @param {Dygraph} g The dygraph on which to act.
 * @param {Object} context The dragging context object (with
 *     dragStartX/dragStartY/etc. properties). This function modifies the
 *     context.
 */
DygraphInteraction.startPan = function (event, g, context) {
  var i, axis;
  context.isPanning = true;
  var xRange = g.xAxisRange();

  if (g.getOptionForAxis("logscale", "x")) {
    context.initialLeftmostDate = utils.log10(xRange[0]);
    context.dateRange = utils.log10(xRange[1]) - utils.log10(xRange[0]);
  } else {
    context.initialLeftmostDate = xRange[0];
    context.dateRange = xRange[1] - xRange[0];
  }
  context.xUnitsPerPixel = context.dateRange / (g.plotter_.area.w - 1);

  if (g.getNumericOption("panEdgeFraction")) {
    var maxXPixelsToDraw = g.width_ * g.getNumericOption("panEdgeFraction");
    var xExtremes = g.xAxisExtremes(); // I REALLY WANT TO CALL THIS xTremes!

    var boundedLeftX = g.toDomXCoord(xExtremes[0]) - maxXPixelsToDraw;
    var boundedRightX = g.toDomXCoord(xExtremes[1]) + maxXPixelsToDraw;

    var boundedLeftDate = g.toDataXCoord(boundedLeftX);
    var boundedRightDate = g.toDataXCoord(boundedRightX);
    context.boundedDates = [boundedLeftDate, boundedRightDate];

    var boundedValues = [];
    var maxYPixelsToDraw = g.height_ * g.getNumericOption("panEdgeFraction");

    for (i = 0; i < g.axes_.length; i++) {
      axis = g.axes_[i];
      var yExtremes = axis.extremeRange;

      var boundedTopY = g.toDomYCoord(yExtremes[0], i) + maxYPixelsToDraw;
      var boundedBottomY = g.toDomYCoord(yExtremes[1], i) - maxYPixelsToDraw;

      var boundedTopValue = g.toDataYCoord(boundedTopY, i);
      var boundedBottomValue = g.toDataYCoord(boundedBottomY, i);

      boundedValues[i] = [boundedTopValue, boundedBottomValue];
    }
    context.boundedValues = boundedValues;
  }

  // Record the range of each y-axis at the start of the drag.
  // If any axis has a valueRange, then we want a 2D pan.
  // We can't store data directly in g.axes_, because it does not belong to us
  // and could change out from under us during a pan (say if there's a data
  // update).
  context.is2DPan = false;
  context.axes = [];
  for (i = 0; i < g.axes_.length; i++) {
    axis = g.axes_[i];
    var axis_data = {};
    var yRange = g.yAxisRange(i);
    // TODO(konigsberg): These values should be in |context|.
    // In log scale, initialTopValue, dragValueRange and unitsPerPixel are log scale.
    var logscale = g.attributes_.getForAxis("logscale", i);
    if (logscale) {
      axis_data.initialTopValue = utils.log10(yRange[1]);
      axis_data.dragValueRange = utils.log10(yRange[1]) - utils.log10(yRange[0]);
    } else {
      axis_data.initialTopValue = yRange[1];
      axis_data.dragValueRange = yRange[1] - yRange[0];
    }
    axis_data.unitsPerPixel = axis_data.dragValueRange / (g.plotter_.area.h - 1);
    context.axes.push(axis_data);

    // While calculating axes, set 2dpan.
    if (axis.valueRange) context.is2DPan = true;
  }
};

/**
 * Called in response to an interaction model operation that
 * responds to an event that pans the view.
 *
 * It's used in the default callback for "mousemove" operations.
 * Custom interaction model builders can use it to provide the default
 * panning behavior.
 *
 * @param {Event} event the event object which led to the movePan call.
 * @param {Dygraph} g The dygraph on which to act.
 * @param {Object} context The dragging context object (with
 *     dragStartX/dragStartY/etc. properties). This function modifies the
 *     context.
 */
DygraphInteraction.movePan = function (event, g, context) {
  context.dragEndX = utils.dragGetX_(event, context);
  context.dragEndY = utils.dragGetY_(event, context);

  var minDate = context.initialLeftmostDate - (context.dragEndX - context.dragStartX) * context.xUnitsPerPixel;
  if (context.boundedDates) {
    minDate = Math.max(minDate, context.boundedDates[0]);
  }
  var maxDate = minDate + context.dateRange;
  if (context.boundedDates) {
    if (maxDate > context.boundedDates[1]) {
      // Adjust minDate, and recompute maxDate.
      minDate = minDate - (maxDate - context.boundedDates[1]);
      maxDate = minDate + context.dateRange;
    }
  }

  if (g.getOptionForAxis("logscale", "x")) {
    g.dateWindow_ = [Math.pow(utils.LOG_SCALE, minDate), Math.pow(utils.LOG_SCALE, maxDate)];
  } else {
    g.dateWindow_ = [minDate, maxDate];
  }

  // y-axis scaling is automatic unless this is a full 2D pan.
  if (context.is2DPan) {

    var pixelsDragged = context.dragEndY - context.dragStartY;

    // Adjust each axis appropriately.
    for (var i = 0; i < g.axes_.length; i++) {
      var axis = g.axes_[i];
      var axis_data = context.axes[i];
      var unitsDragged = pixelsDragged * axis_data.unitsPerPixel;

      var boundedValue = context.boundedValues ? context.boundedValues[i] : null;

      // In log scale, maxValue and minValue are the logs of those values.
      var maxValue = axis_data.initialTopValue + unitsDragged;
      if (boundedValue) {
        maxValue = Math.min(maxValue, boundedValue[1]);
      }
      var minValue = maxValue - axis_data.dragValueRange;
      if (boundedValue) {
        if (minValue < boundedValue[0]) {
          // Adjust maxValue, and recompute minValue.
          maxValue = maxValue - (minValue - boundedValue[0]);
          minValue = maxValue - axis_data.dragValueRange;
        }
      }
      if (g.attributes_.getForAxis("logscale", i)) {
        axis.valueRange = [Math.pow(utils.LOG_SCALE, minValue), Math.pow(utils.LOG_SCALE, maxValue)];
      } else {
        axis.valueRange = [minValue, maxValue];
      }
    }
  }

  g.drawGraph_(false);
};

/**
 * Called in response to an interaction model operation that
 * responds to an event that ends panning.
 *
 * It's used in the default callback for "mouseup" operations.
 * Custom interaction model builders can use it to provide the default
 * panning behavior.
 *
 * @param {Event} event the event object which led to the endPan call.
 * @param {Dygraph} g The dygraph on which to act.
 * @param {Object} context The dragging context object (with
 *     dragStartX/dragStartY/etc. properties). This function modifies the
 *     context.
 */
DygraphInteraction.endPan = DygraphInteraction.maybeTreatMouseOpAsClick;

/**
 * Called in response to an interaction model operation that
 * responds to an event that starts zooming.
 *
 * It's used in the default callback for "mousedown" operations.
 * Custom interaction model builders can use it to provide the default
 * zooming behavior.
 *
 * @param {Event} event the event object which led to the startZoom call.
 * @param {Dygraph} g The dygraph on which to act.
 * @param {Object} context The dragging context object (with
 *     dragStartX/dragStartY/etc. properties). This function modifies the
 *     context.
 */
DygraphInteraction.startZoom = function (event, g, context) {
  context.isZooming = true;
  context.zoomMoved = false;
};

/**
 * Called in response to an interaction model operation that
 * responds to an event that defines zoom boundaries.
 *
 * It's used in the default callback for "mousemove" operations.
 * Custom interaction model builders can use it to provide the default
 * zooming behavior.
 *
 * @param {Event} event the event object which led to the moveZoom call.
 * @param {Dygraph} g The dygraph on which to act.
 * @param {Object} context The dragging context object (with
 *     dragStartX/dragStartY/etc. properties). This function modifies the
 *     context.
 */
DygraphInteraction.moveZoom = function (event, g, context) {
  context.zoomMoved = true;
  context.dragEndX = utils.dragGetX_(event, context);
  context.dragEndY = utils.dragGetY_(event, context);

  var xDelta = Math.abs(context.dragStartX - context.dragEndX);
  var yDelta = Math.abs(context.dragStartY - context.dragEndY);

  // drag direction threshold for y axis is twice as large as x axis
  context.dragDirection = xDelta < yDelta / 2 ? utils.VERTICAL : utils.HORIZONTAL;

  g.drawZoomRect_(context.dragDirection, context.dragStartX, context.dragEndX, context.dragStartY, context.dragEndY, context.prevDragDirection, context.prevEndX, context.prevEndY);

  context.prevEndX = context.dragEndX;
  context.prevEndY = context.dragEndY;
  context.prevDragDirection = context.dragDirection;
};

/**
 * TODO(danvk): move this logic into dygraph.js
 * @param {Dygraph} g
 * @param {Event} event
 * @param {Object} context
 */
DygraphInteraction.treatMouseOpAsClick = function (g, event, context) {
  var clickCallback = g.getFunctionOption('clickCallback');
  var pointClickCallback = g.getFunctionOption('pointClickCallback');

  var selectedPoint = null;

  // Find out if the click occurs on a point.
  var closestIdx = -1;
  var closestDistance = Number.MAX_VALUE;

  // check if the click was on a particular point.
  for (var i = 0; i < g.selPoints_.length; i++) {
    var p = g.selPoints_[i];
    var distance = Math.pow(p.canvasx - context.dragEndX, 2) + Math.pow(p.canvasy - context.dragEndY, 2);
    if (!isNaN(distance) && (closestIdx == -1 || distance < closestDistance)) {
      closestDistance = distance;
      closestIdx = i;
    }
  }

  // Allow any click within two pixels of the dot.
  var radius = g.getNumericOption('highlightCircleSize') + 2;
  if (closestDistance <= radius * radius) {
    selectedPoint = g.selPoints_[closestIdx];
  }

  if (selectedPoint) {
    var e = {
      cancelable: true,
      point: selectedPoint,
      canvasx: context.dragEndX,
      canvasy: context.dragEndY
    };
    var defaultPrevented = g.cascadeEvents_('pointClick', e);
    if (defaultPrevented) {
      // Note: this also prevents click / clickCallback from firing.
      return;
    }
    if (pointClickCallback) {
      pointClickCallback.call(g, event, selectedPoint);
    }
  }

  var e = {
    cancelable: true,
    xval: g.lastx_, // closest point by x value
    pts: g.selPoints_,
    canvasx: context.dragEndX,
    canvasy: context.dragEndY
  };
  if (!g.cascadeEvents_('click', e)) {
    if (clickCallback) {
      // TODO(danvk): pass along more info about the points, e.g. 'x'
      clickCallback.call(g, event, g.lastx_, g.selPoints_);
    }
  }
};

/**
 * Called in response to an interaction model operation that
 * responds to an event that performs a zoom based on previously defined
 * bounds..
 *
 * It's used in the default callback for "mouseup" operations.
 * Custom interaction model builders can use it to provide the default
 * zooming behavior.
 *
 * @param {Event} event the event object which led to the endZoom call.
 * @param {Dygraph} g The dygraph on which to end the zoom.
 * @param {Object} context The dragging context object (with
 *     dragStartX/dragStartY/etc. properties). This function modifies the
 *     context.
 */
DygraphInteraction.endZoom = function (event, g, context) {
  g.clearZoomRect_();
  context.isZooming = false;
  DygraphInteraction.maybeTreatMouseOpAsClick(event, g, context);

  // The zoom rectangle is visibly clipped to the plot area, so its behavior
  // should be as well.
  // See http://code.google.com/p/dygraphs/issues/detail?id=280
  var plotArea = g.getArea();
  if (context.regionWidth >= 10 && context.dragDirection == utils.HORIZONTAL) {
    var left = Math.min(context.dragStartX, context.dragEndX),
        right = Math.max(context.dragStartX, context.dragEndX);
    left = Math.max(left, plotArea.x);
    right = Math.min(right, plotArea.x + plotArea.w);
    if (left < right) {
      g.doZoomX_(left, right);
    }
    context.cancelNextDblclick = true;
  } else if (context.regionHeight >= 10 && context.dragDirection == utils.VERTICAL) {
    var top = Math.min(context.dragStartY, context.dragEndY),
        bottom = Math.max(context.dragStartY, context.dragEndY);
    top = Math.max(top, plotArea.y);
    bottom = Math.min(bottom, plotArea.y + plotArea.h);
    if (top < bottom) {
      g.doZoomY_(top, bottom);
    }
    context.cancelNextDblclick = true;
  }
  context.dragStartX = null;
  context.dragStartY = null;
};

/**
 * @private
 */
DygraphInteraction.startTouch = function (event, g, context) {
  event.preventDefault(); // touch browsers are all nice.
  if (event.touches.length > 1) {
    // If the user ever puts two fingers down, it's not a double tap.
    context.startTimeForDoubleTapMs = null;
  }

  var touches = [];
  for (var i = 0; i < event.touches.length; i++) {
    var t = event.touches[i];
    // we dispense with 'dragGetX_' because all touchBrowsers support pageX
    touches.push({
      pageX: t.pageX,
      pageY: t.pageY,
      dataX: g.toDataXCoord(t.pageX),
      dataY: g.toDataYCoord(t.pageY)
      // identifier: t.identifier
    });
  }
  context.initialTouches = touches;

  if (touches.length == 1) {
    // This is just a swipe.
    context.initialPinchCenter = touches[0];
    context.touchDirections = { x: true, y: true };
  } else if (touches.length >= 2) {
    // It's become a pinch!
    // In case there are 3+ touches, we ignore all but the "first" two.

    // only screen coordinates can be averaged (data coords could be log scale).
    context.initialPinchCenter = {
      pageX: 0.5 * (touches[0].pageX + touches[1].pageX),
      pageY: 0.5 * (touches[0].pageY + touches[1].pageY),

      // TODO(danvk): remove
      dataX: 0.5 * (touches[0].dataX + touches[1].dataX),
      dataY: 0.5 * (touches[0].dataY + touches[1].dataY)
    };

    // Make pinches in a 45-degree swath around either axis 1-dimensional zooms.
    var initialAngle = 180 / Math.PI * Math.atan2(context.initialPinchCenter.pageY - touches[0].pageY, touches[0].pageX - context.initialPinchCenter.pageX);

    // use symmetry to get it into the first quadrant.
    initialAngle = Math.abs(initialAngle);
    if (initialAngle > 90) initialAngle = 90 - initialAngle;

    context.touchDirections = {
      x: initialAngle < 90 - 45 / 2,
      y: initialAngle > 45 / 2
    };
  }

  // save the full x & y ranges.
  context.initialRange = {
    x: g.xAxisRange(),
    y: g.yAxisRange()
  };
};

/**
 * @private
 */
DygraphInteraction.moveTouch = function (event, g, context) {
  // If the tap moves, then it's definitely not part of a double-tap.
  context.startTimeForDoubleTapMs = null;

  var i,
      touches = [];
  for (i = 0; i < event.touches.length; i++) {
    var t = event.touches[i];
    touches.push({
      pageX: t.pageX,
      pageY: t.pageY
    });
  }
  var initialTouches = context.initialTouches;

  var c_now;

  // old and new centers.
  var c_init = context.initialPinchCenter;
  if (touches.length == 1) {
    c_now = touches[0];
  } else {
    c_now = {
      pageX: 0.5 * (touches[0].pageX + touches[1].pageX),
      pageY: 0.5 * (touches[0].pageY + touches[1].pageY)
    };
  }

  // this is the "swipe" component
  // we toss it out for now, but could use it in the future.
  var swipe = {
    pageX: c_now.pageX - c_init.pageX,
    pageY: c_now.pageY - c_init.pageY
  };
  var dataWidth = context.initialRange.x[1] - context.initialRange.x[0];
  var dataHeight = context.initialRange.y[0] - context.initialRange.y[1];
  swipe.dataX = swipe.pageX / g.plotter_.area.w * dataWidth;
  swipe.dataY = swipe.pageY / g.plotter_.area.h * dataHeight;
  var xScale, yScale;

  // The residual bits are usually split into scale & rotate bits, but we split
  // them into x-scale and y-scale bits.
  if (touches.length == 1) {
    xScale = 1.0;
    yScale = 1.0;
  } else if (touches.length >= 2) {
    var initHalfWidth = initialTouches[1].pageX - c_init.pageX;
    xScale = (touches[1].pageX - c_now.pageX) / initHalfWidth;

    var initHalfHeight = initialTouches[1].pageY - c_init.pageY;
    yScale = (touches[1].pageY - c_now.pageY) / initHalfHeight;
  }

  // Clip scaling to [1/8, 8] to prevent too much blowup.
  xScale = Math.min(8, Math.max(0.125, xScale));
  yScale = Math.min(8, Math.max(0.125, yScale));

  var didZoom = false;
  if (context.touchDirections.x) {
    g.dateWindow_ = [c_init.dataX - swipe.dataX + (context.initialRange.x[0] - c_init.dataX) / xScale, c_init.dataX - swipe.dataX + (context.initialRange.x[1] - c_init.dataX) / xScale];
    didZoom = true;
  }

  if (context.touchDirections.y) {
    for (i = 0; i < 1 /*g.axes_.length*/; i++) {
      var axis = g.axes_[i];
      var logscale = g.attributes_.getForAxis("logscale", i);
      if (logscale) {
        // TODO(danvk): implement
      } else {
          axis.valueRange = [c_init.dataY - swipe.dataY + (context.initialRange.y[0] - c_init.dataY) / yScale, c_init.dataY - swipe.dataY + (context.initialRange.y[1] - c_init.dataY) / yScale];
          didZoom = true;
        }
    }
  }

  g.drawGraph_(false);

  // We only call zoomCallback on zooms, not pans, to mirror desktop behavior.
  if (didZoom && touches.length > 1 && g.getFunctionOption('zoomCallback')) {
    var viewWindow = g.xAxisRange();
    g.getFunctionOption("zoomCallback").call(g, viewWindow[0], viewWindow[1], g.yAxisRanges());
  }
};

/**
 * @private
 */
DygraphInteraction.endTouch = function (event, g, context) {
  if (event.touches.length !== 0) {
    // this is effectively a "reset"
    DygraphInteraction.startTouch(event, g, context);
  } else if (event.changedTouches.length == 1) {
    // Could be part of a "double tap"
    // The heuristic here is that it's a double-tap if the two touchend events
    // occur within 500ms and within a 50x50 pixel box.
    var now = new Date().getTime();
    var t = event.changedTouches[0];
    if (context.startTimeForDoubleTapMs && now - context.startTimeForDoubleTapMs < 500 && context.doubleTapX && Math.abs(context.doubleTapX - t.screenX) < 50 && context.doubleTapY && Math.abs(context.doubleTapY - t.screenY) < 50) {
      g.resetZoom();
    } else {
      context.startTimeForDoubleTapMs = now;
      context.doubleTapX = t.screenX;
      context.doubleTapY = t.screenY;
    }
  }
};

// Determine the distance from x to [left, right].
var distanceFromInterval = function distanceFromInterval(x, left, right) {
  if (x < left) {
    return left - x;
  } else if (x > right) {
    return x - right;
  } else {
    return 0;
  }
};

/**
 * Returns the number of pixels by which the event happens from the nearest
 * edge of the chart. For events in the interior of the chart, this returns zero.
 */
var distanceFromChart = function distanceFromChart(event, g) {
  var chartPos = utils.findPos(g.canvas_);
  var box = {
    left: chartPos.x,
    right: chartPos.x + g.canvas_.offsetWidth,
    top: chartPos.y,
    bottom: chartPos.y + g.canvas_.offsetHeight
  };

  var pt = {
    x: utils.pageX(event),
    y: utils.pageY(event)
  };

  var dx = distanceFromInterval(pt.x, box.left, box.right),
      dy = distanceFromInterval(pt.y, box.top, box.bottom);
  return Math.max(dx, dy);
};

/**
 * Default interation model for dygraphs. You can refer to specific elements of
 * this when constructing your own interaction model, e.g.:
 * g.updateOptions( {
 *   interactionModel: {
 *     mousedown: DygraphInteraction.defaultInteractionModel.mousedown
 *   }
 * } );
 */
DygraphInteraction.defaultModel = {
  // Track the beginning of drag events
  mousedown: function mousedown(event, g, context) {
    // Right-click should not initiate a zoom.
    if (event.button && event.button == 2) return;

    context.initializeMouseDown(event, g, context);

    if (event.altKey || event.shiftKey) {
      DygraphInteraction.startPan(event, g, context);
    } else {
      DygraphInteraction.startZoom(event, g, context);
    }

    // Note: we register mousemove/mouseup on document to allow some leeway for
    // events to move outside of the chart. Interaction model events get
    // registered on the canvas, which is too small to allow this.
    var mousemove = function mousemove(event) {
      if (context.isZooming) {
        // When the mouse moves >200px from the chart edge, cancel the zoom.
        var d = distanceFromChart(event, g);
        if (d < DRAG_EDGE_MARGIN) {
          DygraphInteraction.moveZoom(event, g, context);
        } else {
          if (context.dragEndX !== null) {
            context.dragEndX = null;
            context.dragEndY = null;
            g.clearZoomRect_();
          }
        }
      } else if (context.isPanning) {
        DygraphInteraction.movePan(event, g, context);
      }
    };
    var mouseup = function mouseup(event) {
      if (context.isZooming) {
        if (context.dragEndX !== null) {
          DygraphInteraction.endZoom(event, g, context);
        } else {
          DygraphInteraction.maybeTreatMouseOpAsClick(event, g, context);
        }
      } else if (context.isPanning) {
        DygraphInteraction.endPan(event, g, context);
      }

      utils.removeEvent(document, 'mousemove', mousemove);
      utils.removeEvent(document, 'mouseup', mouseup);
      context.destroy();
    };

    g.addAndTrackEvent(document, 'mousemove', mousemove);
    g.addAndTrackEvent(document, 'mouseup', mouseup);
  },
  willDestroyContextMyself: true,

  touchstart: function touchstart(event, g, context) {
    DygraphInteraction.startTouch(event, g, context);
  },
  touchmove: function touchmove(event, g, context) {
    DygraphInteraction.moveTouch(event, g, context);
  },
  touchend: function touchend(event, g, context) {
    DygraphInteraction.endTouch(event, g, context);
  },

  // Disable zooming out if panning.
  dblclick: function dblclick(event, g, context) {
    if (context.cancelNextDblclick) {
      context.cancelNextDblclick = false;
      return;
    }

    // Give plugins a chance to grab this event.
    var e = {
      canvasx: context.dragEndX,
      canvasy: context.dragEndY
    };
    if (g.cascadeEvents_('dblclick', e)) {
      return;
    }

    if (event.altKey || event.shiftKey) {
      return;
    }
    g.resetZoom();
  }
};

/*
Dygraph.DEFAULT_ATTRS.interactionModel = DygraphInteraction.defaultModel;

// old ways of accessing these methods/properties
Dygraph.defaultInteractionModel = DygraphInteraction.defaultModel;
Dygraph.endZoom = DygraphInteraction.endZoom;
Dygraph.moveZoom = DygraphInteraction.moveZoom;
Dygraph.startZoom = DygraphInteraction.startZoom;
Dygraph.endPan = DygraphInteraction.endPan;
Dygraph.movePan = DygraphInteraction.movePan;
Dygraph.startPan = DygraphInteraction.startPan;
*/

DygraphInteraction.nonInteractiveModel_ = {
  mousedown: function mousedown(event, g, context) {
    context.initializeMouseDown(event, g, context);
  },
  mouseup: DygraphInteraction.maybeTreatMouseOpAsClick
};

// Default interaction model when using the range selector.
DygraphInteraction.dragIsPanInteractionModel = {
  mousedown: function mousedown(event, g, context) {
    context.initializeMouseDown(event, g, context);
    DygraphInteraction.startPan(event, g, context);
  },
  mousemove: function mousemove(event, g, context) {
    if (context.isPanning) {
      DygraphInteraction.movePan(event, g, context);
    }
  },
  mouseup: function mouseup(event, g, context) {
    if (context.isPanning) {
      DygraphInteraction.endPan(event, g, context);
    }
  }
};

exports["default"] = DygraphInteraction;
module.exports = exports["default"];

},{"./dygraph-utils":138}],134:[function(require,module,exports){
/**
 * @license
 * Copyright 2011 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview Based on PlotKitLayout, but modified to meet the needs of
 * dygraphs.
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _dygraphUtils = require('./dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

/**
 * Creates a new DygraphLayout object.
 *
 * This class contains all the data to be charted.
 * It uses data coordinates, but also records the chart range (in data
 * coordinates) and hence is able to calculate percentage positions ('In this
 * view, Point A lies 25% down the x-axis.')
 *
 * Two things that it does not do are:
 * 1. Record pixel coordinates for anything.
 * 2. (oddly) determine anything about the layout of chart elements.
 *
 * The naming is a vestige of Dygraph's original PlotKit roots.
 *
 * @constructor
 */
var DygraphLayout = function DygraphLayout(dygraph) {
  this.dygraph_ = dygraph;
  /**
   * Array of points for each series.
   *
   * [series index][row index in series] = |Point| structure,
   * where series index refers to visible series only, and the
   * point index is for the reduced set of points for the current
   * zoom region (including one point just outside the window).
   * All points in the same row index share the same X value.
   *
   * @type {Array.<Array.<Dygraph.PointType>>}
   */
  this.points = [];
  this.setNames = [];
  this.annotations = [];
  this.yAxes_ = null;

  // TODO(danvk): it's odd that xTicks_ and yTicks_ are inputs, but xticks and
  // yticks are outputs. Clean this up.
  this.xTicks_ = null;
  this.yTicks_ = null;
};

/**
 * Add points for a single series.
 *
 * @param {string} setname Name of the series.
 * @param {Array.<Dygraph.PointType>} set_xy Points for the series.
 */
DygraphLayout.prototype.addDataset = function (setname, set_xy) {
  this.points.push(set_xy);
  this.setNames.push(setname);
};

/**
 * Returns the box which the chart should be drawn in. This is the canvas's
 * box, less space needed for the axis and chart labels.
 *
 * @return {{x: number, y: number, w: number, h: number}}
 */
DygraphLayout.prototype.getPlotArea = function () {
  return this.area_;
};

// Compute the box which the chart should be drawn in. This is the canvas's
// box, less space needed for axis, chart labels, and other plug-ins.
// NOTE: This should only be called by Dygraph.predraw_().
DygraphLayout.prototype.computePlotArea = function () {
  var area = {
    // TODO(danvk): per-axis setting.
    x: 0,
    y: 0
  };

  area.w = this.dygraph_.width_ - area.x - this.dygraph_.getOption('rightGap');
  area.h = this.dygraph_.height_;

  // Let plugins reserve space.
  var e = {
    chart_div: this.dygraph_.graphDiv,
    reserveSpaceLeft: function reserveSpaceLeft(px) {
      var r = {
        x: area.x,
        y: area.y,
        w: px,
        h: area.h
      };
      area.x += px;
      area.w -= px;
      return r;
    },
    reserveSpaceRight: function reserveSpaceRight(px) {
      var r = {
        x: area.x + area.w - px,
        y: area.y,
        w: px,
        h: area.h
      };
      area.w -= px;
      return r;
    },
    reserveSpaceTop: function reserveSpaceTop(px) {
      var r = {
        x: area.x,
        y: area.y,
        w: area.w,
        h: px
      };
      area.y += px;
      area.h -= px;
      return r;
    },
    reserveSpaceBottom: function reserveSpaceBottom(px) {
      var r = {
        x: area.x,
        y: area.y + area.h - px,
        w: area.w,
        h: px
      };
      area.h -= px;
      return r;
    },
    chartRect: function chartRect() {
      return { x: area.x, y: area.y, w: area.w, h: area.h };
    }
  };
  this.dygraph_.cascadeEvents_('layout', e);

  this.area_ = area;
};

DygraphLayout.prototype.setAnnotations = function (ann) {
  // The Dygraph object's annotations aren't parsed. We parse them here and
  // save a copy. If there is no parser, then the user must be using raw format.
  this.annotations = [];
  var parse = this.dygraph_.getOption('xValueParser') || function (x) {
    return x;
  };
  for (var i = 0; i < ann.length; i++) {
    var a = {};
    if (!ann[i].xval && ann[i].x === undefined) {
      console.error("Annotations must have an 'x' property");
      return;
    }
    if (ann[i].icon && !(ann[i].hasOwnProperty('width') && ann[i].hasOwnProperty('height'))) {
      console.error("Must set width and height when setting " + "annotation.icon property");
      return;
    }
    utils.update(a, ann[i]);
    if (!a.xval) a.xval = parse(a.x);
    this.annotations.push(a);
  }
};

DygraphLayout.prototype.setXTicks = function (xTicks) {
  this.xTicks_ = xTicks;
};

// TODO(danvk): add this to the Dygraph object's API or move it into Layout.
DygraphLayout.prototype.setYAxes = function (yAxes) {
  this.yAxes_ = yAxes;
};

DygraphLayout.prototype.evaluate = function () {
  this._xAxis = {};
  this._evaluateLimits();
  this._evaluateLineCharts();
  this._evaluateLineTicks();
  this._evaluateAnnotations();
};

DygraphLayout.prototype._evaluateLimits = function () {
  var xlimits = this.dygraph_.xAxisRange();
  this._xAxis.minval = xlimits[0];
  this._xAxis.maxval = xlimits[1];
  var xrange = xlimits[1] - xlimits[0];
  this._xAxis.scale = xrange !== 0 ? 1 / xrange : 1.0;

  if (this.dygraph_.getOptionForAxis("logscale", 'x')) {
    this._xAxis.xlogrange = utils.log10(this._xAxis.maxval) - utils.log10(this._xAxis.minval);
    this._xAxis.xlogscale = this._xAxis.xlogrange !== 0 ? 1.0 / this._xAxis.xlogrange : 1.0;
  }
  for (var i = 0; i < this.yAxes_.length; i++) {
    var axis = this.yAxes_[i];
    axis.minyval = axis.computedValueRange[0];
    axis.maxyval = axis.computedValueRange[1];
    axis.yrange = axis.maxyval - axis.minyval;
    axis.yscale = axis.yrange !== 0 ? 1.0 / axis.yrange : 1.0;

    if (this.dygraph_.getOption("logscale")) {
      axis.ylogrange = utils.log10(axis.maxyval) - utils.log10(axis.minyval);
      axis.ylogscale = axis.ylogrange !== 0 ? 1.0 / axis.ylogrange : 1.0;
      if (!isFinite(axis.ylogrange) || isNaN(axis.ylogrange)) {
        console.error('axis ' + i + ' of graph at ' + axis.g + ' can\'t be displayed in log scale for range [' + axis.minyval + ' - ' + axis.maxyval + ']');
      }
    }
  }
};

DygraphLayout.calcXNormal_ = function (value, xAxis, logscale) {
  if (logscale) {
    return (utils.log10(value) - utils.log10(xAxis.minval)) * xAxis.xlogscale;
  } else {
    return (value - xAxis.minval) * xAxis.scale;
  }
};

/**
 * @param {DygraphAxisType} axis
 * @param {number} value
 * @param {boolean} logscale
 * @return {number}
 */
DygraphLayout.calcYNormal_ = function (axis, value, logscale) {
  if (logscale) {
    var x = 1.0 - (utils.log10(value) - utils.log10(axis.minyval)) * axis.ylogscale;
    return isFinite(x) ? x : NaN; // shim for v8 issue; see pull request 276
  } else {
      return 1.0 - (value - axis.minyval) * axis.yscale;
    }
};

DygraphLayout.prototype._evaluateLineCharts = function () {
  var isStacked = this.dygraph_.getOption("stackedGraph");
  var isLogscaleForX = this.dygraph_.getOptionForAxis("logscale", 'x');

  for (var setIdx = 0; setIdx < this.points.length; setIdx++) {
    var points = this.points[setIdx];
    var setName = this.setNames[setIdx];
    var connectSeparated = this.dygraph_.getOption('connectSeparatedPoints', setName);
    var axis = this.dygraph_.axisPropertiesForSeries(setName);
    // TODO (konigsberg): use optionsForAxis instead.
    var logscale = this.dygraph_.attributes_.getForSeries("logscale", setName);

    for (var j = 0; j < points.length; j++) {
      var point = points[j];

      // Range from 0-1 where 0 represents left and 1 represents right.
      point.x = DygraphLayout.calcXNormal_(point.xval, this._xAxis, isLogscaleForX);
      // Range from 0-1 where 0 represents top and 1 represents bottom
      var yval = point.yval;
      if (isStacked) {
        point.y_stacked = DygraphLayout.calcYNormal_(axis, point.yval_stacked, logscale);
        if (yval !== null && !isNaN(yval)) {
          yval = point.yval_stacked;
        }
      }
      if (yval === null) {
        yval = NaN;
        if (!connectSeparated) {
          point.yval = NaN;
        }
      }
      point.y = DygraphLayout.calcYNormal_(axis, yval, logscale);
    }

    this.dygraph_.dataHandler_.onLineEvaluated(points, axis, logscale);
  }
};

DygraphLayout.prototype._evaluateLineTicks = function () {
  var i, tick, label, pos, v, has_tick;
  this.xticks = [];
  for (i = 0; i < this.xTicks_.length; i++) {
    tick = this.xTicks_[i];
    label = tick.label;
    has_tick = !('label_v' in tick);
    v = has_tick ? tick.v : tick.label_v;
    pos = this.dygraph_.toPercentXCoord(v);
    if (pos >= 0.0 && pos < 1.0) {
      this.xticks.push({ pos: pos, label: label, has_tick: has_tick });
    }
  }

  this.yticks = [];
  for (i = 0; i < this.yAxes_.length; i++) {
    var axis = this.yAxes_[i];
    for (var j = 0; j < axis.ticks.length; j++) {
      tick = axis.ticks[j];
      label = tick.label;
      has_tick = !('label_v' in tick);
      v = has_tick ? tick.v : tick.label_v;
      pos = this.dygraph_.toPercentYCoord(v, i);
      if (pos > 0.0 && pos <= 1.0) {
        this.yticks.push({ axis: i, pos: pos, label: label, has_tick: has_tick });
      }
    }
  }
};

DygraphLayout.prototype._evaluateAnnotations = function () {
  // Add the annotations to the point to which they belong.
  // Make a map from (setName, xval) to annotation for quick lookups.
  var i;
  var annotations = {};
  for (i = 0; i < this.annotations.length; i++) {
    var a = this.annotations[i];
    annotations[a.xval + "," + a.series] = a;
  }

  this.annotated_points = [];

  // Exit the function early if there are no annotations.
  if (!this.annotations || !this.annotations.length) {
    return;
  }

  // TODO(antrob): loop through annotations not points.
  for (var setIdx = 0; setIdx < this.points.length; setIdx++) {
    var points = this.points[setIdx];
    for (i = 0; i < points.length; i++) {
      var p = points[i];
      var k = p.xval + "," + p.name;
      if (k in annotations) {
        p.annotation = annotations[k];
        this.annotated_points.push(p);
      }
    }
  }
};

/**
 * Convenience function to remove all the data sets from a graph
 */
DygraphLayout.prototype.removeAllDatasets = function () {
  delete this.points;
  delete this.setNames;
  delete this.setPointsLengths;
  delete this.setPointsOffsets;
  this.points = [];
  this.setNames = [];
  this.setPointsLengths = [];
  this.setPointsOffsets = [];
};

exports['default'] = DygraphLayout;
module.exports = exports['default'];

},{"./dygraph-utils":138}],135:[function(require,module,exports){
(function (process){
/**
 * @license
 * Copyright 2011 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});
var OPTIONS_REFERENCE = null;

// For "production" code, this gets removed by uglifyjs.
if (typeof process !== 'undefined') {
  if ("development" != 'production') {

    // NOTE: in addition to parsing as JS, this snippet is expected to be valid
    // JSON. This assumption cannot be checked in JS, but it will be checked when
    // documentation is generated by the generate-documentation.py script. For the
    // most part, this just means that you should always use double quotes.
    OPTIONS_REFERENCE = // <JSON>
    {
      "xValueParser": {
        "default": "parseFloat() or Date.parse()*",
        "labels": ["CSV parsing"],
        "type": "function(str) -> number",
        "description": "A function which parses x-values (i.e. the dependent series). Must return a number, even when the values are dates. In this case, millis since epoch are used. This is used primarily for parsing CSV data. *=Dygraphs is slightly more accepting in the dates which it will parse. See code for details."
      },
      "stackedGraph": {
        "default": "false",
        "labels": ["Data Line display"],
        "type": "boolean",
        "description": "If set, stack series on top of one another rather than drawing them independently. The first series specified in the input data will wind up on top of the chart and the last will be on bottom. NaN values are drawn as white areas without a line on top, see stackedGraphNaNFill for details."
      },
      "stackedGraphNaNFill": {
        "default": "all",
        "labels": ["Data Line display"],
        "type": "string",
        "description": "Controls handling of NaN values inside a stacked graph. NaN values are interpolated/extended for stacking purposes, but the actual point value remains NaN in the legend display. Valid option values are \"all\" (interpolate internally, repeat leftmost and rightmost value as needed), \"inside\" (interpolate internally only, use zero outside leftmost and rightmost value), and \"none\" (treat NaN as zero everywhere)."
      },
      "pointSize": {
        "default": "1",
        "labels": ["Data Line display"],
        "type": "integer",
        "description": "The size of the dot to draw on each point in pixels (see drawPoints). A dot is always drawn when a point is \"isolated\", i.e. there is a missing point on either side of it. This also controls the size of those dots."
      },
      "drawPoints": {
        "default": "false",
        "labels": ["Data Line display"],
        "type": "boolean",
        "description": "Draw a small dot at each point, in addition to a line going through the point. This makes the individual data points easier to see, but can increase visual clutter in the chart. The small dot can be replaced with a custom rendering by supplying a <a href='#drawPointCallback'>drawPointCallback</a>."
      },
      "drawGapEdgePoints": {
        "default": "false",
        "labels": ["Data Line display"],
        "type": "boolean",
        "description": "Draw points at the edges of gaps in the data. This improves visibility of small data segments or other data irregularities."
      },
      "drawPointCallback": {
        "default": "null",
        "labels": ["Data Line display"],
        "type": "function(g, seriesName, canvasContext, cx, cy, color, pointSize)",
        "parameters": [["g", "the reference graph"], ["seriesName", "the name of the series"], ["canvasContext", "the canvas to draw on"], ["cx", "center x coordinate"], ["cy", "center y coordinate"], ["color", "series color"], ["pointSize", "the radius of the image."], ["idx", "the row-index of the point in the data."]],
        "description": "Draw a custom item when drawPoints is enabled. Default is a small dot matching the series color. This method should constrain drawing to within pointSize pixels from (cx, cy).  Also see <a href='#drawHighlightPointCallback'>drawHighlightPointCallback</a>"
      },
      "height": {
        "default": "320",
        "labels": ["Overall display"],
        "type": "integer",
        "description": "Height, in pixels, of the chart. If the container div has been explicitly sized, this will be ignored."
      },
      "zoomCallback": {
        "default": "null",
        "labels": ["Callbacks"],
        "type": "function(minDate, maxDate, yRanges)",
        "parameters": [["minDate", "milliseconds since epoch"], ["maxDate", "milliseconds since epoch."], ["yRanges", "is an array of [bottom, top] pairs, one for each y-axis."]],
        "description": "A function to call when the zoom window is changed (either by zooming in or out). When animatedZooms is set, zoomCallback is called once at the end of the transition (it will not be called for intermediate frames)."
      },
      "pointClickCallback": {
        "snippet": "function(e, point){<br>&nbsp;&nbsp;alert(point);<br>}",
        "default": "null",
        "labels": ["Callbacks", "Interactive Elements"],
        "type": "function(e, point)",
        "parameters": [["e", "the event object for the click"], ["point", "the point that was clicked See <a href='#point_properties'>Point properties</a> for details"]],
        "description": "A function to call when a data point is clicked. and the point that was clicked."
      },
      "color": {
        "default": "(see description)",
        "labels": ["Data Series Colors"],
        "type": "string",
        "example": "red",
        "description": "A per-series color definition. Used in conjunction with, and overrides, the colors option."
      },
      "colors": {
        "default": "(see description)",
        "labels": ["Data Series Colors"],
        "type": "array<string>",
        "example": "['red', '#00FF00']",
        "description": "List of colors for the data series. These can be of the form \"#AABBCC\" or \"rgb(255,100,200)\" or \"yellow\", etc. If not specified, equally-spaced points around a color wheel are used. Overridden by the 'color' option."
      },
      "connectSeparatedPoints": {
        "default": "false",
        "labels": ["Data Line display"],
        "type": "boolean",
        "description": "Usually, when Dygraphs encounters a missing value in a data series, it interprets this as a gap and draws it as such. If, instead, the missing values represents an x-value for which only a different series has data, then you'll want to connect the dots by setting this to true. To explicitly include a gap with this option set, use a value of NaN."
      },
      "highlightCallback": {
        "default": "null",
        "labels": ["Callbacks"],
        "type": "function(event, x, points, row, seriesName)",
        "description": "When set, this callback gets called every time a new point is highlighted.",
        "parameters": [["event", "the JavaScript mousemove event"], ["x", "the x-coordinate of the highlighted points"], ["points", "an array of highlighted points: <code>[ {name: 'series', yval: y-value}, &hellip; ]</code>"], ["row", "integer index of the highlighted row in the data table, starting from 0"], ["seriesName", "name of the highlighted series, only present if highlightSeriesOpts is set."]]
      },
      "drawHighlightPointCallback": {
        "default": "null",
        "labels": ["Data Line display"],
        "type": "function(g, seriesName, canvasContext, cx, cy, color, pointSize)",
        "parameters": [["g", "the reference graph"], ["seriesName", "the name of the series"], ["canvasContext", "the canvas to draw on"], ["cx", "center x coordinate"], ["cy", "center y coordinate"], ["color", "series color"], ["pointSize", "the radius of the image."], ["idx", "the row-index of the point in the data."]],
        "description": "Draw a custom item when a point is highlighted.  Default is a small dot matching the series color. This method should constrain drawing to within pointSize pixels from (cx, cy) Also see <a href='#drawPointCallback'>drawPointCallback</a>"
      },
      "highlightSeriesOpts": {
        "default": "null",
        "labels": ["Interactive Elements"],
        "type": "Object",
        "description": "When set, the options from this object are applied to the timeseries closest to the mouse pointer for interactive highlighting. See also 'highlightCallback'. Example: highlightSeriesOpts: { strokeWidth: 3 }."
      },
      "highlightSeriesBackgroundAlpha": {
        "default": "0.5",
        "labels": ["Interactive Elements"],
        "type": "float",
        "description": "Fade the background while highlighting series. 1=fully visible background (disable fading), 0=hiddden background (show highlighted series only)."
      },
      "highlightSeriesBackgroundColor": {
        "default": "rgb(255, 255, 255)",
        "labels": ["Interactive Elements"],
        "type": "string",
        "description": "Sets the background color used to fade out the series in conjunction with 'highlightSeriesBackgroundAlpha'."
      },
      "includeZero": {
        "default": "false",
        "labels": ["Axis display"],
        "type": "boolean",
        "description": "Usually, dygraphs will use the range of the data plus some padding to set the range of the y-axis. If this option is set, the y-axis will always include zero, typically as the lowest value. This can be used to avoid exaggerating the variance in the data"
      },
      "rollPeriod": {
        "default": "1",
        "labels": ["Error Bars", "Rolling Averages"],
        "type": "integer &gt;= 1",
        "description": "Number of days over which to average data. Discussed extensively above."
      },
      "unhighlightCallback": {
        "default": "null",
        "labels": ["Callbacks"],
        "type": "function(event)",
        "parameters": [["event", "the mouse event"]],
        "description": "When set, this callback gets called every time the user stops highlighting any point by mousing out of the graph."
      },
      "axisTickSize": {
        "default": "3.0",
        "labels": ["Axis display"],
        "type": "number",
        "description": "The size of the line to display next to each tick mark on x- or y-axes."
      },
      "labelsSeparateLines": {
        "default": "false",
        "labels": ["Legend"],
        "type": "boolean",
        "description": "Put <code>&lt;br/&gt;</code> between lines in the label string. Often used in conjunction with <strong>labelsDiv</strong>."
      },
      "valueFormatter": {
        "default": "Depends on the type of your data.",
        "labels": ["Legend", "Value display/formatting"],
        "type": "function(num or millis, opts, seriesName, dygraph, row, col)",
        "description": "Function to provide a custom display format for the values displayed on mouseover. This does not affect the values that appear on tick marks next to the axes. To format those, see axisLabelFormatter. This is usually set on a <a href='per-axis.html'>per-axis</a> basis. .",
        "parameters": [["num_or_millis", "The value to be formatted. This is always a number. For date axes, it's millis since epoch. You can call new Date(millis) to get a Date object."], ["opts", "This is a function you can call to access various options (e.g. opts('labelsKMB')). It returns per-axis values for the option when available."], ["seriesName", "The name of the series from which the point came, e.g. 'X', 'Y', 'A', etc."], ["dygraph", "The dygraph object for which the formatting is being done"], ["row", "The row of the data from which this point comes. g.getValue(row, 0) will return the x-value for this point."], ["col", "The column of the data from which this point comes. g.getValue(row, col) will return the original y-value for this point. This can be used to get the full confidence interval for the point, or access un-rolled values for the point."]]
      },
      "annotationMouseOverHandler": {
        "default": "null",
        "labels": ["Annotations"],
        "type": "function(annotation, point, dygraph, event)",
        "description": "If provided, this function is called whenever the user mouses over an annotation."
      },
      "annotationMouseOutHandler": {
        "default": "null",
        "labels": ["Annotations"],
        "type": "function(annotation, point, dygraph, event)",
        "parameters": [["annotation", "the annotation left"], ["point", "the point associated with the annotation"], ["dygraph", "the reference graph"], ["event", "the mouse event"]],
        "description": "If provided, this function is called whenever the user mouses out of an annotation."
      },
      "annotationClickHandler": {
        "default": "null",
        "labels": ["Annotations"],
        "type": "function(annotation, point, dygraph, event)",
        "parameters": [["annotation", "the annotation left"], ["point", "the point associated with the annotation"], ["dygraph", "the reference graph"], ["event", "the mouse event"]],
        "description": "If provided, this function is called whenever the user clicks on an annotation."
      },
      "annotationDblClickHandler": {
        "default": "null",
        "labels": ["Annotations"],
        "type": "function(annotation, point, dygraph, event)",
        "parameters": [["annotation", "the annotation left"], ["point", "the point associated with the annotation"], ["dygraph", "the reference graph"], ["event", "the mouse event"]],
        "description": "If provided, this function is called whenever the user double-clicks on an annotation."
      },
      "drawCallback": {
        "default": "null",
        "labels": ["Callbacks"],
        "type": "function(dygraph, is_initial)",
        "parameters": [["dygraph", "The graph being drawn"], ["is_initial", "True if this is the initial draw, false for subsequent draws."]],
        "description": "When set, this callback gets called every time the dygraph is drawn. This includes the initial draw, after zooming and repeatedly while panning."
      },
      "labelsKMG2": {
        "default": "false",
        "labels": ["Value display/formatting"],
        "type": "boolean",
        "description": "Show k/M/G for kilo/Mega/Giga on y-axis. This is different than <code>labelsKMB</code> in that it uses base 2, not 10."
      },
      "delimiter": {
        "default": ",",
        "labels": ["CSV parsing"],
        "type": "string",
        "description": "The delimiter to look for when separating fields of a CSV file. Setting this to a tab is not usually necessary, since tab-delimited data is auto-detected."
      },
      "axisLabelFontSize": {
        "default": "14",
        "labels": ["Axis display"],
        "type": "integer",
        "description": "Size of the font (in pixels) to use in the axis labels, both x- and y-axis."
      },
      "underlayCallback": {
        "default": "null",
        "labels": ["Callbacks"],
        "type": "function(context, area, dygraph)",
        "parameters": [["context", "the canvas drawing context on which to draw"], ["area", "An object with {x,y,w,h} properties describing the drawing area."], ["dygraph", "the reference graph"]],
        "description": "When set, this callback gets called before the chart is drawn. It details on how to use this."
      },
      "width": {
        "default": "480",
        "labels": ["Overall display"],
        "type": "integer",
        "description": "Width, in pixels, of the chart. If the container div has been explicitly sized, this will be ignored."
      },
      "interactionModel": {
        "default": "...",
        "labels": ["Interactive Elements"],
        "type": "Object",
        "description": "TODO(konigsberg): document this"
      },
      "ticker": {
        "default": "Dygraph.dateTicker or Dygraph.numericTicks",
        "labels": ["Axis display"],
        "type": "function(min, max, pixels, opts, dygraph, vals) -> [{v: ..., label: ...}, ...]",
        "parameters": [["min", ""], ["max", ""], ["pixels", ""], ["opts", ""], ["dygraph", "the reference graph"], ["vals", ""]],
        "description": "This lets you specify an arbitrary function to generate tick marks on an axis. The tick marks are an array of (value, label) pairs. The built-in functions go to great lengths to choose good tick marks so, if you set this option, you'll most likely want to call one of them and modify the result. See dygraph-tickers.js for an extensive discussion. This is set on a <a href='per-axis.html'>per-axis</a> basis."
      },
      "xAxisHeight": {
        "default": "(null)",
        "labels": ["Axis display"],
        "type": "integer",
        "description": "Height, in pixels, of the x-axis. If not set explicitly, this is computed based on axisLabelFontSize and axisTickSize."
      },
      "showLabelsOnHighlight": {
        "default": "true",
        "labels": ["Interactive Elements", "Legend"],
        "type": "boolean",
        "description": "Whether to show the legend upon mouseover."
      },
      "axis": {
        "default": "(none)",
        "labels": ["Axis display"],
        "type": "string",
        "description": "Set to either 'y1' or 'y2' to assign a series to a y-axis (primary or secondary). Must be set per-series."
      },
      "pixelsPerLabel": {
        "default": "70 (x-axis) or 30 (y-axes)",
        "labels": ["Axis display", "Grid"],
        "type": "integer",
        "description": "Number of pixels to require between each x- and y-label. Larger values will yield a sparser axis with fewer ticks. This is set on a <a href='per-axis.html'>per-axis</a> basis."
      },
      "labelsDiv": {
        "default": "null",
        "labels": ["Legend"],
        "type": "DOM element or string",
        "example": "<code style='font-size: small'>document.getElementById('foo')</code>or<code>'foo'",
        "description": "Show data labels in an external div, rather than on the graph.  This value can either be a div element or a div id."
      },
      "fractions": {
        "default": "false",
        "labels": ["CSV parsing", "Error Bars"],
        "type": "boolean",
        "description": "When set, attempt to parse each cell in the CSV file as \"a/b\", where a and b are integers. The ratio will be plotted. This allows computation of Wilson confidence intervals (see below)."
      },
      "logscale": {
        "default": "false",
        "labels": ["Axis display"],
        "type": "boolean",
        "description": "When set for the y-axis or x-axis, the graph shows that axis in log scale. Any values less than or equal to zero are not displayed. Showing log scale with ranges that go below zero will result in an unviewable graph.\n\n Not compatible with showZero. connectSeparatedPoints is ignored. This is ignored for date-based x-axes."
      },
      "strokeWidth": {
        "default": "1.0",
        "labels": ["Data Line display"],
        "type": "float",
        "example": "0.5, 2.0",
        "description": "The width of the lines connecting data points. This can be used to increase the contrast or some graphs."
      },
      "strokePattern": {
        "default": "null",
        "labels": ["Data Line display"],
        "type": "array<integer>",
        "example": "[10, 2, 5, 2]",
        "description": "A custom pattern array where the even index is a draw and odd is a space in pixels. If null then it draws a solid line. The array should have a even length as any odd lengthed array could be expressed as a smaller even length array. This is used to create dashed lines."
      },
      "strokeBorderWidth": {
        "default": "null",
        "labels": ["Data Line display"],
        "type": "float",
        "example": "1.0",
        "description": "Draw a border around graph lines to make crossing lines more easily distinguishable. Useful for graphs with many lines."
      },
      "strokeBorderColor": {
        "default": "white",
        "labels": ["Data Line display"],
        "type": "string",
        "example": "red, #ccffdd",
        "description": "Color for the line border used if strokeBorderWidth is set."
      },
      "wilsonInterval": {
        "default": "true",
        "labels": ["Error Bars"],
        "type": "boolean",
        "description": "Use in conjunction with the \"fractions\" option. Instead of plotting +/- N standard deviations, dygraphs will compute a Wilson confidence interval and plot that. This has more reasonable behavior for ratios close to 0 or 1."
      },
      "fillGraph": {
        "default": "false",
        "labels": ["Data Line display"],
        "type": "boolean",
        "description": "Should the area underneath the graph be filled? This option is not compatible with error bars. This may be set on a <a href='per-axis.html'>per-series</a> basis."
      },
      "highlightCircleSize": {
        "default": "3",
        "labels": ["Interactive Elements"],
        "type": "integer",
        "description": "The size in pixels of the dot drawn over highlighted points."
      },
      "gridLineColor": {
        "default": "rgb(128,128,128)",
        "labels": ["Grid"],
        "type": "red, blue",
        "description": "The color of the gridlines. This may be set on a per-axis basis to define each axis' grid separately."
      },
      "gridLinePattern": {
        "default": "null",
        "labels": ["Grid"],
        "type": "array<integer>",
        "example": "[10, 2, 5, 2]",
        "description": "A custom pattern array where the even index is a draw and odd is a space in pixels. If null then it draws a solid line. The array should have a even length as any odd lengthed array could be expressed as a smaller even length array. This is used to create dashed gridlines."
      },
      "visibility": {
        "default": "[true, true, ...]",
        "labels": ["Data Line display"],
        "type": "Array of booleans",
        "description": "Which series should initially be visible? Once the Dygraph has been constructed, you can access and modify the visibility of each series using the <code>visibility</code> and <code>setVisibility</code> methods."
      },
      "valueRange": {
        "default": "Full range of the input is shown",
        "labels": ["Axis display"],
        "type": "Array of two numbers",
        "example": "[10, 110]",
        "description": "Explicitly set the vertical range of the graph to [low, high]. This may be set on a per-axis basis to define each y-axis separately. If either limit is unspecified, it will be calculated automatically (e.g. [null, 30] to automatically calculate just the lower bound)"
      },
      "colorSaturation": {
        "default": "1.0",
        "labels": ["Data Series Colors"],
        "type": "float (0.0 - 1.0)",
        "description": "If <strong>colors</strong> is not specified, saturation of the automatically-generated data series colors."
      },
      "hideOverlayOnMouseOut": {
        "default": "true",
        "labels": ["Interactive Elements", "Legend"],
        "type": "boolean",
        "description": "Whether to hide the legend when the mouse leaves the chart area."
      },
      "legend": {
        "default": "onmouseover",
        "labels": ["Legend"],
        "type": "string",
        "description": "When to display the legend. By default, it only appears when a user mouses over the chart. Set it to \"always\" to always display a legend of some sort. When set to \"follow\", legend follows highlighted points."
      },
      "legendFormatter": {
        "default": "null",
        "labels": ["Legend"],
        "type": "function(data): string",
        "params": [["data", "An object containing information about the selection (or lack of a selection). This includes formatted values and series information. See <a href=\"https://github.com/danvk/dygraphs/pull/683\">here</a> for sample values."]],
        "description": "Set this to supply a custom formatter for the legend. See <a href=\"https://github.com/danvk/dygraphs/pull/683\">this comment</a> and the <a href=\"tests/legend-formatter.html\">legendFormatter demo</a> for usage."
      },
      "labelsShowZeroValues": {
        "default": "true",
        "labels": ["Legend"],
        "type": "boolean",
        "description": "Show zero value labels in the labelsDiv."
      },
      "stepPlot": {
        "default": "false",
        "labels": ["Data Line display"],
        "type": "boolean",
        "description": "When set, display the graph as a step plot instead of a line plot. This option may either be set for the whole graph or for single series."
      },
      "labelsUTC": {
        "default": "false",
        "labels": ["Value display/formatting", "Axis display"],
        "type": "boolean",
        "description": "Show date/time labels according to UTC (instead of local time)."
      },
      "labelsKMB": {
        "default": "false",
        "labels": ["Value display/formatting"],
        "type": "boolean",
        "description": "Show K/M/B for thousands/millions/billions on y-axis."
      },
      "rightGap": {
        "default": "5",
        "labels": ["Overall display"],
        "type": "integer",
        "description": "Number of pixels to leave blank at the right edge of the Dygraph. This makes it easier to highlight the right-most data point."
      },
      "drawAxesAtZero": {
        "default": "false",
        "labels": ["Axis display"],
        "type": "boolean",
        "description": "When set, draw the X axis at the Y=0 position and the Y axis at the X=0 position if those positions are inside the graph's visible area. Otherwise, draw the axes at the bottom or left graph edge as usual."
      },
      "xRangePad": {
        "default": "0",
        "labels": ["Axis display"],
        "type": "float",
        "description": "Add the specified amount of extra space (in pixels) around the X-axis value range to ensure points at the edges remain visible."
      },
      "yRangePad": {
        "default": "null",
        "labels": ["Axis display"],
        "type": "float",
        "description": "If set, add the specified amount of extra space (in pixels) around the Y-axis value range to ensure points at the edges remain visible. If unset, use the traditional Y padding algorithm."
      },
      "axisLabelFormatter": {
        "default": "Depends on the data type",
        "labels": ["Axis display"],
        "type": "function(number or Date, granularity, opts, dygraph)",
        "parameters": [["number or date", "Either a number (for a numeric axis) or a Date object (for a date axis)"], ["granularity", "specifies how fine-grained the axis is. For date axes, this is a reference to the time granularity enumeration, defined in dygraph-tickers.js, e.g. Dygraph.WEEKLY."], ["opts", "a function which provides access to various options on the dygraph, e.g. opts('labelsKMB')."], ["dygraph", "the referenced graph"]],
        "description": "Function to call to format the tick values that appear along an axis. This is usually set on a <a href='per-axis.html'>per-axis</a> basis."
      },
      "clickCallback": {
        "snippet": "function(e, date_millis){<br>&nbsp;&nbsp;alert(new Date(date_millis));<br>}",
        "default": "null",
        "labels": ["Callbacks"],
        "type": "function(e, x, points)",
        "parameters": [["e", "The event object for the click"], ["x", "The x value that was clicked (for dates, this is milliseconds since epoch)"], ["points", "The closest points along that date. See <a href='#point_properties'>Point properties</a> for details."]],
        "description": "A function to call when the canvas is clicked."
      },
      "labels": {
        "default": "[\"X\", \"Y1\", \"Y2\", ...]*",
        "labels": ["Legend"],
        "type": "array<string>",
        "description": "A name for each data series, including the independent (X) series. For CSV files and DataTable objections, this is determined by context. For raw data, this must be specified. If it is not, default values are supplied and a warning is logged."
      },
      "dateWindow": {
        "default": "Full range of the input is shown",
        "labels": ["Axis display"],
        "type": "Array of two numbers",
        "example": "[<br>&nbsp;&nbsp;Date.parse('2006-01-01'),<br>&nbsp;&nbsp;(new Date()).valueOf()<br>]",
        "description": "Initially zoom in on a section of the graph. Is of the form [earliest, latest], where earliest/latest are milliseconds since epoch. If the data for the x-axis is numeric, the values in dateWindow must also be numbers."
      },
      "showRoller": {
        "default": "false",
        "labels": ["Interactive Elements", "Rolling Averages"],
        "type": "boolean",
        "description": "If the rolling average period text box should be shown."
      },
      "sigma": {
        "default": "2.0",
        "labels": ["Error Bars"],
        "type": "float",
        "description": "When errorBars is set, shade this many standard deviations above/below each point."
      },
      "customBars": {
        "default": "false",
        "labels": ["CSV parsing", "Error Bars"],
        "type": "boolean",
        "description": "When set, parse each CSV cell as \"low;middle;high\". Error bars will be drawn for each point between low and high, with the series itself going through middle."
      },
      "colorValue": {
        "default": "1.0",
        "labels": ["Data Series Colors"],
        "type": "float (0.0 - 1.0)",
        "description": "If colors is not specified, value of the data series colors, as in hue/saturation/value. (0.0-1.0, default 0.5)"
      },
      "errorBars": {
        "default": "false",
        "labels": ["CSV parsing", "Error Bars"],
        "type": "boolean",
        "description": "Does the data contain standard deviations? Setting this to true alters the input format (see above)."
      },
      "displayAnnotations": {
        "default": "false",
        "labels": ["Annotations"],
        "type": "boolean",
        "description": "Only applies when Dygraphs is used as a GViz chart. Causes string columns following a data series to be interpreted as annotations on points in that series. This is the same format used by Google's AnnotatedTimeLine chart."
      },
      "panEdgeFraction": {
        "default": "null",
        "labels": ["Axis display", "Interactive Elements"],
        "type": "float",
        "description": "A value representing the farthest a graph may be panned, in percent of the display. For example, a value of 0.1 means that the graph can only be panned 10% pased the edges of the displayed values. null means no bounds."
      },
      "title": {
        "labels": ["Chart labels"],
        "type": "string",
        "default": "null",
        "description": "Text to display above the chart. You can supply any HTML for this value, not just text. If you wish to style it using CSS, use the 'dygraph-label' or 'dygraph-title' classes."
      },
      "titleHeight": {
        "default": "18",
        "labels": ["Chart labels"],
        "type": "integer",
        "description": "Height of the chart title, in pixels. This also controls the default font size of the title. If you style the title on your own, this controls how much space is set aside above the chart for the title's div."
      },
      "xlabel": {
        "labels": ["Chart labels"],
        "type": "string",
        "default": "null",
        "description": "Text to display below the chart's x-axis. You can supply any HTML for this value, not just text. If you wish to style it using CSS, use the 'dygraph-label' or 'dygraph-xlabel' classes."
      },
      "xLabelHeight": {
        "labels": ["Chart labels"],
        "type": "integer",
        "default": "18",
        "description": "Height of the x-axis label, in pixels. This also controls the default font size of the x-axis label. If you style the label on your own, this controls how much space is set aside below the chart for the x-axis label's div."
      },
      "ylabel": {
        "labels": ["Chart labels"],
        "type": "string",
        "default": "null",
        "description": "Text to display to the left of the chart's y-axis. You can supply any HTML for this value, not just text. If you wish to style it using CSS, use the 'dygraph-label' or 'dygraph-ylabel' classes. The text will be rotated 90 degrees by default, so CSS rules may behave in unintuitive ways. No additional space is set aside for a y-axis label. If you need more space, increase the width of the y-axis tick labels using the yAxisLabelWidth option. If you need a wider div for the y-axis label, either style it that way with CSS (but remember that it's rotated, so width is controlled by the 'height' property) or set the yLabelWidth option."
      },
      "y2label": {
        "labels": ["Chart labels"],
        "type": "string",
        "default": "null",
        "description": "Text to display to the right of the chart's secondary y-axis. This label is only displayed if a secondary y-axis is present. See <a href='http://dygraphs.com/tests/two-axes.html'>this test</a> for an example of how to do this. The comments for the 'ylabel' option generally apply here as well. This label gets a 'dygraph-y2label' instead of a 'dygraph-ylabel' class."
      },
      "yLabelWidth": {
        "labels": ["Chart labels"],
        "type": "integer",
        "default": "18",
        "description": "Width of the div which contains the y-axis label. Since the y-axis label appears rotated 90 degrees, this actually affects the height of its div."
      },
      "drawGrid": {
        "default": "true for x and y, false for y2",
        "labels": ["Grid"],
        "type": "boolean",
        "description": "Whether to display gridlines in the chart. This may be set on a per-axis basis to define the visibility of each axis' grid separately."
      },
      "independentTicks": {
        "default": "true for y, false for y2",
        "labels": ["Axis display", "Grid"],
        "type": "boolean",
        "description": "Only valid for y and y2, has no effect on x: This option defines whether the y axes should align their ticks or if they should be independent. Possible combinations: 1.) y=true, y2=false (default): y is the primary axis and the y2 ticks are aligned to the the ones of y. (only 1 grid) 2.) y=false, y2=true: y2 is the primary axis and the y ticks are aligned to the the ones of y2. (only 1 grid) 3.) y=true, y2=true: Both axis are independent and have their own ticks. (2 grids) 4.) y=false, y2=false: Invalid configuration causes an error."
      },
      "drawAxis": {
        "default": "true for x and y, false for y2",
        "labels": ["Axis display"],
        "type": "boolean",
        "description": "Whether to draw the specified axis. This may be set on a per-axis basis to define the visibility of each axis separately. Setting this to false also prevents axis ticks from being drawn and reclaims the space for the chart grid/lines."
      },
      "gridLineWidth": {
        "default": "0.3",
        "labels": ["Grid"],
        "type": "float",
        "description": "Thickness (in pixels) of the gridlines drawn under the chart. The vertical/horizontal gridlines can be turned off entirely by using the drawGrid option. This may be set on a per-axis basis to define each axis' grid separately."
      },
      "axisLineWidth": {
        "default": "0.3",
        "labels": ["Axis display"],
        "type": "float",
        "description": "Thickness (in pixels) of the x- and y-axis lines."
      },
      "axisLineColor": {
        "default": "black",
        "labels": ["Axis display"],
        "type": "string",
        "description": "Color of the x- and y-axis lines. Accepts any value which the HTML canvas strokeStyle attribute understands, e.g. 'black' or 'rgb(0, 100, 255)'."
      },
      "fillAlpha": {
        "default": "0.15",
        "labels": ["Error Bars", "Data Series Colors"],
        "type": "float (0.0 - 1.0)",
        "description": "Error bars (or custom bars) for each series are drawn in the same color as the series, but with partial transparency. This sets the transparency. A value of 0.0 means that the error bars will not be drawn, whereas a value of 1.0 means that the error bars will be as dark as the line for the series itself. This can be used to produce chart lines whose thickness varies at each point."
      },
      "axisLabelWidth": {
        "default": "50 (y-axis), 60 (x-axis)",
        "labels": ["Axis display", "Chart labels"],
        "type": "integer",
        "description": "Width (in pixels) of the containing divs for x- and y-axis labels. For the y-axis, this also controls the width of the y-axis. Note that for the x-axis, this is independent from pixelsPerLabel, which controls the spacing between labels."
      },
      "sigFigs": {
        "default": "null",
        "labels": ["Value display/formatting"],
        "type": "integer",
        "description": "By default, dygraphs displays numbers with a fixed number of digits after the decimal point. If you'd prefer to have a fixed number of significant figures, set this option to that number of sig figs. A value of 2, for instance, would cause 1 to be display as 1.0 and 1234 to be displayed as 1.23e+3."
      },
      "digitsAfterDecimal": {
        "default": "2",
        "labels": ["Value display/formatting"],
        "type": "integer",
        "description": "Unless it's run in scientific mode (see the <code>sigFigs</code> option), dygraphs displays numbers with <code>digitsAfterDecimal</code> digits after the decimal point. Trailing zeros are not displayed, so with a value of 2 you'll get '0', '0.1', '0.12', '123.45' but not '123.456' (it will be rounded to '123.46'). Numbers with absolute value less than 0.1^digitsAfterDecimal (i.e. those which would show up as '0.00') will be displayed in scientific notation."
      },
      "maxNumberWidth": {
        "default": "6",
        "labels": ["Value display/formatting"],
        "type": "integer",
        "description": "When displaying numbers in normal (not scientific) mode, large numbers will be displayed with many trailing zeros (e.g. 100000000 instead of 1e9). This can lead to unwieldy y-axis labels. If there are more than <code>maxNumberWidth</code> digits to the left of the decimal in a number, dygraphs will switch to scientific notation, even when not operating in scientific mode. If you'd like to see all those digits, set this to something large, like 20 or 30."
      },
      "file": {
        "default": "(set when constructed)",
        "labels": ["Data"],
        "type": "string (URL of CSV or CSV), GViz DataTable or 2D Array",
        "description": "Sets the data being displayed in the chart. This can only be set when calling updateOptions; it cannot be set from the constructor. For a full description of valid data formats, see the <a href='http://dygraphs.com/data.html'>Data Formats</a> page."
      },
      "timingName": {
        "default": "null",
        "labels": ["Debugging", "Deprecated"],
        "type": "string",
        "description": "Set this option to log timing information. The value of the option will be logged along with the timimg, so that you can distinguish multiple dygraphs on the same page."
      },
      "showRangeSelector": {
        "default": "false",
        "labels": ["Range Selector"],
        "type": "boolean",
        "description": "Show or hide the range selector widget."
      },
      "rangeSelectorHeight": {
        "default": "40",
        "labels": ["Range Selector"],
        "type": "integer",
        "description": "Height, in pixels, of the range selector widget. This option can only be specified at Dygraph creation time."
      },
      "rangeSelectorPlotStrokeColor": {
        "default": "#808FAB",
        "labels": ["Range Selector"],
        "type": "string",
        "description": "The range selector mini plot stroke color. This can be of the form \"#AABBCC\" or \"rgb(255,100,200)\" or \"yellow\". You can also specify null or \"\" to turn off stroke."
      },
      "rangeSelectorPlotFillColor": {
        "default": "#A7B1C4",
        "labels": ["Range Selector"],
        "type": "string",
        "description": "The range selector mini plot fill color. This can be of the form \"#AABBCC\" or \"rgb(255,100,200)\" or \"yellow\". You can also specify null or \"\" to turn off fill."
      },
      "rangeSelectorPlotFillGradientColor": {
        "default": "white",
        "labels": ["Range Selector"],
        "type": "string",
        "description": "The top color for the range selector mini plot fill color gradient. This can be of the form \"#AABBCC\" or \"rgb(255,100,200)\" or \"rgba(255,100,200,42)\" or \"yellow\". You can also specify null or \"\" to disable the gradient and fill with one single color."
      },
      "rangeSelectorBackgroundStrokeColor": {
        "default": "gray",
        "labels": ["Range Selector"],
        "type": "string",
        "description": "The color of the lines below and on both sides of the range selector mini plot. This can be of the form \"#AABBCC\" or \"rgb(255,100,200)\" or \"yellow\"."
      },
      "rangeSelectorBackgroundLineWidth": {
        "default": "1",
        "labels": ["Range Selector"],
        "type": "float",
        "description": "The width of the lines below and on both sides of the range selector mini plot."
      },
      "rangeSelectorPlotLineWidth": {
        "default": "1.5",
        "labels": ["Range Selector"],
        "type": "float",
        "description": "The width of the range selector mini plot line."
      },
      "rangeSelectorForegroundStrokeColor": {
        "default": "black",
        "labels": ["Range Selector"],
        "type": "string",
        "description": "The color of the lines in the interactive layer of the range selector. This can be of the form \"#AABBCC\" or \"rgb(255,100,200)\" or \"yellow\"."
      },
      "rangeSelectorForegroundLineWidth": {
        "default": "1",
        "labels": ["Range Selector"],
        "type": "float",
        "description": "The width the lines in the interactive layer of the range selector."
      },
      "rangeSelectorAlpha": {
        "default": "0.6",
        "labels": ["Range Selector"],
        "type": "float (0.0 - 1.0)",
        "description": "The transparency of the veil that is drawn over the unselected portions of the range selector mini plot. A value of 0 represents full transparency and the unselected portions of the mini plot will appear as normal. A value of 1 represents full opacity and the unselected portions of the mini plot will be hidden."
      },
      "showInRangeSelector": {
        "default": "null",
        "labels": ["Range Selector"],
        "type": "boolean",
        "description": "Mark this series for inclusion in the range selector. The mini plot curve will be an average of all such series. If this is not specified for any series, the default behavior is to average all the visible series. Setting it for one series will result in that series being charted alone in the range selector. Once it's set for a single series, it needs to be set for all series which should be included (regardless of visibility)."
      },
      "animatedZooms": {
        "default": "false",
        "labels": ["Interactive Elements"],
        "type": "boolean",
        "description": "Set this option to animate the transition between zoom windows. Applies to programmatic and interactive zooms. Note that if you also set a drawCallback, it will be called several times on each zoom. If you set a zoomCallback, it will only be called after the animation is complete."
      },
      "plotter": {
        "default": "[DygraphCanvasRenderer.Plotters.fillPlotter, DygraphCanvasRenderer.Plotters.errorPlotter, DygraphCanvasRenderer.Plotters.linePlotter]",
        "labels": ["Data Line display"],
        "type": "array or function",
        "description": "A function (or array of functions) which plot each data series on the chart. TODO(danvk): more details! May be set per-series."
      },
      "axes": {
        "default": "null",
        "labels": ["Configuration"],
        "type": "Object",
        "description": "Defines per-axis options. Valid keys are 'x', 'y' and 'y2'. Only some options may be set on a per-axis basis. If an option may be set in this way, it will be noted on this page. See also documentation on <a href='http://dygraphs.com/per-axis.html'>per-series and per-axis options</a>."
      },
      "series": {
        "default": "null",
        "labels": ["Series"],
        "type": "Object",
        "description": "Defines per-series options. Its keys match the y-axis label names, and the values are dictionaries themselves that contain options specific to that series."
      },
      "plugins": {
        "default": "[]",
        "labels": ["Configuration"],
        "type": "Array<plugin>",
        "description": "Defines per-graph plugins. Useful for per-graph customization"
      },
      "dataHandler": {
        "default": "(depends on data)",
        "labels": ["Data"],
        "type": "Dygraph.DataHandler",
        "description": "Custom DataHandler. This is an advanced customization. See http://bit.ly/151E7Aq."
      }
    }; // </JSON>
    // NOTE: in addition to parsing as JS, this snippet is expected to be valid
    // JSON. This assumption cannot be checked in JS, but it will be checked when
    // documentation is generated by the generate-documentation.py script. For the
    // most part, this just means that you should always use double quotes.

    // Do a quick sanity check on the options reference.
    var warn = function warn(msg) {
      if (window.console) window.console.warn(msg);
    };
    var flds = ['type', 'default', 'description'];
    var valid_cats = ['Annotations', 'Axis display', 'Chart labels', 'CSV parsing', 'Callbacks', 'Data', 'Data Line display', 'Data Series Colors', 'Error Bars', 'Grid', 'Interactive Elements', 'Range Selector', 'Legend', 'Overall display', 'Rolling Averages', 'Series', 'Value display/formatting', 'Zooming', 'Debugging', 'Configuration', 'Deprecated'];
    var i;
    var cats = {};
    for (i = 0; i < valid_cats.length; i++) cats[valid_cats[i]] = true;

    for (var k in OPTIONS_REFERENCE) {
      if (!OPTIONS_REFERENCE.hasOwnProperty(k)) continue;
      var op = OPTIONS_REFERENCE[k];
      for (i = 0; i < flds.length; i++) {
        if (!op.hasOwnProperty(flds[i])) {
          warn('Option ' + k + ' missing "' + flds[i] + '" property');
        } else if (typeof op[flds[i]] != 'string') {
          warn(k + '.' + flds[i] + ' must be of type string');
        }
      }
      var labels = op.labels;
      if (typeof labels !== 'object') {
        warn('Option "' + k + '" is missing a "labels": [...] option');
      } else {
        for (i = 0; i < labels.length; i++) {
          if (!cats.hasOwnProperty(labels[i])) {
            warn('Option "' + k + '" has label "' + labels[i] + '", which is invalid.');
          }
        }
      }
    }
  }
}

exports['default'] = OPTIONS_REFERENCE;
module.exports = exports['default'];

}).call(this,require('_process'))

},{"_process":122}],136:[function(require,module,exports){
(function (process){
/**
 * @license
 * Copyright 2011 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview DygraphOptions is responsible for parsing and returning
 * information about options.
 */

// TODO: remove this jshint directive & fix the warnings.
/*jshint sub:true */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _dygraphUtils = require('./dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

var _dygraphDefaultAttrs = require('./dygraph-default-attrs');

var _dygraphDefaultAttrs2 = _interopRequireDefault(_dygraphDefaultAttrs);

var _dygraphOptionsReference = require('./dygraph-options-reference');

var _dygraphOptionsReference2 = _interopRequireDefault(_dygraphOptionsReference);

/*
 * Interesting member variables: (REMOVING THIS LIST AS I CLOSURIZE)
 * global_ - global attributes (common among all graphs, AIUI)
 * user - attributes set by the user
 * series_ - { seriesName -> { idx, yAxis, options }}
 */

/**
 * This parses attributes into an object that can be easily queried.
 *
 * It doesn't necessarily mean that all options are available, specifically
 * if labels are not yet available, since those drive details of the per-series
 * and per-axis options.
 *
 * @param {Dygraph} dygraph The chart to which these options belong.
 * @constructor
 */
var DygraphOptions = function DygraphOptions(dygraph) {
  /**
   * The dygraph.
   * @type {!Dygraph}
   */
  this.dygraph_ = dygraph;

  /**
   * Array of axis index to { series : [ series names ] , options : { axis-specific options. }
   * @type {Array.<{series : Array.<string>, options : Object}>} @private
   */
  this.yAxes_ = [];

  /**
   * Contains x-axis specific options, which are stored in the options key.
   * This matches the yAxes_ object structure (by being a dictionary with an
   * options element) allowing for shared code.
   * @type {options: Object} @private
   */
  this.xAxis_ = {};
  this.series_ = {};

  // Once these two objects are initialized, you can call get();
  this.global_ = this.dygraph_.attrs_;
  this.user_ = this.dygraph_.user_attrs_ || {};

  /**
   * A list of series in columnar order.
   * @type {Array.<string>}
   */
  this.labels_ = [];

  this.highlightSeries_ = this.get("highlightSeriesOpts") || {};
  this.reparseSeries();
};

/**
 * Not optimal, but does the trick when you're only using two axes.
 * If we move to more axes, this can just become a function.
 *
 * @type {Object.<number>}
 * @private
 */
DygraphOptions.AXIS_STRING_MAPPINGS_ = {
  'y': 0,
  'Y': 0,
  'y1': 0,
  'Y1': 0,
  'y2': 1,
  'Y2': 1
};

/**
 * @param {string|number} axis
 * @private
 */
DygraphOptions.axisToIndex_ = function (axis) {
  if (typeof axis == "string") {
    if (DygraphOptions.AXIS_STRING_MAPPINGS_.hasOwnProperty(axis)) {
      return DygraphOptions.AXIS_STRING_MAPPINGS_[axis];
    }
    throw "Unknown axis : " + axis;
  }
  if (typeof axis == "number") {
    if (axis === 0 || axis === 1) {
      return axis;
    }
    throw "Dygraphs only supports two y-axes, indexed from 0-1.";
  }
  if (axis) {
    throw "Unknown axis : " + axis;
  }
  // No axis specification means axis 0.
  return 0;
};

/**
 * Reparses options that are all related to series. This typically occurs when
 * options are either updated, or source data has been made available.
 *
 * TODO(konigsberg): The method name is kind of weak; fix.
 */
DygraphOptions.prototype.reparseSeries = function () {
  var labels = this.get("labels");
  if (!labels) {
    return; // -- can't do more for now, will parse after getting the labels.
  }

  this.labels_ = labels.slice(1);

  this.yAxes_ = [{ series: [], options: {} }]; // Always one axis at least.
  this.xAxis_ = { options: {} };
  this.series_ = {};

  // Series are specified in the series element:
  //
  // {
  //   labels: [ "X", "foo", "bar" ],
  //   pointSize: 3,
  //   series : {
  //     foo : {}, // options for foo
  //     bar : {} // options for bar
  //   }
  // }
  //
  // So, if series is found, it's expected to contain per-series data, otherwise set a
  // default.
  var seriesDict = this.user_.series || {};
  for (var idx = 0; idx < this.labels_.length; idx++) {
    var seriesName = this.labels_[idx];
    var optionsForSeries = seriesDict[seriesName] || {};
    var yAxis = DygraphOptions.axisToIndex_(optionsForSeries["axis"]);

    this.series_[seriesName] = {
      idx: idx,
      yAxis: yAxis,
      options: optionsForSeries };

    if (!this.yAxes_[yAxis]) {
      this.yAxes_[yAxis] = { series: [seriesName], options: {} };
    } else {
      this.yAxes_[yAxis].series.push(seriesName);
    }
  }

  var axis_opts = this.user_["axes"] || {};
  utils.update(this.yAxes_[0].options, axis_opts["y"] || {});
  if (this.yAxes_.length > 1) {
    utils.update(this.yAxes_[1].options, axis_opts["y2"] || {});
  }
  utils.update(this.xAxis_.options, axis_opts["x"] || {});

  // For "production" code, this gets removed by uglifyjs.
  if (typeof process !== 'undefined') {
    if ("development" != 'production') {
      this.validateOptions_();
    }
  }
};

/**
 * Get a global value.
 *
 * @param {string} name the name of the option.
 */
DygraphOptions.prototype.get = function (name) {
  var result = this.getGlobalUser_(name);
  if (result !== null) {
    return result;
  }
  return this.getGlobalDefault_(name);
};

DygraphOptions.prototype.getGlobalUser_ = function (name) {
  if (this.user_.hasOwnProperty(name)) {
    return this.user_[name];
  }
  return null;
};

DygraphOptions.prototype.getGlobalDefault_ = function (name) {
  if (this.global_.hasOwnProperty(name)) {
    return this.global_[name];
  }
  if (_dygraphDefaultAttrs2['default'].hasOwnProperty(name)) {
    return _dygraphDefaultAttrs2['default'][name];
  }
  return null;
};

/**
 * Get a value for a specific axis. If there is no specific value for the axis,
 * the global value is returned.
 *
 * @param {string} name the name of the option.
 * @param {string|number} axis the axis to search. Can be the string representation
 * ("y", "y2") or the axis number (0, 1).
 */
DygraphOptions.prototype.getForAxis = function (name, axis) {
  var axisIdx;
  var axisString;

  // Since axis can be a number or a string, straighten everything out here.
  if (typeof axis == 'number') {
    axisIdx = axis;
    axisString = axisIdx === 0 ? "y" : "y2";
  } else {
    if (axis == "y1") {
      axis = "y";
    } // Standardize on 'y'. Is this bad? I think so.
    if (axis == "y") {
      axisIdx = 0;
    } else if (axis == "y2") {
      axisIdx = 1;
    } else if (axis == "x") {
      axisIdx = -1; // simply a placeholder for below.
    } else {
        throw "Unknown axis " + axis;
      }
    axisString = axis;
  }

  var userAxis = axisIdx == -1 ? this.xAxis_ : this.yAxes_[axisIdx];

  // Search the user-specified axis option first.
  if (userAxis) {
    // This condition could be removed if we always set up this.yAxes_ for y2.
    var axisOptions = userAxis.options;
    if (axisOptions.hasOwnProperty(name)) {
      return axisOptions[name];
    }
  }

  // User-specified global options second.
  // But, hack, ignore globally-specified 'logscale' for 'x' axis declaration.
  if (!(axis === 'x' && name === 'logscale')) {
    var result = this.getGlobalUser_(name);
    if (result !== null) {
      return result;
    }
  }
  // Default axis options third.
  var defaultAxisOptions = _dygraphDefaultAttrs2['default'].axes[axisString];
  if (defaultAxisOptions.hasOwnProperty(name)) {
    return defaultAxisOptions[name];
  }

  // Default global options last.
  return this.getGlobalDefault_(name);
};

/**
 * Get a value for a specific series. If there is no specific value for the series,
 * the value for the axis is returned (and afterwards, the global value.)
 *
 * @param {string} name the name of the option.
 * @param {string} series the series to search.
 */
DygraphOptions.prototype.getForSeries = function (name, series) {
  // Honors indexes as series.
  if (series === this.dygraph_.getHighlightSeries()) {
    if (this.highlightSeries_.hasOwnProperty(name)) {
      return this.highlightSeries_[name];
    }
  }

  if (!this.series_.hasOwnProperty(series)) {
    throw "Unknown series: " + series;
  }

  var seriesObj = this.series_[series];
  var seriesOptions = seriesObj["options"];
  if (seriesOptions.hasOwnProperty(name)) {
    return seriesOptions[name];
  }

  return this.getForAxis(name, seriesObj["yAxis"]);
};

/**
 * Returns the number of y-axes on the chart.
 * @return {number} the number of axes.
 */
DygraphOptions.prototype.numAxes = function () {
  return this.yAxes_.length;
};

/**
 * Return the y-axis for a given series, specified by name.
 */
DygraphOptions.prototype.axisForSeries = function (series) {
  return this.series_[series].yAxis;
};

/**
 * Returns the options for the specified axis.
 */
// TODO(konigsberg): this is y-axis specific. Support the x axis.
DygraphOptions.prototype.axisOptions = function (yAxis) {
  return this.yAxes_[yAxis].options;
};

/**
 * Return the series associated with an axis.
 */
DygraphOptions.prototype.seriesForAxis = function (yAxis) {
  return this.yAxes_[yAxis].series;
};

/**
 * Return the list of all series, in their columnar order.
 */
DygraphOptions.prototype.seriesNames = function () {
  return this.labels_;
};

// For "production" code, this gets removed by uglifyjs.
if (typeof process !== 'undefined') {
  if ("development" != 'production') {

    /**
     * Validate all options.
     * This requires OPTIONS_REFERENCE, which is only available in debug builds.
     * @private
     */
    DygraphOptions.prototype.validateOptions_ = function () {
      if (typeof _dygraphOptionsReference2['default'] === 'undefined') {
        throw 'Called validateOptions_ in prod build.';
      }

      var that = this;
      var validateOption = function validateOption(optionName) {
        if (!_dygraphOptionsReference2['default'][optionName]) {
          that.warnInvalidOption_(optionName);
        }
      };

      var optionsDicts = [this.xAxis_.options, this.yAxes_[0].options, this.yAxes_[1] && this.yAxes_[1].options, this.global_, this.user_, this.highlightSeries_];
      var names = this.seriesNames();
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (this.series_.hasOwnProperty(name)) {
          optionsDicts.push(this.series_[name].options);
        }
      }
      for (var i = 0; i < optionsDicts.length; i++) {
        var dict = optionsDicts[i];
        if (!dict) continue;
        for (var optionName in dict) {
          if (dict.hasOwnProperty(optionName)) {
            validateOption(optionName);
          }
        }
      }
    };

    var WARNINGS = {}; // Only show any particular warning once.

    /**
     * Logs a warning about invalid options.
     * TODO: make this throw for testing
     * @private
     */
    DygraphOptions.prototype.warnInvalidOption_ = function (optionName) {
      if (!WARNINGS[optionName]) {
        WARNINGS[optionName] = true;
        var isSeries = this.labels_.indexOf(optionName) >= 0;
        if (isSeries) {
          console.warn('Use new-style per-series options (saw ' + optionName + ' as top-level options key). See http://bit.ly/1tceaJs');
        } else {
          console.warn('Unknown option ' + optionName + ' (full list of options at dygraphs.com/options.html');
        }
        throw "invalid option " + optionName;
      }
    };

    // Reset list of previously-shown warnings. Used for testing.
    DygraphOptions.resetWarnings_ = function () {
      WARNINGS = {};
    };
  }
}

exports['default'] = DygraphOptions;
module.exports = exports['default'];

}).call(this,require('_process'))

},{"./dygraph-default-attrs":131,"./dygraph-options-reference":135,"./dygraph-utils":138,"_process":122}],137:[function(require,module,exports){
/**
 * @license
 * Copyright 2011 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview Description of this file.
 * @author danvk@google.com (Dan Vanderkam)
 *
 * A ticker is a function with the following interface:
 *
 * function(a, b, pixels, options_view, dygraph, forced_values);
 * -> [ { v: tick1_v, label: tick1_label[, label_v: label_v1] },
 *      { v: tick2_v, label: tick2_label[, label_v: label_v2] },
 *      ...
 *    ]
 *
 * The returned value is called a "tick list".
 *
 * Arguments
 * ---------
 *
 * [a, b] is the range of the axis for which ticks are being generated. For a
 * numeric axis, these will simply be numbers. For a date axis, these will be
 * millis since epoch (convertable to Date objects using "new Date(a)" and "new
 * Date(b)").
 *
 * opts provides access to chart- and axis-specific options. It can be used to
 * access number/date formatting code/options, check for a log scale, etc.
 *
 * pixels is the length of the axis in pixels. opts('pixelsPerLabel') is the
 * minimum amount of space to be allotted to each label. For instance, if
 * pixels=400 and opts('pixelsPerLabel')=40 then the ticker should return
 * between zero and ten (400/40) ticks.
 *
 * dygraph is the Dygraph object for which an axis is being constructed.
 *
 * forced_values is used for secondary y-axes. The tick positions are typically
 * set by the primary y-axis, so the secondary y-axis has no choice in where to
 * put these. It simply has to generate labels for these data values.
 *
 * Tick lists
 * ----------
 * Typically a tick will have both a grid/tick line and a label at one end of
 * that line (at the bottom for an x-axis, at left or right for the y-axis).
 *
 * A tick may be missing one of these two components:
 * - If "label_v" is specified instead of "v", then there will be no tick or
 *   gridline, just a label.
 * - Similarly, if "label" is not specified, then there will be a gridline
 *   without a label.
 *
 * This flexibility is useful in a few situations:
 * - For log scales, some of the tick lines may be too close to all have labels.
 * - For date scales where years are being displayed, it is desirable to display
 *   tick marks at the beginnings of years but labels (e.g. "2006") in the
 *   middle of the years.
 */

/*jshint sub:true */
/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _dygraphUtils = require('./dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

/** @typedef {Array.<{v:number, label:string, label_v:(string|undefined)}>} */
var TickList = undefined; // the ' = undefined' keeps jshint happy.

/** @typedef {function(
 *    number,
 *    number,
 *    number,
 *    function(string):*,
 *    Dygraph=,
 *    Array.<number>=
 *  ): TickList}
 */
var Ticker = undefined; // the ' = undefined' keeps jshint happy.

/** @type {Ticker} */
var numericLinearTicks = function numericLinearTicks(a, b, pixels, opts, dygraph, vals) {
  var nonLogscaleOpts = function nonLogscaleOpts(opt) {
    if (opt === 'logscale') return false;
    return opts(opt);
  };
  return numericTicks(a, b, pixels, nonLogscaleOpts, dygraph, vals);
};

exports.numericLinearTicks = numericLinearTicks;
/** @type {Ticker} */
var numericTicks = function numericTicks(a, b, pixels, opts, dygraph, vals) {
  var pixels_per_tick = /** @type{number} */opts('pixelsPerLabel');
  var ticks = [];
  var i, j, tickV, nTicks;
  if (vals) {
    for (i = 0; i < vals.length; i++) {
      ticks.push({ v: vals[i] });
    }
  } else {
    // TODO(danvk): factor this log-scale block out into a separate function.
    if (opts("logscale")) {
      nTicks = Math.floor(pixels / pixels_per_tick);
      var minIdx = utils.binarySearch(a, PREFERRED_LOG_TICK_VALUES, 1);
      var maxIdx = utils.binarySearch(b, PREFERRED_LOG_TICK_VALUES, -1);
      if (minIdx == -1) {
        minIdx = 0;
      }
      if (maxIdx == -1) {
        maxIdx = PREFERRED_LOG_TICK_VALUES.length - 1;
      }
      // Count the number of tick values would appear, if we can get at least
      // nTicks / 4 accept them.
      var lastDisplayed = null;
      if (maxIdx - minIdx >= nTicks / 4) {
        for (var idx = maxIdx; idx >= minIdx; idx--) {
          var tickValue = PREFERRED_LOG_TICK_VALUES[idx];
          var pixel_coord = Math.log(tickValue / a) / Math.log(b / a) * pixels;
          var tick = { v: tickValue };
          if (lastDisplayed === null) {
            lastDisplayed = {
              tickValue: tickValue,
              pixel_coord: pixel_coord
            };
          } else {
            if (Math.abs(pixel_coord - lastDisplayed.pixel_coord) >= pixels_per_tick) {
              lastDisplayed = {
                tickValue: tickValue,
                pixel_coord: pixel_coord
              };
            } else {
              tick.label = "";
            }
          }
          ticks.push(tick);
        }
        // Since we went in backwards order.
        ticks.reverse();
      }
    }

    // ticks.length won't be 0 if the log scale function finds values to insert.
    if (ticks.length === 0) {
      // Basic idea:
      // Try labels every 1, 2, 5, 10, 20, 50, 100, etc.
      // Calculate the resulting tick spacing (i.e. this.height_ / nTicks).
      // The first spacing greater than pixelsPerYLabel is what we use.
      // TODO(danvk): version that works on a log scale.
      var kmg2 = opts("labelsKMG2");
      var mults, base;
      if (kmg2) {
        mults = [1, 2, 4, 8, 16, 32, 64, 128, 256];
        base = 16;
      } else {
        mults = [1, 2, 5, 10, 20, 50, 100];
        base = 10;
      }

      // Get the maximum number of permitted ticks based on the
      // graph's pixel size and pixels_per_tick setting.
      var max_ticks = Math.ceil(pixels / pixels_per_tick);

      // Now calculate the data unit equivalent of this tick spacing.
      // Use abs() since graphs may have a reversed Y axis.
      var units_per_tick = Math.abs(b - a) / max_ticks;

      // Based on this, get a starting scale which is the largest
      // integer power of the chosen base (10 or 16) that still remains
      // below the requested pixels_per_tick spacing.
      var base_power = Math.floor(Math.log(units_per_tick) / Math.log(base));
      var base_scale = Math.pow(base, base_power);

      // Now try multiples of the starting scale until we find one
      // that results in tick marks spaced sufficiently far apart.
      // The "mults" array should cover the range 1 .. base^2 to
      // adjust for rounding and edge effects.
      var scale, low_val, high_val, spacing;
      for (j = 0; j < mults.length; j++) {
        scale = base_scale * mults[j];
        low_val = Math.floor(a / scale) * scale;
        high_val = Math.ceil(b / scale) * scale;
        nTicks = Math.abs(high_val - low_val) / scale;
        spacing = pixels / nTicks;
        if (spacing > pixels_per_tick) break;
      }

      // Construct the set of ticks.
      // Allow reverse y-axis if it's explicitly requested.
      if (low_val > high_val) scale *= -1;
      for (i = 0; i <= nTicks; i++) {
        tickV = low_val + i * scale;
        ticks.push({ v: tickV });
      }
    }
  }

  var formatter = /**@type{AxisLabelFormatter}*/opts('axisLabelFormatter');

  // Add labels to the ticks.
  for (i = 0; i < ticks.length; i++) {
    if (ticks[i].label !== undefined) continue; // Use current label.
    // TODO(danvk): set granularity to something appropriate here.
    ticks[i].label = formatter.call(dygraph, ticks[i].v, 0, opts, dygraph);
  }

  return ticks;
};

exports.numericTicks = numericTicks;
/** @type {Ticker} */
var dateTicker = function dateTicker(a, b, pixels, opts, dygraph, vals) {
  var chosen = pickDateTickGranularity(a, b, pixels, opts);

  if (chosen >= 0) {
    return getDateAxis(a, b, chosen, opts, dygraph);
  } else {
    // this can happen if self.width_ is zero.
    return [];
  }
};

exports.dateTicker = dateTicker;
// Time granularity enumeration
var Granularity = {
  SECONDLY: 0,
  TWO_SECONDLY: 1,
  FIVE_SECONDLY: 2,
  TEN_SECONDLY: 3,
  THIRTY_SECONDLY: 4,
  MINUTELY: 5,
  TWO_MINUTELY: 6,
  FIVE_MINUTELY: 7,
  TEN_MINUTELY: 8,
  THIRTY_MINUTELY: 9,
  HOURLY: 10,
  TWO_HOURLY: 11,
  SIX_HOURLY: 12,
  DAILY: 13,
  TWO_DAILY: 14,
  WEEKLY: 15,
  MONTHLY: 16,
  QUARTERLY: 17,
  BIANNUAL: 18,
  ANNUAL: 19,
  DECADAL: 20,
  CENTENNIAL: 21,
  NUM_GRANULARITIES: 22
};

exports.Granularity = Granularity;
// Date components enumeration (in the order of the arguments in Date)
// TODO: make this an @enum
var DateField = {
  DATEFIELD_Y: 0,
  DATEFIELD_M: 1,
  DATEFIELD_D: 2,
  DATEFIELD_HH: 3,
  DATEFIELD_MM: 4,
  DATEFIELD_SS: 5,
  DATEFIELD_MS: 6,
  NUM_DATEFIELDS: 7
};

/**
 * The value of datefield will start at an even multiple of "step", i.e.
 *   if datefield=SS and step=5 then the first tick will be on a multiple of 5s.
 *
 * For granularities <= HOURLY, ticks are generated every `spacing` ms.
 *
 * At coarser granularities, ticks are generated by incrementing `datefield` by
 *   `step`. In this case, the `spacing` value is only used to estimate the
 *   number of ticks. It should roughly correspond to the spacing between
 *   adjacent ticks.
 *
 * @type {Array.<{datefield:number, step:number, spacing:number}>}
 */
var TICK_PLACEMENT = [];
TICK_PLACEMENT[Granularity.SECONDLY] = { datefield: DateField.DATEFIELD_SS, step: 1, spacing: 1000 * 1 };
TICK_PLACEMENT[Granularity.TWO_SECONDLY] = { datefield: DateField.DATEFIELD_SS, step: 2, spacing: 1000 * 2 };
TICK_PLACEMENT[Granularity.FIVE_SECONDLY] = { datefield: DateField.DATEFIELD_SS, step: 5, spacing: 1000 * 5 };
TICK_PLACEMENT[Granularity.TEN_SECONDLY] = { datefield: DateField.DATEFIELD_SS, step: 10, spacing: 1000 * 10 };
TICK_PLACEMENT[Granularity.THIRTY_SECONDLY] = { datefield: DateField.DATEFIELD_SS, step: 30, spacing: 1000 * 30 };
TICK_PLACEMENT[Granularity.MINUTELY] = { datefield: DateField.DATEFIELD_MM, step: 1, spacing: 1000 * 60 };
TICK_PLACEMENT[Granularity.TWO_MINUTELY] = { datefield: DateField.DATEFIELD_MM, step: 2, spacing: 1000 * 60 * 2 };
TICK_PLACEMENT[Granularity.FIVE_MINUTELY] = { datefield: DateField.DATEFIELD_MM, step: 5, spacing: 1000 * 60 * 5 };
TICK_PLACEMENT[Granularity.TEN_MINUTELY] = { datefield: DateField.DATEFIELD_MM, step: 10, spacing: 1000 * 60 * 10 };
TICK_PLACEMENT[Granularity.THIRTY_MINUTELY] = { datefield: DateField.DATEFIELD_MM, step: 30, spacing: 1000 * 60 * 30 };
TICK_PLACEMENT[Granularity.HOURLY] = { datefield: DateField.DATEFIELD_HH, step: 1, spacing: 1000 * 3600 };
TICK_PLACEMENT[Granularity.TWO_HOURLY] = { datefield: DateField.DATEFIELD_HH, step: 2, spacing: 1000 * 3600 * 2 };
TICK_PLACEMENT[Granularity.SIX_HOURLY] = { datefield: DateField.DATEFIELD_HH, step: 6, spacing: 1000 * 3600 * 6 };
TICK_PLACEMENT[Granularity.DAILY] = { datefield: DateField.DATEFIELD_D, step: 1, spacing: 1000 * 86400 };
TICK_PLACEMENT[Granularity.TWO_DAILY] = { datefield: DateField.DATEFIELD_D, step: 2, spacing: 1000 * 86400 * 2 };
TICK_PLACEMENT[Granularity.WEEKLY] = { datefield: DateField.DATEFIELD_D, step: 7, spacing: 1000 * 604800 };
TICK_PLACEMENT[Granularity.MONTHLY] = { datefield: DateField.DATEFIELD_M, step: 1, spacing: 1000 * 7200 * 365.2524 }; // 1e3 * 60 * 60 * 24 * 365.2524 / 12
TICK_PLACEMENT[Granularity.QUARTERLY] = { datefield: DateField.DATEFIELD_M, step: 3, spacing: 1000 * 21600 * 365.2524 }; // 1e3 * 60 * 60 * 24 * 365.2524 / 4
TICK_PLACEMENT[Granularity.BIANNUAL] = { datefield: DateField.DATEFIELD_M, step: 6, spacing: 1000 * 43200 * 365.2524 }; // 1e3 * 60 * 60 * 24 * 365.2524 / 2
TICK_PLACEMENT[Granularity.ANNUAL] = { datefield: DateField.DATEFIELD_Y, step: 1, spacing: 1000 * 86400 * 365.2524 }; // 1e3 * 60 * 60 * 24 * 365.2524 * 1
TICK_PLACEMENT[Granularity.DECADAL] = { datefield: DateField.DATEFIELD_Y, step: 10, spacing: 1000 * 864000 * 365.2524 }; // 1e3 * 60 * 60 * 24 * 365.2524 * 10
TICK_PLACEMENT[Granularity.CENTENNIAL] = { datefield: DateField.DATEFIELD_Y, step: 100, spacing: 1000 * 8640000 * 365.2524 }; // 1e3 * 60 * 60 * 24 * 365.2524 * 100

/**
 * This is a list of human-friendly values at which to show tick marks on a log
 * scale. It is k * 10^n, where k=1..9 and n=-39..+39, so:
 * ..., 1, 2, 3, 4, 5, ..., 9, 10, 20, 30, ..., 90, 100, 200, 300, ...
 * NOTE: this assumes that utils.LOG_SCALE = 10.
 * @type {Array.<number>}
 */
var PREFERRED_LOG_TICK_VALUES = (function () {
  var vals = [];
  for (var power = -39; power <= 39; power++) {
    var range = Math.pow(10, power);
    for (var mult = 1; mult <= 9; mult++) {
      var val = range * mult;
      vals.push(val);
    }
  }
  return vals;
})();

/**
 * Determine the correct granularity of ticks on a date axis.
 *
 * @param {number} a Left edge of the chart (ms)
 * @param {number} b Right edge of the chart (ms)
 * @param {number} pixels Size of the chart in the relevant dimension (width).
 * @param {function(string):*} opts Function mapping from option name -&gt; value.
 * @return {number} The appropriate axis granularity for this chart. See the
 *     enumeration of possible values in dygraph-tickers.js.
 */
var pickDateTickGranularity = function pickDateTickGranularity(a, b, pixels, opts) {
  var pixels_per_tick = /** @type{number} */opts('pixelsPerLabel');
  for (var i = 0; i < Granularity.NUM_GRANULARITIES; i++) {
    var num_ticks = numDateTicks(a, b, i);
    if (pixels / num_ticks >= pixels_per_tick) {
      return i;
    }
  }
  return -1;
};

/**
 * Compute the number of ticks on a date axis for a given granularity.
 * @param {number} start_time
 * @param {number} end_time
 * @param {number} granularity (one of the granularities enumerated above)
 * @return {number} (Approximate) number of ticks that would result.
 */
var numDateTicks = function numDateTicks(start_time, end_time, granularity) {
  var spacing = TICK_PLACEMENT[granularity].spacing;
  return Math.round(1.0 * (end_time - start_time) / spacing);
};

/**
 * Compute the positions and labels of ticks on a date axis for a given granularity.
 * @param {number} start_time
 * @param {number} end_time
 * @param {number} granularity (one of the granularities enumerated above)
 * @param {function(string):*} opts Function mapping from option name -&gt; value.
 * @param {Dygraph=} dg
 * @return {!TickList}
 */
var getDateAxis = function getDateAxis(start_time, end_time, granularity, opts, dg) {
  var formatter = /** @type{AxisLabelFormatter} */opts("axisLabelFormatter");
  var utc = opts("labelsUTC");
  var accessors = utc ? utils.DateAccessorsUTC : utils.DateAccessorsLocal;

  var datefield = TICK_PLACEMENT[granularity].datefield;
  var step = TICK_PLACEMENT[granularity].step;
  var spacing = TICK_PLACEMENT[granularity].spacing;

  // Choose a nice tick position before the initial instant.
  // Currently, this code deals properly with the existent daily granularities:
  // DAILY (with step of 1) and WEEKLY (with step of 7 but specially handled).
  // Other daily granularities (say TWO_DAILY) should also be handled specially
  // by setting the start_date_offset to 0.
  var start_date = new Date(start_time);
  var date_array = [];
  date_array[DateField.DATEFIELD_Y] = accessors.getFullYear(start_date);
  date_array[DateField.DATEFIELD_M] = accessors.getMonth(start_date);
  date_array[DateField.DATEFIELD_D] = accessors.getDate(start_date);
  date_array[DateField.DATEFIELD_HH] = accessors.getHours(start_date);
  date_array[DateField.DATEFIELD_MM] = accessors.getMinutes(start_date);
  date_array[DateField.DATEFIELD_SS] = accessors.getSeconds(start_date);
  date_array[DateField.DATEFIELD_MS] = accessors.getMilliseconds(start_date);

  var start_date_offset = date_array[datefield] % step;
  if (granularity == Granularity.WEEKLY) {
    // This will put the ticks on Sundays.
    start_date_offset = accessors.getDay(start_date);
  }

  date_array[datefield] -= start_date_offset;
  for (var df = datefield + 1; df < DateField.NUM_DATEFIELDS; df++) {
    // The minimum value is 1 for the day of month, and 0 for all other fields.
    date_array[df] = df === DateField.DATEFIELD_D ? 1 : 0;
  }

  // Generate the ticks.
  // For granularities not coarser than HOURLY we use the fact that:
  //   the number of milliseconds between ticks is constant
  //   and equal to the defined spacing.
  // Otherwise we rely on the 'roll over' property of the Date functions:
  //   when some date field is set to a value outside of its logical range,
  //   the excess 'rolls over' the next (more significant) field.
  // However, when using local time with DST transitions,
  // there are dates that do not represent any time value at all
  // (those in the hour skipped at the 'spring forward'),
  // and the JavaScript engines usually return an equivalent value.
  // Hence we have to check that the date is properly increased at each step,
  // returning a date at a nice tick position.
  var ticks = [];
  var tick_date = accessors.makeDate.apply(null, date_array);
  var tick_time = tick_date.getTime();
  if (granularity <= Granularity.HOURLY) {
    if (tick_time < start_time) {
      tick_time += spacing;
      tick_date = new Date(tick_time);
    }
    while (tick_time <= end_time) {
      ticks.push({ v: tick_time,
        label: formatter.call(dg, tick_date, granularity, opts, dg)
      });
      tick_time += spacing;
      tick_date = new Date(tick_time);
    }
  } else {
    if (tick_time < start_time) {
      date_array[datefield] += step;
      tick_date = accessors.makeDate.apply(null, date_array);
      tick_time = tick_date.getTime();
    }
    while (tick_time <= end_time) {
      if (granularity >= Granularity.DAILY || accessors.getHours(tick_date) % step === 0) {
        ticks.push({ v: tick_time,
          label: formatter.call(dg, tick_date, granularity, opts, dg)
        });
      }
      date_array[datefield] += step;
      tick_date = accessors.makeDate.apply(null, date_array);
      tick_time = tick_date.getTime();
    }
  }
  return ticks;
};
exports.getDateAxis = getDateAxis;

},{"./dygraph-utils":138}],138:[function(require,module,exports){
/**
 * @license
 * Copyright 2011 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/**
 * @fileoverview This file contains utility functions used by dygraphs. These
 * are typically static (i.e. not related to any particular dygraph). Examples
 * include date/time formatting functions, basic algorithms (e.g. binary
 * search) and generic DOM-manipulation functions.
 */

/*global Dygraph:false, Node:false */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.removeEvent = removeEvent;
exports.cancelEvent = cancelEvent;
exports.hsvToRGB = hsvToRGB;
exports.findPos = findPos;
exports.pageX = pageX;
exports.pageY = pageY;
exports.dragGetX_ = dragGetX_;
exports.dragGetY_ = dragGetY_;
exports.isOK = isOK;
exports.isValidPoint = isValidPoint;
exports.floatFormat = floatFormat;
exports.zeropad = zeropad;
exports.hmsString_ = hmsString_;
exports.dateString_ = dateString_;
exports.round_ = round_;
exports.binarySearch = binarySearch;
exports.dateParser = dateParser;
exports.dateStrToMillis = dateStrToMillis;
exports.update = update;
exports.updateDeep = updateDeep;
exports.isArrayLike = isArrayLike;
exports.isDateLike = isDateLike;
exports.clone = clone;
exports.createCanvas = createCanvas;
exports.getContextPixelRatio = getContextPixelRatio;
exports.Iterator = Iterator;
exports.createIterator = createIterator;
exports.repeatAndCleanup = repeatAndCleanup;
exports.isPixelChangingOptionList = isPixelChangingOptionList;
exports.detectLineDelimiter = detectLineDelimiter;
exports.isNodeContainedBy = isNodeContainedBy;
exports.pow = pow;
exports.toRGB_ = toRGB_;
exports.isCanvasSupported = isCanvasSupported;
exports.parseFloat_ = parseFloat_;
exports.numberValueFormatter = numberValueFormatter;
exports.numberAxisLabelFormatter = numberAxisLabelFormatter;
exports.dateAxisLabelFormatter = dateAxisLabelFormatter;
exports.dateValueFormatter = dateValueFormatter;

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _dygraphTickers = require('./dygraph-tickers');

var DygraphTickers = _interopRequireWildcard(_dygraphTickers);

var LOG_SCALE = 10;
exports.LOG_SCALE = LOG_SCALE;
var LN_TEN = Math.log(LOG_SCALE);

exports.LN_TEN = LN_TEN;
/**
 * @private
 * @param {number} x
 * @return {number}
 */
var log10 = function log10(x) {
  return Math.log(x) / LN_TEN;
};

exports.log10 = log10;
/**
 * @private
 * @param {number} r0
 * @param {number} r1
 * @param {number} pct
 * @return {number}
 */
var logRangeFraction = function logRangeFraction(r0, r1, pct) {
  // Computing the inverse of toPercentXCoord. The function was arrived at with
  // the following steps:
  //
  // Original calcuation:
  // pct = (log(x) - log(xRange[0])) / (log(xRange[1]) - log(xRange[0])));
  //
  // Multiply both sides by the right-side demoninator.
  // pct * (log(xRange[1] - log(xRange[0]))) = log(x) - log(xRange[0])
  //
  // add log(xRange[0]) to both sides
  // log(xRange[0]) + (pct * (log(xRange[1]) - log(xRange[0])) = log(x);
  //
  // Swap both sides of the equation,
  // log(x) = log(xRange[0]) + (pct * (log(xRange[1]) - log(xRange[0]))
  //
  // Use both sides as the exponent in 10^exp and we're done.
  // x = 10 ^ (log(xRange[0]) + (pct * (log(xRange[1]) - log(xRange[0])))

  var logr0 = log10(r0);
  var logr1 = log10(r1);
  var exponent = logr0 + pct * (logr1 - logr0);
  var value = Math.pow(LOG_SCALE, exponent);
  return value;
};

exports.logRangeFraction = logRangeFraction;
/** A dotted line stroke pattern. */
var DOTTED_LINE = [2, 2];
exports.DOTTED_LINE = DOTTED_LINE;
/** A dashed line stroke pattern. */
var DASHED_LINE = [7, 3];
exports.DASHED_LINE = DASHED_LINE;
/** A dot dash stroke pattern. */
var DOT_DASH_LINE = [7, 2, 2, 2];

exports.DOT_DASH_LINE = DOT_DASH_LINE;
// Directions for panning and zooming. Use bit operations when combined
// values are possible.
var HORIZONTAL = 1;
exports.HORIZONTAL = HORIZONTAL;
var VERTICAL = 2;

exports.VERTICAL = VERTICAL;
/**
 * Return the 2d context for a dygraph canvas.
 *
 * This method is only exposed for the sake of replacing the function in
 * automated tests.
 *
 * @param {!HTMLCanvasElement} canvas
 * @return {!CanvasRenderingContext2D}
 * @private
 */
var getContext = function getContext(canvas) {
  return (/** @type{!CanvasRenderingContext2D}*/canvas.getContext("2d")
  );
};

exports.getContext = getContext;
/**
 * Add an event handler.
 * @param {!Node} elem The element to add the event to.
 * @param {string} type The type of the event, e.g. 'click' or 'mousemove'.
 * @param {function(Event):(boolean|undefined)} fn The function to call
 *     on the event. The function takes one parameter: the event object.
 * @private
 */
var addEvent = function addEvent(elem, type, fn) {
  elem.addEventListener(type, fn, false);
};

exports.addEvent = addEvent;
/**
 * Remove an event handler.
 * @param {!Node} elem The element to remove the event from.
 * @param {string} type The type of the event, e.g. 'click' or 'mousemove'.
 * @param {function(Event):(boolean|undefined)} fn The function to call
 *     on the event. The function takes one parameter: the event object.
 */

function removeEvent(elem, type, fn) {
  elem.removeEventListener(type, fn, false);
}

;

/**
 * Cancels further processing of an event. This is useful to prevent default
 * browser actions, e.g. highlighting text on a double-click.
 * Based on the article at
 * http://www.switchonthecode.com/tutorials/javascript-tutorial-the-scroll-wheel
 * @param {!Event} e The event whose normal behavior should be canceled.
 * @private
 */

function cancelEvent(e) {
  e = e ? e : window.event;
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.cancelBubble = true;
  e.cancel = true;
  e.returnValue = false;
  return false;
}

;

/**
 * Convert hsv values to an rgb(r,g,b) string. Taken from MochiKit.Color. This
 * is used to generate default series colors which are evenly spaced on the
 * color wheel.
 * @param { number } hue Range is 0.0-1.0.
 * @param { number } saturation Range is 0.0-1.0.
 * @param { number } value Range is 0.0-1.0.
 * @return { string } "rgb(r,g,b)" where r, g and b range from 0-255.
 * @private
 */

function hsvToRGB(hue, saturation, value) {
  var red;
  var green;
  var blue;
  if (saturation === 0) {
    red = value;
    green = value;
    blue = value;
  } else {
    var i = Math.floor(hue * 6);
    var f = hue * 6 - i;
    var p = value * (1 - saturation);
    var q = value * (1 - saturation * f);
    var t = value * (1 - saturation * (1 - f));
    switch (i) {
      case 1:
        red = q;green = value;blue = p;break;
      case 2:
        red = p;green = value;blue = t;break;
      case 3:
        red = p;green = q;blue = value;break;
      case 4:
        red = t;green = p;blue = value;break;
      case 5:
        red = value;green = p;blue = q;break;
      case 6: // fall through
      case 0:
        red = value;green = t;blue = p;break;
    }
  }
  red = Math.floor(255 * red + 0.5);
  green = Math.floor(255 * green + 0.5);
  blue = Math.floor(255 * blue + 0.5);
  return 'rgb(' + red + ',' + green + ',' + blue + ')';
}

;

/**
 * Find the coordinates of an object relative to the top left of the page.
 *
 * @param {Node} obj
 * @return {{x:number,y:number}}
 * @private
 */

function findPos(obj) {
  var p = obj.getBoundingClientRect(),
      w = window,
      d = document.documentElement;

  return {
    x: p.left + (w.pageXOffset || d.scrollLeft),
    y: p.top + (w.pageYOffset || d.scrollTop)
  };
}

;

/**
 * Returns the x-coordinate of the event in a coordinate system where the
 * top-left corner of the page (not the window) is (0,0).
 * Taken from MochiKit.Signal
 * @param {!Event} e
 * @return {number}
 * @private
 */

function pageX(e) {
  return !e.pageX || e.pageX < 0 ? 0 : e.pageX;
}

;

/**
 * Returns the y-coordinate of the event in a coordinate system where the
 * top-left corner of the page (not the window) is (0,0).
 * Taken from MochiKit.Signal
 * @param {!Event} e
 * @return {number}
 * @private
 */

function pageY(e) {
  return !e.pageY || e.pageY < 0 ? 0 : e.pageY;
}

;

/**
 * Converts page the x-coordinate of the event to pixel x-coordinates on the
 * canvas (i.e. DOM Coords).
 * @param {!Event} e Drag event.
 * @param {!DygraphInteractionContext} context Interaction context object.
 * @return {number} The amount by which the drag has moved to the right.
 */

function dragGetX_(e, context) {
  return pageX(e) - context.px;
}

;

/**
 * Converts page the y-coordinate of the event to pixel y-coordinates on the
 * canvas (i.e. DOM Coords).
 * @param {!Event} e Drag event.
 * @param {!DygraphInteractionContext} context Interaction context object.
 * @return {number} The amount by which the drag has moved down.
 */

function dragGetY_(e, context) {
  return pageY(e) - context.py;
}

;

/**
 * This returns true unless the parameter is 0, null, undefined or NaN.
 * TODO(danvk): rename this function to something like 'isNonZeroNan'.
 *
 * @param {number} x The number to consider.
 * @return {boolean} Whether the number is zero or NaN.
 * @private
 */

function isOK(x) {
  return !!x && !isNaN(x);
}

;

/**
 * @param {{x:?number,y:?number,yval:?number}} p The point to consider, valid
 *     points are {x, y} objects
 * @param {boolean=} opt_allowNaNY Treat point with y=NaN as valid
 * @return {boolean} Whether the point has numeric x and y.
 * @private
 */

function isValidPoint(p, opt_allowNaNY) {
  if (!p) return false; // null or undefined object
  if (p.yval === null) return false; // missing point
  if (p.x === null || p.x === undefined) return false;
  if (p.y === null || p.y === undefined) return false;
  if (isNaN(p.x) || !opt_allowNaNY && isNaN(p.y)) return false;
  return true;
}

;

/**
 * Number formatting function which mimicks the behavior of %g in printf, i.e.
 * either exponential or fixed format (without trailing 0s) is used depending on
 * the length of the generated string.  The advantage of this format is that
 * there is a predictable upper bound on the resulting string length,
 * significant figures are not dropped, and normal numbers are not displayed in
 * exponential notation.
 *
 * NOTE: JavaScript's native toPrecision() is NOT a drop-in replacement for %g.
 * It creates strings which are too long for absolute values between 10^-4 and
 * 10^-6, e.g. '0.00001' instead of '1e-5'. See tests/number-format.html for
 * output examples.
 *
 * @param {number} x The number to format
 * @param {number=} opt_precision The precision to use, default 2.
 * @return {string} A string formatted like %g in printf.  The max generated
 *                  string length should be precision + 6 (e.g 1.123e+300).
 */

function floatFormat(x, opt_precision) {
  // Avoid invalid precision values; [1, 21] is the valid range.
  var p = Math.min(Math.max(1, opt_precision || 2), 21);

  // This is deceptively simple.  The actual algorithm comes from:
  //
  // Max allowed length = p + 4
  // where 4 comes from 'e+n' and '.'.
  //
  // Length of fixed format = 2 + y + p
  // where 2 comes from '0.' and y = # of leading zeroes.
  //
  // Equating the two and solving for y yields y = 2, or 0.00xxxx which is
  // 1.0e-3.
  //
  // Since the behavior of toPrecision() is identical for larger numbers, we
  // don't have to worry about the other bound.
  //
  // Finally, the argument for toExponential() is the number of trailing digits,
  // so we take off 1 for the value before the '.'.
  return Math.abs(x) < 1.0e-3 && x !== 0.0 ? x.toExponential(p - 1) : x.toPrecision(p);
}

;

/**
 * Converts '9' to '09' (useful for dates)
 * @param {number} x
 * @return {string}
 * @private
 */

function zeropad(x) {
  if (x < 10) return "0" + x;else return "" + x;
}

;

/**
 * Date accessors to get the parts of a calendar date (year, month,
 * day, hour, minute, second and millisecond) according to local time,
 * and factory method to call the Date constructor with an array of arguments.
 */
var DateAccessorsLocal = {
  getFullYear: function getFullYear(d) {
    return d.getFullYear();
  },
  getMonth: function getMonth(d) {
    return d.getMonth();
  },
  getDate: function getDate(d) {
    return d.getDate();
  },
  getHours: function getHours(d) {
    return d.getHours();
  },
  getMinutes: function getMinutes(d) {
    return d.getMinutes();
  },
  getSeconds: function getSeconds(d) {
    return d.getSeconds();
  },
  getMilliseconds: function getMilliseconds(d) {
    return d.getMilliseconds();
  },
  getDay: function getDay(d) {
    return d.getDay();
  },
  makeDate: function makeDate(y, m, d, hh, mm, ss, ms) {
    return new Date(y, m, d, hh, mm, ss, ms);
  }
};

exports.DateAccessorsLocal = DateAccessorsLocal;
/**
 * Date accessors to get the parts of a calendar date (year, month,
 * day of month, hour, minute, second and millisecond) according to UTC time,
 * and factory method to call the Date constructor with an array of arguments.
 */
var DateAccessorsUTC = {
  getFullYear: function getFullYear(d) {
    return d.getUTCFullYear();
  },
  getMonth: function getMonth(d) {
    return d.getUTCMonth();
  },
  getDate: function getDate(d) {
    return d.getUTCDate();
  },
  getHours: function getHours(d) {
    return d.getUTCHours();
  },
  getMinutes: function getMinutes(d) {
    return d.getUTCMinutes();
  },
  getSeconds: function getSeconds(d) {
    return d.getUTCSeconds();
  },
  getMilliseconds: function getMilliseconds(d) {
    return d.getUTCMilliseconds();
  },
  getDay: function getDay(d) {
    return d.getUTCDay();
  },
  makeDate: function makeDate(y, m, d, hh, mm, ss, ms) {
    return new Date(Date.UTC(y, m, d, hh, mm, ss, ms));
  }
};

exports.DateAccessorsUTC = DateAccessorsUTC;
/**
 * Return a string version of the hours, minutes and seconds portion of a date.
 * @param {number} hh The hours (from 0-23)
 * @param {number} mm The minutes (from 0-59)
 * @param {number} ss The seconds (from 0-59)
 * @return {string} A time of the form "HH:MM" or "HH:MM:SS"
 * @private
 */

function hmsString_(hh, mm, ss, ms) {
  var ret = zeropad(hh) + ":" + zeropad(mm);
  if (ss) {
    ret += ":" + zeropad(ss);
    if (ms) {
      var str = "" + ms;
      ret += "." + ('000' + str).substring(str.length);
    }
  }
  return ret;
}

;

/**
 * Convert a JS date (millis since epoch) to a formatted string.
 * @param {number} time The JavaScript time value (ms since epoch)
 * @param {boolean} utc Wether output UTC or local time
 * @return {string} A date of one of these forms:
 *     "YYYY/MM/DD", "YYYY/MM/DD HH:MM" or "YYYY/MM/DD HH:MM:SS"
 * @private
 */

function dateString_(time, utc) {
  var accessors = utc ? DateAccessorsUTC : DateAccessorsLocal;
  var date = new Date(time);
  var y = accessors.getFullYear(date);
  var m = accessors.getMonth(date);
  var d = accessors.getDate(date);
  var hh = accessors.getHours(date);
  var mm = accessors.getMinutes(date);
  var ss = accessors.getSeconds(date);
  var ms = accessors.getMilliseconds(date);
  // Get a year string:
  var year = "" + y;
  // Get a 0 padded month string
  var month = zeropad(m + 1); //months are 0-offset, sigh
  // Get a 0 padded day string
  var day = zeropad(d);
  var frac = hh * 3600 + mm * 60 + ss + 1e-3 * ms;
  var ret = year + "/" + month + "/" + day;
  if (frac) {
    ret += " " + hmsString_(hh, mm, ss, ms);
  }
  return ret;
}

;

/**
 * Round a number to the specified number of digits past the decimal point.
 * @param {number} num The number to round
 * @param {number} places The number of decimals to which to round
 * @return {number} The rounded number
 * @private
 */

function round_(num, places) {
  var shift = Math.pow(10, places);
  return Math.round(num * shift) / shift;
}

;

/**
 * Implementation of binary search over an array.
 * Currently does not work when val is outside the range of arry's values.
 * @param {number} val the value to search for
 * @param {Array.<number>} arry is the value over which to search
 * @param {number} abs If abs > 0, find the lowest entry greater than val
 *     If abs < 0, find the highest entry less than val.
 *     If abs == 0, find the entry that equals val.
 * @param {number=} low The first index in arry to consider (optional)
 * @param {number=} high The last index in arry to consider (optional)
 * @return {number} Index of the element, or -1 if it isn't found.
 * @private
 */

function binarySearch(_x, _x2, _x3, _x4, _x5) {
  var _again = true;

  _function: while (_again) {
    var val = _x,
        arry = _x2,
        abs = _x3,
        low = _x4,
        high = _x5;
    _again = false;

    if (low === null || low === undefined || high === null || high === undefined) {
      low = 0;
      high = arry.length - 1;
    }
    if (low > high) {
      return -1;
    }
    if (abs === null || abs === undefined) {
      abs = 0;
    }
    var validIndex = function validIndex(idx) {
      return idx >= 0 && idx < arry.length;
    };
    var mid = parseInt((low + high) / 2, 10);
    var element = arry[mid];
    var idx;
    if (element == val) {
      return mid;
    } else if (element > val) {
      if (abs > 0) {
        // Accept if element > val, but also if prior element < val.
        idx = mid - 1;
        if (validIndex(idx) && arry[idx] < val) {
          return mid;
        }
      }
      _x = val;
      _x2 = arry;
      _x3 = abs;
      _x4 = low;
      _x5 = mid - 1;
      _again = true;
      validIndex = mid = element = idx = undefined;
      continue _function;
    } else if (element < val) {
      if (abs < 0) {
        // Accept if element < val, but also if prior element > val.
        idx = mid + 1;
        if (validIndex(idx) && arry[idx] > val) {
          return mid;
        }
      }
      _x = val;
      _x2 = arry;
      _x3 = abs;
      _x4 = mid + 1;
      _x5 = high;
      _again = true;
      validIndex = mid = element = idx = undefined;
      continue _function;
    }
    return -1; // can't actually happen, but makes closure compiler happy
  }
}

;

/**
 * Parses a date, returning the number of milliseconds since epoch. This can be
 * passed in as an xValueParser in the Dygraph constructor.
 * TODO(danvk): enumerate formats that this understands.
 *
 * @param {string} dateStr A date in a variety of possible string formats.
 * @return {number} Milliseconds since epoch.
 * @private
 */

function dateParser(dateStr) {
  var dateStrSlashed;
  var d;

  // Let the system try the format first, with one caveat:
  // YYYY-MM-DD[ HH:MM:SS] is interpreted as UTC by a variety of browsers.
  // dygraphs displays dates in local time, so this will result in surprising
  // inconsistencies. But if you specify "T" or "Z" (i.e. YYYY-MM-DDTHH:MM:SS),
  // then you probably know what you're doing, so we'll let you go ahead.
  // Issue: http://code.google.com/p/dygraphs/issues/detail?id=255
  if (dateStr.search("-") == -1 || dateStr.search("T") != -1 || dateStr.search("Z") != -1) {
    d = dateStrToMillis(dateStr);
    if (d && !isNaN(d)) return d;
  }

  if (dateStr.search("-") != -1) {
    // e.g. '2009-7-12' or '2009-07-12'
    dateStrSlashed = dateStr.replace("-", "/", "g");
    while (dateStrSlashed.search("-") != -1) {
      dateStrSlashed = dateStrSlashed.replace("-", "/");
    }
    d = dateStrToMillis(dateStrSlashed);
  } else if (dateStr.length == 8) {
    // e.g. '20090712'
    // TODO(danvk): remove support for this format. It's confusing.
    dateStrSlashed = dateStr.substr(0, 4) + "/" + dateStr.substr(4, 2) + "/" + dateStr.substr(6, 2);
    d = dateStrToMillis(dateStrSlashed);
  } else {
    // Any format that Date.parse will accept, e.g. "2009/07/12" or
    // "2009/07/12 12:34:56"
    d = dateStrToMillis(dateStr);
  }

  if (!d || isNaN(d)) {
    console.error("Couldn't parse " + dateStr + " as a date");
  }
  return d;
}

;

/**
 * This is identical to JavaScript's built-in Date.parse() method, except that
 * it doesn't get replaced with an incompatible method by aggressive JS
 * libraries like MooTools or Joomla.
 * @param {string} str The date string, e.g. "2011/05/06"
 * @return {number} millis since epoch
 * @private
 */

function dateStrToMillis(str) {
  return new Date(str).getTime();
}

;

// These functions are all based on MochiKit.
/**
 * Copies all the properties from o to self.
 *
 * @param {!Object} self
 * @param {!Object} o
 * @return {!Object}
 */

function update(self, o) {
  if (typeof o != 'undefined' && o !== null) {
    for (var k in o) {
      if (o.hasOwnProperty(k)) {
        self[k] = o[k];
      }
    }
  }
  return self;
}

;

/**
 * Copies all the properties from o to self.
 *
 * @param {!Object} self
 * @param {!Object} o
 * @return {!Object}
 * @private
 */

function updateDeep(self, o) {
  // Taken from http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
  function isNode(o) {
    return typeof Node === "object" ? o instanceof Node : typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName === "string";
  }

  if (typeof o != 'undefined' && o !== null) {
    for (var k in o) {
      if (o.hasOwnProperty(k)) {
        if (o[k] === null) {
          self[k] = null;
        } else if (isArrayLike(o[k])) {
          self[k] = o[k].slice();
        } else if (isNode(o[k])) {
          // DOM objects are shallowly-copied.
          self[k] = o[k];
        } else if (typeof o[k] == 'object') {
          if (typeof self[k] != 'object' || self[k] === null) {
            self[k] = {};
          }
          updateDeep(self[k], o[k]);
        } else {
          self[k] = o[k];
        }
      }
    }
  }
  return self;
}

;

/**
 * @param {*} o
 * @return {boolean}
 * @private
 */

function isArrayLike(o) {
  var typ = typeof o;
  if (typ != 'object' && !(typ == 'function' && typeof o.item == 'function') || o === null || typeof o.length != 'number' || o.nodeType === 3) {
    return false;
  }
  return true;
}

;

/**
 * @param {Object} o
 * @return {boolean}
 * @private
 */

function isDateLike(o) {
  if (typeof o != "object" || o === null || typeof o.getTime != 'function') {
    return false;
  }
  return true;
}

;

/**
 * Note: this only seems to work for arrays.
 * @param {!Array} o
 * @return {!Array}
 * @private
 */

function clone(o) {
  // TODO(danvk): figure out how MochiKit's version works
  var r = [];
  for (var i = 0; i < o.length; i++) {
    if (isArrayLike(o[i])) {
      r.push(clone(o[i]));
    } else {
      r.push(o[i]);
    }
  }
  return r;
}

;

/**
 * Create a new canvas element.
 *
 * @return {!HTMLCanvasElement}
 * @private
 */

function createCanvas() {
  return document.createElement('canvas');
}

;

/**
 * Returns the context's pixel ratio, which is the ratio between the device
 * pixel ratio and the backing store ratio. Typically this is 1 for conventional
 * displays, and > 1 for HiDPI displays (such as the Retina MBP).
 * See http://www.html5rocks.com/en/tutorials/canvas/hidpi/ for more details.
 *
 * @param {!CanvasRenderingContext2D} context The canvas's 2d context.
 * @return {number} The ratio of the device pixel ratio and the backing store
 * ratio for the specified context.
 */

function getContextPixelRatio(context) {
  try {
    var devicePixelRatio = window.devicePixelRatio;
    var backingStoreRatio = context.webkitBackingStorePixelRatio || context.mozBackingStorePixelRatio || context.msBackingStorePixelRatio || context.oBackingStorePixelRatio || context.backingStorePixelRatio || 1;
    if (devicePixelRatio !== undefined) {
      return devicePixelRatio / backingStoreRatio;
    } else {
      // At least devicePixelRatio must be defined for this ratio to make sense.
      // We default backingStoreRatio to 1: this does not exist on some browsers
      // (i.e. desktop Chrome).
      return 1;
    }
  } catch (e) {
    return 1;
  }
}

;

/**
 * TODO(danvk): use @template here when it's better supported for classes.
 * @param {!Array} array
 * @param {number} start
 * @param {number} length
 * @param {function(!Array,?):boolean=} predicate
 * @constructor
 */

function Iterator(array, start, length, predicate) {
  start = start || 0;
  length = length || array.length;
  this.hasNext = true; // Use to identify if there's another element.
  this.peek = null; // Use for look-ahead
  this.start_ = start;
  this.array_ = array;
  this.predicate_ = predicate;
  this.end_ = Math.min(array.length, start + length);
  this.nextIdx_ = start - 1; // use -1 so initial advance works.
  this.next(); // ignoring result.
}

;

/**
 * @return {Object}
 */
Iterator.prototype.next = function () {
  if (!this.hasNext) {
    return null;
  }
  var obj = this.peek;

  var nextIdx = this.nextIdx_ + 1;
  var found = false;
  while (nextIdx < this.end_) {
    if (!this.predicate_ || this.predicate_(this.array_, nextIdx)) {
      this.peek = this.array_[nextIdx];
      found = true;
      break;
    }
    nextIdx++;
  }
  this.nextIdx_ = nextIdx;
  if (!found) {
    this.hasNext = false;
    this.peek = null;
  }
  return obj;
};

/**
 * Returns a new iterator over array, between indexes start and
 * start + length, and only returns entries that pass the accept function
 *
 * @param {!Array} array the array to iterate over.
 * @param {number} start the first index to iterate over, 0 if absent.
 * @param {number} length the number of elements in the array to iterate over.
 *     This, along with start, defines a slice of the array, and so length
 *     doesn't imply the number of elements in the iterator when accept doesn't
 *     always accept all values. array.length when absent.
 * @param {function(?):boolean=} opt_predicate a function that takes
 *     parameters array and idx, which returns true when the element should be
 *     returned.  If omitted, all elements are accepted.
 * @private
 */

function createIterator(array, start, length, opt_predicate) {
  return new Iterator(array, start, length, opt_predicate);
}

;

// Shim layer with setTimeout fallback.
// From: http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// Should be called with the window context:
//   Dygraph.requestAnimFrame.call(window, function() {})
var requestAnimFrame = (function () {
  return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) {
    window.setTimeout(callback, 1000 / 60);
  };
})();

exports.requestAnimFrame = requestAnimFrame;
/**
 * Call a function at most maxFrames times at an attempted interval of
 * framePeriodInMillis, then call a cleanup function once. repeatFn is called
 * once immediately, then at most (maxFrames - 1) times asynchronously. If
 * maxFrames==1, then cleanup_fn() is also called synchronously.  This function
 * is used to sequence animation.
 * @param {function(number)} repeatFn Called repeatedly -- takes the frame
 *     number (from 0 to maxFrames-1) as an argument.
 * @param {number} maxFrames The max number of times to call repeatFn
 * @param {number} framePeriodInMillis Max requested time between frames.
 * @param {function()} cleanupFn A function to call after all repeatFn calls.
 * @private
 */

function repeatAndCleanup(repeatFn, maxFrames, framePeriodInMillis, cleanupFn) {
  var frameNumber = 0;
  var previousFrameNumber;
  var startTime = new Date().getTime();
  repeatFn(frameNumber);
  if (maxFrames == 1) {
    cleanupFn();
    return;
  }
  var maxFrameArg = maxFrames - 1;

  (function loop() {
    if (frameNumber >= maxFrames) return;
    requestAnimFrame.call(window, function () {
      // Determine which frame to draw based on the delay so far.  Will skip
      // frames if necessary.
      var currentTime = new Date().getTime();
      var delayInMillis = currentTime - startTime;
      previousFrameNumber = frameNumber;
      frameNumber = Math.floor(delayInMillis / framePeriodInMillis);
      var frameDelta = frameNumber - previousFrameNumber;
      // If we predict that the subsequent repeatFn call will overshoot our
      // total frame target, so our last call will cause a stutter, then jump to
      // the last call immediately.  If we're going to cause a stutter, better
      // to do it faster than slower.
      var predictOvershootStutter = frameNumber + frameDelta > maxFrameArg;
      if (predictOvershootStutter || frameNumber >= maxFrameArg) {
        repeatFn(maxFrameArg); // Ensure final call with maxFrameArg.
        cleanupFn();
      } else {
        if (frameDelta !== 0) {
          // Don't call repeatFn with duplicate frames.
          repeatFn(frameNumber);
        }
        loop();
      }
    });
  })();
}

;

// A whitelist of options that do not change pixel positions.
var pixelSafeOptions = {
  'annotationClickHandler': true,
  'annotationDblClickHandler': true,
  'annotationMouseOutHandler': true,
  'annotationMouseOverHandler': true,
  'axisLineColor': true,
  'axisLineWidth': true,
  'clickCallback': true,
  'drawCallback': true,
  'drawHighlightPointCallback': true,
  'drawPoints': true,
  'drawPointCallback': true,
  'drawGrid': true,
  'fillAlpha': true,
  'gridLineColor': true,
  'gridLineWidth': true,
  'hideOverlayOnMouseOut': true,
  'highlightCallback': true,
  'highlightCircleSize': true,
  'interactionModel': true,
  'labelsDiv': true,
  'labelsKMB': true,
  'labelsKMG2': true,
  'labelsSeparateLines': true,
  'labelsShowZeroValues': true,
  'legend': true,
  'panEdgeFraction': true,
  'pixelsPerYLabel': true,
  'pointClickCallback': true,
  'pointSize': true,
  'rangeSelectorPlotFillColor': true,
  'rangeSelectorPlotFillGradientColor': true,
  'rangeSelectorPlotStrokeColor': true,
  'rangeSelectorBackgroundStrokeColor': true,
  'rangeSelectorBackgroundLineWidth': true,
  'rangeSelectorPlotLineWidth': true,
  'rangeSelectorForegroundStrokeColor': true,
  'rangeSelectorForegroundLineWidth': true,
  'rangeSelectorAlpha': true,
  'showLabelsOnHighlight': true,
  'showRoller': true,
  'strokeWidth': true,
  'underlayCallback': true,
  'unhighlightCallback': true,
  'zoomCallback': true
};

/**
 * This function will scan the option list and determine if they
 * require us to recalculate the pixel positions of each point.
 * TODO: move this into dygraph-options.js
 * @param {!Array.<string>} labels a list of options to check.
 * @param {!Object} attrs
 * @return {boolean} true if the graph needs new points else false.
 * @private
 */

function isPixelChangingOptionList(labels, attrs) {
  // Assume that we do not require new points.
  // This will change to true if we actually do need new points.

  // Create a dictionary of series names for faster lookup.
  // If there are no labels, then the dictionary stays empty.
  var seriesNamesDictionary = {};
  if (labels) {
    for (var i = 1; i < labels.length; i++) {
      seriesNamesDictionary[labels[i]] = true;
    }
  }

  // Scan through a flat (i.e. non-nested) object of options.
  // Returns true/false depending on whether new points are needed.
  var scanFlatOptions = function scanFlatOptions(options) {
    for (var property in options) {
      if (options.hasOwnProperty(property) && !pixelSafeOptions[property]) {
        return true;
      }
    }
    return false;
  };

  // Iterate through the list of updated options.
  for (var property in attrs) {
    if (!attrs.hasOwnProperty(property)) continue;

    // Find out of this field is actually a series specific options list.
    if (property == 'highlightSeriesOpts' || seriesNamesDictionary[property] && !attrs.series) {
      // This property value is a list of options for this series.
      if (scanFlatOptions(attrs[property])) return true;
    } else if (property == 'series' || property == 'axes') {
      // This is twice-nested options list.
      var perSeries = attrs[property];
      for (var series in perSeries) {
        if (perSeries.hasOwnProperty(series) && scanFlatOptions(perSeries[series])) {
          return true;
        }
      }
    } else {
      // If this was not a series specific option list, check if it's a pixel
      // changing property.
      if (!pixelSafeOptions[property]) return true;
    }
  }

  return false;
}

;

var Circles = {
  DEFAULT: function DEFAULT(g, name, ctx, canvasx, canvasy, color, radius) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(canvasx, canvasy, radius, 0, 2 * Math.PI, false);
    ctx.fill();
  }
  // For more shapes, include extras/shapes.js
};

exports.Circles = Circles;
/**
 * Determine whether |data| is delimited by CR, CRLF, LF, LFCR.
 * @param {string} data
 * @return {?string} the delimiter that was detected (or null on failure).
 */

function detectLineDelimiter(data) {
  for (var i = 0; i < data.length; i++) {
    var code = data.charAt(i);
    if (code === '\r') {
      // Might actually be "\r\n".
      if (i + 1 < data.length && data.charAt(i + 1) === '\n') {
        return '\r\n';
      }
      return code;
    }
    if (code === '\n') {
      // Might actually be "\n\r".
      if (i + 1 < data.length && data.charAt(i + 1) === '\r') {
        return '\n\r';
      }
      return code;
    }
  }

  return null;
}

;

/**
 * Is one node contained by another?
 * @param {Node} containee The contained node.
 * @param {Node} container The container node.
 * @return {boolean} Whether containee is inside (or equal to) container.
 * @private
 */

function isNodeContainedBy(containee, container) {
  if (container === null || containee === null) {
    return false;
  }
  var containeeNode = /** @type {Node} */containee;
  while (containeeNode && containeeNode !== container) {
    containeeNode = containeeNode.parentNode;
  }
  return containeeNode === container;
}

;

// This masks some numeric issues in older versions of Firefox,
// where 1.0/Math.pow(10,2) != Math.pow(10,-2).
/** @type {function(number,number):number} */

function pow(base, exp) {
  if (exp < 0) {
    return 1.0 / Math.pow(base, -exp);
  }
  return Math.pow(base, exp);
}

;

var RGBA_RE = /^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*([01](?:\.\d+)?))?\)$/;

/**
 * Helper for toRGB_ which parses strings of the form:
 * rgb(123, 45, 67)
 * rgba(123, 45, 67, 0.5)
 * @return parsed {r,g,b,a?} tuple or null.
 */
function parseRGBA(rgbStr) {
  var bits = RGBA_RE.exec(rgbStr);
  if (!bits) return null;
  var r = parseInt(bits[1], 10),
      g = parseInt(bits[2], 10),
      b = parseInt(bits[3], 10);
  if (bits[4]) {
    return { r: r, g: g, b: b, a: parseFloat(bits[4]) };
  } else {
    return { r: r, g: g, b: b };
  }
}

/**
 * Converts any valid CSS color (hex, rgb(), named color) to an RGB tuple.
 *
 * @param {!string} colorStr Any valid CSS color string.
 * @return {{r:number,g:number,b:number,a:number?}} Parsed RGB tuple.
 * @private
 */

function toRGB_(colorStr) {
  // Strategy: First try to parse colorStr directly. This is fast & avoids DOM
  // manipulation.  If that fails (e.g. for named colors like 'red'), then
  // create a hidden DOM element and parse its computed color.
  var rgb = parseRGBA(colorStr);
  if (rgb) return rgb;

  var div = document.createElement('div');
  div.style.backgroundColor = colorStr;
  div.style.visibility = 'hidden';
  document.body.appendChild(div);
  var rgbStr = window.getComputedStyle(div, null).backgroundColor;
  document.body.removeChild(div);
  return parseRGBA(rgbStr);
}

;

/**
 * Checks whether the browser supports the &lt;canvas&gt; tag.
 * @param {HTMLCanvasElement=} opt_canvasElement Pass a canvas element as an
 *     optimization if you have one.
 * @return {boolean} Whether the browser supports canvas.
 */

function isCanvasSupported(opt_canvasElement) {
  try {
    var canvas = opt_canvasElement || document.createElement("canvas");
    canvas.getContext("2d");
  } catch (e) {
    return false;
  }
  return true;
}

;

/**
 * Parses the value as a floating point number. This is like the parseFloat()
 * built-in, but with a few differences:
 * - the empty string is parsed as null, rather than NaN.
 * - if the string cannot be parsed at all, an error is logged.
 * If the string can't be parsed, this method returns null.
 * @param {string} x The string to be parsed
 * @param {number=} opt_line_no The line number from which the string comes.
 * @param {string=} opt_line The text of the line from which the string comes.
 */

function parseFloat_(x, opt_line_no, opt_line) {
  var val = parseFloat(x);
  if (!isNaN(val)) return val;

  // Try to figure out what happeend.
  // If the value is the empty string, parse it as null.
  if (/^ *$/.test(x)) return null;

  // If it was actually "NaN", return it as NaN.
  if (/^ *nan *$/i.test(x)) return NaN;

  // Looks like a parsing error.
  var msg = "Unable to parse '" + x + "' as a number";
  if (opt_line !== undefined && opt_line_no !== undefined) {
    msg += " on line " + (1 + (opt_line_no || 0)) + " ('" + opt_line + "') of CSV.";
  }
  console.error(msg);

  return null;
}

;

// Label constants for the labelsKMB and labelsKMG2 options.
// (i.e. '100000' -> '100K')
var KMB_LABELS = ['K', 'M', 'B', 'T', 'Q'];
var KMG2_BIG_LABELS = ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
var KMG2_SMALL_LABELS = ['m', 'u', 'n', 'p', 'f', 'a', 'z', 'y'];

/**
 * @private
 * Return a string version of a number. This respects the digitsAfterDecimal
 * and maxNumberWidth options.
 * @param {number} x The number to be formatted
 * @param {Dygraph} opts An options view
 */

function numberValueFormatter(x, opts) {
  var sigFigs = opts('sigFigs');

  if (sigFigs !== null) {
    // User has opted for a fixed number of significant figures.
    return floatFormat(x, sigFigs);
  }

  var digits = opts('digitsAfterDecimal');
  var maxNumberWidth = opts('maxNumberWidth');

  var kmb = opts('labelsKMB');
  var kmg2 = opts('labelsKMG2');

  var label;

  // switch to scientific notation if we underflow or overflow fixed display.
  if (x !== 0.0 && (Math.abs(x) >= Math.pow(10, maxNumberWidth) || Math.abs(x) < Math.pow(10, -digits))) {
    label = x.toExponential(digits);
  } else {
    label = '' + round_(x, digits);
  }

  if (kmb || kmg2) {
    var k;
    var k_labels = [];
    var m_labels = [];
    if (kmb) {
      k = 1000;
      k_labels = KMB_LABELS;
    }
    if (kmg2) {
      if (kmb) console.warn("Setting both labelsKMB and labelsKMG2. Pick one!");
      k = 1024;
      k_labels = KMG2_BIG_LABELS;
      m_labels = KMG2_SMALL_LABELS;
    }

    var absx = Math.abs(x);
    var n = pow(k, k_labels.length);
    for (var j = k_labels.length - 1; j >= 0; j--, n /= k) {
      if (absx >= n) {
        label = round_(x / n, digits) + k_labels[j];
        break;
      }
    }
    if (kmg2) {
      // TODO(danvk): clean up this logic. Why so different than kmb?
      var x_parts = String(x.toExponential()).split('e-');
      if (x_parts.length === 2 && x_parts[1] >= 3 && x_parts[1] <= 24) {
        if (x_parts[1] % 3 > 0) {
          label = round_(x_parts[0] / pow(10, x_parts[1] % 3), digits);
        } else {
          label = Number(x_parts[0]).toFixed(2);
        }
        label += m_labels[Math.floor(x_parts[1] / 3) - 1];
      }
    }
  }

  return label;
}

;

/**
 * variant for use as an axisLabelFormatter.
 * @private
 */

function numberAxisLabelFormatter(x, granularity, opts) {
  return numberValueFormatter.call(this, x, opts);
}

;

/**
 * @type {!Array.<string>}
 * @private
 * @constant
 */
var SHORT_MONTH_NAMES_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Convert a JS date to a string appropriate to display on an axis that
 * is displaying values at the stated granularity. This respects the
 * labelsUTC option.
 * @param {Date} date The date to format
 * @param {number} granularity One of the Dygraph granularity constants
 * @param {Dygraph} opts An options view
 * @return {string} The date formatted as local time
 * @private
 */

function dateAxisLabelFormatter(date, granularity, opts) {
  var utc = opts('labelsUTC');
  var accessors = utc ? DateAccessorsUTC : DateAccessorsLocal;

  var year = accessors.getFullYear(date),
      month = accessors.getMonth(date),
      day = accessors.getDate(date),
      hours = accessors.getHours(date),
      mins = accessors.getMinutes(date),
      secs = accessors.getSeconds(date),
      millis = accessors.getMilliseconds(date);

  if (granularity >= DygraphTickers.Granularity.DECADAL) {
    return '' + year;
  } else if (granularity >= DygraphTickers.Granularity.MONTHLY) {
    return SHORT_MONTH_NAMES_[month] + '&#160;' + year;
  } else {
    var frac = hours * 3600 + mins * 60 + secs + 1e-3 * millis;
    if (frac === 0 || granularity >= DygraphTickers.Granularity.DAILY) {
      // e.g. '21 Jan' (%d%b)
      return zeropad(day) + '&#160;' + SHORT_MONTH_NAMES_[month];
    } else {
      return hmsString_(hours, mins, secs, millis);
    }
  }
}

;
// alias in case anyone is referencing the old method.
// Dygraph.dateAxisFormatter = Dygraph.dateAxisLabelFormatter;

/**
 * Return a string version of a JS date for a value label. This respects the
 * labelsUTC option.
 * @param {Date} date The date to be formatted
 * @param {Dygraph} opts An options view
 * @private
 */

function dateValueFormatter(d, opts) {
  return dateString_(d, opts('labelsUTC'));
}

;

},{"./dygraph-tickers":137}],139:[function(require,module,exports){
(function (process){
/**
 * @license
 * Copyright 2006 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */ /**
 * @fileoverview Creates an interactive, zoomable graph based on a CSV file or
 * string. Dygraph can handle multiple series with or without error bars. The
 * date/value ranges will be automatically set. Dygraph uses the
 * &lt;canvas&gt; tag, so it only works in FF1.5+.
 * @author danvdk@gmail.com (Dan Vanderkam)

  Usage:
   <div id="graphdiv" style="width:800px; height:500px;"></div>
   <script type="text/javascript">
     new Dygraph(document.getElementById("graphdiv"),
                 "datafile.csv",  // CSV file with headers
                 { }); // options
   </script>

 The CSV file is of the form

   Date,SeriesA,SeriesB,SeriesC
   YYYYMMDD,A1,B1,C1
   YYYYMMDD,A2,B2,C2

 If the 'errorBars' option is set in the constructor, the input should be of
 the form
   Date,SeriesA,SeriesB,...
   YYYYMMDD,A1,sigmaA1,B1,sigmaB1,...
   YYYYMMDD,A2,sigmaA2,B2,sigmaB2,...

 If the 'fractions' option is set, the input should be of the form:

   Date,SeriesA,SeriesB,...
   YYYYMMDD,A1/B1,A2/B2,...
   YYYYMMDD,A1/B1,A2/B2,...

 And error bars will be calculated automatically using a binomial distribution.

 For further documentation and examples, see http://dygraphs.com/
 */'use strict';Object.defineProperty(exports,'__esModule',{value:true});var _slicedToArray=(function(){function sliceIterator(arr,i){var _arr=[];var _n=true;var _d=false;var _e=undefined;try{for(var _i=arr[Symbol.iterator](),_s;!(_n = (_s = _i.next()).done);_n = true) {_arr.push(_s.value);if(i && _arr.length === i)break;}}catch(err) {_d = true;_e = err;}finally {try{if(!_n && _i['return'])_i['return']();}finally {if(_d)throw _e;}}return _arr;}return function(arr,i){if(Array.isArray(arr)){return arr;}else if(Symbol.iterator in Object(arr)){return sliceIterator(arr,i);}else {throw new TypeError('Invalid attempt to destructure non-iterable instance');}};})();function _interopRequireWildcard(obj){if(obj && obj.__esModule){return obj;}else {var newObj={};if(obj != null){for(var key in obj) {if(Object.prototype.hasOwnProperty.call(obj,key))newObj[key] = obj[key];}}newObj['default'] = obj;return newObj;}}function _interopRequireDefault(obj){return obj && obj.__esModule?obj:{'default':obj};}var _dygraphLayout=require('./dygraph-layout');var _dygraphLayout2=_interopRequireDefault(_dygraphLayout);var _dygraphCanvas=require('./dygraph-canvas');var _dygraphCanvas2=_interopRequireDefault(_dygraphCanvas);var _dygraphOptions=require('./dygraph-options');var _dygraphOptions2=_interopRequireDefault(_dygraphOptions);var _dygraphInteractionModel=require('./dygraph-interaction-model');var _dygraphInteractionModel2=_interopRequireDefault(_dygraphInteractionModel);var _dygraphTickers=require('./dygraph-tickers');var DygraphTickers=_interopRequireWildcard(_dygraphTickers);var _dygraphUtils=require('./dygraph-utils');var utils=_interopRequireWildcard(_dygraphUtils);var _dygraphDefaultAttrs=require('./dygraph-default-attrs');var _dygraphDefaultAttrs2=_interopRequireDefault(_dygraphDefaultAttrs);var _dygraphOptionsReference=require('./dygraph-options-reference');var _dygraphOptionsReference2=_interopRequireDefault(_dygraphOptionsReference);var _iframeTarp=require('./iframe-tarp');var _iframeTarp2=_interopRequireDefault(_iframeTarp);var _datahandlerDefault=require('./datahandler/default');var _datahandlerDefault2=_interopRequireDefault(_datahandlerDefault);var _datahandlerBarsError=require('./datahandler/bars-error');var _datahandlerBarsError2=_interopRequireDefault(_datahandlerBarsError);var _datahandlerBarsCustom=require('./datahandler/bars-custom');var _datahandlerBarsCustom2=_interopRequireDefault(_datahandlerBarsCustom);var _datahandlerDefaultFractions=require('./datahandler/default-fractions');var _datahandlerDefaultFractions2=_interopRequireDefault(_datahandlerDefaultFractions);var _datahandlerBarsFractions=require('./datahandler/bars-fractions');var _datahandlerBarsFractions2=_interopRequireDefault(_datahandlerBarsFractions);var _datahandlerBars=require('./datahandler/bars');var _datahandlerBars2=_interopRequireDefault(_datahandlerBars);var _pluginsAnnotations=require('./plugins/annotations');var _pluginsAnnotations2=_interopRequireDefault(_pluginsAnnotations);var _pluginsAxes=require('./plugins/axes');var _pluginsAxes2=_interopRequireDefault(_pluginsAxes);var _pluginsChartLabels=require('./plugins/chart-labels');var _pluginsChartLabels2=_interopRequireDefault(_pluginsChartLabels);var _pluginsGrid=require('./plugins/grid');var _pluginsGrid2=_interopRequireDefault(_pluginsGrid);var _pluginsLegend=require('./plugins/legend');var _pluginsLegend2=_interopRequireDefault(_pluginsLegend);var _pluginsRangeSelector=require('./plugins/range-selector');var _pluginsRangeSelector2=_interopRequireDefault(_pluginsRangeSelector);var _dygraphGviz=require('./dygraph-gviz');var _dygraphGviz2=_interopRequireDefault(_dygraphGviz);"use strict"; /**
 * Creates an interactive, zoomable chart.
 *
 * @constructor
 * @param {div | String} div A div or the id of a div into which to construct
 * the chart.
 * @param {String | Function} file A file containing CSV data or a function
 * that returns this data. The most basic expected format for each line is
 * "YYYY/MM/DD,val1,val2,...". For more information, see
 * http://dygraphs.com/data.html.
 * @param {Object} attrs Various other attributes, e.g. errorBars determines
 * whether the input data contains error ranges. For a complete list of
 * options, see http://dygraphs.com/options.html.
 */var Dygraph=function Dygraph(div,data,opts){this.__init__(div,data,opts);};Dygraph.NAME = "Dygraph";Dygraph.VERSION = "2.0.0"; // Various default values
Dygraph.DEFAULT_ROLL_PERIOD = 1;Dygraph.DEFAULT_WIDTH = 480;Dygraph.DEFAULT_HEIGHT = 320; // For max 60 Hz. animation:
Dygraph.ANIMATION_STEPS = 12;Dygraph.ANIMATION_DURATION = 200; /**
 * Standard plotters. These may be used by clients.
 * Available plotters are:
 * - Dygraph.Plotters.linePlotter: draws central lines (most common)
 * - Dygraph.Plotters.errorPlotter: draws error bars
 * - Dygraph.Plotters.fillPlotter: draws fills under lines (used with fillGraph)
 *
 * By default, the plotter is [fillPlotter, errorPlotter, linePlotter].
 * This causes all the lines to be drawn over all the fills/error bars.
 */Dygraph.Plotters = _dygraphCanvas2['default']._Plotters; // Used for initializing annotation CSS rules only once.
Dygraph.addedAnnotationCSS = false; /**
 * Initializes the Dygraph. This creates a new DIV and constructs the PlotKit
 * and context &lt;canvas&gt; inside of it. See the constructor for details.
 * on the parameters.
 * @param {Element} div the Element to render the graph into.
 * @param {string | Function} file Source data
 * @param {Object} attrs Miscellaneous other options
 * @private
 */Dygraph.prototype.__init__ = function(div,file,attrs){this.is_initial_draw_ = true;this.readyFns_ = []; // Support two-argument constructor
if(attrs === null || attrs === undefined){attrs = {};}attrs = Dygraph.copyUserAttrs_(attrs);if(typeof div == 'string'){div = document.getElementById(div);}if(!div){throw new Error('Constructing dygraph with a non-existent div!');} // Copy the important bits into the object
// TODO(danvk): most of these should just stay in the attrs_ dictionary.
this.maindiv_ = div;this.file_ = file;this.rollPeriod_ = attrs.rollPeriod || Dygraph.DEFAULT_ROLL_PERIOD;this.previousVerticalX_ = -1;this.fractions_ = attrs.fractions || false;this.dateWindow_ = attrs.dateWindow || null;this.annotations_ = []; // Clear the div. This ensure that, if multiple dygraphs are passed the same
// div, then only one will be drawn.
div.innerHTML = ""; // For historical reasons, the 'width' and 'height' options trump all CSS
// rules _except_ for an explicit 'width' or 'height' on the div.
// As an added convenience, if the div has zero height (like <div></div> does
// without any styles), then we use a default height/width.
if(div.style.width === '' && attrs.width){div.style.width = attrs.width + "px";}if(div.style.height === '' && attrs.height){div.style.height = attrs.height + "px";}if(div.style.height === '' && div.clientHeight === 0){div.style.height = Dygraph.DEFAULT_HEIGHT + "px";if(div.style.width === ''){div.style.width = Dygraph.DEFAULT_WIDTH + "px";}} // These will be zero if the dygraph's div is hidden. In that case,
// use the user-specified attributes if present. If not, use zero
// and assume the user will call resize to fix things later.
this.width_ = div.clientWidth || attrs.width || 0;this.height_ = div.clientHeight || attrs.height || 0; // TODO(danvk): set fillGraph to be part of attrs_ here, not user_attrs_.
if(attrs.stackedGraph){attrs.fillGraph = true; // TODO(nikhilk): Add any other stackedGraph checks here.
} // DEPRECATION WARNING: All option processing should be moved from
// attrs_ and user_attrs_ to options_, which holds all this information.
//
// Dygraphs has many options, some of which interact with one another.
// To keep track of everything, we maintain two sets of options:
//
//  this.user_attrs_   only options explicitly set by the user.
//  this.attrs_        defaults, options derived from user_attrs_, data.
//
// Options are then accessed this.attr_('attr'), which first looks at
// user_attrs_ and then computed attrs_. This way Dygraphs can set intelligent
// defaults without overriding behavior that the user specifically asks for.
this.user_attrs_ = {};utils.update(this.user_attrs_,attrs); // This sequence ensures that Dygraph.DEFAULT_ATTRS is never modified.
this.attrs_ = {};utils.updateDeep(this.attrs_,_dygraphDefaultAttrs2['default']);this.boundaryIds_ = [];this.setIndexByName_ = {};this.datasetIndex_ = [];this.registeredEvents_ = [];this.eventListeners_ = {};this.attributes_ = new _dygraphOptions2['default'](this); // Create the containing DIV and other interactive elements
this.createInterface_(); // Activate plugins.
this.plugins_ = [];var plugins=Dygraph.PLUGINS.concat(this.getOption('plugins'));for(var i=0;i < plugins.length;i++) { // the plugins option may contain either plugin classes or instances.
// Plugin instances contain an activate method.
var Plugin=plugins[i]; // either a constructor or an instance.
var pluginInstance;if(typeof Plugin.activate !== 'undefined'){pluginInstance = Plugin;}else {pluginInstance = new Plugin();}var pluginDict={plugin:pluginInstance,events:{},options:{},pluginOptions:{}};var handlers=pluginInstance.activate(this);for(var eventName in handlers) {if(!handlers.hasOwnProperty(eventName))continue; // TODO(danvk): validate eventName.
pluginDict.events[eventName] = handlers[eventName];}this.plugins_.push(pluginDict);} // At this point, plugins can no longer register event handlers.
// Construct a map from event -> ordered list of [callback, plugin].
for(var i=0;i < this.plugins_.length;i++) {var plugin_dict=this.plugins_[i];for(var eventName in plugin_dict.events) {if(!plugin_dict.events.hasOwnProperty(eventName))continue;var callback=plugin_dict.events[eventName];var pair=[plugin_dict.plugin,callback];if(!(eventName in this.eventListeners_)){this.eventListeners_[eventName] = [pair];}else {this.eventListeners_[eventName].push(pair);}}}this.createDragInterface_();this.start_();}; /**
 * Triggers a cascade of events to the various plugins which are interested in them.
 * Returns true if the "default behavior" should be prevented, i.e. if one
 * of the event listeners called event.preventDefault().
 * @private
 */Dygraph.prototype.cascadeEvents_ = function(name,extra_props){if(!(name in this.eventListeners_))return false; // QUESTION: can we use objects & prototypes to speed this up?
var e={dygraph:this,cancelable:false,defaultPrevented:false,preventDefault:function preventDefault(){if(!e.cancelable)throw "Cannot call preventDefault on non-cancelable event.";e.defaultPrevented = true;},propagationStopped:false,stopPropagation:function stopPropagation(){e.propagationStopped = true;}};utils.update(e,extra_props);var callback_plugin_pairs=this.eventListeners_[name];if(callback_plugin_pairs){for(var i=callback_plugin_pairs.length - 1;i >= 0;i--) {var plugin=callback_plugin_pairs[i][0];var callback=callback_plugin_pairs[i][1];callback.call(plugin,e);if(e.propagationStopped)break;}}return e.defaultPrevented;}; /**
 * Fetch a plugin instance of a particular class. Only for testing.
 * @private
 * @param {!Class} type The type of the plugin.
 * @return {Object} Instance of the plugin, or null if there is none.
 */Dygraph.prototype.getPluginInstance_ = function(type){for(var i=0;i < this.plugins_.length;i++) {var p=this.plugins_[i];if(p.plugin instanceof type){return p.plugin;}}return null;}; /**
 * Returns the zoomed status of the chart for one or both axes.
 *
 * Axis is an optional parameter. Can be set to 'x' or 'y'.
 *
 * The zoomed status for an axis is set whenever a user zooms using the mouse
 * or when the dateWindow or valueRange are updated. Double-clicking or calling
 * resetZoom() resets the zoom status for the chart.
 */Dygraph.prototype.isZoomed = function(axis){var isZoomedX=!!this.dateWindow_;if(axis === 'x')return isZoomedX;var isZoomedY=this.axes_.map(function(axis){return !!axis.valueRange;}).indexOf(true) >= 0;if(axis === null || axis === undefined){return isZoomedX || isZoomedY;}if(axis === 'y')return isZoomedY;throw new Error('axis parameter is [' + axis + '] must be null, \'x\' or \'y\'.');}; /**
 * Returns information about the Dygraph object, including its containing ID.
 */Dygraph.prototype.toString = function(){var maindiv=this.maindiv_;var id=maindiv && maindiv.id?maindiv.id:maindiv;return "[Dygraph " + id + "]";}; /**
 * @private
 * Returns the value of an option. This may be set by the user (either in the
 * constructor or by calling updateOptions) or by dygraphs, and may be set to a
 * per-series value.
 * @param {string} name The name of the option, e.g. 'rollPeriod'.
 * @param {string} [seriesName] The name of the series to which the option
 * will be applied. If no per-series value of this option is available, then
 * the global value is returned. This is optional.
 * @return { ... } The value of the option.
 */Dygraph.prototype.attr_ = function(name,seriesName){ // For "production" code, this gets removed by uglifyjs.
if(typeof process !== 'undefined'){if("development" != 'production'){if(typeof _dygraphOptionsReference2['default'] === 'undefined'){console.error('Must include options reference JS for testing');}else if(!_dygraphOptionsReference2['default'].hasOwnProperty(name)){console.error('Dygraphs is using property ' + name + ', which has no ' + 'entry in the Dygraphs.OPTIONS_REFERENCE listing.'); // Only log this error once.
_dygraphOptionsReference2['default'][name] = true;}}}return seriesName?this.attributes_.getForSeries(name,seriesName):this.attributes_.get(name);}; /**
 * Returns the current value for an option, as set in the constructor or via
 * updateOptions. You may pass in an (optional) series name to get per-series
 * values for the option.
 *
 * All values returned by this method should be considered immutable. If you
 * modify them, there is no guarantee that the changes will be honored or that
 * dygraphs will remain in a consistent state. If you want to modify an option,
 * use updateOptions() instead.
 *
 * @param {string} name The name of the option (e.g. 'strokeWidth')
 * @param {string=} opt_seriesName Series name to get per-series values.
 * @return {*} The value of the option.
 */Dygraph.prototype.getOption = function(name,opt_seriesName){return this.attr_(name,opt_seriesName);}; /**
 * Like getOption(), but specifically returns a number.
 * This is a convenience function for working with the Closure Compiler.
 * @param {string} name The name of the option (e.g. 'strokeWidth')
 * @param {string=} opt_seriesName Series name to get per-series values.
 * @return {number} The value of the option.
 * @private
 */Dygraph.prototype.getNumericOption = function(name,opt_seriesName){return  (/** @type{number} */this.getOption(name,opt_seriesName));}; /**
 * Like getOption(), but specifically returns a string.
 * This is a convenience function for working with the Closure Compiler.
 * @param {string} name The name of the option (e.g. 'strokeWidth')
 * @param {string=} opt_seriesName Series name to get per-series values.
 * @return {string} The value of the option.
 * @private
 */Dygraph.prototype.getStringOption = function(name,opt_seriesName){return  (/** @type{string} */this.getOption(name,opt_seriesName));}; /**
 * Like getOption(), but specifically returns a boolean.
 * This is a convenience function for working with the Closure Compiler.
 * @param {string} name The name of the option (e.g. 'strokeWidth')
 * @param {string=} opt_seriesName Series name to get per-series values.
 * @return {boolean} The value of the option.
 * @private
 */Dygraph.prototype.getBooleanOption = function(name,opt_seriesName){return  (/** @type{boolean} */this.getOption(name,opt_seriesName));}; /**
 * Like getOption(), but specifically returns a function.
 * This is a convenience function for working with the Closure Compiler.
 * @param {string} name The name of the option (e.g. 'strokeWidth')
 * @param {string=} opt_seriesName Series name to get per-series values.
 * @return {function(...)} The value of the option.
 * @private
 */Dygraph.prototype.getFunctionOption = function(name,opt_seriesName){return  (/** @type{function(...)} */this.getOption(name,opt_seriesName));};Dygraph.prototype.getOptionForAxis = function(name,axis){return this.attributes_.getForAxis(name,axis);}; /**
 * @private
 * @param {string} axis The name of the axis (i.e. 'x', 'y' or 'y2')
 * @return { ... } A function mapping string -> option value
 */Dygraph.prototype.optionsViewForAxis_ = function(axis){var self=this;return function(opt){var axis_opts=self.user_attrs_.axes;if(axis_opts && axis_opts[axis] && axis_opts[axis].hasOwnProperty(opt)){return axis_opts[axis][opt];} // I don't like that this is in a second spot.
if(axis === 'x' && opt === 'logscale'){ // return the default value.
// TODO(konigsberg): pull the default from a global default.
return false;} // user-specified attributes always trump defaults, even if they're less
// specific.
if(typeof self.user_attrs_[opt] != 'undefined'){return self.user_attrs_[opt];}axis_opts = self.attrs_.axes;if(axis_opts && axis_opts[axis] && axis_opts[axis].hasOwnProperty(opt)){return axis_opts[axis][opt];} // check old-style axis options
// TODO(danvk): add a deprecation warning if either of these match.
if(axis == 'y' && self.axes_[0].hasOwnProperty(opt)){return self.axes_[0][opt];}else if(axis == 'y2' && self.axes_[1].hasOwnProperty(opt)){return self.axes_[1][opt];}return self.attr_(opt);};}; /**
 * Returns the current rolling period, as set by the user or an option.
 * @return {number} The number of points in the rolling window
 */Dygraph.prototype.rollPeriod = function(){return this.rollPeriod_;}; /**
 * Returns the currently-visible x-range. This can be affected by zooming,
 * panning or a call to updateOptions.
 * Returns a two-element array: [left, right].
 * If the Dygraph has dates on the x-axis, these will be millis since epoch.
 */Dygraph.prototype.xAxisRange = function(){return this.dateWindow_?this.dateWindow_:this.xAxisExtremes();}; /**
 * Returns the lower- and upper-bound x-axis values of the data set.
 */Dygraph.prototype.xAxisExtremes = function(){var pad=this.getNumericOption('xRangePad') / this.plotter_.area.w;if(this.numRows() === 0){return [0 - pad,1 + pad];}var left=this.rawData_[0][0];var right=this.rawData_[this.rawData_.length - 1][0];if(pad){ // Must keep this in sync with dygraph-layout _evaluateLimits()
var range=right - left;left -= range * pad;right += range * pad;}return [left,right];}; /**
 * Returns the lower- and upper-bound y-axis values for each axis. These are
 * the ranges you'll get if you double-click to zoom out or call resetZoom().
 * The return value is an array of [low, high] tuples, one for each y-axis.
 */Dygraph.prototype.yAxisExtremes = function(){ // TODO(danvk): this is pretty inefficient
var packed=this.gatherDatasets_(this.rolledSeries_,null);var extremes=packed.extremes;var saveAxes=this.axes_;this.computeYAxisRanges_(extremes);var newAxes=this.axes_;this.axes_ = saveAxes;return newAxes.map(function(axis){return axis.extremeRange;});}; /**
 * Returns the currently-visible y-range for an axis. This can be affected by
 * zooming, panning or a call to updateOptions. Axis indices are zero-based. If
 * called with no arguments, returns the range of the first axis.
 * Returns a two-element array: [bottom, top].
 */Dygraph.prototype.yAxisRange = function(idx){if(typeof idx == "undefined")idx = 0;if(idx < 0 || idx >= this.axes_.length){return null;}var axis=this.axes_[idx];return [axis.computedValueRange[0],axis.computedValueRange[1]];}; /**
 * Returns the currently-visible y-ranges for each axis. This can be affected by
 * zooming, panning, calls to updateOptions, etc.
 * Returns an array of [bottom, top] pairs, one for each y-axis.
 */Dygraph.prototype.yAxisRanges = function(){var ret=[];for(var i=0;i < this.axes_.length;i++) {ret.push(this.yAxisRange(i));}return ret;}; // TODO(danvk): use these functions throughout dygraphs.
/**
 * Convert from data coordinates to canvas/div X/Y coordinates.
 * If specified, do this conversion for the coordinate system of a particular
 * axis. Uses the first axis by default.
 * Returns a two-element array: [X, Y]
 *
 * Note: use toDomXCoord instead of toDomCoords(x, null) and use toDomYCoord
 * instead of toDomCoords(null, y, axis).
 */Dygraph.prototype.toDomCoords = function(x,y,axis){return [this.toDomXCoord(x),this.toDomYCoord(y,axis)];}; /**
 * Convert from data x coordinates to canvas/div X coordinate.
 * If specified, do this conversion for the coordinate system of a particular
 * axis.
 * Returns a single value or null if x is null.
 */Dygraph.prototype.toDomXCoord = function(x){if(x === null){return null;}var area=this.plotter_.area;var xRange=this.xAxisRange();return area.x + (x - xRange[0]) / (xRange[1] - xRange[0]) * area.w;}; /**
 * Convert from data x coordinates to canvas/div Y coordinate and optional
 * axis. Uses the first axis by default.
 *
 * returns a single value or null if y is null.
 */Dygraph.prototype.toDomYCoord = function(y,axis){var pct=this.toPercentYCoord(y,axis);if(pct === null){return null;}var area=this.plotter_.area;return area.y + pct * area.h;}; /**
 * Convert from canvas/div coords to data coordinates.
 * If specified, do this conversion for the coordinate system of a particular
 * axis. Uses the first axis by default.
 * Returns a two-element array: [X, Y].
 *
 * Note: use toDataXCoord instead of toDataCoords(x, null) and use toDataYCoord
 * instead of toDataCoords(null, y, axis).
 */Dygraph.prototype.toDataCoords = function(x,y,axis){return [this.toDataXCoord(x),this.toDataYCoord(y,axis)];}; /**
 * Convert from canvas/div x coordinate to data coordinate.
 *
 * If x is null, this returns null.
 */Dygraph.prototype.toDataXCoord = function(x){if(x === null){return null;}var area=this.plotter_.area;var xRange=this.xAxisRange();if(!this.attributes_.getForAxis("logscale",'x')){return xRange[0] + (x - area.x) / area.w * (xRange[1] - xRange[0]);}else {var pct=(x - area.x) / area.w;return utils.logRangeFraction(xRange[0],xRange[1],pct);}}; /**
 * Convert from canvas/div y coord to value.
 *
 * If y is null, this returns null.
 * if axis is null, this uses the first axis.
 */Dygraph.prototype.toDataYCoord = function(y,axis){if(y === null){return null;}var area=this.plotter_.area;var yRange=this.yAxisRange(axis);if(typeof axis == "undefined")axis = 0;if(!this.attributes_.getForAxis("logscale",axis)){return yRange[0] + (area.y + area.h - y) / area.h * (yRange[1] - yRange[0]);}else { // Computing the inverse of toDomCoord.
var pct=(y - area.y) / area.h; // Note reversed yRange, y1 is on top with pct==0.
return utils.logRangeFraction(yRange[1],yRange[0],pct);}}; /**
 * Converts a y for an axis to a percentage from the top to the
 * bottom of the drawing area.
 *
 * If the coordinate represents a value visible on the canvas, then
 * the value will be between 0 and 1, where 0 is the top of the canvas.
 * However, this method will return values outside the range, as
 * values can fall outside the canvas.
 *
 * If y is null, this returns null.
 * if axis is null, this uses the first axis.
 *
 * @param {number} y The data y-coordinate.
 * @param {number} [axis] The axis number on which the data coordinate lives.
 * @return {number} A fraction in [0, 1] where 0 = the top edge.
 */Dygraph.prototype.toPercentYCoord = function(y,axis){if(y === null){return null;}if(typeof axis == "undefined")axis = 0;var yRange=this.yAxisRange(axis);var pct;var logscale=this.attributes_.getForAxis("logscale",axis);if(logscale){var logr0=utils.log10(yRange[0]);var logr1=utils.log10(yRange[1]);pct = (logr1 - utils.log10(y)) / (logr1 - logr0);}else { // yRange[1] - y is unit distance from the bottom.
// yRange[1] - yRange[0] is the scale of the range.
// (yRange[1] - y) / (yRange[1] - yRange[0]) is the % from the bottom.
pct = (yRange[1] - y) / (yRange[1] - yRange[0]);}return pct;}; /**
 * Converts an x value to a percentage from the left to the right of
 * the drawing area.
 *
 * If the coordinate represents a value visible on the canvas, then
 * the value will be between 0 and 1, where 0 is the left of the canvas.
 * However, this method will return values outside the range, as
 * values can fall outside the canvas.
 *
 * If x is null, this returns null.
 * @param {number} x The data x-coordinate.
 * @return {number} A fraction in [0, 1] where 0 = the left edge.
 */Dygraph.prototype.toPercentXCoord = function(x){if(x === null){return null;}var xRange=this.xAxisRange();var pct;var logscale=this.attributes_.getForAxis("logscale",'x');if(logscale === true){ // logscale can be null so we test for true explicitly.
var logr0=utils.log10(xRange[0]);var logr1=utils.log10(xRange[1]);pct = (utils.log10(x) - logr0) / (logr1 - logr0);}else { // x - xRange[0] is unit distance from the left.
// xRange[1] - xRange[0] is the scale of the range.
// The full expression below is the % from the left.
pct = (x - xRange[0]) / (xRange[1] - xRange[0]);}return pct;}; /**
 * Returns the number of columns (including the independent variable).
 * @return {number} The number of columns.
 */Dygraph.prototype.numColumns = function(){if(!this.rawData_)return 0;return this.rawData_[0]?this.rawData_[0].length:this.attr_("labels").length;}; /**
 * Returns the number of rows (excluding any header/label row).
 * @return {number} The number of rows, less any header.
 */Dygraph.prototype.numRows = function(){if(!this.rawData_)return 0;return this.rawData_.length;}; /**
 * Returns the value in the given row and column. If the row and column exceed
 * the bounds on the data, returns null. Also returns null if the value is
 * missing.
 * @param {number} row The row number of the data (0-based). Row 0 is the
 *     first row of data, not a header row.
 * @param {number} col The column number of the data (0-based)
 * @return {number} The value in the specified cell or null if the row/col
 *     were out of range.
 */Dygraph.prototype.getValue = function(row,col){if(row < 0 || row > this.rawData_.length)return null;if(col < 0 || col > this.rawData_[row].length)return null;return this.rawData_[row][col];}; /**
 * Generates interface elements for the Dygraph: a containing div, a div to
 * display the current point, and a textbox to adjust the rolling average
 * period. Also creates the Renderer/Layout elements.
 * @private
 */Dygraph.prototype.createInterface_ = function(){ // Create the all-enclosing graph div
var enclosing=this.maindiv_;this.graphDiv = document.createElement("div"); // TODO(danvk): any other styles that are useful to set here?
this.graphDiv.style.textAlign = 'left'; // This is a CSS "reset"
this.graphDiv.style.position = 'relative';enclosing.appendChild(this.graphDiv); // Create the canvas for interactive parts of the chart.
this.canvas_ = utils.createCanvas();this.canvas_.style.position = "absolute"; // ... and for static parts of the chart.
this.hidden_ = this.createPlotKitCanvas_(this.canvas_);this.canvas_ctx_ = utils.getContext(this.canvas_);this.hidden_ctx_ = utils.getContext(this.hidden_);this.resizeElements_(); // The interactive parts of the graph are drawn on top of the chart.
this.graphDiv.appendChild(this.hidden_);this.graphDiv.appendChild(this.canvas_);this.mouseEventElement_ = this.createMouseEventElement_(); // Create the grapher
this.layout_ = new _dygraphLayout2['default'](this);var dygraph=this;this.mouseMoveHandler_ = function(e){dygraph.mouseMove_(e);};this.mouseOutHandler_ = function(e){ // The mouse has left the chart if:
// 1. e.target is inside the chart
// 2. e.relatedTarget is outside the chart
var target=e.target || e.fromElement;var relatedTarget=e.relatedTarget || e.toElement;if(utils.isNodeContainedBy(target,dygraph.graphDiv) && !utils.isNodeContainedBy(relatedTarget,dygraph.graphDiv)){dygraph.mouseOut_(e);}};this.addAndTrackEvent(window,'mouseout',this.mouseOutHandler_);this.addAndTrackEvent(this.mouseEventElement_,'mousemove',this.mouseMoveHandler_); // Don't recreate and register the resize handler on subsequent calls.
// This happens when the graph is resized.
if(!this.resizeHandler_){this.resizeHandler_ = function(e){dygraph.resize();}; // Update when the window is resized.
// TODO(danvk): drop frames depending on complexity of the chart.
this.addAndTrackEvent(window,'resize',this.resizeHandler_);}};Dygraph.prototype.resizeElements_ = function(){this.graphDiv.style.width = this.width_ + "px";this.graphDiv.style.height = this.height_ + "px";var canvasScale=utils.getContextPixelRatio(this.canvas_ctx_);this.canvas_.width = this.width_ * canvasScale;this.canvas_.height = this.height_ * canvasScale;this.canvas_.style.width = this.width_ + "px"; // for IE
this.canvas_.style.height = this.height_ + "px"; // for IE
if(canvasScale !== 1){this.canvas_ctx_.scale(canvasScale,canvasScale);}var hiddenScale=utils.getContextPixelRatio(this.hidden_ctx_);this.hidden_.width = this.width_ * hiddenScale;this.hidden_.height = this.height_ * hiddenScale;this.hidden_.style.width = this.width_ + "px"; // for IE
this.hidden_.style.height = this.height_ + "px"; // for IE
if(hiddenScale !== 1){this.hidden_ctx_.scale(hiddenScale,hiddenScale);}}; /**
 * Detach DOM elements in the dygraph and null out all data references.
 * Calling this when you're done with a dygraph can dramatically reduce memory
 * usage. See, e.g., the tests/perf.html example.
 */Dygraph.prototype.destroy = function(){this.canvas_ctx_.restore();this.hidden_ctx_.restore(); // Destroy any plugins, in the reverse order that they were registered.
for(var i=this.plugins_.length - 1;i >= 0;i--) {var p=this.plugins_.pop();if(p.plugin.destroy)p.plugin.destroy();}var removeRecursive=function removeRecursive(node){while(node.hasChildNodes()) {removeRecursive(node.firstChild);node.removeChild(node.firstChild);}};this.removeTrackedEvents_(); // remove mouse event handlers (This may not be necessary anymore)
utils.removeEvent(window,'mouseout',this.mouseOutHandler_);utils.removeEvent(this.mouseEventElement_,'mousemove',this.mouseMoveHandler_); // remove window handlers
utils.removeEvent(window,'resize',this.resizeHandler_);this.resizeHandler_ = null;removeRecursive(this.maindiv_);var nullOut=function nullOut(obj){for(var n in obj) {if(typeof obj[n] === 'object'){obj[n] = null;}}}; // These may not all be necessary, but it can't hurt...
nullOut(this.layout_);nullOut(this.plotter_);nullOut(this);}; /**
 * Creates the canvas on which the chart will be drawn. Only the Renderer ever
 * draws on this particular canvas. All Dygraph work (i.e. drawing hover dots
 * or the zoom rectangles) is done on this.canvas_.
 * @param {Object} canvas The Dygraph canvas over which to overlay the plot
 * @return {Object} The newly-created canvas
 * @private
 */Dygraph.prototype.createPlotKitCanvas_ = function(canvas){var h=utils.createCanvas();h.style.position = "absolute"; // TODO(danvk): h should be offset from canvas. canvas needs to include
// some extra area to make it easier to zoom in on the far left and far
// right. h needs to be precisely the plot area, so that clipping occurs.
h.style.top = canvas.style.top;h.style.left = canvas.style.left;h.width = this.width_;h.height = this.height_;h.style.width = this.width_ + "px"; // for IE
h.style.height = this.height_ + "px"; // for IE
return h;}; /**
 * Creates an overlay element used to handle mouse events.
 * @return {Object} The mouse event element.
 * @private
 */Dygraph.prototype.createMouseEventElement_ = function(){return this.canvas_;}; /**
 * Generate a set of distinct colors for the data series. This is done with a
 * color wheel. Saturation/Value are customizable, and the hue is
 * equally-spaced around the color wheel. If a custom set of colors is
 * specified, that is used instead.
 * @private
 */Dygraph.prototype.setColors_ = function(){var labels=this.getLabels();var num=labels.length - 1;this.colors_ = [];this.colorsMap_ = {}; // These are used for when no custom colors are specified.
var sat=this.getNumericOption('colorSaturation') || 1.0;var val=this.getNumericOption('colorValue') || 0.5;var half=Math.ceil(num / 2);var colors=this.getOption('colors');var visibility=this.visibility();for(var i=0;i < num;i++) {if(!visibility[i]){continue;}var label=labels[i + 1];var colorStr=this.attributes_.getForSeries('color',label);if(!colorStr){if(colors){colorStr = colors[i % colors.length];}else { // alternate colors for high contrast.
var idx=i % 2?half + (i + 1) / 2:Math.ceil((i + 1) / 2);var hue=1.0 * idx / (1 + num);colorStr = utils.hsvToRGB(hue,sat,val);}}this.colors_.push(colorStr);this.colorsMap_[label] = colorStr;}}; /**
 * Return the list of colors. This is either the list of colors passed in the
 * attributes or the autogenerated list of rgb(r,g,b) strings.
 * This does not return colors for invisible series.
 * @return {Array.<string>} The list of colors.
 */Dygraph.prototype.getColors = function(){return this.colors_;}; /**
 * Returns a few attributes of a series, i.e. its color, its visibility, which
 * axis it's assigned to, and its column in the original data.
 * Returns null if the series does not exist.
 * Otherwise, returns an object with column, visibility, color and axis properties.
 * The "axis" property will be set to 1 for y1 and 2 for y2.
 * The "column" property can be fed back into getValue(row, column) to get
 * values for this series.
 */Dygraph.prototype.getPropertiesForSeries = function(series_name){var idx=-1;var labels=this.getLabels();for(var i=1;i < labels.length;i++) {if(labels[i] == series_name){idx = i;break;}}if(idx == -1)return null;return {name:series_name,column:idx,visible:this.visibility()[idx - 1],color:this.colorsMap_[series_name],axis:1 + this.attributes_.axisForSeries(series_name)};}; /**
 * Create the text box to adjust the averaging period
 * @private
 */Dygraph.prototype.createRollInterface_ = function(){var _this=this; // Create a roller if one doesn't exist already.
var roller=this.roller_;if(!roller){this.roller_ = roller = document.createElement("input");roller.type = "text";roller.style.display = "none";roller.className = 'dygraph-roller';this.graphDiv.appendChild(roller);}var display=this.getBooleanOption('showRoller')?'block':'none';var area=this.getArea();var textAttr={"top":area.y + area.h - 25 + "px","left":area.x + 1 + "px","display":display};roller.size = "2";roller.value = this.rollPeriod_;utils.update(roller.style,textAttr);roller.onchange = function(){return _this.adjustRoll(roller.value);};}; /**
 * Set up all the mouse handlers needed to capture dragging behavior for zoom
 * events.
 * @private
 */Dygraph.prototype.createDragInterface_ = function(){var context={ // Tracks whether the mouse is down right now
isZooming:false,isPanning:false, // is this drag part of a pan?
is2DPan:false, // if so, is that pan 1- or 2-dimensional?
dragStartX:null, // pixel coordinates
dragStartY:null, // pixel coordinates
dragEndX:null, // pixel coordinates
dragEndY:null, // pixel coordinates
dragDirection:null,prevEndX:null, // pixel coordinates
prevEndY:null, // pixel coordinates
prevDragDirection:null,cancelNextDblclick:false, // see comment in dygraph-interaction-model.js
// The value on the left side of the graph when a pan operation starts.
initialLeftmostDate:null, // The number of units each pixel spans. (This won't be valid for log
// scales)
xUnitsPerPixel:null, // TODO(danvk): update this comment
// The range in second/value units that the viewport encompasses during a
// panning operation.
dateRange:null, // Top-left corner of the canvas, in DOM coords
// TODO(konigsberg): Rename topLeftCanvasX, topLeftCanvasY.
px:0,py:0, // Values for use with panEdgeFraction, which limit how far outside the
// graph's data boundaries it can be panned.
boundedDates:null, // [minDate, maxDate]
boundedValues:null, // [[minValue, maxValue] ...]
// We cover iframes during mouse interactions. See comments in
// dygraph-utils.js for more info on why this is a good idea.
tarp:new _iframeTarp2['default'](), // contextB is the same thing as this context object but renamed.
initializeMouseDown:function initializeMouseDown(event,g,contextB){ // prevents mouse drags from selecting page text.
if(event.preventDefault){event.preventDefault(); // Firefox, Chrome, etc.
}else {event.returnValue = false; // IE
event.cancelBubble = true;}var canvasPos=utils.findPos(g.canvas_);contextB.px = canvasPos.x;contextB.py = canvasPos.y;contextB.dragStartX = utils.dragGetX_(event,contextB);contextB.dragStartY = utils.dragGetY_(event,contextB);contextB.cancelNextDblclick = false;contextB.tarp.cover();},destroy:function destroy(){var context=this;if(context.isZooming || context.isPanning){context.isZooming = false;context.dragStartX = null;context.dragStartY = null;}if(context.isPanning){context.isPanning = false;context.draggingDate = null;context.dateRange = null;for(var i=0;i < self.axes_.length;i++) {delete self.axes_[i].draggingValue;delete self.axes_[i].dragValueRange;}}context.tarp.uncover();}};var interactionModel=this.getOption("interactionModel"); // Self is the graph.
var self=this; // Function that binds the graph and context to the handler.
var bindHandler=function bindHandler(handler){return function(event){handler(event,self,context);};};for(var eventName in interactionModel) {if(!interactionModel.hasOwnProperty(eventName))continue;this.addAndTrackEvent(this.mouseEventElement_,eventName,bindHandler(interactionModel[eventName]));} // If the user releases the mouse button during a drag, but not over the
// canvas, then it doesn't count as a zooming action.
if(!interactionModel.willDestroyContextMyself){var mouseUpHandler=function mouseUpHandler(event){context.destroy();};this.addAndTrackEvent(document,'mouseup',mouseUpHandler);}}; /**
 * Draw a gray zoom rectangle over the desired area of the canvas. Also clears
 * up any previous zoom rectangles that were drawn. This could be optimized to
 * avoid extra redrawing, but it's tricky to avoid interactions with the status
 * dots.
 *
 * @param {number} direction the direction of the zoom rectangle. Acceptable
 *     values are utils.HORIZONTAL and utils.VERTICAL.
 * @param {number} startX The X position where the drag started, in canvas
 *     coordinates.
 * @param {number} endX The current X position of the drag, in canvas coords.
 * @param {number} startY The Y position where the drag started, in canvas
 *     coordinates.
 * @param {number} endY The current Y position of the drag, in canvas coords.
 * @param {number} prevDirection the value of direction on the previous call to
 *     this function. Used to avoid excess redrawing
 * @param {number} prevEndX The value of endX on the previous call to this
 *     function. Used to avoid excess redrawing
 * @param {number} prevEndY The value of endY on the previous call to this
 *     function. Used to avoid excess redrawing
 * @private
 */Dygraph.prototype.drawZoomRect_ = function(direction,startX,endX,startY,endY,prevDirection,prevEndX,prevEndY){var ctx=this.canvas_ctx_; // Clean up from the previous rect if necessary
if(prevDirection == utils.HORIZONTAL){ctx.clearRect(Math.min(startX,prevEndX),this.layout_.getPlotArea().y,Math.abs(startX - prevEndX),this.layout_.getPlotArea().h);}else if(prevDirection == utils.VERTICAL){ctx.clearRect(this.layout_.getPlotArea().x,Math.min(startY,prevEndY),this.layout_.getPlotArea().w,Math.abs(startY - prevEndY));} // Draw a light-grey rectangle to show the new viewing area
if(direction == utils.HORIZONTAL){if(endX && startX){ctx.fillStyle = "rgba(128,128,128,0.33)";ctx.fillRect(Math.min(startX,endX),this.layout_.getPlotArea().y,Math.abs(endX - startX),this.layout_.getPlotArea().h);}}else if(direction == utils.VERTICAL){if(endY && startY){ctx.fillStyle = "rgba(128,128,128,0.33)";ctx.fillRect(this.layout_.getPlotArea().x,Math.min(startY,endY),this.layout_.getPlotArea().w,Math.abs(endY - startY));}}}; /**
 * Clear the zoom rectangle (and perform no zoom).
 * @private
 */Dygraph.prototype.clearZoomRect_ = function(){this.currentZoomRectArgs_ = null;this.canvas_ctx_.clearRect(0,0,this.width_,this.height_);}; /**
 * Zoom to something containing [lowX, highX]. These are pixel coordinates in
 * the canvas. The exact zoom window may be slightly larger if there are no data
 * points near lowX or highX. Don't confuse this function with doZoomXDates,
 * which accepts dates that match the raw data. This function redraws the graph.
 *
 * @param {number} lowX The leftmost pixel value that should be visible.
 * @param {number} highX The rightmost pixel value that should be visible.
 * @private
 */Dygraph.prototype.doZoomX_ = function(lowX,highX){this.currentZoomRectArgs_ = null; // Find the earliest and latest dates contained in this canvasx range.
// Convert the call to date ranges of the raw data.
var minDate=this.toDataXCoord(lowX);var maxDate=this.toDataXCoord(highX);this.doZoomXDates_(minDate,maxDate);}; /**
 * Zoom to something containing [minDate, maxDate] values. Don't confuse this
 * method with doZoomX which accepts pixel coordinates. This function redraws
 * the graph.
 *
 * @param {number} minDate The minimum date that should be visible.
 * @param {number} maxDate The maximum date that should be visible.
 * @private
 */Dygraph.prototype.doZoomXDates_ = function(minDate,maxDate){var _this2=this; // TODO(danvk): when xAxisRange is null (i.e. "fit to data", the animation
// can produce strange effects. Rather than the x-axis transitioning slowly
// between values, it can jerk around.)
var old_window=this.xAxisRange();var new_window=[minDate,maxDate];var zoomCallback=this.getFunctionOption('zoomCallback');this.doAnimatedZoom(old_window,new_window,null,null,function(){if(zoomCallback){zoomCallback.call(_this2,minDate,maxDate,_this2.yAxisRanges());}});}; /**
 * Zoom to something containing [lowY, highY]. These are pixel coordinates in
 * the canvas. This function redraws the graph.
 *
 * @param {number} lowY The topmost pixel value that should be visible.
 * @param {number} highY The lowest pixel value that should be visible.
 * @private
 */Dygraph.prototype.doZoomY_ = function(lowY,highY){var _this3=this;this.currentZoomRectArgs_ = null; // Find the highest and lowest values in pixel range for each axis.
// Note that lowY (in pixels) corresponds to the max Value (in data coords).
// This is because pixels increase as you go down on the screen, whereas data
// coordinates increase as you go up the screen.
var oldValueRanges=this.yAxisRanges();var newValueRanges=[];for(var i=0;i < this.axes_.length;i++) {var hi=this.toDataYCoord(lowY,i);var low=this.toDataYCoord(highY,i);newValueRanges.push([low,hi]);}var zoomCallback=this.getFunctionOption('zoomCallback');this.doAnimatedZoom(null,null,oldValueRanges,newValueRanges,function(){if(zoomCallback){var _xAxisRange=_this3.xAxisRange();var _xAxisRange2=_slicedToArray(_xAxisRange,2);var minX=_xAxisRange2[0];var maxX=_xAxisRange2[1];zoomCallback.call(_this3,minX,maxX,_this3.yAxisRanges());}});}; /**
 * Transition function to use in animations. Returns values between 0.0
 * (totally old values) and 1.0 (totally new values) for each frame.
 * @private
 */Dygraph.zoomAnimationFunction = function(frame,numFrames){var k=1.5;return (1.0 - Math.pow(k,-frame)) / (1.0 - Math.pow(k,-numFrames));}; /**
 * Reset the zoom to the original view coordinates. This is the same as
 * double-clicking on the graph.
 */Dygraph.prototype.resetZoom = function(){var _this4=this;var dirtyX=this.isZoomed('x');var dirtyY=this.isZoomed('y');var dirty=dirtyX || dirtyY; // Clear any selection, since it's likely to be drawn in the wrong place.
this.clearSelection();if(!dirty)return; // Calculate extremes to avoid lack of padding on reset.
var _xAxisExtremes=this.xAxisExtremes();var _xAxisExtremes2=_slicedToArray(_xAxisExtremes,2);var minDate=_xAxisExtremes2[0];var maxDate=_xAxisExtremes2[1];var animatedZooms=this.getBooleanOption('animatedZooms');var zoomCallback=this.getFunctionOption('zoomCallback'); // TODO(danvk): merge this block w/ the code below.
if(!animatedZooms){this.dateWindow_ = null;this.axes_.forEach(function(axis){if(axis.valueRange)delete axis.valueRange;});this.drawGraph_();if(zoomCallback){zoomCallback.call(this,minDate,maxDate,this.yAxisRanges());}return;}var oldWindow=null,newWindow=null,oldValueRanges=null,newValueRanges=null;if(dirtyX){oldWindow = this.xAxisRange();newWindow = [minDate,maxDate];}if(dirtyY){oldValueRanges = this.yAxisRanges();newValueRanges = this.yAxisExtremes();}this.doAnimatedZoom(oldWindow,newWindow,oldValueRanges,newValueRanges,function(){_this4.dateWindow_ = null;_this4.axes_.forEach(function(axis){if(axis.valueRange)delete axis.valueRange;});if(zoomCallback){zoomCallback.call(_this4,minDate,maxDate,_this4.yAxisRanges());}});}; /**
 * Combined animation logic for all zoom functions.
 * either the x parameters or y parameters may be null.
 * @private
 */Dygraph.prototype.doAnimatedZoom = function(oldXRange,newXRange,oldYRanges,newYRanges,callback){var _this5=this;var steps=this.getBooleanOption("animatedZooms")?Dygraph.ANIMATION_STEPS:1;var windows=[];var valueRanges=[];var step,frac;if(oldXRange !== null && newXRange !== null){for(step = 1;step <= steps;step++) {frac = Dygraph.zoomAnimationFunction(step,steps);windows[step - 1] = [oldXRange[0] * (1 - frac) + frac * newXRange[0],oldXRange[1] * (1 - frac) + frac * newXRange[1]];}}if(oldYRanges !== null && newYRanges !== null){for(step = 1;step <= steps;step++) {frac = Dygraph.zoomAnimationFunction(step,steps);var thisRange=[];for(var j=0;j < this.axes_.length;j++) {thisRange.push([oldYRanges[j][0] * (1 - frac) + frac * newYRanges[j][0],oldYRanges[j][1] * (1 - frac) + frac * newYRanges[j][1]]);}valueRanges[step - 1] = thisRange;}}utils.repeatAndCleanup(function(step){if(valueRanges.length){for(var i=0;i < _this5.axes_.length;i++) {var w=valueRanges[step][i];_this5.axes_[i].valueRange = [w[0],w[1]];}}if(windows.length){_this5.dateWindow_ = windows[step];}_this5.drawGraph_();},steps,Dygraph.ANIMATION_DURATION / steps,callback);}; /**
 * Get the current graph's area object.
 *
 * Returns: {x, y, w, h}
 */Dygraph.prototype.getArea = function(){return this.plotter_.area;}; /**
 * Convert a mouse event to DOM coordinates relative to the graph origin.
 *
 * Returns a two-element array: [X, Y].
 */Dygraph.prototype.eventToDomCoords = function(event){if(event.offsetX && event.offsetY){return [event.offsetX,event.offsetY];}else {var eventElementPos=utils.findPos(this.mouseEventElement_);var canvasx=utils.pageX(event) - eventElementPos.x;var canvasy=utils.pageY(event) - eventElementPos.y;return [canvasx,canvasy];}}; /**
 * Given a canvas X coordinate, find the closest row.
 * @param {number} domX graph-relative DOM X coordinate
 * Returns {number} row number.
 * @private
 */Dygraph.prototype.findClosestRow = function(domX){var minDistX=Infinity;var closestRow=-1;var sets=this.layout_.points;for(var i=0;i < sets.length;i++) {var points=sets[i];var len=points.length;for(var j=0;j < len;j++) {var point=points[j];if(!utils.isValidPoint(point,true))continue;var dist=Math.abs(point.canvasx - domX);if(dist < minDistX){minDistX = dist;closestRow = point.idx;}}}return closestRow;}; /**
 * Given canvas X,Y coordinates, find the closest point.
 *
 * This finds the individual data point across all visible series
 * that's closest to the supplied DOM coordinates using the standard
 * Euclidean X,Y distance.
 *
 * @param {number} domX graph-relative DOM X coordinate
 * @param {number} domY graph-relative DOM Y coordinate
 * Returns: {row, seriesName, point}
 * @private
 */Dygraph.prototype.findClosestPoint = function(domX,domY){var minDist=Infinity;var dist,dx,dy,point,closestPoint,closestSeries,closestRow;for(var setIdx=this.layout_.points.length - 1;setIdx >= 0;--setIdx) {var points=this.layout_.points[setIdx];for(var i=0;i < points.length;++i) {point = points[i];if(!utils.isValidPoint(point))continue;dx = point.canvasx - domX;dy = point.canvasy - domY;dist = dx * dx + dy * dy;if(dist < minDist){minDist = dist;closestPoint = point;closestSeries = setIdx;closestRow = point.idx;}}}var name=this.layout_.setNames[closestSeries];return {row:closestRow,seriesName:name,point:closestPoint};}; /**
 * Given canvas X,Y coordinates, find the touched area in a stacked graph.
 *
 * This first finds the X data point closest to the supplied DOM X coordinate,
 * then finds the series which puts the Y coordinate on top of its filled area,
 * using linear interpolation between adjacent point pairs.
 *
 * @param {number} domX graph-relative DOM X coordinate
 * @param {number} domY graph-relative DOM Y coordinate
 * Returns: {row, seriesName, point}
 * @private
 */Dygraph.prototype.findStackedPoint = function(domX,domY){var row=this.findClosestRow(domX);var closestPoint,closestSeries;for(var setIdx=0;setIdx < this.layout_.points.length;++setIdx) {var boundary=this.getLeftBoundary_(setIdx);var rowIdx=row - boundary;var points=this.layout_.points[setIdx];if(rowIdx >= points.length)continue;var p1=points[rowIdx];if(!utils.isValidPoint(p1))continue;var py=p1.canvasy;if(domX > p1.canvasx && rowIdx + 1 < points.length){ // interpolate series Y value using next point
var p2=points[rowIdx + 1];if(utils.isValidPoint(p2)){var dx=p2.canvasx - p1.canvasx;if(dx > 0){var r=(domX - p1.canvasx) / dx;py += r * (p2.canvasy - p1.canvasy);}}}else if(domX < p1.canvasx && rowIdx > 0){ // interpolate series Y value using previous point
var p0=points[rowIdx - 1];if(utils.isValidPoint(p0)){var dx=p1.canvasx - p0.canvasx;if(dx > 0){var r=(p1.canvasx - domX) / dx;py += r * (p0.canvasy - p1.canvasy);}}} // Stop if the point (domX, py) is above this series' upper edge
if(setIdx === 0 || py < domY){closestPoint = p1;closestSeries = setIdx;}}var name=this.layout_.setNames[closestSeries];return {row:row,seriesName:name,point:closestPoint};}; /**
 * When the mouse moves in the canvas, display information about a nearby data
 * point and draw dots over those points in the data series. This function
 * takes care of cleanup of previously-drawn dots.
 * @param {Object} event The mousemove event from the browser.
 * @private
 */Dygraph.prototype.mouseMove_ = function(event){ // This prevents JS errors when mousing over the canvas before data loads.
var points=this.layout_.points;if(points === undefined || points === null)return;var canvasCoords=this.eventToDomCoords(event);var canvasx=canvasCoords[0];var canvasy=canvasCoords[1];var highlightSeriesOpts=this.getOption("highlightSeriesOpts");var selectionChanged=false;if(highlightSeriesOpts && !this.isSeriesLocked()){var closest;if(this.getBooleanOption("stackedGraph")){closest = this.findStackedPoint(canvasx,canvasy);}else {closest = this.findClosestPoint(canvasx,canvasy);}selectionChanged = this.setSelection(closest.row,closest.seriesName);}else {var idx=this.findClosestRow(canvasx);selectionChanged = this.setSelection(idx);}var callback=this.getFunctionOption("highlightCallback");if(callback && selectionChanged){callback.call(this,event,this.lastx_,this.selPoints_,this.lastRow_,this.highlightSet_);}}; /**
 * Fetch left offset from the specified set index or if not passed, the
 * first defined boundaryIds record (see bug #236).
 * @private
 */Dygraph.prototype.getLeftBoundary_ = function(setIdx){if(this.boundaryIds_[setIdx]){return this.boundaryIds_[setIdx][0];}else {for(var i=0;i < this.boundaryIds_.length;i++) {if(this.boundaryIds_[i] !== undefined){return this.boundaryIds_[i][0];}}return 0;}};Dygraph.prototype.animateSelection_ = function(direction){var totalSteps=10;var millis=30;if(this.fadeLevel === undefined)this.fadeLevel = 0;if(this.animateId === undefined)this.animateId = 0;var start=this.fadeLevel;var steps=direction < 0?start:totalSteps - start;if(steps <= 0){if(this.fadeLevel){this.updateSelection_(1.0);}return;}var thisId=++this.animateId;var that=this;var cleanupIfClearing=function cleanupIfClearing(){ // if we haven't reached fadeLevel 0 in the max frame time,
// ensure that the clear happens and just go to 0
if(that.fadeLevel !== 0 && direction < 0){that.fadeLevel = 0;that.clearSelection();}};utils.repeatAndCleanup(function(n){ // ignore simultaneous animations
if(that.animateId != thisId)return;that.fadeLevel += direction;if(that.fadeLevel === 0){that.clearSelection();}else {that.updateSelection_(that.fadeLevel / totalSteps);}},steps,millis,cleanupIfClearing);}; /**
 * Draw dots over the selectied points in the data series. This function
 * takes care of cleanup of previously-drawn dots.
 * @private
 */Dygraph.prototype.updateSelection_ = function(opt_animFraction){ /*var defaultPrevented = */this.cascadeEvents_('select',{selectedRow:this.lastRow_ === -1?undefined:this.lastRow_,selectedX:this.lastx_ === -1?undefined:this.lastx_,selectedPoints:this.selPoints_}); // TODO(danvk): use defaultPrevented here?
// Clear the previously drawn vertical, if there is one
var i;var ctx=this.canvas_ctx_;if(this.getOption('highlightSeriesOpts')){ctx.clearRect(0,0,this.width_,this.height_);var alpha=1.0 - this.getNumericOption('highlightSeriesBackgroundAlpha');var backgroundColor=utils.toRGB_(this.getOption('highlightSeriesBackgroundColor'));if(alpha){ // Activating background fade includes an animation effect for a gradual
// fade. TODO(klausw): make this independently configurable if it causes
// issues? Use a shared preference to control animations?
var animateBackgroundFade=true;if(animateBackgroundFade){if(opt_animFraction === undefined){ // start a new animation
this.animateSelection_(1);return;}alpha *= opt_animFraction;}ctx.fillStyle = 'rgba(' + backgroundColor.r + ',' + backgroundColor.g + ',' + backgroundColor.b + ',' + alpha + ')';ctx.fillRect(0,0,this.width_,this.height_);} // Redraw only the highlighted series in the interactive canvas (not the
// static plot canvas, which is where series are usually drawn).
this.plotter_._renderLineChart(this.highlightSet_,ctx);}else if(this.previousVerticalX_ >= 0){ // Determine the maximum highlight circle size.
var maxCircleSize=0;var labels=this.attr_('labels');for(i = 1;i < labels.length;i++) {var r=this.getNumericOption('highlightCircleSize',labels[i]);if(r > maxCircleSize)maxCircleSize = r;}var px=this.previousVerticalX_;ctx.clearRect(px - maxCircleSize - 1,0,2 * maxCircleSize + 2,this.height_);}if(this.selPoints_.length > 0){ // Draw colored circles over the center of each selected point
var canvasx=this.selPoints_[0].canvasx;ctx.save();for(i = 0;i < this.selPoints_.length;i++) {var pt=this.selPoints_[i];if(isNaN(pt.canvasy))continue;var circleSize=this.getNumericOption('highlightCircleSize',pt.name);var callback=this.getFunctionOption("drawHighlightPointCallback",pt.name);var color=this.plotter_.colors[pt.name];if(!callback){callback = utils.Circles.DEFAULT;}ctx.lineWidth = this.getNumericOption('strokeWidth',pt.name);ctx.strokeStyle = color;ctx.fillStyle = color;callback.call(this,this,pt.name,ctx,canvasx,pt.canvasy,color,circleSize,pt.idx);}ctx.restore();this.previousVerticalX_ = canvasx;}}; /**
 * Manually set the selected points and display information about them in the
 * legend. The selection can be cleared using clearSelection() and queried
 * using getSelection().
 *
 * To set a selected series but not a selected point, call setSelection with
 * row=false and the selected series name.
 *
 * @param {number} row Row number that should be highlighted (i.e. appear with
 * hover dots on the chart).
 * @param {seriesName} optional series name to highlight that series with the
 * the highlightSeriesOpts setting.
 * @param { locked } optional If true, keep seriesName selected when mousing
 * over the graph, disabling closest-series highlighting. Call clearSelection()
 * to unlock it.
 */Dygraph.prototype.setSelection = function(row,opt_seriesName,opt_locked){ // Extract the points we've selected
this.selPoints_ = [];var changed=false;if(row !== false && row >= 0){if(row != this.lastRow_)changed = true;this.lastRow_ = row;for(var setIdx=0;setIdx < this.layout_.points.length;++setIdx) {var points=this.layout_.points[setIdx]; // Check if the point at the appropriate index is the point we're looking
// for.  If it is, just use it, otherwise search the array for a point
// in the proper place.
var setRow=row - this.getLeftBoundary_(setIdx);if(setRow >= 0 && setRow < points.length && points[setRow].idx == row){var point=points[setRow];if(point.yval !== null)this.selPoints_.push(point);}else {for(var pointIdx=0;pointIdx < points.length;++pointIdx) {var point=points[pointIdx];if(point.idx == row){if(point.yval !== null){this.selPoints_.push(point);}break;}}}}}else {if(this.lastRow_ >= 0)changed = true;this.lastRow_ = -1;}if(this.selPoints_.length){this.lastx_ = this.selPoints_[0].xval;}else {this.lastx_ = -1;}if(opt_seriesName !== undefined){if(this.highlightSet_ !== opt_seriesName)changed = true;this.highlightSet_ = opt_seriesName;}if(opt_locked !== undefined){this.lockedSet_ = opt_locked;}if(changed){this.updateSelection_(undefined);}return changed;}; /**
 * The mouse has left the canvas. Clear out whatever artifacts remain
 * @param {Object} event the mouseout event from the browser.
 * @private
 */Dygraph.prototype.mouseOut_ = function(event){if(this.getFunctionOption("unhighlightCallback")){this.getFunctionOption("unhighlightCallback").call(this,event);}if(this.getBooleanOption("hideOverlayOnMouseOut") && !this.lockedSet_){this.clearSelection();}}; /**
 * Clears the current selection (i.e. points that were highlighted by moving
 * the mouse over the chart).
 */Dygraph.prototype.clearSelection = function(){this.cascadeEvents_('deselect',{});this.lockedSet_ = false; // Get rid of the overlay data
if(this.fadeLevel){this.animateSelection_(-1);return;}this.canvas_ctx_.clearRect(0,0,this.width_,this.height_);this.fadeLevel = 0;this.selPoints_ = [];this.lastx_ = -1;this.lastRow_ = -1;this.highlightSet_ = null;}; /**
 * Returns the number of the currently selected row. To get data for this row,
 * you can use the getValue method.
 * @return {number} row number, or -1 if nothing is selected
 */Dygraph.prototype.getSelection = function(){if(!this.selPoints_ || this.selPoints_.length < 1){return -1;}for(var setIdx=0;setIdx < this.layout_.points.length;setIdx++) {var points=this.layout_.points[setIdx];for(var row=0;row < points.length;row++) {if(points[row].x == this.selPoints_[0].x){return points[row].idx;}}}return -1;}; /**
 * Returns the name of the currently-highlighted series.
 * Only available when the highlightSeriesOpts option is in use.
 */Dygraph.prototype.getHighlightSeries = function(){return this.highlightSet_;}; /**
 * Returns true if the currently-highlighted series was locked
 * via setSelection(..., seriesName, true).
 */Dygraph.prototype.isSeriesLocked = function(){return this.lockedSet_;}; /**
 * Fires when there's data available to be graphed.
 * @param {string} data Raw CSV data to be plotted
 * @private
 */Dygraph.prototype.loadedEvent_ = function(data){this.rawData_ = this.parseCSV_(data);this.cascadeDataDidUpdateEvent_();this.predraw_();}; /**
 * Add ticks on the x-axis representing years, months, quarters, weeks, or days
 * @private
 */Dygraph.prototype.addXTicks_ = function(){ // Determine the correct ticks scale on the x-axis: quarterly, monthly, ...
var range;if(this.dateWindow_){range = [this.dateWindow_[0],this.dateWindow_[1]];}else {range = this.xAxisExtremes();}var xAxisOptionsView=this.optionsViewForAxis_('x');var xTicks=xAxisOptionsView('ticker')(range[0],range[1],this.plotter_.area.w, // TODO(danvk): should be area.width
xAxisOptionsView,this); // var msg = 'ticker(' + range[0] + ', ' + range[1] + ', ' + this.width_ + ', ' + this.attr_('pixelsPerXLabel') + ') -> ' + JSON.stringify(xTicks);
// console.log(msg);
this.layout_.setXTicks(xTicks);}; /**
 * Returns the correct handler class for the currently set options.
 * @private
 */Dygraph.prototype.getHandlerClass_ = function(){var handlerClass;if(this.attr_('dataHandler')){handlerClass = this.attr_('dataHandler');}else if(this.fractions_){if(this.getBooleanOption('errorBars')){handlerClass = _datahandlerBarsFractions2['default'];}else {handlerClass = _datahandlerDefaultFractions2['default'];}}else if(this.getBooleanOption('customBars')){handlerClass = _datahandlerBarsCustom2['default'];}else if(this.getBooleanOption('errorBars')){handlerClass = _datahandlerBarsError2['default'];}else {handlerClass = _datahandlerDefault2['default'];}return handlerClass;}; /**
 * @private
 * This function is called once when the chart's data is changed or the options
 * dictionary is updated. It is _not_ called when the user pans or zooms. The
 * idea is that values derived from the chart's data can be computed here,
 * rather than every time the chart is drawn. This includes things like the
 * number of axes, rolling averages, etc.
 */Dygraph.prototype.predraw_ = function(){var start=new Date(); // Create the correct dataHandler
this.dataHandler_ = new (this.getHandlerClass_())();this.layout_.computePlotArea(); // TODO(danvk): move more computations out of drawGraph_ and into here.
this.computeYAxes_();if(!this.is_initial_draw_){this.canvas_ctx_.restore();this.hidden_ctx_.restore();}this.canvas_ctx_.save();this.hidden_ctx_.save(); // Create a new plotter.
this.plotter_ = new _dygraphCanvas2['default'](this,this.hidden_,this.hidden_ctx_,this.layout_); // The roller sits in the bottom left corner of the chart. We don't know where
// this will be until the options are available, so it's positioned here.
this.createRollInterface_();this.cascadeEvents_('predraw'); // Convert the raw data (a 2D array) into the internal format and compute
// rolling averages.
this.rolledSeries_ = [null]; // x-axis is the first series and it's special
for(var i=1;i < this.numColumns();i++) { // var logScale = this.attr_('logscale', i); // TODO(klausw): this looks wrong // konigsberg thinks so too.
var series=this.dataHandler_.extractSeries(this.rawData_,i,this.attributes_);if(this.rollPeriod_ > 1){series = this.dataHandler_.rollingAverage(series,this.rollPeriod_,this.attributes_);}this.rolledSeries_.push(series);} // If the data or options have changed, then we'd better redraw.
this.drawGraph_(); // This is used to determine whether to do various animations.
var end=new Date();this.drawingTimeMs_ = end - start;}; /**
 * Point structure.
 *
 * xval_* and yval_* are the original unscaled data values,
 * while x_* and y_* are scaled to the range (0.0-1.0) for plotting.
 * yval_stacked is the cumulative Y value used for stacking graphs,
 * and bottom/top/minus/plus are used for error bar graphs.
 *
 * @typedef {{
 *     idx: number,
 *     name: string,
 *     x: ?number,
 *     xval: ?number,
 *     y_bottom: ?number,
 *     y: ?number,
 *     y_stacked: ?number,
 *     y_top: ?number,
 *     yval_minus: ?number,
 *     yval: ?number,
 *     yval_plus: ?number,
 *     yval_stacked
 * }}
 */Dygraph.PointType = undefined; /**
 * Calculates point stacking for stackedGraph=true.
 *
 * For stacking purposes, interpolate or extend neighboring data across
 * NaN values based on stackedGraphNaNFill settings. This is for display
 * only, the underlying data value as shown in the legend remains NaN.
 *
 * @param {Array.<Dygraph.PointType>} points Point array for a single series.
 *     Updates each Point's yval_stacked property.
 * @param {Array.<number>} cumulativeYval Accumulated top-of-graph stacked Y
 *     values for the series seen so far. Index is the row number. Updated
 *     based on the current series's values.
 * @param {Array.<number>} seriesExtremes Min and max values, updated
 *     to reflect the stacked values.
 * @param {string} fillMethod Interpolation method, one of 'all', 'inside', or
 *     'none'.
 * @private
 */Dygraph.stackPoints_ = function(points,cumulativeYval,seriesExtremes,fillMethod){var lastXval=null;var prevPoint=null;var nextPoint=null;var nextPointIdx=-1; // Find the next stackable point starting from the given index.
var updateNextPoint=function updateNextPoint(idx){ // If we've previously found a non-NaN point and haven't gone past it yet,
// just use that.
if(nextPointIdx >= idx)return; // We haven't found a non-NaN point yet or have moved past it,
// look towards the right to find a non-NaN point.
for(var j=idx;j < points.length;++j) { // Clear out a previously-found point (if any) since it's no longer
// valid, we shouldn't use it for interpolation anymore.
nextPoint = null;if(!isNaN(points[j].yval) && points[j].yval !== null){nextPointIdx = j;nextPoint = points[j];break;}}};for(var i=0;i < points.length;++i) {var point=points[i];var xval=point.xval;if(cumulativeYval[xval] === undefined){cumulativeYval[xval] = 0;}var actualYval=point.yval;if(isNaN(actualYval) || actualYval === null){if(fillMethod == 'none'){actualYval = 0;}else { // Interpolate/extend for stacking purposes if possible.
updateNextPoint(i);if(prevPoint && nextPoint && fillMethod != 'none'){ // Use linear interpolation between prevPoint and nextPoint.
actualYval = prevPoint.yval + (nextPoint.yval - prevPoint.yval) * ((xval - prevPoint.xval) / (nextPoint.xval - prevPoint.xval));}else if(prevPoint && fillMethod == 'all'){actualYval = prevPoint.yval;}else if(nextPoint && fillMethod == 'all'){actualYval = nextPoint.yval;}else {actualYval = 0;}}}else {prevPoint = point;}var stackedYval=cumulativeYval[xval];if(lastXval != xval){ // If an x-value is repeated, we ignore the duplicates.
stackedYval += actualYval;cumulativeYval[xval] = stackedYval;}lastXval = xval;point.yval_stacked = stackedYval;if(stackedYval > seriesExtremes[1]){seriesExtremes[1] = stackedYval;}if(stackedYval < seriesExtremes[0]){seriesExtremes[0] = stackedYval;}}}; /**
 * Loop over all fields and create datasets, calculating extreme y-values for
 * each series and extreme x-indices as we go.
 *
 * dateWindow is passed in as an explicit parameter so that we can compute
 * extreme values "speculatively", i.e. without actually setting state on the
 * dygraph.
 *
 * @param {Array.<Array.<Array.<(number|Array<number>)>>} rolledSeries, where
 *     rolledSeries[seriesIndex][row] = raw point, where
 *     seriesIndex is the column number starting with 1, and
 *     rawPoint is [x,y] or [x, [y, err]] or [x, [y, yminus, yplus]].
 * @param {?Array.<number>} dateWindow [xmin, xmax] pair, or null.
 * @return {{
 *     points: Array.<Array.<Dygraph.PointType>>,
 *     seriesExtremes: Array.<Array.<number>>,
 *     boundaryIds: Array.<number>}}
 * @private
 */Dygraph.prototype.gatherDatasets_ = function(rolledSeries,dateWindow){var boundaryIds=[];var points=[];var cumulativeYval=[]; // For stacked series.
var extremes={}; // series name -> [low, high]
var seriesIdx,sampleIdx;var firstIdx,lastIdx;var axisIdx; // Loop over the fields (series).  Go from the last to the first,
// because if they're stacked that's how we accumulate the values.
var num_series=rolledSeries.length - 1;var series;for(seriesIdx = num_series;seriesIdx >= 1;seriesIdx--) {if(!this.visibility()[seriesIdx - 1])continue; // Prune down to the desired range, if necessary (for zooming)
// Because there can be lines going to points outside of the visible area,
// we actually prune to visible points, plus one on either side.
if(dateWindow){series = rolledSeries[seriesIdx];var low=dateWindow[0];var high=dateWindow[1]; // TODO(danvk): do binary search instead of linear search.
// TODO(danvk): pass firstIdx and lastIdx directly to the renderer.
firstIdx = null;lastIdx = null;for(sampleIdx = 0;sampleIdx < series.length;sampleIdx++) {if(series[sampleIdx][0] >= low && firstIdx === null){firstIdx = sampleIdx;}if(series[sampleIdx][0] <= high){lastIdx = sampleIdx;}}if(firstIdx === null)firstIdx = 0;var correctedFirstIdx=firstIdx;var isInvalidValue=true;while(isInvalidValue && correctedFirstIdx > 0) {correctedFirstIdx--; // check if the y value is null.
isInvalidValue = series[correctedFirstIdx][1] === null;}if(lastIdx === null)lastIdx = series.length - 1;var correctedLastIdx=lastIdx;isInvalidValue = true;while(isInvalidValue && correctedLastIdx < series.length - 1) {correctedLastIdx++;isInvalidValue = series[correctedLastIdx][1] === null;}if(correctedFirstIdx !== firstIdx){firstIdx = correctedFirstIdx;}if(correctedLastIdx !== lastIdx){lastIdx = correctedLastIdx;}boundaryIds[seriesIdx - 1] = [firstIdx,lastIdx]; // .slice's end is exclusive, we want to include lastIdx.
series = series.slice(firstIdx,lastIdx + 1);}else {series = rolledSeries[seriesIdx];boundaryIds[seriesIdx - 1] = [0,series.length - 1];}var seriesName=this.attr_("labels")[seriesIdx];var seriesExtremes=this.dataHandler_.getExtremeYValues(series,dateWindow,this.getBooleanOption("stepPlot",seriesName));var seriesPoints=this.dataHandler_.seriesToPoints(series,seriesName,boundaryIds[seriesIdx - 1][0]);if(this.getBooleanOption("stackedGraph")){axisIdx = this.attributes_.axisForSeries(seriesName);if(cumulativeYval[axisIdx] === undefined){cumulativeYval[axisIdx] = [];}Dygraph.stackPoints_(seriesPoints,cumulativeYval[axisIdx],seriesExtremes,this.getBooleanOption("stackedGraphNaNFill"));}extremes[seriesName] = seriesExtremes;points[seriesIdx] = seriesPoints;}return {points:points,extremes:extremes,boundaryIds:boundaryIds};}; /**
 * Update the graph with new data. This method is called when the viewing area
 * has changed. If the underlying data or options have changed, predraw_ will
 * be called before drawGraph_ is called.
 *
 * @private
 */Dygraph.prototype.drawGraph_ = function(){var start=new Date(); // This is used to set the second parameter to drawCallback, below.
var is_initial_draw=this.is_initial_draw_;this.is_initial_draw_ = false;this.layout_.removeAllDatasets();this.setColors_();this.attrs_.pointSize = 0.5 * this.getNumericOption('highlightCircleSize');var packed=this.gatherDatasets_(this.rolledSeries_,this.dateWindow_);var points=packed.points;var extremes=packed.extremes;this.boundaryIds_ = packed.boundaryIds;this.setIndexByName_ = {};var labels=this.attr_("labels");var dataIdx=0;for(var i=1;i < points.length;i++) {if(!this.visibility()[i - 1])continue;this.layout_.addDataset(labels[i],points[i]);this.datasetIndex_[i] = dataIdx++;}for(var i=0;i < labels.length;i++) {this.setIndexByName_[labels[i]] = i;}this.computeYAxisRanges_(extremes);this.layout_.setYAxes(this.axes_);this.addXTicks_(); // Tell PlotKit to use this new data and render itself
this.layout_.evaluate();this.renderGraph_(is_initial_draw);if(this.getStringOption("timingName")){var end=new Date();console.log(this.getStringOption("timingName") + " - drawGraph: " + (end - start) + "ms");}}; /**
 * This does the work of drawing the chart. It assumes that the layout and axis
 * scales have already been set (e.g. by predraw_).
 *
 * @private
 */Dygraph.prototype.renderGraph_ = function(is_initial_draw){this.cascadeEvents_('clearChart');this.plotter_.clear();var underlayCallback=this.getFunctionOption('underlayCallback');if(underlayCallback){ // NOTE: we pass the dygraph object to this callback twice to avoid breaking
// users who expect a deprecated form of this callback.
underlayCallback.call(this,this.hidden_ctx_,this.layout_.getPlotArea(),this,this);}var e={canvas:this.hidden_,drawingContext:this.hidden_ctx_};this.cascadeEvents_('willDrawChart',e);this.plotter_.render();this.cascadeEvents_('didDrawChart',e);this.lastRow_ = -1; // because plugins/legend.js clears the legend
// TODO(danvk): is this a performance bottleneck when panning?
// The interaction canvas should already be empty in that situation.
this.canvas_.getContext('2d').clearRect(0,0,this.width_,this.height_);var drawCallback=this.getFunctionOption("drawCallback");if(drawCallback !== null){drawCallback.call(this,this,is_initial_draw);}if(is_initial_draw){this.readyFired_ = true;while(this.readyFns_.length > 0) {var fn=this.readyFns_.pop();fn(this);}}}; /**
 * @private
 * Determine properties of the y-axes which are independent of the data
 * currently being displayed. This includes things like the number of axes and
 * the style of the axes. It does not include the range of each axis and its
 * tick marks.
 * This fills in this.axes_.
 * axes_ = [ { options } ]
 *   indices are into the axes_ array.
 */Dygraph.prototype.computeYAxes_ = function(){var axis,index,opts,v; // this.axes_ doesn't match this.attributes_.axes_.options. It's used for
// data computation as well as options storage.
// Go through once and add all the axes.
this.axes_ = [];for(axis = 0;axis < this.attributes_.numAxes();axis++) { // Add a new axis, making a copy of its per-axis options.
opts = {g:this};utils.update(opts,this.attributes_.axisOptions(axis));this.axes_[axis] = opts;}for(axis = 0;axis < this.axes_.length;axis++) {if(axis === 0){opts = this.optionsViewForAxis_('y' + (axis?'2':''));v = opts("valueRange");if(v)this.axes_[axis].valueRange = v;}else { // To keep old behavior
var axes=this.user_attrs_.axes;if(axes && axes.y2){v = axes.y2.valueRange;if(v)this.axes_[axis].valueRange = v;}}}}; /**
 * Returns the number of y-axes on the chart.
 * @return {number} the number of axes.
 */Dygraph.prototype.numAxes = function(){return this.attributes_.numAxes();}; /**
 * @private
 * Returns axis properties for the given series.
 * @param {string} setName The name of the series for which to get axis
 * properties, e.g. 'Y1'.
 * @return {Object} The axis properties.
 */Dygraph.prototype.axisPropertiesForSeries = function(series){ // TODO(danvk): handle errors.
return this.axes_[this.attributes_.axisForSeries(series)];}; /**
 * @private
 * Determine the value range and tick marks for each axis.
 * @param {Object} extremes A mapping from seriesName -> [low, high]
 * This fills in the valueRange and ticks fields in each entry of this.axes_.
 */Dygraph.prototype.computeYAxisRanges_ = function(extremes){var isNullUndefinedOrNaN=function isNullUndefinedOrNaN(num){return isNaN(parseFloat(num));};var numAxes=this.attributes_.numAxes();var ypadCompat,span,series,ypad;var p_axis; // Compute extreme values, a span and tick marks for each axis.
for(var i=0;i < numAxes;i++) {var axis=this.axes_[i];var logscale=this.attributes_.getForAxis("logscale",i);var includeZero=this.attributes_.getForAxis("includeZero",i);var independentTicks=this.attributes_.getForAxis("independentTicks",i);series = this.attributes_.seriesForAxis(i); // Add some padding. This supports two Y padding operation modes:
//
// - backwards compatible (yRangePad not set):
//   10% padding for automatic Y ranges, but not for user-supplied
//   ranges, and move a close-to-zero edge to zero, since drawing at the edge
//   results in invisible lines. Unfortunately lines drawn at the edge of a
//   user-supplied range will still be invisible. If logscale is
//   set, add a variable amount of padding at the top but
//   none at the bottom.
//
// - new-style (yRangePad set by the user):
//   always add the specified Y padding.
//
ypadCompat = true;ypad = 0.1; // add 10%
var yRangePad=this.getNumericOption('yRangePad');if(yRangePad !== null){ypadCompat = false; // Convert pixel padding to ratio
ypad = yRangePad / this.plotter_.area.h;}if(series.length === 0){ // If no series are defined or visible then use a reasonable default
axis.extremeRange = [0,1];}else { // Calculate the extremes of extremes.
var minY=Infinity; // extremes[series[0]][0];
var maxY=-Infinity; // extremes[series[0]][1];
var extremeMinY,extremeMaxY;for(var j=0;j < series.length;j++) { // this skips invisible series
if(!extremes.hasOwnProperty(series[j]))continue; // Only use valid extremes to stop null data series' from corrupting the scale.
extremeMinY = extremes[series[j]][0];if(extremeMinY !== null){minY = Math.min(extremeMinY,minY);}extremeMaxY = extremes[series[j]][1];if(extremeMaxY !== null){maxY = Math.max(extremeMaxY,maxY);}} // Include zero if requested by the user.
if(includeZero && !logscale){if(minY > 0)minY = 0;if(maxY < 0)maxY = 0;} // Ensure we have a valid scale, otherwise default to [0, 1] for safety.
if(minY == Infinity)minY = 0;if(maxY == -Infinity)maxY = 1;span = maxY - minY; // special case: if we have no sense of scale, center on the sole value.
if(span === 0){if(maxY !== 0){span = Math.abs(maxY);}else { // ... and if the sole value is zero, use range 0-1.
maxY = 1;span = 1;}}var maxAxisY=maxY,minAxisY=minY;if(ypadCompat){if(logscale){maxAxisY = maxY + ypad * span;minAxisY = minY;}else {maxAxisY = maxY + ypad * span;minAxisY = minY - ypad * span; // Backwards-compatible behavior: Move the span to start or end at zero if it's
// close to zero.
if(minAxisY < 0 && minY >= 0)minAxisY = 0;if(maxAxisY > 0 && maxY <= 0)maxAxisY = 0;}}axis.extremeRange = [minAxisY,maxAxisY];}if(axis.valueRange){ // This is a user-set value range for this axis.
var y0=isNullUndefinedOrNaN(axis.valueRange[0])?axis.extremeRange[0]:axis.valueRange[0];var y1=isNullUndefinedOrNaN(axis.valueRange[1])?axis.extremeRange[1]:axis.valueRange[1];axis.computedValueRange = [y0,y1];}else {axis.computedValueRange = axis.extremeRange;}if(!ypadCompat){ // When using yRangePad, adjust the upper/lower bounds to add
// padding unless the user has zoomed/panned the Y axis range.
if(logscale){y0 = axis.computedValueRange[0];y1 = axis.computedValueRange[1];var y0pct=ypad / (2 * ypad - 1);var y1pct=(ypad - 1) / (2 * ypad - 1);axis.computedValueRange[0] = utils.logRangeFraction(y0,y1,y0pct);axis.computedValueRange[1] = utils.logRangeFraction(y0,y1,y1pct);}else {y0 = axis.computedValueRange[0];y1 = axis.computedValueRange[1];span = y1 - y0;axis.computedValueRange[0] = y0 - span * ypad;axis.computedValueRange[1] = y1 + span * ypad;}}if(independentTicks){axis.independentTicks = independentTicks;var opts=this.optionsViewForAxis_('y' + (i?'2':''));var ticker=opts('ticker');axis.ticks = ticker(axis.computedValueRange[0],axis.computedValueRange[1],this.plotter_.area.h,opts,this); // Define the first independent axis as primary axis.
if(!p_axis)p_axis = axis;}}if(p_axis === undefined){throw "Configuration Error: At least one axis has to have the \"independentTicks\" option activated.";} // Add ticks. By default, all axes inherit the tick positions of the
// primary axis. However, if an axis is specifically marked as having
// independent ticks, then that is permissible as well.
for(var i=0;i < numAxes;i++) {var axis=this.axes_[i];if(!axis.independentTicks){var opts=this.optionsViewForAxis_('y' + (i?'2':''));var ticker=opts('ticker');var p_ticks=p_axis.ticks;var p_scale=p_axis.computedValueRange[1] - p_axis.computedValueRange[0];var scale=axis.computedValueRange[1] - axis.computedValueRange[0];var tick_values=[];for(var k=0;k < p_ticks.length;k++) {var y_frac=(p_ticks[k].v - p_axis.computedValueRange[0]) / p_scale;var y_val=axis.computedValueRange[0] + y_frac * scale;tick_values.push(y_val);}axis.ticks = ticker(axis.computedValueRange[0],axis.computedValueRange[1],this.plotter_.area.h,opts,this,tick_values);}}}; /**
 * Detects the type of the str (date or numeric) and sets the various
 * formatting attributes in this.attrs_ based on this type.
 * @param {string} str An x value.
 * @private
 */Dygraph.prototype.detectTypeFromString_ = function(str){var isDate=false;var dashPos=str.indexOf('-'); // could be 2006-01-01 _or_ 1.0e-2
if(dashPos > 0 && str[dashPos - 1] != 'e' && str[dashPos - 1] != 'E' || str.indexOf('/') >= 0 || isNaN(parseFloat(str))){isDate = true;}else if(str.length == 8 && str > '19700101' && str < '20371231'){ // TODO(danvk): remove support for this format.
isDate = true;}this.setXAxisOptions_(isDate);};Dygraph.prototype.setXAxisOptions_ = function(isDate){if(isDate){this.attrs_.xValueParser = utils.dateParser;this.attrs_.axes.x.valueFormatter = utils.dateValueFormatter;this.attrs_.axes.x.ticker = DygraphTickers.dateTicker;this.attrs_.axes.x.axisLabelFormatter = utils.dateAxisLabelFormatter;}else { /** @private (shut up, jsdoc!) */this.attrs_.xValueParser = function(x){return parseFloat(x);}; // TODO(danvk): use Dygraph.numberValueFormatter here?
/** @private (shut up, jsdoc!) */this.attrs_.axes.x.valueFormatter = function(x){return x;};this.attrs_.axes.x.ticker = DygraphTickers.numericTicks;this.attrs_.axes.x.axisLabelFormatter = this.attrs_.axes.x.valueFormatter;}}; /**
 * @private
 * Parses a string in a special csv format.  We expect a csv file where each
 * line is a date point, and the first field in each line is the date string.
 * We also expect that all remaining fields represent series.
 * if the errorBars attribute is set, then interpret the fields as:
 * date, series1, stddev1, series2, stddev2, ...
 * @param {[Object]} data See above.
 *
 * @return [Object] An array with one entry for each row. These entries
 * are an array of cells in that row. The first entry is the parsed x-value for
 * the row. The second, third, etc. are the y-values. These can take on one of
 * three forms, depending on the CSV and constructor parameters:
 * 1. numeric value
 * 2. [ value, stddev ]
 * 3. [ low value, center value, high value ]
 */Dygraph.prototype.parseCSV_ = function(data){var ret=[];var line_delimiter=utils.detectLineDelimiter(data);var lines=data.split(line_delimiter || "\n");var vals,j; // Use the default delimiter or fall back to a tab if that makes sense.
var delim=this.getStringOption('delimiter');if(lines[0].indexOf(delim) == -1 && lines[0].indexOf('\t') >= 0){delim = '\t';}var start=0;if(!('labels' in this.user_attrs_)){ // User hasn't explicitly set labels, so they're (presumably) in the CSV.
start = 1;this.attrs_.labels = lines[0].split(delim); // NOTE: _not_ user_attrs_.
this.attributes_.reparseSeries();}var line_no=0;var xParser;var defaultParserSet=false; // attempt to auto-detect x value type
var expectedCols=this.attr_("labels").length;var outOfOrder=false;for(var i=start;i < lines.length;i++) {var line=lines[i];line_no = i;if(line.length === 0)continue; // skip blank lines
if(line[0] == '#')continue; // skip comment lines
var inFields=line.split(delim);if(inFields.length < 2)continue;var fields=[];if(!defaultParserSet){this.detectTypeFromString_(inFields[0]);xParser = this.getFunctionOption("xValueParser");defaultParserSet = true;}fields[0] = xParser(inFields[0],this); // If fractions are expected, parse the numbers as "A/B"
if(this.fractions_){for(j = 1;j < inFields.length;j++) { // TODO(danvk): figure out an appropriate way to flag parse errors.
vals = inFields[j].split("/");if(vals.length != 2){console.error('Expected fractional "num/den" values in CSV data ' + "but found a value '" + inFields[j] + "' on line " + (1 + i) + " ('" + line + "') which is not of this form.");fields[j] = [0,0];}else {fields[j] = [utils.parseFloat_(vals[0],i,line),utils.parseFloat_(vals[1],i,line)];}}}else if(this.getBooleanOption("errorBars")){ // If there are error bars, values are (value, stddev) pairs
if(inFields.length % 2 != 1){console.error('Expected alternating (value, stdev.) pairs in CSV data ' + 'but line ' + (1 + i) + ' has an odd number of values (' + (inFields.length - 1) + "): '" + line + "'");}for(j = 1;j < inFields.length;j += 2) {fields[(j + 1) / 2] = [utils.parseFloat_(inFields[j],i,line),utils.parseFloat_(inFields[j + 1],i,line)];}}else if(this.getBooleanOption("customBars")){ // Bars are a low;center;high tuple
for(j = 1;j < inFields.length;j++) {var val=inFields[j];if(/^ *$/.test(val)){fields[j] = [null,null,null];}else {vals = val.split(";");if(vals.length == 3){fields[j] = [utils.parseFloat_(vals[0],i,line),utils.parseFloat_(vals[1],i,line),utils.parseFloat_(vals[2],i,line)];}else {console.warn('When using customBars, values must be either blank ' + 'or "low;center;high" tuples (got "' + val + '" on line ' + (1 + i));}}}}else { // Values are just numbers
for(j = 1;j < inFields.length;j++) {fields[j] = utils.parseFloat_(inFields[j],i,line);}}if(ret.length > 0 && fields[0] < ret[ret.length - 1][0]){outOfOrder = true;}if(fields.length != expectedCols){console.error("Number of columns in line " + i + " (" + fields.length + ") does not agree with number of labels (" + expectedCols + ") " + line);} // If the user specified the 'labels' option and none of the cells of the
// first row parsed correctly, then they probably double-specified the
// labels. We go with the values set in the option, discard this row and
// log a warning to the JS console.
if(i === 0 && this.attr_('labels')){var all_null=true;for(j = 0;all_null && j < fields.length;j++) {if(fields[j])all_null = false;}if(all_null){console.warn("The dygraphs 'labels' option is set, but the first row " + "of CSV data ('" + line + "') appears to also contain " + "labels. Will drop the CSV labels and use the option " + "labels.");continue;}}ret.push(fields);}if(outOfOrder){console.warn("CSV is out of order; order it correctly to speed loading.");ret.sort(function(a,b){return a[0] - b[0];});}return ret;}; // In native format, all values must be dates or numbers.
// This check isn't perfect but will catch most mistaken uses of strings.
function validateNativeFormat(data){var firstRow=data[0];var firstX=firstRow[0];if(typeof firstX !== 'number' && !utils.isDateLike(firstX)){throw new Error('Expected number or date but got ' + typeof firstX + ': ' + firstX + '.');}for(var i=1;i < firstRow.length;i++) {var val=firstRow[i];if(val === null || val === undefined)continue;if(typeof val === 'number')continue;if(utils.isArrayLike(val))continue; // e.g. error bars or custom bars.
throw new Error('Expected number or array but got ' + typeof val + ': ' + val + '.');}} /**
 * The user has provided their data as a pre-packaged JS array. If the x values
 * are numeric, this is the same as dygraphs' internal format. If the x values
 * are dates, we need to convert them from Date objects to ms since epoch.
 * @param {!Array} data
 * @return {Object} data with numeric x values.
 * @private
 */Dygraph.prototype.parseArray_ = function(data){ // Peek at the first x value to see if it's numeric.
if(data.length === 0){console.error("Can't plot empty data set");return null;}if(data[0].length === 0){console.error("Data set cannot contain an empty row");return null;}validateNativeFormat(data);var i;if(this.attr_("labels") === null){console.warn("Using default labels. Set labels explicitly via 'labels' " + "in the options parameter");this.attrs_.labels = ["X"];for(i = 1;i < data[0].length;i++) {this.attrs_.labels.push("Y" + i); // Not user_attrs_.
}this.attributes_.reparseSeries();}else {var num_labels=this.attr_("labels");if(num_labels.length != data[0].length){console.error("Mismatch between number of labels (" + num_labels + ")" + " and number of columns in array (" + data[0].length + ")");return null;}}if(utils.isDateLike(data[0][0])){ // Some intelligent defaults for a date x-axis.
this.attrs_.axes.x.valueFormatter = utils.dateValueFormatter;this.attrs_.axes.x.ticker = DygraphTickers.dateTicker;this.attrs_.axes.x.axisLabelFormatter = utils.dateAxisLabelFormatter; // Assume they're all dates.
var parsedData=utils.clone(data);for(i = 0;i < data.length;i++) {if(parsedData[i].length === 0){console.error("Row " + (1 + i) + " of data is empty");return null;}if(parsedData[i][0] === null || typeof parsedData[i][0].getTime != 'function' || isNaN(parsedData[i][0].getTime())){console.error("x value in row " + (1 + i) + " is not a Date");return null;}parsedData[i][0] = parsedData[i][0].getTime();}return parsedData;}else { // Some intelligent defaults for a numeric x-axis.
/** @private (shut up, jsdoc!) */this.attrs_.axes.x.valueFormatter = function(x){return x;};this.attrs_.axes.x.ticker = DygraphTickers.numericTicks;this.attrs_.axes.x.axisLabelFormatter = utils.numberAxisLabelFormatter;return data;}}; /**
 * Parses a DataTable object from gviz.
 * The data is expected to have a first column that is either a date or a
 * number. All subsequent columns must be numbers. If there is a clear mismatch
 * between this.xValueParser_ and the type of the first column, it will be
 * fixed. Fills out rawData_.
 * @param {!google.visualization.DataTable} data See above.
 * @private
 */Dygraph.prototype.parseDataTable_ = function(data){var shortTextForAnnotationNum=function shortTextForAnnotationNum(num){ // converts [0-9]+ [A-Z][a-z]*
// example: 0=A, 1=B, 25=Z, 26=Aa, 27=Ab
// and continues like.. Ba Bb .. Za .. Zz..Aaa...Zzz Aaaa Zzzz
var shortText=String.fromCharCode(65 /* A */ + num % 26);num = Math.floor(num / 26);while(num > 0) {shortText = String.fromCharCode(65 /* A */ + (num - 1) % 26) + shortText.toLowerCase();num = Math.floor((num - 1) / 26);}return shortText;};var cols=data.getNumberOfColumns();var rows=data.getNumberOfRows();var indepType=data.getColumnType(0);if(indepType == 'date' || indepType == 'datetime'){this.attrs_.xValueParser = utils.dateParser;this.attrs_.axes.x.valueFormatter = utils.dateValueFormatter;this.attrs_.axes.x.ticker = DygraphTickers.dateTicker;this.attrs_.axes.x.axisLabelFormatter = utils.dateAxisLabelFormatter;}else if(indepType == 'number'){this.attrs_.xValueParser = function(x){return parseFloat(x);};this.attrs_.axes.x.valueFormatter = function(x){return x;};this.attrs_.axes.x.ticker = DygraphTickers.numericTicks;this.attrs_.axes.x.axisLabelFormatter = this.attrs_.axes.x.valueFormatter;}else {throw new Error("only 'date', 'datetime' and 'number' types are supported " + "for column 1 of DataTable input (Got '" + indepType + "')");} // Array of the column indices which contain data (and not annotations).
var colIdx=[];var annotationCols={}; // data index -> [annotation cols]
var hasAnnotations=false;var i,j;for(i = 1;i < cols;i++) {var type=data.getColumnType(i);if(type == 'number'){colIdx.push(i);}else if(type == 'string' && this.getBooleanOption('displayAnnotations')){ // This is OK -- it's an annotation column.
var dataIdx=colIdx[colIdx.length - 1];if(!annotationCols.hasOwnProperty(dataIdx)){annotationCols[dataIdx] = [i];}else {annotationCols[dataIdx].push(i);}hasAnnotations = true;}else {throw new Error("Only 'number' is supported as a dependent type with Gviz." + " 'string' is only supported if displayAnnotations is true");}} // Read column labels
// TODO(danvk): add support back for errorBars
var labels=[data.getColumnLabel(0)];for(i = 0;i < colIdx.length;i++) {labels.push(data.getColumnLabel(colIdx[i]));if(this.getBooleanOption("errorBars"))i += 1;}this.attrs_.labels = labels;cols = labels.length;var ret=[];var outOfOrder=false;var annotations=[];for(i = 0;i < rows;i++) {var row=[];if(typeof data.getValue(i,0) === 'undefined' || data.getValue(i,0) === null){console.warn("Ignoring row " + i + " of DataTable because of undefined or null first column.");continue;}if(indepType == 'date' || indepType == 'datetime'){row.push(data.getValue(i,0).getTime());}else {row.push(data.getValue(i,0));}if(!this.getBooleanOption("errorBars")){for(j = 0;j < colIdx.length;j++) {var col=colIdx[j];row.push(data.getValue(i,col));if(hasAnnotations && annotationCols.hasOwnProperty(col) && data.getValue(i,annotationCols[col][0]) !== null){var ann={};ann.series = data.getColumnLabel(col);ann.xval = row[0];ann.shortText = shortTextForAnnotationNum(annotations.length);ann.text = '';for(var k=0;k < annotationCols[col].length;k++) {if(k)ann.text += "\n";ann.text += data.getValue(i,annotationCols[col][k]);}annotations.push(ann);}} // Strip out infinities, which give dygraphs problems later on.
for(j = 0;j < row.length;j++) {if(!isFinite(row[j]))row[j] = null;}}else {for(j = 0;j < cols - 1;j++) {row.push([data.getValue(i,1 + 2 * j),data.getValue(i,2 + 2 * j)]);}}if(ret.length > 0 && row[0] < ret[ret.length - 1][0]){outOfOrder = true;}ret.push(row);}if(outOfOrder){console.warn("DataTable is out of order; order it correctly to speed loading.");ret.sort(function(a,b){return a[0] - b[0];});}this.rawData_ = ret;if(annotations.length > 0){this.setAnnotations(annotations,true);}this.attributes_.reparseSeries();}; /**
 * Signals to plugins that the chart data has updated.
 * This happens after the data has updated but before the chart has redrawn.
 */Dygraph.prototype.cascadeDataDidUpdateEvent_ = function(){ // TODO(danvk): there are some issues checking xAxisRange() and using
// toDomCoords from handlers of this event. The visible range should be set
// when the chart is drawn, not derived from the data.
this.cascadeEvents_('dataDidUpdate',{});}; /**
 * Get the CSV data. If it's in a function, call that function. If it's in a
 * file, do an XMLHttpRequest to get it.
 * @private
 */Dygraph.prototype.start_ = function(){var data=this.file_; // Functions can return references of all other types.
if(typeof data == 'function'){data = data();}if(utils.isArrayLike(data)){this.rawData_ = this.parseArray_(data);this.cascadeDataDidUpdateEvent_();this.predraw_();}else if(typeof data == 'object' && typeof data.getColumnRange == 'function'){ // must be a DataTable from gviz.
this.parseDataTable_(data);this.cascadeDataDidUpdateEvent_();this.predraw_();}else if(typeof data == 'string'){ // Heuristic: a newline means it's CSV data. Otherwise it's an URL.
var line_delimiter=utils.detectLineDelimiter(data);if(line_delimiter){this.loadedEvent_(data);}else { // REMOVE_FOR_IE
var req;if(window.XMLHttpRequest){ // Firefox, Opera, IE7, and other browsers will use the native object
req = new XMLHttpRequest();}else { // IE 5 and 6 will use the ActiveX control
req = new ActiveXObject("Microsoft.XMLHTTP");}var caller=this;req.onreadystatechange = function(){if(req.readyState == 4){if(req.status === 200 ||  // Normal http
req.status === 0){ // Chrome w/ --allow-file-access-from-files
caller.loadedEvent_(req.responseText);}}};req.open("GET",data,true);req.send(null);}}else {console.error("Unknown data format: " + typeof data);}}; /**
 * Changes various properties of the graph. These can include:
 * <ul>
 * <li>file: changes the source data for the graph</li>
 * <li>errorBars: changes whether the data contains stddev</li>
 * </ul>
 *
 * There's a huge variety of options that can be passed to this method. For a
 * full list, see http://dygraphs.com/options.html.
 *
 * @param {Object} input_attrs The new properties and values
 * @param {boolean} block_redraw Usually the chart is redrawn after every
 *     call to updateOptions(). If you know better, you can pass true to
 *     explicitly block the redraw. This can be useful for chaining
 *     updateOptions() calls, avoiding the occasional infinite loop and
 *     preventing redraws when it's not necessary (e.g. when updating a
 *     callback).
 */Dygraph.prototype.updateOptions = function(input_attrs,block_redraw){if(typeof block_redraw == 'undefined')block_redraw = false; // copyUserAttrs_ drops the "file" parameter as a convenience to us.
var file=input_attrs.file;var attrs=Dygraph.copyUserAttrs_(input_attrs); // TODO(danvk): this is a mess. Move these options into attr_.
if('rollPeriod' in attrs){this.rollPeriod_ = attrs.rollPeriod;}if('dateWindow' in attrs){this.dateWindow_ = attrs.dateWindow;} // TODO(danvk): validate per-series options.
// Supported:
// strokeWidth
// pointSize
// drawPoints
// highlightCircleSize
// Check if this set options will require new points.
var requiresNewPoints=utils.isPixelChangingOptionList(this.attr_("labels"),attrs);utils.updateDeep(this.user_attrs_,attrs);this.attributes_.reparseSeries();if(file){ // This event indicates that the data is about to change, but hasn't yet.
// TODO(danvk): support cancelation of the update via this event.
this.cascadeEvents_('dataWillUpdate',{});this.file_ = file;if(!block_redraw)this.start_();}else {if(!block_redraw){if(requiresNewPoints){this.predraw_();}else {this.renderGraph_(false);}}}}; /**
 * Make a copy of input attributes, removing file as a convenience.
 */Dygraph.copyUserAttrs_ = function(attrs){var my_attrs={};for(var k in attrs) {if(!attrs.hasOwnProperty(k))continue;if(k == 'file')continue;if(attrs.hasOwnProperty(k))my_attrs[k] = attrs[k];}return my_attrs;}; /**
 * Resizes the dygraph. If no parameters are specified, resizes to fill the
 * containing div (which has presumably changed size since the dygraph was
 * instantiated. If the width/height are specified, the div will be resized.
 *
 * This is far more efficient than destroying and re-instantiating a
 * Dygraph, since it doesn't have to reparse the underlying data.
 *
 * @param {number} width Width (in pixels)
 * @param {number} height Height (in pixels)
 */Dygraph.prototype.resize = function(width,height){if(this.resize_lock){return;}this.resize_lock = true;if(width === null != (height === null)){console.warn("Dygraph.resize() should be called with zero parameters or " + "two non-NULL parameters. Pretending it was zero.");width = height = null;}var old_width=this.width_;var old_height=this.height_;if(width){this.maindiv_.style.width = width + "px";this.maindiv_.style.height = height + "px";this.width_ = width;this.height_ = height;}else {this.width_ = this.maindiv_.clientWidth;this.height_ = this.maindiv_.clientHeight;}if(old_width != this.width_ || old_height != this.height_){ // Resizing a canvas erases it, even when the size doesn't change, so
// any resize needs to be followed by a redraw.
this.resizeElements_();this.predraw_();}this.resize_lock = false;}; /**
 * Adjusts the number of points in the rolling average. Updates the graph to
 * reflect the new averaging period.
 * @param {number} length Number of points over which to average the data.
 */Dygraph.prototype.adjustRoll = function(length){this.rollPeriod_ = length;this.predraw_();}; /**
 * Returns a boolean array of visibility statuses.
 */Dygraph.prototype.visibility = function(){ // Do lazy-initialization, so that this happens after we know the number of
// data series.
if(!this.getOption("visibility")){this.attrs_.visibility = [];} // TODO(danvk): it looks like this could go into an infinite loop w/ user_attrs.
while(this.getOption("visibility").length < this.numColumns() - 1) {this.attrs_.visibility.push(true);}return this.getOption("visibility");}; /**
 * Changes the visibility of one or more series.
 *
 * @param {number|number[]|object} num the series index or an array of series indices
 *                                     or a boolean array of visibility states by index
 *                                     or an object mapping series numbers, as keys, to
 *                                     visibility state (boolean values)
 * @param {boolean} value the visibility state expressed as a boolean
 */Dygraph.prototype.setVisibility = function(num,value){var x=this.visibility();var numIsObject=false;if(!Array.isArray(num)){if(num !== null && typeof num === 'object'){numIsObject = true;}else {num = [num];}}if(numIsObject){for(var i in num) {if(num.hasOwnProperty(i)){if(i < 0 || i >= x.length){console.warn("Invalid series number in setVisibility: " + i);}else {x[i] = num[i];}}}}else {for(var i=0;i < num.length;i++) {if(typeof num[i] === 'boolean'){if(i >= x.length){console.warn("Invalid series number in setVisibility: " + i);}else {x[i] = num[i];}}else {if(num[i] < 0 || num[i] >= x.length){console.warn("Invalid series number in setVisibility: " + num[i]);}else {x[num[i]] = value;}}}}this.predraw_();}; /**
 * How large of an area will the dygraph render itself in?
 * This is used for testing.
 * @return A {width: w, height: h} object.
 * @private
 */Dygraph.prototype.size = function(){return {width:this.width_,height:this.height_};}; /**
 * Update the list of annotations and redraw the chart.
 * See dygraphs.com/annotations.html for more info on how to use annotations.
 * @param ann {Array} An array of annotation objects.
 * @param suppressDraw {Boolean} Set to "true" to block chart redraw (optional).
 */Dygraph.prototype.setAnnotations = function(ann,suppressDraw){ // Only add the annotation CSS rule once we know it will be used.
this.annotations_ = ann;if(!this.layout_){console.warn("Tried to setAnnotations before dygraph was ready. " + "Try setting them in a ready() block. See " + "dygraphs.com/tests/annotation.html");return;}this.layout_.setAnnotations(this.annotations_);if(!suppressDraw){this.predraw_();}}; /**
 * Return the list of annotations.
 */Dygraph.prototype.annotations = function(){return this.annotations_;}; /**
 * Get the list of label names for this graph. The first column is the
 * x-axis, so the data series names start at index 1.
 *
 * Returns null when labels have not yet been defined.
 */Dygraph.prototype.getLabels = function(){var labels=this.attr_("labels");return labels?labels.slice():null;}; /**
 * Get the index of a series (column) given its name. The first column is the
 * x-axis, so the data series start with index 1.
 */Dygraph.prototype.indexFromSetName = function(name){return this.setIndexByName_[name];}; /**
 * Find the row number corresponding to the given x-value.
 * Returns null if there is no such x-value in the data.
 * If there are multiple rows with the same x-value, this will return the
 * first one.
 * @param {number} xVal The x-value to look for (e.g. millis since epoch).
 * @return {?number} The row number, which you can pass to getValue(), or null.
 */Dygraph.prototype.getRowForX = function(xVal){var low=0,high=this.numRows() - 1;while(low <= high) {var idx=high + low >> 1;var x=this.getValue(idx,0);if(x < xVal){low = idx + 1;}else if(x > xVal){high = idx - 1;}else if(low != idx){ // equal, but there may be an earlier match.
high = idx;}else {return idx;}}return null;}; /**
 * Trigger a callback when the dygraph has drawn itself and is ready to be
 * manipulated. This is primarily useful when dygraphs has to do an XHR for the
 * data (i.e. a URL is passed as the data source) and the chart is drawn
 * asynchronously. If the chart has already drawn, the callback will fire
 * immediately.
 *
 * This is a good place to call setAnnotation().
 *
 * @param {function(!Dygraph)} callback The callback to trigger when the chart
 *     is ready.
 */Dygraph.prototype.ready = function(callback){if(this.is_initial_draw_){this.readyFns_.push(callback);}else {callback.call(this,this);}}; /**
 * Add an event handler. This event handler is kept until the graph is
 * destroyed with a call to graph.destroy().
 *
 * @param {!Node} elem The element to add the event to.
 * @param {string} type The type of the event, e.g. 'click' or 'mousemove'.
 * @param {function(Event):(boolean|undefined)} fn The function to call
 *     on the event. The function takes one parameter: the event object.
 * @private
 */Dygraph.prototype.addAndTrackEvent = function(elem,type,fn){utils.addEvent(elem,type,fn);this.registeredEvents_.push({elem:elem,type:type,fn:fn});};Dygraph.prototype.removeTrackedEvents_ = function(){if(this.registeredEvents_){for(var idx=0;idx < this.registeredEvents_.length;idx++) {var reg=this.registeredEvents_[idx];utils.removeEvent(reg.elem,reg.type,reg.fn);}}this.registeredEvents_ = [];}; // Installed plugins, in order of precedence (most-general to most-specific).
Dygraph.PLUGINS = [_pluginsLegend2['default'],_pluginsAxes2['default'],_pluginsRangeSelector2['default'], // Has to be before ChartLabels so that its callbacks are called after ChartLabels' callbacks.
_pluginsChartLabels2['default'],_pluginsAnnotations2['default'],_pluginsGrid2['default']]; // There are many symbols which have historically been available through the
// Dygraph class. These are exported here for backwards compatibility.
Dygraph.GVizChart = _dygraphGviz2['default'];Dygraph.DASHED_LINE = utils.DASHED_LINE;Dygraph.DOT_DASH_LINE = utils.DOT_DASH_LINE;Dygraph.dateAxisLabelFormatter = utils.dateAxisLabelFormatter;Dygraph.toRGB_ = utils.toRGB_;Dygraph.findPos = utils.findPos;Dygraph.pageX = utils.pageX;Dygraph.pageY = utils.pageY;Dygraph.dateString_ = utils.dateString_;Dygraph.defaultInteractionModel = _dygraphInteractionModel2['default'].defaultModel;Dygraph.nonInteractiveModel = Dygraph.nonInteractiveModel_ = _dygraphInteractionModel2['default'].nonInteractiveModel_;Dygraph.Circles = utils.Circles;Dygraph.Plugins = {Legend:_pluginsLegend2['default'],Axes:_pluginsAxes2['default'],Annotations:_pluginsAnnotations2['default'],ChartLabels:_pluginsChartLabels2['default'],Grid:_pluginsGrid2['default'],RangeSelector:_pluginsRangeSelector2['default']};Dygraph.DataHandlers = {DefaultHandler:_datahandlerDefault2['default'],BarsHandler:_datahandlerBars2['default'],CustomBarsHandler:_datahandlerBarsCustom2['default'],DefaultFractionHandler:_datahandlerDefaultFractions2['default'],ErrorBarsHandler:_datahandlerBarsError2['default'],FractionsBarsHandler:_datahandlerBarsFractions2['default']};Dygraph.startPan = _dygraphInteractionModel2['default'].startPan;Dygraph.startZoom = _dygraphInteractionModel2['default'].startZoom;Dygraph.movePan = _dygraphInteractionModel2['default'].movePan;Dygraph.moveZoom = _dygraphInteractionModel2['default'].moveZoom;Dygraph.endPan = _dygraphInteractionModel2['default'].endPan;Dygraph.endZoom = _dygraphInteractionModel2['default'].endZoom;Dygraph.numericLinearTicks = DygraphTickers.numericLinearTicks;Dygraph.numericTicks = DygraphTickers.numericTicks;Dygraph.dateTicker = DygraphTickers.dateTicker;Dygraph.Granularity = DygraphTickers.Granularity;Dygraph.getDateAxis = DygraphTickers.getDateAxis;Dygraph.floatFormat = utils.floatFormat;exports['default'] = Dygraph;module.exports = exports['default'];

}).call(this,require('_process'))

},{"./datahandler/bars":126,"./datahandler/bars-custom":123,"./datahandler/bars-error":124,"./datahandler/bars-fractions":125,"./datahandler/default":129,"./datahandler/default-fractions":128,"./dygraph-canvas":130,"./dygraph-default-attrs":131,"./dygraph-gviz":132,"./dygraph-interaction-model":133,"./dygraph-layout":134,"./dygraph-options":136,"./dygraph-options-reference":135,"./dygraph-tickers":137,"./dygraph-utils":138,"./iframe-tarp":142,"./plugins/annotations":143,"./plugins/axes":144,"./plugins/chart-labels":145,"./plugins/grid":146,"./plugins/legend":147,"./plugins/range-selector":148,"_process":122}],140:[function(require,module,exports){
'use strict';

(function () {
  "use strict";

  var Dygraph;
  if (window.Dygraph) {
    Dygraph = window.Dygraph;
  } else if (typeof module !== 'undefined') {
    Dygraph = require('../dygraph');
  }

  /**
   * Given three sequential points, p0, p1 and p2, find the left and right
   * control points for p1.
   *
   * The three points are expected to have x and y properties.
   *
   * The alpha parameter controls the amount of smoothing.
   * If α=0, then both control points will be the same as p1 (i.e. no smoothing).
   *
   * Returns [l1x, l1y, r1x, r1y]
   *
   * It's guaranteed that the line from (l1x, l1y)-(r1x, r1y) passes through p1.
   * Unless allowFalseExtrema is set, then it's also guaranteed that:
   *   l1y ∈ [p0.y, p1.y]
   *   r1y ∈ [p1.y, p2.y]
   *
   * The basic algorithm is:
   * 1. Put the control points l1 and r1 α of the way down (p0, p1) and (p1, p2).
   * 2. Shift l1 and r2 so that the line l1–r1 passes through p1
   * 3. Adjust to prevent false extrema while keeping p1 on the l1–r1 line.
   *
   * This is loosely based on the HighCharts algorithm.
   */
  function getControlPoints(p0, p1, p2, opt_alpha, opt_allowFalseExtrema) {
    var alpha = opt_alpha !== undefined ? opt_alpha : 1 / 3; // 0=no smoothing, 1=crazy smoothing
    var allowFalseExtrema = opt_allowFalseExtrema || false;

    if (!p2) {
      return [p1.x, p1.y, null, null];
    }

    // Step 1: Position the control points along each line segment.
    var l1x = (1 - alpha) * p1.x + alpha * p0.x,
        l1y = (1 - alpha) * p1.y + alpha * p0.y,
        r1x = (1 - alpha) * p1.x + alpha * p2.x,
        r1y = (1 - alpha) * p1.y + alpha * p2.y;

    // Step 2: shift the points up so that p1 is on the l1–r1 line.
    if (l1x != r1x) {
      // This can be derived w/ some basic algebra.
      var deltaY = p1.y - r1y - (p1.x - r1x) * (l1y - r1y) / (l1x - r1x);
      l1y += deltaY;
      r1y += deltaY;
    }

    // Step 3: correct to avoid false extrema.
    if (!allowFalseExtrema) {
      if (l1y > p0.y && l1y > p1.y) {
        l1y = Math.max(p0.y, p1.y);
        r1y = 2 * p1.y - l1y;
      } else if (l1y < p0.y && l1y < p1.y) {
        l1y = Math.min(p0.y, p1.y);
        r1y = 2 * p1.y - l1y;
      }

      if (r1y > p1.y && r1y > p2.y) {
        r1y = Math.max(p1.y, p2.y);
        l1y = 2 * p1.y - r1y;
      } else if (r1y < p1.y && r1y < p2.y) {
        r1y = Math.min(p1.y, p2.y);
        l1y = 2 * p1.y - r1y;
      }
    }

    return [l1x, l1y, r1x, r1y];
  }

  // i.e. is none of (null, undefined, NaN)
  function isOK(x) {
    return !!x && !isNaN(x);
  };

  // A plotter which uses splines to create a smooth curve.
  // See tests/plotters.html for a demo.
  // Can be controlled via smoothPlotter.smoothing
  function smoothPlotter(e) {
    var ctx = e.drawingContext,
        points = e.points;

    ctx.beginPath();
    ctx.moveTo(points[0].canvasx, points[0].canvasy);

    // right control point for previous point
    var lastRightX = points[0].canvasx,
        lastRightY = points[0].canvasy;

    for (var i = 1; i < points.length; i++) {
      var p0 = points[i - 1],
          p1 = points[i],
          p2 = points[i + 1];
      p0 = p0 && isOK(p0.canvasy) ? p0 : null;
      p1 = p1 && isOK(p1.canvasy) ? p1 : null;
      p2 = p2 && isOK(p2.canvasy) ? p2 : null;
      if (p0 && p1) {
        var controls = getControlPoints({ x: p0.canvasx, y: p0.canvasy }, { x: p1.canvasx, y: p1.canvasy }, p2 && { x: p2.canvasx, y: p2.canvasy }, smoothPlotter.smoothing);
        // Uncomment to show the control points:
        // ctx.lineTo(lastRightX, lastRightY);
        // ctx.lineTo(controls[0], controls[1]);
        // ctx.lineTo(p1.canvasx, p1.canvasy);
        lastRightX = lastRightX !== null ? lastRightX : p0.canvasx;
        lastRightY = lastRightY !== null ? lastRightY : p0.canvasy;
        ctx.bezierCurveTo(lastRightX, lastRightY, controls[0], controls[1], p1.canvasx, p1.canvasy);
        lastRightX = controls[2];
        lastRightY = controls[3];
      } else if (p1) {
        // We're starting again after a missing point.
        ctx.moveTo(p1.canvasx, p1.canvasy);
        lastRightX = p1.canvasx;
        lastRightY = p1.canvasy;
      } else {
        lastRightX = lastRightY = null;
      }
    }

    ctx.stroke();
  }
  smoothPlotter.smoothing = 1 / 3;
  smoothPlotter._getControlPoints = getControlPoints; // for testing

  // older versions exported a global.
  // This will be removed in the future.
  // The preferred way to access smoothPlotter is via Dygraph.smoothPlotter.
  window.smoothPlotter = smoothPlotter;
  Dygraph.smoothPlotter = smoothPlotter;
})();

},{"../dygraph":139}],141:[function(require,module,exports){
/**
 * Synchronize zooming and/or selections between a set of dygraphs.
 *
 * Usage:
 *
 *   var g1 = new Dygraph(...),
 *       g2 = new Dygraph(...),
 *       ...;
 *   var sync = Dygraph.synchronize(g1, g2, ...);
 *   // charts are now synchronized
 *   sync.detach();
 *   // charts are no longer synchronized
 *
 * You can set options using the last parameter, for example:
 *
 *   var sync = Dygraph.synchronize(g1, g2, g3, {
 *      selection: true,
 *      zoom: true
 *   });
 *
 * The default is to synchronize both of these.
 *
 * Instead of passing one Dygraph object as each parameter, you may also pass an
 * array of dygraphs:
 *
 *   var sync = Dygraph.synchronize([g1, g2, g3], {
 *      selection: false,
 *      zoom: true
 *   });
 *
 * You may also set `range: false` if you wish to only sync the x-axis.
 * The `range` option has no effect unless `zoom` is true (the default).
 */
'use strict';

(function () {
  /* global Dygraph:false */
  'use strict';

  var Dygraph;
  if (window.Dygraph) {
    Dygraph = window.Dygraph;
  } else if (typeof module !== 'undefined') {
    Dygraph = require('../dygraph');
  }

  var synchronize = function synchronize() /* dygraphs..., opts */{
    if (arguments.length === 0) {
      throw 'Invalid invocation of Dygraph.synchronize(). Need >= 1 argument.';
    }

    var OPTIONS = ['selection', 'zoom', 'range'];
    var opts = {
      selection: true,
      zoom: true,
      range: true
    };
    var dygraphs = [];
    var prevCallbacks = [];

    var parseOpts = function parseOpts(obj) {
      if (!(obj instanceof Object)) {
        throw 'Last argument must be either Dygraph or Object.';
      } else {
        for (var i = 0; i < OPTIONS.length; i++) {
          var optName = OPTIONS[i];
          if (obj.hasOwnProperty(optName)) opts[optName] = obj[optName];
        }
      }
    };

    if (arguments[0] instanceof Dygraph) {
      // Arguments are Dygraph objects.
      for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] instanceof Dygraph) {
          dygraphs.push(arguments[i]);
        } else {
          break;
        }
      }
      if (i < arguments.length - 1) {
        throw 'Invalid invocation of Dygraph.synchronize(). ' + 'All but the last argument must be Dygraph objects.';
      } else if (i == arguments.length - 1) {
        parseOpts(arguments[arguments.length - 1]);
      }
    } else if (arguments[0].length) {
      // Invoked w/ list of dygraphs, options
      for (var i = 0; i < arguments[0].length; i++) {
        dygraphs.push(arguments[0][i]);
      }
      if (arguments.length == 2) {
        parseOpts(arguments[1]);
      } else if (arguments.length > 2) {
        throw 'Invalid invocation of Dygraph.synchronize(). ' + 'Expected two arguments: array and optional options argument.';
      } // otherwise arguments.length == 1, which is fine.
    } else {
        throw 'Invalid invocation of Dygraph.synchronize(). ' + 'First parameter must be either Dygraph or list of Dygraphs.';
      }

    if (dygraphs.length < 2) {
      throw 'Invalid invocation of Dygraph.synchronize(). ' + 'Need two or more dygraphs to synchronize.';
    }

    var readycount = dygraphs.length;
    for (var i = 0; i < dygraphs.length; i++) {
      var g = dygraphs[i];
      g.ready(function () {
        if (--readycount == 0) {
          // store original callbacks
          var callBackTypes = ['drawCallback', 'highlightCallback', 'unhighlightCallback'];
          for (var j = 0; j < dygraphs.length; j++) {
            if (!prevCallbacks[j]) {
              prevCallbacks[j] = {};
            }
            for (var k = callBackTypes.length - 1; k >= 0; k--) {
              prevCallbacks[j][callBackTypes[k]] = dygraphs[j].getFunctionOption(callBackTypes[k]);
            }
          }

          // Listen for draw, highlight, unhighlight callbacks.
          if (opts.zoom) {
            attachZoomHandlers(dygraphs, opts, prevCallbacks);
          }

          if (opts.selection) {
            attachSelectionHandlers(dygraphs, prevCallbacks);
          }
        }
      });
    }

    return {
      detach: function detach() {
        for (var i = 0; i < dygraphs.length; i++) {
          var g = dygraphs[i];
          if (opts.zoom) {
            g.updateOptions({ drawCallback: prevCallbacks[i].drawCallback });
          }
          if (opts.selection) {
            g.updateOptions({
              highlightCallback: prevCallbacks[i].highlightCallback,
              unhighlightCallback: prevCallbacks[i].unhighlightCallback
            });
          }
        }
        // release references & make subsequent calls throw.
        dygraphs = null;
        opts = null;
        prevCallbacks = null;
      }
    };
  };

  function arraysAreEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    var i = a.length;
    if (i !== b.length) return false;
    while (i--) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function attachZoomHandlers(gs, syncOpts, prevCallbacks) {
    var block = false;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      g.updateOptions({
        drawCallback: function drawCallback(me, initial) {
          if (block || initial) return;
          block = true;
          var opts = {
            dateWindow: me.xAxisRange()
          };
          if (syncOpts.range) opts.valueRange = me.yAxisRange();

          for (var j = 0; j < gs.length; j++) {
            if (gs[j] == me) {
              if (prevCallbacks[j] && prevCallbacks[j].drawCallback) {
                prevCallbacks[j].drawCallback.apply(this, arguments);
              }
              continue;
            }

            // Only redraw if there are new options
            if (arraysAreEqual(opts.dateWindow, gs[j].getOption('dateWindow')) && arraysAreEqual(opts.valueRange, gs[j].getOption('valueRange'))) {
              continue;
            }

            gs[j].updateOptions(opts);
          }
          block = false;
        }
      }, true /* no need to redraw */);
    }
  }

  function attachSelectionHandlers(gs, prevCallbacks) {
    var block = false;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];

      g.updateOptions({
        highlightCallback: function highlightCallback(event, x, points, row, seriesName) {
          if (block) return;
          block = true;
          var me = this;
          for (var i = 0; i < gs.length; i++) {
            if (me == gs[i]) {
              if (prevCallbacks[i] && prevCallbacks[i].highlightCallback) {
                prevCallbacks[i].highlightCallback.apply(this, arguments);
              }
              continue;
            }
            var idx = gs[i].getRowForX(x);
            if (idx !== null) {
              gs[i].setSelection(idx, seriesName);
            }
          }
          block = false;
        },
        unhighlightCallback: function unhighlightCallback(event) {
          if (block) return;
          block = true;
          var me = this;
          for (var i = 0; i < gs.length; i++) {
            if (me == gs[i]) {
              if (prevCallbacks[i] && prevCallbacks[i].unhighlightCallback) {
                prevCallbacks[i].unhighlightCallback.apply(this, arguments);
              }
              continue;
            }
            gs[i].clearSelection();
          }
          block = false;
        }
      }, true /* no need to redraw */);
    }
  }

  Dygraph.synchronize = synchronize;
})();

},{"../dygraph":139}],142:[function(require,module,exports){
/**
 * To create a "drag" interaction, you typically register a mousedown event
 * handler on the element where the drag begins. In that handler, you register a
 * mouseup handler on the window to determine when the mouse is released,
 * wherever that release happens. This works well, except when the user releases
 * the mouse over an off-domain iframe. In that case, the mouseup event is
 * handled by the iframe and never bubbles up to the window handler.
 *
 * To deal with this issue, we cover iframes with high z-index divs to make sure
 * they don't capture mouseup.
 *
 * Usage:
 * element.addEventListener('mousedown', function() {
 *   var tarper = new IFrameTarp();
 *   tarper.cover();
 *   var mouseUpHandler = function() {
 *     ...
 *     window.removeEventListener(mouseUpHandler);
 *     tarper.uncover();
 *   };
 *   window.addEventListener('mouseup', mouseUpHandler);
 * };
 *
 * @constructor
 */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _dygraphUtils = require('./dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

function IFrameTarp() {
  /** @type {Array.<!HTMLDivElement>} */
  this.tarps = [];
};

/**
 * Find all the iframes in the document and cover them with high z-index
 * transparent divs.
 */
IFrameTarp.prototype.cover = function () {
  var iframes = document.getElementsByTagName("iframe");
  for (var i = 0; i < iframes.length; i++) {
    var iframe = iframes[i];
    var pos = utils.findPos(iframe),
        x = pos.x,
        y = pos.y,
        width = iframe.offsetWidth,
        height = iframe.offsetHeight;

    var div = document.createElement("div");
    div.style.position = "absolute";
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.style.width = width + 'px';
    div.style.height = height + 'px';
    div.style.zIndex = 999;
    document.body.appendChild(div);
    this.tarps.push(div);
  }
};

/**
 * Remove all the iframe covers. You should call this in a mouseup handler.
 */
IFrameTarp.prototype.uncover = function () {
  for (var i = 0; i < this.tarps.length; i++) {
    this.tarps[i].parentNode.removeChild(this.tarps[i]);
  }
  this.tarps = [];
};

exports["default"] = IFrameTarp;
module.exports = exports["default"];

},{"./dygraph-utils":138}],143:[function(require,module,exports){
/**
 * @license
 * Copyright 2012 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/*global Dygraph:false */

"use strict";

/**
Current bits of jankiness:
- Uses dygraph.layout_ to get the parsed annotations.
- Uses dygraph.plotter_.area

It would be nice if the plugin didn't require so much special support inside
the core dygraphs classes, but annotations involve quite a bit of parsing and
layout.

TODO(danvk): cache DOM elements.
*/

Object.defineProperty(exports, "__esModule", {
  value: true
});
var annotations = function annotations() {
  this.annotations_ = [];
};

annotations.prototype.toString = function () {
  return "Annotations Plugin";
};

annotations.prototype.activate = function (g) {
  return {
    clearChart: this.clearChart,
    didDrawChart: this.didDrawChart
  };
};

annotations.prototype.detachLabels = function () {
  for (var i = 0; i < this.annotations_.length; i++) {
    var a = this.annotations_[i];
    if (a.parentNode) a.parentNode.removeChild(a);
    this.annotations_[i] = null;
  }
  this.annotations_ = [];
};

annotations.prototype.clearChart = function (e) {
  this.detachLabels();
};

annotations.prototype.didDrawChart = function (e) {
  var g = e.dygraph;

  // Early out in the (common) case of zero annotations.
  var points = g.layout_.annotated_points;
  if (!points || points.length === 0) return;

  var containerDiv = e.canvas.parentNode;

  var bindEvt = function bindEvt(eventName, classEventName, pt) {
    return function (annotation_event) {
      var a = pt.annotation;
      if (a.hasOwnProperty(eventName)) {
        a[eventName](a, pt, g, annotation_event);
      } else if (g.getOption(classEventName)) {
        g.getOption(classEventName)(a, pt, g, annotation_event);
      }
    };
  };

  // Add the annotations one-by-one.
  var area = e.dygraph.getArea();

  // x-coord to sum of previous annotation's heights (used for stacking).
  var xToUsedHeight = {};

  for (var i = 0; i < points.length; i++) {
    var p = points[i];
    if (p.canvasx < area.x || p.canvasx > area.x + area.w || p.canvasy < area.y || p.canvasy > area.y + area.h) {
      continue;
    }

    var a = p.annotation;
    var tick_height = 6;
    if (a.hasOwnProperty("tickHeight")) {
      tick_height = a.tickHeight;
    }

    // TODO: deprecate axisLabelFontSize in favor of CSS
    var div = document.createElement("div");
    div.style['fontSize'] = g.getOption('axisLabelFontSize') + "px";
    var className = 'dygraph-annotation';
    if (!a.hasOwnProperty('icon')) {
      // camelCase class names are deprecated.
      className += ' dygraphDefaultAnnotation dygraph-default-annotation';
    }
    if (a.hasOwnProperty('cssClass')) {
      className += " " + a.cssClass;
    }
    div.className = className;

    var width = a.hasOwnProperty('width') ? a.width : 16;
    var height = a.hasOwnProperty('height') ? a.height : 16;
    if (a.hasOwnProperty('icon')) {
      var img = document.createElement("img");
      img.src = a.icon;
      img.width = width;
      img.height = height;
      div.appendChild(img);
    } else if (p.annotation.hasOwnProperty('shortText')) {
      div.appendChild(document.createTextNode(p.annotation.shortText));
    }
    var left = p.canvasx - width / 2;
    div.style.left = left + "px";
    var divTop = 0;
    if (a.attachAtBottom) {
      var y = area.y + area.h - height - tick_height;
      if (xToUsedHeight[left]) {
        y -= xToUsedHeight[left];
      } else {
        xToUsedHeight[left] = 0;
      }
      xToUsedHeight[left] += tick_height + height;
      divTop = y;
    } else {
      divTop = p.canvasy - height - tick_height;
    }
    div.style.top = divTop + "px";
    div.style.width = width + "px";
    div.style.height = height + "px";
    div.title = p.annotation.text;
    div.style.color = g.colorsMap_[p.name];
    div.style.borderColor = g.colorsMap_[p.name];
    a.div = div;

    g.addAndTrackEvent(div, 'click', bindEvt('clickHandler', 'annotationClickHandler', p, this));
    g.addAndTrackEvent(div, 'mouseover', bindEvt('mouseOverHandler', 'annotationMouseOverHandler', p, this));
    g.addAndTrackEvent(div, 'mouseout', bindEvt('mouseOutHandler', 'annotationMouseOutHandler', p, this));
    g.addAndTrackEvent(div, 'dblclick', bindEvt('dblClickHandler', 'annotationDblClickHandler', p, this));

    containerDiv.appendChild(div);
    this.annotations_.push(div);

    var ctx = e.drawingContext;
    ctx.save();
    ctx.strokeStyle = a.hasOwnProperty('tickColor') ? a.tickColor : g.colorsMap_[p.name];
    ctx.lineWidth = a.hasOwnProperty('tickWidth') ? a.tickWidth : g.getOption('strokeWidth');
    ctx.beginPath();
    if (!a.attachAtBottom) {
      ctx.moveTo(p.canvasx, p.canvasy);
      ctx.lineTo(p.canvasx, p.canvasy - 2 - tick_height);
    } else {
      var y = divTop + height;
      ctx.moveTo(p.canvasx, y);
      ctx.lineTo(p.canvasx, y + tick_height);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
};

annotations.prototype.destroy = function () {
  this.detachLabels();
};

exports["default"] = annotations;
module.exports = exports["default"];

},{}],144:[function(require,module,exports){
/**
 * @license
 * Copyright 2012 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */

/*global Dygraph:false */

'use strict';

/*
Bits of jankiness:
- Direct layout access
- Direct area access
- Should include calculation of ticks, not just the drawing.

Options left to make axis-friendly.
  ('drawAxesAtZero')
  ('xAxisHeight')
*/

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _dygraphUtils = require('../dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

/**
 * Draws the axes. This includes the labels on the x- and y-axes, as well
 * as the tick marks on the axes.
 * It does _not_ draw the grid lines which span the entire chart.
 */
var axes = function axes() {
  this.xlabels_ = [];
  this.ylabels_ = [];
};

axes.prototype.toString = function () {
  return 'Axes Plugin';
};

axes.prototype.activate = function (g) {
  return {
    layout: this.layout,
    clearChart: this.clearChart,
    willDrawChart: this.willDrawChart
  };
};

axes.prototype.layout = function (e) {
  var g = e.dygraph;

  if (g.getOptionForAxis('drawAxis', 'y')) {
    var w = g.getOptionForAxis('axisLabelWidth', 'y') + 2 * g.getOptionForAxis('axisTickSize', 'y');
    e.reserveSpaceLeft(w);
  }

  if (g.getOptionForAxis('drawAxis', 'x')) {
    var h;
    // NOTE: I think this is probably broken now, since g.getOption() now
    // hits the dictionary. (That is, g.getOption('xAxisHeight') now always
    // has a value.)
    if (g.getOption('xAxisHeight')) {
      h = g.getOption('xAxisHeight');
    } else {
      h = g.getOptionForAxis('axisLabelFontSize', 'x') + 2 * g.getOptionForAxis('axisTickSize', 'x');
    }
    e.reserveSpaceBottom(h);
  }

  if (g.numAxes() == 2) {
    if (g.getOptionForAxis('drawAxis', 'y2')) {
      var w = g.getOptionForAxis('axisLabelWidth', 'y2') + 2 * g.getOptionForAxis('axisTickSize', 'y2');
      e.reserveSpaceRight(w);
    }
  } else if (g.numAxes() > 2) {
    g.error('Only two y-axes are supported at this time. (Trying ' + 'to use ' + g.numAxes() + ')');
  }
};

axes.prototype.detachLabels = function () {
  function removeArray(ary) {
    for (var i = 0; i < ary.length; i++) {
      var el = ary[i];
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  }

  removeArray(this.xlabels_);
  removeArray(this.ylabels_);
  this.xlabels_ = [];
  this.ylabels_ = [];
};

axes.prototype.clearChart = function (e) {
  this.detachLabels();
};

axes.prototype.willDrawChart = function (e) {
  var _this = this;

  var g = e.dygraph;

  if (!g.getOptionForAxis('drawAxis', 'x') && !g.getOptionForAxis('drawAxis', 'y') && !g.getOptionForAxis('drawAxis', 'y2')) {
    return;
  }

  // Round pixels to half-integer boundaries for crisper drawing.
  function halfUp(x) {
    return Math.round(x) + 0.5;
  }
  function halfDown(y) {
    return Math.round(y) - 0.5;
  }

  var context = e.drawingContext;
  var containerDiv = e.canvas.parentNode;
  var canvasWidth = g.width_; // e.canvas.width is affected by pixel ratio.
  var canvasHeight = g.height_;

  var label, x, y, tick, i;

  var makeLabelStyle = function makeLabelStyle(axis) {
    return {
      position: 'absolute',
      fontSize: g.getOptionForAxis('axisLabelFontSize', axis) + 'px',
      width: g.getOptionForAxis('axisLabelWidth', axis) + 'px'
    };
  };

  var labelStyles = {
    x: makeLabelStyle('x'),
    y: makeLabelStyle('y'),
    y2: makeLabelStyle('y2')
  };

  var makeDiv = function makeDiv(txt, axis, prec_axis) {
    /*
     * This seems to be called with the following three sets of axis/prec_axis:
     * x: undefined
     * y: y1
     * y: y2
     */
    var div = document.createElement('div');
    var labelStyle = labelStyles[prec_axis == 'y2' ? 'y2' : axis];
    utils.update(div.style, labelStyle);
    // TODO: combine outer & inner divs
    var inner_div = document.createElement('div');
    inner_div.className = 'dygraph-axis-label' + ' dygraph-axis-label-' + axis + (prec_axis ? ' dygraph-axis-label-' + prec_axis : '');
    inner_div.innerHTML = txt;
    div.appendChild(inner_div);
    return div;
  };

  // axis lines
  context.save();

  var layout = g.layout_;
  var area = e.dygraph.plotter_.area;

  // Helper for repeated axis-option accesses.
  var makeOptionGetter = function makeOptionGetter(axis) {
    return function (option) {
      return g.getOptionForAxis(option, axis);
    };
  };

  if (g.getOptionForAxis('drawAxis', 'y')) {
    if (layout.yticks && layout.yticks.length > 0) {
      var num_axes = g.numAxes();
      var getOptions = [makeOptionGetter('y'), makeOptionGetter('y2')];
      layout.yticks.forEach(function (tick) {
        if (tick.label === undefined) return; // this tick only has a grid line.
        x = area.x;
        var sgn = 1;
        var prec_axis = 'y1';
        var getAxisOption = getOptions[0];
        if (tick.axis == 1) {
          // right-side y-axis
          x = area.x + area.w;
          sgn = -1;
          prec_axis = 'y2';
          getAxisOption = getOptions[1];
        }
        var fontSize = getAxisOption('axisLabelFontSize');
        y = area.y + tick.pos * area.h;

        /* Tick marks are currently clipped, so don't bother drawing them.
        context.beginPath();
        context.moveTo(halfUp(x), halfDown(y));
        context.lineTo(halfUp(x - sgn * this.attr_('axisTickSize')), halfDown(y));
        context.closePath();
        context.stroke();
        */

        label = makeDiv(tick.label, 'y', num_axes == 2 ? prec_axis : null);
        var top = y - fontSize / 2;
        if (top < 0) top = 0;

        if (top + fontSize + 3 > canvasHeight) {
          label.style.bottom = '0';
        } else {
          label.style.top = top + 'px';
        }
        // TODO: replace these with css classes?
        if (tick.axis === 0) {
          label.style.left = area.x - getAxisOption('axisLabelWidth') - getAxisOption('axisTickSize') + 'px';
          label.style.textAlign = 'right';
        } else if (tick.axis == 1) {
          label.style.left = area.x + area.w + getAxisOption('axisTickSize') + 'px';
          label.style.textAlign = 'left';
        }
        label.style.width = getAxisOption('axisLabelWidth') + 'px';
        containerDiv.appendChild(label);
        _this.ylabels_.push(label);
      });

      // The lowest tick on the y-axis often overlaps with the leftmost
      // tick on the x-axis. Shift the bottom tick up a little bit to
      // compensate if necessary.
      var bottomTick = this.ylabels_[0];
      // Interested in the y2 axis also?
      var fontSize = g.getOptionForAxis('axisLabelFontSize', 'y');
      var bottom = parseInt(bottomTick.style.top, 10) + fontSize;
      if (bottom > canvasHeight - fontSize) {
        bottomTick.style.top = parseInt(bottomTick.style.top, 10) - fontSize / 2 + 'px';
      }
    }

    // draw a vertical line on the left to separate the chart from the labels.
    var axisX;
    if (g.getOption('drawAxesAtZero')) {
      var r = g.toPercentXCoord(0);
      if (r > 1 || r < 0 || isNaN(r)) r = 0;
      axisX = halfUp(area.x + r * area.w);
    } else {
      axisX = halfUp(area.x);
    }

    context.strokeStyle = g.getOptionForAxis('axisLineColor', 'y');
    context.lineWidth = g.getOptionForAxis('axisLineWidth', 'y');

    context.beginPath();
    context.moveTo(axisX, halfDown(area.y));
    context.lineTo(axisX, halfDown(area.y + area.h));
    context.closePath();
    context.stroke();

    // if there's a secondary y-axis, draw a vertical line for that, too.
    if (g.numAxes() == 2) {
      context.strokeStyle = g.getOptionForAxis('axisLineColor', 'y2');
      context.lineWidth = g.getOptionForAxis('axisLineWidth', 'y2');
      context.beginPath();
      context.moveTo(halfDown(area.x + area.w), halfDown(area.y));
      context.lineTo(halfDown(area.x + area.w), halfDown(area.y + area.h));
      context.closePath();
      context.stroke();
    }
  }

  if (g.getOptionForAxis('drawAxis', 'x')) {
    if (layout.xticks) {
      var getAxisOption = makeOptionGetter('x');
      layout.xticks.forEach(function (tick) {
        if (tick.label === undefined) return; // this tick only has a grid line.
        x = area.x + tick.pos * area.w;
        y = area.y + area.h;

        /* Tick marks are currently clipped, so don't bother drawing them.
        context.beginPath();
        context.moveTo(halfUp(x), halfDown(y));
        context.lineTo(halfUp(x), halfDown(y + this.attr_('axisTickSize')));
        context.closePath();
        context.stroke();
        */

        label = makeDiv(tick.label, 'x');
        label.style.textAlign = 'center';
        label.style.top = y + getAxisOption('axisTickSize') + 'px';

        var left = x - getAxisOption('axisLabelWidth') / 2;
        if (left + getAxisOption('axisLabelWidth') > canvasWidth) {
          left = canvasWidth - getAxisOption('axisLabelWidth');
          label.style.textAlign = 'right';
        }
        if (left < 0) {
          left = 0;
          label.style.textAlign = 'left';
        }

        label.style.left = left + 'px';
        label.style.width = getAxisOption('axisLabelWidth') + 'px';
        containerDiv.appendChild(label);
        _this.xlabels_.push(label);
      });
    }

    context.strokeStyle = g.getOptionForAxis('axisLineColor', 'x');
    context.lineWidth = g.getOptionForAxis('axisLineWidth', 'x');
    context.beginPath();
    var axisY;
    if (g.getOption('drawAxesAtZero')) {
      var r = g.toPercentYCoord(0, 0);
      if (r > 1 || r < 0) r = 1;
      axisY = halfDown(area.y + r * area.h);
    } else {
      axisY = halfDown(area.y + area.h);
    }
    context.moveTo(halfUp(area.x), axisY);
    context.lineTo(halfUp(area.x + area.w), axisY);
    context.closePath();
    context.stroke();
  }

  context.restore();
};

exports['default'] = axes;
module.exports = exports['default'];

},{"../dygraph-utils":138}],145:[function(require,module,exports){
/**
 * @license
 * Copyright 2012 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */
/*global Dygraph:false */

"use strict";

// TODO(danvk): move chart label options out of dygraphs and into the plugin.
// TODO(danvk): only tear down & rebuild the DIVs when it's necessary.

Object.defineProperty(exports, "__esModule", {
  value: true
});
var chart_labels = function chart_labels() {
  this.title_div_ = null;
  this.xlabel_div_ = null;
  this.ylabel_div_ = null;
  this.y2label_div_ = null;
};

chart_labels.prototype.toString = function () {
  return "ChartLabels Plugin";
};

chart_labels.prototype.activate = function (g) {
  return {
    layout: this.layout,
    // clearChart: this.clearChart,
    didDrawChart: this.didDrawChart
  };
};

// QUESTION: should there be a plugin-utils.js?
var createDivInRect = function createDivInRect(r) {
  var div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.left = r.x + 'px';
  div.style.top = r.y + 'px';
  div.style.width = r.w + 'px';
  div.style.height = r.h + 'px';
  return div;
};

// Detach and null out any existing nodes.
chart_labels.prototype.detachLabels_ = function () {
  var els = [this.title_div_, this.xlabel_div_, this.ylabel_div_, this.y2label_div_];
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (!el) continue;
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  this.title_div_ = null;
  this.xlabel_div_ = null;
  this.ylabel_div_ = null;
  this.y2label_div_ = null;
};

var createRotatedDiv = function createRotatedDiv(g, box, axis, classes, html) {
  // TODO(danvk): is this outer div actually necessary?
  var div = document.createElement("div");
  div.style.position = 'absolute';
  if (axis == 1) {
    // NOTE: this is cheating. Should be positioned relative to the box.
    div.style.left = '0px';
  } else {
    div.style.left = box.x + 'px';
  }
  div.style.top = box.y + 'px';
  div.style.width = box.w + 'px';
  div.style.height = box.h + 'px';
  div.style.fontSize = g.getOption('yLabelWidth') - 2 + 'px';

  var inner_div = document.createElement("div");
  inner_div.style.position = 'absolute';
  inner_div.style.width = box.h + 'px';
  inner_div.style.height = box.w + 'px';
  inner_div.style.top = box.h / 2 - box.w / 2 + 'px';
  inner_div.style.left = box.w / 2 - box.h / 2 + 'px';
  // TODO: combine inner_div and class_div.
  inner_div.className = 'dygraph-label-rotate-' + (axis == 1 ? 'right' : 'left');

  var class_div = document.createElement("div");
  class_div.className = classes;
  class_div.innerHTML = html;

  inner_div.appendChild(class_div);
  div.appendChild(inner_div);
  return div;
};

chart_labels.prototype.layout = function (e) {
  this.detachLabels_();

  var g = e.dygraph;
  var div = e.chart_div;
  if (g.getOption('title')) {
    // QUESTION: should this return an absolutely-positioned div instead?
    var title_rect = e.reserveSpaceTop(g.getOption('titleHeight'));
    this.title_div_ = createDivInRect(title_rect);
    this.title_div_.style.fontSize = g.getOption('titleHeight') - 8 + 'px';

    var class_div = document.createElement("div");
    class_div.className = 'dygraph-label dygraph-title';
    class_div.innerHTML = g.getOption('title');
    this.title_div_.appendChild(class_div);
    div.appendChild(this.title_div_);
  }

  if (g.getOption('xlabel')) {
    var x_rect = e.reserveSpaceBottom(g.getOption('xLabelHeight'));
    this.xlabel_div_ = createDivInRect(x_rect);
    this.xlabel_div_.style.fontSize = g.getOption('xLabelHeight') - 2 + 'px';

    var class_div = document.createElement("div");
    class_div.className = 'dygraph-label dygraph-xlabel';
    class_div.innerHTML = g.getOption('xlabel');
    this.xlabel_div_.appendChild(class_div);
    div.appendChild(this.xlabel_div_);
  }

  if (g.getOption('ylabel')) {
    // It would make sense to shift the chart here to make room for the y-axis
    // label, but the default yAxisLabelWidth is large enough that this results
    // in overly-padded charts. The y-axis label should fit fine. If it
    // doesn't, the yAxisLabelWidth option can be increased.
    var y_rect = e.reserveSpaceLeft(0);

    this.ylabel_div_ = createRotatedDiv(g, y_rect, 1, // primary (left) y-axis
    'dygraph-label dygraph-ylabel', g.getOption('ylabel'));
    div.appendChild(this.ylabel_div_);
  }

  if (g.getOption('y2label') && g.numAxes() == 2) {
    // same logic applies here as for ylabel.
    var y2_rect = e.reserveSpaceRight(0);
    this.y2label_div_ = createRotatedDiv(g, y2_rect, 2, // secondary (right) y-axis
    'dygraph-label dygraph-y2label', g.getOption('y2label'));
    div.appendChild(this.y2label_div_);
  }
};

chart_labels.prototype.didDrawChart = function (e) {
  var g = e.dygraph;
  if (this.title_div_) {
    this.title_div_.children[0].innerHTML = g.getOption('title');
  }
  if (this.xlabel_div_) {
    this.xlabel_div_.children[0].innerHTML = g.getOption('xlabel');
  }
  if (this.ylabel_div_) {
    this.ylabel_div_.children[0].children[0].innerHTML = g.getOption('ylabel');
  }
  if (this.y2label_div_) {
    this.y2label_div_.children[0].children[0].innerHTML = g.getOption('y2label');
  }
};

chart_labels.prototype.clearChart = function () {};

chart_labels.prototype.destroy = function () {
  this.detachLabels_();
};

exports["default"] = chart_labels;
module.exports = exports["default"];

},{}],146:[function(require,module,exports){
/**
 * @license
 * Copyright 2012 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */
/*global Dygraph:false */

/*

Current bits of jankiness:
- Direct layout access
- Direct area access

*/

"use strict";

/**
 * Draws the gridlines, i.e. the gray horizontal & vertical lines running the
 * length of the chart.
 *
 * @constructor
 */
Object.defineProperty(exports, "__esModule", {
  value: true
});
var grid = function grid() {};

grid.prototype.toString = function () {
  return "Gridline Plugin";
};

grid.prototype.activate = function (g) {
  return {
    willDrawChart: this.willDrawChart
  };
};

grid.prototype.willDrawChart = function (e) {
  // Draw the new X/Y grid. Lines appear crisper when pixels are rounded to
  // half-integers. This prevents them from drawing in two rows/cols.
  var g = e.dygraph;
  var ctx = e.drawingContext;
  var layout = g.layout_;
  var area = e.dygraph.plotter_.area;

  function halfUp(x) {
    return Math.round(x) + 0.5;
  }
  function halfDown(y) {
    return Math.round(y) - 0.5;
  }

  var x, y, i, ticks;
  if (g.getOptionForAxis('drawGrid', 'y')) {
    var axes = ["y", "y2"];
    var strokeStyles = [],
        lineWidths = [],
        drawGrid = [],
        stroking = [],
        strokePattern = [];
    for (var i = 0; i < axes.length; i++) {
      drawGrid[i] = g.getOptionForAxis('drawGrid', axes[i]);
      if (drawGrid[i]) {
        strokeStyles[i] = g.getOptionForAxis('gridLineColor', axes[i]);
        lineWidths[i] = g.getOptionForAxis('gridLineWidth', axes[i]);
        strokePattern[i] = g.getOptionForAxis('gridLinePattern', axes[i]);
        stroking[i] = strokePattern[i] && strokePattern[i].length >= 2;
      }
    }
    ticks = layout.yticks;
    ctx.save();
    // draw grids for the different y axes
    ticks.forEach(function (tick) {
      if (!tick.has_tick) return;
      var axis = tick.axis;
      if (drawGrid[axis]) {
        ctx.save();
        if (stroking[axis]) {
          if (ctx.setLineDash) ctx.setLineDash(strokePattern[axis]);
        }
        ctx.strokeStyle = strokeStyles[axis];
        ctx.lineWidth = lineWidths[axis];

        x = halfUp(area.x);
        y = halfDown(area.y + tick.pos * area.h);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + area.w, y);
        ctx.stroke();

        ctx.restore();
      }
    });
    ctx.restore();
  }

  // draw grid for x axis
  if (g.getOptionForAxis('drawGrid', 'x')) {
    ticks = layout.xticks;
    ctx.save();
    var strokePattern = g.getOptionForAxis('gridLinePattern', 'x');
    var stroking = strokePattern && strokePattern.length >= 2;
    if (stroking) {
      if (ctx.setLineDash) ctx.setLineDash(strokePattern);
    }
    ctx.strokeStyle = g.getOptionForAxis('gridLineColor', 'x');
    ctx.lineWidth = g.getOptionForAxis('gridLineWidth', 'x');
    ticks.forEach(function (tick) {
      if (!tick.has_tick) return;
      x = halfUp(area.x + tick.pos * area.w);
      y = halfDown(area.y + area.h);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, area.y);
      ctx.closePath();
      ctx.stroke();
    });
    if (stroking) {
      if (ctx.setLineDash) ctx.setLineDash([]);
    }
    ctx.restore();
  }
};

grid.prototype.destroy = function () {};

exports["default"] = grid;
module.exports = exports["default"];

},{}],147:[function(require,module,exports){
/**
 * @license
 * Copyright 2012 Dan Vanderkam (danvdk@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */
/*global Dygraph:false */

/*
Current bits of jankiness:
- Uses two private APIs:
    1. Dygraph.optionsViewForAxis_
    2. dygraph.plotter_.area
- Registers for a "predraw" event, which should be renamed.
- I call calculateEmWidthInDiv more often than needed.
*/

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _dygraphUtils = require('../dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

/**
 * Creates the legend, which appears when the user hovers over the chart.
 * The legend can be either a user-specified or generated div.
 *
 * @constructor
 */
var Legend = function Legend() {
  this.legend_div_ = null;
  this.is_generated_div_ = false; // do we own this div, or was it user-specified?
};

Legend.prototype.toString = function () {
  return "Legend Plugin";
};

/**
 * This is called during the dygraph constructor, after options have been set
 * but before the data is available.
 *
 * Proper tasks to do here include:
 * - Reading your own options
 * - DOM manipulation
 * - Registering event listeners
 *
 * @param {Dygraph} g Graph instance.
 * @return {object.<string, function(ev)>} Mapping of event names to callbacks.
 */
Legend.prototype.activate = function (g) {
  var div;

  var userLabelsDiv = g.getOption('labelsDiv');
  if (userLabelsDiv && null !== userLabelsDiv) {
    if (typeof userLabelsDiv == "string" || userLabelsDiv instanceof String) {
      div = document.getElementById(userLabelsDiv);
    } else {
      div = userLabelsDiv;
    }
  } else {
    div = document.createElement("div");
    div.className = "dygraph-legend";
    // TODO(danvk): come up with a cleaner way to expose this.
    g.graphDiv.appendChild(div);
    this.is_generated_div_ = true;
  }

  this.legend_div_ = div;
  this.one_em_width_ = 10; // just a guess, will be updated.

  return {
    select: this.select,
    deselect: this.deselect,
    // TODO(danvk): rethink the name "predraw" before we commit to it in any API.
    predraw: this.predraw,
    didDrawChart: this.didDrawChart
  };
};

// Needed for dashed lines.
var calculateEmWidthInDiv = function calculateEmWidthInDiv(div) {
  var sizeSpan = document.createElement('span');
  sizeSpan.setAttribute('style', 'margin: 0; padding: 0 0 0 1em; border: 0;');
  div.appendChild(sizeSpan);
  var oneEmWidth = sizeSpan.offsetWidth;
  div.removeChild(sizeSpan);
  return oneEmWidth;
};

var escapeHTML = function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

Legend.prototype.select = function (e) {
  var xValue = e.selectedX;
  var points = e.selectedPoints;
  var row = e.selectedRow;

  var legendMode = e.dygraph.getOption('legend');
  if (legendMode === 'never') {
    this.legend_div_.style.display = 'none';
    return;
  }

  if (legendMode === 'follow') {
    // create floating legend div
    var area = e.dygraph.plotter_.area;
    var labelsDivWidth = this.legend_div_.offsetWidth;
    var yAxisLabelWidth = e.dygraph.getOptionForAxis('axisLabelWidth', 'y');
    // determine floating [left, top] coordinates of the legend div
    // within the plotter_ area
    // offset 50 px to the right and down from the first selection point
    // 50 px is guess based on mouse cursor size
    var leftLegend = points[0].x * area.w + 50;
    var topLegend = points[0].y * area.h - 50;

    // if legend floats to end of the chart area, it flips to the other
    // side of the selection point
    if (leftLegend + labelsDivWidth + 1 > area.w) {
      leftLegend = leftLegend - 2 * 50 - labelsDivWidth - (yAxisLabelWidth - area.x);
    }

    e.dygraph.graphDiv.appendChild(this.legend_div_);
    this.legend_div_.style.left = yAxisLabelWidth + leftLegend + "px";
    this.legend_div_.style.top = topLegend + "px";
  }

  var html = Legend.generateLegendHTML(e.dygraph, xValue, points, this.one_em_width_, row);
  this.legend_div_.innerHTML = html;
  this.legend_div_.style.display = '';
};

Legend.prototype.deselect = function (e) {
  var legendMode = e.dygraph.getOption('legend');
  if (legendMode !== 'always') {
    this.legend_div_.style.display = "none";
  }

  // Have to do this every time, since styles might have changed.
  var oneEmWidth = calculateEmWidthInDiv(this.legend_div_);
  this.one_em_width_ = oneEmWidth;

  var html = Legend.generateLegendHTML(e.dygraph, undefined, undefined, oneEmWidth, null);
  this.legend_div_.innerHTML = html;
};

Legend.prototype.didDrawChart = function (e) {
  this.deselect(e);
};

// Right edge should be flush with the right edge of the charting area (which
// may not be the same as the right edge of the div, if we have two y-axes.
// TODO(danvk): is any of this really necessary? Could just set "right" in "activate".
/**
 * Position the labels div so that:
 * - its right edge is flush with the right edge of the charting area
 * - its top edge is flush with the top edge of the charting area
 * @private
 */
Legend.prototype.predraw = function (e) {
  // Don't touch a user-specified labelsDiv.
  if (!this.is_generated_div_) return;

  // TODO(danvk): only use real APIs for this.
  e.dygraph.graphDiv.appendChild(this.legend_div_);
  var area = e.dygraph.getArea();
  var labelsDivWidth = this.legend_div_.offsetWidth;
  this.legend_div_.style.left = area.x + area.w - labelsDivWidth - 1 + "px";
  this.legend_div_.style.top = area.y + "px";
};

/**
 * Called when dygraph.destroy() is called.
 * You should null out any references and detach any DOM elements.
 */
Legend.prototype.destroy = function () {
  this.legend_div_ = null;
};

/**
 * Generates HTML for the legend which is displayed when hovering over the
 * chart. If no selected points are specified, a default legend is returned
 * (this may just be the empty string).
 * @param {number} x The x-value of the selected points.
 * @param {Object} sel_points List of selected points for the given
 *   x-value. Should have properties like 'name', 'yval' and 'canvasy'.
 * @param {number} oneEmWidth The pixel width for 1em in the legend. Only
 *   relevant when displaying a legend with no selection (i.e. {legend:
 *   'always'}) and with dashed lines.
 * @param {number} row The selected row index.
 * @private
 */
Legend.generateLegendHTML = function (g, x, sel_points, oneEmWidth, row) {
  // Data about the selection to pass to legendFormatter
  var data = {
    dygraph: g,
    x: x,
    series: []
  };

  var labelToSeries = {};
  var labels = g.getLabels();
  if (labels) {
    for (var i = 1; i < labels.length; i++) {
      var series = g.getPropertiesForSeries(labels[i]);
      var strokePattern = g.getOption('strokePattern', labels[i]);
      var seriesData = {
        dashHTML: generateLegendDashHTML(strokePattern, series.color, oneEmWidth),
        label: labels[i],
        labelHTML: escapeHTML(labels[i]),
        isVisible: series.visible,
        color: series.color
      };

      data.series.push(seriesData);
      labelToSeries[labels[i]] = seriesData;
    }
  }

  if (typeof x !== 'undefined') {
    var xOptView = g.optionsViewForAxis_('x');
    var xvf = xOptView('valueFormatter');
    data.xHTML = xvf.call(g, x, xOptView, labels[0], g, row, 0);

    var yOptViews = [];
    var num_axes = g.numAxes();
    for (var i = 0; i < num_axes; i++) {
      // TODO(danvk): remove this use of a private API
      yOptViews[i] = g.optionsViewForAxis_('y' + (i ? 1 + i : ''));
    }

    var showZeros = g.getOption('labelsShowZeroValues');
    var highlightSeries = g.getHighlightSeries();
    for (i = 0; i < sel_points.length; i++) {
      var pt = sel_points[i];
      var seriesData = labelToSeries[pt.name];
      seriesData.y = pt.yval;

      if (pt.yval === 0 && !showZeros || isNaN(pt.canvasy)) {
        seriesData.isVisible = false;
        continue;
      }

      var series = g.getPropertiesForSeries(pt.name);
      var yOptView = yOptViews[series.axis - 1];
      var fmtFunc = yOptView('valueFormatter');
      var yHTML = fmtFunc.call(g, pt.yval, yOptView, pt.name, g, row, labels.indexOf(pt.name));

      utils.update(seriesData, { yHTML: yHTML });

      if (pt.name == highlightSeries) {
        seriesData.isHighlighted = true;
      }
    }
  }

  var formatter = g.getOption('legendFormatter') || Legend.defaultFormatter;
  return formatter.call(g, data);
};

Legend.defaultFormatter = function (data) {
  var g = data.dygraph;

  // TODO(danvk): deprecate this option in place of {legend: 'never'}
  // XXX should this logic be in the formatter?
  if (g.getOption('showLabelsOnHighlight') !== true) return '';

  var sepLines = g.getOption('labelsSeparateLines');
  var html;

  if (typeof data.x === 'undefined') {
    // TODO: this check is duplicated in generateLegendHTML. Put it in one place.
    if (g.getOption('legend') != 'always') {
      return '';
    }

    html = '';
    for (var i = 0; i < data.series.length; i++) {
      var series = data.series[i];
      if (!series.isVisible) continue;

      if (html !== '') html += sepLines ? '<br/>' : ' ';
      html += "<span style='font-weight: bold; color: " + series.color + ";'>" + series.dashHTML + " " + series.labelHTML + "</span>";
    }
    return html;
  }

  html = data.xHTML + ':';
  for (var i = 0; i < data.series.length; i++) {
    var series = data.series[i];
    if (!series.isVisible) continue;
    if (sepLines) html += '<br>';
    var cls = series.isHighlighted ? ' class="highlight"' : '';
    html += "<span" + cls + "> <b><span style='color: " + series.color + ";'>" + series.labelHTML + "</span></b>:&#160;" + series.yHTML + "</span>";
  }
  return html;
};

/**
 * Generates html for the "dash" displayed on the legend when using "legend: always".
 * In particular, this works for dashed lines with any stroke pattern. It will
 * try to scale the pattern to fit in 1em width. Or if small enough repeat the
 * pattern for 1em width.
 *
 * @param strokePattern The pattern
 * @param color The color of the series.
 * @param oneEmWidth The width in pixels of 1em in the legend.
 * @private
 */
// TODO(danvk): cache the results of this
function generateLegendDashHTML(strokePattern, color, oneEmWidth) {
  // Easy, common case: a solid line
  if (!strokePattern || strokePattern.length <= 1) {
    return "<div class=\"dygraph-legend-line\" style=\"border-bottom-color: " + color + ";\"></div>";
  }

  var i, j, paddingLeft, marginRight;
  var strokePixelLength = 0,
      segmentLoop = 0;
  var normalizedPattern = [];
  var loop;

  // Compute the length of the pixels including the first segment twice,
  // since we repeat it.
  for (i = 0; i <= strokePattern.length; i++) {
    strokePixelLength += strokePattern[i % strokePattern.length];
  }

  // See if we can loop the pattern by itself at least twice.
  loop = Math.floor(oneEmWidth / (strokePixelLength - strokePattern[0]));
  if (loop > 1) {
    // This pattern fits at least two times, no scaling just convert to em;
    for (i = 0; i < strokePattern.length; i++) {
      normalizedPattern[i] = strokePattern[i] / oneEmWidth;
    }
    // Since we are repeating the pattern, we don't worry about repeating the
    // first segment in one draw.
    segmentLoop = normalizedPattern.length;
  } else {
    // If the pattern doesn't fit in the legend we scale it to fit.
    loop = 1;
    for (i = 0; i < strokePattern.length; i++) {
      normalizedPattern[i] = strokePattern[i] / strokePixelLength;
    }
    // For the scaled patterns we do redraw the first segment.
    segmentLoop = normalizedPattern.length + 1;
  }

  // Now make the pattern.
  var dash = "";
  for (j = 0; j < loop; j++) {
    for (i = 0; i < segmentLoop; i += 2) {
      // The padding is the drawn segment.
      paddingLeft = normalizedPattern[i % normalizedPattern.length];
      if (i < strokePattern.length) {
        // The margin is the space segment.
        marginRight = normalizedPattern[(i + 1) % normalizedPattern.length];
      } else {
        // The repeated first segment has no right margin.
        marginRight = 0;
      }
      dash += "<div class=\"dygraph-legend-dash\" style=\"margin-right: " + marginRight + "em; padding-left: " + paddingLeft + "em;\"></div>";
    }
  }
  return dash;
};

exports["default"] = Legend;
module.exports = exports["default"];

},{"../dygraph-utils":138}],148:[function(require,module,exports){
/**
 * @license
 * Copyright 2011 Paul Felix (paul.eric.felix@gmail.com)
 * MIT-licensed (http://opensource.org/licenses/MIT)
 */
/*global Dygraph:false,TouchEvent:false */

/**
 * @fileoverview This file contains the RangeSelector plugin used to provide
 * a timeline range selector widget for dygraphs.
 */

/*global Dygraph:false */
"use strict";

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _dygraphUtils = require('../dygraph-utils');

var utils = _interopRequireWildcard(_dygraphUtils);

var _dygraphInteractionModel = require('../dygraph-interaction-model');

var _dygraphInteractionModel2 = _interopRequireDefault(_dygraphInteractionModel);

var _iframeTarp = require('../iframe-tarp');

var _iframeTarp2 = _interopRequireDefault(_iframeTarp);

var rangeSelector = function rangeSelector() {
  this.hasTouchInterface_ = typeof TouchEvent != 'undefined';
  this.isMobileDevice_ = /mobile|android/gi.test(navigator.appVersion);
  this.interfaceCreated_ = false;
};

rangeSelector.prototype.toString = function () {
  return "RangeSelector Plugin";
};

rangeSelector.prototype.activate = function (dygraph) {
  this.dygraph_ = dygraph;
  if (this.getOption_('showRangeSelector')) {
    this.createInterface_();
  }
  return {
    layout: this.reserveSpace_,
    predraw: this.renderStaticLayer_,
    didDrawChart: this.renderInteractiveLayer_
  };
};

rangeSelector.prototype.destroy = function () {
  this.bgcanvas_ = null;
  this.fgcanvas_ = null;
  this.leftZoomHandle_ = null;
  this.rightZoomHandle_ = null;
};

//------------------------------------------------------------------
// Private methods
//------------------------------------------------------------------

rangeSelector.prototype.getOption_ = function (name, opt_series) {
  return this.dygraph_.getOption(name, opt_series);
};

rangeSelector.prototype.setDefaultOption_ = function (name, value) {
  this.dygraph_.attrs_[name] = value;
};

/**
 * @private
 * Creates the range selector elements and adds them to the graph.
 */
rangeSelector.prototype.createInterface_ = function () {
  this.createCanvases_();
  this.createZoomHandles_();
  this.initInteraction_();

  // Range selector and animatedZooms have a bad interaction. See issue 359.
  if (this.getOption_('animatedZooms')) {
    console.warn('Animated zooms and range selector are not compatible; disabling animatedZooms.');
    this.dygraph_.updateOptions({ animatedZooms: false }, true);
  }

  this.interfaceCreated_ = true;
  this.addToGraph_();
};

/**
 * @private
 * Adds the range selector to the graph.
 */
rangeSelector.prototype.addToGraph_ = function () {
  var graphDiv = this.graphDiv_ = this.dygraph_.graphDiv;
  graphDiv.appendChild(this.bgcanvas_);
  graphDiv.appendChild(this.fgcanvas_);
  graphDiv.appendChild(this.leftZoomHandle_);
  graphDiv.appendChild(this.rightZoomHandle_);
};

/**
 * @private
 * Removes the range selector from the graph.
 */
rangeSelector.prototype.removeFromGraph_ = function () {
  var graphDiv = this.graphDiv_;
  graphDiv.removeChild(this.bgcanvas_);
  graphDiv.removeChild(this.fgcanvas_);
  graphDiv.removeChild(this.leftZoomHandle_);
  graphDiv.removeChild(this.rightZoomHandle_);
  this.graphDiv_ = null;
};

/**
 * @private
 * Called by Layout to allow range selector to reserve its space.
 */
rangeSelector.prototype.reserveSpace_ = function (e) {
  if (this.getOption_('showRangeSelector')) {
    e.reserveSpaceBottom(this.getOption_('rangeSelectorHeight') + 4);
  }
};

/**
 * @private
 * Renders the static portion of the range selector at the predraw stage.
 */
rangeSelector.prototype.renderStaticLayer_ = function () {
  if (!this.updateVisibility_()) {
    return;
  }
  this.resize_();
  this.drawStaticLayer_();
};

/**
 * @private
 * Renders the interactive portion of the range selector after the chart has been drawn.
 */
rangeSelector.prototype.renderInteractiveLayer_ = function () {
  if (!this.updateVisibility_() || this.isChangingRange_) {
    return;
  }
  this.placeZoomHandles_();
  this.drawInteractiveLayer_();
};

/**
 * @private
 * Check to see if the range selector is enabled/disabled and update visibility accordingly.
 */
rangeSelector.prototype.updateVisibility_ = function () {
  var enabled = this.getOption_('showRangeSelector');
  if (enabled) {
    if (!this.interfaceCreated_) {
      this.createInterface_();
    } else if (!this.graphDiv_ || !this.graphDiv_.parentNode) {
      this.addToGraph_();
    }
  } else if (this.graphDiv_) {
    this.removeFromGraph_();
    var dygraph = this.dygraph_;
    setTimeout(function () {
      dygraph.width_ = 0;dygraph.resize();
    }, 1);
  }
  return enabled;
};

/**
 * @private
 * Resizes the range selector.
 */
rangeSelector.prototype.resize_ = function () {
  function setElementRect(canvas, context, rect) {
    var canvasScale = utils.getContextPixelRatio(context);

    canvas.style.top = rect.y + 'px';
    canvas.style.left = rect.x + 'px';
    canvas.width = rect.w * canvasScale;
    canvas.height = rect.h * canvasScale;
    canvas.style.width = rect.w + 'px';
    canvas.style.height = rect.h + 'px';

    if (canvasScale != 1) {
      context.scale(canvasScale, canvasScale);
    }
  }

  var plotArea = this.dygraph_.layout_.getPlotArea();

  var xAxisLabelHeight = 0;
  if (this.dygraph_.getOptionForAxis('drawAxis', 'x')) {
    xAxisLabelHeight = this.getOption_('xAxisHeight') || this.getOption_('axisLabelFontSize') + 2 * this.getOption_('axisTickSize');
  }
  this.canvasRect_ = {
    x: plotArea.x,
    y: plotArea.y + plotArea.h + xAxisLabelHeight + 4,
    w: plotArea.w,
    h: this.getOption_('rangeSelectorHeight')
  };

  setElementRect(this.bgcanvas_, this.bgcanvas_ctx_, this.canvasRect_);
  setElementRect(this.fgcanvas_, this.fgcanvas_ctx_, this.canvasRect_);
};

/**
 * @private
 * Creates the background and foreground canvases.
 */
rangeSelector.prototype.createCanvases_ = function () {
  this.bgcanvas_ = utils.createCanvas();
  this.bgcanvas_.className = 'dygraph-rangesel-bgcanvas';
  this.bgcanvas_.style.position = 'absolute';
  this.bgcanvas_.style.zIndex = 9;
  this.bgcanvas_ctx_ = utils.getContext(this.bgcanvas_);

  this.fgcanvas_ = utils.createCanvas();
  this.fgcanvas_.className = 'dygraph-rangesel-fgcanvas';
  this.fgcanvas_.style.position = 'absolute';
  this.fgcanvas_.style.zIndex = 9;
  this.fgcanvas_.style.cursor = 'default';
  this.fgcanvas_ctx_ = utils.getContext(this.fgcanvas_);
};

/**
 * @private
 * Creates the zoom handle elements.
 */
rangeSelector.prototype.createZoomHandles_ = function () {
  var img = new Image();
  img.className = 'dygraph-rangesel-zoomhandle';
  img.style.position = 'absolute';
  img.style.zIndex = 10;
  img.style.visibility = 'hidden'; // Initially hidden so they don't show up in the wrong place.
  img.style.cursor = 'col-resize';
  // TODO: change image to more options
  img.width = 9;
  img.height = 16;
  img.src = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAkAAAAQCAYAAADESFVDAAAAAXNSR0IArs4c6QAAAAZiS0dEANAA' + 'zwDP4Z7KegAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAAd0SU1FB9sHGw0cMqdt1UwAAAAZdEVYdENv' + 'bW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAaElEQVQoz+3SsRFAQBCF4Z9WJM8KCDVwownl' + '6YXsTmCUsyKGkZzcl7zkz3YLkypgAnreFmDEpHkIwVOMfpdi9CEEN2nGpFdwD03yEqDtOgCaun7s' + 'qSTDH32I1pQA2Pb9sZecAxc5r3IAb21d6878xsAAAAAASUVORK5CYII=';

  if (this.isMobileDevice_) {
    img.width *= 2;
    img.height *= 2;
  }

  this.leftZoomHandle_ = img;
  this.rightZoomHandle_ = img.cloneNode(false);
};

/**
 * @private
 * Sets up the interaction for the range selector.
 */
rangeSelector.prototype.initInteraction_ = function () {
  var self = this;
  var topElem = document;
  var clientXLast = 0;
  var handle = null;
  var isZooming = false;
  var isPanning = false;
  var dynamic = !this.isMobileDevice_;

  // We cover iframes during mouse interactions. See comments in
  // dygraph-utils.js for more info on why this is a good idea.
  var tarp = new _iframeTarp2['default']();

  // functions, defined below.  Defining them this way (rather than with
  // "function foo() {...}" makes JSHint happy.
  var toXDataWindow, onZoomStart, onZoom, onZoomEnd, doZoom, isMouseInPanZone, onPanStart, onPan, onPanEnd, doPan, onCanvasHover;

  // Touch event functions
  var onZoomHandleTouchEvent, onCanvasTouchEvent, addTouchEvents;

  toXDataWindow = function (zoomHandleStatus) {
    var xDataLimits = self.dygraph_.xAxisExtremes();
    var fact = (xDataLimits[1] - xDataLimits[0]) / self.canvasRect_.w;
    var xDataMin = xDataLimits[0] + (zoomHandleStatus.leftHandlePos - self.canvasRect_.x) * fact;
    var xDataMax = xDataLimits[0] + (zoomHandleStatus.rightHandlePos - self.canvasRect_.x) * fact;
    return [xDataMin, xDataMax];
  };

  onZoomStart = function (e) {
    utils.cancelEvent(e);
    isZooming = true;
    clientXLast = e.clientX;
    handle = e.target ? e.target : e.srcElement;
    if (e.type === 'mousedown' || e.type === 'dragstart') {
      // These events are removed manually.
      utils.addEvent(topElem, 'mousemove', onZoom);
      utils.addEvent(topElem, 'mouseup', onZoomEnd);
    }
    self.fgcanvas_.style.cursor = 'col-resize';
    tarp.cover();
    return true;
  };

  onZoom = function (e) {
    if (!isZooming) {
      return false;
    }
    utils.cancelEvent(e);

    var delX = e.clientX - clientXLast;
    if (Math.abs(delX) < 4) {
      return true;
    }
    clientXLast = e.clientX;

    // Move handle.
    var zoomHandleStatus = self.getZoomHandleStatus_();
    var newPos;
    if (handle == self.leftZoomHandle_) {
      newPos = zoomHandleStatus.leftHandlePos + delX;
      newPos = Math.min(newPos, zoomHandleStatus.rightHandlePos - handle.width - 3);
      newPos = Math.max(newPos, self.canvasRect_.x);
    } else {
      newPos = zoomHandleStatus.rightHandlePos + delX;
      newPos = Math.min(newPos, self.canvasRect_.x + self.canvasRect_.w);
      newPos = Math.max(newPos, zoomHandleStatus.leftHandlePos + handle.width + 3);
    }
    var halfHandleWidth = handle.width / 2;
    handle.style.left = newPos - halfHandleWidth + 'px';
    self.drawInteractiveLayer_();

    // Zoom on the fly.
    if (dynamic) {
      doZoom();
    }
    return true;
  };

  onZoomEnd = function (e) {
    if (!isZooming) {
      return false;
    }
    isZooming = false;
    tarp.uncover();
    utils.removeEvent(topElem, 'mousemove', onZoom);
    utils.removeEvent(topElem, 'mouseup', onZoomEnd);
    self.fgcanvas_.style.cursor = 'default';

    // If on a slower device, zoom now.
    if (!dynamic) {
      doZoom();
    }
    return true;
  };

  doZoom = function () {
    try {
      var zoomHandleStatus = self.getZoomHandleStatus_();
      self.isChangingRange_ = true;
      if (!zoomHandleStatus.isZoomed) {
        self.dygraph_.resetZoom();
      } else {
        var xDataWindow = toXDataWindow(zoomHandleStatus);
        self.dygraph_.doZoomXDates_(xDataWindow[0], xDataWindow[1]);
      }
    } finally {
      self.isChangingRange_ = false;
    }
  };

  isMouseInPanZone = function (e) {
    var rect = self.leftZoomHandle_.getBoundingClientRect();
    var leftHandleClientX = rect.left + rect.width / 2;
    rect = self.rightZoomHandle_.getBoundingClientRect();
    var rightHandleClientX = rect.left + rect.width / 2;
    return e.clientX > leftHandleClientX && e.clientX < rightHandleClientX;
  };

  onPanStart = function (e) {
    if (!isPanning && isMouseInPanZone(e) && self.getZoomHandleStatus_().isZoomed) {
      utils.cancelEvent(e);
      isPanning = true;
      clientXLast = e.clientX;
      if (e.type === 'mousedown') {
        // These events are removed manually.
        utils.addEvent(topElem, 'mousemove', onPan);
        utils.addEvent(topElem, 'mouseup', onPanEnd);
      }
      return true;
    }
    return false;
  };

  onPan = function (e) {
    if (!isPanning) {
      return false;
    }
    utils.cancelEvent(e);

    var delX = e.clientX - clientXLast;
    if (Math.abs(delX) < 4) {
      return true;
    }
    clientXLast = e.clientX;

    // Move range view
    var zoomHandleStatus = self.getZoomHandleStatus_();
    var leftHandlePos = zoomHandleStatus.leftHandlePos;
    var rightHandlePos = zoomHandleStatus.rightHandlePos;
    var rangeSize = rightHandlePos - leftHandlePos;
    if (leftHandlePos + delX <= self.canvasRect_.x) {
      leftHandlePos = self.canvasRect_.x;
      rightHandlePos = leftHandlePos + rangeSize;
    } else if (rightHandlePos + delX >= self.canvasRect_.x + self.canvasRect_.w) {
      rightHandlePos = self.canvasRect_.x + self.canvasRect_.w;
      leftHandlePos = rightHandlePos - rangeSize;
    } else {
      leftHandlePos += delX;
      rightHandlePos += delX;
    }
    var halfHandleWidth = self.leftZoomHandle_.width / 2;
    self.leftZoomHandle_.style.left = leftHandlePos - halfHandleWidth + 'px';
    self.rightZoomHandle_.style.left = rightHandlePos - halfHandleWidth + 'px';
    self.drawInteractiveLayer_();

    // Do pan on the fly.
    if (dynamic) {
      doPan();
    }
    return true;
  };

  onPanEnd = function (e) {
    if (!isPanning) {
      return false;
    }
    isPanning = false;
    utils.removeEvent(topElem, 'mousemove', onPan);
    utils.removeEvent(topElem, 'mouseup', onPanEnd);
    // If on a slower device, do pan now.
    if (!dynamic) {
      doPan();
    }
    return true;
  };

  doPan = function () {
    try {
      self.isChangingRange_ = true;
      self.dygraph_.dateWindow_ = toXDataWindow(self.getZoomHandleStatus_());
      self.dygraph_.drawGraph_(false);
    } finally {
      self.isChangingRange_ = false;
    }
  };

  onCanvasHover = function (e) {
    if (isZooming || isPanning) {
      return;
    }
    var cursor = isMouseInPanZone(e) ? 'move' : 'default';
    if (cursor != self.fgcanvas_.style.cursor) {
      self.fgcanvas_.style.cursor = cursor;
    }
  };

  onZoomHandleTouchEvent = function (e) {
    if (e.type == 'touchstart' && e.targetTouches.length == 1) {
      if (onZoomStart(e.targetTouches[0])) {
        utils.cancelEvent(e);
      }
    } else if (e.type == 'touchmove' && e.targetTouches.length == 1) {
      if (onZoom(e.targetTouches[0])) {
        utils.cancelEvent(e);
      }
    } else {
      onZoomEnd(e);
    }
  };

  onCanvasTouchEvent = function (e) {
    if (e.type == 'touchstart' && e.targetTouches.length == 1) {
      if (onPanStart(e.targetTouches[0])) {
        utils.cancelEvent(e);
      }
    } else if (e.type == 'touchmove' && e.targetTouches.length == 1) {
      if (onPan(e.targetTouches[0])) {
        utils.cancelEvent(e);
      }
    } else {
      onPanEnd(e);
    }
  };

  addTouchEvents = function (elem, fn) {
    var types = ['touchstart', 'touchend', 'touchmove', 'touchcancel'];
    for (var i = 0; i < types.length; i++) {
      self.dygraph_.addAndTrackEvent(elem, types[i], fn);
    }
  };

  this.setDefaultOption_('interactionModel', _dygraphInteractionModel2['default'].dragIsPanInteractionModel);
  this.setDefaultOption_('panEdgeFraction', 0.0001);

  var dragStartEvent = window.opera ? 'mousedown' : 'dragstart';
  this.dygraph_.addAndTrackEvent(this.leftZoomHandle_, dragStartEvent, onZoomStart);
  this.dygraph_.addAndTrackEvent(this.rightZoomHandle_, dragStartEvent, onZoomStart);

  this.dygraph_.addAndTrackEvent(this.fgcanvas_, 'mousedown', onPanStart);
  this.dygraph_.addAndTrackEvent(this.fgcanvas_, 'mousemove', onCanvasHover);

  // Touch events
  if (this.hasTouchInterface_) {
    addTouchEvents(this.leftZoomHandle_, onZoomHandleTouchEvent);
    addTouchEvents(this.rightZoomHandle_, onZoomHandleTouchEvent);
    addTouchEvents(this.fgcanvas_, onCanvasTouchEvent);
  }
};

/**
 * @private
 * Draws the static layer in the background canvas.
 */
rangeSelector.prototype.drawStaticLayer_ = function () {
  var ctx = this.bgcanvas_ctx_;
  ctx.clearRect(0, 0, this.canvasRect_.w, this.canvasRect_.h);
  try {
    this.drawMiniPlot_();
  } catch (ex) {
    console.warn(ex);
  }

  var margin = 0.5;
  this.bgcanvas_ctx_.lineWidth = this.getOption_('rangeSelectorBackgroundLineWidth');
  ctx.strokeStyle = this.getOption_('rangeSelectorBackgroundStrokeColor');
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, this.canvasRect_.h - margin);
  ctx.lineTo(this.canvasRect_.w - margin, this.canvasRect_.h - margin);
  ctx.lineTo(this.canvasRect_.w - margin, margin);
  ctx.stroke();
};

/**
 * @private
 * Draws the mini plot in the background canvas.
 */
rangeSelector.prototype.drawMiniPlot_ = function () {
  var fillStyle = this.getOption_('rangeSelectorPlotFillColor');
  var fillGradientStyle = this.getOption_('rangeSelectorPlotFillGradientColor');
  var strokeStyle = this.getOption_('rangeSelectorPlotStrokeColor');
  if (!fillStyle && !strokeStyle) {
    return;
  }

  var stepPlot = this.getOption_('stepPlot');

  var combinedSeriesData = this.computeCombinedSeriesAndLimits_();
  var yRange = combinedSeriesData.yMax - combinedSeriesData.yMin;

  // Draw the mini plot.
  var ctx = this.bgcanvas_ctx_;
  var margin = 0.5;

  var xExtremes = this.dygraph_.xAxisExtremes();
  var xRange = Math.max(xExtremes[1] - xExtremes[0], 1.e-30);
  var xFact = (this.canvasRect_.w - margin) / xRange;
  var yFact = (this.canvasRect_.h - margin) / yRange;
  var canvasWidth = this.canvasRect_.w - margin;
  var canvasHeight = this.canvasRect_.h - margin;

  var prevX = null,
      prevY = null;

  ctx.beginPath();
  ctx.moveTo(margin, canvasHeight);
  for (var i = 0; i < combinedSeriesData.data.length; i++) {
    var dataPoint = combinedSeriesData.data[i];
    var x = dataPoint[0] !== null ? (dataPoint[0] - xExtremes[0]) * xFact : NaN;
    var y = dataPoint[1] !== null ? canvasHeight - (dataPoint[1] - combinedSeriesData.yMin) * yFact : NaN;

    // Skip points that don't change the x-value. Overly fine-grained points
    // can cause major slowdowns with the ctx.fill() call below.
    if (!stepPlot && prevX !== null && Math.round(x) == Math.round(prevX)) {
      continue;
    }

    if (isFinite(x) && isFinite(y)) {
      if (prevX === null) {
        ctx.lineTo(x, canvasHeight);
      } else if (stepPlot) {
        ctx.lineTo(x, prevY);
      }
      ctx.lineTo(x, y);
      prevX = x;
      prevY = y;
    } else {
      if (prevX !== null) {
        if (stepPlot) {
          ctx.lineTo(x, prevY);
          ctx.lineTo(x, canvasHeight);
        } else {
          ctx.lineTo(prevX, canvasHeight);
        }
      }
      prevX = prevY = null;
    }
  }
  ctx.lineTo(canvasWidth, canvasHeight);
  ctx.closePath();

  if (fillStyle) {
    var lingrad = this.bgcanvas_ctx_.createLinearGradient(0, 0, 0, canvasHeight);
    if (fillGradientStyle) {
      lingrad.addColorStop(0, fillGradientStyle);
    }
    lingrad.addColorStop(1, fillStyle);
    this.bgcanvas_ctx_.fillStyle = lingrad;
    ctx.fill();
  }

  if (strokeStyle) {
    this.bgcanvas_ctx_.strokeStyle = strokeStyle;
    this.bgcanvas_ctx_.lineWidth = this.getOption_('rangeSelectorPlotLineWidth');
    ctx.stroke();
  }
};

/**
 * @private
 * Computes and returns the combined series data along with min/max for the mini plot.
 * The combined series consists of averaged values for all series.
 * When series have error bars, the error bars are ignored.
 * @return {Object} An object containing combined series array, ymin, ymax.
 */
rangeSelector.prototype.computeCombinedSeriesAndLimits_ = function () {
  var g = this.dygraph_;
  var logscale = this.getOption_('logscale');
  var i;

  // Select series to combine. By default, all series are combined.
  var numColumns = g.numColumns();
  var labels = g.getLabels();
  var includeSeries = new Array(numColumns);
  var anySet = false;
  var visibility = g.visibility();
  var inclusion = [];

  for (i = 1; i < numColumns; i++) {
    var include = this.getOption_('showInRangeSelector', labels[i]);
    inclusion.push(include);
    if (include !== null) anySet = true; // it's set explicitly for this series
  }

  if (anySet) {
    for (i = 1; i < numColumns; i++) {
      includeSeries[i] = inclusion[i - 1];
    }
  } else {
    for (i = 1; i < numColumns; i++) {
      includeSeries[i] = visibility[i - 1];
    }
  }

  // Create a combined series (average of selected series values).
  // TODO(danvk): short-circuit if there's only one series.
  var rolledSeries = [];
  var dataHandler = g.dataHandler_;
  var options = g.attributes_;
  for (i = 1; i < g.numColumns(); i++) {
    if (!includeSeries[i]) continue;
    var series = dataHandler.extractSeries(g.rawData_, i, options);
    if (g.rollPeriod() > 1) {
      series = dataHandler.rollingAverage(series, g.rollPeriod(), options);
    }

    rolledSeries.push(series);
  }

  var combinedSeries = [];
  for (i = 0; i < rolledSeries[0].length; i++) {
    var sum = 0;
    var count = 0;
    for (var j = 0; j < rolledSeries.length; j++) {
      var y = rolledSeries[j][i][1];
      if (y === null || isNaN(y)) continue;
      count++;
      sum += y;
    }
    combinedSeries.push([rolledSeries[0][i][0], sum / count]);
  }

  // Compute the y range.
  var yMin = Number.MAX_VALUE;
  var yMax = -Number.MAX_VALUE;
  for (i = 0; i < combinedSeries.length; i++) {
    var yVal = combinedSeries[i][1];
    if (yVal !== null && isFinite(yVal) && (!logscale || yVal > 0)) {
      yMin = Math.min(yMin, yVal);
      yMax = Math.max(yMax, yVal);
    }
  }

  // Convert Y data to log scale if needed.
  // Also, expand the Y range to compress the mini plot a little.
  var extraPercent = 0.25;
  if (logscale) {
    yMax = utils.log10(yMax);
    yMax += yMax * extraPercent;
    yMin = utils.log10(yMin);
    for (i = 0; i < combinedSeries.length; i++) {
      combinedSeries[i][1] = utils.log10(combinedSeries[i][1]);
    }
  } else {
    var yExtra;
    var yRange = yMax - yMin;
    if (yRange <= Number.MIN_VALUE) {
      yExtra = yMax * extraPercent;
    } else {
      yExtra = yRange * extraPercent;
    }
    yMax += yExtra;
    yMin -= yExtra;
  }

  return { data: combinedSeries, yMin: yMin, yMax: yMax };
};

/**
 * @private
 * Places the zoom handles in the proper position based on the current X data window.
 */
rangeSelector.prototype.placeZoomHandles_ = function () {
  var xExtremes = this.dygraph_.xAxisExtremes();
  var xWindowLimits = this.dygraph_.xAxisRange();
  var xRange = xExtremes[1] - xExtremes[0];
  var leftPercent = Math.max(0, (xWindowLimits[0] - xExtremes[0]) / xRange);
  var rightPercent = Math.max(0, (xExtremes[1] - xWindowLimits[1]) / xRange);
  var leftCoord = this.canvasRect_.x + this.canvasRect_.w * leftPercent;
  var rightCoord = this.canvasRect_.x + this.canvasRect_.w * (1 - rightPercent);
  var handleTop = Math.max(this.canvasRect_.y, this.canvasRect_.y + (this.canvasRect_.h - this.leftZoomHandle_.height) / 2);
  var halfHandleWidth = this.leftZoomHandle_.width / 2;
  this.leftZoomHandle_.style.left = leftCoord - halfHandleWidth + 'px';
  this.leftZoomHandle_.style.top = handleTop + 'px';
  this.rightZoomHandle_.style.left = rightCoord - halfHandleWidth + 'px';
  this.rightZoomHandle_.style.top = this.leftZoomHandle_.style.top;

  this.leftZoomHandle_.style.visibility = 'visible';
  this.rightZoomHandle_.style.visibility = 'visible';
};

/**
 * @private
 * Draws the interactive layer in the foreground canvas.
 */
rangeSelector.prototype.drawInteractiveLayer_ = function () {
  var ctx = this.fgcanvas_ctx_;
  ctx.clearRect(0, 0, this.canvasRect_.w, this.canvasRect_.h);
  var margin = 1;
  var width = this.canvasRect_.w - margin;
  var height = this.canvasRect_.h - margin;
  var zoomHandleStatus = this.getZoomHandleStatus_();

  ctx.strokeStyle = this.getOption_('rangeSelectorForegroundStrokeColor');
  ctx.lineWidth = this.getOption_('rangeSelectorForegroundLineWidth');
  if (!zoomHandleStatus.isZoomed) {
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height);
    ctx.lineTo(width, height);
    ctx.lineTo(width, margin);
    ctx.stroke();
  } else {
    var leftHandleCanvasPos = Math.max(margin, zoomHandleStatus.leftHandlePos - this.canvasRect_.x);
    var rightHandleCanvasPos = Math.min(width, zoomHandleStatus.rightHandlePos - this.canvasRect_.x);

    ctx.fillStyle = 'rgba(240, 240, 240, ' + this.getOption_('rangeSelectorAlpha').toString() + ')';
    ctx.fillRect(0, 0, leftHandleCanvasPos, this.canvasRect_.h);
    ctx.fillRect(rightHandleCanvasPos, 0, this.canvasRect_.w - rightHandleCanvasPos, this.canvasRect_.h);

    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(leftHandleCanvasPos, margin);
    ctx.lineTo(leftHandleCanvasPos, height);
    ctx.lineTo(rightHandleCanvasPos, height);
    ctx.lineTo(rightHandleCanvasPos, margin);
    ctx.lineTo(width, margin);
    ctx.stroke();
  }
};

/**
 * @private
 * Returns the current zoom handle position information.
 * @return {Object} The zoom handle status.
 */
rangeSelector.prototype.getZoomHandleStatus_ = function () {
  var halfHandleWidth = this.leftZoomHandle_.width / 2;
  var leftHandlePos = parseFloat(this.leftZoomHandle_.style.left) + halfHandleWidth;
  var rightHandlePos = parseFloat(this.rightZoomHandle_.style.left) + halfHandleWidth;
  return {
    leftHandlePos: leftHandlePos,
    rightHandlePos: rightHandlePos,
    isZoomed: leftHandlePos - 1 > this.canvasRect_.x || rightHandlePos + 1 < this.canvasRect_.x + this.canvasRect_.w
  };
};

exports['default'] = rangeSelector;
module.exports = exports['default'];

},{"../dygraph-interaction-model":133,"../dygraph-utils":138,"../iframe-tarp":142}]},{},[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57])