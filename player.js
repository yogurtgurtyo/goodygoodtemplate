// ─────────────────────────────────────────────
//  player.js — Pink Man player character
//  Edit this file to change how the player looks and feels.
// ─────────────────────────────────────────────

// ── Tuning values ──────────────────────────────
var PLAYER_SPEED = 220; // horizontal move speed (pixels/sec)
var PLAYER_SPRINT_SPEED = 380; // speed while holding Shift
var PLAYER_JUMP = -500; // jump velocity — more negative = higher jump
var PLAYER_CHAR = "Pink Man"; // folder name inside assets/2d/Main Characters/

// Hitbox size — smaller than the 32x32 sprite frame to avoid snagging on tile corners
// and to give the player a "generous" feel (hazards must clearly overlap to register).
// Turn on debug: true in game.js to see the green hitbox while tuning these.
var PLAYER_HITBOX_WIDTH = 32; // pixels wide
var PLAYER_HITBOX_HEIGHT = 48; // pixels tall
var PLAYER_HITBOX_OFFSET_X = 0; // shift right to center the hitbox in the frame
var PLAYER_HITBOX_OFFSET_Y = 12; // shift down  to align feet with the bottom of the frame

// Crouched hitbox — shorter than standing; offsetY keeps feet planted on the ground.
// Rule: CROUCH_OFFSET_Y = HITBOX_OFFSET_Y + (HITBOX_HEIGHT - CROUCH_HEIGHT)
var PLAYER_CROUCH_HEIGHT = 16; // pixels tall while crouching
var PLAYER_CROUCH_OFFSET_Y = 56; // = 8 + (64 - 16)

// Fire attack — delay (ms) between pressing X and the fire effect appearing.
// 0 = instant; 300 = fire spawns 0.3 seconds into the attack animation.
var ATTACK_FIRE_DELAY = 300;

// Running state (C key) tuning
var DASH_SPEED = 500;               // pixels/sec while the running state is active
var DASH_DURATION = 5000;           // how long the running state lasts (ms)
var DASH_COOLDOWN = 5000;           // cooldown before you can activate it again (ms)
var DASH_AFTERIMAGE_INTERVAL = 50;  // ms between each afterimage ghost

// ── Asset loading ──────────────────────────────
// Called from preload() in game.js
function playerPreload(scene) {
  var base = "assets/2d/Main Characters/" + PLAYER_CHAR + "/";
  scene.load.spritesheet("player-idle", base + "Idle (32x32).png", {
    frameWidth: 64,
    frameHeight: 64,
  });
  scene.load.spritesheet("player-run", base + "Run (32x32).png", {
    frameWidth: 64,
    frameHeight: 64,
  });
  scene.load.spritesheet("player-jump", base + "Jump (32x32).png", {
    frameWidth: 64,
    frameHeight: 64,
  });
  scene.load.spritesheet("player-fall", base + "Fall (32x32).png", {
    frameWidth: 64,
    frameHeight: 64,
  });
  scene.load.spritesheet("player-crouch", base + "Crouch (32x32).png", {
    frameWidth: 32,
    frameHeight: 32,
  });
  // Fire attack — 8 frames at 64x64 (upscaled from the 32x32 sheet)
  scene.load.spritesheet(
    "player-fire-attack",
    base + "Fire Attack (32x32).png",
    {
      frameWidth: 64,
      frameHeight: 64,
    },
  );
  // Fire effect shown in front of the player during the attack (4 frames, native 32x32)
  scene.load.spritesheet("attack-fire", base + "Fire (32x32).png", {
    frameWidth: 32,
    frameHeight: 32,
  });
  scene.load.audio(
    "jump-sfx",
    "assets/audio/GameSFX/Bounce Jump/Retro Jump Simple C2 02.wav",
  ); // jump sound effect

  // Load boomerang cleaver sprite (weapon) as a spritesheet
  scene.load.spritesheet(
    "cleaver",
    "assets/2d/Items/Weapons/tikitiitikitiki.png",
    {
      frameWidth: 32,
      frameHeight: 32,
      endFrame: 3,
    },
  );
}

