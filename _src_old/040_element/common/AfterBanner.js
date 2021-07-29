phina.define("AfterBanner", {
  superClass: 'phina.accessory.Accessory',

  init: function(target) {
    this.superInit(target);

    this.isDisable = false;
    this.layer = null;
    this.offset = Vector2(0, 0);
    this.velocity = Vector2(0, 0);
    this.before = null;
  },

  setLayer: function(layer) {
    this.layer = layer;
    return this;
  },

  enable: function() {
    this.isDisable = false;
    return this;
  },

  disable: function() {
    this.isDisable = true;
    return this;
  },

  setOffset: function (x, y) {
    if (x instanceof Vector2) {
      this.offset.set(x.x, x.y);
      return this;
    }
    this.offset.set(x, y);
    return this;
  },

  setVelocity: function(x, y) {
    if (x instanceof Vector2) {
      this.velocity = x.clone().mul(-1);
      return this;
    }
    this.velocity.x = x;
    this.velocity.x = y;
    return this;
  },

  update: function() {
    if (this.isDisable) {
      this.before = null;
      return;
    }
    const target = this.target;
    const options = { scale: 0.3 };
    const pos = target.position.clone().add(this.offset);
    if (this.before) {
      const dis = target.position.distance(this.before);
      const numSplit = Math.max(Math.floor(dis / 3), 6);
      const unitSplit = (1 / numSplit);
      numSplit.times(i => {
        const per = unitSplit * i;
        const pPos = Vector2(pos.x * per + this.before.x * (1 - per), pos.y * per + this.before.y * (1 - per))
        ParticleSprite(options)
          .setPosition(pPos.x, pPos.y)
          .addChildTo(this.layer);
      });
      this.before.set(pos.x, pos.y);
    } else {
      this.before = Vector2(pos.x, pos.y);
    }
  },
});
