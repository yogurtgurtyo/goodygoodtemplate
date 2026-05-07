var config = {
  type: Phaser.AUTO,
  width: 800,
  height: 400,
  backgroundColor: "#1a1a2e",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 600 }, // how fast the player falls
      debug: false, // set to true to see physics boxes
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

var game = new Phaser.Game(config);

function preload() {
  // Background grid texture
  this.load.image("grid", "assets/2d/Background/Grid.png");

  // Tiled map and tileset image
  this.load.tilemapTiledJSON("level1", "maps/level1.tmj");
  this.load.image("terrain", "assets/2d/Terrain/Terrain (16x16).png");

  // Apple pickup image
  this.load.image("apple", "assets/2d/Items/Fruits/Apple_idle.png");

  // Pickup sound effect
  this.load.audio(
    "pickup-sfx",
    "assets/audio/GameSFX/PickUp/Retro PickUp Coin 07.wav",
  );

  // Player assets — defined in player.js
  playerPreload(this);

  // Enemy sprites — Mask Dude acts as the enemy character
  this.load.spritesheet(
    "enemy-idle",
    "assets/2d/Main Characters/Mask Dude/Idle (32x32).png",
    { frameWidth: 32, frameHeight: 32 },
  );
  this.load.spritesheet(
    "enemy-run",
    "assets/2d/Main Characters/Mask Dude/Run (32x32).png",
    { frameWidth: 32, frameHeight: 32 },
  );
}

