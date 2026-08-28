package com.example.funstuff.item;

import net.minecraft.core.particles.ColorParticleOption;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LightningBolt;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.List;

public class ThunderHammerItem extends Item {
	public ThunderHammerItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);

		if (level instanceof ServerLevel serverLevel) {
			double px = player.getX() + player.getLookAngle().x * 2.5;
			double py = player.getY();
			double pz = player.getZ() + player.getLookAngle().z * 2.5;

			// Cosmetic lightning bolt
			LightningBolt lightning = EntityType.LIGHTNING_BOLT.create(serverLevel, EntitySpawnReason.TRIGGERED);
			if (lightning != null) {
				lightning.snapTo(px, py, pz, 0, 0);
				lightning.setVisualOnly(true);
				serverLevel.addFreshEntity(lightning);
			}

			// Slam audio and particles
			serverLevel.playSound(null, px, py, pz, SoundEvents.ANVIL_LAND, SoundSource.PLAYERS, 1.3f, 0.9f);
			serverLevel.playSound(null, px, py, pz, SoundEvents.MACE_SMASH_GROUND, SoundSource.PLAYERS, 1.5f, 1.2f);
			serverLevel.sendParticles(ColorParticleOption.create(ParticleTypes.FLASH, 0xFF88FFFF), px, py + 0.5, pz, 2, 0.1, 0.1, 0.1, 0.0);

			// Expanding shockwave particle ring
			for (int deg = 0; deg < 360; deg += 15) {
				double rad = Math.toRadians(deg);
				double rx = px + Math.cos(rad) * 3.5;
				double rz = pz + Math.sin(rad) * 3.5;
				serverLevel.sendParticles(ParticleTypes.ELECTRIC_SPARK, rx, py + 0.2, rz, 3, 0.1, 0.1, 0.1, 0.05);
			}

			// Launch surrounding mobs skyward
			AABB zone = new AABB(px - 9.0, py - 3.0, pz - 9.0, px + 9.0, py + 6.0, pz + 9.0);
			List<LivingEntity> mobs = level.getEntitiesOfClass(LivingEntity.class, zone, e -> e != player);

			for (LivingEntity mob : mobs) {
				Vec3 away = mob.position().subtract(px, py, pz);
				Vec3 launch = away.normalize().scale(1.2);
				mob.setDeltaMovement(launch.x, 1.3, launch.z);
				mob.hurtMarked = true;
			}
		}

		player.getCooldowns().addCooldown(stack, 20);
		return InteractionResult.SUCCESS;
	}
}
