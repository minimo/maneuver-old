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

      this.player = Player({ world: this })
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF)
        .addChildTo(this.mapLayer[LAYER_PLAYER]);

      this.setupMap();
    },
    update: function() {
      this.controlPlayer();

      const player = this.player;
      this.mapBase.x = SCREEN_WIDTH_HALF  - player.x - player.velocity.x * 3;
      this.mapBase.y = SCREEN_HEIGHT_HALF - player.y - player.velocity.y * 3;

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
          x: Math.randint(-10000, 10000),
          y: Math.randint(-5000, 5000),
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
          player.velocity.x += -Math.sin(rad) * player.speed;
          player.velocity.y += -Math.cos(rad) * player.speed;
          if (player.velocity.length > 2) {
            player.velocity.normalize();
            player.velocity.mul(2);
          }
        } else {
          player.speed *= 0.98;
        }
      }

      if (!ct.up) {
        player.velocity.y += 0.1;
      } else {
        (3).times(i => {
          const deg = player.direction * 22.5;
          const rad = (deg + Math.randint(-1, 1)).toRadian();
          const vec = Vector2(Math.sin(rad), Math.cos(rad));
          const p = Particle({ radius: Math.randint(8, 16) })
            .setPosition(player.x + vec.x * 16, player.y + vec.y * 16)
            .setRotation(-deg)
            .setVelocity(vec.mul(10))
            .addChildTo(this.mapLayer[LAYER_PLAYER]);
        });
      }
      if (ct.a) {
        
      }

      player.position.add(player.velocity);
      player.velocity.mul(0.99);
    }
  });

});
