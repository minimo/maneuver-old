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

      this.time = 0;
      this.speed = 0;
    },

    update: function() {
      if (this.time % 3 == 0) {
        var ct = phina_app.controller;
        if (ct.left) {
          this.direction++;
          if (this.direction > 15) this.direction = 0;
        } else if (ct.right) {
          this.direction--;
          if (this.direction < 0) this.direction = 15;
        }
        this.sprite.setFrameIndex(this.direction);
        if (ct.up) {
          this.speed += 0.1;
          if (this.speed > 1) this.speed = 1;
          const rad = (this.direction * 22.5).toRadian();
          this.vx += -Math.sin(rad) * this.speed;
          this.vy += -Math.cos(rad) * this.speed;
          const vec = Vector2(this.vx, this.vy);
          if (vec.length > 2) {
            vec.normalize();
            this.vx = vec.x * 2;
            this.vy = vec.y * 2;
          }
        } else {
          this.speed *= 0.98;
        }
      }

      this.x += this.vx;
      this.y += this.vy;

      this.vx *= 0.999;
      this.vy *= 0.999;

      this.time++;
    },
  });

});
