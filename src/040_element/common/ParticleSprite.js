phina.define("ParticleSprite", {
  superClass: 'phina.display.Sprite',

  _static: {
    defaultScale: 1.0,    // 初期スケール
    scaleDecay: 0.01,  // スケールダウンのスピード
  },
  init: function(options) {
    this.options = (options || {}).$safe({ stroke: false, radius: 24, scale: 1.0 });
    this.superInit("particle", 16, 16);

    this.blendMode = 'lighter';

    this.beginPosition = Vector2();
    this.velocity = this.options.velocity || Vector2(0, 0);
    this.one("enterframe", () => this.reset());
  },

  reset: function(x, y) {
    x = x || this.x;
    y = y || this.y;
    this.beginPosition.set(x, y);
    this.position.set(this.beginPosition.x, this.beginPosition.y);
    this.scaleX = this.scaleY = this.options.scale || Math.randfloat(ParticleSprite.defaulScale * 0.8, ParticleSprite.defaulScale * 1.2);
    this.scaleDecay = this.options.scaleDecay || ParticleSprite.scaleDecay;
  },

  update: function() {
    this.position.add(this.velocity);
    this.velocity.x *= 0.99;
    this.velocity.y *= 0.99;
    this.scaleX -= this.scaleDecay;
    this.scaleY -= this.scaleDecay;

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
