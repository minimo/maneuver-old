phina.define("Particle", {
  superClass: 'phina.display.CircleShape',

  _static: {
    defaultColor: {
      start: 10, // color angle の開始値
      end: 30,   // color angle の終了値
    },
    velocityRangeX: 8,  // 速度の初期値の範囲 x
    velocityRangeY: 8,  // 速度の初期値の範囲 y
    defaulScale: 1,     // 初期スケール
    scaleDecay: 0.025,  // スケールダウンのスピード
  },
  init: function(options) {
    options = options || {};
    this.superInit({ stroke: false, radius: 24 });

    this.blendMode = 'lighter';

    const color = options.color || Particle.defaultColor;
    const grad = this.canvas.context.createRadialGradient(0, 0, 0, 0, 0, this.radius);
    grad.addColorStop(0, 'hsla({0}, 75%, 50%, 1.0)'.format(Math.randint(color.start, color.end)));
    grad.addColorStop(1, 'hsla({0}, 75%, 50%, 0.0)'.format(Math.randint(color.start, color.end)));

    this.fill = grad;

    this.beginPosition = Vector2();
    this.velocity = options.velocity || Vector2();
    this.one("enterframe", () => this.reset(this.x, this.y));
  },

  reset: function(x, y) {
    this.beginPosition.set(x, y);
    this.position.set(this.beginPosition.x, this.beginPosition.y);
    // this.velocity.set(
    //   Math.randint(-PARTICLE_VELOCITY_RANGE_X, PARTICLE_VELOCITY_RANGE_X),
    //   Math.randint(-PARTICLE_VELOCITY_RANGE_Y, PARTICLE_VELOCITY_RANGE_Y)
    // );
    this.scaleX = this.scaleY = Math.randfloat(Particle.defaulScale * 0.8, Particle.defaulScale * 1.2);
  },

  update: function() {
    this.position.add(this.velocity);
    this.velocity.x *= 0.99;
    this.velocity.y *= 0.99;
    this.scaleX -= Particle.scaleDecay;
    this.scaleY -= Particle.scaleDecay;

    if (this.scaleX < 0) this.remove();
  },

  setVelocity: function(x, y) {
    if (x instanceof Vector2) {
      this.velocity = x;
      return this;
    }
    this.velocity.x = x;
    this.velocity.x = y;
    return this;
  },

});
