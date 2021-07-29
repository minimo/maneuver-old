phina.define("Laser", {
  superClass: 'phina.display.DisplayElement',

  _static: {
    defaultOptions: {
      length: 500,
    },
  },

  init: function(options) {
    this.options = (options || {}).$safe(Laser.defaultOptions);
    this.superInit(options);
    this.sprite = RectangleShape({ width: 8, height: this.options.length }).addChildTo(this);
  },

});