// ── Create player sprite + animations ──────────
// Called from create() in game.js. Returns the player sprite.
function playerCreate(scene, x, y, groundLayer) {
  var player = scene.physics.add.sprite(x, y, "player-idle");
  player.setCollideWorldBounds(true); // can't walk off the edge of the map

  // Lock display size to 32x32 so the run animation's 64x64 frames don't shift the
  // physics body position when the animation switches. Without this, Phaser recalculates
  // the body position using displayWidth/displayHeight, causing the player to sink into
  // the floor whenever the run animation plays.
  player.setDisplaySize(64, 64);
  // Shift sprite up 8px visually. originY=0.625 moves render up 8px on a 64px display.
  // PLAYER_HITBOX_OFFSET_Y is increased by 8 to cancel this out for the physics body.
  player.setOrigin(0.5, 0.625);

  // Shrink the physics hitbox so it matches the visible character, not the full frame.
  // Reduces edge-lock on tile corners and makes hazard hits feel fair.
  player.body.setSize(PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_HEIGHT);
  player.body.setOffset(PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_OFFSET_Y);

  // Collide with ground tiles
  scene.physics.add.collider(player, groundLayer);

  // Animations — edit frameRate to speed up or slow down
  scene.anims.create({
    key: "idle",
    frames: scene.anims.generateFrameNumbers("player-idle", {
      start: 0,
      end: 7,
    }),
    frameRate: 8,
    repeat: -1, // loop forever
  });
  scene.anims.create({
    key: "run",
    frames: scene.anims.generateFrameNumbers("player-run", {
      start: 0,
      end: 7,
    }),
    frameRate: 12,
    repeat: -1,
  });
  scene.anims.create({
    key: "jump",
    frames: scene.anims.generateFrameNumbers("player-jump", {
      start: 0,
      end: 0,
    }),
    frameRate: 1,
    repeat: 0,
  });
  scene.anims.create({
    key: "fall",
    frames: scene.anims.generateFrameNumbers("player-fall", {
      start: 0,
      end: 0,
    }),
    frameRate: 1,
    repeat: 0,
  });
  scene.anims.create({
    key: "crouch",
    frames: scene.anims.generateFrameNumbers("player-crouch", {
      start: 0,
      end: 1,
    }),
    frameRate: 10, // plays the drop in ~0.2 seconds, then holds on the crouched pose
    repeat: 0,
  });

  // ── Boomerang Cleaver Setup ──
  // Create a group to hold cleavers
  scene.cleavers = scene.physics.add.group();
  scene.maxCleavers = 3;
  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  // Sprint key
  scene.shiftKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SHIFT,
  );
  scene.cleaverData = [];

  // Cleaver animation (4 frames, loop)
  scene.anims.create({
    key: "cleaver-spin",
    frames: scene.anims.generateFrameNumbers("cleaver", { start: 0, end: 3 }),
    frameRate: 24,
    repeat: -1,
  });

  // Fire attack animation — plays once on the player when X is pressed (8 frames)
  scene.anims.create({
    key: "fire-attack",
    frames: scene.anims.generateFrameNumbers("player-fire-attack", {
      start: 0,
      end: 7,
    }),
    frameRate: 16,
    repeat: 0, // plays once; does not loop
  });
  // Fire effect animation — plays on the spawned effect sprite (4 frames)
  scene.anims.create({
    key: "attack-fire-effect",
    frames: scene.anims.generateFrameNumbers("attack-fire", {
      start: 0,
      end: 3,
    }),
    frameRate: 16,
    repeat: 0,
  });
  // Use nearest-neighbor filtering so the fire renders crisp pixels instead of blurry
  scene.textures
    .get("attack-fire")
    .setFilter(Phaser.Textures.FilterMode.NEAREST);

  // Attack key and state
  scene.xKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  scene.attacking = false;
  // When the fire-attack animation finishes, leave the attack state
  player.on("animationcomplete-fire-attack", function () {
    scene.attacking = false;
  });

  // Running state key and state
  scene.cKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
  scene.dashing = false;         // true while the running state is active
  scene.dashEndTime = 0;         // when the running state expires
  scene.dashCooldownEnd = 0;     // when the cooldown expires
  scene.dashLastAfterimage = 0;  // timestamp of last ghost spawned
  scene.dashDir = 1;             // direction locked when running state started

  // Helper to remove cleaver
  scene.removeCleaver = function (cleaver, data) {
    if (cleaver && cleaver.active) cleaver.destroy();
    var idx = scene.cleaverData.indexOf(data);
    if (idx !== -1) scene.cleaverData.splice(idx, 1);
  };

  return player;
}

