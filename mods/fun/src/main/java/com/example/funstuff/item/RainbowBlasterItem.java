package com.example.funstuff.item;

import net.minecraft.core.particles.ColorParticleOption;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.List;

public class RainbowBlasterItem extends Item {
	public RainbowBlasterItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);
		Vec3 eyePos = player.getEyePosition();
		Vec3 look = player.getLookAngle();
		double range = 32.0;

		if (level instanceof ServerLevel serverLevel) {
			serverLevel.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.AMETHYST_CLUSTER_HIT, SoundSource.PLAYERS, 1.3f, 1.8f);
			serverLevel.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.FIREWORK_ROCKET_TWINKLE, SoundSource.PLAYERS, 1.0f, 1.6f);

			// Draw prismatic rainbow laser beam
			for (double d = 1.0; d < range; d += 0.8) {
				Vec3 pt = eyePos.add(look.scale(d));
				serverLevel.sendParticles(ParticleTypes.END_ROD, pt.x, pt.y, pt.z, 1, 0.05, 0.05, 0.05, 0.01);
				if ((int) d % 2 == 0) {
					serverLevel.sendParticles(ParticleTypes.FIREWORK, pt.x, pt.y, pt.z, 2, 0.1, 0.1, 0.1, 0.02);
				}
			}

			// Piercing beam hit test
			AABB beamBox = player.getBoundingBox().expandTowards(look.scale(range)).inflate(1.2);
			List<Entity> entities = level.getEntities(player, beamBox, e -> true);

			for (Entity entity : entities) {
				Vec3 toEntity = entity.position().add(0, entity.getBbHeight() / 2.0, 0).subtract(eyePos);
				// Distance to ray line
				double dot = toEntity.dot(look);
				if (dot > 0 && dot < range) {
					Vec3 projOnRay = look.scale(dot);
					double distToRay = toEntity.subtract(projOnRay).length();
					if (distToRay < 1.8) {
						if (entity instanceof Projectile proj) {
							// Disintegrate incoming hostile projectiles
							serverLevel.sendParticles(ColorParticleOption.create(ParticleTypes.FLASH, 0xFFFF55FF), proj.getX(), proj.getY(), proj.getZ(), 1, 0, 0, 0, 0);
							proj.discard();
						} else if (entity instanceof LivingEntity living) {
							// Knockback along look direction
							living.setDeltaMovement(look.x * 1.5, 0.6, look.z * 1.5);
							living.hurtMarked = true;
							serverLevel.sendParticles(ParticleTypes.ELECTRIC_SPARK, living.getX(), living.getY() + 1.0, living.getZ(), 10, 0.3, 0.3, 0.3, 0.1);
						}
					}
				}
			}
		}

		player.getCooldowns().addCooldown(stack, 8);
		return InteractionResult.SUCCESS;
	}
}
