phina.namespace(function() {

  phina.define('BaseUnit', {
    superClass: 'DisplayElement',

    state: null,
    angle: 0,
    direction: 0,

    sprite: null,

    init: function(options) {
      this.superInit(options);
      this.world = options.world || null;
      this.base = DisplayElement().addChildTo(this);
      this.velocity = Vector2(0, 0);
    },
  });

});
