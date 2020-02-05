phina.namespace(function() {

  phina.define('BaseUnit', {
    superClass: 'DisplayElement',

    state: null,
    angle: 0,
    direction: 0,
    vx: 0,
    vy: 0,

    sprite: null,

    init: function(options) {
      this.superInit(options);
      this.base = DisplayElement().addChildTo(this);
    },
  });

});