// ── Movement + animation each frame ────────────
// Called from update() in game.js.
function playerUpdate(player, cursors) {
  var scene = player.scene;
  var onGround = player.body.blocked.down;
  var crouching = cursors.down.isDown && onGround;
  var sprinting = scene.shiftKey.isDown && !crouching; // Shift = sprint
  var currentSpeed = sprinting ? PLAYER_SPRINT_SPEED : PLAYER_SPEED;

  // Resize hitbox based on crouch state
  if (crouching) {
    player.body.setSize(PLAYER_HITBOX_WIDTH, PLAYER_CROUCH_HEIGHT);
    player.body.setOffset(PLAYER_HITBOX_OFFSET_X, PLAYER_CROUCH_OFFSET_Y);
  } else {
    player.body.setSize(PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_HEIGHT);
    player.body.setOffset(PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_OFFSET_Y);
  }

  // Left / right movement — blocked while crouching or attacking; Shift to sprint
  // Running state overrides normal movement while active.
  var now = scene.time.now;
  var cKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);

  // ── Running State (C key) ──
  // Activate if C pressed, not already running, not attacking, cooldown done
  if (
    Phaser.Input.Keyboard.JustDown(cKey) &&
    !scene.dashing &&
    !scene.attacking &&
    now > scene.dashCooldownEnd
  ) {
    scene.dashing = true;
    scene.dashEndTime = now + DASH_DURATION;
    scene.dashCooldownEnd = now + DASH_COOLDOWN;
    // Lock the run direction to whichever way the player is currently facing
    scene.dashDir = player.flipX ? -1 : 1;
  }

  // End the running state when its time runs out
  if (scene.dashing && now >= scene.dashEndTime) {
    scene.dashing = false;
  }

  if (scene.dashing) {
    // Always move in the locked direction at DASH_SPEED, even if no key is held
    player.setVelocityX(scene.dashDir * DASH_SPEED);
    player.setFlipX(scene.dashDir < 0);
    // Allow turning direction by pressing the opposite movement key
    if (!crouching && cursors.left.isDown) {
      scene.dashDir = -1;
      player.setFlipX(true);
    } else if (!crouching && cursors.right.isDown) {
      scene.dashDir = 1;
      player.setFlipX(false);
    }
    // Spawn afterimage ghosts
    if (now - scene.dashLastAfterimage > DASH_AFTERIMAGE_INTERVAL) {
      scene.dashLastAfterimage = now;
      var frameIndex = player.anims.currentFrame
        ? player.anims.currentFrame.index
        : 0;
      var ghost = scene.add.image(
        player.x,
        player.y,
        player.texture.key,
        frameIndex,
      );
      ghost.setDisplaySize(player.displayWidth, player.displayHeight);
      ghost.setOrigin(player.originX, player.originY);
      ghost.setFlipX(player.flipX);
      ghost.setDepth(player.depth - 1);
      ghost.setAlpha(0.5);
      ghost.setTint(0x88ccff); // light blue tint
      scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 300,
        onComplete: function (tween, targets) {
          targets[0].destroy();
        },
      });
    }
  }

  if (!scene.dashing) {
    // Normal left/right movement — blocked while crouching or attacking
    if (!crouching && !scene.attacking && cursors.left.isDown) {
      player.setVelocityX(-currentSpeed);
      player.setFlipX(true);
    } else if (!crouching && !scene.attacking && cursors.right.isDown) {
      player.setVelocityX(currentSpeed);
      player.setFlipX(false);
    } else {
      player.setVelocityX(0);
    }
  }

  // Jump — not allowed while attacking
  if (cursors.up.isDown && onGround && !scene.attacking) {
    player.setVelocityY(PLAYER_JUMP);
  }

  // Play jump sound once per keypress
  if (
    Phaser.Input.Keyboard.JustDown(cursors.up) &&
    onGround &&
    !scene.attacking
  ) {
    scene.sound.play("jump-sfx");
  }

  // ── Fire Attack (X key) ──
  var xKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
  if (!scene.attacking && onGround && Phaser.Input.Keyboard.JustDown(xKey)) {
    scene.attacking = true;
    player.setVelocityX(0); // stop horizontal movement during the attack
    player.anims.play("fire-attack", true);
    // Capture position and direction now so the fire spawns at the right spot after the delay
    var attackDir = player.flipX ? -1 : 1;
    var fireSpawnX = player.x + attackDir * 50;
    var fireSpawnY = player.y - 15;
    var fireFlipX = player.flipX;
    scene.time.delayedCall(ATTACK_FIRE_DELAY, function () {
      var fireEffect = scene.add.sprite(fireSpawnX, fireSpawnY, "attack-fire");
      fireEffect.setDisplaySize(96, 96);
      fireEffect.setDepth(5);
      fireEffect.setFlipX(fireFlipX);
      fireEffect.anims.play("attack-fire-effect");
      // Destroy the effect sprite once its animation finishes
      fireEffect.on("animationcomplete", function () {
        fireEffect.destroy();
      });
    });
  }

  // ── Boomerang Cleaver Mechanic ──
  var zKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  var now = scene.time.now;

  // Throw cleaver if Z is just pressed and under max
  if (
    Phaser.Input.Keyboard.JustDown(zKey) &&
    scene.cleaverData.length < scene.maxCleavers
  ) {
    var dir = player.flipX ? -1 : 1;
    var cleaver = scene.cleavers.create(
      player.x + dir * 20,
      player.y,
      "cleaver",
    );
    cleaver.setDepth(10);
    cleaver.setVelocityX(dir * 350);
    cleaver.setVelocityY(-60 + Phaser.Math.Between(-20, 20));
    cleaver.body.allowGravity = false;
    cleaver.owner = player;
    cleaver.anims.play("cleaver-spin");
    console.log("thrown");
    var data = {
      cleaver: cleaver,
      thrownAt: now,
      returning: false,
      stopped: false,
      charged: false,
      chargeStart: 0,
      dir: dir,
      speed: 350,
      maxSpeed: 700,
      minSpeed: 350,
      chargeTime: 0,
      chargePower: 1,
      state: "thrown",
      lastAfterimageTime: 0, // tracks when the last afterimage ghost was spawned
    };
    scene.cleaverData.push(data);
  }

  // Cleaver return and magnetize logic
  // Update all cleavers
  for (var i = scene.cleaverData.length - 1; i >= 0; i--) {
    var d = scene.cleaverData[i];
    var c = d.cleaver;
    if (!c.active) {
      scene.removeCleaver(c, d);
      continue;
    }
    var t = now - d.thrownAt;
    var dx = player.x - c.x;
    var dy = player.y - c.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // ── Afterimage effect — spawn a fading ghost every 50ms while the cleaver is moving
    if (now - d.lastAfterimageTime > 50 && !d.stopped) {
      d.lastAfterimageTime = now;
      var frameIndex = c.anims.currentFrame ? c.anims.currentFrame.index : 0;
      var ghost = scene.add.image(c.x, c.y, "cleaver", frameIndex);
      ghost.setDepth(9); // just behind the real cleaver (depth 10)
      ghost.setAlpha(0.5); // semi-transparent
      ghost.setFlipX(c.flipX);
      ghost.setDisplaySize(c.displayWidth, c.displayHeight);
      // Fade the ghost out over 200ms, then remove it
      scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 200,
        onComplete: function (tween, targets) {
          targets[0].destroy();
        },
      });
    }

    // If Z is held after 0.5s, stop and charge
    if (!d.stopped && zKey.isDown && t > 500 && !d.returning) {
      d.stopped = true;
      d.chargeStart = now;
      d.state = "charging";
      c.setVelocity(0, 0);
      c.body.allowGravity = false;
    }

    // While charging, increase power up to 1.5s
    if (d.stopped && !d.charged) {
      d.chargeTime = Math.min(now - d.chargeStart, 1500);
      d.chargePower = 1 + d.chargeTime / 1500;
      if (d.chargeTime >= 1500) {
        d.charged = true;
      }
    }

    // If charging and Z is released, return fast
    if (d.stopped && Phaser.Input.Keyboard.JustUp(zKey)) {
      // When Z is released, all stopped (charging) cleavers return
      for (var j = 0; j < scene.cleaverData.length; j++) {
        var other = scene.cleaverData[j];
        if (other.stopped && !other.returning) {
          other.returning = true;
          other.state = "returning";
          other.returnSpeed = Phaser.Math.Linear(
            other.minSpeed,
            other.maxSpeed,
            other.chargePower - 1,
          );
          other.cleaver.body.allowGravity = false;
        }
      }
    }

    // If not charging, return after 0.5s
    if (!d.stopped && !d.returning && t > 500) {
      d.returning = true;
      d.state = "returning";
      d.returnSpeed = d.minSpeed;
      c.body.allowGravity = false;
    }

    // If out for >2.5s, force magnetize return
    if (!d.stopped && !d.returning && t > 2500) {
      d.returning = true;
      d.state = "magnetized";
      d.returnSpeed = d.maxSpeed;
      c.body.allowGravity = false;
    }

    // Move cleaver toward player if returning
    if (d.returning) {
      var angle = Math.atan2(dy, dx);
      var speed = d.returnSpeed || d.minSpeed;
      c.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
    // Ensure cleaver is animating while active
    if (
      c.anims &&
      (!c.anims.isPlaying || c.anims.currentAnim.key !== "cleaver-spin")
    ) {
      c.anims.play("cleaver-spin");
    }

    // If returning and close to player, remove
    if (d.returning && dist < 24) {
      scene.removeCleaver(c, d);
      continue;
    }
  }

  // Update all cleavers
  for (var i = scene.cleaverData.length - 1; i >= 0; i--) {
    var d = scene.cleaverData[i];
    var c = d.cleaver;
    if (!c.active) {
      scene.removeCleaver(c, d);
      continue;
    }
    var t = now - d.thrownAt;
    var dx = player.x - c.x;
    var dy = player.y - c.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // If Z is held after 0.5s, stop and charge
    if (!d.stopped && zKey.isDown && t > 500 && !d.returning) {
      d.stopped = true;
      d.chargeStart = now;
      d.state = "charging";
      c.setVelocity(0, 0);
      c.body.allowGravity = false;
    }

    // While charging, increase power up to 1.5s
    if (d.stopped && !d.charged) {
      d.chargeTime = Math.min(now - d.chargeStart, 1500);
      d.chargePower = 1 + d.chargeTime / 1500;
      if (d.chargeTime >= 1500) {
        d.charged = true;
      }
    }

    // If charging and Z is released, return fast
    if (d.stopped && Phaser.Input.Keyboard.JustUp(zKey)) {
      d.returning = true;
      d.state = "returning";
      d.returnSpeed = Phaser.Math.Linear(
        d.minSpeed,
        d.maxSpeed,
        d.chargePower - 1,
      );
      c.body.allowGravity = false;
    }

    // If not charging, return after 0.5s
    if (!d.stopped && !d.returning && t > 500) {
      d.returning = true;
      d.state = "returning";
      d.returnSpeed = d.minSpeed;
      c.body.allowGravity = false;
    }

    // If out for >2.5s, force return
    if (!d.stopped && !d.returning && t > 2500) {
      d.returning = true;
      d.state = "returning";
      d.returnSpeed = d.maxSpeed;
      c.body.allowGravity = false;
    }

    // If returning and close to player, remove
    if (d.returning && dist < 24) {
      scene.removeCleaver(c, d);
      continue;
    }
  }

  // Play the right animation based on what the player is doing
  // Use a velocity threshold for fall so tile-seam physics glitches don't flicker the animation.
  if (scene.attacking) {
    // fire-attack is already playing — don't override it
  } else if (scene.dashing) {
    // play run at full speed during dash
    player.anims.play("run", true);
    player.anims.msPerFrame = 1000 / 24;
  } else if (!onGround) {
    if (player.body.velocity.y < 0) {
      player.anims.play("jump", true);
    } else if (player.body.velocity.y > 120) {
      player.anims.play("fall", true);
    }
    // else: velocity.y is near zero — keep the current animation to avoid a 1-frame flicker
  } else if (crouching) {
    if (
      !player.anims.currentAnim ||
      player.anims.currentAnim.key !== "crouch"
    ) {
      player.anims.play("crouch");
    }
  } else if (cursors.left.isDown || cursors.right.isDown) {
    player.anims.play("run", true);
    // Speed up the run animation while sprinting
    player.anims.msPerFrame = sprinting ? 1000 / 20 : 1000 / 12;
  } else {
    player.anims.play("idle", true);
  }
}
