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
        .setPosition(SCREEN_WIDTH_HALF, SCREEN_HEIGHT_HALF-100)
        .addChildTo(this.mapLayer[LAYER_PLAYER]);

      this.setupMap();
    },
    update: function() {
      this.controlPlayer();

      var kb = phina_app.keyboard;
      if (this.time % 30 == 0 && kb.getKey("E")) {
        console.log("enter enemy");
        const e = EnemyyFighter({ player: this.player, world: this })
          .addChildTo(this.mapLayer[LAYER_ENEMY]);
      }

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
          player.direction--;
          if (player.direction < 0) player.direction = 15;
        } else if (ct.right) {
          player.direction++;
          if (player.direction > 15) player.direction = 0;
        }
        player.sprite.setFrameIndex(player.direction);
        if (ct.up) {
          player.speed += 0.1;
          if (player.speed > 1) player.speed = 1;
          const rad = (player.direction * 22.5).toRadian();
          player.velocity.x += Math.sin(rad) * player.speed;
          player.velocity.y += -Math.cos(rad) * player.speed;
          if (player.velocity.length > 2) {
            player.velocity.normalize();
            player.velocity.mul(2);
          }
        } else {
          player.speed *= 0.98;
        }
      }

      //下に落ちる
      if (!ct.up) player.velocity.y += 0.1;

      player.position.add(player.velocity);
      player.velocity.mul(0.99);

      //アフターバーナー
      if (ct.up) {
        const v = player.velocity.clone().mul(-1)
        player.afterBanner[0].enable().setVelocity(v);
        player.afterBanner[1].enable().setVelocity(v);
      } else {
        player.afterBanner[0].disable();
        player.afterBanner[1].disable();
      }

      if (ct.a) {
        
      }

      this.mapBase.x = SCREEN_WIDTH_HALF  - player.x - player.velocity.x * 3;
      this.mapBase.y = SCREEN_HEIGHT_HALF - player.y - player.velocity.y * 3;
    },
  });

});
