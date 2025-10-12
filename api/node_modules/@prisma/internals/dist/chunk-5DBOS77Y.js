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
var chunk_5DBOS77Y_exports = {};
__export(chunk_5DBOS77Y_exports, {
  as: () => as,
  asUnit: () => asUnit,
  chain: () => chain,
  chainW: () => chainW,
  dual: () => dual,
  fromEither: () => fromEither,
  getOrElseW: () => getOrElseW,
  isLeft: () => isLeft2,
  isRight: () => isRight2,
  isSome: () => isSome,
  left: () => left2,
  map: () => map2,
  none: () => none,
  pipe: () => pipe,
  right: () => right2,
  right2: () => right4,
  some: () => some,
  tap: () => tap,
  tapEither: () => tapEither,
  tryCatch: () => tryCatch,
  tryCatch2: () => tryCatch2
});
module.exports = __toCommonJS(chunk_5DBOS77Y_exports);
var __spreadArray = function(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};
function identity(a) {
  return a;
}
function flow(ab, bc, cd, de, ef, fg, gh, hi, ij) {
  switch (arguments.length) {
    case 1:
      return ab;
    case 2:
      return function() {
        return bc(ab.apply(this, arguments));
      };
    case 3:
      return function() {
        return cd(bc(ab.apply(this, arguments)));
      };
    case 4:
      return function() {
        return de(cd(bc(ab.apply(this, arguments))));
      };
    case 5:
      return function() {
        return ef(de(cd(bc(ab.apply(this, arguments)))));
      };
    case 6:
      return function() {
        return fg(ef(de(cd(bc(ab.apply(this, arguments))))));
      };
    case 7:
      return function() {
        return gh(fg(ef(de(cd(bc(ab.apply(this, arguments)))))));
      };
    case 8:
      return function() {
        return hi(gh(fg(ef(de(cd(bc(ab.apply(this, arguments))))))));
      };
    case 9:
      return function() {
        return ij(hi(gh(fg(ef(de(cd(bc(ab.apply(this, arguments)))))))));
      };
  }
  return;
}
function pipe(a, ab, bc, cd, de, ef, fg, gh, hi) {
  switch (arguments.length) {
    case 1:
      return a;
    case 2:
      return ab(a);
    case 3:
      return bc(ab(a));
    case 4:
      return cd(bc(ab(a)));
    case 5:
      return de(cd(bc(ab(a))));
    case 6:
      return ef(de(cd(bc(ab(a)))));
    case 7:
      return fg(ef(de(cd(bc(ab(a))))));
    case 8:
      return gh(fg(ef(de(cd(bc(ab(a)))))));
    case 9:
      return hi(gh(fg(ef(de(cd(bc(ab(a))))))));
    default: {
      var ret = arguments[0];
      for (var i = 1; i < arguments.length; i++) {
        ret = arguments[i](ret);
      }
      return ret;
    }
  }
}
var dual = function(arity, body) {
  var isDataFirst = typeof arity === "number" ? function(args) {
    return args.length >= arity;
  } : arity;
  return function() {
    var args = Array.from(arguments);
    if (isDataFirst(arguments)) {
      return body.apply(this, args);
    }
    return function(self) {
      return body.apply(void 0, __spreadArray([self], args, false));
    };
  };
};
var isSome = function(fa) {
  return fa._tag === "Some";
};
var none = { _tag: "None" };
var some = function(a) {
  return { _tag: "Some", value: a };
};
var isLeft = function(ma) {
  return ma._tag === "Left";
};
var isRight = function(ma) {
  return ma._tag === "Right";
};
var left = function(e) {
  return { _tag: "Left", left: e };
};
var right = function(a) {
  return { _tag: "Right", right: a };
};
var flatMapIO = function(F, M) {
  return /* @__PURE__ */ dual(2, function(self, f) {
    return M.flatMap(self, function(a) {
      return F.fromIO(f(a));
    });
  });
};
function ap(F, G) {
  return function(fa) {
    return function(fab) {
      return F.ap(F.map(fab, function(gab) {
        return function(ga) {
          return G.ap(gab, ga);
        };
      }), fa);
    };
  };
}
function map(F, G) {
  return function(f) {
    return function(fa) {
      return F.map(fa, function(ga) {
        return G.map(ga, f);
      });
    };
  };
}
function as(F) {
  return function(self, b) {
    return F.map(self, function() {
      return b;
    });
  };
}
function asUnit(F) {
  var asM = as(F);
  return function(self) {
    return asM(self, void 0);
  };
}
function tap(M) {
  return function(first, f) {
    return M.chain(first, function(a) {
      return M.map(f(a), function() {
        return a;
      });
    });
  };
}
function fromEitherK(F) {
  return function(f) {
    return flow(f, F.fromEither);
  };
}
function tapEither(F, M) {
  var fromEither2 = fromEitherK(F);
  var tapM = tap(M);
  return function(self, f) {
    return tapM(self, fromEither2(f));
  };
}
var left2 = left;
var right2 = right;
var flatMap = /* @__PURE__ */ dual(2, function(ma, f) {
  return isLeft2(ma) ? ma : f(ma.right);
});
var _map = function(fa, f) {
  return pipe(fa, map2(f));
};
var _ap = function(fab, fa) {
  return pipe(fab, ap2(fa));
};
var URI = "Either";
var map2 = function(f) {
  return function(fa) {
    return isLeft2(fa) ? fa : right2(f(fa.right));
  };
};
var Functor = {
  URI,
  map: _map
};
var as2 = dual(2, as(Functor));
var asUnit2 = asUnit(Functor);
var apW = function(fa) {
  return function(fab) {
    return isLeft2(fab) ? fab : isLeft2(fa) ? fa : right2(fab.right(fa.right));
  };
};
var ap2 = apW;
var Apply = {
  URI,
  map: _map,
  ap: _ap
};
var Chain = {
  URI,
  map: _map,
  ap: _ap,
  chain: flatMap
};
var bimap = function(f, g) {
  return function(fa) {
    return isLeft2(fa) ? left2(f(fa.left)) : right2(g(fa.right));
  };
};
var mapLeft = function(f) {
  return function(fa) {
    return isLeft2(fa) ? left2(f(fa.left)) : fa;
  };
};
var FromEither = {
  URI,
  fromEither: identity
};
var isLeft2 = isLeft;
var isRight2 = isRight;
var getOrElseW = function(onLeft) {
  return function(ma) {
    return isLeft2(ma) ? onLeft(ma.left) : ma.right;
  };
};
var tap2 = /* @__PURE__ */ dual(2, tap(Chain));
var _FromEither = {
  fromEither: FromEither.fromEither
};
var tryCatch = function(f, onThrow) {
  try {
    return right2(f());
  } catch (e) {
    return left2(onThrow(e));
  }
};
var chainW = flatMap;
function right3(F) {
  return flow(right2, F.of);
}
function rightF(F) {
  return function(fa) {
    return F.map(fa, right2);
  };
}
function map3(F) {
  return map(F, Functor);
}
function ap3(F) {
  return ap(F, Apply);
}
function flatMap2(M) {
  return function(ma, f) {
    return M.chain(ma, function(e) {
      return isLeft2(e) ? M.of(e) : f(e.right);
    });
  };
}
function mapBoth(F) {
  return function(self, f, g) {
    return F.map(self, bimap(f, g));
  };
}
function mapError(F) {
  return function(self, f) {
    return F.map(self, mapLeft(f));
  };
}
function orElse(M) {
  return function(onLeft) {
    return function(ma) {
      return M.chain(ma, function(e) {
        return isLeft2(e) ? onLeft(e.left) : M.of(e);
      });
    };
  };
}
function tapError(M) {
  var orElseM = orElse(M);
  return function(ma, onLeft) {
    return pipe(ma, orElseM(function(e) {
      return M.map(onLeft(e), function(eb) {
        return isLeft2(eb) ? eb : left2(e);
      });
    }));
  };
}
function tapIO(F, M) {
  var chainFirstM = tap(M);
  return function(self, f) {
    return chainFirstM(self, flow(f, F.fromIO));
  };
}
function tapTask(F, M) {
  var tapM = tap(M);
  return function(self, f) {
    return tapM(self, flow(f, F.fromTask));
  };
}
var fromIO = function(ma) {
  return function() {
    return Promise.resolve().then(ma);
  };
};
var _map2 = function(fa, f) {
  return pipe(fa, map4(f));
};
var _apPar = function(fab, fa) {
  return pipe(fab, ap4(fa));
};
var map4 = function(f) {
  return function(fa) {
    return function() {
      return Promise.resolve().then(fa).then(f);
    };
  };
};
var ap4 = function(fa) {
  return function(fab) {
    return function() {
      return Promise.all([Promise.resolve().then(fab), Promise.resolve().then(fa)]).then(function(_a) {
        var f = _a[0], a = _a[1];
        return f(a);
      });
    };
  };
};
var of = function(a) {
  return function() {
    return Promise.resolve(a);
  };
};
var flatMap3 = /* @__PURE__ */ dual(2, function(ma, f) {
  return function() {
    return Promise.resolve().then(ma).then(function(a) {
      return f(a)();
    });
  };
});
var URI2 = "Task";
var Functor2 = {
  URI: URI2,
  map: _map2
};
var as3 = dual(2, as(Functor2));
var asUnit3 = asUnit(Functor2);
var Pointed = {
  URI: URI2,
  of
};
var ApplyPar = {
  URI: URI2,
  map: _map2,
  ap: _apPar
};
var Chain2 = {
  URI: URI2,
  map: _map2,
  ap: _apPar,
  chain: flatMap3
};
var Monad = {
  URI: URI2,
  map: _map2,
  of,
  ap: _apPar,
  chain: flatMap3
};
var FromIO = {
  URI: URI2,
  fromIO
};
var _FlatMap = {
  flatMap: flatMap3
};
var _FromIO = {
  fromIO: FromIO.fromIO
};
var flatMapIO2 = flatMapIO(_FromIO, _FlatMap);
var tap3 = /* @__PURE__ */ dual(2, tap(Chain2));
var tapIO2 = /* @__PURE__ */ dual(2, tapIO(FromIO, Chain2));
var __awaiter = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __generator = function(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g;
  return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
};
var right4 = /* @__PURE__ */ right3(Pointed);
var rightTask = /* @__PURE__ */ rightF(Functor2);
var rightIO = /* @__PURE__ */ flow(fromIO, rightTask);
var fromIO2 = rightIO;
var fromTask = rightTask;
var fromEither = of;
var tryCatch2 = function(f, onRejected) {
  return function() {
    return __awaiter(void 0, void 0, void 0, function() {
      var reason_1;
      return __generator(this, function(_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3]);
            return [4, f().then(right)];
          case 1:
            return [2, _a.sent()];
          case 2:
            reason_1 = _a.sent();
            return [2, left(onRejected(reason_1))];
          case 3:
            return [
              2
              /*return*/
            ];
        }
      });
    });
  };
};
var tapError2 = /* @__PURE__ */ dual(2, tapError(Monad));
var _map3 = function(fa, f) {
  return pipe(fa, map5(f));
};
var _apPar2 = function(fab, fa) {
  return pipe(fab, ap5(fa));
};
var map5 = /* @__PURE__ */ map3(Functor2);
var mapBoth2 = /* @__PURE__ */ dual(3, mapBoth(Functor2));
var mapError2 = /* @__PURE__ */ dual(2, mapError(Functor2));
var ap5 = /* @__PURE__ */ ap3(ApplyPar);
var flatMap4 = /* @__PURE__ */ dual(2, flatMap2(Monad));
var URI3 = "TaskEither";
var Functor3 = {
  URI: URI3,
  map: _map3
};
var as4 = dual(2, as(Functor3));
var asUnit4 = asUnit(Functor3);
var Chain3 = {
  URI: URI3,
  map: _map3,
  ap: _apPar2,
  chain: flatMap4
};
var FromEither2 = {
  URI: URI3,
  fromEither
};
var FromIO2 = {
  URI: URI3,
  fromIO: fromIO2
};
var FromTask = {
  URI: URI3,
  fromIO: fromIO2,
  fromTask
};
var tap4 = /* @__PURE__ */ dual(2, tap(Chain3));
var tapEither2 = /* @__PURE__ */ dual(2, tapEither(FromEither2, Chain3));
var tapIO3 = /* @__PURE__ */ dual(2, tapIO(FromIO2, Chain3));
var tapTask2 = /* @__PURE__ */ dual(2, tapTask(FromTask, Chain3));
var _FromEither2 = {
  fromEither: FromEither2.fromEither
};
var _FromIO2 = {
  fromIO: FromIO2.fromIO
};
var chain = flatMap4;