function create() {
  // Build the tilemap from the loaded JSON file
  var map = this.make.tilemap({ key: "level1" });
  // 'Terrain' must match the tileset name inside level1.tmj
  var tileset = map.addTilesetImage("Terrain", "terrain");

  // Grid background — added first so it renders behind everything
  this.add
    .tileSprite(0, 0, map.widthInPixels, map.heightInPixels, "grid")
    .setOrigin(0, 0);

  // Ground tile layer — all non-empty tiles get collision
  var groundLayer = map.createLayer("ground", tileset, 0, 0);
  groundLayer.setCollisionByExclusion([-1]);

  // Raise the tile collision bias to match tile size (16px).
  // This prevents the player from snagging on tile corners while moving horizontally.
  this.physics.world.TILE_BIAS = 32;

  // Read the spawn position from the Tiled object layer
  var spawnLayer = map.getObjectLayer("spawnpoints");
  var spawn = spawnLayer.objects.find(function (obj) {
    return obj.name === "player";
  });

  // Create the player at the spawn point — defined in player.js
  var player = playerCreate(this, spawn.x, spawn.y, groundLayer);

  // ── Pickups ──────────────────────────────────
  // Read all objects from the spawnpoints layer that have type "pickups"
  var pickupGroup = this.physics.add.staticGroup();
  this.pickupGroup = pickupGroup; // expose on scene so enemy drops can add apples
  spawnLayer.objects.forEach(function (obj) {
    if (obj.type === "pickups") {
      // Tiled tile-objects have their origin at bottom-left, so shift to center
      var sprite = pickupGroup.create(
        obj.x + obj.width / 2,
        obj.y - obj.height / 2,
        "apple",
      );
      // Read health_points from object properties if present, otherwise default to 10
      var hp = 10;
      if (obj.properties) {
        var hpProp = obj.properties.find(function (p) {
          return p.name === "health_points";
        });
        if (hpProp) hp = hpProp.value;
      }
      sprite.healthPoints = hp;
    }
  });

  // Keep a reference to the scene so the callback below can use it
  var scene = this;

  // When the player overlaps an apple, flash it, remove it, and show popup text
  this.physics.add.overlap(
    player,
    pickupGroup,
    function (playerSprite, pickup) {
      var hp = pickup.healthPoints;
      var worldX = pickup.x;
      var worldY = pickup.y;

      // Disable physics body so this callback can't fire again for the same apple
      pickup.body.enable = false;

      // Heal the player — capped at max HP
      scene.playerHP = Math.min(PLAYER_MAX_HP, scene.playerHP + hp);

      // Play the pickup sound
      scene.sound.play("pickup-sfx");

      // Flash the apple: quickly blink alpha 3 times, then destroy it
      scene.tweens.add({
        targets: pickup,
        alpha: 0,
        duration: 80, // each half-blink is 80ms
        yoyo: true, // bounce back to alpha 1
        repeat: 2, // 3 full blinks total
        onComplete: function () {
          pickup.destroy();
        },
      });

      // Show "+N Health!" text floating up from the apple's position, then fade out
      var popupText = scene.add
        .text(worldX, worldY - 20, "+" + hp + " Health!", {
          fontSize: "22px",
          color: "#00ff44",
          stroke: "#000000",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1);

      scene.tweens.add({
        targets: popupText,
        y: worldY - 80, // floats upward
        alpha: 0,
        duration: 1200, // 1.2 seconds — long enough to read, quick enough to feel snappy
        ease: "Power1",
        onComplete: function () {
          popupText.destroy();
        },
      });
    },
  );
  // ─────────────────────────────────────────────

  // Camera follows the player and stays within the map
  this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  this.cameras.main.startFollow(player);
  this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  // Arrow key input
  this.cursors = this.input.keyboard.createCursorKeys();

  // WASD + Space — merged with arrow keys so either set works
  var wasd = this.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    space: Phaser.Input.Keyboard.KeyCodes.SPACE,
  });
  this.wasd = wasd;

  // Attach to the scene so update() can access them
  this.player = player;

  this.gameOver = false;
  this.survivalStart = this.time.now;

  // ── HUD — setScrollFactor(0) pins each element to the camera ───────────────
  // Black border behind the health bar
  this.add
    .rectangle(14, 14, 212, 26, 0x000000)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(20);
  // Red fill — width shrinks proportionally as the player loses HP
  this.hpBar = this.add
    .rectangle(16, 16, 200, 22, 0xff3333)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(21);
  // Small "HP" label below the bar
  this.add
    .text(16, 42, "HP", { fontSize: "14px", color: "#ffffff" })
    .setScrollFactor(0)
    .setDepth(20);
  // Survival timer centred at the top
  this.timerText = this.add
    .text(400, 10, "0:00", {
      fontSize: "22px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(20);

  // ── Enemy system ──────────────────────────────────────────────────────
  this.enemies = this.physics.add.group();
  this.enemyList = [];

  // Enemy animations
  this.anims.create({
    key: "enemy-idle",
    frames: this.anims.generateFrameNumbers("enemy-idle", { start: 0, end: 7 }),
    frameRate: 8,
    repeat: -1,
  });
  this.anims.create({
    key: "enemy-run",
    frames: this.anims.generateFrameNumbers("enemy-run", { start: 0, end: 7 }),
    frameRate: 12,
    repeat: -1,
  });

  // All enemies collide with ground tiles
  this.physics.add.collider(this.enemies, groundLayer);

  // Spawn starting enemies spread across the map
  spawnEnemy(this, 400, 50);
  spawnEnemy(this, 750, 50);
  spawnEnemy(this, 1100, 50);

  // Wave spawner — adds one more enemy every 10 seconds
  this.time.addEvent({
    delay: 10000,
    loop: true,
    callback: function () {
      if (scene.gameOver) return;
      var x = Phaser.Math.Between(100, map.widthInPixels - 100);
      spawnEnemy(scene, x, 50);
    },
  });

  // Player touching an enemy → take 20 damage (iframes prevent instant death)
  this.physics.add.overlap(
    player,
    this.enemies,
    function (playerSprite, enemy) {
      // Running state: player deals damage to the enemy instead of taking damage
      if (scene.dashing) {
        enemy.hp--;
        scene.tweens.add({
          targets: enemy,
          alpha: 0.3,
          duration: 60,
          yoyo: true,
          onComplete: function () { if (enemy.active) enemy.setAlpha(1); },
        });
        if (enemy.hp <= 0) {
          var drop = scene.pickupGroup.create(enemy.x, enemy.y, "apple");
          drop.healthPoints = 25;
          enemy.destroy();
        }
      } else {
        playerTakeDamage(playerSprite, 20);
      }
    },
  );

  // Cleaver hitting an enemy → damage and possibly kill the enemy
  this.physics.add.overlap(
    this.cleavers,
    this.enemies,
    function (cleaver, enemy) {
      // Remove the cleaver that hit
      var data = scene.cleaverData.find(function (d) {
        return d.cleaver === cleaver;
      });
      if (data) scene.removeCleaver(cleaver, data);

      // Flash enemy to signal the hit
      enemy.hp--;
      scene.tweens.add({
        targets: enemy,
        alpha: 0.3,
        duration: 60,
        yoyo: true,
        onComplete: function () {
          if (enemy.active) enemy.setAlpha(1);
        },
      });

      // Kill and drop an apple
      if (enemy.hp <= 0) {
        var drop = scene.pickupGroup.create(enemy.x, enemy.y, "apple");
        drop.healthPoints = 25; // picked up by the existing overlap handler
        enemy.destroy();
      }
    },
  );

  // ── Game Over ────────────────────────────────────────────────────────
  // Called by playerTakeDamage when HP hits zero.
  this.onPlayerDeath = function () {
    scene.gameOver = true;
    scene.physics.world.pause(); // freeze all physics

    // Calculate how long the player survived
    var elapsed = Math.floor((scene.time.now - scene.survivalStart) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins + ":" + (secs < 10 ? "0" : "") + secs;

    // Semi-transparent black overlay
    scene.add
      .rectangle(400, 200, 800, 400, 0x000000, 0.7)
      .setScrollFactor(0)
      .setDepth(50);

    scene.add
      .text(400, 140, "GAME OVER", {
        fontSize: "48px",
        color: "#ff3333",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(51);

    scene.add
      .text(400, 210, "Survived: " + timeStr, {
        fontSize: "26px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(51);

    scene.add
      .text(400, 265, "Press R to restart", {
        fontSize: "20px",
        color: "#aaaaaa",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(51);

    // Restart the scene when R is pressed
    scene.input.keyboard.once("keydown-R", function () {
      scene.physics.world.resume();
      scene.scene.restart();
    });
  };
}

// ── Spawn one enemy ─────────────────────────────────────────────────────
// Call this from create() or from the wave-spawner to add a new enemy.
function spawnEnemy(scene, x, y) {
  var enemy = scene.enemies.create(x, y, "enemy-idle");
  enemy.setDisplaySize(64, 64);
  enemy.setOrigin(0.5, 0.625);
  enemy.body.setSize(24, 44); // narrow hitbox so movement feels fair
  enemy.body.setOffset(20, 18);
  enemy.setCollideWorldBounds(true);
  enemy.hp = 3; // cleaver hits needed to kill
  enemy.dir = 1; // current patrol direction (1 = right, -1 = left)
  enemy.speed = 80; // patrol speed (px/s)
  enemy.chaseSpeed = 140; // speed when chasing the player
  scene.enemyList.push(enemy);
}

// ── Enemy AI update ──────────────────────────────────────────────────
// Called every frame from update(). Handles patrol and chase behavior.
function updateEnemies(scene) {
  var player = scene.player;
  for (var i = scene.enemyList.length - 1; i >= 0; i--) {
    var enemy = scene.enemyList[i];
    if (!enemy.active) {
      scene.enemyList.splice(i, 1); // clean up destroyed enemies
      continue;
    }
    var dx = player.x - enemy.x;
    var dist = Math.abs(dx);

    if (dist < 220) {
      // Chase — move straight toward the player
      var chaseDir = dx > 0 ? 1 : -1;
      enemy.setVelocityX(chaseDir * enemy.chaseSpeed);
      enemy.setFlipX(chaseDir < 0);
    } else {
      // Patrol — walk back and forth; flip when hitting a wall
      if (enemy.body.blocked.left) enemy.dir = 1;
      if (enemy.body.blocked.right) enemy.dir = -1;
      enemy.setVelocityX(enemy.dir * enemy.speed);
      enemy.setFlipX(enemy.dir < 0);
    }

    // Play the matching animation
    if (Math.abs(enemy.body.velocity.x) > 5) {
      enemy.anims.play("enemy-run", true);
    } else {
      enemy.anims.play("enemy-idle", true);
    }
  }
}

function update() {
  // Freeze all game logic while the game-over screen is showing
  if (this.gameOver) return;

  // Merge arrow keys and WASD+Space so either set controls the player
  var merged = {
    left: { isDown: this.cursors.left.isDown || this.wasd.left.isDown },
    right: { isDown: this.cursors.right.isDown || this.wasd.right.isDown },
    up: {
      isDown:
        this.cursors.up.isDown || this.wasd.up.isDown || this.wasd.space.isDown,
    },
    down: { isDown: this.cursors.down.isDown || this.wasd.down.isDown },
  };
  // JustDown must check both sources — wrap each direction so JustDown works on the merged object
  merged.left.getDuration = function () {
    return 0;
  };
  merged.right.getDuration = function () {
    return 0;
  };
  merged.up._justDown =
    Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
    Phaser.Input.Keyboard.JustDown(this.wasd.up) ||
    Phaser.Input.Keyboard.JustDown(this.wasd.space);
  merged.down._justDown = false;

  // Override JustDown globally for this frame so playerUpdate's JustDown check works
  var _origJustDown = Phaser.Input.Keyboard.JustDown;
  Phaser.Input.Keyboard.JustDown = function (key) {
    if (key === merged.up) return merged.up._justDown;
    if (key === merged.down) return merged.down._justDown;
    return _origJustDown(key);
  };

  // Movement and animation — defined in player.js
  playerUpdate(this.player, merged);

  // Restore JustDown after playerUpdate
  Phaser.Input.Keyboard.JustDown = _origJustDown;

  // ── HUD update ──────────────────────────────────────────────────────
  // Health bar: 200px wide at full HP, shrinks toward 0
  this.hpBar.width = Math.max(0, (this.playerHP / PLAYER_MAX_HP) * 200);

  // Survival timer formatted as M:SS
  var elapsed = Math.floor((this.time.now - this.survivalStart) / 1000);
  var mins = Math.floor(elapsed / 60);
  var secs = elapsed % 60;
  this.timerText.setText(mins + ":" + (secs < 10 ? "0" : "") + secs);

  // ── Enemy AI ───────────────────────────────────────────────────────
  updateEnemies(this);
}
