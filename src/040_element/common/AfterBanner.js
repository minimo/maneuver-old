phina.define("AfterBanner", {
  superClass: 'phina.accessory.Accessory',

  init: function(target) {
    this.superInit(target);
    this.offset = Vector2(0, 0);
    this.before = null;
  },

  setOffset: function (x, y) {
    if (x instanceof Vector2) {
      this.offset.set(x.x, y.x);
      return this;
    }
    this.offset.set(x, y);
    return this;
  },

  update: function() {
    const target = this.target;
    const options = { scale: 0.3 * target.speed || 1};
    const pos = target.position.clone().add(this.offset);
    if (this.before) {
      const dis = unit.position.distance(this.before);
      const numSplit = Math.max(Math.floor(dis / 3), 6);
      const unitSplit = (1 / numSplit);
      numSplit.times(i => {
        const per = unitSplit * i;
        const pPos = Vector2(pos.x * per + this.before.x * (1 - per), pos.y * per + this.before.y * (1 - per))
        const p = ParticleSprite(options)
          .setPosition(pPos.x, pPos.y)
          .addChildTo(target.world.mapLayer[LAYER_EFFECT_BACK]);
      });
    } else {
      this.before = Vector2();
    }
    this.before.set(pos.x, pos.y);
  },
});
