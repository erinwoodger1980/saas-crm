"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var chunk_XKZ6CBLA_exports = {};
__export(chunk_XKZ6CBLA_exports, {
  N: () => N,
  z: () => z
});
module.exports = __toCommonJS(chunk_XKZ6CBLA_exports);
var t = Symbol.for("@ts-pattern/matcher");
var e = Symbol.for("@ts-pattern/isVariadic");
var n = "@ts-pattern/anonymous-select-key";
var r = (t2) => Boolean(t2 && "object" == typeof t2);
var i = (e2) => e2 && !!e2[t];
var s = (n2, o2, c2) => {
  if (i(n2)) {
    const e2 = n2[t](), { matched: r2, selections: i2 } = e2.match(o2);
    return r2 && i2 && Object.keys(i2).forEach((t2) => c2(t2, i2[t2])), r2;
  }
  if (r(n2)) {
    if (!r(o2)) return false;
    if (Array.isArray(n2)) {
      if (!Array.isArray(o2)) return false;
      let t2 = [], r2 = [], a2 = [];
      for (const s2 of n2.keys()) {
        const o3 = n2[s2];
        i(o3) && o3[e] ? a2.push(o3) : a2.length ? r2.push(o3) : t2.push(o3);
      }
      if (a2.length) {
        if (a2.length > 1) throw new Error("Pattern error: Using `...P.array(...)` several times in a single pattern is not allowed.");
        if (o2.length < t2.length + r2.length) return false;
        const e2 = o2.slice(0, t2.length), n3 = 0 === r2.length ? [] : o2.slice(-r2.length), i2 = o2.slice(t2.length, 0 === r2.length ? Infinity : -r2.length);
        return t2.every((t3, n4) => s(t3, e2[n4], c2)) && r2.every((t3, e3) => s(t3, n3[e3], c2)) && (0 === a2.length || s(a2[0], i2, c2));
      }
      return n2.length === o2.length && n2.every((t3, e2) => s(t3, o2[e2], c2));
    }
    return Reflect.ownKeys(n2).every((e2) => {
      const r2 = n2[e2];
      return (e2 in o2 || i(a2 = r2) && "optional" === a2[t]().matcherType) && s(r2, o2[e2], c2);
      var a2;
    });
  }
  return Object.is(o2, n2);
};
var o = (e2) => {
  var n2, s2, a2;
  return r(e2) ? i(e2) ? null != (n2 = null == (s2 = (a2 = e2[t]()).getSelectionKeys) ? void 0 : s2.call(a2)) ? n2 : [] : Array.isArray(e2) ? c(e2, o) : c(Object.values(e2), o) : [];
};
var c = (t2, e2) => t2.reduce((t3, n2) => t3.concat(e2(n2)), []);
function a(...t2) {
  if (1 === t2.length) {
    const [e2] = t2;
    return (t3) => s(e2, t3, () => {
    });
  }
  if (2 === t2.length) {
    const [e2, n2] = t2;
    return s(e2, n2, () => {
    });
  }
  throw new Error(`isMatching wasn't given the right number of arguments: expected 1 or 2, received ${t2.length}.`);
}
function u(t2) {
  return Object.assign(t2, { optional: () => h(t2), and: (e2) => m(t2, e2), or: (e2) => d(t2, e2), select: (e2) => void 0 === e2 ? y(t2) : y(e2, t2) });
}
function l(t2) {
  return Object.assign(((t3) => Object.assign(t3, { [Symbol.iterator]() {
    let n2 = 0;
    const r2 = [{ value: Object.assign(t3, { [e]: true }), done: false }, { done: true, value: void 0 }];
    return { next: () => {
      var t4;
      return null != (t4 = r2[n2++]) ? t4 : r2.at(-1);
    } };
  } }))(t2), { optional: () => l(h(t2)), select: (e2) => l(void 0 === e2 ? y(t2) : y(e2, t2)) });
}
function h(e2) {
  return u({ [t]: () => ({ match: (t2) => {
    let n2 = {};
    const r2 = (t3, e3) => {
      n2[t3] = e3;
    };
    return void 0 === t2 ? (o(e2).forEach((t3) => r2(t3, void 0)), { matched: true, selections: n2 }) : { matched: s(e2, t2, r2), selections: n2 };
  }, getSelectionKeys: () => o(e2), matcherType: "optional" }) });
}
var f = (t2, e2) => {
  for (const n2 of t2) if (!e2(n2)) return false;
  return true;
};
var g = (t2, e2) => {
  for (const [n2, r2] of t2.entries()) if (!e2(r2, n2)) return false;
  return true;
};
function m(...e2) {
  return u({ [t]: () => ({ match: (t2) => {
    let n2 = {};
    const r2 = (t3, e3) => {
      n2[t3] = e3;
    };
    return { matched: e2.every((e3) => s(e3, t2, r2)), selections: n2 };
  }, getSelectionKeys: () => c(e2, o), matcherType: "and" }) });
}
function d(...e2) {
  return u({ [t]: () => ({ match: (t2) => {
    let n2 = {};
    const r2 = (t3, e3) => {
      n2[t3] = e3;
    };
    return c(e2, o).forEach((t3) => r2(t3, void 0)), { matched: e2.some((e3) => s(e3, t2, r2)), selections: n2 };
  }, getSelectionKeys: () => c(e2, o), matcherType: "or" }) });
}
function p(e2) {
  return { [t]: () => ({ match: (t2) => ({ matched: Boolean(e2(t2)) }) }) };
}
function y(...e2) {
  const r2 = "string" == typeof e2[0] ? e2[0] : void 0, i2 = 2 === e2.length ? e2[1] : "string" == typeof e2[0] ? void 0 : e2[0];
  return u({ [t]: () => ({ match: (t2) => {
    let e3 = { [null != r2 ? r2 : n]: t2 };
    return { matched: void 0 === i2 || s(i2, t2, (t3, n2) => {
      e3[t3] = n2;
    }), selections: e3 };
  }, getSelectionKeys: () => [null != r2 ? r2 : n].concat(void 0 === i2 ? [] : o(i2)) }) });
}
function v(t2) {
  return "number" == typeof t2;
}
function b(t2) {
  return "string" == typeof t2;
}
function w(t2) {
  return "bigint" == typeof t2;
}
var S = u(p(function(t2) {
  return true;
}));
var O = S;
var j = (t2) => Object.assign(u(t2), { startsWith: (e2) => {
  return j(m(t2, (n2 = e2, p((t3) => b(t3) && t3.startsWith(n2)))));
  var n2;
}, endsWith: (e2) => {
  return j(m(t2, (n2 = e2, p((t3) => b(t3) && t3.endsWith(n2)))));
  var n2;
}, minLength: (e2) => j(m(t2, ((t3) => p((e3) => b(e3) && e3.length >= t3))(e2))), length: (e2) => j(m(t2, ((t3) => p((e3) => b(e3) && e3.length === t3))(e2))), maxLength: (e2) => j(m(t2, ((t3) => p((e3) => b(e3) && e3.length <= t3))(e2))), includes: (e2) => {
  return j(m(t2, (n2 = e2, p((t3) => b(t3) && t3.includes(n2)))));
  var n2;
}, regex: (e2) => {
  return j(m(t2, (n2 = e2, p((t3) => b(t3) && Boolean(t3.match(n2))))));
  var n2;
} });
var K = j(p(b));
var x = (t2) => Object.assign(u(t2), { between: (e2, n2) => x(m(t2, ((t3, e3) => p((n3) => v(n3) && t3 <= n3 && e3 >= n3))(e2, n2))), lt: (e2) => x(m(t2, ((t3) => p((e3) => v(e3) && e3 < t3))(e2))), gt: (e2) => x(m(t2, ((t3) => p((e3) => v(e3) && e3 > t3))(e2))), lte: (e2) => x(m(t2, ((t3) => p((e3) => v(e3) && e3 <= t3))(e2))), gte: (e2) => x(m(t2, ((t3) => p((e3) => v(e3) && e3 >= t3))(e2))), int: () => x(m(t2, p((t3) => v(t3) && Number.isInteger(t3)))), finite: () => x(m(t2, p((t3) => v(t3) && Number.isFinite(t3)))), positive: () => x(m(t2, p((t3) => v(t3) && t3 > 0))), negative: () => x(m(t2, p((t3) => v(t3) && t3 < 0))) });
var E = x(p(v));
var A = (t2) => Object.assign(u(t2), { between: (e2, n2) => A(m(t2, ((t3, e3) => p((n3) => w(n3) && t3 <= n3 && e3 >= n3))(e2, n2))), lt: (e2) => A(m(t2, ((t3) => p((e3) => w(e3) && e3 < t3))(e2))), gt: (e2) => A(m(t2, ((t3) => p((e3) => w(e3) && e3 > t3))(e2))), lte: (e2) => A(m(t2, ((t3) => p((e3) => w(e3) && e3 <= t3))(e2))), gte: (e2) => A(m(t2, ((t3) => p((e3) => w(e3) && e3 >= t3))(e2))), positive: () => A(m(t2, p((t3) => w(t3) && t3 > 0))), negative: () => A(m(t2, p((t3) => w(t3) && t3 < 0))) });
var P = A(p(w));
var T = u(p(function(t2) {
  return "boolean" == typeof t2;
}));
var B = u(p(function(t2) {
  return "symbol" == typeof t2;
}));
var _ = u(p(function(t2) {
  return null == t2;
}));
var k = u(p(function(t2) {
  return null != t2;
}));
var N = { __proto__: null, matcher: t, optional: h, array: function(...e2) {
  return l({ [t]: () => ({ match: (t2) => {
    if (!Array.isArray(t2)) return { matched: false };
    if (0 === e2.length) return { matched: true };
    const n2 = e2[0];
    let r2 = {};
    if (0 === t2.length) return o(n2).forEach((t3) => {
      r2[t3] = [];
    }), { matched: true, selections: r2 };
    const i2 = (t3, e3) => {
      r2[t3] = (r2[t3] || []).concat([e3]);
    };
    return { matched: t2.every((t3) => s(n2, t3, i2)), selections: r2 };
  }, getSelectionKeys: () => 0 === e2.length ? [] : o(e2[0]) }) });
}, set: function(...e2) {
  return u({ [t]: () => ({ match: (t2) => {
    if (!(t2 instanceof Set)) return { matched: false };
    let n2 = {};
    if (0 === t2.size) return { matched: true, selections: n2 };
    if (0 === e2.length) return { matched: true };
    const r2 = (t3, e3) => {
      n2[t3] = (n2[t3] || []).concat([e3]);
    }, i2 = e2[0];
    return { matched: f(t2, (t3) => s(i2, t3, r2)), selections: n2 };
  }, getSelectionKeys: () => 0 === e2.length ? [] : o(e2[0]) }) });
}, map: function(...e2) {
  return u({ [t]: () => ({ match: (t2) => {
    if (!(t2 instanceof Map)) return { matched: false };
    let n2 = {};
    if (0 === t2.size) return { matched: true, selections: n2 };
    const r2 = (t3, e3) => {
      n2[t3] = (n2[t3] || []).concat([e3]);
    };
    if (0 === e2.length) return { matched: true };
    var i2;
    if (1 === e2.length) throw new Error(`\`P.map\` wasn't given enough arguments. Expected (key, value), received ${null == (i2 = e2[0]) ? void 0 : i2.toString()}`);
    const [o2, c2] = e2;
    return { matched: g(t2, (t3, e3) => {
      const n3 = s(o2, e3, r2), i3 = s(c2, t3, r2);
      return n3 && i3;
    }), selections: n2 };
  }, getSelectionKeys: () => 0 === e2.length ? [] : [...o(e2[0]), ...o(e2[1])] }) });
}, intersection: m, union: d, not: function(e2) {
  return u({ [t]: () => ({ match: (t2) => ({ matched: !s(e2, t2, () => {
  }) }), getSelectionKeys: () => [], matcherType: "not" }) });
}, when: p, select: y, any: S, _: O, string: K, number: E, bigint: P, boolean: T, symbol: B, nullish: _, nonNullable: k, instanceOf: function(t2) {
  return u(p(/* @__PURE__ */ function(t3) {
    return (e2) => e2 instanceof t3;
  }(t2)));
}, shape: function(t2) {
  return u(p(a(t2)));
} };
var W = class extends Error {
  constructor(t2) {
    let e2;
    try {
      e2 = JSON.stringify(t2);
    } catch (n2) {
      e2 = t2;
    }
    super(`Pattern matching error: no pattern matches value ${e2}`), this.input = void 0, this.input = t2;
  }
};
var $ = { matched: false, value: void 0 };
function z(t2) {
  return new I(t2, $);
}
var I = class _I {
  constructor(t2, e2) {
    this.input = void 0, this.state = void 0, this.input = t2, this.state = e2;
  }
  with(...t2) {
    if (this.state.matched) return this;
    const e2 = t2[t2.length - 1], r2 = [t2[0]];
    let i2;
    3 === t2.length && "function" == typeof t2[1] ? i2 = t2[1] : t2.length > 2 && r2.push(...t2.slice(1, t2.length - 1));
    let o2 = false, c2 = {};
    const a2 = (t3, e3) => {
      o2 = true, c2[t3] = e3;
    }, u2 = !r2.some((t3) => s(t3, this.input, a2)) || i2 && !Boolean(i2(this.input)) ? $ : { matched: true, value: e2(o2 ? n in c2 ? c2[n] : c2 : this.input, this.input) };
    return new _I(this.input, u2);
  }
  when(t2, e2) {
    if (this.state.matched) return this;
    const n2 = Boolean(t2(this.input));
    return new _I(this.input, n2 ? { matched: true, value: e2(this.input, this.input) } : $);
  }
  otherwise(t2) {
    return this.state.matched ? this.state.value : t2(this.input);
  }
  exhaustive() {
    if (this.state.matched) return this.state.value;
    throw new W(this.input);
  }
  run() {
    return this.exhaustive();
  }
  returnType() {
    return this;
  }
};
