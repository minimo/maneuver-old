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
