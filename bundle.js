/*
 *  main.js
 */

phina.globalize();

const SCREEN_WIDTH = 576;
const SCREEN_HEIGHT = 324;
const SCREEN_WIDTH_HALF = SCREEN_WIDTH * 0.5;
const SCREEN_HEIGHT_HALF = SCREEN_HEIGHT * 0.5;

const SCREEN_OFFSET_X = 0;
const SCREEN_OFFSET_Y = 0;

const NUM_LAYERS = 7;
const LATER_FOREGROUND = 6;
const LAYER_EFFECT_FORE = 5;
const LAYER_PLAYER = 4;
const LAYER_ENEMY = 3;
const LAYER_EFFECT_BACK = 2;
const LAYER_BACKGROUND = 1;
const LAYER_MAP = 0;

let phina_app;

window.onload = function() {
  phina_app = Application();
  phina_app.replaceScene(FirstSceneFlow({}));
  phina_app.run();
};

//スクロール禁止
// document.addEventListener('touchmove', function(e) {
//  e.preventDefault();
// }, { passive: false });

//Androidブラウザバックボタン制御
// document.addEventListener("backbutton", function(e){
//   e.preventDefault();
// }, false);
phina.namespace(function() {

  phina.define("Application", {
    superClass: "phina.display.CanvasApp",

    quality: 1.0,
  
    init: function() {
      this.superInit({
        fps: 60,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        fit: true,
      });
  
      //シーンの幅、高さの基本を設定
      phina.display.DisplayScene.defaults.$extend({
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
      });
  
      phina.input.Input.quality = this.quality;
      phina.display.DisplayScene.quality = this.quality;

      //ゲームパッド管理
      this.gamepadManager = phina.input.GamepadManager();
      this.gamepad = this.gamepadManager.get(0);
      this.controller = {};

      this.setupEvents();
      this.setupSound();
      this.setupMouseWheel();

      this.on("changescene", () => {
        //シーンを離れる際、ボタン同時押しフラグを解除する
        Button.actionTarget = null;
      });

      //パッド情報を更新
      this.on('enterframe', function() {
        this.gamepadManager.update();
        this.updateController();
      });
    },
  
    //マウスのホールイベント関連
    setupMouseWheel: function() {
      this.wheelDeltaY = 0;
      this.domElement.addEventListener("mousewheel", function(e) {
        e.stopPropagation();
        e.preventDefault();
        this.wheelDeltaY = e.deltaY;
      }.bind(this), false);
  
      this.on("enterframe", function() {
        this.pointer.wheelDeltaY = this.wheelDeltaY;
        this.wheelDeltaY = 0;
      });
    },

    //アプリケーション全体のイベントフック
    setupEvents: function() {},
  
    setupSound: function() {},

    updateController: function() {
      var before = this.controller;
      before.before = null;

      var gp = this.gamepad;
      var kb = this.keyboard;
      var angle1 = gp.getKeyAngle();
      var angle2 = kb.getKeyAngle();
      this.controller = {
          angle: angle1 !== null? angle1: angle2,

          up: gp.getKey("up") || kb.getKey("up"),
          down: gp.getKey("down") || kb.getKey("down"),
          left: gp.getKey("left") || kb.getKey("left"),
          right: gp.getKey("right") || kb.getKey("right"),

          attack: gp.getKey("A") || kb.getKey("X"),
          jump:   gp.getKey("X") || kb.getKey("Z"),
          menu:   gp.getKey("start") || kb.getKey("escape"),

          a: gp.getKey("A") || kb.getKey("Z"),
          b: gp.getKey("B") || kb.getKey("X"),
          x: gp.getKey("X") || kb.getKey("C"),
          y: gp.getKey("Y") || kb.getKey("V"),

          ok: gp.getKey("A") || kb.getKey("Z") || kb.getKey("space") || kb.getKey("return"),
          cancel: gp.getKey("B") || kb.getKey("X") || kb.getKey("escape"),

          start: gp.getKey("start") || kb.getKey("return"),
          select: gp.getKey("select"),

          pause: gp.getKey("start") || kb.getKey("escape"),

          analog1: gp.getStickDirection(0),
          analog2: gp.getStickDirection(1),

          //前フレーム情報
          before: before,
      };
  },
});
  
});
/*
 *  AssetList.js
 */

phina.namespace(function() {

  phina.define("AssetList", {
    _static: {
      loaded: [],
      isLoaded: function(assetType) {
        return AssetList.loaded[assetType]? true: false;
      },
      get: function(assetType) {
        AssetList.loaded[assetType] = true;
        switch (assetType) {
          case "preload":
            return {
              image: {
                "fighter": "assets/textures/fighter.png",
                "particle": "assets/textures/particle.png",
              },
              // tmx: {
              //   "map1": "assets/map/map2.tmx",
              // },
              // tsx: {
              //   "tile_a": "assets/map/tile_a.tsx",
              // }
            };
          case "common":
            return {
              image: {
              },
            };

          default:
            throw "invalid assetType: " + options.assetType;
        }
      },
    },
  });

});

/*
 *  MainScene.js
 *  2018/10/26
 */

phina.namespace(function() {

  phina.define("BaseScene", {
    superClass: 'DisplayScene',

    //廃棄エレメント
    disposeElements: null,

    init: function(options) {
      options = (options || {}).$safe({
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: 'transparent',
      });
      this.superInit(options);

      //シーン離脱時canvasメモリ解放
      this.disposeElements = [];
      this.one('destroy', () => {
        this.disposeElements.forEach(e => {
          if (e.destroyCanvas) {
            e.destroyCanvas();
          } else if (e instanceof Canvas) {
            e.setSize(0, 0);
          }
        });
      });

      this.app = phina_app;

      //別シーンへの移行時にキャンバスを破棄
      this.one('exit', () => {
        this.destroy();
        this.canvas.destroy();
        this.flare('destroy');
        console.log("Exit scene.");
      });
    },

    destroy: function() {},

    fadeIn: function(options) {
      options = (options || {}).$safe({
        color: "white",
        millisecond: 500,
      });
      return new Promise(resolve => {
        const mask = RectangleShape({
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          fill: options.color,
          strokeWidth: 0,
        }).setPosition(SCREEN_WIDTH * 0.5, SCREEN_HEIGHT * 0.5).addChildTo(this);
        mask.tweener.clear()
          .fadeOut(options.millisecond)
          .call(() => {
            resolve();
            this.app.one('enterframe', () => mask.destroyCanvas());
          });
      });
    },

    fadeOut: function(options) {
      options = (options || {}).$safe({
        color: "white",
        millisecond: 500,
      });
      return new Promise(resolve => {
        const mask = RectangleShape({
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          fill: options.color,
          strokeWidth: 0,
        }).setPosition(SCREEN_WIDTH * 0.5, SCREEN_HEIGHT * 0.5).addChildTo(this);
        mask.alpha = 0;
        mask.tweener.clear()
          .fadeIn(options.millisecond)
          .call(() => {
            resolve();
            this.app.one('enterframe', () => mask.destroyCanvas());
          });
      });
    },

    //シーン離脱時に破棄するShapeを登録
    registDispose: function(element) {
      this.disposeElements.push(element);
    },
  });

});
/*
 *  FirstSceneFlow.js
 */

phina.namespace(function() {

  phina.define("FirstSceneFlow", {
    superClass: "ManagerScene",

    init: function(options) {
      options = options || {};
      startLabel = options.startLabel || "title";
      this.superInit({
        startLabel: startLabel,
        scenes: [
          {
            label: "title",
            className: "TitleScene",
            nextLabel: "home",
          },
          {
            label: "main",
            className: "MainScene",
          },
        ],
      });
    }
  });

});
phina.namespace(function() {

  phina.define('MainScene', {
    superClass: 'BaseScene',

    init: function(options) {
      this.superInit();
      this.setup();
    },

    setup: function() {
      const back = RectangleShape({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, fill: "black" })
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF)
        .addChildTo(this);
      this.registDispose(back);

      this.world = World().addChildTo(this);
    },

    update: function() {
    },

  });

});

/*
 *  TitleScene.js
 */

phina.namespace(function() {

  phina.define('TitleScene', {
    superClass: 'BaseScene',

    _static: {
      isAssetLoad: false,
    },

    init: function(options) {
      this.superInit();

      this.unlock = false;
      this.loadcomplete = false;
      this.progress = 0;

      //ロード済みならアセットロードをしない
      if (TitleScene.isAssetLoad) {
        this.setup();
      } else {
        //preload asset
        const assets = AssetList.get("preload")
        this.loader = phina.asset.AssetLoader();
        this.loader.load(assets);
        this.loader.on('load', () => this.setup());
        TitleScene.isAssetLoad = true;
      }
    },

    setup: function() {
      const back = RectangleShape({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, fill: "black" })
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF)
        .addChildTo(this);
      this.registDispose(back);

      const label = Label({ text: "TitleScene", fill: "white" })
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF)
        .addChildTo(this);
      this.registDispose(label);

      this.one('nextscene', () => this.exit("main"));
      this.flare('nextscene');
    },

    update: function() {
      var ct = phina_app.controller;
      if (ct.a) {
        this.flare('nextscene');
      }
    },

  });

});

phina.namespace(function() {

  phina.define('BaseUnit', {
    superClass: 'DisplayElement',

    _static: {
      defaultOptions: {
        world: null,
      },
    },

    state: null,
    angle: 0,
    direction: 0,

    sprite: null,

    init: function(options) {
      this.superInit(options);
      this.world = options.world || null;
      this.base = DisplayElement().addChildTo(this);
      this.velocity = Vector2(0, 0);

      this.before = null;
    },
  });

});

phina.define("Button", {
  superClass: "Accessory",

  lognpressTime: 500,
  doLongpress: false,

  //長押しで連打モード
  longpressBarrage: false,

  init: function() {
    this.superInit();

    this.on("attached", () => {
      this.target.interactive = true;
      this.target.clickSound = Button.defaults.clickSound;

      //ボタン押し時用
      this.target.scaleTweener = Tweener().attachTo(this.target);

      //長押し用
      this.target.twLongpress = Tweener().attachTo(this.target);

      //長押し中特殊対応用
      this.target.twLongpressing = Tweener().attachTo(this.target);

      this.target.on("pointstart", (e) => {

        //イベント貫通にしておく
        e.pass = true;

        //ボタンの同時押しを制限
        if (Button.actionTarget !== null) return;

        //リストビューの子供だった場合はviewportとのあたり判定をする
        const listView = Button.findListView(e.target);
        if (listView && !listView.viewport.hitTest(e.pointer.x, e.pointer.y)) return;

        if (listView) {
          //ポインタが移動した場合は長押しキャンセル（listView内版）
          listView.inner.$watch('y', (v1, v2) => {
            if (this.target !== Button.actionTarget) return;
            if (Math.abs(v1 - v2) < 10) return;

            Button.actionTarget = null;
            this.target.twLongpress.clear();
            this.target.scaleTweener.clear().to({
              scaleX: 1.0 * this.sx,
              scaleY: 1.0 * this.sy
            }, 50);
          });
        }

        //ボタンの処理を実行しても問題ない場合のみ貫通を停止する
        e.pass = false;
        Button.actionTarget = this.target;

        //反転しているボタン用に保持する
        this.sx = (this.target.scaleX > 0) ? 1 : -1;
        this.sy = (this.target.scaleY > 0) ? 1 : -1;

        this.target.scaleTweener.clear()
          .to({
            scaleX: 0.95 * this.sx,
            scaleY: 0.95 * this.sy
          }, 50);

        this.doLongpress = false;
        this.target.twLongpress.clear()
          .wait(this.lognpressTime)
          .call(() => {
            if (!this.longpressBarrage) {
              Button.actionTarget = null;
              this.target.scaleTweener.clear()
                .to({
                  scaleX: 1.0 * this.sx,
                  scaleY: 1.0 * this.sy
                }, 50)
              this.target.flare("longpress")
            } else {
              this.target.flare("clickSound");
              this.target.twLongpressing.clear()
                .wait(5)
                .call(() => this.target.flare("clicked", {
                  longpress: true
                }))
                .call(() => this.target.flare("longpressing"))
                .setLoop(true);
            }
          });
      });

      this.target.on("pointend", (e) => {
        //イベント貫通にしておく
        e.pass = true;

        //
        this.target.twLongpress.clear();
        this.target.twLongpressing.clear();

        //ターゲットがnullかpointstartで保持したターゲットと違う場合はスルーする
        if (Button.actionTarget === null) return;
        if (Button.actionTarget !== this.target) return;

        //ボタンの処理を実行しても問題ない場合のみ貫通を停止する
        e.pass = false;

        //押した位置からある程度移動している場合はクリックイベントを発生させない
        const isMove = e.pointer.startPosition.sub(e.pointer.position).length() > 50;
        const hitTest = this.target.hitTest(e.pointer.x, e.pointer.y);
        if (hitTest && !isMove) this.target.flare("clickSound");

        this.target.scaleTweener.clear()
          .to({
            scaleX: 1.0 * this.sx,
            scaleY: 1.0 * this.sy
          }, 50)
          .call(() => {
            Button.actionTarget = null;
            if (!hitTest || isMove || this.doLongpress) return;
            this.target.flare("clicked", {
              pointer: e.pointer
            });
          });
      });

      //アニメーションの最中に削除された場合に備えてremovedイベント時にフラグを元に戻しておく
      this.target.one("removed", () => {
        if (Button.actionTarget === this.target) {
          Button.actionTarget = null;
        }
      });

      this.target.on("clickSound", () => {
        if (!this.target.clickSound || this.target.clickSound == "") return;
        phina.asset.SoundManager.play(this.target.clickSound);
      });

    });
  },

  //長押しの強制キャンセル
  longpressCancel: function() {
    this.target.twLongpress.clear();
    this.target.twLongpressing.clear();
  },

  _static: {
    //ボタン同時押しを制御するためにstatusはstaticにする
    status: 0,
    actionTarget: null,
    //基本設定
    defaults: {
      clickSound: "common/sounds/se/button",
    },

    //親をたどってListViewを探す
    findListView: function(element, p) {
      //リストビューを持っている場合
      if (element.ListView != null) return element.ListView;
      //親がなければ終了
      if (element.parent == null) return null;
      //親をたどる
      return this.findListView(element.parent);
    }

  }

});

/**
 * 親スプライトのテクスチャを切り抜いて自分のテクスチャとするスプライト
 * 親スプライトの切り抜かれた部分は、切り抜き範囲の左上のピクセルの色で塗りつぶされる
 * 
 * 親要素の拡縮・回転は考慮しない
 */
phina.define("ClipSprite", {
  superClass: "Accessory",

  init: function() {
    this.superInit();
    this.on("attached", () => {
      this.target.one("added", () => {
        this.setup();
      });
    });
  },

  setup: function() {
    const target = this.target;
    const parent = target.parent;
    if (parent instanceof phina.display.Sprite) {
      const x = parent.width * parent.origin.x + target.x - target.width * target.origin.x;
      const y = parent.height * parent.origin.y + target.y - target.height * target.origin.y;
      const w = target.width;
      const h = target.height;

      const parentTexture = parent.image;
      const canvas = phina.graphics.Canvas().setSize(w, h);
      canvas.context.drawImage(parentTexture.domElement, x, y, w, h, 0, 0, w, h);
      if (parentTexture instanceof phina.graphics.Canvas) {
        // クローンしてそっちを使う
        const parentTextureClone = phina.graphics.Canvas().setSize(parentTexture.width, parentTexture.height);
        parentTextureClone.context.drawImage(parentTexture.domElement, 0, 0);
        parent.image = parentTextureClone;

        const data = parentTextureClone.context.getImageData(x, y, 1, 1).data;
        parentTextureClone.context.clearRect(x, y, w, h);
        if (data[3] > 0) {
          parentTextureClone.context.globalAlpha = 1;
          parentTextureClone.context.fillStyle = `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
          parentTextureClone.context.fillRect(x - 1, y - 1, w + 2, h + 2);
        }
      }

      const sprite = phina.display.Sprite(canvas);
      sprite.setOrigin(target.origin.x, target.origin.y);
      target.addChildAt(sprite, 0);
    }
  },
});

phina.define("Gauge", {
  superClass: "RectangleClip",

  _min: 0,
  _max: 1.0,
  _value: 1.0, //min ~ max

  direction: "horizontal", // horizontal or vertical

  init: function() {
    this.superInit();
    this.on("attached", () => {
      this._width = this.width;
      this._height = this.width;

      this.target.accessor("Gauge.min", {
        "get": () => this.min,
        "set": (v) => this.min = v,
      });

      this.target.accessor("Gauge.max", {
        "get": () => this.max,
        "set": (v) => this.max = v,
      });

      this.target.accessor("Gauge.value", {
        "get": () => this.value,
        "set": (v) => this.value = v,
      });

      this.target.accessor("Gauge.progress", {
        "get": () => this.progress,
        "set": (v) => this.progress = v,
      });
    });
  },

  _refresh: function() {
    if (this.direction !== "vertical") {
      this.width = this.target.width * this.progress;
      this.height = this.target.height;
    } else {
      this.width = this.target.width;
      this.height = this.target.height * this.progress;
    }
  },

  _accessor: {
    progress: {
      get: function() {
        const p = (this.value - this.min) / (this.max - this.min);
        return (isNaN(p)) ? 0.0 : p;
      },
      set: function(v) {
        this.value = this.max * v;
      }
    },

    max: {
      get: function() {
        return this._max;
      },
      set: function(v) {
        this._max = v;
        this._refresh();
      }
    },

    min: {
      get: function() {
        return this._min;
      },
      set: function(v) {
        this._min = v;
        this._refresh();
      }
    },

    value: {
      get: function() {
        return this._value;
      },
      set: function(v) {
        this._value = v;
        this._refresh();
      }
    },
  }

});

phina.define("Grayscale", {
  superClass: "Accessory",

  grayTextureName: null,

  init: function(options) {
    this.superInit();
    this.on("attached", () => {
      this.grayTextureName = options.grayTextureName;
      this.normal = this.target.image;
    });
  },

  toGrayscale: function() {
    this.target.image = this.grayTextureName;
  },

  toNormal: function() {
    this.target.image = this.normal;
  },

});

phina.namespace(function() {
  //マウス追従
  phina.define("MouseChaser", {
    superClass: "Accessory",

    init: function() {
      this.superInit();
    },

    onattached: function() {
      let px = 0;
      let py = 0;
      console.log("#MouseChaser", "onattached");
      this.tweener = Tweener().attachTo(this.target);
      this.target.on("enterframe", (e) => {
        const p = e.app.pointer;
        if (py == p.x && py == p.y) return;
        px = p.x;
        py = p.y;
        const x = p.x - SCREEN_WIDTH_HALF;
        const y = p.y - SCREEN_HEIGHT_HALF;
        this.tweener.clear().to({ x, y }, 2000, "easeOutQuad")
      });

    },

    ondetached: function() {
      console.log("#MouseChaser", "ondetached");
      this.tweener.remove();
    }

  });
});

phina.define("MultiRectangleClip", {
  superClass: "Accessory",

  x: 0,
  y: 0,
  width: 0,
  height: 0,

  _enable: true,

  init: function() {
    this.superInit();
    this._init();
  },

  _init: function() {
    this.clipRect = [];

    this.on("attached", () => {
      this.x = 0;
      this.y = 0;
      this.width = this.target.width;
      this.height = this.target.height;

      this.target.clip = (c) => this._clip(c);
    });
  },

  addClipRect: function(rect) {
    const r = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
    this.clipRect.push(r);
    return this;
  },

  clearClipRect: function() {
    this.clipRect = [];
  },

  _clip: function(canvas) {
    canvas.beginPath();
    this.clipRect.forEach(rect => {
      canvas.rect(rect.x, rect.y, rect.width, rect.height)
    });
    canvas.closePath();
  },

  setEnable: function(enable) {
    this._enable = enable;
    if (this._enable) {
      this.target.clip = (c) => this._clip(c);
    } else {
      this.target.clip = null;
    }
  },

  _accessor: {
    enable: {
      set: function(v) {
        this.setEnable(v);
      },
      get: function() {
        return this._enable;
      }
    }
  },

});

phina.namespace(function() {

  phina.define("PieClip", {
    superClass: "Accessory",

    init: function(options) {
      options = ({}).$safe(options, PieClip.defaults)
      this.superInit(options);

      this.pivotX = options.pivotX;
      this.pivotY = options.pivotY;
      this.angleMin = options.angleMin;
      this.angleMax = options.angleMax;
      this.radius = options.radius;
      this.anticlockwise = options.anticlockwise;
    },

    onattached: function() {
      this.target.clip = (canvas) => {
        const angleMin = this.angleMin * Math.DEG_TO_RAD;
        const angleMax = this.angleMax * Math.DEG_TO_RAD;
        const ctx = canvas.context;
        ctx.beginPath();
        ctx.moveTo(this.pivotX, this.pivotY);
        ctx.lineTo(this.pivotX + Math.cos(angleMin) * this.radius, this.pivotY + Math.sin(angleMin) * this.radius);
        ctx.arc(this.pivotX, this.pivotY, this.radius, angleMin, angleMax, this.anticlockwise);
        ctx.closePath();
      };
    },

    _static: {
      defaults: {
        pivotX: 32,
        pivotY: 32,
        angleMin: 0,
        angleMax: 360,
        radius: 64,
        anticlockwise: false,
      },
    },

  });
});

phina.define("RectangleClip", {
  superClass: "Accessory",

  x: 0,
  y: 0,
  width: 0,
  height: 0,

  _enable: true,

  init: function() {
    this.superInit();
    this._init();
  },

  _init: function() {
    this.on("attached", () => {

      this.target.accessor("RectangleClip.width", {
        "get": () => this.width,
        "set": (v) => this.width = v,
      });

      this.target.accessor("RectangleClip.height", {
        "get": () => this.height,
        "set": (v) => this.height = v,
      });

      this.target.accessor("RectangleClip.x", {
        "get": () => this.x,
        "set": (v) => this.x = v,
      });

      this.target.accessor("RectangleClip.y", {
        "get": () => this.y,
        "set": (v) => this.y = v,
      });

      this.x = 0;
      this.y = 0;
      this.width = this.target.width;
      this.height = this.target.height;

      this.target.clip = (c) => this._clip(c);
    });
  },

  _clip: function(canvas) {
    const x = this.x - (this.width * this.target.originX);
    const y = this.y - (this.height * this.target.originY);

    canvas.beginPath();
    canvas.rect(x, y, this.width, this.height);
    canvas.closePath();
  },

  setEnable: function(enable) {
    this._enable = enable;
    if (this._enable) {
      this.target.clip = (c) => this._clip(c);
    } else {
      this.target.clip = null;
    }
  },

  _accessor: {
    enable: {
      set: function(v) {
        this.setEnable(v);
      },
      get: function() {
        return this._enable;
      }
    }
  },

});

phina.define("Toggle", {
  superClass: "Accessory",

  init: function(isOn) {
    this.superInit();
    this._init(isOn);
  },

  _init: function(isOn) {
    this.isOn = isOn || false;
  },

  setStatus: function(status) {
    this.isOn = status;
    this.target.flare((this.isOn) ? "switchOn" : "switchOff");
  },

  switchOn: function() {
    if (this.isOn) return;
    this.setStatus(true);
  },

  switchOff: function() {
    if (!this.isOn) return;
    this.setStatus(false);
  },

  switch: function() {
    this.isOn = !this.isOn;
    this.setStatus(this.isOn);
  },

  _accessor: {
    status: {
      "get": function() {
        return this.isOn;
      },
      "set": function(v) {
        return setStatus(v);
      },
    },
  },

});

phina.define("Buttonize", {
  init: function() {},
  _static: {
    STATUS: {
      NONE: 0,
      START: 1,
      END: 2,
    },
    status: 0,
    rect: function(element) {
      element.boundingType = "rect";
      this._common(element);
      return element;
    },
    circle: function(element) {
      element.radius = Math.max(element.width, element.height) * 0.5;
      element.boundingType = "circle";
      this._common(element);
      return element;
    },
    _common: function(element) {
      //TODO:エディターできるまでの暫定対応
      element.setOrigin(0.5, 0.5, true);

      element.interactive = true;
      element.clickSound = "se/clickButton";

      //TODO:ボタンの同時押下は実機で調整する
      element.on("pointstart", e => {
        if (this.status != this.STATUS.NONE) return;
        this.status = this.STATUS.START;
        element.tweener.clear()
          .to({
            scaleX: 0.9,
            scaleY: 0.9
          }, 100);
      });

      element.on("pointend", (e) => {
        if (this.status != this.STATUS.START) return;
        const hitTest = element.hitTest(e.pointer.x, e.pointer.y);
        this.status = this.STATUS.END;
        if (hitTest) element.flare("clickSound");

        element.tweener.clear()
          .to({
            scaleX: 1.0,
            scaleY: 1.0
          }, 100)
          .call(() => {
            this.status = this.STATUS.NONE;
            if (!hitTest) return;
            element.flare("clicked", {
              pointer: e.pointer
            });
          });
      });

      //アニメーションの最中に削除された場合に備えてremovedイベント時にフラグを元に戻しておく
      element.one("removed", () => {
        this.status = this.STATUS.NONE;
      });

      element.on("clickSound", function() {
        if (!element.clickSound) return;
        //phina.asset.SoundManager.play(element.clickSound);
      });
    },
  },
});

phina.namespace(function() {

  /**
   * テクスチャ関係のユーティリティ
   */
  phina.define("TextureUtil", {

    _static: {

      /**
       * RGB各要素に実数を積算する
       */
      multiplyColor: function(texture, red, green, blue) {
        if (typeof(texture) === "string") {
          texture = AssetManager.get("image", texture);
        }

        const width = texture.domElement.width;
        const height = texture.domElement.height;

        const result = Canvas().setSize(width, height);
        const context = result.context;

        context.drawImage(texture.domElement, 0, 0);
        const imageData = context.getImageData(0, 0, width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i + 0] = Math.floor(imageData.data[i + 0] * red);
          imageData.data[i + 1] = Math.floor(imageData.data[i + 1] * green);
          imageData.data[i + 2] = Math.floor(imageData.data[i + 2] * blue);
        }
        context.putImageData(imageData, 0, 0);

        return result;
      },

      /**
       * 色相・彩度・明度を操作する
       */
      editByHsl: function(texture, h, s, l) {
        if (typeof(texture) === "string") {
          texture = AssetManager.get("image", texture);
        }

        const width = texture.domElement.width;
        const height = texture.domElement.height;

        const result = Canvas().setSize(width, height);
        const context = result.context;

        context.drawImage(texture.domElement, 0, 0);
        const imageData = context.getImageData(0, 0, width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i + 0];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];

          const hsl = phina.util.Color.RGBtoHSL(r, g, b);
          const newRgb = phina.util.Color.HSLtoRGB(hsl[0] + h, Math.clamp(hsl[1] + s, 0, 100), Math.clamp(hsl[2] + l, 0, 100));

          imageData.data[i + 0] = newRgb[0];
          imageData.data[i + 1] = newRgb[1];
          imageData.data[i + 2] = newRgb[2];
        }
        context.putImageData(imageData, 0, 0);

        return result;
      },

    },

    init: function() {},
  });

});

/*
 *  phina.tiledmap.js
 *  2016/9/10
 *  @auther minimo  
 *  This Program is MIT license.
 * 
 *  2019/9/18
 *  version 2.0
 */

phina.namespace(function() {

  phina.define("phina.asset.TiledMap", {
    superClass: "phina.asset.XMLLoader",

    image: null,

    tilesets: null,
    layers: null,

    init: function() {
        this.superInit();
    },

    _load: function(resolve) {
      //パス抜き出し
      this.path = "";
      const last = this.src.lastIndexOf("/");
      if (last > 0) {
        this.path = this.src.substring(0, last + 1);
      }

      //終了関数保存
      this._resolve = resolve;

      // load
      const xml = new XMLHttpRequest();
      xml.open('GET', this.src);
      xml.onreadystatechange = () => {
        if (xml.readyState === 4) {
          if ([200, 201, 0].indexOf(xml.status) !== -1) {
            const data = (new DOMParser()).parseFromString(xml.responseText, "text/xml");
            this.dataType = "xml";
            this.data = data;
            this._parse(data)
              .then(() => this._resolve(this));
          }
        }
      };
      xml.send(null);
    },

    //マップイメージ取得
    getImage: function(layerName) {
      if (layerName === undefined) {
        return this.image;
      } else {
        return this._generateImage(layerName);
      }
    },

    //指定マップレイヤーを配列として取得
    getMapData: function(layerName) {
      //レイヤー検索
      for(let i = 0; i < this.layers.length; i++) {
        if (this.layers[i].name == layerName) {
          //コピーを返す
          return this.layers[i].data.concat();
        }
      }
      return null;
    },

    //オブジェクトグループを取得（指定が無い場合、全レイヤーを配列にして返す）
    getObjectGroup: function(groupName) {
      groupName = groupName || null;
      const ls = [];
      const len = this.layers.length;
      for (let i = 0; i < len; i++) {
        if (this.layers[i].type == "objectgroup") {
          if (groupName == null || groupName == this.layers[i].name) {
            //レイヤー情報をクローンする
            const obj = this._cloneObjectLayer(this.layers[i]);
            if (groupName !== null) return obj;
            ls.push(obj);
          }
        }
      }
      return ls;
    },

    //オブジェクトレイヤーをクローンして返す
    _cloneObjectLayer: function(srcLayer) {
      const result = {}.$safe(srcLayer);
      result.objects = [];
      //レイヤー内オブジェクトのコピー
      srcLayer.objects.forEach(obj => {
        const resObj = {
          properties: {}.$safe(obj.properties),
        }.$extend(obj);
        if (obj.ellipse) resObj.ellipse = obj.ellipse;
        if (obj.gid) resObj.gid = obj.gid;
        if (obj.polygon) resObj.polygon = obj.polygon.clone();
        if (obj.polyline) resObj.polyline = obj.polyline.clone();
        result.objects.push(resObj);
      });
      return result;
    },

    _parse: function(data) {
      return new Promise(resolve => {
        //タイル属性情報取得
        const map = data.getElementsByTagName('map')[0];
        const attr = this._attrToJSON(map);
        this.$extend(attr);
        this.properties = this._propertiesToJSON(map);

        //タイルセット取得
        this.tilesets = this._parseTilesets(data);
        this.tilesets.sort((a, b) => a.firstgid - b.firstgid);

        //レイヤー取得
        this.layers = this._parseLayers(data);

        //イメージデータ読み込み
        this._checkImage()
          .then(() => {
            //マップイメージ生成
            this.image = this._generateImage();
            resolve();
          });
      })
    },

    //タイルセットのパース
    _parseTilesets: function(xml) {
      const each = Array.prototype.forEach;
      const data = [];
      const tilesets = xml.getElementsByTagName('tileset');
      each.call(tilesets, async tileset => {
        const t = {};
        const attr = this._attrToJSON(tileset);
        if (attr.source) {
          t.isOldFormat = false;
          t.source = this.path + attr.source;
        } else {
          //旧データ形式（未対応）
          t.isOldFormat = true;
          t.data = tileset;
        }
        t.firstgid = attr.firstgid;
        data.push(t);
      });
      return data;
    },

    //レイヤー情報のパース
    _parseLayers: function(xml) {
      const each = Array.prototype.forEach;
      const data = [];

      const map = xml.getElementsByTagName("map")[0];
      const layers = [];
      each.call(map.childNodes, elm => {
        if (elm.tagName == "layer" || elm.tagName == "objectgroup" || elm.tagName == "imagelayer") {
          layers.push(elm);
        }
      });

      layers.each(layer => {
        switch (layer.tagName) {
          case "layer":
            {
              //通常レイヤー
              const d = layer.getElementsByTagName('data')[0];
              const encoding = d.getAttribute("encoding");
              const l = {
                  type: "layer",
                  name: layer.getAttribute("name"),
              };

              if (encoding == "csv") {
                  l.data = this._parseCSV(d.textContent);
              } else if (encoding == "base64") {
                  l.data = this._parseBase64(d.textContent);
              }

              const attr = this._attrToJSON(layer);
              l.$extend(attr);
              l.properties = this._propertiesToJSON(layer);

              data.push(l);
            }
            break;

          //オブジェクトレイヤー
          case "objectgroup":
            {
              const l = {
                type: "objectgroup",
                objects: [],
                name: layer.getAttribute("name"),
                x: parseFloat(layer.getAttribute("offsetx")) || 0,
                y: parseFloat(layer.getAttribute("offsety")) || 0,
                alpha: layer.getAttribute("opacity") || 1,
                color: layer.getAttribute("color") || null,
                draworder: layer.getAttribute("draworder") || null,
              };
              each.call(layer.childNodes, elm => {
                if (elm.nodeType == 3) return;
                const d = this._attrToJSON(elm);
                d.properties = this._propertiesToJSON(elm);
                //子要素の解析
                if (elm.childNodes.length) {
                  elm.childNodes.forEach(e => {
                    if (e.nodeType == 3) return;
                    //楕円
                    if (e.nodeName == 'ellipse') {
                      d.ellipse = true;
                    }
                    //多角形
                    if (e.nodeName == 'polygon') {
                      d.polygon = [];
                      const attr = this._attrToJSON_str(e);
                      const pl = attr.points.split(" ");
                      pl.forEach(function(str) {
                        const pts = str.split(",");
                        d.polygon.push({x: parseFloat(pts[0]), y: parseFloat(pts[1])});
                      });
                    }
                    //線分
                    if (e.nodeName == 'polyline') {
                      d.polyline = [];
                      const attr = this._attrToJSON_str(e);
                      const pl = attr.points.split(" ");
                      pl.forEach(str => {
                        const pts = str.split(",");
                        d.polyline.push({x: parseFloat(pts[0]), y: parseFloat(pts[1])});
                      });
                    }
                  });
                }
                l.objects.push(d);
              });
              l.properties = this._propertiesToJSON(layer);

              data.push(l);
            }
            break;

          //イメージレイヤー
          case "imagelayer":
            {
              const l = {
                type: "imagelayer",
                name: layer.getAttribute("name"),
                x: parseFloat(layer.getAttribute("offsetx")) || 0,
                y: parseFloat(layer.getAttribute("offsety")) || 0,
                alpha: layer.getAttribute("opacity") || 1,
                visible: (layer.getAttribute("visible") === undefined || layer.getAttribute("visible") != 0),
              };
              const imageElm = layer.getElementsByTagName("image")[0];
              l.image = {source: imageElm.getAttribute("source")};

              data.push(l);
            }
            break;
          //グループ
          case "group":
            break;
        }
      });
      return data;
    },

    //アセットに無いイメージデータを読み込み
    _checkImage: function() {
      const imageSource = [];
      const loadImage = [];

      //一覧作成
      this.tilesets.forEach(tileset => {
        const obj = {
          isTileset: true,
          image: tileset.source,
        };
        imageSource.push(obj);
      });
      this.layers.forEach(layer => {
        if (layer.image) {
          const obj = {
            isTileset: false,
            image: layer.image.source,
          };
          imageSource.push(obj);
        }
      });

      //アセットにあるか確認
      imageSource.forEach(e => {
        if (e.isTileset) {
          const tsx = phina.asset.AssetManager.get('tsx', e.image);
          if (!tsx) {
            //アセットになかったのでロードリストに追加
            loadImage.push(e);
          }
        } else {
          const image = phina.asset.AssetManager.get('image', e.image);
          if (!image) {
            //アセットになかったのでロードリストに追加
            loadImage.push(e);
          }
        }
      });

      //一括ロード
      //ロードリスト作成
      if (loadImage.length) {
        const assets = { image: [], tsx: [] };
        loadImage.forEach(e => {
          if (e.isTileset) {
            assets.tsx[e.image] = e.image;
          } else {
            //アセットのパスをマップと同じにする
            assets.image[e.image] = this.path + e.image;
          }
        });
        return new Promise(resolve => {
          const loader = phina.asset.AssetLoader();
          loader.load(assets);
          loader.on('load', () => {
            this.tilesets.forEach(e => {
              e.tsx = phina.asset.AssetManager.get('tsx', e.source);
            });
            resolve();
          });
        });
      } else {
        return Promise.resolve();
      }
    },

    //マップイメージ作成
    _generateImage: function(layerName) {
      let numLayer = 0;
      for (let i = 0; i < this.layers.length; i++) {
        if (this.layers[i].type == "layer" || this.layers[i].type == "imagelayer") numLayer++;
      }
      if (numLayer == 0) return null;

      const width = this.width * this.tilewidth;
      const height = this.height * this.tileheight;
      const canvas = phina.graphics.Canvas().setSize(width, height);

      for (let i = 0; i < this.layers.length; i++) {
        //マップレイヤー
        if (this.layers[i].type == "layer" && this.layers[i].visible != "0") {
          if (layerName === undefined || layerName === this.layers[i].name) {
            const layer = this.layers[i];
            const mapdata = layer.data;
            const width = layer.width;
            const height = layer.height;
            const opacity = layer.opacity || 1.0;
            let count = 0;
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const index = mapdata[count];
                if (index !== 0) {
                  //マップチップを配置
                  this._setMapChip(canvas, index, x * this.tilewidth, y * this.tileheight, opacity);
                }
                count++;
              }
            }
          }
        }
        //オブジェクトグループ
        if (this.layers[i].type == "objectgroup" && this.layers[i].visible != "0") {
          if (layerName === undefined || layerName === this.layers[i].name) {
            const layer = this.layers[i];
            const opacity = layer.opacity || 1.0;
            layer.objects.forEach(function(e) {
              if (e.gid) {
                this._setMapChip(canvas, e.gid, e.x, e.y, opacity);
              }
            }.bind(this));
          }
        }
        //イメージレイヤー
        if (this.layers[i].type == "imagelayer" && this.layers[i].visible != "0") {
          if (layerName === undefined || layerName === this.layers[i].name) {
            const image = phina.asset.AssetManager.get('image', this.layers[i].image.source);
            canvas.context.drawImage(image.domElement, this.layers[i].x, this.layers[i].y);
          }
        }
      }

      const texture = phina.asset.Texture();
      texture.domElement = canvas.domElement;
      return texture;
    },

    //キャンバスの指定した座標にマップチップのイメージをコピーする
    _setMapChip: function(canvas, index, x, y, opacity) {
      //対象タイルセットの判別
      let tileset;
      for (let i = 0; i < this.tilesets.length; i++) {
        const tsx1 = this.tilesets[i];
        const tsx2 = this.tilesets[i + 1];
        if (!tsx2) {
          tileset = tsx1;
          i = this.tilesets.length;
        } else if (tsx1.firstgid <= index && index < tsx2.firstgid) {
          tileset = tsx1;
          i = this.tilesets.length;
        }
      }
      //タイルセットからマップチップを取得
      const tsx = tileset.tsx;
      const chip = tsx.chips[index - tileset.firstgid];
      const image = phina.asset.AssetManager.get('image', chip.image);
      canvas.context.drawImage(
        image.domElement,
        chip.x + tsx.margin, chip.y + tsx.margin,
        tsx.tilewidth, tsx.tileheight,
        x, y,
        tsx.tilewidth, tsx.tileheight);
    },

  });

  //ローダーに追加
  phina.asset.AssetLoader.assetLoadFunctions.tmx = function(key, path) {
    const tmx = phina.asset.TiledMap();
    return tmx.load(path);
  };

});
/*
 *  phina.Tileset.js
 *  2019/9/12
 *  @auther minimo  
 *  This Program is MIT license.
 *
 */

phina.namespace(function() {

  phina.define("phina.asset.TileSet", {
    superClass: "phina.asset.XMLLoader",

    image: null,
    tilewidth: 0,
    tileheight: 0,
    tilecount: 0,
    columns: 0,

    init: function(xml) {
        this.superInit();
        if (xml) {
          this.loadFromXML(xml);
        }
    },

    _load: function(resolve) {
      //パス抜き出し
      this.path = "";
      const last = this.src.lastIndexOf("/");
      if (last > 0) {
        this.path = this.src.substring(0, last + 1);
      }

      //終了関数保存
      this._resolve = resolve;

      // load
      const xml = new XMLHttpRequest();
      xml.open('GET', this.src);
      xml.onreadystatechange = () => {
        if (xml.readyState === 4) {
          if ([200, 201, 0].indexOf(xml.status) !== -1) {
            const data = (new DOMParser()).parseFromString(xml.responseText, "text/xml");
            this.dataType = "xml";
            this.data = data;
            this._parse(data)
              .then(() => this._resolve(this));
          }
        }
      };
      xml.send(null);
    },

    loadFromXML: function(xml) {
      return this._parse(xml);
    },

    _parse: function(data) {
      return new Promise(resolve => {
        //タイルセット取得
        const tileset = data.getElementsByTagName('tileset')[0];
        const props = this._propertiesToJSON(tileset);

        //タイルセット属性情報取得
        const attr = this._attrToJSON(tileset);
        attr.$safe({
          tilewidth: 32,
          tileheight: 32,
          spacing: 0,
          margin: 0,
        });
        this.$extend(attr);
        this.chips = [];

        //ソース画像設定取得
        this.imageName = tileset.getElementsByTagName('image')[0].getAttribute('source');
  
        //透過色設定取得
        const trans = tileset.getElementsByTagName('image')[0].getAttribute('trans');
        if (trans) {
          this.transR = parseInt(trans.substring(0, 2), 16);
          this.transG = parseInt(trans.substring(2, 4), 16);
          this.transB = parseInt(trans.substring(4, 6), 16);
        }
  
        //マップチップリスト作成
        for (let r = 0; r < this.tilecount; r++) {
          const chip = {
            image: this.imageName,
            x: (r  % this.columns) * (this.tilewidth + this.spacing) + this.margin,
            y: Math.floor(r / this.columns) * (this.tileheight + this.spacing) + this.margin,
          };
          this.chips[r] = chip;
        }

        //イメージデータ読み込み
        this._loadImage()
          .then(() => resolve());
      });
    },

    //アセットに無いイメージデータを読み込み
    _loadImage: function() {
      return new Promise(resolve => {
        const imageSource = {
          imageName: this.imageName,
          imageUrl: this.path + this.imageName,
          transR: this.transR,
          transG: this.transG,
          transB: this.transB,
        };
        
        let loadImage = null;
        const image = phina.asset.AssetManager.get('image', imageSource.image);
        if (image) {
          this.image = image;
        } else {
          loadImage = imageSource;
        }

        //ロードリスト作成
        const assets = { image: [] };
        assets.image[imageSource.imageName] = imageSource.imageUrl;

        if (loadImage) {
          const loader = phina.asset.AssetLoader();
          loader.load(assets);
          loader.on('load', e => {
            //透過色設定反映
            this.image = phina.asset.AssetManager.get('image', imageSource.imageUrl);
            if (imageSource.transR !== undefined) {
              const r = imageSource.transR;
              const g = imageSource.transG;
              const b = imageSource.transB;
              this.image.filter((pixel, index, x, y, bitmap) => {
                const data = bitmap.data;
                if (pixel[0] == r && pixel[1] == g && pixel[2] == b) {
                    data[index+3] = 0;
                }
              });
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    },
  });

  //ローダーに追加
  phina.asset.AssetLoader.assetLoadFunctions.tsx = function(key, path) {
    const tsx = phina.asset.TileSet();
    return tsx.load(path);
  };

});
//
// 汎用関数群
//
phina.define("Util", {
  _static: {

    //指定されたオブジェクトをルートとして目的のidを走査する
    findById: function(id, obj) {
      if (obj.id === id) return obj;
      const children = Object.keys(obj.children || {}).map(key => obj.children[key]);
      for (let i = 0; i < children.length; i++) {
        const hit = this.findById(id, children[i]);
        if (hit) return hit;
      }
      return null;
    },

    //TODO:ここじゃない感があるのですが、一旦実装
    //指定されたAとBのassetsの連想配列を新規のオブジェクトにマージする
    mergeAssets: function(assetsA, assetsB) {
      const result = {};
      assetsA.forIn((typeKey, typeValue) => {
        if (!result.$has(typeKey)) result[typeKey] = {};
        typeValue.forIn((assetKey, assetPath) => {
          result[typeKey][assetKey] = assetPath;
        });
      });
      assetsB.forIn((typeKey, typeValue) => {
        if (!result.$has(typeKey)) result[typeKey] = {};
        typeValue.forIn((assetKey, assetPath) => {
          result[typeKey][assetKey] = assetPath;
        });
      });
      return result;
    },

    //現在時間から指定時間までどのくらいかかるかを返却する
    //
    // output : { 
    //   totalDate:0 , 
    //   totalHour:0 , 
    //   totalMinutes:0 , 
    //   totalSeconds:0 ,
    //   date:0 , 
    //   hour:0 , 
    //   minutes:0 , 
    //   seconds:0 
    // }
    //

    calcRemainingTime: function(finish) {
      const now = new Date();
      const result = {
        "totalDate": 0,
        "totalHour": 0,
        "totalMinutes": 0,
        "totalSeconds": 0,
        "date": 0,
        "hour": 0,
        "minutes": 0,
        "seconds": 0,
      }

      finish = (finish instanceof Date) ? finish : new Date(finish);
      let diff = finish - now;
      if (diff === 0) return result;

      const sign = (diff < 0) ? -1 : 1;

      //TODO:この辺りもう少し綺麗に書けないか検討
      //単位別 1未満は0
      result["totalDate"] = parseInt(diff / 1000 / 60 / 60 / 24);
      result["totalHour"] = parseInt(diff / 1000 / 60 / 60);
      result["totalMinutes"] = parseInt(diff / 1000 / 60);
      result["totalSeconds"] = parseInt(diff / 1000);

      diff -= result["totalDate"] * 86400000;
      result["hour"] = parseInt(diff / 1000 / 60 / 60);

      diff -= result["hour"] * 3600000;
      result["minutes"] = parseInt(diff / 1000 / 60);

      diff -= result["minutes"] * 60000;
      result["seconds"] = parseInt(diff / 1000);

      return result;

    },

    //レイアウトエディターではSprite全てAtalsSpriteになってしまうため、
    //Spriteに差し替えられるようにする

    //AtlasSprite自身に単発のImageをセットできるようにする？
    //あとでなにかしら対策しないとだめだが３月納品では一旦これで
    replaceAtlasSpriteToSprite: function(parent, atlasSprite, sprite) {
      const index = parent.getChildIndex(atlasSprite);
      sprite.setOrigin(atlasSprite.originX, atlasSprite.originY);
      sprite.setPosition(atlasSprite.x, atlasSprite.y);
      parent.addChildAt(sprite, index);
      atlasSprite.remove();
      return sprite;
    },
  }
});

/*
 *  phina.xmlloader.js
 *  2019/9/12
 *  @auther minimo  
 *  This Program is MIT license.
 *
 */

phina.namespace(function() {

  phina.define("phina.asset.XMLLoader", {
    superClass: "phina.asset.Asset",

    init: function() {
        this.superInit();
    },

    _load: function(resolve) {
      resolve();
    },

    //XMLプロパティをJSONに変換
    _propertiesToJSON: function(elm) {
      const properties = elm.getElementsByTagName("properties")[0];
      const obj = {};
      if (properties === undefined) return obj;

      for (let k = 0; k < properties.childNodes.length; k++) {
        const p = properties.childNodes[k];
        if (p.tagName === "property") {
          //propertyにtype指定があったら変換
          const type = p.getAttribute('type');
          const value = p.getAttribute('value');
          if (!value) value = p.textContent;
          if (type == "int") {
            obj[p.getAttribute('name')] = parseInt(value, 10);
          } else if (type == "float") {
            obj[p.getAttribute('name')] = parseFloat(value);
          } else if (type == "bool" ) {
            if (value == "true") obj[p.getAttribute('name')] = true;
            else obj[p.getAttribute('name')] = false;
          } else {
            obj[p.getAttribute('name')] = value;
          }
        }
      }
      return obj;
    },

    //XML属性をJSONに変換
    _attrToJSON: function(source) {
      const obj = {};
      for (let i = 0; i < source.attributes.length; i++) {
        let val = source.attributes[i].value;
        val = isNaN(parseFloat(val))? val: parseFloat(val);
        obj[source.attributes[i].name] = val;
      }
      return obj;
    },

    //XML属性をJSONに変換（Stringで返す）
    _attrToJSON_str: function(source) {
      const obj = {};
      for (let i = 0; i < source.attributes.length; i++) {
        const val = source.attributes[i].value;
        obj[source.attributes[i].name] = val;
      }
      return obj;
    },

    //CSVパース
    _parseCSV: function(data) {
      const dataList = data.split(',');
      const layer = [];

      dataList.each(elm => {
        const num = parseInt(elm, 10);
        layer.push(num);
      });

      return layer;
    },

    /**
     * BASE64パース
     * http://thekannon-server.appspot.com/herpity-derpity.appspot.com/pastebin.com/75Kks0WH
     * @private
     */
    _parseBase64: function(data) {
      const dataList = atob(data.trim());
      const rst = [];

      dataList = dataList.split('').map(e => e.charCodeAt(0));

      for (let i = 0, len = dataList.length / 4; i < len; ++i) {
        const n = dataList[i*4];
        rst[i] = parseInt(n, 10);
      }

      return rst;
    },
  });

});
phina.asset.AssetLoader.prototype.load = function(params) {
  var self = this;
  var loadAssets = [];
  var counter = 0;
  var length = 0;
  var maxConnectionCount = 2;

  params.forIn(function(type, assets) {
    length += Object.keys(assets).length;
  });

  if (length == 0) {
    return phina.util.Flow.resolve().then(function() {
      self.flare('load');
    });
  }

  params.forIn(function(type, assets) {
    assets.forIn(function(key, value) {
      loadAssets.push({
        "func": phina.asset.AssetLoader.assetLoadFunctions[type],
        "key": key,
        "value": value,
        "type": type,
      });
    });
  });

  if (self.cache) {
    self.on('progress', function(e) {
      if (e.progress >= 1.0) {
        params.forIn(function(type, assets) {
          assets.forIn(function(key, value) {
            var asset = phina.asset.AssetManager.get(type, key);
            if (asset.loadError) {
              var dummy = phina.asset.AssetManager.get(type, 'dummy');
              if (dummy) {
                if (dummy.loadError) {
                  dummy.loadDummy();
                  dummy.loadError = false;
                }
                phina.asset.AssetManager.set(type, key, dummy);
              } else {
                asset.loadDummy();
              }
            }
          });
        });
      }
    });
  }

  var loadAssetsArray = [];

  while (loadAssets.length > 0) {
    loadAssetsArray.push(loadAssets.splice(0, maxConnectionCount));
  }

  var flow = phina.util.Flow.resolve();

  loadAssetsArray.forEach(function(loadAssets) {
    flow = flow.then(function() {
      var flows = [];
      loadAssets.forEach(function(loadAsset) {
        var f = loadAsset.func(loadAsset.key, loadAsset.value);
        f.then(function(asset) {
          if (self.cache) {
            phina.asset.AssetManager.set(loadAsset.type, loadAsset.key, asset);
          }
          self.flare('progress', {
            key: loadAsset.key,
            asset: asset,
            progress: (++counter / length),
          });
        });
        flows.push(f);
      });
      return phina.util.Flow.all(flows);
    });
  });

  return flow.then(function(args) {
    self.flare('load');
  });
}

phina.namespace(function() {

  phina.app.BaseApp.prototype.$method("replaceScene", function(scene) {
    this.flare('replace');
    this.flare('changescene');

    while (this._scenes.length > 0) {
      const scene = this._scenes.pop();
      scene.flare("destroy");
    }

    this._sceneIndex = 0;

    if (this.currentScene) {
      this.currentScene.app = null;
    }

    this.currentScene = scene;
    this.currentScene.app = this;
    this.currentScene.flare('enter', {
      app: this,
    });

    return this;
  });

  phina.app.BaseApp.prototype.$method("popScene", function() {
    this.flare('pop');
    this.flare('changescene');

    var scene = this._scenes.pop();
    --this._sceneIndex;

    scene.flare('exit', {
      app: this,
    });
    scene.flare('destroy');
    scene.app = null;

    this.flare('poped');

    // 
    this.currentScene.flare('resume', {
      app: this,
      prevScene: scene,
    });

    return scene;
  });

});

phina.namespace(function() {

  phina.graphics.Canvas.prototype.$method("init", function(canvas) {
    this.isCreateCanvas = false;
    if (typeof canvas === 'string') {
      this.canvas = document.querySelector(canvas);
    } else {
      if (canvas) {
        this.canvas = canvas;
      } else {
        this.canvas = document.createElement('canvas');
        this.isCreateCanvas = true;
        // console.log('#### create canvas ####');
      }
    }

    this.domElement = this.canvas;
    this.context = this.canvas.getContext('2d');
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
  });

  phina.graphics.Canvas.prototype.$method('destroy', function(canvas) {
    if (!this.isCreateCanvas) return;
    // console.log(`#### delete canvas ${this.canvas.width} x ${this.canvas.height} ####`);
    this.setSize(0, 0);
    delete this.canvas;
    delete this.domElement;
  });

});

phina.namespace(() => {

  var qualityScale = phina.geom.Matrix33();

  phina.display.CanvasRenderer.prototype.$method("render", function(scene, quality) {
    this.canvas.clear();
    if (scene.backgroundColor) {
      this.canvas.clearColor(scene.backgroundColor);
    }

    this._context.save();
    this.renderChildren(scene, quality);
    this._context.restore();
  });

  phina.display.CanvasRenderer.prototype.$method("renderChildren", function(obj, quality) {
    // 子供たちも実行
    if (obj.children.length > 0) {
      var tempChildren = obj.children.slice();
      for (var i = 0, len = tempChildren.length; i < len; ++i) {
        this.renderObject(tempChildren[i], quality);
      }
    }
  });

  phina.display.CanvasRenderer.prototype.$method("renderObject", function(obj, quality) {
    if (obj.visible === false && !obj.interactive) return;

    obj._calcWorldMatrix && obj._calcWorldMatrix();

    if (obj.visible === false) return;

    obj._calcWorldAlpha && obj._calcWorldAlpha();

    var context = this.canvas.context;

    context.globalAlpha = obj._worldAlpha;
    context.globalCompositeOperation = obj.blendMode;

    if (obj._worldMatrix) {

      qualityScale.identity();

      qualityScale.m00 = quality || 1.0;
      qualityScale.m11 = quality || 1.0;

      var m = qualityScale.multiply(obj._worldMatrix);
      context.setTransform(m.m00, m.m10, m.m01, m.m11, m.m02, m.m12);

    }

    if (obj.clip) {

      context.save();

      obj.clip(this.canvas);
      context.clip();

      if (obj.draw) obj.draw(this.canvas);

      // 子供たちも実行
      if (obj.renderChildBySelf === false && obj.children.length > 0) {
        var tempChildren = obj.children.slice();
        for (var i = 0, len = tempChildren.length; i < len; ++i) {
          this.renderObject(tempChildren[i], quality);
        }
      }

      context.restore();
    } else {
      if (obj.draw) obj.draw(this.canvas);

      // 子供たちも実行
      if (obj.renderChildBySelf === false && obj.children.length > 0) {
        var tempChildren = obj.children.slice();
        for (var i = 0, len = tempChildren.length; i < len; ++i) {
          this.renderObject(tempChildren[i], quality);
        }
      }

    }
  });

});

phina.namespace(() => {
  //ユーザーエージェントからブラウザタイプの判別を行う
  phina.$method('checkBrowser', function() {
    const result = {};
    const agent = window.navigator.userAgent.toLowerCase();;

    result.isChrome = (agent.indexOf('chrome') !== -1) && (agent.indexOf('edge') === -1) && (agent.indexOf('opr') === -1);
    result.isEdge = (agent.indexOf('edge') !== -1);
    result.isIe11 = (agent.indexOf('trident/7') !== -1);
    result.isFirefox = (agent.indexOf('firefox') !== -1);
    result.isSafari = (agent.indexOf('safari') !== -1) && (agent.indexOf('chrome') === -1);
    result.isElectron = (agent.indexOf('electron') !== -1);

    result.isWindows = (agent.indexOf('windows') !== -1);
    result.isMac = (agent.indexOf('mac os x') !== -1);

    result.isiPad = agent.indexOf('ipad') > -1 || ua.indexOf('macintosh') > -1 && 'ontouchend' in document;
    result.isiOS = agent.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('macintosh') > -1 && 'ontouchend' in document;

    return result;
  });
});

//==================================================
//  Extension phina.display.DisplayElement
//==================================================
phina.namespace(() => {
  phina.display.DisplayElement.prototype.$method("enable", function() {
    this.show().wakeUp();
    return this;
  });

  phina.display.DisplayElement.prototype.$method("disable", function() {
    this.hide().sleep();
    return this;
  });
});

phina.namespace(() => {
  phina.display.DisplayScene.quality = 1.0;
  phina.display.DisplayScene.prototype.$method("init", function(params) {
    this.superInit();
    var quality = phina.display.DisplayScene.quality;

    params = ({}).$safe(params, phina.display.DisplayScene.defaults);
    this.canvas = phina.graphics.Canvas();
    this.canvas.setSize(params.width * quality, params.height * quality);
    this.renderer = phina.display.CanvasRenderer(this.canvas);
    this.backgroundColor = (params.backgroundColor) ? params.backgroundColor : null;

    this.width = params.width;
    this.height = params.height;
    this.gridX = phina.util.Grid(params.width, 16);
    this.gridY = phina.util.Grid(params.height, 16);

    this.interactive = true;
    this.setInteractive = function(flag) {
      this.interactive = flag;
    };
    this._overFlags = {};
    this._touchFlags = {};
  });

});

phina.namespace(function() {

  // audio要素で音声を再生する。主にIE用
  phina.define("phina.asset.DomAudioSound", {
    superClass: "phina.asset.Asset",

    domElement: null,
    emptySound: false,

    init: function() {
      this.superInit();
    },

    _load: function(resolve) {
      this.domElement = document.createElement("audio");
      if (this.domElement.canPlayType("audio/mpeg")) {
        setTimeout(function readystateCheck() {
          if (this.domElement.readyState < 4) {
            setTimeout(readystateCheck.bind(this), 10);
          } else {
            this.emptySound = false;
            console.log("end load ", this.src);
            resolve(this)
          }
        }.bind(this), 10);
        this.domElement.onerror = function(e) {
          console.error("オーディオのロードに失敗", e);
        };
        this.domElement.src = this.src;
        console.log("begin load ", this.src);
        this.domElement.load();
        this.domElement.autoplay = false;
        this.domElement.addEventListener("ended", function() {
          this.flare("ended");
        }.bind(this));
      } else {
        console.log("mp3は再生できません");
        this.emptySound = true;
        resolve(this);
      }
    },

    play: function() {
      if (this.emptySound) return;
      this.domElement.pause();
      this.domElement.currentTime = 0;
      this.domElement.play();
    },

    stop: function() {
      if (this.emptySound) return;
      this.domElement.pause();
      this.domElement.currentTime = 0;
    },

    pause: function() {
      if (this.emptySound) return;
      this.domElement.pause();
    },

    resume: function() {
      if (this.emptySound) return;
      this.domElement.play();
    },

    setLoop: function(v) {
      if (this.emptySound) return;
      this.domElement.loop = v;
    },

    _accessor: {
      volume: {
        get: function() {
          if (this.emptySound) return 0;
          return this.domElement.volume;
        },
        set: function(v) {
          if (this.emptySound) return;
          this.domElement.volume = v;
        },
      },
      loop: {
        get: function() {
          if (this.emptySound) return false;
          return this.domElement.loop;
        },
        set: function(v) {
          if (this.emptySound) return;
          this.setLoop(v);
        },
      },

    },
  });

  // IE11の場合のみ音声アセットはDomAudioSoundで再生する
  var ua = window.navigator.userAgent.toLowerCase();
  if (ua.indexOf('trident/7') !== -1) {
    phina.asset.AssetLoader.register("sound", function(key, path) {
      var asset = phina.asset.DomAudioSound();
      return asset.load(path);
    });
  }

});

phina.namespace(() => {

  phina.app.Element.prototype.$method("findById", function(id) {
    if (this.id === id) {
      return this;
    } else {
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].findById(id)) {
          return this.children[i];
        }
      }
      return null;
    }
  });

  //指定された子オブジェクトを最前面に移動する
  phina.app.Element.prototype.$method("moveFront", function(child) {
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i] == child) {
        this.children.splice(i, 1);
        break;
      }
    }
    this.children.push(child);
    return this;
  });

  phina.app.Element.prototype.$method("destroyChild", function() {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].flare('destroy');
    }
    return this;
  });

});

phina.namespace(() => {

  phina.input.Input.quality = 1.0;

  phina.input.Input.prototype.$method("_move", function(x, y) {
    this._tempPosition.x = x;
    this._tempPosition.y = y;

    // adjust scale
    var elm = this.domElement;
    var rect = elm.getBoundingClientRect();

    var w = elm.width / phina.input.Input.quality;
    var h = elm.height / phina.input.Input.quality;

    if (rect.width) {
      this._tempPosition.x *= w / rect.width;
    }

    if (rect.height) {
      this._tempPosition.y *= h / rect.height;
    }

  });

});

phina.namespace(() => {
  phina.display.Label.prototype.$method("init", function(options) {
    if (typeof arguments[0] !== 'object') {
      options = { text: arguments[0], };
    } else {
      options = arguments[0];
    }

    options = ({}).$safe(options, phina.display.Label.defaults);
    this.superInit(options);

    this.text = (options.text) ? options.text : "";
    this.fontSize = options.fontSize;
    this.fontWeight = options.fontWeight;
    this.fontFamily = options.fontFamily;
    this.align = options.align;
    this.baseline = options.baseline;
    this.lineHeight = options.lineHeight;
  });

});

phina.namespace(() => {
  phina.input.Mouse.prototype.init = function(domElement) {
    this.superInit(domElement);

    this.id = 0;

    var self = this;
    this.domElement.addEventListener('mousedown', function(e) {
      self._start(e.pointX, e.pointY, 1 << e.button);
      e.preventDefault();
      e.stopPropagation();
    });

    this.domElement.addEventListener('mouseup', function(e) {
      self._end(1 << e.button);
      e.preventDefault();
      e.stopPropagation();
    });
    this.domElement.addEventListener('mousemove', function(e) {
      self._move(e.pointX, e.pointY);
      e.preventDefault();
      e.stopPropagation();
    });

    // マウスがキャンバス要素の外に出た場合の対応
    this.domElement.addEventListener('mouseout', function(e) {
      self._end(1);
    });
  }
});

//==================================================
//  Extension phina.app.Object2D
//==================================================

phina.namespace(() => {
  phina.app.Object2D.prototype.$method("setOrigin", function(x, y, reposition) {
    if (!reposition) {
      this.origin.x = x;
      this.origin.y = y;
      return this;
    }

    //変更された基準点に移動させる
    const _originX = this.originX;
    const _originY = this.originY;
    const _addX = (x - _originX) * this.width;
    const _addY = (y - _originY) * this.height;

    this.x += _addX;
    this.y += _addY;
    this.originX = x;
    this.originY = y;

    this.children.forEach(child => {
      child.x -= _addX;
      child.y -= _addY;
    });
    return this;
  });

  phina.app.Object2D.prototype.$method("hitTestElement", function(elm) {
    const rect0 = this.calcGlobalRect();
    const rect1 = elm.calcGlobalRect();
    return (rect0.left < rect1.right) && (rect0.right > rect1.left) &&
      (rect0.top < rect1.bottom) && (rect0.bottom > rect1.top);
  });

  phina.app.Object2D.prototype.$method("includeElement", function(elm) {
    const rect0 = this.calcGlobalRect();
    const rect1 = elm.calcGlobalRect();
    return (rect0.left <= rect1.left) && (rect0.right >= rect1.right) &&
      (rect0.top <= rect1.top) && (rect0.bottom >= rect1.bottom);
  });

  phina.app.Object2D.prototype.$method("calcGlobalRect", function() {
    const left = this._worldMatrix.m02 - this.originX * this.width;
    const top = this._worldMatrix.m12 - this.originY * this.height;
    return Rect(left, top, this.width, this.height);
  });

  phina.app.Object2D.prototype.$method("calcGlobalRect", function() {
    const left = this._worldMatrix.m02 - this.originX * this.width;
    const top = this._worldMatrix.m12 - this.originY * this.height;
    return Rect(left, top, this.width, this.height);
  });

});

phina.namespace(function() {

  phina.display.PlainElement.prototype.$method("destroyCanvas", function() {
    if (!this.canvas) return;
    this.canvas.destroy();
    delete this.canvas;
  });

});

//==================================================
//  Extension phina.display.Shape
//==================================================
phina.display.Shape.prototype.render = function(canvas) {
  if (!canvas) {
    console.log("canvas null");
    return;
  }
  var context = canvas.context;
  // リサイズ
  var size = this.calcCanvasSize();
  canvas.setSize(size.width, size.height);
  // クリアカラー
  canvas.clearColor(this.backgroundColor);
  // 中心に座標を移動
  canvas.transformCenter();

  // 描画前処理
  this.prerender(this.canvas);

  // ストローク描画
  if (this.isStrokable()) {
    context.strokeStyle = this.stroke;
    context.lineWidth = this.strokeWidth;
    context.lineJoin = "round";
    context.shadowBlur = 0;
    this.renderStroke(canvas);
  }

  // 塗りつぶし描画
  if (this.fill) {
    context.fillStyle = this.fill;
    // shadow の on/off
    if (this.shadow) {
      context.shadowColor = this.shadow;
      context.shadowBlur = this.shadowBlur;
      context.shadowOffsetX = this.shadowOffsetX || 0;
      context.shadowOffsetY = this.shadowOffsetY || 0;
    } else {
      context.shadowBlur = 0;
    }
    this.renderFill(canvas);
  }

  // 描画後処理
  this.postrender(this.canvas);

  return this;
};

phina.namespace(function() {

  phina.asset.Sound.prototype.$method("_load", function(resolve) {
    if (/^data:/.test(this.src)) {
      this._loadFromURIScheme(resolve);
    } else {
      this._loadFromFile(resolve);
    }
  });

  phina.asset.Sound.prototype.$method("_loadFromFile", function(resolve) {
    // console.log(this.src);
    var self = this;
    var xml = new XMLHttpRequest();
    xml.open('GET', this.src);
    xml.onreadystatechange = function() {
      if (xml.readyState === 4) {
        if ([200, 201, 0].indexOf(xml.status) !== -1) {
          // 音楽バイナリーデータ
          var data = xml.response;
          // webaudio 用に変換
          // console.log(data)
          self.context.decodeAudioData(data, function(buffer) {
            self.loadFromBuffer(buffer);
            resolve(self);
          }, function() {
            console.warn("音声ファイルのデコードに失敗しました。(" + self.src + ")");
            resolve(self);
            self.flare('decodeerror');
          });
        } else if (xml.status === 404) {
          // not found
          self.loadError = true;
          self.notFound = true;
          resolve(self);
          self.flare('loaderror');
          self.flare('notfound');
        } else {
          // サーバーエラー
          self.loadError = true;
          self.serverError = true;
          resolve(self);
          self.flare('loaderror');
          self.flare('servererror');
        }
        xml.onreadystatechange = null;
      }
    };

    xml.responseType = 'arraybuffer';

    xml.send(null);
  });

  phina.asset.Sound.prototype.$method("play", function(when, offset, duration) {
    when = when ? when + this.context.currentTime : 0;
    offset = offset || 0;

    var source = this.source = this.context.createBufferSource();
    var buffer = source.buffer = this.buffer;
    source.loop = this._loop;
    source.loopStart = this._loopStart;
    source.loopEnd = this._loopEnd;
    source.playbackRate.value = this._playbackRate;

    // connect
    source.connect(this.gainNode);
    this.gainNode.connect(phina.asset.Sound.getMasterGain());
    // play
    if (duration !== undefined) {
      source.start(when, offset, duration);
    } else {
      source.start(when, offset);
    }

    source.onended = function() {
      if (!source) {
        this.flare('ended');
        return;
      }
      source.onended = null;
      source.disconnect();
      source.buffer = null;
      source = null;
      this.flare('ended');
    }.bind(this);

    return this;
  });

  phina.asset.Sound.prototype.$method("stop", function() {
    // stop
    if (this.source) {
      // stop すると source.endedも発火する
      this.source.stop && this.source.stop(0);
      this.flare('stop');
    }

    return this;
  });

});

//==================================================
//  Extension phina.asset.SoundManager
//==================================================
SoundManager.$method("getVolume", function() {
  return !this.isMute() ? this.volume : 0;
});

SoundManager.$method("getVolumeMusic", function() {
  return !this.isMute() ? this.musicVolume : 0;
});

SoundManager.$method("setVolumeMusic", function(volume) {
  this.musicVolume = volume;
  if (!this.isMute() && this.currentMusic) {
    this.currentMusic.volume = volume;
  }
  return this;
});

SoundManager.$method("playMusic", function(name, fadeTime, loop, when, offset, duration) {
  // const res = phina.checkBrowser();
  // if (res.isIe11) return null;

  loop = (loop !== undefined) ? loop : true;

  if (this.currentMusic) {
    this.stopMusic(fadeTime);
  }

  var music = null;
  if (name instanceof phina.asset.Sound || name instanceof phina.asset.DomAudioSound) {
    music = name;
  } else {
    music = phina.asset.AssetManager.get('sound', name);
  }

  if (!music) {
    console.error("Sound not found: ", name);
    return null;
  }

  music.setLoop(loop);
  music.play(when, offset, duration);

  if (fadeTime > 0) {
    var count = 32;
    var counter = 0;
    var unitTime = fadeTime / count;
    var volume = this.getVolumeMusic();

    music.volume = 0;
    var id = setInterval(function() {
      counter += 1;
      var rate = counter / count;
      music.volume = rate * volume;

      if (rate >= 1) {
        clearInterval(id);
        return false;
      }

      return true;
    }, unitTime);
  } else {
    music.volume = this.getVolumeMusic();
  }

  this.currentMusic = music;

  return this.currentMusic;
});

//==================================================
// ボイス用の音量設定、再生メソッド拡張
SoundManager.$method("getVolumeVoice", function() {
  return !this.isMute() ? this.voiceVolume : 0;
});

SoundManager.$method("setVolumeVoice", function(volume) {
  this.voiceVolume = volume;
  return this;
});

SoundManager.$method("playVoice", function(name) {
  var sound = phina.asset.AssetManager.get('sound', name);
  sound.volume = this.getVolumeVoice();
  sound.play();
  return sound;
});

//スプライト機能拡張
phina.namespace(function() {

  phina.display.Sprite.prototype.setFrameTrimming = function(x, y, width, height) {
    this._frameTrimX = x || 0;
    this._frameTrimY = y || 0;
    this._frameTrimWidth = width || this.image.domElement.width - this._frameTrimX;
    this._frameTrimHeight = height || this.image.domElement.height - this._frameTrimY;
    return this;
  }

  phina.display.Sprite.prototype.setFrameIndex = function(index, width, height) {
    var sx = this._frameTrimX || 0;
    var sy = this._frameTrimY || 0;
    var sw = this._frameTrimWidth  || (this.image.domElement.width-sx);
    var sh = this._frameTrimHeight || (this.image.domElement.height-sy);

    var tw  = width || this.width;      // tw
    var th  = height || this.height;    // th
    var row = ~~(sw / tw);
    var col = ~~(sh / th);
    var maxIndex = row*col;
    index = index%maxIndex;

    var x   = index%row;
    var y   = ~~(index/row);
    this.srcRect.x = sx+x*tw;
    this.srcRect.y = sy+y*th;
    this.srcRect.width  = tw;
    this.srcRect.height = th;

    this._frameIndex = index;

    return this;
  }

});
phina.namespace(function() {
  // 文字列から数値を抽出する
  // レイアウトファイルから作業する場合に利用したくなる
  // hoge_0 hoge_1などから数字だけ抽出
  // 0100_hoge_9999 => ["0100" , "9999"]になる
  // hoge0.0とかはどうすかな？
  // 抽出後にparseIntするかは検討中
  String.prototype.$method("matchInt", function() {
    return this.match(/[0-9]+/g);
  });
});

phina.namespace(function() {

  phina.asset.Texture.prototype.$method("_load", function(resolve) {
    this.domElement = new Image();

    var isLocal = (location.protocol == 'file:');
    if (!(/^data:/.test(this.src))) {
      this.domElement.crossOrigin = 'anonymous'; // クロスオリジン解除
    }

    var self = this;
    this.domElement.onload = function(e) {
      self.loaded = true;
      e.target.onload = null;
      e.target.onerror = null;
      resolve(self);
    };

    this.domElement.onerror = function(e) {
      e.target.onload = null;
      e.target.onerror = null;
      console.error("phina.asset.Texture _load onError ", this.src);
    };

    this.domElement.src = this.src;
  });

});

phina.namespace(function() {

  phina.accessory.Tweener.prototype.$method("_updateTween", function(app) {
    //※これないとpauseがうごかない
    if (!this.playing) return;

    var tween = this._tween;
    var time = this._getUnitTime(app);

    tween.forward(time);
    this.flare('tween');

    if (tween.time >= tween.duration) {
      delete this._tween;
      this._tween = null;
      this._update = this._updateTask;
    }
  });

  phina.accessory.Tweener.prototype.$method("_updateWait", function(app) {
    //※これないとpauseがうごかない
    if (!this.playing) return;

    var wait = this._wait;
    var time = this._getUnitTime(app);
    wait.time += time;

    if (wait.time >= wait.limit) {
      delete this._wait;
      this._wait = null;
      this._update = this._updateTask;
    }
  });

});

phina.define("AfterBanner", {
  superClass: 'phina.accessory.Accessory',

  init: function(target) {
    this.superInit(target);
    this.offset = Vector2(0, 0);
    this.before = null;
  },

  setOffset: function (x, y) {
    if (x instanceof Vector2) {
      this.offset.set(x.x, y.x);
      return this;
    }
    this.offset.set(x, y);
    return this;
  },

  update: function() {
    const target = this.target;
    const options = { scale: 0.3 * target.speed || 1};
    const pos = target.position.clone().add(this.offset);
    if (this.before) {
      const dis = unit.position.distance(this.before);
      const numSplit = Math.max(Math.floor(dis / 3), 6);
      const unitSplit = (1 / numSplit);
      numSplit.times(i => {
        const per = unitSplit * i;
        const pPos = Vector2(pos.x * per + this.before.x * (1 - per), pos.y * per + this.before.y * (1 - per))
        const p = ParticleSprite(options)
          .setPosition(pPos.x, pPos.y)
          .addChildTo(target.world.mapLayer[LAYER_EFFECT_BACK]);
      });
    } else {
      this.before = Vector2();
    }
    this.before.set(pos.x, pos.y);
  },
});

phina.define("Particle", {
  superClass: 'phina.display.CircleShape',

  _static: {
    defaultColor: {
      start: 10, // color angle の開始値
      end: 30,   // color angle の終了値
    },
    defaulScale: 1,     // 初期スケール
    scaleDecay: 0.03,  // スケールダウンのスピード
  },
  init: function(options) {
    this.options = (options || {}).$safe({ stroke: false, radius: 24, scale: 1.0 });
    this.superInit(this.options);

    this.blendMode = 'lighter';

    const color = this.options.color || Particle.defaultColor;
    const grad = this.canvas.context.createRadialGradient(0, 0, 0, 0, 0, this.radius);
    grad.addColorStop(0, 'hsla({0}, 75%, 50%, 1.0)'.format(Math.randint(color.start, color.end)));
    grad.addColorStop(1, 'hsla({0}, 75%, 50%, 0.0)'.format(Math.randint(color.start, color.end)));

    this.fill = grad;

    this.beginPosition = Vector2();
    this.velocity = this.options.velocity || Vector2(0, 0);
    this.one("enterframe", () => this.reset());
  },

  reset: function(x, y) {
    x = x || this.x;
    y = y || this.y;
    this.beginPosition.set(x, y);
    this.position.set(this.beginPosition.x, this.beginPosition.y);
    this.scaleX = this.scaleY = this.options.scale || Math.randfloat(Particle.defaulScale * 0.8, Particle.defaulScale * 1.2);
  },

  update: function() {
    this.position.add(this.velocity);
    this.velocity.x *= 0.99;
    this.velocity.y *= 0.99;
    this.scaleX -= Particle.scaleDecay;
    this.scaleY -= Particle.scaleDecay;

    if (this.scaleX < 0) this.remove();
  },

  setVelocity: function(x, y) {
    if (x instanceof Vector2) {
      this.velocity = x;
      return this;
    }
    this.velocity.x = x;
    this.velocity.x = y;
    return this;
  },

});

phina.define("ParticleSprite", {
  superClass: 'phina.display.Sprite',

  _static: {
    defaultScale: 1.0,    // 初期スケール
    scaleDecay: 0.01,  // スケールダウンのスピード
  },
  init: function(options) {
    this.options = (options || {}).$safe({ stroke: false, radius: 24, scale: 1.0 });
    this.superInit("particle", 16, 16);

    this.blendMode = 'lighter';

    this.beginPosition = Vector2();
    this.velocity = this.options.velocity || Vector2(0, 0);
    this.one("enterframe", () => this.reset());
  },

  reset: function(x, y) {
    x = x || this.x;
    y = y || this.y;
    this.beginPosition.set(x, y);
    this.position.set(this.beginPosition.x, this.beginPosition.y);
    this.scaleX = this.scaleY = this.options.scale || Math.randfloat(ParticleSprite.defaulScale * 0.8, ParticleSprite.defaulScale * 1.2);
    this.scaleDecay = this.options.scaleDecay || ParticleSprite.scaleDecay;
  },

  update: function() {
    this.position.add(this.velocity);
    this.velocity.x *= 0.99;
    this.velocity.y *= 0.99;
    this.scaleX -= this.scaleDecay;
    this.scaleY -= this.scaleDecay;

    if (this.scaleX < 0) this.remove();
  },

  setVelocity: function(x, y) {
    if (x instanceof Vector2) {
      this.velocity = x;
      return this;
    }
    this.velocity.x = x;
    this.velocity.x = y;
    return this;
  },

});

phina.namespace(function() {

  phina.define('World', {
    superClass: 'DisplayElement',

    init: function(options) {
      this.superInit();
      this.setup();

      this.time = 0;
    },

    setup: function() {
      this.mapBase = DisplayElement()
        .setPosition(0, 0)
        .addChildTo(this);

      //レイヤー構築
      this.mapLayer = [];
      (NUM_LAYERS).times(i => {
        const layer = DisplayElement().addChildTo(this.mapBase);
        this.mapLayer[i] = layer;
      });

      this.player = Player({ world: this })
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF)
        .addChildTo(this.mapLayer[LAYER_PLAYER]);

      this.setupMap();
    },
    update: function() {
      this.controlPlayer();

      const player = this.player;
      this.mapBase.x = SCREEN_WIDTH_HALF  - player.x - player.velocity.x * 3;
      this.mapBase.y = SCREEN_HEIGHT_HALF - player.y - player.velocity.y * 3;

      this.time++;
    },
    setupMap: function() {
      for (let i = 0; i < 1000; i++) {
        RectangleShape({
          width: Math.randint(50, 200),
          height: Math.randint(50, 200),
          fill: 'blue',
          stroke: '#aaa',
          strokeWidth: 4,
          cornerRadius: 0,
          x: Math.randint(-10000, 10000),
          y: Math.randint(-5000, 5000),
        }).addChildTo(this.mapLayer[LAYER_BACKGROUND]);
      }
    },

    controlPlayer: function() {
      const player = this.player;
      var ct = phina_app.controller;
      if (this.time % 3 == 0) {
        if (ct.left) {
          player.direction++;
          if (player.direction > 15) player.direction = 0;
        } else if (ct.right) {
          player.direction--;
          if (player.direction < 0) player.direction = 15;
        }
        player.sprite.setFrameIndex(player.direction);
        if (ct.up) {
          player.speed += 0.1;
          if (player.speed > 1) player.speed = 1;
          const rad = (player.direction * 22.5).toRadian();
          player.velocity.x += -Math.sin(rad) * player.speed;
          player.velocity.y += -Math.cos(rad) * player.speed;
          if (player.velocity.length > 2) {
            player.velocity.normalize();
            player.velocity.mul(2);
          }
        } else {
          player.speed *= 0.98;
        }
      }

      //下に落ちる
      if (!ct.up) player.velocity.y += 0.1;

      player.position.add(player.velocity);
      player.velocity.mul(0.99);

      //アフターバーナー
      if (ct.up) {
        const rad = (this.player.direction * 22.5).toRadian();
        this.enterAfterBanner(this.player, Vector2(Math.sin(rad) * 8, Math.cos(rad) * 8));
      } else {
        this.player.before = null;
      }
    },

    enterAfterBanner: function(unit, offset) {
      offset = offset || Vector2(0, 0);
      const options = { scale: 0.3 * unit.speed };
      const pos = unit.position.clone().add(offset);
      if (unit.before) {
        const dis = unit.position.distance(unit.before);
        const numSplit = Math.max(Math.floor(dis / 3), 6);
        const unitSplit = (1 / numSplit);
        numSplit.times(i => {
          const per = unitSplit * i;
          const pPos = Vector2(pos.x * per + unit.before.x * (1 - per), pos.y * per + unit.before.y * (1 - per))
          const p = ParticleSprite(options)
            .setPosition(pPos.x, pPos.y)
            .addChildTo(this.mapLayer[LAYER_EFFECT_BACK]);
        });
      } else {
        unit.before = Vector2();
      }
      unit.before.set(pos.x, pos.y);
  },
  });

});

phina.define("Bullet", {
  superClass: 'phina.display.DisplayElement',

  init: function(options) {
    this.superInit(options);
  },

});


phina.define("Laser", {
  superClass: 'phina.display.DisplayElement',

  _static: {
    defaultOptions: {
      length: 1000,
    },
  },

  init: function(options) {
    this.options = (options || {}).$safe(Laser.defaultOptions);
    this.superInit(options);
    this.sprite = RectangleShape({ width: 8, height: this.options.length }).addChildTo(this);
  },

});


phina.namespace(function() {

  phina.define('Player', {
    superClass: 'BaseUnit',

    speed: 0,

    init: function() {
      this.superInit({ width: 32, height: 32 });

      this.sprite = Sprite("fighter", 32, 32)
        .setFrameIndex(0)
        .addChildTo(this.base);
    },
  });
});

//
// シーンエフェクトの基礎クラス
//
phina.define("SceneEffectBase", {
  superClass: "InputIntercept",

  init: function() {
    this.superInit();
    this.enable();
  },

});

//
// シーンエフェクト：複数の円でフェードインアウト
//
phina.define("SceneEffectCircleFade", {
  superClass: "SceneEffectBase",

  init: function(options) {
    this.options = ({}).$safe(options, SceneEffectCircleFade.defaults);

    this.superInit();
  },

  _createCircle: function() {
    const num = 5;
    const width = SCREEN_WIDTH / num;
    return Array.range((SCREEN_HEIGHT / width) + 1).map(y => {
      return Array.range(num + 1).map(x => {
        return this.addChild(CircleShape({
          x: x * width,
          y: y * width,
          fill: this.options.color,
          stroke: null,
          radius: width * 0.5,
        }));
      });
    });
  },

  begin: function() {
    const circles = this._createCircle();
    const tasks = [];
    circles.forEach((xLine, y) => {
      xLine.forEach((circle, x) => {
        circle.scaleX = 0;
        circle.scaleY = 0;
        tasks.push(new Promise(resolve => {
          circle.tweener.clear()
            .to({
              scaleX: 1.5,
              scaleY: 1.5
            }, 500, "easeOutQuad")
            .call(() => {
              circle.remove();
              circle.destroyCanvas();
              this.children.clear();
              this.disable();
              resolve()
            });
        }));
      });
    });
    return Promise.all(tasks);
  },

  finish: function() {
    this.children.clear();

    const circles = this._createCircle();
    const tasks = [];
    circles.forEach(xLine => {
      xLine.forEach(circle => {
        circle.scaleX = 1.5;
        circle.scaleY = 1.5;
        tasks.push(new Promise(resolve => {
          circle.tweener.clear()
            .to({
              scaleX: 0,
              scaleY: 0
            }, 500, "easeOutQuad")
            .call(() => {
              circle.remove();
              circle.destroyCanvas();
              this.children.clear();
              this.disable();
              resolve();
            });
        }));
      });
    });
    return Promise.all(tasks);
  },

  _static: {
    defaults: {
      color: "white",
    }
  }

});

//
// シーンエフェクト：フェードインアウト
//
phina.define("SceneEffectFade", {
  superClass: "SceneEffectBase",

  init: function(options) {
    this.options = ({}).$safe(options, {
      color: "black",
      time: 500,
    });

    this.superInit();
    this.fromJSON({
      children: {
        fade: {
          className: "RectangleShape",
          arguments: {
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            fill: this.options.color,
            stroke: null,
            padding: 0,
          },
          x: SCREEN_WIDTH * 0.5,
          y: SCREEN_HEIGHT * 0.5,
        },
      }
    });
  },

  stay: function() {
    const fade = this.fade;
    fade.alpha = 1.0;
    return Promise.resolve();
  },

  begin: function() {
    return new Promise(resolve => {
      const fade = this.fade;
      fade.alpha = 1.0;
      fade.tweener.clear()
        .fadeOut(this.options.time)
        .call(() => {
          //1Frame描画されてしまってちらつくのでenterframeで削除
          this.one("enterframe", () => {
            this.fade.remove();
            this.fade.destroyCanvas();
            this.remove()
          });
          resolve();
        });
    });
  },

  finish: function() {
    return new Promise(resolve => {
      const fade = this.fade;
      fade.alpha = 0.0;
      fade.tweener.clear()
        .fadeIn(this.options.time)
        .call(() => {
          this.flare("finish");
          //1Frame描画されてしまってちらつくのでenterframeで削除
          this.one("enterframe", () => {
            this.fade.remove();
            this.fade.destroyCanvas();
            this.remove()
          });
          resolve();
        });
    });
  },

  _static: {
    defaults: {
      color: "black",
    }
  }

});

//
// シーンエフェクト：なにもしない
//
phina.define("SceneEffectNone", {
  superClass: "SceneEffectBase",

  init: function() {
    this.superInit();
  },

  begin: function() {
    return new Promise(resolve => {
      this.one("enterframe", () => this.remove());
      resolve();
    });
  },

  finish: function() {
    return new Promise(resolve => {
      this.one("enterframe", () => this.remove());
      resolve();
    });
  }

});

//
// シーンエフェクト：タイルフェード
//
phina.define("SceneEffectTileFade", {
  superClass: "SceneEffectBase",

  tiles: null,
  num: 15,
  speed: 50,

  init: function(options) {
    this.superInit();
    this.options = ({}).$safe(options, {
      color: "black",
      width: 768,
      height: 1024,
    });

    this.tiles = this._createTiles();
  },

  _createTiles: function() {
    const width = Math.floor(this.options.width / this.num);

    return Array.range((this.options.height / width) + 1).map(y => {
      return Array.range(this.num + 1).map(x => {
        return this.addChild(RectangleShape({
          width: width + 2,
          height: width + 2,
          x: x * width,
          y: y * width,
          fill: this.options.color,
          stroke: null,
          strokeWidth: 0,
        }));
      });
    });
  },

  stay: function() {
    this.tiles.forEach((xline, y) => {
      xline.forEach((tile, x) => {
        tile.scaleX = 1.0;
        tile.scaleY = 1.0;
      });
    });
    return Promise.resolve();
  },

  begin: function() {
    const tasks = [];
    this.tiles.forEach((xline, y) => {
      const w = Math.randfloat(0, 1) * this.speed;
      xline.forEach((tile, x) => {
        tile.scaleX = 1.0;
        tile.scaleY = 1.0;
        tasks.push(new Promise(resolve => {
          tile.tweener.clear()
            .wait(x * this.speed + w)
            .to({
              scaleX: 0,
              scaleY: 0
            }, 500, "easeOutQuad")
            .call(() => {
              tile.remove();
              tile.destroyCanvas();
              resolve()
            });
        }));
      });
    });
    return Promise.all(tasks)
  },

  finish: function() {
    const tasks = [];
    this.tiles.forEach((xline, y) => {
      const w = Math.randfloat(0, 1) * this.speed;
      xline.forEach((tile, x) => {
        tile.scaleX = 0.0;
        tile.scaleY = 0.0;
        tasks.push(new Promise(resolve => {
          tile.tweener.clear()
            .wait((xline.length - x) * this.speed + w)
            .to({
              scaleX: 1,
              scaleY: 1
            }, 500, "easeOutQuad")
            .call(() => {
              tile.remove();
              tile.destroyCanvas();
              resolve()
            });
        }));
      });
    });
    return Promise.all(tasks)
  },

  _static: {
    defaults: {
      color: "black",
    }
  }

});

//
// クリックやタッチをインターセプトする
//
phina.define("InputIntercept", {
  superClass: "DisplayElement",

  init: function() {
    this.superInit();

    this.on("added", () => {
      //親に対して覆いかぶせる
      this.width = this.parent.width;
      this.height = this.parent.height;
      this.originX = this.parent.originX || 0;
      this.originY = this.parent.originY || 0;
      this.x = 0;
      this.y = 0;
    });
    this.disable();
  },

  enable: function() {
    this.setInteractive(true);
  },

  disable: function() {
    this.setInteractive(false);
  },

});

phina.namespace(function() {

  let dummyTexture = null;

  phina.define("SpriteLabel", {
    superClass: "DisplayElement",

    _text: null,
    table: null,
    fixWidth: 0,

    sprites: null,

    init: function(options) {
      if (!dummyTexture) {
        dummyTexture = Canvas().setSize(1, 1);
      }

      this.superInit(options);
      this.table = options.table;
      this.fixWidth = options.fixWidth || 0;

      this.sprites = [];

      this.setText("");
    },

    setText: function(text) {
      this._text = text;

      const chars = this.text.split("");

      if (this.sprites.length < chars.length) {
        Array.range(0, this.sprites.length - chars.length).forEach(() => {
          this.sprites.push(Sprite(dummyTexture));
        });
      } else {
        Array.range(0, chars.length - this.sprites.length).forEach(() => {
          this.sprites.last.remove();
          this.sprites.length -= 1;
        });
      }

      this._text.split("").map((c, i) => {
        this.sprites[i]
          .setImage(this.table[c])
          .setOrigin(this.originX, this.originY)
          .addChildTo(this);
      });

      const totalWidth = this.sprites.reduce((w, s) => w + (this.fixWidth || s.width), 0);
      const totalHeight = this.sprites.map(_ => _.height).sort().last;

      let x = totalWidth * -this.originX;
      this.sprites.forEach((s) => {
        const width = this.fixWidth || s.width;
        s.x = x + width * s.originX;
        x += width;
      });

      return this;
    },

    _accessor: {
      text: {
        get: function() {
          return this._text;
        },
        set: function(v) {
          this.setText(v);
        },
      },
    },

  });

});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCIwMTBfYXBwbGljYXRpb24vQXBwbGljYXRpb24uanMiLCIwMTBfYXBwbGljYXRpb24vQXNzZXRMaXN0LmpzIiwiMDEwX2FwcGxpY2F0aW9uL0Jhc2VTY2VuZS5qcyIsIjAxMF9hcHBsaWNhdGlvbi9GaXJzdFNjZW5lRmxvdy5qcyIsIjAyMF9zY2VuZS9tYWluc2NlbmUuanMiLCIwMjBfc2NlbmUvdGl0bGVzY2VuZS5qcyIsIjAzMF9iYXNlL0Jhc2VVbml0LmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvQnV0dG9uLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvQ2xpcFNwcml0ZS5qcyIsIjAwMF9jb21tb24vYWNjZXNzb3J5L0dhdWdlLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvR3JheXNjYWxlLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvTW91c2VDaGFzZXIuanMiLCIwMDBfY29tbW9uL2FjY2Vzc29yeS9NdWx0aVJlY3RhbmdsZUNsaXAuanMiLCIwMDBfY29tbW9uL2FjY2Vzc29yeS9QaWVDbGlwLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvUmVjdGFuZ2xlQ2xpcC5qcyIsIjAwMF9jb21tb24vYWNjZXNzb3J5L1RvZ2dsZS5qcyIsIjAwMF9jb21tb24vdXRpbC9CdXR0b25pemUuanMiLCIwMDBfY29tbW9uL3V0aWwvVGV4dHVyZVV0aWwuanMiLCIwMDBfY29tbW9uL3V0aWwvVGlsZWRtYXAuanMiLCIwMDBfY29tbW9uL3V0aWwvVGlsZXNldC5qcyIsIjAwMF9jb21tb24vdXRpbC9VdGlsLmpzIiwiMDAwX2NvbW1vbi91dGlsL3htbGxvYWRlci5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9Bc3NldExvYWRlci5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9CYXNlQXBwLmpzIiwiMDAwX2NvbW1vbi9leHRlbnNpb25zL0NhbnZhcy5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9DYW52YXNSZW5kZXJlci5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9DaGVja0Jyb3dzZXIuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvRGlzcGxheUVsZW1lbnQuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvRGlzcGxheVNjZW5lLmpzIiwiMDAwX2NvbW1vbi9leHRlbnNpb25zL0RvbUF1ZGlvU291bmQuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvRWxlbWVudC5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9JbnB1dC5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9MYWJlbC5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9Nb3VzZS5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9PYmplY3QyRC5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9QbGFpbkVsZW1lbnQuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvU2hhcGUuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvU291bmQuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvU291bmRNYW5hZ2VyLmpzIiwiMDAwX2NvbW1vbi9leHRlbnNpb25zL1Nwcml0ZS5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9TdHJpbmcuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvVGV4dHVyZS5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9Ud2VlbmVyLmpzIiwiMDQwX2VsZW1lbnQvY29tbW9uL0FmdGVyQmFubmVyLmpzIiwiMDQwX2VsZW1lbnQvY29tbW9uL1BhcnRpY2xlLmpzIiwiMDQwX2VsZW1lbnQvY29tbW9uL1BhcnRpY2xlU3ByaXRlLmpzIiwiMDQwX2VsZW1lbnQvd29ybGQvV29ybGQuanMiLCIwNDBfZWxlbWVudC9wbGF5ZXIvQnVsbGV0LmpzIiwiMDQwX2VsZW1lbnQvcGxheWVyL0xhc2VyLmpzIiwiMDQwX2VsZW1lbnQvcGxheWVyL1BsYXllci5qcyIsIjAwMF9jb21tb24vZWxlbWVudHMvc2NlbmVFZmZlY3RzL1NjZW5lRWZmZWN0QmFzZS5qcyIsIjAwMF9jb21tb24vZWxlbWVudHMvc2NlbmVFZmZlY3RzL1NjZW5lRWZmZWN0Q2lyY2xlRmFkZS5qcyIsIjAwMF9jb21tb24vZWxlbWVudHMvc2NlbmVFZmZlY3RzL1NjZW5lRWZmZWN0RmFkZS5qcyIsIjAwMF9jb21tb24vZWxlbWVudHMvc2NlbmVFZmZlY3RzL1NjZW5lRWZmZWN0Tm9uZS5qcyIsIjAwMF9jb21tb24vZWxlbWVudHMvc2NlbmVFZmZlY3RzL1NjZW5lRWZmZWN0VGlsZUZhZGUuanMiLCIwMDBfY29tbW9uL2VsZW1lbnRzL3VpL0lucHV0SW50ZXJjZXB0LmpzIiwiMDAwX2NvbW1vbi9lbGVtZW50cy91aS9TcHJpdGVMYWJlbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNyYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN0R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJidW5kbGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogIG1haW4uanNcbiAqL1xuXG5waGluYS5nbG9iYWxpemUoKTtcblxuY29uc3QgU0NSRUVOX1dJRFRIID0gNTc2O1xuY29uc3QgU0NSRUVOX0hFSUdIVCA9IDMyNDtcbmNvbnN0IFNDUkVFTl9XSURUSF9IQUxGID0gU0NSRUVOX1dJRFRIICogMC41O1xuY29uc3QgU0NSRUVOX0hFSUdIVF9IQUxGID0gU0NSRUVOX0hFSUdIVCAqIDAuNTtcblxuY29uc3QgU0NSRUVOX09GRlNFVF9YID0gMDtcbmNvbnN0IFNDUkVFTl9PRkZTRVRfWSA9IDA7XG5cbmNvbnN0IE5VTV9MQVlFUlMgPSA3O1xuY29uc3QgTEFURVJfRk9SRUdST1VORCA9IDY7XG5jb25zdCBMQVlFUl9FRkZFQ1RfRk9SRSA9IDU7XG5jb25zdCBMQVlFUl9QTEFZRVIgPSA0O1xuY29uc3QgTEFZRVJfRU5FTVkgPSAzO1xuY29uc3QgTEFZRVJfRUZGRUNUX0JBQ0sgPSAyO1xuY29uc3QgTEFZRVJfQkFDS0dST1VORCA9IDE7XG5jb25zdCBMQVlFUl9NQVAgPSAwO1xuXG5sZXQgcGhpbmFfYXBwO1xuXG53aW5kb3cub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gIHBoaW5hX2FwcCA9IEFwcGxpY2F0aW9uKCk7XG4gIHBoaW5hX2FwcC5yZXBsYWNlU2NlbmUoRmlyc3RTY2VuZUZsb3coe30pKTtcbiAgcGhpbmFfYXBwLnJ1bigpO1xufTtcblxuLy/jgrnjgq/jg63jg7zjg6vnpoHmraJcbi8vIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGZ1bmN0aW9uKGUpIHtcbi8vICBlLnByZXZlbnREZWZhdWx0KCk7XG4vLyB9LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG4vL0FuZHJvaWTjg5bjg6njgqbjgrbjg5Djg4Pjgq/jg5zjgr/jg7PliLblvqFcbi8vIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJiYWNrYnV0dG9uXCIsIGZ1bmN0aW9uKGUpe1xuLy8gICBlLnByZXZlbnREZWZhdWx0KCk7XG4vLyB9LCBmYWxzZSk7IiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZShcIkFwcGxpY2F0aW9uXCIsIHtcbiAgICBzdXBlckNsYXNzOiBcInBoaW5hLmRpc3BsYXkuQ2FudmFzQXBwXCIsXG5cbiAgICBxdWFsaXR5OiAxLjAsXG4gIFxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5zdXBlckluaXQoe1xuICAgICAgICBmcHM6IDYwLFxuICAgICAgICB3aWR0aDogU0NSRUVOX1dJRFRILFxuICAgICAgICBoZWlnaHQ6IFNDUkVFTl9IRUlHSFQsXG4gICAgICAgIGZpdDogdHJ1ZSxcbiAgICAgIH0pO1xuICBcbiAgICAgIC8v44K344O844Oz44Gu5bmF44CB6auY44GV44Gu5Z+65pys44KS6Kit5a6aXG4gICAgICBwaGluYS5kaXNwbGF5LkRpc3BsYXlTY2VuZS5kZWZhdWx0cy4kZXh0ZW5kKHtcbiAgICAgICAgd2lkdGg6IFNDUkVFTl9XSURUSCxcbiAgICAgICAgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULFxuICAgICAgfSk7XG4gIFxuICAgICAgcGhpbmEuaW5wdXQuSW5wdXQucXVhbGl0eSA9IHRoaXMucXVhbGl0eTtcbiAgICAgIHBoaW5hLmRpc3BsYXkuRGlzcGxheVNjZW5lLnF1YWxpdHkgPSB0aGlzLnF1YWxpdHk7XG5cbiAgICAgIC8v44Ky44O844Og44OR44OD44OJ566h55CGXG4gICAgICB0aGlzLmdhbWVwYWRNYW5hZ2VyID0gcGhpbmEuaW5wdXQuR2FtZXBhZE1hbmFnZXIoKTtcbiAgICAgIHRoaXMuZ2FtZXBhZCA9IHRoaXMuZ2FtZXBhZE1hbmFnZXIuZ2V0KDApO1xuICAgICAgdGhpcy5jb250cm9sbGVyID0ge307XG5cbiAgICAgIHRoaXMuc2V0dXBFdmVudHMoKTtcbiAgICAgIHRoaXMuc2V0dXBTb3VuZCgpO1xuICAgICAgdGhpcy5zZXR1cE1vdXNlV2hlZWwoKTtcblxuICAgICAgdGhpcy5vbihcImNoYW5nZXNjZW5lXCIsICgpID0+IHtcbiAgICAgICAgLy/jgrfjg7zjg7PjgpLpm6LjgozjgovpmpvjgIHjg5zjgr/jg7PlkIzmmYLmirzjgZfjg5Xjg6njgrDjgpLop6PpmaTjgZnjgotcbiAgICAgICAgQnV0dG9uLmFjdGlvblRhcmdldCA9IG51bGw7XG4gICAgICB9KTtcblxuICAgICAgLy/jg5Hjg4Pjg4nmg4XloLHjgpLmm7TmlrBcbiAgICAgIHRoaXMub24oJ2VudGVyZnJhbWUnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5nYW1lcGFkTWFuYWdlci51cGRhdGUoKTtcbiAgICAgICAgdGhpcy51cGRhdGVDb250cm9sbGVyKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICBcbiAgICAvL+ODnuOCpuOCueOBruODm+ODvOODq+OCpOODmeODs+ODiOmWoumAo1xuICAgIHNldHVwTW91c2VXaGVlbDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLndoZWVsRGVsdGFZID0gMDtcbiAgICAgIHRoaXMuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2V3aGVlbFwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy53aGVlbERlbHRhWSA9IGUuZGVsdGFZO1xuICAgICAgfS5iaW5kKHRoaXMpLCBmYWxzZSk7XG4gIFxuICAgICAgdGhpcy5vbihcImVudGVyZnJhbWVcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMucG9pbnRlci53aGVlbERlbHRhWSA9IHRoaXMud2hlZWxEZWx0YVk7XG4gICAgICAgIHRoaXMud2hlZWxEZWx0YVkgPSAwO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8v44Ki44OX44Oq44Kx44O844K344On44Oz5YWo5L2T44Gu44Kk44OZ44Oz44OI44OV44OD44KvXG4gICAgc2V0dXBFdmVudHM6IGZ1bmN0aW9uKCkge30sXG4gIFxuICAgIHNldHVwU291bmQ6IGZ1bmN0aW9uKCkge30sXG5cbiAgICB1cGRhdGVDb250cm9sbGVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBiZWZvcmUgPSB0aGlzLmNvbnRyb2xsZXI7XG4gICAgICBiZWZvcmUuYmVmb3JlID0gbnVsbDtcblxuICAgICAgdmFyIGdwID0gdGhpcy5nYW1lcGFkO1xuICAgICAgdmFyIGtiID0gdGhpcy5rZXlib2FyZDtcbiAgICAgIHZhciBhbmdsZTEgPSBncC5nZXRLZXlBbmdsZSgpO1xuICAgICAgdmFyIGFuZ2xlMiA9IGtiLmdldEtleUFuZ2xlKCk7XG4gICAgICB0aGlzLmNvbnRyb2xsZXIgPSB7XG4gICAgICAgICAgYW5nbGU6IGFuZ2xlMSAhPT0gbnVsbD8gYW5nbGUxOiBhbmdsZTIsXG5cbiAgICAgICAgICB1cDogZ3AuZ2V0S2V5KFwidXBcIikgfHwga2IuZ2V0S2V5KFwidXBcIiksXG4gICAgICAgICAgZG93bjogZ3AuZ2V0S2V5KFwiZG93blwiKSB8fCBrYi5nZXRLZXkoXCJkb3duXCIpLFxuICAgICAgICAgIGxlZnQ6IGdwLmdldEtleShcImxlZnRcIikgfHwga2IuZ2V0S2V5KFwibGVmdFwiKSxcbiAgICAgICAgICByaWdodDogZ3AuZ2V0S2V5KFwicmlnaHRcIikgfHwga2IuZ2V0S2V5KFwicmlnaHRcIiksXG5cbiAgICAgICAgICBhdHRhY2s6IGdwLmdldEtleShcIkFcIikgfHwga2IuZ2V0S2V5KFwiWFwiKSxcbiAgICAgICAgICBqdW1wOiAgIGdwLmdldEtleShcIlhcIikgfHwga2IuZ2V0S2V5KFwiWlwiKSxcbiAgICAgICAgICBtZW51OiAgIGdwLmdldEtleShcInN0YXJ0XCIpIHx8IGtiLmdldEtleShcImVzY2FwZVwiKSxcblxuICAgICAgICAgIGE6IGdwLmdldEtleShcIkFcIikgfHwga2IuZ2V0S2V5KFwiWlwiKSxcbiAgICAgICAgICBiOiBncC5nZXRLZXkoXCJCXCIpIHx8IGtiLmdldEtleShcIlhcIiksXG4gICAgICAgICAgeDogZ3AuZ2V0S2V5KFwiWFwiKSB8fCBrYi5nZXRLZXkoXCJDXCIpLFxuICAgICAgICAgIHk6IGdwLmdldEtleShcIllcIikgfHwga2IuZ2V0S2V5KFwiVlwiKSxcblxuICAgICAgICAgIG9rOiBncC5nZXRLZXkoXCJBXCIpIHx8IGtiLmdldEtleShcIlpcIikgfHwga2IuZ2V0S2V5KFwic3BhY2VcIikgfHwga2IuZ2V0S2V5KFwicmV0dXJuXCIpLFxuICAgICAgICAgIGNhbmNlbDogZ3AuZ2V0S2V5KFwiQlwiKSB8fCBrYi5nZXRLZXkoXCJYXCIpIHx8IGtiLmdldEtleShcImVzY2FwZVwiKSxcblxuICAgICAgICAgIHN0YXJ0OiBncC5nZXRLZXkoXCJzdGFydFwiKSB8fCBrYi5nZXRLZXkoXCJyZXR1cm5cIiksXG4gICAgICAgICAgc2VsZWN0OiBncC5nZXRLZXkoXCJzZWxlY3RcIiksXG5cbiAgICAgICAgICBwYXVzZTogZ3AuZ2V0S2V5KFwic3RhcnRcIikgfHwga2IuZ2V0S2V5KFwiZXNjYXBlXCIpLFxuXG4gICAgICAgICAgYW5hbG9nMTogZ3AuZ2V0U3RpY2tEaXJlY3Rpb24oMCksXG4gICAgICAgICAgYW5hbG9nMjogZ3AuZ2V0U3RpY2tEaXJlY3Rpb24oMSksXG5cbiAgICAgICAgICAvL+WJjeODleODrOODvOODoOaDheWgsVxuICAgICAgICAgIGJlZm9yZTogYmVmb3JlLFxuICAgICAgfTtcbiAgfSxcbn0pO1xuICBcbn0pOyIsIi8qXG4gKiAgQXNzZXRMaXN0LmpzXG4gKi9cblxucGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZShcIkFzc2V0TGlzdFwiLCB7XG4gICAgX3N0YXRpYzoge1xuICAgICAgbG9hZGVkOiBbXSxcbiAgICAgIGlzTG9hZGVkOiBmdW5jdGlvbihhc3NldFR5cGUpIHtcbiAgICAgICAgcmV0dXJuIEFzc2V0TGlzdC5sb2FkZWRbYXNzZXRUeXBlXT8gdHJ1ZTogZmFsc2U7XG4gICAgICB9LFxuICAgICAgZ2V0OiBmdW5jdGlvbihhc3NldFR5cGUpIHtcbiAgICAgICAgQXNzZXRMaXN0LmxvYWRlZFthc3NldFR5cGVdID0gdHJ1ZTtcbiAgICAgICAgc3dpdGNoIChhc3NldFR5cGUpIHtcbiAgICAgICAgICBjYXNlIFwicHJlbG9hZFwiOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgaW1hZ2U6IHtcbiAgICAgICAgICAgICAgICBcImZpZ2h0ZXJcIjogXCJhc3NldHMvdGV4dHVyZXMvZmlnaHRlci5wbmdcIixcbiAgICAgICAgICAgICAgICBcInBhcnRpY2xlXCI6IFwiYXNzZXRzL3RleHR1cmVzL3BhcnRpY2xlLnBuZ1wiLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyB0bXg6IHtcbiAgICAgICAgICAgICAgLy8gICBcIm1hcDFcIjogXCJhc3NldHMvbWFwL21hcDIudG14XCIsXG4gICAgICAgICAgICAgIC8vIH0sXG4gICAgICAgICAgICAgIC8vIHRzeDoge1xuICAgICAgICAgICAgICAvLyAgIFwidGlsZV9hXCI6IFwiYXNzZXRzL21hcC90aWxlX2EudHN4XCIsXG4gICAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgY2FzZSBcImNvbW1vblwiOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgaW1hZ2U6IHtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgXCJpbnZhbGlkIGFzc2V0VHlwZTogXCIgKyBvcHRpb25zLmFzc2V0VHlwZTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxufSk7XG4iLCIvKlxuICogIE1haW5TY2VuZS5qc1xuICogIDIwMTgvMTAvMjZcbiAqL1xuXG5waGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuZGVmaW5lKFwiQmFzZVNjZW5lXCIsIHtcbiAgICBzdXBlckNsYXNzOiAnRGlzcGxheVNjZW5lJyxcblxuICAgIC8v5buD5qOE44Ko44Os44Oh44Oz44OIXG4gICAgZGlzcG9zZUVsZW1lbnRzOiBudWxsLFxuXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IChvcHRpb25zIHx8IHt9KS4kc2FmZSh7XG4gICAgICAgIHdpZHRoOiBTQ1JFRU5fV0lEVEgsXG4gICAgICAgIGhlaWdodDogU0NSRUVOX0hFSUdIVCxcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiAndHJhbnNwYXJlbnQnLFxuICAgICAgfSk7XG4gICAgICB0aGlzLnN1cGVySW5pdChvcHRpb25zKTtcblxuICAgICAgLy/jgrfjg7zjg7Ppm6LohLHmmYJjYW52YXPjg6Hjg6Ljg6rop6PmlL5cbiAgICAgIHRoaXMuZGlzcG9zZUVsZW1lbnRzID0gW107XG4gICAgICB0aGlzLm9uZSgnZGVzdHJveScsICgpID0+IHtcbiAgICAgICAgdGhpcy5kaXNwb3NlRWxlbWVudHMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgICBpZiAoZS5kZXN0cm95Q2FudmFzKSB7XG4gICAgICAgICAgICBlLmRlc3Ryb3lDYW52YXMoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGUgaW5zdGFuY2VvZiBDYW52YXMpIHtcbiAgICAgICAgICAgIGUuc2V0U2l6ZSgwLCAwKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuYXBwID0gcGhpbmFfYXBwO1xuXG4gICAgICAvL+WIpeOCt+ODvOODs+OBuOOBruenu+ihjOaZguOBq+OCreODo+ODs+ODkOOCueOCkuegtOajhFxuICAgICAgdGhpcy5vbmUoJ2V4aXQnLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmNhbnZhcy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuZmxhcmUoJ2Rlc3Ryb3knKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJFeGl0IHNjZW5lLlwiKTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBkZXN0cm95OiBmdW5jdGlvbigpIHt9LFxuXG4gICAgZmFkZUluOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gKG9wdGlvbnMgfHwge30pLiRzYWZlKHtcbiAgICAgICAgY29sb3I6IFwid2hpdGVcIixcbiAgICAgICAgbWlsbGlzZWNvbmQ6IDUwMCxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBjb25zdCBtYXNrID0gUmVjdGFuZ2xlU2hhcGUoe1xuICAgICAgICAgIHdpZHRoOiBTQ1JFRU5fV0lEVEgsXG4gICAgICAgICAgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULFxuICAgICAgICAgIGZpbGw6IG9wdGlvbnMuY29sb3IsXG4gICAgICAgICAgc3Ryb2tlV2lkdGg6IDAsXG4gICAgICAgIH0pLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSCAqIDAuNSwgU0NSRUVOX0hFSUdIVCAqIDAuNSkuYWRkQ2hpbGRUbyh0aGlzKTtcbiAgICAgICAgbWFzay50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAuZmFkZU91dChvcHRpb25zLm1pbGxpc2Vjb25kKVxuICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLm9uZSgnZW50ZXJmcmFtZScsICgpID0+IG1hc2suZGVzdHJveUNhbnZhcygpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBmYWRlT3V0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gKG9wdGlvbnMgfHwge30pLiRzYWZlKHtcbiAgICAgICAgY29sb3I6IFwid2hpdGVcIixcbiAgICAgICAgbWlsbGlzZWNvbmQ6IDUwMCxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBjb25zdCBtYXNrID0gUmVjdGFuZ2xlU2hhcGUoe1xuICAgICAgICAgIHdpZHRoOiBTQ1JFRU5fV0lEVEgsXG4gICAgICAgICAgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULFxuICAgICAgICAgIGZpbGw6IG9wdGlvbnMuY29sb3IsXG4gICAgICAgICAgc3Ryb2tlV2lkdGg6IDAsXG4gICAgICAgIH0pLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSCAqIDAuNSwgU0NSRUVOX0hFSUdIVCAqIDAuNSkuYWRkQ2hpbGRUbyh0aGlzKTtcbiAgICAgICAgbWFzay5hbHBoYSA9IDA7XG4gICAgICAgIG1hc2sudHdlZW5lci5jbGVhcigpXG4gICAgICAgICAgLmZhZGVJbihvcHRpb25zLm1pbGxpc2Vjb25kKVxuICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLm9uZSgnZW50ZXJmcmFtZScsICgpID0+IG1hc2suZGVzdHJveUNhbnZhcygpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvL+OCt+ODvOODs+mbouiEseaZguOBq+egtOajhOOBmeOCi1NoYXBl44KS55m76YyyXG4gICAgcmVnaXN0RGlzcG9zZTogZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgdGhpcy5kaXNwb3NlRWxlbWVudHMucHVzaChlbGVtZW50KTtcbiAgICB9LFxuICB9KTtcblxufSk7IiwiLypcbiAqICBGaXJzdFNjZW5lRmxvdy5qc1xuICovXG5cbnBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kZWZpbmUoXCJGaXJzdFNjZW5lRmxvd1wiLCB7XG4gICAgc3VwZXJDbGFzczogXCJNYW5hZ2VyU2NlbmVcIixcblxuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgc3RhcnRMYWJlbCA9IG9wdGlvbnMuc3RhcnRMYWJlbCB8fCBcInRpdGxlXCI7XG4gICAgICB0aGlzLnN1cGVySW5pdCh7XG4gICAgICAgIHN0YXJ0TGFiZWw6IHN0YXJ0TGFiZWwsXG4gICAgICAgIHNjZW5lczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBcInRpdGxlXCIsXG4gICAgICAgICAgICBjbGFzc05hbWU6IFwiVGl0bGVTY2VuZVwiLFxuICAgICAgICAgICAgbmV4dExhYmVsOiBcImhvbWVcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBcIm1haW5cIixcbiAgICAgICAgICAgIGNsYXNzTmFtZTogXCJNYWluU2NlbmVcIixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxufSk7IiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZSgnTWFpblNjZW5lJywge1xuICAgIHN1cGVyQ2xhc3M6ICdCYXNlU2NlbmUnLFxuXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICAgIHRoaXMuc2V0dXAoKTtcbiAgICB9LFxuXG4gICAgc2V0dXA6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3QgYmFjayA9IFJlY3RhbmdsZVNoYXBlKHsgd2lkdGg6IFNDUkVFTl9XSURUSCwgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULCBmaWxsOiBcImJsYWNrXCIgfSlcbiAgICAgICAgLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSF9IQUxGLCBTQ1JFRU5fSEVJR0hUX0hBTEYpXG4gICAgICAgIC5hZGRDaGlsZFRvKHRoaXMpO1xuICAgICAgdGhpcy5yZWdpc3REaXNwb3NlKGJhY2spO1xuXG4gICAgICB0aGlzLndvcmxkID0gV29ybGQoKS5hZGRDaGlsZFRvKHRoaXMpO1xuICAgIH0sXG5cbiAgICB1cGRhdGU6IGZ1bmN0aW9uKCkge1xuICAgIH0sXG5cbiAgfSk7XG5cbn0pO1xuIiwiLypcbiAqICBUaXRsZVNjZW5lLmpzXG4gKi9cblxucGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZSgnVGl0bGVTY2VuZScsIHtcbiAgICBzdXBlckNsYXNzOiAnQmFzZVNjZW5lJyxcblxuICAgIF9zdGF0aWM6IHtcbiAgICAgIGlzQXNzZXRMb2FkOiBmYWxzZSxcbiAgICB9LFxuXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgdGhpcy5zdXBlckluaXQoKTtcblxuICAgICAgdGhpcy51bmxvY2sgPSBmYWxzZTtcbiAgICAgIHRoaXMubG9hZGNvbXBsZXRlID0gZmFsc2U7XG4gICAgICB0aGlzLnByb2dyZXNzID0gMDtcblxuICAgICAgLy/jg63jg7zjg4nmuIjjgb/jgarjgonjgqLjgrvjg4Pjg4jjg63jg7zjg4njgpLjgZfjgarjgYRcbiAgICAgIGlmIChUaXRsZVNjZW5lLmlzQXNzZXRMb2FkKSB7XG4gICAgICAgIHRoaXMuc2V0dXAoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vcHJlbG9hZCBhc3NldFxuICAgICAgICBjb25zdCBhc3NldHMgPSBBc3NldExpc3QuZ2V0KFwicHJlbG9hZFwiKVxuICAgICAgICB0aGlzLmxvYWRlciA9IHBoaW5hLmFzc2V0LkFzc2V0TG9hZGVyKCk7XG4gICAgICAgIHRoaXMubG9hZGVyLmxvYWQoYXNzZXRzKTtcbiAgICAgICAgdGhpcy5sb2FkZXIub24oJ2xvYWQnLCAoKSA9PiB0aGlzLnNldHVwKCkpO1xuICAgICAgICBUaXRsZVNjZW5lLmlzQXNzZXRMb2FkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgc2V0dXA6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3QgYmFjayA9IFJlY3RhbmdsZVNoYXBlKHsgd2lkdGg6IFNDUkVFTl9XSURUSCwgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULCBmaWxsOiBcImJsYWNrXCIgfSlcbiAgICAgICAgLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSF9IQUxGLCBTQ1JFRU5fSEVJR0hUX0hBTEYpXG4gICAgICAgIC5hZGRDaGlsZFRvKHRoaXMpO1xuICAgICAgdGhpcy5yZWdpc3REaXNwb3NlKGJhY2spO1xuXG4gICAgICBjb25zdCBsYWJlbCA9IExhYmVsKHsgdGV4dDogXCJUaXRsZVNjZW5lXCIsIGZpbGw6IFwid2hpdGVcIiB9KVxuICAgICAgICAuc2V0UG9zaXRpb24oU0NSRUVOX1dJRFRIX0hBTEYsIFNDUkVFTl9IRUlHSFRfSEFMRilcbiAgICAgICAgLmFkZENoaWxkVG8odGhpcyk7XG4gICAgICB0aGlzLnJlZ2lzdERpc3Bvc2UobGFiZWwpO1xuXG4gICAgICB0aGlzLm9uZSgnbmV4dHNjZW5lJywgKCkgPT4gdGhpcy5leGl0KFwibWFpblwiKSk7XG4gICAgICB0aGlzLmZsYXJlKCduZXh0c2NlbmUnKTtcbiAgICB9LFxuXG4gICAgdXBkYXRlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjdCA9IHBoaW5hX2FwcC5jb250cm9sbGVyO1xuICAgICAgaWYgKGN0LmEpIHtcbiAgICAgICAgdGhpcy5mbGFyZSgnbmV4dHNjZW5lJyk7XG4gICAgICB9XG4gICAgfSxcblxuICB9KTtcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuZGVmaW5lKCdCYXNlVW5pdCcsIHtcbiAgICBzdXBlckNsYXNzOiAnRGlzcGxheUVsZW1lbnQnLFxuXG4gICAgX3N0YXRpYzoge1xuICAgICAgZGVmYXVsdE9wdGlvbnM6IHtcbiAgICAgICAgd29ybGQ6IG51bGwsXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICBzdGF0ZTogbnVsbCxcbiAgICBhbmdsZTogMCxcbiAgICBkaXJlY3Rpb246IDAsXG5cbiAgICBzcHJpdGU6IG51bGwsXG5cbiAgICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICB0aGlzLnN1cGVySW5pdChvcHRpb25zKTtcbiAgICAgIHRoaXMud29ybGQgPSBvcHRpb25zLndvcmxkIHx8IG51bGw7XG4gICAgICB0aGlzLmJhc2UgPSBEaXNwbGF5RWxlbWVudCgpLmFkZENoaWxkVG8odGhpcyk7XG4gICAgICB0aGlzLnZlbG9jaXR5ID0gVmVjdG9yMigwLCAwKTtcblxuICAgICAgdGhpcy5iZWZvcmUgPSBudWxsO1xuICAgIH0sXG4gIH0pO1xuXG59KTtcbiIsInBoaW5hLmRlZmluZShcIkJ1dHRvblwiLCB7XG4gIHN1cGVyQ2xhc3M6IFwiQWNjZXNzb3J5XCIsXG5cbiAgbG9nbnByZXNzVGltZTogNTAwLFxuICBkb0xvbmdwcmVzczogZmFsc2UsXG5cbiAgLy/plbfmirzjgZfjgafpgKPmiZPjg6Ljg7zjg4lcbiAgbG9uZ3ByZXNzQmFycmFnZTogZmFsc2UsXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcblxuICAgIHRoaXMub24oXCJhdHRhY2hlZFwiLCAoKSA9PiB7XG4gICAgICB0aGlzLnRhcmdldC5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gICAgICB0aGlzLnRhcmdldC5jbGlja1NvdW5kID0gQnV0dG9uLmRlZmF1bHRzLmNsaWNrU291bmQ7XG5cbiAgICAgIC8v44Oc44K/44Oz5oq844GX5pmC55SoXG4gICAgICB0aGlzLnRhcmdldC5zY2FsZVR3ZWVuZXIgPSBUd2VlbmVyKCkuYXR0YWNoVG8odGhpcy50YXJnZXQpO1xuXG4gICAgICAvL+mVt+aKvOOBl+eUqFxuICAgICAgdGhpcy50YXJnZXQudHdMb25ncHJlc3MgPSBUd2VlbmVyKCkuYXR0YWNoVG8odGhpcy50YXJnZXQpO1xuXG4gICAgICAvL+mVt+aKvOOBl+S4reeJueauiuWvvuW/nOeUqFxuICAgICAgdGhpcy50YXJnZXQudHdMb25ncHJlc3NpbmcgPSBUd2VlbmVyKCkuYXR0YWNoVG8odGhpcy50YXJnZXQpO1xuXG4gICAgICB0aGlzLnRhcmdldC5vbihcInBvaW50c3RhcnRcIiwgKGUpID0+IHtcblxuICAgICAgICAvL+OCpOODmeODs+ODiOiyq+mAmuOBq+OBl+OBpuOBiuOBj1xuICAgICAgICBlLnBhc3MgPSB0cnVlO1xuXG4gICAgICAgIC8v44Oc44K/44Oz44Gu5ZCM5pmC5oq844GX44KS5Yi26ZmQXG4gICAgICAgIGlmIChCdXR0b24uYWN0aW9uVGFyZ2V0ICE9PSBudWxsKSByZXR1cm47XG5cbiAgICAgICAgLy/jg6rjgrnjg4jjg5Pjg6Xjg7zjga7lrZDkvpvjgaDjgaPjgZ/loLTlkIjjga92aWV3cG9ydOOBqOOBruOBguOBn+OCiuWIpOWumuOCkuOBmeOCi1xuICAgICAgICBjb25zdCBsaXN0VmlldyA9IEJ1dHRvbi5maW5kTGlzdFZpZXcoZS50YXJnZXQpO1xuICAgICAgICBpZiAobGlzdFZpZXcgJiYgIWxpc3RWaWV3LnZpZXdwb3J0LmhpdFRlc3QoZS5wb2ludGVyLngsIGUucG9pbnRlci55KSkgcmV0dXJuO1xuXG4gICAgICAgIGlmIChsaXN0Vmlldykge1xuICAgICAgICAgIC8v44Od44Kk44Oz44K/44GM56e75YuV44GX44Gf5aC05ZCI44Gv6ZW35oq844GX44Kt44Oj44Oz44K744Or77yIbGlzdFZpZXflhoXniYjvvIlcbiAgICAgICAgICBsaXN0Vmlldy5pbm5lci4kd2F0Y2goJ3knLCAodjEsIHYyKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy50YXJnZXQgIT09IEJ1dHRvbi5hY3Rpb25UYXJnZXQpIHJldHVybjtcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyh2MSAtIHYyKSA8IDEwKSByZXR1cm47XG5cbiAgICAgICAgICAgIEJ1dHRvbi5hY3Rpb25UYXJnZXQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy50YXJnZXQudHdMb25ncHJlc3MuY2xlYXIoKTtcbiAgICAgICAgICAgIHRoaXMudGFyZ2V0LnNjYWxlVHdlZW5lci5jbGVhcigpLnRvKHtcbiAgICAgICAgICAgICAgc2NhbGVYOiAxLjAgKiB0aGlzLnN4LFxuICAgICAgICAgICAgICBzY2FsZVk6IDEuMCAqIHRoaXMuc3lcbiAgICAgICAgICAgIH0sIDUwKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8v44Oc44K/44Oz44Gu5Yem55CG44KS5a6f6KGM44GX44Gm44KC5ZWP6aGM44Gq44GE5aC05ZCI44Gu44G/6LKr6YCa44KS5YGc5q2i44GZ44KLXG4gICAgICAgIGUucGFzcyA9IGZhbHNlO1xuICAgICAgICBCdXR0b24uYWN0aW9uVGFyZ2V0ID0gdGhpcy50YXJnZXQ7XG5cbiAgICAgICAgLy/lj43ou6LjgZfjgabjgYTjgovjg5zjgr/jg7PnlKjjgavkv53mjIHjgZnjgotcbiAgICAgICAgdGhpcy5zeCA9ICh0aGlzLnRhcmdldC5zY2FsZVggPiAwKSA/IDEgOiAtMTtcbiAgICAgICAgdGhpcy5zeSA9ICh0aGlzLnRhcmdldC5zY2FsZVkgPiAwKSA/IDEgOiAtMTtcblxuICAgICAgICB0aGlzLnRhcmdldC5zY2FsZVR3ZWVuZXIuY2xlYXIoKVxuICAgICAgICAgIC50byh7XG4gICAgICAgICAgICBzY2FsZVg6IDAuOTUgKiB0aGlzLnN4LFxuICAgICAgICAgICAgc2NhbGVZOiAwLjk1ICogdGhpcy5zeVxuICAgICAgICAgIH0sIDUwKTtcblxuICAgICAgICB0aGlzLmRvTG9uZ3ByZXNzID0gZmFsc2U7XG4gICAgICAgIHRoaXMudGFyZ2V0LnR3TG9uZ3ByZXNzLmNsZWFyKClcbiAgICAgICAgICAud2FpdCh0aGlzLmxvZ25wcmVzc1RpbWUpXG4gICAgICAgICAgLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmxvbmdwcmVzc0JhcnJhZ2UpIHtcbiAgICAgICAgICAgICAgQnV0dG9uLmFjdGlvblRhcmdldCA9IG51bGw7XG4gICAgICAgICAgICAgIHRoaXMudGFyZ2V0LnNjYWxlVHdlZW5lci5jbGVhcigpXG4gICAgICAgICAgICAgICAgLnRvKHtcbiAgICAgICAgICAgICAgICAgIHNjYWxlWDogMS4wICogdGhpcy5zeCxcbiAgICAgICAgICAgICAgICAgIHNjYWxlWTogMS4wICogdGhpcy5zeVxuICAgICAgICAgICAgICAgIH0sIDUwKVxuICAgICAgICAgICAgICB0aGlzLnRhcmdldC5mbGFyZShcImxvbmdwcmVzc1wiKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy50YXJnZXQuZmxhcmUoXCJjbGlja1NvdW5kXCIpO1xuICAgICAgICAgICAgICB0aGlzLnRhcmdldC50d0xvbmdwcmVzc2luZy5jbGVhcigpXG4gICAgICAgICAgICAgICAgLndhaXQoNSlcbiAgICAgICAgICAgICAgICAuY2FsbCgoKSA9PiB0aGlzLnRhcmdldC5mbGFyZShcImNsaWNrZWRcIiwge1xuICAgICAgICAgICAgICAgICAgbG9uZ3ByZXNzOiB0cnVlXG4gICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgLmNhbGwoKCkgPT4gdGhpcy50YXJnZXQuZmxhcmUoXCJsb25ncHJlc3NpbmdcIikpXG4gICAgICAgICAgICAgICAgLnNldExvb3AodHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy50YXJnZXQub24oXCJwb2ludGVuZFwiLCAoZSkgPT4ge1xuICAgICAgICAvL+OCpOODmeODs+ODiOiyq+mAmuOBq+OBl+OBpuOBiuOBj1xuICAgICAgICBlLnBhc3MgPSB0cnVlO1xuXG4gICAgICAgIC8vXG4gICAgICAgIHRoaXMudGFyZ2V0LnR3TG9uZ3ByZXNzLmNsZWFyKCk7XG4gICAgICAgIHRoaXMudGFyZ2V0LnR3TG9uZ3ByZXNzaW5nLmNsZWFyKCk7XG5cbiAgICAgICAgLy/jgr/jg7zjgrLjg4Pjg4jjgYxudWxs44GLcG9pbnRzdGFydOOBp+S/neaMgeOBl+OBn+OCv+ODvOOCsuODg+ODiOOBqOmBleOBhuWgtOWQiOOBr+OCueODq+ODvOOBmeOCi1xuICAgICAgICBpZiAoQnV0dG9uLmFjdGlvblRhcmdldCA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICBpZiAoQnV0dG9uLmFjdGlvblRhcmdldCAhPT0gdGhpcy50YXJnZXQpIHJldHVybjtcblxuICAgICAgICAvL+ODnOOCv+ODs+OBruWHpueQhuOCkuWun+ihjOOBl+OBpuOCguWVj+mhjOOBquOBhOWgtOWQiOOBruOBv+iyq+mAmuOCkuWBnOatouOBmeOCi1xuICAgICAgICBlLnBhc3MgPSBmYWxzZTtcblxuICAgICAgICAvL+aKvOOBl+OBn+S9jee9ruOBi+OCieOBguOCi+eoi+W6puenu+WLleOBl+OBpuOBhOOCi+WgtOWQiOOBr+OCr+ODquODg+OCr+OCpOODmeODs+ODiOOCkueZuueUn+OBleOBm+OBquOBhFxuICAgICAgICBjb25zdCBpc01vdmUgPSBlLnBvaW50ZXIuc3RhcnRQb3NpdGlvbi5zdWIoZS5wb2ludGVyLnBvc2l0aW9uKS5sZW5ndGgoKSA+IDUwO1xuICAgICAgICBjb25zdCBoaXRUZXN0ID0gdGhpcy50YXJnZXQuaGl0VGVzdChlLnBvaW50ZXIueCwgZS5wb2ludGVyLnkpO1xuICAgICAgICBpZiAoaGl0VGVzdCAmJiAhaXNNb3ZlKSB0aGlzLnRhcmdldC5mbGFyZShcImNsaWNrU291bmRcIik7XG5cbiAgICAgICAgdGhpcy50YXJnZXQuc2NhbGVUd2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAudG8oe1xuICAgICAgICAgICAgc2NhbGVYOiAxLjAgKiB0aGlzLnN4LFxuICAgICAgICAgICAgc2NhbGVZOiAxLjAgKiB0aGlzLnN5XG4gICAgICAgICAgfSwgNTApXG4gICAgICAgICAgLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgQnV0dG9uLmFjdGlvblRhcmdldCA9IG51bGw7XG4gICAgICAgICAgICBpZiAoIWhpdFRlc3QgfHwgaXNNb3ZlIHx8IHRoaXMuZG9Mb25ncHJlc3MpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMudGFyZ2V0LmZsYXJlKFwiY2xpY2tlZFwiLCB7XG4gICAgICAgICAgICAgIHBvaW50ZXI6IGUucG9pbnRlclxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgLy/jgqLjg4vjg6Hjg7zjgrfjg6fjg7Pjga7mnIDkuK3jgavliYrpmaTjgZXjgozjgZ/loLTlkIjjgavlgpnjgYjjgaZyZW1vdmVk44Kk44OZ44Oz44OI5pmC44Gr44OV44Op44Kw44KS5YWD44Gr5oi744GX44Gm44GK44GPXG4gICAgICB0aGlzLnRhcmdldC5vbmUoXCJyZW1vdmVkXCIsICgpID0+IHtcbiAgICAgICAgaWYgKEJ1dHRvbi5hY3Rpb25UYXJnZXQgPT09IHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgQnV0dG9uLmFjdGlvblRhcmdldCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRhcmdldC5vbihcImNsaWNrU291bmRcIiwgKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMudGFyZ2V0LmNsaWNrU291bmQgfHwgdGhpcy50YXJnZXQuY2xpY2tTb3VuZCA9PSBcIlwiKSByZXR1cm47XG4gICAgICAgIHBoaW5hLmFzc2V0LlNvdW5kTWFuYWdlci5wbGF5KHRoaXMudGFyZ2V0LmNsaWNrU291bmQpO1xuICAgICAgfSk7XG5cbiAgICB9KTtcbiAgfSxcblxuICAvL+mVt+aKvOOBl+OBruW8t+WItuOCreODo+ODs+OCu+ODq1xuICBsb25ncHJlc3NDYW5jZWw6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudGFyZ2V0LnR3TG9uZ3ByZXNzLmNsZWFyKCk7XG4gICAgdGhpcy50YXJnZXQudHdMb25ncHJlc3NpbmcuY2xlYXIoKTtcbiAgfSxcblxuICBfc3RhdGljOiB7XG4gICAgLy/jg5zjgr/jg7PlkIzmmYLmirzjgZfjgpLliLblvqHjgZnjgovjgZ/jgoHjgatzdGF0dXPjga9zdGF0aWPjgavjgZnjgotcbiAgICBzdGF0dXM6IDAsXG4gICAgYWN0aW9uVGFyZ2V0OiBudWxsLFxuICAgIC8v5Z+65pys6Kit5a6aXG4gICAgZGVmYXVsdHM6IHtcbiAgICAgIGNsaWNrU291bmQ6IFwiY29tbW9uL3NvdW5kcy9zZS9idXR0b25cIixcbiAgICB9LFxuXG4gICAgLy/opqrjgpLjgZ/jganjgaPjgaZMaXN0Vmlld+OCkuaOouOBmVxuICAgIGZpbmRMaXN0VmlldzogZnVuY3Rpb24oZWxlbWVudCwgcCkge1xuICAgICAgLy/jg6rjgrnjg4jjg5Pjg6Xjg7zjgpLmjIHjgaPjgabjgYTjgovloLTlkIhcbiAgICAgIGlmIChlbGVtZW50Lkxpc3RWaWV3ICE9IG51bGwpIHJldHVybiBlbGVtZW50Lkxpc3RWaWV3O1xuICAgICAgLy/opqrjgYzjgarjgZHjgozjgbDntYLkuoZcbiAgICAgIGlmIChlbGVtZW50LnBhcmVudCA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICAgIC8v6Kaq44KS44Gf44Gp44KLXG4gICAgICByZXR1cm4gdGhpcy5maW5kTGlzdFZpZXcoZWxlbWVudC5wYXJlbnQpO1xuICAgIH1cblxuICB9XG5cbn0pO1xuIiwiLyoqXHJcbiAqIOimquOCueODl+ODqeOCpOODiOOBruODhuOCr+OCueODgeODo+OCkuWIh+OCiuaKnOOBhOOBpuiHquWIhuOBruODhuOCr+OCueODgeODo+OBqOOBmeOCi+OCueODl+ODqeOCpOODiFxyXG4gKiDopqrjgrnjg5fjg6njgqTjg4jjga7liIfjgormipzjgYvjgozjgZ/pg6jliIbjga/jgIHliIfjgormipzjgY3nr4Tlm7Ljga7lt6bkuIrjga7jg5Tjgq/jgrvjg6vjga7oibLjgafloZfjgorjgaTjgbbjgZXjgozjgotcclxuICogXHJcbiAqIOimquimgee0oOOBruaLoee4ruODu+Wbnui7ouOBr+iAg+aFruOBl+OBquOBhFxyXG4gKi9cclxucGhpbmEuZGVmaW5lKFwiQ2xpcFNwcml0ZVwiLCB7XHJcbiAgc3VwZXJDbGFzczogXCJBY2Nlc3NvcnlcIixcclxuXHJcbiAgaW5pdDogZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnN1cGVySW5pdCgpO1xyXG4gICAgdGhpcy5vbihcImF0dGFjaGVkXCIsICgpID0+IHtcclxuICAgICAgdGhpcy50YXJnZXQub25lKFwiYWRkZWRcIiwgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuc2V0dXAoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9LFxyXG5cclxuICBzZXR1cDogZnVuY3Rpb24oKSB7XHJcbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldDtcclxuICAgIGNvbnN0IHBhcmVudCA9IHRhcmdldC5wYXJlbnQ7XHJcbiAgICBpZiAocGFyZW50IGluc3RhbmNlb2YgcGhpbmEuZGlzcGxheS5TcHJpdGUpIHtcclxuICAgICAgY29uc3QgeCA9IHBhcmVudC53aWR0aCAqIHBhcmVudC5vcmlnaW4ueCArIHRhcmdldC54IC0gdGFyZ2V0LndpZHRoICogdGFyZ2V0Lm9yaWdpbi54O1xyXG4gICAgICBjb25zdCB5ID0gcGFyZW50LmhlaWdodCAqIHBhcmVudC5vcmlnaW4ueSArIHRhcmdldC55IC0gdGFyZ2V0LmhlaWdodCAqIHRhcmdldC5vcmlnaW4ueTtcclxuICAgICAgY29uc3QgdyA9IHRhcmdldC53aWR0aDtcclxuICAgICAgY29uc3QgaCA9IHRhcmdldC5oZWlnaHQ7XHJcblxyXG4gICAgICBjb25zdCBwYXJlbnRUZXh0dXJlID0gcGFyZW50LmltYWdlO1xyXG4gICAgICBjb25zdCBjYW52YXMgPSBwaGluYS5ncmFwaGljcy5DYW52YXMoKS5zZXRTaXplKHcsIGgpO1xyXG4gICAgICBjYW52YXMuY29udGV4dC5kcmF3SW1hZ2UocGFyZW50VGV4dHVyZS5kb21FbGVtZW50LCB4LCB5LCB3LCBoLCAwLCAwLCB3LCBoKTtcclxuICAgICAgaWYgKHBhcmVudFRleHR1cmUgaW5zdGFuY2VvZiBwaGluYS5ncmFwaGljcy5DYW52YXMpIHtcclxuICAgICAgICAvLyDjgq/jg63jg7zjg7PjgZfjgabjgZ3jgaPjgaHjgpLkvb/jgYZcclxuICAgICAgICBjb25zdCBwYXJlbnRUZXh0dXJlQ2xvbmUgPSBwaGluYS5ncmFwaGljcy5DYW52YXMoKS5zZXRTaXplKHBhcmVudFRleHR1cmUud2lkdGgsIHBhcmVudFRleHR1cmUuaGVpZ2h0KTtcclxuICAgICAgICBwYXJlbnRUZXh0dXJlQ2xvbmUuY29udGV4dC5kcmF3SW1hZ2UocGFyZW50VGV4dHVyZS5kb21FbGVtZW50LCAwLCAwKTtcclxuICAgICAgICBwYXJlbnQuaW1hZ2UgPSBwYXJlbnRUZXh0dXJlQ2xvbmU7XHJcblxyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBwYXJlbnRUZXh0dXJlQ2xvbmUuY29udGV4dC5nZXRJbWFnZURhdGEoeCwgeSwgMSwgMSkuZGF0YTtcclxuICAgICAgICBwYXJlbnRUZXh0dXJlQ2xvbmUuY29udGV4dC5jbGVhclJlY3QoeCwgeSwgdywgaCk7XHJcbiAgICAgICAgaWYgKGRhdGFbM10gPiAwKSB7XHJcbiAgICAgICAgICBwYXJlbnRUZXh0dXJlQ2xvbmUuY29udGV4dC5nbG9iYWxBbHBoYSA9IDE7XHJcbiAgICAgICAgICBwYXJlbnRUZXh0dXJlQ2xvbmUuY29udGV4dC5maWxsU3R5bGUgPSBgcmdiYSgke2RhdGFbMF19LCAke2RhdGFbMV19LCAke2RhdGFbMl19LCAke2RhdGFbM10gLyAyNTV9KWA7XHJcbiAgICAgICAgICBwYXJlbnRUZXh0dXJlQ2xvbmUuY29udGV4dC5maWxsUmVjdCh4IC0gMSwgeSAtIDEsIHcgKyAyLCBoICsgMik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBzcHJpdGUgPSBwaGluYS5kaXNwbGF5LlNwcml0ZShjYW52YXMpO1xyXG4gICAgICBzcHJpdGUuc2V0T3JpZ2luKHRhcmdldC5vcmlnaW4ueCwgdGFyZ2V0Lm9yaWdpbi55KTtcclxuICAgICAgdGFyZ2V0LmFkZENoaWxkQXQoc3ByaXRlLCAwKTtcclxuICAgIH1cclxuICB9LFxyXG59KTtcclxuIiwicGhpbmEuZGVmaW5lKFwiR2F1Z2VcIiwge1xuICBzdXBlckNsYXNzOiBcIlJlY3RhbmdsZUNsaXBcIixcblxuICBfbWluOiAwLFxuICBfbWF4OiAxLjAsXG4gIF92YWx1ZTogMS4wLCAvL21pbiB+IG1heFxuXG4gIGRpcmVjdGlvbjogXCJob3Jpem9udGFsXCIsIC8vIGhvcml6b250YWwgb3IgdmVydGljYWxcblxuICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN1cGVySW5pdCgpO1xuICAgIHRoaXMub24oXCJhdHRhY2hlZFwiLCAoKSA9PiB7XG4gICAgICB0aGlzLl93aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgICB0aGlzLl9oZWlnaHQgPSB0aGlzLndpZHRoO1xuXG4gICAgICB0aGlzLnRhcmdldC5hY2Nlc3NvcihcIkdhdWdlLm1pblwiLCB7XG4gICAgICAgIFwiZ2V0XCI6ICgpID0+IHRoaXMubWluLFxuICAgICAgICBcInNldFwiOiAodikgPT4gdGhpcy5taW4gPSB2LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGFyZ2V0LmFjY2Vzc29yKFwiR2F1Z2UubWF4XCIsIHtcbiAgICAgICAgXCJnZXRcIjogKCkgPT4gdGhpcy5tYXgsXG4gICAgICAgIFwic2V0XCI6ICh2KSA9PiB0aGlzLm1heCA9IHYsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy50YXJnZXQuYWNjZXNzb3IoXCJHYXVnZS52YWx1ZVwiLCB7XG4gICAgICAgIFwiZ2V0XCI6ICgpID0+IHRoaXMudmFsdWUsXG4gICAgICAgIFwic2V0XCI6ICh2KSA9PiB0aGlzLnZhbHVlID0gdixcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRhcmdldC5hY2Nlc3NvcihcIkdhdWdlLnByb2dyZXNzXCIsIHtcbiAgICAgICAgXCJnZXRcIjogKCkgPT4gdGhpcy5wcm9ncmVzcyxcbiAgICAgICAgXCJzZXRcIjogKHYpID0+IHRoaXMucHJvZ3Jlc3MgPSB2LFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgX3JlZnJlc2g6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmRpcmVjdGlvbiAhPT0gXCJ2ZXJ0aWNhbFwiKSB7XG4gICAgICB0aGlzLndpZHRoID0gdGhpcy50YXJnZXQud2lkdGggKiB0aGlzLnByb2dyZXNzO1xuICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLnRhcmdldC5oZWlnaHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMud2lkdGggPSB0aGlzLnRhcmdldC53aWR0aDtcbiAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy50YXJnZXQuaGVpZ2h0ICogdGhpcy5wcm9ncmVzcztcbiAgICB9XG4gIH0sXG5cbiAgX2FjY2Vzc29yOiB7XG4gICAgcHJvZ3Jlc3M6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IHAgPSAodGhpcy52YWx1ZSAtIHRoaXMubWluKSAvICh0aGlzLm1heCAtIHRoaXMubWluKTtcbiAgICAgICAgcmV0dXJuIChpc05hTihwKSkgPyAwLjAgOiBwO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB0aGlzLnZhbHVlID0gdGhpcy5tYXggKiB2O1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBtYXg6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXg7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHRoaXMuX21heCA9IHY7XG4gICAgICAgIHRoaXMuX3JlZnJlc2goKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgbWluOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWluO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB0aGlzLl9taW4gPSB2O1xuICAgICAgICB0aGlzLl9yZWZyZXNoKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHZhbHVlOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdmFsdWU7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHRoaXMuX3ZhbHVlID0gdjtcbiAgICAgICAgdGhpcy5fcmVmcmVzaCgpO1xuICAgICAgfVxuICAgIH0sXG4gIH1cblxufSk7XG4iLCJwaGluYS5kZWZpbmUoXCJHcmF5c2NhbGVcIiwge1xuICBzdXBlckNsYXNzOiBcIkFjY2Vzc29yeVwiLFxuXG4gIGdyYXlUZXh0dXJlTmFtZTogbnVsbCxcblxuICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB0aGlzLm9uKFwiYXR0YWNoZWRcIiwgKCkgPT4ge1xuICAgICAgdGhpcy5ncmF5VGV4dHVyZU5hbWUgPSBvcHRpb25zLmdyYXlUZXh0dXJlTmFtZTtcbiAgICAgIHRoaXMubm9ybWFsID0gdGhpcy50YXJnZXQuaW1hZ2U7XG4gICAgfSk7XG4gIH0sXG5cbiAgdG9HcmF5c2NhbGU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudGFyZ2V0LmltYWdlID0gdGhpcy5ncmF5VGV4dHVyZU5hbWU7XG4gIH0sXG5cbiAgdG9Ob3JtYWw6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudGFyZ2V0LmltYWdlID0gdGhpcy5ub3JtYWw7XG4gIH0sXG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuICAvL+ODnuOCpuOCuei/veW+k1xuICBwaGluYS5kZWZpbmUoXCJNb3VzZUNoYXNlclwiLCB7XG4gICAgc3VwZXJDbGFzczogXCJBY2Nlc3NvcnlcIixcblxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB9LFxuXG4gICAgb25hdHRhY2hlZDogZnVuY3Rpb24oKSB7XG4gICAgICBsZXQgcHggPSAwO1xuICAgICAgbGV0IHB5ID0gMDtcbiAgICAgIGNvbnNvbGUubG9nKFwiI01vdXNlQ2hhc2VyXCIsIFwib25hdHRhY2hlZFwiKTtcbiAgICAgIHRoaXMudHdlZW5lciA9IFR3ZWVuZXIoKS5hdHRhY2hUbyh0aGlzLnRhcmdldCk7XG4gICAgICB0aGlzLnRhcmdldC5vbihcImVudGVyZnJhbWVcIiwgKGUpID0+IHtcbiAgICAgICAgY29uc3QgcCA9IGUuYXBwLnBvaW50ZXI7XG4gICAgICAgIGlmIChweSA9PSBwLnggJiYgcHkgPT0gcC55KSByZXR1cm47XG4gICAgICAgIHB4ID0gcC54O1xuICAgICAgICBweSA9IHAueTtcbiAgICAgICAgY29uc3QgeCA9IHAueCAtIFNDUkVFTl9XSURUSF9IQUxGO1xuICAgICAgICBjb25zdCB5ID0gcC55IC0gU0NSRUVOX0hFSUdIVF9IQUxGO1xuICAgICAgICB0aGlzLnR3ZWVuZXIuY2xlYXIoKS50byh7IHgsIHkgfSwgMjAwMCwgXCJlYXNlT3V0UXVhZFwiKVxuICAgICAgfSk7XG5cbiAgICB9LFxuXG4gICAgb25kZXRhY2hlZDogZnVuY3Rpb24oKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIiNNb3VzZUNoYXNlclwiLCBcIm9uZGV0YWNoZWRcIik7XG4gICAgICB0aGlzLnR3ZWVuZXIucmVtb3ZlKCk7XG4gICAgfVxuXG4gIH0pO1xufSk7XG4iLCJwaGluYS5kZWZpbmUoXCJNdWx0aVJlY3RhbmdsZUNsaXBcIiwge1xuICBzdXBlckNsYXNzOiBcIkFjY2Vzc29yeVwiLFxuXG4gIHg6IDAsXG4gIHk6IDAsXG4gIHdpZHRoOiAwLFxuICBoZWlnaHQ6IDAsXG5cbiAgX2VuYWJsZTogdHJ1ZSxcblxuICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN1cGVySW5pdCgpO1xuICAgIHRoaXMuX2luaXQoKTtcbiAgfSxcblxuICBfaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jbGlwUmVjdCA9IFtdO1xuXG4gICAgdGhpcy5vbihcImF0dGFjaGVkXCIsICgpID0+IHtcbiAgICAgIHRoaXMueCA9IDA7XG4gICAgICB0aGlzLnkgPSAwO1xuICAgICAgdGhpcy53aWR0aCA9IHRoaXMudGFyZ2V0LndpZHRoO1xuICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLnRhcmdldC5oZWlnaHQ7XG5cbiAgICAgIHRoaXMudGFyZ2V0LmNsaXAgPSAoYykgPT4gdGhpcy5fY2xpcChjKTtcbiAgICB9KTtcbiAgfSxcblxuICBhZGRDbGlwUmVjdDogZnVuY3Rpb24ocmVjdCkge1xuICAgIGNvbnN0IHIgPSB7XG4gICAgICB4OiByZWN0LngsXG4gICAgICB5OiByZWN0LnksXG4gICAgICB3aWR0aDogcmVjdC53aWR0aCxcbiAgICAgIGhlaWdodDogcmVjdC5oZWlnaHQsXG4gICAgfTtcbiAgICB0aGlzLmNsaXBSZWN0LnB1c2gocik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgY2xlYXJDbGlwUmVjdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jbGlwUmVjdCA9IFtdO1xuICB9LFxuXG4gIF9jbGlwOiBmdW5jdGlvbihjYW52YXMpIHtcbiAgICBjYW52YXMuYmVnaW5QYXRoKCk7XG4gICAgdGhpcy5jbGlwUmVjdC5mb3JFYWNoKHJlY3QgPT4ge1xuICAgICAgY2FudmFzLnJlY3QocmVjdC54LCByZWN0LnksIHJlY3Qud2lkdGgsIHJlY3QuaGVpZ2h0KVxuICAgIH0pO1xuICAgIGNhbnZhcy5jbG9zZVBhdGgoKTtcbiAgfSxcblxuICBzZXRFbmFibGU6IGZ1bmN0aW9uKGVuYWJsZSkge1xuICAgIHRoaXMuX2VuYWJsZSA9IGVuYWJsZTtcbiAgICBpZiAodGhpcy5fZW5hYmxlKSB7XG4gICAgICB0aGlzLnRhcmdldC5jbGlwID0gKGMpID0+IHRoaXMuX2NsaXAoYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudGFyZ2V0LmNsaXAgPSBudWxsO1xuICAgIH1cbiAgfSxcblxuICBfYWNjZXNzb3I6IHtcbiAgICBlbmFibGU6IHtcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB0aGlzLnNldEVuYWJsZSh2KTtcbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuZGVmaW5lKFwiUGllQ2xpcFwiLCB7XG4gICAgc3VwZXJDbGFzczogXCJBY2Nlc3NvcnlcIixcblxuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSAoe30pLiRzYWZlKG9wdGlvbnMsIFBpZUNsaXAuZGVmYXVsdHMpXG4gICAgICB0aGlzLnN1cGVySW5pdChvcHRpb25zKTtcblxuICAgICAgdGhpcy5waXZvdFggPSBvcHRpb25zLnBpdm90WDtcbiAgICAgIHRoaXMucGl2b3RZID0gb3B0aW9ucy5waXZvdFk7XG4gICAgICB0aGlzLmFuZ2xlTWluID0gb3B0aW9ucy5hbmdsZU1pbjtcbiAgICAgIHRoaXMuYW5nbGVNYXggPSBvcHRpb25zLmFuZ2xlTWF4O1xuICAgICAgdGhpcy5yYWRpdXMgPSBvcHRpb25zLnJhZGl1cztcbiAgICAgIHRoaXMuYW50aWNsb2Nrd2lzZSA9IG9wdGlvbnMuYW50aWNsb2Nrd2lzZTtcbiAgICB9LFxuXG4gICAgb25hdHRhY2hlZDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnRhcmdldC5jbGlwID0gKGNhbnZhcykgPT4ge1xuICAgICAgICBjb25zdCBhbmdsZU1pbiA9IHRoaXMuYW5nbGVNaW4gKiBNYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGNvbnN0IGFuZ2xlTWF4ID0gdGhpcy5hbmdsZU1heCAqIE1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmNvbnRleHQ7XG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICAgICAgY3R4Lm1vdmVUbyh0aGlzLnBpdm90WCwgdGhpcy5waXZvdFkpO1xuICAgICAgICBjdHgubGluZVRvKHRoaXMucGl2b3RYICsgTWF0aC5jb3MoYW5nbGVNaW4pICogdGhpcy5yYWRpdXMsIHRoaXMucGl2b3RZICsgTWF0aC5zaW4oYW5nbGVNaW4pICogdGhpcy5yYWRpdXMpO1xuICAgICAgICBjdHguYXJjKHRoaXMucGl2b3RYLCB0aGlzLnBpdm90WSwgdGhpcy5yYWRpdXMsIGFuZ2xlTWluLCBhbmdsZU1heCwgdGhpcy5hbnRpY2xvY2t3aXNlKTtcbiAgICAgICAgY3R4LmNsb3NlUGF0aCgpO1xuICAgICAgfTtcbiAgICB9LFxuXG4gICAgX3N0YXRpYzoge1xuICAgICAgZGVmYXVsdHM6IHtcbiAgICAgICAgcGl2b3RYOiAzMixcbiAgICAgICAgcGl2b3RZOiAzMixcbiAgICAgICAgYW5nbGVNaW46IDAsXG4gICAgICAgIGFuZ2xlTWF4OiAzNjAsXG4gICAgICAgIHJhZGl1czogNjQsXG4gICAgICAgIGFudGljbG9ja3dpc2U6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuXG4gIH0pO1xufSk7XG4iLCJwaGluYS5kZWZpbmUoXCJSZWN0YW5nbGVDbGlwXCIsIHtcbiAgc3VwZXJDbGFzczogXCJBY2Nlc3NvcnlcIixcblxuICB4OiAwLFxuICB5OiAwLFxuICB3aWR0aDogMCxcbiAgaGVpZ2h0OiAwLFxuXG4gIF9lbmFibGU6IHRydWUsXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB0aGlzLl9pbml0KCk7XG4gIH0sXG5cbiAgX2luaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub24oXCJhdHRhY2hlZFwiLCAoKSA9PiB7XG5cbiAgICAgIHRoaXMudGFyZ2V0LmFjY2Vzc29yKFwiUmVjdGFuZ2xlQ2xpcC53aWR0aFwiLCB7XG4gICAgICAgIFwiZ2V0XCI6ICgpID0+IHRoaXMud2lkdGgsXG4gICAgICAgIFwic2V0XCI6ICh2KSA9PiB0aGlzLndpZHRoID0gdixcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRhcmdldC5hY2Nlc3NvcihcIlJlY3RhbmdsZUNsaXAuaGVpZ2h0XCIsIHtcbiAgICAgICAgXCJnZXRcIjogKCkgPT4gdGhpcy5oZWlnaHQsXG4gICAgICAgIFwic2V0XCI6ICh2KSA9PiB0aGlzLmhlaWdodCA9IHYsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy50YXJnZXQuYWNjZXNzb3IoXCJSZWN0YW5nbGVDbGlwLnhcIiwge1xuICAgICAgICBcImdldFwiOiAoKSA9PiB0aGlzLngsXG4gICAgICAgIFwic2V0XCI6ICh2KSA9PiB0aGlzLnggPSB2LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGFyZ2V0LmFjY2Vzc29yKFwiUmVjdGFuZ2xlQ2xpcC55XCIsIHtcbiAgICAgICAgXCJnZXRcIjogKCkgPT4gdGhpcy55LFxuICAgICAgICBcInNldFwiOiAodikgPT4gdGhpcy55ID0gdixcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnggPSAwO1xuICAgICAgdGhpcy55ID0gMDtcbiAgICAgIHRoaXMud2lkdGggPSB0aGlzLnRhcmdldC53aWR0aDtcbiAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy50YXJnZXQuaGVpZ2h0O1xuXG4gICAgICB0aGlzLnRhcmdldC5jbGlwID0gKGMpID0+IHRoaXMuX2NsaXAoYyk7XG4gICAgfSk7XG4gIH0sXG5cbiAgX2NsaXA6IGZ1bmN0aW9uKGNhbnZhcykge1xuICAgIGNvbnN0IHggPSB0aGlzLnggLSAodGhpcy53aWR0aCAqIHRoaXMudGFyZ2V0Lm9yaWdpblgpO1xuICAgIGNvbnN0IHkgPSB0aGlzLnkgLSAodGhpcy5oZWlnaHQgKiB0aGlzLnRhcmdldC5vcmlnaW5ZKTtcblxuICAgIGNhbnZhcy5iZWdpblBhdGgoKTtcbiAgICBjYW52YXMucmVjdCh4LCB5LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgY2FudmFzLmNsb3NlUGF0aCgpO1xuICB9LFxuXG4gIHNldEVuYWJsZTogZnVuY3Rpb24oZW5hYmxlKSB7XG4gICAgdGhpcy5fZW5hYmxlID0gZW5hYmxlO1xuICAgIGlmICh0aGlzLl9lbmFibGUpIHtcbiAgICAgIHRoaXMudGFyZ2V0LmNsaXAgPSAoYykgPT4gdGhpcy5fY2xpcChjKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50YXJnZXQuY2xpcCA9IG51bGw7XG4gICAgfVxuICB9LFxuXG4gIF9hY2Nlc3Nvcjoge1xuICAgIGVuYWJsZToge1xuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHRoaXMuc2V0RW5hYmxlKHYpO1xuICAgICAgfSxcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGU7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG59KTtcbiIsInBoaW5hLmRlZmluZShcIlRvZ2dsZVwiLCB7XG4gIHN1cGVyQ2xhc3M6IFwiQWNjZXNzb3J5XCIsXG5cbiAgaW5pdDogZnVuY3Rpb24oaXNPbikge1xuICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgdGhpcy5faW5pdChpc09uKTtcbiAgfSxcblxuICBfaW5pdDogZnVuY3Rpb24oaXNPbikge1xuICAgIHRoaXMuaXNPbiA9IGlzT24gfHwgZmFsc2U7XG4gIH0sXG5cbiAgc2V0U3RhdHVzOiBmdW5jdGlvbihzdGF0dXMpIHtcbiAgICB0aGlzLmlzT24gPSBzdGF0dXM7XG4gICAgdGhpcy50YXJnZXQuZmxhcmUoKHRoaXMuaXNPbikgPyBcInN3aXRjaE9uXCIgOiBcInN3aXRjaE9mZlwiKTtcbiAgfSxcblxuICBzd2l0Y2hPbjogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaXNPbikgcmV0dXJuO1xuICAgIHRoaXMuc2V0U3RhdHVzKHRydWUpO1xuICB9LFxuXG4gIHN3aXRjaE9mZjogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmlzT24pIHJldHVybjtcbiAgICB0aGlzLnNldFN0YXR1cyhmYWxzZSk7XG4gIH0sXG5cbiAgc3dpdGNoOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmlzT24gPSAhdGhpcy5pc09uO1xuICAgIHRoaXMuc2V0U3RhdHVzKHRoaXMuaXNPbik7XG4gIH0sXG5cbiAgX2FjY2Vzc29yOiB7XG4gICAgc3RhdHVzOiB7XG4gICAgICBcImdldFwiOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNPbjtcbiAgICAgIH0sXG4gICAgICBcInNldFwiOiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHJldHVybiBzZXRTdGF0dXModik7XG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG5cbn0pO1xuIiwicGhpbmEuZGVmaW5lKFwiQnV0dG9uaXplXCIsIHtcbiAgaW5pdDogZnVuY3Rpb24oKSB7fSxcbiAgX3N0YXRpYzoge1xuICAgIFNUQVRVUzoge1xuICAgICAgTk9ORTogMCxcbiAgICAgIFNUQVJUOiAxLFxuICAgICAgRU5EOiAyLFxuICAgIH0sXG4gICAgc3RhdHVzOiAwLFxuICAgIHJlY3Q6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgIGVsZW1lbnQuYm91bmRpbmdUeXBlID0gXCJyZWN0XCI7XG4gICAgICB0aGlzLl9jb21tb24oZWxlbWVudCk7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9LFxuICAgIGNpcmNsZTogZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgZWxlbWVudC5yYWRpdXMgPSBNYXRoLm1heChlbGVtZW50LndpZHRoLCBlbGVtZW50LmhlaWdodCkgKiAwLjU7XG4gICAgICBlbGVtZW50LmJvdW5kaW5nVHlwZSA9IFwiY2lyY2xlXCI7XG4gICAgICB0aGlzLl9jb21tb24oZWxlbWVudCk7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9LFxuICAgIF9jb21tb246IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgIC8vVE9ETzrjgqjjg4fjgqPjgr/jg7zjgafjgY3jgovjgb7jgafjga7mmqvlrprlr77lv5xcbiAgICAgIGVsZW1lbnQuc2V0T3JpZ2luKDAuNSwgMC41LCB0cnVlKTtcblxuICAgICAgZWxlbWVudC5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gICAgICBlbGVtZW50LmNsaWNrU291bmQgPSBcInNlL2NsaWNrQnV0dG9uXCI7XG5cbiAgICAgIC8vVE9ETzrjg5zjgr/jg7Pjga7lkIzmmYLmirzkuIvjga/lrp/mqZ/jgafoqr/mlbTjgZnjgotcbiAgICAgIGVsZW1lbnQub24oXCJwb2ludHN0YXJ0XCIsIGUgPT4ge1xuICAgICAgICBpZiAodGhpcy5zdGF0dXMgIT0gdGhpcy5TVEFUVVMuTk9ORSkgcmV0dXJuO1xuICAgICAgICB0aGlzLnN0YXR1cyA9IHRoaXMuU1RBVFVTLlNUQVJUO1xuICAgICAgICBlbGVtZW50LnR3ZWVuZXIuY2xlYXIoKVxuICAgICAgICAgIC50byh7XG4gICAgICAgICAgICBzY2FsZVg6IDAuOSxcbiAgICAgICAgICAgIHNjYWxlWTogMC45XG4gICAgICAgICAgfSwgMTAwKTtcbiAgICAgIH0pO1xuXG4gICAgICBlbGVtZW50Lm9uKFwicG9pbnRlbmRcIiwgKGUpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHVzICE9IHRoaXMuU1RBVFVTLlNUQVJUKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGhpdFRlc3QgPSBlbGVtZW50LmhpdFRlc3QoZS5wb2ludGVyLngsIGUucG9pbnRlci55KTtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSB0aGlzLlNUQVRVUy5FTkQ7XG4gICAgICAgIGlmIChoaXRUZXN0KSBlbGVtZW50LmZsYXJlKFwiY2xpY2tTb3VuZFwiKTtcblxuICAgICAgICBlbGVtZW50LnR3ZWVuZXIuY2xlYXIoKVxuICAgICAgICAgIC50byh7XG4gICAgICAgICAgICBzY2FsZVg6IDEuMCxcbiAgICAgICAgICAgIHNjYWxlWTogMS4wXG4gICAgICAgICAgfSwgMTAwKVxuICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gdGhpcy5TVEFUVVMuTk9ORTtcbiAgICAgICAgICAgIGlmICghaGl0VGVzdCkgcmV0dXJuO1xuICAgICAgICAgICAgZWxlbWVudC5mbGFyZShcImNsaWNrZWRcIiwge1xuICAgICAgICAgICAgICBwb2ludGVyOiBlLnBvaW50ZXJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIC8v44Ki44OL44Oh44O844K344On44Oz44Gu5pyA5Lit44Gr5YmK6Zmk44GV44KM44Gf5aC05ZCI44Gr5YKZ44GI44GmcmVtb3ZlZOOCpOODmeODs+ODiOaZguOBq+ODleODqeOCsOOCkuWFg+OBq+aIu+OBl+OBpuOBiuOBj1xuICAgICAgZWxlbWVudC5vbmUoXCJyZW1vdmVkXCIsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSB0aGlzLlNUQVRVUy5OT05FO1xuICAgICAgfSk7XG5cbiAgICAgIGVsZW1lbnQub24oXCJjbGlja1NvdW5kXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIWVsZW1lbnQuY2xpY2tTb3VuZCkgcmV0dXJuO1xuICAgICAgICAvL3BoaW5hLmFzc2V0LlNvdW5kTWFuYWdlci5wbGF5KGVsZW1lbnQuY2xpY2tTb3VuZCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9LFxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgLyoqXG4gICAqIOODhuOCr+OCueODgeODo+mWouS/guOBruODpuODvOODhuOCo+ODquODhuOCo1xuICAgKi9cbiAgcGhpbmEuZGVmaW5lKFwiVGV4dHVyZVV0aWxcIiwge1xuXG4gICAgX3N0YXRpYzoge1xuXG4gICAgICAvKipcbiAgICAgICAqIFJHQuWQhOimgee0oOOBq+Wun+aVsOOCkuepjeeul+OBmeOCi1xuICAgICAgICovXG4gICAgICBtdWx0aXBseUNvbG9yOiBmdW5jdGlvbih0ZXh0dXJlLCByZWQsIGdyZWVuLCBibHVlKSB7XG4gICAgICAgIGlmICh0eXBlb2YodGV4dHVyZSkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICB0ZXh0dXJlID0gQXNzZXRNYW5hZ2VyLmdldChcImltYWdlXCIsIHRleHR1cmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2lkdGggPSB0ZXh0dXJlLmRvbUVsZW1lbnQud2lkdGg7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHRleHR1cmUuZG9tRWxlbWVudC5oZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gQ2FudmFzKCkuc2V0U2l6ZSh3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgY29uc3QgY29udGV4dCA9IHJlc3VsdC5jb250ZXh0O1xuXG4gICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKHRleHR1cmUuZG9tRWxlbWVudCwgMCwgMCk7XG4gICAgICAgIGNvbnN0IGltYWdlRGF0YSA9IGNvbnRleHQuZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGltYWdlRGF0YS5kYXRhLmxlbmd0aDsgaSArPSA0KSB7XG4gICAgICAgICAgaW1hZ2VEYXRhLmRhdGFbaSArIDBdID0gTWF0aC5mbG9vcihpbWFnZURhdGEuZGF0YVtpICsgMF0gKiByZWQpO1xuICAgICAgICAgIGltYWdlRGF0YS5kYXRhW2kgKyAxXSA9IE1hdGguZmxvb3IoaW1hZ2VEYXRhLmRhdGFbaSArIDFdICogZ3JlZW4pO1xuICAgICAgICAgIGltYWdlRGF0YS5kYXRhW2kgKyAyXSA9IE1hdGguZmxvb3IoaW1hZ2VEYXRhLmRhdGFbaSArIDJdICogYmx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGV4dC5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiDoibLnm7jjg7vlvanluqbjg7vmmI7luqbjgpLmk43kvZzjgZnjgotcbiAgICAgICAqL1xuICAgICAgZWRpdEJ5SHNsOiBmdW5jdGlvbih0ZXh0dXJlLCBoLCBzLCBsKSB7XG4gICAgICAgIGlmICh0eXBlb2YodGV4dHVyZSkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICB0ZXh0dXJlID0gQXNzZXRNYW5hZ2VyLmdldChcImltYWdlXCIsIHRleHR1cmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2lkdGggPSB0ZXh0dXJlLmRvbUVsZW1lbnQud2lkdGg7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHRleHR1cmUuZG9tRWxlbWVudC5oZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gQ2FudmFzKCkuc2V0U2l6ZSh3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgY29uc3QgY29udGV4dCA9IHJlc3VsdC5jb250ZXh0O1xuXG4gICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKHRleHR1cmUuZG9tRWxlbWVudCwgMCwgMCk7XG4gICAgICAgIGNvbnN0IGltYWdlRGF0YSA9IGNvbnRleHQuZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGltYWdlRGF0YS5kYXRhLmxlbmd0aDsgaSArPSA0KSB7XG4gICAgICAgICAgY29uc3QgciA9IGltYWdlRGF0YS5kYXRhW2kgKyAwXTtcbiAgICAgICAgICBjb25zdCBnID0gaW1hZ2VEYXRhLmRhdGFbaSArIDFdO1xuICAgICAgICAgIGNvbnN0IGIgPSBpbWFnZURhdGEuZGF0YVtpICsgMl07XG5cbiAgICAgICAgICBjb25zdCBoc2wgPSBwaGluYS51dGlsLkNvbG9yLlJHQnRvSFNMKHIsIGcsIGIpO1xuICAgICAgICAgIGNvbnN0IG5ld1JnYiA9IHBoaW5hLnV0aWwuQ29sb3IuSFNMdG9SR0IoaHNsWzBdICsgaCwgTWF0aC5jbGFtcChoc2xbMV0gKyBzLCAwLCAxMDApLCBNYXRoLmNsYW1wKGhzbFsyXSArIGwsIDAsIDEwMCkpO1xuXG4gICAgICAgICAgaW1hZ2VEYXRhLmRhdGFbaSArIDBdID0gbmV3UmdiWzBdO1xuICAgICAgICAgIGltYWdlRGF0YS5kYXRhW2kgKyAxXSA9IG5ld1JnYlsxXTtcbiAgICAgICAgICBpbWFnZURhdGEuZGF0YVtpICsgMl0gPSBuZXdSZ2JbMl07XG4gICAgICAgIH1cbiAgICAgICAgY29udGV4dC5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSxcblxuICAgIH0sXG5cbiAgICBpbml0OiBmdW5jdGlvbigpIHt9LFxuICB9KTtcblxufSk7XG4iLCIvKlxuICogIHBoaW5hLnRpbGVkbWFwLmpzXG4gKiAgMjAxNi85LzEwXG4gKiAgQGF1dGhlciBtaW5pbW8gIFxuICogIFRoaXMgUHJvZ3JhbSBpcyBNSVQgbGljZW5zZS5cbiAqIFxuICogIDIwMTkvOS8xOFxuICogIHZlcnNpb24gMi4wXG4gKi9cblxucGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZShcInBoaW5hLmFzc2V0LlRpbGVkTWFwXCIsIHtcbiAgICBzdXBlckNsYXNzOiBcInBoaW5hLmFzc2V0LlhNTExvYWRlclwiLFxuXG4gICAgaW1hZ2U6IG51bGwsXG5cbiAgICB0aWxlc2V0czogbnVsbCxcbiAgICBsYXllcnM6IG51bGwsXG5cbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB9LFxuXG4gICAgX2xvYWQ6IGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICAgIC8v44OR44K55oqc44GN5Ye644GXXG4gICAgICB0aGlzLnBhdGggPSBcIlwiO1xuICAgICAgY29uc3QgbGFzdCA9IHRoaXMuc3JjLmxhc3RJbmRleE9mKFwiL1wiKTtcbiAgICAgIGlmIChsYXN0ID4gMCkge1xuICAgICAgICB0aGlzLnBhdGggPSB0aGlzLnNyYy5zdWJzdHJpbmcoMCwgbGFzdCArIDEpO1xuICAgICAgfVxuXG4gICAgICAvL+e1guS6humWouaVsOS/neWtmFxuICAgICAgdGhpcy5fcmVzb2x2ZSA9IHJlc29sdmU7XG5cbiAgICAgIC8vIGxvYWRcbiAgICAgIGNvbnN0IHhtbCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgeG1sLm9wZW4oJ0dFVCcsIHRoaXMuc3JjKTtcbiAgICAgIHhtbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgIGlmICh4bWwucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgIGlmIChbMjAwLCAyMDEsIDBdLmluZGV4T2YoeG1sLnN0YXR1cykgIT09IC0xKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gKG5ldyBET01QYXJzZXIoKSkucGFyc2VGcm9tU3RyaW5nKHhtbC5yZXNwb25zZVRleHQsIFwidGV4dC94bWxcIik7XG4gICAgICAgICAgICB0aGlzLmRhdGFUeXBlID0gXCJ4bWxcIjtcbiAgICAgICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZShkYXRhKVxuICAgICAgICAgICAgICAudGhlbigoKSA9PiB0aGlzLl9yZXNvbHZlKHRoaXMpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB4bWwuc2VuZChudWxsKTtcbiAgICB9LFxuXG4gICAgLy/jg57jg4Pjg5fjgqTjg6Hjg7zjgrjlj5blvpdcbiAgICBnZXRJbWFnZTogZnVuY3Rpb24obGF5ZXJOYW1lKSB7XG4gICAgICBpZiAobGF5ZXJOYW1lID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW1hZ2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2VuZXJhdGVJbWFnZShsYXllck5hbWUpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvL+aMh+WumuODnuODg+ODl+ODrOOCpOODpOODvOOCkumFjeWIl+OBqOOBl+OBpuWPluW+l1xuICAgIGdldE1hcERhdGE6IGZ1bmN0aW9uKGxheWVyTmFtZSkge1xuICAgICAgLy/jg6zjgqTjg6Tjg7zmpJzntKJcbiAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodGhpcy5sYXllcnNbaV0ubmFtZSA9PSBsYXllck5hbWUpIHtcbiAgICAgICAgICAvL+OCs+ODlOODvOOCkui/lOOBmVxuICAgICAgICAgIHJldHVybiB0aGlzLmxheWVyc1tpXS5kYXRhLmNvbmNhdCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG4gICAgLy/jgqrjg5bjgrjjgqfjgq/jg4jjgrDjg6vjg7zjg5fjgpLlj5blvpfvvIjmjIflrprjgYznhKHjgYTloLTlkIjjgIHlhajjg6zjgqTjg6Tjg7zjgpLphY3liJfjgavjgZfjgabov5TjgZnvvIlcbiAgICBnZXRPYmplY3RHcm91cDogZnVuY3Rpb24oZ3JvdXBOYW1lKSB7XG4gICAgICBncm91cE5hbWUgPSBncm91cE5hbWUgfHwgbnVsbDtcbiAgICAgIGNvbnN0IGxzID0gW107XG4gICAgICBjb25zdCBsZW4gPSB0aGlzLmxheWVycy5sZW5ndGg7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGlmICh0aGlzLmxheWVyc1tpXS50eXBlID09IFwib2JqZWN0Z3JvdXBcIikge1xuICAgICAgICAgIGlmIChncm91cE5hbWUgPT0gbnVsbCB8fCBncm91cE5hbWUgPT0gdGhpcy5sYXllcnNbaV0ubmFtZSkge1xuICAgICAgICAgICAgLy/jg6zjgqTjg6Tjg7zmg4XloLHjgpLjgq/jg63jg7zjg7PjgZnjgotcbiAgICAgICAgICAgIGNvbnN0IG9iaiA9IHRoaXMuX2Nsb25lT2JqZWN0TGF5ZXIodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGdyb3VwTmFtZSAhPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICAgICAgICAgIGxzLnB1c2gob2JqKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBscztcbiAgICB9LFxuXG4gICAgLy/jgqrjg5bjgrjjgqfjgq/jg4jjg6zjgqTjg6Tjg7zjgpLjgq/jg63jg7zjg7PjgZfjgabov5TjgZlcbiAgICBfY2xvbmVPYmplY3RMYXllcjogZnVuY3Rpb24oc3JjTGF5ZXIpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9LiRzYWZlKHNyY0xheWVyKTtcbiAgICAgIHJlc3VsdC5vYmplY3RzID0gW107XG4gICAgICAvL+ODrOOCpOODpOODvOWGheOCquODluOCuOOCp+OCr+ODiOOBruOCs+ODlOODvFxuICAgICAgc3JjTGF5ZXIub2JqZWN0cy5mb3JFYWNoKG9iaiA9PiB7XG4gICAgICAgIGNvbnN0IHJlc09iaiA9IHtcbiAgICAgICAgICBwcm9wZXJ0aWVzOiB7fS4kc2FmZShvYmoucHJvcGVydGllcyksXG4gICAgICAgIH0uJGV4dGVuZChvYmopO1xuICAgICAgICBpZiAob2JqLmVsbGlwc2UpIHJlc09iai5lbGxpcHNlID0gb2JqLmVsbGlwc2U7XG4gICAgICAgIGlmIChvYmouZ2lkKSByZXNPYmouZ2lkID0gb2JqLmdpZDtcbiAgICAgICAgaWYgKG9iai5wb2x5Z29uKSByZXNPYmoucG9seWdvbiA9IG9iai5wb2x5Z29uLmNsb25lKCk7XG4gICAgICAgIGlmIChvYmoucG9seWxpbmUpIHJlc09iai5wb2x5bGluZSA9IG9iai5wb2x5bGluZS5jbG9uZSgpO1xuICAgICAgICByZXN1bHQub2JqZWN0cy5wdXNoKHJlc09iaik7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIF9wYXJzZTogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAvL+OCv+OCpOODq+WxnuaAp+aDheWgseWPluW+l1xuICAgICAgICBjb25zdCBtYXAgPSBkYXRhLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdtYXAnKVswXTtcbiAgICAgICAgY29uc3QgYXR0ciA9IHRoaXMuX2F0dHJUb0pTT04obWFwKTtcbiAgICAgICAgdGhpcy4kZXh0ZW5kKGF0dHIpO1xuICAgICAgICB0aGlzLnByb3BlcnRpZXMgPSB0aGlzLl9wcm9wZXJ0aWVzVG9KU09OKG1hcCk7XG5cbiAgICAgICAgLy/jgr/jgqTjg6vjgrvjg4Pjg4jlj5blvpdcbiAgICAgICAgdGhpcy50aWxlc2V0cyA9IHRoaXMuX3BhcnNlVGlsZXNldHMoZGF0YSk7XG4gICAgICAgIHRoaXMudGlsZXNldHMuc29ydCgoYSwgYikgPT4gYS5maXJzdGdpZCAtIGIuZmlyc3RnaWQpO1xuXG4gICAgICAgIC8v44Os44Kk44Ok44O85Y+W5b6XXG4gICAgICAgIHRoaXMubGF5ZXJzID0gdGhpcy5fcGFyc2VMYXllcnMoZGF0YSk7XG5cbiAgICAgICAgLy/jgqTjg6Hjg7zjgrjjg4fjg7zjgr/oqq3jgb/ovrzjgb9cbiAgICAgICAgdGhpcy5fY2hlY2tJbWFnZSgpXG4gICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgLy/jg57jg4Pjg5fjgqTjg6Hjg7zjgrjnlJ/miJBcbiAgICAgICAgICAgIHRoaXMuaW1hZ2UgPSB0aGlzLl9nZW5lcmF0ZUltYWdlKCk7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KVxuICAgIH0sXG5cbiAgICAvL+OCv+OCpOODq+OCu+ODg+ODiOOBruODkeODvOOCuVxuICAgIF9wYXJzZVRpbGVzZXRzOiBmdW5jdGlvbih4bWwpIHtcbiAgICAgIGNvbnN0IGVhY2ggPSBBcnJheS5wcm90b3R5cGUuZm9yRWFjaDtcbiAgICAgIGNvbnN0IGRhdGEgPSBbXTtcbiAgICAgIGNvbnN0IHRpbGVzZXRzID0geG1sLmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0aWxlc2V0Jyk7XG4gICAgICBlYWNoLmNhbGwodGlsZXNldHMsIGFzeW5jIHRpbGVzZXQgPT4ge1xuICAgICAgICBjb25zdCB0ID0ge307XG4gICAgICAgIGNvbnN0IGF0dHIgPSB0aGlzLl9hdHRyVG9KU09OKHRpbGVzZXQpO1xuICAgICAgICBpZiAoYXR0ci5zb3VyY2UpIHtcbiAgICAgICAgICB0LmlzT2xkRm9ybWF0ID0gZmFsc2U7XG4gICAgICAgICAgdC5zb3VyY2UgPSB0aGlzLnBhdGggKyBhdHRyLnNvdXJjZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL+aXp+ODh+ODvOOCv+W9ouW8j++8iOacquWvvuW/nO+8iVxuICAgICAgICAgIHQuaXNPbGRGb3JtYXQgPSB0cnVlO1xuICAgICAgICAgIHQuZGF0YSA9IHRpbGVzZXQ7XG4gICAgICAgIH1cbiAgICAgICAgdC5maXJzdGdpZCA9IGF0dHIuZmlyc3RnaWQ7XG4gICAgICAgIGRhdGEucHVzaCh0KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcblxuICAgIC8v44Os44Kk44Ok44O85oOF5aCx44Gu44OR44O844K5XG4gICAgX3BhcnNlTGF5ZXJzOiBmdW5jdGlvbih4bWwpIHtcbiAgICAgIGNvbnN0IGVhY2ggPSBBcnJheS5wcm90b3R5cGUuZm9yRWFjaDtcbiAgICAgIGNvbnN0IGRhdGEgPSBbXTtcblxuICAgICAgY29uc3QgbWFwID0geG1sLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwibWFwXCIpWzBdO1xuICAgICAgY29uc3QgbGF5ZXJzID0gW107XG4gICAgICBlYWNoLmNhbGwobWFwLmNoaWxkTm9kZXMsIGVsbSA9PiB7XG4gICAgICAgIGlmIChlbG0udGFnTmFtZSA9PSBcImxheWVyXCIgfHwgZWxtLnRhZ05hbWUgPT0gXCJvYmplY3Rncm91cFwiIHx8IGVsbS50YWdOYW1lID09IFwiaW1hZ2VsYXllclwiKSB7XG4gICAgICAgICAgbGF5ZXJzLnB1c2goZWxtKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGxheWVycy5lYWNoKGxheWVyID0+IHtcbiAgICAgICAgc3dpdGNoIChsYXllci50YWdOYW1lKSB7XG4gICAgICAgICAgY2FzZSBcImxheWVyXCI6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIC8v6YCa5bi444Os44Kk44Ok44O8XG4gICAgICAgICAgICAgIGNvbnN0IGQgPSBsYXllci5nZXRFbGVtZW50c0J5VGFnTmFtZSgnZGF0YScpWzBdO1xuICAgICAgICAgICAgICBjb25zdCBlbmNvZGluZyA9IGQuZ2V0QXR0cmlidXRlKFwiZW5jb2RpbmdcIik7XG4gICAgICAgICAgICAgIGNvbnN0IGwgPSB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiBcImxheWVyXCIsXG4gICAgICAgICAgICAgICAgICBuYW1lOiBsYXllci5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpLFxuICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgIGlmIChlbmNvZGluZyA9PSBcImNzdlwiKSB7XG4gICAgICAgICAgICAgICAgICBsLmRhdGEgPSB0aGlzLl9wYXJzZUNTVihkLnRleHRDb250ZW50KTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChlbmNvZGluZyA9PSBcImJhc2U2NFwiKSB7XG4gICAgICAgICAgICAgICAgICBsLmRhdGEgPSB0aGlzLl9wYXJzZUJhc2U2NChkLnRleHRDb250ZW50KTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGF0dHIgPSB0aGlzLl9hdHRyVG9KU09OKGxheWVyKTtcbiAgICAgICAgICAgICAgbC4kZXh0ZW5kKGF0dHIpO1xuICAgICAgICAgICAgICBsLnByb3BlcnRpZXMgPSB0aGlzLl9wcm9wZXJ0aWVzVG9KU09OKGxheWVyKTtcblxuICAgICAgICAgICAgICBkYXRhLnB1c2gobCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8v44Kq44OW44K444Kn44Kv44OI44Os44Kk44Ok44O8XG4gICAgICAgICAgY2FzZSBcIm9iamVjdGdyb3VwXCI6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNvbnN0IGwgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJvYmplY3Rncm91cFwiLFxuICAgICAgICAgICAgICAgIG9iamVjdHM6IFtdLFxuICAgICAgICAgICAgICAgIG5hbWU6IGxheWVyLmdldEF0dHJpYnV0ZShcIm5hbWVcIiksXG4gICAgICAgICAgICAgICAgeDogcGFyc2VGbG9hdChsYXllci5nZXRBdHRyaWJ1dGUoXCJvZmZzZXR4XCIpKSB8fCAwLFxuICAgICAgICAgICAgICAgIHk6IHBhcnNlRmxvYXQobGF5ZXIuZ2V0QXR0cmlidXRlKFwib2Zmc2V0eVwiKSkgfHwgMCxcbiAgICAgICAgICAgICAgICBhbHBoYTogbGF5ZXIuZ2V0QXR0cmlidXRlKFwib3BhY2l0eVwiKSB8fCAxLFxuICAgICAgICAgICAgICAgIGNvbG9yOiBsYXllci5nZXRBdHRyaWJ1dGUoXCJjb2xvclwiKSB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGRyYXdvcmRlcjogbGF5ZXIuZ2V0QXR0cmlidXRlKFwiZHJhd29yZGVyXCIpIHx8IG51bGwsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIGVhY2guY2FsbChsYXllci5jaGlsZE5vZGVzLCBlbG0gPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlbG0ubm9kZVR5cGUgPT0gMykgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGNvbnN0IGQgPSB0aGlzLl9hdHRyVG9KU09OKGVsbSk7XG4gICAgICAgICAgICAgICAgZC5wcm9wZXJ0aWVzID0gdGhpcy5fcHJvcGVydGllc1RvSlNPTihlbG0pO1xuICAgICAgICAgICAgICAgIC8v5a2Q6KaB57Sg44Gu6Kej5p6QXG4gICAgICAgICAgICAgICAgaWYgKGVsbS5jaGlsZE5vZGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgZWxtLmNoaWxkTm9kZXMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUubm9kZVR5cGUgPT0gMykgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAvL+alleWGhlxuICAgICAgICAgICAgICAgICAgICBpZiAoZS5ub2RlTmFtZSA9PSAnZWxsaXBzZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICBkLmVsbGlwc2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8v5aSa6KeS5b2iXG4gICAgICAgICAgICAgICAgICAgIGlmIChlLm5vZGVOYW1lID09ICdwb2x5Z29uJykge1xuICAgICAgICAgICAgICAgICAgICAgIGQucG9seWdvbiA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGF0dHIgPSB0aGlzLl9hdHRyVG9KU09OX3N0cihlKTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwbCA9IGF0dHIucG9pbnRzLnNwbGl0KFwiIFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICBwbC5mb3JFYWNoKGZ1bmN0aW9uKHN0cikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHRzID0gc3RyLnNwbGl0KFwiLFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQucG9seWdvbi5wdXNoKHt4OiBwYXJzZUZsb2F0KHB0c1swXSksIHk6IHBhcnNlRmxvYXQocHRzWzFdKX0pO1xuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8v57ea5YiGXG4gICAgICAgICAgICAgICAgICAgIGlmIChlLm5vZGVOYW1lID09ICdwb2x5bGluZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICBkLnBvbHlsaW5lID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXR0ciA9IHRoaXMuX2F0dHJUb0pTT05fc3RyKGUpO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBsID0gYXR0ci5wb2ludHMuc3BsaXQoXCIgXCIpO1xuICAgICAgICAgICAgICAgICAgICAgIHBsLmZvckVhY2goc3RyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHB0cyA9IHN0ci5zcGxpdChcIixcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkLnBvbHlsaW5lLnB1c2goe3g6IHBhcnNlRmxvYXQocHRzWzBdKSwgeTogcGFyc2VGbG9hdChwdHNbMV0pfSk7XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsLm9iamVjdHMucHVzaChkKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGwucHJvcGVydGllcyA9IHRoaXMuX3Byb3BlcnRpZXNUb0pTT04obGF5ZXIpO1xuXG4gICAgICAgICAgICAgIGRhdGEucHVzaChsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy/jgqTjg6Hjg7zjgrjjg6zjgqTjg6Tjg7xcbiAgICAgICAgICBjYXNlIFwiaW1hZ2VsYXllclwiOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjb25zdCBsID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiaW1hZ2VsYXllclwiLFxuICAgICAgICAgICAgICAgIG5hbWU6IGxheWVyLmdldEF0dHJpYnV0ZShcIm5hbWVcIiksXG4gICAgICAgICAgICAgICAgeDogcGFyc2VGbG9hdChsYXllci5nZXRBdHRyaWJ1dGUoXCJvZmZzZXR4XCIpKSB8fCAwLFxuICAgICAgICAgICAgICAgIHk6IHBhcnNlRmxvYXQobGF5ZXIuZ2V0QXR0cmlidXRlKFwib2Zmc2V0eVwiKSkgfHwgMCxcbiAgICAgICAgICAgICAgICBhbHBoYTogbGF5ZXIuZ2V0QXR0cmlidXRlKFwib3BhY2l0eVwiKSB8fCAxLFxuICAgICAgICAgICAgICAgIHZpc2libGU6IChsYXllci5nZXRBdHRyaWJ1dGUoXCJ2aXNpYmxlXCIpID09PSB1bmRlZmluZWQgfHwgbGF5ZXIuZ2V0QXR0cmlidXRlKFwidmlzaWJsZVwiKSAhPSAwKSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgY29uc3QgaW1hZ2VFbG0gPSBsYXllci5nZXRFbGVtZW50c0J5VGFnTmFtZShcImltYWdlXCIpWzBdO1xuICAgICAgICAgICAgICBsLmltYWdlID0ge3NvdXJjZTogaW1hZ2VFbG0uZ2V0QXR0cmlidXRlKFwic291cmNlXCIpfTtcblxuICAgICAgICAgICAgICBkYXRhLnB1c2gobCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvL+OCsOODq+ODvOODl1xuICAgICAgICAgIGNhc2UgXCJncm91cFwiOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcblxuICAgIC8v44Ki44K744OD44OI44Gr54Sh44GE44Kk44Oh44O844K444OH44O844K/44KS6Kqt44G/6L6844G/XG4gICAgX2NoZWNrSW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3QgaW1hZ2VTb3VyY2UgPSBbXTtcbiAgICAgIGNvbnN0IGxvYWRJbWFnZSA9IFtdO1xuXG4gICAgICAvL+S4gOimp+S9nOaIkFxuICAgICAgdGhpcy50aWxlc2V0cy5mb3JFYWNoKHRpbGVzZXQgPT4ge1xuICAgICAgICBjb25zdCBvYmogPSB7XG4gICAgICAgICAgaXNUaWxlc2V0OiB0cnVlLFxuICAgICAgICAgIGltYWdlOiB0aWxlc2V0LnNvdXJjZSxcbiAgICAgICAgfTtcbiAgICAgICAgaW1hZ2VTb3VyY2UucHVzaChvYmopO1xuICAgICAgfSk7XG4gICAgICB0aGlzLmxheWVycy5mb3JFYWNoKGxheWVyID0+IHtcbiAgICAgICAgaWYgKGxheWVyLmltYWdlKSB7XG4gICAgICAgICAgY29uc3Qgb2JqID0ge1xuICAgICAgICAgICAgaXNUaWxlc2V0OiBmYWxzZSxcbiAgICAgICAgICAgIGltYWdlOiBsYXllci5pbWFnZS5zb3VyY2UsXG4gICAgICAgICAgfTtcbiAgICAgICAgICBpbWFnZVNvdXJjZS5wdXNoKG9iaik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvL+OCouOCu+ODg+ODiOOBq+OBguOCi+OBi+eiuuiqjVxuICAgICAgaW1hZ2VTb3VyY2UuZm9yRWFjaChlID0+IHtcbiAgICAgICAgaWYgKGUuaXNUaWxlc2V0KSB7XG4gICAgICAgICAgY29uc3QgdHN4ID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCgndHN4JywgZS5pbWFnZSk7XG4gICAgICAgICAgaWYgKCF0c3gpIHtcbiAgICAgICAgICAgIC8v44Ki44K744OD44OI44Gr44Gq44GL44Gj44Gf44Gu44Gn44Ot44O844OJ44Oq44K544OI44Gr6L+95YqgXG4gICAgICAgICAgICBsb2FkSW1hZ2UucHVzaChlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaW1hZ2UgPSBwaGluYS5hc3NldC5Bc3NldE1hbmFnZXIuZ2V0KCdpbWFnZScsIGUuaW1hZ2UpO1xuICAgICAgICAgIGlmICghaW1hZ2UpIHtcbiAgICAgICAgICAgIC8v44Ki44K744OD44OI44Gr44Gq44GL44Gj44Gf44Gu44Gn44Ot44O844OJ44Oq44K544OI44Gr6L+95YqgXG4gICAgICAgICAgICBsb2FkSW1hZ2UucHVzaChlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvL+S4gOaLrOODreODvOODiVxuICAgICAgLy/jg63jg7zjg4njg6rjgrnjg4jkvZzmiJBcbiAgICAgIGlmIChsb2FkSW1hZ2UubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHsgaW1hZ2U6IFtdLCB0c3g6IFtdIH07XG4gICAgICAgIGxvYWRJbWFnZS5mb3JFYWNoKGUgPT4ge1xuICAgICAgICAgIGlmIChlLmlzVGlsZXNldCkge1xuICAgICAgICAgICAgYXNzZXRzLnRzeFtlLmltYWdlXSA9IGUuaW1hZ2U7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8v44Ki44K744OD44OI44Gu44OR44K544KS44Oe44OD44OX44Go5ZCM44GY44Gr44GZ44KLXG4gICAgICAgICAgICBhc3NldHMuaW1hZ2VbZS5pbWFnZV0gPSB0aGlzLnBhdGggKyBlLmltYWdlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICBjb25zdCBsb2FkZXIgPSBwaGluYS5hc3NldC5Bc3NldExvYWRlcigpO1xuICAgICAgICAgIGxvYWRlci5sb2FkKGFzc2V0cyk7XG4gICAgICAgICAgbG9hZGVyLm9uKCdsb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy50aWxlc2V0cy5mb3JFYWNoKGUgPT4ge1xuICAgICAgICAgICAgICBlLnRzeCA9IHBoaW5hLmFzc2V0LkFzc2V0TWFuYWdlci5nZXQoJ3RzeCcsIGUuc291cmNlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy/jg57jg4Pjg5fjgqTjg6Hjg7zjgrjkvZzmiJBcbiAgICBfZ2VuZXJhdGVJbWFnZTogZnVuY3Rpb24obGF5ZXJOYW1lKSB7XG4gICAgICBsZXQgbnVtTGF5ZXIgPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodGhpcy5sYXllcnNbaV0udHlwZSA9PSBcImxheWVyXCIgfHwgdGhpcy5sYXllcnNbaV0udHlwZSA9PSBcImltYWdlbGF5ZXJcIikgbnVtTGF5ZXIrKztcbiAgICAgIH1cbiAgICAgIGlmIChudW1MYXllciA9PSAwKSByZXR1cm4gbnVsbDtcblxuICAgICAgY29uc3Qgd2lkdGggPSB0aGlzLndpZHRoICogdGhpcy50aWxld2lkdGg7XG4gICAgICBjb25zdCBoZWlnaHQgPSB0aGlzLmhlaWdodCAqIHRoaXMudGlsZWhlaWdodDtcbiAgICAgIGNvbnN0IGNhbnZhcyA9IHBoaW5hLmdyYXBoaWNzLkNhbnZhcygpLnNldFNpemUod2lkdGgsIGhlaWdodCk7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgLy/jg57jg4Pjg5fjg6zjgqTjg6Tjg7xcbiAgICAgICAgaWYgKHRoaXMubGF5ZXJzW2ldLnR5cGUgPT0gXCJsYXllclwiICYmIHRoaXMubGF5ZXJzW2ldLnZpc2libGUgIT0gXCIwXCIpIHtcbiAgICAgICAgICBpZiAobGF5ZXJOYW1lID09PSB1bmRlZmluZWQgfHwgbGF5ZXJOYW1lID09PSB0aGlzLmxheWVyc1tpXS5uYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWFwZGF0YSA9IGxheWVyLmRhdGE7XG4gICAgICAgICAgICBjb25zdCB3aWR0aCA9IGxheWVyLndpZHRoO1xuICAgICAgICAgICAgY29uc3QgaGVpZ2h0ID0gbGF5ZXIuaGVpZ2h0O1xuICAgICAgICAgICAgY29uc3Qgb3BhY2l0eSA9IGxheWVyLm9wYWNpdHkgfHwgMS4wO1xuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyspIHtcbiAgICAgICAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCB3aWR0aDsgeCsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSBtYXBkYXRhW2NvdW50XTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggIT09IDApIHtcbiAgICAgICAgICAgICAgICAgIC8v44Oe44OD44OX44OB44OD44OX44KS6YWN572uXG4gICAgICAgICAgICAgICAgICB0aGlzLl9zZXRNYXBDaGlwKGNhbnZhcywgaW5kZXgsIHggKiB0aGlzLnRpbGV3aWR0aCwgeSAqIHRoaXMudGlsZWhlaWdodCwgb3BhY2l0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy/jgqrjg5bjgrjjgqfjgq/jg4jjgrDjg6vjg7zjg5dcbiAgICAgICAgaWYgKHRoaXMubGF5ZXJzW2ldLnR5cGUgPT0gXCJvYmplY3Rncm91cFwiICYmIHRoaXMubGF5ZXJzW2ldLnZpc2libGUgIT0gXCIwXCIpIHtcbiAgICAgICAgICBpZiAobGF5ZXJOYW1lID09PSB1bmRlZmluZWQgfHwgbGF5ZXJOYW1lID09PSB0aGlzLmxheWVyc1tpXS5uYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3Qgb3BhY2l0eSA9IGxheWVyLm9wYWNpdHkgfHwgMS4wO1xuICAgICAgICAgICAgbGF5ZXIub2JqZWN0cy5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgaWYgKGUuZ2lkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0TWFwQ2hpcChjYW52YXMsIGUuZ2lkLCBlLngsIGUueSwgb3BhY2l0eSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8v44Kk44Oh44O844K444Os44Kk44Ok44O8XG4gICAgICAgIGlmICh0aGlzLmxheWVyc1tpXS50eXBlID09IFwiaW1hZ2VsYXllclwiICYmIHRoaXMubGF5ZXJzW2ldLnZpc2libGUgIT0gXCIwXCIpIHtcbiAgICAgICAgICBpZiAobGF5ZXJOYW1lID09PSB1bmRlZmluZWQgfHwgbGF5ZXJOYW1lID09PSB0aGlzLmxheWVyc1tpXS5uYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBpbWFnZSA9IHBoaW5hLmFzc2V0LkFzc2V0TWFuYWdlci5nZXQoJ2ltYWdlJywgdGhpcy5sYXllcnNbaV0uaW1hZ2Uuc291cmNlKTtcbiAgICAgICAgICAgIGNhbnZhcy5jb250ZXh0LmRyYXdJbWFnZShpbWFnZS5kb21FbGVtZW50LCB0aGlzLmxheWVyc1tpXS54LCB0aGlzLmxheWVyc1tpXS55KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgdGV4dHVyZSA9IHBoaW5hLmFzc2V0LlRleHR1cmUoKTtcbiAgICAgIHRleHR1cmUuZG9tRWxlbWVudCA9IGNhbnZhcy5kb21FbGVtZW50O1xuICAgICAgcmV0dXJuIHRleHR1cmU7XG4gICAgfSxcblxuICAgIC8v44Kt44Oj44Oz44OQ44K544Gu5oyH5a6a44GX44Gf5bqn5qiZ44Gr44Oe44OD44OX44OB44OD44OX44Gu44Kk44Oh44O844K444KS44Kz44OU44O844GZ44KLXG4gICAgX3NldE1hcENoaXA6IGZ1bmN0aW9uKGNhbnZhcywgaW5kZXgsIHgsIHksIG9wYWNpdHkpIHtcbiAgICAgIC8v5a++6LGh44K/44Kk44Or44K744OD44OI44Gu5Yik5YilXG4gICAgICBsZXQgdGlsZXNldDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy50aWxlc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB0c3gxID0gdGhpcy50aWxlc2V0c1tpXTtcbiAgICAgICAgY29uc3QgdHN4MiA9IHRoaXMudGlsZXNldHNbaSArIDFdO1xuICAgICAgICBpZiAoIXRzeDIpIHtcbiAgICAgICAgICB0aWxlc2V0ID0gdHN4MTtcbiAgICAgICAgICBpID0gdGhpcy50aWxlc2V0cy5sZW5ndGg7XG4gICAgICAgIH0gZWxzZSBpZiAodHN4MS5maXJzdGdpZCA8PSBpbmRleCAmJiBpbmRleCA8IHRzeDIuZmlyc3RnaWQpIHtcbiAgICAgICAgICB0aWxlc2V0ID0gdHN4MTtcbiAgICAgICAgICBpID0gdGhpcy50aWxlc2V0cy5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8v44K/44Kk44Or44K744OD44OI44GL44KJ44Oe44OD44OX44OB44OD44OX44KS5Y+W5b6XXG4gICAgICBjb25zdCB0c3ggPSB0aWxlc2V0LnRzeDtcbiAgICAgIGNvbnN0IGNoaXAgPSB0c3guY2hpcHNbaW5kZXggLSB0aWxlc2V0LmZpcnN0Z2lkXTtcbiAgICAgIGNvbnN0IGltYWdlID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCgnaW1hZ2UnLCBjaGlwLmltYWdlKTtcbiAgICAgIGNhbnZhcy5jb250ZXh0LmRyYXdJbWFnZShcbiAgICAgICAgaW1hZ2UuZG9tRWxlbWVudCxcbiAgICAgICAgY2hpcC54ICsgdHN4Lm1hcmdpbiwgY2hpcC55ICsgdHN4Lm1hcmdpbixcbiAgICAgICAgdHN4LnRpbGV3aWR0aCwgdHN4LnRpbGVoZWlnaHQsXG4gICAgICAgIHgsIHksXG4gICAgICAgIHRzeC50aWxld2lkdGgsIHRzeC50aWxlaGVpZ2h0KTtcbiAgICB9LFxuXG4gIH0pO1xuXG4gIC8v44Ot44O844OA44O844Gr6L+95YqgXG4gIHBoaW5hLmFzc2V0LkFzc2V0TG9hZGVyLmFzc2V0TG9hZEZ1bmN0aW9ucy50bXggPSBmdW5jdGlvbihrZXksIHBhdGgpIHtcbiAgICBjb25zdCB0bXggPSBwaGluYS5hc3NldC5UaWxlZE1hcCgpO1xuICAgIHJldHVybiB0bXgubG9hZChwYXRoKTtcbiAgfTtcblxufSk7IiwiLypcbiAqICBwaGluYS5UaWxlc2V0LmpzXG4gKiAgMjAxOS85LzEyXG4gKiAgQGF1dGhlciBtaW5pbW8gIFxuICogIFRoaXMgUHJvZ3JhbSBpcyBNSVQgbGljZW5zZS5cbiAqXG4gKi9cblxucGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZShcInBoaW5hLmFzc2V0LlRpbGVTZXRcIiwge1xuICAgIHN1cGVyQ2xhc3M6IFwicGhpbmEuYXNzZXQuWE1MTG9hZGVyXCIsXG5cbiAgICBpbWFnZTogbnVsbCxcbiAgICB0aWxld2lkdGg6IDAsXG4gICAgdGlsZWhlaWdodDogMCxcbiAgICB0aWxlY291bnQ6IDAsXG4gICAgY29sdW1uczogMCxcblxuICAgIGluaXQ6IGZ1bmN0aW9uKHhtbCkge1xuICAgICAgICB0aGlzLnN1cGVySW5pdCgpO1xuICAgICAgICBpZiAoeG1sKSB7XG4gICAgICAgICAgdGhpcy5sb2FkRnJvbVhNTCh4bWwpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9sb2FkOiBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgICAvL+ODkeOCueaKnOOBjeWHuuOBl1xuICAgICAgdGhpcy5wYXRoID0gXCJcIjtcbiAgICAgIGNvbnN0IGxhc3QgPSB0aGlzLnNyYy5sYXN0SW5kZXhPZihcIi9cIik7XG4gICAgICBpZiAobGFzdCA+IDApIHtcbiAgICAgICAgdGhpcy5wYXRoID0gdGhpcy5zcmMuc3Vic3RyaW5nKDAsIGxhc3QgKyAxKTtcbiAgICAgIH1cblxuICAgICAgLy/ntYLkuobplqLmlbDkv53lrZhcbiAgICAgIHRoaXMuX3Jlc29sdmUgPSByZXNvbHZlO1xuXG4gICAgICAvLyBsb2FkXG4gICAgICBjb25zdCB4bWwgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgIHhtbC5vcGVuKCdHRVQnLCB0aGlzLnNyYyk7XG4gICAgICB4bWwub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICBpZiAoeG1sLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICBpZiAoWzIwMCwgMjAxLCAwXS5pbmRleE9mKHhtbC5zdGF0dXMpICE9PSAtMSkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IChuZXcgRE9NUGFyc2VyKCkpLnBhcnNlRnJvbVN0cmluZyh4bWwucmVzcG9uc2VUZXh0LCBcInRleHQveG1sXCIpO1xuICAgICAgICAgICAgdGhpcy5kYXRhVHlwZSA9IFwieG1sXCI7XG4gICAgICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgdGhpcy5fcGFyc2UoZGF0YSlcbiAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fcmVzb2x2ZSh0aGlzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgeG1sLnNlbmQobnVsbCk7XG4gICAgfSxcblxuICAgIGxvYWRGcm9tWE1MOiBmdW5jdGlvbih4bWwpIHtcbiAgICAgIHJldHVybiB0aGlzLl9wYXJzZSh4bWwpO1xuICAgIH0sXG5cbiAgICBfcGFyc2U6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgLy/jgr/jgqTjg6vjgrvjg4Pjg4jlj5blvpdcbiAgICAgICAgY29uc3QgdGlsZXNldCA9IGRhdGEuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3RpbGVzZXQnKVswXTtcbiAgICAgICAgY29uc3QgcHJvcHMgPSB0aGlzLl9wcm9wZXJ0aWVzVG9KU09OKHRpbGVzZXQpO1xuXG4gICAgICAgIC8v44K/44Kk44Or44K744OD44OI5bGe5oCn5oOF5aCx5Y+W5b6XXG4gICAgICAgIGNvbnN0IGF0dHIgPSB0aGlzLl9hdHRyVG9KU09OKHRpbGVzZXQpO1xuICAgICAgICBhdHRyLiRzYWZlKHtcbiAgICAgICAgICB0aWxld2lkdGg6IDMyLFxuICAgICAgICAgIHRpbGVoZWlnaHQ6IDMyLFxuICAgICAgICAgIHNwYWNpbmc6IDAsXG4gICAgICAgICAgbWFyZ2luOiAwLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy4kZXh0ZW5kKGF0dHIpO1xuICAgICAgICB0aGlzLmNoaXBzID0gW107XG5cbiAgICAgICAgLy/jgr3jg7zjgrnnlLvlg4/oqK3lrprlj5blvpdcbiAgICAgICAgdGhpcy5pbWFnZU5hbWUgPSB0aWxlc2V0LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdpbWFnZScpWzBdLmdldEF0dHJpYnV0ZSgnc291cmNlJyk7XG4gIFxuICAgICAgICAvL+mAj+mBjuiJsuioreWumuWPluW+l1xuICAgICAgICBjb25zdCB0cmFucyA9IHRpbGVzZXQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2ltYWdlJylbMF0uZ2V0QXR0cmlidXRlKCd0cmFucycpO1xuICAgICAgICBpZiAodHJhbnMpIHtcbiAgICAgICAgICB0aGlzLnRyYW5zUiA9IHBhcnNlSW50KHRyYW5zLnN1YnN0cmluZygwLCAyKSwgMTYpO1xuICAgICAgICAgIHRoaXMudHJhbnNHID0gcGFyc2VJbnQodHJhbnMuc3Vic3RyaW5nKDIsIDQpLCAxNik7XG4gICAgICAgICAgdGhpcy50cmFuc0IgPSBwYXJzZUludCh0cmFucy5zdWJzdHJpbmcoNCwgNiksIDE2KTtcbiAgICAgICAgfVxuICBcbiAgICAgICAgLy/jg57jg4Pjg5fjg4Hjg4Pjg5fjg6rjgrnjg4jkvZzmiJBcbiAgICAgICAgZm9yIChsZXQgciA9IDA7IHIgPCB0aGlzLnRpbGVjb3VudDsgcisrKSB7XG4gICAgICAgICAgY29uc3QgY2hpcCA9IHtcbiAgICAgICAgICAgIGltYWdlOiB0aGlzLmltYWdlTmFtZSxcbiAgICAgICAgICAgIHg6IChyICAlIHRoaXMuY29sdW1ucykgKiAodGhpcy50aWxld2lkdGggKyB0aGlzLnNwYWNpbmcpICsgdGhpcy5tYXJnaW4sXG4gICAgICAgICAgICB5OiBNYXRoLmZsb29yKHIgLyB0aGlzLmNvbHVtbnMpICogKHRoaXMudGlsZWhlaWdodCArIHRoaXMuc3BhY2luZykgKyB0aGlzLm1hcmdpbixcbiAgICAgICAgICB9O1xuICAgICAgICAgIHRoaXMuY2hpcHNbcl0gPSBjaGlwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy/jgqTjg6Hjg7zjgrjjg4fjg7zjgr/oqq3jgb/ovrzjgb9cbiAgICAgICAgdGhpcy5fbG9hZEltYWdlKClcbiAgICAgICAgICAudGhlbigoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8v44Ki44K744OD44OI44Gr54Sh44GE44Kk44Oh44O844K444OH44O844K/44KS6Kqt44G/6L6844G/XG4gICAgX2xvYWRJbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgIGNvbnN0IGltYWdlU291cmNlID0ge1xuICAgICAgICAgIGltYWdlTmFtZTogdGhpcy5pbWFnZU5hbWUsXG4gICAgICAgICAgaW1hZ2VVcmw6IHRoaXMucGF0aCArIHRoaXMuaW1hZ2VOYW1lLFxuICAgICAgICAgIHRyYW5zUjogdGhpcy50cmFuc1IsXG4gICAgICAgICAgdHJhbnNHOiB0aGlzLnRyYW5zRyxcbiAgICAgICAgICB0cmFuc0I6IHRoaXMudHJhbnNCLFxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgbGV0IGxvYWRJbWFnZSA9IG51bGw7XG4gICAgICAgIGNvbnN0IGltYWdlID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCgnaW1hZ2UnLCBpbWFnZVNvdXJjZS5pbWFnZSk7XG4gICAgICAgIGlmIChpbWFnZSkge1xuICAgICAgICAgIHRoaXMuaW1hZ2UgPSBpbWFnZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2FkSW1hZ2UgPSBpbWFnZVNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8v44Ot44O844OJ44Oq44K544OI5L2c5oiQXG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHsgaW1hZ2U6IFtdIH07XG4gICAgICAgIGFzc2V0cy5pbWFnZVtpbWFnZVNvdXJjZS5pbWFnZU5hbWVdID0gaW1hZ2VTb3VyY2UuaW1hZ2VVcmw7XG5cbiAgICAgICAgaWYgKGxvYWRJbWFnZSkge1xuICAgICAgICAgIGNvbnN0IGxvYWRlciA9IHBoaW5hLmFzc2V0LkFzc2V0TG9hZGVyKCk7XG4gICAgICAgICAgbG9hZGVyLmxvYWQoYXNzZXRzKTtcbiAgICAgICAgICBsb2FkZXIub24oJ2xvYWQnLCBlID0+IHtcbiAgICAgICAgICAgIC8v6YCP6YGO6Imy6Kit5a6a5Y+N5pigXG4gICAgICAgICAgICB0aGlzLmltYWdlID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCgnaW1hZ2UnLCBpbWFnZVNvdXJjZS5pbWFnZVVybCk7XG4gICAgICAgICAgICBpZiAoaW1hZ2VTb3VyY2UudHJhbnNSICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29uc3QgciA9IGltYWdlU291cmNlLnRyYW5zUjtcbiAgICAgICAgICAgICAgY29uc3QgZyA9IGltYWdlU291cmNlLnRyYW5zRztcbiAgICAgICAgICAgICAgY29uc3QgYiA9IGltYWdlU291cmNlLnRyYW5zQjtcbiAgICAgICAgICAgICAgdGhpcy5pbWFnZS5maWx0ZXIoKHBpeGVsLCBpbmRleCwgeCwgeSwgYml0bWFwKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IGJpdG1hcC5kYXRhO1xuICAgICAgICAgICAgICAgIGlmIChwaXhlbFswXSA9PSByICYmIHBpeGVsWzFdID09IGcgJiYgcGl4ZWxbMl0gPT0gYikge1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2luZGV4KzNdID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgLy/jg63jg7zjg4Djg7zjgavov73liqBcbiAgcGhpbmEuYXNzZXQuQXNzZXRMb2FkZXIuYXNzZXRMb2FkRnVuY3Rpb25zLnRzeCA9IGZ1bmN0aW9uKGtleSwgcGF0aCkge1xuICAgIGNvbnN0IHRzeCA9IHBoaW5hLmFzc2V0LlRpbGVTZXQoKTtcbiAgICByZXR1cm4gdHN4LmxvYWQocGF0aCk7XG4gIH07XG5cbn0pOyIsIi8vXG4vLyDmsY7nlKjplqLmlbDnvqRcbi8vXG5waGluYS5kZWZpbmUoXCJVdGlsXCIsIHtcbiAgX3N0YXRpYzoge1xuXG4gICAgLy/mjIflrprjgZXjgozjgZ/jgqrjg5bjgrjjgqfjgq/jg4jjgpLjg6vjg7zjg4jjgajjgZfjgabnm67nmoTjga5pZOOCkui1sOafu+OBmeOCi1xuICAgIGZpbmRCeUlkOiBmdW5jdGlvbihpZCwgb2JqKSB7XG4gICAgICBpZiAob2JqLmlkID09PSBpZCkgcmV0dXJuIG9iajtcbiAgICAgIGNvbnN0IGNoaWxkcmVuID0gT2JqZWN0LmtleXMob2JqLmNoaWxkcmVuIHx8IHt9KS5tYXAoa2V5ID0+IG9iai5jaGlsZHJlbltrZXldKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgaGl0ID0gdGhpcy5maW5kQnlJZChpZCwgY2hpbGRyZW5baV0pO1xuICAgICAgICBpZiAoaGl0KSByZXR1cm4gaGl0O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuICAgIC8vVE9ETzrjgZPjgZPjgZjjgoPjgarjgYTmhJ/jgYzjgYLjgovjga7jgafjgZnjgYzjgIHkuIDml6blrp/oo4VcbiAgICAvL+aMh+WumuOBleOCjOOBn0HjgahC44GuYXNzZXRz44Gu6YCj5oOz6YWN5YiX44KS5paw6KaP44Gu44Kq44OW44K444Kn44Kv44OI44Gr44Oe44O844K444GZ44KLXG4gICAgbWVyZ2VBc3NldHM6IGZ1bmN0aW9uKGFzc2V0c0EsIGFzc2V0c0IpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgYXNzZXRzQS5mb3JJbigodHlwZUtleSwgdHlwZVZhbHVlKSA9PiB7XG4gICAgICAgIGlmICghcmVzdWx0LiRoYXModHlwZUtleSkpIHJlc3VsdFt0eXBlS2V5XSA9IHt9O1xuICAgICAgICB0eXBlVmFsdWUuZm9ySW4oKGFzc2V0S2V5LCBhc3NldFBhdGgpID0+IHtcbiAgICAgICAgICByZXN1bHRbdHlwZUtleV1bYXNzZXRLZXldID0gYXNzZXRQYXRoO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgYXNzZXRzQi5mb3JJbigodHlwZUtleSwgdHlwZVZhbHVlKSA9PiB7XG4gICAgICAgIGlmICghcmVzdWx0LiRoYXModHlwZUtleSkpIHJlc3VsdFt0eXBlS2V5XSA9IHt9O1xuICAgICAgICB0eXBlVmFsdWUuZm9ySW4oKGFzc2V0S2V5LCBhc3NldFBhdGgpID0+IHtcbiAgICAgICAgICByZXN1bHRbdHlwZUtleV1bYXNzZXRLZXldID0gYXNzZXRQYXRoO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLy/nj77lnKjmmYLplpPjgYvjgonmjIflrprmmYLplpPjgb7jgafjganjga7jgY/jgonjgYTjgYvjgYvjgovjgYvjgpLov5TljbTjgZnjgotcbiAgICAvL1xuICAgIC8vIG91dHB1dCA6IHsgXG4gICAgLy8gICB0b3RhbERhdGU6MCAsIFxuICAgIC8vICAgdG90YWxIb3VyOjAgLCBcbiAgICAvLyAgIHRvdGFsTWludXRlczowICwgXG4gICAgLy8gICB0b3RhbFNlY29uZHM6MCAsXG4gICAgLy8gICBkYXRlOjAgLCBcbiAgICAvLyAgIGhvdXI6MCAsIFxuICAgIC8vICAgbWludXRlczowICwgXG4gICAgLy8gICBzZWNvbmRzOjAgXG4gICAgLy8gfVxuICAgIC8vXG5cbiAgICBjYWxjUmVtYWluaW5nVGltZTogZnVuY3Rpb24oZmluaXNoKSB7XG4gICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICBcInRvdGFsRGF0ZVwiOiAwLFxuICAgICAgICBcInRvdGFsSG91clwiOiAwLFxuICAgICAgICBcInRvdGFsTWludXRlc1wiOiAwLFxuICAgICAgICBcInRvdGFsU2Vjb25kc1wiOiAwLFxuICAgICAgICBcImRhdGVcIjogMCxcbiAgICAgICAgXCJob3VyXCI6IDAsXG4gICAgICAgIFwibWludXRlc1wiOiAwLFxuICAgICAgICBcInNlY29uZHNcIjogMCxcbiAgICAgIH1cblxuICAgICAgZmluaXNoID0gKGZpbmlzaCBpbnN0YW5jZW9mIERhdGUpID8gZmluaXNoIDogbmV3IERhdGUoZmluaXNoKTtcbiAgICAgIGxldCBkaWZmID0gZmluaXNoIC0gbm93O1xuICAgICAgaWYgKGRpZmYgPT09IDApIHJldHVybiByZXN1bHQ7XG5cbiAgICAgIGNvbnN0IHNpZ24gPSAoZGlmZiA8IDApID8gLTEgOiAxO1xuXG4gICAgICAvL1RPRE8644GT44Gu6L6644KK44KC44GG5bCR44GX57a66bqX44Gr5pu444GR44Gq44GE44GL5qSc6KiOXG4gICAgICAvL+WNmOS9jeWIpSAx5pyq5rqA44GvMFxuICAgICAgcmVzdWx0W1widG90YWxEYXRlXCJdID0gcGFyc2VJbnQoZGlmZiAvIDEwMDAgLyA2MCAvIDYwIC8gMjQpO1xuICAgICAgcmVzdWx0W1widG90YWxIb3VyXCJdID0gcGFyc2VJbnQoZGlmZiAvIDEwMDAgLyA2MCAvIDYwKTtcbiAgICAgIHJlc3VsdFtcInRvdGFsTWludXRlc1wiXSA9IHBhcnNlSW50KGRpZmYgLyAxMDAwIC8gNjApO1xuICAgICAgcmVzdWx0W1widG90YWxTZWNvbmRzXCJdID0gcGFyc2VJbnQoZGlmZiAvIDEwMDApO1xuXG4gICAgICBkaWZmIC09IHJlc3VsdFtcInRvdGFsRGF0ZVwiXSAqIDg2NDAwMDAwO1xuICAgICAgcmVzdWx0W1wiaG91clwiXSA9IHBhcnNlSW50KGRpZmYgLyAxMDAwIC8gNjAgLyA2MCk7XG5cbiAgICAgIGRpZmYgLT0gcmVzdWx0W1wiaG91clwiXSAqIDM2MDAwMDA7XG4gICAgICByZXN1bHRbXCJtaW51dGVzXCJdID0gcGFyc2VJbnQoZGlmZiAvIDEwMDAgLyA2MCk7XG5cbiAgICAgIGRpZmYgLT0gcmVzdWx0W1wibWludXRlc1wiXSAqIDYwMDAwO1xuICAgICAgcmVzdWx0W1wic2Vjb25kc1wiXSA9IHBhcnNlSW50KGRpZmYgLyAxMDAwKTtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgIH0sXG5cbiAgICAvL+ODrOOCpOOCouOCpuODiOOCqOODh+OCo+OCv+ODvOOBp+OBr1Nwcml0ZeWFqOOBpkF0YWxzU3ByaXRl44Gr44Gq44Gj44Gm44GX44G+44GG44Gf44KB44CBXG4gICAgLy9TcHJpdGXjgavlt67jgZfmm7/jgYjjgonjgozjgovjgojjgYbjgavjgZnjgotcblxuICAgIC8vQXRsYXNTcHJpdGXoh6rouqvjgavljZjnmbrjga5JbWFnZeOCkuOCu+ODg+ODiOOBp+OBjeOCi+OCiOOBhuOBq+OBmeOCi++8n1xuICAgIC8v44GC44Go44Gn44Gq44Gr44GL44GX44KJ5a++562W44GX44Gq44GE44Go44Gg44KB44Gg44GM77yT5pyI57SN5ZOB44Gn44Gv5LiA5pem44GT44KM44GnXG4gICAgcmVwbGFjZUF0bGFzU3ByaXRlVG9TcHJpdGU6IGZ1bmN0aW9uKHBhcmVudCwgYXRsYXNTcHJpdGUsIHNwcml0ZSkge1xuICAgICAgY29uc3QgaW5kZXggPSBwYXJlbnQuZ2V0Q2hpbGRJbmRleChhdGxhc1Nwcml0ZSk7XG4gICAgICBzcHJpdGUuc2V0T3JpZ2luKGF0bGFzU3ByaXRlLm9yaWdpblgsIGF0bGFzU3ByaXRlLm9yaWdpblkpO1xuICAgICAgc3ByaXRlLnNldFBvc2l0aW9uKGF0bGFzU3ByaXRlLngsIGF0bGFzU3ByaXRlLnkpO1xuICAgICAgcGFyZW50LmFkZENoaWxkQXQoc3ByaXRlLCBpbmRleCk7XG4gICAgICBhdGxhc1Nwcml0ZS5yZW1vdmUoKTtcbiAgICAgIHJldHVybiBzcHJpdGU7XG4gICAgfSxcbiAgfVxufSk7XG4iLCIvKlxuICogIHBoaW5hLnhtbGxvYWRlci5qc1xuICogIDIwMTkvOS8xMlxuICogIEBhdXRoZXIgbWluaW1vICBcbiAqICBUaGlzIFByb2dyYW0gaXMgTUlUIGxpY2Vuc2UuXG4gKlxuICovXG5cbnBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kZWZpbmUoXCJwaGluYS5hc3NldC5YTUxMb2FkZXJcIiwge1xuICAgIHN1cGVyQ2xhc3M6IFwicGhpbmEuYXNzZXQuQXNzZXRcIixcblxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnN1cGVySW5pdCgpO1xuICAgIH0sXG5cbiAgICBfbG9hZDogZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0sXG5cbiAgICAvL1hNTOODl+ODreODkeODhuOCo+OCkkpTT07jgavlpInmj5tcbiAgICBfcHJvcGVydGllc1RvSlNPTjogZnVuY3Rpb24oZWxtKSB7XG4gICAgICBjb25zdCBwcm9wZXJ0aWVzID0gZWxtLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwicHJvcGVydGllc1wiKVswXTtcbiAgICAgIGNvbnN0IG9iaiA9IHt9O1xuICAgICAgaWYgKHByb3BlcnRpZXMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIG9iajtcblxuICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBwcm9wZXJ0aWVzLmNoaWxkTm9kZXMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgY29uc3QgcCA9IHByb3BlcnRpZXMuY2hpbGROb2Rlc1trXTtcbiAgICAgICAgaWYgKHAudGFnTmFtZSA9PT0gXCJwcm9wZXJ0eVwiKSB7XG4gICAgICAgICAgLy9wcm9wZXJ0eeOBq3R5cGXmjIflrprjgYzjgYLjgaPjgZ/jgonlpInmj5tcbiAgICAgICAgICBjb25zdCB0eXBlID0gcC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKTtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IHAuZ2V0QXR0cmlidXRlKCd2YWx1ZScpO1xuICAgICAgICAgIGlmICghdmFsdWUpIHZhbHVlID0gcC50ZXh0Q29udGVudDtcbiAgICAgICAgICBpZiAodHlwZSA9PSBcImludFwiKSB7XG4gICAgICAgICAgICBvYmpbcC5nZXRBdHRyaWJ1dGUoJ25hbWUnKV0gPSBwYXJzZUludCh2YWx1ZSwgMTApO1xuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImZsb2F0XCIpIHtcbiAgICAgICAgICAgIG9ialtwLmdldEF0dHJpYnV0ZSgnbmFtZScpXSA9IHBhcnNlRmxvYXQodmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImJvb2xcIiApIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PSBcInRydWVcIikgb2JqW3AuZ2V0QXR0cmlidXRlKCduYW1lJyldID0gdHJ1ZTtcbiAgICAgICAgICAgIGVsc2Ugb2JqW3AuZ2V0QXR0cmlidXRlKCduYW1lJyldID0gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9ialtwLmdldEF0dHJpYnV0ZSgnbmFtZScpXSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG9iajtcbiAgICB9LFxuXG4gICAgLy9YTUzlsZ7mgKfjgpJKU09O44Gr5aSJ5o+bXG4gICAgX2F0dHJUb0pTT046IGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgY29uc3Qgb2JqID0ge307XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZS5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCB2YWwgPSBzb3VyY2UuYXR0cmlidXRlc1tpXS52YWx1ZTtcbiAgICAgICAgdmFsID0gaXNOYU4ocGFyc2VGbG9hdCh2YWwpKT8gdmFsOiBwYXJzZUZsb2F0KHZhbCk7XG4gICAgICAgIG9ialtzb3VyY2UuYXR0cmlidXRlc1tpXS5uYW1lXSA9IHZhbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSxcblxuICAgIC8vWE1M5bGe5oCn44KSSlNPTuOBq+WkieaPm++8iFN0cmluZ+OBp+i/lOOBme+8iVxuICAgIF9hdHRyVG9KU09OX3N0cjogZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICBjb25zdCBvYmogPSB7fTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc291cmNlLmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgdmFsID0gc291cmNlLmF0dHJpYnV0ZXNbaV0udmFsdWU7XG4gICAgICAgIG9ialtzb3VyY2UuYXR0cmlidXRlc1tpXS5uYW1lXSA9IHZhbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSxcblxuICAgIC8vQ1NW44OR44O844K5XG4gICAgX3BhcnNlQ1NWOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBjb25zdCBkYXRhTGlzdCA9IGRhdGEuc3BsaXQoJywnKTtcbiAgICAgIGNvbnN0IGxheWVyID0gW107XG5cbiAgICAgIGRhdGFMaXN0LmVhY2goZWxtID0+IHtcbiAgICAgICAgY29uc3QgbnVtID0gcGFyc2VJbnQoZWxtLCAxMCk7XG4gICAgICAgIGxheWVyLnB1c2gobnVtKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gbGF5ZXI7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEJBU0U2NOODkeODvOOCuVxuICAgICAqIGh0dHA6Ly90aGVrYW5ub24tc2VydmVyLmFwcHNwb3QuY29tL2hlcnBpdHktZGVycGl0eS5hcHBzcG90LmNvbS9wYXN0ZWJpbi5jb20vNzVLa3MwV0hcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZUJhc2U2NDogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgY29uc3QgZGF0YUxpc3QgPSBhdG9iKGRhdGEudHJpbSgpKTtcbiAgICAgIGNvbnN0IHJzdCA9IFtdO1xuXG4gICAgICBkYXRhTGlzdCA9IGRhdGFMaXN0LnNwbGl0KCcnKS5tYXAoZSA9PiBlLmNoYXJDb2RlQXQoMCkpO1xuXG4gICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZGF0YUxpc3QubGVuZ3RoIC8gNDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIGNvbnN0IG4gPSBkYXRhTGlzdFtpKjRdO1xuICAgICAgICByc3RbaV0gPSBwYXJzZUludChuLCAxMCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByc3Q7XG4gICAgfSxcbiAgfSk7XG5cbn0pOyIsInBoaW5hLmFzc2V0LkFzc2V0TG9hZGVyLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGxvYWRBc3NldHMgPSBbXTtcbiAgdmFyIGNvdW50ZXIgPSAwO1xuICB2YXIgbGVuZ3RoID0gMDtcbiAgdmFyIG1heENvbm5lY3Rpb25Db3VudCA9IDI7XG5cbiAgcGFyYW1zLmZvckluKGZ1bmN0aW9uKHR5cGUsIGFzc2V0cykge1xuICAgIGxlbmd0aCArPSBPYmplY3Qua2V5cyhhc3NldHMpLmxlbmd0aDtcbiAgfSk7XG5cbiAgaWYgKGxlbmd0aCA9PSAwKSB7XG4gICAgcmV0dXJuIHBoaW5hLnV0aWwuRmxvdy5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgIHNlbGYuZmxhcmUoJ2xvYWQnKTtcbiAgICB9KTtcbiAgfVxuXG4gIHBhcmFtcy5mb3JJbihmdW5jdGlvbih0eXBlLCBhc3NldHMpIHtcbiAgICBhc3NldHMuZm9ySW4oZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgbG9hZEFzc2V0cy5wdXNoKHtcbiAgICAgICAgXCJmdW5jXCI6IHBoaW5hLmFzc2V0LkFzc2V0TG9hZGVyLmFzc2V0TG9hZEZ1bmN0aW9uc1t0eXBlXSxcbiAgICAgICAgXCJrZXlcIjoga2V5LFxuICAgICAgICBcInZhbHVlXCI6IHZhbHVlLFxuICAgICAgICBcInR5cGVcIjogdHlwZSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICBpZiAoc2VsZi5jYWNoZSkge1xuICAgIHNlbGYub24oJ3Byb2dyZXNzJywgZnVuY3Rpb24oZSkge1xuICAgICAgaWYgKGUucHJvZ3Jlc3MgPj0gMS4wKSB7XG4gICAgICAgIHBhcmFtcy5mb3JJbihmdW5jdGlvbih0eXBlLCBhc3NldHMpIHtcbiAgICAgICAgICBhc3NldHMuZm9ySW4oZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgdmFyIGFzc2V0ID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCh0eXBlLCBrZXkpO1xuICAgICAgICAgICAgaWYgKGFzc2V0LmxvYWRFcnJvcikge1xuICAgICAgICAgICAgICB2YXIgZHVtbXkgPSBwaGluYS5hc3NldC5Bc3NldE1hbmFnZXIuZ2V0KHR5cGUsICdkdW1teScpO1xuICAgICAgICAgICAgICBpZiAoZHVtbXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoZHVtbXkubG9hZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICBkdW1teS5sb2FkRHVtbXkoKTtcbiAgICAgICAgICAgICAgICAgIGR1bW15LmxvYWRFcnJvciA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwaGluYS5hc3NldC5Bc3NldE1hbmFnZXIuc2V0KHR5cGUsIGtleSwgZHVtbXkpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFzc2V0LmxvYWREdW1teSgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgdmFyIGxvYWRBc3NldHNBcnJheSA9IFtdO1xuXG4gIHdoaWxlIChsb2FkQXNzZXRzLmxlbmd0aCA+IDApIHtcbiAgICBsb2FkQXNzZXRzQXJyYXkucHVzaChsb2FkQXNzZXRzLnNwbGljZSgwLCBtYXhDb25uZWN0aW9uQ291bnQpKTtcbiAgfVxuXG4gIHZhciBmbG93ID0gcGhpbmEudXRpbC5GbG93LnJlc29sdmUoKTtcblxuICBsb2FkQXNzZXRzQXJyYXkuZm9yRWFjaChmdW5jdGlvbihsb2FkQXNzZXRzKSB7XG4gICAgZmxvdyA9IGZsb3cudGhlbihmdW5jdGlvbigpIHtcbiAgICAgIHZhciBmbG93cyA9IFtdO1xuICAgICAgbG9hZEFzc2V0cy5mb3JFYWNoKGZ1bmN0aW9uKGxvYWRBc3NldCkge1xuICAgICAgICB2YXIgZiA9IGxvYWRBc3NldC5mdW5jKGxvYWRBc3NldC5rZXksIGxvYWRBc3NldC52YWx1ZSk7XG4gICAgICAgIGYudGhlbihmdW5jdGlvbihhc3NldCkge1xuICAgICAgICAgIGlmIChzZWxmLmNhY2hlKSB7XG4gICAgICAgICAgICBwaGluYS5hc3NldC5Bc3NldE1hbmFnZXIuc2V0KGxvYWRBc3NldC50eXBlLCBsb2FkQXNzZXQua2V5LCBhc3NldCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlbGYuZmxhcmUoJ3Byb2dyZXNzJywge1xuICAgICAgICAgICAga2V5OiBsb2FkQXNzZXQua2V5LFxuICAgICAgICAgICAgYXNzZXQ6IGFzc2V0LFxuICAgICAgICAgICAgcHJvZ3Jlc3M6ICgrK2NvdW50ZXIgLyBsZW5ndGgpLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgZmxvd3MucHVzaChmKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHBoaW5hLnV0aWwuRmxvdy5hbGwoZmxvd3MpO1xuICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gZmxvdy50aGVuKGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICBzZWxmLmZsYXJlKCdsb2FkJyk7XG4gIH0pO1xufVxuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmFwcC5CYXNlQXBwLnByb3RvdHlwZS4kbWV0aG9kKFwicmVwbGFjZVNjZW5lXCIsIGZ1bmN0aW9uKHNjZW5lKSB7XG4gICAgdGhpcy5mbGFyZSgncmVwbGFjZScpO1xuICAgIHRoaXMuZmxhcmUoJ2NoYW5nZXNjZW5lJyk7XG5cbiAgICB3aGlsZSAodGhpcy5fc2NlbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5fc2NlbmVzLnBvcCgpO1xuICAgICAgc2NlbmUuZmxhcmUoXCJkZXN0cm95XCIpO1xuICAgIH1cblxuICAgIHRoaXMuX3NjZW5lSW5kZXggPSAwO1xuXG4gICAgaWYgKHRoaXMuY3VycmVudFNjZW5lKSB7XG4gICAgICB0aGlzLmN1cnJlbnRTY2VuZS5hcHAgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuY3VycmVudFNjZW5lID0gc2NlbmU7XG4gICAgdGhpcy5jdXJyZW50U2NlbmUuYXBwID0gdGhpcztcbiAgICB0aGlzLmN1cnJlbnRTY2VuZS5mbGFyZSgnZW50ZXInLCB7XG4gICAgICBhcHA6IHRoaXMsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSk7XG5cbiAgcGhpbmEuYXBwLkJhc2VBcHAucHJvdG90eXBlLiRtZXRob2QoXCJwb3BTY2VuZVwiLCBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmZsYXJlKCdwb3AnKTtcbiAgICB0aGlzLmZsYXJlKCdjaGFuZ2VzY2VuZScpO1xuXG4gICAgdmFyIHNjZW5lID0gdGhpcy5fc2NlbmVzLnBvcCgpO1xuICAgIC0tdGhpcy5fc2NlbmVJbmRleDtcblxuICAgIHNjZW5lLmZsYXJlKCdleGl0Jywge1xuICAgICAgYXBwOiB0aGlzLFxuICAgIH0pO1xuICAgIHNjZW5lLmZsYXJlKCdkZXN0cm95Jyk7XG4gICAgc2NlbmUuYXBwID0gbnVsbDtcblxuICAgIHRoaXMuZmxhcmUoJ3BvcGVkJyk7XG5cbiAgICAvLyBcbiAgICB0aGlzLmN1cnJlbnRTY2VuZS5mbGFyZSgncmVzdW1lJywge1xuICAgICAgYXBwOiB0aGlzLFxuICAgICAgcHJldlNjZW5lOiBzY2VuZSxcbiAgICB9KTtcblxuICAgIHJldHVybiBzY2VuZTtcbiAgfSk7XG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmdyYXBoaWNzLkNhbnZhcy5wcm90b3R5cGUuJG1ldGhvZChcImluaXRcIiwgZnVuY3Rpb24oY2FudmFzKSB7XG4gICAgdGhpcy5pc0NyZWF0ZUNhbnZhcyA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgY2FudmFzID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5jYW52YXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGNhbnZhcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjYW52YXMpIHtcbiAgICAgICAgdGhpcy5jYW52YXMgPSBjYW52YXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICB0aGlzLmlzQ3JlYXRlQ2FudmFzID0gdHJ1ZTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJyMjIyMgY3JlYXRlIGNhbnZhcyAjIyMjJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5kb21FbGVtZW50ID0gdGhpcy5jYW52YXM7XG4gICAgdGhpcy5jb250ZXh0ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICB0aGlzLmNvbnRleHQubGluZUNhcCA9ICdyb3VuZCc7XG4gICAgdGhpcy5jb250ZXh0LmxpbmVKb2luID0gJ3JvdW5kJztcbiAgfSk7XG5cbiAgcGhpbmEuZ3JhcGhpY3MuQ2FudmFzLnByb3RvdHlwZS4kbWV0aG9kKCdkZXN0cm95JywgZnVuY3Rpb24oY2FudmFzKSB7XG4gICAgaWYgKCF0aGlzLmlzQ3JlYXRlQ2FudmFzKSByZXR1cm47XG4gICAgLy8gY29uc29sZS5sb2coYCMjIyMgZGVsZXRlIGNhbnZhcyAke3RoaXMuY2FudmFzLndpZHRofSB4ICR7dGhpcy5jYW52YXMuaGVpZ2h0fSAjIyMjYCk7XG4gICAgdGhpcy5zZXRTaXplKDAsIDApO1xuICAgIGRlbGV0ZSB0aGlzLmNhbnZhcztcbiAgICBkZWxldGUgdGhpcy5kb21FbGVtZW50O1xuICB9KTtcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoKCkgPT4ge1xuXG4gIHZhciBxdWFsaXR5U2NhbGUgPSBwaGluYS5nZW9tLk1hdHJpeDMzKCk7XG5cbiAgcGhpbmEuZGlzcGxheS5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUuJG1ldGhvZChcInJlbmRlclwiLCBmdW5jdGlvbihzY2VuZSwgcXVhbGl0eSkge1xuICAgIHRoaXMuY2FudmFzLmNsZWFyKCk7XG4gICAgaWYgKHNjZW5lLmJhY2tncm91bmRDb2xvcikge1xuICAgICAgdGhpcy5jYW52YXMuY2xlYXJDb2xvcihzY2VuZS5iYWNrZ3JvdW5kQ29sb3IpO1xuICAgIH1cblxuICAgIHRoaXMuX2NvbnRleHQuc2F2ZSgpO1xuICAgIHRoaXMucmVuZGVyQ2hpbGRyZW4oc2NlbmUsIHF1YWxpdHkpO1xuICAgIHRoaXMuX2NvbnRleHQucmVzdG9yZSgpO1xuICB9KTtcblxuICBwaGluYS5kaXNwbGF5LkNhbnZhc1JlbmRlcmVyLnByb3RvdHlwZS4kbWV0aG9kKFwicmVuZGVyQ2hpbGRyZW5cIiwgZnVuY3Rpb24ob2JqLCBxdWFsaXR5KSB7XG4gICAgLy8g5a2Q5L6b44Gf44Gh44KC5a6f6KGMXG4gICAgaWYgKG9iai5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG4gICAgICB2YXIgdGVtcENoaWxkcmVuID0gb2JqLmNoaWxkcmVuLnNsaWNlKCk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGVtcENoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIHRoaXMucmVuZGVyT2JqZWN0KHRlbXBDaGlsZHJlbltpXSwgcXVhbGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBwaGluYS5kaXNwbGF5LkNhbnZhc1JlbmRlcmVyLnByb3RvdHlwZS4kbWV0aG9kKFwicmVuZGVyT2JqZWN0XCIsIGZ1bmN0aW9uKG9iaiwgcXVhbGl0eSkge1xuICAgIGlmIChvYmoudmlzaWJsZSA9PT0gZmFsc2UgJiYgIW9iai5pbnRlcmFjdGl2ZSkgcmV0dXJuO1xuXG4gICAgb2JqLl9jYWxjV29ybGRNYXRyaXggJiYgb2JqLl9jYWxjV29ybGRNYXRyaXgoKTtcblxuICAgIGlmIChvYmoudmlzaWJsZSA9PT0gZmFsc2UpIHJldHVybjtcblxuICAgIG9iai5fY2FsY1dvcmxkQWxwaGEgJiYgb2JqLl9jYWxjV29ybGRBbHBoYSgpO1xuXG4gICAgdmFyIGNvbnRleHQgPSB0aGlzLmNhbnZhcy5jb250ZXh0O1xuXG4gICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IG9iai5fd29ybGRBbHBoYTtcbiAgICBjb250ZXh0Lmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9IG9iai5ibGVuZE1vZGU7XG5cbiAgICBpZiAob2JqLl93b3JsZE1hdHJpeCkge1xuXG4gICAgICBxdWFsaXR5U2NhbGUuaWRlbnRpdHkoKTtcblxuICAgICAgcXVhbGl0eVNjYWxlLm0wMCA9IHF1YWxpdHkgfHwgMS4wO1xuICAgICAgcXVhbGl0eVNjYWxlLm0xMSA9IHF1YWxpdHkgfHwgMS4wO1xuXG4gICAgICB2YXIgbSA9IHF1YWxpdHlTY2FsZS5tdWx0aXBseShvYmouX3dvcmxkTWF0cml4KTtcbiAgICAgIGNvbnRleHQuc2V0VHJhbnNmb3JtKG0ubTAwLCBtLm0xMCwgbS5tMDEsIG0ubTExLCBtLm0wMiwgbS5tMTIpO1xuXG4gICAgfVxuXG4gICAgaWYgKG9iai5jbGlwKSB7XG5cbiAgICAgIGNvbnRleHQuc2F2ZSgpO1xuXG4gICAgICBvYmouY2xpcCh0aGlzLmNhbnZhcyk7XG4gICAgICBjb250ZXh0LmNsaXAoKTtcblxuICAgICAgaWYgKG9iai5kcmF3KSBvYmouZHJhdyh0aGlzLmNhbnZhcyk7XG5cbiAgICAgIC8vIOWtkOS+m+OBn+OBoeOCguWun+ihjFxuICAgICAgaWYgKG9iai5yZW5kZXJDaGlsZEJ5U2VsZiA9PT0gZmFsc2UgJiYgb2JqLmNoaWxkcmVuLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIHRlbXBDaGlsZHJlbiA9IG9iai5jaGlsZHJlbi5zbGljZSgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGVtcENoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgdGhpcy5yZW5kZXJPYmplY3QodGVtcENoaWxkcmVuW2ldLCBxdWFsaXR5KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb250ZXh0LnJlc3RvcmUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG9iai5kcmF3KSBvYmouZHJhdyh0aGlzLmNhbnZhcyk7XG5cbiAgICAgIC8vIOWtkOS+m+OBn+OBoeOCguWun+ihjFxuICAgICAgaWYgKG9iai5yZW5kZXJDaGlsZEJ5U2VsZiA9PT0gZmFsc2UgJiYgb2JqLmNoaWxkcmVuLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIHRlbXBDaGlsZHJlbiA9IG9iai5jaGlsZHJlbi5zbGljZSgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGVtcENoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgdGhpcy5yZW5kZXJPYmplY3QodGVtcENoaWxkcmVuW2ldLCBxdWFsaXR5KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfVxuICB9KTtcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoKCkgPT4ge1xuICAvL+ODpuODvOOCtuODvOOCqOODvOOCuOOCp+ODs+ODiOOBi+OCieODluODqeOCpuOCtuOCv+OCpOODl+OBruWIpOWIpeOCkuihjOOBhlxuICBwaGluYS4kbWV0aG9kKCdjaGVja0Jyb3dzZXInLCBmdW5jdGlvbigpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBjb25zdCBhZ2VudCA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7O1xuXG4gICAgcmVzdWx0LmlzQ2hyb21lID0gKGFnZW50LmluZGV4T2YoJ2Nocm9tZScpICE9PSAtMSkgJiYgKGFnZW50LmluZGV4T2YoJ2VkZ2UnKSA9PT0gLTEpICYmIChhZ2VudC5pbmRleE9mKCdvcHInKSA9PT0gLTEpO1xuICAgIHJlc3VsdC5pc0VkZ2UgPSAoYWdlbnQuaW5kZXhPZignZWRnZScpICE9PSAtMSk7XG4gICAgcmVzdWx0LmlzSWUxMSA9IChhZ2VudC5pbmRleE9mKCd0cmlkZW50LzcnKSAhPT0gLTEpO1xuICAgIHJlc3VsdC5pc0ZpcmVmb3ggPSAoYWdlbnQuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSk7XG4gICAgcmVzdWx0LmlzU2FmYXJpID0gKGFnZW50LmluZGV4T2YoJ3NhZmFyaScpICE9PSAtMSkgJiYgKGFnZW50LmluZGV4T2YoJ2Nocm9tZScpID09PSAtMSk7XG4gICAgcmVzdWx0LmlzRWxlY3Ryb24gPSAoYWdlbnQuaW5kZXhPZignZWxlY3Ryb24nKSAhPT0gLTEpO1xuXG4gICAgcmVzdWx0LmlzV2luZG93cyA9IChhZ2VudC5pbmRleE9mKCd3aW5kb3dzJykgIT09IC0xKTtcbiAgICByZXN1bHQuaXNNYWMgPSAoYWdlbnQuaW5kZXhPZignbWFjIG9zIHgnKSAhPT0gLTEpO1xuXG4gICAgcmVzdWx0LmlzaVBhZCA9IGFnZW50LmluZGV4T2YoJ2lwYWQnKSA+IC0xIHx8IHVhLmluZGV4T2YoJ21hY2ludG9zaCcpID4gLTEgJiYgJ29udG91Y2hlbmQnIGluIGRvY3VtZW50O1xuICAgIHJlc3VsdC5pc2lPUyA9IGFnZW50LmluZGV4T2YoJ2lwaG9uZScpID4gLTEgfHwgdWEuaW5kZXhPZignaXBhZCcpID4gLTEgfHwgdWEuaW5kZXhPZignbWFjaW50b3NoJykgPiAtMSAmJiAnb250b3VjaGVuZCcgaW4gZG9jdW1lbnQ7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9KTtcbn0pO1xuIiwiLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gIEV4dGVuc2lvbiBwaGluYS5kaXNwbGF5LkRpc3BsYXlFbGVtZW50XG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5waGluYS5uYW1lc3BhY2UoKCkgPT4ge1xuICBwaGluYS5kaXNwbGF5LkRpc3BsYXlFbGVtZW50LnByb3RvdHlwZS4kbWV0aG9kKFwiZW5hYmxlXCIsIGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc2hvdygpLndha2VVcCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9KTtcblxuICBwaGluYS5kaXNwbGF5LkRpc3BsYXlFbGVtZW50LnByb3RvdHlwZS4kbWV0aG9kKFwiZGlzYWJsZVwiLCBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmhpZGUoKS5zbGVlcCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9KTtcbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKCgpID0+IHtcbiAgcGhpbmEuZGlzcGxheS5EaXNwbGF5U2NlbmUucXVhbGl0eSA9IDEuMDtcbiAgcGhpbmEuZGlzcGxheS5EaXNwbGF5U2NlbmUucHJvdG90eXBlLiRtZXRob2QoXCJpbml0XCIsIGZ1bmN0aW9uKHBhcmFtcykge1xuICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgdmFyIHF1YWxpdHkgPSBwaGluYS5kaXNwbGF5LkRpc3BsYXlTY2VuZS5xdWFsaXR5O1xuXG4gICAgcGFyYW1zID0gKHt9KS4kc2FmZShwYXJhbXMsIHBoaW5hLmRpc3BsYXkuRGlzcGxheVNjZW5lLmRlZmF1bHRzKTtcbiAgICB0aGlzLmNhbnZhcyA9IHBoaW5hLmdyYXBoaWNzLkNhbnZhcygpO1xuICAgIHRoaXMuY2FudmFzLnNldFNpemUocGFyYW1zLndpZHRoICogcXVhbGl0eSwgcGFyYW1zLmhlaWdodCAqIHF1YWxpdHkpO1xuICAgIHRoaXMucmVuZGVyZXIgPSBwaGluYS5kaXNwbGF5LkNhbnZhc1JlbmRlcmVyKHRoaXMuY2FudmFzKTtcbiAgICB0aGlzLmJhY2tncm91bmRDb2xvciA9IChwYXJhbXMuYmFja2dyb3VuZENvbG9yKSA/IHBhcmFtcy5iYWNrZ3JvdW5kQ29sb3IgOiBudWxsO1xuXG4gICAgdGhpcy53aWR0aCA9IHBhcmFtcy53aWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IHBhcmFtcy5oZWlnaHQ7XG4gICAgdGhpcy5ncmlkWCA9IHBoaW5hLnV0aWwuR3JpZChwYXJhbXMud2lkdGgsIDE2KTtcbiAgICB0aGlzLmdyaWRZID0gcGhpbmEudXRpbC5HcmlkKHBhcmFtcy5oZWlnaHQsIDE2KTtcblxuICAgIHRoaXMuaW50ZXJhY3RpdmUgPSB0cnVlO1xuICAgIHRoaXMuc2V0SW50ZXJhY3RpdmUgPSBmdW5jdGlvbihmbGFnKSB7XG4gICAgICB0aGlzLmludGVyYWN0aXZlID0gZmxhZztcbiAgICB9O1xuICAgIHRoaXMuX292ZXJGbGFncyA9IHt9O1xuICAgIHRoaXMuX3RvdWNoRmxhZ3MgPSB7fTtcbiAgfSk7XG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xyXG5cclxuICAvLyBhdWRpb+imgee0oOOBp+mfs+WjsOOCkuWGjeeUn+OBmeOCi+OAguS4u+OBq0lF55SoXHJcbiAgcGhpbmEuZGVmaW5lKFwicGhpbmEuYXNzZXQuRG9tQXVkaW9Tb3VuZFwiLCB7XHJcbiAgICBzdXBlckNsYXNzOiBcInBoaW5hLmFzc2V0LkFzc2V0XCIsXHJcblxyXG4gICAgZG9tRWxlbWVudDogbnVsbCxcclxuICAgIGVtcHR5U291bmQ6IGZhbHNlLFxyXG5cclxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICB0aGlzLnN1cGVySW5pdCgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBfbG9hZDogZnVuY3Rpb24ocmVzb2x2ZSkge1xyXG4gICAgICB0aGlzLmRvbUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYXVkaW9cIik7XHJcbiAgICAgIGlmICh0aGlzLmRvbUVsZW1lbnQuY2FuUGxheVR5cGUoXCJhdWRpby9tcGVnXCIpKSB7XHJcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiByZWFkeXN0YXRlQ2hlY2soKSB7XHJcbiAgICAgICAgICBpZiAodGhpcy5kb21FbGVtZW50LnJlYWR5U3RhdGUgPCA0KSB7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQocmVhZHlzdGF0ZUNoZWNrLmJpbmQodGhpcyksIDEwKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW1wdHlTb3VuZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImVuZCBsb2FkIFwiLCB0aGlzLnNyYyk7XHJcbiAgICAgICAgICAgIHJlc29sdmUodGhpcylcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LmJpbmQodGhpcyksIDEwKTtcclxuICAgICAgICB0aGlzLmRvbUVsZW1lbnQub25lcnJvciA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCLjgqrjg7zjg4fjgqPjgqrjga7jg63jg7zjg4njgavlpLHmlZdcIiwgZSk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGlzLmRvbUVsZW1lbnQuc3JjID0gdGhpcy5zcmM7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJiZWdpbiBsb2FkIFwiLCB0aGlzLnNyYyk7XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50LmxvYWQoKTtcclxuICAgICAgICB0aGlzLmRvbUVsZW1lbnQuYXV0b3BsYXkgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImVuZGVkXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgdGhpcy5mbGFyZShcImVuZGVkXCIpO1xyXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJtcDPjga/lho3nlJ/jgafjgY3jgb7jgZvjgpNcIik7XHJcbiAgICAgICAgdGhpcy5lbXB0eVNvdW5kID0gdHJ1ZTtcclxuICAgICAgICByZXNvbHZlKHRoaXMpO1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIHBsYXk6IGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAodGhpcy5lbXB0eVNvdW5kKSByZXR1cm47XHJcbiAgICAgIHRoaXMuZG9tRWxlbWVudC5wYXVzZSgpO1xyXG4gICAgICB0aGlzLmRvbUVsZW1lbnQuY3VycmVudFRpbWUgPSAwO1xyXG4gICAgICB0aGlzLmRvbUVsZW1lbnQucGxheSgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBzdG9wOiBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKHRoaXMuZW1wdHlTb3VuZCkgcmV0dXJuO1xyXG4gICAgICB0aGlzLmRvbUVsZW1lbnQucGF1c2UoKTtcclxuICAgICAgdGhpcy5kb21FbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcclxuICAgIH0sXHJcblxyXG4gICAgcGF1c2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAodGhpcy5lbXB0eVNvdW5kKSByZXR1cm47XHJcbiAgICAgIHRoaXMuZG9tRWxlbWVudC5wYXVzZSgpO1xyXG4gICAgfSxcclxuXHJcbiAgICByZXN1bWU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAodGhpcy5lbXB0eVNvdW5kKSByZXR1cm47XHJcbiAgICAgIHRoaXMuZG9tRWxlbWVudC5wbGF5KCk7XHJcbiAgICB9LFxyXG5cclxuICAgIHNldExvb3A6IGZ1bmN0aW9uKHYpIHtcclxuICAgICAgaWYgKHRoaXMuZW1wdHlTb3VuZCkgcmV0dXJuO1xyXG4gICAgICB0aGlzLmRvbUVsZW1lbnQubG9vcCA9IHY7XHJcbiAgICB9LFxyXG5cclxuICAgIF9hY2Nlc3Nvcjoge1xyXG4gICAgICB2b2x1bWU6IHtcclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKHRoaXMuZW1wdHlTb3VuZCkgcmV0dXJuIDA7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5kb21FbGVtZW50LnZvbHVtZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNldDogZnVuY3Rpb24odikge1xyXG4gICAgICAgICAgaWYgKHRoaXMuZW1wdHlTb3VuZCkgcmV0dXJuO1xyXG4gICAgICAgICAgdGhpcy5kb21FbGVtZW50LnZvbHVtZSA9IHY7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgbG9vcDoge1xyXG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAodGhpcy5lbXB0eVNvdW5kKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5kb21FbGVtZW50Lmxvb3A7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcclxuICAgICAgICAgIGlmICh0aGlzLmVtcHR5U291bmQpIHJldHVybjtcclxuICAgICAgICAgIHRoaXMuc2V0TG9vcCh2KTtcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG5cclxuICAgIH0sXHJcbiAgfSk7XHJcblxyXG4gIC8vIElFMTHjga7loLTlkIjjga7jgb/pn7Plo7DjgqLjgrvjg4Pjg4jjga9Eb21BdWRpb1NvdW5k44Gn5YaN55Sf44GZ44KLXHJcbiAgdmFyIHVhID0gd2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcclxuICBpZiAodWEuaW5kZXhPZigndHJpZGVudC83JykgIT09IC0xKSB7XHJcbiAgICBwaGluYS5hc3NldC5Bc3NldExvYWRlci5yZWdpc3RlcihcInNvdW5kXCIsIGZ1bmN0aW9uKGtleSwgcGF0aCkge1xyXG4gICAgICB2YXIgYXNzZXQgPSBwaGluYS5hc3NldC5Eb21BdWRpb1NvdW5kKCk7XHJcbiAgICAgIHJldHVybiBhc3NldC5sb2FkKHBhdGgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxufSk7XHJcbiIsInBoaW5hLm5hbWVzcGFjZSgoKSA9PiB7XG5cbiAgcGhpbmEuYXBwLkVsZW1lbnQucHJvdG90eXBlLiRtZXRob2QoXCJmaW5kQnlJZFwiLCBmdW5jdGlvbihpZCkge1xuICAgIGlmICh0aGlzLmlkID09PSBpZCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodGhpcy5jaGlsZHJlbltpXS5maW5kQnlJZChpZCkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jaGlsZHJlbltpXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9KTtcblxuICAvL+aMh+WumuOBleOCjOOBn+WtkOOCquODluOCuOOCp+OCr+ODiOOCkuacgOWJjemdouOBq+enu+WLleOBmeOCi1xuICBwaGluYS5hcHAuRWxlbWVudC5wcm90b3R5cGUuJG1ldGhvZChcIm1vdmVGcm9udFwiLCBmdW5jdGlvbihjaGlsZCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuY2hpbGRyZW5baV0gPT0gY2hpbGQpIHtcbiAgICAgICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNoaWxkcmVuLnB1c2goY2hpbGQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9KTtcblxuICBwaGluYS5hcHAuRWxlbWVudC5wcm90b3R5cGUuJG1ldGhvZChcImRlc3Ryb3lDaGlsZFwiLCBmdW5jdGlvbigpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuY2hpbGRyZW5baV0uZmxhcmUoJ2Rlc3Ryb3knKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0pO1xuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZSgoKSA9PiB7XG5cbiAgcGhpbmEuaW5wdXQuSW5wdXQucXVhbGl0eSA9IDEuMDtcblxuICBwaGluYS5pbnB1dC5JbnB1dC5wcm90b3R5cGUuJG1ldGhvZChcIl9tb3ZlXCIsIGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB0aGlzLl90ZW1wUG9zaXRpb24ueCA9IHg7XG4gICAgdGhpcy5fdGVtcFBvc2l0aW9uLnkgPSB5O1xuXG4gICAgLy8gYWRqdXN0IHNjYWxlXG4gICAgdmFyIGVsbSA9IHRoaXMuZG9tRWxlbWVudDtcbiAgICB2YXIgcmVjdCA9IGVsbS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgIHZhciB3ID0gZWxtLndpZHRoIC8gcGhpbmEuaW5wdXQuSW5wdXQucXVhbGl0eTtcbiAgICB2YXIgaCA9IGVsbS5oZWlnaHQgLyBwaGluYS5pbnB1dC5JbnB1dC5xdWFsaXR5O1xuXG4gICAgaWYgKHJlY3Qud2lkdGgpIHtcbiAgICAgIHRoaXMuX3RlbXBQb3NpdGlvbi54ICo9IHcgLyByZWN0LndpZHRoO1xuICAgIH1cblxuICAgIGlmIChyZWN0LmhlaWdodCkge1xuICAgICAgdGhpcy5fdGVtcFBvc2l0aW9uLnkgKj0gaCAvIHJlY3QuaGVpZ2h0O1xuICAgIH1cblxuICB9KTtcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoKCkgPT4ge1xuICBwaGluYS5kaXNwbGF5LkxhYmVsLnByb3RvdHlwZS4kbWV0aG9kKFwiaW5pdFwiLCBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBhcmd1bWVudHNbMF0gIT09ICdvYmplY3QnKSB7XG4gICAgICBvcHRpb25zID0geyB0ZXh0OiBhcmd1bWVudHNbMF0sIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSBhcmd1bWVudHNbMF07XG4gICAgfVxuXG4gICAgb3B0aW9ucyA9ICh7fSkuJHNhZmUob3B0aW9ucywgcGhpbmEuZGlzcGxheS5MYWJlbC5kZWZhdWx0cyk7XG4gICAgdGhpcy5zdXBlckluaXQob3B0aW9ucyk7XG5cbiAgICB0aGlzLnRleHQgPSAob3B0aW9ucy50ZXh0KSA/IG9wdGlvbnMudGV4dCA6IFwiXCI7XG4gICAgdGhpcy5mb250U2l6ZSA9IG9wdGlvbnMuZm9udFNpemU7XG4gICAgdGhpcy5mb250V2VpZ2h0ID0gb3B0aW9ucy5mb250V2VpZ2h0O1xuICAgIHRoaXMuZm9udEZhbWlseSA9IG9wdGlvbnMuZm9udEZhbWlseTtcbiAgICB0aGlzLmFsaWduID0gb3B0aW9ucy5hbGlnbjtcbiAgICB0aGlzLmJhc2VsaW5lID0gb3B0aW9ucy5iYXNlbGluZTtcbiAgICB0aGlzLmxpbmVIZWlnaHQgPSBvcHRpb25zLmxpbmVIZWlnaHQ7XG4gIH0pO1xuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZSgoKSA9PiB7XG4gIHBoaW5hLmlucHV0Lk1vdXNlLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oZG9tRWxlbWVudCkge1xuICAgIHRoaXMuc3VwZXJJbml0KGRvbUVsZW1lbnQpO1xuXG4gICAgdGhpcy5pZCA9IDA7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIHNlbGYuX3N0YXJ0KGUucG9pbnRYLCBlLnBvaW50WSwgMSA8PCBlLmJ1dHRvbik7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBmdW5jdGlvbihlKSB7XG4gICAgICBzZWxmLl9lbmQoMSA8PCBlLmJ1dHRvbik7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIH0pO1xuICAgIHRoaXMuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBmdW5jdGlvbihlKSB7XG4gICAgICBzZWxmLl9tb3ZlKGUucG9pbnRYLCBlLnBvaW50WSk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIH0pO1xuXG4gICAgLy8g44Oe44Km44K544GM44Kt44Oj44Oz44OQ44K56KaB57Sg44Gu5aSW44Gr5Ye644Gf5aC05ZCI44Gu5a++5b+cXG4gICAgdGhpcy5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlb3V0JywgZnVuY3Rpb24oZSkge1xuICAgICAgc2VsZi5fZW5kKDEpO1xuICAgIH0pO1xuICB9XG59KTtcbiIsIi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vICBFeHRlbnNpb24gcGhpbmEuYXBwLk9iamVjdDJEXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbnBoaW5hLm5hbWVzcGFjZSgoKSA9PiB7XG4gIHBoaW5hLmFwcC5PYmplY3QyRC5wcm90b3R5cGUuJG1ldGhvZChcInNldE9yaWdpblwiLCBmdW5jdGlvbih4LCB5LCByZXBvc2l0aW9uKSB7XG4gICAgaWYgKCFyZXBvc2l0aW9uKSB7XG4gICAgICB0aGlzLm9yaWdpbi54ID0geDtcbiAgICAgIHRoaXMub3JpZ2luLnkgPSB5O1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLy/lpInmm7TjgZXjgozjgZ/ln7rmupbngrnjgavnp7vli5XjgZXjgZvjgotcbiAgICBjb25zdCBfb3JpZ2luWCA9IHRoaXMub3JpZ2luWDtcbiAgICBjb25zdCBfb3JpZ2luWSA9IHRoaXMub3JpZ2luWTtcbiAgICBjb25zdCBfYWRkWCA9ICh4IC0gX29yaWdpblgpICogdGhpcy53aWR0aDtcbiAgICBjb25zdCBfYWRkWSA9ICh5IC0gX29yaWdpblkpICogdGhpcy5oZWlnaHQ7XG5cbiAgICB0aGlzLnggKz0gX2FkZFg7XG4gICAgdGhpcy55ICs9IF9hZGRZO1xuICAgIHRoaXMub3JpZ2luWCA9IHg7XG4gICAgdGhpcy5vcmlnaW5ZID0geTtcblxuICAgIHRoaXMuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiB7XG4gICAgICBjaGlsZC54IC09IF9hZGRYO1xuICAgICAgY2hpbGQueSAtPSBfYWRkWTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSk7XG5cbiAgcGhpbmEuYXBwLk9iamVjdDJELnByb3RvdHlwZS4kbWV0aG9kKFwiaGl0VGVzdEVsZW1lbnRcIiwgZnVuY3Rpb24oZWxtKSB7XG4gICAgY29uc3QgcmVjdDAgPSB0aGlzLmNhbGNHbG9iYWxSZWN0KCk7XG4gICAgY29uc3QgcmVjdDEgPSBlbG0uY2FsY0dsb2JhbFJlY3QoKTtcbiAgICByZXR1cm4gKHJlY3QwLmxlZnQgPCByZWN0MS5yaWdodCkgJiYgKHJlY3QwLnJpZ2h0ID4gcmVjdDEubGVmdCkgJiZcbiAgICAgIChyZWN0MC50b3AgPCByZWN0MS5ib3R0b20pICYmIChyZWN0MC5ib3R0b20gPiByZWN0MS50b3ApO1xuICB9KTtcblxuICBwaGluYS5hcHAuT2JqZWN0MkQucHJvdG90eXBlLiRtZXRob2QoXCJpbmNsdWRlRWxlbWVudFwiLCBmdW5jdGlvbihlbG0pIHtcbiAgICBjb25zdCByZWN0MCA9IHRoaXMuY2FsY0dsb2JhbFJlY3QoKTtcbiAgICBjb25zdCByZWN0MSA9IGVsbS5jYWxjR2xvYmFsUmVjdCgpO1xuICAgIHJldHVybiAocmVjdDAubGVmdCA8PSByZWN0MS5sZWZ0KSAmJiAocmVjdDAucmlnaHQgPj0gcmVjdDEucmlnaHQpICYmXG4gICAgICAocmVjdDAudG9wIDw9IHJlY3QxLnRvcCkgJiYgKHJlY3QwLmJvdHRvbSA+PSByZWN0MS5ib3R0b20pO1xuICB9KTtcblxuICBwaGluYS5hcHAuT2JqZWN0MkQucHJvdG90eXBlLiRtZXRob2QoXCJjYWxjR2xvYmFsUmVjdFwiLCBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsZWZ0ID0gdGhpcy5fd29ybGRNYXRyaXgubTAyIC0gdGhpcy5vcmlnaW5YICogdGhpcy53aWR0aDtcbiAgICBjb25zdCB0b3AgPSB0aGlzLl93b3JsZE1hdHJpeC5tMTIgLSB0aGlzLm9yaWdpblkgKiB0aGlzLmhlaWdodDtcbiAgICByZXR1cm4gUmVjdChsZWZ0LCB0b3AsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgfSk7XG5cbiAgcGhpbmEuYXBwLk9iamVjdDJELnByb3RvdHlwZS4kbWV0aG9kKFwiY2FsY0dsb2JhbFJlY3RcIiwgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbGVmdCA9IHRoaXMuX3dvcmxkTWF0cml4Lm0wMiAtIHRoaXMub3JpZ2luWCAqIHRoaXMud2lkdGg7XG4gICAgY29uc3QgdG9wID0gdGhpcy5fd29ybGRNYXRyaXgubTEyIC0gdGhpcy5vcmlnaW5ZICogdGhpcy5oZWlnaHQ7XG4gICAgcmV0dXJuIFJlY3QobGVmdCwgdG9wLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gIH0pO1xuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kaXNwbGF5LlBsYWluRWxlbWVudC5wcm90b3R5cGUuJG1ldGhvZChcImRlc3Ryb3lDYW52YXNcIiwgZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmNhbnZhcykgcmV0dXJuO1xuICAgIHRoaXMuY2FudmFzLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5jYW52YXM7XG4gIH0pO1xuXG59KTtcbiIsIi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vICBFeHRlbnNpb24gcGhpbmEuZGlzcGxheS5TaGFwZVxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxucGhpbmEuZGlzcGxheS5TaGFwZS5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24oY2FudmFzKSB7XG4gIGlmICghY2FudmFzKSB7XG4gICAgY29uc29sZS5sb2coXCJjYW52YXMgbnVsbFwiKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGNvbnRleHQgPSBjYW52YXMuY29udGV4dDtcbiAgLy8g44Oq44K144Kk44K6XG4gIHZhciBzaXplID0gdGhpcy5jYWxjQ2FudmFzU2l6ZSgpO1xuICBjYW52YXMuc2V0U2l6ZShzaXplLndpZHRoLCBzaXplLmhlaWdodCk7XG4gIC8vIOOCr+ODquOCouOCq+ODqeODvFxuICBjYW52YXMuY2xlYXJDb2xvcih0aGlzLmJhY2tncm91bmRDb2xvcik7XG4gIC8vIOS4reW/g+OBq+W6p+aomeOCkuenu+WLlVxuICBjYW52YXMudHJhbnNmb3JtQ2VudGVyKCk7XG5cbiAgLy8g5o+P55S75YmN5Yem55CGXG4gIHRoaXMucHJlcmVuZGVyKHRoaXMuY2FudmFzKTtcblxuICAvLyDjgrnjg4jjg63jg7zjgq/mj4/nlLtcbiAgaWYgKHRoaXMuaXNTdHJva2FibGUoKSkge1xuICAgIGNvbnRleHQuc3Ryb2tlU3R5bGUgPSB0aGlzLnN0cm9rZTtcbiAgICBjb250ZXh0LmxpbmVXaWR0aCA9IHRoaXMuc3Ryb2tlV2lkdGg7XG4gICAgY29udGV4dC5saW5lSm9pbiA9IFwicm91bmRcIjtcbiAgICBjb250ZXh0LnNoYWRvd0JsdXIgPSAwO1xuICAgIHRoaXMucmVuZGVyU3Ryb2tlKGNhbnZhcyk7XG4gIH1cblxuICAvLyDloZfjgorjgaTjgbbjgZfmj4/nlLtcbiAgaWYgKHRoaXMuZmlsbCkge1xuICAgIGNvbnRleHQuZmlsbFN0eWxlID0gdGhpcy5maWxsO1xuICAgIC8vIHNoYWRvdyDjga4gb24vb2ZmXG4gICAgaWYgKHRoaXMuc2hhZG93KSB7XG4gICAgICBjb250ZXh0LnNoYWRvd0NvbG9yID0gdGhpcy5zaGFkb3c7XG4gICAgICBjb250ZXh0LnNoYWRvd0JsdXIgPSB0aGlzLnNoYWRvd0JsdXI7XG4gICAgICBjb250ZXh0LnNoYWRvd09mZnNldFggPSB0aGlzLnNoYWRvd09mZnNldFggfHwgMDtcbiAgICAgIGNvbnRleHQuc2hhZG93T2Zmc2V0WSA9IHRoaXMuc2hhZG93T2Zmc2V0WSB8fCAwO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0LnNoYWRvd0JsdXIgPSAwO1xuICAgIH1cbiAgICB0aGlzLnJlbmRlckZpbGwoY2FudmFzKTtcbiAgfVxuXG4gIC8vIOaPj+eUu+W+jOWHpueQhlxuICB0aGlzLnBvc3RyZW5kZXIodGhpcy5jYW52YXMpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5hc3NldC5Tb3VuZC5wcm90b3R5cGUuJG1ldGhvZChcIl9sb2FkXCIsIGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICBpZiAoL15kYXRhOi8udGVzdCh0aGlzLnNyYykpIHtcbiAgICAgIHRoaXMuX2xvYWRGcm9tVVJJU2NoZW1lKHJlc29sdmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9sb2FkRnJvbUZpbGUocmVzb2x2ZSk7XG4gICAgfVxuICB9KTtcblxuICBwaGluYS5hc3NldC5Tb3VuZC5wcm90b3R5cGUuJG1ldGhvZChcIl9sb2FkRnJvbUZpbGVcIiwgZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuc3JjKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHhtbCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhtbC5vcGVuKCdHRVQnLCB0aGlzLnNyYyk7XG4gICAgeG1sLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHhtbC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgIGlmIChbMjAwLCAyMDEsIDBdLmluZGV4T2YoeG1sLnN0YXR1cykgIT09IC0xKSB7XG4gICAgICAgICAgLy8g6Z+z5qW944OQ44Kk44OK44Oq44O844OH44O844K/XG4gICAgICAgICAgdmFyIGRhdGEgPSB4bWwucmVzcG9uc2U7XG4gICAgICAgICAgLy8gd2ViYXVkaW8g55So44Gr5aSJ5o+bXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coZGF0YSlcbiAgICAgICAgICBzZWxmLmNvbnRleHQuZGVjb2RlQXVkaW9EYXRhKGRhdGEsIGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAgICAgICAgICAgc2VsZi5sb2FkRnJvbUJ1ZmZlcihidWZmZXIpO1xuICAgICAgICAgICAgcmVzb2x2ZShzZWxmKTtcbiAgICAgICAgICB9LCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIumfs+WjsOODleOCoeOCpOODq+OBruODh+OCs+ODvOODieOBq+WkseaVl+OBl+OBvuOBl+OBn+OAgihcIiArIHNlbGYuc3JjICsgXCIpXCIpO1xuICAgICAgICAgICAgcmVzb2x2ZShzZWxmKTtcbiAgICAgICAgICAgIHNlbGYuZmxhcmUoJ2RlY29kZWVycm9yJyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoeG1sLnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgICAgLy8gbm90IGZvdW5kXG4gICAgICAgICAgc2VsZi5sb2FkRXJyb3IgPSB0cnVlO1xuICAgICAgICAgIHNlbGYubm90Rm91bmQgPSB0cnVlO1xuICAgICAgICAgIHJlc29sdmUoc2VsZik7XG4gICAgICAgICAgc2VsZi5mbGFyZSgnbG9hZGVycm9yJyk7XG4gICAgICAgICAgc2VsZi5mbGFyZSgnbm90Zm91bmQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyDjgrXjg7zjg5Djg7zjgqjjg6njg7xcbiAgICAgICAgICBzZWxmLmxvYWRFcnJvciA9IHRydWU7XG4gICAgICAgICAgc2VsZi5zZXJ2ZXJFcnJvciA9IHRydWU7XG4gICAgICAgICAgcmVzb2x2ZShzZWxmKTtcbiAgICAgICAgICBzZWxmLmZsYXJlKCdsb2FkZXJyb3InKTtcbiAgICAgICAgICBzZWxmLmZsYXJlKCdzZXJ2ZXJlcnJvcicpO1xuICAgICAgICB9XG4gICAgICAgIHhtbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB4bWwucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcblxuICAgIHhtbC5zZW5kKG51bGwpO1xuICB9KTtcblxuICBwaGluYS5hc3NldC5Tb3VuZC5wcm90b3R5cGUuJG1ldGhvZChcInBsYXlcIiwgZnVuY3Rpb24od2hlbiwgb2Zmc2V0LCBkdXJhdGlvbikge1xuICAgIHdoZW4gPSB3aGVuID8gd2hlbiArIHRoaXMuY29udGV4dC5jdXJyZW50VGltZSA6IDA7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cbiAgICB2YXIgc291cmNlID0gdGhpcy5zb3VyY2UgPSB0aGlzLmNvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgdmFyIGJ1ZmZlciA9IHNvdXJjZS5idWZmZXIgPSB0aGlzLmJ1ZmZlcjtcbiAgICBzb3VyY2UubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgc291cmNlLmxvb3BTdGFydCA9IHRoaXMuX2xvb3BTdGFydDtcbiAgICBzb3VyY2UubG9vcEVuZCA9IHRoaXMuX2xvb3BFbmQ7XG4gICAgc291cmNlLnBsYXliYWNrUmF0ZS52YWx1ZSA9IHRoaXMuX3BsYXliYWNrUmF0ZTtcblxuICAgIC8vIGNvbm5lY3RcbiAgICBzb3VyY2UuY29ubmVjdCh0aGlzLmdhaW5Ob2RlKTtcbiAgICB0aGlzLmdhaW5Ob2RlLmNvbm5lY3QocGhpbmEuYXNzZXQuU291bmQuZ2V0TWFzdGVyR2FpbigpKTtcbiAgICAvLyBwbGF5XG4gICAgaWYgKGR1cmF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHNvdXJjZS5zdGFydCh3aGVuLCBvZmZzZXQsIGR1cmF0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc291cmNlLnN0YXJ0KHdoZW4sIG9mZnNldCk7XG4gICAgfVxuXG4gICAgc291cmNlLm9uZW5kZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghc291cmNlKSB7XG4gICAgICAgIHRoaXMuZmxhcmUoJ2VuZGVkJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHNvdXJjZS5vbmVuZGVkID0gbnVsbDtcbiAgICAgIHNvdXJjZS5kaXNjb25uZWN0KCk7XG4gICAgICBzb3VyY2UuYnVmZmVyID0gbnVsbDtcbiAgICAgIHNvdXJjZSA9IG51bGw7XG4gICAgICB0aGlzLmZsYXJlKCdlbmRlZCcpO1xuICAgIH0uYmluZCh0aGlzKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9KTtcblxuICBwaGluYS5hc3NldC5Tb3VuZC5wcm90b3R5cGUuJG1ldGhvZChcInN0b3BcIiwgZnVuY3Rpb24oKSB7XG4gICAgLy8gc3RvcFxuICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgLy8gc3RvcCDjgZnjgovjgaggc291cmNlLmVuZGVk44KC55m654Gr44GZ44KLXG4gICAgICB0aGlzLnNvdXJjZS5zdG9wICYmIHRoaXMuc291cmNlLnN0b3AoMCk7XG4gICAgICB0aGlzLmZsYXJlKCdzdG9wJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0pO1xuXG59KTtcbiIsIi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vICBFeHRlbnNpb24gcGhpbmEuYXNzZXQuU291bmRNYW5hZ2VyXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5Tb3VuZE1hbmFnZXIuJG1ldGhvZChcImdldFZvbHVtZVwiLCBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICF0aGlzLmlzTXV0ZSgpID8gdGhpcy52b2x1bWUgOiAwO1xufSk7XG5cblNvdW5kTWFuYWdlci4kbWV0aG9kKFwiZ2V0Vm9sdW1lTXVzaWNcIiwgZnVuY3Rpb24oKSB7XG4gIHJldHVybiAhdGhpcy5pc011dGUoKSA/IHRoaXMubXVzaWNWb2x1bWUgOiAwO1xufSk7XG5cblNvdW5kTWFuYWdlci4kbWV0aG9kKFwic2V0Vm9sdW1lTXVzaWNcIiwgZnVuY3Rpb24odm9sdW1lKSB7XG4gIHRoaXMubXVzaWNWb2x1bWUgPSB2b2x1bWU7XG4gIGlmICghdGhpcy5pc011dGUoKSAmJiB0aGlzLmN1cnJlbnRNdXNpYykge1xuICAgIHRoaXMuY3VycmVudE11c2ljLnZvbHVtZSA9IHZvbHVtZTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn0pO1xuXG5Tb3VuZE1hbmFnZXIuJG1ldGhvZChcInBsYXlNdXNpY1wiLCBmdW5jdGlvbihuYW1lLCBmYWRlVGltZSwgbG9vcCwgd2hlbiwgb2Zmc2V0LCBkdXJhdGlvbikge1xuICAvLyBjb25zdCByZXMgPSBwaGluYS5jaGVja0Jyb3dzZXIoKTtcbiAgLy8gaWYgKHJlcy5pc0llMTEpIHJldHVybiBudWxsO1xuXG4gIGxvb3AgPSAobG9vcCAhPT0gdW5kZWZpbmVkKSA/IGxvb3AgOiB0cnVlO1xuXG4gIGlmICh0aGlzLmN1cnJlbnRNdXNpYykge1xuICAgIHRoaXMuc3RvcE11c2ljKGZhZGVUaW1lKTtcbiAgfVxuXG4gIHZhciBtdXNpYyA9IG51bGw7XG4gIGlmIChuYW1lIGluc3RhbmNlb2YgcGhpbmEuYXNzZXQuU291bmQgfHwgbmFtZSBpbnN0YW5jZW9mIHBoaW5hLmFzc2V0LkRvbUF1ZGlvU291bmQpIHtcbiAgICBtdXNpYyA9IG5hbWU7XG4gIH0gZWxzZSB7XG4gICAgbXVzaWMgPSBwaGluYS5hc3NldC5Bc3NldE1hbmFnZXIuZ2V0KCdzb3VuZCcsIG5hbWUpO1xuICB9XG5cbiAgaWYgKCFtdXNpYykge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJTb3VuZCBub3QgZm91bmQ6IFwiLCBuYW1lKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIG11c2ljLnNldExvb3AobG9vcCk7XG4gIG11c2ljLnBsYXkod2hlbiwgb2Zmc2V0LCBkdXJhdGlvbik7XG5cbiAgaWYgKGZhZGVUaW1lID4gMCkge1xuICAgIHZhciBjb3VudCA9IDMyO1xuICAgIHZhciBjb3VudGVyID0gMDtcbiAgICB2YXIgdW5pdFRpbWUgPSBmYWRlVGltZSAvIGNvdW50O1xuICAgIHZhciB2b2x1bWUgPSB0aGlzLmdldFZvbHVtZU11c2ljKCk7XG5cbiAgICBtdXNpYy52b2x1bWUgPSAwO1xuICAgIHZhciBpZCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgY291bnRlciArPSAxO1xuICAgICAgdmFyIHJhdGUgPSBjb3VudGVyIC8gY291bnQ7XG4gICAgICBtdXNpYy52b2x1bWUgPSByYXRlICogdm9sdW1lO1xuXG4gICAgICBpZiAocmF0ZSA+PSAxKSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwoaWQpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sIHVuaXRUaW1lKTtcbiAgfSBlbHNlIHtcbiAgICBtdXNpYy52b2x1bWUgPSB0aGlzLmdldFZvbHVtZU11c2ljKCk7XG4gIH1cblxuICB0aGlzLmN1cnJlbnRNdXNpYyA9IG11c2ljO1xuXG4gIHJldHVybiB0aGlzLmN1cnJlbnRNdXNpYztcbn0pO1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDjg5zjgqTjgrnnlKjjga7pn7Pph4/oqK3lrprjgIHlho3nlJ/jg6Hjgr3jg4Pjg4nmi6HlvLVcblNvdW5kTWFuYWdlci4kbWV0aG9kKFwiZ2V0Vm9sdW1lVm9pY2VcIiwgZnVuY3Rpb24oKSB7XG4gIHJldHVybiAhdGhpcy5pc011dGUoKSA/IHRoaXMudm9pY2VWb2x1bWUgOiAwO1xufSk7XG5cblNvdW5kTWFuYWdlci4kbWV0aG9kKFwic2V0Vm9sdW1lVm9pY2VcIiwgZnVuY3Rpb24odm9sdW1lKSB7XG4gIHRoaXMudm9pY2VWb2x1bWUgPSB2b2x1bWU7XG4gIHJldHVybiB0aGlzO1xufSk7XG5cblNvdW5kTWFuYWdlci4kbWV0aG9kKFwicGxheVZvaWNlXCIsIGZ1bmN0aW9uKG5hbWUpIHtcbiAgdmFyIHNvdW5kID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCgnc291bmQnLCBuYW1lKTtcbiAgc291bmQudm9sdW1lID0gdGhpcy5nZXRWb2x1bWVWb2ljZSgpO1xuICBzb3VuZC5wbGF5KCk7XG4gIHJldHVybiBzb3VuZDtcbn0pO1xuIiwiLy/jgrnjg5fjg6njgqTjg4jmqZ/og73mi6HlvLVcbnBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kaXNwbGF5LlNwcml0ZS5wcm90b3R5cGUuc2V0RnJhbWVUcmltbWluZyA9IGZ1bmN0aW9uKHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcbiAgICB0aGlzLl9mcmFtZVRyaW1YID0geCB8fCAwO1xuICAgIHRoaXMuX2ZyYW1lVHJpbVkgPSB5IHx8IDA7XG4gICAgdGhpcy5fZnJhbWVUcmltV2lkdGggPSB3aWR0aCB8fCB0aGlzLmltYWdlLmRvbUVsZW1lbnQud2lkdGggLSB0aGlzLl9mcmFtZVRyaW1YO1xuICAgIHRoaXMuX2ZyYW1lVHJpbUhlaWdodCA9IGhlaWdodCB8fCB0aGlzLmltYWdlLmRvbUVsZW1lbnQuaGVpZ2h0IC0gdGhpcy5fZnJhbWVUcmltWTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHBoaW5hLmRpc3BsYXkuU3ByaXRlLnByb3RvdHlwZS5zZXRGcmFtZUluZGV4ID0gZnVuY3Rpb24oaW5kZXgsIHdpZHRoLCBoZWlnaHQpIHtcbiAgICB2YXIgc3ggPSB0aGlzLl9mcmFtZVRyaW1YIHx8IDA7XG4gICAgdmFyIHN5ID0gdGhpcy5fZnJhbWVUcmltWSB8fCAwO1xuICAgIHZhciBzdyA9IHRoaXMuX2ZyYW1lVHJpbVdpZHRoICB8fCAodGhpcy5pbWFnZS5kb21FbGVtZW50LndpZHRoLXN4KTtcbiAgICB2YXIgc2ggPSB0aGlzLl9mcmFtZVRyaW1IZWlnaHQgfHwgKHRoaXMuaW1hZ2UuZG9tRWxlbWVudC5oZWlnaHQtc3kpO1xuXG4gICAgdmFyIHR3ICA9IHdpZHRoIHx8IHRoaXMud2lkdGg7ICAgICAgLy8gdHdcbiAgICB2YXIgdGggID0gaGVpZ2h0IHx8IHRoaXMuaGVpZ2h0OyAgICAvLyB0aFxuICAgIHZhciByb3cgPSB+fihzdyAvIHR3KTtcbiAgICB2YXIgY29sID0gfn4oc2ggLyB0aCk7XG4gICAgdmFyIG1heEluZGV4ID0gcm93KmNvbDtcbiAgICBpbmRleCA9IGluZGV4JW1heEluZGV4O1xuXG4gICAgdmFyIHggICA9IGluZGV4JXJvdztcbiAgICB2YXIgeSAgID0gfn4oaW5kZXgvcm93KTtcbiAgICB0aGlzLnNyY1JlY3QueCA9IHN4K3gqdHc7XG4gICAgdGhpcy5zcmNSZWN0LnkgPSBzeSt5KnRoO1xuICAgIHRoaXMuc3JjUmVjdC53aWR0aCAgPSB0dztcbiAgICB0aGlzLnNyY1JlY3QuaGVpZ2h0ID0gdGg7XG5cbiAgICB0aGlzLl9mcmFtZUluZGV4ID0gaW5kZXg7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG59KTsiLCJwaGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG4gIC8vIOaWh+Wtl+WIl+OBi+OCieaVsOWApOOCkuaKveWHuuOBmeOCi1xuICAvLyDjg6zjgqTjgqLjgqbjg4jjg5XjgqHjgqTjg6vjgYvjgonkvZzmpa3jgZnjgovloLTlkIjjgavliKnnlKjjgZfjgZ/jgY/jgarjgotcbiAgLy8gaG9nZV8wIGhvZ2VfMeOBquOBqeOBi+OCieaVsOWtl+OBoOOBkeaKveWHulxuICAvLyAwMTAwX2hvZ2VfOTk5OSA9PiBbXCIwMTAwXCIgLCBcIjk5OTlcIl3jgavjgarjgotcbiAgLy8gaG9nZTAuMOOBqOOBi+OBr+OBqeOBhuOBmeOBi+OBqu+8n1xuICAvLyDmir3lh7rlvozjgatwYXJzZUludOOBmeOCi+OBi+OBr+aknOiojuS4rVxuICBTdHJpbmcucHJvdG90eXBlLiRtZXRob2QoXCJtYXRjaEludFwiLCBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5tYXRjaCgvWzAtOV0rL2cpO1xuICB9KTtcbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmFzc2V0LlRleHR1cmUucHJvdG90eXBlLiRtZXRob2QoXCJfbG9hZFwiLCBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgdGhpcy5kb21FbGVtZW50ID0gbmV3IEltYWdlKCk7XG5cbiAgICB2YXIgaXNMb2NhbCA9IChsb2NhdGlvbi5wcm90b2NvbCA9PSAnZmlsZTonKTtcbiAgICBpZiAoISgvXmRhdGE6Ly50ZXN0KHRoaXMuc3JjKSkpIHtcbiAgICAgIHRoaXMuZG9tRWxlbWVudC5jcm9zc09yaWdpbiA9ICdhbm9ueW1vdXMnOyAvLyDjgq/jg63jgrnjgqrjg6rjgrjjg7Pop6PpmaRcbiAgICB9XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5kb21FbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgIHNlbGYubG9hZGVkID0gdHJ1ZTtcbiAgICAgIGUudGFyZ2V0Lm9ubG9hZCA9IG51bGw7XG4gICAgICBlLnRhcmdldC5vbmVycm9yID0gbnVsbDtcbiAgICAgIHJlc29sdmUoc2VsZik7XG4gICAgfTtcblxuICAgIHRoaXMuZG9tRWxlbWVudC5vbmVycm9yID0gZnVuY3Rpb24oZSkge1xuICAgICAgZS50YXJnZXQub25sb2FkID0gbnVsbDtcbiAgICAgIGUudGFyZ2V0Lm9uZXJyb3IgPSBudWxsO1xuICAgICAgY29uc29sZS5lcnJvcihcInBoaW5hLmFzc2V0LlRleHR1cmUgX2xvYWQgb25FcnJvciBcIiwgdGhpcy5zcmMpO1xuICAgIH07XG5cbiAgICB0aGlzLmRvbUVsZW1lbnQuc3JjID0gdGhpcy5zcmM7XG4gIH0pO1xuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5hY2Nlc3NvcnkuVHdlZW5lci5wcm90b3R5cGUuJG1ldGhvZChcIl91cGRhdGVUd2VlblwiLCBmdW5jdGlvbihhcHApIHtcbiAgICAvL+KAu+OBk+OCjOOBquOBhOOBqHBhdXNl44GM44GG44GU44GL44Gq44GEXG4gICAgaWYgKCF0aGlzLnBsYXlpbmcpIHJldHVybjtcblxuICAgIHZhciB0d2VlbiA9IHRoaXMuX3R3ZWVuO1xuICAgIHZhciB0aW1lID0gdGhpcy5fZ2V0VW5pdFRpbWUoYXBwKTtcblxuICAgIHR3ZWVuLmZvcndhcmQodGltZSk7XG4gICAgdGhpcy5mbGFyZSgndHdlZW4nKTtcblxuICAgIGlmICh0d2Vlbi50aW1lID49IHR3ZWVuLmR1cmF0aW9uKSB7XG4gICAgICBkZWxldGUgdGhpcy5fdHdlZW47XG4gICAgICB0aGlzLl90d2VlbiA9IG51bGw7XG4gICAgICB0aGlzLl91cGRhdGUgPSB0aGlzLl91cGRhdGVUYXNrO1xuICAgIH1cbiAgfSk7XG5cbiAgcGhpbmEuYWNjZXNzb3J5LlR3ZWVuZXIucHJvdG90eXBlLiRtZXRob2QoXCJfdXBkYXRlV2FpdFwiLCBmdW5jdGlvbihhcHApIHtcbiAgICAvL+KAu+OBk+OCjOOBquOBhOOBqHBhdXNl44GM44GG44GU44GL44Gq44GEXG4gICAgaWYgKCF0aGlzLnBsYXlpbmcpIHJldHVybjtcblxuICAgIHZhciB3YWl0ID0gdGhpcy5fd2FpdDtcbiAgICB2YXIgdGltZSA9IHRoaXMuX2dldFVuaXRUaW1lKGFwcCk7XG4gICAgd2FpdC50aW1lICs9IHRpbWU7XG5cbiAgICBpZiAod2FpdC50aW1lID49IHdhaXQubGltaXQpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl93YWl0O1xuICAgICAgdGhpcy5fd2FpdCA9IG51bGw7XG4gICAgICB0aGlzLl91cGRhdGUgPSB0aGlzLl91cGRhdGVUYXNrO1xuICAgIH1cbiAgfSk7XG5cbn0pO1xuIiwicGhpbmEuZGVmaW5lKFwiQWZ0ZXJCYW5uZXJcIiwge1xuICBzdXBlckNsYXNzOiAncGhpbmEuYWNjZXNzb3J5LkFjY2Vzc29yeScsXG5cbiAgaW5pdDogZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgdGhpcy5zdXBlckluaXQodGFyZ2V0KTtcbiAgICB0aGlzLm9mZnNldCA9IFZlY3RvcjIoMCwgMCk7XG4gICAgdGhpcy5iZWZvcmUgPSBudWxsO1xuICB9LFxuXG4gIHNldE9mZnNldDogZnVuY3Rpb24gKHgsIHkpIHtcbiAgICBpZiAoeCBpbnN0YW5jZW9mIFZlY3RvcjIpIHtcbiAgICAgIHRoaXMub2Zmc2V0LnNldCh4LngsIHkueCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy5vZmZzZXQuc2V0KHgsIHkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQ7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHsgc2NhbGU6IDAuMyAqIHRhcmdldC5zcGVlZCB8fCAxfTtcbiAgICBjb25zdCBwb3MgPSB0YXJnZXQucG9zaXRpb24uY2xvbmUoKS5hZGQodGhpcy5vZmZzZXQpO1xuICAgIGlmICh0aGlzLmJlZm9yZSkge1xuICAgICAgY29uc3QgZGlzID0gdW5pdC5wb3NpdGlvbi5kaXN0YW5jZSh0aGlzLmJlZm9yZSk7XG4gICAgICBjb25zdCBudW1TcGxpdCA9IE1hdGgubWF4KE1hdGguZmxvb3IoZGlzIC8gMyksIDYpO1xuICAgICAgY29uc3QgdW5pdFNwbGl0ID0gKDEgLyBudW1TcGxpdCk7XG4gICAgICBudW1TcGxpdC50aW1lcyhpID0+IHtcbiAgICAgICAgY29uc3QgcGVyID0gdW5pdFNwbGl0ICogaTtcbiAgICAgICAgY29uc3QgcFBvcyA9IFZlY3RvcjIocG9zLnggKiBwZXIgKyB0aGlzLmJlZm9yZS54ICogKDEgLSBwZXIpLCBwb3MueSAqIHBlciArIHRoaXMuYmVmb3JlLnkgKiAoMSAtIHBlcikpXG4gICAgICAgIGNvbnN0IHAgPSBQYXJ0aWNsZVNwcml0ZShvcHRpb25zKVxuICAgICAgICAgIC5zZXRQb3NpdGlvbihwUG9zLngsIHBQb3MueSlcbiAgICAgICAgICAuYWRkQ2hpbGRUbyh0YXJnZXQud29ybGQubWFwTGF5ZXJbTEFZRVJfRUZGRUNUX0JBQ0tdKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJlZm9yZSA9IFZlY3RvcjIoKTtcbiAgICB9XG4gICAgdGhpcy5iZWZvcmUuc2V0KHBvcy54LCBwb3MueSk7XG4gIH0sXG59KTtcbiIsInBoaW5hLmRlZmluZShcIlBhcnRpY2xlXCIsIHtcbiAgc3VwZXJDbGFzczogJ3BoaW5hLmRpc3BsYXkuQ2lyY2xlU2hhcGUnLFxuXG4gIF9zdGF0aWM6IHtcbiAgICBkZWZhdWx0Q29sb3I6IHtcbiAgICAgIHN0YXJ0OiAxMCwgLy8gY29sb3IgYW5nbGUg44Gu6ZaL5aeL5YCkXG4gICAgICBlbmQ6IDMwLCAgIC8vIGNvbG9yIGFuZ2xlIOOBrue1guS6huWApFxuICAgIH0sXG4gICAgZGVmYXVsU2NhbGU6IDEsICAgICAvLyDliJ3mnJ/jgrnjgrHjg7zjg6tcbiAgICBzY2FsZURlY2F5OiAwLjAzLCAgLy8g44K544Kx44O844Or44OA44Km44Oz44Gu44K544OU44O844OJXG4gIH0sXG4gIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSAob3B0aW9ucyB8fCB7fSkuJHNhZmUoeyBzdHJva2U6IGZhbHNlLCByYWRpdXM6IDI0LCBzY2FsZTogMS4wIH0pO1xuICAgIHRoaXMuc3VwZXJJbml0KHRoaXMub3B0aW9ucyk7XG5cbiAgICB0aGlzLmJsZW5kTW9kZSA9ICdsaWdodGVyJztcblxuICAgIGNvbnN0IGNvbG9yID0gdGhpcy5vcHRpb25zLmNvbG9yIHx8IFBhcnRpY2xlLmRlZmF1bHRDb2xvcjtcbiAgICBjb25zdCBncmFkID0gdGhpcy5jYW52YXMuY29udGV4dC5jcmVhdGVSYWRpYWxHcmFkaWVudCgwLCAwLCAwLCAwLCAwLCB0aGlzLnJhZGl1cyk7XG4gICAgZ3JhZC5hZGRDb2xvclN0b3AoMCwgJ2hzbGEoezB9LCA3NSUsIDUwJSwgMS4wKScuZm9ybWF0KE1hdGgucmFuZGludChjb2xvci5zdGFydCwgY29sb3IuZW5kKSkpO1xuICAgIGdyYWQuYWRkQ29sb3JTdG9wKDEsICdoc2xhKHswfSwgNzUlLCA1MCUsIDAuMCknLmZvcm1hdChNYXRoLnJhbmRpbnQoY29sb3Iuc3RhcnQsIGNvbG9yLmVuZCkpKTtcblxuICAgIHRoaXMuZmlsbCA9IGdyYWQ7XG5cbiAgICB0aGlzLmJlZ2luUG9zaXRpb24gPSBWZWN0b3IyKCk7XG4gICAgdGhpcy52ZWxvY2l0eSA9IHRoaXMub3B0aW9ucy52ZWxvY2l0eSB8fCBWZWN0b3IyKDAsIDApO1xuICAgIHRoaXMub25lKFwiZW50ZXJmcmFtZVwiLCAoKSA9PiB0aGlzLnJlc2V0KCkpO1xuICB9LFxuXG4gIHJlc2V0OiBmdW5jdGlvbih4LCB5KSB7XG4gICAgeCA9IHggfHwgdGhpcy54O1xuICAgIHkgPSB5IHx8IHRoaXMueTtcbiAgICB0aGlzLmJlZ2luUG9zaXRpb24uc2V0KHgsIHkpO1xuICAgIHRoaXMucG9zaXRpb24uc2V0KHRoaXMuYmVnaW5Qb3NpdGlvbi54LCB0aGlzLmJlZ2luUG9zaXRpb24ueSk7XG4gICAgdGhpcy5zY2FsZVggPSB0aGlzLnNjYWxlWSA9IHRoaXMub3B0aW9ucy5zY2FsZSB8fCBNYXRoLnJhbmRmbG9hdChQYXJ0aWNsZS5kZWZhdWxTY2FsZSAqIDAuOCwgUGFydGljbGUuZGVmYXVsU2NhbGUgKiAxLjIpO1xuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wb3NpdGlvbi5hZGQodGhpcy52ZWxvY2l0eSk7XG4gICAgdGhpcy52ZWxvY2l0eS54ICo9IDAuOTk7XG4gICAgdGhpcy52ZWxvY2l0eS55ICo9IDAuOTk7XG4gICAgdGhpcy5zY2FsZVggLT0gUGFydGljbGUuc2NhbGVEZWNheTtcbiAgICB0aGlzLnNjYWxlWSAtPSBQYXJ0aWNsZS5zY2FsZURlY2F5O1xuXG4gICAgaWYgKHRoaXMuc2NhbGVYIDwgMCkgdGhpcy5yZW1vdmUoKTtcbiAgfSxcblxuICBzZXRWZWxvY2l0eTogZnVuY3Rpb24oeCwgeSkge1xuICAgIGlmICh4IGluc3RhbmNlb2YgVmVjdG9yMikge1xuICAgICAgdGhpcy52ZWxvY2l0eSA9IHg7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy52ZWxvY2l0eS54ID0geDtcbiAgICB0aGlzLnZlbG9jaXR5LnggPSB5O1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG59KTtcbiIsInBoaW5hLmRlZmluZShcIlBhcnRpY2xlU3ByaXRlXCIsIHtcbiAgc3VwZXJDbGFzczogJ3BoaW5hLmRpc3BsYXkuU3ByaXRlJyxcblxuICBfc3RhdGljOiB7XG4gICAgZGVmYXVsdFNjYWxlOiAxLjAsICAgIC8vIOWIneacn+OCueOCseODvOODq1xuICAgIHNjYWxlRGVjYXk6IDAuMDEsICAvLyDjgrnjgrHjg7zjg6vjg4Djgqbjg7Pjga7jgrnjg5Tjg7zjg4lcbiAgfSxcbiAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHRoaXMub3B0aW9ucyA9IChvcHRpb25zIHx8IHt9KS4kc2FmZSh7IHN0cm9rZTogZmFsc2UsIHJhZGl1czogMjQsIHNjYWxlOiAxLjAgfSk7XG4gICAgdGhpcy5zdXBlckluaXQoXCJwYXJ0aWNsZVwiLCAxNiwgMTYpO1xuXG4gICAgdGhpcy5ibGVuZE1vZGUgPSAnbGlnaHRlcic7XG5cbiAgICB0aGlzLmJlZ2luUG9zaXRpb24gPSBWZWN0b3IyKCk7XG4gICAgdGhpcy52ZWxvY2l0eSA9IHRoaXMub3B0aW9ucy52ZWxvY2l0eSB8fCBWZWN0b3IyKDAsIDApO1xuICAgIHRoaXMub25lKFwiZW50ZXJmcmFtZVwiLCAoKSA9PiB0aGlzLnJlc2V0KCkpO1xuICB9LFxuXG4gIHJlc2V0OiBmdW5jdGlvbih4LCB5KSB7XG4gICAgeCA9IHggfHwgdGhpcy54O1xuICAgIHkgPSB5IHx8IHRoaXMueTtcbiAgICB0aGlzLmJlZ2luUG9zaXRpb24uc2V0KHgsIHkpO1xuICAgIHRoaXMucG9zaXRpb24uc2V0KHRoaXMuYmVnaW5Qb3NpdGlvbi54LCB0aGlzLmJlZ2luUG9zaXRpb24ueSk7XG4gICAgdGhpcy5zY2FsZVggPSB0aGlzLnNjYWxlWSA9IHRoaXMub3B0aW9ucy5zY2FsZSB8fCBNYXRoLnJhbmRmbG9hdChQYXJ0aWNsZVNwcml0ZS5kZWZhdWxTY2FsZSAqIDAuOCwgUGFydGljbGVTcHJpdGUuZGVmYXVsU2NhbGUgKiAxLjIpO1xuICAgIHRoaXMuc2NhbGVEZWNheSA9IHRoaXMub3B0aW9ucy5zY2FsZURlY2F5IHx8IFBhcnRpY2xlU3ByaXRlLnNjYWxlRGVjYXk7XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnBvc2l0aW9uLmFkZCh0aGlzLnZlbG9jaXR5KTtcbiAgICB0aGlzLnZlbG9jaXR5LnggKj0gMC45OTtcbiAgICB0aGlzLnZlbG9jaXR5LnkgKj0gMC45OTtcbiAgICB0aGlzLnNjYWxlWCAtPSB0aGlzLnNjYWxlRGVjYXk7XG4gICAgdGhpcy5zY2FsZVkgLT0gdGhpcy5zY2FsZURlY2F5O1xuXG4gICAgaWYgKHRoaXMuc2NhbGVYIDwgMCkgdGhpcy5yZW1vdmUoKTtcbiAgfSxcblxuICBzZXRWZWxvY2l0eTogZnVuY3Rpb24oeCwgeSkge1xuICAgIGlmICh4IGluc3RhbmNlb2YgVmVjdG9yMikge1xuICAgICAgdGhpcy52ZWxvY2l0eSA9IHg7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy52ZWxvY2l0eS54ID0geDtcbiAgICB0aGlzLnZlbG9jaXR5LnggPSB5O1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kZWZpbmUoJ1dvcmxkJywge1xuICAgIHN1cGVyQ2xhc3M6ICdEaXNwbGF5RWxlbWVudCcsXG5cbiAgICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICB0aGlzLnN1cGVySW5pdCgpO1xuICAgICAgdGhpcy5zZXR1cCgpO1xuXG4gICAgICB0aGlzLnRpbWUgPSAwO1xuICAgIH0sXG5cbiAgICBzZXR1cDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLm1hcEJhc2UgPSBEaXNwbGF5RWxlbWVudCgpXG4gICAgICAgIC5zZXRQb3NpdGlvbigwLCAwKVxuICAgICAgICAuYWRkQ2hpbGRUbyh0aGlzKTtcblxuICAgICAgLy/jg6zjgqTjg6Tjg7zmp4vnr4lcbiAgICAgIHRoaXMubWFwTGF5ZXIgPSBbXTtcbiAgICAgIChOVU1fTEFZRVJTKS50aW1lcyhpID0+IHtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSBEaXNwbGF5RWxlbWVudCgpLmFkZENoaWxkVG8odGhpcy5tYXBCYXNlKTtcbiAgICAgICAgdGhpcy5tYXBMYXllcltpXSA9IGxheWVyO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMucGxheWVyID0gUGxheWVyKHsgd29ybGQ6IHRoaXMgfSlcbiAgICAgICAgLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSF9IQUxGLCBTQ1JFRU5fSEVJR0hUX0hBTEYpXG4gICAgICAgIC5hZGRDaGlsZFRvKHRoaXMubWFwTGF5ZXJbTEFZRVJfUExBWUVSXSk7XG5cbiAgICAgIHRoaXMuc2V0dXBNYXAoKTtcbiAgICB9LFxuICAgIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNvbnRyb2xQbGF5ZXIoKTtcblxuICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5wbGF5ZXI7XG4gICAgICB0aGlzLm1hcEJhc2UueCA9IFNDUkVFTl9XSURUSF9IQUxGICAtIHBsYXllci54IC0gcGxheWVyLnZlbG9jaXR5LnggKiAzO1xuICAgICAgdGhpcy5tYXBCYXNlLnkgPSBTQ1JFRU5fSEVJR0hUX0hBTEYgLSBwbGF5ZXIueSAtIHBsYXllci52ZWxvY2l0eS55ICogMztcblxuICAgICAgdGhpcy50aW1lKys7XG4gICAgfSxcbiAgICBzZXR1cE1hcDogZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwMDA7IGkrKykge1xuICAgICAgICBSZWN0YW5nbGVTaGFwZSh7XG4gICAgICAgICAgd2lkdGg6IE1hdGgucmFuZGludCg1MCwgMjAwKSxcbiAgICAgICAgICBoZWlnaHQ6IE1hdGgucmFuZGludCg1MCwgMjAwKSxcbiAgICAgICAgICBmaWxsOiAnYmx1ZScsXG4gICAgICAgICAgc3Ryb2tlOiAnI2FhYScsXG4gICAgICAgICAgc3Ryb2tlV2lkdGg6IDQsXG4gICAgICAgICAgY29ybmVyUmFkaXVzOiAwLFxuICAgICAgICAgIHg6IE1hdGgucmFuZGludCgtMTAwMDAsIDEwMDAwKSxcbiAgICAgICAgICB5OiBNYXRoLnJhbmRpbnQoLTUwMDAsIDUwMDApLFxuICAgICAgICB9KS5hZGRDaGlsZFRvKHRoaXMubWFwTGF5ZXJbTEFZRVJfQkFDS0dST1VORF0pO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBjb250cm9sUGxheWVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IHBsYXllciA9IHRoaXMucGxheWVyO1xuICAgICAgdmFyIGN0ID0gcGhpbmFfYXBwLmNvbnRyb2xsZXI7XG4gICAgICBpZiAodGhpcy50aW1lICUgMyA9PSAwKSB7XG4gICAgICAgIGlmIChjdC5sZWZ0KSB7XG4gICAgICAgICAgcGxheWVyLmRpcmVjdGlvbisrO1xuICAgICAgICAgIGlmIChwbGF5ZXIuZGlyZWN0aW9uID4gMTUpIHBsYXllci5kaXJlY3Rpb24gPSAwO1xuICAgICAgICB9IGVsc2UgaWYgKGN0LnJpZ2h0KSB7XG4gICAgICAgICAgcGxheWVyLmRpcmVjdGlvbi0tO1xuICAgICAgICAgIGlmIChwbGF5ZXIuZGlyZWN0aW9uIDwgMCkgcGxheWVyLmRpcmVjdGlvbiA9IDE1O1xuICAgICAgICB9XG4gICAgICAgIHBsYXllci5zcHJpdGUuc2V0RnJhbWVJbmRleChwbGF5ZXIuZGlyZWN0aW9uKTtcbiAgICAgICAgaWYgKGN0LnVwKSB7XG4gICAgICAgICAgcGxheWVyLnNwZWVkICs9IDAuMTtcbiAgICAgICAgICBpZiAocGxheWVyLnNwZWVkID4gMSkgcGxheWVyLnNwZWVkID0gMTtcbiAgICAgICAgICBjb25zdCByYWQgPSAocGxheWVyLmRpcmVjdGlvbiAqIDIyLjUpLnRvUmFkaWFuKCk7XG4gICAgICAgICAgcGxheWVyLnZlbG9jaXR5LnggKz0gLU1hdGguc2luKHJhZCkgKiBwbGF5ZXIuc3BlZWQ7XG4gICAgICAgICAgcGxheWVyLnZlbG9jaXR5LnkgKz0gLU1hdGguY29zKHJhZCkgKiBwbGF5ZXIuc3BlZWQ7XG4gICAgICAgICAgaWYgKHBsYXllci52ZWxvY2l0eS5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICBwbGF5ZXIudmVsb2NpdHkubm9ybWFsaXplKCk7XG4gICAgICAgICAgICBwbGF5ZXIudmVsb2NpdHkubXVsKDIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwbGF5ZXIuc3BlZWQgKj0gMC45ODtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvL+S4i+OBq+iQveOBoeOCi1xuICAgICAgaWYgKCFjdC51cCkgcGxheWVyLnZlbG9jaXR5LnkgKz0gMC4xO1xuXG4gICAgICBwbGF5ZXIucG9zaXRpb24uYWRkKHBsYXllci52ZWxvY2l0eSk7XG4gICAgICBwbGF5ZXIudmVsb2NpdHkubXVsKDAuOTkpO1xuXG4gICAgICAvL+OCouODleOCv+ODvOODkOODvOODiuODvFxuICAgICAgaWYgKGN0LnVwKSB7XG4gICAgICAgIGNvbnN0IHJhZCA9ICh0aGlzLnBsYXllci5kaXJlY3Rpb24gKiAyMi41KS50b1JhZGlhbigpO1xuICAgICAgICB0aGlzLmVudGVyQWZ0ZXJCYW5uZXIodGhpcy5wbGF5ZXIsIFZlY3RvcjIoTWF0aC5zaW4ocmFkKSAqIDgsIE1hdGguY29zKHJhZCkgKiA4KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnBsYXllci5iZWZvcmUgPSBudWxsO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBlbnRlckFmdGVyQmFubmVyOiBmdW5jdGlvbih1bml0LCBvZmZzZXQpIHtcbiAgICAgIG9mZnNldCA9IG9mZnNldCB8fCBWZWN0b3IyKDAsIDApO1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgc2NhbGU6IDAuMyAqIHVuaXQuc3BlZWQgfTtcbiAgICAgIGNvbnN0IHBvcyA9IHVuaXQucG9zaXRpb24uY2xvbmUoKS5hZGQob2Zmc2V0KTtcbiAgICAgIGlmICh1bml0LmJlZm9yZSkge1xuICAgICAgICBjb25zdCBkaXMgPSB1bml0LnBvc2l0aW9uLmRpc3RhbmNlKHVuaXQuYmVmb3JlKTtcbiAgICAgICAgY29uc3QgbnVtU3BsaXQgPSBNYXRoLm1heChNYXRoLmZsb29yKGRpcyAvIDMpLCA2KTtcbiAgICAgICAgY29uc3QgdW5pdFNwbGl0ID0gKDEgLyBudW1TcGxpdCk7XG4gICAgICAgIG51bVNwbGl0LnRpbWVzKGkgPT4ge1xuICAgICAgICAgIGNvbnN0IHBlciA9IHVuaXRTcGxpdCAqIGk7XG4gICAgICAgICAgY29uc3QgcFBvcyA9IFZlY3RvcjIocG9zLnggKiBwZXIgKyB1bml0LmJlZm9yZS54ICogKDEgLSBwZXIpLCBwb3MueSAqIHBlciArIHVuaXQuYmVmb3JlLnkgKiAoMSAtIHBlcikpXG4gICAgICAgICAgY29uc3QgcCA9IFBhcnRpY2xlU3ByaXRlKG9wdGlvbnMpXG4gICAgICAgICAgICAuc2V0UG9zaXRpb24ocFBvcy54LCBwUG9zLnkpXG4gICAgICAgICAgICAuYWRkQ2hpbGRUbyh0aGlzLm1hcExheWVyW0xBWUVSX0VGRkVDVF9CQUNLXSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdW5pdC5iZWZvcmUgPSBWZWN0b3IyKCk7XG4gICAgICB9XG4gICAgICB1bml0LmJlZm9yZS5zZXQocG9zLngsIHBvcy55KTtcbiAgfSxcbiAgfSk7XG5cbn0pO1xuIiwicGhpbmEuZGVmaW5lKFwiQnVsbGV0XCIsIHtcbiAgc3VwZXJDbGFzczogJ3BoaW5hLmRpc3BsYXkuRGlzcGxheUVsZW1lbnQnLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB0aGlzLnN1cGVySW5pdChvcHRpb25zKTtcbiAgfSxcblxufSk7XG5cbiIsInBoaW5hLmRlZmluZShcIkxhc2VyXCIsIHtcbiAgc3VwZXJDbGFzczogJ3BoaW5hLmRpc3BsYXkuRGlzcGxheUVsZW1lbnQnLFxuXG4gIF9zdGF0aWM6IHtcbiAgICBkZWZhdWx0T3B0aW9uczoge1xuICAgICAgbGVuZ3RoOiAxMDAwLFxuICAgIH0sXG4gIH0sXG5cbiAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHRoaXMub3B0aW9ucyA9IChvcHRpb25zIHx8IHt9KS4kc2FmZShMYXNlci5kZWZhdWx0T3B0aW9ucyk7XG4gICAgdGhpcy5zdXBlckluaXQob3B0aW9ucyk7XG4gICAgdGhpcy5zcHJpdGUgPSBSZWN0YW5nbGVTaGFwZSh7IHdpZHRoOiA4LCBoZWlnaHQ6IHRoaXMub3B0aW9ucy5sZW5ndGggfSkuYWRkQ2hpbGRUbyh0aGlzKTtcbiAgfSxcblxufSk7XG5cbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kZWZpbmUoJ1BsYXllcicsIHtcbiAgICBzdXBlckNsYXNzOiAnQmFzZVVuaXQnLFxuXG4gICAgc3BlZWQ6IDAsXG5cbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuc3VwZXJJbml0KHsgd2lkdGg6IDMyLCBoZWlnaHQ6IDMyIH0pO1xuXG4gICAgICB0aGlzLnNwcml0ZSA9IFNwcml0ZShcImZpZ2h0ZXJcIiwgMzIsIDMyKVxuICAgICAgICAuc2V0RnJhbWVJbmRleCgwKVxuICAgICAgICAuYWRkQ2hpbGRUbyh0aGlzLmJhc2UpO1xuICAgIH0sXG4gIH0pO1xufSk7XG4iLCIvL1xuLy8g44K344O844Oz44Ko44OV44Kn44Kv44OI44Gu5Z+656SO44Kv44Op44K5XG4vL1xucGhpbmEuZGVmaW5lKFwiU2NlbmVFZmZlY3RCYXNlXCIsIHtcbiAgc3VwZXJDbGFzczogXCJJbnB1dEludGVyY2VwdFwiLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgdGhpcy5lbmFibGUoKTtcbiAgfSxcblxufSk7XG4iLCIvL1xuLy8g44K344O844Oz44Ko44OV44Kn44Kv44OI77ya6KSH5pWw44Gu5YaG44Gn44OV44Kn44O844OJ44Kk44Oz44Ki44Km44OIXG4vL1xucGhpbmEuZGVmaW5lKFwiU2NlbmVFZmZlY3RDaXJjbGVGYWRlXCIsIHtcbiAgc3VwZXJDbGFzczogXCJTY2VuZUVmZmVjdEJhc2VcIixcblxuICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdGhpcy5vcHRpb25zID0gKHt9KS4kc2FmZShvcHRpb25zLCBTY2VuZUVmZmVjdENpcmNsZUZhZGUuZGVmYXVsdHMpO1xuXG4gICAgdGhpcy5zdXBlckluaXQoKTtcbiAgfSxcblxuICBfY3JlYXRlQ2lyY2xlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBudW0gPSA1O1xuICAgIGNvbnN0IHdpZHRoID0gU0NSRUVOX1dJRFRIIC8gbnVtO1xuICAgIHJldHVybiBBcnJheS5yYW5nZSgoU0NSRUVOX0hFSUdIVCAvIHdpZHRoKSArIDEpLm1hcCh5ID0+IHtcbiAgICAgIHJldHVybiBBcnJheS5yYW5nZShudW0gKyAxKS5tYXAoeCA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmFkZENoaWxkKENpcmNsZVNoYXBlKHtcbiAgICAgICAgICB4OiB4ICogd2lkdGgsXG4gICAgICAgICAgeTogeSAqIHdpZHRoLFxuICAgICAgICAgIGZpbGw6IHRoaXMub3B0aW9ucy5jb2xvcixcbiAgICAgICAgICBzdHJva2U6IG51bGwsXG4gICAgICAgICAgcmFkaXVzOiB3aWR0aCAqIDAuNSxcbiAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgYmVnaW46IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGNpcmNsZXMgPSB0aGlzLl9jcmVhdGVDaXJjbGUoKTtcbiAgICBjb25zdCB0YXNrcyA9IFtdO1xuICAgIGNpcmNsZXMuZm9yRWFjaCgoeExpbmUsIHkpID0+IHtcbiAgICAgIHhMaW5lLmZvckVhY2goKGNpcmNsZSwgeCkgPT4ge1xuICAgICAgICBjaXJjbGUuc2NhbGVYID0gMDtcbiAgICAgICAgY2lyY2xlLnNjYWxlWSA9IDA7XG4gICAgICAgIHRhc2tzLnB1c2gobmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgY2lyY2xlLnR3ZWVuZXIuY2xlYXIoKVxuICAgICAgICAgICAgLnRvKHtcbiAgICAgICAgICAgICAgc2NhbGVYOiAxLjUsXG4gICAgICAgICAgICAgIHNjYWxlWTogMS41XG4gICAgICAgICAgICB9LCA1MDAsIFwiZWFzZU91dFF1YWRcIilcbiAgICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgY2lyY2xlLnJlbW92ZSgpO1xuICAgICAgICAgICAgICBjaXJjbGUuZGVzdHJveUNhbnZhcygpO1xuICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLmNsZWFyKCk7XG4gICAgICAgICAgICAgIHRoaXMuZGlzYWJsZSgpO1xuICAgICAgICAgICAgICByZXNvbHZlKClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwodGFza3MpO1xuICB9LFxuXG4gIGZpbmlzaDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jaGlsZHJlbi5jbGVhcigpO1xuXG4gICAgY29uc3QgY2lyY2xlcyA9IHRoaXMuX2NyZWF0ZUNpcmNsZSgpO1xuICAgIGNvbnN0IHRhc2tzID0gW107XG4gICAgY2lyY2xlcy5mb3JFYWNoKHhMaW5lID0+IHtcbiAgICAgIHhMaW5lLmZvckVhY2goY2lyY2xlID0+IHtcbiAgICAgICAgY2lyY2xlLnNjYWxlWCA9IDEuNTtcbiAgICAgICAgY2lyY2xlLnNjYWxlWSA9IDEuNTtcbiAgICAgICAgdGFza3MucHVzaChuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICBjaXJjbGUudHdlZW5lci5jbGVhcigpXG4gICAgICAgICAgICAudG8oe1xuICAgICAgICAgICAgICBzY2FsZVg6IDAsXG4gICAgICAgICAgICAgIHNjYWxlWTogMFxuICAgICAgICAgICAgfSwgNTAwLCBcImVhc2VPdXRRdWFkXCIpXG4gICAgICAgICAgICAuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICAgIGNpcmNsZS5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgY2lyY2xlLmRlc3Ryb3lDYW52YXMoKTtcbiAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5jbGVhcigpO1xuICAgICAgICAgICAgICB0aGlzLmRpc2FibGUoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLmFsbCh0YXNrcyk7XG4gIH0sXG5cbiAgX3N0YXRpYzoge1xuICAgIGRlZmF1bHRzOiB7XG4gICAgICBjb2xvcjogXCJ3aGl0ZVwiLFxuICAgIH1cbiAgfVxuXG59KTtcbiIsIi8vXG4vLyDjgrfjg7zjg7Pjgqjjg5Xjgqfjgq/jg4jvvJrjg5Xjgqfjg7zjg4njgqTjg7PjgqLjgqbjg4hcbi8vXG5waGluYS5kZWZpbmUoXCJTY2VuZUVmZmVjdEZhZGVcIiwge1xuICBzdXBlckNsYXNzOiBcIlNjZW5lRWZmZWN0QmFzZVwiLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSAoe30pLiRzYWZlKG9wdGlvbnMsIHtcbiAgICAgIGNvbG9yOiBcImJsYWNrXCIsXG4gICAgICB0aW1lOiA1MDAsXG4gICAgfSk7XG5cbiAgICB0aGlzLnN1cGVySW5pdCgpO1xuICAgIHRoaXMuZnJvbUpTT04oe1xuICAgICAgY2hpbGRyZW46IHtcbiAgICAgICAgZmFkZToge1xuICAgICAgICAgIGNsYXNzTmFtZTogXCJSZWN0YW5nbGVTaGFwZVwiLFxuICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgd2lkdGg6IFNDUkVFTl9XSURUSCxcbiAgICAgICAgICAgIGhlaWdodDogU0NSRUVOX0hFSUdIVCxcbiAgICAgICAgICAgIGZpbGw6IHRoaXMub3B0aW9ucy5jb2xvcixcbiAgICAgICAgICAgIHN0cm9rZTogbnVsbCxcbiAgICAgICAgICAgIHBhZGRpbmc6IDAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB4OiBTQ1JFRU5fV0lEVEggKiAwLjUsXG4gICAgICAgICAgeTogU0NSRUVOX0hFSUdIVCAqIDAuNSxcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBzdGF5OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBmYWRlID0gdGhpcy5mYWRlO1xuICAgIGZhZGUuYWxwaGEgPSAxLjA7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9LFxuXG4gIGJlZ2luOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICBjb25zdCBmYWRlID0gdGhpcy5mYWRlO1xuICAgICAgZmFkZS5hbHBoYSA9IDEuMDtcbiAgICAgIGZhZGUudHdlZW5lci5jbGVhcigpXG4gICAgICAgIC5mYWRlT3V0KHRoaXMub3B0aW9ucy50aW1lKVxuICAgICAgICAuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgLy8xRnJhbWXmj4/nlLvjgZXjgozjgabjgZfjgb7jgaPjgabjgaHjgonjgaTjgY/jga7jgadlbnRlcmZyYW1l44Gn5YmK6ZmkXG4gICAgICAgICAgdGhpcy5vbmUoXCJlbnRlcmZyYW1lXCIsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZmFkZS5yZW1vdmUoKTtcbiAgICAgICAgICAgIHRoaXMuZmFkZS5kZXN0cm95Q2FudmFzKCk7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZSgpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICBmaW5pc2g6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgIGNvbnN0IGZhZGUgPSB0aGlzLmZhZGU7XG4gICAgICBmYWRlLmFscGhhID0gMC4wO1xuICAgICAgZmFkZS50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgLmZhZGVJbih0aGlzLm9wdGlvbnMudGltZSlcbiAgICAgICAgLmNhbGwoKCkgPT4ge1xuICAgICAgICAgIHRoaXMuZmxhcmUoXCJmaW5pc2hcIik7XG4gICAgICAgICAgLy8xRnJhbWXmj4/nlLvjgZXjgozjgabjgZfjgb7jgaPjgabjgaHjgonjgaTjgY/jga7jgadlbnRlcmZyYW1l44Gn5YmK6ZmkXG4gICAgICAgICAgdGhpcy5vbmUoXCJlbnRlcmZyYW1lXCIsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZmFkZS5yZW1vdmUoKTtcbiAgICAgICAgICAgIHRoaXMuZmFkZS5kZXN0cm95Q2FudmFzKCk7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZSgpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICBfc3RhdGljOiB7XG4gICAgZGVmYXVsdHM6IHtcbiAgICAgIGNvbG9yOiBcImJsYWNrXCIsXG4gICAgfVxuICB9XG5cbn0pO1xuIiwiLy9cbi8vIOOCt+ODvOODs+OCqOODleOCp+OCr+ODiO+8muOBquOBq+OCguOBl+OBquOBhFxuLy9cbnBoaW5hLmRlZmluZShcIlNjZW5lRWZmZWN0Tm9uZVwiLCB7XG4gIHN1cGVyQ2xhc3M6IFwiU2NlbmVFZmZlY3RCYXNlXCIsXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcbiAgfSxcblxuICBiZWdpbjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgdGhpcy5vbmUoXCJlbnRlcmZyYW1lXCIsICgpID0+IHRoaXMucmVtb3ZlKCkpO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0pO1xuICB9LFxuXG4gIGZpbmlzaDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgdGhpcy5vbmUoXCJlbnRlcmZyYW1lXCIsICgpID0+IHRoaXMucmVtb3ZlKCkpO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0pO1xuICB9XG5cbn0pO1xuIiwiLy9cbi8vIOOCt+ODvOODs+OCqOODleOCp+OCr+ODiO+8muOCv+OCpOODq+ODleOCp+ODvOODiVxuLy9cbnBoaW5hLmRlZmluZShcIlNjZW5lRWZmZWN0VGlsZUZhZGVcIiwge1xuICBzdXBlckNsYXNzOiBcIlNjZW5lRWZmZWN0QmFzZVwiLFxuXG4gIHRpbGVzOiBudWxsLFxuICBudW06IDE1LFxuICBzcGVlZDogNTAsXG5cbiAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgdGhpcy5vcHRpb25zID0gKHt9KS4kc2FmZShvcHRpb25zLCB7XG4gICAgICBjb2xvcjogXCJibGFja1wiLFxuICAgICAgd2lkdGg6IDc2OCxcbiAgICAgIGhlaWdodDogMTAyNCxcbiAgICB9KTtcblxuICAgIHRoaXMudGlsZXMgPSB0aGlzLl9jcmVhdGVUaWxlcygpO1xuICB9LFxuXG4gIF9jcmVhdGVUaWxlczogZnVuY3Rpb24oKSB7XG4gICAgY29uc3Qgd2lkdGggPSBNYXRoLmZsb29yKHRoaXMub3B0aW9ucy53aWR0aCAvIHRoaXMubnVtKTtcblxuICAgIHJldHVybiBBcnJheS5yYW5nZSgodGhpcy5vcHRpb25zLmhlaWdodCAvIHdpZHRoKSArIDEpLm1hcCh5ID0+IHtcbiAgICAgIHJldHVybiBBcnJheS5yYW5nZSh0aGlzLm51bSArIDEpLm1hcCh4ID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkQ2hpbGQoUmVjdGFuZ2xlU2hhcGUoe1xuICAgICAgICAgIHdpZHRoOiB3aWR0aCArIDIsXG4gICAgICAgICAgaGVpZ2h0OiB3aWR0aCArIDIsXG4gICAgICAgICAgeDogeCAqIHdpZHRoLFxuICAgICAgICAgIHk6IHkgKiB3aWR0aCxcbiAgICAgICAgICBmaWxsOiB0aGlzLm9wdGlvbnMuY29sb3IsXG4gICAgICAgICAgc3Ryb2tlOiBudWxsLFxuICAgICAgICAgIHN0cm9rZVdpZHRoOiAwLFxuICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICBzdGF5OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnRpbGVzLmZvckVhY2goKHhsaW5lLCB5KSA9PiB7XG4gICAgICB4bGluZS5mb3JFYWNoKCh0aWxlLCB4KSA9PiB7XG4gICAgICAgIHRpbGUuc2NhbGVYID0gMS4wO1xuICAgICAgICB0aWxlLnNjYWxlWSA9IDEuMDtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfSxcblxuICBiZWdpbjogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdGFza3MgPSBbXTtcbiAgICB0aGlzLnRpbGVzLmZvckVhY2goKHhsaW5lLCB5KSA9PiB7XG4gICAgICBjb25zdCB3ID0gTWF0aC5yYW5kZmxvYXQoMCwgMSkgKiB0aGlzLnNwZWVkO1xuICAgICAgeGxpbmUuZm9yRWFjaCgodGlsZSwgeCkgPT4ge1xuICAgICAgICB0aWxlLnNjYWxlWCA9IDEuMDtcbiAgICAgICAgdGlsZS5zY2FsZVkgPSAxLjA7XG4gICAgICAgIHRhc2tzLnB1c2gobmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgdGlsZS50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAgIC53YWl0KHggKiB0aGlzLnNwZWVkICsgdylcbiAgICAgICAgICAgIC50byh7XG4gICAgICAgICAgICAgIHNjYWxlWDogMCxcbiAgICAgICAgICAgICAgc2NhbGVZOiAwXG4gICAgICAgICAgICB9LCA1MDAsIFwiZWFzZU91dFF1YWRcIilcbiAgICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgdGlsZS5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgdGlsZS5kZXN0cm95Q2FudmFzKCk7XG4gICAgICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLmFsbCh0YXNrcylcbiAgfSxcblxuICBmaW5pc2g6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHRhc2tzID0gW107XG4gICAgdGhpcy50aWxlcy5mb3JFYWNoKCh4bGluZSwgeSkgPT4ge1xuICAgICAgY29uc3QgdyA9IE1hdGgucmFuZGZsb2F0KDAsIDEpICogdGhpcy5zcGVlZDtcbiAgICAgIHhsaW5lLmZvckVhY2goKHRpbGUsIHgpID0+IHtcbiAgICAgICAgdGlsZS5zY2FsZVggPSAwLjA7XG4gICAgICAgIHRpbGUuc2NhbGVZID0gMC4wO1xuICAgICAgICB0YXNrcy5wdXNoKG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgIHRpbGUudHdlZW5lci5jbGVhcigpXG4gICAgICAgICAgICAud2FpdCgoeGxpbmUubGVuZ3RoIC0geCkgKiB0aGlzLnNwZWVkICsgdylcbiAgICAgICAgICAgIC50byh7XG4gICAgICAgICAgICAgIHNjYWxlWDogMSxcbiAgICAgICAgICAgICAgc2NhbGVZOiAxXG4gICAgICAgICAgICB9LCA1MDAsIFwiZWFzZU91dFF1YWRcIilcbiAgICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgdGlsZS5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgdGlsZS5kZXN0cm95Q2FudmFzKCk7XG4gICAgICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLmFsbCh0YXNrcylcbiAgfSxcblxuICBfc3RhdGljOiB7XG4gICAgZGVmYXVsdHM6IHtcbiAgICAgIGNvbG9yOiBcImJsYWNrXCIsXG4gICAgfVxuICB9XG5cbn0pO1xuIiwiLy9cbi8vIOOCr+ODquODg+OCr+OChOOCv+ODg+ODgeOCkuOCpOODs+OCv+ODvOOCu+ODl+ODiOOBmeOCi1xuLy9cbnBoaW5hLmRlZmluZShcIklucHV0SW50ZXJjZXB0XCIsIHtcbiAgc3VwZXJDbGFzczogXCJEaXNwbGF5RWxlbWVudFwiLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3VwZXJJbml0KCk7XG5cbiAgICB0aGlzLm9uKFwiYWRkZWRcIiwgKCkgPT4ge1xuICAgICAgLy/opqrjgavlr77jgZfjgabopobjgYTjgYvjgbbjgZvjgotcbiAgICAgIHRoaXMud2lkdGggPSB0aGlzLnBhcmVudC53aWR0aDtcbiAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5wYXJlbnQuaGVpZ2h0O1xuICAgICAgdGhpcy5vcmlnaW5YID0gdGhpcy5wYXJlbnQub3JpZ2luWCB8fCAwO1xuICAgICAgdGhpcy5vcmlnaW5ZID0gdGhpcy5wYXJlbnQub3JpZ2luWSB8fCAwO1xuICAgICAgdGhpcy54ID0gMDtcbiAgICAgIHRoaXMueSA9IDA7XG4gICAgfSk7XG4gICAgdGhpcy5kaXNhYmxlKCk7XG4gIH0sXG5cbiAgZW5hYmxlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnNldEludGVyYWN0aXZlKHRydWUpO1xuICB9LFxuXG4gIGRpc2FibGU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc2V0SW50ZXJhY3RpdmUoZmFsc2UpO1xuICB9LFxuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBsZXQgZHVtbXlUZXh0dXJlID0gbnVsbDtcblxuICBwaGluYS5kZWZpbmUoXCJTcHJpdGVMYWJlbFwiLCB7XG4gICAgc3VwZXJDbGFzczogXCJEaXNwbGF5RWxlbWVudFwiLFxuXG4gICAgX3RleHQ6IG51bGwsXG4gICAgdGFibGU6IG51bGwsXG4gICAgZml4V2lkdGg6IDAsXG5cbiAgICBzcHJpdGVzOiBudWxsLFxuXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgaWYgKCFkdW1teVRleHR1cmUpIHtcbiAgICAgICAgZHVtbXlUZXh0dXJlID0gQ2FudmFzKCkuc2V0U2l6ZSgxLCAxKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zdXBlckluaXQob3B0aW9ucyk7XG4gICAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICAgIHRoaXMuZml4V2lkdGggPSBvcHRpb25zLmZpeFdpZHRoIHx8IDA7XG5cbiAgICAgIHRoaXMuc3ByaXRlcyA9IFtdO1xuXG4gICAgICB0aGlzLnNldFRleHQoXCJcIik7XG4gICAgfSxcblxuICAgIHNldFRleHQ6IGZ1bmN0aW9uKHRleHQpIHtcbiAgICAgIHRoaXMuX3RleHQgPSB0ZXh0O1xuXG4gICAgICBjb25zdCBjaGFycyA9IHRoaXMudGV4dC5zcGxpdChcIlwiKTtcblxuICAgICAgaWYgKHRoaXMuc3ByaXRlcy5sZW5ndGggPCBjaGFycy5sZW5ndGgpIHtcbiAgICAgICAgQXJyYXkucmFuZ2UoMCwgdGhpcy5zcHJpdGVzLmxlbmd0aCAtIGNoYXJzLmxlbmd0aCkuZm9yRWFjaCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5zcHJpdGVzLnB1c2goU3ByaXRlKGR1bW15VGV4dHVyZSkpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIEFycmF5LnJhbmdlKDAsIGNoYXJzLmxlbmd0aCAtIHRoaXMuc3ByaXRlcy5sZW5ndGgpLmZvckVhY2goKCkgPT4ge1xuICAgICAgICAgIHRoaXMuc3ByaXRlcy5sYXN0LnJlbW92ZSgpO1xuICAgICAgICAgIHRoaXMuc3ByaXRlcy5sZW5ndGggLT0gMTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3RleHQuc3BsaXQoXCJcIikubWFwKChjLCBpKSA9PiB7XG4gICAgICAgIHRoaXMuc3ByaXRlc1tpXVxuICAgICAgICAgIC5zZXRJbWFnZSh0aGlzLnRhYmxlW2NdKVxuICAgICAgICAgIC5zZXRPcmlnaW4odGhpcy5vcmlnaW5YLCB0aGlzLm9yaWdpblkpXG4gICAgICAgICAgLmFkZENoaWxkVG8odGhpcyk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdG90YWxXaWR0aCA9IHRoaXMuc3ByaXRlcy5yZWR1Y2UoKHcsIHMpID0+IHcgKyAodGhpcy5maXhXaWR0aCB8fCBzLndpZHRoKSwgMCk7XG4gICAgICBjb25zdCB0b3RhbEhlaWdodCA9IHRoaXMuc3ByaXRlcy5tYXAoXyA9PiBfLmhlaWdodCkuc29ydCgpLmxhc3Q7XG5cbiAgICAgIGxldCB4ID0gdG90YWxXaWR0aCAqIC10aGlzLm9yaWdpblg7XG4gICAgICB0aGlzLnNwcml0ZXMuZm9yRWFjaCgocykgPT4ge1xuICAgICAgICBjb25zdCB3aWR0aCA9IHRoaXMuZml4V2lkdGggfHwgcy53aWR0aDtcbiAgICAgICAgcy54ID0geCArIHdpZHRoICogcy5vcmlnaW5YO1xuICAgICAgICB4ICs9IHdpZHRoO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBfYWNjZXNzb3I6IHtcbiAgICAgIHRleHQ6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fdGV4dDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgdGhpcy5zZXRUZXh0KHYpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuXG4gIH0pO1xuXG59KTtcbiJdfQ==
