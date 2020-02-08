phina.namespace(function() {

  phina.define('Player', {
    superClass: 'BaseUnit',

    speed: 0,

    init: function() {
      this.superInit({ width: 64, height: 64 });

      this.sprite = Sprite("fighter", 64, 64)
        .setFrameIndex(0)
        .addChildTo(this.base);
    },
  });
});
