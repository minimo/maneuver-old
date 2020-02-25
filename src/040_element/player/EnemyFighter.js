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
      this.speed = 1;

      this.time = 0;
    },
    update: function() {
      //自分から見たプレイヤーの方角
      const r = Math.atan2(this.player.y - this.y, this.player.x - this.x);
      let rr = r - this.angle;
      if (rr < 0) rr += 360;
      if (rr > 180) rr = (rr - 180) * -1;
      const ar = Math.abs(rr);
      if (ar > 10) {
        if (rr < 0) this.angle++; else this.angle--;
      }

      if (this.time % 60 == 0) console.log(rr, ar);
      
      this.velocity.set(Math.cos(this.angle) * this.speed, Math.sin(this.angle) * this.speed);
      this.position.add(this.velocity);

      this.time++;
    },
  });
});
