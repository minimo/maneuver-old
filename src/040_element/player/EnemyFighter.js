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
      this.speed = 5;

      this.time = 0;
    },
    update: function() {
      //自分から見たプレイヤーの方角
      const r = Math.atan2(this.player.y - this.y, this.player.x - this.x);
      this.rotation = r.toDegree();

      this.velocity.add(Vector2(Math.cos(r) * this.speed, Math.sin(r) * this.speed));
      this.velocity.normalize();
      this.velocity.mul(this.speed);
      this.position.add(this.velocity);

      this.time++;
    },
  });
});
