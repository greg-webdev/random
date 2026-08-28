package com.example.funstuff.item;

import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.ExperienceOrb;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.List;

public class PocketBlackHoleItem extends Item {
	public PocketBlackHoleItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);

		if (level instanceof ServerLevel serverLevel) {
			double px = player.getX();
			double py = player.getY() + 0.8;
			double pz = player.getZ();

			// Play sucking/vortex sound
			serverLevel.playSound(null, px, py, pz, SoundEvents.PORTAL_TRAVEL, SoundSource.PLAYERS, 0.7f, 1.8f);
			serverLevel.playSound(null, px, py, pz, SoundEvents.ENDERMAN_TELEPORT, SoundSource.PLAYERS, 1.0f, 1.5f);

			// Spiral vortex particles
			serverLevel.sendParticles(ParticleTypes.REVERSE_PORTAL, px, py, pz, 50, 1.5, 1.5, 1.5, 0.4);
			serverLevel.sendParticles(ParticleTypes.PORTAL, px, py, pz, 40, 2.0, 2.0, 2.0, 0.5);

			// Find all loose items, experience orbs, and arrows within 25 blocks
			AABB vacuumZone = player.getBoundingBox().inflate(25.0);
			List<Entity> attractables = level.getEntitiesOfClass(
				Entity.class,
				vacuumZone,
				e -> (e instanceof ItemEntity || e instanceof ExperienceOrb || e instanceof AbstractArrow)
			);

			for (Entity target : attractables) {
				Vec3 diff = new Vec3(px - target.getX(), py - target.getY(), pz - target.getZ());
				double dist = diff.length();
				if (dist > 0.1) {
					Vec3 velocity = diff.normalize().scale(Math.min(1.8, Math.max(0.6, dist * 0.15)));
					target.setDeltaMovement(velocity);
					target.hurtMarked = true;
				}
			}
		}

		player.getCooldowns().addCooldown(stack, 15);
		return InteractionResult.SUCCESS;
	}
}
