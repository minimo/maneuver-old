phina.namespace(function() {

  phina.define('Player', {
    superClass: 'BaseUnit',

    mapData: null,
    collisionData: null,
    floorData: null,

    coverData: null,

    init: function() {
      this.superInit({ width: 64, height: 64 });

      this.sprite = Sprite("fighter", 64, 64)
        .setFrameIndex(0)
        .addChildTo(this.base);
    },

    update: function() {
      var ct = phina_app.controller;
      if (ct.left) {
        this.direction++;
        if (this.direction > 15) this.direction = 0;
      } else if (ct.right) {
        this.direction--;
        if (this.direction < 0) this.direction = 15;
      }
      this.sprite.setFrameIndex(this.direction);

      const rad = (this.direction * 22.5).toRadian();
      const vx = -Math.sin(rad) * 2;
      const vy = -Math.cos(rad) * 2;
      this.x += vx;
      this.y += vy;
    },
  });

});
