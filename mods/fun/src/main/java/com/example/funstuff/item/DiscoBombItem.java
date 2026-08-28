package com.example.funstuff.item;

import net.minecraft.core.particles.ColorParticleOption;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.animal.sheep.Sheep;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.DyeColor;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.AABB;

import java.util.List;

public class DiscoBombItem extends Item {
	public DiscoBombItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);

		if (level instanceof ServerLevel serverLevel) {
			double x = player.getX() + player.getLookAngle().x * 3.0;
			double y = player.getY() + 0.5;
			double z = player.getZ() + player.getLookAngle().z * 3.0;

			// Blast visual and audio effects
			serverLevel.sendParticles(ColorParticleOption.create(ParticleTypes.FLASH, 0xFFFFFFFF), x, y + 1.0, z, 3, 0.2, 0.2, 0.2, 0.0);
			serverLevel.sendParticles(ParticleTypes.NOTE, x, y + 1.5, z, 40, 2.5, 2.0, 2.5, 0.5);
			serverLevel.sendParticles(ParticleTypes.HEART, x, y + 1.0, z, 20, 2.0, 1.5, 2.0, 0.2);
			serverLevel.sendParticles(ParticleTypes.FIREWORK, x, y + 2.0, z, 50, 2.0, 2.0, 2.0, 0.3);

			serverLevel.playSound(null, x, y, z, SoundEvents.FIREWORK_ROCKET_BLAST, SoundSource.PLAYERS, 1.5f, 1.1f);
			serverLevel.playSound(null, x, y, z, SoundEvents.NOTE_BLOCK_BELL.value(), SoundSource.PLAYERS, 1.8f, 1.5f);
			serverLevel.playSound(null, x, y, z, SoundEvents.AMETHYST_BLOCK_CHIME, SoundSource.PLAYERS, 2.0f, 1.8f);

			// Affect all nearby entities in a 14-block radius
			AABB zone = new AABB(x - 7.0, y - 4.0, z - 7.0, x + 7.0, y + 6.0, z + 7.0);
			List<LivingEntity> targets = level.getEntitiesOfClass(LivingEntity.class, zone);

			for (LivingEntity target : targets) {
				// Gentle upward launch and disco glow
				target.setDeltaMovement(0.0, 1.1, 0.0);
				target.hurtMarked = true;
				target.addEffect(new MobEffectInstance(MobEffects.GLOWING, 300, 0, false, false, true));
				target.addEffect(new MobEffectInstance(MobEffects.SLOW_FALLING, 160, 0, false, false, true));
				target.addEffect(new MobEffectInstance(MobEffects.JUMP_BOOST, 300, 2, false, false, true));
			}

			// Spawn 2 dancing disco sheep!
			for (int i = 0; i < 2; i++) {
				Sheep sheep = EntityType.SHEEP.create(serverLevel, EntitySpawnReason.TRIGGERED);
				if (sheep != null) {
					sheep.snapTo(x + (level.random.nextDouble() - 0.5) * 3.0, y, z + (level.random.nextDouble() - 0.5) * 3.0, level.random.nextFloat() * 360f, 0f);
					sheep.setColor(DyeColor.byId(level.random.nextInt(16)));
					sheep.setCustomName(Component.literal("jeb_"));
					sheep.setCustomNameVisible(true);
					sheep.addEffect(new MobEffectInstance(MobEffects.JUMP_BOOST, 600, 2));
					serverLevel.addFreshEntity(sheep);
				}
			}
		}

		player.getCooldowns().addCooldown(stack, 20);
		return InteractionResult.SUCCESS;
	}
}
