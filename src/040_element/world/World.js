phina.namespace(function() {

  phina.define('World', {
    superClass: 'DisplayElement',

    init: function(options) {
      this.superInit();
      this.setup();
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

      this.player = Player()
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF)
        .addChildTo(this.mapLayer[LAYER_PLAYER]);
    },
    update: function() {
      this.mapBase.x = -this.player.x + SCREEN_WIDTH_HALF;
      this.mapBase.y = -this.player.y + SCREEN_HEIGHT_HALF;
      console.log(this.mapBase.x, this.mapBase.y)
    },
    setupMap: function() {
    },
  });

});
