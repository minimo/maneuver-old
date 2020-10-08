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
    speed: 0,

    sprite: null,

    hp: 100,

    init: function(options) {
      this.superInit(options);
      this.world = options.world || null;
      this.base = DisplayElement().addChildTo(this);
      this.velocity = Vector2(0, 0);

      this.before = null;
    },
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

phina.define("Bullet", {
  superClass: 'phina.display.DisplayElement',

  init: function(options) {
    this.superInit(options);
  },

});


phina.namespace(function() {

  phina.define('EnemyyFighter', {
    superClass: 'BaseUnit',

    init: function(options) {
      options = options || {};
      this.superInit(options.$safe({ width: 32, height: 32 }));

      this.sprite = Sprite("fighter", 32, 32)
        .setFrameIndex(0)
        .addChildTo(this.base);

      this.player = options.player;
      this.velocity = Vector2(0, 0);
      this.angle = 0;
      this.speed = 10;

      this.time = 0;

      this.afterBanner = AfterBanner()
        .setLayer(this.world.mapLayer[LAYER_EFFECT_BACK])
        .attachTo(this);
    },

    update: function() {
      const toPlayer = Vector2(this.player.x - this.x ,this.player.y - this.y)
      if (toPlayer.length() > 30) {
        //自分から見たプレイヤーの方角
        const r = Math.atan2(toPlayer.y, toPlayer.x);
        let d = (r.toDegree() + 90);
        if (d < 0) d += 360;
        if (d > 360) d -= 360;
        this.angle = Math.floor(d / 22.5);
        this.sprite.setFrameIndex(this.angle);
        this.velocity.add(Vector2(Math.cos(r) * this.speed, Math.sin(r) * this.speed));
        this.velocity.normalize();
        this.velocity.mul(this.speed);
      }

      this.position.add(this.velocity);

      this.time++;
    },
  });
});

phina.define("Laser", {
  superClass: 'phina.display.DisplayElement',

  _static: {
    defaultOptions: {
      length: 500,
    },
  },

  init: function(options) {
    this.options = (options || {}).$safe(Laser.defaultOptions);
    this.superInit(options);
    this.sprite = RectangleShape({ width: 8, height: this.options.length }).addChildTo(this);
  },

});


const offset = [
  [ {x: -3, y:  0}, {x:  3, y:  0}, ], //  0 上

  [ {x: -3, y:  2}, {x:  3, y: -2}, ], //  1
  [ {x: -3, y:  2}, {x:  2, y:  0}, ], //  2
  [ {x: -3, y:  3}, {x:  0, y: -1}, ], //  3

  [ {x:  0, y:  0}, {x:  0, y:  0}, ], //  4 左

  [ {x: -3, y:  0}, {x:  3, y:  0}, ], //  5
  [ {x: -1, y: -2}, {x:  2, y:  2}, ], //  6
  [ {x: -3, y: -2}, {x:  3, y:  0}, ], //  7

  [ {x:  3, y:  0}, {x: -3, y:  0}, ], //  8 下

  [ {x:  3, y: -2}, {x: -3, y:  0}, ], //  9
  [ {x:  1, y: -2}, {x: -2, y:  2}, ], // 10
  [ {x:  3, y:  0}, {x: -3, y:  0}, ], // 11

  [ {x:  0, y:  0}, {x:  0, y:  0}, ], // 12 右

  [ {x: -3, y:  3}, {x:  0, y: -1}, ], // 13
  [ {x:  3, y:  2}, {x: -2, y:  0}, ], // 14
  [ {x:  3, y:  2}, {x: -3, y: -2}, ], // 15
];

phina.namespace(function() {

  phina.define('Player', {
    superClass: 'BaseUnit',

    init: function(options) {
      this.superInit(options.$safe({ width: 32, height: 32 }));

      this.sprite = Sprite("fighter", 32, 32)
        .setFrameIndex(0)
        .addChildTo(this.base);

      this.afterBanner = [];
      (2).times(i => {
        this.afterBanner[i] = AfterBanner()
          .setLayer(this.world.mapLayer[LAYER_EFFECT_BACK])
          .disable()
          .attachTo(this);
      });
    },
    update: function() {
      const rad = (this.direction * 22.5).toRadian();
      const x = -Math.sin(rad) * 8;
      const y = Math.cos(rad) * 8;
      (2).times(i => {
        const px = offset[this.direction][i].x;
        const py = offset[this.direction][i].y;
        this.afterBanner[i].setOffset( x + px, y + py);
      });
    },
  });
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
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF-100)
        .addChildTo(this.mapLayer[LAYER_PLAYER]);

      this.setupMap();
    },
    update: function() {
      this.controlPlayer();

      var kb = phina_app.keyboard;
      if (this.time % 30 == 0 && kb.getKey("E")) {
        console.log("enter enemy");
        const e = EnemyyFighter({ player: this.player, world: this })
          .addChildTo(this.mapLayer[LAYER_ENEMY]);
      }

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
          player.direction--;
          if (player.direction < 0) player.direction = 15;
        } else if (ct.right) {
          player.direction++;
          if (player.direction > 15) player.direction = 0;
        }
        player.sprite.setFrameIndex(player.direction);
        if (ct.up) {
          player.speed += 0.1;
          if (player.speed > 1) player.speed = 1;
          const rad = (player.direction * 22.5).toRadian();
          player.velocity.x += Math.sin(rad) * player.speed;
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
        const v = player.velocity.clone().mul(-1)
        player.afterBanner[0].enable().setVelocity(v);
        player.afterBanner[1].enable().setVelocity(v);
      } else {
        player.afterBanner[0].disable();
        player.afterBanner[1].disable();
      }

      if (ct.a) {
        
      }

      this.mapBase.x = SCREEN_WIDTH_HALF  - player.x - player.velocity.x * 3;
      this.mapBase.y = SCREEN_HEIGHT_HALF - player.y - player.velocity.y * 3;
    },
  });

});

