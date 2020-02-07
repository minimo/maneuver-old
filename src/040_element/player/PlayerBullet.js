phina.namespace(function() {

  phina.define('PlayerBullet', {
    superClass: 'BaseUnit',

    collisionData: null,

    init: function() {
      this.superInit({ width: 64, height: 64 });

      this.sprite = Sprite("fighter", 64, 64)
        .setFrameIndex(0)
        .addChildTo(this.base);

      this.time = 0;
      this.speed = 0;
    },

    update: function() {
    },
  });

});
