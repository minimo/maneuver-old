phina.namespace(function() {

  phina.define('Player', {
    superClass: 'BaseUnit',

    speed: 0,

    init: function(options) {
      this.superInit(options.$safe({ width: 32, height: 32 }));

      this.sprite = Sprite("fighter", 32, 32)
        .setFrameIndex(0)
        .addChildTo(this.base);

      this.afterBanner = AfterBanner()
        .setLayer(this.world.mapLayer[LAYER_EFFECT_BACK])
        .disable()
        .attachTo(this);
    },
  });
});
