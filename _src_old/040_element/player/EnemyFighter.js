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
