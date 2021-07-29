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
