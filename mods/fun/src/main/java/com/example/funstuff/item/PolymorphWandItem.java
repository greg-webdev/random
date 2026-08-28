package com.example.funstuff.item;

import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.animal.cow.Cow;
import net.minecraft.world.entity.animal.pig.Pig;
import net.minecraft.world.entity.animal.sheep.Sheep;
import net.minecraft.world.entity.monster.skeleton.Skeleton;
import net.minecraft.world.entity.monster.zombie.Zombie;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;

public class PolymorphWandItem extends Item {
	public PolymorphWandItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult interactLivingEntity(ItemStack stack, Player player, LivingEntity target, InteractionHand hand) {
		Level level = player.level();
		if (level.isClientSide()) {
			return InteractionResult.SUCCESS;
		}

		if (level instanceof ServerLevel serverLevel) {
			double x = target.getX();
			double y = target.getY();
			double z = target.getZ();
			float yRot = target.getYRot();
			float xRot = target.getXRot();

			boolean transformed = false;

			if (target instanceof Sheep sheep) {
				// Turn into rainbow disco sheep!
				sheep.setCustomName(Component.literal("jeb_"));
				sheep.setCustomNameVisible(true);
				transformed = true;
			} else if (target instanceof Pig pig) {
				// Turbo pig!
				pig.addEffect(new MobEffectInstance(MobEffects.SPEED, 6000, 3));
				pig.setCustomName(Component.literal("Speedy"));
				pig.setCustomNameVisible(true);
				transformed = true;
			} else {
				EntityType<?> replacementType = null;
				if (target instanceof Zombie) {
					// 1.21.11 Feature: Zombie Nautilus!
					replacementType = EntityType.ZOMBIE_NAUTILUS;
				} else if (target instanceof Skeleton) {
					// 1.21.11 Feature: Nautilus!
					replacementType = EntityType.NAUTILUS;
				} else if (target instanceof Cow) {
					replacementType = EntityType.MOOSHROOM;
				} else {
					// Cycle between fun creatures & mounts
					EntityType<?>[] funPool = new EntityType<?>[]{
						EntityType.NAUTILUS,
						EntityType.CAMEL,
						EntityType.ALLAY,
						EntityType.FROG,
						EntityType.PANDA
					};
					replacementType = funPool[level.random.nextInt(funPool.length)];
				}

				if (replacementType != null) {
					Entity newEntity = replacementType.create(serverLevel, EntitySpawnReason.TRIGGERED);
					if (newEntity != null) {
						newEntity.snapTo(x, y, z, yRot, xRot);
						target.discard();
						serverLevel.addFreshEntity(newEntity);
						transformed = true;
					}
				}
			}

			if (transformed) {
				serverLevel.sendParticles(ParticleTypes.PORTAL, x, y + 0.8, z, 30, 0.4, 0.4, 0.4, 0.2);
				serverLevel.sendParticles(ParticleTypes.HAPPY_VILLAGER, x, y + 1.0, z, 15, 0.5, 0.5, 0.5, 0.1);
				serverLevel.playSound(null, x, y, z, SoundEvents.ZOMBIE_VILLAGER_CONVERTED, SoundSource.PLAYERS, 1.2f, 1.3f);
				serverLevel.playSound(null, x, y, z, SoundEvents.EVOKER_CAST_SPELL, SoundSource.PLAYERS, 1.0f, 1.2f);
				player.getCooldowns().addCooldown(stack, 15);
				return InteractionResult.SUCCESS;
			}
		}

		return InteractionResult.PASS;
	}
}