phina.define("AfterBanner", {
  superClass: 'phina.accessory.Accessory',

  init: function(target) {
    this.superInit(target);

    this.isDisable = false;
    this.layer = null;
    this.offset = Vector2(0, 0);
    this.velocity = Vector2(0, 0);
    this.before = null;
  },

  setLayer: function(layer) {
    this.layer = layer;
    return this;
  },

  enable: function() {
    this.isDisable = false;
    return this;
  },

  disable: function() {
    this.isDisable = true;
    return this;
  },

  setOffset: function (x, y) {
    if (x instanceof Vector2) {
      this.offset.set(x.x, x.y);
      return this;
    }
    this.offset.set(x, y);
    return this;
  },

  setVelocity: function(x, y) {
    if (x instanceof Vector2) {
      this.velocity = x.clone().mul(-1);
      return this;
    }
    this.velocity.x = x;
    this.velocity.x = y;
    return this;
  },

  update: function() {
    if (this.isDisable) {
      this.before = null;
      return;
    }
    const target = this.target;
    const options = { scale: 0.3 };
    const pos = target.position.clone().add(this.offset);
    if (this.before) {
      const dis = target.position.distance(this.before);
      const numSplit = Math.max(Math.floor(dis / 3), 6);
      const unitSplit = (1 / numSplit);
      numSplit.times(i => {
        const per = unitSplit * i;
        const pPos = Vector2(pos.x * per + this.before.x * (1 - per), pos.y * per + this.before.y * (1 - per))
        ParticleSprite(options)
          .setPosition(pPos.x, pPos.y)
          .addChildTo(this.layer);
      });
      this.before.set(pos.x, pos.y);
    } else {
      this.before = Vector2(pos.x, pos.y);
    }
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
    this.superInit("particle", 16, 16);

    this.blendMode = 'lighter';

    this.beginPosition = Vector2();
    this.velocity = options.velocity || Vector2(0, 0);
    this.scaleX = this.scaleY = options.scale || ParticleSprite.defaultScale;
    this.scaleDecay = options.scaleDecay || ParticleSprite.scaleDecay;
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
      this.velocity = x.clone();
      return this;
    }
    this.velocity.x = x;
    this.velocity.x = y;
    return this;
  },

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCIwMTBfYXBwbGljYXRpb24vQXBwbGljYXRpb24uanMiLCIwMTBfYXBwbGljYXRpb24vQXNzZXRMaXN0LmpzIiwiMDEwX2FwcGxpY2F0aW9uL0Jhc2VTY2VuZS5qcyIsIjAxMF9hcHBsaWNhdGlvbi9GaXJzdFNjZW5lRmxvdy5qcyIsIjAzMF9iYXNlL0Jhc2VVbml0LmpzIiwiMDIwX3NjZW5lL21haW5zY2VuZS5qcyIsIjAyMF9zY2VuZS90aXRsZXNjZW5lLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvQnV0dG9uLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvQ2xpcFNwcml0ZS5qcyIsIjAwMF9jb21tb24vYWNjZXNzb3J5L0dhdWdlLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvR3JheXNjYWxlLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvTW91c2VDaGFzZXIuanMiLCIwMDBfY29tbW9uL2FjY2Vzc29yeS9NdWx0aVJlY3RhbmdsZUNsaXAuanMiLCIwMDBfY29tbW9uL2FjY2Vzc29yeS9QaWVDbGlwLmpzIiwiMDAwX2NvbW1vbi9hY2Nlc3NvcnkvUmVjdGFuZ2xlQ2xpcC5qcyIsIjAwMF9jb21tb24vYWNjZXNzb3J5L1RvZ2dsZS5qcyIsIjAwMF9jb21tb24vdXRpbC9CdXR0b25pemUuanMiLCIwMDBfY29tbW9uL3V0aWwvVGV4dHVyZVV0aWwuanMiLCIwMDBfY29tbW9uL3V0aWwvVGlsZWRtYXAuanMiLCIwMDBfY29tbW9uL3V0aWwvVGlsZXNldC5qcyIsIjAwMF9jb21tb24vdXRpbC9VdGlsLmpzIiwiMDAwX2NvbW1vbi91dGlsL3htbGxvYWRlci5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9Bc3NldExvYWRlci5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9CYXNlQXBwLmpzIiwiMDAwX2NvbW1vbi9leHRlbnNpb25zL0NhbnZhcy5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9DYW52YXNSZW5kZXJlci5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9DaGVja0Jyb3dzZXIuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvRGlzcGxheUVsZW1lbnQuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvRGlzcGxheVNjZW5lLmpzIiwiMDAwX2NvbW1vbi9leHRlbnNpb25zL0RvbUF1ZGlvU291bmQuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvRWxlbWVudC5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9JbnB1dC5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9MYWJlbC5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9Nb3VzZS5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9PYmplY3QyRC5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9QbGFpbkVsZW1lbnQuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvU2hhcGUuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvU291bmQuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvU291bmRNYW5hZ2VyLmpzIiwiMDAwX2NvbW1vbi9leHRlbnNpb25zL1Nwcml0ZS5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9TdHJpbmcuanMiLCIwMDBfY29tbW9uL2V4dGVuc2lvbnMvVGV4dHVyZS5qcyIsIjAwMF9jb21tb24vZXh0ZW5zaW9ucy9Ud2VlbmVyLmpzIiwiMDQwX2VsZW1lbnQvcGxheWVyL0J1bGxldC5qcyIsIjA0MF9lbGVtZW50L3BsYXllci9FbmVteUZpZ2h0ZXIuanMiLCIwNDBfZWxlbWVudC9wbGF5ZXIvTGFzZXIuanMiLCIwNDBfZWxlbWVudC9wbGF5ZXIvUGxheWVyLmpzIiwiMDQwX2VsZW1lbnQvd29ybGQvV29ybGQuanMiLCIwNDBfZWxlbWVudC9jb21tb24vQWZ0ZXJCYW5uZXIuanMiLCIwNDBfZWxlbWVudC9jb21tb24vUGFydGljbGUuanMiLCIwNDBfZWxlbWVudC9jb21tb24vUGFydGljbGVTcHJpdGUuanMiLCIwMDBfY29tbW9uL2VsZW1lbnRzL3NjZW5lRWZmZWN0cy9TY2VuZUVmZmVjdEJhc2UuanMiLCIwMDBfY29tbW9uL2VsZW1lbnRzL3NjZW5lRWZmZWN0cy9TY2VuZUVmZmVjdENpcmNsZUZhZGUuanMiLCIwMDBfY29tbW9uL2VsZW1lbnRzL3NjZW5lRWZmZWN0cy9TY2VuZUVmZmVjdEZhZGUuanMiLCIwMDBfY29tbW9uL2VsZW1lbnRzL3NjZW5lRWZmZWN0cy9TY2VuZUVmZmVjdE5vbmUuanMiLCIwMDBfY29tbW9uL2VsZW1lbnRzL3NjZW5lRWZmZWN0cy9TY2VuZUVmZmVjdFRpbGVGYWRlLmpzIiwiMDAwX2NvbW1vbi9lbGVtZW50cy91aS9JbnB1dEludGVyY2VwdC5qcyIsIjAwMF9jb21tb24vZWxlbWVudHMvdWkvU3ByaXRlTGFiZWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcmJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDekdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJidW5kbGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogIG1haW4uanNcbiAqL1xuXG5waGluYS5nbG9iYWxpemUoKTtcblxuY29uc3QgU0NSRUVOX1dJRFRIID0gNTc2O1xuY29uc3QgU0NSRUVOX0hFSUdIVCA9IDMyNDtcbmNvbnN0IFNDUkVFTl9XSURUSF9IQUxGID0gU0NSRUVOX1dJRFRIICogMC41O1xuY29uc3QgU0NSRUVOX0hFSUdIVF9IQUxGID0gU0NSRUVOX0hFSUdIVCAqIDAuNTtcblxuY29uc3QgU0NSRUVOX09GRlNFVF9YID0gMDtcbmNvbnN0IFNDUkVFTl9PRkZTRVRfWSA9IDA7XG5cbmNvbnN0IE5VTV9MQVlFUlMgPSA3O1xuY29uc3QgTEFURVJfRk9SRUdST1VORCA9IDY7XG5jb25zdCBMQVlFUl9FRkZFQ1RfRk9SRSA9IDU7XG5jb25zdCBMQVlFUl9QTEFZRVIgPSA0O1xuY29uc3QgTEFZRVJfRU5FTVkgPSAzO1xuY29uc3QgTEFZRVJfRUZGRUNUX0JBQ0sgPSAyO1xuY29uc3QgTEFZRVJfQkFDS0dST1VORCA9IDE7XG5jb25zdCBMQVlFUl9NQVAgPSAwO1xuXG5sZXQgcGhpbmFfYXBwO1xuXG53aW5kb3cub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gIHBoaW5hX2FwcCA9IEFwcGxpY2F0aW9uKCk7XG4gIHBoaW5hX2FwcC5yZXBsYWNlU2NlbmUoRmlyc3RTY2VuZUZsb3coe30pKTtcbiAgcGhpbmFfYXBwLnJ1bigpO1xufTtcblxuLy/jgrnjgq/jg63jg7zjg6vnpoHmraJcbi8vIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGZ1bmN0aW9uKGUpIHtcbi8vICBlLnByZXZlbnREZWZhdWx0KCk7XG4vLyB9LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xuXG4vL0FuZHJvaWTjg5bjg6njgqbjgrbjg5Djg4Pjgq/jg5zjgr/jg7PliLblvqFcbi8vIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJiYWNrYnV0dG9uXCIsIGZ1bmN0aW9uKGUpe1xuLy8gICBlLnByZXZlbnREZWZhdWx0KCk7XG4vLyB9LCBmYWxzZSk7IiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZShcIkFwcGxpY2F0aW9uXCIsIHtcbiAgICBzdXBlckNsYXNzOiBcInBoaW5hLmRpc3BsYXkuQ2FudmFzQXBwXCIsXG5cbiAgICBxdWFsaXR5OiAxLjAsXG4gIFxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5zdXBlckluaXQoe1xuICAgICAgICBmcHM6IDYwLFxuICAgICAgICB3aWR0aDogU0NSRUVOX1dJRFRILFxuICAgICAgICBoZWlnaHQ6IFNDUkVFTl9IRUlHSFQsXG4gICAgICAgIGZpdDogdHJ1ZSxcbiAgICAgIH0pO1xuICBcbiAgICAgIC8v44K344O844Oz44Gu5bmF44CB6auY44GV44Gu5Z+65pys44KS6Kit5a6aXG4gICAgICBwaGluYS5kaXNwbGF5LkRpc3BsYXlTY2VuZS5kZWZhdWx0cy4kZXh0ZW5kKHtcbiAgICAgICAgd2lkdGg6IFNDUkVFTl9XSURUSCxcbiAgICAgICAgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULFxuICAgICAgfSk7XG4gIFxuICAgICAgcGhpbmEuaW5wdXQuSW5wdXQucXVhbGl0eSA9IHRoaXMucXVhbGl0eTtcbiAgICAgIHBoaW5hLmRpc3BsYXkuRGlzcGxheVNjZW5lLnF1YWxpdHkgPSB0aGlzLnF1YWxpdHk7XG5cbiAgICAgIC8v44Ky44O844Og44OR44OD44OJ566h55CGXG4gICAgICB0aGlzLmdhbWVwYWRNYW5hZ2VyID0gcGhpbmEuaW5wdXQuR2FtZXBhZE1hbmFnZXIoKTtcbiAgICAgIHRoaXMuZ2FtZXBhZCA9IHRoaXMuZ2FtZXBhZE1hbmFnZXIuZ2V0KDApO1xuICAgICAgdGhpcy5jb250cm9sbGVyID0ge307XG5cbiAgICAgIHRoaXMuc2V0dXBFdmVudHMoKTtcbiAgICAgIHRoaXMuc2V0dXBTb3VuZCgpO1xuICAgICAgdGhpcy5zZXR1cE1vdXNlV2hlZWwoKTtcblxuICAgICAgdGhpcy5vbihcImNoYW5nZXNjZW5lXCIsICgpID0+IHtcbiAgICAgICAgLy/jgrfjg7zjg7PjgpLpm6LjgozjgovpmpvjgIHjg5zjgr/jg7PlkIzmmYLmirzjgZfjg5Xjg6njgrDjgpLop6PpmaTjgZnjgotcbiAgICAgICAgQnV0dG9uLmFjdGlvblRhcmdldCA9IG51bGw7XG4gICAgICB9KTtcblxuICAgICAgLy/jg5Hjg4Pjg4nmg4XloLHjgpLmm7TmlrBcbiAgICAgIHRoaXMub24oJ2VudGVyZnJhbWUnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5nYW1lcGFkTWFuYWdlci51cGRhdGUoKTtcbiAgICAgICAgdGhpcy51cGRhdGVDb250cm9sbGVyKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICBcbiAgICAvL+ODnuOCpuOCueOBruODm+ODvOODq+OCpOODmeODs+ODiOmWoumAo1xuICAgIHNldHVwTW91c2VXaGVlbDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLndoZWVsRGVsdGFZID0gMDtcbiAgICAgIHRoaXMuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2V3aGVlbFwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy53aGVlbERlbHRhWSA9IGUuZGVsdGFZO1xuICAgICAgfS5iaW5kKHRoaXMpLCBmYWxzZSk7XG4gIFxuICAgICAgdGhpcy5vbihcImVudGVyZnJhbWVcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMucG9pbnRlci53aGVlbERlbHRhWSA9IHRoaXMud2hlZWxEZWx0YVk7XG4gICAgICAgIHRoaXMud2hlZWxEZWx0YVkgPSAwO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8v44Ki44OX44Oq44Kx44O844K344On44Oz5YWo5L2T44Gu44Kk44OZ44Oz44OI44OV44OD44KvXG4gICAgc2V0dXBFdmVudHM6IGZ1bmN0aW9uKCkge30sXG4gIFxuICAgIHNldHVwU291bmQ6IGZ1bmN0aW9uKCkge30sXG5cbiAgICB1cGRhdGVDb250cm9sbGVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBiZWZvcmUgPSB0aGlzLmNvbnRyb2xsZXI7XG4gICAgICBiZWZvcmUuYmVmb3JlID0gbnVsbDtcblxuICAgICAgdmFyIGdwID0gdGhpcy5nYW1lcGFkO1xuICAgICAgdmFyIGtiID0gdGhpcy5rZXlib2FyZDtcbiAgICAgIHZhciBhbmdsZTEgPSBncC5nZXRLZXlBbmdsZSgpO1xuICAgICAgdmFyIGFuZ2xlMiA9IGtiLmdldEtleUFuZ2xlKCk7XG4gICAgICB0aGlzLmNvbnRyb2xsZXIgPSB7XG4gICAgICAgICAgYW5nbGU6IGFuZ2xlMSAhPT0gbnVsbD8gYW5nbGUxOiBhbmdsZTIsXG5cbiAgICAgICAgICB1cDogZ3AuZ2V0S2V5KFwidXBcIikgfHwga2IuZ2V0S2V5KFwidXBcIiksXG4gICAgICAgICAgZG93bjogZ3AuZ2V0S2V5KFwiZG93blwiKSB8fCBrYi5nZXRLZXkoXCJkb3duXCIpLFxuICAgICAgICAgIGxlZnQ6IGdwLmdldEtleShcImxlZnRcIikgfHwga2IuZ2V0S2V5KFwibGVmdFwiKSxcbiAgICAgICAgICByaWdodDogZ3AuZ2V0S2V5KFwicmlnaHRcIikgfHwga2IuZ2V0S2V5KFwicmlnaHRcIiksXG5cbiAgICAgICAgICBhdHRhY2s6IGdwLmdldEtleShcIkFcIikgfHwga2IuZ2V0S2V5KFwiWFwiKSxcbiAgICAgICAgICBqdW1wOiAgIGdwLmdldEtleShcIlhcIikgfHwga2IuZ2V0S2V5KFwiWlwiKSxcbiAgICAgICAgICBtZW51OiAgIGdwLmdldEtleShcInN0YXJ0XCIpIHx8IGtiLmdldEtleShcImVzY2FwZVwiKSxcblxuICAgICAgICAgIGE6IGdwLmdldEtleShcIkFcIikgfHwga2IuZ2V0S2V5KFwiWlwiKSxcbiAgICAgICAgICBiOiBncC5nZXRLZXkoXCJCXCIpIHx8IGtiLmdldEtleShcIlhcIiksXG4gICAgICAgICAgeDogZ3AuZ2V0S2V5KFwiWFwiKSB8fCBrYi5nZXRLZXkoXCJDXCIpLFxuICAgICAgICAgIHk6IGdwLmdldEtleShcIllcIikgfHwga2IuZ2V0S2V5KFwiVlwiKSxcblxuICAgICAgICAgIG9rOiBncC5nZXRLZXkoXCJBXCIpIHx8IGtiLmdldEtleShcIlpcIikgfHwga2IuZ2V0S2V5KFwic3BhY2VcIikgfHwga2IuZ2V0S2V5KFwicmV0dXJuXCIpLFxuICAgICAgICAgIGNhbmNlbDogZ3AuZ2V0S2V5KFwiQlwiKSB8fCBrYi5nZXRLZXkoXCJYXCIpIHx8IGtiLmdldEtleShcImVzY2FwZVwiKSxcblxuICAgICAgICAgIHN0YXJ0OiBncC5nZXRLZXkoXCJzdGFydFwiKSB8fCBrYi5nZXRLZXkoXCJyZXR1cm5cIiksXG4gICAgICAgICAgc2VsZWN0OiBncC5nZXRLZXkoXCJzZWxlY3RcIiksXG5cbiAgICAgICAgICBwYXVzZTogZ3AuZ2V0S2V5KFwic3RhcnRcIikgfHwga2IuZ2V0S2V5KFwiZXNjYXBlXCIpLFxuXG4gICAgICAgICAgYW5hbG9nMTogZ3AuZ2V0U3RpY2tEaXJlY3Rpb24oMCksXG4gICAgICAgICAgYW5hbG9nMjogZ3AuZ2V0U3RpY2tEaXJlY3Rpb24oMSksXG5cbiAgICAgICAgICAvL+WJjeODleODrOODvOODoOaDheWgsVxuICAgICAgICAgIGJlZm9yZTogYmVmb3JlLFxuICAgICAgfTtcbiAgfSxcbn0pO1xuICBcbn0pOyIsIi8qXG4gKiAgQXNzZXRMaXN0LmpzXG4gKi9cblxucGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZShcIkFzc2V0TGlzdFwiLCB7XG4gICAgX3N0YXRpYzoge1xuICAgICAgbG9hZGVkOiBbXSxcbiAgICAgIGlzTG9hZGVkOiBmdW5jdGlvbihhc3NldFR5cGUpIHtcbiAgICAgICAgcmV0dXJuIEFzc2V0TGlzdC5sb2FkZWRbYXNzZXRUeXBlXT8gdHJ1ZTogZmFsc2U7XG4gICAgICB9LFxuICAgICAgZ2V0OiBmdW5jdGlvbihhc3NldFR5cGUpIHtcbiAgICAgICAgQXNzZXRMaXN0LmxvYWRlZFthc3NldFR5cGVdID0gdHJ1ZTtcbiAgICAgICAgc3dpdGNoIChhc3NldFR5cGUpIHtcbiAgICAgICAgICBjYXNlIFwicHJlbG9hZFwiOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgaW1hZ2U6IHtcbiAgICAgICAgICAgICAgICBcImZpZ2h0ZXJcIjogXCJhc3NldHMvdGV4dHVyZXMvZmlnaHRlci5wbmdcIixcbiAgICAgICAgICAgICAgICBcInBhcnRpY2xlXCI6IFwiYXNzZXRzL3RleHR1cmVzL3BhcnRpY2xlLnBuZ1wiLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyB0bXg6IHtcbiAgICAgICAgICAgICAgLy8gICBcIm1hcDFcIjogXCJhc3NldHMvbWFwL21hcDIudG14XCIsXG4gICAgICAgICAgICAgIC8vIH0sXG4gICAgICAgICAgICAgIC8vIHRzeDoge1xuICAgICAgICAgICAgICAvLyAgIFwidGlsZV9hXCI6IFwiYXNzZXRzL21hcC90aWxlX2EudHN4XCIsXG4gICAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgY2FzZSBcImNvbW1vblwiOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgaW1hZ2U6IHtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgXCJpbnZhbGlkIGFzc2V0VHlwZTogXCIgKyBvcHRpb25zLmFzc2V0VHlwZTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxufSk7XG4iLCIvKlxuICogIE1haW5TY2VuZS5qc1xuICogIDIwMTgvMTAvMjZcbiAqL1xuXG5waGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuZGVmaW5lKFwiQmFzZVNjZW5lXCIsIHtcbiAgICBzdXBlckNsYXNzOiAnRGlzcGxheVNjZW5lJyxcblxuICAgIC8v5buD5qOE44Ko44Os44Oh44Oz44OIXG4gICAgZGlzcG9zZUVsZW1lbnRzOiBudWxsLFxuXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IChvcHRpb25zIHx8IHt9KS4kc2FmZSh7XG4gICAgICAgIHdpZHRoOiBTQ1JFRU5fV0lEVEgsXG4gICAgICAgIGhlaWdodDogU0NSRUVOX0hFSUdIVCxcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiAndHJhbnNwYXJlbnQnLFxuICAgICAgfSk7XG4gICAgICB0aGlzLnN1cGVySW5pdChvcHRpb25zKTtcblxuICAgICAgLy/jgrfjg7zjg7Ppm6LohLHmmYJjYW52YXPjg6Hjg6Ljg6rop6PmlL5cbiAgICAgIHRoaXMuZGlzcG9zZUVsZW1lbnRzID0gW107XG4gICAgICB0aGlzLm9uZSgnZGVzdHJveScsICgpID0+IHtcbiAgICAgICAgdGhpcy5kaXNwb3NlRWxlbWVudHMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgICBpZiAoZS5kZXN0cm95Q2FudmFzKSB7XG4gICAgICAgICAgICBlLmRlc3Ryb3lDYW52YXMoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGUgaW5zdGFuY2VvZiBDYW52YXMpIHtcbiAgICAgICAgICAgIGUuc2V0U2l6ZSgwLCAwKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuYXBwID0gcGhpbmFfYXBwO1xuXG4gICAgICAvL+WIpeOCt+ODvOODs+OBuOOBruenu+ihjOaZguOBq+OCreODo+ODs+ODkOOCueOCkuegtOajhFxuICAgICAgdGhpcy5vbmUoJ2V4aXQnLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmNhbnZhcy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuZmxhcmUoJ2Rlc3Ryb3knKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJFeGl0IHNjZW5lLlwiKTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBkZXN0cm95OiBmdW5jdGlvbigpIHt9LFxuXG4gICAgZmFkZUluOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gKG9wdGlvbnMgfHwge30pLiRzYWZlKHtcbiAgICAgICAgY29sb3I6IFwid2hpdGVcIixcbiAgICAgICAgbWlsbGlzZWNvbmQ6IDUwMCxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBjb25zdCBtYXNrID0gUmVjdGFuZ2xlU2hhcGUoe1xuICAgICAgICAgIHdpZHRoOiBTQ1JFRU5fV0lEVEgsXG4gICAgICAgICAgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULFxuICAgICAgICAgIGZpbGw6IG9wdGlvbnMuY29sb3IsXG4gICAgICAgICAgc3Ryb2tlV2lkdGg6IDAsXG4gICAgICAgIH0pLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSCAqIDAuNSwgU0NSRUVOX0hFSUdIVCAqIDAuNSkuYWRkQ2hpbGRUbyh0aGlzKTtcbiAgICAgICAgbWFzay50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAuZmFkZU91dChvcHRpb25zLm1pbGxpc2Vjb25kKVxuICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLm9uZSgnZW50ZXJmcmFtZScsICgpID0+IG1hc2suZGVzdHJveUNhbnZhcygpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBmYWRlT3V0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gKG9wdGlvbnMgfHwge30pLiRzYWZlKHtcbiAgICAgICAgY29sb3I6IFwid2hpdGVcIixcbiAgICAgICAgbWlsbGlzZWNvbmQ6IDUwMCxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBjb25zdCBtYXNrID0gUmVjdGFuZ2xlU2hhcGUoe1xuICAgICAgICAgIHdpZHRoOiBTQ1JFRU5fV0lEVEgsXG4gICAgICAgICAgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULFxuICAgICAgICAgIGZpbGw6IG9wdGlvbnMuY29sb3IsXG4gICAgICAgICAgc3Ryb2tlV2lkdGg6IDAsXG4gICAgICAgIH0pLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSCAqIDAuNSwgU0NSRUVOX0hFSUdIVCAqIDAuNSkuYWRkQ2hpbGRUbyh0aGlzKTtcbiAgICAgICAgbWFzay5hbHBoYSA9IDA7XG4gICAgICAgIG1hc2sudHdlZW5lci5jbGVhcigpXG4gICAgICAgICAgLmZhZGVJbihvcHRpb25zLm1pbGxpc2Vjb25kKVxuICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLm9uZSgnZW50ZXJmcmFtZScsICgpID0+IG1hc2suZGVzdHJveUNhbnZhcygpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvL+OCt+ODvOODs+mbouiEseaZguOBq+egtOajhOOBmeOCi1NoYXBl44KS55m76YyyXG4gICAgcmVnaXN0RGlzcG9zZTogZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgdGhpcy5kaXNwb3NlRWxlbWVudHMucHVzaChlbGVtZW50KTtcbiAgICB9LFxuICB9KTtcblxufSk7IiwiLypcbiAqICBGaXJzdFNjZW5lRmxvdy5qc1xuICovXG5cbnBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kZWZpbmUoXCJGaXJzdFNjZW5lRmxvd1wiLCB7XG4gICAgc3VwZXJDbGFzczogXCJNYW5hZ2VyU2NlbmVcIixcblxuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgc3RhcnRMYWJlbCA9IG9wdGlvbnMuc3RhcnRMYWJlbCB8fCBcInRpdGxlXCI7XG4gICAgICB0aGlzLnN1cGVySW5pdCh7XG4gICAgICAgIHN0YXJ0TGFiZWw6IHN0YXJ0TGFiZWwsXG4gICAgICAgIHNjZW5lczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBcInRpdGxlXCIsXG4gICAgICAgICAgICBjbGFzc05hbWU6IFwiVGl0bGVTY2VuZVwiLFxuICAgICAgICAgICAgbmV4dExhYmVsOiBcImhvbWVcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBcIm1haW5cIixcbiAgICAgICAgICAgIGNsYXNzTmFtZTogXCJNYWluU2NlbmVcIixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxufSk7IiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZSgnQmFzZVVuaXQnLCB7XG4gICAgc3VwZXJDbGFzczogJ0Rpc3BsYXlFbGVtZW50JyxcblxuICAgIF9zdGF0aWM6IHtcbiAgICAgIGRlZmF1bHRPcHRpb25zOiB7XG4gICAgICAgIHdvcmxkOiBudWxsLFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgc3RhdGU6IG51bGwsXG4gICAgYW5nbGU6IDAsXG4gICAgZGlyZWN0aW9uOiAwLFxuICAgIHNwZWVkOiAwLFxuXG4gICAgc3ByaXRlOiBudWxsLFxuXG4gICAgaHA6IDEwMCxcblxuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIHRoaXMuc3VwZXJJbml0KG9wdGlvbnMpO1xuICAgICAgdGhpcy53b3JsZCA9IG9wdGlvbnMud29ybGQgfHwgbnVsbDtcbiAgICAgIHRoaXMuYmFzZSA9IERpc3BsYXlFbGVtZW50KCkuYWRkQ2hpbGRUbyh0aGlzKTtcbiAgICAgIHRoaXMudmVsb2NpdHkgPSBWZWN0b3IyKDAsIDApO1xuXG4gICAgICB0aGlzLmJlZm9yZSA9IG51bGw7XG4gICAgfSxcbiAgfSk7XG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZSgnTWFpblNjZW5lJywge1xuICAgIHN1cGVyQ2xhc3M6ICdCYXNlU2NlbmUnLFxuXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICAgIHRoaXMuc2V0dXAoKTtcbiAgICB9LFxuXG4gICAgc2V0dXA6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3QgYmFjayA9IFJlY3RhbmdsZVNoYXBlKHsgd2lkdGg6IFNDUkVFTl9XSURUSCwgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULCBmaWxsOiBcImJsYWNrXCIgfSlcbiAgICAgICAgLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSF9IQUxGLCBTQ1JFRU5fSEVJR0hUX0hBTEYpXG4gICAgICAgIC5hZGRDaGlsZFRvKHRoaXMpO1xuICAgICAgdGhpcy5yZWdpc3REaXNwb3NlKGJhY2spO1xuXG4gICAgICB0aGlzLndvcmxkID0gV29ybGQoKS5hZGRDaGlsZFRvKHRoaXMpO1xuICAgIH0sXG5cbiAgICB1cGRhdGU6IGZ1bmN0aW9uKCkge1xuICAgIH0sXG5cbiAgfSk7XG5cbn0pO1xuIiwiLypcbiAqICBUaXRsZVNjZW5lLmpzXG4gKi9cblxucGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZSgnVGl0bGVTY2VuZScsIHtcbiAgICBzdXBlckNsYXNzOiAnQmFzZVNjZW5lJyxcblxuICAgIF9zdGF0aWM6IHtcbiAgICAgIGlzQXNzZXRMb2FkOiBmYWxzZSxcbiAgICB9LFxuXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgdGhpcy5zdXBlckluaXQoKTtcblxuICAgICAgdGhpcy51bmxvY2sgPSBmYWxzZTtcbiAgICAgIHRoaXMubG9hZGNvbXBsZXRlID0gZmFsc2U7XG4gICAgICB0aGlzLnByb2dyZXNzID0gMDtcblxuICAgICAgLy/jg63jg7zjg4nmuIjjgb/jgarjgonjgqLjgrvjg4Pjg4jjg63jg7zjg4njgpLjgZfjgarjgYRcbiAgICAgIGlmIChUaXRsZVNjZW5lLmlzQXNzZXRMb2FkKSB7XG4gICAgICAgIHRoaXMuc2V0dXAoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vcHJlbG9hZCBhc3NldFxuICAgICAgICBjb25zdCBhc3NldHMgPSBBc3NldExpc3QuZ2V0KFwicHJlbG9hZFwiKVxuICAgICAgICB0aGlzLmxvYWRlciA9IHBoaW5hLmFzc2V0LkFzc2V0TG9hZGVyKCk7XG4gICAgICAgIHRoaXMubG9hZGVyLmxvYWQoYXNzZXRzKTtcbiAgICAgICAgdGhpcy5sb2FkZXIub24oJ2xvYWQnLCAoKSA9PiB0aGlzLnNldHVwKCkpO1xuICAgICAgICBUaXRsZVNjZW5lLmlzQXNzZXRMb2FkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgc2V0dXA6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3QgYmFjayA9IFJlY3RhbmdsZVNoYXBlKHsgd2lkdGg6IFNDUkVFTl9XSURUSCwgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULCBmaWxsOiBcImJsYWNrXCIgfSlcbiAgICAgICAgLnNldFBvc2l0aW9uKFNDUkVFTl9XSURUSF9IQUxGLCBTQ1JFRU5fSEVJR0hUX0hBTEYpXG4gICAgICAgIC5hZGRDaGlsZFRvKHRoaXMpO1xuICAgICAgdGhpcy5yZWdpc3REaXNwb3NlKGJhY2spO1xuXG4gICAgICBjb25zdCBsYWJlbCA9IExhYmVsKHsgdGV4dDogXCJUaXRsZVNjZW5lXCIsIGZpbGw6IFwid2hpdGVcIiB9KVxuICAgICAgICAuc2V0UG9zaXRpb24oU0NSRUVOX1dJRFRIX0hBTEYsIFNDUkVFTl9IRUlHSFRfSEFMRilcbiAgICAgICAgLmFkZENoaWxkVG8odGhpcyk7XG4gICAgICB0aGlzLnJlZ2lzdERpc3Bvc2UobGFiZWwpO1xuXG4gICAgICB0aGlzLm9uZSgnbmV4dHNjZW5lJywgKCkgPT4gdGhpcy5leGl0KFwibWFpblwiKSk7XG4gICAgICB0aGlzLmZsYXJlKCduZXh0c2NlbmUnKTtcbiAgICB9LFxuXG4gICAgdXBkYXRlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjdCA9IHBoaW5hX2FwcC5jb250cm9sbGVyO1xuICAgICAgaWYgKGN0LmEpIHtcbiAgICAgICAgdGhpcy5mbGFyZSgnbmV4dHNjZW5lJyk7XG4gICAgICB9XG4gICAgfSxcblxuICB9KTtcblxufSk7XG4iLCJwaGluYS5kZWZpbmUoXCJCdXR0b25cIiwge1xuICBzdXBlckNsYXNzOiBcIkFjY2Vzc29yeVwiLFxuXG4gIGxvZ25wcmVzc1RpbWU6IDUwMCxcbiAgZG9Mb25ncHJlc3M6IGZhbHNlLFxuXG4gIC8v6ZW35oq844GX44Gn6YCj5omT44Oi44O844OJXG4gIGxvbmdwcmVzc0JhcnJhZ2U6IGZhbHNlLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3VwZXJJbml0KCk7XG5cbiAgICB0aGlzLm9uKFwiYXR0YWNoZWRcIiwgKCkgPT4ge1xuICAgICAgdGhpcy50YXJnZXQuaW50ZXJhY3RpdmUgPSB0cnVlO1xuICAgICAgdGhpcy50YXJnZXQuY2xpY2tTb3VuZCA9IEJ1dHRvbi5kZWZhdWx0cy5jbGlja1NvdW5kO1xuXG4gICAgICAvL+ODnOOCv+ODs+aKvOOBl+aZgueUqFxuICAgICAgdGhpcy50YXJnZXQuc2NhbGVUd2VlbmVyID0gVHdlZW5lcigpLmF0dGFjaFRvKHRoaXMudGFyZ2V0KTtcblxuICAgICAgLy/plbfmirzjgZfnlKhcbiAgICAgIHRoaXMudGFyZ2V0LnR3TG9uZ3ByZXNzID0gVHdlZW5lcigpLmF0dGFjaFRvKHRoaXMudGFyZ2V0KTtcblxuICAgICAgLy/plbfmirzjgZfkuK3nibnmrorlr77lv5znlKhcbiAgICAgIHRoaXMudGFyZ2V0LnR3TG9uZ3ByZXNzaW5nID0gVHdlZW5lcigpLmF0dGFjaFRvKHRoaXMudGFyZ2V0KTtcblxuICAgICAgdGhpcy50YXJnZXQub24oXCJwb2ludHN0YXJ0XCIsIChlKSA9PiB7XG5cbiAgICAgICAgLy/jgqTjg5njg7Pjg4josqvpgJrjgavjgZfjgabjgYrjgY9cbiAgICAgICAgZS5wYXNzID0gdHJ1ZTtcblxuICAgICAgICAvL+ODnOOCv+ODs+OBruWQjOaZguaKvOOBl+OCkuWItumZkFxuICAgICAgICBpZiAoQnV0dG9uLmFjdGlvblRhcmdldCAhPT0gbnVsbCkgcmV0dXJuO1xuXG4gICAgICAgIC8v44Oq44K544OI44OT44Ol44O844Gu5a2Q5L6b44Gg44Gj44Gf5aC05ZCI44Gvdmlld3BvcnTjgajjga7jgYLjgZ/jgorliKTlrprjgpLjgZnjgotcbiAgICAgICAgY29uc3QgbGlzdFZpZXcgPSBCdXR0b24uZmluZExpc3RWaWV3KGUudGFyZ2V0KTtcbiAgICAgICAgaWYgKGxpc3RWaWV3ICYmICFsaXN0Vmlldy52aWV3cG9ydC5oaXRUZXN0KGUucG9pbnRlci54LCBlLnBvaW50ZXIueSkpIHJldHVybjtcblxuICAgICAgICBpZiAobGlzdFZpZXcpIHtcbiAgICAgICAgICAvL+ODneOCpOODs+OCv+OBjOenu+WLleOBl+OBn+WgtOWQiOOBr+mVt+aKvOOBl+OCreODo+ODs+OCu+ODq++8iGxpc3RWaWV35YaF54mI77yJXG4gICAgICAgICAgbGlzdFZpZXcuaW5uZXIuJHdhdGNoKCd5JywgKHYxLCB2MikgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMudGFyZ2V0ICE9PSBCdXR0b24uYWN0aW9uVGFyZ2V0KSByZXR1cm47XG4gICAgICAgICAgICBpZiAoTWF0aC5hYnModjEgLSB2MikgPCAxMCkgcmV0dXJuO1xuXG4gICAgICAgICAgICBCdXR0b24uYWN0aW9uVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMudGFyZ2V0LnR3TG9uZ3ByZXNzLmNsZWFyKCk7XG4gICAgICAgICAgICB0aGlzLnRhcmdldC5zY2FsZVR3ZWVuZXIuY2xlYXIoKS50byh7XG4gICAgICAgICAgICAgIHNjYWxlWDogMS4wICogdGhpcy5zeCxcbiAgICAgICAgICAgICAgc2NhbGVZOiAxLjAgKiB0aGlzLnN5XG4gICAgICAgICAgICB9LCA1MCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvL+ODnOOCv+ODs+OBruWHpueQhuOCkuWun+ihjOOBl+OBpuOCguWVj+mhjOOBquOBhOWgtOWQiOOBruOBv+iyq+mAmuOCkuWBnOatouOBmeOCi1xuICAgICAgICBlLnBhc3MgPSBmYWxzZTtcbiAgICAgICAgQnV0dG9uLmFjdGlvblRhcmdldCA9IHRoaXMudGFyZ2V0O1xuXG4gICAgICAgIC8v5Y+N6Lui44GX44Gm44GE44KL44Oc44K/44Oz55So44Gr5L+d5oyB44GZ44KLXG4gICAgICAgIHRoaXMuc3ggPSAodGhpcy50YXJnZXQuc2NhbGVYID4gMCkgPyAxIDogLTE7XG4gICAgICAgIHRoaXMuc3kgPSAodGhpcy50YXJnZXQuc2NhbGVZID4gMCkgPyAxIDogLTE7XG5cbiAgICAgICAgdGhpcy50YXJnZXQuc2NhbGVUd2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAudG8oe1xuICAgICAgICAgICAgc2NhbGVYOiAwLjk1ICogdGhpcy5zeCxcbiAgICAgICAgICAgIHNjYWxlWTogMC45NSAqIHRoaXMuc3lcbiAgICAgICAgICB9LCA1MCk7XG5cbiAgICAgICAgdGhpcy5kb0xvbmdwcmVzcyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnRhcmdldC50d0xvbmdwcmVzcy5jbGVhcigpXG4gICAgICAgICAgLndhaXQodGhpcy5sb2ducHJlc3NUaW1lKVxuICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5sb25ncHJlc3NCYXJyYWdlKSB7XG4gICAgICAgICAgICAgIEJ1dHRvbi5hY3Rpb25UYXJnZXQgPSBudWxsO1xuICAgICAgICAgICAgICB0aGlzLnRhcmdldC5zY2FsZVR3ZWVuZXIuY2xlYXIoKVxuICAgICAgICAgICAgICAgIC50byh7XG4gICAgICAgICAgICAgICAgICBzY2FsZVg6IDEuMCAqIHRoaXMuc3gsXG4gICAgICAgICAgICAgICAgICBzY2FsZVk6IDEuMCAqIHRoaXMuc3lcbiAgICAgICAgICAgICAgICB9LCA1MClcbiAgICAgICAgICAgICAgdGhpcy50YXJnZXQuZmxhcmUoXCJsb25ncHJlc3NcIilcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMudGFyZ2V0LmZsYXJlKFwiY2xpY2tTb3VuZFwiKTtcbiAgICAgICAgICAgICAgdGhpcy50YXJnZXQudHdMb25ncHJlc3NpbmcuY2xlYXIoKVxuICAgICAgICAgICAgICAgIC53YWl0KDUpXG4gICAgICAgICAgICAgICAgLmNhbGwoKCkgPT4gdGhpcy50YXJnZXQuZmxhcmUoXCJjbGlja2VkXCIsIHtcbiAgICAgICAgICAgICAgICAgIGxvbmdwcmVzczogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgIC5jYWxsKCgpID0+IHRoaXMudGFyZ2V0LmZsYXJlKFwibG9uZ3ByZXNzaW5nXCIpKVxuICAgICAgICAgICAgICAgIC5zZXRMb29wKHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGFyZ2V0Lm9uKFwicG9pbnRlbmRcIiwgKGUpID0+IHtcbiAgICAgICAgLy/jgqTjg5njg7Pjg4josqvpgJrjgavjgZfjgabjgYrjgY9cbiAgICAgICAgZS5wYXNzID0gdHJ1ZTtcblxuICAgICAgICAvL1xuICAgICAgICB0aGlzLnRhcmdldC50d0xvbmdwcmVzcy5jbGVhcigpO1xuICAgICAgICB0aGlzLnRhcmdldC50d0xvbmdwcmVzc2luZy5jbGVhcigpO1xuXG4gICAgICAgIC8v44K/44O844Ky44OD44OI44GMbnVsbOOBi3BvaW50c3RhcnTjgafkv53mjIHjgZfjgZ/jgr/jg7zjgrLjg4Pjg4jjgajpgZXjgYbloLTlkIjjga/jgrnjg6vjg7zjgZnjgotcbiAgICAgICAgaWYgKEJ1dHRvbi5hY3Rpb25UYXJnZXQgPT09IG51bGwpIHJldHVybjtcbiAgICAgICAgaWYgKEJ1dHRvbi5hY3Rpb25UYXJnZXQgIT09IHRoaXMudGFyZ2V0KSByZXR1cm47XG5cbiAgICAgICAgLy/jg5zjgr/jg7Pjga7lh6bnkIbjgpLlrp/ooYzjgZfjgabjgoLllY/poYzjgarjgYTloLTlkIjjga7jgb/osqvpgJrjgpLlgZzmraLjgZnjgotcbiAgICAgICAgZS5wYXNzID0gZmFsc2U7XG5cbiAgICAgICAgLy/mirzjgZfjgZ/kvY3nva7jgYvjgonjgYLjgovnqIvluqbnp7vli5XjgZfjgabjgYTjgovloLTlkIjjga/jgq/jg6rjg4Pjgq/jgqTjg5njg7Pjg4jjgpLnmbrnlJ/jgZXjgZvjgarjgYRcbiAgICAgICAgY29uc3QgaXNNb3ZlID0gZS5wb2ludGVyLnN0YXJ0UG9zaXRpb24uc3ViKGUucG9pbnRlci5wb3NpdGlvbikubGVuZ3RoKCkgPiA1MDtcbiAgICAgICAgY29uc3QgaGl0VGVzdCA9IHRoaXMudGFyZ2V0LmhpdFRlc3QoZS5wb2ludGVyLngsIGUucG9pbnRlci55KTtcbiAgICAgICAgaWYgKGhpdFRlc3QgJiYgIWlzTW92ZSkgdGhpcy50YXJnZXQuZmxhcmUoXCJjbGlja1NvdW5kXCIpO1xuXG4gICAgICAgIHRoaXMudGFyZ2V0LnNjYWxlVHdlZW5lci5jbGVhcigpXG4gICAgICAgICAgLnRvKHtcbiAgICAgICAgICAgIHNjYWxlWDogMS4wICogdGhpcy5zeCxcbiAgICAgICAgICAgIHNjYWxlWTogMS4wICogdGhpcy5zeVxuICAgICAgICAgIH0sIDUwKVxuICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIEJ1dHRvbi5hY3Rpb25UYXJnZXQgPSBudWxsO1xuICAgICAgICAgICAgaWYgKCFoaXRUZXN0IHx8IGlzTW92ZSB8fCB0aGlzLmRvTG9uZ3ByZXNzKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnRhcmdldC5mbGFyZShcImNsaWNrZWRcIiwge1xuICAgICAgICAgICAgICBwb2ludGVyOiBlLnBvaW50ZXJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIC8v44Ki44OL44Oh44O844K344On44Oz44Gu5pyA5Lit44Gr5YmK6Zmk44GV44KM44Gf5aC05ZCI44Gr5YKZ44GI44GmcmVtb3ZlZOOCpOODmeODs+ODiOaZguOBq+ODleODqeOCsOOCkuWFg+OBq+aIu+OBl+OBpuOBiuOBj1xuICAgICAgdGhpcy50YXJnZXQub25lKFwicmVtb3ZlZFwiLCAoKSA9PiB7XG4gICAgICAgIGlmIChCdXR0b24uYWN0aW9uVGFyZ2V0ID09PSB0aGlzLnRhcmdldCkge1xuICAgICAgICAgIEJ1dHRvbi5hY3Rpb25UYXJnZXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy50YXJnZXQub24oXCJjbGlja1NvdW5kXCIsICgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLnRhcmdldC5jbGlja1NvdW5kIHx8IHRoaXMudGFyZ2V0LmNsaWNrU291bmQgPT0gXCJcIikgcmV0dXJuO1xuICAgICAgICBwaGluYS5hc3NldC5Tb3VuZE1hbmFnZXIucGxheSh0aGlzLnRhcmdldC5jbGlja1NvdW5kKTtcbiAgICAgIH0pO1xuXG4gICAgfSk7XG4gIH0sXG5cbiAgLy/plbfmirzjgZfjga7lvLfliLbjgq3jg6Pjg7Pjgrvjg6tcbiAgbG9uZ3ByZXNzQ2FuY2VsOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnRhcmdldC50d0xvbmdwcmVzcy5jbGVhcigpO1xuICAgIHRoaXMudGFyZ2V0LnR3TG9uZ3ByZXNzaW5nLmNsZWFyKCk7XG4gIH0sXG5cbiAgX3N0YXRpYzoge1xuICAgIC8v44Oc44K/44Oz5ZCM5pmC5oq844GX44KS5Yi25b6h44GZ44KL44Gf44KB44Grc3RhdHVz44Gvc3RhdGlj44Gr44GZ44KLXG4gICAgc3RhdHVzOiAwLFxuICAgIGFjdGlvblRhcmdldDogbnVsbCxcbiAgICAvL+WfuuacrOioreWumlxuICAgIGRlZmF1bHRzOiB7XG4gICAgICBjbGlja1NvdW5kOiBcImNvbW1vbi9zb3VuZHMvc2UvYnV0dG9uXCIsXG4gICAgfSxcblxuICAgIC8v6Kaq44KS44Gf44Gp44Gj44GmTGlzdFZpZXfjgpLmjqLjgZlcbiAgICBmaW5kTGlzdFZpZXc6IGZ1bmN0aW9uKGVsZW1lbnQsIHApIHtcbiAgICAgIC8v44Oq44K544OI44OT44Ol44O844KS5oyB44Gj44Gm44GE44KL5aC05ZCIXG4gICAgICBpZiAoZWxlbWVudC5MaXN0VmlldyAhPSBudWxsKSByZXR1cm4gZWxlbWVudC5MaXN0VmlldztcbiAgICAgIC8v6Kaq44GM44Gq44GR44KM44Gw57WC5LqGXG4gICAgICBpZiAoZWxlbWVudC5wYXJlbnQgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgICAvL+imquOCkuOBn+OBqeOCi1xuICAgICAgcmV0dXJuIHRoaXMuZmluZExpc3RWaWV3KGVsZW1lbnQucGFyZW50KTtcbiAgICB9XG5cbiAgfVxuXG59KTtcbiIsIi8qKlxyXG4gKiDopqrjgrnjg5fjg6njgqTjg4jjga7jg4bjgq/jgrnjg4Hjg6PjgpLliIfjgormipzjgYTjgaboh6rliIbjga7jg4bjgq/jgrnjg4Hjg6PjgajjgZnjgovjgrnjg5fjg6njgqTjg4hcclxuICog6Kaq44K544OX44Op44Kk44OI44Gu5YiH44KK5oqc44GL44KM44Gf6YOo5YiG44Gv44CB5YiH44KK5oqc44GN56+E5Zuy44Gu5bem5LiK44Gu44OU44Kv44K744Or44Gu6Imy44Gn5aGX44KK44Gk44G244GV44KM44KLXHJcbiAqIFxyXG4gKiDopqropoHntKDjga7mi6HnuK7jg7vlm57ou6Ljga/ogIPmha7jgZfjgarjgYRcclxuICovXHJcbnBoaW5hLmRlZmluZShcIkNsaXBTcHJpdGVcIiwge1xyXG4gIHN1cGVyQ2xhc3M6IFwiQWNjZXNzb3J5XCIsXHJcblxyXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zdXBlckluaXQoKTtcclxuICAgIHRoaXMub24oXCJhdHRhY2hlZFwiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMudGFyZ2V0Lm9uZShcImFkZGVkXCIsICgpID0+IHtcclxuICAgICAgICB0aGlzLnNldHVwKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfSxcclxuXHJcbiAgc2V0dXA6IGZ1bmN0aW9uKCkge1xyXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQ7XHJcbiAgICBjb25zdCBwYXJlbnQgPSB0YXJnZXQucGFyZW50O1xyXG4gICAgaWYgKHBhcmVudCBpbnN0YW5jZW9mIHBoaW5hLmRpc3BsYXkuU3ByaXRlKSB7XHJcbiAgICAgIGNvbnN0IHggPSBwYXJlbnQud2lkdGggKiBwYXJlbnQub3JpZ2luLnggKyB0YXJnZXQueCAtIHRhcmdldC53aWR0aCAqIHRhcmdldC5vcmlnaW4ueDtcclxuICAgICAgY29uc3QgeSA9IHBhcmVudC5oZWlnaHQgKiBwYXJlbnQub3JpZ2luLnkgKyB0YXJnZXQueSAtIHRhcmdldC5oZWlnaHQgKiB0YXJnZXQub3JpZ2luLnk7XHJcbiAgICAgIGNvbnN0IHcgPSB0YXJnZXQud2lkdGg7XHJcbiAgICAgIGNvbnN0IGggPSB0YXJnZXQuaGVpZ2h0O1xyXG5cclxuICAgICAgY29uc3QgcGFyZW50VGV4dHVyZSA9IHBhcmVudC5pbWFnZTtcclxuICAgICAgY29uc3QgY2FudmFzID0gcGhpbmEuZ3JhcGhpY3MuQ2FudmFzKCkuc2V0U2l6ZSh3LCBoKTtcclxuICAgICAgY2FudmFzLmNvbnRleHQuZHJhd0ltYWdlKHBhcmVudFRleHR1cmUuZG9tRWxlbWVudCwgeCwgeSwgdywgaCwgMCwgMCwgdywgaCk7XHJcbiAgICAgIGlmIChwYXJlbnRUZXh0dXJlIGluc3RhbmNlb2YgcGhpbmEuZ3JhcGhpY3MuQ2FudmFzKSB7XHJcbiAgICAgICAgLy8g44Kv44Ot44O844Oz44GX44Gm44Gd44Gj44Gh44KS5L2/44GGXHJcbiAgICAgICAgY29uc3QgcGFyZW50VGV4dHVyZUNsb25lID0gcGhpbmEuZ3JhcGhpY3MuQ2FudmFzKCkuc2V0U2l6ZShwYXJlbnRUZXh0dXJlLndpZHRoLCBwYXJlbnRUZXh0dXJlLmhlaWdodCk7XHJcbiAgICAgICAgcGFyZW50VGV4dHVyZUNsb25lLmNvbnRleHQuZHJhd0ltYWdlKHBhcmVudFRleHR1cmUuZG9tRWxlbWVudCwgMCwgMCk7XHJcbiAgICAgICAgcGFyZW50LmltYWdlID0gcGFyZW50VGV4dHVyZUNsb25lO1xyXG5cclxuICAgICAgICBjb25zdCBkYXRhID0gcGFyZW50VGV4dHVyZUNsb25lLmNvbnRleHQuZ2V0SW1hZ2VEYXRhKHgsIHksIDEsIDEpLmRhdGE7XHJcbiAgICAgICAgcGFyZW50VGV4dHVyZUNsb25lLmNvbnRleHQuY2xlYXJSZWN0KHgsIHksIHcsIGgpO1xyXG4gICAgICAgIGlmIChkYXRhWzNdID4gMCkge1xyXG4gICAgICAgICAgcGFyZW50VGV4dHVyZUNsb25lLmNvbnRleHQuZ2xvYmFsQWxwaGEgPSAxO1xyXG4gICAgICAgICAgcGFyZW50VGV4dHVyZUNsb25lLmNvbnRleHQuZmlsbFN0eWxlID0gYHJnYmEoJHtkYXRhWzBdfSwgJHtkYXRhWzFdfSwgJHtkYXRhWzJdfSwgJHtkYXRhWzNdIC8gMjU1fSlgO1xyXG4gICAgICAgICAgcGFyZW50VGV4dHVyZUNsb25lLmNvbnRleHQuZmlsbFJlY3QoeCAtIDEsIHkgLSAxLCB3ICsgMiwgaCArIDIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3Qgc3ByaXRlID0gcGhpbmEuZGlzcGxheS5TcHJpdGUoY2FudmFzKTtcclxuICAgICAgc3ByaXRlLnNldE9yaWdpbih0YXJnZXQub3JpZ2luLngsIHRhcmdldC5vcmlnaW4ueSk7XHJcbiAgICAgIHRhcmdldC5hZGRDaGlsZEF0KHNwcml0ZSwgMCk7XHJcbiAgICB9XHJcbiAgfSxcclxufSk7XHJcbiIsInBoaW5hLmRlZmluZShcIkdhdWdlXCIsIHtcbiAgc3VwZXJDbGFzczogXCJSZWN0YW5nbGVDbGlwXCIsXG5cbiAgX21pbjogMCxcbiAgX21heDogMS4wLFxuICBfdmFsdWU6IDEuMCwgLy9taW4gfiBtYXhcblxuICBkaXJlY3Rpb246IFwiaG9yaXpvbnRhbFwiLCAvLyBob3Jpem9udGFsIG9yIHZlcnRpY2FsXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB0aGlzLm9uKFwiYXR0YWNoZWRcIiwgKCkgPT4ge1xuICAgICAgdGhpcy5fd2lkdGggPSB0aGlzLndpZHRoO1xuICAgICAgdGhpcy5faGVpZ2h0ID0gdGhpcy53aWR0aDtcblxuICAgICAgdGhpcy50YXJnZXQuYWNjZXNzb3IoXCJHYXVnZS5taW5cIiwge1xuICAgICAgICBcImdldFwiOiAoKSA9PiB0aGlzLm1pbixcbiAgICAgICAgXCJzZXRcIjogKHYpID0+IHRoaXMubWluID0gdixcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRhcmdldC5hY2Nlc3NvcihcIkdhdWdlLm1heFwiLCB7XG4gICAgICAgIFwiZ2V0XCI6ICgpID0+IHRoaXMubWF4LFxuICAgICAgICBcInNldFwiOiAodikgPT4gdGhpcy5tYXggPSB2LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGFyZ2V0LmFjY2Vzc29yKFwiR2F1Z2UudmFsdWVcIiwge1xuICAgICAgICBcImdldFwiOiAoKSA9PiB0aGlzLnZhbHVlLFxuICAgICAgICBcInNldFwiOiAodikgPT4gdGhpcy52YWx1ZSA9IHYsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy50YXJnZXQuYWNjZXNzb3IoXCJHYXVnZS5wcm9ncmVzc1wiLCB7XG4gICAgICAgIFwiZ2V0XCI6ICgpID0+IHRoaXMucHJvZ3Jlc3MsXG4gICAgICAgIFwic2V0XCI6ICh2KSA9PiB0aGlzLnByb2dyZXNzID0gdixcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIF9yZWZyZXNoOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5kaXJlY3Rpb24gIT09IFwidmVydGljYWxcIikge1xuICAgICAgdGhpcy53aWR0aCA9IHRoaXMudGFyZ2V0LndpZHRoICogdGhpcy5wcm9ncmVzcztcbiAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy50YXJnZXQuaGVpZ2h0O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLndpZHRoID0gdGhpcy50YXJnZXQud2lkdGg7XG4gICAgICB0aGlzLmhlaWdodCA9IHRoaXMudGFyZ2V0LmhlaWdodCAqIHRoaXMucHJvZ3Jlc3M7XG4gICAgfVxuICB9LFxuXG4gIF9hY2Nlc3Nvcjoge1xuICAgIHByb2dyZXNzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBwID0gKHRoaXMudmFsdWUgLSB0aGlzLm1pbikgLyAodGhpcy5tYXggLSB0aGlzLm1pbik7XG4gICAgICAgIHJldHVybiAoaXNOYU4ocCkpID8gMC4wIDogcDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IHRoaXMubWF4ICogdjtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgbWF4OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF4O1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB0aGlzLl9tYXggPSB2O1xuICAgICAgICB0aGlzLl9yZWZyZXNoKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIG1pbjoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pbjtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdGhpcy5fbWluID0gdjtcbiAgICAgICAgdGhpcy5fcmVmcmVzaCgpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICB2YWx1ZToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZhbHVlO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB0aGlzLl92YWx1ZSA9IHY7XG4gICAgICAgIHRoaXMuX3JlZnJlc2goKTtcbiAgICAgIH1cbiAgICB9LFxuICB9XG5cbn0pO1xuIiwicGhpbmEuZGVmaW5lKFwiR3JheXNjYWxlXCIsIHtcbiAgc3VwZXJDbGFzczogXCJBY2Nlc3NvcnlcIixcblxuICBncmF5VGV4dHVyZU5hbWU6IG51bGwsXG5cbiAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgdGhpcy5vbihcImF0dGFjaGVkXCIsICgpID0+IHtcbiAgICAgIHRoaXMuZ3JheVRleHR1cmVOYW1lID0gb3B0aW9ucy5ncmF5VGV4dHVyZU5hbWU7XG4gICAgICB0aGlzLm5vcm1hbCA9IHRoaXMudGFyZ2V0LmltYWdlO1xuICAgIH0pO1xuICB9LFxuXG4gIHRvR3JheXNjYWxlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnRhcmdldC5pbWFnZSA9IHRoaXMuZ3JheVRleHR1cmVOYW1lO1xuICB9LFxuXG4gIHRvTm9ybWFsOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnRhcmdldC5pbWFnZSA9IHRoaXMubm9ybWFsO1xuICB9LFxuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcbiAgLy/jg57jgqbjgrnov73lvpNcbiAgcGhpbmEuZGVmaW5lKFwiTW91c2VDaGFzZXJcIiwge1xuICAgIHN1cGVyQ2xhc3M6IFwiQWNjZXNzb3J5XCIsXG5cbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgfSxcblxuICAgIG9uYXR0YWNoZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgbGV0IHB4ID0gMDtcbiAgICAgIGxldCBweSA9IDA7XG4gICAgICBjb25zb2xlLmxvZyhcIiNNb3VzZUNoYXNlclwiLCBcIm9uYXR0YWNoZWRcIik7XG4gICAgICB0aGlzLnR3ZWVuZXIgPSBUd2VlbmVyKCkuYXR0YWNoVG8odGhpcy50YXJnZXQpO1xuICAgICAgdGhpcy50YXJnZXQub24oXCJlbnRlcmZyYW1lXCIsIChlKSA9PiB7XG4gICAgICAgIGNvbnN0IHAgPSBlLmFwcC5wb2ludGVyO1xuICAgICAgICBpZiAocHkgPT0gcC54ICYmIHB5ID09IHAueSkgcmV0dXJuO1xuICAgICAgICBweCA9IHAueDtcbiAgICAgICAgcHkgPSBwLnk7XG4gICAgICAgIGNvbnN0IHggPSBwLnggLSBTQ1JFRU5fV0lEVEhfSEFMRjtcbiAgICAgICAgY29uc3QgeSA9IHAueSAtIFNDUkVFTl9IRUlHSFRfSEFMRjtcbiAgICAgICAgdGhpcy50d2VlbmVyLmNsZWFyKCkudG8oeyB4LCB5IH0sIDIwMDAsIFwiZWFzZU91dFF1YWRcIilcbiAgICAgIH0pO1xuXG4gICAgfSxcblxuICAgIG9uZGV0YWNoZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS5sb2coXCIjTW91c2VDaGFzZXJcIiwgXCJvbmRldGFjaGVkXCIpO1xuICAgICAgdGhpcy50d2VlbmVyLnJlbW92ZSgpO1xuICAgIH1cblxuICB9KTtcbn0pO1xuIiwicGhpbmEuZGVmaW5lKFwiTXVsdGlSZWN0YW5nbGVDbGlwXCIsIHtcbiAgc3VwZXJDbGFzczogXCJBY2Nlc3NvcnlcIixcblxuICB4OiAwLFxuICB5OiAwLFxuICB3aWR0aDogMCxcbiAgaGVpZ2h0OiAwLFxuXG4gIF9lbmFibGU6IHRydWUsXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB0aGlzLl9pbml0KCk7XG4gIH0sXG5cbiAgX2luaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY2xpcFJlY3QgPSBbXTtcblxuICAgIHRoaXMub24oXCJhdHRhY2hlZFwiLCAoKSA9PiB7XG4gICAgICB0aGlzLnggPSAwO1xuICAgICAgdGhpcy55ID0gMDtcbiAgICAgIHRoaXMud2lkdGggPSB0aGlzLnRhcmdldC53aWR0aDtcbiAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy50YXJnZXQuaGVpZ2h0O1xuXG4gICAgICB0aGlzLnRhcmdldC5jbGlwID0gKGMpID0+IHRoaXMuX2NsaXAoYyk7XG4gICAgfSk7XG4gIH0sXG5cbiAgYWRkQ2xpcFJlY3Q6IGZ1bmN0aW9uKHJlY3QpIHtcbiAgICBjb25zdCByID0ge1xuICAgICAgeDogcmVjdC54LFxuICAgICAgeTogcmVjdC55LFxuICAgICAgd2lkdGg6IHJlY3Qud2lkdGgsXG4gICAgICBoZWlnaHQ6IHJlY3QuaGVpZ2h0LFxuICAgIH07XG4gICAgdGhpcy5jbGlwUmVjdC5wdXNoKHIpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIGNsZWFyQ2xpcFJlY3Q6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY2xpcFJlY3QgPSBbXTtcbiAgfSxcblxuICBfY2xpcDogZnVuY3Rpb24oY2FudmFzKSB7XG4gICAgY2FudmFzLmJlZ2luUGF0aCgpO1xuICAgIHRoaXMuY2xpcFJlY3QuZm9yRWFjaChyZWN0ID0+IHtcbiAgICAgIGNhbnZhcy5yZWN0KHJlY3QueCwgcmVjdC55LCByZWN0LndpZHRoLCByZWN0LmhlaWdodClcbiAgICB9KTtcbiAgICBjYW52YXMuY2xvc2VQYXRoKCk7XG4gIH0sXG5cbiAgc2V0RW5hYmxlOiBmdW5jdGlvbihlbmFibGUpIHtcbiAgICB0aGlzLl9lbmFibGUgPSBlbmFibGU7XG4gICAgaWYgKHRoaXMuX2VuYWJsZSkge1xuICAgICAgdGhpcy50YXJnZXQuY2xpcCA9IChjKSA9PiB0aGlzLl9jbGlwKGMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRhcmdldC5jbGlwID0gbnVsbDtcbiAgICB9XG4gIH0sXG5cbiAgX2FjY2Vzc29yOiB7XG4gICAgZW5hYmxlOiB7XG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdGhpcy5zZXRFbmFibGUodik7XG4gICAgICB9LFxuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZShcIlBpZUNsaXBcIiwge1xuICAgIHN1cGVyQ2xhc3M6IFwiQWNjZXNzb3J5XCIsXG5cbiAgICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gKHt9KS4kc2FmZShvcHRpb25zLCBQaWVDbGlwLmRlZmF1bHRzKVxuICAgICAgdGhpcy5zdXBlckluaXQob3B0aW9ucyk7XG5cbiAgICAgIHRoaXMucGl2b3RYID0gb3B0aW9ucy5waXZvdFg7XG4gICAgICB0aGlzLnBpdm90WSA9IG9wdGlvbnMucGl2b3RZO1xuICAgICAgdGhpcy5hbmdsZU1pbiA9IG9wdGlvbnMuYW5nbGVNaW47XG4gICAgICB0aGlzLmFuZ2xlTWF4ID0gb3B0aW9ucy5hbmdsZU1heDtcbiAgICAgIHRoaXMucmFkaXVzID0gb3B0aW9ucy5yYWRpdXM7XG4gICAgICB0aGlzLmFudGljbG9ja3dpc2UgPSBvcHRpb25zLmFudGljbG9ja3dpc2U7XG4gICAgfSxcblxuICAgIG9uYXR0YWNoZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy50YXJnZXQuY2xpcCA9IChjYW52YXMpID0+IHtcbiAgICAgICAgY29uc3QgYW5nbGVNaW4gPSB0aGlzLmFuZ2xlTWluICogTWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICBjb25zdCBhbmdsZU1heCA9IHRoaXMuYW5nbGVNYXggKiBNYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5jb250ZXh0O1xuICAgICAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgICAgIGN0eC5tb3ZlVG8odGhpcy5waXZvdFgsIHRoaXMucGl2b3RZKTtcbiAgICAgICAgY3R4LmxpbmVUbyh0aGlzLnBpdm90WCArIE1hdGguY29zKGFuZ2xlTWluKSAqIHRoaXMucmFkaXVzLCB0aGlzLnBpdm90WSArIE1hdGguc2luKGFuZ2xlTWluKSAqIHRoaXMucmFkaXVzKTtcbiAgICAgICAgY3R4LmFyYyh0aGlzLnBpdm90WCwgdGhpcy5waXZvdFksIHRoaXMucmFkaXVzLCBhbmdsZU1pbiwgYW5nbGVNYXgsIHRoaXMuYW50aWNsb2Nrd2lzZSk7XG4gICAgICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgICAgIH07XG4gICAgfSxcblxuICAgIF9zdGF0aWM6IHtcbiAgICAgIGRlZmF1bHRzOiB7XG4gICAgICAgIHBpdm90WDogMzIsXG4gICAgICAgIHBpdm90WTogMzIsXG4gICAgICAgIGFuZ2xlTWluOiAwLFxuICAgICAgICBhbmdsZU1heDogMzYwLFxuICAgICAgICByYWRpdXM6IDY0LFxuICAgICAgICBhbnRpY2xvY2t3aXNlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcblxuICB9KTtcbn0pO1xuIiwicGhpbmEuZGVmaW5lKFwiUmVjdGFuZ2xlQ2xpcFwiLCB7XG4gIHN1cGVyQ2xhc3M6IFwiQWNjZXNzb3J5XCIsXG5cbiAgeDogMCxcbiAgeTogMCxcbiAgd2lkdGg6IDAsXG4gIGhlaWdodDogMCxcblxuICBfZW5hYmxlOiB0cnVlLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgdGhpcy5faW5pdCgpO1xuICB9LFxuXG4gIF9pbml0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9uKFwiYXR0YWNoZWRcIiwgKCkgPT4ge1xuXG4gICAgICB0aGlzLnRhcmdldC5hY2Nlc3NvcihcIlJlY3RhbmdsZUNsaXAud2lkdGhcIiwge1xuICAgICAgICBcImdldFwiOiAoKSA9PiB0aGlzLndpZHRoLFxuICAgICAgICBcInNldFwiOiAodikgPT4gdGhpcy53aWR0aCA9IHYsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy50YXJnZXQuYWNjZXNzb3IoXCJSZWN0YW5nbGVDbGlwLmhlaWdodFwiLCB7XG4gICAgICAgIFwiZ2V0XCI6ICgpID0+IHRoaXMuaGVpZ2h0LFxuICAgICAgICBcInNldFwiOiAodikgPT4gdGhpcy5oZWlnaHQgPSB2LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGFyZ2V0LmFjY2Vzc29yKFwiUmVjdGFuZ2xlQ2xpcC54XCIsIHtcbiAgICAgICAgXCJnZXRcIjogKCkgPT4gdGhpcy54LFxuICAgICAgICBcInNldFwiOiAodikgPT4gdGhpcy54ID0gdixcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRhcmdldC5hY2Nlc3NvcihcIlJlY3RhbmdsZUNsaXAueVwiLCB7XG4gICAgICAgIFwiZ2V0XCI6ICgpID0+IHRoaXMueSxcbiAgICAgICAgXCJzZXRcIjogKHYpID0+IHRoaXMueSA9IHYsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy54ID0gMDtcbiAgICAgIHRoaXMueSA9IDA7XG4gICAgICB0aGlzLndpZHRoID0gdGhpcy50YXJnZXQud2lkdGg7XG4gICAgICB0aGlzLmhlaWdodCA9IHRoaXMudGFyZ2V0LmhlaWdodDtcblxuICAgICAgdGhpcy50YXJnZXQuY2xpcCA9IChjKSA9PiB0aGlzLl9jbGlwKGMpO1xuICAgIH0pO1xuICB9LFxuXG4gIF9jbGlwOiBmdW5jdGlvbihjYW52YXMpIHtcbiAgICBjb25zdCB4ID0gdGhpcy54IC0gKHRoaXMud2lkdGggKiB0aGlzLnRhcmdldC5vcmlnaW5YKTtcbiAgICBjb25zdCB5ID0gdGhpcy55IC0gKHRoaXMuaGVpZ2h0ICogdGhpcy50YXJnZXQub3JpZ2luWSk7XG5cbiAgICBjYW52YXMuYmVnaW5QYXRoKCk7XG4gICAgY2FudmFzLnJlY3QoeCwgeSwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuICAgIGNhbnZhcy5jbG9zZVBhdGgoKTtcbiAgfSxcblxuICBzZXRFbmFibGU6IGZ1bmN0aW9uKGVuYWJsZSkge1xuICAgIHRoaXMuX2VuYWJsZSA9IGVuYWJsZTtcbiAgICBpZiAodGhpcy5fZW5hYmxlKSB7XG4gICAgICB0aGlzLnRhcmdldC5jbGlwID0gKGMpID0+IHRoaXMuX2NsaXAoYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudGFyZ2V0LmNsaXAgPSBudWxsO1xuICAgIH1cbiAgfSxcblxuICBfYWNjZXNzb3I6IHtcbiAgICBlbmFibGU6IHtcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB0aGlzLnNldEVuYWJsZSh2KTtcbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxufSk7XG4iLCJwaGluYS5kZWZpbmUoXCJUb2dnbGVcIiwge1xuICBzdXBlckNsYXNzOiBcIkFjY2Vzc29yeVwiLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKGlzT24pIHtcbiAgICB0aGlzLnN1cGVySW5pdCgpO1xuICAgIHRoaXMuX2luaXQoaXNPbik7XG4gIH0sXG5cbiAgX2luaXQ6IGZ1bmN0aW9uKGlzT24pIHtcbiAgICB0aGlzLmlzT24gPSBpc09uIHx8IGZhbHNlO1xuICB9LFxuXG4gIHNldFN0YXR1czogZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgdGhpcy5pc09uID0gc3RhdHVzO1xuICAgIHRoaXMudGFyZ2V0LmZsYXJlKCh0aGlzLmlzT24pID8gXCJzd2l0Y2hPblwiIDogXCJzd2l0Y2hPZmZcIik7XG4gIH0sXG5cbiAgc3dpdGNoT246IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmlzT24pIHJldHVybjtcbiAgICB0aGlzLnNldFN0YXR1cyh0cnVlKTtcbiAgfSxcblxuICBzd2l0Y2hPZmY6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5pc09uKSByZXR1cm47XG4gICAgdGhpcy5zZXRTdGF0dXMoZmFsc2UpO1xuICB9LFxuXG4gIHN3aXRjaDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5pc09uID0gIXRoaXMuaXNPbjtcbiAgICB0aGlzLnNldFN0YXR1cyh0aGlzLmlzT24pO1xuICB9LFxuXG4gIF9hY2Nlc3Nvcjoge1xuICAgIHN0YXR1czoge1xuICAgICAgXCJnZXRcIjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzT247XG4gICAgICB9LFxuICAgICAgXCJzZXRcIjogZnVuY3Rpb24odikge1xuICAgICAgICByZXR1cm4gc2V0U3RhdHVzKHYpO1xuICAgICAgfSxcbiAgICB9LFxuICB9LFxuXG59KTtcbiIsInBoaW5hLmRlZmluZShcIkJ1dHRvbml6ZVwiLCB7XG4gIGluaXQ6IGZ1bmN0aW9uKCkge30sXG4gIF9zdGF0aWM6IHtcbiAgICBTVEFUVVM6IHtcbiAgICAgIE5PTkU6IDAsXG4gICAgICBTVEFSVDogMSxcbiAgICAgIEVORDogMixcbiAgICB9LFxuICAgIHN0YXR1czogMCxcbiAgICByZWN0OiBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgICBlbGVtZW50LmJvdW5kaW5nVHlwZSA9IFwicmVjdFwiO1xuICAgICAgdGhpcy5fY29tbW9uKGVsZW1lbnQpO1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfSxcbiAgICBjaXJjbGU6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgIGVsZW1lbnQucmFkaXVzID0gTWF0aC5tYXgoZWxlbWVudC53aWR0aCwgZWxlbWVudC5oZWlnaHQpICogMC41O1xuICAgICAgZWxlbWVudC5ib3VuZGluZ1R5cGUgPSBcImNpcmNsZVwiO1xuICAgICAgdGhpcy5fY29tbW9uKGVsZW1lbnQpO1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfSxcbiAgICBfY29tbW9uOiBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgICAvL1RPRE8644Ko44OH44Kj44K/44O844Gn44GN44KL44G+44Gn44Gu5pqr5a6a5a++5b+cXG4gICAgICBlbGVtZW50LnNldE9yaWdpbigwLjUsIDAuNSwgdHJ1ZSk7XG5cbiAgICAgIGVsZW1lbnQuaW50ZXJhY3RpdmUgPSB0cnVlO1xuICAgICAgZWxlbWVudC5jbGlja1NvdW5kID0gXCJzZS9jbGlja0J1dHRvblwiO1xuXG4gICAgICAvL1RPRE8644Oc44K/44Oz44Gu5ZCM5pmC5oq85LiL44Gv5a6f5qmf44Gn6Kq/5pW044GZ44KLXG4gICAgICBlbGVtZW50Lm9uKFwicG9pbnRzdGFydFwiLCBlID0+IHtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHVzICE9IHRoaXMuU1RBVFVTLk5PTkUpIHJldHVybjtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSB0aGlzLlNUQVRVUy5TVEFSVDtcbiAgICAgICAgZWxlbWVudC50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAudG8oe1xuICAgICAgICAgICAgc2NhbGVYOiAwLjksXG4gICAgICAgICAgICBzY2FsZVk6IDAuOVxuICAgICAgICAgIH0sIDEwMCk7XG4gICAgICB9KTtcblxuICAgICAgZWxlbWVudC5vbihcInBvaW50ZW5kXCIsIChlKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLnN0YXR1cyAhPSB0aGlzLlNUQVRVUy5TVEFSVCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBoaXRUZXN0ID0gZWxlbWVudC5oaXRUZXN0KGUucG9pbnRlci54LCBlLnBvaW50ZXIueSk7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gdGhpcy5TVEFUVVMuRU5EO1xuICAgICAgICBpZiAoaGl0VGVzdCkgZWxlbWVudC5mbGFyZShcImNsaWNrU291bmRcIik7XG5cbiAgICAgICAgZWxlbWVudC50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAudG8oe1xuICAgICAgICAgICAgc2NhbGVYOiAxLjAsXG4gICAgICAgICAgICBzY2FsZVk6IDEuMFxuICAgICAgICAgIH0sIDEwMClcbiAgICAgICAgICAuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnN0YXR1cyA9IHRoaXMuU1RBVFVTLk5PTkU7XG4gICAgICAgICAgICBpZiAoIWhpdFRlc3QpIHJldHVybjtcbiAgICAgICAgICAgIGVsZW1lbnQuZmxhcmUoXCJjbGlja2VkXCIsIHtcbiAgICAgICAgICAgICAgcG9pbnRlcjogZS5wb2ludGVyXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICAvL+OCouODi+ODoeODvOOCt+ODp+ODs+OBruacgOS4reOBq+WJiumZpOOBleOCjOOBn+WgtOWQiOOBq+WCmeOBiOOBpnJlbW92ZWTjgqTjg5njg7Pjg4jmmYLjgavjg5Xjg6njgrDjgpLlhYPjgavmiLvjgZfjgabjgYrjgY9cbiAgICAgIGVsZW1lbnQub25lKFwicmVtb3ZlZFwiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gdGhpcy5TVEFUVVMuTk9ORTtcbiAgICAgIH0pO1xuXG4gICAgICBlbGVtZW50Lm9uKFwiY2xpY2tTb3VuZFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCFlbGVtZW50LmNsaWNrU291bmQpIHJldHVybjtcbiAgICAgICAgLy9waGluYS5hc3NldC5Tb3VuZE1hbmFnZXIucGxheShlbGVtZW50LmNsaWNrU291bmQpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSxcbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIC8qKlxuICAgKiDjg4bjgq/jgrnjg4Hjg6PplqLkv4Ljga7jg6bjg7zjg4bjgqPjg6rjg4bjgqNcbiAgICovXG4gIHBoaW5hLmRlZmluZShcIlRleHR1cmVVdGlsXCIsIHtcblxuICAgIF9zdGF0aWM6IHtcblxuICAgICAgLyoqXG4gICAgICAgKiBSR0LlkITopoHntKDjgavlrp/mlbDjgpLnqY3nrpfjgZnjgotcbiAgICAgICAqL1xuICAgICAgbXVsdGlwbHlDb2xvcjogZnVuY3Rpb24odGV4dHVyZSwgcmVkLCBncmVlbiwgYmx1ZSkge1xuICAgICAgICBpZiAodHlwZW9mKHRleHR1cmUpID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgdGV4dHVyZSA9IEFzc2V0TWFuYWdlci5nZXQoXCJpbWFnZVwiLCB0ZXh0dXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdpZHRoID0gdGV4dHVyZS5kb21FbGVtZW50LndpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSB0ZXh0dXJlLmRvbUVsZW1lbnQuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IENhbnZhcygpLnNldFNpemUod2lkdGgsIGhlaWdodCk7XG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSByZXN1bHQuY29udGV4dDtcblxuICAgICAgICBjb250ZXh0LmRyYXdJbWFnZSh0ZXh0dXJlLmRvbUVsZW1lbnQsIDAsIDApO1xuICAgICAgICBjb25zdCBpbWFnZURhdGEgPSBjb250ZXh0LmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbWFnZURhdGEuZGF0YS5sZW5ndGg7IGkgKz0gNCkge1xuICAgICAgICAgIGltYWdlRGF0YS5kYXRhW2kgKyAwXSA9IE1hdGguZmxvb3IoaW1hZ2VEYXRhLmRhdGFbaSArIDBdICogcmVkKTtcbiAgICAgICAgICBpbWFnZURhdGEuZGF0YVtpICsgMV0gPSBNYXRoLmZsb29yKGltYWdlRGF0YS5kYXRhW2kgKyAxXSAqIGdyZWVuKTtcbiAgICAgICAgICBpbWFnZURhdGEuZGF0YVtpICsgMl0gPSBNYXRoLmZsb29yKGltYWdlRGF0YS5kYXRhW2kgKyAyXSAqIGJsdWUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRleHQucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICog6Imy55u444O75b2p5bqm44O75piO5bqm44KS5pON5L2c44GZ44KLXG4gICAgICAgKi9cbiAgICAgIGVkaXRCeUhzbDogZnVuY3Rpb24odGV4dHVyZSwgaCwgcywgbCkge1xuICAgICAgICBpZiAodHlwZW9mKHRleHR1cmUpID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgdGV4dHVyZSA9IEFzc2V0TWFuYWdlci5nZXQoXCJpbWFnZVwiLCB0ZXh0dXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdpZHRoID0gdGV4dHVyZS5kb21FbGVtZW50LndpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSB0ZXh0dXJlLmRvbUVsZW1lbnQuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IENhbnZhcygpLnNldFNpemUod2lkdGgsIGhlaWdodCk7XG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSByZXN1bHQuY29udGV4dDtcblxuICAgICAgICBjb250ZXh0LmRyYXdJbWFnZSh0ZXh0dXJlLmRvbUVsZW1lbnQsIDAsIDApO1xuICAgICAgICBjb25zdCBpbWFnZURhdGEgPSBjb250ZXh0LmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbWFnZURhdGEuZGF0YS5sZW5ndGg7IGkgKz0gNCkge1xuICAgICAgICAgIGNvbnN0IHIgPSBpbWFnZURhdGEuZGF0YVtpICsgMF07XG4gICAgICAgICAgY29uc3QgZyA9IGltYWdlRGF0YS5kYXRhW2kgKyAxXTtcbiAgICAgICAgICBjb25zdCBiID0gaW1hZ2VEYXRhLmRhdGFbaSArIDJdO1xuXG4gICAgICAgICAgY29uc3QgaHNsID0gcGhpbmEudXRpbC5Db2xvci5SR0J0b0hTTChyLCBnLCBiKTtcbiAgICAgICAgICBjb25zdCBuZXdSZ2IgPSBwaGluYS51dGlsLkNvbG9yLkhTTHRvUkdCKGhzbFswXSArIGgsIE1hdGguY2xhbXAoaHNsWzFdICsgcywgMCwgMTAwKSwgTWF0aC5jbGFtcChoc2xbMl0gKyBsLCAwLCAxMDApKTtcblxuICAgICAgICAgIGltYWdlRGF0YS5kYXRhW2kgKyAwXSA9IG5ld1JnYlswXTtcbiAgICAgICAgICBpbWFnZURhdGEuZGF0YVtpICsgMV0gPSBuZXdSZ2JbMV07XG4gICAgICAgICAgaW1hZ2VEYXRhLmRhdGFbaSArIDJdID0gbmV3UmdiWzJdO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRleHQucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0sXG5cbiAgICB9LFxuXG4gICAgaW5pdDogZnVuY3Rpb24oKSB7fSxcbiAgfSk7XG5cbn0pO1xuIiwiLypcbiAqICBwaGluYS50aWxlZG1hcC5qc1xuICogIDIwMTYvOS8xMFxuICogIEBhdXRoZXIgbWluaW1vICBcbiAqICBUaGlzIFByb2dyYW0gaXMgTUlUIGxpY2Vuc2UuXG4gKiBcbiAqICAyMDE5LzkvMThcbiAqICB2ZXJzaW9uIDIuMFxuICovXG5cbnBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kZWZpbmUoXCJwaGluYS5hc3NldC5UaWxlZE1hcFwiLCB7XG4gICAgc3VwZXJDbGFzczogXCJwaGluYS5hc3NldC5YTUxMb2FkZXJcIixcblxuICAgIGltYWdlOiBudWxsLFxuXG4gICAgdGlsZXNldHM6IG51bGwsXG4gICAgbGF5ZXJzOiBudWxsLFxuXG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgfSxcblxuICAgIF9sb2FkOiBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgICAvL+ODkeOCueaKnOOBjeWHuuOBl1xuICAgICAgdGhpcy5wYXRoID0gXCJcIjtcbiAgICAgIGNvbnN0IGxhc3QgPSB0aGlzLnNyYy5sYXN0SW5kZXhPZihcIi9cIik7XG4gICAgICBpZiAobGFzdCA+IDApIHtcbiAgICAgICAgdGhpcy5wYXRoID0gdGhpcy5zcmMuc3Vic3RyaW5nKDAsIGxhc3QgKyAxKTtcbiAgICAgIH1cblxuICAgICAgLy/ntYLkuobplqLmlbDkv53lrZhcbiAgICAgIHRoaXMuX3Jlc29sdmUgPSByZXNvbHZlO1xuXG4gICAgICAvLyBsb2FkXG4gICAgICBjb25zdCB4bWwgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgIHhtbC5vcGVuKCdHRVQnLCB0aGlzLnNyYyk7XG4gICAgICB4bWwub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICBpZiAoeG1sLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICBpZiAoWzIwMCwgMjAxLCAwXS5pbmRleE9mKHhtbC5zdGF0dXMpICE9PSAtMSkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IChuZXcgRE9NUGFyc2VyKCkpLnBhcnNlRnJvbVN0cmluZyh4bWwucmVzcG9uc2VUZXh0LCBcInRleHQveG1sXCIpO1xuICAgICAgICAgICAgdGhpcy5kYXRhVHlwZSA9IFwieG1sXCI7XG4gICAgICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgdGhpcy5fcGFyc2UoZGF0YSlcbiAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fcmVzb2x2ZSh0aGlzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgeG1sLnNlbmQobnVsbCk7XG4gICAgfSxcblxuICAgIC8v44Oe44OD44OX44Kk44Oh44O844K45Y+W5b6XXG4gICAgZ2V0SW1hZ2U6IGZ1bmN0aW9uKGxheWVyTmFtZSkge1xuICAgICAgaWYgKGxheWVyTmFtZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmltYWdlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dlbmVyYXRlSW1hZ2UobGF5ZXJOYW1lKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy/mjIflrprjg57jg4Pjg5fjg6zjgqTjg6Tjg7zjgpLphY3liJfjgajjgZfjgablj5blvpdcbiAgICBnZXRNYXBEYXRhOiBmdW5jdGlvbihsYXllck5hbWUpIHtcbiAgICAgIC8v44Os44Kk44Ok44O85qSc57SiXG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRoaXMubGF5ZXJzW2ldLm5hbWUgPT0gbGF5ZXJOYW1lKSB7XG4gICAgICAgICAgLy/jgrPjg5Tjg7zjgpLov5TjgZlcbiAgICAgICAgICByZXR1cm4gdGhpcy5sYXllcnNbaV0uZGF0YS5jb25jYXQoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuICAgIC8v44Kq44OW44K444Kn44Kv44OI44Kw44Or44O844OX44KS5Y+W5b6X77yI5oyH5a6a44GM54Sh44GE5aC05ZCI44CB5YWo44Os44Kk44Ok44O844KS6YWN5YiX44Gr44GX44Gm6L+U44GZ77yJXG4gICAgZ2V0T2JqZWN0R3JvdXA6IGZ1bmN0aW9uKGdyb3VwTmFtZSkge1xuICAgICAgZ3JvdXBOYW1lID0gZ3JvdXBOYW1lIHx8IG51bGw7XG4gICAgICBjb25zdCBscyA9IFtdO1xuICAgICAgY29uc3QgbGVuID0gdGhpcy5sYXllcnMubGVuZ3RoO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBpZiAodGhpcy5sYXllcnNbaV0udHlwZSA9PSBcIm9iamVjdGdyb3VwXCIpIHtcbiAgICAgICAgICBpZiAoZ3JvdXBOYW1lID09IG51bGwgfHwgZ3JvdXBOYW1lID09IHRoaXMubGF5ZXJzW2ldLm5hbWUpIHtcbiAgICAgICAgICAgIC8v44Os44Kk44Ok44O85oOF5aCx44KS44Kv44Ot44O844Oz44GZ44KLXG4gICAgICAgICAgICBjb25zdCBvYmogPSB0aGlzLl9jbG9uZU9iamVjdExheWVyKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChncm91cE5hbWUgIT09IG51bGwpIHJldHVybiBvYmo7XG4gICAgICAgICAgICBscy5wdXNoKG9iaik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbHM7XG4gICAgfSxcblxuICAgIC8v44Kq44OW44K444Kn44Kv44OI44Os44Kk44Ok44O844KS44Kv44Ot44O844Oz44GX44Gm6L+U44GZXG4gICAgX2Nsb25lT2JqZWN0TGF5ZXI6IGZ1bmN0aW9uKHNyY0xheWVyKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB7fS4kc2FmZShzcmNMYXllcik7XG4gICAgICByZXN1bHQub2JqZWN0cyA9IFtdO1xuICAgICAgLy/jg6zjgqTjg6Tjg7zlhoXjgqrjg5bjgrjjgqfjgq/jg4jjga7jgrPjg5Tjg7xcbiAgICAgIHNyY0xheWVyLm9iamVjdHMuZm9yRWFjaChvYmogPT4ge1xuICAgICAgICBjb25zdCByZXNPYmogPSB7XG4gICAgICAgICAgcHJvcGVydGllczoge30uJHNhZmUob2JqLnByb3BlcnRpZXMpLFxuICAgICAgICB9LiRleHRlbmQob2JqKTtcbiAgICAgICAgaWYgKG9iai5lbGxpcHNlKSByZXNPYmouZWxsaXBzZSA9IG9iai5lbGxpcHNlO1xuICAgICAgICBpZiAob2JqLmdpZCkgcmVzT2JqLmdpZCA9IG9iai5naWQ7XG4gICAgICAgIGlmIChvYmoucG9seWdvbikgcmVzT2JqLnBvbHlnb24gPSBvYmoucG9seWdvbi5jbG9uZSgpO1xuICAgICAgICBpZiAob2JqLnBvbHlsaW5lKSByZXNPYmoucG9seWxpbmUgPSBvYmoucG9seWxpbmUuY2xvbmUoKTtcbiAgICAgICAgcmVzdWx0Lm9iamVjdHMucHVzaChyZXNPYmopO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICBfcGFyc2U6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgLy/jgr/jgqTjg6vlsZ7mgKfmg4XloLHlj5blvpdcbiAgICAgICAgY29uc3QgbWFwID0gZGF0YS5nZXRFbGVtZW50c0J5VGFnTmFtZSgnbWFwJylbMF07XG4gICAgICAgIGNvbnN0IGF0dHIgPSB0aGlzLl9hdHRyVG9KU09OKG1hcCk7XG4gICAgICAgIHRoaXMuJGV4dGVuZChhdHRyKTtcbiAgICAgICAgdGhpcy5wcm9wZXJ0aWVzID0gdGhpcy5fcHJvcGVydGllc1RvSlNPTihtYXApO1xuXG4gICAgICAgIC8v44K/44Kk44Or44K744OD44OI5Y+W5b6XXG4gICAgICAgIHRoaXMudGlsZXNldHMgPSB0aGlzLl9wYXJzZVRpbGVzZXRzKGRhdGEpO1xuICAgICAgICB0aGlzLnRpbGVzZXRzLnNvcnQoKGEsIGIpID0+IGEuZmlyc3RnaWQgLSBiLmZpcnN0Z2lkKTtcblxuICAgICAgICAvL+ODrOOCpOODpOODvOWPluW+l1xuICAgICAgICB0aGlzLmxheWVycyA9IHRoaXMuX3BhcnNlTGF5ZXJzKGRhdGEpO1xuXG4gICAgICAgIC8v44Kk44Oh44O844K444OH44O844K/6Kqt44G/6L6844G/XG4gICAgICAgIHRoaXMuX2NoZWNrSW1hZ2UoKVxuICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIC8v44Oe44OD44OX44Kk44Oh44O844K455Sf5oiQXG4gICAgICAgICAgICB0aGlzLmltYWdlID0gdGhpcy5fZ2VuZXJhdGVJbWFnZSgpO1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSlcbiAgICB9LFxuXG4gICAgLy/jgr/jgqTjg6vjgrvjg4Pjg4jjga7jg5Hjg7zjgrlcbiAgICBfcGFyc2VUaWxlc2V0czogZnVuY3Rpb24oeG1sKSB7XG4gICAgICBjb25zdCBlYWNoID0gQXJyYXkucHJvdG90eXBlLmZvckVhY2g7XG4gICAgICBjb25zdCBkYXRhID0gW107XG4gICAgICBjb25zdCB0aWxlc2V0cyA9IHhtbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgndGlsZXNldCcpO1xuICAgICAgZWFjaC5jYWxsKHRpbGVzZXRzLCBhc3luYyB0aWxlc2V0ID0+IHtcbiAgICAgICAgY29uc3QgdCA9IHt9O1xuICAgICAgICBjb25zdCBhdHRyID0gdGhpcy5fYXR0clRvSlNPTih0aWxlc2V0KTtcbiAgICAgICAgaWYgKGF0dHIuc291cmNlKSB7XG4gICAgICAgICAgdC5pc09sZEZvcm1hdCA9IGZhbHNlO1xuICAgICAgICAgIHQuc291cmNlID0gdGhpcy5wYXRoICsgYXR0ci5zb3VyY2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy/ml6fjg4fjg7zjgr/lvaLlvI/vvIjmnKrlr77lv5zvvIlcbiAgICAgICAgICB0LmlzT2xkRm9ybWF0ID0gdHJ1ZTtcbiAgICAgICAgICB0LmRhdGEgPSB0aWxlc2V0O1xuICAgICAgICB9XG4gICAgICAgIHQuZmlyc3RnaWQgPSBhdHRyLmZpcnN0Z2lkO1xuICAgICAgICBkYXRhLnB1c2godCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG5cbiAgICAvL+ODrOOCpOODpOODvOaDheWgseOBruODkeODvOOCuVxuICAgIF9wYXJzZUxheWVyczogZnVuY3Rpb24oeG1sKSB7XG4gICAgICBjb25zdCBlYWNoID0gQXJyYXkucHJvdG90eXBlLmZvckVhY2g7XG4gICAgICBjb25zdCBkYXRhID0gW107XG5cbiAgICAgIGNvbnN0IG1hcCA9IHhtbC5nZXRFbGVtZW50c0J5VGFnTmFtZShcIm1hcFwiKVswXTtcbiAgICAgIGNvbnN0IGxheWVycyA9IFtdO1xuICAgICAgZWFjaC5jYWxsKG1hcC5jaGlsZE5vZGVzLCBlbG0gPT4ge1xuICAgICAgICBpZiAoZWxtLnRhZ05hbWUgPT0gXCJsYXllclwiIHx8IGVsbS50YWdOYW1lID09IFwib2JqZWN0Z3JvdXBcIiB8fCBlbG0udGFnTmFtZSA9PSBcImltYWdlbGF5ZXJcIikge1xuICAgICAgICAgIGxheWVycy5wdXNoKGVsbSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBsYXllcnMuZWFjaChsYXllciA9PiB7XG4gICAgICAgIHN3aXRjaCAobGF5ZXIudGFnTmFtZSkge1xuICAgICAgICAgIGNhc2UgXCJsYXllclwiOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAvL+mAmuW4uOODrOOCpOODpOODvFxuICAgICAgICAgICAgICBjb25zdCBkID0gbGF5ZXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2RhdGEnKVswXTtcbiAgICAgICAgICAgICAgY29uc3QgZW5jb2RpbmcgPSBkLmdldEF0dHJpYnV0ZShcImVuY29kaW5nXCIpO1xuICAgICAgICAgICAgICBjb25zdCBsID0ge1xuICAgICAgICAgICAgICAgICAgdHlwZTogXCJsYXllclwiLFxuICAgICAgICAgICAgICAgICAgbmFtZTogbGF5ZXIuZ2V0QXR0cmlidXRlKFwibmFtZVwiKSxcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICBpZiAoZW5jb2RpbmcgPT0gXCJjc3ZcIikge1xuICAgICAgICAgICAgICAgICAgbC5kYXRhID0gdGhpcy5fcGFyc2VDU1YoZC50ZXh0Q29udGVudCk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZW5jb2RpbmcgPT0gXCJiYXNlNjRcIikge1xuICAgICAgICAgICAgICAgICAgbC5kYXRhID0gdGhpcy5fcGFyc2VCYXNlNjQoZC50ZXh0Q29udGVudCk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBhdHRyID0gdGhpcy5fYXR0clRvSlNPTihsYXllcik7XG4gICAgICAgICAgICAgIGwuJGV4dGVuZChhdHRyKTtcbiAgICAgICAgICAgICAgbC5wcm9wZXJ0aWVzID0gdGhpcy5fcHJvcGVydGllc1RvSlNPTihsYXllcik7XG5cbiAgICAgICAgICAgICAgZGF0YS5wdXNoKGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvL+OCquODluOCuOOCp+OCr+ODiOODrOOCpOODpOODvFxuICAgICAgICAgIGNhc2UgXCJvYmplY3Rncm91cFwiOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjb25zdCBsID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0Z3JvdXBcIixcbiAgICAgICAgICAgICAgICBvYmplY3RzOiBbXSxcbiAgICAgICAgICAgICAgICBuYW1lOiBsYXllci5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpLFxuICAgICAgICAgICAgICAgIHg6IHBhcnNlRmxvYXQobGF5ZXIuZ2V0QXR0cmlidXRlKFwib2Zmc2V0eFwiKSkgfHwgMCxcbiAgICAgICAgICAgICAgICB5OiBwYXJzZUZsb2F0KGxheWVyLmdldEF0dHJpYnV0ZShcIm9mZnNldHlcIikpIHx8IDAsXG4gICAgICAgICAgICAgICAgYWxwaGE6IGxheWVyLmdldEF0dHJpYnV0ZShcIm9wYWNpdHlcIikgfHwgMSxcbiAgICAgICAgICAgICAgICBjb2xvcjogbGF5ZXIuZ2V0QXR0cmlidXRlKFwiY29sb3JcIikgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBkcmF3b3JkZXI6IGxheWVyLmdldEF0dHJpYnV0ZShcImRyYXdvcmRlclwiKSB8fCBudWxsLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBlYWNoLmNhbGwobGF5ZXIuY2hpbGROb2RlcywgZWxtID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZWxtLm5vZGVUeXBlID09IDMpIHJldHVybjtcbiAgICAgICAgICAgICAgICBjb25zdCBkID0gdGhpcy5fYXR0clRvSlNPTihlbG0pO1xuICAgICAgICAgICAgICAgIGQucHJvcGVydGllcyA9IHRoaXMuX3Byb3BlcnRpZXNUb0pTT04oZWxtKTtcbiAgICAgICAgICAgICAgICAvL+WtkOimgee0oOOBruino+aekFxuICAgICAgICAgICAgICAgIGlmIChlbG0uY2hpbGROb2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIGVsbS5jaGlsZE5vZGVzLmZvckVhY2goZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlLm5vZGVUeXBlID09IDMpIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgLy/mpZXlhoZcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUubm9kZU5hbWUgPT0gJ2VsbGlwc2UnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgZC5lbGxpcHNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvL+WkmuinkuW9olxuICAgICAgICAgICAgICAgICAgICBpZiAoZS5ub2RlTmFtZSA9PSAncG9seWdvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICBkLnBvbHlnb24gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhdHRyID0gdGhpcy5fYXR0clRvSlNPTl9zdHIoZSk7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGwgPSBhdHRyLnBvaW50cy5zcGxpdChcIiBcIik7XG4gICAgICAgICAgICAgICAgICAgICAgcGwuZm9yRWFjaChmdW5jdGlvbihzdHIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHB0cyA9IHN0ci5zcGxpdChcIixcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkLnBvbHlnb24ucHVzaCh7eDogcGFyc2VGbG9hdChwdHNbMF0pLCB5OiBwYXJzZUZsb2F0KHB0c1sxXSl9KTtcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvL+e3muWIhlxuICAgICAgICAgICAgICAgICAgICBpZiAoZS5ub2RlTmFtZSA9PSAncG9seWxpbmUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgZC5wb2x5bGluZSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGF0dHIgPSB0aGlzLl9hdHRyVG9KU09OX3N0cihlKTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwbCA9IGF0dHIucG9pbnRzLnNwbGl0KFwiIFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICBwbC5mb3JFYWNoKHN0ciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwdHMgPSBzdHIuc3BsaXQoXCIsXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZC5wb2x5bGluZS5wdXNoKHt4OiBwYXJzZUZsb2F0KHB0c1swXSksIHk6IHBhcnNlRmxvYXQocHRzWzFdKX0pO1xuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbC5vYmplY3RzLnB1c2goZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBsLnByb3BlcnRpZXMgPSB0aGlzLl9wcm9wZXJ0aWVzVG9KU09OKGxheWVyKTtcblxuICAgICAgICAgICAgICBkYXRhLnB1c2gobCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8v44Kk44Oh44O844K444Os44Kk44Ok44O8XG4gICAgICAgICAgY2FzZSBcImltYWdlbGF5ZXJcIjpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY29uc3QgbCA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcImltYWdlbGF5ZXJcIixcbiAgICAgICAgICAgICAgICBuYW1lOiBsYXllci5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpLFxuICAgICAgICAgICAgICAgIHg6IHBhcnNlRmxvYXQobGF5ZXIuZ2V0QXR0cmlidXRlKFwib2Zmc2V0eFwiKSkgfHwgMCxcbiAgICAgICAgICAgICAgICB5OiBwYXJzZUZsb2F0KGxheWVyLmdldEF0dHJpYnV0ZShcIm9mZnNldHlcIikpIHx8IDAsXG4gICAgICAgICAgICAgICAgYWxwaGE6IGxheWVyLmdldEF0dHJpYnV0ZShcIm9wYWNpdHlcIikgfHwgMSxcbiAgICAgICAgICAgICAgICB2aXNpYmxlOiAobGF5ZXIuZ2V0QXR0cmlidXRlKFwidmlzaWJsZVwiKSA9PT0gdW5kZWZpbmVkIHx8IGxheWVyLmdldEF0dHJpYnV0ZShcInZpc2libGVcIikgIT0gMCksXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIGNvbnN0IGltYWdlRWxtID0gbGF5ZXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbWFnZVwiKVswXTtcbiAgICAgICAgICAgICAgbC5pbWFnZSA9IHtzb3VyY2U6IGltYWdlRWxtLmdldEF0dHJpYnV0ZShcInNvdXJjZVwiKX07XG5cbiAgICAgICAgICAgICAgZGF0YS5wdXNoKGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy/jgrDjg6vjg7zjg5dcbiAgICAgICAgICBjYXNlIFwiZ3JvdXBcIjpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG5cbiAgICAvL+OCouOCu+ODg+ODiOOBq+eEoeOBhOOCpOODoeODvOOCuOODh+ODvOOCv+OCkuiqreOBv+i+vOOBv1xuICAgIF9jaGVja0ltYWdlOiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IGltYWdlU291cmNlID0gW107XG4gICAgICBjb25zdCBsb2FkSW1hZ2UgPSBbXTtcblxuICAgICAgLy/kuIDopqfkvZzmiJBcbiAgICAgIHRoaXMudGlsZXNldHMuZm9yRWFjaCh0aWxlc2V0ID0+IHtcbiAgICAgICAgY29uc3Qgb2JqID0ge1xuICAgICAgICAgIGlzVGlsZXNldDogdHJ1ZSxcbiAgICAgICAgICBpbWFnZTogdGlsZXNldC5zb3VyY2UsXG4gICAgICAgIH07XG4gICAgICAgIGltYWdlU291cmNlLnB1c2gob2JqKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5sYXllcnMuZm9yRWFjaChsYXllciA9PiB7XG4gICAgICAgIGlmIChsYXllci5pbWFnZSkge1xuICAgICAgICAgIGNvbnN0IG9iaiA9IHtcbiAgICAgICAgICAgIGlzVGlsZXNldDogZmFsc2UsXG4gICAgICAgICAgICBpbWFnZTogbGF5ZXIuaW1hZ2Uuc291cmNlLFxuICAgICAgICAgIH07XG4gICAgICAgICAgaW1hZ2VTb3VyY2UucHVzaChvYmopO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy/jgqLjgrvjg4Pjg4jjgavjgYLjgovjgYvnorroqo1cbiAgICAgIGltYWdlU291cmNlLmZvckVhY2goZSA9PiB7XG4gICAgICAgIGlmIChlLmlzVGlsZXNldCkge1xuICAgICAgICAgIGNvbnN0IHRzeCA9IHBoaW5hLmFzc2V0LkFzc2V0TWFuYWdlci5nZXQoJ3RzeCcsIGUuaW1hZ2UpO1xuICAgICAgICAgIGlmICghdHN4KSB7XG4gICAgICAgICAgICAvL+OCouOCu+ODg+ODiOOBq+OBquOBi+OBo+OBn+OBruOBp+ODreODvOODieODquOCueODiOOBq+i/veWKoFxuICAgICAgICAgICAgbG9hZEltYWdlLnB1c2goZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGltYWdlID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCgnaW1hZ2UnLCBlLmltYWdlKTtcbiAgICAgICAgICBpZiAoIWltYWdlKSB7XG4gICAgICAgICAgICAvL+OCouOCu+ODg+ODiOOBq+OBquOBi+OBo+OBn+OBruOBp+ODreODvOODieODquOCueODiOOBq+i/veWKoFxuICAgICAgICAgICAgbG9hZEltYWdlLnB1c2goZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy/kuIDmi6zjg63jg7zjg4lcbiAgICAgIC8v44Ot44O844OJ44Oq44K544OI5L2c5oiQXG4gICAgICBpZiAobG9hZEltYWdlLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB7IGltYWdlOiBbXSwgdHN4OiBbXSB9O1xuICAgICAgICBsb2FkSW1hZ2UuZm9yRWFjaChlID0+IHtcbiAgICAgICAgICBpZiAoZS5pc1RpbGVzZXQpIHtcbiAgICAgICAgICAgIGFzc2V0cy50c3hbZS5pbWFnZV0gPSBlLmltYWdlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL+OCouOCu+ODg+ODiOOBruODkeOCueOCkuODnuODg+ODl+OBqOWQjOOBmOOBq+OBmeOCi1xuICAgICAgICAgICAgYXNzZXRzLmltYWdlW2UuaW1hZ2VdID0gdGhpcy5wYXRoICsgZS5pbWFnZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgY29uc3QgbG9hZGVyID0gcGhpbmEuYXNzZXQuQXNzZXRMb2FkZXIoKTtcbiAgICAgICAgICBsb2FkZXIubG9hZChhc3NldHMpO1xuICAgICAgICAgIGxvYWRlci5vbignbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudGlsZXNldHMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgICAgICAgZS50c3ggPSBwaGluYS5hc3NldC5Bc3NldE1hbmFnZXIuZ2V0KCd0c3gnLCBlLnNvdXJjZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8v44Oe44OD44OX44Kk44Oh44O844K45L2c5oiQXG4gICAgX2dlbmVyYXRlSW1hZ2U6IGZ1bmN0aW9uKGxheWVyTmFtZSkge1xuICAgICAgbGV0IG51bUxheWVyID0gMDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRoaXMubGF5ZXJzW2ldLnR5cGUgPT0gXCJsYXllclwiIHx8IHRoaXMubGF5ZXJzW2ldLnR5cGUgPT0gXCJpbWFnZWxheWVyXCIpIG51bUxheWVyKys7XG4gICAgICB9XG4gICAgICBpZiAobnVtTGF5ZXIgPT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgICAgIGNvbnN0IHdpZHRoID0gdGhpcy53aWR0aCAqIHRoaXMudGlsZXdpZHRoO1xuICAgICAgY29uc3QgaGVpZ2h0ID0gdGhpcy5oZWlnaHQgKiB0aGlzLnRpbGVoZWlnaHQ7XG4gICAgICBjb25zdCBjYW52YXMgPSBwaGluYS5ncmFwaGljcy5DYW52YXMoKS5zZXRTaXplKHdpZHRoLCBoZWlnaHQpO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIC8v44Oe44OD44OX44Os44Kk44Ok44O8XG4gICAgICAgIGlmICh0aGlzLmxheWVyc1tpXS50eXBlID09IFwibGF5ZXJcIiAmJiB0aGlzLmxheWVyc1tpXS52aXNpYmxlICE9IFwiMFwiKSB7XG4gICAgICAgICAgaWYgKGxheWVyTmFtZSA9PT0gdW5kZWZpbmVkIHx8IGxheWVyTmFtZSA9PT0gdGhpcy5sYXllcnNbaV0ubmFtZSkge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1hcGRhdGEgPSBsYXllci5kYXRhO1xuICAgICAgICAgICAgY29uc3Qgd2lkdGggPSBsYXllci53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IGxheWVyLmhlaWdodDtcbiAgICAgICAgICAgIGNvbnN0IG9wYWNpdHkgPSBsYXllci5vcGFjaXR5IHx8IDEuMDtcbiAgICAgICAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7XG4gICAgICAgICAgICAgIGZvciAobGV0IHggPSAwOyB4IDwgd2lkdGg7IHgrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gbWFwZGF0YVtjb3VudF07XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAvL+ODnuODg+ODl+ODgeODg+ODl+OCkumFjee9rlxuICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0TWFwQ2hpcChjYW52YXMsIGluZGV4LCB4ICogdGhpcy50aWxld2lkdGgsIHkgKiB0aGlzLnRpbGVoZWlnaHQsIG9wYWNpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8v44Kq44OW44K444Kn44Kv44OI44Kw44Or44O844OXXG4gICAgICAgIGlmICh0aGlzLmxheWVyc1tpXS50eXBlID09IFwib2JqZWN0Z3JvdXBcIiAmJiB0aGlzLmxheWVyc1tpXS52aXNpYmxlICE9IFwiMFwiKSB7XG4gICAgICAgICAgaWYgKGxheWVyTmFtZSA9PT0gdW5kZWZpbmVkIHx8IGxheWVyTmFtZSA9PT0gdGhpcy5sYXllcnNbaV0ubmFtZSkge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG9wYWNpdHkgPSBsYXllci5vcGFjaXR5IHx8IDEuMDtcbiAgICAgICAgICAgIGxheWVyLm9iamVjdHMuZm9yRWFjaChmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgIGlmIChlLmdpZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hcENoaXAoY2FudmFzLCBlLmdpZCwgZS54LCBlLnksIG9wYWNpdHkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL+OCpOODoeODvOOCuOODrOOCpOODpOODvFxuICAgICAgICBpZiAodGhpcy5sYXllcnNbaV0udHlwZSA9PSBcImltYWdlbGF5ZXJcIiAmJiB0aGlzLmxheWVyc1tpXS52aXNpYmxlICE9IFwiMFwiKSB7XG4gICAgICAgICAgaWYgKGxheWVyTmFtZSA9PT0gdW5kZWZpbmVkIHx8IGxheWVyTmFtZSA9PT0gdGhpcy5sYXllcnNbaV0ubmFtZSkge1xuICAgICAgICAgICAgY29uc3QgaW1hZ2UgPSBwaGluYS5hc3NldC5Bc3NldE1hbmFnZXIuZ2V0KCdpbWFnZScsIHRoaXMubGF5ZXJzW2ldLmltYWdlLnNvdXJjZSk7XG4gICAgICAgICAgICBjYW52YXMuY29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UuZG9tRWxlbWVudCwgdGhpcy5sYXllcnNbaV0ueCwgdGhpcy5sYXllcnNbaV0ueSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRleHR1cmUgPSBwaGluYS5hc3NldC5UZXh0dXJlKCk7XG4gICAgICB0ZXh0dXJlLmRvbUVsZW1lbnQgPSBjYW52YXMuZG9tRWxlbWVudDtcbiAgICAgIHJldHVybiB0ZXh0dXJlO1xuICAgIH0sXG5cbiAgICAvL+OCreODo+ODs+ODkOOCueOBruaMh+WumuOBl+OBn+W6p+aomeOBq+ODnuODg+ODl+ODgeODg+ODl+OBruOCpOODoeODvOOCuOOCkuOCs+ODlOODvOOBmeOCi1xuICAgIF9zZXRNYXBDaGlwOiBmdW5jdGlvbihjYW52YXMsIGluZGV4LCB4LCB5LCBvcGFjaXR5KSB7XG4gICAgICAvL+WvvuixoeOCv+OCpOODq+OCu+ODg+ODiOOBruWIpOWIpVxuICAgICAgbGV0IHRpbGVzZXQ7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudGlsZXNldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgdHN4MSA9IHRoaXMudGlsZXNldHNbaV07XG4gICAgICAgIGNvbnN0IHRzeDIgPSB0aGlzLnRpbGVzZXRzW2kgKyAxXTtcbiAgICAgICAgaWYgKCF0c3gyKSB7XG4gICAgICAgICAgdGlsZXNldCA9IHRzeDE7XG4gICAgICAgICAgaSA9IHRoaXMudGlsZXNldHMubGVuZ3RoO1xuICAgICAgICB9IGVsc2UgaWYgKHRzeDEuZmlyc3RnaWQgPD0gaW5kZXggJiYgaW5kZXggPCB0c3gyLmZpcnN0Z2lkKSB7XG4gICAgICAgICAgdGlsZXNldCA9IHRzeDE7XG4gICAgICAgICAgaSA9IHRoaXMudGlsZXNldHMubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvL+OCv+OCpOODq+OCu+ODg+ODiOOBi+OCieODnuODg+ODl+ODgeODg+ODl+OCkuWPluW+l1xuICAgICAgY29uc3QgdHN4ID0gdGlsZXNldC50c3g7XG4gICAgICBjb25zdCBjaGlwID0gdHN4LmNoaXBzW2luZGV4IC0gdGlsZXNldC5maXJzdGdpZF07XG4gICAgICBjb25zdCBpbWFnZSA9IHBoaW5hLmFzc2V0LkFzc2V0TWFuYWdlci5nZXQoJ2ltYWdlJywgY2hpcC5pbWFnZSk7XG4gICAgICBjYW52YXMuY29udGV4dC5kcmF3SW1hZ2UoXG4gICAgICAgIGltYWdlLmRvbUVsZW1lbnQsXG4gICAgICAgIGNoaXAueCArIHRzeC5tYXJnaW4sIGNoaXAueSArIHRzeC5tYXJnaW4sXG4gICAgICAgIHRzeC50aWxld2lkdGgsIHRzeC50aWxlaGVpZ2h0LFxuICAgICAgICB4LCB5LFxuICAgICAgICB0c3gudGlsZXdpZHRoLCB0c3gudGlsZWhlaWdodCk7XG4gICAgfSxcblxuICB9KTtcblxuICAvL+ODreODvOODgOODvOOBq+i/veWKoFxuICBwaGluYS5hc3NldC5Bc3NldExvYWRlci5hc3NldExvYWRGdW5jdGlvbnMudG14ID0gZnVuY3Rpb24oa2V5LCBwYXRoKSB7XG4gICAgY29uc3QgdG14ID0gcGhpbmEuYXNzZXQuVGlsZWRNYXAoKTtcbiAgICByZXR1cm4gdG14LmxvYWQocGF0aCk7XG4gIH07XG5cbn0pOyIsIi8qXG4gKiAgcGhpbmEuVGlsZXNldC5qc1xuICogIDIwMTkvOS8xMlxuICogIEBhdXRoZXIgbWluaW1vICBcbiAqICBUaGlzIFByb2dyYW0gaXMgTUlUIGxpY2Vuc2UuXG4gKlxuICovXG5cbnBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kZWZpbmUoXCJwaGluYS5hc3NldC5UaWxlU2V0XCIsIHtcbiAgICBzdXBlckNsYXNzOiBcInBoaW5hLmFzc2V0LlhNTExvYWRlclwiLFxuXG4gICAgaW1hZ2U6IG51bGwsXG4gICAgdGlsZXdpZHRoOiAwLFxuICAgIHRpbGVoZWlnaHQ6IDAsXG4gICAgdGlsZWNvdW50OiAwLFxuICAgIGNvbHVtbnM6IDAsXG5cbiAgICBpbml0OiBmdW5jdGlvbih4bWwpIHtcbiAgICAgICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICAgICAgaWYgKHhtbCkge1xuICAgICAgICAgIHRoaXMubG9hZEZyb21YTUwoeG1sKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBfbG9hZDogZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgICAgLy/jg5HjgrnmipzjgY3lh7rjgZdcbiAgICAgIHRoaXMucGF0aCA9IFwiXCI7XG4gICAgICBjb25zdCBsYXN0ID0gdGhpcy5zcmMubGFzdEluZGV4T2YoXCIvXCIpO1xuICAgICAgaWYgKGxhc3QgPiAwKSB7XG4gICAgICAgIHRoaXMucGF0aCA9IHRoaXMuc3JjLnN1YnN0cmluZygwLCBsYXN0ICsgMSk7XG4gICAgICB9XG5cbiAgICAgIC8v57WC5LqG6Zai5pWw5L+d5a2YXG4gICAgICB0aGlzLl9yZXNvbHZlID0gcmVzb2x2ZTtcblxuICAgICAgLy8gbG9hZFxuICAgICAgY29uc3QgeG1sID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICB4bWwub3BlbignR0VUJywgdGhpcy5zcmMpO1xuICAgICAgeG1sLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKHhtbC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgaWYgKFsyMDAsIDIwMSwgMF0uaW5kZXhPZih4bWwuc3RhdHVzKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSAobmV3IERPTVBhcnNlcigpKS5wYXJzZUZyb21TdHJpbmcoeG1sLnJlc3BvbnNlVGV4dCwgXCJ0ZXh0L3htbFwiKTtcbiAgICAgICAgICAgIHRoaXMuZGF0YVR5cGUgPSBcInhtbFwiO1xuICAgICAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlKGRhdGEpXG4gICAgICAgICAgICAgIC50aGVuKCgpID0+IHRoaXMuX3Jlc29sdmUodGhpcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHhtbC5zZW5kKG51bGwpO1xuICAgIH0sXG5cbiAgICBsb2FkRnJvbVhNTDogZnVuY3Rpb24oeG1sKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcGFyc2UoeG1sKTtcbiAgICB9LFxuXG4gICAgX3BhcnNlOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgIC8v44K/44Kk44Or44K744OD44OI5Y+W5b6XXG4gICAgICAgIGNvbnN0IHRpbGVzZXQgPSBkYXRhLmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0aWxlc2V0JylbMF07XG4gICAgICAgIGNvbnN0IHByb3BzID0gdGhpcy5fcHJvcGVydGllc1RvSlNPTih0aWxlc2V0KTtcblxuICAgICAgICAvL+OCv+OCpOODq+OCu+ODg+ODiOWxnuaAp+aDheWgseWPluW+l1xuICAgICAgICBjb25zdCBhdHRyID0gdGhpcy5fYXR0clRvSlNPTih0aWxlc2V0KTtcbiAgICAgICAgYXR0ci4kc2FmZSh7XG4gICAgICAgICAgdGlsZXdpZHRoOiAzMixcbiAgICAgICAgICB0aWxlaGVpZ2h0OiAzMixcbiAgICAgICAgICBzcGFjaW5nOiAwLFxuICAgICAgICAgIG1hcmdpbjogMCxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuJGV4dGVuZChhdHRyKTtcbiAgICAgICAgdGhpcy5jaGlwcyA9IFtdO1xuXG4gICAgICAgIC8v44K944O844K555S75YOP6Kit5a6a5Y+W5b6XXG4gICAgICAgIHRoaXMuaW1hZ2VOYW1lID0gdGlsZXNldC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW1hZ2UnKVswXS5nZXRBdHRyaWJ1dGUoJ3NvdXJjZScpO1xuICBcbiAgICAgICAgLy/pgI/pgY7oibLoqK3lrprlj5blvpdcbiAgICAgICAgY29uc3QgdHJhbnMgPSB0aWxlc2V0LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdpbWFnZScpWzBdLmdldEF0dHJpYnV0ZSgndHJhbnMnKTtcbiAgICAgICAgaWYgKHRyYW5zKSB7XG4gICAgICAgICAgdGhpcy50cmFuc1IgPSBwYXJzZUludCh0cmFucy5zdWJzdHJpbmcoMCwgMiksIDE2KTtcbiAgICAgICAgICB0aGlzLnRyYW5zRyA9IHBhcnNlSW50KHRyYW5zLnN1YnN0cmluZygyLCA0KSwgMTYpO1xuICAgICAgICAgIHRoaXMudHJhbnNCID0gcGFyc2VJbnQodHJhbnMuc3Vic3RyaW5nKDQsIDYpLCAxNik7XG4gICAgICAgIH1cbiAgXG4gICAgICAgIC8v44Oe44OD44OX44OB44OD44OX44Oq44K544OI5L2c5oiQXG4gICAgICAgIGZvciAobGV0IHIgPSAwOyByIDwgdGhpcy50aWxlY291bnQ7IHIrKykge1xuICAgICAgICAgIGNvbnN0IGNoaXAgPSB7XG4gICAgICAgICAgICBpbWFnZTogdGhpcy5pbWFnZU5hbWUsXG4gICAgICAgICAgICB4OiAociAgJSB0aGlzLmNvbHVtbnMpICogKHRoaXMudGlsZXdpZHRoICsgdGhpcy5zcGFjaW5nKSArIHRoaXMubWFyZ2luLFxuICAgICAgICAgICAgeTogTWF0aC5mbG9vcihyIC8gdGhpcy5jb2x1bW5zKSAqICh0aGlzLnRpbGVoZWlnaHQgKyB0aGlzLnNwYWNpbmcpICsgdGhpcy5tYXJnaW4sXG4gICAgICAgICAgfTtcbiAgICAgICAgICB0aGlzLmNoaXBzW3JdID0gY2hpcDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8v44Kk44Oh44O844K444OH44O844K/6Kqt44G/6L6844G/XG4gICAgICAgIHRoaXMuX2xvYWRJbWFnZSgpXG4gICAgICAgICAgLnRoZW4oKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvL+OCouOCu+ODg+ODiOOBq+eEoeOBhOOCpOODoeODvOOCuOODh+ODvOOCv+OCkuiqreOBv+i+vOOBv1xuICAgIF9sb2FkSW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBjb25zdCBpbWFnZVNvdXJjZSA9IHtcbiAgICAgICAgICBpbWFnZU5hbWU6IHRoaXMuaW1hZ2VOYW1lLFxuICAgICAgICAgIGltYWdlVXJsOiB0aGlzLnBhdGggKyB0aGlzLmltYWdlTmFtZSxcbiAgICAgICAgICB0cmFuc1I6IHRoaXMudHJhbnNSLFxuICAgICAgICAgIHRyYW5zRzogdGhpcy50cmFuc0csXG4gICAgICAgICAgdHJhbnNCOiB0aGlzLnRyYW5zQixcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGxldCBsb2FkSW1hZ2UgPSBudWxsO1xuICAgICAgICBjb25zdCBpbWFnZSA9IHBoaW5hLmFzc2V0LkFzc2V0TWFuYWdlci5nZXQoJ2ltYWdlJywgaW1hZ2VTb3VyY2UuaW1hZ2UpO1xuICAgICAgICBpZiAoaW1hZ2UpIHtcbiAgICAgICAgICB0aGlzLmltYWdlID0gaW1hZ2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9hZEltYWdlID0gaW1hZ2VTb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICAvL+ODreODvOODieODquOCueODiOS9nOaIkFxuICAgICAgICBjb25zdCBhc3NldHMgPSB7IGltYWdlOiBbXSB9O1xuICAgICAgICBhc3NldHMuaW1hZ2VbaW1hZ2VTb3VyY2UuaW1hZ2VOYW1lXSA9IGltYWdlU291cmNlLmltYWdlVXJsO1xuXG4gICAgICAgIGlmIChsb2FkSW1hZ2UpIHtcbiAgICAgICAgICBjb25zdCBsb2FkZXIgPSBwaGluYS5hc3NldC5Bc3NldExvYWRlcigpO1xuICAgICAgICAgIGxvYWRlci5sb2FkKGFzc2V0cyk7XG4gICAgICAgICAgbG9hZGVyLm9uKCdsb2FkJywgZSA9PiB7XG4gICAgICAgICAgICAvL+mAj+mBjuiJsuioreWumuWPjeaYoFxuICAgICAgICAgICAgdGhpcy5pbWFnZSA9IHBoaW5hLmFzc2V0LkFzc2V0TWFuYWdlci5nZXQoJ2ltYWdlJywgaW1hZ2VTb3VyY2UuaW1hZ2VVcmwpO1xuICAgICAgICAgICAgaWYgKGltYWdlU291cmNlLnRyYW5zUiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHIgPSBpbWFnZVNvdXJjZS50cmFuc1I7XG4gICAgICAgICAgICAgIGNvbnN0IGcgPSBpbWFnZVNvdXJjZS50cmFuc0c7XG4gICAgICAgICAgICAgIGNvbnN0IGIgPSBpbWFnZVNvdXJjZS50cmFuc0I7XG4gICAgICAgICAgICAgIHRoaXMuaW1hZ2UuZmlsdGVyKChwaXhlbCwgaW5kZXgsIHgsIHksIGJpdG1hcCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBiaXRtYXAuZGF0YTtcbiAgICAgICAgICAgICAgICBpZiAocGl4ZWxbMF0gPT0gciAmJiBwaXhlbFsxXSA9PSBnICYmIHBpeGVsWzJdID09IGIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpbmRleCszXSA9IDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIC8v44Ot44O844OA44O844Gr6L+95YqgXG4gIHBoaW5hLmFzc2V0LkFzc2V0TG9hZGVyLmFzc2V0TG9hZEZ1bmN0aW9ucy50c3ggPSBmdW5jdGlvbihrZXksIHBhdGgpIHtcbiAgICBjb25zdCB0c3ggPSBwaGluYS5hc3NldC5UaWxlU2V0KCk7XG4gICAgcmV0dXJuIHRzeC5sb2FkKHBhdGgpO1xuICB9O1xuXG59KTsiLCIvL1xuLy8g5rGO55So6Zai5pWw576kXG4vL1xucGhpbmEuZGVmaW5lKFwiVXRpbFwiLCB7XG4gIF9zdGF0aWM6IHtcblxuICAgIC8v5oyH5a6a44GV44KM44Gf44Kq44OW44K444Kn44Kv44OI44KS44Or44O844OI44Go44GX44Gm55uu55qE44GuaWTjgpLotbDmn7vjgZnjgotcbiAgICBmaW5kQnlJZDogZnVuY3Rpb24oaWQsIG9iaikge1xuICAgICAgaWYgKG9iai5pZCA9PT0gaWQpIHJldHVybiBvYmo7XG4gICAgICBjb25zdCBjaGlsZHJlbiA9IE9iamVjdC5rZXlzKG9iai5jaGlsZHJlbiB8fCB7fSkubWFwKGtleSA9PiBvYmouY2hpbGRyZW5ba2V5XSk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGhpdCA9IHRoaXMuZmluZEJ5SWQoaWQsIGNoaWxkcmVuW2ldKTtcbiAgICAgICAgaWYgKGhpdCkgcmV0dXJuIGhpdDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG5cbiAgICAvL1RPRE8644GT44GT44GY44KD44Gq44GE5oSf44GM44GC44KL44Gu44Gn44GZ44GM44CB5LiA5pem5a6f6KOFXG4gICAgLy/mjIflrprjgZXjgozjgZ9B44GoQuOBrmFzc2V0c+OBrumAo+aDs+mFjeWIl+OCkuaWsOimj+OBruOCquODluOCuOOCp+OCr+ODiOOBq+ODnuODvOOCuOOBmeOCi1xuICAgIG1lcmdlQXNzZXRzOiBmdW5jdGlvbihhc3NldHNBLCBhc3NldHNCKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICAgIGFzc2V0c0EuZm9ySW4oKHR5cGVLZXksIHR5cGVWYWx1ZSkgPT4ge1xuICAgICAgICBpZiAoIXJlc3VsdC4kaGFzKHR5cGVLZXkpKSByZXN1bHRbdHlwZUtleV0gPSB7fTtcbiAgICAgICAgdHlwZVZhbHVlLmZvckluKChhc3NldEtleSwgYXNzZXRQYXRoKSA9PiB7XG4gICAgICAgICAgcmVzdWx0W3R5cGVLZXldW2Fzc2V0S2V5XSA9IGFzc2V0UGF0aDtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGFzc2V0c0IuZm9ySW4oKHR5cGVLZXksIHR5cGVWYWx1ZSkgPT4ge1xuICAgICAgICBpZiAoIXJlc3VsdC4kaGFzKHR5cGVLZXkpKSByZXN1bHRbdHlwZUtleV0gPSB7fTtcbiAgICAgICAgdHlwZVZhbHVlLmZvckluKChhc3NldEtleSwgYXNzZXRQYXRoKSA9PiB7XG4gICAgICAgICAgcmVzdWx0W3R5cGVLZXldW2Fzc2V0S2V5XSA9IGFzc2V0UGF0aDtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8v54++5Zyo5pmC6ZaT44GL44KJ5oyH5a6a5pmC6ZaT44G+44Gn44Gp44Gu44GP44KJ44GE44GL44GL44KL44GL44KS6L+U5Y2044GZ44KLXG4gICAgLy9cbiAgICAvLyBvdXRwdXQgOiB7IFxuICAgIC8vICAgdG90YWxEYXRlOjAgLCBcbiAgICAvLyAgIHRvdGFsSG91cjowICwgXG4gICAgLy8gICB0b3RhbE1pbnV0ZXM6MCAsIFxuICAgIC8vICAgdG90YWxTZWNvbmRzOjAgLFxuICAgIC8vICAgZGF0ZTowICwgXG4gICAgLy8gICBob3VyOjAgLCBcbiAgICAvLyAgIG1pbnV0ZXM6MCAsIFxuICAgIC8vICAgc2Vjb25kczowIFxuICAgIC8vIH1cbiAgICAvL1xuXG4gICAgY2FsY1JlbWFpbmluZ1RpbWU6IGZ1bmN0aW9uKGZpbmlzaCkge1xuICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgXCJ0b3RhbERhdGVcIjogMCxcbiAgICAgICAgXCJ0b3RhbEhvdXJcIjogMCxcbiAgICAgICAgXCJ0b3RhbE1pbnV0ZXNcIjogMCxcbiAgICAgICAgXCJ0b3RhbFNlY29uZHNcIjogMCxcbiAgICAgICAgXCJkYXRlXCI6IDAsXG4gICAgICAgIFwiaG91clwiOiAwLFxuICAgICAgICBcIm1pbnV0ZXNcIjogMCxcbiAgICAgICAgXCJzZWNvbmRzXCI6IDAsXG4gICAgICB9XG5cbiAgICAgIGZpbmlzaCA9IChmaW5pc2ggaW5zdGFuY2VvZiBEYXRlKSA/IGZpbmlzaCA6IG5ldyBEYXRlKGZpbmlzaCk7XG4gICAgICBsZXQgZGlmZiA9IGZpbmlzaCAtIG5vdztcbiAgICAgIGlmIChkaWZmID09PSAwKSByZXR1cm4gcmVzdWx0O1xuXG4gICAgICBjb25zdCBzaWduID0gKGRpZmYgPCAwKSA/IC0xIDogMTtcblxuICAgICAgLy9UT0RPOuOBk+OBrui+uuOCiuOCguOBhuWwkeOBl+e2uum6l+OBq+abuOOBkeOBquOBhOOBi+aknOiojlxuICAgICAgLy/ljZjkvY3liKUgMeacqua6gOOBrzBcbiAgICAgIHJlc3VsdFtcInRvdGFsRGF0ZVwiXSA9IHBhcnNlSW50KGRpZmYgLyAxMDAwIC8gNjAgLyA2MCAvIDI0KTtcbiAgICAgIHJlc3VsdFtcInRvdGFsSG91clwiXSA9IHBhcnNlSW50KGRpZmYgLyAxMDAwIC8gNjAgLyA2MCk7XG4gICAgICByZXN1bHRbXCJ0b3RhbE1pbnV0ZXNcIl0gPSBwYXJzZUludChkaWZmIC8gMTAwMCAvIDYwKTtcbiAgICAgIHJlc3VsdFtcInRvdGFsU2Vjb25kc1wiXSA9IHBhcnNlSW50KGRpZmYgLyAxMDAwKTtcblxuICAgICAgZGlmZiAtPSByZXN1bHRbXCJ0b3RhbERhdGVcIl0gKiA4NjQwMDAwMDtcbiAgICAgIHJlc3VsdFtcImhvdXJcIl0gPSBwYXJzZUludChkaWZmIC8gMTAwMCAvIDYwIC8gNjApO1xuXG4gICAgICBkaWZmIC09IHJlc3VsdFtcImhvdXJcIl0gKiAzNjAwMDAwO1xuICAgICAgcmVzdWx0W1wibWludXRlc1wiXSA9IHBhcnNlSW50KGRpZmYgLyAxMDAwIC8gNjApO1xuXG4gICAgICBkaWZmIC09IHJlc3VsdFtcIm1pbnV0ZXNcIl0gKiA2MDAwMDtcbiAgICAgIHJlc3VsdFtcInNlY29uZHNcIl0gPSBwYXJzZUludChkaWZmIC8gMTAwMCk7XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG5cbiAgICB9LFxuXG4gICAgLy/jg6zjgqTjgqLjgqbjg4jjgqjjg4fjgqPjgr/jg7zjgafjga9TcHJpdGXlhajjgaZBdGFsc1Nwcml0ZeOBq+OBquOBo+OBpuOBl+OBvuOBhuOBn+OCgeOAgVxuICAgIC8vU3ByaXRl44Gr5beu44GX5pu/44GI44KJ44KM44KL44KI44GG44Gr44GZ44KLXG5cbiAgICAvL0F0bGFzU3ByaXRl6Ieq6Lqr44Gr5Y2Y55m644GuSW1hZ2XjgpLjgrvjg4Pjg4jjgafjgY3jgovjgojjgYbjgavjgZnjgovvvJ9cbiAgICAvL+OBguOBqOOBp+OBquOBq+OBi+OBl+OCieWvvuetluOBl+OBquOBhOOBqOOBoOOCgeOBoOOBjO+8k+aciOe0jeWTgeOBp+OBr+S4gOaXpuOBk+OCjOOBp1xuICAgIHJlcGxhY2VBdGxhc1Nwcml0ZVRvU3ByaXRlOiBmdW5jdGlvbihwYXJlbnQsIGF0bGFzU3ByaXRlLCBzcHJpdGUpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gcGFyZW50LmdldENoaWxkSW5kZXgoYXRsYXNTcHJpdGUpO1xuICAgICAgc3ByaXRlLnNldE9yaWdpbihhdGxhc1Nwcml0ZS5vcmlnaW5YLCBhdGxhc1Nwcml0ZS5vcmlnaW5ZKTtcbiAgICAgIHNwcml0ZS5zZXRQb3NpdGlvbihhdGxhc1Nwcml0ZS54LCBhdGxhc1Nwcml0ZS55KTtcbiAgICAgIHBhcmVudC5hZGRDaGlsZEF0KHNwcml0ZSwgaW5kZXgpO1xuICAgICAgYXRsYXNTcHJpdGUucmVtb3ZlKCk7XG4gICAgICByZXR1cm4gc3ByaXRlO1xuICAgIH0sXG4gIH1cbn0pO1xuIiwiLypcbiAqICBwaGluYS54bWxsb2FkZXIuanNcbiAqICAyMDE5LzkvMTJcbiAqICBAYXV0aGVyIG1pbmltbyAgXG4gKiAgVGhpcyBQcm9ncmFtIGlzIE1JVCBsaWNlbnNlLlxuICpcbiAqL1xuXG5waGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuZGVmaW5lKFwicGhpbmEuYXNzZXQuWE1MTG9hZGVyXCIsIHtcbiAgICBzdXBlckNsYXNzOiBcInBoaW5hLmFzc2V0LkFzc2V0XCIsXG5cbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB9LFxuXG4gICAgX2xvYWQ6IGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICAgIHJlc29sdmUoKTtcbiAgICB9LFxuXG4gICAgLy9YTUzjg5fjg63jg5Hjg4bjgqPjgpJKU09O44Gr5aSJ5o+bXG4gICAgX3Byb3BlcnRpZXNUb0pTT046IGZ1bmN0aW9uKGVsbSkge1xuICAgICAgY29uc3QgcHJvcGVydGllcyA9IGVsbS5nZXRFbGVtZW50c0J5VGFnTmFtZShcInByb3BlcnRpZXNcIilbMF07XG4gICAgICBjb25zdCBvYmogPSB7fTtcbiAgICAgIGlmIChwcm9wZXJ0aWVzID09PSB1bmRlZmluZWQpIHJldHVybiBvYmo7XG5cbiAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgcHJvcGVydGllcy5jaGlsZE5vZGVzLmxlbmd0aDsgaysrKSB7XG4gICAgICAgIGNvbnN0IHAgPSBwcm9wZXJ0aWVzLmNoaWxkTm9kZXNba107XG4gICAgICAgIGlmIChwLnRhZ05hbWUgPT09IFwicHJvcGVydHlcIikge1xuICAgICAgICAgIC8vcHJvcGVydHnjgat0eXBl5oyH5a6a44GM44GC44Gj44Gf44KJ5aSJ5o+bXG4gICAgICAgICAgY29uc3QgdHlwZSA9IHAuZ2V0QXR0cmlidXRlKCd0eXBlJyk7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBwLmdldEF0dHJpYnV0ZSgndmFsdWUnKTtcbiAgICAgICAgICBpZiAoIXZhbHVlKSB2YWx1ZSA9IHAudGV4dENvbnRlbnQ7XG4gICAgICAgICAgaWYgKHR5cGUgPT0gXCJpbnRcIikge1xuICAgICAgICAgICAgb2JqW3AuZ2V0QXR0cmlidXRlKCduYW1lJyldID0gcGFyc2VJbnQodmFsdWUsIDEwKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJmbG9hdFwiKSB7XG4gICAgICAgICAgICBvYmpbcC5nZXRBdHRyaWJ1dGUoJ25hbWUnKV0gPSBwYXJzZUZsb2F0KHZhbHVlKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJib29sXCIgKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPT0gXCJ0cnVlXCIpIG9ialtwLmdldEF0dHJpYnV0ZSgnbmFtZScpXSA9IHRydWU7XG4gICAgICAgICAgICBlbHNlIG9ialtwLmdldEF0dHJpYnV0ZSgnbmFtZScpXSA9IGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvYmpbcC5nZXRBdHRyaWJ1dGUoJ25hbWUnKV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSxcblxuICAgIC8vWE1M5bGe5oCn44KSSlNPTuOBq+WkieaPm1xuICAgIF9hdHRyVG9KU09OOiBmdW5jdGlvbihzb3VyY2UpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHt9O1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2UuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgdmFsID0gc291cmNlLmF0dHJpYnV0ZXNbaV0udmFsdWU7XG4gICAgICAgIHZhbCA9IGlzTmFOKHBhcnNlRmxvYXQodmFsKSk/IHZhbDogcGFyc2VGbG9hdCh2YWwpO1xuICAgICAgICBvYmpbc291cmNlLmF0dHJpYnV0ZXNbaV0ubmFtZV0gPSB2YWw7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH0sXG5cbiAgICAvL1hNTOWxnuaAp+OCkkpTT07jgavlpInmj5vvvIhTdHJpbmfjgafov5TjgZnvvIlcbiAgICBfYXR0clRvSlNPTl9zdHI6IGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgY29uc3Qgb2JqID0ge307XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZS5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHZhbCA9IHNvdXJjZS5hdHRyaWJ1dGVzW2ldLnZhbHVlO1xuICAgICAgICBvYmpbc291cmNlLmF0dHJpYnV0ZXNbaV0ubmFtZV0gPSB2YWw7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH0sXG5cbiAgICAvL0NTVuODkeODvOOCuVxuICAgIF9wYXJzZUNTVjogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgY29uc3QgZGF0YUxpc3QgPSBkYXRhLnNwbGl0KCcsJyk7XG4gICAgICBjb25zdCBsYXllciA9IFtdO1xuXG4gICAgICBkYXRhTGlzdC5lYWNoKGVsbSA9PiB7XG4gICAgICAgIGNvbnN0IG51bSA9IHBhcnNlSW50KGVsbSwgMTApO1xuICAgICAgICBsYXllci5wdXNoKG51bSk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGxheWVyO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBCQVNFNjTjg5Hjg7zjgrlcbiAgICAgKiBodHRwOi8vdGhla2Fubm9uLXNlcnZlci5hcHBzcG90LmNvbS9oZXJwaXR5LWRlcnBpdHkuYXBwc3BvdC5jb20vcGFzdGViaW4uY29tLzc1S2tzMFdIXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VCYXNlNjQ6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIGNvbnN0IGRhdGFMaXN0ID0gYXRvYihkYXRhLnRyaW0oKSk7XG4gICAgICBjb25zdCByc3QgPSBbXTtcblxuICAgICAgZGF0YUxpc3QgPSBkYXRhTGlzdC5zcGxpdCgnJykubWFwKGUgPT4gZS5jaGFyQ29kZUF0KDApKTtcblxuICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGRhdGFMaXN0Lmxlbmd0aCAvIDQ7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBjb25zdCBuID0gZGF0YUxpc3RbaSo0XTtcbiAgICAgICAgcnN0W2ldID0gcGFyc2VJbnQobiwgMTApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcnN0O1xuICAgIH0sXG4gIH0pO1xuXG59KTsiLCJwaGluYS5hc3NldC5Bc3NldExvYWRlci5wcm90b3R5cGUubG9hZCA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBsb2FkQXNzZXRzID0gW107XG4gIHZhciBjb3VudGVyID0gMDtcbiAgdmFyIGxlbmd0aCA9IDA7XG4gIHZhciBtYXhDb25uZWN0aW9uQ291bnQgPSAyO1xuXG4gIHBhcmFtcy5mb3JJbihmdW5jdGlvbih0eXBlLCBhc3NldHMpIHtcbiAgICBsZW5ndGggKz0gT2JqZWN0LmtleXMoYXNzZXRzKS5sZW5ndGg7XG4gIH0pO1xuXG4gIGlmIChsZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBwaGluYS51dGlsLkZsb3cucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICBzZWxmLmZsYXJlKCdsb2FkJyk7XG4gICAgfSk7XG4gIH1cblxuICBwYXJhbXMuZm9ySW4oZnVuY3Rpb24odHlwZSwgYXNzZXRzKSB7XG4gICAgYXNzZXRzLmZvckluKGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgICAgIGxvYWRBc3NldHMucHVzaCh7XG4gICAgICAgIFwiZnVuY1wiOiBwaGluYS5hc3NldC5Bc3NldExvYWRlci5hc3NldExvYWRGdW5jdGlvbnNbdHlwZV0sXG4gICAgICAgIFwia2V5XCI6IGtleSxcbiAgICAgICAgXCJ2YWx1ZVwiOiB2YWx1ZSxcbiAgICAgICAgXCJ0eXBlXCI6IHR5cGUsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgaWYgKHNlbGYuY2FjaGUpIHtcbiAgICBzZWxmLm9uKCdwcm9ncmVzcycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChlLnByb2dyZXNzID49IDEuMCkge1xuICAgICAgICBwYXJhbXMuZm9ySW4oZnVuY3Rpb24odHlwZSwgYXNzZXRzKSB7XG4gICAgICAgICAgYXNzZXRzLmZvckluKGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBhc3NldCA9IHBoaW5hLmFzc2V0LkFzc2V0TWFuYWdlci5nZXQodHlwZSwga2V5KTtcbiAgICAgICAgICAgIGlmIChhc3NldC5sb2FkRXJyb3IpIHtcbiAgICAgICAgICAgICAgdmFyIGR1bW15ID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCh0eXBlLCAnZHVtbXknKTtcbiAgICAgICAgICAgICAgaWYgKGR1bW15KSB7XG4gICAgICAgICAgICAgICAgaWYgKGR1bW15LmxvYWRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgZHVtbXkubG9hZER1bW15KCk7XG4gICAgICAgICAgICAgICAgICBkdW1teS5sb2FkRXJyb3IgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLnNldCh0eXBlLCBrZXksIGR1bW15KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NldC5sb2FkRHVtbXkoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHZhciBsb2FkQXNzZXRzQXJyYXkgPSBbXTtcblxuICB3aGlsZSAobG9hZEFzc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgbG9hZEFzc2V0c0FycmF5LnB1c2gobG9hZEFzc2V0cy5zcGxpY2UoMCwgbWF4Q29ubmVjdGlvbkNvdW50KSk7XG4gIH1cblxuICB2YXIgZmxvdyA9IHBoaW5hLnV0aWwuRmxvdy5yZXNvbHZlKCk7XG5cbiAgbG9hZEFzc2V0c0FycmF5LmZvckVhY2goZnVuY3Rpb24obG9hZEFzc2V0cykge1xuICAgIGZsb3cgPSBmbG93LnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZmxvd3MgPSBbXTtcbiAgICAgIGxvYWRBc3NldHMuZm9yRWFjaChmdW5jdGlvbihsb2FkQXNzZXQpIHtcbiAgICAgICAgdmFyIGYgPSBsb2FkQXNzZXQuZnVuYyhsb2FkQXNzZXQua2V5LCBsb2FkQXNzZXQudmFsdWUpO1xuICAgICAgICBmLnRoZW4oZnVuY3Rpb24oYXNzZXQpIHtcbiAgICAgICAgICBpZiAoc2VsZi5jYWNoZSkge1xuICAgICAgICAgICAgcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLnNldChsb2FkQXNzZXQudHlwZSwgbG9hZEFzc2V0LmtleSwgYXNzZXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLmZsYXJlKCdwcm9ncmVzcycsIHtcbiAgICAgICAgICAgIGtleTogbG9hZEFzc2V0LmtleSxcbiAgICAgICAgICAgIGFzc2V0OiBhc3NldCxcbiAgICAgICAgICAgIHByb2dyZXNzOiAoKytjb3VudGVyIC8gbGVuZ3RoKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGZsb3dzLnB1c2goZik7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBwaGluYS51dGlsLkZsb3cuYWxsKGZsb3dzKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIGZsb3cudGhlbihmdW5jdGlvbihhcmdzKSB7XG4gICAgc2VsZi5mbGFyZSgnbG9hZCcpO1xuICB9KTtcbn1cbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5hcHAuQmFzZUFwcC5wcm90b3R5cGUuJG1ldGhvZChcInJlcGxhY2VTY2VuZVwiLCBmdW5jdGlvbihzY2VuZSkge1xuICAgIHRoaXMuZmxhcmUoJ3JlcGxhY2UnKTtcbiAgICB0aGlzLmZsYXJlKCdjaGFuZ2VzY2VuZScpO1xuXG4gICAgd2hpbGUgKHRoaXMuX3NjZW5lcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBzY2VuZSA9IHRoaXMuX3NjZW5lcy5wb3AoKTtcbiAgICAgIHNjZW5lLmZsYXJlKFwiZGVzdHJveVwiKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zY2VuZUluZGV4ID0gMDtcblxuICAgIGlmICh0aGlzLmN1cnJlbnRTY2VuZSkge1xuICAgICAgdGhpcy5jdXJyZW50U2NlbmUuYXBwID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRTY2VuZSA9IHNjZW5lO1xuICAgIHRoaXMuY3VycmVudFNjZW5lLmFwcCA9IHRoaXM7XG4gICAgdGhpcy5jdXJyZW50U2NlbmUuZmxhcmUoJ2VudGVyJywge1xuICAgICAgYXBwOiB0aGlzLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0pO1xuXG4gIHBoaW5hLmFwcC5CYXNlQXBwLnByb3RvdHlwZS4kbWV0aG9kKFwicG9wU2NlbmVcIiwgZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5mbGFyZSgncG9wJyk7XG4gICAgdGhpcy5mbGFyZSgnY2hhbmdlc2NlbmUnKTtcblxuICAgIHZhciBzY2VuZSA9IHRoaXMuX3NjZW5lcy5wb3AoKTtcbiAgICAtLXRoaXMuX3NjZW5lSW5kZXg7XG5cbiAgICBzY2VuZS5mbGFyZSgnZXhpdCcsIHtcbiAgICAgIGFwcDogdGhpcyxcbiAgICB9KTtcbiAgICBzY2VuZS5mbGFyZSgnZGVzdHJveScpO1xuICAgIHNjZW5lLmFwcCA9IG51bGw7XG5cbiAgICB0aGlzLmZsYXJlKCdwb3BlZCcpO1xuXG4gICAgLy8gXG4gICAgdGhpcy5jdXJyZW50U2NlbmUuZmxhcmUoJ3Jlc3VtZScsIHtcbiAgICAgIGFwcDogdGhpcyxcbiAgICAgIHByZXZTY2VuZTogc2NlbmUsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gc2NlbmU7XG4gIH0pO1xuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5ncmFwaGljcy5DYW52YXMucHJvdG90eXBlLiRtZXRob2QoXCJpbml0XCIsIGZ1bmN0aW9uKGNhbnZhcykge1xuICAgIHRoaXMuaXNDcmVhdGVDYW52YXMgPSBmYWxzZTtcbiAgICBpZiAodHlwZW9mIGNhbnZhcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuY2FudmFzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihjYW52YXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY2FudmFzKSB7XG4gICAgICAgIHRoaXMuY2FudmFzID0gY2FudmFzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5pc0NyZWF0ZUNhbnZhcyA9IHRydWU7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCcjIyMjIGNyZWF0ZSBjYW52YXMgIyMjIycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZG9tRWxlbWVudCA9IHRoaXMuY2FudmFzO1xuICAgIHRoaXMuY29udGV4dCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgdGhpcy5jb250ZXh0LmxpbmVDYXAgPSAncm91bmQnO1xuICAgIHRoaXMuY29udGV4dC5saW5lSm9pbiA9ICdyb3VuZCc7XG4gIH0pO1xuXG4gIHBoaW5hLmdyYXBoaWNzLkNhbnZhcy5wcm90b3R5cGUuJG1ldGhvZCgnZGVzdHJveScsIGZ1bmN0aW9uKGNhbnZhcykge1xuICAgIGlmICghdGhpcy5pc0NyZWF0ZUNhbnZhcykgcmV0dXJuO1xuICAgIC8vIGNvbnNvbGUubG9nKGAjIyMjIGRlbGV0ZSBjYW52YXMgJHt0aGlzLmNhbnZhcy53aWR0aH0geCAke3RoaXMuY2FudmFzLmhlaWdodH0gIyMjI2ApO1xuICAgIHRoaXMuc2V0U2l6ZSgwLCAwKTtcbiAgICBkZWxldGUgdGhpcy5jYW52YXM7XG4gICAgZGVsZXRlIHRoaXMuZG9tRWxlbWVudDtcbiAgfSk7XG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKCgpID0+IHtcblxuICB2YXIgcXVhbGl0eVNjYWxlID0gcGhpbmEuZ2VvbS5NYXRyaXgzMygpO1xuXG4gIHBoaW5hLmRpc3BsYXkuQ2FudmFzUmVuZGVyZXIucHJvdG90eXBlLiRtZXRob2QoXCJyZW5kZXJcIiwgZnVuY3Rpb24oc2NlbmUsIHF1YWxpdHkpIHtcbiAgICB0aGlzLmNhbnZhcy5jbGVhcigpO1xuICAgIGlmIChzY2VuZS5iYWNrZ3JvdW5kQ29sb3IpIHtcbiAgICAgIHRoaXMuY2FudmFzLmNsZWFyQ29sb3Ioc2NlbmUuYmFja2dyb3VuZENvbG9yKTtcbiAgICB9XG5cbiAgICB0aGlzLl9jb250ZXh0LnNhdmUoKTtcbiAgICB0aGlzLnJlbmRlckNoaWxkcmVuKHNjZW5lLCBxdWFsaXR5KTtcbiAgICB0aGlzLl9jb250ZXh0LnJlc3RvcmUoKTtcbiAgfSk7XG5cbiAgcGhpbmEuZGlzcGxheS5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUuJG1ldGhvZChcInJlbmRlckNoaWxkcmVuXCIsIGZ1bmN0aW9uKG9iaiwgcXVhbGl0eSkge1xuICAgIC8vIOWtkOS+m+OBn+OBoeOCguWun+ihjFxuICAgIGlmIChvYmouY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgdmFyIHRlbXBDaGlsZHJlbiA9IG9iai5jaGlsZHJlbi5zbGljZSgpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRlbXBDaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICB0aGlzLnJlbmRlck9iamVjdCh0ZW1wQ2hpbGRyZW5baV0sIHF1YWxpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgcGhpbmEuZGlzcGxheS5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUuJG1ldGhvZChcInJlbmRlck9iamVjdFwiLCBmdW5jdGlvbihvYmosIHF1YWxpdHkpIHtcbiAgICBpZiAob2JqLnZpc2libGUgPT09IGZhbHNlICYmICFvYmouaW50ZXJhY3RpdmUpIHJldHVybjtcblxuICAgIG9iai5fY2FsY1dvcmxkTWF0cml4ICYmIG9iai5fY2FsY1dvcmxkTWF0cml4KCk7XG5cbiAgICBpZiAob2JqLnZpc2libGUgPT09IGZhbHNlKSByZXR1cm47XG5cbiAgICBvYmouX2NhbGNXb3JsZEFscGhhICYmIG9iai5fY2FsY1dvcmxkQWxwaGEoKTtcblxuICAgIHZhciBjb250ZXh0ID0gdGhpcy5jYW52YXMuY29udGV4dDtcblxuICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBvYmouX3dvcmxkQWxwaGE7XG4gICAgY29udGV4dC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gPSBvYmouYmxlbmRNb2RlO1xuXG4gICAgaWYgKG9iai5fd29ybGRNYXRyaXgpIHtcblxuICAgICAgcXVhbGl0eVNjYWxlLmlkZW50aXR5KCk7XG5cbiAgICAgIHF1YWxpdHlTY2FsZS5tMDAgPSBxdWFsaXR5IHx8IDEuMDtcbiAgICAgIHF1YWxpdHlTY2FsZS5tMTEgPSBxdWFsaXR5IHx8IDEuMDtcblxuICAgICAgdmFyIG0gPSBxdWFsaXR5U2NhbGUubXVsdGlwbHkob2JqLl93b3JsZE1hdHJpeCk7XG4gICAgICBjb250ZXh0LnNldFRyYW5zZm9ybShtLm0wMCwgbS5tMTAsIG0ubTAxLCBtLm0xMSwgbS5tMDIsIG0ubTEyKTtcblxuICAgIH1cblxuICAgIGlmIChvYmouY2xpcCkge1xuXG4gICAgICBjb250ZXh0LnNhdmUoKTtcblxuICAgICAgb2JqLmNsaXAodGhpcy5jYW52YXMpO1xuICAgICAgY29udGV4dC5jbGlwKCk7XG5cbiAgICAgIGlmIChvYmouZHJhdykgb2JqLmRyYXcodGhpcy5jYW52YXMpO1xuXG4gICAgICAvLyDlrZDkvpvjgZ/jgaHjgoLlrp/ooYxcbiAgICAgIGlmIChvYmoucmVuZGVyQ2hpbGRCeVNlbGYgPT09IGZhbHNlICYmIG9iai5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG4gICAgICAgIHZhciB0ZW1wQ2hpbGRyZW4gPSBvYmouY2hpbGRyZW4uc2xpY2UoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRlbXBDaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgIHRoaXMucmVuZGVyT2JqZWN0KHRlbXBDaGlsZHJlbltpXSwgcXVhbGl0eSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29udGV4dC5yZXN0b3JlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvYmouZHJhdykgb2JqLmRyYXcodGhpcy5jYW52YXMpO1xuXG4gICAgICAvLyDlrZDkvpvjgZ/jgaHjgoLlrp/ooYxcbiAgICAgIGlmIChvYmoucmVuZGVyQ2hpbGRCeVNlbGYgPT09IGZhbHNlICYmIG9iai5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG4gICAgICAgIHZhciB0ZW1wQ2hpbGRyZW4gPSBvYmouY2hpbGRyZW4uc2xpY2UoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRlbXBDaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgIHRoaXMucmVuZGVyT2JqZWN0KHRlbXBDaGlsZHJlbltpXSwgcXVhbGl0eSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH1cbiAgfSk7XG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKCgpID0+IHtcbiAgLy/jg6bjg7zjgrbjg7zjgqjjg7zjgrjjgqfjg7Pjg4jjgYvjgonjg5bjg6njgqbjgrbjgr/jgqTjg5fjga7liKTliKXjgpLooYzjgYZcbiAgcGhpbmEuJG1ldGhvZCgnY2hlY2tCcm93c2VyJywgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgY29uc3QgYWdlbnQgPSB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpOztcblxuICAgIHJlc3VsdC5pc0Nocm9tZSA9IChhZ2VudC5pbmRleE9mKCdjaHJvbWUnKSAhPT0gLTEpICYmIChhZ2VudC5pbmRleE9mKCdlZGdlJykgPT09IC0xKSAmJiAoYWdlbnQuaW5kZXhPZignb3ByJykgPT09IC0xKTtcbiAgICByZXN1bHQuaXNFZGdlID0gKGFnZW50LmluZGV4T2YoJ2VkZ2UnKSAhPT0gLTEpO1xuICAgIHJlc3VsdC5pc0llMTEgPSAoYWdlbnQuaW5kZXhPZigndHJpZGVudC83JykgIT09IC0xKTtcbiAgICByZXN1bHQuaXNGaXJlZm94ID0gKGFnZW50LmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEpO1xuICAgIHJlc3VsdC5pc1NhZmFyaSA9IChhZ2VudC5pbmRleE9mKCdzYWZhcmknKSAhPT0gLTEpICYmIChhZ2VudC5pbmRleE9mKCdjaHJvbWUnKSA9PT0gLTEpO1xuICAgIHJlc3VsdC5pc0VsZWN0cm9uID0gKGFnZW50LmluZGV4T2YoJ2VsZWN0cm9uJykgIT09IC0xKTtcblxuICAgIHJlc3VsdC5pc1dpbmRvd3MgPSAoYWdlbnQuaW5kZXhPZignd2luZG93cycpICE9PSAtMSk7XG4gICAgcmVzdWx0LmlzTWFjID0gKGFnZW50LmluZGV4T2YoJ21hYyBvcyB4JykgIT09IC0xKTtcblxuICAgIHJlc3VsdC5pc2lQYWQgPSBhZ2VudC5pbmRleE9mKCdpcGFkJykgPiAtMSB8fCB1YS5pbmRleE9mKCdtYWNpbnRvc2gnKSA+IC0xICYmICdvbnRvdWNoZW5kJyBpbiBkb2N1bWVudDtcbiAgICByZXN1bHQuaXNpT1MgPSBhZ2VudC5pbmRleE9mKCdpcGhvbmUnKSA+IC0xIHx8IHVhLmluZGV4T2YoJ2lwYWQnKSA+IC0xIHx8IHVhLmluZGV4T2YoJ21hY2ludG9zaCcpID4gLTEgJiYgJ29udG91Y2hlbmQnIGluIGRvY3VtZW50O1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSk7XG59KTtcbiIsIi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vICBFeHRlbnNpb24gcGhpbmEuZGlzcGxheS5EaXNwbGF5RWxlbWVudFxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxucGhpbmEubmFtZXNwYWNlKCgpID0+IHtcbiAgcGhpbmEuZGlzcGxheS5EaXNwbGF5RWxlbWVudC5wcm90b3R5cGUuJG1ldGhvZChcImVuYWJsZVwiLCBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnNob3coKS53YWtlVXAoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSk7XG5cbiAgcGhpbmEuZGlzcGxheS5EaXNwbGF5RWxlbWVudC5wcm90b3R5cGUuJG1ldGhvZChcImRpc2FibGVcIiwgZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5oaWRlKCkuc2xlZXAoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSk7XG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZSgoKSA9PiB7XG4gIHBoaW5hLmRpc3BsYXkuRGlzcGxheVNjZW5lLnF1YWxpdHkgPSAxLjA7XG4gIHBoaW5hLmRpc3BsYXkuRGlzcGxheVNjZW5lLnByb3RvdHlwZS4kbWV0aG9kKFwiaW5pdFwiLCBmdW5jdGlvbihwYXJhbXMpIHtcbiAgICB0aGlzLnN1cGVySW5pdCgpO1xuICAgIHZhciBxdWFsaXR5ID0gcGhpbmEuZGlzcGxheS5EaXNwbGF5U2NlbmUucXVhbGl0eTtcblxuICAgIHBhcmFtcyA9ICh7fSkuJHNhZmUocGFyYW1zLCBwaGluYS5kaXNwbGF5LkRpc3BsYXlTY2VuZS5kZWZhdWx0cyk7XG4gICAgdGhpcy5jYW52YXMgPSBwaGluYS5ncmFwaGljcy5DYW52YXMoKTtcbiAgICB0aGlzLmNhbnZhcy5zZXRTaXplKHBhcmFtcy53aWR0aCAqIHF1YWxpdHksIHBhcmFtcy5oZWlnaHQgKiBxdWFsaXR5KTtcbiAgICB0aGlzLnJlbmRlcmVyID0gcGhpbmEuZGlzcGxheS5DYW52YXNSZW5kZXJlcih0aGlzLmNhbnZhcyk7XG4gICAgdGhpcy5iYWNrZ3JvdW5kQ29sb3IgPSAocGFyYW1zLmJhY2tncm91bmRDb2xvcikgPyBwYXJhbXMuYmFja2dyb3VuZENvbG9yIDogbnVsbDtcblxuICAgIHRoaXMud2lkdGggPSBwYXJhbXMud2lkdGg7XG4gICAgdGhpcy5oZWlnaHQgPSBwYXJhbXMuaGVpZ2h0O1xuICAgIHRoaXMuZ3JpZFggPSBwaGluYS51dGlsLkdyaWQocGFyYW1zLndpZHRoLCAxNik7XG4gICAgdGhpcy5ncmlkWSA9IHBoaW5hLnV0aWwuR3JpZChwYXJhbXMuaGVpZ2h0LCAxNik7XG5cbiAgICB0aGlzLmludGVyYWN0aXZlID0gdHJ1ZTtcbiAgICB0aGlzLnNldEludGVyYWN0aXZlID0gZnVuY3Rpb24oZmxhZykge1xuICAgICAgdGhpcy5pbnRlcmFjdGl2ZSA9IGZsYWc7XG4gICAgfTtcbiAgICB0aGlzLl9vdmVyRmxhZ3MgPSB7fTtcbiAgICB0aGlzLl90b3VjaEZsYWdzID0ge307XG4gIH0pO1xuXG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcclxuXHJcbiAgLy8gYXVkaW/opoHntKDjgafpn7Plo7DjgpLlho3nlJ/jgZnjgovjgILkuLvjgatJReeUqFxyXG4gIHBoaW5hLmRlZmluZShcInBoaW5hLmFzc2V0LkRvbUF1ZGlvU291bmRcIiwge1xyXG4gICAgc3VwZXJDbGFzczogXCJwaGluYS5hc3NldC5Bc3NldFwiLFxyXG5cclxuICAgIGRvbUVsZW1lbnQ6IG51bGwsXHJcbiAgICBlbXB0eVNvdW5kOiBmYWxzZSxcclxuXHJcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcclxuICAgICAgdGhpcy5zdXBlckluaXQoKTtcclxuICAgIH0sXHJcblxyXG4gICAgX2xvYWQ6IGZ1bmN0aW9uKHJlc29sdmUpIHtcclxuICAgICAgdGhpcy5kb21FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImF1ZGlvXCIpO1xyXG4gICAgICBpZiAodGhpcy5kb21FbGVtZW50LmNhblBsYXlUeXBlKFwiYXVkaW8vbXBlZ1wiKSkge1xyXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gcmVhZHlzdGF0ZUNoZWNrKCkge1xyXG4gICAgICAgICAgaWYgKHRoaXMuZG9tRWxlbWVudC5yZWFkeVN0YXRlIDwgNCkge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KHJlYWR5c3RhdGVDaGVjay5iaW5kKHRoaXMpLCAxMCk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmVtcHR5U291bmQgPSBmYWxzZTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJlbmQgbG9hZCBcIiwgdGhpcy5zcmMpO1xyXG4gICAgICAgICAgICByZXNvbHZlKHRoaXMpXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpLCAxMCk7XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50Lm9uZXJyb3IgPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwi44Kq44O844OH44Kj44Kq44Gu44Ot44O844OJ44Gr5aSx5pWXXCIsIGUpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50LnNyYyA9IHRoaXMuc3JjO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiYmVnaW4gbG9hZCBcIiwgdGhpcy5zcmMpO1xyXG4gICAgICAgIHRoaXMuZG9tRWxlbWVudC5sb2FkKCk7XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50LmF1dG9wbGF5ID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJlbmRlZFwiLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIHRoaXMuZmxhcmUoXCJlbmRlZFwiKTtcclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwibXAz44Gv5YaN55Sf44Gn44GN44G+44Gb44KTXCIpO1xyXG4gICAgICAgIHRoaXMuZW1wdHlTb3VuZCA9IHRydWU7XHJcbiAgICAgICAgcmVzb2x2ZSh0aGlzKTtcclxuICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBwbGF5OiBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKHRoaXMuZW1wdHlTb3VuZCkgcmV0dXJuO1xyXG4gICAgICB0aGlzLmRvbUVsZW1lbnQucGF1c2UoKTtcclxuICAgICAgdGhpcy5kb21FbGVtZW50LmN1cnJlbnRUaW1lID0gMDtcclxuICAgICAgdGhpcy5kb21FbGVtZW50LnBsYXkoKTtcclxuICAgIH0sXHJcblxyXG4gICAgc3RvcDogZnVuY3Rpb24oKSB7XHJcbiAgICAgIGlmICh0aGlzLmVtcHR5U291bmQpIHJldHVybjtcclxuICAgICAgdGhpcy5kb21FbGVtZW50LnBhdXNlKCk7XHJcbiAgICAgIHRoaXMuZG9tRWxlbWVudC5jdXJyZW50VGltZSA9IDA7XHJcbiAgICB9LFxyXG5cclxuICAgIHBhdXNlOiBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKHRoaXMuZW1wdHlTb3VuZCkgcmV0dXJuO1xyXG4gICAgICB0aGlzLmRvbUVsZW1lbnQucGF1c2UoKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVzdW1lOiBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKHRoaXMuZW1wdHlTb3VuZCkgcmV0dXJuO1xyXG4gICAgICB0aGlzLmRvbUVsZW1lbnQucGxheSgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBzZXRMb29wOiBmdW5jdGlvbih2KSB7XHJcbiAgICAgIGlmICh0aGlzLmVtcHR5U291bmQpIHJldHVybjtcclxuICAgICAgdGhpcy5kb21FbGVtZW50Lmxvb3AgPSB2O1xyXG4gICAgfSxcclxuXHJcbiAgICBfYWNjZXNzb3I6IHtcclxuICAgICAgdm9sdW1lOiB7XHJcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICh0aGlzLmVtcHR5U291bmQpIHJldHVybiAwO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuZG9tRWxlbWVudC52b2x1bWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcclxuICAgICAgICAgIGlmICh0aGlzLmVtcHR5U291bmQpIHJldHVybjtcclxuICAgICAgICAgIHRoaXMuZG9tRWxlbWVudC52b2x1bWUgPSB2O1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIGxvb3A6IHtcclxuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKHRoaXMuZW1wdHlTb3VuZCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuZG9tRWxlbWVudC5sb29wO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XHJcbiAgICAgICAgICBpZiAodGhpcy5lbXB0eVNvdW5kKSByZXR1cm47XHJcbiAgICAgICAgICB0aGlzLnNldExvb3Aodik7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuXHJcbiAgICB9LFxyXG4gIH0pO1xyXG5cclxuICAvLyBJRTEx44Gu5aC05ZCI44Gu44G/6Z+z5aOw44Ki44K744OD44OI44GvRG9tQXVkaW9Tb3VuZOOBp+WGjeeUn+OBmeOCi1xyXG4gIHZhciB1YSA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7XHJcbiAgaWYgKHVhLmluZGV4T2YoJ3RyaWRlbnQvNycpICE9PSAtMSkge1xyXG4gICAgcGhpbmEuYXNzZXQuQXNzZXRMb2FkZXIucmVnaXN0ZXIoXCJzb3VuZFwiLCBmdW5jdGlvbihrZXksIHBhdGgpIHtcclxuICAgICAgdmFyIGFzc2V0ID0gcGhpbmEuYXNzZXQuRG9tQXVkaW9Tb3VuZCgpO1xyXG4gICAgICByZXR1cm4gYXNzZXQubG9hZChwYXRoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbn0pO1xyXG4iLCJwaGluYS5uYW1lc3BhY2UoKCkgPT4ge1xuXG4gIHBoaW5hLmFwcC5FbGVtZW50LnByb3RvdHlwZS4kbWV0aG9kKFwiZmluZEJ5SWRcIiwgZnVuY3Rpb24oaWQpIHtcbiAgICBpZiAodGhpcy5pZCA9PT0gaWQpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRoaXMuY2hpbGRyZW5baV0uZmluZEJ5SWQoaWQpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuY2hpbGRyZW5baV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfSk7XG5cbiAgLy/mjIflrprjgZXjgozjgZ/lrZDjgqrjg5bjgrjjgqfjgq/jg4jjgpLmnIDliY3pnaLjgavnp7vli5XjgZnjgotcbiAgcGhpbmEuYXBwLkVsZW1lbnQucHJvdG90eXBlLiRtZXRob2QoXCJtb3ZlRnJvbnRcIiwgZnVuY3Rpb24oY2hpbGQpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLmNoaWxkcmVuW2ldID09IGNoaWxkKSB7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4uc3BsaWNlKGksIDEpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jaGlsZHJlbi5wdXNoKGNoaWxkKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSk7XG5cbiAgcGhpbmEuYXBwLkVsZW1lbnQucHJvdG90eXBlLiRtZXRob2QoXCJkZXN0cm95Q2hpbGRcIiwgZnVuY3Rpb24oKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLmNoaWxkcmVuW2ldLmZsYXJlKCdkZXN0cm95Jyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9KTtcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoKCkgPT4ge1xuXG4gIHBoaW5hLmlucHV0LklucHV0LnF1YWxpdHkgPSAxLjA7XG5cbiAgcGhpbmEuaW5wdXQuSW5wdXQucHJvdG90eXBlLiRtZXRob2QoXCJfbW92ZVwiLCBmdW5jdGlvbih4LCB5KSB7XG4gICAgdGhpcy5fdGVtcFBvc2l0aW9uLnggPSB4O1xuICAgIHRoaXMuX3RlbXBQb3NpdGlvbi55ID0geTtcblxuICAgIC8vIGFkanVzdCBzY2FsZVxuICAgIHZhciBlbG0gPSB0aGlzLmRvbUVsZW1lbnQ7XG4gICAgdmFyIHJlY3QgPSBlbG0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICB2YXIgdyA9IGVsbS53aWR0aCAvIHBoaW5hLmlucHV0LklucHV0LnF1YWxpdHk7XG4gICAgdmFyIGggPSBlbG0uaGVpZ2h0IC8gcGhpbmEuaW5wdXQuSW5wdXQucXVhbGl0eTtcblxuICAgIGlmIChyZWN0LndpZHRoKSB7XG4gICAgICB0aGlzLl90ZW1wUG9zaXRpb24ueCAqPSB3IC8gcmVjdC53aWR0aDtcbiAgICB9XG5cbiAgICBpZiAocmVjdC5oZWlnaHQpIHtcbiAgICAgIHRoaXMuX3RlbXBQb3NpdGlvbi55ICo9IGggLyByZWN0LmhlaWdodDtcbiAgICB9XG5cbiAgfSk7XG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKCgpID0+IHtcbiAgcGhpbmEuZGlzcGxheS5MYWJlbC5wcm90b3R5cGUuJG1ldGhvZChcImluaXRcIiwgZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2YgYXJndW1lbnRzWzBdICE9PSAnb2JqZWN0Jykge1xuICAgICAgb3B0aW9ucyA9IHsgdGV4dDogYXJndW1lbnRzWzBdLCB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gYXJndW1lbnRzWzBdO1xuICAgIH1cblxuICAgIG9wdGlvbnMgPSAoe30pLiRzYWZlKG9wdGlvbnMsIHBoaW5hLmRpc3BsYXkuTGFiZWwuZGVmYXVsdHMpO1xuICAgIHRoaXMuc3VwZXJJbml0KG9wdGlvbnMpO1xuXG4gICAgdGhpcy50ZXh0ID0gKG9wdGlvbnMudGV4dCkgPyBvcHRpb25zLnRleHQgOiBcIlwiO1xuICAgIHRoaXMuZm9udFNpemUgPSBvcHRpb25zLmZvbnRTaXplO1xuICAgIHRoaXMuZm9udFdlaWdodCA9IG9wdGlvbnMuZm9udFdlaWdodDtcbiAgICB0aGlzLmZvbnRGYW1pbHkgPSBvcHRpb25zLmZvbnRGYW1pbHk7XG4gICAgdGhpcy5hbGlnbiA9IG9wdGlvbnMuYWxpZ247XG4gICAgdGhpcy5iYXNlbGluZSA9IG9wdGlvbnMuYmFzZWxpbmU7XG4gICAgdGhpcy5saW5lSGVpZ2h0ID0gb3B0aW9ucy5saW5lSGVpZ2h0O1xuICB9KTtcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoKCkgPT4ge1xuICBwaGluYS5pbnB1dC5Nb3VzZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKGRvbUVsZW1lbnQpIHtcbiAgICB0aGlzLnN1cGVySW5pdChkb21FbGVtZW50KTtcblxuICAgIHRoaXMuaWQgPSAwO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBmdW5jdGlvbihlKSB7XG4gICAgICBzZWxmLl9zdGFydChlLnBvaW50WCwgZS5wb2ludFksIDEgPDwgZS5idXR0b24pO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB9KTtcblxuICAgIHRoaXMuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgZnVuY3Rpb24oZSkge1xuICAgICAgc2VsZi5fZW5kKDEgPDwgZS5idXR0b24pO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB9KTtcbiAgICB0aGlzLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgZnVuY3Rpb24oZSkge1xuICAgICAgc2VsZi5fbW92ZShlLnBvaW50WCwgZS5wb2ludFkpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB9KTtcblxuICAgIC8vIOODnuOCpuOCueOBjOOCreODo+ODs+ODkOOCueimgee0oOOBruWkluOBq+WHuuOBn+WgtOWQiOOBruWvvuW/nFxuICAgIHRoaXMuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW91dCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIHNlbGYuX2VuZCgxKTtcbiAgICB9KTtcbiAgfVxufSk7XG4iLCIvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyAgRXh0ZW5zaW9uIHBoaW5hLmFwcC5PYmplY3QyRFxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5waGluYS5uYW1lc3BhY2UoKCkgPT4ge1xuICBwaGluYS5hcHAuT2JqZWN0MkQucHJvdG90eXBlLiRtZXRob2QoXCJzZXRPcmlnaW5cIiwgZnVuY3Rpb24oeCwgeSwgcmVwb3NpdGlvbikge1xuICAgIGlmICghcmVwb3NpdGlvbikge1xuICAgICAgdGhpcy5vcmlnaW4ueCA9IHg7XG4gICAgICB0aGlzLm9yaWdpbi55ID0geTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8v5aSJ5pu044GV44KM44Gf5Z+65rqW54K544Gr56e75YuV44GV44Gb44KLXG4gICAgY29uc3QgX29yaWdpblggPSB0aGlzLm9yaWdpblg7XG4gICAgY29uc3QgX29yaWdpblkgPSB0aGlzLm9yaWdpblk7XG4gICAgY29uc3QgX2FkZFggPSAoeCAtIF9vcmlnaW5YKSAqIHRoaXMud2lkdGg7XG4gICAgY29uc3QgX2FkZFkgPSAoeSAtIF9vcmlnaW5ZKSAqIHRoaXMuaGVpZ2h0O1xuXG4gICAgdGhpcy54ICs9IF9hZGRYO1xuICAgIHRoaXMueSArPSBfYWRkWTtcbiAgICB0aGlzLm9yaWdpblggPSB4O1xuICAgIHRoaXMub3JpZ2luWSA9IHk7XG5cbiAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xuICAgICAgY2hpbGQueCAtPSBfYWRkWDtcbiAgICAgIGNoaWxkLnkgLT0gX2FkZFk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0pO1xuXG4gIHBoaW5hLmFwcC5PYmplY3QyRC5wcm90b3R5cGUuJG1ldGhvZChcImhpdFRlc3RFbGVtZW50XCIsIGZ1bmN0aW9uKGVsbSkge1xuICAgIGNvbnN0IHJlY3QwID0gdGhpcy5jYWxjR2xvYmFsUmVjdCgpO1xuICAgIGNvbnN0IHJlY3QxID0gZWxtLmNhbGNHbG9iYWxSZWN0KCk7XG4gICAgcmV0dXJuIChyZWN0MC5sZWZ0IDwgcmVjdDEucmlnaHQpICYmIChyZWN0MC5yaWdodCA+IHJlY3QxLmxlZnQpICYmXG4gICAgICAocmVjdDAudG9wIDwgcmVjdDEuYm90dG9tKSAmJiAocmVjdDAuYm90dG9tID4gcmVjdDEudG9wKTtcbiAgfSk7XG5cbiAgcGhpbmEuYXBwLk9iamVjdDJELnByb3RvdHlwZS4kbWV0aG9kKFwiaW5jbHVkZUVsZW1lbnRcIiwgZnVuY3Rpb24oZWxtKSB7XG4gICAgY29uc3QgcmVjdDAgPSB0aGlzLmNhbGNHbG9iYWxSZWN0KCk7XG4gICAgY29uc3QgcmVjdDEgPSBlbG0uY2FsY0dsb2JhbFJlY3QoKTtcbiAgICByZXR1cm4gKHJlY3QwLmxlZnQgPD0gcmVjdDEubGVmdCkgJiYgKHJlY3QwLnJpZ2h0ID49IHJlY3QxLnJpZ2h0KSAmJlxuICAgICAgKHJlY3QwLnRvcCA8PSByZWN0MS50b3ApICYmIChyZWN0MC5ib3R0b20gPj0gcmVjdDEuYm90dG9tKTtcbiAgfSk7XG5cbiAgcGhpbmEuYXBwLk9iamVjdDJELnByb3RvdHlwZS4kbWV0aG9kKFwiY2FsY0dsb2JhbFJlY3RcIiwgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbGVmdCA9IHRoaXMuX3dvcmxkTWF0cml4Lm0wMiAtIHRoaXMub3JpZ2luWCAqIHRoaXMud2lkdGg7XG4gICAgY29uc3QgdG9wID0gdGhpcy5fd29ybGRNYXRyaXgubTEyIC0gdGhpcy5vcmlnaW5ZICogdGhpcy5oZWlnaHQ7XG4gICAgcmV0dXJuIFJlY3QobGVmdCwgdG9wLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gIH0pO1xuXG4gIHBoaW5hLmFwcC5PYmplY3QyRC5wcm90b3R5cGUuJG1ldGhvZChcImNhbGNHbG9iYWxSZWN0XCIsIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGxlZnQgPSB0aGlzLl93b3JsZE1hdHJpeC5tMDIgLSB0aGlzLm9yaWdpblggKiB0aGlzLndpZHRoO1xuICAgIGNvbnN0IHRvcCA9IHRoaXMuX3dvcmxkTWF0cml4Lm0xMiAtIHRoaXMub3JpZ2luWSAqIHRoaXMuaGVpZ2h0O1xuICAgIHJldHVybiBSZWN0KGxlZnQsIHRvcCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuICB9KTtcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuZGlzcGxheS5QbGFpbkVsZW1lbnQucHJvdG90eXBlLiRtZXRob2QoXCJkZXN0cm95Q2FudmFzXCIsIGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5jYW52YXMpIHJldHVybjtcbiAgICB0aGlzLmNhbnZhcy5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuY2FudmFzO1xuICB9KTtcblxufSk7XG4iLCIvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyAgRXh0ZW5zaW9uIHBoaW5hLmRpc3BsYXkuU2hhcGVcbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbnBoaW5hLmRpc3BsYXkuU2hhcGUucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKGNhbnZhcykge1xuICBpZiAoIWNhbnZhcykge1xuICAgIGNvbnNvbGUubG9nKFwiY2FudmFzIG51bGxcIik7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBjb250ZXh0ID0gY2FudmFzLmNvbnRleHQ7XG4gIC8vIOODquOCteOCpOOCulxuICB2YXIgc2l6ZSA9IHRoaXMuY2FsY0NhbnZhc1NpemUoKTtcbiAgY2FudmFzLnNldFNpemUoc2l6ZS53aWR0aCwgc2l6ZS5oZWlnaHQpO1xuICAvLyDjgq/jg6rjgqLjgqvjg6njg7xcbiAgY2FudmFzLmNsZWFyQ29sb3IodGhpcy5iYWNrZ3JvdW5kQ29sb3IpO1xuICAvLyDkuK3lv4PjgavluqfmqJnjgpLnp7vli5VcbiAgY2FudmFzLnRyYW5zZm9ybUNlbnRlcigpO1xuXG4gIC8vIOaPj+eUu+WJjeWHpueQhlxuICB0aGlzLnByZXJlbmRlcih0aGlzLmNhbnZhcyk7XG5cbiAgLy8g44K544OI44Ot44O844Kv5o+P55S7XG4gIGlmICh0aGlzLmlzU3Ryb2thYmxlKCkpIHtcbiAgICBjb250ZXh0LnN0cm9rZVN0eWxlID0gdGhpcy5zdHJva2U7XG4gICAgY29udGV4dC5saW5lV2lkdGggPSB0aGlzLnN0cm9rZVdpZHRoO1xuICAgIGNvbnRleHQubGluZUpvaW4gPSBcInJvdW5kXCI7XG4gICAgY29udGV4dC5zaGFkb3dCbHVyID0gMDtcbiAgICB0aGlzLnJlbmRlclN0cm9rZShjYW52YXMpO1xuICB9XG5cbiAgLy8g5aGX44KK44Gk44G244GX5o+P55S7XG4gIGlmICh0aGlzLmZpbGwpIHtcbiAgICBjb250ZXh0LmZpbGxTdHlsZSA9IHRoaXMuZmlsbDtcbiAgICAvLyBzaGFkb3cg44GuIG9uL29mZlxuICAgIGlmICh0aGlzLnNoYWRvdykge1xuICAgICAgY29udGV4dC5zaGFkb3dDb2xvciA9IHRoaXMuc2hhZG93O1xuICAgICAgY29udGV4dC5zaGFkb3dCbHVyID0gdGhpcy5zaGFkb3dCbHVyO1xuICAgICAgY29udGV4dC5zaGFkb3dPZmZzZXRYID0gdGhpcy5zaGFkb3dPZmZzZXRYIHx8IDA7XG4gICAgICBjb250ZXh0LnNoYWRvd09mZnNldFkgPSB0aGlzLnNoYWRvd09mZnNldFkgfHwgMDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5zaGFkb3dCbHVyID0gMDtcbiAgICB9XG4gICAgdGhpcy5yZW5kZXJGaWxsKGNhbnZhcyk7XG4gIH1cblxuICAvLyDmj4/nlLvlvozlh6bnkIZcbiAgdGhpcy5wb3N0cmVuZGVyKHRoaXMuY2FudmFzKTtcblxuICByZXR1cm4gdGhpcztcbn07XG4iLCJwaGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuYXNzZXQuU291bmQucHJvdG90eXBlLiRtZXRob2QoXCJfbG9hZFwiLCBmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgaWYgKC9eZGF0YTovLnRlc3QodGhpcy5zcmMpKSB7XG4gICAgICB0aGlzLl9sb2FkRnJvbVVSSVNjaGVtZShyZXNvbHZlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbG9hZEZyb21GaWxlKHJlc29sdmUpO1xuICAgIH1cbiAgfSk7XG5cbiAgcGhpbmEuYXNzZXQuU291bmQucHJvdG90eXBlLiRtZXRob2QoXCJfbG9hZEZyb21GaWxlXCIsIGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICAvLyBjb25zb2xlLmxvZyh0aGlzLnNyYyk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciB4bWwgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4bWwub3BlbignR0VUJywgdGhpcy5zcmMpO1xuICAgIHhtbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh4bWwucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICBpZiAoWzIwMCwgMjAxLCAwXS5pbmRleE9mKHhtbC5zdGF0dXMpICE9PSAtMSkge1xuICAgICAgICAgIC8vIOmfs+alveODkOOCpOODiuODquODvOODh+ODvOOCv1xuICAgICAgICAgIHZhciBkYXRhID0geG1sLnJlc3BvbnNlO1xuICAgICAgICAgIC8vIHdlYmF1ZGlvIOeUqOOBq+WkieaPm1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGRhdGEpXG4gICAgICAgICAgc2VsZi5jb250ZXh0LmRlY29kZUF1ZGlvRGF0YShkYXRhLCBmdW5jdGlvbihidWZmZXIpIHtcbiAgICAgICAgICAgIHNlbGYubG9hZEZyb21CdWZmZXIoYnVmZmVyKTtcbiAgICAgICAgICAgIHJlc29sdmUoc2VsZik7XG4gICAgICAgICAgfSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCLpn7Plo7Djg5XjgqHjgqTjg6vjga7jg4fjgrPjg7zjg4njgavlpLHmlZfjgZfjgb7jgZfjgZ/jgIIoXCIgKyBzZWxmLnNyYyArIFwiKVwiKTtcbiAgICAgICAgICAgIHJlc29sdmUoc2VsZik7XG4gICAgICAgICAgICBzZWxmLmZsYXJlKCdkZWNvZGVlcnJvcicpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKHhtbC5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICAgIC8vIG5vdCBmb3VuZFxuICAgICAgICAgIHNlbGYubG9hZEVycm9yID0gdHJ1ZTtcbiAgICAgICAgICBzZWxmLm5vdEZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICByZXNvbHZlKHNlbGYpO1xuICAgICAgICAgIHNlbGYuZmxhcmUoJ2xvYWRlcnJvcicpO1xuICAgICAgICAgIHNlbGYuZmxhcmUoJ25vdGZvdW5kJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8g44K144O844OQ44O844Ko44Op44O8XG4gICAgICAgICAgc2VsZi5sb2FkRXJyb3IgPSB0cnVlO1xuICAgICAgICAgIHNlbGYuc2VydmVyRXJyb3IgPSB0cnVlO1xuICAgICAgICAgIHJlc29sdmUoc2VsZik7XG4gICAgICAgICAgc2VsZi5mbGFyZSgnbG9hZGVycm9yJyk7XG4gICAgICAgICAgc2VsZi5mbGFyZSgnc2VydmVyZXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgICB4bWwub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgeG1sLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cbiAgICB4bWwuc2VuZChudWxsKTtcbiAgfSk7XG5cbiAgcGhpbmEuYXNzZXQuU291bmQucHJvdG90eXBlLiRtZXRob2QoXCJwbGF5XCIsIGZ1bmN0aW9uKHdoZW4sIG9mZnNldCwgZHVyYXRpb24pIHtcbiAgICB3aGVuID0gd2hlbiA/IHdoZW4gKyB0aGlzLmNvbnRleHQuY3VycmVudFRpbWUgOiAwO1xuICAgIG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXG4gICAgdmFyIHNvdXJjZSA9IHRoaXMuc291cmNlID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgIHZhciBidWZmZXIgPSBzb3VyY2UuYnVmZmVyID0gdGhpcy5idWZmZXI7XG4gICAgc291cmNlLmxvb3AgPSB0aGlzLl9sb29wO1xuICAgIHNvdXJjZS5sb29wU3RhcnQgPSB0aGlzLl9sb29wU3RhcnQ7XG4gICAgc291cmNlLmxvb3BFbmQgPSB0aGlzLl9sb29wRW5kO1xuICAgIHNvdXJjZS5wbGF5YmFja1JhdGUudmFsdWUgPSB0aGlzLl9wbGF5YmFja1JhdGU7XG5cbiAgICAvLyBjb25uZWN0XG4gICAgc291cmNlLmNvbm5lY3QodGhpcy5nYWluTm9kZSk7XG4gICAgdGhpcy5nYWluTm9kZS5jb25uZWN0KHBoaW5hLmFzc2V0LlNvdW5kLmdldE1hc3RlckdhaW4oKSk7XG4gICAgLy8gcGxheVxuICAgIGlmIChkdXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBzb3VyY2Uuc3RhcnQod2hlbiwgb2Zmc2V0LCBkdXJhdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNvdXJjZS5zdGFydCh3aGVuLCBvZmZzZXQpO1xuICAgIH1cblxuICAgIHNvdXJjZS5vbmVuZGVkID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgICB0aGlzLmZsYXJlKCdlbmRlZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzb3VyY2Uub25lbmRlZCA9IG51bGw7XG4gICAgICBzb3VyY2UuZGlzY29ubmVjdCgpO1xuICAgICAgc291cmNlLmJ1ZmZlciA9IG51bGw7XG4gICAgICBzb3VyY2UgPSBudWxsO1xuICAgICAgdGhpcy5mbGFyZSgnZW5kZWQnKTtcbiAgICB9LmJpbmQodGhpcyk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSk7XG5cbiAgcGhpbmEuYXNzZXQuU291bmQucHJvdG90eXBlLiRtZXRob2QoXCJzdG9wXCIsIGZ1bmN0aW9uKCkge1xuICAgIC8vIHN0b3BcbiAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgIC8vIHN0b3Ag44GZ44KL44GoIHNvdXJjZS5lbmRlZOOCgueZuueBq+OBmeOCi1xuICAgICAgdGhpcy5zb3VyY2Uuc3RvcCAmJiB0aGlzLnNvdXJjZS5zdG9wKDApO1xuICAgICAgdGhpcy5mbGFyZSgnc3RvcCcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9KTtcblxufSk7XG4iLCIvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyAgRXh0ZW5zaW9uIHBoaW5hLmFzc2V0LlNvdW5kTWFuYWdlclxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuU291bmRNYW5hZ2VyLiRtZXRob2QoXCJnZXRWb2x1bWVcIiwgZnVuY3Rpb24oKSB7XG4gIHJldHVybiAhdGhpcy5pc011dGUoKSA/IHRoaXMudm9sdW1lIDogMDtcbn0pO1xuXG5Tb3VuZE1hbmFnZXIuJG1ldGhvZChcImdldFZvbHVtZU11c2ljXCIsIGZ1bmN0aW9uKCkge1xuICByZXR1cm4gIXRoaXMuaXNNdXRlKCkgPyB0aGlzLm11c2ljVm9sdW1lIDogMDtcbn0pO1xuXG5Tb3VuZE1hbmFnZXIuJG1ldGhvZChcInNldFZvbHVtZU11c2ljXCIsIGZ1bmN0aW9uKHZvbHVtZSkge1xuICB0aGlzLm11c2ljVm9sdW1lID0gdm9sdW1lO1xuICBpZiAoIXRoaXMuaXNNdXRlKCkgJiYgdGhpcy5jdXJyZW50TXVzaWMpIHtcbiAgICB0aGlzLmN1cnJlbnRNdXNpYy52b2x1bWUgPSB2b2x1bWU7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59KTtcblxuU291bmRNYW5hZ2VyLiRtZXRob2QoXCJwbGF5TXVzaWNcIiwgZnVuY3Rpb24obmFtZSwgZmFkZVRpbWUsIGxvb3AsIHdoZW4sIG9mZnNldCwgZHVyYXRpb24pIHtcbiAgLy8gY29uc3QgcmVzID0gcGhpbmEuY2hlY2tCcm93c2VyKCk7XG4gIC8vIGlmIChyZXMuaXNJZTExKSByZXR1cm4gbnVsbDtcblxuICBsb29wID0gKGxvb3AgIT09IHVuZGVmaW5lZCkgPyBsb29wIDogdHJ1ZTtcblxuICBpZiAodGhpcy5jdXJyZW50TXVzaWMpIHtcbiAgICB0aGlzLnN0b3BNdXNpYyhmYWRlVGltZSk7XG4gIH1cblxuICB2YXIgbXVzaWMgPSBudWxsO1xuICBpZiAobmFtZSBpbnN0YW5jZW9mIHBoaW5hLmFzc2V0LlNvdW5kIHx8IG5hbWUgaW5zdGFuY2VvZiBwaGluYS5hc3NldC5Eb21BdWRpb1NvdW5kKSB7XG4gICAgbXVzaWMgPSBuYW1lO1xuICB9IGVsc2Uge1xuICAgIG11c2ljID0gcGhpbmEuYXNzZXQuQXNzZXRNYW5hZ2VyLmdldCgnc291bmQnLCBuYW1lKTtcbiAgfVxuXG4gIGlmICghbXVzaWMpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiU291bmQgbm90IGZvdW5kOiBcIiwgbmFtZSk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBtdXNpYy5zZXRMb29wKGxvb3ApO1xuICBtdXNpYy5wbGF5KHdoZW4sIG9mZnNldCwgZHVyYXRpb24pO1xuXG4gIGlmIChmYWRlVGltZSA+IDApIHtcbiAgICB2YXIgY291bnQgPSAzMjtcbiAgICB2YXIgY291bnRlciA9IDA7XG4gICAgdmFyIHVuaXRUaW1lID0gZmFkZVRpbWUgLyBjb3VudDtcbiAgICB2YXIgdm9sdW1lID0gdGhpcy5nZXRWb2x1bWVNdXNpYygpO1xuXG4gICAgbXVzaWMudm9sdW1lID0gMDtcbiAgICB2YXIgaWQgPSBzZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcbiAgICAgIGNvdW50ZXIgKz0gMTtcbiAgICAgIHZhciByYXRlID0gY291bnRlciAvIGNvdW50O1xuICAgICAgbXVzaWMudm9sdW1lID0gcmF0ZSAqIHZvbHVtZTtcblxuICAgICAgaWYgKHJhdGUgPj0gMSkge1xuICAgICAgICBjbGVhckludGVydmFsKGlkKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LCB1bml0VGltZSk7XG4gIH0gZWxzZSB7XG4gICAgbXVzaWMudm9sdW1lID0gdGhpcy5nZXRWb2x1bWVNdXNpYygpO1xuICB9XG5cbiAgdGhpcy5jdXJyZW50TXVzaWMgPSBtdXNpYztcblxuICByZXR1cm4gdGhpcy5jdXJyZW50TXVzaWM7XG59KTtcblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g44Oc44Kk44K555So44Gu6Z+z6YeP6Kit5a6a44CB5YaN55Sf44Oh44K944OD44OJ5ouh5by1XG5Tb3VuZE1hbmFnZXIuJG1ldGhvZChcImdldFZvbHVtZVZvaWNlXCIsIGZ1bmN0aW9uKCkge1xuICByZXR1cm4gIXRoaXMuaXNNdXRlKCkgPyB0aGlzLnZvaWNlVm9sdW1lIDogMDtcbn0pO1xuXG5Tb3VuZE1hbmFnZXIuJG1ldGhvZChcInNldFZvbHVtZVZvaWNlXCIsIGZ1bmN0aW9uKHZvbHVtZSkge1xuICB0aGlzLnZvaWNlVm9sdW1lID0gdm9sdW1lO1xuICByZXR1cm4gdGhpcztcbn0pO1xuXG5Tb3VuZE1hbmFnZXIuJG1ldGhvZChcInBsYXlWb2ljZVwiLCBmdW5jdGlvbihuYW1lKSB7XG4gIHZhciBzb3VuZCA9IHBoaW5hLmFzc2V0LkFzc2V0TWFuYWdlci5nZXQoJ3NvdW5kJywgbmFtZSk7XG4gIHNvdW5kLnZvbHVtZSA9IHRoaXMuZ2V0Vm9sdW1lVm9pY2UoKTtcbiAgc291bmQucGxheSgpO1xuICByZXR1cm4gc291bmQ7XG59KTtcbiIsIi8v44K544OX44Op44Kk44OI5qmf6IO95ouh5by1XG5waGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuZGlzcGxheS5TcHJpdGUucHJvdG90eXBlLnNldEZyYW1lVHJpbW1pbmcgPSBmdW5jdGlvbih4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgdGhpcy5fZnJhbWVUcmltWCA9IHggfHwgMDtcbiAgICB0aGlzLl9mcmFtZVRyaW1ZID0geSB8fCAwO1xuICAgIHRoaXMuX2ZyYW1lVHJpbVdpZHRoID0gd2lkdGggfHwgdGhpcy5pbWFnZS5kb21FbGVtZW50LndpZHRoIC0gdGhpcy5fZnJhbWVUcmltWDtcbiAgICB0aGlzLl9mcmFtZVRyaW1IZWlnaHQgPSBoZWlnaHQgfHwgdGhpcy5pbWFnZS5kb21FbGVtZW50LmhlaWdodCAtIHRoaXMuX2ZyYW1lVHJpbVk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwaGluYS5kaXNwbGF5LlNwcml0ZS5wcm90b3R5cGUuc2V0RnJhbWVJbmRleCA9IGZ1bmN0aW9uKGluZGV4LCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgdmFyIHN4ID0gdGhpcy5fZnJhbWVUcmltWCB8fCAwO1xuICAgIHZhciBzeSA9IHRoaXMuX2ZyYW1lVHJpbVkgfHwgMDtcbiAgICB2YXIgc3cgPSB0aGlzLl9mcmFtZVRyaW1XaWR0aCAgfHwgKHRoaXMuaW1hZ2UuZG9tRWxlbWVudC53aWR0aC1zeCk7XG4gICAgdmFyIHNoID0gdGhpcy5fZnJhbWVUcmltSGVpZ2h0IHx8ICh0aGlzLmltYWdlLmRvbUVsZW1lbnQuaGVpZ2h0LXN5KTtcblxuICAgIHZhciB0dyAgPSB3aWR0aCB8fCB0aGlzLndpZHRoOyAgICAgIC8vIHR3XG4gICAgdmFyIHRoICA9IGhlaWdodCB8fCB0aGlzLmhlaWdodDsgICAgLy8gdGhcbiAgICB2YXIgcm93ID0gfn4oc3cgLyB0dyk7XG4gICAgdmFyIGNvbCA9IH5+KHNoIC8gdGgpO1xuICAgIHZhciBtYXhJbmRleCA9IHJvdypjb2w7XG4gICAgaW5kZXggPSBpbmRleCVtYXhJbmRleDtcblxuICAgIHZhciB4ICAgPSBpbmRleCVyb3c7XG4gICAgdmFyIHkgICA9IH5+KGluZGV4L3Jvdyk7XG4gICAgdGhpcy5zcmNSZWN0LnggPSBzeCt4KnR3O1xuICAgIHRoaXMuc3JjUmVjdC55ID0gc3kreSp0aDtcbiAgICB0aGlzLnNyY1JlY3Qud2lkdGggID0gdHc7XG4gICAgdGhpcy5zcmNSZWN0LmhlaWdodCA9IHRoO1xuXG4gICAgdGhpcy5fZnJhbWVJbmRleCA9IGluZGV4O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxufSk7IiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuICAvLyDmloflrZfliJfjgYvjgonmlbDlgKTjgpLmir3lh7rjgZnjgotcbiAgLy8g44Os44Kk44Ki44Km44OI44OV44Kh44Kk44Or44GL44KJ5L2c5qWt44GZ44KL5aC05ZCI44Gr5Yip55So44GX44Gf44GP44Gq44KLXG4gIC8vIGhvZ2VfMCBob2dlXzHjgarjganjgYvjgonmlbDlrZfjgaDjgZHmir3lh7pcbiAgLy8gMDEwMF9ob2dlXzk5OTkgPT4gW1wiMDEwMFwiICwgXCI5OTk5XCJd44Gr44Gq44KLXG4gIC8vIGhvZ2UwLjDjgajjgYvjga/jganjgYbjgZnjgYvjgarvvJ9cbiAgLy8g5oq95Ye65b6M44GrcGFyc2VJbnTjgZnjgovjgYvjga/mpJzoqI7kuK1cbiAgU3RyaW5nLnByb3RvdHlwZS4kbWV0aG9kKFwibWF0Y2hJbnRcIiwgZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubWF0Y2goL1swLTldKy9nKTtcbiAgfSk7XG59KTtcbiIsInBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5hc3NldC5UZXh0dXJlLnByb3RvdHlwZS4kbWV0aG9kKFwiX2xvYWRcIiwgZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgIHRoaXMuZG9tRWxlbWVudCA9IG5ldyBJbWFnZSgpO1xuXG4gICAgdmFyIGlzTG9jYWwgPSAobG9jYXRpb24ucHJvdG9jb2wgPT0gJ2ZpbGU6Jyk7XG4gICAgaWYgKCEoL15kYXRhOi8udGVzdCh0aGlzLnNyYykpKSB7XG4gICAgICB0aGlzLmRvbUVsZW1lbnQuY3Jvc3NPcmlnaW4gPSAnYW5vbnltb3VzJzsgLy8g44Kv44Ot44K544Kq44Oq44K444Oz6Kej6ZmkXG4gICAgfVxuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuZG9tRWxlbWVudC5vbmxvYWQgPSBmdW5jdGlvbihlKSB7XG4gICAgICBzZWxmLmxvYWRlZCA9IHRydWU7XG4gICAgICBlLnRhcmdldC5vbmxvYWQgPSBudWxsO1xuICAgICAgZS50YXJnZXQub25lcnJvciA9IG51bGw7XG4gICAgICByZXNvbHZlKHNlbGYpO1xuICAgIH07XG5cbiAgICB0aGlzLmRvbUVsZW1lbnQub25lcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgIGUudGFyZ2V0Lm9ubG9hZCA9IG51bGw7XG4gICAgICBlLnRhcmdldC5vbmVycm9yID0gbnVsbDtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJwaGluYS5hc3NldC5UZXh0dXJlIF9sb2FkIG9uRXJyb3IgXCIsIHRoaXMuc3JjKTtcbiAgICB9O1xuXG4gICAgdGhpcy5kb21FbGVtZW50LnNyYyA9IHRoaXMuc3JjO1xuICB9KTtcblxufSk7XG4iLCJwaGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuYWNjZXNzb3J5LlR3ZWVuZXIucHJvdG90eXBlLiRtZXRob2QoXCJfdXBkYXRlVHdlZW5cIiwgZnVuY3Rpb24oYXBwKSB7XG4gICAgLy/igLvjgZPjgozjgarjgYTjgahwYXVzZeOBjOOBhuOBlOOBi+OBquOBhFxuICAgIGlmICghdGhpcy5wbGF5aW5nKSByZXR1cm47XG5cbiAgICB2YXIgdHdlZW4gPSB0aGlzLl90d2VlbjtcbiAgICB2YXIgdGltZSA9IHRoaXMuX2dldFVuaXRUaW1lKGFwcCk7XG5cbiAgICB0d2Vlbi5mb3J3YXJkKHRpbWUpO1xuICAgIHRoaXMuZmxhcmUoJ3R3ZWVuJyk7XG5cbiAgICBpZiAodHdlZW4udGltZSA+PSB0d2Vlbi5kdXJhdGlvbikge1xuICAgICAgZGVsZXRlIHRoaXMuX3R3ZWVuO1xuICAgICAgdGhpcy5fdHdlZW4gPSBudWxsO1xuICAgICAgdGhpcy5fdXBkYXRlID0gdGhpcy5fdXBkYXRlVGFzaztcbiAgICB9XG4gIH0pO1xuXG4gIHBoaW5hLmFjY2Vzc29yeS5Ud2VlbmVyLnByb3RvdHlwZS4kbWV0aG9kKFwiX3VwZGF0ZVdhaXRcIiwgZnVuY3Rpb24oYXBwKSB7XG4gICAgLy/igLvjgZPjgozjgarjgYTjgahwYXVzZeOBjOOBhuOBlOOBi+OBquOBhFxuICAgIGlmICghdGhpcy5wbGF5aW5nKSByZXR1cm47XG5cbiAgICB2YXIgd2FpdCA9IHRoaXMuX3dhaXQ7XG4gICAgdmFyIHRpbWUgPSB0aGlzLl9nZXRVbml0VGltZShhcHApO1xuICAgIHdhaXQudGltZSArPSB0aW1lO1xuXG4gICAgaWYgKHdhaXQudGltZSA+PSB3YWl0LmxpbWl0KSB7XG4gICAgICBkZWxldGUgdGhpcy5fd2FpdDtcbiAgICAgIHRoaXMuX3dhaXQgPSBudWxsO1xuICAgICAgdGhpcy5fdXBkYXRlID0gdGhpcy5fdXBkYXRlVGFzaztcbiAgICB9XG4gIH0pO1xuXG59KTtcbiIsInBoaW5hLmRlZmluZShcIkJ1bGxldFwiLCB7XG4gIHN1cGVyQ2xhc3M6ICdwaGluYS5kaXNwbGF5LkRpc3BsYXlFbGVtZW50JyxcblxuICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdGhpcy5zdXBlckluaXQob3B0aW9ucyk7XG4gIH0sXG5cbn0pO1xuXG4iLCJwaGluYS5uYW1lc3BhY2UoZnVuY3Rpb24oKSB7XG5cbiAgcGhpbmEuZGVmaW5lKCdFbmVteXlGaWdodGVyJywge1xuICAgIHN1cGVyQ2xhc3M6ICdCYXNlVW5pdCcsXG5cbiAgICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIHRoaXMuc3VwZXJJbml0KG9wdGlvbnMuJHNhZmUoeyB3aWR0aDogMzIsIGhlaWdodDogMzIgfSkpO1xuXG4gICAgICB0aGlzLnNwcml0ZSA9IFNwcml0ZShcImZpZ2h0ZXJcIiwgMzIsIDMyKVxuICAgICAgICAuc2V0RnJhbWVJbmRleCgwKVxuICAgICAgICAuYWRkQ2hpbGRUbyh0aGlzLmJhc2UpO1xuXG4gICAgICB0aGlzLnBsYXllciA9IG9wdGlvbnMucGxheWVyO1xuICAgICAgdGhpcy52ZWxvY2l0eSA9IFZlY3RvcjIoMCwgMCk7XG4gICAgICB0aGlzLmFuZ2xlID0gMDtcbiAgICAgIHRoaXMuc3BlZWQgPSAxMDtcblxuICAgICAgdGhpcy50aW1lID0gMDtcblxuICAgICAgdGhpcy5hZnRlckJhbm5lciA9IEFmdGVyQmFubmVyKClcbiAgICAgICAgLnNldExheWVyKHRoaXMud29ybGQubWFwTGF5ZXJbTEFZRVJfRUZGRUNUX0JBQ0tdKVxuICAgICAgICAuYXR0YWNoVG8odGhpcyk7XG4gICAgfSxcblxuICAgIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICBjb25zdCB0b1BsYXllciA9IFZlY3RvcjIodGhpcy5wbGF5ZXIueCAtIHRoaXMueCAsdGhpcy5wbGF5ZXIueSAtIHRoaXMueSlcbiAgICAgIGlmICh0b1BsYXllci5sZW5ndGgoKSA+IDMwKSB7XG4gICAgICAgIC8v6Ieq5YiG44GL44KJ6KaL44Gf44OX44Os44Kk44Ok44O844Gu5pa56KeSXG4gICAgICAgIGNvbnN0IHIgPSBNYXRoLmF0YW4yKHRvUGxheWVyLnksIHRvUGxheWVyLngpO1xuICAgICAgICBsZXQgZCA9IChyLnRvRGVncmVlKCkgKyA5MCk7XG4gICAgICAgIGlmIChkIDwgMCkgZCArPSAzNjA7XG4gICAgICAgIGlmIChkID4gMzYwKSBkIC09IDM2MDtcbiAgICAgICAgdGhpcy5hbmdsZSA9IE1hdGguZmxvb3IoZCAvIDIyLjUpO1xuICAgICAgICB0aGlzLnNwcml0ZS5zZXRGcmFtZUluZGV4KHRoaXMuYW5nbGUpO1xuICAgICAgICB0aGlzLnZlbG9jaXR5LmFkZChWZWN0b3IyKE1hdGguY29zKHIpICogdGhpcy5zcGVlZCwgTWF0aC5zaW4ocikgKiB0aGlzLnNwZWVkKSk7XG4gICAgICAgIHRoaXMudmVsb2NpdHkubm9ybWFsaXplKCk7XG4gICAgICAgIHRoaXMudmVsb2NpdHkubXVsKHRoaXMuc3BlZWQpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnBvc2l0aW9uLmFkZCh0aGlzLnZlbG9jaXR5KTtcblxuICAgICAgdGhpcy50aW1lKys7XG4gICAgfSxcbiAgfSk7XG59KTtcbiIsInBoaW5hLmRlZmluZShcIkxhc2VyXCIsIHtcbiAgc3VwZXJDbGFzczogJ3BoaW5hLmRpc3BsYXkuRGlzcGxheUVsZW1lbnQnLFxuXG4gIF9zdGF0aWM6IHtcbiAgICBkZWZhdWx0T3B0aW9uczoge1xuICAgICAgbGVuZ3RoOiA1MDAsXG4gICAgfSxcbiAgfSxcblxuICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdGhpcy5vcHRpb25zID0gKG9wdGlvbnMgfHwge30pLiRzYWZlKExhc2VyLmRlZmF1bHRPcHRpb25zKTtcbiAgICB0aGlzLnN1cGVySW5pdChvcHRpb25zKTtcbiAgICB0aGlzLnNwcml0ZSA9IFJlY3RhbmdsZVNoYXBlKHsgd2lkdGg6IDgsIGhlaWdodDogdGhpcy5vcHRpb25zLmxlbmd0aCB9KS5hZGRDaGlsZFRvKHRoaXMpO1xuICB9LFxuXG59KTtcblxuIiwiY29uc3Qgb2Zmc2V0ID0gW1xuICBbIHt4OiAtMywgeTogIDB9LCB7eDogIDMsIHk6ICAwfSwgXSwgLy8gIDAg5LiKXG5cbiAgWyB7eDogLTMsIHk6ICAyfSwge3g6ICAzLCB5OiAtMn0sIF0sIC8vICAxXG4gIFsge3g6IC0zLCB5OiAgMn0sIHt4OiAgMiwgeTogIDB9LCBdLCAvLyAgMlxuICBbIHt4OiAtMywgeTogIDN9LCB7eDogIDAsIHk6IC0xfSwgXSwgLy8gIDNcblxuICBbIHt4OiAgMCwgeTogIDB9LCB7eDogIDAsIHk6ICAwfSwgXSwgLy8gIDQg5bemXG5cbiAgWyB7eDogLTMsIHk6ICAwfSwge3g6ICAzLCB5OiAgMH0sIF0sIC8vICA1XG4gIFsge3g6IC0xLCB5OiAtMn0sIHt4OiAgMiwgeTogIDJ9LCBdLCAvLyAgNlxuICBbIHt4OiAtMywgeTogLTJ9LCB7eDogIDMsIHk6ICAwfSwgXSwgLy8gIDdcblxuICBbIHt4OiAgMywgeTogIDB9LCB7eDogLTMsIHk6ICAwfSwgXSwgLy8gIDgg5LiLXG5cbiAgWyB7eDogIDMsIHk6IC0yfSwge3g6IC0zLCB5OiAgMH0sIF0sIC8vICA5XG4gIFsge3g6ICAxLCB5OiAtMn0sIHt4OiAtMiwgeTogIDJ9LCBdLCAvLyAxMFxuICBbIHt4OiAgMywgeTogIDB9LCB7eDogLTMsIHk6ICAwfSwgXSwgLy8gMTFcblxuICBbIHt4OiAgMCwgeTogIDB9LCB7eDogIDAsIHk6ICAwfSwgXSwgLy8gMTIg5Y+zXG5cbiAgWyB7eDogLTMsIHk6ICAzfSwge3g6ICAwLCB5OiAtMX0sIF0sIC8vIDEzXG4gIFsge3g6ICAzLCB5OiAgMn0sIHt4OiAtMiwgeTogIDB9LCBdLCAvLyAxNFxuICBbIHt4OiAgMywgeTogIDJ9LCB7eDogLTMsIHk6IC0yfSwgXSwgLy8gMTVcbl07XG5cbnBoaW5hLm5hbWVzcGFjZShmdW5jdGlvbigpIHtcblxuICBwaGluYS5kZWZpbmUoJ1BsYXllcicsIHtcbiAgICBzdXBlckNsYXNzOiAnQmFzZVVuaXQnLFxuXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgdGhpcy5zdXBlckluaXQob3B0aW9ucy4kc2FmZSh7IHdpZHRoOiAzMiwgaGVpZ2h0OiAzMiB9KSk7XG5cbiAgICAgIHRoaXMuc3ByaXRlID0gU3ByaXRlKFwiZmlnaHRlclwiLCAzMiwgMzIpXG4gICAgICAgIC5zZXRGcmFtZUluZGV4KDApXG4gICAgICAgIC5hZGRDaGlsZFRvKHRoaXMuYmFzZSk7XG5cbiAgICAgIHRoaXMuYWZ0ZXJCYW5uZXIgPSBbXTtcbiAgICAgICgyKS50aW1lcyhpID0+IHtcbiAgICAgICAgdGhpcy5hZnRlckJhbm5lcltpXSA9IEFmdGVyQmFubmVyKClcbiAgICAgICAgICAuc2V0TGF5ZXIodGhpcy53b3JsZC5tYXBMYXllcltMQVlFUl9FRkZFQ1RfQkFDS10pXG4gICAgICAgICAgLmRpc2FibGUoKVxuICAgICAgICAgIC5hdHRhY2hUbyh0aGlzKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgdXBkYXRlOiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IHJhZCA9ICh0aGlzLmRpcmVjdGlvbiAqIDIyLjUpLnRvUmFkaWFuKCk7XG4gICAgICBjb25zdCB4ID0gLU1hdGguc2luKHJhZCkgKiA4O1xuICAgICAgY29uc3QgeSA9IE1hdGguY29zKHJhZCkgKiA4O1xuICAgICAgKDIpLnRpbWVzKGkgPT4ge1xuICAgICAgICBjb25zdCBweCA9IG9mZnNldFt0aGlzLmRpcmVjdGlvbl1baV0ueDtcbiAgICAgICAgY29uc3QgcHkgPSBvZmZzZXRbdGhpcy5kaXJlY3Rpb25dW2ldLnk7XG4gICAgICAgIHRoaXMuYWZ0ZXJCYW5uZXJbaV0uc2V0T2Zmc2V0KCB4ICsgcHgsIHkgKyBweSk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIHBoaW5hLmRlZmluZSgnV29ybGQnLCB7XG4gICAgc3VwZXJDbGFzczogJ0Rpc3BsYXlFbGVtZW50JyxcblxuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgICB0aGlzLnNldHVwKCk7XG5cbiAgICAgIHRoaXMudGltZSA9IDA7XG4gICAgfSxcblxuICAgIHNldHVwOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMubWFwQmFzZSA9IERpc3BsYXlFbGVtZW50KClcbiAgICAgICAgLnNldFBvc2l0aW9uKDAsIDApXG4gICAgICAgIC5hZGRDaGlsZFRvKHRoaXMpO1xuXG4gICAgICAvL+ODrOOCpOODpOODvOani+eviVxuICAgICAgdGhpcy5tYXBMYXllciA9IFtdO1xuICAgICAgKE5VTV9MQVlFUlMpLnRpbWVzKGkgPT4ge1xuICAgICAgICBjb25zdCBsYXllciA9IERpc3BsYXlFbGVtZW50KCkuYWRkQ2hpbGRUbyh0aGlzLm1hcEJhc2UpO1xuICAgICAgICB0aGlzLm1hcExheWVyW2ldID0gbGF5ZXI7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5wbGF5ZXIgPSBQbGF5ZXIoeyB3b3JsZDogdGhpcyB9KVxuICAgICAgICAuc2V0UG9zaXRpb24oU0NSRUVOX1dJRFRIX0hBTEYsIFNDUkVFTl9IRUlHSFRfSEFMRi0xMDApXG4gICAgICAgIC5hZGRDaGlsZFRvKHRoaXMubWFwTGF5ZXJbTEFZRVJfUExBWUVSXSk7XG5cbiAgICAgIHRoaXMuc2V0dXBNYXAoKTtcbiAgICB9LFxuICAgIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNvbnRyb2xQbGF5ZXIoKTtcblxuICAgICAgdmFyIGtiID0gcGhpbmFfYXBwLmtleWJvYXJkO1xuICAgICAgaWYgKHRoaXMudGltZSAlIDMwID09IDAgJiYga2IuZ2V0S2V5KFwiRVwiKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcImVudGVyIGVuZW15XCIpO1xuICAgICAgICBjb25zdCBlID0gRW5lbXl5RmlnaHRlcih7IHBsYXllcjogdGhpcy5wbGF5ZXIsIHdvcmxkOiB0aGlzIH0pXG4gICAgICAgICAgLmFkZENoaWxkVG8odGhpcy5tYXBMYXllcltMQVlFUl9FTkVNWV0pO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnRpbWUrKztcbiAgICB9LFxuICAgIHNldHVwTWFwOiBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTAwMDsgaSsrKSB7XG4gICAgICAgIFJlY3RhbmdsZVNoYXBlKHtcbiAgICAgICAgICB3aWR0aDogTWF0aC5yYW5kaW50KDUwLCAyMDApLFxuICAgICAgICAgIGhlaWdodDogTWF0aC5yYW5kaW50KDUwLCAyMDApLFxuICAgICAgICAgIGZpbGw6ICdibHVlJyxcbiAgICAgICAgICBzdHJva2U6ICcjYWFhJyxcbiAgICAgICAgICBzdHJva2VXaWR0aDogNCxcbiAgICAgICAgICBjb3JuZXJSYWRpdXM6IDAsXG4gICAgICAgICAgeDogTWF0aC5yYW5kaW50KC0xMDAwMCwgMTAwMDApLFxuICAgICAgICAgIHk6IE1hdGgucmFuZGludCgtNTAwMCwgNTAwMCksXG4gICAgICAgIH0pLmFkZENoaWxkVG8odGhpcy5tYXBMYXllcltMQVlFUl9CQUNLR1JPVU5EXSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGNvbnRyb2xQbGF5ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5wbGF5ZXI7XG4gICAgICB2YXIgY3QgPSBwaGluYV9hcHAuY29udHJvbGxlcjtcbiAgICAgIGlmICh0aGlzLnRpbWUgJSAzID09IDApIHtcbiAgICAgICAgaWYgKGN0LmxlZnQpIHtcbiAgICAgICAgICBwbGF5ZXIuZGlyZWN0aW9uLS07XG4gICAgICAgICAgaWYgKHBsYXllci5kaXJlY3Rpb24gPCAwKSBwbGF5ZXIuZGlyZWN0aW9uID0gMTU7XG4gICAgICAgIH0gZWxzZSBpZiAoY3QucmlnaHQpIHtcbiAgICAgICAgICBwbGF5ZXIuZGlyZWN0aW9uKys7XG4gICAgICAgICAgaWYgKHBsYXllci5kaXJlY3Rpb24gPiAxNSkgcGxheWVyLmRpcmVjdGlvbiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgcGxheWVyLnNwcml0ZS5zZXRGcmFtZUluZGV4KHBsYXllci5kaXJlY3Rpb24pO1xuICAgICAgICBpZiAoY3QudXApIHtcbiAgICAgICAgICBwbGF5ZXIuc3BlZWQgKz0gMC4xO1xuICAgICAgICAgIGlmIChwbGF5ZXIuc3BlZWQgPiAxKSBwbGF5ZXIuc3BlZWQgPSAxO1xuICAgICAgICAgIGNvbnN0IHJhZCA9IChwbGF5ZXIuZGlyZWN0aW9uICogMjIuNSkudG9SYWRpYW4oKTtcbiAgICAgICAgICBwbGF5ZXIudmVsb2NpdHkueCArPSBNYXRoLnNpbihyYWQpICogcGxheWVyLnNwZWVkO1xuICAgICAgICAgIHBsYXllci52ZWxvY2l0eS55ICs9IC1NYXRoLmNvcyhyYWQpICogcGxheWVyLnNwZWVkO1xuICAgICAgICAgIGlmIChwbGF5ZXIudmVsb2NpdHkubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgcGxheWVyLnZlbG9jaXR5Lm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgcGxheWVyLnZlbG9jaXR5Lm11bCgyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGxheWVyLnNwZWVkICo9IDAuOTg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy/kuIvjgavokL3jgaHjgotcbiAgICAgIGlmICghY3QudXApIHBsYXllci52ZWxvY2l0eS55ICs9IDAuMTtcblxuICAgICAgcGxheWVyLnBvc2l0aW9uLmFkZChwbGF5ZXIudmVsb2NpdHkpO1xuICAgICAgcGxheWVyLnZlbG9jaXR5Lm11bCgwLjk5KTtcblxuICAgICAgLy/jgqLjg5Xjgr/jg7zjg5Djg7zjg4rjg7xcbiAgICAgIGlmIChjdC51cCkge1xuICAgICAgICBjb25zdCB2ID0gcGxheWVyLnZlbG9jaXR5LmNsb25lKCkubXVsKC0xKVxuICAgICAgICBwbGF5ZXIuYWZ0ZXJCYW5uZXJbMF0uZW5hYmxlKCkuc2V0VmVsb2NpdHkodik7XG4gICAgICAgIHBsYXllci5hZnRlckJhbm5lclsxXS5lbmFibGUoKS5zZXRWZWxvY2l0eSh2KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBsYXllci5hZnRlckJhbm5lclswXS5kaXNhYmxlKCk7XG4gICAgICAgIHBsYXllci5hZnRlckJhbm5lclsxXS5kaXNhYmxlKCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjdC5hKSB7XG4gICAgICAgIFxuICAgICAgfVxuXG4gICAgICB0aGlzLm1hcEJhc2UueCA9IFNDUkVFTl9XSURUSF9IQUxGICAtIHBsYXllci54IC0gcGxheWVyLnZlbG9jaXR5LnggKiAzO1xuICAgICAgdGhpcy5tYXBCYXNlLnkgPSBTQ1JFRU5fSEVJR0hUX0hBTEYgLSBwbGF5ZXIueSAtIHBsYXllci52ZWxvY2l0eS55ICogMztcbiAgICB9LFxuICB9KTtcblxufSk7XG4iLCJwaGluYS5kZWZpbmUoXCJBZnRlckJhbm5lclwiLCB7XG4gIHN1cGVyQ2xhc3M6ICdwaGluYS5hY2Nlc3NvcnkuQWNjZXNzb3J5JyxcblxuICBpbml0OiBmdW5jdGlvbih0YXJnZXQpIHtcbiAgICB0aGlzLnN1cGVySW5pdCh0YXJnZXQpO1xuXG4gICAgdGhpcy5pc0Rpc2FibGUgPSBmYWxzZTtcbiAgICB0aGlzLmxheWVyID0gbnVsbDtcbiAgICB0aGlzLm9mZnNldCA9IFZlY3RvcjIoMCwgMCk7XG4gICAgdGhpcy52ZWxvY2l0eSA9IFZlY3RvcjIoMCwgMCk7XG4gICAgdGhpcy5iZWZvcmUgPSBudWxsO1xuICB9LFxuXG4gIHNldExheWVyOiBmdW5jdGlvbihsYXllcikge1xuICAgIHRoaXMubGF5ZXIgPSBsYXllcjtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBlbmFibGU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaXNEaXNhYmxlID0gZmFsc2U7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgZGlzYWJsZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5pc0Rpc2FibGUgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHNldE9mZnNldDogZnVuY3Rpb24gKHgsIHkpIHtcbiAgICBpZiAoeCBpbnN0YW5jZW9mIFZlY3RvcjIpIHtcbiAgICAgIHRoaXMub2Zmc2V0LnNldCh4LngsIHgueSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy5vZmZzZXQuc2V0KHgsIHkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHNldFZlbG9jaXR5OiBmdW5jdGlvbih4LCB5KSB7XG4gICAgaWYgKHggaW5zdGFuY2VvZiBWZWN0b3IyKSB7XG4gICAgICB0aGlzLnZlbG9jaXR5ID0geC5jbG9uZSgpLm11bCgtMSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy52ZWxvY2l0eS54ID0geDtcbiAgICB0aGlzLnZlbG9jaXR5LnggPSB5O1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaXNEaXNhYmxlKSB7XG4gICAgICB0aGlzLmJlZm9yZSA9IG51bGw7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0O1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7IHNjYWxlOiAwLjMgfTtcbiAgICBjb25zdCBwb3MgPSB0YXJnZXQucG9zaXRpb24uY2xvbmUoKS5hZGQodGhpcy5vZmZzZXQpO1xuICAgIGlmICh0aGlzLmJlZm9yZSkge1xuICAgICAgY29uc3QgZGlzID0gdGFyZ2V0LnBvc2l0aW9uLmRpc3RhbmNlKHRoaXMuYmVmb3JlKTtcbiAgICAgIGNvbnN0IG51bVNwbGl0ID0gTWF0aC5tYXgoTWF0aC5mbG9vcihkaXMgLyAzKSwgNik7XG4gICAgICBjb25zdCB1bml0U3BsaXQgPSAoMSAvIG51bVNwbGl0KTtcbiAgICAgIG51bVNwbGl0LnRpbWVzKGkgPT4ge1xuICAgICAgICBjb25zdCBwZXIgPSB1bml0U3BsaXQgKiBpO1xuICAgICAgICBjb25zdCBwUG9zID0gVmVjdG9yMihwb3MueCAqIHBlciArIHRoaXMuYmVmb3JlLnggKiAoMSAtIHBlciksIHBvcy55ICogcGVyICsgdGhpcy5iZWZvcmUueSAqICgxIC0gcGVyKSlcbiAgICAgICAgUGFydGljbGVTcHJpdGUob3B0aW9ucylcbiAgICAgICAgICAuc2V0UG9zaXRpb24ocFBvcy54LCBwUG9zLnkpXG4gICAgICAgICAgLmFkZENoaWxkVG8odGhpcy5sYXllcik7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuYmVmb3JlLnNldChwb3MueCwgcG9zLnkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJlZm9yZSA9IFZlY3RvcjIocG9zLngsIHBvcy55KTtcbiAgICB9XG4gIH0sXG59KTtcbiIsInBoaW5hLmRlZmluZShcIlBhcnRpY2xlXCIsIHtcbiAgc3VwZXJDbGFzczogJ3BoaW5hLmRpc3BsYXkuQ2lyY2xlU2hhcGUnLFxuXG4gIF9zdGF0aWM6IHtcbiAgICBkZWZhdWx0Q29sb3I6IHtcbiAgICAgIHN0YXJ0OiAxMCwgLy8gY29sb3IgYW5nbGUg44Gu6ZaL5aeL5YCkXG4gICAgICBlbmQ6IDMwLCAgIC8vIGNvbG9yIGFuZ2xlIOOBrue1guS6huWApFxuICAgIH0sXG4gICAgZGVmYXVsU2NhbGU6IDEsICAgICAvLyDliJ3mnJ/jgrnjgrHjg7zjg6tcbiAgICBzY2FsZURlY2F5OiAwLjAzLCAgLy8g44K544Kx44O844Or44OA44Km44Oz44Gu44K544OU44O844OJXG4gIH0sXG4gIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSAob3B0aW9ucyB8fCB7fSkuJHNhZmUoeyBzdHJva2U6IGZhbHNlLCByYWRpdXM6IDI0LCBzY2FsZTogMS4wIH0pO1xuICAgIHRoaXMuc3VwZXJJbml0KHRoaXMub3B0aW9ucyk7XG5cbiAgICB0aGlzLmJsZW5kTW9kZSA9ICdsaWdodGVyJztcblxuICAgIGNvbnN0IGNvbG9yID0gdGhpcy5vcHRpb25zLmNvbG9yIHx8IFBhcnRpY2xlLmRlZmF1bHRDb2xvcjtcbiAgICBjb25zdCBncmFkID0gdGhpcy5jYW52YXMuY29udGV4dC5jcmVhdGVSYWRpYWxHcmFkaWVudCgwLCAwLCAwLCAwLCAwLCB0aGlzLnJhZGl1cyk7XG4gICAgZ3JhZC5hZGRDb2xvclN0b3AoMCwgJ2hzbGEoezB9LCA3NSUsIDUwJSwgMS4wKScuZm9ybWF0KE1hdGgucmFuZGludChjb2xvci5zdGFydCwgY29sb3IuZW5kKSkpO1xuICAgIGdyYWQuYWRkQ29sb3JTdG9wKDEsICdoc2xhKHswfSwgNzUlLCA1MCUsIDAuMCknLmZvcm1hdChNYXRoLnJhbmRpbnQoY29sb3Iuc3RhcnQsIGNvbG9yLmVuZCkpKTtcblxuICAgIHRoaXMuZmlsbCA9IGdyYWQ7XG5cbiAgICB0aGlzLmJlZ2luUG9zaXRpb24gPSBWZWN0b3IyKCk7XG4gICAgdGhpcy52ZWxvY2l0eSA9IHRoaXMub3B0aW9ucy52ZWxvY2l0eSB8fCBWZWN0b3IyKDAsIDApO1xuICAgIHRoaXMub25lKFwiZW50ZXJmcmFtZVwiLCAoKSA9PiB0aGlzLnJlc2V0KCkpO1xuICB9LFxuXG4gIHJlc2V0OiBmdW5jdGlvbih4LCB5KSB7XG4gICAgeCA9IHggfHwgdGhpcy54O1xuICAgIHkgPSB5IHx8IHRoaXMueTtcbiAgICB0aGlzLmJlZ2luUG9zaXRpb24uc2V0KHgsIHkpO1xuICAgIHRoaXMucG9zaXRpb24uc2V0KHRoaXMuYmVnaW5Qb3NpdGlvbi54LCB0aGlzLmJlZ2luUG9zaXRpb24ueSk7XG4gICAgdGhpcy5zY2FsZVggPSB0aGlzLnNjYWxlWSA9IHRoaXMub3B0aW9ucy5zY2FsZSB8fCBNYXRoLnJhbmRmbG9hdChQYXJ0aWNsZS5kZWZhdWxTY2FsZSAqIDAuOCwgUGFydGljbGUuZGVmYXVsU2NhbGUgKiAxLjIpO1xuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wb3NpdGlvbi5hZGQodGhpcy52ZWxvY2l0eSk7XG4gICAgdGhpcy52ZWxvY2l0eS54ICo9IDAuOTk7XG4gICAgdGhpcy52ZWxvY2l0eS55ICo9IDAuOTk7XG4gICAgdGhpcy5zY2FsZVggLT0gUGFydGljbGUuc2NhbGVEZWNheTtcbiAgICB0aGlzLnNjYWxlWSAtPSBQYXJ0aWNsZS5zY2FsZURlY2F5O1xuXG4gICAgaWYgKHRoaXMuc2NhbGVYIDwgMCkgdGhpcy5yZW1vdmUoKTtcbiAgfSxcblxuICBzZXRWZWxvY2l0eTogZnVuY3Rpb24oeCwgeSkge1xuICAgIGlmICh4IGluc3RhbmNlb2YgVmVjdG9yMikge1xuICAgICAgdGhpcy52ZWxvY2l0eSA9IHg7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy52ZWxvY2l0eS54ID0geDtcbiAgICB0aGlzLnZlbG9jaXR5LnggPSB5O1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG59KTtcbiIsInBoaW5hLmRlZmluZShcIlBhcnRpY2xlU3ByaXRlXCIsIHtcbiAgc3VwZXJDbGFzczogJ3BoaW5hLmRpc3BsYXkuU3ByaXRlJyxcblxuICBfc3RhdGljOiB7XG4gICAgZGVmYXVsdFNjYWxlOiAxLjAsICAgIC8vIOWIneacn+OCueOCseODvOODq1xuICAgIHNjYWxlRGVjYXk6IDAuMDEsICAvLyDjgrnjgrHjg7zjg6vjg4Djgqbjg7Pjga7jgrnjg5Tjg7zjg4lcbiAgfSxcbiAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHRoaXMuc3VwZXJJbml0KFwicGFydGljbGVcIiwgMTYsIDE2KTtcblxuICAgIHRoaXMuYmxlbmRNb2RlID0gJ2xpZ2h0ZXInO1xuXG4gICAgdGhpcy5iZWdpblBvc2l0aW9uID0gVmVjdG9yMigpO1xuICAgIHRoaXMudmVsb2NpdHkgPSBvcHRpb25zLnZlbG9jaXR5IHx8IFZlY3RvcjIoMCwgMCk7XG4gICAgdGhpcy5zY2FsZVggPSB0aGlzLnNjYWxlWSA9IG9wdGlvbnMuc2NhbGUgfHwgUGFydGljbGVTcHJpdGUuZGVmYXVsdFNjYWxlO1xuICAgIHRoaXMuc2NhbGVEZWNheSA9IG9wdGlvbnMuc2NhbGVEZWNheSB8fCBQYXJ0aWNsZVNwcml0ZS5zY2FsZURlY2F5O1xuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wb3NpdGlvbi5hZGQodGhpcy52ZWxvY2l0eSk7XG4gICAgdGhpcy52ZWxvY2l0eS54ICo9IDAuOTk7XG4gICAgdGhpcy52ZWxvY2l0eS55ICo9IDAuOTk7XG4gICAgdGhpcy5zY2FsZVggLT0gdGhpcy5zY2FsZURlY2F5O1xuICAgIHRoaXMuc2NhbGVZIC09IHRoaXMuc2NhbGVEZWNheTtcblxuICAgIGlmICh0aGlzLnNjYWxlWCA8IDApIHRoaXMucmVtb3ZlKCk7XG4gIH0sXG5cbiAgc2V0VmVsb2NpdHk6IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICBpZiAoeCBpbnN0YW5jZW9mIFZlY3RvcjIpIHtcbiAgICAgIHRoaXMudmVsb2NpdHkgPSB4LmNsb25lKCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy52ZWxvY2l0eS54ID0geDtcbiAgICB0aGlzLnZlbG9jaXR5LnggPSB5O1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG59KTtcbiIsIi8vXG4vLyDjgrfjg7zjg7Pjgqjjg5Xjgqfjgq/jg4jjga7ln7rnpI7jgq/jg6njgrlcbi8vXG5waGluYS5kZWZpbmUoXCJTY2VuZUVmZmVjdEJhc2VcIiwge1xuICBzdXBlckNsYXNzOiBcIklucHV0SW50ZXJjZXB0XCIsXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB0aGlzLmVuYWJsZSgpO1xuICB9LFxuXG59KTtcbiIsIi8vXG4vLyDjgrfjg7zjg7Pjgqjjg5Xjgqfjgq/jg4jvvJropIfmlbDjga7lhobjgafjg5Xjgqfjg7zjg4njgqTjg7PjgqLjgqbjg4hcbi8vXG5waGluYS5kZWZpbmUoXCJTY2VuZUVmZmVjdENpcmNsZUZhZGVcIiwge1xuICBzdXBlckNsYXNzOiBcIlNjZW5lRWZmZWN0QmFzZVwiLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSAoe30pLiRzYWZlKG9wdGlvbnMsIFNjZW5lRWZmZWN0Q2lyY2xlRmFkZS5kZWZhdWx0cyk7XG5cbiAgICB0aGlzLnN1cGVySW5pdCgpO1xuICB9LFxuXG4gIF9jcmVhdGVDaXJjbGU6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IG51bSA9IDU7XG4gICAgY29uc3Qgd2lkdGggPSBTQ1JFRU5fV0lEVEggLyBudW07XG4gICAgcmV0dXJuIEFycmF5LnJhbmdlKChTQ1JFRU5fSEVJR0hUIC8gd2lkdGgpICsgMSkubWFwKHkgPT4ge1xuICAgICAgcmV0dXJuIEFycmF5LnJhbmdlKG51bSArIDEpLm1hcCh4ID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkQ2hpbGQoQ2lyY2xlU2hhcGUoe1xuICAgICAgICAgIHg6IHggKiB3aWR0aCxcbiAgICAgICAgICB5OiB5ICogd2lkdGgsXG4gICAgICAgICAgZmlsbDogdGhpcy5vcHRpb25zLmNvbG9yLFxuICAgICAgICAgIHN0cm9rZTogbnVsbCxcbiAgICAgICAgICByYWRpdXM6IHdpZHRoICogMC41LFxuICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICBiZWdpbjogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgY2lyY2xlcyA9IHRoaXMuX2NyZWF0ZUNpcmNsZSgpO1xuICAgIGNvbnN0IHRhc2tzID0gW107XG4gICAgY2lyY2xlcy5mb3JFYWNoKCh4TGluZSwgeSkgPT4ge1xuICAgICAgeExpbmUuZm9yRWFjaCgoY2lyY2xlLCB4KSA9PiB7XG4gICAgICAgIGNpcmNsZS5zY2FsZVggPSAwO1xuICAgICAgICBjaXJjbGUuc2NhbGVZID0gMDtcbiAgICAgICAgdGFza3MucHVzaChuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICBjaXJjbGUudHdlZW5lci5jbGVhcigpXG4gICAgICAgICAgICAudG8oe1xuICAgICAgICAgICAgICBzY2FsZVg6IDEuNSxcbiAgICAgICAgICAgICAgc2NhbGVZOiAxLjVcbiAgICAgICAgICAgIH0sIDUwMCwgXCJlYXNlT3V0UXVhZFwiKVxuICAgICAgICAgICAgLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgICBjaXJjbGUucmVtb3ZlKCk7XG4gICAgICAgICAgICAgIGNpcmNsZS5kZXN0cm95Q2FudmFzKCk7XG4gICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4uY2xlYXIoKTtcbiAgICAgICAgICAgICAgdGhpcy5kaXNhYmxlKCk7XG4gICAgICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLmFsbCh0YXNrcyk7XG4gIH0sXG5cbiAgZmluaXNoOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNoaWxkcmVuLmNsZWFyKCk7XG5cbiAgICBjb25zdCBjaXJjbGVzID0gdGhpcy5fY3JlYXRlQ2lyY2xlKCk7XG4gICAgY29uc3QgdGFza3MgPSBbXTtcbiAgICBjaXJjbGVzLmZvckVhY2goeExpbmUgPT4ge1xuICAgICAgeExpbmUuZm9yRWFjaChjaXJjbGUgPT4ge1xuICAgICAgICBjaXJjbGUuc2NhbGVYID0gMS41O1xuICAgICAgICBjaXJjbGUuc2NhbGVZID0gMS41O1xuICAgICAgICB0YXNrcy5wdXNoKG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgIGNpcmNsZS50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAgIC50byh7XG4gICAgICAgICAgICAgIHNjYWxlWDogMCxcbiAgICAgICAgICAgICAgc2NhbGVZOiAwXG4gICAgICAgICAgICB9LCA1MDAsIFwiZWFzZU91dFF1YWRcIilcbiAgICAgICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgY2lyY2xlLnJlbW92ZSgpO1xuICAgICAgICAgICAgICBjaXJjbGUuZGVzdHJveUNhbnZhcygpO1xuICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLmNsZWFyKCk7XG4gICAgICAgICAgICAgIHRoaXMuZGlzYWJsZSgpO1xuICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHRhc2tzKTtcbiAgfSxcblxuICBfc3RhdGljOiB7XG4gICAgZGVmYXVsdHM6IHtcbiAgICAgIGNvbG9yOiBcIndoaXRlXCIsXG4gICAgfVxuICB9XG5cbn0pO1xuIiwiLy9cbi8vIOOCt+ODvOODs+OCqOODleOCp+OCr+ODiO+8muODleOCp+ODvOODieOCpOODs+OCouOCpuODiFxuLy9cbnBoaW5hLmRlZmluZShcIlNjZW5lRWZmZWN0RmFkZVwiLCB7XG4gIHN1cGVyQ2xhc3M6IFwiU2NlbmVFZmZlY3RCYXNlXCIsXG5cbiAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHRoaXMub3B0aW9ucyA9ICh7fSkuJHNhZmUob3B0aW9ucywge1xuICAgICAgY29sb3I6IFwiYmxhY2tcIixcbiAgICAgIHRpbWU6IDUwMCxcbiAgICB9KTtcblxuICAgIHRoaXMuc3VwZXJJbml0KCk7XG4gICAgdGhpcy5mcm9tSlNPTih7XG4gICAgICBjaGlsZHJlbjoge1xuICAgICAgICBmYWRlOiB7XG4gICAgICAgICAgY2xhc3NOYW1lOiBcIlJlY3RhbmdsZVNoYXBlXCIsXG4gICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICB3aWR0aDogU0NSRUVOX1dJRFRILFxuICAgICAgICAgICAgaGVpZ2h0OiBTQ1JFRU5fSEVJR0hULFxuICAgICAgICAgICAgZmlsbDogdGhpcy5vcHRpb25zLmNvbG9yLFxuICAgICAgICAgICAgc3Ryb2tlOiBudWxsLFxuICAgICAgICAgICAgcGFkZGluZzogMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHg6IFNDUkVFTl9XSURUSCAqIDAuNSxcbiAgICAgICAgICB5OiBTQ1JFRU5fSEVJR0hUICogMC41LFxuICAgICAgICB9LFxuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIHN0YXk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGZhZGUgPSB0aGlzLmZhZGU7XG4gICAgZmFkZS5hbHBoYSA9IDEuMDtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH0sXG5cbiAgYmVnaW46IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgIGNvbnN0IGZhZGUgPSB0aGlzLmZhZGU7XG4gICAgICBmYWRlLmFscGhhID0gMS4wO1xuICAgICAgZmFkZS50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgLmZhZGVPdXQodGhpcy5vcHRpb25zLnRpbWUpXG4gICAgICAgIC5jYWxsKCgpID0+IHtcbiAgICAgICAgICAvLzFGcmFtZeaPj+eUu+OBleOCjOOBpuOBl+OBvuOBo+OBpuOBoeOCieOBpOOBj+OBruOBp2VudGVyZnJhbWXjgafliYrpmaRcbiAgICAgICAgICB0aGlzLm9uZShcImVudGVyZnJhbWVcIiwgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5mYWRlLnJlbW92ZSgpO1xuICAgICAgICAgICAgdGhpcy5mYWRlLmRlc3Ryb3lDYW52YXMoKTtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIGZpbmlzaDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgY29uc3QgZmFkZSA9IHRoaXMuZmFkZTtcbiAgICAgIGZhZGUuYWxwaGEgPSAwLjA7XG4gICAgICBmYWRlLnR3ZWVuZXIuY2xlYXIoKVxuICAgICAgICAuZmFkZUluKHRoaXMub3B0aW9ucy50aW1lKVxuICAgICAgICAuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5mbGFyZShcImZpbmlzaFwiKTtcbiAgICAgICAgICAvLzFGcmFtZeaPj+eUu+OBleOCjOOBpuOBl+OBvuOBo+OBpuOBoeOCieOBpOOBj+OBruOBp2VudGVyZnJhbWXjgafliYrpmaRcbiAgICAgICAgICB0aGlzLm9uZShcImVudGVyZnJhbWVcIiwgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5mYWRlLnJlbW92ZSgpO1xuICAgICAgICAgICAgdGhpcy5mYWRlLmRlc3Ryb3lDYW52YXMoKTtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIF9zdGF0aWM6IHtcbiAgICBkZWZhdWx0czoge1xuICAgICAgY29sb3I6IFwiYmxhY2tcIixcbiAgICB9XG4gIH1cblxufSk7XG4iLCIvL1xuLy8g44K344O844Oz44Ko44OV44Kn44Kv44OI77ya44Gq44Gr44KC44GX44Gq44GEXG4vL1xucGhpbmEuZGVmaW5lKFwiU2NlbmVFZmZlY3ROb25lXCIsIHtcbiAgc3VwZXJDbGFzczogXCJTY2VuZUVmZmVjdEJhc2VcIixcblxuICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN1cGVySW5pdCgpO1xuICB9LFxuXG4gIGJlZ2luOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICB0aGlzLm9uZShcImVudGVyZnJhbWVcIiwgKCkgPT4gdGhpcy5yZW1vdmUoKSk7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH0sXG5cbiAgZmluaXNoOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICB0aGlzLm9uZShcImVudGVyZnJhbWVcIiwgKCkgPT4gdGhpcy5yZW1vdmUoKSk7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxufSk7XG4iLCIvL1xuLy8g44K344O844Oz44Ko44OV44Kn44Kv44OI77ya44K/44Kk44Or44OV44Kn44O844OJXG4vL1xucGhpbmEuZGVmaW5lKFwiU2NlbmVFZmZlY3RUaWxlRmFkZVwiLCB7XG4gIHN1cGVyQ2xhc3M6IFwiU2NlbmVFZmZlY3RCYXNlXCIsXG5cbiAgdGlsZXM6IG51bGwsXG4gIG51bTogMTUsXG4gIHNwZWVkOiA1MCxcblxuICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcbiAgICB0aGlzLm9wdGlvbnMgPSAoe30pLiRzYWZlKG9wdGlvbnMsIHtcbiAgICAgIGNvbG9yOiBcImJsYWNrXCIsXG4gICAgICB3aWR0aDogNzY4LFxuICAgICAgaGVpZ2h0OiAxMDI0LFxuICAgIH0pO1xuXG4gICAgdGhpcy50aWxlcyA9IHRoaXMuX2NyZWF0ZVRpbGVzKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZVRpbGVzOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB3aWR0aCA9IE1hdGguZmxvb3IodGhpcy5vcHRpb25zLndpZHRoIC8gdGhpcy5udW0pO1xuXG4gICAgcmV0dXJuIEFycmF5LnJhbmdlKCh0aGlzLm9wdGlvbnMuaGVpZ2h0IC8gd2lkdGgpICsgMSkubWFwKHkgPT4ge1xuICAgICAgcmV0dXJuIEFycmF5LnJhbmdlKHRoaXMubnVtICsgMSkubWFwKHggPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5hZGRDaGlsZChSZWN0YW5nbGVTaGFwZSh7XG4gICAgICAgICAgd2lkdGg6IHdpZHRoICsgMixcbiAgICAgICAgICBoZWlnaHQ6IHdpZHRoICsgMixcbiAgICAgICAgICB4OiB4ICogd2lkdGgsXG4gICAgICAgICAgeTogeSAqIHdpZHRoLFxuICAgICAgICAgIGZpbGw6IHRoaXMub3B0aW9ucy5jb2xvcixcbiAgICAgICAgICBzdHJva2U6IG51bGwsXG4gICAgICAgICAgc3Ryb2tlV2lkdGg6IDAsXG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIHN0YXk6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudGlsZXMuZm9yRWFjaCgoeGxpbmUsIHkpID0+IHtcbiAgICAgIHhsaW5lLmZvckVhY2goKHRpbGUsIHgpID0+IHtcbiAgICAgICAgdGlsZS5zY2FsZVggPSAxLjA7XG4gICAgICAgIHRpbGUuc2NhbGVZID0gMS4wO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9LFxuXG4gIGJlZ2luOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB0YXNrcyA9IFtdO1xuICAgIHRoaXMudGlsZXMuZm9yRWFjaCgoeGxpbmUsIHkpID0+IHtcbiAgICAgIGNvbnN0IHcgPSBNYXRoLnJhbmRmbG9hdCgwLCAxKSAqIHRoaXMuc3BlZWQ7XG4gICAgICB4bGluZS5mb3JFYWNoKCh0aWxlLCB4KSA9PiB7XG4gICAgICAgIHRpbGUuc2NhbGVYID0gMS4wO1xuICAgICAgICB0aWxlLnNjYWxlWSA9IDEuMDtcbiAgICAgICAgdGFza3MucHVzaChuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICB0aWxlLnR3ZWVuZXIuY2xlYXIoKVxuICAgICAgICAgICAgLndhaXQoeCAqIHRoaXMuc3BlZWQgKyB3KVxuICAgICAgICAgICAgLnRvKHtcbiAgICAgICAgICAgICAgc2NhbGVYOiAwLFxuICAgICAgICAgICAgICBzY2FsZVk6IDBcbiAgICAgICAgICAgIH0sIDUwMCwgXCJlYXNlT3V0UXVhZFwiKVxuICAgICAgICAgICAgLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgICB0aWxlLnJlbW92ZSgpO1xuICAgICAgICAgICAgICB0aWxlLmRlc3Ryb3lDYW52YXMoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHRhc2tzKVxuICB9LFxuXG4gIGZpbmlzaDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdGFza3MgPSBbXTtcbiAgICB0aGlzLnRpbGVzLmZvckVhY2goKHhsaW5lLCB5KSA9PiB7XG4gICAgICBjb25zdCB3ID0gTWF0aC5yYW5kZmxvYXQoMCwgMSkgKiB0aGlzLnNwZWVkO1xuICAgICAgeGxpbmUuZm9yRWFjaCgodGlsZSwgeCkgPT4ge1xuICAgICAgICB0aWxlLnNjYWxlWCA9IDAuMDtcbiAgICAgICAgdGlsZS5zY2FsZVkgPSAwLjA7XG4gICAgICAgIHRhc2tzLnB1c2gobmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgdGlsZS50d2VlbmVyLmNsZWFyKClcbiAgICAgICAgICAgIC53YWl0KCh4bGluZS5sZW5ndGggLSB4KSAqIHRoaXMuc3BlZWQgKyB3KVxuICAgICAgICAgICAgLnRvKHtcbiAgICAgICAgICAgICAgc2NhbGVYOiAxLFxuICAgICAgICAgICAgICBzY2FsZVk6IDFcbiAgICAgICAgICAgIH0sIDUwMCwgXCJlYXNlT3V0UXVhZFwiKVxuICAgICAgICAgICAgLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgICB0aWxlLnJlbW92ZSgpO1xuICAgICAgICAgICAgICB0aWxlLmRlc3Ryb3lDYW52YXMoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHRhc2tzKVxuICB9LFxuXG4gIF9zdGF0aWM6IHtcbiAgICBkZWZhdWx0czoge1xuICAgICAgY29sb3I6IFwiYmxhY2tcIixcbiAgICB9XG4gIH1cblxufSk7XG4iLCIvL1xuLy8g44Kv44Oq44OD44Kv44KE44K/44OD44OB44KS44Kk44Oz44K/44O844K744OX44OI44GZ44KLXG4vL1xucGhpbmEuZGVmaW5lKFwiSW5wdXRJbnRlcmNlcHRcIiwge1xuICBzdXBlckNsYXNzOiBcIkRpc3BsYXlFbGVtZW50XCIsXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdXBlckluaXQoKTtcblxuICAgIHRoaXMub24oXCJhZGRlZFwiLCAoKSA9PiB7XG4gICAgICAvL+imquOBq+WvvuOBl+OBpuimhuOBhOOBi+OBtuOBm+OCi1xuICAgICAgdGhpcy53aWR0aCA9IHRoaXMucGFyZW50LndpZHRoO1xuICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLnBhcmVudC5oZWlnaHQ7XG4gICAgICB0aGlzLm9yaWdpblggPSB0aGlzLnBhcmVudC5vcmlnaW5YIHx8IDA7XG4gICAgICB0aGlzLm9yaWdpblkgPSB0aGlzLnBhcmVudC5vcmlnaW5ZIHx8IDA7XG4gICAgICB0aGlzLnggPSAwO1xuICAgICAgdGhpcy55ID0gMDtcbiAgICB9KTtcbiAgICB0aGlzLmRpc2FibGUoKTtcbiAgfSxcblxuICBlbmFibGU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc2V0SW50ZXJhY3RpdmUodHJ1ZSk7XG4gIH0sXG5cbiAgZGlzYWJsZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zZXRJbnRlcmFjdGl2ZShmYWxzZSk7XG4gIH0sXG5cbn0pO1xuIiwicGhpbmEubmFtZXNwYWNlKGZ1bmN0aW9uKCkge1xuXG4gIGxldCBkdW1teVRleHR1cmUgPSBudWxsO1xuXG4gIHBoaW5hLmRlZmluZShcIlNwcml0ZUxhYmVsXCIsIHtcbiAgICBzdXBlckNsYXNzOiBcIkRpc3BsYXlFbGVtZW50XCIsXG5cbiAgICBfdGV4dDogbnVsbCxcbiAgICB0YWJsZTogbnVsbCxcbiAgICBmaXhXaWR0aDogMCxcblxuICAgIHNwcml0ZXM6IG51bGwsXG5cbiAgICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBpZiAoIWR1bW15VGV4dHVyZSkge1xuICAgICAgICBkdW1teVRleHR1cmUgPSBDYW52YXMoKS5zZXRTaXplKDEsIDEpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnN1cGVySW5pdChvcHRpb25zKTtcbiAgICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgICAgdGhpcy5maXhXaWR0aCA9IG9wdGlvbnMuZml4V2lkdGggfHwgMDtcblxuICAgICAgdGhpcy5zcHJpdGVzID0gW107XG5cbiAgICAgIHRoaXMuc2V0VGV4dChcIlwiKTtcbiAgICB9LFxuXG4gICAgc2V0VGV4dDogZnVuY3Rpb24odGV4dCkge1xuICAgICAgdGhpcy5fdGV4dCA9IHRleHQ7XG5cbiAgICAgIGNvbnN0IGNoYXJzID0gdGhpcy50ZXh0LnNwbGl0KFwiXCIpO1xuXG4gICAgICBpZiAodGhpcy5zcHJpdGVzLmxlbmd0aCA8IGNoYXJzLmxlbmd0aCkge1xuICAgICAgICBBcnJheS5yYW5nZSgwLCB0aGlzLnNwcml0ZXMubGVuZ3RoIC0gY2hhcnMubGVuZ3RoKS5mb3JFYWNoKCgpID0+IHtcbiAgICAgICAgICB0aGlzLnNwcml0ZXMucHVzaChTcHJpdGUoZHVtbXlUZXh0dXJlKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgQXJyYXkucmFuZ2UoMCwgY2hhcnMubGVuZ3RoIC0gdGhpcy5zcHJpdGVzLmxlbmd0aCkuZm9yRWFjaCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5zcHJpdGVzLmxhc3QucmVtb3ZlKCk7XG4gICAgICAgICAgdGhpcy5zcHJpdGVzLmxlbmd0aCAtPSAxO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fdGV4dC5zcGxpdChcIlwiKS5tYXAoKGMsIGkpID0+IHtcbiAgICAgICAgdGhpcy5zcHJpdGVzW2ldXG4gICAgICAgICAgLnNldEltYWdlKHRoaXMudGFibGVbY10pXG4gICAgICAgICAgLnNldE9yaWdpbih0aGlzLm9yaWdpblgsIHRoaXMub3JpZ2luWSlcbiAgICAgICAgICAuYWRkQ2hpbGRUbyh0aGlzKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB0b3RhbFdpZHRoID0gdGhpcy5zcHJpdGVzLnJlZHVjZSgodywgcykgPT4gdyArICh0aGlzLmZpeFdpZHRoIHx8IHMud2lkdGgpLCAwKTtcbiAgICAgIGNvbnN0IHRvdGFsSGVpZ2h0ID0gdGhpcy5zcHJpdGVzLm1hcChfID0+IF8uaGVpZ2h0KS5zb3J0KCkubGFzdDtcblxuICAgICAgbGV0IHggPSB0b3RhbFdpZHRoICogLXRoaXMub3JpZ2luWDtcbiAgICAgIHRoaXMuc3ByaXRlcy5mb3JFYWNoKChzKSA9PiB7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gdGhpcy5maXhXaWR0aCB8fCBzLndpZHRoO1xuICAgICAgICBzLnggPSB4ICsgd2lkdGggKiBzLm9yaWdpblg7XG4gICAgICAgIHggKz0gd2lkdGg7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIF9hY2Nlc3Nvcjoge1xuICAgICAgdGV4dDoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl90ZXh0O1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICB0aGlzLnNldFRleHQodik7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG5cbiAgfSk7XG5cbn0pO1xuIl19
