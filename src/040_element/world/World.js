phina.namespace(function() {

  phina.define('World', {
    superClass: 'DisplayElement',

    init: function(options) {
      this.superInit();
      this.setup();

      this.time = 0;
    },

    setup: function() {
      this.mapBase = DisplayElement()
        .setPosition(0, 0)
        .addChildTo(this);

      //レイヤー構築
      this.mapLayer = [];
      (NUM_LAYERS).times(i => {
        const layer = DisplayElement().addChildTo(this.mapBase);
        this.mapLayer[i] = layer;
      });

      this.player = Player()
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF)
        .addChildTo(this.mapLayer[LAYER_PLAYER]);

      this.setupMap();
    },
    update: function() {
      this.controlPlayer();

      this.mapBase.x = -this.player.x + SCREEN_WIDTH_HALF;
      this.mapBase.y = -this.player.y + SCREEN_HEIGHT_HALF;

      this.time++;
    },
    setupMap: function() {
      for (let i = 0; i < 1000; i++) {
        RectangleShape({
          width: Math.randint(50, 200),
          height: Math.randint(50, 200),
          fill: 'blue',
          stroke: '#aaa',
          strokeWidth: 4,
          cornerRadius: 0,
          x: Math.randint(-3000, 3000),
          y: Math.randint(-3000, 3000),
        }).addChildTo(this.mapLayer[LAYER_BACKGROUND]);
      }
    },
    controlPlayer: function() {
      const player = this.player;
      var ct = phina_app.controller;
      if (this.time % 3 == 0) {
        if (ct.left) {
          player.direction++;
          if (player.direction > 15) player.direction = 0;
        } else if (ct.right) {
          player.direction--;
          if (player.direction < 0) player.direction = 15;
        }
        player.sprite.setFrameIndex(player.direction);
        if (ct.up) {
          player.speed += 0.1;
          if (player.speed > 1) player.speed = 1;
          const rad = (player.direction * 22.5).toRadian();
          player.vx += -Math.sin(rad) * player.speed;
          player.vy += -Math.cos(rad) * player.speed;
          const vec = Vector2(player.vx, player.vy);
          if (vec.length > 2) {
            vec.normalize();
            player.vx = vec.x * 2;
            player.vy = vec.y * 2;
          }
        } else {
          player.speed *= 0.98;
        }
      }

      player.x += player.vx;
      player.y += player.vy;

      player.vx *= 0.99;
      player.vy *= 0.99;

      if (!ct.up) {
        player.vy += 0.098;
      }
    }
  });

});
